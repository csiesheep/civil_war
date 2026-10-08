// #36: with E off, does the bot decide exactly as before? Plays games (default rules, or the options given as
// JSON) with this branch's bot, and at every decision asks the bot of c3d28a8 the same question with a copy of
// the rng (both must leave the rng in the same state too). The old bot is a copy put beside the engine:
//   git show c3d28a8:public/shared/bots.js > public/shared/__orch_bots_old.js     (ignored by .gitignore)
//   node tuning/36/off-same.mjs [games=4] [first=1] [options JSON]
// Prints SAME and the number of decisions, or DIFFER and the first difference (exit 1).
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";
import * as O from "../../public/shared/__orch_bots_old.js";

const games = Number(process.argv[2] || 4), first = Number(process.argv[3] || 1), options = JSON.parse(process.argv[4] || "{}");
let n = 0;
for (let seed = first; seed < first + games; seed++) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, options);
  for (let k = 0; st.winner == null && k < 4000; k++) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    const r2 = E.makeRng(rng.getState());
    const a = B.decide(E.view(st, side), side, "normal", rng);
    const b = O.decide(E.view(st, side), side, "normal", r2);
    const ja = JSON.stringify(a), jb = JSON.stringify(b);
    if (ja !== jb || rng.getState() !== r2.getState()) {
      console.log(`DIFFER seed ${seed} decision ${k} (rng ${rng.getState()} vs ${r2.getState()}): new ${ja.slice(0, 300)} / old ${jb.slice(0, 300)}`);
      process.exit(1);
    }
    n++;
    const { game, ...move } = a;
    st = E.apply(st, move);
  }
}
console.log(`SAME ${games} games from seed ${first}, ${n} decisions, options ${JSON.stringify(options)}`);
