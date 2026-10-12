// #41: the sim batches, one after the other, each with all the jobs, and tests/targets.mjs on each.
//   node tuning/41/batch.mjs <dir> <games> <seed> <jobs> <variant> [<variant> …]
// A variant `off` plays the default rules (no --variant). Writes <dir>/<variant>-s<seed>-<games>.txt (+ .state.json,
// + .state.json.targets.txt); --resume picks up a batch that died.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const [dir, games, seed, jobs, ...variants] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
for (const v of variants) {
  const out = `${dir}/${v}-s${seed}-${games}.txt`;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ["tests/sim.js", games, "--cell=full", `--seed=${seed}`, `--jobs=${jobs}`, ...(v === "off" ? [] : [`--variant=${v}`]), `--out=${out}`, "--resume"], { encoding: "utf8", maxBuffer: 1 << 26 });
  console.log(`${v} s${seed} ${games}: sim exit ${r.status} (${((Date.now() - t0) / 60000).toFixed(1)} min)${r.status ? " " + (r.stderr || "").slice(-400) : ""}`);
  const t = spawnSync(process.execPath, ["tests/targets.mjs", `${out}.state.json`], { encoding: "utf8" });
  writeFileSync(`${out}.state.json.targets.txt`, (t.stdout || "") + (t.stderr || ""));
  console.log(`${v} s${seed} ${games}: targets exit ${t.status}; ${(t.stdout || "").split("\n").find((l) => l.startsWith("TARGETS")) || ""}`);
}
console.log("ALL-DONE");
