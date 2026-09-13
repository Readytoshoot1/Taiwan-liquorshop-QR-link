"""
images/ 폴더의 '지역_가게이름.jpg' 파일들을 스캔해서 manifest.json을 생성합니다.
각 이미지 안의 QR코드를 디코딩해서 실제 링크(link)도 함께 저장합니다.

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


def decode_qr(path: Path) -> str | None:
    # opencv를 먼저 시도한다: pyzbar(zbar 네이티브 라이브러리)는 특정 이미지에서
    # 예외 없이 프로세스를 통째로 죽이는 크래시를 일으키는 경우가 있어,
    # 가능한 한 pyzbar 호출 자체를 줄이는 순서로 둔다.
    buf = np.frombuffer(path.read_bytes(), dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    for scale in (1, 1.5, 2, 0.5):
        resized = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        data, _, _ = detector.detectAndDecode(resized)
        if data:
            return data

    pil_img = Image.open(path)
    results = zbar_decode(pil_img)
    if results:
        return results[0].data.decode("utf-8", "replace")

    return None


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
        link = decode_qr(path)
        if link is None:
            failed.append(path.name)
        items.append({
            "region": region,
            "name": name,
            "file": f"images/{path.name}",
            "link": link,
        })

    OUTPUT.write_text(
        json.dumps(items, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"{len(items)}개 항목을 manifest.json에 저장했습니다.")
    if failed:
        print("QR코드 디코딩 실패 (수동으로 manifest.json의 link 값을 채워주세요):")
        for name in failed:
            print(f"  - {name}")


if __name__ == "__main__":
    build_manifest()
