# the rooms stage's own done-check: every stop (every STEP svh), held 1.5 s, one sheet per run
import sys, glob, json
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
FB = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
BG = (28, 28, 32); INK = (230, 230, 234); MUT = (150, 150, 158)
src, tag, title, out = sys.argv[1:5]
files = sorted(glob.glob(f'{src}/{tag}-[0-9][0-9][0-9].png'))
data = json.load(open(f'{src}/{tag}.json'))
w, h = Image.open(files[0]).size
cols, tw = 10, 220
th = int(h * tw / w)
rows = (len(files) + cols - 1) // cols
head = 44
S = Image.new('RGB', (cols * (tw + 6) + 6, head + rows * (th + 22) + 6), BG)
d = ImageDraw.Draw(S)
d.text((8, 8), title, font=FB, fill=INK)
for k, f in enumerate(files):
    x = 6 + (k % cols) * (tw + 6); y = head + (k // cols) * (th + 22)
    d.text((x, y + 2), f"{data['rows'][k]['s']} svh", font=F, fill=MUT)
    S.paste(Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS), (x, y + 18))
S.save(out, 'JPEG', quality=80, optimize=True, progressive=True)
print(out, S.size, 'unfinished:', len(data['bad']))
