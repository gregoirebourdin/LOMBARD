/* Sections 03 et 06 et pied de page : du trait au chalet, odomètres, le chalet qui s'allume,
   toit du logo gaufré. L'odomètre est partagé (App.odometer). */
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
      const t = $('.step__t', st), sp = $('.step__p', st);
      App.titleHide(t);
      App.textHide(sp);
      gsap.set(odo, { autoAlpha: 0 });
      App.onEnter(st, () => {
        gsap.to(odo, { autoAlpha: 1, duration: .4 });
        roll();
        App.title(t);
        App.text(sp, { delay: .25 });
      }, 'top 72%');
    });
  }

  /* ——— S8 : le chalet s'allume, étage par étage ——— */
  function finale() {
    const photo = $('.finale__photo'), lit = $('.finale__lit'), dim = $('.finale__dim');
    const h2 = $('.finale__head .d1'), kick = $('.finale__head .kicker');
    App.titleHide(h2);
    App.textHide(kick);
    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      App.text(kick);
      App.title(h2, { delay: .15 });
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
    mesure(); finale(); footer();
    ScrollTrigger.refresh();
  });
})();
