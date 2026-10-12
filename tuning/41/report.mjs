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

const R = "tuning/41/runs";
const P = (s = "") => console.log(s);
const files = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".state.json")).sort() : []);
const same = (a, b) => { const r = spawnSync(process.execPath, ["tuning/41/same.mjs", a, b], { encoding: "utf8" }); return `${(r.stdout || r.stderr).trim()}(exit ${r.status})`; };

P("== A. 不給新選項 = 今天的 C(C 開、--seed=1、300 局;tuning/41/same.mjs)");
for (const f of files(`${R}/same`).filter((f) => f !== "C-main-s1-300.txt.state.json")) P(`${f.replace(".txt.state.json", "")} vs C-main(origin/main ad31d53):${same(`${R}/same/${f}`, `${R}/same/C-main-s1-300.txt.state.json`)}`);
if (existsSync(`${R}/screen/MC-split-s1-300.txt.state.json`)) P(`(比對會紅:C-main vs MC-split → ${same(`${R}/same/C-main-s1-300.txt.state.json`, `${R}/screen/MC-split-s1-300.txt.state.json`)})`);
if (existsSync(`${R}/screen/MC-caught0-s1-300.txt.state.json`)) P(`(MC-caught0 和今天的 C 是同樣的 300 局:沒有一局肅諜,抓錯的代價從來沒有被讀到 → ${same(`${R}/same/C-main-s1-300.txt.state.json`, `${R}/screen/MC-caught0-s1-300.txt.state.json`)})`);
P();

const offS = existsSync(`${R}/screen/off-s1-300.txt.state.json`) ? readBatch("C 關", `${R}/screen/off-s1-300.txt.state.json`) : null;
const screen = [readBatch("C(今天)", `${R}/same/C-main-s1-300.txt.state.json`),
  ...files(`${R}/screen`).filter((f) => !f.startsWith("off-")).map((f) => readBatch(f.replace(/-s1-300\.txt\.state\.json$/, ""), `${R}/screen/${f}`))];
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
P("== D. 真標記每回合值多少(tuning/41/probe-run.mjs,480 局、種子 41000–41479、每一組都開免費佈線 1、手上的真標記值 0)");
const arms = ["base", "leak1", "defectAny", "defect3", "handHalf", "handOne", "leakTR"].filter((n) => existsSync(`${R}/probe/${n}-0.txt`));
const base = arms.includes("base") ? sum("base") : null;
for (const n of arms) {
  const t = sum(n);
  P(show(n, t));
  if (base && n !== "base") P(`  減掉 base:${["capital", "open", "isolated", "other"].map((c) => `${c} ${(t.worth[c] - base.worth[c] >= 0 ? "+" : "")}${(t.worth[c] - base.worth[c]).toFixed(3)}`).join("、")}`);
}
P();
P("== E. 每一批的細節(C 的各批,再來是 B 的每一批)");
for (const x of fin) { P(block(x.b, readBatch(`C 關 s${x.seed}`, `tuning/40/runs/off-s${x.seed}.txt.state.json`))); P(); }
for (const b of screen) { P(block(b, offS)); P(); }
