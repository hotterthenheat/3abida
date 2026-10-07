# how much of each stop is empty: the share of the screen in bands that hold nothing but the ground, a band counted only
# when it is taller than 5% of the screen (the space between two lines or round a button is not empty space). A row is
# empty when no pixel in it stands more than TH from the row's own median. usage: python3 empty.py <dir> [tag-prefix]
import sys, glob, os
import numpy as np
from PIL import Image
TH = 14
d = sys.argv[1]
pre = sys.argv[2] if len(sys.argv) > 2 else ''
runs = {}
for f in sorted(glob.glob(f'{d}/{pre}*-[0-9][0-9].png')):
    tag = os.path.basename(f)[:-7]
    a = np.asarray(Image.open(f).convert('L'), dtype=np.int16)
    H = a.shape[0]
    med = np.median(a, axis=1, keepdims=True)
    blank = np.abs(a - med).max(axis=1) < TH
    tot, run = 0, 0
    for b in list(blank) + [False]:
        if b: run += 1
        else:
            if run >= 0.05 * H: tot += run
            run = 0
    runs.setdefault(tag, []).append((os.path.basename(f)[-6:-4], tot / H))
for tag, st in runs.items():
    worst = max(st, key=lambda x: x[1])
    over = [f'{k}:{e:.0%}' for k, e in st if e > 0.40]
    print(f'{tag:24s} stops {len(st):2d}  worst stop {worst[0]} {worst[1]:.0%}  over 40%: {", ".join(over) or "none"}')
