// 매장 사진 갤러리 (목록 → 한 장 크게 보기 → 원본 확대)
const gallery = document.getElementById("gallery");
const galleryTitle = document.getElementById("galleryTitle");
const galleryGrid = document.getElementById("galleryGrid");
const viewer = document.getElementById("viewer");
const viewerStage = document.getElementById("viewerStage");
const viewerImg = document.getElementById("viewerImg");
const viewerCount = document.getElementById("viewerCount");
const viewerOpen = document.getElementById("viewerOpen");

let galleryShop = "";
let galleryMonth = "";
let galleryFiles = [];
let viewerIndex = 0;

function photoUrl(file, thumb) {
  const parts = ["photos", galleryShop, galleryMonth];
  if (thumb) parts.push("thumb");
  parts.push(file);
  return parts.map(encodeURIComponent).join("/");
}

function openGallery(shop, month, files, title) {
  galleryShop = shop;
  galleryMonth = month;
  galleryFiles = files;
  galleryTitle.textContent = `${title} · 매장사진(${month}) ${files.length}장`;
  galleryGrid.innerHTML = "";
  files.forEach((file, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-thumb";
    const img = document.createElement("img");
    img.src = photoUrl(file, true);
    img.alt = `${title} 매장사진 ${index + 1}`;
    img.loading = "lazy";
    button.appendChild(img);
    button.addEventListener("click", () => openViewer(index));
    galleryGrid.appendChild(button);
  });
  gallery.hidden = false;
  gallery.scrollTop = 0;
  document.body.classList.add("no-scroll");
}

function closeGallery() {
  closeViewer();
  gallery.hidden = true;
  galleryGrid.innerHTML = "";
  document.body.classList.remove("no-scroll");
}

function openViewer(index) {
  viewerIndex = (index + galleryFiles.length) % galleryFiles.length;
  const url = photoUrl(galleryFiles[viewerIndex], false);
  viewerStage.classList.remove("zoomed");
  viewerImg.src = url;
  viewerOpen.href = url;
  viewerCount.textContent = `${viewerIndex + 1} / ${galleryFiles.length}`;
  viewer.hidden = false;
}

function closeViewer() {
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
  if (gallery.hidden) return;
  if (!viewer.hidden) {
    if (e.key === "Escape") closeViewer();
    if (e.key === "ArrowLeft") openViewer(viewerIndex - 1);
    if (e.key === "ArrowRight") openViewer(viewerIndex + 1);
  } else if (e.key === "Escape") {
    closeGallery();
  }
});
