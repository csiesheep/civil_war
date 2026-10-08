// #36: a quick look at one state file of tests/sim.js (cell full): games, seconds, wins, reasons, and E's sums.
//   node tuning/36/peek.mjs <x.state.json>
import { readFileSync } from "node:fs";

const s = JSON.parse(readFileSync(process.argv[2], "utf8")).cells.full;
const n = s.sum.games;
console.log(`games ${n}, errors ${s.errors.length}, s/game ${(s.ms / 1000 / Math.max(1, n + s.errors.length)).toFixed(1)}`);
console.log(`wins ${JSON.stringify(s.sum.wins)} reasons ${JSON.stringify(s.sum.reasons)} endTurns ${JSON.stringify(s.sum.endTurns)}`);
for (const e of s.errors.slice(0, 3)) console.log(`error seed ${e.seed}: ${e.message}`);
const e = s.more && s.more.e;
if (e) {
  console.log(`print ${e.print} (${(e.print / n).toFixed(2)}/game), peg ${e.peg}, radical ${e.radical} (${(e.radical / n).toFixed(2)}/game), collapse ${e.collapse}, lastTurnTo9 ${e.lastTurnTo9}`);
  console.log(`per game: ${JSON.stringify(s.more.ePerGame)}`);
  console.log(`end: ${JSON.stringify(e.end)}`);
  console.log(`thresholds: ${JSON.stringify(e.threshold)}`);
  console.log(`centrists moved: ${JSON.stringify(e.centristsMoved)}; settle to ccp ${e.settleToCcp}, to kmt ${e.settleToKmt}`);
  console.log(`returnHome: ${JSON.stringify(e.returnHome)}`);
  console.log(`byTurn: ${JSON.stringify(e.byTurn)}`);
}
