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
// 時局 8 張 and 行動回合與手牌依期不對稱 moved to group 4 (#2), with the two support tracks themselves.
// The two aid cards and 美軍駐華 moved to group 6 (#4).
// 記分時根據地也算要衝 moved to group 7 (#5).

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
  let st = E.createGame(11, { aid: false, ...options }); // no aid cards unless a check asks: an empty hand must have nothing to play
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
  if (st.jiuding) st.jiuding = { holder: null, faceDown: true }; // until #4 lands: nobody has the Cauldrons to play, this turn or a later one
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
    eq(ct.includes("jinzhou"), false, "第 1 回合共軍的奇襲目標有錦州"), eq(ct.includes("beiping"), true, "第 1 回合共軍的奇襲目標沒有北平(東北以外的城;天津有美軍駐華,不拿來當對照)"),
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
  const now = enter(6, { edits: HOME_EDITS, hands: STOP, weariness: 4 }), noKey = E.clone(now);
  delete noKey.options.homeLockSide;
  return all(
    eq(E.DEFAULT_OPTIONS.homeLockSide, "opponent", "DEFAULT_OPTIONS.homeLockSide"),
    eq(both.options.homeLockSide, "both", "這一局的選項"),
    eq(c.includes("lanzhou") || c.includes("xian"), false, "\"both\" 時動盪下共軍還能奇襲西北"), eq(c.includes("nanjing"), false, "\"both\" 時動盪下共軍能奇襲後方"),
    eq(k.includes("wuhan"), false, "\"both\" 時動盪下國軍還能奇襲後方"), eq(k.includes("shanbei"), false, "\"both\" 時動盪下國軍能奇襲西北"),
    eq(c.includes("xuzhou") && k.includes("jizhong"), true, "\"both\" 時動盪下其他區照常"),
    // Two holes BE reported at delivery, each seen red once it had a check: a game whose options have no such
    // key (one created before #3) keeps the old rule, and a caller that does not say who attacks gets the old rule too.
    eq(E.opsOptions(noKey, CCP).campaignTargets.includes("lanzhou"), false, "選項裡沒有 homeLockSide 的舊局,動盪下共軍還能奇襲西北"),
    eq(E.opsOptions(noKey, KMT).campaignTargets.includes("wuhan"), false, "選項裡沒有 homeLockSide 的舊局,動盪下國軍還能奇襲後方"),
    eq(E.campaignLocked(now, "lanzhou", CCP), false, "campaignLocked(蘭州, 共軍) 在動盪時"),
    eq(E.campaignLocked(now, "lanzhou"), true, "campaignLocked(蘭州) 不說是誰打的,在動盪時"),
    ok(true, "預設只鎖對手的本土;homeLockSide: \"both\"、沒有這個 key 的舊局、不說攻方的呼叫,都是西北與後方對雙方都鎖"),
  );
});

// ---------------------------------------------------------------- group 6
// 外援牌與美軍駐華 (issue #4): what is left of 外國勢力 after the two tracks came with #2.
// The rulebook's words, copied by hand (三, 外國勢力; 三, 補給 3; 三, 回合結構 3; 四, 細則):
//   1. 外援牌取代縱橫的九鼎,而且不再交給對手。國軍有「美援」,共軍有「蘇援」,都不算手牌。
//      每回合各可用一次,在自己的行動回合代替一張手牌打出,只能扶植、奇襲、遊說。
//      行動點 = 當時的支持度;支持度是 0 就不能用。
//      - 美援全部放在城時,可以放進孤城(空運)。
//      - 蘇援全部用在東北時,行動點 +1。
//   2. 美軍駐華:美國支持 ≥ 3 時,共軍不能奇襲天津與上海。
//   孤城的效果:國軍不能在那裡扶植(美援除外)。標題階段:外援牌不能當標題牌。
//   細則:外援牌受「本回合所有牌行動點 +1 / −1」的效果影響。支持度是 0 時不能用,即使有 +1。
//         美軍駐華只擋奇襲,不擋扶植、遊說與事件。第 1 回合東北三座城不能放點,包括事件與外援牌。
// The rig of groups 3 to 5 asks for games without aid cards (`aid: false`), so that a side with an
// empty hand has nothing to play and a turn walks out; the checks here ask for them.
section("6 外援牌與美軍駐華");

const aidTodo = () => (E.AID === undefined ? "TODO: E.AID 還沒有;外援仍是縱橫的九鼎(一張、會換手),沒有美軍駐華" : null);
const AID_ON = { aid: true };
const KH3 = ["score_east", "kunming_incident", "sino_soviet_treaty"];
const aidOf = (st, side) => { const l = E.legal(st, side); return l.kind === "action" ? l.aid ?? null : null; };
const ids = (xs) => (xs || []).map((x) => (typeof x === "string" ? x : x.id));

check("外援牌:蘇援、美援各一張,不在 72 張牌裡;九鼎不在了;aid 是一個開關", () => {
  const t = aidTodo(); if (t) return t;
  const st = E.createGame(3);
  return all(
    eq(J(E.AID.map((a) => [a.id, a.zh])), J([["soviet_aid", "蘇援"], ["american_aid", "美援"]]), "E.AID [共軍的, 國軍的]"),
    eq(E.AID.every((a) => typeof a.en === "string" && a.en.length > 0), true, "兩張都有英文名"),
    eq(E.CARDS.length, SPEC.deck.total, "牌數"), eq(E.CARDS.some((c) => c.id === "soviet_aid" || c.id === "american_aid"), false, "外援牌混在 72 張牌裡"),
    eq(st.jiuding, undefined, "st.jiuding(九鼎)"), eq(J(st.aidUsed), "[false,false]", "st.aidUsed"),
    eq(E.DEFAULT_OPTIONS.aid, true, "DEFAULT_OPTIONS.aid"),
    ok(true, "蘇援(共軍)、美援(國軍);72 張牌不變;沒有九鼎;aid 預設開"),
  );
});

check("美援:行動點 = 美國支持;不算手牌;佔一個行動回合;一回合一次", () => {
  const t = aidTodo(); if (t) return t;
  const S = toAction(enter(6, { options: AID_ON, support: [0, 3], hands: [[], KH3] }));
  const aid = aidOf(S, KMT);
  const pre = all(eq(S.turn, 6, "回合"), eq(S.actor, KMT, "輪到誰(共軍沒有手牌、蘇聯支持 0,跳過)"), eq(S.round, 1, "第幾個行動回合"), eq(J(S.support), "[0,3]", "支持度"),
    eq(aid && aid.id, "american_aid", "legal 給國軍的外援牌"), eq(aid && aid.ops, 3, "美援的行動點"));
  if (pre !== true) return pre;
  let a = null;
  const e = thrown(() => { a = act(S, KMT, "american_aid", "place", { points: ["xuzhou", "xuzhou", "tianjin"] }); });
  if (e != null) return `國軍用美援扶植 3 點被拒絕:${e}`;
  const NE3 = toAction(enter(6, { options: AID_ON, edits: { jinzhou: { b: 1 } }, support: [0, 3], hands: [[], KH3] }));
  return all(
    eq(thrown(() => act(S, KMT, "american_aid", "place", { points: ["xuzhou", "xuzhou", "tianjin", "tianjin"] })) != null, true, "美援放 4 點(支持度 3)沒有被拒絕"),
    eq(`${blueOf(a, "xuzhou")},${blueOf(a, "tianjin")}`, "5,4", "徐州、天津的藍"),
    same(a.hands[KMT], ["kunming_incident", "sino_soviet_treaty"], "國軍的手牌(美援不算手牌)"),
    eq(a.discard.includes("american_aid") || a.removed.includes("american_aid"), false, "美援進了棄牌堆或被移出遊戲"),
    eq(J(a.aidUsed), "[false,true]", "st.aidUsed"), eq(a.round, 2, "之後是第幾個行動回合"), eq(a.actor, KMT, "之後輪到誰"),
    eq(aidOf(a, KMT), null, "同一回合用過之後 legal 還給美援"),
    eq(thrown(() => act(a, KMT, "american_aid", "place", { points: ["tianjin"] })) != null, true, "同一回合第二次用美援沒有被拒絕"),
    // 東北的 +1 只給蘇援: with blue 1 in 錦州 and red 1 in 北滿, 美援 (3) puts 3 points in the Northeast, not 4, and hits with 3.
    eq(thrown(() => act(NE3, KMT, "american_aid", "place", { points: ["jinzhou", "jinzhou", "jinzhou", "jinzhou"] })) != null, true, "美援在東北放 4 點(支持度 3)沒有被拒絕:+1 只給蘇援"),
    eq(thrown(() => act(NE3, KMT, "american_aid", "place", { points: ["jinzhou", "jinzhou", "jinzhou"] })), null, "美援在東北放 3 點被拒絕"),
    eq(rb(act(NE3, KMT, "american_aid", "campaign", { target: "beiman" }), "beiman"), "0/2", "美援 3 點奇襲北滿(東北;移除 1、放 2)之後 紅/藍"),
    ok(true, "美援 3 點:徐州 +2、天津 +1;手牌還是 2 張;佔了第 1 個行動回合;這一回合不能再用;在東北也是 3 點"),
  );
});

check("美援只能扶植、奇襲、遊說;不能當標題牌、不能當事件或行憲", () => {
  const t = aidTodo(); if (t) return t;
  const H = enter(6, { options: AID_ON, support: [0, 3], hands: [[], KH3] });
  const S = toAction(H), aid = aidOf(S, KMT);
  const pre = all(eq(H.phase, "headline", "phase"), eq(aid && aid.id, "american_aid", "legal 給國軍的外援牌"), eq(rb(S, "jizhong"), "2/0", "冀中 紅/藍"), eq(rb(S, "chasui"), "2/2", "察綏 紅/藍"));
  if (pre !== true) return pre;
  let b = null, c = null;
  const e1 = thrown(() => { b = act(S, KMT, "american_aid", "campaign", { target: "jizhong" }); });
  if (e1 != null) return `國軍用美援奇襲冀中被拒絕:${e1}`;
  const e2 = thrown(() => { c = act(S, KMT, "american_aid", "lobby", { target: "chasui" }); });
  if (e2 != null) return `國軍用美援遊說察綏被拒絕:${e2}`;
  return all(
    eq(thrown(() => E.apply(H, { type: "headline", side: KMT, card: "american_aid" })) != null, true, "美援當標題牌沒有被拒絕"),
    eq(thrown(() => act(S, KMT, "american_aid", "event")) != null, true, "美援當事件沒有被拒絕"),
    eq(thrown(() => act(S, KMT, "american_aid", "reform")) != null, true, "美援拿去行憲沒有被拒絕"),
    eq(ids(aid.campaign && aid.campaign.targets).includes("jizhong"), true, "legal 的美援奇襲目標沒有冀中"), eq(ids(aid.lobby && aid.lobby.targets).includes("chasui"), true, "legal 的美援遊說目標沒有察綏"),
    eq(rb(b, "jizhong"), "0/1", "美援 3 點奇襲冀中(移除 2、放 1)之後 紅/藍"), eq(J(b.aidUsed), "[false,true]", "奇襲之後的 st.aidUsed"),
    eq(J(c.aidUsed), "[false,true]", "遊說之後的 st.aidUsed"),
    ok(true, "奇襲冀中 2/0→0/1、遊說察綏都可以;標題、事件、行憲都被拒絕"),
  );
});

check("支持度是 0 就不能用,即使有 +1;「所有牌行動點 ±1」的效果照算,最低 1", () => {
  const t = aidTodo(); if (t) return t;
  const at = (us, delta) => {
    const s = toAction(enter(6, { options: AID_ON, support: [0, us], hands: [[], KH3] }));
    if (delta) s.effects.push({ kind: "opsAll", target: KMT, delta, until: "turn", card: "probe" }); // what 戡亂動員令 / 美國武器禁運 will add
    return s;
  };
  const zero = at(0, 1), two = at(2, 1), one = at(1, -1), three = at(3, -1);
  const handOps = (st) => { const c = E.legal(st, KMT).cards.find((x) => x.id === "kunming_incident"); return c && c.ops; };
  return all(
    eq(handOps(zero), 3, "+1 的效果對手牌有沒有作用(昆明事變 2 → 3)"), eq(handOps(one), 1, "−1 的效果對手牌(昆明事變 2 → 1)"),
    eq(aidOf(zero, KMT), null, "美國支持 0、有 +1 時 legal 還給美援"),
    eq(thrown(() => act(zero, KMT, "american_aid", "place", { points: ["tianjin"] })) != null, true, "美國支持 0、有 +1 時用美援沒有被拒絕"),
    eq(aidOf(two, KMT) && aidOf(two, KMT).ops, 3, "美國支持 2、+1 時美援的行動點"),
    eq(thrown(() => act(two, KMT, "american_aid", "place", { points: ["xuzhou", "xuzhou", "tianjin"] })), null, "美國支持 2、+1 時美援放 3 點被拒絕"),
    eq(aidOf(one, KMT) && aidOf(one, KMT).ops, 1, "美國支持 1、−1 時美援的行動點(最低 1)"),
    eq(aidOf(three, KMT) && aidOf(three, KMT).ops, 2, "美國支持 3、−1 時美援的行動點"),
    ok(true, "支持 0(+1)不能用;2(+1)是 3 點;1(−1)是 1 點;3(−1)是 2 點"),
  );
});

check("蘇援:行動點 = 蘇聯支持;全部用在東北時 +1(扶植每一點都在東北、奇襲的目標在東北)", () => {
  const t = aidTodo(); if (t) return t;
  const C = toAction(enter(6, { options: AID_ON, edits: { shenyang: { b: 2 } }, support: [2, 0], hands: [["score_north", "gao_shuxun"], []] }));
  const aid = aidOf(C, CCP);
  const pre = all(eq(C.actor, CCP, "輪到誰"), eq(aid && aid.id, "soviet_aid", "legal 給共軍的外援牌"), eq(aid && aid.ops, 2, "蘇援的行動點"),
    eq(rb(C, "siping"), "0/0", "四平 紅/藍"), eq(rb(C, "beiman"), "1/0", "北滿 紅/藍"), eq(rb(C, "shenyang"), "0/2", "瀋陽 紅/藍"), eq(rb(C, "chasui"), "2/2", "察綏 紅/藍"));
  if (pre !== true) return pre;
  let ne = null, mixed = null, hitNe = null, hitOther = null;
  const e1 = thrown(() => { ne = act(C, CCP, "soviet_aid", "place", { points: ["siping", "siping", "beiman"] }); });
  if (e1 != null) return `蘇援 2 點、全部放在東北的 3 點被拒絕:${e1}`;
  const e2 = thrown(() => { mixed = act(C, CCP, "soviet_aid", "place", { points: ["siping", "taihang"] }); });
  if (e2 != null) return `蘇援 2 點放四平、太行各 1 被拒絕:${e2}`;
  const e3 = thrown(() => { hitNe = act(C, CCP, "soviet_aid", "campaign", { target: "shenyang" }); hitOther = act(C, CCP, "soviet_aid", "campaign", { target: "chasui" }); });
  if (e3 != null) return `蘇援奇襲被拒絕:${e3}`;
  const T2 = E.placeTargets(C, CCP, 2, ["siping", "siping"], "soviet_aid").lit, T3 = E.placeTargets(C, CCP, 2, ["siping", "taihang"], "soviet_aid").lit;
  return all(
    eq(`${redOf(ne, "siping")},${redOf(ne, "beiman")}`, "2,2", "四平、北滿的紅(3 點都在東北)"), eq(`${redOf(mixed, "siping")},${redOf(mixed, "taihang")}`, "1,5", "四平、太行的紅"),
    eq(thrown(() => act(C, CCP, "soviet_aid", "place", { points: ["siping", "siping", "taihang"] })) != null, true, "3 點裡有 1 點不在東北,沒有被拒絕"),
    eq(thrown(() => act(C, CCP, "soviet_aid", "place", { points: ["siping", "siping", "beiman", "beiman"] })) != null, true, "東北 4 點(2 + 1 = 3)沒有被拒絕"),
    eq(rb(hitNe, "shenyang"), "1/0", "蘇援奇襲瀋陽(東北,2 + 1:移除 2、放 1)之後 紅/藍"), eq(rb(hitOther, "chasui"), "2/0", "蘇援奇襲察綏(華北,2 點)之後 紅/藍"),
    eq(T2.has("beiman"), true, "placeTargets:四平放了 2 點之後,北滿(東北的第 3 點)沒有亮"), eq(T2.has("taihang"), false, "placeTargets:四平放了 2 點之後,太行還亮"),
    eq(T3.size, 0, "placeTargets:四平、太行各 1 點之後還有亮的據點"),
    eq(E.placeTargets(C, CCP, 2, ["siping", "siping"]).lit.size, 0, "placeTargets 不說是蘇援時,2 點用完還有亮的據點"),
    ok(true, "蘇援 2 點:四平 2 + 北滿 1 可以(都在東北);四平 1 + 太行 1 可以;混著放 3 點不行;打瀋陽 0/2→1/0,打察綏 2/2→2/0"),
  );
});

check("美援全部放在城時可以放進孤城;有一點放在鄉就不行;手牌不行", () => {
  const t = aidTodo(); if (t) return t;
  const K = toAction(enter(6, { options: AID_ON, edits: JINAN_CUT, support: [0, 4], hands: [[], KH3] }));
  const aid = aidOf(K, KMT), card = E.legal(K, KMT).cards.find((x) => x.id === "kunming_incident");
  const pre = all(same(E.isolatedCities(K), ["jinan"], "孤城"), eq(aid && aid.ops, 4, "美援的行動點"), eq(blueOf(K, "jinan"), 2, "濟南的藍"), eq(E.controller(K, "jizhong"), CCP, "冀中的控制者(每點 2)"));
  if (pre !== true) return pre;
  let a = null, plain = null;
  const e1 = thrown(() => { a = act(K, KMT, "american_aid", "place", { points: ["jinan", "jinan", "xuzhou"] }); });
  if (e1 != null) return `美援把 2 點放進孤城濟南、1 點放徐州(全部是城)被拒絕:${e1}`;
  const e2 = thrown(() => { plain = act(K, KMT, "american_aid", "place", { points: ["jizhong", "xuzhou"] }); });
  if (e2 != null) return `美援放冀中(鄉)和徐州(有補給的城)被拒絕:${e2}`;
  const T0 = E.placeTargets(K, KMT, 4, [], "american_aid").lit, T1 = E.placeTargets(K, KMT, 4, ["jinan"], "american_aid").lit, T2 = E.placeTargets(K, KMT, 4, ["jizhong"], "american_aid").lit;
  return all(
    eq(thrown(() => act(K, KMT, "kunming_incident", "place", { points: ["jinan"] })) != null, true, "用手牌扶植孤城濟南沒有被拒絕"),
    eq(ids(card.uses.place && card.uses.place.options).includes("jinan"), false, "legal 的手牌扶植選項列了濟南"),
    eq(ids(aid.place && aid.place.options).includes("jinan"), true, "legal 的美援扶植選項沒有濟南"),
    eq(`${blueOf(a, "jinan")},${blueOf(a, "xuzhou")}`, "4,4", "濟南、徐州的藍"), eq(blueOf(plain, "jizhong"), 1, "冀中的藍"),
    eq(thrown(() => act(K, KMT, "american_aid", "place", { points: ["jinan", "jizhong"] })) != null, true, "美援放濟南(孤城)和冀中(鄉)沒有被拒絕"),
    eq(thrown(() => act(K, KMT, "american_aid", "place", { points: ["jizhong", "jinan"] })) != null, true, "美援放冀中(鄉)和濟南(孤城)沒有被拒絕"),
    eq(T0.has("jinan") && T0.has("jizhong"), true, "placeTargets(美援):一開始濟南和冀中都要亮"),
    eq(T1.has("jizhong"), false, "placeTargets(美援):放了濟南之後冀中(鄉)還亮"), eq(T1.has("xuzhou") && T1.has("jinan"), true, "placeTargets(美援):放了濟南之後徐州、濟南要亮"),
    eq(T2.has("jinan"), false, "placeTargets(美援):放了冀中(鄉)之後濟南(孤城)還亮"), eq(T2.has("xuzhou"), true, "placeTargets(美援):放了冀中之後徐州要亮"),
    eq(E.placeTargets(K, KMT, 4).lit.has("jinan"), false, "placeTargets 不說是美援時亮了濟南"),
    ok(true, "美援:濟南 2→4、徐州 3→4(全部是城);冀中 + 徐州可以;孤城和鄉混著放不行;手牌放不進濟南"),
  );
});

check("空運只到孤城(有藍的城):沒有藍的城,不論是沒有補給還是共軍控制,美援也放不進去(owner 裁決 #4)", () => {
  const t = aidTodo(); if (t) return t;
  const mk = (edits) => toAction(enter(6, { options: AID_ON, edits, support: [0, 4], hands: [[], KH3] }));
  const empty = mk({ taiyuan: { b: 0 }, jinzhong: { r: 4 } }), held = mk({ zhengzhou: { r: 4, b: 2 } }), bare = mk({ zhengzhou: { r: 2, b: 0 } });
  const pre = all(
    eq(E.supplied(empty).has("taiyuan"), false, "空的太原在補給範圍內"), eq(E.canPlaceAt(empty, KMT, "taiyuan"), true, "太原在國軍的相鄰範圍內"),
    same(E.isolatedCities(held), ["zhengzhou"], "鄭州(紅 4 藍 2,共軍控制)是孤城"), eq(E.isolatedCities(bare).length, 0, "鄭州(紅 2 藍 0)不是孤城"), eq(E.controller(bare, "zhengzhou"), CCP, "鄭州(紅 2 藍 0)的控制者"),
  );
  if (pre !== true) return pre;
  let a = null;
  const e = thrown(() => { a = act(held, KMT, "american_aid", "place", { points: ["zhengzhou", "zhengzhou"] }); });
  if (e != null) return `美援放進共軍控制、還有藍的鄭州(孤城)被拒絕:${e}`;
  return all(
    eq(blueOf(a, "zhengzhou"), 4, "鄭州的藍(2 + 2)"),
    eq(thrown(() => act(empty, KMT, "american_aid", "place", { points: ["taiyuan"] })) != null, true, "美援放進沒有藍、沒有補給的太原沒有被拒絕"),
    eq(ids(aidOf(empty, KMT).place && aidOf(empty, KMT).place.options).includes("taiyuan"), false, "legal 的美援扶植選項列了空的太原"),
    eq(thrown(() => act(bare, KMT, "american_aid", "place", { points: ["zhengzhou"] })) != null, true, "美援放進共軍控制、沒有藍的鄭州沒有被拒絕"),
    ok(true, "鄭州紅 4 藍 2(孤城)美援放得進去,2→4;空的太原、紅 2 藍 0 的鄭州放不進去"),
  );
});

check("美軍駐華:美國支持 ≥ 3 時共軍不能奇襲天津與上海(手牌、蘇援都不行);只擋奇襲;第 7 回合的解鎖不管它", () => {
  const t = aidTodo(); if (t) return t;
  const hands = [["score_north", "gao_shuxun", "shangdang_campaign"], []], edits = { tianjin: { r: 1 } };
  const M = toAction(enter(6, { options: AID_ON, edits, support: [1, 3], hands })), free = toAction(enter(6, { options: AID_ON, edits, support: [1, 2], hands }));
  const tm = E.opsOptions(M, CCP).campaignTargets, tf = E.opsOptions(free, CCP).campaignTargets;
  const pre = all(eq(M.actor, CCP, "輪到誰"), eq(J(M.support), "[1,3]", "支持度"), eq(M.weariness, 5, "民生"), eq(rb(free, "tianjin"), "1/3", "天津 紅/藍"),
    eq(tf.includes("tianjin") && tf.includes("shanghai"), true, "美國支持 2 時共軍可以奇襲天津、上海(對照組)"));
  if (pre !== true) return pre;
  let hit = null;
  const e = thrown(() => { hit = act(free, CCP, "gao_shuxun", "campaign", { target: "tianjin" }); });
  if (e != null) return `美國支持 2 時共軍奇襲天津被拒絕:${e}`;
  const seven = toAction(enter(7, { options: AID_ON, support: [2, 4], weariness: 2, hands }));
  const t7 = E.opsOptions(seven, CCP).campaignTargets;
  return all(
    eq(tm.includes("tianjin") || tm.includes("shanghai"), false, "美國支持 3 時共軍的奇襲目標有天津或上海"), eq(tm.includes("beiping") && tm.includes("nanjing"), true, "美國支持 3 時北平、南京照常可以奇襲"),
    eq(thrown(() => act(M, CCP, "gao_shuxun", "campaign", { target: "tianjin" })) != null, true, "美國支持 3 時共軍用手牌奇襲天津沒有被拒絕"),
    eq(thrown(() => act(M, CCP, "soviet_aid", "campaign", { target: "shanghai" })) != null, true, "美國支持 3 時共軍用蘇援奇襲上海沒有被拒絕"),
    eq(ids(E.opsOptions(M, CCP).lobbyTargets).includes("tianjin"), true, "美軍駐華連遊說天津也擋了"), eq(E.placeTargets(M, CCP, 2).lit.has("tianjin"), true, "美軍駐華連扶植天津也擋了"),
    eq(E.opsOptions(M, KMT).campaignTargets.includes("tianjin"), true, "國軍不能奇襲天津裡的紅"),
    eq(rb(hit, "tianjin"), "1/1", "美國支持 2 時共軍 2 點奇襲天津之後 紅/藍"),
    eq(J(seven.support), "[3,4]", "第 7 回合的支持度"), eq(t7.includes("tianjin") || t7.includes("shanghai"), false, "第 7 回合美國支持 4,共軍的奇襲目標有天津或上海"), eq(t7.includes("xuzhou") && t7.includes("nanjing"), true, "第 7 回合徐州、南京解鎖"),
    ok(true, "美國支持 3:天津、上海不在共軍的奇襲目標裡,手牌和蘇援都被拒絕,遊說和扶植照常;支持 2:打得到;第 7 回合(支持 4)仍然擋"),
  );
});

check("外援牌不換手;空手的一方有外援牌就要行動;每回合重置;aid: false 時沒有外援牌", () => {
  const t = aidTodo(); if (t) return t;
  const st = enter(6, { options: AID_ON, support: [1, 3] }); // nobody holds a card
  const lc = E.legal(st, CCP);
  const pre = all(eq(st.turn, 6, "回合"), eq(lc.kind, "action", "空手、有蘇援的共軍在第 1 個行動回合"), eq(lc.cards && lc.cards.length, 0, "共軍的手牌數"),
    eq(lc.aid && lc.aid.id, "soviet_aid", "legal 給共軍的外援牌"), eq(lc.aid && lc.aid.ops, 1, "蘇援的行動點"));
  if (pre !== true) return pre;
  let a = null, b = null;
  const e1 = thrown(() => { a = act(st, CCP, "soviet_aid", "place", { points: ["taihang"] }); });
  if (e1 != null) return `共軍用蘇援在太行放 1 點被拒絕:${e1}`;
  const lk = aidOf(a, KMT);
  const e2 = thrown(() => { b = act(a, KMT, "american_aid", "place", { points: ["xuzhou", "xuzhou", "tianjin"] }); });
  if (e2 != null) return `國軍用美援扶植 3 點被拒絕:${e2}`;
  const off = toAction(enter(6, { support: [1, 3], hands: [[], KH3] })); // the rig's default: aid: false
  return all(
    eq(thrown(() => act(st, CCP, "american_aid", "place", { points: ["taihang"] })) != null, true, "共軍用美援沒有被拒絕"),
    eq(lk && lk.id, "american_aid", "共軍用完蘇援之後,legal 給國軍的外援牌"), eq(lk && lk.ops, 3, "美援的行動點"),
    eq(thrown(() => act(a, KMT, "soviet_aid", "place", { points: ["tianjin"] })) != null, true, "國軍用蘇援沒有被拒絕"),
    eq(b.turn, 7, "兩邊都用完之後走到的回合"), eq(J(b.aidUsed), "[false,false]", "第 7 回合開始後的 st.aidUsed"), eq(J(b.support), "[2,3]", "第 7 回合的支持度"),
    eq(aidOf(b, CCP) && aidOf(b, CCP).ops, 2, "第 7 回合蘇援的行動點"),
    eq(off.options.aid, false, "對照局的選項"), eq(off.actor, KMT, "aid: false 時空手的共軍被跳過"), eq(aidOf(off, KMT), null, "aid: false 時 legal 還給美援"),
    eq(thrown(() => act(off, KMT, "american_aid", "place", { points: ["tianjin"] })) != null, true, "aid: false 時用美援沒有被拒絕"),
    ok(true, "共軍只能用蘇援、國軍只能用美援;空手也要行動;第 7 回合兩張都回來(蘇援 2 點);aid: false 時沒有外援牌"),
  );
});

// Reported by BE at delivery, ruled by the orchestrator on #4: an aid card with nothing it could legally do
// is not a card to play. Without this a side with an empty hand would be asked to act and have no action.
check("外援牌沒有任何合法用法時不算可用:空手的一方被跳過,不會卡住", () => {
  const t = aidTodo(); if (t) return t;
  // No red anywhere, blue only in 天津 and 上海. The Communists cannot 扶植 (no influence to reach from),
  // cannot 遊說 (none of their own anywhere), and 美軍駐華 (美國支持 3) bars the only two spaces they could attack.
  const edits = Object.fromEntries(Object.keys(SPEC_SPACES).map((id) => [id, { r: 0, b: id === "tianjin" || id === "shanghai" ? 3 : 0 }]));
  const st = enter(6, { options: AID_ON, edits, support: [2, 3] }), free = enter(6, { options: AID_ON, edits, support: [2, 2] });
  const held = toAction(enter(6, { options: AID_ON, edits, support: [2, 3], hands: [["score_north", "gao_shuxun"], []] }));
  const o = E.opsOptions(st, CCP);
  const pre = all(
    eq(st.turn, 6, "回合"), eq(J(st.support), "[2,3]", "支持度"), eq(total(st, CCP), 0, "紅的合計"),
    eq(E.placeTargets(st, CCP, 2, [], "soviet_aid").lit.size, 0, "共軍用蘇援可以扶植的據點數"), eq(o.campaignTargets.length, 0, "共軍可以奇襲的據點數"), eq(o.lobbyTargets.length, 0, "共軍可以遊說的據點數"),
    eq(free.actor, CCP, "美國支持 2 時(天津、上海打得到)輪到誰(對照組)"), eq(aidOf(free, CCP) && aidOf(free, CCP).id, "soviet_aid", "美國支持 2 時 legal 給共軍的外援牌(對照組)"),
  );
  if (pre !== true) return pre;
  return all(
    eq(st.winner, null, "勝者"), eq(st.phase, "action", "phase"), eq(st.actor, KMT, "輪到誰(共軍沒有手牌,蘇援沒有任何用法)"),
    eq(J(E.mustAct(st)), J([KMT]), "mustAct"), eq(E.legal(st, CCP).kind, "wait", "共軍的 legal"), eq(J(st.aidUsed), "[false,false]", "st.aidUsed(蘇援沒有被用掉)"),
    eq(aidOf(st, KMT) && aidOf(st, KMT).id, "american_aid", "legal 給國軍的外援牌"),
    eq(held.actor, CCP, "共軍手上有牌時輪到誰"), eq(E.legal(held, CCP).kind, "action", "共軍手上有牌時的 legal"), eq((E.legal(held, CCP).cards || []).length, 1, "共軍可以打的手牌數"),
    eq(aidOf(held, CCP), null, "手上有牌、蘇援沒有任何用法時 legal 還給蘇援"),
    eq(thrown(() => act(held, CCP, "soviet_aid", "campaign", { target: "tianjin" })) != null, true, "沒有任何用法的蘇援打得出去"),
    ok(true, "蘇聯支持 2 但蘇援沒有地方可用:空手的共軍被跳過,輪到國軍(美援可用);手上有牌時蘇援不出現、手牌照常;美國支持降到 2、天津上海打得到時,共軍就要行動"),
  );
});

// ---------------------------------------------------------------- group 7
// 記分:根據地也算要衝 (issue #5). The rulebook's words, copied by hand (三, 記分; 二, 地圖; 三, 民生軌):
//   等級照縱橫(存在、優勢、獨佔),但算要衝時,城的要衝和根據地都算。每控制一個要衝或根據地另 +1。
//   ★ 城的要衝(9 個):奇襲它會推民生;民生惡化時先被封鎖。 根 根據地(5 個):記分時也算要衝。
//   縱橫的等級:存在 = 控制該區 ≥ 1 據點;優勢 = 控制據點數 > 對手 且 控制要衝數 > 對手;獨佔 = 控制該區全部據點。
//   why:不這樣的話,要衝全是城,共軍不先打下一座城就拿不到任何一區的優勢。
// Region values, keys and bases are SPEC above (group 0 holds the product's data to them).
// Expected levels and totals are worked out by hand from the opening's numbers, in the comments.
section("7 記分:根據地也算要衝");

const baseTodo = () => (E.DEFAULT_OPTIONS.baseScoring === undefined ? "TODO: DEFAULT_OPTIONS.baseScoring 還沒有;regionTally 還只算城的要衝" : null);
const tally = (st, region) => { const [c, k] = E.regionTally(st, region); return `共 ${c.level} ${c.total} / 國 ${k.level} ${k.total}`; };
// 華東中原 with 魯中 (red 5 against blue 2) and 淮海 (red 3 against blue 1) Communist, on top of 冀魯豫:
// the Communists hold 3 spaces, two of them 根據地; the Nationalists hold 徐州 (★) and 鄭州.
const EAST_BASES = { luzhong: { r: 5 }, huaihai: { r: 3 } };

check("開局五區的結算:根據地各 +1,而且算進「要衝數 > 對手」", () => {
  const t = baseTodo(); if (t) return t;
  const st = position();
  // 東北 nobody controls anything. 華北 共: 冀中, 太行(根) = 存在 4 + 1; 國: 天津★, 北平★ = 存在 4 + 2 (2 spaces each, no 優勢).
  // 華東中原 共: 冀魯豫(根) = 存在 4 + 1; 國: 徐州★, 鄭州 = 2 spaces to 1 but 1 要衝 to 1, so 存在 4 + 1, not 優勢.
  // 西北 共: 陝北(根) = 存在 2 + 1; 國: 西安★ = 存在 2 + 1. 後方 國: 武漢, 南京★, 上海★, 廣州 = 優勢 2 + 2; 共 nothing.
  const want = { northeast: "共 none 0 / 國 none 0", north: "共 presence 5 / 國 presence 6", east: "共 presence 5 / 國 presence 5", northwest: "共 presence 3 / 國 presence 3", rear: "共 none 0 / 國 domination 4" };
  for (const [region, w] of Object.entries(want)) { const q = eq(tally(st, region), w, `開局 ${E.REGIONS[region].zh} 的結算`); if (q !== true) return q; }
  return ok(true, Object.keys(want).map((r) => `${E.REGIONS[r].zh}:${tally(st, r)}`).join(";"));
});

check("根據地讓共軍拿到優勢:華東中原控制 3 個據點、其中 2 個根據地,對國軍的徐州★、鄭州", () => {
  const t = baseTodo(); if (t) return t;
  const st = position(EAST_BASES);
  const pre = all(same(["jiluyu", "luzhong", "huaihai"].filter((id) => E.controller(st, id) === CCP), ["jiluyu", "luzhong", "huaihai"], "共軍控制的"), same(E.spacesOf("east").filter((id) => E.controller(st, id) === KMT), ["xuzhou", "zhengzhou"], "國軍控制的"));
  if (pre !== true) return pre;
  // 共: 3 spaces > 2, 2 要衝 (two 根據地) > 1 → 優勢 8 + 2 = 10. 國: 存在 4 + 1 = 5. Net 5 to the Communists.
  deal(st, CCP, ["score_east"]);
  const after = E.apply(st, { type: "headline", side: CCP, card: "score_east" });
  return all(
    eq(tally(st, "east"), "共 domination 10 / 國 presence 5", "華東中原的結算"),
    eq(after.mandate - st.mandate, 5, "共軍打出華東中原記分卡之後民心的變動(正 = 往共軍)"),
    ok(true, `${tally(st, "east")};記分卡讓民心往共軍 5`),
  );
});

check("獨佔照舊是控制全部據點;加分把城的要衝和根據地都算進去(西北:西安★ + 陝北根)", () => {
  const t = baseTodo(); if (t) return t;
  const st = position({ xian: { r: 5, b: 0 }, lanzhou: { r: 3, b: 0 } });
  // 共 controls 陝北, 西安, 蘭州: 獨佔 4 + 1 (西安★) + 1 (陝北 根) = 6.
  return all(eq(tally(st, "northwest"), "共 control 6 / 國 none 0", "西北的結算"), ok(true, tally(st, "northwest")));
});

check("根據地只在記分時算要衝:奇襲它不推民生,凋敝時也不被封鎖", () => {
  const t = baseTodo(); if (t) return t;
  const S = toAction(enter(6, { hands: [[], KH3] }));
  const low = E.clone(S); low.weariness = 2;
  const kt = E.opsOptions(low, KMT).campaignTargets;
  const a = act(S, KMT, "kunming_incident", "campaign", { target: "jiluyu" });
  return all(
    eq(S.weariness, 5, "民生"), eq(rb(S, "jiluyu"), "3/0", "冀魯豫(根據地)紅/藍"),
    eq(rb(a, "jiluyu"), "1/0", "國軍 2 點奇襲冀魯豫之後 紅/藍"), eq(a.weariness, 5, "奇襲根據地之後的民生"),
    eq(kt.includes("jiluyu") && kt.includes("luzhong"), true, "凋敝時國軍還能奇襲華東中原的根據地(冀魯豫、魯中)"), eq(kt.includes("jinan") || kt.includes("xuzhou"), false, "凋敝時城的要衝(對照組)沒有被封鎖"),
    eq(E.SPACES.filter((x) => x.battleground).length, SPEC.cityKeys.length, "battleground 的據點數(只有城的要衝)"),
    ok(true, "打冀魯豫 3/0→1/0,民生不動;凋敝時根據地照打"),
  );
});

check("baseScoring 是一個開關:預設開;關掉時只算城的要衝(縱橫的算法)", () => {
  const t = baseTodo(); if (t) return t;
  const off = position({}, { baseScoring: false }), offEast = position(EAST_BASES, { baseScoring: false });
  const noKey = position(); delete noKey.options.baseScoring;
  // Without the bases: opening 華北 共 存在 4 + 0, 國 存在 4 + 2; 華東中原 國 2 spaces to 1 and 1 要衝 to 0 → 優勢 8 + 1, 共 存在 4;
  // 西北 共 2, 國 2 + 1. With EAST_BASES: 共 3 spaces but 0 要衝 → 存在 4; 國 存在 4 + 1.
  return all(
    eq(E.DEFAULT_OPTIONS.baseScoring, true, "DEFAULT_OPTIONS.baseScoring"), eq(off.options.baseScoring, false, "對照局的選項"),
    eq(tally(off, "north"), "共 presence 4 / 國 presence 6", "關掉時開局華北"), eq(tally(off, "east"), "共 presence 4 / 國 domination 9", "關掉時開局華東中原"),
    eq(tally(off, "northwest"), "共 presence 2 / 國 presence 3", "關掉時開局西北"), eq(tally(offEast, "east"), "共 presence 4 / 國 presence 5", "關掉時華東中原(共軍 3 個據點、2 個根據地)"),
    // A game created before #5 has no such key in its options: it keeps Zongheng's counting (silent under an
    // injected defect while #5 was verified; the probe saw it).
    eq(tally(noKey, "east"), "共 presence 4 / 國 domination 9", "選項裡沒有 baseScoring 的舊局,開局華東中原"),
    ok(true, "關掉時根據地不算:開局華東中原是國軍優勢 9 對 4;開著時是 5 對 5;沒有這個 key 的舊局照關掉算"),
  );
});

// ---------------------------------------------------------------- group 8
// The cards of 接收期 (issue #6): 24 events, one check each, and three for what all events share.
// Each check quotes its card's text from the rulebook's table (五, 牌表), copied by hand; the
// expected numbers come from that text and from the opening's numbers (SPEC_SPACES), not from cards.js.
// owner 裁決 (#4 thread, 2026-10-01): every card's test is written here, by the orchestrator.
//
// How a card is played: `holding(side, card)` gives that side, on turn 6 unless said otherwise (a
// turn whose 時局 changes no number), a scoring card to headline, the card, and a spare card of its
// own that only keeps the turn from walking on afterwards. The event's decisions are answered in the
// order and shape the brief of #6 lays down; `answer` says so when the engine asks something else.
section("8 牌:接收期");

// CW_FORCE=1 runs the checks of cards that are not done yet, to try the rig itself: each should then stop at "card event not implemented".
const cardTodo = (...cards) => { const left = process.env.CW_FORCE ? [] : cards.filter((id) => E.CARD[id].todo); return left.length ? `TODO: ${left.map((id) => E.CARD[id].zh).join("、")} 的事件還沒做` : null; };
const SPARE = [["shangdang_campaign", "gao_shuxun"], ["kunming_incident", "takeover_officials"]];
const answer = (st, who, kind, choice, what = "事件的決定") => { const p = pendingIs(st, who, kind, what); if (p !== true) throw new Error(p); return choose(st, choice); };
function holding(side, card, { turn = 6, extra = null, other = [], ...rest } = {}) {
  const mine = [side === CCP ? "score_north" : "score_east", card, ...(extra ?? [SPARE[side].find((c) => c !== card)])];
  let st = enter(turn, { ...rest, hands: side === CCP ? [mine, other] : [other, mine] });
  if (turn === 2) st = answer(st, KMT, "points", ["shenyang", "shenyang", "jinzhou", "jinzhou"], "第 2 回合的蘇軍撤離");
  return toAction(st);
}
// The same on turn 1, which the game reaches by itself.
function holding1(side, card, edits = {}) {
  const st = position(edits);
  deal(st, side, [side === CCP ? "score_north" : "score_east", card, SPARE[side].find((c) => c !== card)]);
  return toAction(st);
}
const ev = (st, side, card) => act(st, side, card, "event");
const opts = (st) => (st.pending && st.pending.options) || [];
const where = (st, id) => (st.removed.includes(id) ? "removed" : st.discard.includes(id) ? "discard" : st.hands[CCP].includes(id) || st.hands[KMT].includes(id) ? "hand" : "nowhere");
const citiesWhere = (st, pred) => Object.keys(SPEC_SPACES).filter((id) => SPEC_SPACES[id][0] === "city" && pred(id));
const isNE = (id) => SPEC_SPACES[id][1] === "northeast";
const room = (st, side, id) => E.infOf(st, id)[side] < SPEC_SPACES[id][2] + 2;
const reformWorth = (st, side) => { const c = E.clone(st); E.reformAdvance(c, side, 1); return c.mandate - st.mandate; }; // what one box is worth by itself, here

check("共通:事件帶 * 的觸發後移出遊戲,不帶 * 的進棄牌堆;對手的牌當行動點用,事件照樣觸發、由事件的主人結算", () => {
  const t = cardTodo("zhangjiakou_taken", "takeover_officials"); if (t) return t;
  // 佔領張家口 * (國軍牌): the Communists spend it for 3 ops, ops first; the event then runs for the Nationalists.
  const S = holding(CCP, "zhangjiakou_taken");
  const a = act(S, CCP, "zhangjiakou_taken", "place", { points: ["taihang", "jizhong", "jizhong"], order: "opsFirst" });
  const K = holding(KMT, "takeover_officials"), b = answer(ev(K, KMT, "takeover_officials"), KMT, "points", ["jinan", "xian", "kunming"]);
  return all(
    eq(`${redOf(a, "taihang")},${redOf(a, "jizhong")}`, "5,4", "共軍的 3 點:太行、冀中的紅"), eq(rb(a, "chasui"), "0/4", "事件照樣觸發:察綏 紅/藍"),
    eq(where(a, "zhangjiakou_taken"), "removed", "佔領張家口 *(事件觸發過)在哪裡"), eq(where(b, "takeover_officials"), "discard", "接收大員(不帶 *)在哪裡"),
    ok(true, "共軍用佔領張家口放 3 點,事件仍然替國軍清掉察綏;帶 * 的移出遊戲,不帶的進棄牌堆"),
  );
});

check("共通:標題階段兩邊各出一張事件,行動點高的先結算,平手共軍先", () => {
  const t = cardTodo("airlift", "kunming_incident", "shangdang_campaign"); if (t) return t;
  const order = (st) => st.log.filter((l) => l.type === "event" && l.t === 6).map((l) => l.card).join(" → ");
  const play = (ccp, kmt) => {
    let st = enter(6, { hands: [[ccp, "gao_shuxun"], [kmt, "takeover_officials"]] });
    st = E.apply(st, { type: "headline", side: KMT, card: kmt });
    return E.apply(st, { type: "headline", side: CCP, card: ccp });
  };
  const hi = play("shangdang_campaign", "airlift"), tie = play("shangdang_campaign", "kunming_incident");
  const p = pendingIs(hi, KMT, "points", "美軍空運(3 點)先結算"); if (p !== true) return p;
  return all(
    eq(order(hi), "airlift", "國軍 3 點對共軍 2 點:先開始的事件"), eq(rb(hi, "jinzhong"), "1/2", "這時上黨戰役還沒結算:晉中 紅/藍"),
    eq(order(tie), "shangdang_campaign → kunming_incident", "2 點對 2 點:事件的順序"), eq(tie.phase, "action", "兩張都結算完之後的 phase"),
    eq(rb(tie, "jinzhong"), "1/0", "上黨戰役結算了:晉中 紅/藍"), eq(blueOf(tie, "kunming"), 5, "昆明事變結算了:昆明的藍"),
    ok(true, `行動點高的先:${order(hi)}(等國軍選城);平手共軍先:${order(tie)}`),
  );
});

check("共通:事件沒有目標、或放不下時自己收尾,不會停在一個沒有答案的決定上", () => {
  const t = cardTodo("siping_taken", "into_manchuria"); if (t) return t;
  // 四平攻克 with no red anywhere in the Northeast; 闖關東 with the three villages of the Northeast full of red.
  const S = holding(KMT, "siping_taken", { edits: { beiman: { r: 0 } } }), a = ev(S, KMT, "siping_taken");
  const F = holding(CCP, "into_manchuria", { edits: { beiman: { r: 5 }, siping: { r: 4 }, liaoxi: { r: 4 } } }), b = ev(F, CCP, "into_manchuria");
  const end = (st) => st.log.filter((l) => l.type === "eventEnd").pop() || {};
  return all(
    eq(a.pending, null, "四平攻克沒有目標時還有待決定"), eq(a.round, 2, "之後是第幾個行動回合(那張牌佔掉了一個)"), eq(where(a, "siping_taken"), "removed", "四平攻克在哪裡"),
    eq(end(a).effect, false, "四平攻克的 eventEnd 說它有沒有效果"), eq(diff(blueMap(S), blueMap(a)), "無", "藍的變動"),
    eq(b.pending, null, "闖關東放不下時還有待決定"), eq(total(b, CCP), total(F, CCP), "紅的合計"), eq(where(b, "into_manchuria"), "removed", "闖關東在哪裡"),
    ok(true, "四平攻克(東北沒有紅)、闖關東(東北的鄉都滿了)都直接結束,牌照樣移出遊戲,行動回合照樣用掉"),
  );
});

// ---------- 接收期・國軍 (10)
check("受降令 *(3):國軍在最多 3 座沒有紅的城各放 1(東北除外)", () => {
  const t = cardTodo("surrender_order"); if (t) return t;
  // 太原 given 1 red; 濟南 cut off (魯中 Communist): an event may still place in a 孤城.
  const S = holding(KMT, "surrender_order", { edits: { ...JINAN_CUT, taiyuan: { r: 1 } } });
  const a = ev(S, KMT, "surrender_order");
  const p = pendingIs(a, KMT, "points", "受降令"); if (p !== true) return p;
  const want = citiesWhere(S, (id) => !isNE(id) && redOf(S, id) === 0 && room(S, KMT, id));
  const pre = all(same(E.isolatedCities(S), ["jinan"], "孤城"), eq(a.pending.n, 3, "要選的城數"), same(opts(a), want, "可以選的城(東北以外、沒有紅)"), eq(want.includes("taiyuan"), false, "太原有紅"),
    eq(thrown(() => choose(a, ["jinan", "jinan", "lanzhou"])) != null, true, "同一座城選兩次沒有被拒絕"));
  if (pre !== true) return pre;
  const b = choose(a, ["jinan", "lanzhou", "kunming"]);
  return all(
    eq(`${blueOf(b, "jinan")},${blueOf(b, "lanzhou")},${blueOf(b, "kunming")}`, "3,3,3", "濟南、蘭州、昆明的藍"), eq(total(b, KMT), total(S, KMT) + 3, "藍的合計"),
    eq(b.pending, null, "還有待決定"), eq(where(b, "surrender_order"), "removed", "牌在哪裡"),
    ok(true, `${want.length} 座可選(沒有太原、沒有東北);濟南(孤城)、蘭州、昆明各 +1`),
  );
});

check("美軍空運 *(3):國軍在任兩座城各放 2,不受相鄰限制;美國支持 < 3 時改成各放 1", () => {
  const t = cardTodo("airlift"); if (t) return t;
  const S = holding(KMT, "airlift", { support: [1, 4] }), low = holding(KMT, "airlift", { support: [1, 2] }), first = holding1(KMT, "airlift");
  const a = ev(S, KMT, "airlift");
  const p = pendingIs(a, KMT, "points", "美軍空運"); if (p !== true) return p;
  const b = choose(a, ["changchun", "kunming"]), c = answer(ev(low, KMT, "airlift"), KMT, "points", ["changchun", "kunming"]), f = ev(first, KMT, "airlift");
  return all(
    eq(a.pending.n, 2, "要選的城數"), same(opts(a), citiesWhere(S, (id) => room(S, KMT, id)), "可以選的城(每一座還放得下的城)"),
    eq(E.canPlaceAt(S, KMT, "changchun"), false, "長春在國軍的相鄰範圍內"),
    eq(`${blueOf(b, "changchun")},${blueOf(b, "kunming")}`, "2,4", "美國支持 4:長春、昆明的藍"), eq(`${blueOf(c, "changchun")},${blueOf(c, "kunming")}`, "1,3", "美國支持 2:長春、昆明的藍"),
    eq(first.turn, 1, "回合"), eq(opts(f).some(isNE), false, "第 1 回合(蘇軍佔領)可以選東北的城"),
    eq(where(b, "airlift"), "removed", "牌在哪裡"),
    ok(true, "支持 4:長春 0→2、昆明 2→4;支持 2:各 +1;第 1 回合不能選東北的城"),
  );
});

check("昆明事變 *(2):國軍在昆明放 3", () => {
  const t = cardTodo("kunming_incident"); if (t) return t;
  const S = holding(KMT, "kunming_incident"), a = ev(S, KMT, "kunming_incident");
  // 昆明 2 + 3 = 5 is its cap (安定 3): the Nationalists control it at the cap, so 滇 is 整編 and 民心 moves 1 their way.
  return all(
    eq(blueOf(a, "kunming"), 5, "昆明的藍"), eq(a.pending, null, "還有待決定"), eq(a.seals.dian, true, "滇的整編"), eq(a.mandate - S.mandate, -1, "民心的變動(整編,往國軍 1)"),
    eq(where(a, "kunming_incident"), "removed", "牌在哪裡"), ok(true, "昆明 2→5(上限),滇整編,民心往國軍 1"),
  );
});

check("接收大員(2):國軍在最多 3 座城各放 1;民心往共軍移 1;美國支持 −1", () => {
  const t = cardTodo("takeover_officials"); if (t) return t;
  const S = holding(KMT, "takeover_officials", { support: [1, 4] }), a = ev(S, KMT, "takeover_officials");
  const p = pendingIs(a, KMT, "points", "接收大員"); if (p !== true) return p;
  const b = choose(a, ["shenyang", "jinan", "xian"]);
  return all(
    eq(a.pending.n, 3, "要選的城數"), same(opts(a), citiesWhere(S, (id) => room(S, KMT, id)), "可以選的城"),
    eq(`${blueOf(b, "shenyang")},${blueOf(b, "jinan")},${blueOf(b, "xian")}`, "1,3,5", "瀋陽、濟南、西安的藍"),
    eq(b.mandate - S.mandate, 1, "民心的變動(往共軍 1)"), eq(J(b.support), "[1,3]", "支持度"), eq(where(b, "takeover_officials"), "discard", "牌在哪裡"),
    ok(true, "瀋陽、濟南、西安各 +1;民心往共軍 1;美國支持 4→3;牌進棄牌堆"),
  );
});

check("日軍留守 *(1):指定一座有藍的城,本回合不可被奇襲或遊說", () => {
  const t = cardTodo("japanese_garrisons", "kunming_incident"); if (t) return t;
  const S = holding(KMT, "japanese_garrisons", { edits: { xuzhou: { r: 1 } }, options: { turns: 6 } });
  const before = E.opsOptions(S, CCP), a = ev(S, KMT, "japanese_garrisons");
  const p = pendingIs(a, KMT, "points", "日軍留守"); if (p !== true) return p;
  const b = choose(a, ["xuzhou"]), after = E.opsOptions(b, CCP);
  const end = ev(b, KMT, "kunming_incident"); // the spare card; nobody holds a card after it, the turn (the last of this game) walks out
  return all(
    eq(a.pending.n, 1, "要選的城數"), same(opts(a), citiesWhere(S, (id) => blueOf(S, id) > 0), "可以選的城(有藍的城)"),
    eq(before.campaignTargets.includes("xuzhou") && ids(before.lobbyTargets).includes("xuzhou"), true, "指定之前共軍可以奇襲、遊說徐州"),
    eq(after.campaignTargets.includes("xuzhou"), false, "指定之後共軍還能奇襲徐州"), eq(ids(after.lobbyTargets).includes("xuzhou"), false, "指定之後共軍還能遊說徐州"),
    eq(after.campaignTargets.includes("zhengzhou"), true, "別的城(鄭州)也被擋了"),
    eq(end.winner != null, true, "回合走完(這一局只到第 6 回合)"), eq(E.isProtected(end, "xuzhou"), false, "回合結束後徐州還受保護"),
    eq(where(b, "japanese_garrisons"), "removed", "牌在哪裡"),
    ok(true, "徐州這一回合不能被奇襲或遊說,鄭州照常;回合結束後解除"),
  );
});

check("中蘇友好同盟條約 *(2):蘇聯支持 −1;民心往國軍移 1", () => {
  const t = cardTodo("sino_soviet_treaty"); if (t) return t;
  const S = holding(KMT, "sino_soviet_treaty", { support: [1, 3] }), a = ev(S, KMT, "sino_soviet_treaty");
  const Z = holding(KMT, "sino_soviet_treaty", { support: [0, 3] }), z = ev(Z, KMT, "sino_soviet_treaty");
  return all(
    eq(J(a.support), "[0,3]", "支持度"), eq(a.mandate - S.mandate, -1, "民心的變動(往國軍 1)"), eq(a.pending, null, "還有待決定"),
    eq(J(z.support), "[0,3]", "蘇聯支持已經是 0 時"), eq(z.mandate - Z.mandate, -1, "蘇聯支持已經是 0 時民心的變動"),
    eq(where(a, "sino_soviet_treaty"), "removed", "牌在哪裡"), ok(true, "蘇聯支持 1→0(0 就停在 0);民心往國軍 1"),
  );
});

check("還都南京 *(2):行憲軌前進 1;國軍在南京、上海各放 1", () => {
  const t = cardTodo("return_to_nanjing"); if (t) return t;
  const S = holding(KMT, "return_to_nanjing", { turn: 5 }), a = ev(S, KMT, "return_to_nanjing");
  // On turn 6 (行憲) an advance by an event sets off the 時局 like any other: 民心 1 more to the Nationalists, a Communist point.
  const S6 = holding(KMT, "return_to_nanjing", { turn: 6 }), a6 = ev(S6, KMT, "return_to_nanjing");
  const p = pendingIs(a6, CCP, "points", "第 6 回合的還都南京之後(行憲的時局)"); if (p !== true) return p;
  return all(
    eq(a.reform[KMT], 1, "行憲軌"), eq(a.mandate - S.mandate, reformWorth(S, KMT), "民心的變動(只有行憲軌那一格本身的)"),
    eq(`${blueOf(a, "nanjing")},${blueOf(a, "shanghai")}`, "5,4", "南京、上海的藍"), eq(a.pending, null, "第 5 回合還有待決定"),
    eq(a6.mandate - S6.mandate, reformWorth(S, KMT) - 1, "第 6 回合民心的變動(多往國軍 1)"), eq(`${blueOf(a6, "nanjing")},${blueOf(a6, "shanghai")}`, "5,4", "第 6 回合南京、上海的藍"),
    eq(where(a, "return_to_nanjing"), "removed", "牌在哪裡"),
    ok(true, "行憲軌 0→1;南京 4→5、上海 3→4;第 6 回合另外觸發行憲的時局"),
  );
});

check("軍事整編會議 *(4):國軍在五個本據各放 1,不受相鄰限制", () => {
  const t = cardTodo("reorganisation_conference"); if (t) return t;
  // 蘭州 already at its cap (5) against red 3, so nobody controls it and no 整編 follows.
  const S = holding(KMT, "reorganisation_conference", { edits: { lanzhou: { r: 3, b: 5 } } }), a = ev(S, KMT, "reorganisation_conference");
  return all(
    eq(["chasui", "taiyuan", "guilin", "lanzhou", "kunming"].map((id) => blueOf(a, id)).join(), "3,3,3,5,3", "察綏、太原、桂林、蘭州、昆明的藍"),
    eq(total(a, KMT), total(S, KMT) + 4, "藍的合計(蘭州在上限,多的消失)"), eq(diff(redMap(S), redMap(a)), "無", "紅的變動"),
    eq(a.pending, null, "還有待決定"), eq(where(a, "reorganisation_conference"), "removed", "牌在哪裡"),
    ok(true, "察綏 2→3、太原 2→3、桂林 2→3、昆明 2→3;蘭州在上限不動"),
  );
});

check("四平攻克 *(3):國軍對東北任一據點免費奇襲,行動點 +1(照樣推民生、受封鎖;算停戰的第一個奇襲)", () => {
  const t = cardTodo("siping_taken"); if (t) return t;
  const edits = { siping: { r: 2 }, shenyang: { r: 1 } };
  const S = holding(KMT, "siping_taken", { edits }), a = ev(S, KMT, "siping_taken");
  const p = pendingIs(a, KMT, "points", "四平攻克"); if (p !== true) return p;
  const village = choose(a, ["siping"]), city = choose(a, ["shenyang"]);
  const two = holding(KMT, "siping_taken", { turn: 2, edits: { siping: { r: 2 } } }), t2 = answer(ev(two, KMT, "siping_taken"), KMT, "points", ["siping"]);
  const one = holding1(KMT, "siping_taken", edits), t1 = ev(one, KMT, "siping_taken");
  // The Communists spend it for ops; the event's attack is the Nationalists', but 民生 is pushed by whoever played the card.
  const C = holding(CCP, "siping_taken", { edits }), c = answer(act(C, CCP, "siping_taken", "place", { points: ["taihang"], order: "opsFirst" }), KMT, "points", ["shenyang"], "共軍打出四平攻克之後");
  const tire = c.log.filter((l) => l.type === "tire").pop();
  return all(
    eq(a.pending.n, 1, "要選的據點數"), same(opts(a), ["beiman", "siping", "shenyang"], "可以選的據點(東北、有紅)"),
    eq(rb(village, "siping"), "0/2", "奇襲四平(鄉;3 + 1:移除 2、放 2)之後 紅/藍"), eq(village.weariness, 5, "奇襲四平之後的民生"),
    eq(rb(city, "shenyang"), "0/3", "奇襲瀋陽(城的要衝;移除 1、放 3)之後 紅/藍"), eq(city.weariness, 4, "奇襲瀋陽之後的民生"),
    eq(t2.mandate - two.mandate, 2, "第 2 回合(停戰)用它先動手,民心的變動(往共軍 2)"), eq(J(t2.support), "[1,3]", "第 2 回合用它先動手之後的支持度"),
    same(opts(t1), ["beiman", "siping"], "第 1 回合(蘇軍佔領)可以選的據點"),
    eq(rb(c, "shenyang"), "0/3", "共軍打出這張牌,國軍奇襲瀋陽之後 紅/藍"), eq(tire && tire.by, CCP, "推民生的是誰(打出牌的一方)"), eq(c.weariness, 4, "民生"),
    eq(where(village, "siping_taken"), "removed", "牌在哪裡"),
    ok(true, "四平 2/0→0/2;瀋陽 1/0→0/3 民生 5→4;停戰回合算先動手;第 1 回合打不到東北的城;共軍打出時民生算共軍推的"),
  );
});

check("佔領張家口 *(3):移除察綏的紅 2;國軍在察綏放 2", () => {
  const t = cardTodo("zhangjiakou_taken"); if (t) return t;
  const S = holding(KMT, "zhangjiakou_taken"), a = ev(S, KMT, "zhangjiakou_taken");
  // 察綏 0/4: blue at the cap (安定 2) and in control of 綏's seat, so 綏 is 整編.
  return all(
    eq(rb(a, "chasui"), "0/4", "察綏 紅/藍"), eq(a.seals.sui, true, "綏的整編"), eq(a.mandate - S.mandate, -1, "民心的變動(整編,往國軍 1)"),
    eq(a.pending, null, "還有待決定"), eq(where(a, "zhangjiakou_taken"), "removed", "牌在哪裡"), ok(true, "察綏 2/2→0/4,綏整編,民心往國軍 1"),
  );
});

// ---------- 接收期・共軍 (6)
check("闖關東 *(3):共軍在東北的鄉放 3(可分散),不受相鄰限制", () => {
  const t = cardTodo("into_manchuria"); if (t) return t;
  const S = holding(CCP, "into_manchuria"), a = ev(S, CCP, "into_manchuria");
  const p = pendingIs(a, CCP, "points", "闖關東"); if (p !== true) return p;
  const b = choose(a, ["liaoxi", "liaoxi", "siping"]);
  return all(
    eq(a.pending.n, 3, "要放的點數"), same(opts(a), ["beiman", "siping", "liaoxi"], "可以放的據點(東北的鄉)"), eq(E.canPlaceAt(S, CCP, "liaoxi"), false, "遼西在共軍的相鄰範圍內"),
    eq(thrown(() => choose(a, ["shenyang", "liaoxi", "siping"])) != null, true, "放在瀋陽(城)沒有被拒絕"),
    eq(`${redOf(b, "liaoxi")},${redOf(b, "siping")},${redOf(b, "beiman")}`, "2,1,1", "遼西、四平、北滿的紅"), eq(where(b, "into_manchuria"), "removed", "牌在哪裡"),
    ok(true, "遼西 +2、四平 +1(都不相鄰也可以)"),
  );
});

check("上黨戰役 *(2):移除晉中的藍 2;共軍在太行放 1", () => {
  const t = cardTodo("shangdang_campaign"); if (t) return t;
  const S = holding(CCP, "shangdang_campaign"), a = ev(S, CCP, "shangdang_campaign");
  return all(eq(rb(a, "jinzhong"), "1/0", "晉中 紅/藍"), eq(rb(a, "taihang"), "5/0", "太行 紅/藍"), eq(a.pending, null, "還有待決定"), eq(where(a, "shangdang_campaign"), "removed", "牌在哪裡"), ok(true, "晉中 1/2→1/0;太行 4→5"));
});

check("高樹勛起義 *(2):移除冀魯豫或冀中的全部藍(至多 2);共軍在那裡放 1", () => {
  const t = cardTodo("gao_shuxun"); if (t) return t;
  const S = holding(CCP, "gao_shuxun", { edits: { jizhong: { b: 3 } } }), a = ev(S, CCP, "gao_shuxun");
  const p = pendingIs(a, CCP, "points", "高樹勛起義"); if (p !== true) return p;
  const b = choose(a, ["jizhong"]), c = choose(a, ["jiluyu"]);
  return all(
    eq(a.pending.n, 1, "要選的據點數"), same(opts(a), ["jiluyu", "jizhong"], "可以選的據點"),
    eq(rb(S, "jizhong"), "2/3", "冀中 紅/藍"), eq(rb(b, "jizhong"), "3/1", "選冀中(藍 3,至多移除 2)之後 紅/藍"), eq(rb(c, "jiluyu"), "4/0", "選冀魯豫(沒有藍)之後 紅/藍"),
    eq(where(b, "gao_shuxun"), "removed", "牌在哪裡"), ok(true, "冀中 2/3→3/1;冀魯豫 3/0→4/0"),
  );
});

check("蘇軍移交裝備 *(3):蘇聯支持 +1;共軍在北滿放 2", () => {
  const t = cardTodo("soviet_arms"); if (t) return t;
  const S = holding(CCP, "soviet_arms", { support: [1, 4] }), a = ev(S, CCP, "soviet_arms"), top = ev(holding(CCP, "soviet_arms", { support: [4, 4] }), CCP, "soviet_arms");
  return all(eq(J(a.support), "[2,4]", "支持度"), eq(rb(a, "beiman"), "3/0", "北滿 紅/藍"), eq(J(top.support), "[4,4]", "蘇聯支持已經是 4 時"), eq(where(a, "soviet_arms"), "removed", "牌在哪裡"), ok(true, "蘇聯支持 1→2(4 就停在 4);北滿 1→3"));
});

check("五四指示 *(3):建軍軌前進 1;本回合共軍所有牌行動點 +1", () => {
  const t = cardTodo("may_fourth_directive", "shangdang_campaign"); if (t) return t;
  const S = holding(CCP, "may_fourth_directive", { options: { turns: 6 }, extra: ["shangdang_campaign"] }), a = ev(S, CCP, "may_fourth_directive");
  const end = ev(a, CCP, "shangdang_campaign"); // the spare; then the turn, the last of this game, walks out
  return all(
    eq(a.reform[CCP], 1, "建軍軌"), eq(a.mandate - S.mandate, reformWorth(S, CCP), "民心的變動(只有那一格本身的)"),
    eq(E.opsOf(S, CCP, "gao_shuxun"), 2, "之前高樹勛起義的行動點"), eq(E.opsOf(a, CCP, "gao_shuxun"), 3, "之後共軍的牌(高樹勛起義 2)的行動點"), eq(E.opsOf(a, KMT, "kunming_incident"), 2, "國軍的牌(昆明事變 2)的行動點"),
    eq(end.winner != null, true, "回合走完"), eq(E.opsOf(end, CCP, "gao_shuxun"), 2, "回合結束後共軍的牌的行動點"),
    eq(where(a, "may_fourth_directive"), "removed", "牌在哪裡"), ok(true, "建軍軌 0→1;這一回合共軍的牌 +1(2→3),國軍的不變;回合結束後恢復"),
  );
});

check("美國武器禁運 *(3):美國支持 −1;持續至回合結束:國軍所有牌行動點 −1(最低 1)", () => {
  const t = cardTodo("arms_embargo"); if (t) return t;
  const S = holding(CCP, "arms_embargo", { support: [1, 3] }), a = ev(S, CCP, "arms_embargo");
  return all(
    eq(J(a.support), "[1,2]", "支持度"), eq(E.opsOf(a, KMT, "surrender_order"), 2, "國軍的 3 點牌(受降令)"), eq(E.opsOf(a, KMT, "japanese_garrisons"), 1, "國軍的 1 點牌(日軍留守,最低 1)"),
    eq(E.opsOf(a, CCP, "gao_shuxun"), 2, "共軍的牌(高樹勛起義 2)"), eq(where(a, "arms_embargo"), "removed", "牌在哪裡"),
    ok(true, "美國支持 3→2;國軍的牌 3→2、1→1;共軍的不變"),
  );
});

// ---------- 接收期・中立 (8)
check("重慶談判 *(2):打出者民心 +1;民生回復 1", () => {
  const t = cardTodo("chongqing_talks"); if (t) return t;
  const K = holding(KMT, "chongqing_talks", { weariness: 3 }), k = ev(K, KMT, "chongqing_talks"), C = holding(CCP, "chongqing_talks", { weariness: 5 }), c = ev(C, CCP, "chongqing_talks");
  return all(
    eq(k.mandate - K.mandate, -1, "國軍打出:民心的變動"), eq(k.weariness, 4, "民生 3 回復 1"), eq(c.mandate - C.mandate, 1, "共軍打出:民心的變動"), eq(c.weariness, 5, "民生 5(復員)不再往上"),
    eq(where(k, "chongqing_talks"), "removed", "牌在哪裡"), ok(true, "誰打出誰 +1;民生 3→4,5 停在 5"),
  );
});

check("一月停戰令 *(3):民生回復 2;持續至回合結束:雙方奇襲 −1", () => {
  const t = cardTodo("january_truce"); if (t) return t;
  const S = holding(KMT, "january_truce", { weariness: 2, extra: ["kunming_incident", "takeover_officials"] }), a = ev(S, KMT, "january_truce");
  const b = act(a, KMT, "kunming_incident", "campaign", { target: "jizhong" });
  return all(
    eq(a.weariness, 4, "民生 2 回復 2"), eq(rb(a, "jizhong"), "2/0", "冀中 紅/藍"), eq(rb(b, "jizhong"), "1/0", "國軍 2 點 −1 奇襲冀中之後 紅/藍"),
    eq(E.campaignMod(a, CCP, "chasui"), -1, "共軍奇襲的加減"), eq(E.campaignMod(S, CCP, "chasui"), 0, "打出之前共軍奇襲的加減"),
    eq(where(a, "january_truce"), "removed", "牌在哪裡"), ok(true, "民生 2→4;這一回合雙方奇襲 −1(國軍 2 點打冀中只移除 1)"),
  );
});

check("馬歇爾調處(1):與手中另一張對手陣營的牌同時打出,那張牌事件不觸發、用它的行動點;美國支持 0 時只能當 1 點用", () => {
  const t = cardTodo("marshall_mission"); if (t) return t;
  const extra = ["gao_shuxun", "kunming_incident"]; // 高樹勛起義 is a Communist card of 2 ops
  const S = holding(KMT, "marshall_mission", { support: [1, 3], extra }), Z = holding(KMT, "marshall_mission", { support: [1, 0], extra });
  const uses = (st) => E.legal(st, KMT).cards.find((c) => c.id === "marshall_mission").uses;
  const a = act(S, KMT, "marshall_mission", "campaign", { target: "jizhong", pair: "gao_shuxun" });
  const z = act(Z, KMT, "marshall_mission", "campaign", { target: "jizhong" });
  return all(
    same(uses(S).pair || [], ["gao_shuxun"], "legal 給的可以配的牌"), eq((uses(Z).pair || []).length, 0, "美國支持 0 時可以配的牌數"),
    eq(rb(a, "jizhong"), "0/0", "配高樹勛起義(2 點)奇襲冀中之後 紅/藍"), eq(a.pending, null, "配的那張牌的事件觸發了(有待決定)"),
    eq(`${where(a, "marshall_mission")},${where(a, "gao_shuxun")}`, "discard,discard", "兩張牌在哪裡"), same(a.hands[KMT], ["kunming_incident"], "國軍剩下的手牌"),
    eq(thrown(() => act(Z, KMT, "marshall_mission", "campaign", { target: "jizhong", pair: "gao_shuxun" })) != null, true, "美國支持 0 時配牌沒有被拒絕"),
    eq(rb(z, "jizhong"), "1/0", "美國支持 0 時單獨當 1 點奇襲冀中之後 紅/藍"),
    eq(thrown(() => act(S, KMT, "marshall_mission", "campaign", { target: "jizhong", pair: "kunming_incident" })) != null, true, "配自己陣營的牌沒有被拒絕"),
    ok(true, "配共軍的 2 點牌打冀中 2/0→0/0,兩張都進棄牌堆、事件不觸發;美國支持 0 時只能單獨當 1 點"),
  );
});

check("政協決議 *(2):打出者變法軌前進 1;美國支持 +1", () => {
  const t = cardTodo("pcc_resolutions"); if (t) return t;
  const K = holding(KMT, "pcc_resolutions", { turn: 5, support: [1, 3] }), k = ev(K, KMT, "pcc_resolutions");
  const C = holding(CCP, "pcc_resolutions", { turn: 5, support: [1, 4] }), c = ev(C, CCP, "pcc_resolutions");
  // Turn 5 starts with 蘇聯支持 +1 (戰略反攻): [1, x] is [2, x] by the time the card is played.
  return all(
    eq(J(k.reform), "[0,1]", "國軍打出之後的變法軌 [建軍, 行憲]"), eq(J(k.support), "[2,4]", "國軍打出之後的支持度"), eq(k.mandate - K.mandate, reformWorth(K, KMT), "國軍打出:民心的變動"),
    eq(J(c.reform), "[1,0]", "共軍打出之後的變法軌"), eq(J(c.support), "[2,4]", "共軍打出、美國支持已經是 4 時"),
    eq(where(k, "pcc_resolutions"), "removed", "牌在哪裡"), ok(true, "誰打出誰的軌前進 1;美國支持 3→4(4 停在 4)"),
  );
});

check("蘇軍延期撤兵(2):持續至回合結束:東北的城不可被奇襲(只擋奇襲、只擋城)", () => {
  const t = cardTodo("soviets_delay"); if (t) return t;
  const S = holding(KMT, "soviets_delay", { edits: { shenyang: { r: 2, b: 1 }, siping: { r: 1, b: 1 } } }), a = ev(S, KMT, "soviets_delay");
  const tg = (st, side) => E.opsOptions(st, side).campaignTargets;
  return all(
    eq(tg(S, CCP).includes("shenyang") && tg(S, KMT).includes("shenyang"), true, "打出之前兩邊都可以奇襲瀋陽"),
    eq(tg(a, CCP).includes("shenyang") || tg(a, KMT).includes("shenyang"), false, "打出之後還有人能奇襲瀋陽"),
    eq(tg(a, CCP).includes("siping") && tg(a, KMT).includes("siping"), true, "東北的鄉(四平)也被擋了"),
    eq(ids(E.opsOptions(a, CCP).lobbyTargets).includes("shenyang"), true, "連遊說瀋陽也擋了"),
    eq(a.pending, null, "還有待決定"), eq(where(a, "soviets_delay"), "discard", "牌在哪裡"),
    eq(thrown(() => act(a, KMT, "kunming_incident", "campaign", { target: "shenyang" })) != null, true, "打一張牌奇襲瀋陽沒有被拒絕(apply)"),
    eq(thrown(() => act(a, KMT, "kunming_incident", "campaign", { target: "siping" })), null, "打一張牌奇襲四平被拒絕(apply)"),
    ok(true, "這一回合瀋陽兩邊都不能奇襲(清單裡沒有,打出來也被拒絕);四平照常;遊說照常;牌進棄牌堆"),
  );
});

check("蘇軍拆運 *(2):東北每座城雙方各移除 1;蘇聯支持 −1", () => {
  const t = cardTodo("soviet_removals"); if (t) return t;
  const S = holding(CCP, "soviet_removals", { support: [2, 4], edits: { changchun: { r: 2, b: 1 }, shenyang: { b: 2 }, jinzhou: { r: 1 }, siping: { r: 1, b: 1 } } }), a = ev(S, CCP, "soviet_removals");
  return all(
    eq(`${rb(a, "changchun")} ${rb(a, "shenyang")} ${rb(a, "jinzhou")}`, "1/0 0/1 0/0", "長春、瀋陽、錦州 紅/藍"), eq(rb(a, "siping"), "1/1", "四平(鄉)紅/藍"),
    eq(J(a.support), "[1,4]", "支持度"), eq(where(a, "soviet_removals"), "removed", "牌在哪裡"),
    ok(true, "長春 2/1→1/0、瀋陽 0/2→0/1、錦州 1/0→0/0;四平不動;蘇聯支持 2→1"),
  );
});

check("通貨膨脹(2):選一區,雙方各在自己控制的每座城移除 1(最少留 1)", () => {
  const t = cardTodo("inflation"); if (t) return t;
  const S = holding(KMT, "inflation", { edits: { xian: { r: 5, b: 0 } } }), a = ev(S, KMT, "inflation");
  const p = pendingIs(a, KMT, "option", "通貨膨脹"); if (p !== true) return p;
  const north = choose(a, "north"), rear = choose(a, "rear"), nw = choose(a, "northwest");
  return all(
    same(ids(opts(a)), Object.keys(SPEC.regionSizes), "可以選的區"),
    // 華北: the Nationalists control 天津 and 北平 (3 each); 太原 (2) is nobody's; the villages are not cities.
    eq(diff(blueMap(S), blueMap(north)), "天津 3→2、北平 3→2", "選華北:藍的變動"), eq(diff(redMap(S), redMap(north)), "無", "選華北:紅的變動"),
    // 後方: 武漢, 南京, 上海, 廣州 are controlled; 桂林 and 昆明 (2 against 安定 3) are not.
    eq(diff(blueMap(S), blueMap(rear)), "武漢 3→2、南京 4→3、上海 3→2、廣州 2→1", "選後方:藍的變動"),
    // 西北: the Communists control 西安 here (red 5); 蘭州 is nobody's; 陝北 is a village.
    eq(diff(redMap(S), redMap(nw)), "西安 5→4", "選西北:紅的變動"), eq(diff(blueMap(S), blueMap(nw)), "無", "選西北:藍的變動"),
    eq(where(north, "inflation"), "discard", "牌在哪裡"),
    ok(true, "華北:天津、北平各 −1;後方:四座控制的城各 −1;西北:共軍控制的西安 −1;沒有控制的城、鄉不動"),
  );
});

check("六月東北停戰 *(2):本回合東北不可奇襲;民生回復 1", () => {
  const t = cardTodo("june_truce"); if (t) return t;
  const S = holding(CCP, "june_truce", { weariness: 3, edits: { shenyang: { r: 2, b: 1 }, siping: { r: 1, b: 1 } } }), a = ev(S, CCP, "june_truce");
  const tg = (st, side) => E.opsOptions(st, side).campaignTargets, ne = (list) => list.filter(isNE);
  return all(
    eq(ne(tg(S, CCP)).length > 0 && ne(tg(S, KMT)).length > 0, true, "打出之前兩邊在東北都有奇襲目標"),
    eq(ne(tg(a, CCP)).length + ne(tg(a, KMT)).length, 0, "打出之後東北的奇襲目標數"), eq(tg(a, KMT).includes("jiluyu"), true, "東北以外(冀魯豫)也被擋了"),
    eq(a.weariness, 4, "民生 3 回復 1"), eq(where(a, "june_truce"), "removed", "牌在哪裡"),
    eq(thrown(() => act(a, CCP, "shangdang_campaign", "campaign", { target: "siping" })) != null, true, "打一張牌奇襲四平沒有被拒絕(apply)"),
    ok(true, "這一回合東北的城和鄉都不能奇襲(清單裡沒有,打出來也被拒絕);民生 3→4"),
  );
});

// ---------------------------------------------------------------- group 9
// The cards of 易勢期 (issue #7): 22 events, one check each. Same rig and same rules as group 8.
section("9 牌:易勢期");

// ---------- 易勢期・國軍 (8)
check("胡宗南佔延安 *(4):國軍對西北任一據點免費奇襲,行動點 +2,不受封鎖;移除「轉戰陝北」", () => {
  const t = cardTodo("hu_takes_yanan", "northern_shaanxi"); if (t) return t;
  // 民生 3 (通膨): 西北 is the opponent's home, closed to the Nationalists since 動盪. The card says 不受封鎖.
  const S = holding(KMT, "hu_takes_yanan", { weariness: 3, edits: { lanzhou: { r: 1 } } });
  const a = ev(S, KMT, "hu_takes_yanan");
  const p = pendingIs(a, KMT, "points", "胡宗南佔延安"); if (p !== true) return p;
  const b = choose(a, ["shanbei"]);
  // With 轉戰陝北 in play (−2 against the villages of 西北): the attack is made first, at 4 + 2 − 2, and the lasting card goes after it.
  const T = holding(CCP, "northern_shaanxi", { weariness: 3, other: ["score_east", "hu_takes_yanan", "kunming_incident"] });
  const t1 = ev(T, CCP, "northern_shaanxi"), t2 = answer(ev(t1, KMT, "hu_takes_yanan"), KMT, "points", ["shanbei"], "轉戰陝北在場時的胡宗南佔延安");
  const N = holding(CCP, "northern_shaanxi", { edits: { shanbei: { r: 0 } }, other: ["score_east", "hu_takes_yanan", "kunming_incident"] });
  const n2 = ev(ev(N, CCP, "northern_shaanxi"), KMT, "hu_takes_yanan"); // reported by BE: no red in 西北 at all
  return all(
    eq(E.opsOptions(S, KMT).campaignTargets.includes("shanbei"), false, "通膨時國軍平常能奇襲陝北(對照組)"),
    eq(a.pending.n, 1, "要選的據點數"), same(opts(a), ["shanbei", "lanzhou"], "可以選的據點(西北、有紅)"),
    eq(rb(b, "shanbei"), "0/2", "奇襲陝北(4 + 2:移除 4、放 2)之後 紅/藍"), eq(b.weariness, 3, "民生(陝北不是城的要衝)"), eq(where(b, "hu_takes_yanan"), "removed", "牌在哪裡"),
    eq(E.campaignMod(t1, KMT, "shanbei"), -2, "轉戰陝北在場時國軍打陝北的加減"),
    eq(rb(t2, "shanbei"), "0/0", "轉戰陝北在場時奇襲陝北(4 + 2 − 2:移除 4)之後 紅/藍"),
    eq(E.campaignMod(t2, KMT, "shanbei"), 0, "之後國軍打陝北的加減(轉戰陝北移除了)"), eq(where(t2, "northern_shaanxi"), "removed", "轉戰陝北那張牌在哪裡"),
    eq(n2.pending, null, "西北沒有紅時還有待決定"), eq(E.campaignMod(n2, KMT, "shanbei"), 0, "西北沒有紅時,打完國軍打陝北的加減(轉戰陝北照樣移除)"), eq(where(n2, "northern_shaanxi"), "removed", "西北沒有紅時轉戰陝北那張牌在哪裡"),
    ok(true, "通膨時照打陝北 4/0→0/2;轉戰陝北在場時只有 4 點(0/0),打完把它移出遊戲;沒有目標時照樣移除"),
  );
});

check("重點進攻山東 *(3):移除魯中的紅 2;國軍在濟南或徐州放 2", () => {
  const t = cardTodo("shandong_offensive"); if (t) return t;
  const S = holding(KMT, "shandong_offensive"), a = ev(S, KMT, "shandong_offensive");
  const p = pendingIs(a, KMT, "points", "重點進攻山東"); if (p !== true) return p;
  const j = choose(a, ["jinan"]), x = choose(a, ["xuzhou"]);
  return all(
    eq(a.pending.n, 1, "要選的城數"), same(opts(a), ["jinan", "xuzhou"], "可以選的城"),
    eq(rb(j, "luzhong"), "1/2", "魯中 紅/藍"), eq(blueOf(j, "jinan"), 4, "選濟南:濟南的藍"), eq(blueOf(x, "xuzhou"), 5, "選徐州:徐州的藍"),
    eq(where(j, "shandong_offensive"), "removed", "牌在哪裡"), ok(true, "魯中 3/2→1/2;濟南 2→4 或徐州 3→5"),
  );
});

check("戡亂動員令 *(2):持續至回合結束:國軍所有牌行動點 +1", () => {
  const t = cardTodo("mobilisation_order", "kunming_incident"); if (t) return t;
  const S = holding(KMT, "mobilisation_order", { options: { turns: 6 } }), a = ev(S, KMT, "mobilisation_order");
  const end = ev(a, KMT, "kunming_incident");
  return all(
    eq(E.opsOf(a, KMT, "takeover_officials"), 3, "國軍的 2 點牌(接收大員)"), eq(E.opsOf(a, CCP, "gao_shuxun"), 2, "共軍的 2 點牌"),
    eq(end.winner != null, true, "回合走完"), eq(E.opsOf(end, KMT, "takeover_officials"), 2, "回合結束後國軍的牌"),
    eq(where(a, "mobilisation_order"), "removed", "牌在哪裡"), ok(true, "這一回合國軍的牌 2→3,共軍的不變;回合結束後恢復"),
  );
});

check("取締民盟 *(2):移除任兩座城的紅各 1;民心往共軍移 1;美國支持 −1", () => {
  const t = cardTodo("league_banned"); if (t) return t;
  const S = holding(KMT, "league_banned", { support: [1, 4], edits: { jinan: { r: 1 }, xuzhou: { r: 1 }, wuhan: { r: 2 } } }), a = ev(S, KMT, "league_banned");
  const p = pendingIs(a, KMT, "points", "取締民盟"); if (p !== true) return p;
  const b = choose(a, ["wuhan", "jinan"]);
  const one = holding(KMT, "league_banned", { edits: { wuhan: { r: 2 } } }), o = ev(one, KMT, "league_banned");
  const none = holding(KMT, "league_banned", { support: [1, 4] }), z = ev(none, KMT, "league_banned"); // reported by BE
  return all(
    eq(a.pending.n, 2, "要選的城數"), same(opts(a), ["jinan", "xuzhou", "wuhan"], "可以選的城(有紅的城)"),
    eq(thrown(() => choose(a, ["wuhan", "wuhan"])) != null, true, "同一座城選兩次沒有被拒絕"),
    eq(`${redOf(b, "wuhan")},${redOf(b, "jinan")},${redOf(b, "xuzhou")}`, "1,0,1", "武漢、濟南、徐州的紅"),
    eq(b.mandate - S.mandate, 1, "民心的變動(往共軍 1)"), eq(J(b.support), "[1,3]", "支持度"),
    eq(o.pending && o.pending.n, 1, "只有一座城有紅時要選的城數"), eq(where(b, "league_banned"), "removed", "牌在哪裡"),
    eq(z.pending, null, "沒有城有紅時還有待決定"), eq(z.mandate - none.mandate, 1, "沒有城有紅時民心的變動"), eq(J(z.support), "[1,3]", "沒有城有紅時的支持度"),
    ok(true, "武漢 2→1、濟南 1→0;民心往共軍 1;美國支持 4→3"),
  );
});

check("陳誠主東北 *(2):國軍在瀋陽放 2、長春放 1", () => {
  const t = cardTodo("chen_cheng"); if (t) return t;
  const S = holding(KMT, "chen_cheng"), a = ev(S, KMT, "chen_cheng");
  return all(eq(`${blueOf(a, "shenyang")},${blueOf(a, "changchun")}`, "2,1", "瀋陽、長春的藍"), eq(total(a, KMT), total(S, KMT) + 3, "藍的合計"), eq(a.pending, null, "還有待決定"), eq(where(a, "chen_cheng"), "removed", "牌在哪裡"), ok(true, "瀋陽 0→2、長春 0→1"));
});

check("援華法案 *(3):美國支持 +1;國軍抽 1 張", () => {
  const t = cardTodo("china_aid_act"); if (t) return t;
  const S = holding(KMT, "china_aid_act", { support: [1, 3] });
  S.draw = ["yellow_river"]; // the only card in the draw pile
  const a = ev(S, KMT, "china_aid_act");
  return all(
    eq(J(a.support), "[1,4]", "支持度"), same(a.hands[KMT], ["kunming_incident", "yellow_river"], "國軍的手牌(備用牌 + 抽到的)"), eq(a.draw.length, 0, "牌庫剩下的張數"),
    eq(where(a, "china_aid_act"), "removed", "牌在哪裡"), ok(true, "美國支持 3→4;國軍抽到牌庫頂的黃河歸故"),
  );
});

check("行憲國大 *(2):行憲軌前進 1;國軍控制南京的話民心 +1", () => {
  const t = cardTodo("national_assembly"); if (t) return t;
  const S = holding(KMT, "national_assembly", { turn: 5 }), a = ev(S, KMT, "national_assembly");
  const N = holding(KMT, "national_assembly", { turn: 5, edits: { nanjing: { r: 1 } } }), n = ev(N, KMT, "national_assembly");
  return all(
    eq(E.controller(S, "nanjing"), KMT, "南京的控制者"), eq(a.reform[KMT], 1, "行憲軌"), eq(a.mandate - S.mandate, reformWorth(S, KMT) - 1, "控制南京:民心的變動(那一格本身的,再往國軍 1)"),
    eq(E.controller(N, "nanjing"), null, "南京有 1 紅時的控制者"), eq(n.mandate - N.mandate, reformWorth(N, KMT), "不控制南京:民心的變動(只有那一格本身的)"),
    eq(where(a, "national_assembly"), "removed", "牌在哪裡"), ok(true, "行憲軌 0→1;控制南京時民心再往國軍 1"),
  );
});

check("美械整編師(3):持續至回合結束:國軍奇襲行動點 +1。美國支持 < 2 時無效", () => {
  const t = cardTodo("american_divisions"); if (t) return t;
  const S = holding(KMT, "american_divisions", { support: [1, 2], extra: ["kunming_incident", "takeover_officials"] }), a = ev(S, KMT, "american_divisions");
  const b = act(a, KMT, "kunming_incident", "campaign", { target: "jizhong" });
  const low = ev(holding(KMT, "american_divisions", { support: [1, 1] }), KMT, "american_divisions");
  return all(
    eq(E.campaignMod(S, KMT, "jizhong"), 0, "打出之前國軍奇襲的加減"), eq(E.campaignMod(a, KMT, "jizhong"), 1, "美國支持 2:國軍奇襲的加減"), eq(E.campaignMod(a, CCP, "chasui"), 0, "共軍奇襲的加減"),
    eq(rb(b, "jizhong"), "0/1", "國軍 2 點 +1 奇襲冀中之後 紅/藍"),
    eq(E.campaignMod(low, KMT, "jizhong"), 0, "美國支持 1:國軍奇襲的加減(無效)"), eq(where(a, "american_divisions"), "discard", "牌在哪裡"),
    ok(true, "美國支持 2:這一回合國軍奇襲 +1(冀中 2/0→0/1);支持 1:無效;牌進棄牌堆"),
  );
});

// ---------- 易勢期・共軍 (8)
check("轉戰陝北(2):持續:國軍對西北的鄉奇襲行動點 −2。「胡宗南佔延安」觸發時移除", () => {
  const t = cardTodo("northern_shaanxi"); if (t) return t;
  const S = holding(CCP, "northern_shaanxi", { other: ["score_east", "surrender_order", "kunming_incident"] }), a = ev(S, CCP, "northern_shaanxi");
  const b = act(a, KMT, "surrender_order", "campaign", { target: "shanbei" });
  const fx = a.effects.find((e) => e.card === "northern_shaanxi");
  return all(
    eq(E.campaignMod(a, KMT, "shanbei"), -2, "國軍打陝北(西北的鄉)的加減"), eq(E.campaignMod(a, KMT, "xian"), 0, "國軍打西安(城)的加減"), eq(E.campaignMod(a, CCP, "shanbei"), 0, "共軍的加減"), eq(E.campaignMod(a, KMT, "jizhong"), 0, "國軍打別區的鄉的加減"),
    eq(rb(b, "shanbei"), "3/0", "國軍 3 點 −2 奇襲陝北之後 紅/藍"),
    eq(!!fx && fx.until !== "turn", true, "效果是持續的(不在回合結束時消失)"), eq(where(a, "northern_shaanxi"), "discard", "牌在哪裡(還沒有被移除)"),
    ok(true, "國軍打陝北 −2(3 點只移除 1);西安、別區、共軍都不受影響;效果跨回合"),
  );
});

check("孟良崮 *(3):移除魯中或淮海的全部藍(至多 3)", () => {
  const t = cardTodo("menglianggu"); if (t) return t;
  const S = holding(CCP, "menglianggu", { edits: { luzhong: { b: 4 } } }), a = ev(S, CCP, "menglianggu");
  const p = pendingIs(a, CCP, "points", "孟良崮"); if (p !== true) return p;
  const l = choose(a, ["luzhong"]), h = choose(a, ["huaihai"]);
  return all(
    eq(a.pending.n, 1, "要選的據點數"), same(opts(a), ["luzhong", "huaihai"], "可以選的據點"),
    eq(rb(l, "luzhong"), "3/1", "選魯中(藍 4,至多移除 3)之後 紅/藍"), eq(rb(h, "huaihai"), "2/0", "選淮海(藍 1)之後 紅/藍"),
    eq(where(l, "menglianggu"), "removed", "牌在哪裡"), ok(true, "魯中 3/4→3/1;淮海 2/1→2/0"),
  );
});

check("挺進大別山 *(3):共軍在大別山放 3;若因此控制大別山,移除武漢或鄭州的藍 1", () => {
  const t = cardTodo("dabie_march"); if (t) return t;
  // 大別山 2/2, 安定 2, cap 4: the third point is lost, red 4 against blue 2 is control, and it was not before.
  const S = holding(CCP, "dabie_march"), a = ev(S, CCP, "dabie_march");
  const p = pendingIs(a, CCP, "points", "挺進大別山(因此控制了大別山)"); if (p !== true) return p;
  const w = choose(a, ["wuhan"]);
  const had = ev(holding(CCP, "dabie_march", { edits: { dabieshan: { r: 4 } } }), CCP, "dabie_march"); // controlled already: not 因此
  const not = ev(holding(CCP, "dabie_march", { edits: { dabieshan: { r: 0 } } }), CCP, "dabie_march"); // 3 against 2: no control
  return all(
    eq(rb(a, "dabieshan"), "4/2", "大別山 紅/藍"), eq(a.pending.n, 1, "要選的城數"), same(opts(a), ["wuhan", "zhengzhou"], "可以選的城"),
    eq(blueOf(w, "wuhan"), 2, "選武漢:武漢的藍"), eq(blueOf(w, "zhengzhou"), 2, "鄭州的藍"),
    eq(had.pending, null, "本來就控制大別山時還有待決定"), eq(`${blueOf(had, "wuhan")},${blueOf(had, "zhengzhou")}`, "3,2", "本來就控制時武漢、鄭州的藍"),
    eq(rb(not, "dabieshan"), "3/2", "大別山沒有紅時放完 紅/藍"), eq(not.pending, null, "沒有因此控制時還有待決定"),
    eq(where(w, "dabie_march"), "removed", "牌在哪裡"), ok(true, "大別山 2/2→4/2,因此控制,武漢 3→2;本來就控制、或放完還沒控制,都不移除"),
  );
});

check("土地法大綱 *(2):建軍軌前進 1;共軍在任兩個自己控制的鄉各放 1", () => {
  const t = cardTodo("land_law"); if (t) return t;
  const S = holding(CCP, "land_law"), a = ev(S, CCP, "land_law");
  const p = pendingIs(a, CCP, "points", "土地法大綱"); if (p !== true) return p;
  const b = choose(a, ["jizhong", "shanbei"]);
  return all(
    eq(a.reform[CCP], 1, "建軍軌"), eq(a.mandate - S.mandate, reformWorth(S, CCP), "民心的變動(只有那一格本身的)"),
    eq(a.pending.n, 2, "要選的鄉數"), same(opts(a), ["jizhong", "taihang", "jiluyu", "shanbei"], "可以選的鄉(共軍控制的)"),
    eq(thrown(() => choose(a, ["shanbei", "shanbei"])) != null, true, "同一個鄉選兩次沒有被拒絕"),
    eq(`${redOf(b, "jizhong")},${redOf(b, "shanbei")}`, "3,5", "冀中、陝北的紅"), eq(where(b, "land_law"), "removed", "牌在哪裡"),
    ok(true, "建軍軌 0→1;冀中 2→3、陝北 4→5"),
  );
});

check("晉中戰役 *(3):移除晉中的全部藍(至多 3);共軍在晉中放 1", () => {
  const t = cardTodo("central_shanxi_campaign"); if (t) return t;
  const a = ev(holding(CCP, "central_shanxi_campaign"), CCP, "central_shanxi_campaign"), b = ev(holding(CCP, "central_shanxi_campaign", { edits: { jinzhong: { b: 4 } } }), CCP, "central_shanxi_campaign");
  return all(eq(rb(a, "jinzhong"), "2/0", "晉中(1/2)之後 紅/藍"), eq(rb(b, "jinzhong"), "2/1", "晉中(1/4,至多移除 3)之後 紅/藍"), eq(a.pending, null, "還有待決定"), eq(where(a, "central_shanxi_campaign"), "removed", "牌在哪裡"), ok(true, "晉中 1/2→2/0;藍 4 時剩 1"));
});

check("東北冬季攻勢 *(3):共軍對東北任一個鄉免費奇襲,行動點 +1;若因此控制它,在相鄰的一座城放 1", () => {
  const t = cardTodo("winter_offensive"); if (t) return t;
  const edits = { siping: { b: 2 }, liaoxi: { b: 1 }, shenyang: { b: 1 } };
  const S = holding(CCP, "winter_offensive", { edits }), a = ev(S, CCP, "winter_offensive");
  const p = pendingIs(a, CCP, "points", "東北冬季攻勢"); if (p !== true) return p;
  const b = choose(a, ["siping"]);
  const q = pendingIs(b, CCP, "points", "因此控制了四平"); if (q !== true) return q;
  const c = choose(b, ["shenyang"]);
  const strong = holding(CCP, "winter_offensive", { edits: { siping: { b: 4 } } }), s = answer(ev(strong, CCP, "winter_offensive"), CCP, "points", ["siping"]);
  const five = holding(CCP, "winter_offensive", { turn: 5, edits }), f = answer(ev(five, CCP, "winter_offensive"), CCP, "points", ["siping"]);
  const held = holding(CCP, "winter_offensive", { edits: { siping: { r: 4, b: 1 } } }), h = answer(ev(held, CCP, "winter_offensive"), CCP, "points", ["siping"]); // reported by BE: nothing held this
  return all(
    eq(a.pending.n, 1, "要選的鄉數"), same(opts(a), ["siping", "liaoxi"], "可以選的鄉(東北、有藍;瀋陽是城)"),
    eq(rb(b, "siping"), "2/0", "奇襲四平(3 + 1:移除 2、放 2)之後 紅/藍"), same(opts(b), ["changchun", "shenyang"], "可以放的城(與四平相鄰)"),
    eq(redOf(c, "shenyang"), 1, "選瀋陽:瀋陽的紅"), eq(c.pending, null, "還有待決定"),
    eq(rb(s, "siping"), "0/0", "四平藍 4 時(移除 4)之後 紅/藍"), eq(s.pending, null, "沒有因此控制時還有待決定"),
    eq(rb(f, "siping"), "3/0", "第 5 回合(戰略反攻,共軍打鄉再 +1)之後 紅/藍"),
    eq(E.controller(held, "siping"), CCP, "四平紅 4 藍 1 時的控制者"), eq(rb(h, "siping"), "4/0", "本來就控制四平時奇襲之後 紅/藍"), eq(h.pending, null, "本來就控制時還有待決定"),
    eq(where(c, "winter_offensive"), "removed", "牌在哪裡"), ok(true, "四平 0/2→2/0,因此控制,瀋陽放 1;藍 4 時打成 0/0 不控制;第 5 回合是 5 點"),
  );
});

check("熊向暉 *(1):查看國軍手牌", () => {
  const t = cardTodo("xiong_xianghui"); if (t) return t;
  const S = holding(CCP, "xiong_xianghui", { other: ["score_east", "kunming_incident", "surrender_order"] }), a = ev(S, CCP, "xiong_xianghui");
  return all(
    eq(E.view(S, CCP).hands[KMT], null, "打出之前共軍看得到國軍的手牌"), same(E.view(a, CCP).hands[KMT] || [], a.hands[KMT], "打出之後共軍看到的國軍手牌"),
    eq(a.hands[KMT].length, 2, "國軍的手牌數"), eq(E.view(a, KMT).hands[CCP], null, "國軍看得到共軍的手牌"), eq(where(a, "xiong_xianghui"), "removed", "牌在哪裡"),
    ok(true, "共軍看得到國軍的 2 張手牌;反過來看不到"),
  );
});

check("五二〇學潮 *(2):共軍在北平、上海、南京之中任兩座各放 1;民心往共軍移 1", () => {
  const t = cardTodo("may_twentieth"); if (t) return t;
  const S = holding(CCP, "may_twentieth"), a = ev(S, CCP, "may_twentieth");
  const p = pendingIs(a, CCP, "points", "五二〇學潮"); if (p !== true) return p;
  const b = choose(a, ["shanghai", "nanjing"]);
  return all(
    eq(a.pending.n, 2, "要選的城數"), same(opts(a), ["beiping", "shanghai", "nanjing"], "可以選的城"), eq(thrown(() => choose(a, ["nanjing", "nanjing"])) != null, true, "同一座城選兩次沒有被拒絕"),
    eq(`${redOf(b, "shanghai")},${redOf(b, "nanjing")},${redOf(b, "beiping")}`, "1,1,0", "上海、南京、北平的紅"), eq(b.mandate - S.mandate, 1, "民心的變動(往共軍 1)"),
    eq(where(b, "may_twentieth"), "removed", "牌在哪裡"), ok(true, "上海、南京各 +1 紅(不相鄰也可以);民心往共軍 1"),
  );
});

// ---------- 易勢期・中立 (6)
check("杜魯門主義 *(2):美國支持 +1;蘇聯支持 +1", () => {
  const t = cardTodo("truman_doctrine"); if (t) return t;
  const a = ev(holding(KMT, "truman_doctrine", { support: [1, 3] }), KMT, "truman_doctrine"), top = ev(holding(CCP, "truman_doctrine", { support: [4, 4] }), CCP, "truman_doctrine");
  return all(eq(J(a.support), "[2,4]", "支持度"), eq(J(top.support), "[4,4]", "兩條都是 4 時"), eq(where(a, "truman_doctrine"), "removed", "牌在哪裡"), ok(true, "蘇聯 1→2、美國 3→4;4 停在 4"));
});

check("魏德邁調查團 *(2):民生在復員或動盪的話美國支持 +1;否則美國支持 −1", () => {
  const t = cardTodo("wedemeyer_mission"); if (t) return t;
  const hi = ev(holding(KMT, "wedemeyer_mission", { support: [1, 3], weariness: 4 }), KMT, "wedemeyer_mission"), lo = ev(holding(KMT, "wedemeyer_mission", { support: [1, 3], weariness: 3 }), KMT, "wedemeyer_mission");
  return all(eq(J(hi.support), "[1,4]", "民生動盪(4)"), eq(J(lo.support), "[1,2]", "民生通膨(3)"), eq(where(hi, "wedemeyer_mission"), "removed", "牌在哪裡"), ok(true, "動盪:美國支持 3→4;通膨:3→2"));
});

check("黃河歸故 *(2):華東中原每個鄉雙方各移除 1;民生回復 1", () => {
  const t = cardTodo("yellow_river"); if (t) return t;
  const S = holding(CCP, "yellow_river", { weariness: 3 }), a = ev(S, CCP, "yellow_river");
  return all(
    eq(["jiluyu", "luzhong", "huaihai", "dabieshan"].map((id) => rb(a, id)).join(" "), "2/0 2/1 1/0 1/1", "冀魯豫、魯中、淮海、大別山 紅/藍"),
    eq(["jinan", "xuzhou", "zhengzhou"].map((id) => rb(a, id)).join(" "), "0/2 0/3 0/2", "濟南、徐州、鄭州(城)紅/藍"), eq(rb(a, "jizhong"), "2/0", "冀中(華北的鄉)紅/藍"),
    eq(a.weariness, 4, "民生 3 回復 1"), eq(where(a, "yellow_river"), "removed", "牌在哪裡"),
    ok(true, "華東中原四個鄉雙方各 −1;城和別區不動;民生 3→4"),
  );
});

check("潛伏(1):對手展示手牌;打出者指定 1 張,對手下一個行動回合必須打出,用法自選", () => {
  const t = cardTodo("sleeper"); if (t) return t;
  const S = holding(CCP, "into_manchuria", { extra: ["gao_shuxun", "shangdang_campaign"], other: ["score_east", "sleeper", "kunming_incident"] });
  const c1 = act(S, CCP, "into_manchuria", "place", { points: ["taihang"] }); // the Communists' own card, for ops: nothing fires
  const a = ev(c1, KMT, "sleeper");
  const p = pendingIs(a, KMT, "card", "潛伏"); if (p !== true) return p;
  const seen = E.view(a, KMT).hands[CCP], b = choose(a, ["gao_shuxun"]);
  const cards = E.legal(b, CCP).cards || [];
  return all(
    same(opts(a), ["gao_shuxun", "shangdang_campaign"], "可以指定的牌(共軍的手牌)"), same(seen || [], ["gao_shuxun", "shangdang_campaign"], "回答時國軍看到的共軍手牌"),
    eq(b.forced[CCP], "gao_shuxun", "共軍被指定的牌"), eq(b.actor, CCP, "輪到誰"), same(cards.map((c) => c.id), ["gao_shuxun"], "共軍這個行動回合可以打的牌"),
    eq(thrown(() => act(b, CCP, "shangdang_campaign", "place", { points: ["taihang"] })) != null, true, "共軍打另一張牌沒有被拒絕"),
    eq(cards[0] && !!cards[0].uses.place && cards[0].uses.event, true, "被指定的牌用法自選(扶植、事件都在)"),
    eq(where(b, "sleeper"), "discard", "牌在哪裡"), ok(true, "國軍看到共軍的 2 張牌,指定高樹勛起義;共軍下一個行動回合只能打它,用法自選"),
  );
});

check("戰略機動(3):打出者移除自己 4 點,重新分配到任意據點,每處最多 2 點,不受相鄰限制", () => {
  const t = cardTodo("redeployment"); if (t) return t;
  const S = holding(KMT, "redeployment"), a = ev(S, KMT, "redeployment");
  const p = pendingIs(a, KMT, "points", "戰略機動:移除"); if (p !== true) return p;
  const pre = all(eq(a.pending.n, 4, "要移除的點數"), same(opts(a), Object.keys(SPEC_SPACES).filter((id) => blueOf(S, id) > 0), "可以移除的據點(有藍的)"),
    eq(thrown(() => choose(a, ["guangzhou", "guangzhou", "guangzhou", "xian"])) != null, true, "從廣州(藍 2)移除 3 點沒有被拒絕"));
  if (pre !== true) return pre;
  const b = choose(a, ["nanjing", "nanjing", "wuhan", "xian"]);
  const q = pendingIs(b, KMT, "points", "戰略機動:重新分配"); if (q !== true) return q;
  const c = choose(b, ["jinan", "jinan", "changchun", "changchun"]);
  return all(
    eq(b.pending.n, 4, "要放的點數"), eq(opts(b).includes("changchun") && opts(b).includes("beiman"), true, "可以放的據點包含不相鄰的長春、北滿"),
    eq(thrown(() => choose(b, ["jinan", "jinan", "jinan", "changchun"])) != null, true, "同一處放 3 點沒有被拒絕"),
    eq(["nanjing", "wuhan", "xian", "jinan", "changchun"].map((id) => blueOf(c, id)).join(), "2,2,3,4,2", "南京、武漢、西安、濟南、長春的藍"), eq(total(c, KMT), total(S, KMT), "藍的合計"),
    eq(where(c, "redeployment"), "discard", "牌在哪裡"), ok(true, "南京 −2、武漢 −1、西安 −1;濟南 +2、長春 +2;合計不變"),
  );
});

check("久攻不下(3):持續:對手下一個行動回合開始時須棄 1 張行動點 ≥ 2 的牌作為該次行動,然後解除", () => {
  const t = cardTodo("stalled_siege"); if (t) return t;
  const S = holding(CCP, "into_manchuria", { extra: ["gao_shuxun", "xiong_xianghui"], other: ["score_east", "stalled_siege", "kunming_incident"] });
  const c1 = act(S, CCP, "into_manchuria", "place", { points: ["taihang"] });
  const a = ev(c1, KMT, "stalled_siege"), l = E.legal(a, CCP);
  let b = null;
  const e = thrown(() => { b = act(a, CCP, "gao_shuxun", "bog"); });
  if (e != null) return `共軍棄高樹勛起義(2 點)被拒絕:${e}`;
  return all(
    eq(a.actor, CCP, "輪到誰"), same(l.bog || [], ["gao_shuxun"], "共軍必須棄的牌(行動點 ≥ 2 的;熊向暉只有 1)"), eq((l.cards || []).length, 0, "共軍可以正常打的牌數"),
    eq(thrown(() => act(a, CCP, "xiong_xianghui", "event")) != null, true, "共軍不棄牌、照常打出熊向暉沒有被拒絕"),
    same(b.hands[CCP], ["xiong_xianghui"], "棄牌之後共軍的手牌"), eq(where(b, "gao_shuxun"), "discard", "棄的牌在哪裡"), eq(b.actor, KMT, "棄牌佔掉了那個行動回合,輪到"),
    eq(b.effects.some((x) => x.kind === "bog"), false, "棄完之後效果還在"), eq(where(a, "stalled_siege"), "discard", "久攻不下那張牌在哪裡"),
    ok(true, "共軍下一個行動回合只能棄高樹勛起義(事件不觸發),棄完解除"),
  );
});

// ---------------------------------------------------------------- group 10
// The cards of 決戰期 (issue #8): 21 events, one check each. Same rig and same rules as groups 8 and 9.
section("10 牌:決戰期");

// What the board and 民心 were when each turn ended, while `fn` runs (the engine's own hook for it).
function turnEnds(fn) {
  const seen = [], prev = E.probe.turnEnd;
  E.probe.turnEnd = (s) => { seen.push({ turn: s.turn, mandate: s.mandate, inf: E.clone(s.inf) }); };
  try { fn(); } finally { E.probe.turnEnd = prev; }
  return seen;
}
// The side's spare card spent for one point, after which nobody holds a card and the turn walks out.
const spend = (st, side, card, id) => act(st, side, card, "place", { points: [id] });

// ---------- 決戰期・國軍 (5)
check("金圓券 *(2):民生回復 2;本回合國軍所有牌行動點 +1;回合結算時民心往共軍移 2", () => {
  const t = cardTodo("gold_yuan", "reorganisation_conference"); if (t) return t;
  // The spare is 軍事整編會議 *: played as its event it leaves the game and moves no 民心. With the discard pile emptied
  // by hand nothing is left to deal on turn 7, so the walk goes on through turn 7's 結算 as well.
  const S = holding(KMT, "gold_yuan", { weariness: 2, extra: ["reorganisation_conference"] }), a = ev(S, KMT, "gold_yuan");
  a.discard = [];
  const seen = turnEnds(() => ev(a, KMT, "reorganisation_conference"));
  const six = seen.find((x) => x.turn === 6), seven = seen.find((x) => x.turn === 7);
  if (!six || !seven) return `沒有走到第 6、7 回合的結算(走過的回合:${seen.map((x) => x.turn)})`;
  return all(
    eq(a.weariness, 4, "民生 2 回復 2"), eq(E.opsOf(a, KMT, "takeover_officials"), 3, "國軍的 2 點牌"), eq(E.opsOf(a, CCP, "gao_shuxun"), 2, "共軍的 2 點牌"), eq(a.mandate - S.mandate, 0, "打出當下民心的變動"),
    eq(six.mandate - a.mandate, 2, "第 6 回合結算時民心的變動(往共軍 2)"), eq(seven.mandate - six.mandate, 0, "下一個回合結算時又移了一次"),
    eq(where(a, "gold_yuan"), "removed", "牌在哪裡"), ok(true, "民生 2→4;這一回合國軍的牌 +1;回合結算時民心往共軍 2,只算一次"),
  );
});

// orchestrator 裁決 (#8), asked by BE: 傅冬菊 lifts 金圓券's +1, a lasting effect; the 民心 the card costs at 結算 is not one, and stays owed.
check("傅冬菊拿掉金圓券:國軍的牌不再 +1,回合結算的民心照付", () => {
  const t = cardTodo("fu_dongju", "gold_yuan", "reorganisation_conference"); if (t) return t;
  const S = holding(CCP, "into_manchuria", { extra: ["fu_dongju"], other: ["score_east", "gold_yuan", "reorganisation_conference"] });
  const g = ev(spend(S, CCP, "into_manchuria", "taihang"), KMT, "gold_yuan"), a = ev(g, CCP, "fu_dongju");
  const p = pendingIs(a, CCP, "option", "傅冬菊"); if (p !== true) return p;
  const b = choose(a, "gold_yuan");
  const six = turnEnds(() => ev(b, KMT, "reorganisation_conference")).find((x) => x.turn === 6);
  if (!six) return "沒有走到第 6 回合的結算";
  return all(
    same(ids(opts(a)), ["gold_yuan", "beiping"], "可以選的(金圓券的效果,或北平)"), eq(E.opsOf(g, KMT, "takeover_officials"), 3, "拿掉之前國軍的 2 點牌"),
    eq(E.opsOf(b, KMT, "takeover_officials"), 2, "拿掉之後國軍的 2 點牌"), eq(six.mandate - b.mandate, 2, "回合結算時民心的變動(照樣往共軍 2)"),
    ok(true, "傅冬菊選金圓券:國軍的牌回到 2 點;回合結算時民心仍然往共軍 2"),
  );
});

check("傅作義守華北 *(3):持續:共軍對華北的城奇襲行動點 −1。可被「傅冬菊」移除", () => {
  const t = cardTodo("fu_holds_the_north"); if (t) return t;
  const S = holding(CCP, "into_manchuria", { extra: ["gao_shuxun"], other: ["score_east", "fu_holds_the_north", "kunming_incident"] });
  const a = ev(spend(S, CCP, "into_manchuria", "taihang"), KMT, "fu_holds_the_north");
  const b = act(a, CCP, "gao_shuxun", "campaign", { target: "beiping" });
  const fx = a.effects.find((e) => e.card === "fu_holds_the_north");
  return all(
    eq(["beiping", "tianjin", "taiyuan"].map((id) => E.campaignMod(a, CCP, id)).join(), "-1,-1,-1", "共軍打北平、天津、太原的加減"),
    eq(E.campaignMod(a, CCP, "chasui"), 0, "共軍打察綏(華北的鄉)的加減"), eq(E.campaignMod(a, CCP, "xuzhou"), 0, "共軍打徐州(別區的城)的加減"), eq(E.campaignMod(a, KMT, "jizhong"), 0, "國軍的加減"),
    eq(rb(b, "beiping"), "0/2", "共軍 2 點 −1 奇襲北平之後 紅/藍"),
    eq(!!fx && fx.until !== "turn", true, "效果是持續的"), eq(where(a, "fu_holds_the_north"), "removed", "牌在哪裡"),
    ok(true, "共軍打華北的城 −1(2 點打北平只移除 1);鄉、別區、國軍不受影響;效果跨回合"),
  );
});

check("空運孤城(2):本回合孤城結算時不掉點;國軍在一座孤城放 2。美國支持是 0 時無效", () => {
  const t = cardTodo("airlift_to_cut_off_city"); if (t) return t;
  const S = holding(KMT, "airlift_to_cut_off_city", { edits: JINAN_CUT, support: [1, 3] }), a = ev(S, KMT, "airlift_to_cut_off_city");
  const p = pendingIs(a, KMT, "points", "空運孤城"); if (p !== true) return p;
  const b = choose(a, ["jinan"]);
  const six = turnEnds(() => spend(b, KMT, "kunming_incident", "tianjin")).find((x) => x.turn === 6);
  const Z = holding(KMT, "airlift_to_cut_off_city", { edits: JINAN_CUT, support: [1, 0] }), z = ev(Z, KMT, "airlift_to_cut_off_city");
  if (z.pending) return `美國支持 0 時空運孤城還問了一個決定(${sideZh(z.pending.who)} 的 ${z.pending.kind}):它應該沒有效果`;
  const zero = turnEnds(() => spend(z, KMT, "kunming_incident", "tianjin")).find((x) => x.turn === 6);
  if (!six || !zero) return "沒有走到第 6 回合的結算";
  return all(
    same(E.isolatedCities(S), ["jinan"], "孤城"), eq(a.pending.n, 1, "要選的城數"), same(opts(a), ["jinan"], "可以選的城(孤城)"),
    eq(blueOf(b, "jinan"), 4, "濟南的藍(事件把點放進了孤城)"), eq(six.inf.jinan[KMT], 4, "回合結算後濟南的藍(這一回合不掉點)"),
    eq(z.pending, null, "美國支持 0 時還有待決定"), eq(blueOf(z, "jinan"), 2, "美國支持 0 時濟南的藍"), eq(zero.inf.jinan[KMT], 1, "美國支持 0 時回合結算後濟南的藍(照常掉 1)"),
    eq(where(b, "airlift_to_cut_off_city"), "discard", "牌在哪裡"),
    ok(true, "濟南 2→4,這一回合結算不掉點;美國支持 0 時無效(濟南照常 2→1);牌進棄牌堆"),
  );
});

check("蔣下野 *(2):國軍在桂林、武漢各放 2;國軍棄 1 張手牌(事件不觸發)", () => {
  const t = cardTodo("chiang_steps_down"); if (t) return t;
  const S = holding(KMT, "chiang_steps_down", { extra: ["kunming_incident", "takeover_officials", "score_northeast"] }), a = ev(S, KMT, "chiang_steps_down");
  const p = pendingIs(a, KMT, "card", "蔣下野"); if (p !== true) return p;
  const b = choose(a, ["takeover_officials"]);
  return all(
    eq(`${blueOf(a, "guilin")},${blueOf(a, "wuhan")}`, "4,4", "桂林、武漢的藍(武漢上限 4)"), eq(a.pending.n, 1, "要棄的張數"),
    same(opts(a), ["kunming_incident", "takeover_officials"], "可以棄的牌(記分卡不行)"),
    same(b.hands[KMT], ["kunming_incident", "score_northeast"], "棄牌之後國軍的手牌"), eq(where(b, "takeover_officials"), "discard", "棄的牌在哪裡"), eq(b.pending, null, "棄的牌事件觸發了(有待決定)"),
    eq(b.mandate - S.mandate, 0, "民心的變動(接收大員的事件沒有觸發)"), eq(where(b, "chiang_steps_down"), "removed", "牌在哪裡"),
    ok(true, "桂林 2→4、武漢 3→4;國軍棄接收大員,事件不觸發"),
  );
});

check("古寧頭 *(2):移除後方每座城的紅各 1;民生回復 1", () => {
  const t = cardTodo("guningtou"); if (t) return t;
  const S = holding(KMT, "guningtou", { weariness: 3, edits: { wuhan: { r: 2 }, nanjing: { r: 1 }, kunming: { r: 1 }, xuzhou: { r: 1 } } }), a = ev(S, KMT, "guningtou");
  return all(
    eq(diff(redMap(S), redMap(a)), "武漢 2→1、南京 1→0、昆明 1→0", "紅的變動(徐州不在後方)"), eq(diff(blueMap(S), blueMap(a)), "無", "藍的變動"),
    eq(a.weariness, 4, "民生 3 回復 1"), eq(where(a, "guningtou"), "removed", "牌在哪裡"), ok(true, "後方三座有紅的城各 −1;徐州不動;民生 3→4"),
  );
});

// ---------- 決戰期・共軍 (9)
check("遼瀋戰役 *(4):移除東北每個據點的藍各 2", () => {
  const t = cardTodo("liaoshen_campaign"); if (t) return t;
  const S = holding(CCP, "liaoshen_campaign", { edits: { changchun: { b: 3 }, shenyang: { b: 2 }, jinzhou: { b: 1 }, siping: { r: 1, b: 1 } } }), a = ev(S, CCP, "liaoshen_campaign");
  return all(
    eq(diff(blueMap(S), blueMap(a)), "長春 3→1、四平 1→0、瀋陽 2→0、錦州 1→0", "藍的變動"), eq(diff(redMap(S), redMap(a)), "無", "紅的變動"),
    eq(a.pending, null, "還有待決定"), eq(where(a, "liaoshen_campaign"), "removed", "牌在哪裡"), ok(true, "東北的城和鄉各 −2 藍(到 0 為止);天津等別區不動"),
  );
});

check("淮海戰役 *(4):共軍對華東中原任一據點奇襲,行動點 4 +2", () => {
  const t = cardTodo("huaihai_campaign"); if (t) return t;
  const S = holding(CCP, "huaihai_campaign"), a = ev(S, CCP, "huaihai_campaign");
  const p = pendingIs(a, CCP, "points", "淮海戰役"); if (p !== true) return p;
  const b = choose(a, ["xuzhou"]);
  // Turn 7 (決戰), 民生 2: a city is still open to the Communists, the attack is one stronger and does not push 民生.
  const seven = holding(CCP, "huaihai_campaign", { turn: 7, weariness: 2 }), c = answer(ev(seven, CCP, "huaihai_campaign"), CCP, "points", ["xuzhou"], "第 7 回合的淮海戰役");
  return all(
    eq(a.pending.n, 1, "要選的據點數"), same(opts(a), ["jinan", "luzhong", "xuzhou", "huaihai", "zhengzhou", "dabieshan"], "可以選的據點(華東中原、有藍)"),
    eq(rb(b, "xuzhou"), "3/0", "奇襲徐州(6 點:移除 3、放 3)之後 紅/藍"), eq(b.weariness, 4, "民生(徐州是城的要衝)"),
    eq(rb(c, "xuzhou"), "4/0", "第 7 回合(再 +1)奇襲徐州之後 紅/藍"), eq(c.weariness, 2, "第 7 回合的民生(不推)"),
    eq(where(b, "huaihai_campaign"), "removed", "牌在哪裡"), ok(true, "徐州 0/3→3/0,民生 5→4;第 7 回合是 7 點、不推民生、凋敝時照打"),
  );
});

check("平津戰役 *(3):共軍對天津奇襲,行動點 3 +2,不受美軍駐華限制;之後北平是孤城的話,移除北平的藍 2", () => {
  const t = cardTodo("pingjin_campaign"); if (t) return t;
  const S = holding(CCP, "pingjin_campaign"), a = ev(S, CCP, "pingjin_campaign");
  // With 察綏 Communist as well (red 4 against blue 2), 北平's only way out is 天津, and 天津 supplies nothing once it is lost.
  const T = holding(CCP, "pingjin_campaign", { edits: { chasui: { r: 4 } } }), b = ev(T, CCP, "pingjin_campaign");
  return all(
    eq(J(S.support), "[1,4]", "支持度(美軍駐華在)"), eq(E.opsOptions(S, CCP).campaignTargets.includes("tianjin"), false, "平常共軍能奇襲天津(對照組)"),
    eq(a.pending, null, "還有待決定(目標固定是天津)"), eq(rb(a, "tianjin"), "2/0", "奇襲天津(5 點:移除 3、放 2)之後 紅/藍"), eq(a.weariness, 4, "民生(天津是城的要衝)"),
    eq(E.isolatedCities(a).includes("beiping"), false, "天津丟了之後北平是孤城(察綏還通)"), eq(blueOf(a, "beiping"), 3, "北平的藍(不是孤城,不動)"),
    eq(E.isolatedCities(T).includes("beiping"), false, "察綏被共軍控制、天津還在時北平是孤城"), eq(blueOf(b, "beiping"), 1, "天津、察綏都丟了:北平的藍(3 − 2)"),
    eq(where(a, "pingjin_campaign"), "removed", "牌在哪裡"), ok(true, "天津 0/3→2/0(美軍駐華擋不住這張牌);北平還連得到察綏時不動,察綏也丟了才 −2"),
  );
});

check("傅冬菊 *(2):移除國軍一個持續效果;或移除北平的藍 2", () => {
  const t = cardTodo("fu_dongju", "fu_holds_the_north"); if (t) return t;
  const S = holding(CCP, "into_manchuria", { extra: ["fu_dongju"], other: ["score_east", "fu_holds_the_north", "kunming_incident"] });
  const a = ev(ev(spend(S, CCP, "into_manchuria", "taihang"), KMT, "fu_holds_the_north"), CCP, "fu_dongju");
  const p = pendingIs(a, CCP, "option", "傅冬菊"); if (p !== true) return p;
  const lift = choose(a, "fu_holds_the_north"), city = choose(a, "beiping");
  const alone = ev(holding(CCP, "fu_dongju"), CCP, "fu_dongju");
  return all(
    same(ids(opts(a)), ["fu_holds_the_north", "beiping"], "可以選的(國軍在場的效果,或北平)"), eq(E.campaignMod(a, CCP, "beiping"), -1, "選之前共軍打北平的加減"),
    eq(E.campaignMod(lift, CCP, "beiping"), 0, "移除傅作義守華北之後共軍打北平的加減"), eq(blueOf(lift, "beiping"), 3, "移除效果時北平的藍"),
    eq(blueOf(city, "beiping"), 1, "選北平:北平的藍"), eq(E.campaignMod(city, CCP, "beiping"), -1, "選北平時效果還在"),
    same(ids(opts(alone)), ["beiping"], "國軍沒有效果在場時可以選的"), eq(where(lift, "fu_dongju"), "removed", "牌在哪裡"),
    ok(true, "可以拿掉傅作義守華北(共軍打北平回到不減),或讓北平 3→1"),
  );
});

check("長春圍城 *(2):長春是孤城的話,移除長春的全部藍,共軍放 2,民心往國軍移 2;否則移除長春的藍 1", () => {
  const t = cardTodo("siege_of_changchun"); if (t) return t;
  // 長春 with blue 2; cut off when 北滿 (red 3) and 四平 (red 2) are both Communist.
  const S = holding(CCP, "siege_of_changchun", { edits: { changchun: { b: 2 }, beiman: { r: 3 }, siping: { r: 2 } } }), a = ev(S, CCP, "siege_of_changchun");
  const O = holding(CCP, "siege_of_changchun", { edits: { changchun: { b: 2 } } }), o = ev(O, CCP, "siege_of_changchun");
  return all(
    same(E.isolatedCities(S), ["changchun"], "孤城"), eq(rb(a, "changchun"), "2/0", "孤城:長春 紅/藍"), eq(a.mandate - S.mandate, -2, "孤城:民心的變動(往國軍 2)"),
    eq(E.isolatedCities(O).length, 0, "沒有被切斷時的孤城數"), eq(rb(o, "changchun"), "0/1", "不是孤城:長春 紅/藍"), eq(o.mandate - O.mandate, 0, "不是孤城:民心的變動"),
    eq(where(a, "siege_of_changchun"), "removed", "牌在哪裡"), ok(true, "孤城:長春 0/2→2/0,民心往國軍 2;不是孤城:只 −1 藍"),
  );
});

check("賈汪起義 *(2):移除徐州的藍 2;淮海在共軍控制下的話再移除 1", () => {
  const t = cardTodo("jiawang_defection"); if (t) return t;
  const a = ev(holding(CCP, "jiawang_defection"), CCP, "jiawang_defection"), H = holding(CCP, "jiawang_defection", { edits: { huaihai: { r: 3 } } }), b = ev(H, CCP, "jiawang_defection");
  return all(eq(blueOf(a, "xuzhou"), 1, "徐州的藍(淮海沒有人控制)"), eq(E.controller(H, "huaihai"), CCP, "淮海的控制者"), eq(blueOf(b, "xuzhou"), 0, "徐州的藍(淮海在共軍控制下)"),
    eq(where(a, "jiawang_defection"), "removed", "牌在哪裡"), ok(true, "徐州 3→1;淮海在共軍控制下時 3→0"));
});

check("渡江戰役 *(4):共軍對後方任一座城奇襲,行動點 4 +2", () => {
  const t = cardTodo("yangtze_crossing"); if (t) return t;
  const rear = ["wuhan", "nanjing", "shanghai", "guangzhou", "guilin", "kunming"];
  const S = holding(CCP, "yangtze_crossing", { support: [1, 2] }), a = ev(S, CCP, "yangtze_crossing");
  const p = pendingIs(a, CCP, "points", "渡江戰役"); if (p !== true) return p;
  const b = choose(a, ["nanjing"]);
  const g = ev(holding(CCP, "yangtze_crossing", { support: [1, 4] }), CCP, "yangtze_crossing");   // 美軍駐華: no 上海
  const locked = ev(holding(CCP, "yangtze_crossing", { support: [1, 2], weariness: 4 }), CCP, "yangtze_crossing"); // 動盪: 後方 is closed to the Communists
  return all(
    eq(a.pending.n, 1, "要選的城數"), same(opts(a), rear, "美國支持 2 時可以選的城(後方有藍的城)"),
    eq(rb(b, "nanjing"), "2/0", "奇襲南京(6 點:移除 4、放 2)之後 紅/藍"), eq(b.weariness, 4, "民生(南京是城的要衝)"),
    same(opts(g), rear.filter((id) => id !== "shanghai"), "美國支持 4 時可以選的城(上海有美軍駐華)"),
    eq(locked.pending, null, "動盪時(後方被封鎖)還有待決定"), eq(diff(blueMap(S), blueMap(locked)), "無", "動盪時藍的變動"),
    eq(where(b, "yangtze_crossing"), "removed", "牌在哪裡"), ok(true, "南京 0/4→2/0;美軍駐華時不能選上海;動盪時後方打不了,事件沒有效果"),
  );
});

check("新政協 *(2):共軍控制北平的話民心 +3;蘇聯支持 +1", () => {
  const t = cardTodo("new_consultative_conference"); if (t) return t;
  const H = holding(CCP, "new_consultative_conference", { support: [1, 4], edits: { beiping: { r: 5, b: 2 } } }), h = ev(H, CCP, "new_consultative_conference");
  const N = holding(CCP, "new_consultative_conference", { support: [1, 4] }), n = ev(N, CCP, "new_consultative_conference");
  return all(
    eq(E.controller(H, "beiping"), CCP, "北平的控制者"), eq(h.mandate - H.mandate, 3, "控制北平:民心的變動"), eq(J(h.support), "[2,4]", "支持度"),
    eq(n.mandate - N.mandate, 0, "不控制北平:民心的變動"), eq(J(n.support), "[2,4]", "不控制北平:支持度"),
    eq(where(h, "new_consultative_conference"), "removed", "牌在哪裡"), ok(true, "控制北平時民心往共軍 3;蘇聯支持 1→2"),
  );
});

check("和平起義(2):選一座孤城,移除那裡的全部藍(至多 3)", () => {
  const t = cardTodo("peaceful_changeover"); if (t) return t;
  const S = holding(CCP, "peaceful_changeover", { edits: { ...JINAN_CUT, jinan: { b: 4 } } }), a = ev(S, CCP, "peaceful_changeover");
  const p = pendingIs(a, CCP, "points", "和平起義"); if (p !== true) return p;
  const b = choose(a, ["jinan"]), none = ev(holding(CCP, "peaceful_changeover"), CCP, "peaceful_changeover");
  return all(
    eq(a.pending.n, 1, "要選的城數"), same(opts(a), ["jinan"], "可以選的城(孤城)"), eq(blueOf(b, "jinan"), 1, "濟南的藍(4,至多移除 3)"),
    eq(none.pending, null, "沒有孤城時還有待決定"), eq(where(b, "peaceful_changeover"), "discard", "牌在哪裡"),
    ok(true, "孤城濟南 4→1;沒有孤城時事件沒有效果;牌進棄牌堆"),
  );
});

// ---------- 決戰期・中立 (7)
check("北平和談 *(3):民生回復 2;持續至回合結束:雙方奇襲 −1", () => {
  const t = cardTodo("beiping_talks"); if (t) return t;
  const S = holding(CCP, "beiping_talks", { weariness: 2 }), a = ev(S, CCP, "beiping_talks");
  return all(eq(a.weariness, 4, "民生 2 回復 2"), eq(E.campaignMod(a, CCP, "chasui"), -1, "共軍奇襲的加減"), eq(E.campaignMod(a, KMT, "jizhong"), -1, "國軍奇襲的加減"),
    eq(where(a, "beiping_talks"), "removed", "牌在哪裡"), ok(true, "民生 2→4;這一回合雙方奇襲 −1"));
});

check("史達林的建議 *(2):共軍還沒控制任何後方的城的話:本回合共軍不可奇襲後方的城,蘇聯支持 +1", () => {
  const t = cardTodo("stalins_advice"); if (t) return t;
  const rearOf = (st, side) => E.opsOptions(st, side).campaignTargets.filter((id) => SPEC_SPACES[id][1] === "rear");
  const S = holding(KMT, "stalins_advice", { support: [1, 2], edits: { wuhan: { r: 1 } } }), a = ev(S, KMT, "stalins_advice");
  // 武漢 Communist (red 4, no blue): they control a city of 後方, so the card does nothing.
  const H = holding(KMT, "stalins_advice", { support: [1, 2], edits: { wuhan: { r: 4, b: 0 } } }), h = ev(H, KMT, "stalins_advice");
  return all(
    nonEmpty(rearOf(S, CCP).length, "打出之前共軍在後方的奇襲目標"), eq(rearOf(a, CCP).length, 0, "打出之後共軍在後方的奇襲目標數"),
    eq(E.opsOptions(a, CCP).campaignTargets.includes("xuzhou"), true, "後方以外(徐州)也被擋了"), eq(rearOf(a, KMT).includes("wuhan"), true, "國軍在後方(武漢有紅)也被擋了"),
    eq(J(a.support), "[2,2]", "支持度"),
    eq(E.controller(H, "wuhan"), CCP, "武漢的控制者"), eq(J(h.support), "[1,2]", "共軍已經控制後方的城:支持度"), eq(rearOf(h, CCP).length, rearOf(H, CCP).length, "共軍已經控制後方的城:後方的奇襲目標數不變"),
    eq(where(a, "stalins_advice"), "removed", "牌在哪裡"), ok(true, "這一回合共軍不能奇襲後方的城,蘇聯支持 1→2;共軍已經控制後方的城時無效"),
  );
});

check("紫石英號事件 *(2):打出者民心 +1;美國支持 −1", () => {
  const t = cardTodo("amethyst_incident"); if (t) return t;
  const C1 = holding(CCP, "amethyst_incident", { support: [1, 3] }), c = ev(C1, CCP, "amethyst_incident"), K1 = holding(KMT, "amethyst_incident", { support: [1, 3] }), k = ev(K1, KMT, "amethyst_incident");
  return all(eq(c.mandate - C1.mandate, 1, "共軍打出:民心的變動"), eq(k.mandate - K1.mandate, -1, "國軍打出:民心的變動"), eq(J(c.support), "[1,2]", "支持度"),
    eq(where(c, "amethyst_incident"), "removed", "牌在哪裡"), ok(true, "誰打出誰 +1;美國支持 3→2"));
});

check("陣前倒戈(2):取走對手手中行動點最高的牌,並將本牌交給對手", () => {
  const t = cardTodo("defection_at_the_front"); if (t) return t;
  const S = holding(CCP, "into_manchuria", { extra: ["gao_shuxun", "huaihai_campaign"], other: ["score_east", "defection_at_the_front", "kunming_incident"] });
  const a = ev(spend(S, CCP, "into_manchuria", "taihang"), KMT, "defection_at_the_front");
  // An opponent holding nothing but a scoring card: nothing to take, the card still changes hands.
  const N = holding(CCP, "into_manchuria", { extra: ["score_northeast"], other: ["score_east", "defection_at_the_front", "kunming_incident"] });
  const n = ev(spend(N, CCP, "into_manchuria", "taihang"), KMT, "defection_at_the_front");
  return all(
    same(a.hands[KMT], ["kunming_incident", "huaihai_campaign"], "國軍的手牌(多了淮海戰役,4 點)"), same(a.hands[CCP], ["gao_shuxun", "defection_at_the_front"], "共軍的手牌(少了淮海戰役,多了陣前倒戈)"),
    eq(a.discard.includes("defection_at_the_front") || a.removed.includes("defection_at_the_front"), false, "陣前倒戈進了棄牌堆或被移出遊戲"),
    same(n.hands[CCP], ["score_northeast", "defection_at_the_front"], "對手只有記分卡時共軍的手牌"), same(n.hands[KMT], ["kunming_incident"], "對手只有記分卡時國軍的手牌"),
    ok(true, "國軍拿走共軍的淮海戰役(4 點),陣前倒戈到了共軍手上;記分卡不會被拿走"),
  );
});

check("補給不繼(3):持續至回合結束:對手所有牌行動點 −1(最低 1)", () => {
  const t = cardTodo("supplies_run_short"); if (t) return t;
  const S = holding(KMT, "supplies_run_short"), a = ev(S, KMT, "supplies_run_short");
  return all(eq(E.opsOf(a, CCP, "into_manchuria"), 2, "共軍的 3 點牌"), eq(E.opsOf(a, CCP, "xiong_xianghui"), 1, "共軍的 1 點牌(最低 1)"), eq(E.opsOf(a, KMT, "kunming_incident"), 2, "國軍自己的牌"),
    eq(where(a, "supplies_run_short"), "discard", "牌在哪裡"), ok(true, "國軍打出:這一回合共軍的牌 3→2、1→1,國軍的不變"));
});

check("掃清外圍(2):打出者對任一個鄉免費奇襲", () => {
  const t = cardTodo("clearing_the_outskirts"); if (t) return t;
  const S = holding(KMT, "clearing_the_outskirts"), a = ev(S, KMT, "clearing_the_outskirts");
  const p = pendingIs(a, KMT, "points", "掃清外圍"); if (p !== true) return p;
  const b = choose(a, ["jizhong"]);
  const villagesWith = (st, side) => Object.keys(SPEC_SPACES).filter((id) => SPEC_SPACES[id][0] === "village" && E.infOf(st, id)[1 - side] > 0);
  // The Communists at 民生 3: 華北 is closed, so its villages are not offered.
  const C3 = holding(CCP, "clearing_the_outskirts", { weariness: 3 }), c = ev(C3, CCP, "clearing_the_outskirts");
  return all(
    eq(a.pending.n, 1, "要選的鄉數"), same(opts(a), villagesWith(S, KMT), "國軍可以選的鄉(有紅的鄉)"),
    eq(rb(b, "jizhong"), "0/0", "國軍 2 點奇襲冀中之後 紅/藍"), eq(b.weariness, 5, "民生"),
    same(opts(c), villagesWith(C3, CCP).filter((id) => SPEC_SPACES[id][1] !== "north"), "通膨時共軍可以選的鄉(華北的被封鎖)"),
    eq(where(b, "clearing_the_outskirts"), "discard", "牌在哪裡"), ok(true, "冀中 2/0→0/0;照樣受民生封鎖(通膨時打不了華北的鄉)"),
  );
});

check("大公報社評(1):對手隨機棄 1 張牌(記分卡除外);若是打出者陣營的事件,該事件觸發", () => {
  const t = cardTodo("ta_kung_pao", "kunming_incident"); if (t) return t;
  const other = ["score_east", "ta_kung_pao", "takeover_officials"];
  const play = (held) => ev(spend(holding(CCP, "into_manchuria", { extra: [held], other }), CCP, "into_manchuria", "taihang"), KMT, "ta_kung_pao");
  // The Communists hold exactly one card when it is played, so "at random" has one outcome.
  const theirs = play("gao_shuxun"), mine = play("kunming_incident"), scoringOnly = play("score_northeast");
  return all(
    eq(theirs.hands[CCP].length, 0, "共軍的手牌數(高樹勛起義被棄)"), eq(where(theirs, "gao_shuxun"), "discard", "被棄的共軍牌在哪裡"), eq(theirs.pending, null, "共軍牌的事件觸發了(有待決定)"),
    eq(mine.hands[CCP].length, 0, "共軍的手牌數(昆明事變被棄)"), eq(blueOf(mine, "kunming"), 5, "被棄的是國軍的牌(昆明事變):事件觸發,昆明的藍"), eq(where(mine, "kunming_incident"), "removed", "觸發過的昆明事變 * 在哪裡"),
    same(scoringOnly.hands[CCP], ["score_northeast"], "共軍只有記分卡時的手牌(不棄)"),
    eq(where(theirs, "ta_kung_pao"), "discard", "牌在哪裡"), ok(true, "棄到對手陣營的牌:只是棄掉;棄到打出者陣營的牌:它的事件觸發;記分卡不會被棄"),
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
