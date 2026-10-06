// #33: the appendix of tuning/33/report.txt, every number read from the state files under tuning/33/runs
// (tests/sim.js) and the tests/targets.mjs output next to each; nothing copied by hand.
//   node tuning/33/report.mjs
// runs/same/   D on, seed 1, 300 games: origin/main 874cd47 (Don-main) and this branch with no new option (Don-branch)
// runs/screen/ the screening, seed 1, 300 games each
// runs/final/  the three picked, seeds 1 / 20001 / 40001, 1000 games each
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { readBatch, block, row } from "./goals.mjs";

const R = "tuning/33/runs";
const P = (s = "") => console.log(s);
const files = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".state.json")).sort() : []);

P("== A. 不給新選項 = 今天的 D(D 開、--seed=1、300 局;tuning/32/same.mjs)");
const same = spawnSync(process.execPath, ["tuning/32/same.mjs", `${R}/same/Don-branch-s1-300.txt.state.json`, `${R}/same/Don-main-s1-300.txt.state.json`], { encoding: "utf8" });
P(`分支 vs origin/main 874cd47:${(same.stdout || same.stderr).trim()}(exit ${same.status})`);
const red = spawnSync(process.execPath, ["tuning/32/same.mjs", `${R}/same/Don-main-s1-300.txt.state.json`, `${R}/screen/MD-g4-s1-300.txt.state.json`], { encoding: "utf8" });
P(`(比對腳本會紅:origin/main 的 D vs MD-g4 → ${(red.stdout || red.stderr).trim()},exit ${red.status})`);
P();

const order = ["D", "MD-g4", "MD-bar", "MD-g4bar", "MD-sui4", "MD-g4bar+twice", "MD-g4bar+noBlue", "MD-g4bar+jinL", "MD-g4bar+jinL+twice",
  "MD-sui4bar", "MD-sui4bar+twice", "MD-sui4bar+jinL+twice", "MD-bar+twice", "MD-bar+jinL+twice", "MD-S3", "MD-S3v"];
const screen = files(`${R}/screen`).map((f) => readBatch(f.replace(/-s1-300\.txt\.state\.json$/, ""), `${R}/screen/${f}`))
  .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
P("== B. 篩選(--seed=1、300 局、普通對普通;D = 今天的 D,其餘都疊在 D 上)");
P("   G1 第 0 回合有標記 < 5%;G2 每家易幟、整編完成各 ≥ 5%(列最低的一格);G3 第一個易幟在第 4 回合以後 > 50%;G4 十項 ≥ 8 且共軍 35–65%;G5 統戰合法時選的比例(只報)");
for (const b of screen) P(row(b));
P();

const fin = files(`${R}/final`).map((f) => { const m = f.match(/^(.*)-s(\d+)-1000\.txt\.state\.json$/); return readBatch(`${m[1]} s${m[2]}`, `${R}/final/${f}`); });
P("== C. 最好的三個 × 三批種子(各 1000 局)");
for (const b of fin) P(row(b));
P();
P("十項逐項(tests/targets.mjs 的「通過 / 失敗」行;O = 通過、x = 失敗;欄是上面九批的順序)");
const tl = (b) => readFileSync(`${b.file}.targets.txt`, "utf8").split(/\r?\n/).filter((l) => /^(通過|失敗) · /.test(l));
const labs = tl(fin[0]).map((l) => l.split(" · ")[1]);
labs.forEach((lab, i) => P(`  ${fin.map((b) => (tl(b)[i] || "").startsWith("通過") ? "O" : "x").join(" ")}  ${lab}`));
P();
P("== D. 每一批的細節(C 的九批,再來是 B 的每一批)");
for (const b of [...fin, ...screen]) { P(block(b)); P(); }
