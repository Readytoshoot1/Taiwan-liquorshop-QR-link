"""
Shop_photos/ 의 매장 사진(zip 또는 폴더)을 웹용으로 변환하고 photos.json을 만듭니다.

- 입력: Shop_photos/<가게이름>.zip 또는 Shop_photos/<가게이름>/
- 출력: photos/<가게이름>/<YYMM>/<원본이름>.jpg (+ thumb/), photos.json
- 촬영월(YYMM)은 사진의 EXIF 촬영일 기준. GPS 등 EXIF 정보는 모두 제거.
- 제외할 사진은 photo_exclude.json에 {"가게이름": ["IMG_0001.JPG"]} 형식으로 적습니다.

필요 패키지: pip install pillow
"""
import hashlib
import io
import json
import shutil
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).parent
SOURCE = ROOT / "Shop_photos"
PHOTOS = ROOT / "photos"
INDEX = ROOT / "photos.json"
EXCLUDE = ROOT / "photo_exclude.json"

FULL_EDGE, FULL_QUALITY = 2200, 74
THUMB_EDGE, THUMB_QUALITY = 400, 70
EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")


def read_sources(source: Path):
    """(파일이름, 바이트) 목록. 압축은 디스크에 풀지 않고 메모리에서 읽는다."""
    if source.is_dir():
        for path in sorted(source.rglob("*")):
            if path.suffix.lower() in EXTENSIONS:
                yield path.name, path.read_bytes()
        return
    with zipfile.ZipFile(source) as archive:
        for info in sorted(archive.infolist(), key=lambda i: Path(i.filename).name):
            name = Path(info.filename).name
            if not info.is_dir() and Path(name).suffix.lower() in EXTENSIONS:
                yield name, archive.read(info)


def save_resized(image, path: Path, edge: int, quality: int):
    copy = image.copy()
    copy.thumbnail((edge, edge), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    copy.save(path, "JPEG", quality=quality, optimize=True, progressive=True)


def convert_shop(source: Path, excluded: set):
    shop = source.stem if source.is_file() else source.name
    seen, cleared, count = set(), set(), 0
    for name, data in read_sources(source):
        digest = hashlib.sha1(data).hexdigest()
        if name in excluded:
            print(f"  제외: {shop}/{name}")
            continue
        if digest in seen:
            print(f"  중복 건너뜀: {shop}/{name}")
            continue
        seen.add(digest)
        try:
            with Image.open(io.BytesIO(data)) as original:
                exif = original.getexif()
                taken = exif.get_ifd(0x8769).get(0x9003) or exif.get(0x0132)
                image = ImageOps.exif_transpose(original).convert("RGB")
        except OSError as error:
            print(f"  깨진 파일 건너뜀: {shop}/{name} ({error})")
            continue
        if not taken:
            print(f"  촬영일 없음, 건너뜀: {shop}/{name}")
            continue
        month = taken[2:4] + taken[5:7]
        folder = PHOTOS / shop / month
        if month not in cleared:
            # 같은 매장·같은 달을 다시 변환하면 통째로 교체한다
            shutil.rmtree(folder, ignore_errors=True)
            cleared.add(month)
        filename = Path(name).stem + ".jpg"
        save_resized(image, folder / filename, FULL_EDGE, FULL_QUALITY)
        save_resized(image, folder / "thumb" / filename, THUMB_EDGE, THUMB_QUALITY)
        count += 1
    print(f"{shop}: {count}장 변환 ({', '.join(sorted(cleared))})")


def write_index():
    index = {}
    for shop in sorted(p for p in PHOTOS.iterdir() if p.is_dir()):
        months = {}
        for month in sorted((p for p in shop.iterdir() if p.is_dir()), reverse=True):
            files = sorted(f.name for f in month.glob("*.jpg"))
            if files:
                months[month.name] = files
        if months:
            index[shop.name] = months
    INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(f.stat().st_size for f in PHOTOS.rglob("*.jpg"))
    print(f"photos.json 갱신: 매장 {len(index)}곳, photos/ 전체 {total / 1024 / 1024:.0f}MB")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    excluded = json.loads(EXCLUDE.read_text(encoding="utf-8")) if EXCLUDE.exists() else {}
    if SOURCE.exists():
        for source in sorted(SOURCE.iterdir()):
            if source.is_dir() or source.suffix.lower() == ".zip":
                shop = source.stem if source.is_file() else source.name
                convert_shop(source, set(excluded.get(shop, [])))
    PHOTOS.mkdir(exist_ok=True)
    write_index()


if __name__ == "__main__":
    main()
