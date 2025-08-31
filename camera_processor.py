import cv2
import numpy as np
import asyncio
import time
import threading
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from collections import deque
import requests
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ShotDetector:
    """Advanced shot detection using computer vision"""
    
    def __init__(self):
        self.background_subtractor = cv2.createBackgroundSubtractorMOG2(
            detectShadows=True, varThreshold=50
        )
        self.motion_threshold = 5000  # Minimum motion area to consider
        self.consecutive_frames = 3   # Frames needed to confirm motion
        self.motion_counter = 0
        self.last_motion_time = 0
        self.cooldown_period = 10     # Seconds between detections
        
    def detect_motion(self, frame: np.ndarray) -> bool:
        """Detect significant motion that could indicate a golf swing"""
        # Apply background subtraction
        fg_mask = self.background_subtractor.apply(frame)
        
        # Remove noise
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Calculate total motion area
        total_area = sum(cv2.contourArea(contour) for contour in contours)
        
        # Check if motion exceeds threshold
        current_time = time.time()
        if total_area > self.motion_threshold:
            if current_time - self.last_motion_time > self.cooldown_period:
                self.motion_counter += 1
                if self.motion_counter >= self.consecutive_frames:
                    self.last_motion_time = current_time
                    self.motion_counter = 0
                    return True
        else:
            self.motion_counter = max(0, self.motion_counter - 1)
            
        return False

class FrameBuffer:
    """Circular buffer for video frames with timestamps"""
    
    def __init__(self, max_size: int = 300):  # 10 seconds at 30fps
        self.buffer = deque(maxlen=max_size)
        self.timestamps = deque(maxlen=max_size)
        self.lock = threading.Lock()
        
    def add_frame(self, frame: np.ndarray, timestamp: float):
        """Add frame to buffer"""
        with self.lock:
            self.buffer.append(frame.copy())
            self.timestamps.append(timestamp)
            
    def get_clip_frames(self, trigger_time: float, duration: float = 10.0) -> List[np.ndarray]:
        """Get frames for a clip around trigger time"""
        with self.lock:
            if not self.timestamps:
                return []
                
            # Find frames within the duration window
            start_time = trigger_time - duration / 2
            end_time = trigger_time + duration / 2
            
            clip_frames = []
            for i, ts in enumerate(self.timestamps):
                if start_time <= ts <= end_time:
                    clip_frames.append(self.buffer[i])
                    
            return clip_frames

class CameraProcessor:
    """Main camera processing system"""
    
    def __init__(self, stream_url: str, backend_url: str):
        self.stream_url = stream_url
        self.backend_url = backend_url
        self.shot_detector = ShotDetector()
        self.frame_buffer = FrameBuffer()
        self.is_running = False
        self.processing_thread = None
        
        # MongoDB connection
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        self.client = AsyncIOMotorClient(mongo_url)
        self.db = self.client[os.environ.get('DB_NAME', 'birdieo_db')]
        
        # Create clips directory
        self.clips_dir = '/app/clips'
        os.makedirs(self.clips_dir, exist_ok=True)
        
    async def save_clip_to_db(self, clip_data: Dict[str, Any]):
        """Save clip metadata to database"""
        try:
            await self.db.clips.insert_one(clip_data)
            logger.info(f"Saved clip to database: {clip_data['id']}")
        except Exception as e:
            logger.error(f"Failed to save clip to database: {e}")
            
    def save_clip_video(self, frames: List[np.ndarray], clip_id: str) -> str:
        """Save clip frames as video file"""
        try:
            clip_path = os.path.join(self.clips_dir, f"{clip_id}.mp4")
            
            if not frames:
                logger.warning("No frames to save for clip")
                return ""
                
            # Get frame dimensions
            height, width = frames[0].shape[:2]
            
            # Create video writer
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            fps = 30.0
            out = cv2.VideoWriter(clip_path, fourcc, fps, (width, height))
            
            # Write frames
            for frame in frames:
                out.write(frame)
                
            out.release()
            logger.info(f"Saved video clip: {clip_path}")
            return clip_path
            
        except Exception as e:
            logger.error(f"Failed to save video clip: {e}")
            return ""
            
    async def create_clip_for_round(self, frames: List[np.ndarray], round_id: str):
        """Create and save a 10-second clip for hole 1"""
        try:
            clip_id = str(uuid.uuid4())
            
            # Save video file
            clip_path = self.save_clip_video(frames, clip_id)
            if not clip_path:
                return
                
            # Create clip metadata
            clip_data = {
                "id": clip_id,
                "round_id": round_id,
                "subject_id": f"auto_detected_{round_id}",
                "hole_number": 1,
                "camera_id": "lexington_hole_1",
                "s3_key_master": f"clips/{clip_id}.mp4",
                "hls_manifest": f"/clips/{clip_id}.mp4",
                "poster_url": f"/clips/{clip_id}_poster.jpg",
                "duration_sec": len(frames) // 30,  # Approximate duration
                "face_blur_applied": False,
                "published_at": datetime.now(timezone.utc).isoformat(),
                "auto_generated": True,
                "detection_method": "motion_detection"
            }
            
            # Save to database
            await self.save_clip_to_db(clip_data)
            
            # Generate poster frame (middle frame)
            if frames:
                middle_frame = frames[len(frames) // 2]
                poster_path = os.path.join(self.clips_dir, f"{clip_id}_poster.jpg")
                cv2.imwrite(poster_path, middle_frame)
                
            logger.info(f"Created clip for round {round_id}: {clip_id}")
            
        except Exception as e:
            logger.error(f"Failed to create clip for round {round_id}: {e}")
            
    async def get_active_rounds(self) -> List[str]:
        """Get list of active round IDs from database"""
        try:
            cursor = self.db.rounds.find({"status": "active"})
            rounds = await cursor.to_list(length=None)
            return [round_doc["id"] for round_doc in rounds]
        except Exception as e:
            logger.error(f"Failed to get active rounds: {e}")
            return []
            
    def process_stream(self):
        """Main stream processing loop"""
        cap = None
        try:
            # Open video stream
            cap = cv2.VideoCapture(self.stream_url)
            if not cap.isOpened():
                logger.error(f"Failed to open stream: {self.stream_url}")
                return
                
            logger.info(f"Started processing stream: {self.stream_url}")
            
            while self.is_running:
                ret, frame = cap.read()
                if not ret:
                    logger.warning("Failed to read frame, attempting to reconnect...")
                    time.sleep(1)
                    continue
                    
                current_time = time.time()
                
                # Add frame to buffer
                self.frame_buffer.add_frame(frame, current_time)
                
                # Detect motion/shot
                if self.shot_detector.detect_motion(frame):
                    logger.info("Shot detected! Creating clip...")
                    
                    # Get clip frames
                    clip_frames = self.frame_buffer.get_clip_frames(current_time, 10.0)
                    
                    if clip_frames:
                        # Get active rounds and create clips
                        asyncio.create_task(self._process_shot_detection(clip_frames))
                        
                # Small delay to prevent overwhelming the system
                time.sleep(0.033)  # ~30 FPS
                
        except Exception as e:
            logger.error(f"Error in stream processing: {e}")
        finally:
            if cap:
                cap.release()
                
    async def _process_shot_detection(self, clip_frames: List[np.ndarray]):
        """Process detected shot and create clips for active rounds"""
        try:
            active_rounds = await self.get_active_rounds()
            logger.info(f"Creating clips for {len(active_rounds)} active rounds")
            
            for round_id in active_rounds:
                await self.create_clip_for_round(clip_frames, round_id)
                
        except Exception as e:
            logger.error(f"Error processing shot detection: {e}")
            
    def start(self):
        """Start camera processing"""
        if self.is_running:
            logger.warning("Camera processor already running")
            return
            
        self.is_running = True
        self.processing_thread = threading.Thread(target=self.process_stream)
        self.processing_thread.daemon = True
        self.processing_thread.start()
        logger.info("Camera processor started")
        
    def stop(self):
        """Stop camera processing"""
        self.is_running = False
        if self.processing_thread:
            self.processing_thread.join(timeout=5)
        logger.info("Camera processor stopped")

# Global camera processor instance
camera_processor = None

def get_camera_processor() -> Optional[CameraProcessor]:
    """Get the global camera processor instance"""
    return camera_processor

def start_camera_processing():
    """Start the camera processing system"""
    global camera_processor
    
    if camera_processor is None:
        # Use Lexington stream URL
        stream_url = "https://stream.lexingtonnc.gov/golf/hole1/readImage.asp"
        backend_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://golf-birdieo.preview.emergentagent.com')
        
        camera_processor = CameraProcessor(stream_url, backend_url)
        camera_processor.start()
        
    return camera_processor

def stop_camera_processing():
    """Stop the camera processing system"""
    global camera_processor
    
    if camera_processor:
        camera_processor.stop()
        camera_processor = None