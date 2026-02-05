const { KiteConnect } = require("kiteconnect");
const { parse } = require("csv-parse/sync");
const { logger } = require("./logger");

async function fetchInstruments() {
  const res = await fetch("https://api.kite.trade/instruments");
  const csv = await res.text();
  return parse(csv, { columns: true, skip_empty_lines: true });
}

function nearestExpiry(rows, name, segment) {
  const exps = [
    ...new Set(
      rows
        .filter((r) => r.name === name && r.segment === segment)
        .map((r) => r.expiry),
    ),
  ];
  return exps.sort((a, b) => new Date(a) - new Date(b))[0];
}

function pickOptions(rows, name, segment, expiry) {
  return rows
    .filter(
      (r) =>
        r.name === name &&
        r.segment === segment &&
        r.expiry === expiry &&
        (r.instrument_type === "CE" || r.instrument_type === "PE"),
    )
    .map((r) => ({
      token: Number(r.instrument_token),
      tsym: r.tradingsymbol,
      name: r.name,
      type: r.instrument_type,
      expiry: r.expiry,
      segment: r.segment,
    }));
}

async function filterByTodayOpen(metas, cfg) {
  const kc = new KiteConnect({ api_key: cfg.apiKey });
  kc.setAccessToken(cfg.accessToken);

  const key = (m) => `${m.segment === "BFO-OPT" ? "BFO" : "NFO"}:${m.tsym}`;
  const keys = metas.map(key);
  const keep = new Set();

  for (let i = 0; i < keys.length; i += 200) {
    const part = keys.slice(i, i + 200);
    const q = await kc.getQuote(part);
    for (const k of Object.keys(q || {})) {
      const open = q[k]?.ohlc?.open;
      if (open >= cfg.openMin && open <= cfg.openMax) keep.add(k);
    }
  }
  return metas.filter((m) => keep.has(key(m)));
}

async function buildUniverse(cfg) {
  const rows = await fetchInstruments();

  const nExp = nearestExpiry(rows, "NIFTY", "NFO-OPT");
  const sExp = nearestExpiry(rows, "SENSEX", "BFO-OPT");
  logger.info(`Expiries NIFTY=${nExp} SENSEX=${sExp}`);

  const metas = [
    ...pickOptions(rows, "NIFTY", "NFO-OPT", nExp),
    ...pickOptions(rows, "SENSEX", "BFO-OPT", sExp),
  ];
  logger.info(`Universe before open-filter: ${metas.length}`);

  const filtered = await filterByTodayOpen(metas, cfg);
  logger.info(
    `Universe after open-filter ₹${cfg.openMin}-${cfg.openMax}: ${filtered.length}`,
  );
  return filtered;
}

module.exports = { buildUniverse };
