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
    if (souhait) { const c = form.querySelector(`input[name="souhait"][value="${souhait}"]`); if (c) c.checked = true; }
    if (typeof drawer.showModal === 'function') drawer.showModal(); else drawer.setAttribute('open', '');
    html.style.overflow = 'hidden';
    syncBar();
    track('cta_click', { place: place || null, souhait: souhait || null });
    setTimeout(() => form.elements.nom?.focus({ preventScroll: true }), 80);
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

  /* ——— formulaires ——— */
  const SOUHAITS = { plans: 'les plans', prix: 'le prix', visite: 'la visite virtuelle', rdv: 'un rendez-vous' };
  $$('form[data-lead-form]').forEach((form) => {
    const t0 = Date.now();
    const place = form.dataset.formPlace;
    form.setAttribute('action', '/api/lead');
    form.removeAttribute('enctype');
    let started = false;
    form.addEventListener('focusin', () => { if (!started) { started = true; track('form_start', { place }); } });
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
      if (bad.length) { bad[0].focus(); track('form_error', { place, champs: bad.map((i) => i.name).join(',') }); return; }
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
        const body = encodeURIComponent(`Projet : La Rouya, Puy-Saint-Vincent 1400\nJe souhaite recevoir : ${what || '—'}\nNom : ${data.nom}\nE-mail : ${data.email}\nTéléphone : ${data.tel || '—'}\n\n${data.message || ''}`);
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
    const what = data.souhait.length ? data.souhait.map((s) => SOUHAITS[s] || s).join(', ').replace(/, ([^,]*)$/, ' et $1') : 'votre dossier';
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

  /* ——— visionneuse ——— */
  const lb = $('#lb'), shots = $$('[data-shot]');
  if (lb && shots.length) {
    const img = $('.lb__img', lb), avifSrc = $('.lb__pic source', lb), cap = $('.lb__cap', lb), count = $('.lb__count', lb);
    // la plus grande largeur exportée de chaque image ; le navigateur choisit l'AVIF ou le WebP
    const last = (s) => (s || '').split(',').pop().trim().split(' ')[0];
    const items = shots.map((b) => {
      const im = b.querySelector('img');
      return {
        avif: last(b.querySelector('source[type="image/avif"]')?.getAttribute('srcset')),
        webp: last(b.querySelector('source[type="image/webp"]')?.getAttribute('srcset')) || im.src,
        alt: im.alt, cap: b.closest('figure').querySelector('figcaption')?.textContent || '',
      };
    });
    let i = 0, opener = null;
    function show(k) {
      i = (k + items.length) % items.length;
      const it = items[i];
      avifSrc.srcset = it.avif || '';
      img.src = it.webp;
      img.alt = it.alt; cap.textContent = it.cap; count.textContent = `${i + 1} / ${items.length}`;
    }
    shots.forEach((b, k) => b.addEventListener('click', () => {
      opener = b;
      show(k);
      if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
      html.style.overflow = 'hidden';
      track('gallery_open', { image: k + 1 });
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

  /* ——— apparitions : une fois, quand l'élément arrive ——— */
  if (!motion || !('IntersectionObserver' in window)) return;
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
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: .12 });
  $$('[data-reveal]').forEach((el) => { if (el.matches('h2, h3')) words(el); io.observe(el); });
  $$('[data-reveal-item]').forEach((el) => {
    const sibs = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal-item'));
    el.style.setProperty('--d', `${(sibs.indexOf(el) % 4) * .08}s`);
    io.observe(el);
  });
})();
