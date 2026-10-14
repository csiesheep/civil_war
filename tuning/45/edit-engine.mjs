// #45: the edits to public/shared/engine.js, applied once (each anchor must hit exactly once).
//   node tuning/45/edit-engine.mjs
import { readFileSync, writeFileSync } from "node:fs";

const f = "public/shared/engine.js";
let s = readFileSync(f, "utf8");
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`${n} hits: ${a}`); s = s.replace(a, b); };
// the state field
rep(`    inf: {}, mandate: 0, weariness: 5,\n`,
`    inf: {}, mandate: 0, weariness: 5,
    // #45: the mandate at the opening ([0], once turn 1's free placement is done) and after each turn's
    // 結算 ([t]); the last cell is the mandate at the end once the game is over (\`markMandate\`). A reading
    // for the page: no decision and no random draw reads it.
    mandateByTurn: [],\n`);
// the end of the game
rep(`  st.winner = side; st.reason = reason; st.phase = "over"; st.pending = null; st.plan = [];\n`,
`  st.winner = side; st.reason = reason; st.phase = "over"; st.pending = null; st.plan = [];
  markMandate(st, st.turn); // #45: the game's last turn holds the mandate it ended on\n`);
rep(`export function vp(st, side, n) {`,
`// #45: \`st.mandateByTurn[t]\` = the mandate now. A state from before #45 gets the list when it is first written.
function markMandate(st, t) {
  if (!Array.isArray(st.mandateByTurn)) st.mandateByTurn = [];
  st.mandateByTurn[t] = st.mandate;
}
export function vp(st, side, n) {`);
// the turn's 結算
rep(`      if (probe.turnEnd) probe.turnEnd(st);\n`,
`      markMandate(st, st.turn); // #45: after this turn's 結算, where the probe reads it
      if (probe.turnEnd) probe.turnEnd(st);\n`);
// the opening
rep(`function startTurn(st) {\n  st.turn++;\n`,
`function startTurn(st) {
  if (st.turn === 0) markMandate(st, 0); // #45: the opening, after turn 1's free placement (setup steps before this one)
  st.turn++;\n`);
// the preview
rep(`// CIVIL WAR: Zongheng's export module (the download's JSON) is not copied yet.\n`,
`// #45: 圍點打援, dry run. The Nationalists are asked to answer an attack on a city
// (\`st.pending\`: theirs, tag "siege"); this is what \`response\` would lead to
// under each plan the Communists may hold face down: { point, relief }, each the
// Nationalists' view of the state after, run on to the next decision (whoever's:
// the Communists' −1 / +1, D's order, C's 洩密 / 倒戈, the next card, the 結算's
// discard) or to the end of the game, as \`apply\` does. \`st\` is not changed.
// The real plan is never read: each copy has its plan step's plan overwritten and
// its recorded actions (whose play names the real plan) dropped, so two states
// that differ only in the plan preview the same (orchestrator 裁決 #45).
// A copy that reaches the end of the game is not the real end: its view has no
// \`final\` (the seed, the draw pile and both hands), only \`winner\` and \`reason\`.
export function siegePreview(st, response) {
  const p = st.pending, step = st.plan && st.plan[0];
  if (!p || p.who !== KMT || p.tag !== "siege" || !step || step.do !== "siege" || step.stage !== "respond") fail("siegePreview: the Nationalists are not answering a 圍點打援");
  const out = {};
  for (const plan of SIEGE_PLANS) {
    const s = clone({ ...st, actions: undefined });
    s.plan[0].plan = plan;
    const v = view(apply(s, { type: "choose", side: KMT, choice: response }), KMT);
    delete v.final;
    out[plan] = v;
  }
  return out;
}

// CIVIL WAR: Zongheng's export module (the download's JSON) is not copied yet.\n`);
writeFileSync(f, s);
console.log("edited", f);
