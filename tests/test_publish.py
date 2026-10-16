"""Publish gate and deploy-set checks. Stdlib only.

The publish gate (class PublishGate) fails on anything that must not ship.
Run: python3 -m unittest discover -s tests
"""
import glob
import os
import re
import unittest
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The deploy set: must match the `cp` line in README.md (Deploy).
DEPLOY_FILES = ['*.html', 'llms.txt', 'robots.txt', 'sitemap.xml', 'favicon.ico', '_headers', '_redirects']
DEPLOY_DIRS = ['css', 'js', 'fonts', 'assets']
FORBIDDEN_IN_DIST = ['.agent', '.venv', 'tests', 'tools', 'README.md']
TEXT_EXT = ('.html', '.txt', '.xml', '.css', '.js', '.mjs', '')


def deploy_files():
    out = []
    for pat in DEPLOY_FILES:
        out += glob.glob(os.path.join(ROOT, pat))
    for d in DEPLOY_DIRS:
        for dirpath, _, names in os.walk(os.path.join(ROOT, d)):
            out += [os.path.join(dirpath, n) for n in names]
    return sorted(out)


def text_files():
    return [f for f in deploy_files() if os.path.splitext(f)[1] in TEXT_EXT or os.path.basename(f) in ('_headers', '_redirects')]


def rel(path):
    return os.path.relpath(path, ROOT)


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


class PublishGate(unittest.TestCase):
    def test_no_placeholder_tokens(self):
        hits = [rel(f) for f in text_files() if 'PLACEHOLDER_' in read(f)]
        self.assertEqual(hits, [], 'PLACEHOLDER_ found (comments count)')

    def test_no_example_com(self):
        hits = [rel(f) for f in text_files() if re.search(r'(?<![\w.-])example\.com', read(f))]
        self.assertEqual(hits, [], 'example.com found in the deploy set')

    def test_form_action_https(self):
        action = re.search(r'<form class="contact-form" action="([^"]*)"', read(os.path.join(ROOT, 'contact.html'))).group(1)
        self.assertTrue(action.startswith('https://'), action)

    def test_headers_have_no_plausible(self):
        p = os.path.join(ROOT, '_headers')
        self.assertTrue(os.path.exists(p), '_headers is missing')
        self.assertNotIn('plausible.io', read(p))

    def test_dist_is_clean(self):
        dist = os.path.join(ROOT, 'dist')
        if not os.path.isdir(dist):
            self.skipTest('no dist/ built')
        present = [n for n in FORBIDDEN_IN_DIST if os.path.exists(os.path.join(dist, n))]
        self.assertEqual(present, [])
        for n in ('favicon.ico', '_headers', 'index.html'):
            self.assertTrue(os.path.exists(os.path.join(dist, n)), f'dist/ lacks {n}')


class DeployCompleteness(unittest.TestCase):
    def test_local_references_resolve_in_deploy_set(self):
        shipped = {os.path.abspath(f) for f in deploy_files()}
        attr = re.compile(r'\b(?:href|src)="([^"]*)"')
        srcset = re.compile(r'\bsrcset="([^"]*)"')
        bad = []
        for page in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
            src = read(page)
            refs = attr.findall(src)
            for s in srcset.findall(src):
                refs += [part.strip().split()[0] for part in s.split(',') if part.strip()]
            for ref in refs:
                u = urlsplit(ref)
                if u.scheme or u.netloc or not u.path or ref.startswith(('#', 'mailto:', 'data:')):
                    continue
                path = unquote(u.path)
                target = os.path.join(ROOT, path.lstrip('/')) if path.startswith('/') else os.path.join(os.path.dirname(page), path)
                target = os.path.abspath(target)
                if os.path.isdir(target):
                    target = os.path.join(target, 'index.html')
                if target not in shipped:
                    bad.append((rel(page), ref))
        self.assertEqual(bad, [], 'references that resolve outside the deploy set')

    def test_readme_cp_line_covers_deploy_set(self):
        line = next(l for l in read(os.path.join(ROOT, 'README.md')).splitlines() if l.startswith('mkdir -p dist'))
        for name in ('*.html', 'llms.txt', 'robots.txt', 'sitemap.xml', 'favicon.ico', '_headers', 'css', 'js', 'fonts', 'assets'):
            self.assertIn(name, line)
        for name in ('tests', 'tools', '.agent', '.venv', 'README.md'):
            self.assertNotIn(name, line)


if __name__ == '__main__':
    unittest.main()
