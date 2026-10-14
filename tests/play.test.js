// tests/play.test.js — M3 ②:「對 bot 在手機上玩完一局」的動詞,不用瀏覽器也能驗的那一半。orchestrator 的檔案(TEAM.md)。
//
//   node --test tests/play.test.js            (PLAY_GAMES=4 看一眼)
//
// owner 裁決(2026-10-13,原文):「照這個方向做②(建議)」——② 是「預設規則對 bot 在手機上能玩完一局」。
// 畫面(DOM)由 orchestrator 用眼睛在瀏覽器驗;這裡驗頁面背後那一層:玩家能點的東西,夠不夠把一局玩完。
//
// orchestrator 裁決(#44,介面;FE 照做,要改在 issue 先問):`public/play.js`,ES module、不碰 DOM:
//   createSession({ seed, side, level, options }) → session      // side:玩家那一方(0 共軍 / 1 國軍);level:bot 的等級
//   restoreSession(json) → session                                // json = session.toJSON() 走過 JSON.stringify / parse
//   session.view()       → 玩家看到的(就是 E.view(局面, side))
//   session.choices()    → [{ id, kind, label }]:玩家現在點得到的東西;輪到 bot 或對局結束時是 []
//   session.tap(id)      → 點一下。點出一個完整的引擎動作時就送進引擎,然後讓 bot 下到輪到玩家或對局結束為止
//   session.tapsFor(action) → [id, …]:要點出這個引擎動作(E.apply 吃的那個物件)要依序點哪些;點不出來回 null
//   session.lastAction() → 玩家最近一次送進引擎的動作(和 E.apply 吃的一樣)
//   session.over() / session.result() → 對局結束了沒 / { winner, reason }
//   session.toJSON()     → 存檔(重新整理頁面之後接著玩)
// 玩家的動作和 bot 的動作走同一個引擎;session 不能讓玩家點出引擎會拒絕的東西,也不能在玩家該動的時候沒有東西可點。
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { R, section, check, eq, ok, nonEmpty, summary } from "./harness.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const GAMES = Number(process.env.PLAY_GAMES || 12);
const CCP = 0, KMT = 1;
const J = (x) => JSON.stringify(x ?? null);
const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
const strip = (a) => { if (!a || typeof a !== "object") return a; const { game, why, ...rest } = a; return rest; };

let P = null, E = null, B = null, loadError = null;
try {
  E = await import(pathToFileURL(here("../public/shared/engine.js")).href);
  B = await import(pathToFileURL(here("../public/shared/bots.js")).href);
  if (existsSync(here("../public/play.js"))) P = await import(pathToFileURL(here("../public/play.js")).href);
} catch (e) { loadError = String((e && e.message) || e); }
const todo = () => (loadError ? `TODO: 載入失敗:${loadError}` : !P ? "TODO: public/play.js 還沒有(#44)" : typeof P.createSession !== "function" ? "TODO: public/play.js 沒有 createSession" : null);

// Tap until the human must act or the game is over; return the session. `pick(session, choices)` → an id.
function walk(s, pick, cap) {
  let taps = 0;
  while (!s.over()) {
    const cs = s.choices();
    if (!cs.length) throw new Error(`輪到玩家卻沒有東西可點(第 ${s.view().turn} 回合,phase ${s.view().phase})`);
    const id = pick(s, cs);
    s = s.tap(id) || s;
    if (++taps > cap) throw new Error(`點了 ${cap} 下還沒結束(第 ${s.view().turn} 回合)`);
  }
  return { s, taps };
}

section("P0 頁面的檔案");
check("public/play.js、遊戲頁、app.js 都在;遊戲頁有 viewport 與 noindex", () => {
  const t = todo(); if (t) return t;
  const page = ["game.html", "play.html", "index.html"].map((f) => here(`../public/${f}`)).find((f) => existsSync(f) && /app\.js/.test(readFileSync(f, "utf8")));
  if (!page) return "失敗:public/ 底下沒有載入 app.js 的頁面(game.html / play.html / index.html)";
  const html = readFileSync(page, "utf8");
  return ok(/name="viewport"/.test(html) && /name="robots"[^>]*noindex/.test(html) && existsSync(here("../public/app.js")), `頁面 ${page.split(/[\\/]/).pop()}:viewport ${/name="viewport"/.test(html)}、noindex ${/noindex/.test(html)}、app.js ${existsSync(here("../public/app.js"))}`);
});

section("P1 開局");
check("兩邊都能開局:第一次輪到玩家時有東西可點;玩家看到的就是 E.view(對手的手牌看不到)", () => {
  const t = todo(); if (t) return t;
  const out = [];
  for (const side of [CCP, KMT]) for (const seed of [1, 2, 3]) {
    const s = P.createSession({ seed, side, level: "normal" });
    const v = s.view();
    if (!s.over() && !s.choices().length) return `失敗:種子 ${seed}、玩家 ${side}:開局之後沒有東西可點(phase ${v.phase})`;
    const other = v.hands && v.hands[1 - side];
    const hidden = Array.isArray(other) ? other.every((c) => c == null || c === "hidden" || c === "?") : typeof other === "number" || other == null;
    if (!hidden) return `失敗:種子 ${seed}、玩家 ${side}:對手的手牌看得到:${J(other).slice(0, 80)}`;
    out.push(`${side ? "國" : "共"}${seed}:${s.choices().length} 個選項`);
  }
  return ok(true, out.join("、"));
});

section("P2 玩家點得出 bot 會下的每一步,一局玩得完");
check(`玩家那一席用普通 bot 的決定、換成點擊(tapsFor)點出來:${GAMES} 局都玩完,每一步引擎收到的就是想下的那一步`, () => {
  const t = todo(); if (t) return t;
  let games = 0, steps = 0;
  const reasons = {};
  for (let g = 0; g < GAMES; g++) {
    const seed = 101 + g, side = g % 2;
    let s = P.createSession({ seed, side, level: "normal" });
    const rng = E.makeRng(seed * 7919);
    let guard = 0;
    while (!s.over()) {
      if (++guard > 3000) return `失敗:種子 ${seed}:3000 步還沒結束`;
      const v = s.view();
      const want = strip(B.decide(v, side, "normal", rng));
      if (!want) return `失敗:種子 ${seed}:bot 對玩家那一席沒有決定(第 ${v.turn} 回合)`;
      const ids = s.tapsFor(want);
      if (!ids || !ids.length) return `失敗:種子 ${seed},第 ${v.turn} 回合:點不出 ${J(want).slice(0, 160)}`;
      for (const id of ids) {
        const cs = s.choices().map((c) => c.id);
        if (!cs.includes(id)) return `失敗:種子 ${seed},第 ${v.turn} 回合:tapsFor 給的 ${J(id)} 不在當下的選項裡(${J(cs).slice(0, 120)})`;
        s = s.tap(id) || s;
      }
      const got = strip(s.lastAction());
      if (J(canon(got)) !== J(canon(want))) return `失敗:種子 ${seed},第 ${v.turn} 回合:想下 ${J(want).slice(0, 120)},引擎收到 ${J(got).slice(0, 120)}`;
      steps++;
    }
    games++; const r = s.result(); reasons[r.reason] = (reasons[r.reason] || 0) + 1;
  }
  return all2(eq(games, GAMES, "玩完的局數"), nonEmpty(steps, "玩家下的步數"), ok(true, `${games} 局、玩家 ${steps} 步;結束方式 ${J(reasons)}`));
});

section("P3 亂點也不會卡住");
check(`玩家亂點(每次在當下的選項裡隨便點一個):${GAMES} 局都玩完,不丟錯、不卡死(每局最多點 30000 下)`, () => {
  const t = todo(); if (t) return t;
  let games = 0, taps = 0;
  for (let g = 0; g < GAMES; g++) {
    const seed = 201 + g, side = g % 2, rng = E.makeRng(seed * 104729);
    try { const r = walk(P.createSession({ seed, side, level: "normal" }), (s, cs) => cs[rng.int(cs.length)].id, 30000); games++; taps += r.taps; }
    catch (e) { return `失敗:種子 ${seed}、玩家 ${side}:${String(e && e.message).slice(0, 200)}`; }
  }
  return all2(eq(games, GAMES, "玩完的局數"), ok(true, `${games} 局、共點 ${taps} 下(平均每局 ${(taps / games).toFixed(0)})`));
});

section("P4 存檔:重新整理之後接著玩");
check("對局後段(第 4、6、7 回合)、一個動作點到一半時 toJSON → JSON → restoreSession:看到的一樣、選項一樣;兩份用同樣的點擊下到終局,每一步都一樣", () => {
  const t = todo(); if (t) return t;
  if (typeof P.restoreSession !== "function") return "TODO: public/play.js 沒有 restoreSession";
  // #44(FE 抓到的洞):原本的 P4 亂點 40 下,從來沒有離開第 1 回合,存檔漏掉後面才有的東西也看不出來。
  // 現在用普通 bot 的決定換成點擊(和 P2 一樣)把對局推到第 N 回合,在一個要點好幾下的動作點到一半時存檔。
  const out = [];
  for (const [seed, target] of [[301, 4], [302, 6], [303, 7]]) {
    const side = seed % 2, rng = E.makeRng(seed * 31);
    let s = P.createSession({ seed, side, level: "normal" });
    let saved = null, guard = 0, plan = [];
    // the taps still to do, from the bot's decision for the human seat
    const next = () => { if (!plan.length) { const ids = s.tapsFor(strip(B.decide(s.view(), side, "normal", rng))); if (!ids || !ids.length) throw new Error(`點不出 bot 的決定(第 ${s.view().turn} 回合)`); plan = ids.slice(); } return plan.shift(); };
    while (!s.over() && !saved) {
      if (++guard > 5000) return `失敗:種子 ${seed}:5000 下還沒到第 ${target} 回合`;
      const id = next();
      s = s.tap(id) || s;
      if (s.view().turn >= target && plan.length > 0) saved = JSON.parse(JSON.stringify(s.toJSON())); // 點到一半
    }
    if (!saved) return `失敗:種子 ${seed}:對局在第 ${s.view().turn} 回合就結束了,沒有在第 ${target} 回合存到檔`;
    let r = P.restoreSession(saved);
    if (J(canon(r.view())) !== J(canon(s.view()))) return `失敗:種子 ${seed}:第 ${s.view().turn} 回合存檔再讀回來,看到的不一樣`;
    if (J(r.choices().map((c) => c.id)) !== J(s.choices().map((c) => c.id))) return `失敗:種子 ${seed}:第 ${s.view().turn} 回合存檔再讀回來,選項不一樣`;
    const at = s.view().turn;
    let steps = 0;
    while (!s.over()) {
      if (++guard > 8000) return `失敗:種子 ${seed}:讀回來之後 8000 下還沒結束`;
      const id = next();
      s = s.tap(id) || s; r = r.tap(id) || r;
      steps++;
      if (J(canon(r.view())) !== J(canon(s.view()))) return `失敗:種子 ${seed}:第 ${at} 回合讀回來之後第 ${steps} 下分岔了(第 ${s.view().turn} 回合)`;
    }
    if (!r.over() || J(r.result()) !== J(s.result())) return `失敗:種子 ${seed}:讀回來的那一份沒有同樣結束(${J(r.result())} 對 ${J(s.result())})`;
    out.push(`種子 ${seed}:第 ${at} 回合存、再下 ${steps} 下到終局一樣(${s.result().reason})`);
  }
  return ok(true, out.join("、"));
});

section("P5 同一個種子、同樣的點擊 = 同一局");
check("兩個同種子的 session 點同樣的 80 下,看到的每一步都一樣(bot 也一樣;回報問題時重放得出來)", () => {
  const t = todo(); if (t) return t;
  let a = P.createSession({ seed: 401, side: CCP, level: "normal" }), b = P.createSession({ seed: 401, side: CCP, level: "normal" });
  const rng = E.makeRng(401);
  for (let i = 0; i < 80 && !a.over(); i++) {
    const cs = a.choices(); const id = cs[rng.int(cs.length)].id;
    a = a.tap(id) || a; b = b.tap(id) || b;
    if (J(canon(a.view())) !== J(canon(b.view()))) return `失敗:第 ${i + 1} 下兩局分岔了`;
  }
  return ok(true, `80 下之後第 ${a.view().turn} 回合,兩局一樣`);
});

// all() as in the other test files: the first failure, else the last pass message.
function all2(...rs) { let said = true; for (const r of rs) { if (r !== true && !(r && r.pass)) return r; if (r !== true) said = r; } return said; }

test("play: the verb of M3", () => {
  const s = summary();
  for (const p of R.pass) console.log(`通過 · ${p.label}${p.msg ? " · " + p.msg : ""}`);
  for (const t of s.todos) console.log(`尚未實作 · ${t.label} · ${t.msg}`);
  for (const f of s.failures) console.log(`失敗 · ${f.label} · ${f.msg}`);
  console.log(`PLAY-VERDICT 通過 ${s.pass} / 失敗 ${s.fail} / 尚未實作 ${s.todo}`);
  assert.equal(s.fail, 0, s.failures.map((f) => `${f.label}: ${f.msg}`).join("\n"));
});
