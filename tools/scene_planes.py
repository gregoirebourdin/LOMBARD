"""Scène « Votre chalet vous attend » : une photo d'hiver découpée en trois plans de parallaxe.
avant : les branches de sapin enneigées, très proches et floues, qui encadrent l'image ;
milieu : le chalet et la neige ; fond : le ciel.

Usage : python tools/scene_planes.py
Entrées : la photo du site actuel (tools/.cache/2024_09_Chalets_Lombard_hiver_exterieure_chlaets-100me.jpg,
téléchargée au besoin), et les modèles hors ligne de tools/layers.py (profondeur Depth Anything V2,
remplissage LaMa) — variable HF_CACHE : dossier du cache Hugging Face.

Méthode :
- avant : la profondeur sépare nettement les branches (proches) du chalet ; comme elles sont floues, leur
  transparence suit la profondeur (rampe douce), recalée sur la photo par un filtre guidé couleur ;
- au défilement, les branches s'écartent vers les bords : ce qu'elles cachent près de leur bord intérieur
  est reconstitué (LaMa) dans la bande que le mouvement peut découvrir ;
- fond : le ciel (très clair, lointain), prolongé en douceur sous le chalet.
Couleurs « décontaminées » sur les bords : au repos, avant ∘ milieu ∘ fond redonne la photo.

Sorties : public/assets/scenes/vca/back, mid, front (AVIF + WebP, avant et milieu recadrés à leur boîte,
avec transparence) et scene.json ; contrôles dans tools/.cache/vca/.
"""
import json, os, sys, urllib.request
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import layers as L  # noqa: E402
from hero_planes import guided, keep_main, save_plane  # noqa: E402

F32 = np.float32
NAME = '2024_09_Chalets_Lombard_hiver_exterieure_chlaets-100me.jpg'
URL = 'https://www.chalets-lombard.fr/wp-content/uploads/2024/09/Chalets_Lombard_hiver_exterieure_chlaets-100me.jpg'
SRC = os.path.join(ROOT, 'tools', '.cache', NAME)
QA = os.path.join(ROOT, 'tools', '.cache', 'vca')
OUT = os.path.join(ROOT, 'public', 'assets', 'scenes', 'vca')
BAND = 260          # px source que l'écartement des branches peut découvrir
WIDTHS = [828, 1281]


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def main():
    if not os.path.exists(SRC):
        req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as r, open(SRC, 'wb') as f:
            f.write(r.read())
    os.makedirs(QA, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    img8 = np.array(Image.open(SRC).convert('RGB'))
    img = img8.astype(F32) / 255
    H, W = img.shape[:2]
    M = L.Models(threads=4)
    d = M.depth(img8)

    # ——— avant : les branches (proches) ; rampe douce, car elles sont floues
    soft = smooth(d, .40, .58)
    hard = keep_main(soft > .5, 4000)
    soft = np.where(cv2.dilate(hard.astype(np.uint8), np.ones((41, 41), np.uint8)) > 0, soft, 0).astype(F32)
    af = np.clip(guided(img, soft, 8, 2e-2), 0, 1).astype(F32)
    af = np.where(soft > .995, 1, af)
    af[af < .02] = 0

    # ——— fond : le ciel, très clair, peu saturé et lointain
    hsv = cv2.cvtColor(img8, cv2.COLOR_RGB2HSV).astype(F32) / 255
    sky = ((d < .03) & (hsv[..., 2] > .78) & (hsv[..., 1] < .18) & (np.arange(H)[:, None] < H * .45)).astype(F32)
    sky = cv2.morphologyEx(sky, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    sky = np.clip(guided(img, sky, 4, 1e-3), 0, 1) * (1 - af)

    # ——— milieu : sous les branches, reconstitué dans la bande découvrable
    hole = af > .02
    dist = cv2.distanceTransform(hole.astype(np.uint8), cv2.DIST_L2, 5)
    need = hole & (dist <= BAND)
    filled, done = L.lama_fill(M, img.copy(), hole, need, rings=3, ring_px=40)
    plate = np.where(hole[..., None], filled, img)
    # dans ce qui a été reconstitué, le ciel prolonge le ciel voisin (clair et en haut)
    hsvp = cv2.cvtColor((np.clip(plate, 0, 1) * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(F32) / 255
    sky_fill = ((hsvp[..., 2] > .8) & (hsvp[..., 1] < .16) & (np.arange(H)[:, None] < H * .4) & hole).astype(F32)
    sky_all = np.maximum(sky, cv2.GaussianBlur(sky_fill, (0, 0), 3))

    known = cv2.erode((sky_all > .98).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(F32)
    base = plate.copy(); base[known < 1] = 0
    back = L.push_pull(base, known)
    back = np.where(known[..., None] > 0, plate, cv2.GaussianBlur(back, (0, 0), 8))

    am = (1 - sky_all).astype(F32)
    mid = plate.copy()
    e = (am > .02) & (am < .98)
    mid[e] = np.clip((plate[e] - (1 - am[e])[:, None] * back[e]) / am[e][:, None], 0, 1)

    # ——— avant : couleurs décontaminées contre ce qu'il y a derrière (milieu sur fond)
    behind = am[..., None] * mid + (1 - am[..., None]) * back
    front = img.copy()
    e = (af > .02) & (af < .98)
    front[e] = np.clip((img[e] - (1 - af[e])[:, None] * behind[e]) / af[e][:, None], 0, 1)

    comp = af[..., None] * front + (1 - af[..., None]) * behind
    print(f'écart de recomposition au repos {np.abs(comp - img).mean() * 255:.3f}/255')

    # ——— exports
    meta = {'w': W, 'h': H, 'planes': []}
    kb = save_plane(back, os.path.join(OUT, 'back'), False, WIDTHS, 56, 80)
    meta['planes'].append({'name': 'back', 'bbox': [0, 0, W, H], 'files': WIDTHS, 'kb': kb})
    for name, col, a in (('mid', mid, am), ('front', front, af)):
        ys, xs = np.where(a > .01)
        bb = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
        rgba = np.dstack([col, a])[bb[1]:bb[3], bb[0]:bb[2]]
        ws = [round(w * (bb[2] - bb[0]) / W) for w in WIDTHS]
        kb = save_plane(rgba, os.path.join(OUT, name), True, ws, 58, 84)
        meta['planes'].append({'name': name, 'bbox': bb, 'files': ws, 'kb': kb})
    json.dump(meta, open(os.path.join(OUT, 'scene.json'), 'w'), indent=1)
    print(json.dumps(meta))

    # ——— contrôles : alpha, plaque reconstituée, et branches écartées (trous en magenta)
    Image.fromarray((af * 255).astype(np.uint8)).resize((W // 3, H // 3)).save(os.path.join(QA, 'alpha-front.jpg'))
    Image.fromarray((sky_all * 255).astype(np.uint8)).resize((W // 3, H // 3)).save(os.path.join(QA, 'alpha-sky.jpg'))
    Image.fromarray((np.clip(plate, 0, 1) * 255).astype(np.uint8)).resize((W // 3, H // 3)).save(os.path.join(QA, 'plate.jpg'))
    frames = []
    for s in (0, .5, 1):
        n, lab = cv2.connectedComponents((af > .3).astype(np.uint8))
        out = behind.copy()
        # chaque branche glisse vers son bord : à gauche vers la gauche, à droite vers la droite
        for k in range(1, n):
            m = lab == k
            cx = np.where(m)[1].mean()
            dx = (-1 if cx < W / 2 else 1) * s * BAND * .85
            Mx = np.float32([[1, 0, dx], [0, 1, -s * 40]])
            fa = cv2.warpAffine(af * cv2.dilate(m.astype(np.uint8), np.ones((61, 61), np.uint8)), Mx, (W, H))
            fr = cv2.warpAffine(front, Mx, (W, H))
            out = fa[..., None] * fr + (1 - fa[..., None]) * out
        frames.append(cv2.resize(out, (W // 3, H // 3)))
    Image.fromarray((np.clip(np.concatenate(frames, 1), 0, 1) * 255).astype(np.uint8)).save(os.path.join(QA, 'sim.jpg'), quality=86)


if __name__ == '__main__':
    main()
