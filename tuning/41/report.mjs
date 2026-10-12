// #41: the appendix of tuning/41/report.txt, every number read from the state files under tuning/41/runs (tests/sim.js),
// the tests/targets.mjs output next to each, and the probes' files; nothing copied by hand.
//   node tuning/41/report.mjs
// runs/same/   C on, seed 1, 300 games: origin/main ad31d53 (C-main) and this branch with no new option (C-branch, C-head)
// runs/screen/ the screening, seed 1, 300 games each (`off` = C off, the same seeds)
// runs/final/  the three picked, seeds 1 / 20001 / 40001, 1000 games each; C off and today's C on are #40's batches
//              (tuning/40/runs/off-s*.txt.state.json, C-s*.txt.state.json: the same seeds; C off is unchanged by #41,
//              and today's C on is the same games, A below)
// runs/probe/  the worth probes (tuning/41/probe-run.mjs)
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { readBatch, block, row } from "./goals.mjs";
import { sum, show } from "./probe-run.mjs";
import { holdSum } from "./hold-sum.mjs";

const R = "tuning/41/runs";
const P = (s = "") => console.log(s);
const files = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".state.json")).sort() : []);
const same = (a, b) => { const r = spawnSync(process.execPath, ["tuning/41/same.mjs", a, b], { encoding: "utf8" }); return `${(r.stdout || r.stderr).trim()}(exit ${r.status})`; };

P("== A. 第一輪:不給新選項 = 今天的 C(C 開、--seed=1、300 局;tuning/41/same.mjs;第二輪 bot 改了,改看 A2)");
for (const f of files(`${R}/same`).filter((f) => f.startsWith("C-") && f !== "C-main-s1-300.txt.state.json")) P(`${f.replace(".txt.state.json", "")} vs C-main(origin/main ad31d53):${same(`${R}/same/${f}`, `${R}/same/C-main-s1-300.txt.state.json`)}`);
if (existsSync(`${R}/screen/MC-split-s1-300.txt.state.json`)) P(`(比對會紅:C-main vs MC-split → ${same(`${R}/same/C-main-s1-300.txt.state.json`, `${R}/screen/MC-split-s1-300.txt.state.json`)})`);
if (existsSync(`${R}/screen/MC-caught0-s1-300.txt.state.json`)) P(`(MC-caught0 和今天的 C 是同樣的 300 局:沒有一局肅諜,抓錯的代價從來沒有被讀到 → ${same(`${R}/same/C-main-s1-300.txt.state.json`, `${R}/screen/MC-caught0-s1-300.txt.state.json`)})`);
P();

const ORDER = ["C(今天)", "MC-split", "MC-caught0", "MC-leak1", "MC-defectAny", "MC-handHalf", "MC-plant1", "MC-mand1", "MC-leakTR",
  "MC-plant1+leak1", "MC-plant1+mand1", "MC-mand1+leak1", "MC-plant1+mand1+leak1", "MC-plant1+mand1+split", "MC-plant1+leak1+split",
  "MC-plant1+leak1+defectAny+handHalf", "MC-plant2", "MC-plant2+leak1"];
const offS = existsSync(`${R}/screen/off-s1-300.txt.state.json`) ? readBatch("C 關", `${R}/screen/off-s1-300.txt.state.json`) : null;
const screen = [readBatch("C(今天)", `${R}/same/C-main-s1-300.txt.state.json`),
  ...files(`${R}/screen`).filter((f) => !f.startsWith("off-")).map((f) => readBatch(f.replace(/-s1-300\.txt\.state\.json$/, ""), `${R}/screen/${f}`))]
  .sort((a, b) => (ORDER.indexOf(a.name) + 1 || 99) - (ORDER.indexOf(b.name) + 1 || 99));
P("== B. 篩選(--seed=1、300 局、普通對普通;括號是減掉 C 關同一批的共軍勝率,個百分點)");
P("   [G1 十項 ≥ 8 含曲線且共軍 35–65%;G2 肅諜每局 ≥ 0.5;G3 翻真標記每局 ≥ 0.5;G4 肅諜翻到的假 ≥ 20% 且回合末信念的 Brier < 先驗]");
P("   欄:共軍勝率、十項、肅諜 / 局、翻真 / 局、肅諜翻到的假的比例 / 翻開的個數、Brier 信念 / 先驗、每局秒數");
if (offS) P(row(offS));
for (const b of screen) P(row(b, offS));
P();

const fin = files(`${R}/final`).map((f) => { const m = f.match(/^(.*)-s(\d+)-1000\.txt\.state\.json$/); return { seed: m[2], b: readBatch(`${m[1]} s${m[2]}`, `${R}/final/${f}`) }; });
if (fin.length) {
  P("== C. 最好的三個 × 三批種子(各 1000 局;C 關與今天的 C 是 #40 的同一批種子)");
  for (const seed of ["1", "20001", "40001"]) {
    const off = readBatch(`C 關 s${seed}`, `tuning/40/runs/off-s${seed}.txt.state.json`);
    off.targets = Number(((readFileSync(`tuning/40/runs/off-s${seed}.targets.txt`, "utf8").match(/通過 (\d+) \/ 10/) || [])[1]));
    const on = readBatch(`C(今天) s${seed}`, `tuning/40/runs/C-s${seed}.txt.state.json`);
    on.targets = Number(((readFileSync(`tuning/40/runs/C-s${seed}.targets.txt`, "utf8").match(/通過 (\d+) \/ 10/) || [])[1]));
    on.curvePass = off.curvePass = true; // #40's targets files: 民心曲線 通過 in all six (tuning/40/report.txt 五 一)
    P(row(off)); P(row(on, off));
    for (const x of fin.filter((x) => x.seed === seed)) P(row(x.b, off));
  }
  P();
  P("十項逐項(tests/targets.mjs;○ 通過 × 失敗,依序:民心曲線、共軍勝率、結束方式、易幟佔比、開局孤城、每回合孤城上升、遷都、支持度軌、打到決戰期、國軍贏法)");
  for (const x of fin) P(`  ${x.b.marks}  ${x.b.name}`);
  P();
  P("民心曲線(每回合末 共軍領先 / 國軍領先,已結束的算贏家)");
  for (const x of fin) P(`  ${x.b.name.padEnd(28)} ${(x.b.curve.split(" · ")[2] || "").replace("共軍領先 / 國軍領先(已結束的算贏家):", "")}`);
  P();
}
// #41 round 2 (orchestrator 裁決 #41: the real marker priced as its one use): the identity is now C off's, the
// re-screen is runs/screen2/ with the fixed bot (`C` there = today's rules + the fixed bot, the new baseline).
const off2 = existsSync(`${R}/screen2/off-s1-300.txt.state.json`) ? readBatch("C 關", `${R}/screen2/off-s1-300.txt.state.json`) : null;
if (off2) {
  P("== A2. 第二輪:C 關不變(預設規則、--seed=1、300 局;修過 bot 的分支 vs origin/main ad31d53)");
  P(`off(分支 a013444)vs off-main:${same(`${R}/screen2/off-s1-300.txt.state.json`, `${R}/same/off-main-s1-300.txt.state.json`)}`);
  P(`(C 開、不給新選項,修過的 bot vs main:${same(`${R}/screen2/C-s1-300.txt.state.json`, `${R}/same/C-main-s1-300.txt.state.json`)} —— 預期不同,bot 改了)`);
  P();
  const ORDER2 = ["C(修過的 bot)", "MC-leak1", "MC-plant1", "MC-plant2", "MC-mand1", "MC-plant1+leak1", "MC-plant2+leak1", "MC-mand1+leak1", "MC-plant1+mand1", "MC-plant1+leak1+defectAny+handHalf"];
  const s2 = files(`${R}/screen2`).filter((f) => !f.startsWith("off-")).map((f) => readBatch(f === "C-s1-300.txt.state.json" ? "C(修過的 bot)" : f.replace(/-s1-300\.txt\.state\.json$/, ""), `${R}/screen2/${f}`))
    .sort((a, b) => (ORDER2.indexOf(a.name) + 1 || 99) - (ORDER2.indexOf(b.name) + 1 || 99));
  P("== B2. 第二輪的篩選(修過的 bot;--seed=1、300 局;欄同 B;括號減掉這一批的 C 關)");
  P(row(off2));
  P(row(readBatch("C(修之前的 bot)", `${R}/same/C-main-s1-300.txt.state.json`), off2));
  for (const b of s2) P(row(b, off2));
  P();
  P("== E2. 第二輪每一批的細節");
  for (const b of s2) { P(block(b, off2)); P(); }
}
P("== D. 真標記每回合值多少(tuning/41/probe-run.mjs,480 局、種子 41000–41479、每一組都開免費佈線 1、手上的真標記值 0)");
P("   base / leak1 / …:#40 的價格的 bot 玩的;base2 / leak1b:第一次量到的一次性價格的 bot 玩的(C_ONCE 用這兩個);base3:交付的 bot 玩的(還會動多少)");
const arms = ["base", "base2", "base3", "leak1", "leak1b", "defectAny", "defect3", "handHalf", "handOne", "leakTR"].filter((n) => existsSync(`${R}/probe/${n}-0.txt`));
const base = arms.includes("base") ? sum("base") : null;
for (const n of arms) {
  const t = sum(n);
  P(show(n, t));
  if (base && n !== "base") P(`  減掉 base:${["capital", "open", "isolated", "other"].map((c) => `${c} ${(t.worth[c] - base.worth[c] >= 0 ? "+" : "")}${(t.worth[c] - base.worth[c]).toFixed(3)}`).join("、")}`);
}
P();
P("== F. 共軍為什麼留著真標記(tuning/41/probe-hold.mjs:MC-plant1+leak1 的選項、bot 自己的價格,280 局、種子 43000–43279)");
if (existsSync(`${R}/probe/hold-plant1leak1-0.txt`)) P(holdSum("hold-plant1leak1"));
P("   第二輪(同一批種子):hold2 = 第一次的一次性價格(base / leak1 的 p、G);hold3 = 交付的 bot;holdF = 交付的 bot 把價格改回 #40 的寫法(p × G × 剩下的回合,tuning/41/falsify-price.mjs)");
for (const n of ["hold2-plant1leak1", "hold3-plant1leak1", "holdF-plant1leak1"]) if (existsSync(`${R}/probe/${n}-0.txt`)) P(holdSum(n));
P();
P("== E. 每一批的細節(C 的各批,再來是 B 的每一批)");
for (const x of fin) { P(block(x.b, readBatch(`C 關 s${x.seed}`, `tuning/40/runs/off-s${x.seed}.txt.state.json`))); P(); }
for (const b of screen) { P(block(b, offS)); P(); }
