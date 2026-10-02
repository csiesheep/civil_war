# 牌圖風格探索,第三輪 (#14)

owner 看過第二輪:「圖 不要有標題,不要有框 / 國軍 月份牌 風格,顏色鮮艷一點 / 共軍 紅色,社會主義宣傳畫風格 / 其他,電影劇照風格 / 每一個,再設計3格 不同的風格」。
所以:三個方向定了(國軍月份牌、共軍紅色宣傳畫、其他電影劇照),每個方向裡再做三種,每個陣營的兩張牌各畫一次 = 18 張,768 x 1024,JPEG q88,全圖鋪滿,沒有標題、沒有框。前兩輪的檔案沒動。
模型與取樣設定與前兩輪相同(owner 的 Qwen Image 2.1 workflow,只換 prompt / seed / 尺寸 / 檔名前綴 `civil_war_14_r3_`)。

## 九種風格(固定文字,逐字放在 prompt 最前面,同陣營兩張牌共用)

國軍,月份牌(三種都比第二輪鮮艷)
- `nat_bright`:A vivid 1940s Shanghai calendar-poster (yuefenpai) painting in bright saturated gouache and airbrush, clear sky blue, rich vermilion red, fresh leaf green and golden yellow, crisp smooth shading, polished idealised figures, glossy commercial lithograph look, a wide daylight composition.
- `nat_sunset`:A vivid 1940s calendar-poster painting at sunset, a glowing sky of saturated orange, magenta and gold with deep teal shadows, warm rim light on the figures, airbrushed gradients, rich glossy colour, bold contrast, romantic atmosphere.
- `nat_closeup`:A vivid 1940s calendar-poster painting in a low-angle close-up composition, large heroic figures filling most of the frame, deep cobalt blue and crimson red with bright white highlights, hard glossy airbrushed modelling, intense saturated colour, dramatic and polished.

共軍,紅色宣傳畫(紅色為主,軍裝是土灰與土黃)
- `com_oil`:A socialist-realist propaganda painting in the manner of a 1950s Soviet-style oil painting, a blazing red sky and red banners dominating the picture, heavy confident brushwork, monumental heroic composition, soldiers in earthy grey and khaki cotton uniforms, warm red light over everything.
- `com_flat`:A socialist propaganda poster in flat colour printing, a solid red background and large flat red shapes dominating, simple bold shapes with thick dark outlines, flat tones with no gradients, soldiers in grey and khaki cotton uniforms, folk-print simplicity, striking and graphic.
- `com_block`:A socialist propaganda poster in bold colour-block silhouette style, a huge red sun and red sky filling the upper picture, strong diagonal composition, figures as dark and grey silhouettes with simplified shapes, red and black with a little cream, constructivist graphic energy.

其他,電影劇照
- `real_bw`:A black-and-white film still from a 1940s studio drama, high-contrast chiaroscuro lighting, deep blacks, fine 35mm film grain, classic Hollywood-era composition, sharp focus on the subject.
- `real_tech`:A 1950s Technicolor epic film still, rich saturated three-strip colour, glowing warm highlights, theatrical lighting, wide cinematic framing, painterly cinematic polish.
- `real_modern`:A frame from a modern prestige historical drama shot on anamorphic lenses, desaturated teal and amber colour grade, shallow depth of field, natural practical lighting, subtle grain, realistic and moody.

完整 prompt = 風格段 + ` Scene: <畫什麼>. ` + 年代備註 + 結尾句。結尾句(所有圖相同):
「Full-bleed image that runs to all four edges of the canvas: no border, no frame, no margin, no white edge, no vignette, no title, no caption, no slogan, no signature, no lettering of any kind anywhere.」
`spec.json` 是來源,`prompts.json` 是每張實際送出的 prompt 與 seed(`inflation__real_modern` 重出過幾次,最後用的是 seed 34067);`workflow_api.json` 是送給 ComfyUI 的 API 格式(第一筆的 prompt / seed;與 owner 的 workflow 的差別同前兩輪:`ResolutionSelector` 換成 `EmptyLatentImage` 直接填 768 x 1024)。

## 重現一張

```
cd art/explore/14/r3
node repro.mjs dabie_march__com_block   # 只讀 prompts.json,出圖、轉 JPEG、和交付的那張比
```
整批:`node generate.mjs`(已有的 JPEG 跳過;重出單張:`FORCE=1 node generate.mjs <key>`)。contact sheet:`python contact_sheet.py`。
已實測 `dabie_march__com_block`:與交付的逐像素相同(平均差 0)。

## 沒有標題、沒有框

結尾句明寫 full-bleed、沒有邊框、紙邊、暗角、標題、標語、落款、任何字。模型照辦:18 張都鋪滿四邊,沒有排上去的字。用程式量了四邊 10 像素帶與往內 30 像素帶的亮度,沒有任何一張的邊像白邊或暗角。
場景裡的字:`inflation` 的第一版 `real_tech` 與 `real_modern` 有亂碼招牌;改成「店面沒有招牌」後 `real_tech` 乾淨,`real_modern` 又重出兩次(前一次仍有糊的招牌)才乾淨。最後 18 張沒有可讀的字。

## 看法(決定是 owner 的)

- 國軍:三種都明顯比第二輪鮮艷。`nat_bright` 最像真的月份牌(藍天、銀色機身,最清楚);`nat_sunset` 最戲劇,但逆光把人物壓成剪影,細節少;`nat_closeup` 人物最大、顏色最重,小圖最有力,但構圖擁擠。
- 共軍:三種都以紅為主,軍裝是土灰與土黃。`com_oil` 最像五十年代蘇式油畫,最有分量;`com_flat` 最像平塗印刷,但「紅底上開一個白洞」的構圖讓雪地像剪下來的紙(闖關東尤其明顯),是三種裡最需要 owner 看一眼的;`com_block` 紅日加剪影,最像海報,也最好認。
- 其他:`real_bw` 最像老電影,但偏暗;`real_tech` 最亮、顏色最暖;`real_modern` 最陰沉。三種都像從電影裡截下的一格。
- 共同的限制:像的臉做不到(重慶談判的人物是穿中山裝的普通臉);鈔票是成捆紙鈔,沒有可讀的字。
