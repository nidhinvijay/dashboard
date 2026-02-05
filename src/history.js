const { KiteConnect } = require("kiteconnect");
const { logger } = require("./logger");
const { nowIST } = require("./ist");

function istToUTCDate(dYYYYMMDD, hh, mm, ss) {
  // IST = UTC +05:30, so UTC instant = IST time -05:30
  const [Y, M, D] = dYYYYMMDD.split("-").map(Number);
  const utcMs = Date.UTC(Y, M - 1, D, hh, mm, ss) - (5 * 60 + 30) * 60 * 1000;
  return new Date(utcMs);
}

function normalizeInterval(raw) {
  const v = String(raw || "")
    .toLowerCase()
    .trim();
  // Your API accepts "minute"
  if (!v) return "minute";
  if (v === "1minute") return "minute";
  return v;
}

function intervalCandidates(raw) {
  const base = normalizeInterval(raw);
  const fallback = [
    "minute",
    "3minute",
    "5minute",
    "15minute",
    "30minute",
    "60minute",
    "day",
  ];
  return [base, ...fallback].filter((x, i, a) => x && a.indexOf(x) === i);
}

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function readCandle(c) {
  // Supports both formats:
  // 1) Array: [time, open, high, low, close, volume]
  // 2) Object: { date/time/timestamp, open, high, low, close, volume }
  if (Array.isArray(c)) {
    return {
      ts: c[0],
      open: toNum(c[1]),
      high: toNum(c[2]),
      low: toNum(c[3]),
      close: toNum(c[4]),
      volume: toNum(c[5]),
    };
  }

  if (c && typeof c === "object") {
    const ts = c.date || c.time || c.timestamp || c.datetime || null;
    return {
      ts,
      open: toNum(c.open),
      high: toNum(c.high),
      low: toNum(c.low),
      close: toNum(c.close),
      volume: toNum(c.volume),
    };
  }

  return {
    ts: null,
    open: null,
    high: null,
    low: null,
    close: null,
    volume: null,
  };
}

async function fetchCandlesForToken(kc, token, interval, fromDate, toDate) {
  const resp = await kc.getHistoricalData(
    token,
    interval,
    fromDate,
    toDate,
    false,
    false,
  );

  // Different kiteconnect versions return different shapes.
  const candles =
    resp?.data?.candles || resp?.candles || (Array.isArray(resp) ? resp : []);

  return candles;
}

async function pickWorkingInterval(kc, token, fromDate, toDate, rawInterval) {
  const candidates = intervalCandidates(rawInterval);
  logger.info(`HISTORY: interval candidates=${candidates.join(",")}`);

  for (const iv of candidates) {
    try {
      await fetchCandlesForToken(kc, token, iv, fromDate, toDate);
      logger.info(`HISTORY: interval selected=${iv}`);
      return iv;
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.toLowerCase().includes("invalid interval")) {
        logger.info(`HISTORY: interval ${iv} rejected`);
        continue;
      }
      logger.info(`HISTORY: interval probe error (${iv}): ${msg}`);
      return iv;
    }
  }

  logger.info("HISTORY: all intervals rejected; using 'minute'");
  return "minute";
}

function buildReplayEvents(meta, candlesRaw) {
  if (!candlesRaw || !candlesRaw.length) return [];

  // normalize first candle for day open
  const first = readCandle(candlesRaw[0]);
  const dayOpen = first.open;

  if (!dayOpen || dayOpen <= 0) return [];

  let dayLow = Infinity;
  const out = [];

  for (const cr of candlesRaw) {
    const c = readCandle(cr);

    // skip invalid candles
    if (!c.ts || !c.close || c.close <= 0) continue;

    const lowVal = c.low && c.low > 0 ? c.low : c.close;
    dayLow = Math.min(dayLow, lowVal);

    out.push({
      ts: c.ts,
      instrument_token: meta.token,
      last_price: c.close, // use candle close as LTP
      ohlc: { open: dayOpen, low: dayLow }, // day open + running day low
    });
  }

  return out;
}

async function buildHistoryReplay(cfg, metas, tradingDateYYYYMMDD) {
  const kc = new KiteConnect({ api_key: cfg.apiKey });
  kc.setAccessToken(cfg.accessToken);

  const fromDate = istToUTCDate(tradingDateYYYYMMDD, 9, 15, 0);
  const toDate = istToUTCDate(tradingDateYYYYMMDD, 15, 30, 0);

  const limited = metas.slice(0, cfg.history.maxTokens);

  logger.info(
    `HISTORY: fetching candles for ${limited.length}/${metas.length} tokens`,
  );
  logger.info(
    `HISTORY: fromDate(UTC)=${fromDate.toISOString()} toDate(UTC)=${toDate.toISOString()}`,
  );

  const firstToken = limited[0]?.token;
  const interval = await pickWorkingInterval(
    kc,
    firstToken,
    fromDate,
    toDate,
    cfg.history.interval,
  );

  const events = [];

  for (let i = 0; i < limited.length; i++) {
    const m = limited[i];
    try {
      const candlesRaw = await fetchCandlesForToken(
        kc,
        m.token,
        interval,
        fromDate,
        toDate,
      );

      // Debug first candle shape one time (first instrument only)
      if (i === 0 && candlesRaw?.[0]) {
        logger.info(
          `HISTORY: sample candle[0]=${JSON.stringify(candlesRaw[0]).slice(0, 180)}`,
        );
      }

      const firstTs = (() => {
        const r = candlesRaw?.[0] ? readCandle(candlesRaw[0]).ts : null;
        return r ? String(r) : "NA";
      })();

      logger.info(
        `HISTORY: ${m.tsym} token=${m.token} candles=${candlesRaw.length} first=${firstTs}`,
      );

      const evs = buildReplayEvents(m, candlesRaw);
      events.push(...evs);
    } catch (e) {
      logger.info(
        `HISTORY: failed ${m.tsym} token=${m.token} err=${e?.message || e}`,
      );
    }
  }

  events.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  logger.info(`HISTORY: total replay events=${events.length}`);
  return events;
}

function startHistoryReplay({ cfg, events, metaByToken, store, broadcast }) {
  let i = 0;
  logger.info(
    `HISTORY: replay start speedMs=${cfg.history.speedMs} now=${nowIST()}`,
  );

  const timer = setInterval(() => {
    if (i >= events.length) {
      clearInterval(timer);
      logger.info(`HISTORY: replay finished now=${nowIST()}`);
      return;
    }

    const burst = 30;
    for (let k = 0; k < burst && i < events.length; k++) {
      const t = events[i++];
      const meta = metaByToken.get(t.instrument_token);
      if (!meta) continue;

      const out = store.upsert(meta, t, (e) => broadcast("firsthit", e));
      if (out) broadcast(out.kind, out.row);
    }
  }, cfg.history.speedMs);

  return { stop: () => clearInterval(timer) };
}

module.exports = { buildHistoryReplay, startHistoryReplay };
