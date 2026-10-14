// axe-core on home (video playing at 1440 and 375 touch, reduced motion, no JS) and contact.
import { launch, page, sleep, check, done, require } from './_lib.mjs';
import fs from 'fs';
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const b = await launch();
for (const [name, o] of [['home, video playing, 1440', { w: 1440, h: 900, play: true }], ['home, video playing, 375 touch', { w: 375, h: 812, touch: true, play: true }],
  ['home, reduced motion', { w: 1440, h: 900, rm: true }], ['home, no JS', { w: 1440, h: 900, nojs: true }],
  ['contact, 1440', { w: 1440, h: 900, path: 'contact.html' }], ['contact, 375 touch', { w: 375, h: 812, touch: true, path: 'contact.html' }]]) {
  const p = await page(b, o.w, o.h, { ...o, wait: 'networkidle0' });
  if (o.play) await p.waitForSelector('.hero__video.is-playing', { timeout: 20000 }).catch(() => {});
  await sleep(800);
  if (o.nojs) await p.setJavaScriptEnabled(true); // only so axe can be injected; the page's own scripts never ran
  await p.evaluate(axeSrc);
  const v = await p.evaluate(async () => (await axe.run(document)).violations.map(v => `${v.id} ×${v.nodes.length}`));
  check(`axe ${name}: 0 violations`, v.length === 0, v.join(', '));
  await p.close();
}
await b.close();
done();
