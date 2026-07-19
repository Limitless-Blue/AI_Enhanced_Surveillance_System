import cv2
import numpy as np
from insightface.app import FaceAnalysis
import structlog

log = structlog.get_logger()

_MODEL_NAME = "buffalo_l"


class FaceEmbedder:
    """
    Wraps InsightFace FaceAnalysis (RetinaFace detector + ArcFace R100 embedder).
    Thread-unsafe — create one instance per Celery worker process.
    """

    def __init__(self) -> None:
        log.info("embedder.loading", model=_MODEL_NAME)
        self._app = FaceAnalysis(
            name=_MODEL_NAME,
            providers=["CPUExecutionProvider"],
        )
        self._app.prepare(ctx_id=0, det_size=(640, 640))
        log.info("embedder.ready", model=_MODEL_NAME)

    def get_faces(self, frame: np.ndarray) -> list:
        """Return list of InsightFace Face objects detected in frame."""
        return self._app.get(frame)

    def embed_image(self, image_path: str) -> np.ndarray | None:
        """Load an image file and return the largest face embedding, or None."""
        img = cv2.imread(image_path)
        if img is None:
            log.warning("embedder.load_failed", path=image_path)
            return None
        return self.embed_frame(img)

    def embed_frame(self, frame: np.ndarray) -> np.ndarray | None:
        """Return embedding of the largest face in a frame, or None."""
        faces = self.get_faces(frame)
        if not faces:
            return None
        largest = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        # float32[512] — RAW ArcFace embedding (NOT unit-length).
        # FaceMatcher L2-normalises on input, so cosine similarity is correct there.
        return largest.embedding


_embedder: FaceEmbedder | None = None


def get_embedder() -> FaceEmbedder:
    """Process-level singleton — loads model once per worker."""
    global _embedder
    if _embedder is None:
        _embedder = FaceEmbedder()
    return _embedder
