// #23 round four: two state files of the same batch, compared column by column (the `sum` of each
// cell), leaving out `winsBySide` and `aheadByTurn` (recorded since rounds four and five). Prints the first difference, or
// SAME and how many columns were compared.
//   node tuning/23/same.mjs <a.state.json> <b.state.json> [cell]
import { readFileSync } from "node:fs";

const [fa, fb, cell = "full"] = process.argv.slice(2);
const A = JSON.parse(readFileSync(fa, "utf8")).cells[cell].sum, B = JSON.parse(readFileSync(fb, "utf8")).cells[cell].sum;
let leaves = 0;
// Keys compared in sorted order: the files add chunks in whatever order the workers finished.
function diff(a, b, at) {
  if (a !== null && typeof a === "object" && b !== null && typeof b === "object") {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      if (at === "" && (k === "winsBySide" || k === "aheadByTurn")) continue;
      const d = diff(a[k], b[k], `${at}.${k}`);
      if (d) return d;
    }
    return null;
  }
  leaves++;
  return a === b ? null : `${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}
const d = diff(A, B, "");
console.log(d ? `DIFFER ${d}` : `SAME ${leaves} columns (games ${A.games}; winsBySide and aheadByTurn left out)`);
