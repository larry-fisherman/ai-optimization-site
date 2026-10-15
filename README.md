# Legible: marketing site

A small multi-page marketing site for **Legible**, a studio that gets businesses found, understood and cited by AI assistants and answer engines. The concept is "Two Readers": every website now has a human reader and a machine reader. An interactive demo ("the Lens"), in the home page's "two readers" section below the hero, shows the same mock webpage as a person sees it and as an AI system parses it.

It has a home page, a packages page (with the FAQ), an about page, a contact page (the form), five service pages, a privacy notice and a 404 page, all in one dark theme. Plain static HTML, CSS and vanilla ES modules. There's still no build step and no dependencies. There is one optional third-party script (Plausible), loaded only when configured; the contact form posts to the configured endpoint.

Run the site checks (stdlib only) after any edit:

```sh
python3 -m unittest discover -s tests
```

The agent gate (`.agent/gate.log`) finds no test command for this repo and logs the test stage as skipped, so run the command above by hand.

## Preview locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

ES modules need to be served over HTTP. If you open `index.html` from disk (`file://`), the browser blocks the modules. Once the page has loaded it falls back to the no-JS version, though you may see the JS layout (Menu button, Lens controls) for a moment first.

## Deploy

Nothing needs building, but don't publish the whole folder. A static host serves whatever it is given, and this folder also holds `.agent/` (the build plan, status and gate log) and `.venv/` (a local Python environment). The site is only these files:

```sh
mkdir -p dist && cp -R *.html llms.txt robots.txt sitemap.xml css js fonts assets dist/
```

That makes a clean `dist/` folder (ignored by git). `tests/` and `tools/` stay out of it. If you have removed files from the site since the last copy, delete `dist/` first. Deploy that folder:

- **Netlify:** drag `dist/` into the dashboard (Sites → Deploy manually). With a connected repo, set the build command to the line above and the publish directory to `dist`.
- **Vercel:** `vercel deploy dist` (framework preset "Other", no build command). With a connected repo, set the build command to the line above and the output directory to `dist`.
- **Cloudflare Pages:** connect the repo, set the build command to the line above and the output directory to `dist`.
- **GitHub Pages:** "Deploy from a branch" publishes everything committed, so use Settings → Pages → Source: **GitHub Actions** with the "Static HTML" starter workflow. Add a step that runs the line above, and set the upload step's `path` to `dist`. If you deploy from a branch anyway, keep `.agent/` and `.venv/` out of the repo (both are in `.gitignore`).

`404.html` sits at the root, where hosts look for it: Netlify, Cloudflare Pages and GitHub Pages serve it automatically for missing pages, and Vercel does too as long as it is at the root, which it is. `python3 -m http.server` doesn't use it (open `/404.html` directly to preview it). Its links and assets are root-absolute (`/css/…`) because hosts serve it at any depth. That assumes the site is served at the domain root: a custom domain, or a GitHub Pages user/organization site (`user.github.io`). On a GitHub Pages *project* site (`user.github.io/repo/`), `/css/main.css` points outside the site and the 404 page loads unstyled.

Most hosts gzip/brotli text files and cache static assets by default. Lighthouse scores better with compression than with plain `python3 -m http.server`, which does neither (see Audit below).

## Configuration

- **Site base URL:** every absolute URL uses `https://example.com` (canonicals, Open Graph, JSON-LD, sitemap, robots, llms.txt). Find them with `grep -rn 'https://example.com' *.html sitemap.xml robots.txt llms.txt` and replace them all at once, for example `sed -i '' 's#https://example.com#https://your-domain#g' *.html sitemap.xml robots.txt llms.txt` (macOS; drop the `''` on GNU sed). Then run the tests: the JSON-LD mirror and canonicals must still match.
- **Form endpoint:** the `action` attribute of `.contact-form` in `contact.html` (the only place). Any endpoint that answers 2xx on success works; `js/contact.js` doesn't parse provider-specific responses. While the action starts with `PLACEHOLDER_`, the form shows "The form isn't connected yet" and points to the email link. If JS is off or fails to load, nothing can stop the post, so a static pre-launch notice above the form (`.contact-form__notice`, shown with or without JS) gives the email address instead. **Set the action before launch**, then delete that notice paragraph (it sits under a `PLACEHOLDER_FORM_ENDPOINT` comment). Also set the provider's name and privacy-policy URL in `privacy.html`.
- **Plausible:** set `PLAUSIBLE_DOMAIN` in `js/config.js` (and `PLAUSIBLE_SRC` if you self-host or proxy the script). Use the plain `script.js`: variants such as `script.outbound-links.js` or `script.tagged-events.js` add their own click handling and would double-count the events `analytics.js` already sends. Analytics stays off, with no third-party request, while the domain starts with `PLACEHOLDER_` or is empty.
- **Analytics events** (create them as goals in the Plausible dashboard): `CTA Click` (every link with `data-track="CTA Click"`: the header's Get started, the hero, package and Get in touch links; props `label`, `page`), `Email Fallback Click` (the email link under the form; props `label`, `page`), `Contact Form Submit` (successful submit only), `Contact Form Error` and `404` (fired on `404.html`, props `path`). The Lens, copy buttons, menu and FAQ toggles are not tracked. For a tracked link that leaves the page (every CTA now leads to another page), `analytics.js` waits for Plausible's `callback`, or 300 ms at most, before navigating, so the event isn't lost. Clicks with a modifier key or a middle click open the link as usual and may go uncounted.

## Structure

| Path | What it is |
| --- | --- |
| `index.html` | Home page: hero with the background ocean video (poster image first), the shift section with the Lens (both layers of the mock), services, method, proof (with the JSON-LD mirror), links to the other pages; meta/OG tags and the main `@graph` JSON-LD (Organization with founder, WebSite, 5 Services) |
| `packages.html` | The three packages and the FAQ, with `WebPage`, `BreadcrumbList` and `FAQPage` JSON-LD |
| `about.html` | Founder block and "How we measure", with `AboutPage` and `BreadcrumbList` JSON-LD (the founder `Person` stays on `index.html`) |
| `contact.html` | The contact form, its pre-launch notice and email fallback, with `ContactPage` and `BreadcrumbList` JSON-LD |
| `ai-visibility-audit.html`, `machine-readable-foundations.html`, `answer-ready-content.html`, `brand-signal-monitoring.html`, `internal-ai-readiness.html` | One page per service, with `WebPage`, `BreadcrumbList` and `Service` JSON-LD |
| `privacy.html` | Privacy notice (a template, see Placeholders) |
| `404.html` | Not-found page, `noindex`, root-absolute paths, not in the sitemap |
| `css/tokens.css` | Palette (the only place brand colours are defined: Midnight, Blue, Mist, Charcoal), the derived page surface `--night`, the accessible blue tints, the dark semantic tokens (`--bg`, `--fg`, `--fg-soft`, `--line`, `--grid-line`…), contrast table, `@font-face`, type scale, radii, spacing, motion tokens |
| `css/main.css` | Reset, grid lines, bloom, buttons, nav, section primitives (`.section`, `.statement`, `.split`, `.numbered`, `.cols`), home sections, inner-page template (packages, FAQ, about, contact, service, privacy, 404), footer, reveals, print |
| `css/hero.css` | The Lens (in the home page's two-readers section): controls, stage, mock page, machine-layer annotations, lens ring, scan band, split, answer card |
| `js/main.js` | Entry module: starts each module in isolation, with a no-JS fallback if one fails |
| `js/lens.js` | Pointer lens, scan band, touch drag, Human/Machine view, Pause, business switcher, answer card; the mock page and the answer card reserve the tallest business's height, so switching never moves the page |
| `js/hero-media.js` | The home hero's background video: gating (reduced motion, Save-Data, 2G, reduced data), SD/HD choice, loading after `load`, Pause/Play, pausing off-screen and in a hidden tab, giving up cleanly if the video can't play |
| `js/demo-data.js` | The three fictional businesses the Lens rotates through |
| `js/reveal.js` | Scroll reveals (a short fade-up) |
| `js/nav.js` | `aria-current="page"` on the current page's nav link, mobile menu disclosure and copy buttons |
| `js/config.js` | `PLAUSIBLE_DOMAIN`, `PLAUSIBLE_SRC` |
| `js/analytics.js` | Plausible loader (only when configured), `data-track` click events, `track()` |
| `js/contact.js` | Contact form: fetch submit, status messages, mailto fallback |
| `js/year.js` | Sets the footer year |
| `fonts/` | Self-hosted latin woff2: Geist and Geist Mono (both variable, from Fontsource), plus `OFL.txt` |
| `assets/favicon.svg` | Legible L mark, app-icon variant (Midnight rounded square, the L at ~60% so it reads at 16 px) |
| `favicon.ico`, `assets/apple-touch-icon.png` | PNG renders of `favicon.svg`: a 16/32/48 px ICO at the site root (Safari and older browsers, which ignore SVG icons, and the default `/favicon.ico` request) and a 180 px full-bleed iOS home-screen icon. Every page links all three: ICO (`sizes="32x32"`, so Chrome still picks the SVG), SVG, apple-touch-icon. Re-render both if the SVG changes |
| `assets/og-image.svg` / `.png` | Social card source and its 1200×630 render |
| `assets/founder-placeholder.svg` | Neutral stand-in portrait (brand tones) for `about.html` |
| `assets/hero/` | The hero's stock ocean footage, `ocean-540.mp4` (SD) and `ocean-720.mp4` (HD), its posters `ocean-poster-960.webp` / `ocean-poster-1280.webp` (frame 0 of the HD rendition), and `ocean-band-960.webp` / `ocean-band-1920.webp`, a Midnight-tinted strip of the clip's first frame behind the site header and the inner-page heroes; see Third-party media |
| `llms.txt`, `robots.txt`, `sitemap.xml` | The machine-facing files |
| `tests/test_site.py` | Site checks (shared chrome, JSON-LD, FAQ and Service sync, placeholders, sitemap, canonicals, link and anchor integrity, the form's single home, the Lens's position, no marquee and `#shift` right after the hero, the hero video markup, wiring, CSS states, asset budgets and credits, the answer card's shared cell and reserved heights); not deployed |
| `tools/browser/` | Browser checks (Node + puppeteer-core + Chrome; see Browser checks); not deployed |
| `tools/gzserve.py`, `tools/lighthouse.sh`, `tools/lighthouse_summary.py` | A gzip + cache-header static server and a Lighthouse runner with medians (see Audit); not deployed |

### How the page behaves without JS or motion

- **No JS:** all content is readable. The home hero shows the still ocean poster; the video never loads. The contact form posts straight to its `action` URL, and the footer shows the year written in the HTML. The Lens, in the two-readers section, shows a static 50/50 split (human | machine), and the answer card is visible. The Lens controls and copy buttons are hidden, and the nav links show without a Menu button.
- **JS fails:** the page ends up the same as no JS. If `js/main.js` or one of its modules can't load (a 404, `file://`, a blocked script), an inline script in `<head>` removes the `js` class once the page has loaded. If one module throws while starting, only that feature falls back (a failed hero video leaves the poster). The year and contact form modules each start in their own `run()`; if one throws, nothing visible changes (the form still posts without JS). `js/analytics.js` (and `js/config.js`) are not part of the static module graph: `main.js` loads them with a dynamic `import()`, so if a blocker, a missing file or a CSP stops them loading, the Lens, menu, reveals, year and form all keep working and only analytics is lost. `contact.js` doesn't import analytics; it queues its events in `window.legibleTrackQ`, which `analytics.js` sends once it has loaded. A failed Lens shows the static split (`.lens.is-static`), a failed nav shows plain links (`html.nav-off`), and failed reveals show everything at once.
- **`prefers-reduced-motion: reduce`:** the hero shows the still poster, and no video is requested. No lens following, scan band, wipes, reveals or auto-advance. The Lens stays in the static split, and the Human/Machine view buttons and business tabs still work, with instant swaps. The Pause button is hidden because nothing moves on its own. Changing the setting while the page is open takes effect straight away.
- **Hero video:** a muted, looping ocean clip behind the home hero, under a scrim of night and midnight alphas over a Blue .14 layer (which pulls the teal footage toward the brand blues) that fades into the page. It loads only after the page's `load` event, so it never competes with fonts, CSS or the poster; the rendition is chosen once, by CSS viewport width: the SD file below 1024 px (every phone, however dense its screen) and the HD file from 1024 px up, except on a cellular or 3G connection where the browser reports one (`navigator.connection`), which always get SD. It fades in over the poster once it plays. The poster alone is shown without JS, with reduced motion (also when the setting changes while the page is open: the video pauses and the poster returns, and it resumes when the setting is turned off again), on Save-Data, on a 2G connection or with `prefers-reduced-data`, if `js/hero-media.js` throws (`.hero__media.is-static`), and in print (where the media and its button are hidden). If the browser refuses to autoplay (Low Power Mode, an autoplay policy), the poster stays and the button offers Play. If the video can't play at all (a missing or truncated file, a wrong MIME type, no H.264 decoder), the poster stays and the button is hidden for the rest of the visit, so there is no control that does nothing.
- **Hero Pause/Play:** a button at the top right of the hero stops the video (WCAG 2.2.2). A visitor's pause sticks until they press Play; nothing resumes it on its own, and it isn't remembered across visits. The video also pauses while the hero is off-screen and in a hidden tab, and resumes when it comes back unless the visitor paused it. A pause caused by scrolling away or hiding the tab is not a visitor's pause, so the button keeps saying Pause. With reduced motion turned on, the button is hidden; turned off again, a paused video comes back with its Play button (and stays paused), an unpaused one resumes.
- **On screen only:** the Lens sits below the fold; its loop and auto-advance run only while it is on screen (an IntersectionObserver pauses them when it scrolls away, and they also stop in a hidden tab).
- **Pause:** the scan loop and the 10-second auto-advance can be stopped with the Pause button next to the view buttons (WCAG 2.2.2). Auto-advance also stops for good as soon as a visitor focuses or uses any Lens control.

### Keeping things in sync

- **Shared header and footer:** each page has `<!-- BEGIN shared:header -->…<!-- END shared:header -->` and the same for the footer. They are copied verbatim, byte for byte, from `index.html` into every page. `404.html` is the one exception: the same blocks with root-absolute links (`./#services` → `/#services`, `packages.html` → `/packages.html`, `packages.html#faq` → `/packages.html#faq`). Edit `index.html`, then copy the blocks to the other pages. The nav marks the current page itself: `js/nav.js` sets `aria-current="page"` on the link whose page matches the URL (section links such as `./#services` are never marked), so the blocks stay identical.
- **JSON-LD mirror:** the JSON-LD shown in the home page's Proof section ("View the JSON-LD") is a copy of the main `@graph` `<script type="application/ld+json">` in `index.html`'s `<head>`. If you edit one, update the other (HTML-escape `&`, `<`, `>` in the `<pre>`). `llms.txt` is no longer shown on the page, so it can change on its own.
- **FAQ:** on `packages.html`, each visible answer in the FAQ section must equal the `text` of its question in the `FAQPage` JSON-LD in that page's `<head>`, placeholder tokens included.
- **Services:** the `Service` nodes in the `index.html` JSON-LD and on each service page share the same `@id`, name, `serviceType` and description. Change both.
- The Lens markup in `index.html` uses `data-slot` / `data-label-key` attributes named after the fields in `js/demo-data.js`. `lens.js` fills them when the business changes, including the hidden text alternative `#lens-desc`. Keep the names matching.
- The company name lives in: every page's `<title>`, meta/OG tags and JSON-LD, `llms.txt`, the two wordmarks (shared header and footer; they read "Legible Technologies", and "Technologies" hides in the header below 960px), the hero sub, the footer copyright, `privacy.html` ("trading as Legible") and `assets/og-image.svg`.
- Run `python3 -m unittest discover -s tests` after edits: it checks the shared blocks, the JSON-LD mirror, the FAQ questions and answers, the Service nodes on index against each service page, the placeholder table, the sitemap and the canonicals, that every relative link and `#anchor` resolves (and none points at the retired home anchors `#contact`, `#packages`, `#about`, `#measure` or `#faq`), that the form lives only in `contact.html`, that the Lens sits in `#shift`, not the hero, that no marquee is left and `#shift` follows the hero directly, that the hero video has no `src`, `autoplay`, `controls` or `poster` (JS loads it), that `js/main.js` starts `js/hero-media.js` in its own `run()` with the poster-only fallback, that the toggle's `[hidden]`, the `.is-static` fallback and print hide what they should, that every page links the ICO, SVG and apple-touch icons, that every hero asset exists within its size budget (SD video ≤ 3 MB, HD ≤ 5 MB, the 960 poster ≤ 80 KB, the 1280 poster ≤ 200 KB), that every file in `assets/hero/` is credited in Third-party media with the Pexels URL, author and licence, that the answer text and its "reading…" cue share one grid cell, and that the reserved heights in `css/hero.css` are the ones `js/lens.js` sets. The behaviour itself is checked in a browser: see Browser checks.

### Browser checks

The scripts in `tools/browser/` drive headless Chrome with puppeteer-core. Nothing is installed in this repo: point `NODE_MODULES` at any `node_modules` folder that has `puppeteer-core` (and `axe-core` for `axe.mjs`), `CHROME` at a Chrome binary (default: the macOS Google Chrome), and `BASE` at the served site (default `http://127.0.0.1:8000/`). Each prints PASS/FAIL lines and exits non-zero on a failure.

```sh
python3 -m http.server 8000 &
export NODE_MODULES=/path/to/node_modules
node tools/browser/lens-stability.mjs   # Lens card + frame heights, .shift__close steady, resize behaviour
node tools/browser/hero-media.mjs       # hero video: renditions, Pause/Play states, gating, failure, print, overlap
node tools/browser/hero-contrast.mjs    # hero text contrast over every 0.25 s of both renditions (add --target 5 to tighten)
node tools/browser/contact-layout.mjs   # contact two-column layout, stacking, tab order, submit message
node tools/browser/band-contrast.mjs    # header + page-hero text, hover backings and focus rings over the ocean band, all 11 pages
node tools/browser/axe.mjs              # axe-core on home (motion, reduced motion, no JS) and contact
```

`lens-stability.mjs` covers 320, 340, 375, 768 and 1440 px with and without reduced motion; `hero-contrast.mjs` loads each clip as a blob so every seek works on servers without Range support, keeps a sample only if it is at least 1/30 s after the last kept one, and always keeps the last frame before the loop point. `band-contrast.mjs` runs every page at 375, 768 and 1440 (and 960 for "Technologies"): the brightest band pixel under each text box (pills measured inside their border), "Get started" and Menu hovered, and the band beside each header control's focus ring (≥ 3:1); the figures go in the `css/tokens.css` header.
- If you edit `assets/og-image.svg`, re-render the PNG. Either serve the site, open `/assets/og-image.svg` in Chrome at a 1200×630 viewport and take a screenshot (DevTools → Run command → "Capture screenshot"), or script it: serve the repo root (`python3 -m http.server 8000`, so `../fonts/*.woff2` resolve) and, with puppeteer-core and the system Chrome, set the viewport to 1200×630 at `deviceScaleFactor: 1`, open `http://localhost:8000/assets/og-image.svg`, wait for `document.fonts.ready` and screenshot to `assets/og-image.png` with `clip: {x: 0, y: 0, width: 1200, height: 630}`. Check the result is 1200×630 (`sips -g pixelWidth -g pixelHeight assets/og-image.png`) and set in Geist, not a fallback font. The SVG is XML: a comment can't contain a double hyphen, so name tokens there without one.

### Colours outside the brand palette

The brand palette (Midnight `#0A2540`, Blue `#3B82F6`, Mist `#E5E7EB`, Charcoal `#1F2937`, plus white) is defined in `css/tokens.css`, with one derived page surface, `--night` `#071A2E` (Midnight darkened toward near-black; Midnight itself is the raised surface for panels, inputs and the Lens stage). Every page uses the same dark theme: Mist text, `--fg-soft` (Mist at .66) for secondary text, Mist hairlines, faint grid lines, the Midnight-tinted ocean band behind the site header and each inner-page hero (fading into the page; it replaces the bloom there), and the soft Blue bloom wherever `.has-bloom` is used outside those heroes. Other files use those tokens, or `rgba()` alphas of the same values. Raw Blue fails WCAG AA for normal-size text, so it is used only for fills, the logo, the bloom and small dots; `tokens.css` also defines derived tints (`--blue-400` `#60A5FA` for the form status text, `--blue-600`, `--blue-700` and `--slate` for print and the light mock), and its header comment holds the measured contrast table. The Lens chrome (controls, stage, caption, answer card) uses the same tokens. The only colours outside the system are the fictional client sites inside the Lens frame (their `[data-biz]` themes, shapes, star, chart and button colours in `css/hero.css`, plus the overlays drawn on top of those light mocks; the saas chart's remainder colour is the `--mock-chart-rest` token in `css/tokens.css`), and `--font-serif` is a system-only serif stack kept for the fictional coffee mock. Those are other companies' "brands" inside the demo, not Legible's. The home hero's video scrim is built only from `rgba()` alphas of `--night`, `--midnight` and Blue; the video and poster are mirrored (surf away from the headline), and the scrim's bottom layer, a Blue wash at .14, pulls the teal footage toward the brand blues. That is deliberately not a CSS `filter`: a `hue-rotate`/`saturate` filter on the full-bleed video and poster cost ~800 ms of Total Blocking Time in Lighthouse. The stock ocean footage, its poster and the ocean band cut from it are the one photographic, non-palette image on the site, like the Lens's fictional mocks. The standalone SVGs (`assets/favicon.svg`, `assets/og-image.svg`, `assets/founder-placeholder.svg`) can't read CSS tokens, so they repeat the hex values: the OG image uses `--night` `#071A2E`, Mist `#E5E7EB` (the second headline line at the `--fg-soft` alpha) and Blue `#3B82F6`.

### Third-party media

The home hero's background video is stock footage, free for commercial use without attribution under its licence (credited here anyway):

| | |
| --- | --- |
| Clip | "A Drone Footage of Ocean Waves" |
| Source | <https://www.pexels.com/video/a-drone-footage-of-ocean-waves-6981292/> |
| Author | Mikhail Nilov (Pexels user `Mikhail-Nilov`) |
| Licence | Pexels License, <https://www.pexels.com/license/> |
| Downloaded | 2026-10-13 |
| `assets/hero/ocean-540.mp4` | Pexels' 960×540 rendition (`6981292-sd_960_540_25fps.mp4`), H.264, 11.8 s, 2,813,303 B |
| `assets/hero/ocean-720.mp4` | Pexels' 1280×720 rendition (`6981292-hd_1280_720_25fps.mp4`), H.264, 11.8 s, 4,067,135 B |
| `assets/hero/ocean-poster-1280.webp` | Frame 0 of `ocean-720.mp4` (the HD rendition the page plays), 1280×720, 98,406 B |
| `assets/hero/ocean-poster-960.webp` | Frame 0 of the same, 960×540, 64,706 B |
| `assets/hero/ocean-band-1920.webp` | Frame 0 of Pexels' 1920×1080 rendition (not shipped), rows 30–75 %, mirrored, tinted (`color` blend `#1E4A86`, then `multiply` `#8A9BB8`), 1920×480, 39,402 B |
| `assets/hero/ocean-band-960.webp` | The same strip (same rows, mirror and tint) at 960×240, also 4:1, 14,938 B |

The renditions are used as downloaded (no re-encode). The SD file is over the old 2.5 MB budget (3 MB now): it's Pexels' smallest rendition that stays sharp enough on a phone (the next one down is 640×360), and there's no ffmpeg here to re-encode. The 1920×1080 rendition (7.8 MB) is only the source for the bands. The posters are frame 0 of `ocean-720.mp4` at no more than its own 1280×720, so the video's fade-in doesn't jump in framing or sharpness. To remake the stills: serve a folder holding `ocean-720.mp4` and Pexels' 1920×1080 rendition over HTTP and, with puppeteer-core and the system Chrome, open a same-origin page (so the canvas isn't tainted), load a clip in a `<video>`, wait for `loadeddata`, set `currentTime = 0` and wait for `seeked`, then draw it to a canvas. Posters: from `ocean-720.mp4`, 1280×720 and 960×540, exported with `canvas.toDataURL('image/webp', 0.8)`. Bands: from the 1920×1080 rendition, draw rows 30–75 % mirrored into 1920×480 and 960×240 (both 4:1, so the two show the same framing under `background-size: cover`), fill `#1E4A86` with `globalCompositeOperation = 'color'` and `#8A9BB8` with `'multiply'`, and export at 0.7. Keep the posters within 200 KB / 80 KB (lower the quality if not), and check sizes with `sips -g pixelWidth -g pixelHeight`. If you change the clip, update the posters' `width`/`height` in `index.html` and this table.

## Placeholders

Every unknown fact (person, price, timeline, result, contact detail, legal entity) is a `PLACEHOLDER_*` token in the source. Find them all with:

```sh
grep -rnoE 'PLACEHOLDER_[A-Z0-9_]+' --exclude-dir=.venv --exclude-dir=.agent --exclude-dir=tests .
```

Absolute URLs that must stay valid (canonical, `og:url`, sitemap `<loc>`, JSON-LD `url`/`@id`/`logo`) can't hold a token, so they keep the reserved `https://example.com` and are named by a token in a comment instead. The test checks that this table and the tokens in the source match both ways.

| Token | What it is | Where |
| --- | --- | --- |
| `PLACEHOLDER_SITE_URL` | The real site base URL, replacing every `https://example.com` (see Configuration) | comment in the `<head>` of `index.html`, `packages.html`, `about.html`, `contact.html`, the five service pages and `privacy.html`, plus `sitemap.xml` and `robots.txt`. The URLs themselves are also in those pages' meta tags and JSON-LD and in `llms.txt` (`404.html` has none) |
| `PLACEHOLDER_CONTACT_EMAIL` | Public contact email | shared footer on every page (`index.html`, `packages.html`, `about.html`, `contact.html`, `ai-visibility-audit.html`, `machine-readable-foundations.html`, `answer-ready-content.html`, `brand-signal-monitoring.html`, `internal-ai-readiness.html`, `privacy.html`, `404.html`), the form's pre-launch notice and email fallback links in `contact.html`, JSON-LD `email` in `index.html`, `llms.txt` |
| `PLACEHOLDER_FORM_ENDPOINT` | Form provider's POST URL (`action` of `.contact-form`); once set, also delete the pre-launch notice paragraph marked by this token | `contact.html` |
| `PLACEHOLDER_PLAUSIBLE_DOMAIN` | Domain as registered in Plausible | `js/config.js` |
| `PLACEHOLDER_RESPONSE_TIME` | Response-time promise under the form (replaces the invented "< 1 business day"; delete the line if there is none) | `contact.html` |
| `PLACEHOLDER_LOGO` | Real logo URL for the JSON-LD `logo` (currently the favicon) | comment in the `<head>` of `index.html`, `packages.html`, `about.html`, `contact.html`, the five service pages and `privacy.html`, next to the JSON-LD that holds the value |
| `PLACEHOLDER_COMPANY_LINKEDIN` | Company LinkedIn slug (`sameAs`) | `index.html` JSON-LD |
| `PLACEHOLDER_AREA_SERVED` | Where Legible works (country, region or "Worldwide") | `index.html` JSON-LD, the `Service` JSON-LD on `ai-visibility-audit.html`, `machine-readable-foundations.html`, `answer-ready-content.html`, `brand-signal-monitoring.html`, `internal-ai-readiness.html`, `llms.txt` |
| `PLACEHOLDER_FOUNDER_NAME` | Founder's name | `about.html` founder block and image alt, `index.html` JSON-LD `founder`, `llms.txt` |
| `PLACEHOLDER_FOUNDER_ROLE` | Founder's job title | `about.html` founder block, `index.html` JSON-LD `founder`, `llms.txt` |
| `PLACEHOLDER_FOUNDER_BIO` | Short founder bio | `about.html` founder block |
| `PLACEHOLDER_FOUNDER_PHOTO` | Real portrait to replace `assets/founder-placeholder.svg` (also referenced by the JSON-LD `founder.image`) | comment in `about.html` founder block, `assets/founder-placeholder.svg` |
| `PLACEHOLDER_FOUNDER_LINKEDIN` | Founder's LinkedIn slug | `about.html` LinkedIn link, `index.html` JSON-LD `founder.sameAs` |
| `PLACEHOLDER_PRICE_AUDIT` | Starting price of the AI visibility audit | `packages.html`, `llms.txt` |
| `PLACEHOLDER_PRICE_MONITORING` | Starting price of the monitoring retainer, including the billing unit | `packages.html`, `llms.txt` |
| `PLACEHOLDER_TIMELINE_SNAPSHOT` | Turnaround of the free AI snapshot | `packages.html`, `llms.txt` |
| `PLACEHOLDER_TIMELINE_AUDIT` | Turnaround of the audit | `packages.html`, `llms.txt` |
| `PLACEHOLDER_TIMELINE_MONITORING` | Term of the monitoring retainer | `packages.html`, `llms.txt` |
| `PLACEHOLDER_FAQ_TIME_TO_RESULTS` | Answer to "How long until we see results?" (visible FAQ and `FAQPage` JSON-LD must match) | `packages.html` FAQ and FAQPage JSON-LD |
| `PLACEHOLDER_LEGAL_ENTITY_NAME` | Legal entity that runs the site | `privacy.html` |
| `PLACEHOLDER_PRIVACY_CONTACT_EMAIL` | Email for privacy requests | `privacy.html` |
| `PLACEHOLDER_PRIVACY_EFFECTIVE_DATE` | Date the privacy notice takes effect | `privacy.html` |
| `PLACEHOLDER_FORM_PROVIDER_NAME` | Name of the form provider | `privacy.html` |
| `PLACEHOLDER_FORM_PROVIDER_PRIVACY_URL` | Form provider's privacy policy URL | `privacy.html` |
| `PLACEHOLDER_DATA_RETENTION` | How long contact form messages and emails are kept | `privacy.html` |
| `PLACEHOLDER_PRIVACY_JURISDICTION_TEXT` | Jurisdiction-specific rights wording (e.g. GDPR, CCPA) | `privacy.html` |
| `PLACEHOLDER_CLIENT_PROOF` | Client logos / case-study tiles; `.proof__clients` stays `hidden` until real, approved proof exists | comment in `index.html` Proof section |

`privacy.html` is a template to be reviewed, not legal advice. Have it checked before launch.

Not tokens, listed here with the reason:

| What | Where | Current value |
| --- | --- | --- |
| Company name | see "Keeping things in sync": decided for now, and it appears in too many places to mark each one | Legible |
| Logo | the L mark + Geist wordmark with a Geist Mono "Technologies" descriptor after a hairline (inline SVG in the shared header and footer) and `assets/favicon.svg`: hand-traced from the brand sheet, pending the official vector | L mark |
| Copy and tone | all page copy, `llms.txt`: it's every sentence on the site | placeholder editorial copy for approval |
| FAQ answers needing owner approval | `packages.html` FAQ ("Is this just SEO?", "Can you guarantee we’ll be cited?", "Do I need a new website?") and the matching `FAQPage` JSON-LD | written from existing copy; confirm "we work with the site you have" in particular |
| Service pages' "Where it fits" | the five service pages: four name their method step (Internal AI Readiness has none and is described only as an optional add-on), and all link to the packages without saying which package includes them, because no mapping was supplied | confirm the method-step wording, and add a package mapping if you want one |
| Hero footage | `assets/hero/`: a free stock clip (see Third-party media), not a commissioned asset | Pexels 6981292, "A Drone Footage of Ocean Waves"; replace if desired |
| Fictional demo businesses | `js/demo-data.js` and the first business hard-coded in `index.html`: deliberate demo content, not a stand-in for real data | Hollis & Pine, Northgate Family Dental, Ledgerline on `.example` domains |

There are no `TODO:` markers. The only statistic on the site is the research finding in the Proof section: Aggarwal et al., “GEO: Generative Engine Optimization,” KDD 2024 (<https://arxiv.org/abs/2311.09735>), worded as supplied. Legible's own pilot results are not published yet ("Pilot results publishing soon").

## Audit (2026-10-14: home and contact, with the ocean header band, the 1280/960 posters and the "Technologies" wordmark)

Run headless on a local server with Chrome. Lighthouse 12.8.2, mobile preset, on the gzip server (`python3 tools/gzserve.py`, gzip + cache headers like a typical host); medians of five runs (`tools/lighthouse.sh`).

| Page | Performance | Accessibility | Best Practices | SEO | LCP (element) | CLS | TBT | Speed Index |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home (`index.html`), 2026-10-14 | 90 (runs 73–98) | 100 | 100 | 100 | 2.14 s (the hero poster `img.hero__poster`) | 0 | 387 ms (runs 11–1,410) | 1.5 s |
| Contact (`contact.html`), 2026-10-14 | 99 (runs 99–100) | 100 | 100 | 100 | 1.68 s (`section.page-hero`: the band behind the hero) | 0 | 0 ms | 1.4 s |

- Home LCP misses the ≤ 2.0 s target: the median is 2.14 s, and the five runs are 1.97, 2.00, 2.14, 2.27 and 2.27 s. Lighthouse's breakdown, per run: TTFB 459–474 ms, load delay 0–44 ms, load time 0–234 ms, render delay 1,245–1,811 ms. So the poster arrives early. Most of the LCP is the wait until it can be painted, behind the three render-blocking stylesheets (Lighthouse estimates a 0–386 ms saving if they didn't block). A smaller poster would barely move it. The header band (`ocean-band-960.webp`, 15 KB) doesn't compete in any meaningful way. It is requested only once `main.css` has arrived, after the poster's request has started, and overlaps only the last few milliseconds of the poster's download (for example 76–101 ms against the poster's 45–88 ms in run 1).
- TBT: earlier runs had spikes of 515 and 874 ms (Performance 86 and 79). They came from `lens.js` measuring every business at start-up and again when the fonts arrived. `reserve()` now runs once, when the browser is idle (within 500 ms), and again only if the Lens's width changes or the fonts weren't in yet. TBT was then 0–4 ms. On 2026-10-14 it was 11–1,410 ms over the five home runs (median 387 ms). The long tasks were start-up script (`lens.js` up to 344 ms) and unattributed style and layout work, and two runs stayed under 25 ms. So it is noisy, not a steady cost. Contact was 0 ms in every run. A `hue-rotate`/`saturate` CSS filter on the video and poster, tried for this clip, pushed it to 855 ms (Performance 78), so the tint is a Blue scrim layer instead (see Colours outside the brand palette). The rest of the main-thread work is the document's own first style and layout pass (about 0.2–0.3 s at Lighthouse's 4× CPU slowdown).
- The video doesn't count against first paint: it is requested only after `load`. On Lighthouse's mobile viewport (412 px CSS width, below 1024) that is the SD file, 2,813,303 B; screens 1024 px wide and up get the HD file, 4,067,135 B. Home's total transfer is 2.99 MB, of which 2.81 MB is the video. Contact's is 97 KB, including the 15 KB band, which the header and the page hero share as a single request.
- Hero text contrast over the video (`tools/browser/hero-contrast.mjs`, 348 frames over both renditions at 375, 768 and 1440): the worst cases are in the `css/tokens.css` header. The sub is at 4.9:1.
- axe-core 4.14 (`tools/browser/axe.mjs`): 0 violations on home with the video playing (1440 and 375 touch), with reduced motion and without JS, and on contact at 1440 and 375 touch.
- JS: 26,795 B of source in `js/` (`hero-media.js` is 2,852 B) plus the 164 B inline script. The old < 16,000 B budget no longer holds; it predates the contact form, analytics and the hero video.
- Not re-run for this change: html-validate (0 problems with the `standard` preset on 2026-10-09, before the multi-page change) and validator.schema.org (0 errors, 0 warnings then).
