/* Intro — on traverse un nuage. La page s'ouvre dans une brume ivoire ; deux nappes de nuage proches
   s'ouvrent et grandissent comme si l'on avançait, une nappe lointaine se dissipe plus lentement, la photo
   du hero, d'abord floue, se met au point, puis « Le soir tombe. » et le titre apparaissent lettre à
   lettre. Faux flou : nappes dessinées une fois, photo floutée à l'avance ; seules l'opacité et la position bougent.
   Plus courte si l'intro a été vue il y a moins de 24 h ; aucune si le mouvement est réduit. */
(() => {
  const App = window.App;
  const html = document.documentElement;
  const intro = document.querySelector('.intro');
  const fog = document.querySelector('.hero__fog');
  if (!html.classList.contains('has-intro') || !intro) return;
  if (!App || !App.ok || !App.hero) { html.classList.remove('has-intro'); intro.remove(); fog?.remove(); App?.resolveIntro?.(); return; }
  const { $, $$ } = App;

  const short = html.classList.contains('intro--short');
  const haze = $('.intro__haze', intro), near = $$('.intro__cloud--near', intro), far = $('.intro__cloud--far', intro);
  const heroImg = $('.hero__img');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // la photo nette doit être décodée avant qu'on s'y mette au point
  const heroReady = Promise.race([heroImg && heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve(), sleep(1600)]);

  /* une nappe de nuage : des amas de dégradés radiaux très doux, dessinés une fois dans un petit canevas
     (aucune image à charger, aucun bord, aucune compression) ; le dessous des volutes est à peine lavande */
  function paint(cv, seed, clumps, per, rMin, rMax, a0) {
    // à mi-résolution de l'écran (le canevas couvre 136 % de l'écran) : agrandi deux fois au plus,
    // l'image reste lisse ; trop petite, son agrandissement laisse voir une grille
    const W = Math.round(Math.min(1100, Math.max(420, innerWidth * .68))), H = Math.round(W * Math.min(2.2, Math.max(.45, innerHeight / innerWidth)));
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    let s = seed;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    // autant d'amas par unité de surface, quel que soit le format de l'écran : des nappes et des trouées
    const n = Math.max(4, Math.round(clumps * (H / W) * .9 + 2)), k = Math.min(W, H) / 360; // volutes à l'échelle du petit côté
    for (let c = 0; c < n; c++) {
      const cx = r() * W, cy = r() * H, sx = (.1 + r() * .16) * Math.min(W, H) * 1.3, sy = sx * (.45 + r() * .3);
      for (let i = 0; i < per; i++) {
        const x = cx + (r() - .5) * 2 * sx, y = cy + (r() - .5) * 2 * sy, rad = (rMin + r() * (rMax - rMin)) * k, a = a0 * (.4 + r() * .6);
        const shade = ctx.createRadialGradient(x, y + rad * .28, 0, x, y + rad * .28, rad);
        shade.addColorStop(0, `rgba(232,222,236,${a * .5})`); shade.addColorStop(1, 'rgba(232,222,236,0)');
        ctx.fillStyle = shade; ctx.fillRect(x - rad, y - rad * .72, rad * 2, rad * 2);
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `rgba(255,254,252,${a})`); g.addColorStop(.45, `rgba(253,250,249,${a * .62})`); g.addColorStop(1, 'rgba(250,246,248,0)');
        ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }
    // le navigateur trame les dégradés d'un fin motif de points : agrandi, il dessinerait une grille.
    // On lisse donc le dessin une fois (flou léger, fait une seule fois, jamais animé).
    if ('filter' in ctx) {
      const t = document.createElement('canvas'); t.width = W; t.height = H;
      const c2 = t.getContext('2d');
      c2.filter = `blur(${Math.max(3, W / 220).toFixed(1)}px)`;
      c2.drawImage(cv, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(t, 0, 0);
    }
  }

  let tl = null, ended = false;
  function showHeader() {
    if (!html.classList.contains('intro-done')) html.classList.add('intro-done');
  }
  function end() {
    if (ended) return;
    ended = true;
    showHeader();
    intro.remove();
    fog?.remove();
    html.classList.remove('intro-running');
    try { localStorage.setItem('clv-intro', String(Date.now())); } catch (e) { /* stockage indisponible */ }
    App.lenis?.start();
    App.onScroll?.();
    App.resolveIntro?.();
  }

  function build() {
    const k = short ? .62 : 1;
    App.hero.prepare();
    App.lenis?.stop();
    html.classList.add('intro-running');
    intro.classList.add('is-running');
    gsap.set(fog, { willChange: 'opacity, transform' });
    paint(far, 1979, 6, 14, 18, 54, .5);
    near.forEach((cv, i) => paint(cv, i ? 2021 : 5120, 7, 15, 22, 72, .6));

    tl = App.introTl = gsap.timeline({ paused: true, onComplete: end });
    // la brume se lève sur les nappes de nuage…
    tl.to(haze, { opacity: 0, duration: .7 * k, ease: 'power1.inOut' }, 0)
      // …les nappes proches s'ouvrent et grandissent vite : on les traverse
      .fromTo(near, { scale: 1, xPercent: 0 }, { scale: 3.2, xPercent: (i) => (i ? 9 : -9), duration: 2 * k, ease: 'power2.in' }, .05 * k)
      .to(near, { opacity: 0, duration: 1.1 * k, ease: 'power1.in' }, .75 * k)
      // …la nappe lointaine, plus lente, se dissipe derrière
      .fromTo(far, { scale: 1.05 }, { scale: 1.7, duration: 2.4 * k, ease: 'power1.inOut' }, 0)
      .to(far, { opacity: 0, duration: 1.3 * k, ease: 'power1.inOut' }, .6 * k)
      // la photo floue s'efface : la vraie photo apparaît, nette
      .to(fog, { opacity: 0, scale: 1.02, duration: 1.4 * k, ease: 'inOut' }, .5 * k)
      .add(App.hero.assemble(short ? .8 : 1), .45 * k)
      .add(() => App.lenis?.start(), 1.2 * k)
      .add(showHeader, 1.35 * k)
      .add(() => {}, 2.6 * k);

    heroReady.then(() => tl.play());

    // au premier geste, on accélère
    const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    const off = () => evs.forEach((t) => removeEventListener(t, skip, { capture: true }));
    function skip(e) {
      if (e.type === 'keydown' && e.key === 'Tab') return;
      off();
      tl.timeScale(2.4);
    }
    evs.forEach((t) => addEventListener(t, skip, { capture: true, passive: true }));
    tl.eventCallback('onComplete', () => { off(); end(); });
  }

  setTimeout(() => { if (!ended) { if (tl) tl.progress(1); App.hero?.revealStatic?.(); end(); } }, 6000);
  document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(build));
})();
