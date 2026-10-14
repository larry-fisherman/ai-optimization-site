// Hero background video. The <img> poster is the fallback: no JS, reduced motion,
// Save-Data / 2G / reduced data, a video that can't play, or a throw here
// (main.js adds .is-static).
export function initHeroMedia(root, mq) {
  const hero = root.parentElement, video = root.querySelector('video'), btn = hero.querySelector('.hero__media-toggle');
  const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; sync(); });
  const c = navigator.connection;
  if (c?.saveData || /(^|-)2g$/.test(c?.effectiveType || '') || matchMedia('(prefers-reduced-data: reduce)').matches) return;
  let user = false, seen = false, loaded = false, failed = false;

  const label = p => { btn.firstChild.data = p ? 'Play' : 'Pause'; btn.classList.toggle('is-paused', p); };
  const show = p => { label(p); btn.hidden = false; };
  // can't play (404, truncated, no H.264, wrong MIME type): poster only, no control
  const fail = () => { failed = true; btn.hidden = true; video.classList.remove('is-playing'); video.pause(); };
  const play = () => {
    if (!loaded) {
      loaded = true;
      // by CSS width, not width × DPR: phones get SD; never HD on a cellular or 3G link
      const hd = innerWidth >= 1024 && c?.type !== 'cellular' && c?.effectiveType !== '3g';
      video.src = video.dataset[hd ? 'srcHd' : 'srcSd'];
      video.preload = 'auto';
    }
    video.muted = true;
    video.play().catch(e => {
      if (e.name === 'AbortError' || failed) return;      // paused or hidden before it started: not a user pause
      if (e.name === 'NotSupportedError' || video.error) return fail();
      if (!mq.matches && !user) show(true);               // autoplay refused (Low Power Mode, policy): poster + Play
    });
  };
  function sync() {
    if (failed) return;
    if (mq.matches) { if (loaded) video.pause(); video.classList.remove('is-playing'); btn.hidden = true; }
    else if (user) { if (loaded) { video.pause(); show(true); } }  // a user pause sticks, and keeps its Play button
    else if (seen && !document.hidden) play();
    else if (loaded) video.pause();
  }
  video.addEventListener('error', fail);
  video.addEventListener('playing', () => {
    if (mq.matches || user || failed) return video.pause();
    video.classList.add('is-playing'); show(false);
  });
  // the user's choice sticks until they press Play again (WCAG 2.2.2)
  btn.addEventListener('click', () => {
    user = !btn.classList.contains('is-paused');
    label(user);
    if (user) video.pause(); else play();
  });

  // after load, so the video never competes with the page's own resources
  const start = () => {
    io.observe(hero);
    document.addEventListener('visibilitychange', sync);
    mq.addEventListener?.('change', sync);
  };
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
}
