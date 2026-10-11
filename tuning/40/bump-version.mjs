// #40: RULES_VERSION "2026-10-10" -> "2026-10-10-2", the old comment nested as the others are. Run once.
import { readFileSync, writeFileSync } from "node:fs";
const f = new URL("../../public/shared/engine.js", import.meta.url);
const src = readFileSync(f, "utf8");
const head = 'export const RULES_VERSION = "2026-10-10"; // #39: ';
const i = src.indexOf(head);
if (i < 0) throw new Error("the #39 RULES_VERSION line is not there");
const end = src.indexOf("\n", i);
const old = src.slice(i + head.length, end);
const line = 'export const RULES_VERSION = "2026-10-10-2"; // #40: under `mechanismC` the log has one public entry more, `moleNo` (the Communists were asked 洩密 / 倒戈 and said no: the places and how many markers each held, never which are real; orchestrator 裁決 #40, 2); the rules and the defaults unchanged, a game without the option plays and logs as before, byte for byte ("2026-10-10" was #39: ' + old + ")";
writeFileSync(f, src.slice(0, i) + line + src.slice(end));
console.log("bumped");
