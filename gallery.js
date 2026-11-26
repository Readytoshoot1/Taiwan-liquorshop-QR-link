// 암호로 잠긴 매장 사진 갤러리 (암호 입력 → 목록 → 한 장 크게 보기 → 확대)
const gallery = document.getElementById("gallery");
const galleryTitle = document.getElementById("galleryTitle");
const galleryGrid = document.getElementById("galleryGrid");
const viewer = document.getElementById("viewer");
const viewerStage = document.getElementById("viewerStage");
const viewerImg = document.getElementById("viewerImg");
const viewerCount = document.getElementById("viewerCount");
const viewerOpen = document.getElementById("viewerOpen");
const lockDialog = document.getElementById("lockDialog");
const lockForm = document.getElementById("lockForm");
const lockInput = document.getElementById("lockInput");
const lockError = document.getElementById("lockError");

const PASSWORD_KEY = "shopPhotoPassword";

let photoKeys = null; // 암호를 푼 뒤의 { "가게/월": 열쇠 }
let galleryShop = "";
let galleryMonth = "";
let galleryFiles = [];
let galleryKey = null;
let viewerIndex = 0;
let viewerRequest = 0;
let session = 0; // 갤러리를 닫은 뒤 늦게 도착한 사진은 버린다
let thumbObserver = null;
const blobUrls = new Map();

const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function decryptBytes(key, bytes) {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
}

const importAesKey = (raw) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);

// 암호가 맞으면 true. 암호가 바뀌었을 수 있으므로 photos.json은 매번 새로 확인한다.
async function tryPassword(password) {
  const index = await (await fetch("photos.json", { cache: "no-cache" })).json();
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(index.salt), iterations: index.iterations },
    material,
    256
  );
  try {
    const plain = await decryptBytes(await importAesKey(bits), fromBase64(index.lock));
    photoKeys = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return false;
  }
  sessionStorage.setItem(PASSWORD_KEY, password);
  return true;
}

let lockResolve = null;

function askPassword() {
  lockError.textContent = "";
  lockInput.value = "";
  lockDialog.hidden = false;
  lockInput.focus();
  return new Promise((resolve) => (lockResolve = resolve));
}

function finishLock(ok) {
  lockDialog.hidden = true;
  if (lockResolve) lockResolve(ok);
  lockResolve = null;
}

async function ensureUnlocked() {
  const saved = sessionStorage.getItem(PASSWORD_KEY);
  if (saved && (await tryPassword(saved))) return true;
  sessionStorage.removeItem(PASSWORD_KEY);
  return askPassword();
}

lockForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  lockError.textContent = "확인 중...";
  try {
    if (await tryPassword(lockInput.value.trim())) return finishLock(true);
    lockError.textContent = "암호가 맞지 않습니다.";
    lockInput.select();
  } catch {
    lockError.textContent = "사진 정보를 불러오지 못했습니다.";
  }
});
document.getElementById("lockCancel").addEventListener("click", () => finishLock(false));

// 암호화된 파일을 받아 풀고, 화면에 넣을 수 있는 주소로 바꾼다
function photoUrl(file, thumb) {
  const parts = ["photos", galleryShop, galleryMonth];
  if (thumb) parts.push("thumb");
  parts.push(`${file}.enc`);
  const path = parts.map(encodeURIComponent).join("/");
  if (!blobUrls.has(path)) {
    const key = galleryKey;
    const current = session;
    const promise = fetch(path)
      .then((res) => {
        if (!res.ok) throw new Error(res.status);
        return res.arrayBuffer();
      })
      .then((buffer) => decryptBytes(key, new Uint8Array(buffer)))
      .then((plain) => {
        if (current !== session) throw new Error("closed");
        return URL.createObjectURL(new Blob([plain], { type: "image/jpeg" }));
      });
    promise.catch(() => blobUrls.delete(path));
    blobUrls.set(path, promise);
  }
  return blobUrls.get(path);
}

async function openGallery(shop, month, title) {
  if (!(await ensureUnlocked())) return;
  const index = await (await fetch("photos.json", { cache: "no-cache" })).json();
  galleryShop = shop;
  galleryMonth = month;
  galleryFiles = index.shops[shop][month];
  galleryKey = await importAesKey(fromBase64(photoKeys[`${shop}/${month}`]));
  galleryTitle.textContent = `${title} · 매장사진(${month}) ${galleryFiles.length}장`;
  galleryGrid.innerHTML = "";
  gallery.hidden = false;
  gallery.scrollTop = 0;
  document.body.classList.add("no-scroll");

  thumbObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        thumbObserver.unobserve(entry.target);
        const img = entry.target.firstChild;
        photoUrl(galleryFiles[entry.target.dataset.index], true)
          .then((url) => (img.src = url))
          .catch(() => (img.alt = "불러오기 실패"));
      }
    },
    { root: gallery, rootMargin: "300px" }
  );
  galleryFiles.forEach((file, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-thumb";
    button.dataset.index = i;
    const img = document.createElement("img");
    img.alt = `${title} 매장사진 ${i + 1}`;
    button.appendChild(img);
    button.addEventListener("click", () => openViewer(i));
    galleryGrid.appendChild(button);
    thumbObserver.observe(button);
  });
}

function closeGallery() {
  closeViewer();
  gallery.hidden = true;
  galleryGrid.innerHTML = "";
  document.body.classList.remove("no-scroll");
  if (thumbObserver) thumbObserver.disconnect();
  session += 1;
  for (const promise of blobUrls.values()) promise.then(URL.revokeObjectURL, () => {});
  blobUrls.clear();
}

async function openViewer(index) {
  viewerIndex = (index + galleryFiles.length) % galleryFiles.length;
  const request = ++viewerRequest;
  viewerStage.classList.remove("zoomed");
  viewerImg.removeAttribute("src");
  viewerOpen.removeAttribute("href");
  viewerCount.textContent = `${viewerIndex + 1} / ${galleryFiles.length}`;
  viewer.hidden = false;
  try {
    const url = await photoUrl(galleryFiles[viewerIndex], false);
    if (request !== viewerRequest) return;
    viewerImg.src = url;
    viewerOpen.href = url;
  } catch {
    if (request === viewerRequest) viewerCount.textContent = "불러오기 실패";
  }
}

function closeViewer() {
  viewerRequest += 1;
  viewer.hidden = true;
  viewerImg.removeAttribute("src");
}

// 누른 지점을 중심으로 원본 크기 확대/축소
viewerImg.addEventListener("click", (e) => {
  const rect = viewerImg.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  if (!viewerStage.classList.toggle("zoomed")) return;
  viewerStage.scrollLeft = x * viewerImg.offsetWidth - viewerStage.clientWidth / 2;
  viewerStage.scrollTop = y * viewerImg.offsetHeight - viewerStage.clientHeight / 2;
});

let touchStart = null;
viewerStage.addEventListener("touchstart", (e) => {
  touchStart = e.touches.length === 1 ? e.touches[0] : null;
}, { passive: true });
viewerStage.addEventListener("touchend", (e) => {
  if (!touchStart || viewerStage.classList.contains("zoomed")) return;
  const dx = e.changedTouches[0].clientX - touchStart.clientX;
  const dy = e.changedTouches[0].clientY - touchStart.clientY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) openViewer(viewerIndex + (dx < 0 ? 1 : -1));
  touchStart = null;
}, { passive: true });

document.getElementById("galleryClose").addEventListener("click", closeGallery);
document.getElementById("viewerClose").addEventListener("click", closeViewer);
document.getElementById("viewerPrev").addEventListener("click", () => openViewer(viewerIndex - 1));
document.getElementById("viewerNext").addEventListener("click", () => openViewer(viewerIndex + 1));
document.addEventListener("keydown", (e) => {
  if (!lockDialog.hidden) {
    if (e.key === "Escape") finishLock(false);
    return;
  }
  if (gallery.hidden) return;
  if (!viewer.hidden) {
    if (e.key === "Escape") closeViewer();
    if (e.key === "ArrowLeft") openViewer(viewerIndex - 1);
    if (e.key === "ArrowRight") openViewer(viewerIndex + 1);
  } else if (e.key === "Escape") {
    closeGallery();
  }
});
