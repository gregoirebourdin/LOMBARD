// Relecture automatique du site généré : node tools/check.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'site';
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? (f !== 'assets' && walk(p)) : f.endsWith('.html') && files.push(p); });
walk(ROOT);
let errors = 0;
const err = (m) => { errors++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
const text = (h) => strip(h).replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&[a-z]+;/g, ' ');
const words = (t) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));

// 1. Mots de la page d'accueil (contenu principal, hors en-tête, menu et pied de page)
for (const f of ['site/index.html', 'site/en/index.html']) {
  const h = readFileSync(f, 'utf8');
  const main = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
  const mapIdx = main.indexOf('<svg viewBox="-60');
  const mapText = mapIdx > 0 ? main.slice(mapIdx, main.indexOf('</svg>', mapIdx)) : '';
  const all = words(text(main)).length;
  const map = words(text(mapText)).length;
  console.log(`\n${f} : ${all} mots dans <main> (dont ${map} noms de lieux sur la carte), ${all - map} hors carte`);
  (all - map >= 250 && all - map <= 350) ? ok('entre 250 et 350 mots') : err('hors de la fourchette 250-350');
  // titres courts (8 mots max) et phrases (25 mots max)
  for (const m of main.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/g)) { const n = words(text(m[1])).length; if (n > 8) err(`titre de ${n} mots : ${text(m[1]).trim().slice(0, 60)}`); }
  for (const m of main.matchAll(/<p class="lead[^"]*">([\s\S]*?)<\/p>/g)) { const n = words(text(m[1])).length; if (n > 25) err(`phrase de ${n} mots`); }
  const ctas = (main.match(/class="cta"/g) || []).length;
  ctas <= 2 ? ok(`${ctas} invitations à l'action`) : err(`${ctas} invitations à l'action`);
}

// 2. Toutes les pages
console.log(`\n${files.length} pages`);
const ids = new Set();
let draws = 0, curtains = 0;
const forbidden = [/d[’']exception/i, /extraordinaire/i, /\bEn savoir plus\b/, /\bDécouvrir\b/, /\bDéfiler\b/, /\b0\d —/, /crées\b/];
for (const f of files) {
  const h = readFileSync(f, 'utf8');
  const lang = (h.match(/<html lang="(\w+)"/) || [])[1];
  if (!/<title>[^<]{10,}<\/title>/.test(h)) err(`${f} : titre manquant`);
  if (!/<meta name="description" content="[^"]{50,}"/.test(h) && !f.includes('404') && !f.includes('merci')) err(`${f} : description manquante ou courte`);
  const hl = [...h.matchAll(/hreflang="(fr|en|x-default)" href="([^"]+)"/g)].map((m) => m[1]);
  if (!(hl.includes('fr') && hl.includes('en') && hl.includes('x-default'))) err(`${f} : hreflang incomplet`);
  if ((h.match(/<h1[\s>]/g) || []).length !== 1) err(`${f} : ${(h.match(/<h1[\s>]/g) || []).length} h1`);
  for (const m of h.matchAll(/<img [^>]*>/g)) {
    const alt = (m[0].match(/alt="([^"]*)"/) || [])[1];
    if (alt === undefined) err(`${f} : image sans attribut alt`);
  }
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); } catch { err(`${f} : JSON-LD invalide`); } }
  for (const m of h.matchAll(/href="(\/[^"#?]*)/g)) {
    const u = m[1]; if (u.startsWith('/assets/')) continue;
    const p = u.endsWith('/') ? join(ROOT, u, 'index.html') : join(ROOT, u);
    if (!existsSync(p)) err(`${f} : lien interne cassé ${u}`);
  }
  for (const m of h.matchAll(/(?:src|srcset)="([^"]+)"/g)) for (const part of m[1].split(',')) {
    const u = part.trim().split(' ')[0]; if (!u.startsWith('/assets/')) continue;
    if (!existsSync(join(ROOT, u))) err(`${f} : ressource manquante ${u}`);
  }
  const body = text(h.slice(h.indexOf('<body'), h.indexOf('</body>')));
  for (const re of forbidden) if (re.test(body)) err(`${f} : formulation à éviter ${re}`);
  if (/unique/i.test(body) && lang === 'fr') console.log(`  · ${f} : « unique » présent (vérifier le sens)`);
  draws += (h.match(/data-draw/g) || []).length;
  curtains += (h.match(/class="curtain /g) || []).length;
}
console.log(`\nTraits dessinés : ${draws / 2} par langue (max 2) · rideaux : ${curtains / 2} par langue (max 3)`);
if (draws / 2 > 2) err('trop de traits dessinés'); if (curtains / 2 > 3) err('trop de rideaux');

console.log(errors ? `\n${errors} problème(s)` : '\nAucun problème');
process.exit(errors ? 1 : 0);
