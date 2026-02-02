function levels(step, max) {
  const out = [];
  for (let i = step; i <= max; i += step) out.push(i);
  return out;
}

module.exports = { levels };
