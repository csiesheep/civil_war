# Draws final contact sheets (one per side) from a jobs file made by final-sheets.mjs (do not run by hand: node art/cards/final-sheets.mjs).
# Each card is shown once with its final image from final/*.jpg
import json, sys
from PIL import Image, ImageDraw, ImageFont
jobs = json.load(open(sys.argv[1], encoding='utf8')); out = sys.argv[2]
F = lambda s: ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', s)
FB = lambda s: ImageFont.truetype('C:/Windows/Fonts/msjhbd.ttc', s)
title, big, small = FB(30), FB(46), F(24)
W, H, G, GAP, LABW = 360, 480, 28, 12, 230
TAG, LABH = 62, 70
RH = TAG + H + LABH
HEAD = 70
SW = G + LABW + (W + GAP) + G
sheet = Image.new('RGB', (SW, HEAD + sum(len(page) for page in jobs) * (RH + G) + G), (255, 255, 255))
d = ImageDraw.Draw(sheet)
d.text((G, 16), '定案的 74 張(#22)', fill=(0, 0, 0), font=title)

row_num = 0
for page_idx, page in enumerate(jobs):
    for card_idx, c in enumerate(page):
        y = HEAD + G + row_num * (RH + G)
        d.text((G, y), str(c['num']), fill=(0, 0, 0), font=big)
        d.text((G, y + 50), c['zh'], fill=(20, 20, 20), font=big)
        d.text((G, y + 10), c['modelname'], fill=(90, 90, 90), font=small)
        x = G + LABW
        sheet.paste(Image.open(c['file']).convert('RGB').resize((W, H), Image.LANCZOS), (x, y + TAG))
        row_num += 1

sheet.save(out, quality=88)
print(out, sheet.size)
