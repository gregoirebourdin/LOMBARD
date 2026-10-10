// Assemble public/index.html à partir de src/index.html et des données de data/.
//   node tools/build.mjs
// - {{pic name="…" sizes="…" alt="…" class="…" mobile="…" media="…" eager}} : <picture> AVIF + WebP
//   aux largeurs exportées (public/assets/img/manifest.json), dimensions, couleur d'attente, aperçu flou ;
// - {{include fichier}} : insère src/<fichier> (SVG du logo animé, relevé au trait…) ;
// - {{logo …}} : le logo officiel en SVG inline, sans identifiants, prêt à être stylé ;
// - {{hero:back|mid|front|fog|preload|css}} : les trois plans du hero (public/assets/hero/<d|m>/hero.json) et sa photo floue ;
// - {{programmes:…}}, {{jsonld}} : rendus depuis data/programmes.json ;
// - typographie française sur le texte (espaces fines, milliers) ; empreinte de version des CSS et JS.
// Le build échoue si un programme « en vente » n'a pas été vérifié depuis plus de 60 jours.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const SRC = join(ROOT, 'src');
const read = (p) => readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));
const man = existsSync(join(PUB, 'assets/img/manifest.json')) ? json(join(PUB, 'assets/img/manifest.json')) : {};
const DATA = json(join(ROOT, 'data/programmes.json'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const missing = new Set();

/* ——— fraîcheur des données ——— */
const today = new Date();
for (const p of DATA.programmes) {
  if (p.statut !== 'en-vente') continue;
  const age = (today - new Date(p.verifie_le)) / 864e5;
  if (!(age <= 60)) throw new Error(`${p.nom} : données vérifiées le ${p.verifie_le}, il y a plus de 60 jours. Revérifier le site puis mettre à jour verifie_le.`);
}

/* ——— images ——— */
function attrs(s) {
  const out = {};
  for (const m of s.matchAll(/(\w[\w-]*)(?:="([^"]*)")?/g)) out[m[1]] = m[2] ?? true;
  return out;
}
const srcset = (name, m, ext) => m.widths.map((w) => `/assets/img/${name}-${w}.${ext} ${w}w`).join(', ');
const best = (m, target) => m.widths.find((w) => w >= target) || m.widths[m.widths.length - 1];

function picture(a) {
  const m = man[a.name];
  const cls = `pic${a.class ? ' ' + a.class : ''}`;
  if (!m) { // image pas encore exportée : cadre neutre, signalé à la fin du build
    missing.add(a.name);
    return `<picture class="${cls}" data-missing="${a.name}"><img alt="${esc(a.alt || '')}" width="16" height="10"${a.imgclass ? ` class="${a.imgclass}"` : ''}></picture>`;
  }
  const sizes = a.sizes || '100vw';
  const alt = a.alt ?? m.alt ?? '';
  const bg = m.lqip && !a.nolqip ? `;background-image:url(${m.lqip})` : '';
  let mob = '';
  if (a.mobile) {
    const mm = man[a.mobile];
    if (!mm) missing.add(a.mobile);
    else {
      const media = a.media || '(max-aspect-ratio: 1/1)';
      const ms = a.msizes || '100vw';
      mob = `<source media="${media}" type="image/avif" srcset="${srcset(a.mobile, mm, 'avif')}" sizes="${ms}" width="${mm.w}" height="${mm.h}">`
        + `<source media="${media}" type="image/webp" srcset="${srcset(a.mobile, mm, 'webp')}" sizes="${ms}" width="${mm.w}" height="${mm.h}">`;
    }
  }
  const eager = !!a.eager;
  const prio = a.priority ? ` fetchpriority="${a.priority}"` : (eager ? ' fetchpriority="high"' : '');
  return `<picture class="${cls}" style="--ratio:${m.ratio};--c:${m.color}${bg}">`
    + mob
    + `<source type="image/avif" srcset="${srcset(a.name, m, 'avif')}" sizes="${sizes}">`
    + `<source type="image/webp" srcset="${srcset(a.name, m, 'webp')}" sizes="${sizes}">`
    + `<img src="/assets/img/${a.name}-${best(m, 1280)}.webp" width="${m.w}" height="${m.h}" alt="${esc(alt)}"`
    + (eager ? ' decoding="async"' : ' loading="lazy" decoding="async"') + prio
    + (a.imgclass ? ` class="${a.imgclass}"` : '')
    + '></picture>';
}

function preload(name, media) {
  const m = man[name];
  if (!m) { missing.add(name); return ''; }
  return `<link rel="preload" as="image" type="image/avif" imagesrcset="${srcset(name, m, 'avif')}" imagesizes="100vw" media="${media}" fetchpriority="high">`;
}

/* ——— hero en trois plans (tools/hero_planes.py) ——— */
const HERO = { d: json(join(PUB, 'assets/hero/d/hero.json')), m: json(join(PUB, 'assets/hero/m/hero.json')) };
const PORTRAIT = '(max-aspect-ratio: 1/1)', LANDSCAPE = '(min-aspect-ratio: 1/1)';
const heroPlane = (k, name) => HERO[k].planes.find((p) => p.name === name);
const heroFiles = (k, name) => { const p = heroPlane(k, name); return name === 'back' ? HERO[k].widths : p.files; };
const heroSet = (k, name, ext) => heroFiles(k, name).map((w) => `/assets/hero/${k}/${name}-${w}.${ext} ${w}w`).join(', ');
// largeur affichée de chaque plan : scène ≈ 104 % du côté qui couvre l'écran, plan = sa part de la scène
const heroSizes = (k, name) => {
  const p = heroPlane(k, name), f = (p.bbox[2] - p.bbox[0]) / HERO[k].w;
  return k === 'd' ? `${Math.round(106 * f)}vw` : `${Math.round(156 * f)}vw`;
};
function hero(name) {
  const alt = name === 'back' ? 'Chalet en mélèze et pierre au crépuscule, sous un ciel violet, sommet enneigé derrière' : '';
  const src = (k, ext) => `<source media="${k === 'm' ? PORTRAIT : LANDSCAPE}" type="image/${ext}" srcset="${heroSet(k, name, ext)}" sizes="${heroSizes(k, name)}">`;
  const last = heroFiles('d', name).slice(-1)[0];
  return `<picture class="hp hp--${name}">${src('m', 'avif')}${src('m', 'webp')}${src('d', 'avif')}${src('d', 'webp')}`
    + `<img src="/assets/hero/d/${name}-${last}.webp" alt="${alt}" fetchpriority="high" decoding="async"${name === 'back' ? ' class="hero__img"' : ''}></picture>`;
}
// photo floue (tools/hero_fog.py), insérée dans la page : l'intro s'ouvre sur elle sans attendre le réseau
function heroFog() {
  const uri = (k) => `data:image/webp;base64,${readFileSync(join(PUB, `assets/hero/${k}/fog.webp`)).toString('base64')}`;
  return `<picture class="hero__fog" aria-hidden="true"><source media="${PORTRAIT}" srcset="${uri('m')}"><img src="${uri('d')}" alt=""></picture>`;
}
function heroPreload() {
  return ['back', 'mid', 'front'].map((n) => [['d', LANDSCAPE], ['m', PORTRAIT]].map(([k, media]) =>
    `<link rel="preload" as="image" type="image/avif" imagesrcset="${heroSet(k, n, 'avif')}" imagesizes="${heroSizes(k, n)}" media="${media}" fetchpriority="high">`).join('\n')).join('\n');
}
function heroCss() {
  const rules = (k) => HERO[k].planes.map((p) => {
    const { w, h } = HERO[k];
    const [x0, y0, x1, y1] = p.bbox;
    const pc = (v, t) => `${+((v / t) * 100).toFixed(3)}%`;
    return `.hp--${p.name}{left:${pc(x0, w)};top:${pc(y0, h)};width:${pc(x1 - x0, w)};height:${pc(y1 - y0, h)}}`;
  }).join('');
  return `<style>${rules('d')}@media ${PORTRAIT}{${rules('m')}}</style>`;
}

/* ——— scène « Votre chalet vous attend » (tools/scene_planes.py) ———
   fond et milieu plein cadre ; l'avant en masses de branches recadrées à leur boîte, chacune placée en
   fraction de la scène et agrandie (page.js) autour de son ancre */
const VCA = existsSync(join(PUB, 'assets/scenes/vca/scene.json')) ? json(join(PUB, 'assets/scenes/vca/scene.json')) : null;
function scenePic(name) {
  if (!VCA) { missing.add(`scene ${name}`); return ''; }
  // l'avant : toutes les masses, de celle du dessous à celle du dessus
  if (name === 'front') return VCA.planes.filter((x) => x.name.startsWith('front-')).reverse().map((x) => scenePic(x.name)).join('');
  const P = VCA.planes.find((x) => x.name === name);
  const ws = P.files;
  // versionnés par leur contenu : un plan redécoupé ne se mélange jamais, en cache, avec l'ancien
  const url = (w, ext) => {
    const p = `assets/scenes/vca/${name}-${w}.${ext}`;
    return `/${p}?v=${createHash('sha1').update(readFileSync(join(PUB, p))).digest('hex').slice(0, 8)}`;
  };
  const set = (ext) => ws.map((w) => `${url(w, ext)} ${w}w`).join(', ');
  const [x0, y0, x1, y1] = P.bbox;
  const fw = (x1 - x0) / VCA.w, fh = (y1 - y0) / VCA.h;
  const sizes = `(max-aspect-ratio: 1/1) ${Math.ceil(72 * fw)}vh, ${Math.ceil(104 * fw)}vw`;
  const r = (v) => +v.toFixed(4);
  const piece = P.anchor ? ` vp--piece" data-s0="${P.s0}" style="--px:${r(x0 / VCA.w)};--py:${r(y0 / VCA.h)};--pw:${r(fw)};--ph:${r(fh)};`
    + `--ox:${r(((P.anchor[0] - x0) / (x1 - x0)) * 100)}%;--oy:${r(((P.anchor[1] - y0) / (y1 - y0)) * 100)}%` : '';
  // le fond porte la description de toute la scène (les plans recomposent la photo)
  const alt = name === 'back' ? 'Chalet en bois sous la neige, vu à travers des branches de sapin enneigées' : '';
  return `<picture class="vp vp--${name}${piece}"><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
    + `<img src="${url(ws[ws.length - 1], 'webp')}" alt="${alt}" width="${x1 - x0}" height="${y1 - y0}" loading="lazy" decoding="async"></picture>`;
}

/* ——— logo ——— */
const LOGO = read(join(ROOT, 'brand/logo/logo.svg'));
const logoPaths = (() => {
  const grab = (id) => LOGO.match(new RegExp(`<path id="${id}" d="([^"]+)"`))[1];
  const group = (id) => [...LOGO.match(new RegExp(`<g id="${id}">([\\s\\S]*?)</g>`))[1].matchAll(/d="([^"]+)"/g)].map((m) => m[1]);
  return {
    ml: grab('clv-mountain-left'), mr: grab('clv-mountain-right'), ro: grab('clv-roof-outer'), ri: grab('clv-roof-inner'),
    chalets: group('clv-chalets'), lombard: group('clv-lombard'), vasina: group('clv-vasina'),
  };
})();
const P = (d, c = '') => `<path${c ? ` class="${c}"` : ''} d="${d}"/>`;

function logo(a) {
  const L = logoPaths;
  const letters = [...L.chalets, ...L.lombard, ...L.vasina].map((d) => P(d)).join('');
  if (a.variant === 'emboss') {
    // pied de page : logo de la couleur du papier, en relief ; seul le toit est violet, tracé au scroll
    return `<svg class="emboss" viewBox="0 0 1286.11 643.35" role="img" aria-label="Chalets Lombard Vasina">`
      + `<defs><filter id="fx-emb" x="-2%" y="-2%" width="104%" height="104%"><feDropShadow dx="0" dy="1.8" stdDeviation="0.4" flood-color="#FFFFFF" flood-opacity=".9"/><feDropShadow dx="0" dy="-1.8" stdDeviation="0.6" flood-color="#160B13" flood-opacity=".13"/></filter>`
      + `<filter id="fx-emb-m" x="-3%" y="-3%" width="106%" height="106%"><feDropShadow dx="0" dy="4.5" stdDeviation="1" flood-color="#FFFFFF" flood-opacity=".95"/><feDropShadow dx="0" dy="-4.5" stdDeviation="1.4" flood-color="#160B13" flood-opacity=".16"/></filter>`
      + `<mask id="fx-mo" maskUnits="userSpaceOnUse" x="-50" y="-50" width="1400" height="800"><polyline class="emboss__draw" points="354.5,200.6 654.7,12.4 935,187.6" fill="none" stroke="#fff" stroke-width="26"/></mask>`
      + `<mask id="fx-mi" maskUnits="userSpaceOnUse" x="-50" y="-50" width="1400" height="800"><polyline class="emboss__draw" points="423.3,196 654.7,53.5 885,197.3" fill="none" stroke="#fff" stroke-width="12"/></mask></defs>`
      + `<g class="emboss__paper">${P(L.ml)}${P(L.mr)}${letters}</g>`
      + `<g class="emboss__roof"><path mask="url(#fx-mo)" d="${L.ro}"/><path mask="url(#fx-mi)" d="${L.ri}"/></g></svg>`;
  }
  const label = a.label ? ` role="img" aria-label="${esc(a.label)}"` : ' aria-hidden="true" focusable="false"';
  return `<svg class="logo${a.class ? ' ' + a.class : ''}" viewBox="0 0 1286.11 643.35"${label}>`
    + `<g class="logo__m">${P(L.ml)}${P(L.mr)}</g><g class="logo__t">${P(L.ro)}${P(L.ri)}${letters}</g></svg>`;
}

/* ——— programmes ——— */
const PR = DATA.programmes.filter((p) => p.statut !== 'vendu');
const lotsPub = (p) => p.lots.filter((l) => l.publie !== false);
const arrow = '<svg class="ico ico--arrow" aria-hidden="true"><use href="#i-arrow"/></svg>';
const thumb = (p, size = 'sm') => `<span class="gable-thumb gable-thumb--${size}"><img src="/assets/img/thumbs/${p.id}.webp" width="144" height="180" alt="" loading="lazy" decoding="async" fetchpriority="low"></span>`;

const partials = {
  cards: () => PR.map((p, i) => {
    const lots = lotsPub(p);
    const def = lots.find((l) => l.id === p.lot_defaut) || lots[0];
    const view = (id, kind, on) => {
      const n = `v-${id}`;
      return picture({ name: n, sizes: '(min-width: 1024px) 56vw, 100vw', class: `prog__view${on ? ' is-on' : ''}` }).replace('<picture ', `<picture data-view="${kind}" `);
    };
    const lab = lots.some((l) => l.libelle_chambres) ? 'Couchages' : 'Chambres';
    const rows = lots.map((l) => `<tr><th scope="row">${l.onglet}</th><td>${l.surface}</td><td>${l.terrain}</td><td>${l.chambres}</td></tr>`).join('');
    const note = p.pastilles ? `<p class="prog__plus">${p.pastilles[0].replace(/^« | »$/g, '')}</p>` : '';
    return `<article class="prog${i % 2 ? ' prog--alt' : ''}" id="${p.id}" aria-labelledby="${p.id}-t">`
      + `<div class="prog__media"><div class="prog__views">${view(def.ext, 'ext', true)}${view(def.int, 'int', false)}</div>`
      + `<div class="prog__bar"><div class="prog__switch" role="group" aria-label="Vue 3D du programme ${esc(p.nom)}">`
      + `<button type="button" aria-pressed="true" data-view="ext">Extérieur</button><button type="button" aria-pressed="false" data-view="int">Intérieur</button></div>`
      + `<p class="prog__note">Vues 3D non contractuelles</p></div></div>`
      + `<div class="prog__body"><p class="prog__status"><span class="dot dot--pulse" aria-hidden="true"></span>En vente sur plan</p>`
      + `<h3 class="prog__name" id="${p.id}-t">${p.nom}</h3><p class="prog__lieu">${p.lieu}</p>`
      + `<p class="prog__text">${p.chapeau}</p>${note}`
      + `<table class="lots"><caption class="sr-only">Chalets du programme ${esc(p.nom)}</caption><thead><tr><th scope="col">Chalet</th><th scope="col">Surface</th><th scope="col">Terrain</th><th scope="col">${lab}</th></tr></thead><tbody>${rows}</tbody></table>`
      + `<div class="prog__cta"><button class="btn" type="button" data-drawer data-programme="${p.id}" data-lot="${def.id}" data-magnetic>`
      + `<span class="btn__label" data-roll>Recevoir les plans et les prix</span>${arrow}</button>`
      + `<a class="link" href="${p.url}">Voir le programme</a></div></div></article>`;
  }).join(''),
  menu: () => PR.map((p) => `<li><a href="#${p.id}" class="menu__prog" data-menu-link>${thumb(p, 'md')}<span>${p.nom}</span></a></li>`).join(''),
  footer: () => PR.map((p) => `<li><a href="#${p.id}">${p.nom}</a></li>`).join(''),
  vendus: () => DATA.vendus.map((v) => `<span class="vendu">${v.nom}, ${v.lieu} <span class="tag">Vendu</span></span>`).join(''),

};

/* ——— données structurées ——— */
function jsonld() {
  const org = {
    '@context': 'https://schema.org', '@type': 'HomeAndConstructionBusiness', name: 'Chalets Lombard Vasina',
    legalName: 'SAS Lombard et Vasina', foundingDate: '1979', telephone: '+33 4 92 21 29 19', email: 'contact@chalets-lombard.fr',
    url: 'https://www.chalets-lombard.fr/', slogan: 'Notre métier, votre chalet.',
    address: { '@type': 'PostalAddress', streetAddress: '51 rue de la Rochette', postalCode: '05120', addressLocality: 'Saint-Martin-de-Queyrières', addressCountry: 'FR' },
    geo: { '@type': 'GeoCoordinates', latitude: 44.863318, longitude: 6.594635 },
  };
  const list = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: 'Chalets en vente sur plan',
    itemListElement: PR.map((p, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: {
        '@type': 'Residence', name: p.nom, url: p.url,
        address: { '@type': 'PostalAddress', addressLocality: p.ville, addressRegion: 'Hautes-Alpes', addressCountry: 'FR' },
        floorSize: lotsPub(p).map((l) => ({ '@type': 'QuantitativeValue', value: parseFloat(l.surface.replace(',', '.').replace(/\s/g, '')), unitCode: 'MTK' })),
      },
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(org)}</script><script type="application/ld+json">${JSON.stringify(list)}</script>`;
}

/* ——— typographie française, sur le texte seulement ——— */
const NNBSP = ' ';
function typo(text) {
  return text
    .replace(/[  ]([;:!?»])/g, `${NNBSP}$1`)
    .replace(/«[  ]/g, `«${NNBSP}`)
    .replace(/(\d)[  ](\d{3})(?!\d)/g, `$1${NNBSP}$2`)
    .replace(/(\d) ?m2\b/g, `$1${NNBSP}m²`);
}
function typoHtml(html) {
  return html.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>)/g)
    .map((seg, i) => (i % 2 ? seg : typo(seg))).join('');
}

/* ——— assemblage ——— */
let html = read(join(SRC, 'index.html'));
html = html.replace(/\{\{include ([\w.-]+)(?: (\w+))?\}\}/g, (_, f, prefix) => {
  if (!existsSync(join(SRC, f))) { missing.add(f); return ''; }
  const t = read(join(SRC, f)).trim();
  return prefix ? t.replace(/%p%/g, prefix) : t;
});
html = html.replace(/\{\{logo([^}]*)\}\}/g, (_, s) => logo(attrs(s)));
html = html.replace(/\{\{programmes:(\w+)\}\}/g, (_, k) => partials[k]());
html = html.replace(/\{\{hero:(back|mid|front)\}\}/g, (_, n) => hero(n));
html = html.replace(/\{\{hero:fog\}\}/g, heroFog);
html = html.replace(/\{\{scene:(back|mid|front)\}\}/g, (_, n) => scenePic(n));
html = html.replace(/\{\{hero:preload\}\}/g, heroPreload);
html = html.replace(/\{\{hero:css\}\}/g, heroCss);
html = html.replace(/\{\{site\}\}/g, process.env.SITE_URL || 'https://chalets-lombard.vercel.app');
html = html.replace(/\{\{jsonld\}\}/g, jsonld);
html = html.replace(/\{\{preload ([\w-]+) "([^"]+)"\}\}/g, (_, n, media) => preload(n, media));
html = html.replace(/\{\{pic ([^}]+)\}\}/g, (_, s) => picture(attrs(s)));
html = html.replace(/\{\{src ([\w-]+) (\d+) (avif|webp)\}\}/g, (_, n, w, ext) => {
  const m = man[n];
  if (!m) { missing.add(n); return ''; }
  const b = m.widths.filter((x) => x <= +w).pop() || m.widths[0];
  return `/assets/img/${n}-${b}.${ext}`;
});
html = typoHtml(html);
const hash = (p) => createHash('sha1').update(readFileSync(join(PUB, p))).digest('hex').slice(0, 8);
html = html.replace(/(\/assets\/(?:css|js)\/[\w./-]+\.(?:css|js))(?=")/g, (p) => `${p}?v=${hash(p.slice(1))}`);
writeFileSync(join(PUB, 'index.html'), html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`public/index.html : ${kb} Ko`);
if (missing.size) console.warn(`images manquantes (cadre neutre) : ${[...missing].join(', ')}`);
