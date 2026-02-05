require("dotenv").config();

const n = (k, d) => Number(process.env[k] ?? d);
const s = (k, d) => String(process.env[k] ?? d);

const cfg = {
  apiKey: process.env.KITE_API_KEY,
  apiSecret: process.env.KITE_API_SECRET,
  accessToken: process.env.KITE_ACCESS_TOKEN,

  port: n("PORT", 3000),
  openMin: n("OPEN_MIN", 50),
  openMax: n("OPEN_MAX", 500),

  targets: {
    NIFTY: n("NIFTY_TARGET", 50),
    SENSEX: n("SENSEX_TARGET", 100),
  },

  mode: s("MODE", "LIVE").toUpperCase(),

  history: {
    interval: s("HISTORY_INTERVAL", "minute"), // "minute" = 1-minute candles
    speedMs: n("HISTORY_SPEED_MS", 150),
    maxTokens: n("HISTORY_MAX_TOKENS", 60),
  },
};

module.exports = { cfg };
