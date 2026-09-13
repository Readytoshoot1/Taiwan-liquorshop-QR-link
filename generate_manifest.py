"""
images/ 폴더의 '지역_가게이름.jpg' 파일들을 스캔해서 manifest.json을 생성합니다.
새 QR코드 이미지를 추가한 뒤에는 항상 이 스크립트를 다시 실행하고
git add / commit / push 해주세요.
"""
import json
from pathlib import Path

IMAGES_DIR = Path(__file__).parent / "images"
OUTPUT = Path(__file__).parent / "manifest.json"


def build_manifest():
    items = []
    for path in sorted(IMAGES_DIR.iterdir()):
        if path.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        stem = path.stem
        if "_" not in stem:
            print(f"건너뜀 (형식 아님, '지역_가게이름' 필요): {path.name}")
            continue
        region, name = stem.split("_", 1)
        items.append({
            "region": region,
            "name": name,
            "file": f"images/{path.name}",
        })

    OUTPUT.write_text(
        json.dumps(items, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"{len(items)}개 항목을 manifest.json에 저장했습니다.")


if __name__ == "__main__":
    build_manifest()
