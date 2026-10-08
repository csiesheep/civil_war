// #37: the appendix of tuning/37/report.txt, every number read from the state files under tuning/37/runs
// (tests/sim.js) and the tests/targets.mjs output next to each; nothing copied by hand.
//   node tuning/37/report.mjs
// runs/same/   E on, seed 1, 300 games: origin/main 02d7a39 (Eon-main) and this branch with no new option (Eon-branch)
// runs/screen/ the screening, seed 1, 300 games each
// runs/final/  the three picked, seeds 1 / 20001 / 40001, 1000 games each
// The E column of B is runs/same/Eon-main (today's E, the same 300 games as the screening's seed batch).
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { readBatch, block, row, dist } from "./goals.mjs";

const R = "tuning/37/runs";
const P = (s = "") => console.log(s);
const files = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".state.json")).sort() : []);
const pct = (k, n) => (n ? `${((100 * k) / n).toFixed(1)}%` : "–");

P("== A. 不給新選項 = 今天的 E(E 開、--seed=1、300 局;tuning/37/same.mjs)");
const same = spawnSync(process.execPath, ["tuning/37/same.mjs", `${R}/same/Eon-branch-s1-300.txt.state.json`, `${R}/same/Eon-main-s1-300.txt.state.json`], { encoding: "utf8" });
P(`分支 vs origin/main 02d7a39:${(same.stdout || same.stderr).trim()}(exit ${same.status})`);
const red = spawnSync(process.execPath, ["tuning/37/same.mjs", `${R}/same/Eon-main-s1-300.txt.state.json`, `${R}/screen/ME-cap1-s1-300.txt.state.json`], { encoding: "utf8" });
P(`(比對腳本會紅:origin/main 的 E vs ME-cap1 → ${(red.stdout || red.stderr).trim()},exit ${red.status})`);
P();

const order = ["E", "ME-cap1", "ME-cap2", "ME-ops1", "ME-step2", "ME-pain", "ME-early", "ME-peg1", "ME-rad3", "ME-cvp2",
  "ME-cap1+ops1", "ME-cap1+pain", "ME-cap1+early", "ME-cap1+ops1+pain", "ME-cap1+ops1+early"];
const screen = [readBatch("E", `${R}/same/Eon-main-s1-300.txt.state.json`),
  ...files(`${R}/screen`).map((f) => readBatch(f.replace(/-s1-300\.txt\.state\.json$/, ""), `${R}/screen/${f}`))]
  .sort((a, b) => (order.indexOf(a.name) + 1 || 99) - (order.indexOf(b.name) + 1 || 99));
P("== B. 篩選(--seed=1、300 局、普通對普通;E = 今天的 E,其餘都疊在 E 上)");
P("   G1 十項 ≥ 8(含民心曲線)且共軍 35–65%;G2 第 3 回合末通膨中位 ≤ 5,且通膨到 8 的局過半在第 5 回合以後;G3 每局印鈔 ≥ 2、激進 ≥ 1");
for (const b of screen) P(row(b));
P();
P("民心曲線(每回合末 共軍領先 / 國軍領先,已結束的算贏家;targets 第 1 項)");
for (const b of screen) P(`  ${b.name.padEnd(22)} ${(b.curve.split(" · ")[2] || "").replace("共軍領先 / 國軍領先(已結束的算贏家):", "")}`);
P();

const fin = files(`${R}/final`).map((f) => { const m = f.match(/^(.*)-s(\d+)-1000\.txt\.state\.json$/); return readBatch(`${m[1]} s${m[2]}`, `${R}/final/${f}`); });
if (fin.length) {
  P("== C. 最好的三個 × 三批種子(各 1000 局)");
  for (const b of fin) P(row(b));
  P();
  P("十項逐項(tests/targets.mjs 的「通過 / 失敗」行;O = 通過、x = 失敗;欄是上面各批的順序)");
  const tl = (b) => readFileSync(`${b.file}.targets.txt`, "utf8").split(/\r?\n/).filter((l) => /^(通過|失敗) · /.test(l));
  const labs = tl(fin[0]).map((l) => l.split(" · ")[1]);
  labs.forEach((lab, i) => P(`  ${fin.map((b) => (tl(b)[i] || "").startsWith("通過") ? "O" : "x").join(" ")}  ${lab}`));
  P();
  P("民心曲線(C 的各批)");
  for (const b of fin) P(`  ${b.name.padEnd(28)} ${(b.curve.split(" · ")[2] || "").replace("共軍領先 / 國軍領先(已結束的算贏家):", "")}`);
  P();
}
P("== D. 每一批的細節(C 的各批,再來是 B 的每一批)");
for (const b of [...fin, ...screen]) { P(block(b)); P(); }
