// The 72 cards, straight from the rulebook's table (Projects/civil_war/
// civil_war - rulebook.md, section 五). Each record carries the deck (`era`),
// the owner (`side`: 0 the Communists, 1 the Nationalists, null neutral),
// printed ops, whether the event removes the card (`remove`), the year for the
// rules page, the rulebook's Chinese text, and `effect`.
//
// `effect(st, side, ch, step)`, as in Zongheng: `side` is the event's owner (the
// player for a neutral card), `ch` the choices made so far. An effect that needs
// a decision returns a spec; the engine parks it in `pending` and re-runs the
// effect with the choice appended once it is made, so stage k of an effect runs
// exactly when `ch.length === k`. A spec with nothing to choose from (no options,
// or `n` 0, and `min` 0) resolves itself as "nothing" (`noTarget`).
//
// M1, in three batches. #6: the 24 events of 接收期 (orchestrator 裁決 #6):
//   - placements go through `E.place()`: not bound by adjacency, not by supply,
//     up to the cap (the rest vanishes), and nothing into 受降's Northeast cities
//     (`sovietHeld`), which are not even offered;
//   - 「最多 N」 asks for min(N, what can be chosen), no fewer; 「各放 / 各移除」
//     picks are distinct, 「可分散」 ones may repeat;
//   - a free 奇襲 uses the printed ops plus the card's own bonus (not the 「所有牌
//     行動點 ±1」 effects), over the targets the side could 奇襲 as an action,
//     within the card's list (`E.eventCampaignTargets`); 民生 is pushed by the
//     player acting (`st.phasing`); no target, nothing;
//   - a sided card's choices are its owner's, a neutral card's the player's.
// #7: the 22 events of 易勢期, under the same rules, plus orchestrator 裁決 #7:
//   - 「不受封鎖」 lifts only 民生's lock (`{ locks: false }`);
//   - 「若因此控制」 is: not controlled before the event, controlled after it;
//   - 潛伏、戰略機動、久攻不下、熊向暉 are Zongheng's 細作、徙民實邊、頓兵堅城 and
//     its 「查看手牌」 (`st.forced`, `bog`, `st.revealed`).
// #8: the 21 events of 決戰期, under the same rules, plus orchestrator 裁決 #8:
//   - 平津戰役 lifts 美軍駐華 only (`{ garrison: false }`);
//   - 史達林的建議 bars the Communists only (`campaignBan` with `who`);
//   - 金圓券's 民心 is paid once, at that turn's 結算 (`turnEndVp`); 空運孤城's
//     「不掉點」 is that turn's only (`noAttrition`);
//   - 陣前倒戈、補給不繼、大公報社評 are Zongheng's 奪將、逐客令、天狗食日.
// Every card has its event now. A card left out of EFFECTS would still be
// `todo`, with an `effect` that throws, loudly, so that a game which reaches
// one stops instead of quietly doing nothing.
import * as E from "./engine.js";
import { SPACES, SPACE, STATES, REGIONS, SCORED_REGIONS } from "./board.js";

const C = 0, K = 1, N = null;

const notYet = (id) => () => { throw new Error(`card event not implemented yet: ${id} (M1)`); };
const scoring = (id, num, zh, en, region, era) => ({ id, num, zh, en, era, side: null, ops: 0, remove: false, scoring: region, text: `${zh}:結算${zh.slice(0, -2)}。`, effect: () => null });
// A card whose event is written (in EFFECTS below) has it; any other is `todo`.
const card = (id, num, zh, en, era, side, ops, remove, year, text) => (EFFECTS[id]
  ? { id, num, zh, en, era, side, ops, remove, year, text, effect: EFFECTS[id] }
  : { id, num, zh, en, era, side, ops, remove, year, text, todo: true, effect: notYet(id) });

// ---------- helpers for the events ----------
const spaces = (pred) => SPACES.filter(pred).map((s) => s.id);
const inNE = (s) => s.region === "northeast";
const withRoom = (st, side, list) => list.filter((id) => E.infOf(st, id)[side] < E.capOf(st, id));
// Where an event may put `side`'s points: room under the cap, and not 受降's Northeast cities.
const placeable = (st, side, list) => withRoom(st, side, list).filter((id) => !E.sovietHeld(st, id));
// Pick k distinct spaces, k = min(n, how many there are): 「最多 N」, and 「任 N」 short of spaces.
const pickN = (who, n, options, extra = {}) => {
  const k = Math.min(n, options.length);
  return { kind: "points", who, n: k, min: k, distinct: true, options, ...extra };
};
const pick = (who, options, extra = {}) => pickN(who, 1, options, extra);
// The free 奇襲 (orchestrator 裁決 #6, 4), for this batch and the next two.
// `ops` is the printed ops plus the card's own bonus; `list` the card's spaces;
// `opts` what the card says it ignores (`{ locks: false }`, `{ garrison: false }`).
function freeCampaign(st, side, ch, list, ops, opts) {
  if (!ch.length) return pick(side, E.eventCampaignTargets(st, side, list, opts));
  const [t] = ch[0];
  if (t) E.campaign(st, side, t, ops, { pusher: st.phasing });
  return null;
}
const CAPITALS = Object.values(STATES).map((s) => s.capital); // 本據: 察綏、太原、桂林、蘭州、昆明
const cities = (pred = () => true) => spaces((s) => s.kind === "city" && pred(s));
const support = (st, side) => (st.support || [])[side] || 0;
const until = (id, side, e) => ({ card: id, side, ...e, until: "turn" }); // 「本回合」「持續至回合結束」: gone at 結算's 「本回合的效果結束」
const villages = (pred = () => true) => spaces((s) => s.kind === "village" && pred(s));
const opp = (side) => 1 - side;
// How many points `side` could still put among `options`, at most `maxPer` in each.
const roomIn = (st, side, options, maxPer = Infinity) => options.reduce((r, id) => r + Math.min(maxPer, Math.max(0, E.capOf(st, id) - E.infOf(st, id)[side])), 0);
// 胡宗南佔延安 removes 轉戰陝北 (orchestrator 裁決 #7, 1): the lasting effect goes,
// and the card leaves the game if it is in the discard or the draw pile; in a
// hand it stays where it is.
function dropNorthernShaanxi(st) {
  E.removeEffect(st, (e) => e.card === "northern_shaanxi");
  for (const pile of ["discard", "draw"]) {
    const i = st[pile].indexOf("northern_shaanxi");
    if (i >= 0) { st[pile].splice(i, 1); st.removed.push("northern_shaanxi"); }
  }
}
// 大公報社評 (Zongheng's 天狗食日): one card of the opponent's hand, not a scoring
// card, drawn with the game's own RNG (`st.rngState`), so a game replays from its seed.
function randomEnemyCard(st, side) {
  const h = st.hands[opp(side)].filter((c) => !CARD[c].scoring);
  if (!h.length) return null;
  const rng = E.makeRng(0); rng.setState(st.rngState);
  const c = h[rng.int(h.length)];
  st.rngState = rng.getState();
  return c;
}
// 傅冬菊's choices (orchestrator 裁決 #8, 7): the cards whose effects in play are
// the Nationalists' (`side === KMT`), lasting or to the end of the turn, one entry
// a card. 金圓券's 民心 at the end of the turn (`turnEndVp`) is not among them: it
// is what the card costs, settled once, not a lasting effect (BE's reading, flagged on #8).
const kmtEffects = (st) => [...new Set(st.effects.filter((e) => e.side === K && e.kind !== "turnEndVp").map((e) => e.card))];

// The events, by card id. The table at the bottom takes a card's event from here;
// a card with none here is still `todo`. The decisions and their shapes are the
// table of orchestrator 裁決 #6.
const EFFECTS = {
  // ---------- 接收期・國軍 ----------
  // Up to 3 cities outside the Northeast with no red (and room for blue): each +1.
  surrender_order(st, side, ch) {
    if (!ch.length) return pickN(K, 3, placeable(st, K, cities((s) => !inNE(s) && E.infOf(st, s.id)[C] === 0)), { side: K });
    for (const id of ch[0]) E.place(st, K, id, 1);
  },
  // Two cities with room: each +2, or +1 while 美國支持 is under 3.
  airlift(st, side, ch) {
    if (!ch.length) return pickN(K, 2, placeable(st, K, cities()), { side: K });
    const n = support(st, K) >= 3 ? 2 : 1;
    for (const id of ch[0]) E.place(st, K, id, n);
  },
  kunming_incident(st) { E.place(st, K, "kunming", 3); },
  // Up to 3 cities with room: each +1; then 民心 1 to the Communists, 美國支持 −1.
  takeover_officials(st, side, ch) {
    if (!ch.length) return pickN(K, 3, placeable(st, K, cities()), { side: K });
    for (const id of ch[0]) E.place(st, K, id, 1);
    E.vp(st, C, 1);
    E.moveSupport(st, K, -1);
  },
  // One city with blue: no 奇襲 and no 遊說 there this turn (`protect` bars both).
  japanese_garrisons(st, side, ch) {
    if (!ch.length) return pick(K, cities((s) => E.infOf(st, s.id)[K] > 0));
    const [id] = ch[0];
    if (id) E.addEffect(st, until("japanese_garrisons", K, { kind: "protect", space: id }));
  },
  sino_soviet_treaty(st) { E.moveSupport(st, C, -1); E.vp(st, K, 1); },
  // The box first (on turn 6 it sets off 行憲's 時局, after this event), then the two points.
  return_to_nanjing(st) {
    E.reformAdvance(st, K, 1);
    if (st.winner != null) return;
    E.place(st, K, "nanjing", 1);
    E.place(st, K, "shanghai", 1);
  },
  reorganisation_conference(st) { for (const id of CAPITALS) E.place(st, K, id, 1); },
  // A free 奇襲 on any space of the Northeast, the printed 3 ops +1.
  siping_taken(st, side, ch) { return freeCampaign(st, K, ch, spaces(inNE), CARD.siping_taken.ops + 1); },
  zhangjiakou_taken(st) { E.remove(st, C, "chasui", 2); E.place(st, K, "chasui", 2); },

  // ---------- 接收期・共軍 ----------
  // 3 points among the Northeast's villages, repeats allowed, as many as there is room for.
  into_manchuria(st, side, ch) {
    const options = placeable(st, C, spaces((s) => inNE(s) && s.kind === "village"));
    if (!ch.length) {
      const room = options.reduce((r, id) => r + E.capOf(st, id) - E.infOf(st, id)[C], 0);
      return { kind: "points", who: C, n: 3, min: Math.min(3, room), side: C, options };
    }
    for (const id of ch[0]) E.place(st, C, id, 1);
  },
  shangdang_campaign(st) { E.remove(st, K, "jinzhong", 2); E.place(st, C, "taihang", 1); },
  // 冀魯豫 or 冀中, blue or not: up to 2 blue off, then 1 red.
  gao_shuxun(st, side, ch) {
    if (!ch.length) return pick(C, ["jiluyu", "jizhong"]);
    const [id] = ch[0];
    if (id) { E.remove(st, K, id, 2); E.place(st, C, id, 1); }
  },
  soviet_arms(st) { E.moveSupport(st, C, 1); E.place(st, C, "beiman", 2); },
  may_fourth_directive(st) {
    E.reformAdvance(st, C, 1);
    E.addEffect(st, until("may_fourth_directive", C, { kind: "opsAll", target: C, delta: 1 }));
  },
  // `opsOf` keeps a card at 1 at least.
  arms_embargo(st) {
    E.moveSupport(st, K, -1);
    E.addEffect(st, until("arms_embargo", C, { kind: "opsAll", target: K, delta: -1 }));
  },

  // ---------- 接收期・中立 (`side` is the player) ----------
  chongqing_talks(st, side) { E.vp(st, side, 1); E.recover(st, 1); },
  january_truce(st, side) {
    E.recover(st, 2);
    E.addEffect(st, until("january_truce", side, { kind: "campaign", who: "both", delta: -1, regions: null }));
  },
  // The pairing is `play()`'s (engine.js, `MARSHALL`); alone, as an event, it does nothing.
  marshall_mission() { return null; },
  pcc_resolutions(st, side) { E.reformAdvance(st, side, 1); E.moveSupport(st, K, 1); },
  // Only 奇襲, only the cities: 遊說 and the villages go on (`campaignBan`).
  soviets_delay(st, side) { E.addEffect(st, until("soviets_delay", side, { kind: "campaignBan", region: "northeast", spaceKind: "city" })); },
  soviet_removals(st) {
    for (const id of cities(inNE)) { E.remove(st, C, id, 1); E.remove(st, K, id, 1); }
    E.moveSupport(st, C, -1);
  },
  // A region: in each of its cities that one side controls, that side −1 (never
  // below 1). A city nobody controls, and the villages, are left alone.
  inflation(st, side, ch) {
    if (!ch.length) return { kind: "option", who: side, options: SCORED_REGIONS.map((r) => ({ id: r, label: REGIONS[r].zh })) };
    for (const id of cities((s) => s.region === ch[0])) {
      const c = E.controller(st, id);
      if (c != null && E.infOf(st, id)[c] > 1) E.remove(st, c, id, 1);
    }
  },
  // The whole Northeast, cities and villages: no 奇襲 this turn.
  june_truce(st, side) {
    E.addEffect(st, until("june_truce", side, { kind: "campaignBan", region: "northeast", spaceKind: null }));
    E.recover(st, 1);
  },

  // ---------- 易勢期・國軍 (#7) ----------
  // A free 奇襲 on any space of the Northwest, 4 + 2, not locked by 民生 (only
  // that: protection and the event bans still hold). The attack comes first, so
  // 轉戰陝北 still takes its −2 from it; then 轉戰陝北 goes (`dropNorthernShaanxi`).
  hu_takes_yanan(st, side, ch) {
    const need = freeCampaign(st, K, ch, spaces((s) => s.region === "northwest"), CARD.hu_takes_yanan.ops + 2, { locks: false });
    if (need) return need;
    dropNorthernShaanxi(st);
  },
  // 魯中 red −2 first, then 濟南 or 徐州 (with room for blue) +2.
  shandong_offensive(st, side, ch) {
    if (!ch.length) {
      E.remove(st, C, "luzhong", 2);
      return pick(K, placeable(st, K, ["jinan", "xuzhou"]), { side: K });
    }
    const [id] = ch[0];
    if (id) E.place(st, K, id, 2);
  },
  mobilisation_order(st) { E.addEffect(st, until("mobilisation_order", K, { kind: "opsAll", target: K, delta: 1 })); },
  // Two cities with red (one if only one has any): each red −1; 民心 1 to the Communists; 美國支持 −1.
  league_banned(st, side, ch) {
    if (!ch.length) return pickN(K, 2, cities((s) => E.infOf(st, s.id)[C] > 0));
    for (const id of ch[0]) E.remove(st, C, id, 1);
    E.vp(st, C, 1);
    E.moveSupport(st, K, -1);
  },
  chen_cheng(st) { E.place(st, K, "shenyang", 2); E.place(st, K, "changchun", 1); },
  china_aid_act(st) { E.moveSupport(st, K, 1); E.draw(st, K, 1, { nonScoring: true }); },
  // The box first (on turn 6 it sets off 行憲's 時局, after this event), then 南京 is read.
  national_assembly(st) {
    E.reformAdvance(st, K, 1);
    if (st.winner != null) return;
    if (E.controller(st, "nanjing") === K) E.vp(st, K, 1);
  },
  // 美國支持 is read once, when the card is played (orchestrator 裁決 #7, 4).
  american_divisions(st) {
    if (support(st, K) < 2) return;
    E.addEffect(st, until("american_divisions", K, { kind: "campaign", who: K, delta: 1, regions: null }));
  },

  // ---------- 易勢期・共軍 (#7) ----------
  // Lasting until 胡宗南佔延安 removes it: the Nationalists −2 against the
  // Northwest's villages only. Played again it replaces itself, not stacks.
  northern_shaanxi(st) {
    E.removeEffect(st, (e) => e.card === "northern_shaanxi");
    E.addEffect(st, { card: "northern_shaanxi", side: C, kind: "campaign", who: K, delta: -2, regions: ["northwest"], spaceKind: "village", until: "game" });
  },
  // 魯中 or 淮海, blue or not: up to 3 blue off.
  menglianggu(st, side, ch) {
    if (!ch.length) return pick(C, ["luzhong", "huaihai"]);
    const [id] = ch[0];
    if (id) E.remove(st, K, id, 3);
  },
  // 大別山 +3; only if that turns it Communist (it was not before: 「因此」,
  // orchestrator 裁決 #7, 3), 武漢 or 鄭州 (with blue) blue −1.
  dabie_march(st, side, ch) {
    if (!ch.length) {
      const had = E.controller(st, "dabieshan") === C;
      E.place(st, C, "dabieshan", 3);
      if (had || E.controller(st, "dabieshan") !== C) return null;
      return pick(C, ["wuhan", "zhengzhou"].filter((id) => E.infOf(st, id)[K] > 0));
    }
    const [id] = ch[0];
    if (id) E.remove(st, K, id, 1);
  },
  // The box first, then two villages the Communists control (with room): each +1.
  land_law(st, side, ch) {
    if (!ch.length) {
      E.reformAdvance(st, C, 1);
      if (st.winner != null) return null;
      return pickN(C, 2, placeable(st, C, villages((s) => E.controller(st, s.id) === C)), { side: C });
    }
    for (const id of ch[0]) E.place(st, C, id, 1);
  },
  central_shanxi_campaign(st) { E.remove(st, K, "jinzhong", 3); E.place(st, C, "jinzhong", 1); },
  // A free 奇襲 on a village of the Northeast, the printed 3 ops +1; if that
  // turns it Communist (it was not before), a city next to it (with room) +1.
  winter_offensive(st, side, ch) {
    if (ch.length === 0) return pick(C, E.eventCampaignTargets(st, C, villages(inNE)));
    if (ch.length === 1) {
      const [t] = ch[0];
      if (!t) return null;
      const had = E.controller(st, t) === C;
      E.campaign(st, C, t, CARD.winter_offensive.ops + 1, { pusher: st.phasing });
      if (had || st.winner != null || E.controller(st, t) !== C) return null;
      return pick(C, placeable(st, C, E.adjOf(st, t).filter((a) => SPACE[a].kind === "city")), { side: C });
    }
    const [id] = ch[1];
    if (id) E.place(st, C, id, 1);
  },
  // The Communists see the Nationalists' hand for the rest of the turn (`view`).
  xiong_xianghui(st) { st.revealed[C] = true; },
  // Two of 北平、上海、南京 (with room), not bound by adjacency: each +1; 民心 1 to the Communists.
  may_twentieth(st, side, ch) {
    if (!ch.length) return pickN(C, 2, placeable(st, C, ["beiping", "shanghai", "nanjing"]), { side: C });
    for (const id of ch[0]) E.place(st, C, id, 1);
    E.vp(st, C, 1);
  },

  // ---------- 易勢期・中立 (#7; `side` is the player) ----------
  truman_doctrine(st) { E.moveSupport(st, K, 1); E.moveSupport(st, C, 1); },
  // 復員 (5) or 動盪 (4): 美國支持 +1; any lower: −1.
  wedemeyer_mission(st) { E.moveSupport(st, K, st.weariness >= 4 ? 1 : -1); },
  // Every village of 華東中原: each side −1 there. The cities and the other regions are not touched.
  yellow_river(st) {
    for (const id of villages((s) => s.region === "east")) { E.remove(st, C, id, 1); E.remove(st, K, id, 1); }
    E.recover(st, 1);
  },
  // Zongheng's 細作: the opponent's hand shown to the player (`showHand`), who
  // names one card; the opponent must play it on its next action round, any use
  // (`st.forced`, read through `E.forcedCard` by `legal` and `play`).
  sleeper(st, side, ch) {
    const h = st.hands[opp(side)];
    if (!ch.length) return { kind: "card", who: side, n: 1, min: h.length ? 1 : 0, options: h.slice(), showHand: true };
    if (ch[0][0]) st.forced[opp(side)] = ch[0][0];
  },
  // Zongheng's 徙民實邊: 4 of the player's own points off (no more from a space
  // than it has there), then as many back anywhere, at most 2 to a space, not
  // bound by adjacency, never into 受降's Northeast cities (`placeable`); with
  // less room than that, the room is filled and the rest vanishes.
  redeployment(st, side, ch) {
    if (ch.length === 0) {
      const mine = spaces((s) => E.infOf(st, s.id)[side] > 0);
      const k = Math.min(4, mine.reduce((n, id) => n + E.infOf(st, id)[side], 0));
      return { kind: "points", who: side, n: k, min: k, options: mine, maxOf: Object.fromEntries(mine.map((id) => [id, E.infOf(st, id)[side]])) };
    }
    if (ch.length === 1) {
      for (const id of ch[0]) E.remove(st, side, id, 1);
      const options = placeable(st, side, spaces(() => true));
      return { kind: "points", who: side, side, n: ch[0].length, min: Math.min(ch[0].length, roomIn(st, side, options, 2)), maxPer: 2, options };
    }
    for (const id of ch[1]) E.place(st, side, id, 1);
  },
  // Zongheng's 頓兵堅城: the opponent's next action round is a discard of a card
  // of 2+ printed ops, its event not set off, and then the effect is gone; with
  // no such card the round is a normal one and the effect waits (`legal`, `play`).
  stalled_siege(st, side) {
    E.removeEffect(st, (e) => e.kind === "bog" && e.who === opp(side));
    E.addEffect(st, { card: "stalled_siege", side, kind: "bog", who: opp(side), until: "game" });
  },

  // ---------- 決戰期・國軍 (#8) ----------
  // 民生 +2 and the Nationalists' cards +1 now; 民心 2 to the Communists at this
  // turn's 結算, once, before 「本回合的效果結束」 (`turnEndVp`, orchestrator 裁決 #8, 1).
  gold_yuan(st) {
    E.recover(st, 2);
    E.addEffect(st, until("gold_yuan", K, { kind: "opsAll", target: K, delta: 1 }));
    E.addEffect(st, until("gold_yuan", K, { kind: "turnEndVp", to: C, n: 2 }));
  },
  // Lasting (the card leaves the game, the effect stays): the Communists −1
  // against the cities of 華北 only (天津、北平、太原). 傅冬菊 may lift it.
  fu_holds_the_north(st) {
    E.addEffect(st, { card: "fu_holds_the_north", side: K, kind: "campaign", who: C, delta: -1, regions: ["north"], spaceKind: "city", until: "game" });
  },
  // 美國支持 0 when played: nothing at all. Else no 孤城 loses blue at this turn's
  // 結算 (`noAttrition`; turn 7's 2 included), then one 孤城 with room for blue +2.
  airlift_to_cut_off_city(st, side, ch) {
    if (!ch.length) {
      if (support(st, K) === 0) return null;
      E.addEffect(st, until("airlift_to_cut_off_city", K, { kind: "noAttrition" }));
      return pick(K, placeable(st, K, E.isolatedCities(st)), { side: K });
    }
    const [id] = ch[0];
    if (id) E.place(st, K, id, 2);
  },
  // 桂林、武漢 +2 each, then the Nationalists discard 1 card that is not a
  // scoring card, its event not set off (orchestrator 裁決 #8, 4); none such, no discard.
  chiang_steps_down(st, side, ch) {
    if (!ch.length) {
      E.place(st, K, "guilin", 2);
      E.place(st, K, "wuhan", 2);
      const options = st.hands[K].filter((c) => !CARD[c].scoring);
      return { kind: "card", who: K, n: 1, min: options.length ? 1 : 0, options };
    }
    const [c] = ch[0];
    if (c) E.discardCard(st, K, c, { noEvent: true });
  },
  guningtou(st) {
    for (const id of cities((s) => s.region === "rear")) E.remove(st, C, id, 1);
    E.recover(st, 1);
  },

  // ---------- 決戰期・共軍 (#8) ----------
  // Every space of the Northeast, cities and villages: blue −2 (down to 0).
  liaoshen_campaign(st) { for (const id of spaces(inNE)) E.remove(st, K, id, 2); },
  // A 奇襲 on any space of 華東中原, 4 + 2, over the ordinary target list (#6, 4).
  huaihai_campaign(st, side, ch) { return freeCampaign(st, C, ch, spaces((s) => s.region === "east"), CARD.huaihai_campaign.ops + 2); },
  // 天津, no choice: 3 + 2 if the Communists could 奇襲 it but for 美軍駐華 (only
  // that is lifted: 民生's locks and protection still hold); else no 奇襲. Then,
  // whether or not it was made, 北平 a 孤城: its blue −2 (orchestrator 裁決 #8, 6).
  pingjin_campaign(st) {
    if (E.canCampaign(st, C, "tianjin", { garrison: false })) E.campaign(st, C, "tianjin", CARD.pingjin_campaign.ops + 2, { pusher: st.phasing });
    if (st.winner != null) return;
    if (E.isolatedCities(st).includes("beiping")) E.remove(st, K, "beiping", 2);
  },
  // The Communists choose: one card whose effects in play are the Nationalists'
  // (all its Nationalist effects go), or 北平 (blue −2) (orchestrator 裁決 #8, 7).
  fu_dongju(st, side, ch) {
    if (!ch.length) return { kind: "option", who: C, options: [...kmtEffects(st).map((id) => ({ id, label: CARD[id].zh })), { id: "beiping", label: SPACE.beiping.zh }] };
    if (ch[0] === "beiping") E.remove(st, K, "beiping", 2);
    else E.removeEffect(st, (e) => e.card === ch[0] && e.side === K && e.kind !== "turnEndVp");
  },
  // 長春 a 孤城: all its blue off, 2 red in, 民心 2 to the Nationalists; else blue −1.
  siege_of_changchun(st) {
    if (E.isolatedCities(st).includes("changchun")) {
      E.remove(st, K, "changchun", E.infOf(st, "changchun")[K]);
      E.place(st, C, "changchun", 2);
      E.vp(st, K, 2);
    } else E.remove(st, K, "changchun", 1);
  },
  jiawang_defection(st) {
    E.remove(st, K, "xuzhou", 2);
    if (E.controller(st, "huaihai") === C) E.remove(st, K, "xuzhou", 1);
  },
  // A 奇襲 on any city of 後方, 4 + 2, over the ordinary target list (民生's lock
  // of the Nationalists' home and 美軍駐華 included).
  yangtze_crossing(st, side, ch) { return freeCampaign(st, C, ch, cities((s) => s.region === "rear"), CARD.yangtze_crossing.ops + 2); },
  new_consultative_conference(st) {
    if (E.controller(st, "beiping") === C) E.vp(st, C, 3);
    E.moveSupport(st, C, 1);
  },
  // One 孤城: up to 3 blue off.
  peaceful_changeover(st, side, ch) {
    if (!ch.length) return pick(C, E.isolatedCities(st));
    const [id] = ch[0];
    if (id) E.remove(st, K, id, 3);
  },

  // ---------- 決戰期・中立 (#8; `side` is the player) ----------
  beiping_talks(st, side) {
    E.recover(st, 2);
    E.addEffect(st, until("beiping_talks", side, { kind: "campaign", who: "both", delta: -1, regions: null }));
  },
  // Only while the Communists control no city of 後方: this turn they may not
  // 奇襲 a city of 後方 (the Nationalists may; `campaignBan` with `who`), and
  // 蘇聯支持 +1. Else nothing at all (orchestrator 裁決 #8, 8).
  stalins_advice(st, side) {
    if (cities((s) => s.region === "rear").some((id) => E.controller(st, id) === C)) return;
    E.addEffect(st, until("stalins_advice", side, { kind: "campaignBan", region: "rear", spaceKind: "city", who: C }));
    E.moveSupport(st, C, 1);
  },
  amethyst_incident(st, side) { E.vp(st, side, 1); E.moveSupport(st, K, -1); },
  // Zongheng's 奪將: the opponent's card of the most printed ops (the first in
  // hand order on a tie; none if that is 0, i.e. only scoring cards) to the
  // player's hand, and this card to the opponent's hand, not to a pile.
  defection_at_the_front(st, side) {
    const h = st.hands[opp(side)];
    if (h.length) {
      const top = h.reduce((a, b) => (CARD[b].ops > CARD[a].ops ? b : a));
      if (CARD[top].ops > 0) { h.splice(h.indexOf(top), 1); st.hands[side].push(top); }
    }
    h.push("defection_at_the_front");
  },
  // Zongheng's 逐客令: the opponent's cards −1 this turn (`opsOf` keeps a card at 1).
  supplies_run_short(st, side) { E.addEffect(st, until("supplies_run_short", side, { kind: "opsAll", target: opp(side), delta: -1 })); },
  // A free 奇襲 on any village, the printed 2 ops, over the ordinary target list.
  clearing_the_outskirts(st, side, ch) { return freeCampaign(st, side, ch, villages(), CARD.clearing_the_outskirts.ops); },
  // Zongheng's 天狗食日: a random card of the opponent's, not a scoring card. The
  // player's own side's card: its event goes off now, resolved for the player
  // (a `*` card then leaves the game); any other: into the discard pile.
  ta_kung_pao(st, side) {
    const c = randomEnemyCard(st, side);
    if (!c) return;
    if (CARD[c].side === side) {
      const h = st.hands[opp(side)];
      h.splice(h.indexOf(c), 1);
      E.log(st, { type: "discard", side: opp(side), card: c, noEvent: false });
      st.plan.splice(1, 0, { do: "event", card: c, side, by: st.phasing, choices: [] }, { do: "finishCard", card: c, side, triggered: true });
    } else E.discardCard(st, opp(side), c, { noEvent: true });
  },
};

export const CARDS = [
  // The three fronts of 1946 score in the first era; the Northwest and the Rear from the second.
  scoring("score_north", 1, "華北記分", "North China scoring", "north", "takeover"),
  scoring("score_east", 2, "華東中原記分", "East and Central China scoring", "east", "takeover"),
  scoring("score_northeast", 3, "東北記分", "Northeast scoring", "northeast", "takeover"),
  scoring("score_northwest", 4, "西北記分", "Northwest scoring", "northwest", "turning"),
  scoring("score_rear", 5, "後方記分", "Rear scoring", "rear", "turning"),

  // ---------- 接收期・國軍 (10) ----------
  card("surrender_order", 6, "受降令", "The Surrender Order", "takeover", K, 3, true, 1945, "國軍在最多 3 座沒有紅的城各放 1(東北除外)。"),
  card("airlift", 7, "美軍空運", "The American Airlift", "takeover", K, 3, true, 1945, "國軍在任兩座城各放 2,不受相鄰限制;美國支持 < 3 時改成各放 1。"),
  card("kunming_incident", 8, "昆明事變", "The Kunming Incident", "takeover", K, 2, true, 1945, "國軍在昆明放 3。"),
  card("takeover_officials", 9, "接收大員", "The Takeover Officials", "takeover", K, 2, false, 1945, "國軍在最多 3 座城各放 1;民心往共軍移 1;美國支持 −1。"),
  card("japanese_garrisons", 10, "日軍留守", "Japanese Garrisons Stay", "takeover", K, 1, true, 1945, "指定一座有藍的城,本回合不可被奇襲或遊說。"),
  card("sino_soviet_treaty", 11, "中蘇友好同盟條約", "The Sino-Soviet Treaty", "takeover", K, 2, true, 1945, "蘇聯支持 −1;民心往國軍移 1。"),
  card("return_to_nanjing", 12, "還都南京", "Return to Nanjing", "takeover", K, 2, true, 1946, "行憲軌前進 1;國軍在南京、上海各放 1。"),
  card("reorganisation_conference", 13, "軍事整編會議", "The Army Reorganisation Conference", "takeover", K, 4, true, 1946, "國軍在五個本據各放 1,不受相鄰限制。"),
  card("siping_taken", 14, "四平攻克", "Siping Taken", "takeover", K, 3, true, 1946, "國軍對東北任一據點免費奇襲,行動點 +1。"),
  card("zhangjiakou_taken", 15, "佔領張家口", "Zhangjiakou Taken", "takeover", K, 3, true, 1946, "移除察綏的紅 2;國軍在察綏放 2。"),

  // ---------- 接收期・共軍 (6) ----------
  card("into_manchuria", 16, "闖關東", "Into Manchuria", "takeover", C, 3, true, 1945, "共軍在東北的鄉放 3(可分散),不受相鄰限制。"),
  card("shangdang_campaign", 17, "上黨戰役", "The Shangdang Campaign", "takeover", C, 2, true, 1945, "移除晉中的藍 2;共軍在太行放 1。"),
  card("gao_shuxun", 18, "高樹勛起義", "Gao Shuxun Defects", "takeover", C, 2, true, 1945, "移除冀魯豫或冀中的全部藍(至多 2);共軍在那裡放 1。"),
  card("soviet_arms", 19, "蘇軍移交裝備", "Soviet Arms Handed Over", "takeover", C, 3, true, 1946, "蘇聯支持 +1;共軍在北滿放 2。"),
  card("may_fourth_directive", 20, "五四指示", "The May Fourth Directive", "takeover", C, 3, true, 1946, "建軍軌前進 1;本回合共軍所有牌行動點 +1。"),
  card("arms_embargo", 21, "美國武器禁運", "The American Arms Embargo", "takeover", C, 3, true, 1946, "美國支持 −1;持續至回合結束:國軍所有牌行動點 −1(最低 1)。"),

  // ---------- 接收期・中立 (8) ----------
  card("chongqing_talks", 22, "重慶談判", "The Chongqing Talks", "takeover", N, 2, true, 1945, "打出者民心 +1;民生回復 1。"),
  card("january_truce", 23, "一月停戰令", "The January Truce", "takeover", N, 3, true, 1946, "民生回復 2;持續至回合結束:雙方奇襲 −1。"),
  card("marshall_mission", 24, "馬歇爾調處", "The Marshall Mission", "takeover", N, 1, false, 1946, "與手中另一張對手陣營的牌同時打出(共占一個行動回合):那張牌事件不觸發,用它的行動點。美國支持是 0 時本牌只能當 1 點用。"),
  card("pcc_resolutions", 25, "政協決議", "The PCC Resolutions", "takeover", N, 2, true, 1946, "打出者變法軌前進 1;美國支持 +1。"),
  card("soviets_delay", 26, "蘇軍延期撤兵", "The Soviets Delay Their Withdrawal", "takeover", N, 2, false, 1946, "持續至回合結束:東北的城不可被奇襲。"),
  card("soviet_removals", 27, "蘇軍拆運", "Soviet Removals", "takeover", N, 2, true, 1946, "東北每座城雙方各移除 1;蘇聯支持 −1。"),
  card("inflation", 28, "通貨膨脹", "Inflation", "takeover", N, 2, false, null, "選一區,雙方各在自己控制的每座城移除 1(最少留 1)。"),
  card("june_truce", 29, "六月東北停戰", "The June Truce in Manchuria", "takeover", N, 2, true, 1946, "本回合東北不可奇襲;民生回復 1。"),

  // ---------- 易勢期・國軍 (8) ----------
  card("hu_takes_yanan", 30, "胡宗南佔延安", "Hu Zongnan Takes Yan'an", "turning", K, 4, true, 1947, "國軍對西北任一據點免費奇襲,行動點 +2,不受封鎖;移除「轉戰陝北」。"),
  card("shandong_offensive", 31, "重點進攻山東", "The Shandong Offensive", "turning", K, 3, true, 1947, "移除魯中的紅 2;國軍在濟南或徐州放 2。"),
  card("mobilisation_order", 32, "戡亂動員令", "The Mobilisation Order", "turning", K, 2, true, 1947, "持續至回合結束:國軍所有牌行動點 +1。"),
  card("league_banned", 33, "取締民盟", "The Democratic League Banned", "turning", K, 2, true, 1947, "移除任兩座城的紅各 1;民心往共軍移 1;美國支持 −1。"),
  card("chen_cheng", 34, "陳誠主東北", "Chen Cheng in Manchuria", "turning", K, 2, true, 1947, "國軍在瀋陽放 2、長春放 1。"),
  card("china_aid_act", 35, "援華法案", "The China Aid Act", "turning", K, 3, true, 1948, "美國支持 +1;國軍抽 1 張。"),
  card("national_assembly", 36, "行憲國大", "The National Assembly", "turning", K, 2, true, 1948, "行憲軌前進 1;國軍控制南京的話民心 +1。"),
  card("american_divisions", 37, "美械整編師", "American-Equipped Divisions", "turning", K, 3, false, null, "持續至回合結束:國軍奇襲行動點 +1。美國支持 < 2 時無效。"),

  // ---------- 易勢期・共軍 (8) ----------
  card("northern_shaanxi", 38, "轉戰陝北", "The Fighting Retreat in Northern Shaanxi", "turning", C, 2, false, 1947, "持續:國軍對西北的鄉奇襲行動點 −2。「胡宗南佔延安」觸發時移除。"),
  card("menglianggu", 39, "孟良崮", "Menglianggu", "turning", C, 3, true, 1947, "移除魯中或淮海的全部藍(至多 3)。"),
  card("dabie_march", 40, "挺進大別山", "The March to the Dabie Mountains", "turning", C, 3, true, 1947, "共軍在大別山放 3;若因此控制大別山,移除武漢或鄭州的藍 1。"),
  card("land_law", 41, "土地法大綱", "The Outline Land Law", "turning", C, 2, true, 1947, "建軍軌前進 1;共軍在任兩個自己控制的鄉各放 1。"),
  card("central_shanxi_campaign", 42, "晉中戰役", "The Central Shanxi Campaign", "turning", C, 3, true, 1948, "移除晉中的全部藍(至多 3);共軍在晉中放 1。"),
  card("winter_offensive", 43, "東北冬季攻勢", "The Winter Offensive in Manchuria", "turning", C, 3, true, 1947, "共軍對東北任一個鄉免費奇襲,行動點 +1;若因此控制它,在相鄰的一座城放 1。"),
  card("xiong_xianghui", 44, "熊向暉", "Xiong Xianghui", "turning", C, 1, true, 1947, "查看國軍手牌。"),
  card("may_twentieth", 45, "五二〇學潮", "The May Twentieth Protests", "turning", C, 2, true, 1947, "共軍在北平、上海、南京之中任兩座各放 1;民心往共軍移 1。"),

  // ---------- 易勢期・中立 (6) ----------
  card("truman_doctrine", 46, "杜魯門主義", "The Truman Doctrine", "turning", N, 2, true, 1947, "美國支持 +1;蘇聯支持 +1。"),
  card("wedemeyer_mission", 47, "魏德邁調查團", "The Wedemeyer Mission", "turning", N, 2, true, 1947, "民生在復員或動盪的話美國支持 +1;否則美國支持 −1。"),
  card("yellow_river", 48, "黃河歸故", "The Yellow River Returned", "turning", N, 2, true, 1947, "華東中原每個鄉雙方各移除 1;民生回復 1。"),
  card("sleeper", 49, "潛伏", "The Sleeper", "turning", N, 1, false, null, "對手展示手牌;打出者指定 1 張,對手下一個行動回合必須打出,用法自選。"),
  card("redeployment", 50, "戰略機動", "Redeployment", "turning", N, 3, false, null, "打出者移除自己 4 點,重新分配到任意據點,每處最多 2 點,不受相鄰限制。"),
  card("stalled_siege", 51, "久攻不下", "A Stalled Siege", "turning", N, 3, false, null, "持續:對手下一個行動回合開始時須棄 1 張行動點 ≥ 2 的牌作為該次行動,然後解除。"),

  // ---------- 決戰期・國軍 (5) ----------
  card("gold_yuan", 52, "金圓券", "The Gold Yuan", "decisive", K, 2, true, 1948, "民生回復 2;本回合國軍所有牌行動點 +1;回合結算時民心往共軍移 2。"),
  card("fu_holds_the_north", 53, "傅作義守華北", "Fu Zuoyi Holds the North", "decisive", K, 3, true, 1948, "持續:共軍對華北的城奇襲行動點 −1。可被「傅冬菊」移除。"),
  card("airlift_to_cut_off_city", 54, "空運孤城", "Airlift to a Cut-off City", "decisive", K, 2, false, 1948, "本回合孤城結算時不掉點;國軍在一座孤城放 2。美國支持是 0 時無效。"),
  card("chiang_steps_down", 55, "蔣下野", "Chiang Steps Down", "decisive", K, 2, true, 1949, "國軍在桂林、武漢各放 2;國軍棄 1 張手牌(事件不觸發)。"),
  card("guningtou", 56, "古寧頭", "Guningtou", "decisive", K, 2, true, 1949, "移除後方每座城的紅各 1;民生回復 1。"),

  // ---------- 決戰期・共軍 (9) ----------
  card("liaoshen_campaign", 57, "遼瀋戰役", "The Liaoshen Campaign", "decisive", C, 4, true, 1948, "移除東北每個據點的藍各 2。"),
  card("huaihai_campaign", 58, "淮海戰役", "The Huaihai Campaign", "decisive", C, 4, true, 1948, "共軍對華東中原任一據點奇襲,行動點 4 +2。"),
  card("pingjin_campaign", 59, "平津戰役", "The Pingjin Campaign", "decisive", C, 3, true, 1948, "共軍對天津奇襲,行動點 3 +2,不受美軍駐華限制;之後北平是孤城的話,移除北平的藍 2。"),
  card("fu_dongju", 60, "傅冬菊", "Fu Dongju", "decisive", C, 2, true, 1948, "移除國軍一個持續效果;或移除北平的藍 2。"),
  card("siege_of_changchun", 61, "長春圍城", "The Siege of Changchun", "decisive", C, 2, true, 1948, "長春是孤城的話,移除長春的全部藍,共軍放 2,民心往國軍移 2;否則移除長春的藍 1。"),
  card("jiawang_defection", 62, "賈汪起義", "The Jiawang Defection", "decisive", C, 2, true, 1948, "移除徐州的藍 2;淮海在共軍控制下的話再移除 1。"),
  card("yangtze_crossing", 63, "渡江戰役", "The Yangtze Crossing", "decisive", C, 4, true, 1949, "共軍對後方任一座城奇襲,行動點 4 +2。"),
  card("new_consultative_conference", 64, "新政協", "The New Consultative Conference", "decisive", C, 2, true, 1949, "共軍控制北平的話民心 +3;蘇聯支持 +1。"),
  card("peaceful_changeover", 65, "和平起義", "A Peaceful Changeover", "decisive", C, 2, false, 1949, "選一座孤城,移除那裡的全部藍(至多 3)。"),

  // ---------- 決戰期・中立 (7) ----------
  card("beiping_talks", 66, "北平和談", "The Beiping Talks", "decisive", N, 3, true, 1949, "民生回復 2;持續至回合結束:雙方奇襲 −1。"),
  card("stalins_advice", 67, "史達林的建議", "Stalin's Advice", "decisive", N, 2, true, 1949, "共軍還沒控制任何後方的城的話:本回合共軍不可奇襲後方的城,蘇聯支持 +1。(史實有爭議)"),
  card("amethyst_incident", 68, "紫石英號事件", "The Amethyst Incident", "decisive", N, 2, true, 1949, "打出者民心 +1;美國支持 −1。"),
  card("defection_at_the_front", 69, "陣前倒戈", "Defection at the Front", "decisive", N, 2, false, null, "取走對手手中行動點最高的牌,並將本牌交給對手。"),
  card("supplies_run_short", 70, "補給不繼", "Supplies Run Short", "decisive", N, 3, false, null, "持續至回合結束:對手所有牌行動點 −1(最低 1)。"),
  card("clearing_the_outskirts", 71, "掃清外圍", "Clearing the Outskirts", "decisive", N, 2, false, null, "打出者對任一個鄉免費奇襲。"),
  card("ta_kung_pao", 72, "大公報社評", "A Ta Kung Pao Editorial", "decisive", N, 1, false, null, "對手隨機棄 1 張牌(記分卡除外);若是打出者陣營的事件,該事件觸發。"),
];

export const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const ERA_DECKS = {
  takeover: CARDS.filter((c) => c.era === "takeover").map((c) => c.id),
  turning: CARDS.filter((c) => c.era === "turning").map((c) => c.id),
  decisive: CARDS.filter((c) => c.era === "decisive").map((c) => c.id),
};
