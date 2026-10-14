// #42: the identity checks' red case. Copies a tests/sim.js state file with one leaf of the cell's `sum` (or
// `more`) changed by +1, so that tuning/37/same.mjs, run on the copy against the original, has to say DIFFER.
// The leaf is the first number found walking `sum.<key>` (keys sorted), or the path given.
//   node tuning/42/tamper.mjs <in.state.json> <out.state.json> [path, e.g. sum.c.mandate] [cell=full]
import { readFileSync, writeFileSync } from "node:fs";

const [fin, fout, path = "sum.c", cell = "full"] = process.argv.slice(2);
const s = JSON.parse(readFileSync(fin, "utf8"));
const c = s.cells[cell];
let at = c, name = `cells.${cell}`;
for (const k of path.split(".")) { at = at[k]; name += `.${k}`; if (at === undefined) throw new Error(`no ${name}`); }
function first(o, p) {
  if (typeof o === "number") return p;
  if (o === null || typeof o !== "object") return null;
  for (const k of Object.keys(o).sort()) { const r = first(o[k], [...p, k]); if (r) return r; }
  return null;
}
const leaf = typeof at === "number" ? [] : first(at, []);
if (!leaf) throw new Error(`no number under ${name}`);
let parent = c;
const full = [...path.split("."), ...leaf];
for (const k of full.slice(0, -1)) parent = parent[k];
const last = full[full.length - 1];
console.log(`tamper cells.${cell}.${full.join(".")}: ${parent[last]} -> ${parent[last] + 1}`);
parent[last] += 1;
writeFileSync(fout, JSON.stringify(s));
