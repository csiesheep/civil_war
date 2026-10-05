// #31, BE's probe for what group 14 does not cover: supply under mechanism D, recomputed by hand at
// every step of random games (the product's random player) and compared with the engine.
//   node tuning/31/supply-probe.mjs [games=200] [firstSeed=1]
//
// Written from the note (group 14's comment), not from engine.js; nothing below calls E.controller,
// E.supplied, E.isolatedCities or E.checkMarkers:
//   control (rule 2)  紅 ≥ 藍 + 灰 + S → 共軍;效忠 藍 + 灰 ≥ 紅 + S、觀望 藍 ≥ 紅 + S、通共 藍 ≥ 紅 + 灰 + S → 國軍
//   supply (A)        sources: the ports the Nationalists control and their capital now; a space is
//                     supplied when a chain of spaces none of which the Communists control joins it to one
//   孤城              a city with blue OR gray that is not supplied (or is besieged: B's 圍城)
//   易幟 (rule 9)     after every action no power without a marker may have its home controlled by the
//                     Communists, or lean to them (通共) with its home not supplied -- the home of 綏 is
//                     察綏, a village: the same chain decides it
//   and the bookkeeping: blue + gray within the cap, gray only in the powers' own spaces and never more
//   than before, a power has at most one marker and keeps it, at most one 整編完成 a turn.
// Prints the counts of the positions that make each reading discriminating (a gray-only 孤城, a
// village home cut off, a 通共 power ...), so a green run says what it actually looked at.
import * as E from "../../public/shared/engine.js";
import { playRandomGame } from "../../tests/driver.js";

const CCP = 0, KMT = 1;
const games = Number(process.argv[2] || 200), first = Number(process.argv[3] || 1);
const SPEC = { // the note's table (group 14), for the spaces and homes
  sui: { home: "chasui", spaces: ["chasui"] }, jin: { home: "taiyuan", spaces: ["taiyuan", "jinzhong"] },
  gui: { home: "guilin", spaces: ["guilin"] }, ma: { home: "lanzhou", spaces: ["lanzhou"] }, dian: { home: "kunming", spaces: ["kunming"] },
};
const OWNER = Object.fromEntries(Object.entries(SPEC).flatMap(([p, d]) => d.spaces.map((id) => [id, p])));
const inf = (st, id) => st.inf[id] || [0, 0];
const gray = (st, id) => (st.gray && st.gray[id]) || 0;
function ctl(st, id) {
  const [r, b] = inf(st, id), g = gray(st, id), S = E.SPACE[id].stability, a = g ? st.attitude[OWNER[id]] : "loyal";
  if (r >= b + g + S) return CCP;
  const k = a === "loyal" ? b + g : b, vs = a === "ccp" ? r + g : r;
  return k >= vs + S ? KMT : null;
}
function supplyByHand(st) {
  const capital = (st.capital && st.capital[KMT]) || "nanjing";
  const open = (id) => ctl(st, id) !== CCP;
  const seen = new Set(E.SPACES.filter((s) => ((s.port && ctl(st, s.id) === KMT) || s.id === capital) && open(s.id)).map((s) => s.id));
  const queue = [...seen];
  while (queue.length) for (const a of E.SPACE[queue.shift()].adj) if (!seen.has(a) && open(a)) { seen.add(a); queue.push(a); }
  return seen;
}
const besieged = (st, id) => (st.effects || []).some((e) => e.kind === "siege" && e.space === id);

const seen = { steps: 0, grayOnlyIsolated: 0, grayIsolated: 0, villageHomeCut: 0, ccpLeaning: 0, ccpLeaningCut: 0, mie: 0, seal: 0, mieTalks: 0, mieConquest: 0 };
const problems = [];
const say = (seed, st, msg) => { if (problems.length < 20) problems.push(`種子 ${seed} 回合 ${st.turn}:${msg}`); };
for (let seed = first; seed < first + games; seed++) {
  let prev = null;
  const onStep = (st) => {
    seen.steps++;
    const ok = supplyByHand(st), engine = E.supplied(st);
    const a = [...ok].sort().join(), b = [...engine].sort().join();
    if (a !== b) say(seed, st, `補給不同:手算 ${a} / 引擎 ${b}`);
    const iso = E.SPACES.filter((s) => s.kind === "city" && inf(st, s.id)[KMT] + gray(st, s.id) > 0 && (!ok.has(s.id) || besieged(st, s.id))).map((s) => s.id).sort();
    if (iso.join() !== E.isolatedCities(st).slice().sort().join()) say(seed, st, `孤城不同:手算 ${iso} / 引擎 ${E.isolatedCities(st).slice().sort()}`);
    for (const id of iso) if (gray(st, id)) { seen.grayIsolated++; if (!inf(st, id)[KMT]) seen.grayOnlyIsolated++; }
    if (!ok.has("chasui")) seen.villageHomeCut++;
    if (st.winner == null) for (const [p, d] of Object.entries(SPEC)) {
      if (st.mie[p] || st.seals[p]) continue;
      if (ctl(st, d.home) === CCP) say(seed, st, `${p} 的本據 ${d.home} 在共軍手上,卻沒有易幟`);
      if (st.attitude[p] === "ccp") { seen.ccpLeaning++; if (!ok.has(d.home)) { seen.ccpLeaningCut++; say(seed, st, `${p} 通共、本據 ${d.home} 沒有補給,卻沒有易幟`); } }
    }
    for (const s of E.SPACES) {
      if (inf(st, s.id)[KMT] + gray(st, s.id) > s.stability + 2) say(seed, st, `${s.id} 藍加灰超過上限`);
      if (gray(st, s.id) && !OWNER[s.id]) say(seed, st, `${s.id} 不是勢力的據點卻有灰`);
      if (prev && gray(st, s.id) > gray(prev, s.id)) say(seed, st, `${s.id} 的灰變多了`);
    }
    for (const p of Object.keys(SPEC)) {
      if (st.mie[p] && st.seals[p]) say(seed, st, `${p} 兩種標記都有`);
      if (prev && ((prev.mie[p] && !st.mie[p]) || (prev.seals[p] && !st.seals[p]))) say(seed, st, `${p} 的標記不見了`);
    }
    prev = E.clone({ gray: st.gray, mie: st.mie, seals: st.seals, inf: st.inf, attitude: st.attitude });
  };
  const { st } = playRandomGame(seed, { mechanismD: true }, { onStep });
  const seals = st.log.filter((l) => l.type === "seal"), byTurn = {};
  for (const l of seals) { byTurn[l.t] = (byTurn[l.t] || 0) + 1; if (byTurn[l.t] > 1) say(seed, st, `第 ${l.t} 回合放了兩個整編完成`); }
  for (const l of st.log) if (l.type === "mie") { seen.mie++; if (l.how === "talks") seen.mieTalks++; else seen.mieConquest++; }
  seen.seal += seals.length;
}
for (const p of problems) console.log(`失敗 · ${p}`);
console.log(`看過的盤面 ${JSON.stringify(seen)}`);
console.log(`SUPPLY-PROBE 局數 ${games} / 問題 ${problems.length}`);
process.exitCode = problems.length ? 1 : 0;
