// #31, BE: which of mechanism D's decisions and events the fuzz's D cell (the product's random player,
// seeds 1..300, tests/driver.js) actually reaches -- a green cell says nothing about a path it never took.
//   node tuning/31/fuzz-d-coverage.mjs [games=300]
import { playRandomGame } from "../../tests/driver.js";

const games = Number(process.argv[2] || 300), n = {};
const add = (k) => { n[k] = (n[k] || 0) + 1; };
for (let seed = 1; seed <= games; seed++) {
  const onStep = (st, a) => {
    const p = st.pending;
    if (p && p.tag === "grayOrder") add(`ask grayOrder from ${p.step}`);
    if (a.type === "play" && a.use === "politics") add(`play politics ${a.side === 1 ? "整編" : "統戰"}${a.order ? " " + a.order : ""}`);
    if (a.type === "choose" && a.choice && a.choice.use === "politics") add("ops ask answered with politics");
  };
  const { st } = playRandomGame(seed, { mechanismD: true }, { onStep });
  for (const l of st.log) {
    if (l.type === "mie") add(`易幟 ${l.how}`);
    if (l.type === "seal") add("整編完成");
    if (l.type === "attitude") add(`attitude ${l.why} ${l.from}→${l.to}`);
    if (l.type === "grayHit") add("grayHit");
  }
  add(`end ${st.reason}`);
}
for (const k of Object.keys(n).sort()) console.log(`${k}: ${n[k]}`);
