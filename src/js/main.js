/* Chalets Lombard Vasina — moteur de mouvement.
   Grammaire : 1) la caméra avance, elle ne glisse pas ; 2) plus un plan est proche,
   plus il bouge ; 3) une seule courbe, cubic-bezier(0.16, 1, 0.3, 1).
   Transformations GPU uniquement (translate3d, scale). Une scène ne s'anime que
   lorsqu'elle est à l'écran. Sans mouvement : images aplaties, tout s'affiche. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  root.classList.add('js');
  window.__lv = true;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var small = matchMedia('(max-width: 767px)');
  var finePointer = matchMedia('(hover: hover) and (pointer: fine)');

  /* La courbe unique, résolue pour GSAP (même définition que --ease en CSS). */
  function bezier(x1, y1, x2, y2) {
    function a(p1, p2) { return 1 - 3 * p2 + 3 * p1; }
    function b(p1, p2) { return 3 * p2 - 6 * p1; }
    function c(p1) { return 3 * p1; }
    function calc(t, p1, p2) { return ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t; }
    function slope(t, p1, p2) { return 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1); }
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i++) {
        var s = slope(t, x1, x2); if (s === 0) break;
        t -= (calc(t, x1, x2) - x) / s;
      }
      return calc(Math.min(Math.max(t, 0), 1), y1, y2);
    };
  }
  var EASE = bezier(0.16, 1, 0.3, 1);

  /* ---------- Menu mobile, dialogues, en-tête (toujours actifs) ---------- */
  var menu = d.getElementById('menu');
  d.querySelectorAll('[data-menu]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('data-menu') === 'open';
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      d.querySelectorAll('[data-menu="open"]').forEach(function (b) { b.setAttribute('aria-expanded', String(open)); });
      if (open) { var f = menu.querySelector('a'); if (f) f.focus(); if (lenis) lenis.stop(); }
      else { if (lenis) lenis.start(); }
    });
  });
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu && menu.classList.contains('is-open')) d.querySelector('[data-menu="close"]').click();
  });

  // Visites à 360° : l'iframe ne se charge qu'à l'ouverture (performance, vie privée).
  var dialog = d.getElementById('tour');
  d.querySelectorAll('[data-tour]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!dialog) return;
      dialog.querySelector('h2').textContent = btn.getAttribute('data-title');
      var f = dialog.querySelector('iframe');
      f.src = btn.getAttribute('data-tour');
      f.title = btn.getAttribute('data-title');
      dialog.showModal();
      if (lenis) lenis.stop();
    });
  });
  if (dialog) {
    dialog.addEventListener('close', function () { dialog.querySelector('iframe').src = 'about:blank'; if (lenis) lenis.start(); });
    dialog.querySelector('[data-close]').addEventListener('click', function () { dialog.close(); });
  }

  // Formulaire : sujet et chalet pré-remplis depuis l'adresse (?sujet=plans&chalet=la-rouya)
  var form = d.querySelector('form[data-prefill]');
  if (form) {
    var q = new URLSearchParams(location.search);
    if (q.get('sujet') && form.sujet) form.sujet.value = q.get('sujet');
    if (q.get('chalet') && form.chalet) form.chalet.value = q.get('chalet');
  }

  var header = d.querySelector('.header');
  var lastY = 0;
  function onScrollHeader(y) {
    if (!header) return;
    var solidFrom = header.hasAttribute('data-solid-from') ? innerHeight * 0.6 : 8;
    header.classList.toggle('is-solid', y > solidFrom);
    var hide = y > lastY && y > innerHeight * 0.9 && !(menu && menu.classList.contains('is-open'));
    header.classList.toggle('is-hidden', hide);
    lastY = y;
  }

  /* ---------- Révélations (titres ligne par ligne, fondus, lumière rasante) ---------- */
  var revealIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('is-in', 'is-lit'); revealIO.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 }) : null;

  function showAll() {
    d.querySelectorAll('.lines, .fade, [data-light]').forEach(function (el) { el.classList.add('is-in', 'is-lit'); });
  }

  var lenis = null;
  // Statique si le mouvement est réduit, si une bibliothèque manque, ou si le délai de secours
  // (2,5 s, script en tête de page) a déjà basculé la page en mode statique.
  if (reduce.matches || !window.gsap || !window.ScrollTrigger || root.classList.contains('is-static')) {
    root.classList.add('is-static');
    showAll();
    addEventListener('scroll', function () { onScrollHeader(scrollY); }, { passive: true });
    onScrollHeader(scrollY);
    reduce.addEventListener && reduce.addEventListener('change', function () { location.reload(); });
    return;
  }

  root.classList.add('reveal-ready');
  d.querySelectorAll('.lines, .fade, [data-light]').forEach(function (el) { revealIO ? revealIO.observe(el) : el.classList.add('is-in', 'is-lit'); });

  /* ---------- Défilement adouci (inertie modérée, jamais confisqué) ---------- */
  var gsap = window.gsap, ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  gsap.defaults({ ease: EASE, duration: 1 });
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.11, wheelMultiplier: 1, smoothWheel: true, syncTouch: false });
    lenis.on('scroll', function (e) { ST.update(); onScrollHeader(e.scroll); });
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    d.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href'); if (id.length < 2) return;
        var t = d.querySelector(id); if (!t) return;
        e.preventDefault(); lenis.scrollTo(t, { offset: 0, duration: 1.4, easing: EASE });
      });
    });
  } else {
    addEventListener('scroll', function () { onScrollHeader(scrollY); }, { passive: true });
  }

  /* ---------- Scènes en profondeur ---------- */
  var SCRUB = 0.8;
  var active = new Set();
  var sceneIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var s = en.target.__scene; if (!s) return;
      if (en.isIntersecting) { active.add(s); en.target.classList.add('is-active'); }
      else { active.delete(s); en.target.classList.remove('is-active'); }
    });
  }, { rootMargin: '10% 0px' });

  function planesOf(scene) {
    var stage = scene.querySelector(small.matches ? '.scene__stage--m' : '.scene__stage--d') || scene.querySelector('.scene__stage');
    return stage ? Array.prototype.slice.call(stage.querySelectorAll('.scene__plane')) : [];
  }
  function num(v, f) { var n = parseFloat(v); return isNaN(n) ? f : n; }
  function cfgOf(plane) {
    var k = small.matches ? 0.5 : 1; // mobile : amplitudes divisées par deux
    var s = (plane.dataset.s || '1,1').split(',').map(Number);
    var y = (plane.dataset.y || '0,0').split(',').map(Number);
    var x = (plane.dataset.x || '0,0').split(',').map(Number);
    return {
      s: [1 + (s[0] - 1) * k, 1 + (s[1] - 1) * k],
      y: [y[0] * k, y[1] * k], x: [x[0] * k, x[1] * k],
      speed: num(plane.dataset.speed, 0.25),
      mouse: num(plane.dataset.mouse, 0) * (finePointer.matches && !small.matches ? 1 : 0)
    };
  }
  /* Les amplitudes sont exprimées pour un cadre de 1920 px : on les rapporte au cadre réel. */
  function unit(scene) { return scene.getBoundingClientRect().width / 1920; }

  function buildScene(scene, trigger, opts) {
    var planes = planesOf(scene); if (!planes.length) return null;
    var tl = gsap.timeline({
      defaults: { ease: 'none', force3D: true },
      scrollTrigger: { trigger: trigger, start: opts.start, end: opts.end, scrub: SCRUB, invalidateOnRefresh: true }
    });
    planes.forEach(function (pl) {
      var img = pl.querySelector('img'); var c = cfgOf(pl);
      tl.fromTo(img,
        { y: function () { return c.y[0] * unit(scene); }, x: function () { return c.x[0] * unit(scene); }, scale: c.s[0] },
        { y: function () { return c.y[1] * unit(scene); }, x: function () { return c.x[1] * unit(scene); }, scale: c.s[1], duration: 1 }, 0);
      pl.__mouse = c.mouse;
      if (c.mouse) {
        pl.__qx = gsap.quickTo(pl, 'x', { duration: 1.2, ease: EASE });
        pl.__qy = gsap.quickTo(pl, 'y', { duration: 1.2, ease: EASE });
      }
    });
    var s = { el: scene, planes: planes, tl: tl };
    scene.__scene = s; sceneIO.observe(scene);
    return s;
  }

  // 1. L'ouverture : la fenêtre s'ouvre sur la vallée, puis la caméra avance.
  var hero = d.querySelector('.hero');
  if (hero && window.__heroGeom) {
    var track = hero.querySelector('.hero__track');
    var frame = hero.querySelector('.hero__frame');
    var scene = frame.querySelector('.scene');
    var intro = hero.querySelector('.hero__intro');
    var cap = hero.querySelector('.hero__caption');
    // Fenêtre initiale : sous le titre, dans les marges de la grille. La scène a le format de l'image
    // (et non celui de l'écran) : la fenêtre montre toute la composition, puis s'ouvre au plein écran.
    // Même calcul que le script en ligne de la page (window.__heroGeom), pour que rien ne saute.
    var geom = window.__heroGeom;
    var setBox = function () { if (window.__heroBox) window.__heroBox(geom()); };
    ST.addEventListener('refreshInit', setBox);
    var tlh = gsap.timeline({
      defaults: { ease: 'none', force3D: true },
      scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: SCRUB, invalidateOnRefresh: true }
    });
    tlh.fromTo(frame, { scaleX: function () { return geom().sx; }, scaleY: function () { return geom().sy; }, y: function () { return geom().dy; } },
      { scaleX: 1, scaleY: 1, y: 0, duration: 0.32 }, 0)
      .fromTo(scene, { transformOrigin: '0 0', x: function () { return geom().tx; }, y: function () { return geom().ty; }, scaleX: function () { return geom().kx; }, scaleY: function () { return geom().ky; } },
      { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.32 }, 0)
      .to(intro, { y: function () { return -innerHeight * 0.1; }, opacity: 0, duration: 0.11 }, 0)
      .fromTo(cap, { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.3);
    hero.classList.add('is-live');
    var hs = buildScene(scene, track, { start: 'top top', end: 'bottom bottom' });
    if (hs) { sceneIO.observe(scene); }
    // Apparition initiale (< 1 s) : assurée par les mêmes révélations CSS que le reste du site.
  }

  // 2. Les scènes dans le flux : parallaxe en profondeur au passage.
  d.querySelectorAll('.scene[data-flow]').forEach(function (sc) {
    buildScene(sc, sc, { start: 'top bottom', end: 'bottom top' });
  });

  // 3. Le panorama : la vallée défile à l'horizontale, comme depuis un télésiège.
  d.querySelectorAll('.pano').forEach(function (p) {
    var trackP = p.querySelector('.pano__track');
    var band = p.querySelector('.pano__band');
    var sc = p.querySelector('.scene');
    var stage = function () { return sc.querySelector(small.matches ? '.scene__stage--m' : '.scene__stage--d'); };
    if (!stage()) return;
    var aspect = function () { return num(stage().dataset.aspect, 3); };
    var size = function () {
      var h = band.getBoundingClientRect().height; var w = h * aspect();
      return { w: Math.max(w, band.getBoundingClientRect().width * 1.25), bw: band.getBoundingClientRect().width };
    };
    var setSize = function () { var s = size(); sc.style.width = s.w + 'px'; };
    setSize(); addEventListener('resize', setSize);
    var tlp = gsap.timeline({
      defaults: { ease: 'none', force3D: true },
      scrollTrigger: { trigger: trackP, start: 'top top', end: 'bottom bottom', scrub: SCRUB, invalidateOnRefresh: true }
    });
    planesOf(sc).forEach(function (pl) {
      var f = num(pl.dataset.travel, 1);
      if (small.matches) f = 1 - (1 - f) * 0.5; // mobile : écarts entre plans divisés par deux
      // déplacement symétrique : les plans sont alignés à mi-course, aucun bord ne se découvre (f <= 1)
      tlp.fromTo(pl.querySelector('img'), { x: function () { var s = size(); return -(s.w - s.bw) * 0.5 * (1 - f); } },
        { x: function () { var s = size(); return -(s.w - s.bw) * 0.5 * (1 + f); }, duration: 1 }, 0);
    });
    sc.__scene = { el: sc, planes: planesOf(sc) }; sceneIO.observe(sc);
  });

  // 4. Rideaux de premier plan : un élément proche traverse l'écran plus vite que le reste.
  d.querySelectorAll('.curtain').forEach(function (c) {
    var el = c.querySelector('.curtain__el');
    var horizontal = c.classList.contains('curtain--post');
    gsap.fromTo(el, horizontal ? { x: 0 } : { y: 0 },
      horizontal
        ? { x: function () { return -(innerWidth * 1.4 + el.offsetWidth); }, ease: 'none', force3D: true,
            scrollTrigger: { trigger: c, start: 'top 85%', end: 'top 5%', scrub: 0.6 } }
        : { y: function () { return -innerHeight * 2.3; }, ease: 'none', force3D: true,
            scrollTrigger: { trigger: c, start: 'top bottom', end: 'top -30%', scrub: 0.6 } });
  });

  // 5. Le trait qui se dessine (ferme de charpente, rivières) : deux fois dans tout le site.
  d.querySelectorAll('[data-draw]').forEach(function (svg) {
    var paths = svg.querySelectorAll('[data-stroke]');
    paths.forEach(function (p) {
      var len = p.getTotalLength ? p.getTotalLength() : 1000;
      p.style.strokeDasharray = len + ' ' + len;
      p.style.strokeDashoffset = len;
    });
    gsap.to(paths, {
      strokeDashoffset: 0, ease: 'none', stagger: { each: 0.04 },
      scrollTrigger: { trigger: svg, start: 'top 80%', end: 'bottom 45%', scrub: 0.6 }
    });
    svg.querySelectorAll('[data-after]').forEach(function (t) {
      gsap.fromTo(t, { opacity: 0 }, { opacity: 1, duration: 1, ease: EASE, scrollTrigger: { trigger: svg, start: 'center 70%' } });
    });
  });

  /* ---------- Souris : légère inclinaison des plans, amortie (± 12 px au premier plan) ---------- */
  if (finePointer.matches) {
    var mx = 0, my = 0;
    addEventListener('pointermove', function (e) {
      mx = (e.clientX / innerWidth) * 2 - 1; my = (e.clientY / innerHeight) * 2 - 1;
      active.forEach(function (s) {
        s.planes.forEach(function (pl) {
          if (!pl.__mouse || small.matches) return;
          pl.__qx(-mx * pl.__mouse); pl.__qy(-my * pl.__mouse * 0.5);
        });
      });
    }, { passive: true });
  }

  /* ---------- Contrôle de fluidité : ajouter ?fps à l'adresse pour afficher les temps d'image ---------- */
  if (/[?&]fps\b/.test(location.search)) {
    var meter = d.createElement('div');
    meter.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99;padding:4px 8px;background:#1f3b57;color:#f8f6f1;font:12px/1.4 monospace';
    d.body.appendChild(meter);
    var fr = [], lastT = performance.now();
    (function loop(t) {
      fr.push(t - lastT); lastT = t; if (fr.length > 120) fr.shift();
      if (fr.length % 15 === 0) {
        var srt = fr.slice().sort(function (a, b) { return a - b; });
        meter.textContent = 'médiane ' + srt[srt.length >> 1].toFixed(1) + ' ms · p95 ' + srt[Math.floor(srt.length * 0.95)].toFixed(1) + ' ms';
      }
      requestAnimationFrame(loop);
    })(lastT);
  }

  /* ---------- Mise à jour au redimensionnement / changement de mise en page ---------- */
  var refresh = function () { ST.refresh(); };
  small.addEventListener && small.addEventListener('change', function () { location.reload(); });
  reduce.addEventListener && reduce.addEventListener('change', function () { location.reload(); });
  addEventListener('load', refresh);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(refresh);
})();
