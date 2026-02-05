const { cfg } = require("./config");
const { logger } = require("./logger");

const { createStore } = require("./store");
const { buildUniverse } = require("./universe");
const { startTicker } = require("./ticker");
const { startServer } = require("./server");
const { startSessionLoop } = require("./session");

const { loadState, saveState } = require("./persist");
const { istHM, dateIST } = require("./ist");

const { buildHistoryReplay, startHistoryReplay } = require("./history");

(async function main() {
  logger.info(`Boot MODE=${cfg.mode}`);

  const store = createStore(cfg);

  // Restore today's saved state if exists
  const saved = loadState();
  if (saved?.active) saved.active.forEach((r) => store.active.set(r.token, r));
  if (saved?.achieved)
    saved.achieved.forEach((r) => store.achieved.set(r.token, r));

  // Broadcaster will be set after server starts
  let broadcast = () => {};

  // Ticker (LIVE only)
  const ticker = startTicker(cfg, store, (k, r) => broadcast(k, r));

  let dayStarted = false;
  let dayKey = dateIST();

  // universe cache for the day (fixed)
  let metasCache = [];
  let metaByToken = new Map();

  // history replay handle
  let historyHandle = null;

  async function ensureDayStarted() {
    const hm = istHM();

    // date rollover protection
    if (dateIST() !== dayKey) {
      dayKey = dateIST();
      dayStarted = false;
      metasCache = [];
      metaByToken = new Map();
      if (historyHandle) historyHandle.stop();
      historyHandle = null;

      store.reset();
      saveState({ universe: [], active: [], achieved: [] });
      logger.info("New date detected → hard reset");
    }

    if (dayStarted) return;

    // In LIVE mode, only start within session window
    if (cfg.mode === "LIVE") {
      if (hm < "09:15") return;
      if (hm > "15:30") return;
    }

    logger.info("Day start: selecting universe by TODAY OPEN range (₹50-₹500)");
    const metas = await buildUniverse(cfg); // nearest expiry + OPEN filter
    metasCache = metas;
    metaByToken = new Map(metas.map((m) => [m.token, m]));

    store.resume();
    dayStarted = true;

    // Persist universe for reference
    saveState({
      universe: metas,
      active: [...store.active.values()],
      achieved: [...store.achieved.values()],
    });
    logger.info(`Universe fixed for day: ${metas.length} tokens`);

    if (cfg.mode === "LIVE") {
      ticker.setUniverse(metasCache);
      ticker.connect();
      logger.info("LIVE: ticker connected/subscribed");
      return;
    }

    // HISTORY mode
    const d = dateIST();
    const events = await buildHistoryReplay(cfg, metasCache, d);
    historyHandle = startHistoryReplay({
      cfg,
      events,
      metaByToken,
      store,
      broadcast,
    });
    logger.info("HISTORY: replay running");
  }

  function resetDay() {
    logger.info("09:00 reset");
    dayStarted = false;
    metasCache = [];
    metaByToken = new Map();
    if (historyHandle) historyHandle.stop();
    historyHandle = null;

    store.reset();
    saveState({ universe: [], active: [], achieved: [] });
  }

  function stopDay() {
    logger.info("15:30 stop (freeze)");
    store.pause();
    if (cfg.mode === "LIVE") ticker.stop();
    if (historyHandle) historyHandle.stop();
    historyHandle = null;

    saveState({
      universe: [],
      active: [...store.active.values()],
      achieved: [...store.achieved.values()],
    });
  }

  // Session loop always runs
  startSessionLoop({
    onReset: resetDay,
    onStart: async () => {}, // lazy start via ensureDayStarted()
    onStop: stopDay,
  });

  // Start server with lazy-start hook (first user open triggers ensureDayStarted)
  const srv = startServer(cfg.port, store, ensureDayStarted);
  broadcast = srv.broadcast;

  // Persist state every 5 seconds (so restart keeps Active/Achieved)
  setInterval(() => {
    saveState({
      universe: metasCache,
      active: [...store.active.values()],
      achieved: [...store.achieved.values()],
    });
  }, 5000);

  logger.info("Ready: open the dashboard URL to trigger start (lazy)");
})();
