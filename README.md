# Legible: single-page site

A one-page marketing site for **Legible**, a studio that gets businesses found, understood and cited by AI assistants and answer engines. The concept is "Two Readers": every website now has a human reader and a machine reader. The hero demo ("the Lens") shows the same mock webpage as a person sees it and as an AI system parses it.

Plain static HTML, CSS and vanilla ES modules. There's no build step, no dependencies and no third-party requests.

## Preview locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

ES modules need to be served over HTTP. If you open `index.html` from disk (`file://`), the browser blocks the modules. Once the page has loaded it falls back to the no-JS version, though you may see the JS layout (Menu button, Lens controls) for a moment first.

## Deploy

Nothing needs building, but don't publish the whole folder. A static host serves whatever it is given, and this folder also holds `.agent/` (the build plan, status and gate log) and `.venv/` (a local Python environment). The site is only these files:

```sh
mkdir -p dist && cp -R index.html llms.txt robots.txt sitemap.xml css js fonts assets dist/
```

That makes a clean `dist/` folder (ignored by git). If you have removed files from the site since the last copy, delete `dist/` first. Deploy that folder:

- **Netlify:** drag `dist/` into the dashboard (Sites → Deploy manually). With a connected repo, set the build command to the line above and the publish directory to `dist`.
- **Vercel:** `vercel deploy dist` (framework preset "Other", no build command). With a connected repo, set the build command to the line above and the output directory to `dist`.
- **Cloudflare Pages:** connect the repo, set the build command to the line above and the output directory to `dist`.
- **GitHub Pages:** "Deploy from a branch" publishes everything committed, so use Settings → Pages → Source: **GitHub Actions** with the "Static HTML" starter workflow. Add a step that runs the line above, and set the upload step's `path` to `dist`. If you deploy from a branch anyway, keep `.agent/` and `.venv/` out of the repo (both are in `.gitignore`).

Most hosts gzip/brotli text files and cache static assets by default. Lighthouse scores better with compression than with plain `python3 -m http.server`, which does neither (see Audit below).

## Structure

| Path | What it is |
| --- | --- |
| `index.html` | The whole page: semantic markup, meta/OG tags, inline JSON-LD, both layers of the hero mock |
| `css/tokens.css` | Palette (the only place brand colours are defined), `@font-face`, type scale, spacing, motion tokens |
| `css/main.css` | Reset, grid, nav, sections, footer, reveals, grain, print |
| `css/hero.css` | The Lens: mock page, machine-layer annotations, lens ring, scan band, split, answer card |
| `js/main.js` | Entry module: starts each module in isolation, with a no-JS fallback if one fails |
| `js/lens.js` | Pointer lens, scan band, touch drag, Human/Machine view, Pause, business switcher, answer card |
| `js/demo-data.js` | The three fictional businesses the Lens rotates through |
| `js/reveal.js` | Scroll reveals and the typed mono section tags |
| `js/nav.js` | Mobile menu disclosure and copy buttons |
| `fonts/` | Self-hosted latin woff2: Instrument Serif, Instrument Sans (variable), JetBrains Mono, plus `OFL.txt` |
| `assets/favicon.svg` | Lens mark favicon |
| `assets/og-image.svg` / `.png` | Social card source and its 1200×630 render |
| `llms.txt`, `robots.txt`, `sitemap.xml` | The machine-facing files |

### How the page behaves without JS or motion

- **No JS:** all content is readable. The hero shows a static 50/50 split (human | machine), and the answer card is visible. The Lens controls and copy buttons are hidden, and the nav links show without a Menu button.
- **JS fails:** the page ends up the same as no JS. If `js/main.js` or one of its modules can't load (a 404, `file://`, a blocked script), an inline script in `<head>` removes the `js` class once the page has loaded. If one module throws while starting, only that feature falls back. A failed Lens shows the static split (`.lens.is-static`), a failed nav shows plain links (`html.nav-off`), and failed reveals show everything at once.
- **`prefers-reduced-motion: reduce`:** no lens following, scan band, wipes, typing or auto-advance. The hero stays in the static split, and the Human/Machine view buttons and business tabs still work, with instant swaps. The Pause button is hidden because nothing moves on its own. Changing the setting while the page is open takes effect straight away.
- **Pause:** the scan loop and the 10-second auto-advance can be stopped with the Pause button next to the view buttons (WCAG 2.2.2). Auto-advance also stops for good as soon as a visitor focuses or uses any Lens control.

### Keeping things in sync

- The `llms.txt` and JSON-LD shown in section [04] are copies of `/llms.txt` and the `<script type="application/ld+json">` in `<head>`. If you edit one, update the other (HTML-escape `&`, `<`, `>` in the `<pre>`).
- The Lens markup in `index.html` uses `data-slot` / `data-label-key` attributes named after the fields in `js/demo-data.js`. `lens.js` fills them when the business changes, including the hidden text alternative `#lens-desc`. Keep the names matching.
- The company name lives in: `<title>`, the meta/OG tags, the JSON-LD, `llms.txt`, the two wordmarks (nav and footer), the hero sub, the footer copyright and `assets/og-image.svg`.
- If you edit `assets/og-image.svg`, re-render the PNG: serve the site, open `/assets/og-image.svg` in Chrome at a 1200×630 viewport and take a screenshot (DevTools → Run command → "Capture screenshot").

### Colours outside the brand palette

The brand palette is defined in `css/tokens.css`. Other files use those tokens, or `rgba()` alphas of the same values. The only other colours are white (the machine layer's ground and print) and the fictional client sites inside the hero mock (their `[data-biz]` themes, shapes, star and button colours in `css/hero.css`). Those are other companies' "brands" inside the demo, not Legible's.

## Placeholders

Rows marked "yes" carry a `PLACEHOLDER` comment in the source. Find them with `grep -rn "PLACEHOLDER\|TODO:" --exclude-dir=.venv --exclude-dir=.agent .`. The other rows are listed only here, with the reason.

| What | Where | Marked in source | Current value |
| --- | --- | --- | --- |
| Domain | `index.html` (canonical, `og:url`, `og:image`, `twitter:image`, JSON-LD), `robots.txt`, `sitemap.xml`, `llms.txt` | yes, except `llms.txt`: it is served verbatim and mirrored byte for byte in section [04], so a comment would end up in both | `https://example.com` |
| CTA destination | `index.html` hero button and CTA button | yes | `mailto:hello@example.com?subject=AI%20visibility%20audit` |
| Contact email | `index.html` footer and JSON-LD `email`, `llms.txt` | yes in `index.html` (the JSON-LD's is noted in a `<head>` comment, as JSON can't hold one); not in `llms.txt` (see Domain) | `hello@example.com` |
| Response-time promise | `index.html` CTA section | yes | `response time < 1 business day` |
| Client logos / case studies | `index.html` `.proof__clients` (rendered `hidden`) | yes | empty. Keep hidden until real, approved proof exists |
| Copyright year | `index.html` footer | yes | static `© 2026` |
| Company name | see "Keeping things in sync" | no: decided for now, and it appears in too many places to mark each one | Legible |
| Logo | typographic wordmark + `assets/favicon.svg` | no: a stand-in by design until a real logo exists | lens mark |
| Copy and tone | all page copy, `llms.txt` | no: it's every sentence on the page | placeholder editorial copy for approval |
| Fictional demo businesses | `js/demo-data.js` and the first business hard-coded in `index.html` | no: deliberate demo content, not a stand-in for real data | Hollis & Pine, Northgate Family Dental, Ledgerline on `.example` domains |

There are no `TODO:` markers and no statistics in the build.

## Audit (2026-10-09, after the review fixes)

Run headless on a local server. The Lighthouse 12.8 runs used Chrome with the mobile preset. Figures are medians (five runs on the gzip server, three on `http.server`).

| | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Static server with gzip + cache headers (like a typical host; the plan's LCP measure) | 99 | 100 | 100 | 100 | 1.8 s | 0.01 | ≤ 62 ms |
| `python3 -m http.server` (no compression, no cache headers) | 97–98 | 100 | 100 | 100 | 2.1–2.3 s | 0.01 | 0 ms |

- LCP target (< 2.0 s, measured with gzip as amended in the plan): met. The LCP element is the hero sub-line. On uncompressed `http.server` it stays above 2 s. Tried there: preloading the Instrument Serif Italic (kept, neutral within noise), removing dead CSS rules (kept), stripping CSS comments (no change), inlining all CSS (2.1 s, not kept) and also preloading Instrument Sans (no change).
- axe-core 4.14 (injected into headless Chrome) found 0 violations in nine states: desktop, 375px touch, machine view, paused, mobile menu open, reduced motion, no JS (1280 and 375) and a failed Lens init.
- HTML: html-validate 9.7 `standard` preset, 0 problems. The `recommended` preset adds four style preferences only (lowercase doctype, the mock meter's inline `--v` style, `role="region"` on the two code panels).
- Weight: 17 requests, about 212 KiB uncompressed and 142 KiB with gzip on first load (fonts 114 KiB, CSS 51 KiB, HTML 29 KiB, JS 15,978 B of source: 15,814 B in `js/` plus a 164 B inline script; budget < 16,000 B). No third-party requests.
- JSON-LD: validator.schema.org reported 0 errors and 0 warnings (unchanged since the first audit).
