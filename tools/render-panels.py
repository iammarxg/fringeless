"""Renders macro-photo style pictures of each subpixel layout into public/panels.

These are illustrations, not photographs: geometry follows published macro photos (offsets from OLEDTextFix, MIT;
shapes studied from reviewers' photos), light is simulated (emission, lens blur, bloom, sensor noise).
A real photo with a licence that allows it can replace any file: save it under the same name.

  <id>.webp         the panel showing white, as in a review macro
  white-*.webp      one 1px white line through a phone camera, for the welcome page check

Gallery pictures keep the colours next to the white subpixel visible so the order can be read; on a real WOLED
white is almost only the white subpixel, which is what white-woled shows.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 48  # samples per display pixel
OUT = 'public/panels'
os.makedirs(OUT, exist_ok=True)
R, G, B, W = (1.0, .05, .05), (.06, 1.0, .16), (.07, .17, 1.0), (.94, .97, 1.0)


def rrect(cx, cy, w, h, rad=.35): return ('r', cx, cy, w, h, rad)
def ell(cx, cy, w, h): return ('e', cx, cy, w, h, 0)
def dia(cx, cy, w, h): return ('d', cx, cy, w, h, 0)


def cols(order, widths, h=.66):
    out, x = {}, 0
    tot = sum(widths)
    for c, w in zip(order, widths):
        w = w / tot
        out[c] = rrect(x + w / 2, .5, w * .70, h, .45)
        x += w
    return out


# one pixel, unit square
PANELS = {
    'woled-rwbg': cols('RWBG', [1, 1.12, .95, .95]),
    'woled-rgwb': cols('RGWB', [.95, .95, 1.12, 1]),
    'qd-34': {'G': dia(.5, .27, .80, .50), 'R': ell(.21, .76, .40, .44), 'B': ell(.73, .76, .34, .42)},
    'qd-27-1440': {'G': rrect(.5, .25, .62, .33, .3), 'R': rrect(.27, .75, .40, .37, .3), 'B': rrect(.77, .76, .33, .37, .3)},
    'qd-49': {'G': rrect(.5, .25, .60, .33, .3), 'R': rrect(.31, .75, .39, .37, .3), 'B': rrect(.81, .75, .33, .37, .3)},
    'qd-32-4k': {'G': rrect(.48, .25, .58, .32, .25), 'R': rrect(.33, .75, .37, .36, .25), 'B': rrect(.82, .75, .33, .36, .25)},
    'qd-27-4k': {'G': rrect(.48, .25, .56, .32, .25), 'R': rrect(.31, .75, .35, .36, .25), 'B': rrect(.79, .75, .34, .36, .25)},
    'rgb': cols('RGB', [1, 1, 1], .78),
}
LIGHT = {'R': R, 'G': G, 'B': B, 'W': W}
SHARE = {'R': .80, 'G': .72, 'B': .95, 'W': .90}


def sprite(shape):
    k, cx, cy, w, h, rad = shape
    n = 4
    im = Image.new('L', (3 * S * n, 3 * S * n), 0)  # 3x3 pixels so shapes may cross the pixel border
    d = ImageDraw.Draw(im)
    s = S * n
    x0, y0, x1, y1 = (1 + cx - w / 2) * s, (1 + cy - h / 2) * s, (1 + cx + w / 2) * s, (1 + cy + h / 2) * s
    if k == 'r': d.rounded_rectangle((x0, y0, x1, y1), radius=min(w, h) * rad * s, fill=255)
    elif k == 'e': d.ellipse((x0, y0, x1, y1), fill=255)
    else:
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        d.polygon([(mx, y0), (x1, my), (mx, y1), (x0, my)], fill=255)
        im = im.filter(ImageFilter.GaussianBlur(s * .07)).point(lambda v: 255 if v > 120 else 0)
    im = im.resize((3 * S, 3 * S), Image.LANCZOS)
    a = np.asarray(im) / 255.
    # emission falls off slightly toward the edges of a subpixel
    yy, xx = np.mgrid[0:3 * S, 0:3 * S] / S - 1
    fall = 1 - .28 * np.clip(((xx - cx) / (w / 2)) ** 2 + ((yy - cy) / (h / 2)) ** 2, 0, 1.4) / 1.4
    return a * fall


def panel_light(name, px, rgb_in_white=.5):
    """px: H x W x 3 drive values 0..1 -> light field at S samples per pixel."""
    H, Wd, _ = px.shape
    out = np.zeros((H * S + 2 * S, Wd * S + 2 * S, 3))
    subs = PANELS[name]
    white = 'W' in subs
    sp = {c: sprite(s) for c, s in subs.items()}
    for y in range(H):
        for x in range(Wd):
            r, g, b = px[y, x]
            m = min(r, g, b)
            drive = {'R': r, 'G': g, 'B': b, 'W': 0.}
            if white:  # the panel moves most of the common part to the white subpixel
                keep = 1 - rgb_in_white
                drive = {'R': r - m * keep, 'G': g - m * keep, 'B': b - m * keep, 'W': m}
            for c in subs:
                v = drive[c] * SHARE[c]
                if v <= 0: continue
                a = sp[c] * v
                tgt = out[y * S:y * S + 3 * S, x * S:x * S + 3 * S]
                for k in range(3): tgt[..., k] += a * LIGHT[c][k]
    return out[S:-S, S:-S]


def blur(a, sig):
    fy, fx = np.fft.fftfreq(a.shape[0])[:, None], np.fft.rfftfreq(a.shape[1])[None]
    g = np.exp(-2 * (np.pi * sig) ** 2 * (fy ** 2 + fx ** 2))
    return np.stack([np.fft.irfft2(np.fft.rfft2(a[..., k]) * g, a.shape[:2]) for k in range(3)], -1)


def photo(light, size, seed=1):
    a = np.clip(blur(light, S * .028), 0, None)
    a = a * 1.25 + .11 * np.clip(blur(light, S * .16), 0, None) + .07 * np.clip(blur(light, S * .9), 0, None)
    a = 1 - np.exp(-1.75 * a)                       # exposure with a soft shoulder
    core = np.clip(a.max(-1, keepdims=True) - .80, 0, 1) * .9
    a = a * (1 - core) + core * a.max(-1, keepdims=True) * .55 + core * a * .45
    rng = np.random.default_rng(seed)
    img = Image.fromarray((np.clip(a, 0, 1) ** (1 / 1.9) * 255).astype('uint8')).resize(size, Image.LANCZOS)
    b = np.asarray(img).astype(float)
    b += rng.normal(0, 2.0, b.shape) + 5
    return Image.fromarray(np.clip(b, 0, 255).astype('uint8'))


def line(name, rows, rgb_in_white):
    n = max(5, round(len(rows) * 4 / 3) + 1) // 2 * 2 + 1
    p = np.zeros((len(rows), n, 3))
    for y, c in enumerate(rows): p[y, n // 2] = c
    L = panel_light(name, p, rgb_in_white)[:, S // 2:-S // 2]
    h = int(L.shape[1] * .75)
    L = L[(L.shape[0] - h) // 2:][:h] if L.shape[0] >= h else np.pad(L, (((h - L.shape[0]) // 2, (h - L.shape[0] + 1) // 2), (0, 0), (0, 0)))
    return photo(L, (420, 315), 3)


for old in os.listdir(OUT):
    if old.endswith('-test.webp'): os.remove(f'{OUT}/{old}')
for name in PANELS:
    photo(panel_light(name, np.ones((6, 8, 3))), (480, 360), 1).save(f'{OUT}/{name}.webp', quality=86, method=6)
W1 = (1, 1, 1)
for old in os.listdir(OUT):
    if old.startswith(('line-', 'white-', 'order-')): os.remove(f'{OUT}/{old}')
EXTRA = {'white-woled': ('woled-rwbg', [W1] * 4, .10), 'white-rgb': ('rgb', [W1] * 4, 1), 'white-qd': ('qd-27-1440', [W1] * 4, 1)}
for f, (n, r, k) in EXTRA.items(): line(n, r, k).save(f'{OUT}/{f}.webp', quality=88, method=6)
sheet = Image.new('RGB', (5 * 430, 325), (30, 30, 30))
for i, f in enumerate(EXTRA): sheet.paste(Image.open(f'{OUT}/{f}.webp'), (i * 430, 0))
os.makedirs('lab/captures', exist_ok=True)
sheet.save('lab/captures/panels-sheet.png')
print({f: os.path.getsize(f'{OUT}/{f}') for f in sorted(os.listdir(OUT))})
