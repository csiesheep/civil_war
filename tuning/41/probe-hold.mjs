// #41: why the Communists keep their real markers (goal 3). On the same events: every 洩密 / 倒戈 put to them with a
// real marker among the places, under the options named (the bot's own prices, nothing overridden): the gain of the
// best use over "no" on the true state before the markers' own worth (tuning/41/probe-worth.mjs's reading), the
// price the bot charges for turning that marker up (the evaluation's term "mechC", no minus best use), and what the
// bot answered. Also, per real marker turned up, how many turns it stood.
//   node tuning/41/probe-hold.mjs <first seed> <games> '<options JSON>'
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";
const CCP = 0;
const first = Number(process.argv[2] || 1), games = Number(process.argv[3] || 10);
const options = { mechanismC: true, ...(process.argv[4] ? JSON.parse(process.argv[4]) : {}) };
const val = (s) => { const t = {}; const v = B.evaluate(s, CCP, t); return { v, c: t.mechC || 0 }; };
const out = { games: 0, rows: [] };
for (let seed = first; seed < first + games; seed++) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, options), n = 0;
  while (st.winner == null && ++n < 4000) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    const p = st.pending;
    let row = null;
    if (p && side === CCP && (p.tag === "leak" || p.tag === "defect")) {
      const place = (id) => (p.tag === "defect" ? p.target : id.split(":")[1]);
      const ids = p.options.map((o) => o.id).filter((id) => id !== "no" && (st.moles.at[place(id)] || []).includes(true));
      if (ids.length) {
        const no = val(B.simulate(st, { type: "choose", side: CCP, choice: "no" }, E.makeRng(seed * 7 + n)));
        let best = null;
        for (const id of ids) {
          const x = val(B.simulate(st, { type: "choose", side: CCP, choice: id }, E.makeRng(seed * 7 + n)));
          const raw = x.v - no.v - (x.c - no.c), price = no.c - x.c;
          if (!best || raw > best.raw) best = { raw, price, id };
        }
        row = { seed, turn: st.turn, tag: p.tag, gain: Math.round(best.raw * 100) / 100, price: Math.round(best.price * 100) / 100 };
        out.rows.push(row);
      }
    }
    const d = B.decide(E.view(st, side), side, "normal", rng);
    const { game, why, ...a } = d;
    if (row) row.used = a.choice !== "no";
    st = E.apply(st, a);
  }
  out.games++;
}
console.log("HOLD " + JSON.stringify(out));
