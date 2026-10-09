import { chalets, routes } from '../data.mjs';
import { T, esc, url, lines, scene, still, credit, factsOf, stateHTML, listingLD, breadcrumb, sceneMeta } from '../ui.mjs';
import { sceneStill } from './home.mjs';

const arrow = '<span class="arrow" aria-hidden="true">→</span>';

const PRESTATIONS = {
  fr: [
    'Structure poteau-poutre en douglas, bardage extérieur en mélèze, sur socle maçonné',
    'Intérieur bois, parquet chêne dans les chambres et les pièces de vie',
    'Pompe à chaleur et plancher chauffant à tous les niveaux',
    'Placards bois sur mesure et têtes de lit dans toutes les chambres',
    'Robinetteries encastrées, plan électrique complet, éclairage extérieur',
    'Local à skis aménagé',
  ],
  en: [
    'Douglas fir post-and-beam structure, larch external cladding, on a masonry base',
    'Timber interiors, oak floors in the bedrooms and living areas',
    'Heat pump with underfloor heating on every level',
    'Bespoke timber wardrobes and headboards in every bedroom',
    'Concealed taps, full lighting plan, exterior lighting',
    'Fitted ski room',
  ],
};

const where = (c, lang) => {
  const p = T(lang, { 'Le Monêtier-les-Bains': 'au Monêtier-les-Bains', 'La Salle-les-Alpes': 'à La Salle-les-Alpes', 'Puy-Saint-Vincent': 'à Puy-Saint-Vincent', 'Villard-Laté': 'à Villard-Laté, Serre Chevalier' }[c.village], `in ${c.village === 'Villard-Laté' ? 'Villard-Laté, Serre Chevalier' : c.village}`);
  return p;
};

export function salePage(lang) {
  const L = (fr, en) => T(lang, fr, en);
  const card = (c) => `<article class="card"><a href="${c.route[lang]}" aria-label="${esc(c.name)}">${sceneStill(c.scene, lang, c.caption[lang] + ' — ' + c.name)}</a>
<div class="card__meta"><h2><a class="name" href="${c.route[lang]}">${esc(c.name)}</a></h2>${stateHTML(c, lang)}</div>
<p class="small muted">${c.locality[lang].includes(c.village) ? esc(c.locality[lang]) : esc(c.locality[lang] + ', ' + c.village)}</p>
${factsOf(c, lang)}</article>`;
  const body = `
<section class="page-head"><div class="wrap grid">
<nav class="crumbs" aria-label="${L('Fil d’Ariane', 'Breadcrumb')}"><a href="${url('home', lang)}">${L('Accueil', 'Home')}</a><span aria-hidden="true">/</span><span>${L('Chalets à vendre', 'Chalets for sale')}</span></nav>
${lines(L('Chalets neufs à vendre|dans le Briançonnais', 'New-build chalets for sale|in the Briançonnais'), 'h1', 'display')}
<p class="lead fade">${L('Serre Chevalier et Puy-Saint-Vincent : des terrains choisis pour leur exposition, leur vue et la proximité des pistes.', 'Serre Chevalier and Puy-Saint-Vincent: plots chosen for their aspect, their view and their closeness to the slopes.')}</p>
</div></section>
<section class="section--tight"><div class="wrap"><div class="grid cards">${chalets.map(card).join('')}</div></div></section>
<section class="section"><div class="wrap grid split">
<div class="split__a">${lines(L('Acheter sur plan,|en confiance', 'Buying off-plan,|with confidence'), 'h2', 'h2')}</div>
<div class="split__b body">
<p>${L('La vente en l’état futur d’achèvement (VEFA) vous apporte la sécurité d’un achat encadré et la liberté d’un projet personnalisé : matériaux, agencements, finitions.', 'Buying off-plan (VEFA, the French “sale before completion” scheme) gives you the security of a regulated purchase and the freedom of a bespoke project: materials, layouts, finishes.')}</p>
<p>${L('Nos chalets sont dessinés, taillés et levés par nos équipes, dans nos ateliers de Saint-Martin-de-Queyrières.', 'Our chalets are drawn, cut and raised by our own teams, in our workshops in Saint-Martin-de-Queyrières.')}</p>
<p>${L('Plans, vues 3D et visites sont envoyés sur demande. Les prix ne sont pas publiés : nous vous les communiquons directement.', 'Plans, 3D views and tours are sent on request. Prices are not published: we share them with you directly.')}</p>
<p class="after" style="margin-top:var(--s4)"><a class="cta" href="${url('contact', lang)}?sujet=plans#formulaire">${L('Recevoir les plans', 'Receive the plans')} ${arrow}</a></p>
</div></div></section>`;
  return {
    key: 'sale', path: routes.sale, preloadSerif: true,
    title: L('Chalets neufs à vendre à Serre Chevalier et Puy-Saint-Vincent | Lombard & Vasina', 'New-build chalets for sale in Serre Chevalier and Puy-Saint-Vincent | Lombard & Vasina'),
    description: L('Chalets neufs vendus sur plan (VEFA) au Monêtier-les-Bains, à La Salle-les-Alpes et à Puy-Saint-Vincent : surfaces, terrains, chambres, état. Plans et visites sur demande.', 'New-build chalets sold off-plan in Le Monêtier-les-Bains, La Salle-les-Alpes and Puy-Saint-Vincent: floor areas, plots, bedrooms, availability. Plans and tours on request.'),
    og: sceneMeta('serre-orchis')?.og,
    body,
    ld: [breadcrumb([[L('Accueil', 'Home'), routes.home[lang]], [L('Chalets à vendre', 'Chalets for sale'), routes.sale[lang]]]), ...chalets.map((c) => listingLD(c, lang))],
  };
}

export function chaletPage(c, lang) {
  const L = (fr, en) => T(lang, fr, en);
  const sold = c.status === 'vendu';
  const others = chalets.filter((x) => x.id !== c.id);
  const unitsTable = c.units.length > 1 ? `<ul class="list-rule small" style="margin-top:var(--s4)">${c.units.map((u) => `<li><b style="font-weight:400">${u.label}</b> — ${u.surface} m², ${L('terrain de', 'plot of')} ${u.terrain.toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR').replace(/ /g, ' ')} m², ${u.rooms[lang]}</li>`).join('')}</ul>` : '';
  const gallery = c.gallery.length ? `<section class="section--tight"><div class="wrap">
<h2 class="h3">${L('Vues réelles depuis le terrain', 'Actual views from the plot')}</h2>
<div class="grid gallery">${c.gallery.map((id, i) => `<figure class="${c.gallery.length === 1 || (c.gallery.length === 3 && i === 0) ? 'g-wide' : ''}">${still(id, lang, { sizes: '(min-width: 768px) 50vw, 100vw' })}${credit(id, lang) ? `<figcaption class="caption muted">${credit(id, lang)}</figcaption>` : ''}</figure>`).join('')}</div></div></section>` : '';
  const views3d = (c.views3d || []).length ? `<section class="section--tight"><div class="wrap">
<h2 class="h3">${L('Vues 3D', '3D views')}</h2>
<div class="grid gallery">${c.views3d.map((id) => `<figure class="g-wide">${still(id, lang, { sizes: '100vw' })}<figcaption class="caption muted">${L('Vue 3D, image non contractuelle', '3D view, not contractually binding')}</figcaption></figure>`).join('')}</div></div></section>` : '';
  const sceneAlt = `${c.caption[lang]} — ${c.name}`;
  const body = `
<section class="page-head"><div class="wrap grid">
<nav class="crumbs" aria-label="${L('Fil d’Ariane', 'Breadcrumb')}"><a href="${url('home', lang)}">${L('Accueil', 'Home')}</a><span aria-hidden="true">/</span><a href="${url('sale', lang)}">${L('Chalets à vendre', 'Chalets for sale')}</a><span aria-hidden="true">/</span><span>${esc(c.name)}</span></nav>
<h1 style="grid-column:1/-1"><span class="name" style="display:block">${esc(c.name)}</span><span class="h3 muted" style="display:block;margin-top:var(--s2)">${sold ? L('Chalet vendu', 'Chalet sold') : c.units.length > 1 ? L('Chalets neufs à vendre', 'New-build chalets for sale') : L('Chalet neuf à vendre', 'New-build chalet for sale')} ${where(c, lang)}</span></h1>
</div></section>
<section><div class="frame frame--pano">${scene(c.scene, lang, { alt: sceneAlt, lazy: false, priority: true })}</div>
<div class="wrap"><p class="cote caption">${esc(c.caption[lang])}</p></div></section>
<section class="section--tight"><div class="wrap">
<div class="grid split">
<div class="split__a"><p class="lead">${esc(c.sentence[lang])}</p>${c.architect ? `<p class="small muted" style="margin-top:var(--s3)">${L('Architecte', 'Architect')} : ${c.architect}</p>` : ''}</div>
<div class="split__b">${factsOf(c, lang)}${unitsTable}</div>
</div>
<div class="after">${sold
    ? `<p class="small muted">${L('Ce chalet est vendu. Un projet comparable sur votre terrain ?', 'This chalet is sold. A similar project on your own plot?')}</p><a class="cta" href="${url('contact', lang)}?sujet=projet#formulaire">${L('Parlons de votre chalet', 'Let’s talk about your chalet')} ${arrow}</a>`
    : `<a class="cta" href="${url('contact', lang)}?sujet=plans&amp;chalet=${c.id}#formulaire">${L('Recevoir les plans', 'Receive the plans')} ${arrow}</a><p class="small muted">${L('Plans, vues 3D et visite envoyés sur demande. Prix communiqué directement.', 'Plans, 3D views and tour sent on request. Price shared directly.')}</p>`}</div>
</div></section>
${gallery}${views3d}
<section class="section"><div class="wrap grid split">
<div class="split__a"><h2 class="h3">${L('Ce qui est prévu', 'What is included')}</h2><p class="small muted" style="margin-top:var(--s2)">${L('Le plan et les prestations s’adaptent à vos besoins.', 'The plan and specification adapt to your needs.')}</p></div>
<ul class="split__b list-rule">${PRESTATIONS[lang].map((p) => `<li>${p}</li>`).join('')}</ul>
</div></section>
<section class="section surface"><div class="wrap">
<h2 class="h3">${L('Les autres chalets', 'Other chalets')}</h2>
<ul class="list-rule" style="margin-top:var(--s4)">${others.map((o) => `<li style="display:flex;justify-content:space-between;gap:var(--s2);align-items:baseline"><a href="${o.route[lang]}"><span class="italic">${esc(o.name)}</span> <span class="small muted">${esc(o.village)}</span></a>${stateHTML(o, lang)}</li>`).join('')}</ul>
</div></section>`;
  const units = c.units.map((u) => u.surface).join(T(lang, ' et ', ' and '));
  const title = sold
    ? L(`${c.name}, chalet vendu à ${c.village} | Lombard & Vasina`, `${c.name}, chalet sold in ${c.village} | Lombard & Vasina`)
    : L(`${c.name} : chalet${c.units.length > 1 ? 's' : ''} neuf${c.units.length > 1 ? 's' : ''} à vendre ${where(c, 'fr')} | Lombard & Vasina`, `${c.name}: new-build chalet${c.units.length > 1 ? 's' : ''} for sale in ${c.village} | Lombard & Vasina`);
  const description = sold
    ? L(`${c.name}, ${units} m² ${where(c, 'fr')}, vendu. Un projet comparable ? Lombard & Vasina construit des chalets bois sur mesure dans le Briançonnais.`, `${c.name}, ${units} m² in ${c.village}, sold. A similar project? Lombard & Vasina builds bespoke timber chalets in the Briançonnais.`)
    : L(`${c.name}, ${c.units.length > 1 ? 'chalets neufs' : 'chalet neuf'} de ${units} m² à vendre sur plan ${where(c, 'fr')}, ${c.valley}. ${c.sentence.fr} Plans et visite sur demande.`, `${c.name}, new-build chalet${c.units.length > 1 ? 's' : ''} of ${units} m² for sale off-plan in ${c.village}, ${c.valley}. ${c.sentence.en} Plans and tour on request.`);
  return {
    key: 'sale', path: c.route, preloadSerif: true, title, description,
    og: sceneMeta(c.scene)?.og,
    body,
    ld: [listingLD(c, lang), breadcrumb([[L('Accueil', 'Home'), routes.home[lang]], [L('Chalets à vendre', 'Chalets for sale'), routes.sale[lang]], [c.name, c.route[lang]]])],
  };
}
