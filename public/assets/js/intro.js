/* Intro « Le Pignon » — le vrai logo se compose sur le papier, le mot CHALETS tombe et laisse
   place à une fenêtre en pignon ; quatre plans d'atelier y défilent, puis le chalet au crépuscule.
   La fenêtre plonge vers la caméra (transform composité) et l'on se retrouve dans la photo.
   Le hero est peint dessous dès la première image : l'intro ne retarde jamais le LCP. */
(() => {
  const App = window.App;
  const html = document.documentElement;
  const intro = document.querySelector('.intro');
  if (!html.classList.contains('has-intro') || !intro) return;
  if (!App || !App.ok) { html.classList.remove('has-intro'); intro.remove(); App?.resolveIntro?.(); return; }
  const { $, $$ } = App;

  const short = html.classList.contains('intro--short');
  const MOB = matchMedia('(max-width: 767px)').matches;
  const WIN = { ax: 654.7, ay: 84, l: 460.8, r: 848.6, ey: 205, by: MOB ? 420 : 300 };
  const CAM = MOB ? 2.2 : 1.45;
  const G = { open: short ? 1 : 0 };
  const cam = $('.intro__cam', intro), paper = $('.intro__paper', intro), logo = $('.intro__logo', intro), win = $('.intro__win', intro);
  const montage = $('.intro__montage', intro), shots = $$('.intro__montage picture', intro);
  const coords = $('.intro__coords', intro), rule = $('.intro__rule', intro);
  const heroImg = $('.hero__img');
  let u, ox, oy, wc, diving = false;

  const px = ([x, y]) => [ox + x * u, oy + y * u];
  const poly = () => [[WIN.ax, WIN.ay], [WIN.r, WIN.ey], [WIN.r, WIN.by], [WIN.l, WIN.by], [WIN.l, WIN.ey]].map(px);

  function drawHole() {
    const ay = WIN.ey + (WIN.ay - WIN.ey) * G.open, by = WIN.ey + (WIN.by - WIN.ey) * G.open;
    win.setAttribute('points', [[WIN.ax, ay], [WIN.r, WIN.ey], [WIN.r, by], [WIN.l, by], [WIN.l, WIN.ey]]
      .map((p) => px(p).map((n) => n.toFixed(1)).join(',')).join(' '));
  }
  function layout() {
    if (diving) return;
    const W = innerWidth, H = innerHeight, Lw = MOB ? W - 32 : Math.min(W * .46, 700);
    u = Lw / 1286.11; ox = W / 2 - 643.05 * u; oy = H * .44 - 321.7 * u;
    paper.setAttribute('viewBox', `0 0 ${W} ${H}`);
    logo.setAttribute('x', ox); logo.setAttribute('y', oy);
    logo.setAttribute('width', Lw); logo.setAttribute('height', 643.35 * u);
    wc = { x: ox + 654.7 * u, y: oy + ((WIN.ay + WIN.by) / 2) * u };
    cam.style.transformOrigin = `${wc.x}px ${wc.y}px`;
    const [bx, by] = px([WIN.l, WIN.ay]);
    Object.assign(montage.style, { left: `${bx}px`, top: `${by}px`, width: `${(WIN.r - WIN.l) * u}px`, height: `${(WIN.by - WIN.ay) * u}px` });
    const cy = oy + 643.35 * u + (MOB ? 18 : 26);
    Object.assign(coords.style, { left: `${W / 2}px`, top: `${cy}px` });
    Object.assign(rule.style, { left: `${W / 2}px`, top: `${cy + 26}px` });
    drawHole();
    App.hero.setT0(wc);
  }
  function inside([x, y], P) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function diveScale() { // plus petite échelle qui met les 4 coins de l'écran dans le pentagone, × 1,05
    const P0 = poly(), corners = [[0, 0], [innerWidth, 0], [innerWidth, innerHeight], [0, innerHeight]];
    for (let F = 1; F < 80; F += .25) {
      const s = CAM * F, P = P0.map(([x, y]) => [wc.x + (x - wc.x) * s, wc.y + (y - wc.y) * s]);
      if (corners.every((c) => inside(c, P))) return F * 1.05;
    }
    return 80;
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

  /* montage : un plan n'est montré que s'il est déjà décodé à son heure */
  const decoded = shots.map(() => false);
  shots.forEach((p, i) => { const im = $('img', p); (im.decode ? im.decode() : Promise.resolve()).then(() => { decoded[i] = true; }).catch(() => {}); });
  function cut(i) {
    shots.forEach((p) => p.classList.remove('is-on'));
    if (i < 0) { montage.style.visibility = 'hidden'; return; }
    if (!decoded[i]) return; // on garde le plan précédent, sinon le chalet
    montage.style.visibility = 'visible';
    shots[i].classList.add('is-on');
    gsap.fromTo($('img', shots[i]), { scale: 1.1 }, { scale: 1.03, duration: .26, ease: 'none' });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const heroReady = Promise.race([heroImg && heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve(), sleep(1200)]);

  let tl = null, ended = false;
  function end() {
    if (ended) return;
    ended = true;
    removeEventListener('resize', layout);
    intro.remove();
    html.classList.remove('intro-running');
    html.classList.add('intro-done');
    try { localStorage.setItem('clv-intro', String(Date.now())); } catch (e) { /* stockage indisponible */ }
    App.lenis?.start();
    App.onScroll?.();
    App.resolveIntro?.();
  }

  function build() {
    const L = (s) => $$(s, logo);
    const H = App.hero;
    H.prepare();
    App.lenis?.stop();
    html.classList.add('intro-running');
    intro.classList.add('is-running');
    montage.style.visibility = 'hidden';
    layout();
    addEventListener('resize', layout);
    const vasina = L('#clv-vasina > path');
    const VDX = vasina.map((p) => { const b = p.getBBox(); return (b.x + b.width / 2 - 657) * .8; });
    const fadeOut = () => [...L('#ix-mountains, #clv-lombard, #clv-vasina'), coords, rule];
    const startDive = () => { diving = true; gsap.set(cam, { willChange: 'transform' }); };
    const HOLD = .6, T = (t) => (t >= 1.45 ? t + HOLD : t); // temps du cahier des charges + la tenue du logo

    tl = App.introTl = gsap.timeline({ onComplete: end });
    if (short) {
      gsap.set(L('#clv-chalets > path'), { yPercent: 104 });
      if (MOB) { gsap.set(L('#clv-lombard > path'), { yPercent: 104 }); gsap.set(vasina, { autoAlpha: 0 }); }
      gsap.set(cam, { scale: CAM });
      intro.classList.add('is-ready');
      tl.add(startDive, .1)
        .to(cam, { scale: () => CAM * diveScale(), duration: 1.2, ease: 'dive' }, .15)
        .to(L('#ix-roof'), { opacity: 0, duration: .25, ease: 'power2.out' }, .15)
        .to(fadeOut(), { opacity: 0, duration: .3 }, .15)
        .add(() => H.dive(1.6), .15)
        .add(H.revealH1, .55).add(H.revealPlinth, .7).add(H.revealHeader, .8).add(() => App.lenis?.start(), .9)
        .add(H.revealEncart, 1.0).add(() => {}, 1.4);
      return;
    }

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
      // le logo complet tient un instant ; puis CHALETS tombe (sur mobile, tout le texte sort avec lui)
      .to(L(MOB ? '#clv-chalets > path, #clv-lombard > path' : '#clv-chalets > path'), { yPercent: 104, autoAlpha: 0, duration: .45, ease: 'in', stagger: { each: .02, from: 'center' }, overwrite: 'auto' }, T(1.45));
    if (MOB) tl.to([...vasina, coords, rule], { autoAlpha: 0, y: 10, duration: .45, ease: 'in', overwrite: 'auto' }, T(1.45));
    tl.to(G, { open: 1, duration: .8, ease: 'inOut', onUpdate: drawHole }, T(1.55))
      .to(cam, { scale: CAM, duration: 1.3, ease: 'inOut' }, T(1.55))
      .add(() => cut(0), T(1.55)).add(() => cut(1), T(1.81)).add(() => cut(2), T(2.07)).add(() => cut(3), T(2.33))
      .addPause(T(2.40), () => { heroReady.then(() => tl.resume()); })
      .add(() => cut(-1), T(2.59))
      .add(startDive, T(2.80))
      .to(cam, { scale: () => CAM * diveScale(), duration: 1.5, ease: 'dive' }, T(2.85))
      .to(L('#ix-roof'), { opacity: 0, duration: .28, ease: 'power2.out' }, T(2.85))
      .to(fadeOut(), { opacity: 0, duration: .3 }, T(2.85))
      .add(() => H.dive(2), T(2.85))
      .add(H.revealH1, T(3.30))
      .add(() => App.lenis?.start(), T(3.45))
      .add(H.revealPlinth, T(3.50))
      .add(H.revealHeader, T(3.60))
      .add(H.revealEncart, T(3.75))
      .add(() => {}, T(4.35));

    // saut : au premier geste, on accélère jusqu'au chalet
    const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    const off = () => evs.forEach((t) => removeEventListener(t, skip, { capture: true }));
    function skip(e) {
      if (e.type === 'keydown' && e.key === 'Tab') return;
      off();
      if (tl.time() < 2.85 + .6) {
        cut(-1);
        G.open = 1; drawHole();
        tl.seek(2.6 + .6, true); tl.resume(); tl.timeScale(2.5);
      } else tl.timeScale(3);
    }
    evs.forEach((t) => addEventListener(t, skip, { capture: true, passive: true }));
    tl.eventCallback('onComplete', () => { off(); end(); });
  }

  setTimeout(() => { if (!ended) { if (tl) tl.progress(1); App.hero?.revealStatic?.(); end(); } }, 10000);
  document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(build));
})();
