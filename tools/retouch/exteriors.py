"""Retouches du groupe « exteriors » (S5 sur-mesure, S6 poteau / bois / enseigne, S7 terrasse,
S8 finale + finale-dim) : masters dans tools/.cache/masters/ (PNG sans perte, ignoré par git).

Usage : python tools/retouch/exteriors.py                    (tout)
        python tools/retouch/exteriors.py finale enseigne     (une partie : sur-mesure, poteau, bois,
                                                                enseigne, terrasse, finale, finale-dim)

Toutes les retouches ne font qu'ENLEVER ce que la spec liste ; rien n'est ajouté à une photo.
L'étalonnage commun tools/grade.py photo() est appliqué à chaque master, après retouche.
Les recadrages simples sont dans tools/images.d/exteriors.json ; seul celui de la terrasse est fait
ici, parce qu'il dépend du redressement.

  sur-mesure  N036  aucune retouche (le bas, portes de garage, est coupé par le JSON : y < 1820).
  poteau      N052  aucune retouche.
  bois        N024  aucune retouche (recadrage 4:3 sur le marteau dans le JSON).
  enseigne    I267  enlève la signature « © AG » du coin haut gauche (lettres blanches x 29-65,
                    y 18-31, sur le ciel et la pointe d'une branche de pin) : masque = pixels presque
                    blancs (min(R,G,B) > 135) dans la boîte x 26-69, y 15-34, dilaté de 3 px ; LaMa.
  terrasse    I065  redresse les verticales convergentes (appareil levé) : point de fuite mesuré sur
                    4 longues arêtes verticales — poteau du pignon (557,471)-(542,902), poteau central
                    (666,403)-(663,844), montant de porte (678,963)-(674,1444), montant de la baie
                    (923,937)-(941,1564) — moindres carrés : VP ≈ (735, -5150), résidus < 0,35°.
                    Homographie qui envoie ce point à l'infini, échelle 1 sur la ligne y = 960.
                    Puis recadrage 4:5 qui respecte x >= 120 de la source sur toute la hauteur
                    (le bord gauche oblique de cette bande est mesuré après redressement) et garde
                    la sous-face en mélèze et le ciel rose reflété dans les vitres, jusqu'aux
                    roues des chaises longues (bas à y' = 1360) : x' 161-1241, y' 10-1360, 1080x1350.
                    Verticales mesurées après coup sur le master : ±0,5° au plus.
  finale      N037  enlève le réverbère (lanterne x 821-874, y 832-915 ; mât x 835-848 jusqu'au bas
                    de l'image, y 1281) : masque SAM 2.1, dilaté de 5 px ; LaMa à 1:1 sur une tuile
                    de 512 px (x 592-1104, y 769-1281) qui contient tout le contexte. Le réverbère est
                    éteint : pas de flaque de lumière à effacer.
  finale-dim        dérivée du master « finale » (déjà étalonné) : l'état « éteint » de l'allumage
                    (spec S8). −0,6 IL partout ; les pixels chauds (teinte 15-55°, S > 0,35,
                    V > 0,45, seuils adoucis, masque dilaté de 4 px puis adouci de 10 px) et les
                    flaques blanches des appliques éteints : vitres sombres qui reflètent un peu le
                    bleu de la neige à l'ombre (mesuré sur la photo). Détail de la recette dans dim().
                    Aucun éclat, aucun halo ajouté : chaque pixel est égal ou plus sombre.

Modèles hors ligne : HF_HUB_CACHE (défaut : le cache du scratchpad), HF_HUB_OFFLINE=1.
Sources : LOMBARD_SOURCES (défaut : le scratchpad de la session de conception).
Vérification : recadrages 100 % écrits dans le scratchpad (v2/assets_qa/exteriors).
"""
import glob, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCRATCH = '/tmp/claude-0/-home-user-LOMBARD/95416158-29ce-5296-9584-d21972a9bfca/scratchpad'
SRC = os.environ.get('LOMBARD_SOURCES', SCRATCH)
HF = os.environ.get('HF_HUB_CACHE', os.path.join(SCRATCH, 'models', 'hf'))
os.environ['HF_HUB_CACHE'] = HF
os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')

import numpy as np
import cv2
from PIL import Image

sys.path.insert(0, os.path.join(ROOT, 'tools'))
import grade  # noqa: E402

MASTERS = os.path.join(ROOT, 'tools', '.cache', 'masters')
MASKS = os.path.join(ROOT, 'tools', '.cache', 'masks', 'exteriors')
THREADS = int(os.environ.get('THREADS', '3'))

N036 = os.path.join(SRC, 'v2', 'new', '2025_12_Exterieur-Chalet-Montgenevre-Construction-Lombard-Vasina-5.jpg')
N052 = os.path.join(SRC, 'v2', 'new', '2026_07_Lombard-Vasina-_-Projet-Horreard-_-alpesphotographies.com-329-1.jpg')
N024 = os.path.join(SRC, 'v2', 'new', '2024_10_LOMBARD-VASINA-_-alpesphotographies.com_.jpg')
I267 = os.path.join(SRC, 'orig', '2025_10_Chalets-Lombard-exterieur-signage.jpg')
I065 = os.path.join(SRC, 'orig', '2024_09_Chalets_Lombard_exterieure_nuit_chalets-100m2.jpg')
N037 = os.path.join(SRC, 'v2', 'new', '2025_12_Exterieur-chalet-Puy-Saint-Vincent-Construction-Lombard-Vasina-1.jpg')


def load(p):
    return np.asarray(Image.open(p).convert('RGB'))


def save(rgb, name, graded=False):
    os.makedirs(MASTERS, exist_ok=True)
    out = Image.fromarray(rgb) if graded else grade.photo(Image.fromarray(rgb))
    p = os.path.join(MASTERS, name + '.png')
    out.save(p, optimize=False, compress_level=6)
    print('master', p, out.size)
    return np.asarray(out)


def disk(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def dilate(m, r):
    return cv2.dilate(m.astype(np.uint8), disk(r)) > 0


# ----------------------------------------------------------------------------- models
_sam = None
_lama = None


def sam_mask(img, crop, key, box=None, pts=None):
    """SAM 2.1 sur un recadrage de 512 px. crop = (x0, y0) ; box / pts en px de l'image.
    Renvoie un masque booléen pleine taille (seuil 0,5), mis en cache en PNG."""
    os.makedirs(MASKS, exist_ok=True)
    cache = os.path.join(MASKS, key + '.png')
    H, W = img.shape[:2]
    if os.path.exists(cache):
        return np.asarray(Image.open(cache)) > 127
    global _sam
    import torch
    from transformers import Sam2Processor, Sam2Model
    torch.set_num_threads(THREADS)
    if _sam is None:
        mid = 'facebook/sam2.1-hiera-base-plus'
        _sam = (Sam2Processor.from_pretrained(mid), Sam2Model.from_pretrained(mid).eval())
    proc, model = _sam
    x0, y0 = crop
    c = img[y0:y0 + 512, x0:x0 + 512]
    kw = dict(images=Image.fromarray(c), return_tensors='pt')
    if box is not None:
        kw['input_boxes'] = [[[float(box[0] - x0), float(box[1] - y0), float(box[2] - x0), float(box[3] - y0)]]]
    if pts:
        kw['input_points'] = [[[[float(p[0] - x0), float(p[1] - y0)] for p in pts]]]
        kw['input_labels'] = [[[int(p[2]) for p in pts]]]
    inp = proc(**kw)
    with torch.inference_mode():
        out = model(**{k: v for k, v in inp.items() if k in ('pixel_values', 'input_points', 'input_labels', 'input_boxes')},
                    multimask_output=False)
    pm = proc.post_process_masks(out.pred_masks, inp['original_sizes'], binarize=False)[0]
    p = torch.sigmoid(pm.reshape(-1, c.shape[0], c.shape[1])[0]).numpy()
    m = np.zeros((H, W), bool)
    m[y0:y0 + c.shape[0], x0:x0 + c.shape[1]] = p > 0.5
    Image.fromarray((m * 255).astype(np.uint8)).save(cache)
    print(f'sam {key}: iou {float(out.iou_scores.flatten()[0]):.3f}, {int(m.sum())} px')
    return m


def lama(img, hole, x0, y0):
    """LaMa à 1:1 sur la tuile de 512 px dont le coin haut gauche est (x0, y0). Seuls les pixels
    du trou sont remplacés."""
    global _lama
    if _lama is None:
        import onnxruntime as ort
        so = ort.SessionOptions()
        so.intra_op_num_threads = THREADS
        p = glob.glob(os.path.join(HF, 'models--Carve--LaMa-ONNX', 'snapshots', '*', 'lama_fp32.onnx'))[0]
        _lama = ort.InferenceSession(p, so, providers=['CPUExecutionProvider'])
    win = np.zeros(hole.shape, bool)
    win[y0:y0 + 512, x0:x0 + 512] = True
    assert not (hole & ~win).any(), 'trou hors de la tuile'
    c = img[y0:y0 + 512, x0:x0 + 512].astype(np.float32) / 255
    m = hole[y0:y0 + 512, x0:x0 + 512].astype(np.float32)
    c = c * (1 - m[..., None])
    r = _lama.run(None, {'image': c.transpose(2, 0, 1)[None], 'mask': m[None, None]})[0][0].transpose(1, 2, 0)
    if r.max() > 2:
        r = r / 255
    out = img.copy()
    sub = out[y0:y0 + 512, x0:x0 + 512]
    sub[m > 0] = (np.clip(r[m > 0], 0, 1) * 255 + 0.5).astype(np.uint8)
    return out


# ----------------------------------------------------------------------------- groups
def sur_mesure():
    save(load(N036), 'sur-mesure')


def poteau():
    save(load(N052), 'poteau')


def bois():
    save(load(N024), 'bois')


def enseigne():
    im = load(I267)
    mark = np.zeros(im.shape[:2], bool)
    mark[15:35, 26:70] = im[15:35, 26:70].min(-1) > 135
    hole = dilate(mark, 3)
    im = lama(im, hole, 0, 0)
    save(im, 'enseigne')


# terrasse : géométrie du redressement (voir docstring)
I065_EDGES = [(557, 471, 542, 902), (666, 403, 663, 844), (678, 963, 674, 1444), (923, 937, 941, 1564)]
I065_YREF = 960


def i065_homography():
    A, b = [], []
    for x1, y1, x2, y2 in I065_EDGES:
        nx, ny = y2 - y1, -(x2 - x1)
        s = np.hypot(nx, ny)
        A.append([nx / s, ny / s])
        b.append((nx * x1 + ny * y1) / s)
    vx, vy = np.linalg.lstsq(np.array(A), np.array(b), rcond=None)[0]
    d = I065_YREF - vy
    T = np.array([[1, 0, -vx], [0, 1, -I065_YREF], [0, 0, 1.]])
    P = np.array([[1, 0, 0], [0, 1, 0], [0, 1 / d, 1.]])
    return np.linalg.inv(T) @ P @ T, (vx, vy)


def terrasse():
    im = load(I065)
    H, (vx, vy) = i065_homography()
    h0, w0 = im.shape[:2]
    pt = lambda x, y: cv2.perspectiveTransform(np.array([[[x, y]]], np.float32), H)[0, 0]
    # le haut de la source arrive en y' = top ; la bande gardée finit en bas à y'_bas
    top = pt(vx, 0)[1]
    y_bas = I065_CROP_BOTTOM
    # bords valides à la hauteur du bas du recadrage (les bords de la source penchent) :
    # à gauche la ligne x = 120 de la source, à droite le bord x = w0 de la source
    def x_at(xs, yp):
        # point de la colonne source xs qui arrive en y' = yp (recherche sur y source)
        lo, hi = 0.0, float(h0)
        for _ in range(60):
            mid = (lo + hi) / 2
            if pt(xs, mid)[1] < yp:
                lo = mid
            else:
                hi = mid
        return pt(xs, lo)[0]
    # la bande x < 120 penche vers la droite en descendant, le bord droit vers la gauche :
    # les deux limites les plus strictes sont en bas du recadrage
    xl = int(np.ceil(x_at(120, y_bas)))
    xr = int(np.floor(x_at(w0 - 1, y_bas)))
    w = xr - xl
    w -= w % 4
    h = w * 5 // 4
    y0 = int(round(y_bas)) - h
    assert y0 >= np.ceil(top), (y0, top)
    S = np.array([[1, 0, -xl], [0, 1, -y0], [0, 0, 1.]])
    out = cv2.warpPerspective(im, S @ H, (w, h), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT,
                              borderValue=(255, 0, 255))
    assert not ((out == [255, 0, 255]).all(-1)).any(), 'coin vide dans le recadrage'
    print(f'terrasse : VP ({vx:.0f}, {vy:.0f}), recadrage x\' {xl}-{xl + w}, y\' {y0}-{y0 + h} -> {w}x{h}')
    save(out, 'terrasse')


I065_CROP_BOTTOM = 1360   # en y' redressé


LAMP_TILE = (592, 769)


def finale():
    im = load(N037)
    lamp = sam_mask(im, LAMP_TILE, 'n037_lamp', box=(812, 826, 884, 1281),
                    pts=[(848, 850, 1), (843, 1000, 1), (842, 1150, 1), (841, 1260, 1), (826, 900, 1),
                         (868, 900, 1), (830, 958, 0), (866, 1000, 0), (800, 880, 0)])
    hole = dilate(lamp, 5)
    im = lama(im, hole, *LAMP_TILE)
    save(im, 'finale')


# finale-dim : réglages (voir docstring)
DIM_EV = -0.6          # partout
DIM_KNEE = 0.12        # plafond (luminance encodée) du niveau de base des surfaces éclairées
DIM_DETAIL = 0.85      # part du grain (bois, pierre) gardée sur les surfaces éteintes
DIM_DESAT = 0.45       # chroma gardée (Lab) sur les surfaces éteintes
DIM_DUSK = 0.12        # teinte du crépuscule (mesurée sur la neige à l'ombre), +0,3 sur les vitres


def _s2l(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def _l2s(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


def _sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def _feather(m, grow=4, soft=10):
    """Masque dilaté de `grow` px puis adouci sur `soft` px (gaussienne de sigma soft/3)."""
    m = cv2.dilate(m.astype(np.float32), disk(grow))
    return np.clip(cv2.GaussianBlur(m, (0, 0), soft / 3), 0, 1)


def dim(rgb):
    """État « éteint » de la photo (spec S8, assets de l'allumage). Ne fait qu'enlever de la lumière.

    1. Partout : -0,6 IL (en lumière linéaire).
    2. Pixels chauds = recette de la spec (teinte 15-55°, S > 0,35, V > 0,45) aux seuils adoucis ;
       le seuil V est prolongé en rampe douce jusqu'à 0,05, sinon un bois un peu moins éclairé
       (V 0,40) resterait plus clair que le bois éclairé une fois éteint (inversion visible).
       Masque dilaté de 4 px, adouci de 10 px. S'y ajoutent, dans la silhouette du chalet (fermeture
       de 60 px du masque chaud), les pixels non bleus (volets rouge-brun, poteaux), et les
       « flaques » blanches des appliques (cœurs brûlés et pierre surexposée, S faible, près d'une
       zone chaude). Le ciel, la neige, la forêt et la vitre qui reflète déjà le ciel ne sont pas
       dans le masque : seulement -0,6 IL.
    3. Dans le masque, la luminance est décomposée en niveau de base (filtre bilatéral, log) et
       grain. Le niveau de base passe par une courbe monotone (pente -0,6 IL dans les ombres,
       plafond DIM_KNEE = 0,12) : une vitre blanche finit vers 12-18 % de sa luminance encodée
       (grain compris) — les 18 % de la spec appliqués tels quels laissaient les vitres orangées
       (en lumière linéaire) ou rendaient le bois éclairé plus sombre que le bois à l'ombre (en
       valeurs encodées) ; la courbe est monotone : aucune zone éclairée ne devient plus sombre
       qu'une zone voisine qui l'était moins. Sous les
       flaques des appliques, le niveau de base est celui des alentours (convolution normalisée) :
       la lampe éteinte ne laisse ni tache ni anneau. Le grain est remis (85 %, 50 % dans les vitres).
    4. Couleur (Lab) : chroma ramenée à 45 % et poussée de 12 % (30 % dans les vitres) vers le bleu de
       la neige à l'ombre, mesuré sur la photo : une vitre éteinte reflète un peu le crépuscule.
    Rien n'est ajouté : la luminance de chaque pixel est égale ou plus faible qu'à l'origine.
    """
    a = rgb.astype(np.float32) / 255
    lin = _s2l(a)
    G = 2.0 ** DIM_EV
    LUM = np.array([0.2126, 0.7152, 0.0722], np.float32)
    hsv = cv2.cvtColor(a, cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    rb = a[..., 0] - a[..., 2]
    warm = _sstep(10, 15, h) * (1 - _sstep(55, 60, h)) * _sstep(0.30, 0.40, s)
    lit = warm * _sstep(0.40, 0.50, v)
    wv = warm * _sstep(0.05, 0.45, v)
    house = cv2.morphologyEx((wv > 0.3).astype(np.uint8), cv2.MORPH_CLOSE, disk(60)).astype(np.float32)
    w_house = cv2.GaussianBlur(house, (0, 0), 4) * _sstep(-0.02, 0.06, rb)
    near = cv2.dilate((lit > 0.5).astype(np.uint8), disk(30)) > 0
    pool = _sstep(0.6, 0.8, v) * (1 - _sstep(0.30, 0.45, s)) * _sstep(-0.03, 0.01, rb) * near
    glow = _sstep(0.85, 0.95, v) * (cv2.dilate((pool > 0.5).astype(np.uint8), disk(40)) > 0)
    P = np.maximum(_feather(pool, 10, 10), _feather(glow, 4, 10))
    w = np.maximum.reduce([_feather(wv), w_house, P])

    yl = lin @ LUM
    ye = _l2s(yl)
    ly = np.log(np.maximum(yl, 1e-4)).astype(np.float32)
    base = cv2.bilateralFilter(ly, d=0, sigmaColor=0.5, sigmaSpace=6)
    grain = np.clip(ly - base, -0.4, 0.4)
    be = _l2s(np.exp(base))
    k0 = _l2s(np.float32(G))                       # -0,6 IL en valeurs encodées (≈ 0,83)
    knee = be * k0 / (1 + be * (k0 / DIM_KNEE - 1))
    B = np.exp(base) * G * (1 - w) + _s2l(knee) * w
    n1, d1 = cv2.GaussianBlur(B * (1 - P), (0, 0), 20), cv2.GaussianBlur(1 - P, (0, 0), 20)
    n2, d2 = cv2.GaussianBlur(B * (1 - P), (0, 0), 60), cv2.GaussianBlur(1 - P, (0, 0), 60)
    k = _sstep(0.05, 0.3, d1)
    fill = n1 / np.maximum(d1, 1e-4) * k + n2 / np.maximum(d2, 1e-4) * (1 - k)
    B = B * (1 - P) + np.minimum(fill, B) * P
    glass = _sstep(0.80, 0.95, ye) * (1 - P)
    Y = B * np.exp(grain * (DIM_DETAIL - 0.35 * glass))
    Y = np.minimum(np.maximum(Y, 0), yl * G)       # jamais plus clair que -0,6 IL
    Y = yl * G * (1 - w) + Y * w

    lab = cv2.cvtColor(a, cv2.COLOR_RGB2Lab)
    dl = np.median(cv2.cvtColor(a[1180:1270, 40:600], cv2.COLOR_RGB2Lab).reshape(-1, 3), 0)
    fy = np.where(Y > 0.008856, np.cbrt(Y), 7.787 * Y + 16 / 116)
    L = 116 * fy - 16
    r = L / np.maximum(lab[..., 0], 1)
    t = DIM_DUSK + 0.3 * glass
    A = (1 - t) * lab[..., 1] * r * DIM_DESAT + t * dl[1] / dl[0] * L
    Bb = (1 - t) * lab[..., 2] * r * DIM_DESAT + t * dl[2] / dl[0] * L
    off = _s2l(np.clip(cv2.cvtColor(np.dstack([L, A, Bb]).astype(np.float32), cv2.COLOR_Lab2RGB), 0, 1))
    out = lin * G * (1 - w[..., None]) + off * w[..., None]
    # garde-fou : aucun pixel plus lumineux qu'à l'origine (sur la luminance, pas canal par canal :
    # un bois orangé éteint peut prendre un peu de bleu sans prendre de lumière)
    yo = out @ LUM
    out = out * np.minimum(1, (lin @ LUM) / np.maximum(yo, 1e-6))[..., None]
    return (_l2s(out) * 255 + 0.5).astype(np.uint8), w


def finale_dim():
    src = os.path.join(MASTERS, 'finale.png')
    if not os.path.exists(src):
        finale()
    rgb = np.asarray(Image.open(src).convert('RGB'))
    out, w = dim(rgb)
    os.makedirs(MASKS, exist_ok=True)
    Image.fromarray((w * 255 + 0.5).astype(np.uint8)).save(os.path.join(MASKS, 'n037_dim_weight.png'))
    save(out, 'finale-dim', graded=True)        # dérivé du master déjà étalonné


STEPS = {'sur-mesure': sur_mesure, 'poteau': poteau, 'bois': bois, 'enseigne': enseigne,
         'terrasse': terrasse, 'finale': finale, 'finale-dim': finale_dim}

if __name__ == '__main__':
    for k in sys.argv[1:] or list(STEPS):
        STEPS[k]()
