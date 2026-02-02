// const { logger } = require("../logger");

// function pickImmediateExpiries(rows, underlyings) {
//   const byU = Object.fromEntries(underlyings.map((u) => [u, []]));
//   rows.forEach((r) => (byU[r.name] ? byU[r.name].push(r.expiry) : null));
//   const toDate = (s) => new Date(s).getTime();
//   const pick = (u) =>
//     [...new Set(byU[u])].sort((a, b) => toDate(a) - toDate(b))[0];
//   const expiries = Object.fromEntries(underlyings.map((u) => [u, pick(u)]));
//   logger.info(`Immediate expiries: ${JSON.stringify(expiries)}`);
//   return expiries;
// }

// function filterOptionTokens(rows, expiries) {
//   const ok = (r) =>
//     r.segment === "NFO-OPT" &&
//     expiries[r.name] === r.expiry &&
//     (r.instrument_type === "CE" || r.instrument_type === "PE");
//   const picked = rows.filter(ok).map((r) => ({
//     token: Number(r.instrument_token),
//     tsym: r.tradingsymbol,
//     name: r.name,
//     type: r.instrument_type,
//     expiry: r.expiry,
//   }));
//   logger.info(`Filtered tokens: ${picked.length}`);
//   return picked;
// }

// module.exports = { pickImmediateExpiries, filterOptionTokens };

const { logger } = require("../logger");

function pickImmediateExpiries(rows, underlyings) {
  const byU = Object.fromEntries(underlyings.map((u) => [u, []]));
  rows.forEach((r) => (byU[r.name] ? byU[r.name].push(r.expiry) : null));
  const toT = (s) => new Date(s).getTime();
  const pick = (u) => [...new Set(byU[u])].sort((a, b) => toT(a) - toT(b))[0];
  const expiries = Object.fromEntries(underlyings.map((u) => [u, pick(u)]));
  logger.info(`Immediate expiries: ${JSON.stringify(expiries)}`);
  return expiries;
}

function filterOptionTokens(rows, expiries) {
  const segOk = (s) => s === "NFO-OPT" || s === "BFO-OPT"; // NIFTY vs SENSEX
  const ok = (r) =>
    segOk(r.segment) &&
    expiries[r.name] === r.expiry &&
    (r.instrument_type === "CE" || r.instrument_type === "PE");

  const picked = rows.filter(ok).map((r) => ({
    token: Number(r.instrument_token),
    tsym: r.tradingsymbol,
    name: r.name,
    type: r.instrument_type,
    expiry: r.expiry,
    segment: r.segment,
  }));

  const counts = picked.reduce(
    (a, x) => ((a[x.name] = (a[x.name] || 0) + 1), a),
    {},
  );
  logger.info(
    `Filtered tokens: ${picked.length} byName=${JSON.stringify(counts)}`,
  );
  return picked;
}

module.exports = { pickImmediateExpiries, filterOptionTokens };
