// Random legal games for the fuzz test. Orchestrator's file (TEAM.md).
// The random helpers are the product's (public/shared/random.js: they are the "easy" level of the
// bots and the base of the others); this only adds the game loop. Until that module exists the
// import below fails, which tests/fuzz.test.js reads as 尚未實作.
import * as E from "../public/shared/engine.js";
import { randomAction } from "../public/shared/random.js";
export { randomAction, randomPoints, randomOps, randomChoice } from "../public/shared/random.js";

const pickOne = (arr, rng) => arr[rng.int(arr.length)];

// Play a whole game with random legal actions. Returns the final state and
// the number of actions taken. Throws when nobody can act, when the product
// offers no action, when an offered action is refused, or when the game does
// not end: each of those is what the fuzz is looking for.
export function playRandomGame(seed, options = {}, { maxActions = 4000, onStep } = {}) {
  const rng = E.makeRng(seed ^ 0x9e3779b9);
  let st = E.createGame(seed, options);
  let n = 0;
  while (st.winner == null) {
    if (++n > maxActions) throw new Error(`game ${seed} did not end in ${maxActions} actions (turn ${st.turn}, phase ${st.phase})`);
    const who = E.mustAct(st);
    if (!who.length) throw new Error(`game ${seed}: nobody must act (turn ${st.turn}, phase ${st.phase}, plan ${JSON.stringify(st.plan[0])})`);
    const side = pickOne(who, rng);
    const action = randomAction(st, side, rng);
    if (!action) throw new Error(`game ${seed}: no action for side ${side} (turn ${st.turn}, phase ${st.phase})`);
    try { st = E.apply(st, action); }
    catch (e) { throw new Error(`game ${seed}, turn ${st.turn}, phase ${st.phase}: the engine refused ${JSON.stringify(action)}: ${e && e.message}`); }
    if (onStep) onStep(st, action);
  }
  return { st, actions: n };
}
