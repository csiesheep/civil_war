// Writes art/cards/redo.html: the local page the owner clicks through to choose, per X card, candidate 1-4 or X (none of them).
// Data is embedded (file:// cannot fetch); pictures are relative paths redo/<key>__c<N>.jpg.   node art/cards/redo.mjs
import fs from 'node:fs'; import path from 'node:path';
import { loadRedo, tags, modelName, why, dir } from './redodata.mjs';
const defText = (d) => Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`);
const data = loadRedo().map((c) => ({ key: c.key, num: c.num, zh: c.zh, scene: c.scene_zh, why: c.rewritten ? why[c.key] : '', cand: c.cand.map((k) => ({ c: k.c, model: modelName(k.model), seed: k.seed, file: k.file, bad: defText(k.defects) })) }));
const esc = (s, ch) => s.split(ch).join('\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));   // keep the JSON safe inside <script>
const json = [String.fromCharCode(60), String.fromCharCode(0x2028), String.fromCharCode(0x2029)].reduce(esc, JSON.stringify(data));
const html = `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>挑重出的圖:候選 1 到 4</title>
<style>
:root{color-scheme:light dark;--bg:#fafaf7;--fg:#1d1d1b;--mut:#6b6b66;--card:#fff;--line:#d8d6cf;--red:#c00000;--sel:#1a7f37;--selbg:#e6f4ea;--blue:#1565c0}
@media (prefers-color-scheme:dark){:root{--bg:#161614;--fg:#ececE6;--mut:#9a9a92;--card:#1f1f1c;--line:#3a3a35;--red:#ff6b6b;--sel:#4cc26b;--selbg:#12301b;--blue:#6ab0ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 "Microsoft JhengHei","PingFang TC",system-ui,sans-serif}
#bar{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:2px solid var(--line);padding:8px 14px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
#bar b{font-size:18px}#left{color:var(--mut);font-size:14px;max-width:100%;overflow-wrap:anywhere}
#out{flex:1 1 360px;min-width:200px;font:15px ui-monospace,Consolas,monospace;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);resize:none;height:2.6em}
button{font:inherit;padding:6px 14px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--fg);cursor:pointer}
button.danger.arm{background:var(--red);color:#fff;border-color:var(--red)}
#note{padding:6px 14px;color:var(--mut);font-size:14px}
.card{margin:18px auto;max-width:1600px;padding:12px 14px;background:var(--card);border:1px solid var(--line);border-radius:10px}
.card h2{margin:0;font-size:22px}
.scene{margin:2px 0 4px;color:var(--mut);font-size:15px}
.why{margin:0 0 8px;color:var(--blue);font-size:15px}
.cands{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
@media (max-width:1000px){.cands{grid-template-columns:1fr 1fr}}
@media (max-width:520px){.cands{grid-template-columns:1fr}}
.opt{border:4px solid transparent;border-radius:8px;padding:4px;cursor:pointer}
.opt.on{border-color:var(--sel);background:var(--selbg)}
.opt .tag{font-weight:700;font-size:26px;line-height:1.2;margin-bottom:4px}.opt .tag span{font-weight:400;color:var(--mut);font-size:14px;margin-left:8px}
.opt img{display:block;width:100%;min-width:0;height:auto;aspect-ratio:3/4;background:#8883;border-radius:4px}
.bad{color:var(--red);font-size:14px;min-height:1.4em;margin-top:4px}
.opt a{font-size:13px;color:var(--mut)}
.btns{display:flex;gap:8px;margin-top:10px;align-items:center}.btns button.on{background:var(--sel);color:#fff;border-color:var(--sel)}
.btns .x{margin-left:auto}
</style></head><body>
<div id="bar">
  <b id="count">已選 0 / 15</b>
  <span id="left"></span>
  <textarea id="out" readonly rows="2" aria-label="結果文字"></textarea>
  <button id="copy">複製</button>
  <button id="clear" class="danger">全部清除</button>
</div>
<div id="note">每張牌 4 張候選,由左到右是 1、2、3、4。點圖就是選那一張;X = 四張都不要。結果文字:11-2 = 第 11 張用候選 2;11-X = 四張都不要。選擇存在這個瀏覽器的 localStorage,重新整理還在。「全部清除」要按兩次。</div>
<div id="cards"></div>
<script>
const DATA = ${json};
const KEY = 'civil_war_21_redo_pick';
let pick = {};
try { pick = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { pick = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(pick)); } catch (e) {} };
const $ = (id) => document.getElementById(id);
const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
const root = $('cards');
function opt(c, k) {
  const d = el('div', 'opt'); d.dataset.pick = String(k.c);
  const t = el('div', 'tag', String(k.c)); t.appendChild(el('span', '', k.model + ' · seed ' + k.seed)); d.appendChild(t);
  const img = el('img'); img.loading = 'lazy'; img.src = k.file; img.alt = c.num + ' ' + c.zh + ' 候選 ' + k.c; d.appendChild(img);
  d.appendChild(el('div', 'bad', k.bad.join(';')));
  const l = el('a', '', '原尺寸'); l.href = img.src; l.target = '_blank'; l.rel = 'noopener'; l.addEventListener('click', (e) => e.stopPropagation()); d.appendChild(l);
  d.addEventListener('click', () => set(c.num, String(k.c)));
  return d;
}
for (const c of DATA) {
  const s = el('section', 'card'); s.dataset.num = c.num; s.id = 'c' + c.num;
  const h = el('h2', '', c.num + ' ' + c.zh); s.appendChild(h);
  s.appendChild(el('div', 'scene', c.scene));
  if (c.why) s.appendChild(el('div', 'why', '這張改了畫面:為了' + c.why + '。'));
  const p = el('div', 'cands'); for (const k of c.cand) p.appendChild(opt(c, k)); s.appendChild(p);
  const b = el('div', 'btns');
  for (const w of ['1', '2', '3', '4', 'X']) { const k = el('button', w === 'X' ? 'x' : '', w === 'X' ? 'X 四張都不要' : w); k.dataset.pick = w; k.addEventListener('click', () => set(c.num, w)); b.appendChild(k); }
  s.appendChild(b); root.appendChild(s);
}
function set(num, w) { pick[num] = w; save(); render(); }
function render() {
  let n = 0; const left = [], parts = [];
  for (const c of DATA) {
    const w = pick[c.num], sec = $('c' + c.num);
    if (['1', '2', '3', '4', 'X'].includes(w)) { n++; parts.push(c.num + '-' + w); } else left.push(c.num);
    for (const e of sec.querySelectorAll('[data-pick]')) e.classList.toggle('on', e.dataset.pick === w);
  }
  $('count').textContent = '已選 ' + n + ' / ' + DATA.length;
  $('left').textContent = left.length ? '還沒選:' + left.join(' ') : '全部選完了';
  $('out').value = parts.join(' ');
}
$('copy').addEventListener('click', async () => {
  const t = $('out').value;
  try { await navigator.clipboard.writeText(t); } catch (e) { $('out').select(); document.execCommand('copy'); }
  $('copy').textContent = '已複製'; setTimeout(() => { $('copy').textContent = '複製'; }, 1500);
});
let armed = 0;
$('clear').addEventListener('click', () => {
  const b = $('clear');
  if (!armed) { armed = setTimeout(() => { armed = 0; b.classList.remove('arm'); b.textContent = '全部清除'; }, 4000); b.classList.add('arm'); b.textContent = '再按一次確認清除'; return; }
  clearTimeout(armed); armed = 0; b.classList.remove('arm'); b.textContent = '全部清除';
  pick = {}; try { localStorage.removeItem(KEY); } catch (e) {} render();
});
render();
</script></body></html>
`;
fs.writeFileSync(path.join(dir, 'redo.html'), html);
console.log('redo.html', data.length, 'cards', html.length, 'bytes');
