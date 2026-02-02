const proto = location.protocol === "https:" ? "wss" : "ws";
const host = location.host || "localhost:3000";
const ws = new WebSocket(`${proto}://${host}/ws`);
// If your local WS is not on /ws, use this instead:
// const ws = new WebSocket(`${proto}://${host}`);

const active = new Map(),
  achieved = new Map();
const firstHit = { NIFTY: { CE: {}, PE: {} }, SENSEX: { CE: {}, PE: {} } };

const tableTabs = [
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
  "targetPrice",
  "target_time",
];
const fmt = (k, v) =>
  v == null ? "" : k === "hikePct" ? Number(v).toFixed(2) + "%" : v;

// ✅ Short label for charts: SENSEX2620582400CE -> 82400CE
function shortSym(tsym) {
  const m = String(tsym).match(/(\d+)(CE|PE)$/);
  if (!m) return tsym;

  const digits = m[1]; // all digits
  const strike = digits.slice(-5); // ✅ last 5 digits only
  return `${strike}${m[2]}`; // 82400CE
}

const T = document.getElementById("tabs");
const AV = document.getElementById("activeView");
const CV = document.getElementById("achievedView");
const tablesView = document.getElementById("tablesView");
const niftyCharts = document.getElementById("niftyCharts");
const sensexCharts = document.getElementById("sensexCharts");

let tabId = "NIFTY_CE";
let charts = {};

function drawTabs() {
  T.innerHTML = tableTabs
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

function showView(kind) {
  tablesView.classList.toggle("hidden", kind !== "tables");
  niftyCharts.classList.toggle("hidden", kind !== "niftyCharts");
  sensexCharts.classList.toggle("hidden", kind !== "sensexCharts");
}

function chTitle(id) {
  const m = {
    niftySnapCE: "NIFTY Snapshot CE",
    niftySnapPE: "NIFTY Snapshot PE",
    niftyRaceCE: "NIFTY First-to-hit CE",
    niftyRacePE: "NIFTY First-to-hit PE",
    sensexSnapCE: "SENSEX Snapshot CE",
    sensexSnapPE: "SENSEX Snapshot PE",
    sensexRaceCE: "SENSEX First-to-hit CE",
    sensexRacePE: "SENSEX First-to-hit PE",
  };
  return m[id] || id;
}

function ensureChart(id) {
  if (charts[id]) return charts[id];
  const ctx = document.getElementById(id).getContext("2d");
  charts[id] = new Chart(ctx, {
    type: "bar",
    data: { labels: [], datasets: [{ label: chTitle(id), data: [] }] },
    options: {
      responsive: true,
      maintainAspectRatio: false, // obey CSS height so 4 charts fit
      plugins: { legend: { display: true } },
      scales: { x: { ticks: { maxRotation: 60, minRotation: 60 } } },
    },
  });
  return charts[id];
}

function renderSnapshot(index, type, canvasId) {
  const list = pick(active, index, type);
  const labels = list.map((x) => shortSym(x.tsym)); // ✅ short labels
  const data = list.map((x) => +(x.hikePct || 0).toFixed(2));
  const ch = ensureChart(canvasId);
  ch.data.labels = labels;
  ch.data.datasets[0].data = data;
  ch.update();
}

function renderRace(index, type, canvasId, target) {
  const levels = [];
  for (let i = 5; i <= target; i += 5) levels.push(i);
  const winners = levels.map((lvl) =>
    shortSym(firstHit[index][type][lvl]?.tsym || ""),
  ); // ✅ short labels
  const ch = ensureChart(canvasId);
  ch.data.labels = winners; // X axis = winners (short)
  ch.data.datasets[0].data = levels; // Y values = levels
  ch.update();
}

function drawCharts(index) {
  if (index === "NIFTY") {
    renderSnapshot("NIFTY", "CE", "niftySnapCE");
    renderSnapshot("NIFTY", "PE", "niftySnapPE");
    renderRace("NIFTY", "CE", "niftyRaceCE", 50);
    renderRace("NIFTY", "PE", "niftyRacePE", 50);
  } else {
    renderSnapshot("SENSEX", "CE", "sensexSnapCE");
    renderSnapshot("SENSEX", "PE", "sensexSnapPE");
    renderRace("SENSEX", "CE", "sensexRaceCE", 100);
    renderRace("SENSEX", "PE", "sensexRacePE", 100);
  }
}

function draw() {
  drawTabs();

  if (tabId === "NIFTY_CHARTS") {
    showView("niftyCharts");
    drawCharts("NIFTY");
    return;
  }
  if (tabId === "SENSEX_CHARTS") {
    showView("sensexCharts");
    drawCharts("SENSEX");
    return;
  }

  showView("tables");
  const t = tableTabs.find((x) => x.id === tabId);
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
    if (!firstHit[e.index]?.[e.type]) return;
    firstHit[e.index][e.type][e.level] = { tsym: e.tsym, time: e.time };
  }

  draw();
};

draw();
