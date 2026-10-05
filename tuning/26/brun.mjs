// #26: run tuning/26/bgames.mjs over seeds 1..N in parallel child processes and sum the lines.
//   node tuning/26/brun.mjs <games> [--jobs=J] [--chunk=K] [--ccp=normal] [--kmt=normal]
// Prints the sums, the per-game rows (seed, winner, reason, turn, B decisions) and one line
// `BGAMES-VERDICT 局數 n / 結束 n / 拒絕或卡住 n`.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split("=")[1] : d; };
const N = Number(args.find((x) => !x.startsWith("--")) || 50), JOBS = Number(flag("jobs", 10)), CHUNK = Number(flag("chunk", 5));
const levels = [flag("ccp", "normal"), flag("kmt", "normal")];
const script = fileURLToPath(new URL("./bgames.mjs", import.meta.url));

const chunks = [];
for (let f = 1; f <= N; f += CHUNK) chunks.push([f, Math.min(CHUNK, N - f + 1)]);
const results = [];
function runOne([f, c], attempt = 1) {
  return new Promise((done) => {
    const p = spawn(process.execPath, [script, String(f), String(c), ...levels]);
    let so = "", se = "";
    p.stdout.on("data", (d) => (so += d)); p.stderr.on("data", (d) => (se += d));
    p.on("close", (code) => {
      const line = so.split("\n").find((l) => l.startsWith("BGAMES "));
      if (line) return done(JSON.parse(line.slice(7)));
      if (attempt < 2) return done(runOne([f, c], attempt + 1));
      done({ first: f, count: c, ended: 0, actions: 0, errors: [{ seed: f, message: `chunk died twice (exit ${code}): ${se.slice(-300)}` }], reasons: {}, turns: {}, wins: [0, 0], pure: { asked: 0, differ: 0, mutated: 0 }, siege: {}, picks: {}, sweep: {}, perGame: [] });
    });
  });
}
let next = 0;
async function worker() { while (next < chunks.length) { const k = next++; results[k] = await runOne(chunks[k]); } }
await Promise.all(Array.from({ length: Math.min(JOBS, chunks.length) }, worker));

const sum = { games: 0, ended: 0, actions: 0, errors: [], reasons: {}, turns: {}, wins: [0, 0], pure: { asked: 0, differ: 0, mutated: 0 }, siege: {}, picks: {}, sweep: {}, offered: {}, perGame: [] };
const add = (o, src) => { for (const [k, v] of Object.entries(src)) o[k] = (o[k] || 0) + v; };
for (const r of results) {
  sum.games += r.count; sum.ended += r.ended; sum.actions += r.actions; sum.errors.push(...r.errors);
  add(sum.reasons, r.reasons); add(sum.turns, r.turns); sum.wins[0] += r.wins[0]; sum.wins[1] += r.wins[1];
  add(sum.pure, r.pure); add(sum.siege, r.siege); add(sum.picks, r.picks); add(sum.sweep, r.sweep); add(sum.offered, r.offered || {}); sum.perGame.push(...r.perGame);
}
const tot = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const plans = {}, answers = {};
for (const [k, v] of Object.entries(sum.siege)) { const [p, a] = k.split("/"); plans[p] = (plans[p] || 0) + v; answers[a] = (answers[a] || 0) + v; }
const per = sum.perGame.map((g) => g.siege).sort((a, b) => a - b), perS = sum.perGame.map((g) => g.sweep).sort((a, b) => a - b);
const q = (a, f) => (a.length ? a[Math.min(a.length - 1, Math.floor(f * a.length))] : null);
console.log(`levels ${levels.join(" vs ")}, options {"mechanismB":true}, seeds 1..${N}`);
console.log(`ended ${sum.ended}/${sum.games}, actions ${sum.actions}, wins 共 ${sum.wins[0]} 國 ${sum.wins[1]}, reasons ${JSON.stringify(sum.reasons)}, turns ${JSON.stringify(sum.turns)}`);
console.log(`pure: asked ${sum.pure.asked}, differ ${sum.pure.differ}, view mutated ${sum.pure.mutated}`);
console.log(`共軍打城 ${tot(sum.siege)} 次:打點 ${plans.point || 0}、打援 ${plans.relief || 0}`);
console.log(`國軍的回應:固守 ${answers.hold || 0}、增援 ${answers.reinforce || 0}、突圍 ${answers.breakout || 0}`);
console.log(`表的每一格 ${JSON.stringify(sum.siege)}`);
console.log(`國軍被問 ${sum.offered.asked || 0} 次;其中可以增援 ${sum.offered.reinforce || 0} 次、可以突圍 ${sum.offered.breakout || 0} 次`);
console.log(`共軍的 −1 / +1 ${JSON.stringify(sum.picks)}`);
console.log(`進剿 ${tot(sum.sweep)} 次:守 ${sum.sweep.stand || 0}、撤 ${sum.sweep.withdraw || 0}`);
console.log(`每局打城次數 min ${per[0]} / 中位 ${q(per, 0.5)} / max ${per[per.length - 1]};每局進剿 min ${perS[0]} / 中位 ${q(perS, 0.5)} / max ${perS[perS.length - 1]}`);
for (const g of sum.perGame.sort((a, b) => a.seed - b.seed)) console.log(`  種子 ${g.seed}: ${g.winner === 0 ? "共" : "國"} ${g.reason} 第 ${g.turn} 回合;打城 ${g.siege}、進剿 ${g.sweep}${g.logTrimmed ? "(log 被截過)" : ""}`);
for (const e of sum.errors) console.log(`失敗 · 種子 ${e.seed} · ${e.message}`);
console.log(`BGAMES-VERDICT 局數 ${sum.games} / 結束 ${sum.ended} / 拒絕或卡住 ${sum.errors.length}`);
