# Draws one side-by-side sheet (4 cards x 3 rows) from a jobs file made by pairs.mjs (do not run by hand: node art/cards/pairs.mjs).
# Left = A = Qwen Image 2.1, right = B = Z-Image Turbo, always. Nothing is drawn on the pictures themselves.
import json, sys
from PIL import Image, ImageDraw, ImageFont
jobs = json.load(open(sys.argv[1], encoding='utf8')); out = sys.argv[2]
F = lambda s: ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', s)
FB = lambda s: ImageFont.truetype('C:/Windows/Fonts/msjhbd.ttc', s)
title, big, mid, small = FB(34), FB(46), F(30), F(26)
COLS, ROWS, W, H, G, GAP = 4, 3, 360, 480, 30, 12
CW = 2 * W + GAP
HEAD, TAG, LAB, DEF = 70, 64, 66, 40
CH = TAG + H + LAB + DEF
ROWS = (len(jobs) + COLS - 1) // COLS
sheet = Image.new('RGB', (G + COLS * (CW + G), HEAD + G + ROWS * (CH + G)), (255, 255, 255))
d = ImageDraw.Draw(sheet)
d.text((G, 16), 'A = Qwen Image 2.1     B = Z-Image Turbo', fill=(0, 0, 0), font=title)
RED = (200, 0, 0)
for i, j in enumerate(jobs):
    x = G + (i % COLS) * (CW + G); y = HEAD + G + (i // COLS) * (CH + G)
    for k, (tag, name, f, bad) in enumerate((('A', 'Qwen', j['a'], j['abad']), ('B', 'Z-Image', j['b'], j['bbad']))):
        xx = x + k * (W + GAP)
        d.text((xx, y), tag, fill=(0, 0, 0), font=big)
        d.text((xx + 52, y + 12), name, fill=(90, 90, 90), font=small)
        sheet.paste(Image.open(f).convert('RGB').resize((W, H), Image.LANCZOS), (xx, y + TAG))
        if bad:
            d.text((xx, y + TAG + H + LAB + 4), ' '.join(bad), fill=RED, font=mid)
    ly = y + TAG + H + 6
    d.text((x, ly), j['num'], fill=(0, 0, 0), font=big)
    if j['zh'] != j['num']: d.text((x + d.textlength(j['num'], font=big) + 16, ly + 12), j['zh'], fill=(20, 20, 20), font=mid)
sheet.save(out, quality=88)
print(out, sheet.size)
