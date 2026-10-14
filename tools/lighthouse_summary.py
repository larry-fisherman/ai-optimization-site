"""Summarise Lighthouse JSON runs in a directory: each run, then medians."""
import glob, json, statistics, sys

rows = []
for f in sorted(glob.glob(sys.argv[1] + '/run-*.json')):
    j = json.load(open(f))
    c, a = j['categories'], j['audits']
    try:
        el = a['largest-contentful-paint-element']['details']['items'][0]['items'][0]['node']['selector']
    except (KeyError, IndexError):
        el = '?'
    lcpb = {}
    try:
        for it in a['largest-contentful-paint-element']['details']['items'][1]['items']:
            lcpb[it['phase']] = round(it['timing'])
    except (KeyError, IndexError):
        pass
    r = dict(perf=c['performance']['score'] * 100, a11y=c['accessibility']['score'] * 100,
             bp=c['best-practices']['score'] * 100, seo=c['seo']['score'] * 100,
             lcp=a['largest-contentful-paint']['numericValue'], cls=a['cumulative-layout-shift']['numericValue'],
             tbt=a['total-blocking-time']['numericValue'], si=a['speed-index']['numericValue'],
             fcp=a['first-contentful-paint']['numericValue'], bytes=a['total-byte-weight']['numericValue'])
    rows.append(r)
    print(f.split('/')[-1], ' '.join(f'{k}={v:.0f}' if k != 'cls' else f'{k}={v:.3f}' for k, v in r.items()), el, lcpb)
if rows:
    print('median', ' '.join(f'{k}={statistics.median(r[k] for r in rows):.{3 if k == "cls" else 0}f}' for k in rows[0]))
    print('min perf', min(r['perf'] for r in rows))
