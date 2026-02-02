const { nowIST } = require("../utils/time");
const { logger } = require("../logger");
let paused = false;

function createStore({ openMin, openMax, targets }) {
  const active = new Map(),
    achieved = new Map();

  function reset() {
    active.clear();
    achieved.clear();
    paused = true; // freeze until 09:15 start
    logger.info("STORE RESET (cleared active+achieved, paused=true)");
  }

  function pause() {
    paused = true;
    logger.info("STORE PAUSED");
  }
  function resume() {
    paused = false;
    logger.info("STORE RESUMED");
  }
  function isPaused() {
    return paused;
  }

  function upsert(meta, tick) {
    if (paused) return; // ✅ freeze after 15:30
    if (achieved.has(meta.token)) return; // ✅ never re-enter once achieved

    const now = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
    });
    const open = tick?.ohlc?.open,
      lowTick = tick?.ohlc?.low,
      ltp = tick?.last_price;
    const targetPct = targets?.[meta.name] ?? 50;
    if (!open || !ltp) return;
    if (open < openMin || open > openMax) return;

    const prev = active.get(meta.token) || { ...meta, open, low: Infinity };
    const low = Math.min(prev.low, lowTick ?? Infinity, ltp);
    const low_time = low < prev.low ? now : prev.low_time;

    const hikePct = ((ltp - low) / low) * 100;
    const targetPrice = +(low * (1 + targetPct / 100)).toFixed(2);
    const row = {
      ...prev,
      open,
      low,
      low_time,
      ltp,
      hikePct,
      targetPct,
      targetPrice,
    };

    if (hikePct >= targetPct) {
      achieved.set(meta.token, { ...row, target_time: now });
      active.delete(meta.token);
      logger.info(
        `ACHIEVED ${meta.tsym} (${meta.name}) >=${targetPct}% at ${now}`,
      );
      return { kind: "achieved", row: achieved.get(meta.token) };
    }
    active.set(meta.token, row);
    return { kind: "active", row };
  }

  return { active, achieved, upsert, reset, pause, resume, isPaused };
}

module.exports = { createStore };
