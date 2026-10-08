// #37: E's own goals (brief #37, 三) and the ten targets, read from tests/sim.js state files (and the
// tests/targets.mjs output next to each, <state>.targets.txt, when there is one). Nothing is copied by hand.
//   node tuning/37/goals.mjs <name>=<a.state.json> [<name>=<b.state.json> …]
// One block per batch, then one summary row each:
//   G1 ten targets ≥ 8 with the 民心 curve passing, and the Communists 35–65%
//   G2 印鈔 a trade-off: the median inflation at the end of turn 3 ≤ 5, and of the games whose inflation reached 8,
//      most (> 50%) reached it at turn 5 or later (the note: inflation broke the Nationalists in 1948)
//   G3 both tracks used: 印鈔 ≥ 2 and 激進 ≥ 1 a game (means)
//   G4 report only: collapses (通膨), the centrists (end, 結算), 還鄉團
// The turn inflation first reached 8 is read from ePerGame.reach (#37's sim); a state file from before #37
// (no `reach`) falls back on the threshold "inflation:8", which is the level 8 only with today's thresholds.
import { readFileSync, existsSync } from "node:fs";

const pct = (k, n) => (n ? (100 * k) / n : NaN);
const f1 = (x) => (Number.isFinite(x) ? `${x.toFixed(1)}%` : "–");
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "–");
const total = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
export const dist = (o) => Object.entries(o || {}).sort((a, b) => (a[0] === "none") - (b[0] === "none") || Number(a[0]) - Number(b[0])).map(([k, v]) => `${k}:${v}`).join(" ");
// The median of a { value: count } distribution (the lower median for an even count).
function median(o) {
  const e = Object.entries(o || {}).map(([k, v]) => [Number(k), v]).sort((a, b) => a[0] - b[0]);
  const n = e.reduce((a, [, v]) => a + v, 0);
  if (!n) return NaN;
  let seen = 0;
  for (const [k, v] of e) { seen += v; if (seen >= Math.ceil(n / 2)) return k; }
  return NaN;
}
export function readBatch(name, file) {
  const state = JSON.parse(readFileSync(file, "utf8"));
  const cell = state.cells.full, sum = cell.sum, more = cell.more || {}, e = more.e || {}, per = more.ePerGame || {};
  const n = sum.games, errors = (cell.errors || []).length;
  const tfile = `${file}.targets.txt`, tlines = existsSync(tfile) ? readFileSync(tfile, "utf8").split(/\r?\n/) : [];
  const tline = tlines.find((l) => l.startsWith("TARGETS")) || null;
  const targets = tline ? Number((tline.match(/通過 (\d+) \/ 10/) || [])[1]) : null;
  // targets.mjs prints one line per target: "通過 · 民心曲線(…) · <reading>" or "失敗 · …".
  const curve = tlines.find((l) => /^(通過|失敗) · 民心曲線/.test(l)) || "";
  const curvePass = curve.startsWith("通過");
  const ccp = pct(sum.wins[0], n);
  const at3 = ((e.atTurnEnd || {})[3] || {}).inflation || {};
  let reach8, source;
  if (per.reach) { reach8 = per.reach[8] || {}; source = "reach"; } else { reach8 = (e.threshold || {})["inflation:8"] || {}; source = "threshold inflation:8"; }
  const reached = Object.entries(reach8).filter(([k]) => k !== "none").reduce((a, [, v]) => a + v, 0);
  const late = Object.entries(reach8).filter(([k]) => k !== "none" && Number(k) >= 5).reduce((a, [, v]) => a + v, 0);
  const g2med = median(at3), g2late = pct(late, reached);
  const prints = (e.print || 0) / n, radicals = (e.radical || 0) / n, pegs = (e.peg || 0) / n;
  return {
    name, file, n, errors, ccp, targets, tline, curve: curve.trim(), curvePass, reasons: sum.reasons, endTurns: sum.endTurns,
    at3, g2med, reach8, reach: per.reach || null, reached, late, g2late, source, prints, radicals, pegs,
    collapse: e.collapse || 0, settleToCcp: e.settleToCcp || 0, settleToKmt: e.settleToKmt || 0, centristsMoved: e.centristsMoved || {},
    endC: (e.end || {}).centrists || {}, endI: (e.end || {}).inflation || {}, endL: (e.end || {}).leftism || {},
    returnHome: e.returnHome || {}, perPrint: per.print || {}, perRadical: per.radical || {}, perPeg: per.peg || {},
    threshold: e.threshold || {}, byTurn: e.byTurn || {}, atTurnEnd: e.atTurnEnd || {},
    pass: {
      g1: targets != null && targets >= 8 && curvePass && ccp >= 35 && ccp <= 65,
      g2: g2med <= 5 && (reached === 0 || g2late > 50),
      g3: prints >= 2 && radicals >= 1,
    },
  };
}
const yn = (b) => (b ? "過" : "不過");
export function block(b) {
  const L = [];
  L.push(`## ${b.name}  (${b.file})`);
  L.push(`局數 ${b.n},出錯 ${b.errors};共軍勝 ${f1(b.ccp)};${b.tline || "TARGETS (沒有 targets 檔)"}`);
  L.push(`   ${b.curve ? b.curve.split(" · ").filter((x, i) => i !== 1).join(" · ") : "民心曲線:(沒有 targets 檔)"}`);
  L.push(`結束方式 ${Object.entries(b.reasons).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${f1(pct(v, b.n))}`).join("、")}`);
  L.push(`G1 十項 ${b.targets ?? "?"} / 10、民心曲線 ${b.curvePass ? "通過" : "失敗"}、共軍 ${f1(b.ccp)}(≥ 8 含曲線、35–65%:${yn(b.pass.g1)})`);
  L.push(`G2 第 3 回合末通膨的中位數 ${b.g2med}(分佈 ${dist(b.at3)});通膨到 8 的 ${b.reached} 局(${f1(pct(b.reached, b.n))})裡第 5 回合以後到的 ${b.late}(${f1(b.g2late)})(讀 ${b.source})(中位 ≤ 5 且過半:${yn(b.pass.g2)})`);
  L.push(`   通膨第一次到 8 的回合 ${dist(b.reach8)}`);
  if (b.reach) L.push(`   通膨第一次到 n 的回合:${[3, 4, 5, 6, 7].map((n) => `${n} [${dist(b.reach[n])}]`).join(";")}`);
  L.push(`G3 每局 印鈔 ${f2(b.prints)}、激進 ${f2(b.radicals)}、平抑 ${f2(b.pegs)}(印鈔 ≥ 2、激進 ≥ 1:${yn(b.pass.g3)})`);
  L.push(`   每局印鈔次數 ${dist(b.perPrint)}`);
  L.push(`   每局激進次數 ${dist(b.perRadical)}`);
  L.push(`G4 通膨崩潰 ${b.collapse} 局;局末通膨 ${dist(b.endI)};局末左傾 ${dist(b.endL)}`);
  L.push(`   中間派:局末 ${dist(b.endC)};結算給共軍 ${b.settleToCcp}、給國軍 ${b.settleToKmt} 民心;被推動的格數 ${Object.entries(b.centristsMoved).map(([k, v]) => `${k} ${v}`).join("、")}`);
  L.push(`   還鄉團的藍 ${Object.entries(b.returnHome).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join("、")}`);
  L.push(`   門檻(回合:次數) ${Object.entries(b.threshold).map(([k, v]) => `${k} [${dist(v)}]`).join(";")}`);
  L.push(`   每回合 印鈔/平抑/激進 ${Object.entries(b.byTurn).map(([t, v]) => `${t}:${v.print || 0}/${v.peg || 0}/${v.radical || 0}`).join(" ")}`);
  return L.join("\n");
}
export function row(b) {
  const tick = (x) => (x ? "OK" : "--");
  return `${b.name.padEnd(30)} 共軍 ${f1(b.ccp).padStart(6)}  十項 ${String(b.targets ?? "?").padStart(2)}${b.curvePass ? "(曲線過)" : "(曲線不過)"}  G2 中位 ${String(b.g2med).padStart(2)} 到8 ${f1(pct(b.reached, b.n)).padStart(6)} 第5回合後 ${f1(b.g2late).padStart(6)}  G3 印 ${f2(b.prints)} 激 ${f2(b.radicals)}  崩 ${b.collapse}  [${tick(b.pass.g1)} ${tick(b.pass.g2)} ${tick(b.pass.g3)}]`;
}
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/").replace(/^\//, "")}` || process.argv[1].endsWith("goals.mjs")) {
  const batches = process.argv.slice(2).map((a) => { const i = a.indexOf("="); return readBatch(a.slice(0, i), a.slice(i + 1)); });
  for (const b of batches) console.log(block(b) + "\n");
  console.log("== 摘要 [G1 G2 G3]");
  for (const b of batches) console.log(row(b));
}
