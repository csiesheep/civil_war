// Writes art/cards/final/<card id>.jpg (byte-for-byte copies) and art/cards/final.json from the owner's answer of 2026-10-02 (#21).
//   A = img/<key>.jpg (Qwen, 25 steps, seed of prompts.json), B = img-zimage/<key>.jpg (Z-Image, 20 steps, seed of zimage.json), X = not here until a redo candidate is picked.
//   node art/cards/finalize.mjs
import fs from 'node:fs'; import path from 'node:path';
import { load, dir } from './pickdata.mjs';
const PICKS = '1A 2A 3A 4A 5A 6A 7A 8A 9A 10A 11X 12X 13X 14A 15A 16X 17X 18A 19A 20A 21A 22A 23A 24X 25A 26A 27A 28A 29A 30A 31A 32A 33X 34A 35A 36X 37X 38A 39X 40A 41A 42A 43A 44A 45A 46B 47A 48B 49A 50A 51A 52A 53X 54A 55A 56A 57A 58A 59A 60A 61A 62A 63A 64X 65X 66A 67X 68A 69A 70A 71A 72X 美援A 蘇援A';
const pick = new Map(PICKS.split(' ').map((t) => { const m = /^(\d+|美援|蘇援)([ABX])$/.exec(t); return [m[1], m[2]]; }));
const cards = load(), P = JSON.parse(fs.readFileSync(path.join(dir, 'prompts.json'), 'utf8')), Z = JSON.parse(fs.readFileSync(path.join(dir, 'zimage.json'), 'utf8'));
const out = path.join(dir, 'final'); fs.mkdirSync(out, { recursive: true }); const rec = [];
for (const c of cards) {
  const p = pick.get(c.num); if (!p) throw new Error('no answer for ' + c.num);
  if (p === 'X') continue;
  const from = (p === 'A' ? 'img/' : 'img-zimage/') + c.key + '.jpg';
  fs.copyFileSync(path.join(dir, from), path.join(out, c.key + '.jpg'));
  rec.push(p === 'A' ? { key: c.key, model: 'qwen', seed: P.find((e) => e.key === c.key).seed, steps: 25, from } : { key: c.key, model: 'zimage', seed: Z.find((e) => e.key === c.key).seed, steps: 20, from });
}
fs.writeFileSync(path.join(dir, 'final.json'), JSON.stringify(rec, null, 2) + '\n'); console.log('final', rec.length);
