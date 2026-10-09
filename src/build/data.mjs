// Données du site. Uniquement des faits fournis par le brief ou publiés par
// l'entreprise sur son site actuel (ces derniers sont marqués `aConfirmer`).
// Aucun chiffre inventé : un champ inconnu est omis, jamais deviné.

export const SITE = 'https://www.chalets-lombard.fr';

export const company = {
  name: 'Chalets Lombard Vasina',
  alt: 'Lombard & Vasina',
  founded: 1979,
  founders: ['Maurice Lombard', 'Jean-Claude Vasina'],
  street: '51 rue de la Rochette',
  postal: '05120',
  city: 'Saint-Martin-de-Queyrières',
  region: 'Hautes-Alpes',
  country: 'FR',
  geo: { lat: 44.85742, lon: 6.58485 }, // fiche Google Maps de l'entreprise
  phone: '+33 4 92 21 29 19',
  phoneHref: '+33492212919',
  email: 'contact@chalets-lombard.fr',
  maps: 'https://maps.app.goo.gl/HPduUbGeUaRDXSsP9',
  socials: [
    { name: 'Instagram', url: 'https://www.instagram.com/lombardvasina/' },
    { name: 'Facebook', url: 'https://www.facebook.com/Chalets.Lombard.vasina/' },
    { name: 'LinkedIn', url: 'https://fr.linkedin.com/company/lombard-et-vasina' },
    { name: 'YouTube', url: 'https://www.youtube.com/c/Lombard-vasinaFr' },
  ],
  // Zone d'intervention : le Grand Briançonnais, et seulement lui.
  areaServed: [
    'Briançon', 'Le Monêtier-les-Bains', 'La Salle-les-Alpes', 'Saint-Chaffrey', 'Chantemerle', 'Villard-Laté',
    'Névache', 'Val-des-Prés', 'Montgenèvre', 'Cervières', 'Vallouise-Pelvoux', 'Puy-Saint-Vincent',
    "L'Argentière-la-Bessée", 'Saint-Martin-de-Queyrières', 'Les Vigneaux', 'Guillestre', 'Arvieux',
    'Château-Ville-Vieille', 'Aiguilles', 'Abriès-Ristolas', 'Molines-en-Queyras', 'Saint-Véran',
  ],
};

// Routes : FR à la racine, EN sous /en/ (adresses actuelles conservées pour le référencement).
export const routes = {
  home: { fr: '/', en: '/en/' },
  sale: { fr: '/vente-sur-plan/', en: '/en/vente-sur-plan/' },
  build: { fr: '/savoir-faire/', en: '/en/savoir-faire/' },
  reno: { fr: '/renovation-extension-chalet/', en: '/en/renovation-extension-chalet/' },
  work: { fr: '/realisations/', en: '/en/realisations/' },
  tours: { fr: '/visites-360/', en: '/en/visites-360/' },
  house: { fr: '/lombard-vasina/', en: '/en/lombard-vasina/' },
  press: { fr: '/on-parle-de-nous/', en: '/en/on-parle-de-nous/' },
  jobs: { fr: '/recrutement/', en: '/en/recrutement/' },
  contact: { fr: '/contact/', en: '/en/contact/' },
  legal: { fr: '/mentions-legales/', en: '/en/mentions-legales/' },
  cookies: { fr: '/politique-de-cookies/', en: '/en/politique-de-cookies/' },
  'v-serre-chevalier': { fr: '/constructeur-chalet-bois-serre-chevalier/', en: '/en/constructeur-chalet-bois-serre-chevalier/' },
  'v-briancon': { fr: '/constructeur-chalets-maisons-bois-briancon/', en: '/en/constructeur-chalets-maisons-bois-briancon/' },
  'v-vallouise': { fr: '/constructeur-chalets-bois-vallouise-pelvoux/', en: '/en/constructeur-chalets-bois-vallouise-pelvoux/' },
  'v-puy-saint-vincent': { fr: '/constructeur-chalets-puy-saint-vincent/', en: '/en/constructeur-chalets-puy-saint-vincent/' },
  'v-montgenevre': { fr: '/constructeur-de-chalets-montgenevre/', en: '/en/constructeur-de-chalets-montgenevre/' },
};

// Redirections 301 (audit SEO) : anciennes adresses -> nouvelles.
export const redirects = [
  ['/www-chalets-lombard-fr-renovation-chalet/', '/renovation-extension-chalet/'],
  ['/en/www-chalets-lombard-fr-renovation-chalet/', '/en/renovation-extension-chalet/'],
  ['/projets/', '/realisations/'], // page « MODELE EXEMPLE » supprimée
  ['/en/projets/', '/en/realisations/'],
  ['/qui-sommes-nous/', '/lombard-vasina/'],
  ['/en/qui-sommes-nous/', '/en/lombard-vasina/'],
  ['/constructeur-bois/', '/savoir-faire/'],
  ['/en/constructeur-bois/', '/en/savoir-faire/'],
  ['/chalets-de-toutes-les-tailles/', '/realisations/'],
  ['/en/chalets-de-toutes-les-tailles/', '/en/realisations/'],
  ['/home/', '/'],
];

/* ---------------------------------------------------------------------------
   Les chalets vendus sur plan (VEFA). Noms tirés de la flore et des lieux.
   État et prix : à vérifier avec l'entreprise avant mise en ligne.
   --------------------------------------------------------------------------- */
export const chalets = [
  {
    id: 'serre-orchis',
    route: { fr: '/vefa-serre-d-orchis/', en: '/en/vefa-serre-d-orchis/' },
    name: 'Le Serre d’Orchis',
    status: 'disponible',
    village: 'Le Monêtier-les-Bains',
    locality: { fr: 'Hameau du Serre Barbin', en: 'Serre Barbin hamlet' },
    valley: 'Serre Chevalier',
    scene: 'serre-orchis',
    sentence: {
      fr: "Deux chalets au calme d'un hameau préservé, au-dessus du Monêtier-les-Bains.",
      en: 'Two chalets in the quiet of an unspoilt hamlet above Le Monêtier-les-Bains.',
    },
    units: [
      { label: 'Chalet A', surface: 229, terrain: 847, rooms: { fr: '5 suites', en: '5 en-suites' } },
      { label: 'Chalet B', surface: 221, terrain: 700, rooms: { fr: '4 suites', en: '4 en-suites' } },
    ],
    facts: {},
    gallery: ['so-terrain-1', 'so-terrain-2'],
    caption: { fr: 'Vue de drone sur la vallée, hameau du Serre Barbin', en: 'Drone view over the valley, Serre Barbin hamlet' },
    short: { fr: 'Vue de drone', en: 'Drone view' },
    aConfirmer: ['terrains 847 et 700 m², 5 et 4 suites (site actuel)', 'le site actuel mentionne aussi un chalet C de 120 m² : à confirmer', 'exposition et distance des pistes : non publiées'],
  },
  {
    id: 'sabot-venus',
    route: { fr: '/vefa-sabot-de-venus/', en: '/en/vefa-sabot-de-venus/' },
    name: 'Le Sabot de Vénus',
    status: 'disponible',
    village: 'La Salle-les-Alpes',
    locality: { fr: 'Serre Chevalier', en: 'Serre Chevalier' },
    valley: 'Serre Chevalier',
    scene: 'sabot-venus',
    sentence: {
      fr: 'Deux chalets à deux pas des commerces et des pistes, chacun sur son terrain.',
      en: 'Two chalets a stone’s throw from the shops and the slopes, each on its own plot.',
    },
    units: [
      { label: 'Chalet A', surface: 198, terrain: 572, rooms: { fr: '4 chambres', en: '4 bedrooms' } },
      { label: 'Chalet B', surface: 145, terrain: 468, rooms: { fr: '4 chambres', en: '4 bedrooms' } },
    ],
    facts: { slopes: { fr: 'À deux pas', en: 'A stone’s throw' } },
    gallery: ['sv-site-1'],
    caption: { fr: 'Le secteur, La Salle-les-Alpes, février 2025', en: 'The area, La Salle-les-Alpes, February 2025' },
    short: { fr: 'Le secteur, février 2025', en: 'The area, February 2025' },
    aConfirmer: ['terrains 572 et 468 m², 4 chambres chacun (site actuel)', 'photos du site à confirmer comme prises depuis le terrain'],
  },
  {
    id: 'la-rouya',
    route: { fr: '/vefa-la-rouya/', en: '/en/vefa-la-rouya/' },
    name: 'La Rouya',
    status: 'disponible',
    village: 'Puy-Saint-Vincent',
    locality: { fr: 'Secteur des Alberts', en: 'Les Alberts' },
    valley: 'Pays des Écrins',
    scene: 'la-rouya',
    sentence: {
      fr: "Un chalet au calme, en bordure d'espace arboré, à cinq minutes des pistes.",
      en: 'A quiet chalet at the edge of the woods, five minutes from the slopes.',
    },
    units: [
      { label: null, surface: 167, surfaceNote: { fr: 'de plancher', en: '' }, terrain: 1243, rooms: { fr: '4 suites', en: '4 en-suites' } },
    ],
    facts: { slopes: { fr: '5 minutes', en: '5 minutes' }, permit: { fr: 'Permis purgé de tout recours', en: 'Planning permission cleared of all appeals' } },
    gallery: ['lr-est', 'lr-sud', 'lr-ouest', 'lr-so'],
    caption: { fr: 'Vue réelle depuis le terrain, secteur des Alberts', en: 'Actual view from the plot, Les Alberts' },
    short: { fr: 'Vue depuis le terrain', en: 'View from the plot' },
    aConfirmer: ['4 suites (le site actuel indique aussi « 3 suites + dortoir »)', 'permis purgé de tout recours (site actuel)'],
  },
  {
    id: 'rocher-blanc',
    route: { fr: '/vefa-chalet-de-rocher-blanc/', en: '/en/vefa-chalet-de-rocher-blanc/' },
    name: 'Chalet du Rocher Blanc',
    status: 'vendu',
    village: 'Villard-Laté',
    locality: { fr: 'Au-dessus de Villard-Laté', en: 'Above Villard-Laté' },
    valley: 'Serre Chevalier',
    scene: 'rocher-blanc',
    sentence: {
      fr: 'Plein sud, face aux pistes de Serre Chevalier.',
      en: 'Due south, facing the Serre Chevalier slopes.',
    },
    units: [{ label: null, surface: 270, terrain: 568, rooms: { fr: '4 suites et un dortoir', en: '4 en-suites and a bunk room' } }],
    facts: { exposure: { fr: 'Plein sud', en: 'Due south' }, slopes: { fr: 'Face aux pistes', en: 'Facing the slopes' } },
    architect: 'Alain Gallinet',
    gallery: ['rb-pistes', 'rb-vue'],
    views3d: ['rb-3d-sud'],
    caption: { fr: 'Vue réelle depuis le terrain, face aux pistes', en: 'Actual view from the plot, facing the slopes' },
    short: { fr: 'Vue depuis le terrain', en: 'View from the plot' },
    aConfirmer: ['270 m², terrain 568 m², 4 suites et un dortoir, architecte Alain Gallinet (site actuel)', 'vues 3D : rendus de 2024, provenance à confirmer'],
  },
  {
    id: 'etoile-glaciers',
    route: { fr: '/vefa-letoile-des-glaciers/', en: '/en/vefa-letoile-des-glaciers/' },
    name: 'L’Étoile des Glaciers',
    status: 'vendu',
    village: 'Le Monêtier-les-Bains',
    locality: { fr: 'Le Monêtier-les-Bains', en: 'Le Monêtier-les-Bains' },
    valley: 'Serre Chevalier',
    scene: 'etoile-glaciers',
    sentence: {
      fr: "Face au Cibouit, à l'Yret et aux Écrins : douglas massif, mélèze naturel et pierre locale.",
      en: 'Facing the Cibouit, the Yret and the Écrins: solid Douglas fir, natural larch and local stone.',
    },
    units: [{ label: null, surface: 223, terrain: 820, terrainApprox: true, rooms: { fr: '5 chambres', en: '5 bedrooms' } }],
    facts: { view: { fr: 'Cibouit, Yret, Écrins', en: 'Cibouit, Yret, Écrins' } },
    architect: 'Alain Gallinet',
    gallery: ['eg-ouest', 'eg-sud2', 'eg-terrain'],
    caption: { fr: 'Vue réelle depuis le terrain, mélèzes en octobre', en: 'Actual view from the plot, larches in October' },
    short: { fr: 'Vue depuis le terrain', en: 'View from the plot' },
    aConfirmer: ['5 chambres (site actuel)'],
  },
];

export const quotes = {
  dufour: {
    text: "Je leur ai confirmé la construction de mon chalet il y a 44 ans et à ce jour je ne peux que me féliciter d'avoir choisi l'entreprise Lombard et Vasina. Aucun problème depuis.",
    who: 'Monsieur Dufour',
    when: { fr: 'chalet construit en 1982', en: 'chalet built in 1982' },
  },
  andre: {
    text: "Non seulement vous avez réalisé mes envies, mais vous êtes allés plus loin, vous avez réalisé ce que je n'avais pas osé imaginer et qui pourtant me correspond.",
    who: 'André',
    when: null,
  },
};

// Chronologie : faits du brief.
export const timeline = [
  { y: '1979', fr: "Maurice Lombard et Jean-Claude Vasina s'associent pour construire des chalets clés en main. Ils se distinguent par le red cedar et l'isolation des toitures par-dessus.", en: 'Maurice Lombard and Jean-Claude Vasina join forces to build turnkey chalets, known for red cedar and over-rafter roof insulation.' },
  { y: '1989', fr: 'Un atelier de menuiserie, équipé de machines de pointe.', en: 'A joinery workshop, fitted with state-of-the-art machines.' },
  { y: '2000', fr: 'La conception sur ordinateur (CadWork), puis une K2 à commande numérique pour tailler le bois : une première dans les Hautes-Alpes.', en: 'Computer-aided design (CadWork), then a K2 CNC machine to cut timber: a first in the Hautes-Alpes.' },
  { y: '2005', fr: 'Le passage au poteau-poutre.', en: 'The move to post-and-beam construction.' },
  { y: '2016', fr: 'Une commande numérique en menuiserie et les agencements intérieurs sur mesure.', en: 'A CNC machine for joinery, and bespoke interior fittings.' },
  { y: '2020', fr: 'Un atelier de charpente de 1 300 m², une nouvelle K2 et une ligne de fabrication de panneaux.', en: 'A 1,300 m² framing workshop, a new K2 and a panel production line.' },
  { y: '2021', fr: "Marielle, ingénieure en génie civil, et Mathieu reprennent l'entreprise. Maurice reste présent pour transmettre.", en: 'Marielle, a civil engineer, and Mathieu take over the company. Maurice stays on to pass on his know-how.' },
];

// Visites à 360° (site actuel). Correspondance titre / visite à vérifier.
export const tours = [
  { name: 'Chalet Dibona', id: 'aKA0zTlk7r', fr: 'Livré en 2023. Environ 227 m², espace détente.', en: 'Delivered in 2023. About 227 m², spa area.' },
  { name: 'Chalet Écrin des Vignes', id: 'Ikw0lCh3OM', fr: 'Spa, sauna et salle de jeux.', en: 'Spa, sauna and games room.' },
  { name: 'Chalet Ski Resort', id: 'txZ0RztAPD', fr: '134 m², 5 chambres, séjour cathédrale.', en: '134 m², 5 bedrooms, cathedral living room.' },
  { name: 'Demi-chalet', id: 'CLV0v9USAH', fr: 'Séjour traversant au pied des pistes, deux logements.', en: 'Through living room at the foot of the slopes, two homes.' },
  { name: 'Chalet des Serres', id: 'GmQ0NypRC7', fr: '190 m², 4 chambres et un dortoir, sauna.', en: '190 m², 4 bedrooms and a bunk room, sauna.' },
  { name: 'Chalet Reine', id: 'cZN0aYZyHL', fr: 'Tout en mélèze thermotraité.', en: 'All in thermo-treated larch.' },
  { name: 'Chalet Taou-Manou', id: 'nFI0J8vMYi', fr: 'Une décoration claire et chaleureuse.', en: 'Light, warm interiors.' },
  { name: 'Chalet contemporain', id: 'qkb0tlmwqI', fr: 'Dessiné avec l’architecte Alain Gallinet.', en: 'Designed with architect Alain Gallinet.' },
  { name: 'Chalet Aigle', id: 'huu0P7qcMs', fr: 'Jusqu’à 14 personnes, vue sur la vallée de Serre Chevalier.', en: 'Sleeps up to 14, view over the Serre Chevalier valley.' },
  { name: 'Chalet Le Lorgnon', id: '8sX0Akwncx', fr: '5 chambres, jusqu’à 12 personnes.', en: '5 bedrooms, sleeps up to 12.' },
];

// Vallées (pages de territoire).
export const valleys = [
  {
    key: 'v-serre-chevalier', name: 'Serre Chevalier',
    villages: ['Le Monêtier-les-Bains', 'La Salle-les-Alpes', 'Saint-Chaffrey', 'Chantemerle', 'Villard-Laté', 'Briançon'],
    images: ['ext-220', 'ext-reine'], scene: 'panorama', sale: ['serre-orchis', 'sabot-venus'],
  },
  {
    key: 'v-briancon', name: 'Briançon',
    villages: ['Briançon', 'Val-des-Prés', 'Névache', 'Cervières', 'Montgenèvre', 'Saint-Martin-de-Queyrières'],
    images: ['briancon-refuge', 'ext-300-neige'], scene: 'serre-orchis', sale: ['serre-orchis', 'sabot-venus', 'la-rouya'],
  },
  {
    key: 'v-vallouise', name: 'Vallouise-Pelvoux',
    villages: ['Vallouise', 'Pelvoux', 'Les Vigneaux', 'Puy-Saint-Vincent', "L'Argentière-la-Bessée"],
    images: ['ext-vallouise', 'ext-tomasi', 'ext-pelvoux'], scene: null, sale: ['la-rouya'],
  },
  {
    key: 'v-puy-saint-vincent', name: 'Puy-Saint-Vincent',
    villages: ['Puy-Saint-Vincent', 'Les Alberts', 'Vallouise', 'Les Vigneaux'],
    images: ['psv-terrasse', 'psv-interieur'], scene: 'real-psv-automne', sale: ['la-rouya'],
  },
  {
    key: 'v-montgenevre', name: 'Montgenèvre',
    villages: ['Montgenèvre', 'Val-des-Prés', 'Briançon', 'Cervières'],
    images: ['mg-aerien', 'mg-interieur', 'mg-chambre'], scene: 'real-montgenevre', sale: [],
  },
];
