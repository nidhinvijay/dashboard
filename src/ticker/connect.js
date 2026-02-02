const { KiteTicker } = require("kiteconnect");
const { logger } = require("../logger");

function connectTicker({ apiKey, accessToken }) {
  logger.info("Creating KiteTicker...");
  const ticker = new KiteTicker({ api_key: apiKey, access_token: accessToken });

  ticker.on("connect", () => logger.info("Ticker connected"));
  ticker.on("disconnect", () => logger.info("Ticker disconnected"));
  ticker.on("error", (e) => logger.info(`Ticker error: ${e?.message || e}`));

  return ticker;
}

module.exports = { connectTicker };
