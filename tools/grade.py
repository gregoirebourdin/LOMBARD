"""Étalonnage commun, appliqué pixel par pixel (donc aussi aux calques RGBA de parallaxe).

photo(im)  : photographies — bois chaud intact, ombres les plus profondes mêlées à 4 % vers #2D1426.
render(im) : vues 3D — idem à 5 %, et bleus du ciel désaturés de 15 %, pour qu'elles parlent
             la même langue que les photos sans cacher qu'elles sont des vues 3D.
Usage en ligne de commande : python tools/grade.py photo|render entrée sortie
"""
import sys
import numpy as np
from PIL import Image

TINT = np.array([45, 20, 38], dtype=np.float32)  # #2D1426


def _shadows(rgb, amount):
    lum = (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]) / 255.0
    w = np.clip((0.25 - lum) / 0.25, 0, 1)[..., None] * amount
    return rgb * (1 - w) + TINT * w


def _desat_blues(rgb, amount):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    blue = np.clip((b - np.maximum(r, g)) / 40.0, 0, 1) * np.clip(sat / 0.15, 0, 1)
    grey = (0.2126 * r + 0.7152 * g + 0.0722 * b)[..., None]
    k = (blue * amount)[..., None]
    return rgb * (1 - k) + grey * k


def apply(im, kind='photo'):
    mode = im.mode
    a = None
    if mode in ('RGBA', 'LA'):
        im = im.convert('RGBA')
        a = np.asarray(im)[..., 3]
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    if kind == 'render':
        rgb = _desat_blues(rgb, 0.15)
        rgb = _shadows(rgb, 0.05)
    else:
        rgb = _shadows(rgb, 0.04)
    out = np.clip(rgb + 0.5, 0, 255).astype(np.uint8)
    if a is not None:
        return Image.fromarray(np.dstack([out, a]), 'RGBA')
    return Image.fromarray(out, 'RGB')


def photo(im):
    return apply(im, 'photo')


def render(im):
    return apply(im, 'render')


if __name__ == '__main__':
    kind, src, dst = sys.argv[1:4]
    im = Image.open(src)
    apply(im, kind).save(dst, quality=95) if dst.lower().endswith(('.jpg', '.jpeg')) else apply(im, kind).save(dst)
