// Recette visuelle et mesures : node tools/qa.mjs [dossier_sortie]
// - captures ordinateur (1440×900) et mobile (390×844), avec et sans mouvement ;
// - LCP et CLS en 4G simulée (9 Mb/s, 150 ms) ; octets transférés par type ;
// - régularité du rendu pendant le défilement (intervalles entre images).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const OUT = process.argv[2] || 'qa';
mkdirSync(OUT, { recursive: true });
const PORT = 4179;
const server = spawn(process.execPath, ['tools/serve.mjs', 'site', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const BASE = `http://localhost:${PORT}`;
const browser = await pw.chromium.launch({ args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const report = {};

async function measureLoad(path, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 });
  const bytes = {};
  page.on('response', async (r) => {
    const t = (r.headers()['content-type'] || 'other').split(';')[0];
    const b = Number(r.headers()['content-length']) || (await r.body().catch(() => Buffer.alloc(0))).length;
    bytes[t] = (bytes[t] || 0) + b;
  });
  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(4) }));
  await ctx.close();
  return { ...m, kb: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, Math.round(v / 1024)])) };
}

async function shots(name, path, viewport, { mobile = false, reduced = false, positions = [0] } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (const pos of positions) {
    const y = typeof pos === 'string' ? await page.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect().top + scrollY : 0; }, pos) : Math.round(pos * (pos <= 1 ? H - viewport.height : 1));
    await page.evaluate((y) => { window.scrollTo(0, y); }, y);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/${name}-${String(typeof pos === 'string' ? pos.replace(/[^a-z0-9]/gi, '') : Math.round(pos * 100)).padStart(3, '0')}.jpg`, quality: 70 });
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await ctx.close();
  return { errors, overflow, height: H };
}

async function smoothness(path) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__f = []; let last = performance.now(); const tick = (t) => { window.__f.push(t - last); last = t; if (window.__f.length < 600) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  for (let i = 0; i < 90; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(40); }
  await page.waitForTimeout(1500);
  const f = await page.evaluate(() => window.__f.slice(5));
  await ctx.close();
  const sorted = [...f].sort((a, b) => a - b);
  const p = (q) => +sorted[Math.floor(q * (sorted.length - 1))].toFixed(1);
  return { frames: f.length, median_ms: p(0.5), p95_ms: p(0.95), over_33ms: f.filter((x) => x > 33.4).length };
}

const D = { width: 1440, height: 900 }, M = { width: 390, height: 844 };
report.load_home_desktop = await measureLoad('/', D, false);
report.load_home_mobile = await measureLoad('/', M, true);
report.load_chalet_mobile = await measureLoad('/vefa-la-rouya/', M, true);
report.home_desktop = await shots('home-d', '/', D, { positions: [0, 450, 900, 1600, 2600, '#a-vendre', '.listing:nth-of-type(1)', '.listing:nth-of-type(2)', '.sold', '.pano__track', 0.62, '.map', '#construire', '.ferme', '.works', '.figures', '.quote', 1] });
report.home_mobile = await shots('home-m', '/', M, { mobile: true, positions: [0, 400, 900, 1700, '#a-vendre', '.listing', '.pano__track', '.map', '#construire', '.ferme', '.figures', 1] });
report.home_reduced = await shots('home-r', '/', D, { reduced: true, positions: [0, '#a-vendre', 1] });
report.home_reduced_mobile = await shots('home-rm', '/', M, { mobile: true, reduced: true, positions: [0] });
report.chalet = await shots('chalet-d', '/vefa-serre-d-orchis/', D, { positions: [0, 0.35, 1] });
report.chalet_m = await shots('chalet-m', '/vefa-la-rouya/', M, { mobile: true, positions: [0, 0.3] });
report.sale = await shots('sale-d', '/vente-sur-plan/', D, { positions: [0, 0.4] });
report.build = await shots('build-d', '/savoir-faire/', D, { positions: [0, 0.5] });
report.en = await shots('en-d', '/en/', D, { positions: [0] });
report.smooth_home = await smoothness('/');
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
await browser.close();
server.kill();
