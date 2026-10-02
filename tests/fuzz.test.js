// The fuzz: M1's third criterion, 「隨機合法對局兩千局不卡死不報錯」. Orchestrator's file (TEAM.md).
//
//   node --test tests/fuzz.test.js           2,000 games (FUZZ_GAMES=200 for a quick look)
//
// Every game is played to its end by tests/driver.js with the product's own random player
// (public/shared/random.js). A game fails the fuzz when nobody can act, when the random player has
// nothing to offer, when the engine refuses what it offered, when anything throws, or when the game
// does not end. Every tenth game is also replayed from its seed and recorded actions and must come
// out the same, state for state (the engine's promise: seed + actions = the game).
//
// Three verdicts, as in the guard: until public/shared/random.js exists this answers 尚未實作.
// The games run in chunks of 100, each in its own process, and a chunk that dies without a result
// is run once more before it counts (this machine).
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const GAMES = Number(process.env.FUZZ_GAMES || 2000), CHUNK = 100;
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

function chunk(first, count) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = spawnSync(process.execPath, [here("./fuzz-chunk.js"), String(first), String(count)], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const line = (r.stdout || "").split("\n").find((l) => l.startsWith("FUZZ "));
    if (line) return { ...JSON.parse(line.slice(5)), attempt };
    if (attempt === 2) return { first, count, ended: 0, actions: 0, errors: [{ seed: first, message: `the chunk died twice without a result (exit ${r.status}): ${(r.stderr || "").slice(-300)}`, kind: "chunk" }], reasons: {}, turns: {}, replayed: 0, replayMismatch: [], events: {}, attempt };
  }
}

test("fuzz: random legal games", () => {
  if (!existsSync(here("../public/shared/random.js"))) {
    console.log("尚未實作 · 隨機合法對局 · public/shared/random.js 還沒有(randomAction 還在 bots.js 裡,讀的是九鼎與舊的回合數)");
    console.log("FUZZ-VERDICT 尚未實作");
    return;
  }
  const total = { games: 0, ended: 0, actions: 0, errors: [], reasons: {}, turns: {}, replayed: 0, replayMismatch: [], events: {}, rerun: 0 };
  for (let first = 1; first <= GAMES; first += CHUNK) {
    const c = chunk(first, Math.min(CHUNK, GAMES - first + 1));
    total.games += c.count; total.ended += c.ended; total.actions += c.actions; total.replayed += c.replayed;
    total.errors.push(...c.errors); total.replayMismatch.push(...c.replayMismatch);
    if (c.attempt > 1) total.rerun++;
    for (const k of ["reasons", "turns", "events"]) for (const [id, n] of Object.entries(c[k])) total[k][id] = (total[k][id] || 0) + n;
  }
  const events = Object.entries(total.events).sort((a, b) => a[1] - b[1]);
  console.log(`結束的方式 ${JSON.stringify(total.reasons)}`);
  console.log(`結束的回合 ${JSON.stringify(total.turns)}`);
  console.log(`事件 67 種裡結算過 ${events.length} 種;最少的三種 ${events.slice(0, 3).map(([k, n]) => `${k} ${n}`).join("、")}`);
  if (total.rerun) console.log(`有 ${total.rerun} 個區塊第一次沒有結果,重跑了一次`);
  for (const e of total.errors.slice(0, 10)) console.log(`失敗 · 種子 ${e.seed} · ${e.kind}: ${e.message}`);
  for (const s of total.replayMismatch.slice(0, 10)) console.log(`失敗 · 種子 ${s} · 從種子與動作重播,結果和原局不同`);
  console.log(`FUZZ-VERDICT 局數 ${total.games} / 結束 ${total.ended} / 報錯或卡住 ${total.errors.length} / 重播 ${total.replayed} 局、不一致 ${total.replayMismatch.length} / 動作 ${total.actions}`);
  assert.equal(total.errors.length, 0, total.errors.slice(0, 5).map((e) => `seed ${e.seed}: ${e.message}`).join("\n"));
  assert.equal(total.ended, GAMES, "every game must end");
  assert.equal(total.replayMismatch.length, 0, `replay differs for seeds ${total.replayMismatch.slice(0, 10)}`);
  assert.ok(total.replayed > 0, "no game was replayed");
  assert.equal(events.length, 67, `only ${events.length} of the 67 events were ever resolved`);
});
