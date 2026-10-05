// #28: is the new default exactly what #27 measured? Two state files of the same seed batch,
// compared as the brief says: every leaf of the cell's `sum` (keys sorted at every level, the union
// of both sides, so a key on one side only is a difference), the error count, and of `more` only the
// keys BOTH files have (tuning/27's B-s* ran before `firstIsolatedEnd` was added to tests/sim.js).
// `ms` and `done` are not compared (time, and the order the workers finished in).
// Prints SAME and the column counts, or DIFFER and the first difference (exit 1).
//   node tuning/28/same.mjs <a.state.json> <b.state.json> [cell]
import { readFileSync } from "node:fs";

const [fa, fb, cell = "full"] = process.argv.slice(2);
const ca = JSON.parse(readFileSync(fa, "utf8")).cells[cell], cb = JSON.parse(readFileSync(fb, "utf8")).cells[cell];
let leaves = 0;
function diff(a, b, at, both = false) {
  if (a !== null && typeof a === "object" && b !== null && typeof b === "object") {
    const keys = both ? Object.keys(a).filter((k) => k in b) : [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys.sort()) {
      const d = diff(a[k], b[k], `${at}.${k}`);
      if (d) return d;
    }
    return null;
  }
  leaves++;
  return a === b ? null : `${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}
const d1 = diff(ca.sum, cb.sum, "sum"), sumLeaves = leaves;
const d2 = d1 || diff({ errors: (ca.errors || []).length }, { errors: (cb.errors || []).length }, "");
leaves = 0;
const ma = ca.more || {}, mb = cb.more || {};
const d3 = d2 || diff(ma, mb, "more", true), moreLeaves = leaves;
const onlyA = Object.keys(ma).filter((k) => !(k in mb)), onlyB = Object.keys(mb).filter((k) => !(k in ma));
if (d3) { console.log(`DIFFER ${d3}`); process.exitCode = 1; }
else console.log(`SAME games ${ca.sum.games}: ${sumLeaves} columns of sum (union of keys), errors ${(ca.errors || []).length}, ${moreLeaves} columns of more (keys both have; only in a: [${onlyA}], only in b: [${onlyB}])`);
