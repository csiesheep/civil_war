// #39 probe: random legal games under mechanism C (the fuzz's loop, tests/driver.js), counted.
//   node tuning/39/probe-c-random.mjs [games=300] [extra options as JSON]
// Per game, after every action:
//   - the markers add up: hand + board + pool = 5 / 5, with `out` real ones gone (fakes never leave);
//   - no city the Communists control holds a marker;
//   - the Nationalists' and the spectator's view hold no truth: every marker null, the hand null, and no
//     "real" anywhere in the view outside a `purge` log entry (肅諜 turns markers up in public).
// Then it prints how often each of C's moves happened, and how the games ended.
import * as E from "../../public/shared/engine.js";
import { playRandomGame } from "../../tests/driver.js";

const games = Number(process.argv[2] || 300);
const extra = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const options = { mechanismC: true, ...extra };
const count = {}, asked = { leak: 0, defect: 0 }, ends = {};
let steps = 0, errors = 0, lastPending = null;
const add = (k, n = 1) => { count[k] = (count[k] || 0) + n; };
function invariants(st, seed) {
  const m = st.moles;
  if (!m) throw new Error(`game ${seed}: no st.moles under mechanismC`);
  const board = [0, 0];
  for (const [id, l] of Object.entries(m.at)) {
    if (!l.length) throw new Error(`game ${seed}: an empty list kept at ${id}`);
    if (l.length > E.C_SPEC.perCity) throw new Error(`game ${seed}: ${l.length} markers at ${id}`);
    if (E.SPACE[id].kind !== "city") throw new Error(`game ${seed}: a marker on ${id}, not a city`);
    if (st.winner == null && E.controller(st, id) === E.CCP) throw new Error(`game ${seed}: markers on ${id}, which the Communists control`);
    for (const r of l) board[r ? 0 : 1]++;
  }
  const real = m.hand[0] + board[0] + m.pool[0] + m.out, fake = m.hand[1] + board[1] + m.pool[1];
  if (real !== 5 || fake !== 5 || Math.min(...m.hand, ...m.pool) < 0) throw new Error(`game ${seed}: markers ${real} real ${fake} fake (hand ${m.hand} board ${board} pool ${m.pool} out ${m.out})`);
  for (const side of [E.KMT, null]) {
    const v = E.view(st, side);
    if (v.moles.hand !== null || Object.values(v.moles.at).some((l) => l.some((x) => x !== null))) throw new Error(`game ${seed}: view ${side} shows a marker's truth`);
    const s = JSON.stringify({ ...v, log: v.log.filter((l) => l.type !== "purge"), final: undefined });
    if (s.includes('"real"')) throw new Error(`game ${seed}: view ${side} has "real" in it: ${s.slice(Math.max(0, s.indexOf('"real"') - 200), s.indexOf('"real"') + 40)}`);
  }
}
for (let seed = 1; seed <= games; seed++) {
  try {
    const { st } = playRandomGame(seed, options, {
      onStep: (s) => {
        steps++;
        if (s.pending && (s.pending.tag === "leak" || s.pending.tag === "defect") && s.pending !== lastPending) asked[s.pending.tag]++;
        lastPending = s.pending;
        invariants(s, seed);
      },
    });
    for (const l of st.log) if (["plant", "purge", "handover", "leak", "defect", "molesHome", "moleGain"].includes(l.type)) {
      add(l.type);
      if (l.type === "plant") add("plant.markers", l.at.length);
      if (l.type === "purge") { add("purge.flipped", l.flipped.length); add("purge.caught", l.flipped.some((f) => !f.real) ? 1 : 0); }
      if (l.type === "leak") add(`leak.${l.from}->${l.plan}`);
      if (l.type === "moleGain") add(`moleGain.${l.why}`);
    }
    ends[st.reason] = (ends[st.reason] || 0) + 1;
  } catch (e) {
    errors++;
    if (errors <= 5) console.log("ERROR", e.message.slice(0, 600));
  }
}
console.log(`C-RANDOM games ${games} / errors ${errors} / actions ${steps} / options ${JSON.stringify(options)}`);
console.log("moves", JSON.stringify(Object.fromEntries(Object.entries(count).sort())));
console.log("asked", JSON.stringify(asked));
console.log("ends", JSON.stringify(ends));
