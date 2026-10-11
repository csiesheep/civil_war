// #40: adds up the PURGE lines of tuning/40/probe-purge.mjs.   node tuning/40/agg-purge.cjs <file> [<file> …]
const fs = require("fs");
let rows = [], chosen = 0, games = 0;
for (const f of process.argv.slice(2)) {
  const m = fs.readFileSync(f, "utf8").match(/PURGE (.*)/);
  if (!m) { console.log("no PURGE line in", f); continue; }
  const o = JSON.parse(m[1]); rows.push(...o.rounds); chosen += o.chosen; games += o.games;
}
console.log(`games ${games}; action rounds of the Nationalists with a 肅諜 legal ${rows.length}, in ${new Set(rows.map((r) => r.seed)).size} games; chosen ${chosen}`);
const byT = {};
for (const r of rows) { const t = (byT[r.turn] ||= { n: 0, pos: 0, gaps: [], chosen: 0 }); t.n++; if (r.gap > 0) t.pos++; t.gaps.push(r.gap); if (r.chosen) t.chosen++; }
for (const [t, o] of Object.entries(byT)) {
  o.gaps.sort((a, b) => a - b);
  console.log(`turn ${t}: rounds ${o.n}, best 肅諜 above the best other play ${o.pos}, chosen ${o.chosen}, gap median ${o.gaps[o.gaps.length >> 1].toFixed(1)}, max ${o.gaps[o.gaps.length - 1].toFixed(2)}`);
}
const named = {};
for (const r of rows) for (const id of new Set(r.named)) named[id] = (named[id] || 0) + 1;
console.log("cities in the best 肅諜's list (rounds):", JSON.stringify(named));
const ps = rows.map((r) => r.p[0]).sort((a, b) => a - b);
if (ps.length) console.log(`belief of the first city named: min ${ps[0]}, median ${ps[ps.length >> 1]}, max ${ps[ps.length - 1]}`);
