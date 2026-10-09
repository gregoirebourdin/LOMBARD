"""Débruitage léger puis agrandissement x2 (Real-ESRGAN x2, poids ai-forever) par tuiles, sur CPU.
Usage : python upscale.py <entrée> <sortie.png> [--min-width 2400]
Si l'image fait déjà plus que --min-width, elle est seulement débruitée (pas d'agrandissement)."""
import sys, argparse, numpy as np, torch, cv2
from PIL import Image
from spandrel import ModelLoader

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--weights', required=True)
ap.add_argument('--min-width', type=int, default=2400)
ap.add_argument('--tile', type=int, default=384)
a = ap.parse_args()

im = np.asarray(Image.open(a.src).convert('RGB'))
# débruitage doux (préserve le détail : h faible)
den = cv2.fastNlMeansDenoisingColored(cv2.cvtColor(im, cv2.COLOR_RGB2BGR), None, 2, 2, 5, 15)
den = cv2.cvtColor(den, cv2.COLOR_BGR2RGB)
if im.shape[1] >= a.min_width:
    Image.fromarray(den).save(a.dst); print('denoise only', im.shape); sys.exit()

torch.set_num_threads(4)
model = ModelLoader().load_from_file(a.weights).eval()
scale = model.scale
x = torch.from_numpy(den).permute(2, 0, 1).float().div(255).unsqueeze(0)
_, _, H, W = x.shape
out = torch.zeros(1, 3, H * scale, W * scale)
t, pad = a.tile, 16
with torch.inference_mode():
    for y0 in range(0, H, t):
        for x0 in range(0, W, t):
            ya, yb = max(y0 - pad, 0), min(y0 + t + pad, H)
            xa, xb = max(x0 - pad, 0), min(x0 + t + pad, W)
            o = model(x[:, :, ya:yb, xa:xb])
            oy, ox = (y0 - ya) * scale, (x0 - xa) * scale
            hh, ww = (min(y0 + t, H) - y0) * scale, (min(x0 + t, W) - x0) * scale
            out[:, :, y0 * scale:y0 * scale + hh, x0 * scale:x0 * scale + ww] = o[:, :, oy:oy + hh, ox:ox + ww]
        print(f'{a.src}: {min(y0 + t, H)}/{H}', flush=True)
res = (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255 + 0.5).astype(np.uint8)
Image.fromarray(res).save(a.dst)
print('done', res.shape)
