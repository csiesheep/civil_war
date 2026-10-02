# 60 張重出候選的檢查清單(#21)

15 張 X 的牌各 4 張候選(`redo/<card id>__c<1-4>.jpg`,768 × 1024,JPEG 品質 88,不後製)。種子 = 21000 + 牌的編號 × 10 + 候選編號;候選 1 到 4 是 Qwen Image 2.1(25 步),`real_tech` 的 X 牌(24、67、72)的候選 4 是 Z-Image Turbo(20 步)。prompt、模型、種子、步數在 `redo.json`。**不為硬傷重出**(#21 裁決):每張牌就這 4 張,硬傷照實記。

定義和 #19、#20 相同:框(紙邊、暗角、白邊)、圖上有字(含浮水印、簽名、紙邊小字)、旗或機徽畫錯(紅旗上有星、國旗太陽變黃、機徽畫成美國星、畫像畫錯人)、明顯畸形、認不出是那張牌。臉不像本人、構圖、軍服細節不算硬傷。

看法:每一張候選都做成「整張 + 四個角(放大 3 倍)+ 底邊 100 px(放大 2 倍)」的切片來看,再對每一面旗、每一個機徽、牆上的畫像、每一處像字的東西各自放大。

## 統計(60 張)

- **沒有任何硬傷的:46 張**(60 張裡)。
- 每張牌有幾張乾淨的候選:0 張乾淨:72;1 張乾淨:36;2 張乾淨:65;3 張乾淨:11、12、13、33、37;4 張乾淨:16、17、24、39、53、64、67。
- **4 張候選都有硬傷的牌:72 大公報社評。**

## 60 列

| 牌 | 候選 | 模型 | 種子 | 框 | 字 | 旗與機徽 | 畸形 | 認得出是這張牌 | 備註 |
|---|---|---|---|---|---|---|---|---|---|
| 11 中蘇友好同盟條約 (sino_soviet_treaty) | 1 | Qwen | 21111 | 無 | 無 | 對 | 無 | 是 | 闔上的皮面夾與兩支筆,桌面沒有紙;握手的兩人,後面戴圓眼鏡者是宋子文;史達林在後面 |
| 11 中蘇友好同盟條約 (sino_soviet_treaty) | 2 | Qwen | 21112 | 無 | 無 | 對 | 無 | 是 | 闔上的皮面夾;宋子文胸前一枚小徽章(不是旗);塔頂的紅星是建築,不是旗 |
| 11 中蘇友好同盟條約 (sino_soviet_treaty) | 3 | Qwen | 21113 | 無 | 無 | 對 | 無 | 是 | 皮面夾與兩支筆,桌面乾淨;史達林在握手 |
| 11 中蘇友好同盟條約 (sino_soviet_treaty) | 4 | Qwen | 21114 | 無 | 無 | 對 | 有:握手的西裝男子也是史達林的臉(兩個史達林) | 是 | 皮面夾與筆乾淨,沒有字 |
| 12 還都南京 (return_to_nanjing) | 1 | Qwen | 21121 | 無 | 無 | 對 | 無 | 是 | 國旗白日十二芒、藍角正確;石階與蔣宋並肩 |
| 12 還都南京 (return_to_nanjing) | 2 | Qwen | 21122 | 無 | 有:殿門的匾額上有成形的假漢字(紅字) | 對 | 無 | 是 | 國旗白日正確 |
| 12 還都南京 (return_to_nanjing) | 3 | Qwen | 21123 | 無 | 無 | 對 | 無 | 是 | 國旗白日十二芒正確;人群與衛兵 |
| 12 還都南京 (return_to_nanjing) | 4 | Qwen | 21124 | 無 | 無 | 對 | 無 | 是 | 國旗白日正確;人群與衛兵 |
| 13 軍事整編會議 (reorganisation_conference) | 1 | Qwen | 21131 | 無 | 無 | 對 | 無 | 是 | 馬歇爾與一位中國人握手;牆上地圖只有小色塊,不成字;窗外雪天山城 |
| 13 軍事整編會議 (reorganisation_conference) | 2 | Qwen | 21132 | 無 | 有:地圖旁貼著一張有成排假漢字的直式標籤 | 對 | 無 | 是 | 右邊有一條紅色直柱 |
| 13 軍事整編會議 (reorganisation_conference) | 3 | Qwen | 21133 | 無 | 無 | 對 | 無 | 是 | 地圖上紅色區塊與小標記看不出字;兩人握手交文件 |
| 13 軍事整編會議 (reorganisation_conference) | 4 | Qwen | 21134 | 無 | 無 | 對 | 無 | 是 | 地圖上色塊與小標記看不出字;握手交文件 |
| 16 闖關東 (into_manchuria) | 1 | Qwen | 21161 | 無 | 無 | 對 | 無 | 是 | 素面紅旗;長城關門、士兵、騾車;匾額空白 |
| 16 闖關東 (into_manchuria) | 2 | Qwen | 21162 | 無 | 無 | 對 | 無 | 是 | 素面紅旗;關門匾額空白 |
| 16 闖關東 (into_manchuria) | 3 | Qwen | 21163 | 無 | 無 | 對 | 無 | 是 | 素面紅旗;匾額空白 |
| 16 闖關東 (into_manchuria) | 4 | Qwen | 21164 | 無 | 無 | 對 | 無 | 是 | 素面紅旗;匾額空白 |
| 17 上黨戰役 (shangdang_campaign) | 1 | Qwen | 21171 | 無 | 無 | 對 | 無 | 是 | 素面紅旗;紅柿子梯田;山脊上指揮官很小 |
| 17 上黨戰役 (shangdang_campaign) | 2 | Qwen | 21172 | 無 | 無 | 對 | 無 | 是 | 素面紅旗;山脊上持望遠鏡的指揮官;柿子樹 |
| 17 上黨戰役 (shangdang_campaign) | 3 | Qwen | 21173 | 無 | 無 | 對 | 無 | 是 | 素面紅旗;指揮官指向山下城鎮 |
| 17 上黨戰役 (shangdang_campaign) | 4 | Qwen | 21174 | 無 | 無 | 對 | 無 | 是 | 素面紅旗;指揮官持望遠鏡指向山下城鎮 |
| 24 馬歇爾調處 (marshall_mission) | 1 | Qwen | 21241 | 無 | 無 | 對 | 無 | 是 | 三個人並排:蔣(左)馬歇爾(中,雙臂張開)周(右);桌上的地圖沒有字 |
| 24 馬歇爾調處 (marshall_mission) | 2 | Qwen | 21242 | 無 | 無 | 對 | 無 | 是 | 三個人都在,馬歇爾一臂伸向周、一手在蔣胸前 |
| 24 馬歇爾調處 (marshall_mission) | 3 | Qwen | 21243 | 無 | 無 | 對 | 無 | 是 | 三個人都在,馬歇爾雙臂向兩側;桌上卷著地圖,字跡看不清 |
| 24 馬歇爾調處 (marshall_mission) | 4 | Z-Image | 21244 | 無 | 無 | 對 | 無 | 是 | Z-Image;三個人都在,馬歇爾雙臂張開;領章有一個小徽記,不成字 |
| 33 取締民盟 (league_banned) | 1 | Qwen | 21331 | 無 | 有:待確認:警察領章的小紅牌上有像字的筆畫(放大 5 倍才看出,很小) | 對 | 無 | 是 | 門與牆完全空白,沒有門牌、匾額、招牌;張瀾(白山羊鬍、圓眼鏡、手杖)站在門口;油印機與文件箱 |
| 33 取締民盟 (league_banned) | 2 | Qwen | 21332 | 無 | 無 | 對 | 無 | 是 | 門牆空白,沒有門牌;張瀾站在門口,警察上鎖;帽徽是圖案不是字 |
| 33 取締民盟 (league_banned) | 3 | Qwen | 21333 | 無 | 無 | 對 | 無 | 是 | 門牆空白;牆上有一盞小壁燈(prompt 說沒有燈籠,但燈上沒有字);張瀾與警察 |
| 33 取締民盟 (league_banned) | 4 | Qwen | 21334 | 無 | 無 | 對 | 無 | 是 | 門牆空白,門上方是紅色玻璃窗;張瀾在門邊;帽徽是圖案 |
| 36 行憲國大 (national_assembly) | 1 | Qwen | 21361 | 無 | 無 | 錯:牆上的畫像是穿軍裝、沒有鬍子的人像,不像孫中山 | 無 | 是 | 國旗白日十二芒、藍角正確;投票箱、排隊投票;國會圓頂 |
| 36 行憲國大 (national_assembly) | 2 | Qwen | 21362 | 無 | 無 | 對 | 無 | 是 | 畫像是孫中山(八字鬍、中山裝)正確;國旗正確;投票箱、投票的代表 |
| 36 行憲國大 (national_assembly) | 3 | Qwen | 21363 | 無 | 無 | 錯:待確認:畫像是穿軍裝的人像,沒有八字鬍,不確定是不是孫中山 | 無 | 是 | 國旗白日十二芒正確;排隊投票 |
| 36 行憲國大 (national_assembly) | 4 | Qwen | 21364 | 無 | 無 | 錯:待確認:畫像是穿軍裝的人像,沒有八字鬍,不確定是不是孫中山 | 無 | 是 | 國旗正確;人群裡有一塊紅布上有白色小花紋(不是旗);排隊投票 |
| 37 美械整編師 (american_divisions) | 1 | Qwen | 21371 | 無 | 無 | 對 | 無 | 是 | 美式鋼盔砲手瞄準榴彈砲,後面戰車、卡車、列隊步兵;軍官胸前有一小塊白色牌子,看不出字;沒有旗 |
| 37 美械整編師 (american_divisions) | 2 | Qwen | 21372 | 無 | 無 | 對 | 無 | 是 | 砲手、戰車、卡車、列隊步兵都在;沒有旗與字 |
| 37 美械整編師 (american_divisions) | 3 | Qwen | 21373 | 無 | 有:砲手的紅色領章與另一名士兵的臂章上有白色假漢字 | 對 | 無 | 是 | 砲手、戰車、卡車、列隊步兵都在 |
| 37 美械整編師 (american_divisions) | 4 | Qwen | 21374 | 無 | 無 | 對 | 無 | 是 | 鋼盔上有紅色菱形徽(不成字);砲手、榴彈砲、卡車、列隊步兵 |
| 39 孟良崮 (menglianggu) | 1 | Qwen | 21391 | 無 | 無 | 對 | 無 | 是 | 素面紅旗;共軍爬上灰色石山,山下國軍車隊著火;沒有字 |
| 39 孟良崮 (menglianggu) | 2 | Qwen | 21392 | 無 | 無 | 對 | 無 | 是 | 素面紅旗;山頂與山腰擠滿士兵,山下車隊冒煙 |
| 39 孟良崮 (menglianggu) | 3 | Qwen | 21393 | 無 | 無 | 對 | 無 | 是 | 素面紅旗插在山頂;士兵爬山,山下國軍車隊冒煙 |
| 39 孟良崮 (menglianggu) | 4 | Qwen | 21394 | 無 | 無 | 對 | 無 | 是 | 素面紅旗;士兵爬山,山下車隊與戰車冒煙 |
| 53 傅作義守華北 (fu_holds_the_north) | 1 | Qwen | 21531 | 無 | 無 | 對 | 無 | 是 | 國旗白日十二芒正確;大衣軍官持望遠鏡,城樓、沙包、機槍;帽徽是白日圖案 |
| 53 傅作義守華北 (fu_holds_the_north) | 2 | Qwen | 21532 | 無 | 無 | 對 | 無 | 是 | 國旗白日正確;大衣軍官持望遠鏡、沙包機槍陣地、雪地;帽徽是圓形圖案 |
| 53 傅作義守華北 (fu_holds_the_north) | 3 | Qwen | 21533 | 無 | 無 | 對 | 無 | 是 | 國旗白日正確;大衣軍官、城樓、沙包機槍、雪晨 |
| 53 傅作義守華北 (fu_holds_the_north) | 4 | Qwen | 21534 | 無 | 無 | 對 | 無 | 是 | 國旗白日正確;大衣軍官持望遠鏡、沙包機槍、雪地城牆 |
| 64 新政協 (new_consultative_conference) | 1 | Qwen | 21641 | 無 | 無 | 對 | 無 | 是 | 沒有任何旗;紅絲絨帷幕與紅燈籠;毛澤東在講台舉手,喇嘛、回族白帽者在台下 |
| 64 新政協 (new_consultative_conference) | 2 | Qwen | 21642 | 無 | 無 | 對 | 無 | 是 | 沒有星;左邊有一面素面紅旗垂著、背景有幾根細旗桿(prompt 說不畫旗,但沒有星);毛澤東舉手、喇嘛、藏袍、回族白帽 |
| 64 新政協 (new_consultative_conference) | 3 | Qwen | 21643 | 無 | 無 | 對 | 無 | 是 | 沒有任何旗,沒有星;紅帷幕、燈籠;毛澤東舉手、喇嘛、回族白帽、女幹部 |
| 64 新政協 (new_consultative_conference) | 4 | Qwen | 21644 | 無 | 無 | 對 | 無 | 是 | 沒有任何旗,沒有星;紅帷幕、燈籠;毛澤東側面、喇嘛、回族、女幹部 |
| 65 和平起義 (peaceful_changeover) | 1 | Qwen | 21651 | 無 | 無 | 對 | 無 | 是 | 旗全是素面紅旗;城樓上有一塊空白紅方塊;守軍架槍堆、共軍幹部點收 |
| 65 和平起義 (peaceful_changeover) | 2 | Qwen | 21652 | 無 | 無 | 錯:紅旗左上角有黃色五角星 | 無 | 是 | 槍堆、點收、城門都在 |
| 65 和平起義 (peaceful_changeover) | 3 | Qwen | 21653 | 無 | 有:待確認:城門上方的石匾有模糊的像字筆畫(放大 4 倍仍不成形) | 對 | 無 | 是 | 紅旗素面;守軍架槍、共軍點收、城頭有人 |
| 65 和平起義 (peaceful_changeover) | 4 | Qwen | 21654 | 無 | 無 | 對 | 無 | 是 | 旗素面(城頭一排小紅旗也無星);槍堆、點收、出城隊伍 |
| 67 史達林的建議 (stalins_advice) | 1 | Qwen | 21671 | 無 | 無 | 對 | 無 | 是 | 歐洲人認得出(毛皮領大衣、濃黑八字鬍、西裝領帶、毛皮帽在桌上);中國人只有 3 位(prompt 寫 4 位);地圖上沒有字 |
| 67 史達林的建議 (stalins_advice) | 2 | Qwen | 21672 | 無 | 無 | 對 | 無 | 是 | 歐洲人認得出;中國人 3 位;煤爐、雪窗;地圖沒有字 |
| 67 史達林的建議 (stalins_advice) | 3 | Qwen | 21673 | 無 | 無 | 對 | 無 | 是 | 歐洲人認得出;中國人 3 位;煤爐在後;地圖沒有字 |
| 67 史達林的建議 (stalins_advice) | 4 | Z-Image | 21674 | 無 | 無 | 對 | 無 | 是 | Z-Image;歐洲人認得出;中國人只有 2 位,畫在戶外雪地院子裡(不在屋內);地圖沒有字 |
| 72 大公報社評 (ta_kung_pao) | 1 | Qwen | 21721 | 無 | 有:左側直式布招牌上有成形的大字、門邊小牌有字,舉著的報紙正面有成行排版字 | 對 | 無 | 是 | 報攤、印刷機、報童、舉報紙的人都在 |
| 72 大公報社評 (ta_kung_pao) | 2 | Qwen | 21722 | 無 | 有:店頭橫匾與門邊直牌有成形的字,報紙正面有成行排版字 | 對 | 無 | 是 | 印刷機、報童、舉報紙的人都在 |
| 72 大公報社評 (ta_kung_pao) | 3 | Qwen | 21723 | 無 | 有:門兩側直式對聯牌有成形的字;前排 3 張報紙是空白背面,後排有排版字 | 對 | 無 | 是 | 印刷機、報童、舉報紙的人都在 |
| 72 大公報社評 (ta_kung_pao) | 4 | Z-Image | 21724 | 無 | 有:報紙正面有標題與排版字,地磚上有假字符,門內牆上有字形裝飾 | 對 | 無 | 是 | Z-Image;印刷機、舉報紙的人都在 |

## 改過畫面的 5 張

owner 沒有說 X 的原因;這 5 張的毛病是已知的,而且換種子治不好,所以改了 Scene(只改怎麼畫,不改史實:誰、在哪裡、哪一年)。其餘 10 張的 prompt 和 `prompts.json` 逐字相同。

### 11 中蘇友好同盟條約

- 為什麼這樣改:條約紙上有成行的像字的筆跡(#20 看到的毛病);要看不到任何紙面上的字跡
- 原來的 Scene:A gilded hall in the Kremlin in Moscow on the night of 14 August 1945: Chinese Foreign Minister Wang Shijie in a dark Western suit signs a treaty at a polished table beside Soviet Foreign Minister Molotov, Joseph Stalin, grey-haired with a heavy grey-black moustache in a plain pale tunic and holding his pipe, stands smiling behind them, T. V. Soong, a lean man in round glasses and a dark long gown, seated at the table, crystal chandeliers and red velvet curtains, press photographers with flashbulbs, low-angle close-up on the signing hands and pens. Moscow, August 1945, formal suits and uniforms, no readable documents.
- 改過的 Scene:The Kremlin in Moscow on the night of 14 August 1945, the moment after the signing: Chinese Foreign Minister Wang Shijie in a dark Western suit and Soviet Foreign Minister Molotov stand shaking hands across a polished table, a closed dark-red leather portfolio lying shut in front of them with two fountain pens beside it, the whole tabletop otherwise bare, Joseph Stalin, grey-haired with a heavy grey-black moustache in a plain pale tunic and holding his pipe, stands smiling behind them, T. V. Soong, a lean man in round glasses and a dark long gown, beside him, gilded walls, crystal chandeliers and red velvet curtains, press photographers with flashbulbs, low-angle close-up on the clasped hands and the closed portfolio. Moscow, August 1945, formal suits and uniforms, not a single sheet of paper or page of writing visible anywhere in the picture.
- 4 張候選裡那個毛病還在不在:沒有了:4 張候選的桌面只有闔上的皮面夾與筆,看不到任何紙面字跡(候選 4 另有兩個史達林臉的畸形,和這個毛病無關)

### 24 馬歇爾調處

- 為什麼這樣改:prompt 寫三人小組,圖上只有兩個人;要三個人都在、認得出是三方
- 原來的 Scene:A sunny garden terrace with a plum tree in a villa in Nanjing: General George Marshall, tall and straight with silver-grey hair and a lined, stern face, in a US Army general's uniform, stands between Chiang Kai-shek, a lean upright man with a close-shaved bald head and a lean long face, in a plain khaki tunic with no decorations, and Zhou Enlai, a slim man with a narrow face, thick straight black eyebrows and short neat dark hair, in a grey Zhongshan suit, at a garden table spread with maps, one hand raised toward each of them as if holding them apart, aides in the background, warm afternoon light. Nanjing, 1946, no readable documents, no signboards.
- 改過的 Scene:A sunny garden terrace with a plum tree in a villa in Nanjing, a wide shot of exactly three men standing side by side in a row, full figures, each clearly different: in the centre General George Marshall, tall and straight with silver-grey hair and a lined, stern face, in a US Army general's uniform, his arms stretched out wide to both sides with one open hand toward each of the others; on his left Chiang Kai-shek, a lean upright man with a close-shaved bald head and a lean long face, in a plain khaki tunic with no decorations; on his right Zhou Enlai, a slim man with a narrow face, thick straight black eyebrows and short neat dark hair, in a grey Zhongshan suit; a garden table behind them with a rolled map, warm afternoon light, the three of them filling the foreground and nobody else in front of them. Nanjing, 1946, no readable documents, no signboards.
- 4 張候選裡那個毛病還在不在:沒有了:4 張候選都是三個人並排(蔣、馬歇爾居中雙臂張開、周),認得出是三方

### 33 取締民盟

- 為什麼這樣改:門邊有帶字的門牌,#19 換三次種子都有;要畫面裡沒有門牌、匾額、招牌、燈籠上的字
- 原來的 Scene:The stone-framed door of a lane house in a Shanghai alley at dusk: Nationalist policemen and plain-clothes agents in dark long gowns and fedoras carry out boxes of papers and a mimeograph machine while an elderly man with a white goatee, round spectacles and a long grey gown, the Democratic League's chairman Zhang Lan, stands upright in the doorway with a hand on his cane, a black sedan with its headlamps on, a policeman pulling the black double doors shut with a heavy lock, red lantern light, low angle. Shanghai, October 1947, 1940s police uniforms, no readable papers, no signboards.
- 改過的 Scene:A plain black lacquered double door set in a bare grey brick wall of a lane house in a Shanghai alley at dusk, the wall and door completely blank and unmarked: Nationalist policemen and plain-clothes agents in dark long gowns and fedoras carry out boxes of papers and a mimeograph machine while an elderly man with a white goatee, round spectacles and a long grey gown, the Democratic League's chairman Zhang Lan, stands upright in the doorway with a hand on his cane, a black sedan with its headlamps on, a policeman pulling the black double doors shut with a heavy lock, the only light a single street lamp and the sedan's headlamps, low angle. Shanghai, October 1947, 1940s police uniforms, no readable papers, no door plates, no plaques, no signboards, no lanterns, no posters, nothing hanging on the wall or door.
- 4 張候選裡那個毛病還在不在:沒有了:4 張候選的門與牆都是空白,沒有門牌、匾額、招牌;候選 3 有一盞沒有字的壁燈;候選 1 的警察領章上有很小的像字筆畫(待確認)

### 64 新政協

- 為什麼這樣改:紅旗上有黃星,#19 換三次種子都有;要沒有任何帶星的旗
- 原來的 Scene:A grand hall in Beiping lit in warm red: Mao Zedong, a stocky man with a broad round face, a high forehead and thick black hair combed straight back, in a grey tunic, stands at a podium with his hand raised, hundreds of delegates in rows before him, among them a Tibetan lama in maroon robes, a Mongol in a long robe, a Hui man in a white cap, women in cadre uniforms, scholars in suits and long gowns, plain red cloth banners with no star and no writing and red lanterns along the walls, low-angle view. Beiping, September 1949, no readable banners, no signboards, no soldiers.
- 改過的 Scene:A grand hall in Beiping lit in warm red for the opening of the Political Consultative Conference: Mao Zedong, a stocky man with a broad round face, a high forehead and thick black hair combed straight back, in a grey tunic, stands at a podium with his hand raised, hundreds of delegates in rows before him, among them a Tibetan lama in maroon robes, a Mongol in a long robe, a Hui man in a white cap, women in cadre uniforms, scholars in suits and long gowns, the whole stage and wall hung with plain deep-red velvet curtains and rows of round red paper lanterns, low-angle view. Beiping, September 1949, no flags of any kind, no banners, no emblems, no stars, no signboards, no soldiers.
- 4 張候選裡那個毛病還在不在:沒有了:4 張候選都沒有帶星的旗(候選 2 左邊仍畫了一面素面紅旗,沒有星;其餘沒有旗),改用紅絲絨帷幕與紅燈籠

### 67 史達林的建議

- 為什麼這樣改:prompt 是米高揚來見中共領導人,圖上三個人都是中國人;要認得出其中一位是蘇聯來的歐洲人
- 原來的 Scene:A plain village house at Xibaipo in snow: Mao Zedong, a stocky round-faced man with thick black hair combed back and a cotton jacket, with Liu Shaoqi, Zhou Enlai and Zhu De beside him, sits with the Soviet visitor Anastas Mikoyan, a stout dark-haired man with a heavy grey moustache in a dark Western suit and overcoat, around a rough wooden table with a map and tea cups, a coal stove glowing in the corner, small paned windows with snow outside, heavy cigarette smoke in a lamp's glow. Xibaipo, Hebei, early 1949, no readable writing on the map.
- 改過的 Scene:A plain village house at Xibaipo in snow: four Chinese leaders in plain padded grey-blue cotton jackets, Mao Zedong, a stocky round-faced man with thick black hair combed back, Liu Shaoqi, Zhou Enlai and Zhu De, sit on one side of a rough wooden table with a map and tea cups, facing the Soviet visitor Anastas Mikoyan on the other side, plainly a European: a stout, pale-skinned man with a heavy black moustache, a large nose, thick dark eyebrows and receding dark hair, in a dark Western suit and tie with a heavy long dark overcoat with a fur collar, a fur hat on the table beside him, a coal stove glowing in the corner, small paned windows with snow outside, heavy cigarette smoke in a lamp's glow. Xibaipo, Hebei, early 1949, no readable writing on the map.
- 4 張候選裡那個毛病還在不在:沒有了:4 張候選都認得出其中一位是歐洲人(濃黑八字鬍、毛皮領西裝大衣、毛皮帽);但中國領導人只有 3 位(候選 4 只有 2 位且在戶外),prompt 寫的是 4 位
