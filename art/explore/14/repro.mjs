// Usage: node repro.mjs <key>  -> re-renders <key> from prompts.json only (not spec.json), saves repro_<key>.jpg, compares with the delivered jpg.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
const dir = path.dirname(fileURLToPath(import.meta.url));
const key = process.argv[2];
const e = JSON.parse(fs.readFileSync(path.join(dir, 'prompts.json'), 'utf8')).find(x => x.key === key);
const g = JSON.parse(fs.readFileSync(path.join(dir, 'workflow_api.json'), 'utf8'));
g['452'].inputs.prompt = e.prompt; g['458'].inputs.seed = e.seed;
g['456'].inputs.width = e.w; g['456'].inputs.height = e.h; g['461'].inputs.filename_prefix = 'civil_war_14_repro_' + key;
const H = 'http://127.0.0.1:8188';
const r = await (await fetch(H + '/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: g }) })).json();
let img;
for (;;) { await new Promise(s => setTimeout(s, 2000)); const h = (await (await fetch(`${H}/history/${r.prompt_id}`)).json())[r.prompt_id]; if (h?.outputs?.['461']) { img = h.outputs['461'].images[0]; break; } }
const out = path.join(dir, 'repro_' + key + '.jpg');
execFileSync('python', ['-c', 'import sys;from PIL import Image,ImageChops;a=Image.open(sys.argv[1]).convert("RGB");a.save(sys.argv[2],quality=88);b=Image.open(sys.argv[3]).convert("RGB");d=ImageChops.difference(a,b);print("max channel diff",max(x[1] for x in d.getextrema()),"bbox",d.getbbox())', path.join('C:/Users/sheep/code/ComfyUI/output', img.subfolder || '', img.filename), out, path.join(dir, key + '.jpg')], { stdio: 'inherit' });
