// #37: the bot reads E's options (brief #37, 三: 「ePrice 與評估要讀選項算,但只在那些選項開著時不同」). One
// on-vs-off check per input the options change; every expected value is worked out here by hand from the
// option's rule and the price rule of #36 (each threshold's cost spread evenly over the steps up to it):
//   node tuning/37/probe-bot.mjs [repo dir, default this one]
// Prints "ok" / "RED" per check and `PROBE-37-BOT ok n / red m`; exits 1 on any red.
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
const r3 = (x) => (typeof x === "number" ? Math.round(x * 1000) / 1000 : x);
// The rig of tuning/37/probe-options.mjs: turn 1, the headlines played, the Nationalists to act.
function board({ kmt = [], inflation = 0, options = {} } = {}) {
  let st = E.createGame(11, { aid: false, mechanismE: true, ...options });
  for (let guard = 0; st.pending && guard < 10; guard++) st = E.apply(st, { type: "choose", side: st.pending.who, choice: st.pending.options.slice(0, st.pending.n ?? 1) });
  st = E.clone(st);
  const deal = (side, cards) => {
    for (const pile of ["draw", "discard", "removed"]) st[pile] = st[pile].filter((c) => !cards.includes(c));
    st.hands[1 - side] = st.hands[1 - side].filter((c) => !cards.includes(c));
    st.hands[side] = cards.slice();
  };
  deal(CCP, ["score_north"]); deal(KMT, ["score_east", ...kmt]);
  for (const side of [CCP, KMT]) st = E.apply(st, { type: "headline", side, card: st.hands[side].find((c) => E.CARD[c].scoring) });
  st = E.clone(st); st.mandate = 0;
  E.setInflation(st, inflation);
  return st;
}
const K3 = ["kunming_incident", "takeover_officials", "sino_soviet_treaty"];
const EARLY = [{ at: 2, vp: 1 }, { at: 4, vp: 2, centrists: 1 }, { at: 6, hand: 1 }, { at: 8, lose: true }];

// 1 ePrice reads the thresholds' places. Today, inflation 1 → 2: no threshold crossed; 3 costs 民心 1 over 3 steps,
// the walked part goes 1/3 → 2/3: price 1/3. eInflation 2 / 4 / 6 / 8 (2: 民心 1): 1 → 2 crosses 2 (民心 1), the next
// threshold (4) starts there (walked part 0), and before it the walked part of 2 was 1 × 1/2: price 1 + 0 − 1/2 = 0.5.
check("ePrice 國軍 通膨 1(今天的門檻)", r3(tryRun(() => B.ePrice(board({ inflation: 1 }), KMT))), 0.333);
check("ePrice 國軍 通膨 1(門檻 2 / 4 / 6 / 8)", r3(tryRun(() => B.ePrice(board({ inflation: 1, options: { eInflation: EARLY } }), KMT))), 0.5);
// 2 ePrice reads 印鈔's step: at 8, +2 is 10 = the collapse (the loss, 1000); +1 is 9, not the loss.
check("ePrice 國軍 通膨 8,ePrintStep 2(印了就是 10)", tryRun(() => B.ePrice(board({ inflation: 8, options: { ePrintStep: 2 } }), KMT)), 1000);
check("ePrice 國軍 通膨 8,今天(印了是 9)< 1000", tryRun(() => B.ePrice(board({ inflation: 8 }), KMT) < 1000), true);
// 3 the collapse's place: with 8 the collapse, inflation 7 cannot print (the loss); today it can.
check("ePrice 國軍 通膨 7,崩潰在 8", tryRun(() => B.ePrice(board({ inflation: 7, options: { eInflation: EARLY } }), KMT)), 1000);
// 4 the per-turn cap: after one print this turn with ePrintPerTurn 1 the bot never prints (the engine refuses it,
// so the candidate must not exist); without the cap it does print with a free hand of 2-op cards at inflation 1.
const second = (opts) => {
  const s = board({ kmt: K3, options: opts });
  const a = E.apply(s, { type: "play", side: KMT, card: "kunming_incident", use: "place", points: ["nanjing", "shanghai", "wuhan"], print: true });
  if (E.mustAct(a).join() !== String(KMT) || a.pending) return `rig: ${E.mustAct(a)} must act`;
  let n = 0;
  for (let i = 0; i < 6; i++) { const d = B.decide(E.view(a, KMT), KMT, "normal", E.makeRng(700 + i)); if (d && d.print) n++; }
  return n;
};
check("ePrintPerTurn 1:同一回合第二個行動回合,6 個 rng 裡印鈔的次數", tryRun(() => second({ ePrintPerTurn: 1 })), 0);
check("ePrintPerTurn 沒給:同樣的局面,6 個 rng 裡有印鈔(> 0)", tryRun(() => second({}) > 0), true);

console.log(`PROBE-37-BOT ok ${ok} / red ${red}`);
process.exitCode = red ? 1 : 0;
