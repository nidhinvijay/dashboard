// const { nowIST } = require("./ist");
// const { logger } = require("./logger");

// function makeLevels(max) {
//   const a = [];
//   for (let i = 5; i <= max; i += 5) a.push(i);
//   return a;
// }

// function createStore(cfg) {
//   const active = new Map(),
//     achieved = new Map();
//   const firstHit = { NIFTY: { CE: {}, PE: {} }, SENSEX: { CE: {}, PE: {} } };
//   let paused = true;

//   const reset = () => {
//     active.clear();
//     achieved.clear();
//     firstHit.NIFTY.CE = {};
//     firstHit.NIFTY.PE = {};
//     firstHit.SENSEX.CE = {};
//     firstHit.SENSEX.PE = {};
//     paused = true;
//   };
//   const resume = () => (paused = false);
//   const pause = () => (paused = true);

//   function upsert(meta, tick, onFirstHit) {
//     if (paused) return;
//     if (achieved.has(meta.token)) return;

//     const open = tick?.ohlc?.open,
//       ltp = tick?.last_price;
//     const lowTick = tick?.ohlc?.low;
//     if (!open || !ltp) return;

//     const prev = active.get(meta.token) || { ...meta, open, low: Infinity };
//     const now = nowIST();
//     const low = Math.min(prev.low, lowTick ?? Infinity, ltp);
//     const low_time = low < prev.low ? now : prev.low_time;

//     const hikePct = ((ltp - low) / low) * 100;
//     const targetPct = cfg.targets[meta.name];
//     const row = { ...prev, open, low, low_time, ltp, hikePct, targetPct };

//     // first-to-hit (per index + CE/PE)
//     const maxLvl = Math.min(targetPct, Math.floor(hikePct / 5) * 5);
//     for (const lvl of makeLevels(maxLvl)) {
//       if (!firstHit[meta.name][meta.type][lvl]) {
//         firstHit[meta.name][meta.type][lvl] = { tsym: meta.tsym, time: now };
//         onFirstHit &&
//           onFirstHit({
//             index: meta.name,
//             type: meta.type,
//             level: lvl,
//             tsym: meta.tsym,
//             time: now,
//           });
//       }
//     }

//     if (hikePct >= targetPct) {
//       achieved.set(meta.token, { ...row, target_time: now });
//       active.delete(meta.token);
//       logger.info(`ACHIEVED ${meta.tsym} ${meta.name} >=${targetPct}%`);
//       return { kind: "achieved", row: achieved.get(meta.token) };
//     }

//     active.set(meta.token, row);
//     return { kind: "active", row };
//   }

//   return {
//     active,
//     achieved,
//     firstHit,
//     reset,
//     resume,
//     pause,
//     upsert,
//     getPaused: () => paused,
//   };
// }

// module.exports = { createStore };

const { nowIST } = require("./ist");
const { logger } = require("./logger");

function makeLevels(max) {
  const a = [];
  for (let i = 5; i <= max; i += 5) a.push(i);
  return a;
}

function isNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function createStore(cfg) {
  const active = new Map();
  const achieved = new Map();

  const firstHit = {
    NIFTY: { CE: {}, PE: {} },
    SENSEX: { CE: {}, PE: {} },
  };

  let paused = true;

  function reset() {
    active.clear();
    achieved.clear();
    firstHit.NIFTY.CE = {};
    firstHit.NIFTY.PE = {};
    firstHit.SENSEX.CE = {};
    firstHit.SENSEX.PE = {};
    paused = true;
  }

  function resume() {
    paused = false;
  }
  function pause() {
    paused = true;
  }

  function upsert(meta, tick, onFirstHit) {
    if (paused) return;
    if (achieved.has(meta.token)) return;

    const open = tick?.ohlc?.open;
    const ltp = tick?.last_price;

    // ✅ strict validation: allow only real positive prices
    if (!isNum(open) || !isNum(ltp)) return;
    if (open <= 0 || ltp <= 0) return;

    const lowTick = tick?.ohlc?.low;
    const prev = active.get(meta.token) || { ...meta, open, low: Infinity };

    const now = nowIST();

    // low candidate: prefer lowTick if valid else use ltp
    const lowCandidate = isNum(lowTick) && lowTick > 0 ? lowTick : ltp;

    const low = Math.min(prev.low, lowCandidate, ltp);
    const low_time = low < prev.low ? now : prev.low_time;

    // avoid divide-by-zero
    if (!isNum(low) || low <= 0) return;

    const hikePct = ((ltp - low) / low) * 100;
    const targetPct = cfg.targets[meta.name];

    const row = {
      ...prev,
      open,
      low,
      low_time,
      ltp,
      hikePct,
      targetPct,
    };

    // ✅ first-to-hit levels
    const maxLvl = Math.min(targetPct, Math.floor(hikePct / 5) * 5);
    for (const lvl of makeLevels(maxLvl)) {
      if (!firstHit[meta.name][meta.type][lvl]) {
        firstHit[meta.name][meta.type][lvl] = { tsym: meta.tsym, time: now };
        if (onFirstHit) {
          onFirstHit({
            index: meta.name,
            type: meta.type,
            level: lvl,
            tsym: meta.tsym,
            time: now,
          });
        }
      }
    }

    // ✅ achieved lock
    if (hikePct >= targetPct) {
      const done = { ...row, target_time: now };
      achieved.set(meta.token, done);
      active.delete(meta.token);
      logger.info(`ACHIEVED ${meta.tsym} ${meta.name} >=${targetPct}%`);
      return { kind: "achieved", row: done };
    }

    active.set(meta.token, row);
    return { kind: "active", row };
  }

  return {
    active,
    achieved,
    firstHit,
    reset,
    resume,
    pause,
    upsert,
    getPaused: () => paused,
  };
}

module.exports = { createStore };
