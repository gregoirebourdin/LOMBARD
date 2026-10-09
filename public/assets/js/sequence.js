/* S1 + S2 — le plan-séquence : le hero au crépuscule, le titre qui se couche derrière le toit,
   le seuil (on traverse la vitre éclairée), les portes en pignon d'une pièce à l'autre, puis la
   dernière pièce qui se referme en épreuve photo sur le papier.
   Tout est calculé depuis les coordonnées naturelles des photos (Annexe A du cahier des charges). */
(() => {
  const App = window.App;
  if (!App || !App.ok) return;
  const { $, $$, motion } = App;
  const seq = $('#seq'), hero = $('.hero'), stage = $('.hero__stage'), zoom = $('.hero__zoom'), pan = $('.hero__pan');
  const img = $('.hero__img'), title = $('.hero__title'), plinth = $('.hero__plinth');
  const titleLines = $$('.hero__title > .ln');
  const portrait = matchMedia('(max-aspect-ratio: 1/1)');
  const SRC = {
    land: { W: 1920, H: 1281, pos: [.5, .1], sky: [1000, 140, 1690, 370], door: [242, 716, 498, 966], focal: [806, 445] },
    port: { W: 1281, H: 1920, pos: [.3, 0], sky: [160, 160, 1000, 390], door: [326, 928, 446, 1226], focal: [470, 560] },
  };
  const cfg = () => (portrait.matches ? SRC.port : SRC.land);
  const panBox = () => { const W = innerWidth, Hh = hero.clientHeight; return { x: -.015 * W, y: -.015 * Hh, w: 1.03 * W, h: 1.03 * Hh }; };
  function cover(c, box) {
    const k = Math.max(box.w / c.W, box.h / c.H);
    return { k, x: box.x + (box.w - c.W * k) * c.pos[0], y: box.y + (box.h - c.H * k) * c.pos[1] };
  }
  const toScreen = (c, box, x, y) => { const r = cover(c, box); return [r.x + x * r.k, r.y + y * r.k]; };
  const Hero = (App.hero = { cfg, toScreen, panBox });

  /* ——— masque du ciel : si le PNG manque, le titre reste lisible sans masque ——— */
  (() => {
    const url = getComputedStyle($('.hero__sky')).webkitMaskImage || getComputedStyle($('.hero__sky')).maskImage || '';
    const m = url.match(/url\("?([^")]+)"?\)/);
    if (!m) return;
    const probe = new Image();
    probe.onerror = () => hero.classList.add('hero--nomask');
    probe.src = m[1];
  })();

  /* ——— le titre dans le ciel ——— */
  const plinthMain = $('.plinth__main'), skyLayer = $('.hero__sky');
  function placeTitle() {
    const c = cfg(), box = panBox();
    const [x0, y0] = toScreen(c, box, c.sky[0], c.sky[1]);
    const [x1, y1] = toScreen(c, box, c.sky[2], c.sky[3]);
    const fs = parseFloat(getComputedStyle(title).fontSize);
    const lh = fs * .95;
    const zoneH = Math.min(y1, hero.clientHeight * .5) - Math.max(y0, 0);
    const onPaper = zoneH < 2 * lh || x1 - x0 < fs * 5.4;
    hero.classList.toggle('hero--title-on-paper', onPaper);
    if (onPaper) { if (title.parentNode !== plinthMain) plinthMain.prepend(title); return; }
    if (title.parentNode !== skyLayer) skyLayer.append(title);
    // repère local du calque (pan) : on retire l'origine du cadre élargi
    title.style.setProperty('--h1-x', `${x0 - box.x}px`);
    title.style.setProperty('--h1-y', `${Math.max(y0, 0) - box.y}px`);
    title.style.setProperty('--h1-w', `${x1 - x0}px`);
  }

  /* ——— cadrage T0 de l'intro : le point focal du hero au centre de la fenêtre ——— */
  Hero.setT0 = (wc, s = 1.35) => {
    const c = cfg(), box = panBox();
    const [fx, fy] = toScreen(c, box, c.focal[0], c.focal[1]);
    const W = innerWidth, Hh = hero.clientHeight;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const tx = clamp(wc.x - fx, (W - fx) * (1 - s), fx * (s - 1));
    const ty = clamp(wc.y - fy, (Hh - fy) * (1 - s), fy * (s - 1));
    gsap.set(stage, { transformOrigin: `${fx}px ${fy}px`, x: tx, y: ty, scale: s });
  };
  Hero.dive = (dur = 2) => gsap.to(stage, { x: 0, y: 0, scale: 1, duration: dur, ease: 'out', onComplete: () => gsap.set(stage, { clearProps: 'transform' }) });

  /* ——— révélations du hero (pilotées par l'intro, ou directes) ——— */
  const encartRows = $$('.encart__h, .encart__row, .encart__note, .encart-m');
  Hero.prepare = () => {
    gsap.set($$('.hero__title .ln__i'), { yPercent: 110 });
    gsap.set(plinth, { yPercent: 100 });
    gsap.set(encartRows, { autoAlpha: 0, y: 12 });
  };
  Hero.revealH1 = () => gsap.to($$('.hero__title .ln__i'), { yPercent: 0, duration: 1.1, ease: 'out', stagger: .1 });
  Hero.revealPlinth = () => gsap.to(plinth, { yPercent: 0, duration: 1, ease: 'wipe' });
  Hero.revealHeader = () => {
    const h = $('.header');
    document.documentElement.classList.add('intro-done');
    gsap.fromTo(h, { yPercent: -100 }, { yPercent: 0, duration: .9, ease: 'out', clearProps: 'transform' });
  };
  Hero.revealEncart = () => gsap.to(encartRows, { autoAlpha: 1, y: 0, duration: .6, ease: 'out', stagger: .06 });
  Hero.revealStatic = () => {
    document.documentElement.classList.add('intro-done');
    if (!motion) return;
    Hero.prepare();
    Hero.revealH1(); gsap.delayedCall(.15, Hero.revealPlinth); gsap.delayedCall(.25, Hero.revealEncart);
  };

  /* ——— parallaxe au pointeur (desktop) ——— */
  function initPointer() {
    if (!App.fine || !motion) return;
    const px = gsap.quickTo(pan, 'xPercent', { duration: 1.2, ease: 'power3.out' }), py = gsap.quickTo(pan, 'yPercent', { duration: 1.2, ease: 'power3.out' });
    const tx = gsap.quickTo(title, 'xPercent', { duration: 1.2, ease: 'power3.out' }), ty = gsap.quickTo(title, 'yPercent', { duration: 1.2, ease: 'power3.out' });
    hero.addEventListener('pointermove', (e) => {
      if (Seq.y > Seq.S[0]) return;
      const nx = e.clientX / innerWidth * 2 - 1, ny = e.clientY / innerHeight * 2 - 1;
      px(-nx * .8); py(-ny * .8); tx(nx * .4 * 2); ty(ny * .4 * 2);
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { px(0); py(0); tx(0); ty(0); });
    pan.addEventListener('click', () => { if (Seq.y < Seq.S[0] * .5) App.scrollTo('#visite'); });
  }

  /* ——— le plan-séquence épinglé ——— */
  const Seq = (App.seq = { y: 0, S: [25, 115, 135, 205, 275, 320] });
  const rooms = $$('.room'), medias = rooms.map((r) => $('.room__media', r)), capLines = rooms.map((r) => $$('.room__line .ln__i', r));
  const caps = rooms.map((r) => $('.room__cap', r)), credits = rooms.map((r) => $('.room__credit', r));
  const ui = $('.visite__ui'), idx = $$('.visite__index li'), cartel = $('.visite__cartel'), bloom = $('.seq__bloom');
  const lite = new URLSearchParams(location.search).has('lite') || (!new URLSearchParams(location.search).has('full') && ((navigator.deviceMemory && navigator.deviceMemory < 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4)));
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const seg = (y, a, b) => clamp01((y - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  let geo = null;

  function layout() {
    const mob = innerWidth < 768;
    Seq.S = mob ? [20, 95, 110, 170, 230, 265] : [25, 115, 135, 205, 275, 320];
    Seq.total = Seq.S[5];
    const c = cfg(), box = panBox();
    const [x0, y0] = toScreen(c, box, c.door[0], c.door[1]);
    const [x1, y1] = toScreen(c, box, c.door[2], c.door[3]);
    const r0 = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    const W = innerWidth, Hh = seq.clientHeight;
    const S = Math.max(W / r0.w, Hh / r0.h) * 1.08;
    // point fixe du zoom : la vitre (décentrée) finit centrée et couvre tout l'écran
    const O = { x: (W / 2 - (r0.w * S) / 2 - r0.x * S) / (1 - S), y: (Hh / 2 - (r0.h * S) / 2 - r0.y * S) / (1 - S) };
    geo = { r0, O, S, W, H: Hh, mob };
    bloom.style.setProperty('--ox', '50%'); bloom.style.setProperty('--oy', '50%');
    placeTitle();
  }

  const setOn = (i, on) => rooms[i].classList.toggle('is-on', on);
  const chaps = rooms.map((r) => $('.room__chap', r));
  function linesTo(i, t, dir) { // t ∈ [0,1] → lignes de légende ; dir 1 = entrée, -1 = sortie
    chaps[i].style.opacity = String(dir > 0 ? clamp01(t * 2) : 1 - clamp01(t * 2));
    capLines[i].forEach((l, k) => {
      const p = clamp01(t * 1.4 - k * .2);
      const e = App.ease.out(p);
      l.style.transform = `translate3d(0,${dir > 0 ? (1 - e) * 110 : -e * 110}%,0)`;
    });
  }
  function gable(el, p) { // porte en pignon posée au sol, au centre
    const e = App.ease.inOut(clamp01(p / .75));
    const hw = lerp(1.2, 64, e), eave = lerp(40, -25, e), apex = lerp(30, -55, e);
    el.style.clipPath = e >= 1 ? 'none' : `polygon(50% ${apex}%, ${50 + hw}% ${eave}%, ${50 + hw}% 100%, ${50 - hw}% 100%, ${50 - hw}% ${eave}%)`;
    return e;
  }

  function render(y) {
    Seq.y = y;
    const [s0, s1, s2, s3, s4, s5] = Seq.S;
    const { r0, O, S, W, H: Hh, mob } = geo;

    // segment 0 : le titre se couche derrière le toit, le socle descend
    const a = App.ease.inOut(seg(y, 0, s0));
    const drop = a * .34 * innerHeight;
    titleLines.forEach((l) => { l.style.transform = drop ? `translate3d(0,${drop}px,0)` : ''; });
    plinth.style.transform = a ? `translate3d(0,${a * 100}%,0)` : '';
    plinth.style.opacity = String(1 - a);
    App.header.lock('seq', y > s0 * .35 && y < s5 - 8);
    seq.dataset.header = y < s0 * .9 ? 'sky' : (y < s5 - 10 ? 'photo' : 'paper');

    // segment 1 : le seuil
    const t1 = seg(y, s0, s1);
    const e1 = App.ease.inOut(t1);
    if (lite) {
      zoom.style.transform = '';
      rooms[0].style.clipPath = 'none';
      rooms[0].style.opacity = String(e1);
    } else if (t1 > 0) {
      const s = Math.pow(S, e1);
      zoom.style.transformOrigin = `${O.x}px ${O.y}px`;
      zoom.style.transform = `scale(${s})`;
      const r = { x: O.x + (r0.x - O.x) * s, y: O.y + (r0.y - O.y) * s, w: r0.w * s, h: r0.h * s };
      rooms[0].style.clipPath = t1 >= 1 ? 'none' : `inset(${Math.max(0, r.y)}px ${Math.max(0, W - r.x - r.w)}px ${Math.max(0, Hh - r.y - r.h)}px ${Math.max(0, r.x)}px)`;
      rooms[0].style.opacity = String(clamp01(t1 / .22));
    } else {
      zoom.style.transform = '';
    }
    hero.style.visibility = t1 >= 1 ? 'hidden' : '';
    bloom.style.opacity = lite ? '0' : String(Math.sin(Math.PI * clamp01((t1 - .35) / .6)) * .28);

    // salle 1 : contre-zoom à l'entrée, légende qui monte
    const t3 = seg(y, s2, s3), t4 = seg(y, s3, s4), t5 = seg(y, s4, s5);
    setOn(0, t1 > 0 && t3 < 1);
    setOn(1, t3 > 0 && t4 < 1);
    setOn(2, t4 > 0);
    if (t3 < 1) {
      const kb = lerp(1.5, 1, lite ? 1 : e1);
      medias[0].style.transform = `scale(${t3 > 0 ? kb * lerp(1, 1.12, App.ease.inOut(clamp01(t3 / .75))) : kb})`;
      rooms[0].style.setProperty('--shade', String(lerp(0, .35, clamp01(t3 / .75))));
      if (t3 > 0) linesTo(0, clamp01(t3 / .2), -1); else linesTo(0, clamp01((t1 - .72) / .26), 1);
    }

    // portes : pièce 1 → 2, puis 2 → 3
    const door = (i, t) => {
      if (t <= 0) return;
      const e = lite ? 1 : gable(rooms[i], t);
      if (lite) { rooms[i].style.clipPath = 'none'; rooms[i].style.opacity = String(clamp01(t / .75)); }
      const kb = t < .75 ? lerp(1.28, 1.04, e) : lerp(1.04, 1, App.ease.out((t - .75) / .25));
      medias[i].style.transform = `scale(${kb})`;
      linesTo(i, clamp01((t - .7) / .2), 1);
    };
    door(1, t3);
    if (t4 > 0 && t4 < 1) {
      medias[1].style.transform = `scale(${lerp(1, 1.12, App.ease.inOut(clamp01(t4 / .75)))})`;
      rooms[1].style.setProperty('--shade', String(lerp(0, .35, clamp01(t4 / .75))));
      linesTo(1, clamp01(t4 / .2), -1);
    } else if (t4 <= 0) rooms[1].style.setProperty('--shade', '0');
    door(2, t4);

    // segment 5 : le cadre se referme en épreuve sur le papier
    const e5 = App.ease.inOut(t5);
    if (t5 > 0) {
      const ins = mob ? [16, 18, 22, 18] : [14, 37, 14, 37];
      const vh = innerHeight / 100, vw = innerWidth / 100;
      rooms[2].style.clipPath = `inset(${ins[0] * vh * e5}px ${ins[1] * vw * e5}px ${ins[2] * vh * e5}px ${ins[3] * vw * e5}px)`;
      caps[2].style.opacity = String(1 - clamp01(t5 / .3));
      credits[2].style.opacity = String(1 - clamp01(t5 / .3));
      $('.room__veil', rooms[2]).style.opacity = String(1 - e5);
      cartel.style.opacity = String(clamp01((t5 - .6) / .4));
      cartel.style.top = `${innerHeight - ins[2] * vh + 14}px`;
    } else if (t4 > 0) {
      caps[2].style.opacity = ''; credits[2].style.opacity = ''; $('.room__veil', rooms[2]).style.opacity = '';
      cartel.style.opacity = '0';
      if (t4 >= 1) rooms[2].style.clipPath = 'none';
    }

    // interface de la visite
    ui.classList.toggle('is-on', t1 > .05 && t5 < .05);
    const cur = t4 > .5 ? 2 : t3 > .5 ? 1 : 0;
    idx.forEach((li, i) => li.classList.toggle('is-active', i === cur));
  }

  function initPin() {
    layout();
    if (!motion) return;
    // épinglé, le plan-séquence porte lui-même le thème de l'en-tête
    hero.removeAttribute('data-header'); $('#visite').removeAttribute('data-header'); seq.dataset.header = 'sky';
    const proxy = { p: 0 };
    const tw = gsap.to(proxy, { p: 1, ease: 'none', paused: true, onUpdate: () => render(proxy.p * Seq.total) });
    Seq.st = ScrollTrigger.create({
      trigger: seq, pin: true, start: 'top top', anticipatePin: 1, invalidateOnRefresh: true,
      end: () => `+=${(Seq.total / 100) * innerHeight}`,
      scrub: geo.mob ? .6 : 1, animation: tw,
      onRefreshInit: layout,
      onRefresh: () => render(proxy.p * Seq.total),
    });
    render(0);
    $('.visite__skip').addEventListener('click', (e) => { e.preventDefault(); App.scrollTo('#en-vente', { duration: 1.6 }); });
    $('.enter').addEventListener('click', (e) => { e.preventDefault(); App.scrollTo(Seq.st.start + (Seq.S[2] / 100) * innerHeight, { duration: 2.4 }); });
    // précharge la pièce suivante à l'entrée de la précédente
    const warm = (i) => rooms[i] && $$('img', rooms[i]).forEach((im) => { im.loading = 'eager'; });
    warm(0);
    ScrollTrigger.create({ trigger: seq, start: 'top -10%', once: true, onEnter: () => { warm(1); warm(2); } });
  }

  addEventListener('resize', () => { if (!motion) placeTitle(); });
  document.addEventListener('DOMContentLoaded', () => {
    initPin();
    initPointer();
    if (!document.documentElement.classList.contains('has-intro')) Hero.revealStatic();
  });
})();
