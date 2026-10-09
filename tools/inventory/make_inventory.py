"""Inventaire des photos du site actuel -> docs/inventaire-photos.csv
Entrée : crawl-uniq.json (images uniques, dédoublonnées par empreinte perceptuelle, avec dimensions
et mesures de netteté / exposition). Classement semi-automatique (nom de fichier, page, mesures)
complété par la revue visuelle des planches contact (listes ci-dessous)."""
import csv, json, os, re
HERE = os.path.dirname(__file__)
d = json.load(open(os.path.join(HERE, 'crawl-uniq.json')))
OUT = os.path.join(HERE, '..', '..', 'docs', 'inventaire-photos.csv')

AI_STAMPED = {'I145', 'I147', 'I148', 'I149', 'I150'}            # mention « Image générée par IA » visible
PEOPLE = {'I027', 'I030', 'I112', 'I115', 'I121', 'I155', 'I200', 'I286', 'I287', 'I288', 'I292', 'I293', 'I301',
          'I303', 'I324', 'I386', 'I387', 'I388', 'I397', 'I398', 'I399', 'I400', 'I403', 'I404', 'I385', 'I114', 'I291'}
SCENES = {'I104': 'ouverture', 'I013': 'panorama', 'I017': 'serre-orchis', 'I309': 'sabot-venus', 'I283': 'la-rouya',
          'I010': 'rocher-blanc', 'I199': 'etoile-glaciers', 'I105': 'réalisation Puy-Saint-Vincent', 'I016': 'réalisation Montgenèvre',
          'I069': 'rideau (branche)', 'I050': 'rideau (poteau)'}
PLACES = [('montgenevre', 'Montgenèvre'), ('puy-saint-vincent', 'Puy-Saint-Vincent'), ('rouya', 'Puy-Saint-Vincent (Les Alberts)'),
          ('1400', 'Puy-Saint-Vincent'), ('vallouise', 'Vallouise'), ('pelvoux', 'Pelvoux'), ('briancon', 'Briançon'), ('refuge-82', 'Briançon'),
          ('rocher-blanc', 'Villard-Laté (Serre Chevalier)'), ('etoile', 'Le Monêtier-les-Bains'), ('serre-d', 'Le Monêtier-les-Bains (Serre Barbin)'),
          ('serredorchis', 'Le Monêtier-les-Bains (Serre Barbin)'), ('dji_00', 'Serre Chevalier (Serre Barbin)'), ('20250410', 'Le Monêtier-les-Bains (Serre Barbin)'),
          ('sabot', 'La Salle-les-Alpes'), ('20250228', 'La Salle-les-Alpes'), ('la-salle', 'La Salle-les-Alpes'), ('lasalle', 'La Salle-les-Alpes'),
          ('chantemerle', 'Chantemerle'), ('st-chaffrey', 'Saint-Chaffrey'), ('serre-barbin', 'Serre Barbin'), ('monetier', 'Le Monêtier-les-Bains'),
          ('lauzet', 'Le Lauzet'), ('notredame', 'Notre-Dame-des-Neiges'), ('bureau', 'Saint-Martin-de-Queyrières'), ('photo-01-166', 'Saint-Martin-de-Queyrières')]
PAGE_PLACE = {'constructeur-de-chalets-montgenevre': 'Montgenèvre', 'constructeur-chalets-puy-saint-vincent': 'Puy-Saint-Vincent',
              'constructeur-chalets-bois-vallouise-pelvoux': 'Vallouise-Pelvoux', 'constructeur-chalets-maisons-bois-briancon': 'Briançon',
              'vefa-la-rouya': 'Puy-Saint-Vincent', 'vefa-sabot-de-venus': 'La Salle-les-Alpes', 'vefa-serre-d-orchis': 'Le Monêtier-les-Bains',
              'vefa-letoile-des-glaciers': 'Le Monêtier-les-Bains', 'vefa-chalet-de-rocher-blanc': 'Villard-Laté'}

def nature(x):
    f = x['file'].lower()
    if x['id'] in AI_STAMPED: return 'image générée par IA (mention visible) — à écarter'
    if re.search(r'pictogram|picto|icon|regles|qualite|confiance|proximite|placeholder|^.*_(11|14|5)\.png$|3-e17327|r_thumbs_(13|6|8|9)', f): return 'pictogramme'
    if re.search(r'dessin|encre|plan-1|conception-salon|montagne-|chalets-05', f): return 'dessin / graphisme'
    if re.search(r'sabot-de-venus-chalet|serre-dorchis-chalet|la-rouya-vue-3d|etoile-des-glaciers-chalet-223|vente-chalet-serre-d-orchis|chalet-a-vendre-serre|chalet-rocher-blanc-serre-chevalier|sans-titre-650|chalets_lombard_serre-dorchis-a-ext|_(9|10|12)\.jpg$|^2025_08_chalets_lombard_chambre2?\.jpg$|pc6', f):
        return 'vue 3D — provenance à confirmer (aspect d’image générée)'
    if re.search(r'3d', f): return 'vue 3D'
    if re.search(r'recrutons|magazine|avis', f): return 'document / photo de groupe'
    return 'photo réelle'

def subject(x):
    f = x['file'].lower()
    for k, v in [('terrain', 'terrain à vendre'), ('vue-', 'vue depuis le terrain'), ('dji', 'vue de drone'), ('2025022', 'site / terrain'), ('2025041', 'site / terrain'),
                 ('sejour', 'séjour'), ('salon', 'séjour'), ('cuisine', 'cuisine'), ('chambre', 'chambre'), ('dortoi', 'dortoir'), ('mezzanine', 'chambre en mezzanine'),
                 ('salle-de-bain', 'salle de bain'), ('bain', 'salle de bain'), ('charpente', 'charpente'), ('escalier', 'escalier'), ('cinema', 'salle de cinéma'),
                 ('nuit', 'extérieur de nuit'), ('neige', 'extérieur sous la neige'), ('hiver', 'extérieur en hiver'), ('terrasse', 'terrasse'), ('exter', 'extérieur'),
                 ('exsterieure', 'extérieur'), ('extrieure', 'extérieur'), ('interieur', 'intérieur'), ('avant', 'rénovation — avant'), ('apres', 'rénovation — après'),
                 ('renov', 'rénovation'), ('extension', 'extension'), ('agrandissement', 'agrandissement'), ('reconstruction', 'reconstruction'), ('demolit', 'démolition'),
                 ('atelier', 'atelier'), ('bureau', 'bureaux'), ('photo-01-166', 'bureaux'), ('ouvrier', 'atelier'), ('savoirfaire', 'chantier'), ('alpesphotographies', 'chantier / réalisation'),
                 ('maurice', 'portrait'), ('marielle', 'portrait'), ('mathieu', 'portrait'), ('equipe', 'équipe'), ('design', 'conception 3D'), ('meleze', 'intérieur mélèze'), ('detail', 'détail')]:
        if k in f: return v
    return 'à préciser'

def place(x):
    f = x['file'].lower()
    for k, v in PLACES:
        if k in f: return v
    for p in x['pages']:
        if p in PAGE_PLACE: return PAGE_PLACE[p]
    return 'non précisé'

def depth(x, nat, subj):
    if nat.startswith('pictogramme') or nat.startswith('dessin') or nat.startswith('document'): return '0'
    if 'portrait' in subj or 'détail' in subj: return '1-2'
    if any(k in subj for k in ('drone', 'vue', 'terrain', 'site')): return '3-4'
    if subj.startswith('extérieur') or subj in ('terrasse',): return '3-5' if x['w'] >= 1500 else '3-4'
    if any(k in subj for k in ('séjour', 'cuisine', 'chambre', 'intérieur', 'escalier', 'dortoir', 'charpente')): return '2-3'
    return '2'

def quality(x):
    q = []
    w = x['w']
    q.append('très haute définition' if w >= 3000 else 'HD 1920' if w >= 1900 else 'moyenne (%d px)' % w if w >= 1000 else 'faible (%d px)' % w)
    if x.get('sharp', 0) < 60 and w >= 600: q.append('peu nette')
    if x.get('clip_hi', 0) > 6: q.append('hautes lumières brûlées')
    if x.get('mean', 128) < 70: q.append('sombre')
    if x.get('kb', 0) and w >= 1000 and x['kb'] * 1024 / (x['w'] * x['h']) < 0.08: q.append('forte compression')
    return ', '.join(q)

def usage(x, nat, subj):
    if x['id'] in SCENES: return 'scène de parallaxe : ' + SCENES[x['id']]
    if 'IA' in nat: return 'à écarter (règle : jamais d’image générée par IA pour un bien)'
    if 'provenance' in nat: return 'en attente : confirmer rendu 3D ou image IA'
    if x['id'] in PEOPLE: return 'en attente : validation écrite (personne reconnaissable)'
    if nat == 'vue 3D': return 'fiche du chalet, avec « Vue 3D, image non contractuelle »'
    if nat.startswith('pictogramme'): return 'à écarter (pictogrammes)'
    if nat.startswith('dessin'): return 'trait / histoire'
    if x['w'] < 800: return 'vignette seulement'
    if 'rénovation' in subj or subj in ('extension', 'agrandissement', 'reconstruction', 'démolition'): return 'page rénovation (avant/après)'
    return 'galerie réalisations / pages vallées'

rows = []
for x in d:
    nat = nature(x); subj = subject(x)
    rows.append({
        'id': x['id'], 'fichier_origine': x['url'], 'pages': ' '.join(x['pages']), 'sujet': subj, 'lieu': place(x),
        'largeur_px': x['w'], 'hauteur_px': x['h'], 'nature': nat, 'plans_possibles': depth(x, nat, subj), 'qualite': quality(x),
        'personnes': 'oui — validation écrite' if x['id'] in PEOPLE else '', 'credit': 'Alpesphotographies.com' if 'alpesphotographies' in x['file'].lower() else '',
        'usage': usage(x, nat, subj), 'doublons': len(x.get('dups', [])),
    })
with open(OUT, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
from collections import Counter
print(len(rows), 'images')
print(Counter(r['nature'] for r in rows).most_common())
print(Counter(r['usage'].split(':')[0] for r in rows).most_common())
