"""Train a YOLO defect detector.  Usage:
   python ml/train.py --data ml/dataset.yaml --epochs 100 --version v1.0.0
Run on a GPU (e.g. free Google Colab). Result is copied to ml/weights/best.pt."""
import argparse, json, shutil, datetime
from pathlib import Path
from ultralytics import YOLO

p = argparse.ArgumentParser()
p.add_argument("--data", default="ml/dataset.yaml")
p.add_argument("--base", default="yolov8n.pt", help="pretrained starting checkpoint")
p.add_argument("--epochs", type=int, default=100)
p.add_argument("--imgsz", type=int, default=640)
p.add_argument("--batch", type=int, default=16)
p.add_argument("--version", required=True)
a = p.parse_args()

model = YOLO(a.base)
res = model.train(data=a.data, epochs=a.epochs, imgsz=a.imgsz, batch=a.batch,
                  project="ml/runs", name=a.version, exist_ok=True)
best = Path(res.save_dir) / "weights" / "best.pt"
out = Path("ml/weights"); out.mkdir(parents=True, exist_ok=True)
shutil.copy(best, out / "best.pt")
(out / "VERSION.json").write_text(json.dumps({
    "version": a.version, "trained_at": datetime.datetime.utcnow().isoformat() + "Z",
    "data": a.data, "epochs": a.epochs, "base": a.base}, indent=2))
print(f"Saved {out/'best.pt'}  ->  set MODEL_VERSION={a.version} in .env")
