const { logger } = require("../logger");

function createTickerController(ticker, store, broadcast) {
  let metaByToken = new Map();
  let tokens = [];

  function setUniverse(metas) {
    metaByToken = new Map(metas.map((m) => [m.token, m]));
    tokens = metas.map((m) => m.token);
    logger.info(`Universe set: ${tokens.length} tokens`);
  }

  function subscribe() {
    if (!tokens.length) return logger.info("Subscribe skipped (0 tokens)");
    logger.info(`Subscribing ${tokens.length} tokens (full mode)`);
    ticker.subscribe(tokens);
    ticker.setMode(ticker.modeFull, tokens);
  }

  function unsubscribeAll() {
    if (!tokens.length) return;
    ticker.unsubscribe(tokens);
    logger.info("Unsubscribed all tokens");
  }

  ticker.on("ticks", (ticks) => {
    if (store.isPaused()) return;
    for (const t of ticks) {
      const meta = metaByToken.get(t.instrument_token);
      if (!meta) continue;
      const out = store.upsert(meta, t);
      if (out) broadcast(out.kind, out.row);
    }
  });

  return { setUniverse, subscribe, unsubscribeAll };
}

module.exports = { createTickerController };
