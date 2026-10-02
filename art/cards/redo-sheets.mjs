// Writes art/cards/redo/sheet-01.jpg .. sheet-03.jpg: 5 cards per sheet, one row per card, candidates 1-4 left to right, hard defects (CHECK-redo.md) in red under each.
//   node art/cards/redo-sheets.mjs
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { loadRedo, tags, modelName, dir } from './redodata.mjs';
const cards = loadRedo(), out = path.join(dir, 'redo');
for (const f of fs.readdirSync(out)) if (/^sheet-\d+\.jpg$/.test(f)) fs.rmSync(path.join(out, f));
for (let i = 0, n = 1; i < cards.length; i += 5, n++) {
  const jobs = cards.slice(i, i + 5).map((c) => ({ num: c.num, zh: c.zh, rewritten: c.rewritten, cand: c.cand.map((k) => ({ c: k.c, modelname: modelName(k.model), file: path.join(dir, k.file), bad: tags(k.defects) })) }));
  const jf = path.join(os.tmpdir(), 'cw21-sheets.json'); fs.writeFileSync(jf, JSON.stringify(jobs));
  execFileSync('python', [path.join(dir, 'redo-sheets.py'), jf, path.join(out, `sheet-${String(n).padStart(2, '0')}.jpg`)], { stdio: 'inherit' }); fs.rmSync(jf);
}
