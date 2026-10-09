import { chalets, quotes, routes, company, timeline, tours, valleys } from '../data.mjs';
import { T, esc, url, lines, scene, still, credit, stateHTML, breadcrumb, sceneMeta, factsOf } from '../ui.mjs';
import { sceneStill } from './home.mjs';

const arrow = '<span class="arrow" aria-hidden="true">→</span>';

function head(lang, key, crumbs, h1, lead) {
  const L = (fr, en) => T(lang, fr, en);
  return `<section class="page-head"><div class="wrap grid">
<nav class="crumbs" aria-label="${L('Fil d’Ariane', 'Breadcrumb')}"><a href="${url('home', lang)}">${L('Accueil', 'Home')}</a>${crumbs.map(([n, u]) => `<span aria-hidden="true">/</span>${u ? `<a href="${u}">${n}</a>` : `<span>${n}</span>`}`).join('')}</nav>
${lines(h1, 'h1', 'display')}
${lead ? `<p class="lead fade">${lead}</p>` : ''}
</div></section>`;
}
const bc = (lang, items) => breadcrumb([[T(lang, 'Accueil', 'Home'), routes.home[lang]], ...items]);
const fig = (id, lang, cls = '', sizes = '(min-width: 768px) 50vw, 100vw') => `<figure class="${cls}">${still(id, lang, { sizes })}${credit(id, lang) ? `<figcaption class="caption muted">${credit(id, lang)}</figcaption>` : ''}</figure>`;

/* ---------------- Construire (savoir-faire) ---------------- */
export function buildPage(lang) {
  const L = (fr, en) => T(lang, fr, en);
  const body = head(lang, 'build', [[L('Construire', 'Build')]], L('Votre chalet,|sur votre terrain', 'Your chalet,|on your plot'),
    L('De 60 à 500 m², en poteau-poutre et bois massif : nous dessinons, taillons et levons tout nous-mêmes.', 'From 60 to 500 m², in solid timber post-and-beam: we draw, cut and raise everything ourselves.')) + `
<section><div class="frame frame--pano">${scene('real-psv-automne', lang, { lazy: false, alt: L('Chalet en bois et mélèzes dorés à Puy-Saint-Vincent en octobre', 'Timber chalet and golden larches in Puy-Saint-Vincent in October') })}</div>
<div class="wrap"><p class="cote caption">${L('Réalisation à Puy-Saint-Vincent', 'A chalet in Puy-Saint-Vincent')}</p></div></section>
<section class="section"><div class="wrap">
<div class="grid split">
<div class="split__a">${lines(L('Tout est fait|chez nous', 'Everything|in-house'), 'h2', 'h2')}</div>
<div class="split__b"><ol class="timeline" style="margin-top:0">
<li><b>${L('Le bureau d’études', 'Design office')}</b><span>${L('Une dizaine de personnes : création, chiffrage, 3D, démarches administratives et suivi de chantier.', 'Around ten people: design, costing, 3D, planning applications and site management.')}</span></li>
<li><b>${L('L’atelier', 'Workshop')}</b><span>${L('Trois à quatre techniciens et charpentiers transforment les dessins 3D en pièces prêtes à assembler, sur 1 300 m² et avec la K2.', 'Three to four technicians and carpenters turn 3D drawings into ready-to-assemble parts, in 1,300 m² and with the K2.')}</span></li>
<li><b>${L('Le chantier', 'On site')}</b><span>${L('Deux équipes de charpentiers poseurs et couvreurs.', 'Two teams of carpenter-fitters and roofers.')}</span></li>
</ol></div></div>
<div class="grid gallery">${fig('bureau-3d', lang)}${fig('levage', lang)}</div>
</div></section>
<section class="section surface"><div class="wrap">
<div class="grid split">
<div class="split__a">${lines(L('Le poteau-poutre,|en bois massif', 'Post-and-beam,|in solid timber'), 'h2', 'h2')}</div>
<div class="split__b body"><p>${L('Depuis 2005, nos chalets reposent sur une structure poteau-poutre en bois massif : de grandes portées, de grandes ouvertures, et une charpente qui reste visible.', 'Since 2005 our chalets stand on a solid timber post-and-beam structure: long spans, large openings and a frame that stays visible.')}</p></div>
</div>
<div class="grid gallery">${fig('charpente', lang, 'g-third', '(min-width: 768px) 33vw, 100vw')}${fig('poteau', lang, 'g-third', '(min-width: 768px) 33vw, 100vw')}${fig('charpente-meleze', lang, 'g-third', '(min-width: 768px) 33vw, 100vw')}</div>
</div></section>
<section class="section"><div class="wrap">
<div class="grid split">
<div class="split__a">${lines(L('Quatre bois|pour l’intérieur', 'Four woods|for the interior'), 'h2', 'h2')}</div>
<ul class="split__b list-rule"><li>${L('Le mélèze', 'Larch')}</li><li>${L('L’épicéa thermotraité', 'Thermo-treated spruce')}</li><li>${L('Le vieux bois', 'Reclaimed wood')}</li><li>${L('Le mélèze thermotraité', 'Thermo-treated larch')}</li></ul>
</div>
<div class="grid gallery">${fig('int-meleze', lang, 'g-wide', '100vw')}${fig('int-thermo', lang)}${fig('mg-interieur', lang)}${fig('int-vieux', lang)}${fig('int-sdb', lang)}</div>
<p class="notice small">${L('Agencements intérieurs sur mesure, fabriqués dans notre menuiserie depuis 2016.', 'Bespoke interior fittings, made in our joinery workshop since 2016.')}</p>
</div></section>
<section class="section surface"><div class="wrap grid split">
<div class="split__a">${lines(L('Avec un architecte|partenaire', 'With a partner|architect'), 'h2', 'h2')}</div>
<div class="split__b body"><p>${L('Nous travaillons avec l’architecte Alain Gallinet, par exemple pour le chalet du Freyssinet en 2018 et pour l’Étoile des Glaciers.', 'We work with architect Alain Gallinet, for instance on the Freyssinet chalet in 2018 and on the Étoile des Glaciers.')}</p>
<p style="margin-top:var(--s3)"><a class="link" href="${chalets.find((c) => c.id === 'etoile-glaciers').route[lang]}"><span class="italic">L’Étoile des Glaciers</span> ${arrow}</a></p></div>
</div></section>
<section class="section"><div class="wrap"><figure class="grid quote">
<blockquote class="fade" lang="fr">« ${esc(quotes.andre.text)} »</blockquote>
<figcaption class="small muted fade">${quotes.andre.who}${lang === 'en' ? ' (quoted in French)' : ''}</figcaption>
</figure>
<div class="after"><a class="cta" href="${url('contact', lang)}?sujet=projet#formulaire">${L('Parlons de votre chalet', 'Let’s talk about your chalet')} ${arrow}</a><a class="link small" href="${url('reno', lang)}">${L('Rénover ou agrandir', 'Renovate or extend')} ${arrow}</a></div>
</div></section>`;
  return {
    key: 'build', path: routes.build, preloadSerif: true,
    title: L('Construction de chalets bois sur mesure dans le Briançonnais | Lombard & Vasina', 'Bespoke timber chalet construction in the Briançonnais | Lombard & Vasina'),
    description: L('Constructeur de chalets bois sur mesure à Serre Chevalier, Briançon, Vallouise et Montgenèvre : bureau d’études 3D, atelier de charpente de 1 300 m², poteau-poutre en bois massif, de 60 à 500 m².', 'Bespoke timber chalet builder in Serre Chevalier, Briançon, Vallouise and Montgenèvre: 3D design office, 1,300 m² framing workshop, solid timber post-and-beam, from 60 to 500 m².'),
    og: sceneMeta('real-psv-automne')?.og,
    body, ld: [bc(lang, [[L('Construire', 'Build'), routes.build[lang]]])],
  };
}

/* ---------------- Rénovation et extension ---------------- */
export function renoPage(lang) {
  const L = (fr, en) => T(lang, fr, en);
  const pair = (title, text, a, b) => `<article class="section--tight"><div class="grid split">
<div class="split__a"><h2 class="h3">${title}</h2></div><p class="split__b body">${text}</p></div>
<div class="grid pair"><figure>${still(a, lang, { sizes: '(min-width: 768px) 50vw, 100vw' })}<figcaption class="caption muted">${L('Avant', 'Before')}</figcaption></figure><figure>${still(b, lang, { sizes: '(min-width: 768px) 50vw, 100vw' })}<figcaption class="caption muted">${L('Après', 'After')}</figcaption></figure></div></article>`;
  const body = head(lang, 'reno', [[L('Rénovation et extension', 'Renovation and extension')]], L('Rénover, agrandir,|reconstruire', 'Renovate, extend,|rebuild'),
    L('Votre chalet ou votre maison de village a encore beaucoup à offrir. Nous le transformons avec les mêmes équipes que nos chalets neufs.', 'Your chalet or village house still has much to give. We transform it with the same teams that build our new chalets.')) + `
<section class="section--tight"><div class="wrap">
${pair(L('Isolation par l’extérieur et intérieur repensé', 'External insulation and a rethought interior'), L('Un chalet Lombard & Vasina du début des années 1990, rendu plus performant et plus lumineux, sans perdre son esprit.', 'A Lombard & Vasina chalet from the early 1990s, made more efficient and brighter without losing its character.'), 'ren-ndn-avant', 'ren-ndn-apres')}
${pair(L('Un séjour doublé', 'A living room doubled'), L('Une extension en bois qui agrandit la pièce de vie et respecte l’architecture d’origine.', 'A timber extension that enlarges the living space and respects the original architecture.'), 'ren-ext-avant', 'ren-ext-apres')}
${pair(L('Toiture et charpente', 'Roof and frame'), L('Une toiture refaite pour mieux isoler, et une architecture qui évolue.', 'A rebuilt roof for better insulation, and an architecture that moves forward.'), 'ren-toit-avant', 'ren-toit-apres')}
${pair(L('Démolition et reconstruction', 'Demolition and rebuild'), L('Seul le rez-de-chaussée maçonné est conservé ; une structure bois neuve s’élève dessus.', 'Only the masonry ground floor is kept; a new timber structure rises above it.'), 'ren-rec-avant', 'ren-rec-apres')}
</div></section>
<section class="section surface"><div class="wrap grid split">
<div class="split__a">${lines(L('De l’étude|au chantier', 'From survey|to site'), 'h2', 'h2')}</div>
<ul class="split__b list-rule"><li>${L('Étude de faisabilité et démarches (PLU, permis de construire)', 'Feasibility study and planning (local plan, building permit)')}</li><li>${L('Relevé de l’existant et projet en 3D', 'Survey of the existing building and 3D design')}</li><li>${L('Isolation et performance énergétique à chaque intervention', 'Insulation and energy performance in every job')}</li><li>${L('Charpente, menuiserie et agencements faits dans nos ateliers', 'Framing, joinery and fittings made in our workshops')}</li></ul>
</div><div class="wrap after"><a class="cta" href="${url('contact', lang)}?sujet=renovation#formulaire">${L('Parlons de votre chalet', 'Let’s talk about your chalet')} ${arrow}</a></div></section>`;
  return {
    key: 'build', path: routes.reno, preloadSerif: false,
    title: L('Rénovation et extension de chalet à Serre Chevalier et Briançon | Lombard & Vasina', 'Chalet renovation and extension in Serre Chevalier and Briançon | Lombard & Vasina'),
    description: L('Rénovation, extension, isolation et reconstruction de chalets et maisons de village à Serre Chevalier, Briançon, Vallouise et Montgenèvre. Avant et après de nos chantiers.', 'Renovation, extension, insulation and rebuilding of chalets and village houses in Serre Chevalier, Briançon, Vallouise and Montgenèvre. Before and after.'),
    body, ld: [bc(lang, [[L('Rénovation et extension', 'Renovation and extension'), routes.reno[lang]]])],
  };
}

/* ---------------- Réalisations ---------------- */
export function workPage(lang) {
  const L = (fr, en) => T(lang, fr, en);
  const group = (title, ids, layout) => `<section class="section--tight"><div class="wrap"><h2 class="h3">${title}</h2><div class="grid gallery">${ids.map((id, i) => fig(id, lang, layout?.[i] || '', layout?.[i] === 'g-wide' ? '100vw' : layout?.[i] === 'g-third' ? '(min-width: 768px) 33vw, 100vw' : '(min-width: 768px) 50vw, 100vw')).join('')}</div></div></section>`;
  const body = head(lang, 'work', [[L('Réalisations', 'Our work')]], L('Plus de 800 chalets|depuis 1979', 'More than 800 chalets|since 1979'),
    L('De 60 à 500 m², du chalet traditionnel au chalet contemporain. Seulement des photographies réelles.', 'From 60 to 500 m², traditional to contemporary. Real photographs only.')) + `
<section><div class="frame frame--pano">${scene('real-montgenevre', lang, { lazy: false, alt: L('Toit enneigé et balcon d’un chalet à Montgenèvre, face aux pistes', 'Snowy roof and balcony of a chalet in Montgenèvre, facing the slopes') })}</div><div class="wrap"><p class="cote caption">${L('Montgenèvre, face aux pistes', 'Montgenèvre, facing the slopes')}</p></div></section>
${group(L('Extérieurs', 'Exteriors'), ['ext-220', 'ext-300-contemp', 'ext-reine', 'ext-220-automne', 'ext-300-neige', 'ext-terrasse', 'ext-220-nuit', 'ext-neige', 'ext-180-nuit', 'ext-100', 'ext-tomasi', 'ext-pelvoux'], ['g-wide', '', '', '', '', 'g-wide', '', '', '', '', '', ''])}
${group(L('Intérieurs en mélèze', 'Larch interiors'), ['int-meleze', 'int-meleze-2', 'int-cuisine', 'int-escalier', 'int-mezz', 'int-chambre', 'int-sejour-vue'], ['g-wide', '', '', 'g-third', 'g-third', 'g-third', 'g-wide'])}
${group(L('Épicéa thermotraité, vieux bois, mélèze thermotraité', 'Thermo-treated spruce, reclaimed wood, thermo-treated larch'), ['int-thermo', 'int-thermo-2', 'mg-interieur', 'int-vieux', 'int-sdb', 'mg-chambre'], ['', '', 'g-wide', '', '', ''])}
<section class="section"><div class="wrap after" style="margin-top:0"><a class="link" href="${url('tours', lang)}">${L('Visiter nos chalets à 360°', 'Tour our chalets in 360°')} ${arrow}</a><a class="cta" href="${url('contact', lang)}?sujet=projet#formulaire">${L('Parlons de votre chalet', 'Let’s talk about your chalet')} ${arrow}</a></div></section>`;
  return {
    key: 'work', path: routes.work, preloadSerif: false,
    title: L('Réalisations : chalets bois construits dans les Hautes-Alpes | Lombard & Vasina', 'Our work: timber chalets built in the Hautes-Alpes | Lombard & Vasina'),
    description: L('Photographies de chalets bois construits par Lombard & Vasina à Serre Chevalier, Montgenèvre, Vallouise et Puy-Saint-Vincent : extérieurs, intérieurs en mélèze, épicéa thermotraité et vieux bois.', 'Photographs of timber chalets built by Lombard & Vasina in Serre Chevalier, Montgenèvre, Vallouise and Puy-Saint-Vincent: exteriors, larch, thermo-treated spruce and reclaimed-wood interiors.'),
    og: sceneMeta('real-montgenevre')?.og,
    body, ld: [bc(lang, [[L('Réalisations', 'Our work'), routes.work[lang]]])],
  };
}

/* ---------------- Visites à 360° ---------------- */
export function toursPage(lang) {
  const L = (fr, en) => T(lang, fr, en);
  const body = head(lang, 'work', [[L('Réalisations', 'Our work'), url('work', lang)], [L('Visites à 360°', '360° tours')]], L('Visiter à 360°', 'Tour in 360°'),
    L('Dix chalets construits par nos équipes, à parcourir pièce par pièce. Chacun a été dessiné pour ceux qui l’habitent.', 'Ten chalets built by our teams, to explore room by room. Each was designed for the people who live in it.')) + `
<section class="section--tight"><div class="wrap"><ul class="list-rule">${tours.map((t) => `<li style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--s2);align-items:baseline"><div><span class="italic">${esc(t.name)}</span> <span class="small muted">${esc(t[lang])}</span></div><button class="link small" type="button" data-tour="https://www.klapty.com/tour/tunnel/${t.id}" data-title="${esc(t.name)}">${L('Ouvrir la visite', 'Open the tour')} ${arrow}</button></li>`).join('')}</ul>
<p class="notice small">${L('Les visites sont hébergées par Klapty et ne se chargent qu’à l’ouverture. Pour un chalet à vendre, la visite est envoyée sur demande.', 'Tours are hosted by Klapty and only load when opened. For a chalet for sale, the tour is sent on request.')}</p></div></section>`;
  const dialog = `<dialog class="tour-dialog" id="tour" aria-labelledby="tour-title"><header><h2 id="tour-title" class="small"></h2><button class="link small" type="button" data-close>${L('Fermer', 'Close')}</button></header><iframe title="" src="about:blank" allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer" loading="lazy"></iframe></dialog>`;
  return {
    key: 'work', path: routes.tours, preloadSerif: true, dialog,
    title: L('Visites virtuelles à 360° de chalets bois | Lombard & Vasina', '360° virtual tours of timber chalets | Lombard & Vasina'),
    description: L('Visitez à 360° dix chalets bois construits par Lombard & Vasina dans le Briançonnais : séjours cathédrale, mélèze, épicéa thermotraité.', 'Take a 360° tour of ten timber chalets built by Lombard & Vasina in the Briançonnais: cathedral living rooms, larch, thermo-treated spruce.'),
    body, ld: [bc(lang, [[L('Réalisations', 'Our work'), routes.work[lang]], [L('Visites à 360°', '360° tours'), routes.tours[lang]]])],
  };
}

/* ---------------- La maison ---------------- */
export function housePage(lang) {
  const L = (fr, en) => T(lang, fr, en);
  const body = head(lang, 'house', [[L('La maison', 'About us')]], L('Une famille,|une équipe de 40', 'A family,|a team of 40'),
    L('Lombard & Vasina construit des chalets dans le Grand Briançonnais depuis 1979, et nulle part ailleurs.', 'Lombard & Vasina has built chalets in the Grand Briançonnais since 1979, and nowhere else.')) + `
<section><div class="wrap"><div class="frame frame--pano">${still('bureau', lang, { cls: '', sizes: '100vw', lazy: false })}</div><p class="cote caption">${L('Nos bureaux, à Saint-Martin-de-Queyrières', 'Our offices in Saint-Martin-de-Queyrières')}</p></div></section>
<section class="section"><div class="wrap">
${lines(L('Une entreprise|d’avance', 'A company|ahead'), 'h2', 'h2')}
<ol class="timeline">${timeline.map((t) => `<li><b>${t.y}</b><span>${t[lang]}</span></li>`).join('')}</ol>
</div></section>
<section class="section surface"><div class="wrap grid split">
<div class="split__a">${lines(L('Trois métiers,|un seul lieu', 'Three trades,|one place'), 'h2', 'h2')}</div>
<div class="split__b body"><p>${L('Près de 40 personnes, toutes en interne : une dizaine au bureau d’études, trois à quatre techniciens et charpentiers à l’atelier, deux équipes de charpentiers poseurs et couvreurs sur le terrain.', 'Nearly 40 people, all in-house: around ten in the design office, three to four technicians and carpenters in the workshop, two teams of carpenter-fitters and roofers on site.')}</p>
<p>${L('Marielle, ingénieure en génie civil, et Mathieu ont rejoint leur père il y a une dizaine d’années et ont repris l’entreprise en 2021. Maurice reste présent pour transmettre.', 'Marielle, a civil engineer, and Mathieu joined their father about ten years ago and took over the company in 2021. Maurice stays on to pass on his know-how.')}</p></div>
</div>
<div class="wrap grid gallery">${fig('encre', lang)}${fig('levage', lang)}</div></section>
<section class="section"><div class="wrap"><figure class="grid quote">
<blockquote class="fade" lang="fr">« ${esc(quotes.dufour.text)} »</blockquote>
<figcaption class="small muted fade">${quotes.dufour.who}, ${quotes.dufour.when[lang]}</figcaption></figure>
<div class="after"><a class="link" href="${url('jobs', lang)}">${L('Nous rejoindre', 'Join us')} ${arrow}</a><a class="link" href="${url('press', lang)}">${L('On parle de nous', 'Press')} ${arrow}</a></div></div></section>`;
  return {
    key: 'house', path: routes.house, preloadSerif: false,
    title: L('Notre histoire : constructeur de chalets bois depuis 1979 | Lombard & Vasina', 'Our story: timber chalet builder since 1979 | Lombard & Vasina'),
    description: L('Depuis 1979 à Saint-Martin-de-Queyrières : la famille Lombard, 40 personnes en interne, la première K2 à commande numérique des Hautes-Alpes et un atelier de charpente de 1 300 m².', 'Since 1979 in Saint-Martin-de-Queyrières: the Lombard family, 40 people in-house, the first K2 CNC machine in the Hautes-Alpes and a 1,300 m² framing workshop.'),
    body, ld: [bc(lang, [[L('La maison', 'About us'), routes.house[lang]]])],
  };
}

/* ---------------- On parle de nous ---------------- */
const PRESS = [
  ['Architecture Bois', 'septembre–octobre 2025', 'September–October 2025'], ['Altus Serre Chevalier', '2025', '2025'],
  ['Architecture Bois', 'avril–mai 2025', 'April–May 2025'], ['Éco Maison Bois', 'avril–juin 2025', 'April–June 2025'],
  ['Éco Maison Bois', 'hiver 2025', 'winter 2025'], ['Maisons Côté Est', 'décembre 2024 – février 2025', 'December 2024 – February 2025'],
  ['Éco Maison Bois', 'septembre–novembre 2024', 'September–November 2024'], ['Éco Maison Bois', 'juin–août 2024', 'June–August 2024'],
  ['Le Dauphiné libéré', '28 mars 2024', '28 March 2024'], ['Altus', '2024', '2024'], ['Cosy Mountain, spécial chalets', '2024', '2024'],
  ['Cosy Mountain', 'été 2023', 'summer 2023'], ['Architecture Bois', 'janvier 2023', 'January 2023'], ['Plus2news, n° 113', 'été 2022', 'summer 2022'],
];
export function pressPage(lang) {
  const L = (fr, en) => T(lang, fr, en);
  const body = head(lang, 'house', [[L('La maison', 'About us'), url('house', lang)], [L('On parle de nous', 'Press')]], L('On parle de nous', 'In the press'),
    L('Reportages et parutions consacrés à nos chalets.', 'Features and articles about our chalets.')) + `
<section class="section--tight"><div class="wrap grid split">
<div class="split__a">${fig('presse-archibois', lang, '', '(min-width: 1024px) 40vw, 100vw')}</div>
<ul class="split__b list-rule">${PRESS.map(([t, fr, en]) => `<li style="display:flex;justify-content:space-between;gap:var(--s2)"><span class="italic">${t}</span><span class="small muted">${lang === 'en' ? en : fr}</span></li>`).join('')}</ul>
</div></section>
<section class="section"><div class="wrap">
<figure class="grid quote"><blockquote class="fade" lang="fr">« ${esc(quotes.dufour.text)} »</blockquote><figcaption class="small muted fade">${quotes.dufour.who}, ${quotes.dufour.when[lang]}</figcaption></figure>
<figure class="grid quote" style="margin-top:var(--s6)"><blockquote class="fade" lang="fr">« ${esc(quotes.andre.text)} »</blockquote><figcaption class="small muted fade">${quotes.andre.who}</figcaption></figure>
</div></section>`;
  return {
    key: 'house', path: routes.press, preloadSerif: true,
    title: L('Presse et avis clients | Chalets Lombard Vasina', 'Press and client reviews | Chalets Lombard Vasina'),
    description: L('Les chalets Lombard & Vasina dans Architecture Bois, Éco Maison Bois, Cosy Mountain, Altus et Le Dauphiné libéré, et la parole de nos clients.', 'Lombard & Vasina chalets in Architecture Bois, Éco Maison Bois, Cosy Mountain, Altus and Le Dauphiné libéré, and in our clients’ words.'),
    body, ld: [bc(lang, [[L('On parle de nous', 'Press'), routes.press[lang]]])],
  };
}

/* ---------------- Recrutement ---------------- */
export function jobsPage(lang) {
  const L = (fr, en) => T(lang, fr, en);
  const jobs = [[L('Menuisier poseur', 'Joiner-fitter')], [L('Charpentier poseur', 'Carpenter-fitter')], [L('Charpentier d’atelier', 'Workshop carpenter')]];
  const body = head(lang, 'house', [[L('La maison', 'About us'), url('house', lang)], [L('Recrutement', 'Careers')]], L('Construire avec nous', 'Build with us'),
    L('Une dizaine de personnes au bureau, une trentaine de charpentiers et menuisiers, un atelier lumineux de 1 300 m².', 'Around ten people in the office, some thirty carpenters and joiners, a light-filled 1,300 m² workshop.')) + `
<section class="section--tight"><div class="wrap grid split">
<div class="split__a"><h2 class="h3">${L('Postes ouverts', 'Open positions')}</h2></div>
<ul class="split__b list-rule">${jobs.map(([j]) => `<li>${j}</li>`).join('')}</ul>
</div><div class="wrap"><p class="notice small">${L('Candidatures et questions :', 'Applications and questions:')} <a class="link" href="mailto:${company.email}?subject=${encodeURIComponent(L('Candidature', 'Application'))}">${company.email}</a></p></div></section>`;
  return {
    key: 'house', path: routes.jobs,
    title: L('Recrutement : charpentiers et menuisiers à Briançon | Lombard & Vasina', 'Careers: carpenters and joiners near Briançon | Lombard & Vasina'),
    description: L('Lombard & Vasina recrute charpentiers et menuisiers à Saint-Martin-de-Queyrières, près de Briançon : atelier de 1 300 m², chantiers dans tout le Briançonnais.', 'Lombard & Vasina is hiring carpenters and joiners in Saint-Martin-de-Queyrières near Briançon: 1,300 m² workshop, sites across the Briançonnais.'),
    body, ld: [bc(lang, [[L('Recrutement', 'Careers'), routes.jobs[lang]]])],
  };
}

/* ---------------- Contact ---------------- */
export function contactPage(lang) {
  const L = (fr, en) => T(lang, fr, en);
  const body = head(lang, 'contact', [[L('Contact', 'Contact')]], L('Parlons de|votre chalet', 'Let’s talk about|your chalet'),
    L('Au téléphone, par écrit, ou chez nous à Saint-Martin-de-Queyrières.', 'By phone, in writing, or at our offices in Saint-Martin-de-Queyrières.')) + `
<section class="section--tight" id="formulaire"><div class="wrap grid split">
<div class="split__a">
<p class="h3"><a href="tel:${company.phoneHref}">${company.phone}</a></p>
<p class="h3" style="margin-top:var(--s1)"><a href="mailto:${company.email}">${company.email}</a></p>
<address class="small muted" style="font-style:normal;margin-top:var(--s4)">${company.street}<br>${company.postal} ${company.city}<br>Hautes-Alpes</address>
<p style="margin-top:var(--s3)"><a class="link small" href="${company.maps}" rel="noopener">${L('Itinéraire', 'Directions')} ${arrow}</a></p>
</div>
<form class="split__b form" name="contact" method="post" action="/merci/" data-netlify="true" data-prefill netlify-honeypot="adresse-web">
<input type="hidden" name="form-name" value="contact">
<p hidden><label>${L('Ne pas remplir', 'Do not fill')} <input name="adresse-web"></label></p>
<div class="row">
<label>${L('Votre demande', 'Your request')}<select name="sujet"><option value="plans">${L('Recevoir les plans d’un chalet à vendre', 'Receive the plans of a chalet for sale')}</option><option value="projet">${L('Faire construire un chalet', 'Build a chalet')}</option><option value="renovation">${L('Rénover ou agrandir', 'Renovate or extend')}</option><option value="autre">${L('Autre', 'Other')}</option></select></label>
<label>${L('Chalet', 'Chalet')}<select name="chalet"><option value="">—</option>${chalets.filter((c) => c.status === 'disponible').map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
</div>
<div class="row"><label>${L('Nom', 'Name')}<input name="nom" autocomplete="name" required></label><label>${L('Téléphone', 'Phone')}<input name="telephone" type="tel" autocomplete="tel"></label></div>
<label>${L('E-mail', 'Email')}<input name="email" type="email" autocomplete="email" required></label>
<label>${L('Votre projet, votre terrain, vos questions', 'Your project, your plot, your questions')}<textarea name="message"></textarea></label>
<p class="small muted">${L('Vos informations servent uniquement à vous recontacter au sujet de votre demande.', 'Your details are only used to get back to you about your request.')}</p>
<p><button class="cta" type="submit">${L('Envoyer', 'Send')} ${arrow}</button></p>
</form>
</div></section>`;
  return {
    key: 'contact', path: routes.contact,
    title: L('Contact : constructeur de chalets à Saint-Martin-de-Queyrières, près de Briançon | Lombard & Vasina', 'Contact: chalet builder in Saint-Martin-de-Queyrières near Briançon | Lombard & Vasina'),
    description: L('Contactez Lombard & Vasina : 04 92 21 29 19, contact@chalets-lombard.fr, 51 rue de la Rochette, 05120 Saint-Martin-de-Queyrières. Plans des chalets à vendre, projets sur mesure, rénovations.', 'Contact Lombard & Vasina: +33 4 92 21 29 19, contact@chalets-lombard.fr, 51 rue de la Rochette, 05120 Saint-Martin-de-Queyrières. Plans of chalets for sale, bespoke projects, renovations.'),
    body, ld: [bc(lang, [[L('Contact', 'Contact'), routes.contact[lang]]])],
  };
}

/* ---------------- Vallées ---------------- */
const VALLEY_TEXT = {
  'v-serre-chevalier': {
    h1: ['Constructeur de chalets bois|à Serre Chevalier', 'Timber chalet builder|in Serre Chevalier'],
    lead: ['Du Monêtier-les-Bains à Briançon, en passant par La Salle-les-Alpes, Chantemerle et Villard-Laté : nous y construisons et y vendons des chalets neufs.', 'From Le Monêtier-les-Bains to Briançon, through La Salle-les-Alpes, Chantemerle and Villard-Laté: we build and sell new chalets here.'],
    title: ['Chalet à vendre et constructeur de chalets bois à Serre Chevalier | Lombard & Vasina', 'Chalet for sale and timber chalet builder in Serre Chevalier | Lombard & Vasina'],
    desc: ['Chalets neufs à vendre au Monêtier-les-Bains et à La Salle-les-Alpes, chalets bois sur mesure à Serre Chevalier : Chantemerle, Saint-Chaffrey, Villard-Laté. Constructeur local depuis 1979.', 'New-build chalets for sale in Le Monêtier-les-Bains and La Salle-les-Alpes, bespoke timber chalets in Serre Chevalier: Chantemerle, Saint-Chaffrey, Villard-Laté. Local builder since 1979.'],
  },
  'v-briancon': {
    h1: ['Constructeur de chalets|et maisons bois à Briançon', 'Timber chalet and house|builder in Briançon'],
    lead: ['Notre siège et nos ateliers sont à Saint-Martin-de-Queyrières, à quelques minutes de Briançon. Nous construisons dans la ville et ses vallées : Clarée, Cerveyrette, Guisane.', 'Our head office and workshops are in Saint-Martin-de-Queyrières, a few minutes from Briançon. We build in the town and its valleys: the Clarée, the Cerveyrette, the Guisane.'],
    title: ['Constructeur de chalets et maisons bois à Briançon | Lombard & Vasina', 'Timber chalet and house builder in Briançon | Lombard & Vasina'],
    desc: ['Chalets et maisons bois sur mesure à Briançon, Val-des-Prés, Névache et Cervières, construits par Lombard & Vasina depuis 1979. Bureau d’études, atelier et charpentiers à Saint-Martin-de-Queyrières.', 'Bespoke timber chalets and houses in Briançon, Val-des-Prés, Névache and Cervières, built by Lombard & Vasina since 1979. Design office, workshop and carpenters in Saint-Martin-de-Queyrières.'],
  },
  'v-vallouise': {
    h1: ['Constructeur de chalets bois|à Vallouise-Pelvoux', 'Timber chalet builder|in Vallouise-Pelvoux'],
    lead: ['Dans le Pays des Écrins, au pied du Pelvoux : des chalets en bois massif dessinés pour la pente, la neige et la vue.', 'In the Pays des Écrins, below the Pelvoux: solid timber chalets designed for the slope, the snow and the view.'],
    title: ['Constructeur de chalets bois à Vallouise-Pelvoux | Lombard & Vasina', 'Timber chalet builder in Vallouise-Pelvoux | Lombard & Vasina'],
    desc: ['Chalets bois sur mesure à Vallouise, Pelvoux, Les Vigneaux et Puy-Saint-Vincent, dans le Pays des Écrins. Lombard & Vasina, constructeur local depuis 1979.', 'Bespoke timber chalets in Vallouise, Pelvoux, Les Vigneaux and Puy-Saint-Vincent, in the Pays des Écrins. Lombard & Vasina, local builder since 1979.'],
  },
  'v-puy-saint-vincent': {
    h1: ['Chalet neuf et construction|à Puy-Saint-Vincent', 'New-build chalet and construction|in Puy-Saint-Vincent'],
    lead: ['La Rouya, secteur des Alberts, à cinq minutes des pistes ; et des chalets sur mesure dans toute la station.', 'La Rouya, in Les Alberts, five minutes from the slopes; and bespoke chalets across the resort.'],
    title: ['Chalet neuf à vendre et constructeur à Puy-Saint-Vincent | Lombard & Vasina', 'New-build chalet for sale and builder in Puy-Saint-Vincent | Lombard & Vasina'],
    desc: ['La Rouya, chalet neuf de 167 m² à vendre à Puy-Saint-Vincent sur un terrain de 1 243 m², et construction de chalets bois sur mesure dans la station. Lombard & Vasina depuis 1979.', 'La Rouya, a new 167 m² chalet for sale in Puy-Saint-Vincent on a 1,243 m² plot, and bespoke timber chalets across the resort. Lombard & Vasina since 1979.'],
  },
  'v-montgenevre': {
    h1: ['Constructeur de chalets bois|à Montgenèvre', 'Timber chalet builder|in Montgenèvre'],
    lead: ['À la frontière, face aux pistes : des chalets en mélèze, des agencements en vieux bois, des terrasses au soleil.', 'On the border, facing the slopes: larch chalets, reclaimed-wood fittings, sunny terraces.'],
    title: ['Constructeur de chalets bois à Montgenèvre | Lombard & Vasina', 'Timber chalet builder in Montgenèvre | Lombard & Vasina'],
    desc: ['Chalets bois sur mesure à Montgenèvre, face aux pistes : construction, agencements intérieurs et rénovation par Lombard & Vasina, constructeur du Briançonnais depuis 1979.', 'Bespoke timber chalets in Montgenèvre, facing the slopes: construction, interior fittings and renovation by Lombard & Vasina, Briançonnais builder since 1979.'],
  },
};
export function valleyPage(v, lang) {
  const L = (fr, en) => T(lang, fr, en);
  const tx = VALLEY_TEXT[v.key];
  const i = lang === 'en' ? 1 : 0;
  const sale = v.sale.map((id) => chalets.find((c) => c.id === id));
  const body = head(lang, v.key, [[v.name]], tx.h1[i], tx.lead[i]) + `
${v.scene ? `<section><div class="frame frame--pano">${scene(v.scene, lang, { lazy: false, alt: L(`Paysage et chalet, ${v.name}`, `Landscape and chalet, ${v.name}`) })}</div></section>` : ''}
<section class="section--tight"><div class="wrap">
<div class="grid gallery">${v.images.map((id, k) => fig(id, lang, v.images.length === 3 && k === 0 ? 'g-wide' : '', '(min-width: 768px) 50vw, 100vw')).join('')}</div>
</div></section>
${sale.length ? `<section class="section surface"><div class="wrap"><h2 class="h3">${L('Chalets neufs à vendre', 'New-build chalets for sale')}</h2><ul class="list-rule" style="margin-top:var(--s4)">${sale.map((o) => `<li style="display:flex;justify-content:space-between;gap:var(--s2);align-items:baseline"><a href="${o.route[lang]}"><span class="italic">${esc(o.name)}</span> <span class="small muted">${esc(o.village)}</span></a>${stateHTML(o, lang)}</li>`).join('')}</ul></div></section>` : ''}
<section class="section"><div class="wrap grid split">
<div class="split__a"><h2 class="h3">${L('Villages', 'Villages')}</h2></div>
<p class="split__b body">${v.villages.join(' · ')}</p>
</div><div class="wrap after"><a class="cta" href="${url('contact', lang)}?sujet=projet#formulaire">${L('Parlons de votre chalet', 'Let’s talk about your chalet')} ${arrow}</a></div></section>`;
  return {
    key: v.key, path: routes[v.key], preloadSerif: sale.length > 0,
    title: tx.title[i], description: tx.desc[i],
    og: v.scene ? sceneMeta(v.scene)?.og : undefined,
    body, ld: [bc(lang, [[v.name, routes[v.key][lang]]])],
  };
}

/* ---------------- Mentions légales, cookies, 404 ---------------- */
export function legalPage(lang) {
  const L = (fr, en) => T(lang, fr, en);
  const body = head(lang, 'legal', [[L('Mentions légales', 'Legal notice')]], L('Mentions légales', 'Legal notice'), '') + `
<section class="section--tight"><div class="wrap grid split"><div class="split__a"></div><div class="split__b body">
<h2 class="h3">${L('Éditeur', 'Publisher')}</h2>
<p>LOMBARD ET VASINA, SAS, ${L('immatriculée au RCS de Gap sous le numéro', 'registered with the Gap trade register under number')} B 316 141 019.<br>${company.street}, ${company.postal} ${company.city}.<br>${L('Téléphone', 'Phone')} : ${company.phone} — ${company.email}</p>
<p>${L('Directeur de la publication : à confirmer par l’entreprise.', 'Publication director: to be confirmed by the company.')}</p>
<h2 class="h3" style="margin-top:var(--s5)">${L('Hébergement', 'Hosting')}</h2>
<p>${L('À renseigner à la mise en ligne (raison sociale, adresse et téléphone de l’hébergeur).', 'To be completed at launch (host’s company name, address and phone).')}</p>
<h2 class="h3" style="margin-top:var(--s5)">${L('Photographies', 'Photography')}</h2>
<p>${L('Lombard & Vasina et Alpesphotographies.com. Les vues 3D sont signalées comme telles et ne sont pas contractuelles. Aucune image de banque d’images.', 'Lombard & Vasina and Alpesphotographies.com. 3D views are marked as such and are not contractually binding. No stock photography.')}</p>
<h2 class="h3" style="margin-top:var(--s5)">${L('Carte', 'Map')}</h2>
<p>${L('Tracé des rivières : © contributeurs OpenStreetMap, licence ODbL.', 'River lines: © OpenStreetMap contributors, ODbL licence.')}</p>
<h2 class="h3" style="margin-top:var(--s5)">${L('Propriété intellectuelle', 'Intellectual property')}</h2>
<p>${L('Les textes, images, dessins et éléments graphiques du site sont la propriété de Lombard & Vasina ou de leurs auteurs. Toute reproduction sans autorisation est interdite (articles L.335-2 et suivants du Code de la propriété intellectuelle).', 'The texts, images, drawings and graphic elements of this site belong to Lombard & Vasina or their authors. Any reproduction without permission is prohibited (articles L.335-2 et seq. of the French Intellectual Property Code).')}</p>
<h2 class="h3" style="margin-top:var(--s5)">${L('Données personnelles', 'Personal data')}</h2>
<p>${L('Les informations du formulaire de contact servent uniquement à répondre à votre demande, conformément au règlement (UE) 2016/679 et à la loi Informatique et Libertés. Vous pouvez demander leur accès, leur rectification ou leur suppression à', 'Contact form details are only used to answer your request, in accordance with Regulation (EU) 2016/679 and the French Data Protection Act. You may request access, correction or deletion at')} ${company.email}.</p>
</div></div></section>`;
  return { key: 'legal', path: routes.legal, title: L('Mentions légales | Chalets Lombard Vasina', 'Legal notice | Chalets Lombard Vasina'), description: L('Mentions légales du site de Chalets Lombard Vasina, constructeur de chalets bois à Saint-Martin-de-Queyrières.', 'Legal notice for the Chalets Lombard Vasina website, timber chalet builder in Saint-Martin-de-Queyrières.'), body, ld: [] };
}
export function cookiesPage(lang) {
  const L = (fr, en) => T(lang, fr, en);
  const body = head(lang, 'cookies', [[L('Cookies', 'Cookies')]], L('Cookies', 'Cookies'), '') + `
<section class="section--tight"><div class="wrap grid split"><div class="split__a"></div><div class="split__b body">
<p>${L('Ce site ne dépose aucun cookie de mesure d’audience ni de publicité. Il ne charge aucun service tiers à l’ouverture d’une page.', 'This site sets no analytics or advertising cookies. It loads no third-party service when a page opens.')}</p>
<p>${L('Les visites à 360° (Klapty) et l’itinéraire (Google Maps) ne s’ouvrent qu’à votre demande ; ces services peuvent alors déposer leurs propres cookies.', 'The 360° tours (Klapty) and directions (Google Maps) only open when you ask; those services may then set their own cookies.')}</p>
</div></div></section>`;
  return { key: 'cookies', path: routes.cookies, title: L('Politique de cookies | Chalets Lombard Vasina', 'Cookie policy | Chalets Lombard Vasina'), description: L('Ce site ne dépose aucun cookie de mesure d’audience ni de publicité.', 'This site sets no analytics or advertising cookies.'), body, ld: [] };
}
export function notFound(lang) {
  const L = (fr, en) => T(lang, fr, en);
  const body = `<section class="page-head" style="min-height:70vh"><div class="wrap grid">${lines(L('Ce sentier|ne mène nulle part', 'This path|leads nowhere'), 'h1', 'display')}<p class="lead fade">${L('La page demandée n’existe pas ou a changé d’adresse.', 'The page you asked for does not exist or has moved.')}</p><p class="fade" style="grid-column:1/-1;display:flex;gap:var(--s4);flex-wrap:wrap"><a class="link" href="${url('home', lang)}">${L('Accueil', 'Home')} ${arrow}</a><a class="link" href="${url('sale', lang)}">${L('Chalets à vendre', 'Chalets for sale')} ${arrow}</a></p></div></section>`;
  return { key: '404', path: { fr: '/404.html', en: '/en/404.html' }, title: L('Page introuvable | Lombard & Vasina', 'Page not found | Lombard & Vasina'), description: L('Page introuvable.', 'Page not found.'), body, ld: [], noindex: true };
}
export function thanksPage(lang) {
  const L = (fr, en) => T(lang, fr, en);
  const body = `<section class="page-head" style="min-height:70vh"><div class="wrap grid">${lines(L('Merci,|à très vite', 'Thank you,|speak soon'), 'h1', 'display')}<p class="lead fade">${L('Votre message est bien parti. Nous vous rappelons rapidement.', 'Your message is on its way. We will get back to you shortly.')}</p></div></section>`;
  return { key: 'thanks', path: { fr: '/merci/', en: '/en/merci/' }, title: L('Merci | Lombard & Vasina', 'Thank you | Lombard & Vasina'), description: L('Message envoyé.', 'Message sent.'), body, ld: [], noindex: true };
}
