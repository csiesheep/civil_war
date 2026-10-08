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
//   - mechanism E (#36, only under the option `mechanismE`): 印鈔 and 激進 are priced by the thresholds of
//     the side's own track spread over the steps to them (`ePrice`), the evaluation charges the walked part
//     and values the centrists, and 印鈔 / 激進 / 平抑 are candidates (see "mechanism E" below).
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
// Mechanism B (#26, the option `mechanismB`; the default rules since #28). Inside the bot's own simulations
// (a candidate played out, the other side's reply of 困難) an attack on a city
// that must name a plan is offered once per plan, and the Nationalists' answer
// in the simulation is their best one for that plan: an approximation of the
// guessing game that errs against the attacker. A hidden plan in the guess is
// drawn at random (`determinize`); a 撤 is spread where there is room
// (`withdrawPoints`). The decisions themselves -- the Communists' attack on a
// city, the Nationalists' answer -- are a zero-sum game (#27, `siegeGame` below).
// Off B, a target is just itself.
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
// Mechanism D (#32; the owner's mechanisms note, D, 「bot」): a power's gray is worth to the
// Nationalists by its attitude (效忠 1, 觀望 0.5, 通共 0).
export const GRAY_WEIGHT = { loyal: 1, neutral: 0.5, ccp: 0 };
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
  if (mechD(st)) {
    vq += boardValueD(st, mie, seals, T);
    return finishBoardValue(st, side, vq, T, turn, turns);
  }
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
  return finishBoardValue(st, side, vq, T, turn, turns);
}
// The rest of the evaluation, after the markers: the same additions in the same order with or without
// mechanism D (#32 split it here so that D's markers replace only the block above).
function finishBoardValue(st, side, vq, T, turn, turns) {
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

  // Mechanism E (#36): the two tracks' prices and the centrists (`eValue`); nothing without the option.
  if (mechE(st)) {
    const e = eValue(st);
    vq += e;
    if (T) T("mechE", e);
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

// ---------- mechanism D (#32): gray, the attitudes, 易幟 and 整編完成 ----------
// Read only under the option `mechanismD`: without it nothing below runs and no number above moves.
// The owner's note (D, 「bot」): a power's gray is discounted by its attitude (GRAY_WEIGHT), and the
// evaluation adds how many steps each power still is from 易幟 / 整編完成. Under D both markers are
// permanent and a power gets one of the two at most (engine `dMarkers`), so the roads to the instant
// wins (3 易幟, 5 整編完成) are read per power that has neither, with D's own conditions:
//   易幟: the Communists control its home (red ≥ blue + gray + S: gray blocks them in every
//     attitude), or it leans to them (通共) and its home is out of supply. The points missing are the
//     cheaper of the two: the red still missing at the home, or one 統戰 per step of attitude still to
//     go (each a card of the power's threshold) plus, while the home is in supply, the red that cuts it.
//   整編完成: no gray left, the last of it gone by 整編, the Nationalists control the home. Each space
//     with gray takes one 整編, and each 整編 moves the attitude a step toward the Communists, which
//     refuse 整編 once at 通共: a loyal power has two 整編 in it, a neutral one one. Out of reach when
//     it needs more than that, when its gray went by an attack, or when the last 整編 would make it
//     通共 with its home cut off (that is an 易幟, `suicideIntegrate`). The points missing are the gray
//     still to turn (a card's ops turn as many) and the blue missing for control of the home once
//     its gray is blue.
const mechD = (st) => !!(st.options && st.options.mechanismD);
const D_STEPS = { loyal: 2, neutral: 1, ccp: 0 };
// W_D.gray: per gray point at GRAY_WEIGHT 1 (a loyal point is the Nationalists' at control and reach,
// and a 整編 turns it blue). A marker held: under D it is permanent (W.mieHeld's markers could be lifted
// again), so it is worth its share of the instant win it is part of: the last marker is the win itself
// (the evaluation's 1000), the ones before it share MARK_WIN -- MARK_WIN / (the markers that win − 1).
const W_D = { gray: 1.0 };
const dMarkerWorth = (st) => [MARK_WIN / Math.max(1, st.options.mie - 1), MARK_WIN / Math.max(1, st.options.seals - 1)];
// Per power with neither marker: the points missing for each (`mie`, `seal`, the lists markerRoad
// reads), and how many powers meet a marker's condition already without having it (`mieDue`,
// `sealDue`): never on a state the engine has played (it marks at once, but for a second 整編完成 in
// one turn, `sealPerTurn`), only on the boards the bot lays out point by point (`greedyPlacement`,
// `bestPoints`), which must see a placement's 易幟 as the engine would. A city of the power with gray
// that is a 孤城 now moves the power a step toward the Communists at this turn's 結算 (engine
// `supplyAttritionD`): that step costs no 統戰.
export function dNeeds(st, ok = E.supplied(st)) {
  const mie = [], seal = [];
  let mieDue = 0, sealDue = 0;
  for (const [p, d] of Object.entries(E.DPOWERS)) {
    if (st.mie[p] || st.seals[p]) continue;
    const h = d.home, [q, c] = E.infOf(st, h), S = SPACE[h].stability, gh = E.grayOf(st, h);
    const att = E.attitudeOf(st, p) || d.attitude, cut = !ok.has(h);
    const conquest = Math.max(0, c + gh + S - q);
    if (conquest === 0 || (cut && att === "ccp")) { mieDue++; continue; }
    const withGray = d.spaces.filter((id) => E.grayOf(st, id) > 0);
    // (#33 `dSettle`: only the 孤城 the option still lets lean; absent, every one.)
    const free = withGray.some((id) => isCity(id) && (!ok.has(id) || E.besieged(st, id)) && E.dSettleLeans(st, id)) ? 1 : 0;
    // The road by talks: the steps of attitude to go (統戰), and, while the home is in supply, cutting
    // it: at most the red that takes every neighbour of the home not the Communists' already.
    let cutCost = 0;
    if (!cut) for (const x of E.adjOf(st, h)) { const [qx, cx] = E.infOf(st, x); cutCost += Math.max(0, cx + E.grayOf(st, x) + SPACE[x].stability - qx); }
    mie.push(Math.min(conquest, cutCost + Math.max(0, D_STEPS[att] - free) * E.dThreshold(st, p)));
    const blueNeed = Math.max(0, q + S - c - gh);
    if (!withGray.length) {
      if (st.grayLast && st.grayLast[p] === "politics") { if (blueNeed === 0) sealDue++; else seal.push(blueNeed); }
      continue;
    }
    const steps = integrateSteps(st, withGray);
    if (steps > D_STEPS[att] || (steps === D_STEPS[att] && cut)) continue;
    seal.push(withGray.reduce((t, id) => t + E.grayOf(st, id), 0) + blueNeed);
  }
  return { mie, seal, mieDue, sealDue };
}
// The 整編 it takes to turn the gray at `withGray` (#33): one a space, as #32 read it (today's gray is at
// most 2 and a card's ops turn as many) -- unless `dGray` or `dIntegrateMax` is given: then a space of gray g
// takes ceil(g / most a 整編 turns), the most being the largest card's ops (OPS_MAX) capped by `dIntegrateMax`.
const OPS_MAX = Math.max(...E.CARDS.map((c) => c.ops));
function integrateSteps(st, withGray) {
  if (st.options.dGray == null && st.options.dIntegrateMax == null) return withGray.length;
  const most = Math.max(1, Math.min(OPS_MAX, E.dIntegrateCap(st)));
  return withGray.reduce((t, id) => t + Math.ceil(E.grayOf(st, id) / most), 0);
}
function boardValueD(st, mieHeld, sealsHeld, T) {
  let v = 0;
  const { mie: mieNeed, seal: sealNeed, mieDue, sealDue } = dNeeds(st);
  const mie = mieHeld + mieDue, seals = sealsHeld + sealDue;
  const [mieW, sealW] = dMarkerWorth(st), held = mieW * mie - sealW * seals;
  v += held;
  if (T) T("markers", held);
  const roads = markerRoad(st, CCP, mieNeed, st.options.mie - mie) - markerRoad(st, KMT, sealNeed, st.options.seals - seals, [], E.sealWinSoon(st));
  v += roads;
  if (T) T("markerRoads", roads);
  let gray = 0;
  if (st.gray) for (const [id, g] of Object.entries(st.gray)) if (g > 0) { const p = E.powerOf(id); gray += GRAY_WEIGHT[E.attitudeOf(st, p) || E.DPOWERS[p].attitude] * g; }
  v -= W_D.gray * gray;
  if (T) T("gray", -W_D.gray * gray);
  return v;
}
// A 整編 that makes its power 通共 while the power's home is out of supply: an 易幟 on the spot
// (orchestrator 裁決 #32: never played, unless every play is one). `a` is a play or an ops choice.
function suicideIntegrate(st, side, a, ok) {
  const c = a.type === "choose" ? a.choice : a;
  if (side !== KMT || !c || c.use !== "politics") return false;
  const p = E.powerOf(c.target);
  return !!p && E.attitudeOf(st, p) === "neutral" && !ok.has(E.DPOWERS[p].home);
}
function dropSuicideIntegrate(st, side, list) {
  if (!mechD(st) || side !== KMT || list.length <= 1) return list;
  const ok = E.supplied(st);
  const safe = list.filter((a) => !suicideIntegrate(st, side, a, ok));
  return safe.length ? safe : list;
}

// ---------- mechanism E (#36): the price of 印鈔 and 激進 ----------
// Read only under the option `mechanismE`: without it nothing below runs, no candidate is added and no
// number of the evaluation moves. The owner's note (E, 「bot」, hand-copied in tests/bots.test.js B7):
// 「印鈔和激進都是『這 2 點行動點現在值多少』對『離下一個門檻還有幾格』。bot 把門檻的代價攤到每一格上當價格。」
// Each threshold t of a side's own track (通膨 the Nationalists', 左傾 the Communists') costs that side
// C_t (`eThresholdCost`, in 民心 points as the whole evaluation), spread evenly over the steps from the
// threshold before it (`eSegStart`) to t: each step is C_t / (t − a). The evaluation charges a side the part
// of the next threshold not yet reached that its track has walked (`eTrackCost`); a threshold's own effect,
// once reached, is in the state (民心, the centrists) or in `eHandCut` (8's smaller hand), so nothing is
// counted twice. `ePrice` is what one more step costs. The centrists (`eCentrists`) are worth their lean at
// every 結算 still to come.
//   通膨: 3 → 民心 1; 6 → 民心 2 and the centrists a step toward the Communists (the 結算 still to come, unless
//     they are at +2 already); 8 → one card fewer at every refill after this turn (W_E.card a card); 10 → the
//     Nationalists lose: the two steps from 8 are priced as the prints the Nationalists could still use
//     (W_E.print a print, times the time left, `ePrintRoom`: nothing at the game's last action), and the step
//     into 10 is the loss itself (E_LOSS; never offered, `printable`).
//   左傾: 2 → the centrists a step toward the Nationalists; 4 → 民心 2; 6 (every time) → −1 red in every village
//     the Communists control (W_E.villageRed each, W_E.villageCtl more where the red is exactly what holds
//     it), then back to 3: the segment of 6 starts at the reset (3).
const mechE = (st) => !!(st.options && st.options.mechanismE);
// W_E.print: what the bot's own evaluation gives 2 more ops at a moment the Nationalists may print, plus the price
// paid (tuning/36/print-worth.mjs: 177 decisions of 12 E games, mean 3.3, median 1.9); W_E.card: a card dealt.
export const W_E = { card: 1.0, print: 3, villageRed: 0.5, villageCtl: 1.0 };
const E_LOSS = 1000;
// #37: every number of E is read from `E.eSpecOf(st)` (today's E_SPEC unless the game's options carry #37's keys),
// so the prices follow the thresholds where an option puts them; with no such key each line reads as before.
// The thresholds are entries { at, vp, centrists, hand, lose } (通膨) and { at, centrists, vp } … { at, villages,
// reset } (左傾, the last one every time).
const clampC = (sp, c) => Math.max(sp.centrists[0], Math.min(sp.centrists[1], c));
// The 結算 still to come: this turn's, then the turns after it, discounted as every "turns to come" here.
function eSettlements(st) {
  if (st.winner != null) return 0;
  const turn = Math.max(1, st.turn), turns = st.options.turns;
  return (turn <= turns ? 1 : 0) + discountedTurns(turn, turns);
}
// The share of a print still to be used after this moment: the turns to come, and the Nationalists' own
// action rounds left this turn (`now`: the state of a decision, whose own action is not "later"). #37: with
// `ePrintPerTurn` the rounds of this turn are the prints still allowed this turn, out of that many.
function ePrintRoom(st, now) {
  const turn = Math.max(1, st.turn), turns = st.options.turns;
  const own = now && st.phase === "action" && !st.pending && st.actor === KMT;
  let acts = actionsLeft(st, KMT);
  if (own) acts = Math.max(0, acts - 1);
  let R = Array.isArray(st.rounds) ? Math.max(1, st.rounds[KMT]) : 7;
  const cap = E.eSpecOf(st).printPerTurn;
  if (cap != null) {
    const m = st.mechE, used = m && m.printTurn === st.turn ? m.printN : 0;
    acts = Math.min(acts, Math.max(0, cap - used - (own ? 1 : 0)));
    R = Math.min(R, cap);
  }
  return Math.min(1, discountedTurns(turn, turns) + acts / R);
}
// The red the Communists stand to lose at 左傾's last threshold: −villages in every village they control.
function eVillagesAtStake(st) {
  const sp = E.eSpecOf(st), n = sp.leftism[sp.leftism.length - 1].villages;
  let v = 0;
  for (const s of SPACES) {
    if (s.kind !== "village" || E.controller(st, s.id) !== CCP) continue;
    const [q, c] = E.infOf(st, s.id);
    const after = { ...st, inf: { ...st.inf, [s.id]: [Math.max(0, q - n), c] } };
    v += n * W_E.villageRed + (E.controller(after, s.id) !== CCP ? W_E.villageCtl : 0);
  }
  return v;
}
// C_t: what threshold `e` of `side`'s track costs that side, read now. 通膨: its 民心, the steps it moves the
// centrists toward the Communists (each worth the 結算 still to come), the cards it cuts at every refill after
// this turn (W_E.card each); the collapse: the steps from the threshold before it priced as the prints the
// Nationalists could still use (W_E.print a print, times the time left). 左傾 (but its last): its 民心 and the
// steps it moves the centrists toward the Nationalists; the last: the villages at stake.
function eThresholdCost(st, side, e, now) {
  const sp = E.eSpecOf(st), c = E.centristsOf(st), S = (n) => (n ? n * eSettlements(st) : 0);
  if (side === KMT) {
    if (e.lose) return ((e.at - eSegStart(st, side, e)) / sp.printStep) * W_E.print * ePrintRoom(st, now);
    return (e.vp || 0) + S(e.centrists ? clampC(sp, c + e.centrists) - c : 0) + (e.hand ? e.hand * W_E.card * discountedTurns(Math.max(1, st.turn), st.options.turns) : 0);
  }
  if (e === sp.leftism[sp.leftism.length - 1]) return eVillagesAtStake(st);
  return (e.vp || 0) + S(e.centrists ? c - clampC(sp, c + e.centrists) : 0);
}
function eSegStart(st, side, e) {
  const sp = E.eSpecOf(st), list = side === KMT ? sp.inflation : sp.leftism, i = list.indexOf(e);
  if (side === CCP && i === list.length - 1) return sp.leftismReset;
  return i > 0 ? list[i - 1].at : 0;
}
// The next threshold of `side`'s track still to come (左傾's last comes every time), or null.
function eNext(st, m, side) {
  const sp = E.eSpecOf(st);
  if (side === KMT) return sp.inflation.find((e) => !m.reached.inflation.includes(e.at)) ?? null;
  const last = sp.leftism[sp.leftism.length - 1];
  return sp.leftism.find((e) => e === last || !m.reached.leftism.includes(e.at)) ?? null;
}
// The part of the next threshold's cost that `side`'s track has walked (negative below the segment's start,
// after a 平抑, down to −C_t).
export function eTrackCost(st, side, now = false) {
  const m = st.mechE;
  if (!m) return 0;
  const e = eNext(st, m, side);
  if (e == null) return 0;
  const n = side === KMT ? m.inflation : m.leftism, a = eSegStart(st, side, e), t = e.at;
  return eThresholdCost(st, side, e, now) * Math.max(-1, Math.min(1, (n - a) / (t - a)));
}
// The smaller hand at every refill after this turn (the engine's `handCutFrom`; a threshold marked reached
// without its effect, as `E.setInflation` lays it out, from the next turn).
function eHandCut(st) {
  const m = st.mechE, h = E.eSpecOf(st).hand;
  if (!m || !h || (m.handCutFrom == null && !m.reached.inflation.includes(h.at))) return 0;
  const turn = Math.max(1, st.turn), from = Math.max(turn + 1, m.handCutFrom ?? turn + 1);
  let v = 0;
  for (let t = from; t <= st.options.turns; t++) v += GAMMA ** (t - turn);
  return h.hand * W_E.card * v;
}
function eCentrists(st) { return E.centristsOf(st) * E.eSpecOf(st).centristsVp * eSettlements(st); }
// E's part of the evaluation, from the Communists' point of view.
function eValue(st) { return eTrackCost(st, KMT) + eHandCut(st) - eTrackCost(st, CCP) + eCentrists(st); }
// What one more step of `side`'s own track costs `side` now (the orchestrator's 裁決 #36: 「這一方自己的軌再
// 走一格的價格」): the change of its part of the evaluation, and the effects of a threshold it crosses.
// (#37: a 印鈔 is `ePrintStep` steps of 通膨, priced as one move.)
export function ePrice(st, side) {
  if (!mechE(st) || !st.mechE) return 0;
  const sp = E.eSpecOf(st), m = st.mechE, sign = side === KMT ? 1 : -1;
  if (side === KMT && m.inflation + sp.printStep >= sp.inflationMax) return E_LOSS;
  const own = (s) => eTrackCost(s, side, true) + (side === KMT ? eHandCut(s) : 0) + sign * eCentrists(s);
  const n = side === KMT ? m.inflation + sp.printStep : m.leftism + 1;
  const reached = { inflation: m.reached.inflation.slice(), leftism: m.reached.leftism.slice() };
  let mandate = 0, centrists = m.centrists, level = n;
  if (side === KMT) {
    for (const e of sp.inflation) {
      if (n < e.at || reached.inflation.includes(e.at)) continue;
      reached.inflation.push(e.at);
      if (e.vp) mandate += e.vp;
      if (e.centrists) centrists = clampC(sp, centrists + e.centrists);
    }
  } else {
    const last = sp.leftism[sp.leftism.length - 1];
    for (const e of sp.leftism.slice(0, -1)) {
      if (n < e.at || reached.leftism.includes(e.at)) continue;
      reached.leftism.push(e.at);
      if (e.centrists) centrists = clampC(sp, centrists + e.centrists);
      if (e.vp) mandate += e.vp;
    }
    if (n >= last.at) { mandate += eVillagesAtStake(st); level = sp.leftismReset; }
  }
  const after = { ...st, mechE: { ...m, reached, centrists, ...(side === KMT ? { inflation: level } : { leftism: level }) } };
  return mandate + own(after) - own(st);
}
// May the Nationalists print now without losing on the spot (通膨 at the collapse)?
const printable = (st, side) => mechE(st) && side === KMT && E.inflationOf(st) + E.eSpecOf(st).printStep < E.eSpecOf(st).inflationMax;
// A step that costs nothing (the last turn below 8; 8 to 9 at the game's last action): the print dominates
// the same play without it, which is then not offered.
const freePrint = (st, side) => printable(st, side) && ePrice(st, side) <= 1e-9;
// The villages worth a 激進 now, best first: the red it adds there (E_SPEC.radical per op, under the cap)
// valued on the board, per op; at most RADICAL_TRY of those a 扶植 can reach.
const RADICAL_TRY = 2;
function radicalChoices(st, side, villages) {
  if (!villages || !villages.length) return [];
  const lit = E.placeTargets(st, side, 4, []).lit;
  const s = E.clone(st); s.log = [];
  const base = evaluate(s, side), scored = [];
  for (const v of villages) {
    if (!lit.has(v)) continue;
    const a = s.inf[v] || (s.inf[v] = [0, 0]), start = a[side], cost = E.placeCost(s, side, v);
    a[side] = Math.min(E.capOf(s, v), start + E.eSpecOf(s).radical * cost); // #37: eRadical
    scored.push({ v, r: (evaluate(s, side) - base) / cost });
    a[side] = start;
  }
  return scored.sort((x, y) => y.r - x.r).slice(0, RADICAL_TRY).map((x) => x.v);
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
  if (p.side != null) r = Math.min(r, E.capOf(s, id) - E.pointsOf(s, side, id)); // #31: the Nationalists count gray
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
// #36, mechanism E: `radical` (a village of `E.radicalOptions`) makes it a 激進: the first point goes there,
// and every point there is E_SPEC.radical red per op it costs (the engine's `radicalRed`, under the cap).
// Without it (null) every line below reads as before.
export function greedyPlacement(st, side, ops, card, restrict = null, radical = null) {
  const s = E.clone(st); s.log = [];
  const points = [];
  const RAD = E.eSpecOf(st).radical; // #37: eRadical
  const redFor = (a, id, c) => { a[side] = Math.min(E.capOf(s, id), a[side] + RAD * c); };
  if (radical != null) {
    if ((restrict && !restrict(radical)) || !E.placeTargets(st, side, ops, [], card, radical).lit.has(radical)) return [];
    redFor(s.inf[radical] || (s.inf[radical] = [0, 0]), radical, E.placeCost(s, side, radical));
    points.push(radical);
  }
  for (let guard = 0; guard < 12; guard++) {
    const { lit, left } = E.placeTargets(st, side, ops, points, card, radical);
    const ids = [...lit].filter((id) => !restrict || restrict(id));
    if (!ids.length) break;
    const bonus = card === "soviet_aid" && points.every(inNortheast) ? 1 : 0;
    const base = evaluate(s, side);
    let best = null, bestR = -Infinity;
    for (const id of ids) {
      const a = s.inf[id] || (s.inf[id] = [0, 0]), start = a[side], cap = E.capOf(s, id) - (side === KMT ? E.grayOf(s, id) : 0); // #31
      const budget = left + (bonus && inNortheast(id) ? 1 : 0);
      let spent = 0, here = -Infinity;
      for (let k = 0; k < 3 && a[side] < cap; k++) {
        const c = E.placeCost(s, side, id);
        if (spent + c > budget) break;
        if (id === radical) redFor(a, id, c); else a[side]++;
        spent += c;
        const r = (evaluate(s, side) - base) / spent;
        if (r > here) here = r;
      }
      a[side] = start;
      if (here > bestR) { bestR = here; best = id; }
    }
    if (best == null) break;
    points.push(best);
    const b = s.inf[best] || (s.inf[best] = [0, 0]);
    if (best === radical) redFor(b, best, E.placeCost(s, side, best)); else b[side]++;
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
  if (mechD(st)) {
    // #32, D's markers: the last 易幟 by conquest is control of the power's home; 整編完成 needs a
    // 整編, never a placement alone.
    if (side === CCP && Object.keys(st.mie).length >= st.options.mie - 1) {
      for (const [p, d] of Object.entries(E.DPOWERS)) if (!st.mie[p] && !st.seals[p]) out.push({ ids: [d.home], done: (s, x) => E.controller(s, x) === CCP });
    }
  } else if (side === CCP && Object.keys(st.mie).length >= st.options.mie - 1) {
    for (const id of Object.keys(STATES)) if (!st.mie[id]) out.push({ ids: E.spacesOfState(id), done: (s, x) => E.controller(s, x) === CCP });
  }
  if (side === KMT && !mechD(st) && Object.keys(st.seals).length >= st.options.seals - 1) {
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
// `top` (#27) is passed by the decision itself, never inside a simulation: an
// attack on a city is then one candidate, valued by its 圍點打援 game, and when it
// is the best its plan is drawn from the game's mix; `top.game` gets the game.
// #36, mechanism E: `ask` is the ops question itself; under E it says whether these ops may be printed
// (`canPrint`) and where a 激進 could go (`radical`), and the printed / radical versions are offered too.
function bestOps(st, who, ops, allowed, rng, card, top = null, ask = null) {
  const aid = card && E.isAid(card) ? card : undefined;
  const o = E.opsOptions(st, who, aid);
  const cands = [], sieges = new Set();
  const print = !!(ask && ask.canPrint) && printable(st, who), plain = !(print && freePrint(st, who));
  const PR = E.eSpecOf(st).print; // #37: ePrintOps
  if (allowed.includes("place")) {
    if (plain) {
      const points = greedyPlacement(st, who, ops, aid); if (points.length) cands.push({ use: "place", points });
      for (const pts of winningPlacements(st, who, ops, aid)) cands.push({ use: "place", points: pts });
    }
    if (print) {
      const points = greedyPlacement(st, who, ops + PR, aid); if (points.length) cands.push({ use: "place", points, print: true });
      for (const pts of winningPlacements(st, who, ops + PR, aid)) cands.push({ use: "place", points: pts, print: true });
    }
    if (ask && ask.radical && ask.radical.length && who === CCP && mechE(st)) {
      for (const v of radicalChoices(st, who, ask.radical)) {
        const points = greedyPlacement(st, who, ops, aid, null, v); if (points.length) cands.push({ use: "place", points, radical: v });
      }
    }
  }
  if (allowed.includes("campaign")) {
    for (const t of o.campaignTargets) {
      if (top && E.siegeNeeded(st, who, t)) { const x = { use: "campaign", target: t, siege: E.SIEGE_PLANS[0] }; sieges.add(x); cands.push(x); }
      else for (const x of attacks(st, who, t)) {
        if (plain) cands.push({ use: "campaign", ...x });
        if (print) cands.push({ use: "campaign", ...x, print: true });
      }
    }
  }
  if (allowed.includes("lobby")) for (const t of lobbyTargetsFor(st, who, o.lobbyTargets)) cands.push({ use: "lobby", target: t.id });
  // Mechanism D (#31): 政工, offered by the ops ask only under D.
  const pol = allowed.includes("politics") ? E.politicsOptions(st, who, ops) : [];
  if (pol.length) {
    // #32: never a 整編 that is an 易幟 on the spot, while anything else is offered.
    const ok = who === KMT ? E.supplied(st) : null;
    if (plain) for (const t of pol) {
      const c = { use: "politics", ...politicsPayload(who, t) };
      if (!(ok && cands.length && suicideIntegrate(st, who, c, ok))) cands.push(c);
    }
  }
  // #36: 政工 with printed ops (D and E both on), on the targets of the bigger ops.
  if (print && allowed.includes("politics")) {
    const ok = E.supplied(st);
    for (const t of E.politicsOptions(st, who, ops + PR)) {
      const c = { use: "politics", ...politicsPayload(who, t), print: true };
      if (!(cands.length && suicideIntegrate(st, who, c, ok))) cands.push(c);
    }
  }
  // Nothing worth trying (no point affordable, no 遊說 that gains): an empty 扶植 spends nothing.
  if (!cands.length) return allowed.includes("place") ? { use: "place", points: [] } : allowed.includes("campaign") ? { use: "campaign", ...attacks(st, who, o.campaignTargets[0])[0] } : { use: "lobby", target: o.lobbyTargets[0].id };
  if (!sieges.size) return bestOf(st, who, cands, rng);
  // bestOf's loop, with an attack on a city valued by its game (an answer to a pending: no noise).
  let best = null, bestV = -Infinity, bestG = null;
  for (const ch of cands) {
    const a = { type: "choose", side: who, choice: ch };
    let v, g = null;
    if (sieges.has(ch)) { g = siegeGame(st, who, a, rng, 0); v = g.game.value; }
    else v = meanEval(st, a, who, rng, rollsFor(st, a));
    if (v > bestV) { bestV = v; best = ch; bestG = g; }
  }
  if (!bestG) return best;
  top.game = bestG.game;
  return { ...best, siege: drawFrom(bestG.game.mix, rng) };
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
    case "ops": return bestOps(st, who, p.ops, p.allowed, rng, p.card, null, p);
    default: throw new Error(`answer: ${p.kind}`);
  }
}

// ---------- 圍點打援 as a zero-sum game (#27) ----------
// The owner's note (mechanisms, B, 「bot」): value every cell -- the Communists'
// plan (打點 / 打援) against each answer of the Nationalists (固守 / 增援 / 突圍)
// -- by the board it leaves, solve the zero-sum game, draw from the mix; 「容易」
// leans to one cell so a player can learn it, 「困難」 plays the equilibrium.
// Orchestrator 裁決 #27: normal and hard both solve (normal's values carry its
// noise); easy is the random player with the lean below; 進剿's 守 / 撤 is an
// ordinary choice. A cell is valued by the side deciding, with its own
// evaluation; the Communists' −1 / +1 inside a cell is their best one.
export const EASY_SIEGE = { point: 0.8, hold: 0.8 };
const SIEGE_MARK = Symbol("siege");
const mechB = (st) => !!(st.options && st.options.mechanismB);
// 政工's payload (#31): the Nationalists' 整編 names a space, the Communists' 統戰 a power.
const politicsPayload = (side, id) => (side === KMT ? { target: id } : { power: id });

// The value of the zero-sum game M (M[i][j] what the row player gets; rows
// maximise, columns minimise) and an equilibrium: { row, col, value }, the two
// strategies as arrays of probabilities. Exact for games with at most two rows
// or two columns (the only ones 圍點打援 makes: 2 plans × the answers).
export function zeroSum(M) {
  const r = M.length, c = r ? M[0].length : 0;
  if (!r || !c || M.some((row) => row.length !== c)) throw new Error(`zeroSum: not a matrix ${JSON.stringify(M)}`);
  if (r === 1) {
    let j = 0;
    for (let k = 1; k < c; k++) if (M[0][k] < M[0][j]) j = k;
    return { row: [1], col: M[0].map((_, k) => (k === j ? 1 : 0)), value: M[0][j] };
  }
  if (r === 2) return twoRows(M);
  if (c <= 2) { // the column player's game: −Mᵀ, its rows maximising
    const s = zeroSum(M[0].map((_, j) => M.map((row) => -row[j])));
    return { row: s.col, col: s.row, value: -s.value };
  }
  throw new Error(`zeroSum: ${r} × ${c} (only 1 or 2 rows or columns)`);
}
// Two rows: the row player's p on row 0 gets f(p) = min_j (p·a_j + (1 − p)·b_j),
// the lower envelope of the columns' lines, concave; its maximum lies at p = 0,
// p = 1 or where two lines cross, and every such p is tried (a tie keeps the
// first). The columns' answer is read at that p from the lines that reach the
// value there (`active`): at p = 0 the one sloping down most, at p = 1 the one
// sloping up most, inside a flat one if any, else one rising and one falling
// line mixed so that both rows get the value.
function twoRows(M) {
  const [a, b] = M, m = a.length;
  const big = Math.max(1, ...a.map(Math.abs), ...b.map(Math.abs)), eps = 1e-9 * big;
  const line = (j, p) => p * a[j] + (1 - p) * b[j], slope = (j) => a[j] - b[j];
  const f = (p) => { let v = Infinity; for (let j = 0; j < m; j++) v = Math.min(v, line(j, p)); return v; };
  const ps = [0, 1];
  for (let j = 0; j < m; j++) for (let k = j + 1; k < m; k++) {
    const d = slope(j) - slope(k);
    if (d === 0) continue;
    const p = (b[k] - b[j]) / d;
    if (p > 0 && p < 1) ps.push(p);
  }
  let p = ps[0], v = f(p);
  for (const x of ps.slice(1)) { const fx = f(x); if (fx > v + eps) { p = x; v = fx; } }
  const active = [];
  for (let j = 0; j < m; j++) if (line(j, p) <= v + eps) active.push(j);
  const col = new Array(m).fill(0);
  const pick = (better) => active.reduce((x, y) => (better(slope(y), slope(x)) ? y : x));
  if (p === 0) col[pick((s, t) => s < t)] = 1;
  else if (p === 1) col[pick((s, t) => s > t)] = 1;
  else {
    const flat = active.find((j) => Math.abs(slope(j)) <= eps);
    const up = active.filter((j) => slope(j) > eps), down = active.filter((j) => slope(j) < -eps);
    if (flat != null || !up.length || !down.length) col[pick((s, t) => Math.abs(s) < Math.abs(t))] = 1;
    else {
      const u = up[0], d = down[0], su = slope(u), sd = slope(d);
      col[u] = -sd / (su - sd); col[d] = su / (su - sd);
    }
  }
  return { row: [p, 1 - p], col, value: v };
}
// A label drawn from a mix { label: probability }: never one of probability 0.
function drawFrom(mix, rng) {
  const keys = Object.keys(mix).filter((k) => mix[k] > 0);
  let u = rng.next() * keys.reduce((t, k) => t + mix[k], 0);
  for (const k of keys) { u -= mix[k]; if (u < 0) return k; }
  return keys[keys.length - 1];
}
// The action with its plan: a play's `siege`, or an ops choice's.
const withPlan = (a, plan) => (a.type === "play" ? { ...a, siege: plan } : { ...a, choice: { ...a.choice, siege: plan } });
// `action` (an attack on a city by the Communists) played on `st` up to the
// Nationalists' answer: the pendings on the way, if any, answered as in `simulate`.
function untilAsked(st, action, rng) {
  let s = E.apply(st, action);
  for (let guard = 0; s.pending && s.pending.tag !== "siege" && s.winner == null && guard < 16; guard++) {
    s = E.apply(s, { type: "choose", side: s.pending.who, choice: answer(s, s.pending, s.pending.who, rng) });
  }
  if (!s.pending || s.pending.tag !== "siege") throw new Error(`siegeGame: ${JSON.stringify(action)} did not reach the Nationalists' answer (phase ${s.phase}, pending ${s.pending && s.pending.tag})`);
  return s;
}
// The game, for `side`, from the two states that ask the Nationalists (the plan
// 打點, then 打援): each answer played out on each, valued by `side` (plus
// `noise` per cell), solved. { game, raw (the value without the noise), cells }.
function solveSiege(asked, side, rng, noise) {
  const rows = E.SIEGE_PLANS.slice(), cols = asked[0].pending.options.map((o) => o.id);
  if (JSON.stringify(asked[1].pending.options.map((o) => o.id)) !== JSON.stringify(cols)) throw new Error("siegeGame: the answers differ by plan");
  const cells = asked.map((s) => cols.map((c) => simulate(s, { type: "choose", side: KMT, choice: c }, rng)));
  const raw = cells.map((r) => r.map((s) => evaluate(s, side)));
  const values = noise ? raw.map((r) => r.map((v) => v + noise * gauss(rng))) : raw;
  const T = (M) => M[0].map((_, j) => M.map((r) => r[j]));
  // The Communists choose a row; the Nationalists, who maximise their own values, a column.
  const solve = (M) => (side === CCP ? zeroSum(M) : zeroSum(T(M)));
  const s = solve(values), mine = side === CCP ? rows : cols, theirs = side === CCP ? cols : rows;
  const label = (keys, ps) => Object.fromEntries(keys.map((k, i) => [k, ps[i]]));
  return {
    game: { rows, cols, values, mix: label(mine, s.row), against: label(theirs, s.col), value: s.value },
    raw: noise ? solve(raw).value : s.value,
    cells,
  };
}
// The Communists' attack on a city (`action`, plan not yet named) on the guess `st`.
function siegeGame(st, side, action, rng, noise) {
  return solveSiege(E.SIEGE_PLANS.map((plan) => untilAsked(st, withPlan(action, plan), rng)), side, rng, noise);
}
// The Nationalists asked to answer on the guess `st`: the plan face down, so
// each row puts its own plan on the step (the guess's random one is never read).
function siegeAnswer(st, side, rng) {
  if (!st.plan.length || st.plan[0].do !== "siege") throw new Error(`siegeAnswer: the plan's first step is ${st.plan[0] && st.plan[0].do}`);
  const asked = E.SIEGE_PLANS.map((plan) => ({ ...st, plan: [{ ...st.plan[0], plan }, ...st.plan.slice(1)] }));
  const { game } = solveSiege(asked, side, rng, 0);
  return { type: "choose", side, choice: drawFrom(game.mix, rng), game, why: "siege" };
}
// Easy (orchestrator 裁決 #27): the random player, leaning to 打點 and to 固守.
function easySiege(view, side, rng) {
  const p = view.pending;
  if (p && p.tag === "siege" && p.who === side) {
    const ids = p.options.map((o) => o.id), rest = ids.filter((id) => id !== "hold");
    return { type: "choose", side, choice: !rest.length || rng.next() < EASY_SIEGE.hold ? "hold" : pickOne(rest, rng), why: "random" };
  }
  const a = randomAction(view, side, rng);
  if (!a) return a;
  const plan = () => (rng.next() < EASY_SIEGE.point ? "point" : "relief");
  if (a.type === "play" && a.siege) a.siege = plan();
  else if (a.type === "choose" && a.choice && typeof a.choice === "object" && a.choice.siege) a.choice = { ...a.choice, siege: plan() };
  a.why = "random";
  return a;
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
// `sieges` (#27, a Set) is passed by the decision itself, never inside a
// simulation: an attack on a city that must name a plan is then ONE candidate
// (its `siege` a placeholder, the plan is drawn from its game), put in the set.
function actionCandidates(st, side, L, sieges = null) {
  if (L.bog && L.bog.length) return L.bog.map((c) => ({ type: "play", side, card: c, use: "bog" }));
  const out = [];
  const atk = (t) => (sieges && E.siegeNeeded(st, side, t) ? [{ target: t, siege: E.SIEGE_PLANS[0], [SIEGE_MARK]: true }] : attacks(st, side, t));
  const lob = (targets) => lobbyTargetsFor(st, side, targets);
  const memo = new Map();
  const placed = (ops, card, restrict, tag, radical = null) => {
    const key = `${ops}/${card || ""}/${tag || ""}`;
    if (!memo.has(key)) memo.set(key, greedyPlacement(st, side, ops, card, restrict, radical));
    return memo.get(key);
  };
  const winPlace = (ops, make, card, restrict) => {
    for (const points of winningPlacements(st, side, ops, card, restrict)) { const a = make(points); if (winsNow(st, a)) out.push(a); }
  };
  // Mechanism E (#36): the Nationalists' 印鈔 (`uses.print`, under E only) -- each 扶植, attack and 政工 of the
  // card once more with the ops + E_SPEC.print and `print: true`; a free step (`freePrint`) offers only those.
  // The Communists' 激進 (`L.radical`, under E only): a 扶植 that starts in one of the best villages
  // (`radicalChoices`), per number of ops.
  const PR = E.eSpecOf(st).print; // #37: ePrintOps
  const canPrint = printable(st, side), freeStep = canPrint && freePrint(st, side);
  const rads = side === CCP && L.radical && L.radical.length && mechE(st) ? radicalChoices(st, side, L.radical) : [];
  for (const c of L.cards) {
    const u = c.uses, id = c.id;
    out.push({ type: "play", side, card: id, use: "event" });
    if (CARD[id].scoring) continue;
    const order = u.enemy ? { order: "opsFirst" } : {};
    const pr = canPrint && u.print, plain = !(pr && freeStep);
    if (u.reform) out.push({ type: "play", side, card: id, use: "reform" });
    if (u.place) {
      if (plain) {
        const points = placed(u.place.ops);
        if (points.length) out.push({ type: "play", side, card: id, use: "place", ...order, points });
        winPlace(u.place.ops, (pts) => ({ type: "play", side, card: id, use: "place", ...order, points: pts }));
      }
      if (pr) {
        const points = placed(u.place.ops + PR);
        if (points.length) out.push({ type: "play", side, card: id, use: "place", ...order, print: true, points });
        winPlace(u.place.ops + PR, (pts) => ({ type: "play", side, card: id, use: "place", ...order, print: true, points: pts }));
      }
      for (const v of rads) {
        const points = placed(u.place.ops, undefined, null, `radical:${v}`, v);
        if (points.length) out.push({ type: "play", side, card: id, use: "place", ...order, radical: v, points });
      }
    }
    if (u.campaign) for (const t of u.campaign.targets) for (const x of atk(t)) {
      if (plain) out.push({ type: "play", side, card: id, use: "campaign", ...order, ...x });
      if (pr) out.push({ type: "play", side, card: id, use: "campaign", ...order, print: true, ...x });
    }
    if (u.lobby) for (const t of lob(u.lobby.targets)) out.push({ type: "play", side, card: id, use: "lobby", ...order, target: t.id });
    // Mechanism D (#31): 政工 on every target the engine offers (`uses.politics` exists only under D),
    // valued like any other play; the bots know nothing else of D yet (that is the next issue).
    if (u.politics && plain) for (const t of u.politics.targets) out.push({ type: "play", side, card: id, use: "politics", ...order, ...politicsPayload(side, t) });
    if (u.politics && pr) for (const t of E.politicsOptions(st, side, u.politics.ops + PR)) out.push({ type: "play", side, card: id, use: "politics", ...order, print: true, ...politicsPayload(side, t) });
    if (u.enemy && (u.place || u.campaign || u.lobby)) out.push({ type: "play", side, card: id, use: "place", order: "eventFirst" });
    if (u.pair && u.pair.length && (u.place || u.campaign || u.lobby)) {
      const pair = u.pair.reduce((a, b) => (CARD[b].ops > CARD[a].ops ? b : a));
      const pops = E.opsOf(st, side, pair);
      if (u.place) {
        const points = placed(pops);
        if (points.length) out.push({ type: "play", side, card: id, pair, use: "place", points });
        winPlace(pops, (pts) => ({ type: "play", side, card: id, pair, use: "place", points: pts }));
      }
      if (u.campaign) for (const t of u.campaign.targets) for (const x of atk(t)) out.push({ type: "play", side, card: id, pair, use: "campaign", ...x });
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
      // #36: 蘇援's 扶植 may be a 激進 too (an aid card never prints).
      for (const v of rads) {
        const points = placed(a.ops, id, null, `radical:${v}`, v);
        if (points.length) out.push(play("place", { radical: v, points }));
      }
    }
    if (a.campaign) for (const t of a.campaign.targets) for (const x of atk(t)) out.push(play("campaign", x));
    if (a.lobby) for (const t of lob(a.lobby.targets)) out.push(play("lobby", { target: t.id }));
  }
  // Mechanism E: 平抑 (`legal().peg`, under E only) is a candidate whenever the engine allows it (#36; #35 offered
  // it only to an empty hand with no other use of the aid card), valued as any play: 通膨 −E_SPEC.peg.
  if (L.peg) out.push({ type: "play", side, card: "american_aid", use: "peg" });
  if (sieges) for (const a of out) if (a[SIEGE_MARK]) { delete a[SIEGE_MARK]; sieges.add(a); }
  return dropSuicideIntegrate(st, side, dropSelfCollapse(st, side, out));
}

// The other side's best one-ply reply, from the sampled state.
function replyValue(st, action, side, rng) {
  const k = rollsFor(st, action, DICE_K_REPLY);
  if (k > 1) { let t = 0; for (let i = 0; i < k; i++) t += replyOnce({ ...st, rngState: rng.int(2 ** 31) }, action, side, rng); return t / k; }
  return replyOnce(st, action, side, rng);
}
function replyOnce(st, action, side, rng) { return replyFrom(simulate(st, action, rng), side, rng); }
// The other side's best one-ply reply from `s`, a state already played out.
function replyFrom(s, side, rng) {
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
// Mechanism B (#27): an attack on a city by the Communists (an action-round
// candidate, or an attack in an ops choice) and the Nationalists' answer to one
// are 圍點打援 games (`siegeGame`, `siegeAnswer`); the decision carries its `game`
// (the bot's note: rows, cols, values, mix, against, value), which is not part
// of the move and is taken off before it reaches the engine.
export function decide(view, side, level = "normal", rng) {
  if (level === "easy") {
    if (mechB(view)) return easySiege(view, side, rng);
    const a = randomAction(view, side, rng); if (a) a.why = "random"; return a;
  }
  const st = determinize(view, side, rng);
  const L = E.legal(st, side);
  const noise = NOISE[level] ?? 0.6;
  switch (L.kind) {
    case "pending": {
      const p = L.pending;
      if (p.tag === "siege" && side === KMT) return siegeAnswer(st, side, rng);
      if (p.kind === "ops" && side === CCP && mechB(st)) {
        const top = {}, choice = bestOps(st, side, p.ops, p.allowed, rng, p.card, top, p);
        return { type: "choose", side, choice, ...(top.game ? { game: top.game } : {}), why: p.kind };
      }
      return { type: "choose", side, choice: answer(st, p, side, rng), why: p.kind };
    }
    case "headline": return L.cards.length ? { type: "headline", side, card: bestHeadline(view, side, L.cards, rng, level), why: "headline" } : null;
    case "action": {
      const sieges = new Set();
      const cands = actionCandidates(st, side, L, sieges);
      if (!cands.length) return null;
      const games = new Map();
      const scored = cands.map((a) => {
        if (sieges.has(a)) { const g = siegeGame(st, side, a, rng, noise); games.set(a, g); return { a, raw: g.raw, v: g.game.value }; }
        const raw = evalAction(st, a, side, rng); return { a, raw, v: raw + noise * gauss(rng) };
      });
      scored.sort((x, y) => y.v - x.v);
      // An attack on a city goes to the win check with the plan it would draw.
      const plans = new Map();
      const wins = scored.filter((x) => x.raw >= 1000 - 1e-6).map((x) => {
        if (!games.has(x.a)) return x;
        const a = { ...x.a, siege: drawFrom(games.get(x.a).game.mix, rng) };
        plans.set(a, x.a);
        return { ...x, a };
      });
      const sure = surestWin(view, side, st, wins);
      if (sure) {
        const g = plans.has(sure) && games.get(plans.get(sure));
        return { ...sure, ...(g ? { game: g.game } : {}), why: `${sure.use}:${sure.card}` };
      }
      const top = scored.slice(0, level === "hard" ? 4 : 1);
      if (level === "hard" && top.length > 1) {
        for (const t of top) t.v = (games.has(t.a) ? siegeReply(games.get(t.a), side, rng) : replyValue(st, t.a, side, rng)) + noise * gauss(rng);
        top.sort((x, y) => y.v - x.v);
      }
      const a = top[0].a;
      if (games.has(a)) {
        const g = games.get(a).game;
        return { ...a, siege: drawFrom(g.mix, rng), game: g, why: `${a.use}:${a.card}` };
      }
      return { ...a, why: `${a.use}:${a.card}` };
    }
    default: return null;
  }
}
// 困難's look one ply further for an attack on a city: the other side's best
// reply after each cell, weighted by the two mixes (cells of probability 0 skipped).
function siegeReply(g, side, rng) {
  const { mix, against, rows, cols } = g.game;
  let v = 0;
  for (let i = 0; i < rows.length; i++) for (let j = 0; j < cols.length; j++) {
    const w = mix[rows[i]] * against[cols[j]];
    if (w > 0) v += w * replyFrom(g.cells[i][j], side, rng);
  }
  return v;
}
