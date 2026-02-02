const winston = require("winston");
require("dotenv").config();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((i) => `${i.timestamp} ${i.level}: ${i.message}`),
  ),
  transports: [new winston.transports.Console()],
});

module.exports = { logger };
