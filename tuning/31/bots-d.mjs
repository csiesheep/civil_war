// #31, BE: bot-vs-bot games under mechanism D -- do they all end, with no refusal, and how often does each
// of D's events happen (the base for the issue that teaches the bots D).
//   node tuning/31/bots-d.mjs 50 --jobs=25 --out=tuning/31/bots-d.txt [--resume] [--options={"mechanismD":true}]
// One game per child process (the loop of tests/bots-chunk.js: the side drawn, each seat deciding from its
// own view, `move` without the bot's `game`); the parent keeps every finished game in <out>.state.json,
// so --resume plays only the games not there yet. Levels normal / normal unless --ccp= / --kmt=.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";

const CCP = 0, KMT = 1;
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };

function playOne(seed, options, levels) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, options), n = 0;
  const rec = { seed, decisions: { grayOrder: 0 }, refused: null };
  const move = (a) => { if (!a || !a.game) return a; const { game, why, ...rest } = a; return rest; };
  while (st.winner == null) {
    if (++n > 4000) throw new Error(`did not end in 4000 actions (turn ${st.turn}, phase ${st.phase})`);
    const who = E.mustAct(st);
    if (!who.length) throw new Error(`nobody must act (turn ${st.turn}, phase ${st.phase})`);
    const side = who[rng.int(who.length)];
    const a = B.decide(E.view(st, side), side, levels[side], rng);
    if (!a) throw new Error(`no decision for side ${side} (turn ${st.turn}, phase ${st.phase})`);
    if (st.pending && st.pending.tag === "grayOrder") { rec.decisions.grayOrder++; rec.decisions[`grayOrder:${a.choice}`] = (rec.decisions[`grayOrder:${a.choice}`] || 0) + 1; }
    try { st = E.apply(st, move(a)); }
    catch (e) { rec.refused = `turn ${st.turn}, phase ${st.phase}: ${JSON.stringify(move(a))}: ${e && e.message}`; return rec; }
  }
  const L = st.log, cnt = (f) => L.filter(f).length;
  Object.assign(rec, {
    winner: st.winner, reason: st.reason, turn: st.turn, actions: n, mandate: st.mandate,
    integrate: cnt((l) => l.type === "integrate"), integratePoints: L.filter((l) => l.type === "integrate").reduce((t, l) => t + l.n, 0),
    talks: cnt((l) => l.type === "talks"),
    mieConquest: cnt((l) => l.type === "mie" && l.how === "conquest"), mieTalks: cnt((l) => l.type === "mie" && l.how === "talks"),
    seal: cnt((l) => l.type === "seal"),
    grayHit: cnt((l) => l.type === "grayHit"), grayHitPoints: L.filter((l) => l.type === "grayHit").reduce((t, l) => t + l.n, 0),
    attitude: Object.fromEntries(["isolated", "attacked", "integrate", "talks"].map((w) => [w, cnt((l) => l.type === "attitude" && l.why === w)])),
    firstMie: (L.find((l) => l.type === "mie") || {}).t ?? null, firstSeal: (L.find((l) => l.type === "seal") || {}).t ?? null,
    mie: Object.keys(st.mie).sort(), seals: Object.keys(st.seals).sort(), attitudes: st.attitude ? { ...st.attitude } : null,
    gray: st.gray ? Object.values(st.gray).reduce((t, g) => t + g, 0) : null,
  });
  return rec;
}

if (process.argv[2] === "--one") {
  const seed = Number(process.argv[3]), options = JSON.parse(process.argv[4]), levels = JSON.parse(process.argv[5]);
  let rec;
  try { rec = playOne(seed, options, levels); } catch (e) { rec = { seed, error: String((e && e.message) || e).slice(0, 400) }; }
  console.log("BOTSD " + JSON.stringify(rec));
} else {
  const games = Number(process.argv[2] || 50), jobs = Number(arg("jobs", 8)), out = arg("out", "tuning/31/bots-d.txt");
  const options = JSON.parse(arg("options", '{"mechanismD":true}')), levels = [arg("ccp", "normal"), arg("kmt", "normal")];
  const stateFile = `${out}.state.json`;
  const state = process.argv.includes("--resume") && existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : { meta: { options, levels, rulesVersion: E.RULES_VERSION }, games: {} };
  const save = () => { writeFileSync(`${stateFile}.tmp`, JSON.stringify(state)); renameSync(`${stateFile}.tmp`, stateFile); };
  const todo = []; for (let s = 1; s <= games; s++) if (!state.games[s]) todo.push(s);
  const self = fileURLToPath(import.meta.url);
  const runOne = (seed, attempt = 1) => new Promise((resolve) => {
    const c = spawn(process.execPath, [self, "--one", String(seed), JSON.stringify(options), JSON.stringify(levels)]);
    let buf = ""; c.stdout.on("data", (d) => { buf += d; });
    c.on("close", (code) => {
      const line = buf.split("\n").find((l) => l.startsWith("BOTSD "));
      if (line) { state.games[seed] = JSON.parse(line.slice(6)); save(); return resolve(); }
      if (attempt < 2) return resolve(runOne(seed, attempt + 1));
      state.games[seed] = { seed, error: `the child died twice (exit ${code})` }; save(); resolve();
    });
  });
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, todo.length) }, async () => { while (next < todo.length) await runOne(todo[next++]); }));
  report(state, games, out);
}

function report(state, games, out) {
  const G = Object.values(state.games).filter((g) => g.seed <= games);
  const ok = G.filter((g) => !g.error && !g.refused), lines = [];
  const sum = (k) => ok.reduce((t, g) => t + (g[k] || 0), 0), dist = (k) => { const m = {}; for (const g of ok) m[g[k] ?? "無"] = (m[g[k] ?? "無"] || 0) + 1; return JSON.stringify(m); };
  const per = (k) => ok.map((g) => g[k] || 0).sort((a, b) => a - b), q = (a) => `最少 ${a[0]} / 中位 ${a[Math.floor(a.length / 2)]} / 最多 ${a[a.length - 1]}`;
  lines.push(`#31 bot 對局,機制 D:${JSON.stringify(state.meta)}`);
  lines.push(`局數 ${G.length} / 結束 ${ok.length} / 被拒絕 ${G.filter((g) => g.refused).length} / 報錯或卡住 ${G.filter((g) => g.error).length}`);
  for (const g of G.filter((x) => x.refused || x.error)) lines.push(`失敗 · 種子 ${g.seed} · ${g.refused || g.error}`);
  lines.push(`結束的方式 ${dist("reason")};勝者(0 共 1 國)${dist("winner")};結束的回合 ${dist("turn")}`);
  for (const [k, zh] of [["integrate", "整編(次)"], ["integratePoints", "整編換掉的灰(點)"], ["talks", "統戰(次)"], ["mieConquest", "易幟:打下來的"], ["mieTalks", "易幟:談下來的"], ["seal", "整編完成"], ["grayHit", "進攻打到灰(次)"], ["grayHitPoints", "進攻打掉的灰(點)"]]) {
    lines.push(`${zh}:${G.length} 局合計 ${sum(k)};有的局 ${ok.filter((g) => g[k]).length};每局 ${q(per(k))}`);
  }
  const att = {}; for (const g of ok) for (const [w, n] of Object.entries(g.attitude || {})) att[w] = (att[w] || 0) + n;
  lines.push(`態度變了(依原因,合計):${JSON.stringify(att)}(isolated = 結算的孤城往通共;attacked = 打到通共的灰退回觀望)`);
  const go = {}; for (const g of ok) for (const [k, n] of Object.entries(g.decisions || {})) go[k] = (go[k] || 0) + n;
  lines.push(`國軍的 grayOrder 決定:${JSON.stringify(go)}`);
  lines.push(`每局第一個易幟的回合 ${dist("firstMie")};第一個整編完成的回合 ${dist("firstSeal")}`);
  const pm = {}, ps = {}; for (const g of ok) { for (const p of g.mie || []) pm[p] = (pm[p] || 0) + 1; for (const p of g.seals || []) ps[p] = (ps[p] || 0) + 1; }
  lines.push(`局末有易幟標記的勢力 ${JSON.stringify(pm)};有整編標記的 ${JSON.stringify(ps)}`);
  lines.push("每一局:種子 勝者 方式 回合 | 整編 統戰 易幟(打/談) 整編完成 打到灰 | 結算降 | 第一個易幟 / 整編完成");
  for (const g of ok.sort((a, b) => a.seed - b.seed)) lines.push(`  ${g.seed} ${g.winner} ${g.reason} ${g.turn} | ${g.integrate} ${g.talks} ${g.mieConquest}/${g.mieTalks} ${g.seal} ${g.grayHit} | ${g.attitude.isolated} | ${g.firstMie ?? "-"} / ${g.firstSeal ?? "-"}`);
  const text = lines.join("\n") + "\n";
  writeFileSync(out, text);
  console.log(text);
  console.log(`BOTS-D 局數 ${G.length} / 結束 ${ok.length} / 被拒絕 ${G.filter((g) => g.refused).length} / 報錯 ${G.filter((g) => g.error).length}`);
}
