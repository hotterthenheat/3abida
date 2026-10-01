# THE OWNER'S LOGO SHEET → ONE SVG A TICKER, AS DRAWN (2026-10-01).
#   python3 scripts/logo-sheet/build.py <sheet.pdf> <tiles-dir>        (needs PyMuPDF: pip install pymupdf)
# The sheet (Corporate_Brand_Logo_Matrix.pdf, the owner's) draws each ticker's mark on a coloured square with the ticker
# printed under it. Each square becomes <tiles-dir>/<TICKER>.svg: the square, its mark, its lettering as outlines.
# Shapes come from the page's drawing list (exact; strokes and dashes kept — the page's own SVG export dropped SPY's
# rings and NDX's zigzag); lettering from the page's SVG export, picked by where each letter stands. ETN's "FATON" is set
# right as EATON with the sheet's own E. Then scripts/logo-sheet/bare.mjs takes the squares away.
import fitz, re, json, os, sys
import xml.etree.ElementTree as ET
P = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
SVGNS = '{http://www.w3.org/2000/svg}'
XL = '{http://www.w3.org/1999/xlink}href'
src = fitz.open(P)

def hexc(c):
    return '#%02x%02x%02x' % tuple(round(v * 255) for v in c[:3])

def f3(v):
    s = f'{v:.3f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s

def g6(v):
    return '%.6g' % v

def mat(s):
    a = [float(v) for v in re.findall(r'[-\d.eE]+', s)]
    return a if len(a) == 6 else [1, 0, 0, 1, 0, 0]

def mul(m, n):  # m then n (n applied after m... SVG lists apply left-outer): result = m × n
    a, b, c, d, e, f = m
    A, B, C, D, E, F = n
    return [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f]

def path_d(items, close):
    d, cur = [], None
    def move(p):
        nonlocal cur
        if cur is None or abs(cur.x - p.x) > 1e-3 or abs(cur.y - p.y) > 1e-3:
            d.append(f'M{f3(p.x)} {f3(p.y)}')
    for it in items:
        k = it[0]
        if k == 'l':
            move(it[1]); d.append(f'L{f3(it[2].x)} {f3(it[2].y)}'); cur = it[2]
        elif k == 'c':
            move(it[1]); d.append('C' + ' '.join(f'{f3(p.x)} {f3(p.y)}' for p in it[2:5])); cur = it[4]
        elif k == 're':
            r = it[1]; d.append(f'M{f3(r.x0)} {f3(r.y0)}H{f3(r.x1)}V{f3(r.y1)}H{f3(r.x0)}Z'); cur = None
        elif k == 'qu':
            q = it[1]; d.append(f'M{f3(q.ul.x)} {f3(q.ul.y)}L{f3(q.ur.x)} {f3(q.ur.y)}L{f3(q.lr.x)} {f3(q.lr.y)}L{f3(q.ll.x)} {f3(q.ll.y)}Z'); cur = None
    if close and d and not d[-1].endswith('Z'):
        d.append('Z')
    return ''.join(d)

def shape(x):
    t = x['type']
    attrs = []
    if 'f' in t and x.get('fill') is not None:
        attrs.append(f'fill="{hexc(x["fill"])}"')
        if x.get('even_odd'):
            attrs.append('fill-rule="evenodd"')
        if x.get('fill_opacity') not in (None, 1, 1.0):
            attrs.append(f'fill-opacity="{f3(x["fill_opacity"])}"')
    else:
        attrs.append('fill="none"')
    if 's' in t and x.get('color') is not None:
        attrs.append(f'stroke="{hexc(x["color"])}" stroke-width="{f3(x.get("width") or 1)}"')
        cap = x.get('lineCap')
        cap = cap[0] if isinstance(cap, (list, tuple)) else cap
        if cap in (1, 2):
            attrs.append(f'stroke-linecap="{["butt", "round", "square"][cap]}"')
        join = x.get('lineJoin')
        if join in (1, 2):
            attrs.append(f'stroke-linejoin="{["miter", "round", "bevel"][int(join)]}"')
        dash = x.get('dashes') or ''
        m = re.match(r'\[\s*([\d.\s]+)\s*\]', dash)
        if m and m.group(1).strip():
            attrs.append(f'stroke-dasharray="{" ".join(f3(float(v)) for v in m.group(1).split())}"')
        if x.get('stroke_opacity') not in (None, 1, 1.0):
            attrs.append(f'stroke-opacity="{f3(x["stroke_opacity"])}"')
    return f'<path {" ".join(attrs)} d="{path_d(x["items"], x.get("closePath"))}"/>'

def glyphs_of(page):
    """every letter on the page: (character, glyph path elements, full matrix, fill)"""
    root = ET.fromstring(page.get_svg_image(text_as_path=True))
    defs = {g.get('id'): list(g) for g in root.iter(SVGNS + 'g') if (g.get('id') or '').startswith('font_')}
    out = []
    def walk(el, m, fill):
        tag = el.tag.replace(SVGNS, '')
        if tag in ('defs', 'clipPath', 'mask'):
            return
        here = mul(m, mat(el.get('transform'))) if el.get('transform') else m
        fill = el.get('fill') or fill
        if tag == 'use':
            gid = (el.get(XL) or '').lstrip('#')
            out.append({'ch': el.get('data-text'), 'gid': gid, 'm': here, 'fill': fill or '#000000', 'parts': defs.get(gid, [])})
        for ch in el:
            walk(ch, here, fill)
    walk(root, [1, 0, 0, 1, 0, 0], None)
    return out, defs

def glyph_svg(g, defs):
    out = []
    for p in g['parts']:
        m = mul(g['m'], mat(p.get('transform'))) if p.get('transform') else g['m']
        out.append(f'<path data-glyph="1" fill="{g["fill"]}" transform="matrix({",".join(g6(v) for v in m)})" d="{p.get("d")}"/>')
    return ''.join(out)

report = {}
for pno in range(src.page_count):
    page = src[pno]
    drawings = page.get_drawings()
    words = page.get_text('words')
    letters, defs = glyphs_of(page)
    tiles = [x for x in drawings if x.get('fill') is not None and 30 < x['rect'].width < 45 and abs(x['rect'].width - x['rect'].height) < 1]
    for t in tiles:
        r = t['rect']
        below = sorted([w for w in words if r.x0 - 6 < (w[0] + w[2]) / 2 < r.x1 + 6 and r.y1 < w[1] < r.y1 + 16], key=lambda w: w[1])
        sym = below[0][4]
        inside = fitz.Rect(r.x0 - 1.5, r.y0 - 1.5, r.x1 + 1.5, r.y1 + 1.5)
        shapes = [x for x in drawings if x['seqno'] >= t['seqno'] and inside.contains(x['rect'])]
        mine = [g for g in letters if r.x0 <= g['m'][4] <= r.x1 and r.y0 <= g['m'][5] <= r.y1]
        if sym == 'ETN':
            # FATON → EATON: the sheet's own E (same font) in place of its F, the word re-centred on the E's extra width
            e_gid = next(g['gid'] for g in letters if g['ch'] == 'E' and g['gid'].startswith(mine[0]['gid'].rsplit('_', 1)[0] + '_'))
            first = mine[0]
            # an E's advance in this font, measured where an E is followed by a letter on the same line
            same = [g for g in letters if g['gid'].startswith(e_gid.rsplit('_', 1)[0] + '_')]
            adv = None
            for a, b in zip(same, same[1:]):
                if a['ch'] == 'E' and abs(a['m'][5] - b['m'][5]) < 0.01 and b['m'][4] > a['m'][4]:
                    adv = (b['m'][4] - a['m'][4]) / abs(a['m'][0]); break
            f_adv = (mine[1]['m'][4] - first['m'][4]) / abs(first['m'][0])
            grow = ((adv or f_adv) - f_adv) * abs(first['m'][0])
            first['ch'], first['gid'], first['parts'] = 'E', e_gid, defs[e_gid]
            for i, g in enumerate(mine):
                g['m'] = g['m'][:4] + [g['m'][4] - grow / 2 + (grow if i > 0 else 0), g['m'][5]]
            report['ETN-fix'] = {'E_adv_em': adv, 'F_adv_em': f_adv, 'shift_pt': grow}
        body = ''.join(shape(x) for x in shapes) + ''.join(glyph_svg(g, defs) for g in mine)
        vb = f'{f3(r.x0)} {f3(r.y0)} {f3(r.width)} {f3(r.height)}'
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{body}</svg>\n'
        open(os.path.join(OUT, f'{sym}.svg'), 'w').write(svg)
        report[sym] = {'shapes': len(shapes), 'letters': ''.join(g['ch'] or '?' for g in mine), 'bytes': len(svg), 'tile': hexc(t['fill']), 'edge': hexc(t['color']) if t.get('color') else None}
json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), indent=1)
print(len([k for k in report if not k.endswith('-fix')]), 'logos;', 'ETN fix:', report.get('ETN-fix'))
print(' '.join(f"{k}:{v['shapes']}s/{v['letters'] or '-'}" for k, v in report.items() if not k.endswith('-fix')))
