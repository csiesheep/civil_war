// Bot-vs-bot simulation harness (#15): the instrument behind the owner's 「第一輪模擬」 table.
// Both seats are bots, each deciding from its own VIEW (never the state), in the loop of
// tests/bots-chunk.js. Five cells: everything on, and one lever off each.
//
//   node tests/sim.js 1000 --cells --jobs=8 --out=sim1.txt            # five cells, in child processes
//   node tests/sim.js 1000 --cells --jobs=8 --out=sim1.txt --resume   # pick up where it died
//   node tests/sim.js --report=sim1.txt.state.json > table.md          # the markdown table
//   node tests/sim.js 20 --cell=A                                      # one cell, in this process, report at once
//
// Other flags: --seed=S (first seed, default 1; every cell plays the same seeds), --chunk=K (games
// per child process, default 10), --ccp=normal --kmt=normal (levels). --json (one cell) prints the
// chunk's sums as JSON: that is how the children talk to the parent.
//
// #23, variants: --variant=<name> plays every game under the named options of
// tuning/23/variants.mjs (`VARIANTS`), with the cell's own switches laid over them (a cell's key
// wins). The state file's meta records the name and the whole options object. --cell=X with --out
// runs that one cell in child processes and writes a state file, like --cells does for all five:
//   node tests/sim.js 300 --cell=full --variant=P --jobs=10 --out=tuning/23/P.txt
//
// The contract (#15, orchestrator's ruling; tests/sim.test.js replays every game and measures again):
//   CELLS          the options of each cell
//   playGame       one game -> { st, rec }
//   summarize      a list of games -> sums and counts only (no means: the report divides)
//   simulate       summarize of playGame over seeds seed .. seed + games - 1
//
// Node on the development machine dies at random in long runs: a chunk that dies is run again, a
// chunk that keeps dying is run one game at a time, and the running sums are kept on disk after
// every chunk (`<out>.state.json`), so `--resume` loses at most the chunks in flight.
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

const CCP = 0, KMT = 1;

// The owner's plan: 全開, and one lever off each (A 補給, F 時局, H 援助與駐防, 行動回合不對稱).
// What each switch means is #13's.
export const CELLS = {
  full: {},
  A: { supply: false },
  F: { situations: false },
  H: { aid: false, garrison: false },
  R: { rounds: "symmetric" },
};

const MAX_ACTIONS = 4000;

// ---------------------------------------------------------------- one game
// The loop is tests/bots-chunk.js's, in its order and with its draws: the side is drawn even when
// only one side must act. The bot is handed `E.view(st, side)`. Recording reads the state and the
// log only and draws nothing, so a game is the same game with or without it.
// #27: `more`, beside `rec` (whose shape tests/sim.test.js pins), the numbers of mechanism B and of the
// 孤城 per game (`moreStats` adds them up). Read from the state, the log and the decisions; draws nothing.
export function playGame(seed, { ccp = "normal", kmt = "normal", options = {} } = {}) {
  const levels = [ccp, kmt];
  const rec = { turnEnds: [], firstIsolated: {}, capitalMoved: {} };
  const more = {
    asked: 0, canReinforce: 0, canBreakout: 0, onlyHold: 0, noReinforce: { isolated: 0, noR: 0, full: 0 }, noRAndFull: 0,
    plans: {}, answers: {}, cells: {}, picks: {}, sieges: 0, besieged: 0, besiegedLoss: 0, besiegedCities: 0,
    sweep: {}, games: [{ n: 0, pure: 0 }, { n: 0, pure: 0 }],
  };
  // #32, mechanism D (only with options.mechanismD: off D `more` has no `d` and nothing below runs).
  const D = options.mechanismD ? newD() : null;
  if (D) more.d = D;
  // #36, mechanism E (only with options.mechanismE: off E `more` has no `e` and nothing below runs).
  const X = options.mechanismE ? newE() : null;
  if (X) more.e = X;
  // At the turn-end checks (probe.home, "turnEnd"): the besieged cities that supply still reaches, i.e.
  // a 孤城 only by the marker; the `attrition` entry that follows is read against them.
  let siegeOnly = new Set();
  const onHome = (s, when) => {
    if (when !== "turnEnd" || !s.options.mechanismB) return;
    const ok = E.supplied(s);
    siegeOnly = new Set(E.SPACES.filter((x) => x.kind === "city" && E.besieged(s, x.id) && ok.has(x.id) && E.infOf(s, x.id)[KMT] > 0).map((x) => x.id));
    more.besiegedCities += siegeOnly.size;
  };
  // 引擎的回合末: the moment the engine reports a turn's end (after the turn-end checks and the
  // discards). The probe is on only around the game's own apply: the bots think with the same module.
  const onTurnEnd = (s) => {
    rec.turnEnds.push({ turn: s.turn, mandate: s.mandate, isolated: E.isolatedCities(s).slice().sort(), support: [s.support[CCP], s.support[KMT]] });
    if (X) turnEndE(X, s);
  };
  const lookIsolated = (s) => {
    for (const id of E.isolatedCities(s)) if (rec.firstIsolated[id] === undefined) rec.firstIsolated[id] = s.turn;
  };
  let logSeen = 0;
  const lookLog = (s) => {
    // New entries are at the end of the log (trimming only ever drops old moves), read in order.
    const fresh = [];
    for (let k = s.log.length - 1; k >= 0 && s.log[k].i > logSeen; k--) fresh.push(s.log[k]);
    for (let k = fresh.length - 1; k >= 0; k--) {
      const l = fresh[k];
      if (l.type === "capitalCheck" && l.result === "moved") rec.capitalMoved[l.whose] = l.t;
      else if (l.type === "siegeResult") {
        more.sieges++; bump(more.plans, l.plan); bump(more.answers, l.response); bump(more.cells, `${l.plan}/${l.response}`);
        if (l.besieged) more.besieged++;
      } else if (l.type === "siegeLoss" || l.type === "siegeCapture") bump(more.picks, l.type);
      else if (l.type === "sweepResult") bump(more.sweep, l.response);
      else if (l.type === "attrition") for (const [id, k] of Object.entries(l.losses)) if (siegeOnly.has(id)) more.besiegedLoss += k;
      if (D) readLogD(D, l);
      if (X) readLogE(X, l, s.options.turns);
    }
    if (s.logSeq) logSeen = s.logSeq;
  };

  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, options);
  lookIsolated(st); lookLog(st);
  let n = 0;
  while (st.winner == null) {
    if (++n > MAX_ACTIONS) throw new Error(`seed ${seed}: did not end in ${MAX_ACTIONS} actions (turn ${st.turn}, phase ${st.phase})`);
    const who = E.mustAct(st);
    if (!who.length) throw new Error(`seed ${seed}: nobody must act (turn ${st.turn}, phase ${st.phase})`);
    const side = who[rng.int(who.length)];
    if (st.pending && st.pending.tag === "siege") askedSiege(st, more);
    const talks = D && side === CCP ? talksLegal(st, seed, n) : null;
    const d = B.decide(E.view(st, side), side, levels[side], rng);
    if (!d) throw new Error(`seed ${seed}: no decision for side ${side} (turn ${st.turn}, phase ${st.phase})`);
    if (D) readDecisionD(D, st, side, d, talks);
    // #27: a 圍點打援 decision carries the bot's `game`; it is the bot's note, not part of the move.
    let a = d;
    if (d.game) {
      const { game, ...move } = d; a = move;
      const g = more.games[side]; g.n++; if (Math.max(...Object.values(game.mix)) >= 0.999) g.pure++;
    }
    const before = E.probe.turnEnd, beforeHome = E.probe.home;
    E.probe.turnEnd = onTurnEnd; E.probe.home = onHome;
    try { st = E.apply(st, a); }
    catch (e) { const { why, ...shown } = a; throw new Error(`seed ${seed}: turn ${st.turn}, phase ${st.phase}: the engine refused or crashed on ${JSON.stringify(shown)}: ${e && e.message}`); }
    finally { E.probe.turnEnd = before; E.probe.home = beforeHome; }
    lookIsolated(st); lookLog(st);
  }
  if (D) endD(D, st);
  if (X) endE(X, st);
  return { st, rec, more };
}

// ---------------------------------------------------------------- mechanism E (#36)
// Per game, read from the log and the engine's turn-end probe only (nothing drawn); summed over games by
// `moreStats`, which also keeps the per-game counts as distributions (`ePerGame`).
//   print / peg / radical: the plays (log `print`, `peg`, `radical`), and by turn (`byTurn[t]`).
//   threshold["inflation:3"]: { turn: count } -- the turn each threshold was crossed (左傾 6 every time).
//   atTurnEnd[t]: the centrists, inflation and leftism at the end of turn t (the engine's turnEnd probe).
//   settle[t]: the 民心 the centrists moved at turn t's 結算 (log `centristsSettle`; + toward the Communists);
//     settleToCcp / settleToKmt: the totals each way.
//   centristsMoved[why]: the steps the centrists moved, by cause (truce, inflation, leftism), signed.
//   returnHome[space]: where 還鄉團's blue went ("none" when no space had room).
//   lastTurnTo9: 1 when the Nationalists printed inflation to 9 during the game's last turn.
function newE() {
  return {
    print: 0, peg: 0, radical: 0, byTurn: {}, threshold: {}, atTurnEnd: {}, settle: {}, settleToCcp: 0, settleToKmt: 0,
    centristsMoved: {}, returnHome: {}, lastTurnTo9: 0, collapse: 0,
  };
}
function readLogE(X, l, turns) {
  const at = (k) => bump(slot(X.byTurn, l.t, () => ({})), k);
  if (l.type === "print") { X.print++; at("print"); }
  else if (l.type === "peg") { X.peg++; at("peg"); }
  else if (l.type === "radical") { X.radical++; at("radical"); }
  else if (l.type === "eThreshold") bump(slot(X.threshold, `${l.track}:${l.n}`, () => ({})), l.t);
  else if (l.type === "centristsSettle") { bump(X.settle, l.t, l.n); if (l.n > 0) X.settleToCcp += l.n; else X.settleToKmt -= l.n; }
  else if (l.type === "centrists") bump(X.centristsMoved, l.why, l.to - l.from);
  else if (l.type === "returnHome") bump(X.returnHome, l.space ?? "none");
  else if (l.type === "inflation" && l.why === "print" && l.to === 9 && l.t === turns) X.lastTurnTo9 = 1;
}
function turnEndE(X, s) {
  const e = slot(X.atTurnEnd, s.turn, () => ({ centrists: {}, inflation: {}, leftism: {} }));
  bump(e.centrists, E.centristsOf(s)); bump(e.inflation, E.inflationOf(s)); bump(e.leftism, E.leftismOf(s));
}
function endE(X, st) {
  X.end = { inflation: { [E.inflationOf(st)]: 1 }, leftism: { [E.leftismOf(st)]: 1 }, centrists: { [E.centristsOf(st)]: 1 } };
  if (st.reason === "inflation") X.collapse = 1;
}

// ---------------------------------------------------------------- mechanism D (#32)
// Per game, read from the log, the decisions and the final state; summed over games by `moreStats` (which
// also turns the per-game counts into distributions). Nothing here draws from the game's rng: the score
// gap of a 統戰 not chosen is read on the bot's own guess with an rng of its own (`B.scoreCandidates`).
const DPOW = Object.keys(E.DPOWERS || {});
function newD() {
  return {
    integrate: 0, integratePoints: 0, talks: 0,
    mie: { conquest: 0, talks: 0 }, seal: 0, grayHit: 0, grayHitPoints: 0,
    attitude: {}, // why -> count: isolated (結算 of a 孤城 with gray), integrate, talks, attacked (通共 gray hit back to 觀望)
    grayOrder: {}, // the Nationalists' choice when an attack hits blue and gray
    firstMie: null, firstSeal: null,
    talksLegal: { rounds: 0, chosen: 0, notChosen: 0, gapSum: 0, gapN: 0, gap: {}, opsAsks: 0, opsChosen: 0 },
    integrateLegal: { rounds: 0, chosen: 0 },
  };
}
const playsPolitics = (a) => (a.type === "play" && a.use === "politics") || (a.type === "choose" && a.choice && typeof a.choice === "object" && a.choice.use === "politics");
function readLogD(D, l) {
  if (l.type === "integrate") { D.integrate++; D.integratePoints += l.n; }
  else if (l.type === "talks") D.talks++;
  else if (l.type === "mie" && l.how) { D.mie[l.how] = (D.mie[l.how] || 0) + 1; (D.howOf ||= {})[l.state] = l.how; if (D.firstMie == null) D.firstMie = l.t; }
  else if (l.type === "seal" && l.how === "integrated") { D.seal++; if (D.firstSeal == null) D.firstSeal = l.t; }
  else if (l.type === "grayHit") { D.grayHit++; D.grayHitPoints += l.n; }
  else if (l.type === "attitude") bump(D.attitude, l.why);
}
// Before the Communists decide: is a 統戰 legal now (an action round, or an ops choice that allows it), and
// on an action round, the best 統戰's score against the best play's (one guess, the bot's own scoring).
function talksLegal(st, seed, n) {
  if (st.phase !== "action") return null;
  if (st.pending) {
    const p = st.pending;
    return p.who === CCP && p.kind === "ops" && p.allowed.includes("politics") && E.politicsOptions(st, CCP, p.ops).length ? { ops: true } : null;
  }
  const L = E.legal(st, CCP);
  if (L.kind !== "action" || !L.cards.some((c) => c.uses.politics && c.uses.politics.targets.length)) return null;
  const sc = B.scoreCandidates(E.view(st, CCP), CCP, E.makeRng((seed * 7919 + n) >>> 0));
  const pol = sc.find((x) => x.a.use === "politics");
  return { ops: false, gap: sc.length && pol ? sc[0].v - pol.v : null };
}
function readDecisionD(D, st, side, d, talks) {
  if (st.pending && st.pending.tag === "grayOrder" && side === KMT) bump(D.grayOrder, d.choice);
  if (side === KMT && st.phase === "action" && !st.pending) {
    const L = E.legal(st, KMT);
    if (L.kind === "action" && L.cards.some((c) => c.uses.politics && c.uses.politics.targets.length)) { D.integrateLegal.rounds++; if (playsPolitics(d)) D.integrateLegal.chosen++; }
  }
  if (!talks) return;
  const T = D.talksLegal, chose = playsPolitics(d);
  if (talks.ops) { T.opsAsks++; if (chose) T.opsChosen++; return; }
  T.rounds++;
  if (chose) { T.chosen++; return; }
  T.notChosen++;
  if (talks.gap != null) {
    const g = talks.gap;
    if (g < 500) { T.gapSum += g; T.gapN++; } // a gap of 1000 is a winning play chosen instead: counted apart
    bump(T.gap, g < 5 ? "<5" : g < 10 ? "5-10" : g < 20 ? "10-20" : g < 40 ? "20-40" : g >= 500 ? "win" : "40+");
  }
}
// The final state: where each power ended (易幟 by conquest / by talks, 整編完成, neither) and its attitude;
// the three 易幟 behind an 易幟 win; whether five 整編完成 happened.
function endD(D, st) {
  // (the log is trimmed in a long game: how each 易幟 came is kept as it is read, `howOf`)
  const how = D.howOf || {};
  delete D.howOf;
  D.end = {};
  for (const p of DPOW) {
    const where = st.mie[p] ? `mie:${how[p] || "?"}` : st.seals[p] ? "seal" : "none";
    D.end[p] = { [where]: 1, [`att:${E.attitudeOf(st, p)}`]: 1 };
  }
  D.trio = st.reason === "unification" ? { [Object.keys(st.mie).sort().join("+")]: 1 } : {};
  D.fiveSeals = Object.keys(st.seals).length >= 5 ? 1 : 0;
}
// The Nationalists asked to answer an attack on T: what they may answer, and when they may not
// reinforce, why -- T is a 孤城 (no reinforcement at all), no city may send (R: a city of theirs in
// supply, not besieged, next to T or one village between that the Communists do not control), or T is
// full (cap − blue = 0). The engine's `reinforceSources` is not exported; R is read the same way here.
function askedSiege(st, more) {
  const T = st.pending.target, ids = st.pending.options.map((o) => o.id);
  more.asked++;
  const reinforce = ids.some((id) => id.startsWith("reinforce:")), breakout = ids.some((id) => id.startsWith("breakout:"));
  if (reinforce) more.canReinforce++;
  if (breakout) more.canBreakout++;
  if (ids.length === 1) more.onlyHold++;
  if (reinforce) return;
  if (E.isolatedCities(st).includes(T)) { more.noReinforce.isolated++; return; }
  const ok = E.supplied(st), adj = E.adjOf(st, T);
  const R = E.SPACES.filter((s) => s.kind === "city" && s.id !== T && E.controller(st, s.id) === KMT && ok.has(s.id) && !E.besieged(st, s.id)
    && (adj.includes(s.id) || adj.some((v) => E.SPACE[v].kind === "village" && E.controller(st, v) !== CCP && E.adjOf(st, v).includes(s.id))));
  const full = E.capOf(st, T) - E.infOf(st, T)[KMT] <= 0;
  if (!R.length) { more.noReinforce.noR++; if (full) more.noRAndFull++; }
  else if (full) more.noReinforce.full++;
  else bump(more.noReinforce, "unexplained"); // this reading and the engine's disagree: reported, not hidden
}

// ---------------------------------------------------------------- sums
// Sums and counts only. Means, shares and intervals are the report's; chunks are merged by adding.
const bump = (obj, key, by = 1) => { obj[key] = (obj[key] ?? 0) + by; };
const slot = (obj, key, make) => (obj[key] ??= make());
export function summarize(list) {
  const s = {
    games: 0, wins: [0, 0], reasons: {}, endTurns: {}, sealsBefore4: 0,
    mandateByTurn: {}, isolatedByTurn: {}, supportByTurn: {}, firstIsolated: {}, capitalMoved: [{}, {}],
  };
  for (const { st, rec } of list) {
    s.games += 1;
    s.wins[st.winner] += 1;
    bump(s.reasons, st.reason);
    bump(s.endTurns, st.turn);
    if (st.reason === "alliance" && st.turn < 4) s.sealsBefore4 += 1;
    for (const end of rec.turnEnds) {
      const m = slot(s.mandateByTurn, end.turn, () => ({ n: 0, sum: 0 }));
      m.n += 1; m.sum += end.mandate;
      const iso = slot(s.isolatedByTurn, end.turn, () => ({ n: 0, sum: 0 }));
      iso.n += 1; iso.sum += end.isolated.length;
      const sup = slot(s.supportByTurn, end.turn, () => ({ n: 0, su: {}, us: {} }));
      sup.n += 1; bump(sup.su, end.support[CCP]); bump(sup.us, end.support[KMT]);
    }
    for (const city of Object.keys(rec.firstIsolated)) bump(slot(s.firstIsolated, city, () => ({})), rec.firstIsolated[city]);
    for (const side of [CCP, KMT]) {
      const t = rec.capitalMoved[side];
      if (t !== undefined && t !== null) bump(s.capitalMoved[side], t);
    }
  }
  return s;
}

// #23 round four (tests/targets.mjs item 10): each side's wins by end reason and by the turn the game
// ended, `[{ reasons, turns }, …]` by seat. Kept out of `summarize`, whose shape tests/sim.test.js pins
// key for key; the chunks add it to the sums they hand back (`runChunk`), so every state file has it.
export function winsBySide(list) {
  const w = [{ reasons: {}, turns: {} }, { reasons: {}, turns: {} }];
  for (const { st } of list) { bump(w[st.winner].reasons, st.reason); bump(w[st.winner].turns, st.turn); }
  return w;
}

// #23 round five (tests/targets.mjs item 1, read over all games): for each turn t = 1..8, who is ahead at
// the end of turn t -- a game that ended at turn t or before counts for its winner, a game still running
// for the side its mandate at that turn's end leans to (below 0 the Nationalists, above 0 the Communists,
// 0 a tie). Added to the chunks' sums by `runChunk`, as `winsBySide` is.
export function aheadByTurn(list) {
  const a = {};
  for (let t = 1; t <= 8; t++) a[t] = { ccp: 0, kmt: 0, tie: 0 };
  for (const { st, rec } of list) {
    const at = {};
    for (const e of rec.turnEnds) at[e.turn] = e.mandate;
    for (let t = 1; t <= 8; t++) {
      if (st.turn <= t) a[t][st.winner === CCP ? "ccp" : "kmt"] += 1;
      else if (at[t] < 0) a[t].kmt += 1;
      else if (at[t] > 0) a[t].ccp += 1;
      else a[t].tie += 1;
    }
  }
  return a;
}

// #27 (tuning/27/report.txt): mechanism B's numbers summed over games (`more` of each game), and per
// game: how many attacks on a city (`siegesPerGame`), the turn its first 孤城 appeared (`firstIsolatedGame`,
// at any moment; `firstIsolatedEnd`, at a turn's end; "none" if never), how many 孤城 at the end of turn 3
// (`isolatedAt3`, "ended" if the game ended before).
// Kept out of `summarize` (its shape is pinned): `runChunk` hands it back beside the sums, as `more`.
export function moreStats(list) {
  let m = { siegesPerGame: {}, firstIsolatedGame: {}, isolatedAt3: {} };
  for (const { rec, more } of list) {
    if (more) {
      const { games, d, e, ...rest } = more;
      // #36: E's sums, and per game: how many 印鈔 / 平抑 / 激進, the end's inflation and leftism (in `e.end`).
      if (e) {
        m.e = addSums(m.e, e);
        const per = (m.ePerGame ??= { print: {}, peg: {}, radical: {} });
        bump(per.print, e.print); bump(per.peg, e.peg); bump(per.radical, e.radical);
      }
      m = addSums(m, { ...rest, decided: games });
      bump(m.siegesPerGame, more.sieges);
      // #32: D's sums, and per game: the turn of the first 易幟 / 整編完成 ("none" if never), how many 整編 / 統戰.
      if (d) {
        const { firstMie, firstSeal, ...sums } = d;
        m.d = addSums(m.d, sums);
        const per = (m.dPerGame ??= { firstMie: {}, firstSeal: {}, integrate: {}, talks: {}, mie: {}, seal: {} });
        bump(per.firstMie, firstMie ?? "none"); bump(per.firstSeal, firstSeal ?? "none");
        bump(per.integrate, d.integrate); bump(per.talks, d.talks); bump(per.mie, d.mie.conquest + d.mie.talks); bump(per.seal, d.seal);
      }
    }
    const turns = Object.values(rec.firstIsolated);
    bump(m.firstIsolatedGame, turns.length ? Math.min(...turns) : "none");
    // The same question read at the turns' ends only (a city cut off for a moment and reconnected
    // within the turn never pays for it): the first turn that ends with a 孤城.
    const end = rec.turnEnds.find((e) => e.isolated.length > 0);
    bump(m.firstIsolatedEnd ??= {}, end ? end.turn : "none");
    const e3 = rec.turnEnds.find((e) => e.turn === 3);
    bump(m.isolatedAt3, e3 ? e3.isolated.length : "ended");
  }
  return m;
}

export function simulate({ games = 100, seed = 1, ccp = "normal", kmt = "normal", options = {} } = {}) {
  const list = [];
  for (let k = 0; k < games; k++) list.push(playGame(seed + k, { ccp, kmt, options }));
  return summarize(list);
}

// Two sums of the shape above (or of any nested numbers) added: objects key by key, arrays place by place.
function addSums(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  if (typeof a === "number" && typeof b === "number") return a + b;
  if (Array.isArray(a)) return a.map((x, i) => addSums(x, b[i]));
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = addSums(a[k], b[k]);
  return out;
}

// ---------------------------------------------------------------- a chunk (one child process)
// The games of seeds first .. first + count - 1 in one cell: their sums, and every game that threw
// (by seed) kept out of the sums and reported.
// #23: the variants, read from tuning/23/variants.mjs only when one is named.
async function variantOptions(name) {
  if (!name) return {};
  const { VARIANTS, searchVariant } = await import("../tuning/23/variants.mjs");
  const v = VARIANTS[name] || (searchVariant && searchVariant(name));
  if (!v) throw new Error(`unknown variant ${name}; the variants are ${Object.keys(VARIANTS).join(", ")}`);
  return v.options;
}
function runChunk({ cell, first, count, ccp, kmt, variant = {} }) {
  const t0 = Date.now(), list = [], errors = [];
  for (let seed = first; seed < first + count; seed++) {
    try { list.push(playGame(seed, { ccp, kmt, options: { ...variant, ...CELLS[cell] } })); }
    catch (e) { errors.push({ seed, message: String((e && e.message) || e).slice(0, 400) }); }
  }
  return { cell, first, count, sum: { ...summarize(list), winsBySide: winsBySide(list), aheadByTurn: aheadByTurn(list) }, more: moreStats(list), errors, ms: Date.now() - t0 };
}

// ---------------------------------------------------------------- command line
function parseArgs(argv) {
  const cfg = { games: 100, seed: 1, ccp: "normal", kmt: "normal", cell: "full", cells: false, jobs: 8, chunk: 10, out: null, resume: false, json: false, report: null, variant: null };
  for (const a of argv) {
    const [k, v] = a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, null];
    if (/^\d+$/.test(a)) cfg.games = Number(a);
    else if (k === "--cells") cfg.cells = true;
    else if (k === "--cell") cfg.cell = v;
    else if (k === "--seed") cfg.seed = Number(v);
    else if (k === "--jobs") cfg.jobs = Math.max(1, Number(v) || 1);
    else if (k === "--chunk") cfg.chunk = Math.max(1, Number(v) || 10);
    else if (k === "--ccp") cfg.ccp = v;
    else if (k === "--kmt") cfg.kmt = v;
    else if (k === "--out") cfg.out = v;
    else if (k === "--resume") cfg.resume = true;
    else if (k === "--json") cfg.json = true;
    else if (k === "--report") cfg.report = v;
    else if (k === "--variant") cfg.variant = v;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!cfg.cells && !(cfg.cell in CELLS)) throw new Error(`unknown cell ${cfg.cell}; the cells are ${Object.keys(CELLS).join(", ")}`);
  return cfg;
}

// SIM_NODE_FLAGS="--single-threaded-gc" node tests/sim.js … passes V8 flags to the children.
const NODE_FLAGS = (process.env.SIM_NODE_FLAGS || "").split(" ").filter(Boolean);
const SELF = fileURLToPath(import.meta.url);
function runChild(job, tries) {
  const args = [String(job.count), `--cell=${job.cell}`, `--seed=${job.first}`, `--ccp=${job.ccp}`, `--kmt=${job.kmt}`, ...(job.variant ? [`--variant=${job.variant}`] : []), "--json"];
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [...NODE_FLAGS, SELF, ...args], { stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.on("error", () => {});
    child.on("close", (code) => {
      if (code === 0) { try { return done(JSON.parse(out)); } catch { /* a torn line counts as a death */ } }
      console.error(`# ${new Date().toISOString()} child died (exit ${code}): ${args.join(" ")}${tries > 1 ? "; running it again" : ""}`);
      if (tries > 1) return done(runChild(job, tries - 1));
      fail(new Error(`child died (${code}): ${args.join(" ")}`));
    });
  });
}
// A chunk that dies every time is played one game at a time; a game that still kills Node twice is
// recorded as an error of that seed instead of ending the batch.
async function runOneByOne(job) {
  let total = { cell: job.cell, first: job.first, count: job.count, sum: summarize([]), errors: [], ms: 0 };
  for (let seed = job.first; seed < job.first + job.count; seed++) {
    let one;
    try { one = await runChild({ ...job, first: seed, count: 1 }, 2); }
    catch { one = { sum: summarize([]), errors: [{ seed, message: "the child process died twice on this game" }], ms: 0 }; }
    total = { ...total, sum: addSums(total.sum, one.sum), more: addSums(total.more, one.more), errors: total.errors.concat(one.errors), ms: total.ms + one.ms };
  }
  return total;
}

// The state file: what the batch is, and per cell the finished chunks ("first:count") and their sums.
function saveState(path, state) {
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(state));
  renameSync(tmp, path);
}
async function runCells(cfg) {
  // #23: --cells plays all five; --cell=X with --out only that one. A variant's name and its whole
  // options object go into the meta, so the state file says what it played.
  const names = cfg.cells ? Object.keys(CELLS) : [cfg.cell];
  const vopts = await variantOptions(cfg.variant);
  const meta = { games: cfg.games, seed: cfg.seed, ccp: cfg.ccp, kmt: cfg.kmt, cells: Object.fromEntries(names.map((n) => [n, CELLS[n]])) };
  if (cfg.variant) { meta.variant = cfg.variant; meta.variantOptions = vopts; }
  const statePath = cfg.out ? cfg.out + ".state.json" : null;
  let state = null;
  if (statePath && cfg.resume && existsSync(statePath)) {
    state = JSON.parse(readFileSync(statePath, "utf8"));
    const was = state.meta;
    if (was.seed !== meta.seed || was.ccp !== meta.ccp || was.kmt !== meta.kmt || JSON.stringify(was.cells) !== JSON.stringify(meta.cells)
      || (was.variant ?? null) !== (meta.variant ?? null) || JSON.stringify(was.variantOptions ?? null) !== JSON.stringify(meta.variantOptions ?? null)) {
      throw new Error(`--resume: ${statePath} is another batch (${JSON.stringify(was)}); start a new --out`);
    }
    state.meta.games = Math.max(was.games, meta.games); // a resume may ask for more games
  }
  if (!state) state = { meta, cells: {} };
  for (const name of names) state.cells[name] ??= { done: [], sum: summarize([]), errors: [], ms: 0 };

  // A chunk is skipped when every one of its seeds lies in a finished chunk, so a resume with another
  // --chunk never counts a game twice.
  const queue = [];
  for (const name of names) {
    const covered = new Set();
    for (const d of state.cells[name].done) { const [f, c] = d.split(":").map(Number); for (let k = 0; k < c; k++) covered.add(f + k); }
    for (let start = 0; start < cfg.games; start += cfg.chunk) {
      const first = cfg.seed + start, count = Math.min(cfg.chunk, cfg.games - start);
      const todo = [];
      for (let seed = first; seed < first + count; seed++) if (!covered.has(seed)) todo.push(seed);
      // Split a partly covered chunk into the runs of seeds still to play.
      for (let k = 0; k < todo.length;) {
        let j = k; while (j + 1 < todo.length && todo[j + 1] === todo[j] + 1) j++;
        queue.push({ cell: name, first: todo[k], count: j - k + 1, ccp: cfg.ccp, kmt: cfg.kmt, variant: cfg.variant });
        k = j + 1;
      }
    }
  }
  const total = queue.reduce((a, j) => a + j.count, 0);
  const note = (text) => { console.error(text); if (cfg.out) appendFileSync(cfg.out, text + "\n"); };
  note(`# ${new Date().toISOString()} ${queue.length} chunks, ${total} games to play (${cfg.games} per cell, seeds ${cfg.seed}..${cfg.seed + cfg.games - 1}, ${cfg.ccp} vs ${cfg.kmt}, ${cfg.jobs} jobs${cfg.variant ? `, variant ${cfg.variant}` : ""})`);
  if (statePath) saveState(statePath, state);
  let played = 0;
  const worker = async () => {
    while (queue.length) {
      const job = queue.shift();
      let r;
      try { r = await runChild(job, 3); } catch { r = await runOneByOne(job); }
      // Read the running sums only after the await: two workers must not overwrite each other.
      const c = state.cells[job.cell];
      c.sum = addSums(c.sum, r.sum); c.more = addSums(c.more, r.more); c.errors = c.errors.concat(r.errors); c.ms += r.ms;
      c.done.push(`${job.first}:${job.count}`);
      if (statePath) saveState(statePath, state);
      played += job.count;
      note(`# ${new Date().toISOString()} ${job.cell} seeds ${job.first}..${job.first + job.count - 1}: ${r.sum.games} played, ${r.errors.length} errors, ${(r.ms / 1000).toFixed(1)} s (${played}/${total})`);
    }
  };
  await Promise.all(Array.from({ length: cfg.jobs }, worker));
  note(`# ${new Date().toISOString()} done`);
  return state;
}

// ---------------------------------------------------------------- report
// Shares with a Wilson 95% interval, means with their n. The 「希望看到」 column is the owner's words,
// verbatim; the report does not say whether a number meets it.
const Z = 1.96;
function wilson(k, n) {
  if (!n) return [NaN, NaN];
  const p = k / n, d = 1 + (Z * Z) / n;
  const c = (p + (Z * Z) / (2 * n)) / d, h = (Z / d) * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n));
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
const pct = (x) => (100 * x).toFixed(1);
const rate = (k, n) => {
  if (!n) return "– (n=0)";
  const [lo, hi] = wilson(k, n);
  return `${pct(k / n)}% [${pct(lo)}, ${pct(hi)}] (${k}/${n})`;
};
const mean = (sum, n, digits = 2) => (n ? `${sum / n >= 0 ? "+" : ""}${(sum / n).toFixed(digits)} (n=${n})` : "– (n=0)");
const plain = (sum, n, digits = 2) => (n ? `${(sum / n).toFixed(digits)} (n=${n})` : "– (n=0)");
const numKeys = (...objs) => [...new Set(objs.flatMap((o) => Object.keys(o || {})))].map(Number).sort((a, b) => a - b);
const total = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
const median = (dist) => {
  const n = total(dist); if (!n) return null;
  let seen = 0;
  for (const t of numKeys(dist)) { seen += dist[t]; if (seen * 2 >= n) return t; }
  return null;
};

const WANT = {
  mandate: "前三回合偏國軍,第 5 回合前後交叉,之後偏共軍",
  win: "35% 到 65% 之間(還沒調過,先看有沒有離譜)",
  reasons: "沒有一種超過五成;整編在第 4 回合前結束的對局低於一成",
  unification: "佔共軍勝場的一到三成",
  firstIsolated: "多數在第 4 回合之後",
  isolated: "逐回合上升",
  capital: "陝北在第 4 回合前後;南京在第 8 回合或沒發生",
  support: "每局的走勢大致照腳本,但牌讓它有一格上下的差別",
};
const REASON_ZH = {
  mandate: "民心", alliance: "整編", unification: "易幟", emperor: "改革第 6 格", collapse: "崩潰(民生)",
  scoring: "記分卡", scoringBoth: "記分卡(雙方)", homeFall: "首都再陷", final: "終局記分", tie: "終局平手",
};
const cityName = (id) => (E.SPACE[id] ? `${E.SPACE[id].zh}` : id);

function report(state) {
  const names = Object.keys(CELLS).filter((n) => state.cells[n]);
  const S = Object.fromEntries(names.map((n) => [n, state.cells[n].sum]));
  const head = (first) => `| ${first} | ${names.join(" | ")} |\n|---|${names.map(() => "---").join("|")}|`;
  const row = (label, f) => `| ${label} | ${names.map((n) => f(S[n], n)).join(" | ")} |`;
  const out = [];
  const m = state.meta || {};
  out.push(`# 第一輪模擬`);
  out.push("");
  out.push(`${m.ccp || "normal"}(共軍)對 ${m.kmt || "normal"}(國軍),每個 cell 種子 ${m.seed}..${m.seed + m.games - 1}(五個 cell 打同一批種子)。`);
  if (m.variant) out.push(`\n變體 \`${m.variant}\`(cell 的開關疊在上面):\`${JSON.stringify(m.variantOptions)}\``);
  out.push(`比例後面是 Wilson 95% 區間與 (局數/分母);平均後面是 n。民心:正 = 偏共軍,負 = 偏國軍。「回合末」是引擎的 \`probe.turnEnd\`:在結算途中結束的那一回合沒有回合末,所以 n 會比局數少。`);
  out.push("");
  out.push(head("cell"));
  out.push(row("開關", (_, n) => (Object.keys(CELLS[n]).length ? "`" + JSON.stringify(CELLS[n]) + "`" : "全開")));
  out.push(row("打完的局數", (s, n) => `${s.games}` + (state.cells[n].errors.length ? `(另有 ${state.cells[n].errors.length} 局出錯)` : "")));
  out.push(row("每局秒數", (s, n) => { const k = s.games + state.cells[n].errors.length; return k ? (state.cells[n].ms / 1000 / k).toFixed(2) : "–"; }));
  out.push("");

  // 1
  out.push(`## 1. 每回合結束時的民心`);
  out.push(`> 希望看到(owner 原文):${WANT.mandate}`);
  out.push("");
  out.push(head("回合"));
  for (const t of numKeys(...names.map((n) => S[n].mandateByTurn))) out.push(row(`第 ${t} 回合末`, (s) => { const x = s.mandateByTurn[t]; return x ? mean(x.sum, x.n) : "– (n=0)"; }));
  out.push("");

  // 2
  out.push(`## 2. 共軍勝率`);
  out.push(`> 希望看到(owner 原文):${WANT.win}`);
  out.push("");
  out.push(head(""));
  out.push(row("共軍勝", (s) => rate(s.wins[CCP], s.games)));
  out.push(row("國軍勝", (s) => rate(s.wins[KMT], s.games)));
  out.push("");

  // 3
  out.push(`## 3. 結束方式`);
  out.push(`> 希望看到(owner 原文):${WANT.reasons}`);
  out.push("");
  out.push(head("結束方式"));
  const reasons = [...new Set([...Object.keys(REASON_ZH), ...names.flatMap((n) => Object.keys(S[n].reasons))])].filter((r) => names.some((n) => S[n].reasons[r]));
  for (const r of reasons) out.push(row(`${REASON_ZH[r] || r}(${r})`, (s) => rate(s.reasons[r] || 0, s.games)));
  out.push(row("整編,在第 4 回合前(第 1–3 回合)結束", (s) => rate(s.sealsBefore4, s.games)));
  out.push("");
  out.push(`結束的回合:`);
  out.push("");
  out.push(head("回合"));
  for (const t of numKeys(...names.map((n) => S[n].endTurns))) out.push(row(`第 ${t} 回合`, (s) => rate(s.endTurns[t] || 0, s.games)));
  out.push("");

  // 4
  out.push(`## 4. 易幟勝場`);
  out.push(`> 希望看到(owner 原文):${WANT.unification}`);
  out.push("");
  out.push(head(""));
  out.push(row("易幟 / 共軍勝場", (s) => rate(s.reasons.unification || 0, s.wins[CCP])));
  out.push("");

  // 5
  out.push(`## 5. 每座城第一次成為孤城的回合`);
  out.push(`> 希望看到(owner 原文):${WANT.firstIsolated}`);
  out.push("");
  out.push(`「第 0 回合」是免費放置階段。所有城合起來(一局裡一座城算一次),第一次成為孤城的回合:`);
  out.push("");
  const pooled = (s) => { const d = {}; for (const c of Object.values(s.firstIsolated)) for (const [t, k] of Object.entries(c)) bump(d, t, k); return d; };
  const P = Object.fromEntries(names.map((n) => [n, pooled(S[n])]));
  out.push(head("回合"));
  out.push(row("城次", (_, n) => `${total(P[n])}`));
  for (const t of numKeys(...names.map((n) => P[n]))) out.push(row(`第 ${t} 回合`, (_, n) => rate(P[n][t] || 0, total(P[n]))));
  out.push(row("第 5 回合以後", (_, n) => rate(numKeys(P[n]).filter((t) => t > 4).reduce((a, t) => a + P[n][t], 0), total(P[n]))));
  out.push("");
  out.push(`「第 4 回合之後」在這裡讀作第 5 回合以後(> 4);另一種讀法可以從上面逐回合的分佈直接加。`);
  out.push("");
  out.push(`每座城:成為孤城的局數 / 總局數;其中第 5 回合以後的比例;中位回合。`);
  out.push("");
  out.push(head("城"));
  const cities = E.SPACES.filter((sp) => sp.kind === "city").map((sp) => sp.id);
  for (const id of [...cities, ...new Set(names.flatMap((n) => Object.keys(S[n].firstIsolated)))].filter((id, i, a) => a.indexOf(id) === i)) {
    out.push(row(cityName(id), (s) => {
      const d = s.firstIsolated[id] || {}, k = total(d);
      if (!k) return `0/${s.games}`;
      const late = numKeys(d).filter((t) => t > 4).reduce((a, t) => a + d[t], 0);
      return `${k}/${s.games};第 5 回合以後 ${rate(late, k)};中位第 ${median(d)} 回合`;
    }));
  }
  out.push("");

  // 6
  out.push(`## 6. 每回合的孤城數`);
  out.push(`> 希望看到(owner 原文):${WANT.isolated}`);
  out.push("");
  out.push(head("回合"));
  for (const t of numKeys(...names.map((n) => S[n].isolatedByTurn))) out.push(row(`第 ${t} 回合末`, (s) => { const x = s.isolatedByTurn[t]; return x ? plain(x.sum, x.n) : "– (n=0)"; }));
  out.push("");

  // 7
  out.push(`## 7. 遷都發生的回合`);
  out.push(`> 希望看到(owner 原文):${WANT.capital}`);
  out.push("");
  for (const [side, label] of [[CCP, "陝北(共軍的首都)"], [KMT, "南京(國軍的首都)"]]) {
    out.push(`${label}:`);
    out.push("");
    out.push(head("回合"));
    for (const t of numKeys(...names.map((n) => S[n].capitalMoved[side]))) out.push(row(`第 ${t} 回合`, (s) => rate(s.capitalMoved[side][t] || 0, s.games)));
    out.push(row("沒發生", (s) => rate(s.games - total(s.capitalMoved[side]), s.games)));
    out.push("");
  }

  // 8
  out.push(`## 8. 兩條支持度軌`);
  out.push(`> 希望看到(owner 原文):${WANT.support}`);
  out.push("");
  for (const [key, label] of [["su", "蘇聯支持"], ["us", "美國支持"]]) {
    out.push(`${label}(回合末的格子;平均與每一格的比例):`);
    out.push("");
    out.push(head("回合"));
    for (const t of numKeys(...names.map((n) => S[n].supportByTurn))) {
      out.push(row(`第 ${t} 回合末 平均`, (s) => { const x = s.supportByTurn[t]; if (!x) return "– (n=0)"; let sum = 0; for (const [v, k] of Object.entries(x[key])) sum += Number(v) * k; return plain(sum, x.n); }));
      for (const v of numKeys(...names.map((n) => S[n].supportByTurn[t]?.[key]))) out.push(row(`  第 ${t} 回合末 = ${v}`, (s) => { const x = s.supportByTurn[t]; return x ? rate(x[key][v] || 0, x.n) : "– (n=0)"; }));
    }
    out.push("");
  }

  const errs = names.flatMap((n) => state.cells[n].errors.map((e) => `- ${n} 種子 ${e.seed}:${e.message}`));
  out.push(`## 出錯的對局`);
  out.push("");
  out.push(errs.length ? errs.join("\n") : "沒有。");
  return out.join("\n");
}

// ---------------------------------------------------------------- main
if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  const cfg = parseArgs(process.argv.slice(2));
  if (cfg.report) {
    console.log(report(JSON.parse(readFileSync(cfg.report, "utf8"))));
  } else if (cfg.cells || cfg.out) {
    const state = await runCells(cfg);
    if (!cfg.out) console.log(report(state));
    else console.error(`# the table: node tests/sim.js --report=${cfg.out}.state.json`);
  } else {
    const r = runChunk({ cell: cfg.cell, first: cfg.seed, count: cfg.games, ccp: cfg.ccp, kmt: cfg.kmt, variant: await variantOptions(cfg.variant) });
    if (cfg.json) console.log(JSON.stringify(r));
    else {
      const only = { meta: { games: cfg.games, seed: cfg.seed, ccp: cfg.ccp, kmt: cfg.kmt }, cells: { [cfg.cell]: { done: [], sum: r.sum, errors: r.errors, ms: r.ms } } };
      console.log(report(only));
    }
  }
}
