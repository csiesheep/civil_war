# 10 張牌 × 兩個模型(#17)

owner:「先產生10張卡,用qwen image 和 z image 各產生一張」。同一段 prompt、同一個 seed、768 × 1024,只換模型。Z-Image 的步數有兩個說法(owner 存的 workflow 是 20 步,他的 MCP 工具預設 8 步),所以 Z-Image 出了兩欄:一共 30 張,每張牌每個設定一張,沒有挑、沒有重出、沒有換 seed。

**對照表:`contact-sheet.jpg`**(10 列、3 欄,欄名在圖外面):

| 欄 | 設定 | 檔名 |
|---|---|---|
| A | Qwen Image 2.1,25 步 | `<牌 id>__qwen.jpg` |
| B | Z-Image Turbo,8 步 | `<牌 id>__zimage8.jpg` |
| C | Z-Image Turbo,20 步 | `<牌 id>__zimage20.jpg` |

列(順序固定):1 airlift 美軍空運、2 hu_takes_yanan 胡宗南佔延安、3 return_to_nanjing 還都南京、4 chiang_steps_down 蔣下野、5 into_manchuria 闖關東、6 dabie_march 挺進大別山、7 land_law 土地法大綱(無士兵版)、8 liaoshen_campaign 遼瀋戰役、9 chongqing_talks 重慶談判、10 inflation 通貨膨脹。

prompt 是 #16 的那 10 則(原樣,會放進 `art/cards/prompts.json`;種子是它在那邊的序號 + 16000)。`prompts.json` 有 `models`(三個設定的參數)與 `cards`(10 筆)。

## 參數

| | A Qwen | B Z-Image 8 | C Z-Image 20 |
|---|---|---|---|
| 伺服器 | 127.0.0.1:8188 | 127.0.0.1:8188 | 127.0.0.1:8188 |
| workflow | `workflow_api_qwen.json`(= `art/explore/14/r3/workflow_api.json`,只換 prompt、seed、尺寸、檔名前綴) | `workflow_api_zimage.json`(照 owner 的 `image_z_image_turbo.json` 子圖組出來,原檔沒動) | 同左 |
| 模型 | qwen-image-2.1-UC-Q8_0.gguf | z_image_turbo_bf16.safetensors,`ModelSamplingAuraFlow` shift 3,文字編碼 qwen_3_4b(lumina2),vae ae.safetensors | 同左 |
| 取樣 | 25 步、cfg 1、euler / simple | 8 步、cfg 1、res_multistep / simple | 20 步,其餘同 B |
| 負向 | 空字串 | `ConditioningZeroOut` | 同左 |
| 檔名前綴 | `civil_war_17_qwen_` | `civil_war_17_z8_` | `civil_war_17_z20_` |
| 每張秒數 | 約 26(第一張 35,含載入模型) | 約 14 到 15(第一張 18) | 約 29 到 30 |

每張的實際秒數在 `timings.json`(從送出到取得圖,不含轉 JPEG)。順序是 10 張 Qwen,再 10 張 Z-Image 8 步,再 10 張 Z-Image 20 步;沒有任何一張失敗或重跑。

## 怎麼重現一張

```
cd art/explore/17
REPRO=1 node gen.mjs qwen land_law       # 或 zimage8 / zimage20 ; 只讀 prompts.json、兩個 workflow json
```
它出到 `repro_<牌>__<設定>.jpg`,並印出與交付那張的差。三個設定我都用 `land_law` 重現過:平均差 0、bbox None,逐像素相同。整批:`node gen.mjs`(已有的跳過)。對照表:`python contact_sheet.py`。

## 檢查清單(30 列,我逐張打開看的)

「字」= 圖裡有沒有字(prompt 要求沒有)。「邊」= 有沒有框或紙邊。「風格」= 像不像 owner 挑的那種。「畫面」= 是不是那張牌、有沒有畫錯的東西。

| # | 牌 | 設定 | 字 | 邊 | 風格 | 畫面是不是那張牌、畫錯了什麼 | 秒 |
|---|---|---|---|---|---|---|---|
| 1 | airlift | A Qwen | 無 | 無 | 像月份牌:低角度、大人物、很重的藍與金,比較像油畫 | 是。橄欖綠 C-47,沒漆成國旗;但機徽是藍底紅五角星(不是白日) | 35 |
| 1 | airlift | B Z8 | 無字,但紙邊下方有看不清的小印刷字 | 有:米白紙邊(四邊約 12 像素以上) | 像月份牌平塗海報 | 是。機徽是美國的白星藍底(錯);機身橄欖綠 | 18 |
| 1 | airlift | C Z20 | 同 B | 有 | 同 B | 同 B(機徽美國白星) | 30 |
| 2 | hu_takes_yanan | A | 無 | 無 | 像,最有油畫的重量,天藍與黃土 | 是。旗對(藍角白日紅地)、寶塔、騎馬將領、殘雪;軍服卡其 | 27 |
| 2 | hu_takes_yanan | B | 紙邊下有小字 | 有:米白紙邊 | 像月份牌(扁平、鮮豔),人物不是低角度近景 | 是。旗對;軍服是灰藍色 | 15 |
| 2 | hu_takes_yanan | C | 同 B | 有 | 同 B | 同 B | 30 |
| 3 | return_to_nanjing | A | 無 | 無 | 像,低角度 | 是。蔣與宋美齡走下石階,群眾拿的是青天白日旗(對);牌樓不是中山陵的大台階全景 | 26 |
| 3 | return_to_nanjing | B | 紙邊下有小字 | 有 | 像月份牌 | 是,中山陵藍瓦屋頂更像。但群眾的旗是紅底黃星(中共五星旗,錯)、軍服深藍 | 16 |
| 3 | return_to_nanjing | C | 同 B | 有 | 同 B | 同 B(旗錯) | 30 |
| 4 | chiang_steps_down | A | 無 | 無 | 像,深藍與紅梅,偏版畫 | 是。長袍、禮帽拿在手上、溪邊石徑、老屋、隨從;不太像蔣的臉 | 26 |
| 4 | chiang_steps_down | B | 紙邊下有小字 | 有 | 像月份牌 | 場景對(松、紅梅、溪、白牆老屋、提皮箱的隨從);穿的是立領中山裝,不是長袍,臉像毛澤東 | 15 |
| 4 | chiang_steps_down | C | 同 B | 有 | 同 B | 同 B | 29 |
| 5 | into_manchuria | A | 無 | 無 | 像,紅天、油畫筆觸,最沉 | 是。山海關、長城、海、素面紅旗(對)、騾車;人物卡其與灰 | 26 |
| 5 | into_manchuria | B | 關門上方有一塊有字的匾(字是亂的) | 無 | 像,色塊更平更亮 | 是。但紅旗左上有黃色星(錯);前景多了一門砲 | 15 |
| 5 | into_manchuria | C | 同 B | 無 | 同 B | 同 B | 30 |
| 6 | dabie_march | A | 無 | 無 | 像,紅天、泥黃河水 | 是。涉水、槍舉過頭、騾子;旗素面紅(對) | 26 |
| 6 | dabie_march | B | 無 | 無 | 像,色彩更清楚 | 是。涉水、馬(不是騾)駝背包;旗角有小黃星(錯);天空是紅,山是綠 | 14 |
| 6 | dabie_march | C | 無 | 無 | 同 B | 同 B | 30 |
| 7 | land_law | A | 無 | 無 | 像,最像蘇式油畫 | 是。釘木樁、老農捧土、紅旗素面、金穀田 | 26 |
| 7 | land_law | B | 無 | 無 | 像,更扁平明亮 | 是。拉繩丈量、穿灰上衣的幹部、土房、素面紅旗(對) | 14 |
| 7 | land_law | C | 無 | 無 | 同 B | 同 B | 29 |
| 8 | liaoshen_campaign | A | 無 | 無 | 像,最暗最重 | 是。雲梯上城牆缺口、砲口火光;旗是紅底黃星(錯) | 26 |
| 8 | liaoshen_campaign | B | 無 | 無 | 像,更鮮豔 | 是。旗是紅底黃星(錯);士兵戴鋼盔 | 14 |
| 8 | liaoshen_campaign | C | 無 | 無 | 同 B | 是。旗上有鐮刀錘子狀的黃色圖案(錯) | 29 |
| 9 | chongqing_talks | A | 無 | 無 | 像電影劇照,暗、粗顆粒、記者閃光燈多 | 是。白遮陽帽、握手、銀色 C-47、群山;機徽紅黃藍圈(不是青天白日) | 26 |
| 9 | chongqing_talks | B | 無 | 無 | 像,更亮更乾淨,比較像現代攝影 | 是。白遮陽帽、握手、銀色飛機、群山;尾翼有紅白條 | 14 |
| 9 | chongqing_talks | C | 無 | 無 | 同 B | 同 B | 29 |
| 10 | inflation | A | 無(沒有招牌) | 無 | 像電影劇照,暖色 | 是。人龍、獨輪車上一捆捆鈔票、大麻袋;鈔票像美鈔的綠黃色 | 26 |
| 10 | inflation | B | **有**:兩塊店招有漢字(亂碼);prompt 明說沒有招牌 | **有**:上下各一條白邊(約 130 像素) | 像電影劇照 | 是。獨輪車鈔票、背麻袋、人龍;但畫面被白邊壓成橫幅 | 14 |
| 10 | inflation | C | 同 B(店招漢字) | 有 | 同 B | 同 B | 29 |

## 觀察(不下結論,哪個好是 owner 的)

- **字與邊**:Z-Image 在 5 張(airlift、hu_takes_yanan、return_to_nanjing、chiang_steps_down 的 B 與 C,以及 inflation 上下白邊)畫出米白色的紙邊或白條,國軍四張紙邊下方有看不清的小印刷字;inflation 有兩塊有漢字的店招;into_manchuria 的關門有一塊字匾。結尾那一段(no border, no frame, no lettering)對 Z-Image 沒有擋住這些,對 Qwen 十張都擋住了:Qwen 十張沒有字、沒有邊。
- **風格**:兩個模型都做出了三種氣氛。Qwen 的月份牌是低角度近景、厚塗、深色;Z-Image 的月份牌更像平塗的印刷海報,人物比較小、顏色更亮。共軍的紅天兩邊都有。Z-Image 的電影劇照比較像現代攝影,Qwen 的比較像老膠卷。
- **事實**:兩個模型都沒有穩定畫對旗與機徽。Qwen:C-47 機徽是紅星、重慶機徽是紅黃藍圈,遼瀋的旗有黃星。Z-Image:C-47 是美國白星,還都南京的旗是五星旗,闖關東、大別山、遼瀋的紅旗有黃星或鐮錘;Z-Image 的國軍軍服偏灰藍、Qwen 偏卡其。人物像不像:兩邊都不像真人;Z-Image 的蔣下野像毛澤東。
- **8 步 vs 20 步**:同一個 seed 的構圖幾乎一樣(同一個人物、同一個位置);20 步在細節與邊緣上多一點點,沒有解決紙邊、字與旗的問題。20 步慢一倍(約 30 對 15 秒)。
- **時間**:Qwen 約 26 秒一張,Z-Image 8 步約 15 秒,20 步約 30 秒(同一台機器、768 × 1024,模型載入後)。

## 我沒有驗到的

- 只出了每個設定每張牌一張(一個 seed),不能說模型「一般」會怎樣;換 seed 紙邊與旗的錯誤會不會出現,我沒試(也不該試:brief 不讓換)。
- 沒有逐像素檢查每張的邊;邊的數字是用四邊 12 像素帶的平均亮度量的,白紙邊的判斷再加上我自己打開看。字我用眼睛看 768 × 1024 的原圖與放大的下緣,小到看不清的字可能漏掉,Qwen 那邊也一樣。
- 臉像不像真人沒有比對照片。
- 沒有量記憶體:兩個模型是分開跑的(先 Qwen,後 Z-Image),沒有發生記憶體不足。
