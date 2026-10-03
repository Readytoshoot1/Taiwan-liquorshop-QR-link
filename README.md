# 위스키 정보 모음 (liquorshop_link)

위스키 관련 정보를 탭으로 나눠 보는 정적 웹페이지. GitHub Pages로 배포하며 휴대폰/PC 모두에서 볼 수 있다.

- 배포 주소: https://readytoshoot1.github.io/Taiwan-liquorshop-QR-link/
- 저장소: https://github.com/Readytoshoot1/Taiwan-liquorshop-QR-link

## 페이지 구성

상단 탭 3개로 나뉘어 있다.

1. **주류상점 QR** — 대만 주류상점의 QR코드 이미지를 지역별로 모아 보여준다. 카드를 누르면 확대되고, QR 안의 링크(LINE, Instagram 등)를 바로 열 수 있다. 가게 이름/지역 검색과 지역 탭 필터를 지원한다.
2. **여행 정보** — `travel_places.json`의 장소를 국내/해외로 나눠 보여준다. 호텔·음식점·관광지 분류, 검색, 최신순/오래된순/이름순 정렬, "검토 필요만" 필터를 지원한다.
3. **유니온페이 할인** — 유니온페이 할인 정보 페이지를 탭 안에 불러온다. 페이지가 안 보이면 "새 창에서 열기" 버튼을 사용한다.

## 파일 구조

| 파일 | 설명 |
| --- | --- |
| `index.html` | 페이지 뼈대 (상단 탭, 각 탭 영역, 확대 모달) |
| `style.css` | 전체 스타일 (밝은/어두운 테마 자동 전환) |
| `script.js` | 상단 탭 전환, QR 카드/검색/지역 필터, 확대 모달 |
| `travel.js` | 여행 정보 탭 (국내/해외, 분류, 검색, 정렬, 필터) |
| `images/` | QR코드 이미지 (`지역_가게이름.jpg` 형식) |
| `manifest.json` | QR 목록 (자동 생성, 직접 수정하지 말 것) |
| `link_overrides.json` | QR 링크를 수동으로 지정할 때 쓰는 파일 |
| `generate_manifest.py` | `images/`를 읽어 QR 링크를 디코딩하고 `manifest.json`을 만드는 스크립트 |
| `travel_places.json` | 여행 장소 데이터 (여행 정보 탭의 원본) |

## 주류상점 QR: 이미지 추가하는 법

1. `images/` 폴더에 `지역_가게이름.jpg` 형식으로 이미지를 넣는다.
   - 지역이 불명확하면 `불명_가게이름.jpg` 로 저장하고, 나중에 지역명만 바꿔도 된다.
2. (최초 1회) 필요 패키지를 설치한다.

   ```
   pip install opencv-python-headless pyzbar pillow numpy
   ```

3. 목록을 다시 생성한다. QR 안의 링크를 자동으로 읽어 `manifest.json`에 저장한다.

   ```
   python generate_manifest.py
   ```

   콘솔에 "디코딩 실패"가 나온 파일이 있으면 `link_overrides.json`에 직접 적는다.

   ```json
   {
     "images/지역_가게이름.jpg": [
       {"label": "LINE", "url": "https://..."}
     ]
   }
   ```

   - 여기 적은 값이 자동 디코딩보다 우선 적용된다.
   - 한 이미지에 QR이 여러 개인데 일부만 쓰고 싶으면(예: 송금용 QR 제외) 필요한 것만 적으면 된다.
   - 같은 QR 링크가 파일명만 다르게 두 번 올라온 경우에는 기존 파일을 남기고 새 파일을 지운다.

4. GitHub에 반영한다.

   ```
   git add .
   git commit -m "이미지 추가"
   git push
   ```

5. 몇십 초 후 배포 주소에서 반영을 확인한다.

### 지역명 바꾸는 법

`images/` 안 파일명의 앞부분(지역명)을 바꾸고 `python generate_manifest.py`를 다시 실행한다.

## 여행 정보: travel_places.json 편집하는 법

- 최상위 구조: `국내`, `해외` 아래에 `호텔`, `음식점`, `관광지` 목록이 있고, `확인되지_않은_링크` 목록이 따로 있다.
- 항목 주요 필드
  - `name`: 장소 이름 (없으면 화면에 "장소명 미확인"으로 표시)
  - `subcategory`: 세부 분류 (예: 바, 파티룸)
  - `map_url`: 지도 링크 (해외는 Google Maps, 국내는 Naver Map)
  - `chat_date`: 카카오톡 대화에서 공유된 날짜 (예: `2026.1.24`)
  - `shared_by`: 공유한 사람
  - `needs_review`: `true`면 "검토 필요" 표시가 붙고 "검토 필요만" 필터에 걸린다
  - `note`: **비고 칸.** 필요한 정보를 자유롭게 적으면 카드에 표시된다.
- 확인되지_않은_링크: 장소명을 찾지 못한 링크다. 화면에서는 "장소명 미확인"으로 보이며 항상 검토 필요로 취급한다. 장소를 알아내면 `name`을 채우고 해당 항목을 `국내`/`해외`로 옮기면 된다.
- 편집 후에는 JSON 형식이 깨지지 않게 주의하고, 이후 `git add`, `git commit`, `git push`로 반영한다.

## 유니온페이 할인 정보

- 탭 안에 유니온페이 페이지를 iframe으로 표시한다.
- 해당 사이트가 외부 표시를 막는 경우 빈 화면이 보일 수 있다. 이때는 "새 창에서 열기" 버튼을 쓴다.
- 링크 주소는 `index.html`의 `#unionpay` 영역에 있다.

## 알아두면 좋은 점

- `manifest.json`은 `generate_manifest.py`가 덮어쓰므로 직접 고치지 않는다. 수동 링크는 `link_overrides.json`에 적는다.
- pyzbar는 특정 이미지에서 프로세스를 통째로 죽이는 문제가 있어서, 스크립트는 opencv로 먼저 찾고 실패한 경우에만 pyzbar를 쓴다.
- 흐릿한 QR은 대비 향상(CLAHE)과 단일/다중 디코더를 함께 써서 인식률을 높였다.
- 여행 정보와 유니온페이 탭의 실제 표시는 배포 후 휴대폰과 PC에서 한 번 확인하는 것이 좋다.
