# 5. Relecture critique

Ce que j'ai vérifié, comment, et ce que j'ai corrigé avant d'ajouter quoi que ce soit. Les contrôles automatiques sont rejouables : `npm run check` vérifie le texte, les liens, les balises et les interdits ; `node tools/qa.mjs` mesure les captures, les temps, le poids, la fluidité et la grille.

## 1. « Ce que je ne veux plus voir »

| Interdit | État | Vérification |
|---|---|---|
| Petits textes posés à gauche et à droite pour remplir | Absent | À droite du nom d'un chalet, seuls le hameau et le village. Une légende fait une seule ligne de cote. |
| Étiquettes en capitales | Absent | Aucun `text-transform: uppercase`. Le sélecteur de langue est écrit « English » ou « Français ». |
| Numérotations « 01 — » | Absent | Les trois étapes (dessiner, tailler, lever) sont une liste sans numéros. |
| Badges et pastilles | Absent | Seul l'indicateur « Disponible » (point or) ou « Vendu » (cercle vide) est utilisé. Les points de la carte sont des symboles de carte. |
| Compteurs qui défilent | Absent | « 800 et plus », 40, 1 300 m² et 2000 sont des chiffres fixes. |
| Bandeau de mots en boucle | Absent | — |
| Grilles d'icônes, cartes à ombre portée, carrousel à étoiles, bandeau de logos | Absent | Aucune ombre portée dans la feuille de style. La presse est une liste de titres, sans logos. |
| Bouton d'action dans chaque section | Absent | Deux invitations sur l'accueil (« Recevoir les plans », « Parlons de votre chalet »), comptées automatiquement. Les autres renvois sont des liens texte. |
| Dégradés en taches, verre dépoli, néon, émojis | Absent | Aucun `backdrop-filter`, `blur` ni émoji. Le seul dégradé est le bord de la lumière rasante. |
| Flocons, particules, 3D, WebGL, curseur personnalisé | Absent | Aucun `canvas`, aucune scène 3D. Le curseur reste celui du système. |
| Écran de chargement de plus d'une seconde | Absent | Aucun écran de chargement. Le titre est lisible dès le premier rendu ; l'apparition ligne par ligne dure 1 s. |
| « Défiler », « En savoir plus », « Découvrir » | Absent | `tools/check.mjs` signale toute occurrence. |
| Superlatifs creux | Absent | « d'exception », « unique » et « extraordinaire » sont recherchés automatiquement. Deux occurrences de « unique » ont été réécrites (visites à 360°). |

## 2. Grille et alignements, au pixel

Le contrôle automatique (`tools/qa.mjs`, fonction `gridCheck`) mesure le bord gauche de chaque titre, paragraphe, liste, figure, cadre d'image et formulaire. Il vérifie que ce bord tombe à moins de 0,5 px d'un début de colonne : 12 colonnes sur ordinateur, 6 sur mobile.

| Page | Blocs mesurés | Écarts sur ordinateur (1 440 px) | Écarts sur mobile (390 px) |
|---|---|---|---|
| Accueil | 34 | 0 | 0 |
| Chalets à vendre | 21 | 0 | 0 |
| La Rouya (fiche) | 19 | 0 | 0 |
| Construire | 36 | 0 | 0 |
| Rénovation et extension | 28 | 0 | 0 |
| Réalisations | 57 | 0 | 0 |
| La maison | 16 | 0 | 0 |
| Contact | 8 | 0 | 0 |

L'espacement vertical utilise une seule échelle (8, 16, 24, 40, 64, 104, 168 px), déclarée en jetons. La feuille de style ne contient aucune autre valeur d'espacement, à l'exception des filets d'un pixel et des marges internes des liens.

Correction faite : la carte des vallées était décalée de 2 px (largeur maximale centrée). Elle occupe maintenant exactement les colonnes 4 à 12.

## 3. Les mots de l'accueil

| | Texte | Noms de lieux sur la carte | Total |
|---|---|---|---|
| Accueil en français | **337 mots** | 47 | 384 |
| Accueil en anglais | **333 mots** | 47 | 380 |

Le décompte inclut les données des fiches (étiquettes et valeurs : « Surface 229 et 221 m² »…), les légendes et la citation. Les noms de lieux de la carte sont comptés à part : ce sont des toponymes posés sur un dessin, pas du texte à lire. Si on les compte, l'accueil dépasse la fourchette de 34 mots. Ils peuvent être réduits aux seuls villages des chalets à vendre si l'on veut tenir les 350 mots au sens strict.

Chaque titre fait 8 mots au plus et chaque phrase 25 mots au plus ; le script vérifie les deux. Une première version faisait 416 mots. Ont été retirés : la phrase d'atmosphère des fiches (gardée sur la page de chaque chalet), le lien redondant « Notre façon de construire », la ligne « permis » de La Rouya (gardée sur sa fiche) et une légende de carte.

## 4. Poids

**Code** (compressé gzip) : JavaScript **54,9 Ko** au total (GSAP 28,3, ScrollTrigger 18,0, Lenis 5,4, moteur du site 3,2), pour un plafond de 150 Ko. CSS 5,6 Ko. HTML de l'accueil 15,9 Ko. Polices : 2 fichiers, 58 Ko, en `font-display: swap`, avec des polices de repli ajustées aux métriques (aucun décalage au chargement).

**Scènes** (AVIF ; un fichier WebP de repli existe pour les navigateurs sans AVIF). Budget : 450 Ko sur ordinateur, 250 Ko sur mobile.

| Scène | Plans (ordinateur / mobile) | Ordinateur 1 920 px | Ordinateur 2 560 px (Retina) | Mobile 1 080 px |
|---|---|---|---|---|
| Ouverture | 5 / 3 | 409 Ko | 370 Ko | 160 Ko |
| Le Serre d'Orchis | 4 / 3 | 323 Ko | 306 Ko | 206 Ko |
| Le Sabot de Vénus | 3 / 2 | 306 Ko | — | 167 Ko |
| La Rouya | 4 / 3 | 332 Ko | — | 179 Ko |
| Rocher Blanc | 4 / 3 | 353 Ko | 349 Ko | 165 Ko |
| L'Étoile des Glaciers | 4 / 3 | 414 Ko | 381 Ko | 246 Ko |
| Panorama | 4 / 3 | 140 Ko (2 560 px affichés) | 254 Ko (3 840 px) | 121 Ko |
| Puy-Saint-Vincent, octobre | 4 / 3 | 370 Ko | 361 Ko | 191 Ko |
| Montgenèvre | 4 / 3 | 287 Ko | 302 Ko | 171 Ko |
| Rideau : branche | 1 / 1 | 37 Ko | 34 Ko | 19 Ko |
| Rideau : poteau | 1 / 1 | 67 Ko | — | 46 Ko |

Toutes les scènes tiennent le budget. Trois corrections ont été nécessaires pour y arriver :
- la qualité AVIF est un peu plus basse pour les fichiers de 2 560 px (pixels deux fois plus petits) ;
- la largeur mobile maximale est de 1 080 px, suffisante pour un écran de 390 px en ×3 ;
- chaque plan est rogné à sa zone utile, ce qui réduit aussi la mémoire graphique.

Sans ces corrections, l'ouverture pesait 624 Ko en Retina, la scène de Puy-Saint-Vincent 509 Ko et la mobile 337 Ko.

Les images Sabot de Vénus et La Rouya n'ont pas de version 2 560 px : leurs sources font 1 200 px (×2 = 2 400 px).

## 5. Temps d'affichage et stabilité

Mesuré avec Chromium (Playwright), réseau limité par le protocole DevTools, cache vide, latence de 150 ms.

| Cas | Plus grand élément affiché (LCP) | Élément | Décalage (CLS) |
|---|---|---|---|
| Accueil, ordinateur, 4G (9 Mb/s) | **0,64 s** | premier plan de l'ouverture | 0 |
| Accueil, mobile, 4G (9 Mb/s), processeur ×4 plus lent | **0,81 s** | premier plan mobile | 0 |
| Accueil, mobile, 4G lente (1,6 Mb/s), processeur ×4 plus lent | **1,78 s** | premier plan mobile | 0 |
| Fiche La Rouya, mobile, 4G | **0,72 s** | scène de La Rouya | 0 |

L'objectif de 2,5 s est tenu, même en 4G lente. L'ouverture est préchargée (balises `preload` séparées pour l'ordinateur et le mobile). Les autres scènes sont en chargement différé natif : le navigateur les télécharge juste avant qu'elles n'entrent à l'écran.

## 6. Fluidité

Le conteneur de travail n'a **pas de carte graphique** : Chromium y composite les calques en logiciel. Les chiffres ci-dessous sont donc un plancher, pas la mesure demandée sur un portable récent.

| Passage (défilement à la molette, 1 440 × 900) | Médiane | 95ᵉ centile | Images au-delà de 33 ms |
|---|---|---|---|
| Ouverture, la fenêtre s'ouvre | 16,7 ms (60 i/s) | 33,4 ms | 11 / 264 |
| Ouverture, travelling à cinq plans | 33,3 ms (30 i/s) | 50 ms | 122 / 398 |
| Vitrine des chalets | 16,7 ms (60 i/s) | 33,3 ms | 4 / 322 |
| Panorama | 16,7 ms (60 i/s) | 33,3 ms | 5 / 305 |
| Construire, réalisations | 16,7 ms (60 i/s) | 33,4 ms | 24 / 398 |

Le test a été poussé jusqu'à masquer un à un les calques de l'ouverture : 1 plan donne 16,7 ms au 95ᵉ centile, 3 plans 16,7 ms de médiane, 5 plans 33 ms. Le coût est uniquement celui du compositing logiciel, proportionnel au nombre de calques plein écran ; aucun recalcul de mise en page ni de peinture n'a lieu pendant le défilement. Sur un portable doté d'un processeur graphique, composer cinq calques déplacés par `translate3d` et `scale` est une charge ordinaire. Je ne peux pas le prouver d'ici, et je ne réduis pas la signature pour un environnement non représentatif.

Ce qui a été fait pour la fluidité :
- transformations GPU uniquement ;
- `will-change` posé seulement sur les scènes à l'écran (IntersectionObserver) ;
- `contain: layout paint` sur chaque scène ;
- plans rognés à leur zone utile : au fil des mesures successives, la vitrine est passée de 64 à 4 images lentes et le panorama de 29 à 5 ;
- une seule boucle d'animation (le ticker de GSAP pilote Lenis).

**Pour vérifier sur vos portables** : ouvrir le site avec `?fps` à la fin de l'adresse (par exemple `/?fps`). Un compteur discret affiche la médiane et le 95ᵉ centile des temps d'image. Les deux doivent rester sous 16,7 ms pendant le travelling de l'ouverture.

## 7. Sans mouvement (`prefers-reduced-motion`)

Testé avec l'émulation `prefers-reduced-motion: reduce` :
- **aucun plan n'est téléchargé** : 0 requête vers les fichiers de plans (les sources `media` servent une image vide) ;
- chaque scène est remplacée par son image aplatie, qui porte le texte alternatif ;
- l'ouverture n'est plus épinglée : le titre, puis l'image ;
- les titres et les fondus sont affichés d'emblée ;
- les rideaux sont masqués et le défilement adouci est désactivé.

Sans JavaScript, ou si les scripts n'arrivent pas en 2,5 s, la page bascule dans ce même mode statique, entièrement lisible.

## 8. Mobile à 390 px

Testé à 390 × 844 (émulation tactile, densité ×2 et ×3) :
- **largeur** : aucun débordement horizontal sur les pages testées. Un vrai défaut a été trouvé : le rideau du poteau, placé hors cadre à droite, élargissait la page à 546 px. Le navigateur dézoomait alors tout le site. Corrigé par `overflow-x: clip` sur le rideau.
- **profondeur** : 2 à 3 plans par scène, amplitudes divisées par deux, aucun effet de souris. Sur le panorama, les écarts de vitesse entre plans sont aussi divisés par deux.
- **ouverture** : la fenêtre s'ouvre sous le texte, puis gagne le plein écran. Un défaut de première version la faisait chevaucher le texte ; il est corrigé.
- **cibles tactiles** : invitations à l'action de 56 px de haut. Sur écran tactile, les liens texte, le fil d'Ariane et le pied de page ont au moins 44 px de zone utile.

## 9. Les trois questions

**Est-ce qu'on a envie d'acheter un chalet ici en trente secondes ?**
**Oui, mais pas autant qu'on le pourrait, et la raison est connue.**

Oui, parce qu'en trente secondes, le visiteur a vu :
- le titre « Acheter ou construire votre chalet dans le Briançonnais » ;
- un chalet réel dans la neige ;
- trois chalets disponibles avec leurs noms, leurs villages, leurs surfaces, leurs terrains et leur état, et une invitation « Recevoir les plans ».

La vente est lisible dès l'accueil.

La limite : les chalets à vendre sont montrés par **la vue depuis leur terrain**, pas par le chalet lui-même. Les visuels 3D actuels du Sabot de Vénus, du Serre d'Orchis et de La Rouya ressemblent à des images générées, et cinq d'entre eux portent la mention « Image générée par IA ». Je ne les publie pas tant que l'entreprise n'a pas confirmé leur provenance.

**Correction possible, mais pas de mon côté** : les rendus CadWork en calques, demandés dans l'inventaire. Dès qu'ils arrivent, chaque fiche gagne une scène du chalet en profondeur, sans retouche du code.

**Est-ce qu'on a l'impression d'être entré dans la vallée ?**
**Oui.** On entre d'abord par une fenêtre dans les marges de la grille. Elle s'ouvre, puis la caméra avance : la congère passe sous le cadre, le chalet approche, les sommets des Écrins se resserrent à peine. Des branches enneigées passent devant l'objectif, la vallée de Serre Chevalier défile comme depuis un télésiège, et la carte trace d'un seul trait la Clarée, la Guisane, la Durance, la Gyronde et le Guil.

Pour en arriver là, il a fallu corriger plusieurs défauts que seul le contrôle image par image a révélés :
- un voile gris derrière le toit ;
- un sommet fantôme et un ciel brumeux mal détouré dans le panorama ;
- des branches fantômes au Sabot de Vénus ;
- des remplissages flous dans les sols de neige.

Le dernier point n'a pas de solution parfaite avec des photos à plat ; il a été résolu par des transitions plus larges et des amplitudes plus mesurées dans les fiches.

**Est-ce que le site tiendrait à côté des meilleurs studios d'architecture ?**
**Sur la typographie, la grille, la palette et la retenue : oui.** Deux familles, six couleurs, une échelle d'espacement, une courbe. Aucun ornement, des données présentées comme sur un plan, et des alignements exacts au pixel.

**Sur la matière photographique : pas encore.** Les fichiers disponibles sont des JPEG web de 1 200 à 1 920 px pour la plupart, agrandis ×2. Les photos de terrain du Sabot de Vénus et de La Rouya sont prises au téléphone. Un studio du niveau de Norm Architects travaillerait sur des RAW pris au diaphragme fermé, le matin, et pensés en profondeur. La liste précise est dans l'inventaire. C'est l'investissement qui fera passer le site de « très soigné » à « au niveau des meilleurs ».

## 10. Corrections faites pendant la relecture

Dans l'ordre où ils ont été trouvés :

1. **Accueil trop long** : 416 mots ramenés à 337.
2. **Rideaux opaques** : l'export perdait la transparence du plan unique d'un rideau (fond noir). Corrigé.
3. **Cadres de scène invisibles** : un lien `<a>` en ligne ignorait le ratio 21:9. Passé en bloc.
4. **Page élargie sur mobile** à cause du rideau du poteau (546 px au lieu de 390). Corrigé.
5. **Fenêtre d'ouverture sur le texte**, sur mobile. Géométrie recalculée sur le format réel de l'image.
6. **Titre d'ouverture sous la navigation** pendant sa sortie. Il s'efface plus tôt.
7. **Légendes illisibles** : blanc sur neige pour l'ouverture, texte posé sur la photo pour le panorama.
8. **Voile gris derrière le toit** de l'ouverture : chalet détouré avec SAM 2, toit voisin exclu.
9. **Silhouette fantôme et ciel brumeux** dans le panorama : seuil du ciel abaissé, polygone qui suit la crête.
10. **Branches fantômes et traînée orange** au Sabot de Vénus : seuil de remplissage propre à la scène.
11. **Remplissages flous dans la neige** (La Rouya, Serre d'Orchis) : transitions élargies, amplitudes revues (le remplissage par miroir, essayé, se voyait comme un reflet).
12. **Budgets dépassés** (ouverture Retina, Puy-Saint-Vincent, Rocher Blanc, mobile) : qualité par largeur, largeur mobile 1 080 px, plans rognés.
13. **Ferme de charpente** : contrefiches qui ne rejoignaient pas les arbalétriers. Géométrie recalculée.
14. **Carte décalée de 2 px** de la grille. Placée sur les colonnes 4 à 12.
15. **Image d'ouverture au-dessus du titre** en mode sans mouvement. Ordre rétabli.
16. **Bande voilée au repos** sur les pentes (Serre d'Orchis, La Rouya) : la décontamination des couleurs, faite pour les bords nets, floutait les transitions larges, et le remplissage transparaissait sous les zones presque opaques. Les deux sont corrigés : au repos, l'écart moyen avec la photo passe de 1,15 à 0,19 sur 255.
17. **Formulations** : « unique » (×2), code de langue en capitales, tournures anglaises (« 4 and 4 bedrooms », « 1 300 m² »).

## 11. Avant la mise en ligne

- Faire valider par l'entreprise les points listés dans l'[inventaire](03-inventaire-photos.md#à-demander-à-lentreprise) : état et prix des chalets, chalet C du Serre d'Orchis, provenance des vues 3D, portraits, visites Klapty, mentions légales.
- Remplacer les scènes par les rendus 3D en calques dès qu'ils arrivent. Le pipeline (`tools/scenes`) les accepte directement : il suffit de déclarer un calque par plan, sans passer par la carte de profondeur.
- Brancher le formulaire sur l'outil de l'entreprise (Netlify Forms par défaut).
- Déclarer les redirections 301 chez l'hébergeur retenu (fichiers fournis).
