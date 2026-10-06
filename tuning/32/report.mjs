// #32: the numbers of tuning/32/report.txt, from the six state files of tuning/32/runall.sh (D off / D on,
// seeds 1, 20001, 40001) and their tests/targets.mjs outputs (<state>.targets.txt).
//   node tuning/32/report.mjs      (its output is the appendix of tuning/32/report.txt)
import { readFileSync, existsSync } from "node:fs";

const R = "tuning/32/runs", SEEDS = [1, 20001, 40001];
const BATCHES = [...SEEDS.map((s) => ({ name: `D關 s${s}`, file: `${R}/Doff-s${s}.txt.state.json`, d: false })),
  ...SEEDS.map((s) => ({ name: `D開 s${s}`, file: `${R}/Don-s${s}.txt.state.json`, d: true }))];
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
const dist = (o) => Object.entries(o || {}).sort((a, b) => (isNaN(a[0]) || isNaN(b[0]) ? String(a[0]).localeCompare(String(b[0])) : a[0] - b[0])).map(([k, v]) => `${k}:${v}`).join(" ");

// ---- the games
P("== 1. 局數、勝率、結束方式、結束回合、每局秒數(cell full,普通對普通)");
P("(同一個種子的 D 關與 D 開並排跑:各 13 個 job,同一台機器同一段時間)");
table(["", ...names], [
  ["打完 / 出錯", ...BATCHES.map((b) => `${b.sum.games} / ${(b.cell.errors || []).length}`)],
  ["共軍勝率", ...BATCHES.map((b) => pct(b.sum.wins[0], b.sum.games))],
  ["每局秒數", ...BATCHES.map((b) => (b.cell.ms / 1000 / (b.sum.games + (b.cell.errors || []).length)).toFixed(2))],
  ...[...new Set(BATCHES.flatMap((b) => Object.keys(b.sum.reasons)))].sort().map((r) => [`結束:${r}`, ...BATCHES.map((b) => pct(b.sum.reasons[r] || 0, b.sum.games))]),
  ...[...new Set(BATCHES.flatMap((b) => Object.keys(b.sum.endTurns)))].sort((a, b) => a - b).map((t) => [`結束在第 ${t} 回合`, ...BATCHES.map((b) => pct(b.sum.endTurns[t] || 0, b.sum.games))]),
]);
P();

// ---- the ten targets
P("== 2. 十項目標(tests/targets.mjs;「只看」的兩行不算)");
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

// ---- D
const DB = BATCHES.filter((b) => b.d);
const dn = DB.map((b) => b.name);
const D = (b) => b.more.d || {};
const per = (b) => b.more.dPerGame || {};
P("== 3. 五個勢力最後各去了哪(D 開;每批 1000 局,局末)");
const POW = ["sui", "jin", "gui", "ma", "dian"], ZH = { sui: "綏", jin: "晉", gui: "桂", ma: "馬", dian: "滇" };
for (const p of POW) {
  P(`${ZH[p]}(${p})`);
  const rows = [["易幟(打下來的)", "mie:conquest"], ["易幟(談下來的)", "mie:talks"], ["整編完成", "seal"], ["都沒有", "none"], ["局末 效忠", "att:loyal"], ["局末 觀望", "att:neutral"], ["局末 通共", "att:ccp"]];
  table(["", ...dn], rows.map(([zh, k]) => [`  ${zh}`, ...DB.map((b) => pct((D(b).end?.[p]?.[k]) || 0, b.sum.games))]));
}
P("(易幟後勢力的態度不再動,所以局末的態度包括已經易幟 / 整編完成的勢力。)");
P();
P("== 4. 勝利是誰在拿");
table(["", ...dn], [
  ["易幟勝 / 共軍勝", ...DB.map((b) => `${b.sum.reasons.unification || 0} / ${b.sum.wins[0]}`)],
  ["整編勝(alliance)", ...DB.map((b) => `${b.sum.reasons.alliance || 0}`)],
  ["整編完成 5 個(局末)", ...DB.map((b) => `${D(b).fiveSeals || 0}`)],
]);
P("易幟勝的三家(局末有易幟的勢力):");
for (const b of DB) P(`  ${pad(b.name, 12)} ${Object.entries(D(b).trio || {}).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k.split("+").map((p) => ZH[p]).join("")} ${v}`).join("、")}`);
P();
P("== 5. 時間與次數(D 開)");
for (const [label, k] of [["每局第一個易幟的回合(0 = 免費放置)", "firstMie"], ["每局第一個整編完成的回合", "firstSeal"], ["每局易幟的個數", "mie"], ["每局整編完成的個數", "seal"], ["每局整編的次數", "integrate"], ["每局統戰的次數", "talks"]]) {
  P(label);
  for (const b of DB) P(`  ${pad(b.name, 12)} ${dist(per(b)[k])}`);
}
table(["合計(1000 局)", ...dn], [
  ["整編(次)", ...DB.map((b) => D(b).integrate)],
  ["整編轉成藍的灰(點)", ...DB.map((b) => D(b).integratePoints)],
  ["統戰(次)", ...DB.map((b) => D(b).talks)],
  ["易幟 打下來 / 談下來", ...DB.map((b) => `${D(b).mie?.conquest} / ${D(b).mie?.talks}`)],
  ["整編完成", ...DB.map((b) => D(b).seal)],
  ["進攻打到灰(次 / 點)", ...DB.map((b) => `${D(b).grayHit} / ${D(b).grayHitPoints}`)],
  ["結算的態度下降(孤城)", ...DB.map((b) => D(b).attitude?.isolated || 0)],
  ["打到通共的灰退回觀望", ...DB.map((b) => D(b).attitude?.attacked || 0)],
  ["態度因整編 / 統戰", ...DB.map((b) => `${D(b).attitude?.integrate || 0} / ${D(b).attitude?.talks || 0}`)],
  ["grayOrder 先移藍 / 先移灰", ...DB.map((b) => `${D(b).grayOrder?.blue || 0} / ${D(b).grayOrder?.gray || 0}`)],
], 30, 18);
P();
P("== 6. 統戰為什麼少:合法的時機、選了幾次、沒選時差幾分(共軍的行動回合;一次猜測的 scoreCandidates)");
table(["", ...dn], [
  ["統戰合法的行動回合", ...DB.map((b) => D(b).talksLegal?.rounds)],
  ["  選了統戰", ...DB.map((b) => D(b).talksLegal?.chosen)],
  ["  沒選", ...DB.map((b) => D(b).talksLegal?.notChosen)],
  ["  沒選時差(平均,不含勝著)", ...DB.map((b) => { const t = D(b).talksLegal || {}; return t.gapN ? (t.gapSum / t.gapN).toFixed(1) : "–"; })],
  ...["<5", "5-10", "10-20", "20-40", "40+", "win"].map((k) => [`  差 ${k}`, ...DB.map((b) => D(b).talksLegal?.gap?.[k] || 0)]),
  ["行動點可統戰的選擇 / 選了", ...DB.map((b) => `${D(b).talksLegal?.opsAsks} / ${D(b).talksLegal?.opsChosen}`)],
  ["國軍整編合法的行動回合 / 選了", ...DB.map((b) => `${D(b).integrateLegal?.rounds} / ${D(b).integrateLegal?.chosen}`)],
], 30, 18);
P("(「差 win」:那一步是當場贏的一著,統戰比它差 1000 左右。)");
console.log(out.join("\n"));
