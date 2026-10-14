// Current-page link, mobile menu disclosure + proof copy buttons. Smooth scrolling is CSS.
export function initNav() {
  const nav = document.querySelector('.site-nav');
  // mark the link to the current page (/ ≡ /index.html; hash-only links are sections, not pages)
  const path = p => p.replace(/\/index\.html$/, '/');
  for (const a of nav.querySelectorAll('.site-nav__list a')) {
    const u = new URL(a.getAttribute('href'), location.href);
    if (!u.hash && path(u.pathname) === path(location.pathname)) a.setAttribute('aria-current', 'page');
  }
  const btn = nav.querySelector('.site-nav__toggle');
  const open = () => btn.getAttribute('aria-expanded') === 'true';
  const set = v => btn.setAttribute('aria-expanded', v);
  btn.addEventListener('click', () => set(!open()));
  nav.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
  nav.addEventListener('focusout', e => { if (!nav.contains(e.relatedTarget)) set(false); });
  // iOS doesn't focus tapped buttons: catch taps outside
  document.addEventListener('pointerdown', e => { if (open() && !nav.contains(e.target)) set(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && open()) { set(false); btn.focus(); }
  });

  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const out = b.parentElement.querySelector('[aria-live]');
    try {
      await navigator.clipboard.writeText(document.getElementById(b.dataset.copy).textContent);
      out.textContent = 'Copied';
    } catch {
      out.textContent = 'Copy failed. Select the text instead.';
    }
    clearTimeout(b.t);
    b.t = setTimeout(() => { out.textContent = ''; }, 2500);
  }));
}
