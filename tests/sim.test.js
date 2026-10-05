// The simulation harness's guard (M2). Orchestrator's file: a peer may run it and falsify against it,
// and does not edit it (TEAM.md). tests/sim.js itself is BE's.
//
//   node --test tests/sim.test.js             about 50 bot games (SIM_SCALE=0.5 for a quick look)
//
// The table the owner decides on (「第一輪模擬」, eight numbers, five cells) comes out of tests/sim.js.
// This file does not trust the harness's own bookkeeping: every game the harness plays leaves its
// seed, options and actions in the final state, so the game is played again here, action by action,
// and the eight numbers are measured again with this file's own code. The two must agree exactly.
// And the harness's games must be the games two bots play from their own VIEWS: the same loop is run
// here (it is the loop of tests/bots-chunk.js) and must produce the same actions.
//
// The contract of tests/sim.js (the issue has it in words):
//   CELLS                      { full, A, F, H, R }: the options of each cell
//   playGame(seed, { ccp, kmt, options })   -> { st, rec }
//       st   the final state (st.seed, st.options, st.actions replay it)
//       rec  { turnEnds: [{ turn, mandate, isolated: [ids, sorted], support: [蘇聯, 美國] }],   at E.probe.turnEnd
//              firstIsolated: { cityId: turn },   st.turn the first time E.isolatedCities(st) lists it,
//                                                 looked at after createGame and after every E.apply
//              capitalMoved: { side: turn } }     the log's capitalCheck entries with result "moved"
//   summarize([{ st, rec }, …]) -> the sums below (`aggregate` in this file is the same thing)
//   simulate({ games, seed, ccp, kmt, options }) -> summarize of playGame(seed … seed + games − 1)
//
// Three verdicts per check. Everything answers 尚未實作 while tests/sim.js is still Zongheng's harness
// (it names Zongheng's capital "guanzhong").
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { R, section, check, eq, ok, nonEmpty, summary } from "./harness.js";
import * as E from "../public/shared/engine.js";

const CCP = 0, KMT = 1;
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SCALE = Number(process.env.SIM_SCALE || 1), games = (n) => Math.max(2, Math.round(n * SCALE));
const all = (...rs) => { let said = true; for (const r of rs) { if (r !== true && !(r && r.pass)) return r; if (r !== true) said = r; } return said; };
// One spelling of a value, whatever the order its keys were written in.
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]])) : v));
const firstDiff = (a, b, at = "") => {
  if (canon(a) === canon(b)) return null;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) { const d = firstDiff(a[k], b[k], `${at}.${k}`); if (d) return d; }
  }
  return `${at || "(整個值)"}:harness ${JSON.stringify(a)?.slice(0, 160)},重算 ${JSON.stringify(b)?.slice(0, 160)}`;
};

const simSource = readFileSync(here("./sim.js"), "utf8");
const TODO = /guanzhong/.test(simSource) ? "TODO: tests/sim.js 還是縱橫的 harness(裡面還有 guanzhong):沒有這個遊戲的 cell、也量不到那八個數字" : null;
const S = TODO ? null : await import("./sim.js");
const B = TODO ? null : await import("../public/shared/bots.js");

// The cells, from the owner's plan (全開, and one lever off each) and the switches' rulings (#13).
const SPEC_CELLS = { full: {}, A: { supply: false }, F: { situations: false }, H: { aid: false, garrison: false }, R: { rounds: "symmetric" } };

// ---------------------------------------------------------------- this file's own measurement
// Play the recorded game again and measure it. Nothing here comes from the harness but the seed, the
// options and the list of actions.
function measure(final) {
  const rec = { turnEnds: [], firstIsolated: {}, capitalMoved: {} };
  let s = E.createGame(final.seed, final.options);
  const see = (x) => { for (const id of E.isolatedCities(x)) if (!(id in rec.firstIsolated)) rec.firstIsolated[id] = x.turn; };
  see(s);
  for (const a of final.actions) {
    E.probe.turnEnd = (x) => rec.turnEnds.push({ turn: x.turn, mandate: x.mandate, isolated: E.isolatedCities(x).slice().sort(), support: x.support.slice() });
    try { s = E.apply(s, a); } finally { E.probe.turnEnd = null; }
    see(s);
  }
  for (const l of s.log) if (l.type === "capitalCheck" && l.result === "moved") rec.capitalMoved[l.whose] = l.t;
  return { st: s, rec };
}
const tally = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
function aggregate(list) {
  const out = { games: list.length, wins: [0, 0], reasons: {}, endTurns: {}, sealsBefore4: 0, mandateByTurn: {}, isolatedByTurn: {}, supportByTurn: {}, firstIsolated: {}, capitalMoved: [{}, {}] };
  for (const { st, rec } of list) {
    out.wins[st.winner]++; tally(out.reasons, st.reason); tally(out.endTurns, st.turn);
    if (st.reason === "alliance" && st.turn <= 3) out.sealsBefore4++;
    for (const e of rec.turnEnds) {
      const m = (out.mandateByTurn[e.turn] ||= { n: 0, sum: 0 }); m.n++; m.sum += e.mandate;
      const i = (out.isolatedByTurn[e.turn] ||= { n: 0, sum: 0 }); i.n++; i.sum += e.isolated.length;
      const u = (out.supportByTurn[e.turn] ||= { n: 0, su: {}, us: {} }); u.n++; tally(u.su, e.support[CCP]); tally(u.us, e.support[KMT]);
    }
    for (const [id, t] of Object.entries(rec.firstIsolated)) tally((out.firstIsolated[id] ||= {}), t);
    for (const side of [CCP, KMT]) if (rec.capitalMoved[side] != null) tally(out.capitalMoved[side], rec.capitalMoved[side]);
  }
  return out;
}
// Two bots, each deciding from its own view: the loop of tests/bots-chunk.js. Returns the actions.
function playFromViews(seed, options, levels = ["normal", "normal"]) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, options), n = 0;
  while (st.winner == null) {
    if (++n > 4000) throw new Error(`seed ${seed}: did not end`);
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    // #27 / #28: a 圍點打援 decision carries the bot's `game` (its note, not part of the move); like
    // tests/bots-chunk.js, it is taken off before the move reaches the engine.
    const { game, ...move } = B.decide(E.view(st, side), side, levels[side], rng);
    st = E.apply(st, move);
  }
  return st;
}
const strip = (actions) => JSON.stringify(actions.map(({ why, ...a }) => a));

const cache = new Map();
const played = (cell, seed) => { const k = `${cell}/${seed}`; if (!cache.has(k)) cache.set(k, S.playGame(seed, { ccp: "normal", kmt: "normal", options: SPEC_CELLS[cell] })); return cache.get(k); };
const seedsOf = (cell) => Array.from({ length: games(cell === "full" ? 12 : 6) }, (_, i) => 101 + i);
const SAMPLE = [["full", seedsOf("full")], ["A", seedsOf("A")], ["F", seedsOf("F")]];

// ================================================================
section("S1 模擬 harness 的對局是真的對局");

check("五個 cell 的開關:全開,以及 A、F、H、行動回合對稱各關一根", () => {
  if (TODO) return TODO;
  return all(eq(canon(S.CELLS), canon(SPEC_CELLS), "CELLS"), ok(true, Object.entries(SPEC_CELLS).map(([k, v]) => `${k} ${JSON.stringify(v)}`).join(";")));
});

check("每一局都留得下種子、開關與動作,而且從它們重播得回同一個結局", () => {
  if (TODO) return TODO;
  let n = 0;
  for (const [cell, seeds] of SAMPLE) for (const seed of seeds) {
    const { st } = played(cell, seed);
    if (st.winner == null) return `${cell} 種子 ${seed}:對局沒有結束`;
    const again = E.replay(st.seed, st.options, st.actions);
    const d = firstDiff({ ...again, log: null }, { ...st, log: null }); if (d) return `${cell} 種子 ${seed}:重播的結局不同 ${d}`;
    for (const [k, v] of Object.entries(SPEC_CELLS[cell])) { const q = eq(st.options[k], v, `${cell} 種子 ${seed} 的開關 ${k}`); if (q !== true) return q; }
    n++;
  }
  return all(nonEmpty(n, "重播過的局數"), ok(true, `${n} 局都結束,重播的結局相同,開關是那個 cell 的`));
});

check("對局是兩個從自己的 view 決定的 bot 打的:這裡用同一個迴圈自己打,動作一模一樣", () => {
  if (TODO) return TODO;
  let n = 0, acts = 0;
  for (const [cell, seeds] of SAMPLE) for (const seed of seeds.slice(0, games(4))) {
    const mine = playFromViews(seed, SPEC_CELLS[cell]), theirs = played(cell, seed).st;
    if (strip(mine.actions) !== strip(theirs.actions)) {
      const i = mine.actions.findIndex((a, k) => strip([a]) !== strip([theirs.actions[k] || {}]));
      return `${cell} 種子 ${seed}:第 ${i + 1} 個動作不同(共 ${mine.actions.length} 對 ${theirs.actions.length}):這裡 ${strip([mine.actions[i]]).slice(0, 140)},harness ${strip([theirs.actions[i] || {}]).slice(0, 140)}`;
    }
    n++; acts += mine.actions.length;
  }
  return all(nonEmpty(n, "比過的局數"), ok(true, `${n} 局、${acts} 個動作,跟 harness 的逐一相同`));
});

check("同一個種子打兩次是同一局", () => {
  if (TODO) return TODO;
  const a = S.playGame(101, { options: SPEC_CELLS.full }), b = played("full", 101);
  return all(eq(strip(a.st.actions), strip(b.st.actions), "兩次的動作"), eq(canon(a.rec), canon(b.rec), "兩次的紀錄"), ok(true, `${a.st.actions.length} 個動作、紀錄都相同`));
});

// ================================================================
section("S2 那八個數字量得對");

check("每一局的紀錄(回合末的民心、孤城、支持度;每座城第一次成為孤城;遷都)跟重打一次量到的一樣", () => {
  if (TODO) return TODO;
  let n = 0, ends = 0, iso = 0, moves = 0;
  for (const [cell, seeds] of SAMPLE) for (const seed of seeds) {
    const g = played(cell, seed), mine = measure(g.st);
    const d = firstDiff(g.rec, mine.rec); if (d) return `${cell} 種子 ${seed}:紀錄不同 ${d}`;
    n++; ends += mine.rec.turnEnds.length; iso += Object.keys(mine.rec.firstIsolated).length; moves += Object.keys(mine.rec.capitalMoved).length;
  }
  // The sample must have something of each kind to compare, or the agreement proves nothing about it.
  return all(nonEmpty(n, "比過的局數"), nonEmpty(ends, "樣本裡的回合末"), nonEmpty(iso, "樣本裡出現過的孤城(一座都沒有的話,這一條沒有比到孤城)"),
    ok(true, `${n} 局:${ends} 個回合末、${iso} 次「第一次成為孤城」、${moves} 次遷都,都跟重算的相同`));
});

check("加總(勝負、結束方式、整編在第 4 回合前結束的局數、逐回合的民心 / 孤城數 / 支持度、孤城時間、遷都)跟這裡自己加的一樣", () => {
  if (TODO) return TODO;
  for (const [cell, seeds] of SAMPLE) {
    const list = seeds.map((seed) => played(cell, seed));
    const theirs = S.summarize(list), mine = aggregate(list.map((g) => measure(g.st)));
    const d = firstDiff(theirs, mine); if (d) return `${cell}:加總不同 ${d}`;
  }
  const full = aggregate(SAMPLE[0][1].map((seed) => measure(played("full", seed).st)));
  return ok(true, `三個 cell 的加總都相同;全開 ${full.games} 局:共軍勝 ${full.wins[CCP]}、國軍勝 ${full.wins[KMT]},結束方式 ${JSON.stringify(full.reasons)}`);
});

check("simulate() 就是把那些種子打完再加總", () => {
  if (TODO) return TODO;
  const seeds = SAMPLE[2][1], theirs = S.simulate({ games: seeds.length, seed: seeds[0], ccp: "normal", kmt: "normal", options: SPEC_CELLS.F });
  const mine = aggregate(seeds.map((seed) => measure(played("F", seed).st)));
  const d = firstDiff(theirs, mine); if (d) return `simulate(F):${d}`;
  return ok(true, `F ${seeds.length} 局:simulate() 的結果跟逐局重算的加總相同`);
});

// ---------------------------------------------------------------- verdict
test("sim: the guard of the simulation harness", () => {
  const s = summary();
  for (const p of R.pass) console.log(`通過 · ${p.label}${p.msg ? " · " + p.msg : ""}`);
  for (const t of s.todos) console.log(`尚未實作 · ${t.label} · ${t.msg}`);
  for (const f of s.failures) console.log(`失敗 · ${f.label} · ${f.msg}`);
  console.log(`SIM-VERDICT 通過 ${s.pass} / 失敗 ${s.fail} / 尚未實作 ${s.todo}`);
  assert.equal(s.fail, 0, s.failures.map((f) => `${f.label}: ${f.msg}`).join("\n"));
});
