const { istHM } = require("../utils/istClock");
const { logger } = require("../logger");

function startMarketScheduler({ store, ctrl, reloadUniverse }) {
  let last = "";

  setInterval(async () => {
    const hm = istHM();
    if (hm === last) return;
    last = hm;

    if (hm === "09:00") {
      store.reset();
      ctrl.unsubscribeAll();
      logger.info("09:00 IST → reset done (frozen until 09:15)");
    }

    if (hm === "09:15") {
      const metas = await reloadUniverse();
      ctrl.setUniverse(metas);
      store.resume();
      ctrl.subscribe();
      logger.info("09:15 IST → universe reloaded + tracking started");
    }

    if (hm === "15:30") {
      store.pause();
      ctrl.unsubscribeAll();
      logger.info("15:30 IST → tracking stopped + frozen");
    }
  }, 1000);
}

module.exports = { startMarketScheduler };
