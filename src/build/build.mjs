// Générateur du site statique : node src/build/build.mjs  ->  site/
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';
import { transform } from 'lightningcss';
import { routes, chalets, valleys, redirects, SITE } from './data.mjs';
import { loadManifests } from './ui.mjs';
import { layout } from './layout.mjs';
import { home } from './pages/home.mjs';
import { salePage, chaletPage } from './pages/sale.mjs';
import { buildPage, renoPage, workPage, toursPage, housePage, pressPage, jobsPage, contactPage, valleyPage, legalPage, cookiesPage, notFound, thanksPage } from './pages/other.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'site');
const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);
const write = (p, s) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s); };

// --- nettoyage des anciennes sorties HTML / CSS / JS (les images générées sont conservées)
for (const d of ['assets/css', 'assets/js']) rmSync(join(OUT, d), { recursive: true, force: true });

// --- favicon
copyFileSync(join(SRC, 'favicon.svg'), join(OUT, 'favicon.svg'));

// --- polices
mkdirSync(join(OUT, 'assets/fonts'), { recursive: true });
for (const f of readdirSync(join(SRC, 'fonts'))) copyFileSync(join(SRC, 'fonts', f), join(OUT, 'assets/fonts', f));

// --- CSS (minifiée, empreinte de cache)
const css = transform({ filename: 'site.css', code: readFileSync(join(SRC, 'css/site.css')), minify: true, targets: { chrome: 100 << 16, safari: (15 << 16) | (4 << 8), firefox: 100 << 16 } }).code;
const cssName = `/assets/css/site.${hash(css)}.css`;
write(join(OUT, cssName), css);

// --- JS
const vend = (f) => { const b = readFileSync(join(SRC, 'js/vendor', f)); const n = `/assets/js/${f.replace('.min.js', '')}.${hash(b)}.js`; write(join(OUT, n), b); return n; };
const gsap = vend('gsap.min.js'), st = vend('ScrollTrigger.min.js'), lenis = vend('lenis.min.js');
const mainMin = (await minify(readFileSync(join(SRC, 'js/main.js'), 'utf8'), { compress: { passes: 2 }, mangle: true, format: { comments: false } })).code;
const jsName = `/assets/js/main.${hash(mainMin)}.js`;
write(join(OUT, jsName), mainMin);
const assets = { css: cssName, js: jsName, gsap, st, lenis };

// --- manifestes d'images et carte
loadManifests(OUT);
const map = JSON.parse(readFileSync(join(SRC, 'build/map.json'), 'utf8'));

// --- pages
const pages = [];
for (const lang of ['fr', 'en']) {
  pages.push([lang, home(lang, { map })]);
  pages.push([lang, salePage(lang)]);
  for (const c of chalets) pages.push([lang, chaletPage(c, lang)]);
  pages.push([lang, buildPage(lang)], [lang, renoPage(lang)], [lang, workPage(lang)], [lang, toursPage(lang)], [lang, housePage(lang)],
    [lang, pressPage(lang)], [lang, jobsPage(lang)], [lang, contactPage(lang)], [lang, legalPage(lang)], [lang, cookiesPage(lang)],
    [lang, notFound(lang)], [lang, thanksPage(lang)]);
  for (const v of valleys) pages.push([lang, valleyPage(v, lang)]);
}
const sitemap = [];
for (const [lang, p] of pages) {
  let html = layout(p, lang, assets);
  if (p.noindex) html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex">');
  if (lang === 'en') html = html.replace('action="/merci/"', 'action="/en/merci/"');
  const rel = p.path[lang];
  const file = rel.endsWith('.html') ? join(OUT, rel) : join(OUT, rel, 'index.html');
  write(file, html);
  if (!p.noindex && lang === 'fr') sitemap.push(p.path);
}

// --- plan du site avec alternatives linguistiques
const today = new Date().toISOString().slice(0, 10);
write(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemap.flatMap((p) => ['fr', 'en'].map((l) => `<url><loc>${SITE}${p[l]}</loc><lastmod>${today}</lastmod><xhtml:link rel="alternate" hreflang="fr" href="${SITE}${p.fr}"/><xhtml:link rel="alternate" hreflang="en" href="${SITE}${p.en}"/><xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${p.fr}"/></url>`)).join('\n')}
</urlset>
`);
write(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

// --- redirections 301 : Netlify, Vercel, Apache
write(join(OUT, '_redirects'), redirects.map(([a, b]) => `${a} ${b} 301\n${a.replace(/\/$/, '')} ${b} 301`).join('\n') + '\n/en/* /en/404.html 404\n/* /404.html 404\n');
write(join(OUT, '_headers'), `/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
write(join(ROOT, 'vercel.json'), JSON.stringify({
  outputDirectory: 'site', cleanUrls: false, trailingSlash: true,
  redirects: redirects.map(([source, destination]) => ({ source, destination, permanent: true })),
  headers: [{ source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }],
}, null, 2) + '\n');
write(join(OUT, '.htaccess'), `# Redirections 301 (audit SEO)\nRewriteEngine On\n${redirects.map(([a, b]) => `RewriteRule ^${a.replace(/^\//, '').replace(/\/$/, '')}/?$ ${b} [R=301,L]`).join('\n')}\nErrorDocument 404 /404.html\n<IfModule mod_expires.c>\n  ExpiresActive On\n  ExpiresByType image/avif "access plus 1 year"\n  ExpiresByType image/webp "access plus 1 year"\n  ExpiresByType font/woff2 "access plus 1 year"\n  ExpiresByType text/css "access plus 1 year"\n  ExpiresByType application/javascript "access plus 1 year"\n</IfModule>\n`);

console.log(`${pages.length} pages · css ${css.length} o · js ${mainMin.length} o`);
