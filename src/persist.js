const fs = require("fs");
const path = require("path");
const { dateIST } = require("./ist");

function dataDir() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  return dir;
}

function statePath() {
  return path.join(dataDir(), `state_${dateIST()}.json`);
}
function ticksPath() {
  return path.join(dataDir(), `ticks_${dateIST()}.ndjson`);
}

function saveState(obj) {
  fs.writeFileSync(statePath(), JSON.stringify(obj));
}
function loadState() {
  return fs.existsSync(statePath())
    ? JSON.parse(fs.readFileSync(statePath(), "utf8"))
    : null;
}

function appendTick(rec) {
  fs.appendFileSync(ticksPath(), JSON.stringify(rec) + "\n");
}

module.exports = { saveState, loadState, appendTick };
