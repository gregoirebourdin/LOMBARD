"""Export des images fixes du site (hors scènes) : même étalonnage que les scènes,
AVIF + WebP en plusieurs largeurs, manifeste lu par le générateur.

Usage : python export_images.py <dossier_originaux> <site_dir> [id ...]
Les originaux sont les fichiers d'origine du site actuel (voir images.json, champ « file »)."""
import json, os, sys
import numpy as np
from PIL import Image, ImageOps
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..', 'scenes'))
from grade import grade

CFG = json.load(open(os.path.join(HERE, 'images.json')))['images']
WIDTHS = [640, 1280, 1920, 2560]


def main():
    src_dir, site = sys.argv[1], sys.argv[2]
    only = set(sys.argv[3:])
    out = os.path.join(site, 'assets', 'img')
    os.makedirs(out, exist_ok=True)
    mpath = os.path.join(out, 'manifest.json')
    man = json.load(open(mpath)) if os.path.exists(mpath) else {}
    total = 0
    for k, v in CFG.items():
        if only and k not in only:
            continue
        p = os.path.join(src_dir, v['file'])
        if not os.path.exists(p):
            p = os.path.join(src_dir, '..', 'extra', v['file'])
        im = ImageOps.exif_transpose(Image.open(p)).convert('RGB')
        if 'crop' in v:
            x0, y0, x1, y1 = v['crop']
            im = im.crop((round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height)))
        g = v.get('grade', {})
        if g is not False and v.get('kind') == 'photo':
            im = Image.fromarray(grade(np.asarray(im), **(g if isinstance(g, dict) else {})))
        top = min(im.width, WIDTHS[-1])
        ws = sorted(set([w for w in WIDTHS if w < top * 0.9] + [top]))
        base = f'/assets/img/{k}'
        for w in ws:
            r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) if w != im.width else im
            r.save(os.path.join(out, f'{k}-{w}.webp'), 'WEBP', quality=82, method=6)
            r.save(os.path.join(out, f'{k}-{w}.avif'), 'AVIF', quality=56, speed=5)
            total += os.path.getsize(os.path.join(out, f'{k}-{w}.avif'))
        man[k] = {'base': base, 'widths': ws, 'w': im.width, 'h': im.height, 'alt': v['alt'], 'kind': v.get('kind', 'photo'),
                  'credit': v.get('credit'), 'focus': v.get('focus', '50% 50%'), 'source': v['src']}
        print(k, im.size, ws, flush=True)
    json.dump(man, open(mpath, 'w'), ensure_ascii=False, indent=1)
    print('avif total', total // 1024, 'Ko')


if __name__ == '__main__':
    main()
