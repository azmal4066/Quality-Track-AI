"""CLI helper: python ml/inference.py path/to/image.jpg"""
import sys
from app.services.yolo_service import yolo_service
data = open(sys.argv[1], "rb").read()
r = yolo_service.predict(data)
for d in r.detections:
    print(d.label, d.confidence, d.bbox)
open("annotated.jpg", "wb").write(r.annotated_jpeg)
