"""Groupe « hero » : masters du hero, masques de ciel, plans du montage de l'intro.

Spec : final-spec.md §2.2, §2.3, §2.7, §3 S1 « Images », annexe A (I056, I064, N024, N052, I100, I129).

    python tools/retouch/hero.py               # tout
    python tools/retouch/hero.py masters       # I056 / I064 étalonnés -> tools/.cache/masters/hero-I056.png, hero-I064.png
    python tools/retouch/hero.py sky           # public/assets/img/hero-sky-d.png (I056) et hero-sky-m.png (I064)
    python tools/retouch/hero.py montage       # public/assets/img/intro/m1..m4-d|m.avif|.webp
    python tools/retouch/hero.py qa DOSSIER    # composites de contrôle des masques (magenta 50 %, mot test, aplat)

Les exports responsive du hero (« hero », « hero-portrait ») passent ensuite par tools/images.py
(entrées dans tools/images.d/hero.json) : python tools/images.py hero hero-portrait

Sources : dossier de travail de la refonte (variable HERO_SRC, par défaut le scratchpad de la session de
conception) : orig/… pour les photos « I », v2/new/… pour les photos « N ». Modèle SAM 2.1 hors ligne
(variable HF_HUB_CACHE, par défaut <HERO_SRC>/models/hf), utilisé seulement pour le masque grossier du ciel ;
le résultat est mis en cache dans tools/.cache/masters/hero-sam-<id>.npy.

Aucune retouche de contenu : on n'ajoute rien, on n'enlève rien. Les masters ne reçoivent que l'étalonnage
commun (tools/grade.py, photo()).

Masque de ciel (alpha 255 sur le ciel, 0 ailleurs, bord adouci d'environ 1 px, PNG « LA » noir) :
 1. masque grossier SAM 2.1 (points posés dans le ciel et sur les objets), bords du cadre recopiés de 8 px
    à l'intérieur (SAM y est peu fiable) ;
 2. « plaque » de ciel locale : moyenne normalisée (gaussienne 4 px, sinon push-pull) des pixels sûrs
    (clé chromatique teinte 250–330° pour I056, 212–300° pour I064 — le ciel d'I064 est plus bleu —,
    L > 50, chroma > 20, à 6 px au moins à l'intérieur du masque SAM) ;
 3. dans une bande de 8 px à l'intérieur / 16 px à l'extérieur du bord SAM, un pixel est du ciel si sa distance
    Lab à la plaque (rose compté double, « plus clair » compté à moitié) est sous un seuil : 4,5 près de la
    neige (seul premier plan proche du ciel en couleur), 9 ailleurs (halos d'accentuation et bavure de chroma
    4:2:0 autour du bois, de la pierre, de la cheminée = ciel), 10 dans les aiguilles du sapin (où la plaque est
    réestimée deux fois, l'horizon y est plus bleu), 14 dans les jours du chapeau de cheminée ;
 4. composantes : le grand ciel, les jours du sapin et du chapeau de cheminée, et les petits morceaux de ciel
    très sûrs proches du ciel ; trous de moins de 12 px rebouchés ; fermeture 2 px limitée aux pixels peu
    contrastés (encoches de chroma) ; croissance sur les pixels que le démélange ciel / premier plan local
    donne à 75 % ciel au moins (ciel assombri contre une arête sombre) ;
 5. bord adouci : sur 1 px de chaque côté (3 px dans les aiguilles), alpha = démélange linéaire entre la
    plaque de ciel et la couleur locale du premier plan ; ≥ 0,9 -> 255, ≤ 0,1 -> 0.
Retouches manuelles (rectangles, px de la photo) : zone des aiguilles du sapin, jours du chapeau de
cheminée, bande d'horizon pâle derrière le sapin (du ciel, pas de la neige).

Montage (§2.7) : 720×400 (fenêtre desktop 1,8:1) et 480×420 (mobile), AVIF ≤ 28 Ko, WebP ≤ 40 Ko.
Les cadrages de §2.7 servent de région d'intérêt, ajustés au ratio exact en s'élargissant autour de leur
centre dans la source (jamais d'étirement). Exception, plan 1 (N024) : pendant ce plan la fenêtre-pignon
n'est encore qu'une fente à hauteur des rives (56 % de la hauteur de la boîte sur desktop, 36 % sur mobile,
cf. §2.4 : ouverture 0,8 s « inOut », le plan 1 n'en voit que les 0,26 premières secondes) ; avec le cadrage
§2.7 le marteau, en haut à gauche, n'y passait jamais. Le cadrage est donc recentré sur le marteau, posé sur
la ligne des rives. N052 est très légèrement réchauffé.
"""
import io, os, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import grade  # noqa: E402

SRC = os.environ.get('HERO_SRC', '/tmp/claude-0/-home-user-LOMBARD/95416158-29ce-5296-9584-d21972a9bfca/scratchpad')
MASTERS = os.path.join(ROOT, 'tools', '.cache', 'masters')
IMG = os.path.join(ROOT, 'public', 'assets', 'img')
F32 = np.float32

HERO = {
    'I056': dict(src='orig/2024_09_Chalets_Lombard_exterieure-1.jpg', out='hero-sky-d.png',
                 ylim=700, hue=(250, 330), zone=(1000, 140, 1690, 370),
                 sam=[(200, 60, 1), (900, 60, 1), (1700, 60, 1), (300, 300, 1), (1100, 330, 1), (1350, 250, 1),
                      (1800, 300, 1), (560, 280, 0), (900, 600, 0), (1500, 500, 0), (1750, 800, 0), (150, 500, 0)],
                 needles=[(1440, 200, 1920, 640)], holes=[(495, 195, 640, 250)], nosnow=[(1740, 330, 1920, 452)]),
    'I064': dict(src='orig/2024_09_Chalets_Lombard_exterieure_neige_220m2.jpg', out='hero-sky-m.png',
                 ylim=900, hue=(212, 300), zone=(160, 160, 1000, 390),
                 sam=[(200, 60, 1), (700, 100, 1), (1150, 100, 1), (300, 350, 1), (800, 500, 1), (1150, 400, 1),
                      (170, 450, 0), (600, 800, 0), (1000, 750, 0), (1200, 900, 0)],
                 needles=[], holes=[(100, 350, 255, 410)], nosnow=[]),
}
T_SNOW, T_DARK, T_NEEDLE, T_HOLE = 4.5, 9.0, 10.0, 14.0
R_IN, R_OUT = 8, 16

MONTAGE = {  # plan: (id, source, cadrage desktop, cadrage mobile) en px de la source
    1: ('N024', 'v2/new/2024_10_LOMBARD-VASINA-_-alpesphotographies.com_.jpg',
        [107, 2, 1347, 691], [227, 64, 1227, 939]),          # recentré sur le marteau (voir plus haut)
    2: ('N052', 'v2/new/2026_07_Lombard-Vasina-_-Projet-Horreard-_-alpesphotographies.com-329-1.jpg',
        [0, 800, 2000, 1911], [300, 700, 1700, 1918]),
    3: ('I100', 'orig/2024_09_Chalets_Lombard_toit-en-melezes.jpg',
        [0, 700, 1281, 1412], [0, 640, 1281, 1754]),
    4: ('I129', 'orig/2024_09_Chalets_Lombard_lumiere_interieur.jpg',
        [0, 520, 1080, 1120], [0, 420, 1080, 1360]),
}
SIZES = {'d': (720, 400), 'm': (480, 420)}
BUDGET = {'avif': 28000, 'webp': 40000}   # octets (marge : 28 ko / 40 ko au sens strict)


def log(*a):
    print(*a, flush=True)


# --------------------------------------------------------------------------------------------- masters
def master_path(pid):
    return os.path.join(MASTERS, f'hero-{pid}.png')


def masters():
    os.makedirs(MASTERS, exist_ok=True)
    for pid, c in HERO.items():
        im = Image.open(os.path.join(SRC, c['src'])).convert('RGB')
        grade.photo(im).save(master_path(pid), compress_level=3)
        log('master', pid, '->', master_path(pid))


# --------------------------------------------------------------------------------------------- helpers
def push_pull(img, w):
    """Remplissage lisse : convolution normalisée sur une pyramide (img HxWxC, w HxW poids)."""
    levels, im, m = [], img * w[..., None], w.astype(F32)
    while min(m.shape) > 4:
        levels.append((im, m))
        im, m = cv2.pyrDown(im), cv2.pyrDown(m)
        if im.ndim == 2:
            im = im[..., None]
    fill = im / np.maximum(m[..., None], 1e-6)
    for im_l, m_l in reversed(levels):
        up = cv2.resize(fill, (m_l.shape[1], m_l.shape[0]), interpolation=cv2.INTER_LINEAR)
        if up.ndim == 2:
            up = up[..., None]
        cur = im_l / np.maximum(m_l[..., None], 1e-6)
        k = np.clip(m_l * 3.0, 0, 1)[..., None]
        fill = cur * k + up * (1 - k)
    return fill.astype(F32)


def local_plate(x, w, sigma):
    """Moyenne locale de x sur les pixels de poids w (gaussienne sigma), prolongée par push-pull."""
    pp = push_pull(x, w)
    num = cv2.GaussianBlur(x * w[..., None], (0, 0), sigma)
    den = cv2.GaussianBlur(w, (0, 0), sigma)[..., None]
    k = np.clip(den / 0.15, 0, 1)
    return (num / np.maximum(den, 1e-6) * k + pp * (1 - k)).astype(F32)


def disk(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def dil(m, r):
    return cv2.dilate(m.astype(np.uint8), disk(r)).astype(bool)


def ero(m, r):
    return cv2.erode(m.astype(np.uint8), disk(r), borderType=cv2.BORDER_REPLICATE).astype(bool)


def rects(shape, rs):
    m = np.zeros(shape, bool)
    for x0, y0, x1, y1 in rs:
        m[y0:y1, x0:x1] = True
    return m


# --------------------------------------------------------------------------------------------- sky masks
def sam_sky(pid, rgb8):
    cache = os.path.join(MASTERS, f'hero-sam-{pid}.npy')
    if os.path.exists(cache) and os.path.getmtime(cache) > os.path.getmtime(master_path(pid)):
        return np.load(cache)
    os.environ.setdefault('HF_HUB_CACHE', os.path.join(SRC, 'models', 'hf'))
    os.environ.setdefault('HF_HUB_OFFLINE', '1')
    import torch
    from transformers import Sam2Processor, Sam2Model
    torch.set_num_threads(3)
    mid = 'facebook/sam2.1-hiera-base-plus'
    proc, model = Sam2Processor.from_pretrained(mid), Sam2Model.from_pretrained(mid).eval()
    pts = HERO[pid]['sam']
    H, W = rgb8.shape[:2]
    inp = proc(images=Image.fromarray(rgb8), input_points=[[[[float(x), float(y)] for x, y, _ in pts]]],
               input_labels=[[[lab for *_, lab in pts]]], return_tensors='pt')
    with torch.inference_mode():
        out = model(**inp, multimask_output=False)
    m = proc.post_process_masks(out.pred_masks, inp['original_sizes'], binarize=False)[0]
    p = torch.sigmoid(m.reshape(-1, H, W)[0]).numpy().astype(F32)
    np.save(cache, p)
    return p


def sky_alpha(pid):
    c = HERO[pid]
    rgb8 = np.asarray(Image.open(master_path(pid)).convert('RGB'))
    H, W = rgb8.shape[:2]
    I = rgb8.astype(F32) / 255
    lab = cv2.cvtColor(I, cv2.COLOR_RGB2LAB)
    hsv = cv2.cvtColor(I, cv2.COLOR_RGB2HSV)
    yy = np.repeat(np.arange(H)[:, None], W, 1)
    above = yy < c['ylim']
    chroma = np.hypot(lab[..., 1], lab[..., 2])

    sam = sam_sky(pid, rgb8) > 0.5
    sam[:8] = sam[8]                         # bords du cadre : SAM y hésite, on recopie l'intérieur
    sam[:, :8] = sam[:, 8:9]
    sam[:, -8:] = sam[:, -9:-8]
    sam &= above
    key = (hsv[..., 0] >= c['hue'][0]) & (hsv[..., 0] <= c['hue'][1]) & (lab[..., 0] > 50) & (chroma > 20)
    seed = ero(key & ero(sam, 4), 2)
    needle = rects((H, W), c['needles'])
    hole = rects((H, W), c['holes'])
    nosnow = rects((H, W), c['nosnow'])
    band = (dil(sam, R_OUT) & ~ero(sam, R_IN)) | needle | hole
    near = dil(sam, 30) | needle | hole

    def classify(seed):
        plate = local_plate(lab, seed.astype(F32), 4)
        plate_rgb = local_plate(I, seed.astype(F32), 4)
        dl = lab - plate
        dL = np.where(dl[..., 0] > 0, 0.5, 1.0) * dl[..., 0]
        dw = np.sqrt(dL ** 2 + (2 * dl[..., 1]) ** 2 + dl[..., 2] ** 2)
        snowish = (dw > 5) & (dw < 25) & (np.abs(dl[..., 2]) < 12) & (lab[..., 0] > 55)
        snow = dil(cv2.morphologyEx(snowish.astype(np.uint8), cv2.MORPH_OPEN, disk(2)).astype(bool), 4) & ~nosnow
        T = np.where(snow, T_SNOW, np.where(needle, T_NEEDLE, np.where(hole, T_HOLE, T_DARK))).astype(F32)
        sky = np.where(band, (dw < T) & above, sam)
        n, cc, st, _ = cv2.connectedComponentsWithStats(sky.astype(np.uint8), connectivity=4)
        big = np.argmax(st[1:, cv2.CC_STAT_AREA]) + 1
        md = np.bincount(cc.ravel(), weights=(dw / T).ravel(), minlength=n) / np.maximum(st[:, cv2.CC_STAT_AREA], 1)
        keep = np.zeros(n, bool)
        keep[big] = True
        for i in range(1, n):
            if i != big:
                x, y, w, h, a = st[i]
                cy, cx = y + h // 2, x + w // 2
                keep[i] = needle[cy, cx] or hole[cy, cx] or (near[cy, cx] and a >= 3 and md[i] < 0.6)
        sky = keep[cc] & (cc > 0)
        n2, cc2, st2, _ = cv2.connectedComponentsWithStats((~sky).astype(np.uint8), connectivity=8)
        for i in range(1, n2):
            x, y, w, h, a = st2[i]
            if a < 12 and not needle[y + h // 2, x + w // 2]:
                sky[cc2 == i] = True
        return sky, plate_rgb, dw

    sky, plate_rgb, dw = classify(seed)
    for _ in range(2):                       # sapin : plaque réestimée sur le ciel trouvé entre les branches
        sky, plate_rgb, dw = classify(seed | (ero(sky, 1) & needle))
    fgw = (~dil(sam & (dw < T_SNOW), 1) & (dw > 14)).astype(F32)
    F_rgb = local_plate(I, fgw, 3)           # couleur locale du premier plan

    closed = cv2.morphologyEx(sky.astype(np.uint8), cv2.MORPH_CLOSE, disk(2)).astype(bool)
    sky |= closed & ~needle & (dw < 14) & above
    d = plate_rgb - F_rgb
    dd = (d * d).sum(-1)
    t = ((I - F_rgb) * d).sum(-1) / np.maximum(dd, 1e-6)
    res = np.sqrt(((I - (F_rgb + t[..., None] * d)) ** 2).sum(-1))
    grow = (t >= 0.75) & (t <= 1.15) & (res < 0.04) & (dw < 12) & ~needle & dil(sam, R_OUT) & above
    for _ in range(3):
        sky |= dil(sky, 1) & grow

    soft = (dil(sky, 1) & ~ero(sky, 1)) | (needle & dil(sky, 3) & ~ero(sky, 2))
    sel = soft & (dd > 0.004) & ((res < 0.07) | ~needle)
    alpha = sky.astype(F32)
    alpha[sel] = np.clip(t[sel], 0, 1)
    alpha = np.where(alpha >= np.where(hole, 0.75, 0.9), 1, np.where(alpha <= 0.1, 0, alpha))
    alpha[~above] = 0
    return (alpha * 255 + 0.5).astype(np.uint8)


def sky():
    for pid, c in HERO.items():
        a = sky_alpha(pid)
        out = os.path.join(IMG, c['out'])
        Image.fromarray(np.dstack([np.zeros_like(a), a]), 'LA').save(out, optimize=True)
        log('sky', pid, '->', out, os.path.getsize(out) // 1024, 'Ko', 'partiels', int(((a > 0) & (a < 255)).sum()))


def qa(outdir):
    """Composites de contrôle : magenta 50 %, mot test violet dans la zone du H1 et 150 px plus bas
    (doit passer derrière faîtage / pic), aplat violet (révèle tout halo de ciel laissé sur les objets)."""
    os.makedirs(outdir, exist_ok=True)
    font = os.path.join(ROOT, 'public', 'assets', 'fonts', 'Boska-Light.woff2')
    vio = np.array([0x51, 0x05, 0x43], F32)
    for pid, c in HERO.items():
        img = np.asarray(Image.open(master_path(pid)).convert('RGB')).astype(F32)
        a = np.asarray(Image.open(os.path.join(IMG, c['out'])).getchannel('A')).astype(F32) / 255
        H, W = a.shape
        x0, y0, x1, y1 = c['zone']
        size = 200
        while size > 20:
            f = ImageFont.truetype(font, size)
            if ImageDraw.Draw(Image.new('L', (1, 1))).textlength('Le soir tombe.', font=f) <= x1 - x0:
                break
            size -= 2
        for name, dy in (('txt0', 0), ('txt150', 150), ('fill', None)):
            if dy is None:
                cov = np.ones((H, W), F32)
            else:
                lay = Image.new('L', (W, H), 0)
                dr = ImageDraw.Draw(lay)
                dr.text((x0, y0 + dy), 'Le soir tombe.', font=f, fill=255)
                dr.text((x0, y0 + dy + size * 0.95), 'Entrez.', font=f, fill=255)
                cov = np.asarray(lay).astype(F32) / 255
            k = (cov * a)[..., None]
            Image.fromarray((img * (1 - k) + vio * k).astype(np.uint8)).save(os.path.join(outdir, f'{pid}_{name}.png'))
        mag = img * (1 - 0.5 * a[..., None]) + np.array([255, 0, 255], F32) * 0.5 * a[..., None]
        Image.fromarray(mag.astype(np.uint8)).save(os.path.join(outdir, f'{pid}_mag.png'))
        log('qa', pid, '->', outdir)


# --------------------------------------------------------------------------------------------- montage
def fit(box, ratio, W, H):
    """Élargit la boîte au ratio voulu autour de son centre, reste dans la source (jamais d'étirement)."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    if w / h < ratio:
        w = h * ratio
    else:
        h = w / ratio
    if w > W:
        w, h = W, W / ratio
    if h > H:
        h, w = H, H * ratio
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    x0 = min(max(cx - w / 2, 0), W - w)
    y0 = min(max(cy - h / 2, 0), H - h)
    return (x0, y0, x0 + w, y0 + h)


def warm(im, amount=0.02):
    """Réchauffement très léger : rouge +2 %, bleu −3 % (en proportion)."""
    a = np.asarray(im).astype(F32)
    a[..., 0] *= 1 + amount
    a[..., 2] *= 1 - 1.5 * amount
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8))


def save_budget(im, base):
    sizes = {}
    for fmt, q0, ext in (('AVIF', 60, 'avif'), ('WEBP', 82, 'webp')):
        for q in range(q0, 20, -2):
            b = io.BytesIO()
            if fmt == 'AVIF':
                im.save(b, fmt, quality=q, speed=4)
            else:
                im.save(b, fmt, quality=q, method=6)
            if b.tell() <= BUDGET[ext]:
                break
        with open(f'{base}.{ext}', 'wb') as fh:
            fh.write(b.getvalue())
        sizes[ext] = (b.tell(), q)
    return sizes


def montage():
    out = os.path.join(IMG, 'intro')
    os.makedirs(out, exist_ok=True)
    for k, (pid, rel, bd, bm) in MONTAGE.items():
        src = Image.open(os.path.join(SRC, rel)).convert('RGB')
        for v, box in (('d', bd), ('m', bm)):
            ow, oh = SIZES[v]
            b = fit(box, ow / oh, *src.size)
            r = src.resize((ow, oh), Image.LANCZOS, box=b)
            r = r.filter(ImageFilter.UnsharpMask(radius=0.6, percent=40, threshold=2))
            if pid == 'N052':
                r = warm(r)
            r = grade.photo(r)
            sz = save_budget(r, os.path.join(out, f'm{k}-{v}'))
            log(f'm{k}-{v}', pid, [round(x) for x in b], {e: f'{s // 1024} Ko q{q}' for e, (s, q) in sz.items()})


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if what in ('masters', 'all'):
        masters()
    if what in ('sky', 'all'):
        sky()
    if what in ('montage', 'all'):
        montage()
    if what == 'qa':
        qa(sys.argv[2])
