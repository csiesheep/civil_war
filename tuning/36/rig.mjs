// #36: the positions of tests/bots.test.js B7, rebuilt the same way for the probes (tests/ is the
// orchestrator's; this copies its rig, it does not import it, so a probe never runs the bot games).
import * as E from "../../public/shared/engine.js";

export const CCP = 0, KMT = 1;
export const MEX = { mechanismE: true };
export function opening(options = {}) {
  let st = E.createGame(11, options);
  for (let guard = 0; st.pending && guard < 10; guard++) st = E.apply(st, { type: "choose", side: st.pending.who, choice: st.pending.options.slice(0, st.pending.n ?? 1) });
  if (st.pending || st.phase !== "headline") throw new Error(`opening: phase ${st.phase}`);
  return E.clone(st);
}
export function deal(st, side, cards) {
  for (const pile of ["draw", "discard", "removed"]) st[pile] = st[pile].filter((c) => !cards.includes(c));
  st.hands[1 - side] = st.hands[1 - side].filter((c) => !cards.includes(c));
  st.hands[side] = cards.slice();
}
export function eBoard({ ccp = [], kmt = [], inflation = 0, leftism = 0, centrists = 0, options = {} } = {}) {
  let st = opening({ aid: false, ...MEX, ...options });
  deal(st, CCP, ["score_north", ...ccp]); deal(st, KMT, ["score_east", ...kmt]);
  for (const side of [CCP, KMT]) st = E.apply(st, { type: "headline", side, card: st.hands[side].find((c) => E.CARD[c].scoring) });
  E.setInflation(st, inflation); E.setLeftism(st, leftism); E.setCentrists(st, centrists);
  return st;
}
export function atRoundE(turn, round, actor, hands, options) {
  let st = opening({ aid: false, ...options });
  if (turn > 1) {
    st.turn = turn - 1; st.round = 0; st.effects = []; st.era = E.eraOf(turn).id; st.draw = []; st.discard = []; st.later = {};
    st.headline = [null, null]; st.phase = "action"; st.pending = null; st.plan = [{ do: "startTurn" }];
  }
  deal(st, CCP, hands[CCP]); deal(st, KMT, hands[KMT]);
  if (turn > 1) st = E.run(st);
  if (st.pending || st.phase !== "headline" || st.turn !== turn) throw new Error(`atRoundE: turn ${st.turn} phase ${st.phase}`);
  for (const side of [CCP, KMT]) st = E.apply(st, { type: "headline", side, card: st.hands[side].find((c) => E.CARD[c].scoring) });
  st = E.clone(st); st.round = round; st.actor = actor;
  return st;
}
export const printed = (a) => !!(a && (a.print || (a.choice && typeof a.choice === "object" && a.choice.print)));
