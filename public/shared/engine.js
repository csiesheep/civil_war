// CIVIL WAR, PHASE 0. This file is Zongheng's engine (csiesheep/zongheng at
// 686b439), copied, the seats renamed (QIN/CHU -> CCP/KMT), and then changed
// in exactly these places so that a game of this map can be set up:
//   - the eras, the 民生 level names, the default options;
//   - the capitals and home regions now come from board.js;
//   - `campaignLocked` reads the main front from the region data;
//   - `startGame` reads the whole setup from board.js; the free placement is
//     the turn-1 時局 (受降), over a list of spaces rather than of regions;
//   - 洛邑 yields nothing (there is no such space);
//   - the export module is not imported;
//   - `supplied` / `isolatedCities` at the end are new (rulebook 三, 補給).
// And since then, in M1 (one line per issue, the details at the code):
//   - #1 supply's effects (option `supply`): the Nationalists may not 扶植 into
//     a city out of supply (`placeBarred`, read by placeTargets, placePoints and
//     opsOptions), and each 孤城 loses blue at the end of the turn, after the
//     capital check (`supplyAttrition` in endTurnChecks, log `attrition`).
//   - #2 the eight 時局 (`SITUATIONS`, read from the turn number where each
//     rule is: `situationStep` at the start of the turn, before the refill;
//     `sovietHeld`, `campaignMod`, `campaignLocked(st, id, side)`, `campaign`,
//     `jumpOpen`, `reformAdvance`, `attritionLoss`); each side's own hand size
//     and action rounds per era (`ERAS`, `st.rounds` = [Communists,
//     Nationalists], `endAction`); the two support tracks (`st.support`,
//     `moveSupport`) -- only the numbers, not the aid cards.
//   - #3 the home-region lock binds only the attacker of the opponent's home
//     (option `homeLockSide`, `homeLocked`).
//   - #4 Zongheng's Nine Cauldrons are gone; each side has its own aid card
//     (`AID`: 蘇援, 美援; option `aid`; `st.aidUsed`, `aidUsable`, `legal().aid`),
//     ops = its support track (`opsOf`), 蘇援 +1 all in the Northeast
//     (`aidBonus`), 美援's airlift into a 孤城 (`airliftOk`, `placeTargets` /
//     `placePoints` / `opsOptions` take the card); and 美軍駐華 (`garrisoned`).
//   - #5 base areas count as 要衝 when a region scores (`baseScoring`, `regionTally`).
//   - #6 the hooks the 24 cards of 接收期 need (their events are in cards.js):
//     one test of "may `side` 奇襲 this space" (`canCampaign`), read by
//     `opsOptions` and by an event's free 奇襲 (`eventCampaignTargets`); the
//     `campaignBan` effect (`campaignBanned`, also checked by `doOps`); and
//     Zongheng's 說客 pairing is 馬歇爾調處's (`MARSHALL`, `marshallPairs`).
//   - #7 the one hook the 22 cards of 易勢期 need (their events are in cards.js):
//     a `campaign` effect may name a kind of space (`spaceKind`, read by
//     `campaignMod`). 潛伏, 久攻不下 and 熊向暉 use Zongheng's `forced`, `bog`
//     and `revealed` as they are.
//   - #8 the hooks the 21 cards of 決戰期 need (their events are in cards.js):
//     a `campaignBan` may bar one side only (`who`, read by `campaignBanned(st,
//     id, side)`); 民心 owed at this turn's 結算 (`turnEndVp`, paid in
//     `endTurnChecks`); a turn with no 孤城 attrition (`noAttrition`, read by
//     `attritionLoss`). With these all 72 cards have their events.
// And in M2:
//   - #13 three switches for the control cells (DEFAULT_OPTIONS): `situations`
//     (the one reading of the 時局 in effect, `situationNow`; the support
//     tracks' fixed moves are `SUPPORT_SCHEDULE`, outside it), `rounds` (the
//     hand sizes and action rounds, `eraLimits`), `garrison` (`garrisoned`).
// And in M2b:
//   - #26 mechanism B as the option `mechanismB` (not a default): `SIEGE`; an
//     attack paid with ops is 圍點打援 on a city for the Communists (`siegeStep`,
//     the plan hidden by `view`), 進剿 for the Nationalists (`sweepStep`); the
//     one reading of an attack's X (`attackPower`); 圍城 (`besieged`, read by
//     `canPlaceAt`, `campaignMod` and `isolatedCities`).
// EVERYTHING ELSE IS STILL ZONGHENG'S RULES, and its comments still cite
// Zongheng's rulebook and issue numbers. The Phase 0
// slice was written and checked by one session only (TEAM.md).
//
// Pure rules. Runs unchanged in the browser (solo) and in the room Durable
// Object. Deterministic: the seeded RNG lives in the state, so a game replays
// from seed + actions, which is what makes the tests and the harness cheap.
//
// Shape of the machine. The state carries a `plan`: a queue of steps (an
// event to resolve, ops to spend, the end of an action round, the end of a
// turn). `run` executes steps until one needs a decision, which it parks in
// `pending` (who decides, what kind of choice, the options). The four
// external actions are `setup`/`headline`/`play`/`choose`; each validates,
// mutates, then calls `run`. Every rule in the rulebook
// (Projects/zongheng/zongheng - rulebook.md) has a named function here.
//
// One `apply` is therefore not one "move": `run` stops only at a decision,
// never at a boundary in the turn structure. When nobody can play, a single
// `apply` walks out the rest of the action rounds, the end-of-turn scoring and
// the next deal, and hands back a state waiting on the next headline. That is
// the rulebook (四、細則:「兩人皆無合法行動時(理論上不會),該行動回合跳過」,
// and nothing in 三、回合結構 4「結算」 is a player's choice except the 明法令
// discard, which does park). tests/engine-validation.test.js pins it.
export * from "./board.js";
import {
  SPACES, SPACE, REGIONS, SCORED_REGIONS, STATES, SETUP, spacesOf, spacesOfState,
  HOME_REGION, HOME_CAPITAL, MOVED_CAPITAL,
} from "./board.js";
import { CARDS, CARD, ERA_DECKS } from "./cards.js";
export { CARDS, CARD, ERA_DECKS };

export const CCP = 0, KMT = 1;
export const SIDES = ["ccp", "kmt"];
export const other = (s) => 1 - s;
export const MIN_PLAYERS = 2, MAX_PLAYERS = 2;
// 外援牌 (#4, rulebook 三, 外國勢力 1): Zongheng's Nine Cauldrons are gone. Each
// side has its own aid card, indexed by seat, which never changes hands and is
// not a card of the 72: it is never in a hand, the draw, the discard or the
// removed pile. Once a turn (`st.aidUsed`, reset by `startTurn`), in its own
// action round instead of a card from its hand, for 扶植 / 奇襲 / 遊說 only, with
// ops = that side's support track (`opsOf`); not at 0. 蘇援 all in the
// Northeast: +1 (`aidBonus`); 美援 all in cities: may 扶植 into a 孤城
// (`airliftOk`). Option `aid` (DEFAULT_OPTIONS).
export const AID = [
  { id: "soviet_aid",   zh: "蘇援", en: "Soviet Aid" },
  { id: "american_aid", zh: "美援", en: "American Aid" },
];
export function isAid(id) { return AID.some((a) => a.id === id); }
const aidSide = (id) => AID.findIndex((a) => a.id === id);
export const MANDATE_TO_WIN = 20;
// 民心勝利 (#24, owner 裁決 #23, 2026-10-04, P10), each [Communists, Nationalists]:
// the mandate that wins at once (the Communists' is still MANDATE_TO_WIN, the
// Nationalists' 15); the first turn that side may win on the mandate (the
// Nationalists from turn 6, the Communists from turn 7; one already beyond its
// threshold then wins at the start of that turn, `startTurn`); and before that
// turn how far the mandate may lean its way (19 toward the Communists, 3 toward
// the Nationalists: `vp` clamps it there). The options `mandateWin`,
// `mandateFrom`, `mandateCap`, `mandateEarly` and `mandateCapUntil` (#23) are
// laid over these; `mandateEarly` other than "clamp" (absent is "clamp") lets
// the mandate count past the bound before `mandateFrom` instead.
export const MANDATE_WIN = [MANDATE_TO_WIN, 15];
export const MANDATE_FROM = [7, 6];
export const MANDATE_CAP = [19, 3];
export const WEARINESS_NAMES = { 5: "復員", 4: "動盪", 3: "通膨", 2: "凋敝", 1: "崩潰" };
// Era: the deck shuffled in before that turn's refill; hand size and action
// rounds follow the era (rulebook 三, 回合結構), each side its own (#2):
// `hand` and `rounds` are [Communists, Nationalists], indexed by seat.
// The Communists act first, the two alternate, and the side with more action
// rounds takes its extra one(s) last (`endAction`).
// #24 (owner 裁決 #23, 2026-10-04, P10): 接收期 rounds 共 6 → 7; 易勢期 rounds
// 共 7 / 國 7 → 8 / 6; 決戰期 hand 共 9 / 國 8 → 8 / 9 and rounds 共 7 / 國 6 → 6 / 7.
export const ERAS = [
  { id: "takeover", zh: "接收期", en: "Takeover era", from: 1, hand: [8, 9], rounds: [7, 7] },
  { id: "turning",  zh: "易勢期", en: "Turning era",  from: 4, hand: [9, 9], rounds: [8, 6] },
  { id: "decisive", zh: "決戰期", en: "Decisive era", from: 7, hand: [8, 9], rounds: [6, 7] },
];
// `rounds: "symmetric"` (#13, the control cell for the asymmetric rounds):
// Zongheng's numbers, the same for both sides -- hand 8 and 6 action rounds in
// turns 1 to 3, hand 9 and 7 from turn 4. The decks still follow `ERAS`.
export const SYMMETRIC_ERAS = [
  { from: 1, hand: 8, rounds: 6 },
  { from: 4, hand: 9, rounds: 7 },
];
// The one reading of turn `turn`'s hand sizes and action rounds, each
// [Communists, Nationalists]: `startTurn` and the refill read only this. Any
// value of `rounds` other than "symmetric" (an absent key included) is `ERAS`.
export function eraLimits(st, turn = st.turn) {
  const t = Math.max(1, turn);
  if (st.options.rounds === "symmetric") {
    const s = SYMMETRIC_ERAS.filter((e) => t >= e.from).pop();
    return { hand: [s.hand, s.hand], rounds: [s.rounds, s.rounds] };
  }
  const e = eraOf(t), o = tune(st, "eraRounds") && st.options.eraRounds[e.id];
  return { hand: (o && o.hand ? o.hand : e.hand).slice(), rounds: (o && o.rounds ? o.rounds : e.rounds).slice() };
}
// 時局 (mechanism F, rulebook 三): eight, in a fixed order, one per turn, face up
// from the start. What each does is read from the turn number (`situationOf`)
// wherever the rule applies; nothing of it is kept in `st.effects`.
export const SITUATIONS = [
  { turn: 1, id: "surrender",         zh: "受降",     en: "The Surrender",          year: "1945 下" },
  { turn: 2, id: "truce",             zh: "停戰",     en: "The Truce",              year: "1946 上" },
  { turn: 3, id: "general_offensive", zh: "全面進攻", en: "The General Offensive",  year: "1946 下" },
  { turn: 4, id: "focused_offensive", zh: "重點進攻", en: "The Focused Offensives", year: "1947 上" },
  { turn: 5, id: "counteroffensive",  zh: "戰略反攻", en: "The Counteroffensive",   year: "1947 下" },
  { turn: 6, id: "constitution",      zh: "行憲",     en: "The Constitution",       year: "1948 上" },
  { turn: 7, id: "decisive_battle",   zh: "決戰",     en: "The Decisive Battles",   year: "1948 下" },
  { turn: 8, id: "peace_talks",       zh: "和談",     en: "The Peace Talks",        year: "1949" },
];
export function situationOf(turn) { return SITUATIONS.find((s) => s.turn === turn) || null; }
// The 時局's 奇襲 modifiers (`situationCampaignMod`), each for the side and the
// kind of target its 時局 names: 全面進攻 the Nationalists +n; 重點進攻 the
// Nationalists +[0] in 西北 and 華東中原, −[1] elsewhere; 戰略反攻 the Communists
// +n on a village; 決戰 the Communists +n on a city. #24 (owner 裁決 #23,
// 2026-10-04, P10): 戰略反攻 +1 → +2, 決戰 +1 → 0 (決戰 still frees the
// Communists' 奇襲 on a city from 民生 and from the 凋敝 lock). The option
// `situationCampaign` is laid over this key by key.
export const SITUATION_CAMPAIGN = { general_offensive: 1, focused_offensive: [1, 1], counteroffensive: 2, decisive_battle: 0 };
// The 時局 in effect now (#13): the ONE question every rule of a 時局 asks
// (`sovietHeld`, `situationUnlocks` so `campaignLocked`, `situationCampaignMod`
// so `campaignMod`, `truceBroken`, `jumpOpen`, `reformAdvance`, `attritionLoss`,
// the free placements in `startGame`, `situationStep`). Turn 0 is the setup,
// which is turn 1's free placement (受降). With `situations: false` it is null
// on every turn: none of the eight has an effect of its own. `situationOf` is
// the data and answers either way; the support tracks' fixed moves do not ask
// this (`SUPPORT_SCHEDULE`, they are 外國勢力's).
export function situationNow(st) {
  if (st.options.situations === false) return null;
  return situationOf(Math.max(1, st.turn));
}
// The reform track's numbers (threshold, 先到 / 後到, the perk), the same for
// both sides. Its box names are each side's own (#9): `reformName`.
export const REFORM = [
  { box: 1, ops: 2, first: 1, second: 0, perk: null },
  { box: 2, ops: 2, first: 0, second: 0, perk: "twice" },
  { box: 3, ops: 2, first: 1, second: 0, perk: "campaign" },
  { box: 4, ops: 3, first: 0, second: 0, perk: "peek" },
  { box: 5, ops: 3, first: 2, second: 0, perk: "discard" },
  { box: 6, ops: 4, first: 3, second: 1, perk: "emperor" },
];
// #9, the rulebook's table: the Communists' track is 建軍, the Nationalists' 行憲.
const REFORM_NAMES = [
  ["五四指示", "土地法大綱", "新式整軍", "隱蔽戰線", "約法八章", "開國"],
  ["政協決議", "制憲國大", "美械整編師", "保密局", "戡亂動員", "就職"],
];
// The name of `side`'s box `box` (1 to 6); null for anything else.
export function reformName(side, box) {
  return (REFORM_NAMES[side] && REFORM_NAMES[side][box - 1]) ?? null;
}
// The rulebook's open numbers, each a harness cell. `scoringSplit`: "homes"
// scores 三晉 + both homes in the reform era and 東方 + 北疆 from the alliance
// era; "v2" is the rulebook's first draft (東方 early, 西土 late), which scored
// Chu's home two and a half times as often as Qin's.
// `sealAt`: "control" gives Chu a 相印 on controlling the capital; "cap" only
// once Chu's influence there sits at the cap (stability + 2).
// `tie`: who wins a level Mandate after the final scoring.
// `hangu`: Qin's starting influence in 函谷關 (stability 3): 2 leaves Qin with one
// controlled home space at the start against Chu's two, 3 makes it two each.
// `wuguo`: "any" lets 五國伐秦 strike any West space; "nonbg" keeps it out of 關中.
// `yue`: "lasting" gives 楚滅越 a +1 on every South scoring, "none" leaves it at the two points.
// `westBonus`: 司馬錯伐蜀 also gives Qin +1 on every West scoring (the granary of 蜀).
// `reach`: "ts" (the rule since #107; owner, 2026-09-22: 「B 改成預設」) places
// where you have influence or next to ANY space where you have influence, with
// the eligible set fixed at the start of the place action -- a space reachable
// only through a point placed earlier in the same action is not eligible.
// "control" is the first-draft rule (#104's other cell): where you have
// influence or next to a space you CONTROL, re-read point by point, so a point
// that wins control opens its neighbours in the same action. Cost and cap are
// the same either way. A state with no `reach` key at all plays as "control":
// it can only be a game that started before the flip, and a game in progress
// must not change its rules under the players (no migration, #107).
// `emperor`: "win-lead" since #125 (owner, 2026-09-26: 「Wins only if ahead on
// 天命」): the first to 稱帝 wins at once if it leads the Mandate then, else +3
// as before. The same rule as `reach` for a game already under way: a state
// with no `emperor` key plays as "vp" (see EMPEROR below), no migration.
// Defaults are the rules as decided on 2026-09-18 from the harness (plan note,
// Balance log); the first drafts stay reachable as cells: sealAt "control",
// comp 2, hangu 2, wuguo "any", and round 2's westBonus false with yue "lasting"
// (Qin 39 % over 1,000 games; the pair below brought it to 50 %).
// #133 part 1 (owner, 2026-09-26): 遊說 by dice (realign-own, with 收手)
// becomes the default (homeFall stays "none" until part 2's own flip -- kept
// separate so each part's defaults are consistent on their own, per #133's
// "Process" section). A saved game or a running room whose own `options`
// object lacks this key is untouched -- `{ ...DEFAULT_OPTIONS, ...options }`
// only runs once, in createGame(), at the moment a NEW game is made; a state
// already on disk carries its own complete `options` object forward as-is on
// every load, so this flip only reaches games created from here on.
// #133 part 2 (owner, 2026-09-26): 守不住才敗 (homeFall "lose-turn") becomes
// the default, same "old saves keep today's rule" reasoning as part 1's
// `lobby` flip -- a saved game/room's own `options` object, missing this
// key, is untouched (see part 1's comment on `lobby` above; the merge only
// runs once, in createGame(), when a NEW game is made).
// #135 (owner, balance lever): `seals` -- how many of the four states'
// 相印 Chu needs for 合縱 -- goes from 4 to 5. Unlike `lobby`/`homeFall`
// above, `seals` was ALREADY a key here (never "absent means off"), so an
// old save/room's own `options` object already carries its own concrete
// `seals: 4` baked in from whenever it was created -- this flip cannot
// reach it at all, by construction, not just by the merge-once-at-creation
// rule those two rely on. Confirmed with a throwaway script, not committed.
// #142 (owner, 2026-09-27, 「好 採用D1」): `qinFarStart: 1` (遠交, Qin starts
// with 1 in 臨淄 and 1 in 薊; see startGame) becomes the default. An absent key
// is 0, so a save or an export whose own options predate this has no foothold
// and keeps it that way (createGame merges once; `replay` does not merge).
// CIVIL WAR: the comments above are Zongheng's history of its own options.
// This game drops the ones that named Zongheng's cards and spaces (hangu,
// wuguo, westBonus, yue, qinFarStart, comp), sets `luoyi` to 0 (no such
// space), and starts from 遷都 (`homeFall: "move"`), as its rulebook says.
// `supply` (#1): true turns on supply's two effects (孤城 may not take 扶植;
// 孤城 lose blue at the end of the turn). false or absent turns both off and
// leaves the readings (`supplied`, `isolatedCities`) as they are; the harness
// uses it as the control arm.
// `homeLockSide` (#3): "opponent" locks only the other side's home region at
// 民生 <= homeLock, as this game's rulebook says; "both" or absent is
// Zongheng's lock (both home regions, both sides), kept as the control arm and
// for games made before #3. See `homeLocked`.
// `aid` (#4): true gives each side its aid card (`AID`). false or absent: no aid
// card at all (nor the Cauldrons); the control arm for the aid cards' strength,
// and what lets a side with an empty hand really have nothing to play. 美軍駐華
// (`garrisoned`) is the support track's, not the card's: this does not touch it.
// `baseScoring` (#5): true counts the base areas (根據地) as 要衝 when a region
// scores, both for 優勢 and for the +1 each, as this game's rulebook says. false
// or absent is Zongheng's count (city keys only): the control arm for the
// region values (open item 7), and what a game made before #5 plays. See
// `regionTally`.
// #13, three switches for M2's control cells (orchestrator 裁決 #13 says what
// "off" means; the defaults are the rules). Unlike the keys above, an ABSENT
// key plays as the rule (a game made before #13 keeps the rules it had):
// `situations`: false and only false turns off every effect of the eight 時局
// (`situationNow` answers null): no free placements and no Soviet occupation in
// turn 1, no withdrawal and no truce penalty in turn 2, no 奇襲 modifiers, no
// jump, no 行憲 hook, no 民生 unlock and a 孤城 loss of 1 in turn 7, no 和談.
// The support tracks' fixed moves stay (`SUPPORT_SCHEDULE`: 外國勢力, H's), and
// so do the hand sizes and rounds (that is `rounds`).
// `rounds`: "symmetric" gives both sides Zongheng's numbers (`SYMMETRIC_ERAS`);
// anything else is the era's own [Communists, Nationalists] (`eraLimits`).
// `garrison`: false and only false removes 美軍駐華 (`garrisoned`); #4 kept it
// out of `aid`, so H's control cell is `aid: false` with `garrison: false`.
// #24 (owner 裁決 #23, 2026-10-04: 「採用 P10(建議)」): the two 整編 rules of
// P10 are keys here, next to the 整編 rules already here (`seals`, `sealAt`):
// `sealNeeds: "all"` (the Nationalists must also control every space of the
// power) and `sealPerTurn: 1` (at most one new marker a turn). The bots read
// both from `st.options` (bots.js, `positional`). An options object without
// them (a game created before #24) plays 整編 as before. The rest of P10 is in
// the data: `ERAS`, `SITUATION_CAMPAIGN`, `MANDATE_WIN` / `MANDATE_FROM` /
// `MANDATE_CAP`, and board.js's `SETUP.ccp.freeHeld` / `freeAlso`.
export const DEFAULT_OPTIONS = { cap: 2, seals: 5, mie: 3, homeLock: 4, luoyi: 0, turns: 8, scoringSplit: "homes", sealAt: "cap", tie: "kmt", reach: "ts", emperor: "win-lead", lobby: "realign-own", homeFall: "move", supply: true, homeLockSide: "opponent", aid: true, baseScoring: true, situations: true, rounds: "asymmetric", garrison: true, sealNeeds: "all", sealPerTurn: 1 };
// #23, the tuning options: what a variant (tuning/23/variants.mjs) may change,
// so the harness can measure a rule before the owner adopts it. Until #24 none
// of them was a key of DEFAULT_OPTIONS and an absent one played as the rules
// then were. Since #24 the rules ARE P10 (the data named above, and the two
// keys `sealNeeds` / `sealPerTurn` of DEFAULT_OPTIONS): an absent option plays
// as P10 (but for those two keys, whose absence is the rule before P10), and a
// variant is laid over P10. Each is read in one place, named here:
//   setupPoints        { ccp: { <space>: n }, kmt: { <space>: n } }: the named
//                      spaces start with n instead of SETUP's (0 = none) (`startGame`)
//   setupFree          [Communists, Nationalists]: the free placement's points (`startGame`)
//   setupFreeBar       { ccp: [...], kmt: [...] }: spaces taken out of that side's
//                      free placement list (`startGame`)
//   setupOrder         "kmt-first": the Nationalists place first (open item 13) (`startGame`)
//   eraRounds          { <era id>: { hand: [c, k], rounds: [c, k] } }: the era's
//                      hand sizes and action rounds over `ERAS`; "symmetric" still wins (`eraLimits`)
//   regionValues       { <region>: { presence, domination, control } } (`regionTally`)
//   supportStart       [蘇聯支持, 美國支持] at the start (`startGame`)
//   supportSchedule    a whole replacement of SUPPORT_SCHEDULE (`supportSchedule`)
//   aidCap             [蘇援, 美援]: an aid card's ops are min(track, cap) (`opsOf`)
//   situationCampaign  { general_offensive: n, focused_offensive: [plus, minus],
//                      counteroffensive: n, decisive_battle: n }: the 時局's
//                      奇襲 modifiers, key by key over `SITUATION_CAMPAIGN` (`situationCampaignMod`)
//   attritionLosses    [usual, 決戰]: what a 孤城 loses at a turn's end (`attritionLoss`)
//   sealNeeds          "all": 整編 also needs every space of the power controlled
//                      by the Nationalists, as 易幟 needs them all red (`checkMarkers`);
//                      a key of DEFAULT_OPTIONS since #24
//   mieNeeds           [state, …]: the 易幟 instant win also needs these powers among
//                      the ones flipped (`checkMarkers`)
//   mandateWin         [Communists, Nationalists]: the mandate that wins at once
//                      (`MANDATE_WIN`: 20 and 15 since #24) (`vp`, `mandateCheck`)
//   mandateFrom        n, or [n for the Communists, n for the Nationalists] (round
//                      four): no mandate win before turn n; the mandate keeps
//                      counting, and one beyond the threshold wins at the
//                      start of turn n (`startTurn`) (`MANDATE_FROM`: [7, 6] since #24)
//   mandateEarly       "clamp" (absent is "clamp" since #24): before `mandateFrom` the
//                      mandate stays within `mandateCap` instead of counting past it (`vp`)
//   mandateCap         [Communists, Nationalists]: under "clamp", how far each
//                      side's lead may go before `mandateFrom` (`MANDATE_CAP`:
//                      [19, 3] since #24; before #24 one short of its threshold) (`vp`)
//   mandateCapUntil    n: `mandateCap` holds only before turn n; from n to
//                      `mandateFrom` the mandate stays one short of each threshold (`vp`)
//   sealPerTurn        n: at most n new 整編 markers a turn (`checkMarkers`,
//                      `st.sealTurn`); `sealWinSoon` tells the bots; a key of
//                      DEFAULT_OPTIONS (1) since #24
//   sealFrom           n: no 整編 marker is placed before turn n; from turn n on the
//                      condition is read as always (`checkMarkers`)
//   adjacency          { add: [[a, b], …], remove: [[a, b], …] } (`adjOf`)
//   withdrawalKmt      { n, spaces }: 停戰's 蘇軍撤離, the Nationalists' points
//                      and where they may go (today 4 among the Northeast's
//                      three cities) (`situationStep`)
const tune = (st, key) => st.options && st.options[key] != null;
// #26, mechanism B (圍點打援、破襲、進剿; owner's mechanisms note, hand-copied in
// tests/acceptance.test.js group 13), the option `mechanismB` -- NOT a key of
// DEFAULT_OPTIONS until the owner adopts it; absent or false plays as before.
// The numbers, the note's first version: a reinforcement point is worth
// `reinforceFactor` of the attack, at most `reinforceMax` points come, a breakout
// loses `breakoutLoss` of the blue (rounded up), the capture and the failed
// attack's loss are 1 each, and a siege gives the Communists' next attack on the
// city `siegeBonus`.
export const SIEGE = { reinforceFactor: 2, reinforceMax: 3, breakoutLoss: 0.5, capture: 1, siegeBonus: 1, failLoss: 1 };
const mechB = (st) => !!(st.options && st.options.mechanismB);
export const USES = ["event", "place", "campaign", "lobby", "reform"];
// #130, two options that are NOT keys of DEFAULT_OPTIONS: an absent one plays
// as today, byte for byte (tests/defaults-130.test.js).
// `lobby`: absent = today's 遊說 (局勢 > 0 removes min(ops, 局勢), no dice).
//   "realign"       Twilight Struggle's realignment (owner, 2026-09-26:
//                   「遊說改成雙方都會輸（冷戰熱鬥的「重整」）」): any space with
//                   enemy influence, one roll per op, both sides can lose;
//                   `realign` below.
//   "realign-mild"  the same with 1d3 and a loss of at most 2 per attempt.
//   "realign-own"   realign, only on a space where the actor ALSO has influence
//                   of its own (owner's pick, #130: no riskless 遊說); once its
//                   own influence there is gone the rest of the attempts are lost.
//                   And 收手: after every attempt that leaves attempts unspent the
//                   actor chooses to continue or to stop (a pending decision per
//                   roll, the `realign` plan step; each roll is made as it is
//                   resolved, so a room shows them one by one and a reload
//                   resumes at the decision).
// `homeFall`: absent or "none" = today; see `homeFallCheck` below.
export const LOBBY = { realign: { die: 6, cap: Infinity }, "realign-mild": { die: 3, cap: 2 }, "realign-own": { die: 6, cap: Infinity, own: true, stop: true } };
// Whether `side` may 遊說 `id` at all (enemy influence there; under realign-own
// its own too). Protection is read separately (`isProtected`).
function lobbyEligible(st, side, id) {
  const a = infOf(st, id);
  if (a[other(side)] <= 0) return false;
  const R = LOBBY[st.options.lobby];
  return !(R && R.own && a[side] <= 0);
}
export const HOME_FALL = ["none", "lose", "lose-turn", "lose-majority", "move"];
// CIVIL WAR: HOME_REGION, HOME_CAPITAL and MOVED_CAPITAL (遷都: 陝北 -> 太行,
// 南京 -> 廣州) are board data now; `export *` above re-exports them.
export function homeCapital(st, side) { return (st.capital && st.capital[side]) || HOME_CAPITAL[side]; }
// Each side's home capital now and who holds it against its owner (control; under
// lose-majority also `aheadBy`, the enemy when it has more influence there).
// `view` carries it as `homeCapitals` whenever a homeFall value is set.
export function homeCapitalStatus(st) {
  return [CCP, KMT].map((side) => {
    const capital = homeCapital(st, side), opp = other(side);
    const out = { side, capital, heldBy: controller(st, capital) === opp ? opp : null };
    if (st.options.homeFall === "lose-majority") out.aheadBy = infOf(st, capital)[opp] > infOf(st, capital)[side] ? opp : null;
    return out;
  });
}
export const MOVE_VP = 3;
// `homeFall` (#130; owner: 「設計一下 如果國都被控制就輸了呢？」, and 「pls simulate them all」):
//   "lose"           the enemy controlling your home capital loses you the game at
//                    once (read with the markers, `checkMarkers`)
//   "lose-turn"      ... if it still does at the end of a turn (`endTurnChecks`)
//   "lose-majority"  the enemy having MORE influence than you there at the end of a turn
//   "move"           遷都: the first time the enemy controls it at the end of a turn
//                    it gains MOVE_VP and your capital moves (關中 → 漢中, 郢 → 陳蔡;
//                    `st.capital`); the enemy controlling the new one at the end of a
//                    LATER turn loses you the game. The old capital is an ordinary
//                    space; the home region and homeLock do not change.
// End reason "homeFall". Both capitals lost at once (a turn end under the turn-end
// values; the rules give no answer, BE's reading, flagged on #130): the side ahead
// on the Mandate wins, level goes by `tie` as the final scoring does.
function homeFallWin(st, losers) {
  if (losers.length === 1) return win(st, other(losers[0]), "homeFall");
  const w = st.mandate > 0 ? CCP : st.mandate < 0 ? KMT : st.options.tie === "ccp" ? CCP : KMT;
  win(st, w, "homeFall");
}
function homeFallAtTurnEnd(st) {
  const hf = st.options.homeFall;
  if (hf !== "lose-turn" && hf !== "lose-majority" && hf !== "move") return;
  const moved = [], losers = [];
  for (const side of [CCP, KMT]) {
    const cap = homeCapital(st, side), opp = other(side);
    // One entry per capital per turn end, safe or not (the UI reads them).
    const held = hf === "lose-majority" ? infOf(st, cap)[opp] > infOf(st, cap)[side] : controller(st, cap) === opp;
    const result = !held ? "safe" : hf === "move" && cap === HOME_CAPITAL[side] ? "moved" : "fallen";
    log(st, { type: "capitalCheck", whose: side, capital: cap, heldBy: held ? opp : null, result });
    if (result === "fallen") losers.push(side);
    else if (result === "moved") moved.push(side);
  }
  if (losers.length) return homeFallWin(st, losers);
  for (const side of moved) {
    const opp = other(side);
    if (!st.capital) st.capital = HOME_CAPITAL.slice();
    st.capital[side] = MOVED_CAPITAL[side];
    log(st, { type: "capitalMoves", whose: side, from: HOME_CAPITAL[side], to: MOVED_CAPITAL[side], by: opp, vp: MOVE_VP });
    vp(st, opp, MOVE_VP);
    if (st.winner != null) return;
  }
}

// ---------- RNG (mulberry32) ----------
export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) { return Math.floor(rng.next() * n); },
    getState() { return a; },
    setState(s) { a = s >>> 0; },
  };
  return rng;
}
export function randomSeed() { return Math.floor(Math.random() * 2 ** 31); }
export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// JSON clone on purpose: structuredClone crashes V8 on the development machine.
export const clone = (x) => JSON.parse(JSON.stringify(x));
function withRng(st, fn) {
  const rng = makeRng(0);
  rng.setState(st.rngState);
  const out = fn(rng);
  st.rngState = rng.getState();
  return out;
}
// Entries carry a running number `i`, so a reader can tell whether anything
// is missing between two entries.
//
// The log keeps the whole game (#128). It used to keep only the last 400
// entries, and a full game writes more: over 200 normal + 200 hard bot games
// on 0e558a8, 65 wrote more than 400 (the longest 437), and a game that
// reaches turn 8 writes about 400 (median 398). Past the cap the start of the
// game was gone and a move whose opening entry was evicted fell apart in the
// log panel. A full game's log is under 38 KB of JSON (about 87 bytes an
// entry), so the cap is now a runaway guard far above any real game, not a
// window: LOG_CAP entries is about 4.6 times the longest game measured and
// about 175 KB.
//
// If a log ever does outgrow it, `trimLog` drops whole moves, the oldest
// first, and keeps the game's opening (its setup and turn 1) and the move in
// progress. A move is what the log panel groups (`groupLog`, public/oppmove.js):
// an opening entry and every entry up to the next one.
export const LOG_CAP = 2000;
const LOG_OPENS = new Set(["setup", "turn", "headline", "play", "endTurn"]);
export function trimLog(log, cap = LOG_CAP) {
  if (log.length <= cap) return log;
  const opens = [];
  for (let k = 0; k < log.length; k++) if (LOG_OPENS.has(log[k].type)) opens.push(k);
  // The opening ends where the first move of turn 2 or later starts.
  let o = opens.findIndex((k) => log[k].t >= 2);
  if (o < 0) return log;
  let drop = 0;
  const from = opens[o];
  // Never the last move: it may be the one in progress (an ops step still
  // writes its real use into its `play` entry).
  while (o + 1 < opens.length && log.length - drop > cap) { drop = opens[o + 1] - from; o++; }
  if (drop) log.splice(from, drop);
  return log;
}
export function log(st, entry) {
  st.logSeq = (st.logSeq || 0) + 1;
  st.log.push({ i: st.logSeq, t: st.turn, r: st.round, ...entry });
  trimLog(st.log);
}
const fail = (msg) => { throw new Error(msg); };

// ---------- the board ----------
export function infOf(st, id) { return st.inf[id] || [0, 0]; }
// #23 `adjacency`: { add: [[a, b], …], remove: [[a, b], …] }, both directions.
// Every rule that reads a neighbour asks here (placing, 遊說's 局勢 and its
// realignment, supply); without the option it is board.js's own list.
const adjMemo = new WeakMap();
export function adjOf(st, id) {
  const A = st.options && st.options.adjacency;
  if (!A) return SPACE[id].adj;
  let m = adjMemo.get(A);
  if (!m) {
    m = Object.fromEntries(SPACES.map((s) => [s.id, s.adj.slice()]));
    for (const [a, b] of A.remove || []) { m[a] = m[a].filter((x) => x !== b); m[b] = m[b].filter((x) => x !== a); }
    for (const [a, b] of A.add || []) { if (!m[a].includes(b)) m[a].push(b); if (!m[b].includes(a)) m[b].push(a); }
    adjMemo.set(A, m);
  }
  return m[id];
}
function ensure(st, id) { if (!st.inf[id]) st.inf[id] = [0, 0]; return st.inf[id]; }
export function controller(st, id) {
  const [q, c] = infOf(st, id), S = SPACE[id].stability;
  if (q >= c + S) return CCP;
  if (c >= q + S) return KMT;
  return null;
}
export function capOf(st, id) { return SPACE[id].stability + st.options.cap; }
// 受降 (turn 1, #2): the Soviets hold the Northeast's three cities. Nobody may
// put a point there by any means (四, 細則: 「包括事件與外援牌」), so `place()`
// itself refuses -- unlike supply, which bars only the 扶植 action -- and nobody
// may 奇襲 them. The Northeast's villages are open. Turn 0 is the setup, which
// is turn 1's free placement (`situationNow` reads it so).
export function sovietHeld(st, id) { return situationNow(st)?.id === "surrender" && SPACE[id].region === "northeast" && SPACE[id].kind === "city"; }
// Place up to n points, never above the cap; returns how many landed.
export function place(st, side, id, n = 1) {
  if (sovietHeld(st, id)) return 0;
  const a = ensure(st, id);
  const k = Math.max(0, Math.min(n, capOf(st, id) - a[side]));
  a[side] += k;
  return k;
}
export function remove(st, side, id, n) {
  const a = ensure(st, id);
  const k = Math.min(n, a[side]);
  a[side] -= k;
  return k;
}
export function controlled(st, side) { return SPACES.filter((s) => controller(st, s.id) === side).map((s) => s.id); }
// `reach` is what `reachFrom` returned at the start of the place action: under
// "ts" the eligible set is fixed then; under "control" it is null and reach is
// re-read on `st` as it stands. A state without the option plays as "control".
export function canPlaceAt(st, side, id, reach = null) {
  // #26: a besieged city (圍城) takes no Nationalist 扶植 this turn.
  if (side === KMT && besieged(st, id)) return false;
  if (reach) return reach.has(id);
  if (infOf(st, id)[side] > 0) return true;
  if (st.options.reach === "ts") return adjOf(st, id).some((a) => infOf(st, a)[side] > 0);
  return adjOf(st, id).some((a) => controller(st, a) === side);
}
export function reachFrom(st, side) {
  if (st.options.reach !== "ts") return null;
  return new Set(SPACES.filter((s) => canPlaceAt(st, side, s.id)).map((s) => s.id));
}
// Where the NEXT point of a place action may go, with what it costs -- the one
// answer both the map's lighting (public/app.js) and `placePoints` are read
// from, so a lit space can never be one the engine refuses (#107; before this,
// app.js re-read `canPlaceAt` per point on the trial board, which under "ts"
// lit up to 5 spaces the engine then refused only at Confirm).
//
// `st` is the state at the START of the place action and `points` the points
// picked so far but not yet committed. That split is the rule: the eligible set
// comes from `st` (under "ts" it is fixed there), while the cost, the cap and
// supply (`placeBarred`, #1) are re-read on the board with `points` already on
// it -- exactly the order `placePoints` checks them in, point by point.
// 戰略反攻 (#2): within the one jump, the first point picked outside reach is
// the jumped village, and from then on only that one is open beyond reach.
// `card` (#4) is the aid card's id when the 扶植 is an aid card's, else absent;
// `ops` is then the card's own ops (`legal().aid.ops`) and the two aid rules are
// read here, per point, the way `placePoints` checks them:
//   蘇援 -- while every point so far is in the Northeast, a Northeast space may
//     use one op more; a space elsewhere may not (it would cost the +1).
//   美援 -- a 孤城 is open while no point so far is in a village; a village is
//     open while no point so far went into a 孤城 by the airlift.
// `left` is the ops left without the 蘇援's +1.
export function placeTargets(st, side, ops, points = [], card) {
  const reach = reachFrom(st, side), jump = jumpOpen(st, side);
  const trial = clone(st); trial.log = [];
  let spent = 0, jumped = null, airlifted = false;
  for (const id of points) {
    if (jump && jumped == null && SPACE[id].kind === "village" && !canPlaceAt(trial, side, id, reach)) jumped = id;
    if (placeBarred(trial, side)(id)) airlifted = true;
    spent += placeCost(trial, side, id); place(trial, side, id, 1);
  }
  const left = ops - spent;
  const soviet = card === "soviet_aid" && points.every(inNortheast);
  const lit = new Set(), costs = {};
  // Supply, unlike reach, is re-read with `points` on the board (#1).
  const barred = placeBarred(trial, side);
  const isolated = card === "american_aid" ? new Set(isolatedCities(trial)) : null;
  const villageSoFar = points.some((id) => SPACE[id].kind === "village");
  const open = (id) => {
    if (SPACE[id].kind === "village") return !airlifted;
    return !barred(id) || (!!isolated && isolated.has(id) && !villageSoFar);
  };
  const reachable = (id) => canPlaceAt(trial, side, id, reach) || (jump && SPACE[id].kind === "village" && (jumped == null || jumped === id));
  for (const s of SPACES) {
    const cost = placeCost(trial, side, s.id);
    const budget = left + (soviet && inNortheast(s.id) ? 1 : 0);
    if (cost <= budget && reachable(s.id) && infOf(trial, s.id)[side] < capOf(trial, s.id) && open(s.id) && !sovietHeld(trial, s.id)) {
      lit.add(s.id);
      costs[s.id] = cost;
    }
  }
  return { lit, costs, spent, left };
}
// Set by the balance harness (tests/sim.js) to watch placements (`place`) and
// the two home capitals (`home`, #130: called with (st, "check") at the end of
// every `checkMarkers` and (st, "turnEnd") where the turn-end checks start);
// null in play. #138: `turnEnd` is called with (st) once a year is over and
// before the next begins (after the turn-end checks and any 明法令 discard, before
// the final scoring or the next deal); report-digest.js `turnEnds` reads the
// board of each year there. It sees the state; it must not change it.
export const probe = { place: null, home: null, turnEnd: null };
export function placeCost(st, side, id) { return controller(st, id) === other(side) ? 2 : 1; }
// 局勢 for 遊說: my controlled neighbours minus theirs.
export function edge(st, side, id) {
  let e = 0;
  for (const a of adjOf(st, id)) {
    const c = controller(st, a);
    if (c === side) e++; else if (c === other(side)) e--;
  }
  return e;
}
export function isProtected(st, id) { return st.effects.some((e) => e.kind === "protect" && e.space === id); }
// #6: a lasting effect that bars every 奇襲 on a kind of space in a region, for
// both sides, and nothing else (遊說, 扶植 and events go on): `region`, and
// `spaceKind` "city" or null for cities and villages alike. 蘇軍延期撤兵 bars the
// Northeast's cities, 六月東北停戰 the whole Northeast. 日軍留守 is `protect`,
// which bars 遊說 too.
// #8: `who` (CCP or KMT) bars that side only; absent, both. 史達林的建議 bars the
// Communists from the cities of 後方. `side` is the attacker; every reader passes
// it (`canCampaign`, so `opsOptions` and the events' target lists, and `doOps`).
export function campaignBanned(st, id, side) {
  const sp = SPACE[id];
  return st.effects.some((e) => e.kind === "campaignBan" && e.region === sp.region && (!e.spaceKind || e.spaceKind === sp.kind) && (e.who == null || e.who === side));
}
// Whether `side` may 奇襲 `id` now: the one test `opsOptions` (so `legal()`) and
// an event's free 奇襲 read (`eventCampaignTargets`); `doOps` checks the same
// things one by one, each with its own refusal. Enemy influence there; not 受降's
// Northeast cities; not 美軍駐華 against the Communists; not locked by 民生; not
// protected; not barred by a `campaignBan`. A card that says it ignores the
// locks or 美軍駐華 turns that one test off (`locks: false`, `garrison: false`).
export function canCampaign(st, side, id, { locks = true, garrison = true } = {}) {
  return infOf(st, id)[other(side)] > 0 && !sovietHeld(st, id) && !(garrison && side === CCP && garrisoned(st, id))
    && !(locks && campaignLocked(st, id, side)) && !isProtected(st, id) && !campaignBanned(st, id, side);
}
// An event's free 奇襲 (orchestrator 裁決 #6, 4): the targets are the ones the
// side could 奇襲 as an action (`canCampaign`), within the card's own list.
export function eventCampaignTargets(st, side, list, opts) {
  return list.filter((id) => canCampaign(st, side, id, opts));
}

// ---------- weariness ----------
// `side` is who attacks (#2). 決戰 and 和談 (turns 7 and 8): a Communist 奇襲 on
// a city is not locked by 民生 at all. Only that: the Communists on a village
// and the Nationalists anywhere are locked as before. A protection (`isProtected`)
// is another rule and still holds. Without `side`, no 時局 unlocks anything.
function situationUnlocks(st, side, id) {
  const sit = situationNow(st);
  return side === CCP && SPACE[id].kind === "city" && !!sit && (sit.id === "decisive_battle" || sit.id === "peace_talks");
}
// 本土 (#3, owner 裁決(#2)「只鎖對手的本土,照規則書」): with `homeLockSide:
// "opponent"` the home-region level locks only the OTHER side's home region
// (Communists kept out of 後方, Nationalists out of 西北); each side may still
// attack inside its own. "both", an absent key (a game made before #3), or a
// call without `side` lock both home regions for both sides, as in Zongheng.
// Only this level: 華北 and the 城的要衝 below stay locked for both sides.
function homeLocked(st, region, side) {
  const home = REGIONS[region].home;
  if (!home) return false;
  if (st.options.homeLockSide !== "opponent" || (side !== CCP && side !== KMT)) return true;
  return home !== SIDES[side];
}
export function campaignLocked(st, id, side) {
  if (situationUnlocks(st, side, id)) return false;
  const sp = SPACE[id], w = st.weariness;
  if (w <= st.options.homeLock && homeLocked(st, sp.region, side)) return true;
  if (w <= 3 && REGIONS[sp.region].front) return true;
  if (w <= 2 && sp.battleground) return true;
  return false;
}
export function tire(st, n, pusher) {
  if (n <= 0 || st.winner) return;
  st.weariness = Math.max(1, st.weariness - n);
  log(st, { type: "tire", to: st.weariness, by: pusher });
  if (st.weariness <= 1) win(st, other(pusher), "collapse");
}
export function recover(st, n) { st.weariness = Math.min(5, st.weariness + n); }

// ---------- #123: collapse risk, decided by simulation, not by card text ----------
// The UI's own state is always a per-seat VIEW (`E.view()`, app.js: `v = E.view
// (game.st, game.me)` for solo, `v = game.st` = the server's own view for a
// room) -- the opponent's hand is `null` there, not an array, on purpose. The
// real `apply()`/`run()` machinery does not expect that: `eventMark` (used by
// EVERY event, to log what it changed) reads `st.hands[side].length` for
// BOTH sides unconditionally and throws on a hidden hand. Found the hard way
// (#123 round 1): the easy bot's own candidate builder already hands a bare
// view to `randomAction`, and a caught throw there silently reads as "safe",
// so the very warning this issue exists to add would have gone dark for
// every hidden-hand position -- solo and rooms alike, i.e. almost always.
// `view()` hides three things this way: the opponent's hand (`null`, count in
// `handCounts`), the draw pile (deleted, count in `drawCount`) and the not-
// yet-shuffled-in eras (`later`, deleted, counts in `laterCounts`) -- all
// patched here with placeholder ids of the RIGHT length, never real card
// ids: enough for every generic length-only check (`eventMark`'s own diff,
// `handSize` in bots.js's `evaluate`), and no sided card's own `effect()`
// reads what those hidden piles actually hold to decide whether it tires
// the realm.
function withHiddenPilesFilled(st) {
  const need = !Array.isArray(st.hands[CCP]) || !Array.isArray(st.hands[KMT]) || !Array.isArray(st.draw) || !st.later
    || Object.values(st.later).some((a) => !Array.isArray(a));
  if (!need) return st;
  const s = clone(st);
  for (const side of [CCP, KMT]) {
    if (!Array.isArray(s.hands[side])) s.hands[side] = new Array((s.handCounts && s.handCounts[side]) || 0).fill("__hidden__");
  }
  if (!Array.isArray(s.draw)) s.draw = new Array(s.drawCount || 0).fill("__hidden__");
  if (s.later && s.laterCounts) {
    for (const k of Object.keys(s.laterCounts)) if (!Array.isArray(s.later[k])) s.later[k] = new Array(s.laterCounts[k] || 0).fill("__hidden__");
  }
  return s;
}
function firstLegalChoice(p) {
  switch (p.kind) {
    // A choice may need more points than it has spaces (停戰: 4 among 3 cities, #2): round robin.
    case "points": { const o = p.options || []; return o.length ? Array.from({ length: Math.max(0, p.min || 0) }, (_, i) => o[i % o.length]) : []; }
    case "card": return (p.min ?? 1) === 0 ? [] : (p.options || []).slice(0, p.min ?? 1);
    case "option": return (p.options || [])[0]?.id ?? null;
    default: return null; // "ops" never arises mid-event; treated as unanswerable
  }
}
// Would COMMITTING `action`, right now, end the game by pushing weariness to
// 土崩 against `side`? (rulebook 五 / TS 8.1.3: the acting player is
// responsible for weariness even through the opponent's event.) A pure,
// side-effect-free look at a clone, for the UI (and the advisor/bots below)
// to call BEFORE the player or bot actually commits. `action` is exactly the
// shape `apply()` takes -- the same object a click or a bot's own candidate
// would send. Any choice the play stops on along the way (an event's own
// pick of a target, say) is answered with its first legal option: the tire
// every sided card applies here is never conditioned on which option is
// picked (the #115 event-audit harness established that shape for all of
// them), so a future card that starts tiring the realm needs no second,
// hand-written rule added to this function. Never throws: an action that
// cannot even be tried from this state (a bad shape, a game already over)
// reads as "safe" -- a genuinely illegal action fails again, loudly, when it
// is actually played.
export function actionWouldCollapse(st, side, action) {
  if (st.winner != null) return false;
  const probe = withHiddenPilesFilled(st);
  let s;
  try { s = apply(probe, action); } catch { return false; }
  try {
    for (let guard = 0; s.pending && s.winner == null && guard < 30; guard++) {
      s = apply(s, { type: "choose", side: s.pending.who, choice: firstLegalChoice(s.pending) });
    }
  } catch { return false; }
  return s.winner != null && s.winner !== side && s.reason === "collapse";
}
// The same question for just a card's event (own or the opponent's), without
// yet knowing which ops use (if any) will ride along with it -- the event's
// own tire never depends on that (`play()`'s own "event" step is identical
// whichever ops use it is bundled with, or none at all). The card page opens
// before place/campaign/lobby/order is chosen, so this is what it calls to
// decide whether to warn at all, and the advisor/bots call it the same way
// before ranking "event" as a candidate.
export function eventWouldCollapse(st, side, cardId) {
  if (!CARD[cardId]) return false;
  return actionWouldCollapse(st, side, { type: "play", side, card: cardId, use: "event" });
}

// ---------- mandate, markers, scoring, reform ----------
export function win(st, side, reason) {
  if (st.winner != null) return;
  st.winner = side; st.reason = reason; st.phase = "over"; st.pending = null; st.plan = [];
  log(st, { type: "over", winner: side, reason });
}
export function vp(st, side, n) {
  if (!n || st.winner != null) return;
  st.mandate += side === CCP ? n : -n;
  // #24: the mandate rules are `MANDATE_WIN`, `MANDATE_FROM` and `MANDATE_CAP` (the options of #23
  // round three, `mandateWin` / `mandateFrom` / `mandateEarly` / `mandateCap` / `mandateCapUntil`, over them).
  const [toC, toK] = mandateWinAt(st);
  if (mandateEarly(st) && (st.options.mandateEarly ?? "clamp") === "clamp") {
    const capNow = !(tune(st, "mandateCapUntil") && st.turn >= st.options.mandateCapUntil);
    const [capC, capK] = capNow ? mandateCapOf(st) : [toC - 1, toK - 1];
    // Each side's bound holds only while its own mandate win is closed (one turn for both: both bounds).
    if (mandateEarlyFor(st, CCP)) st.mandate = Math.min(capC, st.mandate);
    if (mandateEarlyFor(st, KMT)) st.mandate = Math.max(-capK, st.mandate);
  }
  log(st, { type: "vp", side, n, mandate: st.mandate });
  mandateCheck(st);
}
// #23 round four, `sealPerTurn`: how many 整編 markers went down this turn (`st.sealTurn`, kept only
// under the option). And whether a 整編 win could still come this turn (the bots read it, #23 round four).
function sealsThisTurn(st) { return st.sealTurn && st.sealTurn.turn === st.turn ? st.sealTurn.n : 0; }
// Under `sealFrom` the answer stays yes: what is at the cap when turn n begins all goes down at
// once on its first action, so the threat stands as it did (a first try that answered no left the
// Communists blind to it: 77% of the Nationalists' wins then fell on turn 4).
export function sealWinSoon(st) {
  if (tune(st, "sealPerTurn")) return st.options.seals - Object.keys(st.seals || {}).length <= st.options.sealPerTurn - sealsThisTurn(st);
  return true;
}
export function mandateWinAt(st) { return tune(st, "mandateWin") ? st.options.mandateWin : MANDATE_WIN; }
// `mandateFrom` is a turn, or [Communists, Nationalists] (round four: each side's own first turn).
function mandateFromOf(st) { const f = tune(st, "mandateFrom") ? st.options.mandateFrom : MANDATE_FROM; return Array.isArray(f) ? f : [f, f]; }
function mandateCapOf(st) { return tune(st, "mandateCap") ? st.options.mandateCap : MANDATE_CAP; }
// Whether `side`'s mandate win is still closed this turn.
function mandateEarlyFor(st, side) { return st.turn < mandateFromOf(st)[side]; }
function mandateEarly(st) { return mandateEarlyFor(st, CCP) || mandateEarlyFor(st, KMT); }
// The mandate win, read whenever the mandate moves and once at the start of a `mandateFrom` turn.
function mandateCheck(st) {
  if (st.winner != null) return;
  const [toC, toK] = mandateWinAt(st);
  if (st.mandate >= toC && !mandateEarlyFor(st, CCP)) win(st, CCP, "mandate");
  else if (st.mandate <= -toK && !mandateEarlyFor(st, KMT)) win(st, KMT, "mandate");
}
// ---------- the two support tracks (rulebook 三, 外國勢力) ----------
// `st.support` is [蘇聯支持, 美國支持]: indexed by the seat each track backs
// (CCP = 0, KMT = 1), each 0 to 4, starting at 1 and 4. `moveSupport` is the
// one door: the 時局 use it now, the cards will.
export const SUPPORT_START = [1, 4];
export const SUPPORT_MAX = 4;
export function moveSupport(st, side, delta) {
  if (!delta || st.winner != null) return 0;
  const from = st.support[side], to = Math.max(0, Math.min(SUPPORT_MAX, from + delta));
  st.support[side] = to;
  log(st, { type: "support", side, delta, from, to });
  return to - from;
}
export function checkMarkers(st) {
  if (st.winner != null) return;
  for (const [id, s] of Object.entries(STATES)) {
    const capCtl = controller(st, s.capital);
    if (st.mie[id] && capCtl === KMT) { delete st.mie[id]; log(st, { type: "restore", state: id }); }
    if (st.seals[id] && capCtl === CCP) { delete st.seals[id]; log(st, { type: "unseal", state: id }); }
    // After 田單復國 lifts 滅 (owner 裁決 #119), `mieHold[id]` lists the spaces
    // of the state Qin still controlled at that moment; a space leaves the list
    // once Qin loses it. The state falls again only to a new conquest: all of
    // it held, and at least one space not on the list. No list, as always.
    const sp = spacesOfState(id);
    let held = st.mieHold && st.mieHold[id];
    if (held) {
      held = held.filter((x) => controller(st, x) === CCP);
      if (held.length) st.mieHold[id] = held; else { delete st.mieHold[id]; held = null; }
    }
    const all = sp.every((x) => controller(st, x) === CCP) && !(held && held.length === sp.length);
    if (all && !st.mie[id]) {
      st.mie[id] = true; log(st, { type: "mie", state: id });
      if (st.mieHold) delete st.mieHold[id];
      if (!st.mieVp[id]) { st.mieVp[id] = true; vp(st, CCP, s.vp); }
    }
    const sealed = capCtl === KMT && (st.options.sealAt !== "cap" || infOf(st, s.capital)[KMT] >= capOf(st, s.capital))
      && (st.options.sealNeeds !== "all" || sp.every((x) => controller(st, x) === KMT))
      && !(tune(st, "sealFrom") && st.turn < st.options.sealFrom)
      && !(tune(st, "sealPerTurn") && sealsThisTurn(st) >= st.options.sealPerTurn);
    if (sealed && !st.seals[id]) {
      st.seals[id] = true; log(st, { type: "seal", state: id });
      if (tune(st, "sealPerTurn")) st.sealTurn = { turn: st.turn, n: sealsThisTurn(st) + 1 };
      if (!st.sealVp[id]) { st.sealVp[id] = true; vp(st, KMT, 1); }
    }
  }
  if (st.winner == null && Object.keys(st.mie).length >= st.options.mie
    && (!tune(st, "mieNeeds") || st.options.mieNeeds.every((s) => st.mie[s]))) win(st, CCP, "unification");
  if (st.winner == null && Object.keys(st.seals).length >= st.options.seals) win(st, KMT, "alliance");
  if (st.winner == null && st.options.homeFall === "lose") {
    const losers = [CCP, KMT].filter((side) => controller(st, HOME_CAPITAL[side]) === other(side));
    if (losers.length) homeFallWin(st, losers);
  }
  if (probe.home) probe.home(st, "check");
}
// `bg` is the number of 要衝 that count for scoring: the city keys
// (`battleground`) and, under `baseScoring` (#5), the base areas (`base`) too
// -- both in 優勢's "more 要衝 than the other side" and in the +1 each. Only
// here: a base area is still not `battleground`, so attacking it does not push
// 民生 and 凋敝 does not lock it (`campaign`, `campaignLocked`).
function scoringKey(st, id) {
  return SPACE[id].battleground || (st.options.baseScoring === true && SPACE[id].base === true);
}
export function regionTally(st, region) {
  const ids = spacesOf(region), R = tune(st, "regionValues") && st.options.regionValues[region] ? { ...REGIONS[region], ...st.options.regionValues[region] } : REGIONS[region];
  const res = [CCP, KMT].map((side) => {
    const ctl = ids.filter((id) => controller(st, id) === side);
    return { spaces: ctl.length, bg: ctl.filter((id) => scoringKey(st, id)).length, ids: ctl };
  });
  return [CCP, KMT].map((i) => {
    const me = res[i], op = res[1 - i];
    let level = "none";
    if (me.spaces === ids.length) level = "control";
    else if (me.spaces > 0 && me.spaces > op.spaces && me.bg > op.bg) level = "domination";
    else if (me.spaces > 0) level = "presence";
    const base = level === "none" ? 0 : R[level];
    let bonus = me.bg;
    for (const e of st.effects) if (e.kind === "score" && e.region === region && e.who === i) bonus += e.delta;
    return { ...me, level, base, bonus, total: base + bonus };
  });
}
export function scoreRegion(st, region) {
  const [q, c] = regionTally(st, region);
  log(st, { type: "score", region, ccp: q, kmt: c });
  vp(st, CCP, q.total - c.total);
}
export function reformThreshold(st, side) { return st.reform[side] >= 6 ? Infinity : REFORM[st.reform[side]].ops; }
export function reformUsesLeft(st, side) { return (st.reform[side] >= 2 ? 2 : 1) - st.reformUsed[side]; }
export function hasPerk(st, side, perk) { return REFORM.some((r) => r.perk === perk && st.reform[side] >= r.box); }
// #121 `emperor`: what reaching box 6 (稱帝) FIRST is worth. The default is
// "win-lead" since #125 (DEFAULT_OPTIONS); an absent key -- a game saved before
// #125 -- plays as "vp", as it did when it started.
//   "vp"       the rulebook: first +3, second +1
//   "vp5"      first +5, second +1
//   "win"      the first to reach it wins at once (end reason "emperor")
//   "win-late" as "win" from turn 5 on; before that +3 as "vp", and the first
//              place is then taken, so no one can win by it afterwards
//   "win-lead" as "win", but only for a side that leads the Mandate at that
//              moment (Qin above 0, Chu below 0); level or behind it is +3 as
//              "vp" and the first place is taken
// The second to arrive always gets +1; nobody wins by arriving second.
export const EMPEROR = ["vp", "vp5", "win", "win-late", "win-lead"];
export const EMPEROR_LATE_FROM = 5;
// Whether `side` still has a win by 稱帝 to race for (box 6 open, and under
// win-lead only while it leads), whatever the turn; the bots read this.
export function emperorLive(st, side) {
  const e = st.options.emperor;
  if (st.reformFirst[6] != null) return false;
  if (e === "win" || e === "win-late") return true;
  return e === "win-lead" && (side === CCP ? st.mandate > 0 : st.mandate < 0);
}
// Whether `side` reaching box 6 first right now wins the game.
export function emperorWins(st, side) {
  return emperorLive(st, side) && (st.options.emperor !== "win-late" || st.turn >= EMPEROR_LATE_FROM);
}
export function reformAdvance(st, side, n = 1) {
  for (let i = 0; i < n; i++) {
    if (st.reform[side] >= 6) return;
    const box = ++st.reform[side], R = REFORM[box - 1];
    log(st, { type: "reform", side, box });
    if (st.reformFirst[box] == null) {
      const wins = R.perk === "emperor" && emperorWins(st, side);
      st.reformFirst[box] = side;
      if (wins) { win(st, side, "emperor"); return; }
      vp(st, side, R.perk === "emperor" && st.options.emperor === "vp5" ? 5 : R.first);
    } else vp(st, side, R.second);
    if (R.perk === "emperor") recover(st, 1);
    // 行憲 (turn 6, #2): every box the Nationalists advance, by the action or by
    // an event, moves 民心 1 their way, and then the Communists put 1 point in a
    // city with blue (not bound by adjacency). Their choice waits in the plan
    // right after the step being executed (the reform, or the event).
    if (side === KMT && situationNow(st)?.id === "constitution" && st.winner == null) {
      vp(st, KMT, 1);
      if (st.winner != null) return;
      st.plan.splice(1, 0, { do: "constitution", side: CCP, choices: [] });
    }
  }
}
// The Communists' point of 行憲: a city with blue where red is not at the cap.
// None such: nothing to place.
function constitutionStep(st, step) {
  const options = SPACES.filter((s) => s.kind === "city" && infOf(st, s.id)[KMT] > 0 && infOf(st, s.id)[CCP] < capOf(st, s.id)).map((s) => s.id);
  if (!options.length) return true;
  if (!step.choices.length) return situationAsk(st, step, CCP, { kind: "points", n: 1, min: 1, options, side: CCP });
  const [id] = step.choices.shift();
  place(st, CCP, id, 1);
  log(st, { type: "constitutionPlace", side: CCP, space: id });
  checkMarkers(st);
  return true;
}

// ---------- ops ----------
// An aid card's ops are its side's support track now (#4); at 0 the card is
// 0 whatever the effects say (細則: 支持度是 0 時不能用,即使有 +1). Otherwise
// it takes the 「所有牌行動點 ±1」 effects as a card does, never below 1.
export function opsOf(st, side, cardId) {
  let base = isAid(cardId) ? (st.support || [])[aidSide(cardId)] || 0 : CARD[cardId].ops;
  if (base === 0) return 0;
  if (isAid(cardId) && tune(st, "aidCap") && st.options.aidCap[aidSide(cardId)] != null) base = Math.min(base, st.options.aidCap[aidSide(cardId)]);
  let o = base;
  for (const e of st.effects) if (e.kind === "opsAll" && e.target === side) o += e.delta;
  return Math.max(1, o);
}
// Whether `side` may use its aid card now: the option is on, not used this
// turn, its support track above 0 (`aidAvailable`), and at least one of 扶植 /
// 奇襲 / 遊說 can be done with it right now (`aidUses`; orchestrator 裁決 #4:
// an aid card with nothing it could legally do is not a card to play, so a side
// with an empty hand is skipped rather than asked to act with no action). Who
// acts, the bog and 細作 are `play`'s and `legal`'s to read, as they were for
// the Cauldrons.
function aidAvailable(st, side) {
  return !!st.options.aid && !!st.aidUsed && !st.aidUsed[side] && ((st.support || [])[side] || 0) > 0;
}
// What the aid card could do now, each null when it can do nothing: 扶植 counts
// only if at least one point is affordable with the card's own ops (蘇援's +1 in
// the Northeast and 美援's airlift included, i.e. `placeTargets(…, card)` lights
// something); 奇襲 and 遊說 read the target lists (美軍駐華, the 民生 locks, 受降).
function aidUses(st, side) {
  const id = AID[side].id, ops = opsOf(st, side, id), o = opsOptions(st, side, id);
  return {
    id, ops,
    place: o.placeOptions.length && placeTargets(st, side, ops, [], id).lit.size ? { options: o.placeOptions } : null,
    campaign: o.campaignTargets.length ? { targets: o.campaignTargets } : null,
    lobby: o.lobbyTargets.length ? { targets: o.lobbyTargets } : null,
  };
}
export function aidUsable(st, side) {
  if (!aidAvailable(st, side)) return false;
  const u = aidUses(st, side);
  return !!(u.place || u.campaign || u.lobby);
}
const inNortheast = (id) => SPACE[id].region === "northeast";
// 蘇援 used all in the Northeast: +1 (#4, orchestrator 裁決 3): a 扶植 whose
// every point is there, a 奇襲 or 遊說 whose target is. Any other card: 0.
function aidBonus(card, choice) {
  if (card !== "soviet_aid" || !choice) return 0;
  if (choice.use === "place") return Array.isArray(choice.points) && choice.points.length > 0 && choice.points.every((id) => SPACE[id] && inNortheast(id)) ? 1 : 0;
  return SPACE[choice.target] && inNortheast(choice.target) ? 1 : 0;
}
// 美援's airlift (#4, orchestrator 裁決 4, 待 owner): a 美援 扶植 with every point
// in a city may put points into a 孤城 -- a city with blue that no source
// reaches (`isolatedCities`), read on the board as it stands before the point.
// Only a 孤城: a city with no blue (out of supply, or held by the Communists)
// stays barred, as the rulebook's exception names only 孤城.
function airliftOk(st, id) {
  return SPACE[id].kind === "city" && infOf(st, id)[KMT] > 0 && !supplied(st).has(id);
}
// 美軍駐華 (#4, rulebook 三, 外國勢力 2): while 美國支持 is at 3 or more, the
// Communists may not 奇襲 天津 or 上海 -- by a card or by 蘇援. Only the 奇襲:
// 扶植, 遊說 and events are not touched, nor the Nationalists. Not lifted by
// 決戰 / 和談's unlock (`situationUnlocks` is about 民生) and not by `aid:
// false`. `opsOptions` and `doOps` read it; an event's free 奇襲 is to read it
// through the same target list (the card that ignores it, 平津戰役, will say so).
export const GARRISON = ["tianjin", "shanghai"];
export const GARRISON_SUPPORT = 3;
// `garrison: false` (#13): no 美軍駐華 at all; every reader asks here.
export function garrisoned(st, id) {
  return st.options.garrison !== false && GARRISON.includes(id) && ((st.support || [])[KMT] || 0) >= GARRISON_SUPPORT;
}
// The 時局's modifiers (#2) come first, each for the side and the kind of
// target the rulebook names and no other; the numbers are `SITUATION_CAMPAIGN`
// (#24), with the option `situationCampaign` over them. (`campaign` keeps the
// total at 0 or more.)
function situationCampaignMod(st, side, target) {
  const sit = situationNow(st), sp = SPACE[target];
  if (!sit) return 0;
  const m = tune(st, "situationCampaign") ? { ...SITUATION_CAMPAIGN, ...st.options.situationCampaign } : SITUATION_CAMPAIGN;
  switch (sit.id) {
    case "general_offensive": return side === KMT ? m.general_offensive : 0;
    case "focused_offensive": return side !== KMT ? 0 : sp.region === "northwest" || sp.region === "east" ? m.focused_offensive[0] : -m.focused_offensive[1];
    case "counteroffensive": return side === CCP && sp.kind === "village" ? m.counteroffensive : 0;
    case "decisive_battle": return side === CCP && sp.kind === "city" ? m.decisive_battle : 0;
    default: return 0;
  }
}
// A `campaign` effect may also name a kind of space (#7, `spaceKind`: "village"
// or "city"; absent, both): 轉戰陝北 is −2 against the Northwest's villages only.
export function campaignMod(st, side, target) {
  const region = SPACE[target].region, kind = SPACE[target].kind;
  let d = situationCampaignMod(st, side, target);
  for (const e of st.effects) {
    if (e.kind !== "campaign") continue;
    if (e.who !== side && e.who !== "both") continue;
    if (e.regions && !e.regions.includes(region)) continue;
    if (e.spaceKind && e.spaceKind !== kind) continue;
    d += e.delta;
  }
  // #26: a siege (圍城) gives the Communists' next attack on that city +siegeBonus.
  if (side === CCP && siegeBonusOn(st, target)) d += SIEGE.siegeBonus;
  return d;
}
export function addEffect(st, e) { st.effects.push(e); }
export function removeEffect(st, pred) { st.effects = st.effects.filter((e) => !pred(e)); }

// A campaign with `ops` points against `target` by `side`. Locks and
// protection are checked by the caller (free campaigns from events may skip
// them); the weariness cost is paid here unless `noTire`.
export function campaign(st, side, target, ops, { noTire = false, pusher = side } = {}) {
  const opp = other(side);
  const o = attackPower(st, side, target, ops);
  const removed = remove(st, opp, target, o);
  const placed = place(st, side, target, o - removed);
  log(st, { type: "campaign", side, target, ops: o, removed, placed });
  // 決戰, 和談 (#2): a Communist 奇襲 on a city does not push 民生.
  if (!noTire && SPACE[target].battleground && !situationUnlocks(st, side, target)) tire(st, 1, pusher);
  checkMarkers(st);
  truceBroken(st, side);
  return { ops: o, removed, placed };
}
// X, an attack's strength: the ops, the 時局's and the cards' modifiers
// (`campaignMod`, a siege's +1 included), and 建軍 / 行憲 box 3's +1 on the first
// 奇襲 of the turn; never below 0. Uses up the perk and the siege's +1. The one
// reading for the old 奇襲 (`campaign`) and for mechanism B's attacks (#26:
// orchestrator 裁決 3, the modifiers are added to X before the table is read).
function attackPower(st, side, target, ops) {
  let o = ops + campaignMod(st, side, target);
  if (hasPerk(st, side, "campaign") && !st.perkUsed[side]) { st.perkUsed[side] = true; o += 1; }
  if (side === CCP && siegeBonusOn(st, target)) {
    st.effects = st.effects.map((e) => (e.kind === "siege" && e.space === target ? { ...e, bonus: false } : e));
  }
  return Math.max(0, o);
}

// ---------- mechanism B (#26): 圍點打援、破襲、進剿 ----------
// Only an attack paid with ops (a card's or an aid card's: `doOps`) goes
// through it (orchestrator 裁決 #26, 2); a card's event that says 奇襲 calls
// `campaign` as before. With the option on:
//   B1 the Communists on a city: 圍點打援 (`siegeStep`). Only a city with a
//      space next to it the Communists control (`siegeOpen`); the play names a
//      plan, `siege: "point" | "relief"`, kept secret until the Nationalists
//      have answered (`view` hides it).
//   B2 the Communists on a village: 破襲, the old 奇襲 (`campaign`).
//   B3 the Nationalists anywhere: 進剿 (`sweepStep`), the Communists stand or
//      withdraw.
// 民生, 停戰's first attack and the markers follow every attack as they follow
// `campaign` (`attackEnd`); 美軍駐華, the 民生 locks and 受降 bar targets as before.
export const SIEGE_PLANS = ["point", "relief"];
// Whether this attack by `side` on `target` is a 圍點打援 (and so must name a plan).
export function siegeNeeded(st, side, target) {
  return mechB(st) && side === CCP && !!SPACE[target] && SPACE[target].kind === "city";
}
// The spaces next to `id` the Communists control: where the attack comes from,
// and where its −1 / +1 goes.
function ccpAround(st, id) { return adjOf(st, id).filter((a) => controller(st, a) === CCP); }
// B1's condition: a city may be attacked only from a space the Communists control next to it.
function siegeOpen(st, side, target) { return !siegeNeeded(st, side, target) || ccpAround(st, target).length > 0; }
// 圍城: the marker of a 打援 met by 固守, until the turn's 結算 (`until: "turn"`).
export function besieged(st, id) { return (st.effects || []).some((e) => e.kind === "siege" && e.space === id); }
function siegeBonusOn(st, id) { return (st.effects || []).some((e) => e.kind === "siege" && e.space === id && e.bonus); }
// 增援's R: a city the Nationalists control, in supply, next to T or with one
// village between them that the Communists do not control. None into a 孤城.
// A besieged city is a 孤城 everywhere (orchestrator 裁決 #26, 4 and 6), so it is
// not in supply and sends no reinforcement.
function reinforceSources(st, T) {
  const ok = supplied(st);
  return SPACES.filter((s) => s.kind === "city" && s.id !== T && controller(st, s.id) === KMT && ok.has(s.id) && !besieged(st, s.id)
    && (adjOf(st, T).includes(s.id) || adjOf(st, T).some((v) => SPACE[v].kind === "village" && controller(st, v) !== CCP && adjOf(st, v).includes(s.id))))
    .map((s) => s.id);
}
// The Nationalists' answers to an attack on T, as option ids.
function siegeResponses(st, T) {
  const out = ["hold"], D = infOf(st, T)[KMT];
  if (!isolatedCities(st).includes(T)) {
    for (const R of reinforceSources(st, T)) {
      const most = Math.min(SIEGE.reinforceMax, capOf(st, T) - D, infOf(st, R)[KMT]);
      for (let k = 1; k <= most; k++) out.push(`reinforce:${R}:${k}`);
    }
  }
  // 突圍: not into a city nobody may place in (受降's Northeast cities; orchestrator 裁決 #26, 5).
  for (const R of adjOf(st, T)) if (controller(st, R) !== CCP && !sovietHeld(st, R)) out.push(`breakout:${R}`);
  return out;
}
// 進剿's 撤: the villages next to `id` the Nationalists do not control.
function withdrawTargets(st, id) { return adjOf(st, id).filter((a) => SPACE[a].kind === "village" && controller(st, a) !== KMT); }
// An attack paid with ops, under the option: the plan step that asks.
function declareAttack(st, side, target, ops, plan) {
  const X = attackPower(st, side, target, ops);
  if (side === CCP) {
    log(st, { type: "siege", side, target, ops: X });
    st.plan.splice(1, 0, { do: "siege", side, target, ops: X, plan, stage: "respond", choices: [] });
  } else {
    log(st, { type: "sweep", side, target, ops: X });
    st.plan.splice(1, 0, { do: "sweep", side, target, ops: X, stage: "answer", choices: [] });
  }
}
// What follows every attack, as in `campaign`: 民生 (a 要衝; not the Communists
// on a city in 決戰 / 和談), the markers, 停戰's first attack.
function attackEnd(st, side, target) {
  if (SPACE[target].battleground && !situationUnlocks(st, side, target)) tire(st, 1, side);
  checkMarkers(st);
  truceBroken(st, side);
}
function siegeStep(st, step) {
  const T = step.target, X = step.ops;
  if (step.stage === "respond") {
    if (!step.choices.length) {
      return ask(st, { ...step, side: KMT }, { kind: "option", tag: "siege", target: T, ops: X, options: siegeResponses(st, T).map((id) => ({ id })) });
    }
    const [kind, R, kk] = String(step.choices.shift()).split(":"), k = Number(kk) || 0;
    const r = { type: "siegeResult", side: CCP, target: T, ops: X, plan: step.plan, response: kind, ...(R ? { to: R } : {}), ...(k ? { k } : {}) };
    let pick = null;
    if (step.plan === "point") {
      if (kind === "hold") {
        r.removed = remove(st, KMT, T, X);
        r.placed = place(st, CCP, T, X - r.removed);
      } else if (kind === "reinforce") {
        place(st, KMT, T, remove(st, KMT, R, k));
        const a = Math.max(0, X - SIEGE.reinforceFactor * k);
        r.removed = remove(st, KMT, T, a);
        if (a === 0) pick = "siegeLoss";
      } else {
        const d = remove(st, KMT, T, infOf(st, T)[KMT]);
        r.moved = place(st, KMT, R, d);
        if (!infOf(st, T)[KMT]) r.placed = place(st, CCP, T, X);
      }
    } else if (kind === "hold") {
      st.effects = st.effects.filter((e) => !(e.kind === "siege" && e.space === T));
      addEffect(st, { kind: "siege", space: T, bonus: true, until: "turn" });
      r.besieged = true;
    } else if (kind === "reinforce") {
      r.removed = remove(st, KMT, R, Math.min(k, X));
      pick = "siegeCapture";
    } else {
      const d = remove(st, KMT, T, infOf(st, T)[KMT]);
      r.removed = Math.min(Math.ceil(d * SIEGE.breakoutLoss), X);
      r.moved = place(st, KMT, R, d - r.removed);
      if (!infOf(st, T)[KMT]) r.placed = place(st, CCP, T, 1);
    }
    log(st, r);
    step.stage = pick && ccpAround(st, T).length ? pick : "end";
  }
  if (step.stage === "siegeLoss" || step.stage === "siegeCapture") {
    if (!step.choices.length) {
      return ask(st, { ...step, side: CCP }, { kind: "option", tag: step.stage, target: T, options: ccpAround(st, T).map((id) => ({ id })) });
    }
    const id = step.choices.shift();
    const n = step.stage === "siegeLoss" ? -remove(st, CCP, id, SIEGE.failLoss) : place(st, CCP, id, SIEGE.capture);
    log(st, { type: step.stage, side: CCP, target: T, space: id, n });
    step.stage = "end";
  }
  attackEnd(st, CCP, T);
  return true;
}
function sweepStep(st, step) {
  const T = step.target, X = step.ops;
  if (step.stage === "answer") {
    if (!step.choices.length) {
      const options = [{ id: "stand" }, ...(withdrawTargets(st, T).length ? [{ id: "withdraw" }] : [])];
      return ask(st, { ...step, side: CCP }, { kind: "option", tag: "sweep", target: T, ops: X, options });
    }
    if (step.choices.shift() === "withdraw") step.stage = "withdraw";
    else {
      const removed = remove(st, CCP, T, X), placed = place(st, KMT, T, X - removed);
      log(st, { type: "sweepResult", side: KMT, target: T, ops: X, response: "stand", removed, placed });
      step.stage = "end";
    }
  }
  if (step.stage === "withdraw") {
    const n = infOf(st, T)[CCP];
    if (!step.choices.length) {
      return ask(st, { ...step, side: CCP }, { kind: "points", tag: "withdraw", target: T, n, min: n, options: withdrawTargets(st, T) });
    }
    const points = step.choices.shift();
    remove(st, CCP, T, n);
    let moved = 0;
    for (const id of points) moved += place(st, CCP, id, 1);
    const placed = place(st, KMT, T, X);
    log(st, { type: "sweepResult", side: KMT, target: T, ops: X, response: "withdraw", points, moved, lost: n - moved, placed });
    step.stage = "end";
  }
  attackEnd(st, KMT, T);
  return true;
}
// 停戰 (turn 2, #2): the first 奇襲 of the turn, whoever makes it and however
// (an action, or an event's free 奇襲 calling `campaign` itself), moves 民心 2
// toward the other side, and costs 美國支持 1 if it was the Nationalists. Once a
// turn, for the first only (orchestrator 裁決 #2, flagged to the owner).
function truceBroken(st, side) {
  if (situationNow(st)?.id !== "truce" || st.winner != null) return;
  if (!st.situationUsed || st.situationUsed.truce) return;
  st.situationUsed = { ...st.situationUsed, truce: true };
  log(st, { type: "truceBroken", side });
  vp(st, other(side), 2);
  if (side === KMT) moveSupport(st, KMT, -1);
}
// One side's modifier for a realignment roll on `id` (#130): +1 per neighbour
// it controls, +1 if it has more influence there than the other side, +1 if
// the space is in its home region or next to a space of it.
export function realignMod(st, side, id) {
  const w = realignWhy(st, side, id);
  return w.adj.length + (w.more ? 1 : 0) + (w.home ? 1 : 0);
}
// The three parts of it, for the log (the UI names them).
export function realignWhy(st, side, id) {
  const sp = SPACE[id], home = HOME_REGION[side];
  return {
    adj: adjOf(st, id).filter((a) => controller(st, a) === side),
    more: infOf(st, id)[side] > infOf(st, id)[other(side)],
    home: sp.region === home || adjOf(st, id).some((a) => SPACE[a].region === home),
  };
}
// 遊說 under `lobby: "realign"` / "realign-mild": `ops` attempts on `target`,
// one at a time; each side rolls a die plus its modifier, the loser removes
// the difference from its own influence there (never below 0, capped under
// "mild"), a tie does nothing. Stops once the enemy has nothing left there
// (the rest are lost) or the game ends; markers are read after every attempt.
// The odds of ONE attempt by `side` on `id` as the board stands (the pick screen,
// the preview and the bots read this, so nobody keeps a copy of the rule): both
// modifiers and their parts, win / tie / lose by the dice, and the expected net
// (enemy points removed − own points lost, each capped by the option and by what
// the loser has there). null when no realign value is in play.
export function realignOdds(st, side, id) {
  const R = LOBBY[st.options.lobby];
  if (!R) return null;
  const opp = other(side), why = [realignWhy(st, CCP, id), realignWhy(st, KMT, id)];
  const mod = why.map((w) => w.adj.length + (w.more ? 1 : 0) + (w.home ? 1 : 0));
  const own = infOf(st, id)[side], enemy = infOf(st, id)[opp], n = R.die * R.die;
  let win = 0, tie = 0, net = 0;
  for (let a = 1; a <= R.die; a++) for (let b = 1; b <= R.die; b++) {
    const d = a + mod[side] - (b + mod[opp]);
    if (d > 0) { win++; net += Math.min(d, R.cap, enemy); } else if (d < 0) net -= Math.min(-d, R.cap, own); else tie++;
  }
  return { mod, why, win: win / n, tie: tie / n, lose: (n - win - tie) / n, net: net / n };
}
// One attempt: both rolls from the game's RNG now, the loss, the entry, the markers.
function realignAttempt(st, side, target, k) {
  const R = LOBBY[st.options.lobby];
  const why = [realignWhy(st, CCP, target), realignWhy(st, KMT, target)];
  const mod = why.map((w) => w.adj.length + (w.more ? 1 : 0) + (w.home ? 1 : 0));
  const roll = withRng(st, (rng) => [1 + rng.int(R.die), 1 + rng.int(R.die)]);
  const d = roll[CCP] + mod[CCP] - (roll[KMT] + mod[KMT]);
  const lose = d > 0 ? KMT : d < 0 ? CCP : null;
  const n = lose == null ? 0 : remove(st, lose, target, Math.min(Math.abs(d), R.cap));
  log(st, { type: "realign", side, target, k, roll, mod, adj: why.map((w) => w.adj), more: why.map((w) => w.more), home: why.map((w) => w.home), lose, n });
  checkMarkers(st);
  return { removed: lose === other(side) ? n : 0, lost: lose === side ? n : 0 };
}
function realign(st, side, target, ops) {
  const R = LOBBY[st.options.lobby];
  log(st, { type: "lobby", side, target, ops, mode: st.options.lobby, own: infOf(st, target)[side] });
  const head = st.log[st.log.length - 1];
  if (R.stop) {
    // 收手: the attempts are the `realign` step placed right after this ops step.
    Object.assign(head, { attempts: 0, removed: 0, lost: 0 });
    st.plan.splice(1, 0, { do: "realign", side, target, ops, k: 0, head: st.logSeq, choices: [] });
    return 0;
  }
  let removed = 0, lost = 0, k = 0;
  while (k < ops && lobbyEligible(st, side, target) && st.winner == null) {
    k++;
    const r = realignAttempt(st, side, target, k);
    removed += r.removed; lost += r.lost;
  }
  // The first entry of the 遊說 carries its totals.
  if (head && head.type === "lobby") Object.assign(head, { attempts: k, removed, lost });
  checkMarkers(st);
  return removed;
}
// The `realign` plan step (realign-own): roll, then ask continue / stop while
// attempts are left and both sides still have influence there.
function realignStep(st, step) {
  const more = () => step.k < step.ops && lobbyEligible(st, step.side, step.target) && st.winner == null;
  const head = st.log.find((l) => l.i === step.head && l.type === "lobby");
  if (step.k > 0) {
    if (!more()) return true;
    if (!step.choices.length) {
      return ask(st, step, { kind: "option", options: [{ id: "continue" }, { id: "stop" }], tag: "realign", target: step.target, k: step.k, ops: step.ops });
    }
    if (step.choices.shift() === "stop") {
      log(st, { type: "lobbyStop", side: step.side, target: step.target, k: step.k, left: step.ops - step.k });
      return true;
    }
  }
  if (!more()) return true;
  step.k++;
  const r = realignAttempt(st, step.side, step.target, step.k);
  if (head) { head.attempts = step.k; head.removed += r.removed; head.lost += r.lost; }
  if (st.winner != null) return true;
  return realignStep(st, step);
}
export function lobby(st, side, target, ops) {
  if (st.options.lobby && LOBBY[st.options.lobby]) return realign(st, side, target, ops);
  const e = edge(st, side, target);
  const removed = e > 0 ? remove(st, other(side), target, Math.min(ops, e)) : 0;
  log(st, { type: "lobby", side, target, ops, edge: e, removed });
  checkMarkers(st);
  return removed;
}
// Points one at a time, so the cost re-evaluates as control changes.
// Under reach "ts" the eligible set is taken once, before the first point.
// Supply is read before every point (#1): a point that lifts a siege opens the
// city for the next point of the same action.
// 戰略反攻 (#2): while the Communists' jump is open, the first point outside
// reach may go into a village, and every point outside reach must then go into
// that same village; a 扶植 that does so uses the jump up for the turn.
// `card` (#4): an aid card's id, or absent. 蘇援 with every point in the
// Northeast has one op more than `ops`; 美援 with every point in a city may put
// a point into a 孤城 (`airliftOk`). Nothing else changes: reach, cap, cost,
// 受降's Northeast cities.
export function placePoints(st, side, points, ops, card) {
  if (probe.place) probe.place(st, side, points);
  const reach = reachFrom(st, side), jump = jumpOpen(st, side);
  ops += aidBonus(card, { use: "place", points });
  const airlift = card === "american_aid" && points.every((id) => SPACE[id].kind === "city");
  let spent = 0, jumped = null;
  for (const id of points) {
    const cost = placeCost(st, side, id);
    if (spent + cost > ops) fail(`place: not enough ops for ${id}`);
    if (!canPlaceAt(st, side, id, reach)) {
      if (jump && SPACE[id].kind === "village" && (jumped == null || jumped === id)) jumped = id;
      else fail(`place: ${id} is not reachable`);
    }
    if (infOf(st, id)[side] >= capOf(st, id)) fail(`place: ${id} is at the cap`);
    if (sovietHeld(st, id)) fail(`place: the Soviets hold ${id} this turn (受降)`);
    if (placeBarred(st, side)(id) && !(airlift && airliftOk(st, id))) fail(`place: ${id} is cut off from supply`);
    place(st, side, id, 1);
    spent += cost;
  }
  if (jumped) st.situationUsed = { ...st.situationUsed, jump: true };
  log(st, { type: "place", side, points, spent, ...(jumped ? { jump: jumped } : {}) });
  checkMarkers(st);
  return spent;
}
// Whether the Communists still have 戰略反攻's jump this turn.
function jumpOpen(st, side) {
  return side === CCP && situationNow(st)?.id === "counteroffensive" && !(st.situationUsed && st.situationUsed.jump);
}

// ---------- decks and hands ----------
function drawOne(st) {
  if (!st.draw.length) {
    if (!st.discard.length) return null;
    st.draw = withRng(st, (rng) => shuffle(rng, st.discard));
    st.discard = [];
    log(st, { type: "reshuffle", n: st.draw.length });
  }
  return st.draw.pop();
}
// Refill draws; event draws (`nonScoring`) reveal and reshuffle scoring cards.
export function draw(st, side, n, { nonScoring = false } = {}) {
  let got = 0;
  for (let guard = 0; got < n && guard < 200; guard++) {
    const c = drawOne(st);
    if (c == null) break;
    if (nonScoring && CARD[c].scoring) {
      st.draw.push(c);
      st.draw = withRng(st, (rng) => shuffle(rng, st.draw));
      if (st.draw.every((x) => CARD[x].scoring)) break;
      continue;
    }
    st.hands[side].push(c);
    got++;
  }
  return got;
}
export function discardCard(st, side, cardId, { noEvent = true } = {}) {
  const h = st.hands[side], i = h.indexOf(cardId);
  if (i < 0) fail(`discard: ${cardId} not in hand`);
  h.splice(i, 1);
  st.discard.push(cardId);
  log(st, { type: "discard", side, card: cardId, noEvent });
}
export function eraOf(turn) { return ERAS.filter((e) => turn >= e.from).pop(); }
// A side with an empty hand still acts while its aid card is usable (#4).
export function hasCards(st, side) { return st.hands[side].length > 0 || aidUsable(st, side); }
// 細作 (xizuo, 67) names a card the other side must play on its next action
// round (`st.forced[side]`, cards.js). The obligation LAPSES when that card is
// no longer in that side's hand -- orchestrator's ruling (#55), flagged to the
// owner; the rulebook says nothing about the case. Any other reading freezes
// the game: seed 70 on fallbacks stopped at turn 7 with Chu forced to play
// 說客 after 春申君's event made Chu draw two and discard that very card, and
// `legal()` then offered Chu nothing at all.
//
// This is the ONE place that decides it. Every reader of `st.forced` goes
// through here (`legal`, both checks in `play`, the aid cards' guard), so
// a stale value can never reach a rule. It does not mutate: `legal` and the
// per-seat `view` are read-only for the room and the bots. The stale value is
// wiped once, in `beginAction`, so the state on the wire is honest too.
export function forcedCard(st, side) {
  const c = st.forced[side];
  return c != null && st.hands[side].includes(c) ? c : null;
}

// ---------- creating a game ----------
// #137: which rules a game was created under, kept in the state
// (`st.rulesVersion`, public) and written into an export's `game.rulesVersion`,
// so a later engine can tell whether a recorded action list still replays
// under its rules. It is the date of the last change to what a given seed +
// options + actions play out to: bump it (to that day's date, "-2" for a
// second change the same day) with any change to the rules in engine.js /
// cards.js / board.js, or to what the engine does with a given options object.
// A change to DEFAULT_OPTIONS alone needs no bump: it only reaches new games,
// and a replay uses the recorded options exactly (`replay`).
export const RULES_VERSION = "2026-10-04-2"; // #26: mechanism B as the option `mechanismB` (`SIEGE`, `siegeNeeded`, `besieged`; an absent or false option plays as before) ("2026-10-04" was #24: P10 is the rules (owner 裁決 #23 and #24, 2026-10-04): `ERAS`, `SITUATION_CAMPAIGN`, `MANDATE_WIN` / `MANDATE_FROM` / `MANDATE_CAP`, SETUP's `freeHeld` / `freeAlso`, and `sealNeeds` / `sealPerTurn` in DEFAULT_OPTIONS; an absent mandate or 時局 option now plays as P10 ("2026-10-03-3" was #23 round four: `sealPerTurn`, `mandateCapUntil`, `mandateFrom` per side; an absent key plays as before ("2026-10-03-2" was #23 round three: `mandateWin`, `mandateFrom`, `mandateEarly`, `mandateCap`; "2026-10-03" was #23 round two: `sealFrom`, `mieNeeds`; "2026-10-02-2" was #23: the tuning options (`setupPoints`, `setupFree`, `setupFreeBar`, `setupOrder`, `eraRounds`, `regionValues`, `supportStart`, `supportSchedule`, `aidCap`, `situationCampaign`, `attritionLosses`, `sealNeeds`, `adjacency`, `withdrawalKmt`); none is a default, an absent key plays as before ("2026-10-02" was #13: the switches `situations`, `rounds`, `garrison`, i.e. what the engine does with an options object that names them; an absent key plays as before ("2026-10-01-8" was #8: the 21 events of 決戰期, `campaignBan`'s `who`, `turnEndVp`, `noAttrition`; "2026-10-01-7" was #7: the 22 events of 易勢期, a `campaign` effect's `spaceKind`; "2026-10-01-6" was #6: the 24 events of 接收期, 馬歇爾調處's pairing, `campaignBan`; "2026-10-01-5" was #5: baseScoring, base areas count as 要衝 when a region scores; "2026-10-01-4" was #4: the two aid cards replace the Nine Cauldrons, 美援's airlift, 美軍駐華; "2026-10-01-3" was #3: homeLockSide; "2026-10-01-2" was #2: 時局, asymmetric rounds, support tracks; #1 was "2026-10-01")))))
// A new game: the options given, over today's defaults.
export function createGame(seed, options = {}) {
  return startGame(seed, { ...DEFAULT_OPTIONS, ...options });
}
// `options` is the game's complete options object, used as it is.
function startGame(seed, options) {
  const rng = makeRng(seed);
  const st = {
    seed, rngState: 0, options, rulesVersion: RULES_VERSION,
    turn: 0, era: null, phase: "setup", round: 0, rounds: [0, 0], actor: CCP, phasing: CCP,
    inf: {}, mandate: 0, weariness: 5,
    // #2: [蘇聯支持, 美國支持]; and the once-a-turn uses of a 時局, reset by startTurn.
    support: SUPPORT_START.slice(), situationUsed: { truce: false, jump: false },
    reform: [0, 0], reformUsed: [0, 0], reformFirst: {}, perkUsed: [false, false],
    mie: {}, seals: {}, mieVp: {}, sealVp: {}, luoyiYields: false, // CIVIL WAR: no 洛邑
    aidUsed: [false, false], // #4: [蘇援, 美援] used this turn; reset by startTurn
    draw: [], discard: [], removed: [], later: {},
    hands: [[], []], headline: [null, null],
    effects: [], forced: [null, null], revealed: [false, false],
    pending: null, plan: [], winner: null, reason: null, log: [],
    // #137: every action `apply` accepts, as given, in order: with the seed
    // and the options it replays the game exactly (`replay` below). It holds
    // hidden choices (a headline before the reveal, a card out of a hand), so
    // `view` drops it until the game is over. A state without it (a save from
    // before #137, the tutorial's hand-built position) records nothing.
    actions: [],
  };
  for (const side of [CCP, KMT]) {
    for (const [id, n] of Object.entries(SETUP[SIDES[side]].fixed)) ensure(st, id)[side] = n;
    // #23 `setupPoints`: the named spaces start with the variant's number instead.
    if (tune(st, "setupPoints")) for (const [id, n] of Object.entries(st.options.setupPoints[SIDES[side]] || {})) ensure(st, id)[side] = n;
  }
  if (tune(st, "supportStart")) st.support = st.options.supportStart.slice();
  if (st.options.homeFall === "move") st.capital = HOME_CAPITAL.slice();
  // CIVIL WAR: the first era's deck is drawn from; the other two wait in
  // `later` under their era ids, which `startTurn` shuffles in at turns 4 and 7.
  const [first, ...rest] = ERAS.map((e) => e.id);
  st.draw = shuffle(rng, ERA_DECKS[first].slice());
  st.later = Object.fromEntries(rest.map((id) => [id, ERA_DECKS[id].slice()]));
  st.rngState = rng.getState();
  // CIVIL WAR: the free placement is turn 1's 時局 (受降): each side places over
  // its own list of spaces, not bound by adjacency. The Communists place first,
  // as Qin did in Zongheng (the rulebook does not give an order: flagged).
  // With `situations: false` (#13) there is no 受降 and so no free placement:
  // the game goes straight to turn 1.
  // #23: `setupFree`, `setupFreeBar` and `setupOrder` change the free placement.
  const free = [CCP, KMT].map((side) => {
    const S = SETUP[SIDES[side]];
    const n = tune(st, "setupFree") ? st.options.setupFree[side] : S.free;
    const bar = (tune(st, "setupFreeBar") && st.options.setupFreeBar[SIDES[side]]) || null;
    // #24: `held` -- of these, only the spaces this side controls when it is asked, and those of `also`
    // whoever controls them (SETUP's `freeHeld` and `freeAlso`).
    return { do: "setup", side, n, spaces: bar ? S.freeIn.filter((id) => !bar.includes(id)) : S.freeIn, ...(S.freeHeld ? { held: true, also: (S.freeAlso || []).slice() } : {}), choices: [] };
  });
  if (st.options.setupOrder === "kmt-first") free.reverse();
  st.plan = [
    ...(situationNow(st)?.id === "surrender" ? free : []),
    { do: "startTurn" },
  ];
  return run(st);
}

// ---------- the plan runner ----------
export function run(st) {
  for (let guard = 0; !st.pending && st.winner == null; guard++) {
    if (guard > 10000) fail("run: plan did not settle");
    if (!st.plan.length) {
      // Nothing planned and nobody owes a headline: with an empty hand on both
      // sides (#57) there is no action left that could end the phase, so the
      // headlines resolve themselves rather than the table waiting for ever.
      if (st.phase !== "headline" || mustAct(st).length) break;
      st.plan.push({ do: "headline" });
    }
    const step = st.plan[0];
    if (exec(st, step)) st.plan.shift();
  }
  return st;
}
function ask(st, step, spec) {
  st.pending = { who: step.side, ...spec, step: step.do };
  return false;
}
function exec(st, step) {
  switch (step.do) {
    case "setup": {
      if (step.n <= 0) return true;
      if (!step.choices.length) {
        // #24 `held` (受降, the Communists): control is read here, at the moment of asking,
        // before any of this step's points is placed; a space of `also` (察綏) is open regardless.
        const options = step.spaces
          ? step.spaces.filter((id) => infOf(st, id)[step.side] < capOf(st, id)
            && (!step.held || controller(st, id) === step.side || (step.also || []).includes(id)))
          : step.regions
          ? SPACES.filter((s) => step.regions.includes(s.region)).map((s) => s.id)
          : SPACES.filter((s) => infOf(st, s.id)[step.side] > 0).map((s) => s.id);
        return ask(st, step, { kind: "points", n: step.n, min: step.n, options, side: step.side, tag: "setup" });
      }
      for (const id of step.choices[0]) place(st, step.side, id, 1);
      log(st, { type: "setup", side: step.side, points: step.choices[0] });
      checkMarkers(st);
      return true;
    }
    case "startTurn": return startTurn(st), true;
    case "situation": return situationStep(st, step);
    case "deal": return dealHands(st), true;
    case "constitution": return constitutionStep(st, step);
    case "headline": return resolveHeadlines(st), true;
    case "event": {
      st.phasing = step.by ?? step.side;
      // #115: an event used to leave no trace of its own in the log -- an
      // enemy card spent for ops showed its ops and nothing else, so an event
      // the opponent resolved (or one with nothing to do) looked like one
      // that never happened. `event` marks the start (before the effect's own
      // entries: vp, tire, campaign, discard ...), `eventEnd` says whether it
      // changed anything and, if not, why.
      let pre = step.pre;
      if (pre == null) {
        pre = eventMark(st);
        log(st, { type: "event", card: step.card, side: step.side, by: st.phasing });
      }
      for (let guard = 0; guard < 20; guard++) {
        const need = CARD[step.card].effect(st, step.side, step.choices, step);
        if (!need) break;
        // A choice with nothing to choose from resolves itself as "nothing".
        if ((need.kind === "points" || need.kind === "card") && (!need.options.length || need.n === 0) && !(need.min > 0)) { step.empty = true; step.choices.push([]); continue; }
        // Who answers the event's choices -- the card's owner, not always the
        // player who played it -- goes into `eventEnd` as `chose`.
        const who = need.who ?? step.side;
        if (!(step.asked || []).includes(who)) step.asked = [...(step.asked || []), who];
        step.pre = pre; // the mark waits in the plan only while a choice is pending
        return ask(st, step, { ...need, tag: "event", card: step.card });
      }
      step.done = true;
      // What the event did, then what follows from it (滅, 相印): the log reads
      // cause before consequence. Markers only follow influence, which
      // `eventEnd` already counts, so logging it first loses nothing.
      logEventEnd(st, step, pre);
      checkMarkers(st);
      return true;
    }
    case "score": return scoreRegion(st, step.region), true;
    case "ops": {
      // Ops chosen up front (in the play action) or asked for now (an
      // opponent's card played event-first, 商旅通賈).
      let choice = step.payload;
      if (!choice) {
        if (!step.choices.length) {
          if (step.afterEvent) step.ops = opsOf(st, step.side, step.card);
          const o = opsOptions(st, step.side);
          const allowed = [];
          if (o.placeOptions.length) allowed.push("place");
          if (o.campaignTargets.length) allowed.push("campaign");
          if (o.lobbyTargets.length) allowed.push("lobby");
          if (!allowed.length) { log(st, { type: "opsLost", side: step.side, ops: step.ops }); return true; }
          return ask(st, step, { kind: "ops", ops: step.ops, card: step.card, allowed, options: o, tag: "ops" });
        }
        choice = step.choices[0];
        if (step.playSeq) { const e = st.log.find((l) => l.i === step.playSeq && l.type === "play"); if (e) e.use = choice.use; }
      }
      doOps(st, step.side, step.card, step.ops, choice);
      return true;
    }
    case "reform": {
      st.reformUsed[step.side]++;
      reformAdvance(st, step.side, 1);
      return true;
    }
    case "finishCard": return finishCard(st, step), true;
    case "realign": return realignStep(st, step);
    case "siege": return siegeStep(st, step);
    case "sweep": return sweepStep(st, step);
    case "endAction": return endAction(st), true;
    case "beginAction": return beginAction(st), true;
    case "endTurn": {
      if (!step.stage) {
        endTurnChecks(st);
        if (st.winner != null) return true;
        step.stage = "discard";
        step.sides = [CCP, KMT].filter((s) => hasPerk(st, s, "discard") && st.hands[s].some((c) => !CARD[c].scoring));
        step.choices = [];
      }
      while (step.sides.length) {
        const side = step.sides[0];
        if (!step.choices.length) {
          return ask(st, { ...step, side }, { kind: "card", n: 1, min: 0, options: st.hands[side].filter((c) => !CARD[c].scoring), tag: "endDiscard" });
        }
        const [pick] = step.choices.shift();
        if (pick) discardCard(st, side, pick);
        step.sides.shift();
      }
      if (probe.turnEnd) probe.turnEnd(st);
      if (st.turn >= st.options.turns) finalScoring(st);
      else st.plan.push({ do: "startTurn" });
      return true;
    }
    default: fail(`exec: unknown step ${step.do}`);
  }
}

// What an event can change, read before it runs and compared after (#115).
// When the event asks for a choice the mark waits in the plan step, and
// `view` keeps the plan, so it holds only what both seats may see: a hand is
// its size, never its cards. The bots play events out by the thousand while
// they think, so the mark is plain copies (no JSON round trip for the board)
// and the comparison does the set work only when something changed.
function eventMark(st) {
  const inf = {};
  for (const k in st.inf) inf[k] = [st.inf[k][0], st.inf[k][1]];
  return {
    inf, mandate: st.mandate, weariness: st.weariness, reform: `${st.reform[0]}:${st.reform[1]}`,
    hands: [st.hands[CCP].length, st.hands[KMT].length], draw: st.draw.length, discard: st.discard.length, removed: st.removed.length,
    effects: st.effects.slice(), seals: Object.keys(st.seals).sort().join(), mie: Object.keys(st.mie).sort().join(),
    revealed: st.revealed.join(), forced: st.forced.join(), luoyiYields: st.luoyiYields, winner: st.winner,
    support: (st.support || []).join(),
  };
}
const MARK_SCALARS = ["mandate", "weariness", "draw", "discard", "removed", "reform", "seals", "mie", "revealed", "forced", "luoyiYields", "winner", "support"];
const SPACE_ORDER = Object.fromEntries(SPACES.map((s, i) => [s.id, i]));
// `effect`: did the event change anything at all. When it did not, `why`:
// "noTarget" -- a choice it needed had nothing to choose from (no space with
// enemy influence, nothing in the region to hit, an empty discard pile ...);
// "noChange" -- it ran, but the board came out as it went in (every space at
// the cap, nothing left to remove, a track already full, a lasting effect
// already in play). What it changed that no other entry reports rides along:
// influence per space (`inf`: [space, Qin delta, Chu delta]), lasting effects
// added and removed (`fx`), hand sizes (`hands`: [Qin delta, Chu delta]), a
// recovery of the weariness track (`recover`), and the seat(s) that answered
// its choices (`chose`). Mandate, weariness lost, reform, seals, 滅 and
// discards already log themselves.
function logEventEnd(st, step, a) {
  const b = eventMark(st);
  const inf = [];
  for (const k in b.inf) {
    const x = a.inf[k] || [0, 0], y = b.inf[k];
    if (x[0] !== y[0] || x[1] !== y[1]) inf.push([k, y[0] - x[0], y[1] - x[1]]);
  }
  for (const k in a.inf) if (!b.inf[k] && (a.inf[k][0] || a.inf[k][1])) inf.push([k, -a.inf[k][0], -a.inf[k][1]]);
  inf.sort((p, q) => SPACE_ORDER[p[0]] - SPACE_ORDER[q[0]]);
  // Lasting effects as a multiset (函谷關天險 re-played is removed and pushed
  // back: the same set, no change).
  const fx = { add: [], rm: [] };
  // Same objects in the same order (no choice was asked, so no clone came
  // between the marks): nothing to compare. Otherwise compare by content.
  const same = a.effects.length === b.effects.length && a.effects.every((e, i) => e === b.effects[i]);
  if (!same) {
    const ea = a.effects.map((e) => JSON.stringify(e)), eb = b.effects.map((e) => JSON.stringify(e));
    const count = (arr) => arr.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {});
    const ca = count(ea), cb = count(eb);
    for (const k of new Set([...ea, ...eb])) {
      const d = (cb[k] || 0) - (ca[k] || 0), card = JSON.parse(k).card;
      for (let i = 0; i < d; i++) fx.add.push(card);
      for (let i = 0; i < -d; i++) fx.rm.push(card);
    }
  }
  const dh = [b.hands[0] - a.hands[0], b.hands[1] - a.hands[1]];
  const effect = inf.length > 0 || fx.add.length > 0 || fx.rm.length > 0 || dh[0] !== 0 || dh[1] !== 0 || MARK_SCALARS.some((k) => a[k] !== b[k]);
  const entry = { type: "eventEnd", card: step.card, side: step.side, by: step.by ?? step.side, effect };
  if (!effect) entry.why = step.empty ? "noTarget" : "noChange";
  if (step.asked && step.asked.length) entry.chose = step.asked.slice();
  if (inf.length) entry.inf = inf;
  if (fx.add.length || fx.rm.length) entry.fx = fx;
  if (dh[0] || dh[1]) entry.hands = dh;
  if (b.weariness > a.weariness) entry.recover = b.weariness;
  log(st, entry);
}

function startTurn(st) {
  st.turn++;
  const era = eraOf(st.turn);
  if (era.id !== st.era) {
    st.era = era.id;
    if (st.later[era.id]) {
      st.draw = withRng(st, (rng) => shuffle(rng, st.draw.concat(st.later[era.id])));
      delete st.later[era.id];
      log(st, { type: "era", era: era.id });
    }
  }
  st.rounds = eraLimits(st).rounds;
  st.round = 0;
  st.reformUsed = [0, 0]; st.perkUsed = [false, false]; st.forced = [null, null]; st.revealed = [false, false];
  st.headline = [null, null];
  st.situationUsed = { truce: false, jump: false };
  st.aidUsed = [false, false];
  // Rulebook 三, 回合結構: 1 the 時局 (its turn-start effect, which may ask),
  // then 2 the refill. Both are plan steps, so a 時局's decision parks the turn
  // before anyone draws (和談: the Nationalists offer from the hand they hold).
  st.phase = "situation";
  log(st, { type: "turn", turn: st.turn, era: st.era });
  // #23 round three: a mandate beyond the threshold before `mandateFrom` wins at the start of that turn
  // (#24: `MANDATE_FROM` unless the option says otherwise).
  if (mandateFromOf(st).includes(st.turn)) { mandateCheck(st); if (st.winner != null) return; }
  st.plan.splice(1, 0, { do: "situation", stage: "start", choices: [] }, { do: "deal" });
}
function dealHands(st) {
  const { hand } = eraLimits(st);
  // Alternate draws so a mid-deal reshuffle is fair. Each side up to its own hand size.
  for (let guard = 0; guard < 40; guard++) {
    let dealt = 0;
    for (const side of [CCP, KMT]) if (st.hands[side].length < hand[side]) dealt += draw(st, side, 1);
    if (!dealt) break;
  }
  st.phase = "headline";
}

// ---------- 時局 (rulebook 三, mechanism F) ----------
// The turn-start effects, one plan step that walks its stages; a choice parks
// it (tag "situation"). Everything else a 時局 does is read where the rule is
// (`sovietHeld`, `campaignMod`, `campaignLocked`, `campaign`, `jumpOpen`,
// `reformAdvance`, `attritionLoss`), from `st.turn` alone, so a turn entered by
// hand plays exactly like one reached in play.
const NE = (kind) => SPACES.filter((s) => s.region === "northeast" && (!kind || s.kind === kind)).map((s) => s.id);
function situationAsk(st, step, side, spec) {
  return ask(st, { ...step, side }, { ...spec, tag: "situation", situation: situationNow(st).id });
}
// The support tracks' fixed moves at the start of a turn (rulebook 三, 外國勢力:
// 美國支持 −1 in turn 3, 蘇聯支持 +1 in turn 5, 美國支持 +1 in turn 6 if the
// Nationalists' 行憲軌 is at 2 or more, 蘇聯支持 +1 in turn 7, 美國支持 −2 in
// turn 8). They are 外國勢力's, not the 時局's (orchestrator 裁決 #13), so they
// follow the turn number and do not ask `situationNow`: `situations: false`
// keeps them.
export const SUPPORT_SCHEDULE = [
  { turn: 3, side: KMT, delta: -1 },
  { turn: 5, side: CCP, delta: 1 },
  { turn: 6, side: KMT, delta: 1, kmtReform: 2 },
  { turn: 7, side: CCP, delta: 1 },
  { turn: 8, side: KMT, delta: -2 },
];
function supportSchedule(st) {
  for (const m of tune(st, "supportSchedule") ? st.options.supportSchedule : SUPPORT_SCHEDULE) {
    if (m.turn === st.turn && (m.kmtReform == null || st.reform[KMT] >= m.kmtReform)) moveSupport(st, m.side, m.delta);
  }
}
function situationStep(st, step) {
  const sit = situationNow(st);
  if (step.stage === "start") {
    if (sit) log(st, { type: "situation", id: sit.id });
    // The track moves first: 和談's −2 is in before the offer.
    supportSchedule(st);
    step.stage = !sit ? "done" : sit.id === "truce" ? "withdrawCcp" : sit.id === "peace_talks" ? "offer" : "done";
  }
  // 停戰, 蘇軍撤離: with 蘇聯支持 ≥ 2 the Communists first put 2 points in ONE
  // space of the Northeast (city or village, up to the cap; orchestrator 裁決 #2,
  // flagged to the owner); then the Nationalists 4 among the Northeast's three
  // cities. Neither is bound by adjacency (裁決 #2); both go through `place()`,
  // so supply is not read.
  if (step.stage === "withdrawCcp") {
    const options = NE().filter((id) => infOf(st, id)[CCP] < capOf(st, id));
    if (st.support[CCP] >= 2 && options.length) {
      if (!step.choices.length) return situationAsk(st, step, CCP, { kind: "points", n: 1, min: 1, options, side: CCP });
      const [id] = step.choices.shift();
      const n = place(st, CCP, id, 2);
      log(st, { type: "withdrawal", side: CCP, points: [id], placed: n });
      checkMarkers(st);
      if (st.winner != null) return true;
    }
    step.stage = "withdrawKmt";
  }
  if (step.stage === "withdrawKmt") {
    // #23 `withdrawalKmt`: { n, spaces } replaces the 4 points and the three cities.
    const W = tune(st, "withdrawalKmt") ? st.options.withdrawalKmt : null;
    const options = (W && W.spaces ? W.spaces : NE("city")).filter((id) => infOf(st, id)[KMT] < capOf(st, id));
    // Room for 4 is always there in play (nobody can place in these cities on
    // turn 1); short of it, as many as fit.
    const n = Math.min(W && W.n != null ? W.n : 4, options.reduce((t, id) => t + capOf(st, id) - infOf(st, id)[KMT], 0));
    if (n > 0) {
      if (!step.choices.length) return situationAsk(st, step, KMT, { kind: "points", n, min: n, options, side: KMT });
      const points = step.choices.shift();
      for (const id of points) place(st, KMT, id, 1);
      log(st, { type: "withdrawal", side: KMT, points });
      checkMarkers(st);
    }
    step.stage = "done";
  }
  // 和談: before the refill (四, 細則). The Nationalists may offer, discarding 2
  // cards that are not scoring cards (no event); the Communists accept (4 action
  // rounds each this turn) or refuse (民心 2 toward the Nationalists). Not asked
  // at all with fewer than 2 such cards.
  if (step.stage === "offer") {
    const cards = st.hands[KMT].filter((c) => !CARD[c].scoring);
    if (cards.length < 2) { step.stage = "done"; return true; }
    if (!step.choices.length) return situationAsk(st, step, KMT, { kind: "option", options: [{ id: "offer" }, { id: "pass" }] });
    if (step.choices.shift() === "pass") { log(st, { type: "peace", step: "pass" }); step.stage = "done"; return true; }
    step.stage = "discard";
  }
  if (step.stage === "discard") {
    if (!step.choices.length) {
      return situationAsk(st, step, KMT, { kind: "card", n: 2, min: 2, options: st.hands[KMT].filter((c) => !CARD[c].scoring) });
    }
    const cards = step.choices.shift();
    for (const c of cards) discardCard(st, KMT, c, { noEvent: true });
    log(st, { type: "peace", step: "offer", cards });
    step.stage = "answer";
  }
  if (step.stage === "answer") {
    if (!step.choices.length) return situationAsk(st, step, CCP, { kind: "option", options: [{ id: "accept" }, { id: "refuse" }] });
    const answer = step.choices.shift();
    log(st, { type: "peace", step: answer });
    if (answer === "accept") st.rounds = [4, 4];
    else vp(st, KMT, 2);
    step.stage = "done";
  }
  return true;
}
// Who still owes a headline. The deal in `startTurn` stops when `drawOne` runs
// out of cards (draw and discard both empty), so a side can reach the headline
// phase holding nothing: it commits no headline -- orchestrator's ruling
// (#57), flagged to the owner. Before this the phase simply never ended, for
// anyone: `legal()` answered `{ kind: "headline", cards: [] }` for ever and
// `mustAct` kept naming a side that could do nothing.
// #112: this also runs on a per-seat view, where the hand you may not see is
// `null` and its size lives in `handCounts` (`view` below; bots.js reads the
// same channel to rebuild a hidden hand). Every room client calls `mustAct` on
// a view once a second, so reading `hands[side].length` here threw a TypeError
// every second of every headline phase, for both seats and for a spectator.
// The count answers the same question without showing a card: hiding a hand
// must neither invent a headline nor lose one.
function handSize(st, side) { const h = st.hands[side]; return h ? h.length : st.handCounts[side]; }
function needsHeadline(st, side) { return st.headline[side] == null && handSize(st, side) > 0; }

function resolveHeadlines(st) {
  const played = [CCP, KMT].filter((s) => st.headline[s] != null);
  // Ties go to Qin. With only one headline it goes alone; with none (both
  // hands empty) the phase is over before it began. A side that committed
  // nothing is logged the way `beginAction` logs an action-round skip.
  const order = played.length === 2
    ? (CARD[st.headline[KMT]].ops > CARD[st.headline[CCP]].ops ? [KMT, CCP] : [CCP, KMT])
    : played;
  for (const side of [CCP, KMT]) if (st.headline[side] == null) log(st, { type: "skip", side });
  log(st, { type: "headline", cards: st.headline, first: order[0] ?? null });
  const steps = [];
  for (const side of order) {
    const card = st.headline[side];
    if (CARD[card].scoring) steps.push({ do: "score", region: CARD[card].scoring, side });
    else steps.push({ do: "event", card, side: CARD[card].side ?? side, by: side, choices: [] });
    steps.push({ do: "finishCard", card, side, triggered: true });
  }
  steps.push({ do: "beginAction" });
  st.plan.splice(1, 0, ...steps);
  st.phase = "action"; st.round = 1; st.actor = CCP;
}

// A side with nothing to play skips its half of the action round (rulebook
// 四、細則). There is no decision in a skip, so `run` does not stop: with both
// hands empty the remaining rounds, the end of the turn and the next deal all
// come out of whichever `apply` emptied the last hand.
function beginAction(st) {
  if (st.winner != null) return;
  st.phasing = st.actor;
  // The obligation lapsed while someone else was acting (#55): drop the stale
  // name so the state this side is about to see says what the rules say.
  if (st.forced[st.actor] && !forcedCard(st, st.actor)) st.forced[st.actor] = null;
  if (!hasCards(st, st.actor)) {
    log(st, { type: "skip", side: st.actor });
    st.plan.push({ do: "endAction" });
  }
}
// `st.round` is the action round the actor is in; `st.rounds` is [Communists,
// Nationalists]. The Communists go first and the two alternate while both have
// rounds left; the side with more then takes the rest in a row, last (#2):
// 6/7 is 共國 ×6 then 國, 7/6 is 共國 ×6 then 共.
function endAction(st) {
  if (st.winner != null) return;
  const r = st.round, left = (side, n) => n <= st.rounds[side];
  let next = null;
  if (st.actor === CCP) next = left(KMT, r) ? [KMT, r] : left(CCP, r + 1) ? [CCP, r + 1] : null;
  else next = left(CCP, r + 1) ? [CCP, r + 1] : left(KMT, r + 1) ? [KMT, r + 1] : null;
  if (!next) { st.plan.push({ do: "endTurn" }); return; }
  [st.actor, st.round] = next;
  st.plan.push({ do: "beginAction" });
}
function endTurnChecks(st) {
  if (probe.home) probe.home(st, "turnEnd");
  const holding = [CCP, KMT].filter((s) => st.hands[s].some((c) => CARD[c].scoring));
  if (holding.length === 2) return win(st, KMT, "scoringBoth");
  if (holding.length === 1) return win(st, other(holding[0]), "scoring");
  homeFallAtTurnEnd(st);
  if (st.winner != null) return;
  // CIVIL WAR (#1): rulebook 三, 回合結構 5 -- 遷都判定 → 孤城藍 −1 → 民生回復 1.
  supplyAttrition(st);
  if (st.winner != null) return;
  recover(st, 1);
  if (st.luoyiYields) {
    const ctl = controller(st, "luoyi");
    if (ctl != null) vp(st, ctl, st.options.luoyi);
  }
  // #8, 金圓券: 民心 owed at this turn's 結算 (`turnEndVp`, `until: "turn"`), paid
  // here, once, before 「本回合的效果結束」 takes the effect away.
  for (const e of st.effects.filter((x) => x.kind === "turnEndVp")) {
    log(st, { type: "turnEndVp", card: e.card, to: e.to, n: e.n });
    vp(st, e.to, e.n);
    if (st.winner != null) return;
  }
  st.effects = st.effects.filter((e) => e.until !== "turn");
  log(st, { type: "endTurn", turn: st.turn, weariness: st.weariness });
}
function finalScoring(st) {
  for (const r of SCORED_REGIONS) { scoreRegion(st, r); if (st.winner != null) return; }
  if (st.mandate > 0) win(st, CCP, "final");
  else if (st.mandate < 0) win(st, KMT, "final");
  else win(st, st.options.tie === "ccp" ? CCP : KMT, "tie");
}
function finishCard(st, step) {
  const c = step.card;
  if (isAid(c)) return; // never a pile's (#4); `play` plans no finishCard for one anyway
  if (st.hands[CCP].includes(c) || st.hands[KMT].includes(c) || st.removed.includes(c) || st.discard.includes(c)) return;
  if (step.triggered && CARD[c].remove) st.removed.push(c);
  else st.discard.push(c);
}
// The one door for spending ops, whichever action brought them: `play` dry
// runs it through `validateOps` before it commits, and so does `choose` for
// the ops steps that ask (the event-first branch, 商旅通賈). Every refusal is
// a rules `Error`, so a payload with no points or a space that is not on the
// board is a refusal too, not a TypeError from three calls down (#16).
function doOps(st, side, card, ops, choice) {
  if (!choice || typeof choice !== "object") fail("ops: no choice");
  if (choice.use === "place") {
    if (!Array.isArray(choice.points)) fail("place: points must be a list");
    for (const id of choice.points) if (!SPACE[id]) fail(`place: unknown space ${id}`);
    // `placePoints` reads the aid card itself (蘇援's +1, 美援's airlift).
    placePoints(st, side, choice.points, ops, isAid(card) ? card : undefined);
  } else if (choice.use === "campaign") {
    if (!SPACE[choice.target]) fail(`campaign: unknown space ${choice.target}`);
    ops += aidBonus(card, choice);
    const t = choice.target;
    if (infOf(st, t)[other(side)] <= 0) fail("campaign: no enemy influence there");
    if (sovietHeld(st, t)) fail("campaign: the Soviets hold it this turn (受降)");
    if (side === CCP && garrisoned(st, t)) fail("campaign: 美軍駐華 -- the Communists may not raid it while 美國支持 is 3 or more");
    if (campaignLocked(st, t, side)) fail("campaign: locked by weariness");
    if (isProtected(st, t)) fail("campaign: the space is protected this turn");
    if (campaignBanned(st, t, side)) fail("campaign: no 奇襲 there this turn (an event)");
    // #26, mechanism B: a city needs a Communist-controlled space next to it and a plan.
    if (!siegeOpen(st, side, t)) fail("campaign: 圍點打援 -- the Communists control no space next to that city");
    if (siegeNeeded(st, side, t) && !SIEGE_PLANS.includes(choice.siege)) fail("campaign: an attack on a city must name its plan, siege: point or relief");
    if (mechB(st) && (side === KMT || siegeNeeded(st, side, t))) declareAttack(st, side, t, ops, choice.siege);
    else campaign(st, side, t, ops);
  } else if (choice.use === "lobby") {
    if (!SPACE[choice.target]) fail(`lobby: unknown space ${choice.target}`);
    ops += aidBonus(card, choice);
    const t = choice.target;
    if (infOf(st, t)[other(side)] <= 0) fail("lobby: no enemy influence there");
    if (!lobbyEligible(st, side, t)) fail("lobby: no influence of your own there");
    if (!LOBBY[st.options.lobby] && edge(st, side, t) <= 0) fail("lobby: no edge there");
    if (isProtected(st, t)) fail("lobby: the space is protected this turn");
    lobby(st, side, t, ops);
  } else fail(`ops: bad use ${choice.use}`);
}

// ---------- actions ----------
export function mustAct(st) {
  if (st.winner != null) return [];
  if (st.pending) return [st.pending.who];
  if (st.phase === "headline") return [CCP, KMT].filter((s) => needsHeadline(st, s));
  if (st.phase === "action") return [st.actor];
  return [];
}

export function apply(state, action) {
  const st = clone(state);
  if (st.winner != null) fail("game over");
  // Copied before the handlers run, so what is kept is the action as given.
  const given = Array.isArray(st.actions) ? clone(action) : null;
  let out;
  switch (action.type) {
    case "choose": out = choose(st, action); break;
    case "headline": out = headline(st, action); break;
    case "play": out = play(st, action); break;
    default: fail(`unknown action ${action.type}`);
  }
  // Only an accepted action gets here: a refusal throws and the clone is dropped.
  if (given) out.actions.push(given);
  return out;
}

// #137: the game again from its seed, its options and its recorded actions.
// `options` is the game's own `st.options` (an export's `game.options`), used
// EXACTLY as recorded: it is not merged over today's DEFAULT_OPTIONS, so a key
// the recorded object lacks (a key added or a default flipped since, or one a
// JSON copy dropped because it was undefined) stays absent, which the engine
// reads as the old rule, as it did when the game was played. No actions (a game from before #137, or the tutorial) means
// no replay: this throws rather than hand back a game that never happened.
export function replay(seed, options, actions) {
  if (!Array.isArray(actions)) fail("replay: this game has no recorded actions");
  let st = startGame(seed, clone(options || {}));
  for (const a of actions) st = apply(st, a);
  return st;
}

function choose(st, action) {
  const p = st.pending;
  if (!p) fail("nothing to choose");
  if (action.side !== p.who) fail("not your choice");
  const step = st.plan[0];
  const choice = validateChoice(st, p, action.choice);
  st.pending = null;
  step.choices.push(choice);
  return run(st);
}
function validateChoice(st, p, choice) {
  switch (p.kind) {
    case "points": {
      if (!Array.isArray(choice) || choice.length < p.min || choice.length > p.n) fail("points: wrong count");
      const opts = new Set(p.options);
      const counts = {};
      for (const id of choice) {
        if (!opts.has(id)) fail(`points: ${id} not allowed`);
        counts[id] = (counts[id] || 0) + 1;
        if (p.distinct && counts[id] > 1) fail("points: repeats not allowed");
        if (p.maxPer && counts[id] > p.maxPer) fail(`points: more than ${p.maxPer} in ${id}`);
        if (p.maxOf && counts[id] > (p.maxOf[id] ?? 0)) fail(`points: not that many in ${id}`);
        if (p.side != null && infOf(st, id)[p.side] + counts[id] > capOf(st, id)) fail(`points: ${id} over the cap`);
      }
      return choice;
    }
    case "card": {
      const arr = Array.isArray(choice) ? choice : choice == null ? [] : [choice];
      if (arr.length < (p.min ?? 1) || arr.length > (p.n ?? 1)) fail("card: wrong count");
      for (const c of arr) if (!p.options.includes(c)) fail(`card: ${c} not allowed`);
      return arr;
    }
    case "option": {
      if (!p.options.some((o) => o.id === choice)) fail(`option: ${choice} not allowed`);
      return choice;
    }
    case "ops": {
      if (!choice || !p.allowed.includes(choice.use)) fail("ops: bad use");
      // The same dry run `play` does, so ops that arrive through this door are
      // refused by the same rules with the same error (#16). Without it an
      // illegal `points` / `target` only blew up once `run` reached the step.
      validateOps(st, p.who, p.card, p.ops, choice);
      return choice;
    }
    default: fail(`choose: unknown kind ${p.kind}`);
  }
}

function headline(st, action) {
  if (st.phase !== "headline") fail("not the headline phase");
  const side = action.side;
  if (st.headline[side] != null) fail("already headlined");
  const c = action.card;
  if (isAid(c)) fail("an aid card may not be headlined");
  const h = st.hands[side], i = h.indexOf(c);
  if (i < 0) fail("card not in hand");
  h.splice(i, 1);
  st.headline[side] = c;
  // Everyone who owed a headline has one now (a side with no card owes none, #57).
  if (![CCP, KMT].some((s) => needsHeadline(st, s))) st.plan.unshift({ do: "headline" });
  return run(st);
}

// 馬歇爾調處 (#6) is Zongheng's 說客: played with an enemy card from the same hand
// (one action round), that card's ops, its event not set off, both discarded.
// While 美國支持 is 0 it pairs with nothing: `legal()` offers no pair and `play`
// refuses one, so the card is only its own 1 op. Alone as an event it does nothing.
const MARSHALL = "marshall_mission";
function marshallPairs(st) { return ((st.support || [])[KMT] || 0) > 0; }
function play(st, action) {
  if (st.phase !== "action" || st.pending) fail("not an action round");
  const side = action.side;
  if (side !== st.actor) fail("not your action");
  const c = action.card, use = action.use;
  const steps = [];
  // 頓兵堅城 is read before anything is played, the aid card included (as it
  // was for Zongheng's Cauldrons): while a discard is owed AND possible the
  // round IS the discard (#57), so every other play is refused with the bog's
  // own message (#59: `play()` must not take what `legal()` does not offer).
  const h = st.hands[side];
  const bog = st.effects.find((e) => e.kind === "bog" && e.who === side);
  const bogCards = bog ? h.filter((x) => CARD[x].ops >= 2) : [];
  if (isAid(c)) {
    // The aid card (#4): one action round, instead of a card from the hand.
    // Not a hand's card, so it goes to no pile and to nobody; `aidUsed` marks it.
    if (aidSide(c) !== side) fail("that aid card is the other side's");
    if (!st.options.aid) fail("no aid cards in this game");
    if (st.aidUsed && st.aidUsed[side]) fail("the aid card is used already this turn");
    if (!aidAvailable(st, side)) fail("the aid card: support is 0");
    if (!aidUsable(st, side)) fail("the aid card has nothing it could do now");
    if (bogCards.length) fail("頓兵堅城: discard a card of 2+ ops first");
    if (forcedCard(st, side)) fail("you must play the named card");
    if (!["place", "campaign", "lobby"].includes(use)) fail("the aid card: place, campaign or lobby only");
    const ops = opsOf(st, side, c), payload = { use, points: action.points, target: action.target, ...(action.siege != null ? { siege: action.siege } : {}) };
    validateOps(st, side, c, ops, payload);
    st.aidUsed[side] = true;
    steps.push({ do: "ops", side, card: c, ops, payload }, { do: "endAction" });
    // Logged like any card's play, before its ops (#81): the news, the
    // opponent's-move reveal (#79) and the log panel read a move's start here.
    log(st, { type: "play", side, card: c, use });
    st.plan.unshift(...steps);
    return run(st);
  }
  if (!h.includes(c)) fail("card not in hand");
  const card = CARD[c];
  // 頓兵堅城 (dunbing, 69) and 細作 (xizuo, 67) both claim this action round.
  // orchestrator's ruling (#57), flagged to the owner: the bog comes first and
  // 細作 carries. While a discard is owed AND possible, the round IS the
  // discard -- any card of 2+ ops, named or not, the player's choice -- so the
  // named-card check does not apply to it. With no card the bog can take, the
  // card's own text says the round is a normal one and the bog waits: then the
  // named card must be played, as before. Until this the two refusals crossed
  // and a named card under 2 ops left the side with nothing at all to do
  // (seed 1332 on fallbacks, turn 7, Chu forced to play 記分 score_east).
  const bogRound = bogCards.length > 0 && use === "bog";
  const forced = forcedCard(st, side);
  if (forced && forced !== c && !bogRound) fail("you must play the named card");
  if (bogCards.length && use !== "bog") fail("頓兵堅城: discard a card of 2+ ops first");
  h.splice(h.indexOf(c), 1);
  // The obligation is not used up by a bog discard of another card (#57): it
  // waits for the side's next action round. Discarding the named card itself
  // ends it, like playing it -- and `forcedCard` would say so anyway, since
  // the card has left the hand.
  if (!bogRound || c === forced) st.forced[side] = null;
  const ops = opsOf(st, side, c);
  if (use === "bog") {
    if (!bogCards.includes(c)) fail("bog: that card cannot be discarded");
    removeEffect(st, (e) => e === bog);
    log(st, { type: "bog", side, card: c });
    steps.push({ do: "finishCard", card: c, side, triggered: false }, { do: "endAction" });
  } else if (card.scoring) {
    if (use !== "event") fail("a scoring card must be played as its event");
    steps.push({ do: "score", region: card.scoring, side }, { do: "finishCard", card: c, side, triggered: true }, { do: "endAction" });
  } else if (use === "event") {
    steps.push({ do: "event", card: c, side: card.side ?? side, by: side, choices: [] }, { do: "finishCard", card: c, side, triggered: true }, { do: "endAction" });
  } else if (use === "reform") {
    if (reformUsesLeft(st, side) <= 0) fail("reform: no advances left this turn");
    if (card.ops < reformThreshold(st, side)) fail("reform: card below the threshold");
    steps.push({ do: "reform", side }, { do: "finishCard", card: c, side, triggered: false }, { do: "endAction" });
  } else if (["place", "campaign", "lobby"].includes(use)) {
    const payload = { use, points: action.points, target: action.target, ...(action.siege != null ? { siege: action.siege } : {}) };
    const enemy = card.side != null && card.side !== side;
    const paired = c === MARSHALL && action.pair;
    // The player chooses whether an enemy card's ops or its event comes first
    // (owner's ruling, #71). A missing or unknown order used to fall silently
    // into ops-first, so an old client, a bug or a hand-made room message could
    // skip the choice (#73). 馬歇爾調處's pair has no event, so it needs no order.
    if (enemy && !paired && action.order !== "opsFirst" && action.order !== "eventFirst") {
      fail("an enemy card needs an order: opsFirst or eventFirst");
    }
    if (paired) {
      // 馬歇爾調處 (Zongheng's 說客): the paired enemy card's ops, no event, both
      // discarded. Not while 美國支持 is 0: the card is then 1 op alone (#6).
      const pair = CARD[action.pair];
      if (!marshallPairs(st)) fail("馬歇爾調處: 美國支持 is 0, the card is 1 op alone");
      if (!pair || !h.includes(action.pair) || pair.side !== other(side)) fail("馬歇爾調處: pair an enemy card from your hand");
      h.splice(h.indexOf(action.pair), 1);
      const pops = opsOf(st, side, action.pair);
      validateOps(st, side, action.pair, pops, payload);
      steps.push({ do: "ops", side, card: action.pair, ops: pops, payload });
      steps.push({ do: "finishCard", card: c, side, triggered: false }, { do: "finishCard", card: action.pair, side, triggered: false }, { do: "endAction" });
    } else if (enemy && action.order === "eventFirst") {
      steps.push({ do: "event", card: c, side: card.side, by: side, choices: [] });
      // The event resolves before this card's ops are spent, so the ops are
      // read after it (`afterEvent`): an event that changes the player's ops
      // this turn counts for this card too (荊軻刺秦王 played by Qin, owner
      // 裁決 #119: the card text literally; it used to keep the play-time ops).
      steps.push({ do: "ops", side, card: c, ops, payload: null, choices: [], afterEvent: true });
      steps.push({ do: "finishCard", card: c, side, triggered: true }, { do: "endAction" });
    } else {
      validateOps(st, side, c, ops, payload);
      steps.push({ do: "ops", side, card: c, ops, payload });
      if (enemy) steps.push({ do: "event", card: c, side: card.side, by: side, choices: [] });
      steps.push({ do: "finishCard", card: c, side, triggered: enemy }, { do: "endAction" });
    }
  } else fail(`play: bad use ${use}`);
  // 馬歇爾調處's pair is named (#115): its ops are the move's ops and it goes to
  // the discard pile, so a log without it read as the card played alone.
  log(st, { type: "play", side, card: c, use, ...(c === MARSHALL && action.pair ? { pair: action.pair } : {}) });
  // Event first, the ops are chosen only after the event, and may go to any
  // use then: the `use` above is only what the play said. The ops step writes
  // the real one back into this entry (#115: the log read 「扶植 4」 for a raid).
  for (const s of steps) if (s.do === "ops" && !s.payload) s.playSeq = st.logSeq;
  st.plan.unshift(...steps);
  return run(st);
}
// Validate ops without mutating: replay the placement on a throwaway copy.
function validateOps(st, side, card, ops, payload) {
  const trial = clone(st);
  trial.log = [];
  doOps(trial, side, card, ops, payload);
}

// ---------- what a side may do now (for the UI and the bots) ----------
// Where ops can go right now: placement targets with their cost per point,
// campaign targets (enemy influence, not locked, not protected), lobby
// targets with a positive edge.
// `card` (#4): an aid card's id, or absent. Only 美援 changes a list: its place
// options also hold the 孤城 (`airliftOk`), as `placeTargets(…, card)` lights
// them before the first point. 美軍駐華 (`garrisoned`) takes 天津 and 上海 out of
// the Communists' campaign targets whatever the card.
export function opsOptions(st, side, card) {
  const barred = placeBarred(st, side), jump = jumpOpen(st, side);
  const airlift = card === "american_aid" ? (id) => airliftOk(st, id) : () => false;
  const placeOptions = SPACES.filter((s) => (canPlaceAt(st, side, s.id) || (jump && s.kind === "village")) && infOf(st, s.id)[side] < capOf(st, s.id) && (!barred(s.id) || airlift(s.id)) && !sovietHeld(st, s.id))
    .map((s) => ({ id: s.id, cost: placeCost(st, side, s.id) }));
  const campaignTargets = SPACES.filter((s) => canCampaign(st, side, s.id) && siegeOpen(st, side, s.id)).map((s) => s.id);
  const realigning = !!LOBBY[st.options.lobby];
  const lobbyTargets = SPACES.filter((s) => lobbyEligible(st, side, s.id) && !isProtected(st, s.id))
    .map((s) => ({ id: s.id, edge: edge(st, side, s.id) })).filter((x) => realigning || x.edge > 0);
  return { placeOptions, campaignTargets, lobbyTargets };
}
export function legal(st, side) {
  if (st.winner != null) return { kind: "over" };
  if (st.pending) return st.pending.who === side ? { kind: "pending", pending: st.pending } : { kind: "wait" };
  if (st.phase === "headline") {
    return needsHeadline(st, side) ? { kind: "headline", cards: st.hands[side].slice() } : { kind: "wait" };
  }
  if (st.phase !== "action" || st.actor !== side) return { kind: "wait" };
  const h = st.hands[side];
  const bog = st.effects.some((e) => e.kind === "bog" && e.who === side);
  const bogCards = bog ? h.filter((x) => CARD[x].ops >= 2) : [];
  if (bogCards.length) return { kind: "action", bog: bogCards, cards: [] };
  const { placeOptions, campaignTargets, lobbyTargets } = opsOptions(st, side);
  const forced = forcedCard(st, side);
  const cards = h.filter((c) => !forced || c === forced).map((c) => {
    const card = CARD[c];
    if (card.scoring) return { id: c, ops: 0, uses: { event: true } };
    const ops = opsOf(st, side, c);
    const uses = {
      event: true,
      place: placeOptions.length ? { ops, options: placeOptions } : null,
      campaign: campaignTargets.length ? { ops, targets: campaignTargets } : null,
      lobby: lobbyTargets.length ? { ops, targets: lobbyTargets } : null,
      reform: reformUsesLeft(st, side) > 0 && card.ops >= reformThreshold(st, side),
      enemy: card.side != null && card.side !== side,
    };
    if (c === MARSHALL) uses.pair = marshallPairs(st) ? h.filter((x) => CARD[x].side === other(side)) : [];
    return { id: c, ops, uses };
  });
  // The aid card (#4): null when it may not be used now (option off, used this
  // turn, support 0, nothing it could do, or 細作 names a card; the bog
  // returned above). Its `place` is null unless a point is affordable.
  let aid = null;
  if (!forced && aidAvailable(st, side)) {
    const u = aidUses(st, side);
    if (u.place || u.campaign || u.lobby) aid = u;
  }
  return { kind: "action", cards, aid, forced };
}

// ---------- the per-seat view ----------
export function view(st, side) {
  // The plan stays: it names only cards already face up and choices already
  // made, and a bot answering a pending needs it to simulate.
  // #137: the action list never goes into a view's top level, mid-game or
  // after (it names hidden choices); it is left out of the copy rather than
  // copied and deleted, since bots and the UI call this constantly.
  const v = clone({ ...st, actions: undefined });
  // The seed goes with the rng state (#131): the game replays from seed +
  // moves and the decks are public, so a seed rebuilds both hands and the draw.
  delete v.seed; delete v.rngState;
  v.drawCount = st.draw.length; delete v.draw;
  v.laterCounts = Object.fromEntries(Object.entries(st.later).map(([k, a]) => [k, a.length])); delete v.later;
  v.handCounts = [st.hands[CCP].length, st.hands[KMT].length];
  // #26: the Communists' plan for an attack on a city (打點 / 打援) is face down
  // until the Nationalists have answered: only the Communists' view has it.
  if (side !== CCP) for (const p of v.plan || []) if (p.do === "siege" && p.stage === "respond") p.plan = null;
  if (st.options.homeFall && st.options.homeFall !== "none") v.homeCapitals = homeCapitalStatus(st);
  if (side == null) {
    // A spectator sees the table and neither hand.
    v.hands = [null, null];
    if (st.phase === "headline") v.headline = st.headline.map((h) => (h == null ? null : "hidden"));
  } else {
    const opp = other(side);
    const showOpp = st.revealed[side] || (st.pending && st.pending.who === side && st.pending.showHand);
    if (!showOpp) v.hands[opp] = null;
    // Headlines stay hidden until both are in, unless 行縣制 lets this side peek.
    if (st.phase === "headline" && st.headline[side] == null && !hasPerk(st, side, "peek")) v.headline[opp] = st.headline[opp] == null ? null : "hidden";
    if (st.phase === "headline" && st.headline[opp] == null) v.headline[opp] = null;
  }
  // A card choice someone else is answering may list cards of a hand this
  // viewer cannot see (明法令's discard, 春申君, 韓非入秦): those options are
  // dropped (#131). The side that answers keeps them all.
  if (v.pending && v.pending.who !== side && v.pending.kind === "card") {
    const hidden = new Set([CCP, KMT].filter((s) => v.hands[s] == null).flatMap((s) => st.hands[s]));
    v.pending.options = v.pending.options.filter((c) => !hidden.has(c));
  }
  // #137: once the game is over everything is revealed, to every seat and to
  // spectators alike: both hands, the draw pile and the later eras in order,
  // the discard and removed piles, the seed (seed + options + the moves replay
  // the whole game) and the board. The rest of the view keeps #131's shape;
  // `final` is the one place the secrets appear, and only after the end.
  if (st.winner != null) {
    v.final = clone({
      hands: st.hands, draw: st.draw, later: st.later, discard: st.discard, removed: st.removed,
      seed: st.seed ?? 0, inf: st.inf, reform: st.reform, weariness: st.weariness, seals: st.seals, mie: st.mie,
    });
    // With seed + options (`v.options`) the recorded actions replay the game
    // (`replay`). A game without them (older save, tutorial) has no `actions`
    // key here at all: that absence is the "not replayable" mark.
    if (Array.isArray(st.actions)) v.final.actions = clone(st.actions);
  }
  return v;
}

// CIVIL WAR: Zongheng's export module (the download's JSON) is not copied yet.

// ---------- supply (CIVIL WAR; rulebook 三, 補給) ----------
// Sources: every port the Nationalists control, and their current capital.
// A space is supplied when a path of adjacent spaces, none of them controlled
// by the Communists, leads from it to a source; the source itself is on the
// path, so a capital the Communists control supplies nothing.
// The readings below answer whatever `options.supply` says; the two effects
// (`placeBarred`, `supplyAttrition`, #1) are on only when it is true. An absent
// key is off: a game created before #1 keeps its rules (createGame merges once).
export function supplySources(st) {
  const capital = homeCapital(st, KMT);
  return SPACES.filter((s) => (s.port && controller(st, s.id) === KMT) || s.id === capital).map((s) => s.id);
}
export function supplied(st) {
  const open = (id) => controller(st, id) !== CCP;
  const queue = supplySources(st).filter(open), seen = new Set(queue);
  while (queue.length) {
    for (const a of adjOf(st, queue.shift())) if (!seen.has(a) && open(a)) { seen.add(a); queue.push(a); }
  }
  return seen;
}
// 孤城: the cities with Nationalist influence that no source reaches.
export function isolatedCities(st) {
  const ok = supplied(st);
  // #26: a besieged city (圍城) counts as one this turn.
  return SPACES.filter((s) => s.kind === "city" && infOf(st, s.id)[KMT] > 0 && (!ok.has(s.id) || besieged(st, s.id))).map((s) => s.id);
}
// 孤城的效果 1 (#1): the Nationalists may not 扶植 into a city no source reaches.
// The test is `supplied`, not `isolatedCities`: a city with no blue and no
// supply takes no first point either (orchestrator 裁決 #1, flagged to the
// owner), else the first point would go in and only then make it a 孤城.
// Villages are never barred, nor the Communists. This is the ban on the 扶植
// action only -- `place()` (events, the free placements) does not read it.
// Returns a predicate on a space id, for the board as it stands: placeTargets,
// placePoints and opsOptions all ask it, so the three cannot disagree.
// The one exception, 美援's airlift into a 孤城 (#4), is read on top of this by
// the same three (`airliftOk`); this predicate itself stays the plain ban.
function placeBarred(st, side) {
  if (!st.options.supply || side !== KMT) return () => false;
  const ok = supplied(st);
  return (id) => SPACE[id].kind === "city" && !ok.has(id);
}
// 孤城的效果 2 (#1): how many points each 孤城 loses at the end of this turn.
// The one place to change it: turn 7's 時局 (決戰) makes it 2 (#2), and 空運孤城
// stops it for the turn it is played in, turn 7's 2 included (#8: its
// `noAttrition` effect, gone with the turn's other effects right after).
// Exported read-only for the bots (#12): what the evaluation expects a 孤城 to lose.
export function attritionLoss(st) {
  if (!st.options.supply || st.effects.some((e) => e.kind === "noAttrition")) return 0;
  if (tune(st, "attritionLosses")) return st.options.attritionLosses[situationNow(st)?.id === "decisive_battle" ? 1 : 0];
  return situationNow(st)?.id === "decisive_battle" ? 2 : 1;
}
// At the end of the turn, after the capital check (so a capital that moved
// supplies already): read the 孤城 once, each loses `attritionLoss` (not below
// 0), one `attrition` entry if any did, then the markers once (rulebook 四,
// 細則: a loss may cost control, a 整編 marker, or give an 易幟).
function supplyAttrition(st) {
  const n = attritionLoss(st);
  if (n <= 0) return;
  const losses = {};
  for (const id of isolatedCities(st)) {
    const k = remove(st, KMT, id, n);
    if (k > 0) losses[id] = k;
  }
  if (!Object.keys(losses).length) return;
  log(st, { type: "attrition", losses });
  checkMarkers(st);
}
