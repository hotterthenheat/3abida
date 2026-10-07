# the empty share of each first screen (empty.py's rule: bands of nothing but the ground taller than 5% of the screen)
import sys, glob, os
import numpy as np
from PIL import Image
for f in sorted(glob.glob(f'{sys.argv[1]}/{sys.argv[2]}-*.png')):
    a = np.asarray(Image.open(f).convert('L'), dtype=np.int16); H = a.shape[0]
    blank = np.abs(a - np.median(a, axis=1, keepdims=True)).max(axis=1) < 14
    runs, s = [], None
    for i, b in enumerate(list(blank) + [False]):
        if b and s is None: s = i
        if not b and s is not None:
            if i - s >= 0.05 * H: runs.append((s, i))
            s = None
    tot = sum(e - s for s, e in runs)
    print(f'{os.path.basename(f):28s} {tot / H:5.1%}  bands {runs}')
