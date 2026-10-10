"""Scène « Votre chalet vous attend » : une photo d'hiver découpée en plans de parallaxe.
avant : les branches de sapin enneigées, très proches et floues, qui encadrent l'image, en quatre masses ;
milieu : le chalet et la neige ; fond : le ciel.

Usage : python tools/scene_planes.py [--fresh]
Entrées : la photo du site actuel (tools/.cache/2024_09_Chalets_Lombard_hiver_exterieure_chlaets-100me.jpg,
téléchargée au besoin), les modèles hors ligne de tools/layers.py (profondeur Depth Anything V2,
remplissage LaMa) — variable HF_CACHE : dossier du cache Hugging Face — et pymatting.

Méthode :
- avant : la profondeur donne une zone sûrement « branche » et une zone sûrement « chalet ou ciel » ;
  entre les deux, la transparence est calculée sur la photo (détourage « closed-form »), si bien que le
  dégradé suit le flou réel des branches et pas la pente de la carte de profondeur ;
- dans ce dégradé, couleurs de la branche et de ce qu'il y a derrière séparées (estimation « ML ») : le
  plan du milieu ne garde aucune trace de branche ; sous la branche opaque, il est reconstitué (LaMa, à
  partir de ce fond nettoyé), ce qui ne sert qu'au repos ;
- fond : le ciel (très clair, lointain), prolongé en douceur sous le chalet ;
- l'avant est découpé en quatre masses de branches (en haut à gauche, en haut à droite, à droite, en bas
  à gauche), chacune ancrée à son coin ou à son bord de l'image. page.js les fait partir énormes (tout
  près, elles couvrent l'écran et le titre) puis les ramène à leur taille autour de leur ancre : elles
  s'écartent jusqu'à leur place exacte sur la photo. Agrandie autour de son ancre, une masse couvre
  toujours au moins ce qu'elle couvre sur la photo : on ne voit jamais ce qu'elle cache. Les jours entre
  les aiguilles, au cœur des masses, sont peints dans la branche (opaques, couleur de la photo) ;
- découpe sans couture : chaque pixel est partagé entre les masses voisines (fondu de FEATHER px), et la
  transparence de chacune est calculée pour que leur superposition redonne exactement celle de la photo
  (la masse du dessus s'efface en fondu, celle du dessous reste pleine sous elle).
Au repos, avant ∘ milieu ∘ fond redonne la photo.

Sorties : public/assets/scenes/vca/back, mid (plein cadre), front-tl, -tr, -r, -bl (recadrées à leur boîte,
avec leur ancre) en AVIF + WebP, et scene.json ; contrôles dans tools/.cache/vca/ (alpha, plaque, découpe,
simulation du mouvement). Les calculs lourds sont gardés dans tools/.cache/vca/planes.npz (--fresh : refaire).
"""
import json, os, sys, urllib.request
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
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
FEATHER = 48            # px de fondu entre deux masses de branches
CORE_IN = 22            # px sous le bord d'une masse où ses jours deviennent opaques
# masses de branches, de celle du dessus à celle du dessous : nom, ancre (fraction de l'image), échelle de départ
PIECES = [('tl', (0, 0), 2.4), ('tr', (1, 0), 2.4), ('r', (1, .72), 2.3), ('bl', (0, 1), 2.2)]
# mouvement de page.js (mêmes valeurs) : milieu et fond, échelles de départ autour de ORIGIN, arrivée à 1
ORIGIN, MID0, BACK0 = (.5, .46), 1.08, 1.04


def disk(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def sm(x):
    return cv2.resize(x, (x.shape[1] // 3, x.shape[0] // 3), interpolation=cv2.INTER_AREA)


def to8(x):
    return (np.clip(x, 0, 1) * 255 + .5).astype(np.uint8)


def main():
    if not os.path.exists(SRC):
        req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as r, open(SRC, 'wb') as f:
            f.write(r.read())
    os.makedirs(QA, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    img8 = np.array(Image.open(SRC).convert('RGB'))
    img = img8.astype(F32) / 255
    cache = os.path.join(QA, 'planes.npz')
    if not os.path.exists(cache) or '--fresh' in sys.argv:
        np.savez_compressed(cache, **planes(img8, img))
    z = np.load(cache)
    pieces(img, *(z[k] for k in ('a', 'front', 'mid', 'am', 'back', 'hole')))


def planes(img8, img):
    """Plans au repos : transparence et couleur de l'avant, milieu, fond (calculs lourds)."""
    import layers as L
    from pymatting import estimate_alpha_cf, estimate_foreground_ml
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
    Image.fromarray(to8(sm(tri.astype(F32)))).save(os.path.join(QA, 'trimap.jpg'))
    Image.fromarray(to8(sm(sky_all))).save(os.path.join(QA, 'alpha-sky.jpg'))
    Image.fromarray(to8(sm(plate))).save(os.path.join(QA, 'plate.jpg'), quality=88)
    return {'a': a, 'front': front, 'mid': mid, 'am': am, 'back': back, 'hole': hole}


def pieces(img, a, front, mid, am, back, hole):
    """Découpe l'avant en masses de branches, exporte les plans, simule le mouvement de page.js."""
    H, W = a.shape

    # ——— cœur des masses : les jours entre les aiguilles deviennent de la branche (couleur de la photo)
    solid = (a > .5).astype(np.uint8)
    out = solid.copy()
    cv2.floodFill(out, None, (W // 2, int(H * .6)), 2)                # le dehors, depuis le chalet
    # (loin du bord : près du bord, la photo mêle encore le ciel clair à la branche ; opaque, ce mélange
    # dessinerait un liseré clair sur une autre masse)
    core = cv2.erode((out != 2).astype(np.uint8), disk(CORE_IN)) > 0
    A = np.where(core, 1, a).astype(F32)
    C = np.where(core[..., None], img, front).astype(F32)
    # bords fins : là où la branche est presque transparente, sa couleur estimée garde un peu du ciel
    # (plus clair, ou d'un bleu saturé) ; invisible sur la photo, ce reste dessine un liseré sur une autre
    # masse. Le bord prend donc, d'autant plus qu'il est transparent, la couleur de la branche prolongée
    # depuis son plein (un bord enneigé reste blanc : son plein l'est aussi).
    from layers import push_pull
    full = (A > .9).astype(F32)
    ext = push_pull(C * full[..., None], full)
    t = np.clip((A - .15) / (.9 - .15), 0, 1)[..., None]
    edge = ((A > 0) & (A < .9))[..., None]
    C = np.where(edge, t * C + (1 - t) * ext, C).astype(F32)
    behind = am[..., None] * mid + (1 - am[..., None]) * back
    err = np.abs(A[..., None] * C + (1 - A[..., None]) * behind - img).max(-1)
    print(f'écart de la photo au repos : moyen {err.mean() * 255:.2f}/255, '
          f'{(err > 8 / 255).mean() * 100:.2f} % des pixels au-delà de 8/255')

    # ——— graines : les trois masses (> .5), celle du haut coupée en deux au-dessus du pignon
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, 8)
    big = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 50000]
    top = next(i for i in big if st[i, cv2.CC_STAT_TOP] == 0)
    right = next(i for i in big if i != top and st[i, cv2.CC_STAT_LEFT] > W / 2)
    left = next(i for i in big if i not in (top, right))
    xs = np.arange(W)[None, :]
    seeds = {'tl': (lab == top) & (xs < W * .44), 'tr': (lab == top) & (xs > W * .5),
             'r': lab == right, 'bl': lab == left}
    # parts : chaque pixel va à la masse la plus proche, en fondu de FEATHER px entre deux masses
    dist = {k: cv2.distanceTransform((~v).astype(np.uint8), cv2.DIST_L2, 5) for k, v in seeds.items()}
    dmin = np.minimum.reduce(list(dist.values()))
    w = {k: np.clip(1 - (v - dmin) / FEATHER, 0, 1) for k, v in dist.items()}
    tot = sum(w.values())
    m = {k: v / tot for k, v in w.items()}
    # transparences, sans aucun bord net :
    # - dans le dégradé des branches (A < 1), répartition exacte : superposées du dessus au dessous, les
    #   masses redonnent A ;
    # - dans le plein des branches (A = 1), chaque masse est opaque sur sa moitié du fondu et s'efface sur
    #   l'autre moitié : l'une est toujours pleine, le total reste opaque, et aucune ne s'arrête net
    #   (la répartition exacte laisserait la masse du dessous pleine jusqu'au bout du fondu : un bord net
    #   dès que la masse du dessus s'en écarte) ; passage de l'une à l'autre selon A⁴.
    alphas, above = {}, np.zeros_like(A)
    wA = A ** 4
    for k, _, _ in PIECES:
        exact = np.where(m[k] > 0, A * m[k] / np.maximum(1 - A * above, 1e-6), 0)
        alphas[k] = np.clip((1 - wA) * exact + wA * A * np.clip(2 * m[k], 0, 1), 0, 1).astype(F32)
        above = above + m[k]
    rest = 1 - np.prod([1 - alphas[k] for k, _, _ in PIECES], axis=0)
    print(f'écart de transparence des masses au repos : moyen {np.abs(rest - A).mean():.5f}, max {np.abs(rest - A).max():.3f}')

    # ——— exports
    meta = {'w': W, 'h': H, 'planes': []}
    kb = save_plane(back, os.path.join(OUT, 'back'), False, WIDTHS, 56, 80)
    meta['planes'].append({'name': 'back', 'bbox': [0, 0, W, H], 'files': WIDTHS, 'kb': kb})
    kb = save_plane(np.dstack([mid, am]), os.path.join(OUT, 'mid'), True, WIDTHS, 58, 84)
    meta['planes'].append({'name': 'mid', 'bbox': [0, 0, W, H], 'files': WIDTHS, 'kb': kb})
    for k, (ax, ay), s0 in PIECES:
        ys, xs_ = np.where(alphas[k] > 1 / 255)
        bb = [int(xs_.min()), int(ys.min()), int(xs_.max()) + 1, int(ys.max()) + 1]
        rgba = np.dstack([C, alphas[k]])[bb[1]:bb[3], bb[0]:bb[2]]
        ws = [round(x * (bb[2] - bb[0]) / W) for x in WIDTHS]
        kb = save_plane(rgba, os.path.join(OUT, f'front-{k}'), True, ws, 58, 84)
        meta['planes'].append({'name': f'front-{k}', 'bbox': bb, 'anchor': [round(ax * W), round(ay * H)],
                               's0': s0, 'files': ws, 'kb': kb})
    for f in os.listdir(OUT):                                          # l'ancien avant d'un seul tenant
        if f.startswith('front-') and f.split('-')[1].split('.')[0].isdigit():
            os.remove(os.path.join(OUT, f))
    json.dump(meta, open(os.path.join(OUT, 'scene.json'), 'w'), indent=1)
    print(json.dumps({p['name']: [p['bbox'], p['kb']] for p in meta['planes']}))

    # ——— contrôles : découpe (une teinte par masse), et le mouvement de page.js simulé
    tint = {'tl': (1, .2, .2), 'tr': (.2, 1, .2), 'r': (.2, .4, 1), 'bl': (1, .9, .1)}
    v = img * .45
    for k, c in tint.items():
        v = v + alphas[k][..., None] * np.array(c, F32) * .55
    Image.fromarray(to8(sm(v))).save(os.path.join(QA, 'pieces.jpg'), quality=88)
    Image.fromarray(to8(sm(A))).save(os.path.join(QA, 'alpha-front.jpg'))

    def warp(x, s, o):
        Mx = np.float32([[s, 0, o[0] * (1 - s)], [0, s, o[1] * (1 - s)]])
        return cv2.warpAffine(x, Mx, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    O = (ORIGIN[0] * W, ORIGIN[1] * H)
    rest_vis = (1 - A) * am * hole                                     # reconstitué visible au repos
    frames, worst = [], 0
    for i, t in enumerate(np.linspace(0, 1, 11)):
        e = 1 - t                                                      # part restante de l'agrandissement
        s_mid, s_back = 1 + (MID0 - 1) * e, 1 + (BACK0 - 1) * e
        amt = warp(am, s_mid, O)
        comp = amt[..., None] * warp(mid, s_mid, O) + (1 - amt[..., None]) * warp(back, s_back, O)
        T = np.ones((H, W), F32)
        for k, (ax, ay), s0 in reversed(PIECES):                       # du dessous au dessus
            s = 1 + (s0 - 1) * e
            o = (ax * W, ay * H)
            al = warp(alphas[k], s, o)
            comp = al[..., None] * warp(C, s, o) + (1 - al[..., None]) * comp
            T = T * (1 - al)
        vis = T * amt * warp(hole.astype(F32), s_mid, O)
        worst = max(worst, int((vis > warp(rest_vis, s_mid, O) + .15).sum()))
        if i in (0, 3, 6, 10):
            frames.append(sm(comp))
    Image.fromarray(to8(np.concatenate(frames, 1))).save(os.path.join(QA, 'sim.jpg'), quality=88)
    print(f'pixels reconstitués visibles en plus de la photo (max sur la course) : {worst}')


if __name__ == '__main__':
    main()
