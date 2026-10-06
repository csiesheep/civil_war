// #32, BE probe (brief 四.3): D decisions the acceptance does not cover, on rigs built like B6's (seed 11's
// opening with the free placements answered, both scoring cards headlined).
//   1. grayOrder: the Communists attack 晉中 (blue 2, gray 2) with 2 ops: which goes first, by 晉's attitude?
//   2. 整編 before the Communists are at the gates: 馬 loyal, 蘭州 in supply, nobody next to it;
//      the Nationalists hold one 2-op card. Do they 整編 蘭州 now (馬 → 觀望, 整編完成 if they control it)?
//   3. The free placement of turn 1 (察綏 is open to the Communists' free points since #24): where do they go?
//   node tuning/32/probe-decisions.mjs
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";

const CCP = 0, KMT = 1;
function opening(options = {}) {
  let st = E.createGame(11, options);
  for (let guard = 0; st.pending && guard < 10; guard++) st = E.apply(st, { type: "choose", side: st.pending.who, choice: st.pending.options.slice(0, st.pending.n ?? 1) });
  return E.clone(st);
}
function deal(st, side, cards) {
  for (const pile of ["draw", "discard", "removed"]) st[pile] = st[pile].filter((c) => !cards.includes(c));
  st.hands[1 - side] = st.hands[1 - side].filter((c) => !cards.includes(c));
  st.hands[side] = cards.slice();
}
function dBoard({ edits = {}, gray = {}, attitudes = {}, ccp = [], kmt = [] } = {}) {
  let st = opening({ aid: false, mechanismD: true });
  for (const [id, rb] of Object.entries(edits)) st.inf[id] = rb.slice();
  for (const [id, g] of Object.entries(gray)) E.setGray(st, id, g);
  for (const [p, a] of Object.entries(attitudes)) E.setAttitude(st, p, a);
  deal(st, CCP, ["score_north", ...ccp]); deal(st, KMT, ["score_east", ...kmt]);
  for (const side of [CCP, KMT]) st = E.apply(st, { type: "headline", side, card: st.hands[side].find((c) => E.CARD[c].scoring) });
  return st;
}
const ask = (st, side, n = 20) => { const out = {}; for (let i = 0; i < n; i++) { const a = B.decide(E.view(st, side), side, "normal", E.makeRng(900 + i)); const k = a.type === "choose" ? JSON.stringify(a.choice) : `${a.use}:${a.target || a.power || ""}${a.points ? ":" + a.points.join(",") : ""}`; out[k] = (out[k] || 0) + 1; } return out; };
const ccp2 = Object.keys(E.CARD).find((c) => E.CARD[c].side === CCP && !E.CARD[c].scoring && E.CARD[c].ops === 2);
const kmt2s = Object.keys(E.CARD).filter((c) => E.CARD[c].side === KMT && !E.CARD[c].scoring && E.CARD[c].ops === 2), kmt2 = kmt2s[0], kmt2b = kmt2s[1];
console.log(`cards: 共軍 2 點 ${ccp2},國軍 2 點 ${kmt2}、${kmt2b}`);

// 1. grayOrder
for (const att of ["loyal", "neutral", "ccp"]) {
  const S = dBoard({ edits: { jinzhong: [0, 2] }, gray: { jinzhong: 2 }, attitudes: { jin: att }, ccp: [ccp2], kmt: ["kunming_incident"] });
  let s;
  try { s = E.apply(S, { type: "play", side: CCP, card: ccp2, use: "campaign", target: "jinzhong", order: "opsFirst" }); }
  catch { s = E.apply(S, { type: "play", side: CCP, card: ccp2, use: "campaign", target: "jinzhong" }); }
  for (let g = 0; s.pending && s.pending.tag !== "grayOrder" && g < 5; g++) s = E.apply(s, { type: "choose", side: s.pending.who, choice: B.answer(s, s.pending, s.pending.who, E.makeRng(1)) });
  if (!s.pending || s.pending.tag !== "grayOrder") { console.log(`1. 晉${att}:沒有問順序(pending ${s.pending && s.pending.tag})`); continue; }
  const got = ask(s, KMT);
  const after = (o) => { const x = E.apply(s, { type: "choose", side: KMT, choice: o }); return `晉中 ${JSON.stringify(x.inf.jinzhong)} 灰 ${E.grayOf(x, "jinzhong")} 控制 ${E.controller(x, "jinzhong")} 評估 ${B.evaluate(x, KMT).toFixed(2)}`; };
  console.log(`1. grayOrder,晉${att}(晉中 藍 2 灰 2,共軍 2 點奇襲):國軍 20 次 ${JSON.stringify(got)};先移藍 → ${after("blue")};先移灰 → ${after("gray")}`);
}

// 2. 整編 before the gates
{
  const S = dBoard({ edits: { lanzhou: [0, 2] }, gray: { lanzhou: 2 }, attitudes: { ma: "loyal" }, ccp: [ccp2], kmt: [kmt2, kmt2b] });
  const s = E.apply(S, { type: "play", side: CCP, card: ccp2, use: "place", points: [] }); // the Communists pass their round (an empty 扶植)
  const ok = E.supplied(s).has("lanzhou");
  console.log(`2. 馬效忠、蘭州 藍 2 灰 2(上限 5)、有補給 ${ok}、控制 ${E.controller(s, "lanzhou")}、輪到 ${s.actor}:國軍 20 次 ${JSON.stringify(ask(s, KMT))}`);
  const sc = B.scoreCandidates(E.view(s, KMT), KMT, E.makeRng(5)).slice(0, 6).map((x) => `${x.v.toFixed(2)} ${x.a.card}:${x.a.use}:${x.a.target || ""}`);
  console.log(`   一次猜測的前六名:${sc.join(" | ")}`);
}

// 3. The free placement of turn 1 in a real game (no rig): what each side puts where.
for (const seed of [1, 2, 3, 4, 5]) {
  let st = E.createGame(seed, { mechanismD: true });
  const rng = E.makeRng((seed * 2654435761) >>> 0), seen = [];
  for (let g = 0; st.pending && g < 10; g++) {
    const who = st.pending.who, a = B.decide(E.view(st, who), who, "normal", rng);
    seen.push(`${who === CCP ? "共" : "國"} ${JSON.stringify(a.choice)}`);
    st = E.apply(st, a);
  }
  console.log(`3. seed ${seed} 免費放置:${seen.join(";")} → 易幟 ${JSON.stringify(st.mie)},察綏 ${JSON.stringify(st.inf.chasui)} 灰 ${E.grayOf(st, "chasui")}`);
}
