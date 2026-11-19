# Train the defect model on free Google Colab (T4 GPU)

Easiest path: use `neu-det-yolo-ready.zip` (NEU-DET already converted to YOLO format, 1440 train / 180 val / 180 test).

1. https://colab.research.google.com > New notebook.
2. Runtime > Change runtime type > Hardware accelerator **T4 GPU** > Save.
3. Cell 1, check the GPU (must show "Tesla T4", not an error):
   `!nvidia-smi`
4. Upload `neu-det-yolo-ready.zip` (left sidebar > folder icon > upload), then:
```
!unzip -q /content/neu-det-yolo-ready.zip -d /content
!pip -q install ultralytics==8.4.215
!yolo detect train model=yolov8n.pt data=/content/neu_yolo/dataset.yaml epochs=100 imgsz=640 batch=16 project=/content/runs name=v1
```
5. Evaluate on the test split:
   `!yolo detect val model=/content/runs/v1/weights/best.pt data=/content/neu_yolo/dataset.yaml split=test`
6. Download `/content/runs/v1/weights/best.pt` (sidebar > folders > runs > v1 > weights > right click > Download). Colab deletes files when the session ends, so download before closing.
7. Put it at `backend/ml/weights/best.pt`, set `MODEL_VERSION=v1.0.0` in `backend/.env`, restart the backend.
8. Settings > AI model status should show "Model loaded" with the 6 classes.

Using raw NEU-DET instead: `python ml/prepare_neu_det.py --src <folder> --out ml/datasets/defects` (verified on the real dataset: 1800 pairs, no empty labels).

NEU-DET classes are steel-surface defects (crazing, inclusion, patches, pitted_surface, rolled-in_scale, scratches). The app only shows classes the loaded model knows. `*.pt` is git-ignored; for Render/Railway put the file in the image or a mounted volume.
