const express = require("express");
const path = require("path");
const WebSocket = require("ws");
const { logger } = require("./logger");

function startServer(port, store, ensureDayStarted) {
  const app = express();
  app.use(express.static(path.join(process.cwd(), "public")));
  const server = app.listen(port, () => logger.info(`HTTP :${port}`));

  const wss = new WebSocket.Server({ server });
  const broadcast = (kind, row) => {
    const msg = JSON.stringify({ kind, row });
    wss.clients.forEach((c) => c.readyState === 1 && c.send(msg));
  };

  wss.on("connection", async (ws) => {
    logger.info("WS client connected");

    // ✅ Lazy start: first visitor after 09:15 triggers day start
    try {
      await ensureDayStarted();
    } catch (e) {
      logger.info(`ensureDayStarted error: ${e?.message || e}`);
    }

    // snapshot current state (Active + Achieved)
    for (const row of store.active.values())
      ws.send(JSON.stringify({ kind: "active", row }));
    for (const row of store.achieved.values())
      ws.send(JSON.stringify({ kind: "achieved", row }));
  });

  return { broadcast };
}

module.exports = { startServer };
