// #31, BE's probe: an event's free 奇襲 on blue + gray (the path the fuzz's D cell never reached in 300
// games; the bots did, seed 12). 掃清外圍 (neutral, 2 ops, 「打出者對任一個鄉免費奇襲」) played by the
// Communists as its event on 晉中 (village, S 2, cap 4), 紅 0 藍 2 灰 2, 晉 觀望, turn 1 (受降: no modifier).
// Expected by hand from the note (B2 破襲 = the old 奇襲: remove min(X, D), the rest placed red; D = 藍 + 灰,
// the Nationalists choose the order when both are there and not all go -- orchestrator 裁決 #31):
//   X = 2 < 藍 2 + 灰 2  → the Nationalists are asked (tag "grayOrder");
//   先移灰 → 晉中 0/2/0 (灰 2 off, nothing left over to place); 先移藍 → 0/0/2.
//   Neither leaves a 通共 power hit (晉 is 觀望), so the attitude stays 觀望.
// And the same event with 晉中 紅 0 藍 1 灰 1 (X 2 = everything): no question, 0/0/0.
//   node tuning/31/event-gray-order.mjs
import * as E from "../../public/shared/engine.js";

const CCP = 0, KMT = 1;
function rig(b, g) {
  let st = E.createGame(11, { aid: false, mechanismD: true });
  if (st.pending) st = E.apply(st, { type: "choose", side: CCP, choice: st.pending.options.slice(0, 3) });
  if (st.pending) st = E.apply(st, { type: "choose", side: KMT, choice: st.pending.options.slice(0, 4) });
  st = E.clone(st);
  st.inf.jinzhong = [0, b]; E.setGray(st, "jinzhong", g); E.setAttitude(st, "jin", "neutral");
  st.discard.push(...st.hands[CCP], ...st.hands[KMT]);
  const deal = (side, cards) => { for (const k of ["draw", "discard", "removed"]) st[k] = st[k].filter((c) => !cards.includes(c)); st.hands[side] = cards.slice(); };
  deal(CCP, ["score_north", "clearing_the_outskirts"]); deal(KMT, ["score_east", "kunming_incident"]);
  for (const side of [CCP, KMT]) st = E.apply(st, { type: "headline", side, card: st.hands[side].find((c) => E.CARD[c].scoring) });
  return st;
}
const gb = (st) => `${E.infOf(st, "jinzhong")[CCP]}/${E.infOf(st, "jinzhong")[KMT]}/${E.grayOf(st, "jinzhong")}`;
const out = [];
const eq = (got, want, what) => out.push([got === want, `${what}: 期望 ${want},實際 ${got}`]);
let a = E.apply(rig(2, 2), { type: "play", side: CCP, card: "clearing_the_outskirts", use: "event" });
a = E.apply(a, { type: "choose", side: CCP, choice: ["jinzhong"] });
const p = a.pending || {};
eq(`${p.who}/${p.kind}/${p.tag}`, `${KMT}/option/grayOrder`, "選了晉中之後的待決定(誰/種類/tag)");
if (p.tag === "grayOrder") {
  const g = E.apply(a, { type: "choose", side: KMT, choice: "gray" }), b = E.apply(a, { type: "choose", side: KMT, choice: "blue" });
  eq(gb(g), "0/2/0", "先移灰之後 晉中 紅/藍/灰"); eq(gb(b), "0/0/2", "先移藍之後 晉中 紅/藍/灰");
  eq(E.attitudeOf(g, "jin"), "neutral", "先移灰之後晉的態度");
  eq(g.log.some((l) => l.type === "eventEnd" && l.card === "clearing_the_outskirts" && l.effect), true, "事件的 eventEnd 說它有效果(只拿掉灰也算)");
}
let c = E.apply(rig(1, 1), { type: "play", side: CCP, card: "clearing_the_outskirts", use: "event" });
c = E.apply(c, { type: "choose", side: CCP, choice: ["jinzhong"] });
eq(c.pending ? c.pending.tag : "none", "none", "藍 1 灰 1、X 2 全部打光:沒有待決定");
eq(gb(c), "0/0/0", "藍 1 灰 1 打光之後 晉中 紅/藍/灰");
for (const [ok, msg] of out) console.log(`${ok ? "通過" : "失敗"} · ${msg}`);
const bad = out.filter(([ok]) => !ok).length;
console.log(`EVENT-GRAY-ORDER 通過 ${out.length - bad} / 失敗 ${bad}`);
process.exitCode = bad ? 1 : 0;
