// Shared setup for the browser checks. Not deployed, no dependencies in the repo:
// point NODE_MODULES at any node_modules that has puppeteer-core (and axe-core for
// axe.mjs), CHROME at a Chrome binary, BASE at the served site (see README, "Browser checks").
import { createRequire } from 'module';
import path from 'path';
const req = createRequire(path.join(process.env.NODE_MODULES || path.join(process.cwd(), 'node_modules'), 'x.js'));
export const require = req;
export const puppeteer = req('puppeteer-core');
export const BASE = process.env.BASE || 'http://127.0.0.1:8000/';
export const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const launch = () => puppeteer.launch({ executablePath: CHROME, headless: true });
let fails = 0;
export const check = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`); };
export const done = () => { console.log(fails ? `${fails} failed` : 'all passed'); process.exitCode = fails ? 1 : 0; };
export async function page(b, w, h, o = {}) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: o.dpr || 1, isMobile: !!o.touch, hasTouch: !!o.touch });
  p.errors = []; p.mp4 = [];
  p.on('pageerror', e => p.errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  p.on('request', r => { if (r.url().endsWith('.mp4')) p.mp4.push(r.url()); });
  if (o.rm) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (o.nojs) await p.setJavaScriptEnabled(false);
  if (o.init) await p.evaluateOnNewDocument(o.init);
  // surface ResizeObserver loop errors, which only reach window 'error' listeners
  await p.evaluateOnNewDocument(() => addEventListener('error', e => console.error('window error: ' + e.message)));
  await p.goto(BASE + (o.path || ''), { waitUntil: o.wait || 'load' });
  return p;
}
