// #37: one "on vs off" position probe per new option of E (brief #37, 四 1). Every expected value is read off the
// option's rule sentence (the table in tuning/37/report.txt, 一) and written here by hand; the engine only plays the
// position. Run it against any checkout to see it red where the options do not exist:
//   node tuning/37/probe-options.mjs [repo dir, default this one]
// Prints one line per check ("ok" / "RED") and `PROBE-37 ok n / red m`; exits 1 on any red.
import { pathToFileURL } from "node:url";
import path from "node:path";

const dir = path.resolve(process.argv[2] || ".");
const E = await import(pathToFileURL(path.join(dir, "public/shared/engine.js")).href);
const CCP = 0, KMT = 1;
let ok = 0, red = 0;
const check = (what, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { ok++; console.log(`ok   ${what}: ${g}`); } else { red++; console.log(`RED  ${what}: expected ${w}, got ${g}`); }
};
const tryRun = (f) => { try { return f(); } catch (e) { return `threw: ${String(e.message).slice(0, 140)}`; } };

// The rig of tuning/36/rig.mjs (B7's positions), with the engine of `dir`: the opening answered with the first
// options, the hands dealt (a side holding only its scoring card has nothing to play after the headline), the
// headlines played, then E's tracks laid by hand and the mandate set to 0 (clear of P10's caps).
function opening(options) {
  let st = E.createGame(11, options);
  for (let guard = 0; st.pending && guard < 10; guard++) st = E.apply(st, { type: "choose", side: st.pending.who, choice: st.pending.options.slice(0, st.pending.n ?? 1) });
  if (st.pending || st.phase !== "headline") throw new Error(`opening: phase ${st.phase}`);
  return E.clone(st);
}
function deal(st, side, cards) {
  for (const pile of ["draw", "discard", "removed"]) st[pile] = st[pile].filter((c) => !cards.includes(c));
  st.hands[1 - side] = st.hands[1 - side].filter((c) => !cards.includes(c));
  st.hands[side] = cards.slice();
}
function board({ ccp = [], kmt = [], inflation = 0, leftism = 0, centrists = 0, options = {}, support = null } = {}) {
  let st = opening({ aid: false, mechanismE: true, ...options });
  deal(st, CCP, ["score_north", ...ccp]); deal(st, KMT, ["score_east", ...kmt]);
  if (support) st.support = support.slice(); // before the headlines: who acts first reads the aid cards
  for (const side of [CCP, KMT]) st = E.apply(st, { type: "headline", side, card: st.hands[side].find((c) => E.CARD[c].scoring) });
  st = E.clone(st);
  st.mandate = 0;
  E.setInflation(st, inflation); E.setLeftism(st, leftism); E.setCentrists(st, centrists);
  return st;
}
const play = (st, side, card, use, extra = {}) => E.apply(st, { type: "play", side, card, use, ...extra });
const atSettle = (st) => { const s = E.clone(st); s.pending = null; s.plan = [{ do: "endTurn" }]; return E.run(s); };
const blue = (st, id) => E.infOf(st, id)[KMT], redOf = (st, id) => E.infOf(st, id)[CCP];
// Four of the Nationalists' own spaces with room (cost 1 a point): a 2-op card printed is 4 points under today's E.
const KMT_SPOTS = ["nanjing", "shanghai", "wuhan", "guangzhou"];
const K2 = ["kunming_incident", "takeover_officials", "sino_soviet_treaty"]; // 2-op cards (group 15's)

// ---- 1 ePrintOps: 「印鈔:這張牌的行動點 +n」. n = 1: a 2-op card prints to 3 points (4 refused); absent: 4.
{
  const on = board({ kmt: K2, options: { ePrintOps: 1 } }), off = board({ kmt: K2 });
  const four = (s) => tryRun(() => play(s, KMT, "kunming_incident", "place", { points: KMT_SPOTS, print: true }));
  const three = (s) => tryRun(() => play(s, KMT, "kunming_incident", "place", { points: KMT_SPOTS.slice(0, 3), print: true }));
  const a = three(on), b = four(on), c = four(off);
  check("ePrintOps 1:2 點牌印鈔放 3 點,南京/上海/武漢 的藍各 +1", typeof a === "string" ? a : KMT_SPOTS.slice(0, 3).map((id) => blue(a, id) - blue(on, id)), [1, 1, 1]);
  check("ePrintOps 1:2 點牌印鈔放 4 點被拒", typeof b === "string" && b.startsWith("threw"), true);
  check("ePrintOps 沒給:2 點牌印鈔放 4 點(今天的 +2),四處的藍各 +1", typeof c === "string" ? c : KMT_SPOTS.map((id) => blue(c, id) - blue(off, id)), [1, 1, 1, 1]);
}

// ---- 2 ePrintStep: 「印鈔:通膨 +n」. n = 2 from 2: 4, and 3 is crossed on the way (民心 +1 toward the Communists).
{
  const go = (opts) => { const s = board({ kmt: K2, inflation: 2, options: opts }); const a = play(s, KMT, "kunming_incident", "place", { points: KMT_SPOTS, print: true }); return [E.inflationOf(a), a.mandate - s.mandate]; };
  check("ePrintStep 2:通膨 2 印鈔 → 通膨 / 民心變動(跨過 3:往共軍 1)", tryRun(() => go({ ePrintStep: 2 })), [4, 1]);
  check("ePrintStep 沒給:通膨 2 印鈔 → 通膨 / 民心變動", tryRun(() => go({})), [3, 1]);
}

// ---- 3 ePrintPerTurn: 「國軍每回合最多印鈔 n 次」. n = 1: after one print this turn the cards say no print and a
// print is refused; the next turn it may again. Absent: a second print the same turn is allowed.
{
  const second = (opts) => {
    const s = board({ kmt: K2, options: opts });
    // The Communists hold nothing to play, so the Nationalists' next action round follows at once.
    const a = play(s, KMT, "kunming_incident", "place", { points: KMT_SPOTS, print: true });
    if (E.mustAct(a).join() !== String(KMT) || a.pending) return `rig: ${E.mustAct(a)} must act`;
    const L = E.legal(a, KMT);
    const card = L.cards.find((c) => c.id === "takeover_officials");
    const r = tryRun(() => play(a, KMT, "takeover_officials", "place", { points: ["nanjing"], print: true }));
    const next = E.clone(a); next.turn += 1;
    const L2 = E.legal(next, KMT), card2 = L2.cards.find((c) => c.id === "takeover_officials");
    return [!!(card && card.uses.print), typeof r === "string" ? "refused" : E.inflationOf(r), !!(card2 && card2.uses.print)];
  };
  check("ePrintPerTurn 1:同一回合第二次 [legal 可印?, 第二次印鈔的結果, 下一回合可印?]", tryRun(() => second({ ePrintPerTurn: 1 })), [false, "refused", true]);
  check("ePrintPerTurn 2:同一回合第二次 [legal 可印?, 第二次印鈔之後的通膨, 下一回合可印?]", tryRun(() => second({ ePrintPerTurn: 2 })), [true, 2, true]);
  check("ePrintPerTurn 沒給:同一回合第二次 [legal 可印?, 第二次印鈔之後的通膨, 下一回合可印?]", tryRun(() => second({})), [true, 2, true]);
}

// ---- 4 eInflation: 「通膨到 3:民心 2;到 5:民心 3、中間派往共軍一格;到 7:之後補牌國軍少兩張;到 9:國軍崩潰」.
{
  const T = [{ at: 3, vp: 2 }, { at: 5, vp: 3, centrists: 1 }, { at: 7, hand: 2 }, { at: 9, lose: true }];
  const step = (opts, from) => {
    const s = board({ kmt: K2, inflation: from, options: opts });
    const a = play(s, KMT, "kunming_incident", "place", { points: KMT_SPOTS, print: true });
    return { s, a };
  };
  const t3 = tryRun(() => step({ eInflation: T }, 2)), t5 = tryRun(() => step({ eInflation: T }, 4)), t7 = tryRun(() => step({ eInflation: T }, 6)), t9 = tryRun(() => step({ eInflation: T }, 8));
  const o3 = tryRun(() => step({}, 2)), o5 = tryRun(() => step({}, 4)), o7 = tryRun(() => step({}, 6)), o9 = tryRun(() => step({}, 8));
  const vpc = (x) => (typeof x === "string" ? x : [x.a.mandate - x.s.mandate, E.centristsOf(x.a), x.a.winner, x.a.reason ?? null]);
  check("eInflation 表:2 → 3 [民心變動, 中間派, 勝者, 方式]", vpc(t3), [2, 0, null, null]);
  check("eInflation 表:4 → 5 [民心變動, 中間派, 勝者, 方式]", vpc(t5), [3, 1, null, null]);
  check("eInflation 表:8 → 9 [民心變動, 中間派, 勝者, 方式]", vpc(t9), [0, 0, CCP, "inflation"]);
  check("eInflation 沒給:2 → 3 / 4 → 5 / 8 → 9 [民心變動, 中間派, 勝者, 方式]", [vpc(o3), vpc(o5), vpc(o9)], [[1, 0, null, null], [0, 0, null, null], [0, 0, null, null]]);
  // 7 with the table: the next turn's hand is two smaller (the era's own hand less 2); absent: 6 → 7 changes nothing.
  const hand = (x) => (typeof x === "string" ? x : E.eraLimits(x.a, x.a.turn + 1).hand[KMT] - E.eraLimits(x.s, x.s.turn + 1).hand[KMT]);
  check("eInflation 表:6 → 7 之後下一回合國軍手牌的變動", hand(t7), -2);
  check("eInflation 沒給:6 → 7 之後下一回合國軍手牌的變動", hand(o7), 0);
  check("eInflation 不是由低到高、或最後一格不是崩潰,被拒", [
    typeof tryRun(() => E.createGame(1, { mechanismE: true, eInflation: [{ at: 6, vp: 1 }, { at: 3, vp: 1 }, { at: 10, lose: true }] })) === "string",
    typeof tryRun(() => E.createGame(1, { mechanismE: true, eInflation: [{ at: 3, vp: 1 }, { at: 10, vp: 1 }] })) === "string",
  ], [true, true]);
}

// ---- 5 ePeg: 「平抑:通膨 −n」. n = 1 from 4: 3; absent: 2.
{
  const peg = (opts) => { const s = board({ kmt: K2, inflation: 4, options: { aid: true, ...opts }, support: [0, 2] }); return E.inflationOf(play(s, KMT, "american_aid", "peg")); };
  check("ePeg 1:通膨 4 平抑之後", tryRun(() => peg({ ePeg: 1 })), 3);
  check("ePeg 沒給:通膨 4 平抑之後", tryRun(() => peg({})), 2);
}

// ---- 6 eRadical: 「激進:那個鄉每點行動點放 n 紅」(the cap holds). n = 3: a point costing 1 there is 3 red; absent: 2.
{
  const rad = (opts) => {
    const s = board({ ccp: ["shangdang_campaign", "gao_shuxun", "soviet_arms"], options: opts });
    const opt = E.radicalOptions(s, CCP).filter((v) => E.placeCost(s, CCP, v) === 1 && E.capOf(s, v) - redOf(s, v) >= 3);
    const v = opt[0];
    const card = "shangdang_campaign", ops = E.CARD[card].ops;
    const others = E.placeTargets(s, CCP, ops, []).lit;
    const fill = [v, ...[...others].filter((id) => id !== v && E.placeCost(s, CCP, id) === 1).slice(0, ops - 1)];
    const a = play(s, CCP, card, "place", { points: fill, radical: v });
    return [redOf(a, v) - redOf(s, v), E.leftismOf(a)];
  };
  check("eRadical 3:激進的鄉(每點 1)紅的變動 / 左傾", tryRun(() => rad({ eRadical: 3 })), [3, 1]);
  check("eRadical 沒給:同樣 紅的變動 / 左傾", tryRun(() => rad({})), [2, 1]);
}

// ---- 7 eLeftism: 「左傾到 3:中間派往國軍一格;到 5:民心 3 給國軍;到 7 每次:控制的鄉各 −1 紅,回到 4」.
{
  const T = [{ at: 3, centrists: -1 }, { at: 5, vp: 3 }, { at: 7, villages: 1, reset: 4 }];
  const rad = (opts, from) => {
    const s = board({ ccp: ["shangdang_campaign", "gao_shuxun", "soviet_arms"], leftism: from, options: opts });
    const v = E.radicalOptions(s, CCP).find((x) => E.placeCost(s, CCP, x) === 1);
    const a = play(s, CCP, "shangdang_campaign", "place", { points: [v], radical: v });
    return [E.leftismOf(a), E.centristsOf(a), s.mandate - a.mandate];
  };
  check("eLeftism 表:2 → 3 [左傾, 中間派, 民心往國軍]", tryRun(() => rad({ eLeftism: T }, 2)), [3, -1, 0]);
  check("eLeftism 表:4 → 5 [左傾, 中間派, 民心往國軍]", tryRun(() => rad({ eLeftism: T }, 4)), [5, 0, 3]);
  check("eLeftism 表:6 → 7 [左傾(回到 4), 中間派, 民心往國軍]", tryRun(() => rad({ eLeftism: T }, 6)), [4, 0, 0]);
  check("eLeftism 沒給:2 → 3 / 4 → 5 [左傾, 中間派, 民心往國軍]", [tryRun(() => rad({}, 2)), tryRun(() => rad({}, 4))], [[3, 0, 0], [5, 0, 0]]);
}

// ---- 8 eCentristsVp: 「結算:中間派每偏一格,民心往那一方移 n」. n = 2, the centrists +1: 民心 +2 toward the Communists at
// the 結算 (log `centristsSettle`); absent: +1.
{
  const settle = (opts) => {
    const s = board({ centrists: 1, options: opts });
    const a = atSettle(s);
    const l = a.log.find((x) => x.type === "centristsSettle");
    return l ? l.n : null;
  };
  check("eCentristsVp 2:中間派親共 1,結算時民心往共軍", tryRun(() => settle({ eCentristsVp: 2 })), 2);
  check("eCentristsVp 沒給:同樣", tryRun(() => settle({})), 1);
}

// ---- 9 none of the keys is read with E off: a game with every key and no mechanismE is the plain game.
{
  const all = { ePrintOps: 1, ePrintStep: 2, ePrintPerTurn: 1, ePeg: 1, eRadical: 3, eCentristsVp: 2 };
  const a = E.createGame(5, all), b = E.createGame(5, {});
  check("E 關掉時給了這些鍵:沒有 mechE,開局和沒給的一樣", [a.mechE === undefined, JSON.stringify({ ...a, options: null, seed: 0 }) === JSON.stringify({ ...b, options: null, seed: 0 })], [true, true]);
}

console.log(`PROBE-37 ok ${ok} / red ${red}`);
process.exitCode = red ? 1 : 0;
