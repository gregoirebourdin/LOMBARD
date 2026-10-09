"""Étape 2 : découpe des plans, bords, remplissage de l'arrière-plan.

Usage : python planes.py <work_dir> <scene>    (configuration : scenes.json)

Principe (brief §5.5)
- Chaque pixel reçoit une « couverture » cumulée par plan, du fond vers l'avant :
  c0 = 1 (ciel), c1 = 1 - ciel, ck = transition douce sur la carte de profondeur.
  Une transition douce sur la profondeur donne naturellement des bords nets aux
  ruptures d'occlusion (la profondeur saute) et un fondu large sur un sol continu
  (la profondeur varie lentement) : pas de « marche » visible dans le terrain.
- Bords affinés par filtre guidé sur l'image (contour adouci de 1 à 3 px), puis
  décontamination des couleurs (pymatting) sur les bords nets seulement ; le plan de
  derrière reçoit, sous ce bord, le fond estimé par le même matting (le ciel, lui, est
  extrapolé). Dans une transition large (sol, pente), les plans gardent les vrais pixels.
- Opacité exacte : là où les plans de devant laissent voir, chaque plan couvre sa part
  de ce qui reste visible, own / (1 - devant). Composés, les plans redonnent la photo au
  repos, sans voile de ciel dans les fondus ni plan intermédiaire derrière une branche.
- Chaque plan sauf le premier est comblé derrière les zones opaques des plans du dessus,
  au-delà du déplacement relatif maximal calculé pixel par pixel (motion.py), et
  seulement là où c'est lui qui continue derrière le bord (sinon, c'est un plan plus
  lointain qui se découvre) : poussée-tirée pour le ciel, LaMa ailleurs. L'IA ne sert
  qu'à combler ciel, neige, forêt ou versant derrière un plan découpé, jamais à inventer
  de l'architecture.
"""
import json, os, sys, glob, numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from motion import plane_transform

HERE = os.path.dirname(__file__)
CFG = json.load(open(os.path.join(HERE, 'scenes.json')))


def guided(I, p, r, eps):
    k = (2 * r + 1, 2 * r + 1)
    m = lambda x: cv2.boxFilter(x, -1, k)
    mI, mp = m(I), m(p)
    a = (m(I * p) - mI * mp) / (m(I * I) - mI * mI + eps)
    b = mp - a * mI
    return m(a) * I + m(b)


def sharp_band(a):
    """Bord net d'une couverture (quelques px à 1 920 px de large) : là où le matting a un sens.
    Les fondus larges (sol, pente) en sont exclus : leurs vrais pixels se recomposent déjà en la photo."""
    u = a.shape[1] / 1920.0  # les bords s'élargissent avec la résolution (filtre guidé à l'échelle)
    gy_, gx_ = np.gradient(cv2.GaussianBlur(a, (0, 0), max(1.0, u)))
    k = max(5, int(round(5 * u)) | 1)
    sharp = cv2.dilate((np.hypot(gx_, gy_) > 0.06 / u).astype(np.uint8), np.ones((k, k), np.uint8)).astype(bool)
    return (a > 0.01) & (a < 0.99) & sharp


def matte(g, a, band):
    """Matting (pymatting) sur la zone utile de la bande : couleurs du plan et du fond, séparées.
    Renvoie (zone, F, B) ; F * a + B * (1 - a) redonne la photo."""
    from pymatting import estimate_foreground_ml
    H, W = a.shape
    ys, xs = np.where(band)
    y0, y1, x0, x1 = max(ys.min() - 8, 0), min(ys.max() + 9, H), max(xs.min() - 8, 0), min(xs.max() + 9, W)
    F, B = estimate_foreground_ml(g[y0:y1, x0:x1].astype(np.float64), np.clip(a[y0:y1, x0:x1], 0, 1).astype(np.float64),
                                  return_background=True)
    return (slice(y0, y1), slice(x0, x1)), F.astype(np.float32), B.astype(np.float32)


def nearest_owner(owns, front, f=4):
    """Pour chaque pixel, le plan (parmi owns, du fond vers ce plan) qui possède le pixel visible
    le plus proche, hors du plan de devant. C'est lui qui continue derrière le bord de devant."""
    H, W = front.shape
    h, w = max(1, H // f), max(1, W // f)
    vis = cv2.resize((front < 0.5).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
    owner = np.stack([cv2.resize(o, (w, h), interpolation=cv2.INTER_AREA) for o in owns]).argmax(0).astype(np.int32)
    if vis.any() and not vis.all():
        _, lab = cv2.distanceTransformWithLabels((vis == 0).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
        pos = np.zeros(lab.max() + 1, np.int64)
        pos[lab[vis == 1]] = np.flatnonzero(vis == 1)
        owner = owner.ravel()[pos[lab]].reshape(h, w)
    return cv2.resize(owner.astype(np.float32), (W, H), interpolation=cv2.INTER_NEAREST).astype(np.int32)


def sstep(x, t, w):
    return 1.0 / (1.0 + np.exp(-np.clip((x - t) / max(w, 1e-6) * 4.0, -30, 30)))


def push_pull(img, known):
    """Remplissage lisse (ciel) : convolution normalisée sur pyramide."""
    levels, im, m = [], img * known[..., None], known.astype(np.float32)
    while min(m.shape) > 8:
        levels.append((im, m)); im, m = cv2.pyrDown(im), cv2.pyrDown(m)
    fill = im / np.maximum(m[..., None], 1e-6)
    empty = (m < 1e-4).astype(np.uint8)
    if empty.any():  # extrapolation au niveau le plus grossier (voisins connus)
        f8 = np.clip(fill * 255, 0, 255).astype(np.uint8)
        fill = cv2.inpaint(f8, empty, 3, cv2.INPAINT_NS).astype(np.float32) / 255
    for im_l, m_l in reversed(levels):
        up = cv2.resize(fill, (m_l.shape[1], m_l.shape[0]), interpolation=cv2.INTER_LINEAR)
        cur = im_l / np.maximum(m_l[..., None], 1e-6)
        w = np.clip(m_l * 3.0, 0, 1)[..., None]
        fill = cur * w + up * (1 - w)
    return fill


def mirror_fill(img, hole, max_run=None):
    """Remplit chaque colonne d'un trou par le miroir des vrais pixels situés juste au-dessus
    de son bord haut (le sol continue derrière le premier plan). Sans couture au bord, et net.
    Retourne l'image et le masque des pixels qu'on n'a pas pu remplir ainsi."""
    H, W = hole.shape
    ys = np.arange(H)[:, None].repeat(W, 1)
    start = hole & ~np.vstack([np.zeros((1, W), bool), hole[:-1]])
    top = np.maximum.accumulate(np.where(start, ys, 0), axis=0)
    d = ys - top
    src = top - 1 - d
    xs = np.arange(W)[None, :].repeat(H, 0)
    ok = hole & (src >= 0) & (top > 0)
    if max_run is not None:
        ok &= d < max_run
    srcc = np.clip(src, 0, H - 1)
    ok &= ~hole[srcc, xs]
    out = img.copy()
    out[ok] = img[srcc[ok], xs[ok]]
    return out, hole & ~ok


_lama = None
def lama_session():
    global _lama
    if _lama is None:
        import onnxruntime as ort
        p = os.environ.get('LAMA_ONNX') or glob.glob(os.path.join(os.environ.get('HF_CACHE', 'models/hf'), 'models--Carve--LaMa-ONNX/snapshots/*/lama_fp32.onnx'))[0]
        so = ort.SessionOptions(); so.intra_op_num_threads = 4
        _lama = ort.InferenceSession(p, so, providers=['CPUExecutionProvider'])
    return _lama


def lama_fill(img, hole, tile=1024, stride=768):
    """img float32 HxWx3 [0,1] ; hole bool. Remplit par tuiles carrées réduites à 512 px."""
    sess = lama_session()
    out = img.copy(); todo = hole.copy()
    H, W = hole.shape
    ys, xs = np.where(hole)
    if len(ys) == 0:
        return out
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    t = min(tile, max(H, W))
    for ty in range(max(0, y0 - t // 4), max(y1, y0 + 1), stride):
        for tx in range(max(0, x0 - t // 4), max(x1, x0 + 1), stride):
            ya, xa = min(ty, max(H - t, 0)), min(tx, max(W - t, 0))
            yb, xb = min(ya + t, H), min(xa + t, W)
            hm = todo[ya:yb, xa:xb]
            if hm.sum() < 16:
                continue
            crop = out[ya:yb, xa:xb]
            ci = cv2.resize(crop, (512, 512), interpolation=cv2.INTER_AREA)
            cm = cv2.resize(hm.astype(np.float32), (512, 512), interpolation=cv2.INTER_LINEAR)
            cm = (cv2.dilate((cm > 0.01).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0).astype(np.float32)
            res = sess.run(None, {'image': ci.transpose(2, 0, 1)[None].astype(np.float32),
                                  'mask': cm[None, None]})[0][0].transpose(1, 2, 0)
            if res.max() > 2:
                res = res / 255.0
            res = cv2.resize(np.clip(res, 0, 1).astype(np.float32), (xb - xa, yb - ya), interpolation=cv2.INTER_CUBIC)
            soft = cv2.GaussianBlur(hm.astype(np.float32), (0, 0), 2)
            soft = np.maximum(soft, hm.astype(np.float32))[..., None]
            out[ya:yb, xa:xb] = crop * (1 - soft) + res * soft
            todo[ya:yb, xa:xb] = False
    return out


def displacement(c, k, p, gx, gy, W, H):
    """Déplacement (px source) du plan k à l'instant p, sur une grille de points (modèle de motion.py)."""
    sc, y, x = plane_transform(c, k, p)
    if c.get('motion') == 'pan':
        return np.full_like(gx, x * W / (1.6 * 1920)), np.zeros_like(gy)
    ox, oy = c.get('origin', [0.5, 0.5])
    u = W / 1920.0
    return (sc - 1) * (gx - ox * W) + x * u, (sc - 1) * (gy - oy * H) + y * u


def needed_ext(c, k, fronts, W, H, f=8):
    """Étendue utile du plan k derrière les plans de devant. On rejoue le mouvement (même modèle
    que le site, motion.py) sur une grille réduite au 1/f : un pixel du plan k est utile si, à un
    instant, les plans de devant, déplacés avec leurs propres extensions (fronts : j -> opacité
    réduite), le laissent voir. On y ajoute la marge de la souris et le pas entre deux instants.
    Seuls les côtés qui se découvrent vraiment sont étendus."""
    n = len(c['planes'])
    h, w = max(1, H // f), max(1, W // f)
    gy, gx = (np.mgrid[0:h, 0:w].astype(np.float32) + 0.5) * f
    ps = np.linspace(0, 1, 11)
    pan = c.get('motion') == 'pan'
    ox, oy = c.get('origin', [0.5, 0.5])
    u = W / 1920.0
    sp = [pl['speed'] for pl in c['planes']]
    mouse = c.get('mouse', 12) * u
    seen = np.zeros((h, w), np.float32)
    step, prev = 0.0, None
    for p in ps:
        dxk, dyk = displacement(c, k, p, gx, gy, W, H)
        X, Y = gx + dxk, gy + dyk  # position à l'écran, en px source
        vis = np.ones((h, w), np.float32)
        rel = []
        for j in range(k + 1, n):
            sj, yj, xj = plane_transform(c, j, p)
            if pan:
                xs, ys = X - xj * W / (1.6 * 1920), Y
            else:  # inverse du plan j : X = o + sj (xj - o) + décalage
                xs, ys = ox * W + (X - ox * W - xj * u) / sj, oy * H + (Y - oy * H - yj * u) / sj
            a = cv2.remap(fronts[j], (xs / f - 0.5).astype(np.float32), (ys / f - 0.5).astype(np.float32),
                          cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            vis *= 1 - np.clip(a, 0, 1)
            rel.append((xs - gx, ys - gy))
        if prev is not None:
            step = max(step, max(float(np.hypot(a[0] - b[0], a[1] - b[1]).max()) for a, b in zip(rel, prev)))
        prev = rel
        seen = np.maximum(seen, vis)
    r = mouse * max(abs(sp[j] - sp[k]) for j in range(k + 1, n)) / 0.8 * 2 + step + 8
    rr = int(np.ceil(r / f))
    disk = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * rr + 1, 2 * rr + 1))
    return cv2.dilate((seen > 0.05).astype(np.uint8), disk).astype(np.float32)


def sky_mask(g, disp, c):
    """Ciel : bleu ou nuage, très loin, relié au bord haut."""
    r, gg, b = g[..., 0], g[..., 1], g[..., 2]
    L = g.mean(-1)
    blue = sstep(b - np.maximum(r, gg), c.get('blue', 0.10), 0.04)
    cloud = sstep(L, c.get('cloud_L', 2.0), 0.03) * (1 - sstep(g.max(-1) - g.min(-1), 0.12, 0.04))
    far = 1 - sstep(disp, c.get('far', 0.02), c.get('far_w', 0.006))
    p = np.maximum(blue, cloud) * far
    if 'match' in c:
        # Ciel franc : une roche à l'ombre, bleuie, passerait le test du bleu. On exige en plus
        # la couleur du ciel voisin, extrapolée depuis le grand ciel (les petites poches, érodées,
        # n'y contribuent pas).
        m = c['match']
        er = max(3, int(m.get('erode', 0.02) * g.shape[1])) | 1
        sure = cv2.erode((p > 0.9).astype(np.uint8), np.ones((er, er), np.uint8)).astype(np.float32)
        skycol = push_pull(g, sure)
        dist = np.sqrt(((g - skycol) ** 2).sum(-1))
        t0, t1 = m.get('t', [0.08, 0.2])
        p = p * np.clip((t1 - dist) / (t1 - t0), 0, 1)
    if 'hard' in c:
        # ciel franc (bleu profond, sans nuage) : une roche à l'ombre, un peu bleue, reste roche
        p = sstep(p, 0.5, c['hard'])
    if 'key' in c:
        # Ciel pâle vu entre des aiguilles ou des branches : trop peu bleu pour le seuil, et la carte
        # de profondeur, lisse, le donne parfois proche. Au-dessus de la ligne indiquée, on le
        # reconnaît à sa couleur, comparée à celle du ciel voisin (extrapolée depuis le ciel sûr).
        k = c['key']
        sure = cv2.erode((p > 0.9).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
        skycol = push_pull(g, sure)
        dist = np.sqrt(((g - skycol) ** 2).sum(-1))
        t0, t1 = k.get('t', [0.05, 0.18])
        rows = np.arange(g.shape[0], dtype=np.float32)[:, None] / g.shape[0]
        kp = np.clip((t1 - dist) / (t1 - t0), 0, 1) * (1 - sstep(rows, k.get('ymax', 1.0), 0.02))
        p = np.maximum(p, kp)
    if not c.get('connect', True):  # ciel vu entre les branches : pas d'exigence de connexité
        return np.clip(p, 0, 1)
    hard = (p > 0.5).astype(np.uint8)
    n, lab = cv2.connectedComponents(hard, connectivity=4)
    top = set(np.unique(lab[: max(2, hard.shape[0] // 200)])) - {0}
    keep = np.isin(lab, list(top)).astype(np.float32)
    keep = cv2.dilate(keep, np.ones((9, 9), np.uint8))
    return np.clip(p * keep, 0, 1)


def polygon_mask(shape, polys, scale):
    m = np.zeros(shape, np.uint8)
    for poly in polys:
        pts = (np.array(poly, np.float32) * scale).astype(np.int32)
        cv2.fillPoly(m, [pts], 1)
    return m.astype(np.float32)


def sam_mask(g8, boxes, points=None):
    import torch
    from transformers import Sam2Processor, Sam2Model
    path = os.environ.get('SAM_MODEL', 'facebook/sam2.1-hiera-base-plus')
    proc = Sam2Processor.from_pretrained(path, cache_dir=os.environ.get('HF_CACHE'))
    model = Sam2Model.from_pretrained(path, cache_dir=os.environ.get('HF_CACHE')).eval()
    acc = np.zeros(g8.shape[:2], np.float32)
    for i, box in enumerate(boxes):
        kw = dict(images=Image.fromarray(g8), input_boxes=[[box]], return_tensors='pt')
        if points and i < len(points) and points[i]:
            kw['input_points'] = [[[p[:2] for p in points[i]]]]
            kw['input_labels'] = [[[p[2] for p in points[i]]]]
        inp = proc(**kw)
        with torch.inference_mode():
            out = model(**inp, multimask_output=False)
        m = proc.post_process_masks(out.pred_masks, inp['original_sizes'], binarize=False)[0]
        m = torch.sigmoid(m[0, 0]).numpy() if m.ndim == 4 else torch.sigmoid(m[0]).numpy()
        acc = np.maximum(acc, m.astype(np.float32))
    return acc


def main(work, scene):
    c = CFG['scenes'][scene]
    d = os.path.join(work, scene)
    g8 = np.asarray(Image.open(os.path.join(d, 'graded.png')).convert('RGB'))
    g = g8.astype(np.float32) / 255.0
    disp = np.load(os.path.join(d, 'depth.npy')).astype(np.float32)
    H, W = disp.shape
    gray = cv2.cvtColor(g, cv2.COLOR_RGB2GRAY)
    planes = c['planes']
    n = len(planes)
    scale = W / c.get('ref_width', W)  # coordonnées de config exprimées sur ref_width

    # --- couvertures cumulées (fond -> avant)
    cov = [np.ones((H, W), np.float32)]
    sky = sky_mask(g, disp, c.get('sky', {})) if planes[0].get('sky', True) else np.zeros((H, W), np.float32)
    for k in range(1, n):
        p = planes[k]
        if k == 1 and planes[0].get('sky', True):
            ck = 1 - sky
            if 'depth' in p:
                ck = np.minimum(ck, sstep(disp, p['depth'], p.get('w', 0.01)))
        else:
            ck = sstep(disp, p['depth'], p.get('w', 0.02)) if 'depth' in p else np.zeros((H, W), np.float32)
        if 'sam' in p:
            sm = sam_mask(g8, [[v * scale for v in b] for b in p['sam']], p.get('sam_points'))
            np.save(os.path.join(d, f'sam_{k}.npy'), sm.astype(np.float16))
            ck = np.maximum(ck, sm) if p.get('sam_mode', 'add') == 'add' else sm
        if p.get('edge_connected'):  # ne garder que les masses reliées aux bords gauche, droit ou bas
            hard = (ck > 0.5).astype(np.uint8)
            n_, lab = cv2.connectedComponents(hard)
            edge = set(np.unique(lab[:, :3])) | set(np.unique(lab[:, -3:])) | set(np.unique(lab[-3:, :]))
            keep = np.isin(lab, list(edge - {0})).astype(np.float32)
            ck = ck * cv2.GaussianBlur(cv2.dilate(keep, np.ones((9, 9), np.uint8)), (0, 0), 2)
        if 'absorb_px' in p:
            # Branches fines devant le ciel : la profondeur, lisse, ne suit pas les aiguilles.
            # Près des parties sûres de ce plan et du ciel, tout ce qui n'est pas ciel lui revient, pour que
            # les aiguilles bougent avec leur branche au lieu de laisser un fantôme au plan d'arrière.
            rr = max(1, int(round(p['absorb_px'] * W / 1920)))
            disk = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * rr + 1, 2 * rr + 1))
            near = cv2.dilate((ck > 0.5).astype(np.uint8), disk) & cv2.dilate((sky > 0.5).astype(np.uint8), disk)
            ck = np.maximum(ck, cov[-1] * cv2.GaussianBlur(near.astype(np.float32), (0, 0), rr / 3))
        if 'add_poly' in p:
            ck = np.maximum(ck, cv2.GaussianBlur(polygon_mask((H, W), p['add_poly'], scale), (0, 0), 3))
        if 'sub_poly' in p:
            ck = ck * (1 - cv2.GaussianBlur(polygon_mask((H, W), p['sub_poly'], scale), (0, 0), 3))
        cov.append(np.minimum(ck, cov[-1]))

    # --- affinage des bords : filtre guidé (sauf transitions de sol volontairement larges)
    r = max(2, int(round(c.get('edge_px', 3) * W / 1920)))
    for k in range(1, n):
        cg = guided(gray, cov[k], r, 2e-4)
        cov[k] = np.clip(cg, 0, 1)
    for k in range(2, n):
        cov[k] = np.minimum(cov[k], cov[k - 1])

    os.makedirs(os.path.join(d, 'planes'), exist_ok=True)
    owns = [np.clip(cov[k] - (cov[k + 1] if k + 1 < n else 0), 0, 1) for k in range(n)]
    hths = [planes[k].get('hole_th', c.get('hole_th', 0.98)) for k in range(n)]

    # --- opacités, du premier plan vers le fond : l'étendue utile d'un plan dépend de ce que
    # couvrent vraiment les plans de devant, extensions comprises.
    # Là où les plans de devant laissent voir, un plan couvre exactement sa part de ce qui reste
    # visible : own / (1 - front). Composés l'un sur l'autre, les plans redonnent alors la photo
    # au repos (un fondu large sur fond opaque reste opaque ; derrière une branche fine devant le
    # ciel, le plan s'efface et c'est le ciel qui se voit). Sous les zones presque opaques des
    # plans de devant s'ajoute la marge de mouvement, là où ce plan continue derrière le bord
    # (sinon c'est un plan plus lointain qui se découvre, le ciel par exemple).
    f8 = 8
    alphas, small = [np.ones((H, W), np.float32)] + [None] * (n - 1), {}
    for k in range(n - 1, 0, -1):
        front = cov[k + 1] if k + 1 < n else np.zeros((H, W), np.float32)
        exact = np.clip(owns[k] / np.maximum(1 - front, 1e-4), 0, 1)
        if k == n - 1:
            alpha = exact
        else:
            ext = cv2.resize(needed_ext(c, k, small, W, H, f8), (W, H), interpolation=cv2.INTER_LINEAR)
            ext = cv2.GaussianBlur(ext, (0, 0), 6)
            mine = cv2.GaussianBlur((nearest_owner(owns[:k + 1], front) == k).astype(np.float32), (0, 0), max(2.0, W / 640))
            behind = np.clip(cov[k] * ext * np.clip(mine * 2, 0, 1), 0, 1)
            alpha = np.where(front < hths[k], exact, np.maximum(exact, np.minimum(behind, cov[k])))
        alphas[k] = alpha.astype(np.float32)
        small[k] = cv2.resize(alphas[k], (max(1, W // f8), max(1, H // f8)), interpolation=cv2.INTER_AREA)

    previews = []
    for k in range(n):
        name = planes[k]['name']
        front = cov[k + 1] if k + 1 < n else np.zeros((H, W), np.float32)
        own = np.clip(cov[k] - front, 0, 1)
        # Bord net du plan de devant : ce plan-ci y reçoit le fond estimé par matting, pour que
        # plan de devant (couleurs décontaminées) et plan de derrière redonnent la photo au repos.
        # Le fond n'est fiable que là où le plan de devant est assez transparent (front < 0,7).
        # Le ciel n'en reçoit pas : près d'un bord, il est extrapolé depuis le ciel sûr, sinon le
        # bord de la crête ou des aiguilles y resterait en fantôme quand le plan bouge
        # (option de scène « sky_edges: matte » pour revenir au fond estimé).
        sky_extra = c.get('sky_edges', 'extrapolate') == 'extrapolate'
        fband = sharp_band(front) & (front < 0.7) if k < n - 1 and not (k == 0 and sky_extra) else np.zeros((H, W), bool)
        fm = matte(g, front, fband) if fband.any() else None
        if k == 0:
            alpha = np.ones((H, W), np.float32)
            known = sky > 0.85
            er = max(7, int(W / 256)) | 1
            known = cv2.erode(known.astype(np.uint8), np.ones((er, er), np.uint8)).astype(bool)
            fill = push_pull(g, known.astype(np.float32))
            fill = cv2.GaussianBlur(fill, (0, 0), 1.2)
            # transition douce entre ciel réel et ciel extrapolé ; partout où le ciel se voit au repos
            # (nuages, brume, fondus larges), il garde ses vrais pixels. Seul le ciel caché, ou vu
            # derrière un bord net (aiguilles, crête), est extrapolé.
            kb = cv2.GaussianBlur(known.astype(np.float32), (0, 0), 4)
            vis = np.clip((0.99 - front) / 0.04, 0, 1)
            if sky_extra:
                # Près d'un bord net ou d'un plan plein, le ciel réel garde le liseré clair de la photo :
                # il est extrapolé lui aussi, sinon ce liseré resterait en fantôme quand le plan bouge.
                edge = cv2.dilate((sharp_band(front) | (front > 0.5)).astype(np.uint8), np.ones((er, er), np.uint8))
                vis = vis * (1 - cv2.GaussianBlur(edge.astype(np.float32), (0, 0), 2))
            w = np.maximum(kb, vis)[..., None]
            rgb = g * w + fill * (1 - w)
        else:
            alpha, hth = alphas[k], hths[k]
            # On ne comble que derrière les zones vraiment opaques des plans de devant (+ 7 px pour
            # les bords nets). Dans une transition douce (un sol continu), on garde les vrais
            # pixels : un léger dédoublement de texture se voit moins qu'un remplissage flou.
            hole = cv2.dilate((front > hth).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool) & (alpha > 0.01)
            hole &= ~((own > 0.9) & (front < 0.05))
            # décontamination des couleurs sur les bords nets seulement (transition de quelques px) ;
            # dans une transition large (sol, pente), on garde les vrais pixels : au repos,
            # plan avant et plan arrière se recomposent alors exactement en la photo.
            band = sharp_band(own)
            rgb = g.copy()
            if band.any():
                z, F, _ = matte(g, own, band)
                rgb[z] = np.where(band[z][..., None], F, g[z])
            if hole.any():
                method = planes[k].get('fill', 'lama')
                if method == 'pushpull':
                    rgb = np.where(hole[..., None], push_pull(rgb, (~hole).astype(np.float32)), rgb)
                elif method == 'mirror':
                    # le sol ou le versant continue : miroir net, puis LaMa pour le reste
                    rgb, rest = mirror_fill(rgb, hole)
                    if rest.any():
                        rgb = lama_fill(rgb, rest)
                else:
                    rgb = lama_fill(rgb, hole)
            fband &= front <= hth  # derrière les zones comblées, le remplissage reste
        if fm is not None:
            z, _, B = fm
            if k == 0:  # pour le ciel, un fond estimé trop éloigné du ciel extrapolé est rejeté
                B = np.where((np.abs(B - fill[z]).max(-1) < 0.12)[..., None], B, fill[z])
            rgb[z] = np.where(fband[z][..., None], B, rgb[z])
        a8 = (np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8)
        rgba = np.dstack([(np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8), a8])
        Image.fromarray(rgba, 'RGBA').save(os.path.join(d, 'planes', f'{k}-{name}.png'))
        previews.append(rgba)
        print('plane', k, name, 'alpha mean', round(float(alpha.mean()), 3), flush=True)

    # --- planche de contrôle : chaque plan sur damier + recomposition
    tw = 640; th = int(H * tw / W)
    sheet = Image.new('RGB', (tw * 3 + 20, (th + 10) * ((n + 2) // 3 + 1)), 'white')
    chk = np.indices((th, tw)).sum(0) // 16 % 2
    chk = np.where(chk[..., None], 200, 235).astype(np.uint8).repeat(3, -1)
    comp = np.zeros((H, W, 3), np.float32)
    for i, p in enumerate(previews):
        a = p[..., 3:4] / 255.0
        comp = comp * (1 - a) + p[..., :3] * a
        sm = np.asarray(Image.fromarray(p).resize((tw, th), Image.LANCZOS)).astype(np.float32)
        a2 = sm[..., 3:4] / 255
        tile = (chk * (1 - a2) + sm[..., :3] * a2).astype(np.uint8)
        sheet.paste(Image.fromarray(tile), ((i % 3) * (tw + 10), (i // 3) * (th + 10)))
    Image.fromarray(comp.astype(np.uint8)).save(os.path.join(d, 'recompose.png'))
    sheet.paste(Image.fromarray(comp.astype(np.uint8)).resize((tw, th)), ((n % 3) * (tw + 10), (n // 3) * (th + 10)))
    sheet.save(os.path.join(d, 'planes_sheet.jpg'), quality=85)
    diff = np.abs(comp - g * 255).mean()
    print('recomposition diff (0-255):', round(float(diff), 2))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
