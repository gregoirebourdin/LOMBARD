"""Carte des vallées tracée d'un seul trait : rivières OpenStreetMap (© contributeurs OSM, ODbL),
projetées et simplifiées, villages placés à leurs coordonnées réelles.
Usage : python build_map.py  -> src/build/map.json"""
import json, math, os
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', '..', 'src', 'build', 'map.json')
BBOX = dict(lat0=44.645, lat1=45.045, lon0=6.405, lon1=6.965)
W = 1000
k = math.cos(math.radians((BBOX['lat0'] + BBOX['lat1']) / 2))
H = W * (BBOX['lat1'] - BBOX['lat0']) / ((BBOX['lon1'] - BBOX['lon0']) * k)

def proj(lat, lon):
    return ((lon - BBOX['lon0']) * k / ((BBOX['lon1'] - BBOX['lon0']) * k) * W,
            (BBOX['lat1'] - lat) / (BBOX['lat1'] - BBOX['lat0']) * H)

def rdp(pts, eps):
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1; n = math.hypot(dx, dy) or 1e-9
    dmax, idx = 0, 0
    for i, (x, y) in enumerate(pts[1:-1], 1):
        dist = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / n
        if dist > dmax: dmax, idx = dist, i
    if dmax > eps:
        return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]

def chain(ways):
    segs = [w[:] for w in ways]; out = []
    while segs:
        cur = segs.pop(0); changed = True
        while changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == cur[-1]: cur += s[1:]
                elif s[-1] == cur[0]: cur = s + cur[1:]
                elif s[-1] == cur[-1]: cur += s[::-1][1:]
                elif s[0] == cur[0]: cur = s[::-1] + cur[1:]
                else: continue
                segs.pop(i); changed = True; break
        out.append(cur)
    return out

data = json.load(open(os.path.join(HERE, 'osm-rivers.json')))['elements']
names = {'La Durance': 'Durance', 'La Guisane': 'Guisane', 'La Clarée': 'Clarée', 'Gyronde': 'Gyronde', "L'Onde": 'Onde', 'Le Guil': 'Guil', 'La Cerveyrette': 'Cerveyrette', 'Torrent de la Cerveyrette': 'Cerveyrette'}
byname = {}
for e in data:
    n = names.get(e['tags'].get('name'))
    if not n or 'geometry' not in e: continue
    byname.setdefault(n, []).append([(round(p['lat'], 6), round(p['lon'], 6)) for p in e['geometry']])
rivers = []
for n, ways in byname.items():
    for line in chain(ways):
        pts = [proj(la, lo) for la, lo in line]
        pts = [p for p in pts if -20 <= p[0] <= W + 20 and -20 <= p[1] <= H + 20]
        if len(pts) < 2: continue
        s = rdp(pts, 0.9)
        d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in s)
        rivers.append({'name': n, 'd': d, 'len': sum(math.dist(a, b) for a, b in zip(s, s[1:]))})
rivers.sort(key=lambda r: -r['len'])

P = lambda lat, lon: [round(v, 1) for v in proj(lat, lon)]
# label: [dx, dy, ancre] ; kind: town | sale | sold | hq | village
places = [
    ('Briançon', 44.8984, 6.64363, 'town', [12, 4, 'start']),
    ('Le Monêtier-les-Bains', 44.97609, 6.50988, 'village', [-10, -10, 'end']),
    ('Le Serre Barbin', 44.95934, 6.54663, 'sale', [-12, 18, 'end']),
    ('La Salle-les-Alpes', 44.94538, 6.57198, 'sale', [-12, 22, 'end']),
    ('Villard-Laté', 44.9375, 6.598, 'sold', [10, 5, 'start']),
    ('Montgenèvre', 44.93117, 6.7218, 'village', [10, 4, 'start']),
    ('Névache', 45.01896, 6.60409, 'village', [10, 4, 'start']),
    ('Pelvoux', 44.86888, 6.48725, 'village', [-10, -8, 'end']),
    ('Vallouise', 44.84632, 6.48794, 'village', [-10, 4, 'end']),
    ('Puy-Saint-Vincent', 44.82812, 6.49496, 'sale', [-10, 20, 'end']),
    ('Saint-Martin-de-Queyrières', 44.84091, 6.58528, 'hq', [12, 4, 'start']),
    ("L'Argentière-la-Bessée", 44.78969, 6.55887, 'village', [12, 4, 'start']),
    ('Guillestre', 44.65978, 6.64939, 'village', [12, 4, 'start']),
    ('Saint-Véran', 44.70042, 6.86816, 'village', [-10, 18, 'end']),
]
regions = [
    ('Serre Chevalier', 44.995, 6.585, 'middle'),
    ('Clarée', 45.035, 6.66, 'middle'),
    ('Pays des Écrins', 44.80, 6.43, 'start'),
    ('Queyras', 44.735, 6.905, 'middle'),
]
out = {'w': W, 'h': round(H, 1), 'rivers': rivers,
       'places': [{'name': n, 'xy': P(la, lo), 'kind': kd, 'label': lb} for n, la, lo, kd, lb in places],
       'regions': [{'name': n, 'xy': P(la, lo), 'anchor': a} for n, la, lo, a in regions],
       'attribution': '© contributeurs OpenStreetMap (ODbL)'}
json.dump(out, open(OUT, 'w'), ensure_ascii=False)
print('map', W, round(H), len(rivers), 'rivers', sum(len(r['d']) for r in rivers), 'chars')
