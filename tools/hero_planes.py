"""Hero en trois plans de parallaxe : ciel (fond), montagne et forêt (milieu), chalet (avant).

Usage : python tools/hero_planes.py [d|m]   (d = paysage I056, m = portrait I064 ; les deux par défaut)

Entrées : la photo étalonnée (tools/.cache/masters/hero-I056.png / hero-I064.png, voir tools/retouch/hero.py),
son masque de ciel (public/assets/img/hero-sky-d.png / -m.png, alpha = ciel), et les modèles hors ligne
(Depth Anything V2, SAM 2.1, LaMa) chargés par tools/layers.py depuis le cache Hugging Face
(HF_HOME, HF_HUB_OFFLINE=1).

Méthode, plan par plan :
- avant (chalet) : segmentation SAM 2.1 (boîte + points) ∪ profondeur proche, sans le ciel, sans les
  îlots isolés ; bords calés sur la photo par un filtre guidé couleur ; contact avec le ciel = masque de ciel.
- milieu : tout ce qui n'est pas du ciel ; sous le chalet, la montagne et les sapins sont reconstitués
  (LaMa) dans la bande que le mouvement peut découvrir ;
- fond : le ciel, prolongé en douceur sous la montagne (jamais visible au-delà de quelques pixels).
Couleurs « décontaminées » sur les bords : au repos, avant ∘ milieu ∘ fond redonne la photo exacte.

Sorties : public/assets/hero/<d|m>/back, mid, front en AVIF + WebP (mid et front recadrés à leur
boîte, avec transparence), hero.json (tailles et boîtes), et des contrôles dans tools/.cache/hero/.
"""
import json, os, sys
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import layers as L  # noqa: E402  (tools/layers.py : modèles hors ligne, remplissage LaMa)

F32 = np.float32
QA = os.path.join(ROOT, 'tools', '.cache', 'hero')

CFG = {
    'd': {
        'src': 'tools/.cache/masters/hero-I056.png', 'sky': 'public/assets/img/hero-sky-d.png',
        'box': [0, 160, 1508, 1281],                    # le chalet (x0, y0, x1, y1)
        'points': [(300, 600, 1), (620, 700, 1), (180, 420, 1), (900, 520, 1), (560, 1150, 1), (1300, 930, 1), (760, 980, 1),
                   (1000, 820, 0), (1250, 760, 0), (1500, 500, 0), (1700, 900, 0), (1150, 960, 0)],
        'depth_front': .30,
        'rail': [740, 1070, 820, 1508],                 # zone du garde-corps : sapins vus entre les lames
        'band': 190,                                    # px source découvrables sous le chalet (scroll + pointeur)
        'widths': [1280, 1920],
    },
    'm': {
        'src': 'tools/.cache/masters/hero-I064.png', 'sky': 'public/assets/img/hero-sky-m.png',
        'box': [0, 300, 1180, 1920],
        'points': [(250, 900, 1), (180, 600, 1), (500, 800, 1), (300, 1300, 1), (650, 1100, 1), (900, 1000, 1), (600, 1500, 1),
                   (1100, 600, 0), (1000, 1150, 0), (1200, 1400, 0), (750, 1300, 0)],
        'depth_front': .30,
        'rail': [1000, 1300, 330, 1180],
        'snow': .78,                                    # neige du premier plan (profondeur très proche) → avant
        'band': 210,
        'widths': [828, 1080],
    },
}


def guided(I, p, r, eps):
    """Filtre guidé couleur (He et al.) : le masque p épouse les contours de l'image I."""
    H, W = p.shape
    mean = lambda x: cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1))
    mI = [mean(I[..., c]) for c in range(3)]
    mp = mean(p)
    cov = np.stack([mean(I[..., c] * p) - mI[c] * mp for c in range(3)], -1)
    var = np.empty((H, W, 3, 3), F32)
    for i in range(3):
        for j in range(3):
            var[..., i, j] = mean(I[..., i] * I[..., j]) - mI[i] * mI[j]
    var += eps * np.eye(3, dtype=F32)
    a = np.linalg.solve(var, cov[..., None])[..., 0]
    b = mp - (a * np.stack(mI, -1)).sum(-1)
    return (np.stack([mean(a[..., c]) for c in range(3)], -1) * I).sum(-1) + mean(b)


def keep_main(mask, min_px):
    """Retire les îlots plus petits que min_px (brindilles, reflets isolés)."""
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    keep = np.zeros(n, bool)
    keep[1:] = st[1:, cv2.CC_STAT_AREA] >= min_px
    return keep[lab]


def save_plane(rgba_or_rgb, base, alpha, widths, q_avif, q_webp):
    im = Image.fromarray((np.clip(rgba_or_rgb, 0, 1) * 255 + .5).astype(np.uint8), 'RGBA' if alpha else 'RGB')
    out = {}
    W0 = im.width
    for w in widths:
        r = im if w >= W0 else im.resize((w, round(im.height * w / W0)), Image.LANCZOS)
        r.save(f'{base}-{w}.avif', 'AVIF', quality=q_avif, speed=4)
        r.save(f'{base}-{w}.webp', 'WEBP', quality=q_webp, method=6, **({'alpha_quality': 92} if alpha else {}))
        out[w] = os.path.getsize(f'{base}-{w}.avif') // 1024
    return out


def run(key, M):
    c = CFG[key]
    img8 = np.array(Image.open(os.path.join(ROOT, c['src'])).convert('RGB'))
    img = img8.astype(F32) / 255
    H, W = img.shape[:2]
    sky = np.array(Image.open(os.path.join(ROOT, c['sky'])).convert('LA'))[..., 1].astype(F32) / 255
    os.makedirs(QA, exist_ok=True)

    # ——— avant : le chalet
    d = M.depth(img8)
    sam, iou = M.sam(img8, box=c['box'], points=c['points'])
    print(f'{key}: SAM iou {iou:.3f}')
    x0, y0, x1, y1 = c['box']
    box = np.zeros((H, W), bool)
    box[y0:y1, x0:x1] = True
    hard = ((sam > .5) | (d > c['depth_front'])) & box & (sky < .5)
    if c.get('snow'):
        hard |= (d > c['snow']) & (np.arange(H)[:, None] > H * .75) & (sky < .5)
    # entre les lames du garde-corps : les sapins du fond (sombres, verts, lointains) ne sont pas le chalet
    ry0, ry1, rx0, rx1 = c['rail']
    zone = np.zeros((H, W), bool)
    zone[ry0:ry1, rx0:rx1] = True
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    tree = (g >= r * .92) & (img.max(-1) < .42) & (d < .45)
    hard &= ~(zone & tree)
    hard = keep_main(hard, 2500)
    soft = np.clip(guided(img, hard.astype(F32), 3, 4e-3), 0, 1)
    soft = np.where(cv2.dilate(hard.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0, soft, 0)
    af = np.clip(np.minimum(soft, 1 - sky), 0, 1).astype(F32)
    af[af < .02] = 0

    # ——— fond : le ciel, prolongé en douceur sous tout le reste
    known = cv2.erode((sky > .995).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(F32)  # pas de bord contaminé
    base = img.copy()
    base[known < 1] = 0
    sky_fill = L.push_pull(base, known)
    sky_fill = np.where(known[..., None] > 0, img, cv2.GaussianBlur(sky_fill, (0, 0), 6))
    back = sky_fill

    # ——— milieu : tout le non-ciel ; sous le chalet, reconstitué dans la bande découvrable
    am = (1 - sky).astype(F32)
    hole = af > .02
    dist = cv2.distanceTransform(hole.astype(np.uint8), cv2.DIST_L2, 5)
    need = hole & (dist <= c['band'])
    mid_src = img.copy()
    filled, done = L.lama_fill(M, mid_src, hole, need, rings=2, ring_px=24)
    mid = np.where(hole[..., None], filled, img)
    # couleurs décontaminées au bord du ciel : am·mid + (1−am)·ciel = photo
    e = (am > .02) & (am < .98) & ~hole
    mid[e] = np.clip((img[e] - (1 - am[e])[:, None] * back[e]) / am[e][:, None], 0, 1)

    # ——— avant : couleurs décontaminées contre ce qu'il y a derrière (milieu sur fond)
    behind = am[..., None] * mid + (1 - am[..., None]) * back
    e = (af > .02) & (af < .98)
    front = img.copy()
    front[e] = np.clip((img[e] - (1 - af[e])[:, None] * behind[e]) / af[e][:, None], 0, 1)

    # ——— contrôle : recomposition au repos
    comp = af[..., None] * front + (1 - af[..., None]) * behind
    diff = np.abs(comp - img).mean() * 255
    print(f'{key}: écart de recomposition au repos {diff:.3f}/255')

    # ——— exports
    out = os.path.join(ROOT, 'public', 'assets', 'hero', key)
    os.makedirs(out, exist_ok=True)
    meta = {'w': W, 'h': H, 'planes': []}
    kb = save_plane(back, os.path.join(out, 'back'), False, c['widths'], 50, 80)
    meta['planes'].append({'name': 'back', 'bbox': [0, 0, W, H], 'kb': kb})
    for name, col, a in (('mid', mid, am), ('front', front, af)):
        ys, xs = np.where(a > .01)
        bb = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
        rgba = np.dstack([col, a])[bb[1]:bb[3], bb[0]:bb[2]]
        ws = [round(w * (bb[2] - bb[0]) / W) for w in c['widths']]
        kb = save_plane(rgba, os.path.join(out, name), True, ws, 56, 84)
        meta['planes'].append({'name': name, 'bbox': bb, 'files': ws, 'kb': kb})
    meta['widths'] = c['widths']
    json.dump(meta, open(os.path.join(out, 'hero.json'), 'w'), indent=1)
    print(f'{key}:', json.dumps(meta))

    # ——— contrôle des trous découverts par le mouvement (fond et milieu décalés par rapport à l'avant ;
    # pointeur ±16 px (avant) / ±8 px (milieu)) ; trous en magenta
    def shift(rgb, a, dx, dy):
        Mx = np.float32([[1, 0, dx], [0, 1, dy]])
        return (cv2.warpAffine(rgb, Mx, (W, H), borderValue=(1, 0, 1)), cv2.warpAffine(a, Mx, (W, H), borderValue=0))
    k = 1 / .75 if key == 'd' else 1 / .44          # px source par px écran (hauteur du viewport de référence)
    vh = 900 if key == 'd' else 844
    frames = []
    for (px, sc) in ((0, 0), (-1, .35), (1, .35), (0, .7)):
        s_ = sc * vh * k
        bR, bA = shift(back, np.ones((H, W), F32), 0, .45 * s_)
        mR, mA = shift(mid, am, px * 8 * k, .12 * s_)
        fR, fA = shift(front, af, px * 16 * k, 0)
        cm = mA[..., None] * mR + (1 - mA[..., None]) * bR
        frames.append(fA[..., None] * fR + (1 - fA[..., None]) * cm)
    sim = np.concatenate([cv2.resize(f, (W // 2, H // 2)) for f in frames], 1)
    Image.fromarray((np.clip(sim, 0, 1) * 255).astype(np.uint8)).save(os.path.join(QA, f'sim-{key}.jpg'), quality=86)
    np.save(os.path.join(QA, f'af-{key}.npy'), af)


if __name__ == '__main__':
    keys = sys.argv[1:] or ['d', 'm']
    M = L.Models(threads=4)
    for k in keys:
        run(k, M)
