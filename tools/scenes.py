"""Plans de parallaxe des vues 3D → fichiers web de la vitrine.

Usage : python tools/scenes.py <dossier des calques> [ID ...]
Pour chaque scène découpée (manifest.json produit par le découpage en plans) : étalonnage commun
des vues 3D (tools/grade.py, render), puis export dans public/assets/scenes/<ID>/ :
back (opaque), mid et front (transparence, recadrés à leur boîte) en AVIF + WebP, la version
mobile (fond fusionné + avant), et scene.json, lu au build par tools/build.mjs.
Les boîtes du manifeste sont au format [x, y, largeur, hauteur] en px de la source.
"""
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import grade

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets', 'scenes')


def first(d, *names):
    for n in names:
        if n and os.path.exists(os.path.join(d, n)):
            return os.path.join(d, n)
    return None


def save(im, base, alpha, q_avif, q_webp):
    im.save(base + '.avif', 'AVIF', quality=q_avif, speed=4)
    im.save(base + '.webp', 'WEBP', quality=q_webp, method=6, **({'alpha_quality': 90} if alpha else {}))
    return os.path.getsize(base + '.avif') // 1024, os.path.getsize(base + '.webp') // 1024


def scene(src_dir, sid):
    man = json.load(open(os.path.join(src_dir, 'manifest.json')))
    W, H = man.get('work_size') or man['source_size']
    out = os.path.join(OUT, sid)
    os.makedirs(out, exist_ok=True)
    rel = f'/assets/scenes/{sid}/'
    planes, report = [], []
    for p in man['planes']:
        name = p['name']
        if name == 'back':
            f = first(src_dir, 'back.png', p.get('file'), 'back.webp')
            im = grade.render(Image.open(f).convert('RGB'))
            bbox = [0, 0, W, H]
            kb = save(im, os.path.join(out, 'back'), False, 58, 80)
        else:
            f = first(src_dir, p.get('crop'), f'{name}.crop.png', p.get('crop_webp'))
            im = grade.render(Image.open(f).convert('RGBA'))
            x, y, w, h = p['bbox']
            if (w, h) != im.size:
                raise SystemExit(f'{sid}/{name} : boîte {p["bbox"]} et image {im.size} incohérentes')
            bbox = [x, y, x + w, y + h]
            kb = save(im, os.path.join(out, name), True, 60 if name == 'mid' else 62, 82)
        e = {'name': name, 'avif': rel + name + '.avif', 'webp': rel + name + '.webp', 'bbox': bbox, 'speed': p['speed']}
        planes.append(e)
        report.append(f'{name} {kb[0]}/{kb[1]} Ko')
    mob = []
    mb = first(src_dir, 'mobile_back.png', 'mobile_back.webp')
    if mb:
        im = grade.render(Image.open(mb).convert('RGB'))
        kb = save(im, os.path.join(out, 'mobile_back'), False, 56, 78)
        mob.append({'name': 'back+mid', 'avif': rel + 'mobile_back.avif', 'webp': rel + 'mobile_back.webp', 'bbox': [0, 0, W, H], 'speed': .3})
        report.append(f'mobile_back {kb[0]}/{kb[1]} Ko')
        fr = next((e for e in planes if e['name'] == 'front'), None)
        if fr:
            mob.append(dict(fr, speed=1.0))
    data = {'w': W, 'h': H, 'planes': planes, 'mobile': {'planes': mob} if mob else None}
    json.dump(data, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
    print(f'{sid}: ' + ', '.join(report))


if __name__ == '__main__':
    src = sys.argv[1]
    ids = sys.argv[2:] or sorted(d for d in os.listdir(src) if os.path.exists(os.path.join(src, d, 'manifest.json')))
    for i in ids:
        scene(os.path.join(src, i), i)
