// #40: B8's declinedLeak() position rebuilt here (the helpers of tests/bots.test.js copied, not imported: that file
// runs its checks on import), and what the bot reads there: the belief, `B.purgeValue` for 濟南 and 太原, and the
// same with the log's `moleNo` entries taken out of the view (the same board, the belief of the prior alone), and
// each city's class (the capital, a 孤城, a city next to a Communist space, other).
//   node tuning/40/probe-rig.mjs
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";
const CCP = 0, KMT = 1, J = JSON.stringify;
function opening(options = {}) {
  let st = E.createGame(11, options);
  for (let guard = 0; st.pending && guard < 10; guard++) st = E.apply(st, { type: "choose", side: st.pending.who, choice: st.pending.options.slice(0, st.pending.n ?? 1) });
  return E.clone(st);
}
function board(edits, options) { const st = opening(options); for (const [id, rb] of Object.entries(edits)) st.inf[id] = rb.slice(); return st; }
function deal(st, side, cards) {
  for (const pile of ["draw", "discard", "removed"]) st[pile] = st[pile].filter((c) => !cards.includes(c));
  st.hands[1 - side] = st.hands[1 - side].filter((c) => !cards.includes(c));
  st.hands[side] = cards.slice();
}
function cBoard({ edits = {}, ccp = [], kmt = [], hand = null, at = {} } = {}) {
  let st = board(edits, { aid: false, mechanismC: true });
  deal(st, CCP, ["score_north", ...ccp]); deal(st, KMT, ["score_east", ...kmt]);
  for (const side of [CCP, KMT]) st = E.apply(st, { type: "headline", side, card: st.hands[side].find((c) => E.CARD[c].scoring) });
  st = E.clone(st);
  if (hand) E.setMoleHand(st, hand);
  for (const [id, list] of Object.entries(at)) E.setMoles(st, id, list);
  return st;
}
let st = cBoard({ edits: { jinan: [0, 3] }, ccp: ["huaihai_campaign"], kmt: ["kunming_incident", "takeover_officials"], hand: [1, 0], at: { jinan: [false], taiyuan: [false] } });
st = E.apply(st, { type: "play", side: CCP, card: "huaihai_campaign", use: "campaign", target: "jinan", siege: "relief" });
st = E.apply(st, { type: "choose", side: KMT, choice: "hold" });
st = E.apply(st, { type: "choose", side: CCP, choice: "no" });
const v = E.view(st, KMT), bare = { ...v, log: v.log.filter((l) => l.type !== "moleNo") };
const iso = E.isolatedCities(st), klass = (id) => (id === E.homeCapital(st, KMT) ? "capital" : iso.includes(id) ? "孤城" : E.adjOf(st, id).some((a) => E.controller(st, a) === CCP) ? "open" : "other");
console.log("turn", st.turn, "C_W", J(B.C_W));
console.log("belief with the no:", J(B.moleBelief(v)), " without:", J(B.moleBelief(bare)));
for (const id of ["jinan", "taiyuan"]) console.log(id, klass(id), "purgeValue with the no", B.purgeValue(v, [id]).toFixed(3), "without", B.purgeValue(bare, [id]).toFixed(3));
