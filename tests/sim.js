// Bot-vs-bot harness. Plays whole games with both seats as bots, each seat
// deciding from its own view, and reports per rules cell how the games end.
// This is how the rulebook's open numbers get decided: by counts, not feel.
//
//   node tests/sim.js 200                       # normal vs normal, base rules
//   node tests/sim.js 200 seals=5 cap=3         # one cell
//   node tests/sim.js 200 qin=hard chu=normal   # levels
//   node tests/sim.js 200 --cells [--jobs=4]    # every cell in child processes, with retries
//   node tests/sim.js 1000 --only=nn/control,nn/ts --out=f.txt [--resume]   # resumable batch
//   node tests/sim.js --report=f.txt.state.json # markdown table with 95% intervals (#104)
//   node tests/sim.js 500 --only=d1/nn/new,d1/nn/new+D1 --out=f.txt --chunk=10 --resume; then --report-135=f.txt.state.json (#135)
//
// Cells run as child processes because Node 24 on the development machine
// dies with an access violation a few percent of the time on long runs.
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as E from "../public/shared/engine.js";
// SIM_BOTS=<path to a bots.js next to engine.js> plays another build of the bot
// against the same engine (#132: the base bot, kept as an untracked copy, while
// the fix is edited in place); the children inherit it.
const B = process.env.SIM_BOTS ? await import(pathToFileURL(resolve(process.env.SIM_BOTS)).href) : await import("../public/shared/bots.js");

// #104: every real place action is watched through `E.probe.place`, which the
// engine calls once per `placePoints` before the first point. The probe is on
// only around the game's own `E.apply` (never while a bot thinks), and the dry
// run `validateOps` makes first is skipped by its emptied log. Per action it
// records the spaces eligible at the start under both reach rules, measured
// here from influence and control, not from the engine's `canPlaceAt`:
//   chained  - a point outside today's start set (own influence, or control next door)
//   beyondTs - a point outside the TS start set (own influence here or next door)
// `probeMiss` counts games where the watched actions and the logged "place"
// entries disagree in number, or a logged entry is not the one a watched call
// produced (its log number), so a probe that stops seeing placements, or sees
// the dry run instead of the real one, shows up.
function startSets(st, side) {
  const ctl = new Set(), ts = new Set();
  for (const sp of E.SPACES) {
    const own = E.infOf(st, sp.id)[side] > 0;
    if (own || sp.adj.some((a) => E.controller(st, a) === side)) ctl.add(sp.id);
    if (own || sp.adj.some((a) => E.infOf(st, a)[side] > 0)) ts.add(sp.id);
  }
  return { ctl, ts };
}
export function playGame(seed, { qin = "normal", chu = "normal", options = {} } = {}) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, options);
  const scores = [];
  let seen = 0;
  const pl = { places: 0, placedPts: 0, chained: 0, chainedPts: 0, beyondTs: 0, beyondTsPts: 0, logged: 0, unmatched: 0 };
  const seqs = new Set(); // the log number each watched placement will get
  const watch = (s, side, points) => {
    if (!s.log.length) return;
    seqs.add((s.logSeq || 0) + 1);
    const { ctl, ts } = startSets(s, side);
    const outC = points.filter((id) => !ctl.has(id)).length, outT = points.filter((id) => !ts.has(id)).length;
    pl.places++; pl.placedPts += points.length;
    if (side === E.QIN) for (const id of points) { const k = D1_FAR[id]; if (k) d1["qPl" + k]++; }
    if (outC) { pl.chained++; pl.chainedPts += outC; }
    if (outT) { pl.beyondTs++; pl.beyondTsPts += outT; }
  };
  // #121: the reform track. Box 6 (稱帝) reach turn per side from the "reform"
  // log entries; every card play from the "play" entries, kept by log number
  // and re-read while still in the log, because an event-first enemy card
  // writes its real ops use back into its entry only when the ops are chosen.
  const rf = { reach6: [0, 0], advances: [0, 0] };
  const plays = new Map();
  // #130: 遊說 from the "lobby" entries (and, under lobby=realign*, one "realign"
  // entry per attempt), and the two home capitals through `E.probe.home`.
  const lc = Object.fromEntries(LC_ROW.map((k) => [k, 0]));
  const home = homeWatch(lc);
  // #135: 齊 / 燕 -- Chu's 相印 there, and what Qin does with a foothold there.
  const d1 = Object.fromEntries(D1_ROW.map((k) => [k, 0]));
  const d1Home = (s, where) => {
    home(s, where);
    if (where === "turnEnd") d1TurnEnd(d1, s);
    else { const n = Object.keys(s.seals).length; if (n > d1.sealsMax) d1.sealsMax = n; if (n >= 4 && !d1.seals4T) d1.seals4T = s.turn; }
  };
  // #132: a side's last action of a turn (round = rounds) with a scoring card it
  // may play: how often it keeps it, and how the game went right after.
  const kp = Object.fromEntries(KEEP_ROW.map((k) => [k, 0]));
  const keptIn = [0, 0]; // the turn of each side's last keep
  for (let steps = 0; st.winner == null; steps++) {
    if (steps > 6000) throw new Error(`seed ${seed}: no end after ${steps} actions`);
    const who = E.mustAct(st);
    const side = who[rng.int(who.length)];
    const a = B.decide(E.view(st, side), side, side === E.QIN ? qin : chu, rng);
    if (!a) throw new Error(`seed ${seed}: no action for ${side} at turn ${st.turn}`);
    const P = side === E.QIN ? "Q" : "C", last = lastHold(st, side);
    if (last) {
      kp["lastHold" + P]++;
      if (!(a.type === "play" && E.CARD[a.card]?.scoring)) {
        kp["keep" + P]++; keptIn[side] = st.turn;
        if (last.some((c) => !losesAtOnce(st, side, c))) kp["keepAvoid" + P]++;
        if (st.hands[1 - side].some((c) => E.CARD[c].scoring)) kp["keepFoeHeld" + P]++;
      }
    }
    E.probe.place = watch; E.probe.home = d1Home;
    try { st = E.apply(st, a); } finally { E.probe.place = null; E.probe.home = null; }
    for (const l of st.log) if (l.i > seen && l.type === "score") scores.push(l);
    for (const l of st.log) if (l.i > seen && l.type === "place") { pl.logged++; if (!seqs.has(l.i)) pl.unmatched++; }
    for (const l of st.log) {
      if (l.type === "play" && (l.i > seen || plays.has(l.i))) plays.set(l.i, { side: l.side, card: l.card, pair: l.pair, use: l.use });
      if (l.i > seen && l.type === "reform") { rf.advances[l.side]++; if (l.box === 6) rf.reach6[l.side] = l.t; }
      if (l.i > seen) { lobbyStats(lc, l); d1Stats(d1, l); }
    }
    seen = st.logSeq || seen;
  }
  // A keep is settled at that turn's end check, which may come an `apply` or
  // two later (the play can still ask a choice of either side).
  if (st.reason === "scoring" || st.reason === "scoringBoth") {
    for (const s of [E.QIN, E.CHU]) if (keptIn[s] === st.turn) kp[(st.winner === s ? "keepWon" : "keepLost") + (s === E.QIN ? "Q" : "C")]++;
  }
  const byUse = {};
  const reformUses = [0, 0];
  for (const p of plays.values()) {
    const ops = p.card === E.JIUDING ? 4 : E.CARD[p.pair || p.card].ops;
    const u = byUse[p.use] || (byUse[p.use] = { n: 0, ops: 0 });
    u.n++; u.ops += ops;
    if (p.use === "reform") reformUses[p.side]++;
  }
  const first6 = st.reformFirst[6] ?? -1;
  // Appended to the row in EMP_ROW order.
  const emp = [rf.reach6[0], rf.reach6[1], first6, st.reform[0], st.reform[1], reformUses[0], reformUses[1],
    rf.advances[0] + rf.advances[1] - reformUses[0] - reformUses[1],
    ...EMP_USES.flatMap((u) => [byUse[u]?.n || 0, byUse[u]?.ops || 0])];
  for (const [k, id] of [["Qi", "qi"], ["Yan", "yan"]]) {
    d1["sealEnd" + k] = st.seals[id] ? 1 : 0; d1["mie" + k] = st.mieVp[id] ? 1 : 0;
  }
  return { st, scores, pl, emp, lc: [...LC_ROW.map((k) => lc[k]), ...KEEP_ROW.map((k) => kp[k])], d1: D1_ROW.map((k) => d1[k]) };
}
// #132 per-game columns, appended after LC_ROW, by side (Q / C): the side's last
// action of a turn (round = rounds, its own action, nothing pending) with a
// scoring card among its legal plays; of those, the ones where it played
// something else (kept the card); of the keeps, the game ending at that turn's
// end check by 記分 / 記分2, lost or won by that side. Reads the state only (E.legal draws no
// random numbers), so a game plays out exactly as it did without the columns.
// Appended later: of the keeps, those where some playable scoring card would
// NOT have lost the game at once when played (on the true state: a scoring that
// hands the other side the win -- e.g. the Mandate over the line -- makes keeping
// the card and hoping the other side holds one too the better play), and those
// where the other side truly held a scoring card too.
export const KEEP_ROW = ["lastHoldQ", "lastHoldC", "keepQ", "keepC", "keepLostQ", "keepLostC", "keepWonQ", "keepWonC", "keepAvoidQ", "keepAvoidC", "keepFoeHeldQ", "keepFoeHeldC"];
// The scoring cards `side` may play at its last action of the turn, or null.
function lastHold(st, side) {
  if (st.phase !== "action" || st.pending || st.actor !== side || st.round !== st.rounds) return null;
  const L = E.legal(st, side);
  if (L.kind !== "action" || (L.bog && L.bog.length)) return null;
  const cards = L.cards.filter((c) => E.CARD[c.id]?.scoring).map((c) => c.id);
  return cards.length ? cards : null;
}
// Played as its event on the true state, the card ends the game for the other side.
function losesAtOnce(st, side, card) {
  try { return E.apply(st, { type: "play", side, card, use: "event" }).winner === 1 - side; } catch { return false; }
}
// #130 per-game columns, appended after EMP_ROW. Lobby: actions, ops, attempts
// (realign only), enemy points removed, own points lost, attempts the actor
// lost points in / won / tied (a lost attempt that cost nothing, because the
// actor had nothing there, counts as won by nobody: a tie), lobby actions on a
// battleground (要衝), lobby actions where the actor had no influence of its
// own in the target (nothing to lose), by side. Capitals, `g` = Qin's (關中, or
// where it moved), `y` = Chu's (郢 ...): times it became enemy-controlled at a
// marker check, turn of the first, falls retaken before that turn ended, turn
// ends it was held by the enemy, turn ends the enemy had more influence there
// than the owner, checks at which the enemy had more, the turn it moved (0 = never).
// Appended later (rows from earlier builds lack them; the report reads them as 0):
// 收手 -- 遊說 stopped by the actor, and whether the last roll before the stop
// was lost / won / tied (by the dice, whatever it cost); and per attempt the
// modifier difference d = actor's modifiers − the other side's, clamped to
// −5…+5: attempts, won, tied (by the dice).
export const MD = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
export const LC_ROW = ["lbN", "lbOps", "lbAtt", "lbRem", "lbLost", "lbAttLost", "lbAttWon", "lbAttTie", "lbBg", "lbNoRisk", "lbQ", "lbC",
  ...["g", "y"].flatMap((p) => ["Falls", "First", "Retaken", "HeldEnds", "MajEnds", "MajAny", "Moved"].map((k) => p + k)),
  "lbStop", "lbStopLost", "lbStopWon", "lbStopTie", "lbEv", "lbEvRem",
  ...MD.flatMap((d) => [`md${d}n`, `md${d}w`, `md${d}t`])];
function lobbyStats(lc, l) {
  // 縱橫家遊說 (youshui) logs its scripted 遊說 as a "lobby" entry too, with no
  // `edge` and no `mode`: it is an event, not the 遊說 use of ops. Counted apart
  // (lbEv) since the realign-own cells; the earlier cells' lb* include it.
  if (l.type === "lobby" && l.edge === undefined && !l.mode) { lc.lbEv++; lc.lbEvRem += l.removed || 0; return; }
  if (l.type === "lobby") {
    lc.lbN++; lc.lbOps += l.ops; lc.lbRem += l.removed || 0; lc.lbLost += l.lost || 0;
    if (E.SPACE[l.target].battleground) lc.lbBg++;
    if (l.own === 0) lc.lbNoRisk++;
    if (l.side === E.QIN) lc.lbQ++; else lc.lbC++;
  } else if (l.type === "realign") {
    lc.lbAtt++;
    if (l.lose == null || !l.n) lc.lbAttTie++;
    else if (l.lose === l.side) lc.lbAttLost++;
    else lc.lbAttWon++;
    const d = Math.max(-5, Math.min(5, l.mod[l.side] - l.mod[1 - l.side]));
    lc[`md${d}n`]++;
    if (l.lose === 1 - l.side) lc[`md${d}w`]++; else if (l.lose == null) lc[`md${d}t`]++;
    lc.$last = l.lose == null ? "Tie" : l.lose === l.side ? "Lost" : "Won";
  } else if (l.type === "lobbyStop") {
    lc.lbStop++; lc[`lbStop${lc.$last || "Tie"}`]++;
  } else if (l.type === "capitalMoves") lc[(l.whose === E.QIN ? "g" : "y") + "Moved"] = l.t;
}
const HOME = ["guanzhong", "ying"];
function homeWatch(lc) {
  const prev = [null, null], fellThisTurn = [0, 0];
  return (st, where) => {
    for (const owner of [E.QIN, E.CHU]) {
      const cap = (st.capital && st.capital[owner]) || HOME[owner], enemy = 1 - owner, p = owner === E.QIN ? "g" : "y";
      const held = E.controller(st, cap) === enemy;
      const o = E.infOf(st, cap)[owner], x = E.infOf(st, cap)[enemy];
      if (where === "check") {
        const was = prev[owner] && prev[owner].cap === cap && prev[owner].held;
        if (held && !was) { lc[p + "Falls"]++; if (!lc[p + "First"]) lc[p + "First"] = st.turn; fellThisTurn[owner] = st.turn; }
        if (!held && was && fellThisTurn[owner] === st.turn) { lc[p + "Retaken"]++; fellThisTurn[owner] = 0; }
        if (x > o) lc[p + "MajAny"]++;
        prev[owner] = { cap, held };
      } else {
        if (held) { lc[p + "HeldEnds"]++; fellThisTurn[owner] = 0; }
        if (x > o) lc[p + "MajEnds"]++;
      }
    }
  };
}
// #135 per-game columns, appended after LC_ROW + KEEP_ROW (rows from earlier
// builds lack them). 齊 = 臨淄 即墨 莒 薛, 燕 = 薊 遼東 (the states, from board.js).
// cSetLinzi: Chu's free setup points in 臨淄. sealT<Qi|Yan>: the turn Chu first
// took that 相印 (0 = never); sealEnd: held at the end; unseal: times Qin broke
// it (took the capital back); mie: Qin 滅 it at some point. At every turn end
// (`E.probe.home` "turnEnd"; teN of them): Qin's influence summed over the
// state (qQiTE / qYanTE) and in the capital (qLinziTE / qJiTE); turn ends with
// no Qin influence left in the capital (the foothold gone); turn ends Chu
// controls the capital. Qin's points placed in the state (from the placement
// probe, real placements only), its campaigns there, its 遊說 there (actions,
// ops, and per attempt from the "realign" entries -- or the whole 遊說 under
// today's rule -- Chu points removed and own points lost), and Chu's 遊說 there.
export const D1_ROW = ["cSetLinzi", "sealTQi", "sealTYan", "sealEndQi", "sealEndYan", "unsealQi", "unsealYan", "mieQi", "mieYan",
  "teN", "qQiTE", "qYanTE", "qLinziTE", "qJiTE", "qLinziZeroTE", "qJiZeroTE", "cLinziCtlTE", "cJiCtlTE",
  "qPlQi", "qPlYan", "qCpQi", "qCpYan", "qLbQi", "qLbYan", "qLbOpsQi", "qLbOpsYan", "qLbRemQi", "qLbRemYan", "qLbLostQi", "qLbLostYan",
  "cLbQi", "cLbYan",
  // Appended for the seals=5 cells (#135, owner: 「模擬合縱需要5個」): the most 相印 Chu held at once at any marker
  // check, and the turn it first held 4 at once (0 = never) -- the games the 4-seal rule would have ended there.
  "sealsMax", "seals4T"];
const D1_FAR = Object.fromEntries([...E.spacesOfState("qi").map((id) => [id, "Qi"]), ...E.spacesOfState("yan").map((id) => [id, "Yan"])]);
function d1TurnEnd(d, st) {
  d.teN++;
  for (const [id, k] of Object.entries(D1_FAR)) d["q" + k + "TE"] += E.infOf(st, id)[E.QIN];
  for (const [id, k] of [["linzi", "Linzi"], ["ji", "Ji"]]) {
    const q = E.infOf(st, id)[E.QIN];
    d["q" + k + "TE"] += q;
    if (!q) d["q" + k + "ZeroTE"]++;
    if (E.controller(st, id) === E.CHU) d["c" + k + "CtlTE"]++;
  }
}
function d1Stats(d, l) {
  const K = { qi: "Qi", yan: "Yan" };
  if (l.type === "setup" && l.side === E.CHU) d.cSetLinzi += (l.points || []).filter((id) => id === "linzi").length;
  else if (l.type === "seal" && K[l.state]) { if (!d["sealT" + K[l.state]]) d["sealT" + K[l.state]] = l.t; }
  else if (l.type === "unseal" && K[l.state]) d["unseal" + K[l.state]]++;
  const k = D1_FAR[l.target];
  if (!k) return;
  if (l.type === "campaign" && l.side === E.QIN) d["qCp" + k]++;
  else if (l.type === "lobby" && (l.edge !== undefined || l.mode)) { // the 遊說 use of ops, not 縱橫家遊說's event
    if (l.side === E.CHU) { d["cLb" + k]++; return; }
    d["qLb" + k]++; d["qLbOps" + k] += l.ops;
    if (!l.mode) d["qLbRem" + k] += l.removed || 0; // today's rule: the entry is the whole 遊說
  } else if (l.type === "realign" && l.side === E.QIN) {
    if (l.lose === E.CHU) d["qLbRem" + k] += l.n; else if (l.lose === E.QIN) d["qLbLost" + k] += l.n;
  }
}
// #121: per-game reform columns, appended after ROW. Reach turns are 0 when the
// side never reached box 6; first6 is -1 when nobody did. Ops are face values
// (九鼎 4; 說客's pair: the paired card's), both sides together.
export const EMP_USES = ["event", "place", "campaign", "lobby", "reform", "bog"];
export const EMP_ROW = ["q6turn", "c6turn", "first6", "qBox", "cBox", "qReformUses", "cReformUses", "eventAdvances",
  ...EMP_USES.flatMap((u) => [`n_${u}`, `ops_${u}`])];

export function simulate({ games = 100, seed = 1, qin = "normal", chu = "normal", options = {} } = {}) {
  const t0 = Date.now();
  const out = { games, qin, chu, options, qinWins: 0, ends: {}, turns: 0, mandate: 0, absMandate: 0, mie: 0, seals: 0, regions: {}, errors: [],
    places: 0, placedPts: 0, chained: 0, chainedPts: 0, beyondTs: 0, beyondTsPts: 0, probeMiss: 0, stuck: 0, rows: [] };
  for (let g = 0; g < games; g++) {
    let res;
    try { res = playGame(seed + g, { qin, chu, options }); } catch (e) {
      out.errors.push(`${seed + g}: ${e.message}`);
      if (/no end after|no action for/.test(e.message)) out.stuck++;
      continue;
    }
    const { st, scores, pl, emp, lc, d1 } = res;
    for (const k of ["places", "placedPts", "chained", "chainedPts", "beyondTs", "beyondTsPts"]) out[k] += pl[k];
    if (pl.logged !== pl.places || pl.unmatched) out.probeMiss++;
    if (st.winner === E.QIN) out.qinWins++;
    out.ends[st.reason] = (out.ends[st.reason] || 0) + 1;
    out.turns += st.turn; out.mandate += st.mandate; out.absMandate += Math.abs(st.mandate);
    out.mie += Object.keys(st.mieVp).length; out.seals += Object.keys(st.sealVp).length;
    // One row per game (ROW names the columns), so `--report` can give intervals,
    // distributions and the outlying seeds, not only the means.
    out.rows.push([seed + g, st.winner === E.QIN ? 1 : 0, st.reason, st.turn, st.mandate, Object.keys(st.mieVp).length, Object.keys(st.sealVp).length,
      pl.places, pl.placedPts, pl.chained, pl.chainedPts, pl.beyondTs, ...emp, ...lc, ...d1]);
    for (const l of scores) {
      const r = out.regions[l.region] || (out.regions[l.region] = { n: 0, net: 0, q: 0, c: 0 });
      r.n++; r.net += l.qin.total - l.chu.total; r.q += l.qin.total; r.c += l.chu.total;
    }
  }
  out.played = games - out.errors.length;
  out.ms = Date.now() - t0;
  return out;
}

const ENDS = ["unification", "alliance", "mandate", "collapse", "scoring", "scoringBoth", "final", "tie", "emperor", "homeFall"];
const SHORT = { unification: "一統", alliance: "合縱", mandate: "天命", collapse: "土崩", scoring: "記分", scoringBoth: "記分2", final: "終局", tie: "平手", emperor: "稱帝", homeFall: "國都" };
function line(name, r) {
  const n = r.played || 1;
  const ends = ENDS.filter((e) => r.ends[e]).map((e) => `${SHORT[e]} ${(100 * r.ends[e] / n).toFixed(0)}%`).join(" ");
  const regions = Object.entries(r.regions).map(([k, v]) => `${k} ${(v.n / n).toFixed(1)}x ${(v.q / v.n).toFixed(1)}:${(v.c / v.n).toFixed(1)}`).join(" ");
  return `${name.padEnd(22)} n=${r.played}  Qin ${(100 * r.qinWins / n).toFixed(0).padStart(3)}%  turn ${(r.turns / n).toFixed(1)}  mandate ${(r.mandate / n) >= 0 ? "+" : ""}${(r.mandate / n).toFixed(1)}  滅 ${(r.mie / n).toFixed(2)} 相印 ${(r.seals / n).toFixed(2)}  ${(r.ms / n / 1000).toFixed(1)}s/game${r.errors.length ? `  ERRORS ${r.errors.length}` : ""}\n${"".padEnd(22)} ${ends}\n${"".padEnd(22)} ${regions}`;
}

export const LC_CELLS = [
  ["base", {}],
  ["realign", { lobby: "realign" }],
  ["realign-mild", { lobby: "realign-mild" }],
  ["lose", { homeFall: "lose" }],
  ["lose-turn", { homeFall: "lose-turn" }],
  ["lose-majority", { homeFall: "lose-majority" }],
  ["move", { homeFall: "move" }],
  ["realign+lose-turn", { lobby: "realign", homeFall: "lose-turn" }],
  ["realign-own", { lobby: "realign-own" }],
  ["realign-own+lose-turn", { lobby: "realign-own", homeFall: "lose-turn" }],
];
export const CELLS = [
  ["base", {}],
  ["cap=3", { options: { cap: 3 } }],
  ["seals=5", { options: { seals: 5 } }],
  ["sealAt=cap", { options: { sealAt: "cap" } }],
  ["mie=2", { options: { mie: 2 } }],
  ["comp=0", { options: { comp: 0 } }],
  ["comp=4", { options: { comp: 4 } }],
  ["homeLock=3", { options: { homeLock: 3 } }],
  ["luoyi=0.5", { options: { luoyi: 0.5 } }],
  ["turns=9", { options: { turns: 9 } }],
  ["scoringSplit=v2", { options: { scoringSplit: "v2" } }],
  ["cap+comp0", { options: { sealAt: "cap", comp: 0 } }],
  ["cap+tieQin", { options: { sealAt: "cap", tie: "qin" } }],
  ["cap+seals5", { options: { sealAt: "cap", seals: 5 } }],
  ["cap+hangu3", { options: { sealAt: "cap", hangu: 3 } }],
  ["cap+hangu3+comp0", { options: { sealAt: "cap", hangu: 3, comp: 0 } }],
  ["hangu3", { options: { hangu: 3 } }],
  ["round1Rules", { options: { westBonus: false, yue: "lasting" } }],
  ["westBonus", { options: { westBonus: true, yue: "lasting" } }],
  ["noYue", { options: { westBonus: false, yue: "none" } }],
  ["westBonus+noYue", { options: { westBonus: true, yue: "none" } }],
  ["westBonus+comp1", { options: { westBonus: true, yue: "lasting", comp: 1 } }],
  ["cap+wuguo", { options: { sealAt: "cap", wuguo: "nonbg" } }],
  ["cap+hangu3+wuguo", { options: { sealAt: "cap", hangu: 3, wuguo: "nonbg" } }],
  ["s5+hangu3+wuguo", { options: { seals: 5, hangu: 3, wuguo: "nonbg" } }],
  ["cap+hangu3+wuguo+comp0", { options: { sealAt: "cap", hangu: 3, wuguo: "nonbg", comp: 0 } }],
  ["cap+hangu3+wuguo+comp1", { options: { sealAt: "cap", hangu: 3, wuguo: "nonbg", comp: 1 } }],
  ["qin=hard", { qin: "hard" }],
  ["chu=hard", { chu: "hard" }],
  ["qin=easy", { qin: "easy" }],
  ["chu=easy", { chu: "easy" }],
  // #104: placement reach, today's rule against Twilight Struggle 6.1 (option B).
  ["nn/control", { options: { reach: "control" } }],
  ["nn/ts", { options: { reach: "ts" } }],
  ["hh/control", { qin: "hard", chu: "hard", options: { reach: "control" } }],
  ["hh/ts", { qin: "hard", chu: "hard", options: { reach: "ts" } }],
  ["hqnc/control", { qin: "hard", chu: "normal", options: { reach: "control" } }],
  ["hqnc/ts", { qin: "hard", chu: "normal", options: { reach: "ts" } }],
  ["nqhc/control", { qin: "normal", chu: "hard", options: { reach: "control" } }],
  ["nqhc/ts", { qin: "normal", chu: "hard", options: { reach: "ts" } }],
  // #121: what reaching reform box 6 (稱帝) first is worth. emp/<lvl>/vp is today's rule.
  ...["nn", "hh"].flatMap((lv) => E.EMPEROR.map((v) => [`emp/${lv}/${v}`, { qin: lv === "nn" ? "normal" : "hard", chu: lv === "nn" ? "normal" : "hard", options: { emperor: v } }])),
  // #130: 遊說 as a realignment roll, and losing (or moving) the home capital.
  ...["nn", "hh"].flatMap((lv) => LC_CELLS.map(([v, options]) => [`lc/${lv}/${v}`, { qin: lv === "nn" ? "normal" : "hard", chu: lv === "nn" ? "normal" : "hard", options }])),
  // #132: today's rules, run once on the base build and once on the fix (two --out files).
  ["k132/nn", { qin: "normal", chu: "normal" }],
  ["k132/hh", { qin: "hard", chu: "hard" }],
  // #135: D1 (遠交) -- Qin starts with 1 in 臨淄 and 1 in 薊 -- under the new rules (realign-own + lose-turn) and today's.
  ...["nn", "hh"].flatMap((lv) => [["new", { lobby: "realign-own", homeFall: "lose-turn", qinFarStart: 0 }], ["new+D1", { lobby: "realign-own", homeFall: "lose-turn", qinFarStart: 1 }],
    ["today+D1", { qinFarStart: 1 }], ["today", { qinFarStart: 0 }]].map(([v, options]) => [`d1/${lv}/${v}`, { qin: lv === "nn" ? "normal" : "hard", chu: lv === "nn" ? "normal" : "hard", options }])),
  // #135, second ask: 相印 needed for 合縱 = 5 (all five capitals). The variants first, then their baselines on the same build.
  ...[["nn", "new+seals5"], ["nn", "today+seals5"], ["hh", "new+seals5"], ["hh", "today+seals5"], ["nn", "new"], ["nn", "today"], ["hh", "new"], ["hh", "today"]].map(([lv, v]) => [`s5/${lv}/${v}`, {
    qin: lv === "nn" ? "normal" : "hard", chu: lv === "nn" ? "normal" : "hard",
    options: { ...(v.startsWith("new") ? { lobby: "realign-own", homeFall: "lose-turn" } : {}), ...(v.endsWith("+seals5") ? { seals: 5 } : {}), qinFarStart: 0 } }]),
  // NB: since #133 the defaults ARE realign-own + lose-turn + seals 5, so on a build after 62b2380 the `today` cells
  // above (d1/, s5/) play the new rules; their recorded results were run before that (see tests/sim-results/135-*.md).
  // #135, third ask: 5 相印 + D1 on the new defaults. `def` = the defaults without D1, `def+D1` = { qinFarStart: 1 }.
  // #142 made qinFarStart 1 the default, so every cell above that names no qinFarStart now plays with the foothold;
  // the #135 cells without D1 name `qinFarStart: 0`, which is what they played when they were recorded.
  ...["nn", "hh"].flatMap((lv) => [["def", { qinFarStart: 0 }], ["def+D1", { qinFarStart: 1 }]].map(([v, options]) => [`def/${lv}/${v}`, { qin: lv === "nn" ? "normal" : "hard", chu: lv === "nn" ? "normal" : "hard", options }])),
];

function parseArgs(argv) {
  const cfg = { games: 100, seed: 1, qin: "normal", chu: "normal", options: {}, cells: false, only: null, json: false, jobs: 4 };
  for (const a of argv) {
    if (a === "--cells") cfg.cells = true;
    else if (a.startsWith("--only=")) { cfg.cells = true; cfg.only = a.slice(7).split(","); }
    else if (a === "--json") cfg.json = true;
    else if (a.startsWith("--out=")) cfg.out = a.slice(6);
    else if (a === "--resume") cfg.resume = true;
    else if (a.startsWith("--chunk=")) cfg.chunk = Math.max(1, Number(a.slice(8)) || 10);
    else if (a.startsWith("--jobs=")) cfg.jobs = Number(a.slice(7));
    else if (/^\d+$/.test(a)) cfg.games = Number(a);
    else if (a.includes("=")) {
      const [k, v] = a.split("=");
      if (k === "qin" || k === "chu") cfg[k] = v;
      else if (k === "seed") cfg.seed = Number(v);
      else cfg.options[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    }
  }
  return cfg;
}

// SIM_NODE_FLAGS="--single-threaded-gc" node tests/sim.js … passes V8 flags to the children.
const NODE_FLAGS = (process.env.SIM_NODE_FLAGS || "").split(" ").filter(Boolean);
function runChild(args, tries = 5) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...NODE_FLAGS, fileURLToPath(import.meta.url), ...args, "--json"], { stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.on("close", (code) => {
      if (code === 0) { try { return resolve(JSON.parse(out)); } catch (e) { /* fall through */ } }
      if (tries > 1) return resolve(runChild(args, tries - 1));
      reject(new Error(`child failed: ${args.join(" ")}`));
    });
  });
}

// A chunk that dies every time is replayed one game at a time; the games that
// still kill Node are recorded as errors instead of ending the batch.
async function runOneByOne(args) {
  const n = Number(args[0]), seed = Number(args.find((a) => a.startsWith("seed=")).slice(5));
  const rest = args.slice(1).filter((a) => !a.startsWith("seed="));
  let total = null;
  for (let i = 0; i < n; i++) {
    let one;
    try { one = await runChild(["1", `seed=${seed + i}`, ...rest], 2); }
    catch { one = { games: 1, played: 0, qinWins: 0, ends: {}, turns: 0, mandate: 0, absMandate: 0, mie: 0, seals: 0, regions: {}, errors: [`${seed + i}: child crashed`], ms: 0, ...Object.fromEntries(SUMS.map((k) => [k, 0])) }; }
    total = merge(total, one);
  }
  return total;
}

export const ROW = ["seed", "qinWin", "reason", "turn", "mandate", "mie", "seals", "places", "placedPts", "chained", "chainedPts", "beyondTs"];
const SUMS = ["places", "placedPts", "chained", "chainedPts", "beyondTs", "beyondTsPts", "probeMiss", "stuck"];
function merge(a, b) {
  if (!a) return b;
  const out = { ...a, rows: (a.rows || []).concat(b.rows || []),qinWins: a.qinWins + b.qinWins, turns: a.turns + b.turns, mandate: a.mandate + b.mandate, absMandate: a.absMandate + b.absMandate,
    mie: a.mie + b.mie, seals: a.seals + b.seals, played: a.played + b.played,
    ...Object.fromEntries(SUMS.map((k) => [k, (a[k] || 0) + (b[k] || 0)])), games: a.games + b.games, ms: a.ms + b.ms, errors: a.errors.concat(b.errors), ends: { ...a.ends }, regions: { ...a.regions } };
  for (const [k, v] of Object.entries(b.ends)) out.ends[k] = (out.ends[k] || 0) + v;
  for (const [k, v] of Object.entries(b.regions)) {
    const r = out.regions[k] ? { ...out.regions[k] } : { n: 0, net: 0, q: 0, c: 0 };
    r.n += v.n; r.net += v.net; r.q += v.q; r.c += v.c; out.regions[k] = r;
  }
  return out;
}

// Each cell runs as several short child processes (CHUNK games each, seeds
// in sequence), so a crash costs a couple of minutes and a retry, not the cell.
async function runCells(cfg) {
  const CHUNK = cfg.chunk || 10; // games per child process (`--chunk=5`)
  const cells = CELLS.filter(([name]) => !cfg.only || cfg.only.includes(name));
  const queue = [];
  for (const [name, cell] of cells) {
    for (let start = 0; start < cfg.games; start += CHUNK) {
      const n = Math.min(CHUNK, cfg.games - start);
      queue.push({ name, args: [String(n), `seed=${cfg.seed + start}`, `qin=${cell.qin || cfg.qin}`, `chu=${cell.chu || cfg.chu}`, ...Object.entries({ ...cfg.options, ...(cell.options || {}) }).map(([k, v]) => `${k}=${v}`)] });
    }
  }
  // With `--out`, the running totals are kept in `<out>.state.json` after every
  // chunk, and `--resume` picks up from it: the parent is Node too, and dies
  // at random like its children.
  const statePath = cfg.out ? cfg.out + ".state.json" : null;
  let state = {};
  if (statePath && cfg.resume && existsSync(statePath)) { try { state = JSON.parse(readFileSync(statePath, "utf8")); } catch { state = {}; } }
  const results = new Map(), pending = new Map(cells.map(([name]) => [name, Math.ceil(cfg.games / CHUNK)]));
  for (const [name] of cells) {
    const s0 = state[name];
    if (!s0) { state[name] = { done: [], result: null, printed: false }; continue; }
    results.set(name, s0.result);
    pending.set(name, pending.get(name) - s0.done.length);
  }
  // A chunk is done when every one of its seeds lies in a finished range, so a
  // batch can be resumed with a different chunk size without counting a game twice.
  const covered = (name) => {
    const seeds = new Set();
    for (const d of state[name].done) { const [s0, n0] = String(d).split(":").map(Number); for (let k = 0; k < (n0 || 10); k++) seeds.add(s0 + k); }
    return seeds;
  };
  const coveredBy = Object.fromEntries(cells.map(([name]) => [name, covered(name)]));
  for (let i = queue.length - 1; i >= 0; i--) {
    const start = Number(queue[i].args.find((a) => a.startsWith("seed=")).slice(5)), n = Number(queue[i].args[0]);
    let all = true;
    for (let k = 0; k < n; k++) if (!coveredBy[queue[i].name].has(start + k)) { all = false; break; }
    if (all) queue.splice(i, 1);
  }
  for (const [name] of cells) pending.set(name, queue.filter((q) => q.name === name).length);
  for (const q of queue) state[q.name].printed = false; // more games to add: print again when they are in
  const worker = async () => {
    while (queue.length) {
      const { name, args } = queue.shift();
      // Await first, read after: reading the running total before the await
      // lets two workers overwrite each other's chunks.
      let chunk;
      try { chunk = await runChild(args); } catch { chunk = await runOneByOne(args); }
      results.set(name, merge(results.get(name), chunk));
      pending.set(name, pending.get(name) - 1);
      state[name].done.push(`${args.find((a) => a.startsWith("seed=")).slice(5)}:${args[0]}`);
      state[name].result = results.get(name);
      if (statePath) writeFileSync(statePath, JSON.stringify(state));
      // `--out=file` keeps what is finished on disk: a long batch outlives the shell that started it.
      if (cfg.out) appendFileSync(cfg.out, `# ${new Date().toISOString()} ${name} ${results.get(name).played}/${cfg.games}\n`);
      if (pending.get(name) === 0 && !state[name].printed) {
        state[name].printed = true;
        if (statePath) writeFileSync(statePath, JSON.stringify(state));
        const text = line(name, results.get(name));
        console.log(text);
        if (cfg.out) appendFileSync(cfg.out, text + "\n");
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, cfg.jobs) }, worker));
  if (cfg.out) appendFileSync(cfg.out, "# done\n");
}

// ---------- report (#104) ----------
//   node tests/sim.js --report=a.state.json,b.state.json > table.md
// Reads the `--out` state files and prints a markdown table per cell with 95%
// intervals (Wilson for rates, normal for means), then, for every pair of
// cells named `<x>/control` and `<x>/ts`, the difference ts − control with its
// 95% interval; a difference whose interval leaves out 0 is marked **.
const Z = 1.96;
function wilson(k, n) {
  if (!n) return [NaN, NaN];
  const p = k / n, d = 1 + Z * Z / n, c = (p + Z * Z / (2 * n)) / d, h = (Z / d) * Math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n));
  return [c - h, c + h];
}
function meanCi(xs) {
  const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / (n || 1);
  const v = n > 1 ? xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1) : 0;
  return { m, v, n, h: Z * Math.sqrt(v / (n || 1)) };
}
function quant(xs, q) { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; }
const REASONS = ["mandate", "unification", "alliance", "collapse", "scoring", "scoringBoth", "final", "tie"];
const REASON_ZH = { mandate: "天命", unification: "滅國(一統)", alliance: "相印(合縱)", collapse: "土崩", scoring: "記分", scoringBoth: "記分2", final: "終局(回合上限)", tie: "平手" };
function cellStats(r) {
  const rows = (r.rows || []).map((x) => Object.fromEntries(ROW.map((k, i) => [k, x[i]])));
  const n = rows.length, col = (k) => rows.map((x) => x[k]);
  const places = col("places"), pts = col("placedPts");
  const perAction = rows.filter((x) => x.places).map((x) => x.placedPts / x.places);
  return {
    n, rows, errors: r.errors.length, stuck: r.stuck || 0, probeMiss: r.probeMiss || 0,
    win: { k: rows.filter((x) => x.qinWin).length },
    ends: Object.fromEntries(REASONS.map((e) => [e, rows.filter((x) => x.reason === e).length])),
    turn: meanCi(col("turn")), mandate: meanCi(col("mandate")), mie: meanCi(col("mie")), seals: meanCi(col("seals")),
    places: meanCi(places), ptsPerAction: { m: pts.reduce((a, b) => a + b, 0) / (places.reduce((a, b) => a + b, 0) || 1) },
    perGamePtsPerAction: meanCi(perAction),
    chainedShare: { k: rows.reduce((a, x) => a + x.chained, 0), n: places.reduce((a, b) => a + b, 0) },
    chainedPts: rows.reduce((a, x) => a + x.chainedPts, 0), totalPts: pts.reduce((a, b) => a + b, 0),
    beyondTs: rows.reduce((a, x) => a + x.beyondTs, 0),
    gamesWithChain: rows.filter((x) => x.chained > 0).length,
  };
}
const pc = (x) => (100 * x).toFixed(1);
const ci = (lo, hi) => `[${pc(lo)}, ${pc(hi)}]`;
const f2 = (x) => (x >= 0 ? "+" : "") + x.toFixed(2);
function report(files) {
  const cells = {};
  for (const f of files) {
    const st = JSON.parse(readFileSync(f, "utf8"));
    for (const [name, v] of Object.entries(st)) if (v.result) cells[name] = { ...cellStats(v.result), games: v.result.games, done: v.done.length, file: f };
  }
  const out = [];
  const names = CELLS.map(([n]) => n).filter((n) => cells[n]);
  out.push("| cell | n | Qin win % [95%] | errors / stuck | avg turn [95%] | avg final mandate [95%] | 滅 / game | 相印 / game | place actions / game | points / action | place actions with a point outside the control start set, % (under control: chaining) | points outside the TS start set |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const name of names) {
    const c = cells[name], [lo, hi] = wilson(c.win.k, c.n);
    out.push(`| ${name} | ${c.n} | ${pc(c.win.k / c.n)} ${ci(lo, hi)} | ${c.errors} / ${c.stuck} | ${c.turn.m.toFixed(2)} ±${c.turn.h.toFixed(2)} | ${f2(c.mandate.m)} ±${c.mandate.h.toFixed(2)} | ${c.mie.m.toFixed(2)} ±${c.mie.h.toFixed(2)} | ${c.seals.m.toFixed(2)} ±${c.seals.h.toFixed(2)} | ${c.places.m.toFixed(2)} ±${c.places.h.toFixed(2)} | ${c.ptsPerAction.m.toFixed(2)} | ${pc(c.chainedShare.k / (c.chainedShare.n || 1))} (${c.chainedShare.k}/${c.chainedShare.n}; ${c.gamesWithChain} games) | ${c.beyondTs} |`);
  }
  out.push("", "End reasons, % of games [Wilson 95%]:", "");
  out.push(`| cell | ${REASONS.map((e) => REASON_ZH[e]).join(" | ")} |`);
  out.push(`|---|${REASONS.map(() => "---").join("|")}|`);
  for (const name of names) {
    const c = cells[name];
    out.push(`| ${name} | ${REASONS.map((e) => { const [lo, hi] = wilson(c.ends[e], c.n); return c.ends[e] ? `${pc(c.ends[e] / c.n)} ${ci(lo, hi)}` : "0"; }).join(" | ")} |`);
  }
  out.push("", "Distributions (per game): end turn histogram; final mandate and place actions as min / p5 / p25 / median / p75 / p95 / max; the outlying seeds.", "");
  for (const name of names) {
    const c = cells[name];
    const turns = {}; for (const x of c.rows) turns[x.turn] = (turns[x.turn] || 0) + 1;
    const q = (k) => [0, 0.05, 0.25, 0.5, 0.75, 0.95, 1].map((p) => quant(c.rows.map((x) => x[k]), p)).join(" / ");
    const byMandate = c.rows.slice().sort((a, b) => a.mandate - b.mandate);
    const byPlaces = c.rows.slice().sort((a, b) => b.places - a.places);
    out.push(`- **${name}**: turn ${Object.entries(turns).map(([t, k]) => `${t}:${k}`).join(" ")}; mandate ${q("mandate")}; place actions ${q("places")}; ` +
      `lowest mandate seeds ${byMandate.slice(0, 3).map((x) => `${x.seed}(${x.mandate},${x.reason})`).join(" ")}, highest ${byMandate.slice(-3).map((x) => `${x.seed}(${x.mandate},${x.reason})`).join(" ")}; most place actions ${byPlaces.slice(0, 3).map((x) => `${x.seed}(${x.places})`).join(" ")}` +
      `${c.probeMiss ? `; PROBE MISSED IN ${c.probeMiss} GAMES` : ""}`);
  }
  const pairs = names.filter((n) => n.endsWith("/control") && cells[n.replace(/control$/, "ts")]);
  if (pairs.length) {
    out.push("", "Difference ts − control [95%]; ** = the interval leaves out 0:", "");
    out.push(`| pair | Qin win pp | turn | final mandate | 滅 | 相印 | place actions | points / action (per-game mean) | ${REASONS.map((e) => REASON_ZH[e] + " pp").join(" | ")} |`);
    out.push(`|---|---|---|---|---|---|---|---|${REASONS.map(() => "---").join("|")}|`);
    const dp = (k1, n1, k2, n2) => {
      const p1 = k1 / n1, p2 = k2 / n2, d = p2 - p1, h = Z * Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
      return `${d - h > 0 || d + h < 0 ? "**" : ""}${(100 * d >= 0 ? "+" : "") + (100 * d).toFixed(1)} [${(100 * (d - h)).toFixed(1)}, ${(100 * (d + h)).toFixed(1)}]${d - h > 0 || d + h < 0 ? "**" : ""}`;
    };
    const dm = (a, b) => {
      const d = b.m - a.m, h = Z * Math.sqrt(a.v / a.n + b.v / b.n);
      const sig = d - h > 0 || d + h < 0;
      return `${sig ? "**" : ""}${f2(d)} [${f2(d - h)}, ${f2(d + h)}]${sig ? "**" : ""}`;
    };
    for (const n of pairs) {
      const a = cells[n], b = cells[n.replace(/control$/, "ts")];
      out.push(`| ${n.replace(/\/control$/, "")} | ${dp(a.win.k, a.n, b.win.k, b.n)} | ${dm(a.turn, b.turn)} | ${dm(a.mandate, b.mandate)} | ${dm(a.mie, b.mie)} | ${dm(a.seals, b.seals)} | ${dm(a.places, b.places)} | ${dm(a.perGamePtsPerAction, b.perGamePtsPerAction)} | ${REASONS.map((e) => dp(a.ends[e], a.n, b.ends[e], b.n)).join(" | ")} |`);
    }
  }
  return out.join("\n");
}

// ---------- report (#121) ----------
//   node tests/sim.js --report-emperor=f.txt.state.json > table.md
// The reform track per `emp/<lvl>/<value>` cell, and every value against
// `emp/<lvl>/vp` (today's rule) on the same seeds; ** = the 95% interval of the
// difference leaves out 0.
const EMP_REASONS = ["emperor", "mandate", "unification", "alliance", "collapse", "scoring", "scoringBoth", "final", "tie"];
// A file given as `path@label` names its cells `<cell>@<label>` (the same cell
// run on another build, e.g. `@unaware-bot`); they are listed after the cell
// and compared with the plain `vp` of their level.
function reportEmperor(files) {
  const cells = {};
  for (const spec of files) {
    const [f, label] = spec.split("@");
    const st = JSON.parse(readFileSync(f, "utf8"));
    for (const [cell, v] of Object.entries(st)) {
      const name = label ? `${cell}@${label}` : cell;
      if (!v.result || !name.startsWith("emp/")) continue;
      const cols = [...ROW, ...EMP_ROW];
      const rows = v.result.rows.map((x) => Object.fromEntries(cols.map((k, i) => [k, x[i]])));
      for (const x of rows) {
        x.reached = x.first6 >= 0 ? 1 : 0;
        x.firstTurn = x.first6 === 0 ? x.q6turn : x.first6 === 1 ? x.c6turn : 0;
        x.firstWon = x.first6 < 0 ? null : (x.first6 === 0) === (x.qinWin === 1) ? 1 : 0;
        x.uses = x.qReformUses + x.cReformUses;
        const opsAll = EMP_USES.filter((u) => u !== "event" && u !== "bog").reduce((a, u) => a + x[`ops_${u}`], 0);
        x.reformShare = opsAll ? x.ops_reform / opsAll : 0;
      }
      cells[name] = { rows, n: rows.length, errors: v.result.errors.length, stuck: v.result.stuck || 0 };
    }
  }
  const order = CELLS.map(([n]) => n).flatMap((n) => Object.keys(cells).filter((k) => k === n || k.startsWith(n + "@")));
  const vpOf = (n) => n.split("@")[0].replace(/[^/]+$/, "vp");
  const out = [];
  const rate =(k, n) => { const [lo, hi] = wilson(k, n); return n ? `${pc(k / n)} ${ci(lo, hi)}` : "–"; };
  const cnt = (rows, f) => rows.filter(f).length;
  const mean = (rows, k) => meanCi(rows.map((x) => x[k]));
  const mci = (m) => `${m.m.toFixed(2)} ±${m.h.toFixed(2)}`;
  out.push("| cell | n | errors / stuck | Qin win % [95%] | avg end turn | box 6 reached by anyone, % [95%] | games that lasted to turn 7: box 6 reached, % (k/n) | by Qin % | by Chu % | first there: Qin / Chu | first-there side won, % [95%] (of games reached) |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows, n, errors, stuck } = cells[name];
    const reached = rows.filter((x) => x.reached);
    out.push(`| ${name} | ${n} | ${errors} / ${stuck} | ${rate(cnt(rows, (x) => x.qinWin), n)} | ${mci(mean(rows, "turn"))} | ${rate(reached.length, n)} | ${(() => { const late = rows.filter((x) => x.turn >= 7); const k = cnt(late, (x) => x.reached); return `${pc(k / (late.length || 1))} (${k}/${late.length})`; })()} | ${pc(cnt(rows, (x) => x.q6turn > 0) / n)} | ${pc(cnt(rows, (x) => x.c6turn > 0) / n)} | ${cnt(rows, (x) => x.first6 === 0)} / ${cnt(rows, (x) => x.first6 === 1)} | ${rate(cnt(reached, (x) => x.firstWon), reached.length)} (${cnt(reached, (x) => x.firstWon)}/${reached.length}) |`);
  }
  out.push("", "End reasons, % of games [Wilson 95%]:", "");
  out.push(`| cell | ${EMP_REASONS.map((e) => REASON_ZH[e] || "稱帝").join(" | ")} |`);
  out.push(`|---|${EMP_REASONS.map(() => "---").join("|")}|`);
  for (const name of order) {
    const { rows, n } = cells[name];
    out.push(`| ${name} | ${EMP_REASONS.map((e) => { const k = cnt(rows, (x) => x.reason === e); return k ? rate(k, n) : "0"; }).join(" | ")} |`);
  }
  out.push("", "Games in which box 6 was reached: how they ended, as first-there side won / lost, and the Mandate at the end from the first-there side's point of view (median; for a 稱帝 win it is the Mandate at that moment):", "");
  out.push(`| cell | games | ${EMP_REASONS.map((e) => REASON_ZH[e] || "稱帝").join(" | ")} | first-there's Mandate, median |`);
  out.push(`|---|---|${EMP_REASONS.map(() => "---").join("|")}|---|`);
  for (const name of order) {
    const reached = cells[name].rows.filter((x) => x.reached);
    const wl = (e) => { const r = reached.filter((x) => x.reason === e); return r.length ? `${cnt(r, (x) => x.firstWon)} / ${cnt(r, (x) => !x.firstWon)}` : "–"; };
    const own = reached.map((x) => (x.first6 === 0 ? x.mandate : -x.mandate));
    out.push(`| ${name} | ${reached.length} | ${EMP_REASONS.map(wl).join(" | ")} | ${own.length ? quant(own, 0.5) : "–"} |`);
  }
  out.push("", "Is it a reform race? Per game, both sides together [95%]; ops are face values; 'reform share' = ops discarded to reform ÷ ops spent on place + campaign + lobby + reform.", "");
  out.push("| cell | reform uses / game | Qin uses | Chu uses | advances by event | final box Qin | final box Chu | ops: place | ops: campaign | ops: lobby | ops: reform | reform share of ops, % |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows } = cells[name];
    out.push(`| ${name} | ${mci(mean(rows, "uses"))} | ${mean(rows, "qReformUses").m.toFixed(2)} | ${mean(rows, "cReformUses").m.toFixed(2)} | ${mean(rows, "eventAdvances").m.toFixed(2)} | ${mci(mean(rows, "qBox"))} | ${mci(mean(rows, "cBox"))} | ${mean(rows, "ops_place").m.toFixed(1)} | ${mean(rows, "ops_campaign").m.toFixed(1)} | ${mean(rows, "ops_lobby").m.toFixed(1)} | ${mci(mean(rows, "ops_reform"))} | ${pc(mean(rows, "reformShare").m)} |`);
  }
  out.push("", "Distributions: turn the first side reached box 6 (turn:games); final box per side (box:games, 0…6); end turn (turn:games); the highest reform-use games.", "");
  const hist = (xs) => { const h = {}; for (const x of xs) h[x] = (h[x] || 0) + 1; return Object.entries(h).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(" "); };
  for (const name of order) {
    const { rows } = cells[name];
    const top = rows.slice().sort((a, b) => b.uses - a.uses).slice(0, 3);
    out.push(`- **${name}**: first reach turn ${hist(rows.filter((x) => x.reached).map((x) => x.firstTurn)) || "none"}; final box Qin ${hist(rows.map((x) => x.qBox))}, Chu ${hist(rows.map((x) => x.cBox))}; end turn ${hist(rows.map((x) => x.turn))}; most reform uses ${top.map((x) => `seed ${x.seed} (${x.uses}, ${x.reason})`).join(", ")}`);
  }
  const pairs = order.filter((n) => n !== vpOf(n) && cells[vpOf(n)]);
  if (pairs.length) {
    out.push("", "Difference from `vp` at the same level [95%]; ** = the interval leaves out 0:", "");
    out.push("| cell − vp | Qin win pp | end turn | box 6 reached pp | first-there won pp | reform uses / game | reform share pp | 天命 end pp | 相印 end pp | 終局 end pp |");
    out.push("|---|---|---|---|---|---|---|---|---|---|");
    const star = (d, h, s) => (d - h > 0 || d + h < 0 ? `**${s}**` : s);
    const dp = (k1, n1, k2, n2) => {
      if (!n1 || !n2) return "–";
      const p1 = k1 / n1, p2 = k2 / n2, d = p2 - p1, h = Z * Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
      return star(d, h, `${(100 * d >= 0 ? "+" : "") + (100 * d).toFixed(1)} [${(100 * (d - h)).toFixed(1)}, ${(100 * (d + h)).toFixed(1)}]`);
    };
    const dm = (a, b, k, scale = 1) => {
      const A = meanCi(a.map((x) => x[k])), Bm = meanCi(b.map((x) => x[k]));
      const d = (Bm.m - A.m) * scale, h = Z * Math.sqrt(A.v / A.n + Bm.v / Bm.n) * scale;
      return star(d, h, `${f2(d)} [${f2(d - h)}, ${f2(d + h)}]`);
    };
    for (const name of pairs) {
      const a = cells[vpOf(name)].rows, b = cells[name].rows;
      const ra = a.filter((x) => x.reached), rb = b.filter((x) => x.reached);
      const e = (rows, r) => cnt(rows, (x) => x.reason === r);
      out.push(`| ${name} | ${dp(cnt(a, (x) => x.qinWin), a.length, cnt(b, (x) => x.qinWin), b.length)} | ${dm(a, b, "turn")} | ${dp(ra.length, a.length, rb.length, b.length)} | ${dp(cnt(ra, (x) => x.firstWon), ra.length, cnt(rb, (x) => x.firstWon), rb.length)} | ${dm(a, b, "uses")} | ${dm(a, b, "reformShare", 100)} | ${dp(e(a, "mandate"), a.length, e(b, "mandate"), b.length)} | ${dp(e(a, "alliance"), a.length, e(b, "alliance"), b.length)} | ${dp(e(a, "final"), a.length, e(b, "final"), b.length)} |`);
    }
  }
  return out.join("\n");
}

// ---------- report (#130) ----------
//   node tests/sim.js --report-130=a.state.json,b.state.json > table.md
// Every `lc/<lvl>/<value>` cell against `lc/<lvl>/base` on the same seeds;
// ** = the 95% interval of the difference leaves out 0. Cells not yet finished
// are reported with the games they have (n says how many).
const LC_REASONS = ["mandate", "unification", "alliance", "collapse", "scoring", "scoringBoth", "final", "tie", "emperor", "homeFall"];
const LC_ZH = { ...REASON_ZH, emperor: "稱帝", homeFall: "國都(homeFall)" };
export function report130(files) {
  const cells = {};
  const cols = [...ROW, ...EMP_ROW, ...LC_ROW];
  for (const f of files) {
    const st = JSON.parse(readFileSync(f, "utf8"));
    for (const [name, v] of Object.entries(st)) {
      if (!v.result || !name.startsWith("lc/")) continue;
      const rows = v.result.rows.map((x) => Object.fromEntries(cols.map((k, i) => [k, x[i]])));
      for (const x of rows) {
        x.opsAll = ["place", "campaign", "lobby", "reform"].reduce((a, u) => a + x[`ops_${u}`], 0);
        for (const u of ["place", "campaign", "lobby", "reform"]) x[`share_${u}`] = x.opsAll ? x[`ops_${u}`] / x.opsAll : 0;
        x.gAny = x.gFalls > 0 ? 1 : 0; x.yAny = x.yFalls > 0 ? 1 : 0;
        x.anyFall = x.gAny || x.yAny ? 1 : 0;
      }
      cells[name] = { rows, n: rows.length, errors: v.result.errors.length, stuck: v.result.stuck || 0, games: v.result.games };
    }
  }
  const order = CELLS.map(([n]) => n).filter((n) => cells[n]);
  const baseOf = (n) => n.replace(/[^/]+$/, "base");
  const out = [];
  const cnt = (rows, f) => rows.filter(f).length;
  const sum = (rows, k) => rows.reduce((a, x) => a + (x[k] || 0), 0);
  const rate = (k, n) => { const [lo, hi] = wilson(k, n); return n ? `${pc(k / n)} ${ci(lo, hi)}` : "–"; };
  const mci = (rows, k, d = 2) => { const m = meanCi(rows.map((x) => x[k] || 0)); return `${m.m.toFixed(d)} ±${m.h.toFixed(d)}`; };
  const star = (d, h, txt) => (d - h > 0 || d + h < 0 ? `**${txt}**` : txt);
  const dp = (k1, n1, k2, n2) => {
    if (!n1 || !n2) return "–";
    const p1 = k1 / n1, p2 = k2 / n2, d = p2 - p1, h = Z * Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
    return star(d, h, `${(100 * d >= 0 ? "+" : "") + (100 * d).toFixed(1)} [${(100 * (d - h)).toFixed(1)}, ${(100 * (d + h)).toFixed(1)}]`);
  };
  const dm = (a, b, k, scale = 1) => {
    const A = meanCi(a.map((x) => x[k])), Bm = meanCi(b.map((x) => x[k]));
    const d = (Bm.m - A.m) * scale, h = Z * Math.sqrt(A.v / A.n + Bm.v / Bm.n) * scale;
    return star(d, h, `${f2(d)} [${f2(d - h)}, ${f2(d + h)}]`);
  };
  out.push("| cell | n | errors / stuck | Qin win % [95%] | Qin win − base, pp [95%] | avg end turn [95%] | end turn − base |");
  out.push("|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows, n, errors, stuck } = cells[name], b = cells[baseOf(name)];
    const vs = b && name !== baseOf(name) ? dp(cnt(b.rows, (x) => x.qinWin), b.n, cnt(rows, (x) => x.qinWin), n) : "";
    const vt = b && name !== baseOf(name) ? dm(b.rows, rows, "turn") : "";
    out.push(`| ${name} | ${n} | ${errors} / ${stuck} | ${rate(cnt(rows, (x) => x.qinWin), n)} | ${vs} | ${mci(rows, "turn")} | ${vt} |`);
  }
  out.push("", "End reasons, % of games [Wilson 95%]; 國都 = the new end reason `homeFall`:", "");
  out.push(`| cell | ${LC_REASONS.map((e) => LC_ZH[e]).join(" | ")} |`);
  out.push(`|---|${LC_REASONS.map(() => "---").join("|")}|`);
  for (const name of order) {
    const { rows, n } = cells[name];
    out.push(`| ${name} | ${LC_REASONS.map((e) => { const k = cnt(rows, (x) => x.reason === e); return k ? rate(k, n) : "0"; }).join(" | ")} |`);
  }
  out.push("", "End reasons by winner: games won by Qin / by Chu for each reason.", "");
  out.push(`| cell | ${LC_REASONS.map((e) => LC_ZH[e]).join(" | ")} |`);
  out.push(`|---|${LC_REASONS.map(() => "---").join("|")}|`);
  for (const name of order) {
    const { rows } = cells[name];
    out.push(`| ${name} | ${LC_REASONS.map((e) => { const r = rows.filter((x) => x.reason === e); return r.length ? `${cnt(r, (x) => x.qinWin)} / ${cnt(r, (x) => !x.qinWin)}` : "–"; }).join(" | ")} |`);
  }
  out.push("", "國都 wins by side (Qin took 郢 / Chu took 關中), and the turn they came on (turn:games), per side:", "");
  out.push("| cell | Qin wins by 國都 | turns | Chu wins by 國都 | turns |");
  out.push("|---|---|---|---|---|");
  const hist = (xs) => { const h = {}; for (const x of xs) h[x] = (h[x] || 0) + 1; return Object.entries(h).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(" "); };
  for (const name of order) {
    const hf = cells[name].rows.filter((x) => x.reason === "homeFall");
    const q = hf.filter((x) => x.qinWin), c = hf.filter((x) => !x.qinWin);
    out.push(`| ${name} | ${q.length} | ${hist(q.map((x) => x.turn)) || "–"} | ${c.length} | ${hist(c.map((x) => x.turn)) || "–"} |`);
  }
  out.push("", "How the ops are spent, per game, both sides [95%]: share of the ops put to 扶植 (place) / 奇襲 (campaign) / 遊說 (lobby) / 變法 (reform); face values (九鼎 4). Uses per game, and the change in 奇襲 and 遊說 uses against base.", "");
  out.push("| cell | 扶植 % | 奇襲 % | 遊說 % | 變法 % | 奇襲 uses / game | 奇襲 − base | 遊說 uses / game | 遊說 − base |");
  out.push("|---|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows } = cells[name], b = cells[baseOf(name)], other = b && name !== baseOf(name);
    out.push(`| ${name} | ${pc(meanCi(rows.map((x) => x.share_place)).m)} | ${pc(meanCi(rows.map((x) => x.share_campaign)).m)} | ${pc(meanCi(rows.map((x) => x.share_lobby)).m)} | ${pc(meanCi(rows.map((x) => x.share_reform)).m)} | ${mci(rows, "n_campaign")} | ${other ? dm(b.rows, rows, "n_campaign") : ""} | ${mci(rows, "n_lobby")} | ${other ? dm(b.rows, rows, "n_lobby") : ""} |`);
  }
  out.push("", "遊說 in detail, all games of the cell pooled. Under base there are no attempts: one 遊說 removes min(ops, 局勢) and never costs the actor. 'net / attempt' = (enemy points removed − own points lost) ÷ attempts; 'actor lost' = attempts in which the actor lost at least one point; 'nothing to lose' = 遊說 aimed where the actor had no influence of its own. CAVEAT: in the cells run before realign-own (base … realign+lose-turn) the 遊說 counted here include the scripted 遊說 of the event 縱橫家遊說 (removes 2, no dice); from realign-own on it is counted apart ('event 遊說'). Uses per game in the table above come from the plays and never include it.", "");
  out.push("| cell | 遊說 actions | by Qin / Chu | ops / 遊說 | attempts / 遊說 | enemy removed / 遊說 | own lost / 遊說 | net / attempt | net / op | attempts: actor lost % | actor won % | no change % | at 要衝 % | nothing to lose % | event 遊說 (counted apart) |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows } = cells[name];
    const N = sum(rows, "lbN"), A = sum(rows, "lbAtt"), R = sum(rows, "lbRem"), L = sum(rows, "lbLost"), O = sum(rows, "lbOps");
    const d = (a, b, k = 2) => (b ? (a / b).toFixed(k) : "–");
    out.push(`| ${name} | ${N} | ${sum(rows, "lbQ")} / ${sum(rows, "lbC")} | ${d(O, N)} | ${d(A, N)} | ${d(R, N)} | ${d(L, N)} | ${A ? f2((R - L) / A) : "–"} | ${O ? f2((R - L) / O) : "–"} | ${A ? pc(sum(rows, "lbAttLost") / A) : "–"} | ${A ? pc(sum(rows, "lbAttWon") / A) : "–"} | ${A ? pc(sum(rows, "lbAttTie") / A) : "–"} | ${N ? pc(sum(rows, "lbBg") / N) : "–"} | ${N ? pc(sum(rows, "lbNoRisk") / N) : "–"} | ${sum(rows, "lbEv") || "(in the counts)"} |`);
  }
  out.push("", "The same with the event's scripted 遊說 taken out (the 遊說 use of ops only). Exact where it was counted apart; for the earlier cells estimated: event 遊說 ≈ lobby entries − 遊說 plays (a slight overestimate: an event that grants ops, 商旅通賈, also logs a 遊說 without a play; 0.12 a game in lc/nn/realign-own), each removing 1.97 (as measured in lc/nn/realign-own) for 2 ops.", "");
  out.push("| cell | event 遊說 / game | 遊說 (ops) | enemy removed / 遊說 | net / attempt | net / op |");
  out.push("|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows } = cells[name];
    const exactEv = rows.some((x) => x.lbEv !== undefined);
    const N = sum(rows, "lbN"), A = sum(rows, "lbAtt"), R = sum(rows, "lbRem"), L = sum(rows, "lbLost"), O = sum(rows, "lbOps");
    const evN = exactEv ? sum(rows, "lbEv") : Math.max(0, N - sum(rows, "n_lobby"));
    const n = exactEv ? N : N - evN, r = exactEv ? R : R - 1.97 * evN, o = exactEv ? O : O - 2 * evN, t = exactEv ? "" : "≈ ";
    out.push(`| ${name} | ${t}${(evN / rows.length).toFixed(2)} | ${t}${Math.round(n)} | ${t}${(r / n).toFixed(2)} | ${A ? t + f2((r - L) / A) : "–"} | ${t}${f2((r - L) / o)} |`);
  }
  out.push("", "收手 (realign-own only asks): 遊說 the actor stopped with attempts left, % of all 遊說, and the result of the roll just before the stop (by the dice: the actor lost it / won it / tied).", "");
  out.push("| cell | 遊說 | attempts / 遊說 | ops / 遊說 | stopped early, % of 遊說 | after a lost roll | after a won roll | after a tie |");
  out.push("|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows } = cells[name];
    const N = sum(rows, "lbN"), A = sum(rows, "lbAtt"), S = sum(rows, "lbStop");
    if (!A) continue;
    out.push(`| ${name} | ${N} | ${(A / N).toFixed(2)} | ${(sum(rows, "lbOps") / N).toFixed(2)} | ${pc(S / N)} (${S}) | ${sum(rows, "lbStopLost")} | ${sum(rows, "lbStopWon")} | ${sum(rows, "lbStopTie")} |`);
  }
  out.push("", "Per attempt: the modifier difference d = the actor's modifiers − the other side's (clamped to −5…+5), how often each occurs (% of attempts), and how the dice went (actor won / tie / actor lost, %). 'exact' is 1d6 against 1d6 at that d, for comparison. Cells whose rows predate this column show nothing.", "");
  const exact = (d, die = 6) => { let w = 0, t = 0; for (let a = 1; a <= die; a++) for (let b = 1; b <= die; b++) { const x = a + d - b; if (x > 0) w++; else if (x === 0) t++; } const n = die * die; return `${pc(w / n)} / ${pc(t / n)} / ${pc((n - w - t) / n)}`; };
  for (const name of order) {
    const { rows } = cells[name];
    const tot = MD.reduce((a, d) => a + sum(rows, `md${d}n`), 0);
    if (!tot) continue;
    out.push(`- **${name}** (${tot} attempts): ` + MD.filter((d) => sum(rows, `md${d}n`)).map((d) => {
      const n = sum(rows, `md${d}n`), w = sum(rows, `md${d}w`), t = sum(rows, `md${d}t`);
      return `d=${d >= 0 ? "+" : ""}${d}: ${pc(n / tot)}% (${n}), ${pc(w / n)} / ${pc(t / n)} / ${pc((n - w - t) / n)}${name.includes("mild") ? "" : ` [exact ${exact(d)}]`}`;
    }).join("; "));
  }
  out.push("", "The home capitals. 'fell' = became enemy-controlled at some marker check (the moment `lose` reads); games % [95%]. Falls / game; falls retaken before the end of the same turn (the grace `lose-turn` gives); games in which the enemy held it at a turn end (what `lose-turn` / `move` read) and had more influence there at a turn end (what `lose-majority` reads); the turn of the first fall (turn:games); capital moved (`move`), games.", "");
  out.push("| cell | 關中 fell (Chu took it), games % | 郢 fell (Qin took it), games % | falls / game | retaken in the turn / falls | held at a turn end: 關中 / 郢, games | enemy majority at a turn end: 關中 / 郢, games | enemy majority at any check: 關中 / 郢, games | first fall turn, 關中 | first fall turn, 郢 | moved: Qin / Chu, games |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows, n } = cells[name];
    const falls = sum(rows, "gFalls") + sum(rows, "yFalls");
    out.push(`| ${name} | ${rate(cnt(rows, (x) => x.gAny), n)} | ${rate(cnt(rows, (x) => x.yAny), n)} | ${(falls / (n || 1)).toFixed(3)} | ${sum(rows, "gRetaken") + sum(rows, "yRetaken")} / ${falls} | ${cnt(rows, (x) => x.gHeldEnds > 0)} / ${cnt(rows, (x) => x.yHeldEnds > 0)} | ${cnt(rows, (x) => x.gMajEnds > 0)} / ${cnt(rows, (x) => x.yMajEnds > 0)} | ${cnt(rows, (x) => x.gMajAny > 0)} / ${cnt(rows, (x) => x.yMajAny > 0)} | ${hist(rows.filter((x) => x.gFirst).map((x) => x.gFirst)) || "–"} | ${hist(rows.filter((x) => x.yFirst).map((x) => x.yFirst)) || "–"} | ${cnt(rows, (x) => x.gMoved > 0)} / ${cnt(rows, (x) => x.yMoved > 0)} |`);
  }
  out.push("", "Distributions per cell: end turn (turn:games); final Mandate min / p5 / p25 / median / p75 / p95 / max; 遊說 actions per game (count:games); the seeds with the most 遊說 and the seeds of the 國都 ends.", "");
  for (const name of order) {
    const { rows } = cells[name];
    const q = (k) => [0, 0.05, 0.25, 0.5, 0.75, 0.95, 1].map((p) => quant(rows.map((x) => x[k]), p)).join(" / ");
    const top = rows.slice().sort((a, b) => b.lbN - a.lbN).slice(0, 3);
    const hf = rows.filter((x) => x.reason === "homeFall").map((x) => x.seed);
    out.push(`- **${name}**: end turn ${hist(rows.map((x) => x.turn))}; mandate ${q("mandate")}; 遊說/game ${hist(rows.map((x) => x.lbN))}; most 遊說 ${top.map((x) => `seed ${x.seed} (${x.lbN}, ${x.reason})`).join(", ")}; 國都 seeds ${hf.length ? hf.slice(0, 12).join(" ") + (hf.length > 12 ? " …" : "") : "none"}`);
  }
  return out.join("\n");
}

// ---------- report (#132) ----------
//   node tests/sim.js --report-132=base.state.json@base,fix.state.json@fix > table.md
// The `k132/<lvl>` cells of each file, named `<cell>@<label>`; every label is
// compared with the first file's label at the same level, seed for seed.
export function report132(files) {
  const cols = [...ROW, ...EMP_ROW, ...LC_ROW, ...KEEP_ROW];
  const cells = {}, labels = [];
  for (const spec of files) {
    const [f, label] = spec.split("@");
    labels.push(label);
    const st = JSON.parse(readFileSync(f, "utf8"));
    for (const [cell, v] of Object.entries(st)) {
      if (!v.result || !cell.startsWith("k132/")) continue;
      const rows = v.result.rows.map((x) => Object.fromEntries(cols.map((k, i) => [k, x[i] ?? 0])));
      rows.sort((a, b) => a.seed - b.seed);
      cells[`${cell}@${label}`] = { rows, n: rows.length, errors: v.result.errors.length, stuck: v.result.stuck || 0, games: v.result.games };
    }
  }
  const order = ["k132/nn", "k132/hh"].flatMap((c) => labels.map((l) => `${c}@${l}`)).filter((n) => cells[n]);
  const baseOf = (n) => `${n.split("@")[0]}@${labels[0]}`;
  const cnt = (rows, f) => rows.filter(f).length;
  const sum = (rows, k) => rows.reduce((a, x) => a + (x[k] || 0), 0);
  const rate = (k, n) => { const [lo, hi] = wilson(k, n); return n ? `${pc(k / n)} ${ci(lo, hi)}` : "–"; };
  const star = (d, h, txt) => (d - h > 0 || d + h < 0 ? `**${txt}**` : txt);
  const dp = (k1, n1, k2, n2) => {
    if (!n1 || !n2) return "–";
    const p1 = k1 / n1, p2 = k2 / n2, d = p2 - p1, h = Z * Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
    return star(d, h, `${(100 * d >= 0 ? "+" : "") + (100 * d).toFixed(1)} [${(100 * (d - h)).toFixed(1)}, ${(100 * (d + h)).toFixed(1)}]`);
  };
  const hist = (xs) => { const h = {}; for (const x of xs) h[x] = (h[x] || 0) + 1; return Object.entries(h).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(" "); };
  const out = [];
  out.push("| cell | n | errors / stuck | Qin win % [95%] | Qin win − base, pp [95%] | avg end turn [95%] |");
  out.push("|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows, n, errors, stuck } = cells[name], b = cells[baseOf(name)], other = b && name !== baseOf(name);
    const t = meanCi(rows.map((x) => x.turn));
    out.push(`| ${name} | ${n} | ${errors} / ${stuck} | ${rate(cnt(rows, (x) => x.qinWin), n)} | ${other ? dp(cnt(b.rows, (x) => x.qinWin), b.n, cnt(rows, (x) => x.qinWin), n) : ""} | ${t.m.toFixed(2)} ±${t.h.toFixed(2)} |`);
  }
  out.push("", "記分 endings by side: 記分 (one side held a scoring card at the turn end) won by Qin / by Chu, 記分2 (both held one: Chu wins), and Chu's 記分 losses as % of games against base.", "");
  out.push("| cell | 記分 won by Qin (Chu held) | 記分 won by Chu (Qin held) | 記分2 (Chu wins) | all 記分 ends, % [95%] | Chu's 記分 losses, % [95%] | − base, pp [95%] |");
  out.push("|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows, n } = cells[name], b = cells[baseOf(name)], other = b && name !== baseOf(name);
    const sq = (r) => cnt(r, (x) => x.reason === "scoring" && x.qinWin), sc = (r) => cnt(r, (x) => x.reason === "scoring" && !x.qinWin), s2 = (r) => cnt(r, (x) => x.reason === "scoringBoth");
    out.push(`| ${name} | ${sq(rows)} | ${sc(rows)} | ${s2(rows)} | ${rate(sq(rows) + sc(rows) + s2(rows), n)} | ${rate(sq(rows), n)} | ${other ? dp(sq(b.rows), b.n, sq(rows), n) : ""} |`);
  }
  out.push("", "A side's last action of a turn (round = rounds) with a scoring card among its legal plays: how often it played something else (kept the card), and how the game went right then. Per side, all games of the cell pooled.", "");
  out.push("'avoidable' = some playable scoring card would not have lost the game at once (on the true state); the rest are keeps where playing the card hands the other side the win there and then, and keeping it is the only chance (the other side holding one too). 'foe held' = the other side truly held a scoring card.", "");
  out.push("| cell | Qin: held / kept / avoidable | Qin kept → lost by 記分 | Chu: held / kept / avoidable | Chu kept, % of held [95%] | Chu avoidable keeps, % of held [95%] | foe held | kept → lost by 記分 | kept → won (記分2) | Chu avoidable keeps / game |");
  out.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows, n } = cells[name];
    const hq = sum(rows, "lastHoldQ"), kq = sum(rows, "keepQ"), hc = sum(rows, "lastHoldC"), kc = sum(rows, "keepC"), ac = sum(rows, "keepAvoidC");
    out.push(`| ${name} | ${hq} / ${kq} / ${sum(rows, "keepAvoidQ")} | ${sum(rows, "keepLostQ")} | ${hc} / ${kc} / ${ac} | ${rate(kc, hc)} | ${rate(ac, hc)} | ${sum(rows, "keepFoeHeldC")} | ${sum(rows, "keepLostC")} | ${sum(rows, "keepWonC")} | ${(ac / (n || 1)).toFixed(3)} |`);
  }
  out.push("", "End reasons, % of games [Wilson 95%], and won by Qin / by Chu:", "");
  out.push(`| cell | ${LC_REASONS.map((e) => LC_ZH[e]).join(" | ")} |`);
  out.push(`|---|${LC_REASONS.map(() => "---").join("|")}|`);
  for (const name of order) {
    const { rows, n } = cells[name];
    out.push(`| ${name} | ${LC_REASONS.map((e) => { const r = rows.filter((x) => x.reason === e); return r.length ? `${rate(r.length, n)} (${cnt(r, (x) => x.qinWin)} / ${cnt(r, (x) => !x.qinWin)})` : "0"; }).join(" | ")} |`);
  }
  out.push("", "Seed for seed against base (the same seeds; a game follows the base game until the first decision that differs): winner changed Qin → Chu / Chu → Qin; distributions: end turn (turn:games), Chu keeps per game (count:games), the seeds where Chu kept and lost by 記分.", "");
  for (const name of order) {
    const { rows } = cells[name], b = cells[baseOf(name)], other = b && name !== baseOf(name);
    let flips = "";
    if (other) {
      const bw = new Map(b.rows.map((x) => [x.seed, x.qinWin]));
      const both = rows.filter((x) => bw.has(x.seed));
      flips = `; vs base on ${both.length} seeds: Qin → Chu ${cnt(both, (x) => bw.get(x.seed) === 1 && !x.qinWin)}, Chu → Qin ${cnt(both, (x) => bw.get(x.seed) === 0 && x.qinWin)}`;
    }
    const lost = rows.filter((x) => x.keepLostC > 0).map((x) => x.seed);
    out.push(`- **${name}**: end turn ${hist(rows.map((x) => x.turn))}; Chu keeps/game ${hist(rows.map((x) => x.keepC))}; kept-and-lost seeds ${lost.length ? lost.slice(0, 15).join(" ") + (lost.length > 15 ? ` … (${lost.length})` : "") : "none"}${flips}`);
  }
  return out.join("\n");
}

// ---------- report (#135) ----------
//   node tests/sim.js --report-135=f.txt.state.json > table.md
// The `d1/<lvl>/*` cells: Qin's win rate against the 50 ± 2.5 target, the end
// reasons, 齊 / 燕 (相印, 滅, Qin's foothold and what it does there), and the
// home capitals; every `X+D1` cell against `X` on the same seeds.
export function report135(files) {
  const cells = {};
  const cols = [...ROW, ...EMP_ROW, ...LC_ROW, ...KEEP_ROW, ...D1_ROW];
  for (const f of files) {
    const st = JSON.parse(readFileSync(f, "utf8"));
    for (const [name, v] of Object.entries(st)) {
      if (!v.result || !/^(d1|s5|def)\//.test(name)) continue;
      const rows = v.result.rows.map((x) => Object.fromEntries(cols.map((k, i) => [k, x[i] ?? 0])));
      cells[name] = { rows, n: rows.length, errors: v.result.errors.length, stuck: v.result.stuck || 0, games: v.result.games };
    }
  }
  const order = CELLS.map(([n]) => n).filter((n) => cells[n]);
  const baseOf = (n) => { const m = n.match(/^(.*)\+(D1|seals5)$/); return m ? m[1] : null; };
  const out = [];
  const cnt = (rows, f) => rows.filter(f).length;
  const sum = (rows, k) => rows.reduce((a, x) => a + (x[k] || 0), 0);
  const rate = (k, n) => { const [lo, hi] = wilson(k, n); return n ? `${pc(k / n)} ${ci(lo, hi)}` : "–"; };
  const star = (d, h, txt) => (d - h > 0 || d + h < 0 ? `**${txt}**` : txt);
  const dp = (k1, n1, k2, n2) => {
    if (!n1 || !n2) return "–";
    const p1 = k1 / n1, p2 = k2 / n2, d = p2 - p1, h = Z * Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
    return star(d, h, `${(100 * d >= 0 ? "+" : "") + (100 * d).toFixed(1)} [${(100 * (d - h)).toFixed(1)}, ${(100 * (d + h)).toFixed(1)}]`);
  };
  const mci = (xs, d = 2) => { const m = meanCi(xs); return `${m.m.toFixed(d)} ±${m.h.toFixed(d)}`; };
  const hist = (xs) => { const h = {}; for (const x of xs) h[x] = (h[x] || 0) + 1; return Object.entries(h).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(" "); };
  const win = (rows) => cnt(rows, (x) => x.qinWin);
  const band = (p) => (p >= 0.475 && p <= 0.525 ? "yes" : `no, ${p < 0.5 ? "" : "+"}${(100 * (p - 0.5)).toFixed(1)} pp from 50`);
  out.push("Qin win % against the target 50 ± 2.5 (47.5 … 52.5). 'in band' = the point estimate is inside; 'CI in band' = the whole 95 % interval is.", "");
  out.push("| cell | n | errors / stuck | Qin wins | Qin win % [95%] | in band | CI in band | − its base, pp [95%] | avg end turn [95%] | 終局 (turn limit) ends |");
  out.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows, n, errors, stuck } = cells[name], b = cells[baseOf(name)];
    const k = win(rows), [lo, hi] = wilson(k, n);
    out.push(`| ${name} | ${n} | ${errors} / ${stuck} | ${k} | ${rate(k, n)} | ${band(k / (n || 1))} | ${lo >= 0.475 && hi <= 0.525 ? "yes" : "no"} | ${b ? dp(win(b.rows), b.n, k, n) : ""} | ${mci(rows.map((x) => x.turn))} | ${cnt(rows, (x) => x.reason === "final")} (${cnt(rows, (x) => x.reason === "final" && x.qinWin)} / ${cnt(rows, (x) => x.reason === "final" && !x.qinWin)}) |`);
  }
  out.push("", "End reasons, % of games [Wilson 95%] (won by Qin / by Chu):", "");
  out.push(`| cell | ${LC_REASONS.map((e) => LC_ZH[e]).join(" | ")} |`);
  out.push(`|---|${LC_REASONS.map(() => "---").join("|")}|`);
  for (const name of order) {
    const { rows, n } = cells[name];
    out.push(`| ${name} | ${LC_REASONS.map((e) => { const r = rows.filter((x) => x.reason === e); return r.length ? `${rate(r.length, n)} (${cnt(r, (x) => x.qinWin)} / ${cnt(r, (x) => !x.qinWin)})` : "0"; }).join(" | ")} |`);
  }
  out.push("", "End reasons against the cell's base, pp [95%] (** = the interval leaves out 0):", "");
  out.push(`| cell | ${LC_REASONS.map((e) => LC_ZH[e]).join(" | ")} |`);
  out.push(`|---|${LC_REASONS.map(() => "---").join("|")}|`);
  for (const name of order) {
    const b = cells[baseOf(name)];
    if (!b) continue;
    const { rows, n } = cells[name];
    out.push(`| ${name} | ${LC_REASONS.map((e) => dp(cnt(b.rows, (x) => x.reason === e), b.n, cnt(rows, (x) => x.reason === e), n)).join(" | ")} |`);
  }
  out.push("", "齊 (臨淄) and 燕 (薊): games in which Chu took the 相印 at some point, held it at the end, times Qin broke it (took the capital back), games Qin 滅 the state; the turn Chu first took it (turn:games).", "");
  out.push("| cell | 齊 相印 taken, % [95%] | − base, pp | held at end | Qin broke it | 齊 滅 | 燕 相印 taken, % [95%] | − base, pp | held at end | Qin broke it | 燕 滅 | first taken, 齊 | first taken, 燕 |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows, n } = cells[name], b = cells[baseOf(name)];
    const part = (K) => {
      const k = cnt(rows, (x) => x["sealT" + K] > 0);
      return [rate(k, n), b ? dp(cnt(b.rows, (x) => x["sealT" + K] > 0), b.n, k, n) : "", `${cnt(rows, (x) => x["sealEnd" + K])}`, `${sum(rows, "unseal" + K)}`, `${cnt(rows, (x) => x["mie" + K])}`];
    };
    out.push(`| ${name} | ${part("Qi").join(" | ")} | ${part("Yan").join(" | ")} | ${hist(rows.filter((x) => x.sealTQi).map((x) => x.sealTQi)) || "–"} | ${hist(rows.filter((x) => x.sealTYan).map((x) => x.sealTYan)) || "–"} |`);
  }
  out.push("", "Qin's foothold at turn ends: Qin's influence in 臨淄 / 薊 and in the whole state (齊 = 臨淄 即墨 莒 薛, 燕 = 薊 遼東), mean [95%] over games of the per-game mean; the share of all turn ends with no Qin influence left in the capital, and with Chu in control of it.", "");
  out.push("| cell | turn ends | Qin in 臨淄 | Qin in 齊 | Qin gone from 臨淄, % | Chu controls 臨淄, % | Qin in 薊 | Qin in 燕 | Qin gone from 薊, % | Chu controls 薊, % |");
  out.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows } = cells[name], te = rows.filter((x) => x.teN > 0), T = sum(rows, "teN") || 1;
    const per = (k) => mci(te.map((x) => x[k] / x.teN));
    out.push(`| ${name} | ${sum(rows, "teN")} | ${per("qLinziTE")} | ${per("qQiTE")} | ${pc(sum(rows, "qLinziZeroTE") / T)} | ${pc(sum(rows, "cLinziCtlTE") / T)} | ${per("qJiTE")} | ${per("qYanTE")} | ${pc(sum(rows, "qJiZeroTE") / T)} | ${pc(sum(rows, "cJiCtlTE") / T)} |`);
  }
  out.push("", "What Qin does there, per game: points placed [95%], campaigns, 遊說 (actions / ops, and the games with any), Chu points removed / own points lost by its 遊說 there (per attempt, from the dice); Chu's 遊說 there (actions per game).", "");
  out.push("| cell | Qin places in 齊, pts | in 燕, pts | Qin campaigns 齊 / 燕 | Qin 遊說 齊: actions / ops (games) | removed / lost | Qin 遊說 燕: actions / ops (games) | removed / lost | Chu 遊說 齊 / 燕 |");
  out.push("|---|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows, n } = cells[name];
    const m = (k) => (sum(rows, k) / (n || 1)).toFixed(2);
    out.push(`| ${name} | ${mci(rows.map((x) => x.qPlQi))} | ${mci(rows.map((x) => x.qPlYan))} | ${m("qCpQi")} / ${m("qCpYan")} | ${m("qLbQi")} / ${m("qLbOpsQi")} (${cnt(rows, (x) => x.qLbQi > 0)}) | ${m("qLbRemQi")} / ${m("qLbLostQi")} | ${m("qLbYan")} / ${m("qLbOpsYan")} (${cnt(rows, (x) => x.qLbYan > 0)}) | ${m("qLbRemYan")} / ${m("qLbLostYan")} | ${m("cLbQi")} / ${m("cLbYan")} |`);
  }
  out.push("", "Home capitals (關中 = Qin's, 郢 = Chu's): games in which it fell (enemy control at a marker check) at least once, % [95%]; falls per game; turn ends it was held by the enemy; 國都 endings.", "");
  out.push("| cell | 關中 fell, % [95%] | − base, pp | 關中 falls / game | 關中 enemy-held turn ends | 郢 fell, % [95%] | − base, pp | 郢 falls / game | 郢 enemy-held turn ends | 國都 ends (Qin / Chu won) |");
  out.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const name of order) {
    const { rows, n } = cells[name], b = cells[baseOf(name)];
    const fell = (r, p) => cnt(r, (x) => x[p + "Falls"] > 0);
    const part = (p) => [rate(fell(rows, p), n), b ? dp(fell(b.rows, p), b.n, fell(rows, p), n) : "", (sum(rows, p + "Falls") / (n || 1)).toFixed(2), `${sum(rows, p + "HeldEnds")}`];
    const hf = rows.filter((x) => x.reason === "homeFall");
    out.push(`| ${name} | ${part("g").join(" | ")} | ${part("y").join(" | ")} | ${hf.length} (${cnt(hf, (x) => x.qinWin)} / ${cnt(hf, (x) => !x.qinWin)}) |`);
  }
  const s5 = order.filter((n) => /^(s5|def)\//.test(n));
  if (s5.length) {
    out.push("", "相印 held at once (the most at any marker check; games per count 0…5), and the games in which Chu held 4 at once (under seals 5 the game goes on), with how they ended (reason: Qin won / Chu won).", "");
    out.push("| cell | most 相印 held at once (count:games) | held 4 at once, games | … of which Chu won | … how they ended |");
    out.push("|---|---|---|---|---|");
    for (const name of s5) {
      const { rows } = cells[name], four = rows.filter((x) => x.seals4T > 0);
      const how = {}; for (const x of four) { const k = x.reason; how[k] = how[k] || [0, 0]; how[k][x.qinWin ? 0 : 1]++; }
      out.push(`| ${name} | ${hist(rows.map((x) => x.sealsMax))} | ${four.length} | ${cnt(four, (x) => !x.qinWin)} | ${Object.entries(how).map(([k, [q, c]]) => `${LC_ZH[k] || k} ${q}/${c}`).join(", ") || "–"} |`);
    }
    out.push("", "What replaces the 相印 wins: the base's 合縱 games (same seeds), and how each of them ended in the variant (reason: Qin won / Chu won).", "");
    out.push("| cell | base 合縱 games | … now ended by (reason: Qin / Chu) | … now won by Qin |");
    out.push("|---|---|---|---|");
    for (const name of s5) {
      const b = cells[baseOf(name)];
      if (!b) continue;
      const now = new Map(cells[name].rows.map((x) => [x.seed, x]));
      const was = b.rows.filter((x) => x.reason === "alliance" && now.has(x.seed));
      const how = {}; for (const w of was) { const x = now.get(w.seed); how[x.reason] = how[x.reason] || [0, 0]; how[x.reason][x.qinWin ? 0 : 1]++; }
      out.push(`| ${name} | ${was.length} | ${Object.entries(how).sort((a, c) => (c[1][0] + c[1][1]) - (a[1][0] + a[1][1])).map(([k, [q, c]]) => `${LC_ZH[k] || k} ${q}/${c}`).join(", ")} | ${was.filter((w) => now.get(w.seed).qinWin).length} |`);
    }
  }
  out.push("", "Chu's free setup points in 臨淄 (points:games), end turn (turn:games), and seed for seed against the base (the same seeds): winner changed Qin → Chu / Chu → Qin.", "");
  for (const name of order) {
    const { rows } = cells[name], b = cells[baseOf(name)];
    let flips = "";
    if (b) {
      const bw = new Map(b.rows.map((x) => [x.seed, x.qinWin]));
      const both = rows.filter((x) => bw.has(x.seed));
      flips = `; vs ${baseOf(name)} on ${both.length} seeds: Qin → Chu ${cnt(both, (x) => bw.get(x.seed) === 1 && !x.qinWin)}, Chu → Qin ${cnt(both, (x) => bw.get(x.seed) === 0 && x.qinWin)}`;
    }
    out.push(`- **${name}**: Chu setup in 臨淄 ${hist(rows.map((x) => x.cSetLinzi))}; end turn ${hist(rows.map((x) => x.turn))}${flips}`);
  }
  return out.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rep132 = process.argv.find((a) => a.startsWith("--report-132="));
  if (rep132) { console.log(report132(rep132.slice(13).split(","))); process.exit(0); }
  const rep = process.argv.find((a) => a.startsWith("--report="));
  if (rep) { console.log(report(rep.slice(9).split(","))); process.exit(0); }
  const repE = process.argv.find((a) => a.startsWith("--report-emperor="));
  if (repE) { console.log(reportEmperor(repE.slice(17).split(","))); process.exit(0); }
  const rep135 = process.argv.find((a) => a.startsWith("--report-135="));
  if (rep135) { console.log(report135(rep135.slice(13).split(","))); process.exit(0); }
  const rep130 = process.argv.find((a) => a.startsWith("--report-130="));
  if (rep130) { console.log(report130(rep130.slice(13).split(","))); process.exit(0); }
  const cfg = parseArgs(process.argv.slice(2));
  if (cfg.cells) await runCells(cfg);
  else {
    const r = simulate(cfg);
    if (cfg.json) console.log(JSON.stringify(r));
    else { console.log(line(`${cfg.qin} vs ${cfg.chu} ${JSON.stringify(cfg.options)}`, r)); for (const e of r.errors) console.log("  " + e); }
  }
}
