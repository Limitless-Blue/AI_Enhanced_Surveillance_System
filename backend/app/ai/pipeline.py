from dataclasses import dataclass, field
import numpy as np
import structlog

from app.ai.embedder import FaceEmbedder
from app.ai.quality import is_quality_face, quality_reason
from app.ai.matcher import FaceMatcher

log = structlog.get_logger()


@dataclass
class MatchResult:
    person_name: str
    person_id: str
    score: float
    confidence: str                          # HIGH | REVIEW
    bbox: tuple[int, int, int, int]          # x1 y1 x2 y2


@dataclass
class PipelineResult:
    faces_detected: int = 0
    faces_passed_quality: int = 0
    matches: list[MatchResult] = field(default_factory=list)

    @property
    def has_match(self) -> bool:
        return len(self.matches) > 0

    @property
    def high_confidence_matches(self) -> list[MatchResult]:
        return [m for m in self.matches if m.confidence == "HIGH"]


class AIPipeline:
    """
    Orchestrates the full per-frame AI flow:
      detect → quality filter → embed → match

    One instance per Celery worker (embedder is process-level singleton).
    The matcher is injected so it can be hot-reloaded when new persons are enrolled.
    """

    def __init__(self, embedder: FaceEmbedder, matcher: FaceMatcher) -> None:
        self.embedder = embedder
        self.matcher = matcher

    def run(self, frame: np.ndarray) -> PipelineResult:
        result = PipelineResult()

        faces = self.embedder.get_faces(frame)
        result.faces_detected = len(faces)

        for face in faces:
            if not is_quality_face(face, frame):
                log.debug(
                    "pipeline.quality_rejected",
                    reason=quality_reason(face, frame),
                )
                continue

            result.faces_passed_quality += 1
            match = self.matcher.find_match(face.embedding)

            if match:
                x1, y1, x2, y2 = map(int, face.bbox)
                result.matches.append(
                    MatchResult(
                        person_name=match["person"]["name"],
                        person_id=str(match["person"].get("_id", "")),
                        score=match["score"],
                        confidence=match["confidence"],
                        bbox=(x1, y1, x2, y2),
                    )
                )
                log.info(
                    "pipeline.match_found",
                    name=match["person"]["name"],
                    score=match["score"],
                    confidence=match["confidence"],
                )

        if result.faces_detected > 0:
            log.debug(
                "pipeline.frame_done",
                detected=result.faces_detected,
                quality=result.faces_passed_quality,
                matches=len(result.matches),
            )

        return result
