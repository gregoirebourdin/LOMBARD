import { company, routes, SITE, valleys } from './data.mjs';
import { esc, T, url, orgGraph } from './ui.mjs';

const NAV = [
  ['sale', 'Chalets à vendre', 'Chalets for sale'],
  ['build', 'Construire', 'Build'],
  ['work', 'Réalisations', 'Our work'],
  ['house', 'La maison', 'About us'],
  ['contact', 'Contact', 'Contact'],
];

export function layout(page, lang, assets) {
  const other = lang === 'fr' ? 'en' : 'fr';
  const self = page.path[lang];
  const alt = page.path[other];
  const graph = [orgGraph(lang), ...(page.ld || [])];
  graph.push({
    '@type': 'WebPage', '@id': `${SITE}${self}#webpage`, url: `${SITE}${self}`, name: page.title, description: page.description,
    inLanguage: lang === 'fr' ? 'fr-FR' : 'en-GB', isPartOf: { '@id': `${SITE}/#website` }, about: { '@id': `${SITE}/#organization` },
  });
  graph.push({ '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: company.name, publisher: { '@id': `${SITE}/#organization` }, inLanguage: ['fr-FR', 'en-GB'] });
  const og = page.og || '/assets/scenes/ouverture/og.jpg';
  return `<!doctype html>
<html lang="${lang === 'fr' ? 'fr' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script>document.documentElement.classList.add("js");setTimeout(function(){if(!window.__lv)document.documentElement.classList.add("is-static")},2500)</script>
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${SITE}${self}">
<link rel="alternate" hreflang="fr" href="${SITE}${page.path.fr}">
<link rel="alternate" hreflang="en" href="${SITE}${page.path.en}">
<link rel="alternate" hreflang="x-default" href="${SITE}${page.path.fr}">
<meta name="theme-color" content="#f8f6f1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(company.name)}">
<meta property="og:locale" content="${lang === 'fr' ? 'fr_FR' : 'en_GB'}">
<meta property="og:locale:alternate" content="${lang === 'fr' ? 'en_GB' : 'fr_FR'}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${SITE}${self}">
<meta property="og:image" content="${SITE}${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/host-grotesk-var-latin.woff2" as="font" type="font/woff2" crossorigin>
${page.preloadSerif ? '<link rel="preload" href="/assets/fonts/newsreader-italic-latin.woff2" as="font" type="font/woff2" crossorigin>\n' : ''}${page.preload || ''}
<link rel="stylesheet" href="${assets.css}">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>
</head>
<body>
<a class="skip" href="#contenu">${T(lang, 'Aller au contenu', 'Skip to content')}</a>
${header(page, lang, alt)}
<main id="contenu">
${page.body}
</main>
${footer(lang, page)}
${page.dialog || ''}
<script src="${assets.gsap}" defer></script>
<script src="${assets.st}" defer></script>
<script src="${assets.lenis}" defer></script>
<script src="${assets.js}" defer></script>
</body>
</html>`;
}

function header(page, lang, altPath) {
  const cur = page.key;
  const link = ([k, fr, en]) => `<a href="${url(k, lang)}"${cur === k ? ' aria-current="page"' : ''}>${T(lang, fr, en)}</a>`;
  return `<header class="header"${page.key === 'home' ? ' data-solid-from' : ''}>
<div class="wrap">
<a class="wordmark" href="${url('home', lang)}" aria-label="${esc(company.name)}, ${T(lang, 'accueil', 'home')}">Lombard &amp; Vasina <small>${T(lang, 'Chalets depuis 1979', 'Chalets since 1979')}</small></a>
<nav class="nav" aria-label="${T(lang, 'Navigation principale', 'Main navigation')}">
${NAV.map(link).join('\n')}
<a class="tel" href="tel:${company.phoneHref}">${company.phone.replace(/ /g, '\u00a0')}</a>
<a class="lang" href="${altPath}" hreflang="${lang === 'fr' ? 'en' : 'fr'}" lang="${lang === 'fr' ? 'en' : 'fr'}">${lang === 'fr' ? 'EN' : 'FR'}<span class="sr-only">${lang === 'fr' ? ' — English version' : ' — version française'}</span></a>
</nav>
<button class="menu-btn" type="button" data-menu="open" aria-expanded="false" aria-controls="menu">${T(lang, 'Menu', 'Menu')}</button>
</div>
</header>
<div class="menu" id="menu" aria-hidden="true">
<button class="menu__close" type="button" data-menu="close">${T(lang, 'Fermer', 'Close')}</button>
<nav aria-label="${T(lang, 'Navigation principale', 'Main navigation')}">
<a href="${url('home', lang)}">${T(lang, 'Accueil', 'Home')}</a>
${NAV.map(link).join('\n')}
</nav>
<div class="menu__foot small">
<a href="tel:${company.phoneHref}">${company.phone}</a>
<a href="mailto:${company.email}">${company.email}</a>
<a href="${altPath}" hreflang="${lang === 'fr' ? 'en' : 'fr'}">${lang === 'fr' ? 'English' : 'Français'}</a>
</div>
</div>`;
}

function footer(lang, page) {
  const vl = valleys.map((v) => `<a href="${url(v.key, lang)}">${T(lang, `Chalets bois ${v.name === 'Briançon' ? 'à' : v.name === 'Serre Chevalier' ? 'à' : 'à'} ${v.name}`, `Timber chalets in ${v.name}`)}</a>`).join('');
  return `<footer class="footer">
<div class="wrap">
<div class="grid">
<div class="footer__lead">
<p class="h2">${T(lang, 'Le constructeur de votre vallée.', 'The builder of your valley.')}</p>
</div>
<div class="footer__col footer__col--first">
<h2>${T(lang, 'Siège et ateliers', 'Head office and workshops')}</h2>
<address style="font-style:normal">${company.street}<br>${company.postal} ${company.city}</address>
<a href="tel:${company.phoneHref}">${company.phone}</a>
<a href="mailto:${company.email}">${company.email}</a>
<a href="${company.maps}" rel="noopener">${T(lang, 'Itinéraire', 'Directions')}</a>
</div>
<div class="footer__col">
<h2>${T(lang, 'Nos vallées', 'Our valleys')}</h2>
${vl}
</div>
<div class="footer__col">
<h2>${T(lang, 'Le site', 'Site')}</h2>
<a href="${url('sale', lang)}">${T(lang, 'Chalets à vendre', 'Chalets for sale')}</a>
<a href="${url('build', lang)}">${T(lang, 'Construire sur mesure', 'Bespoke build')}</a>
<a href="${url('reno', lang)}">${T(lang, 'Rénovation et extension', 'Renovation and extension')}</a>
<a href="${url('work', lang)}">${T(lang, 'Réalisations', 'Our work')}</a>
<a href="${url('tours', lang)}">${T(lang, 'Visites à 360°', '360° tours')}</a>
<a href="${url('house', lang)}">${T(lang, 'La maison', 'About us')}</a>
<a href="${url('press', lang)}">${T(lang, 'On parle de nous', 'Press')}</a>
<a href="${url('jobs', lang)}">${T(lang, 'Recrutement', 'Careers')}</a>
</div>
<div class="footer__col">
<h2>${T(lang, 'Ailleurs', 'Elsewhere')}</h2>
${company.socials.map((s) => `<a href="${s.url}" rel="noopener">${s.name}</a>`).join('')}
</div>
</div>
<div class="footer__base">
<span>© ${new Date().getFullYear()} ${company.name} — ${T(lang, 'constructeur de chalets bois depuis 1979', 'timber chalet builder since 1979')}</span>
<span>${T(lang, 'Photographies : Lombard & Vasina et Alpesphotographies.com', 'Photography: Lombard & Vasina and Alpesphotographies.com')}</span>
<span><a href="${url('legal', lang)}">${T(lang, 'Mentions légales', 'Legal notice')}</a> · <a href="${url('cookies', lang)}">${T(lang, 'Cookies', 'Cookies')}</a></span>
</div>
</div>
</footer>`;
}
