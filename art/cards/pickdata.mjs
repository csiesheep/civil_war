// Shared by pairs.mjs and pick.mjs (#20): one record per card, in card-number order (1..72, then 美援, 蘇援).
// Hard defects are read out of the two checklists (CHECK.md for Qwen, CHECK-zimage.md for Z-Image): a cell that is not the plain "ok" word is a defect.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import * as E from '../../public/shared/engine.js';
export const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

// Parses the 74-row table of a checklist: { key -> { 框: text|null, 字: ..., 旗: ..., 畸形: ..., 認不出: ... } }
function defects(file) {
  const out = new Map(); let head = null;
  for (const line of read(file).split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((s) => s.trim());
    if (cells[0] === '牌' && cells.includes('框')) { head = cells; continue; }
    const m = head && cells.length === head.length && /\(([a-z_0-9]+)\)\s*$/.exec(cells[0]);
    if (!m) continue;
    const col = (n) => cells[head.findIndex((h) => h.startsWith(n))];
    const d = {}; const put = (tag, v, okWord) => { d[tag] = v === okWord ? null : v.replace(/^有[:：]?/, '').replace(/^錯[:：]?/, '') || '有'; };
    put('框', col('框'), '無'); put('字', col('字'), '無'); put('旗', col('旗與機徽'), '對'); put('畸形', col('畸形'), '無'); put('認不出', col('認得出'), '是');
    out.set(m[1], d);
  }
  return out;
}

export function load() {
  const prompts = JSON.parse(read('prompts.json')), zrec = JSON.parse(read('zimage.json'));
  const num = new Map(E.CARDS.map((c) => [c.id, c.num])); num.set('american_aid', '美援'); num.set('soviet_aid', '蘇援');
  const q = defects('CHECK.md'), z = defects('CHECK-zimage.md');
  const rank = (e) => (typeof num.get(e.key) === 'number' ? num.get(e.key) : 1000 + (e.key === 'soviet_aid' ? 1 : 0));
  const list = prompts.map((e) => ({
    key: e.key, num: String(num.get(e.key)), zh: e.zh, scene_zh: e.scene_zh, seed: e.seed, zseed: zrec.find((r) => r.key === e.key).seed,
    qwen: q.get(e.key), zimage: z.get(e.key),
  })).sort((a, b) => rank(a) - rank(b));
  for (const c of list) if (!c.qwen || !c.zimage) throw new Error('no checklist row for ' + c.key);
  if (new Set(list.map((c) => c.num)).size !== list.length) throw new Error('duplicate card labels');
  return list;
}
// "字 旗" etc. for the contact sheets; "旗?" when the checklist only says 待確認.
export const tags = (d) => Object.entries(d).filter(([, v]) => v).map(([k, v]) => k + (/^待確認/.test(v) ? '?' : ''));
