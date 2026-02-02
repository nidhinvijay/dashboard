const { logger } = require("../logger");
const { levels } = require("../levels");

let paused = false;

function createStore({ openMin, openMax, targets, onFirstHit }) {
  const active = new Map(),
    achieved = new Map();
  const firstHit = { NIFTY: { CE: {}, PE: {} }, SENSEX: { CE: {}, PE: {} } };

  function reset() {
    active.clear();
    achieved.clear();
    firstHit.NIFTY.CE = {};
    firstHit.NIFTY.PE = {};
    firstHit.SENSEX.CE = {};
    firstHit.SENSEX.PE = {};
    paused = true;
    logger.info("STORE RESET (cleared active+achieved+firstHit, paused=true)");
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

  function nowIST() {
    return new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
    });
  }

  function recordFirstHits(meta, hikePct, now, targetPct) {
    const idx = meta.name,
      typ = meta.type;
    const maxLevel = Math.min(targetPct, Math.floor(hikePct / 5) * 5);
    if (maxLevel < 5) return;

    for (const lvl of levels(5, maxLevel)) {
      if (!firstHit[idx]?.[typ]) continue;
      if (firstHit[idx][typ][lvl]) continue;
      firstHit[idx][typ][lvl] = { tsym: meta.tsym, time: now };
      onFirstHit &&
        onFirstHit({
          index: idx,
          type: typ,
          level: lvl,
          tsym: meta.tsym,
          time: now,
        });
    }
  }

  function upsert(meta, tick) {
    if (paused) return;
    if (achieved.has(meta.token)) return;

    const now = nowIST();
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
    recordFirstHits(meta, hikePct, now, targetPct);

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
