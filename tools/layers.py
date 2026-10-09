#!/usr/bin/env python3
"""
layers.py - split an off-plan chalet render into 3 parallax planes (back / mid / front).

    python layers.py V56 V27                 # scenes defined in layers.json (next to this file)
    python layers.py V56 --config my.json --out ../layers --no-cache

Models are loaded once per run (lazy) and reused across scenes: Depth Anything V2 Large,
SAM 2.1 (hiera base+), BiRefNet, LaMa (ONNX) and Real-ESRGAN x2 (only if a scene asks for it).
Everything runs offline from the HF cache (HF_HOME / HF_HUB_CACHE, HF_HUB_OFFLINE=1).
Scenes run at native resolution (`upscale: none`): Real-ESRGAN x2 smears fabric, foliage, stone.

Pipeline (per scene)
--------------------
1. prepare  source -> optional crop -> optional watermark inpaint (LaMa) -> optional upscale.
2. depth    Depth Anything V2 Large -> disparity 0 (far) .. 1 (near).
3. masks    each plane = `add` / `sub` lists of ops (source-file px):
              sam {box, points}, birefnet {box}, depth {lt|gt, w}, sky {...}, poly / rect (+ inset,
              quarter-pixel exact), pf {gt} (P(object|colour)), lum {lt|gt}, and [ops]
            options: within, within_poly, thresh, hull, binary (+feather), dilate, erode, blur.
            back ops: "guided": false skips the colour guided filter (exact window panes, binary depth
            cuts); "opening": {band, margin, inner} marks a glazed opening (see plates); back `sub`
            ops are a hard override applied last (whatever they cover is mid).
            front `sub` ops are forbidden to the front everywhere (trimap background, never keyed).
4. edges    front core: closed-form matting on a trimap (sky-key gaps forced to background).
5. reach    the motion model is replayed on a grid of instants: a hidden pixel of a plane is
            "reachable" if it can be seen at some instant.  Fills are only built there.
6. plates   LaMa holes always include the occluder support dilated (back: `hole_px`, mid: 3 px),
            and context never includes a mixed pixel or a pixel of another plane; optional context
            exclusions per plane (`ctx_exclude`).  Sky: smooth plate from clean seeds (eroded, away
            from the front object and from nearer surfaces), clamped to its low-pass + matched grain.
            Openings: LaMa inside the opening only (context = its own view), then the band around
            the pane is filled by reflecting the pane's own rows/columns (no foreign object).
            Per-scene `fixes`: structural fills (dir = post / fascia continued along a direction,
            lama = LaMa restricted to a context polygon, smooth).
   keying   only next to the object (key_link_px): what differs from the clean plate joins the front.
   ring     a ring of `ring_px` around the front (1 px on textured backgrounds) is plate in the
            under-layers and the front carries the difference (antialiased rims, rim light, faint
            needles), unless the plate is clearly wrong there (needed alpha > ring_cap: real value).
7. layers   exact compositing, back to front (C = a2 F2 + (1-a2) (a1 F1 + (1-a1) X0)); alpha is
            only raised where the colour would leave the gamut, i.e. on edges and rings.  At rest the
            stack recomposes to the source up to 8-bit rounding.
8. export   back.png/.webp/.avif (opaque), mid/front .png (full frame), *.crop.png/.webp/.avif
            (cropped to the alpha bbox; the front crop is edge-padded by `pad` px where the image
            border cuts it, bbox in the manifest may extend outside the image), mobile_back.webp,
            manifest.json (rest diffs, hole/border checks, QA gates G1/G2), sim.jpg, debug/.
            WebP via cwebp -sharp_yuv, AVIF via avifenc 4:4:4 (Pillow fallback).
    QA gates  G1: interior translucency per layer (0.15 < a < 0.85, > 3 px from a=0 and a=1) <= 150 px.
              G2: plate specks near the occluder's rest contour <= 0.1 %.
              G3: tools/review_qa.py <scene> run and motion6_fill.jpg looked at, at 100 %.
"""
import argparse, glob, hashlib, json, os, sys, time

import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.abspath(os.path.join(HERE, '..'))
SCRATCH = os.path.abspath(os.path.join(V2, '..'))
HF = os.environ.get('HF_CACHE') or os.path.join(SCRATCH, 'models', 'hf')
os.environ.setdefault('HF_HOME', HF)
os.environ.setdefault('HF_HUB_CACHE', HF)
os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')

F32 = np.float32
T_ZONE = 0.02          # alpha below this counts as "not covered" when deciding fills
T_SUP = 0.004          # alpha above this belongs to a layer's support (plate holes, alpha raising)


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


# ----------------------------------------------------------------------------- small image helpers
def to_f(img8):
    return img8.astype(F32) / 255.0


def to_8(x):
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)


def disk(r):
    r = max(0, int(round(r)))
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def dilate(m, r):
    return m if r <= 0 else cv2.dilate(m.astype(np.uint8), disk(r)).astype(bool)


def erode(m, r):
    return m if r <= 0 else cv2.erode(m.astype(np.uint8), disk(r)).astype(bool)


def sstep(x, t, w):
    """Soft step 0 -> 1 around t, width w (logistic)."""
    return 1.0 / (1.0 + np.exp(-np.clip((x - t) / max(w, 1e-6) * 4.0, -30, 30)))


def push_pull(img, w):
    """Smooth fill: normalised convolution on a pyramid. img HxWxC, w HxW weights (0 unknown)."""
    levels, im, m = [], img * w[..., None], w.astype(F32)
    while min(m.shape) > 4:
        levels.append((im, m))
        im, m = cv2.pyrDown(im), cv2.pyrDown(m)
        if im.ndim == 2:
            im = im[..., None]
    fill = im / np.maximum(m[..., None], 1e-6)
    if (m < 1e-5).all():
        fill[:] = img.reshape(-1, img.shape[-1]).mean(0)
    for im_l, m_l in reversed(levels):
        up = cv2.resize(fill, (m_l.shape[1], m_l.shape[0]), interpolation=cv2.INTER_LINEAR)
        if up.ndim == 2:
            up = up[..., None]
        cur = im_l / np.maximum(m_l[..., None], 1e-6)
        k = np.clip(m_l * 3.0, 0, 1)[..., None]
        fill = cur * k + up * (1 - k)
    return fill.astype(F32)


def guided_color(I, p, r, eps):
    """Colour guided filter (He et al.): snaps a soft mask p to the edges of the RGB guide I."""
    k = (2 * r + 1, 2 * r + 1)
    box = lambda x: cv2.boxFilter(x, -1, k, borderType=cv2.BORDER_REFLECT)
    mI = box(I)
    mp = box(p)
    cov = box(I * p[..., None]) - mI * mp[..., None]
    var = np.empty(I.shape[:2] + (3, 3), F32)
    for i in range(3):
        for j in range(i, 3):
            v = box(I[..., i] * I[..., j]) - mI[..., i] * mI[..., j]
            var[..., i, j] = v
            var[..., j, i] = v
    var += eps * np.eye(3, dtype=F32)
    a = np.linalg.solve(var, cov[..., None])[..., 0]
    b = mp - (a * mI).sum(-1)
    return (box(a) * I).sum(-1) + box(b)


def nearest_value(src, values, f=2):
    """For every pixel, `values` at the nearest pixel where `src` is True (computed at 1/f res)."""
    H, W = src.shape
    h, w = max(1, H // f), max(1, W // f)
    s = cv2.resize(src.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST).astype(bool)
    v = cv2.resize(values.astype(F32), (w, h), interpolation=cv2.INTER_NEAREST)
    if not s.any():
        return np.zeros((H, W), F32)
    _, lab = cv2.distanceTransformWithLabels((~s).astype(np.uint8), cv2.DIST_L2, 5,
                                             labelType=cv2.DIST_LABEL_PIXEL)
    pos = np.zeros(lab.max() + 1, np.int64)
    pos[lab[s]] = np.flatnonzero(s)
    out = v.ravel()[pos[lab]].reshape(h, w)
    return cv2.resize(out, (W, H), interpolation=cv2.INTER_NEAREST)


def min_alpha(I, Y):
    """Smallest alpha such that F = (I - (1-a) Y) / a stays inside [0,1]^3."""
    up = np.where(I > Y, (I - Y) / np.maximum(1 - Y, 1e-6), 0)
    dn = np.where(I < Y, (Y - I) / np.maximum(Y, 1e-6), 0)
    return np.maximum(up, dn).max(-1).astype(F32)


def q_up(a):
    """Quantise alpha to 8 bits rounding up (keeps solved colours in gamut)."""
    return np.ceil(np.clip(a, 0, 1) * 255 - 0.02) / 255.0


def solve_color(I, Y, a):
    return np.clip((I - (1 - a[..., None]) * Y) / np.maximum(a[..., None], 1e-6), 0, 1)


def bleed(rgb, a):
    """Colours of (almost) transparent pixels <- smooth extension of the visible ones."""
    w = np.clip(a * 4, 0, 1).astype(F32)
    ext = push_pull(rgb, w)
    k = (a > 0)[..., None]
    return np.where(k, rgb, ext)


def bbox(a, pad=2):
    ys, xs = np.where(a > 0)
    if len(ys) == 0:
        return [0, 0, 0, 0]
    H, W = a.shape
    x0, y0 = max(int(xs.min()) - pad, 0), max(int(ys.min()) - pad, 0)
    x1, y1 = min(int(xs.max()) + 1 + pad, W), min(int(ys.max()) + 1 + pad, H)
    return [x0, y0, x1 - x0, y1 - y0]


def hsh(*objs):
    h = hashlib.md5()
    for o in objs:
        h.update(o.tobytes() if isinstance(o, np.ndarray) else json.dumps(o, sort_keys=True).encode())
    return h.hexdigest()[:12]


# ----------------------------------------------------------------------------- models (lazy, shared)
class Models:
    def __init__(self, threads=4):
        import torch
        torch.set_num_threads(threads)
        self.threads = threads
        self._m = {}
        self._sam_key = None
        self._sam_emb = None

    def _get(self, key, fn):
        if key not in self._m:
            t = time.time()
            self._m[key] = fn()
            log(f'model {key} loaded in {time.time() - t:.0f}s')
        return self._m[key]

    # Depth Anything V2 Large -> disparity 0 (far) .. 1 (near)
    def depth(self, img8, long=1036):
        import torch
        from transformers import AutoImageProcessor, AutoModelForDepthEstimation
        mid = 'depth-anything/Depth-Anything-V2-Large-hf'
        proc, model = self._get('depth', lambda: (AutoImageProcessor.from_pretrained(mid, cache_dir=HF),
                                                 AutoModelForDepthEstimation.from_pretrained(mid, cache_dir=HF).eval()))
        H, W = img8.shape[:2]
        s = long / max(H, W)
        h14, w14 = int(round(H * s / 14)) * 14, int(round(W * s / 14)) * 14
        inp = proc(images=Image.fromarray(img8).resize((w14, h14), Image.BICUBIC), return_tensors='pt', do_resize=False)
        with torch.inference_mode():
            pred = model(**inp).predicted_depth
        pred = torch.nn.functional.interpolate(pred[:, None], size=(H, W), mode='bicubic', align_corners=False)[0, 0].numpy()
        lo, hi = np.percentile(pred, 0.5), np.percentile(pred, 99.5)
        return np.clip((pred - lo) / (hi - lo), 0, 1).astype(F32)

    # SAM 2.1: image embedding computed once per image, then one call per prompt
    def sam(self, img8, box=None, points=None):
        import torch
        from transformers import Sam2Processor, Sam2Model
        mid = 'facebook/sam2.1-hiera-base-plus'
        proc, model = self._get('sam2', lambda: (Sam2Processor.from_pretrained(mid, cache_dir=HF),
                                                Sam2Model.from_pretrained(mid, cache_dir=HF).eval()))
        H, W = img8.shape[:2]
        kw = dict(images=Image.fromarray(img8), return_tensors='pt')
        if box is not None:
            kw['input_boxes'] = [[list(map(float, box))]]
        if points:
            kw['input_points'] = [[[[float(p[0]), float(p[1])] for p in points]]]
            kw['input_labels'] = [[[int(p[2]) for p in points]]]
        inp = proc(**kw)
        key = hsh(img8[::7, ::7])
        with torch.inference_mode():
            if key != self._sam_key:
                self._sam_emb = model.get_image_embeddings(inp['pixel_values'])
                self._sam_key = key
            args = {k: v for k, v in inp.items() if k in ('input_points', 'input_labels', 'input_boxes')}
            out = model(image_embeddings=self._sam_emb, multimask_output=False, **args)
        m = proc.post_process_masks(out.pred_masks, inp['original_sizes'], binarize=False)[0]
        return torch.sigmoid(m.reshape(-1, H, W)[0]).numpy().astype(F32), float(out.iou_scores.flatten()[0])

    # BiRefNet salient object matte (optionally inside a box, for resolution)
    def birefnet(self, img8, box=None):
        import torch
        from transformers import AutoModelForImageSegmentation
        model = self._get('birefnet', lambda: AutoModelForImageSegmentation.from_pretrained(
            'ZhengPeng7/BiRefNet', trust_remote_code=True, cache_dir=HF).eval().float())
        H, W = img8.shape[:2]
        x0, y0, x1, y1 = [int(round(v)) for v in (box or [0, 0, W, H])]
        crop = img8[y0:y1, x0:x1]
        x = torch.from_numpy(np.array(Image.fromarray(crop).resize((1024, 1024), Image.BICUBIC))).permute(2, 0, 1).float() / 255
        x = (x - torch.tensor([0.485, 0.456, 0.406])[:, None, None]) / torch.tensor([0.229, 0.224, 0.225])[:, None, None]
        with torch.inference_mode():
            p = model(x[None])[-1].sigmoid()[0, 0].numpy()
        out = np.zeros((H, W), F32)
        out[y0:y1, x0:x1] = cv2.resize(p, (x1 - x0, y1 - y0), interpolation=cv2.INTER_LINEAR)
        return out

    def lama(self):
        def mk():
            import onnxruntime as ort
            p = glob.glob(os.path.join(HF, 'models--Carve--LaMa-ONNX/snapshots/*/lama_fp32.onnx'))[0]
            so = ort.SessionOptions()
            so.intra_op_num_threads = self.threads
            return ort.InferenceSession(p, so, providers=['CPUExecutionProvider'])
        return self._get('lama', mk)

    def esrgan(self):
        def mk():
            from spandrel import ModelLoader
            p = glob.glob(os.path.join(HF, 'models--ai-forever--Real-ESRGAN/snapshots/*/RealESRGAN_x2.pth'))[0]
            return ModelLoader().load_from_file(p).eval()
        return self._get('esrgan', mk)


def upscale_esrgan(models, img8, tile=384, pad=16):
    import torch
    m = models.esrgan()
    s = m.scale
    x = torch.from_numpy(img8).permute(2, 0, 1).float().div(255)[None]
    _, _, H, W = x.shape
    out = torch.zeros(1, 3, H * s, W * s)
    with torch.inference_mode():
        for y0 in range(0, H, tile):
            for x0 in range(0, W, tile):
                ya, yb, xa, xb = max(y0 - pad, 0), min(y0 + tile + pad, H), max(x0 - pad, 0), min(x0 + tile + pad, W)
                o = m(x[:, :, ya:yb, xa:xb])
                hh, ww = (min(y0 + tile, H) - y0) * s, (min(x0 + tile, W) - x0) * s
                oy, ox = (y0 - ya) * s, (x0 - xa) * s
                out[:, :, y0 * s:y0 * s + hh, x0 * s:x0 * s + ww] = o[:, :, oy:oy + hh, ox:ox + ww]
    return (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255 + 0.5).astype(np.uint8)


def color_prob(I, fg, bg, bins=24, sigma=1.0):
    """P(object | colour) from two 3-D colour histograms (object pixels fg, background pixels bg),
    smoothed in colour space, equal priors."""
    from scipy.ndimage import gaussian_filter
    q = np.clip((I * bins).astype(np.int32), 0, bins - 1)
    idx = (q[..., 0] * bins + q[..., 1]) * bins + q[..., 2]
    hist = lambda m: gaussian_filter(np.bincount(idx[m], minlength=bins ** 3).reshape(bins, bins, bins).astype(F32)
                                     / max(int(m.sum()), 1), sigma)
    hf, hb = hist(fg), hist(bg)
    p = hf / (hf + hb + 1e-12)
    return p.ravel()[idx].astype(F32)


def local_sd(img, k=9):
    lum = img.mean(-1) if img.ndim == 3 else img
    m = cv2.boxFilter(lum, -1, (k, k))
    return np.sqrt(np.maximum(cv2.boxFilter(lum * lum, -1, (k, k)) - m * m, 0))


def lama_fill(models, img, hole, need, rings=1, ring_px=20, busy_check=True, tone=(6, 40), coarse_half=True):
    """LaMa fill of `need` (subset of `hole`); returns (filled image, mask of needed pixels done).
    1. coarse LaMa pass over the whole hole, at half resolution by default (rebuilds structures
       crossing it: eaves, trims, stone courses);
    2. `rings` (at least 2 after a half-resolution coarse pass) refinement passes at full resolution in thin rings (ring_px) from the real pixels inwards;
    3. tone match: low frequencies of the fill pulled to those of the visible surroundings near
       the edge (LaMa desaturates large holes);
    4. busy check: where the fill is much busier than the visible background around it (LaMa
       inventing twigs in plain snow from nearby context), fall back to a smooth push-pull fill.
    Pixels of the hole outside the visited tiles get the smooth fill (never visible)."""
    if coarse_half and min(hole.shape) >= 1024:
        # coarse pass at half resolution: twice the context per tile, better global structure
        H, W = hole.shape
        h2, w2 = H // 2, W // 2
        img2 = cv2.resize(img, (w2, h2), interpolation=cv2.INTER_AREA)
        hole2 = cv2.resize(hole.astype(F32), (w2, h2), interpolation=cv2.INTER_AREA) > 0
        need2 = cv2.resize(need.astype(F32), (w2, h2), interpolation=cv2.INTER_AREA) > 0
        o2, d2 = lama_pass(models, img2, hole2, need2)
        up = cv2.resize(o2, (W, H), interpolation=cv2.INTER_CUBIC)
        done = cv2.resize(d2.astype(np.uint8), (W, H), interpolation=cv2.INTER_NEAREST).astype(bool) & hole
        out = np.where(hole[..., None], up, img).astype(F32)
        rings = max(rings, 2)
    else:
        out, done = lama_pass(models, img, hole, need)
    known = (~hole).astype(F32)
    base = img.copy()
    base[hole] = 0
    smooth = push_pull(base, known)
    rest = hole & ~done
    if rest.any():
        out = np.where(rest[..., None], smooth, out)
    if rings and done.any():
        dist = cv2.distanceTransform(hole.astype(np.uint8), cv2.DIST_L2, 5)
        for k in range(rings):
            ring = done & (dist > k * ring_px) & (dist <= (k + 1) * ring_px)
            if ring.sum() < 16:
                break
            ref, d2 = lama_pass(models, out, ring, ring)
            out[d2] = ref[d2]
    if tone and done.any():
        # LaMa drifts in colour inside large holes (desaturated, greyer stucco or stone).  Seamless
        # correction (membrane): along the edge of the hole, the offset between the local mean of
        # the visible pixels and the local mean of the fill is measured, diffused inside the hole
        # and faded out with the distance.  Each stretch of the edge corrects its own surface only.
        sig, fall = tone
        hm, km = hole.astype(F32), (~hole).astype(F32)
        nb = lambda x, m: cv2.GaussianBlur(x * m[..., None], (0, 0), sig) / np.maximum(cv2.GaussianBlur(m, (0, 0), sig), 1e-4)[..., None]
        dist = cv2.distanceTransform(hole.astype(np.uint8), cv2.DIST_L2, 5)
        edge = hole & (dist <= 3)
        off = (nb(img, km) - nb(out, hm)) * edge[..., None]
        mem = push_pull(off, edge.astype(F32))
        w = (np.exp(-(dist / fall) ** 2) * hole)[..., None]
        out = np.clip(out + w * mem, 0, 1)
    if busy_check and done.any():
        sd_fill = cv2.GaussianBlur(local_sd(out), (0, 0), 4)
        sd_bg = cv2.GaussianBlur(nearest_value(~hole, local_sd(img)), (0, 0), 4)
        w = np.clip((sd_fill - 1.6 * sd_bg - 0.01) / (sd_bg + 0.02), 0, 1)
        w = cv2.GaussianBlur(w * hole, (0, 0), 3)[..., None]
        out = np.where(hole[..., None], w * smooth + (1 - w) * out, out)
    return out, done


def lama_pass(models, img, hole, need, tile=512, margin=48):
    """LaMa at 1:1 on 512 px tiles covering `need` (subset of `hole`).  Tiles run in sequence and
    each one sees the previous fills as context.  Only the inner part of a tile is kept (except at
    the image border)."""
    sess = models.lama()
    H, W = hole.shape
    out = img.copy()
    out[hole] = 0
    done = np.zeros_like(hole)
    todo = need & hole
    if not todo.any():
        return out, done
    t = min(tile, H, W)
    stride = t - 2 * margin
    ys, xs = np.where(todo)
    gy = list(range(max(ys.min() - margin, 0), ys.max() + 1, stride))
    gx = list(range(max(xs.min() - margin, 0), xs.max() + 1, stride))
    n = 0
    for ty in gy:
        for tx in gx:
            ya, xa = min(ty, H - t), min(tx, W - t)
            yb, xb = ya + t, xa + t
            iy0 = ya if ya == 0 else ya + margin
            ix0 = xa if xa == 0 else xa + margin
            iy1 = yb if yb == H else yb - margin
            ix1 = xb if xb == W else xb - margin
            if not (todo[iy0:iy1, ix0:ix1] & ~done[iy0:iy1, ix0:ix1]).any():
                continue
            hm = (hole[ya:yb, xa:xb] & ~done[ya:yb, xa:xb])
            crop = out[ya:yb, xa:xb].copy()
            crop[hm] = 0
            if t != 512:
                ci = cv2.resize(crop, (512, 512), interpolation=cv2.INTER_AREA)
                cm = (cv2.resize(hm.astype(F32), (512, 512), interpolation=cv2.INTER_LINEAR) > 0.01).astype(F32)
            else:
                ci, cm = crop, hm.astype(F32)
            res = sess.run(None, {'image': ci.transpose(2, 0, 1)[None].astype(F32), 'mask': cm[None, None]})[0][0].transpose(1, 2, 0)
            if res.max() > 2:
                res = res / 255.0
            res = np.clip(res, 0, 1).astype(F32)
            if t != 512:
                res = cv2.resize(res, (t, t), interpolation=cv2.INTER_CUBIC)
            keep = np.zeros_like(hm)
            keep[iy0 - ya:iy1 - ya, ix0 - xa:ix1 - xa] = True
            keep &= hm
            sub = out[ya:yb, xa:xb]
            sub[keep] = res[keep]
            done[ya:yb, xa:xb] |= keep
            n += 1
    log(f'  lama: {n} tiles, {int(todo.sum())} px needed')
    return out, done


# ----------------------------------------------------------------------------- scene context
class Ctx:
    """Working image + coordinate mapping from config (source-file px) to working px."""

    def __init__(self, img8, crop, scale):
        self.img8 = img8
        self.img = to_f(img8)
        self.H, self.W = img8.shape[:2]
        self.cx, self.cy = (crop[0], crop[1]) if crop else (0, 0)
        self.s = scale
        self.depth = None
        self.front_zone = None
        self.sky_plate = None
        self.sky_key = None
        self.models = None
        self.cache = None
        self.notes = {}

    def pt(self, x, y):
        return (x - self.cx) * self.s, (y - self.cy) * self.s

    def box(self, b):
        x0, y0 = self.pt(b[0], b[1])
        x1, y1 = self.pt(b[2], b[3])
        return [max(0, x0), max(0, y0), min(self.W, x1), min(self.H, y1)]

    def r(self, v):
        return v * self.s

    def cached(self, name, key, fn):
        p = os.path.join(self.cache, f'{name}_{key}.npy') if self.cache else None
        if p and os.path.exists(p):
            return np.load(p)
        v = fn()
        if p:
            np.save(p, v)
        return v


def poly_mask(ctx, polys, inset=0.0):
    """Antialiased polygons (config px, pixel i spans [i, i+1)), rendered at 4x.  inset > 0 moves
    the edges inwards by that many px (quarter-pixel precision), < 0 outwards."""
    S = 4
    big = np.zeros((ctx.H * S, ctx.W * S), np.uint8)
    for poly in polys:
        pts = np.array([ctx.pt(x, y) for x, y in poly], np.float64) * S - 0.5
        cv2.fillPoly(big, [np.round(pts * 16).astype(np.int32)], 255, lineType=cv2.LINE_8, shift=4)
    r = int(round(ctx.r(inset) * S))
    if r > 0:
        big = cv2.erode(big, disk(r))
    elif r < 0:
        big = cv2.dilate(big, disk(-r))
    return cv2.resize(big, (ctx.W, ctx.H), interpolation=cv2.INTER_AREA).astype(F32) / 255


def reflect_map(ctx, poly, inset, band, margin=1.0):
    """Mirror map for the band (<= `band` px) outside a convex polygon (config px, edges moved in
    by `inset`): every outside pixel is reflected across the edge line(s) it lies beyond, `margin`
    px deeper, so it reads the opening's own content (never a foreign object).
    Returns (signed distance outside, map_x, map_y) in working px (index coordinates)."""
    P = np.array([ctx.pt(x, y) for x, y in poly], np.float64)
    cen = P.mean(0)
    lines = []
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        t = (b - a) / max(np.linalg.norm(b - a), 1e-9)
        n = np.array([t[1], -t[0]])
        if np.dot(cen - a, n) > 0:
            n = -n
        lines.append((n, float(np.dot(a, n)) - ctx.r(inset)))
    yy, xx = np.mgrid[0:ctx.H, 0:ctx.W].astype(np.float64) + 0.5
    s = np.max([xx * n[0] + yy * n[1] - o for n, o in lines], 0)
    px, py = xx.copy(), yy.copy()
    m = ctx.r(margin)
    for _ in range(2):
        for n, o in lines:
            si = px * n[0] + py * n[1] - o
            k = si > 0
            px[k] -= 2 * (si[k] + m) * n[0]
            py[k] -= 2 * (si[k] + m) * n[1]
    return s.astype(F32), (px - 0.5).astype(F32), (py - 0.5).astype(F32)


def dir_fill(img, known, todo, d, K=400):
    """Structural fill along a direction (a post, a fascia, a trim): every `todo` pixel takes the
    known pixels found along +d and -d, linearly interpolated by distance (or the only side found)."""
    out = img.copy()
    ys, xs = np.where(todo)
    if not len(ys):
        return out, todo
    H, W = known.shape
    d = np.array(d, np.float64)
    d = d / np.abs(d).max()
    acc, wsum = np.zeros((len(ys), 3)), np.zeros(len(ys))
    for sgn in (1, -1):
        dist = np.full(len(ys), np.inf)
        val = np.zeros((len(ys), 3))
        for k in range(1, K):
            x = np.round(xs + sgn * k * d[0]).astype(int)
            y = np.round(ys + sgn * k * d[1]).astype(int)
            inb = (x >= 0) & (x < W) & (y >= 0) & (y < H)
            xc, yc = np.clip(x, 0, W - 1), np.clip(y, 0, H - 1)
            hit = inb & np.isinf(dist) & known[yc, xc]
            val[hit] = img[yc[hit], xc[hit]]
            dist[hit] = k
            if np.isfinite(dist).all():
                break
        w = np.where(np.isfinite(dist), 1.0 / np.maximum(dist, 1), 0)
        acc += val * w[:, None]
        wsum += w
    ok = wsum > 0
    out[ys[ok], xs[ok]] = (acc[ok] / wsum[ok, None]).astype(F32)
    done = np.zeros_like(todo)
    done[ys[ok], xs[ok]] = True
    return out, done


def prune(a, min_area, core):
    """Zero the components of (a > T_SUP) smaller than min_area px that do not touch `core`."""
    if not min_area:
        return a
    n, lab, st, _ = cv2.connectedComponentsWithStats((a > T_SUP).astype(np.uint8), connectivity=8)
    if n <= 1:
        return a
    touch = np.zeros(n, bool)
    touch[np.unique(lab[core & (lab > 0)])] = True
    small = (st[:, cv2.CC_STAT_AREA] < min_area) & ~touch
    small[0] = False
    return np.where(small[lab], 0, a).astype(F32)


def translucency(a, gap=3):
    """QA gate G1: interior translucent pixels (0.15 < a < 0.85) farther than `gap` px from both
    a ~ 0 and a ~ 1 (a translucent patch, not an antialiased edge)."""
    part = (a > 0.15) & (a < 0.85)
    d0 = cv2.distanceTransform((a >= 0.02).astype(np.uint8), cv2.DIST_L2, 5)
    d1 = cv2.distanceTransform((a <= 0.98).astype(np.uint8), cv2.DIST_L2, 5)
    m = part & (d0 > gap) & (d1 > gap)
    return int(m.sum()), m


def plate_specks(X, hidden, reach_m, band=4, t=6 / 255, k=3.0):
    """QA gate G2: specks of a plate near the occluder's rest contour (ghost outlines).
    Pixels of `reach & hidden` within `band` px of the contour whose high-pass |X - G(X, 2)|
    exceeds max(6/255, k x the typical high-pass of the visible plane around)."""
    hp = np.abs(X - cv2.GaussianBlur(X, (0, 0), 2)).max(-1)
    din = cv2.distanceTransform(hidden.astype(np.uint8), cv2.DIST_L2, 5)
    zone = hidden & (din <= band) & reach_m
    if not zone.any():
        return 0.0, zone
    vis = ~dilate(hidden, 2)
    tex = cv2.GaussianBlur(nearest_value(vis, cv2.GaussianBlur(hp, (0, 0), 3)), (0, 0), 3)
    sp = zone & (hp > np.maximum(t, k * tex))
    return round(float(sp.sum() / zone.sum() * 100), 4), sp


def op_sky(p, ctx):
    """Sky colour key + clean sky plate.  Sure sky = blue-dominant (or white cloud) far pixels
    connected to the top.  Plate seeds keep away from antialiased rims, from the front object and
    from anything nearer than the sky, so the plate never holds a dotted copy of a silhouette.
    Hidden parts of the plate are smoothed, clamped to their low-pass (outside clouds) and given the
    grain of the visible sky.  The key is only trusted where the depth is far, or inside the front
    object (sky between branches)."""
    g, d = ctx.img, ctx.depth
    blue = g[..., 2] - np.maximum(g[..., 0], g[..., 1])
    far = d < p.get('far', 0.03)
    sure = (blue > p.get('blue', 0.08)) & far
    cloud = far & (g.mean(-1) > p.get('cloud_L', 0.72)) & (g.max(-1) - g.min(-1) < 0.14)
    if p.get('clouds', True):
        sure |= cloud
    if p.get('connect_top', True):
        n, lab = cv2.connectedComponents(sure.astype(np.uint8), connectivity=4)
        top = set(np.unique(lab[:3])) - {0}
        sure = np.isin(lab, list(top))
    seeds = erode(sure, p.get('seed_erode', 4))
    if ctx.front_zone is not None:
        seeds &= ~dilate(ctx.front_zone, p.get('seed_front_px', 6))
    seeds &= ~dilate(~far, p.get('seed_mid_px', 3))
    plate = push_pull(g, seeds.astype(F32))
    sm = cv2.GaussianBlur(plate, (0, 0), p.get('smooth', 8))
    lp = cv2.GaussianBlur(plate, (0, 0), 25)
    cz = cv2.GaussianBlur(nearest_value(seeds, (cloud & seeds).astype(F32)), (0, 0), 4) > 0.3
    clamp = p.get('clamp', 3 / 255)
    smc = np.where(cz[..., None], sm, lp + np.clip(sm - lp, -clamp, clamp))
    hp = (g - cv2.GaussianBlur(g, (0, 0), 1.0))[seeds & ~dilate(cloud, 4)]
    sig = 1.4826 * np.median(np.abs(hp - np.median(hp, 0)), 0) if len(hp) > 100 else np.full(3, 0.5 / 255)
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(g.shape[:2]).astype(F32)[..., None] * sig.astype(F32)
    hidden_plate = np.clip(smc + noise, 0, 1)
    plate = np.where(seeds[..., None], g, hidden_plate).astype(F32)
    dist = np.sqrt(((g - plate) ** 2).sum(-1))
    t0, t1 = p.get('t', [0.035, 0.09])
    key = np.clip((t1 - dist) / (t1 - t0), 0, 1)
    key *= np.clip((blue + 0.02) / 0.06, 0, 1) if p.get('need_blue', False) else 1
    zone = d < p.get('max_depth', 0.2)
    if p.get('in_front', True) and ctx.front_zone is not None:
        zone = zone | ctx.front_zone
    key = (key * zone).astype(F32)
    ctx.sky_plate, ctx.sky_key = plate, key
    ctx.notes['sky_seeds'] = seeds
    return key


def op_mask(op, ctx):
    if 'sam' in op:
        a = op['sam']
        box = ctx.box(a['box']) if 'box' in a else None
        pts = [list(ctx.pt(x, y)) + [l] for x, y, l in a.get('points', [])]
        key = hsh(ctx.img8[::7, ::7], {'box': box, 'pts': pts})
        def run():
            m, iou = ctx.models.sam(ctx.img8, box, pts)
            log(f'  sam {a.get("label", "")} iou={iou:.3f}')
            return m
        m = ctx.cached('sam', key, run)
    elif 'birefnet' in op:
        a = op['birefnet']
        box = ctx.box(a['box']) if 'box' in a else None
        m = ctx.cached('birefnet', hsh(ctx.img8[::7, ::7], {'box': box}), lambda: ctx.models.birefnet(ctx.img8, box))
    elif 'depth' in op:
        a = op['depth']
        m = (1 - sstep(ctx.depth, a['lt'], a.get('w', 0.02))) if 'lt' in a else sstep(ctx.depth, a['gt'], a.get('w', 0.02))
    elif 'sky' in op:
        m = op_sky(op['sky'], ctx)
    elif 'poly' in op:
        m = poly_mask(ctx, [op['poly']] if not isinstance(op['poly'][0][0], (list, tuple)) else op['poly'], op.get('inset', 0))
    elif 'rect' in op:
        x0, y0, x1, y1 = op['rect']
        m = poly_mask(ctx, [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]], op.get('inset', 0))
    elif 'pf' in op:      # P(object | colour) of the front object
        a = op['pf']
        pf = ctx.notes.get('pf')
        m = np.zeros((ctx.H, ctx.W), F32) if pf is None else (pf > a['gt']).astype(F32)
    elif 'lum' in op:
        a = op['lum']
        L = ctx.img.mean(-1)
        m = ((L < a['lt']) if 'lt' in a else (L > a['gt'])).astype(F32)
    elif 'and' in op:
        m = np.prod([op_mask(o, ctx) for o in op['and']], 0)
    else:
        raise ValueError(f'unknown op {op}')
    m = m.astype(F32)
    if 'within' in op:
        x0, y0, x1, y1 = op['within']
        m = m * poly_mask(ctx, [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]])
    if 'within_poly' in op:
        m = m * poly_mask(ctx, [op['within_poly']])
    if op.get('thresh') is not None:
        m = (m > op['thresh']).astype(F32)
    if op.get('hull'):  # convex openings (windows): convex hull of the hard mask, antialiased
        pts = cv2.findNonZero((m > 0.5).astype(np.uint8))
        if pts is not None:
            hull = cv2.convexHull(pts).reshape(-1, 2).astype(np.float32)
            big = np.zeros((ctx.H * 4, ctx.W * 4), np.uint8)
            cv2.fillPoly(big, [(hull * 4 + 1.5).astype(np.int32)], 255)
            m = cv2.resize(big, (ctx.W, ctx.H), interpolation=cv2.INTER_AREA).astype(F32) / 255
    if op.get('largest'):  # keep the largest component of the hard mask (drops stray SAM blobs)
        n, lab, st, _ = cv2.connectedComponentsWithStats((m > 0.5).astype(np.uint8), connectivity=8)
        if n > 1:
            k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
            keep = cv2.dilate((lab == k).astype(np.uint8), disk(2)).astype(F32)
            m = m * keep
    if op.get('fill_holes'):  # fill closed holes of the hard mask smaller than N px
        n, lab, st, _ = cv2.connectedComponentsWithStats((m <= 0.5).astype(np.uint8), connectivity=4)
        small = np.flatnonzero(st[:, cv2.CC_STAT_AREA] < ctx.r(ctx.r(op['fill_holes'])))
        small = small[small > 0]
        m = np.maximum(m, np.isin(lab, small).astype(F32))
    if op.get('fill_down'):  # an object standing in front of an opening: everything below its top edge
        hard = m > 0.5
        below = np.maximum.accumulate(hard, axis=0)
        m = np.maximum(m, (below & ~hard).astype(F32))
        if 'within' in op:
            x0, y0, x1, y1 = op['within']
            m = m * poly_mask(ctx, [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]])
    if op.get('binary'):  # hard mask with a small feather (no soft band)
        m = cv2.GaussianBlur((m > 0.5).astype(F32), (0, 0), max(op.get('feather', 0.5), 0.3))
    if op.get('dilate'):
        m = cv2.dilate(m, disk(ctx.r(op['dilate'])))
    if op.get('erode'):
        m = cv2.erode(m, disk(ctx.r(op['erode'])))
    if op.get('blur'):
        m = cv2.GaussianBlur(m, (0, 0), ctx.r(op['blur']))
    return np.clip(m, 0, 1)


def ops_union(ops, ctx, t=0.5):
    m = np.zeros((ctx.H, ctx.W), bool)
    for o in ops:
        m |= op_mask(o, ctx) > t
    return m


def plane_mask(spec, ctx):
    add = [op_mask(o, ctx) for o in spec.get('add', [])]
    m = np.max(add, 0) if add else np.zeros((ctx.H, ctx.W), F32)
    for o in spec.get('sub', []):
        m = m * (1 - op_mask(o, ctx))
    if spec.get('keep_largest'):
        hard = (m > 0.5).astype(np.uint8)
        n, lab, st, _ = cv2.connectedComponentsWithStats(hard)
        if n > 1:
            keep = 1 + np.argsort(-st[1:, cv2.CC_STAT_AREA])[:spec['keep_largest']]
            k = np.isin(lab, keep).astype(F32)
            m = m * cv2.dilate(k, disk(ctx.r(6)))
    if spec.get('fill_holes'):  # fill closed holes of the hard mask smaller than N px
        hard = (m > 0.5).astype(np.uint8)
        n, lab, st, _ = cv2.connectedComponentsWithStats(1 - hard, connectivity=4)
        small = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] < ctx.r(ctx.r(spec['fill_holes']))]
        m = np.maximum(m, np.isin(lab, small).astype(F32))
    return m


def back_plane(spec, ctx):
    """Back mask b (1 = back).  Ops with "guided": false (exact polygons of openings, binary depth
    cuts) skip the colour guided filter and the shrink; `sub` ops are applied last as a hard
    override (whatever they cover is mid, whatever the guided filter did).  Ops with an "opening"
    entry are glazed openings: their hidden band is filled by reflection of their own view."""
    I = ctx.img
    soft, exact, opens = [], [], []
    for o in spec.get('add', []):
        m = op_mask(o, ctx)
        (soft if o.get('guided', True) else exact).append(m)
        if o.get('opening') is not None:
            opens.append((o, m))
    b = np.max(soft, 0) if soft else np.zeros((ctx.H, ctx.W), F32)
    g = spec.get('guided', {'r': 3, 'eps': 1e-3})
    if soft and g:
        b = np.clip(guided_color(I, b, max(1, int(round(ctx.r(g['r'])))), g['eps']), 0, 1)
    if soft and spec.get('shrink'):  # back edges sit inside the view: frame edge lines stay with the frame
        b = cv2.erode(b, disk(ctx.r(spec['shrink'])))
    if exact:
        b = np.maximum(b, np.max(exact, 0))
    sub = np.zeros((ctx.H, ctx.W), F32)
    for o in spec.get('sub', []):
        sub = np.maximum(sub, op_mask(o, ctx))
    b = b * (1 - sub)
    b[b < 0.01] = 0
    b[b > 0.99] = 1
    return b.astype(F32), sub, opens


def matte(ctx, coarse, p, forbid=None):
    """Front edges: closed-form matting on a trimap built from the raw mask.
    Sky-key pixels inside the object are forced to background (gaps between needles); `forbid`
    (front `sub` ops: a wall, a post, a roof) is always background."""
    from pymatting import estimate_alpha_cf
    hard = coarse > 0.5
    fg = erode(hard, ctx.r(p.get('fg_erode', 4)))
    bg = ~dilate(hard, ctx.r(p.get('bg_dilate', 5)))
    near_sky = np.zeros(hard.shape, bool)
    if ctx.sky_key is not None and p.get('bg_dilate_sky'):
        out = ~dilate(hard, 3)
        near_sky = nearest_value(out, (ctx.sky_key > 0.5).astype(F32)) > 0.5
        bg = np.where(near_sky, ~dilate(hard, ctx.r(p['bg_dilate_sky'])), bg)
    if 'bg_depth_lt' in p:
        far = (ctx.depth < p['bg_depth_lt']) & ~near_sky
        bg |= far
        fg &= ~dilate(far, 2)
    if 'fg_depth_gt' in p:
        near = (ctx.depth > p['fg_depth_gt']) & dilate(hard, ctx.r(p.get('bg_dilate', 5)))
        fg |= erode(near, 2)
        bg &= ~dilate(near, 1)
    if p.get('sky_bg', True) and ctx.sky_key is not None:
        sk = ctx.sky_key > p.get('sky_bg_t', 0.85)
        bg |= sk
        fg &= ~dilate(sk, 1)
    for o in p.get('force_fg', []):
        fg |= op_mask(o, ctx) > 0.5
    for o in p.get('force_bg', []):
        bg |= op_mask(o, ctx) > 0.5
    if forbid is not None:
        bg |= forbid
        fg &= ~dilate(forbid, 1)
    tri = np.full(hard.shape, 0.5, np.float64)
    tri[fg] = 1
    tri[bg] = 0
    ctx.notes['trimap'] = tri
    unk = tri == 0.5
    if not unk.any():
        return tri.astype(F32)
    ys, xs = np.where(unk)
    pad = 16
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, ctx.H)
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, ctx.W)
    I = ctx.img[y0:y1, x0:x1].astype(np.float64)
    T = tri[y0:y1, x0:x1]
    key = hsh(ctx.img8[::7, ::7], T[::3, ::3].astype(np.float32), T.shape, p.get('down', 1))
    def solve():
        t = time.time()
        down = p.get('down', 1)
        if down > 1:  # solve at lower res, then guided upsampling
            hs, ws = (y1 - y0) // down, (x1 - x0) // down
            Is = cv2.resize(I, (ws, hs), interpolation=cv2.INTER_AREA)
            Ts = cv2.resize(T, (ws, hs), interpolation=cv2.INTER_NEAREST)
            a = estimate_alpha_cf(Is, Ts)
            a = cv2.resize(a, (x1 - x0, y1 - y0), interpolation=cv2.INTER_LINEAR)
            a = guided_color(I.astype(F32), a.astype(F32), 2, 1e-4)
            a = np.where(T == 0.5, a, T)
        else:
            a = estimate_alpha_cf(I, T)
        log(f'  matting {x1 - x0}x{y1 - y0}, unknown {int(unk.sum())} px, {time.time() - t:.0f}s')
        return a.astype(F32)
    a = ctx.cached('matte', key, solve)
    out = tri.copy()
    out[y0:y1, x0:x1] = a
    out = np.clip(out, 0, 1).astype(F32)
    out[out < T_SUP] = 0
    out[out > 0.99] = 1
    for r in p.get('sam_only', []):  # zones where the front is the SAM mask itself (1 px feather)
        z = poly_mask(ctx, [[[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]]) > 0.5
        sam = cv2.GaussianBlur(((coarse > 0.5) & ~(forbid if forbid is not None else False)).astype(F32), (0, 0), 0.7)
        out = np.where(z, sam, out)
    for sz in p.get('solid', []):
        # zones where object and background have the same colour (snow on haze, snow on snow): the
        # object is its closed silhouette (matte iso-line 0.5, gaps filled), opaque, 0.7 px feather;
        # gaps travel with it instead of turning into translucent patches.
        z = (poly_mask(ctx, [sz['poly']]) if 'poly' in sz else
             poly_mask(ctx, [[[sz['rect'][0], sz['rect'][1]], [sz['rect'][2], sz['rect'][1]], [sz['rect'][2], sz['rect'][3]], [sz['rect'][0], sz['rect'][3]]]])) > 0.5
        hard = (out > sz.get('iso', 0.5)).astype(np.uint8)
        hard = cv2.morphologyEx(hard, cv2.MORPH_CLOSE, disk(ctx.r(sz.get('close', 2))))
        n, lab, st, _ = cv2.connectedComponentsWithStats((1 - hard).astype(np.uint8), connectivity=4)
        small = np.flatnonzero(st[:, cv2.CC_STAT_AREA] < ctx.r(ctx.r(sz.get('fill_holes', 600))))
        small = small[small > 0]
        hard = (hard > 0) | np.isin(lab, small)
        if forbid is not None:
            hard &= ~forbid
        out = np.where(z, cv2.GaussianBlur(hard.astype(F32), (0, 0), 0.7), out)
        ctx.notes.setdefault('solid', np.zeros(out.shape, bool))
        ctx.notes['solid'] |= dilate(z, 2)
    return out


# ----------------------------------------------------------------------------- motion model
class Motion:
    """Shared with the site: plane k is drawn at  q = o + s_k (p - o) + speed_k * (h Ax, v Ay)
    with h, v in [-1, 1] (mouse, scroll), Ax/Ay the amplitudes in source px, o the scale origin,
    s_front in [1, front_scale], other planes s = 1.  The frame shows the central 1/(1+overscan)
    of the image."""

    def __init__(self, cfg, W, H):
        self.frame_w = cfg.get('frame_width', 1920)
        self.overscan = cfg.get('overscan', 0.08)
        self.ax_frame, self.ay_frame = cfg.get('amp_x', 28), cfg.get('amp_y', 60)
        self.speeds = cfg.get('speeds', [0.12, 0.45, 1.0])
        self.front_scale = cfg.get('front_scale', 1.06)
        self.origin = cfg.get('scale_origin', [0.5, 0.5])
        self.mobile = cfg.get('mobile', {'amp': 0.5, 'speeds': [0.3, 1.0]})
        self.W, self.H = W, H
        self.px = W / (self.frame_w * (1 + self.overscan))  # source px per frame px
        self.Ax, self.Ay = self.ax_frame * self.px, self.ay_frame * self.px
        self.o = (self.origin[0] * W, self.origin[1] * H)

    def instants(self, n=5, ns=3, coupled=False):
        ls = np.linspace(-1, 1, n)
        if coupled:
            return [(h, v, self.scale_for(v)) for h in ls for v in ls]
        return [(h, v, s) for h in ls for v in ls for s in np.linspace(1.0, self.front_scale, ns)]

    def sim_instants(self):
        return [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)]

    def scale_for(self, v):
        return 1 + (self.front_scale - 1) * max(0.0, -v)

    def affine(self, k, h, v, s_front, speeds=None, amp=1.0):
        sp = (speeds or self.speeds)[k]
        s = s_front if k == len(speeds or self.speeds) - 1 else 1.0
        tx, ty = sp * h * self.Ax * amp, sp * v * self.Ay * amp
        ox, oy = self.o
        return np.array([[s, 0, ox * (1 - s) + tx], [0, s, oy * (1 - s) + ty]], F32)

    def frame_box(self):
        fw, fh = self.W / (1 + self.overscan), self.H / (1 + self.overscan)
        x0, y0 = (self.W - fw) / 2, (self.H - fh) / 2
        return int(round(x0)), int(round(y0)), int(round(x0 + fw)), int(round(y0 + fh))


def reach(motion, k, above, shape, f=4, eps=0.02, margin=3):
    """Pixels of plane k (in its own coordinates) that are seen at some instant through the
    planes above it (dict j -> alpha).  Replays the motion on the instant grid at 1/f resolution,
    then dilates by the largest motion step between instants + margin."""
    H, W = shape
    h, w = H // f, W // f
    gy, gx = (np.mgrid[0:h, 0:w].astype(F32) + 0.5) * f
    small = {j: cv2.resize(a.astype(F32), (w, h), interpolation=cv2.INTER_AREA) for j, a in above.items()}
    seen = np.zeros((h, w), F32)
    fx0, fy0, fx1, fy1 = motion.frame_box()
    for (hh, vv, sf) in motion.instants():
        Mk = motion.affine(k, hh, vv, sf)
        qx, qy = Mk[0, 0] * gx + Mk[0, 2], Mk[1, 1] * gy + Mk[1, 2]
        trans = ((qx >= fx0 - f) & (qx < fx1 + f) & (qy >= fy0 - f) & (qy < fy1 + f)).astype(F32)
        for j, a in small.items():
            Mj = motion.affine(j, hh, vv, sf)
            px, py = (qx - Mj[0, 2]) / Mj[0, 0], (qy - Mj[1, 2]) / Mj[1, 1]
            aj = cv2.remap(a, px / f - 0.5, py / f - 0.5, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
            trans *= 1 - np.clip(aj, 0, 1)
        seen = np.maximum(seen, trans)
    sp = motion.speeds
    step = 0.5 * max(abs(sp[j] - sp[k]) for j in above) * max(motion.Ax, motion.Ay)
    if len(sp) - 1 in above:
        step = max(step, (motion.front_scale - 1) / 2 * 0.5 * max(motion.W, motion.H))
    r = int(np.ceil((step / 2 + margin) / f)) + 1
    m = cv2.dilate((seen > eps).astype(np.uint8), disk(r))
    return cv2.resize(m, (W, H), interpolation=cv2.INTER_NEAREST).astype(bool)


# ----------------------------------------------------------------------------- simulation
def render(motion, layers, h, v, sf, speeds=None, amp=1.0, pads=None):
    """Composite RGBA float layers (back -> front) at one instant.  Returns rgb, coverage, cut.
    pads = (left, top, right, bottom) px of edge-replicated padding of the top layer (front.crop
    exports carry it where the object is cut by the image border)."""
    H, W = layers[0].shape[:2]
    rgb = np.zeros((H, W, 3), F32)
    cov = np.zeros((H, W), F32)
    cut = np.zeros((H, W), bool)
    n = len(layers)
    for k, L in enumerate(layers):
        M = motion.affine(k, h, v, sf, speeds, amp)
        pre = np.dstack([L[..., :3] * L[..., 3:4], L[..., 3]])
        top = k == n - 1 and pads is not None
        wv = cv2.warpAffine(pre, M, (W, H), flags=cv2.INTER_LINEAR,
                            borderMode=cv2.BORDER_REPLICATE if top else cv2.BORDER_CONSTANT, borderValue=0)
        pl, pt, pr, pb = pads if top else (0, 0, 0, 0)
        sx, sy = (np.arange(W) - M[0, 2]) / M[0, 0], (np.arange(H) - M[1, 2]) / M[1, 1]
        dx = ((sx >= -pl - 0.5) & (sx <= W - 0.5 + pr)).astype(F32)
        dy = ((sy >= -pt - 0.5) & (sy <= H - 0.5 + pb)).astype(F32)
        dom = dy[:, None] * dx[None, :]
        if top:
            wv = wv * dom[..., None]
        a = wv[..., 3]
        rgb = wv[..., :3] + (1 - a[..., None]) * rgb
        cov = a + (1 - a) * cov
        if k > 0:  # a layer's own border entering the frame while it is opaque there
            rep = cv2.warpAffine(L[..., 3], M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            cut |= (dom < 0.5) & (rep > 0.5)
    return rgb, cov, cut


def label(img8, text):
    im = Image.fromarray(img8)
    d = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', max(14, img8.shape[1] // 40))
    except Exception:
        font = ImageFont.load_default()
    d.rectangle([0, 0, img8.shape[1], font.size + 10], fill=(0, 0, 0))
    d.text((8, 4), text, fill=(255, 255, 255), font=font)
    return np.asarray(im)


def simulate(motion, layers, out_dir, debug_dir, pads=None):
    fx0, fy0, fx1, fy1 = motion.frame_box()
    frames, stats = [], {}
    for (h, v) in motion.sim_instants():
        sf = motion.scale_for(v)
        rgb, cov, cut = render(motion, layers, h, v, sf, pads=pads)
        img = rgb.copy()
        holes = cov < 0.995
        img[holes] = (1, 0, 1)
        img[cut & ~holes] = (0, 1, 1)
        fr = to_8(img[fy0:fy1, fx0:fx1])
        Image.fromarray(fr).save(os.path.join(debug_dir, f'sim_{h:+d}_{v:+d}.png'))
        frames.append(label(fr, f'mouse {h:+d}  scroll {v:+d}  front x{sf:.2f}   holes {holes[fy0:fy1, fx0:fx1].mean() * 100:.3f}%  cut {cut[fy0:fy1, fx0:fx1].mean() * 100:.3f}%'))
    for name, grid in (('coupled', motion.instants(coupled=True)), ('decoupled', motion.instants())):
        worst_h = worst_c = 0.0
        for (h, v, sf) in grid:
            _, cov, cut = render(motion, layers, h, v, sf, pads=pads)
            worst_h = max(worst_h, float((cov[fy0:fy1, fx0:fx1] < 0.995).mean()))
            worst_c = max(worst_c, float(cut[fy0:fy1, fx0:fx1].mean()))
        stats[f'desktop_{name}_worst_hole_pct'] = round(worst_h * 100, 4)
        stats[f'desktop_{name}_worst_border_cut_pct'] = round(worst_c * 100, 4)
    tw = 760
    th = int(frames[0].shape[0] * tw / frames[0].shape[1])
    sheet = Image.new('RGB', (tw * 3 + 20, th * 2 + 10), 'white')
    for i, f in enumerate(frames):
        sheet.paste(Image.fromarray(f).resize((tw, th), Image.LANCZOS), ((i % 3) * (tw + 10), (i // 3) * (th + 10)))
    sheet.save(os.path.join(out_dir, 'sim.jpg'), quality=88)
    return stats


def mobile_check(motion, back_flat, front, pads=None):
    fx0, fy0, fx1, fy1 = motion.frame_box()
    sp = motion.mobile['speeds']
    worst = 0.0
    m2 = Motion({'frame_width': motion.frame_w, 'overscan': motion.overscan, 'amp_x': motion.ax_frame,
                 'amp_y': motion.ay_frame, 'speeds': sp, 'front_scale': motion.front_scale,
                 'scale_origin': motion.origin}, motion.W, motion.H)
    for (h, v, sf) in m2.instants():
        _, cov, _ = render(m2, [back_flat, front], h, v, sf, sp, motion.mobile['amp'], pads=pads)
        worst = max(worst, float((cov[fy0:fy1, fx0:fx1] < 0.995).mean()))
    return round(worst * 100, 4)


# ----------------------------------------------------------------------------- debug sheets / exports
def checker(h, w, s=16):
    c = (np.indices((h, w)).sum(0) // s) % 2
    return np.where(c[..., None], 0.78, 0.92).astype(F32).repeat(3, -1)


def sheet(path, tiles, cols=3, tw=640):
    th = int(tiles[0][1].shape[0] * tw / tiles[0][1].shape[1])
    rows = (len(tiles) + cols - 1) // cols
    im = Image.new('RGB', (cols * (tw + 8), rows * (th + 8)), 'white')
    for i, (name, t) in enumerate(tiles):
        t8 = t if t.dtype == np.uint8 else to_8(t)
        if t8.ndim == 2:
            t8 = np.repeat(t8[..., None], 3, -1)
        t8 = cv2.resize(t8, (tw, th), interpolation=cv2.INTER_AREA)
        im.paste(Image.fromarray(label(t8, name)), ((i % cols) * (tw + 8), (i // cols) * (th + 8)))
    im.save(path, quality=88)


def place(rgba, bbox, H, W):
    """Full-frame RGBA float from a crop placed at bbox [x, y, w, h] (bbox may extend outside the
    image: front crops carry edge padding)."""
    x, y, w, h = bbox
    full = np.zeros((H, W, 4), F32)
    xa, ya, xb, yb = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    full[ya:yb, xa:xb] = rgba[ya - y:yb - y, xa - x:xb - x]
    return full


def read_rgba(path):
    return to_f(np.asarray(Image.open(path).convert('RGBA')))


def encode(png, out, kind, q):
    """External encoders: cwebp -sharp_yuv (exact alpha), avifenc 4:4:4.  Falls back to Pillow."""
    import shutil, subprocess
    try:
        if kind == 'webp' and shutil.which('cwebp'):
            subprocess.run(['cwebp', '-quiet', '-q', str(q), '-m', '6', '-sharp_yuv', '-exact', '-alpha_q', '100', png, '-o', out], check=True)
            return
        if kind == 'avif' and shutil.which('avifenc'):
            subprocess.run(['avifenc', '-j', '4', '-s', '4', '--yuv', '444', '-q', str(q), '--qalpha', '100', png, out],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
    except Exception as e:
        log('  encoder failed, Pillow fallback', kind, e)
    im = Image.open(png)
    if kind == 'webp':
        im.save(out, quality=q, method=6, exact=True)
    else:
        im.save(out, quality=q, subsampling='4:4:4')


def export_diffs(out, planes, src8):
    """Mean / p99 / max abs diff (0-255) of the exported files recomposed at rest, per export set."""
    H, W = src8.shape[:2]
    src = src8.astype(F32)
    res = {}
    for name, key in (('png', 'png'), ('webp', 'webp'), ('avif', 'avif')):
        p = os.path.join(out, planes[0][key])
        if not os.path.isfile(p):
            continue
        comp = np.asarray(Image.open(p).convert('RGB')).astype(F32)
        for pl in planes[1:]:
            f = os.path.join(out, pl[key])
            if not os.path.isfile(f):
                break
            L = place(read_rgba(f), pl['bbox'], H, W)
            a = L[..., 3:4]
            comp = L[..., :3] * 255 * a + comp * (1 - a)
        d = np.abs(comp - src).max(-1)
        res[name] = {'mean': round(float(d.mean()), 3), 'p99': round(float(np.percentile(d, 99)), 2),
                     'max': round(float(d.max()), 1)}
    return res


# ----------------------------------------------------------------------------- one scene
def prepare(cfg, models, src_dir):
    path = os.path.join(src_dir, cfg['src'])
    img8 = np.asarray(Image.open(path).convert('RGB')).copy()
    crop = cfg.get('crop')
    if crop:
        img8 = img8[crop[1]:crop[3], crop[0]:crop[2]].copy()
    ctx0 = Ctx(img8, crop, 1.0)
    for wm in cfg.get('watermark', []):  # inpaint "Image générée par IA" boxes
        x0, y0, x1, y1 = [int(round(v)) for v in ctx0.box(wm)]
        hole = np.zeros(img8.shape[:2], bool)
        hole[y0:y1, x0:x1] = True
        filled, _ = lama_fill(models, to_f(img8), hole, hole)
        img8 = to_8(np.where(hole[..., None], filled, to_f(img8)))
        log('  watermark inpainted', wm)
    scale = 1.0
    if cfg.get('upscale') == 'esrgan2x':
        log('  Real-ESRGAN x2 ...')
        img8 = upscale_esrgan(models, img8)
        scale = 2.0
    ww = cfg.get('work_width')
    if ww and ww != img8.shape[1]:
        f = ww / img8.shape[1]
        img8 = np.asarray(Image.fromarray(img8).resize((ww, int(round(img8.shape[0] * f))), Image.LANCZOS))
        scale *= f
    return img8, crop, scale


def run_scene(sid, cfg, models, out_root, src_dir, use_cache=True):
    t0 = time.time()
    log(f'=== {sid}: {cfg["src"]}')
    out = os.path.join(out_root, sid)
    dbg = os.path.join(out, 'debug')
    cache = os.path.join(out, '_cache')
    for d in (out, dbg, cache):
        os.makedirs(d, exist_ok=True)

    # 1. prepare
    img8, crop, scale = prepare(cfg, models, src_dir)
    ctx = Ctx(img8, crop, scale)
    ctx.models = models
    ctx.cache = cache if use_cache else None
    H, W = ctx.H, ctx.W
    I = ctx.img
    Image.fromarray(img8).save(os.path.join(out, 'src.png'))
    motion = Motion(cfg.get('motion', {}), W, H)

    # 2. depth
    ctx.depth = ctx.cached('depth', hsh(img8[::5, ::5]), lambda: models.depth(img8))
    Image.fromarray(to_8(ctx.depth)).save(os.path.join(dbg, 'depth.png'))

    # 3-4. masks and edges.  Front first (its zone lets the sky key see gaps between branches).
    P = cfg['planes']
    PF, PB, PM = P['front'], P['back'], P.get('mid', {})
    mp = PF.get('matte', {})
    raw_front = plane_mask(PF, ctx)
    forbid = ops_union(PF.get('sub', []), ctx)       # can never join the front (wall, post, roof...)
    ctx.front_zone = dilate(raw_front > 0.5, ctx.r(PF.get('zone_px', 14)))
    b, b_sub, opens = back_plane(PB, ctx)
    if ctx.sky_key is None:
        ctx.sky_key = np.zeros((H, W), F32)
    core = matte(ctx, raw_front, mp, forbid)         # tight matte: the confident part of the object
    core = prune(core, mp.get('prune_px', 0), core > 0.5)
    # Inside the front object, depth describes the object, not what is behind it.  What continues
    # behind it (mid or back) is taken from the nearest pixel outside the object; seen through a gap,
    # sky-coloured pixels always belong to the back.
    fz = ctx.front_zone
    owner_mid = nearest_value(~fz, (b < 0.5).astype(F32))
    own_b, own_m = ops_union(PB.get('own', []), ctx), ops_union(PM.get('own', []), ctx)
    owner_mid = np.where(own_b & fz, 0, np.where(own_m & fz, 1, owner_mid)).astype(F32)   # ownership overrides behind the front
    a1_hidden = cv2.GaussianBlur(owner_mid, (0, 0), 1.0)
    wz = cv2.GaussianBlur(fz.astype(F32), (0, 0), 2.0)
    b = wz * np.maximum(ctx.sky_key, 1 - a1_hidden) + (1 - wz) * b
    b = (b * (1 - b_sub)).astype(F32)
    a1_hidden = np.maximum(a1_hidden, b_sub).astype(F32)
    c_mid = 1 - b                                    # mid coverage at rest, ignoring the front

    def coverage(c2):
        """mid+front coverage c1 and the mid's exact share of what the front leaves visible."""
        c1 = np.maximum(c_mid, c2).astype(F32)
        a1x = np.clip(np.clip(c1 - c2, 0, 1) / np.maximum(1 - c2, 1e-3), 0, 1)
        return c1, a1x

    # 5. reach, from the tight matte (the final front alpha can only be larger, so this is a superset)
    _, a1x_core = coverage(core)
    a1_core = np.where(core > T_ZONE, a1_hidden, a1x_core).astype(F32)
    reach1 = reach(motion, 1, {2: core}, (H, W))
    reach0 = reach(motion, 0, {1: a1_core, 2: core}, (H, W))

    # texture of the visible background around the object (luminance std, 7x7)
    lum = I.mean(-1)
    sd = np.sqrt(np.maximum(cv2.boxFilter(lum * lum, -1, (7, 7)) - cv2.boxFilter(lum, -1, (7, 7)) ** 2, 0))
    gen = core > T_ZONE
    bgv = ~dilate((raw_front > 0.5), ctx.r(mp.get('tex_away_px', 24))) & ~dilate(gen, 3)
    sd_bg = cv2.GaussianBlur(nearest_value(bgv, sd), (0, 0), 3)
    textured = sd_bg > mp.get('tex_t', 0.045)
    keying = mp.get('key', True)
    if keying:
        # smooth background (sky, snow, stucco): footprint a little wider than the matte, keying
        # decides pixel by pixel next to the object.  Textured background: closed silhouette + ring.
        closed = cv2.morphologyEx(gen.astype(np.uint8), cv2.MORPH_CLOSE, disk(ctx.r(mp.get('close_px', 6)))).astype(bool)
        gen = gen | (dilate(raw_front > 0.5, ctx.r(mp.get('zone_gen', 8))) & ~textured) \
            | (dilate(closed, ctx.r(mp.get('ring_tex', 3))) & textured)
        gen &= ~forbid | (core > T_ZONE)
    if mp.get('color_gate'):
        fgc = erode(core > 0.98, 2)
        bgc = dilate(gen, ctx.r(40)) & ~dilate(gen, 3)
        ctx.notes['pf'] = color_prob(I, fgc, bgc)

    # plates: sky-owned hidden back pixels get the smooth sky plate (no LaMa blotches)
    blue = I[..., 2] - np.maximum(I[..., 0], I[..., 1])
    sk = cv2.morphologyEx(((ctx.sky_key > 0.5) & (blue > PB.get('sky_own_blue', 0.04))).astype(np.uint8), cv2.MORPH_OPEN, disk(2))
    n_, lab = cv2.connectedComponents(sk, connectivity=4)
    sk = np.isin(lab, list(set(np.unique(lab[:3])) - {0}))
    use_lama0 = PB.get('fill', 'lama') == 'lama'
    rings = (cfg.get('lama_rings', 1), ctx.r(cfg.get('ring_px', 20)), cfg.get('busy_check', True),
             (ctx.r(6), ctx.r(cfg.get('tone_px', 40))) if cfg.get('tone_match', True) else None,
             cfg.get('lama_coarse_half', True))
    rings0 = rings[:2] + (cfg.get('busy_check_back', rings[2]),) + rings[3:]
    back_excl = ops_union(PB.get('ctx_exclude', []), ctx)
    mid_excl = ops_union(PM.get('ctx_exclude', []), ctx)
    r0 = ctx.r(PB.get('hole_px', 2))
    opening_inner = np.zeros((H, W), bool)
    open_core = np.zeros((H, W), bool)
    for o, m in opens:
        opening_inner |= m > 0.02
        open_core |= m > 0.5
    r_open, r_sub = ctx.r(PB.get('hole_px_open', 0)), ctx.r(PB.get('hole_px_sub', PB.get('hole_px', 2)))

    def back_hole(c1x, supx):
        """Back pixels replaced by the plate: everything covered, plus a ring (`hole_px`) so that no
        antialiased rim stays in the back; inside exact window panes the ring is `hole_px_open`
        (0: the pane edge is exact), around back `sub` objects (a sofa in front of a view) `hole_px_sub`."""
        h = c1x > T_SUP
        return h | (dilate(h, r0) & ~open_core) | (dilate(h, r_open) & open_core) \
            | dilate(b_sub > T_SUP, r_sub) | dilate(supx, r0)
    refl = None
    if opens:   # reflection map of the band around each opening (nearest opening wins)
        best = np.full((H, W), np.inf, F32)
        mx = np.zeros((H, W), F32)
        my = np.zeros((H, W), F32)
        for o, m in opens:
            spec = o['opening']
            s, px, py = reflect_map(ctx, o['poly'], o.get('inset', 0), ctx.r(spec.get('band', 20)), spec.get('margin', 1.0))
            upd = (s > -0.5) & (s <= ctx.r(spec.get('band', 20))) & (s < best)
            best[upd], mx[upd], my[upd] = s[upd], px[upd], py[upd]
        refl = (np.isfinite(best), mx, my)
    fixes = cfg.get('fixes', [])

    def apply_fixes(X, plane, hole, need):
        """Per-scene structural fills of a plate (config `fixes`), in order."""
        fixed = np.zeros((H, W), bool)
        for fx in fixes:
            if fx['plane'] != plane:
                continue
            reg = poly_mask(ctx, [fx['poly']]) > 0.5
            todo = reg & hole & ~fixed & (need if fx.get('need_only', False) else True)
            if not todo.any():
                continue
            if fx['mode'] == 'dir':
                d = [v * ctx.s for v in fx['dir']]
                X, done = dir_fill(X, reg & ~hole, todo, d)
            elif fx['mode'] == 'smooth':
                X = np.where(todo[..., None], push_pull(X, (reg & ~hole).astype(F32)), X)
                done = todo
            elif fx['mode'] == 'lama':
                hd = dilate(hole & reg, ctx.r(fx.get('hole_dilate', 6))) & reg
                if fx.get('exclude'):
                    hd |= ops_union(fx['exclude'], ctx) & reg
                need_l = todo & dilate(need, 2)
                tone = (ctx.r(6), ctx.r(fx.get('tone_px', 40)))
                Xl, done = lama_fill(models, X, hd | ~reg | fixed, need_l, fx.get('rings', 1), ctx.r(fx.get('ring_px', 10)),
                                     fx.get('busy_check', False), tone, False)
                done = need_l
                X = np.where(done[..., None], Xl, X)
            else:
                raise ValueError(fx)
            fixed |= done
            log(f'  fix {plane} {fx["mode"]} {fx.get("label", "")}: {int(done.sum())} px')
        return X

    def fill_plates(hole0, hole1):
        """Clean plates: back X0 under hole0, mid F1 under hole1 (LaMa only within reach).
        Each plate only sees its own plane as context, never a mixed pixel."""
        sky_owner = nearest_value(~hole0, sk.astype(F32)) * hole0
        sky_soft = cv2.GaussianBlur(sky_owner.astype(F32), (0, 0), 2.0)
        need0 = hole0 & reach0 & (sky_owner < 0.5) if use_lama0 else np.zeros_like(hole0)
        if opens:
            need0 &= opening_inner
        X0, d0 = lama_fill(models, I, hole0 | back_excl, need0, *rings0)
        if ctx.sky_plate is not None:
            X0 = np.where(hole0[..., None], sky_soft[..., None] * ctx.sky_plate + (1 - sky_soft[..., None]) * X0, X0)
        for o, m in opens:
            if o['opening'].get('inner') == 'smooth':
                inn = (m > 0.02) & hole0
                if inn.any():
                    X0 = np.where(inn[..., None], push_pull(I, ((m > 0.98) & ~hole0).astype(F32)), X0)
        if refl is not None:
            band, mx, my = refl
            rb = band & hole0
            if rb.any():
                X0 = np.where(rb[..., None], cv2.remap(X0, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT), X0)
        X0 = apply_fixes(X0, 'back', hole0, need0 | (hole0 & reach0))
        need1 = hole1 & reach1 & (a1_hidden > 0.01)
        F1, d1 = lama_fill(models, I, hole1 | (b > 0.02) | mid_excl, need1, *rings)
        F1 = apply_fixes(F1, 'mid', hole1, need1)
        return X0.astype(F32), F1.astype(F32), d0, d1

    def stack(c2, sup2, hole0, X0P, F1P):
        """Exact back and mid layers for a front support sup2 (front alpha c2, ring included)."""
        c1, a1x = coverage(c2)
        X0q = to_f(to_8(np.where(hole0[..., None], X0P, I)))
        vis1 = ~sup2
        a1 = np.where(sup2, a1_hidden, a1x)
        a1 = np.where(vis1 & ~hole0, 0, a1)
        need_a = min_alpha(I, X0q)
        a1 = np.where(vis1 & hole0, np.maximum(a1, np.where(need_a > 0.6 / 255, need_a, 0)), a1)
        a1q = q_up(a1).astype(F32)
        F1 = np.where(vis1[..., None], solve_color(I, X0q, a1q), F1P)
        F1q = to_f(to_8(bleed(F1, a1q)))
        Y1 = a1q[..., None] * F1q + (1 - a1q[..., None]) * X0q
        return X0q, a1q, F1q, Y1

    # 6a. pass A - plates under a generous footprint of the front (the object never leaks into the fill)
    c2 = core
    key = np.zeros((H, W), F32)
    nokey = ops_union([{'rect': r} for r in mp.get('nokey', [])], ctx) | forbid
    if 'solid' in ctx.notes:
        nokey |= ctx.notes['solid']
    if keying:
        c2A = np.maximum(core, gen.astype(F32))
        c1A, _ = coverage(c2A)
        supA = c2A > T_SUP
        h0A, h1A = back_hole(c1A, supA), dilate(supA, ctx.r(3))
        X0A, F1A, _, _ = fill_plates(h0A, h1A)
        _, _, _, Y1A = stack(c2A, supA, h0A, X0A, F1A)
        # 6b. keying, next to the object only: the front takes what differs from the clean plate
        need = min_alpha(I, Y1A)
        if mp.get('plate_trim', True):
            # matte trim: in the partial band, alpha never exceeds what the clean plate needs to explain
            # the pixel (closed-form matting over-softens snow / fabric edges by several px; that band
            # would carry semi-transparent background colour along with the object)
            band = (core > T_SUP) & (core < 0.98)
            lo = cv2.GaussianBlur(need, (0, 0), 0.7)
            trimmed = np.minimum(core, np.maximum(need, lo))
            ctx.notes['trim_px'] = int((band & (trimmed < core - 0.1)).sum())
            core = np.where(band & ~nokey, trimmed, core).astype(F32)
        D = np.abs(I - Y1A).max(-1)
        sel_s = ~textured & (need > mp.get('key_t', 0.06)) & (D > mp.get('key_d0', 0.04) + mp.get('key_k', 2.0) * sd_bg)
        sel_t = textured & (need > 0.6 / 255)
        if 'pf' in ctx.notes:
            sel_t &= ctx.notes['pf'] > mp.get('pf_t', 0.4)
            sel_s &= ctx.notes['pf'] > mp.get('pf_t_smooth', 0.15)
        sel = gen & (sel_s | sel_t) & ~nokey
        sky_zone = dilate(sk, 2) & (b > 0.5)
        n_, lab, st, _ = cv2.connectedComponentsWithStats((sel | (core > 0.5)).astype(np.uint8), connectivity=8)
        small = np.flatnonzero(st[:, cv2.CC_STAT_AREA] < mp.get('key_min_area', 6))
        sel &= ~np.isin(lab, small) | sky_zone
        sel &= dilate(core > 0.5, ctx.r(mp.get('key_link_px', 4))) | (dilate(core > 0.5, ctx.r(mp.get('key_link_px_sky', 4))) & sky_zone)
        key = np.where(sel, need, 0).astype(F32)
        c2 = np.maximum(core, key)
        ctx.notes['key_px'] = int(sel.sum())
    c2 = prune(c2, mp.get('prune_px', 0), core > 0.5)

    # 6c. front support + ring.  The ring (a couple of px around the object) is filled with the
    # plates and the front carries the difference (antialiased rims, rim light, faint needles), so
    # no plate keeps a dotted copy of the silhouette.  Ring pixels where the plate is clearly wrong
    # (needed alpha > ring_cap: a texture mismatch, not a rim) go back to their real value.
    sup = c2 > T_SUP
    rz = (dilate(sup, ctx.r(mp.get('ring_px', 2))) & ~textured) | (dilate(sup, ctx.r(mp.get('ring_px_tex', 1))) & textured)
    ring = rz & ~sup
    c1k, _ = coverage(c2)
    hole1 = dilate(sup, ctx.r(3)) | ring
    hole0 = back_hole(c1k, sup) | ring
    X0P, F1P, done0, done1 = fill_plates(hole0, hole1)
    mid_ring = dilate(c_mid > T_SUP, r0)
    ring_cap = mp.get('ring_cap', 0.5)
    reverted = np.zeros((H, W), bool)
    for it in range(3):
        sup2 = sup | ring
        X0q, a1q, F1q, Y1 = stack(c2, sup2, hole0, X0P, F1P)
        need2 = min_alpha(I, Y1)
        bad = ring & (need2 > ring_cap) & textured & (a1_hidden > 0.5)   # never over the sky / smooth plates
        if it == 2 or not bad.any():
            break
        reverted |= bad
        ring &= ~bad
        hole0 &= ~(bad & (c1k <= T_SUP) & ~mid_ring)
    sup2 = sup | ring

    # 6d. final front: matte (+ key), raised to the minimum alpha that keeps its colour in gamut
    a2 = np.where(sup2, np.maximum(c2, np.where(need2 > 0.6 / 255, need2, 0)), 0).astype(F32)
    a2q = q_up(a2).astype(F32)
    F2 = solve_color(I, Y1, a2q)
    F2q = to_f(to_8(bleed(F2, a2q)))
    c1, _ = coverage(c2)
    comp = a2q[..., None] * F2q + (1 - a2q[..., None]) * Y1
    diff = np.abs(comp * 255 - img8.astype(F32))
    rest = {'mean': round(float(diff.mean()), 4), 'p99': round(float(np.percentile(diff, 99)), 3),
            'max': round(float(diff.max()), 3)}
    log(f'  rest diff (0-255): {rest}')
    raise_px = int(((a2 > c2 + 2 / 255) & sup).sum())
    ring_px = int(ring.sum())

    # QA gates
    g1f, g1f_m = translucency(a2q)
    g1m, g1m_m = translucency(a1q)
    hid0 = c1 > T_SUP
    g2b, g2b_m = plate_specks(X0q, hid0, reach0)
    g2m, g2m_m = plate_specks(F1q, sup, reach1 & (a1_hidden > 0.5))
    gates = {'G1_front_translucent_px': g1f, 'G1_mid_translucent_px': g1m,
             'G2_back_speck_pct': g2b, 'G2_mid_speck_pct': g2m}
    gates['pass'] = bool(g1f <= 150 and g1m <= 150 and g2b <= 0.1 and g2m <= 0.1)
    log(f'  gates: {gates}  raise {raise_px} px, ring {ring_px} px, ring reverted {int(reverted.sum())} px')

    # 7. export
    back8, mid8, front8 = to_8(X0q), np.dstack([to_8(F1q), to_8(a1q)]), np.dstack([to_8(F2q), to_8(a2q)])
    Image.fromarray(back8).save(os.path.join(out, 'back.png'), optimize=True)
    encode(os.path.join(out, 'back.png'), os.path.join(out, 'back.webp'), 'webp', cfg.get('q_back', 85))
    encode(os.path.join(out, 'back.png'), os.path.join(out, 'back.avif'), 'avif', cfg.get('q_back_avif', 60))
    Image.fromarray(mid8, 'RGBA').save(os.path.join(out, 'mid.png'), optimize=True)
    Image.fromarray(front8, 'RGBA').save(os.path.join(out, 'front.png'), optimize=True)
    planes = [{'name': 'back', 'png': 'back.png', 'webp': 'back.webp', 'avif': 'back.avif', 'opaque': True,
               'bbox': [0, 0, W, H], 'speed': motion.speeds[0]}]
    PAD = int(PF.get('pad', 48))
    pads = None
    for name, L, a in (('mid', mid8, a1q), ('front', front8, a2q)):
        x, y, w, h = bbox(a)
        crop_ = L[y:y + h, x:x + w]
        pad = [0, 0, 0, 0]
        if name == 'front':   # edge padding where the object is cut by the image border
            pad = [PAD if x == 0 else 0, PAD if y == 0 else 0, PAD if x + w == W else 0, PAD if y + h == H else 0]
            crop_ = np.pad(crop_, ((pad[1], pad[3]), (pad[0], pad[2]), (0, 0)), mode='edge')
            pads = tuple(pad)
        bb = [x - pad[0], y - pad[1], w + pad[0] + pad[2], h + pad[1] + pad[3]]
        Image.fromarray(crop_, 'RGBA').save(os.path.join(out, f'{name}.crop.png'), optimize=True)
        encode(os.path.join(out, f'{name}.crop.png'), os.path.join(out, f'{name}.crop.webp'), 'webp',
               cfg.get('q_front' if name == 'front' else 'q_mid', 95 if name == 'front' else 92))
        encode(os.path.join(out, f'{name}.crop.png'), os.path.join(out, f'{name}.crop.avif'), 'avif',
               cfg.get('q_front_avif' if name == 'front' else 'q_mid_avif', 70 if name == 'front' else 62))
        planes.append({'name': name, 'full_png': f'{name}.png', 'png': f'{name}.crop.png', 'webp': f'{name}.crop.webp',
                       'avif': f'{name}.crop.avif', 'bbox': bb, 'pad_ltrb': pad, 'speed': motion.speeds[1 if name == 'mid' else 2]})
    planes[-1]['scale'] = [1.0, motion.front_scale]
    Image.fromarray(to_8(Y1)).save(os.path.join(out, 'mobile_back.png'))
    encode(os.path.join(out, 'mobile_back.png'), os.path.join(out, 'mobile_back.webp'), 'webp', 88)
    os.remove(os.path.join(out, 'mobile_back.png'))

    L0 = np.dstack([X0q, np.ones((H, W), F32)])
    L1 = np.dstack([F1q, a1q])
    L2 = np.dstack([F2q, a2q])
    sim = simulate(motion, [L0, L1, L2], out, dbg, pads)
    sim['mobile_worst_hole_pct'] = mobile_check(motion, np.dstack([Y1, np.ones((H, W), F32)]), L2, pads)
    log(f'  sim: {sim}')

    # debug sheets
    ck = checker(H, W)
    over = lambda L: L[..., :3] * L[..., 3:4] + ck * (1 - L[..., 3:4])
    ov = I * 0.55 + 0.45 * np.dstack([c2, 1 - c1, c1 - c2]).clip(0, 1)
    rch = I * 0.5 + 0.5 * np.dstack([reach1 & sup, reach0 & hid0, key > 0]).astype(F32)
    gm = I * 0.4 + 0.6 * np.dstack([dilate(g1f_m | g1m_m, 3), dilate(g2b_m | g2m_m, 3), ring | reverted]).astype(F32)
    sheet(os.path.join(dbg, 'layers.jpg'), [('source', img8), ('masks: R front  G back  B mid', ov),
                                            ('reach: R mid, G back, B key', rch),
                                            ('back X0', X0q), ('mid', over(L1)), ('front', over(L2)),
                                            ('depth', ctx.depth), ('R generous zone  G textured bg  B sky key', np.dstack([gen, textured, ctx.sky_key]).astype(F32)), ('mobile back (mid on back)', Y1),
                                            ('gates: R G1 translucency  G G2 specks  B ring', gm)] + ([('P(object | colour)', ctx.notes['pf'])] if 'pf' in ctx.notes else []))
    np.save(os.path.join(cache, 'alphas.npy'), np.stack([c1, c2, a1q, a2q]).astype(np.float16))
    tri = ctx.notes.get('trimap')
    if tri is not None:   # R object (fg), G unknown band, B background; white = sky seeds
        tm = np.dstack([tri == 1, tri == 0.5, tri == 0]).astype(F32) * 0.6 + I * 0.4
        if 'sky_seeds' in ctx.notes:
            tm[ctx.notes['sky_seeds']] = 1
        Image.fromarray(to_8(tm)).save(os.path.join(dbg, 'trimap.png'))
    Image.fromarray(to_8(np.dstack([forbid, ctx.sky_key, raw_front]).astype(F32))).save(os.path.join(dbg, 'forbid_skykey_raw.png'))
    np.save(os.path.join(cache, 'masks.npy'), np.stack([hole0, hole1, sup, ring, reach0, reach1, forbid]))

    manifest = {
        'scene': sid, 'title': cfg.get('title', ''), 'source': cfg['src'],
        'source_size': list(Image.open(os.path.join(src_dir, cfg['src'])).size),
        'crop': crop, 'watermark': cfg.get('watermark', []), 'upscale': cfg.get('upscale', 'none'),
        'work_size': [W, H],
        'caption': 'Illustration non contractuelle',
        'motion': {'frame_width': motion.frame_w, 'overscan': motion.overscan, 'amp_x': motion.ax_frame,
                   'amp_y': motion.ay_frame, 'speeds': dict(zip(['back', 'mid', 'front'], motion.speeds)),
                   'front_scale': [1.0, motion.front_scale], 'scale_origin': motion.origin,
                   'transform': 'q = o + s*(p - o) + speed*(h*amp_x, v*amp_y) in frame px; h,v in [-1,1]; '
                                'front s in [1, front_scale] (any coupling to the scroll is covered by the fills and the padding)',
                   'source_px_per_frame_px': round(motion.px, 4)},
        'planes': planes,
        'mobile': {'planes': [{'name': 'back+mid', 'file': 'mobile_back.webp', 'speed': motion.mobile['speeds'][0]},
                              {'name': 'front', 'webp': 'front.crop.webp', 'avif': 'front.crop.avif',
                               'bbox': planes[2]['bbox'], 'speed': motion.mobile['speeds'][1]}],
                   'amplitude_factor': motion.mobile['amp']},
        'rest_diff_0_255': rest,
        'checks': sim,
        'gates': gates,
        'alpha_raise': {'front_raised_px': raise_px, 'front_ring_px': ring_px, 'ring_reverted_px': int(reverted.sum()),
                        'key_px': ctx.notes.get('key_px', 0), 'matte_trimmed_px': ctx.notes.get('trim_px', 0)},
        'fill_px': {'mid_lama': int(done1.sum()), 'back_lama': int(done0.sum())},
        'rest_diff_exports_0_255': export_diffs(out, planes, img8),
        'seconds': round(time.time() - t0),
    }
    json.dump(manifest, open(os.path.join(out, 'manifest.json'), 'w'), indent=1, ensure_ascii=False)
    log(f'=== {sid} done in {time.time() - t0:.0f}s')
    return manifest


def merge(a, b):
    out = dict(a)
    for k, v in b.items():
        out[k] = merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) and k != 'planes' else v
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('scenes', nargs='*')
    ap.add_argument('--config', default=os.path.join(HERE, 'layers.json'))
    ap.add_argument('--out', default=os.path.join(V2, 'layers'))
    ap.add_argument('--src-dir', default=os.path.join(V2, 'vefa'))
    ap.add_argument('--no-cache', action='store_true')
    ap.add_argument('--threads', type=int, default=4)
    a = ap.parse_args()
    cfg = json.load(open(a.config))
    scenes = a.scenes or [k for k in cfg['scenes'] if not k.startswith('_')]
    models = Models(a.threads)
    for sid in scenes:
        run_scene(sid, merge(cfg.get('defaults', {}), cfg['scenes'][sid]), models, a.out, a.src_dir, not a.no_cache)


if __name__ == '__main__':
    main()
