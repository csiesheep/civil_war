// Builds prompts.json and README.md from scenes.mjs and the card data. Run: node art/cards/build.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as E from "../../public/shared/engine.js";
import { SCENES } from "./scenes.mjs";
const dir = fileURLToPath(new URL(".", import.meta.url));
const STYLE = {
  nat_closeup: "A vivid 1940s calendar-poster painting in a low-angle close-up composition, large heroic figures filling most of the frame, deep cobalt blue and crimson red with bright white highlights, hard glossy airbrushed modelling, intense saturated colour, dramatic and polished.",
  com_oil: "A socialist-realist propaganda painting in the manner of a 1950s Soviet-style oil painting, a blazing red sky and red banners dominating the picture, heavy confident brushwork, monumental heroic composition, soldiers in earthy grey and khaki cotton uniforms, warm red light over everything.",
  real_tech: "A 1950s Technicolor epic film still, rich saturated three-strip colour, glowing warm highlights, theatrical lighting, wide cinematic framing, painterly cinematic polish.",
};
const CIVIL = STYLE.com_oil.replace(", soldiers in earthy grey and khaki cotton uniforms", "");
const TAIL = "Full-bleed image that runs to all four edges of the canvas: no border, no frame, no margin, no white edge, no vignette, no title, no caption, no slogan, no signature, no lettering of any kind anywhere.";
const NOTEXT = "No text, no characters, no seals, no writing.";
const AID = { american_aid: ["K", "nat_closeup", "美援", 0], soviet_aid: ["C", "com_oil", "蘇援", 0] };
// Seeds that were changed by a re-render (#19: seed + 1000 * n after a hard defect in the picture); every other card keeps 16001 + its index.
const RESEED = {
  surrender_order: 19006, league_banned: 17033, chen_cheng: 19034, new_consultative_conference: 19064, beiping_talks: 17066,
  japanese_garrisons: 17010, sino_soviet_treaty: 17011, mobilisation_order: 17032, ta_kung_pao: 17072, soviet_aid: 17074,
};
const meta = new Map();
for (const c of E.CARDS) meta.set(c.id, { zh: c.zh, num: c.num, year: c.year, side: c.side === 1 ? "K" : c.side === 0 ? "C" : "N" });
for (const a of E.AID) meta.set(a.id, { zh: a.zh, num: "—", year: null, side: AID[a.id][0] });
const styleOf = (m, id) => (AID[id] ? AID[id][1] : m.side === "K" ? "nat_closeup" : m.side === "C" ? "com_oil" : "real_tech");
const byId = new Map(SCENES.map((s) => [s[0], s]));
const order = [...E.CARDS.map((c) => c.id), "american_aid", "soviet_aid"];
const out = [];
order.forEach((id, i) => {
  const s = byId.get(id); if (!s) throw new Error("no scene for " + id);
  const m = meta.get(id), style = styleOf(m, id), civil = !!s[3];
  if (civil && style !== "com_oil") throw new Error("civil on a non-Communist card " + id);
  const head = civil ? CIVIL : STYLE[style];
  out.push({ key: id, zh: m.zh, side: m.side, style, w: 768, h: 1024, seed: RESEED[id] ?? 16001 + i, scene_zh: s[2], prompt: `${head} Scene: ${s[1]} ${NOTEXT} ${TAIL}` });
});
if (out.length !== 74 || SCENES.length !== 74) throw new Error("count " + out.length + "/" + SCENES.length);
fs.writeFileSync(dir + "prompts.json", JSON.stringify(out, null, 2) + "\n");
const civilN = SCENES.filter((s) => s[3]).length;
const SIDE_ZH = { K: "國軍", C: "共軍", N: "中立" };
const row = (e) => { const m = meta.get(e.key); const civil = e.prompt.startsWith(CIVIL + " Scene:"); const side = e.key.startsWith("score_") ? "記分卡" : e.key.endsWith("_aid") ? SIDE_ZH[e.side] + "外援" : SIDE_ZH[e.side]; return `| ${m.num} | ${e.zh} | ${side} | ${m.year ?? "—"} | ${e.style}${civil ? "(無士兵版)" : ""} | ${e.scene_zh.replace(/\|/g, "/")} |`; };
const sec = (title, pred) => `### ${title}\n\n| 編號 | 牌名 | 陣營 | 年 | 風格 | 畫面 |\n|---|---|---|---|---|---|\n${out.filter(pred).map(row).join("\n")}\n`;
const isScoreOrAid = (e) => e.key.startsWith("score_") || e.key.endsWith("_aid");
const md = `# 74 張牌的圖 prompt(#16)

owner 說:「先產生好所有圖片的prompts」。這裡是 74 則 prompt(72 張牌 + 美援、蘇援),圖已經出了(#19):\`img/<key>.jpg\`,逐張的檢查在 \`CHECK.md\`,三張對照表是 \`sheet-nationalist.jpg\`、\`sheet-communist.jpg\`、\`sheet-neutral.jpg\`。完整的 prompt、種子、尺寸在 \`prompts.json\`;下面的表是給你讀的:每張牌畫什麼。覺得哪張畫錯,說牌名和你想要的畫面。

## 三種風格(你在 #14 挑的),與結尾

- **國軍 \`nat_closeup\`**(24 張,含美援):${STYLE.nat_closeup}
- **共軍 \`com_oil\`**(24 張,含蘇援):${STYLE.com_oil}
- **其他 \`real_tech\`**(26 張:21 張中立牌 + 5 張記分卡):${STYLE.real_tech}
- 共軍牌的畫面裡沒有士兵時(共 ${civilN} 張,表裡標「無士兵版」),風格文字拿掉「, soldiers in earthy grey and khaki cotton uniforms」,其餘不動。
- 每一則的結尾:${TAIL}

第一輪出圖(#17,十張牌 × 兩個模型)之後,所有畫面都改過:飛機的機徽寫成「藍底白色十二芒日」、機身橄欖綠或銀色,不畫星;共軍的旗一律寫「素面紅旗,沒有星、徽、字」;國旗每次寫全(紅地、藍角、白色十二芒日);國軍軍服卡其或橄欖綠、美式鋼盔、軍官軍帽,共軍軍服灰或卡其棉布、布帽、綁腿;有名字的人物都寫了外貌(頭、臉、衣服),不單靠名字。每則畫面後面都有一句「No text, no characters, no seals, no writing.」。

每一則的形狀:\`<風格文字> Scene: <畫面與年代細節> <結尾>\`,全英文,沒有要求圖裡出現任何字。種子 = 16000 + 該牌在 prompts.json 的序號;出圖時有硬傷的牌換過種子(原種子 + 1000、+ 2000 或 + 3000,見 \`build.mjs\` 的 \`RESEED\` 與 \`CHECK.md\`),\`prompts.json\` 裡的種子就是交付那張圖用的種子。尺寸 768 × 1024。

## 怎麼出其中一張(之後出圖的人)

用 \`art/explore/14/r3/workflow_api.json\`(Qwen Image 2.1,25 步、cfg 1、euler / simple)當樣板,只換這四個欄位再送給 ComfyUI(\`http://127.0.0.1:8188/prompt\`):\`452.inputs.prompt\` = 該筆的 \`prompt\`,\`458.inputs.seed\` = \`seed\`,\`456.inputs.width / height\` = 768 / 1024,\`461.inputs.filename_prefix\` = 自訂。\`art/explore/14/r3/repro.mjs\` 是現成的寫法(把裡面讀 prompts.json 的路徑改成這個檔)。

用 Z-Image Turbo 出的話,樣板是 \`art/explore/17/workflow_api_zimage.json\`(8 或 20 步),\`art/explore/17/gen.mjs\` 是現成的寫法;#17 看到 Z-Image 會多出紙邊與小字(結尾那一段擋不住),Qwen 沒有。

## 畫面表

${sec("國軍(nat_closeup)", (e) => e.style === "nat_closeup" && !isScoreOrAid(e))}
${sec("共軍(com_oil)", (e) => e.style === "com_oil" && !isScoreOrAid(e))}
${sec("其他中立牌(real_tech)", (e) => e.style === "real_tech" && !isScoreOrAid(e))}
${sec("記分卡與外援牌", isScoreOrAid)}`;
fs.writeFileSync(dir + "README.md", md);
console.log("ok", out.length, "civil", civilN);
