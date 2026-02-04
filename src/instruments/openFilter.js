const { KiteConnect } = require("kiteconnect");
const { logger } = require("../logger");

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
    arr.slice(i * n, (i + 1) * n),
  );

function quoteKey(m) {
  // For Kite quotes, key format is like "NFO:SYMBOL" / "BFO:SYMBOL"
  const exch = m.segment === "BFO-OPT" ? "BFO" : "NFO";
  return `${exch}:${m.tsym}`;
}

async function filterByTodayOpen(metas, cfg) {
  const kc = new KiteConnect({ api_key: cfg.apiKey });
  kc.setAccessToken(cfg.accessToken);

  const keys = metas.map(quoteKey);
  const keep = new Set();

  logger.info(`OpenFilter: fetching OPEN for ${keys.length} instruments...`);

  for (const part of chunk(keys, 200)) {
    // NOTE: kiteconnect node supports getQuote([...]) (array) in common versions
    const quotes = await kc.getQuote(part);

    for (const k of Object.keys(quotes || {})) {
      const open = quotes[k]?.ohlc?.open;
      if (open >= cfg.openMin && open <= cfg.openMax) keep.add(k);
    }
  }

  const filtered = metas.filter((m) => keep.has(quoteKey(m)));
  logger.info(
    `OpenFilter: kept ${filtered.length}/${metas.length} (₹${cfg.openMin}-₹${cfg.openMax})`,
  );
  return filtered;
}

module.exports = { filterByTodayOpen };
