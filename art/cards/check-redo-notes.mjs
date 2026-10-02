// Converts my review notes (pipe-separated lines: key|c|defects|note) into art/cards/check-redo-notes.json for check-redo-build.mjs.
//   node art/cards/check-redo-notes.mjs <notes.txt>
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const out = {};
for (const line of fs.readFileSync(process.argv[2], 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const [key, c, defects, ...rest] = line.split('|'), n = { 備註: rest.join('|') };
  for (const d of (defects || '').split(/;(?=(?:框|字|旗|畸形|認)=)/).filter(Boolean)) {
    const m = /^(框|字|旗|畸形|認)=(.*)$/.exec(d); if (!m) throw new Error('bad defect ' + line);
    n[m[1]] = (m[1] === '認' ? '否:' : m[1] === '旗' ? '錯:' : '有:') + m[2].replace(/^待確認:/, '待確認:');
  }
  out[key + '__c' + c] = n;
}
out._fixed = JSON.parse(fs.readFileSync(path.join(dir, 'check-redo-fixed.json'), 'utf8'));
fs.writeFileSync(path.join(dir, 'check-redo-notes.json'), JSON.stringify(out, null, 2) + '\n'); console.log(Object.keys(out).length - 1, 'candidates');
