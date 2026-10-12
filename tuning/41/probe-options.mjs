// #41: one "on vs off" position probe per new option of C (brief #41, 四 1), and the bot's reading of the options.
// Every expected value is read off the option's rule sentence (tuning/41/report.txt, 三) and written here by hand;
// the engine (and the bot) only play the position. Run it against any checkout to see it red where the options do
// not exist:   node tuning/41/probe-options.mjs [repo dir, default this one]
// Prints one line per check ("ok" / "RED") and `PROBE-41 ok n / red m`; exits 1 on any red.
import { pathToFileURL } from "node:url";
import path from "node:path";

const dir = path.resolve(process.argv[2] || ".");
const E = await import(pathToFileURL(path.join(dir, "public/shared/engine.js")).href);
const B = await import(pathToFileURL(path.join(dir, "public/shared/bots.js")).href);
const CCP = 0, KMT = 1;
let ok = 0, red = 0;
const check = (what, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { ok++; console.log(`ok   ${what}: ${g}`); } else { red++; console.log(`RED  ${what}: expected ${w}, got ${g}`); }
};
const tryRun = (f) => { try { return f(); } catch (e) { return `threw: ${String(e.message).slice(0, 140)}`; } };
const threw = (x) => typeof x === "string" && x.startsWith("threw");

// The opening of seed 11 (aid off), every question answered with its first options ("no" to a free 佈線), the hands
// dealt (a side holding only its scoring card has nothing to play after the headline), the headlines played; then
// the points edited by hand ({ id: [red, blue] }), the mandate set to 0, the markers laid out.
function answerFirst(st) {
  for (let guard = 0; st.pending && guard < 20; guard++) {
    const p = st.pending;
    const choice = p.kind === "option" ? (p.options.some((o) => o.id === "no") ? "no" : p.options[0].id) : p.options.slice(0, p.min ?? p.n ?? 1);
    st = E.apply(st, { type: "choose", side: p.who, choice });
  }
  return st;
}
function deal(st, side, cards) {
  for (const pile of ["draw", "discard", "removed"]) st[pile] = st[pile].filter((c) => !cards.includes(c));
  st.hands[1 - side] = st.hands[1 - side].filter((c) => !cards.includes(c));
  st.hands[side] = cards.slice();
}
function rig({ options = {}, inf = {}, ccp = [], kmt = [], hand = [0, 0], at = {} } = {}) {
  let st = answerFirst(E.createGame(11, { aid: false, mechanismC: true, ...options }));
  if (st.phase !== "headline") throw new Error(`rig: phase ${st.phase}`);
  st = E.clone(st);
  deal(st, CCP, ["score_north", ...ccp]); deal(st, KMT, ["score_east", ...kmt]);
  for (const side of [CCP, KMT]) st = E.apply(st, { type: "headline", side, card: st.hands[side].find((c) => E.CARD[c].scoring) });
  st = E.clone(st);
  st.mandate = 0;
  for (const [id, rb] of Object.entries(inf)) st.inf[id] = rb.slice();
  E.setMoleHand(st, hand);
  for (const id of Object.keys(st.moles.at)) E.setMoles(st, id, []);
  for (const [id, l] of Object.entries(at)) E.setMoles(st, id, l);
  return st;
}
const play = (st, side, card, use, extra = {}) => E.apply(st, { type: "play", side, card, use, ...extra });
const choose = (st, choice) => E.apply(st, { type: "choose", side: st.pending.who, choice });
const blue = (st, id) => E.infOf(st, id)[KMT], rb = (st, id) => `${E.infOf(st, id)[CCP]}/${E.infOf(st, id)[KMT]}`;
const molesOf = (st, id) => JSON.stringify(E.molesAt(st, id));
const atSettle = (st) => { const s = E.clone(st); s.pending = null; s.plan = [{ do: "endTurn" }]; return E.run(s); };
const SPOTS = ["nanjing", "shanghai", "wuhan", "guangzhou"]; // the Nationalists' own, with room, 1 op a point (tuning/37)
const K3 = "surrender_order", K2 = ["kunming_incident", "takeover_officials"]; // 3-op and 2-op cards of the Nationalists

// ---- 1 cPurgeSplit: 「肅諜:每翻一個標記花 1 點行動點;這張牌剩下的點數照扶植的規則放國方點數。」
// A 3-op card: 1 marker (taiyuan, real) + 2 points (南京、上海 +1 each); 3 points with it refused; off: the points are
// not placed (a `points` key is ignored, as before #41).
{
  const S = (o) => rig({ options: o, kmt: [K3, ...K2], at: { taiyuan: [true] } });
  const on = S({ cPurgeSplit: true }), off = S({});
  const a = tryRun(() => play(on, KMT, K3, "politics", { purge: ["taiyuan"], points: SPOTS.slice(0, 2) }));
  const b = tryRun(() => play(on, KMT, K3, "politics", { purge: ["taiyuan"], points: SPOTS.slice(0, 3) }));
  const c = tryRun(() => play(off, KMT, K3, "politics", { purge: ["taiyuan"], points: SPOTS.slice(0, 2) }));
  check("cPurgeSplit:3 點牌翻太原 + 放 2 點:太原的標記、南京 / 上海的藍 +1", threw(a) ? a : [molesOf(a, "taiyuan"), ...SPOTS.slice(0, 2).map((id) => blue(a, id) - blue(on, id))], ["[]", 1, 1]);
  check("cPurgeSplit:3 點牌翻 1 個 + 放 3 點被拒", threw(b), true);
  check("cPurgeSplit 沒給:肅諜帶 points,南京 / 上海的藍不變", threw(c) ? c : SPOTS.slice(0, 2).map((id) => blue(c, id) - blue(off, id)), [0, 0]);
}

// ---- 2 cCaught: 「抓錯:民心往共軍 n」. A fake at taiyuan turned up: n = 0 → 民心 +0; n = 2 → +2; absent → +1 (today).
{
  const S = (o) => rig({ options: o, kmt: K2, at: { taiyuan: [false] } });
  const d = (o) => { const s = S(o), a = tryRun(() => play(s, KMT, K2[0], "politics", { purge: ["taiyuan"] })); return threw(a) ? a : a.mandate - s.mandate; };
  check("cCaught 0 / 2 / 沒給:抓錯的民心變動(往共軍為正)", [d({ cCaught: 0 }), d({ cCaught: 2 }), d({})], [0, 2, 1]);
}

// ---- 3 cLeakBonus: 「洩密:……而且這次進攻的行動點 +n」. 濟南藍 3, 淮海戰役 4 點暗選打援, 國軍固守, 濟南有真標記,
// 洩密改打點: today X = 4: 移除 3、放 1 → 1/0; +1: X = 5: 移除 3、放 2 → 2/0.
{
  const S = (o) => rig({ options: o, inf: { jinan: [0, 3] }, ccp: ["huaihai_campaign"], kmt: K2, at: { jinan: [true] } });
  const go = (s) => tryRun(() => { let x = choose(play(s, CCP, "huaihai_campaign", "campaign", { target: "jinan", siege: "relief" }), "hold"); x = choose(x, "point:jinan"); while (x.pending && x.pending.who === CCP && x.pending.tag === "defect") x = choose(x, "no"); return x; });
  const on = go(S({ cLeakBonus: 1 })), off = go(S({}));
  check("cLeakBonus 1 / 沒給:洩密改打點之後 濟南 紅/藍", [threw(on) ? on : rb(on, "jinan"), threw(off) ? off : rb(off, "jinan")], ["2/0", "1/0"]);
}

// ---- 4 cDefectAny: 「倒戈:圍點打援之後,只要標記在 T、T 還有國方點數就可以」. 濟南藍 5, 高樹勛起義 2 點打援, 國軍固守
// (圍城,濟南沒有被移除):on → 問倒戈,倒戈再移除 2 → 0/3;off → 不問。
// cDefect: 「倒戈:再移除 n 點」. 濟南藍 5, 2 點打點、固守:移除 2 剩 3;n = 3 → 0/0;沒給 → 0/1.
{
  const S = (o) => rig({ options: o, inf: { jinan: [0, 5] }, ccp: ["gao_shuxun"], kmt: K2, at: { jinan: [true] } });
  const go = (s, plan) => tryRun(() => { let x = choose(play(s, CCP, "gao_shuxun", "campaign", { target: "jinan", siege: plan }), "hold"); if (x.pending && x.pending.tag === "leak") x = choose(x, "no"); return x; });
  const on = go(S({ cDefectAny: true }), "relief"), off = go(S({}), "relief");
  const asked = (x) => (threw(x) ? x : !!(x.pending && x.pending.tag === "defect"));
  check("cDefectAny / 沒給:打援對固守之後問倒戈", [asked(on), asked(off)], [true, false]);
  check("cDefectAny:倒戈之後 濟南 紅/藍", threw(on) || !on.pending ? String(on) : rb(choose(on, "defect"), "jinan"), "0/3");
  const p3 = go(S({ cDefect: 3 }), "point"), p2 = go(S({}), "point");
  const turned = (x) => (threw(x) || !(x.pending && x.pending.tag === "defect") ? String(x).slice(0, 80) : rb(choose(x, "defect"), "jinan"));
  check("cDefect 3 / 沒給:打點固守、倒戈之後 濟南 紅/藍", [turned(p3), turned(p2)], ["0/0", "0/1"]);
}

// ---- 5 cHandover: 「和平易手:X ≥ 那座孤城國方點數的一半(進位)」/「X ≥ 1」. 濟南是孤城(魯中紅 5),真標記;2 點牌:
// 藍 3:half 可以(進位 2)、沒給不行;藍 5:half 不行(3)、one 可以。
{
  const S = (o, b) => rig({ options: o, inf: { luzhong: [5, 0], jinan: [0, b] }, ccp: ["gao_shuxun"], kmt: K2, at: { jinan: [true] } });
  const h = (s) => { const x = tryRun(() => play(s, CCP, "gao_shuxun", "politics", { handover: "jinan" })); return threw(x) ? "refused" : rb(x, "jinan"); };
  check("濟南是孤城", E.isolatedCities(S({}, 3)).includes("jinan"), true);
  check("cHandover half / 沒給(藍 3);half / one(藍 5):和平易手之後 濟南 紅/藍", [h(S({ cHandover: "half" }, 3)), h(S({}, 3)), h(S({ cHandover: "half" }, 5)), h(S({ cHandover: "one" }, 5))], ["1/0", "refused", "refused", "1/0"]);
}

// ---- 6 cFreePlant: 「每回合發牌之後,共軍可以免費佈 n 個標記」. Turn 1's 結算 walked to turn 2's deal: on → the Communists
// are asked (tag plant); real:taiyuan puts a real one on 太原 (hand [1, 0] → [0, 0]); fake with no fake in hand refused;
// the Nationalists' view of the question names cities only. Off: no question.
{
  const S = (o) => atSettle(rig({ options: o, hand: [1, 0] }));
  const on = S({ cFreePlant: 1 }), off = S({});
  const askedOn = !!(on.pending && on.pending.tag === "plant" && on.pending.who === CCP), askedOff = !!(off.pending && off.pending.tag === "plant");
  check("cFreePlant 1 / 沒給:第 2 回合發牌之後問共軍佈線", [askedOn, askedOff], [true, false]);
  if (askedOn) {
    const a = tryRun(() => choose(on, "real:taiyuan"));
    check("cFreePlant:選 real:taiyuan 之後 太原的標記、共軍手上", threw(a) ? a : [molesOf(a, "taiyuan"), E.moleHand(a)], ["[true]", [0, 0]]);
    check("cFreePlant:手上沒有假的,選 fake:taiyuan 被拒", threw(tryRun(() => choose(on, "fake:taiyuan"))), true);
    const v = E.view(on, KMT);
    check("cFreePlant:國軍看到的問題裡沒有 real / fake", v.pending.options.some((o) => /^(real|fake):/.test(o.id)), false);
    // The bot answers with a marker of the kind the hand holds (the hand is [1, 0]: a real one).
    const ans = B.decide(E.view(on, CCP), CCP, "normal", E.makeRng(5)).choice;
    check("bot(cFreePlant):手上只有真的,答的是 real:<城>", String(ans).startsWith("real:"), true);
  }
}

// ---- 7 cRealMandate: 「回合結算時,場上每一個真標記讓民心往共軍 n」. 太原、濟南各一個真的、徐州一個假的,n = 1:
// 結算時民心比沒給多 2;log 的 moleMandate n = 2. The bot: a real one on the board worth n more a turn left (turn 1:
// 8 turns) → the evaluation's mechC term +8 for one real marker; after a 結算 that said 0, the Nationalists' belief
// in a marker on the board is 0.
{
  // Both sides hold a card, so the rig stays in turn 1 (an empty hand on both sides walks the turn to its end).
  const S = (o, at = { taiyuan: [true], jinan: [true], xuzhou: [false] }) => rig({ options: o, ccp: ["gao_shuxun"], kmt: K2, at });
  const on = atSettle(S({ cRealMandate: 1 })), off = atSettle(S({}));
  const entry = on.log.find((l) => l.type === "moleMandate");
  check("cRealMandate 1 / 沒給:結算後民心的差、moleMandate 的 n", [on.mandate - off.mandate, entry ? entry.n : null], [2, 2]);
  const t = (s) => { const x = {}; B.evaluate(s, CCP, x); return x.mechC || 0; };
  const one = (o) => S(o, { taiyuan: [true] }), none = (o) => S(o, {});
  const dOn = t(one({ cRealMandate: 1 })) - t(none({ cRealMandate: 1 })), dOff = t(one({})) - t(none({}));
  check("bot(cRealMandate 1):一個真標記在評估裡多值 8(第 1 回合,8 個結算)", Math.round((dOn - dOff) * 1e9) / 1e9, 8);
  // The belief reads the log: the fake goes down by a 佈線 (the opening's hand, 1 real 2 fake), then the 結算.
  const planted = (o) => atSettle(play(rig({ options: o, ccp: ["gao_shuxun"], kmt: K2, hand: [1, 2] }), CCP, "gao_shuxun", "politics", { plant: [{ at: "taiyuan", real: false }] }));
  const fakeOnly = planted({ cRealMandate: 1 }), fakeOff = planted({});
  const bel = (s) => (B.moleBelief(E.view(s, KMT)).taiyuan || [null])[0];
  check("bot(cRealMandate 1):結算說場上 0 個真的之後,國軍信太原的標記是真的機率", bel(fakeOnly), 0);
  check("對照(沒給):同一個局面國軍的信念 > 0", bel(fakeOff) > 0, true);
}

// ---- 8 cLeakCapital false: 「洩密:標記只看 T 和 R,不看首都」. 只有南京有真標記,打濟南(打援對固守):沒給 → 問洩密;false → 不問.
{
  const S = (o) => rig({ options: o, inf: { jinan: [0, 3] }, ccp: ["huaihai_campaign"], kmt: K2, at: { nanjing: [true] } });
  const go = (s) => tryRun(() => choose(play(s, CCP, "huaihai_campaign", "campaign", { target: "jinan", siege: "relief" }), "hold"));
  const on = go(S({ cLeakCapital: false })), off = go(S({}));
  const asked = (x) => (threw(x) ? x : !!(x.pending && x.pending.tag === "leak"));
  check("cLeakCapital false / 沒給:只有南京有標記時問洩密", [asked(on), asked(off)], [false, true]);
}

// ---- the bot reads the 肅諜 options: under cPurgeSplit every 肅諜 candidate carries the rest of the ops as points
// (3-op card, 1 marker → 2 points); under cCaught 0 a 肅諜's own value (B.purgeValue) is higher by (1 − p) × 1 than
// today, p the Nationalists' belief in the marker named (the price of a fake is 民心 1 today, 0 under the option).
{
  const S = (o) => rig({ options: o, kmt: [K3], at: { taiyuan: [true, false] } });
  const sc = (s) => B.scoreCandidates(E.view(s, KMT), KMT, E.makeRng(3)).map((x) => x.a).filter((a) => a.purge);
  const on = sc(S({ cPurgeSplit: true })), off = sc(S({}));
  // Played: the 扶植 that follows spends the rest, 3 − the markers named (a point may cost 2: count the ops, not the points).
  const spent = (a) => { const x = tryRun(() => E.apply(S({ cPurgeSplit: true }), a)); if (threw(x)) return x; const l = x.log.filter((e) => e.type === "place").pop(); return (l ? l.spent : 0) + a.purge.length; };
  check("bot(cPurgeSplit):每個肅諜候選翻的個數 + 扶植花的點數 = 3", on.length ? on.map(spent) : "沒有肅諜候選", on.length ? on.map(() => 3) : []);
  check("bot(cPurgeSplit 沒給):肅諜候選沒有 points", off.length ? off.every((a) => a.points == null) : "沒有肅諜候選", true);
  const v0 = E.view(S({ cCaught: 0 }), KMT), v1 = E.view(S({}), KMT);
  const p = B.moleBelief(v1).taiyuan[0];
  check("bot(cCaught 0):purgeValue(太原 1 個) 比今天多 (1 − p) × 1", Math.round((B.purgeValue(v0, ["taiyuan"]) - B.purgeValue(v1, ["taiyuan"]) - (1 - p)) * 1e9) / 1e9, 0);
}

// ---- the bot reads the levers priced by the probe (bots.js C_W_OPT, tuning/41/runs/probe/): a real marker on 南京 (the
// capital) at turn 1 is worth 8 turns × the class's worth a turn more under cLeakBonus 1 (the probe's +2.31) and
// 8 × 0.44 less under cLeakCapital false; one on 濟南 laid as a 孤城 is worth 8 × 0.84 more under cDefectAny.
// (The numbers are the probe's, copied by hand from tuning/41/report.txt D; this checks that the bot reads them.)
{
  const t = (o, at, inf = {}) => { const s = rig({ options: o, ccp: ["gao_shuxun"], kmt: K2, at, inf }), x = {}; B.evaluate(s, CCP, x); return x.mechC || 0; };
  const d = (o, at, inf) => Math.round((t(o, at, inf) - t(o, {}, inf) - (t({}, at, inf) - t({}, {}, inf))) * 1e6) / 1e6;
  check("bot(cLeakBonus 1):南京一個真標記多值 8 × 2.31", d({ cLeakBonus: 1 }, { nanjing: [true] }), Math.round(8 * 2.31 * 1e6) / 1e6);
  check("bot(cLeakCapital false):南京一個真標記少值 8 × 0.44", d({ cLeakCapital: false }, { nanjing: [true] }), Math.round(-8 * 0.44 * 1e6) / 1e6);
  check("bot(cDefectAny):孤城濟南一個真標記多值 8 × 0.84", d({ cDefectAny: true }, { jinan: [true] }, { luzhong: [5, 0] }), Math.round(8 * 0.84 * 1e6) / 1e6);
}

console.log(`PROBE-41 ok ${ok} / red ${red}`);
if (red) process.exitCode = 1;
