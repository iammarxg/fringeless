"""Simulate text on OLED subpixel layouts and score it against ideal (infinite-resolution) text.

SIMULATION ONLY. It ranks rendering options per layout; it does not replace looking at a real panel.
Model: subpixel boxes -> 12x supersampled light field -> S-CIELAB eye blur -> Lab difference.
Offsets are derived from OLEDTextFix (MIT) presets and mdrejhon's RWBG centres; see NOTICE.
"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

S = 12  # supersamples per pixel
FONT = 'C:/Windows/Fonts/segoeui.ttf'
PPI, CM = 110, 60
PPD = PPI * CM / 2.54 * np.tan(np.radians(1))


def box(cx, cy, wd, ht):
    return (cx - wd / 2, cx + wd / 2, cy - ht / 2, cy + ht / 2)


def triad(rx, bx, gy=.25, dy=.5):  # green on top, red/blue below; rx/bx relative to green centre
    gx = .5 - (rx + bx) / 2 if False else .5
    return {'G': box(gx, gy, .5, .40), 'R': box(gx + rx, gy + dy, .40, .40), 'B': box(gx + bx, gy + dy, .40, .40)}


q = .25
PANELS = {
    'RGB stripe': {'R': box(1 / 6, .5, 1 / 3, .8), 'G': box(.5, .5, 1 / 3, .8), 'B': box(5 / 6, .5, 1 / 3, .8)},
    'WOLED RWBG': {'R': box(q * .5, .5, q, .8), 'W': box(q * 1.5, .5, q, .8), 'B': box(q * 2.5, .5, q, .8), 'G': box(q * 3.5, .5, q, .8)},
    'WOLED RGWB': {'R': box(q * .5, .5, q, .8), 'G': box(q * 1.5, .5, q, .8), 'W': box(q * 2.5, .5, q, .8), 'B': box(q * 3.5, .5, q, .8)},
    'QD-OLED 27" 1440p': triad(-.22, .27),
    'QD-OLED 34" gen1': triad(-.31, .22),
    'QD-OLED 4K': triad(-.15, .34),
}
REF = {p: ('W' if 'W' in d else 'G') for p, d in PANELS.items()}


def ctr(b): return ((b[0] + b[1]) / 2, (b[2] + b[3]) / 2)
def lin(v): return np.where(v <= .04045, v / 12.92, ((v + .055) / 1.055) ** 2.4)
def enc(v):
    v = np.clip(v, 0, 1)
    return np.where(v <= .0031308, v * 12.92, 1.055 * v ** (1 / 2.4) - .055)


def hires(text, px, W, H):
    im = Image.new('L', (W * S, H * S), 0)
    ImageDraw.Draw(im).text((3 * S, 2 * S), text, 255, ImageFont.truetype(FONT, px * S))
    return np.asarray(im) / 255.


def boxdown(a, dx=0., wpx=1.):
    """Coverage per pixel with a window wpx wide whose centre is shifted dx pixels."""
    H, W = a.shape[0] // S, a.shape[1] // S
    rows = a.reshape(H, S, -1).mean(1)
    n = int(round(wpx * S)); k = np.ones(n) / n
    pad = np.pad(rows, ((0, 0), (2 * S, 2 * S)), mode='edge')
    f = np.apply_along_axis(lambda r: np.convolve(r, k, 'same'), 1, pad)
    idx = (np.arange(W) * S + S // 2 + int(round(dx * S)) + 2 * S)
    return f[:, idx]


def render(cov_hi, mode, dark):
    if mode == 'gray':
        c = [boxdown(cov_hi)] * 3
    else:  # ClearType-like RGB order, 1-pixel-wide low-pass per channel
        c = [boxdown(cov_hi, d, 1.) for d in (-1 / 3, 0, 1 / 3)]
    c = np.stack(c, -1)
    c = c if dark else 1 - c  # dark: white on black
    return c  # already sRGB-encoded coverage, like browsers blend


def shift(ch, d, axis, kind):
    if abs(d) < 1e-6: return ch
    def w(t, kind):
        t = abs(t)
        if kind == 'linear': return max(0, 1 - t)
        B, C = {'sharp': (0, .5), 'balanced': (.2, .6), 'smooth': (.3, .5)}[kind]
        if t < 1: return ((12 - 9 * B - 6 * C) * t ** 3 + (-18 + 12 * B + 6 * C) * t ** 2 + (6 - 2 * B)) / 6
        if t < 2: return ((-B - 6 * C) * t ** 3 + (6 * B + 30 * C) * t ** 2 + (-12 * B - 48 * C) * t + (8 * B + 24 * C)) / 6
        return 0
    ks = range(-2, 3); ws = np.array([w(k - d, kind) for k in ks]); ws /= ws.sum()
    p = np.pad(ch, [(2, 2) if i == axis else (0, 0) for i in range(2)], mode='edge')
    out = 0
    n = ch.shape[axis]
    for k, wt in zip(ks, ws): out = out + wt * np.take(p, np.arange(n) + 2 + k, axis=axis)
    return out


def layout_filter(img, panel, st, kind='sharp', linear=True, lcd=False):
    d = PANELS[panel]; rx, ry = ctr(d[REF[panel]])
    a = lin(img) if linear else img
    o = []
    for i, c in enumerate('RGB'):
        x, y = ctr(d[c]); dx, dy = (x - rx) * st, (y - ry) * st
        if lcd: dx -= (i - 1) / 3 * st
        o.append(shift(shift(a[..., i], dx, 1, kind), dy, 0, kind))
    o = np.stack(o, -1)
    return enc(o) if linear else np.clip(o, 0, 1)


def light(img, panel, wshare):
    L = lin(img); H, W, _ = L.shape
    d = PANELS[panel]; out = np.zeros((H * S, W * S, 3))
    w = L.min(-1) * wshare if 'W' in d else np.zeros((H, W))
    rgb = L - w[..., None]
    for k, b in d.items():
        x0, x1, y0, y1 = [int(round(v * S)) for v in b]
        area = (x1 - x0) * (y1 - y0) / S / S
        src = w if k == 'W' else rgb[..., 'RGB'.index(k)]
        for yy in range(y0, y1):
            for xx in range(x0, x1):
                chans = (0, 1, 2) if k == 'W' else ('RGB'.index(k),)
                for c in chans:
                    ys, xs = slice(max(yy, 0), None), slice(max(xx, 0), None)
                    t = out[yy % S + (yy // S) * S::S, xx % S + (xx // S) * S::S, c] if yy >= 0 and xx >= 0 else None
                    if t is not None: t[:H, :W] += src[:t.shape[0], :t.shape[1]] / area
    return out


M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]])
OPP = np.array([[.2787, .7218, -.1066], [-.4488, .2898, .0772], [.0860, -.5900, .5011]])  # S-CIELAB opponent space
SP = [[(.921, .0283), (.105, .133), (-.108, 4.336)], [(.531, .0392), (.330, .494)], [(.488, .0536), (.371, .386)]]


def gauss(a, sig):
    if sig > a.shape[0]: return np.full_like(a, a.mean())
    fy, fx = np.fft.fftfreq(a.shape[0]), np.fft.rfftfreq(a.shape[1])
    g = np.exp(-2 * (np.pi * sig) ** 2 * (fy[:, None] ** 2 + fx[None] ** 2))
    return np.fft.irfft2(np.fft.rfft2(a) * g, a.shape)


def eye(rgb):
    o = rgb @ M.T @ OPP.T; r = []
    for i in range(3):
        tot = sum(w for w, _ in SP[i])
        r.append(sum(w / tot * gauss(o[..., i], s / np.sqrt(2) * PPD * S) for w, s in SP[i]))
    xyz = np.clip(np.stack(r, -1) @ np.linalg.inv(OPP).T, 0, None) / M.sum(1)
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def score(img, panel, hi, dark, wshare):
    ideal = hi if dark else 1 - hi
    A, B = eye(light(img, panel, wshare)), eye(np.repeat(lin(ideal)[..., None], 3, -1))
    m = slice(S * 2, -S * 2)
    D = (A - B)[m, m]
    ink = np.asarray(hi[m, m] > .02)
    # dilate the ink mask by about a pixel so the score covers glyph edges, not empty background
    k = gauss(ink.astype(float), S * .8) > .05
    return float(np.hypot(D[..., 1], D[..., 2])[k].mean()), float(np.abs(D[..., 0])[k].mean())


def main():
    W, H, rows = 96, 22, []
    for px in (13, 16):
        hi = hires('Illiwm HAVE fox', px, W, H)
        for dark in (True, False):
            for p in PANELS:
                for ws in ((1.0, .5) if 'W' in PANELS[p] else (0,)):
                    opts = {'LCD (ClearType)': render(hi, 'lcd', dark), 'Grayscale': render(hi, 'gray', dark)}
                    if p != 'RGB stripe':
                        for st in (.2, .5, .9):
                            opts[f'Gray + filter {st}'] = layout_filter(opts['Grayscale'], p, st)
                        for st in (.2, .9): opts[f'LCD + filter {st}'] = layout_filter(opts['LCD (ClearType)'], p, st, lcd=True)
                    for o, im in opts.items():
                        c, l = score(im, p, hi, dark, ws)
                        rows.append(dict(px=px, dark=dark, panel=p, wshare=ws, opt=o, chroma=round(c, 2), luma=round(l, 2)))
    json.dump(rows, open('lab/results/panel-sim.json', 'w'), indent=0)
    for p in PANELS:
        for dark in (True, False):
            print(f'\n{p}  {"white on black" if dark else "black on white"}   (colour error, lightness error; lower is better)')
            names = list(dict.fromkeys(r['opt'] for r in rows if r['panel'] == p))
            for o in names:
                rr = [r for r in rows if r['panel'] == p and r['dark'] == dark and r['opt'] == o]
                print(f'  {o:20s} {np.mean([r["chroma"] for r in rr]):6.2f} {np.mean([r["luma"] for r in rr]):6.2f}')


main()
