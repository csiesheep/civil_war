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
// The cards of the other two eras still carry `todo: true` and an `effect` that
// throws, loudly, so that a game which reaches one stops instead of quietly
// doing nothing.
import * as E from "./engine.js";
import { SPACES, STATES, REGIONS, SCORED_REGIONS } from "./board.js";

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
