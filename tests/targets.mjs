// The eight numbers of 「第一輪模擬」 and what the owner hoped to see, judged on a state file
// written by tests/sim.js. Orchestrator's file: a peer may run it, and does not edit it (TEAM.md).
//
//   node tests/targets.mjs <out>.state.json [cell ...]
//
// The targets are copied by hand from the plan (Projects/civil_war/civil_war plan.md, 「第一輪模擬」),
// which the owner wrote on 2026-10-01; the support tracks' script from the rulebook (三, 外國勢力):
//
//   每回合結束時的民心        前三回合偏國軍,第 5 回合前後交叉,之後偏共軍
//   共軍勝率                  35% 到 65% 之間
//   結束方式                  沒有一種超過五成;整編在第 4 回合前結束的對局低於一成
//   易幟勝場                  佔共軍勝場的一到三成
//   每座城第一次成為孤城的回合  多數在第 4 回合之後
//   每回合的孤城數            逐回合上升
//   遷都發生的回合            陝北在第 4 回合前後;南京在第 8 回合或沒發生
//   兩條支持度軌              每局的走勢大致照腳本,但牌讓它有一格上下的差別
//
// and the plan's stop rule: 「民心曲線和孤城時間兩項不對,就先調地圖、起始和槓桿,不往下做畫面。」
//
// owner 裁決(#23, 2026-10-03): the first round of tuning showed that 「多數在第 4 回合之後」 fights the
// design (cutting supply is the Communists' main weapon from the start). Asked how to treat it, the
// owner chose, in the pop-up, the option 「放寬這一項,再調一輪」, whose text read: 目標改成例如「開局沒有城
// 就成孤城、孤城數逐回合上升」;下一輪順便修 P2 的副作用:易幟太早、民心結束偏多、民心曲線要穩過. So the
// isolation item is now 「開局(第 0 回合,免費放置)沒有城成孤城」 (孤城數逐回合上升 is item 6 already); the
// old reading is still printed, as 只看. The stop items stay the mandate curve and this isolation item.
//
// How each sentence is read is the orchestrator's (#23), written next to each check below. Every
// per-turn number only counts the games that reached the end of that turn, so a late turn is the
// picture of the few long games: a turn is judged only when at least MIN_N games reached it.
import { readFileSync } from "node:fs";

const MIN_N = 50;
const pct = (k, n) => (n ? (100 * k / n).toFixed(1) + "%" : "–");
const TURNS = [1, 2, 3, 4, 5, 6, 7, 8];
// The support tracks' script, from the rulebook (三, 外國勢力): start [蘇, 美] = [1, 4]; turn 3 美 −1, turn 5 蘇 +1,
// turn 6 美 +1 only when 行憲軌 ≥ 2, turn 7 蘇 +1, turn 8 美 −2 -- so 美 4 4 3 3 3 4 4 2 and 蘇 1 1 1 1 2 2 3 3.
// A variant that moves the script (meta.variantOptions.supportStart / supportSchedule, #23) is judged against
// its own script: the target is the shape 「照腳本、差一格」, not the old numbers. A conditional move counts half
// on its own turn (3 or 4 → 3.5) and fully after it, as the rulebook's own line does.
const SCRIPT_START = [1, 4];
const SCRIPT_MOVES = [{ turn: 3, side: 1, delta: -1 }, { turn: 5, side: 0, delta: 1 }, { turn: 6, side: 1, delta: 1, kmtReform: 2 }, { turn: 7, side: 0, delta: 1 }, { turn: 8, side: 1, delta: -2 }];
export function supportScript(variantOptions = {}) {
  const start = variantOptions.supportStart || SCRIPT_START, moves = variantOptions.supportSchedule || SCRIPT_MOVES;
  return [0, 1].map((side) => TURNS.map((t) => start[side] + moves.filter((m) => m.side === side && m.turn <= t)
    .reduce((a, m) => a + (m.kmtReform != null && m.turn === t ? m.delta / 2 : m.delta), 0)));
}

export function judge(sum, meta = {}) {
  const g = sum.games, out = [];
  const add = (key, name, pass, said, info = false) => out.push({ key, name, pass, said, info });
  const mean = (o) => (o && o.n ? o.sum / o.n : null);
  const judged = (o) => o && o.n >= MIN_N;

  // 1 民心: mean mandate (negative = the Nationalists ahead) below 0 at the end of turns 1 to 3; the first
  // turn whose mean is at least 0 is turn 4, 5 or 6; every judged turn after it above 0. Turns 1 to 3 and
  // the crossing turn must be reached by a quarter of the games: a curve that only the longest few games
  // draw is not 「每回合結束時的民心」 of the game.
  {
    const m = TURNS.map((t) => mean(sum.mandateByTurn[t])), wide = (t) => judged(sum.mandateByTurn[t]) && sum.mandateByTurn[t].n >= g / 4;
    const ok3 = [1, 2, 3].every((t) => wide(t) && m[t - 1] < 0);
    const cross = TURNS.find((t) => m[t - 1] != null && m[t - 1] >= 0);
    const crossOk = cross >= 4 && cross <= 6 && wide(cross);
    const after = cross ? TURNS.filter((t) => t > cross && judged(sum.mandateByTurn[t])).every((t) => m[t - 1] > 0) : false;
    const curve = TURNS.map((t) => `${t}:${m[t - 1] == null ? "–" : m[t - 1].toFixed(1)}(${sum.mandateByTurn[t] ? sum.mandateByTurn[t].n : 0})`).join(" ");
    add("mandate", "民心曲線(前三回合偏國軍、第 4 到 6 回合交叉、之後偏共軍)", ok3 && crossOk && after,
      `${curve};${cross ? `第一次 ≥ 0 在第 ${cross} 回合` + (wide(cross) ? "" : `,但只有 ${sum.mandateByTurn[cross].n} 局打到那裡(不到四分之一)`) : "沒有交叉"}`);
  }
  // 2 共軍勝率
  add("ccpwin", "共軍勝率 35% 到 65%", sum.wins[0] / g >= 0.35 && sum.wins[0] / g <= 0.65, `${pct(sum.wins[0], g)}(${sum.wins[0]} / ${g})`);
  // 3 結束方式: no ending above half of the games, and 整編 (reason "alliance") at turn 3 or earlier under a tenth
  {
    const NAME = { alliance: "整編", mandate: "民心", unification: "易幟" }, nm = (k) => (NAME[k] ? `${NAME[k]}(${k})` : k);
    const top = Object.entries(sum.reasons).sort((a, b) => b[1] - a[1])[0] || ["–", 0];
    add("endings", "結束方式:沒有一種超過五成;整編在第 4 回合前結束的低於一成", top[1] / g <= 0.5 && sum.sealsBefore4 / g < 0.1,
      `最多的是 ${nm(top[0])} ${pct(top[1], g)};整編在第 4 回合前 ${pct(sum.sealsBefore4, g)};全部 ${Object.entries(sum.reasons).map(([k, v]) => `${nm(k)} ${v}`).join("、")}`);
  }
  // 4 易幟 (reason "unification") as a share of the Communists' wins, 10% to 30%; fewer than 30 Communist wins cannot tell
  {
    const u = sum.reasons.unification || 0, w = sum.wins[0];
    add("unification", "易幟佔共軍勝場的一到三成", w >= 30 && u / w >= 0.1 && u / w <= 0.3, w >= 30 ? `${pct(u, w)}(${u} / ${w})` : `共軍只贏 ${w} 局,不能判斷`);
  }
  // 5 孤城時間 (owner 裁決 #23, 2026-10-03): no city cut off at the opening -- the first isolations at turn 0
  // (the free placements, before anyone has played a card), summed over the cities, in under 5% of the games.
  // The first reading (more than half of all first isolations at turn 5 or later) is still printed, as 只看.
  {
    let early = 0, late = 0;
    for (const d of Object.values(sum.firstIsolated)) for (const [t, k] of Object.entries(d)) (Number(t) <= 4 ? (early += k) : (late += k));
    const zero = Object.values(sum.firstIsolated).reduce((a, d) => a + (d["0"] || 0), 0);
    const who = Object.entries(sum.firstIsolated).filter(([, d]) => d["0"]).map(([id, d]) => `${id} ${d["0"]}`).join("、");
    add("isolation", "開局(第 0 回合,免費放置)沒有城成孤城", zero < 0.05 * g, `第 0 回合成孤城 ${zero} 次(每局平均 ${(zero / g).toFixed(2)} 座;門檻 0.05)${who ? `:${who}` : ""}`);
    add("isolation-late", "(第一次的讀法)第一次成為孤城多數在第 4 回合之後", early + late > 0 && late / (early + late) > 0.5,
      `第 5 回合以後 ${pct(late, early + late)}(${late} / ${early + late})`, true);
  }
  // 6 孤城數逐回合上升: over the judged turns, never down by more than 0.25 from one turn to the next, and the last above the first
  {
    const ts = TURNS.filter((t) => judged(sum.isolatedByTurn[t])), v = ts.map((t) => mean(sum.isolatedByTurn[t]));
    const ok = ts.length >= 3 && v.every((x, i) => i === 0 || x >= v[i - 1] - 0.25) && v[v.length - 1] > v[0];
    add("isocount", "每回合的孤城數逐回合上升", ok, ts.map((t, i) => `${t}:${v[i].toFixed(2)}`).join(" ") + (ts.length < 8 ? `(只判斷有 ${MIN_N} 局以上的回合)` : ""));
  }
  // 7 遷都: of the games where 陝北 moved, the median turn is 3 to 5 (at least 20 such games); 南京 moved before turn 8 in under a tenth
  {
    const list = Object.entries(sum.capitalMoved[0]).flatMap(([t, k]) => Array(k).fill(Number(t))).sort((a, b) => a - b);
    const med = list.length ? list[Math.floor((list.length - 1) / 2)] : null;
    const nanEarly = Object.entries(sum.capitalMoved[1]).filter(([t]) => Number(t) < 8).reduce((a, [, k]) => a + k, 0);
    add("capital", "遷都:陝北在第 4 回合前後;南京在第 8 回合或沒發生", list.length >= 20 && med >= 3 && med <= 5 && nanEarly / g < 0.1,
      `陝北遷都 ${list.length} 局(${pct(list.length, g)}),中位第 ${med ?? "–"} 回合;南京在第 8 回合前遷都 ${nanEarly} 局`);
  }
  // 8 支持度軌: on every judged turn, the mean of each track within 1 of the script (the variant's own, if it moves it)
  {
    const [SU, US] = supportScript(meta.variantOptions || {}), fmt = (a) => a.map((x) => (Number.isInteger(x) ? x : `${x - 0.5}~${x + 0.5}`)).join(" ");
    const avg = (t, k) => { const o = sum.supportByTurn[t]; let s = 0; for (const [v, n] of Object.entries(o[k])) s += v * n; return s / o.n; };
    const ts = TURNS.filter((t) => judged(sum.supportByTurn[t])), off = [];
    for (const t of ts) { const u = avg(t, "us"), s = avg(t, "su"); if (Math.abs(u - US[t - 1]) > 1) off.push(`美 ${t}:${u.toFixed(1)}`); if (Math.abs(s - SU[t - 1]) > 1) off.push(`蘇 ${t}:${s.toFixed(1)}`); }
    add("support", "兩條支持度軌大致照腳本(每回合平均和腳本差不到一格)", ts.length > 0 && !off.length,
      `美 ${ts.map((t) => avg(t, "us").toFixed(1)).join(" ")}(腳本 ${fmt(US)});蘇 ${ts.map((t) => avg(t, "su").toFixed(1)).join(" ")}(腳本 ${fmt(SU)})` + (off.length ? `;差一格以上:${off.join("、")}` : ""));
  }
  return out;
}

const SELF = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (SELF) {
  const [file, ...want] = process.argv.slice(2);
  if (!file) { console.error("usage: node tests/targets.mjs <out>.state.json [cell ...]"); process.exit(2); }
  const state = JSON.parse(readFileSync(file, "utf8"));
  const names = want.length ? want : Object.keys(state.cells);
  for (const name of names) {
    const c = state.cells[name];
    if (!c) { console.log(`TARGETS ${name} 沒有這個 cell`); continue; }
    if (!c.sum.games) { console.log(`TARGETS ${name} 沒有打完的局`); continue; }
    const all = judge(c.sum, state.meta || {}), r = all.filter((x) => !x.info), stop = r.filter((x) => x.key === "mandate" || x.key === "isolation");
    console.log(`\n=== ${name}:${c.sum.games} 局${c.errors.length ? `,另有 ${c.errors.length} 局出錯` : ""}${state.meta && state.meta.variant ? `;變體 ${state.meta.variant}` : ""}`);
    for (const x of all) console.log(`${x.info ? `只看(${x.pass ? "會過" : "不會過"})` : x.pass ? "通過" : "失敗"} · ${x.name} · ${x.said}`);
    console.log(`TARGETS ${name} 通過 ${r.filter((x) => x.pass).length} / ${r.length};停損的兩項(民心曲線、開局沒有孤城)${stop.every((x) => x.pass) ? "通過" : "失敗"}`);
  }
}
