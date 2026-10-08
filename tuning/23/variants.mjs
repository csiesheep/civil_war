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
  // #27: mechanism B (#26) on, measured against the default rules (tuning/27/report.txt).
  B: { what: "機制 B(圍點打援、破襲、進剿)開著", why: "M2b 第 1 批(#26 引擎、#27 bot 與模擬)", options: { mechanismB: true } },
  // #28: B is the default rules since #28 (so `base` and `B` play the same); `Boff` is the rules before B.
  Boff: { what: "機制 B 關掉(#28 之前的預設規則)", why: "#28 證明 { mechanismB: false } 照舊是原本的規則", options: { mechanismB: false } },
  // #32: mechanism D's core (#31, not a default) on, the bots taught D (#32); measured against the default rules.
  D: { what: "機制 D(實力派的態度:灰、整編、統戰、易幟 / 整編完成)開著", why: "M2b 第 2 批(#31 引擎、#32 bot 與模擬)", options: { mechanismD: true } },
  // #36: mechanism E (#35, not a default) on, the bots taught E (#36); measured against the default rules.
  E: { what: "機制 E(印鈔與土改:通膨、左傾、中間派)開著", why: "M2b 第 3 批(#35 引擎、#36 bot 與模擬)", options: { mechanismE: true } },

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
    why: "第五輪:1947 年 7–8 月劉鄧挺進大別山、陳謝渡河入豫西、陳粟進豫皖蘇,三路大軍打的是國軍後方的鄉村,戰略反攻的力道在鄉間",
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
  // #24 (orchestrator 裁決): the sentence the owner adopted, 「共軍的免費放置只能放進開局時共軍控制的鄉」, read literally.
  // L-ccpheld listed 察綏 too (it was 紅 4 under L-chasui4 in P4; P10 dropped the 紅 4 and kept the list). On the opening
  // table (red ≥ blue + S) the villages the Communists control are these four; 察綏 is 紅 2 藍 2. Written as a bar so the
  // engine before #24 (19ecae2) plays it. Measured in #24 (tuning/24/report.txt: 7 / 7 / 6 of 10); the owner then chose
  // the controlled villages AND 察綏 (owner 裁決 #24), i.e. L-ccpheld's five: that is the default rule from #24 on
  // (`SETUP.ccp.freeHeld` / `freeAlso`), and on that engine this lever bars 察綏 again.
  "L-ccpheld4": {
    what: "受降:共軍的免費放置只能放進開局時共軍控制的鄉(冀中、太行、冀魯豫、陝北)",
    why: "#24:owner 採用的句子照字面;察綏開局紅 2 藍 2,不是共軍控制的",
    options: { setupFreeBar: { ccp: villages.filter((id) => !["jizhong", "taihang", "jiluyu", "shanbei"].includes(id)) } },
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
  // ---- 第三輪(owner 裁決 #23:開放民心門檻與最早的民心勝利)
  "L-mfrom5": { what: "民心勝利從第 5 回合起才判(之前照記,第 5 回合開始時超過門檻就結束)", why: "", options: { mandateFrom: 5 } },
  "L-mfrom6": { what: "民心勝利從第 6 回合起才判", why: "", options: { mandateFrom: 6 } },
  "L-mfrom7": { what: "民心勝利從第 7 回合(決戰期)起才判", why: "", options: { mandateFrom: 7 } },
  "L-mclamp": { what: "民心勝利以前,民心最多只到門檻減 1(不再往上記)", why: "", options: { mandateEarly: "clamp" } },
  "L-mwin25": { what: "民心勝利的門檻 20 → 25(兩邊)", why: "", options: { mandateWin: [25, 25] } },
  "L-mwinK25": { what: "國軍的民心門檻 20 → 25(共軍仍 20)", why: "", options: { mandateWin: [20, 25] } },
  "L-turning86": {
    what: "易勢期行動回合 共 8 / 國 6",
    why: "第五輪:1947 年國軍的兵力大多被城市與鐵路的守備綁住,能機動的兵團越來越少;共軍從 7 月起轉入戰略進攻,主動權在 1947 年中易手(把共軍多出來的行動從決戰期挪到易勢期,見 L-decisive67)",
    options: { eraRounds: { turning: { rounds: [8, 6] } } },
  },
  "L-mcapK10": { what: "決戰期以前國軍的民心領先最多 10", why: "", options: { mandateEarly: "clamp", mandateCap: [19, 10] } },
  "L-mcap10": { what: "決戰期以前雙方的民心領先最多 10", why: "", options: { mandateEarly: "clamp", mandateCap: [10, 10] } },
  // ---- 第五輪(owner 裁決 #23:把轉折往前挪到 1947)
  "L-counter3": { what: "戰略反攻(第 5 回合)共軍奇襲鄉 +1 → +3", why: "", options: { situationCampaign: { counteroffensive: 3 } } },
  "L-decisive0": {
    what: "決戰(第 7 回合)共軍打城 +1 → 0",
    why: "第五輪:遼瀋、淮海、平津三大戰役在決戰期的牌裡各有一張事件(遼瀋戰役、淮海戰役、平津戰役),時局再給每一次打城 +1 是重複計算;決戰時局仍保留「共軍打城不推民生」",
    options: { situationCampaign: { decisive_battle: 0 } },
  },
  "L-attr11": {
    what: "決戰的孤城掉點 2 → 1",
    why: "第五輪:決戰期被圍的城守得比一季久:長春被圍五個月(1948 年 5–10 月),太原守到 1949 年 4 月,大同到 1949 年 5 月",
    options: { attritionLosses: [1, 1] },
  },
  "L-decisive77": { what: "決戰期行動回合 共 7 / 國 6 → 7 / 7", why: "", options: { eraRounds: { decisive: { rounds: [7, 7] } } } },
  "L-turning85": { what: "易勢期行動回合 共 8 / 國 5", why: "", options: { eraRounds: { turning: { rounds: [8, 5] } } } },
  "L-nwLow": { what: "西北的分值 2/3/4 → 1/2/2", why: "", options: { regionValues: { northwest: { presence: 1, domination: 2, control: 2 } } } },
  "L-mfrom66": { what: "兩邊的民心勝利都從第 6 回合起", why: "", options: { mandateFrom: [6, 6] } },
  "L-mfrom77": { what: "兩邊的民心勝利都從第 7 回合起(Z4 的國軍是第 6 回合)", why: "", options: { mandateFrom: [7, 7] } },
  "L-mfromK4": { what: "國軍的民心勝利從第 4 回合起、共軍的從第 7 回合起", why: "", options: { mandateFrom: [7, 4] } },
  "L-mfromK5": { what: "國軍的民心勝利從第 5 回合起、共軍的從第 7 回合起", why: "", options: { mandateFrom: [7, 5] } },
  "L-mfromK6": { what: "國軍的民心勝利從第 6 回合起、共軍的從第 7 回合起", why: "", options: { mandateFrom: [7, 6] } },
  "L-mcapK8": { what: "決戰期以前國軍的民心領先最多 8", why: "", options: { mandateEarly: "clamp", mandateCap: [19, 8] } },
  "L-mcapK6": { what: "決戰期以前國軍的民心領先最多 6", why: "", options: { mandateEarly: "clamp", mandateCap: [19, 6] } },
  "L-mcapK12": { what: "決戰期以前國軍的民心領先最多 12", why: "", options: { mandateEarly: "clamp", mandateCap: [19, 12] } },
  "L-mcapK4": { what: "國軍的民心勝利開始以前,國軍的民心領先最多 4", why: "", options: { mandateEarly: "clamp", mandateCap: [19, 4] } },
  "L-mcapK3": {
    what: "國軍的民心勝利開始以前(第 6 回合以前),國軍的民心領先最多 3(Z4 是 10)",
    why: "第五輪:1947 年國統區 2 月黃金風潮、5 月「反飢餓、反內戰」學潮,國軍在戰場上的進展(佔延安、重點進攻山東)換不到人心;國府聲望要到 1948 年春行憲才到頂",
    options: { mandateEarly: "clamp", mandateCap: [19, 3] },
  },
  "L-decisiveH88": { what: "決戰期手牌 共 9 / 國 8 → 8 / 8", why: "", options: { eraRounds: { decisive: { hand: [8, 8] } } } },
  "L-decisive67": {
    what: "決戰期行動回合 共 7 / 國 6 → 6 / 7",
    why: "第五輪:把共軍多一個行動回合從決戰期挪到易勢期(L-turning86)。1948 年下半年國軍仍集中著五個大兵團(東北衛立煌、華北傅作義、徐州劉峙與杜聿明、華中白崇禧、西北胡宗南),三大戰役是國軍主力全數投入的會戰;共軍的優勢是 1947 年起取得的主動權。注意:這把規則書決戰期的不對稱反過來,要 owner 判斷",
    options: { eraRounds: { decisive: { rounds: [6, 7] } } },
  },
  "L-decisiveH89": {
    what: "決戰期手牌 共 9 / 國 8 → 8 / 9",
    why: "第五輪:同上,共軍多一張手牌也挪走;1948 年 4 月美國通過援華法案,國軍決戰期的物資與選擇比共軍多。注意:同樣把規則書決戰期的不對稱反過來,要 owner 判斷",
    options: { eraRounds: { decisive: { hand: [8, 9] } } },
  },
  "L-sovt47": {
    what: "蘇聯支持第 7 回合的 +1 提前到第 4 回合",
    why: "第五輪:蘇聯對東北共軍的支援集中在 1946–47 年(移交日軍武器與兵工廠、旅大作為後方、1947 年起哈爾濱對蘇貿易);1948 年下半年的決戰期,東北野戰軍已能自給",
    options: { supportSchedule: [{ turn: 3, side: 1, delta: -1 }, { turn: 4, side: 0, delta: 1 }, { turn: 5, side: 0, delta: 1 }, { turn: 6, side: 1, delta: 1, kmtReform: 2 }, { turn: 8, side: 1, delta: -2 }] },
  },
  "L-us8": {
    what: "美國支持第 8 回合的 −2 拿掉",
    why: "",
    options: { supportSchedule: [{ turn: 3, side: 1, delta: -1 }, { turn: 5, side: 0, delta: 1 }, { turn: 6, side: 1, delta: 1, kmtReform: 2 }, { turn: 7, side: 0, delta: 1 }] },
  },
  "L-sovt47us8": {
    what: "蘇聯支持第 7 回合的 +1 提前到第 4 回合,美國支持第 8 回合的 −2 拿掉",
    why: "",
    options: { supportSchedule: [{ turn: 3, side: 1, delta: -1 }, { turn: 4, side: 0, delta: 1 }, { turn: 5, side: 0, delta: 1 }, { turn: 6, side: 1, delta: 1, kmtReform: 2 }] },
  },
  "L-mwinK15": {
    what: "國軍的民心勝利門檻 20 → 15(共軍仍 20)",
    why: "第五輪:共軍要的是推翻國府、不接受劃江而治;國軍只要在人心上明顯佔優,美國與第三勢力的調停就能把戰爭停在談判桌上(1948 年底到 1949 年初的和談呼聲)。兩邊要的勝利不一樣大",
    options: { mandateWin: [20, 15] },
  },
  "L-mwinK12": { what: "國軍的民心勝利門檻 20 → 12(共軍仍 20)", why: "", options: { mandateWin: [20, 12] } },
  "L-rounds67": { what: "接收期行動回合回到 共 6 / 國 7(拿掉 Z4 的 L-rounds77)", why: "", options: { eraRounds: { takeover: { rounds: [6, 7] } } } },
  "L-turning87": { what: "易勢期行動回合 共 8 / 國 7", why: "", options: { eraRounds: { turning: { rounds: [8, 7] } } } },
  "L-sov1": { what: "蘇聯支持起點回到 1(拿掉 Z4 的 L-soviet2)", why: "", options: { supportStart: [1, 4] } },
  "L-mwinK13": { what: "國軍的民心勝利門檻 20 → 13(共軍仍 20)", why: "", options: { mandateWin: [20, 13] } },
  "L-mwinK14": { what: "國軍的民心勝利門檻 20 → 14(共軍仍 20)", why: "", options: { mandateWin: [20, 14] } },
  "L-mcapK2": { what: "國軍的民心勝利開始以前,國軍的民心領先最多 2", why: "", options: { mandateEarly: "clamp", mandateCap: [19, 2] } },
  // ---- 第四輪(owner 裁決 #23:修國軍的贏法)
  "L-seal1pt": { what: "每回合最多放一個整編標記", why: "", options: { sealPerTurn: 1 } },
  "L-mcapTo4": { what: "國軍的民心上限 10 只管前三回合(第 4–6 回合到門檻減 1)", why: "", options: { mandateCapUntil: 4 } },
  "L-mcapTo5": { what: "國軍的民心上限 10 只管前四回合", why: "", options: { mandateCapUntil: 5 } },
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
    } else if (k === "situationCampaign") {
      // Round five: merged key by key. Before this a later situationCampaign replaced an earlier one
      // whole, so G3 (round one) played counter2 only, not decisive2 as well.
      out[k] = { ...(out[k] || {}), ...v };
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
// 第三輪的候選
combo("M1", "P4 + 民心勝利從第 7 回合", ["P4", "L-mfrom7"]);
combo("M2", "P4 + 民心勝利從第 7 回合(之前夾在門檻內)", ["P4", "L-mfrom7", "L-mclamp"]);
combo("M3", "P4 + 門檻 25", ["P4", "L-mwin25"]);
combo("M4", "P4 + 民心勝利從第 5 回合", ["P4", "L-mfrom5"]);
combo("M5", "P4 + 民心勝利從第 6 回合", ["P4", "L-mfrom6"]);
combo("M6", "P4 + 門檻 25 + 從第 5 回合", ["P4", "L-mwin25", "L-mfrom5"]);
minus("M7", "P4", ["L-seal4"], ["L-mfrom7"]);
minus("N1", "M2", ["L-turning76"], ["L-turning86"]);
combo("N2", "M2 + 戰略反攻 +2", ["M2", "L-counter2"]);
combo("N3", "P4 + 從第 7 回合 + 國軍前期領先最多 10", ["P4", "L-mfrom7", "L-mcapK10"]);
combo("N4", "P4 + 從第 7 回合 + 雙方前期領先最多 10", ["P4", "L-mfrom7", "L-mcap10"]);
minus("N5", "N3", ["L-turning76"], ["L-turning86"]);
minus("N6", "N3", ["L-rear012"]);
minus("N7", "N3", ["L-taiyuan1"]);
minus("N8", "N3", ["L-mcapK10"], ["L-mcapK12"]);
minus("N9", "N3", ["L-rear012", "L-taiyuan1"]);
minus("N10", "N9", ["L-mcapK10"], ["L-mcapK12"]);
minus("N11", "N9", ["L-soviet2"]);
minus("N12", "N9", ["L-turning76"]);
minus("N13", "N9", ["L-chasui4"]);
minus("N14", "N9", ["L-seal4"]);
// 第三輪的提案(= N13)
export const PROPOSAL6 = ["L-ccpheld", "L-rounds77", "L-soviet2", "L-turning76", "L-mienorth", "L-seal4", "L-mfrom7", "L-mcapK10"];
combo("P6", "提案(第三輪)", PROPOSAL6);
for (const l of PROPOSAL6) minus(`P6-no-${l.slice(2)}`, "P6", [l]);
// 第四輪的候選(bot 已學會整編與易幟的新條件)
minus("A1", "P6", ["L-seal4"], ["L-seal1pt"]);
combo("A2", "A1 + 民心上限只管前三回合", ["A1", "L-mcapTo4"]);
combo("A3", "P6 + 民心上限只管前三回合", ["P6", "L-mcapTo4"]);
combo("A4", "A1 + 民心上限只管前四回合", ["A1", "L-mcapTo5"]);
combo("B1", "A1 + 察綏紅 4", ["A1", "L-chasui4"]);
combo("B2", "A1 + 整編要全部地盤", ["A1", "L-sealall"]);
combo("B3", "A1 + 察綏紅 4 + 整編要全部地盤", ["A1", "L-chasui4", "L-sealall"]);
combo("B4", "B3 + 民心上限只管前四回合", ["B3", "L-mcapTo5"]);
// 第四輪最好的變體(= W~0~2~7~9~10~11~24):停損的民心曲線沒過,不是提案
combo("Z4", "第四輪最好的變體", ["L-ccpheld", "L-mienorth", "L-rounds77", "L-soviet2", "L-turning76", "L-seal1pt", "L-sealall", "L-mfrom7", "L-mcapK10", "L-mfromK6"]);
// ---- 第五輪的提案(owner 裁決 #23:把轉折往前挪到 1947):Z4 拿掉「蘇聯支持開局 2」,易勢期 7/6 → 8/6,
// 國軍前期上限 10 → 3,加上戰略反攻 +2、決戰打城 +0、決戰孤城 −1、決戰期 6/7 與手牌 8/9、國軍門檻 15。
// 和搜尋名 V~0~2~7~8~17~24~25~28~32 同一組規則(選項的寫法不同:這裡沒有 supportStart,開局就是規則書的 [1, 4])。
// Z4 的 L-mfrom7(mandateFrom 7)被後面的 L-mfromK6([7, 6])整個蓋掉,在 Z4 裡就不起作用;P8 不再列它,選項逐字相同。
export const PROPOSAL8 = ["L-ccpheld", "L-mienorth", "L-rounds77", "L-turning86", "L-seal1pt", "L-sealall", "L-mcapK3", "L-mfromK6",
  "L-counter2", "L-decisive0", "L-attr11", "L-decisive67", "L-decisiveH89", "L-mwinK15"];
combo("P8", "提案(第五輪)", PROPOSAL8);
for (const l of PROPOSAL8) minus(`P8-no-${l.slice(2)}`, "P8", [l]);
// P8 的消去表裡「易幟要含綏與晉」(L-mienorth)兩批都沒有讓任何一項變失敗:拿掉它就是 P9
export const PROPOSAL9 = PROPOSAL8.filter((l) => l !== "L-mienorth");
combo("P9", "提案(第五輪,P8 拿掉不承重的 L-mienorth)", PROPOSAL9);
for (const l of PROPOSAL9) minus(`P9-no-${l.slice(2)}`, "P9", [l]);
// P9 的消去表裡「決戰的孤城掉點 2 → 1」(L-attr11)兩批都沒有讓任何一項變失敗(第 2 批共軍勝率反而 63.0% → 62.7%):
// 拿掉它就是 P10,和 P9-no-attr11 同一組選項
export const PROPOSAL10 = PROPOSAL9.filter((l) => l !== "L-attr11");
combo("P10", "提案(第五輪,P9 拿掉不承重的 L-attr11)", PROPOSAL10);
for (const l of PROPOSAL10) minus(`P10-no-${l.slice(2)}`, "P10", [l]);
// #24: the owner adopted P10 (owner 裁決 #23, 2026-10-04: 「採用 P10(建議)」). P10s is P10 with the first sentence
// read literally: only the four villages the Communists control at the start (L-ccpheld4), not 察綏 too. It fell
// short on all three batches (tuning/24/report.txt), and the owner chose P10 as #23 measured it, 察綏 included
// (owner 裁決 #24). From #24 on `base` ({}) plays P10 itself, and every variant here is laid over it.
export const PROPOSAL10S = PROPOSAL10.map((l) => (l === "L-ccpheld" ? "L-ccpheld4" : l));
combo("P10s", "P10,第 1 句照句子(共軍只放進開局時控制的四個鄉)", PROPOSAL10S);
// P10 的消去表裡「戰略反攻 +2」(L-counter2)兩批都沒有讓任何一項變失敗(第 6 回合仍然交叉,但只差 1.5 / 3 個百分點):
// 拿掉它就是 P11,和 P10-no-counter2 同一組選項
export const PROPOSAL11 = PROPOSAL10.filter((l) => l !== "L-counter2");
combo("P11", "提案(第五輪,P10 拿掉不承重的 L-counter2)", PROPOSAL11);
for (const l of PROPOSAL11) minus(`P11-no-${l.slice(2)}`, "P11", [l]);
// P11 的消去表(種子 1–1000)裡「決戰打城 0」與「決戰手牌 8/9」各自拿掉都沒有讓任何一項變失敗:這幾根(戰略反攻、
// 決戰打城、決戰手牌)是互相替代的,一根一根消去的順序會決定留下哪一根。直接量兩根都拿掉的 P12,再看剩下的每一根承不承重。
export const PROPOSAL12 = PROPOSAL11.filter((l) => l !== "L-decisive0" && l !== "L-decisiveH89");
combo("P12", "提案(第五輪,P11 拿掉 L-decisive0 與 L-decisiveH89)", PROPOSAL12);
for (const l of PROPOSAL12) minus(`P12-no-${l.slice(2)}`, "P12", [l]);
// P12 第 2 批共軍勝 65.2%(失敗):兩根至少要留一根。P11 拿掉決戰手牌 8/9(L-decisiveH89)兩批都過 → P13,
// 和 P11-no-decisiveH89 同一組選項;在 P13 裡再拿掉決戰打城 0 就是 P12(第 2 批失敗),所以它承重。
export const PROPOSAL13 = PROPOSAL11.filter((l) => l !== "L-decisiveH89");
combo("P13", "提案(第五輪,P11 拿掉 L-decisiveH89)", PROPOSAL13);
for (const l of PROPOSAL13) minus(`P13-no-${l.slice(2)}`, "P13", [l]);
// P13 的消去表裡「國軍的民心門檻 15」(L-mwinK15)兩批都沒有讓任何一項變失敗 → P14,和 P13-no-mwinK15 同一組選項
export const PROPOSAL14 = PROPOSAL13.filter((l) => l !== "L-mwinK15");
combo("P14", "提案(第五輪,P13 拿掉不承重的 L-mwinK15)", PROPOSAL14);
for (const l of PROPOSAL14) minus(`P14-no-${l.slice(2)}`, "P14", [l]);
combo("Q", "孤城最晚的對照組", ["P", "L-huaihai3", "L-pinghan", "L-jinzhong3", "L-jinpu", "L-nerail", "L-zhengzhou3"]);
// ---- 搜尋:`S~i~j~…` 是 LEVERS 第 i、j…根疊起來(tuning/23/search.mjs 用;名字短,檔名才不會太長)
export const LEVERS = ["L-seatbar", "L-ccpbase", "L-chasui3", "L-chasui4", "L-huaihai2", "L-huaihai3", "L-pinghan", "L-tianjin4",
  "L-rounds77", "L-uscap3", "L-seats1", "L-seats1b", "L-sealall", "L-rear012", "L-jinzhong3", "L-jinpu", "L-soviet2", "L-counter2",
  "L-nerail", "L-nerail6", "L-turning76", "L-sovt4", "L-decisive2", "L-zhengzhou3", "O1-seatbar", "O2-trunk", "O3-rounds66", "O5-rear001", "L-kmtfirst"];
// 第二輪的搜尋:`T~i~j~…` 是 LEVERS2 第 i、j…根(「受降限制」L-ccpheld 一律在內)
export const LEVERS2 = ["L-chasui4", "L-taiyuan1", "L-seats1", "L-seatbar", "L-rounds77", "O3-rounds66", "L-soviet2", "L-sealall",
  "L-turning76", "L-rear012", "O5-rear001", "L-seal4", "L-mie4", "L-lanzhou3", "L-jinzhong3", "L-regions75", "L-regions50",
  "L-counter2", "L-decisive2", "L-sovt4", "L-uscap3", "L-nerail", "L-pinghan", "L-chasui3"];
// 第四輪的搜尋:`W~i~j~…` 是 LEVERS3 第 i、j…根(受降限制、易幟要含綏晉、民心從第 7 回合起一律在內)
export const LEVERS3 = ["L-seal1pt", "L-seal4", "L-sealall", "L-chasui4", "L-taiyuan1", "L-seats1", "L-rear012", "L-rounds77",
  "O3-rounds66", "L-soviet2", "L-turning76", "L-mcapK10", "L-mcapK12", "L-mcapTo4", "L-mcapTo5", "L-lanzhou3", "L-counter2", "L-decisive2", "L-mclamp",
  "L-mcapK8", "L-mcapK6", "L-turning86", "L-mfromK4", "L-mfromK5", "L-mfromK6"];
// 第五輪的搜尋:`V~i~j~…` 是 Z4 加上 LEVERS5 第 i、j…根(後面的覆蓋 Z4 同一個選項)
export const LEVERS5 = ["L-turning86", "L-turning85", "L-counter2", "L-counter3", "L-sovt4", "L-rear012", "O5-rear001", "L-decisive0",
  "L-attr11", "L-decisive77", "L-nwLow", "L-mfrom66", "L-mcapK6", "L-chasui4", "L-taiyuan1", "L-mfromK5", "L-mcapK4", "L-mcapK3", "L-mcapK2", "L-decisiveH88", "L-sovt47", "L-regions75", "L-regions50", "L-mfrom77", "L-decisive67", "L-decisiveH89", "L-us8", "L-sovt47us8", "L-mwinK15", "L-mwinK12", "L-mwinK13", "L-mwinK14", "L-sov1", "L-rounds67", "L-turning87"];
export function searchVariant(name) {
  let parts;
  if (/^V(~\d+)*$/.test(name)) {
    parts = [...VARIANTS.Z4.parts, ...name.split("~").slice(1).map((i) => LEVERS5[Number(i)])];
    return { what: parts.join(" + "), why: "", parts, options: merge(...parts) };
  }
  if (/^W(~\d+)*$/.test(name)) {
    parts = ["L-ccpheld", "L-mienorth", "L-mfrom7", ...name.split("~").slice(1).map((i) => LEVERS3[Number(i)])];
    return { what: parts.join(" + "), why: "", parts, options: merge(...parts) };
  }
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

// ---- #33: D's numbers (owner 裁決 #33: 「調一輪 D 的數字」). Every `MD-…` is laid over the variant D
// ({ mechanismD: true }) and uses only #33's options (engine.js, at DPOWERS); a part's d-keys that are tables
// are merged power by power / space by space, a later part winning. `what` is the rulebook sentence, `why` its
// reason (the note's map v0.2, its 史實 lines, or history).
const MD = {};
const md = (name, what, why, options) => { MD[name] = { what, why, options }; VARIANTS[name] = { what, why, options: { mechanismD: true, ...options } }; };
const mdc = (name, what, parts) => {
  const options = { mechanismD: true };
  for (const p of parts) for (const [k, v] of Object.entries(MD[p].options)) {
    options[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...(options[k] || {}), ...v } : v;
  }
  VARIANTS[name] = { what, why: parts.join(" + "), parts, options };
};
export const GRAY_V02 = { chasui: 4, taiyuan: 4, jinzhong: 3, lanzhou: 4, guilin: 4, kunming: 4 };
md("MD-g4", "開局的灰:察綏 4、太原 4、晉中 3、蘭州 4、桂林 4、昆明 4(這六個據點沒有藍)",
  "筆記的地圖 v0.2(「察綏 灰 4、紅 2」…「昆明 灰 4」):察綏要 6 點紅才拿得下,整編也要大牌或兩次", { dGray: GRAY_V02 });
md("MD-sui4", "開局的灰:察綏 4(其餘照 #30 各 2)",
  "只改筆記 v0.2 裡擋住開局易幟的那一格:傅作義的主力在綏遠,1945 年晉察冀佔張家口沒有動到他的本錢", { dGray: { chasui: 4 } });
md("MD-bar", "機制 D:共軍受降的免費放置不能放進勢力的據點(察綏)",
  "1945 年 8 月晉察冀佔的是察哈爾的張家口;綏遠(歸綏、包頭)一直在傅作義手上,1946 年 10 月他還打回張家口", { dFreeBar: true });
mdc("MD-g4bar", "MD-g4 + MD-bar", ["MD-g4", "MD-bar"]);
// Single levers for the second round (each laid over D, combined with the first round's by `mdc`).
md("MD-jinL", "開局態度:晉效忠", "閻錫山反共最堅決:太原守到 1949 年 4 月,從沒有談過;筆記的「觀望」寫的是他對蔣的獨立,不是對共軍", { dAttitude: { jin: "loyal" } });
md("MD-guiL", "開局態度:桂效忠", "1945–1947 年桂系在中央裡(白崇禧國防部長、李宗仁北平行營主任);和蔣翻臉是 1948 年副總統選舉之後", { dAttitude: { gui: "loyal" } });
md("MD-rear3", "開局的灰:桂林 3、昆明 3", "桂、滇的主力 1945 年都調出本省:桂系第 7、48 軍在華中,滇軍第 60、93 軍去越北受降、再運到東北;留在家裡的少", { dGray: { guilin: 3, kunming: 3 } });
md("MD-noBlue", "結算時,孤城裡有灰而且沒有藍(這次結算掉藍之後),該勢力往通共一格", "中央軍還在城裡,地方派不敢動:太原 1948–49 年有空運進去的中央軍,閻錫山守到最後", { dSettle: "noBlue" });
md("MD-twice", "結算時,同一座城連續兩次結算都是孤城,該勢力才往通共一格", "孤城要圍得夠久才動搖:長春圍了五個月(1948 年 5 到 10 月)滇軍才起義", { dSettle: "twice" });
md("MD-int2", "整編:把最多 min(X, 2) 點灰換成藍", "整編地方部隊一次只能動一部分(1946 年整軍是一個軍一個軍縮成整編師)", { dIntegrateMax: 2 });
md("MD-seal3", "整編完成:國軍民心 +3", "整編完成是中央真的拿下了一省的兵權,值得和綏、桂的易幟一樣多", { dSealVp: 3 });
// The second round (tuning/33/report.txt): the first round fixed turn 0 (MD-bar, MD-g4bar) but the Communists
// still won 83–85%, by 綏 at turn 1–2 and 晉 + 馬 talked over (結算 of their cut-off seats). Slow the talks
// (dSettle), make 晉 two steps from 通共 (MD-jinL), and keep the rear's gray at 2 where 整編 needs it (MD-sui4bar).
mdc("MD-g4bar+twice", "MD-g4bar + MD-twice", ["MD-g4", "MD-bar", "MD-twice"]);
mdc("MD-g4bar+noBlue", "MD-g4bar + MD-noBlue", ["MD-g4", "MD-bar", "MD-noBlue"]);
mdc("MD-g4bar+jinL", "MD-g4bar + MD-jinL", ["MD-g4", "MD-bar", "MD-jinL"]);
mdc("MD-g4bar+jinL+twice", "MD-g4bar + MD-jinL + MD-twice", ["MD-g4", "MD-bar", "MD-jinL", "MD-twice"]);
mdc("MD-sui4bar", "MD-sui4 + MD-bar", ["MD-sui4", "MD-bar"]);
mdc("MD-sui4bar+twice", "MD-sui4 + MD-bar + MD-twice", ["MD-sui4", "MD-bar", "MD-twice"]);
mdc("MD-sui4bar+jinL+twice", "MD-sui4 + MD-bar + MD-jinL + MD-twice", ["MD-sui4", "MD-bar", "MD-jinL", "MD-twice"]);
mdc("MD-bar+twice", "MD-bar + MD-twice", ["MD-bar", "MD-twice"]);
mdc("MD-bar+jinL+twice", "MD-bar + MD-jinL + MD-twice", ["MD-bar", "MD-jinL", "MD-twice"]);
// The third round: MD-sui4bar+jinL+twice failed only the Communists' rate (71.7%) and the Nationalists' wins
// bunched at turn 8 (and the two items every batch fails); give the Nationalists' 整編完成 more 民心.
md("MD-sui2vp", "易幟給共軍的民心:綏 2", "沒有調防就沒有北平:綏只是察綏一個鄉,它的易幟(1949 年 9 月,北平方式之後)和晉、馬、滇一樣給 2", { dMieVp: { sui: 2 } });
mdc("MD-S3", "MD-sui4bar + MD-jinL + MD-twice + MD-seal3", ["MD-sui4", "MD-bar", "MD-jinL", "MD-twice", "MD-seal3"]);
mdc("MD-S3v", "MD-S3 + MD-sui2vp", ["MD-sui4", "MD-bar", "MD-jinL", "MD-twice", "MD-seal3", "MD-sui2vp"]);
md("MD-thr-1", "統戰門檻:綏 2、晉 3、桂 2、馬 3、滇 2(各少 1,滇已是 2 不再降)", "地下黨的工作早就在做(傅作義身邊的傅冬菊、程潛與陳明仁的聯絡):談判不必等到大牌", { dThreshold: { sui: 2, jin: 3, gui: 2, ma: 3, dian: 2 } });
