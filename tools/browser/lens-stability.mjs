// The Lens answer card and frame keep one height: pending → answered, across
// Retail/Clinic/SaaS and Human/Machine, with motion and reduced motion, so
// .shift__close never moves. Also: no ResizeObserver loop error, one reserve per resize.
import { launch, page, sleep, check, done } from './_lib.mjs';
const b = await launch();
const widths = [[320, 640], [340, 720], [375, 812], [768, 1024], [1440, 900]];
const poll = p => p.evaluate(() => { window.__h = []; window.__iv = setInterval(() => {
  const a = document.querySelector('.answer'), c = document.querySelector('.shift__close');
  // .shift__close's layout position (offsetTop chain: reveal transforms don't count)
  // relative to the Lens, so font loading in the hero above doesn't count either
  const top = e => { let y = 0; for (; e; e = e.offsetParent) y += e.offsetTop; return y; };
  window.__h.push([a.getBoundingClientRect().height, top(c) - top(document.querySelector('#lens'))]); }, 50); });
const stop = p => p.evaluate(() => { clearInterval(window.__iv); const h = window.__h;
  const r = k => Math.max(...h.map(x => x[k])) - Math.min(...h.map(x => x[k])); return { n: h.length, card: r(0), close: r(1) }; });
for (const rm of [false, true]) for (const [w, h] of widths) {
  const p = await page(b, w, h, { rm, touch: w < 1000, wait: 'domcontentloaded' });
  await p.evaluate(() => document.querySelector('#lens').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await poll(p);
  // through the first scan's pending → answered (motion), then every switch
  for (let i = 0; i < 150; i++) { await sleep(100); if (await p.evaluate(() => document.querySelector('#lens').dataset.answer === 'resolved' && document.querySelector('.lens').classList.contains('is-ready'))) break; }
  for (const sel of ['.lens__tab[data-biz="1"]', '.lens__tab[data-biz="2"]', '.lens__tab[data-biz="0"]', '.lens__view:nth-child(2)', '.lens__view:nth-child(1)']) {
    await p.evaluate(s => document.querySelector(s).click(), sel); await sleep(1300);
  }
  const r = await stop(p);
  check(`${rm ? 'reduced' : 'motion '} ${w}: card and .shift__close steady`, r.card <= 0.01 && r.close <= 0.01, `card Δ ${r.card.toFixed(2)} px, .shift__close Δ ${r.close.toFixed(2)} px, ${r.n} samples`);
  check(`${rm ? 'reduced' : 'motion '} ${w}: no page errors`, p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// resize / rotation: reserve recomputes once per width change, no RO loop error, nothing clipped
{
  const p = await page(b, 1440, 900);
  await sleep(800);
  await p.evaluate(() => { window.__m = 0; new MutationObserver(r => { window.__m += r.length; }).observe(document.querySelector('#lens'), { attributes: true, attributeFilter: ['style'] }); });
  for (const [w, h] of [[1024, 768], [768, 1024], [375, 812], [812, 375], [1440, 900]]) {
    await p.evaluate(() => { window.__m = 0; });
    await p.setViewport({ width: w, height: h }); await sleep(700);
    const r = await p.evaluate(() => ({ passes: window.__m / 8, fit: [...document.querySelectorAll('.answer p > span:last-child, .answer__source .chip')].every(s => s.scrollHeight <= s.clientHeight + 1) }));
    check(`resize to ${w}x${h}: one reserve pass, text fits`, r.passes === 1 && r.fit, `passes ${r.passes}`);
  }
  check('resize: no "ResizeObserver loop" or other errors', p.errors.length === 0, p.errors.join(' | '));
  // a running transition is not snapped: resize while the Human/Machine pill slides
  await p.evaluate(() => document.querySelector('#lens').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await sleep(400);
  await p.evaluate(() => { window.__m = 0; document.querySelector('.lens__view:nth-child(2)').click(); });
  await sleep(40);
  await p.setViewport({ width: 1000, height: 900 }); await sleep(80); // a width the frame actually changes at
  const mid = await p.evaluate(() => ({ running: document.querySelector('#lens').getAnimations({ subtree: true }).filter(a => a.transitionProperty && a.playState === 'running').map(a => a.transitionProperty), passes: window.__m / 8 }));
  await sleep(900);
  const after = await p.evaluate(() => window.__m / 8);
  check('resize during a transition: reserve waits for it, then runs once', mid.running.length > 0 && mid.passes === 0 && after === 1, `running at +80ms: ${mid.running.join(',') || 'none'}; passes then ${mid.passes}, later ${after}`);
  await p.close();
}
await b.close();
done();
