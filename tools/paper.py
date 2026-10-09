"""Texture de papier pour le fond des sections : fibres courtes et grain fin, sans motif basse fréquence,
donc sans couture visible d'une section à l'autre. Tuile raccordable (les fibres qui dépassent reviennent
de l'autre côté). Niveaux de gris proches du blanc, posés en « multiply » sur le dégradé ivoire.

Usage : python tools/paper.py   →   public/assets/img/paper.webp
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = 320
rng = np.random.default_rng(1979)

# fibres : traits courts, légèrement courbes, plus sombres ; dessinés sur une tuile 3×3 puis recentrés
big = Image.new('L', (N * 3, N * 3), 255)
d = ImageDraw.Draw(big)
for _ in range(780):
    x, y = rng.uniform(N, 2 * N, 2)
    a = rng.uniform(0, np.pi)
    L = rng.uniform(6, 26)
    bend = rng.uniform(-.25, .25)
    pts = [(x + np.cos(a + bend * t) * L * t, y + np.sin(a + bend * t) * L * t) for t in np.linspace(-.5, .5, 6)]
    v = int(rng.uniform(243, 251))
    for ox in (-N, 0, N):
        for oy in (-N, 0, N):
            d.line([(px + ox, py + oy) for px, py in pts], fill=v, width=1)
tile = big.crop((N, N, 2 * N, 2 * N)).filter(ImageFilter.GaussianBlur(.6))
f = np.asarray(tile, np.float32)

# grain fin
g = rng.normal(0, 2.2, (N, N)).astype(np.float32)
g = np.asarray(Image.fromarray(np.clip(128 + g, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.45)), np.float32) - 128
out = np.clip(f + g * .9 - 2, 200, 255)
# on ne garde que l'assombrissement (multiply) : le blanc reste blanc
out = np.minimum(out, 255)
im = Image.fromarray(out.astype(np.uint8), 'L')
dst = os.path.join(ROOT, 'public', 'assets', 'img', 'paper.webp')
im.save(dst, "WEBP", lossless=True, quality=100, method=6)
print(dst, os.path.getsize(dst), 'octets', 'moyenne', round(float(out.mean()), 1))
