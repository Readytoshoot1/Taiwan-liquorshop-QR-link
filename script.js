const tabsEl = document.getElementById("tabs");
const gridEl = document.getElementById("grid");
const emptyEl = document.getElementById("empty");
const modalEl = document.getElementById("modal");
const modalImg = document.getElementById("modalImg");
const modalCaption = document.getElementById("modalCaption");
const modalClose = document.getElementById("modalClose");

let items = [];
let activeRegion = "전체";

async function init() {
  const res = await fetch("manifest.json");
  items = await res.json();
  renderTabs();
  renderGrid();
}

function renderTabs() {
  const regions = ["전체", ...new Set(items.map((i) => i.region))];
  tabsEl.innerHTML = "";
  for (const region of regions) {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (region === activeRegion ? " active" : "");
    btn.textContent = region;
    btn.addEventListener("click", () => {
      activeRegion = region;
      renderTabs();
      renderGrid();
    });
    tabsEl.appendChild(btn);
  }
}

function renderGrid() {
  const filtered =
    activeRegion === "전체"
      ? items
      : items.filter((i) => i.region === activeRegion);

  gridEl.innerHTML = "";
  emptyEl.hidden = filtered.length > 0;

  for (const item of filtered) {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.src = item.file;
    img.alt = `${item.region} ${item.name} QR코드`;
    img.loading = "lazy";

    const info = document.createElement("div");
    info.className = "card-info";
    info.innerHTML = `
      <div class="card-name">${item.name}</div>
      <div class="card-region">${item.region}</div>
    `;

    card.appendChild(img);
    card.appendChild(info);
    card.addEventListener("click", () => openModal(item));
    gridEl.appendChild(card);
  }
}

function openModal(item) {
  modalImg.src = item.file;
  modalImg.alt = `${item.region} ${item.name} QR코드`;
  modalCaption.textContent = `${item.region} · ${item.name}`;
  modalEl.hidden = false;
}

function closeModal() {
  modalEl.hidden = true;
  modalImg.src = "";
}

modalClose.addEventListener("click", closeModal);
modalEl.addEventListener("click", (e) => {
  if (e.target === modalEl) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

init();
