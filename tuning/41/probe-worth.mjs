// #41: what a real marker standing on a city is worth a turn, by class, under the options named: #40's probe
// (tuning/40/probe-gains.mjs), the same method, re-run per lever so that the bot's price of a lever that changes
// what a real marker does (洩密 +n, 倒戈's reach and size, 和平易手's price, 洩密 without the capital) is measured,
// not guessed. The bot reads the difference against the same probe with no option (bots.js `C_W_OPT`).
//   node tuning/41/probe-worth.mjs <first seed> <games> [options JSON] [C_W JSON]
// Per game: at the first action round of every turn, the real markers on the board by class (capital, else a
// 孤城, else a city next to a space the Communists control = open, else other: bots.js `realWorth`'s order).
// For every 洩密 / 倒戈 put to the Communists with a real marker among the places: each legal answer played out
// on the true state (`B.simulate`, one rng per question, the same for every answer) and evaluated by the
// Communists, less the change of the markers' own worth (the evaluation's term "mechC"): the best use against
// "no", max(0, ·) -- the Communists may always say no. For every action round of theirs with a 和平易手 legal: the
// best 和平易手 against the best of the rest (`B.scoreCandidates`), plus the worth the evaluation charged for the
// real marker it turns up (`B.cWorth`), max(0, ·). Worth of a class = the gains there / its real-marker turns.
// The lever's own price is set to "no change" while it is measured (`C_W_OPT[key] = {}`), as #40 measured with
// C_W's first shape: the gain is read without the markers' worth, so the price does not enter it except through
// where the bot plants.
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";
const CCP = 0, KMT = 1;
const first = Number(process.argv[2] || 1), games = Number(process.argv[3] || 10);
const options = { mechanismC: true, ...(process.argv[4] ? JSON.parse(process.argv[4]) : {}) };
if (process.argv[5]) Object.assign(B.C_W, JSON.parse(process.argv[5]));
const sp = E.cSpecOf({ options });
for (const [k, v, d] of [["cLeakBonus", sp.leakBonus, 0], ["cDefect", sp.defect, E.C_SPEC.defect], ["cDefectAny", sp.defectAny, false], ["cHandover", sp.handover, null], ["cLeakCapital", sp.leakCapital, true]]) {
  if (v !== d && !B.C_W_OPT[`${k}:${v}`]) B.C_W_OPT[`${k}:${v}`] = {};
}
const K = ["capital", "isolated", "open", "other"];
const zero = () => Object.fromEntries(K.map((k) => [k, 0]));
const out = { games: 0, markerTurns: zero(), gains: zero(), asks: zero(), handoverRounds: 0, handoverGain: 0, rows: [] };
const klass = (st, id) => (id === E.homeCapital(st, KMT) ? "capital" : E.isolatedCities(st).includes(id) ? "isolated" : E.adjOf(st, id).some((a) => E.controller(st, a) === CCP) ? "open" : "other");
const val = (s) => { const t = {}; const v = B.evaluate(s, CCP, t); return { v, c: t.mechC || 0 }; };
for (let seed = first; seed < first + games; seed++) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, options), n = 0, lastTurn = 0;
  while (st.winner == null && ++n < 4000) {
    if (st.turn !== lastTurn && st.phase === "action") {
      lastTurn = st.turn;
      for (const [id, l] of Object.entries(st.moles.at)) out.markerTurns[klass(st, id)] += l.filter((x) => x).length;
    }
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    const p = st.pending;
    if (p && side === CCP && (p.tag === "leak" || p.tag === "defect")) {
      const place = (id) => (p.tag === "defect" ? p.target : id.split(":")[1]);
      const ids = p.options.map((o) => o.id).filter((id) => id !== "no" && (st.moles.at[place(id)] || []).includes(true));
      if (ids.length) {
        const no = val(B.simulate(st, { type: "choose", side: CCP, choice: "no" }, E.makeRng(seed * 7 + n)));
        let best = null;
        for (const id of ids) {
          const x = val(B.simulate(st, { type: "choose", side: CCP, choice: id }, E.makeRng(seed * 7 + n)));
          const raw = x.v - no.v - (x.c - no.c);
          if (!best || raw > best.raw) best = { raw, id, klass: klass(st, place(id)) };
        }
        out.asks[best.klass]++;
        out.gains[best.klass] += Math.max(0, best.raw);
        out.rows.push({ seed, turn: st.turn, tag: p.tag, klass: best.klass, gain: Math.round(best.raw * 100) / 100 });
      }
    }
    if (!p && st.phase === "action" && side === CCP) {
      const L = E.legal(st, CCP);
      if (L.kind === "action" && L.cards.some((c) => c.uses.moles && c.uses.moles.handover.length)) {
        const sc = B.scoreCandidates(E.view(st, CCP), CCP, E.makeRng(seed * 11 + n));
        const h = sc.find((x) => x.a.handover), o = sc.find((x) => !x.a.handover);
        if (h) {
          const id = h.a.handover, w = B.cWorth(st);
          const worth = Math.max(1, st.options.turns - st.turn + 1) * (w.isolated + (w.board || 0));
          const g = h.v - (o ? o.v : h.v) + worth;
          out.handoverRounds++;
          out.gains.isolated += Math.max(0, g);
          out.handoverGain += Math.max(0, g);
          out.rows.push({ seed, turn: st.turn, tag: "handover", klass: klass(st, id), gain: Math.round(g * 100) / 100, points: E.pointsOf(st, KMT, id) });
        }
      }
    }
    const d = B.decide(E.view(st, side), side, "normal", rng);
    const { game, why, ...a } = d;
    st = E.apply(st, a);
  }
  out.games++;
}
console.log("WORTH " + JSON.stringify(out));
