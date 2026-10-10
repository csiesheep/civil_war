// #39 probe: one random game under C, stopping at the first action after which a city the Communists control
// still holds markers; prints the action and the log entries it wrote.
//   node tuning/39/probe-one.mjs <seed> '<options JSON>'
import * as E from "../../public/shared/engine.js";
import { playRandomGame } from "../../tests/driver.js";
const seed = Number(process.argv[2]), options = JSON.parse(process.argv[3] || '{"mechanismC":true}');
let prevLog = 0;
try {
  playRandomGame(seed, options, {
    onStep: (s, a) => {
      const bad = Object.keys(s.moles.at).filter((id) => s.winner == null && E.controller(s, id) === E.CCP);
      if (bad.length) {
        console.log("action", JSON.stringify(a));
        console.log("bad", bad, bad.map((id) => [E.infOf(s, id), E.grayOf(s, id), s.attitude && s.attitude[E.powerOf(id)], s.moles.at[id]]));
        for (const l of s.log.slice(prevLog)) console.log(" ", JSON.stringify(l));
        console.log("pending", JSON.stringify(s.pending && { who: s.pending.who, tag: s.pending.tag, kind: s.pending.kind }));
        throw new Error("stop");
      }
      prevLog = s.log.length;
    },
  });
} catch (e) { if (e.message !== "stop") throw e; }
