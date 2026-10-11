# Legible: marketing site

A small multi-page marketing site for **Legible**, a studio that gets businesses found, understood and cited by AI assistants and answer engines. The concept is "Two Readers": every website now has a human reader and a machine reader. The hero demo ("the Lens") shows the same mock webpage as a person sees it and as an AI system parses it.

It has a home page, five service pages, a privacy notice and a 404 page. Plain static HTML, CSS and vanilla ES modules. There's still no build step and no dependencies. There is one optional third-party script (Plausible), loaded only when configured; the contact form posts to the configured endpoint.

Run the site checks (stdlib only) after any edit:

```sh
python3 -m unittest discover -s tests
```

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

That makes a clean `dist/` folder (ignored by git). `tests/` stays out of it. If you have removed files from the site since the last copy, delete `dist/` first. Deploy that folder:

- **Netlify:** drag `dist/` into the dashboard (Sites → Deploy manually). With a connected repo, set the build command to the line above and the publish directory to `dist`.
- **Vercel:** `vercel deploy dist` (framework preset "Other", no build command). With a connected repo, set the build command to the line above and the output directory to `dist`.
- **Cloudflare Pages:** connect the repo, set the build command to the line above and the output directory to `dist`.
- **GitHub Pages:** "Deploy from a branch" publishes everything committed, so use Settings → Pages → Source: **GitHub Actions** with the "Static HTML" starter workflow. Add a step that runs the line above, and set the upload step's `path` to `dist`. If you deploy from a branch anyway, keep `.agent/` and `.venv/` out of the repo (both are in `.gitignore`).

`404.html` sits at the root, where hosts look for it: Netlify, Cloudflare Pages and GitHub Pages serve it automatically for missing pages, and Vercel does too as long as it is at the root, which it is. `python3 -m http.server` doesn't use it (open `/404.html` directly to preview it). Its links and assets are root-absolute (`/css/…`) because hosts serve it at any depth. That assumes the site is served at the domain root: a custom domain, or a GitHub Pages user/organization site (`user.github.io`). On a GitHub Pages *project* site (`user.github.io/repo/`), `/css/main.css` points outside the site and the 404 page loads unstyled.

Most hosts gzip/brotli text files and cache static assets by default. Lighthouse scores better with compression than with plain `python3 -m http.server`, which does neither (see Audit below).

## Configuration

- **Site base URL:** every absolute URL uses `https://example.com` (canonicals, Open Graph, JSON-LD, sitemap, robots, llms.txt). Find them with `grep -rn 'https://example.com' *.html sitemap.xml robots.txt llms.txt` and replace them all at once, for example `sed -i '' 's#https://example.com#https://your-domain#g' *.html sitemap.xml robots.txt llms.txt` (macOS; drop the `''` on GNU sed). Then run the tests: the JSON-LD mirror and canonicals must still match.
- **Form endpoint:** the `action` attribute of `.contact-form` in `index.html` (the only place). Any endpoint that answers 2xx on success works; `js/contact.js` doesn't parse provider-specific responses. While the action starts with `PLACEHOLDER_`, the form shows "The form isn't connected yet" and points to the email link. If JS is off or fails to load, nothing can stop the post, so a static pre-launch notice above the form (`.contact-form__notice`, shown with or without JS) gives the email address instead. **Set the action before launch**, then delete that notice paragraph (it sits under a `PLACEHOLDER_FORM_ENDPOINT` comment). Also set the provider's name and privacy-policy URL in `privacy.html`.
- **Plausible:** set `PLAUSIBLE_DOMAIN` in `js/config.js` (and `PLAUSIBLE_SRC` if you self-host or proxy the script). Use the plain `script.js`: variants such as `script.outbound-links.js` or `script.tagged-events.js` add their own click handling and would double-count the events `analytics.js` already sends. Analytics stays off, with no third-party request, while the domain starts with `PLACEHOLDER_` or is empty.
- **Analytics events** (create them as goals in the Plausible dashboard): `CTA Click` (every `.button` link, including the package buttons; props `label`, `page`), `Email Fallback Click` (the email link under the form; props `label`, `page`), `Contact Form Submit` (successful submit only), `Contact Form Error` and `404` (fired on `404.html`, props `path`). The Lens, copy buttons, menu and FAQ toggles are not tracked. For a tracked link that leaves the page (the service-page buttons), `analytics.js` waits for Plausible's `callback`, or 300 ms at most, before navigating, so the event isn't lost. Clicks with a modifier key or a middle click open the link as usual and may go uncounted.

## Structure

| Path | What it is |
| --- | --- |
| `index.html` | Home page: semantic markup, meta/OG tags, inline JSON-LD (main `@graph` + `FAQPage`), both layers of the hero mock, contact form |
| `ai-visibility-audit.html`, `machine-readable-foundations.html`, `answer-ready-content.html`, `brand-signal-monitoring.html`, `internal-ai-readiness.html` | One page per service, with `WebPage`, `BreadcrumbList` and `Service` JSON-LD |
| `privacy.html` | Privacy notice (a template, see Placeholders) |
| `404.html` | Not-found page, `noindex`, root-absolute paths, not in the sitemap |
| `css/tokens.css` | Palette (the only place brand colours are defined), `@font-face`, type scale, spacing, motion tokens |
| `css/main.css` | Reset, grid, nav, sections (incl. packages, measure, research, about, FAQ, contact form), service/privacy/404 page layout, footer, reveals, grain, print |
| `css/hero.css` | The Lens: mock page, machine-layer annotations, lens ring, scan band, split, answer card |
| `js/main.js` | Entry module: starts each module in isolation, with a no-JS fallback if one fails |
| `js/lens.js` | Pointer lens, scan band, touch drag, Human/Machine view, Pause, business switcher, answer card |
| `js/demo-data.js` | The three fictional businesses the Lens rotates through |
| `js/reveal.js` | Scroll reveals and the typed mono section tags |
| `js/nav.js` | Mobile menu disclosure and copy buttons |
| `js/config.js` | `PLAUSIBLE_DOMAIN`, `PLAUSIBLE_SRC` |
| `js/analytics.js` | Plausible loader (only when configured), `data-track` click events, `track()` |
| `js/contact.js` | Contact form: fetch submit, status messages, mailto fallback |
| `js/year.js` | Sets the footer year |
| `fonts/` | Self-hosted latin woff2: Instrument Serif, Instrument Sans (variable), JetBrains Mono, plus `OFL.txt` |
| `assets/favicon.svg` | Lens mark favicon |
| `assets/og-image.svg` / `.png` | Social card source and its 1200×630 render |
| `assets/founder-placeholder.svg` | Neutral stand-in portrait for the About section |
| `llms.txt`, `robots.txt`, `sitemap.xml` | The machine-facing files |
| `tests/test_site.py` | Site checks (shared chrome, JSON-LD, FAQ and Service sync, placeholders, sitemap, canonicals); not deployed |

### How the page behaves without JS or motion

- **No JS:** all content is readable. The contact form posts straight to its `action` URL, and the footer shows the year written in the HTML. The hero shows a static 50/50 split (human | machine), and the answer card is visible. The Lens controls and copy buttons are hidden, and the nav links show without a Menu button.
- **JS fails:** the page ends up the same as no JS. If `js/main.js` or one of its modules can't load (a 404, `file://`, a blocked script), an inline script in `<head>` removes the `js` class once the page has loaded. If one module throws while starting, only that feature falls back. The year and contact form modules each start in their own `run()`; if one throws, nothing visible changes (the form still posts without JS). `js/analytics.js` (and `js/config.js`) are not part of the static module graph: `main.js` loads them with a dynamic `import()`, so if a blocker, a missing file or a CSP stops them loading, the Lens, menu, reveals, year and form all keep working and only analytics is lost. `contact.js` doesn't import analytics; it queues its events in `window.legibleTrackQ`, which `analytics.js` sends once it has loaded. A failed Lens shows the static split (`.lens.is-static`), a failed nav shows plain links (`html.nav-off`), and failed reveals show everything at once.
- **`prefers-reduced-motion: reduce`:** no lens following, scan band, wipes, typing or auto-advance. The hero stays in the static split, and the Human/Machine view buttons and business tabs still work, with instant swaps. The Pause button is hidden because nothing moves on its own. Changing the setting while the page is open takes effect straight away.
- **Pause:** the scan loop and the 10-second auto-advance can be stopped with the Pause button next to the view buttons (WCAG 2.2.2). Auto-advance also stops for good as soon as a visitor focuses or uses any Lens control.

### Keeping things in sync

- **Shared header and footer:** each page has `<!-- BEGIN shared:header -->…<!-- END shared:header -->` and the same for the footer. They are copied verbatim, byte for byte, from `index.html` into every page. `404.html` is the one exception: the same blocks with root-absolute links (`./#services` → `/#services`, `privacy.html` → `/privacy.html`). Edit `index.html`, then copy the blocks to the other pages.
- **JSON-LD mirror:** the JSON-LD shown in section [06] is a copy of the main `@graph` `<script type="application/ld+json">` in `<head>` (not the separate `FAQPage` script). If you edit one, update the other (HTML-escape `&`, `<`, `>` in the `<pre>`). `llms.txt` is no longer shown on the page, so it can change on its own.
- **FAQ:** each visible answer in section [08] must equal the `text` of its question in the `FAQPage` JSON-LD in `<head>`, placeholder tokens included.
- **Services:** the `Service` nodes in the `index.html` JSON-LD and on each service page share the same `@id`, name, `serviceType` and description. Change both.
- The Lens markup in `index.html` uses `data-slot` / `data-label-key` attributes named after the fields in `js/demo-data.js`. `lens.js` fills them when the business changes, including the hidden text alternative `#lens-desc`. Keep the names matching.
- The company name lives in: every page's `<title>`, meta/OG tags and JSON-LD, `llms.txt`, the two wordmarks (shared header and footer), the hero sub, the footer copyright, `privacy.html` ("trading as Legible") and `assets/og-image.svg`.
- Run `python3 -m unittest discover -s tests` after edits: it checks the shared blocks, the JSON-LD mirror, the FAQ questions and answers, the Service nodes on index against each service page, the placeholder table, the sitemap and the canonicals.
- If you edit `assets/og-image.svg`, re-render the PNG: serve the site, open `/assets/og-image.svg` in Chrome at a 1200×630 viewport and take a screenshot (DevTools → Run command → "Capture screenshot").

### Colours outside the brand palette

The brand palette is defined in `css/tokens.css`. Other files use those tokens, or `rgba()` alphas of the same values. The only other colours are white (the machine layer's ground and print) and the fictional client sites inside the hero mock (their `[data-biz]` themes, shapes, star and button colours in `css/hero.css`). Those are other companies' "brands" inside the demo, not Legible's.

## Placeholders

Every unknown fact (person, price, timeline, result, contact detail, legal entity) is a `PLACEHOLDER_*` token in the source. Find them all with:

```sh
grep -rnoE 'PLACEHOLDER_[A-Z0-9_]+' --exclude-dir=.venv --exclude-dir=.agent --exclude-dir=tests .
```

Absolute URLs that must stay valid (canonical, `og:url`, sitemap `<loc>`, JSON-LD `url`/`@id`/`logo`) can't hold a token, so they keep the reserved `https://example.com` and are named by a token in a comment instead. The test checks that this table and the tokens in the source match both ways.

| Token | What it is | Where |
| --- | --- | --- |
| `PLACEHOLDER_SITE_URL` | The real site base URL, replacing every `https://example.com` (see Configuration) | comment in the `<head>` of `index.html`, the five service pages and `privacy.html`, plus `sitemap.xml` and `robots.txt`. The URLs themselves are also in those pages' meta tags and JSON-LD and in `llms.txt` (`404.html` has none) |
| `PLACEHOLDER_CONTACT_EMAIL` | Public contact email | shared footer on every page (`index.html`, `ai-visibility-audit.html`, `machine-readable-foundations.html`, `answer-ready-content.html`, `brand-signal-monitoring.html`, `internal-ai-readiness.html`, `privacy.html`, `404.html`), the form's email fallback link and JSON-LD `email` in `index.html`, `llms.txt` |
| `PLACEHOLDER_FORM_ENDPOINT` | Form provider's POST URL (`action` of `.contact-form`); once set, also delete the pre-launch notice paragraph marked by this token | `index.html` |
| `PLACEHOLDER_PLAUSIBLE_DOMAIN` | Domain as registered in Plausible | `js/config.js` |
| `PLACEHOLDER_RESPONSE_TIME` | Response-time promise under the form (replaces the invented "< 1 business day"; delete the line if there is none) | `index.html` contact section |
| `PLACEHOLDER_LOGO` | Real logo URL for the JSON-LD `logo` (currently the favicon) | comment in the `<head>` of `index.html`, the five service pages and `privacy.html`, next to the JSON-LD that holds the value |
| `PLACEHOLDER_COMPANY_LINKEDIN` | Company LinkedIn slug (`sameAs`) | `index.html` JSON-LD |
| `PLACEHOLDER_AREA_SERVED` | Where Legible works (country, region or "Worldwide") | `index.html` JSON-LD, the `Service` JSON-LD on `ai-visibility-audit.html`, `machine-readable-foundations.html`, `answer-ready-content.html`, `brand-signal-monitoring.html`, `internal-ai-readiness.html`, `llms.txt` |
| `PLACEHOLDER_FOUNDER_NAME` | Founder's name | `index.html` About section, image alt and JSON-LD `founder`, `llms.txt` |
| `PLACEHOLDER_FOUNDER_ROLE` | Founder's job title | `index.html` About section and JSON-LD `founder`, `llms.txt` |
| `PLACEHOLDER_FOUNDER_BIO` | Short founder bio | `index.html` About section |
| `PLACEHOLDER_FOUNDER_PHOTO` | Real portrait to replace `assets/founder-placeholder.svg` (also referenced by the JSON-LD `founder.image`) | comment in `index.html` About section, `assets/founder-placeholder.svg` |
| `PLACEHOLDER_FOUNDER_LINKEDIN` | Founder's LinkedIn slug | `index.html` About link and JSON-LD `founder.sameAs` |
| `PLACEHOLDER_PRICE_AUDIT` | Starting price of the AI visibility audit | `index.html` Packages, `llms.txt` |
| `PLACEHOLDER_PRICE_MONITORING` | Starting price of the monitoring retainer, including the billing unit | `index.html` Packages, `llms.txt` |
| `PLACEHOLDER_TIMELINE_SNAPSHOT` | Turnaround of the free AI snapshot | `index.html` Packages, `llms.txt` |
| `PLACEHOLDER_TIMELINE_AUDIT` | Turnaround of the audit | `index.html` Packages, `llms.txt` |
| `PLACEHOLDER_TIMELINE_MONITORING` | Term of the monitoring retainer | `index.html` Packages, `llms.txt` |
| `PLACEHOLDER_FAQ_TIME_TO_RESULTS` | Answer to "How long until we see results?" (visible FAQ and `FAQPage` JSON-LD must match) | `index.html` FAQ and FAQPage JSON-LD |
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
| Logo | typographic wordmark + `assets/favicon.svg`: a stand-in by design until a real logo exists | lens mark |
| Copy and tone | all page copy, `llms.txt`: it's every sentence on the site | placeholder editorial copy for approval |
| FAQ answers needing owner approval | `index.html` FAQ ("Is this just SEO?", "Can you guarantee we’ll be cited?", "Do I need a new website?") and the matching `FAQPage` JSON-LD | written from existing copy; confirm "we work with the site you have" in particular |
| Service pages' "Where it fits" | the five service pages: four name their method step (Internal AI Readiness has none and is described only as an optional add-on), and all link to the packages without saying which package includes them, because no mapping was supplied | confirm the method-step wording, and add a package mapping if you want one |
| Fictional demo businesses | `js/demo-data.js` and the first business hard-coded in `index.html`: deliberate demo content, not a stand-in for real data | Hollis & Pine, Northgate Family Dental, Ledgerline on `.example` domains |

There are no `TODO:` markers. The only statistic on the site is the research finding in the Proof section: Aggarwal et al., “GEO: Generative Engine Optimization,” KDD 2024 (<https://arxiv.org/abs/2311.09735>), worded as supplied. Legible's own pilot results are not published yet ("Pilot results publishing soon").

## Audit (2026-10-09, before the multi-page change)

These figures predate the contact form, analytics, new sections and new pages, and have not been re-run. The JS budget (< 16,000 B) is likely exceeded by the new modules and needs re-measuring.

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
