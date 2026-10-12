// POST /api/lead — demandes « plans, prix, visite virtuelle, rendez-vous » (fonction Vercel, Node 18+).
// Deux canaux, chacun activé par ses variables d'environnement du projet Vercel :
// - e-mail via Resend : RESEND_API_KEY et LEAD_TO (adresses séparées par des virgules ; LEAD_FROM facultatif) ;
// - webhook : LEAD_WEBHOOK (URL d'un scénario Make, Zapier, d'un CRM…) qui reçoit la demande en JSON.
// Réussite dès qu'un canal a accepté la demande. Aucun canal configuré : 503, et la page propose alors
// d'écrire directement à contact@chalets-lombard.fr (demande déjà rédigée) ou d'appeler, sans rien perdre.
const NOMS = { 'serre-orchis': 'Le Serre d’Orchis', 'sabot-venus': 'Le Sabot de Vénus', 'la-rouya': 'La Rouya', terrain: 'Un chalet sur mon terrain' };
const SOUHAITS = { plans: 'Recevoir les plans', prix: 'Connaître les prix', visite: 'Recevoir la visite virtuelle', rdv: 'Prendre rendez-vous' };
const PAGES = { 'la-rouya': 'la page de vente La Rouya' };
const USAGES = { famille: 'Résidence familiale', location: 'Location saisonnière', retraite: 'Retraite à la montagne', decouverte: 'Je me renseigne' };
const SOURCE_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'referrer', 'arrivee'];
const clean = (v, n = 500) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  // champ piège rempli, ou formulaire envoyé en moins de 3 s : on répond poliment sans rien envoyer
  if (b.site || Number(b.duree) < 3000) return res.status(200).json({ ok: true });
  const nom = clean(b.nom, 120), email = clean(b.email, 160);
  if (!nom || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !b.consentement) return res.status(400).json({ ok: false, reason: 'invalid' });

  const key = process.env.RESEND_API_KEY, to = process.env.LEAD_TO, hook = process.env.LEAD_WEBHOOK;
  if (!(key && to) && !hook) return res.status(503).json({ ok: false, reason: 'not_configured' });

  const souhaits = (Array.isArray(b.souhait) ? b.souhait : [b.souhait]).filter(Boolean).map((s) => SOUHAITS[s] || clean(s, 40));
  const projet = NOMS[b.programme] || '—';
  const lot = b.lot ? clean(b.lot, 10) : '';
  const page = PAGES[b.page] || 'la page d’accueil';
  const src = {};
  if (b.source && typeof b.source === 'object') for (const k of SOURCE_KEYS) if (b.source[k]) src[k] = clean(b.source[k], 200);
  const lead = {
    projet, programme: clean(b.programme, 40) || null, lot: lot || null, souhaits, usage: USAGES[b.usage] || null,
    nom, email, tel: clean(b.tel, 40) || null, message: clean(b.message, 4000) || null,
    page: clean(b.page, 40) || 'accueil', emplacement: clean(b.place, 40) || null, provenance: src, recu_le: new Date().toISOString(),
  };
  const provenance = Object.keys(src).length ? Object.entries(src).map(([k, v]) => `${k} : ${v}`).join('\n') : '(visite directe ou inconnue)';
  const text = [
    `Projet : ${projet}${lot ? `, chalet ${lot}` : ''}`,
    `Je souhaite : ${souhaits.join(', ') || '—'}`,
    ...(lead.usage ? [`Usage envisagé : ${lead.usage}`] : []),
    `Nom : ${nom}`, `E-mail : ${email}`, `Téléphone : ${lead.tel || '—'}`,
    '', lead.message || '(pas de message)', '',
    `— Envoyé depuis ${page} chalets-lombard${lead.emplacement ? ` (formulaire : ${lead.emplacement})` : ''}`,
    '', 'Provenance de la visite :', provenance,
  ].join('\n');

  const jobs = [];
  if (key && to) {
    jobs.push(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.LEAD_FROM || 'Site Lombard Vasina <onboarding@resend.dev>', to: to.split(','), reply_to: email, subject: `${souhaits.length ? 'Plans et prix' : 'Demande'} — ${projet} — ${nom}`, text }),
    }).then((r) => r.ok));
  }
  if (hook) {
    jobs.push(fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) }).then((r) => r.ok));
  }
  const results = await Promise.allSettled(jobs);
  if (results.some((r) => r.status === 'fulfilled' && r.value)) return res.status(200).json({ ok: true });
  return res.status(502).json({ ok: false, reason: 'provider' });
};
