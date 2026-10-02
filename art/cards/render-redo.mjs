// Renders the 60 redo candidates of #21 from redo.json (Qwen Image 2.1 workflow art/explore/14/r3/workflow_api.json, or Z-Image Turbo art/explore/17/workflow_api_zimage.json).
//   node art/cards/render-redo.mjs                      every candidate whose redo/<key>__c<N>.jpg is missing (resumable; one failure does not stop the batch)
//   node art/cards/render-redo.mjs key key ...          only those cards
//   REPRO=1 node art/cards/render-redo.mjs key N        re-render candidate N of key into repro_<key>__cN.jpg and diff it against redo/<key>__cN.jpg
// Only prompt, seed, steps (Z-Image), size and filename_prefix are changed. No post-processing: the PNG is only saved as JPEG quality 88.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
const dir = path.dirname(fileURLToPath(import.meta.url));
const HOST = 'http://127.0.0.1:8188', COMFY_OUT = process.env.COMFY_OUT || 'C:/Users/sheep/code/ComfyUI/output';
const rec = JSON.parse(fs.readFileSync(path.join(dir, 'redo.json'), 'utf8'));
const qwen = JSON.parse(fs.readFileSync(path.join(dir, '../explore/14/r3/workflow_api.json'), 'utf8'));
const zim = JSON.parse(fs.readFileSync(path.join(dir, '../explore/17/workflow_api_zimage.json'), 'utf8'));
const REPRO = !!process.env.REPRO, args = process.argv.slice(2);
const outDir = path.join(dir, 'redo'); fs.mkdirSync(outDir, { recursive: true });
const timFile = path.join(dir, 'timings-redo.local.json');
const timings = fs.existsSync(timFile) ? JSON.parse(fs.readFileSync(timFile, 'utf8')) : {};
let list = rec;
if (REPRO) list = rec.filter((e) => e.key === args[0] && e.c === +args[1]);
else if (args.length) list = rec.filter((e) => args.includes(e.key));
for (const e of list) {
  const name = e.key + '__c' + e.c, jpg = REPRO ? path.join(dir, 'repro_' + name + '.jpg') : path.join(outDir, name + '.jpg');
  if (!REPRO && fs.existsSync(jpg)) { console.log('skip', name); continue; }
  const t0 = Date.now(); const z = e.model === 'zimage', outNode = z ? '9' : '461';
  try {
    const g = JSON.parse(JSON.stringify(z ? zim : qwen)), prefix = 'civil_war_21_' + (REPRO ? 'repro_' : '') + name;
    if (z) { g['27'].inputs.text = e.prompt; g['3'].inputs.seed = e.seed; g['3'].inputs.steps = e.steps; g['11'].inputs.shift = 3; g['13'].inputs.width = 768; g['13'].inputs.height = 1024; g['9'].inputs.filename_prefix = prefix; }
    else { g['452'].inputs.prompt = e.prompt; g['458'].inputs.seed = e.seed; g['456'].inputs.width = 768; g['456'].inputs.height = 1024; g['461'].inputs.filename_prefix = prefix; }
    const r = await (await fetch(HOST + '/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: g }) })).json();
    if (!r.prompt_id) throw new Error(JSON.stringify(r).slice(0, 800));
    let img;
    for (;;) {
      await new Promise((s) => setTimeout(s, 1000));
      const h = (await (await fetch(`${HOST}/history/${r.prompt_id}`)).json())[r.prompt_id];
      if (h && h.status && h.status.status_str === 'error') throw new Error('comfy error ' + JSON.stringify(h.status).slice(0, 800));
      if (h && h.outputs && h.outputs[outNode]) { img = h.outputs[outNode].images[0]; break; }
    }
    const secs = (Date.now() - t0) / 1000;
    execFileSync('python', ['-c', 'import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");assert im.size==(768,1024),im.size;im.save(sys.argv[2],quality=88)', path.join(COMFY_OUT, img.subfolder || '', img.filename), jpg]);
    if (REPRO) { execFileSync('python', ['-c', 'import sys;from PIL import Image,ImageChops;a=Image.open(sys.argv[1]).convert("RGB");b=Image.open(sys.argv[2]).convert("RGB");print("identical" if a.tobytes()==b.tobytes() else "DIFFERENT",ImageChops.difference(a,b).getbbox())', jpg, path.join(outDir, name + '.jpg')], { stdio: 'inherit' }); console.log('repro', name, secs.toFixed(0) + 's'); continue; }
    timings[name] = { model: e.model, seed: e.seed, seconds: +secs.toFixed(1), file: img.filename }; fs.writeFileSync(timFile, JSON.stringify(timings, null, 2) + '\n');
    console.log('ok', name, secs.toFixed(0) + 's');
  } catch (err) { console.log('FAIL', name, String(err.message).slice(0, 800)); }
}
