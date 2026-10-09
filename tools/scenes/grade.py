"""Étalonnage commun à toutes les scènes du site.

Règles (brief §5.4) :
- une seule balance des blancs : lumineuse, légèrement froide dans les ombres ;
- hautes lumières chaudes, couleur mélèze ;
- blancs de neige propres, jamais bleutés ni gris ;
- pas de filtre, pas de grain.
Tous les plans d'une scène sont étalonnés ensemble, AVANT le découpage.
"""
import numpy as np


def srgb_to_lin(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def grade(rgb8, wb_strength=1.0, exposure_target=0.47, warm=1.0, cool=1.0):
    """rgb8 : uint8 HxWx3. Retourne uint8 HxWx3."""
    x = rgb8.astype(np.float32) / 255.0
    lin = srgb_to_lin(x)
    lum = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    mx, mn = x.max(-1), x.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-4)

    # 1. Balance des blancs sur les blancs (neige, nuages) : pixels lumineux et peu saturés.
    sel = (x.mean(-1) > 0.72) & (sat < 0.16)
    if sel.sum() > 500:
        ref = lin[sel].mean(0)
    else:  # pas de neige : gris moyen des 5 % les plus clairs, correction bridée
        thr = np.quantile(lum, 0.95)
        ref = lin[lum >= thr].mean(0)
        wb_strength *= 0.35
    gains = ref.mean() / np.maximum(ref, 1e-4)
    gains = 1 + (gains - 1) * wb_strength
    gains = np.clip(gains, 0.85, 1.18)
    lin = lin * gains

    # 2. Exposition : image lumineuse (médiane visée en sRGB), sans écraser les hautes lumières.
    med = np.median(lin_to_srgb(lin).mean(-1))
    ev = np.clip(np.log2(max(exposure_target, 1e-3) / max(med, 1e-3)) * 0.8, -0.25, 0.45)
    lin = lin * (2 ** ev)
    # compression douce des hautes lumières (épaule)
    lum = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    knee = 0.78
    over = np.maximum(lum - knee, 0)
    comp = np.where(lum > knee, knee + over / (1 + over / (1.0 - knee + 1e-4) * 0.9), lum)
    lin = lin * (comp / np.maximum(lum, 1e-5))[..., None]

    s = lin_to_srgb(lin)
    L = s.mean(-1)
    mx, mn = s.max(-1), s.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-4)

    # 3. Ombres légèrement froides (pas sur la neige à l'ombre : on la garde neutre).
    shadow = (1 - smoothstep(0.08, 0.42, L)) * cool
    s[..., 0] -= 0.012 * shadow
    s[..., 2] += 0.018 * shadow

    # 4. Hautes lumières chaudes, couleur mélèze — sur les matières (saturées),
    #    jamais sur la neige (peu saturée) pour garder des blancs propres.
    hi = smoothstep(0.45, 0.85, L) * smoothstep(0.12, 0.35, sat) * warm
    s[..., 0] += 0.030 * hi
    s[..., 1] += 0.012 * hi
    s[..., 2] -= 0.020 * hi

    # 5. Neige : on retire toute dominante (bleue ou grise) sur les blancs lumineux.
    snow = smoothstep(0.70, 0.88, L) * (1 - smoothstep(0.06, 0.20, sat))
    m = s.mean(-1, keepdims=True)
    s = s + (m - s) * (snow[..., None] * 0.65)

    # 6. Légère courbe en S (contraste doux, pas de noirs bouchés).
    s = np.clip(s, 0, 1)
    s = s + 0.06 * (s - 0.5) * (1 - np.abs(2 * s - 1))
    return (np.clip(s, 0, 1) * 255 + 0.5).astype(np.uint8)
