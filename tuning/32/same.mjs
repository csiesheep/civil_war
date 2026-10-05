// #32: with D off, is every bot decision the same? Two state files of tests/sim.js for the same seed batch,
// compared as the brief says: `cells.<cell>.sum` with the keys sorted at every level (the union of both
// sides, so a key on one side only is a difference), plus the number of errors. `ms` and `done` are not
// compared (time; the order the workers finished in). `more` is compared on the keys both files have and
// reported apart (it is not the brief's criterion; tests/sim.js only ever adds keys to it).
// Prints SAME (exit 0) or DIFFER and the first difference (exit 1).
//   node tuning/32/same.mjs <a.state.json> <b.state.json> [cell=full]
import { readFileSync } from "node:fs";

const [fa, fb, cell = "full"] = process.argv.slice(2);
const ca = JSON.parse(readFileSync(fa, "utf8")).cells[cell], cb = JSON.parse(readFileSync(fb, "utf8")).cells[cell];
if (!ca || !cb) { console.log(`DIFFER: cell ${cell} missing in ${!ca ? fa : fb}`); process.exit(1); }
let leaves = 0;
function diff(a, b, at, both = false) {
  if (a !== null && typeof a === "object" && b !== null && typeof b === "object") {
    const keys = both ? Object.keys(a).filter((k) => k in b) : [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys.sort()) { const d = diff(a[k], b[k], `${at}.${k}`); if (d) return d; }
    return null;
  }
  leaves++;
  return a === b ? null : `${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}
const d1 = diff(ca.sum, cb.sum, "sum"), sumLeaves = leaves;
const d2 = d1 || diff({ errors: (ca.errors || []).length }, { errors: (cb.errors || []).length }, "");
leaves = 0;
const d3 = diff(ca.more || {}, cb.more || {}, "more", true), moreLeaves = leaves;
if (d2) { console.log(`DIFFER ${d2}`); process.exitCode = 1; }
else console.log(`SAME games ${ca.sum.games}: ${sumLeaves} leaves of sum (union of keys), errors ${(ca.errors || []).length}; more (keys both have, not the criterion): ${d3 ? "differs " + d3 : `same, ${moreLeaves} leaves`}`);
