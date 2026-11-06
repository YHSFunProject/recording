"""本地预览服务器：静态托管 prototype/，禁用缓存以便修改即时生效。"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent / "prototype"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


handler = functools.partial(NoCacheHandler, directory=str(ROOT))
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
