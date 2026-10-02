# Draws one contact sheet (5 cards, one row per card, candidates 1-4 left to right) from a jobs file made by redo-sheets.mjs (do not run by hand: node art/cards/redo-sheets.mjs).
# Nothing is drawn on the pictures themselves.
import json, sys
from PIL import Image, ImageDraw, ImageFont
jobs = json.load(open(sys.argv[1], encoding='utf8')); out = sys.argv[2]
F = lambda s: ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', s)
FB = lambda s: ImageFont.truetype('C:/Windows/Fonts/msjhbd.ttc', s)
title, big, mid, small = FB(30), FB(46), F(26), F(24)
W, H, G, GAP, LABW = 360, 480, 28, 12, 230
TAG, DEF = 62, 70
RH = TAG + H + DEF
HEAD = 70
SW = G + LABW + 4 * (W + GAP) + G
sheet = Image.new('RGB', (SW, HEAD + len(jobs) * (RH + G) + G), (255, 255, 255))
d = ImageDraw.Draw(sheet)
d.text((G, 16), '回話的寫法:11-2 = 第 11 張用候選 2;11-X = 四張都不要', fill=(0, 0, 0), font=title)
RED = (200, 0, 0)
def wrap(text, font, width):
    lines, cur = [], ''
    for ch in text:
        if d.textlength(cur + ch, font=font) > width and cur: lines.append(cur); cur = ch
        else: cur += ch
    return lines + ([cur] if cur else [])
for i, j in enumerate(jobs):
    y = HEAD + G + i * (RH + G)
    d.text((G, y), j['num'], fill=(0, 0, 0), font=big)
    ty = y + 64
    for ln in wrap(j['zh'], mid, LABW - 10): d.text((G, ty), ln, fill=(20, 20, 20), font=mid); ty += 34
    if j['rewritten']: d.text((G, ty + 6), '畫面改過', fill=(0, 90, 180), font=mid)
    for k, c in enumerate(j['cand']):
        x = G + LABW + k * (W + GAP)
        d.text((x, y), str(c['c']), fill=(0, 0, 0), font=big)
        d.text((x + 44, y + 14), c['modelname'], fill=(90, 90, 90), font=small)
        sheet.paste(Image.open(c['file']).convert('RGB').resize((W, H), Image.LANCZOS), (x, y + TAG))
        if c['bad']: d.text((x, y + TAG + H + 6), ' '.join(c['bad']), fill=RED, font=mid)
sheet.save(out, quality=88)
print(out, sheet.size)
