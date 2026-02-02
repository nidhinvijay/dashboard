require("dotenv").config();

const n = (k, d) => Number(process.env[k] ?? d);

const cfg = {
  apiKey: process.env.KITE_API_KEY,
  accessToken: process.env.KITE_ACCESS_TOKEN,
  port: n("PORT", 3000),
  openMin: n("OPEN_MIN", 25),
  openMax: n("OPEN_MAX", 550),
  underlyings: (process.env.UNDERLYINGS || "NIFTY,SENSEX").split(","),
  targets: {
    NIFTY: n("NIFTY_TARGET_PCT", 50),
    SENSEX: n("SENSEX_TARGET_PCT", 100),
  },
};

module.exports = { cfg };
