"""Real YOLO inference. If weights are missing the service reports 'unavailable'
and NEVER fabricates detections."""
import logging
import threading
from dataclasses import dataclass, asdict
from pathlib import Path
import cv2
import numpy as np
from app.core.config import get_settings

log = logging.getLogger("yolo")


class ModelUnavailable(Exception):
    pass


class InvalidImage(Exception):
    pass


@dataclass
class Detection:
    label: str
    confidence: float
    bbox: list[float]  # x1, y1, x2, y2 in pixels

    def dict(self):
        return asdict(self)


@dataclass
class InferenceResult:
    detections: list[Detection]
    annotated_jpeg: bytes
    width: int
    height: int


class YoloService:
    def __init__(self):
        self._model = None
        self._lock = threading.Lock()
        self.error: str | None = None

    @property
    def path(self) -> Path:
        return Path(get_settings().yolo_model_path)

    def load(self) -> bool:
        with self._lock:
            if self._model is not None:
                return True
            if not self.path.is_file():
                self.error = f"Weights file not found at '{self.path}'. See README > Train the model."
                return False
            try:
                from ultralytics import YOLO
                self._model = YOLO(str(self.path))
                self.error = None
                log.info("YOLO model loaded from %s", self.path)
                return True
            except Exception as e:  # corrupt / incompatible weights
                self.error = f"Failed to load weights: {e}"
                log.exception("model load failed")
                return False

    def status(self) -> dict:
        loaded = self.load()
        classes = list(self._model.names.values()) if loaded else []
        return {
            "available": loaded,
            "model_version": get_settings().model_version,
            "weights_path": str(self.path),
            "classes": classes,
            "error": self.error,
            "setup_hint": None if loaded else "Train or download defect-detection weights and set YOLO_MODEL_PATH.",
        }

    @staticmethod
    def decode(data: bytes) -> np.ndarray:
        arr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise InvalidImage("File could not be decoded as an image")
        return img

    def predict(self, data: bytes, conf: float = 0.25) -> InferenceResult:
        if not self.load():
            raise ModelUnavailable(self.error or "Model unavailable")
        img = self.decode(data)
        h, w = img.shape[:2]
        results = self._model.predict(img, conf=conf, verbose=False)[0]
        dets = []
        for b in results.boxes:
            dets.append(Detection(
                label=self._model.names[int(b.cls)],
                confidence=round(float(b.conf), 4),
                bbox=[round(float(v), 1) for v in b.xyxy[0].tolist()],
            ))
        annotated = results.plot()
        ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if not ok:
            raise RuntimeError("Failed to encode annotated image")
        return InferenceResult(dets, buf.tobytes(), w, h)


yolo_service = YoloService()
