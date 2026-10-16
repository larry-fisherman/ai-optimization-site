// Contact page: heading left / form right at 1440×900 with tops aligned and Send above the
// fold; stacked in reading order with no overflow at 768 and 375; tab order; submit success and error states
// (the Formspree POST is answered locally, nothing is sent).
import { launch, page, sleep, check, done } from './_lib.mjs';
const b = await launch();
for (const [w, h] of [[1440, 900], [768, 1024], [375, 812]]) {
  const p = await page(b, w, h, { path: 'contact.html', touch: w < 1000, wait: 'networkidle0' });
  let reply = { ok: true }, posted = null;
  await p.setRequestInterception(true);
  p.on('request', req => {
    if (req.method() === 'POST' && req.url().startsWith('https://formspree.io/')) { posted = req.postData(); req.respond({ status: reply.errors ? 422 : 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(reply) }); }
    else req.continue();
  });
  const r = await p.evaluate(() => {
    const q = s => { const r = document.querySelector(s).getBoundingClientRect(); return { top: r.top, right: r.right, bottom: r.bottom, left: r.left }; };
    const order = ['h1', '.page-hero__lede', '#cf-website', '#cf-email', '#cf-message', '.contact-form [type=submit]', '.contact__meta', '.contact-form__fallback'].map(s => q(s).top);
    return { h1: q('h1'), panel: q('.contact__panel'), send: q('.contact-form [type=submit]'), vh: innerHeight, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, order };
  });
  if (w === 1440) {
    check('1440: heading left, form card right', r.h1.right <= r.panel.left);
    check('1440: tops aligned within 8 px', Math.abs(r.h1.top - r.panel.top) <= 8, `Δ ${Math.abs(r.h1.top - r.panel.top).toFixed(1)} px`);
    check('1440×900: Send visible without scrolling', r.send.bottom <= r.vh, `Send bottom ${Math.round(r.send.bottom)}`);
  } else check(`${w}: stacked in reading order`, r.order.every((y, i, a) => !i || y > a[i - 1]));
  check(`${w}: no horizontal overflow`, r.over === 0);
  const seq = [];
  for (let i = 0; i < 30 && !seq.includes('Send'); i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => { const e = document.activeElement; return e.id || e.textContent.trim().slice(0, 12); })); }
  const form = seq.filter(x => ['cf-website', 'cf-email', 'cf-message', 'Send'].includes(x));
  check(`${w}: tab order fields → Send`, form.join() === 'cf-website,cf-email,cf-message,Send', seq.join(' → '));
  await p.type('#cf-website', 'yourcompany.com');
  await p.type('#cf-email', 'a@b.co'); await p.click('.contact-form [type=submit]'); await sleep(800);
  let msg = await p.$eval('[data-form-status]', e => e.textContent);
  check(`${w}: success shows the thanks message`, msg === 'Thanks. Your message has been sent.', msg);
  check(`${w}: website field gets https:// added`, /name="website"\r\n\r\nhttps:\/\/yourcompany\.com/.test(posted || ''));
  reply = { errors: [{ message: 'bad' }] };
  await p.type('#cf-email', 'a@b.co'); await p.click('.contact-form [type=submit]'); await sleep(800);
  msg = await p.$eval('[data-form-status]', e => e.textContent);
  check(`${w}: an errors reply shows the failure message with the email link`, msg.startsWith('Sorry, your message didn’t send.') && /contact@legibletechnologies\.com/.test(msg), msg);
  await p.close();
}
await b.close();
done();
