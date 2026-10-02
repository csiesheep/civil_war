// Writes art/cards/final-sheets/sheet-nationalist.jpg, sheet-communist.jpg, sheet-neutral.jpg: final contact sheets from final.json and final/*.jpg
//   node art/cards/final-sheets.mjs
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import * as E from "../../public/shared/engine.js";
const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const AID = { american_aid: ["K", "美援", 0], soviet_aid: ["C", "蘇援", 0] };
const meta = new Map();
for (const c of E.CARDS) meta.set(c.id, { zh: c.zh, num: c.num, year: c.year, side: c.side === 1 ? "K" : c.side === 0 ? "C" : "N" });
for (const a of E.AID) meta.set(a.id, { zh: a.zh, num: "—", year: null, side: AID[a.id][0] });

const final = JSON.parse(fs.readFileSync(path.join(dir, 'final.json'), 'utf8'));
const outDir = path.join(dir, 'final-sheets');

// Group cards by side (K=nationalist, C=communist, N=neutral/aid)
const byGroup = { K: [], C: [], N: [] };
for (const entry of final) {
  const m = meta.get(entry.key);
  if (!m) throw new Error("no metadata for " + entry.key);
  byGroup[m.side].push({
    key: entry.key,
    num: m.num,
    zh: m.zh,
    file: path.join(dir, 'final', entry.key + '.jpg'),
    model: entry.model === 'zimage' ? 'Z-Image' : 'Qwen'
  });
}

// Generate sheets for each group
const nameMap = { K: 'sheet-nationalist.jpg', C: 'sheet-communist.jpg', N: 'sheet-neutral.jpg' };
for (const [side, cards] of Object.entries(byGroup)) {
  if (cards.length === 0) continue;
  const outFile = path.join(outDir, nameMap[side]);
  const jobs = [];
  for (let i = 0; i < cards.length; i += 5) {
    jobs.push(cards.slice(i, i + 5).map((c) => ({
      num: c.num,
      zh: c.zh,
      modelname: c.model,
      file: c.file
    })));
  }

  const jf = path.join(os.tmpdir(), 'cw22-sheets.json');
  fs.writeFileSync(jf, JSON.stringify(jobs));
  execFileSync('python', [path.join(dir, 'final-sheets.py'), jf, outFile], { stdio: 'inherit' });
  fs.rmSync(jf);
}

console.log("ok", final.length, "cards");
