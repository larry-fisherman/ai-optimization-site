// Entry: each feature starts in isolation; one that throws falls back to no-JS.
import { initLens } from './lens.js';
import { initReveal, revealAll } from './reveal.js';
import { initNav } from './nav.js';
import { initYear } from './year.js';
import { initContact } from './contact.js';
import { initHeroMedia } from './hero-media.js';

const html = document.documentElement;
const mq = matchMedia('(prefers-reduced-motion: reduce)');
const lens = document.querySelector('.lens');
const heroMedia = document.querySelector('.hero__media');
const run = (init, fallback) => { try { init(); } catch (e) { fallback(); console.error(e); } };

html.classList.add('js', 'js-ready');
if (heroMedia) run(() => initHeroMedia(heroMedia, mq), () => heroMedia.classList.add('is-static'));
if (lens) run(() => initLens(lens, mq), () => lens.classList.add('is-static'));
run(() => initReveal(mq), revealAll);
run(initNav, () => html.classList.add('nav-off'));
run(initYear, () => {});
run(initContact, () => {});
// Analytics is loaded on its own: if it is blocked or missing, nothing else is affected.
run(() => { import('./analytics.js').then(m => m.initAnalytics()).catch(console.error); }, () => {});
