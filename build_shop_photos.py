"""
Shop_photos/ 의 매장 사진(zip 또는 폴더)을 웹용으로 변환·암호화하고 photos.json을 만듭니다.

- 암호: photo_password.txt 한 줄 (git에 올리지 않음)
- 입력: Shop_photos/<가게이름>.zip 또는 Shop_photos/<가게이름>/
- 출력: photos/<가게이름>/<YYMM>/<원본이름>.enc (+ thumb/), photos.json
- 촬영월(YYMM)은 EXIF 촬영일 기준. GPS 등 EXIF 정보는 모두 제거.
- 제외할 사진은 photo_exclude.json에 {"가게이름": ["IMG_0001.JPG"]} 형식으로 적습니다.

사용법:
  python build_shop_photos.py           새 사진 변환 + 암호 변경 반영
  python build_shop_photos.py --rekey   기존 사진까지 새 열쇠로 다시 암호화

암호화 구조: 사진은 (매장, 월)마다 만든 임의의 열쇠로 AES-GCM 암호화하고,
그 열쇠 목록을 암호에서 유도한 열쇠로 잠가 photos.json에 넣습니다.

필요 패키지: pip install pillow cryptography
"""
import base64
import hashlib
import io
import json
import os
import shutil
import sys
import zipfile
from pathlib import Path

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from PIL import Image, ImageOps

ROOT = Path(__file__).parent
SOURCE = ROOT / "Shop_photos"
PHOTOS = ROOT / "photos"
INDEX = ROOT / "photos.json"
EXCLUDE = ROOT / "photo_exclude.json"
PASSWORD = ROOT / "photo_password.txt"  # git 제외
STATE = ROOT / "photo_keys.json"  # git 제외

FULL_EDGE, FULL_QUALITY = 2200, 74
THUMB_EDGE, THUMB_QUALITY = 400, 70
EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
ITERATIONS = 600_000


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def encrypt(key: bytes, data: bytes) -> bytes:
    iv = os.urandom(12)
    return iv + AESGCM(key).encrypt(iv, data, None)


def decrypt(key: bytes, data: bytes) -> bytes:
    return AESGCM(key).decrypt(data[:12], data[12:], None)


def password_key(password: str, salt: bytes, iterations: int) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations, 32)


def unlock(index: dict, password: str):
    """photos.json의 열쇠 목록을 연다. 암호가 다르면 None."""
    try:
        key = password_key(password, base64.b64decode(index["salt"]), index["iterations"])
        return json.loads(decrypt(key, base64.b64decode(index["lock"])))
    except (KeyError, InvalidTag):
        return None


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


def source_digest(source: Path, excluded: set) -> str:
    digest = hashlib.sha1(json.dumps(sorted(excluded)).encode())
    files = sorted(source.rglob("*")) if source.is_dir() else [source]
    for path in files:
        if path.is_file():
            with path.open("rb") as handle:
                digest.update(hashlib.file_digest(handle, "sha1").digest())
    return digest.hexdigest()


def resized(image, edge: int, quality: int) -> bytes:
    copy = image.copy()
    copy.thumbnail((edge, edge), Image.LANCZOS)
    buffer = io.BytesIO()
    copy.save(buffer, "JPEG", quality=quality, optimize=True, progressive=True)
    return buffer.getvalue()


def convert_shop(source: Path, shop: str, excluded: set, keys: dict):
    seen, month_keys, count = set(), {}, 0
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
        if month not in month_keys:
            # 같은 매장·같은 달을 다시 변환하면 통째로 교체한다
            shutil.rmtree(folder, ignore_errors=True)
            (folder / "thumb").mkdir(parents=True)
            month_keys[month] = keys[f"{shop}/{month}"] = b64(AESGCM.generate_key(256))
        key = base64.b64decode(month_keys[month])
        filename = Path(name).stem + ".enc"
        (folder / filename).write_bytes(encrypt(key, resized(image, FULL_EDGE, FULL_QUALITY)))
        (folder / "thumb" / filename).write_bytes(encrypt(key, resized(image, THUMB_EDGE, THUMB_QUALITY)))
        count += 1
    print(f"{shop}: {count}장 변환 ({', '.join(sorted(month_keys))})")


def rekey(keys: dict):
    for name, old in list(keys.items()):
        new = AESGCM.generate_key(256)
        for path in (PHOTOS / name).rglob("*.enc"):
            path.write_bytes(encrypt(new, decrypt(base64.b64decode(old), path.read_bytes())))
        keys[name] = b64(new)
        print(f"새 열쇠로 다시 암호화: {name}")


def write_index(keys: dict, password: str, old_index: dict):
    shops = {}
    for shop in sorted(p for p in PHOTOS.iterdir() if p.is_dir()):
        months = {}
        for month in sorted((p for p in shop.iterdir() if p.is_dir()), reverse=True):
            files = sorted(f.stem for f in month.glob("*.enc"))
            if files:
                months[month.name] = files
        if months:
            shops[shop.name] = months
    used = {f"{shop}/{month}": keys[f"{shop}/{month}"] for shop, months in shops.items() for month in months}

    if unlock(old_index, password) == used:
        lock = {k: old_index[k] for k in ("iterations", "salt", "lock")}
    else:
        salt = os.urandom(16)
        key = password_key(password, salt, ITERATIONS)
        lock = {"iterations": ITERATIONS, "salt": b64(salt), "lock": b64(encrypt(key, json.dumps(used).encode()))}
        print("암호 잠금 갱신")
    INDEX.write_text(json.dumps({**lock, "shops": shops}, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(f.stat().st_size for f in PHOTOS.rglob("*.enc"))
    print(f"photos.json 갱신: 매장 {len(shops)}곳, photos/ 전체 {total / 1024 / 1024:.0f}MB")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    password = PASSWORD.read_text(encoding="utf-8-sig").strip() if PASSWORD.exists() else ""
    if not password:
        sys.exit("photo_password.txt 에 암호를 한 줄 적어 주세요.")
    excluded = load_json(EXCLUDE)
    index = load_json(INDEX)
    state = load_json(STATE) or {"keys": {}, "sources": {}}
    keys, sources = state["keys"], state["sources"]
    PHOTOS.mkdir(exist_ok=True)

    # photo_keys.json이 없는 PC에서는 현재 암호로 열쇠를 되찾는다
    if not keys and any(PHOTOS.rglob("*.enc")):
        keys.update(unlock(index, password) or {})
        if not keys:
            sys.exit("photo_keys.json이 없고 암호도 기존과 달라 중단합니다. 이전 암호를 넣고 먼저 실행하세요.")

    if "--rekey" in sys.argv:
        rekey(keys)
    if SOURCE.exists():
        for source in sorted(SOURCE.iterdir()):
            if not (source.is_dir() or source.suffix.lower() == ".zip"):
                continue
            shop = source.stem if source.is_file() else source.name
            skip = set(excluded.get(shop, []))
            digest = source_digest(source, skip)
            if sources.get(shop) == digest:
                print(f"{shop}: 변경 없음")
                continue
            convert_shop(source, shop, skip, keys)
            sources[shop] = digest
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
    write_index(keys, password, index)


if __name__ == "__main__":
    main()
