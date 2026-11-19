import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("prep", Path(__file__).parents[1] / "ml" / "prepare_neu_det.py")
prep = importlib.util.module_from_spec(spec); spec.loader.exec_module(prep)


def test_voc_to_yolo_normalizes_box():
    assert prep.voc_to_yolo((200, 100), (50, 25, 150, 75)) == (0.5, 0.5, 0.5, 0.5)
