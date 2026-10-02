// Shared by redo.mjs and redo-sheets.mjs (#21): the 15 X cards in card-number order, each with its 4 candidates and their hard defects read from CHECK-redo.md.
// A defect cell that is not the plain "無" / "對" / "是" word is a defect (same convention as pickdata.mjs).
import fs from 'node:fs'; import path from 'node:path';
import { load, dir } from './pickdata.mjs';
import { X, REWRITE } from './redo-prompts.mjs';
export { dir };

function rows() {
  const out = new Map(); let head = null;
  for (const line of fs.readFileSync(path.join(dir, 'CHECK-redo.md'), 'utf8').split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((s) => s.trim());
    if (cells[0] === '牌' && cells.includes('候選')) { head = cells; continue; }
    const m = head && cells.length === head.length && /\(([a-z_0-9]+)\)\s*$/.exec(cells[0]);
    if (!m) continue;
    const col = (n) => cells[head.findIndex((h) => h.startsWith(n))];
    const d = {}; const put = (tag, v, okWord) => { d[tag] = v === okWord ? null : v.replace(/^有[:：]?/, '').replace(/^錯[:：]?/, '') || '有'; };
    put('框', col('框'), '無'); put('字', col('字'), '無'); put('旗', col('旗與機徽'), '對'); put('畸形', col('畸形'), '無'); put('認不出', col('認得出'), '是');
    out.set(m[1] + '__c' + col('候選'), d);
  }
  return out;
}

export function loadRedo() {
  const cards = load(), rec = JSON.parse(fs.readFileSync(path.join(dir, 'redo.json'), 'utf8')), chk = rows();
  const orig = new Map(JSON.parse(fs.readFileSync(path.join(dir, 'prompts.json'), 'utf8')).map((e) => [e.key, e.prompt]));
  return X.map((n) => {
    const c = cards.find((k) => k.num === String(n));
    const cand = [1, 2, 3, 4].map((k) => {
      const r = rec.find((e) => e.key === c.key && e.c === k), d = chk.get(c.key + '__c' + k);
      if (!r || !d) throw new Error('missing record or checklist row ' + c.key + ' c' + k);
      return { c: k, model: r.model, seed: r.seed, file: 'redo/' + c.key + '__c' + k + '.jpg', defects: d };
    });
    return { key: c.key, num: c.num, zh: c.zh, scene_zh: c.scene_zh, rewritten: !!REWRITE[c.key], cand };
  });
}
export const modelName = (m) => (m === 'zimage' ? 'Z-Image' : 'Qwen');
export const tags = (d) => Object.entries(d).filter(([, v]) => v).map(([k, v]) => k + (/^待確認/.test(v) ? '?' : ''));
export const why = {
  sino_soviet_treaty: '條約紙上有成行的像字的筆跡',
  marshall_mission: '原來圖上只有兩個人,三人小組缺一個',
  league_banned: '門邊有帶字的門牌,換三次種子都有',
  new_consultative_conference: '紅旗上有黃星,換三次種子都有',
  stalins_advice: '原來三個人都是中國人,認不出蘇聯來的米高揚',
};
