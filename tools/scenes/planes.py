"""Étape 2 : découpe des plans, bords, remplissage de l'arrière-plan.

Usage : python planes.py <work_dir> <scene>    (configuration : scenes.json)

Principe (brief §5.5)
- Chaque pixel reçoit une « couverture » cumulée par plan, du fond vers l'avant :
  c0 = 1 (ciel), c1 = 1 - ciel, ck = transition douce sur la carte de profondeur.
  Une transition douce sur la profondeur donne naturellement des bords nets aux
  ruptures d'occlusion (la profondeur saute) et un fondu large sur un sol continu
  (la profondeur varie lentement) : pas de « marche » visible dans le terrain.
- Bords affinés par filtre guidé sur l'image (contour adouci de 1 à 3 px), puis
  décontamination des couleurs (pymatting) sur les bords nets seulement : dans une
  transition large (sol, pente), les deux plans gardent les vrais pixels et se
  recomposent exactement en la photo au repos.
- Chaque plan sauf le premier est comblé derrière les zones opaques des plans du dessus,
  au-delà du déplacement relatif maximal calculé pixel par pixel (motion.py) :
  poussée-tirée pour le ciel, LaMa ailleurs. L'IA ne sert qu'à combler ciel, neige,
  forêt ou versant derrière un plan découpé, jamais à inventer de l'architecture.
"""
import json, os, sys, glob, numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from motion import max_relative, plane_transform

HERE = os.path.dirname(__file__)
CFG = json.load(open(os.path.join(HERE, 'scenes.json')))


def guided(I, p, r, eps):
    k = (2 * r + 1, 2 * r + 1)
    m = lambda x: cv2.boxFilter(x, -1, k)
    mI, mp = m(I), m(p)
    a = (m(I * p) - mI * mp) / (m(I * I) - mI * mI + eps)
    b = mp - a * mI
    return m(a) * I + m(b)


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


def needed_alphas(c, own, W, H, f=8, safety=1.25):
    """Étendue de chaque plan derrière les plans de devant : pour chaque pixel, la marge vaut le
    déplacement relatif maximal (sur tout le mouvement, souris comprise) avec les seuls plans de
    devant qui recouvrent ce pixel. Calculé du premier plan vers le fond, sur une grille réduite."""
    n = len(own)
    h, w = H // f, W // f
    gy, gx = np.mgrid[0:h, 0:w].astype(np.float32) * f
    ps = [0, 0.25, 0.5, 0.75, 1]
    D = [[displacement(c, k, p, gx, gy, W, H) for p in ps] for k in range(n)]
    sp = [pl['speed'] for pl in c['planes']]
    mouse = c.get('mouse', 12) * W / 1920.0
    small = [cv2.resize(o, (w, h), interpolation=cv2.INTER_AREA) for o in own]
    alpha_small = [None] * n
    alpha_small[n - 1] = small[n - 1]
    ext = [None] * n
    for k in range(n - 2, 0, -1):
        r = np.zeros((h, w), np.float32)
        for j in range(k + 1, n):
            rel = np.zeros((h, w), np.float32)
            for (dxj, dyj), (dxk, dyk) in zip(D[j], D[k]):
                rel = np.maximum(rel, np.hypot(dxj - dxk, dyj - dyk))
            rel += mouse * abs(sp[j] - sp[k]) / 0.8 * 2
            near_j = cv2.distanceTransform((alpha_small[j] < 0.25).astype(np.uint8), cv2.DIST_L2, 5) * f
            r = np.maximum(r, np.where(near_j <= rel * safety, rel, 0))
        dist_own = cv2.distanceTransform((small[k] < 0.5).astype(np.uint8), cv2.DIST_L2, 5) * f
        e = (dist_own <= r * safety + 8).astype(np.float32)
        ext[k] = e
        alpha_small[k] = np.maximum(small[k], e * (sum(alpha_small[j] for j in range(k + 1, n)) > 0.25))
    return ext


def sky_mask(g, disp, c):
    """Ciel : bleu ou nuage, très loin, relié au bord haut."""
    r, gg, b = g[..., 0], g[..., 1], g[..., 2]
    L = g.mean(-1)
    blue = sstep(b - np.maximum(r, gg), c.get('blue', 0.10), 0.04)
    cloud = sstep(L, c.get('cloud_L', 2.0), 0.03) * (1 - sstep(g.max(-1) - g.min(-1), 0.12, 0.04))
    far = 1 - sstep(disp, c.get('far', 0.02), c.get('far_w', 0.006))
    p = np.maximum(blue, cloud) * far
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

    # --- marges de remplissage (px source) : déplacement relatif maximal x sécurité
    amp = c['amplitude'] * W / 1920.0
    speeds = [p['speed'] for p in planes]
    os.makedirs(os.path.join(d, 'planes'), exist_ok=True)
    owns = [np.clip(cov[k] - (cov[k + 1] if k + 1 < n else 0), 0, 1) for k in range(n)]
    EXT = needed_alphas(c, owns, W, H)
    from pymatting import estimate_foreground_ml
    previews = []
    for k in range(n):
        name = planes[k]['name']
        front = cov[k + 1] if k + 1 < n else np.zeros((H, W), np.float32)
        own = np.clip(cov[k] - front, 0, 1)
        if k == 0:
            alpha = np.ones((H, W), np.float32)
            known = sky > 0.85
            er = max(7, int(W / 256)) | 1
            known = cv2.erode(known.astype(np.uint8), np.ones((er, er), np.uint8)).astype(bool)
            fill = push_pull(g, known.astype(np.float32))
            fill = cv2.GaussianBlur(fill, (0, 0), 1.2)
            rgb = np.where(known[..., None], g, fill)
            # transition douce entre ciel réel et ciel extrapolé
            kb = cv2.GaussianBlur(known.astype(np.float32), (0, 0), 4)[..., None]
            rgb = g * kb + fill * (1 - kb)
        else:
            ext = cv2.resize(EXT[k] if EXT[k] is not None else np.zeros((H // 8, W // 8), np.float32), (W, H), interpolation=cv2.INTER_LINEAR)
            ext = cv2.GaussianBlur(ext, (0, 0), 6)
            behind = np.clip(cov[k] * ext, 0, 1)  # là où un plan de devant couvre, dans la marge
            alpha = np.maximum(own, np.minimum(behind, cov[k]))
            # pixels connus = pas (ou peu) couverts par les plans de devant
            # On ne comble que derrière les zones vraiment opaques des plans de devant (+ 7 px pour
            # les bords nets). Dans une transition douce (un sol continu), on garde les vrais
            # pixels : un léger dédoublement de texture se voit moins qu'un remplissage flou.
            hth = planes[k].get('hole_th', c.get('hole_th', 0.98))  # 0,15 pour des branches fines devant le ciel
            hole = cv2.dilate((front > hth).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool) & (alpha > 0.01)
            hole &= ~((own > 0.9) & (front < 0.05))
            # décontamination des couleurs sur les bords nets seulement (transition de quelques px) ;
            # dans une transition large (sol, pente), on garde les vrais pixels : au repos,
            # plan avant et plan arrière se recomposent alors exactement en la photo.
            gy_, gx_ = np.gradient(cv2.GaussianBlur(own, (0, 0), 1.0))
            sharp = cv2.dilate((np.hypot(gx_, gy_) > 0.06).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
            band = (own > 0.01) & (own < 0.99) & sharp
            if band.any():
                ys, xs = np.where(band)
                y0, y1, x0, x1 = max(ys.min() - 8, 0), min(ys.max() + 9, H), max(xs.min() - 8, 0), min(xs.max() + 9, W)
                F = estimate_foreground_ml(g[y0:y1, x0:x1].astype(np.float64), np.clip(own[y0:y1, x0:x1], 0, 1).astype(np.float64))
                rgb = g.copy(); rgb[y0:y1, x0:x1] = np.where(band[y0:y1, x0:x1, None], F.astype(np.float32), g[y0:y1, x0:x1])
            else:
                rgb = g.copy()
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
