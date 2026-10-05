// #26: does anything a seat can see tell the Nationalists the Communists' face-down plan before they answer?
//   node tuning/26/leak.mjs [games=200] [first seed=1]
// Random games with mechanism B on (the fuzz's player, public/shared/random.js). Every time the
// Communists attack a city -- a play with `siege`, or an ops choice with `siege` (an enemy card played
// event first) -- the same action is applied again with the OTHER plan, and while the Nationalists'
// answer is pending the two states must look the same:
//   - E.view(·, 國軍) and E.view(·, spectator), the whole object (board, log, pending, plan, effects);
//   - E.legal(·, 國軍) (what the UI and the bots are offered);
//   - the normal bot's decision from that view with the same rng seed;
//   - the raw `st.log` and `st.pending` (the plan is in neither until the answer).
// And the hidden part must really be hidden: the two raw states DO differ (else nothing was compared).
// Prints `LEAK-VERDICT 比較 n 次 / 不同 n / 原狀態也相同 n`.
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";
import { randomAction } from "../../public/shared/random.js";

const GAMES = Number(process.argv[2] || 200), FIRST = Number(process.argv[3] || 1);
const J = (x) => JSON.stringify(x ?? null);
const flip = (p) => (p === "point" ? "relief" : "point");
const r = { compared: 0, differ: [], rawSame: 0, botAsked: 0 };

function alternative(st, action) {
  if (action.type === "play" && action.siege) return { ...action, siege: flip(action.siege) };
  if (action.type === "choose" && action.choice && typeof action.choice === "object" && action.choice.siege) return { ...action, choice: { ...action.choice, siege: flip(action.choice.siege) } };
  return null;
}
for (let seed = FIRST; seed < FIRST + GAMES; seed++) {
  const rng = E.makeRng(seed ^ 0x9e3779b9);
  let st = E.createGame(seed, { mechanismB: true });
  for (let n = 0; st.winner == null && n < 4000; n++) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    const action = randomAction(st, side, rng);
    const next = E.apply(st, action), alt = alternative(st, action);
    if (alt && next.pending && next.pending.tag === "siege") {
      const other = E.apply(st, alt);
      r.compared++;
      if (J(next) === J(other)) r.rawSame++;
      const why = [];
      if (J(E.view(next, E.KMT)) !== J(E.view(other, E.KMT))) why.push("view(國軍)");
      if (J(E.view(next, null)) !== J(E.view(other, null))) why.push("view(觀眾)");
      // The raw log and pending themselves (not only through `view`): the plan is in neither.
      if (J(next.log) !== J(other.log)) why.push("st.log");
      if (J(next.pending) !== J(other.pending)) why.push("st.pending");
      if (J(E.legal(E.view(next, E.KMT), E.KMT)) !== J(E.legal(E.view(other, E.KMT), E.KMT))) why.push("legal(國軍)");
      if (r.compared % 10 === 1) {
        r.botAsked++;
        const d1 = B.decide(E.view(next, E.KMT), E.KMT, "normal", E.makeRng(seed * 7 + n)), d2 = B.decide(E.view(other, E.KMT), E.KMT, "normal", E.makeRng(seed * 7 + n));
        if (J(d1) !== J(d2)) why.push("bot");
      }
      if (why.length) r.differ.push({ seed, n, why });
    }
    st = next;
  }
}
console.log(`games ${GAMES} (seeds ${FIRST}..${FIRST + GAMES - 1}); bot asked ${r.botAsked} times`);
for (const d of r.differ.slice(0, 10)) console.log(`不同 · 種子 ${d.seed} 第 ${d.n} 步 · ${d.why.join("、")}`);
console.log(`LEAK-VERDICT 比較 ${r.compared} 次 / 不同 ${r.differ.length} / 原狀態也相同 ${r.rawSame}`);
// Red when anything differs, when nothing was compared, or when the two raw states were ever the same (no secret to keep).
process.exitCode = r.differ.length || !r.compared || r.rawSame ? 1 : 0;
