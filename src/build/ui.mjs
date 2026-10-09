// Composants HTML du site (générés au build, aucun framework côté client).
import { readFileSync, existsSync } from 'node:fs';
import { company, routes, chalets, SITE } from './data.mjs';

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const T = (lang, fr, en) => (lang === 'en' ? en : fr);
export const url = (key, lang) => routes[key][lang];
export const chaletUrl = (c, lang) => c.route[lang];
export const chaletById = (id) => chalets.find((c) => c.id === id);

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const num = (n, lang) => (lang === 'en' ? n.toLocaleString('en-GB') : n.toLocaleString('fr-FR').replace(/ |\s/g, ' '));
export const fmtNum = num;

let IMG = {}, SCN = {};
export function loadManifests(siteDir) {
  const a = `${siteDir}/assets/img/manifest.json`, b = `${siteDir}/assets/scenes/manifest.json`;
  IMG = existsSync(a) ? JSON.parse(readFileSync(a, 'utf8')) : {};
  SCN = existsSync(b) ? JSON.parse(readFileSync(b, 'utf8')) : {};
  return { IMG, SCN };
}
export const sceneMeta = (name) => SCN[name];
export const imgMeta = (id) => IMG[id];

/* ---------- Images fixes ---------- */
export function picture(id, lang, { sizes = '100vw', lazy = true, cls = '', priority = false, alt } = {}) {
  const m = IMG[id];
  if (!m) return `<!-- image manquante : ${esc(id)} -->`;
  const set = (ext) => m.widths.map((w) => `${m.base}-${w}.${ext} ${w}w`).join(', ');
  const fallback = `${m.base}-${m.widths[Math.min(1, m.widths.length - 1)]}.webp`;
  const a = alt ?? m.alt[lang];
  return `<picture${cls ? ` class="${cls}"` : ''}><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}"><img src="${fallback}" width="${m.w}" height="${m.h}" alt="${esc(a)}" ${lazy ? 'loading="lazy"' : 'loading="eager"'} decoding="async"${priority ? ' fetchpriority="high"' : ''} style="--focus:${m.focus || '50% 50%'}"></picture>`;
}
// Image fixe avec la lumière rasante.
export function still(id, lang, opts = {}) {
  return `<div class="still${opts.cls ? ' ' + opts.cls : ''}" data-light>${picture(id, lang, { ...opts, cls: '' })}<div class="scene__light" aria-hidden="true"></div></div>`;
}
export function credit(id, lang) {
  const m = IMG[id];
  if (!m) return '';
  if (m.kind === '3d') return T(lang, 'Vue 3D, image non contractuelle', '3D view, not contractually binding');
  return m.credit ? T(lang, `Photo ${m.credit}`, `Photo ${m.credit}`) : '';
}

/* ---------- Scènes en profondeur ---------- */
function planeHTML(name, p, i, lang, { mobile, lazy, priority, sizes, aspectWH }) {
  const media = mobile ? '(min-width: 768px), (prefers-reduced-motion: reduce)' : '(max-width: 767px), (prefers-reduced-motion: reduce)';
  const ws = Object.keys(p.src).map(Number).sort((a, b) => a - b);
  const set = (ext) => ws.map((w) => `${p.src[w]}.${ext} ${w}w`).join(', ');
  const fb = `${p.src[ws[Math.min(1, ws.length - 1)]]}.webp`;
  const data = `data-s="${p.s.join(',')}" data-y="${p.y.join(',')}" data-x="${(p.x || [0, 0]).join(',')}" data-speed="${p.speed}" data-travel="${p.travel ?? 1}" data-mouse="${p.mouse || 0}"`;
  return `<div class="scene__plane" ${data}><picture><source media="${media}" srcset="${BLANK}"><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}"><img src="${fb}" alt="" width="${aspectWH[0]}" height="${aspectWH[1]}" loading="${lazy ? 'lazy' : 'eager'}" decoding="async"${priority && i === 0 ? ' fetchpriority="high"' : ''}></picture></div>`;
}

export function scene(name, lang, { alt, flow = true, lazy = true, priority = false, sizes = '100vw', light = false, cls = '' } = {}) {
  const m = SCN[name];
  if (!m) return `<div class="scene ${cls}"><!-- scène manquante : ${esc(name)} --></div>`;
  const focus = `${(m.focus[0] * 100).toFixed(1)}% ${(m.focus[1] * 100).toFixed(1)}%`;
  const origin = `${(m.origin[0] * 100).toFixed(1)}% ${(m.origin[1] * 100).toFixed(1)}%`;
  const mb = m.mobile_box || [0, 0, 1, 1];
  const mfocus = `50% 50%`;
  const dPlanes = m.desktop.map((p, i) => planeHTML(name, p, i, lang, { mobile: false, lazy, priority, sizes, aspectWH: [m.w, m.h] })).join('');
  const mw = Math.round(m.w * mb[2]), mh = Math.round(m.h * mb[3]);
  const mPlanes = m.mobile.map((p, i) => planeHTML(name, p, i, lang, { mobile: true, lazy, priority, sizes: m.motion === 'pan' ? 'calc(62vh * ' + (m.aspect).toFixed(3) + ')' : '100vw', aspectWH: [mw, mh] })).join('');
  const fws = Object.keys(m.flat).map(Number).sort((a, b) => a - b);
  const fset = (ext) => fws.map((w) => `${m.flat[w]}.${ext} ${w}w`).join(', ');
  const flat = `<picture><source media="(prefers-reduced-motion: no-preference)" srcset="${BLANK}"><source type="image/avif" srcset="${fset('avif')}" sizes="${sizes}"><source type="image/webp" srcset="${fset('webp')}" sizes="${sizes}"><img class="scene__flat" src="${m.flat[fws[Math.min(1, fws.length - 1)]]}.webp" width="${m.w}" height="${m.h}" alt="${esc(alt)}" loading="${lazy ? 'lazy' : 'eager'}" decoding="async"></picture>`;
  const style = `--focus:${focus};--origin:${origin};--overscan:${m.overscan};background-image:url(${m.lqip});background-size:cover;background-position:${focus}`;
  const mstyle = `--focus:${mfocus}`;
  return `<div class="scene${cls ? ' ' + cls : ''}"${flow ? ' data-flow' : ''}${light ? ' data-light' : ''} style="${style}">`
    + `<div class="scene__stage scene__stage--d" role="img" aria-label="${esc(alt)}" data-aspect="${m.aspect.toFixed(4)}">${dPlanes}</div>`
    + `<div class="scene__stage scene__stage--m" role="img" aria-label="${esc(alt)}" data-aspect="${(m.motion === 'pan' ? m.aspect : m.mobile_aspect).toFixed(4)}" style="${mstyle}">${mPlanes}</div>`
    + flat + (light ? '<div class="scene__light" aria-hidden="true"></div>' : '') + '</div>';
}

// Préchargement de l'ouverture (seulement si le mouvement est permis).
export function preloadScene(name) {
  const m = SCN[name]; if (!m) return '';
  const out = [];
  m.desktop.forEach((p) => {
    const ws = Object.keys(p.src).map(Number).sort((a, b) => a - b);
    out.push(`<link rel="preload" as="image" type="image/avif" imagesrcset="${ws.map((w) => `${p.src[w]}.avif ${w}w`).join(', ')}" imagesizes="100vw" media="(min-width: 768px) and (prefers-reduced-motion: no-preference)">`);
  });
  m.mobile.forEach((p) => {
    const ws = Object.keys(p.src).map(Number).sort((a, b) => a - b);
    out.push(`<link rel="preload" as="image" type="image/avif" imagesrcset="${ws.map((w) => `${p.src[w]}.avif ${w}w`).join(', ')}" imagesizes="100vw" media="(max-width: 767px) and (prefers-reduced-motion: no-preference)">`);
  });
  return out.join('\n');
}

/* ---------- Typographie ---------- */
// Titre en lignes (révélées une à une). Les lignes sont séparées par « | ».
export function lines(text, tag = 'h2', cls = 'h2', attrs = '') {
  const parts = String(text).split('|').map((s) => s.trim());
  return `<${tag} class="${cls} lines"${attrs ? ' ' + attrs : ''}>${parts.map((p) => `<span class="l"><span>${p}</span></span>`).join(' ')}</${tag}>`;
}
export const plain = (text) => String(text).split('|').map((s) => s.trim()).join(' ');

/* ---------- Fiche d'un chalet : des données nettes ---------- */
export function factsOf(c, lang, { compact = false } = {}) {
  const u = c.units;
  const join = (arr) => (arr.length === 2 ? arr.join(T(lang, ' et ', ' and ')) : arr[0]);
  const items = [];
  const surfaces = u.map((x) => num(x.surface, lang));
  items.push([T(lang, 'Surface', 'Floor area'), `${join(surfaces)} m²${u[0].surfaceNote ? ' ' + u[0].surfaceNote[lang] : ''}`]);
  if (u.every((x) => x.terrain)) items.push([T(lang, 'Terrain', 'Plot'), `${u[0].terrainApprox ? T(lang, 'env. ', 'approx. ') : ''}${join(u.map((x) => num(x.terrain, lang)))} m²`]);
  if (u.every((x) => x.rooms)) {
    const r = u.map((x) => x.rooms[lang]);
    const n = r.map((x) => x.split(' ')[0]), rest = r.map((x) => x.split(' ').slice(1).join(' '));
    let v;
    if (r.length === 1) v = r[0];
    else if (r[0] === r[1]) v = T(lang, `${n[0]} chacun`, `${n[0]} each`);
    else if (rest[0] === rest[1]) v = `${n[0]}${T(lang, ' et ', ' and ')}${r[1]}`;
    else v = join(r);
    items.push([T(lang, 'Chambres', 'Bedrooms'), v]);
  }
  if (c.facts.exposure) items.push([T(lang, 'Exposition', 'Aspect'), c.facts.exposure[lang]]);
  if (c.facts.view) items.push([T(lang, 'Vue', 'View'), c.facts.view[lang]]);
  if (c.facts.slopes) items.push([T(lang, 'Pistes', 'Slopes'), c.facts.slopes[lang]]);
  if (c.facts.permit && !compact) items.push([T(lang, 'Permis', 'Permit'), T(lang, 'Purgé de tout recours', 'Cleared of all appeals')]);
  items.push([T(lang, 'État', 'Status'), stateHTML(c, lang)]);
  return `<dl class="facts" style="--facts:${items.length}">${items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}
export function stateHTML(c, lang) {
  return c.status === 'vendu'
    ? `<span class="state state--sold">${T(lang, 'Vendu', 'Sold')}</span>`
    : `<span class="state">${T(lang, 'Disponible', 'Available')}</span>`;
}

/* ---------- Le trait n°1 : la ferme de charpente (ferme à entrait, poinçon et contrefiches) ---------- */
export function fermeSVG(lang) {
  // Ferme à poinçon et contrefiches sur poteaux (poteau-poutre), tracée au compas :
  // toutes les coordonnées sont calculées, les pièces se touchent exactement.
  const f = (n) => Math.round(n * 10) / 10;
  const P = (pts) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L');
  const L0 = 50, R0 = 950, TOP = 420, BOT = 444, AX = 500, AY = 88;   // entrait, faîtage
  const k = (TOP - AY) / (AX - L0);                                    // pente des arbalétriers
  const th = 26 / Math.cos(Math.atan(k));                              // épaisseur verticale
  const yo = (x) => TOP - k * (x - L0);                                // rive extérieure (gauche)
  const yi = (x) => yo(x) + th;                                        // rive intérieure (gauche)
  const xiFoot = L0 + th / k;                                          // pied intérieur sur l'entrait
  const KP = 14;                                                       // demi-largeur du poinçon
  const kpTop = yi(AX - KP);
  const mirror = (pts) => pts.map(([x, y]) => [2 * AX - x, y]);
  const d = [];
  // entrait
  d.push(P([[L0, TOP], [R0, TOP], [R0, BOT], [L0, BOT], [L0, TOP]]));
  // arbalétriers
  const rafter = [[L0, TOP], [AX, AY]], rafterIn = [[xiFoot, TOP], [AX - KP, kpTop]];
  d.push(P(rafter), P(mirror(rafter)), P(rafterIn), P(mirror(rafterIn)));
  // poinçon
  d.push(P([[AX - KP, kpTop], [AX - KP, TOP]]), P([[AX + KP, kpTop], [AX + KP, TOP]]));
  // contrefiches : du poinçon vers la rive intérieure de l'arbalétrier
  const strut = (y0, x1, w) => [
    [[AX - KP, y0 - w], [x1 + w, yi(x1 + w)]],   // rive haute : vers le faîtage
    [[AX - KP, y0 + w], [x1 - w, yi(x1 - w)]],   // rive basse
  ];
  for (const ln of strut(372, 300, 11)) { d.push(P(ln), P(mirror(ln))); }
  // pannes (sections posées sur les arbalétriers) et faîtière
  const purlin = (x) => [[x - 14, yo(x) - 24], [x + 14, yo(x) - 24], [x + 14, yo(x) - 24 + 24 - k * 14], [x - 14, yo(x) + k * 14], [x - 14, yo(x) - 24]];
  for (const x of [170, 335]) { d.push(P(purlin(x)), P(mirror(purlin(x)))); }
  d.push(P([[AX - 14, AY - 26], [AX + 14, AY - 26], [AX + 14, AY - 4], [AX - 14, AY - 4], [AX - 14, AY - 26]]));
  // poteaux et jambes de force
  const post = [[[110, BOT], [110, 640]], [[138, BOT], [138, 640]]];
  const brace = [[[138, 566], [224, BOT]], [[138, 592], [246, BOT]]];
  for (const ln of [...post, ...brace]) { d.push(P(ln), P(mirror(ln))); }
  const dims = [P([[L0, 690], [R0, 690]]), P([[L0, 680], [L0, 700]]), P([[R0, 680], [R0, 700]]),
    P([[992, AY], [992, TOP]]), P([[982, AY], [1002, AY]]), P([[982, TOP], [1002, TOP]])];
  const t1 = T(lang, 'Ferme de charpente, poteau-poutre en bois massif', 'Roof truss, solid timber post-and-beam');
  return `<svg viewBox="0 0 1060 730" role="img" aria-label="${esc(t1)}" data-draw>
${d.map((x) => `<path d="${x}" data-stroke/>`).join('\n')}
${dims.map((x) => `<path class="dim" d="${x}" data-stroke/>`).join('\n')}
<text x="${AX}" y="716" text-anchor="middle" data-after>${T(lang, 'portée', 'span')}</text>
<text x="1008" y="${(AY + TOP) / 2}" data-after>${T(lang, 'hauteur', 'rise')}</text>
</svg>`;
}

/* ---------- Le trait n°2 : la carte des vallées ---------- */
export function mapSVG(lang, mapData, { saleOnly = false } = {}) {
  const m = mapData;
  const rivers = m.rivers.map((r) => `<path class="river" d="${r.d}" data-stroke><title>${esc(r.name)}</title></path>`).join('');
  const places = m.places.map((p) => {
    const [x, y] = p.xy; const [dx, dy, anc] = p.label;
    const mark = p.kind === 'hq' ? `<rect class="place--hq" x="${x - 4}" y="${y - 4}" width="8" height="8"/>`
      : `<circle class="place ${p.kind === 'sale' ? 'place--sale' : ''}" cx="${x}" cy="${y}" r="${p.kind === 'town' ? 4.5 : p.kind === 'sale' ? 5 : 2.5}"/>`;
    const label = p.kind === 'sale' ? saleLabel(p.name, lang) : p.name;
    const minor = ['Pelvoux', 'Vallouise', 'Névache', "L'Argentière-la-Bessée", 'Guillestre', 'Saint-Véran', 'Villard-Laté'].includes(p.name);
    return `<g data-after${minor ? ' class="minor"' : ''}>${mark}<text x="${x + dx}" y="${y + dy}" text-anchor="${anc}"${p.kind === 'sale' ? ' class="sale"' : ''}>${esc(label)}</text></g>`;
  }).join('');
  const regions = m.regions.map((r) => `<text class="region" x="${r.xy[0]}" y="${r.xy[1]}" text-anchor="${r.anchor}" data-after>${esc(r.name)}</text>`).join('');
  return `<svg viewBox="-60 -30 1120 1060" role="img" aria-label="${esc(T(lang, 'Carte du Grand Briançonnais : les rivières de la Clarée, de la Guisane, de la Durance, de la Gyronde et du Guil, les villages où nous construisons et nos chalets à vendre.', 'Map of the Grand Briançonnais: the Clarée, Guisane, Durance, Gyronde and Guil rivers, the villages where we build and our chalets for sale.'))}" data-draw>${rivers}${regions}${places}</svg>`;
}
function saleLabel(name, lang) {
  const map = { 'Le Serre Barbin': 'Le Serre d’Orchis', 'La Salle-les-Alpes': 'Le Sabot de Vénus', 'Puy-Saint-Vincent': 'La Rouya' };
  return map[name] ? `${map[name]} · ${name}` : name;
}

/* ---------- Données structurées ---------- */
export function orgGraph(lang) {
  return {
    '@type': ['Organization', 'HomeAndConstructionBusiness'],
    '@id': `${SITE}/#organization`,
    name: company.name,
    alternateName: [company.alt, 'Lombard et Vasina'],
    url: `${SITE}${routes.home[lang]}`,
    logo: `${SITE}/assets/brand/lombard-vasina.png`,
    image: `${SITE}/assets/scenes/ouverture/og.jpg`,
    foundingDate: String(company.founded),
    founder: company.founders.map((n) => ({ '@type': 'Person', name: n })),
    numberOfEmployees: { '@type': 'QuantitativeValue', value: 40 },
    telephone: company.phone,
    email: company.email,
    address: { '@type': 'PostalAddress', streetAddress: company.street, postalCode: company.postal, addressLocality: company.city, addressRegion: 'Provence-Alpes-Côte d’Azur', addressCountry: company.country },
    geo: { '@type': 'GeoCoordinates', latitude: company.geo.lat, longitude: company.geo.lon },
    hasMap: company.maps,
    areaServed: company.areaServed.map((n) => ({ '@type': 'City', name: n })),
    knowsAbout: lang === 'en' ? ['timber chalets', 'post-and-beam', 'new-build chalets for sale', 'chalet renovation', 'chalet extension'] : ['chalets bois', 'poteau-poutre', 'chalets neufs à vendre', 'rénovation de chalet', 'extension de chalet'],
    sameAs: company.socials.map((s) => s.url),
  };
}
export function breadcrumb(items) {
  return { '@type': 'BreadcrumbList', itemListElement: items.map(([name, u], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE}${u}` })) };
}
export function listingLD(c, lang) {
  const u = c.units;
  const img = SCN[c.scene] ? `${SITE}${SCN[c.scene].og}` : undefined;
  return {
    '@type': 'RealEstateListing',
    '@id': `${SITE}${c.route[lang]}#listing`,
    name: `${c.name} — ${c.village}`,
    url: `${SITE}${c.route[lang]}`,
    inLanguage: lang,
    description: c.sentence[lang],
    image: img,
    offers: {
      '@type': 'Offer',
      availability: c.status === 'vendu' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      businessFunction: 'https://purl.org/goodrelations/v1#Sell',
      seller: { '@id': `${SITE}/#organization` },
      // Prix : publié seulement si l'entreprise l'accepte (aucun prix à ce jour).
    },
    about: u.map((x) => ({
      '@type': 'SingleFamilyResidence',
      name: x.label ? `${c.name}, ${x.label}` : c.name,
      floorSize: { '@type': 'QuantitativeValue', value: x.surface, unitCode: 'MTK' },
      ...(x.rooms ? { numberOfBedrooms: parseInt(x.rooms.fr, 10) } : {}),
      address: { '@type': 'PostalAddress', addressLocality: c.village, addressRegion: 'Hautes-Alpes', addressCountry: 'FR' },
      ...(x.terrain ? { additionalProperty: [{ '@type': 'PropertyValue', name: lang === 'en' ? 'Plot area' : 'Surface du terrain', value: x.terrain, unitCode: 'MTK' }] } : {}),
    })),
  };
}
