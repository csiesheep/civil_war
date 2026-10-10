// #39 probe (brief 五 2): cases of C that group 16 does not write, printed so a reader can see what the engine does.
//   node tuning/39/probe-uncovered.mjs
// The rig is group 16's (createGame(11, { aid: false, … }), the free placements answered with their first options,
// both hands emptied, the cards named dealt, the scoring card headlined, 民心 0), re-built here.
import * as E from "../../public/shared/engine.js";
const CCP = 0, KMT = 1;
const J = (x) => JSON.stringify(x ?? null);
const rb = (st, id) => E.infOf(st, id).join("/");
function rig({ ccp = [], kmt = [], hand = null, at = {}, options = { mechanismC: true }, edits = {}, seed = 11 } = {}) {
  let st = E.createGame(seed, { aid: false, ...options });
  if (st.pending) st = E.apply(st, { type: "choose", side: CCP, choice: st.pending.options.slice(0, st.pending.n) });
  if (st.pending) st = E.apply(st, { type: "choose", side: KMT, choice: st.pending.options.slice(0, st.pending.n) });
  st = E.clone(st);
  for (const [id, e] of Object.entries(edits)) { const a = st.inf[id] || (st.inf[id] = [0, 0]); if (e.r != null) a[0] = e.r; if (e.b != null) a[1] = e.b; }
  st.discard.push(...st.hands[CCP], ...st.hands[KMT]);
  st.hands = [[], []];
  const deal = (side, cards) => { for (const p of ["draw", "discard", "removed"]) st[p] = st[p].filter((c) => !cards.includes(c)); st.hands[side] = cards.slice(); };
  deal(CCP, ["score_north", ...ccp]); deal(KMT, ["score_east", ...kmt]);
  for (const side of [CCP, KMT]) { const c = st.hands[side].find((x) => E.CARD[x].scoring); if (c) st = E.apply(st, { type: "headline", side, card: c }); }
  st.mandate = 0;
  if (hand) E.setMoleHand(st, hand);
  for (const [id, l] of Object.entries(at)) E.setMoles(st, id, l);
  return st;
}
const choose = (st, choice) => E.apply(st, { type: "choose", side: st.pending.who, choice });
const tag = (st) => (st.pending ? `${st.pending.who === CCP ? "共" : "國"}:${st.pending.tag}` : "none");
const thrown = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

// (a) A city taken with a real and a fake marker on it: both go home; no 倒戈 is asked (nothing left at T).
//     (a2) The same with 2 blue: not taken (red 2 < blue 0 + 安定 3), so 倒戈 is asked with no blue left to take.
for (const b of [1, 2]) {
  const S = rig({ edits: { jinan: { b } }, ccp: ["huaihai_campaign"], kmt: ["kunming_incident", "takeover_officials"], hand: [0, 0], at: { jinan: [true, false] } });
  let a = E.apply(S, { type: "play", side: CCP, card: "huaihai_campaign", use: "campaign", target: "jinan", siege: "point" });
  a = choose(a, "hold");
  const leakAsked = tag(a);
  if (a.pending && a.pending.tag === "leak") a = choose(a, "no");
  console.log(`(a${b === 1 ? "" : "2"}) 濟南藍 ${b} [真, 假],打點 4 對固守:洩密 ${leakAsked};之後 濟南 ${rb(a, "jinan")} 控制 ${E.controller(a, "jinan")};濟南的標記 ${J(E.molesAt(a, "jinan"))};共軍手上 ${J(E.moleHand(a))};待決定 ${tag(a)}`);
}
// (b) 洩密 and 倒戈 in the same attack: 濟南藍 5 [真, 真], 打援 → 固守 → 洩密改打點 (one real out) → 打點移除 4 → 倒戈 (the other).
{
  const S = rig({ edits: { jinan: { b: 5 } }, ccp: ["huaihai_campaign"], kmt: ["kunming_incident", "takeover_officials"], hand: [0, 0], at: { jinan: [true, true] } });
  let a = E.apply(S, { type: "play", side: CCP, card: "huaihai_campaign", use: "campaign", target: "jinan", siege: "relief" });
  a = choose(a, "hold");
  const t1 = tag(a);
  a = choose(a, "point:jinan");
  const mid = `${rb(a, "jinan")} ${J(E.molesAt(a, "jinan"))}`, t2 = tag(a);
  a = choose(a, "defect");
  console.log(`(b) 濟南藍 5 [真, 真] 打援 → 固守:${t1} → point:jinan → 濟南 ${mid},${t2} → defect → 濟南 ${rb(a, "jinan")} 標記 ${J(E.molesAt(a, "jinan"))},出局的真 ${a.moles.out};紀錄 ${J(a.log.filter((l) => ["leak", "defect", "siegeResult"].includes(l.type)).map((l) => ({ type: l.type, plan: l.plan, removed: l.removed })))}`);
}
// (c) D and C both on: 統戰 / 整編 by `power` / `target`, 佈線 / 肅諜 by `plant` / `purge`; both keys at once is refused.
{
  const o = { mechanismC: true, mechanismD: true };
  const S = rig({ ccp: ["gao_shuxun"], kmt: ["kunming_incident"], hand: [1, 2], options: o });
  const p = E.apply(S, { type: "play", side: CCP, card: "gao_shuxun", use: "politics", plant: [{ at: "taiyuan", real: false }] });
  const both = thrown(() => E.apply(S, { type: "play", side: CCP, card: "gao_shuxun", use: "politics", plant: [{ at: "jinan", real: false }], power: "jin" }));
  const L = E.legal(S, CCP).cards.find((c) => c.id === "gao_shuxun").uses;
  console.log(`(c) D+C:太原(藍 ${E.infOf(S, "taiyuan")[KMT]} 灰 ${E.grayOf(S, "taiyuan")})佈假 → 太原的標記 ${J(E.molesAt(p, "taiyuan"))};同時 plant + power:${both};legal 的 politics ${J(L.politics)} moles.plant 有太原 ${L.moles && L.moles.plant.includes("taiyuan")}`);
  const K = rig({ kmt: ["kunming_incident", "takeover_officials"], hand: [0, 0], at: { taiyuan: [false] }, options: o });
  const pu = E.apply(K, { type: "play", side: KMT, card: "kunming_incident", use: "politics", purge: ["taiyuan"] });
  const ig = E.apply(K, { type: "play", side: KMT, card: "kunming_incident", use: "politics", target: "taiyuan" });
  console.log(`    國軍 肅諜太原 → 共軍手上 ${J(E.moleHand(pu))} 民心 ${pu.mandate};整編太原 → 太原 藍 ${E.infOf(ig, "taiyuan")[KMT]} 灰 ${E.grayOf(ig, "taiyuan")} 晉 ${E.attitudeOf(ig, "jin")}`);
}
// (d) 肅諜 names a city of [真, 假] once: which one is the engine's dice (the game's rng), over 400 seeds.
{
  let real = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const S = rig({ seed, kmt: ["kunming_incident", "takeover_officials"], hand: [0, 0], at: { jinan: [true, false] } });
    const a = E.apply(S, { type: "play", side: KMT, card: "kunming_incident", use: "politics", purge: ["jinan"] });
    if (a.log.find((l) => l.type === "purge").flipped[0].real) real++;
  }
  console.log(`(d) 肅諜 [真, 假] 的城一次:400 個種子裡翻到真的 ${real} 次`);
}
// (e) B off: no 圍點打援, so no 洩密 / 倒戈 is ever asked; the old 奇襲 takes 濟南 and the marker goes home.
{
  const S = rig({ edits: { jinan: { b: 1 } }, ccp: ["huaihai_campaign"], kmt: ["kunming_incident", "takeover_officials"], hand: [0, 0], at: { jinan: [true] }, options: { mechanismC: true, mechanismB: false } });
  const a = E.apply(S, { type: "play", side: CCP, card: "huaihai_campaign", use: "campaign", target: "jinan" });
  console.log(`(e) B 關,奇襲濟南(藍 1、[真]):待決定 ${tag(a)};濟南 ${rb(a, "jinan")} 控制 ${E.controller(a, "jinan")};標記 ${J(E.molesAt(a, "jinan"))} 手上 ${J(E.moleHand(a))}`);
}
