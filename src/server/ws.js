const WebSocket = require("ws");
const { logger } = require("../logger");

function attachWs(server, store) {
  const wss = new WebSocket.Server({ server });
  logger.info("WS server attached");

  let sent = 0;
  function broadcast(kind, row) {
    const msg = JSON.stringify({ kind, row });
    wss.clients.forEach((c) => c.readyState === 1 && c.send(msg));
    sent++;
    if (sent % 50 === 0) logger.info(`WS broadcasts sent: ${sent}`);
  }

  wss.on("connection", (ws) => {
    logger.info("WS client connected");
    // snapshot on connect (important!)
    for (const row of store.active.values())
      ws.send(JSON.stringify({ kind: "active", row }));
    for (const row of store.achieved.values())
      ws.send(JSON.stringify({ kind: "achieved", row }));
  });

  return { broadcast };
}

module.exports = { attachWs };
