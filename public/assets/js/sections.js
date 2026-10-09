/* Sections 03 à 06 et pied de page : du trait au chalet, odomètres, carrousel des témoignages,
   le chalet qui s'allume, toit du logo gaufré. L'odomètre est partagé avec page.js (App.odometer). */
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

  App.odometer = odometer;

  /* ——— pignon qui s'ouvre (révélation d'image sur papier) ——— */
  function gableIn(frame) {
    const img = $('img', frame);
    const g = { a: 100, e: 100 };
    const draw = () => { frame.style.clipPath = `polygon(50% ${g.a}%, 100% ${g.e}%, 100% 100%, 0% 100%, 0% ${g.e}%)`; };
    draw();
    if (img) gsap.set(img, { scale: 1.15 });
    // une image masquée par le pignon fermé n'est jamais « visible » : on lance son chargement à l'approche
    if (img) App.onEnter(frame, () => { img.loading = 'eager'; }, 'top 220%');
    App.onEnter(frame, async () => {
      if (img) {
        img.loading = 'eager';
        if (img.decode) await Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
      }
      gsap.timeline({ onUpdate: draw, onComplete: () => { frame.style.clipPath = ''; } })
        .to(g, { a: 0, e: 22, duration: .75, ease: 'in' })
        .to(g, { e: 0, duration: .55, ease: 'out' });
      if (img) gsap.to(img, { scale: 1, duration: 2, ease: 'out' });
    }, 'top 82%');
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
      const odo = $('.odo', st);
      const roll = odometer(odo);
      const t = App.split($('.step__t', st));
      gsap.set(t.lines, { yPercent: 110 });
      gsap.set($('.step__p', st), { autoAlpha: 0, y: 12 });
      gsap.set(odo, { autoAlpha: 0 });
      App.onEnter(st, () => {
        gsap.to(odo, { autoAlpha: 1, duration: .4 });
        roll();
        gsap.to(t.lines, { yPercent: 0, duration: 1.1, ease: 'out', stagger: .08 });
        gsap.to($('.step__p', st), { autoAlpha: 1, y: 0, duration: .9, ease: 'out', delay: .15 });
      }, 'top 72%');
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
        .add(() => { count.textContent = String(n + 1); }, .3)
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
    mesure(); carousel(); finale(); footer();
    ScrollTrigger.refresh();
  });
  // sans mouvement : le carrousel reste pilotable au clavier, sans animation
  document.addEventListener('DOMContentLoaded', () => {
    if (motion) return;
    const root = $('.carousel');
    if (!root) return;
    const quotes = $$('.quote', root), count = $('.carousel__i span', root);
    let i = 0;
    const go = (d) => { quotes[i].classList.remove('is-active'); i = (i + d + quotes.length) % quotes.length; quotes[i].classList.add('is-active'); count.textContent = String(i + 1); };
    $$('.carousel__b', root).forEach((b) => b.addEventListener('click', () => go(+b.dataset.dir)));
    root.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); });
  });
})();
