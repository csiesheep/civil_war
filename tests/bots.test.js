// The bots' guard (M2). Orchestrator's file: a peer may run it and falsify against it, and does not
// edit it (TEAM.md).
//
//   node --test tests/bots.test.js            about 150 bot games (BOTS_SCALE=0.25 for a quick look)
//
// What M2 asks of the bot (the owner's plan, 「bot(懂孤城、外援、不對稱回合)」): it plays this game, from
// a seat's view, and it knows the three things this game added to Zongheng's: supply, the aid cards,
// and that the two sides do not have the same number of action rounds.
//
// Three verdicts per check, as in the first guard. Everything here answers 尚未實作 while
// public/shared/bots.js still reads Zongheng's Nine Cauldrons (`JIUDING`): until then it is Zongheng's
// bot and cannot play. From the moment that name is gone, every check is judged.
//
// The games run in chunks of 10, each in its own process (tests/bots-chunk.js), and a chunk that dies
// without a result is run once more before it counts (this machine).
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { R, section, check, eq, ok, nonEmpty, summary } from "./harness.js";
import * as E from "../public/shared/engine.js";

const CCP = 0, KMT = 1;
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SCALE = Number(process.env.BOTS_SCALE || 1), games = (n) => Math.max(2, Math.round(n * SCALE));
const all = (...rs) => { let said = true; for (const r of rs) { if (r !== true && !(r && r.pass)) return r; if (r !== true) said = r; } return said; };
const pct = (k, n) => (n ? `${Math.round((100 * k) / n)}%` : "—");
const sideZh = (s) => (s === CCP ? "共軍" : "國軍");

const botsSource = readFileSync(here("../public/shared/bots.js"), "utf8");
const TODO = /\bJIUDING\b/.test(botsSource) ? "TODO: public/shared/bots.js 還在讀縱橫的九鼎(JIUDING):還是縱橫的 bot,不能在這個引擎上打" : null;
const B = TODO ? null : await import("../public/shared/bots.js");

// ---------------------------------------------------------------- the games
const CHUNK = 10;
function chunk(first, count, ccp, kmt) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = spawnSync(process.execPath, [here("./bots-chunk.js"), String(first), String(count), ccp, kmt], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const line = (r.stdout || "").split("\n").find((l) => l.startsWith("BOTS "));
    if (line) return { ...JSON.parse(line.slice(5)), attempt };
    if (attempt === 2) return { count, ended: 0, actions: 0, ms: 0, errors: [{ seed: first, message: `the chunk died twice without a result (exit ${r.status}): ${(r.stderr || "").slice(-300)}` }], reasons: {}, turns: {}, wins: [0, 0], pure: { asked: 0, differ: 0, mutated: 0 }, aid: { usable: [0, 0], used: [0, 0], usableStrong: 0, usedStrong: 0 }, turnEnd: {}, attempt };
  }
}
const cache = new Map();
// `n` games from seed `first`, 共軍 at level `ccp`, 國軍 at level `kmt`: the chunks added up. Run once per key.
function play(first, n, ccp, kmt) {
  const key = `${first}/${n}/${ccp}/${kmt}`;
  if (cache.has(key)) return cache.get(key);
  const t = { games: 0, ended: 0, actions: 0, ms: 0, errors: [], reasons: {}, turns: {}, wins: [0, 0], pure: { asked: 0, differ: 0, mutated: 0 }, aid: { usable: [0, 0], used: [0, 0], usableStrong: 0, usedStrong: 0 }, turnEnd: {}, rerun: 0 };
  for (let f = first; f < first + n; f += CHUNK) {
    const c = chunk(f, Math.min(CHUNK, first + n - f), ccp, kmt);
    t.games += c.count; t.ended += c.ended; t.actions += c.actions; t.ms += c.ms; t.errors.push(...c.errors);
    for (const k of ["reasons", "turns"]) for (const [id, v] of Object.entries(c[k])) t[k][id] = (t[k][id] || 0) + v;
    for (const s of [CCP, KMT]) { t.wins[s] += c.wins[s]; t.aid.usable[s] += c.aid.usable[s]; t.aid.used[s] += c.aid.used[s]; }
    t.aid.usableStrong += c.aid.usableStrong; t.aid.usedStrong += c.aid.usedStrong;
    for (const k of ["asked", "differ", "mutated"]) t.pure[k] += c.pure[k];
    for (const [turn, e] of Object.entries(c.turnEnd)) { const x = (t.turnEnd[turn] ||= { games: 0, mandate: 0, isolated: 0 }); x.games += e.games; x.mandate += e.mandate; x.isolated += e.isolated; }
    if (c.attempt > 1) t.rerun++;
  }
  cache.set(key, t);
  return t;
}
const clean = (t, what) => all(
  eq(t.errors.length, 0, `${what}:報錯或卡住的局數(第一個:${t.errors[0] ? `種子 ${t.errors[0].seed}: ${t.errors[0].message}` : "無"})`),
  eq(t.ended, t.games, `${what}:結束的局數`),
);
const NN = () => play(1, games(40), "normal", "normal");
const heldScoring = (t) => (t.reasons.scoring || 0) + (t.reasons.scoringBoth || 0);

// ---------------------------------------------------------------- positions
// The engine's own opening (the first guard checks it against the rulebook), with the free placements
// of turn 1 answered, at the headline phase of turn 1. Not a position of the rulebook: a rig.
function opening(options = {}) {
  let st = E.createGame(11, options);
  for (let guard = 0; st.pending && guard < 10; guard++) st = E.apply(st, { type: "choose", side: st.pending.who, choice: st.pending.options.slice(0, st.pending.n ?? 1) });
  if (st.pending || st.phase !== "headline") throw new Error(`opening: 期望停在第 1 回合的標題階段,實際 phase ${st.phase},pending ${st.pending && st.pending.kind}`);
  return E.clone(st);
}
// edits: { id: [red, blue] }
function board(edits, options) {
  const st = opening(options);
  for (const [id, rb] of Object.entries(edits)) { if (!E.SPACE[id]) throw new Error(`board: 沒有這個據點 ${id}`); st.inf[id] = rb.slice(); }
  return st;
}
// Put these cards in a hand, and nowhere else.
function deal(st, side, cards) {
  for (const pile of ["draw", "discard", "removed"]) st[pile] = st[pile].filter((c) => !cards.includes(c));
  st.hands[1 - side] = st.hands[1 - side].filter((c) => !cards.includes(c));
  st.hands[side] = cards.slice();
}
// A state in the action rounds of `turn`: both sides headline a scoring card (no event to resolve),
// then the round counter is set by hand to `round` with `actor` to move.
function atRound(turn, round, actor, hands) {
  let st = opening();
  if (turn > 1) {
    st.turn = turn - 1; st.round = 0; st.effects = []; st.era = E.eraOf(turn).id; st.draw = []; st.discard = []; st.later = {};
    st.headline = [null, null]; st.phase = "action"; st.pending = null; st.plan = [{ do: "startTurn" }];
  }
  deal(st, CCP, hands[CCP]); deal(st, KMT, hands[KMT]);
  if (turn > 1) st = E.run(st);
  if (st.pending || st.phase !== "headline" || st.turn !== turn) throw new Error(`atRound: 期望停在第 ${turn} 回合的標題階段,實際 turn ${st.turn},phase ${st.phase},pending ${st.pending && st.pending.kind}`);
  for (const side of [CCP, KMT]) st = E.apply(st, { type: "headline", side, card: st.hands[side].find((c) => E.CARD[c].scoring) });
  if (st.pending || st.phase !== "action") throw new Error(`atRound: 沒有走到行動回合(phase ${st.phase},pending ${st.pending && st.pending.kind})`);
  st = E.clone(st);
  st.round = round; st.actor = actor;
  return st;
}
// What the bot plays from this state, over `n` rng seeds: the cards, in order.
const cardsPlayed = (st, side, level, n) => Array.from({ length: n }, (_, i) => { const a = B.decide(E.view(st, side), side, level, E.makeRng(1000 + i)); return a && a.type === "play" ? a.card : JSON.stringify(a); });

// ================================================================ 1
section("B1 bot 打得完一局");

check("普通對普通:每一局都結束,引擎沒有拒絕過它的決定", () => {
  if (TODO) return TODO;
  const t = NN();
  const c = clean(t, "普通對普通"); if (c !== true) return c;
  return ok(true, `${t.games} 局都結束;共軍勝 ${t.wins[CCP]}、國軍勝 ${t.wins[KMT]};結束的方式 ${JSON.stringify(t.reasons)};結束的回合 ${JSON.stringify(t.turns)};每局平均 ${Math.round(t.actions / t.games)} 個決定、${(t.ms / t.games / 1000).toFixed(1)} 秒${t.rerun ? `;${t.rerun} 個區塊重跑過一次` : ""}`);
});

check("決定只看自己那一席的 view 和傳進來的 rng:同樣的輸入給同樣的決定,view 沒有被改", () => {
  if (TODO) return TODO;
  const t = NN();
  return all(nonEmpty(t.pure.asked, "抽查到的決定數"), eq(t.pure.differ, 0, "同一個 view、同一個 rng 問兩次,答案不同的次數"), eq(t.pure.mutated, 0, "問完之後 view 被改過的次數"),
    ok(true, `抽查 ${t.pure.asked} 個決定:兩次答案都相同,view 都沒有被改`));
});

check("簡單(隨機)與困難也打得完:各自對打", () => {
  if (TODO) return TODO;
  const e = play(2001, games(20), "easy", "easy"), h = play(3001, games(6), "hard", "hard");
  return all(clean(e, "簡單對簡單(隨機玩家吃 view)"), clean(h, "困難對困難"),
    ok(true, `簡單 ${e.games} 局、困難 ${h.games} 局都結束;困難每局平均 ${(h.ms / h.games / 1000).toFixed(1)} 秒`));
});

check("打得夠快,模擬跑得動:普通對普通每局平均不超過 20 秒", () => {
  if (TODO) return TODO;
  const t = NN(); const c = nonEmpty(t.ended, "結束的局數"); if (c !== true) return c;
  const s = t.ms / t.games / 1000;
  return ok(s <= 20, `普通對普通每局平均 ${s.toFixed(1)} 秒(上限 20;第一輪模擬要打幾千局)`);
});

check("普通贏得了隨機:兩邊各坐一次,普通那一方的勝率至少七成", () => {
  if (TODO) return TODO;
  const n = games(30), a = play(4001, n, "normal", "easy"), b = play(5001, n, "easy", "normal");
  const c = all(clean(a, "普通(共軍)對隨機"), clean(b, "隨機對普通(國軍)")); if (c !== true) return c;
  return all(ok(a.wins[CCP] >= 0.7 * a.games, `普通坐共軍:${a.wins[CCP]} / ${a.games} 勝(至少七成)`), ok(b.wins[KMT] >= 0.7 * b.games, `普通坐國軍:${b.wins[KMT]} / ${b.games} 勝(至少七成)`),
    ok(true, `普通坐共軍 ${a.wins[CCP]} / ${a.games}、坐國軍 ${b.wins[KMT]} / ${b.games}`));
});

// ================================================================ 2
section("B2 外援牌");

check("候選的行動裡有外援牌:第 1 回合國軍的第一個行動回合,美援是候選之一", () => {
  if (TODO) return TODO;
  const st = atRound(1, 1, KMT, [["score_north", "gao_shuxun", "shangdang_campaign"], ["score_east", "kunming_incident", "takeover_officials", "return_to_nanjing"]]);
  const L = E.legal(st, KMT), cands = B.scoreCandidates(E.view(st, KMT), KMT, E.makeRng(5));
  const aid = cands.filter((x) => x.a.card === "american_aid");
  return all(eq(!!(L.kind === "action" && L.aid), true, "引擎說國軍這時可以用美援"), nonEmpty(cands.length, "bot 列出的候選"),
    ok(aid.length > 0, aid.length ? `${cands.length} 個候選裡有 ${aid.length} 個是美援(${[...new Set(aid.map((x) => x.a.use))].join("、")})` : `${cands.length} 個候選裡沒有美援`));
});

check("對局裡真的用:美國支持 ≥ 3 的回合,國軍至少六成有打出美援;共軍的蘇援至少兩成", () => {
  if (TODO) return TODO;
  const t = NN(); const c = clean(t, "普通對普通"); if (c !== true) return c;
  const a = t.aid;
  return all(nonEmpty(a.usableStrong, "美國支持 ≥ 3 而且美援可用的回合數"), nonEmpty(a.usable[CCP], "蘇援可用的回合數"),
    ok(a.usedStrong >= 0.6 * a.usableStrong, `美援(美國支持 ≥ 3):可用 ${a.usableStrong} 個回合,打出 ${a.usedStrong}(${pct(a.usedStrong, a.usableStrong)},至少六成)`),
    ok(a.used[CCP] >= 0.2 * a.usable[CCP], `蘇援:可用 ${a.usable[CCP]} 個回合,打出 ${a.used[CCP]}(${pct(a.used[CCP], a.usable[CCP])},至少兩成)`),
    ok(true, `美援(支持 ≥ 3)${a.usedStrong} / ${a.usableStrong}(${pct(a.usedStrong, a.usableStrong)});美援全部 ${a.used[KMT]} / ${a.usable[KMT]};蘇援 ${a.used[CCP]} / ${a.usable[CCP]}(${pct(a.used[CCP], a.usable[CCP])})`));
});

// ================================================================ 3
section("B3 孤城");

// 濟南's two neighbours, 冀魯豫 and 魯中, both under Communist control: 濟南 (blue 2) is cut off.
// 太原's two, 太行 and 晉中, likewise: a second 孤城. The same board is valued with supply on and off:
// the option is the only difference, so the gap is what the bot thinks a 孤城 costs.
const CUT1 = { jiluyu: [3, 0], luzhong: [5, 2], jinan: [0, 2] };
const CUT2 = { ...CUT1, taihang: [4, 0], jinzhong: [4, 0], taiyuan: [0, 2] };
const gap = (edits, side) => B.evaluate(board(edits, { supply: true }), side) - B.evaluate(board(edits, { supply: false }), side);
const isolated = (edits) => E.isolatedCities(board(edits, { supply: true })).slice().sort().join(",");

check("評估:有孤城的盤面,supply 開著時對國軍比較差、對共軍比較好(同一個盤面,只差這個開關)", () => {
  if (TODO) return TODO;
  const pre = eq(isolated(CUT1), "jinan", "這個盤面的孤城"); if (pre !== true) return pre;
  const k = gap(CUT1, KMT), c = gap(CUT1, CCP);
  return all(ok(k < 0, `國軍的評估(supply 開 − 關):${k.toFixed(2)}(要小於 0)`), ok(c > 0, `共軍的評估(supply 開 − 關):${c.toFixed(2)}(要大於 0)`),
    ok(true, `濟南成孤城:國軍的評估 ${k.toFixed(2)}、共軍的評估 +${c.toFixed(2)}`));
});

check("評估的細目加得回總值;supply 關掉時孤城那兩項(isolatedAttrition、isolatedNoPlace)都不在,開著時兩項都算,而且開與關只差這兩項", () => {
  if (TODO) return TODO;
  // The gap between supply on and off (the check above) is blind to a term that stays when the
  // switch is off: both sides of the subtraction carry it. So the evaluation's own breakdown is read
  // (its third argument), after checking that the breakdown adds up to the value it returns.
  const pre = eq(isolated(CUT1), "jinan", "這個盤面的孤城"); if (pre !== true) return pre;
  const read = (supply, side) => { const terms = {}, v = B.evaluate(board(CUT1, { supply }), side, terms); return { v, terms, sum: Object.values(terms).reduce((a, b) => a + b, 0) }; };
  const on = read(true, KMT), off = read(false, KMT), con = read(true, CCP), coff = read(false, CCP);
  const iso = (r) => (r.terms.isolatedAttrition || 0) + (r.terms.isolatedNoPlace || 0);
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  return all(
    nonEmpty(Object.keys(on.terms).length, "評估回報的細目"),
    ok([on, off, con, coff].every((r) => close(r.sum, r.v)), `細目的和要等於評估值(國軍 開 ${on.sum.toFixed(4)} / ${on.v.toFixed(4)}、關 ${off.sum.toFixed(4)} / ${off.v.toFixed(4)};共軍 開 ${con.sum.toFixed(4)} / ${con.v.toFixed(4)}、關 ${coff.sum.toFixed(4)} / ${coff.v.toFixed(4)})`),
    eq(JSON.stringify([off.terms.isolatedAttrition || 0, off.terms.isolatedNoPlace || 0, coff.terms.isolatedAttrition || 0, coff.terms.isolatedNoPlace || 0]), "[0,0,0,0]", "supply 關掉時孤城兩項 [國軍的 a, b, 共軍的 a, b]"),
    ok(on.terms.isolatedAttrition < 0 && on.terms.isolatedNoPlace < 0, `supply 開著時國軍的孤城兩項都要是負的(掉點 ${on.terms.isolatedAttrition}、不能扶植 ${on.terms.isolatedNoPlace})`),
    ok(close(on.v - off.v, iso(on)) && close(con.v - coff.v, iso(con)), `開與關的差要正好是那兩項(國軍 差 ${(on.v - off.v).toFixed(4)}、兩項 ${iso(on).toFixed(4)};共軍 差 ${(con.v - coff.v).toFixed(4)}、兩項 ${iso(con).toFixed(4)})`),
    ok(true, `細目加得回總值;國軍 掉點 ${on.terms.isolatedAttrition.toFixed(2)}、不能扶植 ${on.terms.isolatedNoPlace.toFixed(2)},關掉時兩項都不在`),
  );
});

check("評估:兩座孤城比一座更差", () => {
  if (TODO) return TODO;
  const pre = all(eq(isolated(CUT1), "jinan", "一座的盤面"), eq(isolated(CUT2), "jinan,taiyuan", "兩座的盤面")); if (pre !== true) return pre;
  const k1 = gap(CUT1, KMT), k2 = gap(CUT2, KMT), c1 = gap(CUT1, CCP), c2 = gap(CUT2, CCP);
  return all(ok(k2 < k1, `國軍:兩座 ${k2.toFixed(2)},一座 ${k1.toFixed(2)}(兩座要更低)`), ok(c2 > c1, `共軍:兩座 ${c2.toFixed(2)},一座 ${c1.toFixed(2)}(兩座要更高)`),
    ok(true, `國軍 一座 ${k1.toFixed(2)} → 兩座 ${k2.toFixed(2)};共軍 一座 +${c1.toFixed(2)} → 兩座 +${c2.toFixed(2)}`));
});

check("評估:孤城裡的藍越多,國軍損失越大(藍 2 對藍 4;第 7 回合一次掉 2 也算得到)", () => {
  if (TODO) return TODO;
  const big = { ...CUT1, jinan: [0, 4] };
  const pre = all(eq(isolated(CUT1), "jinan", "藍 2 的盤面"), eq(isolated(big), "jinan", "藍 4 的盤面")); if (pre !== true) return pre;
  const k2 = gap(CUT1, KMT), k4 = gap(big, KMT);
  return ok(k4 <= k2 && k4 < 0, `國軍的評估(supply 開 − 關):孤城藍 2 是 ${k2.toFixed(2)},藍 4 是 ${k4.toFixed(2)}(藍 4 不可以比較輕)`);
});

// ================================================================ 4
section("B4 兩邊的行動回合數不一樣");

// Since P10 (#23, #24) 易勢期 gives the Communists 8 action rounds and the Nationalists 6, and 決戰期 6 and 7
// (接收期 is 7 and 7). A side that
// holds a scoring card when the turn is settled loses the game. So with as many scoring cards in hand
// as it has rounds left, a side must play one now, however tempting the other card: a bot that counts
// the rounds of the other side, or Zongheng's one number for both, plays the other card and loses.
const HEAD = { [CCP]: "score_north", [KMT]: "score_east" };
check("最後一個行動回合手上有記分卡:打記分卡(共軍第 7 回合的第 6 個;國軍第 4 回合的第 6 個)", () => {
  if (TODO) return TODO;
  const c = atRound(7, 6, CCP, [[HEAD[CCP], "score_northeast", "into_manchuria"], [HEAD[KMT], "kunming_incident", "takeover_officials"]]);
  const k = atRound(4, 6, KMT, [[HEAD[CCP], "gao_shuxun", "shangdang_campaign"], [HEAD[KMT], "score_rear", "airlift"]]);
  const pc = cardsPlayed(c, CCP, "normal", 10), pk = cardsPlayed(k, KMT, "normal", 10);
  return all(eq(E.eraOf(7).rounds[CCP], 6, "決戰期共軍的行動回合數(引擎)"), eq(E.eraOf(4).rounds[KMT], 6, "易勢期國軍的行動回合數(引擎)"),
    eq(pc.filter((x) => x === "score_northeast").length, 10, `共軍在第 6 個行動回合打記分卡的次數(10 個種子;實際打的:${[...new Set(pc)].join("、")})`),
    eq(pk.filter((x) => x === "score_rear").length, 10, `國軍在第 6 個行動回合打記分卡的次數(10 個種子;實際打的:${[...new Set(pk)].join("、")})`),
    ok(true, "兩邊各 10 個種子都打了記分卡"));
});

check("剩 2 個行動回合、手上 2 張記分卡:現在就要打記分卡(共軍第 7 回合的第 5 個;國軍第 4 回合的第 5 個)", () => {
  if (TODO) return TODO;
  const c = atRound(7, 5, CCP, [[HEAD[CCP], "score_northeast", "score_northwest", "into_manchuria"], [HEAD[KMT], "kunming_incident", "takeover_officials", "return_to_nanjing"]]);
  const k = atRound(4, 5, KMT, [[HEAD[CCP], "gao_shuxun", "shangdang_campaign", "land_law"], [HEAD[KMT], "score_rear", "score_northeast", "airlift"]]);
  const pc = cardsPlayed(c, CCP, "normal", 10), pk = cardsPlayed(k, KMT, "normal", 10);
  const sc = (xs) => xs.filter((x) => E.CARD[x] && E.CARD[x].scoring).length;
  return all(eq(sc(pc), 10, `共軍在第 5 個行動回合(還剩 2 個)打記分卡的次數(10 個種子;實際打的:${[...new Set(pc)].join("、")})`),
    eq(sc(pk), 10, `國軍在第 5 個行動回合(還剩 2 個)打記分卡的次數(10 個種子;實際打的:${[...new Set(pk)].join("、")})`),
    ok(true, "兩邊各 10 個種子都先打記分卡"));
});

check("打記分卡會當場輸、留著也會輸:還是打記分卡(留著記分卡的輸排在所有結果之後;orchestrator 裁決 #12)", () => {
  if (TODO) return TODO;
  // 民心 −14 on turn 7 (the Nationalists win at −15 from turn 6, P10) and the Communists' last round, holding
  // 後方's scoring card: playing it scores 後方 for the Nationalists and ends the game at once by 民心;
  // keeping it loses at the settle. Both lose.
  // Keeping the card is the loss the rules make certain, so it ranks last: with the two losses
  // valued alike the noise picks between them, and this check sees it.
  const c = atRound(7, 6, CCP, [[HEAD[CCP], "score_rear", "into_manchuria"], [HEAD[KMT], "kunming_incident", "takeover_officials"]]);
  c.mandate = -14;
  let played = null; try { played = E.apply(c, { type: "play", side: CCP, card: "score_rear", use: "event" }); } catch (e) { return `共軍打後方記分卡被拒絕:${e.message}`; }
  const pre = all(eq(played.winner, KMT, "打出後方記分卡之後的勝者(對照:當場輸)"), eq(played.reason, "mandate", "那一局結束的理由")); if (pre !== true) return pre;
  const pc = cardsPlayed(c, CCP, "normal", 10);
  return all(eq(pc.filter((x) => x === "score_rear").length, 10, `10 個種子裡打記分卡的次數(實際打的:${[...new Set(pc)].join("、")})`),
    ok(true, "打出去是民心 −15 當場輸,留著是結算時輸:10 個種子都打記分卡"));
});

check("對照:行動回合還夠的時候,不必現在打記分卡(共軍第 4 回合的第 6 個:它有 8 個)", () => {
  if (TODO) return TODO;
  // The same shape as the Communists' last round above, for the side that has one more round: the
  // engine must still offer the other card, or the checks above prove nothing about counting.
  const k = atRound(4, 6, CCP, [[HEAD[CCP], "score_rear", "into_manchuria"], [HEAD[KMT], "gao_shuxun", "shangdang_campaign"]]);
  const L = E.legal(k, CCP), ids = L.kind === "action" ? L.cards.map((x) => x.id).sort().join(",") : L.kind;
  let after = null; try { after = E.apply(k, { type: "play", side: CCP, card: "into_manchuria", use: "event" }); } catch (e) { return `共軍在第 6 個行動回合打闖關東被拒絕:${e.message}`; }
  return all(eq(E.eraOf(4).rounds[CCP], 8, "易勢期共軍的行動回合數(引擎)"), eq(ids, "into_manchuria,score_rear", "共軍可以打的牌"),
    eq(after.winner, null, "打了闖關東之後還沒有人輸(共軍還有第 7、8 個行動回合)"), ok(true, "共軍第 6 個行動回合打別的牌,對局繼續"));
});

check("對局裡不會因為留著記分卡而輸:普通對普通,這樣結束的不超過 1 局", () => {
  if (TODO) return TODO;
  const t = NN(); const c = clean(t, "普通對普通"); if (c !== true) return c;
  return ok(heldScoring(t) <= 1, `${t.games} 局裡因為手上留著記分卡而結束的:${heldScoring(t)} 局(上限 1)`);
});

// ---------------------------------------------------------------- verdict
test("bots: the guard of M2", () => {
  const s = summary();
  for (const p of R.pass) console.log(`通過 · ${p.label}${p.msg ? " · " + p.msg : ""}`);
  for (const t of s.todos) console.log(`尚未實作 · ${t.label} · ${t.msg}`);
  for (const f of s.failures) console.log(`失敗 · ${f.label} · ${f.msg}`);
  if (!TODO) {
    const t = NN(), turns = Object.keys(t.turnEnd).map(Number).sort((a, b) => a - b);
    console.log(`觀察(不是判準)· 普通對普通每回合結束時的民心(正 = 共軍)與孤城數:${turns.map((k) => `第${k}回合 ${(t.turnEnd[k].mandate / t.turnEnd[k].games).toFixed(1)} / ${(t.turnEnd[k].isolated / t.turnEnd[k].games).toFixed(1)}(${t.turnEnd[k].games} 局)`).join(";")}`);
  }
  console.log(`BOTS-VERDICT 通過 ${s.pass} / 失敗 ${s.fail} / 尚未實作 ${s.todo}`);
  assert.equal(s.fail, 0, s.failures.map((f) => `${f.label}: ${f.msg}`).join("\n"));
});
