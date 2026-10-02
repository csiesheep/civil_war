// One chunk of bot-vs-bot games, in a process of its own (Node sometimes dies in a long run on the
// owner's machine: tests/bots.test.js runs a chunk that died once more before it is believed).
//   node tests/bots-chunk.js <first seed> <count> <共軍's level> <國軍's level>
// Each seat decides from its own view (`E.view(st, side)`), never from the state. Prints one line,
// `BOTS {json}`: how each game ended, every error with its seed, and what the bots did on the way
// (the aid cards, and whether a decision is a function of the view and the rng alone).
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

const first = Number(process.argv[2] || 1), count = Number(process.argv[3] || 10);
const levels = [process.argv[4] || "normal", process.argv[5] || "normal"];
const CCP = 0, KMT = 1, AID = (E.AID || []).map((a) => a.id);
const out = {
  first, count, levels, ended: 0, actions: 0, ms: 0, errors: [], reasons: {}, turns: {}, wins: [0, 0],
  // the same view and the same rng seed, asked twice: the same decision? was the view left as it was?
  pure: { asked: 0, differ: 0, mutated: 0 },
  // per side: turns in which the aid card could be played at some action round of that side / turns in which it was played
  aid: { usable: [0, 0], used: [0, 0], usableStrong: 0, usedStrong: 0 },
  // at every turn's end: the sum of 民心 and of the number of 孤城, and how many games got there
  turnEnd: {},
};
const strip = (a) => { if (!a) return a; const { why, ...rest } = a; return rest; };

for (let seed = first; seed < first + count; seed++) {
  const t0 = Date.now();
  try {
    const rng = E.makeRng((seed * 2654435761) >>> 0);
    let st = E.createGame(seed, {});
    let n = 0;
    const usable = new Set(), used = new Set(), strong = new Set();
    while (st.winner == null) {
      if (++n > 4000) throw new Error(`did not end in 4000 actions (turn ${st.turn}, phase ${st.phase})`);
      const who = E.mustAct(st);
      if (!who.length) throw new Error(`nobody must act (turn ${st.turn}, phase ${st.phase})`);
      const side = who[rng.int(who.length)], level = levels[side];
      const view = E.view(st, side);
      if (st.phase === "action" && !st.pending) {
        const L = E.legal(st, side);
        if (L.kind === "action" && L.aid) { usable.add(`${st.turn}:${side}`); if (side === KMT && st.support[1] >= 3) strong.add(st.turn); }
      }
      if (level !== "easy" && n % 11 === 0) {
        const before = JSON.stringify(view);
        const a1 = B.decide(view, side, level, E.makeRng(seed * 131 + n)), a2 = B.decide(view, side, level, E.makeRng(seed * 131 + n));
        out.pure.asked++;
        if (JSON.stringify(strip(a1)) !== JSON.stringify(strip(a2))) out.pure.differ++;
        if (JSON.stringify(view) !== before) out.pure.mutated++;
      }
      const a = B.decide(view, side, level, rng);
      if (!a) throw new Error(`no decision for side ${side} (turn ${st.turn}, phase ${st.phase}, level ${level})`);
      if (a.type === "play" && AID.includes(a.card)) used.add(`${st.turn}:${side}`);
      // the probe is on only around the game's own apply: the bots think with the same engine
      E.probe.turnEnd = (s) => { const k = s.turn, e = (out.turnEnd[k] ||= { games: 0, mandate: 0, isolated: 0 }); e.games++; e.mandate += s.mandate; e.isolated += E.isolatedCities(s).length; };
      try { st = E.apply(st, a); }
      catch (e) { throw new Error(`turn ${st.turn}, phase ${st.phase}, level ${level}: the engine refused or crashed on ${JSON.stringify(strip(a))}: ${e && e.message}`); }
      finally { E.probe.turnEnd = null; }
    }
    out.ended++; out.actions += n;
    out.reasons[st.reason] = (out.reasons[st.reason] || 0) + 1;
    out.turns[st.turn] = (out.turns[st.turn] || 0) + 1;
    out.wins[st.winner]++;
    for (const k of usable) { const s = Number(k.split(":")[1]); out.aid.usable[s]++; if (used.has(k)) out.aid.used[s]++; }
    for (const t of strong) { out.aid.usableStrong++; if (used.has(`${t}:${KMT}`)) out.aid.usedStrong++; }
  } catch (e) {
    out.errors.push({ seed, message: String((e && e.message) || e).slice(0, 400) });
  }
  out.ms += Date.now() - t0;
}
console.log("BOTS " + JSON.stringify(out));
