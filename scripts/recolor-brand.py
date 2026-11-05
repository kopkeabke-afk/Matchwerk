"""Recolours the flame in the Matchwerk artwork from pink/red/orange to the brand's gold → violet.
Reads assets/brand/original/*, writes assets/brand/*. Hue mapping keeps the original shading."""
import colorsys, sys
from PIL import Image

GOLD_H, VIOLET_H = 42 / 360, 278 / 360

def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def recolor(im):
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if ss < 0.18:
                continue
            deg = hh * 360
            d = deg - 360 if deg > 200 else deg       # pink/red near 0 → negative side
            if d < -70 or d > 70:                      # leave blue/violet/plum and greens alone
                continue
            wv = 1 - smooth(8, 30, d)                 # 1 = becomes violet, 0 = becomes gold
            gr, gg, gb = colorsys.hsv_to_rgb(GOLD_H, min(1, ss * 1.05), vv)
            vr, vg, vb = colorsys.hsv_to_rgb(VIOLET_H, min(1, ss * 0.95), min(1, vv * 1.04))
            nr, ng, nb = (gr * (1 - wv) + vr * wv, gg * (1 - wv) + vg * wv, gb * (1 - wv) + vb * wv)
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return im

for name in sys.argv[1:] or ['play-icon-512.png', 'feature-graphic-1024x500.png']:
    out = recolor(Image.open(f'assets/brand/original/{name}'))
    (out if name.endswith('512.png') else out.convert('RGB')).save(f'assets/brand/{name}')
    print('recoloured', name)
