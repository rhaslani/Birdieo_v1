import time
import threading
from contextlib import asynccontextmanager
from typing import Optional
import os
import asyncio

import requests
import numpy as np
import cv2
from fastapi import FastAPI, Response, HTTPException
from starlette.responses import StreamingResponse
from camera_processor import start_camera_processing, stop_camera_processing, get_camera_processor

# ====================== CONFIG ======================
SNAPSHOT_URL = "https://stream.lexingtonnc.gov/golf/hole1/readImage.asp?dummy=1756663077563"
SNAPSHOT_INTERVAL = 0.5      # seconds between polls for smoother streaming
MAX_WIDTH = 1280             # downscale if wider (set 0 to disable)
JPEG_QUALITY = 85            # 1..100 for /frame and /stream.mjpg
# ====================================================

_latest_frame: Optional[np.ndarray] = None
_latest_ts: float = 0.0
_reader_running = True
_lock = threading.Lock()

def _snapshot_reader_loop():
    """Continuously fetch the JPEG and publish it as the latest frame."""
    global _latest_frame, _latest_ts
    backoff = 1.0
    while _reader_running:
        try:
            # Bust caches with a timestamp so browsers/CDNs don't serve stale images
            url = f"{SNAPSHOT_URL}&t={int(time.time()*1000)}" if "?" in SNAPSHOT_URL \
                  else f"{SNAPSHOT_URL}?t={int(time.time()*1000)}"

            r = requests.get(url, timeout=10)
            r.raise_for_status()

            arr = np.frombuffer(r.content, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                raise RuntimeError("cv2.imdecode returned None")

            if MAX_WIDTH > 0 and img.shape[1] > MAX_WIDTH:
                h, w = img.shape[:2]
                new_w = MAX_WIDTH
                new_h = int(h * (new_w / w))
                img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

            with _lock:
                _latest_frame = img
                _latest_ts = time.time()

            backoff = 1.0
            time.sleep(SNAPSHOT_INTERVAL)

        except Exception as e:
            print(f"[SNAPSHOT] Error: {e}. Retrying in {backoff:.1f}s")
            time.sleep(backoff)
            backoff = min(20.0, backoff * 2.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[startup] Starting enhanced live stream with camera processing: {SNAPSHOT_URL}")
    
    # Start snapshot reader
    t = threading.Thread(target=_snapshot_reader_loop, daemon=True)
    t.start()
    
    # Start camera processing system
    start_camera_processing()
    
    yield
    
    # Cleanup
    global _reader_running
    _reader_running = False
    stop_camera_processing()
    print("[shutdown] Enhanced live stream and camera processing stopped")

app = FastAPI(title="Enhanced Lexington Live Golf Cam with Shot Detection", lifespan=lifespan)

@app.get("/health")
def health():
    with _lock:
        has_frame = _latest_frame is not None
        age = (time.time() - _latest_ts) if has_frame else None
    
    camera_processor = get_camera_processor()
    camera_status = camera_processor.is_running if camera_processor else False
    
    return {
        "ok": has_frame, 
        "age_seconds": age, 
        "source": SNAPSHOT_URL,
        "camera_processing": camera_status,
        "features": ["live_stream", "shot_detection", "auto_clip_generation"]
    }

@app.get("/frame")
def frame():
    with _lock:
        img = None if _latest_frame is None else _latest_frame.copy()
    if img is None:
        return Response(status_code=503, content="No frame available")
    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY])
    if not ok:
        return Response(status_code=500, content="Frame encoding failed")
    return Response(content=buf.tobytes(), media_type="image/jpeg")

@app.get("/stream.mjpg")
def mjpeg():
    boundary = "frame"

    def gen():
        while True:
            with _lock:
                img = None if _latest_frame is None else _latest_frame.copy()
            if img is None:
                time.sleep(0.05)
                continue
            ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY])
            if not ok:
                time.sleep(0.02)
                continue
            jpg = buf.tobytes()
            yield (
                b"--" + boundary.encode() + b"\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(jpg)).encode() + b"\r\n\r\n" +
                jpg + b"\r\n"
            )

    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Connection": "keep-alive",
    }
    return StreamingResponse(
        gen(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers=headers,
    )

@app.get("/analyze")
def analyze_demo():
    """Get current frame analysis with shot detection info"""
    with _lock:
        img = None if _latest_frame is None else _latest_frame.copy()
        ts = _latest_ts
    if img is None:
        return {"ok": False, "reason": "no frame yet"}
    
    h, w = img.shape[:2]
    
    # Get camera processor status
    camera_processor = get_camera_processor()
    processing_info = {
        "processing_active": camera_processor.is_running if camera_processor else False,
        "last_motion_detection": camera_processor.shot_detector.last_motion_time if camera_processor else 0,
        "motion_counter": camera_processor.shot_detector.motion_counter if camera_processor else 0
    }
    
    # Demo detection box
    box = {"x": int(w*0.25), "y": int(h*0.25), "w": int(w*0.5), "h": int(h*0.5)}
    
    return {
        "ok": True, 
        "ts": ts, 
        "width": w, 
        "height": h, 
        "detections": [{"label": "golf_area", "box": box}],
        "camera_processing": processing_info
    }

@app.get("/clips/stats")
def get_clip_stats():
    """Get statistics about generated clips"""
    clips_dir = '/app/clips'
    if not os.path.exists(clips_dir):
        return {"total_clips": 0, "clips_dir": clips_dir}
    
    clip_files = [f for f in os.listdir(clips_dir) if f.endswith('.mp4')]
    
    return {
        "total_clips": len(clip_files),
        "clips_dir": clips_dir,
        "recent_clips": clip_files[-5:] if clip_files else []
    }

@app.post("/trigger-clip")
async def manual_trigger_clip():
    """Manually trigger clip generation for testing"""
    camera_processor = get_camera_processor()
    if not camera_processor:
        raise HTTPException(status_code=503, detail="Camera processing not active")
    
    # Get current frame
    with _lock:
        img = None if _latest_frame is None else _latest_frame.copy()
        ts = _latest_ts
    
    if img is None:
        raise HTTPException(status_code=503, detail="No frame available")
    
    # Create a mock clip with current frame repeated
    clip_frames = [img] * 300  # 10 seconds at 30fps
    
    # Process the manual trigger
    await camera_processor._process_shot_detection(clip_frames)
    
    return {
        "message": "Manual clip generation triggered",
        "timestamp": ts,
        "frame_count": len(clip_frames)
    }