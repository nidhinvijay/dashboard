const proto = location.protocol === "https:" ? "wss" : "ws";
const host = location.host || "localhost:3000";
const ws = new WebSocket(`${proto}://${host}`);

const active = new Map(); // token -> row
const achieved = new Map(); // token -> row

const tabs = [
  { id: "NIFTY_CE", name: "NIFTY", type: "CE", label: "NIFTY CE" },
  { id: "NIFTY_PE", name: "NIFTY", type: "PE", label: "NIFTY PE" },
  { id: "SENSEX_CE", name: "SENSEX", type: "CE", label: "SENSEX CE" },
  { id: "SENSEX_PE", name: "SENSEX", type: "PE", label: "SENSEX PE" },
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

const T = document.getElementById("tabs");
const AV = document.getElementById("activeView");
const CV = document.getElementById("achievedView");
let tabId = tabs[0].id;

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

function pick(map) {
  const t = tabs.find((x) => x.id === tabId);
  return [...map.values()]
    .filter((r) => r.name === t.name && r.type === t.type)
    .sort((a, b) => String(a.tsym).localeCompare(String(b.tsym))); // ascending tsym
}

function draw() {
  drawTabs();
  AV.innerHTML = table(pick(active));
  CV.innerHTML = table(pick(achieved));
}

ws.onmessage = (ev) => {
  const { kind, row } = JSON.parse(ev.data);
  if (kind === "active") {
    if (!achieved.has(row.token)) active.set(row.token, row);
  }
  if (kind === "achieved") {
    achieved.set(row.token, row);
    active.delete(row.token);
  }
  draw();
};

draw();
