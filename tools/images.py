"""Export des images de la page d'accueil.

Usage : python tools/images.py [nom ...]
Lit tools/images.json puis tools/images.d/*.json : une entrée par image, avec la source
(« src » : fichier local, retouché ou non ; sinon « url » du site actuel), un recadrage
éventuel (x0, y0, x1, y1 en px de la source), les largeurs voulues et la qualité.
Écrit dans public/assets/img/ : <nom>-<largeur>.avif et .webp (jamais au-delà de la
taille de la source), et met à jour public/assets/img/manifest.json avec la taille, le
ratio, la couleur dominante et un aperçu flou de 24 px pour l'attente du chargement.
Les photos ne sont pas retouchées : seul un léger affinage compense la réduction.
Les calques RGBA (parallaxe) gardent leur transparence.
"""
import base64, fcntl, glob, io, json, os, sys
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(ROOT, 'tools', 'images.json')))
for _f in sorted(glob.glob(os.path.join(ROOT, 'tools', 'images.d', '*.json'))):
    CFG['images'].update(json.load(open(_f)).get('images', {}))
OUT = os.path.join(ROOT, 'public', 'assets', 'img')
MAN = os.path.join(OUT, 'manifest.json')


CACHE = os.path.join(ROOT, 'tools', '.cache')


def source(entry):
    """Chemin local de la source : 'src' (relatif à la racine) ou, à défaut, l'URL du site
    actuel téléchargée une fois dans tools/.cache/."""
    if entry.get('src'):
        p = entry['src'] if os.path.isabs(entry['src']) else os.path.join(ROOT, entry['src'])
        if os.path.exists(p):
            return p
    url = entry['url']
    p = os.path.join(CACHE, url.split('/wp-content/uploads/')[-1].replace('/', '_'))
    if not os.path.exists(p):
        import urllib.request
        os.makedirs(CACHE, exist_ok=True)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as r, open(p, 'wb') as f:
            f.write(r.read())
    return p


def load(entry):
    im = Image.open(source(entry))
    alpha = entry.get('alpha', im.mode in ('RGBA', 'LA') or 'transparency' in im.info)
    im = im.convert('RGBA' if alpha else 'RGB')
    if entry.get('crop'):
        im = im.crop(tuple(entry['crop']))
    return im, alpha


def lqip(im):
    s = im.convert('RGB').resize((24, max(1, round(24 * im.height / im.width))), Image.LANCZOS)
    b = io.BytesIO()
    s.save(b, 'WEBP', quality=45)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


def dominant(im):
    s = im.convert('RGB').resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    return '#%02x%02x%02x' % s


def export(name, entry, man):
    im, alpha = load(entry)
    q = entry.get('quality', {})
    qa, qw = q.get('avif', 62), q.get('webp', 82)
    widths = sorted({min(w, im.width) for w in entry.get('widths', [640, 1024, 1440, 1920])})
    files = {}
    for w in widths:
        h = round(im.height * w / im.width)
        r = im.resize((w, h), Image.LANCZOS) if w != im.width else im.copy()
        if w < im.width:
            r = r.filter(ImageFilter.UnsharpMask(radius=0.6, percent=40, threshold=2))
        base = os.path.join(OUT, f'{name}-{w}')
        # au-delà de 1600 px, pixels plus petits : un peu plus de compression sans perte visible
        big = w > 1600
        r.save(base + '.avif', 'AVIF', quality=qa - (6 if big else 0), speed=4)
        r.save(base + '.webp', 'WEBP', quality=qw - (4 if big else 0), method=6)
        files[w] = {'avif': os.path.getsize(base + '.avif'), 'webp': os.path.getsize(base + '.webp')}
    man[name] = {
        'w': im.width, 'h': im.height, 'ratio': round(im.width / im.height, 4), 'alpha': alpha,
        'widths': widths, 'color': dominant(im), 'lqip': None if alpha else lqip(im),
        'bytes': files, 'alt': entry.get('alt', ''), 'label': entry.get('label', ''),
    }
    biggest = files[widths[-1]]
    print(f"{name}: {im.width}x{im.height} -> {widths} | {widths[-1]}px avif {biggest['avif'] // 1024} Ko")


def main():
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or list(CFG['images'])
    done = {}
    for n in names:
        export(n, CFG['images'][n], done)
    # plusieurs exports peuvent tourner en parallèle : lecture-écriture du manifeste sous verrou
    with open(MAN + '.lock', 'w') as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        man = json.load(open(MAN)) if os.path.exists(MAN) else {}
        man.update(done)
        for n in list(man):
            if n not in CFG['images']:
                del man[n]
        tmp = MAN + '.tmp'
        json.dump(man, open(tmp, 'w'), ensure_ascii=False, indent=1)
        os.replace(tmp, MAN)


if __name__ == '__main__':
    main()
