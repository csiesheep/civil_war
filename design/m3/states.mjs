// design/m3/states.mjs -- the four game states the mockups are drawn from.
//
//   node design/m3/states.mjs            plays SEEDS (below) and writes state-a..d.json next to this file
//   node design/m3/states.mjs --scan 60  prints, for seeds 1..60, what each moment would be (how the seeds were picked)
//   node design/m3/states.mjs --one 27   the same for one seed
//
// A default-rules game (E.createGame(seed), nothing in the options), normal bot against normal bot, the
// engine and bots straight from public/shared/. Each file is { meta, view, legal }:
//   view  = E.view(st, side), exactly what the real page will be handed, for the side the player is;
//   legal = E.legal(st, side), the options the page shows (the engine's, not the page's own idea);
//   meta  = what the mockup needs that is not in the view: which side the viewer is, which card the
//           player "has tapped" in A (a choice of this script, not of the engine), the moment's name.
// Nothing here is hand-written game data: change SEEDS and every page redraws from another game.
import * as E from "../../public/shared/engine.js";
import * as B from "../../public/shared/bots.js";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// A, C and D come from one game (seed 27: turn 5 has 5 孤城 and a 圍城 marker, and it ends on 民心 in turn 8).
// B comes from seed 34: in the normal-vs-normal games scanned (seeds 1..140) 增援 is on offer to the Nationalists
// in 4 of them (a city of theirs in supply, next to the target: seeds 25, 34, 78, 126, never twice in a game), always
// in turn 3 or 4. Seed 34 (turn 4, Beiping, 固守 / 增援 / 突圍 all offered) is used; it ends in turn 5, hence A, C, D from 27.
export const SEEDS = { A: 27, B: 34, C: 27, D: 27 };
const HERE = dirname(fileURLToPath(import.meta.url));

// Plays one game; calls `visit(st, side, step)` before each action. `visit` may return "stop".
function play(seed, visit) {
  let st = E.createGame(seed);
  const rng = [E.makeRng(seed * 7 + 1), E.makeRng(seed * 7 + 2)];
  let n = 0;
  while (st.winner == null && n < 5000) {
    const side = E.mustAct(st)[0];
    if (visit(st, side, n) === "stop") return st;
    st = E.apply(st, B.decide(E.view(st, side), side, "normal", rng[side]));
    n++;
  }
  visit(st, null, n);
  return st;
}

// How rich a card is for the mockup: the more uses it has, the more of the action panel is on show.
const useCount = (c) => ["event", "place", "campaign", "lobby", "reform"].filter((u) => c.uses[u]).length;

function findMoments(seed) {
  const m = { A: null, B: null, C: null, D: null };
  let aScore = -1;
  const end = play(seed, (st, side) => {
    if (side == null) return;
    // A: a Communist action round in turn 5 with a full-ish hand (the first rounds); the board with the most
    // going on (孤城, 圍城) and the card with the most uses win.
    if (st.turn === 5 && side === E.CCP && st.phase === "action" && !st.pending && st.hands[side].length >= 6) {
      const L = E.legal(st, side);
      if (L.kind === "action" && L.cards.length) {
        const iso = E.isolatedCities(st).length, bes = (st.effects || []).filter((e) => e.kind === "siege").length;
        const card = L.cards.slice().sort((a, b) => useCount(b) - useCount(a) || b.ops - a.ops)[0];
        const score = Math.min(iso, 3) * 2 + bes * 4 + useCount(card) + (card.uses.campaign ? 3 : 0) + (card.uses.reform ? 1 : 0) + st.hands[side].length;
        if (score > aScore) { aScore = score; m.A = { view: E.view(st, side), legal: L, card: card.id, round: st.round, side }; }
      }
    }
    // B: the Nationalists asked how to answer an attack, with 固守, 增援 and 突圍 all on offer (the one with most options).
    if (side === E.KMT && st.pending && st.pending.tag === "siege" && st.turn >= 2) {
      const ids = st.pending.options.map((o) => o.id);
      if (ids.some((i) => i.startsWith("reinforce")) && ids.some((i) => i.startsWith("breakout")) && (!m.B || ids.length > m.B.view.pending.options.length))
        m.B = { view: E.view(st, side), legal: E.legal(st, side), side };
    }
    // C: the first moment of turn 6 (the state right after turn 5's 結算); its log holds turn 5.
    if (!m.C && st.turn === 6 && st.phase === "headline") m.C = { view: E.view(st, E.CCP), legal: E.legal(st, E.CCP), side: E.CCP, summaryTurn: 5 };
  });
  m.D = { view: E.view(end, E.CCP), legal: E.legal(end, E.CCP), side: E.CCP };
  return m;
}

function describe(seed) {
  const m = findMoments(seed);
  const a = m.A && m.A.view;
  return {
    seed,
    A: a ? `r${m.A.round} hand ${a.hands[0].length} iso ${E.isolatedCities(a).length} bes ${(a.effects || []).filter((e) => e.kind === "siege").length} card ${m.A.card}` : "-",
    B: m.B ? `t${m.B.view.turn} ${m.B.view.pending.target} ${m.B.view.pending.options.length} opts` : "-",
    C: m.C ? "ok" : "-",
    D: `${m.D.view.winner === 0 ? "ccp" : "kmt"} ${m.D.view.reason} t${m.D.view.turn}`,
  };
}

if (process.argv[2] === "--one") {
  console.log(JSON.stringify(describe(+process.argv[3])));
} else if (process.argv[2] === "--scan") {
  for (let s = 1; s <= (+process.argv[3] || 30); s++) console.log(JSON.stringify(describe(s)));
} else {
  const games = {};
  const names = { A: "state-a", B: "state-b", C: "state-c", D: "state-d" };
  for (const k of Object.keys(names)) {
    const seed = SEEDS[k];
    const m = (games[seed] ||= findMoments(seed));
    if (!m[k]) throw new Error(`seed ${seed} has no moment ${k}; run --scan`);
    const { view, legal, card, ...rest } = m[k];
    const meta = { seed, moment: k, ...rest, ...(card ? { selectedCard: card } : {}) };
    writeFileSync(join(HERE, names[k] + ".json"), JSON.stringify({ meta, view, legal }, null, 1) + "\n");
    console.log(k, "seed", seed);
  }
}
