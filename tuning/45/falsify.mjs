// #45: one defect at a time, in a copy of the branch (tuning/45/fals: `git archive HEAD package.json public/shared tests`),
// so the runs in the worktree are not touched. Applies defect <n> to the copy's engine, runs the acceptance there
// (and, with `probe`, tuning/45/probe.mjs 5 easy 1, copied into the copy), prints the VERDICT line and every 失敗 line
// (and the probe's PROBE / FAIL lines), restores the engine and checks it is byte-identical again.
//   node tuning/45/falsify.mjs <1|1b|2|3> [probe]
//   1  the preview changes st: no copy, each plan is written into st's own plan step (打點, then 打援)
//   1b the same, the plans tried in the other order (打援 first, so 打點 is what is left in st)
//   2  the preview returns only the real plan's side: the plan step is not overwritten
//   3  mandateByTurn records a turn late: at turn t's 結算 it writes the cell of turn t − 1
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "fals"), f = join(root, "public/shared/engine.js");
const NOCOPY = [`    const s = clone({ ...st, actions: undefined });\n`, `    const s = st; // FALSIFY 1: no copy\n`];
const DEFECTS = {
  1: [NOCOPY],
  "1b": [NOCOPY, [`  for (const plan of SIEGE_PLANS) {\n    const s = st;`, `  for (const plan of SIEGE_PLANS.slice().reverse()) { // FALSIFY 1b\n    const s = st;`]],
  2: [[`    s.plan[0].plan = plan;\n`, `    // FALSIFY 2: the plan step keeps the real plan\n`]],
  3: [[`      markMandate(st, st.turn); // #45: after this turn's 結算, where the probe reads it\n`, `      markMandate(st, st.turn - 1); // FALSIFY 3: a turn late\n`]],
};
const [n, also] = process.argv.slice(2), edits = DEFECTS[n];
if (!edits) throw new Error(`no defect ${n}`);
const orig = readFileSync(f, "utf8");
if (orig.includes("FALSIFY")) throw new Error("the copy is not clean");
let bad = orig;
for (const [from, to] of edits) {
  if (bad.split(from).length !== 2) throw new Error(`defect ${n}: an anchor does not hit exactly once: ${from}`);
  bad = bad.replace(from, to);
}
writeFileSync(f, bad);
const runIt = (args) => { try { return execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }); } catch (e) { return (e.stdout || "") + (e.stderr || ""); } };
let out = "";
try {
  out = runIt(["--test", "tests/acceptance.test.js"]);
  if (also === "probe") {
    mkdirSync(join(root, "tuning/45"), { recursive: true });
    writeFileSync(join(root, "tuning/45/probe.mjs"), readFileSync(join(here, "probe.mjs")));
    out += runIt(["tuning/45/probe.mjs", "5", "easy", "1"]);
  }
} finally { writeFileSync(f, orig); }
writeFileSync(join(here, `fals-${n}.log`), out);
for (const line of out.split(/\r?\n/)) if (/^(VERDICT|失敗 ·|PROBE|FAIL|EMPTY)/.test(line)) console.log(line);
console.log(readFileSync(f, "utf8") === orig ? "restored: byte-identical" : "NOT RESTORED");
