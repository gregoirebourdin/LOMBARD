# Chalets Lombard Vasina — page d’accueil et page de vente La Rouya

Deux pages statiques (HTML, CSS, JavaScript sans framework), publiées sur Vercel depuis `public/` : l’accueil (`/`) et la page de vente du chalet La Rouya (`/la-rouya`), faite pour les campagnes Google Ads et Meta.

Le parcours de l’accueil :

1. **Intro.** On traverse un nuage : une brume ivoire, deux nappes proches qui s’ouvrent et grandissent, une nappe lointaine qui se dissipe, puis la photo du hero, d’abord floue, se met au point.
2. **Hero.** La photo du chalet au crépuscule, découpée en trois plans (ciel, montagne et forêt, chalet). Au défilement, « Le soir tombe. » se couche derrière la montagne et le chalet, et le ciel s’assombrit. Le titre « Chalets bois d’exception dans les Hautes-Alpes » est en bas à gauche, en blanc sur un voile sombre.
3. **01 — Du soir au matin.** La phrase se met au point mot à mot au défilement ; chaque image qu’elle évoque (le matin, le feu, la table) vient se poser sur la précédente. Puis : « Ces chalets sont livrés. Le vôtre attend. »
4. **Votre chalet vous attend.** Une photo d’hiver en plans (ciel, chalet, quatre masses de branches de sapin enneigées tout près) : les branches arrivent énormes et couvrent l’écran, puis s’écartent chacune vers son coin jusqu’à leur place exacte sur la photo (sans jamais découvrir ce qu’elles cachent), en découvrant le chalet et le titre qui se met au point.
5. **02 — En vente sur plan.** Les trois programmes : vue 3D extérieure ou intérieure, tableau des chalets, demande de plans et de prix.
6. **03 — Sur votre terrain**, **04 — La maison** (un registre : 1979, 800+, 40, 1 300 m² en grand corps sur des filets fins, qui comptent jusqu’à leur valeur), **le film** (il grandit jusqu’à remplir l’écran ; seul le son se règle, un clic met en pause), **05 — Ils y vivent** (une galerie de grandes photos de chalets réalisés, chacune avec la parole d’un client ; elle défile à l’horizontale pendant qu’on descend, ou se fait glisser sur mobile), **06 — Rencontrons-nous**.

Les titres apparaissent mot après mot au fil du défilement : chaque mot monte, passe de transparent à opaque et du flou au net (comme « Scroll Blur Reveal » de Framer). Les textes apparaissent en fondu, avec un flou très léger.

## La page de vente La Rouya (`/la-rouya`)

Une page d’atterrissage pour les annonces : même papier, mêmes caractères, mais peu d’animation (aucun défilement détourné, aucune bibliothèque) pour qu’elle s’affiche vite et se lise vite. Chaque section répond à une question de l’acheteur, dans l’ordre où il se la pose :

1. **La promesse** (hero) : « Un chalet neuf de 167 m², à 300 m des pistes », la vue 3D, et, sur grand écran, le formulaire à droite.
2. **Les chiffres qui décident** (167 m², 1 240 m², jusqu’à 12 couchages, 300 m des pistes) et la confiance (depuis 1979, 800+ chalets, 40 passionnés, permis purgé).
3. **Une journée à La Rouya** : cinq moments (8 h 30, 13 h, 16 h, 20 h, 22 h), chacun tenu par un fait (garage, pièce de vie, terrain, couchages, plancher chauffant), pour se projeter.
4. **Toutes les vues** en planche, avec visionneuse ; **ce que vous achetez, dans le détail** (terrain, construction, espaces, confort, accompagnement, options) ; **les finitions, en vrai**, pièce par pièce, avec des photographies de chalets livrés par Lombard Vasina (jamais présentées comme La Rouya).
5. **Le plan à votre mesure**, **le terrain** (cinq photographies réelles), **« Profiter aujourd’hui. Transmettre demain. »**, **comment nous construisons** (poteau-poutre, assemblages traditionnels, douglas), **le constructeur** (vrais avis), **les étapes**, **les questions**.
6. **La demande**, avec les coordonnées.

**Un seul formulaire, partout** (hero, tiroir, fin de page), en deux étapes : d’abord ce qu’on veut recevoir (plans, prix, visite virtuelle, rendez-vous) et le projet (résidence familiale, location saisonnière, retraite, simple renseignement), en un clic ; puis les coordonnées, avec un récapitulatif. Les boutons disent ce qu’on obtient (« Recevoir les plans et le prix », « Recevoir la visite virtuelle ») et, dessous, ce que ça engage (« Gratuit et sans engagement »). La demande est toujours à portée : en-tête, hero, journée, galerie, inventaire, étapes, questions, barre fixe « Appeler / Recevoir les plans et le prix » sur mobile. Après l’envoi, tous les formulaires laissent place à un remerciement.

**Mesure des conversions.** `lp.js` pousse dans `dataLayer` (Google Tag Manager) : `cta_click`, `form_start`, `form_step`, `form_error`, `generate_lead`, `lead_fallback`, `contact` (clic sur le téléphone ou l’e-mail), `gallery_open`. Si `gtag` ou le pixel Meta (`fbq`) sont installés, `generate_lead` / `Lead` et `Contact` leur sont aussi envoyés. Aucun traceur n’est chargé par la page : ajoutez GTM ou les balises de vos comptes publicitaires (avec le bandeau de consentement) avant de lancer les campagnes. La provenance de la visite (`utm_*`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, page d’origine) est jointe à chaque demande.

Le violet Lombard n’est qu’une touche : il apparaît seulement dans le logo, le bouton principal, deux mots, le point « en vente » et quelques filets d’un pixel. Aucune section n’a un fond violet.

## Arborescence

| Chemin | Rôle |
|---|---|
| `src/index.html` | Gabarit de la page (hero, sections 01 à 06, pied de page, intro, tiroir). |
| `src/la-rouya.html`, `src/_form-rouya.html` | Page de vente La Rouya et son formulaire unique en deux étapes. |
| `public/assets/css/lp.css`, `public/assets/js/lp.js` | Styles et script de la page de vente (par-dessus `site.css`, sans GSAP ni Lenis). |
| `tools/images.d/rouya.json` | Images de la page de vente : vues 3D, images générées par IA (étiquetées comme telles, mention toujours visible), photographies du terrain, photographies de chalets livrés (références de finition). |
| `src/_intro_logo.svg`, `src/_trait.svg`, `src/_form.html` | Fragments inclus au build. |
| `data/programmes.json` | **Source unique des programmes en vente** : textes verbatim, lots, surfaces, vues 3D, date de vérification. |
| `tools/build.mjs` | Assemble `public/index.html` et `public/la-rouya.html` : images, plans du hero, logo inline, programmes, JSON-LD, typographie française, empreintes de cache. |
| `tools/images.py`, `tools/images.json`, `tools/images.d/*.json` | Export des photos en AVIF et WebP, avec couleur d’attente et aperçu flou. |
| `tools/grade.py` | Étalonnage commun des photos et des vues 3D. |
| `tools/hero_planes.py` | Découpe la photo du hero en trois plans de parallaxe (`public/assets/hero/<d|m>/`) : profondeur, segmentation, fond reconstitué derrière le chalet. |
| `tools/layers.py` | Outils de découpe en plans (profondeur, segmentation, remplissage LaMa), modèles chargés hors ligne. |
| `tools/scene_planes.py` | Découpe la photo de la scène « Votre chalet vous attend » en plans (`public/assets/scenes/vca/`) : profondeur, détourage des branches floues (pymatting), puis quatre masses de branches ancrées à leur coin, sans couture. Calculs lourds en cache (`--fresh` pour refaire). Modèles : variable `HF_CACHE` (cache Hugging Face). |
| `tools/hero_fog.py`, `tools/paper.py`, `tools/images.d/temoignages.json` | Photo floue du hero pour l’intro (2 Ko, insérée dans la page, sans bloc de compression visible) ; texture de papier du fond des sections. Les nuages de l’intro sont dessinés en direct par `intro.js`. Photos de la galerie des témoignages (chalets réalisés). |
| `public/assets/video/` | Le film en entier (depuis le début, sans la fraction de seconde noire initiale), encodé en H.264 (1920 px CRF 27, 1280 px CRF 28, démarrage rapide) avec son image d’attente (plan aérien et logo, à 3 s). |
| `tools/retouch/*.py` | Retouches documentées et rejouables (objets retirés, recadrages, image « éteinte » de la finale). |
| `tools/favicon.py` | Favicon et icône Apple (le pignon du logo). |
| `brand/logo/` | Logo redessiné en vectoriel : couleur, blanc, violet, emblème seul, PNG 4×. |
| `api/lead.js` | Fonction Vercel du formulaire « Recevoir les plans et les prix ». |
| `public/` | Le site publié. |

## Construire

```bash
node tools/build.mjs                       # public/index.html et public/la-rouya.html
python tools/images.py [nom …]             # exporte les photos (Pillow avec AVIF)
python tools/hero_planes.py [d|m]          # plans du hero → public/assets/hero (modèles hors ligne)
```

Il n’y a pas de dépendance npm. Vercel publie `public/` tel quel, et la fonction `api/lead.js` est déployée automatiquement.

## Mettre à jour un programme en vente

1. Modifier `data/programmes.json` : textes, lots, surfaces, statut `en-vente`, `bientot` ou `vendu`.
2. Mettre `verifie_le` à la date du jour.
3. Lancer `node tools/build.mjs`.

**Le build échoue si un programme en vente n’a pas été vérifié depuis plus de 60 jours.** C’est voulu : la page ne doit jamais afficher un chalet déjà vendu.

## Formulaire

Le formulaire envoie un `POST /api/lead`. La fonction transmet la demande par e-mail via [Resend](https://resend.com) dès que ces variables d’environnement sont définies dans le projet Vercel :

| Variable | Contenu |
|---|---|
| `RESEND_API_KEY` | Clé d’API Resend. |
| `LEAD_TO` | Destinataire(s), séparés par des virgules (par exemple `contact@chalets-lombard.fr`). |
| `LEAD_FROM` | Facultatif : expéditeur sur un domaine vérifié chez Resend. |
| `LEAD_WEBHOOK` | Facultatif : URL qui reçoit chaque demande en JSON (scénario Make ou Zapier, CRM…), avec sa provenance. |

L’e-mail et le webhook peuvent être activés ensemble ; la demande est acceptée dès qu’un des deux l’a reçue. Tant qu’aucun n’est configuré, la fonction répond 503. La page affiche alors un message qui propose d’écrire à contact@chalets-lombard.fr (le lien ouvre un e-mail déjà rempli avec la demande) ou d’appeler. Aucune demande n’est perdue en silence.

Le formulaire est protégé par un champ piège et un délai minimal de saisie.

## Polices

| Police | Graisses | Licence |
|---|---|---|
| Boska | Light, Light Italic, Regular | ITF Free Font License (Fontshare) |
| General Sans | Regular, Medium | ITF Free Font License (Fontshare) |
| Fragment Mono | Regular | SIL OFL |

La licence FFL interdit de modifier ou de sous-ensembler les fichiers. **Le client doit télécharger sa propre copie sur fontshare.com** et remplacer celles de `public/assets/fonts/`.

## Honnêteté du contenu

- Tous les textes entre « » sont repris mot pour mot du site actuel. Seules quelques coquilles ont été corrigées : « m2 » devient « m² », « A l’étage » devient « À l’étage », et les coupes sont signalées par « […] ».
- Aucun prix, aucune date de livraison, aucune note, aucun avis inventé.
- Chaque programme porte la mention « Vues 3D non contractuelles » sous ses vues 3D.
- Page La Rouya : chaque image dit ce qu’elle est (« vue 3D non contractuelle », « image générée par IA, non contractuelle », « photographie du terrain », « chalet réalisé par Lombard Vasina »). Les finitions montrées pièce par pièce sont celles de chalets déjà livrés, présentées comme la référence de qualité annoncée par le site (« de la qualité de nos précédentes réalisations »), jamais comme La Rouya. L’inventaire « ce que vous achetez » ne reprend que des faits publiés (page La Rouya, pages Savoir-faire et Construction bois) ; ce que le site ne dit pas (cuisine, raccordements, délais) n’est pas affirmé. Les images générées par IA gardent la mention incrustée du site actuel. Le prix n’est jamais affiché : il est envoyé sur demande, comme sur le site actuel.
- Les photos de la section 01 sont des chalets réalisés. Elles ne sont jamais présentées comme à vendre, et la page le dit explicitement.

## Questions à valider avec le client avant la mise en ligne

1. Accord pour les photos de la finale (chalet à l’heure bleue) et de la section « Sur votre terrain ». Ces chalets apparaissent aussi sur d’autres photos.
2. Serre d’Orchis :
   - deux ou trois chalets en vente ? Le chalet C n’a pas de visuel et reste masqué ;
   - orthographe « Serre Barbin » ou « Serre Babin » ?
3. Sabot de Vénus : sur la vue extérieure, quel chalet est le A et lequel est le B ?
4. La Rouya :
   - nombre de chambres : le site dit à la fois « 4 chambres en suite » et « 3 suites + dortoir » ; la page de vente reprend « 3 suites et un dortoir » (chiffres clés et image du dortoir), et « jusqu’à 5 chambres avec salle de bain selon le plan » ;
   - terrain exact ;
   - accord pour avoir retiré l’enfant, la voiture et la table de pique-nique de la vue 3D ;
   - ce que le site ne dit pas et que les acheteurs demandent : terrain viabilisé (eau, électricité, assainissement) ? cuisine équipée ? cheminée (présente sur les vues 3D) ? date de livraison prévue ? Chaque réponse confirmée peut rejoindre l’inventaire « ce que vous achetez » de la page de vente ;
   - accord pour montrer, sur la page de vente, des photographies de chalets livrés comme référence de finition.
5. Accord pour citer les témoignages sur l’accueil, avec les coupes signalées.
6. Crédit photo de chaque image, destinataire du formulaire, texte de consentement, URL de la politique de confidentialité.
7. Téléchargement des polices Fontshare par le client (licence FFL).
