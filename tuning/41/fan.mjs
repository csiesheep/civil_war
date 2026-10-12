// #41: a probe script over many seeds in child processes; each child's stdout to tuning/41/runs/probe/<name>-<k>.txt
// (a file already there with output is kept).
//   node tuning/41/fan.mjs <script> <name> <games> <jobs> <first seed> [extra args …]
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
const [script, name, games, jobs, first, ...extra] = process.argv.slice(2);
const R = "tuning/41/runs/probe", G = Number(games), J = Number(jobs), F = Number(first), per = Math.ceil(G / J);
mkdirSync(R, { recursive: true });
const todo = [];
for (let k = 0; k * per < G; k++) {
  const f = `${R}/${name}-${k}.txt`;
  if (existsSync(f) && readFileSync(f, "utf8").trim()) continue;
  todo.push({ f, a: F + k * per, n: Math.min(per, G - k * per) });
}
await Promise.all(todo.map(({ f, a, n }) => new Promise((done) => {
  const ch = spawn(process.execPath, [script, String(a), String(n), ...extra]);
  let out = "";
  ch.stdout.on("data", (d) => { out += d; });
  ch.stderr.on("data", (d) => { out += d; });
  ch.on("close", (code) => { writeFileSync(f, out); if (code) console.log(`${f}: exit ${code}`); done(); });
})));
console.log(`${name}: done`);
