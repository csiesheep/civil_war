// #42: a stricter companion to tuning/37/same.mjs. Two tests/sim.js state files of one cell: every leaf of `sum`
// AND of `more` under the UNION of both sides' keys (same.mjs reads `more` only under the keys both have, so a
// reading one side lacks would pass there), plus the error count. A pair of numbers that differ only in a float's
// last digits (|a − b| ≤ 1e-9 · max(|a|, |b|), from the order the chunks were added up) is counted apart.
// Prints SAME (with the leaf counts and the float pairs) or DIFFER and every difference (at most 20; exit 1).
//   node tuning/42/same-all.mjs <a.state.json> <b.state.json> [cell=full]
import { readFileSync } from "node:fs";

const [fa, fb, cell = "full"] = process.argv.slice(2);
const ca = JSON.parse(readFileSync(fa, "utf8")).cells[cell], cb = JSON.parse(readFileSync(fb, "utf8")).cells[cell];
let leaves = 0;
const floats = [], diffs = [];
function walk(a, b, at) {
  if (a !== null && typeof a === "object" && b !== null && typeof b === "object") {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) walk(a[k], b[k], `${at}.${k}`);
    return;
  }
  leaves++;
  if (a === b) return;
  if (typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b))) floats.push(`${at}: ${a} vs ${b}`);
  else diffs.push(`${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
}
walk(ca.sum, cb.sum, "sum");
walk((ca.errors || []).length, (cb.errors || []).length, "errors");
walk(ca.more || {}, cb.more || {}, "more");
if (diffs.length) {
  console.log(`DIFFER ${diffs.length} of ${leaves} leaves (sum + errors + more, union of keys)`);
  for (const d of diffs.slice(0, 20)) console.log(`  ${d}`);
  process.exitCode = 1;
} else console.log(`SAME games ${ca.sum.games}: ${leaves} leaves (sum + errors + more, union of keys), ${floats.length} differ in a float's last digits${floats.length ? ":" : ""}`);
for (const f of diffs.length ? [] : floats.slice(0, 20)) console.log(`  float ${f}`);
