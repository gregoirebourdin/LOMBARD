"""Étape 3 : export des scènes pour le site.

Usage : python export.py <work_dir> <site_dir> <scene> [<scene> ...]

Pour chaque scène (brief §5.5 « Exporter ») :
- ordinateur : le fond en AVIF (+ WebP) opaque, les autres plans en AVIF/WebP avec transparence,
  trois largeurs : 1280, 1920 et 2560 px ;
- mobile : 2 à 3 plans (regroupés), recadrage portrait centré sur le point d'intérêt ;
- l'image aplatie (prefers-reduced-motion, partage social) et un aperçu flou de 24 px ;
- manifeste JSON lu par le générateur du site, avec le poids réel de chaque scène
  (budget : 450 Ko sur ordinateur à 1920 px, 250 Ko sur mobile).
"""
import base64, io, json, os, sys, glob, numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from motion import plane_transform
CFG = json.load(open(os.path.join(HERE, 'scenes.json')))['scenes']
WIDTHS = [1280, 1920, 2560]
Q = {'webp': 80, 'avif': 52, 'avif_alpha': 50}


def clean_rgba(im):
    """RVB neutralisé sous la transparence totale : meilleure compression, aucun halo."""
    a = np.asarray(im).copy()
    if a.shape[2] == 4:
        z = a[..., 3] == 0
        a[z, :3] = 0
    return Image.fromarray(a, im.mode)


def save_pair(im, base, alpha, q=None):
    out = {}
    Qs = {**Q, **(q or {})}
    im = clean_rgba(im) if alpha else im.convert('RGB')
    # Écrans haute densité (2 560 px) : pixels deux fois plus petits, compression plus forte
    # sans perte visible, pour tenir le budget de 450 Ko par scène.
    hi = im.width > 2000
    im.save(base + '.webp', 'WEBP', quality=Qs['webp'] - (12 if hi else 0), method=6, exact=False)
    im.save(base + '.avif', 'AVIF', quality=(Qs['avif_alpha'] if alpha else Qs['avif']) - (12 if hi else 0), speed=5)
    for ext in ('avif', 'webp'):
        out[ext] = os.path.getsize(base + '.' + ext)
    return out


def resize(im, w):
    h = round(im.height * w / im.width)
    return im.resize((w, h), Image.LANCZOS)


def lqip(im):
    s = im.convert('RGB').resize((24, max(1, round(24 * im.height / im.width))), Image.LANCZOS)
    b = io.BytesIO(); s.save(b, 'WEBP', quality=40)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


def bbox_of(im, pad=6):
    """Zone utile d'un plan (alpha > 0), avec une petite marge ; tout le cadre si le plan est opaque."""
    a = np.asarray(im)[..., 3] if im.mode == 'RGBA' else None
    if a is None or a.min() >= 250:
        return (0, 0, im.width, im.height)
    ys, xs = np.where(a > 2)
    if len(xs) == 0:
        return (0, 0, 2, 2)
    x0, y0 = max(int(xs.min()) - pad, 0), max(int(ys.min()) - pad, 0)
    x1, y1 = min(int(xs.max()) + 1 + pad, im.width), min(int(ys.max()) + 1 + pad, im.height)
    return (x0, y0, x1, y1)


def save_cropped(full, box, w, base, alpha, q):
    """Exporte la zone utile à la résolution qu'aurait le plan entier à la largeur w."""
    k = w / full.width
    crop = full.crop(box)
    cw, ch = max(2, round(crop.width * k)), max(2, round(crop.height * k))
    return save_pair(crop.resize((cw, ch), Image.LANCZOS), base, alpha, q)


def composite(planes):
    acc = Image.new('RGBA', planes[0].size, (0, 0, 0, 0))
    for p in planes:
        acc.alpha_composite(p)
    return acc


def export_scene(work, site, name):
    c = CFG[name]
    src = os.path.join(work, name)
    files = sorted(glob.glob(os.path.join(src, 'planes', '*.png')), key=lambda f: int(os.path.basename(f).split('-')[0]))
    planes = [Image.open(f).convert('RGBA') for f in files]
    W, H = planes[0].size
    out = os.path.join(site, 'assets', 'scenes', name)
    os.makedirs(out, exist_ok=True)
    for f in glob.glob(os.path.join(out, '*')):
        os.remove(f)
    rel = '/assets/scenes/' + name + '/'
    kind = c.get('motion', 'flow')
    widths = [w for w in c.get('widths', WIDTHS) if w <= W] or [W]
    man = {'w': W, 'h': H, 'motion': kind, 'focus': c.get('focus', [0.5, 0.5]), 'origin': c.get('origin', [0.5, 0.5]),
           'overscan': c.get('overscan', 0.1 if kind != 'pan' else 0.0), 'desktop': [], 'mobile': [], 'flat': {}, 'bytes': {}}

    # --- ordinateur : un fichier par plan et par largeur
    tot = {w: {'avif': 0, 'webp': 0} for w in widths}
    for k, (pl, pc) in enumerate(zip(planes, c['planes'])):
        (s0, y0, _), (s1, y1, _) = plane_transform(c, k, 0), plane_transform(c, k, 1)
        entry = {'name': pc['name'], 'speed': pc['speed'], 's': [round(s0, 4), round(s1, 4)], 'y': [round(y0, 1), round(y1, 1)],
                 'x': pc.get('x', [0, 0]), 'travel': pc.get('travel', 1), 'mouse': round(12 * pc['speed'] / 0.8, 1),
                 'alpha': k > 0 or kind == 'curtain', 'src': {}}
        bb = bbox_of(pl) if kind != 'curtain' else (0, 0, W, H)
        entry['bbox'] = [bb[0] / W, bb[1] / H, (bb[2] - bb[0]) / W, (bb[3] - bb[1]) / H]
        for w in widths:
            base = os.path.join(out, f'd{k}-{w}')
            sz = save_cropped(pl, bb, w, base, k > 0 or kind == 'curtain', c.get('quality'))
            entry['src'][w] = rel + f'd{k}-{w}'
            for e in sz: tot[w][e] += sz[e]
        man['desktop'].append(entry)
    man['bytes']['desktop'] = tot

    # --- mobile : plans regroupés, recadrage portrait
    groups = c.get('mobile', [[i] for i in range(len(planes))])
    mc = c.get('mobile_crop')
    if kind in ('pan', 'curtain'):
        box = (0, 0, W, H)
    else:
        aspect = (mc or {}).get('aspect', 0.8)
        cx = (mc or {}).get('cx', man['focus'][0])
        cw = min(W, round(H * aspect)); ch = min(H, round(cw / aspect))
        x0 = int(min(max(cx * W - cw / 2, 0), W - cw)); y0 = int(min(max((mc or {}).get('cy', 0.5) * H - ch / 2, 0), H - ch))
        box = (x0, y0, x0 + cw, y0 + ch)
    mwidths = c.get('mobile_widths', [1920, 2560] if kind == 'pan' else [720, 1080])
    mtot = {w: {'avif': 0, 'webp': 0} for w in mwidths}
    for gi, g in enumerate(groups):
        img = composite([planes[i] for i in g]).crop(box)
        front = c['planes'][g[-1]]
        (s0, y0, _), (s1, y1, _) = plane_transform(c, g[-1], 0), plane_transform(c, g[-1], 1)
        entry = {'name': '+'.join(c['planes'][i]['name'] for i in g), 'speed': front['speed'],
                 's': [round(s0, 4), round(s1, 4)], 'y': [round(y0, 1), round(y1, 1)], 'x': front.get('x', [0, 0]),
                 'travel': front.get('travel', 1), 'mouse': 0, 'alpha': gi > 0, 'src': {}}
        bb = bbox_of(img) if kind != 'curtain' else (0, 0, img.width, img.height)
        entry['bbox'] = [bb[0] / img.width, bb[1] / img.height, (bb[2] - bb[0]) / img.width, (bb[3] - bb[1]) / img.height]
        for w in mwidths:
            ww = min(w, img.width)
            base = os.path.join(out, f'm{gi}-{w}')
            sz = save_cropped(img, bb, ww, base, gi > 0 or kind == 'curtain', c.get('quality'))
            entry['src'][w] = rel + f'm{gi}-{w}'
            for e in sz: mtot[w][e] += sz[e]
        man['mobile'].append(entry)
    man['mobile_box'] = [box[0] / W, box[1] / H, (box[2] - box[0]) / W, (box[3] - box[1]) / H]
    man['mobile_aspect'] = (box[2] - box[0]) / (box[3] - box[1])
    man['bytes']['mobile'] = mtot

    if kind == 'curtain':
        man['aspect'] = W / H
        return man
    # --- image aplatie : sans mouvement + partage social ; aperçu flou
    flat = Image.open(os.path.join(src, 'graded.png')).convert('RGB')
    if flat.size != (W, H):
        flat = flat.resize((W, H), Image.LANCZOS)
    for w in widths:
        save_pair(resize(flat, w), os.path.join(out, f'flat-{w}'), False)
        man['flat'][w] = rel + f'flat-{w}'
    og = flat.copy(); og.thumbnail((2400, 2400))
    tw, th = 1200, 630; s = max(tw / og.width, th / og.height)
    og = og.resize((round(og.width * s), round(og.height * s)), Image.LANCZOS)
    fx, fy = man['focus']
    x0 = int(min(max(fx * og.width - tw / 2, 0), og.width - tw)); y0 = int(min(max(fy * og.height - th / 2, 0), og.height - th))
    og.crop((x0, y0, x0 + tw, y0 + th)).save(os.path.join(out, 'og.jpg'), 'JPEG', quality=84, optimize=True, progressive=True)
    man['og'] = rel + 'og.jpg'
    man['lqip'] = lqip(flat)
    man['aspect'] = W / H
    return man


def main():
    work, site = sys.argv[1], sys.argv[2]
    mpath = os.path.join(site, 'assets', 'scenes', 'manifest.json')
    man = json.load(open(mpath)) if os.path.exists(mpath) else {}
    for name in sys.argv[3:]:
        m = export_scene(work, site, name)
        man[name] = m
        d1920 = m['bytes']['desktop'].get(1920) or list(m['bytes']['desktop'].values())[-1]
        mob = list(m['bytes']['mobile'].values())[-1]
        print(f"{name}: ordinateur 1920 avif {d1920['avif']//1024} Ko / webp {d1920['webp']//1024} Ko ; "
              f"mobile avif {mob['avif']//1024} Ko / webp {mob['webp']//1024} Ko")
    os.makedirs(os.path.dirname(mpath), exist_ok=True)
    json.dump(man, open(mpath, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
