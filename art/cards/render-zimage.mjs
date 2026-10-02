// Renders the Z-Image Turbo half of #20: one image per card from prompts.json (same prompt, same seed as the Qwen one), 20 steps, 768x1024.
//   node art/cards/render-zimage.mjs                  every card whose img-zimage/<key>.jpg is missing (resumable; one failure does not stop the batch)
//   REPRO=1 node art/cards/render-zimage.mjs key      re-render from zimage.json + prompts.json into repro_<key>.jpg and diff against img-zimage/<key>.jpg
// Only prompt, seed, steps, size and filename_prefix are changed in the workflow. No post-processing: PNG saved as JPEG quality 88.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
const dir = path.dirname(fileURLToPath(import.meta.url));
const HOST = 'http://127.0.0.1:8188', COMFY_OUT = process.env.COMFY_OUT || 'C:/Users/sheep/code/ComfyUI/output', STEPS = 20;
const cards = JSON.parse(fs.readFileSync(path.join(dir, 'prompts.json'), 'utf8'));
const base = JSON.parse(fs.readFileSync(path.join(dir, '../explore/17/workflow_api_zimage.json'), 'utf8'));
const REPRO = !!process.env.REPRO, args = process.argv.slice(2);
const recFile = path.join(dir, 'zimage.json'), timFile = path.join(dir, 'timings-zimage.local.json');
const rec = fs.existsSync(recFile) ? JSON.parse(fs.readFileSync(recFile, 'utf8')) : [];
const timings = fs.existsSync(timFile) ? JSON.parse(fs.readFileSync(timFile, 'utf8')) : {};
const outDir = path.join(dir, 'img-zimage'); fs.mkdirSync(outDir, { recursive: true });
const list = args.length ? cards.filter((c) => args.includes(c.key)) : cards;
for (const e of list) {
  const old = rec.find((r) => r.key === e.key);
  const seed = REPRO && old ? old.seed : e.seed, steps = REPRO && old ? old.steps : STEPS;
  const jpg = REPRO ? path.join(dir, 'repro_' + e.key + '.jpg') : path.join(outDir, e.key + '.jpg');
  if (!REPRO && fs.existsSync(jpg)) { console.log('skip', e.key); continue; }
  const t0 = Date.now();
  try {
    const g = JSON.parse(JSON.stringify(base));
    g['27'].inputs.text = e.prompt; g['3'].inputs.seed = seed; g['3'].inputs.steps = steps; g['11'].inputs.shift = 3;
    g['13'].inputs.width = e.w; g['13'].inputs.height = e.h; g['9'].inputs.filename_prefix = 'civil_war_20_' + (REPRO ? 'repro_' : '') + e.key;
    const r = await (await fetch(HOST + '/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: g }) })).json();
    if (!r.prompt_id) throw new Error(JSON.stringify(r).slice(0, 800));
    let img;
    for (;;) {
      await new Promise((s) => setTimeout(s, 1000));
      const h = (await (await fetch(`${HOST}/history/${r.prompt_id}`)).json())[r.prompt_id];
      if (h && h.status && h.status.status_str === 'error') throw new Error('comfy error ' + JSON.stringify(h.status).slice(0, 800));
      if (h && h.outputs && h.outputs['9']) { img = h.outputs['9'].images[0]; break; }
    }
    const secs = (Date.now() - t0) / 1000;
    execFileSync('python', ['-c', 'import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");assert im.size==(768,1024),im.size;im.save(sys.argv[2],quality=88)', path.join(COMFY_OUT, img.subfolder || '', img.filename), jpg]);
    if (REPRO) { execFileSync('python', ['-c', 'import sys;from PIL import Image,ImageChops;a=Image.open(sys.argv[1]).convert("RGB");b=Image.open(sys.argv[2]).convert("RGB");print("identical" if a.tobytes()==b.tobytes() else "DIFFERENT",ImageChops.difference(a,b).getbbox())', jpg, path.join(outDir, e.key + '.jpg')], { stdio: 'inherit' }); console.log('repro', e.key, secs.toFixed(0) + 's'); continue; }
    rec.push({ key: e.key, seed, steps }); fs.writeFileSync(recFile, JSON.stringify(rec, null, 2) + '\n');
    timings[e.key] = { seconds: +secs.toFixed(1), file: img.filename }; fs.writeFileSync(timFile, JSON.stringify(timings, null, 2) + '\n');
    console.log('ok', e.key, secs.toFixed(0) + 's');
  } catch (err) { console.log('FAIL', e.key, String(err.message).slice(0, 800)); }
}
