// Random legal games for the fuzz test. The random helpers live in the bot
// module (they are the "easy" level); this only adds the game loop.
import * as E from "../public/shared/engine.js";
import { randomAction } from "../public/shared/bots.js";
export { randomAction, randomPoints, randomOps, randomChoice } from "../public/shared/bots.js";

const pickOne = (arr, rng) => arr[rng.int(arr.length)];

// Play a whole game with random legal actions. Returns the final state and
// the number of actions taken.
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
    st = E.apply(st, action);
    if (onStep) onStep(st, action);
  }
  return { st, actions: n };
}
