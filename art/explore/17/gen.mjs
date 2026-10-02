// Usage: node gen.mjs [qwen|zimage8|zimage20 ...]   (default: all three, in that order; existing JPEGs are skipped)
// Same prompt, same seed, 768x1024 for every setting; one image per setting per card, no re-rolls.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
const dir = path.dirname(fileURLToPath(import.meta.url));
const HOST = 'http://127.0.0.1:8188', OUT = process.env.COMFY_OUT || 'C:/Users/sheep/code/ComfyUI/output';
const { models, cards } = JSON.parse(fs.readFileSync(path.join(dir, 'prompts.json'), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const qwenBase = JSON.parse(fs.readFileSync(path.join(dir, 'workflow_api_qwen.json'), 'utf8'));
const zBase = JSON.parse(fs.readFileSync(path.join(dir, 'workflow_api_zimage.json'), 'utf8'));
export function graph(m, e) {
  if (m === 'qwen') { const g = clone(qwenBase); g['452'].inputs.prompt = e.prompt; g['458'].inputs.seed = e.seed; g['456'].inputs.width = e.w; g['456'].inputs.height = e.h; g['461'].inputs.filename_prefix = models.qwen.prefix + e.key; return { g, node: '461' }; }
  const g = clone(zBase), p = models[m]; g['27'].inputs.text = e.prompt; g['3'].inputs.seed = e.seed; g['3'].inputs.steps = p.steps; g['11'].inputs.shift = p.shift;
  g['13'].inputs.width = e.w; g['13'].inputs.height = e.h; g['9'].inputs.filename_prefix = p.prefix + e.key; return { g, node: '9' };
}
const timings = fs.existsSync(path.join(dir, 'timings.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'timings.json'), 'utf8')) : {};
// REPRO=1 node gen.mjs <setting> <card id>: re-renders that one image from prompts.json into repro_<name>.jpg and prints the difference to the delivered one.
const REPRO = !!process.env.REPRO, only = REPRO ? process.argv[3] : null;
const want = REPRO ? [process.argv[2]] : (process.argv.slice(2).length ? process.argv.slice(2) : ['qwen', 'zimage8', 'zimage20']);
for (const m of want) for (const e of cards) {
  if (only && e.key !== only) continue;
  const name = `${e.key}__${m}`, jpg = path.join(dir, (REPRO ? 'repro_' : '') + name + '.jpg');
  if (!REPRO && fs.existsSync(jpg)) { console.log('skip', name); continue; }
  const t0 = Date.now();
  try {
    const { g, node } = graph(m, e);
    if (REPRO) for (const n of Object.values(g)) if (n.inputs && n.inputs.filename_prefix) n.inputs.filename_prefix = 'repro_' + n.inputs.filename_prefix;
    const r = await (await fetch(HOST + '/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: g }) })).json();
    if (!r.prompt_id) throw new Error(JSON.stringify(r).slice(0, 800));
    let img;
    for (;;) {
      await new Promise((s) => setTimeout(s, 1000));
      const h = (await (await fetch(`${HOST}/history/${r.prompt_id}`)).json())[r.prompt_id];
      if (h && h.status && h.status.status_str === 'error') throw new Error('comfy error ' + JSON.stringify(h.status).slice(0, 800));
      if (h && h.outputs && h.outputs[node]) { img = h.outputs[node].images[0]; break; }
    }
    const secs = (Date.now() - t0) / 1000;
    execFileSync('python', ['-c', 'import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");assert im.size==(768,1024),im.size;im.save(sys.argv[2],quality=88)', path.join(OUT, img.subfolder || '', img.filename), jpg]);
    if (REPRO) { execFileSync('python', ['-c', 'import sys;from PIL import Image,ImageChops,ImageStat;a=Image.open(sys.argv[1]).convert("RGB");b=Image.open(sys.argv[2]).convert("RGB");d=ImageChops.difference(a,b);print("mean diff",ImageStat.Stat(d).mean,"bbox",d.getbbox())', jpg, path.join(dir, name + '.jpg')], { stdio: 'inherit' }); console.log('repro', name, secs.toFixed(0) + 's'); continue; }
    timings[name] = { seconds: +secs.toFixed(1), file: img.filename }; fs.writeFileSync(path.join(dir, 'timings.json'), JSON.stringify(timings, null, 2) + '\n');
    console.log('ok', name, secs.toFixed(0) + 's', img.filename);
  } catch (err) { console.log('FAIL', name, String(err.message).slice(0, 800)); }
}
