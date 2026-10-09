// POST /api/lead — demande « Recevoir les plans et les prix » (fonction Vercel, Node 18+).
// Envoie un e-mail via Resend si RESEND_API_KEY et LEAD_TO sont définis dans les variables
// d'environnement du projet Vercel (LEAD_FROM facultatif). Sinon, répond 503 : la page propose
// alors d'écrire directement à contact@chalets-lombard.fr ou d'appeler, sans rien perdre.
const NOMS = { 'serre-orchis': 'Le Serre d’Orchis', 'sabot-venus': 'Le Sabot de Vénus', 'la-rouya': 'La Rouya', terrain: 'Un chalet sur mon terrain' };
const SOUHAITS = { plans: 'Recevoir les plans', prix: 'Connaître les prix', rdv: 'Prendre rendez-vous' };
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
  const key = process.env.RESEND_API_KEY, to = process.env.LEAD_TO;
  if (!key || !to) return res.status(503).json({ ok: false, reason: 'not_configured' });
  const souhaits = (Array.isArray(b.souhait) ? b.souhait : [b.souhait]).filter(Boolean).map((s) => SOUHAITS[s] || clean(s, 40));
  const projet = NOMS[b.programme] || '—';
  const text = [
    `Projet : ${projet}${b.lot ? `, chalet ${clean(b.lot, 10)}` : ''}`,
    `Je souhaite : ${souhaits.join(', ') || '—'}`,
    `Nom : ${nom}`, `E-mail : ${email}`, `Téléphone : ${clean(b.tel, 40) || '—'}`,
    '', clean(b.message, 4000) || '(pas de message)', '', '— Envoyé depuis la page d’accueil chalets-lombard.fr',
  ].join('\n');
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.LEAD_FROM || 'Site Lombard Vasina <onboarding@resend.dev>', to: to.split(','), reply_to: email, subject: `Plans et prix — ${projet} — ${nom}`, text }),
    });
    if (!r.ok) return res.status(502).json({ ok: false, reason: 'provider' });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ ok: false, reason: 'provider' });
  }
};
