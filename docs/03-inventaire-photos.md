# 3. Inventaire des photos et demandes à l'entreprise

## Méthode

1. Les 27 pages du plan du site actuel (`page-sitemap.xml`) et la version anglaise ont été parcourues : réalisations, ventes sur plan (Serre d'Orchis, Sabot de Vénus, La Rouya, Rocher Blanc, Étoile des Glaciers), visites à 360°, rénovation, histoire, « On parle de nous », pages de vallées.
2. Chaque adresse d'image a été ramenée à son fichier d'origine (suffixes WordPress `-1920x1281`, `-768x512`, `-scaled` retirés). 440 adresses, 436 fichiers téléchargés (4 absents du serveur), **422 images uniques** après dédoublonnage par empreinte perceptuelle.
3. Chaque image a été mesurée (dimensions, netteté, hautes lumières brûlées, exposition), puis classée à partir du nom de fichier, de la page et d'une revue visuelle des planches contact.

Le tableau complet, une ligne par image, est dans [`inventaire-photos.csv`](inventaire-photos.csv). Colonnes : identifiant, fichier d'origine, pages, sujet, lieu, largeur et hauteur en pixels, nature, plans exploitables, qualité, personnes reconnaissables, crédit, usage, doublons.

## Synthèse

| Nature | Nombre |
|---|---|
| Photos réelles | 301 |
| Vues 3D au rendu d'architecte (Rocher Blanc, 2024-2025) | 12 |
| Vues 3D à la provenance à confirmer : leur aspect est celui d'images générées | 63 |
| Images portant la mention « Image générée par IA » | 5 |
| Dessins et éléments graphiques | 15 |
| Pictogrammes | 22 |
| Documents et photos de groupe | 4 |

| Largeur | Nombre |
|---|---|
| 2 400 px et plus | 20 |
| 1 900 à 2 399 px (la série de 1 920 × 1 281) | 74 |
| Moins de 1 200 px | 134 |

Les fichiers les plus grands : trois intérieurs en mélèze de 7 360 px, le terrain du Rocher Blanc (6 000 et 4 032 px), les bureaux (5 332 px), deux chalets de 100 m² (4 896 px), le chalet Urvoy (4 608 px), les deux vues de drone du Serre Barbin (3 417 et 3 189 px), trois photos de Montgenèvre (3 000 px).

Crédit Alpesphotographies.com sur : Chalet Reine, Chalet Tomasi, Refuge 82-4000, la charpente levée et la série « Chalet LOMBARD © Alpesphotographies ».

## Les vues 3D, et pourquoi la plupart restent hors ligne

- **Rocher Blanc** : façades et intérieurs en 3D (`CHALET-DU-ROCHER-BLANC-…-3D`) au rendu d'architecte classique. Utilisée sur la fiche (chalet vendu), toujours avec la mention « Vue 3D, image non contractuelle ».
- **La Rouya** : 5 images de 2026 (`chalet-puy-saint-vincent-1400-…`) portent la mention « Image générée par IA ». Elles sont **écartées** (règle : jamais de chalet généré par IA présenté comme un bien à vendre).
- **Sabot de Vénus, Serre d'Orchis, La Rouya (vues « Vue-3D »), Étoile des Glaciers** : 63 images non signées mais dont la charpente, les garde-corps et les reflets présentent les irrégularités typiques des images générées (contreventements qui ne se rejoignent pas, barreaux inégaux). Une image du Sabot de Vénus porte en outre un petit pictogramme d'outil en angle. **Elles ne sont pas publiées** tant que l'entreprise n'a pas confirmé qu'il s'agit de rendus 3D issus du modèle CadWork. Le site est prêt à les afficher : il suffit de les déclarer dans `views3d` (fichier `src/build/data.mjs`), et la mention « Vue 3D, image non contractuelle » s'ajoute automatiquement.
- En attendant, chaque chalet à vendre est présenté par **sa vue réelle** (drone ou photo depuis le terrain), ses données et l'invitation « Recevoir les plans ».

## Les sources des scènes de parallaxe

| Scène | Fichier d'origine | Largeur d'origine | Préparation |
|---|---|---|---|
| Ouverture | `2025/12/Exterieur-chalet-Puy-Saint-Vincent-…-6.jpg` | 1 920 | débruitage, ×2 → 3 840 px |
| Panorama | `2025/08/DJI_0009.jpg` (drone) | 3 417 | ×2 → 6 834 px, bande 3,76:1 |
| Le Serre d'Orchis | `2025/08/DJI_0010.jpg` (drone) | 3 189 | ×2 → 6 378 px |
| Le Sabot de Vénus | `2025/08/20250228_114115.jpg` | 1 200 | ×2 → 2 400 px |
| La Rouya | `2024/11/La-Rouya-Vue-Sud-Ouest-1.jpg` | 1 200 | ×2 → 2 400 px |
| Rocher Blanc | `2025/12/Terrain-…-Rocher-Blanc-…-1.jpg` | 4 032 | débruitage |
| Étoile des Glaciers | `2024/09/ETOILE-DES-GLACIERS-Vue-Sud.jpg` | 1 500 | ×2 → 3 000 px |
| Réalisation, Puy-Saint-Vincent | `2025/12/Exterieur-chalet-Puy-Saint-Vincent-…-8.jpg` | 1 920 | ×2 → 3 840 px |
| Réalisation, Montgenèvre | `2025/12/Terrasse-bois-ensoleillee-chalet-montgenevre-…-2.jpg` | 2 998 | débruitage |
| Rideau : branche | `2024/09/Chalets_Lombard_hiver_exterieure_chlaets-100me.jpg` | 1 281 | ×2 → 2 562 px |
| Rideau : poteau | `2024/09/Chalets_Lombard_detail_interieur.jpg` | 1 281 | ×2 → 2 562 px |

## Personnes reconnaissables

27 images montrent des salariés, la famille ou des clients (équipe au complet, atelier, chantier, portraits de Maurice, Marielle et Mathieu, photos de groupe de clients). **Aucune n'est publiée.** Elles sont listées dans le CSV (colonne « personnes ») et attendent une validation écrite. Deux photos d'écran du bureau d'études sont utilisées recadrées, sans visage.

## À demander à l'entreprise

### Validations
- [ ] L'état de chaque chalet (disponible ou vendu) et les prix qu'elle accepte de publier.
- [ ] Le Serre d'Orchis : le site actuel annonce aussi un **chalet C de 120 m²** (terrain de 391 m², 3 suites), absent du brief.
- [ ] Les données reprises du site actuel : terrains, nombre de chambres, « permis purgé de tout recours » pour La Rouya (qui annonce à la fois 4 suites et « 3 suites + dortoir »), 270 m² et terrain de 568 m² pour le Rocher Blanc.
- [ ] La provenance des 63 vues « 3D » (rendu CadWork ou image générée).
- [ ] Les portraits de Maurice, Marielle et Mathieu, et les photos d'équipe.
- [ ] La correspondance entre les dix visites Klapty et les noms des chalets.
- [ ] Le directeur de la publication et l'hébergeur (mentions légales).
- [ ] Le crédit « © AG » visible sur la photo des bureaux (recadré sur le site).

### Originaux en haute définition
- [ ] Les RAW ou TIFF de la série professionnelle de 1 920 × 1 281 (réalisations), en particulier les deux chalets de Puy-Saint-Vincent (ouverture, mélèzes en octobre) et la terrasse de Montgenèvre.
- [ ] Les fichiers DJI d'origine (DNG) du Serre Barbin.
- [ ] Les photos de terrain du Sabot de Vénus et de La Rouya en pleine définition (seulement 1 200 px aujourd'hui).
- [ ] Les originaux d'Alpesphotographies.com, avec les conditions de crédit.

### Rendus 3D en calques, pour une parallaxe parfaite
Pour **le Serre d'Orchis (A et B), le Sabot de Vénus (A et B) et La Rouya** : un rendu par vue, avec des calques séparés (ciel, montagnes, terrain, chalet, végétation au premier plan) ou une passe de profondeur (Z-depth), en 4 000 px de large au minimum, depuis le modèle CadWork. C'est le meilleur matériau possible pour la scène de chaque chalet.

### Prises de vue à commander
Pensées en profondeur : un premier plan net (branche, barrière, neige), le chalet au milieu, les sommets derrière, diaphragme fermé (f/11 à f/16) pour que tout soit net, de préférence le matin, soleil rasant.
- [ ] La vallée au lever du jour, depuis le Serre Barbin et depuis Puy-Saint-Vincent.
- [ ] Les mélèzes dorés en octobre (Clarée, Vallouise).
- [ ] Les vues réelles depuis chacun des terrains à vendre, hiver et été, à hauteur d'œil et en drone.
- [ ] L'atelier de 1 300 m² et la K2 en train de tailler (sans visage, ou avec accord écrit).
- [ ] Un levage de charpente, du premier poteau au faîtage.
- [ ] Des chalets dans chaque vallée : Clarée, Vallouise, Queyras.
- [ ] Une branche de mélèze nette, détourable, pour le rideau de premier plan.
