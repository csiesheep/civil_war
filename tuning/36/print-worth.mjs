// #36 probe: what a print is worth to the Nationalists, as the bot's own evaluation sees it. E-on games of
// normal vs normal (the loop of tests/bots-chunk.js); at each of the Nationalists' action rounds where a
// print is offered, one guess: the best printed play's value minus the best plain play's, plus the price
// the printed one paid (`ePrice`) -- the gross worth of 2 more ops at that moment. By turn: mean, median.
//   node tuning/36/print-worth.mjs [games=6] [first seed=301]
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";

const KMT = 1, games = Number(process.argv[2] || 6), first = Number(process.argv[3] || 301);
const by = {};
for (let seed = first; seed < first + games; seed++) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, { mechanismE: true });
  for (let n = 0; st.winner == null && n < 4000; n++) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    if (side === KMT && st.phase === "action" && !st.pending && st.actor === KMT && E.inflationOf(st) < 9) {
      const price = B.ePrice(st, KMT);
      const sc = B.scoreCandidates(E.view(st, KMT), KMT, E.makeRng(seed * 977 + n));
      const pr = sc.filter((x) => x.a.print), plain = sc.filter((x) => !x.a.print && (x.a.use === "place" || x.a.use === "campaign"));
      if (pr.length && plain.length) (by[st.turn] ||= []).push({ g: pr[0].v - plain[0].v + price, price, inf: E.inflationOf(st) });
    }
    st = E.apply(st, B.decide(E.view(st, side), side, "normal", rng));
  }
}
const q = (xs, p) => xs.slice().sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
const all = [];
for (const [t, xs] of Object.entries(by)) {
  const g = xs.map((x) => x.g); all.push(...g);
  console.log(`turn ${t}: n ${g.length}, gross worth mean ${(g.reduce((a, b) => a + b, 0) / g.length).toFixed(2)}, median ${q(g, 0.5).toFixed(2)}, p10 ${q(g, 0.1).toFixed(2)}, p90 ${q(g, 0.9).toFixed(2)}; price mean ${(xs.reduce((a, x) => a + x.price, 0) / xs.length).toFixed(2)}`);
}
console.log(`all: n ${all.length}, mean ${(all.reduce((a, b) => a + b, 0) / all.length).toFixed(2)}, median ${q(all, 0.5).toFixed(2)}`);
