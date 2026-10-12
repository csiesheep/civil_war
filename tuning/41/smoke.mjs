// #41: one game (or a few) of normal vs normal under the options named, with the C entries of the log counted;
// a crash names itself. Not a measurement.
//   node tuning/41/smoke.mjs <seed> <games> '<options JSON>'
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";
const first = Number(process.argv[2] || 1), games = Number(process.argv[3] || 1);
const options = { mechanismC: true, ...(process.argv[4] ? JSON.parse(process.argv[4]) : {}) };
for (let seed = first; seed < first + games; seed++) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, options), n = 0;
  const t0 = Date.now();
  while (st.winner == null && ++n < 4000) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    const d = B.decide(E.view(st, side), side, "normal", rng);
    const { game, why, ...a } = d;
    st = E.apply(st, a);
  }
  const count = {};
  for (const l of st.log) if (["plant", "purge", "leak", "defect", "handover", "moleNo", "moleMandate", "molesHome", "moleGain"].includes(l.type)) count[l.type + (l.free ? ":free" : "")] = (count[l.type + (l.free ? ":free" : "")] || 0) + 1;
  const mand = st.log.filter((l) => l.type === "moleMandate").map((l) => l.n).join(",");
  console.log(`seed ${seed}: winner ${st.winner} ${st.reason} turn ${st.turn} actions ${n} ${((Date.now() - t0) / 1000).toFixed(1)} s`, JSON.stringify(count), mand ? `moleMandate n ${mand}` : "", JSON.stringify(st.moles.at));
}
