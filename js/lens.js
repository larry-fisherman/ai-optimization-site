// The Lens. No-JS, failed init and reduced motion keep the static split.
import { BIZ } from './demo-data.js';

const SCAN_MS = 6000, AUTO_MS = 10000;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function initLens(root, mq) {
  const $ = s => root.querySelector(s), $$ = s => root.querySelectorAll(s);
  const frame = $('.lens__frame'), band = $('.lens__band'), ring = $('.lens__ring'), pause = $('.lens__pause');
  const readout = $('[data-readout]'), live = $('[data-lens-live]');
  const machineLayer = $('.mock--machine'), tabs = $$('.lens__tab'), views = $$('.lens__view');
  const qEl = $('.answer [data-slot="question"]'), aEl = $('.answer [data-slot="answer"]'), human = $('.mock--human');
  const chip = $('.answer__source .chip');
  // observers first: a missing API throws before any change
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; schedule(); });
  // reserve() changes the frame's height, so it never runs inside this callback: only a
  // width change asks for it, on the next frame (no "ResizeObserver loop" error)
  const ro = new ResizeObserver(([en]) => {
    if (en.contentRect.width !== reservedW) requestReserve();
    measure(); if (base === 'lens') { x = tx = clamp(x, 0, W); y = ty = clamp(y, 0, H); } vars();
  });

  let reduced = mq.matches, base = reduced ? 'split' : 'scan', machine = false, paused = false;
  let cur = 0, scanned = reduced, auto = !reduced, switching = 0;
  let W = 0, H = 0, r = 0, bh = 0, x = 0, y = 0, tx = 0, ty = 0, by = 0, rw = 0, rh = 0;
  let raf = 0, last = 0, visible = true, dragging = false, holdUntil = 0, reserveT = 0, reservedW = -1, reservedFonts = '';
  let leaveT = 0, autoT = 0, answerT = 0, wipeT = 0, morphT = 0, toks = [], lastText = '';

  // per frame: direct clip-path/transform writes; readout flips to stay in frame
  const vars = () => {
    const o = r * 0.72, lens = base === 'lens' && !machine, scan = base === 'scan' && !machine, ry = by + bh + 6;
    machineLayer.style.clipPath = machine ? `circle(150% at ${x}px ${y}px)` : lens ? `circle(${r}px at ${x}px ${y}px)`
      : scan ? `inset(${by}px 0 ${H - by - bh}px 0)` : '';
    ring.style.transform = `translate3d(${x - r}px,${y - r}px,0)`;
    band.style.transform = `translate3d(0,${by}px,0)`;
    readout.style.transform = lens ? `translate3d(${x + o + rw > W ? x - o - rw : x + o}px,${y + o + rh > H ? y - o - rh : y + o}px,0)`
      : scan ? `translate3d(0,${clamp(ry + rh > H ? by - rh - 6 : ry, 0, H - rh)}px,0)` : '';
  };
  const paint = () => {
    const m = machine ? 'machine' : base;
    if (root.dataset.mode !== m) root.dataset.mode = m;
  };
  const sync = () => { paint(); vars(); count(); };
  const press = () => views.forEach((w, j) => w.setAttribute('aria-pressed', j ? machine : !machine && base != 'split'));

  // --- geometry & readout
  function measure() {
    const f = frame.getBoundingClientRect();
    W = f.width; H = f.height;
    r = clamp(W * 0.2, 64, 132);
    bh = clamp(W * 0.16, 56, 104);
    rw = readout.offsetWidth + 4; rh = readout.offsetHeight + 4;
    toks = [...machineLayer.querySelectorAll('[data-tok]')].map(el => {
      const b = el.getBoundingClientRect();
      return { x: b.left - f.left + b.width / 2, y: b.top - f.top + b.height / 2, n: +el.dataset.tok, ent: el.classList.contains('ent') };
    });
    count();
  }
  function count() {
    let n = 0, e = 0;
    for (const t of toks) {
      const hit = machine || (base === 'lens' ? Math.hypot(t.x - x, t.y - y) < r : base === 'scan' ? t.y > by && t.y < by + bh : t.x > W / 2);
      if (hit) { n += t.n; e += t.ent; }
    }
    const text = `${machine ? 'parsed' : 'reading…'} ${n} tokens · ${e} entities${machine ? ' · 2 flags' : ''}`;
    if (text !== lastText) readout.textContent = lastText = text;
  }

  // reserve the tallest mock page, question, answer and source chip across BIZ, so the
  // frame and the answer card keep one height through switches (one synchronous task:
  // nothing paints mid-measure). Restores what is on screen, not BIZ[cur]: render() lags
  // cur by 320ms. .is-measuring turns transitions off while measuring (the global
  // reduced-motion rule gives every property a .01ms transition, which would leave the
  // theme sizes stale), so it waits until no transition is running in the Lens, rather
  // than snap one (the answer's wipe-in, the view pill, the morph) to its end.
  const VARS = ['--lens-q-min', '--lens-a-min', '--lens-s-min', '--lens-mock-min'];
  // when the browser is idle (it costs a few forced layouts; the Lens sits below the fold),
  // or within 500ms; a rAF where requestIdleCallback is missing
  function requestReserve() {
    if (reserveT) return;
    const run = () => { reserveT = 0; reserve(); measure(); vars(); };
    reserveT = window.requestIdleCallback ? requestIdleCallback(run, { timeout: 500 }) : requestAnimationFrame(run);
  }
  function reserve() {
    const busy = root.getAnimations?.({ subtree: true }).filter(a => a.transitionProperty && a.playState === 'running') || [];
    if (busy.length) { Promise.allSettled(busy.map(a => a.finished)).then(requestReserve); return; }
    const shown = BIZ.find(b => b.key === frame.dataset.biz) || BIZ[cur], q0 = qEl.textContent, a0 = aEl.textContent;
    const els = [qEl, aEl, chip, human], max = [0, 0, 0, 0];
    root.classList.add('is-measuring');
    try {
      for (const k of VARS) root.style.removeProperty(k);
      for (const b of BIZ) {
        render(b);
        els.forEach((el, i) => { max[i] = Math.max(max[i], el.getBoundingClientRect().height); });
      }
    } finally {
      render(shown);
      qEl.textContent = q0; aEl.textContent = a0;
      void human.offsetHeight;
      root.classList.remove('is-measuring');
    }
    VARS.forEach((k, i) => root.style.setProperty(k, max[i] + 'px'));
    reservedW = frame.getBoundingClientRect().width; reservedFonts = document.fonts?.status;
  }

  // --- loop: only while something moves on screen
  const wantsLoop = () => visible && !document.hidden && !machine && !reduced &&
    (base === 'scan' ? !dragging && !paused : Math.abs(tx - x) + Math.abs(ty - y) > 0.3);
  const schedule = () => { if (!raf && wantsLoop()) raf = requestAnimationFrame(tick); };
  function tick(t) {
    raf = 0;
    const dt = last ? Math.min(64, t - last) : 16;
    last = t;
    if (base === 'lens') {
      x += (tx - x) * 0.2; y += (ty - y) * 0.2;
    } else if (t > holdUntil) {
      by += (dt / SCAN_MS) * (H + bh);
      if (by > H) { by = -bh; if (!scanned) firstScan(); }
    }
    vars(); count();
    if (wantsLoop()) raf = requestAnimationFrame(tick); else last = 0;
  }

  // --- answer card & auto-advance (clear timers before re-arming)
  function resolve(delay = 0) {
    clearTimeout(answerT);
    root.dataset.answer = 'pending';
    answerT = setTimeout(() => { root.dataset.answer = 'resolved'; }, reduced ? 0 : delay);
  }
  function firstScan() {
    scanned = true;
    if (!switching) resolve();
    if (auto) autoT = setInterval(() => { if (visible && !document.hidden) show((cur + 1) % BIZ.length); }, AUTO_MS);
  }
  const stopAuto = () => { auto = false; clearInterval(autoT); };

  // --- switcher: data-slot / data-label-key name BIZ fields
  const span = (textContent, className = '') => Object.assign(document.createElement('span'), { textContent, className });
  function render(b) {
    frame.dataset.biz = b.key;
    for (const el of $$('[data-slot]')) { const v = b[el.dataset.slot]; if (typeof v === 'string') el.textContent = v; }
    for (const el of $$('[data-label-key]')) el.dataset.label = b[el.dataset.labelKey];
    for (const el of $$('[data-slot="links"]')) el.replaceChildren(...b.links.map(l => span(l)));
    for (const el of $$('[data-slot="headline"]')) {
      if (!el.closest('.mock--machine')) { el.textContent = b.tokens.join(''); continue; }
      el.replaceChildren(...b.tokens.map(t => { const s = span(t, 'tok'); s.dataset.tok = 1; return s; }));
    }
    $('[data-slot="meter"]').style.setProperty('--v', b.meter);
    $('[data-slot="meterValue"]').textContent = b.meter.toFixed(2);
  }
  function show(i, user) {
    if (i === cur) return;
    cur = i;
    tabs.forEach((t, j) => t.setAttribute('aria-pressed', j === i));
    const b = BIZ[i];
    if (user) live.textContent = `Showing ${b.name}, ${b.type}. Asked ${b.question}, the AI answers: ${b.answer}`;
    clearTimeout(switching); clearTimeout(wipeT); clearTimeout(answerT);
    if (reduced) { render(b); measure(); root.dataset.answer = 'resolved'; return; }
    root.classList.remove('is-switching');
    void root.offsetWidth;
    root.classList.add('is-switching');
    if (scanned) root.dataset.answer = 'pending';
    switching = setTimeout(() => { switching = 0; render(b); measure(); if (scanned) resolve(450); }, 320);
    wipeT = setTimeout(() => root.classList.remove('is-switching'), 720);
  }
  tabs.forEach((t, i) => t.addEventListener('click', () => { stopAuto(); show(i, true); }));

  // --- Human / Machine
  views.forEach((v, i) => v.addEventListener('click', () => {
    stopAuto();
    // split (reduced motion) = both layers, none pressed; a press picks one
    if (base == 'split') base = 'human'; else if (machine == !!i) return;
    machine = !!i;
    press();
    if (machine && base === 'scan') {
      // grow from the band's centre
      x = tx = W / 2; y = ty = by + bh / 2;
      machineLayer.style.clipPath = `circle(${r}px at ${x}px ${y}px)`;
      void machineLayer.offsetWidth;
    }
    root.classList.add('is-morphing');
    clearTimeout(morphT);
    morphT = setTimeout(() => root.classList.remove('is-morphing'), 720);
    sync();
    if (!scanned) firstScan();
    schedule();
  }));

  // --- Pause: stops scan + auto-advance (WCAG 2.2.2)
  pause.addEventListener('click', () => {
    stopAuto();
    paused = !paused;
    pause.firstChild.data = paused ? 'Play' : 'Pause';
    root.classList.toggle('is-paused', paused);
    if (!scanned) firstScan();
    schedule();
  });

  // --- pointer: lens follows mouse/pen; touch drags the band (moves bubble here)
  const local = e => { const f = frame.getBoundingClientRect(); return [e.clientX - f.left, e.clientY - f.top]; };
  frame.addEventListener('pointermove', e => {
    if (reduced || machine) return;
    if (e.pointerType === 'touch') {
      if (dragging) { by = clamp(local(e)[1] - bh / 2, -bh / 2, H - bh / 2); vars(); count(); }
      return;
    }
    [tx, ty] = local(e);
    clearTimeout(leaveT);
    if (base !== 'lens') { stopAuto(); x = tx; y = ty; base = 'lens'; paint(); vars(); }
    schedule();
  });
  // to scan even in machine view, so Human won't find the lens parked
  frame.addEventListener('pointerleave', e => {
    if (reduced || e.pointerType === 'touch') return;
    leaveT = setTimeout(() => {
      base = 'scan'; by = clamp(y - bh / 2, -bh, H); holdUntil = performance.now() + 400;
      sync(); schedule();
    }, 900);
  });
  band.addEventListener('pointerdown', e => {
    if (reduced || e.pointerType !== 'touch' || base !== 'scan') return;
    stopAuto(); dragging = true; band.setPointerCapture(e.pointerId);
  });
  const endDrag = () => { if (!dragging) return; dragging = false; holdUntil = performance.now() + 1500; schedule(); };
  band.addEventListener('pointerup', endDrag);
  band.addEventListener('pointercancel', endDrag);
  root.addEventListener('focusin', stopAuto); // focus alone ends auto-advance

  // --- reduced motion may change live
  mq.addEventListener?.('change', () => {
    reduced = mq.matches;
    if (reduced) { stopAuto(); base = 'split'; scanned = true; clearTimeout(answerT); root.dataset.answer = 'resolved'; }
    else { base = 'scan'; by = -bh; }
    press(); sync(); schedule();
  });

  // --- pause offscreen / tab hidden
  io.observe(root);
  ro.observe(frame);
  document.addEventListener('visibilitychange', schedule);
  // once the web fonts are in, unless the last reserve already had them
  document.fonts?.ready.then(() => { if (reservedFonts !== 'loaded') requestReserve(); });

  requestReserve();
  measure();
  x = tx = W / 2; y = ty = H * 0.4; by = -bh;
  vars(); paint(); press();
  root.dataset.answer = scanned ? 'resolved' : 'pending';
  root.classList.add('is-ready');
  schedule();
}
