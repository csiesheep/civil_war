// #36 probe: the last turn (turns: 7, turn 7) one action before the game's last: the Nationalists' round 6
// of 7, two cards in hand, at inflation n. What decide picks over 20 rngs, and how often it prints.
//   node tuning/36/probe-round6.mjs [inflation=7] [card2=japanese_garrisons]
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";
import { atRoundE, MEX, KMT, printed } from "./rig.mjs";

const n = Number(process.argv[2] ?? 7), card2 = process.argv[3] || "japanese_garrisons";
const st = atRoundE(7, 6, KMT, [["score_north"], ["score_east", "kunming_incident", card2]], { ...MEX, turns: 7 });
E.setInflation(st, n);
console.log(`turn ${st.turn} round ${st.round} actionsLeft K ${B.actionsLeft(st, KMT)} ePrice ${B.ePrice(st, KMT).toFixed(3)} mandate ${st.mandate}`);
const sc = B.scoreCandidates(E.view(st, KMT), KMT, E.makeRng(5));
for (const { a, v } of sc.slice(0, 8)) console.log(v.toFixed(2), JSON.stringify(a));
const picks = Array.from({ length: 20 }, (_, i) => B.decide(E.view(st, KMT), KMT, "normal", E.makeRng(900 + i)));
console.log(`printed ${picks.filter(printed).length} / 20`);
