"""Favicon et icône Apple : le pignon du logo (toits extérieur et intérieur) en violet sur ivoire.
Usage : python tools/favicon.py → public/favicon.svg, public/apple-touch-icon.png (180 px)."""
import os, re
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = open(os.path.join(ROOT, 'brand', 'logo', 'logo.svg')).read()
OUTER = re.search(r'id="clv-roof-outer" d="([^"]+)"', LOGO).group(1)
INNER = re.search(r'id="clv-roof-inner" d="([^"]+)"', LOGO).group(1)
IVOIRE, VIOLET = (246, 240, 232), (81, 5, 67)


def points(d):
    """Chemin fait de M/l/z seulement (le toit du logo est polygonal)."""
    nums = [float(n) for n in re.findall(r'-?\d*\.?\d+', d)]
    x, y = nums[0], nums[1]
    pts = [(x, y)]
    for i in range(2, len(nums) - 1, 2):
        x, y = x + nums[i], y + nums[i + 1]
        pts.append((x, y))
    return pts


# cadrage : le toit (x 347–940, y 0–204) centré dans un carré, un peu au-dessus du centre optique
X0, X1, Y0, Y1 = 347.1, 940.1, 0, 204.4
S = 64
k = (S * .8) / (X1 - X0)
tx = (S - (X1 - X0) * k) / 2 - X0 * k
ty = (S - (Y1 - Y0) * k) / 2 - Y0 * k + 2
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}"><rect width="{S}" height="{S}" rx="12" fill="#F6F0E8"/>'
       f'<g fill="#510543" transform="translate({tx:.2f} {ty:.2f}) scale({k:.5f})"><path d="{OUTER}"/><path d="{INNER}"/></g></svg>')
open(os.path.join(ROOT, 'public', 'favicon.svg'), 'w').write(svg)

N, SS = 180, 4
im = Image.new('RGB', (N * SS, N * SS), IVOIRE)
dr = ImageDraw.Draw(im)
kk = k * N / S * SS
for d in (OUTER, INNER):
    dr.polygon([((x * k + tx) * N / S * SS, (y * k + ty) * N / S * SS) for x, y in points(d)], fill=VIOLET)
im.resize((N, N), Image.LANCZOS).save(os.path.join(ROOT, 'public', 'apple-touch-icon.png'), optimize=True)
print('favicon.svg', len(svg), 'o ; apple-touch-icon.png')
