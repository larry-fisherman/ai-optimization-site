// Footer year: the static year in the HTML stays if this never runs.
export function initYear() {
  const y = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = y; });
}
