# 2. Storyboard des scènes de parallaxe

Neuf scènes et deux rideaux. Les amplitudes sont données pour un cadre de 1 920 px de large ; elles sont divisées par deux sur mobile, où chaque scène passe à 2 ou 3 plans, sans effet de souris. Les vitesses relatives suivent le brief : 0,05 / 0,12 / 0,25 / 0,45 / 0,8. Il n'y a qu'une seule courbe, `cubic-bezier(0.16, 1, 0.3, 1)`. Les scènes liées au défilement ont un *scrub* de 0,8 (0,6 pour les rideaux et le trait). La configuration exacte est dans [`tools/scenes/scenes.json`](../tools/scenes/scenes.json).

**Pourquoi des amplitudes de 90 à 160 px hors de l'ouverture.** Le brief permet jusqu'à 400 px au premier plan. Dans une photo réelle, tout déplacement relatif découvre une zone que l'appareil n'a jamais vue ; elle doit être comblée. Sur un sol continu (neige, herbe), le contrôle image par image a montré qu'au-delà de la largeur de la transition, la zone comblée se voit, en flou ou en reflet. Les amplitudes sont donc réglées pour rester sous la moitié de cette transition tant que la scène est visible au moins au tiers. L'ouverture garde 320 px et l'échelle 1,15, parce que le sol découvert y est de la neige lisse, qui se comble sans trace. Avec les rendus 3D en calques demandés à l'entreprise, rien n'est à combler, et les fiches pourront monter à 300 ou 400 px.

**Trois types de mouvement** (modèle commun aux outils et au site, voir `tools/scenes/motion.py` et `src/js/main.js`) :
- **travelling** (scène épinglée) : chaque plan grandit autour du point de fuite, le premier plan sort par le bas ;
- **flux** (scène qui passe) : les plans proches défilent plus vite que la page, les plans lointains plus lentement ;
- **panorama** (scène épinglée) : défilement horizontal, chaque plan à sa vitesse, comme vu depuis un télésiège.

---

## 1. L'ouverture : entrer dans la vallée

**Source** : chalet de Puy-Saint-Vincent en hiver (`2025/12/Exterieur-chalet-Puy-Saint-Vincent-…-6.jpg`), 1 920 px. Débruitage, puis agrandissement ×2 par Real-ESRGAN (3 840 × 2 562), contrôlé à 100 %. La neige à l'ombre est désaturée en s'appuyant sur la carte de profondeur, sans toucher au bleu du ciel.

| Plan | Découpe | Échelle | Déplacement |
|---|---|---|---|
| Ciel | couleur + profondeur, comblé par poussée-tirée | 1 → 1,02 | 0 → −12 px |
| Sommets (massif des Écrins) | non-ciel, profondeur < 0,035 | **1,08 → 1** | 0 → −24 px |
| Versant et village | SAM 2 sur le versant gauche, puis profondeur 0,035 à 0,2 | 1 → 1,025 | — |
| Le chalet | SAM 2 (boîte + points) et sol devant lui | 1 → 1,06 | — |
| Premier plan (congère) | profondeur > 0,6, transition large sur la neige | **1 → 1,15** | **0 → +320 px** |

Point de fuite : 50 % / 36 % (l'horizon). Souris : ±12 px au premier plan, au prorata des vitesses pour les autres plans.

- **Entrée.** La page s'ouvre sur un fond blanc de neige. Le titre apparaît ligne par ligne en moins d'une seconde. En dessous, une fenêtre panoramique s'ouvre sur la vallée, dans les marges de la grille.
- **Pendant.** Sur 290 vh, la fenêtre s'élargit jusqu'au plein écran pendant le premier tiers, et le titre s'efface vers le haut. Ensuite, la caméra avance : la congère grandit et sort par le bas, le chalet avance, les sommets se resserrent à peine.
- **Sortie.** La scène se libère. Le rideau de branches enneigées traverse l'écran et ouvre « Chalets neufs, vendus sur plan ».

## 2. Le Serre d'Orchis

**Source** : vue de drone au-dessus du Serre Barbin (`2025/08/DJI_0010.jpg`), 3 189 px. Agrandissement ×2, soit 6 378 px.

| Plan | Vitesse | Découpe |
|---|---|---|
| Ciel | 0,05 | couleur + profondeur |
| Sommets enneigés | 0,12 | profondeur < 0,08 |
| Montagnes | 0,25 | profondeur 0,08 à 0,24 |
| Fond de vallée, hameaux, route | 0,45 | profondeur > 0,24, transition large (sol continu) |

Mouvement en flux, amplitude 90 px (vue aérienne : peu de parallaxe, comme en vrai) : les plans lointains glissent plus lentement que la page, le fond de vallée plus vite.
- **Entrée** : le nom en italique, puis le cadre 21:9 qui monte.
- **Sortie** : la ligne de cote (« Vue de drone sur la vallée… »), puis la fiche : surfaces, terrains, chambres, état.

## 3. Le Sabot de Vénus

**Source** : photo du secteur, La Salle-les-Alpes, février 2025 (`2025/08/20250228_114115.jpg`), 1 200 px. Agrandissement ×2, soit 2 400 px.

| Plan | Vitesse | Découpe |
|---|---|---|
| Ciel | 0,05 | couleur + profondeur |
| Chalets du secteur et forêt | 0,25 | profondeur |
| Pin au premier plan | 0,8 | profondeur, reliée aux bords ; les aiguilles se détachent sur le ciel par leur couleur |

Mouvement en flux, amplitude 100 px. Il n'y a pas de vue 3D publiée tant que leur provenance n'est pas confirmée (voir l'inventaire).

## 4. La Rouya

**Source** : vue réelle depuis le terrain (`2024/11/La-Rouya-Vue-Sud-Ouest-1.jpg`), 1 200 px. Agrandissement ×2, soit 2 400 px.

| Plan | Vitesse | Découpe |
|---|---|---|
| Ciel | 0,05 | couleur + profondeur |
| Massif enneigé | 0,12 | profondeur |
| Chalets du hameau, mélèzes | 0,25 | profondeur |
| Première neige au premier plan | 0,8 | profondeur, transition très large (sol continu) |

Mouvement en flux, amplitude 140 px.

## 5. Chalet du Rocher Blanc (vendu, sur sa fiche)

**Source** : terrain face aux pistes (`2025/12/Terrain-…-Rocher-Blanc-…-1.jpg`), 4 032 px. Débruitage seulement.

Plans : ciel et nuages (0,05) / versant des pistes et Prorel (0,15) / arbres (0,45) / herbes au premier plan (0,8). Mouvement en flux, amplitude 150 px. La vue 3D de la façade sud est montrée à part, avec la mention « Vue 3D, image non contractuelle ».

## 6. L'Étoile des Glaciers (vendu, sur sa fiche)

**Source** : vue sud depuis le terrain en octobre (`2024/09/ETOILE-DES-GLACIERS-Vue-Sud.jpg`), 1 500 px. Agrandissement ×2, soit 3 000 px.

Plans : ciel (0,05) / montagnes (0,15) / sapins et peupliers (0,45) / feuillages dorés au premier plan (0,8). Mouvement en flux, amplitude 150 px.

## 7. Le panorama : la vallée vue d'un télésiège

**Source** : vue de drone de la vallée de Serre Chevalier (`2025/08/DJI_0009.jpg`), 3 417 px. Agrandissement ×2, soit 6 834 px, puis une bande de 6 834 × 1 817 (3,76:1). Le bas de l'image (zone industrielle) est exclu.

| Plan | Déplacement relatif | Découpe |
|---|---|---|
| Ciel | 0,35 | couleur + profondeur |
| Sommets lointains (Écrins) | 0,55 | profondeur < 0,05, derrière l'arête |
| Versants, pistes, villages | 0,8 | profondeur |
| Versants proches | 1 | profondeur > 0,52, masses reliées aux bords |

La scène fait 1,6 fois la largeur du cadre. Elle est épinglée sur 260 vh et défile vers la gauche sur 0,6 cadre. Les plans sont alignés à mi-course : aucun bord ne se découvre jamais. Sur mobile, la bande fait 62 % de la hauteur de l'écran et les écarts de vitesse entre plans sont divisés par deux. Les coupes suivent des arêtes réelles, pour que rien ne se déchire au défilement latéral.
- **Entrée** : après « Une vallée, et pas une autre ».
- **Sortie** : la carte des vallées, tracée d'un seul trait (le trait n° 2).

## 8. Réalisation, Puy-Saint-Vincent en octobre

**Source** : `2025/12/Exterieur-chalet-Puy-Saint-Vincent-…-8.jpg`, 1 920 px. Agrandissement ×2, soit 3 840 px. Les mélèzes dorés en font l'or du site.

Plans : ciel (0,05) / sommets et versants (0,12) / le chalet (0,45) / arbustes d'automne au premier plan (0,8). Mouvement en flux, amplitude 160 px. On la retrouve aussi en ouverture de la page « Construire ».

## 9. Réalisation, Montgenèvre face aux pistes

**Source** : `2025/12/Terrasse-bois-ensoleillee-chalet-montgenevre-…-2.jpg`, 2 998 px. Débruitage seulement.

Plans : ciel (0,05) / sommets (0,12) / forêt de mélèzes et télésiège (0,25) / le chalet entier, toit enneigé et balcon, au premier plan (0,8). Mouvement en flux, amplitude 160 px.

---

## Les rideaux de premier plan (deux dans tout le site)

| Rideau | Source | Préparation | Passage |
|---|---|---|---|
| **Branche enneigée** | `Chalets_Lombard_hiver_exterieure_chlaets-100me.jpg` (×2) | branches proches isolées par la profondeur et reliées aux bords, bords affinés, couleurs décontaminées | entre l'ouverture et la vitrine ; monte de 2,3 hauteurs d'écran pendant que la page en fait 1,3 |
| **Poteau taillé** | `Chalets_Lombard_detail_interieur.jpg` (×2) | poteau isolé par SAM 2, recadré au plus juste | entre « Construire » et « La maison » ; traverse l'écran de droite à gauche |

## Les gestes d'accompagnement

- **Le trait qui se dessine** (deux fois) : la ferme de charpente, avec ses cotes, dans « Construire » ; les rivières de la carte dans « Une vallée ».
- **La lumière rasante** : sur les images fixes, un voile couleur neige s'efface de gauche à droite, avec un liseré doré, en 1 400 ms.
- **Les titres ligne par ligne** : en 1 000 ms, 90 ms d'écart entre deux lignes.
- **Le défilement adouci** : Lenis, `lerp` à 0,11. Il s'applique à la molette seulement ; le tactile reste natif.

## Accessibilité

Avec `prefers-reduced-motion`, chaque scène est remplacée par son image aplatie, qui porte le texte alternatif. Les plans ne sont alors même pas téléchargés : une source vide est servie via `media`. Tout s'affiche immédiatement. Sans JavaScript, la page reste lisible et les scènes s'affichent fixes.
