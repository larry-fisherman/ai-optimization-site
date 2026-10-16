// Contact form: progressive enhancement over a plain POST to the form's action.
// Formspree answers JSON: a 2xx without an `errors` entry is a success.
// Analytics is optional and loaded separately: queue events until it is ready.
const track = (...args) => (window.legibleTrack ? window.legibleTrack(...args) : (window.legibleTrackQ ||= []).push(args));

export function initContact() {
  const form = document.querySelector('.contact-form');
  if (!form) return;
  const status = form.querySelector('[data-form-status]');
  const btn = form.querySelector('[type="submit"]');
  const fallback = document.querySelector('.contact-form__fallback a');
  const action = form.getAttribute('action') || '';

  const say = (text, withEmail) => {
    status.textContent = text;
    if (withEmail && fallback) {
      const a = fallback.cloneNode(true);
      status.append(' ', a, '.');
    }
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const site = form.elements.website;
    if (site && site.value.trim() && !/^[a-z][a-z0-9+.-]*:\/\//i.test(site.value.trim())) site.value = `https://${site.value.trim()}`;
    btn.disabled = true;
    say('Sending…');
    try {
      const res = await fetch(action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.errors) throw new Error(`HTTP ${res.status}`);
      form.reset();
      say('Thanks. Your message has been sent.');
      track('Contact Form Submit');
    } catch (err) {
      say('Sorry, your message didn’t send. Please try again, or email us:', true);
      track('Contact Form Error');
      console.error(err);
    } finally {
      btn.disabled = false;
    }
  });
}
