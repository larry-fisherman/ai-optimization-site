// Enhanced styles from the first paint. Loaded as a classic, non-deferred script from every
// <head> so the `js` class is set before the first paint (and so a strict CSP needs no
// inline script). If js/main.js never runs (file://, a 404, a blocked module), drop back to
// the no-JS page once the page has loaded.
{
  const de = document.documentElement;
  de.classList.add('js');
  addEventListener('load', () => de.classList.contains('js-ready') || de.classList.remove('js'));
}
