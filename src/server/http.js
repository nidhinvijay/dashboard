const express = require("express");
const path = require("path");
const { logger } = require("../logger");

function startHttp(port) {
  const app = express();
  app.use(express.static(path.join(__dirname, "../../public")));
  const server = app.listen(port, () => logger.info(`HTTP on :${port}`));
  return server;
}

module.exports = { startHttp };
