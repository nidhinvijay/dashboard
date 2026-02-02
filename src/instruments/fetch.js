const { parse } = require("csv-parse/sync");
const { logger } = require("../logger");

async function fetchInstruments() {
  const url = "https://api.kite.trade/instruments";
  logger.info(`Fetching instruments: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Instruments fetch failed: ${res.status}`);
  const csv = await res.text();
  logger.info(`Instruments downloaded (${csv.length} chars)`);
  const rows = parse(csv, { columns: true, skip_empty_lines: true });
  logger.info(`Instruments parsed: ${rows.length} rows`);
  return rows;
}

module.exports = { fetchInstruments };
