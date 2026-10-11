// Plausible, loaded only once a domain is configured in config.js.
// Until then: no third-party request, and track() does nothing.
// main.js loads this module with a dynamic import(), so if it is blocked or
// missing, nothing else on the page is affected. Other modules call
// window.legibleTrack (queued in window.legibleTrackQ until this runs).
import { PLAUSIBLE_DOMAIN, PLAUSIBLE_SRC } from './config.js';

const enabled = () => Boolean(PLAUSIBLE_DOMAIN) && !PLAUSIBLE_DOMAIN.startsWith('PLACEHOLDER_');

export function track(name, props, callback) {
  if (!enabled() || typeof window.plausible !== 'function') { callback?.(); return; }
  const opts = {};
  if (props) opts.props = props;
  if (callback) opts.callback = callback;
  window.plausible(name, opts);
}

// A same-tab, plain left click on a link that leaves this document.
const leavesPage = (e, a) =>
  a && !e.defaultPrevented && e.button === 0 &&
  !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) &&
  (!a.target || a.target === '_self') && !a.hasAttribute('download') &&
  /^https?:$/.test(a.protocol) &&
  !(a.origin === location.origin && a.pathname === location.pathname && a.search === location.search);

let navigating = false; // one event and one navigation per delayed link click

export function initAnalytics() {
  if (!enabled()) return;
  window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
  const s = document.createElement('script');
  s.defer = true;
  s.dataset.domain = PLAUSIBLE_DOMAIN;
  s.src = PLAUSIBLE_SRC;
  document.head.append(s);

  window.legibleTrack = track;
  (window.legibleTrackQ || []).splice(0).forEach(args => track(...args));

  document.addEventListener('click', e => {
    const el = e.target.closest?.('[data-track]');
    if (!el) return;
    const props = { label: el.dataset.trackLabel || el.textContent.trim(), page: location.pathname };
    const a = el.closest('a[href]');
    if (!leavesPage(e, a)) { track(el.dataset.track, props); return; }
    if (navigating) { e.preventDefault(); return; } // already leaving: ignore repeat clicks
    // Navigating away: wait for Plausible's callback (or 300 ms) so the event isn't lost.
    e.preventDefault();
    navigating = true;
    addEventListener('pageshow', () => { navigating = false; }, { once: true }); // back/forward cache restore
    let gone = false;
    const go = () => { if (!gone) { gone = true; location.href = a.href; } };
    track(el.dataset.track, props, go);
    setTimeout(go, 300);
  });

  if (document.querySelector('[data-track-404]')) track('404', { path: location.pathname });
}
