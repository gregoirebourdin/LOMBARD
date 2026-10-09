"""Rideaux de premier plan : un élément proche détouré (branche enneigée, poteau taillé)
qui traverse l'écran plus vite que le reste (brief §4 et §5.5 « Découper », point 4).

Usage : python curtain.py <work_dir> <scene>
- rideau-branche : les branches proches, isolées par la profondeur (disparité forte), bords
  affinés par filtre guidé, couleurs décontaminées.
- rideau-poteau : le poteau, isolé par SAM 2 (boîte englobante), recadré au plus juste ;
  il couvre déjà toute la hauteur de la photo, donc toute la hauteur d'écran au passage.
"""
import json, os, sys, numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from planes import guided, sstep, sam_mask

work, scene = sys.argv[1], sys.argv[2]
d = os.path.join(work, scene)
g8 = np.asarray(Image.open(os.path.join(d, 'graded.png')).convert('RGB'))
g = g8.astype(np.float32) / 255
disp = np.load(os.path.join(d, 'depth.npy')).astype(np.float32)
H, W = disp.shape
gray = cv2.cvtColor(g, cv2.COLOR_RGB2GRAY)
from pymatting import estimate_foreground_ml
os.makedirs(os.path.join(d, 'planes'), exist_ok=True)

if scene == 'rideau-branche':
    a = sstep(disp, 0.62, 0.06)
    # on ne garde que les masses reliées aux bords gauche et droit (les branches du premier plan)
    hard = (a > 0.5).astype(np.uint8)
    n, lab = cv2.connectedComponents(hard)
    edge = set(np.unique(lab[:, :4])) | set(np.unique(lab[:, -4:])) | set(np.unique(lab[:4, :]))
    keep = np.isin(lab, list(edge - {0})).astype(np.float32)
    keep = cv2.dilate(keep, np.ones((15, 15), np.uint8))
    a = np.clip(guided(gray, a * keep, max(3, W // 600), 1e-4), 0, 1)
    F = estimate_foreground_ml(g.astype(np.float64), a.astype(np.float64)).astype(np.float32)
    rgba = np.dstack([(np.clip(F, 0, 1) * 255).astype(np.uint8), (a * 255).astype(np.uint8)])
    Image.fromarray(rgba, 'RGBA').save(os.path.join(d, 'planes', '0-branche.png'))
else:
    box = json.load(open(os.path.join(os.path.dirname(__file__), 'scenes.json')))['scenes'][scene]['sam_box']
    m = sam_mask(g8, [box])
    a = np.clip(guided(gray, (m > 0.5).astype(np.float32), max(2, W // 900), 1e-4), 0, 1)
    ys, xs = np.where(a > 0.05)
    x0, x1 = max(xs.min() - 8, 0), min(xs.max() + 9, W)
    y0, y1 = max(ys.min() - 8, 0), min(ys.max() + 9, H)
    F = estimate_foreground_ml(g[y0:y1, x0:x1].astype(np.float64), a[y0:y1, x0:x1].astype(np.float64)).astype(np.float32)
    rgba = np.dstack([(np.clip(F, 0, 1) * 255).astype(np.uint8), (a[y0:y1, x0:x1] * 255).astype(np.uint8)])
    Image.fromarray(rgba, 'RGBA').save(os.path.join(d, 'planes', '0-poteau.png'))
print('ok', scene, rgba.shape, 'alpha moyen', round(float(rgba[..., 3].mean() / 255), 3))
