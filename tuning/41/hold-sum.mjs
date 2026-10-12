// #41: adds up tuning/41/probe-hold.mjs's files (tuning/41/runs/probe/<name>-<k>.txt).   node tuning/41/hold-sum.mjs <name>
import { existsSync, readFileSync } from "node:fs";
export function holdSum(name) {
  const rows = [];
  let games = 0;
  for (let k = 0; existsSync(`tuning/41/runs/probe/${name}-${k}.txt`); k++) {
    const m = readFileSync(`tuning/41/runs/probe/${name}-${k}.txt`, "utf8").match(/HOLD (.*)/);
    if (!m) continue;
    const o = JSON.parse(m[1]);
    games += o.games; rows.push(...o.rows);
  }
  const L = [];
  const pct = (k, n) => (n ? `${((100 * k) / n).toFixed(1)}%` : "–");
  for (const tag of ["leak", "defect"]) {
    const r = rows.filter((x) => x.tag === tag), pos = r.filter((x) => x.gain > 0.01), over = r.filter((x) => x.gain > x.price + 0.01);
    const used = r.filter((x) => x.used), usedPos = pos.filter((x) => x.used);
    const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
    L.push(`${name} ${tag === "leak" ? "洩密" : "倒戈"}:${games} 局、有真標記的詢問 ${r.length};用掉比答 no 好(不算標記本身的價格)${pos.length}(${pct(pos.length, r.length)}),其中 bot 用了 ${usedPos.length}(${pct(usedPos.length, pos.length)});好處大過 bot 對那個標記開的價 ${over.length};bot 用了 ${used.length}(${pct(used.length, r.length)})`);
    if (pos.length) L.push(`   有好處的那些:好處的中位數 ${med(pos.map((x) => x.gain)).toFixed(2)}、bot 開的價的中位數 ${med(pos.map((x) => x.price)).toFixed(2)}(價 = 評估裡 mechC 的差:bot 對翻掉那個真標記開的價)`);
  }
  return L.join("\n");
}
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tuning/41/hold-sum.mjs")) console.log(holdSum(process.argv[2]));
