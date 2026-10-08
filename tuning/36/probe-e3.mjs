// #36 §四 3: E decisions the acceptance does not pin. Positions built as B7 builds them (tuning/36/rig.mjs),
// with the aid cards on (平抑 needs 美援), at turn 4 (易勢期) round 2; 20 decisions per row, rngs 900..919.
//   - the Communists to act, leftism 0 / 1 / 3 / 5: how often they 激進, and the price of the step.
//   - the Nationalists to act, inflation 0 / 2 / 5 / 7 / 8 / 9: how often they print, how often they peg.
//   node tuning/36/probe-e3.mjs
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";
import { atRoundE, MEX, CCP, KMT, printed } from "./rig.mjs";

const hands = [["score_north", "shangdang_campaign", "gao_shuxun", "soviet_arms"], ["score_east", "kunming_incident", "takeover_officials", "japanese_garrisons"]];
for (const h of hands.flat()) if (!E.CARD[h]) throw new Error(`no card ${h}`);
const ask = (st, side) => Array.from({ length: 20 }, (_, i) => B.decide(E.view(st, side), side, "normal", E.makeRng(900 + i)));
const radical = (a) => !!(a && (a.radical || (a.choice && typeof a.choice === "object" && a.choice.radical)));
const at = (actor) => { const st = atRoundE(4, 2, actor, hands, { ...MEX, aid: true }); st.support = [2, 2]; return st; };

for (const n of [0, 1, 3, 5]) {
  const st = at(CCP); E.setLeftism(st, n);
  const d = ask(st, CCP);
  console.log(`共軍 左傾 ${n}: ePrice ${B.ePrice(st, CCP).toFixed(2)};激進 ${d.filter(radical).length} / 20;radical options ${E.radicalOptions(st, CCP).length}`);
}
for (const n of [0, 2, 5, 7, 8, 9]) {
  const st = at(KMT); E.setInflation(st, n);
  const L = E.legal(st, KMT), d = ask(st, KMT);
  console.log(`國軍 通膨 ${n}: ePrice ${B.ePrice(st, KMT).toFixed(2)};印鈔 ${d.filter(printed).length} / 20;平抑 ${d.filter((a) => a.use === "peg").length} / 20(legal peg ${L.peg})`);
}
