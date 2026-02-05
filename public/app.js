const proto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${proto}://${location.host}`);

const active = new Map(),
  achieved = new Map();
const firstHit = { NIFTY: { CE: {}, PE: {} }, SENSEX: { CE: {}, PE: {} } };

const tabs = [
  { id: "NIFTY_CE", name: "NIFTY", type: "CE", label: "NIFTY CE" },
  { id: "NIFTY_PE", name: "NIFTY", type: "PE", label: "NIFTY PE" },
  { id: "SENSEX_CE", name: "SENSEX", type: "CE", label: "SENSEX CE" },
  { id: "SENSEX_PE", name: "SENSEX", type: "PE", label: "SENSEX PE" },
  { id: "NIFTY_CHARTS", label: "NIFTY Charts" },
  { id: "SENSEX_CHARTS", label: "SENSEX Charts" },
];

const cols = [
  "tsym",
  "expiry",
  "open",
  "low",
  "low_time",
  "ltp",
  "hikePct",
  "targetPct",
  "target_time",
];
const fmt = (k, v) =>
  v == null ? "" : k === "hikePct" ? Number(v).toFixed(2) + "%" : v;

function shortSym(tsym) {
  const m = String(tsym).match(/(\d+)(CE|PE)$/);
  if (!m) return tsym;
  return `${m[1].slice(-5)}${m[2]}`; // last 5 digits + CE/PE
}

const T = document.getElementById("tabs");
const AV = document.getElementById("activeView");
const CV = document.getElementById("achievedView");
const tablesView = document.getElementById("tablesView");
const niftyCharts = document.getElementById("niftyCharts");
const sensexCharts = document.getElementById("sensexCharts");
let tabId = "NIFTY_CE";
const charts = {};

function drawTabs() {
  T.innerHTML = tabs
    .map(
      (t) =>
        `<button data-id="${t.id}" class="${t.id === tabId ? "active" : ""}">${t.label}</button>`,
    )
    .join("");
  T.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () => {
        tabId = b.dataset.id;
        draw();
      }),
  );
}

function table(list) {
  if (!list.length) return "<div>No rows</div>";
  const head = cols.map((c) => `<th>${c}</th>`).join("");
  const body = list
    .map(
      (r) =>
        "<tr>" + cols.map((c) => `<td>${fmt(c, r[c])}</td>`).join("") + "</tr>",
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function pick(map, name, type) {
  return [...map.values()]
    .filter((r) => r.name === name && r.type === type)
    .sort((a, b) => String(a.tsym).localeCompare(String(b.tsym)));
}

function view(kind) {
  tablesView.classList.toggle("hidden", kind !== "tables");
  niftyCharts.classList.toggle("hidden", kind !== "nifty");
  sensexCharts.classList.toggle("hidden", kind !== "sensex");
}

function ensureChart(id, label) {
  if (charts[id]) return charts[id];
  charts[id] = new Chart(document.getElementById(id), {
    type: "bar",
    data: { labels: [], datasets: [{ label, data: [] }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { ticks: { maxRotation: 60, minRotation: 60 } } },
    },
  });
  return charts[id];
}

function renderSnapshot(index, type, id) {
  const list = pick(active, index, type);
  const ch = ensureChart(id, `${index} Snapshot ${type}`);
  ch.data.labels = list.map((x) => shortSym(x.tsym));
  ch.data.datasets[0].data = list.map((x) => +(x.hikePct || 0).toFixed(2));
  ch.update();
}

function renderRace(index, type, id, target) {
  const levels = [];
  for (let i = 5; i <= target; i += 5) levels.push(i);
  const winners = levels.map((l) =>
    shortSym(firstHit[index][type][l]?.tsym || ""),
  );
  const ch = ensureChart(id, `${index} FirstHit ${type}`);
  ch.data.labels = winners;
  ch.data.datasets[0].data = levels;
  ch.update();
}

function draw() {
  drawTabs();

  if (tabId === "NIFTY_CHARTS") {
    view("nifty");
    renderSnapshot("NIFTY", "CE", "niftySnapCE");
    renderSnapshot("NIFTY", "PE", "niftySnapPE");
    renderRace("NIFTY", "CE", "niftyRaceCE", 50);
    renderRace("NIFTY", "PE", "niftyRacePE", 50);
    return;
  }
  if (tabId === "SENSEX_CHARTS") {
    view("sensex");
    renderSnapshot("SENSEX", "CE", "sensexSnapCE");
    renderSnapshot("SENSEX", "PE", "sensexSnapPE");
    renderRace("SENSEX", "CE", "sensexRaceCE", 100);
    renderRace("SENSEX", "PE", "sensexRacePE", 100);
    return;
  }

  view("tables");
  const t = tabs.find((x) => x.id === tabId);
  AV.innerHTML = table(pick(active, t.name, t.type));
  CV.innerHTML = table(pick(achieved, t.name, t.type));
}

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.kind === "active") {
    active.set(msg.row.token, msg.row);
    achieved.delete(msg.row.token);
  }
  if (msg.kind === "achieved") {
    achieved.set(msg.row.token, msg.row);
    active.delete(msg.row.token);
  }
  if (msg.kind === "firsthit") {
    const e = msg.row || msg;
    if (firstHit[e.index]?.[e.type])
      firstHit[e.index][e.type][e.level] = { tsym: e.tsym, time: e.time };
  }
  draw();
};

draw();
