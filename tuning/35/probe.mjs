// #35, BE's own probe for mechanism E: the places the acceptance (group 15) does not reach.
//   node tuning/35/probe.mjs
// Prints one line per check, `通過` / `失敗`, and `PROBE 通過 n / 失敗 m` last. Every expected value is worked
// out by hand from the rules (the note E as group 15's comment hand-copies it, orchestrator 裁決 #35, the
// rulebook's opening below) and written in; none is read from the engine. The opening is the rulebook's
// (tests/acceptance.test.js SPEC_SPACES, the same hand copy), then edited per check.
import * as E from "../../public/shared/engine.js";

const CCP = 0, KMT = 1;
// id: [red, blue] at the start (rulebook 二).
const OPEN = {
  beiman: [1, 0], changchun: [0, 0], siping: [0, 0], shenyang: [0, 0], liaoxi: [0, 0], jinzhou: [0, 0],
  tianjin: [0, 3], beiping: [0, 3], jizhong: [2, 0], chasui: [2, 2], taihang: [4, 0], taiyuan: [0, 2], jinzhong: [1, 2],
  jiluyu: [3, 0], jinan: [0, 2], luzhong: [3, 2], xuzhou: [0, 3], huaihai: [2, 1], zhengzhou: [0, 2], dabieshan: [2, 2],
  shanbei: [4, 0], xian: [0, 4], lanzhou: [0, 2], wuhan: [0, 3], nanjing: [0, 4], shanghai: [0, 3], guangzhou: [0, 2],
  guilin: [0, 2], kunming: [0, 2],
};
let pass = 0, failN = 0;
const J = (x) => JSON.stringify(x ?? null);
function check(name, pairs) {
  const bad = pairs.filter(([what, want, got]) => J(want) !== J(got));
  if (bad.length) { failN++; console.log(`失敗 · ${name} · ${bad.map(([w, a, b]) => `${w}: 期望 ${J(a)},實際 ${J(b)}`).join(";")}`); }
  else { pass++; console.log(`通過 · ${name}`); }
}
const thrown = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const rb = (st, id) => E.infOf(st, id).join("/");
const act = (st, side, card, use, extra = {}) => E.apply(st, { type: "play", side, card, use, ...extra });
const choose = (st, choice) => E.apply(st, { type: "choose", side: st.pending.who, choice });
const tracks = (st) => `${E.inflationOf(st)}/${E.leftismOf(st)}/${E.centristsOf(st)}`;

// Turn 1, the opening board edited, the hands dealt (each side a scoring card to headline first), mandate 0.
function rig({ options = { mechanismE: true }, ccp = [], kmt = [], edits = {}, support = null } = {}) {
  let st = E.createGame(11, { aid: false, ...options });
  while (st.pending) { const o = st.pending.options; st = choose(st, Array.from({ length: st.pending.min }, (_, i) => o[i % o.length])); }
  st = E.clone(st);
  st.inf = {};
  for (const [id, [r, b]] of Object.entries(OPEN)) st.inf[id] = edits[id] ? edits[id].slice() : [r, b];
  if (st.gray) for (const id of Object.keys(st.gray)) st.gray[id] = 0; // D: no gray unless a check sets it
  st.discard.push(...st.hands[CCP], ...st.hands[KMT]);
  st.hands = [[], []];
  const deal = (side, cards) => { for (const k of ["draw", "discard", "removed"]) st[k] = st[k].filter((c) => !cards.includes(c)); st.hands[side] = cards.slice(); };
  deal(CCP, ["score_north", ...ccp]); deal(KMT, ["score_east", ...kmt]);
  if (support) st.support = support.slice();
  st = E.apply(st, { type: "headline", side: CCP, card: "score_north" });
  st = E.apply(st, { type: "headline", side: KMT, card: "score_east" });
  st.mandate = 0;
  return st;
}

// 1. 印鈔 in the ops chosen after an enemy card's event (orchestrator 裁決 #35: 「事件先的行動點選擇也行」;
//    BE's reading, #35 comment: the print goes in the ops choice). 上黨戰役 (共軍的牌,2 點) played by the
//    Nationalists event first: 晉中 blue 2 → 0, 太行 red 4 → 5; then the ops ask, 2 + 2 = 4 into 南京 4 → 6
//    and 上海 3 → 5 (both cost 1), inflation 0 → 1.
{
  const S = rig({ kmt: ["shangdang_campaign", "kunming_incident"] });
  const a = act(S, KMT, "shangdang_campaign", "place", { order: "eventFirst" });
  const p = a.pending || {};
  const b = choose(a, { use: "place", points: ["nanjing", "nanjing", "shanghai", "shanghai"], print: true });
  check("事件先的行動點選擇可以印鈔:上黨戰役事件先,選行動點時印,2 + 2 點放南京、上海", [
    ["輪到誰", KMT, S.actor], ["事件之後待決定的 tag", "ops", p.tag], ["ops 詢問的 canPrint", true, p.canPrint], ["ops 詢問的行動點", 2, p.ops],
    ["晉中、太行 紅/藍", "1/0 5/0", `${rb(b, "jinzhong")} ${rb(b, "taihang")}`],
    ["南京、上海 紅/藍", "0/6 0/5", `${rb(b, "nanjing")} ${rb(b, "shanghai")}`], ["通膨/左傾/中間派", "1/0/0", tracks(b)],
    ["沒印時 4 點被拒絕", true, thrown(() => choose(a, { use: "place", points: ["nanjing", "nanjing", "shanghai", "shanghai"] })) != null],
    ["印鈔拿去遊說被拒絕", true, thrown(() => choose(a, { use: "lobby", target: "luzhong", print: true })) != null],
    ["play 本身帶 eventFirst + print 被拒絕", true, thrown(() => act(S, KMT, "shangdang_campaign", "place", { order: "eventFirst", print: true })) != null],
  ]);
}

// 2. 印鈔 on an attack under mechanism B (the default): 進剿 冀中 (紅 2,藍 0) with 昆明事變 2 + 2 = X 4;
//    共軍守:紅 −min(4, 2) = 0,藍 +4 − 2 = 2 → 冀中 0/2. Without print X 2: 0/0. Inflation 0 → 1.
{
  const S = rig({ kmt: ["kunming_incident", "takeover_officials"] });
  const go = (print) => { let a = act(S, KMT, "kunming_incident", "campaign", { target: "jizhong", ...(print ? { print: true } : {}) }); if (a.pending && a.pending.tag === "sweep") a = choose(a, "stand"); return a; };
  const y = go(true), n = go(false);
  check("印鈔用在進剿(B):X = 2 + 2", [["印鈔 冀中 紅/藍", "0/2", rb(y, "jizhong")], ["沒印 冀中 紅/藍", "0/0", rb(n, "jizhong")], ["印鈔之後 通膨", 1, E.inflationOf(y)], ["沒印 通膨", 0, E.inflationOf(n)]]);
}

// 3. 印鈔 refused: the Communists; an aid card (美援 扶植); a lobby; and allowed with 馬歇爾調處's pair: 馬歇爾調處
//    + 上黨戰役 (2) printed = 4 into 南京 ×2、上海 ×2.
{
  const C = rig({ ccp: ["gao_shuxun", "shangdang_campaign"], kmt: ["kunming_incident"] });
  const A = rig({ kmt: ["kunming_incident", "marshall_mission", "shangdang_campaign"], support: [0, 4], options: { mechanismE: true, aid: true } });
  const m = act(A, KMT, "marshall_mission", "place", { pair: "shangdang_campaign", points: ["nanjing", "nanjing", "shanghai", "shanghai"], print: true });
  check("印鈔:共軍、外援牌、遊說不行;馬歇爾調處配對的牌可以", [
    ["共軍印鈔被拒絕", true, thrown(() => act(C, CCP, "gao_shuxun", "place", { points: ["jiluyu", "jizhong", "jiluyu", "jizhong"], print: true })) != null],
    ["美援扶植印鈔被拒絕", true, thrown(() => act(A, KMT, "american_aid", "place", { points: ["nanjing"], print: true })) != null],
    ["遊說印鈔被拒絕", true, thrown(() => act(A, KMT, "kunming_incident", "lobby", { target: "luzhong", print: true })) != null],
    ["馬歇爾調處配對印鈔 南京、上海 紅/藍", "0/6 0/5", `${rb(m, "nanjing")} ${rb(m, "shanghai")}`], ["配對印鈔之後 通膨", 1, E.inflationOf(m)],
  ]);
}

// 4. 激進 with 蘇援 (蘇聯支持 2 → 2 點,全在東北 +1 = 3): 北滿 (紅 1,上限 5) ×2 激進 → 1 + 2 + 2 = 5,四平 0 → 1.
//    還鄉團 next to 北滿: 長春 (受降:蘇軍佔領東北的城,放不進去) and 四平 → only 四平.
{
  const S = rig({ ccp: ["gao_shuxun"], kmt: ["kunming_incident"], support: [2, 0], options: { mechanismE: true, aid: true } });
  const a = act(S, CCP, "soviet_aid", "place", { points: ["beiman", "beiman", "siping"], radical: "beiman" });
  const p = a.pending || {};
  check("蘇援的扶植可以激進;還鄉團不能放進蘇軍佔領的長春", [
    ["輪到誰", CCP, S.actor], ["北滿、四平 紅/藍", "5/0 1/0", `${rb(a, "beiman")} ${rb(a, "siping")}`], ["通膨/左傾/中間派", "0/1/0", tracks(a)],
    ["待決定", "returnHome", p.tag], ["還鄉團可放的據點", ["siping"], p.options], ["st.aidUsed", [true, false], a.aidUsed],
  ]);
}

// 5. 左傾 6 a second time. 冀魯豫 3 → 激進 (高樹勛起義 2: 冀魯豫 1, 冀中 1) at leftism 5 → 6: the Communists'
//    villages (冀中 3, 太行 4, 冀魯豫 5, 陝北 4) −1 each, leftism 3. Then three more 激進, each as in a new turn
//    (the once-a-turn mark reset by hand, the CCP to act again with 上黨戰役 2, its 還鄉團 into a city so that no
//    village's control changes): leftism 3 → 4 (4 was reached before -- setLeftism 5 marked it -- so 民心 does
//    not move), 4 → 5, 5 → 6: the purge again. The numbers at each step are worked out below.
{
  const S = rig({ ccp: ["gao_shuxun"], kmt: ["kunming_incident", "takeover_officials", "sino_soviet_treaty", "return_to_nanjing"] });
  E.setLeftism(S, 5);
  let a = act(S, CCP, "gao_shuxun", "place", { points: ["jiluyu", "jizhong"], radical: "jiluyu" });
  const first = { left: E.leftismOf(a), v: ["jizhong", "taihang", "jiluyu", "shanbei"].map((id) => E.infOf(a, id)[CCP]).join(",") };
  a = choose(a, ["jinan"]);
  // The next turn's 激進, three times: the CCP to act with 上黨戰役 (its event not played), the mark reset.
  const again = (s, pts, v, home) => {
    s = E.clone(s); s.mechE.radicalTurn = null; s.pending = null; s.plan = []; s.phase = "action"; s.actor = CCP; s.hands[CCP] = ["shangdang_campaign"];
    const m0 = s.mandate;
    let b = act(s, CCP, "shangdang_campaign", "place", { points: pts, radical: v });
    const out = { b, dm: b.mandate - m0 };
    if (b.pending && b.pending.tag === "returnHome") out.b = choose(b, [home]); // a city: no village's control changes
    return out;
  };
  // after the first purge: 冀中 2, 太行 3, 冀魯豫 4, 陝北 3. 激進 冀魯豫 with [冀魯豫, 太行]: 冀魯豫 4 + 2 = 6 → 5 (cap), 太行 3 → 4.
  const r4 = again(a, ["jiluyu", "taihang"], "jiluyu", "jinan");
  // 激進 太行 (4, cap 5) with [太行, 冀中]: 太行 4 + 2 → 5, 冀中 2 → 3.
  const r5 = again(r4.b, ["taihang", "jizhong"], "taihang", "taiyuan");
  // 激進 冀中 (3, cap 4) with [冀中, 陝北]: 冀中 3 + 2 → 4, 陝北 3 → 4; leftism 5 → 6: the purge. Controlled villages
  // then: 冀中 4 (S 2), 太行 5 (S 3), 冀魯豫 5 (S 3), 陝北 4 (S 4); and 北滿 1 (S 3, not controlled), 魯中 3/2 (no),
  // 淮海 2/1 (no), 大別山 2/2 (no), 察綏 2/2 (no), 晉中 1/2 (no). So 冀中 3, 太行 4, 冀魯豫 4, 陝北 3, leftism 3.
  const r6 = again(r5.b, ["jizhong", "shanbei"], "jizhong", "tianjin");
  const v = (s) => ["jizhong", "taihang", "jiluyu", "shanbei"].map((id) => E.infOf(s, id)[CCP]).join(",");
  check("左傾 6 退回 3 之後再到 6:4 不再發生,6 再發生一次", [
    ["第一次到 6 之後的左傾", 3, first.left], ["第一次到 6 之後 冀中、太行、冀魯豫、陝北 的紅", "2,3,4,3", first.v],
    ["再到 4 的左傾", 4, E.leftismOf(r4.b)], ["再到 4 時民心的變動(4 已經到過)", 0, r4.dm], ["再到 4 之後的紅", "2,4,5,3", v(r4.b)],
    ["到 5 的左傾", 5, E.leftismOf(r5.b)], ["到 5 之後的紅", "3,5,5,3", v(r5.b)],
    ["第二次到 6 之後的左傾", 3, E.leftismOf(r6.b)], ["第二次到 6 之後的紅", "3,4,4,3", v(r6.b)], ["中間派(2 只在第一次)", 0, E.centristsOf(r6.b)],
  ]);
}

// 6. E and D together: 整編 with a printed card. 太原 gray 4 (blue 0), 晉 觀望. 日軍留守 (1 點) + 2 = 3:
//    gray 4 → 1, blue 0 → 3; without print 1: gray 3, blue 1. The Communists' 統戰 cannot print.
{
  const opts = { mechanismE: true, mechanismD: true };
  const S = rig({ kmt: ["japanese_garrisons", "kunming_incident"], ccp: [], options: opts });
  S.inf.taiyuan = [0, 0]; E.setGray(S, "taiyuan", 4);
  const y = act(S, KMT, "japanese_garrisons", "politics", { target: "taiyuan", print: true });
  const n = act(S, KMT, "japanese_garrisons", "politics", { target: "taiyuan" });
  const C = rig({ ccp: ["into_manchuria"], kmt: ["kunming_incident"], options: opts });
  check("E 和 D 一起開:整編可以印鈔(1 + 2 = 3),統戰不能", [
    ["印鈔 太原 灰/藍", "1/3", `${E.grayOf(y, "taiyuan")}/${E.infOf(y, "taiyuan")[KMT]}`], ["沒印 太原 灰/藍", "3/1", `${E.grayOf(n, "taiyuan")}/${E.infOf(n, "taiyuan")[KMT]}`],
    ["印鈔之後 通膨", 1, E.inflationOf(y)],
    ["共軍統戰印鈔被拒絕", true, thrown(() => act(C, CCP, "into_manchuria", "politics", { power: "sui", print: true })) != null],
  ]);
}

// 7. 8's smaller hand is for good: eraLimits from the turn after it (ERAS: 接收期 [8, 9], 易勢期 [9, 9], 決戰期 [8, 9]).
{
  const S = rig({ kmt: ["kunming_incident", "takeover_officials"] });
  E.setInflation(S, 7);
  const a = act(S, KMT, "kunming_incident", "place", { points: ["nanjing", "nanjing", "shanghai", "shanghai"], print: true });
  check("通膨 8 的手牌 −1 之後一直如此(第 1 回合不變,第 2、4、7 回合國軍少 1)", [
    ["第 1 回合", [8, 9], E.eraLimits(a, 1).hand], ["第 2 回合", [8, 8], E.eraLimits(a, 2).hand], ["第 4 回合", [9, 8], E.eraLimits(a, 4).hand], ["第 7 回合", [8, 8], E.eraLimits(a, 7).hand],
  ]);
}

// 8. 平抑 at 1 and at 0 (not below 0); the centrists stay within −2 … +2 (停戰 with 親共 2 already).
{
  const S = rig({ kmt: ["kunming_incident"], support: [0, 4], options: { mechanismE: true, aid: true } });
  const one = E.clone(S); E.setInflation(one, 1);
  check("平抑不低於 0", [["通膨 1 平抑之後", 0, E.inflationOf(act(one, KMT, "american_aid", "peg"))], ["通膨 0 平抑之後", 0, E.inflationOf(act(S, KMT, "american_aid", "peg"))]]);
}

// 9. With the option off: no E state, no new keys in legal() or an ops ask, 平抑 and 激進 refused.
{
  const S = rig({ kmt: ["shangdang_campaign", "kunming_incident"], support: [0, 4], options: { aid: true } });
  const L = E.legal(S, KMT);
  const a = act(S, KMT, "shangdang_campaign", "place", { order: "eventFirst" });
  check("選項關掉時:沒有 st.mechE、legal 與 ops 詢問沒有新欄位、平抑被拒絕", [
    ["st.mechE", undefined, S.mechE], ["legal 的 peg / radical", [false, false], ["peg" in L, "radical" in L]], ["牌的 uses.print", false, L.cards.some((c) => "print" in c.uses)],
    ["ops 詢問的 canPrint / radical", [false, false], ["canPrint" in a.pending, "radical" in a.pending]],
    ["平抑被拒絕", true, thrown(() => act(S, KMT, "american_aid", "peg")) != null],
  ]);
}

console.log(`PROBE 通過 ${pass} / 失敗 ${failN}`);
