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

(async function main() {
  logger.info("Boot start");

  const store = createStore({
    openMin: cfg.openMin,
    openMax: cfg.openMax,
    targets: cfg.targets,
    onFirstHit: (e) => broadcast("firsthit", e),
  });
  const server = startHttp(cfg.port);
  const { broadcast } = attachWs(server, store);

  const ticker = connectTicker(cfg);
  const ctrl = createTickerController(ticker, store, broadcast);

  async function reloadUniverse() {
    const rows = await fetchInstruments();
    const expiries = pickImmediateExpiries(rows, cfg.underlyings);
    return filterOptionTokens(rows, expiries);
  }

  ticker.on("connect", async () => {
    logger.info("Ticker connected");
  });

  ticker.connect();
  startMarketScheduler({ store, ctrl, reloadUniverse });
})();
