"""Relevé au trait de N036 (spec §3 S5 « Calque de dessin » et « Mouvement : du trait au chalet »).

Écrit src/_trait.svg : environ 30 traits (un <path> par trait, polyligne ouverte ou courbe douce,
coordonnées absolues entières) posés sur la photo N036 recadrée [0, 0, 2998, 1820] — exactement
l'image « sur-mesure » exportée par tools/images.d/exteriors.json (N036 n'est pas retouchée ; l'étalonnage
de tools/grade.py ne déplace aucun pixel). viewBox 0 0 2998 1820, preserveAspectRatio xMidYMid slice :
le dessin se recadre comme la photo en object-fit: cover; object-position: 50% 50%.
Aucun attribut de trait : le CSS donne stroke 1 px, vector-effect non-scaling-stroke.

Usage : python tools/retouch/trait.py          (écrit le SVG)
        python tools/retouch/trait.py --qa     (écrit aussi les contrôles dans le scratchpad :
                                                 superposition rouge 2 px sur la photo, dessin seul
                                                 sur ivoire #F6F0E8, recadrages 100 %)

Méthode : rien n'est tracé à main levée. Chaque trait est d'abord placé grossièrement (à ±10 px,
lu sur des recadrages quadrillés), puis recalé sur la photo :
  - trait droit : chaque segment est recalé seul — ses deux extrémités glissent le long de sa normale
    (±R px, pas de 0,25 px) pour maximiser la moyenne, sur toute sa longueur, du gradient
    perpendiculaire (sens imposé si besoin : +1/-1), ou pour 'dark' l'obscurité d'un filet fin
    (rive gauche : le larmier sombre sous la neige). Une vraie arête droite est cohérente sur toute sa
    longueur, la texture du bois s'annule. Les sommets d'une polyligne sont les intersections des
    segments recalés ; les bouts sont projetés, ou posés sur un autre trait (end_on / start_on :
    montants du vitrage sur la main courante ou la sablière, chéneau sur l'about de rive).
  - courbe (jambes de force légèrement cintrées, tronc) : 60 points recalés chacun sur l'arête la
    plus forte le long de sa normale (médiane glissante contre les sauts), puis une cubique de Bézier
    aux moindres carrés, bouts fixés.
  - branche d'épicéa : axe ligneux = creux sombre moyenné le long de la tangente sur ±14 px (la tige
    est continue, les aiguilles obliques s'annulent), deux passes, puis 1 à 4 cubiques raccordées en
    tangence (écart ≤ 3 px aux points recalés) ; la branche part exactement du bord du tronc.
Contrôle (v2/tools/trait/check.py dans le scratchpad) : sur chaque segment droit, 9 stations ; à
chacune, l'arête nette la plus proche est à ±1,5 px en général, ±3 px partout où l'arête est
visible (les écarts restants sont des croisements : poteau devant, neige posée sur la main courante).

Ordre de tracé (DrawSVG, stagger 0,04 s) : ligne de sol, poteaux, rives et faîtage, égouts, pannes,
pignon vitré (sablière, contours des quatre vitrages), jambes de force, balcon (main courante, lisse
basse, poteau d'angle, plancher), madriers, cheminée, épicéa (tronc puis 4 branches maîtresses).

Sources : LOMBARD_SOURCES (défaut : le scratchpad de la session de conception).
"""
import os, sys
import numpy as np
import cv2

SCRATCH = '/tmp/claude-0/-home-user-LOMBARD/95416158-29ce-5296-9584-d21972a9bfca/scratchpad'
SRC = os.environ.get('LOMBARD_SOURCES', SCRATCH)
N036 = os.path.join(SRC, 'v2', 'new', '2025_12_Exterieur-Chalet-Montgenevre-Construction-Lombard-Vasina-5.jpg')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'src', '_trait.svg')
QA = os.path.join(SCRATCH, 'v2', 'assets_qa', 'trait')
CROP = (0, 0, 2998, 1820)

# ---------------------------------------------------------------------------------------------
# Traits, dans l'ordre de tracé. kind : 'line' (polyligne de segments droits recalés),
# 'edge' (courbe recalée sur une arête), 'ridge' (axe sombre d'une branche), 'fixed' (tel quel).
# R : rayon de recherche (px). sign : +1/-1 impose le sens du gradient (0 = libre).
STROKES = [
    # ligne de sol : dessus du soubassement en pierre (dessous des poutres qui y reposent)
    dict(name='sol-gauche', pts=[(0, 1664), (690, 1694)], R=6),
    dict(name='sol-pignon', pts=[(1100, 1680), (1450, 1703)], R=8),
    # poteaux maîtres : poteau de l'aile (arête droite), poteau d'angle du pignon (arête gauche)
    dict(name='poteau-aile', pts=[(407, 520), (402, 975)], R=8),
    dict(name='poteau-angle', pts=[(971, 1045), (968, 1240)], R=8, end_on='main-courante'),
    # rives : about des planches de rive, rive gauche (vue en fuite), faîtage, rive droite, égout droit
    dict(name='rives', pts=[(1056, 662), (1060, 512), (1652, 417), (2128, 1180), (2291, 1259)], R=[0, 6, 6, 6], sign=[0, 'dark', 0, 0]),
    dict(name='rives-sous-face', pts=[(1057, 663), (1641, 523), (2124, 1277)], R=6),
    # égouts : chéneau de l'aile gauche, chéneau de l'égout gauche du pignon
    dict(name='egout-aile', pts=[(0, 106), (779, 499)], R=6),
    dict(name='egout-pignon', pts=[(441, 731), (1053, 545)], R=8, sign=-1, end_on='rives'),
    # pannes sous la rive droite (arête basse)
    dict(name='panne-1', pts=[(1590, 860), (1794, 811)], R=6),
    dict(name='panne-2', pts=[(1726, 1040), (1943, 993)], R=6),
    dict(name='panne-3', pts=[(1845, 1224), (2057, 1190)], R=6),
    # pignon vitré : sablière, puis chaque vitrage par son contour (montant, rampant ou jambe de force, montant)
    dict(name='sabliere', pts=[(1043, 983), (1803, 1256)], R=6),
    dict(name='vitrage-angle', parts=[
        ('line', [(1041, 990), (1042, 862)]),
        ('edge', [(1042, 862), (1080, 795), (1120, 740), (1158, 693)]),
        ('line', [(1171, 693), (1173, 1250)])], R=6, Rparts=[6, 6, 6], end_on='main-courante', start_on='sabliere'),
    dict(name='vitrage-ab', pts=[(1237, 1270), (1237, 722), (1380, 903), (1384, 1300)], R=6, end_on='main-courante', start_on='main-courante'),
    dict(name='vitrage-bc', pts=[(1431, 1300), (1430, 783), (1469, 717), (1557, 839), (1568, 1330)], R=[0, 6, 6, 6], end_on='main-courante', start_on='main-courante'),
    dict(name='vitrage-cd', pts=[(1600, 1340), (1599, 888), (1688, 1021), (1690, 1380)], R=6, end_on='main-courante', start_on='main-courante'),
    # jambes de force cintrées : arête haute (l'arête basse borde le vitrage)
    dict(name='jambe-angle', kind='edge', pts=[(984, 900), (1040, 800), (1100, 730), (1135, 690)], R=10),
    dict(name='jambe-b', kind='edge', pts=[(1408, 777), (1470, 680), (1538, 589)], R=8),
    # balcon : main courante (balcon gauche, retour, façade, puis poteau d'extrémité), lisse basse, poteau d'angle
    dict(name='main-courante', pts=[(1, 1181), (854, 1292), (1133, 1243), (2233, 1561), (2239, 1745)], R=6),
    dict(name='lisse-basse', pts=[(1146, 1487), (2221, 1690)], R=5, sign=1),
    dict(name='poteau-balcon', pts=[(1123, 1245), (1118, 1620)], R=6),
    dict(name='plancher', pts=[(1140, 1545), (2225, 1725)], R=8),
    # madriers de l'aile gauche
    dict(name='madrier-1', pts=[(0, 640), (331, 681)], R=6),
    dict(name='madrier-2', pts=[(1, 940), (330, 967)], R=6),
    # cheminée : chapeau, puis fût évasé (rebord + arête droite)
    dict(name='chapeau', pts=[(538, 243), (629, 209), (706, 252)], R=5),
    dict(name='cheminee', pts=[(570, 277), (635, 250), (693, 282), (727, 368)], R=5),
    # épicéa : tronc (bord gauche de l'écorce), branches maîtresses (axe sombre sur le ciel, depuis le tronc)
    dict(name='tronc', kind='edge', pts=[(2893, 250), (2958, 1450)], R=12),
    dict(name='branche-1', kind='ridge', pts=[(2890, 395), (2800, 411), (2700, 434), (2580, 466), (2450, 477), (2300, 487), (2200, 495), (2100, 501), (2000, 510), (1850, 520)], R=10),
    dict(name='branche-2', kind='ridge', pts=[(2910, 595), (2600, 610), (2300, 628), (2100, 615), (1960, 590)], R=14),
    dict(name='branche-3', kind='ridge', pts=[(2925, 830), (2800, 850), (2600, 875), (2400, 880), (2200, 850), (2050, 790), (1900, 720), (1720, 640)], R=14),
    dict(name='branche-4', kind='ridge', pts=[(2915, 680), (2850, 700), (2700, 750), (2550, 790), (2400, 815), (2300, 800), (2210, 745)], R=14),
]

# ---------------------------------------------------------------------------------------------
_I = {}


def load():
    if not _I:
        im = cv2.imread(N036)
        x0, y0, x1, y1 = CROP
        im = im[y0:y1, x0:x1].copy()
        g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
        gs = cv2.GaussianBlur(g, (0, 0), 1.2)
        _I.update(img=im, gray=g,
                  gx=cv2.Sobel(gs, cv2.CV_32F, 1, 0, ksize=3) / 8,
                  gy=cv2.Sobel(gs, cv2.CV_32F, 0, 1, ksize=3) / 8,
                  dark=cv2.GaussianBlur(g, (0, 0), 5),
                  thin=cv2.GaussianBlur(g, (0, 0), 1.5))
    return _I


def samp(a, xs, ys):
    return cv2.remap(a, np.float32(xs).reshape(1, -1), np.float32(ys).reshape(1, -1),
                     cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).ravel()


def seg_score(p0, p1, sign=0):
    """sign = +1/-1 : arête de sens imposé ; 0 : arête des deux sens ; 'dark' : filet sombre fin."""
    I = load()
    d = p1 - p0; L = np.hypot(*d); n = np.array([-d[1], d[0]]) / L
    t = np.linspace(0.04, 0.96, max(8, int(L)))
    xs = p0[0] + d[0] * t; ys = p0[1] + d[1] * t
    if sign == 'dark':
        return -samp(I['thin'], xs, ys).mean()
    m = (samp(I['gx'], xs, ys) * n[0] + samp(I['gy'], xs, ys) * n[1]).mean()
    return m * sign if sign else abs(m)


def refine_segment(p0, p1, R, sign=0):
    p0 = np.asarray(p0, float); p1 = np.asarray(p1, float)
    d = p1 - p0; n = np.array([-d[1], d[0]]) / np.hypot(*d)
    best = (-1e9, 0.0, 0.0)
    for a in np.arange(-R, R + 1e-9, 1.0):
        for b in np.arange(-R, R + 1e-9, 1.0):
            s = seg_score(p0 + a * n, p1 + b * n, sign)
            if s > best[0]:
                best = (s, a, b)
    _, a0, b0 = best
    for a in np.arange(a0 - 1, a0 + 1.01, 0.25):
        for b in np.arange(b0 - 1, b0 + 1.01, 0.25):
            s = seg_score(p0 + a * n, p1 + b * n, sign)
            if s > best[0]:
                best = (s, a, b)
    s, a, b = best
    return p0 + a * n, p1 + b * n, s


def intersect(a0, a1, b0, b1):
    da = a1 - a0; db = b1 - b0
    t = np.linalg.solve(np.array([da, -db]).T, b0 - a0)
    return a0 + t[0] * da


def project(p, a0, a1):
    d = a1 - a0
    return a0 + np.dot(np.asarray(p, float) - a0, d) / np.dot(d, d) * d


def resample(pts, n):
    pts = np.asarray(pts, float)
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(pts, axis=0).T))])
    t = np.linspace(0, s[-1], n)
    return np.stack([np.interp(t, s, pts[:, 0]), np.interp(t, s, pts[:, 1])], 1)


def bez(c, t):
    p0, p1, p2, p3 = c; t = np.asarray(t)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


def fit_cubic(Q):
    p0, p3 = Q[0], Q[-1]
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(Q, axis=0).T))]); t = s / s[-1]
    tt = np.linspace(0, 1, 600)
    for _ in range(6):
        A = np.stack([3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2], 1)
        rhs = Q - np.outer((1 - t) ** 3, p0) - np.outer(t ** 3, p3)
        (p1, p2), *_ = np.linalg.lstsq(A, rhs, rcond=None)
        C = bez((p0, p1, p2, p3), tt)
        t = tt[((Q[:, None] - C[None]) ** 2).sum(-1).argmin(1)]; t[0], t[-1] = 0, 1
    C = bez((p0, p1, p2, p3), tt)
    res = np.sqrt(((Q[:, None] - C[None]) ** 2).sum(-1).min(1))
    return (p0, p1, p2, p3), res


def snap_curve(pts, R, mode, sign=0, n=60):
    """Échantillons recalés le long de la normale, lissés.
    edge  : arête la plus forte (gradient signé, sens majoritaire).
    ridge : axe ligneux d'une branche = creux d'intensité le plus sombre, moyenné le long de la
            tangente sur ±14 px (la tige est continue, les aiguilles sont obliques et s'annulent)."""
    I = load()
    P = resample(pts, n)
    d = np.gradient(P, axis=0); d /= np.hypot(d[:, 0], d[:, 1])[:, None]
    N = np.stack([-d[:, 1], d[:, 0]], 1)
    offs = np.arange(-R, R + 0.01, 0.5)
    V = []
    for p, nv, tv in zip(P, N, d):
        if mode == 'edge':
            xs = p[0] + offs * nv[0]; ys = p[1] + offs * nv[1]
            V.append(samp(I['gx'], xs, ys) * nv[0] + samp(I['gy'], xs, ys) * nv[1])
        else:
            acc = 0
            for u in np.linspace(-14, 14, 8):
                q = p + u * tv
                acc = acc - samp(I['thin'], q[0] + offs * nv[0], q[1] + offs * nv[1])
            V.append(acc / 8)
    V = np.array(V)
    if mode == 'edge':
        if not sign:
            sign = 1 if V.max(1).mean() >= (-V).max(1).mean() else -1
        V = V * sign
    off = offs[V.argmax(1)]
    # un échantillon isolé qui saute sur une autre arête (touffe d'aiguilles, nœud) est ramené
    # à ses voisins ; puis moyenne glissante courte pour les branches
    k = 3 if mode == 'edge' else 5
    med = np.array([np.median(off[max(0, i - k):i + k + 1]) for i in range(len(off))])
    off = np.where(np.abs(off - med) > 3, med, off)
    if mode == 'ridge':
        off = np.convolve(np.pad(off, 2, mode='edge'), np.ones(5) / 5, mode='valid')
    return P + off[:, None] * N


def catmull(K):
    """Spline de Catmull-Rom par les nœuds K -> liste de cubiques (p0, c1, c2, p3)."""
    K = np.asarray(K, float)
    E = np.vstack([2 * K[0] - K[1], K, 2 * K[-1] - K[-2]])
    out = []
    for i in range(1, len(E) - 2):
        p0, p1, p2, p3 = E[i - 1], E[i], E[i + 1], E[i + 2]
        out.append((p1, p1 + (p2 - p0) / 6, p2 - (p3 - p1) / 6, p2))
    return out


def fit_cubic_fixed(Q, p0, p3):
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(Q, axis=0).T))]); t = s / s[-1]
    tt = np.linspace(0, 1, 400)
    for _ in range(6):
        A = np.stack([3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2], 1)
        rhs = Q - np.outer((1 - t) ** 3, p0) - np.outer(t ** 3, p3)
        (p1, p2), *_ = np.linalg.lstsq(A, rhs, rcond=None)
        C = bez((p0, p1, p2, p3), tt)
        t = tt[((Q[:, None] - C[None]) ** 2).sum(-1).argmin(1)]; t[0], t[-1] = 0, 1
    return [p0, p1, p2, p3]


def fit_spline(Q, tol=5.0):
    """Le moins de cubiques possible (moindres carrés, raccords tangents) pour un écart <= tol px."""
    for ns in range(1, 5):
        idx = np.round(np.linspace(0, len(Q) - 1, ns + 1)).astype(int)
        segs = [fit_cubic_fixed(Q[idx[k]:idx[k + 1] + 1], Q[idx[k]], Q[idx[k + 1]]) for k in range(ns)]
        for k in range(ns - 1):   # raccord G1 : tangente commune au nœud
            a, b = segs[k], segs[k + 1]
            u = (a[3] - a[2]) / np.hypot(*(a[3] - a[2])) + (b[1] - b[0]) / np.hypot(*(b[1] - b[0]))
            u /= np.hypot(*u)
            a[2] = a[3] - u * np.hypot(*(a[3] - a[2])); b[1] = b[0] + u * np.hypot(*(b[1] - b[0]))
        C = np.vstack([bez(sg, np.linspace(0, 1, 150)) for sg in segs])
        res = np.sqrt(((Q[:, None] - C[None]) ** 2).sum(-1).min(1))
        if res.max() <= tol:
            break
    return [tuple(sg) for sg in segs], float(res.max())


def build_lines(pts, R, sign=0):
    pts = [np.asarray(p, float) for p in pts]
    Rs = R if isinstance(R, (list, tuple)) else [R] * (len(pts) - 1)
    Ss = list(sign) if isinstance(sign, (list, tuple)) else [sign] * (len(pts) - 1)
    segs = [refine_segment(pts[i], pts[i + 1], Rs[i], Ss[i])[:2] if Rs[i] else (pts[i], pts[i + 1])
            for i in range(len(pts) - 1)]
    out = [project(pts[0], *segs[0])]
    out += [intersect(*segs[i], *segs[i + 1]) for i in range(len(segs) - 1)]
    out.append(project(pts[-1], *segs[-1]))
    return out, segs


def build(st):
    """-> liste d'éléments ('L', [points]) / ('C', cubique), plus l'écart max des courbes."""
    kind = st.get('kind', 'line')
    if 'parts' in st:
        # ligne - courbe - ligne : les lignes sont recalées, la courbe est recalée puis ses bouts
        # sont projetés sur les lignes recalées (raccords exacts)
        (_, a), (ck, b), (_, c) = st['parts']
        Rp = st.get('Rparts', [st['R']] * 3)
        la, sa = build_lines(a, Rp[0])
        lc, sc = build_lines(c, Rp[2])
        Q = snap_curve(b, st['R'], ck)
        Q[0] = project(Q[0], *sa[-1]); Q[-1] = project(Q[-1], *sc[0])
        cub, res = fit_cubic(Q)
        la[-1] = Q[0]; lc[0] = Q[-1]
        return [('L', la), ('C', cub), ('L', lc)], float(res.max())
    if kind in ('edge', 'ridge'):
        Q = snap_curve(st['pts'], st['R'], kind, st.get('sign', 0))
        if kind == 'ridge':
            segs, _ = fit_spline(Q, st.get('tol', 3.0))
            Q = snap_curve(np.vstack([bez(sg, np.linspace(0, 1, 30)) for sg in segs]), 6, kind)
        if kind == 'edge':
            c, res = fit_cubic(Q)
            return [('C', c)], float(res.max())
        segs, res = fit_spline(Q, st.get('tol', 3.0))
        return [('C', s) for s in segs], res
    out, _ = build_lines(st['pts'], st['R'], st.get('sign', 0))
    return [('L', out)], 0.0


def last_segment(elems):
    k, g = elems[-1]
    return (g[-2], g[-1]) if k == 'L' else (g[2], g[3])


def clip_end(elems, target, first=False):
    """Prolonge / raccourcit le dernier (ou le premier) segment droit jusqu'à la polyligne cible."""
    k, g = elems[0] if first else elems[-1]
    a, b = (g[1], g[0]) if first else (g[-2], g[-1])
    best = None
    T = target[0][1]
    for i in range(len(T) - 1):
        p = intersect(a, b, T[i], T[i + 1])
        u = np.dot(p - T[i], T[i + 1] - T[i]) / np.dot(T[i + 1] - T[i], T[i + 1] - T[i])
        if -0.01 <= u <= 1.01:
            if best is None or np.hypot(*(p - b)) < np.hypot(*(best - b)):
                best = p
    g[0 if first else -1] = best


def on_trunk(elems, trunk):
    """Pose le premier point d'une branche sur le bord du tronc (même y), en déplaçant d'autant
    son premier point de contrôle : la branche part du tronc, sans jour ni dépassement."""
    k, g = elems[0]
    C = bez(trunk, np.linspace(0, 1, 2000))
    x = np.interp(g[0][1], C[:, 1], C[:, 0])
    dx = x - g[0][0]
    g = list(g); g[0] = g[0] + np.array([dx, 0]); g[1] = g[1] + np.array([dx * 0.5, 0])
    elems[0] = (k, tuple(g))


def fmt(v):
    return f'{int(round(v[0]))} {int(round(v[1]))}'


def to_d(elems):
    d = ''
    for k, g in elems:
        if k == 'L':
            d += ('M' + fmt(g[0]) if not d else 'L' + fmt(g[0])) if not d or True else ''
            d = d if d.startswith('M') else 'M' + d[1:]
            d += ''.join('L' + fmt(p) for p in g[1:])
        else:
            if not d:
                d = 'M' + fmt(g[0])
            d += 'C' + ' '.join(fmt(p) for p in g[1:])
    # 'L' répété sur un même point (raccord) : supprimé
    import re
    toks = re.findall(r'[MLC][^MLC]*', d)
    out = []
    for t in toks:
        if out and t[0] == 'L' and out[-1][0] in 'ML' and out[-1][1:].split()[-2:] == t[1:].split():
            continue
        if out and t[0] == 'L' and out[-1][0] == 'C' and out[-1][1:].split()[-2:] == t[1:].split():
            continue
        out.append(t)
    return ''.join(out)


def main():
    built = {}
    for st in STROKES:
        built[st['name']] = build(st)
    for st in STROKES:
        if 'end_on' in st:
            clip_end(built[st['name']][0], built[st['end_on']][0])
        if 'start_on' in st:
            clip_end(built[st['name']][0], built[st['start_on']][0], first=True)
        if st.get('kind') == 'ridge':
            on_trunk(built[st['name']][0], built['tronc'][0][0][1])
    # inséré tel quel dans la page par {{include _trait.svg}} (SVG en ligne : pas de xmlns)
    lines = ['<svg class="trait" viewBox="0 0 2998 1820" '
             'preserveAspectRatio="xMidYMid slice" aria-hidden="true" fill="none">']
    for st in STROKES:
        lines.append(f'<path d="{to_d(built[st["name"]][0])}"/>')
    lines.append('</svg>')
    svg = '\n'.join(lines) + '\n'
    with open(OUT, 'w') as f:
        f.write(svg)
    print(f'{OUT}: {len(STROKES)} traits, {len(svg.encode())} octets')
    for st in STROKES:
        elems, res = built[st['name']]
        print(f'  {st["name"]:16s} {to_d(elems)}' + (f'   (écart max {res:.1f} px)' if res else ''))
    if '--qa' in sys.argv:
        qa(svg)


def qa(svg):
    """Contrôles : le SVG écrit (entiers) relu et tracé en rouge 2 px sur la photo, et seul sur ivoire."""
    import re
    from PIL import Image, ImageDraw
    os.makedirs(QA, exist_ok=True)
    I = load()
    photo = Image.fromarray(cv2.cvtColor(I['img'], cv2.COLOR_BGR2RGB))
    paths = []
    for d in re.findall(r' d="([^"]+)"', svg):
        pts = []; cur = None
        for cmd, args in re.findall(r'([MLC])([^MLC]*)', d):
            v = np.array(args.split(), float).reshape(-1, 2)
            if cmd in 'ML':
                pts += list(v); cur = v[-1]
            else:
                for c in [v[i:i + 3] for i in range(0, len(v), 3)]:
                    pts += list(bez((cur, c[0], c[1], c[2]), np.linspace(0, 1, 40)[1:])); cur = c[2]
        paths.append(np.array(pts))
    ov = photo.copy(); dr = ImageDraw.Draw(ov)
    for p in paths:
        dr.line([tuple(map(float, q)) for q in p], fill=(255, 0, 0), width=2)
    ov.resize((1499, 910), Image.LANCZOS).save(os.path.join(QA, 'qa_overlay_half.jpg'), quality=90)
    for nm, box in dict(toit=(1000, 330, 2000, 1000), rive=(1600, 600, 2400, 1320),
                        pignon=(950, 600, 1850, 1350), balcon=(800, 1150, 2300, 1820),
                        aile=(0, 0, 1100, 1000), epicea=(1650, 300, 2998, 1000),
                        tronc=(2650, 150, 2998, 1500)).items():
        ov.crop(box).save(os.path.join(QA, f'qa_100_{nm}.png'))
    W, H = photo.size
    iv = Image.new('RGB', (W, H), (0xF6, 0xF0, 0xE8)); dr = ImageDraw.Draw(iv)
    for p in paths:
        dr.line([tuple(map(float, q)) for q in p], fill=(0x1B, 0x1F, 0x2A), width=3)
    iv.resize((1499, 910), Image.LANCZOS).save(os.path.join(QA, 'qa_ivoire_half.png'))
    w45 = int(H * 4 / 5); x0 = (W - w45) // 2   # mobile 4:5, object-position 50% 50%
    iv.crop((x0, 0, x0 + w45, H)).resize((716, 896), Image.LANCZOS).save(os.path.join(QA, 'qa_ivoire_45.png'))
    ph = photo.copy(); ph.putalpha(255)
    mix = Image.blend(photo, iv, 0.75)
    mix.crop((x0, 0, x0 + w45, H)).resize((716, 896), Image.LANCZOS).save(os.path.join(QA, 'qa_mix_45.png'))


if __name__ == '__main__':
    main()
