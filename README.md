# Chalets Lombard Vasina — page d’accueil « Entrez. »

Page d’accueil seule, statique (HTML, CSS, JavaScript sans framework), publiée sur Vercel depuis `public/`.

Le concept : un plan-séquence au crépuscule, sur papier ivoire.

1. Le logo officiel se compose, puis le mot CHALETS laisse place à une fenêtre en pignon.
2. On plonge dans un vrai ciel violet et on traverse la vitre éclairée.
3. On passe du feu à la table, puis au matin.
4. La page dit honnêtement « Ces chalets sont livrés. Le vôtre attend. » et présente les trois programmes en vente sur plan, ou la construction sur votre terrain.

Le violet Lombard n’est qu’une touche : il apparaît seulement dans le logo, le bouton principal, trois mots, le point « à vendre » et quelques filets d’un pixel. Aucune section n’a un fond violet.

## Arborescence

| Chemin | Rôle |
|---|---|
| `src/index.html` | Gabarit de la page (sections S1 à S9, intro, tiroir). |
| `src/_intro_logo.svg`, `src/_trait.svg`, `src/_form.html` | Fragments inclus au build. |
| `data/programmes.json` | **Source unique des programmes en vente** : textes verbatim, lots, surfaces, vues 3D, date de vérification. |
| `data/carte.json` | Coordonnées de la carte au trait, issues de la Base Adresse Nationale. |
| `tools/build.mjs` | Assemble `public/index.html` : images, logo inline, programmes, carte, JSON-LD, typographie française, empreintes de cache. |
| `tools/images.py`, `tools/images.json`, `tools/images.d/*.json` | Export des photos en AVIF et WebP, avec couleur d’attente et aperçu flou. |
| `tools/grade.py` | Étalonnage commun des photos et des vues 3D. |
| `tools/scenes.py` | Convertit les plans de parallaxe des vues 3D en fichiers web (`public/assets/scenes/<ID>/`). |
| `tools/retouch/*.py` | Retouches documentées et rejouables (objets retirés, recadrages, image « éteinte » de la finale). |
| `tools/favicon.py` | Favicon et icône Apple (le pignon du logo). |
| `brand/logo/` | Logo redessiné en vectoriel : couleur, blanc, violet, emblème seul, PNG 4×. |
| `api/lead.js` | Fonction Vercel du formulaire « Recevoir les plans et les prix ». |
| `public/` | Le site publié. |

## Construire

```bash
node tools/build.mjs                       # public/index.html
python tools/images.py [nom …]             # exporte les photos (Pillow avec AVIF)
python tools/scenes.py <calques> [ID …]    # plans de parallaxe → public/assets/scenes
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
- Chaque vue 3D porte la mention « Vue 3D · illustration non contractuelle ».
- Les photos de la visite sont des chalets réalisés. Elles ne sont jamais présentées comme à vendre, et la page le dit explicitement.

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
