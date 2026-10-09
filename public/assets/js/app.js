/* Chalets Lombard Vasina — socle de la page : jetons de mouvement, défilement, révélations,
   en-tête, menu, pastille, tiroir et formulaires, curseur, horloge.
   Les modules hero.js, page.js, sections.js et intro.js s'y branchent via window.App. */
(() => {
  const html = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const motion = html.classList.contains('motion');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const desktop = () => matchMedia('(min-width: 1024px)').matches;
  const App = (window.App = { $, $$, motion, fine, desktop, lenis: null, D: { xs: .35, s: .6, m: .9, l: 1.2, xl: 1.6, xxl: 2.1 } });
  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (!hasGsap) { html.classList.remove('motion', 'has-intro'); html.classList.add('intro-done'); App.ok = false; return; }
  App.ok = true;

  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase, DrawSVGPlugin);
  CustomEase.create('out', '0.25,1,0.5,1');
  CustomEase.create('inOut', '0.75,0,0.25,1');
  CustomEase.create('in', '0.5,0,0.75,0');
  CustomEase.create('dive', '0.6,0,0,1');
  CustomEase.create('wipe', '0.73,0.15,0.15,0.99');
  CustomEase.create('roll', '0.25,0.1,0.25,1');
  gsap.defaults({ ease: 'out', duration: .9 });
  ScrollTrigger.config({ ignoreMobileResize: true });
  App.ease = { inOut: gsap.parseEase('inOut'), out: gsap.parseEase('out'), in: gsap.parseEase('in') };

  /* ——— défilement adouci (molette seulement ; tactile natif) ——— */
  if (motion && typeof Lenis !== 'undefined') {
    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, syncTouch: false });
    App.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  App.scrollTo = (target, opts = {}) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (App.lenis) App.lenis.scrollTo(el ?? target, { duration: 1.6, offset: 0, ...opts });
    else if (typeof target === 'number') scrollTo({ top: target, behavior: motion ? 'smooth' : 'auto' });
    else if (el) el.scrollIntoView({ behavior: motion ? 'smooth' : 'auto' });
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = $(id);
    if (!el) return;
    e.preventDefault();
    App.scrollTo(el, { offset: el.matches('.prog') ? -(header.offsetHeight + 24) : 0 });
    history.replaceState(null, '', id);
  });

  /* ——— lignes masquées ——— */
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);
  App.fontsReady = fontsReady;
  App.split = (el, type = 'lines') => {
    if (el._split) return el._split;
    el._split = SplitText.create(el, { type, mask: type === 'lines' ? 'lines' : undefined, linesClass: 'split-line', aria: 'auto', autoSplit: false });
    return el._split;
  };
  const onEnter = (el, fn, start = 'top 85%') => ScrollTrigger.create({ trigger: el, start, once: true, onEnter: () => fn(el) });
  App.onEnter = onEnter;

  /* ——— apparitions ———
     Titres : mot après mot, chaque mot monte, passe de transparent à opaque et du flou au net (comme
     « Scroll Blur Reveal » de Framer : flou 12 px, 22 px plus bas, chaque mot sur ~2 fois sa part du
     parcours). Dans les sections, la révélation suit le défilement ; dans le hero, elle suit le temps.
     Textes : un simple fondu, avec un flou très léger (animation CSS). */
  const SPACE = /([ \t\n\r]+)/; // jamais l'espace fine insécable : « et » ne se détachent pas
  App.titleWords = (el) => {
    if (el._fx) return el._fx;
    const words = [];
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(SPACE).forEach((t) => {
          if (!t) return;
          if (SPACE.test(t)) { frag.append(t); return; }
          const w = document.createElement('span'); w.className = 'fx-w'; w.textContent = t; w.setAttribute('aria-hidden', 'true');
          frag.append(w); words.push(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.matches('br, svg, .fx-w')) walk(n);
    });
    walk(el);
    // le titre garde son nom accessible entier (les mots découpés sont masqués aux lecteurs d'écran)
    if (el.matches('h1, h2, h3, h4')) el.setAttribute('aria-label', label);
    el.classList.add('fx-t');
    el._fx = words;
    return words;
  };
  // flou et montée à l'échelle du corps du titre (12 px et 22 px pour un titre de 56 px)
  const fxFrom = (el) => {
    const fs = parseFloat(getComputedStyle(el).fontSize) || 40;
    return { opacity: 0, y: Math.round(fs * .39), filter: `blur(${Math.min(18, Math.max(6, fs * .21)).toFixed(1)}px)` };
  };
  const FX_TO = { opacity: 1, y: 0, filter: 'blur(0px)' };
  App.titleHide = (el) => { const w = App.titleWords(el); gsap.set(w, fxFrom(el)); return w; };
  // dans le temps (hero, étapes, finale)
  App.title = (el, o = {}) => {
    const w = App.titleWords(el);
    return gsap.fromTo(w, fxFrom(el), { ...FX_TO, duration: o.duration ?? 1.1, ease: 'power3.out', stagger: o.stagger ?? .08, delay: o.delay || 0,
      onComplete: () => gsap.set(w, { clearProps: 'filter,willChange' }) });
  };
  // au défilement : chaque mot occupe ~2,2 fois sa part du parcours, comme la référence
  App.titleScroll = (el, o = {}) => {
    const w = App.titleWords(el), n = w.length, speed = .65, part = speed / n;
    gsap.set(w, { ...fxFrom(el), willChange: 'opacity, filter, transform' });
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: el, start: o.start || 'top 94%', end: o.end || 'top 52%', scrub: .4 } });
    w.forEach((x, i) => { const a = (i / n) * speed, b = Math.min(a + part * 2.2, 1); tl.to(x, { ...FX_TO, duration: b - a }, a); });
    tl.to({}, { duration: Math.max(0, 1 - tl.duration()) });
    return tl;
  };
  // un texte : fondu et flou léger
  App.text = (el, o = {}) => {
    el.classList.add('fx-p');
    el.style.setProperty('--fx-delay', `${o.delay || 0}s`);
    el.classList.remove('is-in'); void el.offsetWidth; el.classList.add('is-in');
  };
  App.textHide = (el) => { el.classList.add('fx-p'); el.classList.remove('is-in'); };
  const isTitle = (el) => el.matches('h1, h2, h3, .d1, .d2, .d3');

  function initReveals() {
    if (!motion) return;
    $$('[data-reveal]').forEach((el) => {
      const kind = el.dataset.reveal;
      const delay = parseFloat(el.dataset.delay || 0);
      if (kind === 'lines' || kind === 'fade') {
        // les titres lettre à lettre, tout le reste (petits titres, paragraphes) en fondu
        if (isTitle(el)) App.titleScroll(el);
        else { App.textHide(el); onEnter(el, () => App.text(el, { delay })); }
      } else if (kind === 'stagger') {
        gsap.set(el.children, { autoAlpha: 0, y: 16 });
        onEnter(el, () => gsap.to(el.children, { autoAlpha: 1, y: 0, duration: .9, stagger: .06, delay }));
      }
    });
  }

  /* ——— parallaxe dans le cadre ——— */
  function initParallax() {
    if (!motion) return;
    const k = desktop() ? 1 : .5;
    $$('[data-parallax]').forEach((frame) => {
      const amt = parseFloat(frame.dataset.parallax || 8) * k;
      const target = frame.querySelector('.pic') || frame.firstElementChild;
      gsap.fromTo(target, { yPercent: amt }, {
        yPercent: -amt, ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top 125%', end: 'bottom -25%', scrub: .5 },
      });
    });
  }

  /* ——— en-tête : thèmes, retrait au scroll, lien courant ——— */
  const header = $('.header');
  const H = (App.header = { locks: new Set(), override: null, theme: 'sky', hidden: false });
  H.setTheme = (t) => { if (t !== H.theme) { H.theme = t; header.dataset.theme = t; App.cursorTheme?.(); } };
  H.lock = (key, on) => { on ? H.locks.add(key) : H.locks.delete(key); H.apply(); };
  H.apply = () => {
    const hide = H.locks.size > 0 || (H.hidden && !header.contains(document.activeElement) && !App.menuOpen);
    header.classList.toggle('is-hidden', hide);
  };
  function themeAt() {
    if (H.override) return H.override;
    let t = 'paper';
    for (const z of $$('[data-header]')) {
      const r = z.getBoundingClientRect();
      if (r.top <= 40 && r.bottom > 40) t = z.dataset.header;
    }
    return t;
  }
  const navLinks = $$('.header__nav [data-nav]');
  const navTargets = navLinks.map((a) => $(`#${a.dataset.nav}`));
  let lastY = 0;
  function onScroll() {
    const y = App.lenis ? App.lenis.scroll : scrollY;
    const dir = App.lenis ? App.lenis.direction : Math.sign(y - lastY);
    if (Math.abs(y - lastY) > 4) {
      H.hidden = !desktop() && y > 160 && dir > 0;
      lastY = y;
      H.apply();
    }
    H.setTheme(App.menuOpen ? 'paper' : themeAt());
    let cur = -1;
    navTargets.forEach((t, i) => { if (t) { const r = t.getBoundingClientRect(); if (r.top < innerHeight * .5 && r.bottom > innerHeight * .5) cur = i; } });
    navLinks.forEach((a, i) => a.classList.toggle('is-current', i === cur));
  }
  App.onScroll = onScroll;
  if (App.lenis) App.lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });
  header.addEventListener('focusin', () => H.apply());

  /* ——— menu ——— */
  const menu = $('#menu'), menuBtn = $('.menu-btn');
  let menuTl = null, menuReturn = null;
  function trap(container, e) {
    if (e.key !== 'Tab') return;
    const f = $$('a[href], button:not([disabled]), input:not([type="hidden"]), textarea, [tabindex="0"]', container).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function openMenu() {
    App.menuOpen = true;
    menu.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    App.lenis?.stop();
    H.setTheme('paper'); H.apply();
    menuReturn = document.activeElement;
    const r = menuBtn.getBoundingClientRect();
    const cx = ((r.left + r.width / 2) / innerWidth) * 100, cy = ((r.top + r.height / 2) / innerHeight) * 100;
    menuTl?.kill();
    if (motion) {
      const g = { p: 0 };
      const draw = () => {
        const p = g.p, w = 4 + p * 260, a = cy - p * 160, e = cy + 4 - p * 120;
        menu.style.clipPath = `polygon(${cx}% ${a}%, ${cx + w}% ${e}%, ${cx + w}% 200%, ${cx - w}% 200%, ${cx - w}% ${e}%)`;
      };
      menuTl = gsap.timeline()
        .to(g, { p: 1, duration: .8, ease: 'inOut', onUpdate: draw, onComplete: () => { menu.style.clipPath = ''; } })
        .fromTo($$('.menu__list li', menu), { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .8, stagger: .06 }, .3)
        .fromTo($('.menu__foot', menu), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .7 }, .55);
    }
    setTimeout(() => $('.menu__list a', menu)?.focus({ preventScroll: true }), 50);
  }
  function closeMenu(focusBack = true) {
    if (!App.menuOpen) return;
    App.menuOpen = false;
    menuBtn.setAttribute('aria-expanded', 'false');
    menuTl?.kill();
    const done = () => { menu.hidden = true; menu.style.clipPath = ''; App.lenis?.start(); onScroll(); };
    if (motion) gsap.to(menu, { autoAlpha: 0, duration: .35, ease: 'in', onComplete: () => { gsap.set(menu, { clearProps: 'opacity,visibility' }); done(); } });
    else done();
    if (focusBack) (menuReturn || menuBtn).focus({ preventScroll: true });
  }
  menuBtn.addEventListener('click', () => (App.menuOpen ? closeMenu() : openMenu()));
  menu.addEventListener('keydown', (e) => trap(menu, e));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && App.menuOpen) closeMenu(); });
  menu.addEventListener('click', (e) => { if (e.target.closest('[data-menu-link]')) closeMenu(false); });

  /* ——— tiroir et formulaires ——— */
  const drawer = $('#drawer');
  const NOMS = { 'serre-orchis': 'Le Serre d’Orchis', 'sabot-venus': 'Le Sabot de Vénus', 'la-rouya': 'La Rouya', terrain: 'Un chalet sur mon terrain' };
  const LOTS = { 'serre-orchis': ['A', 'B'], 'sabot-venus': ['A', 'B'] };
  let drawerReturn = null;
  function syncLot(form) {
    const prog = form.querySelector('input[name="programme"]:checked')?.value;
    const set = form.querySelector('.form__lot');
    set.hidden = !LOTS[prog];
    if (set.hidden) form.querySelectorAll('input[name="lot"]').forEach((i) => { i.checked = false; });
  }
  function prefill(form, { programme, lot, souhait }) {
    if (programme) { const r = form.querySelector(`input[name="programme"][value="${programme}"]`); if (r) r.checked = true; }
    syncLot(form);
    if (lot && LOTS[programme]) { const r = form.querySelector(`input[name="lot"][value="${lot}"]`); if (r) r.checked = true; }
    if (souhait) { const c = form.querySelector(`input[name="souhait"][value="${souhait}"]`); if (c) c.checked = true; }
  }
  App.openDrawer = (ctx = {}, origin = null) => {
    drawerReturn = origin || document.activeElement;
    const form = $('form', drawer);
    prefill(form, ctx);
    const ctxEl = $('.drawer__ctx', drawer), title = $('.drawer__main', drawer), kicker = $('.kicker', drawer);
    const terrain = ctx.programme === 'terrain';
    title.textContent = terrain ? 'Parlons de votre chalet' : 'Recevoir les plans et les prix';
    kicker.textContent = terrain ? 'SUR VOTRE TERRAIN' : 'PLANS, PRIX, RENDEZ-VOUS';
    ctxEl.textContent = ctx.programme && NOMS[ctx.programme] && !terrain
      ? ` — ${NOMS[ctx.programme]}${ctx.lot && LOTS[ctx.programme] ? `, chalet ${ctx.lot}` : ''}` : '';
    if (typeof drawer.showModal === 'function') drawer.showModal(); else drawer.setAttribute('open', '');
    App.drawerOpen = true;
    App.lenis?.stop();
    App.pill?.update();
    if (motion) {
      const mob = !desktop();
      gsap.fromTo(drawer, mob ? { yPercent: 100 } : { xPercent: 100 }, { xPercent: 0, yPercent: 0, duration: .8, ease: 'wipe' });
    }
    window.dataLayer?.push({ event: 'cta', cta: 'drawer', programme: ctx.programme || null, lot: ctx.lot || null });
  };
  function closeDrawer() {
    const fin = () => { drawer.close?.(); drawer.removeAttribute('open'); App.drawerOpen = false; App.lenis?.start(); App.pill?.update(); drawerReturn?.focus?.({ preventScroll: true }); };
    if (motion) gsap.to(drawer, desktop() ? { xPercent: 100, duration: .55, ease: 'in', onComplete: fin } : { yPercent: 100, duration: .55, ease: 'in', onComplete: fin });
    else fin();
  }
  drawer.addEventListener('cancel', (e) => { e.preventDefault(); closeDrawer(); });
  drawer.addEventListener('click', (e) => { if (e.target === drawer || e.target.closest('[data-close]')) closeDrawer(); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-drawer]');
    if (!b) return;
    e.preventDefault();
    if (App.menuOpen) closeMenu(false);
    App.openDrawer({ programme: b.dataset.programme, lot: b.dataset.lot, souhait: b.dataset.souhait }, b);
  });

  function initForms() {
    $$('form[data-form]').forEach((form) => {
      const t0 = Date.now();
      form.setAttribute('action', '/api/lead');
      form.removeAttribute('enctype');
      form.addEventListener('change', (e) => { if (e.target.name === 'programme') syncLot(form); });
      const msg = $('.form__msg', form), btn = $('.btn--submit', form);
      const err = (input, on) => {
        const e = input.getAttribute('aria-describedby') && document.getElementById(input.getAttribute('aria-describedby'));
        input.setAttribute('aria-invalid', on ? 'true' : 'false');
        if (e) e.hidden = !on;
      };
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nom = form.elements.nom, email = form.elements.email, ok = form.elements.consentement;
        const bad = [];
        if (!nom.value.trim()) bad.push(nom);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) bad.push(email);
        if (!ok.checked) bad.push(ok);
        [nom, email, ok].forEach((i) => err(i, bad.includes(i)));
        if (bad.length) { bad[0].focus(); return; }
        const data = Object.fromEntries(new FormData(form));
        data.souhait = new FormData(form).getAll('souhait');
        data.duree = Date.now() - t0;
        btn.disabled = true;
        msg.textContent = '';
        try {
          if (data.site) throw new Error('piège');
          const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
          if (!r.ok) throw new Error(String(r.status));
          btn.classList.add('is-done');
          const path = $('.btn__check path', btn);
          if (motion && path) gsap.fromTo(path, { drawSVG: '0%' }, { drawSVG: '100%', duration: .6, ease: 'inOut' });
          msg.textContent = 'Merci. Votre demande a bien été transmise à l’équipe Lombard Vasina.';
          window.dataLayer?.push({ event: 'form_submit', programme: data.programme || null, lot: data.lot || null });
        } catch (err) {
          btn.disabled = false;
          const body = encodeURIComponent(`Projet : ${NOMS[data.programme] || '—'}${data.lot ? `, chalet ${data.lot}` : ''}\nJe souhaite : ${data.souhait.join(', ') || '—'}\nNom : ${data.nom}\nE-mail : ${data.email}\nTéléphone : ${data.tel || '—'}\n\n${data.message || ''}`);
          const mailto = `mailto:contact@chalets-lombard.fr?subject=${encodeURIComponent(`Plans et prix — ${NOMS[data.programme] || 'demande'}`)}&body=${body}`;
          if (String(err && err.message) === '503') {
            // envoi direct pas encore configuré : la messagerie du visiteur s'ouvre, demande déjà rédigée
            msg.innerHTML = `Votre messagerie s’ouvre avec votre demande déjà rédigée : il ne reste qu’à l’envoyer. Sinon, écrivez à <a class="link" href="${mailto.replace(/&/g, '&amp;')}">contact@chalets-lombard.fr</a> ou appelez le <a class="link" href="tel:+33492212919">04&#8239;92&#8239;21&#8239;29&#8239;19</a>.`;
            location.href = mailto;
          } else {
            msg.innerHTML = `L’envoi n’a pas abouti. Écrivez-nous à <a class="link" href="${mailto.replace(/&/g, '&amp;')}">contact@chalets-lombard.fr</a> ou appelez le <a class="link" href="tel:+33492212919">04&#8239;92&#8239;21&#8239;29&#8239;19</a>.`;
          }
        }
      });
    });
  }

  /* ——— pastille mobile « Plans & prix » ——— */
  function initPill() {
    const pill = $('.pill');
    if (!pill) return;
    const seen = new Set();
    let heroOut = false;
    const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target))); update(); }, { threshold: 0 });
    $$('.btn, .sheet__form, .footer').forEach((el) => io.observe(el));
    function update() {
      const on = heroOut && !seen.size && !App.menuOpen && !App.drawerOpen;
      pill.classList.toggle('is-on', on);
    }
    ScrollTrigger.create({ trigger: '.hero', start: 'bottom 60%', onEnter: () => { heroOut = true; update(); }, onLeaveBack: () => { heroOut = false; update(); } });
    App.pill = { update };
  }

  /* ——— boutons : libellé qui roule, effet magnétique ——— */
  function initButtons() {
    $$('[data-roll]').forEach((el) => {
      const txt = el.textContent;
      const chars = [...txt].map((c) => `<span class="rl-c">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
      el.setAttribute('aria-label', txt);
      el.innerHTML = `<span class="rl rl-a" aria-hidden="true">${chars}</span><span class="rl rl-b" aria-hidden="true">${chars}</span>`;
      if (!motion) return;
      const a = $$('.rl-a .rl-c', el), b = $$('.rl-b .rl-c', el);
      gsap.set(b, { yPercent: 100 });
      const host = el.closest('a, button');
      host.addEventListener('pointerenter', () => {
        gsap.to(a, { yPercent: -100, duration: .7, ease: 'roll', stagger: .015, overwrite: true });
        gsap.to(b, { yPercent: 0, duration: .7, ease: 'roll', stagger: .015, overwrite: true });
      });
      host.addEventListener('pointerleave', () => {
        gsap.to(a, { yPercent: 0, duration: .7, ease: 'roll', stagger: .015, overwrite: true });
        gsap.to(b, { yPercent: 100, duration: .7, ease: 'roll', stagger: .015, overwrite: true });
      });
    });
    if (!fine || !motion) return;
    $$('[data-magnetic]').forEach((el) => {
      const label = $('.btn__label', el);
      const x = gsap.quickTo(el, 'x', { duration: 1, ease: 'power4.out' }), y = gsap.quickTo(el, 'y', { duration: 1, ease: 'power4.out' });
      const lx = label && gsap.quickTo(label, 'x', { duration: 1, ease: 'power4.out' }), ly = label && gsap.quickTo(label, 'y', { duration: 1, ease: 'power4.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
        const c = (v) => Math.max(-6, Math.min(6, v));
        x(c(dx * .3)); y(c(dy * .3));
        if (label) { lx(c(dx * .12)); ly(c(dy * .12)); }
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1.2, ease: 'elastic.out(1,.35)', overwrite: true });
        if (label) gsap.to(label, { x: 0, y: 0, duration: 1.2, ease: 'elastic.out(1,.35)', overwrite: true });
      });
    });
  }

  /* ——— curseur ——— */
  function initCursor() {
    const c = $('.cursor');
    if (!fine || !motion || !c) return;
    const dot = $('.cursor__dot', c), pill = $('.cursor__pill', c), label = $('.cursor__label', c);
    const qx = [gsap.quickTo(dot, 'x', { duration: .5, ease: 'power3.out' }), gsap.quickTo(pill, 'x', { duration: .5, ease: 'power3.out' })];
    const qy = [gsap.quickTo(dot, 'y', { duration: .5, ease: 'power3.out' }), gsap.quickTo(pill, 'y', { duration: .5, ease: 'power3.out' })];
    // caché jusqu'au premier mouvement : jamais de point orphelin dans le coin de l'écran
    c.classList.add('is-hidden');
    let moved = false;
    addEventListener('pointermove', (e) => {
      if (!moved) { moved = true; gsap.set([dot, pill], { x: e.clientX, y: e.clientY }); if (!html.classList.contains('intro-running')) c.classList.remove('is-hidden'); }
      qx.forEach((q) => q(e.clientX)); qy.forEach((q) => q(e.clientY));
    }, { passive: true });
    document.addEventListener('pointerleave', () => c.classList.add('is-hidden'));
    document.addEventListener('pointerenter', () => c.classList.remove('is-hidden'));
    App.cursorLabel = (t) => { if (t) { label.textContent = t; c.classList.add('is-label'); } else c.classList.remove('is-label'); };
    App.cursorTheme = () => c.classList.toggle('on-photo', H.theme === 'photo');
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor]');
      const field = e.target.closest('input, textarea, select');
      c.classList.toggle('is-hidden', !!field || html.classList.contains('intro-running'));
      App.cursorLabel(t && !field ? t.dataset.cursor : null);
    });
  }

  /* ——— heure de Briançon ——— */
  function initClock() {
    const els = $$('[data-clock]');
    if (!els.length) return;
    const f = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
    const tick = () => { const [h, m] = f.format(new Date()).split(':'); els.forEach((el) => { el.innerHTML = `${h}<span class="${motion ? 'clock__sep' : ''}">:</span>${m}`; }); };
    tick(); setInterval(tick, 15000);
  }

  /* ——— pied de page révélé par-dessous ——— */
  function initFooter() {
    const f = $('.footer'), logo = $('.footer__logo', f);
    // le pied de page n'est glissé sous la page que s'il tient dans l'écran ; le logo gaufré s'ajuste
    const set = () => {
      if (!desktop() || !motion) { f.classList.remove('is-under'); html.style.setProperty('--footer-under', '0px'); return; }
      const rest = f.offsetHeight - logo.offsetHeight;
      const w = Math.min(innerWidth * .92, Math.max(0, innerHeight - header.offsetHeight - rest - 8) * (1286.11 / 643.35));
      html.style.setProperty('--emboss-w', `${Math.round(w)}px`);
      const fits = w > innerWidth * .45;
      f.classList.toggle('is-under', fits);
      html.style.setProperty('--footer-under', fits ? `${f.offsetHeight}px` : '0px');
    };
    set();
    addEventListener('resize', set);
    new ResizeObserver(() => { const h = f.offsetHeight; if (h !== f._h) { f._h = h; set(); } }).observe(f);
    $('[data-top]', f)?.addEventListener('click', () => App.scrollTo(0, { duration: 2.2 }));
    if (desktop()) $$('.fcol', f).forEach((d) => { d.open = true; });
    else $$('.fcol', f).forEach((d) => { d.open = false; });
  }

  /* ——— essences : citation au toucher ——— */
  function initEssences() {
    $$('.essence').forEach((b) => b.addEventListener('click', () => {
      const on = b.getAttribute('aria-expanded') !== 'true';
      $$('.essence').forEach((x) => x.setAttribute('aria-expanded', 'false'));
      b.setAttribute('aria-expanded', String(on));
    }));
  }

  // l'intro passe avant tout : les initialisations lourdes (découpage des titres, recalcul des
  // déclencheurs) attendent sa fin, puis un moment calme du navigateur
  App.introDone = new Promise((r) => { App.resolveIntro = r; });
  if (!html.classList.contains('has-intro')) App.resolveIntro();
  const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 700 }) : setTimeout(r, 120)));

  App.init = () => {
    if (App.ready) return;
    App.ready = true;
    initButtons(); initCursor(); initForms(); initFooter(); initEssences();
    Promise.all([fontsReady, App.introDone]).then(idle).then(() => {
      initPill(); initReveals(); initParallax();
      document.dispatchEvent(new CustomEvent('app:ready'));
      ScrollTrigger.refresh();
      onScroll();
    });
  };
  initClock();
  document.addEventListener('DOMContentLoaded', App.init);
})();
