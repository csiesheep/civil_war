// #36 probe: B7's last action (turns: 7, turn 7, the Nationalists' 7th round, 昆明事變 in hand) at
// inflation n: every candidate with its raw value on one guess, and what decide picks over 20 rngs.
//   node tuning/36/probe-last.mjs [inflation=7] [card=kunming_incident] [mandate at the start, as rigged]
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";
import { atRoundE, MEX, KMT, printed } from "./rig.mjs";

const n = Number(process.argv[2] ?? 7), card = process.argv[3] || "kunming_incident", m0 = process.argv[4];
const st = atRoundE(7, 7, KMT, [["score_north"], ["score_east", card]], { ...MEX, turns: 7 });
E.setInflation(st, n); if (m0 != null) st.mandate = Number(m0);
console.log(`turn ${st.turn} round ${st.round} actor ${st.actor} rounds ${st.rounds} actionsLeft K ${B.actionsLeft(st, KMT)} ePrice ${B.ePrice(st, KMT)} mandate ${st.mandate}`);
const sc = B.scoreCandidates(E.view(st, KMT), KMT, E.makeRng(5));
for (const { a, v } of sc) {
  const s = B.simulate(B.determinize(E.view(st, KMT), KMT, E.makeRng(5)), a, E.makeRng(6));
  console.log(v.toFixed(2), JSON.stringify({ ...a, why: undefined }), `winner ${s.winner} ${s.reason} mandate ${s.mandate}`);
}
const picks = Array.from({ length: 20 }, (_, i) => B.decide(E.view(st, KMT), KMT, "normal", E.makeRng(900 + i)));
console.log(`printed ${picks.filter(printed).length} / 20`);
for (const p of picks) console.log(" ", JSON.stringify({ ...p, game: undefined }));
