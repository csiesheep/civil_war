// #41: C's own goals (brief #41, 三) and the ten targets, read from tests/sim.js state files and the
// tests/targets.mjs output next to each (<state>.targets.txt). Nothing is copied by hand.
//   node tuning/41/goals.mjs [--off=<C off state.json>] <name>=<a.state.json> [<name>=<b.state.json> …]
// One block per batch, then one summary row each:
//   G1 ten targets ≥ 8 with the 民心 curve passing, and the Communists 35–65%
//   G2 肅諜 used: the Nationalists' 肅諜 ≥ 0.5 a game (mean)
//   G3 real markers used: 洩密 + 倒戈 + 和平易手 ≥ 0.5 a game (mean)
//   G4 the fakes frighten: of the markers 肅諜 turned up, ≥ 20% fake; and the belief beats the prior (Brier) on the
//      markers on the board at every turn's end (capital and the other cities together; the more numerous reading);
//      the same on the markers 肅諜 turned up is shown beside it
//   G5 report only: the Communists' win rate C on minus C off (--off, the same seeds), the plants (paid / free,
//      real / fake, by class), 民心 from cRealMandate, seconds a game
import { readFileSync, existsSync } from "node:fs";

const pct = (k, n) => (n ? (100 * k) / n : NaN);
const f1 = (x) => (Number.isFinite(x) ? `${x.toFixed(1)}%` : "–");
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "–");
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "–");
export const dist = (o) => Object.entries(o || {}).sort((a, b) => (a[0] === "none") - (b[0] === "none") || Number(a[0]) - Number(b[0])).map(([k, v]) => `${k}:${v}`).join(" ");
const CLS = { capital: "首都", cut: "割點", attack: "打得到", other: "其他" };
export function readBatch(name, file) {
  const state = JSON.parse(readFileSync(file, "utf8"));
  const cell = state.cells.full, sum = cell.sum, more = cell.more || {}, c = more.c || null, per = more.cPerGame || {};
  const n = sum.games, errors = (cell.errors || []).length;
  const tfile = `${file}.targets.txt`, tlines = existsSync(tfile) ? readFileSync(tfile, "utf8").split(/\r?\n/) : [];
  const tline = tlines.find((l) => l.startsWith("TARGETS")) || null;
  const targets = tline ? Number((tline.match(/通過 (\d+) \/ 10/) || [])[1]) : null;
  const curve = tlines.find((l) => /^(通過|失敗) · 民心曲線/.test(l)) || "";
  const marks = tlines.filter((l) => /^(通過|失敗) · /.test(l)).map((l) => (l.startsWith("通過") ? "○" : "×")).join("");
  const ccp = pct(sum.wins[0], n);
  const b = {
    name, file, n, errors, ccp, targets, tline, marks, curve: curve.trim(), curvePass: curve.startsWith("通過"), reasons: sum.reasons,
    secs: cell.ms / n / 1000, options: (state.meta && state.meta.variantOptions) || {}, c, per,
  };
  if (c) {
    const flips = c.purge.real + c.purge.fake;
    const brd = { n: c.board.capital.n + c.board.other.n, brier: c.board.capital.brier + c.board.other.brier, prior: c.board.capital.brierPrior + c.board.other.brierPrior };
    Object.assign(b, {
      purges: c.purge.plays / n, used: (c.leak + c.defect + c.handover) / n, flips, fakeShare: pct(c.purge.fake, flips),
      boardBrier: brd.n ? brd.brier / brd.n : NaN, boardPrior: brd.n ? brd.prior / brd.n : NaN, boardN: brd.n,
      flipBrier: c.calib.n ? c.calib.brier / c.calib.n : NaN, flipPrior: c.calib.n ? c.calib.brierPrior / c.calib.n : NaN, flipN: c.calib.n,
    });
  }
  b.pass = {
    g1: targets != null && targets >= 8 && b.curvePass && ccp >= 35 && ccp <= 65,
    g2: !!c && b.purges >= 0.5,
    g3: !!c && b.used >= 0.5,
    g4: !!c && b.fakeShare >= 20 && b.boardBrier < b.boardPrior,
  };
  return b;
}
const yn = (x) => (x ? "過" : "不過");
export function block(b, off = null) {
  const L = [];
  L.push(`## ${b.name}  (${b.file})`);
  L.push(`局數 ${b.n},出錯 ${b.errors};共軍勝 ${f1(b.ccp)};${b.tline || "TARGETS (沒有 targets 檔)"};十項 ${b.marks}`);
  L.push(`   ${b.curve ? b.curve.split(" · ").filter((x, i) => i !== 1).join(" · ") : "民心曲線:(沒有 targets 檔)"}`);
  L.push(`   選項 ${JSON.stringify(b.options)}`);
  L.push(`G1 十項 ${b.targets ?? "?"} / 10、民心曲線 ${b.curvePass ? "通過" : "失敗"}、共軍 ${f1(b.ccp)}(≥ 8 含曲線、35–65%:${yn(b.pass.g1)})`);
  const c = b.c;
  if (!c) { L.push("(C 關:沒有 C 的數字)"); return L.join("\n"); }
  L.push(`G2 肅諜每局 ${f2(b.purges)}(${c.purge.plays} 次;≥ 0.5:${yn(b.pass.g2)});每局的分佈 ${dist(b.per.purgePlays)}`);
  L.push(`   可以肅諜的國軍行動回合 ${c.legal.purgeRounds}、肅諜了 ${c.legal.purgeChosen}(${f1(pct(c.legal.purgeChosen, c.legal.purgeRounds))})`);
  L.push(`G3 翻真標記每局 ${f2(b.used)}(洩密 ${c.leak}、倒戈 ${c.defect}、和平易手 ${c.handover};≥ 0.5:${yn(b.pass.g3)});每局的分佈 ${dist(b.per.used)}`);
  for (const tag of ["leak", "defect"]) {
    const a = c.asked[tag];
    L.push(`   ${tag === "leak" ? "洩密" : "倒戈"}被問 ${a.real + a.none} 次:有真標記 ${a.real}(答 no ${a.realNo},${f1(pct(a.realNo, a.real))});只有假的 ${a.none}`);
  }
  L.push(`   和平易手可以做的行動回合 ${c.legal.handoverRounds}、做了 ${c.legal.handoverChosen}`);
  L.push(`G4 肅諜翻到 ${b.flips} 個:真 ${c.purge.real}、假 ${c.purge.fake}(假 ${f1(b.fakeShare)});抓錯的肅諜 ${c.purge.caught}`);
  L.push(`   信念 vs 先驗(Brier,低 = 準):回合末城上每一個標記 n ${b.boardN}:信念 ${f3(b.boardBrier)}、先驗 ${f3(b.boardPrior)};肅諜翻開的 n ${b.flipN}:信念 ${f3(b.flipBrier)}、先驗 ${f3(b.flipPrior)}(假 ≥ 20% 且回合末信念較準:${yn(b.pass.g4)})`);
  for (const [k, lab] of [["capital", "首都"], ["other", "其他城"]]) {
    const x = c.board[k];
    L.push(`     ${lab}:n ${x.n},真的 ${f1(pct(x.real, x.n))},平均信念 ${f2(x.p / x.n)};信念 ${f3(x.brier / x.n)}、先驗 ${f3(x.brierPrior / x.n)}`);
  }
  const d = off ? b.ccp - off.ccp : NaN;
  L.push(`G5 共軍勝率 C 開 − C 關 ${off ? `${d >= 0 ? "+" : ""}${d.toFixed(1)} 個百分點(C 關 ${f1(off.ccp)},${off.name})` : "(沒有 C 關的那一批)"};每局 ${b.secs.toFixed(1)} 秒`);
  const free = c.free || null;
  L.push(`   佈線:花牌的 ${c.plant.plays} 次(真 ${c.plant.real}、假 ${c.plant.fake})${free ? `;免費的 真 ${free.real}、假 ${free.fake}` : ""};每局 真 ${f2((c.plant.real + (free ? free.real : 0)) / b.n)}、假 ${f2((c.plant.fake + (free ? free.fake : 0)) / b.n)}`);
  L.push(`   按類別(真 / 假,真的比例):${Object.keys(CLS).map((k) => { const x = (c.plantClass || {})[k] || {}, r = x.real || 0, f = x.fake || 0; return `${CLS[k]} ${r}/${f}(${f1(pct(r, r + f))})`; }).join("、")}`);
  if (c.mandate != null) L.push(`   真標記的民心(cRealMandate)合計 ${c.mandate},每局 ${f2(c.mandate / b.n)};每局的分佈 ${dist(b.per.mandate)}`);
  L.push(`   局末:城上 真 ${c.end.boardReal} 假 ${c.end.boardFake};手上 真 ${c.end.handReal} 假 ${c.end.handFake};出局 ${c.end.out};場外 真 ${c.end.poolReal} 假 ${c.end.poolFake}`);
  const bt = c.byTurn || {};
  L.push(`   按回合 佈/免/肅/洩/倒/易:${Object.keys(bt).filter((t) => Number(t) > 0).sort((x, y) => x - y).map((t) => `${t}:${bt[t].plant || 0}/${bt[t].free || 0}/${bt[t].purge || 0}/${bt[t].leak || 0}/${bt[t].defect || 0}/${bt[t].handover || 0}`).join(" ")}`);
  L.push(`   結束方式 ${Object.entries(b.reasons).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${f1(pct(v, b.n))}`).join("、")}`);
  return L.join("\n");
}
export function row(b, off = null) {
  const tick = (x) => (x ? "OK" : "--");
  const d = off ? b.ccp - off.ccp : NaN;
  if (!b.c) return `${b.name.padEnd(26)} 共軍 ${f1(b.ccp).padStart(6)}  十項 ${String(b.targets ?? "?").padStart(2)}${b.curvePass ? "(曲線過)" : "(曲線不過)"}  (C 關)`;
  return `${b.name.padEnd(26)} 共軍 ${f1(b.ccp).padStart(6)}${off ? ` (${d >= 0 ? "+" : ""}${d.toFixed(1)})` : ""}  十項 ${String(b.targets ?? "?").padStart(2)}${b.curvePass ? "(曲線過)" : "(曲線不過)"}  肅諜 ${f2(b.purges)}  翻真 ${f2(b.used)}  假 ${f1(b.fakeShare).padStart(6)}/${String(b.flips).padStart(4)}  Brier ${f3(b.boardBrier)}/${f3(b.boardPrior)}  ${b.secs.toFixed(1)}s  [${tick(b.pass.g1)} ${tick(b.pass.g2)} ${tick(b.pass.g3)} ${tick(b.pass.g4)}]`;
}
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tuning/41/goals.mjs")) {
  const args = process.argv.slice(2);
  const offArg = args.find((a) => a.startsWith("--off="));
  const off = offArg ? readBatch("C off", offArg.slice(6)) : null;
  const batches = args.filter((a) => !a.startsWith("--")).map((a) => { const i = a.indexOf("="); return readBatch(a.slice(0, i), a.slice(i + 1)); });
  for (const b of batches) console.log(block(b, off) + "\n");
  console.log("== 摘要 [G1 G2 G3 G4]");
  for (const b of batches) console.log(row(b, off));
}
