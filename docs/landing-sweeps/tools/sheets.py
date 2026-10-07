# contact sheets: one per run, and a before | after pair per run (JPEG)
import sys, os, glob, json
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
FB = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 26)
BG = (28, 28, 32); INK = (230, 230, 234); MUT = (150, 150, 158)
def sheet(dirpath, tag, title):
    files = sorted(glob.glob(f'{dirpath}/{tag}-[0-9][0-9].png'))
    if not files: return None
    w, h = Image.open(files[0]).size
    phone = w < 600
    cols = 8 if phone else 5
    tw = 150 if phone else (300 if w <= 1280 else 300)
    th = int(h * tw / w)
    rows = (len(files) + cols - 1) // cols
    head = 48
    S = Image.new('RGB', (cols * (tw + 8) + 8, head + rows * (th + 26) + 8), BG)
    d = ImageDraw.Draw(S)
    d.text((10, 10), title, font=FB, fill=INK)
    for k, f in enumerate(files):
        x = 8 + (k % cols) * (tw + 8); y = head + (k // cols) * (th + 26)
        d.text((x, y + 2), f'stop {k}', font=F, fill=MUT)
        S.paste(Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS), (x, y + 20))
    return S
def pair(before_dir, after_dir, tag, out, label):
    a = sheet(before_dir, tag, f'Before · {label}')
    b = sheet(after_dir, tag, f'After · {label}')
    if a is None or b is None: return False
    H = max(a.height, b.height)
    P = Image.new('RGB', (a.width + b.width + 24, H), (60, 60, 66))
    P.paste(a, (0, 0)); P.paste(b, (a.width + 24, 0))
    P.save(out, 'JPEG', quality=80, optimize=True, progressive=True)
    return True
if __name__ == '__main__':
    before_dir, after_dir, outdir = sys.argv[1:4]
    os.makedirs(outdir, exist_ok=True)
    tags = sorted({os.path.basename(f)[:-7] for f in glob.glob(f'{after_dir}/*-[0-9][0-9].png')})
    for tag in tags:
        theme, size = tag.split('-')[0], tag.split('-')[1]
        label = f'{size} {theme}' + (' · reduced motion' if tag.endswith('calm') else '')
        if pair(before_dir, after_dir, tag, f'{outdir}/{tag}.jpg', label): print('sheet', tag)
