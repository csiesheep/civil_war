// #24: two state files of the same seed batch, compared column by column: every leaf of the cell's
// `sum` (winsBySide and aheadByTurn included, unlike tuning/23/same.mjs) and the errors. Only the
// meta differs between them (variant name, its options, and so the RULES_VERSION they ran under).
// Prints the first difference, or SAME and how many columns were compared.
//   node tuning/24/same.mjs <a.state.json> <b.state.json> [cell]
import { readFileSync } from "node:fs";

const [fa, fb, cell = "full"] = process.argv.slice(2);
const ca = JSON.parse(readFileSync(fa, "utf8")).cells[cell], cb = JSON.parse(readFileSync(fb, "utf8")).cells[cell];
let leaves = 0;
// Keys compared in sorted order: the files add chunks in whatever order the workers finished.
function diff(a, b, at) {
  if (a !== null && typeof a === "object" && b !== null && typeof b === "object") {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const d = diff(a[k], b[k], `${at}.${k}`);
      if (d) return d;
    }
    return null;
  }
  leaves++;
  return a === b ? null : `${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}
const d = diff(ca.sum, cb.sum, "sum") || diff({ errors: (ca.errors || []).length }, { errors: (cb.errors || []).length }, "");
console.log(d ? `DIFFER ${d}` : `SAME ${leaves} columns (games ${ca.sum.games}; every column of sum, winsBySide and aheadByTurn included, and the error count)`);
