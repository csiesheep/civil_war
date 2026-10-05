// #31, BE's probe: group 14's 「控制看態度」 with the rig the acceptance meant (太原 藍 4 + 灰 2 is over
// the cap 5, so the check's own dPosition throws; reported on #31). Same rows, 藍 3 灰 2 instead,
// expected values worked out by hand from the note's rule 2 (not by the engine):
//   太原 S 3, 藍 3 灰 2: 效忠 3 + 2 ≥ 0 + 3 國;觀望 3 ≥ 0 + 3 國;通共 3 ≥ 0 + 2 + 3 no, 0 ≥ 3 + 2 + 3 no → 無
//   太原 藍 1 灰 2: 效忠 3 ≥ 3 國;觀望 1 ≥ 3 no;通共 no → 國無無
//   察綏 S 2, 紅 3 灰 2: 共 3 ≥ 0 + 2 + 2 no in every attitude → 無無無;紅 4 → 共共共
//   node tuning/31/control-rows.mjs
import * as E from "../../public/shared/engine.js";

const CCP = 0, KMT = 1;
function rig(inf, gray, power, a) {
  const st = E.createGame(11, { aid: false, mechanismD: true });
  for (const [id, [r, b]] of Object.entries(inf)) st.inf[id] = [r, b];
  for (const [id, g] of Object.entries(gray)) E.setGray(st, id, g);
  E.setAttitude(st, power, a);
  return st;
}
const who = (c) => (c === CCP ? "共" : c === KMT ? "國" : "無");
const row = (inf, gray, power, id) => ["loyal", "neutral", "ccp"].map((a) => who(E.controller(rig(inf, gray, power, a), id))).join("");
const cases = [
  [row({ taiyuan: [0, 3] }, { taiyuan: 2 }, "jin", "taiyuan"), "國國無", "太原 藍 3 灰 2"],
  [row({ taiyuan: [0, 1] }, { taiyuan: 2 }, "jin", "taiyuan"), "國無無", "太原 藍 1 灰 2"],
  [row({ chasui: [3, 0] }, { chasui: 2 }, "sui", "chasui"), "無無無", "察綏 紅 3 灰 2"],
  [row({ chasui: [4, 0] }, { chasui: 2 }, "sui", "chasui"), "共共共", "察綏 紅 4 灰 2"],
];
let bad = 0;
for (const [got, want, what] of cases) { const ok = got === want; if (!ok) bad++; console.log(`${ok ? "通過" : "失敗"} · ${what}: 期望 ${want},實際 ${got}`); }
console.log(`CONTROL-ROWS 通過 ${cases.length - bad} / 失敗 ${bad}`);
process.exitCode = bad ? 1 : 0;
