// Writes final-sheets/sheet-nationalist.jpg, sheet-communist.jpg, sheet-neutral.jpg: final contact sheets from final.json and final/*.jpg (6-column grid layout like #19)
//   node art/cards/final-sheets.mjs
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import * as E from '../../public/shared/engine.js';
const dir = path.dirname(fileURLToPath(import.meta.url));
const final = JSON.parse(fs.readFileSync(path.join(dir, 'final.json'), 'utf8'));
const meta = new Map(E.CARDS.map((c) => [c.id, c.num])); meta.set('american_aid', '美援'); meta.set('soviet_aid', '蘇援');
const zhMap = new Map(E.CARDS.map((c) => [c.id, c.zh])); meta.forEach((v, k) => { if (k === 'american_aid') zhMap.set(k, '美援'); if (k === 'soviet_aid') zhMap.set(k, '蘇援'); });
const sideMap = new Map(E.CARDS.map((c) => [c.id, c.side === 1 ? 'K' : c.side === 0 ? 'C' : 'N'])); meta.forEach((v, k) => { if (k === 'american_aid') sideMap.set(k, 'K'); if (k === 'soviet_aid') sideMap.set(k, 'C'); });
const groups = { nationalist: 'K', communist: 'C', neutral: 'N' };
const rank = (e) => (typeof meta.get(e.key) === 'number' ? meta.get(e.key) : 1000);
for (const [g, side] of Object.entries(groups)) {
  const list = final.filter((e) => sideMap.get(e.key) === side).sort((a, b) => rank(a) - rank(b)).map((e) => ({ file: path.join(dir, 'final', e.key + '.jpg'), num: String(meta.get(e.key)), zh: zhMap.get(e.key), bad: false }));
  const jf = path.join(os.tmpdir(), `cw22-sheet-${g}.json`); fs.writeFileSync(jf, JSON.stringify(list));
  execFileSync('python', [path.join(dir, 'final-sheets.py'), jf, path.join(dir, 'final-sheets', `sheet-${g}.jpg`)], { stdio: 'inherit' });
  fs.rmSync(jf);
}
console.log("ok", final.length, "cards");
