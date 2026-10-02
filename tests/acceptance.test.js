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
check("孤城的效果:不能扶植、回合結算藍 −1", () => (E.DEFAULT_OPTIONS.supply === undefined ? "TODO: 只有 isolatedCities 這個讀數,還沒有接進扶植與回合結算" : ok(true, `supply = ${E.DEFAULT_OPTIONS.supply}`)));
check("時局 8 張", () => (E.SITUATIONS === undefined ? "TODO: 還沒有時局;目前只有第 1 回合的免費放置,寫死在開局裡" : eq(E.SITUATIONS.length, 8, "時局張數")));
check("外國勢力:美國支持 4、蘇聯支持 1,兩張外援牌", () => {
  const st = E.createGame(1);
  return st.support === undefined ? "TODO: 還沒有支持度軌;外援仍是縱橫的九鼎(一張、會換手)" : all(eq(st.support[KMT], 4, "美國支持"), eq(st.support[CCP], 1, "蘇聯支持"));
});
check("行動回合與手牌依期不對稱(國 9/7、9/7、8/6;共 8/6、9/7、9/7)", () => (typeof E.ERAS[0].hand === "number" ? "TODO: 還是縱橫的對稱數字(8/6、9/7、9/7)" : ok(true, JSON.stringify(E.ERAS.map((e) => [e.hand, e.rounds])))));
check("記分時根據地也算要衝;只有城的要衝推民生", () => (E.DEFAULT_OPTIONS.baseScoring === undefined ? "TODO: regionTally 還只算城的要衝" : ok(true, "baseScoring on")));

// ---------------------------------------------------------------- verdict
test("acceptance: the first guard", () => {
  const s = summary();
  for (const p of R.pass) console.log(`通過 · ${p.label}${p.msg ? " · " + p.msg : ""}`);
  for (const t of s.todos) console.log(`尚未實作 · ${t.label} · ${t.msg}`);
  for (const f of s.failures) console.log(`失敗 · ${f.label} · ${f.msg}`);
  console.log(`VERDICT 通過 ${s.pass} / 失敗 ${s.fail} / 尚未實作 ${s.todo}`);
  assert.equal(s.fail, 0, s.failures.map((f) => `${f.label}: ${f.msg}`).join("\n"));
});
