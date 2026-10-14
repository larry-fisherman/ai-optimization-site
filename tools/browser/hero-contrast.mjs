// Worst-case contrast of the hero text over the video. For BOTH renditions, at 375, 768 and
// 1440: pause, seek every 0.25 s through the clip (plus every 0.1 s over the last 1.6 s and
// the last frame before the loop point), screenshot with the hero text made transparent
// (backgrounds stay), and take the brightest pixel under each text box. The text colour is
// composited over that pixel (fg-soft is Mist at .66). Usage: node hero-contrast.mjs [--target 4.8]
import { launch, page, sleep, check, done } from './_lib.mjs';
import crypto from 'crypto';
const ti = process.argv.indexOf('--target'), TARGET_SUB = ti > 0 ? +process.argv[ti + 1] : 4.8;
const b = await launch();
const worst = {}; let frames = 0, stale = 0, timeouts = 0;
for (const [w, h] of [[375, 812], [768, 1024], [1440, 900]]) {
  const p = await page(b, w, h, { touch: w < 1000 });
  await p.waitForSelector('.hero__video.is-playing', { timeout: 20000 });
  const boxes = await p.evaluate(() => {
    const rects = n => { const r = document.createRange(); r.selectNodeContents(n); return [...r.getClientRects()].map(x => [x.left, x.top, x.width, x.height]); };
    const q = s => document.querySelector(s), col = e => getComputedStyle(e).color, h1 = q('.hero__title'), em = h1.querySelector('em');
    return {
      'h1': [rects(h1.firstChild), col(h1), 3], 'h1 em': [rects(em), col(em), 3],
      'sub': [rects(q('.hero__sub')), col(q('.hero__sub')), 4.5], 'CTA': [rects(q('.hero .button')), col(q('.hero .button')), 4.5],
      'cue': [rects(q('.hero__cue')), col(q('.hero__cue')), 4.5], 'badge': [rects(q('.hero__badge')), col(q('.hero__badge')), 4.5],
      'Pause/Play': [rects(q('.hero__media-toggle').firstChild), col(q('.hero__media-toggle')), 4.5],
    };
  });
  await p.addStyleTag({ content: '.hero__inner, .hero__inner * { color: transparent !important; text-decoration-color: transparent !important; } .hero__badge::before { opacity: 0 !important; }' });
  for (const file of ['assets/hero/ocean-540.mp4', 'assets/hero/ocean-720.mp4']) {
    // loaded as a blob, so every seek is local (a server without Range support can't seek)
    const dur = await p.evaluate(async f => { const v = document.querySelector('.hero__video'); v.pause();
      const url = URL.createObjectURL(await (await fetch(f)).blob());
      return new Promise(r => { v.addEventListener('loadeddata', () => r(v.duration), { once: true }); v.src = url; v.load(); }); }, file);
    const ts = new Set(); for (let t = 0; t < dur - 0.05; t += 0.25) ts.add(+t.toFixed(3));
    for (let t = Math.max(0, dur - 1.6); t < dur - 0.05; t += 0.1) ts.add(+t.toFixed(3));
    ts.add(+(dur - 0.034).toFixed(3)); // the last frame before the loop point
    // drop times under one frame (25–30 fps) after the previous one: they'd show the same frame
    const times = [...ts].sort((x, y) => x - y).filter((t, i, a) => i === 0 || t - a[i - 1] >= 0.045);
    let prev = '';
    for (const t of times) {
      // wait until the seeked frame is actually presented before the screenshot
      const how = await p.evaluate(t => new Promise(r => { const v = document.querySelector('.hero__video');
        const to = setTimeout(() => r('timeout'), 3000);
        v.requestVideoFrameCallback(() => requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(to); r('frame'); })));
        v.currentTime = t; }), t);
      if (how !== 'frame') { timeouts++; if (process.env.DEBUG) console.log('no frame', w, file, t); }
      const shot = await p.screenshot({ encoding: 'base64' });
      const hash = crypto.createHash('md5').update(shot).digest('hex'); if (hash === prev) { stale++; if (process.env.DEBUG) console.log('same', w, file, t); } prev = hash; frames++;
      const res = await p.evaluate(async (b64, boxes) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }), ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
        const lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }, L = (r, g, b) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
        const out = {};
        for (const [k, [rects, color]] of Object.entries(boxes)) {
          const [r, g, bb, a = 1] = color.match(/[\d.]+/g).map(Number); let best = null, bl = -1;
          for (const [x, y, w, h] of rects) { if (w < 1 || h < 1) continue;
            const d = ctx.getImageData(Math.round(x), Math.round(y), Math.round(w), Math.round(h)).data;
            for (let i = 0; i < d.length; i += 4) { const l = L(d[i], d[i + 1], d[i + 2]); if (l > bl) { bl = l; best = [d[i], d[i + 1], d[i + 2]]; } } }
          const l1 = L(r * a + best[0] * (1 - a), g * a + best[1] * (1 - a), bb * a + best[2] * (1 - a));
          out[k] = { cr: (Math.max(l1, bl) + .05) / (Math.min(l1, bl) + .05), px: '#' + best.map(v => v.toString(16).padStart(2, '0')).join('') };
        }
        return out;
      }, shot, boxes);
      for (const [k, v] of Object.entries(res)) if (!worst[k] || v.cr < worst[k].cr) worst[k] = { ...v, w, t, file: file.split('/').pop(), need: boxes[k][2] };
    }
  }
  await p.close();
}
console.log(`${frames} frames sampled (${stale} identical to the previous sample, ${timeouts} without a presented frame)`);
check('every sample is a freshly presented frame', stale === 0 && timeouts === 0);
for (const [k, v] of Object.entries(worst)) {
  const need = k === 'sub' ? Math.max(v.need, TARGET_SUB) : v.need;
  check(`${k.padEnd(10)} worst ${v.cr.toFixed(2)}:1 (need ${need})`, v.cr >= need, `${v.file} at ${v.w}px, t=${v.t}s, over ${v.px}`);
}
await b.close();
done();
