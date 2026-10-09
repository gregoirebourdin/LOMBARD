"""Masters des vues 3D « plates » de la vitrine S4 (spec §5.2.2, §5.2.3, §5.2.7) et des vignettes du hero
(spec §3 S1 « Vignettes »).

Usage : python tools/retouch/flats.py              (tout : masters puis vignettes)
        python tools/retouch/flats.py V26 thumbs   (une partie : V26, flats, thumbs)

Écrit des PNG sans perte dans tools/.cache/masters/ (ignoré par git), tous étalonnés avec
tools/grade.py render() (vues 3D) ; les recadrages des flats sont dans tools/images.d/flats.json,
l'export AVIF/WebP par tools/images.py. Les vignettes (rectangles 144×180, découpées en pignon par
le CSS) sont écrites directement dans public/assets/img/thumbs/.

  V26  La Rouya, façade sud : enlève la petite silhouette d'enfant (≈ 361-378, 700-746) et son ombre
       portée, la voiture sous l'avant-toit (≈ 452-590, 650-718) et son ombre, la table de pique-nique
       à gauche dans la neige (≈ 50-178, 735-815), son ombre et la neige tassée à son pied. Le poteau de
       l'avant-toit, la table de la terrasse et le chalet (x >= 589 sous le balcon) sont protégés : ils
       ne font pas partie du trou. Les traces de pas dans la neige restent. Le toit bleu reste tel quel
       (c'est le projet). Rien n'est ajouté ; hors du trou, les pixels sont identiques (assert).
       Écrit aussi : le masque (union des trois trous, blanc = retiré) dans
       tools/.cache/masks/flats/V26-mask.png (+ copie dans le scratchpad v2/assets_qa/flats/) pour
       appliquer le même retrait aux plans de parallaxe, et V26-retouche-brut.png (même retrait, NON
       étalonné) à côté du master étalonné V26-retouche.png.
  Les autres vues (V56, V57, V54, V35, V34, V30, V33, V27) : aucune retouche, seulement l'étalonnage ;
       master = vue entière (v-<id>.png), les recadrages sont dans le JSON :
         V54 [0, 0, 1372, 1024]   coupe le chalet voisin (son avant-toit commence à x 1381), 4:3 un
                                  peu plus large (1,34) ;
         V35 [0, 0, 1276, 1024]   x < 1300 demandé ; 1276 retire aussi le coin de l'âtre noir et son
                                  socle bois (x >= 1278), restes du feu de synthèse du bord droit ;
         V30 [192, 216, 1536, 1024]  la spec dit [120, 140, ...] mais ce cadre laissait la moitié basse
                                  de la sculpture « blob » au bord haut (elle descend à y 211) et les
                                  feuilles du sapin lumineux au bord gauche (jusqu'à x 187) : le cadre
                                  est resserré juste assez pour retirer les deux (1344×808, 1,66).
       Pas de filigrane « IA » dans les coins d'aucune de ces vues (vérifié en contraste renforcé).
       Pas de désaturation du fauteuil bleu de V27 (spec §5.2.3) : les plans de layers/V27 ne l'ont pas
       non plus, et la vue plate doit rester identique aux plans au repos.
  Vignettes (rectangles 4:5, 144×180, WebP q 80, ≤ 9 Ko) tirées des masters étalonnés :
       serre-orchis V56 [560, 160, 1240, 1010] ; sabot-venus V34 [180, 4, 1000, 1024] (la spec dit
       y 60-1080 mais V34 n'a que 1024 px de haut : même cadre remonté de 56 px) ; la-rouya V26 retouché
       [500, 224, 1140, 1024].

Méthode : masques SAM 2.1 (objets) + ombres portées détectées par couleur (neige à l'ombre = bleutée
et plus sombre que la neige au soleil) reliées à l'objet ; trous dilatés ; remplissage LaMa (ONNX) à
1:1 sur une tuile de 512 px qui garde le contexte ; seuls les pixels du trou sont remplacés.
Vérification : recadrages 100 % / 300-400 % dans le scratchpad (v2/assets_qa/flats).

Modèles hors ligne : HF_HUB_CACHE (défaut : le cache du scratchpad), HF_HUB_OFFLINE=1.
Sources : LOMBARD_SOURCES (défaut : le scratchpad de la session de conception).
"""
import glob, json, os, sys

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
MASKS = os.path.join(ROOT, 'tools', '.cache', 'masks', 'flats')
THUMB_DIR = os.path.join(ROOT, 'public', 'assets', 'img', 'thumbs')
THREADS = int(os.environ.get('THREADS', '3'))
VEFA = os.path.join(SRC, 'v2', 'vefa')
INDEX = json.load(open(os.path.join(VEFA, 'index.json')))


def vpath(vid):
    return os.path.join(VEFA, INDEX[vid])


def load(p):
    return np.asarray(Image.open(p).convert('RGB'))


def disk(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def dilate(m, r):
    return cv2.dilate(m.astype(np.uint8), disk(r)) > 0


# ----------------------------------------------------------------------------- models
_sam = None
_lama = None


def sam_mask(img, crop, key, box=None, pts=None):
    """SAM 2.1 sur un recadrage de 512 px (plus de détail qu'à l'échelle de l'image entière).
    crop = (x0, y0) du recadrage ; box / pts en px de l'image. Renvoie un masque booléen pleine
    taille (seuil 0,5). Mis en cache en PNG."""
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


def lama(img, hole, center):
    """LaMa à 1:1 sur une tuile de 512 px centrée sur `center` (bornée à l'image). Seuls les pixels
    du trou sont remplacés."""
    global _lama
    if _lama is None:
        import onnxruntime as ort
        so = ort.SessionOptions()
        so.intra_op_num_threads = THREADS
        p = glob.glob(os.path.join(HF, 'models--Carve--LaMa-ONNX', 'snapshots', '*', 'lama_fp32.onnx'))[0]
        _lama = ort.InferenceSession(p, so, providers=['CPUExecutionProvider'])
    H, W = hole.shape
    x0 = int(np.clip(center[0] - 256, 0, W - 512))
    y0 = int(np.clip(center[1] - 256, 0, H - 512))
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


def snow_shadow(img, poly, lum_max=None, blue_min=None):
    """Ombre portée sur la neige dans le polygone `poly` (px de l'image) : pixels plus sombres que
    la neige au soleil (luminance < lum_max) et/ou bleutés (b - r > blue_min)."""
    f = img.astype(np.float32)
    lum = 0.2126 * f[..., 0] + 0.7152 * f[..., 1] + 0.0722 * f[..., 2]
    m = np.zeros(img.shape[:2], np.uint8)
    cv2.fillPoly(m, [np.array(poly, np.int32)], 1)
    m = m > 0
    k = np.zeros_like(m)
    if lum_max is not None:
        k |= lum < lum_max
    if blue_min is not None:
        k |= (f[..., 2] - f[..., 0]) > blue_min
    return m & k


def attached(mask, seed, r=3):
    """Composantes de `mask` qui touchent `seed` dilaté de r px."""
    n, lab = cv2.connectedComponents(mask.astype(np.uint8), connectivity=8)
    ids = np.unique(lab[dilate(seed, r) & mask])
    return np.isin(lab, ids[ids > 0])


def close(m, r):
    return cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, disk(r)) > 0


def fill_holes(m):
    """Bouche les trous internes d'un masque (contours externes remplis)."""
    out = np.zeros(m.shape, np.uint8)
    cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(out, cs, -1, 1, -1)
    return out > 0


def save_master(rgb, name):
    os.makedirs(MASTERS, exist_ok=True)
    out = grade.render(Image.fromarray(rgb))
    p = os.path.join(MASTERS, name + '.png')
    out.save(p, optimize=False, compress_level=6)
    print('master', p, out.size)
    return out




# ----------------------------------------------------------------------------- V26
def v26_holes(im):
    """Les trois trous de V26 (enfant, table de pique-nique, voiture), chacun avec son ombre portée,
    et les éléments protégés (poteau de l'avant-toit, table de la terrasse)."""
    child = sam_mask(im, (200, 450), 'v26_child', box=(357, 697, 381, 749))
    table = sam_mask(im, (0, 512), 'v26_picnic', box=(46, 732, 176, 818))
    car = sam_mask(im, (300, 450), 'v26_car', box=(450, 648, 592, 720))
    post = sam_mask(im, (300, 450), 'v26_post', pts=[(524, 640, 1), (524, 700, 1), (524, 750, 1), (500, 690, 0), (550, 690, 0)])
    ttable = sam_mask(im, (300, 450), 'v26_terrace_table', pts=[(570, 735, 1), (548, 770, 1), (590, 765, 1), (524, 700, 0)])
    # enfant : ombre bleutée vers la droite et vers l'avant (soleil en arrière à gauche), pénombre comprise
    cs = attached(snow_shadow(im, [(364, 738), (372, 731), (426, 758), (426, 778), (368, 762)], lum_max=200, blue_min=4),
                  child, 4)
    h_child = dilate(fill_holes(close(child | cs, 3)), 6)
    # table de pique-nique : son ombre (qui s'arrête au-dessus de la grande ombre d'arbre, gardée) et la
    # neige tassée et salie au pied du banc gauche
    ts = attached(snow_shadow(im, [(60, 790), (185, 790), (185, 838), (150, 842), (120, 844), (90, 842), (70, 836)],
                              blue_min=4), table, 4)
    foot = np.zeros(im.shape[:2], np.uint8)
    cv2.fillPoly(foot, [np.array([(48, 778), (70, 780), (88, 800), (88, 822), (60, 822), (46, 805)], np.int32)], 1)
    h_table = dilate(fill_holes(close(table | ts | (foot > 0), 3)), 6)
    # voiture : ombre grise sous la caisse, à gauche du poteau et entre le poteau et la table de terrasse
    sh = snow_shadow(im, [(455, 698), (520, 700), (520, 736), (455, 712)], lum_max=180)
    sh |= snow_shadow(im, [(532, 705), (587, 705), (587, 740), (532, 740)], lum_max=180)
    sh = attached(sh & ~(post | ttable), car, 3)
    h_car = dilate(fill_holes(close(car | sh, 3)), 5) & ~(post | ttable)
    h_car[:, 589:] = False                      # sous le balcon : structure du chalet, intacte
    return h_child, h_table, h_car


def v26():
    src = load(vpath('V26'))
    h_child, h_table, h_car = v26_holes(src)
    im = lama(src, h_child, (390, 735))
    im = lama(im, h_table, (110, 790))
    # tuile qui voit le poteau, le pré, le talus et le chalet : la neige continue derrière le poteau
    im = lama(im, h_car, (520, 690))
    hole = h_child | h_table | h_car
    assert (im[~hole] == src[~hole]).all()     # rien d'autre n'a bougé
    mask = Image.fromarray((hole * 255).astype(np.uint8))
    mask.save(os.path.join(MASKS, 'V26-mask.png'))
    qa = os.path.join(SCRATCH, 'v2', 'assets_qa', 'flats')
    if os.path.isdir(qa):
        mask.save(os.path.join(qa, 'V26-mask.png'))
    # version non étalonnée (même retrait, pour la découpe en plans) puis master étalonné
    Image.fromarray(im).save(os.path.join(MASTERS, 'V26-retouche-brut.png'), compress_level=6)
    save_master(im, 'V26-retouche')


# ----------------------------------------------------------------------------- flats
# vues sans retouche : master = vue entière étalonnée (les recadrages sont dans tools/images.d/flats.json)
FLATS = ['V56', 'V57', 'V54', 'V35', 'V34', 'V30', 'V33', 'V27']


def flats():
    for vid in FLATS:
        save_master(load(vpath(vid)), 'v-' + vid)


# ----------------------------------------------------------------------------- vignettes
# rectangles 4:5 (le CSS les découpe en pignon), 144×180 = 2× la plus grande vignette du hero (56×70)
THUMBS = {
    'serre-orchis': ('v-V56', (560, 160, 1240, 1010)),
    # spec : [180, 60, 1000, 1080], mais V34 ne fait que 1024 px de haut : même cadre remonté de 56 px
    'sabot-venus': ('v-V34', (180, 4, 1000, 1024)),
    'la-rouya': ('V26-retouche', (500, 224, 1140, 1024)),
}
THUMB_SIZE = (144, 180)


def thumbs():
    from PIL import ImageFilter, ImageOps
    os.makedirs(THUMB_DIR, exist_ok=True)
    for name, (master, box) in THUMBS.items():
        im = Image.open(os.path.join(MASTERS, master + '.png')).convert('RGB').crop(box)   # master déjà étalonné
        im = ImageOps.fit(im, THUMB_SIZE, Image.LANCZOS)
        im = im.filter(ImageFilter.UnsharpMask(radius=0.6, percent=40, threshold=2))
        p = os.path.join(THUMB_DIR, name + '.webp')
        q = 80
        im.save(p, 'WEBP', quality=q, method=6)
        while os.path.getsize(p) > 9 * 1024 and q > 60:      # plafond 9 Ko
            q -= 4
            im.save(p, 'WEBP', quality=q, method=6)
        print('thumb', p, im.size, f'q{q}', os.path.getsize(p), 'o')


STEPS = {'V26': v26, 'flats': flats, 'thumbs': thumbs}

if __name__ == '__main__':
    for k in sys.argv[1:] or list(STEPS):
        STEPS[k]()
