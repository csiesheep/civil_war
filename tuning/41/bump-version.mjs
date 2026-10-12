// #41: RULES_VERSION "2026-10-10-2" -> "2026-10-12", the old comment nested as the others are. Run once.
import { readFileSync, writeFileSync } from "node:fs";
const f = new URL("../../public/shared/engine.js", import.meta.url);
const src = readFileSync(f, "utf8");
const head = 'export const RULES_VERSION = "2026-10-10-2"; // #40: ';
const i = src.indexOf(head);
if (i < 0) throw new Error("the #40 RULES_VERSION line is not there");
const end = src.indexOf("\n", i);
const old = src.slice(i + head.length, end);
const line = 'export const RULES_VERSION = "2026-10-12"; // #41: C\'s levers as options under `mechanismC` (`cPurgeSplit`, `cCaught`, `cLeakBonus`, `cDefect`, `cDefectAny`, `cHandover`, `cFreePlant`, `cRealMandate`, `cLeakCapital`; `cSpecOf`, `handoverNeed`; the log\'s `moleMandate`, 佈線\'s `free`, the pending tag `plant`, the plan step `freePlant`); new options, the defaults unchanged: none is a key of DEFAULT_OPTIONS and an absent one plays today\'s C ("2026-10-10-2" was #40: ' + old + ")";
writeFileSync(f, src.slice(0, i) + line + src.slice(end));
console.log("bumped");
