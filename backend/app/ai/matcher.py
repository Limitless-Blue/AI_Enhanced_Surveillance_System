import numpy as np
import structlog

log = structlog.get_logger()

DEFAULT_THRESHOLD = 0.45


class FaceMatcher:
    """
    In-memory batch cosine-similarity matcher.
    Call load() once at startup (and after any enrollment).
    find_match() is a single numpy matmul — O(1) regardless of DB size.
    """

    def __init__(self) -> None:
        self._matrix: np.ndarray | None = None   # shape (N, 512)
        self._persons: list[dict] = []

    @property
    def size(self) -> int:
        return len(self._persons)

    def load(self, persons: list[dict]) -> None:
        """
        Build the in-memory embedding matrix from a list of person dicts.
        Each dict must have an 'embedding' key with a list/array of 512 floats.
        """
        self._persons = persons
        if not persons:
            self._matrix = None
            log.info("matcher.loaded", count=0)
            return

        embeddings = [np.array(p["embedding"], dtype=np.float32) for p in persons]
        self._matrix = np.stack(embeddings)   # (N, 512)
        log.info("matcher.loaded", count=len(persons))

    def add(self, person: dict) -> None:
        """Hot-add a single enrolled person without full reload."""
        emb = np.array(person["embedding"], dtype=np.float32).reshape(1, 512)
        self._persons.append(person)
        if self._matrix is None:
            self._matrix = emb
        else:
            self._matrix = np.vstack([self._matrix, emb])

    def find_match(
        self,
        embedding: np.ndarray,
        threshold: float = DEFAULT_THRESHOLD,
    ) -> dict | None:
        """
        Return the best matching person or None.
        Result: { person: dict, score: float, confidence: 'HIGH'|'REVIEW' }
        """
        if self._matrix is None or len(self._persons) == 0:
            return None

        # Cosine similarity = dot product (embeddings are L2-normalised)
        scores: np.ndarray = self._matrix @ embedding  # (N,)
        best_idx = int(np.argmax(scores))
        best_score = float(scores[best_idx])

        if best_score < threshold:
            return None

        confidence = "HIGH" if best_score >= 0.60 else "REVIEW"
        return {
            "person": self._persons[best_idx],
            "score": round(best_score, 4),
            "confidence": confidence,
        }

    def top_matches(
        self,
        embedding: np.ndarray,
        top_k: int = 5,
        threshold: float = DEFAULT_THRESHOLD,
    ) -> list[dict]:
        """Return top-k matches above threshold, sorted by score descending."""
        if self._matrix is None or len(self._persons) == 0:
            return []

        scores: np.ndarray = self._matrix @ embedding
        indices = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in indices:
            score = float(scores[idx])
            if score < threshold:
                break
            results.append({
                "person": self._persons[idx],
                "score": round(score, 4),
                "confidence": "HIGH" if score >= 0.60 else "REVIEW",
            })
        return results
