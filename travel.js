const categoryBtns = document.querySelectorAll("#travelCategoryTabs .tab-btn");
const travelSearch = document.getElementById("travelSearch");
const travelSort = document.getElementById("travelSort");
const travelReviewOnly = document.getElementById("travelReviewOnly");
const travelList = document.getElementById("travelList");
const travelCount = document.getElementById("travelCount");
const travelEmpty = document.getElementById("travelEmpty");

let places = [];
const state = {
  category: "전체",
  query: "",
  sort: "recent",
  reviewOnly: false,
};

function flatten(data) {
  const out = [];
  for (const [category, arr] of Object.entries(data["해외"] || {})) {
    for (const item of arr) {
      out.push({ ...item, category: item.category || category });
    }
  }
  for (const item of data["확인되지_않은_링크"] || []) {
    out.push({
      category: "미확인",
      name: "",
      subcategory: "",
      map_url: item.link,
      chat_date: item.chat_date,
      shared_by: item.shared_by,
      needs_review: true,
      note: item.note || "",
      reason: item.reason || "",
    });
  }
  return out;
}

function parseDate(str) {
  if (!str) return 0;
  const [y, m, d] = str.split(".").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

function matchesQuery(item, query) {
  const haystack = [
    item.name,
    item.subcategory,
    item.category,
    item.note,
    item.shared_by,
    item.reason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function applyFilters() {
  const query = state.query.trim().toLowerCase();
  const filtered = places.filter((item) => {
    if (state.category !== "전체" && item.category !== state.category) return false;
    if (state.reviewOnly && !item.needs_review) return false;
    if (query && !matchesQuery(item, query)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (state.sort === "name") {
      return (a.name || a.map_url).localeCompare(b.name || b.map_url, "ko");
    }
    const diff = parseDate(a.chat_date) - parseDate(b.chat_date);
    return state.sort === "oldest" ? diff : -diff;
  });

  return filtered;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function renderList() {
  const filtered = applyFilters();
  travelList.innerHTML = "";
  travelEmpty.hidden = filtered.length > 0;
  travelCount.textContent = `총 ${filtered.length}곳`;

  for (const item of filtered) {
    const li = el("li", "travel-item");

    const top = el("div", "ti-top");
    top.appendChild(el("span", "ti-badge", item.category));
    if (item.subcategory) top.appendChild(el("span", "ti-sub", item.subcategory));
    if (item.needs_review) top.appendChild(el("span", "ti-review", "검토 필요"));
    li.appendChild(top);

    const name = el("a", "ti-name", item.name || "장소명 미확인");
    name.href = item.map_url;
    name.target = "_blank";
    name.rel = "noopener noreferrer";
    li.appendChild(name);

    const metaParts = [item.shared_by, item.chat_date].filter(Boolean);
    if (metaParts.length) li.appendChild(el("div", "ti-meta", metaParts.join(" · ")));

    if (item.note) li.appendChild(el("div", "ti-note", item.note));

    travelList.appendChild(li);
  }
}

categoryBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.category = btn.dataset.category;
    categoryBtns.forEach((b) => b.classList.toggle("active", b === btn));
    renderList();
  });
});

travelSearch.addEventListener("input", (e) => {
  state.query = e.target.value;
  renderList();
});

travelSort.addEventListener("change", (e) => {
  state.sort = e.target.value;
  renderList();
});

travelReviewOnly.addEventListener("change", (e) => {
  state.reviewOnly = e.target.checked;
  renderList();
});

async function initTravel() {
  const res = await fetch("travel_places.json");
  places = flatten(await res.json());
  renderList();
}

initTravel();
