// The guard of the card-art prompts. Orchestrator's file: a peer may run it and falsify against it,
// and does not edit it (TEAM.md). The prompts themselves (art/cards/) are the artist's.
//
//   node --test tests/art-prompts.test.js
//
// The owner chose the look of the cards on issue #14 (2026-10-02): the Nationalists' cards as a vivid
// calendar-poster painting (`nat_closeup`), the Communists' as a red socialist-realist oil painting
// (`com_oil`), the neutral ones as a Technicolor film still (`real_tech`); no title and no frame on
// any picture. The three style texts and the closing clause below were copied by hand from that
// issue; they are not read from the artist's files, so a prompt that drifts from the chosen look
// turns this red. What a card's picture SHOWS cannot be checked here: the orchestrator reads every
// scene against the card.
//
// Three verdicts per check; everything answers 尚未實作 until art/cards/prompts.json exists.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { R, section, check, eq, ok, nonEmpty, summary } from "./harness.js";
import * as E from "../public/shared/engine.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const all = (...rs) => { let said = true; for (const r of rs) { if (r !== true && !(r && r.pass)) return r; if (r !== true) said = r; } return said; };
const FILE = here("../art/cards/prompts.json"), TABLE = here("../art/cards/README.md");

// ---------------------------------------------------------------- SPEC (issue #14, the owner's choice)
const STYLE = {
  nat_closeup: "A vivid 1940s calendar-poster painting in a low-angle close-up composition, large heroic figures filling most of the frame, deep cobalt blue and crimson red with bright white highlights, hard glossy airbrushed modelling, intense saturated colour, dramatic and polished.",
  com_oil: "A socialist-realist propaganda painting in the manner of a 1950s Soviet-style oil painting, a blazing red sky and red banners dominating the picture, heavy confident brushwork, monumental heroic composition, soldiers in earthy grey and khaki cotton uniforms, warm red light over everything.",
  real_tech: "A 1950s Technicolor epic film still, rich saturated three-strip colour, glowing warm highlights, theatrical lighting, wide cinematic framing, painterly cinematic polish.",
};
// orchestrator 裁決(#16): a Communist card whose scene has no soldiers may leave the soldiers' clause out; nothing else of the text may change.
const COM_OIL_CIVIL = STYLE.com_oil.replace(", soldiers in earthy grey and khaki cotton uniforms", "");
const TAIL = "Full-bleed image that runs to all four edges of the canvas: no border, no frame, no margin, no white edge, no vignette, no title, no caption, no slogan, no signature, no lettering of any kind anywhere.";
const SIZE = [768, 1024];
// Which look a card takes: its faction's. The five scoring cards are nobody's, so neutral; an aid card
// is its owner's (orchestrator's defaults, said to the owner; his to change).
const AID_STYLE = { american_aid: "nat_closeup", soviet_aid: "com_oil" };
const styleOf = (c) => (c.side === 1 ? "nat_closeup" : c.side === 0 ? "com_oil" : "real_tech");
const WANT = [...E.CARDS.map((c) => ({ key: c.id, zh: c.zh, style: styleOf(c) })), ...E.AID.map((a) => ({ key: a.id, zh: a.zh, style: AID_STYLE[a.id] }))];

const TODO = existsSync(FILE) ? null : "TODO: art/cards/prompts.json 還沒有";
const P = TODO ? [] : JSON.parse(readFileSync(FILE, "utf8"));
const byKey = new Map(P.map((e) => [e.key, e]));
const sceneOf = (e) => { const i = e.prompt.indexOf(" Scene: "); return i < 0 ? "" : e.prompt.slice(i + 8, e.prompt.length - TAIL.length).trim(); };
const first = (xs, n = 4) => xs.slice(0, n).join("、") + (xs.length > n ? `……(共 ${xs.length})` : "");

section("A1 每一張牌都有一則 prompt");

check("74 則:72 張牌加美援、蘇援,一張一則,沒有多的、沒有重複的", () => {
  if (TODO) return TODO;
  const keys = P.map((e) => e.key), dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  const missing = WANT.filter((w) => !byKey.has(w.key)).map((w) => w.zh), extra = keys.filter((k) => !WANT.some((w) => w.key === k));
  return all(eq(WANT.length, 74, "應該有的則數(72 張牌 + 2 張外援牌)"), eq(Array.isArray(P), true, "prompts.json 是一個陣列"),
    ok(!missing.length, missing.length ? `缺:${first(missing)}` : ""), ok(!extra.length, extra.length ? `多出來的 key:${first(extra)}` : ""), ok(!dup.length, dup.length ? `重複的 key:${first(dup)}` : ""),
    eq(P.length, 74, "則數"), ok(true, `74 則,key 與牌的 id 一一對上`));
});

check("每一則的欄位:牌名、風格、768 × 1024、種子(整數、不重複)、給 owner 看的中文畫面說明", () => {
  if (TODO) return TODO;
  const bad = [];
  const seeds = P.map((e) => e.seed);
  for (const w of WANT) {
    const e = byKey.get(w.key); if (!e) continue;
    if (e.zh !== w.zh) bad.push(`${w.zh}:zh 是「${e.zh}」`);
    if (e.w !== SIZE[0] || e.h !== SIZE[1]) bad.push(`${w.zh}:尺寸 ${e.w} × ${e.h}`);
    if (!Number.isInteger(e.seed) || seeds.indexOf(e.seed) !== seeds.lastIndexOf(e.seed)) bad.push(`${w.zh}:種子 ${e.seed}(不是整數或重複)`);
    if (typeof e.scene_zh !== "string" || e.scene_zh.length < 8 || !/[一-鿿]/.test(e.scene_zh)) bad.push(`${w.zh}:scene_zh(中文畫面說明)沒有或太短`);
    if (typeof e.prompt !== "string") bad.push(`${w.zh}:沒有 prompt`);
  }
  return all(nonEmpty(P.length, "prompt 的則數"), ok(!bad.length, bad.length ? first(bad) : `${P.length} 則的欄位都齊`));
});

section("A2 照 owner 挑的三種風格");

check("風格跟著陣營:國軍 nat_closeup、共軍 com_oil、中立與記分卡 real_tech;美援是國軍的、蘇援是共軍的", () => {
  if (TODO) return TODO;
  const bad = WANT.filter((w) => byKey.has(w.key) && byKey.get(w.key).style !== w.style).map((w) => `${w.zh}:${byKey.get(w.key).style}(應該是 ${w.style})`);
  const n = (s) => WANT.filter((w) => w.style === s).length;
  return all(eq(`${n("nat_closeup")},${n("com_oil")},${n("real_tech")}`, "24,24,26", "三種風格應該各有幾張 [國軍, 共軍, 中立]"), ok(!bad.length, bad.length ? first(bad) : `國軍 24、共軍 24、中立 26,風格都對`));
});

check("每一則的開頭是那一種風格的固定文字(一個字都不差),接著「 Scene: 」", () => {
  if (TODO) return TODO;
  const bad = [];
  let civil = 0;
  for (const w of WANT) {
    const e = byKey.get(w.key); if (!e || typeof e.prompt !== "string") continue;
    const heads = w.style === "com_oil" ? [STYLE.com_oil, COM_OIL_CIVIL] : [STYLE[w.style]];
    const hit = heads.find((h) => e.prompt.startsWith(h + " Scene: "));
    if (!hit) bad.push(w.zh); else if (hit === COM_OIL_CIVIL) civil++;
  }
  return all(nonEmpty(P.length, "prompt 的則數"), ok(!bad.length, bad.length ? `開頭不是那種風格的固定文字:${first(bad)}` : `74 則的開頭都是固定文字(共軍的牌有 ${civil} 則用了沒有士兵那一句的版本)`));
});

check("每一則的結尾是「不要標題、不要框」那一段(一個字都不差)", () => {
  if (TODO) return TODO;
  const bad = WANT.filter((w) => byKey.has(w.key) && !(byKey.get(w.key).prompt || "").endsWith(" " + TAIL)).map((w) => w.zh);
  return all(nonEmpty(P.length, "prompt 的則數"), ok(!bad.length, bad.length ? `結尾不對:${first(bad)}` : `74 則的結尾都是 full-bleed 那一段`));
});

section("A3 畫面");

check("每一則都有自己的畫面:不空、夠具體(至少 120 個字元)、彼此不重複、寫了年代", () => {
  if (TODO) return TODO;
  const bad = [], seen = new Map();
  for (const w of WANT) {
    const e = byKey.get(w.key); if (!e || typeof e.prompt !== "string") continue;
    const s = sceneOf(e);
    if (s.length < 120) bad.push(`${w.zh}:畫面只有 ${s.length} 個字元`);
    else if (seen.has(s)) bad.push(`${w.zh}:畫面跟「${seen.get(s)}」一模一樣`);
    else seen.set(s, w.zh);
    if (!/\b19(3\d|4\d)\b/.test(s)) bad.push(`${w.zh}:畫面裡沒有寫年代(194x)`);
    if (e.prompt.length > 1600) bad.push(`${w.zh}:prompt 有 ${e.prompt.length} 個字元(上限 1600)`);
  }
  return all(nonEmpty(P.length, "prompt 的則數"), ok(!bad.length, bad.length ? first(bad) : `74 則各有自己的畫面,都寫了年代;最短的畫面 ${Math.min(...P.map((e) => sceneOf(e).length))} 個字元`));
});

check("prompt 是英文的:裡面沒有中文字(畫面不放字;要寫給 owner 看的在 scene_zh)", () => {
  if (TODO) return TODO;
  const bad = WANT.filter((w) => byKey.has(w.key) && /[㐀-鿿]/.test(byKey.get(w.key).prompt || "")).map((w) => w.zh);
  return all(nonEmpty(P.length, "prompt 的則數"), ok(!bad.length, bad.length ? `prompt 裡有中文字:${first(bad)}` : "74 則 prompt 都沒有中文字"));
});

check("給 owner 看的對照表 art/cards/README.md:每一張牌的名字都在裡面", () => {
  if (TODO) return TODO;
  if (!existsSync(TABLE)) return "art/cards/README.md 還沒有";
  const t = readFileSync(TABLE, "utf8"), missing = WANT.filter((w) => !t.includes(w.zh)).map((w) => w.zh);
  return ok(!missing.length, missing.length ? `表裡找不到:${first(missing)}` : `74 張牌的名字都在表裡(${t.length} 個字元)`);
});

section("A4 圖(#19 Qwen Image 2.1;#20 Z-Image Turbo,給 owner 一張一張挑)");

// Width and height of a JPEG from its frame header (no dependency); null when the file is not one.
const jpegSize = (file) => {
  const b = readFileSync(file);
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < b.length; i += 2 + b.readUInt16BE(i + 2)) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
  }
  return null;
};
const imagesIn = (dir, what) => {
  const names = readdirSync(dir), bad = [];
  for (const w of WANT) {
    const f = dir + "/" + w.key + ".jpg";
    if (!existsSync(f)) { bad.push(`${w.zh}:沒有圖`); continue; }
    const s = jpegSize(f);
    if (!s || s[0] !== SIZE[0] || s[1] !== SIZE[1]) bad.push(`${w.zh}:${s ? s.join(" × ") : "不是 JPEG"}`);
  }
  const extra = names.filter((n) => !WANT.some((w) => w.key + ".jpg" === n));
  return all(eq(WANT.length, 74, "應該有的張數"), ok(!bad.length, bad.length ? first(bad) : ""), ok(!extra.length, extra.length ? `多出來的檔案:${first(extra)}` : ""),
    ok(true, `${what} 74 張,檔名是牌的 id,都是 768 × 1024`));
};

check("Qwen Image 2.1 的圖:art/cards/img/ 底下一張牌一張,768 × 1024,沒有多的", () => {
  if (TODO) return TODO;
  const dir = here("../art/cards/img");
  return existsSync(dir) ? imagesIn(dir, "Qwen Image 2.1") : "TODO: art/cards/img/ 還沒有";
});

check("Z-Image Turbo 的圖:art/cards/img-zimage/ 底下一張牌一張,768 × 1024;zimage.json 記下每一張的種子與步數", () => {
  if (TODO) return TODO;
  const dir = here("../art/cards/img-zimage"), rec = here("../art/cards/zimage.json");
  if (!existsSync(dir) || !existsSync(rec)) return "TODO: art/cards/img-zimage/ 與 art/cards/zimage.json 還沒有";
  const Z = JSON.parse(readFileSync(rec, "utf8")), bad = [];
  for (const w of WANT) {
    const z = Array.isArray(Z) ? Z.filter((e) => e.key === w.key) : [];
    if (z.length !== 1) bad.push(`${w.zh}:zimage.json 裡有 ${z.length} 筆`);
    else if (!Number.isInteger(z[0].seed) || !Number.isInteger(z[0].steps)) bad.push(`${w.zh}:種子 ${z[0].seed}、步數 ${z[0].steps}`);
  }
  return all(eq(Array.isArray(Z) ? Z.length : -1, 74, "zimage.json 的筆數"), ok(!bad.length, bad.length ? first(bad) : ""), imagesIn(dir, "Z-Image Turbo"));
});

section("A5 owner 挑的圖(#21)");

// The owner's answer of 2026-10-02 to the 74 pairs of #20, copied by hand from the conversation:
// A = the Qwen image, B = the Z-Image one, X = neither, render again.
const PICKS = "1A 2A 3A 4A 5A 6A 7A 8A 9A 10A 11X 12X 13X 14A 15A 16X 17X 18A 19A 20A 21A 22A 23A 24X 25A 26A 27A 28A 29A 30A 31A 32A 33X 34A 35A 36X 37X 38A 39X 40A 41A 42A 43A 44A 45A 46B 47A 48B 49A 50A 51A 52A 53X 54A 55A 56A 57A 58A 59A 60A 61A 62A 63A 64X 65X 66A 67X 68A 69A 70A 71A 72X 美援A 蘇援A";
const keyOfLabel = (n) => (n === "美援" ? "american_aid" : n === "蘇援" ? "soviet_aid" : (E.CARDS.find((c) => String(c.num) === n) || {}).id);
const PICK = new Map(PICKS.split(" ").map((t) => { const m = /^(\d+|美援|蘇援)([ABX])$/.exec(t); return [keyOfLabel(m[1]), m[2]]; }));
const REDO = WANT.filter((w) => PICK.get(w.key) === "X");
// orchestrator 裁決(#21): the redo of these five may change the scene, because what is wrong is known and a new
// seed does not cure it (lettering on a document or a doorplate, stars on the flags, a person missing);
// the other ten keep the prompt of prompts.json word for word and only take new seeds.
const MAY_REWRITE = ["sino_soviet_treaty", "marshall_mission", "league_banned", "new_consultative_conference", "stalins_advice"];
const same = (a, b) => existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));
const dirOf = (p) => here("../art/cards/" + p);

check("owner 的答案:74 張各有一個,A 57、B 2、X 15", () => {
  const n = (c) => [...PICK.values()].filter((v) => v === c).length;
  return all(eq(PICK.size, 74, "有答案的牌"), ok(WANT.every((w) => PICK.has(w.key)), "每一張牌都有答案"), eq(`${n("A")},${n("B")},${n("X")}`, "57,2,15", "[A, B, X] 的張數"));
});

check("art/cards/final/:挑 A 的是 img/ 那一張、挑 B 的是 img-zimage/ 那一張(逐位元組相同),final.json 記下模型、種子、步數;X 的要等重出的候選被挑中才進來", () => {
  if (TODO) return TODO;
  const rec = dirOf("final.json"), dir = dirOf("final");
  if (!existsSync(rec) || !existsSync(dir)) return "TODO: art/cards/final/ 與 art/cards/final.json 還沒有";
  const F = JSON.parse(readFileSync(rec, "utf8")), Z = JSON.parse(readFileSync(dirOf("zimage.json"), "utf8")), bad = [];
  let fromRedo = 0;
  for (const w of WANT) {
    const f = Array.isArray(F) ? F.filter((e) => e.key === w.key) : [], p = PICK.get(w.key), file = dir + "/" + w.key + ".jpg";
    if (p === "X" && !f.length) { if (existsSync(file)) bad.push(`${w.zh}:final.json 沒有這張,final/ 卻有圖`); continue; }
    if (f.length !== 1) { bad.push(`${w.zh}:final.json 裡有 ${f.length} 筆`); continue; }
    const e = f[0];
    if (p === "X") { // filled later from a redo candidate the owner picked
      const src = dirOf(String(e.from || ""));
      if (!/^redo\/[a-z_]+__c[1-4]\.jpg$/.test(String(e.from)) || !same(file, src)) bad.push(`${w.zh}:X 的牌要來自 redo/ 的候選(from = ${e.from}),而且逐位元組相同`);
      else fromRedo++;
      continue;
    }
    const want = p === "A" ? { model: "qwen", seed: byKey.get(w.key).seed, steps: 25, from: "img/" + w.key + ".jpg" } : { model: "zimage", seed: (Z.find((z) => z.key === w.key) || {}).seed, steps: 20, from: "img-zimage/" + w.key + ".jpg" };
    if (e.model !== want.model || e.seed !== want.seed || e.steps !== want.steps) bad.push(`${w.zh}:owner 挑 ${p},final.json 寫的是 ${e.model} / ${e.seed} / ${e.steps}(應該是 ${want.model} / ${want.seed} / ${want.steps})`);
    else if (!same(file, dirOf(want.from))) bad.push(`${w.zh}:final/ 的圖和 ${want.from} 不是同一個檔案`);
  }
  const extra = readdirSync(dir).filter((n) => !WANT.some((w) => w.key + ".jpg" === n));
  return all(ok(!bad.length, bad.length ? first(bad) : ""), ok(!extra.length, extra.length ? `多出來的檔案:${first(extra)}` : ""),
    ok(true, `A 57 張與 B 2 張都在 final/、和挑中的檔案逐位元組相同;X 的 15 張裡 ${fromRedo} 張已經由重出的候選補上`));
});

check("X 的 15 張各有 4 張重出的候選(art/cards/redo/、redo.json):新種子;只有那 5 張可以改畫面,其餘 prompt 一字不改", () => {
  if (TODO) return TODO;
  const rec = dirOf("redo.json"), dir = dirOf("redo");
  if (!existsSync(rec) || !existsSync(dir)) return "TODO: art/cards/redo/ 與 art/cards/redo.json 還沒有";
  const D = JSON.parse(readFileSync(rec, "utf8")), bad = [], used = new Set(P.map((e) => e.seed)), seeds = [];
  let rewritten = 0;
  for (const w of REDO) {
    const mine = Array.isArray(D) ? D.filter((e) => e.key === w.key) : [], orig = byKey.get(w.key).prompt;
    if (mine.length !== 4 || [1, 2, 3, 4].some((c) => mine.filter((e) => e.c === c).length !== 1)) { bad.push(`${w.zh}:候選要剛好 4 張(c = 1 到 4),現在 ${mine.length} 張`); continue; }
    for (const e of mine) {
      const model = w.style === "real_tech" && e.c === 4 ? "zimage" : "qwen", steps = model === "qwen" ? 25 : 20, tag = `${w.zh} 候選 ${e.c}`;
      if (e.model !== model || e.steps !== steps) bad.push(`${tag}:${e.model} / ${e.steps} 步(應該是 ${model} / ${steps})`);
      if (!Number.isInteger(e.seed) || used.has(e.seed) || seeds.includes(e.seed)) bad.push(`${tag}:種子 ${e.seed}(不是整數、和 prompts.json 的種子相同、或重複)`);
      seeds.push(e.seed);
      const heads = w.style === "com_oil" ? [STYLE.com_oil, COM_OIL_CIVIL] : [STYLE[w.style]];
      if (typeof e.prompt !== "string" || !heads.some((h) => e.prompt.startsWith(h + " Scene: ")) || !e.prompt.endsWith(" " + TAIL) || /[㐀-鿿]/.test(e.prompt)) bad.push(`${tag}:prompt 的開頭、結尾不是固定文字,或裡面有中文字`);
      else if (e.prompt !== orig) {
        if (!MAY_REWRITE.includes(w.key)) bad.push(`${tag}:prompt 和 prompts.json 的不同(這張只能換種子)`);
        else if (sceneOf(e).length < 120 || !/\b19(3\d|4\d)\b/.test(sceneOf(e))) bad.push(`${tag}:改過的畫面太短或沒有寫年代`);
        else rewritten++;
      }
      const f = dir + "/" + w.key + "__c" + e.c + ".jpg", s = existsSync(f) ? jpegSize(f) : null;
      if (!s || s[0] !== SIZE[0] || s[1] !== SIZE[1]) bad.push(`${tag}:${existsSync(f) ? (s ? s.join(" × ") : "不是 JPEG") : "沒有圖"}`);
    }
  }
  const stray = (Array.isArray(D) ? D : []).filter((e) => !REDO.some((w) => w.key === e.key)).map((e) => e.key);
  return all(eq(REDO.length, 15, "X 的張數"), eq(Array.isArray(D) ? D.length : -1, 60, "redo.json 的筆數"), ok(!stray.length, stray.length ? `不是 X 的牌:${first(stray)}` : ""),
    ok(!bad.length, bad.length ? first(bad) : `15 張各 4 張候選,共 60 張,都是 768 × 1024;其中 ${rewritten} 張候選用了改過的畫面`));
});

// ---------------------------------------------------------------- verdict
test("art prompts: the guard", () => {
  const s = summary();
  for (const p of R.pass) console.log(`通過 · ${p.label}${p.msg ? " · " + p.msg : ""}`);
  for (const t of s.todos) console.log(`尚未實作 · ${t.label} · ${t.msg}`);
  for (const f of s.failures) console.log(`失敗 · ${f.label} · ${f.msg}`);
  console.log(`ART-VERDICT 通過 ${s.pass} / 失敗 ${s.fail} / 尚未實作 ${s.todo}`);
  assert.equal(s.fail, 0, s.failures.map((f) => `${f.label}: ${f.msg}`).join("\n"));
});
