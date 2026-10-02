# python contact_sheet.py -> contact-sheet.jpg : 10 rows x 3 columns, labels outside the pictures
import json, os
from PIL import Image, ImageDraw, ImageFont
d = os.path.dirname(os.path.abspath(__file__))
cards = json.load(open(os.path.join(d, 'prompts.json'), encoding='utf8'))['cards']
cols = [('qwen', 'A: Qwen Image 2.1', '25 steps'), ('zimage8', 'B: Z-Image Turbo, 8 steps', ''), ('zimage20', 'C: Z-Image Turbo, 20 steps', '')]
W, H, G, LW, TOP, CAP = 336, 448, 14, 250, 70, 0
F = lambda s: ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', s)
big, mid, small = F(34), F(22), F(18)
sheet = Image.new('RGB', (LW + 3 * (W + G) + G, TOP + len(cards) * (H + G) + G), (255, 255, 255))
dr = ImageDraw.Draw(sheet)
for j, (k, label, _) in enumerate(cols):
    x = LW + G + j * (W + G)
    dr.text((x, 16), label, fill=(0, 0, 0), font=mid)
for i, c in enumerate(cards):
    y = TOP + i * (H + G) + G
    dr.text((14, y + 4), str(i + 1), fill=(0, 0, 0), font=big)
    dr.text((14, y + 56), c['key'], fill=(30, 30, 30), font=small)
    dr.text((14, y + 82), c['zh'], fill=(30, 30, 30), font=mid)
    dr.text((14, y + 114), c['style'], fill=(110, 110, 110), font=small)
    for j, (k, _, _) in enumerate(cols):
        im = Image.open(os.path.join(d, f"{c['key']}__{k}.jpg")).convert('RGB').resize((W, H), Image.LANCZOS)
        sheet.paste(im, (LW + G + j * (W + G), y))
sheet.save(os.path.join(d, 'contact-sheet.jpg'), quality=88)
print(sheet.size)
