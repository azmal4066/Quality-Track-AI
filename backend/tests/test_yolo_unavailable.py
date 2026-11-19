import pytest
from app.core.config import get_settings
from app.services.yolo_service import YoloService, ModelUnavailable


def test_missing_weights_never_fabricates(monkeypatch):
    monkeypatch.setenv("YOLO_MODEL_PATH", "does/not/exist.pt")
    get_settings.cache_clear()
    svc = YoloService()
    assert svc.status()["available"] is False
    with pytest.raises(ModelUnavailable):
        svc.predict(b"anything")
