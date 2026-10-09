"""Scène « Votre chalet vous attend » : une photo d'hiver découpée en trois plans de parallaxe.
avant : les branches de sapin enneigées, très proches et floues, qui encadrent l'image ;
milieu : le chalet et la neige ; fond : le ciel.

Usage : python tools/scene_planes.py
Entrées : la photo du site actuel (tools/.cache/2024_09_Chalets_Lombard_hiver_exterieure_chlaets-100me.jpg,
téléchargée au besoin), les modèles hors ligne de tools/layers.py (profondeur Depth Anything V2,
remplissage LaMa) — variable HF_CACHE : dossier du cache Hugging Face — et pymatting.

Méthode :
- avant : la profondeur donne une zone sûrement « branche » et une zone sûrement « chalet ou ciel » ;
  entre les deux, la transparence est calculée sur la photo (détourage « closed-form »), si bien que le
  dégradé suit le flou réel des branches et pas la pente de la carte de profondeur ;
- dans ce dégradé, couleurs de la branche et de ce qu'il y a derrière séparées (estimation « ML ») : le
  plan du milieu ne garde aucune trace de branche ;
- le mouvement de page.js ne découvre jamais ce que les branches cachent : elles partent un peu plus
  resserrées que sur la photo (plan avant moins agrandi que le chalet) et s'ouvrent jusqu'à la photo
  exacte en fin de course ; on ne voit donc derrière elles que du vrai chalet. Sous la branche opaque,
  une reconstitution (LaMa, à partir du fond nettoyé) ne sert qu'aux petits jours entre les aiguilles ;
- fond : le ciel (très clair, lointain), prolongé en douceur sous le chalet.
Au repos, avant ∘ milieu ∘ fond redonne la photo.

Sorties : public/assets/scenes/vca/back, mid, front (AVIF + WebP, avec transparence pour milieu et avant)
et scene.json ; contrôles dans tools/.cache/vca/ (alpha, plaque, simulation du mouvement).
"""
import json, os, sys, urllib.request
import numpy as np, cv2
from PIL import Image
from pymatting import estimate_alpha_cf, estimate_foreground_ml

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
FG_D, BG_D = .52, .30   # profondeur : au-delà, branche sûre ; en deçà, chalet ou ciel sûrs
BAND = 150              # px source reconstitués sous le bord des branches
WIDTHS = [828, 1281]
# mouvement de page.js : échelles de départ et d'arrivée autour de l'origine (fraction de l'image) ;
# l'avant n'est jamais plus agrandi que le milieu : rien de caché n'apparaît
MOVE = {'origin': (.5, .46), 'front': (1, 1.13), 'mid': (1.1, 1.13), 'back': (1.05, 1.08)}


def disk(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


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
    dp = os.path.join(QA, 'depth.npy')
    if os.path.exists(dp):
        d = np.load(dp)
    else:
        d = M.depth(img8)
        np.save(dp, d)

    # ——— avant : trimap par la profondeur, puis détourage sur la photo
    fg = keep_main(d > FG_D, 4000)
    fg = cv2.erode(fg.astype(np.uint8), disk(10)) > 0
    near = cv2.dilate(fg.astype(np.uint8), disk(160)) > 0           # le dégradé reste près des branches
    bg = (cv2.erode((d < BG_D).astype(np.uint8), disk(10)) > 0) | ~near
    tri = np.full((H, W), .5, np.float64)
    tri[bg] = 0
    tri[fg] = 1
    h2, w2 = H // 2, W // 2
    i2 = cv2.resize(img, (w2, h2), interpolation=cv2.INTER_AREA).astype(np.float64)
    t2 = cv2.resize(tri, (w2, h2), interpolation=cv2.INTER_NEAREST)
    a2 = np.clip(estimate_alpha_cf(i2, t2), 0, 1).astype(F32)
    a = cv2.resize(a2, (W, H), interpolation=cv2.INTER_CUBIC)
    a = np.clip(guided(img, a, 3, 1e-4), 0, 1).astype(F32)            # recalé à pleine résolution
    a[tri == 1] = 1
    a[tri == 0] = 0
    a[a < .01] = 0
    a[a > .99] = 1
    # couleurs séparées dans le dégradé : branche (F) et ce qu'il y a derrière (B)
    F, B = estimate_foreground_ml(img.astype(np.float64), a.astype(np.float64), return_background=True)
    F, B = F.astype(F32), B.astype(F32)

    # ——— milieu : sous la branche opaque, reconstitué à partir du fond nettoyé
    hole = cv2.dilate((a > .55).astype(np.uint8), disk(2)) > 0
    clean = np.where((a < .01)[..., None], img, B)
    dist = cv2.distanceTransform(hole.astype(np.uint8), cv2.DIST_L2, 5)
    need = hole & (dist <= BAND)
    filled, _ = L.lama_fill(M, clean.copy(), hole, need, rings=3, ring_px=40)
    plate = np.where(hole[..., None], filled, clean).astype(F32)

    # ——— avant : couleur exacte au repos (là où la plaque est reconstituée, on la recalcule)
    front = F.copy()
    e = hole & (a > .02)
    front[e] = np.clip((img[e] - (1 - a[e])[:, None] * plate[e]) / a[e][:, None], 0, 1)

    # ——— fond : le ciel, très clair, peu saturé, en haut ; prolongé sous le chalet
    hsv = cv2.cvtColor((np.clip(plate, 0, 1) * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(F32) / 255
    rows = np.arange(H)[:, None]
    sky = ((hsv[..., 2] > .78) & (hsv[..., 1] < .18) & (rows < H * .42) & ((d < .03) | hole | (a > 0))).astype(F32)
    sky = cv2.morphologyEx(sky, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    sky = keep_main(sky > .5, 3000).astype(F32)
    sky_all = np.clip(guided(plate, sky, 4, 1e-3), 0, 1).astype(F32)
    known = cv2.erode((sky_all > .98).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(F32)
    base = plate.copy(); base[known < 1] = 0
    back = L.push_pull(base, known)
    back = np.where(known[..., None] > 0, plate, cv2.GaussianBlur(back, (0, 0), 8))

    am = (1 - sky_all).astype(F32)
    mid = plate.copy()
    e = (am > .02) & (am < .98)
    mid[e] = np.clip((plate[e] - (1 - am[e])[:, None] * back[e]) / am[e][:, None], 0, 1)

    behind = am[..., None] * mid + (1 - am[..., None]) * back
    comp = a[..., None] * front + (1 - a[..., None]) * behind
    print(f'écart de recomposition au repos {np.abs(comp - img).mean() * 255:.3f}/255')

    # ——— exports
    meta = {'w': W, 'h': H, 'planes': []}
    kb = save_plane(back, os.path.join(OUT, 'back'), False, WIDTHS, 56, 80)
    meta['planes'].append({'name': 'back', 'bbox': [0, 0, W, H], 'files': WIDTHS, 'kb': kb})
    for name, col, al in (('mid', mid, am), ('front', front, a)):
        kb = save_plane(np.dstack([col, al]), os.path.join(OUT, name), True, WIDTHS, 58, 84)
        meta['planes'].append({'name': name, 'bbox': [0, 0, W, H], 'files': WIDTHS, 'kb': kb})
    json.dump(meta, open(os.path.join(OUT, 'scene.json'), 'w'), indent=1)
    print(json.dumps(meta))

    # ——— contrôles : trimap, alpha, plaque, et le mouvement de page.js (fin de course) simulé
    sm = lambda x: cv2.resize(x, (W // 3, H // 3), interpolation=cv2.INTER_AREA)
    to8 = lambda x: (np.clip(x, 0, 1) * 255 + .5).astype(np.uint8)
    Image.fromarray(to8(sm(tri.astype(F32)))).save(os.path.join(QA, 'trimap.jpg'))
    Image.fromarray(to8(sm(a))).save(os.path.join(QA, 'alpha-front.jpg'))
    Image.fromarray(to8(sm(sky_all))).save(os.path.join(QA, 'alpha-sky.jpg'))
    Image.fromarray(to8(sm(plate))).save(os.path.join(QA, 'plate.jpg'), quality=88)
    ox, oy = MOVE['origin'][0] * W, MOVE['origin'][1] * H

    def at(x, s):
        Mx = np.float32([[s, 0, ox * (1 - s)], [0, s, oy * (1 - s)]])
        return cv2.warpAffine(x, Mx, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    scales = lambda t: [MOVE[k][0] + (MOVE[k][1] - MOVE[k][0]) * t for k in ('front', 'mid', 'back')]
    frames = []
    for t in (0, .5, 1):
        sf, smid, sb = scales(t)
        amt = at(am, smid)[..., None]
        out = amt * at(mid, smid) + (1 - amt) * at(back, sb)
        aft = at(a, sf)[..., None]
        out = aft * at(front, sf) + (1 - aft) * out
        frames.append(sm(out))
    Image.fromarray(to8(np.concatenate(frames, 1))).save(os.path.join(QA, 'sim.jpg'), quality=88)
    # ce que le mouvement laisse voir de reconstitué en plus de la photo (sous une branche plus opaque qu'au repos)
    rest = (1 - a) * am * hole
    seen = 0
    for t in np.linspace(0, 1, 11):
        sf, smid, _ = scales(t)
        vis = (1 - at(a, sf)) * at(am, smid) * at(hole.astype(F32), smid)
        seen = max(seen, int((vis > at(rest, smid) + .15).sum()))
    print(f'pixels reconstitués visibles en plus de la photo (max sur la course) : {seen}')

if __name__ == '__main__':
    main()
