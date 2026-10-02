// The bot. Works from `view(state, seat)` like a human: it fills the unknown
// (the other hand, the draw pile) with a random consistent guess, lists what
// `legal()` allows, plays each candidate on the guess, answering every choice
// the play asks for by the same greedy rule, and keeps the best evaluation.
// Every decision carries a `why` for table talk (M3).
//
// Levels: easy = a random legal action (scoring cards played at once);
// normal = one ply plus noise; hard = one ply, then the other side's best
// reply on the top few, less noise.
import * as E from "./engine.js";

const { QIN, CHU, SPACES, SPACE, STATES, SCORED_REGIONS, CARD, ERA_DECKS, ERAS, JIUDING } = E;
export const LEVELS = ["easy", "normal", "hard"];

// Expected scorings of each region over a whole game, final scoring included.
const RATE = { jin: 3.0, west: 2.8, south: 2.8, east: 1.5, north: 1.5 };
// Enemy events that tire the realm when spent for ops: deadly at 民困.
const TIRING = new Set(["changping", "wangjian", "huaiwang"]);
const REFORM_PERK = [0, 0.5, 1.5, 3, 4, 6, 7];
// #121, only under a win by 稱帝: the road by box (0…5), and a card of 4 face
// ops in hand at box 5 (half of it at box 4). Box 5 is one step from the win,
// as a third 滅 or a fourth 相印 is one marker away, and weighs the same 8.
const EMPEROR_ROAD = [0, 0, 0.5, 1.5, 4, 8], EMPEROR_CARD = E.MANDATE_TO_WIN;
const NOISE = { easy: 0, normal: 0.6, hard: 0.2 };
// #130, only under homeFall: a capital is a road to a loss, like the last 滅 or
// 相印. FALL is what losing it is worth to a one-ply bot that must see it coming
// (the game scores -1000 once it happens); the road is the share of it by the
// points the enemy still lacks (0 = the enemy holds it now, which counts at the
// turn end under lose-turn / lose-majority / move; 1 = one point away ...) and
// by who acts next: the attacker (ROAD_TEMPO, it can finish), the defender
// (ROAD_DEFENCE, it can answer), or neither yet (ROAD: headlines, a pending choice).
// Under move the FIRST fall of the home capital costs MOVE_VP (and a capital
// nearer the front, which the evaluation then sees as the new road), so that
// road is MOVE_ROAD of MOVE_VP: steep, so that taking it is worth nearly the
// whole +3 to the taker rather than being credited in advance.
const FALL = 60, ROAD = [1, 0.6, 0.25, 0.1, 0.03], ROAD_TEMPO = [1, 0.9, 0.4, 0.15, 0.05], ROAD_DEFENCE = [0.5, 0.25, 0.1, 0.03, 0.01];
const MOVE_ROAD = [1, 0.3, 0.1, 0.03];
// #136: a 稱帝 the side can finish THIS TURN with its own hand (one or two of its
// actions left: a reform with a card of the next box's ops, one per advance left,
// or an event whose text reads 「變法軌前進 N」, which uses no advance) is a win
// the other side can rarely undo, unlike a capital it holds with the defender to
// act (FALL x ROAD_DEFENCE[0] = 30). Before this it scored at most box 5 + card =
// 16, so under lose-turn a capital take outranked it: at emperor.test.js's box-4
// race, seed 18, the bot spent 長平 on 郢 (17 losses in 200 playouts) instead of
// 韓非 then 長平 (200 wins). One action away it is now worth what a capital held
// by an attacker with the tempo is (FALL x ROAD_TEMPO[0] = 60). Two actions away
// (box 4 with 韓非 and 長平, or a 3-op card and 長平) keeps the old terms: the
// one-ply search already sees the first step land on the one-action position,
// so the bot climbs now; valuing the two-action position as high as well (54
// was tried) let it put the climb off for a campaign (emperor.test.js :249,
// hard seed 12, 呂不韋 campaign), with Chu to act in between.
const TRACK_EVENT = Object.fromEntries(Object.entries(CARD).flatMap(([id, c]) => {
  const m = /變法軌前進 (\d)/.exec(c.text || "");
  return m ? [[id, Number(m[1])]] : [];
}));
const EMPEROR_NEAR = FALL * ROAD_TEMPO[0];
// The fewest actions (1 or 2) in which `s` reaches box 6 this turn, or 0.
function emperorSteps(st, s) {
  if (st.phase !== "action" || st.pending || st.reform[s] < 4 || !E.emperorWins(st, s)) return 0;
  const acts = Math.min(2, st.rounds - st.round + (st.actor === QIN || s === CHU ? 1 : 0));
  const cards = st.hands[s].filter((c) => (TRACK_EVENT[c] && CARD[c].side === s) || (c !== JIUDING && !CARD[c].scoring && CARD[c].ops >= 3));
  const go = (box, adv, k, rest) => {
    if (box >= 6) return k;
    if (k >= acts) return 0;
    let best = 0;
    for (let i = 0; i < rest.length; i++) {
      const c = rest[i], others = rest.slice(0, i).concat(rest.slice(i + 1));
      let r = 0;
      if (TRACK_EVENT[c] && CARD[c].side === s) r = go(box + TRACK_EVENT[c], adv, k + 1, others);
      if (!r && adv > 0 && c !== JIUDING && !CARD[c].scoring && CARD[c].ops >= E.REFORM[box].ops) r = go(box + 1, adv - 1, k + 1, others);
      if (r && (!best || r < best)) best = r;
    }
    return best;
  };
  return go(st.reform[s], E.reformUsesLeft(st, s), 0, cards);
}
const pickOne = (arr, rng) => arr[rng.int(arr.length)];
function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng.next();
  while (v === 0) v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------- 滅國 after a restore ----------
// The engine's own condition (E.checkMarkers, owner 裁決 #119): after 田單復國
// lifts a 滅, `st.mieHold[id]` lists the spaces of that state Qin still
// controlled then; a space leaves the list once Qin loses it, and the state
// falls again only when Qin holds all of it with at least one space NOT on the
// list. So while every space of the state is on the list and still Qin's, no
// move of Qin's can destroy it: Qin must first lose one. True in exactly that
// case, for the advisor (advisor.js) and the evaluation below.
export function heldSinceRestore(st, id) {
  const held = st.mieHold && st.mieHold[id];
  if (!held || st.mie[id]) return false;
  return E.spacesOfState(id).every((x) => held.includes(x) && E.controller(st, x) === QIN);
}

// ---------- evaluation: how good is this position for `side` ----------
// `terms`, when an object is passed, collects the same number split into named
// buckets from `side`'s point of view: the advisor (advisor.js) subtracts the
// buckets before a move from the buckets after it to say *why* the move
// scored. The bookkeeping is a side channel: every `vq` line below is the same
// expression in the same order as before it existed, so the returned value is
// bit for bit what it always was, and the buckets add back up to it
// (tests/advisor.test.js pins both). Keys starting with `$` are facts for the
// advisor's `params`, not part of the sum. Called with no `terms` (every call
// inside this file) the cost is one branch per bucket.
export function evaluate(st, side, terms = null) {
  if (st.winner != null) return st.winner === side ? 1000 : -1000;
  const sign = side === QIN ? 1 : -1;
  const T = terms ? (k, x) => { terms[k] = (terms[k] || 0) + sign * x; } : null;
  const turnsLeft = Math.max(0, st.options.turns - st.turn) + (st.phase === "headline" ? 1 : 0.5);
  const frac = Math.min(1, turnsLeft / st.options.turns);
  let vq = st.mandate; // everything below is from Qin's point of view
  if (T) T("mandate", st.mandate);
  for (const r of SCORED_REGIONS) {
    const [q, c] = E.regionTally(st, r);
    const card = "score_" + r;
    let exp = RATE[r] * frac;
    const inHand = st.hands[QIN]?.includes(card) || st.hands[CHU]?.includes(card);
    if (inHand) exp += 0.8;
    const dumped = st.discard.includes(card);
    if (dumped) exp *= 0.8;
    vq += exp * (q.total - c.total);
    if (T) {
      // The one place the bookkeeping does arithmetic of its own: the region
      // term split into the control level, the battlegrounds, and the premium
      // for the scoring card being in a hand. The three add back to the term.
      const expCard = inHand ? 0.8 * (dumped ? 0.8 : 1) : 0, expBase = exp - expCard;
      T(`region:${r}:base`, expBase * (q.base - c.base));
      T(`region:${r}:bg`, expBase * (q.bonus - c.bonus));
      T(`region:${r}:card`, expCard * (q.total - c.total));
      terms[`$net:${r}`] = sign * (q.total - c.total);
    }
  }
  const mie = Object.keys(st.mie).length, seals = Object.keys(st.seals).length;
  const mieHeld = 3 * mie + (mie === st.options.mie - 1 ? 8 : 0);
  vq += mieHeld;
  if (T) T("mie", mieHeld);
  const sealsHeld = 2 * seals + (seals === st.options.seals - 1 ? 8 : 0);
  vq -= sealsHeld;
  if (T) T("seals", -sealsHeld);
  // The roads to 滅 and 相印, as points still needed; a threat grows with
  // the markers already held.
  const mieScale = 1 + 0.7 * mie, sealScale = 1 + 0.7 * seals;
  for (const [id, s] of Object.entries(STATES)) {
    const sp = E.spacesOfState(id);
    if (!st.mie[id]) {
      // A state held whole since 田單復國 lifted its 滅 cannot fall until Qin
      // first loses a space of it (heldSinceRestore above): as far as this road goes.
      const blocked = heldSinceRestore(st, id);
      let need = 0;
      for (const x of sp) { const [q, c] = E.infOf(st, x), S = SPACE[x].stability; if (q < c + S) need += c + S - q; }
      const road = mieScale * (blocked ? 0.1 : need <= 2 ? 2.5 : need <= 4 ? 1.2 : need <= 6 ? 0.5 : 0.1);
      vq += road;
      if (T) { T(`mieRoad:${id}`, road); terms[`$mieNeed:${id}`] = blocked ? null : need; }
    } else if (T) terms[`$mieNeed:${id}`] = 0;
    if (!st.seals[id]) {
      const [q, c] = E.infOf(st, s.capital), S = SPACE[s.capital].stability;
      const need = Math.max(0, q + S - c) + (st.options.sealAt === "cap" ? Math.max(0, E.capOf(st, s.capital) - Math.max(c, q + S)) : 0);
      const road = sealScale * (need <= 1 ? 1.8 : need === 2 ? 1.0 : need === 3 ? 0.5 : 0.15);
      vq -= road;
      if (T) { T(`sealRoad:${id}`, -road); terms[`$sealNeed:${id}`] = need; }
    } else if (T) terms[`$sealNeed:${id}`] = 0;
  }
  const risk = (s) => (st.weariness <= 2 ? 3 * st.hands[s].filter((c) => TIRING.has(c) && CARD[c].side !== s).length : 0);
  const tiring = risk(QIN) - risk(CHU);
  vq -= tiring;
  if (T) { T("tiring", -tiring); terms.$tiring = st.hands[side].filter((c) => TIRING.has(c) && CARD[c].side !== side).length; }
  const reformPerk = REFORM_PERK[st.reform[QIN]] - REFORM_PERK[st.reform[CHU]];
  vq += reformPerk;
  if (T) T("reform", reformPerk);
  // #121: under emperor "win" / "win-late" / "win-lead" the first to box 6
  // wins the game, so the track is a road to a win like 滅 and 相印 are: worth
  // more the closer it gets, and the 4-op card that takes the last step is
  // worth keeping. Only for a side that can still win by it (E.emperorLive:
  // box 6 open, and under win-lead only while that side leads the Mandate);
  // never under the default rule.
  const emp = st.options.emperor;
  if (emp === "win" || emp === "win-late" || emp === "win-lead") {
    const race = (s) => {
      if (!E.emperorLive(st, s)) return 0;
      if (emperorSteps(st, s) === 1) return EMPEROR_NEAR; // #136
      const box = st.reform[s];
      const card = box >= 4 && st.hands[s].some((c) => c !== JIUDING && CARD[c].ops >= 4) ? (box === 5 ? EMPEROR_CARD : EMPEROR_CARD / 2) : 0;
      return EMPEROR_ROAD[box] + card;
    };
    const road = race(QIN) - race(CHU);
    vq += road;
    if (T) T("reform", road);
  }
  const hf = st.options.homeFall;
  if (hf && hf !== "none") {
    let cap = 0;
    for (const s of [QIN, CHU]) {
      const id = E.homeCapital(st, s), [q, c] = E.infOf(st, id), own = s === QIN ? q : c, foe = s === QIN ? c : q;
      const short = hf === "lose-majority" ? Math.max(0, own - foe + 1) : Math.max(0, own + SPACE[id].stability - foe);
      const next = st.phase === "action" && !st.pending ? st.actor : null;
      const first = hf === "move" && id === E.HOME_CAPITAL[s];
      const road = first ? MOVE_ROAD : next === 1 - s ? ROAD_TEMPO : next === s ? ROAD_DEFENCE : ROAD;
      if (short >= road.length) continue;
      cap += (s === QIN ? -1 : 1) * (first ? E.MOVE_VP : FALL) * road[short];
    }
    vq += cap;
    if (T) T("capital", cap);
  }
  const enemyCards = (s) => st.hands[s].filter((c) => CARD[c].side === 1 - s).length;
  const enemyHeld = 0.4 * (enemyCards(QIN) - enemyCards(CHU));
  vq -= enemyHeld;
  if (T) { T("enemyCards", -enemyHeld); terms.$enemyCards = enemyCards(side); }
  const handSize = 0.25 * (st.hands[QIN].length - st.hands[CHU].length);
  vq += handSize;
  if (T) T("handSize", handSize);
  // A scoring card must leave the hand before the turn ends: with no action
  // left this turn it is a certain loss, with one left it is urgent.
  if (st.phase === "action") {
    for (const s of [QIN, CHU]) {
      const n = st.hands[s].filter((c) => CARD[c].scoring).length;
      if (!n) continue;
      const left = st.rounds - st.round + (st.actor === QIN || s === CHU ? 1 : 0);
      const pain = left < n ? 500 : left === n ? 8 * n : n;
      vq += (s === QIN ? -1 : 1) * pain;
      if (T) T("scoringPain", (s === QIN ? -1 : 1) * pain);
    }
  }
  if (st.luoyiYields) {
    const l = E.controller(st, "luoyi");
    if (l != null) {
      const yields = (l === QIN ? 1 : -1) * st.options.luoyi * turnsLeft * 0.8;
      vq += yields;
      if (T) T("luoyi", yields);
    }
  }
  for (const s of SPACES) {
    const [q, c] = E.infOf(st, s.id), ctl = E.controller(st, s.id);
    if (q > 0 && ctl !== QIN) { vq += 0.15; if (T) T("spread", 0.15); }
    if (c > 0 && ctl !== CHU) { vq -= 0.15; if (T) T("spread", -0.15); }
  }
  const j = st.jiuding;
  const cauldrons = (j.holder === QIN ? 1 : -1) * (j.faceDown ? 0.8 : 1.5);
  vq += cauldrons;
  if (T) T("jiuding", cauldrons);
  return side === QIN ? vq : -vq;
}

// ---------- the guess: a full state consistent with what this seat sees ----------
export function determinize(view, side, rng) {
  const st = E.clone(view);
  st.log = [];
  const opp = 1 - side;
  const known = new Set([...st.hands[side], ...st.discard, ...st.removed]);
  if (Array.isArray(st.hands[opp])) for (const c of st.hands[opp]) known.add(c);
  for (const h of st.headline) if (h && h !== "hidden") known.add(h);
  const decks = { reform: ERA_DECKS.reform.slice(), alliance: ERA_DECKS.alliance.slice(), conquest: ERA_DECKS.conquest.slice() };
  if (st.options.scoringSplit === "v2") {
    decks.reform = decks.reform.filter((c) => c !== "score_west").concat("score_east");
    decks.alliance = decks.alliance.filter((c) => c !== "score_east").concat("score_west");
  }
  const merged = ERAS.filter((e) => e.from <= Math.max(1, st.turn)).map((e) => e.id);
  let pool = E.shuffle(rng, merged.flatMap((e) => decks[e]).filter((c) => !known.has(c)));
  st.later = Object.fromEntries(ERAS.filter((e) => !merged.includes(e.id)).map((e) => [e.id, decks[e.id]]));
  if (!Array.isArray(st.hands[opp])) st.hands[opp] = pool.splice(0, st.handCounts[opp]);
  if (st.headline[opp] === "hidden") st.headline[opp] = pool.shift() ?? null;
  st.draw = pool;
  st.rngState = rng.int(2 ** 31);
  delete st.handCounts; delete st.drawCount; delete st.laterCounts;
  return st;
}

// ---------- #132: the turn-end check against a hidden hand ----------
// The turn-end check (engine endTurnChecks, rulebook): a side still holding a
// scoring card loses; both holding one is a Chu win. When `side` is the last to
// act before it -- the other side has no action left this turn, which (Qin
// acting first in a round) is Chu on the last round -- the one thing a guess of
// the hidden hand decides is whether the other side holds a scoring card, and
// one guess bet the game on it: a guess holding one made every move look like a
// win (記分2), so the bot kept its own scoring card about as often as that guess
// came up, and lost by 記分 whenever the real hand held none (#132; nn 59 : 13
// of the 記分 ends were Chu's losses).
//
// So at that decision the guess is split into the two worlds the check can see:
// the other hand WITHOUT a scoring card and WITH one, each dealt afresh from the
// same unseen cards, and every candidate is valued as the weighted sum of both,
// the weight of "with" being the chance a hand of that size drawn from those
// cards holds one (the same uniform belief `determinize` deals from). Playing
// one's scoring card then always beats keeping it: in the "with" world both win,
// in the "without" world keeping is -1000. And a move that ends the game at
// once is still weighed in both worlds, which the blunter "count a kept card as
// a loss" would not do. Returns [{ st, w }] with w > 0, or null when there is
// nothing to split (not that decision, the hand is seen, or no unseen scoring
// card could be in it). Draws from `rng` only when it splits.
// The other side's actions left this turn, `side` acting now (evaluate's count).
function othersActionsLeft(st, side) {
  return st.rounds - st.round + (side === QIN ? 1 : 0);
}
export function turnEndWorlds(view, side, st, rng) {
  if (st.phase !== "action" || st.pending || st.actor !== side) return null;
  const opp = 1 - side;
  if (Array.isArray(view.hands[opp]) || othersActionsLeft(st, side) > 0) return null;
  const h = st.hands[opp].length;
  const pool = st.hands[opp].concat(st.draw);
  const scoring = pool.filter((c) => CARD[c].scoring), plain = pool.filter((c) => !CARD[c].scoring);
  if (!h || !scoring.length) return null;
  // P(no scoring card in h cards drawn from the pool) = C(plain, h) / C(pool, h).
  let pNone = 1;
  for (let i = 0; i < h; i++) pNone *= Math.max(0, plain.length - i) / (pool.length - i);
  const deal = (hand) => {
    const s = E.clone(st);
    const rest = pool.slice();
    for (const c of hand) rest.splice(rest.indexOf(c), 1);
    s.hands[opp] = hand;
    s.draw = E.shuffle(rng, rest);
    s.rngState = rng.int(2 ** 31);
    return s;
  };
  const worlds = [];
  if (pNone > 0) worlds.push({ st: deal(E.shuffle(rng, plain).slice(0, h)), w: pNone });
  if (pNone < 1) {
    const one = pickOne(scoring, rng);
    const others = E.shuffle(rng, pool.filter((c) => c !== one)).slice(0, h - 1);
    worlds.push({ st: deal([one, ...others]), w: 1 - pNone });
  }
  return worlds;
}
// The world a reason is read from at that decision (advisor.js): the one where
// the choice matters, the other hand holding no scoring card, when it can.
export function choiceWorld(view, side, st, rng) {
  const worlds = turnEndWorlds(view, side, st, rng);
  return worlds ? worlds[0].st : st;
}

// ---------- playing a candidate out, answering what it asks ----------
export function simulate(st, action, rng) {
  let s = E.apply(st, action);
  for (let guard = 0; s.pending && s.winner == null && guard < 16; guard++) {
    const who = s.pending.who;
    s = E.apply(s, { type: "choose", side: who, choice: answer(s, s.pending, who, rng) });
  }
  return s;
}
// ---------- the ops a play will really have, for the card page ----------
// An enemy card played for its ops EVENT FIRST has its ops read after the
// event (engine.js, the "ops" step's `afterEvent`, owner 裁決 #119): 荊軻刺秦王
// played by Qin lowers its own ops. So the page cannot print `opsOf` at play
// time for that order (#122). This plays the event out on a guess of the
// hidden cards -- the event's choices answered as the bot would, since no
// event's ops effect depends on them -- and reads the ops the engine then
// asks for. Ops first, own cards, 說客's pair: `opsOf` now, as always.
// `view` is left untouched.
export function opsForOrder(view, side, card, order) {
  const now = E.opsOf(view, side, card);
  const c = CARD[card];
  if (order !== "eventFirst" || !c || c.side == null || c.side === side) return now;
  try {
    const rng = E.makeRng(0);
    let s = E.apply(determinize(view, side, rng), { type: "play", side, card, use: "place", order: "eventFirst" });
    for (let guard = 0; s.pending && s.pending.tag !== "ops" && s.winner == null && guard < 16; guard++) {
      const who = s.pending.who;
      s = E.apply(s, { type: "choose", side: who, choice: answer(s, s.pending, who, rng) });
    }
    return s.pending && s.pending.tag === "ops" && s.pending.card === card ? s.pending.ops : now;
  } catch { return now; }
}
// ---------- #130: 遊說 as a roll (lobby "realign" / "realign-mild") ----------
// One simulation of a realignment is ONE roll of the dice. Ranking candidates by
// one roll each picks the lucky ones: before this, 70 of the normal bot's 94
// 遊說 under realign (12 games) were worth more than 1 point less, over 48
// rolls, than its best other play (by 6 on average). So under realign a 遊說
// is (1) offered only where one attempt is worth something on average, the
// risk to the actor's own points counted (`realignExpect`), and (2) scored as
// the mean over DICE_K rolls. Off realign nothing here runs and no RNG is drawn.
export const DICE_K = 6, DICE_K_REPLY = 2;
function realigning(st) { return !!E.LOBBY[st.options.lobby]; }
// The mean of (enemy points removed − own points lost) for ONE attempt by
// `side` on `id` as the board stands: every pair of faces, the loss capped by
// the option and by what the loser has there.
export function realignExpect(st, side, id) {
  const o = E.realignOdds(st, side, id);
  return o ? o.net : 0;
}
function isLobby(action) { return action.type === "choose" ? !!action.choice && action.choice.use === "lobby" : action.use === "lobby"; }
function rollsFor(st, action, k = DICE_K) { return realigning(st) && isLobby(action) ? k : 1; }
// evaluate(after `action`) averaged over `k` rolls (k = 1: one simulation, as always).
function meanEval(st, action, side, rng, k) {
  if (k <= 1) return evaluate(simulate(st, action, rng), side);
  let t = 0;
  for (let i = 0; i < k; i++) t += evaluate(simulate({ ...st, rngState: rng.int(2 ** 31) }, action, rng), side);
  return t / k;
}
function evalAction(st, action, side, rng) {
  try { return meanEval(st, action, side, rng, rollsFor(st, action)); } catch { return -Infinity; }
}
function bestOf(st, who, choices, rng) {
  let best = null, bestV = -Infinity;
  for (const ch of choices) {
    let v;
    const a = { type: "choose", side: who, choice: ch };
    try { v = meanEval(st, a, who, rng, rollsFor(st, a)); } catch { continue; }
    if (v > bestV) { bestV = v; best = ch; }
  }
  return best ?? choices[0];
}
// The 遊說 targets a bot considers: all of them off realign (as always); under
// realign only those where one attempt gains on average.
function lobbyTargetsFor(st, side, targets) {
  return realigning(st) ? targets.filter((t) => realignExpect(st, side, t.id) > 0) : targets;
}

function roomFor(p, s, side, id, counts) {
  let r = Infinity;
  if (p.distinct) r = Math.min(r, 1);
  if (p.maxPer) r = Math.min(r, p.maxPer);
  if (p.maxOf) r = Math.min(r, p.maxOf[id] ?? 0);
  if (p.side != null) r = Math.min(r, E.capOf(s, id) - E.infOf(s, id)[side]);
  return r - (counts[id] || 0);
}
// Greedy per point on a scratch copy: try each option, keep the best, commit.
function bestPoints(st, p, who, rng) {
  const s = E.clone(st); s.log = [];
  const counts = {}, out = [];
  const bump = (id, d, side) => { const a = s.inf[id] || (s.inf[id] = [0, 0]); a[side] += d; };
  if (p.side === who) { // #134: an event's own points that win now (winTargets below)
    const room = (_, x, pts) => p.options.includes(x) && roomFor(p, st, who, x, { [x]: pts.filter((y) => y === x).length }) > 0;
    for (const pts of winningPoints(st, who, p.n, room, () => 1)) if (winsNow(st, { type: "choose", side: who, choice: pts })) return pts;
  }
  if (p.side != null) {
    for (let i = 0; i < p.n; i++) {
      let best = null, bestV = -Infinity;
      for (const id of p.options) {
        if (roomFor(p, s, p.side, id, counts) <= 0) continue;
        bump(id, 1, p.side); const v = evaluate(s, who); bump(id, -1, p.side);
        if (v > bestV) { bestV = v; best = id; }
      }
      if (best == null) break;
      bump(best, 1, p.side); counts[best] = (counts[best] || 0) + 1; out.push(best);
    }
    return out;
  }
  if (p.maxOf) { // lifting your own points: lose the least
    for (let i = 0; i < p.n; i++) {
      let best = null, bestV = -Infinity;
      for (const id of p.options) {
        if (roomFor(p, s, who, id, counts) <= 0) continue;
        bump(id, -1, who); const v = evaluate(s, who); bump(id, 1, who);
        if (v > bestV) { bestV = v; best = id; }
      }
      if (best == null) break;
      bump(best, -1, who); counts[best] = (counts[best] || 0) + 1; out.push(best);
    }
    return out;
  }
  if (p.n === 1) return bestOf(st, who, [...(p.min === 0 ? [[]] : []), ...p.options.map((id) => [id])], rng);
  // Several distinct picks whose meaning is "hit the enemy here" (張儀連橫).
  const scored = p.options.map((id) => { bump(id, -1, 1 - who); const v = evaluate(s, who); bump(id, 1, 1 - who); return { id, v }; });
  scored.sort((a, b) => b.v - a.v);
  return scored.slice(0, p.n).map((x) => x.id);
}

// Where to put `ops` points: greedy per point, costs and reach re-read as
// control changes (under reach "ts" the eligible set is the one at the start).
export function greedyPlacement(st, side, ops, restrict = null) {
  const s = E.clone(st); s.log = [];
  const reach = E.reachFrom(s, side);
  const points = [];
  let left = ops;
  while (left > 0) {
    let best = null, bestV = -Infinity, bestCost = 0;
    for (const sp of SPACES) {
      if (restrict && !restrict(sp.id)) continue;
      const cost = E.placeCost(s, side, sp.id);
      if (cost > left || !E.canPlaceAt(s, side, sp.id, reach) || E.infOf(s, sp.id)[side] >= E.capOf(s, sp.id)) continue;
      const a = s.inf[sp.id] || (s.inf[sp.id] = [0, 0]);
      a[side]++; const v = evaluate(s, side) - 0.01 * cost; a[side]--;
      if (v > bestV) { bestV = v; best = sp.id; bestCost = cost; }
    }
    if (best == null) break;
    (s.inf[best] || (s.inf[best] = [0, 0]))[side]++;
    points.push(best); left -= bestCost;
  }
  return points;
}
// ---------- #134: a win by placement is never missed ----------
// The one place candidate per card is the greedy walk above, and the roads to
// 滅 and 相印 in `evaluate` are steps (every need up to 2 points is worth the
// same), so the first point on the last state gains nothing there and goes
// elsewhere: before this the normal and hard bots took the last 滅 by placement
// in 0 of 12 positions and the last 相印 in 1 of 12 (tests/bots-134.test.js).
// So when one placement can end the game -- the last 滅 (Qin), the last 相印
// (Chu), the enemy home capital under homeFall "lose" (or on the turn's last
// round under the turn-end values) -- the points that complete it are offered
// as candidates too; each caller keeps only a play the engine says wins. With
// no such target nothing here runs, and no RNG is drawn either way.
function winTargets(st, side) {
  const out = [], opp = 1 - side;
  if (side === QIN && Object.keys(st.mie).length >= st.options.mie - 1) {
    for (const id of Object.keys(STATES)) if (!st.mie[id]) out.push({ ids: E.spacesOfState(id), done: (s, x) => E.controller(s, x) === QIN });
  }
  if (side === CHU && Object.keys(st.seals).length >= st.options.seals - 1) {
    const sealed = (s, x) => E.controller(s, x) === CHU && (s.options.sealAt !== "cap" || E.infOf(s, x)[CHU] >= E.capOf(s, x));
    for (const [id, s] of Object.entries(STATES)) if (!st.seals[id]) out.push({ ids: [s.capital], done: sealed });
  }
  const hf = st.options.homeFall;
  if (hf && hf !== "none" && (hf === "lose" || st.round >= st.rounds)) {
    const held = hf === "lose-majority" ? (s, x) => E.infOf(s, x)[side] > E.infOf(s, x)[opp] : (s, x) => E.controller(s, x) === side;
    out.push({ ids: [E.homeCapital(st, opp)], done: held });
  }
  return out;
}
// For each target, the fewest points that complete it: `room(s, id)` says
// whether one more point may go there, `cost(s, id)` what it spends of `budget`.
function winningPoints(st, side, budget, room, cost) {
  const out = [];
  for (const t of winTargets(st, side)) {
    const inf = {};
    for (const k of Object.keys(st.inf)) inf[k] = st.inf[k].slice();
    const s = { ...st, inf }, pts = [];
    let left = budget, ok = true;
    for (const x of t.ids) {
      while (ok && !t.done(s, x)) {
        const c = cost(s, x);
        if (c > left || !room(s, x, pts)) { ok = false; break; }
        (s.inf[x] || (s.inf[x] = [0, 0]))[side]++;
        pts.push(x); left -= c;
      }
    }
    if (ok && pts.length) out.push(pts);
  }
  return out;
}
// Placements of `ops` that complete a target; `restrict` as in greedyPlacement.
export function winningPlacements(st, side, ops, restrict = null) {
  return winningPoints(st, side, ops, (s, x) => (!restrict || restrict(x)) && E.infOf(s, x)[side] < E.capOf(s, x), (s, x) => E.placeCost(s, side, x));
}
function winsNow(st, action) {
  try { return E.apply(st, action).winner === action.side; } catch { return false; }
}
function bestOps(st, who, ops, allowed, rng) {
  const o = E.opsOptions(st, who);
  const cands = [];
  if (allowed.includes("place")) {
    const points = greedyPlacement(st, who, ops); if (points.length) cands.push({ use: "place", points });
    for (const pts of winningPlacements(st, who, ops)) cands.push({ use: "place", points: pts }); // #134
  }
  if (allowed.includes("campaign")) for (const t of o.campaignTargets) cands.push({ use: "campaign", target: t });
  if (allowed.includes("lobby")) for (const t of lobbyTargetsFor(st, who, o.lobbyTargets)) cands.push({ use: "lobby", target: t.id });
  return bestOf(st, who, cands, rng);
}
export function answer(st, p, who, rng) {
  switch (p.kind) {
    case "points": return bestPoints(st, p, who, rng);
    case "card": return bestOf(st, who, [...((p.min ?? 1) === 0 ? [[]] : []), ...p.options.map((c) => [c])], rng);
    // 收手 (realign-own): go on while the next attempt gains on average, as the
    // board stands after the last roll (the same expectation that offers a 遊說).
    case "option": if (p.tag === "realign") return realignExpect(st, who, p.target) > 0 ? "continue" : "stop";
      return bestOf(st, who, p.options.map((o) => o.id), rng);
    case "ops": return bestOps(st, who, p.ops, p.allowed, rng);
    default: throw new Error(`answer: ${p.kind}`);
  }
}

// #123 (owner: a self-collapse played with no warning, lost with a safe
// alternative sitting in hand): never offer -- to the scored bots below, or
// to the easy/random one further down -- a play that pushes weariness to 土
// 崩 against `side` right now, unless every legal play does (forced is still
// forced). `evaluate()` already scores an ended game at -1000/+1000 (win()'s
// own bookkeeping), which already pushes a losing play for normal/hard to
// the very bottom of the ranking -- but that is a strong bias, not a
// guarantee once several candidates all lose the same way, and it says
// nothing about the easy bot, which never evaluates anything. This filters
// candidates BEFORE any of that, from `E.actionWouldCollapse` (engine.js),
// the same simulate-don't-pattern-match check the card page's own warning
// uses. Above weariness 4 nothing any sided card tires by today (1, or 2
// through the one card that tires twice in a single play) can reach 土崩 (1)
// in one play, so the (cloning, simulating) check is skipped there rather
// than paid on every candidate all game.
const COLLAPSE_RISK_WEARINESS = 4;
function dropSelfCollapse(st, side, list) {
  if (list.length <= 1 || st.weariness > COLLAPSE_RISK_WEARINESS) return list;
  const safe = list.filter((a) => !E.actionWouldCollapse(st, side, a));
  return safe.length ? safe : list;
}

// ---------- candidates for an action round ----------
function actionCandidates(st, side, L) {
  const out = [];
  const lob = (targets) => lobbyTargetsFor(st, side, targets);
  // #134: a placement that wins now, next to the greedy one (winTargets above).
  const winPlace = (ops, make, restrict) => {
    for (const points of winningPlacements(st, side, ops, restrict)) { const a = make(points); if (winsNow(st, a)) out.push(a); }
  };
  if (L.bog && L.bog.length) return L.bog.map((c) => ({ type: "play", side, card: c, use: "bog" }));
  let dead = null;
  for (const c of L.cards) {
    const u = c.uses, id = c.id;
    // 說客 alone as its event does nothing (its effect is empty): a dead play,
    // offered only when nothing else is legal (#115).
    if (id === "shuoke") dead = { type: "play", side, card: id, use: "event" };
    else out.push({ type: "play", side, card: id, use: "event" });
    if (u.reform) out.push({ type: "play", side, card: id, use: "reform" });
    if (u.place) {
      const points = greedyPlacement(st, side, u.place.ops); if (points.length) out.push({ type: "play", side, card: id, use: "place", order: "opsFirst", points });
      winPlace(u.place.ops, (pts) => ({ type: "play", side, card: id, use: "place", order: "opsFirst", points: pts }));
    }
    if (u.campaign) for (const t of u.campaign.targets) out.push({ type: "play", side, card: id, use: "campaign", order: "opsFirst", target: t });
    if (u.lobby) for (const t of lob(u.lobby.targets)) out.push({ type: "play", side, card: id, use: "lobby", order: "opsFirst", target: t.id });
    if (u.enemy && (u.place || u.campaign || u.lobby)) out.push({ type: "play", side, card: id, use: "place", order: "eventFirst" });
    if (u.pair && u.pair.length) {
      const pair = u.pair.reduce((a, b) => (CARD[b].ops > CARD[a].ops ? b : a));
      const pops = E.opsOf(st, side, pair);
      const points = greedyPlacement(st, side, pops);
      if (points.length) out.push({ type: "play", side, card: id, pair, use: "place", points });
      winPlace(pops, (pts) => ({ type: "play", side, card: id, pair, use: "place", points: pts }));
      if (u.campaign) for (const t of u.campaign.targets) out.push({ type: "play", side, card: id, pair, use: "campaign", target: t });
      if (u.lobby) for (const t of lob(u.lobby.targets)) out.push({ type: "play", side, card: id, pair, use: "lobby", target: t.id });
    }
  }
  if (L.jiuding) {
    const j = L.jiuding, zhou = (id) => SPACE[id].region === "jin" || SPACE[id].region === "zhou";
    if (j.place) {
      const p4 = greedyPlacement(st, side, 4); if (p4.length) out.push({ type: "play", side, card: JIUDING, use: "place", points: p4 });
      const p5 = greedyPlacement(st, side, 5, zhou); if (p5.length && p5.every(zhou)) out.push({ type: "play", side, card: JIUDING, use: "place", points: p5 });
      winPlace(4, (pts) => ({ type: "play", side, card: JIUDING, use: "place", points: pts }));
      winPlace(5, (pts) => ({ type: "play", side, card: JIUDING, use: "place", points: pts }), zhou);
    }
    if (j.campaign) for (const t of j.campaign.targets) out.push({ type: "play", side, card: JIUDING, use: "campaign", target: t });
    if (j.lobby) for (const t of lob(j.lobby.targets)) out.push({ type: "play", side, card: JIUDING, use: "lobby", target: t.id });
  }
  if (!out.length && dead) out.push(dead);
  return dropSelfCollapse(st, side, out);
}

// The other side's best one-ply reply, from the sampled state.
function replyValue(st, action, side, rng) {
  const k = rollsFor(st, action, DICE_K_REPLY);
  if (k > 1) { let t = 0; for (let i = 0; i < k; i++) t += replyOnce({ ...st, rngState: rng.int(2 ** 31) }, action, side, rng); return t / k; }
  return replyOnce(st, action, side, rng);
}
function replyOnce(st, action, side, rng) {
  let s;
  try { s = simulate(st, action, rng); } catch { return -Infinity; }
  if (s.winner != null) return evaluate(s, side);
  const opp = 1 - side;
  if (s.phase !== "action" || s.actor !== opp || s.pending) return evaluate(s, side);
  const L = E.legal(s, opp);
  if (L.kind !== "action") return evaluate(s, side);
  let worst = Infinity;
  for (const b of actionCandidates(s, opp, L)) {
    let v;
    try { v = meanEval(s, b, side, rng, rollsFor(s, b, DICE_K_REPLY)); } catch { continue; }
    if (v < worst) worst = v;
  }
  return worst === Infinity ? evaluate(s, side) : worst;
}

// Headline: average over a few guesses of the other hand and headline.
function bestHeadline(view, side, cards, rng, level) {
  const K = level === "hard" ? 10 : 5;
  let best = null, bestV = -Infinity;
  for (const card of cards) {
    let total = 0, n = 0;
    for (let k = 0; k < K; k++) {
      const st = determinize(view, side, rng);
      const opp = 1 - side;
      let theirs = st.headline[opp];
      if (theirs == null) {
        const hand = st.hands[opp].filter((c) => c !== JIUDING);
        if (!hand.length) continue;
        theirs = rng.next() < 0.5 ? hand.reduce((a, b) => (CARD[b].ops > CARD[a].ops ? b : a)) : pickOne(hand, rng);
      }
      try {
        let s = E.apply(st, { type: "headline", side, card });
        if (s.headline[opp] == null) s = E.apply(s, { type: "headline", side: opp, card: theirs });
        for (let guard = 0; s.pending && s.winner == null && guard < 16; guard++) {
          const who = s.pending.who;
          s = E.apply(s, { type: "choose", side: who, choice: answer(s, s.pending, who, rng) });
        }
        total += evaluate(s, side); n++;
      } catch { /* an unplayable guess; skip it */ }
    }
    const v = n ? total / n : -Infinity;
    if (v > bestV) { bestV = v; best = card; }
  }
  return best ?? cards[0];
}

// ---------- random play (easy, and the fuzz driver) ----------
export function randomPoints(st, side, ops, rng) {
  const trial = E.clone(st); trial.log = [];
  const reach = E.reachFrom(trial, side);
  const points = [];
  let left = ops;
  for (let i = 0; i < ops; i++) {
    const cands = SPACES.filter((s) => E.canPlaceAt(trial, side, s.id, reach) && E.infOf(trial, s.id)[side] < E.capOf(trial, s.id) && E.placeCost(trial, side, s.id) <= left);
    if (!cands.length) break;
    const id = pickOne(cands, rng).id;
    left -= E.placeCost(trial, side, id);
    E.place(trial, side, id, 1);
    points.push(id);
    if (left <= 0) break;
  }
  return points;
}
export function randomOps(st, side, ops, allowed, rng) {
  const o = E.opsOptions(st, side);
  const uses = allowed.filter((u) => (u === "place" ? o.placeOptions.length : u === "campaign" ? o.campaignTargets.length : o.lobbyTargets.length) > 0);
  if (!uses.length) return null;
  const use = pickOne(uses, rng);
  if (use === "place") return { use, points: randomPoints(st, side, ops, rng) };
  if (use === "campaign") return { use, target: pickOne(o.campaignTargets, rng) };
  return { use, target: pickOne(o.lobbyTargets, rng).id };
}
export function randomChoice(st, p, rng) {
  switch (p.kind) {
    case "points": {
      const n = p.min + (p.n > p.min ? rng.int(p.n - p.min + 1) : 0);
      const counts = {}, out = [];
      for (let i = 0; i < n; i++) {
        const cands = p.options.filter((id) => roomFor(p, st, p.side, id, counts) > 0);
        if (!cands.length) break;
        const id = pickOne(cands, rng);
        counts[id] = (counts[id] || 0) + 1; out.push(id);
      }
      return out;
    }
    case "card": {
      const min = p.min ?? 1, max = p.n ?? 1;
      const n = min + (max > min ? rng.int(max - min + 1) : 0);
      const pool = p.options.slice(), out = [];
      while (out.length < n && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]);
      return out;
    }
    case "option": return pickOne(p.options, rng).id;
    case "ops": return randomOps(st, p.who, p.ops, p.allowed, rng);
    default: throw new Error(`randomChoice: ${p.kind}`);
  }
}
export function randomAction(st, side, rng) {
  const L = E.legal(st, side);
  switch (L.kind) {
    case "pending": return { type: "choose", side, choice: randomChoice(st, L.pending, rng) };
    case "headline": return { type: "headline", side, card: pickOne(L.cards, rng) };
    case "action": {
      if (L.bog && L.bog.length) return { type: "play", side, card: pickOne(L.bog, rng), use: "bog" };
      const scoring = L.cards.find((c) => CARD[c.id].scoring);
      if (scoring) return { type: "play", side, card: scoring.id, use: "event" };
      const opts = [];
      // 說客 alone as its event is a dead play (#115): only when nothing else is legal.
      const dead = L.cards.some((c) => c.id === "shuoke") ? { type: "play", side, card: "shuoke", use: "event" } : null;
      for (const c of L.cards) {
        const u = c.uses;
        if (c.id !== "shuoke") opts.push({ type: "play", side, card: c.id, use: "event" });
        if (u.reform) opts.push({ type: "play", side, card: c.id, use: "reform" });
        const order = () => (u.enemy ? (rng.next() < 0.5 ? "eventFirst" : "opsFirst") : undefined);
        if (u.place) opts.push(() => { const o = order(); return { type: "play", side, card: c.id, use: "place", order: o, points: o === "eventFirst" ? undefined : randomPoints(st, side, u.place.ops, rng) }; });
        if (u.campaign) opts.push(() => ({ type: "play", side, card: c.id, use: "campaign", order: order(), target: pickOne(u.campaign.targets, rng) }));
        if (u.lobby) opts.push(() => ({ type: "play", side, card: c.id, use: "lobby", order: order(), target: pickOne(u.lobby.targets, rng).id }));
        if (u.pair && u.pair.length) opts.push(() => {
          const pair = pickOne(u.pair, rng);
          const ops = randomOps(st, side, E.opsOf(st, side, pair), ["place", "campaign", "lobby"], rng);
          return ops ? { type: "play", side, card: c.id, pair, ...ops } : null;
        });
      }
      if (L.jiuding) {
        const j = L.jiuding;
        if (j.place) opts.push(() => ({ type: "play", side, card: JIUDING, use: "place", points: randomPoints(st, side, 4, rng) }));
        if (j.campaign) opts.push(() => ({ type: "play", side, card: JIUDING, use: "campaign", target: pickOne(j.campaign.targets, rng) }));
        if (j.lobby) opts.push(() => ({ type: "play", side, card: JIUDING, use: "lobby", target: pickOne(j.lobby.targets, rng).id }));
      }
      // A pair with no ops to spend comes back null: draw again from the rest.
      // #123: same rejection for a play that would collapse the realm on
      // this side right now (dropSelfCollapse's own comment, above) -- easy
      // is pure random with no evaluation at all, so it is the level most
      // likely to walk into one with a safe card sitting right next to it.
      const riskGate = st.weariness <= COLLAPSE_RISK_WEARINESS;
      while (opts.length) {
        const i = rng.int(opts.length), o = opts[i];
        const a = typeof o === "function" ? o() : o;
        if (a && (!riskGate || !E.actionWouldCollapse(st, side, a))) return a;
        opts.splice(i, 1);
      }
      return dead;
    }
    default: return null;
  }
}

// Every candidate with its value, best first: for tests, debugging and hints.
export function scoreCandidates(view, side, rng, level = "normal") {
  const st = determinize(view, side, rng);
  const L = E.legal(st, side);
  if (L.kind !== "action") return [];
  const worlds = turnEndWorlds(view, side, st, rng);
  return actionCandidates(st, side, L).map((a) => ({ a, v: inWorlds(worlds, st, (s) => evalAction(s, a, side, rng)) })).sort((x, y) => y.v - x.v);
}
// A value on the guess, or (#132, turnEndWorlds) the weighted sum over its worlds.
function inWorlds(worlds, st, f) {
  if (!worlds) return f(st);
  let t = 0;
  for (const { st: s, w } of worlds) t += w * f(s);
  return t;
}

// #134: several plays can win on the one guess the bot scored, and the noise
// picked among them -- a 遊說 that won on its 6 rolls, or an event that won
// against the guessed hand -- when another won for certain (7 decisions in 200
// normal games, realign-own + lose-turn, after the placement fix above). So
// every play that won on the guess is played again on WIN_CHECK fresh guesses
// with fresh rolls, and the one that wins most often is taken (the scored
// order breaks ties). The RNG is derived from the guess, not drawn from the
// bot's, and nothing here runs without a win on the guess. At #132's turn-end
// decision "a win on the guess" means a win in BOTH worlds (the weighted value
// is 1000 only then); the fresh guesses are dealt by `determinize`, the same
// uniform belief the worlds are weighted by, so they rank those plays by the
// same odds and never re-admit a play that loses in one world.
const WIN_CHECK = 6;
function surestWin(view, side, st, wins) {
  if (!wins.length) return null;
  const r = E.makeRng((st.rngState ^ 0x5bd1e995) >>> 0);
  let best = null, bestN = -1;
  for (const w of wins) {
    let n = 0;
    for (let k = 0; k < WIN_CHECK; k++) {
      try { if (simulate(determinize(view, side, r), w.a, r).winner === side) n++; } catch { /* not a win on that guess */ }
    }
    if (n > bestN) { bestN = n; best = w.a; }
    if (n === WIN_CHECK) break;
  }
  return best;
}

// ---------- the decision ----------
export function decide(view, side, level = "normal", rng) {
  if (level === "easy") { const a = randomAction(view, side, rng); if (a) a.why = "random"; return a; }
  const st = determinize(view, side, rng);
  const L = E.legal(st, side);
  const noise = NOISE[level] ?? 0.6;
  switch (L.kind) {
    case "pending": return { type: "choose", side, choice: answer(st, L.pending, side, rng), why: L.pending.kind };
    case "headline": return { type: "headline", side, card: bestHeadline(view, side, L.cards, rng, level), why: "headline" };
    case "action": {
      const cands = actionCandidates(st, side, L);
      if (!cands.length) return null;
      // #132: at the last action before the turn-end check, over both worlds of the hidden hand.
      const worlds = turnEndWorlds(view, side, st, rng);
      const scored = cands.map((a) => { const raw = inWorlds(worlds, st, (s) => evalAction(s, a, side, rng)); return { a, raw, v: raw + noise * gauss(rng) }; });
      scored.sort((x, y) => y.v - x.v);
      // #134: a win in every world scored (the weighted sum of 1000s may round a hair below 1000).
      const sure = surestWin(view, side, st, scored.filter((x) => x.raw >= 1000 - 1e-6));
      if (sure) { sure.why = `${sure.use}:${sure.card}`; return sure; }
      let top = scored.slice(0, level === "hard" ? 4 : 1);
      if (level === "hard" && top.length > 1) {
        for (const t of top) t.v = inWorlds(worlds, st, (s) => replyValue(s, t.a, side, rng)) + noise * gauss(rng);
        top.sort((x, y) => y.v - x.v);
      }
      const a = top[0].a;
      a.why = `${a.use}:${a.card}`;
      return a;
    }
    default: return null;
  }
}
