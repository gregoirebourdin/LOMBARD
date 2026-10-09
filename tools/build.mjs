// Assemble public/index.html à partir de src/index.html et des données de data/.
//   node tools/build.mjs
// - {{pic name="…" sizes="…" alt="…" class="…" mobile="…" media="…" eager}} : <picture> AVIF + WebP
//   aux largeurs exportées (public/assets/img/manifest.json), dimensions, couleur d'attente, aperçu flou ;
// - {{include fichier}} : insère src/<fichier> (SVG du logo animé, relevé au trait…) ;
// - {{logo …}} : le logo officiel en SVG inline, sans identifiants, prêt à être stylé ;
// - {{programmes:…}}, {{carte}}, {{vitrine-data}}, {{jsonld}} : rendus depuis data/*.json ;
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
const CARTE = json(join(ROOT, 'data/carte.json'));
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
const chev = '<svg class="ico ico--chev" aria-hidden="true"><use href="#i-chev"/></svg>';
const dot = '<span class="dot" aria-hidden="true"></span>';
const quote = (s) => s; // les « » sont déjà dans les données (verbatim)
const thumb = (p, size = 'sm') => `<span class="gable-thumb gable-thumb--${size}"><img src="/assets/img/thumbs/${p.id}.webp" width="144" height="180" alt="" loading="lazy" decoding="async" fetchpriority="low"></span>`;

const partials = {
  encart: () => PR.map((p) => `<li><a class="encart__row" href="#${p.id}" data-cursor="Voir">${thumb(p)}`
    + `<span class="encart__txt"><span class="encart__name">${p.nom}</span><span class="encart__commune micro">${p.commune}</span>`
    + `<span class="encart__surf">${p.encart}</span></span>${arrow}</a></li>`).join(''),
  thumbs: () => PR.map((p) => thumb(p, 'xs')).join(''),
  sommaire: () => PR.map((p) => `<li><a class="som__row" href="#${p.id}" data-point="${p.id}" data-cursor="Voir">`
    + `<span class="som__n mono">${p.n}</span><span class="som__name">${p.nom}</span><span class="som__commune micro">${p.commune}</span>`
    + `<span class="som__status micro">${dot}À VENDRE</span><span class="som__rule" aria-hidden="true"></span></a></li>`).join(''),
  menu: () => PR.map((p) => `<li><a href="#${p.id}" class="menu__prog" data-menu-link>${thumb(p, 'md')}<span>${p.nom}</span></a></li>`).join(''),
  footer: () => PR.map((p) => `<li><a href="#${p.id}">${p.nom}</a></li>`).join(''),
  vendus: () => DATA.vendus.map((v) => `<span class="vendu">${v.nom.toUpperCase()}, ${v.lieu.toUpperCase()} <span class="tag">VENDU</span></span>`).join('<span class="sep" aria-hidden="true">·</span>'),
  vitrine: () => PR.map((p, i) => {
    const lots = lotsPub(p);
    const def = lots.find((l) => l.id === p.lot_defaut) || lots[0];
    const tabs = lots.length > 1
      ? `<div class="lots" role="tablist" aria-label="Chalets du programme ${esc(p.nom)}">${lots.map((l) => `<button class="lots__tab" role="tab" id="tab-${p.id}-${l.id}" aria-controls="lot-${p.id}-${l.id}" aria-selected="${l === def}" tabindex="${l === def ? 0 : -1}" data-lot="${l.id}">${l.onglet}</button>`).join('')}</div>`
      : '';
    const panels = lots.map((l) => `<div class="fiche${l === def ? ' is-active' : ''}" role="${lots.length > 1 ? 'tabpanel' : 'group'}" id="lot-${p.id}-${l.id}"${lots.length > 1 ? ` aria-labelledby="tab-${p.id}-${l.id}"` : ''}${l === def ? '' : ' hidden'} data-lot="${l.id}">`
      + `<h4 class="fiche__t">${l.titre}</h4><dl class="fiche__dl">`
      + `<div class="fiche__row fiche__row--surf"><dt class="mono">SURFACE</dt><dd><span class="roll">${l.surface}</span></dd></div>`
      + `<div class="fiche__row"><dt class="mono">TERRAIN</dt><dd><span class="roll">${l.terrain}</span></dd></div>`
      + `<div class="fiche__row"><dt class="mono">${l.libelle_chambres || 'CHAMBRES'}</dt><dd><span class="roll">${l.chambres}</span></dd></div>`
      + `<div class="fiche__row"><dt class="mono">PLUS</dt><dd><span class="roll">${l.plus}</span></dd></div></dl>`
      + (l.texte ? `<p class="fiche__txt">${quote(l.texte)}</p>` : '') + '</div>').join('');
    const pastilles = p.pastilles ? `<ul class="pastilles">${p.pastilles.map((s) => `<li class="pastille">${s.replace(/^« | »$/g, '')}</li>`).join('')}</ul>` : '';
    const devise = p.devise ? `<p class="prog__devise">${p.devise}</p>` : '';
    const presta = `<ul class="presta">${p.prestations.map((s) => `<li>${chev}<span>${quote(s)}</span></li>`).join('')}</ul>`;
    const ext = def.ext, int = def.int;
    const fig = (id, kind, leg) => {
      const n = `v-${id}`;
      return `<figure class="diorama diorama--${kind}" data-scene="${id}">`
        + `<div class="diorama__frame crop-marks">${picture({ name: n, sizes: '(min-width: 1024px) 50vw, 100vw', class: 'diorama__pic' })}</div>`
        + `<figcaption class="micro">VUE 3D · ILLUSTRATION NON CONTRACTUELLE · ${leg}</figcaption></figure>`;
    };
    return `<article class="prog" id="${p.id}" aria-labelledby="${p.id}-t" data-prog="${p.id}" data-index="${i}">`
      + `<div class="prog__head"><span class="prog__bign" aria-hidden="true">${p.n}</span>`
      + `<p class="prog__count mono">${p.n} / 0${PR.length}</p>`
      + `<p class="prog__status micro">${dot}EN VENTE · VEFA</p>`
      + `<h3 class="prog__name" id="${p.id}-t">${p.nom}</h3><p class="prog__lieu micro">${p.lieu}</p></div>`
      + fig(ext, 'ext', def.leg_ext)
      + `<p class="prog__chapeau">${quote(p.chapeau)}</p>`
      + tabs + `<div class="fiches">${panels}</div>`
      + fig(int, 'int', def.leg_int)
      + `<details class="prog__more"><summary class="mono">Voir les prestations ${chev}</summary>${presta}</details>`
      + `<div class="prog__presta">${presta}</div>`
      + pastilles + devise
      + `<div class="prog__cta"><button class="btn" type="button" data-drawer data-programme="${p.id}" data-lot="${def.id}" data-magnetic>`
      + `<span class="btn__label" data-roll>Recevoir les plans et les prix</span>${arrow}</button>`
      + `<a class="link" href="${p.url}">Voir la fiche du programme</a></div></article>`;
  }).join(''),
};

/* ——— carte au trait (géocodage BAN, projection locale) ——— */
function carte() {
  const W = 360, H = 240, pad = { l: 24, r: 24, t: 70, b: 34 };
  const pts = CARTE.points;
  const lat0 = pts.reduce((s, p) => s + p.c[1], 0) / pts.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p.c[0] * k), ys = pts.map((p) => p.c[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((W - pad.l - pad.r) / (x1 - x0), (H - pad.t - pad.b) / (y1 - y0));
  const ox = pad.l + ((W - pad.l - pad.r) - (x1 - x0) * s) / 2, oy = pad.t + ((H - pad.t - pad.b) - (y1 - y0) * s) / 2;
  const pr = (c) => [ox + (c[0] * k - x0) * s, oy + (y1 - c[1]) * s];
  // horizon : la silhouette des montagnes et du toit du logo, étirée sur toute la largeur
  const horizon = `<path class="carte__horizon" d="M0 46 L28 40 L44 44 L70 30 L86 36 L104 22 L118 30 L136 26 L150 34 L162 18 L180 6 L198 18 L212 32 L232 24 L246 30 L262 16 L278 26 L296 22 L316 34 L334 28 L360 40"/>`;
  const marks = pts.map((p) => {
    const [x, y] = pr(p.c).map((n) => +n.toFixed(1));
    const right = x < W * 0.55;
    const tx = right ? x + 10 : x - 10, anchor = right ? 'start' : 'end';
    const label = p.label.length > 26 ? p.label.split(' · ') : [p.label];
    const text = `<text x="${tx}" y="${y + 3.5}" text-anchor="${anchor}">${label.map((t, i) => `<tspan x="${tx}" dy="${i ? 12 : 0}">${t}</tspan>`).join('')}</text>`;
    if (p.kind === 'vente') return `<g class="carte__pt carte__pt--vente" data-point="${p.id}"><circle class="carte__ring" cx="${x}" cy="${y}" r="3"/><circle cx="${x}" cy="${y}" r="3"/>${text}</g>`;
    if (p.kind === 'atelier') return `<g class="carte__pt carte__pt--atelier"><path d="M${x - 5} ${y + 3}L${x} ${y - 3}L${x + 5} ${y + 3}"/>${text}</g>`;
    return `<g class="carte__pt carte__pt--repere"><circle cx="${x}" cy="${y}" r="2"/>${text}</g>`;
  }).join('');
  return `<svg class="carte" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="carte-t"><title id="carte-t">Carte : les trois programmes en vente (Le Monêtier-les-Bains, La Salle-les-Alpes, Puy-Saint-Vincent), Briançon et l’atelier de Saint-Martin-de-Queyrières</title>`
    + `${horizon}<path class="carte__n" d="M${W - 14} 62 v-12 M${W - 18} 54 l4 -5 l4 5"/><text class="carte__nt" x="${W - 14}" y="74" text-anchor="middle">N</text>${marks}</svg>`;
}

/* ——— données de la vitrine pour le JS ——— */
function scene(id) {
  const out = { id };
  const f = man[`v-${id}`];
  if (f) out.flat = { w: f.w, h: f.h, c: f.color, avif: srcset(`v-${id}`, f, 'avif'), webp: srcset(`v-${id}`, f, 'webp'), alt: f.alt };
  const lp = join(PUB, `assets/scenes/${id}/scene.json`);
  if (existsSync(lp)) out.layers = json(lp);
  if (DATA.points_entree[id]) out.entry = DATA.points_entree[id];
  return out;
}
function vitrineData() {
  const ids = new Set();
  const progs = PR.map((p) => ({
    id: p.id, n: p.n, nom: p.nom, def: p.lot_defaut,
    lots: lotsPub(p).map((l) => { ids.add(l.ext); ids.add(l.int); return { id: l.id, ext: l.ext, int: l.int, legExt: l.leg_ext, legInt: l.leg_int, entree: l.entree || null }; }),
  }));
  const scenes = {};
  for (const id of ids) scenes[id] = scene(id);
  return JSON.stringify({ progs, scenes }).replace(/</g, '\\u003c');
}

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
html = html.replace(/\{\{carte\}\}/g, carte);
html = html.replace(/\{\{vitrine-data\}\}/g, vitrineData);
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
