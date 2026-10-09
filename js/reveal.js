// Scroll reveals (clip-path wipe) and typed mono tags. Fire once.
let io, tags = [];

// Show all now: init failed, printing, or reduced motion on.
export function revealAll() {
  io?.disconnect();
  document.documentElement.classList.remove('reveal-ready');
  for (const t of tags) { clearTimeout(t.t); t.classList.remove('is-typing'); t.textContent = t.dataset.text ?? t.textContent; }
}

export function initReveal(mq) {
  addEventListener('beforeprint', revealAll);
  mq.addEventListener?.('change', () => mq.matches && revealAll());
  if (mq.matches || !('IntersectionObserver' in window)) return;
  io = new IntersectionObserver(es => es.forEach(({ isIntersecting, target: el }) => {
    if (!isIntersecting) return;
    io.unobserve(el);
    if (el.dataset.text) type(el); else el.classList.add('is-in');
  }), { rootMargin: '0px 0px -12% 0px' });
  tags = [...document.querySelectorAll('.tag')];
  document.documentElement.classList.add('reveal-ready');
  for (const t of tags) {
    // reserve the box in ch: fits before and after the mono font loads
    t.style.minWidth = `calc(${t.textContent.length} * (1ch + var(--track-mono)) + 1.4em)`;
    t.dataset.text = t.textContent;
    t.textContent = '​';
    io.observe(t);
  }
  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
}

function type(el) {
  const s = el.dataset.text;
  let i = 0;
  el.classList.add('is-typing');
  const step = () => {
    el.textContent = s.slice(0, ++i);
    if (i < s.length) el.t = setTimeout(step, 26); else el.classList.remove('is-typing');
  };
  step();
}
