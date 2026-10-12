/* Chalets Lombard Vasina — page de vente La Rouya. Sans bibliothèque, sans défilement détourné.
   - demande : boutons [data-lead] → tiroir (dialog) ; formulaires [data-lead-form] → /api/lead, avec la
     provenance de la visite (utm, gclid, fbclid… gardés par le script de tête) ;
   - mesure : événements poussés dans dataLayer (Google Tag Manager) et, s'ils sont installés, gtag
     (generate_lead) et le pixel Meta (Lead, Contact) — aucun traceur n'est chargé ici ;
   - barre d'action mobile, en-tête clair ou sombre selon le fond, visionneuse d'images, apparitions. */
(() => {
  const html = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const motion = html.classList.contains('motion');
  const TEL = '04&#8239;92&#8239;21&#8239;29&#8239;19';

  /* ——— mesure ——— */
  const source = () => { try { return JSON.parse(sessionStorage.getItem('clv-src') || '{}'); } catch (e) { return {}; } };
  function track(event, data = {}) {
    const d = { event, programme: 'la-rouya', ...data };
    (window.dataLayer = window.dataLayer || []).push(d);
    if (event === 'generate_lead') {
      window.gtag?.('event', 'generate_lead', { programme: 'la-rouya', place: data.place });
      window.fbq?.('track', 'Lead', { content_name: 'La Rouya' });
    } else if (event === 'contact') {
      window.fbq?.('track', 'Contact', { content_name: 'La Rouya' });
    }
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-track]');
    if (a) track('contact', { method: a.dataset.track, place: a.dataset.place || null });
  });

  /* ——— en-tête : clair sur la photo, papier ailleurs ——— */
  const header = $('.header'), hero = $('.lp-hero'), finalForm = $('.lp-final__form'), bar = $('.lp-bar'), heroCta = $('.lp-hero__cta');
  let seenFinal = false, pastHero = false;
  const drawer = $('#drawer');
  function onScroll() {
    const hb = hero.getBoundingClientRect().bottom;
    header.dataset.theme = hb > 40 ? 'photo' : 'paper';
    pastHero = heroCta.getBoundingClientRect().bottom < 0;
    syncBar();
  }
  function syncBar() { bar.classList.toggle('is-on', pastHero && !seenFinal && !drawer.open); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { seenFinal = e.isIntersecting; syncBar(); }, { threshold: .15 }).observe(finalForm);
  }
  let raf = 0;
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; onScroll(); }); }, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ——— tiroir de demande ——— */
  let back = null;
  function openDrawer(place, souhait) {
    back = document.activeElement;
    const form = $('form', drawer);
    if (form && souhait) { const c = form.querySelector(`input[name="souhait"][value="${souhait}"]`); if (c) c.checked = true; }
    if (typeof drawer.showModal === 'function') drawer.showModal(); else drawer.setAttribute('open', '');
    html.style.overflow = 'hidden';
    syncBar();
    track('cta_click', { place: place || null, souhait: souhait || null });
    setTimeout(() => (form ? form.querySelector('[data-panel]:not([hidden]) input, [data-next]') : $('.lp-done', drawer))?.focus({ preventScroll: true }), 80);
  }
  function closeDrawer() {
    drawer.close?.(); drawer.removeAttribute('open');
    html.style.overflow = '';
    syncBar();
    back?.focus?.({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lead]');
    if (!b) return;
    e.preventDefault();
    openDrawer(b.dataset.place, b.dataset.souhait);
  });
  drawer.addEventListener('cancel', (e) => { e.preventDefault(); closeDrawer(); });
  drawer.addEventListener('click', (e) => { if (e.target === drawer || e.target.closest('[data-close]')) closeDrawer(); });

  /* ——— formulaires : un seul, partout (hero, tiroir, fin de page), en deux étapes ———
     1. ce qu'on veut recevoir et pour quel projet (des cases, rien à écrire) ; 2. les coordonnées.
     Sans JavaScript, les deux étapes s'affichent ensemble. */
  const SOUHAITS = { plans: 'les plans', prix: 'le prix', visite: 'la visite virtuelle', rdv: 'un rendez-vous' };
  const list = (a) => a.join(', ').replace(/, ([^,]*)$/, ' et $1');
  $$('form[data-lead-form]').forEach((form) => {
    const t0 = Date.now();
    const place = form.dataset.formPlace;
    form.setAttribute('action', '/api/lead');
    form.removeAttribute('enctype');
    let started = false;
    const start = () => { if (!started) { started = true; track('form_start', { place }); } };
    form.addEventListener('focusin', start);
    form.addEventListener('change', start);
    const panels = $$('[data-panel]', form), n = $('[data-step-n]', form), recap = $('[data-recap]', form);
    const go = (k, focus = true) => {
      form.dataset.step = String(k);
      panels.forEach((p) => { p.hidden = p.dataset.panel !== String(k); });
      if (n) n.textContent = `Étape ${k}`;
      if (k === 2 && recap) {
        const w = $$('input[name="souhait"]:checked', form).map((i) => SOUHAITS[i.value]);
        recap.innerHTML = w.length ? `Vous recevrez <strong>${list(w)}</strong>.` : 'Nous vous envoyons votre dossier La Rouya.';
        recap.hidden = false;
      }
      if (focus) (k === 2 ? form.elements.nom : $('input[name="souhait"]', form))?.focus({ preventScroll: true });
    };
    go(1, false);
    $('[data-next]', form)?.addEventListener('click', () => { go(2); track('form_step', { place, step: 2, usage: form.elements.usage?.value || null }); });
    $('[data-back]', form)?.addEventListener('click', () => go(1));
    const msg = $('.form__msg', form), btn = $('.btn--submit', form);
    const err = (input, on) => {
      const id = input.getAttribute('aria-describedby'), e = id && document.getElementById(id);
      input.setAttribute('aria-invalid', on ? 'true' : 'false');
      if (e) e.hidden = !on;
    };
    // l'erreur disparaît dès que le champ est corrigé
    form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid') === 'true') err(e.target, false); });
    form.addEventListener('change', (e) => { if (e.target.name === 'consentement' && e.target.checked) err(e.target, false); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nom = form.elements.nom, email = form.elements.email, ok = form.elements.consentement;
      const bad = [];
      if (!nom.value.trim()) bad.push(nom);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) bad.push(email);
      if (!ok.checked) bad.push(ok);
      [nom, email, ok].forEach((i) => err(i, bad.includes(i)));
      if (bad.length) { go(2, false); bad[0].focus(); track('form_error', { place, champs: bad.map((i) => i.name).join(',') }); return; }
      const fd = new FormData(form);
      const data = Object.fromEntries(fd);
      data.souhait = fd.getAll('souhait');
      data.duree = Date.now() - t0;
      data.page = 'la-rouya';
      data.place = place;
      data.source = source();
      btn.disabled = true;
      msg.textContent = 'Envoi en cours…';
      try {
        if (data.site) throw new Error('piège');
        const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!r.ok) throw new Error(String(r.status));
        track('generate_lead', { place, souhait: data.souhait.join(','), avec_tel: !!data.tel });
        done(form, data);
      } catch (x) {
        btn.disabled = false;
        const what = data.souhait.map((s) => SOUHAITS[s] || s).join(', ');
        const USAGES = { famille: 'Résidence familiale', location: 'Location saisonnière', retraite: 'Retraite à la montagne', decouverte: 'Je me renseigne' };
        const body = encodeURIComponent(`Projet : La Rouya, Puy-Saint-Vincent 1400\nJe souhaite recevoir : ${what || '—'}\nUsage envisagé : ${USAGES[data.usage] || '—'}\nNom : ${data.nom}\nE-mail : ${data.email}\nTéléphone : ${data.tel || '—'}\n\n${data.message || ''}`);
        const mailto = `mailto:contact@chalets-lombard.fr?subject=${encodeURIComponent(`La Rouya — ${data.nom}`)}&body=${body}`;
        track('lead_fallback', { place, raison: String(x && x.message) });
        if (String(x && x.message) === '503') {
          // envoi direct pas encore configuré : la messagerie du visiteur s'ouvre, demande déjà rédigée
          msg.innerHTML = `Votre messagerie s’ouvre avec votre demande déjà rédigée&nbsp;: il ne reste qu’à l’envoyer. Sinon, écrivez à <a class="link" href="${mailto.replace(/&/g, '&amp;')}">contact@chalets-lombard.fr</a> ou appelez le <a class="link" href="tel:+33492212919">${TEL}</a>.`;
          location.href = mailto;
        } else {
          msg.innerHTML = `L’envoi n’a pas abouti. Écrivez-nous à <a class="link" href="${mailto.replace(/&/g, '&amp;')}">contact@chalets-lombard.fr</a> ou appelez le <a class="link" href="tel:+33492212919">${TEL}</a>.`;
        }
      }
    });
  });
  // après l'envoi : tous les formulaires de la page cèdent la place au remerciement
  function done(form, data) {
    const prenom = String(data.nom || '').trim().split(/\s+/)[0];
    const what = data.souhait.length ? list(data.souhait.map((s) => SOUHAITS[s] || s)) : 'votre dossier';
    const panel = () => {
      const d = document.createElement('div');
      d.className = 'lp-done';
      d.tabIndex = -1;
      d.setAttribute('role', 'status');
      d.innerHTML = `<p class="lp-done__t">Merci${prenom ? ` ${prenom.replace(/[<>&"]/g, '')}` : ''}, <em>c’est bien reçu.</em></p>`
        + `<p>Votre demande (${what}) est transmise à l’équipe Lombard Vasina, qui revient vers vous.</p>`
        + `<p>Une question en attendant&nbsp;? <a href="tel:+33492212919" data-track="tel" data-place="merci">${TEL}</a></p>`;
      return d;
    };
    $$('form[data-lead-form]').forEach((f) => f.replaceWith(panel()));
    try { sessionStorage.setItem('clv-lead', '1'); } catch (e) { /* stockage indisponible */ }
    if (drawer.open) $('.lp-done', drawer)?.focus?.();
  }

  /* ——— visionneuse : chaque image [data-shot] s'ouvre en grand ; on parcourt celles de sa section ——— */
  const lb = $('#lb'), shots = $$('[data-shot]');
  if (lb && shots.length) {
    const img = $('.lb__img', lb), avifSrc = $('.lb__pic source', lb), cap = $('.lb__cap', lb), count = $('.lb__count', lb);
    // la plus grande largeur exportée de chaque image ; le navigateur choisit l'AVIF ou le WebP
    const last = (s) => (s || '').split(',').pop().trim().split(' ')[0];
    const item = (b) => {
      const im = b.querySelector('img');
      return {
        avif: last(b.querySelector('source[type="image/avif"]')?.getAttribute('srcset')),
        webp: last(b.querySelector('source[type="image/webp"]')?.getAttribute('srcset')) || im.src,
        alt: im.alt, cap: b.dataset.cap || '',
      };
    };
    let set = [], i = 0, opener = null;
    function show(k) {
      i = (k + set.length) % set.length;
      const it = set[i];
      avifSrc.srcset = it.avif || '';
      img.src = it.webp;
      img.alt = it.alt; cap.textContent = it.cap; count.textContent = `${i + 1} / ${set.length}`;
    }
    shots.forEach((b) => b.addEventListener('click', () => {
      opener = b;
      const group = $$('[data-shot]', b.closest('section'));
      set = group.map(item);
      show(group.indexOf(b));
      if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
      html.style.overflow = 'hidden';
      track('gallery_open', { section: b.closest('section').id || b.closest('section').className.split(' ')[1] || null });
    }));
    const close = () => { lb.close?.(); lb.removeAttribute('open'); html.style.overflow = ''; opener?.focus({ preventScroll: true }); };
    lb.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    lb.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') || e.target === lb || e.target.classList.contains('lb__in')) return close();
      const s = e.target.closest('[data-step]');
      if (s) show(i + Number(s.dataset.step));
    });
    lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(i + 1); else if (e.key === 'ArrowLeft') show(i - 1); });
    let x0 = null;
    lb.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    lb.addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 50) show(i + (e.clientX < x0 ? 1 : -1)); x0 = null; });
  }

  /* ——— à votre mesure : le chalet se réorganise (fonctionne aussi sans mouvement) ——— */
  const conf = $('[data-conf]');
  if (conf) {
    const tabs = $$('[role="tab"]', conf), stage = $('#conf-stage'), count = $('[data-conf-count]', conf);
    const LABEL = { base: '3 suites + dortoir', v1: '4 chambres · séjour traversant', v2: '3 chambres · vide sur salon', v3: 'Espace détente + parking couvert' };
    const setConf = (v, user) => {
      tabs.forEach((t) => { const on = t.dataset.confV === v; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      stage.dataset.state = v;
      stage.setAttribute('aria-labelledby', `conf-${v}`);
      let k = 0;
      $$('[data-in]', stage).forEach((el) => {
        const on = el.dataset.in.split(' ').includes(v);
        el.classList.toggle('is-off', !on);
        if (on && el.classList.contains('lp-room-t')) el.style.setProperty('--k', k++);
      });
      stage.classList.remove('is-anim'); void stage.offsetWidth; stage.classList.add('is-anim');
      count.textContent = LABEL[v];
      if (user) track('config', { version: v });
    };
    tabs.forEach((t) => t.addEventListener('click', () => setConf(t.dataset.confV, true)));
    conf.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0 || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      const n = tabs[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + tabs.length) % tabs.length];
      n.focus(); setConf(n.dataset.confV, true);
    });
    setConf('base', false);
  }

  /* ——— petits ciels de la journée : le soleil sur son arc, puis la lune ——— */
  const skyAt = (t) => [60 - 50 * Math.cos(Math.PI * t), 56 - 50 * Math.sin(Math.PI * t)];
  const placeSky = (svg, t) => { const [x, y] = skyAt(t); $('.lp-sky__body', svg).setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); };
  $$('.lp-sky').forEach((svg) => placeSky(svg, motion ? 0 : +svg.dataset.sky));

  if (!motion || !('IntersectionObserver' in window)) return;

  /* ——— apparitions : une fois, quand l'élément arrive ——— */
  const SPACE = /([ \t\n\r]+)/;
  function words(el) {
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    let n = 0;
    const walk = (node) => [...node.childNodes].forEach((c) => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(SPACE).forEach((t) => {
          if (!t) return;
          if (SPACE.test(t)) { frag.append(t); return; }
          const w = document.createElement('span');
          w.className = 'fx-w'; w.textContent = t; w.setAttribute('aria-hidden', 'true'); w.style.setProperty('--i', n++);
          frag.append(w);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1 && !c.matches('br, svg, a')) walk(c);
    });
    walk(el);
    el.setAttribute('aria-label', label);
    el.classList.add('fx-t');
  }
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const tween = (ms, fn, done) => { const t0 = performance.now(); const f = (now) => { const k = Math.min(1, (now - t0) / ms); fn(ease(k)); if (k < 1) requestAnimationFrame(f); else done?.(); }; requestAnimationFrame(f); };
  const NNBSP = ' ';
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  // ce qui se passe quand un élément arrive à l'écran
  const enter = (el) => {
    el.classList.add('is-in');
    if (el.matches('.lp-fact')) {                                       // les chiffres comptent jusqu'à leur valeur
      const n = $('[data-count]', el), to = +n.dataset.count;
      tween(1400, (k) => { n.textContent = fmt(to * k); });
    }
    if (el.matches('[data-ask]')) {                                     // la question s'écrit, sans rien décaler
      const q = $('.lp-ask__q', el), full = q.dataset.full, typed = q.firstChild, rest = q.lastChild;
      let i = 0;
      el.classList.add('is-typing');
      const step = () => { i++; typed.textContent = full.slice(0, i); rest.textContent = full.slice(i); if (i < full.length) setTimeout(step, full[i - 1] === ' ' ? 18 : 32); else setTimeout(() => el.classList.remove('is-typing'), 1400); };
      setTimeout(step, 300);
    }
    if (el.matches('.lp-sky')) tween(1800, (k) => placeSky(el, +el.dataset.sky * k));
    if (el.matches('[data-route]')) route(el);
  };
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    enter(e.target);
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: .12 });
  $$('[data-reveal]').forEach((el) => { if (el.matches('h2, h3')) words(el); io.observe(el); });
  // le titre du hero monte mot à mot dès l'arrivée ; le titre entier reste lu d'un seul tenant
  const hh = $('.lp-hero__t');
  if (hh) {
    const label = [...hh.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim()).join(' — ');
    words(hh);
    hh.setAttribute('aria-label', label);
    requestAnimationFrame(() => requestAnimationFrame(() => hh.classList.add('is-in')));
  }
  $$('[data-reveal-item]').forEach((el) => {
    const sibs = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal-item'));
    el.style.setProperty('--d', `${(sibs.indexOf(el) % 4) * .08}s`);
    io.observe(el);
  });
  $$('[data-ask]').forEach((el) => {
    const q = $('.lp-ask__q', el);
    q.dataset.full = q.textContent;
    const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = q.textContent;
    q.after(sr); q.setAttribute('aria-hidden', 'true');
    // ce qui est écrit, puis le reste, invisible : la place de la question est réservée dès le départ
    q.innerHTML = '<span class="lp-ask__t"></span><span class="lp-ask__r"></span>';
    q.lastChild.textContent = q.dataset.full;
    io.observe(el);
  });
  $$('.lp-fact').forEach((el) => { const n = $('[data-count]', el); n.textContent = '0'; io.observe(el); });
  $$('.lp-sky, .lp-rv, [data-route], [data-steps], .lp-how__ring, .lp-inc__g').forEach((el) => io.observe(el));
  $$('.lp-ring circle').forEach((c, i) => { c.setAttribute('pathLength', '1'); c.style.setProperty('--r', i); });

  /* ——— 300 m jusqu'aux pistes : le trait se dessine, puis un point fait le trajet, de temps en temps ——— */
  function route(fig) {
    const path = $('.lp-route__path', fig), dot = $('.lp-route__dot', fig), L = path.getTotalLength();
    let on = true;
    new IntersectionObserver(([e]) => { on = e.isIntersecting; }).observe(fig);
    const run = () => {
      if (!on || document.hidden) { setTimeout(run, 1200); return; }
      tween(2600, (k) => { const pt = path.getPointAtLength(L * k); dot.setAttribute('cx', pt.x.toFixed(1)); dot.setAttribute('cy', pt.y.toFixed(1)); }, () => setTimeout(run, 2200));
    };
    setTimeout(run, 1400);
  }

  /* ——— neige sur le hero : légère, en pause hors de l'écran ——— */
  (() => {
    const cv = document.createElement('canvas');
    cv.className = 'lp-snow'; cv.setAttribute('aria-hidden', 'true');
    $('.lp-hero__veil', hero).after(cv);
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, flakes = [], visible = true, raf = 0;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const size = () => {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = W < 768 ? 46 : 90;
      flakes = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, r: .7 + Math.random() * 2.1, v: .25 + Math.random() * .8, a: .35 + Math.random() * .5, p: Math.random() * 6.28 }));
    };
    const draw = (t) => {
      ctx.clearRect(0, 0, W, H);
      for (const f of flakes) {
        f.y += f.v; f.x += Math.sin(t / 1600 + f.p) * .35;
        if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W; }
        ctx.globalAlpha = f.a; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fillStyle = '#fff'; ctx.fill();
      }
      raf = visible && !document.hidden ? requestAnimationFrame(draw) : 0;
    };
    const wake = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw); };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(hero);
    document.addEventListener('visibilitychange', wake);
    addEventListener('resize', size, { passive: true });
    size(); wake();
  })();

  /* ——— lecture : un fil violet en haut de l'écran ; images qui respirent au défilement ——— */
  const bar0 = document.createElement('div'); bar0.className = 'lp-progress'; bar0.innerHTML = '<i></i>'; document.body.append(bar0);
  const pxs = $$('[data-px]');
  const pxOn = new Set();
  const ioPx = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? pxOn.add(e.target) : pxOn.delete(e.target))), { rootMargin: '10% 0px' });
  pxs.forEach((el) => ioPx.observe(el));
  let raf2 = 0;
  const frame = () => {
    raf2 = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar0.firstChild.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    pxOn.forEach((el) => {
      const r = el.getBoundingClientRect(), k = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      el.style.setProperty('--py', `${(-k * 5).toFixed(2)}%`);
    });
  };
  addEventListener('scroll', () => { if (!raf2) raf2 = requestAnimationFrame(frame); }, { passive: true });
  frame();

  /* ——— boutons : légèrement aimantés à la souris, un reflet passe de temps en temps ——— */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('.lp .btn, .lp-btn2').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--mx', `${((e.clientX - r.left) / r.width - .5) * 8}px`);
        b.style.setProperty('--my', `${((e.clientY - r.top) / r.height - .5) * 6}px`);
      });
      b.addEventListener('pointerleave', () => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
    });
  }
  const seen = new Set();
  const ioB = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target))));
  $$('.lp .btn:not(.btn--submit), .lp-bar__cta').forEach((b) => ioB.observe(b));
  setInterval(() => {
    if (document.hidden) return;
    seen.forEach((b) => { b.classList.remove('is-shine'); void b.offsetWidth; b.classList.add('is-shine'); });
  }, 6500);
  // une case cochée fait un petit bond
  document.addEventListener('change', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) { chip.classList.remove('is-pop'); void chip.offsetWidth; chip.classList.add('is-pop'); }
  });
})();
