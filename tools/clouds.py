"""Nappes de nuage pour l'intro : deux calques (proche, lointain) de bruit fractal doux, blancs avec
transparence. Petits (640 px) : un nuage est flou par nature, l'agrandissement à l'écran ne se voit pas.

Usage : python tools/clouds.py   →   public/assets/img/cloud-near.webp, cloud-far.webp
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 512, 320


def fbm(seed, base, octaves=5, gain=.5):
    rng = np.random.default_rng(seed)
    out = np.zeros((H, W), np.float32)
    amp, tot = 1., 0.
    for o in range(octaves):
        s = base * 2 ** o
        g = rng.random((max(2, H * s // W + 2), s + 2)).astype(np.float32)
        up = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((W + W // s * 2, H + H // max(1, H * s // W) * 2), Image.BICUBIC), np.float32) / 255
        out += amp * up[:H, :W]
        tot += amp
        amp *= gain
    return out / tot


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
for name, seed, base, lo, hi, hole in (("near", 7, 3, .36, .7, 0), ("far", 21, 4, .4, .74, 0)):
    n = fbm(seed, base)
    a = smooth(n, lo, hi)
    if hole:  # la nappe proche s'ouvre au centre : c'est par là qu'on entre
        a *= .35 + .65 * smooth(r, .1, hole + .5)
    tint = np.dstack([np.full((H, W), v, np.float32) for v in (255, 252, 250)])
    tint -= (1 - n)[..., None] * np.array([10, 14, 6], np.float32)  # creux légèrement lavande
    rgba = np.dstack([np.clip(tint, 0, 255), a * 255]).astype(np.uint8)
    dst = os.path.join(ROOT, 'public', 'assets', 'img', f'cloud-{name}.webp')
    Image.fromarray(rgba, 'RGBA').save(dst, 'WEBP', quality=70, alpha_quality=80, method=6)
    print(dst, os.path.getsize(dst), 'octets')
