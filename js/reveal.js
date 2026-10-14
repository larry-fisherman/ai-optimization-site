// Scroll reveals: a short fade-up, once per element.
let io;

// Show all now: init failed, printing, or reduced motion on.
export function revealAll() {
  io?.disconnect();
  document.documentElement.classList.remove('reveal-ready');
}

export function initReveal(mq) {
  addEventListener('beforeprint', revealAll);
  mq.addEventListener?.('change', () => mq.matches && revealAll());
  if (mq.matches || !('IntersectionObserver' in window)) return;
  io = new IntersectionObserver(es => es.forEach(({ isIntersecting, target: el }) => {
    if (!isIntersecting) return;
    io.unobserve(el);
    el.classList.add('is-in');
  }), { rootMargin: '0px 0px -12% 0px' });
  document.documentElement.classList.add('reveal-ready');
  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
}
