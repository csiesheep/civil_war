// #40: the numbers of tuning/40/report.txt, read from the six state files of tuning/40/runall.sh (C off / C on ×
// seeds 1, 20001, 40001) and their targets files. Prints plain text; nothing is drawn, nothing is played.
//   node tuning/40/report.mjs [runs dir = tuning/40/runs]
import { readFileSync, existsSync } from "node:fs";
const R = process.argv[2] || "tuning/40/runs";
const SEEDS = [1, 20001, 40001], ARMS = [["off", "C 關"], ["C", "C 開"]];
const load = (arm, s) => JSON.parse(readFileSync(`${R}/${arm}-s${s}.txt.state.json`, "utf8")).cells.full;
const total = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
const pct = (k, n) => (n ? `${((100 * k) / n).toFixed(1)}%` : "–");
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "–");
const add = (a, b) => { if (a == null) return b; if (b == null) return a; if (typeof a === "number") return a + b; const o = Array.isArray(a) ? a.slice() : { ...a }; for (const k of Object.keys(b)) o[k] = add(a[k], b[k]); return o; };
const runs = {};
for (const [arm] of ARMS) for (const s of SEEDS) runs[`${arm}-s${s}`] = load(arm, s);
const out = [];
const line = (x = "") => out.push(x);

line("一、十項目標 × 6(tests/targets.mjs 的 TARGETS 行與每一項的通過 / 失敗)");
for (const [arm, name] of ARMS) for (const s of SEEDS) {
  const f = `${R}/${arm}-s${s}.targets.txt`;
  if (!existsSync(f)) { line(`  ${name} s${s}: (沒有 targets 檔)`); continue; }
  const t = readFileSync(f, "utf8").split("\n");
  const marks = t.filter((l) => /^(通過|失敗) · /.test(l)).map((l) => (l.startsWith("通過") ? "○" : "×")).join("");
  line(`  ${name} s${String(s).padEnd(5)} ${marks}  ${t.find((l) => l.startsWith("TARGETS")) || ""}`);
}
line("  (○ 通過 × 失敗,依 targets.mjs 的順序:民心曲線、共軍勝率、結束方式、易幟佔比、開局孤城、每回合孤城上升、遷都、支持度軌、打到決戰期、國軍贏法)");
line();
line("二、勝負、結束方式、結束回合、每局秒數");
for (const s of SEEDS) for (const [arm, name] of ARMS) {
  const c = runs[`${arm}-s${s}`], g = c.sum.games;
  const reasons = Object.entries(c.sum.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join("、");
  const turns = Object.entries(c.sum.endTurns).map(([k, v]) => `${k}:${v}`).join(" ");
  line(`  s${String(s).padEnd(5)} ${name}:${g} 局、錯誤 ${c.errors.length};共軍勝 ${pct(c.sum.wins[0], g)}(${c.sum.wins[0]});每局 ${(c.ms / g / 1000).toFixed(1)} 秒(一個 chunk 的牆鐘 / 局數,28 個平行)`);
  line(`         方式 ${reasons};結束回合 ${turns}`);
}
line();
line("三、民心曲線(每回合結束時,還在進行的對局的民心平均;正 = 共軍)");
for (const s of SEEDS) for (const [arm, name] of ARMS) {
  const m = runs[`${arm}-s${s}`].sum.mandateByTurn;
  line(`  s${String(s).padEnd(5)} ${name}:${Object.keys(m).sort((a, b) => a - b).map((t) => `${t}:${(m[t].sum / m[t].n).toFixed(2)}`).join(" ")}`);
}
line("  每回合結束時誰領先(已結束的算贏家;共軍 / 國軍):");
for (const s of SEEDS) for (const [arm, name] of ARMS) {
  const a = runs[`${arm}-s${s}`].sum.aheadByTurn, g = runs[`${arm}-s${s}`].sum.games;
  line(`  s${String(s).padEnd(5)} ${name}:${Object.keys(a).map((t) => `${t}:${pct(a[t].ccp, g)}/${pct(a[t].kmt, g)}`).join(" ")}`);
}
line();
line("四、C 的數字(C 開,三個種子各一行,再加總)");
const cs = SEEDS.map((s) => runs[`C-s${s}`]);
const sumC = cs.reduce((a, c) => add(a, c.more.c), null), per = cs.reduce((a, c) => add(a, c.more.cPerGame), null), G = cs.reduce((a, c) => a + c.sum.games, 0);
const dist = (o) => Object.keys(o).sort((a, b) => (a === "none" ? 1 : b === "none" ? -1 : a - b)).map((k) => `${k}:${o[k]}`).join(" ");
for (let i = 0; i < 3; i++) {
  const c = cs[i].more.c, g = cs[i].sum.games;
  line(`  s${String(SEEDS[i]).padEnd(5)} 佈線 ${c.plant.plays} 次(真 ${c.plant.real}、假 ${c.plant.fake});肅諜 ${c.purge.plays} 次(翻真 ${c.purge.real}、翻假 ${c.purge.fake}、抓錯的肅諜 ${c.purge.caught});洩密 ${c.leak}、倒戈 ${c.defect}、和平易手 ${c.handover};答 no:洩密 ${c.no.leak}、倒戈 ${c.no.defect};回手 ${c.home};${g} 局`);
}
const c = sumC;
line(`  合計 ${G} 局:佈線 ${c.plant.plays} 次(真 ${c.plant.real}、假 ${c.plant.fake};每局 ${(c.plant.real / G).toFixed(2)} / ${(c.plant.fake / G).toFixed(2)})`);
line(`         肅諜 ${c.purge.plays} 次(翻真 ${c.purge.real}、翻假 ${c.purge.fake};抓錯的肅諜 ${c.purge.caught})`);
line(`         洩密 ${c.leak}、倒戈 ${c.defect}、和平易手 ${c.handover};標記被共軍拿下的城送回手上 ${c.home} 個;拿到的標記 ${JSON.stringify(c.gains)}`);
line(`  每局的分佈(個數:局數):`);
for (const k of ["plantReal", "plantFake", "purgePlays", "purgeReal", "purgeFake", "leak", "defect", "handover", "used"]) line(`    ${k.padEnd(11)} ${dist(per[k])}`);
line(`    建軍軌第 4 格的標記在第幾回合到(none = 沒到):${dist(per.reform4)}`);
const L = c.legal;
line(`  可以做的行動回合 / 做了:佈線 ${L.plantRounds} / ${L.plantChosen}(${pct(L.plantChosen, L.plantRounds)});肅諜 ${L.purgeRounds} / ${L.purgeChosen}(${pct(L.purgeChosen, L.purgeRounds)});和平易手 ${L.handoverRounds} / ${L.handoverChosen}`);
for (const tag of ["leak", "defect"]) {
  const a = c.asked[tag];
  line(`  ${tag === "leak" ? "洩密" : "倒戈"}被問 ${a.real + a.none} 次:問的地方有真標記 ${a.real} 次,其中答 no ${a.realNo}(${pct(a.realNo, a.real)};bot 的 q = 這個比率的估計);只有假的 ${a.none} 次`);
}
line(`  局末標記在哪(${G} 局加總):城上 真 ${c.end.boardReal} 假 ${c.end.boardFake};共軍手上 真 ${c.end.handReal} 假 ${c.end.handFake};出局(翻開的真) ${c.end.out};還沒拿到 真 ${c.end.poolReal} 假 ${c.end.poolFake}`);
const top = (o) => Object.entries(o).map(([id, x]) => [id, (x.real || 0) + (x.fake || 0), x]).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, , x]) => `${id} ${x.real || 0}/${x.fake || 0}`).join("、");
line(`  佈線在哪些城(真 / 假,前 10):${top(c.plantAt)}`);
line(`  肅諜翻到哪些城(真 / 假):${top(c.purgeAt)}`);
const CLS = { capital: "首都", cut: "割點", attack: "打得到", other: "其他" };
line("  佈線按類別(B.moleClass,佈下去那一刻;真 / 假、真的比例;orchestrator 裁決 #40 第三輪:佈 ≥ 20 個的類別要在 10%–90%):");
for (const k of Object.keys(CLS)) {
  const x = (c.plantClass || {})[k] || {}, r = x.real || 0, f = x.fake || 0, n = r + f;
  line(`    ${CLS[k]}:真 ${r}、假 ${f}、真的比例 ${pct(r, n)}${n >= 20 ? (r / n >= 0.1 && r / n <= 0.9 ? "(≥ 20 個,在 10%–90% 之間)" : "(≥ 20 個,**不在 10%–90% 之間**)") : "(不到 20 個)"}`);
}
const bt = {};
for (const [t, x] of Object.entries(c.byTurn)) if (Number(t) > 0) bt[t] = x;
line(`  按回合:${Object.keys(bt).sort((a, b) => a - b).map((t) => `${t}:佈${bt[t].plant || 0}/肅${bt[t].purge || 0}/洩${bt[t].leak || 0}/倒${bt[t].defect || 0}/易${bt[t].handover || 0}`).join(" ")}`);
line();
line("五、信念的校準");
const cal = (name, k) => {
  if (!k || !k.n) { line(`  ${name}:n = 0`); return; }
  line(`  ${name}:n ${k.n},真的 ${k.real}(${pct(k.real, k.n)}),平均信念 ${f2(k.p / k.n)};Brier ${(k.brier / k.n).toFixed(4)},只用先驗 ${(k.brierPrior / k.n).toFixed(4)}`);
  const bins = (b) => Object.keys(b).sort((x, y) => x - y).map((i) => `${(i / 10).toFixed(1)}–${((Number(i) + 1) / 10).toFixed(1)}:${b[i].n} 個,說 ${f2(b[i].p / b[i].n)} 真 ${pct(b[i].real, b[i].n)}`).join(";");
  line(`    信念分組:${bins(k.bins)}`);
  line(`    先驗分組:${bins(k.binsPrior)}`);
};
cal("肅諜翻開的每一個標記(那一刻國軍對那座城的信念)", c.calib);
cal("每回合結束時城上的每一個標記:首都", c.board.capital);
cal("每回合結束時城上的每一個標記:其他城", c.board.other);
console.log(out.join("\n"));
