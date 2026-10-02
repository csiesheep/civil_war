// Writes art/cards/CHECK-redo.md from the review notes (art/cards/check-redo-notes.json: per candidate the hard defects I saw at 3x crops) and redo.json.
//   node art/cards/check-redo-build.mjs
// Notes shape: { "<key>__c<N>": { "框": "無"|"有:...", "字": ..., "旗": "對"|"錯:...", "畸形": ..., "認": "是"|"否:...", "備註": "..." } }, plus "_fixed": { "<key>": "毛病還在不在" }.
import fs from 'node:fs'; import path from 'node:path';
import { load, dir } from './pickdata.mjs';
import { X, REWRITE } from './redo-prompts.mjs';
const rec = JSON.parse(fs.readFileSync(path.join(dir, 'redo.json'), 'utf8')), notes = JSON.parse(fs.readFileSync(path.join(dir, 'check-redo-notes.json'), 'utf8'));
const P = new Map(JSON.parse(fs.readFileSync(path.join(dir, 'prompts.json'), 'utf8')).map((e) => [e.key, e]));
const cards = load(), sceneOf = (p) => p.slice(p.indexOf(' Scene: ') + 8, p.indexOf(' No text, no characters, no seals, no writing. Full-bleed')).trim();
const why = { sino_soviet_treaty: '條約紙上有成行的像字的筆跡(#20 看到的毛病);要看不到任何紙面上的字跡', marshall_mission: 'prompt 寫三人小組,圖上只有兩個人;要三個人都在、認得出是三方', league_banned: '門邊有帶字的門牌,#19 換三次種子都有;要畫面裡沒有門牌、匾額、招牌、燈籠上的字', new_consultative_conference: '紅旗上有黃星,#19 換三次種子都有;要沒有任何帶星的旗', stalins_advice: 'prompt 是米高揚來見中共領導人,圖上三個人都是中國人;要認得出其中一位是蘇聯來的歐洲人' };
const rows = [], clean = new Map(); let nClean = 0;
const cell = (v, ok) => (v == null ? ok : v);
for (const n of X) {
  const c = cards.find((k) => k.num === String(n));
  for (let k = 1; k <= 4; k++) {
    const r = rec.find((e) => e.key === c.key && e.c === k), t = notes[c.key + '__c' + k]; if (!t) throw new Error('no note for ' + c.key + ' c' + k);
    const v = { 框: cell(t.框, '無'), 字: cell(t.字, '無'), 旗: cell(t.旗, '對'), 畸形: cell(t.畸形, '無'), 認: cell(t.認, '是') };
    const ok = v.框 === '無' && v.字 === '無' && v.旗 === '對' && v.畸形 === '無' && v.認 === '是';
    if (ok) { nClean++; clean.set(c.key, (clean.get(c.key) || 0) + 1); }
    rows.push(`| ${c.num} ${c.zh} (${c.key}) | ${k} | ${r.model === 'qwen' ? 'Qwen' : 'Z-Image'} | ${r.seed} | ${v.框} | ${v.字} | ${v.旗} | ${v.畸形} | ${v.認} | ${t.備註 || ''} |`);
  }
}
const allBad = X.map((n) => cards.find((k) => k.num === String(n))).filter((c) => !clean.get(c.key));
const dist = [0, 1, 2, 3, 4].map((m) => `${m} 張乾淨:${X.filter((n) => (clean.get(cards.find((k) => k.num === String(n)).key) || 0) === m).map((n) => n).join('、') || '無'}`);
const sec = Object.keys(REWRITE).map((key) => { const c = cards.find((k) => k.key === key); return `### ${c.num} ${c.zh}\n\n- 為什麼這樣改:${why[key]}\n- 原來的 Scene:${sceneOf(P.get(key).prompt)}\n- 改過的 Scene:${REWRITE[key]}\n- 4 張候選裡那個毛病還在不在:${notes._fixed[key]}\n`; });
const md = `# 60 張重出候選的檢查清單(#21)

15 張 X 的牌各 4 張候選(\`redo/<card id>__c<1-4>.jpg\`,768 × 1024,JPEG 品質 88,不後製)。種子 = 21000 + 牌的編號 × 10 + 候選編號;候選 1 到 4 是 Qwen Image 2.1(25 步),\`real_tech\` 的 X 牌(24、67、72)的候選 4 是 Z-Image Turbo(20 步)。prompt、模型、種子、步數在 \`redo.json\`。**不為硬傷重出**(#21 裁決):每張牌就這 4 張,硬傷照實記。

定義和 #19、#20 相同:框(紙邊、暗角、白邊)、圖上有字(含浮水印、簽名、紙邊小字)、旗或機徽畫錯(紅旗上有星、國旗太陽變黃、機徽畫成美國星、畫像畫錯人)、明顯畸形、認不出是那張牌。臉不像本人、構圖、軍服細節不算硬傷。

看法:每一張候選都做成「整張 + 四個角(放大 3 倍)+ 底邊 100 px(放大 2 倍)」的切片來看,再對每一面旗、每一個機徽、牆上的畫像、每一處像字的東西各自放大。

## 統計(60 張)

- **沒有任何硬傷的:${nClean} 張**(60 張裡)。
- 每張牌有幾張乾淨的候選:${dist.join(';')}。
- **4 張候選都有硬傷的牌:${allBad.length ? allBad.map((c) => `${c.num} ${c.zh}`).join('、') : '無(每張牌至少有 1 張乾淨的候選)'}。**

## 60 列

| 牌 | 候選 | 模型 | 種子 | 框 | 字 | 旗與機徽 | 畸形 | 認得出是這張牌 | 備註 |
|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

## 改過畫面的 5 張

owner 沒有說 X 的原因;這 5 張的毛病是已知的,而且換種子治不好,所以改了 Scene(只改怎麼畫,不改史實:誰、在哪裡、哪一年)。其餘 10 張的 prompt 和 \`prompts.json\` 逐字相同。

${sec.join('\n')}`;
fs.writeFileSync(path.join(dir, 'CHECK-redo.md'), md);
console.log('CHECK-redo.md', rows.length, 'rows,', nClean, 'clean; all-bad cards:', allBad.map((c) => c.num).join(' ') || 'none');
