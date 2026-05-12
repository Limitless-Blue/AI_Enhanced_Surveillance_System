from typing import Iterator
import cv2
import numpy as np
import structlog

log = structlog.get_logger()


class StreamReader:
    """
    Motion-gated frame producer for webcam, video file, or RTSP stream.

    - frame_skip: analyse every Nth frame (saves CPU on high-FPS sources)
    - motion_threshold: skip frames where mean pixel diff < threshold
      (saves CPU on static scenes — typical surveillance footage)
    - Set motion_threshold=0 to disable motion gating entirely.
    """

    def __init__(
        self,
        source: str | int,
        frame_skip: int = 3,
        motion_threshold: float = 1.5,
        max_width: int = 1280,
    ) -> None:
        self.source = source
        self.frame_skip = max(1, frame_skip)
        self.motion_threshold = motion_threshold
        self.max_width = max_width

    def frames(self) -> Iterator[np.ndarray]:
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open source: {self.source!r}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 0
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or -1
        log.info(
            "stream.opened",
            source=str(self.source),
            fps=round(fps, 1),
            total_frames=total,
        )

        prev_gray: np.ndarray | None = None
        n = 0

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                n += 1
                if n % self.frame_skip != 0:
                    continue

                # Resize large frames to cap inference time
                h, w = frame.shape[:2]
                if w > self.max_width:
                    scale = self.max_width / w
                    frame = cv2.resize(frame, (self.max_width, int(h * scale)))

                # Motion gate
                if self.motion_threshold > 0:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    if prev_gray is not None:
                        diff = cv2.absdiff(gray, prev_gray)
                        if diff.mean() < self.motion_threshold:
                            prev_gray = gray
                            continue
                    prev_gray = gray

                yield frame

        finally:
            cap.release()
            log.info("stream.closed", source=str(self.source), frames_read=n)
