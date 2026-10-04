// #23 round five: the ablation table. Each state file is judged by tests/targets.mjs and set against the first
// one (the proposal): the items that change, and the numbers behind them.
//   node tuning/23/ablate.mjs <proposal state file> <ablation state file> ...
import { readFileSync } from "node:fs";
import { judge } from "../../tests/targets.mjs";

const pct = (k, n) => (n ? (100 * k / n).toFixed(1) + "%" : "–");
function row(file) {
  const st = JSON.parse(readFileSync(file, "utf8")), s = st.cells.full.sum, g = s.games;
  const items = judge(s, st.meta || {}).filter((x) => !x.info);
  const A = s.aheadByTurn, lead = [4, 5, 6, 7, 8].map((t) => `${Math.round(100 * A[t].ccp / g)}/${Math.round(100 * A[t].kmt / g)}`).join(" ");
  const top = Object.entries(s.reasons).sort((a, b) => b[1] - a[1])[0];
  const k = s.winsBySide[1], kn = Object.values(k.reasons).reduce((a, b) => a + b, 0);
  const kr = Object.entries(k.reasons).sort((a, b) => b[1] - a[1])[0], kt = Object.entries(k.turns).sort((a, b) => b[1] - a[1])[0];
  const e7 = Object.entries(s.endTurns).filter(([t]) => Number(t) >= 7).reduce((a, [, x]) => a + x, 0);
  return {
    name: `${st.meta.variant} ${st.meta.seed}–${st.meta.seed + st.meta.games - 1}`, items,
    text: `共軍勝 ${pct(s.wins[0], g)};共軍領先 / 國軍領先 第 4–8 回合 ${lead}%;最多的結束 ${top[0]} ${pct(top[1], g)};整編在第 4 回合前 ${pct(s.sealsBefore4, g)};易幟 / 共軍勝 ${pct(s.reasons.unification || 0, s.wins[0])};第 7 回合以後結束 ${pct(e7, g)};國軍 ${kr[0]} ${pct(kr[1], kn)}、第 ${kt[0]} 回合 ${pct(kt[1], kn)}`,
  };
}
const [base, ...rest] = process.argv.slice(2).map(row);
console.log(`${base.name}:${base.items.filter((x) => x.pass).length} / ${base.items.length};${base.text}`);
for (const r of rest) {
  const lost = r.items.filter((x, i) => base.items[i].pass && !x.pass).map((x) => x.key), won = r.items.filter((x, i) => !base.items[i].pass && x.pass).map((x) => x.key);
  console.log(`${r.name}:${r.items.filter((x) => x.pass).length} / ${r.items.length};變失敗 ${lost.join("、") || "無"}${won.length ? `;變通過 ${won.join("、")}` : ""};${r.text}`);
}
