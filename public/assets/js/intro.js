/* Intro — le vrai logo se compose sur le papier (toit tracé, montagnes, lettres, VASINA, coordonnées),
   tient un instant, puis rejoint sa place dans l'en-tête pendant que la feuille se lève sur le hero,
   dont les trois plans se posent. Version courte si l'intro a été vue il y a moins de 24 h ;
   aucune intro si le mouvement est réduit. Le hero est peint dessous dès la première image. */
(() => {
  const App = window.App;
  const html = document.documentElement;
  const intro = document.querySelector('.intro');
  if (!html.classList.contains('has-intro') || !intro) return;
  if (!App || !App.ok) { html.classList.remove('has-intro'); intro.remove(); App?.resolveIntro?.(); return; }
  const { $, $$ } = App;

  const short = html.classList.contains('intro--short');
  const paper = $('.intro__paper', intro), sheet = $('.intro__sheet', intro), edge = $('.intro__edge', intro), logo = $('.intro__logo', intro);
  const coords = $('.intro__coords', intro), rule = $('.intro__rule', intro);
  const header = $('.header'), headerLogo = $('.header__logo .logo');
  const heroImg = $('.hero__img');
  const LW = 1286.11, LH = 643.35;
  const S = { y: 0 }; // hauteur levée de la feuille, en px
  let W, H, box, flying = false;

  function place(b) {
    logo.setAttribute('x', b.x); logo.setAttribute('y', b.y);
    logo.setAttribute('width', b.w); logo.setAttribute('height', b.w * (LH / LW));
  }
  function drawSheet() {
    sheet.setAttribute('height', Math.max(0, H - S.y));
    edge.setAttribute('y', H - S.y);
  }
  function layout() {
    W = innerWidth; H = innerHeight;
    paper.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const w = W < 768 ? W - 48 : Math.min(W * .42, 640);
    box = { x: W / 2 - w / 2, y: H * .45 - (w * LH / LW) / 2, w };
    if (!flying) place(box);
    const cy = box.y + w * LH / LW + (W < 768 ? 22 : 30);
    Object.assign(coords.style, { left: `${W / 2}px`, top: `${cy}px` });
    Object.assign(rule.style, { left: `${W / 2}px`, top: `${cy + 26}px` });
    drawSheet();
  }
  // la place du logo dans l'en-tête (l'en-tête est encore replié vers le haut pendant l'intro)
  function target() {
    const r = headerLogo.getBoundingClientRect(), dy = header.getBoundingClientRect().top;
    return { x: r.left, y: r.top - dy, w: r.width };
  }

  /* coordonnées : caractères aléatoires → texte final */
  function scramble(el, dur) {
    const final = el.textContent, pool = '0123456789°′″NE—.';
    const o = { p: 0 };
    return gsap.to(o, {
      p: 1, duration: dur, ease: 'none',
      onStart: () => gsap.set(el, { opacity: 1 }),
      onUpdate: () => {
        const n = Math.floor(o.p * final.length);
        el.textContent = [...final].map((c, i) => (i < n || c === ' ' ? c : pool[(i * 7 + Math.floor(o.p * 40)) % pool.length])).join('');
      },
      onComplete: () => { el.textContent = final; },
    });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const heroReady = Promise.race([heroImg && heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve(), sleep(1500)]);

  let tl = null, ended = false;
  // l'en-tête apparaît sans glisser : le logo de l'intro s'y pose exactement
  function landHeader() {
    if (html.classList.contains('intro-done')) return;
    header.style.transition = 'none';
    html.classList.add('intro-done');
    requestAnimationFrame(() => requestAnimationFrame(() => { header.style.transition = ''; }));
    gsap.fromTo($$('.header__nav, .header__end', header), { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: .8, ease: 'out', clearProps: 'all' });
  }
  function end() {
    if (ended) return;
    ended = true;
    removeEventListener('resize', layout);
    landHeader();
    intro.remove();
    html.classList.remove('intro-running');
    try { localStorage.setItem('clv-intro', String(Date.now())); } catch (e) { /* stockage indisponible */ }
    App.lenis?.start();
    App.onScroll?.();
    App.resolveIntro?.();
  }

  // la sortie : le logo rejoint l'en-tête, la feuille se lève, le hero se pose
  function exit(at, k = 1) {
    tl.add(() => { flying = true; }, at)
      .to([coords, rule], { autoAlpha: 0, duration: .35, ease: 'out' }, at)
      .to(box, {
        x: () => target().x, y: () => target().y, w: () => target().w,
        duration: 1.25 * k, ease: 'inOut', onUpdate: () => place(box),
      }, at)
      .to(S, { y: () => H + 48, duration: 1.3 * k, ease: 'wipe', onUpdate: drawSheet }, at + .1 * k)
      .add(App.hero.assemble(k), at + .2 * k)
      .add(() => App.lenis?.start(), at + .9 * k)
      .add(landHeader, at + 1.25 * k);
  }

  function build() {
    const L = (s) => $$(s, logo);
    App.hero.prepare();
    App.lenis?.stop();
    html.classList.add('intro-running');
    intro.classList.add('is-running');
    layout();
    addEventListener('resize', layout);
    tl = App.introTl = gsap.timeline({ onComplete: end });

    if (short) {
      intro.classList.add('is-ready');
      gsap.set([coords, rule], { autoAlpha: 0 });
      tl.addPause(.05, () => { heroReady.then(() => tl.resume()); });
      exit(.15, .85);
      return;
    }

    const vasina = L('#clv-vasina > path');
    const VDX = vasina.map((p) => { const b = p.getBBox(); return (b.x + b.width / 2 - 657) * .8; });
    gsap.set(L('#ix-roof-outer-m, #ix-roof-inner-m'), { drawSVG: '50% 50%' });
    gsap.set(L('#ix-ml-r'), { attr: { x: 460, width: 0 } });
    gsap.set(L('#ix-mr-r'), { attr: { x: 850, width: 0 } });
    gsap.set(L('#clv-chalets > path, #clv-lombard > path'), { yPercent: 104 });
    gsap.set(vasina, { autoAlpha: 0 });
    gsap.set([coords, rule], { opacity: 0 });
    intro.classList.add('is-ready');

    tl.to(L('#ix-roof-outer-m'), { drawSVG: '0% 100%', duration: 1, ease: 'inOut' }, .10)
      .to(L('#ix-roof-inner-m'), { drawSVG: '0% 100%', duration: .9, ease: 'inOut' }, .22)
      .to(L('#ix-ml-r'), { attr: { x: 30, width: 430 }, duration: 1, ease: 'inOut' }, .35)
      .to(L('#ix-mr-r'), { attr: { width: 400 }, duration: 1, ease: 'inOut' }, .35)
      .to(L('#clv-chalets > path'), { yPercent: 0, duration: .8, ease: 'out', stagger: .035 }, .55)
      .to(L('#clv-lombard > path'), { yPercent: 0, duration: .9, ease: 'out', stagger: .045 }, .70)
      .fromTo(vasina, { x: (i) => VDX[i] }, { x: 0, autoAlpha: 1, duration: 1, ease: 'out', stagger: { each: .03, from: 'center' } }, .95)
      .add(scramble(coords, .6), 1.20)
      .fromTo(rule, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 1.2, ease: 'inOut' }, 1.20)
      // le logo complet tient un instant ; le hero doit être décodé avant que la feuille se lève
      .addPause(2.1, () => { heroReady.then(() => tl.resume()); });
    exit(2.25);

    // au premier geste, on accélère jusqu'au hero
    const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    const off = () => evs.forEach((t) => removeEventListener(t, skip, { capture: true }));
    function skip(e) {
      if (e.type === 'keydown' && e.key === 'Tab') return;
      off();
      tl.timeScale(2.6);
    }
    evs.forEach((t) => addEventListener(t, skip, { capture: true, passive: true }));
    tl.eventCallback('onComplete', () => { off(); end(); });
  }

  setTimeout(() => { if (!ended) { if (tl) tl.progress(1); App.hero?.revealStatic?.(); end(); } }, 9000);
  document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(build));
})();
