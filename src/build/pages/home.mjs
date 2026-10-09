import { chalets, quotes, routes, company } from '../data.mjs';
import { T, esc, url, lines, scene, still, factsOf, stateHTML, fermeSVG, mapSVG, preloadScene, sceneMeta, listingLD } from '../ui.mjs';

const arrow = '<span class="arrow" aria-hidden="true">→</span>';
const down = '<span class="arrow" aria-hidden="true">↓</span>';

export function home(lang, ctx) {
  const L = (fr, en) => T(lang, fr, en);
  const available = chalets.filter((c) => c.status === 'disponible');
  const sold = chalets.filter((c) => c.status === 'vendu');

  const hero = `
<section class="hero" aria-labelledby="h1">
  <div class="hero__track">
    <div class="hero__sticky">
      <div class="hero__frame">
        ${scene('ouverture', lang, { flow: false, lazy: false, priority: true, alt: L('Chalet en bois massif dans la neige à Puy-Saint-Vincent, village et sommets des Écrins sous un ciel d’hiver clair', 'Solid timber chalet in the snow at Puy-Saint-Vincent, with the village and Écrins peaks under a clear winter sky') })}
      </div>
      <div class="hero__intro">
        <div class="wrap grid">
          ${lines(L('Acheter ou construire|votre chalet dans le Briançonnais', 'Buy or build|your chalet in the Briançonnais'), 'h1', 'display hero__title', 'id="h1"')}
          <div class="hero__aside">
            <p class="lead fade">${L('Des chalets neufs vendus sur plan dans les plus beaux villages, ou dessinés pour votre terrain. En bois massif, depuis 1979.', 'New-build chalets sold off-plan in the finest villages, or designed for your own plot. In solid timber, since 1979.')}</p>
            <p class="hero__entries fade"><a class="link" href="#a-vendre">${L('Les chalets à vendre', 'Chalets for sale')} ${down}</a><a class="link" href="#construire">${L('Faire construire le vôtre', 'Build your own')} ${down}</a></p>
          </div>
        </div>
      </div>
      <p class="hero__caption caption">${L('Réalisation à Puy-Saint-Vincent', 'Built in Puy-Saint-Vincent')}</p>
    </div>
  </div>
  <script>(function(h){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var f=h.querySelector('.hero__frame'),s=f.querySelector('.scene'),i=h.querySelector('.hero__intro');var g=window.__heroGeom=function(){var W=innerWidth,H=innerHeight,mob=matchMedia('(max-width: 767px)').matches,st=s.querySelector(mob?'.scene__stage--m':'.scene__stage--d'),A=parseFloat(st&&st.dataset.aspect)||1.5,m=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--margin'))||16,t=Math.min(i.offsetHeight+(mob?24:40),H*.62),sx=(W-2*m)/W,sy=(H-t-m)/H,dy=-m,Wp=Math.max(W,H*A),Hp=Wp/A,X0=(W-Wp)/2,Y0=(H-Hp)/2,ww=sx*W,wh=sy*H,wx=(W-ww)/2,wy=H+dy-wh,u=Math.max(ww/Wp,wh/Hp),wx0=wx+(ww-u*Wp)/2,wy0=wy+(wh-u*Hp)*.42;return{sx:sx,sy:sy,dy:dy,box:[X0,Y0,Wp,Hp],kx:u/sx,ky:u/sy,tx:(wx0-W/2*(1-sx))/sx-X0,ty:(wy0-H-dy+sy*H)/sy-Y0}};window.__heroBox=function(r){s.style.left=r.box[0]+'px';s.style.top=r.box[1]+'px';s.style.width=r.box[2]+'px';s.style.height=r.box[3]+'px'};var r=g();window.__heroBox(r);s.style.transformOrigin='0 0';s.style.transform='translate3d('+r.tx+'px,'+r.ty+'px,0) scale('+r.kx+','+r.ky+')';f.style.transform='translate3d(0,'+r.dy+'px,0) scale('+r.sx+','+r.sy+')'})(document.currentScript.parentNode)</script>
</section>`;

  const listing = (c) => `
<article class="listing" aria-labelledby="c-${c.id}">
  <div class="grid listing__head">
    <h3 class="listing__title" id="c-${c.id}"><a href="${c.route[lang]}"><span class="name">${esc(c.name)}</span></a></h3>
    <p class="listing__where where small"><b>${esc(c.locality[lang])}</b><span class="muted">${esc(c.village)}</span></p>
  </div>
  <a href="${c.route[lang]}" class="frame frame--pano" aria-label="${esc(c.name)}" tabindex="-1">${scene(c.scene, lang, { alt: c.caption[lang] + ' — ' + c.name })}</a>
  <p class="cote caption">${esc(c.short[lang])}</p>
  ${factsOf(c, lang, { compact: true })}
</article>`;

  const vitrine = `
<section class="section" id="a-vendre" aria-labelledby="t-vente">
  <div class="wrap">
    <div class="grid intro">
      ${lines(L('Chalets neufs,|vendus sur plan', 'New-build chalets,|sold off-plan'), 'h2', 'h2', 'id="t-vente"')}
      <p class="lead fade">${L('Des terrains choisis pour leur exposition, leur vue et la proximité des pistes ; des chalets personnalisés avec vous.', 'Plots chosen for their aspect, their view and their closeness to the slopes; chalets tailored with you.')}</p>
    </div>
    ${available.map(listing).join('')}
    <div class="sold">
      <h3 class="small muted">${L('Récemment vendus', 'Recently sold')}</h3>
      <div class="grid sold__list">
        ${sold.map((c) => `<a class="sold__item" href="${c.route[lang]}">${sceneStill(c.scene, lang, c.caption[lang] + ' — ' + c.name)}<div class="sold__meta"><span class="name">${esc(c.name)}</span>${stateHTML(c, lang)}</div><span class="small muted">${esc(c.village)}</span></a>`).join('')}
      </div>
    </div>
    <div class="after"><a class="cta" href="${url('contact', lang)}?sujet=plans#formulaire">${L('Recevoir les plans', 'Receive the plans')} ${arrow}</a></div>
  </div>
</section>`;

  const territoire = `
<div class="curtain curtain--branch" aria-hidden="true"><div class="curtain__el">${curtainImg('rideau-branche')}</div></div>
<section class="pano" aria-labelledby="t-vallee">
  <div class="section section--tight">
    <div class="wrap grid intro">
      ${lines(L('Une vallée,|et pas une autre', 'One valley,|and no other'), 'h2', 'h2', 'id="t-vallee"')}
      <p class="lead fade">${L('De la Clarée au Queyras, de Briançon aux Écrins : nous construisons ici, et seulement ici.', 'From the Clarée to the Queyras, from Briançon to the Écrins: we build here, and only here.')}</p>
    </div>
  </div>
  <div class="pano__track">
    <div class="pano__sticky">
      <div class="pano__band">${scene('panorama', lang, { flow: false, alt: L('La vallée de Serre Chevalier vue de drone : sommets enneigés, pistes et villages au printemps', 'The Serre Chevalier valley from a drone: snowy peaks, ski runs and villages in spring') })}
      </div>
      <div class="wrap"><p class="cote caption">${L('La vallée de Serre Chevalier, au printemps', 'The Serre Chevalier valley, in spring')}</p></div>
    </div>
  </div>
  <div class="section">
    <div class="wrap">
      <div class="map">${mapSVG(lang, ctx.map)}
        <p class="map__legend caption"><span><i class="sale"></i>${L('Chalets à vendre', 'Chalets for sale')}</span><span><i class="hq"></i>${L('Siège et ateliers', 'Head office and workshops')}</span></p>
      </div>
    </div>
  </div>
</section>`;

  const construire = `
<section class="section" id="construire" aria-labelledby="t-construire">
  <div class="wrap">
    <div class="grid intro">
      ${lines(L('Ou faire construire|le vôtre', 'Or build|your own'), 'h2', 'h2', 'id="t-construire"')}
      <p class="lead fade">${L('Un bureau d’études, un atelier de 1 300 m² et nos charpentiers : tout se fait chez nous, du dessin au levage.', 'A design office, a 1,300 m² workshop and our own carpenters: everything is done in-house, from drawing to raising.')}</p>
    </div>
    <div class="grid ferme">
      <div class="ferme__draw">${fermeSVG(lang)}</div>
      <ol class="ferme__steps small">
        <li><b>${L('Dessiner', 'Draw')}</b><span class="muted">${L('En 3D, au bureau d’études.', 'In 3D, in our design office.')}</span></li>
        <li><b>${L('Tailler', 'Cut')}</b><span class="muted">${L('À l’atelier, sur la K2.', 'In the workshop, on the K2.')}</span></li>
        <li><b>${L('Lever', 'Raise')}</b><span class="muted">${L('Sur votre terrain.', 'On your plot.')}</span></li>
      </ol>
    </div>
    <div class="grid works">
      <figure class="works__item works__item--a"><div class="frame frame--pano">${scene('real-psv-automne', lang, { alt: L('Chalet en bois et mélèzes dorés à Puy-Saint-Vincent en octobre, sommets en arrière-plan', 'Timber chalet and golden larches in Puy-Saint-Vincent in October, peaks behind') })}</div><figcaption class="cote caption">${L('Puy-Saint-Vincent, en octobre', 'Puy-Saint-Vincent, in October')}</figcaption></figure>
      <figure class="works__item works__item--b"><div class="frame frame--wide">${scene('real-montgenevre', lang, { alt: L('Toit enneigé et balcon d’un chalet à Montgenèvre, face aux pistes et au télésiège', 'Snowy roof and balcony of a chalet in Montgenèvre, facing the slopes and chairlift') })}</div><figcaption class="cote caption">${L('Montgenèvre, face aux pistes', 'Montgenèvre, facing the slopes')}</figcaption></figure>
    </div>
    <div class="after"><a class="cta" href="${url('contact', lang)}?sujet=projet#formulaire">${L('Parlons de votre chalet', 'Let’s talk about your chalet')} ${arrow}</a></div>
  </div>
</section>`;

  const maison = `
<div class="curtain curtain--post" aria-hidden="true"><div class="curtain__el">${curtainImg('rideau-poteau')}</div></div>
<section class="section surface" aria-labelledby="t-maison">
  <div class="wrap">
    <div class="grid intro">
      ${lines(L('Une entreprise d’avance,|depuis 1979', 'A company ahead,|since 1979'), 'h2', 'h2', 'id="t-maison"')}
      <p class="lead fade">${L('Fondée par Maurice Lombard et Jean-Claude Vasina, reprise en 2021 par Marielle et Mathieu. Maurice transmet toujours.', 'Founded by Maurice Lombard and Jean-Claude Vasina, taken over in 2021 by Marielle and Mathieu. Maurice still passes on his craft.')}</p>
    </div>
    <dl class="figures">
      <div><dt>${L('chalets construits', 'chalets built')}</dt><dd>${L('800 et plus', '800-plus')}</dd></div>
      <div><dt>${L('personnes en interne', 'people in-house')}</dt><dd>40</dd></div>
      <div><dt>${L('d’atelier', 'workshop')}</dt><dd>${L('1 300 m²', '1,300 m²')}</dd></div>
      <div><dt>${L('première K2 des Hautes-Alpes', 'first K2 in the Hautes-Alpes')}</dt><dd>2000</dd></div>
    </dl>
    <div class="after"><a class="link" href="${url('house', lang)}">${L('Notre histoire', 'Our story')} ${arrow}</a></div>
  </div>
</section>
<section class="section" aria-label="${L('Témoignage', 'Testimonial')}">
  <div class="wrap">
    <figure class="grid quote">
      <blockquote class="fade" lang="fr">« ${esc(quotes.dufour.text)} »</blockquote>
      <figcaption class="small muted fade">${quotes.dufour.who}, ${quotes.dufour.when[lang]}${lang === 'en' ? ' (quoted in French)' : ''}</figcaption>
    </figure>
  </div>
</section>`;

  return {
    key: 'home',
    path: routes.home,
    title: L('Chalets neufs à vendre et construction de chalets bois dans le Briançonnais | Lombard & Vasina', 'New-build chalets for sale and timber chalet builder in the Briançonnais | Lombard & Vasina'),
    description: L('Chalets neufs vendus sur plan à Serre Chevalier et Puy-Saint-Vincent, et chalets bois construits sur mesure dans le Briançonnais depuis 1979. Bureau d’études, atelier et charpentiers à Saint-Martin-de-Queyrières.', 'New-build chalets for sale off-plan in Serre Chevalier and Puy-Saint-Vincent, and bespoke timber chalets built in the Briançonnais since 1979. Design office, workshop and carpenters in Saint-Martin-de-Queyrières.'),
    preload: preloadScene('ouverture'),
    preloadSerif: true,
    body: hero + vitrine + territoire + construire + maison,
    ld: available.map((c) => listingLD(c, lang)),
  };
}

// Image aplatie d'une scène, affichée comme image fixe (avec lumière rasante).
export function sceneStill(name, lang, alt) {
  const m = sceneMeta(name);
  if (!m) return '';
  const ws = Object.keys(m.flat).map(Number).sort((a, b) => a - b);
  const set = (ext) => ws.map((w) => `${m.flat[w]}.${ext} ${w}w`).join(', ');
  const focus = `${(m.focus[0] * 100).toFixed(1)}% ${(m.focus[1] * 100).toFixed(1)}%`;
  return `<div class="still" data-light><picture><source type="image/avif" srcset="${set('avif')}" sizes="(min-width: 768px) 50vw, 100vw"><source type="image/webp" srcset="${set('webp')}" sizes="(min-width: 768px) 50vw, 100vw"><img src="${m.flat[ws[0]]}.webp" width="${m.w}" height="${m.h}" alt="${esc(alt)}" loading="lazy" decoding="async" style="--focus:${focus}"></picture><div class="scene__light" aria-hidden="true"></div></div>`;
}

export function curtainImg(name) {
  const m = sceneMeta(name);
  if (!m) return '';
  const p = m.desktop[0];
  const ws = Object.keys(p.src).map(Number).sort((a, b) => a - b);
  const pm = m.mobile[0];
  const mws = Object.keys(pm.src).map(Number).sort((a, b) => a - b);
  return `<picture><source media="(prefers-reduced-motion: reduce)" srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"><source media="(max-width: 767px)" type="image/avif" srcset="${mws.map((w) => `${pm.src[w]}.avif ${w}w`).join(', ')}" sizes="100vw"><source type="image/avif" srcset="${ws.map((w) => `${p.src[w]}.avif ${w}w`).join(', ')}" sizes="100vw"><source type="image/webp" srcset="${ws.map((w) => `${p.src[w]}.webp ${w}w`).join(', ')}" sizes="100vw"><img src="${p.src[ws[0]]}.webp" alt="" width="${m.w}" height="${m.h}" loading="lazy" decoding="async"></picture>`;
}
