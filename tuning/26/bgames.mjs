// #26: bot against bot with mechanism B on (`mechanismB: true`), the loop of tests/bots-chunk.js
// (each seat decides from its own view; the side is drawn even when one side must act).
//   node tuning/26/bgames.mjs <first seed> <count> [共軍's level] [國軍's level]
// Prints one line, `BGAMES {json}`: how each game ended, every refusal or crash with its seed, and
// how often each of B's decisions came up -- the Communists' plan on a city (打點 / 打援), the
// Nationalists' answer (固守 / 增援 / 突圍) by plan, the −1 / +1, 進剿's 守 / 撤 -- read from the
// log of the finished game (every result is logged once, `siegeResult` / `sweepResult`).
// Also, like bots-chunk: the same view and rng asked twice give the same decision, and the view is
// left untouched (`pure`).
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";

const first = Number(process.argv[2] || 1), count = Number(process.argv[3] || 10);
const levels = [process.argv[4] || "normal", process.argv[5] || "normal"];
const OPTIONS = { mechanismB: true };
const out = {
  first, count, levels, options: OPTIONS, ended: 0, actions: 0, ms: 0, errors: [], reasons: {}, turns: {}, wins: [0, 0],
  pure: { asked: 0, differ: 0, mutated: 0 },
  // per game, then summed: { "point/hold": n, ... }, the picks, 進剿
  siege: {}, picks: {}, sweep: {}, offered: {}, perGame: [],
};
const strip = (a) => { if (!a) return a; const { why, ...rest } = a; return rest; };
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

for (let seed = first; seed < first + count; seed++) {
  const t0 = Date.now();
  try {
    const rng = E.makeRng((seed * 2654435761) >>> 0);
    let st = E.createGame(seed, OPTIONS);
    let n = 0;
    while (st.winner == null) {
      if (++n > 4000) throw new Error(`did not end in 4000 actions (turn ${st.turn}, phase ${st.phase})`);
      const who = E.mustAct(st);
      if (!who.length) throw new Error(`nobody must act (turn ${st.turn}, phase ${st.phase})`);
      const side = who[rng.int(who.length)], level = levels[side];
      const view = E.view(st, side);
      if (level !== "easy" && n % 11 === 0) {
        const before = JSON.stringify(view);
        const a1 = B.decide(view, side, level, E.makeRng(seed * 131 + n)), a2 = B.decide(view, side, level, E.makeRng(seed * 131 + n));
        out.pure.asked++;
        if (JSON.stringify(strip(a1)) !== JSON.stringify(strip(a2))) out.pure.differ++;
        if (JSON.stringify(view) !== before) out.pure.mutated++;
      }
      // What the Nationalists were offered when they answered (how often 增援 / 突圍 were possible at all).
      if (st.pending && st.pending.tag === "siege") {
        const ids = st.pending.options.map((o) => o.id.split(":")[0]);
        bump(out.offered, "asked");
        for (const k of new Set(ids)) bump(out.offered, k);
      }
      const a = B.decide(view, side, level, rng);
      if (!a) throw new Error(`no decision for side ${side} (turn ${st.turn}, phase ${st.phase}, level ${level})`);
      try { st = E.apply(st, a); }
      catch (e) { throw new Error(`turn ${st.turn}, phase ${st.phase}, level ${level}: the engine refused or crashed on ${JSON.stringify(strip(a))}: ${e && e.message}`); }
    }
    out.ended++; out.actions += n;
    bump(out.reasons, st.reason); bump(out.turns, st.turn); out.wins[st.winner]++;
    const g = { seed, winner: st.winner, reason: st.reason, turn: st.turn, siege: 0, sweep: 0 };
    for (const l of st.log) {
      if (l.type === "siegeResult") { bump(out.siege, `${l.plan}/${l.response}`); g.siege++; }
      else if (l.type === "siegeLoss" || l.type === "siegeCapture") bump(out.picks, l.type);
      else if (l.type === "sweepResult") { bump(out.sweep, l.response); g.sweep++; }
    }
    if (st.log.length && st.log[0].i !== 1) g.logTrimmed = true;
    out.perGame.push(g);
  } catch (e) {
    out.errors.push({ seed, message: String((e && e.message) || e).slice(0, 400) });
  }
  out.ms += Date.now() - t0;
}
console.log("BGAMES " + JSON.stringify(out));
