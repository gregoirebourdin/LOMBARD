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
    # petite et déjà très floue, mais encodée en haute qualité : une fois agrandie à l'écran, aucun bloc
    # de compression ne doit apparaître (à qualité basse, on voit des carrés)
    w = 160 if k == 'd' else 120
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(4 if k == 'd' else 3))
    out = os.path.join(ROOT, 'public', 'assets', 'hero', k, 'fog.webp')
    im.save(out, 'WEBP', quality=92, method=6)
    print(out, im.size, os.path.getsize(out), 'octets')
