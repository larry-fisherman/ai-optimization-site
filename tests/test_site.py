"""Static site checks. Stdlib only. Run: python3 -m unittest discover -s tests"""
import glob
import html
import json
import os
import re
import unittest
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://legibletechnologies.com'
TOKEN = re.compile(r'PLACEHOLDER_[A-Z0-9_]+')
NAV = ['./#services', './#method', 'packages.html', 'about.html', 'contact.html']


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def pages():
    return sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT, '*.html')))


def block(src, name):
    m = re.search(r'<!-- BEGIN shared:%s -->.*?<!-- END shared:%s -->' % (name, name), src, re.S)
    return m.group(0) if m else None


def normalise_404(b):
    # 404.html is served at any depth, so its links are root-absolute.
    # Documented normalisation: href="/#x" -> href="./#x", href="/file" -> href="file".
    b = b.replace('href="/#', 'href="./#')
    return re.sub(r'href="/(?=[^/])', 'href="', b)


def ld_blocks(src):
    return re.findall(r'<script type="application/ld\+json">\n?(.*?)\n?\s*</script>', src, re.S)


def sitemap_locs():
    tree = ET.parse(os.path.join(ROOT, 'sitemap.xml'))
    ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    return {e.text.strip() for e in tree.getroot().findall('s:url/s:loc', ns)}


def page_url(name):
    return BASE + '/' if name == 'index.html' else BASE + '/' + name


class SharedChrome(unittest.TestCase):
    def test_blocks_identical(self):
        index = read('index.html')
        for name in ('header', 'footer'):
            ref = block(index, name)
            self.assertIsNotNone(ref, f'index.html has no shared:{name} block')
            for p in pages():
                if p == 'index.html':
                    continue
                b = block(read(p), name)
                self.assertIsNotNone(b, f'{p} has no shared:{name} block')
                if p == '404.html':
                    b = normalise_404(b)
                self.assertEqual(b, ref, f'{p} shared:{name} differs from index.html')

    def test_wordmark_technologies(self):
        index = read('index.html')
        for name in ('header', 'footer'):
            b = block(index, name)
            self.assertIn('aria-label="Legible Technologies, home"', b, name)
            self.assertIn('<span class="wordmark__text">Legible</span> <span class="wordmark__sub">Technologies</span>', b, name)

    def test_footer_year(self):
        self.assertIn('data-year', block(read('index.html'), 'footer'))


class NoMailtoButtonsNoBadge(unittest.TestCase):
    def test_no_mailto_buttons(self):
        for p in pages():
            self.assertIsNone(re.search(r'<a class="button[^"]*" href="mailto:', read(p)), p)

    def test_no_badge(self):
        files = pages() + [os.path.relpath(f, ROOT) for f in glob.glob(os.path.join(ROOT, 'css', '*.css'))]
        for f in files:
            src = read(f)
            self.assertNotIn('site-header__status', src, f)
            self.assertNotIn('status-dot', src, f)
            self.assertIsNone(re.search('indexed', src, re.I), f)
        self.assertIn('@keyframes pulse', read('css/main.css'))


class JsonLd(unittest.TestCase):
    def test_all_parse(self):
        for p in pages():
            for b in ld_blocks(read(p)):
                with self.subTest(page=p):
                    json.loads(b)

    def test_index_org(self):
        src = read('index.html')
        docs = [json.loads(b) for b in ld_blocks(src)]
        graph = next(d['@graph'] for d in docs if '@graph' in d)
        org = next(n for n in graph if n['@type'] == 'Organization')
        for key in ('logo', 'founder', 'areaServed'):
            self.assertIn(key, org)
        # the FAQ lives on packages.html now
        self.assertNotIn('FAQPage', src)

    def test_faq(self):
        src = read('packages.html')
        docs = [json.loads(b) for b in ld_blocks(src)]
        faq = next(d for d in docs if d.get('@type') == 'FAQPage')
        self.assertEqual(len(faq['mainEntity']), 4)
        section = re.search(r'<section[^>]*id="faq".*?</section>', src, re.S).group(0)
        visible = [html.unescape(s) for s in re.findall(r'<summary>(.*?)</summary>', section, re.S)]
        self.assertEqual(len(visible), len(faq['mainEntity']))
        for q in faq['mainEntity']:
            self.assertIn(q['name'], visible)

    def test_faq_answers_match_visible(self):
        src = read('packages.html')
        faq = next(json.loads(b) for b in ld_blocks(src) if '"FAQPage"' in b)
        section = re.search(r'<section[^>]*id="faq".*?</section>', src, re.S).group(0)
        visible = {html.unescape(q): html.unescape(re.sub(r'<[^>]+>', '', a))
                   for q, a in re.findall(r'<summary>(.*?)</summary>\s*<p>(.*?)</p>', section, re.S)}
        for q in faq['mainEntity']:
            self.assertEqual(q['acceptedAnswer']['text'], visible.get(q['name']), q['name'])

    def test_service_nodes_match_pages(self):
        graph = json.loads(ld_blocks(read('index.html'))[0])['@graph']
        on_index = {n['@id']: n for n in graph if n['@type'] == 'Service'}
        self.assertEqual(len(on_index), 5)
        for sid, node in on_index.items():
            page = node['url'][len(BASE) + 1:]
            with self.subTest(page=page):
                sub = json.loads(ld_blocks(read(page))[0])['@graph']
                svc = [n for n in sub if n['@type'] == 'Service']
                self.assertEqual(len(svc), 1)
                for key in ('@id', 'url', 'name', 'serviceType', 'description', 'provider'):
                    self.assertEqual(svc[0][key], node[key], key)

    def test_mirror_identical(self):
        src = read('index.html')
        head = ld_blocks(src)[0]
        pre = re.search(r'<pre[^>]*id="src-jsonld"[^>]*>(.*?)</pre>', src, re.S).group(1)
        self.assertEqual(html.unescape(pre), head)


class Placeholders(unittest.TestCase):
    def test_tokens_match_readme(self):
        files = []
        for pat in ('*.html', '*.txt', '*.xml', 'js/*.js', 'assets/*.svg'):
            files += glob.glob(os.path.join(ROOT, pat))
        used = set()
        for f in files:
            with open(f, encoding='utf-8') as fh:
                used |= set(TOKEN.findall(fh.read()))
        readme = read('README.md')
        table = readme[readme.index('## Placeholders'):]
        listed = set(re.findall(r'^\| `(PLACEHOLDER_[A-Z0-9_]+)`', table, re.M))
        self.assertEqual(used - listed, set(), 'tokens in the source missing from the README table')
        self.assertEqual(listed - used, set(), 'README rows for tokens no longer in the source')


class SitemapAndCanonical(unittest.TestCase):
    def test_sitemap(self):
        expected = {page_url(p) for p in pages() if p != '404.html'}
        self.assertEqual(sitemap_locs(), expected)

    def test_404(self):
        src = read('404.html')
        self.assertIn('noindex', src)
        self.assertNotIn(BASE + '/404.html', sitemap_locs())
        self.assertNotIn('rel="canonical"', src)

    def test_canonicals(self):
        locs = sitemap_locs()
        for p in pages():
            if p == '404.html':
                continue
            c = re.findall(r'<link rel="canonical" href="([^"]+)">', read(p))
            self.assertEqual(len(c), 1, p)
            self.assertEqual(c[0], page_url(p), p)
            self.assertIn(c[0], locs, p)


class EveryPage(unittest.TestCase):
    def test_basics(self):
        for p in pages():
            src = read(p)
            with self.subTest(page=p):
                header = block(src, 'header')
                if p == '404.html':
                    header = normalise_404(header)
                hrefs = re.findall(r'<li><a href="([^"]+)">', header)
                self.assertEqual(hrefs, NAV)
                self.assertEqual(len(re.findall(r'<h1[\s>]', src)), 1)
                self.assertRegex(src, r'<title>[^<]+</title>')
                self.assertRegex(src, r'<meta name="description" content="[^"]+">')
                self.assertRegex(src, r'<script type="module" src="/?js/main\.js"></script>')
                # ICO first (Safari, older browsers), then the SVG (Chrome/Firefox prefer it), then iOS
                self.assertRegex(src, r'<link rel="icon" href="/?favicon\.ico" sizes="32x32">\s*'
                                      r'<link rel="icon" href="/?assets/favicon\.svg" type="image/svg\+xml">\s*'
                                      r'<link rel="apple-touch-icon" href="/?assets/apple-touch-icon\.png">')


RETIRED = {'contact', 'packages', 'about', 'measure'}  # home anchors that moved to their own pages


def page_links(p):
    """(href, target page or None, fragment) for every relative href in page p."""
    src = read(p)
    if p == '404.html':
        src = normalise_404(src.replace('href="/"', 'href="./"'))
    out = []
    for href in re.findall(r'\shref="([^"]*)"', src):
        if re.match(r'(https?:|mailto:)', href):
            continue
        path, _, frag = href.partition('#')
        path = path.split('?')[0]
        if path in ('', '.'):
            target = p if href.startswith('#') else 'index.html'
        elif path in ('./', '/'):
            target = 'index.html'
        else:
            target = path[2:] if path.startswith('./') else path
        out.append((href, target, frag))
    return out


def ids(p):
    return set(re.findall(r'\sid="([^"]+)"', read(p)))


class Links(unittest.TestCase):
    def test_files_exist(self):
        for p in pages():
            for href, target, _ in page_links(p):
                with self.subTest(page=p, href=href):
                    self.assertTrue(os.path.isfile(os.path.join(ROOT, target)), f'{p}: {href} -> {target} missing')

    def test_fragments_exist(self):
        for p in pages():
            for href, target, frag in page_links(p):
                if not frag or not target.endswith('.html'):
                    continue
                with self.subTest(page=p, href=href):
                    self.assertIn(frag, ids(target), f'{p}: {href} -> no id="{frag}" in {target}')

    def test_no_retired_anchors(self):
        for p in pages():
            for href, target, frag in page_links(p):
                with self.subTest(page=p, href=href):
                    self.assertNotIn(frag, RETIRED, f'{p}: {href} points at a retired home anchor')
                    self.assertFalse(target == 'index.html' and frag == 'faq', f'{p}: {href} (the FAQ is on packages.html)')


class ContactAndLens(unittest.TestCase):
    def test_contact_form_single_home(self):
        homes = {p: read(p).count('class="contact-form"') for p in pages()}
        self.assertEqual({p: n for p, n in homes.items() if n}, {'contact.html': 1})
        action = re.search(r'<form class="contact-form" action="([^"]*)"', read('contact.html')).group(1)
        self.assertEqual(action, 'https://formspree.io/f/mqpegpzr')

    def test_lens_on_home(self):
        src = read('index.html')
        hero = re.search(r'<section[^>]*class="hero[^"]*"[^>]*>.*?</section>', src, re.S).group(0)
        self.assertNotIn('id="lens"', hero)
        shift = re.search(r'<section[^>]*id="shift".*?</section>', src, re.S).group(0)
        self.assertIn('id="lens"', shift)
        self.assertIn('<link rel="stylesheet" href="css/hero.css">', src)


class HomeOrder(unittest.TestCase):
    def test_no_marquee(self):
        files = ['index.html'] + [os.path.relpath(f, ROOT) for f in glob.glob(os.path.join(ROOT, 'css', '*.css'))]
        for f in files:
            self.assertNotIn('marquee', read(f), f)

    def test_shift_follows_hero(self):
        src = read('index.html')
        hero = re.search(r'<section[^>]*class="hero[^"]*"[^>]*>.*?</section>', src, re.S)
        rest = src[hero.end():]
        rest = re.sub(r'\A(?:\s+|<!--.*?-->)*', '', rest, flags=re.S)
        tag = re.match(r'<[^>]+>', rest).group(0)
        self.assertTrue(tag.startswith('<section'), tag)
        self.assertIn('id="shift"', tag)


def hero_section():
    return re.search(r'<section[^>]*class="hero[^"]*"[^>]*>.*?</section>', read('index.html'), re.S).group(0)


class HeroMedia(unittest.TestCase):
    def test_hero_media_markup(self):
        hero = hero_section()
        video = re.search(r'<video\b[^>]*>', hero).group(0)
        for attr in ('muted', 'playsinline', 'loop'):
            self.assertRegex(video, r'\s%s[\s>=]' % attr)
        for attr in ('autoplay', 'controls', 'poster', 'src='):
            self.assertIsNone(re.search(r'\s%s' % attr, video), attr)
        img = re.search(r'<img class="hero__poster"[^>]*>', hero).group(0)
        self.assertIn('alt=""', img)
        self.assertRegex(img, r'\swidth="\d+"')
        self.assertRegex(img, r'\sheight="\d+"')
        btn = re.search(r'<button type="button" class="hero__media-toggle"[^>]*>', hero).group(0)
        self.assertRegex(btn, r'\shidden[\s>]')

    def test_hero_assets_exist_and_budget(self):
        hero = hero_section()
        paths = re.findall(r'\s(?:src|data-src-[a-z]+)="([^"]+)"', hero)
        for srcset in re.findall(r'\ssrcset="([^"]+)"', hero):
            paths += [part.strip().split()[0] for part in srcset.split(',')]
        self.assertTrue(paths)
        for rel in paths:
            with self.subTest(path=rel):
                self.assertTrue(rel.startswith('assets/hero/'), rel)
                full = os.path.join(ROOT, rel)
                self.assertTrue(os.path.isfile(full), rel)
                size = os.path.getsize(full)
                if rel.endswith('.mp4'):
                    # SD: Pexels' smallest usable rendition of the clip is 2.81 MB; no re-encode
                    self.assertLessEqual(size, 3000000 if rel in re.findall(r'data-src-sd="([^"]+)"', hero) else 5000000)
                elif rel.endswith('-960.webp'):
                    self.assertLessEqual(size, 80000)  # the mobile LCP image
                elif rel.endswith('.webp'):
                    self.assertLessEqual(size, 200000)

    def test_hero_media_credited(self):
        readme = read('README.md')
        media = readme[readme.index('### Third-party media'):]
        media = media[:media.index('\n## ')]
        for f in os.listdir(os.path.join(ROOT, 'assets', 'hero')):
            if f.endswith(('.mp4', '.webp')):
                self.assertIn(f, media)
        self.assertIn('https://www.pexels.com/video/a-drone-footage-of-ocean-waves-6981292/', media)
        self.assertIn('Mikhail Nilov', media)
        self.assertIn('Pexels License', media)
        self.assertIn('https://www.pexels.com/license/', media)

    def test_hero_media_wiring(self):
        self.assertTrue(os.path.isfile(os.path.join(ROOT, 'js', 'hero-media.js')))
        main = read('js/main.js')
        self.assertIn("import { initHeroMedia } from './hero-media.js';", main)
        self.assertRegex(main, r"run\(\(\) => initHeroMedia\(heroMedia, mq\), \(\) => heroMedia\.classList\.add\('is-static'\)\)")
        mod = read('js/hero-media.js')
        self.assertIn('export function initHeroMedia(', mod)
        self.assertIn("addEventListener('error'", mod)

    def test_hero_media_css(self):
        css = read('css/main.css')
        self.assertIn('.hero__media-toggle[hidden] { display: none; }', css)
        self.assertIn('.hero__media.is-static .hero__video { display: none; }', css)
        prints = css[css.index('@media print'):]
        rule = re.search(r'([^{}]*)\{ display: none !important; \}', prints).group(1)
        for sel in ('.hero__media', '.hero__media-toggle'):
            self.assertIn(sel, rule)


class LensAnswerCard(unittest.TestCase):
    def test_answer_and_cue_share_a_cell(self):
        css = read('css/hero.css')
        self.assertRegex(css, r'\.answer__a > span:last-child \{ grid-area: 1 / 2;')
        cue = re.search(r'\.lens\[data-answer="pending"\] \.answer__a::after \{([^}]*)\}', css).group(1)
        self.assertIn('grid-area: 1 / 2;', cue)
        phone = css[css.index('@media (max-width: 29.99em)'):]
        phone = phone[:phone.index('\n}\n')]
        self.assertRegex(phone, r'\.answer__a > span:last-child,\s*\.lens\[data-answer="pending"\] \.answer__a::after \{ grid-area: 2 / 1; \}')

    def test_reserved_heights_wired(self):
        css, js = read('css/hero.css'), read('js/lens.js')
        for var in ('--lens-q-min', '--lens-a-min', '--lens-s-min', '--lens-mock-min'):
            with self.subTest(var=var):
                self.assertIn('var(%s' % var, css)
                self.assertIn("'%s'" % var, js)


class Research(unittest.TestCase):
    def test_research_block(self):
        src = read('index.html')
        proof = re.search(r'<section[^>]*id="proof".*?</section>', src, re.S).group(0)
        start = proof.index('<figure class="research"')
        rest = proof[start:]
        self.assertIn('https://arxiv.org/abs/2311.09735', rest[:rest.index('</figure>')])
        self.assertNotIn('Pilot results', rest)  # no pilot results exist; the plan removed the line


if __name__ == '__main__':
    unittest.main()
