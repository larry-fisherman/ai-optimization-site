// Worst-case contrast over the ocean band (site header on all 11 pages, inner-page heroes on 10).
// For each page at 375, 768 and 1440 (and 960, where the header's "Technologies" first shows):
//  - text: screenshot with all text made transparent (backgrounds stay), take the brightest pixel
//    under each text box and composite the
//    text colour over it. Small text needs 4.5:1, large text (≥ 24px, or ≥ 18.66px bold) 3:1.
//  - hover: "Get started" and Menu hovered, the same measure on their hover backing.
//  - focus rings (375, 768, 1440 only): focus each header control, then take the brightest pixel
//    in the offset gap inside the ring and in the 2px just outside it, 1px clear of the ring, all
//    the way round (rounded corners and pill ends included). Needs 3:1 against the ring colour.
//  Text boxes are content boxes (the "Technologies" divider is border, so it is not sampled); pill
//  controls use their straight middle, 2px inside the border.
// Reduced motion is on, so nothing animates under the screenshot. Usage: node band-contrast.mjs
import { launch, page, sleep, check, done } from './_lib.mjs';
const PAGES = ['index.html', '404.html', 'about.html', 'ai-visibility-audit.html', 'answer-ready-content.html',
  'brand-signal-monitoring.html', 'contact.html', 'internal-ai-readiness.html', 'machine-readable-foundations.html',
  'packages.html', 'privacy.html'];
const HEADER = ['.site-header .wordmark__text', '.site-header .wordmark__sub', '.site-nav__list a', '.site-header__cta', '.site-nav__toggle'];
const HERO = ['.page-hero__title', '.page-hero__title em', '.page-hero__lede'];
const PILL = /cta|toggle/;
const FOCUS = ['.site-header .wordmark', '.site-nav__list a', '.site-header__cta', '.site-nav__toggle'];
const HIDE_TEXT = '*{color:transparent!important;text-decoration-color:transparent!important;text-shadow:none!important;caret-color:transparent!important} .site-nav__list a{background-size:0 0!important}';

// in-page: decode a screenshot once and expose a pixel reader
const decode = (p, b64) => p.evaluate(async b64 => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0); window.__shot = c;
}, b64);

// brightest pixel (by relative luminance) in a list of rects, read from window.__shot
const brightest = (p, rects) => p.evaluate(rects => {
  const c = window.__shot, x = c.getContext('2d', { willReadFrequently: true });
  const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  let best = null, bl = -1;
  for (let [l, t, w, h] of rects) {
    l = Math.max(0, Math.round(l)); t = Math.max(0, Math.round(t)); w = Math.min(Math.round(w), c.width - l); h = Math.min(Math.round(h), c.height - t);
    if (w < 1 || h < 1) continue;
    const d = x.getImageData(l, t, w, h).data;
    for (let i = 0; i < d.length; i += 4) { const L = .2126 * lin(d[i]) + .7152 * lin(d[i + 1]) + .0722 * lin(d[i + 2]); if (L > bl) { bl = L; best = [d[i], d[i + 1], d[i + 2]]; } }
  }
  return best;
}, rects);

// brightest pixel next to a focus ring. The ring follows the border box's rounded shape, grown by
// the offset, so each pixel is classed by its distance d outside the rounded border box: the
// offset gap inside the ring (0.5 ≤ d ≤ off − 1) and 2px outside it (off + w + 1 ≤ d ≤ off + w + 3),
// each 1px clear of the ring, so no ring pixel (anti-aliased edges included) counts as background.
const ringBackground = (p, [l, t, r, bo], rad, off, wd) => p.evaluate((l, t, r, bo, rad, off, wd) => {
  const c = window.__shot, x = c.getContext('2d', { willReadFrequently: true }), m = Math.ceil(off + wd + 4);
  const X = Math.max(0, Math.floor(l) - m), Y = Math.max(0, Math.floor(t) - m);
  const W = Math.min(c.width, Math.ceil(r) + m) - X, H = Math.min(c.height, Math.ceil(bo) + m) - Y;
  const d = x.getImageData(X, Y, W, H).data, cx = (l + r) / 2, cy = (t + bo) / 2, hw = (r - l) / 2 - rad, hh = (bo - t) / 2 - rad;
  const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  let best = null, bl = -1;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const dx = Math.max(Math.abs(X + i + .5 - cx) - hw, 0), dy = Math.max(Math.abs(Y + j + .5 - cy) - hh, 0), dist = Math.hypot(dx, dy) - rad;
    if (!((dist >= .5 && dist <= off - 1) || (dist >= off + wd + 1 && dist <= off + wd + 3))) continue;
    const k = (j * W + i) * 4, L = .2126 * lin(d[k]) + .7152 * lin(d[k + 1]) + .0722 * lin(d[k + 2]);
    if (L > bl) { bl = L; best = [d[k], d[k + 1], d[k + 2]]; }
  }
  return best;
}, l, t, r, bo, rad, off, wd);

const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const L = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const rgba = s => { const m = s.match(/[\d.]+/g).map(Number); return [m.slice(0, 3), m[3] ?? 1]; };
const over = ([c, a], bg) => c.map((v, i) => v * a + bg[i] * (1 - a));
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

// text boxes for a set of selectors (visible, above the fold, not inside an opaque panel)
const targets = (p, sels) => p.evaluate((sels, pill) => {
  const out = [];
  for (const s of sels) for (const e of document.querySelectorAll(s)) {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || !r.width || !r.height || r.top > innerHeight) continue;
    if (e.closest('.panel, .contact-form, form')) continue;
    // pills: the straight middle, inset by the end radius and 2px from the 1px border, so no pixel
    // outside the pill (or of its border) is sampled; anything else: the content box (no divider)
    const px = n => parseFloat(cs[n]) || 0, box = new RegExp(pill).test(s)
      ? [r.left + r.height / 2, r.top + 2, r.width - r.height, r.height - 4]
      : [r.left + px('borderLeftWidth') + px('paddingLeft'), r.top + px('borderTopWidth') + px('paddingTop'),
         r.width - px('borderLeftWidth') - px('paddingLeft') - px('borderRightWidth') - px('paddingRight'),
         r.height - px('borderTopWidth') - px('paddingTop') - px('borderBottomWidth') - px('paddingBottom')];
    const fs = parseFloat(cs.fontSize), fw = +cs.fontWeight;
    out.push({ s, txt: e.textContent.trim().slice(0, 20), r: box, color: cs.color, large: fs >= 24 || (fs >= 18.66 && fw >= 700) });
  }
  return out;
}, sels, PILL.source);

const worst = {}; // key -> { cr, need, at }
const note = (key, cr, need, at) => { if (!worst[key] || cr < worst[key].cr) worst[key] = { cr, need, at }; };

const b = await launch();
for (const path of PAGES) for (const [w, h] of [[375, 812], [768, 1024], [960, 900], [1440, 900]]) {
  const p = await page(b, w, h, { path, rm: true });
  await p.evaluate(() => document.fonts.ready); await sleep(300);
  const sels = w === 960 ? ['.site-header .wordmark__sub'] : [...HEADER, ...(path === 'index.html' ? [] : HERO)];
  const ts = await targets(p, sels);
  const hoverBoxes = [];
  if (w !== 960) for (const s of ['.site-header__cta', '.site-nav__toggle']) {
    const t = ts.find(t => t.s === s); if (t) hoverBoxes.push(t);
  }
  const focusables = w === 960 ? [] : await p.evaluate(sels => {
    const out = [];
    for (const s of sels) document.querySelectorAll(s).forEach((e, i) => { if (getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width) out.push([s, i]); });
    return out;
  }, FOCUS);
  await p.addStyleTag({ content: HIDE_TEXT }); await sleep(100);
  await decode(p, await p.screenshot({ encoding: 'base64' }));
  for (const t of ts) {
    const bg = await brightest(p, [t.r]); if (!bg) continue;
    note(t.s, ratio(over(rgba(t.color), bg), bg), t.large ? 3 : 4.5, `${path}@${w} "${t.txt}" over ${hex(bg)}`);
  }
  for (const t of hoverBoxes) {
    await p.hover(t.s); await sleep(150);
    await decode(p, await p.screenshot({ encoding: 'base64' }));
    const bg = await brightest(p, [t.r]);
    note(t.s + ':hover', ratio(over(rgba(t.color), bg), bg), 4.5, `${path}@${w} over ${hex(bg)}`);
    await p.mouse.move(0, h - 1); await sleep(150);
  }
  for (const [s, i] of focusables) {
    await p.evaluate((s, i) => document.querySelectorAll(s)[i].focus({ preventScroll: true }), s, i);
    await sleep(100); // reduced motion still runs .01ms transitions: read the settled style
    const f = await p.evaluate((s, i) => {
      const e = document.querySelectorAll(s)[i];
      const cs = getComputedStyle(e), r = e.getBoundingClientRect();
      return { ok: e.matches(':focus-visible'), ring: cs.outlineColor, rad: Math.min(parseFloat(cs.borderTopLeftRadius) || 0, r.width / 2, r.height / 2), off: parseFloat(cs.outlineOffset), wd: parseFloat(cs.outlineWidth), r: [r.left, r.top, r.right, r.bottom], txt: e.textContent.trim().slice(0, 20) || e.getAttribute('aria-label') };
    }, s, i);
    if (!f.ok) { check(`${s} "${f.txt}" shows a focus ring on ${path} at ${w}`, false); continue; }
    await decode(p, await p.screenshot({ encoding: 'base64' }));
    const bg = await ringBackground(p, f.r, f.rad, f.off, f.wd);
    const ring = rgba(f.ring)[0];
    note('focus ring ' + s, ratio(ring, bg), 3, `${path}@${w} "${f.txt}" ring ${hex(ring)} vs ${hex(bg)}`);
    await p.evaluate(() => document.activeElement.blur());
  }
  await p.close();
}
await b.close();
for (const [k, v] of Object.entries(worst)) check(`${k}: worst ${v.cr.toFixed(2)} ≥ ${v.need}`, v.cr >= v.need, v.at);
done();
