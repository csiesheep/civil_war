// The map: 29 spaces in 5 scoring regions, each a city or a village, and the
// second layer of five regional powers with their seats (used by 易幟 and 整編).
// Pure data, straight from the rulebook (Projects/civil_war/civil_war -
// rulebook.md, section 二). `adj` is symmetric; tests/acceptance.js checks it.
//
// The seats: 0 = CCP (the Communists, moves first), 1 = KMT (the Nationalists,
// wins ties). `home` names the side whose home region it is.
// `front`: the main front, the second thing 民生 locks (rulebook 三, 民生軌).

export const REGIONS = {
  northeast: { zh: "東北",     en: "the Northeast",          home: null,  front: false, presence: 3, domination: 6, control: 8 },
  north:     { zh: "華北",     en: "North China",            home: null,  front: true,  presence: 4, domination: 8, control: 10 },
  east:      { zh: "華東中原", en: "East and Central China", home: null,  front: false, presence: 4, domination: 8, control: 10 },
  northwest: { zh: "西北",     en: "the Northwest",          home: "ccp", front: false, presence: 2, domination: 3, control: 4 },
  rear:      { zh: "後方",     en: "the Rear",               home: "kmt", front: false, presence: 1, domination: 2, control: 3 },
};
export const SCORED_REGIONS = ["north", "east", "northeast", "northwest", "rear"];

// The five regional powers. 易幟 pays the Communists `vp` once per power;
// 整編 pays the Nationalists 1 once per power. `capital` is the power's seat (本據).
export const STATES = {
  sui:  { zh: "綏", en: "Sui (Fu Zuoyi)",                  capital: "chasui",  vp: 3 },
  jin:  { zh: "晉", en: "Jin (Yan Xishan)",                capital: "taiyuan", vp: 2 },
  gui:  { zh: "桂", en: "Gui (Li Zongren, Bai Chongxi)",   capital: "guilin",  vp: 3 },
  ma:   { zh: "馬", en: "Ma (Ma Bufang, Ma Hongkui)",      capital: "lanzhou", vp: 2 },
  dian: { zh: "滇", en: "Dian (Long Yun, Lu Han)",         capital: "kunming", vp: 2 },
};
export const MIE_TO_WIN = 3;   // powers 易幟 at once for the Communist instant win
export const SEALS_TO_WIN = 5; // 整編 held at once for the Nationalist instant win

// `kind`: "city" or "village". `battleground`: a city's ★ (要衝): attacking it
// pushes 民生, and 民生 locks it first. `base`: a Communist base area (根據地),
// which also counts as a 要衝 when a region scores. `port`: a Nationalist
// supply source while the Nationalists control it.
export const SPACES = [
  // 東北: empty at the start, the Soviets hold it
  { id: "beiman",    zh: "北滿",   en: "North Manchuria",   kind: "village", region: "northeast", state: null,   stability: 3, battleground: false, base: true,  port: false, adj: ["changchun", "siping"] },
  { id: "changchun", zh: "長春",   en: "Changchun",         kind: "city",    region: "northeast", state: null,   stability: 2, battleground: false, base: false, port: false, adj: ["beiman", "siping"] },
  { id: "siping",    zh: "四平",   en: "Siping",            kind: "village", region: "northeast", state: null,   stability: 2, battleground: false, base: false, port: false, adj: ["beiman", "changchun", "shenyang"] },
  { id: "shenyang",  zh: "瀋陽",   en: "Shenyang",          kind: "city",    region: "northeast", state: null,   stability: 3, battleground: true,  base: false, port: false, adj: ["siping", "liaoxi"] },
  { id: "liaoxi",    zh: "遼西",   en: "the Liaoxi Corridor", kind: "village", region: "northeast", state: null, stability: 2, battleground: false, base: false, port: false, adj: ["shenyang", "jinzhou"] },
  { id: "jinzhou",   zh: "錦州",   en: "Jinzhou",           kind: "city",    region: "northeast", state: null,   stability: 3, battleground: true,  base: false, port: true,  adj: ["liaoxi", "tianjin"] },
  // 華北: the main front
  { id: "tianjin",   zh: "天津",   en: "Tianjin",           kind: "city",    region: "north",     state: null,   stability: 3, battleground: true,  base: false, port: true,  adj: ["jinzhou", "beiping", "jizhong"] },
  { id: "beiping",   zh: "北平",   en: "Beiping",           kind: "city",    region: "north",     state: "sui",  stability: 3, battleground: true,  base: false, port: false, adj: ["tianjin", "jizhong", "chasui"] },
  { id: "jizhong",   zh: "冀中",   en: "Central Hebei",     kind: "village", region: "north",     state: null,   stability: 2, battleground: false, base: false, port: false, adj: ["beiping", "tianjin", "taihang", "jiluyu"] },
  { id: "chasui",    zh: "察綏",   en: "Chahar-Suiyuan",    kind: "village", region: "north",     state: "sui",  stability: 2, battleground: false, base: false, port: false, adj: ["beiping", "jinzhong"] },
  { id: "taihang",   zh: "太行",   en: "the Taihang",       kind: "village", region: "north",     state: null,   stability: 3, battleground: false, base: true,  port: false, adj: ["jizhong", "taiyuan", "jinzhong", "jiluyu"] },
  { id: "taiyuan",   zh: "太原",   en: "Taiyuan",           kind: "city",    region: "north",     state: "jin",  stability: 3, battleground: false, base: false, port: false, adj: ["taihang", "jinzhong"] },
  { id: "jinzhong",  zh: "晉中",   en: "Central Shanxi",    kind: "village", region: "north",     state: "jin",  stability: 2, battleground: false, base: false, port: false, adj: ["taiyuan", "taihang", "chasui", "xian", "shanbei"] },
  // 華東中原
  { id: "jiluyu",    zh: "冀魯豫", en: "Hebei-Shandong-Henan", kind: "village", region: "east",   state: null,   stability: 3, battleground: false, base: true,  port: false, adj: ["jizhong", "taihang", "jinan", "zhengzhou"] },
  { id: "jinan",     zh: "濟南",   en: "Jinan",             kind: "city",    region: "east",      state: null,   stability: 3, battleground: true,  base: false, port: false, adj: ["jiluyu", "luzhong"] },
  { id: "luzhong",   zh: "魯中",   en: "Central Shandong",  kind: "village", region: "east",      state: null,   stability: 3, battleground: false, base: true,  port: false, adj: ["jinan", "xuzhou", "huaihai"] },
  { id: "xuzhou",    zh: "徐州",   en: "Xuzhou",            kind: "city",    region: "east",      state: null,   stability: 3, battleground: true,  base: false, port: false, adj: ["luzhong", "huaihai"] },
  { id: "huaihai",   zh: "淮海",   en: "Huaihai",           kind: "village", region: "east",      state: null,   stability: 2, battleground: false, base: false, port: false, adj: ["xuzhou", "nanjing", "zhengzhou", "luzhong", "dabieshan"] },
  { id: "zhengzhou", zh: "鄭州",   en: "Zhengzhou",         kind: "city",    region: "east",      state: null,   stability: 2, battleground: false, base: false, port: false, adj: ["jiluyu", "huaihai", "dabieshan", "xian"] },
  { id: "dabieshan", zh: "大別山", en: "the Dabie Mountains", kind: "village", region: "east",    state: null,   stability: 2, battleground: false, base: false, port: false, adj: ["zhengzhou", "wuhan", "huaihai"] },
  // 西北: the Communists' home
  { id: "shanbei",   zh: "陝北",   en: "Northern Shaanxi",  kind: "village", region: "northwest", state: null,   stability: 4, battleground: false, base: true,  port: false, adj: ["xian", "jinzhong"] },
  { id: "xian",      zh: "西安",   en: "Xi'an",             kind: "city",    region: "northwest", state: null,   stability: 3, battleground: true,  base: false, port: false, adj: ["zhengzhou", "jinzhong", "shanbei", "lanzhou"] },
  { id: "lanzhou",   zh: "蘭州",   en: "Lanzhou",           kind: "city",    region: "northwest", state: "ma",   stability: 3, battleground: false, base: false, port: false, adj: ["xian"] },
  // 後方: the Nationalists' home
  { id: "wuhan",     zh: "武漢",   en: "Wuhan",             kind: "city",    region: "rear",      state: "gui",  stability: 2, battleground: false, base: false, port: false, adj: ["dabieshan", "nanjing", "guangzhou", "guilin"] },
  { id: "nanjing",   zh: "南京",   en: "Nanjing",           kind: "city",    region: "rear",      state: null,   stability: 4, battleground: true,  base: false, port: false, adj: ["huaihai", "shanghai", "wuhan"] },
  { id: "shanghai",  zh: "上海",   en: "Shanghai",          kind: "city",    region: "rear",      state: null,   stability: 3, battleground: true,  base: false, port: true,  adj: ["nanjing", "guangzhou"] },
  { id: "guangzhou", zh: "廣州",   en: "Guangzhou",         kind: "city",    region: "rear",      state: null,   stability: 2, battleground: false, base: false, port: true,  adj: ["wuhan", "shanghai", "guilin"] },
  { id: "guilin",    zh: "桂林",   en: "Guilin",            kind: "city",    region: "rear",      state: "gui",  stability: 3, battleground: false, base: false, port: false, adj: ["wuhan", "guangzhou", "kunming"] },
  { id: "kunming",   zh: "昆明",   en: "Kunming",           kind: "city",    region: "rear",      state: "dian", stability: 3, battleground: false, base: false, port: false, adj: ["guilin"] },
];

export const SPACE = Object.fromEntries(SPACES.map((s) => [s.id, s]));
export const BATTLEGROUNDS = SPACES.filter((s) => s.battleground).map((s) => s.id);
export const CAP_OVER_STABILITY = 2; // influence cap = stability + 2

export function spacesOf(region) { return SPACES.filter((s) => s.region === region).map((s) => s.id); }
export function spacesOfState(state) { return SPACES.filter((s) => s.state === state).map((s) => s.id); }
export function cap(id) { return SPACE[id].stability + CAP_OVER_STABILITY; }

// Each side's capital, and where it moves the first time it falls (遷都).
// Indexed by seat: [CCP, KMT].
export const HOME_REGION = ["northwest", "rear"];
export const HOME_CAPITAL = ["shanbei", "nanjing"];
export const MOVED_CAPITAL = ["taihang", "guangzhou"];

// Setup from the rulebook: the points on the map in August 1945, then the free
// placement of turn 1's 時局 (受降): the Communists 3 points in villages, the
// Nationalists 4 points (the American support level at the start) in cities
// outside the Northeast. Neither is bound by adjacency.
// `freeHeld` and `freeAlso` (#24, owner 裁決 #24, 2026-10-04: 「共軍的免費放置只能
// 放進自己控制的鄉,以及察綏(1945 年 8 月晉察冀佔張家口)」): of `freeIn`, only the
// spaces that side controls at the moment it is asked, before its first point
// goes down, and the spaces of `freeAlso` whoever controls them (engine.js, the
// `setup` step). On this table that is 冀中, 察綏, 太行, 冀魯豫 and 陝北 (察綏
// is red 2 blue 2): the five villages #23's P10 was measured with.
export const SETUP = {
  ccp: {
    fixed: { beiman: 1, jizhong: 2, chasui: 2, taihang: 4, jinzhong: 1, jiluyu: 3, luzhong: 3, huaihai: 2, dabieshan: 2, shanbei: 4 },
    free: 3,
    freeIn: SPACES.filter((s) => s.kind === "village").map((s) => s.id),
    freeHeld: true,
    freeAlso: ["chasui"],
  },
  kmt: {
    fixed: {
      tianjin: 3, beiping: 3, chasui: 2, taiyuan: 2, jinzhong: 2, jinan: 2, luzhong: 2, xuzhou: 3, huaihai: 1, zhengzhou: 2,
      dabieshan: 2, xian: 4, lanzhou: 2, wuhan: 3, nanjing: 4, shanghai: 3, guangzhou: 2, guilin: 2, kunming: 2,
    },
    free: 4,
    freeIn: SPACES.filter((s) => s.kind === "city" && s.region !== "northeast").map((s) => s.id),
  },
};
