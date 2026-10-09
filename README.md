# Chalets Lombard Vasina — page d’accueil

Page d’accueil seule, statique (HTML, CSS, JavaScript sans framework), publiée sur Vercel depuis `public/`.

Le parcours :

1. **Intro.** On traverse un nuage : une brume ivoire, deux nappes proches qui s’ouvrent et grandissent, une nappe lointaine qui se dissipe, puis la photo du hero, d’abord floue, se met au point.
2. **Hero.** La photo du chalet au crépuscule, découpée en trois plans (ciel, montagne et forêt, chalet). Au défilement, « Le soir tombe. » se couche derrière la montagne et le chalet, et le ciel s’assombrit. Le titre « Chalets bois d’exception dans les Hautes-Alpes » est en bas à gauche, en blanc sur un voile sombre.
3. **01 — Du soir au matin.** La phrase se met au point mot à mot au défilement ; chaque image qu’elle évoque (le matin, le feu, la table) vient se poser sur la précédente. Puis : « Ces chalets sont livrés. Le vôtre attend. »
4. **02 — En vente sur plan.** Les trois programmes : vue 3D extérieure ou intérieure, tableau des chalets, demande de plans et de prix.
5. **03 — Sur votre terrain**, **04 — La maison** (800 maisons pour 800 chalets réalisés, une règle de 1979 à aujourd’hui, 40 traits, 1 300 points pour 1 300 m² d’atelier), **le film** (il grandit jusqu’à remplir l’écran ; seul le son se règle, un clic met en pause), **05 — Ils y vivent**, **06 — Rencontrons-nous**.

Les titres apparaissent lettre après lettre : chaque lettre passe du flou au net en glissant un peu (comme l’effet « appear » de Framer). Les textes apparaissent en fondu, avec un flou très léger. Tout est en animations CSS, composées par le navigateur, sans calcul image par image.

Le violet Lombard n’est qu’une touche : il apparaît seulement dans le logo, le bouton principal, deux mots, le point « en vente » et quelques filets d’un pixel. Aucune section n’a un fond violet.

## Arborescence

| Chemin | Rôle |
|---|---|
| `src/index.html` | Gabarit de la page (hero, sections 01 à 06, pied de page, intro, tiroir). |
| `src/_intro_logo.svg`, `src/_trait.svg`, `src/_form.html` | Fragments inclus au build. |
| `data/programmes.json` | **Source unique des programmes en vente** : textes verbatim, lots, surfaces, vues 3D, date de vérification. |
| `tools/build.mjs` | Assemble `public/index.html` : images, plans du hero, logo inline, programmes, JSON-LD, typographie française, empreintes de cache. |
| `tools/images.py`, `tools/images.json`, `tools/images.d/*.json` | Export des photos en AVIF et WebP, avec couleur d’attente et aperçu flou. |
| `tools/grade.py` | Étalonnage commun des photos et des vues 3D. |
| `tools/hero_planes.py` | Découpe la photo du hero en trois plans de parallaxe (`public/assets/hero/<d|m>/`) : profondeur, segmentation, fond reconstitué derrière le chalet. |
| `tools/layers.py` | Outils de découpe en plans (profondeur, segmentation, remplissage LaMa), modèles chargés hors ligne. |
| `tools/hero_fog.py`, `tools/clouds.py`, `tools/paper.py` | Photo floue du hero pour l’intro (2 Ko, insérée dans la page) ; nappes de nuage de l’intro ; texture de papier du fond des sections. |
| `public/assets/video/` | Le film : extrait de 1:18 à la fin, encodé en H.264 (1920 et 1280 px) avec son image d’attente. |
| `tools/retouch/*.py` | Retouches documentées et rejouables (objets retirés, recadrages, image « éteinte » de la finale). |
| `tools/favicon.py` | Favicon et icône Apple (le pignon du logo). |
| `brand/logo/` | Logo redessiné en vectoriel : couleur, blanc, violet, emblème seul, PNG 4×. |
| `api/lead.js` | Fonction Vercel du formulaire « Recevoir les plans et les prix ». |
| `public/` | Le site publié. |

## Construire

```bash
node tools/build.mjs                       # public/index.html
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

Tant que ces variables ne sont pas définies, la fonction répond 503. La page affiche alors un message qui propose d’écrire à contact@chalets-lombard.fr (le lien ouvre un e-mail déjà rempli avec la demande) ou d’appeler. Aucune demande n’est perdue en silence.

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
- Les photos de la section 01 sont des chalets réalisés. Elles ne sont jamais présentées comme à vendre, et la page le dit explicitement.

## Questions à valider avec le client avant la mise en ligne

1. Accord pour les photos de la finale (chalet à l’heure bleue) et de la section « Sur votre terrain ». Ces chalets apparaissent aussi sur d’autres photos.
2. Serre d’Orchis :
   - deux ou trois chalets en vente ? Le chalet C n’a pas de visuel et reste masqué ;
   - orthographe « Serre Barbin » ou « Serre Babin » ?
3. Sabot de Vénus : sur la vue extérieure, quel chalet est le A et lequel est le B ?
4. La Rouya :
   - nombre de chambres ;
   - terrain exact ;
   - accord pour avoir retiré l’enfant, la voiture et la table de pique-nique de la vue 3D.
5. Accord pour citer les témoignages sur l’accueil, avec les coupes signalées.
6. Crédit photo de chaque image, destinataire du formulaire, texte de consentement, URL de la politique de confidentialité.
7. Téléchargement des polices Fontshare par le client (licence FFL).
