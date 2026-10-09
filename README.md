# Chalets Lombard Vasina — « La vallée en profondeur »

Site de Chalets Lombard Vasina, constructeur et vendeur de chalets neufs dans le Grand Briançonnais depuis 1979. Il est en français, avec une version anglaise complète, et généré en HTML statique.

## Les livrables, dans l'ordre du brief

1. [Note de direction artistique](docs/01-direction-artistique.md)
2. [Storyboard des scènes de parallaxe](docs/02-storyboard-parallaxe.md)
3. [Inventaire des photos](docs/03-inventaire-photos.md), avec le [tableau complet (CSV, 422 images)](docs/inventaire-photos.csv) et la liste des demandes à l'entreprise
4. Le site codé : dossier [`site/`](site/), prêt à déployer
5. [Relecture critique](docs/04-relecture-critique.md)

Quelques [captures](docs/captures/) du site généré (ordinateur 1 440 × 900, mobile 390 × 844).

## Voir le site en local

```bash
npm install          # terser et lightningcss (minification)
npm run build        # génère site/ à partir de src/
npm run serve        # http://localhost:4173
```

## Organisation

```
src/
  build/          générateur (Node, sans framework) : données, composants, pages FR/EN
    data.mjs      les faits : entreprise, chalets, chronologie, visites, vallées, redirections
  css/site.css    jetons (6 couleurs, échelle d'espacement, une courbe), grille 12 colonnes
  js/main.js      moteur de mouvement : Lenis + GSAP ScrollTrigger, scènes, rideaux, panorama
  js/vendor/      gsap 3.15.0, ScrollTrigger, lenis 1.3.26 (auto-hébergés)
  fonts/          Host Grotesk (variable) et Newsreader italique, sous-ensemble latin
tools/
  scenes/         fabrication des scènes : agrandissement, étalonnage, profondeur, découpe, remplissage, export
  images/         export des images fixes (même étalonnage)
  map/            carte des vallées à partir d'OpenStreetMap
  inventory/      inventaire des photos du site actuel
site/             le site généré (HTML, CSS, JS, images AVIF/WebP)
docs/             livrables écrits
```

## Vérifier

```bash
npm run check          # texte de l'accueil, liens, hreflang, JSON-LD, interdits
node tools/qa.mjs qa   # captures, temps d'affichage en 4G, poids, fluidité, grille au pixel
```

Pour mesurer la fluidité sur un vrai portable, ajouter `?fps` à l'adresse : un compteur affiche la médiane et le 95ᵉ centile des temps d'image.

## Fabriquer les scènes

Les outils de `tools/scenes` reproduisent le processus du brief (section 5.5). Ils tournent sur processeur, sans GPU. Il faut Python 3.11 ou plus récent et les paquets de `tools/scenes/requirements.txt` (torch en version CPU). Les poids des modèles se téléchargent depuis Hugging Face : Depth Anything V2 Large, SAM 2.1 hiera base+, Real-ESRGAN x2 (ai-forever) et LaMa ONNX (Carve).

| Étape | Outil | Modèle |
|---|---|---|
| Débruitage, agrandissement ×2 | `upscale.py` | Real-ESRGAN x2 |
| Étalonnage commun | `grade.py` | — |
| Carte de profondeur | `analyze.py` | Depth Anything V2 Large |
| Masques | `planes.py` | SAM 2.1 (hiera base+) et seuils de profondeur |
| Bords | `planes.py` | filtre guidé, décontamination (pymatting) |
| Remplissage derrière les plans | `planes.py` | LaMa (ONNX), poussée-tirée pour le ciel |
| Contrôle image par image | `simulate.py` | — |
| Export | `export.py` | AVIF et WebP, 1 280 / 1 920 / 2 560 px, mobile en 2 ou 3 plans |

Une scène se fabrique de bout en bout avec `tools/scenes/run.sh <dossier_travail> <scène> <image_source>`. Chaque scène est décrite dans `tools/scenes/scenes.json` : seuils de découpe, vitesses et amplitudes. Le site lit ensuite `site/assets/scenes/manifest.json`.

## Déploiement

- Le site est statique : tout hébergeur convient.
- Les redirections 301 sont fournies pour Apache (`site/.htaccess`), Netlify (`site/_redirects`) et Vercel (`vercel.json`).
- Le formulaire de contact est prêt pour Netlify Forms. Sur un autre hébergeur, il faut renseigner l'adresse d'envoi dans l'attribut `action`.
- Avant la mise en ligne, renseigner l'hébergeur et le directeur de la publication (mentions légales), puis valider les points listés dans l'inventaire.

## Licences

- Host Grotesk et Newsreader : SIL Open Font License 1.1.
- GSAP : licence standard sans frais de GreenSock.
- Lenis : MIT.
- Tracé des rivières : © contributeurs OpenStreetMap, ODbL.
- Photographies : Lombard & Vasina et Alpesphotographies.com.
