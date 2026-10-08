// #35, §四 4: normal bot against normal bot with mechanism E on, 50 games (seeds 1..50): every game must
// end, nothing refused; and what E did in them, the base for the next issue (teaching the bots E).
//   node tuning/35/bots50.mjs [games=50] [--jobs=25] [--out=tuning/35/bots50.json]
//   node tuning/35/bots50.mjs --child <first> <count>          (one chunk; prints `B50 {json}`)
// The game loop is tests/sim.js's `playGame` (each seat decides from its own view; it throws when nobody can
// act, when a bot has no decision, or when the engine refuses or crashes). E's numbers are read from the log.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { playGame } from "../../tests/sim.js";

const OPTIONS = { mechanismE: true };
const args = process.argv.slice(2);

// One game's E, from its log: the plays, the thresholds, and each track at every turn's end.
function eOf(st) {
  const g = { print: 0, peg: 0, radical: 0, returnHome: 0, thresholds: {}, inflationEnd: {}, leftismEnd: {}, centristsEnd: {}, settleVp: 0, truce: 0 };
  let inf = 0, left = 0, cen = 0;
  for (const l of st.log) {
    if (l.type === "print") g.print++;
    else if (l.type === "peg") g.peg++;
    else if (l.type === "radical") g.radical++;
    else if (l.type === "returnHome") g.returnHome++;
    else if (l.type === "eThreshold") { const k = `${l.track}${l.n}`; g.thresholds[k] = (g.thresholds[k] || 0) + 1; if (l.to != null) left = l.to; }
    else if (l.type === "inflation") inf = l.to;
    else if (l.type === "leftism") left = l.to;
    else if (l.type === "centrists") { cen = l.to; if (l.why === "truce") g.truce++; }
    else if (l.type === "centristsSettle") g.settleVp += l.n;
    else if (l.type === "endTurn") { g.inflationEnd[l.turn] = inf; g.leftismEnd[l.turn] = left; g.centristsEnd[l.turn] = cen; }
  }
  return g;
}

if (args[0] === "--child") {
  const first = Number(args[1]), count = Number(args[2]);
  const out = [];
  for (let seed = first; seed < first + count; seed++) {
    const t0 = Date.now();
    try {
      const { st } = playGame(seed, { options: OPTIONS });
      out.push({ seed, ok: true, winner: st.winner, reason: st.reason, turn: st.turn, ms: Date.now() - t0, e: eOf(st) });
    } catch (e) { out.push({ seed, ok: false, error: String((e && e.message) || e).slice(0, 400), ms: Date.now() - t0 }); }
  }
  console.log("B50 " + JSON.stringify(out));
} else {
  const games = Number(args.find((a) => /^\d+$/.test(a)) || 50);
  const jobs = Number((args.find((a) => a.startsWith("--jobs=")) || "--jobs=25").slice(7));
  const outFile = (args.find((a) => a.startsWith("--out=")) || "--out=tuning/35/bots50.json").slice(6);
  const per = Math.ceil(games / jobs), chunks = [];
  for (let f = 1; f <= games; f += per) chunks.push([f, Math.min(per, games - f + 1)]);
  const self = fileURLToPath(import.meta.url);
  const run = ([f, c]) => new Promise((res) => {
    const p = spawn(process.execPath, [self, "--child", String(f), String(c)]);
    let so = "", se = "";
    p.stdout.on("data", (d) => (so += d)); p.stderr.on("data", (d) => (se += d));
    p.on("close", (code) => {
      const line = so.split("\n").find((l) => l.startsWith("B50 "));
      res(line ? JSON.parse(line.slice(4)) : Array.from({ length: c }, (_, i) => ({ seed: f + i, ok: false, error: `chunk died (exit ${code}): ${se.slice(-300)}` })));
    });
  });
  const results = (await Promise.all(chunks.map(run))).flat().sort((a, b) => a.seed - b.seed);
  writeFileSync(outFile, JSON.stringify({ options: OPTIONS, games, results }, null, 1) + "\n");
  const ok = results.filter((r) => r.ok), bad = results.filter((r) => !r.ok);
  const sum = (f) => ok.reduce((t, r) => t + f(r), 0);
  const dist = (f) => { const d = {}; for (const r of ok) { const k = f(r); d[k] = (d[k] || 0) + 1; } return d; };
  const th = {}; for (const r of ok) for (const [k, n] of Object.entries(r.e.thresholds)) th[k] = (th[k] || 0) + n;
  console.log(`局數 ${games} / 結束 ${ok.length} / 報錯或卡住或被拒絕 ${bad.length}`);
  for (const b of bad.slice(0, 10)) console.log(`失敗 · 種子 ${b.seed} · ${b.error}`);
  console.log(`結束的方式 ${JSON.stringify(dist((r) => r.reason))};勝者(0 共 1 國)${JSON.stringify(dist((r) => r.winner))};結束的回合 ${JSON.stringify(dist((r) => r.turn))}`);
  console.log(`印鈔 ${sum((r) => r.e.print)} 次(每局分佈 ${JSON.stringify(dist((r) => r.e.print))});平抑 ${sum((r) => r.e.peg)};激進 ${sum((r) => r.e.radical)};還鄉團 ${sum((r) => r.e.returnHome)}`);
  console.log(`門檻 ${JSON.stringify(th)};停戰先動手移中間派 ${sum((r) => r.e.truce)} 局;結算時中間派給的民心合計 ${sum((r) => r.e.settleVp)}(正 = 往共軍)`);
  for (let t = 1; t <= 8; t++) {
    const at = ok.filter((r) => r.e.centristsEnd[t] !== undefined);
    if (!at.length) continue;
    const d = {}; for (const r of at) { const k = r.e.centristsEnd[t]; d[k] = (d[k] || 0) + 1; }
    console.log(`第 ${t} 回合結算後 中間派 ${JSON.stringify(d)}(${at.length} 局走到);通膨 ${JSON.stringify(dist((r) => r.e.inflationEnd[t] ?? "-"))};左傾 ${JSON.stringify(dist((r) => r.e.leftismEnd[t] ?? "-"))}`);
  }
  const ms = ok.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`每局毫秒 中位數 ${ms[Math.floor(ms.length / 2)]}、最長 ${ms[ms.length - 1]}`);
  console.log(`B50-VERDICT 局數 ${games} / 結束 ${ok.length} / 問題 ${bad.length} / 通膨崩潰 ${ok.filter((r) => r.reason === "inflation").length}`);
}
