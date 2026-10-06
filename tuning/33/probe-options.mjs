// #33: one "on vs off" position probe per new option (brief #33, 四 1). Every expected value is read off the
// rule's sentence (the note's map v0.2 table, D's rules 2 / 5 / 7 / 9 / 10, A4) and written here by hand; the
// engine only plays the position. Run it against any checkout to see it red where the options do not exist:
//   node tuning/33/probe-options.mjs [repo dir, default this one]
// Prints one line per check ("ok" / "RED") and `PROBE-33 ok n / red m`; exits 1 on any red.
import { pathToFileURL } from "node:url";
import path from "node:path";

const dir = path.resolve(process.argv[2] || ".");
const E = await import(pathToFileURL(path.join(dir, "public/shared/engine.js")).href);
const CCP = 0, KMT = 1;
const D = { mechanismD: true, aid: false };
const V02 = { chasui: 4, taiyuan: 4, jinzhong: 3, lanzhou: 4, guilin: 4, kunming: 4 }; // the note's map v0.2
let ok = 0, red = 0;
const check = (what, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { ok++; console.log(`ok   ${what}: ${g}`); } else { red++; console.log(`RED  ${what}: expected ${w}, got ${g}`); }
};
const gb = (st, id) => `${E.infOf(st, id)[CCP]}/${E.infOf(st, id)[KMT]}/${E.grayOf(st, id)}`; // 紅/藍/灰
const SIX = ["chasui", "taiyuan", "jinzhong", "lanzhou", "guilin", "kunming"];
const tryRun = (f) => { try { return f(); } catch (e) { return `threw: ${String(e.message).slice(0, 120)}`; } };

// The game as created: the Communists' free placement is the pending choice.
const fresh = (opts) => E.createGame(7, { ...D, ...opts });
// Both free placements answered with points outside the powers' spaces (冀中、太行、冀魯豫 / 濟南、徐州、南京、上海),
// then the hands emptied and the clock stopped at the start of turn 1's action: a rig to lay a position on.
function rig(opts, { att = {}, inf = {}, gray = {}, extra = (s) => s } = {}) {
  let st = fresh(opts);
  st = E.apply(st, { type: "choose", side: CCP, choice: ["jizhong", "taihang", "jiluyu"] });
  st = E.apply(st, { type: "choose", side: KMT, choice: ["jinan", "xuzhou", "nanjing", "shanghai"] });
  st = E.clone(st);
  for (const [id, rb] of Object.entries(inf)) st.inf[id] = rb.slice();
  for (const [id, g] of Object.entries(gray)) E.setGray(st, id, g);
  for (const [p, a] of Object.entries(att)) E.setAttitude(st, p, a);
  return extra(st);
}

// ---- 1 dGray: the opening's gray is the table's; the blue there is gone (today's blue 2 less the gray).
{
  const on = fresh({ dGray: V02 }), off = fresh({});
  check("dGray 開著:六個據點 紅/藍/灰(地圖 v0.2:察綏 灰 4 紅 2、太原 4、晉中 灰 3 紅 1、蘭州 4、桂林 4、昆明 4)",
    SIX.map((id) => gb(on, id)).join(" "), "2/0/4 0/0/4 1/0/3 0/0/4 0/0/4 0/0/4");
  check("dGray 沒給:同樣六個據點(#30:各灰 2、藍 0)", SIX.map((id) => gb(off, id)).join(" "), "2/0/2 0/0/2 1/0/2 0/0/2 0/0/2 0/0/2");
  // Rule 9: the Communists' free points 察綏 ×2 + 冀中 → red 4. Gray 4: 4 < 0 + 4 + 2, not theirs, no 易幟;
  // gray 2: 4 ≥ 0 + 2 + 2, theirs, 易幟 at turn 0 (#32's every game), 民心 +3.
  const put = (st) => E.apply(st, { type: "choose", side: CCP, choice: ["chasui", "chasui", "jizhong"] });
  const a = tryRun(() => put(on)), b = tryRun(() => put(off));
  check("dGray 開著:共軍免費放 察綏 2 點之後 綏易幟?/ 民心", typeof a === "string" ? a : [!!a.mie.sui, a.mandate], [false, 0]);
  check("dGray 沒給:同樣放之後 綏易幟?/ 民心", typeof b === "string" ? b : [!!b.mie.sui, b.mandate], [true, 3]);
  check("dGray 超過上限被拒(察綏上限 4,灰 5)", typeof tryRun(() => fresh({ dGray: { chasui: 5 } })) === "string", true);
}

// ---- 2 dFreeBar: the Communists' free placement offers no space of a power (察綏 was open by P10's freeAlso).
{
  const on = fresh({ dFreeBar: true }), off = fresh({});
  const powerIn = (st) => st.pending.options.filter((id) => E.powerOf(id));
  check("dFreeBar 開著:共軍免費放置可選的勢力據點", powerIn(on), []);
  check("dFreeBar 沒給:共軍免費放置可選的勢力據點", powerIn(off), ["chasui"]);
  check("dFreeBar 開著:國軍的免費放置不變(太原、蘭州、桂林、昆明照樣可選)",
    tryRun(() => E.apply(on, { type: "choose", side: CCP, choice: ["jizhong", "taihang", "jiluyu"] }).pending.options.filter((id) => E.powerOf(id))),
    ["taiyuan", "lanzhou", "guilin", "kunming"]);
}

// ---- 3 dAttitude: the opening attitudes; control reads them (rule 2: loyal gray is the Nationalists').
{
  const on = fresh({ dAttitude: { jin: "loyal", gui: "loyal" } }), off = fresh({});
  check("dAttitude 開著:五家的開局態度", ["sui", "jin", "gui", "ma", "dian"].map((p) => E.attitudeOf(on, p)), ["loyal", "loyal", "loyal", "loyal", "neutral"]);
  check("dAttitude 沒給:五家的開局態度(筆記的表)", ["sui", "jin", "gui", "ma", "dian"].map((p) => E.attitudeOf(off, p)), ["loyal", "neutral", "neutral", "loyal", "neutral"]);
  // 太原 S 3,藍 1 灰 2:效忠 1 + 2 ≥ 0 + 3 國軍控制;觀望只算藍,1 < 3 沒有人控制。
  const r = (opts) => tryRun(() => E.controller(rig(opts, { inf: { taiyuan: [0, 1] }, gray: { taiyuan: 2 } }), "taiyuan"));
  check("dAttitude 晉效忠 / 沒給(觀望):太原 藍 1 灰 2 的控制者", [r({ dAttitude: { jin: "loyal" } }), r({})], [KMT, null]);
}

// ---- 4 dThreshold: 統戰's threshold. 滇 is at the gates when the Communists control 桂林 (next to 昆明).
{
  const at = (opts) => rig(opts, { inf: { guilin: [3, 0] }, gray: { guilin: 0 } });
  const pol = (opts, ops) => tryRun(() => E.politicsOptions(at(opts), CCP, ops).filter((p) => p === "dian"));
  check("dThreshold 滇 3:2 點 / 3 點能不能統戰滇", [pol({ dThreshold: { dian: 3 } }, 2), pol({ dThreshold: { dian: 3 } }, 3)], [[], ["dian"]]);
  check("dThreshold 沒給(滇 2):2 點能不能統戰滇", pol({}, 2), ["dian"]);
}

// ---- 5 dMieVp / dSealVp: the 民心 of 易幟 (rule 9) and of 整編完成 (rule 10).
{
  // 察綏 S 2:紅 4 灰 2 → 4 ≥ 0 + 2 + 2,共軍控制本據 → 綏易幟。
  const mie = (opts) => tryRun(() => { const s = rig(opts, { inf: { chasui: [4, 0] }, gray: { chasui: 2 } }); s.mandate = 0; E.checkMarkers(s); return [!!s.mie.sui, s.mandate]; });
  check("dMieVp 綏 1:易幟、民心", mie({ dMieVp: { sui: 1 } }), [true, 1]);
  check("dMieVp 沒給(綏 3):易幟、民心", mie({}), [true, 3]);
  // 蘭州 S 3:藍 3 灰 0、最後一點灰是整編換掉的 → 3 ≥ 0 + 3,國軍控制本據 → 馬整編完成。
  const seal = (opts) => tryRun(() => { const s = rig(opts, { inf: { lanzhou: [0, 3] }, gray: { lanzhou: 0 } }); s.grayLast.ma = "politics"; s.mandate = 0; E.checkMarkers(s); return [!!s.seals.ma, s.mandate]; });
  check("dSealVp 3:整編完成、民心", seal({ dSealVp: 3 }), [true, -3]);
  check("dSealVp 沒給(2):整編完成、民心", seal({}), [true, -2]);
}

// ---- 6 dIntegrateMax: a 整編 turns min(X, gray, n). 蘭州 灰 4,國軍 4 點牌(整軍會議)整編蘭州。
{
  const play = (opts) => tryRun(() => {
    let s = rig({ dGray: V02, ...opts });
    s.hands = [["score_north"], ["score_east", "reorganisation_conference"]];
    s = E.apply(s, { type: "headline", side: CCP, card: "score_north" });
    s = E.apply(s, { type: "headline", side: KMT, card: "score_east" });
    s = E.apply(s, { type: "play", side: KMT, card: "reorganisation_conference", use: "politics", target: "lanzhou" });
    return gb(s, "lanzhou");
  });
  check("dIntegrateMax 2:4 點整編 蘭州(灰 4)之後 紅/藍/灰", play({ dIntegrateMax: 2 }), "0/2/2");
  check("dIntegrateMax 沒給:4 點整編 蘭州(灰 4)之後 紅/藍/灰", play({}), "0/4/0");
}

// ---- 7 dSettle: A4 at the 結算. 晉效忠;太行 紅 5、晉中 紅 4 灰 2(效忠:4 ≥ 0 + 2 + 2)都是共軍的 → 太原孤城。
// The turn is walked out with empty hands (turn 1: the 孤城 loses 1 blue, then A4).
{
  const settle = (opts, blue, isoLast) => tryRun(() => {
    let s = rig(opts, { att: { jin: "loyal" }, inf: { taihang: [5, 0], jinzhong: [4, 0], taiyuan: [0, blue] }, gray: { jinzhong: 2, taiyuan: 2 } });
    if (isoLast) s.dIsoLast = isoLast;
    s.hands = [[], []];
    s = E.run(s);
    if (!s.log.some((l) => l.type === "endTurn" && l.turn === 1)) return `沒有走到結算(turn ${s.turn} phase ${s.phase})`;
    return [gb(s, "taiyuan"), E.attitudeOf(s, "jin"), ...(s.dIsoLast ? [s.dIsoLast.includes("taiyuan")] : [])];
  });
  check("dSettle 沒給:太原 藍 2 灰 2 孤城,結算後(藍掉 1、晉往通共一格)", settle({}, 2), ["0/1/2", "neutral"]);
  check("dSettle noBlue:藍 2 → 結算掉 1 還有藍,晉不動", settle({ dSettle: "noBlue" }, 2), ["0/1/2", "loyal"]);
  check("dSettle noBlue:藍 1 → 結算掉光,沒有藍了,晉往通共一格", settle({ dSettle: "noBlue" }, 1), ["0/0/2", "neutral"]);
  check("dSettle twice:上一次結算太原不是孤城 → 晉不動,記下這一次的孤城", settle({ dSettle: "twice" }, 2), ["0/1/2", "loyal", true]);
  check("dSettle twice:上一次結算太原也是孤城 → 晉往通共一格", settle({ dSettle: "twice" }, 2, ["taiyuan"]), ["0/1/2", "neutral", true]);
}

console.log(`PROBE-33 ok ${ok} / red ${red}`);
process.exit(red ? 1 : 0);
