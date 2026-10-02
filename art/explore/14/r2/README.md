# 牌圖風格探索,第二輪 (#14)

owner 退回第一輪:「共軍要有共軍的風格 / 國軍要有國軍的風格 / 其他,可以偏真實的風格 / 每個設計3種不同的風格 / 圖中可以有字,可以有相似的真人,可以有旗幟」。
所以:三個陣營各三種風格,每個陣營的兩張牌各用它那三種畫一次 = 18 張,768 x 1024,JPEG q88。第一輪的檔案在上一層,沒動。
模型與取樣設定與第一輪相同(owner 的 Qwen Image 2.1 workflow;只換 prompt / seed / 尺寸 / 檔名前綴 `civil_war_14_r2_`)。

## 九種風格(固定文字,逐字放在 prompt 最前面,同陣營的兩張牌共用)

國軍
- `nat_calendar`:A 1940s Shanghai calendar-poster (yuefenpai) lithograph, soft pastel colours in smooth airbrushed gouache, gentle gradients, delicate fine outlines, polished idealised figures, warm rosy tones, an ornamental frame border with floral corner motifs, glossy commercial print finish.
- `nat_poster`:A 1940s Republic of China government propaganda poster, flat bold graphic design in blue, white and red, the national flag of the Republic of China (red field with a blue canton bearing a white twelve-rayed sun) prominent, strong clean geometric shapes, a large bold traditional Chinese headline in heavy lettering across the top.
- `nat_pictorial`:A page from a 1940s Chinese pictorial news magazine, cream newsprint, a coarse halftone-printed black-and-white photograph with a thin black border, a bold traditional Chinese headline in large type above it and a small caption line below, thin ruled lines, slightly yellowed paper.

共軍
- `com_woodcut`:A 1940s Yan'an revolutionary woodcut print in the Lu Xun Art Academy manner, bold black and white knife-cut lines, thick contours, strong contrast, simplified powerful shapes, rough hand-printed paper, a plain red flag as the only touch of red.
- `com_poster`:A 1940s liberated-area propaganda poster in the New Year print manner, flat saturated red and yellow colours, thick black outlines, simple folk-art figures, a plain red flag, a dominant red background, a bold slogan in large traditional Chinese characters.
- `com_oil`:A heavy realist revolutionary history oil painting, thick impasto brushwork, dramatic warm light with deep reds and earth browns, monumental composition, determined figures, a plain red flag in the wind, visible canvas texture.

其他(偏真實)
- `real_press`:A yellowed 1940s black-and-white press photograph, silver gelatin print, heavy film grain, low contrast, scratches and dust, vignetted corners, candid documentary composition.
- `real_color`:A hand-coloured 1940s photograph, a black-and-white photo with soft translucent hand-tinted colours, muted pastel tones, slightly faded, fine grain, early colour print look.
- `real_film`:A cinematic film still from a 1940s-period drama shot on 35mm, realistic natural lighting, shallow depth of field, rich natural colours, subtle film grain, wide anamorphic-style framing.

完整 prompt = 風格段 + ` Scene: <畫什麼>. ` + (該圖要寫的字,逐字引號) + 年代備註 + 結尾句。
有字的圖,結尾句是「Any writing in the picture is only the quoted Chinese, written correctly in traditional characters, and there is no other writing anywhere.」;沒有字的圖(`com_oil`、`real_film` 的重慶)是「No text anywhere in the picture.」
`spec.json` 是來源,`prompts.json` 是每張實際送出的 prompt 與 seed;`workflow_api.json` 是送給 ComfyUI 的 API 格式(內容是第一筆的 prompt / seed;與 owner 的 workflow 的差別同第一輪:`ResolutionSelector` 換成 `EmptyLatentImage` 直接填 768 x 1024)。

## 重現一張

```
cd art/explore/14/r2
node repro.mjs hu_takes_yanan__nat_pictorial   # 只讀 prompts.json,出圖、轉 JPEG、和交付的那張比
```
整批:`node generate.mjs`(已有的 JPEG 跳過,`FORCE=1` 重出單張:`FORCE=1 node generate.mjs <key>`)。contact sheet:`python contact_sheet.py`。
已實測 `hu_takes_yanan__nat_pictorial`:與交付的逐像素相同(平均差 0)。

## 字(模型寫對與寫不對)

- 短而明確的正體字,在「有框的位置」(標題牌、報頭、招牌、橫幅)寫得很穩;prompt 要把字逐字放進引號裡。
- 第一次出圖的缺陷與處理:`airlift__nat_poster` 的「員」被寫成簡體(改標題成「美機空運」重出);兩張畫報頁的說明小字是亂碼(prompt 裡明寫說明文字後重出,都寫對了);`dabie_march__com_woodcut` 紅旗上的「渡河」糊掉(改成白布旗、大黑字後重出);`inflation__real_color` 招牌是亂碼、鈔票像美元(改成明寫的價目牌,鈔票形容後重出)。
- 風險:紙幣上的字(金圓券)寫不對,所以鈔票只當成捆好的紙鈔,不要求上面有字;畫面裡很小的字(說明行)長度超過十個字就會開始壞。

## 旗幟

- 青天白日滿地紅:`nat_poster`、`nat_calendar`(要在 prompt 明寫「藍色角、白色十二道光的太陽,不是黃色五角星」,否則模型會畫成中華人民共和國旗;已重出)。
- 共軍:素色紅旗(1949 年以前沒有五星旗);`com_poster` 的第一版旗上有白色五角星,已重出為素色。

## 看法(決定是 owner 的)

- 國軍:`nat_poster` 一眼最認得出(國旗加粗體標題),縮成小牌也清楚;`nat_pictorial` 最像當年的報刊,有紙感,小圖時標題還可讀;`nat_calendar` 最柔、最「好看」,但看起來像民間月份牌,軍事感最弱。
- 共軍:`com_woodcut` 最有那個年代的味道,黑白加一塊紅,小圖清楚;`com_poster` 最醒目,但黃色軍服是畫法的產物(模型把「平塗」做成了黃衣),像事後的宣傳畫;`com_oil` 最有力,但那是「後來」的畫法,不是 1945 到 1949 當年的東西;沒有字,靠紅旗認陣營,是三種裡最不容易一眼判成共軍的。
- 其他:三種都穩;`real_film` 最好看,但最像「現代人拍的年代片」,不是當年的影像;`real_press` 最有史料感。
- 認真的限制:重慶談判兩位主角的臉模型沒有畫成「像」那兩個人(是穿中山裝與軍服的普通面孔);胡宗南也不像。「可以有像的真人」在這個模型上只做到服裝與場景,臉不行,要像要另外想辦法(例如參考圖的 workflow,那不是 owner 指定的這支)。
