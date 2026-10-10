// #40: adds up the GAINS lines of tuning/40/probe-gains.mjs.   node tuning/40/agg-gains.cjs <file> [<file> …]
const fs = require("fs");
let asks = [], hand = [], mt = {}, ch = {}, g = 0;
for (const f of process.argv.slice(2)) {
  const t = fs.readFileSync(f, "utf8"), m = t.match(/GAINS (.*)/);
  if (!m) { console.log("no GAINS line in", f, t.slice(0, 300)); continue; }
  const o = JSON.parse(m[1]);
  g += o.games; asks.push(...o.asks); hand.push(...o.handovers);
  for (const k in o.markerTurns) { mt[k] = (mt[k] || 0) + o.markerTurns[k]; ch[k] = (ch[k] || 0) + o.chances[k]; }
}
console.log("games", g, "real-marker turns", JSON.stringify(mt), "questions with a real one there", JSON.stringify(ch), "questions", asks.length, "action rounds with a 和平易手", hand.length);
const by = {};
for (const x of asks) (by[`${x.tag}/${x.klass}`] ||= []).push(x.raw);
for (const x of hand) (by[`handover/points ${x.points}`] ||= []).push(x.raw);
for (const [k, v] of Object.entries(by)) {
  v.sort((a, b) => a - b);
  console.log(k, "n", v.length, "gain > 0:", v.filter((x) => x > 0.01).length, "mean", (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2), "values", v.map((x) => x.toFixed(1)).join(" "));
}
