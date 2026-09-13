# liquorshop_link

주류상점 QR코드를 지역별로 모아 보는 웹페이지. GitHub Pages로 배포.

## 사이트 구조

- `index.html`, `style.css`, `script.js` — 페이지 본체
- `images/` — QR코드 이미지 (`지역_가게이름.jpg` 형식)
- `manifest.json` — `images/`를 스캔해서 자동 생성되는 목록 파일 (직접 수정하지 말 것)
- `generate_manifest.py` — `manifest.json`을 다시 만들어주는 스크립트

## 새 QR코드 이미지 추가하는 법

1. `images/` 폴더에 `지역_가게이름.jpg` 형식으로 이미지 파일을 넣는다.
   - 지역이 불명확하면 `불명_가게이름.jpg` 로 저장.
2. 아래 명령으로 목록을 다시 생성한다.

   ```
   python generate_manifest.py
   ```

3. 변경사항을 GitHub에 반영한다.

   ```
   git add .
   git commit -m "이미지 추가"
   git push
   ```

4. 몇십 초 후 GitHub Pages 주소에서 반영된 것을 확인.

## 지역명 바꾸는 법

`images/` 안의 파일명 앞부분(지역명)을 바꾸고 `generate_manifest.py`를 다시 실행하면 된다.
