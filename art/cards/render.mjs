// Renders card images from prompts.json with the owner's Qwen Image 2.1 workflow (art/explore/14/r3/workflow_api.json).
//   node art/cards/render.mjs                      every card whose img/<key>.jpg is missing (resumable; one failure does not stop the batch)
//   node art/cards/render.mjs --try 1 key key ...  re-render those cards with seed + 1000*N into OUT_DIR (default art/cards/tries/), never into img/
//   REPRO=1 node art/cards/render.mjs key          re-render the key from prompts.json into repro_<key>.jpg and diff it against img/<key>.jpg
// Only prompt, seed, width/height and filename_prefix are changed. No post-processing: the PNG is only saved as JPEG quality 88.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
const dir = path.dirname(fileURLToPath(import.meta.url));
const HOST = 'http://127.0.0.1:8188', COMFY_OUT = process.env.COMFY_OUT || 'C:/Users/sheep/code/ComfyUI/output';
const cards = JSON.parse(fs.readFileSync(path.join(dir, 'prompts.json'), 'utf8'));
const base = JSON.parse(fs.readFileSync(path.join(dir, '../explore/14/r3/workflow_api.json'), 'utf8'));
const args = process.argv.slice(2); let tryN = 0;
if (args[0] === '--try') { tryN = +args[1]; args.splice(0, 2); }
const REPRO = !!process.env.REPRO;
const outDir = REPRO ? dir : tryN ? (process.env.OUT_DIR || path.join(dir, 'tries')) : path.join(dir, 'img');
fs.mkdirSync(outDir, { recursive: true });
const timingsFile = path.join(process.env.TIMINGS_DIR || dir, 'timings.local.json');
const timings = fs.existsSync(timingsFile) ? JSON.parse(fs.readFileSync(timingsFile, 'utf8')) : {};
const list = args.length ? cards.filter((c) => args.includes(c.key)) : cards;
for (const e of list) {
  const seed = e.seed + 1000 * tryN;
  const name = REPRO ? `repro_${e.key}` : tryN ? `${e.key}__${seed}` : e.key, jpg = path.join(outDir, name + '.jpg');
  if (!REPRO && fs.existsSync(jpg)) { console.log('skip', name); continue; }
  const t0 = Date.now();
  try {
    const g = JSON.parse(JSON.stringify(base));
    g['452'].inputs.prompt = e.prompt; g['458'].inputs.seed = seed; g['456'].inputs.width = e.w; g['456'].inputs.height = e.h; g['461'].inputs.filename_prefix = 'civil_war_19_' + (REPRO ? 'repro_' : '') + e.key + (tryN ? '_' + seed : '');
    const r = await (await fetch(HOST + '/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: g }) })).json();
    if (!r.prompt_id) throw new Error(JSON.stringify(r).slice(0, 800));
    let img;
    for (;;) {
      await new Promise((s) => setTimeout(s, 1000));
      const h = (await (await fetch(`${HOST}/history/${r.prompt_id}`)).json())[r.prompt_id];
      if (h && h.status && h.status.status_str === 'error') throw new Error('comfy error ' + JSON.stringify(h.status).slice(0, 800));
      if (h && h.outputs && h.outputs['461']) { img = h.outputs['461'].images[0]; break; }
    }
    const secs = (Date.now() - t0) / 1000;
    execFileSync('python', ['-c', 'import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");assert im.size==(768,1024),im.size;im.save(sys.argv[2],quality=88)', path.join(COMFY_OUT, img.subfolder || '', img.filename), jpg]);
    if (REPRO) { execFileSync('python', ['-c', 'import sys;from PIL import Image,ImageChops;a=Image.open(sys.argv[1]).convert("RGB");b=Image.open(sys.argv[2]).convert("RGB");print("identical" if a.tobytes()==b.tobytes() else "DIFFERENT",ImageChops.difference(a,b).getbbox())', jpg, path.join(dir, 'img', e.key + '.jpg')], { stdio: 'inherit' }); console.log('repro', e.key, secs.toFixed(0) + 's'); continue; }
    timings[name] = { seed, seconds: +secs.toFixed(1), file: img.filename }; fs.writeFileSync(timingsFile, JSON.stringify(timings, null, 2) + '\n');
    console.log('ok', name, secs.toFixed(0) + 's');
  } catch (err) { console.log('FAIL', name, String(err.message).slice(0, 800)); }
}
