// #39: RULES_VERSION "2026-10-08-2" -> "2026-10-10", the old comment nested as the others are. Run once.
import { readFileSync, writeFileSync } from "node:fs";
const f = new URL("../../public/shared/engine.js", import.meta.url);
const src = readFileSync(f, "utf8");
const head = 'export const RULES_VERSION = "2026-10-08-2"; // #38: ';
const i = src.indexOf(head);
if (i < 0) throw new Error("the #38 RULES_VERSION line is not there");
const end = src.indexOf("\n", i);
const old = src.slice(i + head.length, end);
const line = 'export const RULES_VERSION = "2026-10-10"; // #39: new option `mechanismC` (mechanism C, 內線: `C_SPEC`, `molesAt` / `moleHand` / `molePool`, 佈線 / 和平易手 / 肅諜 as 政工, 洩密 / 倒戈 in 圍點打援); the defaults unchanged: not a key of DEFAULT_OPTIONS, an absent or false option plays as before, byte for byte ("2026-10-08-2" was #38: ' + old + ")";
writeFileSync(f, src.slice(0, i) + line + src.slice(end));
console.log("bumped");
