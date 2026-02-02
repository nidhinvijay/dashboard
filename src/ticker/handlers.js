const { logger } = require("../logger");

function wireTicker({ ticker, metas, store, broadcast }) {
  const tokens = metas.map((m) => m.token);
  const metaByToken = new Map(metas.map((m) => [m.token, m]));

  ticker.on("connect", () => {
    logger.info(`Subscribing ${tokens.length} tokens (full mode)`);
    ticker.subscribe(tokens);
    ticker.setMode(ticker.modeFull, tokens);
  });

  ticker.on("ticks", (ticks) => {
    for (const t of ticks) {
      const meta = metaByToken.get(t.instrument_token);
      if (!meta) continue;
      const out = store.upsert(meta, t);
      if (out) broadcast(out.kind, out.row);
    }
  });

  logger.info("Ticker handlers wired");
}

module.exports = { wireTicker };
