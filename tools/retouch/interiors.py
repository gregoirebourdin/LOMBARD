"""Retouches du groupe « interiors » (S2, « Les pièces ») : masters de piece-feu, piece-feu-portrait,
piece-table (+ portrait) et piece-matin.

Usage : python tools/retouch/interiors.py            (tout)
        python tools/retouch/interiors.py feu table  (une partie : feu, feu-portrait, table, matin)

Écrit des PNG sans perte dans tools/.cache/masters/ (ignoré par git). Les recadrages ne sont pas faits
ici mais dans tools/images.d/interiors.json, pour que piece-table et piece-table-portrait partagent le
même master. Toutes les retouches ne font qu'ENLEVER des distractions listées par la spec ; rien n'est
ajouté. L'étalonnage commun tools/grade.py photo() est appliqué après retouche.

  piece-feu           I029  enlève l'appareil photo (le « sac ») posé au bout gauche de la table
                            (x 38-130, y 642-668) et la figurine de bouledogue sur la console à droite
                            (x 1726-1790, y 646-714), en partie cachée par le fauteuil : le fauteuil est
                            protégé (masque SAM) et ne fait pas partie du trou.
  piece-feu-portrait  I078  aucune retouche (recadrage x >= 140 dans le JSON : enlève le tableau).
  piece-table         N049  enlève la grue de chantier vue par la fenêtre gauche (flèche x 1002-1236,
                            y 893-921 ; mât x 1191-1213, y 884-1036 ; câble x 1222-1232, y 913-995).
                            La lisse du garde-corps est devant la grue : son liseré clair et son nœud
                            restent d'origine, le fantôme du mât dans le bas de la planche (y 1008-1022)
                            est refait par un clone horizontal raccordé (fil du bois) ; adoucit très légèrement le
                            texte des deux étiquettes de vin (fermeture morphologique 3 px qui efface les
                            traits sombres fins sans toucher aux reflets clairs du verre posé devant,
                            mélangée à 70 %). La TV est coupée par le recadrage x < 2550 du JSON.
  piece-matin         I141  aucune retouche.

Méthode : masques SAM 2.1 (objets) ou polygones (grue), dilatés ; remplissage LaMa (ONNX) à 1:1 sur
une tuile de 512 px centrée sur l'objet, qui garde tout le contexte autour ; seuls les pixels du trou
sont remplacés. Les masques SAM sont mis en cache dans tools/.cache/masks/interiors/.
Vérification : recadrages 100 % / 400 % écrits par la session de travail (scratchpad v2/assets_qa/interiors).

Modèles hors ligne : HF_HUB_CACHE (défaut : le cache du scratchpad), HF_HUB_OFFLINE=1.
Sources : LOMBARD_SOURCES (défaut : le scratchpad de la session de conception).
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
MASKS = os.path.join(ROOT, 'tools', '.cache', 'masks', 'interiors')
THREADS = int(os.environ.get('THREADS', '3'))

I029 = os.path.join(SRC, 'orig', '2024_09_Chalet_Lombard_interieur_thermo-trate-1.jpg')
I078 = os.path.join(SRC, 'orig', '2024_09_Chalets_Lombard_interieur_chalets300m2_meleze-thermo-traite.jpg')
N049 = os.path.join(SRC, 'v2', 'new', '2026_01_Chalets_Lombard-Chalet-Mas-Monts-236.jpg')
I141 = os.path.join(SRC, 'orig', '2026_01_Chalets_Lombard_Chalet_Krampus.png')


def load(p):
    return np.asarray(Image.open(p).convert('RGB'))


def save(rgb, name):
    os.makedirs(MASTERS, exist_ok=True)
    out = grade.photo(Image.fromarray(rgb))
    p = os.path.join(MASTERS, name + '.png')
    out.save(p, optimize=False, compress_level=6)
    print('master', p, out.size)


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
    assert not (hole & ~_window(hole.shape, x0, y0)).any(), 'trou hors de la tuile'
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


def _window(shape, x0, y0):
    w = np.zeros(shape, bool)
    w[y0:y0 + 512, x0:x0 + 512] = True
    return w


def despeckle(img, hole, thr=35):
    """Dans le remplissage seulement : un pixel isolé très différent de sa médiane 5x5 (LaMa sème
    parfois un point clair) reprend la médiane."""
    med = cv2.medianBlur(img, 5)
    d = np.abs(img.astype(np.int16) - med.astype(np.int16)).max(-1)
    k = (d > thr) & hole
    out = img.copy()
    out[k] = med[k]
    return out


def hclone(img, hole):
    """Pour une structure horizontale (planche, fil du bois) : chaque segment troué d'une rangée est
    remplacé par un fondu entre la même rangée décalée vers la gauche et vers la droite (de la largeur
    du segment + 4 px), plus une correction linéaire de l'écart mesuré sur 3 px réels de chaque côté,
    pour un raccord sans couture. Ne convient qu'à des trous étroits (quelques dizaines de px)."""
    out = img.astype(np.float32)
    for y in np.where(hole.any(1))[0]:
        xs = np.where(hole[y])[0]
        for run in np.split(xs, np.where(np.diff(xs) > 1)[0] + 1):
            a, b = int(run[0]), int(run[-1])
            n = b - a + 1
            s = n + 4
            t = ((np.arange(n) + 1) / (n + 1))[:, None]
            L, R = out[y, a - s:b - s + 1], out[y, a + s:b + s + 1]
            dl = out[y, a - 3:a].mean(0) - out[y, a - 3 - s:a - s].mean(0)
            dr = out[y, b + 1:b + 4].mean(0) - out[y, b + 1 + s:b + 4 + s].mean(0)
            out[y, a:b + 1] = (1 - t) * (L + dl) + t * (R + dr)
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


# ----------------------------------------------------------------------------- groups
def feu():
    im = load(I029)
    # appareil photo au bout gauche de la table (devant le rideau / sur le plateau)
    cam = sam_mask(im, (0, 400), 'i029_camera', box=(36, 639, 133, 671))
    hole = dilate(cam, 10)                     # 10 px : le reflet du plateau se raccorde sans tache
    im = lama(im, hole, (85, 655))
    # figurine de bouledogue sur la console, derrière le fauteuil (le fauteuil reste intact)
    dog = sam_mask(im, (1408, 424), 'i029_bulldog', box=(1723, 644, 1793, 717),
                   pts=[(1768, 668, 1), (1740, 700, 1), (1790, 720, 0)])
    chair = sam_mask(im, (1408, 424), 'i029_chair', pts=[(1800, 730, 1), (1850, 700, 1), (1765, 665, 0)])
    hole = dilate(dog, 4) & ~chair
    im = lama(im, hole, (1757, 680))
    save(im, 'piece-feu')


def feu_portrait():
    save(load(I078), 'piece-feu-portrait')


def table():
    im = load(N049)
    H, W = im.shape[:2]
    # grue : flèche, tirant, mât (jusqu'au toit, fantôme sur la lisse compris), contre-flèche, câble
    m = np.zeros((H, W), np.uint8)
    cv2.polylines(m, [np.array([(1002, 899), (1125, 904), (1196, 909), (1236, 916)], np.int32)], False, 1, thickness=12)
    cv2.polylines(m, [np.array([(1199, 910), (1211, 886)], np.int32)], False, 1, thickness=8)
    cv2.rectangle(m, (1191, 884), (1213, 1036), 1, -1)
    cv2.rectangle(m, (1222, 913), (1232, 995), 1, -1)
    cv2.rectangle(m, (1158, 903), (1196, 921), 1, -1)
    hole = dilate(m, 2)
    # La lisse du garde-corps passe DEVANT la grue. Son liseré clair (y 995 à gauche, 994 à droite :
    # légère pente) et le haut de la planche avec son nœud (jusqu'à y 1007) restent d'origine ; seul
    # le fantôme du mât dans le bas de la planche (y 1008-1021) et le mât sous la lisse sont refaits.
    keep = np.zeros_like(hole)
    keep[995:1008, 1186:1217] = True
    keep[994:1008, 1217:1241] = True
    hole &= ~keep
    # bas de la planche (y 1008-1022, fil du bois horizontal) : clone horizontal raccordé (LaMa y
    # étalait la couleur du nœud) ; le reste du trou (ciel, forêt, sous la lisse) : LaMa
    rail = np.zeros_like(hole)
    rail[1008:1023] = hole[1008:1023]
    im = hclone(im, rail)
    hole &= ~rail
    im = lama(im, hole, (1120, 950))
    im = despeckle(im, hole)
    # juste au-dessus du liseré (y 993-994), LaMa prolonge le bois d’un pixel : ces deux rangs sont
    # refaits par interpolation horizontale entre les pixels d'origine de part et d'autre (une
    # ligne horizontale reste une ligne horizontale)
    for y in range(993, 995):
        row, h = im[y].astype(np.float32), hole[y]
        xs = np.arange(W)
        ok = ~h
        for c in range(3):
            row[h, c] = np.interp(xs[h], xs[ok], row[ok, c])
        im[y] = np.clip(row + 0.5, 0, 255).astype(np.uint8)
    # étiquettes de vin : texte adouci, reflets du verre conservés
    lab = np.zeros((H, W), np.float32)
    for x0, y0, x1, y1 in [(1809, 1268, 1866, 1331), (1896, 1252, 1954, 1330)]:
        lab[y0:y1 + 1, x0:x1 + 1] = 1
    lab = cv2.GaussianBlur(lab, (0, 0), 1.5)[..., None] * 0.7
    f = im.astype(np.float32)
    soft = cv2.GaussianBlur(cv2.morphologyEx(f, cv2.MORPH_CLOSE, disk(1)), (0, 0), 0.6)
    im = np.clip(f * (1 - lab) + soft * lab + 0.5, 0, 255).astype(np.uint8)
    save(im, 'piece-table')


def matin():
    save(load(I141), 'piece-matin')


STEPS = {'feu': feu, 'feu-portrait': feu_portrait, 'table': table, 'matin': matin}

if __name__ == '__main__':
    for k in sys.argv[1:] or list(STEPS):
        STEPS[k]()
