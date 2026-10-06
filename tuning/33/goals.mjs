// #33: D's own goals (brief #33, 三) and the ten targets, read from tests/sim.js state files (and the
// tests/targets.mjs output next to each, <state>.targets.txt, when there is one). Nothing is copied by hand.
//   node tuning/33/goals.mjs <name>=<a.state.json> [<name>=<b.state.json> …]
// One block per batch, then one summary row each:
//   G1 games with a marker at turn 0 (the free placement) < 5%
//   G2 each power both 易幟 and 整編完成 in ≥ 5% of games (the lowest of the ten shares is shown)
//   G3 the first 易幟 mostly at turn 4 or later: share of the games with an 易幟 whose first is at turn ≥ 4 > 50%
//   G4 ten targets ≥ 8 and the Communists 35–65%
//   G5 統戰 chosen when legal (the Communists' action rounds; report only)
import { readFileSync, existsSync } from "node:fs";

const POW = ["sui", "jin", "gui", "ma", "dian"], ZH = { sui: "綏", jin: "晉", gui: "桂", ma: "馬", dian: "滇" };
const pct = (k, n) => (n ? (100 * k) / n : NaN);
const f1 = (x) => (Number.isFinite(x) ? `${x.toFixed(1)}%` : "–");
export function readBatch(name, file) {
  const state = JSON.parse(readFileSync(file, "utf8"));
  const cell = state.cells.full, sum = cell.sum, more = cell.more || {}, d = more.d || {}, per = more.dPerGame || {};
  const n = sum.games, errors = (cell.errors || []).length;
  const tfile = `${file}.targets.txt`, tlines = existsSync(tfile) ? readFileSync(tfile, "utf8").split(/\r?\n/) : [];
  const tline = tlines.find((l) => l.startsWith("TARGETS")) || null;
  const targets = tline ? Number((tline.match(/通過 (\d+) \/ 10/) || [])[1]) : null;
  const fm = per.firstMie || {}, fs = per.firstSeal || {};
  const turn0 = (fm["0"] || 0) + (fs["0"] || 0);
  const withMie = n - (fm.none || 0);
  const mie4 = Object.entries(fm).filter(([k]) => k !== "none" && Number(k) >= 4).reduce((t, [, v]) => t + v, 0);
  const end = {};
  for (const p of POW) {
    const e = (d.end || {})[p] || {};
    end[p] = { mie: pct((e["mie:conquest"] || 0) + (e["mie:talks"] || 0) + (e["mie:?"] || 0), n), conquest: pct(e["mie:conquest"] || 0, n), talks: pct(e["mie:talks"] || 0, n), seal: pct(e.seal || 0, n), none: pct(e.none || 0, n),
      loyal: pct(e["att:loyal"] || 0, n), neutral: pct(e["att:neutral"] || 0, n), ccp: pct(e["att:ccp"] || 0, n) };
  }
  const lowest = Math.min(...POW.flatMap((p) => [end[p].mie, end[p].seal]));
  const T = d.talksLegal || {};
  const ccp = pct(sum.wins[0], n);
  return {
    name, file, n, errors, ccp, targets, tline, end, lowest, reasons: sum.reasons, endTurns: sum.endTurns,
    g1: pct(turn0, n), g3: pct(mie4, withMie), g3all: pct(mie4, n), firstMie: fm, firstSeal: fs, withMie,
    g5: pct(T.chosen || 0, T.rounds || 0), talksRounds: T.rounds || 0, talksChosen: T.chosen || 0,
    perGame: { integrate: (d.integrate || 0) / n, talks: (d.talks || 0) / n, settle: ((d.attitude || {}).isolated || 0) / n, grayHit: (d.grayHit || 0) / n },
    mieCount: per.mie || {}, sealCount: per.seal || {}, trio: d.trio || {}, fiveSeals: d.fiveSeals || 0,
    pass: {
      g1: pct(turn0, n) < 5, g2: lowest >= 5, g3: pct(mie4, withMie) > 50,
      g4: targets != null && targets >= 8 && ccp >= 35 && ccp <= 65,
    },
  };
}
const yn = (b) => (b ? "過" : "不過");
export function block(b) {
  const L = [];
  L.push(`## ${b.name}  (${b.file})`);
  L.push(`局數 ${b.n},出錯 ${b.errors};共軍勝 ${f1(b.ccp)};${b.tline || "TARGETS (沒有 targets 檔)"}`);
  L.push(`結束方式 ${Object.entries(b.reasons).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${f1(pct(v, b.n))}`).join("、")}`);
  L.push(`G1 第 0 回合就有標記的局 ${f1(b.g1)}(< 5%:${yn(b.pass.g1)})`);
  L.push(`G2 每家易幟 / 整編完成(局末,占全部局):最低的一格 ${f1(b.lowest)}(≥ 5%:${yn(b.pass.g2)})`);
  for (const p of POW) { const e = b.end[p]; L.push(`   ${ZH[p]} 易幟 ${f1(e.mie)}(打 ${f1(e.conquest)} / 談 ${f1(e.talks)})、整編完成 ${f1(e.seal)}、都沒有 ${f1(e.none)};局末 效忠 ${f1(e.loyal)} 觀望 ${f1(e.neutral)} 通共 ${f1(e.ccp)}`); }
  L.push(`G3 第一個易幟在第 4 回合以後:有易幟的 ${b.withMie} 局裡 ${f1(b.g3)}(全部局的 ${f1(b.g3all)})(> 50%:${yn(b.pass.g3)})`);
  L.push(`   第一個易幟的回合 ${dist(b.firstMie)};第一個整編完成 ${dist(b.firstSeal)}`);
  L.push(`G4 十項 ${b.targets ?? "?"} / 10、共軍 ${f1(b.ccp)}(≥ 8 且 35–65%:${yn(b.pass.g4)})`);
  L.push(`G5 統戰合法時選了 ${f1(b.g5)}(${b.talksChosen} / ${b.talksRounds} 個行動回合)`);
  L.push(`   每局:整編 ${b.perGame.integrate.toFixed(2)}、統戰 ${b.perGame.talks.toFixed(2)}、結算的態度下降 ${b.perGame.settle.toFixed(2)}、打到灰 ${b.perGame.grayHit.toFixed(2)};易幟個數 ${dist(b.mieCount)};整編完成個數 ${dist(b.sealCount)};五個整編完成 ${b.fiveSeals}`);
  L.push(`   易幟勝的三家 ${Object.entries(b.trio).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join("、") || "–"}`);
  return L.join("\n");
}
export function dist(o) {
  return Object.entries(o || {}).sort((a, b) => (isNaN(a[0]) || isNaN(b[0]) ? String(a[0]).localeCompare(String(b[0])) : a[0] - b[0])).map(([k, v]) => `${k}:${v}`).join(" ");
}
export function row(b) {
  return `${b.name.padEnd(30)} 共軍 ${f1(b.ccp).padStart(6)}  十項 ${String(b.targets ?? "?").padStart(2)}  G1 ${f1(b.g1).padStart(6)}  G2 最低 ${f1(b.lowest).padStart(6)}  G3 ${f1(b.g3).padStart(6)}  G5 ${f1(b.g5).padStart(6)}  `
    + `[${["g1", "g2", "g3", "g4"].map((k) => (b.pass[k] ? k.toUpperCase() : "--")).join(" ")}]`;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/").replace(/^\//, "")}` || process.argv[1].endsWith("goals.mjs")) {
  const bs = process.argv.slice(2).map((a) => { const i = a.indexOf("="); return readBatch(a.slice(0, i), a.slice(i + 1)); });
  for (const b of bs) { console.log(block(b)); console.log(); }
  for (const b of bs) console.log(row(b));
}
