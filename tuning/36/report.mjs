// #36: the numbers of tuning/36/report.txt, from the six state files of tuning/36/runall.sh (E off / E on,
// seeds 1, 20001, 40001) and their tests/targets.mjs outputs (<state>.targets.txt).
//   node tuning/36/report.mjs      (its output is the appendix of tuning/36/report.txt)
import { readFileSync, existsSync } from "node:fs";

const R = "tuning/36/runs", SEEDS = [1, 20001, 40001];
const BATCHES = [...SEEDS.map((s) => ({ name: `E關 s${s}`, file: `${R}/Eoff-s${s}.txt.state.json`, e: false })),
  ...SEEDS.map((s) => ({ name: `E開 s${s}`, file: `${R}/Eon-s${s}.txt.state.json`, e: true }))];
for (const b of BATCHES) {
  b.state = JSON.parse(readFileSync(b.file, "utf8"));
  b.cell = b.state.cells.full;
  b.sum = b.cell.sum; b.more = b.cell.more || {};
  const t = `${b.file}.targets.txt`;
  b.targets = existsSync(t) ? readFileSync(t, "utf8").split("\n") : [];
}
const out = [];
const P = (s = "") => out.push(s);
const pct = (k, n) => (n ? `${((100 * k) / n).toFixed(1)}%` : "–");
const pad = (s, w) => { s = String(s); let len = 0; for (const ch of s) len += /[　-鿿＀-￯]/.test(ch) ? 2 : 1; return s + " ".repeat(Math.max(0, w - len)); };
const table = (head, rows, w0 = 30, w = 16) => { P(pad(head[0], w0) + head.slice(1).map((h) => pad(h, w)).join("")); for (const r of rows) P(pad(r[0], w0) + r.slice(1).map((c) => pad(c, w)).join("")); };
const names = BATCHES.map((b) => b.name);
const numSort = (a, b) => (isNaN(a) || isNaN(b) ? String(a).localeCompare(String(b)) : a - b);
const dist = (o) => Object.entries(o || {}).sort((a, b) => numSort(a[0], b[0])).map(([k, v]) => `${k}:${v}`).join(" ");
const add = (a, b) => { const o = { ...(a || {}) }; for (const [k, v] of Object.entries(b || {})) o[k] = (o[k] || 0) + v; return o; };
const secs = (b) => b.cell.ms / 1000 / (b.sum.games + (b.cell.errors || []).length);

// ---- 1. the games
P("== 1. 局數、勝率、結束方式、結束回合、每局秒數(cell full,普通對普通)");
P("(同一個種子的 E 關與 E 開並排跑:各 14 個 job,同一台機器同一段時間)");
table(["", ...names], [
  ["打完 / 出錯", ...BATCHES.map((b) => `${b.sum.games} / ${(b.cell.errors || []).length}`)],
  ["共軍勝率", ...BATCHES.map((b) => pct(b.sum.wins[0], b.sum.games))],
  ["每局秒數", ...BATCHES.map((b) => secs(b).toFixed(2))],
  ...[...new Set(BATCHES.flatMap((b) => Object.keys(b.sum.reasons)))].sort().map((r) => [`結束:${r}`, ...BATCHES.map((b) => pct(b.sum.reasons[r] || 0, b.sum.games))]),
  ...[...new Set(BATCHES.flatMap((b) => Object.keys(b.sum.endTurns)))].sort(numSort).map((t) => [`結束在第 ${t} 回合`, ...BATCHES.map((b) => pct(b.sum.endTurns[t] || 0, b.sum.games))]),
]);
P();
const pool = (e) => BATCHES.filter((b) => b.e === e).reduce((a, b) => ({ n: a.n + b.sum.games, ccp: a.ccp + b.sum.wins[0] }), { n: 0, ccp: 0 });
const off = pool(false), on = pool(true);
const se = Math.sqrt((off.ccp / off.n) * (1 - off.ccp / off.n) / off.n + (on.ccp / on.n) * (1 - on.ccp / on.n) / on.n);
P(`三批合起來:共軍勝率 E 關 ${pct(off.ccp, off.n)}(${off.ccp}/${off.n}),E 開 ${pct(on.ccp, on.n)}(${on.ccp}/${on.n});差 ${(100 * (on.ccp / on.n - off.ccp / off.n)).toFixed(1)} 個百分點,95% 區間 ±${(196 * se).toFixed(1)}`);
P(`每局秒數(三批平均):E 關 ${(BATCHES.filter((b) => !b.e).reduce((a, b) => a + secs(b), 0) / 3).toFixed(2)},E 開 ${(BATCHES.filter((b) => b.e).reduce((a, b) => a + secs(b), 0) / 3).toFixed(2)}`);
P();

// ---- 2. the mandate curve
P("== 2. 民心曲線(targets 第 1 項的讀法:每回合末誰領先,已結束的算贏家;共軍領先 / 國軍領先)");
const ahead = (b) => b.sum.aheadByTurn || {};
table(["回合", ...names], [1, 2, 3, 4, 5, 6, 7, 8].map((t) => [`第 ${t} 回合末`, ...BATCHES.map((b) => { const a = ahead(b)[t]; return a ? `${pct(a.ccp, b.sum.games)}/${pct(a.kmt, b.sum.games)}` : "–"; })]), 16, 16);
P("還在進行的對局,回合末民心的平均(正 = 偏共軍):");
table(["回合", ...names], [1, 2, 3, 4, 5, 6, 7, 8].map((t) => [`第 ${t} 回合末`, ...BATCHES.map((b) => { const m = b.sum.mandateByTurn[t]; return m ? `${(m.sum / m.n).toFixed(2)}(${m.n})` : "–"; })]), 16, 16);
P();

// ---- 3. the ten targets
P("== 3. 十項目標(tests/targets.mjs;「只看」的兩行不算)");
const tLines = (b) => b.targets.filter((l) => /^(通過|失敗) · /.test(l));
const labels = tLines(BATCHES[0]).map((l) => l.split(" · ")[1]);
table(["目標", ...names], labels.map((lab, i) => [lab.replace(/(.{24}).+/, "$1…"), ...BATCHES.map((b) => { const l = tLines(b)[i]; return l ? l.split(" · ")[0] : "?"; })]), 52, 12);
P("TARGETS 行:");
for (const b of BATCHES) P(`  ${pad(b.name, 12)} ${b.targets.find((l) => l.startsWith("TARGETS")) || "(沒有)"}`);
P();
P("每一項的讀數(每批一行):");
labels.forEach((lab, i) => {
  P(`- ${lab}`);
  for (const b of BATCHES) { const l = tLines(b)[i]; P(`    ${pad(b.name, 12)} ${l ? l.split(" · ").slice(0, 1).concat(l.split(" · ").slice(2)).join(" · ") : "?"}`); }
});
P();

// ---- 4. E's numbers
const EB = BATCHES.filter((b) => b.e), en = EB.map((b) => b.name);
const X = (b) => b.more.e || {}, per = (b) => b.more.ePerGame || {};
P("== 4. 機制 E 的數字(E 開;每批 1000 局)");
const mean = (o) => { let n = 0, s = 0; for (const [k, v] of Object.entries(o || {})) { n += v; s += Number(k) * v; } return n ? (s / n).toFixed(2) : "–"; };
table(["", ...en], [
  ["印鈔 合計 / 每局", ...EB.map((b) => `${X(b).print} / ${(X(b).print / b.sum.games).toFixed(2)}`)],
  ["平抑 合計 / 每局", ...EB.map((b) => `${X(b).peg} / ${(X(b).peg / b.sum.games).toFixed(2)}`)],
  ["激進 合計 / 每局", ...EB.map((b) => `${X(b).radical} / ${(X(b).radical / b.sum.games).toFixed(2)}`)],
  ["通膨崩潰的局數", ...EB.map((b) => `${X(b).collapse}`)],
  ["最後一回合印到 9 的局數", ...EB.map((b) => `${X(b).lastTurnTo9}`)],
  ["局末通膨 平均", ...EB.map((b) => mean(X(b).end && X(b).end.inflation))],
  ["局末左傾 平均", ...EB.map((b) => mean(X(b).end && X(b).end.leftism))],
  ["局末中間派 平均", ...EB.map((b) => mean(X(b).end && X(b).end.centrists))],
  ["結算時中間派給共軍的民心", ...EB.map((b) => `${X(b).settleToCcp}`)],
  ["結算時中間派給國軍的民心", ...EB.map((b) => `${X(b).settleToKmt}`)],
], 30, 22);
P();
P("每局的次數分佈(次數:局數):");
for (const k of ["print", "peg", "radical"]) for (const b of EB) P(`  ${pad(k, 8)} ${pad(b.name, 12)} ${dist(per(b)[k])}`);
P("局末的分佈:");
for (const k of ["inflation", "leftism", "centrists"]) for (const b of EB) P(`  ${pad(k, 10)} ${pad(b.name, 12)} ${dist(X(b).end && X(b).end[k])}`);
P();
P("門檻:被觸發的局數比例(左傾 6 每次都算,所以是次數)與回合分佈(回合:次數):");
const thr = [...new Set(EB.flatMap((b) => Object.keys(X(b).threshold || {})))].sort();
for (const k of thr) for (const b of EB) { const d = (X(b).threshold || {})[k] || {}, n = Object.values(d).reduce((a, x) => a + x, 0); P(`  ${pad(k, 12)} ${pad(b.name, 12)} ${pad(pct(n, b.sum.games), 8)} ${dist(d)}`); }
P();
P("每回合的印鈔 / 平抑 / 激進(三批合計):");
const byTurn = {};
for (const b of EB) for (const [t, o] of Object.entries(X(b).byTurn || {})) byTurn[t] = add(byTurn[t], o);
for (const t of Object.keys(byTurn).sort(numSort)) P(`  第 ${t} 回合 印鈔 ${byTurn[t].print || 0} 平抑 ${byTurn[t].peg || 0} 激進 ${byTurn[t].radical || 0}`);
P();
P("每回合末的中間派、通膨、左傾(三批合計;值:局數):");
const atEnd = {};
for (const b of EB) for (const [t, o] of Object.entries(X(b).atTurnEnd || {})) { const a = (atEnd[t] ||= {}); for (const k of ["centrists", "inflation", "leftism"]) a[k] = add(a[k], o[k]); }
for (const t of Object.keys(atEnd).sort(numSort)) P(`  第 ${t} 回合末 中間派 ${dist(atEnd[t].centrists)} | 通膨 ${dist(atEnd[t].inflation)} | 左傾 ${dist(atEnd[t].leftism)}`);
P();
P("每回合結算時中間派移動的民心(三批合計;正 = 往共軍):");
const settle = {};
for (const b of EB) for (const [t, v] of Object.entries(X(b).settle || {})) settle[t] = (settle[t] || 0) + v;
P(`  ${dist(settle)}`);
P("中間派被推動的格數(原因:合計,正 = 往共軍):");
let moved = {};
for (const b of EB) moved = add(moved, X(b).centristsMoved);
P(`  ${dist(moved)}`);
P();
P("還鄉團的藍放在哪(三批合計;none = 鄰近沒有空位):");
let rh = {};
for (const b of EB) rh = add(rh, X(b).returnHome);
P(`  ${Object.entries(rh).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" ")}`);
console.log(out.join("\n"));
