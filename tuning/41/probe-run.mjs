// #41: tuning/41/probe-worth.mjs over many seeds in child processes, then added up.
//   node tuning/41/probe-run.mjs <name> '<options JSON>' [games=480] [jobs=24] [first seed=41000] ['<C_W JSON>']
//   node tuning/41/probe-run.mjs --sum <name> [<name> …]      (only add up what is on disk)
// Each child writes tuning/41/runs/probe/<name>-<k>.txt (one WORTH line); a file already there with its line is
// kept (a crashed run picks up where it died). The sum: per class, the real-marker turns, the questions, the
// gains (max(0, ·)) and worth = gains / turns; the 和平易手 rounds and their gains (in the 孤城 class). A gain of WIN or
// more is a use that decided the game (the evaluation's ±1000 of a won / lost state): it is not a worth per turn, and
// one of them would outweigh every other use of the class (#40 set its one aside too); such uses are counted apart
// (`wins`) and left out of the worth, in every arm alike. The gains are read from the rows (rounded to 0.01).
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const R = "tuning/41/runs/probe";
const K = ["capital", "isolated", "open", "other"], WIN = 500;
export function sum(name) {
  const tot = { games: 0, markerTurns: {}, gains: {}, asks: {}, handoverRounds: 0, handoverGain: 0, rows: [] };
  for (let k = 0; ; k++) {
    const f = `${R}/${name}-${k}.txt`;
    if (!existsSync(f)) break;
    const m = readFileSync(f, "utf8").match(/WORTH (.*)/);
    if (!m) continue;
    const o = JSON.parse(m[1]);
    tot.games += o.games; tot.handoverRounds += o.handoverRounds; tot.handoverGain += o.handoverGain; tot.rows.push(...o.rows);
    for (const c of K) for (const x of ["markerTurns", "gains", "asks"]) tot[x][c] = (tot[x][c] || 0) + o[x][c];
  }
  tot.wins = {}; tot.chances = {};
  for (const c of K) {
    const mine = tot.rows.filter((r) => (r.tag === "handover" ? c === "isolated" : r.klass === c));
    tot.wins[c] = mine.filter((r) => r.gain >= WIN).length;
    tot.gains[c] = mine.filter((r) => r.gain < WIN).reduce((t, r) => t + Math.max(0, r.gain), 0);
    tot.chances[c] = mine.filter((r) => r.gain < WIN && r.gain > 0.01).length; // #41 round 2: the uses that beat "no"
  }
  tot.worth = Object.fromEntries(K.map((c) => [c, tot.markerTurns[c] ? tot.gains[c] / tot.markerTurns[c] : 0]));
  // #41 round 2 (orchestrator 裁決 #41): a real marker is used once. p = the chances a turn that beat "no" (capped at 1),
  // G = the mean gain of those; the bot prices one standing L turns as G × (1 − (1 − p)^L) (bots.js `realOnce`).
  tot.p = Object.fromEntries(K.map((c) => [c, tot.markerTurns[c] ? Math.min(1, tot.chances[c] / tot.markerTurns[c]) : 0]));
  tot.G = Object.fromEntries(K.map((c) => [c, tot.chances[c] ? tot.gains[c] / tot.chances[c] : 0]));
  return tot;
}
export function show(name, t) {
  const L = [`${name}: ${t.games} 局;和平易手可以做的行動回合 ${t.handoverRounds}、好處合計 ${t.handoverGain.toFixed(2)}`];
  for (const c of K) {
    const g = t.rows.filter((r) => r.klass === c && r.tag !== "handover").map((r) => r.gain);
    L.push(`  ${c.padEnd(8)} 真標記回合 ${String(t.markerTurns[c]).padStart(4)}  被問 ${String(t.asks[c]).padStart(4)}(有好處 ${g.filter((x) => x > 0.01).length})  好處合計 ${t.gains[c].toFixed(2).padStart(8)}(另有定勝負的 ${t.wins[c]} 次)  每回合 ${t.worth[c].toFixed(3)}  p ${t.p[c].toFixed(4)}  G ${t.G[c].toFixed(2)}`);
  }
  return L.join("\n");
}
const args = process.argv.slice(2);
if (args[0] === "--sum") {
  for (const n of args.slice(1)) console.log(show(n, sum(n)));
} else if (args.length) {
  const [name, opts = "{}", games = "480", jobs = "24", first = "41000", cw] = args;
  const G = Number(games), J = Number(jobs), F = Number(first), per = Math.ceil(G / J);
  const todo = [];
  for (let k = 0; k * per < G; k++) {
    const f = `${R}/${name}-${k}.txt`;
    if (existsSync(f) && /WORTH /.test(readFileSync(f, "utf8"))) continue;
    todo.push({ k, f, a: F + k * per, n: Math.min(per, G - k * per) });
  }
  await Promise.all(todo.map(({ f, a, n }) => new Promise((done) => {
    const ch = spawn(process.execPath, ["tuning/41/probe-worth.mjs", String(a), String(n), opts, ...(cw ? [cw] : [])]);
    let out = "";
    ch.stdout.on("data", (d) => { out += d; });
    ch.stderr.on("data", (d) => { out += d; });
    ch.on("close", (code) => { writeFileSync(f, out); if (code) console.log(`${f}: exit ${code}`); done(); });
  })));
  console.log(show(name, sum(name)));
}
