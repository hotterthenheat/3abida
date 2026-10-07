# a before | after sheet of named captures: python3 pairsheet.py out.jpg title "label:before.png:after.png" ...
import sys
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
FB = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
BG = (28, 28, 32); INK = (230, 230, 234); MUT = (150, 150, 158)
out, title, rows = sys.argv[1], sys.argv[2], [r.split(':') for r in sys.argv[3:]]
TW = int(sys.argv[0] and 600)
ims = [(l, Image.open(a).convert('RGB'), Image.open(b).convert('RGB')) for l, a, b in rows]
def fit(im):
    w = TW if im.width > im.height else int(TW * 0.5)
    return im.resize((w, int(im.height * w / im.width)), Image.LANCZOS)
ims = [(l, fit(a), fit(b)) for l, a, b in ims]
W = 16 + 2 * (TW + 16)
H = 56 + sum(max(a.height, b.height) + 34 for _, a, b in ims) + 8
S = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(S)
d.text((16, 14), title, font=FB, fill=INK)
y = 56
for l, a, b in ims:
    d.text((16, y), f'{l} · before', font=F, fill=MUT); d.text((32 + TW, y), f'{l} · after', font=F, fill=MUT)
    S.paste(a, (16, y + 24)); S.paste(b, (32 + TW, y + 24))
    y += max(a.height, b.height) + 34
S.save(out, quality=86)
print(out, S.size)
