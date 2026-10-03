// #23: the report's tables, read from the state files in tuning/23/runs/ and judged by
// tests/targets.mjs (the orchestrator's reading of the eight targets, imported, not copied).
//   node tuning/23/summary.mjs <state file>[:<cell>] ...
// One row per file (and cell): the eight targets pass / fail, then the numbers behind them.
import { readFileSync } from "node:fs";
import { judge } from "../../tests/targets.mjs";

const p = (k, n) => (n ? (100 * k / n).toFixed(1) + "%" : "–");
const rows = [];
for (const arg of process.argv.slice(2)) {
  const [, file, cellArg] = /^(.*\.json)(?::(\w+))?$/.exec(arg); // a Windows path has its own colon
  const st = JSON.parse(readFileSync(file, "utf8"));
  for (const cell of cellArg ? [cellArg] : Object.keys(st.cells)) {
    // #23 second round: judge reads the variant's own support script from the meta, and returns 只看
    // items (`info`) that do not count.
    const s = st.cells[cell].sum, g = s.games, r = judge(s, st.meta || {}).filter((x) => !x.info);
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
      total: r.length, end7: p(Object.entries(s.endTurns).filter(([t]) => Number(t) >= 7).reduce((a, [, k]) => a + k, 0), g),
      g, ccp: p(s.wins[0], g), ali4: p(s.sealsBefore4, g), late: p(l, e + l), late4: p(t4, e + l), zero: (Object.values(s.firstIsolated).reduce((a, d) => a + (d["0"] || 0), 0) / g).toFixed(2), unif: p(s.reasons.unification || 0, s.wins[0]), reasons, m, n,
    });
  }
}
// #23 round three: the items are as many as targets.mjs judges (nine since main 568ec06); the 只看
// isolation reading gave its column to 「第 7 回合以後結束」 (item 9's number).
console.log("| 變體 / cell | 局數 | 各項(民心、勝率、結束、易幟、開局孤城、孤城數、遷都、支持度、打到決戰期) | 通過 | 停損兩項 | 共軍勝 | 整編在第 4 回合前 | 開局孤城(每局) | 第 7 回合以後結束 | 易幟 / 共軍勝 | 民心第 1–8 回合末 | 打到該回合末的局數 | 結束方式 |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const x of rows) console.log(`| ${x.name} | ${x.g} | ${x.marks} | ${x.pass} / ${x.total} | ${x.stop} | ${x.ccp} | ${x.ali4} | ${x.zero} | ${x.end7} | ${x.unif} | ${x.m} | ${x.n} | ${x.reasons} |`);
