// #42: C_SPEC gains leakBonus 1 and realMandate 1 (owner 裁決 #41 ①); cSpecBuild's defaults read them; the
// comments; RULES_VERSION "2026-10-12" -> "2026-10-13", the old comment nested as the others are. Run once.
import { readFileSync, writeFileSync } from "node:fs";
const f = new URL("../../public/shared/engine.js", import.meta.url);
let s = readFileSync(f, "utf8");
if (s.includes("\r")) throw new Error("CRLF in engine.js");
const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error(`not once: ${a.slice(0, 60)}`); s = s.replace(a, () => b); };
rep(`// The state: \`st.moles\` = { hand: [real, fake], pool: [real, fake], out (real markers revealed, out of the
// game), at: { <city>: [true, false, …] } (no key for a city with none), reform4 (box 4's gain is given) }.
export const C_SPEC = { markers: [5, 5], start: [1, 2], perCity: 2, defect: 2, gains: { reform4: [2, 1], turning: [1, 1], decisive: [1, 1] }, caughtFake: { centrists: 1, mandate: 1 } };`,
`//   - #42: 洩密 also gives this attack's ops +1 (\`leakBonus\`), and at each turn's 結算 every real marker on a city
//     moves 民心 1 toward the Communists (\`realMandate\`; the fakes and the hand's do not count; the log says how
//     many, never where). Owner 裁決 #41 ①, 「跑三批驗,過了就定為 C」: the three batches passed (#41), and the
//     owner's note C says so since 2026-10-13 (its points 4 and 7). They were #41's MC-mand1+leak1.
// The state: \`st.moles\` = { hand: [real, fake], pool: [real, fake], out (real markers revealed, out of the
// game), at: { <city>: [true, false, …] } (no key for a city with none), reform4 (box 4's gain is given) }.
export const C_SPEC = { markers: [5, 5], start: [1, 2], perCity: 2, defect: 2, gains: { reform4: [2, 1], turning: [1, 1], decisive: [1, 1] }, caughtFake: { centrists: 1, mandate: 1 }, leakBonus: 1, realMandate: 1 };`);
rep(`// under \`mechanismC\`, through \`cSpecOf(st)\`; none is a key of DEFAULT_OPTIONS and an absent one plays today's C
// (C_SPEC itself is unchanged: group 16 of the acceptance pins it).`,
`// under \`mechanismC\`, through \`cSpecOf(st)\`; none is a key of DEFAULT_OPTIONS and an absent one plays C as C_SPEC
// says (group 16 of the acceptance pins it). #42: \`cLeakBonus\` and \`cRealMandate\` default to C_SPEC's 1 and 1;
// \`cLeakBonus: 0, cRealMandate: 0\` plays the C before #42 (tuning/23/variants.mjs \`C-41\`). A given option wins.`);
rep(`//   cLeakBonus n       洩密: this attack's ops +n as well (0)`, `//   cLeakBonus n       洩密: this attack's ops +n as well (C_SPEC.leakBonus, 1; 0 before #42)`);
rep(`//                      log says how many, never where (0)`, `//                      log says how many, never where (C_SPEC.realMandate, 1; 0 before #42)`);
rep(`leakBonus: num("cLeakBonus", 0, 0),`, `leakBonus: num("cLeakBonus", C_SPEC.leakBonus, 0),`);
rep(`realMandate: num("cRealMandate", 0, 0),`, `realMandate: num("cRealMandate", C_SPEC.realMandate, 0),`);
rep(`// C's numbers for this game: today's (\`C_DEFAULT\`) unless one of #41's keys is given.`, `// C's numbers for this game: C_SPEC's (\`C_DEFAULT\`) unless one of #41's keys is given.`);
const head = 'export const RULES_VERSION = "2026-10-12"; // ';
const i = s.indexOf(head);
if (i < 0) throw new Error("the #41 RULES_VERSION line is not there");
const end = s.indexOf("\n", i);
const old = s.slice(i + head.length, end);
const line = 'export const RULES_VERSION = "2026-10-13"; // #42: what `mechanismC: true` plays changed (owner 裁決 #41 ①): C_SPEC gains `leakBonus: 1` (洩密: this attack\'s ops +1) and `realMandate: 1` (at each turn\'s 結算, 民心 1 toward the Communists for every real marker on the board), and `cLeakBonus` / `cRealMandate` default to them; `cLeakBonus: 0, cRealMandate: 0` plays the C before; the default (C off) is unchanged ("2026-10-12" was ' + old + ")";
s = s.slice(0, i) + line + s.slice(end);
writeFileSync(f, s);
console.log("edited");
