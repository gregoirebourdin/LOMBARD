"""Version floue de la photo du hero, pour l'entrée « dans le nuage » : la page s'ouvre sur cette image
floue (quelques Ko, insérée dans la page), qui s'efface pendant que la vraie photo se met au point.

Usage : python tools/hero_fog.py   →   public/assets/hero/<d|m>/fog.webp
Le flou est calculé ici, une fois : le navigateur n'anime jamais de filtre de flou.
"""
import os
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = {'d': 'tools/.cache/masters/hero-I056.png', 'm': 'tools/.cache/masters/hero-I064.png'}

for k, src in SRC.items():
    im = Image.open(os.path.join(ROOT, src)).convert('RGB')
    w = 320 if k == 'd' else 220
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(5))
    out = os.path.join(ROOT, 'public', 'assets', 'hero', k, 'fog.webp')
    im.save(out, 'WEBP', quality=62, method=6)
    print(out, im.size, os.path.getsize(out), 'octets')
