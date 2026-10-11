"""Static site checks. Stdlib only. Run: python3 -m unittest discover -s tests"""
import glob
import html
import json
import os
import re
import unittest
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://example.com'
TOKEN = re.compile(r'PLACEHOLDER_[A-Z0-9_]+')
NAV = ['./#services', './#packages', './#method', './#about', './#faq', './#contact']


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

    def test_index_org_and_faq(self):
        src = read('index.html')
        docs = [json.loads(b) for b in ld_blocks(src)]
        graph = next(d['@graph'] for d in docs if '@graph' in d)
        org = next(n for n in graph if n['@type'] == 'Organization')
        for key in ('logo', 'sameAs', 'founder', 'areaServed'):
            self.assertIn(key, org)
        faq = next(d for d in docs if d.get('@type') == 'FAQPage')
        self.assertEqual(len(faq['mainEntity']), 4)
        section = re.search(r'<section[^>]*id="faq".*?</section>', src, re.S).group(0)
        visible = [html.unescape(s) for s in re.findall(r'<summary>(.*?)</summary>', section, re.S)]
        self.assertEqual(len(visible), len(faq['mainEntity']))
        for q in faq['mainEntity']:
            self.assertIn(q['name'], visible)

    def test_faq_answers_match_visible(self):
        src = read('index.html')
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


class Research(unittest.TestCase):
    def test_research_block(self):
        src = read('index.html')
        proof = re.search(r'<section[^>]*id="proof".*?</section>', src, re.S).group(0)
        start = proof.index('<figure class="research"')
        rest = proof[start:]
        self.assertIn('https://arxiv.org/abs/2311.09735', rest[:rest.index('</figure>')])
        self.assertIn('Pilot results publishing soon', rest)


if __name__ == '__main__':
    unittest.main()
