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
import { existsSync, readFileSync } from "node:fs";
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

// ---------------------------------------------------------------- verdict
test("art prompts: the guard", () => {
  const s = summary();
  for (const p of R.pass) console.log(`通過 · ${p.label}${p.msg ? " · " + p.msg : ""}`);
  for (const t of s.todos) console.log(`尚未實作 · ${t.label} · ${t.msg}`);
  for (const f of s.failures) console.log(`失敗 · ${f.label} · ${f.msg}`);
  console.log(`ART-VERDICT 通過 ${s.pass} / 失敗 ${s.fail} / 尚未實作 ${s.todo}`);
  assert.equal(s.fail, 0, s.failures.map((f) => `${f.label}: ${f.msg}`).join("\n"));
});
