"""python contact_sheet.py  ->  contact-sheet.jpg (6 rows = cards, 3 columns = styles; labels in English)."""
import json, os
from PIL import Image, ImageDraw, ImageFont
d = os.path.dirname(os.path.abspath(__file__))
spec = json.load(open(os.path.join(d, 'spec.json'), encoding='utf8'))
cards, styles = list(spec['cards']), list(spec['styles'])
TW, TH, LW, HH, G = 384, 512, 200, 40, 6
try: f = ImageFont.truetype('arial.ttf', 20)
except Exception: f = ImageFont.load_default()
sheet = Image.new('RGB', (LW + 3 * (TW + G), HH + 6 * (TH + G)), (255, 255, 255))
dr = ImageDraw.Draw(sheet)
for j, s in enumerate(styles): dr.text((LW + j * (TW + G) + 10, 10), s, fill=(0, 0, 0), font=f)
for i, c in enumerate(cards):
    y = HH + i * (TH + G)
    dr.text((8, y + TH // 2 - 10), c, fill=(0, 0, 0), font=f)
    for j, s in enumerate(styles):
        im = Image.open(os.path.join(d, f'{c}__{s}.jpg')).resize((TW, TH), Image.LANCZOS)
        sheet.paste(im, (LW + j * (TW + G), y))
sheet.save(os.path.join(d, 'contact-sheet.jpg'), quality=88)
print(sheet.size)
