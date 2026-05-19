"""
DeepSORT-based multi-object tracker.
Assigns a persistent track_id to each person across frames.

Benefits over per-frame matching:
1. One alert per person per camera visit, not per frame
2. Embedding averaged over last N frames — more stable identity
3. Brief occlusion handled (person walks behind a pillar)
"""
import numpy as np
import structlog

log = structlog.get_logger()

EMBED_BUFFER_SIZE = 5   # average over last N frames per track


class PersonTracker:
    def __init__(self, max_age: int = 30) -> None:
        try:
            from deep_sort_realtime.deepsort_tracker import DeepSort
            self._tracker = DeepSort(max_age=max_age, embedder=None)
        except ImportError:
            log.warning("tracker.deepsort_unavailable", hint="pip install deep-sort-realtime")
            self._tracker = None

        self._embeddings: dict[int, list[np.ndarray]] = {}
        self._alerted: set[int] = set()

    @property
    def available(self) -> bool:
        return self._tracker is not None

    def update(self, faces: list, frame: np.ndarray) -> list[dict]:
        """
        Update tracker with detected faces.
        Returns list of active tracks with stable averaged embeddings.
        Each dict: { track_id, embedding, bbox, already_alerted }
        """
        if not self.available or not faces:
            # Fallback: return each face as its own unique track
            return [
                {
                    "track_id": None,
                    "embedding": f.embedding,
                    "bbox": tuple(map(int, f.bbox)),
                    "already_alerted": False,
                }
                for f in faces
            ]

        # DeepSort expects: [([x, y, w, h], confidence, embedding), ...]
        raw = []
        for face in faces:
            x1, y1, x2, y2 = map(int, face.bbox)
            raw.append(([x1, y1, x2 - x1, y2 - y1], float(face.det_score), face.embedding))

        try:
            tracks = self._tracker.update_tracks(raw, frame=frame)
        except Exception as e:
            log.warning("tracker.update_failed", error=str(e))
            return []

        results = []
        for track in tracks:
            if not track.is_confirmed():
                continue
            tid = track.track_id

            # Accumulate embeddings
            det_emb = getattr(track, "det_class", None)
            if det_emb is not None and isinstance(det_emb, np.ndarray):
                buf = self._embeddings.setdefault(tid, [])
                buf.append(det_emb)
                if len(buf) > EMBED_BUFFER_SIZE:
                    buf.pop(0)

            buf = self._embeddings.get(tid, [])
            if buf:
                avg = np.mean(buf, axis=0).astype(np.float32)
                norm = np.linalg.norm(avg)
                if norm > 0:
                    avg /= norm
            else:
                avg = det_emb if det_emb is not None else None

            if avg is None:
                continue

            ltwh = track.to_ltwh()
            x1 = int(ltwh[0])
            y1 = int(ltwh[1])
            x2 = int(ltwh[0] + ltwh[2])
            y2 = int(ltwh[1] + ltwh[3])

            results.append({
                "track_id": tid,
                "embedding": avg,
                "bbox": (x1, y1, x2, y2),
                "already_alerted": tid in self._alerted,
            })

        return results

    def mark_alerted(self, track_id: int) -> None:
        if track_id is not None:
            self._alerted.add(track_id)

    def cleanup(self, active_ids: list[int]) -> None:
        """Remove embeddings for tracks that are no longer active."""
        dead = set(self._embeddings) - set(active_ids)
        for tid in dead:
            self._embeddings.pop(tid, None)
            self._alerted.discard(tid)
