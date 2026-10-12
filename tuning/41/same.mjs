// #41: "no new option = today's C" (brief #41, 三 and 四 2): two state files of the same seed batch, every leaf of
// the cell's `sum` (keys sorted at every level, the union of both sides), the error count, and every leaf of `more`
// under the keys both have (`more.c` included: C's own numbers). Prints SAME with the leaf counts, or DIFFER and the
// first difference (exit 1).
//   node tuning/41/same.mjs <a.state.json> <b.state.json> [cell]
import { readFileSync } from "node:fs";

const [fa, fb, cell = "full"] = process.argv.slice(2);
const ca = JSON.parse(readFileSync(fa, "utf8")).cells[cell], cb = JSON.parse(readFileSync(fb, "utf8")).cells[cell];
let leaves = 0;
function diff(a, b, at, both = false) {
  if (a !== null && typeof a === "object" && b !== null && typeof b === "object") {
    const keys = both ? Object.keys(a).filter((k) => k in b) : [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys.sort()) {
      const d = diff(a[k], b[k], `${at}.${k}`, both);
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
const d3 = d2 || diff(ca.more || {}, cb.more || {}, "more", true), moreLeaves = leaves;
if (d3) { console.log(`DIFFER ${d3}`); process.exitCode = 1; }
else console.log(`SAME games ${ca.sum.games}: ${sumLeaves} leaves of sum (union of keys), errors ${(ca.errors || []).length}; more (keys both have, more.c included): ${moreLeaves} leaves`);
