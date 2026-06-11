const PREFS = [
  "北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島",
  "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川",
  "新潟", "富山", "石川", "福井", "山梨", "長野",
  "岐阜", "静岡", "愛知", "三重",
  "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山",
  "鳥取", "島根", "岡山", "広島", "山口",
  "徳島", "香川", "愛媛", "高知",
  "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"
];

const el = {
  tabs: document.querySelectorAll(".tab"),
  originField: document.getElementById("originField"),
  lockOrigin: document.getElementById("lockOrigin"),
  fixedOrigin: document.getElementById("fixedOrigin"),
  origin: document.getElementById("originSelect"),
  destination: document.getElementById("destinationSelect"),
  size: document.getElementById("sizeSelect"),
  weight: document.getElementById("weightText"),
  route: document.getElementById("routeText"),
  price: document.getElementById("priceText"),
  detail: document.getElementById("detailText"),
  notice: document.getElementById("noticeText"),
  resultCard: document.getElementById("resultCard"),
  optionsToggle: document.getElementById("optionsToggle"),
  optionsToggleText: document.getElementById("optionsToggleText"),
  optionsBody: document.getElementById("optionsBody"),
  mapToggle: document.getElementById("mapToggle"),
  mapToggleText: document.getElementById("mapToggleText"),
  mapBody: document.getElementById("mapBody"),
  qrBox: document.getElementById("qrBox"),
  qrImage: document.getElementById("qrImage"),
  shareUrl: document.getElementById("shareUrlBtn"),
  qr: document.getElementById("qrBtn"),
  savePng: document.getElementById("savePngBtn"),
  mapKind: document.getElementById("mapKindSelect"),
  officeStatus: document.getElementById("officeStatus"),
  mapBox: document.getElementById("mapBox"),
  officeMap: document.getElementById("officeMap"),
  openMapLink: document.getElementById("openMapLink"),
  install: document.getElementById("installBtn"),
  settings: document.getElementById("settingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  settingsClose: document.getElementById("settingsCloseBtn"),
  toggles: {
    dropoff: document.getElementById("dropoff"),
    cod: document.getElementById("cod"),
    cool: document.getElementById("cool"),
    multi: document.getElementById("multi"),
    sameAddress: document.getElementById("sameAddress")
  }
};

const state = {
  rates: null,
  carrier: "japanpost",
  originLocked: false,
  fixedOrigin: localStorage.getItem("fixedOrigin") || "群馬",
  optionsOpen: localStorage.getItem("optionsOpen") === "1",
  mapOpen: localStorage.getItem("mapOpen") === "1",
  mapTimer: null
};

const yen = (value) => `${Math.max(0, value).toLocaleString()} 円`;
const serviceLabel = (carrier) => ({ japanpost: "日本郵便", yamato: "ヤマト運輸", sagawa: "佐川急便" }[carrier] || carrier);
const officeQuery = (carrier) => ({
  japanpost: "日本郵便 郵便局 ゆうゆう窓口",
  yamato: "ヤマト運輸 営業所 宅急便センター",
  sagawa: "佐川急便 営業所"
}[carrier] || "配送 営業所");
const convenienceQuery = (carrier) => ({
  japanpost: "ゆうパック 発送 コンビニ ローソン ミニストップ",
  yamato: "宅急便 発送 コンビニ セブンイレブン ファミリーマート",
  sagawa: "佐川急便 取扱 コンビニ"
}[carrier] || "荷物 発送 コンビニ");

function prefLabel(pref) {
  if (pref === "北海道") return "北海道";
  if (pref === "東京") return "東京都";
  if (pref === "大阪" || pref === "京都") return `${pref}府`;
  return `${pref}県`;
}

function fillSelect(select, values) {
  select.innerHTML = "";
  for (const pref of values) {
    const option = document.createElement("option");
    option.value = pref;
    option.textContent = prefLabel(pref);
    select.appendChild(option);
  }
}

function readParams() {
  const params = new URLSearchParams(location.search);
  state.carrier = params.get("carrier") || state.carrier;
  state.originLocked = params.get("locked") === "1" || localStorage.getItem("originLocked") === "1";
  state.fixedOrigin = params.get("fixedFrom") || localStorage.getItem("fixedOrigin") || state.fixedOrigin;
  el.origin.value = params.get("from") || state.fixedOrigin;
  el.lockOrigin.checked = state.originLocked;
  el.destination.value = params.get("to") || "東京";
  el.size.value = params.get("size") || "60";
  for (const key of Object.keys(el.toggles)) el.toggles[key].checked = params.get(key) === "1";
}

function currentOrigin() {
  return state.originLocked ? state.fixedOrigin : el.origin.value;
}

function currentCarrier() {
  return state.rates.carriers[state.carrier];
}

function updateUrl() {
  const params = new URLSearchParams({
    carrier: state.carrier,
    locked: state.originLocked ? "1" : "0",
    fixedFrom: state.fixedOrigin,
    from: currentOrigin(),
    to: el.destination.value,
    size: el.size.value
  });
  for (const [key, input] of Object.entries(el.toggles)) if (input.checked) params.set(key, "1");
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

function syncOriginLock() {
  state.originLocked = el.lockOrigin.checked;
  if (state.originLocked) state.fixedOrigin = el.origin.value;
  localStorage.setItem("originLocked", state.originLocked ? "1" : "0");
  localStorage.setItem("fixedOrigin", state.fixedOrigin);
  el.origin.disabled = state.originLocked;
  el.fixedOrigin.textContent = `固定中: ${prefLabel(state.fixedOrigin)}`;
  el.fixedOrigin.classList.toggle("hidden", !state.originLocked);
  calculate();
}

function setCarrier(carrier) {
  state.carrier = carrier;
  document.body.dataset.carrier = carrier;
  for (const tab of el.tabs) tab.classList.toggle("active", tab.dataset.carrier === carrier);
  calculate();
}

function setOptionsOpen(open) {
  state.optionsOpen = open;
  localStorage.setItem("optionsOpen", open ? "1" : "0");
  el.optionsBody.classList.toggle("hidden", !open);
  el.optionsToggle.setAttribute("aria-expanded", String(open));
  el.optionsToggleText.textContent = open ? "非表示" : "表示";
}

function setMapOpen(open) {
  state.mapOpen = open;
  localStorage.setItem("mapOpen", open ? "1" : "0");
  el.mapBody.classList.toggle("hidden", !open);
  el.mapToggle.setAttribute("aria-expanded", String(open));
  el.mapToggleText.textContent = open ? "非表示" : "表示";
  if (open) updateMap();
  if (!open) {
    clearTimeout(state.mapTimer);
    el.officeMap.removeAttribute("src");
  }
}

function setSettingsOpen(open) {
  el.settingsModal.classList.toggle("hidden", !open);
  document.body.classList.toggle("modal-open", open);
}

function mapKeyword() {
  if (el.mapKind.value === "convenience") return convenienceQuery(state.carrier);
  if (el.mapKind.value === "pudo") return "PUDOステーション 宅配便ロッカー";
  return officeQuery(state.carrier);
}

function mapKindLabel() {
  return ({ office: "営業所", convenience: "コンビニ", pudo: "PUDO" }[el.mapKind.value] || "取り扱い場所");
}

function showOfficeMap(query, statusText) {
  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=14&output=embed`;
  const openUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  el.officeMap.src = embedUrl;
  el.openMapLink.href = openUrl;
  el.openMapLink.textContent = "Googleマップで開く";
  el.officeStatus.textContent = statusText;
}

function updateMap() {
  if (!state.mapOpen) return;
  const origin = currentOrigin();
  const query = `${prefLabel(origin)} ${mapKeyword()}`;
  el.officeStatus.textContent = `${prefLabel(origin)}周辺の${serviceLabel(state.carrier)} ${mapKindLabel()}を準備しています。`;
  clearTimeout(state.mapTimer);
  state.mapTimer = setTimeout(() => {
    showOfficeMap(query, `${prefLabel(origin)}周辺の${serviceLabel(state.carrier)} ${mapKindLabel()}を表示しています。`);
  }, 700);
}

function discountAmount(discount, size, notes, options) {
  if (!discount) return 0;
  if (discount.unavailable_sizes?.includes(size)) {
    notes.push(`${options.label}は${size}サイズ対象外です。`);
    return 0;
  }
  if (discount.unavailable_with_cool && el.toggles.cool.checked) {
    notes.push(`${options.label}はクール便と併用しない計算にしています。`);
    return 0;
  }
  if (discount.unavailable_with_cod && el.toggles.cod.checked) {
    notes.push(`${options.label}は着払い時対象外です。`);
    return 0;
  }
  if (discount.by_size) return discount.by_size[size] || 0;
  if (discount.note) notes.push(discount.note);
  return discount.amount_yen || 0;
}

function calculate() {
  if (!state.rates) return;
  const carrier = currentCarrier();
  const origin = currentOrigin();
  const destination = el.destination.value;
  const size = el.size.value;
  const base = carrier.rates?.[origin]?.[destination]?.[size];
  const notes = [];
  let total = base || 0;
  const parts = [`基本 ${yen(base || 0)}`];

  const weightLimit = carrier.weight_limits?.[size];
  el.weight.textContent = weightLimit ? `${weightLimit}kg以下` : "公式条件に準拠";

  if (carrier.size_notes?.[size]) notes.push(carrier.size_notes[size]);
  if (el.toggles.cod.checked) {
    const v = discountAmount(carrier.discounts.cod, size, notes, { label: "着払い" });
    total += v;
    parts.push(`着払い ${v ? `+${yen(v)}` : "+0 円"}`);
  }
  if (el.toggles.cool.checked) {
    const v = discountAmount(carrier.discounts.cool, size, notes, { label: "クール便" });
    total += v;
    if (v) parts.push(`クール +${yen(v)}`);
  }
  if (el.toggles.dropoff.checked) {
    const v = discountAmount(carrier.discounts.dropoff, size, notes, { label: "持込割引" });
    total -= v;
    if (v) parts.push(`持込 -${yen(v)}`);
  }
  if (el.toggles.multi.checked) {
    const v = discountAmount(carrier.discounts.multi, size, notes, { label: "複数口割引" });
    total -= v;
    if (v) parts.push(`複数口 -${yen(v)}`);
  }
  if (el.toggles.sameAddress.checked) {
    const v = discountAmount(carrier.discounts.sameAddress, size, notes, { label: "同一あて先割引" });
    total -= v;
    if (v) parts.push(`同一あて先 -${yen(v)}`);
  }

  el.route.textContent = `${serviceLabel(state.carrier)} ${prefLabel(origin)} → ${prefLabel(destination)}`;
  el.price.textContent = yen(total);
  el.detail.textContent = `${size}サイズ / ${parts.join(" / ")}`;
  el.notice.textContent = notes.join(" ");
  updateUrl();
  updateMap();
}

async function shareUrl() {
  const url = location.href;
  try {
    if (navigator.share && window.isSecureContext) {
      await navigator.share({ title: "配送運賃チェッカー", url });
      el.notice.textContent = "共有を開きました。";
      return;
    }
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      el.notice.textContent = "URLをコピーしました。";
      return;
    }
    window.prompt("このURLをコピーしてください", url);
    el.notice.textContent = "URLコピー用の入力欄を表示しました。";
  } catch (error) {
    window.prompt("このURLをコピーしてください", url);
    el.notice.textContent = "共有機能が使えないため、URLコピー用の入力欄を表示しました。";
  }
}

function showQr() {
  el.qrBox.classList.toggle("hidden");
  if (!el.qrBox.classList.contains("hidden")) {
    el.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(location.href)}`;
    el.notice.textContent = "QRコードを表示しました。";
  } else {
    el.notice.textContent = "QRコードを非表示にしました。";
  }
}

function savePng() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 520;
    const ctx = canvas.getContext("2d");
    const styles = getComputedStyle(document.body);
    const carrierColor = styles.getPropertyValue("--carrier").trim() || "#d71920";
    const carrierText = styles.getPropertyValue("--carrier-text").trim() || "#ffffff";
    ctx.fillStyle = "#eef7f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = carrierColor;
    ctx.roundRect(60, 60, 780, 310, 18);
    ctx.fill();
    ctx.fillStyle = carrierText;
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.fillText(el.route.textContent, 95, 135);
    ctx.font = "bold 82px system-ui, sans-serif";
    ctx.fillText(el.price.textContent, 95, 240);
    ctx.font = "28px system-ui, sans-serif";
    ctx.fillText(el.detail.textContent.slice(0, 46), 95, 315);
    ctx.fillStyle = "#122018";
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillText("配送運賃チェッカー", 60, 440);
    const link = document.createElement("a");
    link.download = "delivery-rate.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    el.notice.textContent = "PNG保存を開始しました。保存されない場合はHTTPS公開版で試してください。";
  } catch (error) {
    el.notice.textContent = "PNG保存に失敗しました。HTTPS公開版での利用が必要な場合があります。";
  }
}

async function init() {
  fillSelect(el.origin, PREFS);
  fillSelect(el.destination, PREFS);
  state.rates = window.RATES_DATA || await loadRates();
  readParams();
  syncOriginLock();
  setOptionsOpen(state.optionsOpen);
  setMapOpen(state.mapOpen);
  setCarrier(state.carrier);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

async function loadRates() {
  const paths = ["/rates.json", "rates.json"];
  let lastError;
  for (const path of paths) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("rates.json を読み込めませんでした。");
}

for (const tab of el.tabs) tab.addEventListener("click", () => setCarrier(tab.dataset.carrier));
el.lockOrigin.addEventListener("change", syncOriginLock);
el.optionsToggle.addEventListener("click", () => setOptionsOpen(!state.optionsOpen));
el.mapToggle.addEventListener("click", () => setMapOpen(!state.mapOpen));
for (const input of [el.origin, el.destination, el.size, ...Object.values(el.toggles)]) input.addEventListener("change", calculate);
el.shareUrl.addEventListener("click", shareUrl);
el.qr.addEventListener("click", showQr);
el.savePng.addEventListener("click", savePng);
el.mapKind.addEventListener("change", updateMap);
el.settings.addEventListener("click", () => setSettingsOpen(true));
el.settingsClose.addEventListener("click", () => setSettingsOpen(false));
el.settingsModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-settings]")) setSettingsOpen(false);
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setSettingsOpen(false);
});

let deferredInstall;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstall = event;
  el.install.hidden = false;
});
el.install.addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  el.install.hidden = true;
});

init().catch((error) => {
  el.detail.textContent = "rates.json の読み込みに失敗しました。";
  el.notice.textContent = error.message;
});
