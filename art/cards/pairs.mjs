// Writes art/cards/pick/pair-NN.jpg: 12 cards per sheet, left A = Qwen (img/), right B = Z-Image (img-zimage/), number and name under each pair,
// each picture's hard defects (from CHECK.md / CHECK-zimage.md) in red under it.   node art/cards/pairs.mjs
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { load, tags, dir } from './pickdata.mjs';
const cards = load(), out = path.join(dir, 'pick'); fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (/^pair-\d+\.jpg$/.test(f)) fs.rmSync(path.join(out, f));
for (let i = 0, n = 1; i < cards.length; i += 12, n++) {
  const jobs = cards.slice(i, i + 12).map((c) => ({ num: c.num, zh: c.zh, a: path.join(dir, 'img', c.key + '.jpg'), b: path.join(dir, 'img-zimage', c.key + '.jpg'), abad: tags(c.qwen), bbad: tags(c.zimage) }));
  const jf = path.join(os.tmpdir(), 'cw20-pairs.json'); fs.writeFileSync(jf, JSON.stringify(jobs));
  execFileSync('python', [path.join(dir, 'pairs.py'), jf, path.join(out, `pair-${String(n).padStart(2, '0')}.jpg`)], { stdio: 'inherit' }); fs.rmSync(jf);
}
