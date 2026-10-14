// #42: a few readings of tests/sim.js state files, one line each (for tuning/42/report.txt): the options, the
// games, the wins by side, and under C the 民心 from real markers at 結算, 洩密, 肅諜 (plays, real, fake, 抓錯).
//   node tuning/42/brief-read.mjs <a.state.json> [<b.state.json> …]
import { readFileSync } from "node:fs";

for (const f of process.argv.slice(2)) {
  const s = JSON.parse(readFileSync(f, "utf8")), c = s.cells.full, g = c.sum.games;
  const w = c.sum.winsBySide || {}, n = (x) => (x && x.reasons ? Object.values(x.reasons).reduce((t, v) => t + v, 0) : x);
  const C = c.more && c.more.c;
  const pct = (x) => (typeof x === "number" ? `${((100 * x) / g).toFixed(1)}%` : "?");
  const ccp = n(w[0] ?? w.ccp), kmt = n(w[1] ?? w.kmt);
  const tail = C ? ` 民心(結算) ${C.mandate ?? "-"} (${((C.mandate ?? 0) / g).toFixed(2)}/局) 洩密 ${C.leak} (${(C.leak / g).toFixed(2)}/局) 肅諜 ${C.purge.plays} (${(C.purge.plays / g).toFixed(2)}/局; 真 ${C.purge.real} 假 ${C.purge.fake} 抓錯 ${C.purge.caught})` : "";
  console.log(`${f.split("/").pop()} ${JSON.stringify(s.meta.variantOptions || {})} 局 ${g} 共軍勝 ${ccp} (${pct(ccp)}) 國軍勝 ${kmt} (${pct(kmt)}) errors ${(c.errors || []).length}${tail}`);
}
