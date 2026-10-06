// #33: screen variants one after another: N games each, cell full, normal vs normal, then tests/targets.mjs on
// each state file. Plays the code of <snapshot> (a detached checkout of the branch at a commit, so edits in the
// work tree cannot reach the child processes mid-run):
//   node tuning/33/screen.mjs <snapshot> <outdir> <jobs> <games> <seed> <variant> [<variant> …]
// Writes <outdir>/<variant>-s<seed>-<games>.txt(.state.json, .state.json.targets.txt); --resume as always.
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [snap, out, jobs, games, seed, ...variants] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
for (const v of variants) {
  const f = path.join(out, `${v}-s${seed}-${games}.txt`);
  const r = spawnSync(process.execPath, [path.join(snap, "tests/sim.js"), games, "--cell=full", `--seed=${seed}`, `--jobs=${jobs}`, `--variant=${v}`, `--out=${f}`, "--resume"], { stdio: ["ignore", "ignore", "ignore"] });
  const t = spawnSync(process.execPath, [path.join(snap, "tests/targets.mjs"), `${f}.state.json`], { encoding: "utf8" });
  writeFileSync(`${f}.state.json.targets.txt`, (t.stdout || "") + (t.stderr || ""));
  const line = (t.stdout || "").split(/\r?\n/).find((l) => l.startsWith("TARGETS")) || "(no TARGETS line)";
  console.log(`done ${v} s${seed} sim exit ${r.status} ${line}`);
}
console.log("SCREEN-DONE");
