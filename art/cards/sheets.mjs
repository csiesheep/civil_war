// Writes sheet-nationalist.jpg / sheet-communist.jpg / sheet-neutral.jpg: contact sheets of img/*.jpg, the card number and name under each picture (outside it).
//   STILL_BAD=key,key node art/cards/sheets.mjs     (cards named in STILL_BAD get a red 還有硬傷 under the label)
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import * as E from '../../public/shared/engine.js';
const dir = path.dirname(fileURLToPath(import.meta.url));
const cards = JSON.parse(fs.readFileSync(path.join(dir, 'prompts.json'), 'utf8'));
const meta = new Map(E.CARDS.map((c) => [c.id, c.num])); meta.set('american_aid', '美援'); meta.set('soviet_aid', '蘇援');
const bad = (process.env.STILL_BAD || '').split(',').filter(Boolean);
const groups = { nationalist: (e) => e.side === 'K', communist: (e) => e.side === 'C', neutral: (e) => e.side === 'N' };
const rank = (e) => (typeof meta.get(e.key) === 'number' ? meta.get(e.key) : 1000);
for (const [g, f] of Object.entries(groups)) {
  const list = cards.filter(f).sort((a, b) => rank(a) - rank(b)).map((e) => ({ file: path.join(dir, 'img', e.key + '.jpg'), num: String(meta.get(e.key)), zh: e.zh, bad: bad.includes(e.key) }));
  const jf = path.join(os.tmpdir(), `cw19-sheet-${g}.json`); fs.writeFileSync(jf, JSON.stringify(list));
  execFileSync('python', [path.join(dir, 'sheets.py'), jf, path.join(dir, `sheet-${g}.jpg`)], { stdio: 'inherit' });
  fs.rmSync(jf);
}
