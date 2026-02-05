const { istHM } = require("./ist");
const { logger } = require("./logger");

function startSessionLoop({ onReset, onStart, onStop }) {
  let last = "";
  setInterval(async () => {
    const hm = istHM();
    if (hm === last) return;
    last = hm;

    if (hm === "09:00") {
      logger.info("09:00 reset");
      onReset();
    }
    if (hm === "09:15") {
      logger.info("09:15 start");
      await onStart();
    }
    if (hm === "15:30") {
      logger.info("15:30 stop");
      onStop();
    }
  }, 1000);
}

module.exports = { startSessionLoop };
