"""Convert the NEU-DET steel-surface defect dataset (Pascal VOC XML) to YOLO format.

You must download NEU-DET yourself (e.g. from Kaggle, which needs your login) and unzip it anywhere.
This script searches the folder for *.xml annotations and the matching images, so the exact
folder layout does not matter.

Usage:
  python ml/prepare_neu_det.py --src /path/to/NEU-DET --out ml/datasets/defects
Then it rewrites ml/dataset.yaml with the class names it found.
"""
import argparse
import random
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

IMG_EXT = (".jpg", ".jpeg", ".png", ".bmp")


def voc_to_yolo(size: tuple[int, int], box: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    w, h = size
    x1, y1, x2, y2 = box
    return ((x1 + x2) / 2 / w, (y1 + y2) / 2 / h, (x2 - x1) / w, (y2 - y1) / h)


def parse_xml(path: Path):
    r = ET.parse(path).getroot()
    sz = r.find("size")
    w, h = int(float(sz.findtext("width"))), int(float(sz.findtext("height")))
    objs = []
    for o in r.findall("object"):
        b = o.find("bndbox")
        box = tuple(float(b.findtext(k)) for k in ("xmin", "ymin", "xmax", "ymax"))
        objs.append((o.findtext("name").strip(), box))
    return (w, h), objs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", default="ml/datasets/defects")
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    src, out = Path(a.src), Path(a.out)

    images = {p.stem: p for p in src.rglob("*") if p.suffix.lower() in IMG_EXT}
    pairs = [(x, images[x.stem]) for x in sorted(src.rglob("*.xml")) if x.stem in images]
    if not pairs:
        raise SystemExit(f"No XML+image pairs found under {src}. Check the dataset path.")

    parsed = [(img, *parse_xml(x)) for x, img in pairs]
    names = sorted({n for _, _, objs in parsed for n, _ in objs})
    idx = {n: i for i, n in enumerate(names)}

    random.Random(a.seed).shuffle(parsed)
    n = len(parsed)
    cut = {"train": parsed[: int(n * .8)], "val": parsed[int(n * .8): int(n * .9)], "test": parsed[int(n * .9):]}
    for split, rows in cut.items():
        (out / "images" / split).mkdir(parents=True, exist_ok=True)
        (out / "labels" / split).mkdir(parents=True, exist_ok=True)
        for img, size, objs in rows:
            shutil.copy(img, out / "images" / split / img.name)
            lines = [f"{idx[nm]} " + " ".join(f"{v:.6f}" for v in voc_to_yolo(size, box)) for nm, box in objs]
            (out / "labels" / split / f"{img.stem}.txt").write_text("\n".join(lines))

    yaml = "path: ml/datasets/defects\ntrain: images/train\nval: images/val\ntest: images/test\nnames:\n" + \
           "".join(f"  {i}: {nm}\n" for i, nm in enumerate(names))
    Path("ml/dataset.yaml").write_text(yaml)
    print(f"{n} images -> train {len(cut['train'])} / val {len(cut['val'])} / test {len(cut['test'])}; classes: {names}")


if __name__ == "__main__":
    main()
