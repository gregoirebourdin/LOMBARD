/* Sections S3 à S9 : mots qui s'allument, du trait au chalet, odomètres, pignon qui s'ouvre,
   carrousel, le chalet qui s'allume, horizons, toit du logo gaufré. */
(() => {
  const App = window.App;
  if (!App || !App.ok) return;
  const { $, $$, motion, desktop } = App;
  const NNBSP = ' ';

  /* ——— odomètre : une colonne 0–9 par chiffre ——— */
  function odometer(el) {
    const final = el.textContent.trim();
    const from = (el.dataset.from || '').replace(/\D/g, '');
    let di = 0;
    el.setAttribute('aria-label', final);
    el.innerHTML = [...final].map((ch) => {
      if (!/\d/.test(ch)) return `<span class="odo__sp" aria-hidden="true">${ch === ' ' || ch === NNBSP ? '' : ch}</span>`;
      const start = from[di] !== undefined ? +from[di] : 0;
      di++;
      return `<span class="odo__d" aria-hidden="true" data-to="${ch}" data-from="${start}"><span class="odo__col">${'0123456789'.split('').map((d) => `<span>${d}</span>`).join('')}</span></span>`;
    }).join('');
    const cols = $$('.odo__d', el);
    cols.forEach((d) => gsap.set($('.odo__col', d), { yPercent: -10 * +d.dataset.from }));
    return () => cols.forEach((d, i) => gsap.to($('.odo__col', d), { yPercent: -10 * +d.dataset.to, duration: 1.6, ease: 'out', delay: i * .06 }));
  }

  /* ——— pignon qui s'ouvre (révélation d'image sur papier) ——— */
  function gableIn(frame) {
    const img = $('img', frame);
    const g = { a: 100, e: 100 };
    const draw = () => { frame.style.clipPath = `polygon(50% ${g.a}%, 100% ${g.e}%, 100% 100%, 0% 100%, 0% ${g.e}%)`; };
    draw();
    if (img) gsap.set(img, { scale: 1.15 });
    App.onEnter(frame, async () => {
      if (img && img.decode) await img.decode().catch(() => {});
      gsap.timeline({ onUpdate: draw, onComplete: () => { frame.style.clipPath = ''; } })
        .to(g, { a: 0, e: 22, duration: .75, ease: 'in' })
        .to(g, { e: 0, duration: .55, ease: 'out' });
      if (img) gsap.to(img, { scale: 1, duration: 2, ease: 'out' });
    }, 'top 82%');
  }

  /* ——— S3 : la phrase entendue pendant la visite se recompose ——— */
  function pivot() {
    const q = $('.pivot__quote'), rule = $('.pivot__rule');
    const s = SplitText.create(q, { type: 'words', aria: 'auto' });
    const rest = s.words.filter((w) => !w.closest('.heard'));
    gsap.fromTo(rest, { opacity: .14 }, { opacity: 1, ease: 'none', stagger: .1, scrollTrigger: { trigger: q, start: 'top 75%', end: 'bottom 45%', scrub: true } });
    gsap.set(rule, { scaleX: 0 });
    App.onEnter(rule, () => gsap.to(rule, { scaleX: 1, duration: .9, ease: 'inOut' }), 'top 80%');
  }

  /* ——— S4 : en-tête de la vitrine ——— */
  function venteHead() {
    const rules = $$('.som__rule');
    gsap.set(rules, { scaleX: 0, transformOrigin: 'left center' });
    App.onEnter($('.som'), () => gsap.to(rules, { scaleX: 1, duration: 1.2, ease: 'inOut', stagger: .1 }));
    const carte = $('.carte');
    if (carte) {
      const hz = $('.carte__horizon', carte), pts = $$('.carte__pt', carte);
      gsap.set(hz, { drawSVG: '0%' });
      gsap.set(pts, { scale: 0, transformOrigin: 'center', transformBox: 'fill-box' });
      gsap.set($$('.carte__pt text', carte), { opacity: 0 });
      App.onEnter(carte, () => {
        gsap.timeline()
          .to(hz, { drawSVG: '100%', duration: 1.6, ease: 'inOut' })
          .to(pts, { scale: 1, duration: .4, ease: 'out', stagger: .12 }, 1)
          .to($$('.carte__pt text', carte), { opacity: 1, duration: .6, stagger: .12 }, 1.1);
      });
    }
    $$('.som__row').forEach((row) => row.addEventListener('pointerenter', () => {
      const p = $(`.carte__pt[data-point="${row.dataset.point}"]`);
      if (!p) return;
      p.classList.remove('is-ping'); void p.getBoundingClientRect(); p.classList.add('is-ping');
    }));
  }

  /* ——— horizons : la ligne des montagnes se trace au passage ——— */
  function horizons() {
    $$('.horizon').forEach((h) => {
      const p = $('path', h);
      gsap.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', ease: 'none', scrollTrigger: { trigger: h, start: 'top 95%', end: 'top 35%', scrub: .6 } });
      gsap.fromTo($('svg', h), { x: -10 }, { x: 10, ease: 'none', scrollTrigger: { trigger: h, start: 'top bottom', end: 'bottom top', scrub: .6 } });
    });
  }

  /* ——— S5 : du trait au chalet ——— */
  function mesure() {
    const grid = $('.mesure__grid'), frame = $('.mesure__frame'), pic = $('.mesure__pic', frame), trait = $('.trait', frame);
    const paths = trait ? $$('path', trait) : [];
    if (paths.length) {
      gsap.set(pic, { clipPath: 'inset(0% 100% 0% 0%)' });
      gsap.fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', ease: 'none', stagger: .04, scrollTrigger: { trigger: grid, start: 'top 70%', end: 'top 25%', scrub: .6 } });
      gsap.timeline({ scrollTrigger: { trigger: grid, start: 'top 25%', end: 'top 5%', scrub: .6 } })
        .to(pic, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none' })
        .to(trait, { opacity: .25, ease: 'none' }, 0);
    } else {
      gableIn(frame);
    }
    const track = $('.steps__track i');
    if (track && desktop()) gsap.fromTo(track, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.steps', start: 'top 60%', end: 'bottom 60%', scrub: .5 } });
    $$('.step').forEach((st) => {
      const roll = odometer($('.odo', st));
      const t = App.split($('.step__t', st));
      gsap.set(t.lines, { yPercent: 110 });
      gsap.set($('.step__p', st), { autoAlpha: 0, y: 12 });
      App.onEnter(st, () => {
        roll();
        gsap.to(t.lines, { yPercent: 0, duration: 1.1, ease: 'out', stagger: .08 });
        gsap.to($('.step__p', st), { autoAlpha: 1, y: 0, duration: .9, ease: 'out', delay: .15 });
      }, 'top 72%');
    });
  }

  /* ——— S6 : la maison ——— */
  function maison() {
    const frame = $('.maison__frame');
    gableIn(frame);
    gsap.fromTo($('.pic', frame), { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: .5 } });
    $$('.counter').forEach((c, i) => {
      const roll = odometer($('.odo', c));
      const units = $$('.counter__u', c);
      gsap.set(units, { autoAlpha: 0 });
      App.onEnter(c, () => {
        c.classList.add('is-in');
        gsap.delayedCall(i % 2 * .12, roll);
        gsap.to(units, { autoAlpha: 1, duration: .6, delay: 1.2 });
      });
    });
  }

  /* ——— S7 : carrousel des témoignages (sans lecture automatique) ——— */
  function carousel() {
    const root = $('.carousel');
    if (!root) return;
    const quotes = $$('.quote', root), count = $('.carousel__i span', root);
    let i = 0, busy = false;
    const lines = quotes.map((q) => App.split($('blockquote p', q)).lines);
    function go(dir) {
      if (busy) return;
      const n = (i + dir + quotes.length) % quotes.length;
      const a = quotes[i], b = quotes[n];
      busy = true;
      const tl = gsap.timeline({ onComplete: () => { busy = false; } });
      tl.to([...lines[i], $('figcaption', a)], { yPercent: -110, autoAlpha: 0, duration: .5, ease: 'in', stagger: .03 })
        .add(() => { a.classList.remove('is-active'); b.classList.add('is-active'); })
        .fromTo(lines[n], { yPercent: 110, autoAlpha: 1 }, { yPercent: 0, duration: 1, ease: 'out', stagger: .07 })
        .fromTo($('figcaption', b), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, yPercent: 0, duration: .8 }, '-=.7')
        .to(count, { yPercent: dir > 0 ? -100 : 100, duration: .3, ease: 'in' }, 0)
        .add(() => { count.textContent = String(n + 1).padStart(2, '0'); }, .3)
        .fromTo(count, { yPercent: dir > 0 ? 100 : -100 }, { yPercent: 0, duration: .5, ease: 'out' }, .3);
      i = n;
    }
    $$('.carousel__b', root).forEach((b) => b.addEventListener('click', () => go(+b.dataset.dir)));
    root.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } });
    let x0 = null;
    root.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
    root.addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 40) go(e.clientX < x0 ? 1 : -1); x0 = null; });
  }

  /* ——— S8 : le chalet s'allume, étage par étage ——— */
  function finale() {
    const photo = $('.finale__photo'), lit = $('.finale__lit'), dim = $('.finale__dim');
    const h2 = $$('.finale__head .ln__i'), kick = $('.finale__head .kicker');
    gsap.set(h2, { yPercent: 110 });
    gsap.set(kick, { autoAlpha: 0 });
    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      gsap.to(kick, { autoAlpha: 1, duration: .6 });
      gsap.to(h2, { yPercent: 0, duration: 1.1, ease: 'out', stagger: .1 });
    };
    const hasDim = dim && !dim.hasAttribute('data-missing') && lit && !lit.hasAttribute('data-missing');
    if (!hasDim) { if (lit) lit.style.maskImage = lit.style.webkitMaskImage = 'none'; App.onEnter(photo, show, 'top 60%'); return; }
    const d = desktop();
    gsap.fromTo(lit, { '--lit': '-25%' }, {
      '--lit': '125%', ease: 'none',
      scrollTrigger: {
        trigger: d ? '.finale' : photo, start: d ? 'top top' : 'top 80%', end: d ? '+=70%' : 'top 10%', scrub: .6,
        onUpdate: (st) => { if (st.progress > .3) show(); },
      },
    });
  }

  /* ——— S9 : le toit du logo gaufré se trace ——— */
  function footer() {
    const draws = $$('.emboss__draw');
    if (!draws.length) return;
    gsap.set(draws, { drawSVG: '50% 50%' });
    ScrollTrigger.create({
      trigger: '.footer__logo', start: 'top 92%', once: true,
      onEnter: () => gsap.to(draws, { drawSVG: '0% 100%', duration: 1.4, ease: 'inOut', stagger: .12 }),
    });
    const fcols = $$('.fcol li');
    gsap.set(fcols, { yPercent: 60, autoAlpha: 0 });
    ScrollTrigger.create({ trigger: '.footer__cols', start: 'top 95%', once: true, onEnter: () => gsap.to(fcols, { yPercent: 0, autoAlpha: 1, duration: .8, stagger: .025 }) });
  }

  document.addEventListener('app:ready', () => {
    if (!motion) return;
    pivot(); venteHead(); horizons(); mesure(); maison(); carousel(); finale(); footer();
    ScrollTrigger.refresh();
  });
  // sans mouvement : le carrousel reste pilotable au clavier, sans animation
  document.addEventListener('DOMContentLoaded', () => {
    if (motion) return;
    const root = $('.carousel');
    if (!root) return;
    const quotes = $$('.quote', root), count = $('.carousel__i span', root);
    let i = 0;
    const go = (d) => { quotes[i].classList.remove('is-active'); i = (i + d + quotes.length) % quotes.length; quotes[i].classList.add('is-active'); count.textContent = String(i + 1).padStart(2, '0'); };
    $$('.carousel__b', root).forEach((b) => b.addEventListener('click', () => go(+b.dataset.dir)));
    root.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); });
  });
})();
