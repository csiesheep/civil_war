"""python contact_sheet.py -> contact-sheet.jpg: three blocks (nat / com / other), each 2 rows (cards) x 3 columns (that faction's styles), style names on top."""
import json, os
from PIL import Image, ImageDraw, ImageFont
d = os.path.dirname(os.path.abspath(__file__))
spec = json.load(open(os.path.join(d, 'spec.json'), encoding='utf8'))
TW, TH, LW, HH, G = 384, 512, 200, 40, 6
try: f = ImageFont.truetype('arial.ttf', 20)
except Exception: f = ImageFont.load_default()
names = {'nat': 'NATIONALIST', 'com': 'COMMUNIST', 'other': 'NEUTRAL'}
rows = 0
for fac in spec['factions']: rows += 2
H = 3 * HH + rows * (TH + G) + 20
sheet = Image.new('RGB', (LW + 3 * (TW + G), H), (255, 255, 255))
dr = ImageDraw.Draw(sheet)
y = 0
for fac, styles in spec['factions'].items():
    dr.text((8, y + 10), names[fac], fill=(180, 0, 0), font=f)
    for j, s in enumerate(styles): dr.text((LW + j * (TW + G) + 10, y + 10), s, fill=(0, 0, 0), font=f)
    y += HH
    for c, cd in spec['cards'].items():
        if cd['faction'] != fac: continue
        dr.text((8, y + TH // 2 - 10), c, fill=(0, 0, 0), font=f)
        for j, s in enumerate(styles):
            im = Image.open(os.path.join(d, f'{c}__{s}.jpg')).resize((TW, TH), Image.LANCZOS)
            sheet.paste(im, (LW + j * (TW + G), y))
        y += TH + G
    y += 6
sheet.crop((0, 0, sheet.width, y)).save(os.path.join(d, 'contact-sheet.jpg'), quality=88)
print(sheet.size)
