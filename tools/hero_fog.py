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
    # assez grande pour n'être agrandie que trois fois (au-delà, l'agrandissement du navigateur dessine
    # une grille), très floue, et encodée sans perte visible (aucun bloc de compression)
    w = 480 if k == 'd' else 320
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(12 if k == 'd' else 8))
    out = os.path.join(ROOT, 'public', 'assets', 'hero', k, 'fog.webp')
    im.save(out, 'WEBP', quality=88, method=6)
    print(out, im.size, os.path.getsize(out), 'octets')
