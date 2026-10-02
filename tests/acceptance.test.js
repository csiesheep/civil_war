// The first guard. Orchestrator's file: a peer may run it and falsify against
// it, and does not edit it (TEAM.md).
//
//   node --test tests/acceptance.test.js      (or `npm test`)
//
// Three verdicts per check (tests/harness.js): 通過 / 失敗 / 尚未實作.
//
// Group 0 compares the product's data with the rulebook's numbers. The numbers
// in SPEC were copied BY HAND from the owner's vault, `Projects/civil_war/
// civil_war - rulebook.md` (v0, 2026-10-01), sections 二, 三 and 五. They are not
// read from the product: changing a number in public/shared/ to make a later
// check pass turns this group red.
// Group 1 is the product's verb, with a loose threshold: a game can be set up,
// and both sides have something legal to do at their first decision.
// Group 2 lists what the rulebook asks for and the engine does not have yet,
// each keyed on the thing that will exist when it is built. The orchestrator
// replaces each of them with real checks BEFORE the work is handed out.
// Group 3 onward are those real checks, one group per issue. Each still answers
// 尚未實作 until the thing it is keyed on exists, and from then on it is judged.
import test from "node:test";
import assert from "node:assert/strict";
import { R, section, check, eq, ok, nonEmpty, summary } from "./harness.js";
import * as E from "../public/shared/engine.js";

const CCP = 0, KMT = 1;

// ---------------------------------------------------------------- SPEC
// id: [kind, region, stability, blue at the start, red at the start]
const SPEC_SPACES = {
  beiman:    ["village", "northeast", 3, 0, 1],
  changchun: ["city",    "northeast", 2, 0, 0],
  siping:    ["village", "northeast", 2, 0, 0],
  shenyang:  ["city",    "northeast", 3, 0, 0],
  liaoxi:    ["village", "northeast", 2, 0, 0],
  jinzhou:   ["city",    "northeast", 3, 0, 0],
  tianjin:   ["city",    "north",     3, 3, 0],
  beiping:   ["city",    "north",     3, 3, 0],
  jizhong:   ["village", "north",     2, 0, 2],
  chasui:    ["village", "north",     2, 2, 2],
  taihang:   ["village", "north",     3, 0, 4],
  taiyuan:   ["city",    "north",     3, 2, 0],
  jinzhong:  ["village", "north",     2, 2, 1],
  jiluyu:    ["village", "east",      3, 0, 3],
  jinan:     ["city",    "east",      3, 2, 0],
  luzhong:   ["village", "east",      3, 2, 3],
  xuzhou:    ["city",    "east",      3, 3, 0],
  huaihai:   ["village", "east",      2, 1, 2],
  zhengzhou: ["city",    "east",      2, 2, 0],
  dabieshan: ["village", "east",      2, 2, 2],
  shanbei:   ["village", "northwest", 4, 0, 4],
  xian:      ["city",    "northwest", 3, 4, 0],
  lanzhou:   ["city",    "northwest", 3, 2, 0],
  wuhan:     ["city",    "rear",      2, 3, 0],
  nanjing:   ["city",    "rear",      4, 4, 0],
  shanghai:  ["city",    "rear",      3, 3, 0],
  guangzhou: ["city",    "rear",      2, 2, 0],
  guilin:    ["city",    "rear",      3, 2, 0],
  kunming:   ["city",    "rear",      3, 2, 0],
};
const SPEC = {
  spaces: 29, cities: 17, villages: 12,
  regionSizes: { northeast: 6, north: 7, east: 7, northwest: 3, rear: 6 },
  // presence / domination / control
  regionValues: { northeast: [3, 6, 8], north: [4, 8, 10], east: [4, 8, 10], northwest: [2, 3, 4], rear: [1, 2, 3] },
  cityKeys: ["beiping", "jinan", "jinzhou", "nanjing", "shanghai", "shenyang", "tianjin", "xian", "xuzhou"],
  bases: ["beiman", "jiluyu", "luzhong", "shanbei", "taihang"],
  ports: ["guangzhou", "jinzhou", "shanghai", "tianjin"],
  edges: [
    "beiman-changchun", "beiman-siping", "changchun-siping", "siping-shenyang", "shenyang-liaoxi", "liaoxi-jinzhou",
    "jinzhou-tianjin", "tianjin-beiping", "tianjin-jizhong", "beiping-jizhong", "beiping-chasui", "jizhong-taihang",
    "jizhong-jiluyu", "chasui-jinzhong", "taihang-taiyuan", "taihang-jinzhong", "taihang-jiluyu", "taiyuan-jinzhong",
    "jinzhong-xian", "jinzhong-shanbei", "jiluyu-jinan", "jiluyu-zhengzhou", "jinan-luzhong", "luzhong-xuzhou",
    "luzhong-huaihai", "xuzhou-huaihai", "huaihai-nanjing", "huaihai-zhengzhou", "huaihai-dabieshan",
    "zhengzhou-dabieshan", "zhengzhou-xian", "dabieshan-wuhan", "shanbei-xian", "xian-lanzhou", "wuhan-nanjing",
    "wuhan-guangzhou", "wuhan-guilin", "nanjing-shanghai", "shanghai-guangzhou", "guangzhou-guilin", "guilin-kunming",
  ],
  startBlue: 46, startRed: 24,
  capitals: { ccp: "shanbei", kmt: "nanjing" }, moved: { ccp: "taihang", kmt: "guangzhou" },
  // power: [seat, all its spaces, popular support for 易幟]
  powers: {
    sui:  ["chasui",  ["beiping", "chasui"],   3],
    jin:  ["taiyuan", ["jinzhong", "taiyuan"], 2],
    gui:  ["guilin",  ["guilin", "wuhan"],     3],
    ma:   ["lanzhou", ["lanzhou"],             2],
    dian: ["kunming", ["kunming"],             2],
  },
  toWin: { mie: 3, seals: 5 },
  free: { ccp: 3, kmt: 4 },
  deck: {
    total: 72,
    // era: [Nationalist, Communist, neutral, scoring]
    eras: { takeover: [10, 6, 8, 3], turning: [8, 8, 6, 2], decisive: [5, 9, 7, 0] },
    ops: { kmt: 57, ccp: 60 },
    fourOps: ["hu_takes_yanan", "huaihai_campaign", "liaoshen_campaign", "reorganisation_conference", "yangtze_crossing"],
    scoring: { takeover: ["east", "north", "northeast"], turning: ["northwest", "rear"], decisive: [] },
  },
};

const sorted = (a) => a.slice().sort();
const same = (a, b, what) => eq(JSON.stringify(sorted(a)), JSON.stringify(sorted(b)), what);
// The first result that is not a pass; when all pass, the last one that says what it measured.
const all = (...rs) => { let said = true; for (const r of rs) { if (r !== true && !(r && r.pass)) return r; if (r !== true) said = r; } return said; };

// ---------------------------------------------------------------- group 0
section("0 常數對照");

check("據點 29 個:17 城、12 鄉,類型、區、安定值逐一相符", () => {
  const want = Object.keys(SPEC_SPACES);
  const r = all(
    eq(E.SPACES.length, SPEC.spaces, "據點數"),
    same(E.SPACES.map((s) => s.id), want, "據點的 id"),
    eq(E.SPACES.filter((s) => s.kind === "city").length, SPEC.cities, "城"),
    eq(E.SPACES.filter((s) => s.kind === "village").length, SPEC.villages, "鄉"),
  );
  if (r !== true) return r;
  for (const s of E.SPACES) {
    const [kind, region, stability] = SPEC_SPACES[s.id];
    const q = all(eq(s.kind, kind, `${s.zh} 的類型`), eq(s.region, region, `${s.zh} 的區`), eq(s.stability, stability, `${s.zh} 的安定值`));
    if (q !== true) return q;
  }
  return ok(true, `${E.SPACES.length} 個據點,${SPEC.cities} 城 ${SPEC.villages} 鄉`);
});

check("五區的據點數與分值", () => {
  for (const [id, n] of Object.entries(SPEC.regionSizes)) {
    const [p, d, c] = SPEC.regionValues[id], reg = E.REGIONS[id];
    if (!reg) return `沒有這一區:${id}`;
    const q = all(eq(E.spacesOf(id).length, n, `${reg.zh} 的據點數`), eq(reg.presence, p, `${reg.zh} 存在`), eq(reg.domination, d, `${reg.zh} 優勢`), eq(reg.control, c, `${reg.zh} 獨佔`));
    if (q !== true) return q;
  }
  return all(same(Object.keys(E.REGIONS), Object.keys(SPEC.regionSizes), "區的 id"), same(E.SCORED_REGIONS, Object.keys(SPEC.regionSizes), "記分的區"),
    ok(true, Object.entries(SPEC.regionSizes).map(([id, n]) => `${E.REGIONS[id].zh} ${n}`).join("、")));
});

check("城的要衝 9 個、根據地 5 個、港 4 個", () => {
  const key = E.SPACES.filter((s) => s.battleground), base = E.SPACES.filter((s) => s.base), port = E.SPACES.filter((s) => s.port);
  return all(
    same(key.map((s) => s.id), SPEC.cityKeys, "城的要衝"),
    eq(key.every((s) => s.kind === "city"), true, "要衝都是城"),
    same(base.map((s) => s.id), SPEC.bases, "根據地"),
    eq(base.every((s) => s.kind === "village"), true, "根據地都是鄉"),
    same(port.map((s) => s.id), SPEC.ports, "港"),
    ok(true, `要衝 ${key.map((s) => s.zh).join("")};根據地 ${base.map((s) => s.zh).join("、")};港 ${port.map((s) => s.zh).join("、")}`),
  );
});

check("相鄰 41 條,雙向一致", () => {
  const got = new Set();
  for (const s of E.SPACES) for (const a of s.adj) {
    if (!E.SPACE[a]) return `${s.zh} 相鄰到不存在的據點 ${a}`;
    if (!E.SPACE[a].adj.includes(s.id)) return `相鄰不是雙向:${s.zh} → ${E.SPACE[a].zh} 有,反過來沒有`;
    got.add([s.id, a].sort().join("-"));
  }
  const want = SPEC.edges.map((e) => e.split("-").sort().join("-"));
  return all(eq(want.length, 41, "規則書抄來的邊數"), same([...got], want, "相鄰"), ok(true, `${got.size} 條`));
});

check("開局點數:逐點相符,合計藍 46、紅 24", () => {
  const blue = E.SETUP.kmt.fixed, red = E.SETUP.ccp.fixed;
  let b = 0, r = 0;
  for (const [id, [, , , wantBlue, wantRed]] of Object.entries(SPEC_SPACES)) {
    const q = all(eq(blue[id] || 0, wantBlue, `${E.SPACE[id].zh} 的藍`), eq(red[id] || 0, wantRed, `${E.SPACE[id].zh} 的紅`));
    if (q !== true) return q;
    b += blue[id] || 0; r += red[id] || 0;
  }
  return all(eq(b, SPEC.startBlue, "藍合計"), eq(r, SPEC.startRed, "紅合計"), ok(true, `藍 ${b}、紅 ${r}`));
});

check("首都與遷都地;第 1 回合的免費放置點數", () => all(
  eq(E.HOME_CAPITAL[CCP], SPEC.capitals.ccp, "共軍首都"), eq(E.HOME_CAPITAL[KMT], SPEC.capitals.kmt, "國軍首都"),
  eq(E.MOVED_CAPITAL[CCP], SPEC.moved.ccp, "共軍遷都地"), eq(E.MOVED_CAPITAL[KMT], SPEC.moved.kmt, "國軍遷都地"),
  eq(E.DEFAULT_OPTIONS.homeFall, "move", "首都規則"),
  eq(E.SETUP.ccp.free, SPEC.free.ccp, "共軍免費放置"), eq(E.SETUP.kmt.free, SPEC.free.kmt, "國軍免費放置"),
  ok(true, `${E.SPACE[E.HOME_CAPITAL[CCP]].zh} → ${E.SPACE[E.MOVED_CAPITAL[CCP]].zh};${E.SPACE[E.HOME_CAPITAL[KMT]].zh} → ${E.SPACE[E.MOVED_CAPITAL[KMT]].zh};免費放置 共 ${E.SETUP.ccp.free} 國 ${E.SETUP.kmt.free}`),
));

check("五個實力派:本據、據點、易幟的民心;3 個易幟、5 個整編即勝", () => {
  const r = same(Object.keys(E.STATES), Object.keys(SPEC.powers), "實力派");
  if (r !== true) return r;
  for (const [id, [seat, spaces, vp]] of Object.entries(SPEC.powers)) {
    const p = E.STATES[id];
    const q = all(eq(p.capital, seat, `${p.zh} 的本據`), same(E.spacesOfState(id), spaces, `${p.zh} 的據點`), eq(p.vp, vp, `${p.zh} 易幟的民心`));
    if (q !== true) return q;
  }
  return all(eq(E.DEFAULT_OPTIONS.mie, SPEC.toWin.mie, "易幟即勝數"), eq(E.DEFAULT_OPTIONS.seals, SPEC.toWin.seals, "整編即勝數"),
    ok(true, Object.values(E.STATES).map((p) => `${p.zh}(${E.SPACE[p.capital].zh})`).join("、")));
});

check("72 張牌:三期各陣營的張數、行動點合計、4 點牌、記分卡分期", () => {
  const r = all(eq(E.CARDS.length, SPEC.deck.total, "牌數"), eq(new Set(E.CARDS.map((c) => c.id)).size, SPEC.deck.total, "不重複的 id"));
  if (r !== true) return r;
  for (const [era, [k, c, n, s]] of Object.entries(SPEC.deck.eras)) {
    const deck = E.CARDS.filter((x) => x.era === era), plain = deck.filter((x) => !x.scoring);
    const q = all(
      eq(deck.length, k + c + n + s, `${era} 的張數`),
      eq(E.ERA_DECKS[era] && E.ERA_DECKS[era].length, k + c + n + s, `${era} 牌庫`),
      eq(plain.filter((x) => x.side === KMT).length, k, `${era} 國軍牌`),
      eq(plain.filter((x) => x.side === CCP).length, c, `${era} 共軍牌`),
      eq(plain.filter((x) => x.side == null).length, n, `${era} 中立牌`),
      same(deck.filter((x) => x.scoring).map((x) => x.scoring), SPEC.deck.scoring[era], `${era} 的記分卡`),
    );
    if (q !== true) return q;
  }
  const ops = (side) => E.CARDS.filter((x) => !x.scoring && x.side === side).reduce((t, x) => t + x.ops, 0);
  return all(
    eq(ops(KMT), SPEC.deck.ops.kmt, "國軍牌面行動點"), eq(ops(CCP), SPEC.deck.ops.ccp, "共軍牌面行動點"),
    same(E.CARDS.filter((x) => x.ops === 4).map((x) => x.id), SPEC.deck.fourOps, "4 點牌"),
    ok(true, `72 張;行動點 國 ${ops(KMT)} 共 ${ops(CCP)};4 點牌 ${E.CARDS.filter((x) => x.ops === 4).map((x) => x.zh).join("、")}`),
  );
});

// ---------------------------------------------------------------- group 1
section("1 產品的動詞");

const total = (st, side) => E.SPACES.reduce((t, s) => t + E.infOf(st, s.id)[side], 0);
// A small deterministic generator of its own, so a red line can be replayed.
const lcg = (seed) => { let x = (seed * 2654435761) >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };
const pickN = (options, n, rnd) => { const pool = options.slice(), out = []; while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]); return out; };

check("開局沒有孤城:每座有藍的城都連得回補給源", () => {
  const st = E.createGame(1);
  const cities = E.SPACES.filter((s) => s.kind === "city" && E.infOf(st, s.id)[KMT] > 0);
  const lone = E.isolatedCities(st), src = E.supplySources(st);
  return all(nonEmpty(cities.length, "有藍的城"), same(src, ["guangzhou", "nanjing", "shanghai", "tianjin"], "開局的補給源"),
    ok(lone.length === 0, lone.length ? `開局就有孤城:${lone.map((id) => E.SPACE[id].zh).join("、")}(補給源:${src.map((id) => E.SPACE[id].zh).join("、")})` : `${cities.length} 座有藍的城都有補給;補給源 ${src.map((id) => E.SPACE[id].zh).join("、")}`));
});

check("開局沒有整編或易幟標記", () => {
  const st = E.createGame(1);
  return all(eq(Object.keys(st.mie).length, 0, "易幟標記"), eq(Object.keys(st.seals).length, 0, "整編標記"), eq(st.mandate, 0, "民心"), ok(true, "易幟 0、整編 0、民心 0"));
});

check("200 個種子都開得了局,兩邊在第一個決定都有合法行動", () => {
  const villages = E.SPACES.filter((s) => s.kind === "village").map((s) => s.id);
  const cities = E.SPACES.filter((s) => s.kind === "city" && s.region !== "northeast").map((s) => s.id);
  const N = 200;
  let hands = null;
  for (let seed = 1; seed <= N; seed++) {
    const rnd = lcg(seed), at = `種子 ${seed}`;
    let st = E.createGame(seed);
    let p = st.pending;
    if (!p || p.who !== CCP || p.kind !== "points" || p.n !== SPEC.free.ccp) return `${at}:共軍的免費放置沒有出現(pending = ${JSON.stringify(p && { who: p.who, kind: p.kind, n: p.n })})`;
    let q = same(p.options, villages, `${at} 共軍可放的據點`); if (q !== true) return q;
    if (E.legal(st, CCP).kind !== "pending") return `${at}:共軍在免費放置時沒有合法行動`;
    st = E.apply(st, { type: "choose", side: CCP, choice: pickN(p.options, p.n, rnd) });
    p = st.pending;
    if (!p || p.who !== KMT || p.kind !== "points" || p.n !== SPEC.free.kmt) return `${at}:國軍的免費放置沒有出現(pending = ${JSON.stringify(p && { who: p.who, kind: p.kind, n: p.n })})`;
    q = same(p.options, cities, `${at} 國軍可放的據點`); if (q !== true) return q;
    if (E.legal(st, KMT).kind !== "pending") return `${at}:國軍在免費放置時沒有合法行動`;
    st = E.apply(st, { type: "choose", side: KMT, choice: pickN(p.options, p.n, rnd) });
    if (st.winner != null) return `${at}:還沒開始就結束了(${st.reason})`;
    if (st.phase !== "headline" || st.turn !== 1) return `${at}:免費放置之後不在第 1 回合的標題階段(phase ${st.phase},turn ${st.turn})`;
    q = all(eq(total(st, KMT), SPEC.startBlue + SPEC.free.kmt, `${at} 放完之後的藍`), eq(total(st, CCP), SPEC.startRed + SPEC.free.ccp, `${at} 放完之後的紅`));
    if (q !== true) return q;
    for (const side of [CCP, KMT]) {
      const l = E.legal(st, side);
      if (l.kind !== "headline" || !(l.cards.length > 0)) return `${at}:${side === CCP ? "共軍" : "國軍"}在標題階段沒有合法行動(${l.kind})`;
    }
    if (E.mustAct(st).length !== 2) return `${at}:應該兩邊都要出標題,mustAct = ${JSON.stringify(E.mustAct(st))}`;
    hands = st.hands.map((h) => h.length);
  }
  return ok(true, `${N}/${N} 局開得了局;放完之後藍 ${SPEC.startBlue + SPEC.free.kmt}、紅 ${SPEC.startRed + SPEC.free.ccp};手牌 共 ${hands[CCP]} 國 ${hands[KMT]}`);
});

// ---------------------------------------------------------------- group 2
section("2 規則書有、引擎還沒有");

check("72 張牌的事件", () => {
  const left = E.CARDS.filter((c) => c.todo).length;
  return left ? `TODO: ${left} 張牌的事件還沒做(打出事件會直接報錯)` : ok(true, "67 張都有事件");
});
// 孤城的效果 moved to group 3 (#1). What supply still owes, each with the thing it waits for:
// 美援 may be placed in a cut-off city (外國勢力), turn 7 costs a cut-off city 2 (時局),
// and 空運孤城 / 和平起義 / 長春圍城 / 平津戰役 read `isolatedCities` (the cards).
// 時局 8 張 and 行動回合與手牌依期不對稱 moved to group 4 (#2), with the two support tracks
// themselves (the 時局 move them). What is left of 外國勢力 is keyed on the Nine Cauldrons
// still being in the state: the two aid cards replace it.
check("外國勢力:美援、蘇援兩張不換手的外援牌;美軍駐華", () => {
  const st = E.createGame(1);
  return st.jiuding !== undefined ? "TODO: 外援仍是縱橫的九鼎(一張、會換手)。含:行動點 = 支持度、美援全部放在城時可以放進孤城、蘇援全部用在東北 +1、美國支持 ≥ 3 時共軍不能奇襲天津與上海" : ok(true, "九鼎不在了");
});
check("記分時根據地也算要衝;只有城的要衝推民生", () => (E.DEFAULT_OPTIONS.baseScoring === undefined ? "TODO: regionTally 還只算城的要衝" : ok(true, "baseScoring on")));

// ---------------------------------------------------------------- group 3
// 補給(機制 A), issue #1. Written before the work was handed out, from the
// rulebook's own words (三, 補給; 三, 回合結構 5; 四, 細則), copied here by hand:
//
//   1. 補給源:國軍控制的港(上海、廣州、天津、錦州),加上國軍目前的首都。
//   2. 有藍的城,要能沿著相鄰關係走到一個補給源,路上每個據點都不在共軍控制下,
//      否則是孤城。無人控制的據點可以通過。隨時依盤面判定。
//   3. 孤城的效果:國軍不能在那裡扶植(美援除外);回合結算時藍 −1。
//   4. 鄉不檢查補給。共軍不檢查補給。
//   結算,依序:手上有記分卡者敗 → 遷都判定 → 孤城藍 −1 → 民生回復 1 → 「本回合」的效果結束 → …
//   孤城掉點可能讓國軍失去控制、失去整編標記,或讓共軍達成易幟:掉完點立即檢查標記。
//   國軍遷都後,補給源跟著換成廣州。南京丟了之後,它不再是補給源。
//
// Three readings the rulebook does not spell out. The orchestrator ruled them on #1 first;
// the owner confirmed all three there on 2026-10-01 (owner 裁決 #1). Each is one check below:
//   - 「隨時依盤面判定」 is read point by point inside one 扶植, the way cost and cap are;
//   - a city with no blue and no supply cannot take its first blue point from 扶植 either;
//   - a city the Communists control is itself on its path: never in supply.
//
// Every position is the rulebook's opening (SPEC_SPACES above), then edited by
// hand; none is read from the product. Both hands are emptied so that one `run`
// walks the turn out to its 結算 without any card event (none exists yet).
section("3 補給(機制 A)");

const supplyTodo = () => (E.DEFAULT_OPTIONS.supply === undefined ? "TODO: DEFAULT_OPTIONS.supply 還沒有;只有 isolatedCities 這個讀數,沒有接進扶植與回合結算" : null);
const blueOf = (st, id) => E.infOf(st, id)[KMT], redOf = (st, id) => E.infOf(st, id)[CCP];
const zhs = (ids) => ids.map((id) => E.SPACE[id].zh).join("、") || "無";
const thrown = (fn) => { try { fn(); return null; } catch (e) { return (e && e.message) || String(e); } };
// edits: { id: { r: red, b: blue } }, either key optional (the opening's number stays).
function position(edits = {}, options = {}) {
  let st = E.createGame(11, options);
  st = E.apply(st, { type: "choose", side: CCP, choice: st.pending.options.slice(0, SPEC.free.ccp) });
  st = E.apply(st, { type: "choose", side: KMT, choice: st.pending.options.slice(0, SPEC.free.kmt) });
  st = E.clone(st);
  st.inf = {};
  for (const [id, [, , stability, blue, red]] of Object.entries(SPEC_SPACES)) {
    const e = edits[id] || {};
    const r = e.r ?? red, b = e.b ?? blue;
    if (r > stability + 2 || b > stability + 2) throw new Error(`position: ${id} 超過上限(紅 ${r} 藍 ${b},上限 ${stability + 2})`);
    st.inf[id] = [r, b];
  }
  for (const id of Object.keys(edits)) if (!SPEC_SPACES[id]) throw new Error(`position: 沒有這個據點 ${id}`);
  st.discard.push(...st.hands[CCP], ...st.hands[KMT]);
  st.hands = [[], []];
  st.jiuding = { holder: null, faceDown: true }; // nobody has the Cauldrons to play, this turn or a later one
  return st;
}
// Put these cards in a hand, and nowhere else.
function deal(st, side, cards) {
  for (const pile of ["draw", "discard", "removed"]) st[pile] = st[pile].filter((c) => !cards.includes(c));
  st.hands[side] = cards.slice();
}
// Walk the turn out from where it stands. Returns the state after 結算.
const settle = (st) => E.run(E.clone(st));
// The walk really got through turn 1's 結算 and into turn 2 (or to the end of the game).
const settled = (st, what) => {
  if (!st.log.some((l) => l.type === "endTurn" && l.turn === 1)) return `${what}:第 1 回合沒有走到結算(turn ${st.turn},phase ${st.phase},winner ${st.winner},reason ${st.reason})`;
  return true;
};
const attritions = (st) => st.log.filter((l) => l.type === "attrition");
const blueMap = (st) => Object.fromEntries(Object.keys(SPEC_SPACES).map((id) => [id, blueOf(st, id)]));
const redMap = (st) => Object.fromEntries(Object.keys(SPEC_SPACES).map((id) => [id, redOf(st, id)]));
// The spaces whose number differs between two maps, as "濟南 2→1".
const diff = (a, b) => Object.keys(a).filter((id) => a[id] !== b[id]).map((id) => `${E.SPACE[id].zh} ${a[id]}→${b[id]}`).join("、") || "無";

// 魯中 red 5 against blue 2 (安定 3) is Communist; 冀魯豫 already is. 濟南 touches nothing else.
const JINAN_CUT = { luzhong: { r: 5 } };

check("孤城:國軍不能在那裡扶植(placeTargets、placePoints、opsOptions 三處一致)", () => {
  const t = supplyTodo(); if (t) return t;
  const st = position(JINAN_CUT), off = position(JINAN_CUT, { supply: false });
  const pre = all(
    same(E.isolatedCities(st), ["jinan"], "這個盤面的孤城"),
    eq(E.controller(st, "luzhong"), CCP, "魯中的控制者"), eq(E.controller(st, "jiluyu"), CCP, "冀魯豫的控制者"),
    eq(blueOf(st, "jinan"), 2, "濟南的藍"),
    // The control arm: without the rule 濟南 is an ordinary target, so reach and cap are not what removes it.
    eq(E.placeTargets(off, KMT, 3).lit.has("jinan"), true, "supply 關掉時濟南可以扶植"),
  );
  if (pre !== true) return pre;
  const lit = E.placeTargets(st, KMT, 3).lit, opts = E.opsOptions(st, KMT).placeOptions.map((o) => o.id);
  const err = thrown(() => E.placePoints(E.clone(st), KMT, ["jinan"], 3));
  return all(
    eq(lit.has("jinan"), false, "placeTargets 亮了孤城濟南"),
    eq(lit.has("xuzhou"), true, "placeTargets 沒有亮有補給的徐州"),
    eq(opts.includes("jinan"), false, "opsOptions 列了孤城濟南"),
    eq(opts.includes("xuzhou"), true, "opsOptions 沒有列徐州"),
    ok(err != null, err == null ? "placePoints 讓國軍把點放進了孤城濟南" : `濟南是孤城:不亮、不列、placePoints 拒絕(「${err}」);徐州照常`),
  );
});

check("鄉不檢查補給;共軍不檢查補給", () => {
  const t = supplyTodo(); if (t) return t;
  const st = position(JINAN_CUT);
  const pre = all(same(E.isolatedCities(st), ["jinan"], "孤城"), eq(E.supplied(st).has("luzhong"), false, "魯中在補給範圍內"), eq(blueOf(st, "luzhong"), 2, "魯中的藍"));
  if (pre !== true) return pre;
  const kmt = E.placeTargets(st, KMT, 3), ccp = E.placeTargets(st, CCP, 1);
  const a = E.clone(st), b = E.clone(st);
  return all(
    eq(kmt.lit.has("luzhong"), true, "國軍可以扶植被切斷的鄉(魯中)"), eq(kmt.costs.luzhong, 2, "魯中在共軍控制下,每點的花費"),
    eq(thrown(() => E.placePoints(a, KMT, ["luzhong"], 3)), null, "國軍在魯中放 1 點被拒絕"), eq(blueOf(a, "luzhong"), 3, "放完之後魯中的藍"),
    eq(ccp.lit.has("jinan"), true, "共軍可以扶植孤城濟南"),
    eq(thrown(() => E.placePoints(b, CCP, ["jinan"], 1)), null, "共軍在濟南放 1 點被拒絕"), eq(redOf(b, "jinan"), 1, "放完之後濟南的紅"),
    ok(true, "國軍照常放進被切斷的魯中(2 點換 1);共軍照常放進孤城濟南"),
  );
});

check("隨時依盤面判定:同一次扶植裡先把路打通,下一點就能放進原本的孤城", () => {
  const t = supplyTodo(); if (t) return t;
  const st = position(JINAN_CUT);
  // One blue point in 魯中 (2 ops: it is Communist) makes it red 5 / blue 3, nobody's; 濟南 then reaches 徐州 and 南京.
  const opened = E.clone(st); E.place(opened, KMT, "luzhong", 1);
  const pre = all(same(E.isolatedCities(st), ["jinan"], "一開始的孤城"), eq(E.controller(opened, "luzhong"), null, "魯中多 1 藍之後的控制者"), eq(E.isolatedCities(opened).length, 0, "魯中多 1 藍之後的孤城數"));
  if (pre !== true) return pre;
  const next = E.placeTargets(st, KMT, 3, ["luzhong"]);
  const a = E.clone(st), b = E.clone(st);
  const good = thrown(() => E.placePoints(a, KMT, ["luzhong", "jinan"], 3)), bad = thrown(() => E.placePoints(b, KMT, ["jinan", "luzhong"], 3));
  return all(
    eq(E.placeTargets(st, KMT, 3).lit.has("jinan"), false, "第一點就亮了濟南"),
    eq(next.lit.has("jinan"), true, "魯中放了 1 點之後,濟南沒有亮"), eq(next.left, 1, "魯中放了 1 點之後剩下的行動點"), eq(next.costs.jinan, 1, "濟南每點的花費"),
    eq(good, null, "先魯中後濟南(3 點)被拒絕"), eq(blueOf(a, "jinan"), 3, "先魯中後濟南之後濟南的藍"), eq(blueOf(a, "luzhong"), 3, "先魯中後濟南之後魯中的藍"),
    ok(bad != null, bad == null ? "先濟南後魯中沒有被拒絕:濟南放點的那一刻還是孤城" : `先魯中(2 點)後濟南(1 點)可以;反過來被拒絕(「${bad}」)`),
  );
});

check("沒有藍也沒有補給的城:國軍的第一點也放不進去(owner 裁決 #1)", () => {
  const t = supplyTodo(); if (t) return t;
  // 太原 emptied, both its neighbours Communist (太行 already; 晉中 red 4 against blue 2, 安定 2). 鄭州 emptied too, but supplied through 淮海.
  const edits = { taiyuan: { b: 0 }, jinzhong: { r: 4 }, zhengzhou: { b: 0 } };
  const st = position(edits), off = position(edits, { supply: false });
  const pre = all(
    eq(blueOf(st, "taiyuan"), 0, "太原的藍"), eq(E.supplied(st).has("taiyuan"), false, "太原在補給範圍內"), eq(E.canPlaceAt(st, KMT, "taiyuan"), true, "太原在國軍的相鄰範圍內(晉中有藍)"),
    eq(E.supplied(st).has("zhengzhou"), true, "鄭州在補給範圍內"), eq(E.canPlaceAt(st, KMT, "zhengzhou"), true, "鄭州在國軍的相鄰範圍內"),
    eq(E.placeTargets(off, KMT, 2).lit.has("taiyuan"), true, "supply 關掉時太原可以扶植"),
  );
  if (pre !== true) return pre;
  const lit = E.placeTargets(st, KMT, 2).lit, err = thrown(() => E.placePoints(E.clone(st), KMT, ["taiyuan"], 2));
  return all(
    eq(lit.has("taiyuan"), false, "placeTargets 亮了沒有補給的空城太原"), eq(lit.has("zhengzhou"), true, "placeTargets 沒有亮有補給的空城鄭州"),
    ok(err != null, err == null ? "placePoints 讓國軍把第一點放進了沒有補給的太原" : `空的太原沒有補給:不亮、拒絕(「${err}」);空的鄭州有補給:照常`),
  );
});

// Added after #1 was delivered: BE reported it, and no check held it. It follows from two things
// together, the Phase 0 reading (`supplied` counts the city itself as part of the path) and
// ruling 3 above (the ban asks `supplied`). The owner kept both (owner 裁決 #1, 2026-10-01); the other
// reading, in which the city itself is not part of its own path, turns every expectation in this check around.
check("共軍控制的城不在補給範圍內:國軍不能扶植進去(連空城),裡面的藍每回合掉 1(owner 裁決 #1)", () => {
  const t = supplyTodo(); if (t) return t;
  // 鄭州 (安定 2) held by the Communists with red 2 and no blue; every neighbour but 冀魯豫 is open and supplied.
  const empty = { zhengzhou: { r: 2, b: 0 } }, st = position(empty), off = position(empty, { supply: false });
  const sup = E.supplied(st), offT = E.placeTargets(off, KMT, 2);
  const pre = all(
    eq(E.controller(st, "zhengzhou"), CCP, "鄭州的控制者"),
    eq(["huaihai", "dabieshan", "xian"].every((id) => sup.has(id)), true, "鄭州的鄰居淮海、大別山、西安都有補給"),
    eq(E.isolatedCities(st).length, 0, "孤城數(鄭州沒有藍,照定義不是孤城)"),
    eq(offT.lit.has("zhengzhou"), true, "supply 關掉時鄭州可以扶植"), eq(offT.costs.zhengzhou, 2, "supply 關掉時鄭州每點的花費(共軍控制)"),
  );
  if (pre !== true) return pre;
  const err = thrown(() => E.placePoints(E.clone(st), KMT, ["zhengzhou"], 2));
  // The same city with blue 2 under red 4: a 孤城 by this reading, and it loses a point at the end of the turn.
  const held = position({ zhengzhou: { r: 4, b: 2 } });
  const pre2 = all(eq(E.controller(held, "zhengzhou"), CCP, "鄭州(紅 4 藍 2)的控制者"), same(E.isolatedCities(held), ["zhengzhou"], "孤城"));
  if (pre2 !== true) return pre2;
  const after = settle(held);
  return all(
    eq(E.placeTargets(st, KMT, 2).lit.has("zhengzhou"), false, "placeTargets 亮了共軍控制的空城鄭州"),
    eq(err != null, true, "placePoints 讓國軍把點放進了共軍控制的鄭州"),
    settled(after, "結算"), eq(blueOf(after, "zhengzhou"), 1, "結算後鄭州(紅 4 藍 2)的藍"),
    ok(true, `共軍控制的空城鄭州:不亮、拒絕(「${err}」);紅 4 藍 2 的鄭州是孤城,結算 2→1`),
  );
});

check("經過 apply:打一張牌扶植進孤城被拒絕,legal 不列它;先打通就可以", () => {
  const t = supplyTodo(); if (t) return t;
  let st = position(JINAN_CUT);
  deal(st, KMT, ["score_north", "surrender_order"]); // a headline that needs no event, then a Nationalist 3-ops card
  st = E.apply(st, { type: "headline", side: KMT, card: "score_north" });
  const l = E.legal(st, KMT);
  if (l.kind !== "action") return `國軍沒有走到行動回合(legal = ${l.kind},phase ${st.phase})`;
  const card = l.cards.find((c) => c.id === "surrender_order");
  if (!card || !card.uses.place) return `受降令沒有扶植這個用法(${JSON.stringify(card && card.uses)})`;
  const opts = card.uses.place.options.map((o) => o.id);
  const play = (points) => E.apply(st, { type: "play", side: KMT, card: "surrender_order", use: "place", points });
  const err = thrown(() => play(["jinan"]));
  let after = null;
  const good = thrown(() => { after = play(["luzhong", "jinan"]); });
  if (good != null) return `先魯中後濟南被拒絕:${good}`;
  return all(
    eq(card.ops, 3, "受降令的行動點"), eq(opts.includes("jinan"), false, "legal 的扶植選項列了孤城濟南"), eq(opts.includes("xuzhou"), true, "legal 的扶植選項沒有徐州"),
    eq(err != null, true, "打受降令在濟南扶植沒有被拒絕"),
    eq(blueOf(after, "jinan"), 3, "先魯中後濟南,回合走完之後濟南的藍(路通了,結算不掉點)"), eq(blueOf(after, "luzhong"), 3, "魯中的藍"),
    settled(after, "打完牌之後"),
    ok(true, `打受降令直接扶植濟南被拒絕(「${err}」);魯中、濟南各 1 點可以,回合結算後濟南藍 3`),
  );
});

check("事件與免費放置不是扶植:place() 本身不看補給", () => {
  const t = supplyTodo(); if (t) return t;
  const st = position(JINAN_CUT);
  const pre = same(E.isolatedCities(st), ["jinan"], "孤城"); if (pre !== true) return pre;
  return all(eq(E.place(st, KMT, "jinan", 1), 1, "place() 放進孤城的點數"), eq(blueOf(st, "jinan"), 3, "濟南的藍"), ok(true, "place(國軍, 濟南, 1) 放了 1 點"));
});

check("回合結算:孤城藍 −1;別的城不動,被切斷的鄉不掉,紅不動", () => {
  const t = supplyTodo(); if (t) return t;
  const st = position(JINAN_CUT);
  const pre = all(same(E.isolatedCities(st), ["jinan"], "孤城"), eq(blueOf(st, "luzhong"), 2, "魯中的藍(被切斷的鄉)"));
  if (pre !== true) return pre;
  const after = settle(st);
  const others = Object.keys(SPEC_SPACES).filter((id) => id !== "jinan" && blueOf(st, id) > 0);
  const moved = others.filter((id) => blueOf(after, id) !== blueOf(st, id));
  return all(
    settled(after, "結算"), nonEmpty(others.length, "濟南以外有藍的據點"),
    eq(blueOf(after, "jinan"), 1, "結算後濟南的藍"),
    eq(blueOf(after, "luzhong"), 2, "結算後魯中的藍(鄉不檢查補給)"),
    eq(moved.length, 0, `濟南以外有 ${moved.length} 個據點的藍變了(${diff(blueMap(st), blueMap(after))})`),
    eq(diff(redMap(st), redMap(after)), "無", "紅的變動"),
    ok(true, `濟南 2→1;其餘 ${others.length} 個有藍的據點不動(含被切斷的魯中);紅不動`),
  );
});

check("回合結算:每座孤城各掉 1,掉到 0 為止;留下一筆 attrition 紀錄", () => {
  const t = supplyTodo(); if (t) return t;
  // 濟南 down to its last point; 西安 Communist (red 5, no blue) cuts 蘭州, whose only neighbour it is.
  const st = position({ ...JINAN_CUT, jinan: { b: 1 }, xian: { r: 5, b: 0 } });
  const pre = same(E.isolatedCities(st), ["jinan", "lanzhou"], "孤城"); if (pre !== true) return pre;
  const after = settle(st), logs = attritions(after), quiet = attritions(settle(position()));
  return all(
    settled(after, "結算"),
    eq(blueOf(after, "jinan"), 0, "結算後濟南的藍"), eq(blueOf(after, "lanzhou"), 1, "結算後蘭州的藍"),
    eq(total(after, KMT), total(st, KMT) - 2, `藍的合計(${diff(blueMap(st), blueMap(after))})`),
    eq(logs.length, 1, "attrition 紀錄的筆數"),
    eq(JSON.stringify(logs[0] && Object.entries(logs[0].losses || {}).sort()), JSON.stringify([["jinan", 1], ["lanzhou", 1]]), "attrition 紀錄的 losses"),
    eq(quiet.length, 0, "開局盤面(沒有孤城)的 attrition 紀錄筆數"),
    ok(true, "濟南 1→0、蘭州 2→1,合計 −2;log 一筆 { type: \"attrition\", losses: { jinan: 1, lanzhou: 1 } };沒有孤城時不記"),
  );
});

check("掉完點立即檢查標記:共軍因此控制蘭州,馬易幟,民心 +2", () => {
  const t = supplyTodo(); if (t) return t;
  const edits = { xian: { r: 5, b: 0 }, lanzhou: { r: 3, b: 1 } };
  const st = position(edits);
  const pre = all(same(E.isolatedCities(st), ["lanzhou"], "孤城"), eq(E.controller(st, "lanzhou"), null, "結算前蘭州的控制者"), eq(Object.keys(st.mie).length, 0, "結算前的易幟"), eq(st.mandate, 0, "結算前的民心"));
  if (pre !== true) return pre;
  const after = settle(st), off = settle(position(edits, { supply: false }));
  return all(
    settled(after, "結算"), settled(off, "supply 關掉的結算"),
    eq(off.mie.ma, undefined, "supply 關掉時馬的易幟(對照組)"),
    eq(blueOf(after, "lanzhou"), 0, "結算後蘭州的藍"), eq(E.controller(after, "lanzhou"), CCP, "結算後蘭州的控制者"),
    eq(after.mie.ma, true, "馬的易幟標記"), eq(after.mandate, SPEC.powers.ma[2], "民心"),
    ok(true, `蘭州 1→0,共軍控制,馬易幟,民心 ${after.mandate}`),
  );
});

check("掉完點立即檢查標記:共軍因此控制昆明,滇的整編移除", () => {
  const t = supplyTodo(); if (t) return t;
  // 桂林 Communist cuts 昆明. The 整編 marker was won earlier (blue at the cap) and stays until the Communists control the seat.
  const edits = { guilin: { r: 5, b: 0 }, kunming: { r: 3, b: 1 } };
  const sealed = (options) => { const s = position(edits, options); s.seals.dian = true; s.sealVp.dian = true; return s; };
  const st = sealed();
  const pre = all(same(E.isolatedCities(st), ["kunming"], "孤城"), eq(E.controller(st, "kunming"), null, "結算前昆明的控制者"));
  if (pre !== true) return pre;
  const after = settle(st), off = settle(sealed({ supply: false }));
  return all(
    settled(after, "結算"), settled(off, "supply 關掉的結算"),
    eq(off.seals.dian, true, "supply 關掉時滇的整編(對照組)"),
    eq(blueOf(after, "kunming"), 0, "結算後昆明的藍"), eq(E.controller(after, "kunming"), CCP, "結算後昆明的控制者"),
    eq(after.seals.dian, undefined, "滇的整編標記"),
    ok(true, "昆明 1→0,共軍控制,滇的整編移除"),
  );
});

check("順序:遷都判定在孤城之前;遷都後補給源是廣州,南京不再是", () => {
  const t = supplyTodo(); if (t) return t;
  // 南京 Communist (red 4, no blue), and no port in Nationalist control. Before the capital moves there is no
  // source at all, so every city with blue is cut off; after it moves, 廣州 supplies all of them.
  const st = position({ nanjing: { r: 4, b: 0 }, shanghai: { b: 2 }, tianjin: { b: 2 }, guangzhou: { b: 1 } });
  const blueCities = Object.keys(SPEC_SPACES).filter((id) => SPEC_SPACES[id][0] === "city" && blueOf(st, id) > 0);
  const pre = all(
    eq(E.controller(st, "nanjing"), CCP, "南京的控制者"), same(E.supplySources(st), ["nanjing"], "結算前的補給源"),
    nonEmpty(blueCities.length, "有藍的城"), same(E.isolatedCities(st), blueCities, "結算前的孤城(遷都之前每一座都是)"),
  );
  if (pre !== true) return pre;
  const after = settle(st);
  const r = all(
    settled(after, "結算"),
    eq(E.homeCapital(after, KMT), SPEC.moved.kmt, "結算後國軍的首都"), eq(after.mandate, 3, "民心(遷都,共軍 +3)"),
    same(E.supplySources(after), ["guangzhou"], "結算後的補給源"),
    eq(diff(blueMap(st), blueMap(after)), "無", "藍的變動(遷都之後沒有孤城)"),
    eq(attritions(after).length, 0, "attrition 紀錄的筆數"),
  );
  if (r !== true) return r;
  const back = E.clone(after); back.inf.nanjing = [0, 4];
  return all(
    eq(E.controller(back, "nanjing"), KMT, "國軍重新控制南京"),
    same(E.supplySources(back), ["guangzhou"], "國軍拿回南京之後的補給源"),
    ok(true, `遷都前 ${blueCities.length} 座有藍的城都是孤城;先遷都(南京 → 廣州),廣州供給,沒有一座掉點;南京拿回來也不是補給源`),
  );
});

check("順序(log):遷都判定 → 孤城藍 −1 → 回合結束的紀錄 → 終局結算;最後一回合也掉", () => {
  const t = supplyTodo(); if (t) return t;
  const st = position(JINAN_CUT, { turns: 1 });
  st.weariness = 3;
  const after = settle(st);
  if (after.winner == null) return `turns: 1 的對局沒有結束(turn ${after.turn},phase ${after.phase})`;
  const at = (pred) => after.log.findIndex(pred);
  const cap = after.log.map((l) => l.type).lastIndexOf("capitalCheck"), att = at((l) => l.type === "attrition"), end = at((l) => l.type === "endTurn"), score = at((l) => l.type === "score");
  return all(
    eq(blueOf(after, "jinan"), 1, "終局時濟南的藍"),
    eq(cap >= 0 && att >= 0 && end >= 0 && score >= 0, true, `四種紀錄都要有(capitalCheck ${cap}、attrition ${att}、endTurn ${end}、score ${score})`),
    eq(cap < att && att < end && end < score, true, `紀錄的順序(capitalCheck ${cap}、attrition ${att}、endTurn ${end}、score ${score})`),
    eq(after.log[end].weariness, 4, "endTurn 紀錄的民生(3 回復 1)"),
    ok(true, `log 的位置:遷都判定 ${cap} < 孤城 ${att} < 回合結束 ${end} < 終局結算 ${score}`),
  );
});

check("supply 是一個開關:預設開;關掉時兩個效果都沒有,讀數照常", () => {
  const t = supplyTodo(); if (t) return t;
  const off = position(JINAN_CUT, { supply: false });
  const after = settle(off);
  return all(
    eq(E.DEFAULT_OPTIONS.supply, true, "DEFAULT_OPTIONS.supply"),
    same(E.isolatedCities(off), ["jinan"], "supply 關掉時的讀數 isolatedCities"),
    eq(thrown(() => E.placePoints(E.clone(off), KMT, ["jinan"], 3)), null, "supply 關掉時國軍在濟南扶植被拒絕"),
    settled(after, "supply 關掉的結算"),
    eq(blueOf(after, "jinan"), 2, "supply 關掉時結算後濟南的藍"), eq(attritions(after).length, 0, "supply 關掉時的 attrition 紀錄"),
    ok(true, "supply: false 時濟南可以扶植、結算不掉點;isolatedCities 仍然讀得到濟南"),
  );
});

// ---------------------------------------------------------------- group 4
// 時局(機制 F), the asymmetric rounds and hand sizes, and the two support tracks the 時局 move
// (issue #2). Written before the work was handed out. The rulebook's words, copied by hand
// (三, 時局; 三, 回合結構; 三, 外國勢力 4; 三, 民生軌; 四, 細則):
//
//   1 受降      蘇軍佔領:東北三座城雙方都不能放點、不能奇襲。回合開始時免費放置(已有)。
//   2 停戰      回合開始時蘇軍撤離:蘇聯支持 ≥ 2 的話共軍先在東北任一據點免費放 2 點;然後國軍在東北的城
//               免費放 4 點。本回合第一個奇襲的一方,民心往對手移 2;若是國軍,美國支持再 −1。
//   3 全面進攻  美國支持 −1。國軍奇襲 +1。
//   4 重點進攻  國軍在西北、華東中原奇襲 +1,在其他區 −1。
//   5 戰略反攻  蘇聯支持 +1。共軍本回合一次扶植可以不受相鄰限制放進一個鄉;共軍對鄉的奇襲 +1。
//   6 行憲      國軍行憲軌 ≥ 2 的話美國支持 +1。國軍每推進行憲一格,民心往國軍移 1,但共軍在任一座
//               有藍的城放 1 點、不受相鄰限制。
//   7 決戰      蘇聯支持 +1。共軍對城的奇襲 +1,而且不推民生、不受封鎖。本回合孤城結算時藍 −2。
//   8 和談      美國支持 −2。共軍對城的奇襲不推民生、不受封鎖。回合開始時國軍可以棄 2 張手牌提和:
//               本回合雙方各只有 4 個行動回合;共軍可以拒絕:民心往國軍移 2,照常進行。
//   回合結構:1 時局(翻開,做它回合開始的效果)→ 2 補牌到手牌上限 → 3 標題 → 4 行動回合:共軍先,輪流,
//             回合數多的一方在最後連續行動。手牌 / 行動回合:接收期 國 9/7 共 8/6;易勢期 9/7、9/7;決戰期 國 8/6 共 9/7。
//   細則:第 1 回合東北三座城不能放點,包括事件與外援牌。國軍提和、共軍拒絕,各是一個要回答的決定,
//         在第 8 回合補牌之前。提和棄的 2 張牌事件不觸發,不能棄記分卡。
//   支持度:兩條軌各 0 到 4,美國支持開局 4,蘇聯支持開局 1。沒有牌介入的話,美國支持是
//           4、4、3、3、3、4、4、2,蘇聯支持是 1、1、1、1、2、2、3、3。
//
// How a later turn is reached. No card event exists yet, so a game cannot be played up to turn 5.
// `enter(n)` takes the turn-1 position, says "turn n−1 is over" by hand (turn, era, no lasting
// effects, the plan holding only `startTurn`) and lets the engine's own startTurn run turn n.
// So what a 時局 does must follow from the turn number and from what startTurn sets up, not from
// something left behind by an earlier turn. A side acts with cards of its own (no event fires);
// it reaches the action rounds by headlining a scoring card, which needs no event either.
section("4 時局(機制 F)、依期不對稱的回合、支持度軌");

const SPEC_SITUATIONS = [[1, "受降"], [2, "停戰"], [3, "全面進攻"], [4, "重點進攻"], [5, "戰略反攻"], [6, "行憲"], [7, "決戰"], [8, "和談"]];
// era: [from turn, hand size [共, 國], action rounds [共, 國]]
const SPEC_ERAS = { takeover: [1, [8, 9], [6, 7]], turning: [4, [9, 9], [7, 7]], decisive: [7, [9, 8], [7, 6]] };
// With 行憲軌 ≥ 2 at turn 6 and no card: 美國支持, 蘇聯支持, turn by turn.
const SPEC_US = [4, 4, 3, 3, 3, 4, 4, 2], SPEC_SU = [1, 1, 1, 1, 2, 2, 3, 3];
const NE_CITIES = ["changchun", "shenyang", "jinzhou"], NE_ALL = ["beiman", "changchun", "siping", "shenyang", "liaoxi", "jinzhou"];
const STOP = [[], ["score_east"]]; // a card the Nationalists must headline: the walk stops right after startTurn

const sitTodo = () => (E.SITUATIONS === undefined ? "TODO: E.SITUATIONS 還沒有;時局只有第 1 回合的免費放置,回合數與手牌還是縱橫的對稱數字,沒有支持度軌" : null);
const J = (x) => JSON.stringify(x ?? null);
const sideZh = (s) => (s === CCP ? "共軍" : s === KMT ? "國軍" : String(s));
const rb = (st, id) => E.infOf(st, id).join("/"); // "紅/藍"
const pendingIs = (st, who, kind, what) => {
  const p = st.pending;
  if (p && p.who === who && p.kind === kind) return true;
  return `${what}:期望 ${sideZh(who)} 的 ${kind} 決定,實際 ${p ? `${sideZh(p.who)} 的 ${p.kind}(tag ${p.tag})` : `沒有待決定(turn ${st.turn},phase ${st.phase},winner ${st.winner})`}`;
};
const choose = (st, choice) => E.apply(st, { type: "choose", side: st.pending.who, choice });
const act = (st, side, card, use, extra = {}) => E.apply(st, { type: "play", side, card, use, ...extra });
function enter(turn, { edits = {}, options = {}, hands = [[], []], support = null, reform = null, weariness = null, refill = false } = {}) {
  const st = position(edits, options);
  st.turn = turn - 1; st.round = 0; st.effects = [];
  if (refill) { st.era = E.eraOf(Math.max(1, turn - 1)).id; st.draw = st.draw.concat(st.discard); st.discard = []; }
  else { st.era = E.eraOf(turn).id; st.draw = []; st.discard = []; st.later = {}; }
  for (const side of [CCP, KMT]) if (hands[side].length) deal(st, side, hands[side]);
  if (support) st.support = support.slice();
  if (reform) st.reform = reform.slice();
  if (weariness != null) st.weariness = weariness;
  st.phase = "action"; st.pending = null; st.plan = [{ do: "startTurn" }];
  return E.run(st);
}
// Each side that holds a scoring card headlines it; returns the state at the first action round.
function toAction(st) {
  if (st.pending) throw new Error(`toAction:還有待決定(${sideZh(st.pending.who)} 的 ${st.pending.kind},tag ${st.pending.tag})`);
  for (const side of [CCP, KMT]) { const c = st.hands[side].find((x) => E.CARD[x].scoring); if (c) st = E.apply(st, { type: "headline", side, card: c }); }
  if (st.phase !== "action") throw new Error(`toAction:沒有走到行動回合(turn ${st.turn},phase ${st.phase})`);
  return st;
}
// Who was skipped, in order, in the action rounds of a turn nobody had a card in: "共國共國…".
const roundsOf = (st, turn) => {
  const es = st.log.filter((l) => l.t === turn), h = es.findIndex((l) => l.type === "headline");
  return h < 0 ? `(第 ${turn} 回合沒有 headline 紀錄)` : es.slice(h + 1).filter((l) => l.type === "skip").map((l) => (l.side === CCP ? "共" : "國")).join("");
};
const seq = ([c, k]) => "共國".repeat(Math.min(c, k)) + (c > k ? "共" : "國").repeat(Math.abs(c - k));
const lens = (st) => J(st.hands.map((h) => h.length));

check("常數:八張時局的回合與名稱;三期的手牌上限與行動回合數(共、國)", () => {
  const t = sitTodo(); if (t) return t;
  const r = all(
    eq(J(E.SITUATIONS.map((s) => [s.turn, s.zh])), J(SPEC_SITUATIONS), "時局的回合與名稱"),
    eq(new Set(E.SITUATIONS.map((s) => s.id)).size, 8, "時局不重複的 id"),
    eq(E.SITUATIONS.every((s) => typeof s.id === "string" && typeof s.en === "string" && s.en.length > 0), true, "每張時局都有 id 和英文名"),
    same(E.ERAS.map((e) => e.id), Object.keys(SPEC_ERAS), "三期的 id"),
  );
  if (r !== true) return r;
  for (const e of E.ERAS) {
    const [from, hand, rounds] = SPEC_ERAS[e.id];
    const q = all(eq(e.from, from, `${e.zh} 的起始回合`), eq(J(e.hand), J(hand), `${e.zh} 的手牌上限 [共, 國]`), eq(J(e.rounds), J(rounds), `${e.zh} 的行動回合數 [共, 國]`));
    if (q !== true) return q;
  }
  return ok(true, `${E.SITUATIONS.map((s) => s.zh).join("、")};手牌 ${E.ERAS.map((e) => e.hand.join("/")).join("、")};行動回合 ${E.ERAS.map((e) => e.rounds.join("/")).join("、")}(共/國)`);
});

check("開局:美國支持 4、蘇聯支持 1;手牌 共 8 國 9;行動回合 共 6 國 7", () => {
  const t = sitTodo(); if (t) return t;
  let st = E.createGame(5);
  const first = J(st.support);
  st = E.apply(st, { type: "choose", side: CCP, choice: st.pending.options.slice(0, SPEC.free.ccp) });
  st = E.apply(st, { type: "choose", side: KMT, choice: st.pending.options.slice(0, SPEC.free.kmt) });
  return all(
    eq(first, "[1,4]", "createGame 之後的支持度 [蘇聯, 美國]"), eq(J(st.support), "[1,4]", "免費放置之後的支持度"),
    eq(st.phase, "headline", "phase"), eq(lens(st), "[8,9]", "手牌 [共, 國]"), eq(J(st.rounds), "[6,7]", "st.rounds [共, 國]"),
    ok(true, `支持度 ${J(st.support)}(蘇聯、美國);手牌 ${lens(st)};行動回合 ${J(st.rounds)}`),
  );
});

check("補牌:第 4 回合 共 9 國 9、行動回合 7/7,易勢期牌庫洗入;第 7 回合 共 9 國 8、行動回合 7/6", () => {
  const t = sitTodo(); if (t) return t;
  const t4 = enter(4, { refill: true }), t7 = enter(7, { refill: true });
  return all(
    eq(t4.turn, 4, "回合"), eq(t4.phase, "headline", "第 4 回合補牌後的 phase"), eq(t4.era, "turning", "第 4 回合的期"),
    eq(t4.later.turning, undefined, "易勢期牌庫還留在 later 裡"), eq(lens(t4), "[9,9]", "第 4 回合的手牌 [共, 國]"), eq(J(t4.rounds), "[7,7]", "第 4 回合的行動回合"),
    eq(t7.turn, 7, "回合"), eq(t7.era, "decisive", "第 7 回合的期"), eq(t7.later.decisive, undefined, "決戰期牌庫還留在 later 裡"),
    eq(lens(t7), "[9,8]", "第 7 回合的手牌 [共, 國]"), eq(J(t7.rounds), "[7,6]", "第 7 回合的行動回合"),
    ok(true, `第 4 回合 手牌 ${lens(t4)} 回合 ${J(t4.rounds)};第 7 回合 手牌 ${lens(t7)} 回合 ${J(t7.rounds)}`),
  );
});

check("空手走完八回合:支持度每回合照表;行動順序共軍先、多的一方在最後連續行動", () => {
  const t = sitTodo(); if (t) return t;
  const seen = [], prev = E.probe.turnEnd;
  let st = position();
  st.draw = []; st.discard = []; st.later = {}; // nothing to deal: nobody ever holds a card
  st.reform = [0, 2];                            // 行憲軌 2, so that turn 6 gives its +1 (the rulebook's own line of numbers)
  try {
    E.probe.turnEnd = (s) => { seen.push([s.turn, s.support ? s.support[KMT] : null, s.support ? s.support[CCP] : null]); };
    st = E.run(E.clone(st));
    const p = pendingIs(st, KMT, "points", "第 2 回合開始(蘇軍撤離)"); if (p !== true) return p;
    st = choose(st, ["shenyang", "shenyang", "jinzhou", "jinzhou"]);
  } finally { E.probe.turnEnd = prev; }
  if (st.winner == null) return `對局沒有走完(turn ${st.turn},phase ${st.phase},pending ${J(st.pending && { who: st.pending.who, kind: st.pending.kind, tag: st.pending.tag })})`;
  const r = all(
    eq(J(seen.map((x) => x[0])), J([1, 2, 3, 4, 5, 6, 7, 8]), "走過的回合"),
    eq(J(seen.map((x) => x[1])), J(SPEC_US), "美國支持,逐回合"), eq(J(seen.map((x) => x[2])), J(SPEC_SU), "蘇聯支持,逐回合"),
    eq(["final", "tie"].includes(st.reason), true, `結束的理由(${st.reason})`),
  );
  if (r !== true) return r;
  for (let turn = 1; turn <= 8; turn++) {
    const [, , rounds] = SPEC_ERAS[turn >= 7 ? "decisive" : turn >= 4 ? "turning" : "takeover"];
    const q = eq(roundsOf(st, turn), seq(rounds), `第 ${turn} 回合的行動順序`); if (q !== true) return q;
  }
  return ok(true, `美國支持 ${SPEC_US.join("")}、蘇聯支持 ${SPEC_SU.join("")};第 1 回合 ${roundsOf(st, 1)},第 4 回合 ${roundsOf(st, 4)},第 7 回合 ${roundsOf(st, 7)};結束:${st.reason}`);
});

check("支持度軌夾在 0 到 4", () => {
  const t = sitTodo(); if (t) return t;
  const a = enter(3, { support: [1, 0], hands: STOP }), b = enter(5, { support: [4, 4], hands: STOP }), c = enter(8, { support: [1, 1], hands: STOP }), d = enter(6, { support: [1, 4], reform: [0, 2], hands: STOP });
  return all(
    eq(a.turn, 3, "回合"), eq(J(a.support), "[1,0]", "第 3 回合,美國支持 0 再 −1"),
    eq(J(b.support), "[4,4]", "第 5 回合,蘇聯支持 4 再 +1"),
    eq(J(c.support), "[1,0]", "第 8 回合,美國支持 1 再 −2"),
    eq(J(d.support), "[1,4]", "第 6 回合,美國支持 4 再 +1"),
    ok(true, "0 再減還是 0,4 再加還是 4"),
  );
});

check("受降:第 1 回合東北三座城雙方都不能放點,扶植與 place() 都不行;東北的鄉可以;第 2 回合起可以", () => {
  const t = sitTodo(); if (t) return t;
  const t1 = position(), t2 = enter(2, { hands: STOP });
  const pre = all(
    eq(t1.turn, 1, "回合"), eq(E.canPlaceAt(t1, CCP, "changchun"), true, "長春在共軍的相鄰範圍內(北滿有紅)"), eq(E.canPlaceAt(t1, KMT, "jinzhou"), true, "錦州在國軍的相鄰範圍內(天津有藍)"),
    eq(t2.turn, 2, "對照組的回合"),
    eq(E.placeTargets(t2, CCP, 2).lit.has("changchun"), true, "第 2 回合共軍可以扶植長春(對照組)"), eq(E.placeTargets(t2, KMT, 2).lit.has("jinzhou"), true, "第 2 回合國軍可以扶植錦州(對照組)"),
    eq(E.place(E.clone(t2), CCP, "changchun", 1), 1, "第 2 回合 place(共軍, 長春)(對照組)"), eq(E.place(E.clone(t2), KMT, "jinzhou", 1), 1, "第 2 回合 place(國軍, 錦州)(對照組)"),
  );
  if (pre !== true) return pre;
  const c = E.placeTargets(t1, CCP, 2).lit, k = E.placeTargets(t1, KMT, 2).lit;
  const oc = E.opsOptions(t1, CCP).placeOptions.map((o) => o.id), okk = E.opsOptions(t1, KMT).placeOptions.map((o) => o.id);
  return all(
    eq(c.has("changchun"), false, "第 1 回合 placeTargets 亮了長春(共軍)"), eq(c.has("siping"), true, "第 1 回合共軍可以扶植東北的鄉(四平)"),
    eq(k.has("jinzhou"), false, "第 1 回合 placeTargets 亮了錦州(國軍)"), eq(k.has("tianjin"), true, "第 1 回合國軍可以扶植天津"),
    eq(oc.includes("changchun"), false, "opsOptions 列了長春(共軍)"), eq(okk.includes("jinzhou"), false, "opsOptions 列了錦州(國軍)"),
    eq(thrown(() => E.placePoints(E.clone(t1), CCP, ["changchun"], 2)) != null, true, "placePoints 沒有拒絕共軍放進長春"),
    eq(thrown(() => E.placePoints(E.clone(t1), KMT, ["jinzhou"], 2)) != null, true, "placePoints 沒有拒絕國軍放進錦州"),
    eq(E.place(E.clone(t1), CCP, "changchun", 1), 0, "第 1 回合 place(共軍, 長春) 放進去的點數(事件也不行)"),
    eq(E.place(E.clone(t1), KMT, "jinzhou", 1), 0, "第 1 回合 place(國軍, 錦州) 放進去的點數"),
    eq(E.place(E.clone(t1), CCP, "siping", 1), 1, "第 1 回合 place(共軍, 四平)"),
    ok(true, "第 1 回合長春、錦州兩邊都放不進去(扶植不亮、不列、拒絕,place() 回 0);四平、天津照常;第 2 回合都可以"),
  );
});

check("受降:第 1 回合東北的城不能奇襲;第 2 回合起可以", () => {
  const t = sitTodo(); if (t) return t;
  // Red in 瀋陽 and blue in 錦州 cannot come about in play on turn 1; they are put there to have something to attack.
  const edits = { shenyang: { r: 1 }, jinzhou: { b: 1 } };
  let t1 = position(edits);
  deal(t1, KMT, ["score_east", "kunming_incident"]);
  t1 = toAction(t1);
  const t2 = enter(2, { edits, hands: STOP });
  const pre = all(
    eq(t1.turn, 1, "回合"), eq(E.legal(t1, KMT).kind, "action", "國軍在第 1 回合的行動回合"),
    eq(E.opsOptions(t2, KMT).campaignTargets.includes("shenyang"), true, "第 2 回合國軍可以奇襲瀋陽(對照組)"),
    eq(E.opsOptions(t2, CCP).campaignTargets.includes("jinzhou"), true, "第 2 回合共軍可以奇襲錦州(對照組)"),
  );
  if (pre !== true) return pre;
  const kt = E.opsOptions(t1, KMT).campaignTargets, ct = E.opsOptions(t1, CCP).campaignTargets;
  const err = thrown(() => act(t1, KMT, "kunming_incident", "campaign", { target: "shenyang" }));
  return all(
    eq(kt.includes("shenyang"), false, "第 1 回合國軍的奇襲目標有瀋陽"), eq(kt.includes("jizhong"), true, "第 1 回合國軍的奇襲目標沒有冀中"),
    eq(ct.includes("jinzhou"), false, "第 1 回合共軍的奇襲目標有錦州"), eq(ct.includes("tianjin"), true, "第 1 回合共軍的奇襲目標沒有天津"),
    ok(err != null, err == null ? "第 1 回合國軍打出昆明事變奇襲瀋陽沒有被拒絕" : `第 1 回合瀋陽、錦州不在奇襲目標裡,奇襲瀋陽被拒絕(「${err}」);第 2 回合可以`),
  );
});

check("停戰:蘇軍撤離,國軍在東北的城免費放 4 點、不受相鄰限制;蘇聯支持 1 時共軍不放", () => {
  const t = sitTodo(); if (t) return t;
  const st = enter(2, { hands: STOP });
  const p = pendingIs(st, KMT, "points", "第 2 回合開始"); if (p !== true) return p;
  const pre = all(
    eq(st.turn, 2, "回合"), eq(st.pending.n, 4, "國軍要放的點數"), same(st.pending.options, NE_CITIES, "國軍可以放的據點"),
    eq(total(st, CCP), SPEC.startRed, "紅的合計(蘇聯支持 1,共軍不放)"),
    eq(E.canPlaceAt(st, KMT, "changchun"), false, "長春在國軍的相鄰範圍內"), eq(E.canPlaceAt(st, KMT, "shenyang"), false, "瀋陽在國軍的相鄰範圍內"),
  );
  if (pre !== true) return pre;
  const after = choose(st, ["changchun", "shenyang", "shenyang", "jinzhou"]);
  return all(
    eq(thrown(() => choose(st, ["tianjin", "shenyang", "shenyang", "jinzhou"])) != null, true, "放在天津(不是東北的城)沒有被拒絕"),
    eq(thrown(() => choose(st, ["siping", "shenyang", "shenyang", "jinzhou"])) != null, true, "放在四平(東北的鄉)沒有被拒絕"),
    eq(thrown(() => choose(st, ["shenyang", "jinzhou"])) != null, true, "只放 2 點沒有被拒絕"),
    eq(`${blueOf(after, "changchun")},${blueOf(after, "shenyang")},${blueOf(after, "jinzhou")}`, "1,2,1", "長春、瀋陽、錦州的藍"),
    eq(total(after, KMT), SPEC.startBlue + 4, "藍的合計"), eq(total(after, CCP), SPEC.startRed, "紅的合計"),
    eq(after.pending, null, "放完之後還有待決定"), eq(after.phase, "headline", "放完之後的 phase"), eq(after.turn, 2, "回合"),
    ok(true, "國軍在長春 1、瀋陽 2、錦州 1(都不相鄰也可以);共軍沒有放;接著是標題階段"),
  );
});

check("停戰:蘇聯支持 ≥ 2 時共軍先在東北任一據點放 2 點(同一個據點、到上限為止),然後才是國軍", () => {
  const t = sitTodo(); if (t) return t;
  const st = enter(2, { support: [2, 4], hands: STOP });
  const p = pendingIs(st, CCP, "points", "第 2 回合開始,蘇聯支持 2"); if (p !== true) return p;
  const pre = all(eq(st.pending.n, 1, "共軍選的據點數"), same(st.pending.options, NE_ALL, "共軍可以選的據點"), eq(total(st, KMT), SPEC.startBlue, "國軍還沒有放"));
  if (pre !== true) return pre;
  const a = choose(st, ["shenyang"]);
  const q = pendingIs(a, KMT, "points", "共軍放完之後"); if (q !== true) return q;
  const full = enter(2, { support: [2, 4], edits: { beiman: { r: 4 } }, hands: STOP });
  const p2 = pendingIs(full, CCP, "points", "北滿紅 4 的盤面"); if (p2 !== true) return p2;
  const b = choose(full, ["beiman"]), village = choose(st, ["liaoxi"]);
  return all(
    eq(thrown(() => choose(st, ["shenyang", "liaoxi"])) != null, true, "共軍選兩個據點沒有被拒絕"),
    eq(thrown(() => choose(st, ["tianjin"])) != null, true, "共軍選天津沒有被拒絕"),
    eq(diff(redMap(st), redMap(a)), "瀋陽 0→2", "紅的變動(選瀋陽)"), eq(diff(redMap(st), redMap(village)), "遼西 0→2", "紅的變動(選遼西)"),
    eq(a.pending.n, 4, "國軍要放的點數"), same(a.pending.options, NE_CITIES, "國軍可以放的據點"),
    eq(redOf(b, "beiman"), 5, "北滿紅 4(上限 5)再放 2 之後"),
    ok(true, "共軍先選一個東北據點放 2(瀋陽 0→2;遼西 0→2;北滿 4→5 到上限),然後國軍放 4"),
  );
});

check("停戰:時局在補牌之前", () => {
  const t = sitTodo(); if (t) return t;
  const st = enter(2, { refill: true });
  const p = pendingIs(st, KMT, "points", "第 2 回合開始"); if (p !== true) return p;
  const before = lens(st), after = choose(st, ["shenyang", "shenyang", "jinzhou", "jinzhou"]);
  return all(eq(before, "[0,0]", "國軍放點時的手牌(還沒補牌)"), eq(lens(after), "[8,9]", "放完之後的手牌"), eq(after.phase, "headline", "phase"), ok(true, `放點時手牌 ${before},放完補到 ${lens(after)}`));
});

check("停戰:本回合第一個奇襲的是國軍,民心往共軍移 2、美國支持 −1;第二次奇襲沒有事", () => {
  const t = sitTodo(); if (t) return t;
  let st = enter(2, { hands: [[], ["score_east", "kunming_incident", "return_to_nanjing", "sino_soviet_treaty"]] });
  const p = pendingIs(st, KMT, "points", "第 2 回合開始"); if (p !== true) return p;
  st = toAction(choose(st, ["shenyang", "shenyang", "jinzhou", "jinzhou"]));
  const m0 = st.mandate;
  const pre = all(eq(J(st.support), "[1,4]", "奇襲之前的支持度"), eq(rb(st, "jizhong"), "2/0", "冀中 紅/藍"), eq(rb(st, "dabieshan"), "2/2", "大別山 紅/藍"));
  if (pre !== true) return pre;
  const a = act(st, KMT, "kunming_incident", "campaign", { target: "jizhong" });
  const b = act(a, KMT, "return_to_nanjing", "campaign", { target: "dabieshan" });
  return all(
    eq(rb(a, "jizhong"), "0/0", "國軍 2 點奇襲冀中之後 紅/藍"),
    eq(a.mandate - m0, 2, "第一次奇襲後民心的變動(正 = 往共軍)"), eq(J(a.support), "[1,3]", "第一次奇襲後的支持度"),
    eq(rb(b, "dabieshan"), "0/2", "國軍 2 點奇襲大別山之後 紅/藍"),
    eq(b.mandate - a.mandate, 0, "第二次奇襲後民心的變動"), eq(J(b.support), "[1,3]", "第二次奇襲後的支持度"),
    ok(true, "國軍先動手:民心往共軍 2、美國支持 4→3;同一回合再奇襲一次,兩個都不再動"),
  );
});

check("停戰:第一個奇襲的是共軍,民心往國軍移 2、美國支持不動;之後國軍奇襲沒有事;直接呼叫 campaign() 也算", () => {
  const t = sitTodo(); if (t) return t;
  let st = enter(2, { hands: [["score_north", "gao_shuxun"], ["score_east", "kunming_incident", "sino_soviet_treaty"]] });
  const p = pendingIs(st, KMT, "points", "第 2 回合開始"); if (p !== true) return p;
  st = toAction(choose(st, ["shenyang", "shenyang", "jinzhou", "jinzhou"]));
  const m0 = st.mandate;
  const a = act(st, CCP, "gao_shuxun", "campaign", { target: "chasui" });
  const b = act(a, KMT, "kunming_incident", "campaign", { target: "jizhong" });
  // The road an event will take (四平攻克 and the like call campaign() themselves).
  const s = E.clone(st); E.campaign(s, KMT, "jizhong", 2);
  return all(
    eq(rb(a, "chasui"), "2/0", "共軍 2 點奇襲察綏之後 紅/藍"),
    eq(a.mandate - m0, -2, "共軍先奇襲後民心的變動(負 = 往國軍)"), eq(J(a.support), "[1,4]", "共軍先奇襲後的支持度"),
    eq(b.mandate - a.mandate, 0, "之後國軍奇襲,民心的變動"), eq(J(b.support), "[1,4]", "之後國軍奇襲的支持度"),
    eq(s.mandate - m0, 2, "直接呼叫 campaign(國軍) 後民心的變動"), eq(J(s.support), "[1,3]", "直接呼叫 campaign(國軍) 後的支持度"),
    ok(true, "共軍先動手:民心往國軍 2、美國支持不動;國軍接著奇襲沒有罰;campaign() 直接呼叫(事件的路)一樣算第一個"),
  );
});

check("全面進攻:美國支持 −1;國軍奇襲 +1,共軍不加;沒有停戰的罰則", () => {
  const t = sitTodo(); if (t) return t;
  let st = enter(3, { hands: [["score_north", "gao_shuxun"], ["score_east", "kunming_incident", "sino_soviet_treaty"]] });
  const sup = J(st.support);
  st = toAction(st);
  const m0 = st.mandate;
  const a = act(st, CCP, "gao_shuxun", "campaign", { target: "chasui" });
  const b = act(a, KMT, "kunming_incident", "campaign", { target: "jizhong" });
  return all(
    eq(st.turn, 3, "回合"), eq(sup, "[1,3]", "第 3 回合開始後的支持度"),
    eq(rb(st, "chasui"), "2/2", "察綏 紅/藍"), eq(rb(a, "chasui"), "2/0", "共軍 2 點奇襲察綏(不加)之後 紅/藍"),
    eq(rb(st, "jizhong"), "2/0", "冀中 紅/藍"), eq(rb(b, "jizhong"), "0/1", "國軍 2 點奇襲冀中(+1:移除 2、放 1)之後 紅/藍"),
    eq(b.mandate - m0, 0, "兩次奇襲後民心的變動"), eq(J(b.support), "[1,3]", "兩次奇襲後的支持度"),
    ok(true, "美國支持 4→3;共軍 2 點打察綏 2/2→2/0;國軍 2 點打冀中 2/0→0/1;民心不動"),
  );
});

check("重點進攻:國軍在西北、華東中原奇襲 +1,在其他區 −1", () => {
  const t = sitTodo(); if (t) return t;
  let st = enter(4, { support: [1, 3], hands: [[], ["score_east", "kunming_incident", "return_to_nanjing", "sino_soviet_treaty", "takeover_officials"]] });
  const sup = J(st.support);
  st = toAction(st);
  const pre = all(eq(st.turn, 4, "回合"), eq(sup, "[1,3]", "第 4 回合開始後的支持度(不動)"), eq(rb(st, "shanbei"), "4/0", "陝北 紅/藍"), eq(rb(st, "luzhong"), "3/2", "魯中 紅/藍"), eq(rb(st, "jizhong"), "2/0", "冀中 紅/藍"));
  if (pre !== true) return pre;
  const a = act(st, KMT, "kunming_incident", "campaign", { target: "shanbei" });
  const b = act(a, KMT, "return_to_nanjing", "campaign", { target: "luzhong" });
  const c = act(b, KMT, "sino_soviet_treaty", "campaign", { target: "jizhong" });
  return all(
    eq(rb(a, "shanbei"), "1/0", "西北:2 點 +1 奇襲陝北之後 紅/藍"),
    eq(rb(b, "luzhong"), "0/2", "華東中原:2 點 +1 奇襲魯中之後 紅/藍"),
    eq(rb(c, "jizhong"), "1/0", "華北:2 點 −1 奇襲冀中之後 紅/藍"),
    ok(true, "陝北 4/0→1/0(3 點)、魯中 3/2→0/2(3 點)、冀中 2/0→1/0(1 點)"),
  );
});

check("戰略反攻:蘇聯支持 +1;共軍對鄉的奇襲 +1,對城不加;國軍不加", () => {
  const t = sitTodo(); if (t) return t;
  let st = enter(5, { support: [1, 3], hands: [["score_north", "gao_shuxun", "shangdang_campaign"], ["score_east", "kunming_incident", "sino_soviet_treaty"]] });
  const sup = J(st.support);
  st = toAction(st);
  const pre = all(eq(st.turn, 5, "回合"), eq(sup, "[2,3]", "第 5 回合開始後的支持度"), eq(rb(st, "dabieshan"), "2/2", "大別山 紅/藍"), eq(rb(st, "zhengzhou"), "0/2", "鄭州 紅/藍"));
  if (pre !== true) return pre;
  const a = act(st, CCP, "gao_shuxun", "campaign", { target: "dabieshan" });
  const b = act(a, KMT, "kunming_incident", "campaign", { target: "jizhong" });
  const c = act(b, CCP, "shangdang_campaign", "campaign", { target: "zhengzhou" });
  return all(
    eq(rb(a, "dabieshan"), "3/0", "共軍 2 點奇襲大別山(鄉,+1:移除 2、放 1)之後 紅/藍"),
    eq(rb(b, "jizhong"), "0/0", "國軍 2 點奇襲冀中(不加)之後 紅/藍"),
    eq(rb(c, "zhengzhou"), "0/0", "共軍 2 點奇襲鄭州(城,不加)之後 紅/藍"),
    ok(true, "蘇聯支持 1→2;共軍打鄉 2/2→3/0;國軍打鄉 2/0→0/0;共軍打城 0/2→0/0"),
  );
});

check("戰略反攻:共軍一次扶植可以不受相鄰限制放進一個鄉(一回合一次、只一個鄉、國軍沒有)", () => {
  const t = sitTodo(); if (t) return t;
  // With 淮海 and 大別山 cleared of red, the villages out of the Communists' reach are 遼西 and 大別山.
  const edits = { huaihai: { r: 0 }, dabieshan: { r: 0 } }, hands = [["score_north", "into_manchuria", "soviet_arms"], []];
  const S = toAction(enter(5, { edits, hands })), four = toAction(enter(4, { edits, hands }));
  const pre = all(
    eq(S.turn, 5, "回合"), eq(E.canPlaceAt(S, CCP, "liaoxi"), false, "遼西在共軍的相鄰範圍內"), eq(E.canPlaceAt(S, CCP, "dabieshan"), false, "大別山在共軍的相鄰範圍內"),
    eq(E.canPlaceAt(S, CCP, "shenyang"), false, "瀋陽在共軍的相鄰範圍內"), eq(E.canPlaceAt(S, KMT, "liaoxi"), false, "遼西在國軍的相鄰範圍內"),
    eq(E.placeTargets(four, CCP, 3).lit.has("liaoxi"), false, "第 4 回合就亮了遼西(對照組)"), eq(E.placeTargets(four, CCP, 3).lit.has("dabieshan"), false, "第 4 回合就亮了大別山(對照組)"),
  );
  if (pre !== true) return pre;
  const T = E.placeTargets(S, CCP, 3), T2 = E.placeTargets(S, CCP, 3, ["liaoxi"]), opts = E.opsOptions(S, CCP).placeOptions.map((o) => o.id);
  const r = all(
    eq(T.lit.has("liaoxi"), true, "遼西沒有亮"), eq(T.lit.has("dabieshan"), true, "大別山沒有亮"), eq(T.costs.liaoxi, 1, "遼西每點的花費"), eq(T.costs.dabieshan, 2, "大別山每點的花費(國軍控制)"),
    eq(T.lit.has("shenyang"), false, "相鄰範圍外的城(瀋陽)亮了"),
    eq(opts.includes("liaoxi") && opts.includes("dabieshan"), true, "opsOptions 沒有列遼西和大別山"),
    eq(T2.lit.has("liaoxi"), true, "放了遼西 1 點之後遼西不亮了"), eq(T2.lit.has("dabieshan"), false, "放了遼西之後大別山還亮(只能一個鄉)"), eq(T2.lit.has("taihang"), true, "放了遼西之後太行不亮了"),
    eq(thrown(() => E.placePoints(E.clone(S), CCP, ["liaoxi", "dabieshan"], 3)) != null, true, "同一次扶植跳進兩個鄉沒有被拒絕"),
    eq(E.placeTargets(S, KMT, 3).lit.has("liaoxi"), false, "國軍也能跳進遼西"),
  );
  if (r !== true) return r;
  const S2 = act(S, CCP, "into_manchuria", "place", { points: ["liaoxi", "liaoxi", "taihang"] });
  const T3 = E.placeTargets(S2, CCP, 3);
  return all(
    eq(redOf(S2, "liaoxi"), 2, "遼西的紅"), eq(redOf(S2, "taihang"), 5, "太行的紅"),
    eq(E.legal(S2, CCP).kind, "action", "共軍的下一個行動回合"),
    eq(T3.lit.has("dabieshan"), false, "用過一次之後大別山還亮"), eq(T3.lit.has("shenyang"), true, "遼西有紅之後瀋陽(相鄰)沒有亮"),
    eq(thrown(() => act(S2, CCP, "soviet_arms", "place", { points: ["dabieshan"] })) != null, true, "同一回合第二次跳進鄉沒有被拒絕"),
    ok(true, "遼西、大別山都亮;選了遼西之後大別山熄掉;遼西 2 + 太行 1 可以;下一次扶植大別山不亮、被拒絕,瀋陽因為相鄰遼西而亮"),
  );
});

check("行憲:回合開始時國軍行憲軌 ≥ 2 才美國支持 +1", () => {
  const t = sitTodo(); if (t) return t;
  const a = enter(6, { support: [1, 3], reform: [0, 2], hands: STOP }), b = enter(6, { support: [1, 3], reform: [0, 1], hands: STOP }), c = enter(6, { support: [1, 3], reform: [2, 0], hands: STOP });
  return all(
    eq(a.turn, 6, "回合"), eq(J(a.support), "[1,4]", "行憲軌 2"), eq(J(b.support), "[1,3]", "行憲軌 1"), eq(J(c.support), "[1,3]", "建軍軌 2、行憲軌 0"),
    ok(true, "行憲軌 2:3→4;行憲軌 1:不動;共軍的建軍軌不算"),
  );
});

check("行憲:國軍每推進一格,民心往國軍多移 1,共軍在任一座有藍的城放 1 點、不受相鄰限制", () => {
  const t = sitTodo(); if (t) return t;
  const edits = { zhengzhou: { b: 0 } }, hands = [[], ["score_east", "kunming_incident", "sino_soviet_treaty"]];
  const six = toAction(enter(6, { edits, hands })), five = toAction(enter(5, { edits, hands }));
  // What the same advance is worth on a turn without this 時局 (the track's own reward) is measured on turn 5.
  const a5 = act(five, KMT, "kunming_incident", "reform"), d5 = a5.mandate - five.mandate;
  const pre = all(eq(six.turn, 6, "回合"), eq(a5.reform[KMT], 1, "第 5 回合推進後的行憲軌"), eq(a5.pending, null, "第 5 回合推進後有待決定(對照組)"), eq(E.canPlaceAt(six, CCP, "kunming"), false, "昆明在共軍的相鄰範圍內"));
  if (pre !== true) return pre;
  const a6 = act(six, KMT, "kunming_incident", "reform");
  const p = pendingIs(a6, CCP, "points", "國軍在第 6 回合推進行憲之後"); if (p !== true) return p;
  const blueCities = Object.keys(SPEC_SPACES).filter((id) => SPEC_SPACES[id][0] === "city" && blueOf(six, id) > 0);
  const o = same(a6.pending.options, blueCities, "共軍可以放的城(有藍的城,相鄰與否都算;鄭州沒有藍、東北是空的)"); if (o !== true) return o;
  const b = choose(a6, ["kunming"]);
  return all(
    eq(a6.reform[KMT], 1, "行憲軌"), eq(a6.mandate - six.mandate, d5 - 1, `民心的變動(第 5 回合同一步是 ${d5};負 = 往國軍)`),
    eq(a6.pending.n, 1, "共軍放的點數"), nonEmpty(blueCities.length, "有藍的城"), same(a6.pending.options, blueCities, "共軍可以放的城(有藍的城;鄭州沒有藍、東北是空的)"),
    eq(redOf(b, "kunming"), 1, "共軍選昆明之後昆明的紅"), eq(total(b, CCP), total(six, CCP) + 1, "紅的合計"), eq(b.pending, null, "放完之後還有待決定"),
    ok(true, `民心 ${d5 - 1}(平常 ${d5});共軍在 ${blueCities.length} 座有藍的城裡選了昆明(不相鄰)放 1`),
  );
});

check("行憲:事件推進(直接呼叫 reformAdvance)一樣觸發;共軍推進建軍沒有這個效果", () => {
  const t = sitTodo(); if (t) return t;
  const kh = [[], ["score_east", "kunming_incident", "sino_soviet_treaty"]];
  const six = toAction(enter(6, { hands: kh })), five = toAction(enter(5, { hands: kh }));
  const s5 = E.clone(five); E.reformAdvance(s5, KMT, 1); E.run(s5);
  const s6 = E.clone(six); E.reformAdvance(s6, KMT, 1); E.run(s6);
  const p = pendingIs(s6, CCP, "points", "第 6 回合直接呼叫 reformAdvance(國軍) 之後"); if (p !== true) return p;
  const ch = [["score_north", "gao_shuxun"], ["score_east", "sino_soviet_treaty"]];
  const c6 = toAction(enter(6, { hands: ch })), c5 = toAction(enter(5, { hands: ch }));
  const x6 = act(c6, CCP, "gao_shuxun", "reform"), x5 = act(c5, CCP, "gao_shuxun", "reform");
  return all(
    eq(s5.pending, null, "第 5 回合直接呼叫之後有待決定(對照組)"),
    eq(s6.mandate - six.mandate, (s5.mandate - five.mandate) - 1, "直接呼叫 reformAdvance(國軍) 的民心變動,比第 5 回合多往國軍 1"),
    eq(x6.reform[CCP], 1, "共軍的建軍軌"), eq(x6.pending, null, "共軍推進建軍之後有待決定"),
    eq(x6.mandate - c6.mandate, x5.mandate - c5.mandate, "共軍推進建軍的民心變動(第 6 回合 vs 第 5 回合)"), eq(total(x6, CCP), total(c6, CCP), "紅的合計"),
    ok(true, "reformAdvance(國軍) 直接呼叫:民心多 1、共軍有一個放點的決定;共軍自己推進:跟第 5 回合一樣"),
  );
});

check("決戰:蘇聯支持 +1;共軍對城的奇襲 +1、不推民生、不受封鎖;對鄉照舊(不加、受封鎖)", () => {
  const t = sitTodo(); if (t) return t;
  const hands = [["score_north", "gao_shuxun", "shangdang_campaign", "into_manchuria"], []];
  const seven = toAction(enter(7, { hands, support: [2, 4], weariness: 2 })), six = toAction(enter(6, { hands, support: [2, 4], weariness: 2 }));
  const t6 = E.opsOptions(six, CCP).campaignTargets, t7 = E.opsOptions(seven, CCP).campaignTargets;
  const pre = all(
    eq(seven.turn, 7, "回合"), eq(seven.weariness, 2, "民生(凋敝:本土、華北、城的要衝都封鎖)"), eq(J(seven.support), "[3,4]", "第 7 回合開始後的支持度"),
    eq(["xuzhou", "nanjing", "taiyuan", "chasui"].some((id) => t6.includes(id)), false, "第 6 回合同樣的民生下,徐州、南京、太原、察綏有任何一個可以奇襲(對照組)"),
    eq(rb(seven, "xuzhou"), "0/3", "徐州 紅/藍"), eq(rb(seven, "dabieshan"), "2/2", "大別山 紅/藍"),
  );
  if (pre !== true) return pre;
  const a = act(seven, CCP, "gao_shuxun", "campaign", { target: "xuzhou" });
  if (a.winner != null) return `共軍奇襲徐州之後對局結束了(${a.reason},民生 ${a.weariness}):第 7 回合打城不該推民生`;
  const b = act(a, CCP, "shangdang_campaign", "campaign", { target: "dabieshan" });
  const err = thrown(() => act(b, CCP, "into_manchuria", "campaign", { target: "chasui" }));
  return all(
    eq(["xuzhou", "nanjing", "taiyuan"].every((id) => t7.includes(id)), true, "第 7 回合共軍的奇襲目標要有徐州(要衝)、南京(本土)、太原(華北的城)"),
    eq(t7.includes("chasui") || t7.includes("jinzhong"), false, "第 7 回合華北的鄉(察綏、晉中)解鎖了"),
    eq(t7.includes("dabieshan"), true, "大別山(華東中原的鄉,本來就沒有封鎖)不在目標裡"),
    eq(rb(a, "xuzhou"), "0/0", "共軍 2 點 +1 奇襲徐州之後 紅/藍"), eq(a.weariness, 2, "奇襲徐州(城的要衝)之後的民生"), eq(a.winner, null, "勝者"),
    eq(rb(b, "dabieshan"), "2/0", "共軍 2 點奇襲大別山(鄉,不加)之後 紅/藍"),
    ok(err != null, err == null ? "共軍在凋敝時奇襲察綏(華北的鄉)沒有被拒絕" : `蘇聯支持 2→3;徐州 0/3→0/0 民生不動;大別山 2/2→2/0;察綏仍被封鎖(「${err}」)`),
  );
});

check("決戰:國軍照舊,奇襲城的要衝推民生、受封鎖", () => {
  const t = sitTodo(); if (t) return t;
  const S = toAction(enter(7, { edits: { jinan: { r: 2 } }, hands: [[], ["score_east", "kunming_incident", "sino_soviet_treaty"]] }));
  const a = act(S, KMT, "kunming_incident", "campaign", { target: "jinan" });
  const low = E.clone(S); low.weariness = 2;
  const kt = E.opsOptions(low, KMT).campaignTargets;
  return all(
    eq(S.turn, 7, "回合"), eq(S.weariness, 5, "民生"), eq(rb(S, "jinan"), "2/2", "濟南 紅/藍"),
    eq(rb(a, "jinan"), "0/2", "國軍 2 點奇襲濟南(不加)之後 紅/藍"), eq(a.weariness, 4, "國軍奇襲濟南(城的要衝)之後的民生"),
    eq(kt.includes("jinan"), false, "凋敝時國軍還能奇襲濟南"), eq(kt.includes("luzhong"), true, "凋敝時國軍不能奇襲魯中(華東中原的鄉)"),
    ok(true, "國軍打濟南 2/2→0/2,民生 5→4;凋敝時濟南對國軍是封鎖的"),
  );
});

check("決戰:第 7 回合孤城結算藍 −2(掉到 0 為止);第 6、8 回合是 −1", () => {
  const t = sitTodo(); if (t) return t;
  const losses = (st) => J(attritions(st).map((l) => l.losses));
  const e7 = enter(7, { edits: JINAN_CUT, options: { turns: 7 } }), one = enter(7, { edits: { ...JINAN_CUT, jinan: { b: 1 } }, options: { turns: 7 } });
  const e6 = enter(6, { edits: JINAN_CUT, options: { turns: 6 } }), e8 = enter(8, { edits: JINAN_CUT });
  return all(
    eq([e6, e7, one, e8].every((s) => s.winner != null), true, `四局都要走到終局(${[e6, e7, one, e8].map((s) => `turn ${s.turn} ${s.phase}`).join(";")})`),
    eq(`${e6.turn},${e7.turn},${e8.turn}`, "6,7,8", "結束的回合"),
    eq(blueOf(e7, "jinan"), 0, "第 7 回合結算後濟南的藍(2 − 2)"), eq(losses(e7), J([{ jinan: 2 }]), "第 7 回合的 attrition 紀錄"),
    eq(blueOf(one, "jinan"), 0, "第 7 回合結算後濟南的藍(1 − 2,到 0 為止)"), eq(losses(one), J([{ jinan: 1 }]), "只有 1 點可掉時的 attrition 紀錄"),
    eq(blueOf(e6, "jinan"), 1, "第 6 回合結算後濟南的藍"), eq(blueOf(e8, "jinan"), 1, "第 8 回合結算後濟南的藍"),
    ok(true, "濟南:第 7 回合 2→0(藍 1 時 1→0),第 6、8 回合 2→1"),
  );
});

check("和談:美國支持 −2;共軍對城的奇襲不推民生、不受封鎖,但沒有 +1", () => {
  const t = sitTodo(); if (t) return t;
  const S = toAction(enter(8, { hands: [["score_north", "gao_shuxun", "shangdang_campaign"], []], support: [3, 4], weariness: 2 }));
  const t8 = E.opsOptions(S, CCP).campaignTargets;
  const a = act(S, CCP, "gao_shuxun", "campaign", { target: "xuzhou" });
  return all(
    eq(S.turn, 8, "回合"), eq(J(S.support), "[3,2]", "第 8 回合開始後的支持度"), eq(S.weariness, 2, "民生"),
    eq(t8.includes("xuzhou") && t8.includes("nanjing"), true, "第 8 回合共軍的奇襲目標要有徐州、南京"), eq(t8.includes("chasui"), false, "華北的鄉(察綏)解鎖了"),
    eq(rb(a, "xuzhou"), "0/1", "共軍 2 點奇襲徐州(不加)之後 紅/藍"), eq(a.weariness, 2, "之後的民生"), eq(a.winner, null, "勝者"),
    ok(true, "美國支持 4→2;徐州 0/3→0/1,民生不動"),
  );
});

check("和談:提和是三個決定(國軍提不提、棄哪 2 張、共軍接不接),都在補牌之前;接受則雙方各 4 個行動回合", () => {
  const t = sitTodo(); if (t) return t;
  const KH = ["score_east", "kunming_incident", "return_to_nanjing", "sino_soviet_treaty"], two = ["kunming_incident", "return_to_nanjing"];
  const st = enter(8, { refill: true, hands: [[], KH] });
  let p = pendingIs(st, KMT, "option", "第 8 回合開始"); if (p !== true) return p;
  const m0 = st.mandate;
  const pre = all(eq(st.turn, 8, "回合"), same(st.pending.options.map((o) => o.id), ["offer", "pass"], "國軍的選項"), eq(lens(st), "[0,4]", "這時候的手牌(還沒補牌)"));
  if (pre !== true) return pre;
  const a = choose(st, "offer");
  p = pendingIs(a, KMT, "card", "國軍選了提和"); if (p !== true) return p;
  const pa = all(eq(a.pending.n, 2, "要棄的張數"), eq(a.pending.min, 2, "最少要棄的張數"), same(a.pending.options, ["kunming_incident", "return_to_nanjing", "sino_soviet_treaty"], "可以棄的牌(記分卡不行)"),
    eq(thrown(() => choose(a, ["kunming_incident"])) != null, true, "只棄 1 張沒有被拒絕"), eq(thrown(() => choose(a, ["kunming_incident", "score_east"])) != null, true, "棄記分卡沒有被拒絕"));
  if (pa !== true) return pa;
  const b = choose(a, two);
  p = pendingIs(b, CCP, "option", "國軍棄了 2 張"); if (p !== true) return p;
  const pb = all(same(b.pending.options.map((o) => o.id), ["accept", "refuse"], "共軍的選項"), eq(lens(b), "[0,2]", "共軍回答時的手牌(還沒補牌)"));
  if (pb !== true) return pb;
  const c = choose(b, "accept");
  // The same again with nothing to deal and both of the Nationalists' cards offered: nobody holds a card, the turn walks out.
  let w = enter(8, { hands: [[], two] });
  w = choose(choose(w, "offer"), two);
  w.discard = []; // the two offered cards would otherwise be reshuffled and dealt back: there is nothing else in this deck
  w = choose(w, "accept");
  return all(
    eq(J(c.rounds), "[4,4]", "接受之後的 st.rounds"), eq(c.mandate, m0, "接受之後的民心"), eq(c.phase, "headline", "phase"), eq(c.pending, null, "還有待決定"),
    eq(two.every((x) => c.discard.includes(x)), true, "棄的 2 張在棄牌堆"), eq(two.some((x) => c.removed.includes(x) || c.hands[KMT].includes(x)), false, "棄的 2 張被移出遊戲或還在手上"),
    eq(lens(c), "[9,8]", "之後補牌到 [共 9, 國 8]"), eq(c.hands[KMT].includes("score_east") && c.hands[KMT].includes("sino_soviet_treaty"), true, "國軍留在手上的兩張還在"),
    eq(w.winner != null, true, `空手的那一局要走到終局(turn ${w.turn},phase ${w.phase})`), eq(roundsOf(w, 8), seq([4, 4]), "接受之後第 8 回合的行動順序"),
    ok(true, `國軍提和、棄 2 張(事件不觸發,進棄牌堆)、共軍接受:行動回合 ${J(c.rounds)},然後才補牌 ${lens(c)};行動順序 ${roundsOf(w, 8)}`),
  );
});

check("和談:共軍拒絕則民心往國軍移 2、照常進行;國軍不提、或沒有 2 張可棄,就沒有後面的決定", () => {
  const t = sitTodo(); if (t) return t;
  const KH = ["score_east", "kunming_incident", "return_to_nanjing", "sino_soviet_treaty"], two = ["kunming_incident", "return_to_nanjing"];
  const st = enter(8, { hands: [[], KH] });
  let p = pendingIs(st, KMT, "option", "第 8 回合開始"); if (p !== true) return p;
  const m0 = st.mandate;
  const b = choose(choose(st, "offer"), two);
  p = pendingIs(b, CCP, "option", "國軍棄了 2 張"); if (p !== true) return p;
  const refused = choose(b, "refuse"), passed = choose(st, "pass");
  let w = enter(8, { hands: [[], two] });
  w = choose(choose(w, "offer"), two); w.discard = []; w = choose(w, "refuse");
  const few = enter(8, { hands: [[], ["score_east", "kunming_incident"]] });
  return all(
    eq(refused.mandate - m0, -2, "共軍拒絕後民心的變動(負 = 往國軍)"), eq(J(refused.rounds), "[7,6]", "共軍拒絕後的 st.rounds"), eq(refused.pending, null, "拒絕之後還有待決定"),
    eq(w.winner != null, true, `空手的那一局要走到終局(turn ${w.turn},phase ${w.phase})`), eq(roundsOf(w, 8), seq([7, 6]), "拒絕之後第 8 回合的行動順序"),
    eq(passed.pending, null, "國軍不提之後還有待決定"), eq(passed.mandate, m0, "國軍不提之後的民心"), eq(J(passed.rounds), "[7,6]", "國軍不提之後的 st.rounds"), same(passed.hands[KMT], KH, "國軍不提之後的手牌"), eq(passed.phase, "headline", "phase"),
    eq(few.turn, 8, "回合"), eq(few.pending, null, "國軍只有 1 張不是記分卡的牌,卻被問了"), eq(few.phase, "headline", "phase"), eq(J(few.rounds), "[7,6]", "st.rounds"),
    ok(true, `拒絕:民心 −2(往國軍)、行動回合 ${J(refused.rounds)}、順序 ${roundsOf(w, 8)};不提:什麼都不動;只有 1 張可棄:不問`),
  );
});

// ---------------------------------------------------------------- group 5
// 民生的封鎖只鎖對手的本土 (issue #3). owner 裁決(#2, 2026-10-01): 「只鎖對手的本土,照規則書」.
// The rulebook's words, copied by hand (三, 民生軌; 二, 地圖):
//   封鎖(只限奇襲):動盪以下不可奇襲對手的本土(西北、後方);通膨以下再加上華北;凋敝再加上所有城的要衝。
//   本土:共軍是西北,國軍是後方。
// The engine came from Zongheng, whose rulebook reads 「不可對本土奇襲」: both home regions, for both
// sides. The difference is whether a side may attack inside its OWN home region from 動盪 down.
// (The readings of #2 themselves, 撤離 in one space and free of adjacency, the first attack once
// with events counting, the jump once a turn into one village, were confirmed by the owner the same day.)
section("5 民生封鎖:只鎖對手的本土");

const lockTodo = () => (E.DEFAULT_OPTIONS.homeLockSide === undefined ? "TODO: DEFAULT_OPTIONS.homeLockSide 還沒有;兩個本土對雙方都鎖(縱橫的規則)" : null);
// Red put in two cities of 後方 so that the Nationalists have something to attack at home: 武漢 (no 要衝) and 南京 (a 要衝).
const HOME_EDITS = { wuhan: { r: 1 }, nanjing: { r: 1 } };
// What each side may attack at each 民生 level, from the rulebook's sentence. [space, why, 復員 5, 動盪 4, 通膨 3, 凋敝 2]
const LOCK_TABLE = {
  [CCP]: [
    ["lanzhou",  "西北(自己的本土)的城",       true, true,  true,  true],
    ["xian",     "西北(自己的本土)城的要衝",   true, true,  true,  false],
    ["wuhan",    "後方(對手的本土)的城",       true, false, false, false],
    ["nanjing",  "後方(對手的本土)城的要衝",   true, false, false, false],
    ["chasui",   "華北的鄉",                   true, true,  false, false],
    ["xuzhou",   "華東中原城的要衝",           true, true,  true,  false],
    ["zhengzhou", "華東中原的城",              true, true,  true,  true],
  ],
  [KMT]: [
    ["wuhan",    "後方(自己的本土)的城",       true, true,  true,  true],
    ["nanjing",  "後方(自己的本土)城的要衝",   true, true,  true,  false],
    ["shanbei",  "西北(對手的本土)的鄉",       true, false, false, false],
    ["jizhong",  "華北的鄉",                   true, true,  false, false],
    ["luzhong",  "華東中原的鄉",               true, true,  true,  true],
  ],
};

check("各級民生下誰可以奇襲哪裡:動盪以下只鎖對手的本土,自己的本土照打", () => {
  const t = lockTodo(); if (t) return t;
  let n = 0;
  for (const [col, w] of [[2, 5], [3, 4], [4, 3], [5, 2]]) {
    const st = enter(6, { edits: HOME_EDITS, hands: STOP, weariness: w });
    if (st.turn !== 6 || st.weariness !== w) return `沒有走到第 6 回合、民生 ${w} 的盤面(turn ${st.turn},民生 ${st.weariness})`;
    for (const side of [CCP, KMT]) {
      const targets = E.opsOptions(st, side).campaignTargets;
      for (const row of LOCK_TABLE[side]) {
        if (!(E.infOf(st, row[0])[1 - side] > 0)) return `${E.SPACE[row[0]].zh} 沒有對手的點,這一格沒有東西可打`;
        const q = eq(targets.includes(row[0]), row[col], `${E.WEARINESS_NAMES[w]}(${w})時${sideZh(side)}能不能奇襲${E.SPACE[row[0]].zh}(${row[1]})`);
        if (q !== true) return q;
        n++;
      }
    }
  }
  // 決戰 unlocks cities for the Communists only: the Nationalists are still kept out of 西北 on turn 7.
  const seven = enter(7, { edits: HOME_EDITS, hands: STOP, weariness: 4 });
  return all(
    eq(seven.turn, 7, "回合"), eq(E.opsOptions(seven, KMT).campaignTargets.includes("shanbei"), false, "第 7 回合動盪時國軍能奇襲陝北"),
    eq(E.opsOptions(seven, KMT).campaignTargets.includes("wuhan"), true, "第 7 回合動盪時國軍不能奇襲武漢(自己的本土)"),
    ok(true, `${n} 格都對:動盪起共軍打不了後方、國軍打不了西北;蘭州、西安對共軍,武漢、南京對國軍仍然打得到(要衝到凋敝才鎖)`),
  );
});

check("經過 apply:動盪時共軍奇襲蘭州、國軍奇襲武漢可以;共軍打南京、國軍打陝北被拒絕", () => {
  const t = lockTodo(); if (t) return t;
  const S = toAction(enter(6, { edits: HOME_EDITS, weariness: 4, hands: [["score_north", "gao_shuxun", "shangdang_campaign"], ["score_east", "kunming_incident", "sino_soviet_treaty"]] }));
  const pre = all(eq(S.turn, 6, "回合"), eq(S.weariness, 4, "民生"), eq(rb(S, "lanzhou"), "0/2", "蘭州 紅/藍"), eq(rb(S, "wuhan"), "1/3", "武漢 紅/藍"));
  if (pre !== true) return pre;
  const no1 = thrown(() => act(S, CCP, "gao_shuxun", "campaign", { target: "nanjing" }));
  let a = null, b = null;
  const e1 = thrown(() => { a = act(S, CCP, "gao_shuxun", "campaign", { target: "lanzhou" }); });
  if (e1 != null) return `動盪時共軍奇襲蘭州(自己的本土)被拒絕:${e1}`;
  const no2 = thrown(() => act(a, KMT, "kunming_incident", "campaign", { target: "shanbei" }));
  const e2 = thrown(() => { b = act(a, KMT, "kunming_incident", "campaign", { target: "wuhan" }); });
  if (e2 != null) return `動盪時國軍奇襲武漢(自己的本土)被拒絕:${e2}`;
  return all(
    eq(no1 != null, true, "動盪時共軍奇襲南京(後方)沒有被拒絕"), eq(no2 != null, true, "動盪時國軍奇襲陝北(西北)沒有被拒絕"),
    eq(rb(a, "lanzhou"), "0/0", "共軍 2 點奇襲蘭州之後 紅/藍"), eq(rb(b, "wuhan"), "0/4", "國軍 2 點奇襲武漢(移除 1、放 1)之後 紅/藍"),
    eq(b.weariness, 4, "兩次奇襲之後的民生(都不是要衝)"),
    ok(true, `共軍打蘭州 0/2→0/0、國軍打武漢 1/3→0/4;共軍打南京(「${no1}」)、國軍打陝北(「${no2}」)被拒絕`),
  );
});

check("homeLockSide 是一個開關:預設 \"opponent\";\"both\" 是縱橫的鎖法(兩個本土對雙方都鎖)", () => {
  const t = lockTodo(); if (t) return t;
  const both = enter(6, { edits: HOME_EDITS, hands: STOP, weariness: 4, options: { homeLockSide: "both" } });
  const c = E.opsOptions(both, CCP).campaignTargets, k = E.opsOptions(both, KMT).campaignTargets;
  return all(
    eq(E.DEFAULT_OPTIONS.homeLockSide, "opponent", "DEFAULT_OPTIONS.homeLockSide"),
    eq(both.options.homeLockSide, "both", "這一局的選項"),
    eq(c.includes("lanzhou") || c.includes("xian"), false, "\"both\" 時動盪下共軍還能奇襲西北"), eq(c.includes("nanjing"), false, "\"both\" 時動盪下共軍能奇襲後方"),
    eq(k.includes("wuhan"), false, "\"both\" 時動盪下國軍還能奇襲後方"), eq(k.includes("shanbei"), false, "\"both\" 時動盪下國軍能奇襲西北"),
    eq(c.includes("xuzhou") && k.includes("jizhong"), true, "\"both\" 時動盪下其他區照常"),
    ok(true, "預設只鎖對手的本土;homeLockSide: \"both\" 時西北、後方對雙方都鎖"),
  );
});

// ---------------------------------------------------------------- verdict
test("acceptance: the first guard", () => {
  const s = summary();
  for (const p of R.pass) console.log(`通過 · ${p.label}${p.msg ? " · " + p.msg : ""}`);
  for (const t of s.todos) console.log(`尚未實作 · ${t.label} · ${t.msg}`);
  for (const f of s.failures) console.log(`失敗 · ${f.label} · ${f.msg}`);
  console.log(`VERDICT 通過 ${s.pass} / 失敗 ${s.fail} / 尚未實作 ${s.todo}`);
  assert.equal(s.fail, 0, s.failures.map((f) => `${f.label}: ${f.msg}`).join("\n"));
});
