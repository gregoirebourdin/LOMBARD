"""Modèle de mouvement partagé (identique au moteur JavaScript du site, src/js/main.js).
dolly : scène épinglée ; plan = translateY(y) scale(s) autour de origin, interpolés de p=0 à p=1.
flow  : scène dans le flux ; y(p) = -(p - 0.5) * amplitude * (speed - ancre) / 0.8 * 2.
pan   : panorama ; la scène fait 1,6 fois la largeur du cadre, T = 0,6 cadre ;
        x(p) = -T * (0.5 + travel * (p - 0.5)) : plans alignés à mi-course.
Les valeurs sont en px pour un cadre de 1920 px de large."""


def lerp(a, b, t):
    return a + (b - a) * t


def plane_transform(scene, k, p):
    """Retourne (échelle, y, x) en px (cadre de 1920)."""
    pc = scene['planes'][k]
    m = scene.get('motion', 'flow')
    if m == 'dolly':
        return lerp(*pc.get('scale', [1, 1]), p), lerp(*pc.get('y', [0, 0]), p), 0.0
    if m == 'pan':
        T = 0.6 * 1920
        return 1.0, 0.0, -T * (0.5 + pc.get('travel', 1) * (p - 0.5))
    anchor = scene.get('anchor_speed', 0.45)
    y = -(p - 0.5) * scene['amplitude'] * (pc['speed'] - anchor) / 0.8 * 2
    s = 1 + max(pc['speed'] - anchor, 0) * 0.12 * p
    return s, y, 0.0


def max_relative(scene, k):
    """Déplacement relatif max (px, cadre de 1920 ; pour pan : rapporté à la largeur de la source)
    entre le plan k et les plans de devant, sur tout le mouvement, souris comprise."""
    n = len(scene['planes']); worst = 0
    for p in [i / 20 for i in range(21)]:
        sk, yk, xk = plane_transform(scene, k, p)
        for j in range(k + 1, n):
            sj, yj, xj = plane_transform(scene, j, p)
            d = abs(yj - yk) + abs(xj - xk) + abs(sj - sk) * 0.6 * 1920
            if scene.get('motion') == 'pan':
                d = abs(xj - xk) / 1.6  # la source couvre 1,6 cadre
            worst = max(worst, d)
    return worst + scene.get('mouse', 12) * 2
