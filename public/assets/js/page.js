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

  if (!App.ok) { document.addEventListener('DOMContentLoaded', () => { views(); film(); }); return; }

  /* ——— 01 : la phrase s'allume au fil de la lecture ——— */
  function quote() {
    const q = $('.real__quote');
    if (!q) return;
    const words = [];
    // mots en ligne (pas en bloc) : aucune coupure là où le texte n'a pas d'espace
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((t) => {
          if (!t) return;
          if (/^\s+$/.test(t)) { frag.append(t); return; }
          const w = document.createElement('span'); w.className = 'w'; w.textContent = t; frag.append(w); words.push(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk(q);
    gsap.fromTo(words, { opacity: .16 }, { opacity: 1, ease: 'none', stagger: .1, scrollTrigger: { trigger: q, start: 'top 78%', end: 'bottom 48%', scrub: true } });
  }

  /* ——— 04 : les chiffres roulent, un filet se trace au-dessus ——— */
  function nums() {
    $$('.num').forEach((n, i) => {
      const odo = $('.odo', n);
      const roll = odo && App.odometer ? App.odometer(odo) : null;
      App.onEnter(n, () => { n.classList.add('is-in'); if (roll) gsap.delayedCall(i * .12, roll); }, 'top 88%');
    });
  }

  document.addEventListener('DOMContentLoaded', () => { views(); film(); });
  document.addEventListener('app:ready', () => {
    if (!App.motion) return;
    quote(); nums(); filmScroll();
    ScrollTrigger.refresh();
  });
})();
