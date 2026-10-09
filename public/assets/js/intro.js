/* Intro — on traverse un nuage. La page s'ouvre dans une brume ivoire ; deux nappes de nuage proches
   s'ouvrent et grandissent comme si l'on avançait, une nappe lointaine se dissipe plus lentement, la photo
   du hero, d'abord floue, se met au point, puis « Le soir tombe. » et le titre apparaissent lettre à
   lettre. Faux flou : nappes et photo floutées à l'avance ; seules l'opacité et la position bougent.
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
  // les nappes de nuage sont de petites images (30 Ko) : on les attend aussi, brièvement
  const cloud = (src) => { const im = new Image(); im.src = src; return im.decode ? im.decode().catch(() => {}) : Promise.resolve(); };
  const heroReady = Promise.race([Promise.all([
    heroImg && heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve(),
    cloud('/assets/img/cloud-near.webp'), cloud('/assets/img/cloud-far.webp'),
  ]), sleep(1600)]);

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
