const TC_FALLBACK_RATES = { USD: 1, GBP: 0.78, EUR: 0.92, TWD: 32, JPY: 150, KRW: 1380 };
const TC_STORAGE_KEY = "taxCalcState_v1";

const tcRateInfo = document.getElementById("tcRateInfo");
const tcCurrency = document.getElementById("tcCurrency");
const tcShipping = document.getElementById("tcShipping");
const tcRateGrid = document.getElementById("tcRateGrid");
const tcAddBottle = document.getElementById("tcAddBottle");
const tcBottleList = document.getElementById("tcBottleList");
const tcCartSummary = document.getElementById("tcCartSummary");
const tcResults = document.getElementById("tcResults");

let tcState = {
  rates: { ...TC_FALLBACK_RATES },
  rateDate: "",
  currency: "USD",
  shipping: 50,
  bottles: [
    { id: 1, label: "", price: 100, volume: 700, abv: 50, qty: 1 },
  ],
};
let tcNextId = 2;

function tcLoadState() {
  try {
    const raw = localStorage.getItem(TC_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.currency) tcState.currency = saved.currency;
    if (typeof saved.shipping === "number") tcState.shipping = saved.shipping;
    if (Array.isArray(saved.bottles) && saved.bottles.length) {
      tcState.bottles = saved.bottles;
      tcNextId = Math.max(...saved.bottles.map((b) => b.id)) + 1;
    }
    if (saved.rates) tcState.rates = { ...tcState.rates, ...saved.rates };
  } catch (e) {
    // 저장된 값이 깨졌으면 기본값 사용
  }
}

function tcSaveState() {
  try {
    localStorage.setItem(
      TC_STORAGE_KEY,
      JSON.stringify({
        currency: tcState.currency,
        shipping: tcState.shipping,
        bottles: tcState.bottles,
        rates: tcState.rates,
      })
    );
  } catch (e) {
    // localStorage 사용 불가 시 조용히 무시 (계산 자체는 계속 동작)
  }
}

function tcCrossRate(from, to) {
  return tcState.rates[to] / tcState.rates[from];
}

async function tcFetchRates() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    if (data.result !== "success" && !data.rates) throw new Error("bad response");
    const r = data.rates;
    tcState.rates = {
      USD: 1,
      GBP: r.GBP ?? TC_FALLBACK_RATES.GBP,
      EUR: r.EUR ?? TC_FALLBACK_RATES.EUR,
      TWD: r.TWD ?? TC_FALLBACK_RATES.TWD,
      JPY: r.JPY ?? TC_FALLBACK_RATES.JPY,
      KRW: r.KRW ?? TC_FALLBACK_RATES.KRW,
    };
    tcState.rateDate = data.time_last_update_utc || "";
    tcRateInfo.textContent = tcState.rateDate
      ? `실시간 환율 적용됨 (기준: ${tcState.rateDate})`
      : "실시간 환율 적용됨";
  } catch (e) {
    tcRateInfo.textContent = "환율 API 호출 실패 — 기본 환율을 사용합니다 (아래에서 직접 수정 가능)";
  }
  tcRenderRateGrid();
  tcCalcAll();
}

function tcFormat(n, decimals = 0) {
  if (!isFinite(n)) return "-";
  return n.toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const TC_CURRENCY_SYMBOL = { USD: "$", GBP: "£", EUR: "€", TWD: "NT$", JPY: "¥", KRW: "₩" };

function tcRenderRateGrid() {
  tcRateGrid.innerHTML = "";
  const labels = { GBP: "GBP → USD", EUR: "EUR → USD", TWD: "USD → TWD", JPY: "USD → JPY", KRW: "USD → KRW" };
  for (const key of ["GBP", "EUR", "TWD", "JPY", "KRW"]) {
    const wrap = document.createElement("label");
    wrap.className = "tc-rate-item";
    const span = document.createElement("span");
    span.textContent = labels[key];
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.0001";
    input.className = "select-input";
    input.value = tcState.rates[key];
    input.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v) && v > 0) {
        tcState.rates[key] = v;
        tcSaveState();
        tcCalcAll();
      }
    });
    wrap.appendChild(span);
    wrap.appendChild(input);
    tcRateGrid.appendChild(wrap);
  }
}

function tcRenderBottleList() {
  tcBottleList.innerHTML = "";
  for (const b of tcState.bottles) {
    const row = document.createElement("div");
    row.className = "tc-bottle-row";

    row.appendChild(tcField("보틀명(선택)", "text", b.label, (v) => (b.label = v), "tc-w-label"));
    row.appendChild(tcField(`병당 가격 (${tcState.currency})`, "number", b.price, (v) => (b.price = parseFloat(v) || 0)));
    row.appendChild(tcField("용량(ml)", "number", b.volume, (v) => (b.volume = parseFloat(v) || 0)));
    row.appendChild(tcField("도수(%)", "number", b.abv, (v) => (b.abv = parseFloat(v) || 0)));
    row.appendChild(tcField("수량", "number", b.qty, (v) => (b.qty = parseInt(v) || 0)));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "tc-del-btn";
    delBtn.textContent = "삭제";
    delBtn.addEventListener("click", () => {
      tcState.bottles = tcState.bottles.filter((x) => x.id !== b.id);
      tcSaveState();
      tcRenderBottleList();
      tcCalcAll();
    });
    row.appendChild(delBtn);

    tcBottleList.appendChild(row);
  }
}

function tcField(labelText, type, value, onChange, extraClass) {
  const wrap = document.createElement("label");
  wrap.className = "tc-field" + (extraClass ? " " + extraClass : "");
  const span = document.createElement("span");
  span.textContent = labelText;
  const input = document.createElement("input");
  input.type = type;
  input.className = "select-input";
  input.value = value;
  if (type === "number") {
    input.step = "0.01";
    input.min = "0";
  }
  input.addEventListener("input", (e) => {
    onChange(e.target.value);
    tcSaveState();
    tcCalcAll();
  });
  wrap.appendChild(span);
  wrap.appendChild(input);
  return wrap;
}

function tcCartTotals() {
  const totalBottles = tcState.bottles.reduce((s, b) => s + (b.qty || 0), 0);
  const totalVolumeL = tcState.bottles.reduce((s, b) => s + ((b.volume || 0) / 1000) * (b.qty || 0), 0);
  const productTotal = tcState.bottles.reduce((s, b) => s + (b.price || 0) * (b.qty || 0), 0);
  return { totalBottles, totalVolumeL, productTotal };
}

function tcCalcTaiwan(productTotal, shipping, bottles) {
  const cifTwd = (productTotal + shipping) * tcCrossRate(tcState.currency, "TWD");
  let liquorTax = 0;
  const items = bottles.map((b) => {
    const volL = (b.volume || 0) / 1000;
    const t = volL * (b.abv || 0) * 2.5 * (b.qty || 0);
    liquorTax += t;
    return { label: b.label || "(이름 없음)", tax: t };
  });
  const vat = (cifTwd + liquorTax) * 0.05;
  const taxSub = liquorTax + vat;
  const totalVolumeL = bottles.reduce((s, b) => s + ((b.volume || 0) / 1000) * (b.qty || 0), 0);
  let dhlFee = Math.max(420, taxSub * 0.02);
  const isFormal = cifTwd > 50000;
  if (isFormal) dhlFee += 1000;
  const flags = [];
  if (totalVolumeL > 5) flags.push({ level: "red", text: "개인 통관 한도(5L) 초과: 반입 불가 (수입업 면허 필요)" });
  const clearance = isFormal
    ? { type: "formal", label: "정식통관 (G1)", note: "CIF NT$50,000 초과 — 서면 위임장 + 관세사 수수료 NT$1,000 추가" }
    : { type: "simple", label: "간이통관", note: "CIF NT$50,000 이하 — 서류 없이 DHL이 대납·통관" };
  return { currency: "TWD", cif: cifTwd, items, lines: [["담배·주류세", liquorTax], ["영업세(5%)", vat]], taxSub, dhlFee, flags, clearance };
}

function tcCalcJapan(productTotal, shipping, bottles) {
  const cifJpy = (productTotal + shipping) * tcCrossRate(tcState.currency, "JPY");
  const base = cifJpy * 0.6;
  let liquorTax = 0;
  const items = bottles.map((b) => {
    const volL = (b.volume || 0) / 1000;
    const abv = b.abv || 0;
    const perL = abv <= 37 ? 370 : 370 + (abv - 37) * 10;
    const t = perL * volL * (b.qty || 0);
    liquorTax += t;
    return { label: b.label || "(이름 없음)", tax: t };
  });
  const consumptionTax = (base + liquorTax) * 0.1;
  const taxSub = liquorTax + consumptionTax;
  const totalVolumeL = bottles.reduce((s, b) => s + ((b.volume || 0) / 1000) * (b.qty || 0), 0);
  const dhlFee = Math.max(1100, taxSub * 0.02);
  const isFormal = cifJpy > 200000;
  const flags = [];
  if (totalVolumeL > 10) flags.push({ level: "red", text: "개인 자가사용 한도 초과 주의 (후생성 식품위생법 대상 우려)" });
  const clearance = isFormal
    ? { type: "formal", label: "정식통관", note: "CIF 20만 엔 초과 — 일반 정식 수입신고 대상" }
    : { type: "simple", label: "간이통관", note: "CIF 20만 엔 이하 — 간이신고로 DHL이 대납·통관" };
  return { currency: "JPY", cif: cifJpy, items, lines: [["주세", liquorTax], ["소비세(10%)", consumptionTax]], taxSub, dhlFee, flags, clearance };
}

function tcCalcKorea(productTotal, shipping, bottles, totalBottles) {
  const cifKrw = (productTotal + shipping) * tcCrossRate(tcState.currency, "KRW");
  const duty = cifKrw * 0.2;
  const liquorTax = (cifKrw + duty) * 0.72;
  const eduTax = liquorTax * 0.3;
  const vat = (cifKrw + duty + liquorTax + eduTax) * 0.1;
  const taxSub = duty + liquorTax + eduTax + vat;
  const dhlFee = Math.max(18700, taxSub * 0.02);
  const flags = [];
  if (totalBottles > 1) flags.push({ level: "yellow", text: "복수 보틀 전액 합산 과세" });
  const clearance = {
    type: "formal",
    label: "정식통관",
    note: "주류는 금액과 무관하게 목록통관(간이면세) 제외 — 항상 정식 수입신고 대상",
  };
  return {
    currency: "KRW",
    cif: cifKrw,
    items: [],
    lines: [["관세(20%)", duty], ["주세(72%)", liquorTax], ["교육세(30%)", eduTax], ["부가세(10%)", vat]],
    taxSub,
    dhlFee,
    flags,
    clearance,
  };
}

function tcRenderResultCard(countryName, result, productTotal, shipping) {
  const card = document.createElement("div");
  card.className = "tc-result-card";

  const sym = TC_CURRENCY_SYMBOL[result.currency];
  const localTotal = result.taxSub + result.dhlFee;
  const finalKrw =
    (productTotal + shipping) * tcCrossRate(tcState.currency, "KRW") +
    localTotal * tcCrossRate(result.currency, "KRW");

  const head = document.createElement("div");
  head.className = "tc-result-head";
  head.innerHTML = `<h4>${countryName}</h4>`;
  const clearanceBadge = document.createElement("span");
  clearanceBadge.className = "tc-flag tc-clearance-" + result.clearance.type;
  clearanceBadge.textContent = result.clearance.label;
  head.appendChild(clearanceBadge);
  for (const f of result.flags) {
    const badge = document.createElement("span");
    badge.className = "tc-flag tc-flag-" + f.level;
    badge.textContent = f.text;
    head.appendChild(badge);
  }
  card.appendChild(head);

  const clearanceNote = document.createElement("p");
  clearanceNote.className = "tc-clearance-note";
  clearanceNote.textContent = result.clearance.note;
  card.appendChild(clearanceNote);

  const body = document.createElement("div");
  body.className = "tc-result-body";
  body.innerHTML = `
    <div class="tc-result-line"><span>세금 소계</span><b>${sym}${tcFormat(result.taxSub)}</b></div>
    <div class="tc-result-line"><span>DHL 수수료</span><b>${sym}${tcFormat(result.dhlFee)}</b></div>
    <div class="tc-result-line tc-result-main"><span>현지 총 납부액</span><b>${sym}${tcFormat(localTotal)}</b></div>
    <div class="tc-result-line tc-result-final"><span>최종 총비용 (환산)</span><b>₩${tcFormat(finalKrw)}</b></div>
  `;
  card.appendChild(body);

  const details = document.createElement("details");
  details.className = "tc-accordion";
  const summary = document.createElement("summary");
  summary.textContent = "세부 내역 보기";
  details.appendChild(summary);
  const detailBody = document.createElement("div");
  detailBody.className = "tc-detail-body";
  for (const [label, val] of result.lines) {
    detailBody.appendChild(tcDetailLine(label, `${sym}${tcFormat(val)}`));
  }
  if (result.items.length) {
    const sep = document.createElement("div");
    sep.className = "tc-detail-sep";
    sep.textContent = "품목별 주류세";
    detailBody.appendChild(sep);
    for (const it of result.items) {
      detailBody.appendChild(tcDetailLine(it.label, `${sym}${tcFormat(it.tax)}`));
    }
  }
  details.appendChild(detailBody);
  card.appendChild(details);

  return card;
}

function tcDetailLine(label, value) {
  const line = document.createElement("div");
  line.className = "tc-detail-line";
  line.innerHTML = `<span>${label}</span><span>${value}</span>`;
  return line;
}

function tcCalcAll() {
  const { totalBottles, totalVolumeL, productTotal } = tcCartTotals();
  tcCartSummary.textContent = `총 ${totalBottles}병 · ${totalVolumeL.toFixed(2)}L · 상품 총액 ${TC_CURRENCY_SYMBOL[tcState.currency]}${tcFormat(productTotal)} · CIF ${TC_CURRENCY_SYMBOL[tcState.currency]}${tcFormat(productTotal + tcState.shipping)}`;

  const tw = tcCalcTaiwan(productTotal, tcState.shipping, tcState.bottles);
  const jp = tcCalcJapan(productTotal, tcState.shipping, tcState.bottles);
  const kr = tcCalcKorea(productTotal, tcState.shipping, tcState.bottles, totalBottles);

  tcResults.innerHTML = "";
  tcResults.appendChild(tcRenderResultCard("🇹🇼 대만", tw, productTotal, tcState.shipping));
  tcResults.appendChild(tcRenderResultCard("🇯🇵 일본", jp, productTotal, tcState.shipping));
  tcResults.appendChild(tcRenderResultCard("🇰🇷 한국 (비교용)", kr, productTotal, tcState.shipping));
}

tcCurrency.addEventListener("change", (e) => {
  tcState.currency = e.target.value;
  tcSaveState();
  tcRenderBottleList();
  tcCalcAll();
});

tcShipping.addEventListener("input", (e) => {
  tcState.shipping = parseFloat(e.target.value) || 0;
  tcSaveState();
  tcCalcAll();
});

tcAddBottle.addEventListener("click", () => {
  tcState.bottles.push({ id: tcNextId++, label: "", price: 0, volume: 700, abv: 50, qty: 1 });
  tcSaveState();
  tcRenderBottleList();
  tcCalcAll();
});

function tcInit() {
  tcLoadState();
  tcCurrency.value = tcState.currency;
  tcShipping.value = tcState.shipping;
  tcRenderRateGrid();
  tcRenderBottleList();
  tcCalcAll();
  tcFetchRates();
}

tcInit();
