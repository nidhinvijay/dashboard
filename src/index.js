const { cfg } = require("./config");
const { logger } = require("./logger");

const { fetchInstruments } = require("./instruments/fetch");
const {
  pickImmediateExpiries,
  filterOptionTokens,
} = require("./instruments/filter");

const { createStore } = require("./state/store");
const { startHttp } = require("./server/http");
const { attachWs } = require("./server/ws");

const { connectTicker } = require("./ticker/connect");
const { createTickerController } = require("./ticker/controller");
const { startMarketScheduler } = require("./scheduler/market");
const { filterByTodayOpen } = require("./instruments/openFilter");

// --- IST helpers (no dependency) ---
function istHM() {
  const p = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => p.find((x) => x.type === t)?.value;
  return `${get("hour")}:${get("minute")}`;
}
const inRange = (hm, a, b) => hm >= a && hm <= b;

(async function main() {
  logger.info("Boot start");

  // Store with first-hit events broadcast
  let broadcast = () => {};
  const store = createStore({
    openMin: cfg.openMin,
    openMax: cfg.openMax,
    targets: cfg.targets,
    onFirstHit: (e) => broadcast("firsthit", e),
  });

  // HTTP + WS
  const server = startHttp(cfg.port);
  const ws = attachWs(server, store);
  broadcast = ws.broadcast;

  // Ticker + controller
  const ticker = connectTicker(cfg);
  const ctrl = createTickerController(ticker, store, broadcast);

  // Reload universe (called daily at 09:15 by scheduler)
  async function reloadUniverse() {
    logger.info("Reload universe: downloading instruments");
    const rows = await fetchInstruments();

    const expiries = pickImmediateExpiries(rows, cfg.underlyings);
    let metas = filterOptionTokens(rows, expiries); // expiry + CE/PE + segment filter

    metas = await filterByTodayOpen(metas, cfg); // ✅ ONLY open in ₹25–₹500

    logger.info(`Reload universe done (open filtered): ${metas.length} tokens`);
    return metas;
  }

  // Connect ticker
  ticker.on("connect", () => logger.info("Ticker connected"));
  ticker.connect();

  // Scheduler handles:
  // 09:00 reset + freeze, 09:15 load+subscribe+resume, 15:30 stop+freeze
  startMarketScheduler({ store, ctrl, reloadUniverse });

  // ✅ AUTO-START ON RESTART:
  // If you restart during market hours, don't wait for next 09:15.
  const hm = istHM();
  if (inRange(hm, "09:15", "15:30")) {
    logger.info(`Boot auto-start (IST ${hm})`);
    const metas = await reloadUniverse();
    ctrl.setUniverse(metas);
    store.resume();
    ctrl.subscribe();
  } else {
    logger.info(`Boot waiting for schedule (IST ${hm})`);
  }
})();
