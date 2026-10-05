// One chunk of bot-vs-bot games, in a process of its own (Node sometimes dies in a long run on the
// owner's machine: tests/bots.test.js runs a chunk that died once more before it is believed).
//   node tests/bots-chunk.js <first seed> <count> <共軍's level> <國軍's level> [options as JSON]
// Each seat decides from its own view (`E.view(st, side)`), never from the state. Prints one line,
// `BOTS {json}`: how each game ended, every error with its seed, and what the bots did on the way
// (the aid cards, and whether a decision is a function of the view and the rng alone).
// With mechanism B on (#27): every 圍點打援 decision -- the Communists' plan, the Nationalists' answer -- and
// the zero-sum game the bot says it solved for it (`siege`, below).
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { gameFault, kindOf } from "./siege-game.js";

const first = Number(process.argv[2] || 1), count = Number(process.argv[3] || 10);
const levels = [process.argv[4] || "normal", process.argv[5] || "normal"];
const options = process.argv[6] ? JSON.parse(process.argv[6]) : {};
const CCP = 0, KMT = 1, AID = (E.AID || []).map((a) => a.id);
const out = {
  first, count, levels, ended: 0, actions: 0, ms: 0, errors: [], reasons: {}, turns: {}, wins: [0, 0],
  // the same view and the same rng seed, asked twice: the same decision? was the view left as it was?
  pure: { asked: 0, differ: 0, mutated: 0 },
  // per side: turns in which the aid card could be played at some action round of that side / turns in which it was played
  aid: { usable: [0, 0], used: [0, 0], usableStrong: 0, usedStrong: 0 },
  // at every turn's end: the sum of 民心 and of the number of 孤城, and how many games got there
  turnEnd: {},
  // mechanism D (#32): 政工 played, per side (the Nationalists' 整編, the Communists' 統戰)
  politics: [0, 0],
  // mechanism B: per side, the decisions; how many carried a `game`; how many games failed the equilibrium test
  // (first few kept); what was drawn against what the mixes expected, by plan / by kind of answer; pure mixes.
  siege: { ccp: { n: 0, game: 0, bad: [], pure: 0, by: {} }, kmt: { n: 0, game: 0, bad: [], pure: 0, by: {} }, sweep: { stand: 0, withdraw: 0 } },
};
function tally(by, drawn, mix) {
  for (const [k, pk] of Object.entries(mix)) { const x = (by[kindOf(k)] ||= { drawn: 0, expected: 0, variance: 0 }); x.expected += pk; }
  const kinds = {}; for (const [k, pk] of Object.entries(mix)) kinds[kindOf(k)] = (kinds[kindOf(k)] || 0) + pk;
  for (const [k, pk] of Object.entries(kinds)) by[k].variance += pk * (1 - pk);
  (by[kindOf(drawn)] ||= { drawn: 0, expected: 0, variance: 0 }).drawn++;
}
const planOf = (a) => (a && a.type === "play" ? a.siege : a && a.type === "choose" && a.choice && typeof a.choice === "object" ? a.choice.siege : null);
const strip = (a) => { if (!a) return a; const { why, ...rest } = a; return rest; };
// What goes to the engine: the decision without its `game` (#27; the matrix is the bot's note, not a move).
const move = (a) => { if (!a || !a.game) return a; const { game, ...rest } = a; return rest; };

for (let seed = first; seed < first + count; seed++) {
  const t0 = Date.now();
  try {
    const rng = E.makeRng((seed * 2654435761) >>> 0);
    let st = E.createGame(seed, options);
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
      if ((a.type === "play" && a.use === "politics") || (a.type === "choose" && a.choice && typeof a.choice === "object" && a.choice.use === "politics")) out.politics[side]++;
      const plan = planOf(a), answering = st.pending && st.pending.tag === "siege" && side === KMT;
      if (plan || answering) {
        const s = out.siege[side === CCP ? "ccp" : "kmt"]; s.n++;
        if (level !== "easy") {
          if (a.game) s.game++;
          const fault = gameFault(a.game, side, answering ? st.pending.options.map((o) => o.id) : null);
          if (fault) { if (s.bad.length < 5) s.bad.push({ seed, n, fault: String(fault).slice(0, 200) }); else s.bad.length++; }
          else { tally(s.by, plan || a.choice, a.game.mix); if (Math.max(...Object.values(a.game.mix)) >= 0.999) s.pure++; }
        } else (s.by[kindOf(plan || a.choice)] ||= { drawn: 0, expected: 0, variance: 0 }).drawn++;
      }
      if (st.pending && st.pending.tag === "sweep" && side === CCP) out.siege.sweep[a.choice === "withdraw" ? "withdraw" : "stand"]++;
      // the probe is on only around the game's own apply: the bots think with the same engine
      E.probe.turnEnd = (s) => { const k = s.turn, e = (out.turnEnd[k] ||= { games: 0, mandate: 0, isolated: 0 }); e.games++; e.mandate += s.mandate; e.isolated += E.isolatedCities(s).length; };
      try { st = E.apply(st, move(a)); }
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
