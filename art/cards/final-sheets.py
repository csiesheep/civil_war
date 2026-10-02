# Draws the three final contact sheets from a jobs file made by final-sheets.mjs (do not run by hand: node art/cards/final-sheets.mjs).
import json, sys
from PIL import Image, ImageDraw, ImageFont
jobs = json.load(open(sys.argv[1], encoding='utf8')); out = sys.argv[2]
F = lambda s: ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', s)
big, mid, small = F(40), F(28), F(20)
COLS, W, H, G, LAB = 6, 288, 384, 18, 92
rows = (len(jobs) + COLS - 1) // COLS
sheet = Image.new('RGB', (G + COLS * (W + G), G + rows * (H + LAB + G)), (255, 255, 255))
d = ImageDraw.Draw(sheet)
for i, j in enumerate(jobs):
    x = G + (i % COLS) * (W + G); y = G + (i // COLS) * (H + LAB + G)
    sheet.paste(Image.open(j['file']).convert('RGB').resize((W, H), Image.LANCZOS), (x, y))
    d.text((x, y + H + 4), j['num'], fill=(0, 0, 0), font=big)
    nx = x + d.textlength(j['num'], font=big)
    d.text((nx + 14, y + H + 14), j['zh'], fill=(20, 20, 20), font=mid)
    if j['bad']:
        d.text((x, y + H + 62), '還有硬傷', fill=(200, 0, 0), font=small)
sheet.save(out, quality=88)
print(out, sheet.size)
