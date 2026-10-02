// Round 2. Usage: node generate.mjs [key ...]  (no args = all 18; existing JPEGs skipped; FORCE=1 redoes)
// Builds prompts.json from spec.json (keeps seeds already recorded there), drives ComfyUI, saves JPEG q88.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
const dir = path.dirname(fileURLToPath(import.meta.url));
const HOST = 'http://127.0.0.1:8188', OUT = process.env.COMFY_OUT || 'C:/Users/sheep/code/ComfyUI/output';
const spec = JSON.parse(fs.readFileSync(path.join(dir, 'spec.json'), 'utf8'));
const pj = path.join(dir, 'prompts.json');
const prev = fs.existsSync(pj) ? JSON.parse(fs.readFileSync(pj, 'utf8')) : [];
const entries = [];
for (const [cid, c] of Object.entries(spec.cards)) spec.factions[c.faction].forEach((sk, i) => {
  const key = `${cid}__${sk}`; const p = prev.find(e => e.key === key);
  const seed = (p && p.seed) || spec.seeds[cid] + i;
  const t = c.text[sk];
  const prompt = `${spec.styles[sk]} Scene: ${c.scene}. ${t ? t + ' ' : ''}${c.period} ${t ? spec.tail_text : spec.tail_notext}`;
  entries.push({ key, card: cid, faction: c.faction, style: sk, w: 768, h: 1024, seed, prompt });
});
export function graph(e) {
  return {
    '451': { class_type: 'UnetLoaderGGUF', inputs: { unet_name: 'qwen-image-2.1-UC-Q8_0.gguf' } },
    '453': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_8b_int8_convrot.safetensors', type: 'qwen_image', device: 'default' } },
    '454': { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_2.1_vae_bf16.safetensors' } },
    '456': { class_type: 'EmptyLatentImage', inputs: { width: e.w, height: e.h, batch_size: 1 } },
    '452': { class_type: 'TextEncodeQwenImage21', inputs: { clip: ['453', 0], prompt: e.prompt, negative_prompt: '', resolution: 1024, vae: ['454', 0] } },
    '458': { class_type: 'KSampler', inputs: { model: ['451', 0], positive: ['452', 0], negative: ['452', 1], latent_image: ['456', 0], seed: e.seed, steps: 25, cfg: 1.0, sampler_name: 'euler', scheduler: 'simple', denoise: 1.0 } },
    '457': { class_type: 'VAEDecode', inputs: { samples: ['458', 0], vae: ['454', 0] } },
    '461': { class_type: 'SaveImageAdvanced', inputs: { images: ['457', 0], filename_prefix: 'civil_war_14_r2_' + e.key, format: 'png', 'format.bit_depth': '8-bit', 'format.input_color_space': 'sRGB' } },
  };
}
const want = process.argv.slice(2);
fs.writeFileSync(pj, JSON.stringify(entries, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'workflow_api.json'), JSON.stringify(graph(entries[0]), null, 2) + '\n');
for (const e of entries) {
  if (want.length && !want.includes(e.key)) continue;
  const jpg = path.join(dir, e.key + '.jpg');
  if (fs.existsSync(jpg) && !process.env.FORCE) { console.log('skip', e.key); continue; }
  const t0 = Date.now();
  try {
    const r = await (await fetch(HOST + '/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: graph(e) }) })).json();
    if (!r.prompt_id) throw new Error(JSON.stringify(r).slice(0, 800));
    let img;
    for (;;) {
      await new Promise(s => setTimeout(s, 2000));
      const h = (await (await fetch(`${HOST}/history/${r.prompt_id}`)).json())[r.prompt_id];
      if (h && h.status && h.status.status_str === 'error') throw new Error('comfy error ' + JSON.stringify(h.status).slice(0, 600));
      if (h && h.outputs && h.outputs['461']) { img = h.outputs['461'].images[0]; break; }
    }
    const src = path.join(OUT, img.subfolder || '', img.filename);
    execFileSync('python', ['-c', 'import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");assert im.size==(768,1024),im.size;im.save(sys.argv[2],quality=88)', src, jpg]);
    console.log('ok', e.key, ((Date.now() - t0) / 1000).toFixed(0) + 's', img.filename);
  } catch (err) { console.log('FAIL', e.key, String(err.message).slice(0, 800)); }
}
