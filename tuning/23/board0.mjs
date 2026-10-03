// #23: the board a variant starts from, before and after the free placement, next to today's.
//   node tuning/23/board0.mjs <variant> [seed]
// Proof that a variant's numbers reach the board (issue #23, 四 2): every space whose starting
// points differ from today's is printed with both. The free placement is answered by the normal bots.
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";
import { VARIANTS, searchVariant } from "./variants.mjs";

const [name = "base", seedArg = "1"] = process.argv.slice(2);
const v = VARIANTS[name] || searchVariant(name);
if (!v) { console.error(`unknown variant ${name}`); process.exit(2); }
const seed = Number(seedArg);
const fmt = (st, id) => E.infOf(st, id).join("/");
function setupOnly(options) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, options);
  const before = Object.fromEntries(E.SPACES.map((s) => [s.id, fmt(st, s.id)]));
  while (st.turn === 0 && st.winner == null) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    st = E.apply(st, B.decide(E.view(st, side), side, "normal", rng));
  }
  return { st, before };
}
const today = setupOnly({}), mine = setupOnly(v.options);
console.log(`variant ${name}: ${v.what}`);
console.log(`options ${JSON.stringify(v.options)}`);
console.log(`seed ${seed}; points are red/blue (共/國); "start" = before the free placement, "turn 1" = after it\n`);
console.log("space".padEnd(12), "today start".padEnd(12), "variant start".padEnd(14), "today turn 1".padEnd(13), "variant turn 1");
let differ = 0;
for (const s of E.SPACES) {
  const a = today.before[s.id], b = mine.before[s.id], c = fmt(today.st, s.id), d = fmt(mine.st, s.id);
  if (a !== b) differ++;
  console.log(`${s.zh}(${s.id})`.padEnd(16), a.padEnd(12), (b + (a !== b ? " *" : "")).padEnd(14), c.padEnd(13), d);
}
console.log(`\n${differ} spaces start differently from today; support [蘇, 美] today ${today.st.support.join("/")} variant ${mine.st.support.join("/")}`);
