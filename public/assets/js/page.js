/* Sections 01, 02 et 04 : la citation qui s'allume mot à mot, la bascule extérieur / intérieur
   des vues 3D de chaque programme, les compteurs de la maison. Les images restent fixes. */
(() => {
  const App = window.App;
  if (!App) return;
  const { $, $$ } = App;

  /* ——— 02 : extérieur / intérieur (fonctionne aussi sans mouvement) ——— */
  function views() {
    $$('.prog').forEach((prog) => {
      const btns = $$('.prog__switch button', prog), pics = $$('.prog__view', prog);
      const show = (kind) => {
        btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === kind)));
        pics.forEach((p) => {
          const on = p.dataset.view === kind;
          if (on) { const im = $('img', p); if (im) im.loading = 'eager'; }
          p.classList.toggle('is-on', on);
        });
      };
      btns.forEach((b) => {
        b.addEventListener('click', () => show(b.dataset.view));
        // l'intérieur est chargé dès qu'on s'en approche : la bascule est instantanée
        b.addEventListener('pointerenter', () => { const im = $(`.prog__view[data-view="${b.dataset.view}"] img`, prog); if (im) im.loading = 'eager'; }, { once: true });
      });
    });
  }

  if (!App.ok) { document.addEventListener('DOMContentLoaded', views); return; }

  /* ——— 01 : la phrase s'allume au fil de la lecture ——— */
  function quote() {
    const q = $('.real__quote');
    if (!q) return;
    const words = [];
    // mots en ligne (pas en bloc) : aucune coupure là où le texte n'a pas d'espace
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((t) => {
          if (!t) return;
          if (/^\s+$/.test(t)) { frag.append(t); return; }
          const w = document.createElement('span'); w.className = 'w'; w.textContent = t; frag.append(w); words.push(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk(q);
    gsap.fromTo(words, { opacity: .16 }, { opacity: 1, ease: 'none', stagger: .1, scrollTrigger: { trigger: q, start: 'top 78%', end: 'bottom 48%', scrub: true } });
  }

  /* ——— 04 : les chiffres roulent, un filet se trace au-dessus ——— */
  function nums() {
    $$('.num').forEach((n, i) => {
      const odo = $('.odo', n);
      const roll = odo && App.odometer ? App.odometer(odo) : null;
      App.onEnter(n, () => { n.classList.add('is-in'); if (roll) gsap.delayedCall(i * .12, roll); }, 'top 88%');
    });
  }

  document.addEventListener('DOMContentLoaded', views);
  document.addEventListener('app:ready', () => {
    if (!App.motion) return;
    quote(); nums();
    ScrollTrigger.refresh();
  });
})();
