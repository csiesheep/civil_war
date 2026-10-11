// #40: is 肅諜 ever worth it to the Nationalists? At every action round of theirs where a 肅諜 is legal, the
// bot's own scoring (`B.scoreCandidates`: a 肅諜 by its expected value over the belief, `purgeValue`; the rest
// played out on the guess) -- the best 肅諜 against the best of the rest, and the belief of what it names.
//   node tuning/40/probe-purge.mjs <first seed> <games> [options JSON] [C_W JSON]
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";
const CCP = 0, KMT = 1;
const first = Number(process.argv[2] || 1), games = Number(process.argv[3] || 10);
const options = { mechanismC: true, ...(process.argv[4] ? JSON.parse(process.argv[4]) : {}) };
if (process.argv[5]) Object.assign(B.C_W, JSON.parse(process.argv[5]));
const out = { games: 0, rounds: [], chosen: 0, markersOnBoard: 0 };
for (let seed = first; seed < first + games; seed++) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, options), n = 0;
  while (st.winner == null && ++n < 4000) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    let row = null;
    if (!st.pending && st.phase === "action" && side === KMT) {
      const L = E.legal(st, KMT);
      if (L.kind === "action" && L.cards.some((c) => c.uses.moles && c.uses.moles.purge.length)) {
        const view = E.view(st, KMT), sc = B.scoreCandidates(view, KMT, E.makeRng(seed * 13 + n));
        const pg = sc.find((x) => x.a.purge), other = sc.find((x) => !x.a.purge), post = B.molePosterior(view);
        if (pg) {
          const belief = B.moleBelief(view), named = pg.a.purge;
          const ps = named.map((id) => { const l = belief[id] || []; return l.reduce((t, x) => t + x, 0) / (l.length || 1); });
          const truth = named.map((id) => st.moles.at[id].filter((x) => x).length / st.moles.at[id].length);
          row = { seed, turn: st.turn, gap: Math.round((pg.v - (other ? other.v : pg.v)) * 100) / 100, named, p: ps.map((x) => Math.round(x * 100) / 100), prior: Math.round((post.R / post.N) * 100) / 100, truth, card: pg.a.card, ops: E.CARD[pg.a.card].ops };
          out.rounds.push(row);
        }
      }
    }
    const d = B.decide(E.view(st, side), side, "normal", rng);
    const { game, why, ...a } = d;
    if (row && (a.purge || (a.choice && a.choice.purge))) { out.chosen++; row.chosen = true; }
    st = E.apply(st, a);
  }
  out.games++;
}
console.log("PURGE " + JSON.stringify(out));
