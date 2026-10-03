// #23: the report's tables, read from the state files in tuning/23/runs/ and judged by
// tests/targets.mjs (the orchestrator's reading of the eight targets, imported, not copied).
//   node tuning/23/summary.mjs <state file>[:<cell>] ...
// One row per file (and cell): the eight targets pass / fail, then the numbers behind them.
import { readFileSync } from "node:fs";
import { judge } from "../../tests/targets.mjs";

const p = (k, n) => (n ? (100 * k / n).toFixed(1) + "%" : "–");
const rows = [];
for (const arg of process.argv.slice(2)) {
  const [file, cellArg] = arg.split(":");
  const st = JSON.parse(readFileSync(file, "utf8"));
  for (const cell of cellArg ? [cellArg] : Object.keys(st.cells)) {
    const s = st.cells[cell].sum, g = s.games, r = judge(s);
    let e = 0, l = 0, t4 = 0;
    for (const d of Object.values(s.firstIsolated)) for (const [t, k] of Object.entries(d)) { if (Number(t) <= 4) e += k; else l += k; if (Number(t) >= 4) t4 += k; }
    const m = [1, 2, 3, 4, 5, 6, 7, 8].map((t) => { const o = s.mandateByTurn[t]; return o ? `${(o.sum / o.n).toFixed(1)}` : "–"; }).join(" ");
    const n = [1, 2, 3, 4, 5, 6, 7, 8].map((t) => (s.mandateByTurn[t] ? s.mandateByTurn[t].n : 0)).join(" ");
    const reasons = Object.entries(s.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${p(v, g)}`).join("、");
    rows.push({
      name: `${(st.meta.variant || "–")}/${cell} 種子 ${st.meta.seed}–${st.meta.seed + st.meta.games - 1}${st.meta.ccp !== "normal" ? `(${st.meta.ccp} 對 ${st.meta.kmt})` : ""}`,
      marks: r.map((x) => (x.pass ? "過" : "×")).join(""),
      pass: r.filter((x) => x.pass).length,
      stop: r.filter((x) => x.key === "mandate" || x.key === "isolation").every((x) => x.pass) ? "過" : "×",
      g, ccp: p(s.wins[0], g), ali4: p(s.sealsBefore4, g), late: p(l, e + l), late4: p(t4, e + l), unif: p(s.reasons.unification || 0, s.wins[0]), reasons, m, n,
    });
  }
}
console.log("| 變體 / cell | 局數 | 八項(民心、勝率、結束、易幟、孤城時間、孤城數、遷都、支持度) | 通過 | 停損兩項 | 共軍勝 | 整編在第 4 回合前 | 第一次孤城在第 5 回合以後(在第 4 回合以後) | 易幟 / 共軍勝 | 民心第 1–8 回合末 | 打到該回合末的局數 | 結束方式 |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const x of rows) console.log(`| ${x.name} | ${x.g} | ${x.marks} | ${x.pass} / 8 | ${x.stop} | ${x.ccp} | ${x.ali4} | ${x.late}(${x.late4}) | ${x.unif} | ${x.m} | ${x.n} | ${x.reasons} |`);
