"""Evaluate weights on the validation/test split and print metrics."""
import argparse, json
from ultralytics import YOLO

p = argparse.ArgumentParser()
p.add_argument("--weights", default="ml/weights/best.pt")
p.add_argument("--data", default="ml/dataset.yaml")
p.add_argument("--split", default="val", choices=["val", "test"])
a = p.parse_args()
m = YOLO(a.weights).val(data=a.data, split=a.split)
print(json.dumps({"mAP50": float(m.box.map50), "mAP50-95": float(m.box.map),
                  "precision": float(m.box.mp), "recall": float(m.box.mr)}, indent=2))
