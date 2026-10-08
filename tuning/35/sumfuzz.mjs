// Sums `FUZZ {json}` lines of tests/fuzz-chunk.js outputs (files given as arguments): games, ended, errors,
// replays, what the games ended by, and (from the events of E, when the chunk was given them) nothing more.
//   node tuning/35/sumfuzz.mjs <file> [<file> …]
import { readFileSync } from "node:fs";
const t = { count: 0, ended: 0, errors: [], replayed: 0, mismatch: 0, actions: 0, reasons: {} };
for (const f of process.argv.slice(2)) {
  const line = readFileSync(f, "utf8").split("\n").find((l) => l.startsWith("FUZZ "));
  if (!line) { console.log(`沒有結果:${f}`); continue; }
  const o = JSON.parse(line.slice(5));
  t.count += o.count; t.ended += o.ended; t.errors.push(...o.errors); t.replayed += o.replayed; t.mismatch += o.replayMismatch.length; t.actions += o.actions;
  for (const [k, n] of Object.entries(o.reasons)) t.reasons[k] = (t.reasons[k] || 0) + n;
}
for (const e of t.errors.slice(0, 5)) console.log(`失敗 · 種子 ${e.seed} · ${e.message}`);
console.log(`局數 ${t.count} / 結束 ${t.ended} / 報錯或卡住 ${t.errors.length} / 重播 ${t.replayed}、不一致 ${t.mismatch} / 動作 ${t.actions} · 結束的方式 ${JSON.stringify(t.reasons)}`);
