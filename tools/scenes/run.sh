#!/usr/bin/env bash
# Fabrique une scène de bout en bout.
#   tools/scenes/run.sh <dossier_travail> <scène> <image_source> [options d'analyse…]
# Exemple :
#   tools/scenes/run.sh work panorama orig/2025_08_DJI_0009.jpg --crop 0,280,6834,2097 --long 1400
# Variables : PY (python de l'environnement), HF_CACHE (cache Hugging Face),
#             ESRGAN (poids RealESRGAN_x2.pth), SITE (dossier du site, par défaut ./site).
set -euo pipefail
WORK=$1; SCENE=$2; SRC=$3; shift 3
HERE=$(cd "$(dirname "$0")" && pwd)
PY=${PY:-python3}
SITE=${SITE:-$HERE/../../site}
mkdir -p "$WORK/$SCENE"

# 1. Débruitage + agrandissement ×2 si la source est trop petite (3 200 px pour l'ouverture, 2 400 sinon)
MIN=2400; [ "$SCENE" = ouverture ] && MIN=3200
[ -f "$WORK/$SCENE/up.png" ] || "$PY" "$HERE/upscale.py" "$SRC" "$WORK/$SCENE/up.png" --weights "$ESRGAN" --min-width $MIN

# 2. Étalonnage commun + carte de profondeur
"$PY" "$HERE/analyze.py" "$WORK" "$SCENE" "$@"

# 3. Découpe, bords, remplissage (ou détourage d'un rideau)
case "$SCENE" in
  rideau-*) "$PY" "$HERE/curtain.py" "$WORK" "$SCENE" ;;
  *)        "$PY" "$HERE/planes.py" "$WORK" "$SCENE"
            # 4. Contrôle : recomposition à plusieurs instants, trous en magenta
            "$PY" "$HERE/simulate.py" "$WORK" "$SCENE" ;;
esac

# 5. Export AVIF/WebP, 3 largeurs, mobile en 2 ou 3 plans, image aplatie, manifeste
"$PY" "$HERE/export.py" "$WORK" "$SITE" "$SCENE"
