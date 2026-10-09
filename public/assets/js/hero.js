/* Hero : la photo en trois plans (ciel, montagne et forêt, chalet), découpés par tools/hero_planes.py.
   Au défilement, chaque plan glisse à sa vitesse : le ciel le plus lentement, le chalet avec la page.
   « Le soir tombe. » est posé entre le ciel et la montagne : la montagne et le chalet montent devant lui
   et il se couche derrière eux, pendant que le ciel s'assombrit. Le titre (H1) reste en bas à gauche, sur un voile sombre.
   window.App.hero : états de départ et assemblage, appelés par l'intro (le nuage). */
(() => {
  const App = window.App;
  if (!App || !App.ok) return;
  const { $, $$, motion, fine } = App;
  const hero = $('.hero');
  if (!hero) return;

  const P = {
    back: $('.hp--back', hero), mid: $('.hp--mid', hero), front: $('.hp--front', hero),
    giant: $('.hero__giant', hero), night: $('.hero__night', hero),
  };
  const content = $('.hero__content', hero);
  const title = $('.hero__title', hero), kicker = $('.hero__kicker', hero);
  const extras = [$('.hero__cta', hero), $('.hero__credit', hero), $('.hero__scroll', hero)].filter(Boolean);

  // retard de chaque plan sur la page, en part du défilement du hero : le ciel reste presque immobile,
  // le texte à peine moins, la montagne suit presque la page, le chalet (avant) avance avec elle ;
  // le texte se couche donc derrière la montagne et le chalet qui montent devant lui.
  // (le retard de la montagne reste sous la bande reconstituée derrière le chalet)
  const portrait = () => matchMedia('(max-aspect-ratio: 1/1)').matches;
  const SPEED = () => (portrait() ? { back: .9, giant: .74, mid: .08 } : { back: .9, giant: .74, mid: .14 });

  App.hero = {
    /* état de départ, sous le nuage de l'intro : plans légèrement décalés, textes cachés */
    prepare() {
      gsap.set(P.back, { scale: 1.06, transformOrigin: '50% 40%' });
      gsap.set(P.mid, { yPercent: 3 });
      gsap.set(P.front, { yPercent: 2 });
      gsap.set(P.giant, { yPercent: 28 });
      App.titleHide(P.giant);
      App.textHide(kicker);
      App.titleHide(title);
      gsap.set(extras, { autoAlpha: 0, y: 14 });
    },
    /* les plans se posent, le grand texte monte de derrière la montagne et se met au point, puis le titre */
    assemble(k = 1) {
      const tl = gsap.timeline()
        .to(P.back, { scale: 1, duration: 2.2 * k, ease: 'out' }, 0)
        .to(P.mid, { yPercent: 0, duration: 1.9 * k, ease: 'out' }, .05 * k)
        .to(P.front, { yPercent: 0, duration: 1.7 * k, ease: 'out' }, .1 * k)
        .to(P.giant, { yPercent: 0, duration: 2 * k, ease: 'out' }, .2 * k)
        .add(() => App.title(P.giant, { stagger: .16 * k, duration: 1.5 * k }), .25 * k)
        .add(() => App.text(kicker), .6 * k)
        .add(() => App.title(title, { stagger: .09 * k, duration: 1.2 * k }), .7 * k)
        .to(extras, { autoAlpha: 1, y: 0, duration: .9 * k, ease: 'out', stagger: .08 * k }, 1.15 * k);
      return tl;
    },
    revealStatic() {
      gsap.set([P.back, P.mid, P.front, P.giant, ...extras], { clearProps: 'transform,opacity,visibility' });
      [P.giant, title].forEach((el) => { if (el._fx) gsap.set(el._fx, { clearProps: 'all' }); });
      kicker.classList.add('is-in');
    },
  };

  if (!motion) return;

  /* ——— défilement : un plan par vitesse, et la nuit qui tombe ——— */
  function scroll() {
    const h = () => hero.offsetHeight;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });
    tl.fromTo(P.back, { y: 0 }, { y: () => SPEED().back * h() }, 0)
      .fromTo(P.giant, { y: 0 }, { y: () => SPEED().giant * h() }, 0)
      .fromTo(P.mid, { y: 0 }, { y: () => SPEED().mid * h() }, 0)
      .fromTo(P.night, { opacity: 0 }, { opacity: .9 }, 0)
      .fromTo(content, { y: 0 }, { y: () => -.1 * h() }, 0)
      .fromTo(content, { opacity: 1 }, { opacity: 0, duration: .3 }, .3);
    // l'en-tête passe en clair dès que la photo (et non plus le ciel) glisse sous lui
    ScrollTrigger.create({
      trigger: hero, start: 'top top', end: () => `+=${Math.round(innerHeight * .1)}`,
      onLeave: () => { hero.dataset.header = 'photo'; App.onScroll?.(); },
      onEnterBack: () => { hero.dataset.header = 'sky'; App.onScroll?.(); },
    });
  }

  /* ——— pointeur : un souffle de profondeur (souris seulement) ——— */
  function pointer() {
    if (!fine) return;
    const q = [[P.front, 16], [P.mid, 8], [P.giant, 5], [P.back, -4]].map(([el, a]) => [gsap.quickTo(el, 'x', { duration: 1.6, ease: 'power3.out' }), a]);
    let on = true;
    ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', onToggle: (st) => { on = st.isActive; } });
    hero.addEventListener('pointermove', (e) => {
      if (!on) return;
      const nx = (e.clientX / innerWidth) * 2 - 1;
      q.forEach(([fn, a]) => fn(-nx * a));
    }, { passive: true });
    hero.addEventListener('pointerleave', () => q.forEach(([fn]) => fn(0)));
  }

  // la parallaxe ne démarre qu'une fois l'intro jouée (elle anime les mêmes plans)
  App.introDone.then(() => { scroll(); pointer(); ScrollTrigger.refresh(); });
})();
