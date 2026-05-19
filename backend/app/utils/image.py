import cv2
import numpy as np
from pathlib import Path
from uuid import uuid4


def save_upload(data: bytes, dest_dir: Path, suffix: str = ".jpg") -> Path:
    """Save raw bytes to dest_dir with a unique filename."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    path = dest_dir / f"{uuid4().hex}{suffix}"
    path.write_bytes(data)
    return path


def save_frame_crop(frame: np.ndarray, bbox: tuple, dest_dir: Path) -> Path:
    """Crop a face bounding box from a frame and save as JPEG."""
    x1, y1, x2, y2 = bbox
    h, w = frame.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    crop = frame[y1:y2, x1:x2]

    dest_dir.mkdir(parents=True, exist_ok=True)
    path = dest_dir / f"{uuid4().hex}.jpg"
    cv2.imwrite(str(path), crop)
    return path


def read_image_bytes(data: bytes) -> np.ndarray | None:
    """Decode image bytes to a BGR numpy array."""
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def resize_max(img: np.ndarray, max_dim: int = 1280) -> np.ndarray:
    h, w = img.shape[:2]
    if max(h, w) <= max_dim:
        return img
    scale = max_dim / max(h, w)
    return cv2.resize(img, (int(w * scale), int(h * scale)))
