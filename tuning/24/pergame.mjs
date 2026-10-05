// #24: game by game, an older tree (e.g. `git archive 19ecae2` unpacked somewhere) under a variant of
// its tuning/23/variants.mjs, against THIS tree under its default rules, same seeds; the action lists,
// the winner, the reason, the last turn and the mandate compared.
//   node tuning/24/pergame.mjs <old tree> [first seed] [count] [variant, default P10s]
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [oldDir, firstArg = "1", countArg = "20", V = "P10s"] = process.argv.slice(2);
if (!oldDir) { console.error("usage: node tuning/24/pergame.mjs <old tree> [first] [count] [variant]"); process.exit(2); }
const o = await import(pathToFileURL(resolve(oldDir, "tests/sim.js")).href);
const { VARIANTS } = await import(pathToFileURL(resolve(oldDir, "tuning/23/variants.mjs")).href);
const n = await import(new URL("../../tests/sim.js", import.meta.url).href);
const first = Number(firstArg), count = Number(countArg);
const strip = (a) => JSON.stringify(a.map(({ why, ...x }) => x));
let same = 0, differ = 0;
for (let s = first; s < first + count; s++) {
  const a = o.playGame(s, { options: VARIANTS[V].options }).st, b = n.playGame(s, {}).st;
  const ok = strip(a.actions) === strip(b.actions) && a.winner === b.winner && a.reason === b.reason && a.turn === b.turn && a.mandate === b.mandate;
  if (ok) same++; else { differ++; console.log(`seed ${s} differs: ${a.actions.length} vs ${b.actions.length} actions, ${a.reason}/${b.reason}`); }
}
console.log(`PERGAME ${V} (old) vs default (this tree), seeds ${first}..${first + count - 1}: same ${same}, differ ${differ}`);
