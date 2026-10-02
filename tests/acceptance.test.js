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
check("時局 8 張", () => (E.SITUATIONS === undefined ? "TODO: 還沒有時局;目前只有第 1 回合的免費放置,寫死在開局裡。含:第 7 回合孤城結算藍 −2" : eq(E.SITUATIONS.length, 8, "時局張數")));
check("外國勢力:美國支持 4、蘇聯支持 1,兩張外援牌", () => {
  const st = E.createGame(1);
  return st.support === undefined ? "TODO: 還沒有支持度軌;外援仍是縱橫的九鼎(一張、會換手)。含:美援全部放在城時可以放進孤城" : all(eq(st.support[KMT], 4, "美國支持"), eq(st.support[CCP], 1, "蘇聯支持"));
});
check("行動回合與手牌依期不對稱(國 9/7、9/7、8/6;共 8/6、9/7、9/7)", () => (typeof E.ERAS[0].hand === "number" ? "TODO: 還是縱橫的對稱數字(8/6、9/7、9/7)" : ok(true, JSON.stringify(E.ERAS.map((e) => [e.hand, e.rounds])))));
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
// Two readings the rulebook does not spell out, ruled by the orchestrator on #1
// and flagged there for the owner (each is one check below, so a different
// ruling flips one check):
//   - 「隨時依盤面判定」 is read point by point inside one 扶植, the way cost and cap are;
//   - a city with no blue and no supply cannot take its first blue point from 扶植 either.
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
  st.jiuding = { holder: KMT, faceDown: true }; // nobody has the Cauldrons to play this turn
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

check("沒有藍也沒有補給的城:國軍的第一點也放不進去(orchestrator 裁決 #1,待 owner)", () => {
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
// ruling 3 above (the ban asks `supplied`). Both wait for the owner; the other reading, in which
// the city itself is not part of its own path, turns every expectation in this check around.
check("共軍控制的城不在補給範圍內:國軍不能扶植進去(連空城),裡面的藍每回合掉 1(Phase 0 的讀法,待 owner)", () => {
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

// ---------------------------------------------------------------- verdict
test("acceptance: the first guard", () => {
  const s = summary();
  for (const p of R.pass) console.log(`通過 · ${p.label}${p.msg ? " · " + p.msg : ""}`);
  for (const t of s.todos) console.log(`尚未實作 · ${t.label} · ${t.msg}`);
  for (const f of s.failures) console.log(`失敗 · ${f.label} · ${f.msg}`);
  console.log(`VERDICT 通過 ${s.pass} / 失敗 ${s.fail} / 尚未實作 ${s.todo}`);
  assert.equal(s.fail, 0, s.failures.map((f) => `${f.label}: ${f.msg}`).join("\n"));
});
