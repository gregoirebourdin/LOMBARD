/* Sections 01, 02, 04 et 05, et le film : la citation qui se met au point mot à mot, la bascule
   extérieur / intérieur des vues 3D, le registre des chiffres, la vidéo qui remplit l'écran, la galerie
   des témoignages. */
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

  if (!App.ok) { document.addEventListener('DOMContentLoaded', () => { views(); film(); gallery(); }); return; }

  /* ——— 01 : la phrase se met au point au défilement ; chaque image qu'elle évoque se pose sur la précédente ———
     Les mots passent du flou léger au net, un par un ; quand
     un fragment de la phrase devient net, sa photo arrive d'en bas et recouvre la précédente, qui s'assombrit. */
  function story() {
    const root = $('.real__story');
    if (!root) return;
    const q = $('.real__quote', root), cards = $$('.real__card', root);
    // les photos sont cachées sous la scène : on les charge à l'approche, pas au dernier moment
    App.onEnter(root, () => cards.forEach((c) => { const im = $('img', c); if (im) im.loading = 'eager'; }), 'top 250%');
    // la phrase, mot par mot : chaque mot passe du flou (léger) au net au fil du défilement
    const words = [];
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/([ \n\t]+)/).forEach((t) => {
          if (!t) return;
          if (/^[ \n\t]+$/.test(t)) { frag.append(t); return; }
          const w = document.createElement('span'); w.className = 'fx-w'; w.textContent = t; frag.append(w); words.push(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk(q);
    const shotOf = (w) => { const e = w.closest('[data-shot]'); return e ? +e.dataset.shot : -1; };
    gsap.set(words, { opacity: .14, filter: 'blur(5px)' });
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
        tl.to(w, { opacity: 1, filter: 'blur(0px)', duration: step * 2.4 }, t);
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

  /* ——— votre chalet vous attend : les branches s'écartent ———
     Les branches de sapin, tout près, arrivent énormes et couvrent l'écran avec la section ; au défilement,
     chaque masse se rétracte vers son coin ou son bord (son ancre) jusqu'à sa place exacte sur la photo, et
     découvre le chalet et le titre. Agrandie autour de son ancre, une masse couvre toujours au moins sa
     place sur la photo : on ne voit jamais ce qu'elle cache (tools/scene_planes.py : PIECES, MID0, BACK0).
     Le chalet et le ciel reculent à peine ; sur grand écran, la vue descend le long du pignon. Le titre se
     met au point mot à mot pendant que les branches s'ouvrent, sur un voile sombre qui le rend lisible. */
  function vca() {
    const root = $('.vca');
    if (!root) return;
    const pin = $('.vca__pin', root), t = $('.vca__t', pin), veil = $('.vca__veil', pin);
    const back = $('.vp--back', pin), mid = $('.vp--mid', pin), pieces = $$('.vp--piece', pin);
    App.onEnter(root, () => $$('img', pin).forEach((im) => { im.loading = 'eager'; }), 'top 300%');
    const words = App.titleWords(t);
    const fs = parseFloat(getComputedStyle(t).fontSize) || 80;
    gsap.set(words, { opacity: 0, y: Math.round(fs * .39), filter: `blur(${Math.min(18, fs * .21).toFixed(1)}px)`, willChange: 'opacity, filter, transform' });
    gsap.set(veil, { opacity: 0 });
    // descente possible dans la photo : ce qui dépasse de l'écran, entre le cadrage de départ et celui d'arrivée
    const pan = () => Math.max(0, mid.offsetHeight - innerHeight * 1.04) * .3;
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: root, start: 'top 50%', end: 'bottom bottom', scrub: .6, invalidateOnRefresh: true } })
      .fromTo([back, mid, ...pieces], { y: 0 }, { y: () => -pan(), duration: 1, ease: 'power1.inOut' }, 0)
      // les branches couvrent encore l'écran jusque vers 1,6 : la courbe y passe vite et prend son temps ensuite
      .fromTo(pieces, { scale: (i, el) => +el.dataset.s0 || 2 }, { scale: 1, duration: .88, ease: 'power2.out' }, 0)
      .fromTo(mid, { scale: 1.08 }, { scale: 1, duration: .88, ease: 'power1.out' }, 0)
      .fromTo(back, { scale: 1.04 }, { scale: 1, duration: .88, ease: 'power1.out' }, 0)
      .to(veil, { opacity: 1, duration: .3 }, .25);
    words.forEach((w, i) => tl.to(w, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .2 }, .3 + i * .06));
  }

  /* ——— 04 : le registre ———
     Le filet se trace, le chiffre monte en se mettant au point et compte jusqu'à sa valeur ; l'année
     de fondation ne compte pas, elle apparaît seulement. */
  const NNBSP = '\u202f';
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  /* ——— 05 : la galerie des témoignages ———
     Grand écran : la piste défile à l'horizontale pendant qu'on descend. Ailleurs (ou sans mouvement) :
     on la fait glisser ; le filet du bas suit la position dans la galerie. */
  function gallery() {
    const pin = $('.temo__pin');
    if (!pin) return;
    const track = $('.temo__track', pin), bar = $('.temo__bar i', pin);
    const wide = App.motion && App.ok && matchMedia('(min-width: 1024px)').matches;
    if (!wide) {
      const sync = () => { const m = track.scrollWidth - track.clientWidth; bar.style.transform = `scaleX(${m > 0 ? track.scrollLeft / m : 1})`; };
      track.addEventListener('scroll', sync, { passive: true }); sync();
      return;
    }
    const run = document.createElement('div'); run.className = 'temo__run'; run.setAttribute('aria-hidden', 'true');
    pin.after(run);
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const size = () => { run.style.height = `${dist()}px`; };
    size();
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: pin, start: 'top top', end: () => `+=${dist()}`, scrub: .5, invalidateOnRefresh: true, onRefreshInit: size } })
      .fromTo(track, { x: 0 }, { x: () => -dist() }, 0)
      .fromTo(bar, { scaleX: 0 }, { scaleX: 1 }, 0);
    // les photos de la piste sont hors de l'écran : on les charge à l'approche
    App.onEnter(pin, () => $$('img', track).forEach((im) => { im.loading = 'eager'; }), 'top 200%');
  }

  function stats() {
    if (!App.motion || !App.ok) return;
    $$('.ledger__row').forEach((row, i) => {
      const n = $('.ledger__n', row), c = $('[data-count]', n), lab = $('.ledger__l', row), to = +c.dataset.count;
      const plain = c.hasAttribute('data-plain');
      const fs = parseFloat(getComputedStyle(n).fontSize) || 80;
      n.setAttribute('aria-label', n.textContent.replace(/\s+/g, ' ').trim());
      gsap.set(n, { opacity: 0, y: fs * .3, filter: `blur(${Math.min(18, fs * .14).toFixed(1)}px)` });
      gsap.set(lab, { opacity: 0, y: 10 });
      if (!plain) c.textContent = '0';
      App.onEnter(row, () => {
        row.classList.add('is-in');
        const d = .1;
        gsap.to(n, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'power3.out', delay: d, clearProps: 'filter' });
        gsap.to(lab, { opacity: 1, y: 0, duration: 1, ease: 'out', delay: d + .25 });
        if (!plain) { const o = { v: 0 }; gsap.to(o, { v: to, duration: 2, ease: 'power2.out', delay: d, onUpdate: () => { c.textContent = fmt(o.v); } }); }
      }, 'top 86%');
    });
  }

  document.addEventListener('DOMContentLoaded', () => { views(); film(); if (!App.motion) gallery(); });
  document.addEventListener('app:ready', () => {
    if (!App.motion) return;
    story(); vca(); progs(); stats(); filmScroll(); gallery();
    ScrollTrigger.refresh();
  });
})();
