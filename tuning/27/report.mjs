// #27: the numbers of tuning/27/report.txt, from the six state files of tuning/27/runall.sh.
//   node tuning/27/report.mjs > tuning/27/tables.txt
// Every number is read from tuning/27/runs/<off|B>-s<seed>.txt.state.json: `cells.full.sum` (tests/sim.js's
// pinned sums), `cells.full.more` (#27's numbers of mechanism B and of the 孤城 per game), `ms`. The ten
// targets are tests/targets.mjs's own `judge` on each sum. B off is also compared with #24's runs of the
// same seeds (tuning/24/runs/default-s<seed>.txt.state.json), keys sorted, `ms` and `done` left out.
import { readFileSync, existsSync } from "node:fs";
import { judge } from "../../tests/targets.mjs";

const SEEDS = [1, 20001, 40001], VS = ["off", "B"];
const runs = [];
for (const v of VS) for (const seed of SEEDS) {
  const path = `tuning/27/runs/${v}-s${seed}.txt.state.json`;
  if (!existsSync(path)) { console.log(`(missing ${path})`); continue; }
  const st = JSON.parse(readFileSync(path, "utf8"));
  runs.push({ v, seed, name: `${v === "off" ? "B 關" : "B 開"} s${seed}`, meta: st.meta, c: st.cells.full });
}
const Z = 1.96;
const wilson = (k, n) => { if (!n) return [NaN, NaN]; const p = k / n, d = 1 + Z * Z / n, c = (p + Z * Z / (2 * n)) / d, h = (Z / d) * Math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n)); return [Math.max(0, c - h), Math.min(1, c + h)]; };
const pc = (k, n) => (n ? `${(100 * k / n).toFixed(1)}%` : "–");
const rate = (k, n) => { if (!n) return "–"; const [lo, hi] = wilson(k, n); return `${pc(k, n)} [${(100 * lo).toFixed(1)}, ${(100 * hi).toFixed(1)}]`; };
const tot = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
const keysOf = (...os) => [...new Set(os.flatMap((o) => Object.keys(o || {})))].sort((a, b) => (isNaN(a) || isNaN(b) ? String(a).localeCompare(String(b)) : a - b));
const pad = (s, n) => { s = String(s); let w = 0; for (const ch of s) w += ch.charCodeAt(0) > 0x2e80 ? 2 : 1; return s + " ".repeat(Math.max(0, n - w)); };
function table(head, rows, widths) {
  const W = widths || head.map((h, i) => Math.max(...[h, ...rows.map((r) => r[i])].map((x) => { let w = 0; for (const ch of String(x)) w += ch.charCodeAt(0) > 0x2e80 ? 2 : 1; return w; })));
  const line = (r) => r.map((x, i) => pad(x, W[i])).join(" | ");
  return [line(head), W.map((w) => "-".repeat(w)).join("-|-"), ...rows.map(line)].join("\n");
}
const out = [];
const P = (...x) => out.push(...x);
const names = runs.map((r) => r.name);

// ---------------------------------------------------------------- 0. what was run
P("== 0. 六批", "");
P(table(["批", "局數", "出錯", "變體", "每局秒數(ms / 局)"], runs.map((r) => [r.name, r.c.sum.games, r.c.errors.length, r.meta.variant ? `${r.meta.variant} ${JSON.stringify(r.meta.variantOptions)}` : "(預設)", (r.c.ms / 1000 / (r.c.sum.games + r.c.errors.length)).toFixed(2)])));
P("");
const sorted = (x) => (Array.isArray(x) ? x.map(sorted) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sorted(x[k])])) : x);
for (const r of runs.filter((x) => x.v === "off")) {
  const p24 = `tuning/24/runs/default-s${r.seed}.txt.state.json`;
  if (!existsSync(p24)) { P(`B 關 s${r.seed} 對 #24:沒有 ${p24}`); continue; }
  const old = JSON.parse(readFileSync(p24, "utf8")).cells.full;
  const same = JSON.stringify(sorted(old.sum)) === JSON.stringify(sorted(r.c.sum));
  P(`B 關 s${r.seed} 的 cells.full.sum 對 ${p24}(鍵排序後):${same ? "一模一樣" : "不同"};errors ${old.errors.length} / ${r.c.errors.length}`);
}
P("");

// ---------------------------------------------------------------- 1. ten targets
P("== 1. 十項目標(tests/targets.mjs 的 judge,逐批)", "");
const J = runs.map((r) => judge(r.c.sum, r.meta).filter((x) => !x.info));
const items = J[0].map((x) => x.name);
P(table(["目標", ...names], items.map((name, i) => [name.length > 40 ? name.slice(0, 40) + "…" : name, ...J.map((j) => (j[i] ? (j[i].pass ? "通過" : "失敗") : "–"))])));
P("", table(["", ...names], [["通過項數", ...J.map((j) => `${j.filter((x) => x.pass).length} / ${j.length}`)]]), "");
P("每一項 judge 說的(逐批):");
items.forEach((name, i) => { P(`  ${name}`); runs.forEach((r, k) => P(`    ${pad(r.name, 12)} ${J[k][i] ? (J[k][i].pass ? "通過" : "失敗") : "–"} · ${J[k][i] ? J[k][i].said : ""}`)); });
P("");

// ---------------------------------------------------------------- 2. win, end reason, end turn
P("== 2. 共軍勝率、結束方式、結束回合", "");
P(table(["", ...names], [["共軍勝 [95%]", ...runs.map((r) => rate(r.c.sum.wins[0], r.c.sum.games))]]), "");
const reasons = keysOf(...runs.map((r) => r.c.sum.reasons));
P(table(["結束方式", ...names], reasons.map((k) => [k, ...runs.map((r) => pc(r.c.sum.reasons[k] || 0, r.c.sum.games))])), "");
const turns = keysOf(...runs.map((r) => r.c.sum.endTurns));
P(table(["結束回合", ...names], turns.map((t) => [`第 ${t} 回合`, ...runs.map((r) => pc(r.c.sum.endTurns[t] || 0, r.c.sum.games))])), "");
const pooled = (v, f) => { const rs = runs.filter((r) => r.v === v); return f(rs); };
for (const v of VS) {
  const rs = runs.filter((r) => r.v === v), g = rs.reduce((a, r) => a + r.c.sum.games, 0), w = rs.reduce((a, r) => a + r.c.sum.wins[0], 0);
  P(`${v === "off" ? "B 關" : "B 開"} 三批合計:共軍勝 ${w} / ${g} = ${rate(w, g)};三批的差 ${Math.min(...rs.map((r) => r.c.sum.wins[0]))}..${Math.max(...rs.map((r) => r.c.sum.wins[0]))} 勝 / 1000`);
}
P("");

// ---------------------------------------------------------------- 3. mechanism B
const Bs = runs.filter((r) => r.v === "B");
const sumMore = (rs) => rs.reduce((a, r) => addSums(a, r.c.more), null);
function addSums(a, b) {
  if (a == null) return b; if (b == null) return a;
  if (typeof a === "number" && typeof b === "number") return a + b;
  if (Array.isArray(a)) return a.map((x, i) => addSums(x, b[i]));
  const o = { ...a }; for (const k of Object.keys(b)) o[k] = addSums(a[k], b[k]); return o;
}
const cols = [...Bs.map((r) => ({ name: r.name, m: r.c.more, g: r.c.sum.games })), { name: "B 開 合計", m: sumMore(Bs), g: Bs.reduce((a, r) => a + r.c.sum.games, 0) }];
P("== 3. 機制 B 的數字(B 開的三批)", "");
const row = (label, f) => [label, ...cols.map((c) => f(c.m, c.g))];
const avg = (k, n) => (n ? (k / n).toFixed(2) : "–");
P(table(["", ...cols.map((c) => c.name)], [
  row("共軍打城(圍點打援)次數", (m) => m.sieges),
  row("  每局平均", (m, g) => avg(m.sieges, g)),
  row("  每局次數 中位 / 最多", (m) => { const d = m.siegesPerGame, n = tot(d); let s = 0, med = null; for (const k of keysOf(d)) { s += d[k]; if (med == null && 2 * s >= n) med = k; } return `${med} / ${Math.max(...Object.keys(d).map(Number))}`; }),
  row("  一次都沒打的局", (m, g) => pc(m.siegesPerGame[0] || 0, g)),
  row("打點", (m) => `${m.plans.point || 0}(${pc(m.plans.point || 0, m.sieges)})`),
  row("打援", (m) => `${m.plans.relief || 0}(${pc(m.plans.relief || 0, m.sieges)})`),
  row("國軍被問", (m) => m.asked),
  row("  可以增援", (m) => `${m.canReinforce}(${pc(m.canReinforce, m.asked)})`),
  row("  可以突圍", (m) => `${m.canBreakout}(${pc(m.canBreakout, m.asked)})`),
  row("  只能固守", (m) => `${m.onlyHold}(${pc(m.onlyHold, m.asked)})`),
  row("  不能增援:T 是孤城", (m) => `${m.noReinforce.isolated}(${pc(m.noReinforce.isolated, m.asked)})`),
  row("  不能增援:沒有 R", (m) => `${m.noReinforce.noR}(${pc(m.noReinforce.noR, m.asked)})`),
  row("    其中 T 也滿了", (m) => `${m.noRAndFull}`),
  row("  不能增援:有 R 但 T 滿了", (m) => `${m.noReinforce.full}(${pc(m.noReinforce.full, m.asked)})`),
  row("  不能增援:讀不出原因", (m) => `${m.noReinforce.unexplained || 0}`),
  row("國軍的回答:固守", (m) => `${m.answers.hold || 0}(${pc(m.answers.hold || 0, m.sieges)})`),
  row("國軍的回答:增援", (m) => `${m.answers.reinforce || 0}(${pc(m.answers.reinforce || 0, m.sieges)})`),
  row("國軍的回答:突圍", (m) => `${m.answers.breakout || 0}(${pc(m.answers.breakout || 0, m.sieges)})`),
  ...["point/hold", "point/reinforce", "point/breakout", "relief/hold", "relief/reinforce", "relief/breakout"].map((k) => row(`格 ${k}`, (m) => `${m.cells[k] || 0}(${pc(m.cells[k] || 0, m.sieges)})`)),
  row("−1(打點遇增援、X 被抵銷)", (m) => m.picks.siegeLoss || 0),
  row("+1(打援遇增援)", (m) => m.picks.siegeCapture || 0),
  row("圍城標記(打援遇固守)", (m) => m.besieged),
  row("  結算時只因圍城而成孤城的城次", (m) => m.besiegedCities),
  row("  因此在結算掉的藍", (m) => m.besiegedLoss),
  row("共軍打城的決定帶賽局 / 純策略", (m) => `${m.decided[0].n} / ${m.decided[0].pure}(${pc(m.decided[0].pure, m.decided[0].n)})`),
  row("國軍回答帶賽局 / 純策略", (m) => `${m.decided[1].n} / ${m.decided[1].pure}(${pc(m.decided[1].pure, m.decided[1].n)})`),
  row("進剿:守", (m) => `${m.sweep.stand || 0}(${pc(m.sweep.stand || 0, (m.sweep.stand || 0) + (m.sweep.withdraw || 0))})`),
  row("進剿:撤", (m) => `${m.sweep.withdraw || 0}(${pc(m.sweep.withdraw || 0, (m.sweep.stand || 0) + (m.sweep.withdraw || 0))})`),
]));
P("", "每局打城次數的分佈(B 開合計):", "  " + keysOf(cols[cols.length - 1].m.siegesPerGame).map((k) => `${k} 次 ${cols[cols.length - 1].m.siegesPerGame[k]}`).join("、"), "");

// ---------------------------------------------------------------- 4. isolation
P("== 4. 孤城", "");
const isoCols = [...runs, ...VS.map((v) => ({ name: `${v === "off" ? "B 關" : "B 開"} 合計`, c: { more: sumMore(runs.filter((r) => r.v === v)), sum: { games: runs.filter((r) => r.v === v).reduce((a, r) => a + r.c.sum.games, 0) } } }))];
const fk = keysOf(...isoCols.map((r) => r.c.more.firstIsolatedGame));
P("每局第一座孤城出現的回合(局數的比例;「第 0 回合」是免費放置,none = 整局沒有):");
P(table(["回合", ...isoCols.map((r) => r.name)], fk.map((t) => [t, ...isoCols.map((r) => pc(r.c.more.firstIsolatedGame[t] || 0, r.c.sum.games))])), "");
const ik = keysOf(...isoCols.map((r) => r.c.more.isolatedAt3));
P("第 3 回合結束時國軍的孤城數(局數的比例;ended = 第 3 回合結束前就結束了):");
P(table(["座", ...isoCols.map((r) => r.name)], ik.map((t) => [t, ...isoCols.map((r) => pc(r.c.more.isolatedAt3[t] || 0, r.c.sum.games))])), "");
const at3 = (d) => { let s = 0, n = 0; for (const [k, v] of Object.entries(d)) if (k !== "ended") { s += Number(k) * v; n += v; } return n ? `${(s / n).toFixed(2)}(n=${n})` : "–"; };
const ge = (d, x) => { let s = 0, n = 0; for (const [k, v] of Object.entries(d)) if (k !== "ended") { n += v; if (Number(k) >= x) s += v; } return pc(s, n); };
P(table(["", ...isoCols.map((r) => r.name)], [
  ["平均", ...isoCols.map((r) => at3(r.c.more.isolatedAt3))],
  ["≥ 3 座", ...isoCols.map((r) => ge(r.c.more.isolatedAt3, 3))],
  ["≥ 5 座", ...isoCols.map((r) => ge(r.c.more.isolatedAt3, 5))],
  ["最多", ...isoCols.map((r) => Math.max(...Object.keys(r.c.more.isolatedAt3).filter((k) => k !== "ended").map(Number)))],
]), "");
P("每回合末的孤城數(sum.isolatedByTurn 的平均):");
P(table(["回合", ...names], [1, 2, 3, 4, 5, 6, 7, 8].map((t) => [t, ...runs.map((r) => { const x = r.c.sum.isolatedByTurn[t]; return x ? (x.sum / x.n).toFixed(2) : "–"; })])), "");

// ---------------------------------------------------------------- 5. the pair (tuning/27/runpair.sh)
const pair = ["off", "B"].map((v) => { const p = `tuning/27/runs/pair-${v}-s1.txt.state.json`; return existsSync(p) ? { name: `並排 ${v === "off" ? "B 關" : "B 開"} s1`, st: JSON.parse(readFileSync(p, "utf8")) } : null; }).filter(Boolean);
if (pair.length === 2 && pair.every((p) => p.st.cells.full.more)) {
  P("== 5. 並排的兩批(B 關與 B 開同時跑、各 14 個 job、種子 1..1000)", "");
  const [a, b] = pair.map((p) => p.st.cells.full);
  P(table(["", ...pair.map((p) => p.name)], [
    ["局數 / 出錯", ...[a, b].map((c) => `${c.sum.games} / ${c.errors.length}`)],
    ["每局秒數(ms / 局,14 個 job 平行時的牆上時間)", ...[a, b].map((c) => (c.ms / 1000 / c.sum.games).toFixed(2))],
    ["共軍勝 [95%]", ...[a, b].map((c) => rate(c.sum.wins[0], c.sum.games))],
  ]), "");
  P(`B 開 / B 關 的每局秒數:${(b.ms / a.ms).toFixed(2)} 倍`, "");
  const sorted2 = (x) => (Array.isArray(x) ? x.map(sorted2) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sorted2(x[k])])) : x);
  const off1 = runs.find((r) => r.v === "off" && r.seed === 1), on1 = runs.find((r) => r.v === "B" && r.seed === 1);
  P(`並排 B 關 的 sum 對第 0 節的 B 關 s1:${off1 && JSON.stringify(sorted2(off1.c.sum)) === JSON.stringify(sorted2(a.sum)) ? "一模一樣" : "不同"};並排 B 開 對 B 開 s1:${on1 && JSON.stringify(sorted2(on1.c.sum)) === JSON.stringify(sorted2(b.sum)) ? "一模一樣" : "不同"}`, "");
  const fe = keysOf(a.more.firstIsolatedEnd, b.more.firstIsolatedEnd);
  P("每局第一個「回合末有孤城」的回合(局數的比例;none = 沒有一個回合末有孤城):");
  P(table(["回合", ...pair.map((p) => p.name)], fe.map((t) => [t, ...[a, b].map((c) => pc(c.more.firstIsolatedEnd[t] || 0, c.sum.games))])), "");
  const med = (d) => { const n = tot(d); let s = 0; for (const k of keysOf(d)) { s += d[k]; if (2 * s >= n) return k; } return "–"; };
  P(`中位:B 關 第 ${med(a.more.firstIsolatedEnd)} 回合;B 開 第 ${med(b.more.firstIsolatedEnd)} 回合`, "");
}

console.log(out.join("\n"));
