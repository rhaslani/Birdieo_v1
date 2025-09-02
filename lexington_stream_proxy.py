#!/usr/bin/env python3
"""
Proxy server to fetch and serve Lexington Golf Club live stream
Handles CORS and provides a reliable stream endpoint
"""

import requests
import time
import threading
from contextlib import asynccontextmanager
from typing import Optional
import asyncio

import numpy as np
import cv2
from fastapi import FastAPI, Response
from starlette.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# ====================== CONFIG ======================
LEXINGTON_STREAM_URL = "https://www.lexingtongolfclub.net/live-stream/"
LEXINGTON_IMAGE_URL = "https://stream.lexingtonnc.gov/golf/hole1/readImage.asp"
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
            # Try direct image URL first (more reliable)
            url = f"{LEXINGTON_IMAGE_URL}?t={int(time.time()*1000)}"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/jpeg,image/png,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
            
            r = requests.get(url, timeout=10, headers=headers, stream=True)
            r.raise_for_status()

            # Read image data
            image_data = r.content
            
            # Decode image
            arr = np.frombuffer(image_data, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            
            if img is None:
                raise RuntimeError("cv2.imdecode returned None")

            # Resize if needed
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
            print(f"[LEXINGTON_PROXY] Error: {e}. Retrying in {backoff:.1f}s")
            time.sleep(backoff)
            backoff = min(20.0, backoff * 2.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[startup] Starting Lexington Golf Stream Proxy")
    print(f"[startup] Source: {LEXINGTON_IMAGE_URL}")
    print(f"[startup] Website: {LEXINGTON_STREAM_URL}")
    
    t = threading.Thread(target=_snapshot_reader_loop, daemon=True)
    t.start()
    yield
    
    global _reader_running
    _reader_running = False
    print("[shutdown] Lexington stream proxy stopping…")

app = FastAPI(title="Lexington Golf Stream Proxy", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    with _lock:
        has_frame = _latest_frame is not None
        age = (time.time() - _latest_ts) if has_frame else None
    return {
        "ok": has_frame, 
        "age_seconds": age, 
        "source": LEXINGTON_IMAGE_URL,
        "website": LEXINGTON_STREAM_URL,
        "proxy": "lexington_golf_club"
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
    
    return Response(
        content=buf.tobytes(), 
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@app.get("/stream.mjpg")
def mjpeg():
    boundary = "frame"

    def gen():
        while True:
            with _lock:
                img = None if _latest_frame is None else _latest_frame.copy()
            if img is None:
                time.sleep(0.1)
                continue
                
            ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY])
            if not ok:
                time.sleep(0.05)
                continue
                
            jpg = buf.tobytes()
            yield (
                b"--" + boundary.encode() + b"\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(jpg)).encode() + b"\r\n\r\n" +
                jpg + b"\r\n"
            )
            time.sleep(SNAPSHOT_INTERVAL)

    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*"
    }
    return StreamingResponse(
        gen(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers=headers,
    )

@app.get("/analyze")
def analyze_golf_course():
    """Analyze current frame for golf-related objects"""
    with _lock:
        img = None if _latest_frame is None else _latest_frame.copy()
        ts = _latest_ts
        
    if img is None:
        return {"ok": False, "reason": "no frame yet"}
    
    h, w = img.shape[:2]
    
    # Mock detection results for demonstration
    # In a real implementation, this would use AI detection
    detections = {
        "people": [
            {
                "id": "golfer_1",
                "bbox": {"x": int(w*0.3), "y": int(h*0.4), "width": int(w*0.1), "height": int(h*0.3)},
                "clothing": {
                    "top_color": "blue",
                    "top_style": "polo",
                    "bottom_color": "white"
                },
                "confidence": 0.85
            }
        ],
        "flagstick": [
            {
                "bbox": {"x": int(w*0.7), "y": int(h*0.2), "width": 5, "height": int(h*0.6)},
                "confidence": 0.92
            }
        ],
        "golf_balls": [
            {
                "bbox": {"x": int(w*0.5), "y": int(h*0.7), "width": 10, "height": 10},
                "confidence": 0.78
            }
        ]
    }
    
    return {
        "ok": True, 
        "ts": ts, 
        "width": w, 
        "height": h, 
        "detections": detections,
        "golf_course": "lexington_hole_1"
    }

@app.get("/info")
def stream_info():
    """Get information about the stream source"""
    return {
        "course_name": "Lexington Golf Club",
        "hole": 1,
        "location": "Lexington, NC",
        "description": "Live view of hole 1 tee box and fairway",
        "website": LEXINGTON_STREAM_URL,
        "image_source": LEXINGTON_IMAGE_URL,
        "features": [
            "real_time_streaming",
            "golf_object_detection", 
            "mjpeg_support",
            "cors_enabled"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)