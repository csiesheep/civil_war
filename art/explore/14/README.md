# 牌圖風格探索 (#14)

6 張牌 x 3 種風格 = 18 張,768 x 1024,JPEG q88。比較用:`contact-sheet.jpg`(列 = 牌,欄 = 風格)。
這是探索,不在 `public/` 底下,不會部署。模型:Qwen Image 2.1 UC Q8 GGUF,owner 的 `qwen_image_2_1_UC_t2i_gguf.json`(25 步、cfg 1、euler / simple,fixed seed)。

## 三種風格的固定文字(六張牌逐字共用,放在 prompt 最前面)

- `woodcut`:A 1940s Chinese woodcut print, bold black ink carved with a knife on cream paper, thick black outlines, strong hatching and cross-hatching, large flat areas of solid black, one single accent colour of vermilion red used sparingly, rough hand-printed texture, graphic and high contrast.
- `photo`:A faded 1940s black-and-white press photograph, silver gelatin print gone yellow-brown, heavy film grain, soft focus, low contrast, small scratches and dust, vignetted corners, candid documentary composition shot on a medium-format camera.
- `inkwash`:A Chinese ink wash painting on pale warm rice paper, sparse composition with generous empty space, wet gradients of black ink with light touches of grey-blue and ochre, loose confident brushwork, soft edges.

完整 prompt = 風格段 + ` Scene: <畫什麼>. <年代備註> ` + `No text, no characters, no seals, no calligraphy, no writing anywhere.`
(`spec.json` 是來源,`prompts.json` 是展開後每張實際送出的那一份。)

## 檔案

- `<card id>__<style>.jpg` 18 張;`contact-sheet.jpg`;`prompts.json`(key / card / style / w / h / seed / prompt)
- `workflow_api.json`:送給 ComfyUI 的 API 格式(內容是 `airlift__woodcut` 的 prompt / seed)。與 owner 的 workflow 的差別:`ResolutionSelector` 拿掉,`EmptyLatentImage` 直接填 768 x 1024;`SaveImageAdvanced` 前綴 `civil_war_14_<key>`;其餘模型與取樣設定原樣。`TextEncodeQwenImage21` 的 negative_prompt 空白(cfg 1 時本來就不起作用),沒有參考圖。
- `generate.mjs`(批次,可續跑:已有的 JPEG 跳過;`FORCE=1` 重出)、`contact_sheet.py`、`repro.mjs`

## 重現一張

```
cd art/explore/14
node repro.mjs dabie_march__photo     # 只讀 prompts.json,出圖、轉 JPEG q88、和交付的比較
```
需要 ComfyUI 在 127.0.0.1:8188、Node、Python + Pillow。整批:`node generate.mjs`(單張:`FORCE=1 node generate.mjs <key>`)。
`dabie_march__photo` 已實測:重出的 JPEG 與交付的逐像素相同(平均差 0)。

## 看法(決定是 owner 的)

- **小圖上最清楚:`woodcut`**(粗黑線、黑白對比大,縮到 100 px 寬仍認得出飛機、火車、船);`inkwash` 次之但淺,airlift 與 manchuria 很清楚,chongqing 的桌椅在小圖會糊成一片灰;`photo` 最弱,整張偏暗褐,人物與背景擠成一團(dabie_march、chongqing)。
- **模型出得最穩:`photo`**:六張都像一組,沒有任何字或怪形。`woodcut` 與 `inkwash` 也一致,但有下列風險。
- 風險:
  - `woodcut` 的「一個點綴色」模型不照辦:沒有硃紅,黃土高原那張(hu_takes_yanan)整張刷成土黃,inflation 的大包袱也是土黃,與其他四張純黑白不齊。要純黑白或要紅色,得在風格段改寫並重出。
  - `inkwash` 其實更接近水彩淡彩,不太像傳統水墨;hu_takes_yanan 的黃色很重。與《縱橫》的牌圖同一類,但比它濃。
  - 有鈔票、招牌、橫幅的題材一律有亂碼字風險(inflation 第一輪的木刻與照片都長出字形,所以第二版 prompt 改成鈔票整包包起來、店面沒有招牌)。
  - `photo` 容易冒出像是真實歷史照片的人群,做 72 張時要留意不要出現認得出的臉(這 6 張的臉都是無名的)。
