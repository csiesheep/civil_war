// #41 round 2, 證偽 (orchestrator 裁決 #41, 5): put #40's way of pricing a real marker back -- the gain a turn times
// the turns left (p × G × L) instead of its one use (G × (1 − (1 − p)^L)) -- in a throwaway checkout, so that the hold
// probe (tuning/41/probe-hold.mjs) can be run on it and its "bot used" compared with the fixed bot's on the same seeds.
//   node tuning/41/falsify-price.mjs <checkout dir>      (never on the working tree you deliver from)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const f = path.join(process.argv[2], "public/shared/bots.js");
const src = readFileSync(f, "utf8");
const one = "const once = (x, left) => (x.p > 0 && left > 0 ? x.G * (1 - (1 - x.p) ** left) : 0);";
if (!src.includes(one)) throw new Error("the one-use price is not there");
writeFileSync(f, src.replace(one, "const once = (x, left) => x.p * x.G * left; // FALSIFY #41: #40's price, the gain a turn × the turns left"));
console.log("patched", f);
