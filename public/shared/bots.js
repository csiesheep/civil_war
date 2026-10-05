// The bot (M2, #12). Works from `view(state, seat)` like a human: it fills the
// unknown (the other hand, the draw pile, the eras not yet shuffled in) with a
// random guess consistent with what this seat sees (`determinize`), lists what
// `legal()` allows (`placeTargets` point by point for a 扶植), plays each
// candidate on the guess (`simulate`), answering every choice the play asks for
// by the same rule, and keeps the best evaluation (`evaluate`). Every decision
// carries a `why` for table talk (M3).
//
// Levels: easy = the random player (random.js; scoring cards played at once);
// normal = one ply plus noise; hard = one ply, then the other side's best reply
// on the top few, less noise.
//
// The skeleton is Zongheng's bot (csiesheep/zongheng at 686b439); the
// evaluation, the candidates, the guess and the answers are this game's:
//   - the five scoring regions, valued by how often each is still to score
//     (its scoring card in a hand now, the eras' decks to come, the final
//     scoring); base areas count as 要衝 through `E.regionTally`;
//   - the roads to 易幟 (3 at once wins) and 整編 (5 at once wins), the reform
//     track to box 6, 遷都 (陝北 -> 太行, 南京 -> 廣州);
//   - supply: a 孤城 loses blue at the turn's end and takes no 扶植 (two terms,
//     zero when `options.supply` is off);
//   - the aid cards are candidates of an action round (`legal().aid`), and the
//     support tracks that set their ops are worth something;
//   - each side has its own number of action rounds (`st.rounds[side]`): a
//     side holding as many scoring cards as it has rounds left must play one
//     now (`actionsLeft`). The simulation does not show the loss when the other
//     side still acts after this side's last round, so the evaluation counts.
//
// The bot never catches the engine's refusal of its own candidates: a candidate
// the engine refuses while the bot thinks is a bug of the candidate lists, and
// it surfaces as an exception, not as a quietly dropped option.
import * as E from "./engine.js";
import { randomAction, randomPoints, randomOps, randomChoice } from "./random.js";

const { CCP, KMT, SPACES, SPACE, STATES, SCORED_REGIONS, CARD, ERA_DECKS, ERAS } = E;
export const LEVELS = ["easy", "normal", "hard"];
const NOISE = { easy: 0, normal: 0.6, hard: 0.2 };
const pickOne = (arr, rng) => arr[rng.int(arr.length)];
function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng.next();
  while (v === 0) v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const hand = (st, s) => st.hands[s] || [];
// Mechanism B (#26, the option `mechanismB`): the bot does not know it yet (the
// next issue teaches it). It only keeps its plays legal: an attack on a city
// that must name a plan is offered once per plan, each scored like any
// candidate; a hidden plan in its guess is drawn at random (`determinize`); a
// 撤 is spread where there is room (`withdrawPoints`). Off B, a target is just itself.
const attacks = (st, side, target) => (E.siegeNeeded(st, side, target) ? E.SIEGE_PLANS.map((siege) => ({ target, siege })) : [{ target }]);
const inNortheast = (id) => SPACE[id].region === "northeast";
const isCity = (id) => SPACE[id].kind === "city";

// ---------- the action rounds a side has left ----------
// `side`'s OWN action rounds still to come this turn, the one it is in now
// included when it has not played yet. The Communists act first in each round,
// the two alternate, and the side with more rounds takes the rest last
// (engine `endAction`): with the Communists to act in round r, the
// Nationalists still have their round r; with the Nationalists to act, the
// Communists' next is round r + 1. A play in progress (a choice pending before
// its `endAction`) has used its round. In the headline phase the headline is
// one more play. 0 outside the headline and the action phase.
export function actionsLeft(st, side) {
  const R = st.rounds;
  if (!Array.isArray(R) || st.winner != null) return 0;
  if (st.phase === "headline") return R[side] + (st.headline[side] == null ? 1 : 0);
  if (st.phase !== "action") return 0;
  if (st.plan.some((p) => p.do === "endTurn")) return 0;
  let n = R[side] - st.round + (st.actor === side || side === KMT ? 1 : 0);
  if (st.actor === side && st.plan.some((p) => p.do === "endAction")) n--;
  return Math.max(0, n);
}

// ---------- evaluation: how good is this position for `side` ----------
// (#24: the bot does not read the engine's MANDATE_WIN / MANDATE_FROM /
// MANDATE_CAP; P10 was measured in #23 with this bot, which sees the mandate
// only as the engine clamps it and declares a win.)
// Everything is in 民心 points (MANDATE_TO_WIN = 20 wins), from the
// Communists' point of view (`vq`), turned to `side`'s at the end. `terms`,
// when an object is passed, collects the same number split into named buckets
// from `side`'s point of view (for debugging and the handover's table).
//
// Region scorings still to come. GAMMA discounts a scoring one turn further
// away (the board will have moved by then). DEAL is the chance that a given
// scoring card turns up in one turn's deal, by the era of that turn and the
// deck the card came in with: the three fronts of 1946 are in the first era's
// deck of 24 and come round most turns; the Northwest's and the Rear's arrive
// with the second era; every era added thins them out.
const GAMMA = 0.8;
const DEAL = { takeover: { takeover: 0.75 }, turning: { takeover: 0.45, turning: 0.5 }, decisive: { takeover: 0.35, turning: 0.35 } };
const W = {
  // 易幟 (the Communists) and 整編 (the Nationalists): per marker held, besides
  // the road to the instant win (`markerRoad`); a marker can be lifted again.
  mieHeld: 1, sealHeld: 1,
  // the reform track: the value of standing in box 0..6 (its perks, the first
  // to box 6); EMPEROR_ROAD / EMPEROR_CARD under a win by box 6 (win-lead).
  reformPerk: [0, 0.5, 1.5, 3, 4, 6, 7],
  // a card of the other side in hand (its event goes to the other side when
  // played); any card in hand (choice).
  enemyCard: 0.4, handCard: 0.25,
  // influence in a space one does not control: a foothold.
  spread: 0.15,
  // holding scoring cards (more than the rounds left is a loss, `stuckLoser`):
  // URGENT per card when exactly as many, HOLD per card otherwise.
  urgent: 8, hold: 1,
  // supply (zero when options.supply is off): per blue point a 孤城 is
  // expected to lose (this turn's attrition, then STAY per further turn that
  // it stays cut off), and per 孤城 for the 扶植 it may not take (the 要衝 and
  // the five seats count CUT_KEY times; the airlift of 美援 takes AIRLIFT off).
  attrition: 1.0, stay: 0.6, cut: 1.5, cutKey: 1.5, airlift: 0.4,
  // a level of support: the aid card's ops next turns (per discounted turn
  // left), and the smaller things a track does without the aid cards; 美軍駐華.
  support: 0.4, supplyNoAid: 0.1, garrison: 1.0,
  // an action round more than the other side this turn.
  tempo: 0.5,
};
const EMPEROR_ROAD = [0, 0, 0.5, 1.5, 4, 8], EMPEROR_CARD = E.MANDATE_TO_WIN;
// #130 / Zongheng: a capital is a road to a loss (homeFall). FALL is what
// losing it is worth to a one-ply bot that must see it coming; the road is the
// share of it by the points the enemy still lacks and by who acts next. Under
// 遷都 ("move") the FIRST fall of the home capital costs MOVE_VP.
const FALL = 60, ROAD = [1, 0.6, 0.25, 0.1, 0.03], ROAD_TEMPO = [1, 0.9, 0.4, 0.15, 0.05], ROAD_DEFENCE = [0.5, 0.25, 0.1, 0.03, 0.01];
const MOVE_ROAD = [1, 0.3, 0.1, 0.03];

// The road to an instant win by markers (3 易幟 for the Communists, 5 整編 for
// the Nationalists; a marker is taken the moment its condition holds): `needs`
// is the points still missing per power without a marker, `k` how many more
// markers win. P = the points of the cheapest k. Worth MARK_WIN times a share
// that falls with P, steeper when the side itself acts next (it can finish:
// one card of 4 ops or an event like 軍事整編會議 covers several powers at
// once), shallower when the other side acts next (it can answer), between the
// two when neither acts yet. Past the table, MARK_STEP per point under
// MARK_HORIZON keeps the long road worth walking.
const MARK_WIN = 60, MARK_HORIZON = 12, MARK_STEP = 0.3;
// A side brings P down by about 3 to 4 an action (cards of 2 to 4 ops, 美援 at
// 4, 軍事整編會議's five points), so the table reaches two or three actions out.
const MARK_TEMPO = [1, 0.95, 0.9, 0.8, 0.65, 0.5, 0.38, 0.28, 0.2, 0.14, 0.09, 0.06, 0.04];
const MARK_DEFENCE = [1, 0.6, 0.5, 0.4, 0.32, 0.25, 0.19, 0.14, 0.1, 0.07, 0.05, 0.03, 0.02];
const MARK_EITHER = [1, 0.8, 0.7, 0.6, 0.48, 0.37, 0.28, 0.21, 0.15, 0.1, 0.07, 0.05, 0.03];
// #23 round four (orchestrator 裁決: the bot may learn the tuning rules, read only when their option is
// set): `forced` are the needs of powers the win must include (`mieNeeds`), and `soon` false means the
// win cannot come this turn (`sealPerTurn`: more markers missing than may go down this turn), so only
// the long road counts (`E.sealWinSoon`). #24 (P10 is the rules): `sealPerTurn: 1` and `sealNeeds:
// "all"` are keys of DEFAULT_OPTIONS, so in a game created since, both readings are on by default;
// `mieNeeds` is still only a tuning option.
function markerRoad(st, side, needs, k, forced = [], soon = true) {
  if (k <= 0) return MARK_WIN;
  if (needs.length + forced.length < k) return 0;
  const P = forced.reduce((t, x) => t + x, 0) + needs.slice().sort((a, b) => a - b).slice(0, Math.max(0, k - forced.length)).reduce((t, x) => t + x, 0);
  if (!soon) return MARK_STEP * Math.max(0, MARK_HORIZON - P);
  const next = st.phase === "action" && !st.pending ? st.actor : null;
  const share = next === side ? MARK_TEMPO : next === 1 - side ? MARK_DEFENCE : MARK_EITHER;
  return MARK_WIN * (P < share.length ? share[P] : 0) + MARK_STEP * Math.max(0, MARK_HORIZON - P);
}

// The scoring card of a region, and the deck it came in with.
const SCORING = Object.fromEntries(SCORED_REGIONS.map((r) => {
  const id = Object.keys(CARD).find((c) => CARD[c].scoring === r);
  return [r, { id, deck: CARD[id].era }];
}));
const futureMemo = new Map();
// Scorings of a card of `deck` after turn `turn`: the turns to come, then the final scoring.
function futureScorings(turn, turns, deck) {
  const key = `${turn}/${turns}/${deck}`;
  let v = futureMemo.get(key);
  if (v == null) {
    v = 0;
    for (let t = turn + 1; t <= turns; t++) v += GAMMA ** (t - turn) * (DEAL[E.eraOf(t).id][deck] || 0);
    v += GAMMA ** Math.max(0, turns - turn);
    futureMemo.set(key, v);
  }
  return v;
}
function discountedTurns(turn, turns) { let v = 0; for (let t = turn + 1; t <= turns; t++) v += GAMMA ** (t - turn); return v; }
// How many times region `r` is still to score, as the bot expects it: once more
// this turn when its card is in a hand (or a headline not yet resolved), else
// none this turn once the hands are dealt; then the turns to come.
function regionWeight(st, r) {
  const { id, deck } = SCORING[r], turn = Math.max(1, st.turn), turns = st.options.turns;
  let now = 0;
  if (st.phase === "headline" || st.phase === "action") {
    if (hand(st, CCP).includes(id) || hand(st, KMT).includes(id) || st.headline.includes(id)) now = 1;
  } else if (st.phase !== "over") now = DEAL[E.eraOf(turn).id][deck] || 0;
  return now + futureScorings(turn, turns, deck);
}

// The fewest actions (1 or 2) in which `s` reaches box 6 this turn, or 0
// (Zongheng #136). An event that moves a track (「…軌前進 N」: the side's own
// card, or a neutral one, played by it) uses no advance; a reform needs a card
// of the next box's ops.
const TRACK_EVENT = Object.fromEntries(Object.entries(CARD).flatMap(([id, c]) => {
  const m = /(?:變法|行憲|建軍)軌前進 (\d)/.exec(c.text || "");
  return m ? [[id, Number(m[1])]] : [];
}));
const EMPEROR_NEAR = FALL * ROAD_TEMPO[0];
function emperorSteps(st, s) {
  if (st.phase !== "action" || st.pending || st.reform[s] < 4 || !E.emperorWins(st, s)) return 0;
  const acts = Math.min(2, actionsLeft(st, s));
  const ownEvent = (c) => TRACK_EVENT[c] && (CARD[c].side === s || CARD[c].side == null);
  const cards = hand(st, s).filter((c) => ownEvent(c) || (!CARD[c].scoring && CARD[c].ops >= 3));
  const go = (box, adv, k, rest) => {
    if (box >= 6) return k;
    if (k >= acts) return 0;
    let best = 0;
    for (let i = 0; i < rest.length; i++) {
      const c = rest[i], others = rest.slice(0, i).concat(rest.slice(i + 1));
      let r = 0;
      if (ownEvent(c)) r = go(box + TRACK_EVENT[c], adv, k + 1, others);
      if (!r && adv > 0 && !CARD[c].scoring && CARD[c].ops >= E.REFORM[box].ops) r = go(box + 1, adv - 1, k + 1, others);
      if (r && (!best || r < best)) best = r;
    }
    return best;
  };
  return go(st.reform[s], E.reformUsesLeft(st, s), 0, cards);
}

// The side that has lost already by its scoring cards: more in hand than its
// own action rounds left means one is still in hand at the turn's end (engine
// `endTurnChecks`); both: the Nationalists win (scoringBoth). null otherwise.
// This is the count the simulation does not show when the other side still
// acts after this side's last round.
function stuckLoser(st) {
  if (st.phase !== "action" && st.phase !== "headline") return null;
  const over = (s) => hand(st, s).filter((c) => CARD[c].scoring).length > actionsLeft(st, s);
  return over(CCP) ? CCP : over(KMT) ? KMT : null;
}

// A loss by a held scoring card ranks below every other loss (orchestrator
// 裁決 #12): it is certain by rule, while any other lost line is a loss on the
// board that the other side still has to play out and that the guess may have
// wrong. So with as many scoring cards as rounds left, the bot plays one even
// when that too evaluates as lost. The gap (100) is far above the noise.
const HELD_LOSS = 1100;
export function evaluate(st, side, terms = null) {
  if (st.winner != null) {
    const held = st.reason === "scoring" || st.reason === "scoringBoth";
    const v = held ? HELD_LOSS : 1000;
    return st.winner === side ? v : -v;
  }
  const lost = stuckLoser(st);
  if (lost != null) {
    // The board still counts a hundredth: a side answering a choice while the
    // other is stuck must not become indifferent (seed 23: the Nationalists,
    // simulated knowing the Communists' hand, stopped defending 蘭州, and the
    // Communists chose a 「win」 that the real Nationalists, who do not see
    // that hand, then blocked).
    const v = HELD_LOSS + 0.01 * boardValue(st, lost === side ? 1 - side : side);
    if (terms) terms.scoringStuck = lost === side ? -v : v;
    return lost === side ? -v : v;
  }
  return boardValue(st, side, terms);
}
function boardValue(st, side, terms = null) {
  const sign = side === CCP ? 1 : -1;
  const T = terms ? (k, x) => { terms[k] = (terms[k] || 0) + sign * x; } : null;
  const turn = Math.max(1, st.turn), turns = st.options.turns;
  let vq = st.mandate; // everything below is from the Communists' point of view
  if (T) T("mandate", st.mandate);

  // The five regions: each point of difference, times the scorings still to come.
  for (const r of SCORED_REGIONS) {
    const [q, c] = E.regionTally(st, r);
    const v = regionWeight(st, r) * (q.total - c.total);
    vq += v;
    if (T) T(`region:${r}`, v);
  }

  // 易幟 and 整編: the markers held, and the road to the instant win (3 易幟 or
  // 5 整編 held at once): the points still missing for the cheapest set of
  // powers that completes it, read against who acts next (`markerRoad`).
  const mie = Object.keys(st.mie).length, seals = Object.keys(st.seals).length;
  const held = W.mieHeld * mie - W.sealHeld * seals;
  vq += held;
  if (T) T("markers", held);
  const mieNeed = [], sealNeed = [], mieForced = [];
  const mieMust = st.options.mieNeeds || null; // #23 round four: only when the option is set
  for (const [id, s] of Object.entries(STATES)) {
    if (!st.mie[id]) {
      let need = 0;
      for (const x of E.spacesOfState(id)) { const [q, c] = E.infOf(st, x); need += Math.max(0, c + SPACE[x].stability - q); }
      (mieMust && mieMust.includes(id) ? mieForced : mieNeed).push(need);
    }
    if (!st.seals[id]) {
      const [q, c] = E.infOf(st, s.capital), S = SPACE[s.capital].stability, cap = E.capOf(st, s.capital);
      // Control, and under sealAt "cap" blue at the cap: red above cap − stability must go first.
      let need = st.options.sealAt === "cap" ? Math.max(0, cap - c) + Math.max(0, q + S - cap) : Math.max(0, q + S - c);
      // #23 round four: under `sealNeeds: "all"` (only then) the power's other spaces must be the Nationalists' too.
      // #24: "all" is a key of DEFAULT_OPTIONS, so this is read in every game created since.
      if (st.options.sealNeeds === "all") for (const x of E.spacesOfState(id)) if (x !== s.capital) { const [qx, cx] = E.infOf(st, x); need += Math.max(0, qx + SPACE[x].stability - cx); }
      sealNeed.push(need);
    }
  }
  const roads = mieMust || st.options.sealPerTurn != null
    ? markerRoad(st, CCP, mieNeed, st.options.mie - mie, mieForced) - markerRoad(st, KMT, sealNeed, st.options.seals - seals, [], E.sealWinSoon(st))
    : markerRoad(st, CCP, mieNeed, st.options.mie - mie) - markerRoad(st, KMT, sealNeed, st.options.seals - seals);
  vq += roads;
  if (T) T("markerRoads", roads);

  // The reform tracks (建軍 / 行憲): the perks, and under a win by box 6 the race to it.
  const reformPerk = W.reformPerk[st.reform[CCP]] - W.reformPerk[st.reform[KMT]];
  vq += reformPerk;
  if (T) T("reform", reformPerk);
  const emp = st.options.emperor;
  if (emp === "win" || emp === "win-late" || emp === "win-lead") {
    const race = (s) => {
      if (!E.emperorLive(st, s)) return 0;
      if (emperorSteps(st, s) === 1) return EMPEROR_NEAR;
      const box = st.reform[s];
      const card = box >= 4 && hand(st, s).some((c) => !CARD[c].scoring && CARD[c].ops >= 4) ? (box === 5 ? EMPEROR_CARD : EMPEROR_CARD / 2) : 0;
      return EMPEROR_ROAD[box] + card;
    };
    const road = race(CCP) - race(KMT);
    vq += road;
    if (T) T("reform", road);
  }

  // The capitals (遷都 by default).
  const hf = st.options.homeFall;
  if (hf && hf !== "none") {
    let cap = 0;
    for (const s of [CCP, KMT]) {
      const id = E.homeCapital(st, s), [q, c] = E.infOf(st, id), own = s === CCP ? q : c, foe = s === CCP ? c : q;
      const short = hf === "lose-majority" ? Math.max(0, own - foe + 1) : Math.max(0, own + SPACE[id].stability - foe);
      const next = st.phase === "action" && !st.pending ? st.actor : null;
      const first = hf === "move" && id === E.HOME_CAPITAL[s];
      const road = first ? MOVE_ROAD : next === 1 - s ? ROAD_TEMPO : next === s ? ROAD_DEFENCE : ROAD;
      if (short >= road.length) continue;
      cap += (s === CCP ? -1 : 1) * (first ? E.MOVE_VP : FALL) * road[short];
    }
    vq += cap;
    if (T) T("capital", cap);
  }

  // The hands.
  const enemyCards = (s) => hand(st, s).filter((c) => CARD[c].side === 1 - s).length;
  const hands = -W.enemyCard * (enemyCards(CCP) - enemyCards(KMT)) + W.handCard * (hand(st, CCP).length - hand(st, KMT).length);
  vq += hands;
  if (T) T("hands", hands);

  // The scoring cards against each side's OWN action rounds left (a side with
  // more is lost already: `stuckLoser`, read at the top).
  if (st.phase === "action" || st.phase === "headline") {
    const n = [CCP, KMT].map((s) => hand(st, s).filter((c) => CARD[c].scoring).length);
    const left = [CCP, KMT].map((s) => actionsLeft(st, s));
    let pain = 0;
    for (const s of [CCP, KMT]) {
      if (!n[s]) continue;
      pain += (s === CCP ? -1 : 1) * (n[s] === left[s] ? W.urgent * n[s] : W.hold * n[s]);
    }
    const tempo = W.tempo * (left[CCP] - left[KMT]);
    vq += pain + tempo;
    if (T) { T("scoringPain", pain); T("tempo", tempo); }
  }

  // Supply (rulebook 三, 補給): both terms are zero with the option off.
  if (st.options.supply) {
    const iso = E.isolatedCities(st);
    if (iso.length) {
      // (a) the blue a 孤城 loses at this turn's 結算, then at each later one it stays cut off.
      let expect = E.attritionLoss(st), stay = 1;
      for (let t = turn + 1; t <= turns; t++) { stay *= W.stay; expect += stay * E.attritionLoss({ options: st.options, effects: [], turn: t }); }
      // (b) no 扶植 into it (美援 all in cities may airlift: worth less while it can).
      const relief = st.options.aid && (st.support[KMT] || 0) > 0 ? W.airlift : 0;
      const keys = new Set(Object.values(STATES).map((s) => s.capital));
      let a = 0, b = 0;
      for (const id of iso) {
        a += W.attrition * Math.min(E.infOf(st, id)[KMT], expect);
        b += W.cut * (1 - relief) * (SPACE[id].battleground || keys.has(id) ? W.cutKey : 1);
      }
      vq += a + b;
      if (T) { T("isolatedAttrition", a); T("isolatedNoPlace", b); }
    }
  }

  // The support tracks: the aid card's ops in the turns to come, and 美軍駐華.
  if (Array.isArray(st.support)) {
    const per = (st.options.aid ? W.support : W.supplyNoAid) * discountedTurns(turn, turns);
    let sup = per * (st.support[CCP] - st.support[KMT]);
    if (E.GARRISON.some((id) => E.garrisoned(st, id))) sup -= W.garrison; // the engine's own reading
    vq += sup;
    if (T) T("support", sup);
  }

  let spread = 0;
  for (const s of SPACES) {
    const [q, c] = E.infOf(st, s.id), ctl = E.controller(st, s.id);
    if (q > 0 && ctl !== CCP) spread += W.spread;
    if (c > 0 && ctl !== KMT) spread -= W.spread;
  }
  vq += spread;
  if (T) T("spread", spread);
  return side === CCP ? vq : -vq;
}

// ---------- the guess: a full state consistent with what this seat sees ----------
// The decks are public (`E.ERA_DECKS`), so every card is either seen (this
// hand, the discard and removed piles, a face-up headline, a card on its way
// through the plan, the other hand when it is shown) or among the unseen: the
// other hand, a hidden headline and the draw pile. The eras not shuffled in yet
// (`later`, the keys of `laterCounts`) are their whole decks. The aid cards are
// in no deck. The other hand is dealt from the unseen cards with the one thing
// this seat knows about it: no more scoring cards than its own action rounds
// left (a side that holds more loses at the turn's end, which no player plays
// into; Zongheng #132 bet the game on that case), and the card 潛伏 named.
export function determinize(view, side, rng) {
  const st = E.clone({ ...view, log: [] });
  const opp = 1 - side;
  const known = new Set([...st.hands[side], ...st.discard, ...st.removed]);
  const oppSeen = Array.isArray(st.hands[opp]);
  if (oppSeen) for (const c of st.hands[opp]) known.add(c);
  for (const h of st.headline) if (h && CARD[h]) known.add(h);
  for (const p of st.plan) { if (p.card && CARD[p.card]) known.add(p.card); if (p.pair && CARD[p.pair]) known.add(p.pair); }
  const later = Object.keys(view.laterCounts || {});
  const merged = ERAS.map((e) => e.id).filter((id) => !later.includes(id));
  const pool = E.shuffle(rng, merged.flatMap((e) => ERA_DECKS[e]).filter((c) => !known.has(c)));
  st.later = Object.fromEntries(later.map((id) => [id, ERA_DECKS[id].slice()]));
  if (!oppSeen) {
    const n = (st.handCounts && st.handCounts[opp]) || 0, h = [];
    const named = st.forced && st.forced[opp];
    if (named && pool.includes(named)) { h.push(named); pool.splice(pool.indexOf(named), 1); }
    while (h.length < n && pool.length) h.push(pool.shift());
    st.hands[opp] = h;
    const most = actionsLeft(st, opp);
    for (let i = 0; i < h.length && h.filter((c) => CARD[c].scoring).length > most; i++) {
      if (!CARD[h[i]].scoring) continue;
      const j = pool.findIndex((c) => !CARD[c].scoring);
      if (j < 0) break;
      const swap = pool[j]; pool[j] = h[i]; h[i] = swap;
    }
  }
  if (st.headline[opp] === "hidden") st.headline[opp] = pool.shift() ?? null;
  // #26: the Communists' face-down plan for an attack on a city (`view` hides it until the answer).
  for (const p of st.plan) if (p.do === "siege" && p.plan == null) p.plan = pickOne(E.SIEGE_PLANS, rng);
  st.draw = pool;
  st.rngState = rng.int(2 ** 31);
  delete st.handCounts; delete st.drawCount; delete st.laterCounts; delete st.homeCapitals;
  return st;
}

// ---------- playing a candidate out, answering what it asks ----------
export function simulate(st, action, rng) {
  let s = E.apply(st, action);
  for (let guard = 0; s.pending && s.winner == null && guard < 16; guard++) {
    const who = s.pending.who, p = s.pending, choice = answer(s, p, who, rng);
    // Not caught: re-thrown with what was asked, so a bad answer names itself.
    try { s = E.apply(s, { type: "choose", side: who, choice }); }
    catch (e) { throw new Error(`the bot's answer ${JSON.stringify(choice)} to ${JSON.stringify({ ...p, step: undefined })} was refused: ${e.message}`); }
  }
  return s;
}
// ---------- the ops a play will really have, for the card page ----------
// An enemy card played for its ops EVENT FIRST has its ops read after the
// event (engine "ops" step's `afterEvent`): this plays the event out on a guess
// and reads the ops the engine then asks for. A UI helper, never a decision:
// any failure answers the ops of now. `view` is left untouched.
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
// ---------- 遊說 as a roll (lobby "realign-own", the default) ----------
// One simulation of a realignment is ONE roll of the dice. So a 遊說 is offered
// only where one attempt gains on average (`realignExpect`), and scored as the
// mean over DICE_K rolls. Off realign nothing here runs and no RNG is drawn.
export const DICE_K = 6, DICE_K_REPLY = 2;
function realigning(st) { return !!E.LOBBY[st.options.lobby]; }
export function realignExpect(st, side, id) {
  const o = E.realignOdds(st, side, id);
  return o ? o.net : 0;
}
function isLobby(action) { return action.type === "choose" ? !!action.choice && action.choice.use === "lobby" : action.use === "lobby"; }
function rollsFor(st, action, k = DICE_K) { return realigning(st) && isLobby(action) ? k : 1; }
// evaluate(after `action`) averaged over `k` rolls (k = 1: one simulation).
function meanEval(st, action, side, rng, k) {
  if (k <= 1) return evaluate(simulate(st, action, rng), side);
  let t = 0;
  for (let i = 0; i < k; i++) t += evaluate(simulate({ ...st, rngState: rng.int(2 ** 31) }, action, rng), side);
  return t / k;
}
function evalAction(st, action, side, rng) { return meanEval(st, action, side, rng, rollsFor(st, action)); }
function bestOf(st, who, choices, rng) {
  let best = null, bestV = -Infinity;
  for (const ch of choices) {
    const a = { type: "choose", side: who, choice: ch };
    const v = meanEval(st, a, who, rng, rollsFor(st, a));
    if (v > bestV) { bestV = v; best = ch; }
  }
  return best ?? choices[0];
}
function lobbyTargetsFor(st, side, targets) {
  return realigning(st) ? targets.filter((t) => realignExpect(st, side, t.id) > 0) : targets;
}

// How many more of `id` a points choice can take with `counts` already in it:
// the checks of the engine's `validateChoice`, in its order.
function roomFor(p, s, side, id, counts) {
  let r = Infinity;
  if (p.distinct) r = Math.min(r, 1);
  if (p.maxPer) r = Math.min(r, p.maxPer);
  if (p.maxOf) r = Math.min(r, p.maxOf[id] ?? 0);
  if (p.side != null) r = Math.min(r, E.capOf(s, id) - E.infOf(s, id)[side]);
  return r - (counts[id] || 0);
}
// A points choice: greedy per point on a scratch copy, the room read as the engine reads it.
function bestPoints(st, p, who, rng) {
  const s = E.clone(st); s.log = [];
  const counts = {}, out = [];
  const bump = (id, d, side) => { const a = s.inf[id] || (s.inf[id] = [0, 0]); a[side] += d; };
  if (p.side === who) { // an event's own points that win now (winTargets below)
    for (const pts of winningPoints(st, who, p.n, (_, x, pts) => p.options.includes(x) && roomFor(p, st, who, x, { [x]: pts.filter((y) => y === x).length }) > 0, () => 1)) {
      // A choice of exactly `min` to `n` points only (a shorter win is left to the greedy rule below).
      if (pts.length >= (p.min ?? 0) && winsNow(st, { type: "choose", side: who, choice: pts })) return pts;
    }
  }
  if (p.side != null) { // points of `p.side`'s: the best place for each
    for (let i = 0; i < p.n; i++) {
      let best = null, bestV = -Infinity;
      for (const id of p.options) {
        // The room is read on the board as asked (`st`), with `counts` already in the choice:
        // `s` has them on it too, and reading it would count them twice (Zongheng's bug).
        if (roomFor(p, st, p.side, id, counts) <= 0) continue;
        bump(id, 1, p.side); const v = evaluate(s, who); bump(id, -1, p.side);
        if (v > bestV) { bestV = v; best = id; }
      }
      if (best == null) break;
      bump(best, 1, p.side); counts[best] = (counts[best] || 0) + 1; out.push(best);
    }
    return out;
  }
  if (p.maxOf) { // lifting your own points (戰略機動): lose the least
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
  // Several distinct picks whose meaning is "hit the enemy here" (取締民盟).
  const scored = p.options.map((id) => { bump(id, -1, 1 - who); const v = evaluate(s, who); bump(id, 1, 1 - who); return { id, v }; });
  scored.sort((a, b) => b.v - a.v);
  return scored.slice(0, p.n).map((x) => x.id);
}

// ---------- 扶植: where the points go ----------
// One point at a time, each on a space `E.placeTargets` lights for the next
// point (reach, cost, cap, supply, 受降, 戰略反攻's jump, 蘇援's +1 and 美援's
// airlift are all read there; `card` is the aid card's id for an aid card's
// 扶植), so the list is legal by construction. Which lit space: the one whose
// best run of points (1 to 3 there, the cost re-read as control changes) gains
// the most per op spent on the evaluation; one point of it is committed and
// the next is chosen again. `restrict` keeps the points to some spaces (蘇援
// all in the Northeast, 美援 all in cities).
export function greedyPlacement(st, side, ops, card, restrict = null) {
  const s = E.clone(st); s.log = [];
  const points = [];
  for (let guard = 0; guard < 12; guard++) {
    const { lit, left } = E.placeTargets(st, side, ops, points, card);
    const ids = [...lit].filter((id) => !restrict || restrict(id));
    if (!ids.length) break;
    const bonus = card === "soviet_aid" && points.every(inNortheast) ? 1 : 0;
    const base = evaluate(s, side);
    let best = null, bestR = -Infinity;
    for (const id of ids) {
      const a = s.inf[id] || (s.inf[id] = [0, 0]), start = a[side], cap = E.capOf(s, id);
      const budget = left + (bonus && inNortheast(id) ? 1 : 0);
      let spent = 0, here = -Infinity;
      for (let k = 0; k < 3 && a[side] < cap; k++) {
        const c = E.placeCost(s, side, id);
        if (spent + c > budget) break;
        a[side]++; spent += c;
        const r = (evaluate(s, side) - base) / spent;
        if (r > here) here = r;
      }
      a[side] = start;
      if (here > bestR) { bestR = here; best = id; }
    }
    if (best == null) break;
    points.push(best);
    (s.inf[best] || (s.inf[best] = [0, 0]))[side]++;
  }
  return points;
}
// ---------- a win by placement is never missed (Zongheng #134) ----------
// When one placement can end the game -- the last 易幟 (the Communists), the
// last 整編 (the Nationalists), the enemy capital under homeFall "lose" or at
// the turn's last action -- the points that complete it are offered too; each
// caller keeps only a play that the engine says wins.
function lastAction(st, side) { return actionsLeft(st, side) <= 1 && actionsLeft(st, 1 - side) === 0; }
function winTargets(st, side) {
  const out = [], opp = 1 - side;
  if (side === CCP && Object.keys(st.mie).length >= st.options.mie - 1) {
    for (const id of Object.keys(STATES)) if (!st.mie[id]) out.push({ ids: E.spacesOfState(id), done: (s, x) => E.controller(s, x) === CCP });
  }
  if (side === KMT && Object.keys(st.seals).length >= st.options.seals - 1) {
    const sealed = (s, x) => E.controller(s, x) === KMT && (s.options.sealAt !== "cap" || E.infOf(s, x)[KMT] >= E.capOf(s, x));
    for (const [id, s] of Object.entries(STATES)) if (!st.seals[id]) out.push({ ids: [s.capital], done: sealed });
  }
  const hf = st.options.homeFall;
  if (hf && hf !== "none" && (hf === "lose" || lastAction(st, side))) {
    const held = hf === "lose-majority" ? (s, x) => E.infOf(s, x)[side] > E.infOf(s, x)[opp] : (s, x) => E.controller(s, x) === side;
    out.push({ ids: [E.homeCapital(st, opp)], done: held });
  }
  return out;
}
// For each target, the fewest points that complete it: `room(s, id, pts)` says
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
// A 扶植 of `ops` that completes a target, every point lit by `placeTargets`.
export function winningPlacements(st, side, ops, card, restrict = null) {
  const out = [];
  for (const t of winTargets(st, side)) {
    const pts = [];
    let ok = true;
    for (const x of t.ids) {
      for (let guard = 0; ok && guard < 12; guard++) {
        const trial = { ...st, inf: { ...st.inf } };
        for (const y of pts) trial.inf[y] = [...E.infOf(trial, y)], trial.inf[y][side]++;
        if (t.done(trial, x)) break;
        if ((restrict && !restrict(x)) || !E.placeTargets(st, side, ops, pts, card).lit.has(x)) { ok = false; break; }
        pts.push(x);
      }
    }
    if (ok && pts.length) out.push(pts);
  }
  return out;
}
function winsNow(st, action) { return E.apply(st, action).winner === action.side; }

// Free ops (an enemy card's ops after its event): the best of every use allowed.
function bestOps(st, who, ops, allowed, rng, card) {
  const aid = card && E.isAid(card) ? card : undefined;
  const o = E.opsOptions(st, who, aid);
  const cands = [];
  if (allowed.includes("place")) {
    const points = greedyPlacement(st, who, ops, aid); if (points.length) cands.push({ use: "place", points });
    for (const pts of winningPlacements(st, who, ops, aid)) cands.push({ use: "place", points: pts });
  }
  if (allowed.includes("campaign")) for (const t of o.campaignTargets) for (const x of attacks(st, who, t)) cands.push({ use: "campaign", ...x });
  if (allowed.includes("lobby")) for (const t of lobbyTargetsFor(st, who, o.lobbyTargets)) cands.push({ use: "lobby", target: t.id });
  // Nothing worth trying (no point affordable, no 遊說 that gains): an empty 扶植 spends nothing.
  if (!cands.length) return allowed.includes("place") ? { use: "place", points: [] } : allowed.includes("campaign") ? { use: "campaign", ...attacks(st, who, o.campaignTargets[0])[0] } : { use: "lobby", target: o.lobbyTargets[0].id };
  return bestOf(st, who, cands, rng);
}
// A card choice of `n` cards: every set of up to two, else greedy one by one.
function cardSets(p) {
  const min = p.min ?? 1, n = p.n ?? 1, o = p.options;
  const out = [];
  if (min === 0) out.push([]);
  if (n >= 1 && min <= 1) for (const c of o) out.push([c]);
  if (n >= 2 && min <= 2) for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++) out.push([o[i], o[j]]);
  return out.length ? out : [o.slice(0, min)];
}
// 進剿's 撤 (#26): all `n` red points must go somewhere among the villages; each
// goes where the most room is left (a point with no room anywhere is lost).
function withdrawPoints(st, p) {
  const counts = {}, out = [];
  const room = (id) => E.capOf(st, id) - E.infOf(st, id)[CCP] - (counts[id] || 0);
  for (let i = 0; i < p.n; i++) {
    const id = p.options.reduce((a, b) => (room(b) > room(a) ? b : a));
    counts[id] = (counts[id] || 0) + 1; out.push(id);
  }
  return out;
}
export function answer(st, p, who, rng) {
  switch (p.kind) {
    case "points": return p.tag === "withdraw" ? withdrawPoints(st, p) : bestPoints(st, p, who, rng);
    case "card": return bestOf(st, who, cardSets(p), rng);
    // 收手 (realign-own): go on while the next attempt gains on average.
    case "option": if (p.tag === "realign") return realignExpect(st, who, p.target) > 0 ? "continue" : "stop";
      return bestOf(st, who, p.options.map((o) => o.id), rng);
    case "ops": return bestOps(st, who, p.ops, p.allowed, rng, p.card);
    default: throw new Error(`answer: ${p.kind}`);
  }
}

// Zongheng #123: never offer a play that pushes 民生 to 崩潰 against `side`
// right now, unless every legal play does (`E.actionWouldCollapse`). Above
// 民生 4 nothing a card does in one play can reach 1, so the check is skipped.
const COLLAPSE_RISK_WEARINESS = 4;
function dropSelfCollapse(st, side, list) {
  if (list.length <= 1 || st.weariness > COLLAPSE_RISK_WEARINESS) return list;
  const safe = list.filter((a) => !E.actionWouldCollapse(st, side, a));
  return safe.length ? safe : list;
}

// ---------- candidates for an action round ----------
// Every card as its event, 變法, 扶植 (one greedy placement per number of ops,
// plus the placements that win now), 奇襲 on every target, 遊說 where one
// attempt gains on average; an enemy card's ops first, or its event first;
// 馬歇爾調處 with its strongest pair; and the aid card (`legal().aid`): 扶植
// (蘇援 also all in the Northeast for its +1, 美援 also all in cities for the
// airlift), 奇襲 and 遊說.
function actionCandidates(st, side, L) {
  if (L.bog && L.bog.length) return L.bog.map((c) => ({ type: "play", side, card: c, use: "bog" }));
  const out = [];
  const lob = (targets) => lobbyTargetsFor(st, side, targets);
  const memo = new Map();
  const placed = (ops, card, restrict, tag) => {
    const key = `${ops}/${card || ""}/${tag || ""}`;
    if (!memo.has(key)) memo.set(key, greedyPlacement(st, side, ops, card, restrict));
    return memo.get(key);
  };
  const winPlace = (ops, make, card, restrict) => {
    for (const points of winningPlacements(st, side, ops, card, restrict)) { const a = make(points); if (winsNow(st, a)) out.push(a); }
  };
  for (const c of L.cards) {
    const u = c.uses, id = c.id;
    out.push({ type: "play", side, card: id, use: "event" });
    if (CARD[id].scoring) continue;
    const order = u.enemy ? { order: "opsFirst" } : {};
    if (u.reform) out.push({ type: "play", side, card: id, use: "reform" });
    if (u.place) {
      const points = placed(u.place.ops);
      if (points.length) out.push({ type: "play", side, card: id, use: "place", ...order, points });
      winPlace(u.place.ops, (pts) => ({ type: "play", side, card: id, use: "place", ...order, points: pts }));
    }
    if (u.campaign) for (const t of u.campaign.targets) for (const x of attacks(st, side, t)) out.push({ type: "play", side, card: id, use: "campaign", ...order, ...x });
    if (u.lobby) for (const t of lob(u.lobby.targets)) out.push({ type: "play", side, card: id, use: "lobby", ...order, target: t.id });
    if (u.enemy && (u.place || u.campaign || u.lobby)) out.push({ type: "play", side, card: id, use: "place", order: "eventFirst" });
    if (u.pair && u.pair.length && (u.place || u.campaign || u.lobby)) {
      const pair = u.pair.reduce((a, b) => (CARD[b].ops > CARD[a].ops ? b : a));
      const pops = E.opsOf(st, side, pair);
      if (u.place) {
        const points = placed(pops);
        if (points.length) out.push({ type: "play", side, card: id, pair, use: "place", points });
        winPlace(pops, (pts) => ({ type: "play", side, card: id, pair, use: "place", points: pts }));
      }
      if (u.campaign) for (const t of u.campaign.targets) for (const x of attacks(st, side, t)) out.push({ type: "play", side, card: id, pair, use: "campaign", ...x });
      if (u.lobby) for (const t of lob(u.lobby.targets)) out.push({ type: "play", side, card: id, pair, use: "lobby", target: t.id });
    }
  }
  if (L.aid) {
    const a = L.aid, id = a.id, play = (use, rest) => ({ type: "play", side, card: id, use, ...rest });
    if (a.place) {
      const seen = new Set();
      const offer = (points) => { const k = points.join(","); if (points.length && !seen.has(k)) { seen.add(k); out.push(play("place", { points })); } };
      offer(placed(a.ops, id));
      if (id === "soviet_aid") offer(placed(a.ops, id, inNortheast, "ne"));
      if (id === "american_aid") offer(placed(a.ops, id, isCity, "city"));
      winPlace(a.ops, (pts) => play("place", { points: pts }), id);
    }
    if (a.campaign) for (const t of a.campaign.targets) for (const x of attacks(st, side, t)) out.push(play("campaign", x));
    if (a.lobby) for (const t of lob(a.lobby.targets)) out.push(play("lobby", { target: t.id }));
  }
  return dropSelfCollapse(st, side, out);
}

// The other side's best one-ply reply, from the sampled state.
function replyValue(st, action, side, rng) {
  const k = rollsFor(st, action, DICE_K_REPLY);
  if (k > 1) { let t = 0; for (let i = 0; i < k; i++) t += replyOnce({ ...st, rngState: rng.int(2 ** 31) }, action, side, rng); return t / k; }
  return replyOnce(st, action, side, rng);
}
function replyOnce(st, action, side, rng) {
  const s = simulate(st, action, rng);
  if (s.winner != null) return evaluate(s, side);
  const opp = 1 - side;
  if (s.phase !== "action" || s.actor !== opp || s.pending) return evaluate(s, side);
  const L = E.legal(s, opp);
  if (L.kind !== "action") return evaluate(s, side);
  let worst = Infinity;
  for (const b of actionCandidates(s, opp, L)) {
    const v = meanEval(s, b, side, rng, rollsFor(s, b, DICE_K_REPLY));
    if (v < worst) worst = v;
  }
  return worst === Infinity ? evaluate(s, side) : worst;
}

// Headline: every card on the same few guesses of the other hand and its headline.
function bestHeadline(view, side, cards, rng, level) {
  const K = level === "hard" ? 10 : 5, opp = 1 - side;
  const guesses = [];
  for (let k = 0; k < K; k++) {
    const st = determinize(view, side, rng);
    let theirs = st.headline[opp];
    if (theirs == null) {
      const h = hand(st, opp);
      if (h.length) theirs = rng.next() < 0.5 ? h.reduce((a, b) => (CARD[b].ops > CARD[a].ops ? b : a)) : pickOne(h, rng);
    }
    guesses.push({ st, theirs, seed: rng.int(2 ** 31) });
  }
  let best = null, bestV = -Infinity;
  for (const card of cards) {
    let total = 0;
    for (const g of guesses) {
      const r = E.makeRng(g.seed);
      let s = E.apply(g.st, { type: "headline", side, card });
      if (s.phase === "headline" && s.headline[opp] == null && g.theirs) s = E.apply(s, { type: "headline", side: opp, card: g.theirs });
      for (let guard = 0; s.pending && s.winner == null && guard < 16; guard++) {
        const who = s.pending.who;
        s = E.apply(s, { type: "choose", side: who, choice: answer(s, s.pending, who, r) });
      }
      total += evaluate(s, side);
    }
    const v = total / guesses.length;
    if (v > bestV) { bestV = v; best = card; }
  }
  return best ?? cards[0];
}

// ---------- random play (easy, and the fuzz driver) ----------
// #9: the random player is its own module (random.js); re-exported here.
export { randomAction, randomPoints, randomOps, randomChoice };

// Every candidate with its value, best first: for tests, debugging and hints.
export function scoreCandidates(view, side, rng) {
  const st = determinize(view, side, rng);
  const L = E.legal(st, side);
  if (L.kind !== "action") return [];
  return actionCandidates(st, side, L).map((a) => ({ a, v: evalAction(st, a, side, rng) })).sort((x, y) => y.v - x.v);
}

// Zongheng #134: several plays can win on the one guess the bot scored; every
// play that won is played again on WIN_CHECK fresh guesses with fresh rolls,
// and the one that wins most often is taken (the scored order breaks ties).
// The RNG is derived from the guess, not drawn from the bot's. A play legal on
// this guess is legal on any (it is this side's own play), so the try below is
// only for a fresh guess on which an answer the play asks for cannot be given.
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
// `view` is `E.view(st, side)`; it is not changed. The only chance is `rng`.
export function decide(view, side, level = "normal", rng) {
  if (level === "easy") { const a = randomAction(view, side, rng); if (a) a.why = "random"; return a; }
  const st = determinize(view, side, rng);
  const L = E.legal(st, side);
  const noise = NOISE[level] ?? 0.6;
  switch (L.kind) {
    case "pending": return { type: "choose", side, choice: answer(st, L.pending, side, rng), why: L.pending.kind };
    case "headline": return L.cards.length ? { type: "headline", side, card: bestHeadline(view, side, L.cards, rng, level), why: "headline" } : null;
    case "action": {
      const cands = actionCandidates(st, side, L);
      if (!cands.length) return null;
      const scored = cands.map((a) => { const raw = evalAction(st, a, side, rng); return { a, raw, v: raw + noise * gauss(rng) }; });
      scored.sort((x, y) => y.v - x.v);
      const sure = surestWin(view, side, st, scored.filter((x) => x.raw >= 1000 - 1e-6));
      if (sure) return { ...sure, why: `${sure.use}:${sure.card}` };
      const top = scored.slice(0, level === "hard" ? 4 : 1);
      if (level === "hard" && top.length > 1) {
        for (const t of top) t.v = replyValue(st, t.a, side, rng) + noise * gauss(rng);
        top.sort((x, y) => y.v - x.v);
      }
      const a = top[0].a;
      return { ...a, why: `${a.use}:${a.card}` };
    }
    default: return null;
  }
}
