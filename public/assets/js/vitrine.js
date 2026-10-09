/* S4 — la vitrine « En vente sur plan ».
   Desktop : une seule scène fixe (sticky), qui change avec le programme lu dans la colonne de droite.
   Chaque vue 3D est un diorama de 2 ou 3 plans qui respirent sous la main et au scroll ; on entre
   dans le chalet automatiquement à mi-fiche (le chalet B du Serre d'Orchis : par son propre vitrage).
   Mobile : chaque programme porte ses deux dioramas dans le flux.
   Les vues 3D restent des vues 3D : légende permanente, format carte, jamais en plein écran. */
(() => {
  const App = window.App;
  if (!App || !App.ok) return;
  const { $, $$, motion, desktop } = App;
  const dataEl = $('#vitrine-data');
  if (!dataEl) return;
  const DATA = JSON.parse(dataEl.textContent);
  const PROGS = DATA.progs, SC = DATA.scenes;
  const arts = $$('.prog');
  const stage = $('.stage'), scene = $('.scene'), frame = $('.scene__frame'), cap = $('.scene__cap'), label = $('.stage__label');
  const muntins = $('.scene__muntins'), toggles = $$('.toggle__b'), dashes = $$('.stage__progress i');
  const LEG = 'VUE 3D · ILLUSTRATION NON CONTRACTUELLE · ';
  const state = { prog: 0, lots: PROGS.map((p) => p.def), view: 'ext', forced: null };
  const lotOf = (i) => PROGS[i].lots.find((l) => l.id === state.lots[i]) || PROGS[i].lots[0];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ——— AVIF disponible ? ——— */
  const avif = new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i.width > 0); i.onerror = () => res(false);
    i.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAJQAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAALW1kYXQSAAoIGAAGiAhoNCAyFxlHh4Yhh5555oAAAJBAyRjbu51tkhGY';
  });

  /* ——— géométrie : coordonnées naturelles → px du cadre (cover, centré, enveloppe ×1,08) ——— */
  const dims = (s) => (s.layers ? [s.layers.w, s.layers.h] : s.flat ? [s.flat.w, s.flat.h] : [4, 3]);
  function mapper(s, fw, fh, fx = .5) {
    const [W, H] = dims(s);
    const k = Math.max(fw / W, fh / H), ox = (fw - W * k) * fx, oy = (fh - H * k) / 2, cx = fw / 2, cy = fh / 2;
    return (x, y) => [cx + (ox + x * k - cx) * 1.08, cy + (oy + y * k - cy) * 1.08];
  }
  function innerBox(s, ratio, fx = .5) { // la boîte du rendu entier, qui couvre le cadre
    const [W, H] = dims(s), r = W / H;
    if (r >= ratio) { const w = (r / ratio) * 100; return { left: `${(100 - w) * fx}%`, top: '0%', width: `${w}%`, height: '100%' }; }
    const h = (ratio / r) * 100; return { left: '0%', top: `${(100 - h) / 2}%`, width: '100%', height: `${h}%` };
  }

  /* ——— construction d'une vue (plans ou image plate) ——— */
  function img(src, alt = '') {
    const im = new Image();
    im.decoding = 'async'; im.alt = alt; im.draggable = false;
    if (src.srcset) { im.sizes = src.sizes || '(min-width: 1024px) 760px, 100vw'; im.srcset = src.srcset; } else im.src = src;
    return im;
  }
  function buildView(id, { ratio = 4 / 3, mobile = false, fx = .5 } = {}) {
    const s = SC[id];
    const el = document.createElement('div');
    el.className = 'view';
    el.dataset.scene = id;
    const view = { id, s, el, planes: [], kind: 'flat' };
    const loads = [];
    const done = (im) => loads.push(im.decode ? im.decode().catch(() => {}) : Promise.resolve());
    const L = s.layers && motion ? (mobile ? s.layers.mobile : s.layers) : null;
    if (L && L.planes && L.planes.length) {
      view.kind = 'layers';
      const wrap = document.createElement('div'); wrap.className = 'view__planes';
      const inner = document.createElement('div'); inner.className = 'view__inner';
      Object.assign(inner.style, { position: 'absolute', ...innerBox(s, ratio, fx) });
      const [W, H] = dims(s);
      avif.then((ok) => {
        L.planes.forEach((p, n) => {
          const pl = document.createElement('div'); pl.className = `pl pl--${p.name}`;
          const [x0, y0, x1, y1] = p.bbox || [0, 0, W, H];
          Object.assign(pl.style, { position: 'absolute', left: `${(x0 / W) * 100}%`, top: `${(y0 / H) * 100}%`, width: `${((x1 - x0) / W) * 100}%`, height: `${((y1 - y0) / H) * 100}%` });
          const im = img(ok && p.avif ? p.avif : p.webp, n === L.planes.length - 1 && p.name === 'front' ? '' : '');
          Object.assign(im.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
          pl.append(im); inner.append(pl); done(im);
          view.planes.push({ el: pl, img: im, speed: p.speed, name: p.name, cx: (x0 + x1) / 2 / W });
        });
      });
      wrap.append(inner); el.append(wrap);
      view.ready = avif.then(() => Promise.all(loads));
    } else if (s.flat) {
      const wrap = document.createElement('div'); wrap.className = 'view__flat';
      const im = img({ srcset: '' });
      avif.then((ok) => { im.srcset = ok ? s.flat.avif : s.flat.webp; done(im); });
      im.style.objectPosition = `${fx * 100}% 50%`;
      wrap.append(im); el.append(wrap);
      view.planes.push({ el: wrap, img: im, speed: .5, name: 'flat', cx: .5 });
      view.ready = avif.then(() => Promise.all(loads));
    } else {
      view.ready = Promise.resolve();
    }
    view.alt = s.flat ? s.flat.alt : '';
    return view;
  }

  /* ——— assemblage des plans à l'apparition ——— */
  function assemble(view, { short = false, interior = false } = {}) {
    const k = short ? .55 : 1;
    view.planes.forEach((p) => {
      gsap.killTweensOf(p.img);
      if (p.name === 'back' || p.name === 'flat' || p.name === 'back+mid') gsap.fromTo(p.img, { scale: 1.08 }, { scale: 1, duration: 1.6 * k, ease: 'out' });
      else if (p.name === 'mid') gsap.fromTo(p.img, { yPercent: 4 }, { yPercent: 0, duration: 1.3 * k, ease: 'out' });
      else if (p.name === 'front') {
        if (interior) gsap.fromTo(p.img, { yPercent: 12, scale: 1.1 }, { yPercent: 0, scale: 1, duration: 1.2 * k, ease: 'out', delay: .1 * k });
        else gsap.fromTo(p.img, { xPercent: p.cx < .5 ? -6 : 6, scale: 1.1 }, { xPercent: 0, scale: 1, duration: 1.2 * k, ease: 'out', delay: .1 * k });
      }
    });
  }

  /* ——— porte en pignon centrée sur un point (px du cadre) ——— */
  function door(el, cx, cy, t, fw, fh) {
    const reach = Math.hypot(Math.max(cx, fw - cx), Math.max(cy, fh - cy)) * 1.25;
    const hw = Math.max(.5, t * reach);
    if (t >= 1) { el.style.clipPath = 'none'; return; }
    el.style.clipPath = `polygon(${cx}px ${cy - 1.25 * hw}px, ${cx + hw}px ${cy - .45 * hw}px, ${cx + hw}px ${cy + hw}px, ${cx - hw}px ${cy + hw}px, ${cx - hw}px ${cy - .45 * hw}px)`;
  }

  /* ================= DESKTOP : la scène fixe ================= */
  const cache = new Map();
  let cur = null, running = null, tick = null;
  const pointer = { tx: 0, ty: 0, x: 0, y: 0, inside: false };
  const getView = (id) => { if (!cache.has(id)) cache.set(id, buildView(id)); return cache.get(id); };
  const fsize = () => [frame.clientWidth, frame.clientHeight];

  function setLabels(i, kind) {
    const p = PROGS[i], lot = lotOf(i);
    const text = `${p.n} / 0${PROGS.length} — ${p.nom.toUpperCase()}`;
    if (label.textContent !== text) {
      gsap.timeline().to(label, { yPercent: -110, duration: .3, ease: 'in' }).add(() => { label.textContent = text; })
        .fromTo(label, { yPercent: 110 }, { yPercent: 0, duration: .5, ease: 'out' });
    }
    cap.textContent = LEG + (kind === 'int' ? lot.legInt : lot.legExt);
    const v = cache.get(kind === 'int' ? lot.int : lot.ext);
    frame.setAttribute('aria-label', v && v.alt ? v.alt : `Vue 3D, illustration non contractuelle : ${p.nom}`);
    toggles.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === kind)));
    dashes.forEach((d, n) => d.classList.toggle('is-on', n === i));
    scene.dataset.cursor = kind === 'int' ? 'Sortir' : 'Entrer';
    if (scene.matches(':hover')) App.cursorLabel?.(scene.dataset.cursor);
  }

  function finishRunning() { if (running) { running.progress(1); running = null; } }

  function attach(view) {
    if (view.el.parentNode !== frame) frame.append(view.el);
    gsap.set(view.el, { clearProps: 'transform,opacity,clipPath,visibility' });
    view.el.style.zIndex = '2';
  }
  function detach(view) { if (view && view !== cur && view.el.parentNode) view.el.remove(); }
  async function ready(view) {
    let t = setTimeout(() => scene.classList.add('is-loading'), 120);
    await Promise.race([view.ready, new Promise((r) => setTimeout(r, 2500))]);
    clearTimeout(t); scene.classList.remove('is-loading');
  }

  async function show(id, how, opts = {}) {
    finishRunning();
    const prev = cur, next = getView(id);
    if (prev && prev.id === id) return;
    await ready(next);
    finishRunning();
    cur = next;
    attach(next);
    if (prev) prev.el.style.zIndex = '1';
    const [fw, fh] = fsize();
    const tl = (running = gsap.timeline({ onComplete: () => { running = null; detach(prev); if (prev) gsap.set(prev.el, { clearProps: 'transform,opacity,clipPath' }); } }));

    if (how === 'instant' || !prev) {
      assemble(next, { short: true });
      if (!prev) gsap.fromTo(next.el, { opacity: 0 }, { opacity: 1, duration: .6 });
      return;
    }
    if (how === 'fade') {
      tl.fromTo(next.el, { opacity: 0 }, { opacity: 1, duration: .6, ease: 'out' });
      assemble(next, { short: true });
      return;
    }
    if (how === 'door') { // changement de programme
      const e = next.s.entry ? mapper(next.s, fw, fh)(...next.s.entry) : [fw / 2, fh * .55];
      const g = { t: 0 };
      tl.to(prev.el, { scale: 1.06, opacity: 0, duration: .6, ease: 'in' }, 0)
        .fromTo(g, { t: 0 }, { t: 1, duration: 1.1, ease: 'inOut', onUpdate: () => door(next.el, e[0], e[1], g.t, fw, fh) }, .1);
      door(next.el, e[0], e[1], 0, fw, fh);
      gsap.delayedCall(.1, () => assemble(next));
      return;
    }
    const exterior = how === 'enter' ? prev : next, interior = how === 'enter' ? next : prev;
    const entry = exterior.s.entry;
    const pt = entry ? mapper(exterior.s, fw, fh)(...entry) : [fw / 2, fh * .55];
    if (how === 'enter' && opts.vitrage && exterior.kind === 'layers') return vitrage(tl, exterior, interior, fw, fh);
    if (how === 'exit' && opts.vitrage && exterior.kind === 'layers') return vitrage(tl, exterior, interior, fw, fh, true);
    const g = { t: 0 };
    if (how === 'enter') {
      gsap.set(exterior.el, { transformOrigin: `${pt[0]}px ${pt[1]}px` });
      tl.to(exterior.el, { scale: 1.35, duration: 1.1, ease: 'inOut' }, 0)
        .fromTo(g, { t: 0 }, { t: 1, duration: 1.1, ease: 'inOut', onUpdate: () => door(interior.el, pt[0], pt[1], g.t, fw, fh) }, 0)
        .add(() => assemble(interior, { interior: true }), .35);
      door(interior.el, pt[0], pt[1], 0, fw, fh);
    } else { // sortie : l'inverse, plus court
      interior.el.style.zIndex = '2'; exterior.el.style.zIndex = '1';
      gsap.set(exterior.el, { transformOrigin: `${pt[0]}px ${pt[1]}px`, scale: 1.35 });
      tl.to(exterior.el, { scale: 1, duration: .9, ease: 'inOut' }, 0)
        .fromTo(g, { t: 1 }, { t: 0, duration: .9, ease: 'inOut', onUpdate: () => door(interior.el, pt[0], pt[1], g.t, fw, fh) }, 0);
      // la vue sortante (intérieur) doit rester au-dessus pendant qu'elle se referme
      tl.eventCallback('onComplete', () => { running = null; interior.el.style.clipPath = ''; detach(interior); gsap.set(exterior.el, { clearProps: 'transform' }); });
    }
  }

  /* entrée dans le chalet B du Serre d'Orchis par son propre vitrage (2 × 3 carreaux) */
  const GLASS = [684, 322, 961, 567], WALL = [540, 75, 1335, 590], MULL = { x: [776, 869], y: 445 };
  function vitrage(tl, ext, int, fw, fh, reverse = false) {
    const m = mapper(ext.s, fw, fh), mi = mapper(int.s, fw, fh);
    const [gx0, gy0] = m(GLASS[0], GLASS[1]), [gx1, gy1] = m(GLASS[2], GLASS[3]);
    const O = [(gx0 + gx1) / 2, (gy0 + gy1) / 2];
    const S = (fw / (gx1 - gx0)) * 1.04;
    const [wx0, wy0] = mi(WALL[0], WALL[1]), [wx1, wy1] = mi(WALL[2], WALL[3]);
    const front = ext.planes.find((p) => p.name === 'front');
    const svgNS = 'http://www.w3.org/2000/svg';
    muntins.setAttribute('viewBox', `0 0 ${fw} ${fh}`);
    muntins.innerHTML = '';
    const lines = [0, 1, 2, 3, 4].map(() => { const l = document.createElementNS(svgNS, 'line'); muntins.append(l); return l; });
    gsap.set(ext.el, { transformOrigin: `${O[0]}px ${O[1]}px` });
    int.el.style.zIndex = '2'; ext.el.style.zIndex = '1';
    const smooth = (t) => t * t * (3 - 2 * t);
    const g = { p: reverse ? 1 : 0 };
    const draw = () => {
      const p = g.p, e = App.ease.inOut(p);
      const s = Math.pow(S, e);
      ext.el.style.transform = `scale(${s})`;
      if (front) front.img.style.transform = `translateX(${-35 * e}%)`;
      ext.el.style.opacity = String(1 - clamp((p - .55) / .15));
      const R = [O[0] + (gx0 - O[0]) * s, O[1] + (gy0 - O[1]) * s, O[0] + (gx1 - O[0]) * s, O[1] + (gy1 - O[1]) * s];
      const w = smooth(clamp((p - .35) / .45));
      if (p < .35) { int.el.style.visibility = 'hidden'; } else {
        int.el.style.visibility = 'visible';
        const C = [lerp(R[0], 0, w), lerp(R[1], 0, w), lerp(R[2], fw, w), lerp(R[3], fh, w)];
        int.el.style.clipPath = w >= 1 ? 'none' : `inset(${Math.max(0, C[1])}px ${Math.max(0, fw - C[2])}px ${Math.max(0, fh - C[3])}px ${Math.max(0, C[0])}px)`;
        const sg = (R[2] - R[0]) / (wx1 - wx0);
        const tx = (R[0] + R[2]) / 2 - ((wx0 + wx1) / 2) * sg, ty = (R[1] + R[3]) / 2 - ((wy0 + wy1) / 2) * sg;
        const sc = lerp(sg, 1, w);
        int.el.style.transformOrigin = '0 0';
        int.el.style.transform = `translate(${lerp(tx, 0, w)}px, ${lerp(ty, 0, w)}px) scale(${sc})`;
      }
      // meneaux : la même grille, vue de dehors puis de dedans
      const mo = clamp(p / .25) * (1 - clamp((p - .6) / .2)) * .9;
      muntins.style.opacity = String(mo);
      if (mo > 0) {
        const X = (x) => O[0] + (m(x, 0)[0] - O[0]) * s, Y = (y) => O[1] + (m(0, y)[1] - O[1]) * s;
        const seg = [[GLASS[0], GLASS[1], GLASS[2], GLASS[1]], [GLASS[0], GLASS[3], GLASS[2], GLASS[3]], [MULL.x[0], GLASS[1], MULL.x[0], GLASS[3]], [MULL.x[1], GLASS[1], MULL.x[1], GLASS[3]], [GLASS[0], MULL.y, GLASS[2], MULL.y]];
        seg.forEach((sg2, n) => { const l = lines[n]; l.setAttribute('x1', X(sg2[0])); l.setAttribute('y1', Y(sg2[1])); l.setAttribute('x2', X(sg2[2])); l.setAttribute('y2', Y(sg2[3])); });
      }
    };
    draw();
    tl.to(g, { p: reverse ? 0 : 1, duration: reverse ? 1.1 : 1.6, ease: 'none', onUpdate: draw });
    tl.eventCallback('onComplete', () => {
      running = null;
      muntins.style.opacity = '0';
      if (front) front.img.style.transform = '';
      if (!reverse) { gsap.set(ext.el, { clearProps: 'transform,opacity' }); gsap.set(int.el, { clearProps: 'transform,clipPath,visibility' }); detach(ext); }
      else { gsap.set(int.el, { clearProps: 'transform,clipPath,visibility' }); gsap.set(ext.el, { clearProps: 'transform,opacity' }); detach(int); }
    });
    if (!reverse) gsap.delayedCall(.9, () => assemble(int, { short: true, interior: true }));
  }

  function viewId(i, kind) { const l = lotOf(i); return kind === 'int' ? l.int : l.ext; }
  function setView(kind, { force = false } = {}) {
    if (force) state.forced = kind;
    if (kind === state.view) return;
    const i = state.prog, lot = lotOf(i);
    state.view = kind;
    setLabels(i, kind);
    show(viewId(i, kind), kind === 'int' ? 'enter' : 'exit', { vitrage: lot.entree === 'vitrage' });
    window.dataLayer?.push({ event: 'toggle_interieur', programme: PROGS[i].id, vue: kind });
  }
  function toProgram(i) {
    if (i === state.prog && cur) return;
    state.prog = i; state.forced = null;
    const r = arts[i].getBoundingClientRect();
    state.view = r.top + r.height / 2 < innerHeight * .6 ? 'int' : 'ext';
    setLabels(i, state.view);
    show(viewId(i, state.view), cur ? 'door' : 'instant');
    preload(i + 1);
  }
  function preload(i) {
    if (i < 0 || i >= PROGS.length) return;
    const l = lotOf(i);
    getView(l.ext); getView(l.int);
  }

  function initStage() {
    if (!stage || !motion || !desktop()) return false;
    // une scène, des fiches : chaque bloc pilote la scène
    arts.forEach((art, i) => {
      ScrollTrigger.create({ trigger: art, start: 'top 55%', end: 'bottom 55%', onToggle: (st) => { if (st.isActive) toProgram(i); } });
      ScrollTrigger.create({
        trigger: art, start: 'center 60%',
        onEnter: () => { if (i === state.prog && !state.forced) setView('int'); },
        onLeaveBack: () => { if (i === state.prog && !state.forced) setView('ext'); },
      });
      art.addEventListener('focusin', () => {
        if (i !== state.prog) App.scrollTo(art, { offset: -80, duration: 1 });
      });
    });
    toggles.forEach((b) => {
      b.addEventListener('click', () => setView(b.dataset.view, { force: true }));
      b.addEventListener('pointerenter', () => preload(state.prog));
    });
    scene.addEventListener('click', () => setView(state.view === 'ext' ? 'int' : 'ext', { force: true }));
    scene.tabIndex = 0;
    scene.setAttribute('role', 'button');
    scene.setAttribute('aria-label', 'Entrer dans le chalet ou en sortir');
    scene.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scene.click(); } });

    // respiration : pointeur + scroll, seulement quand la scène est visible
    scene.addEventListener('pointermove', (e) => {
      const r = scene.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1; pointer.inside = true;
    }, { passive: true });
    scene.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; pointer.inside = false; });
    let t0 = 0;
    tick = (time) => {
      if (!cur) return;
      pointer.x += (pointer.tx - pointer.x) * .06; pointer.y += (pointer.ty - pointer.y) * .06;
      const r = arts[state.prog].getBoundingClientRect();
      const v = -clamp((r.top + r.height / 2 - innerHeight / 2) / (r.height / 2 + innerHeight / 2), -1, 1);
      const drift = pointer.inside ? 0 : Math.sin((time - t0) * (Math.PI * 2 / 8)) * 4;
      for (const p of cur.planes) {
        const x = p.speed * pointer.x * 11 + (p.name === 'front' ? drift : 0);
        const y = p.speed * (pointer.y * .35 + v) * 24;
        const s = p.name === 'front' ? 1 + .06 * Math.max(0, -v) : 1;
        p.el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${s.toFixed(4)})`;
      }
    };
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { frame.style.willChange = 'transform'; gsap.ticker.add(tick); } else { frame.style.willChange = ''; gsap.ticker.remove(tick); }
    }).observe(scene);
    // chargement : le programme actif et le suivant, à 1,5 écran de distance
    new IntersectionObserver(([e]) => { if (e.isIntersecting) { preload(0); preload(1); } }, { rootMargin: '150% 0px' }).observe(stage);
    toProgram(0);
    return true;
  }

  /* ================= LOTS (tous formats) ================= */
  function initLots() {
    arts.forEach((art, i) => {
      const tabs = $$('[role="tab"]', art);
      if (!tabs.length) return;
      const cta = $('.prog__cta [data-drawer]', art);
      const select = (tab, focus = false) => {
        const id = tab.dataset.lot;
        if (id === state.lots[i]) return;
        const before = lotOf(i);
        state.lots[i] = id;
        const lot = lotOf(i);
        tabs.forEach((t) => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
        $$('.fiche', art).forEach((f) => {
          const on = f.dataset.lot === id;
          f.hidden = !on; f.classList.toggle('is-active', on);
          if (on && motion) {
            gsap.fromTo($$('dd .roll', f), { yPercent: 100 }, { yPercent: 0, duration: .7, ease: 'out', stagger: .05 });
            gsap.fromTo(f, { '--x': 0 }, { '--x': 1, duration: .5 });
            gsap.fromTo($('.fiche__t', f), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .6 });
          }
        });
        if (focus) tab.focus();
        if (cta) cta.dataset.lot = id;
        updateDioramas(art, i);
        if (cur && i === state.prog) {
          setLabels(i, state.view);
          const want = viewId(i, state.view);
          if (cur.id !== want) show(want, 'fade');
        }
        window.dataLayer?.push({ event: 'lot_select', programme: PROGS[i].id, lot: id, depuis: before.id });
      };
      tabs.forEach((t, n) => {
        t.addEventListener('click', () => select(t));
        t.addEventListener('keydown', (e) => {
          const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          select(tabs[(n + d + tabs.length) % tabs.length], true);
        });
        const warm = () => { const l = PROGS[i].lots.find((x) => x.id === t.dataset.lot); if (l && cache) { getView(l.ext); getView(l.int); } };
        t.addEventListener('pointerenter', warm); t.addEventListener('focus', warm);
      });
    });
  }

  /* ================= MOBILE (et sans scène fixe) : les dioramas du flux ================= */
  function setFlat(fig, id) {
    const s = SC[id];
    if (!s || !s.flat || fig.dataset.scene === id) return;
    fig.dataset.scene = id;
    const pic = $('picture', fig);
    if (!pic) return;
    $$('source', pic).forEach((so) => { so.srcset = so.type === 'image/avif' ? s.flat.avif : s.flat.webp; });
    const im = $('img', pic);
    im.alt = s.flat.alt || '';
  }
  function updateDioramas(art, i) {
    const lot = lotOf(i);
    const ext = $('.diorama--ext', art), int = $('.diorama--int', art);
    [[ext, lot.ext, lot.legExt], [int, lot.int, lot.legInt]].forEach(([fig, id, leg]) => {
      if (!fig) return;
      $('figcaption', fig).textContent = LEG + leg;
      if (fig.dataset.scene === id) return;
      if (fig._view) { // diorama en plans : on reconstruit
        const v = buildView(id, { ratio: 4 / 5, mobile: true, fx: fig._fx });
        fig._view.el.replaceWith(v.el); fig._view = v; fig.dataset.scene = id; assemble(v, { short: true });
      } else setFlat(fig, id);
    });
  }
  const FX = { V56: .6, V54: .45, V34: .3, V26: .5 };
  function initDioramas() {
    if (stage && motion && desktop()) return;
    $$('.diorama').forEach((fig) => {
      const id = fig.dataset.scene, s = SC[id];
      const fx = fig.classList.contains('diorama--ext') ? (FX[id] ?? .5) : .5;
      fig._fx = fx;
      const pic = $('.pic', fig);
      if (pic) $('img', pic).style.objectPosition = `${fx * 100}% 50%`;
      if (!motion) return;
      const frameEl = $('.diorama__frame', fig);
      if (s && s.layers && s.layers.mobile) {
        const v = buildView(id, { ratio: 4 / 5, mobile: true, fx });
        fig._view = v;
        v.el.style.position = 'absolute'; v.el.style.inset = '0';
        const swap = () => { frameEl.append(v.el); if (pic) pic.style.visibility = 'hidden'; assemble(v, { short: true, interior: fig.classList.contains('diorama--int') }); };
        App.onEnter(fig, () => v.ready.then(swap), 'top 140%');
        ScrollTrigger.create({
          trigger: fig, start: 'top bottom', end: 'bottom top',
          onUpdate: (st) => { const vv = st.progress * 2 - 1; fig._view.planes.forEach((p) => { p.el.style.transform = `translate3d(0,${(p.speed * vv * 24 * .5).toFixed(2)}px,0)`; }); },
        });
      } else if (pic) {
        gsap.fromTo(pic, { yPercent: -3, scale: 1.08 }, { yPercent: 3, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: .5 } });
      }
      if (fig.classList.contains('diorama--int')) {
        const g = { a: 100, e: 100 };
        const draw = () => { frameEl.style.clipPath = `polygon(50% ${g.a}%, 100% ${g.e}%, 100% 100%, 0% 100%, 0% ${g.e}%)`; };
        draw();
        App.onEnter(fig, () => gsap.timeline({ onUpdate: draw, onComplete: () => { frameEl.style.clipPath = ''; } })
          .to(g, { a: 0, e: 22, duration: .75, ease: 'in' }).to(g, { e: 0, duration: .55, ease: 'out' }), 'top 80%');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initLots();
    if (!initStage()) initDioramas();
  });
})();
