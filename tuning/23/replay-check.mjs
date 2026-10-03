// #23: a variant's games replay. Plays `n` games of the variant with the normal bots (tests/sim.js's
// playGame), then rebuilds each from `st.seed`, `st.options` and `st.actions` alone (engine `replay`)
// and compares the two final states.
//   node tuning/23/replay-check.mjs <variant> [n] [first seed]
import * as E from "../../public/shared/engine.js";
import { playGame } from "../../tests/sim.js";
import { VARIANTS, searchVariant } from "./variants.mjs";

const [name = "base", nArg = "20", firstArg = "1"] = process.argv.slice(2);
const v = VARIANTS[name] || searchVariant(name);
if (!v) { console.error(`unknown variant ${name}`); process.exit(2); }
const n = Number(nArg), first = Number(firstArg);
const keyOf = (st) => JSON.stringify({ winner: st.winner, reason: st.reason, turn: st.turn, mandate: st.mandate, inf: st.inf, support: st.support, seals: st.seals, mie: st.mie, options: st.options, actions: st.actions.length });
let same = 0, differ = 0, optionsKept = 0;
for (let seed = first; seed < first + n; seed++) {
  const { st } = playGame(seed, { options: v.options });
  if (Object.entries(v.options).every(([k, x]) => JSON.stringify(st.options[k]) === JSON.stringify(x))) optionsKept++;
  const again = E.replay(st.seed, st.options, st.actions);
  if (keyOf(again) === keyOf(st)) same++;
  else { differ++; console.log(`seed ${seed}: the replay differs`); }
}
console.log(`REPLAY ${name}: ${n} games, ${same} replayed to the same end, ${differ} differ; the variant's options in st.options in ${optionsKept} / ${n}`);
