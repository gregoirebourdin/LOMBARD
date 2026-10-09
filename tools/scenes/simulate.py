"""Contrôle : recompose les plans à plusieurs instants du mouvement (même modèle que le site,
voir motion.py) pour vérifier qu'aucun trou, halo, raccord ou étirement n'apparaît.
Les trous éventuels apparaissent en magenta.
Usage : python simulate.py <work_dir> <scene> [progress ...]"""
import json, os, sys, glob, numpy as np
from PIL import Image
HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from motion import plane_transform
work, scene = sys.argv[1], sys.argv[2]
progs = [float(x) for x in sys.argv[3:]] or [0, 0.5, 1]
# scène dans le flux : p=0 et p=1 correspondent à une scène hors écran ; on contrôle la plage
# où elle est visible au moins au tiers (environ 0,2 à 0,8).
c = json.load(open(os.path.join(HERE, 'scenes.json')))['scenes'][scene]
files = sorted(glob.glob(os.path.join(work, scene, 'planes', '*.png')), key=lambda f: int(os.path.basename(f).split('-')[0]))
planes = [Image.open(f) for f in files]
W, H = planes[0].size
k1920 = W / 1920.0
over = 1 + c.get('overscan', 0.1) if c.get('motion') != 'pan' else 1.0
ox, oy = c.get('origin', [0.5, 0.5])
frames = []
pan = c.get('motion') == 'pan'
CW = int(W / 1.6) if pan else W  # panorama : le cadre visible fait 1/1,6 de la scène
for p in progs:
    canvas = Image.new('RGBA', (CW, H), (255, 0, 255, 255))
    for k, im in enumerate(planes):
        s, y, x = plane_transform(c, k, p)
        s *= over
        nw, nh = int(W * s), int(H * s)
        r = im.resize((nw, nh), Image.BILINEAR)
        x0 = int(ox * W - ox * nw)
        y0 = int(oy * H - oy * nh + y * k1920)
        if pan:  # x est en px d'un cadre de 1920 ; la scène fait 1,6 cadre = W px source
            x0 = int(x * W / (1.6 * 1920)); y0 = 0
        canvas.alpha_composite(r, (max(x0, 0), max(y0, 0)), (max(-x0, 0), max(-y0, 0)))
    frames.append(canvas.convert('RGB'))
tw = 900; th = int(H * tw / CW)
sheet = Image.new('RGB', (tw, (th + 10) * len(frames)), 'white')
for i, f in enumerate(frames):
    sheet.paste(f.resize((tw, th), Image.LANCZOS), (0, i * (th + 10)))
sheet.save(os.path.join(work, scene, 'simulate.jpg'), quality=85)
frames[-1].save(os.path.join(work, scene, 'simulate_end.png'))
worst = 0
for f in frames:
    m = np.asarray(f).astype(int)
    worst = max(worst, ((m[..., 0] > 250) & (m[..., 1] < 5) & (m[..., 2] > 250)).mean())
print('trous (magenta), pire instant :', round(worst * 100, 3), '%')
