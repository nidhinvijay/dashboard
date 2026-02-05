const { KiteTicker } = require("kiteconnect");
const { appendTick } = require("./persist");
const { logger } = require("./logger");

function startTicker(cfg, store, broadcast) {
  const ticker = new KiteTicker({
    api_key: cfg.apiKey,
    access_token: cfg.accessToken,
  });
  let metaByToken = new Map();
  let tokens = [];
  let lastSec = 0;

  ticker.on("connect", () => {
    logger.info("Ticker connected");
    if (tokens.length) {
      ticker.subscribe(tokens);
      ticker.setMode(ticker.modeFull, tokens);
      logger.info(`Subscribed ${tokens.length} tokens`);
    }
  });

  ticker.on("ticks", (ticks) => {
    const sec = Math.floor(Date.now() / 1000);
    for (const t of ticks) {
      const meta = metaByToken.get(t.instrument_token);
      if (!meta) continue;

      const out = store.upsert(meta, t, (e) => broadcast("firsthit", e));
      if (out) broadcast(out.kind, out.row);

      // save 1 record per second per token (active-only)
      if (!store.achieved?.has?.(meta.token) && sec !== lastSec) {
        appendTick({
          ts: sec,
          token: meta.token,
          tsym: meta.tsym,
          ltp: t.last_price,
        });
      }
    }
    lastSec = sec;
  });

  ticker.on("error", (e) => logger.info(`Ticker error: ${e?.message || e}`));
  ticker.on("disconnect", () => logger.info("Ticker disconnected"));

  function setUniverse(metas) {
    metaByToken = new Map(metas.map((m) => [m.token, m]));
    tokens = metas.map((m) => m.token);
  }

  function connect() {
    ticker.connect();
  }
  function stop() {
    if (tokens.length) ticker.unsubscribe(tokens);
  }

  return { setUniverse, connect, stop };
}

module.exports = { startTicker };
