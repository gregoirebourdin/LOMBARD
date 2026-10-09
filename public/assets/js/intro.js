/* Intro — on traverse un nuage. La page s'ouvre dans une brume ivoire ; des nappes de nuage s'écartent
   et grandissent comme si l'on avançait, la photo du hero, d'abord floue, se met au point, puis
   « Le soir tombe. » et le titre apparaissent. Tout est en faux flou : des dégradés radiaux et une
   image floutée à l'avance (quelques Ko) ; seules l'opacité et la position bougent.
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
  const haze = $('.intro__haze', intro), puffs = $$('.intro__puff', intro);
  const heroImg = $('.hero__img');
  const vmax = (v) => (+v || 0) * Math.max(innerWidth, innerHeight) / 100;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // la photo nette doit être décodée avant qu'on s'y mette au point
  const heroReady = Promise.race([heroImg && heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve(), sleep(1600)]);

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
    gsap.set([...puffs, fog].filter(Boolean), { willChange: 'opacity, transform' });

    tl = App.introTl = gsap.timeline({ paused: true, onComplete: end });
    // la brume se lève…
    tl.to(haze, { opacity: 0, duration: .8 * k, ease: 'inOut' }, .05 * k)
      // …les nappes s'écartent et grandissent : on avance dans le nuage
      .to(puffs, {
        x: (i, el) => vmax(el.dataset.dx), y: (i, el) => vmax(el.dataset.dy), scale: (i, el) => +el.dataset.z || 2,
        opacity: 0, duration: 1.9 * k, ease: 'power2.inOut', stagger: { each: .04 * k, from: 'center' },
      }, .08 * k)
      // la photo floue s'efface : la vraie photo apparaît, nette
      .to(fog, { opacity: 0, scale: 1.02, duration: 1.3 * k, ease: 'inOut' }, .4 * k)
      .add(App.hero.assemble(short ? .8 : 1), .3 * k)
      .add(() => App.lenis?.start(), 1.1 * k)
      .add(showHeader, 1.25 * k)
      .add(() => {}, 2.5 * k);

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
