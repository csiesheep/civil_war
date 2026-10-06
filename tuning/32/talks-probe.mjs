// #32, BE probe: in bot-vs-bot games under D, every action round of the Communists where a 統戰 is legal:
// how the best 統戰 ranks against the play the bot made (one guess, `scoreCandidates`), and what it would do.
//   node tuning/32/talks-probe.mjs <first seed> <games>
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";

const CCP = 0, KMT = 1;
const first = Number(process.argv[2] || 10001), games = Number(process.argv[3] || 3);
const move = (a) => { if (!a || !a.game) return a; const { game, ...rest } = a; return rest; };
const rows = [];
for (let seed = first; seed < first + games; seed++) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, { mechanismD: true }), n = 0;
  while (st.winner == null && ++n < 4000) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    if (side === CCP && st.phase === "action" && !st.pending) {
      const L = E.legal(st, side);
      const legalTalks = L.kind === "action" && L.cards.some((c) => c.uses.politics && c.uses.politics.targets.length);
      if (legalTalks) {
        const sc = B.scoreCandidates(E.view(st, side), side, E.makeRng(seed * 7 + n));
        const best = sc[0], pol = sc.find((x) => x.a.use === "politics");
        rows.push({ seed, turn: st.turn, round: st.round, best: `${best.a.use}:${best.a.card}:${best.a.power || best.a.target || ""}`, bestV: best.v.toFixed(1),
          talks: pol ? `${pol.a.power}:${pol.a.card}(${E.CARD[pol.a.card].ops})` : "-", talksV: pol ? pol.v.toFixed(1) : "-", rank: pol ? sc.indexOf(pol) + 1 : "-", of: sc.length,
          att: JSON.stringify(st.attitude), mie: Object.keys(st.mie).join(",") });
      }
    }
    const a = B.decide(E.view(st, side), side, "normal", rng);
    st = E.apply(st, move(a));
  }
  console.error(`seed ${seed}: ${st.reason} turn ${st.turn}`);
}
for (const r of rows) console.log(`${r.seed} t${r.turn}r${r.round} best ${r.best} ${r.bestV} | 統戰 ${r.talks} ${r.talksV} rank ${r.rank}/${r.of} | ${r.att} 易幟 ${r.mie}`);
