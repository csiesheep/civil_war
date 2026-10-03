// #23: the variants tried while tuning the rules. A variant is a named options object for the
// engine (public/shared/engine.js, the #23 tuning options, none of them a key of DEFAULT_OPTIONS);
// tests/sim.js --variant=<name> plays it, with a cell's own switches laid over it.
//
// Names: `base` (today's rules), `X-…` (absurd, to show the pipe is alive), `L-…` (one lever),
// `C…` (combinations), `P` (the proposal), `P-no-…` (the proposal less one item).
// `what` is the change as a rulebook would say it; `why` its history, in one sentence.
import { SPACES, SETUP, cap } from "../../public/shared/board.js";

const villages = SPACES.filter((s) => s.kind === "village").map((s) => s.id);
const BASES = SPACES.filter((s) => s.base).map((s) => s.id);
const SEATS = ["taiyuan", "lanzhou", "guilin", "kunming"]; // the cities among the five 本據 (察綏 is a village)
const plus = (side, ids, n) => Object.fromEntries(ids.map((id) => [id, Math.min(cap(id), (SETUP[side].fixed[id] || 0) + n)]));

export const VARIANTS = {
  base: { what: "今天的規則", why: "", options: {} },

  // ---- 證偽:荒謬變體(第四節 2)
  "X-ccp+5": {
    what: "共軍開局每個鄉 +5(不超過上限);鄉都滿了,所以共軍沒有免費放置",
    why: "荒謬,只為了證明變體的數字真的到了盤面上",
    options: { setupPoints: { ccp: plus("ccp", villages, 5) }, setupFree: [0, 4] },
  },

  // ---- 單一槓桿的篩選
  "L-seatbar": {
    what: "受降:國軍的免費放置不能放進五家的本據(太原、蘭州、桂林、昆明)",
    why: "1945 年各地方實力派自己受降:閻錫山在山西收編日軍、馬家在西北、盧漢的滇軍去越北受降,中央軍進不去他們的本據",
    options: { setupFreeBar: { kmt: SEATS } },
  },
  "L-ccpbase": {
    what: "受降:共軍的免費放置只能放在根據地(北滿、太行、冀魯豫、魯中、陝北)",
    why: "一般命令第一號只准日軍向國軍投降;共軍能受降的是自己根據地周圍",
    options: { setupFreeBar: { ccp: villages.filter((id) => !BASES.includes(id)) } },
  },
  "L-chasui3": {
    what: "察綏開局紅 2 → 3(未決項 2)",
    why: "晉察冀軍區 1945 年 8 月拿下張家口,守到 1946 年 10 月",
    options: { setupPoints: { ccp: { chasui: 3 } } },
  },
  "L-huaihai2": {
    what: "淮海開局藍 1 → 2",
    why: "徐州、蚌埠是津浦與隴海兩條鐵路的交會,1945 年國軍第一批空運、北運的部隊就駐在這一線",
    options: { setupPoints: { kmt: { huaihai: 2 } } },
  },
  "L-pinghan": {
    what: "鄭州與武漢相鄰(平漢路)",
    why: "平漢鐵路從鄭州直通漢口,是國軍北上的主幹;地圖上鄭州到武漢卻要繞大別山",
    options: { adjacency: { add: [["zhengzhou", "wuhan"]] } },
  },
  "L-tianjin4": {
    what: "天津開局藍 3 → 4",
    why: "美軍陸戰隊 1945 年 9 月底在塘沽登陸、進駐天津與北平,到 1947 年才撤",
    options: { setupPoints: { kmt: { tianjin: 4 } } },
  },
  "L-rounds77": {
    what: "接收期行動回合 共 6 / 國 7 → 7 / 7(未決項 8)",
    why: "",
    options: { eraRounds: { takeover: { rounds: [7, 7] } } },
  },
  "L-uscap3": {
    what: "美援的點數最多 3(未決項 5 的備選:支持度 4 時只給 3 點)",
    why: "",
    options: { aidCap: [4, 3] },
  },
  "L-seats1": {
    what: "四個本據城(太原、蘭州、桂林、昆明)開局藍 2 → 1",
    why: "1945 年中央在地方實力派的本據只有名義:閻、馬、桂系、龍雲的部隊都不是中央軍",
    options: { setupPoints: { kmt: { taiyuan: 1, lanzhou: 1, guilin: 1, kunming: 1 } } },
  },
  "L-chasui4": {
    what: "察綏開局紅 2 → 4(共軍開局就控制察綏)",
    why: "晉察冀 1945 年 8 月 23 日拿下張家口,當作首府守到 1946 年 10 月;傅作義只守住綏遠",
    options: { setupPoints: { ccp: { chasui: 4 } } },
  },
  "L-rear012": {
    what: "後方的分值 1/2/3 → 0/1/2(未決項 7)",
    why: "",
    options: { regionValues: { rear: { presence: 0, domination: 1, control: 2 } } },
  },
  "L-sym": {
    what: "三期的行動回合都 7 / 7",
    why: "",
    options: { eraRounds: { takeover: { rounds: [7, 7] }, decisive: { rounds: [7, 7] } } },
  },
  "L-jinzhong3": {
    what: "晉中開局藍 2 → 3",
    why: "晉中平原是閻錫山的老家與糧倉,1948 年夏天的晉中戰役才丟,太原從那時起成了孤城",
    options: { setupPoints: { kmt: { jinzhong: 3 } } },
  },
  "L-jinpu": {
    what: "濟南與徐州相鄰(津浦路)",
    why: "津浦路濟南—兗州—徐州一段是國軍在山東的主幹,1948 年 7 月兗州丟了濟南才真的被切斷",
    options: { adjacency: { add: [["jinan", "xuzhou"]] } },
  },
  "L-huaihai3": {
    what: "淮海開局藍 1 → 3",
    why: "徐州—蚌埠一線是國軍在華東最重的兵力,到 1948 年底淮海戰役才失去",
    options: { setupPoints: { kmt: { huaihai: 3 } } },
  },
  "L-soviet2": {
    what: "蘇聯支持開局 1 → 2",
    why: "蘇軍 1945 年秋把關東軍的武器交給進入東北的共軍",
    options: { supportStart: [2, 4] },
  },
  "L-counter2": {
    what: "戰略反攻(第 5 回合)共軍奇襲鄉 +1 → +2",
    why: "",
    options: { situationCampaign: { counteroffensive: 2 } },
  },
  "L-nerail": {
    what: "停戰・蘇軍撤離:國軍的 4 點可以放在東北三城,以及鐵路上的四平、遼西",
    why: "1946 年春蘇軍撤走,國軍沿北寧路、中長路北上,5 月拿下四平與長春",
    options: { withdrawalKmt: { n: 4, spaces: ["changchun", "shenyang", "jinzhou", "siping", "liaoxi"] } },
  },
  "L-nerail6": {
    what: "停戰・蘇軍撤離:國軍 6 點,放在東北三城與四平、遼西",
    why: "同上;國軍調進東北的是全部美械的新一軍、新六軍",
    options: { withdrawalKmt: { n: 6, spaces: ["changchun", "shenyang", "jinzhou", "siping", "liaoxi"] } },
  },
  "L-turning76": {
    what: "易勢期行動回合 共 7 / 國 7 → 7 / 6",
    why: "1947 年國軍兵力已經不夠全面進攻,改成重點進攻",
    options: { eraRounds: { turning: { rounds: [7, 6] } } },
  },
  "L-sovt4": {
    what: "蘇聯支持第 4 回合 +1(腳本多一步)",
    why: "",
    options: { supportSchedule: [{ turn: 3, side: 1, delta: -1 }, { turn: 4, side: 0, delta: 1 }, { turn: 5, side: 0, delta: 1 }, { turn: 6, side: 1, delta: 1, kmtReform: 2 }, { turn: 7, side: 0, delta: 1 }, { turn: 8, side: 1, delta: -2 }] },
  },
  "L-decisive2": {
    what: "決戰(第 7 回合)共軍奇襲城 +1 → +2",
    why: "",
    options: { situationCampaign: { decisive_battle: 2 } },
  },
  "L-zhengzhou3": {
    what: "鄭州開局藍 2 → 3",
    why: "鄭州是平漢、隴海兩路的交會,國軍鄭州綏靖公署所在,1948 年 10 月才丟",
    options: { setupPoints: { kmt: { zhengzhou: 3 } } },
  },
  "L-seats1b": {
    what: "蘭州、桂林、昆明開局藍 2 → 1(太原不動)",
    why: "馬家、桂系、滇系的部隊不是中央軍;閻錫山則是第二戰區司令長官,太原的國軍就是他的",
    options: { setupPoints: { kmt: { lanzhou: 1, guilin: 1, kunming: 1 } } },
  },
  // ---- orchestrator 在 #23 提的五個候選(2026-10-02「五個要一起量的候選」),各自單獨量
  "O1-seatbar": {
    what: "免費放置不能放進實力派的本據(太原、察綏、桂林、蘭州、昆明),兩邊都是",
    why: "閻錫山、傅作義始終沒被收編;規則書寫整編是前中期的威脅",
    options: { setupFreeBar: { kmt: SEATS, ccp: ["chasui"] } },
  },
  "O2-trunk": {
    what: "濟南—徐州、徐州—南京、徐州—鄭州相鄰(津浦、隴海兩條幹線)",
    why: "1946 年國軍守的是鐵路線上的城;濟南 1948 年 9 月、徐州 1948 年底才被圍死",
    options: { adjacency: { add: [["jinan", "xuzhou"], ["xuzhou", "nanjing"], ["xuzhou", "zhengzhou"]] } },
  },
  "O3-rounds66": {
    what: "接收期行動回合 共 6 / 國 7 → 6 / 6",
    why: "1945–46 年國軍主力還在西南,要靠美軍空運海運北上;兵力優勢已經算在開局 46 對 24",
    options: { eraRounds: { takeover: { rounds: [6, 6] } } },
  },
  "O4-uscap3": {
    what: "美國支持 4 時美援只給 3 點(未決項 5 的備選)",
    why: "1945–46 年美國的幫助主要是運兵(規則裡的空運已經表達)",
    options: { aidCap: [4, 3] },
  },
  "O5-rear012": {
    what: "後方的分值 1/2/3 → 0/1/2(未決項 7)",
    why: "後方是國軍的家,1946 年起通膨與徵兵徵糧讓它一路失血;守住家不該每次記分都淨賺",
    options: { regionValues: { rear: { presence: 0, domination: 1, control: 2 } } },
  },
  "O5-rear001": {
    what: "後方的分值 1/2/3 → 0/0/1",
    why: "同上,調得更低",
    options: { regionValues: { rear: { presence: 0, domination: 0, control: 1 } } },
  },
  "L-regions75": {
    what: "四個戰區的分值約打七五折:華北、華東中原 4/8/10 → 3/6/8,東北 3/6/8 → 2/5/6,西北 2/3/4 不動",
    why: "",
    options: { regionValues: { north: { presence: 3, domination: 6, control: 8 }, east: { presence: 3, domination: 6, control: 8 }, northeast: { presence: 2, domination: 5, control: 6 } } },
  },
  "L-regions50": {
    what: "四個戰區的分值打對折:華北、華東中原 2/4/5,東北 2/3/4,西北 1/2/2",
    why: "",
    options: { regionValues: { north: { presence: 2, domination: 4, control: 5 }, east: { presence: 2, domination: 4, control: 5 }, northeast: { presence: 2, domination: 3, control: 4 }, northwest: { presence: 1, domination: 2, control: 2 } } },
  },
  "L-regionsNE75": {
    what: "華北、華東中原的分值 4/8/10 → 3/6/8(東北、西北、後方不動)",
    why: "",
    options: { regionValues: { north: { presence: 3, domination: 6, control: 8 }, east: { presence: 3, domination: 6, control: 8 } } },
  },
  "L-kmtfirst": {
    what: "受降的免費放置國軍先放(未決項 13)",
    why: "一般命令第一號讓國軍先受降;共軍是看著國軍的部署去搶",
    options: { setupOrder: "kmt-first" },
  },
  // ---- 第二輪(owner 裁決 #23,2026-10-03:孤城那一項改成「開局沒有城成孤城」,並修 P2 的副作用)
  "L-ccpheld": {
    what: "受降:共軍的免費放置只能放在開局時共軍已經控制的鄉(冀中、察綏、太行、冀魯豫、陝北)",
    why: "一般命令第一號只准日軍向國軍投降,蔣 8 月 11 日令共軍「原地駐防待命」;共軍能受降的只有自己的解放區",
    options: { setupFreeBar: { ccp: villages.filter((id) => !["jizhong", "chasui", "taihang", "jiluyu", "shanbei"].includes(id)) } },
  },
  "L-taiyuan1": {
    what: "太原開局藍 2 → 1",
    why: "太原的兵是閻錫山自己的晉綏軍,中央軍一直進不去;蔣始終沒能收編他",
    options: { setupPoints: { kmt: { taiyuan: 1 } } },
  },
  "L-lanzhou3": {
    what: "蘭州開局藍 2 → 3",
    why: "馬家軍是西北最能打的部隊;蘭州是 1949 年 8 月硬打下來的,馬步芳沒有易幟",
    options: { setupPoints: { kmt: { lanzhou: 3 } } },
  },
  "L-seal4": {
    what: "整編從第 4 回合(1947 上)起才放標記",
    why: "1946 年政協與停戰期間軍隊整編只停在紙上;蔣把地方實力派收進剿總體系是 1947 年以後(傅作義 1947 年 12 月任華北剿總)",
    options: { sealFrom: 4 },
  },
  "L-mienorth": {
    what: "易幟的即時勝利,三家裡要有華北的兩家(綏、晉)",
    why: "規則書第三節自己的設計:「易幟則要打下華北兩家,再加蘭州或桂系,那是 1949 年的事」",
    options: { mieNeeds: ["sui", "jin"] },
  },
  "L-mie4": {
    what: "易幟的即時勝利要四家(3 → 4)",
    why: "",
    options: { mie: 4 },
  },
  "L-sealall": {
    what: "整編還要控制那一家的全部地盤(和易幟對稱)",
    why: "",
    options: { sealNeeds: "all" },
  },
};

// ---- 診斷(不是提案的候選:只用來看某個目標在這兩個 bot 底下到不到得了)
VARIANTS["D-iso"] = {
  what: "診斷:補給線上的鄉都加國軍 2 點、天津藍 4",
  why: "只為了看「孤城晚出現」在 bot 底下有沒有可能",
  options: { setupPoints: { kmt: { huaihai: 3, luzhong: 4, dabieshan: 4, jinzhong: 4, jizhong: 2, siping: 2, liaoxi: 2, tianjin: 4 } } },
};

// ---- 組合
const merge = (...names) => {
  const out = {};
  for (const n of names) for (const [k, v] of Object.entries(VARIANTS[n].options)) {
    if (k === "setupPoints" || k === "setupFreeBar" || k === "eraRounds" || k === "regionValues") {
      out[k] ??= {};
      for (const [s, x] of Object.entries(v)) out[k][s] = Array.isArray(x) ? [...(out[k][s] || []), ...x] : { ...(out[k][s] || {}), ...x };
    } else if (k === "adjacency") {
      out[k] = { add: [...(out[k]?.add || []), ...(v.add || [])], remove: [...(out[k]?.remove || []), ...(v.remove || [])] };
    } else out[k] = v;
  }
  return out;
};
// A combination's `parts` are always the single levers (`L-…`, `D-…`), combinations expanded.
const flat = (names) => names.flatMap((n) => (VARIANTS[n].parts ? VARIANTS[n].parts : [n]));
const combo = (name, what, names) => { const parts = flat(names); VARIANTS[name] = { what, why: parts.join(" + "), parts, options: merge(...parts) }; };
const minus = (name, from, drop, add = []) => combo(name, `${from} − ${drop.join(" − ")}${add.length ? " + " + add.join(" + ") : ""}`, [...flat([from]).filter((l) => !drop.includes(l)), ...add]);
combo("C1", "八根全疊", ["L-seatbar", "L-ccpbase", "L-chasui3", "L-huaihai2", "L-pinghan", "L-tianjin4", "L-rounds77", "L-uscap3"]);
combo("C2", "C1 + 本據藍 1 + 整編要全部地盤", ["C1", "L-seats1", "L-sealall"]);
combo("D-iso2", "診斷:C2 + D-iso", ["C2", "D-iso"]);
combo("F1", "F0 + 接收期 7/7 + 蘇聯支持 2 + 整編要全部地盤", ["L-seatbar", "L-chasui4", "L-seats1", "L-rounds77", "L-soviet2", "L-sealall"]);
for (const l of ["L-rear012", "L-turning76", "L-sovt4", "L-decisive2", "L-counter2", "L-uscap3", "L-huaihai3", "L-pinghan", "L-nerail", "L-jinpu", "L-tianjin4", "L-ccpbase"]) {
  combo(`F1+${l.slice(2)}`, `F1 + ${VARIANTS[l].what}`, ["F1", l]);
}
combo("F2", "F1 + 六根補給線(淮海藍 3、平漢路、津浦路、晉中藍 3、東北鐵路、天津藍 4)", ["F1", "L-huaihai3", "L-pinghan", "L-jinpu", "L-jinzhong3", "L-nerail", "L-tianjin4"]);
combo("G1", "F1 + 易勢期 7/6 + 後方 0/1/2 + 蘇聯第 4 回合 +1", ["F1", "L-turning76", "L-rear012", "L-sovt4"]);
combo("G2", "F2 + 易勢期 7/6 + 後方 0/1/2 + 蘇聯第 4 回合 +1 + 鄭州藍 3", ["F2", "L-turning76", "L-rear012", "L-sovt4", "L-zhengzhou3"]);
combo("G3", "G2 + 決戰 +2 + 戰略反攻 +2", ["G2", "L-decisive2", "L-counter2"]);
minus("H1", "G1", ["L-seats1"]);
minus("H2", "G2", ["L-seats1"]);
minus("H3", "G2", ["L-seats1"], ["L-ccpbase"]);
minus("H4", "G2", ["L-seats1", "L-nerail"], ["L-ccpbase", "L-nerail6"]);
minus("H5", "G2", ["L-seats1", "L-soviet2"], ["L-seats1b"]);
minus("H6", "G2", ["L-seats1", "L-soviet2"], ["L-seats1b", "L-ccpbase"]);
minus("H7", "G2", ["L-soviet2"]);
minus("H8", "G1", ["L-soviet2"]);
combo("G2+r75", "G2 + 分值七五折", ["G2", "L-regions75"]);
combo("G2+r50", "G2 + 分值對折", ["G2", "L-regions50"]);
combo("G1+r75", "G1 + 分值七五折", ["G1", "L-regions75"]);
// ---- 提案(第四節 3 的消去表:P-no-<項> 是提案拿掉那一項)
// G1 少了「本據不收免費放置」:在 G1 裡拿掉它,200 局一局不差(S~3~8~10~12~13~16~20~21),不承重。
export const PROPOSAL = ["L-chasui4", "L-seats1", "L-rounds77", "L-soviet2", "L-sealall", "L-turning76", "L-rear012", "L-sovt4"];
combo("P", "提案", PROPOSAL);
for (const l of PROPOSAL) minus(`P-no-${l.slice(2)}`, "P", [l]);
// 孤城時間最好的那一個(爬山搜尋第一步走到的 S~0~3~5~6~8~10~12~13~14~15~16~18~20~21~23,本據不收免費放置在那裡也不承重):對照用,不是提案
// 第二輪:P 的消去表(1,000 局,種子 1–1000)裡,拿掉「蘇聯第 4 回合 +1」沒有一項變壞、數字也幾乎沒動(共軍勝 52.8% → 50.2%,
// 民心第 6 回合末 +0.5 → +0.1,其他各項差不到 1 個百分點),刪掉。P2 是刪掉之後的提案。
export const PROPOSAL2 = PROPOSAL.filter((l) => l !== "L-sovt4");
combo("P2", "提案(第二輪)", PROPOSAL2);
for (const l of PROPOSAL2) minus(`P2-no-${l.slice(2)}`, "P2", [l]);
// 第二輪的候選
combo("R1", "P2 + 共軍只在自己控制的鄉受降", ["P2", "L-ccpheld"]);
combo("R2", "R1 + 易幟要四家", ["R1", "L-mie4"]);
minus("R3", "R1", ["L-seats1"], ["L-seats1b"]);
minus("R4", "R2", ["L-seats1"], ["L-seats1b"]);
minus("R5", "R1", ["L-chasui4"]);
minus("R6", "R2", ["L-chasui4"]);
combo("T1", "受降限制 + 回合 + 蘇聯 2 + 後方 + 整編全地盤 + 察綏紅 4 + 只有太原藍 1(本據不收免費放置)",
  ["L-ccpheld", "L-seatbar", "L-chasui4", "L-taiyuan1", "L-rounds77", "L-soviet2", "L-sealall", "L-turning76", "L-rear012"]);
minus("T2", "T1", ["L-chasui4"]);
minus("T3", "T1", ["L-sealall"]);
combo("T4", "T1 + 蘭州藍 3", ["T1", "L-lanzhou3"]);
combo("T5", "T1 + 易幟要四家", ["T1", "L-mie4"]);
combo("T6", "T1 + 分值七五折", ["T1", "L-regions75"]);
combo("T7", "T1 + 分值對折", ["T1", "L-regions50"]);
combo("T8", "T4 + 分值七五折", ["T4", "L-regions75"]);
combo("U1", "受降限制 + 察綏紅 4 + 回合 + 蘇聯 2 + 後方 + 整編從第 4 回合", ["L-ccpheld", "L-chasui4", "L-rounds77", "L-soviet2", "L-turning76", "L-rear012", "L-seal4"]);
combo("U2", "U1 + 整編要全部地盤", ["U1", "L-sealall"]);
combo("U3", "U1 + 分值七五折", ["U1", "L-regions75"]);
combo("V1", "T1 + 易幟要華北兩家", ["T1", "L-mienorth"]);
combo("V2", "V1 + 分值七五折", ["V1", "L-regions75"]);
combo("V3", "V1 + 分值對折", ["V1", "L-regions50"]);
minus("V4", "V1", ["L-taiyuan1"], ["L-seats1"]);
combo("V5", "V1 + 蘭州藍 3", ["V1", "L-lanzhou3"]);
combo("V6", "V1 + 整編從第 4 回合", ["V1", "L-seal4"]);
combo("V7", "V1 + 整編從第 4 回合 + 分值七五折", ["V1", "L-seal4", "L-regions75"]);
minus("V11", "V6", ["L-sealall"]);
minus("V12", "V6", ["L-sealall", "L-taiyuan1", "L-seatbar"]);
minus("V13", "V6", ["L-sealall", "L-taiyuan1", "L-seatbar"], ["L-regionsNE75"]);
minus("V14", "V6", ["L-sealall"], ["L-regionsNE75"]);
// 第二輪的提案(= V11)
export const PROPOSAL3 = ["L-ccpheld", "L-seatbar", "L-chasui4", "L-taiyuan1", "L-rounds77", "L-soviet2", "L-turning76", "L-rear012", "L-mienorth", "L-seal4"];
combo("P3", "提案(第二輪)", PROPOSAL3);
for (const l of PROPOSAL3) minus(`P3-no-${l.slice(2)}`, "P3", [l]);
// P3 拿掉「本據不收免費放置」在兩批種子上逐局相同(不承重),刪掉:P4 是第二輪最後的提案。
export const PROPOSAL4 = PROPOSAL3.filter((l) => l !== "L-seatbar");
combo("P4", "提案(第二輪,最後)", PROPOSAL4);
// 消去表裡差距在雜訊內的兩項(後方 0/1/2、太原藍 1)一起拿掉,看它們是不是合起來才承重
minus("P5", "P4", ["L-rear012", "L-taiyuan1"]);
combo("Q", "孤城最晚的對照組", ["P", "L-huaihai3", "L-pinghan", "L-jinzhong3", "L-jinpu", "L-nerail", "L-zhengzhou3"]);
// ---- 搜尋:`S~i~j~…` 是 LEVERS 第 i、j…根疊起來(tuning/23/search.mjs 用;名字短,檔名才不會太長)
export const LEVERS = ["L-seatbar", "L-ccpbase", "L-chasui3", "L-chasui4", "L-huaihai2", "L-huaihai3", "L-pinghan", "L-tianjin4",
  "L-rounds77", "L-uscap3", "L-seats1", "L-seats1b", "L-sealall", "L-rear012", "L-jinzhong3", "L-jinpu", "L-soviet2", "L-counter2",
  "L-nerail", "L-nerail6", "L-turning76", "L-sovt4", "L-decisive2", "L-zhengzhou3", "O1-seatbar", "O2-trunk", "O3-rounds66", "O5-rear001", "L-kmtfirst"];
// 第二輪的搜尋:`T~i~j~…` 是 LEVERS2 第 i、j…根(「受降限制」L-ccpheld 一律在內)
export const LEVERS2 = ["L-chasui4", "L-taiyuan1", "L-seats1", "L-seatbar", "L-rounds77", "O3-rounds66", "L-soviet2", "L-sealall",
  "L-turning76", "L-rear012", "O5-rear001", "L-seal4", "L-mie4", "L-lanzhou3", "L-jinzhong3", "L-regions75", "L-regions50",
  "L-counter2", "L-decisive2", "L-sovt4", "L-uscap3", "L-nerail", "L-pinghan", "L-chasui3"];
export function searchVariant(name) {
  let parts;
  if (/^S(~\d+)*$/.test(name)) parts = name.split("~").slice(1).map((i) => LEVERS[Number(i)]);
  else if (/^T(~\d+)*$/.test(name)) parts = ["L-ccpheld", ...name.split("~").slice(1).map((i) => LEVERS2[Number(i)])];
  else return null;
  return { what: parts.join(" + "), why: "", parts, options: merge(...parts) };
}
// 先把整編壓住,再在上面一根一根試
combo("F0", "整編的地基:本據不收免費放置 + 察綏紅 4 + 本據藍 1", ["L-seatbar", "L-chasui4", "L-seats1"]);
for (const l of ["L-rounds77", "L-uscap3", "L-soviet2", "L-counter2", "L-jinzhong3", "L-jinpu", "L-huaihai2", "L-huaihai3", "L-pinghan", "L-tianjin4", "L-nerail", "L-nerail6", "L-rear012", "L-ccpbase", "L-sealall"]) {
  combo(`F0+${l.slice(2)}`, `F0 + ${VARIANTS[l].what}`, ["F0", l]);
}
