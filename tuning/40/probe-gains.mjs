// #40: what turning a real marker up gains, measured where the bots' games ask (洩密 / 倒戈), without the
// markers' own worth (`cValue`, the evaluation's term "mechC"): the numbers behind C_W (tuning/40/report.txt).
//   node tuning/40/probe-gains.mjs <first seed> <games> [options JSON] [C_W JSON]
// For every 洩密 / 倒戈 put to the Communists with a real marker among the places asked about: each legal answer
// played out on the true state (`B.simulate`) and evaluated by the Communists; the gain of the best use over "no",
// less the change of the markers' worth. Also: per turn, the real markers on the board by place (capital / a city
// the Communists can attack now / other), and how many questions each class was asked (the rate of chances).
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";
const CCP = 0, KMT = 1;
const first = Number(process.argv[2] || 1), games = Number(process.argv[3] || 10);
const options = { mechanismC: true, ...(process.argv[4] ? JSON.parse(process.argv[4]) : {}) };
// [weights JSON]: C_W overridden for the measurement only (e.g. a hand worth 0, so that more markers go down).
if (process.argv[5]) Object.assign(B.C_W, JSON.parse(process.argv[5]));
const out = { games: 0, asks: [], markerTurns: { capital: 0, open: 0, isolated: 0, other: 0 }, chances: { capital: 0, open: 0, isolated: 0, other: 0 }, handovers: [] };
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
      const ids = p.options.map((o) => o.id).filter((id) => id !== "no" && (p.tag === "defect" ? st.moles.at[p.target] && st.moles.at[p.target].includes(true) : (st.moles.at[id.split(":")[1]] || []).includes(true)));
      if (ids.length) {
        const r = E.makeRng(seed * 7 + n);
        const no = val(B.simulate(st, { type: "choose", side: CCP, choice: "no" }, r));
        let best = null;
        for (const id of ids) {
          const x = val(B.simulate(st, { type: "choose", side: CCP, choice: id }, E.makeRng(seed * 7 + n)));
          const raw = x.v - no.v - (x.c - no.c);
          const place = p.tag === "defect" ? p.target : id.split(":")[1];
          if (!best || raw > best.raw) best = { raw, id, place, klass: klass(st, place) };
        }
        for (const place of new Set(ids.map((id) => (p.tag === "defect" ? p.target : id.split(":")[1])))) out.chances[klass(st, place)]++;
        out.asks.push({ seed, turn: st.turn, tag: p.tag, ...best, raw: Math.round(best.raw * 100) / 100 });
      }
    }
    // 和平易手: an action round of the Communists where one is legal: the best 和平易手 against the best of the rest
    // (`B.scoreCandidates`, its own rng), plus the worth of the real marker it turns up (the evaluation charged it).
    if (!p && st.phase === "action" && side === CCP) {
      const L = E.legal(st, CCP);
      if (L.kind === "action" && L.cards.some((c) => c.uses.moles && c.uses.moles.handover.length)) {
        const sc = B.scoreCandidates(E.view(st, CCP), CCP, E.makeRng(seed * 11 + n));
        const h = sc.find((x) => x.a.handover), o = sc.find((x) => !x.a.handover);
        if (h) {
          const id = h.a.handover, iso = new Set(E.isolatedCities(st));
          const worth = Math.max(1, st.options.turns - st.turn + 1) * (B.C_W.real + (id === E.homeCapital(st, KMT) ? B.C_W.capital : 0) + (E.adjOf(st, id).some((x) => E.controller(st, x) === CCP) ? B.C_W.open : 0) + (iso.has(id) ? B.C_W.isolated : 0));
          out.handovers.push({ seed, turn: st.turn, id, raw: Math.round(((h.v - (o ? o.v : h.v)) + worth) * 100) / 100, points: E.pointsOf(st, KMT, id) });
        }
      }
    }
    const d = B.decide(E.view(st, side), side, "normal", rng);
    const { game, why, ...a } = d;
    st = E.apply(st, a);
  }
  out.games++;
}
console.log("GAINS " + JSON.stringify(out));
