// #39 probe: the two group-16 checks that came out red on the first build, printed in full.
// node tuning/39/probe-rigs.mjs
import * as E from "../../public/shared/engine.js";
const CCP = 0, KMT = 1;
const J = (x) => JSON.stringify(x ?? null);
// The acceptance's rig, re-built here the same way (position = createGame(11, { aid:false, ...options }), the free
// placements answered with the first options, the cards dealt, turn 1's action round reached).
function rig({ ccp = [], kmt = [], hand = null, at = {}, options = { mechanismC: true }, edits = {} } = {}) {
  let st = E.createGame(11, { aid: false, ...options });
  if (st.pending) st = E.apply(st, { type: "choose", side: CCP, choice: st.pending.options.slice(0, st.pending.n) });
  if (st.pending) st = E.apply(st, { type: "choose", side: KMT, choice: st.pending.options.slice(0, st.pending.n) });
  st = E.clone(st);
  for (const [id, e] of Object.entries(edits)) { const a = st.inf[id] || (st.inf[id] = [0, 0]); if (e.r != null) a[0] = e.r; if (e.b != null) a[1] = e.b; }
  st.discard.push(...st.hands[CCP], ...st.hands[KMT]);
  st.hands = [[], []];
  const deal = (side, cards) => { for (const p of ["draw", "discard", "removed"]) st[p] = st[p].filter((c) => !cards.includes(c)); st.hands[side] = cards.slice(); };
  deal(CCP, ["score_north", ...ccp]); deal(KMT, ["score_east", ...kmt]);
  for (const side of [CCP, KMT]) { const c = st.hands[side].find((x) => E.CARD[x].scoring); if (c) st = E.apply(st, { type: "headline", side, card: c }); }
  st.mandate = 0;
  if (hand) E.setMoleHand(st, hand);
  for (const [id, l] of Object.entries(at)) E.setMoles(st, id, l);
  return st;
}
const what = process.argv[2] || "all";
if (what === "all" || what === "purgeE") {
  const S = rig({ kmt: ["kunming_incident"], hand: [0, 0], at: { taiyuan: [false] }, options: { mechanismC: true, mechanismE: true } });
  const a = E.apply(S, { type: "play", side: KMT, card: "kunming_incident", use: "politics", purge: ["taiyuan"] });
  console.log("purge under E: mandate", S.mandate, "->", a.mandate, "centrists", E.centristsOf(S), "->", E.centristsOf(a));
  console.log("  log since the play:", J(a.log.slice(a.log.findIndex((l) => l.type === "play" && l.side === KMT)).map((l) => ({ ...l, i: undefined, t: undefined }))));
}
if (what === "all" || what === "noLeak") {
  const S = rig({ edits: { jinan: { b: 3 } }, ccp: ["huaihai_campaign"], kmt: ["kunming_incident"], hand: [0, 0] });
  let a = E.apply(S, { type: "play", side: CCP, card: "huaihai_campaign", use: "campaign", target: "jinan", siege: "relief" });
  console.log("no marker: after the play, pending", J(a.pending && { who: a.pending.who, tag: a.pending.tag }));
  a = E.apply(a, { type: "choose", side: KMT, choice: "hold" });
  console.log("  after 固守: pending", J(a.pending), "phase", a.phase, "actor", a.actor, "round", a.round, "jinan", E.infOf(a, "jinan").join("/"), "besieged", E.besieged(a, "jinan"));
  console.log("  the check's expression `none.pending && none.pending.tag === \"leak\"` is", J(a.pending && a.pending.tag === "leak"));
}
