// #41: the summary rows of goals.mjs for every state file in a directory (C off = its `off-…` file, if any).
//   node tuning/41/rows.mjs <dir> [--blocks]
import { readdirSync } from "node:fs";
import { readBatch, row, block } from "./goals.mjs";
const [dir, flag] = process.argv.slice(2);
const fs = readdirSync(dir).filter((f) => f.endsWith(".state.json")).sort();
const offF = fs.find((f) => f.startsWith("off-"));
const off = offF ? readBatch("C 關", `${dir}/${offF}`) : null;
const bs = fs.filter((f) => f !== offF).map((f) => readBatch(f.replace(/\.txt\.state\.json$/, ""), `${dir}/${f}`));
if (flag === "--blocks") for (const b of bs) console.log(block(b, off) + "\n");
if (off) console.log(row(off));
for (const b of bs) console.log(row(b, off));
