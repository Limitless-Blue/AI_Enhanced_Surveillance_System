import cv2
import numpy as np

MIN_FACE_PX = 60          # minimum width or height in pixels
MIN_SHARPNESS = 80.0      # Laplacian variance — lower = blurry
MIN_DET_SCORE = 0.85      # RetinaFace detection confidence


def is_quality_face(face, frame: np.ndarray) -> bool:
    """
    Return True only if the face crop is large enough, sharp enough,
    and detected with sufficient confidence.
    Rejects faces that would produce unreliable embeddings.
    """
    x1, y1, x2, y2 = map(int, face.bbox)
    w, h = x2 - x1, y2 - y1

    if w < MIN_FACE_PX or h < MIN_FACE_PX:
        return False

    if float(face.det_score) < MIN_DET_SCORE:
        return False

    # Clamp to frame bounds before cropping
    fh, fw = frame.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(fw, x2), min(fh, y2)
    crop = frame[y1:y2, x1:x2]

    if crop.size == 0:
        return False

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    return sharpness >= MIN_SHARPNESS


def quality_reason(face, frame: np.ndarray) -> str:
    """Return a human-readable reason for rejection (debugging only)."""
    x1, y1, x2, y2 = map(int, face.bbox)
    w, h = x2 - x1, y2 - y1
    if w < MIN_FACE_PX or h < MIN_FACE_PX:
        return f"too_small ({w}x{h}px)"
    if float(face.det_score) < MIN_DET_SCORE:
        return f"low_confidence ({face.det_score:.2f})"
    fh, fw = frame.shape[:2]
    crop = frame[max(0,y1):min(fh,y2), max(0,x1):min(fw,x2)]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if sharpness < MIN_SHARPNESS:
        return f"blurry (sharpness={sharpness:.1f})"
    return "ok"
