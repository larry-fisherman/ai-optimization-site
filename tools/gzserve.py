"""Static server with gzip and cache headers, like a typical host (for Lighthouse).
Usage: python3 tools/gzserve.py [port]   (serves the repo root; default port 8767)"""
import functools, gzip, http.server, io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TYPES = ('.html', '.css', '.js', '.svg', '.txt', '.xml', '.json')


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        html = self.path.endswith(('.html', '/'))
        self.send_header('Cache-Control', 'no-cache' if html else 'public, max-age=31536000')
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            path = os.path.join(path, 'index.html')
        if path.endswith(TYPES) and os.path.isfile(path) and 'gzip' in self.headers.get('Accept-Encoding', ''):
            with open(path, 'rb') as f:
                data = gzip.compress(f.read(), 9)
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type(path))
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            return io.BytesIO(data)
        return super().send_head()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8767
    http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Handler, directory=ROOT)).serve_forever()
