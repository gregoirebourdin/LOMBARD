"""Étape 1 : étalonnage + carte de profondeur (Depth Anything V2 Large).

Usage : python analyze.py <work_dir> <scene> [--crop x0,y0,x1,y1] [--grade k=v,...]
Entrée : <work_dir>/<scene>/up.png (sortie de upscale.py)
Sorties : graded.png, depth.npy (disparité normalisée 0 = loin, 1 = près), depth.jpg (aperçu)
"""
import argparse, os, sys, numpy as np, torch
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from grade import grade

ap = argparse.ArgumentParser()
ap.add_argument('work'); ap.add_argument('scene')
ap.add_argument('--crop', default='')
ap.add_argument('--grade', default='')
ap.add_argument('--depth-model', default=os.environ.get('DEPTH_MODEL', 'depth-anything/Depth-Anything-V2-Large-hf'))
ap.add_argument('--long', type=int, default=1036, help='côté long pour l\'inférence (multiple de 14)')
a = ap.parse_args()

d = os.path.join(a.work, a.scene)
im = np.asarray(Image.open(os.path.join(d, 'up.png')).convert('RGB'))
if a.crop:
    x0, y0, x1, y1 = [int(v) for v in a.crop.split(',')]
    im = im[y0:y1, x0:x1]
kw = {k: float(v) for k, v in (p.split('=') for p in a.grade.split(',') if p)}
g = grade(im, **kw)
Image.fromarray(g).save(os.path.join(d, 'graded.png'))

from transformers import AutoImageProcessor, AutoModelForDepthEstimation
torch.set_num_threads(4)
proc = AutoImageProcessor.from_pretrained(a.depth_model, cache_dir=os.environ.get('HF_CACHE'))
model = AutoModelForDepthEstimation.from_pretrained(a.depth_model, cache_dir=os.environ.get('HF_CACHE')).eval()
H, W = g.shape[:2]
s = a.long / max(H, W)
h14, w14 = int(round(H * s / 14)) * 14, int(round(W * s / 14)) * 14
small = Image.fromarray(g).resize((w14, h14), Image.BICUBIC)
inp = proc(images=small, return_tensors='pt', do_resize=False)
with torch.inference_mode():
    pred = model(**inp).predicted_depth  # disparité relative
pred = torch.nn.functional.interpolate(pred[:, None], size=(H, W), mode='bicubic', align_corners=False)[0, 0].numpy()
lo, hi = np.percentile(pred, 0.5), np.percentile(pred, 99.5)
disp = np.clip((pred - lo) / (hi - lo), 0, 1).astype(np.float32)
np.save(os.path.join(d, 'depth.npy'), disp.astype(np.float16))

# Neige à l'ombre : on retire la dominante bleue (blancs propres, ombres à peine froides).
# Guidé par la profondeur pour ne jamais toucher au bleu du ciel (disparité ~0).
import json
cfg = json.load(open(os.path.join(os.path.dirname(__file__), 'scenes.json')))['scenes'].get(a.scene, {})
ss = cfg.get('snow_shadow')
if ss:
    x = g.astype(np.float32) / 255
    L = x.mean(-1)
    bluish = np.clip((x[..., 2] - np.maximum(x[..., 0], x[..., 1]) - 0.02) / 0.10, 0, 1)
    bright = np.clip((L - 0.30) / 0.15, 0, 1)
    near = np.clip((disp - ss['min_disp']) / 0.04, 0, 1)
    k = (bluish * bright * near * ss.get('strength', 0.5))[..., None]
    m = x.mean(-1, keepdims=True)
    x = x + (m - x) * k
    x = x + 0.035 * k  # léger éclaircissement
    g = (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(g).save(os.path.join(d, 'graded.png'))
    print('snow shadow corrected')
Image.fromarray((disp * 255).astype(np.uint8)).resize((W // 4, H // 4)).save(os.path.join(d, 'depth.jpg'))
print('ok', a.scene, g.shape)
