/* Sections 01, 02 et 04, et le film : la citation qui se met au point mot à mot, la bascule extérieur /
   intérieur des vues 3D de chaque programme, les chiffres de la maison, la vidéo qui remplit l'écran. */
(() => {
  const App = window.App;
  if (!App) return;
  const { $, $$ } = App;

  /* ——— 02 : extérieur / intérieur (fonctionne aussi sans mouvement) ——— */
  function views() {
    $$('.prog').forEach((prog) => {
      const btns = $$('.prog__switch button', prog), pics = $$('.prog__view', prog);
      const show = (kind) => {
        btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === kind)));
        pics.forEach((p) => {
          const on = p.dataset.view === kind;
          if (on) { const im = $('img', p); if (im) im.loading = 'eager'; }
          p.classList.toggle('is-on', on);
        });
      };
      btns.forEach((b) => {
        b.addEventListener('click', () => show(b.dataset.view));
        // l'intérieur est chargé dès qu'on s'en approche : la bascule est instantanée
        b.addEventListener('pointerenter', () => { const im = $(`.prog__view[data-view="${b.dataset.view}"] img`, prog); if (im) im.loading = 'eager'; }, { once: true });
      });
    });
  }

  /* ——— le film : lecture muette à l'écran, son au bouton, pause au clic (sans autre contrôle) ——— */
  function film() {
    const root = $('.film');
    if (!root) return;
    const v = $('.film__v', root), frame = $('.film__frame', root), sound = $('.film__sound', root), sl = $('.film__sl', sound);
    const auto = App.motion; // sans mouvement : rien ne démarre seul
    if (matchMedia('(min-width: 1101px)').matches) v.poster = '/assets/video/film-poster-1920.webp';
    let wanted = false, user = false; // lecture voulue (à l'écran) ; pause demandée par le visiteur
    const label = () => {
      const paused = v.paused;
      frame.setAttribute('aria-label', paused ? 'Lire la vidéo' : 'Mettre la vidéo en pause');
      frame.dataset.cursor = paused ? 'Lecture' : 'Pause';
      App.cursorLabel?.(frame.matches(':hover') ? frame.dataset.cursor : null);
    };
    const play = () => { if (v.preload !== 'auto') v.preload = 'auto'; const p = v.play(); if (p) p.catch(() => {}); };
    v.addEventListener('play', label); v.addEventListener('pause', label);
    label();
    if ('IntersectionObserver' in window) {
      // on charge à l'approche, on lit à l'écran, on met en pause hors de l'écran
      new IntersectionObserver(([e]) => { if (e.isIntersecting && v.preload === 'none') v.preload = 'metadata'; }, { rootMargin: '100% 0px' }).observe(root);
      new IntersectionObserver(([e]) => {
        wanted = e.isIntersecting;
        if (wanted && auto && !user) play(); else if (!wanted) v.pause();
      }, { threshold: .2 }).observe(frame);
    }
    const toggle = () => { if (v.paused) { user = false; play(); } else { user = true; v.pause(); } };
    frame.addEventListener('click', toggle);
    frame.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    sound.addEventListener('click', () => {
      v.muted = !v.muted;
      sound.setAttribute('aria-pressed', String(!v.muted));
      sl.textContent = v.muted ? 'Activer le son' : 'Couper le son';
      if (!v.muted && v.paused) { user = false; play(); }
    });
  }

  /* ——— le film grandit jusqu'à remplir l'écran ——— */
  function filmScroll() {
    const root = $('.film');
    if (!root) return;
    const frame = $('.film__frame', root), v = $('.film__v', root), back = $('.film__back', root), cap = $('.film__cap', root);
    const portrait = () => matchMedia('(max-aspect-ratio: 1/1)').matches;
    const s0 = () => (portrait() ? .82 : .5);
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true,
      onUpdate: (st) => { const dark = st.progress > .55; if (dark !== root._dark) { root._dark = dark; root.dataset.header = dark ? 'photo' : 'paper'; App.onScroll?.(); } } } })
      .fromTo(frame, { scale: s0 }, { scale: 1, duration: .7, ease: 'power1.inOut' }, 0)
      .fromTo(v, { scale: 1.14 }, { scale: 1, duration: .7, ease: 'power1.inOut' }, 0)
      .fromTo(back, { opacity: 0 }, { opacity: 1, duration: .45 }, .2)
      .fromTo(cap, { opacity: 1 }, { opacity: 0, duration: .2 }, .05)
      .to({}, { duration: .3 });
    // avant la scène : le cadre monte légèrement en entrant dans l'écran
    gsap.fromTo(frame, { y: 60 }, { y: 0, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'top top', scrub: true } });
  }

  if (!App.ok) { document.addEventListener('DOMContentLoaded', () => { views(); film(); stats(); }); return; }

  /* ——— 01 : la phrase se met au point au défilement ; chaque image qu'elle évoque se pose sur la précédente ———
     Les mots passent du flou au net (faux blur : double flouté figé, seules les opacités bougent) ; quand
     un fragment de la phrase devient net, sa photo arrive d'en bas et recouvre la précédente, qui s'assombrit. */
  function story() {
    const root = $('.real__story');
    if (!root) return;
    const q = $('.real__quote', root), cards = $$('.real__card', root);
    // les photos sont cachées sous la scène : on les charge à l'approche, pas au dernier moment
    App.onEnter(root, () => cards.forEach((c) => { const im = $('img', c); if (im) im.loading = 'eager'; }), 'top 250%');
    const words = App.blurWords(q);
    const shotOf = (w) => { const e = w.w.closest('[data-shot]'); return e ? +e.dataset.shot : -1; };
    gsap.set(words.map((x) => x.s), { opacity: .1 });
    gsap.set(words.map((x) => x.b), { opacity: .55 });
    const tilt = [-1.6, 1.2, -.6];
    const caps = cards.map((c) => $('figcaption', c));
    // départ : sous le bas de l'écran, quelle que soit la place de la pile dans la scène
    const pin = $('.real__pin', root), stack = $('.real__stack', root);
    const below = () => pin.clientHeight - stack.offsetTop + 40;
    gsap.set(cards, { transformOrigin: '50% 100%' });
    gsap.set(caps, { opacity: 0, y: 8 });

    // calendrier : début du mot dans la timeline (0..1), les fragments calés sur l'arrivée de leur photo
    const AT = { pre: [0, .07], 0: [.07, .27], mid1: [.27, .34], 1: [.34, .48], mid2: [.48, .58], 2: [.58, .8] };
    const groups = { pre: [], 0: [], mid1: [], 1: [], mid2: [], 2: [] };
    let seen = -1;
    words.forEach((w) => {
      const sh = shotOf(w);
      if (sh >= 0) { groups[sh].push(w); seen = sh; } else groups[seen < 0 ? 'pre' : seen === 0 ? 'mid1' : 'mid2'].push(w);
    });
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: .6, invalidateOnRefresh: true } });
    Object.entries(groups).forEach(([k, list]) => {
      const [a, b] = AT[k], step = list.length ? (b - a) / list.length : 0;
      list.forEach((w, n) => {
        const t = a + n * step;
        tl.to(w.s, { opacity: 1, duration: step * 2.2 }, t).to(w.b, { opacity: 0, duration: step * 2.2 }, t + step * .3);
      });
    });
    // les photos : la nouvelle monte et se pose, l'ancienne recule et s'assombrit
    const land = [.1, .36, .6];
    cards.forEach((c, n) => {
      tl.fromTo(c, { y: below, yPercent: 0, rotation: tilt[n] * 3, scale: .94 }, { y: 0, yPercent: n * -2.5, rotation: tilt[n], scale: 1, duration: .2, ease: 'power2.out', immediateRender: true }, land[n])
        .to(caps[n], { opacity: 1, y: 0, duration: .08 }, land[n] + .12);
      if (n) {
        tl.to(cards.slice(0, n), { scale: (i) => .955 - (n - 1 - i) * .02, '--shade': (i) => .32 + (n - 1 - i) * .14, duration: .2, ease: 'power1.inOut' }, land[n])
          .to(caps[n - 1], { opacity: 0, duration: .06 }, land[n]);
      }
    });
    tl.to({}, { duration: .12 }, .88);
  }

  /* ——— 04 : les chiffres, et une image qui les montre ———
     800 toits (un par chalet réalisé) qui s'allument au défilement, une règle de 1979 à aujourd'hui,
     40 traits comptés par cinq, 1 300 points (un par mètre carré d'atelier). Rien d'inventé : chaque
     image ne fait que compter le chiffre qu'elle accompagne. */
  const INK = '22,11,19';
  const fit = (cv) => {
    const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  };

  function roofs(still) {
    const box = $('.stat--roofs'), cv = $('.roofs', box);
    if (!cv) return;
    const N = 800, count = $('.stat__count', box), plus = $('.stat__u', box);
    let cols, rows, order, prog = still ? 1 : 0, mx = -1e3, my = -1e3, raf = 0;
    const layout = () => {
      cols = innerWidth < 768 ? 20 : 40; rows = N / cols;
      cv.style.aspectRatio = innerWidth < 768 ? '20 / 26' : '40 / 14';
      // ordre d'allumage : une vague en diagonale, du haut à gauche vers le bas à droite
      order = new Float32Array(N);
      const idx = [...Array(N).keys()].sort((a, b) => ((a % cols) / cols + Math.floor(a / cols) / rows * .7) - ((b % cols) / cols + Math.floor(b / cols) / rows * .7));
      idx.forEach((k, n) => { order[k] = n; });
    };
    const draw = () => {
      raf = 0;
      const { ctx, w, h } = fit(cv);
      ctx.clearRect(0, 0, w, h);
      // une petite maison en pignon (comme le toit du logo) par chalet
      const cw = w / cols, ch = h / rows, gw = Math.min(cw * .5, ch * .62), gh = gw * 1.15, eave = gh * .42;
      const lit = prog * N * 1.08, B = 8, paths = Array.from({ length: B + 1 }, () => new Path2D());
      for (let k = 0; k < N; k++) {
        const t = Math.max(0, Math.min(1, (lit - order[k]) / 40));
        const cx = (k % cols + .5) * cw, cy = (Math.floor(k / cols) + .5) * ch;
        const d = Math.hypot(cx - mx, cy - my), lift = d < 70 ? (1 - d / 70) ** 2 * 5 : 0;
        const p = paths[Math.round(t * B)], top = cy - gh / 2 - lift, bot = cy + gh / 2 - lift;
        p.moveTo(cx, top); p.lineTo(cx + gw / 2, top + eave); p.lineTo(cx + gw / 2, bot); p.lineTo(cx - gw / 2, bot); p.lineTo(cx - gw / 2, top + eave); p.closePath();
      }
      paths.forEach((p, b) => { ctx.fillStyle = `rgba(${INK},${.08 + .87 * (b / B)})`; ctx.fill(p); });
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(draw); };
    const show = (p) => {
      prog = p;
      const n = Math.min(N, Math.round(p * N * 1.02));
      count.textContent = String(n);
      plus.style.opacity = n >= N ? '1' : '0';
      ask();
    };
    layout(); draw();
    addEventListener('resize', () => { layout(); ask(); });
    if (still) return;
    show(0);
    ScrollTrigger.create({ trigger: box, start: 'top 75%', end: 'bottom 55%', scrub: .4, onUpdate: (st) => show(st.progress) });
    // au survol, les toits se soulèvent sous le pointeur
    if (App.fine) {
      cv.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; ask(); });
      cv.addEventListener('pointerleave', () => { mx = my = -1e3; ask(); });
    }
  }

  function ruler(still) {
    const svg = $('.ruler');
    if (!svg) return;
    const Y0 = 1979, Y1 = new Date().getFullYear(), NS = 'http://www.w3.org/2000/svg';
    const el = (n, a) => { const e = document.createElementNS(NS, n); Object.entries(a).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
    const build = () => {
      const w = svg.clientWidth || 300, x = (y) => ((y - Y0) / (Y1 - Y0)) * w, base = 26;
      svg.setAttribute('viewBox', `0 0 ${w} 64`);
      svg.replaceChildren();
      const line = el('path', { d: `M0 ${base}H${w}`, class: 'ruler__line' });
      svg.append(line);
      const ticks = [];
      for (let y = Y0; y <= Y1; y++) {
        const major = y === Y0 || y % 10 === 0 || y === 2021 || y === Y1;
        const t = el('line', { x1: x(y), x2: x(y), y1: base, y2: base - (major ? 12 : 6), class: major ? '' : 'ruler__minor' });
        if (y === 2021) t.setAttribute('class', 'ruler__hi');
        svg.append(t); ticks.push(t);
      }
      // 1979 et aujourd'hui sous la règle, 2021 au-dessus, près de son point violet
      const lab = [
        el('text', { x: 0, y: base + 20 }), el('text', { x: x(2021) - 8, y: base - 13, 'text-anchor': 'end' }), el('text', { x: w, y: base + 20, 'text-anchor': 'end' }),
      ];
      lab[0].textContent = '1979 · Fondation'; lab[1].textContent = '2021 · La relève'; lab[2].textContent = 'Aujourd’hui';
      const dot = el('circle', { cx: x(2021), cy: base - 16, r: 2.5, class: 'ruler__dot' });
      svg.append(...lab, dot);
      return { line, ticks, lab, dot };
    };
    const parts = build();
    if (still) return;
    gsap.set(parts.line, { drawSVG: '0%' });
    gsap.set([...parts.ticks, ...parts.lab, parts.dot], { opacity: 0 });
    App.onEnter(svg, () => {
      gsap.timeline()
        .to(parts.line, { drawSVG: '100%', duration: 1.8, ease: 'inOut' })
        .to(parts.ticks, { opacity: 1, duration: .3, stagger: 1.5 / parts.ticks.length }, .1)
        .to(parts.lab, { opacity: 1, duration: .6, stagger: .5 }, .4)
        .fromTo(parts.dot, { opacity: 0, scale: 0, transformOrigin: 'center', transformBox: 'fill-box' }, { opacity: 1, scale: 1, duration: .6, ease: 'back.out(3)' }, 1.4);
    }, 'top 85%');
  }

  function tally(still) {
    const svg = $('.tally');
    if (!svg) return;
    // 40 traits, comptés par cinq (quatre droits, un en travers), légèrement irréguliers comme à la main
    const NS = 'http://www.w3.org/2000/svg', rnd = (k) => (Math.sin(k * 12.9898) * 43758.5453) % 1;
    const strokes = [];
    for (let g = 0; g < 8; g++) {
      const gx = (g % 4) * 102 + 4, gy = Math.floor(g / 4) * 52 + 4;
      for (let k = 0; k < 4; k++) {
        const x = gx + 8 + k * 13 + rnd(g * 9 + k) * 2;
        strokes.push(`M${x} ${gy + rnd(g + k) * 2}L${x + rnd(g * 3 + k) * 2.5} ${gy + 38}`);
      }
      strokes.push(`M${gx} ${gy + 30 + rnd(g) * 3}L${gx + 64} ${gy + 6 + rnd(g + 7) * 3}`);
    }
    const paths = strokes.map((d) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); svg.append(p); return p; });
    if (still) return;
    gsap.set(paths, { drawSVG: '0%' });
    App.onEnter(svg, () => gsap.to(paths, { drawSVG: '100%', duration: .35, ease: 'power2.out', stagger: .045 }), 'top 85%');
  }

  function floor(still) {
    const cv = $('.floor');
    if (!cv) return;
    const C = 50, R = 26; // 50 × 26 = 1 300 points
    let prog = still ? 1 : 0;
    const draw = () => {
      const { ctx, w, h } = fit(cv);
      ctx.clearRect(0, 0, w, h);
      const cw = w / C, ch = h / R, r = Math.max(.8, Math.min(cw, ch) * .2);
      const on = new Path2D(), off = new Path2D();
      for (let k = 0; k < C * R; k++) {
        const c = k % C, rr = Math.floor(k / C), x = (c + .5) * cw, y = (rr + .5) * ch;
        const p = (c / C) * .8 + (rr / R) * .2 <= prog * 1.01 ? on : off;
        p.moveTo(x + r, y); p.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = `rgba(${INK},.13)`; ctx.fill(off);
      ctx.fillStyle = `rgba(${INK},.9)`; ctx.fill(on);
      ctx.strokeStyle = `rgba(${INK},.28)`; ctx.lineWidth = 1; ctx.strokeRect(.5, .5, w - 1, h - 1);
    };
    draw();
    addEventListener('resize', draw);
    if (still) return;
    const o = { p: 0 };
    App.onEnter(cv, () => gsap.to(o, { p: 1, duration: 2.2, ease: 'inOut', onUpdate: () => { prog = o.p; draw(); } }), 'top 85%');
  }

  /* ——— 02 : chaque programme se dévoile (la vue 3D s'ouvre, les chalets du tableau arrivent un à un) ——— */
  function progs() {
    $$('.prog').forEach((prog) => {
      const views = $('.prog__views', prog), rows = $$('.lots tbody tr', prog), bar = $('.prog__bar', prog);
      gsap.set(views, { clipPath: 'inset(10% 7% 10% 7%)' });
      const imgs = $$('.prog__view img', views); // (leur transition CSS de survol est suspendue pendant l'ouverture)
      gsap.set(imgs, { scale: 1.12, transition: 'none' });
      gsap.set(rows, { opacity: 0, y: 10 });
      gsap.set(bar, { opacity: 0 });
      App.onEnter(views, () => {
        gsap.to(views, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'inOut', clearProps: 'clipPath' });
        gsap.to(imgs, { scale: 1, duration: 2, ease: 'out', clearProps: 'transform,transition' });
        gsap.to(bar, { opacity: 1, duration: .8, delay: .8 });
      }, 'top 80%');
      App.onEnter($('.lots', prog), () => gsap.to(rows, { opacity: 1, y: 0, duration: .8, ease: 'out', stagger: .12, clearProps: 'all' }), 'top 88%');
    });
  }

  function stats() {
    const still = !App.motion || !App.ok;
    roofs(still); ruler(still); tally(still); floor(still);
    if (still) return;
    $$('.stats__row .stat').forEach((n, i) => {
      const odo = $('.odo', n);
      const roll = odo && App.odometer ? App.odometer(odo) : null;
      App.onEnter(n, () => { if (roll) gsap.delayedCall(i * .12, roll); }, 'top 85%');
    });
  }

  document.addEventListener('DOMContentLoaded', () => { views(); film(); if (!App.motion) stats(); });
  document.addEventListener('app:ready', () => {
    if (!App.motion) return;
    story(); progs(); stats(); filmScroll();
    ScrollTrigger.refresh();
  });
})();
