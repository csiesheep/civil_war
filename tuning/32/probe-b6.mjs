// #32, BE probe: the three positions of tests/bots.test.js B6, rebuilt the same way (the engine's opening
// of seed 11 with the free placements answered, red / blue edits, gray and attitudes laid over, the hands
// dealt, both scoring cards headlined), and what the bot makes of them: the decision over 20 rng seeds,
// and the top candidates of one guess with their values.
//   node tuning/32/probe-b6.mjs [top=8]
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";

const CCP = 0, KMT = 1, top = Number(process.argv[2] || 8);
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
const what = (a) => `${a.use || a.type}:${a.target || a.power || ""}`;
function look(name, S, side) {
  const got = {};
  for (let i = 0; i < 20; i++) { const k = what(B.decide(E.view(S, side), side, "normal", E.makeRng(700 + i))); got[k] = (got[k] || 0) + 1; }
  console.log(`== ${name}: ${JSON.stringify(got)}`);
  const sc = B.scoreCandidates(E.view(S, side), side, E.makeRng(700));
  for (const { a, v } of sc.slice(0, top)) console.log(`   ${v.toFixed(2)}  ${a.card} ${what(a)} ${a.points ? a.points.join(",") : ""}${a.order ? " " + a.order : ""}`);
  const pol = sc.filter((x) => x.a.use === "politics");
  for (const { a, v } of pol) console.log(`   [politics] ${v.toFixed(2)}  ${a.card} ${what(a)}${a.order ? " " + a.order : ""}`);
}

const base = dBoard({ kmt: ["kunming_incident"] });
const ev = (a, side) => { const c = E.clone(base); E.setAttitude(c, "gui", a); return B.evaluate(c, side); };
console.log(`評估看態度 國軍 ${["loyal", "neutral", "ccp"].map((a) => ev(a, KMT).toFixed(2)).join(" → ")};共軍 ${["loyal", "neutral", "ccp"].map((a) => ev(a, CCP).toFixed(2)).join(" → ")}`);

const S1 = dBoard({ edits: { xian: [3, 0] }, gray: { lanzhou: 2 }, attitudes: { ma: "neutral" }, kmt: ["takeover_officials", "kunming_incident"] });
console.log(`suicide: actor ${S1.actor}, lanzhou supplied ${E.supplied(S1).has("lanzhou")}`);
look("自殺整編(國軍)", S1, KMT);

const S2 = dBoard({ edits: { jinzhong: [4, 0] }, ccp: ["huaihai_campaign"], kmt: ["kunming_incident"] });
console.log(`talks: actor ${S2.actor}, taiyuan supplied ${E.supplied(S2).has("taiyuan")}, jin ${E.attitudeOf(S2, "jin")}`);
look("一步易幟的統戰(共軍)", S2, CCP);
// The acceptance's position since 38f4319 (太原 blue 2 gray 0, 察綏 red 0 blue 2 gray 2).
const S2b = dBoard({ edits: { jinzhong: [4, 0], taiyuan: [0, 2], chasui: [0, 2] }, gray: { taiyuan: 0 }, ccp: ["huaihai_campaign"], kmt: ["kunming_incident"] });
console.log(`38f4319 rig: taiyuan supplied ${E.supplied(S2b).has("taiyuan")}, gray taiyuan ${E.grayOf(S2b, "taiyuan")}, chasui ${JSON.stringify(S2b.inf.chasui)} gray ${E.grayOf(S2b, "chasui")} sui ${E.attitudeOf(S2b, "sui")} controller ${E.controller(S2b, "chasui")}`);
look("38f4319 的統戰局面(共軍)", S2b, CCP);
// The same with 察綏 out of the Communists' reach by placement (red 2, blue 2, gray 2: red would need
// blue + gray + S = 6 > the cap 4), so that 統戰 晉 is the one 易幟 this card can buy.
const S3 = dBoard({ edits: { jinzhong: [4, 0], chasui: [2, 2] }, ccp: ["huaihai_campaign"], kmt: ["kunming_incident"] });
console.log(`talks, 察綏 2/2/2: actor ${S3.actor}, taiyuan supplied ${E.supplied(S3).has("taiyuan")}, jin ${E.attitudeOf(S3, "jin")}`);
look("一步易幟的統戰,察綏打不下來(共軍)", S3, CCP);
// A rig with one instant 易幟 and no free 結算 step: 綏 neutral, 察綏 (a village: never a 孤城) red 2 /
// blue 2 / gray 2 out of the Communists' reach, cut off (北平 and 晉中 the Communists'): 3 點統戰綏 =
// 綏通共 = 易幟. 太原 is in supply (晉中 not the Communists').
const S4 = dBoard({ edits: { beiping: [5, 0], jinzhong: [4, 0], chasui: [2, 2] }, attitudes: { sui: "neutral" }, ccp: ["huaihai_campaign"], kmt: ["kunming_incident"] });
console.log(`clean rig: actor ${S4.actor}, chasui supplied ${E.supplied(S4).has("chasui")}, taiyuan supplied ${E.supplied(S4).has("taiyuan")}, ctl beiping ${E.controller(S4, "beiping")}, jinzhong ${E.controller(S4, "jinzhong")} ${JSON.stringify(S4.inf.jinzhong)}`);
look("乾淨的一步易幟統戰(共軍)", S4, CCP);
