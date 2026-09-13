"""
images/ 폴더의 '지역_가게이름.jpg' 파일들을 스캔해서 manifest.json을 생성합니다.
한 이미지 안에 QR코드가 여러 개(LINE, Instagram 등) 있어도 전부 찾아서
links 목록에 저장합니다.

새 QR코드 이미지를 추가한 뒤에는 항상 이 스크립트를 다시 실행하고
git add / commit / push 해주세요.

필요 패키지: pip install opencv-python-headless pyzbar pillow numpy
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from pyzbar.pyzbar import decode as zbar_decode

IMAGES_DIR = Path(__file__).parent / "images"
OUTPUT = Path(__file__).parent / "manifest.json"

detector = cv2.QRCodeDetector()

LABEL_RULES = [
    ("line.me", "LINE"),
    ("lin.ee", "LINE"),
    ("instagram.com", "Instagram"),
    ("facebook.com", "Facebook"),
    ("wa.me", "WhatsApp"),
]


def label_for(url: str) -> str:
    for keyword, label in LABEL_RULES:
        if keyword in url:
            return label
    return "링크"


def decode_qr_all(path: Path) -> list[str]:
    # opencv를 먼저 시도한다: pyzbar(zbar 네이티브 라이브러리)는 특정 이미지에서
    # 예외 없이 프로세스를 통째로 죽이는 크래시를 일으키는 경우가 있어,
    # opencv가 이미 뭔가 찾았으면 pyzbar는 아예 호출하지 않는다.
    buf = np.frombuffer(path.read_bytes(), dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        return []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    found = []
    for scale in (1, 1.5, 2, 0.5):
        resized = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        _, decoded_info, _, _ = detector.detectAndDecodeMulti(resized)
        for data in decoded_info:
            if data and data not in found:
                found.append(data)
    if found:
        return found

    results = zbar_decode(Image.open(path))
    for r in results:
        data = r.data.decode("utf-8", "replace")
        if data not in found:
            found.append(data)
    return found


def build_manifest():
    items = []
    failed = []
    for path in sorted(IMAGES_DIR.iterdir()):
        if path.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        stem = path.stem
        if "_" not in stem:
            print(f"건너뜀 (형식 아님, '지역_가게이름' 필요): {path.name}")
            continue
        region, name = stem.split("_", 1)
        urls = decode_qr_all(path)
        if not urls:
            failed.append(path.name)
        items.append({
            "region": region,
            "name": name,
            "file": f"images/{path.name}",
            "links": [{"label": label_for(u), "url": u} for u in urls],
        })

    OUTPUT.write_text(
        json.dumps(items, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"{len(items)}개 항목을 manifest.json에 저장했습니다.")
    if failed:
        print("QR코드 디코딩 실패 (수동으로 manifest.json의 links 값을 채워주세요):")
        for name in failed:
            print(f"  - {name}")


if __name__ == "__main__":
    build_manifest()
