// #45 probe: the two readings over whole bot games, in every mechanism the engine has.
//   node tuning/45/probe.mjs [games per cell = 40] [level = easy] [first seed = 1]
// Plays games like tests/sim.js (B.decide on E.view), and
//   - at every Nationalist 圍點打援 answer, for every response offered: E.siegePreview(st, r)
//       (a) leaves st byte-identical (JSON before = after);
//       (b) the side of the real plan = E.view(E.apply(st, choose r), KMT) without `final` (the real walk);
//       (c) the same state with the plan flipped (plan step and the recorded play) previews identically;
//       (d) has no `final` and no `actions`;
//     and tallies where each preview stopped (whose decision, which tag) or that the game ended there;
//   - in every state the game passes through, mandateByTurn is [0 .. turn-1] with no hole (turn's cell not yet);
//     at the end it is [0 .. turn]; every cell [t] = the `mandate` of the last `vp` log entry of turn <= t
//     (0 when none): the log is the other reading of the mandate (every change of st.mandate goes through `vp`).
// The expected values are read from the log and from the real walk, never from mandateByTurn / siegePreview.
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";

const [N = 40, level = "easy", seed0 = 1] = process.argv.slice(2).map((x, i) => (i === 1 ? x : Number(x)));
const KMT = 1, CCP = 0;
const CELLS = { default: {}, D: { mechanismD: true }, C: { mechanismC: true }, E: { mechanismE: true }, DCE: { mechanismD: true, mechanismC: true, mechanismE: true } };
const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
const J = (x) => JSON.stringify(canon(x));
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };

function expectedMandates(st, upto) {
  const out = [];
  let m = 0, k = 0;
  const vps = st.log.filter((l) => l.type === "vp");
  for (let t = 0; t <= upto; t++) {
    while (k < vps.length && vps[k].t <= t) m = vps[k++].mandate;
    out.push(m);
  }
  return out;
}
function flipPlan(st) {
  const s = E.clone(st), other = s.plan[0].plan === "point" ? "relief" : "point";
  s.plan[0].plan = other;
  // the recorded action that named it: the last play (or ops choice) with a `siege`
  for (let i = s.actions.length - 1; i >= 0; i--) {
    const a = s.actions[i];
    if (a.type === "play" && a.siege) { a.siege = other; break; }
    if (a.type === "choose" && a.choice && typeof a.choice === "object" && a.choice.siege) { a.choice.siege = other; break; }
  }
  return s;
}

const report = {};
let fails = 0;
const fail = (cell, msg) => { fails++; if (fails <= 20) console.log(`FAIL ${cell}: ${msg}`); };
for (const [cell, options] of Object.entries(CELLS)) {
  const R = (report[cell] = { games: 0, asked: 0, previews: 0, stops: {}, ended: 0, mbtStates: 0, mbtEnds: 0, endLen: {} });
  for (let seed = seed0; seed < seed0 + N; seed++) {
    const rng = E.makeRng((seed * 2654435761) >>> 0);
    let st = E.createGame(seed, options);
    for (let n = 0; st.winner == null; n++) {
      if (n > 5000) { fail(cell, `seed ${seed} did not end`); break; }
      // mandateByTurn mid-game
      const mbt = E.view(st, CCP).mandateByTurn;
      R.mbtStates++;
      const want = st.turn >= 1 ? expectedMandates(st, st.turn - 1) : [];
      if (J(mbt) !== J(want)) fail(cell, `seed ${seed} turn ${st.turn} phase ${st.phase}: mandateByTurn ${J(mbt)}, log says ${J(want)}`);
      if (st.pending && st.pending.tag === "siege" && st.pending.who === KMT) {
        R.asked++;
        const real = st.plan[0].plan, flipped = flipPlan(st);
        for (const { id: r } of st.pending.options) {
          const before = JSON.stringify(st);
          const pv = E.siegePreview(st, r);
          R.previews++;
          if (JSON.stringify(st) !== before) fail(cell, `seed ${seed}: preview of ${r} changed st`);
          const walk = E.view(E.apply(st, { type: "choose", side: KMT, choice: r }), KMT);
          delete walk.final;
          if (J(pv[real]) !== J(walk)) fail(cell, `seed ${seed}: preview[${real}] of ${r} is not the real walk`);
          if (J(E.siegePreview(flipped, r)) !== J(pv)) fail(cell, `seed ${seed}: plan flipped, preview of ${r} differs`);
          for (const plan of E.SIEGE_PLANS) {
            const v = pv[plan];
            if (!v || "final" in v || v.actions !== undefined) fail(cell, `seed ${seed}: preview[${plan}] of ${r} has final / actions or is missing`);
            if (v.winner != null) R.ended++;
            else bump(R.stops, v.pending ? `${v.pending.who === KMT ? "KMT" : "CCP"}:${v.pending.tag || v.pending.kind}` : `no pending, phase ${v.phase}`);
          }
        }
      }
      const who = E.mustAct(st), side = who[rng.int(who.length)];
      const d = B.decide(E.view(st, side), side, level, rng);
      const { game, why, ...a } = d;
      st = E.apply(st, a);
    }
    R.games++;
    const mbt = E.view(st, KMT).mandateByTurn, want = expectedMandates(st, st.turn);
    R.mbtEnds++; bump(R.endLen, `${mbt.length}@t${st.turn}`);
    if (J(mbt) !== J(want)) fail(cell, `seed ${seed} end (turn ${st.turn}, ${st.reason}): mandateByTurn ${J(mbt)}, log says ${J(want)}`);
    if (mbt[mbt.length - 1] !== st.mandate) fail(cell, `seed ${seed}: last cell ${mbt[mbt.length - 1]} vs mandate at the end ${st.mandate}`);
  }
}
for (const [cell, R] of Object.entries(report)) console.log(`${cell}: ${JSON.stringify(R)}`);
// The checks above must have looked at something (a population of 0 passes everything).
const empty = Object.entries(report).filter(([, R]) => !R.previews || !R.mbtEnds).map(([c]) => c);
console.log(empty.length ? `EMPTY ${empty.join(" ")}` : "populations nonempty");
console.log(`PROBE ${fails ? "FAIL" : "OK"} fails ${fails} (games ${N} per cell, level ${level}, seeds ${seed0}..${seed0 + N - 1})`);
process.exitCode = fails || empty.length ? 1 : 0;
