// The home hero's background video: rendition choice, Pause/Play, off-screen and hidden-tab
// pause, live reduced motion, Save-Data, no JS, print, failure, autoplay refusal, overlap.
import { launch, page, sleep, check, done } from './_lib.mjs';
const b = await launch();
const st = p => p.evaluate(() => { const v = document.querySelector('.hero__video'), t = document.querySelector('.hero__media-toggle');
  return { src: v.currentSrc, t: v.currentTime, paused: v.paused, playing: v.classList.contains('is-playing'), hidden: t.hidden || getComputedStyle(t).display === 'none',
    label: t.firstChild.data, isPaused: t.classList.contains('is-paused'), opacity: getComputedStyle(v).opacity, poster: getComputedStyle(document.querySelector('.hero__poster')).display }; });
const playing = p => p.waitForSelector('.hero__video.is-playing', { timeout: 20000 }).then(() => true, () => false);
const rm = (p, on) => p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: on ? 'reduce' : 'no-preference' }]);
const toServices = p => p.evaluate(() => document.querySelector('#services').scrollIntoView({ behavior: 'instant' }));
const toTop = p => p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
const conn = c => `Object.defineProperty(navigator, 'connection', { value: ${JSON.stringify(c)} })`;

// rendition by CSS width (SD below 1024 px), never HD on cellular / 3G
for (const [w, h, o, want] of [[1440, 900, {}, 'ocean-720'], [1024, 768, {}, 'ocean-720'], [375, 812, { touch: true, dpr: 3 }, 'ocean-540'],
  [430, 932, { touch: true, dpr: 3 }, 'ocean-540'], [412, 915, { touch: true, dpr: 3.5 }, 'ocean-540'], [1440, 900, { init: conn({ type: 'cellular', effectiveType: '4g' }) }, 'ocean-540'],
  [1440, 900, { init: conn({ effectiveType: '3g' }) }, 'ocean-540']]) {
  const p = await page(b, w, h, o); const ok = await playing(p); const a = await st(p);
  check(`${w}px DPR ${o.dpr || 1}${o.init ? ' ' + o.init.match(/value: (.*) \}\)/)[1] : ''}: ${want}`, ok && a.src.includes(want), a.src.split('/').pop());
  await p.close();
}
{
  const p = await page(b, 1440, 900); await playing(p);
  const a = await st(p); await sleep(2000); const c = await st(p);
  check('plays: time advances, faded in, toggle visible', c.t > a.t + 1 && c.playing && c.opacity === '1' && !c.hidden);
  const ax = await p.accessibility.snapshot({ root: await p.$('.hero__media-toggle') });
  check('toggle name "Pause background video"', ax?.name === 'Pause background video', ax?.name);
  await p.evaluate(() => document.querySelector('.hero .button').focus());
  const seq = []; for (let i = 0; i < 2; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => document.activeElement.className)); }
  check('Tab order: CTA → cue → toggle', seq[0].includes('hero__cue') && seq[1].includes('hero__media-toggle'), seq.join(' → '));
  // off-screen and hidden tab while playing
  await toServices(p); await sleep(500); check('off-screen: paused', (await st(p)).paused);
  await toTop(p); await sleep(800); let s = await st(p); check('back on screen: plays, label Pause', !s.paused && s.label === 'Pause');
  const other = await b.newPage(); await other.bringToFront(); await sleep(400);
  check('hidden tab: paused', (await st(p)).paused); await other.close(); await p.bringToFront(); await sleep(600);
  check('visible again: plays', !(await st(p)).paused);
  // user pause sticks through every other state change
  await p.click('.hero__media-toggle'); await sleep(300);
  const d = await st(p); await sleep(800); const e = await st(p);
  check('click: paused, label Play, time stops', d.paused && d.label === 'Play' && d.isPaused && e.t === d.t);
  await toServices(p); await sleep(400); await toTop(p); await sleep(700); s = await st(p);
  check('user pause + off-screen and back: still paused, Play shown', s.paused && s.label === 'Play' && !s.hidden);
  const o2 = await b.newPage(); await o2.bringToFront(); await sleep(300); await o2.close(); await p.bringToFront(); await sleep(500); s = await st(p);
  check('user pause + hidden tab and back: still paused, Play shown', s.paused && s.label === 'Play' && !s.hidden);
  await rm(p, true); await sleep(400); s = await st(p);
  check('user pause + reduce on: poster, toggle hidden', s.paused && !s.playing && s.hidden);
  await rm(p, false); await sleep(600); s = await st(p);
  check('user pause + reduce off: still paused, Play shown (not a dead end)', s.paused && !s.hidden && s.label === 'Play' && s.isPaused);
  await p.click('.hero__media-toggle'); await sleep(1000); s = await st(p);
  check('Play: resumes, label Pause, faded in', !s.paused && s.playing && s.label === 'Pause');
  // reduce on / off while playing
  await rm(p, true); await sleep(400); s = await st(p);
  check('reduce on: paused, poster, toggle hidden', s.paused && !s.playing && s.hidden);
  await rm(p, false); await sleep(1200); s = await st(p);
  check('reduce off: plays again, Pause shown', !s.paused && s.playing && !s.hidden && s.label === 'Pause');
  check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
{
  const p = await page(b, 1440, 900, { rm: true }); await sleep(2500); const s = await st(p);
  check('reduced motion at load: no .mp4 request, poster, no toggle', p.mp4.length === 0 && s.hidden && s.poster !== 'none', `${p.mp4.length} requests`);
  await rm(p, false); await sleep(2500); const s2 = await st(p);
  check('then reduce off: loads and plays', !s2.paused && s2.playing && p.mp4.length > 0);
  await p.close();
}
for (const [name, o] of [['Save-Data', { init: conn({ saveData: true, effectiveType: '4g' }) }], ['2G', { init: conn({ effectiveType: 'slow-2g' }) }], ['no JS', { nojs: true }]]) {
  const p = await page(b, 1440, 900, o); await sleep(2500);
  const s = await p.evaluate(() => ({ t: getComputedStyle(document.querySelector('.hero__media-toggle')).display, img: document.querySelector('.hero__poster').naturalWidth }));
  check(`${name}: no .mp4 request, poster, no toggle`, p.mp4.length === 0 && s.t === 'none' && s.img > 0, `${p.mp4.length} requests`);
  await p.close();
}
{
  const p = await page(b, 1440, 900); await playing(p); await p.emulateMediaType('print');
  const s = await p.evaluate(() => [getComputedStyle(document.querySelector('.hero__media')).display, getComputedStyle(document.querySelector('.hero__media-toggle')).display]);
  check('print: video, poster and toggle hidden', s.every(x => x === 'none'), s.join(','));
  await p.close();
}
// failure: the file 404s → poster only, no toggle, no endless retries
{
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
  await p.setRequestInterception(true);
  let n = 0; p.on('request', r => { if (r.url().endsWith('.mp4')) { n++; r.respond({ status: 404, body: 'nope' }); } else r.continue(); });
  await p.goto((process.env.BASE || 'http://127.0.0.1:8000/'), { waitUntil: 'load' }); await sleep(2500);
  await toServices(p); await sleep(300); await toTop(p); await sleep(800);
  const s = await st(p);
  check('video 404: poster, toggle hidden, not retried', s.hidden && !s.playing && s.poster !== 'none' && n <= 1, `${n} requests`);
  await p.close();
}
// autoplay refused (Low Power Mode, policy): poster + Play
{
  const p = await page(b, 1440, 900, { init: () => { HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('refused', 'NotAllowedError')); }; } });
  await sleep(2500); const s = await st(p);
  check('autoplay refused: poster, Play shown', !s.playing && !s.hidden && s.label === 'Play');
  await p.close();
}
// AbortError (paused before it started, e.g. scrolled away while buffering) is not a user pause
{
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
  await p.setRequestInterception(true);
  p.on('request', r => { if (r.url().endsWith('.mp4')) setTimeout(() => r.continue().catch(() => {}), 2500); else r.continue(); });
  await p.goto((process.env.BASE || 'http://127.0.0.1:8000/'), { waitUntil: 'load' }); await sleep(300);
  await toServices(p); await sleep(600);
  const s = await st(p);
  check('scrolled away while buffering: no Play label, no toggle yet', s.hidden && s.label === 'Pause' && !s.isPaused, `${s.label}, hidden ${s.hidden}`);
  await toTop(p); await sleep(4000);
  const s2 = await st(p);
  check('back on screen: plays, label Pause', !s2.paused && s2.label === 'Pause' && !s2.hidden);
  await p.close();
}
// the toggle overlaps no hero text
for (const [w, h] of [[320, 568], [375, 667], [375, 812], [768, 1024], [1440, 900]]) {
  const p = await page(b, w, h, { touch: w < 1000 }); await playing(p);
  const hit = await p.evaluate(() => { const box = e => e.getBoundingClientRect(), t = box(document.querySelector('.hero__media-toggle'));
    return ['.hero__badge', '.hero__title', '.hero__sub', '.hero .button', '.hero__cue'].filter(s => { const r = box(document.querySelector(s)); return r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top; }); });
  check(`toggle overlaps nothing at ${w}x${h}`, hit.length === 0, hit.join(','));
  await p.close();
}
await b.close();
done();
