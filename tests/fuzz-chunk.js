// One chunk of the fuzz, in a process of its own (on the owner's machine Node sometimes dies in a
// long run: a chunk that dies is run once more by tests/fuzz.test.js before it is believed).
//   node tests/fuzz-chunk.js <first seed> <count>
// Prints one line, `FUZZ {json}`: what each game ended by, every error with its seed, and for every
// tenth game whether it replays from its seed and recorded actions to the very same state.
import * as E from "../public/shared/engine.js";
import { playRandomGame } from "./driver.js";

const first = Number(process.argv[2] || 1), count = Number(process.argv[3] || 100);
const out = { first, count, ended: 0, actions: 0, errors: [], reasons: {}, turns: {}, replayed: 0, replayMismatch: [], events: {} };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (let seed = first; seed < first + count; seed++) {
  try {
    const { st, actions } = playRandomGame(seed);
    out.ended++; out.actions += actions;
    out.reasons[st.reason] = (out.reasons[st.reason] || 0) + 1;
    out.turns[st.turn] = (out.turns[st.turn] || 0) + 1;
    for (const l of st.log) if (l.type === "event") out.events[l.card] = (out.events[l.card] || 0) + 1;
    if (seed % 10 === 0) {
      out.replayed++;
      const again = E.replay(st.seed, st.options, st.actions);
      if (!same({ ...again, log: null }, { ...st, log: null })) out.replayMismatch.push(seed);
    }
  } catch (e) {
    out.errors.push({ seed, message: String((e && e.message) || e).slice(0, 300), kind: e && e.constructor ? e.constructor.name : "?" });
  }
}
console.log("FUZZ " + JSON.stringify(out));
