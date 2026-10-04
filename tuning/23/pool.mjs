// #23: two state files of the same variant (the two seed batches) added together and judged as one
// 2,000-game sample, for the ablation rows whose 1,000-game difference is within the noise.
//   node tuning/23/pool.mjs <a.state.json> <b.state.json> [cell]
import { readFileSync } from "node:fs";
import { judge } from "../../tests/targets.mjs";

const add = (a, b) => {
  if (a == null) return b;
  if (b == null) return a;
  if (typeof a === "number") return a + b;
  if (Array.isArray(a)) return a.map((x, i) => add(x, b[i]));
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = add(a[k], b[k]);
  return out;
};
const [fa, fb, cell = "full"] = process.argv.slice(2);
const A = JSON.parse(readFileSync(fa, "utf8")), B = JSON.parse(readFileSync(fb, "utf8"));
// Round five: compared with the keys sorted. P8 lost a part that changed nothing (L-mfrom7, overwritten by
// L-mfromK6) while its runs were going, so the same options can be written in a different key order.
const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
if (JSON.stringify(canon(A.meta.variantOptions ?? null)) !== JSON.stringify(canon(B.meta.variantOptions ?? null))) throw new Error("the two files are not the same variant");
const s = add(A.cells[cell].sum, B.cells[cell].sum), g = s.games;
const r = judge(s, A.meta).filter((x) => !x.info);
const m = [1, 2, 3, 4, 5, 6, 7, 8].map((t) => (s.mandateByTurn[t] ? (s.mandateByTurn[t].sum / s.mandateByTurn[t].n).toFixed(2) : "–")).join(" ");
console.log(`POOL ${A.meta.variant || "–"} ${g} 局:${r.map((x) => (x.pass ? "過" : "×")).join("")} 通過 ${r.filter((x) => x.pass).length} / ${r.length};共軍勝 ${(100 * s.wins[0] / g).toFixed(1)}%;民心結束 ${(100 * (s.reasons.mandate || 0) / g).toFixed(1)}%;第 4 回合前整編 ${(100 * s.sealsBefore4 / g).toFixed(1)}%;易幟 / 共軍勝 ${(100 * (s.reasons.unification || 0) / s.wins[0]).toFixed(1)}%;民心 ${m}${s.winsBySide ? (() => { const k = s.winsBySide[1], n = Object.values(k.reasons).reduce((a, b) => a + b, 0), r = Object.entries(k.reasons).sort((a, b) => b[1] - a[1])[0], t = Object.entries(k.turns).sort((a, b) => b[1] - a[1])[0]; return `;國軍 ${r[0]} ${(100 * r[1] / n).toFixed(1)}%、第 ${t[0]} 回合 ${(100 * t[1] / n).toFixed(1)}%`; })() : ""}${s.aheadByTurn ? `;共軍領先 / 國軍領先 ${[4, 5, 6, 7, 8].map((t) => `${(100 * s.aheadByTurn[t].ccp / g).toFixed(1)}/${(100 * s.aheadByTurn[t].kmt / g).toFixed(1)}`).join(" ")}` : ""}`);
