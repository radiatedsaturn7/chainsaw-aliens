import functools
import http.client
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile
import threading
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
from media_ranges import MediaRangeMixin
class Handler(MediaRangeMixin, SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
class MediaRangeTests(unittest.TestCase):
    def test_seeking_full_suffix_invalid_and_head(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, 'song.mp3').write_bytes(b'0123456789')
            server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=directory))
            thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
            try:
                for method, headers, status, body in [('GET', {}, 200, b'0123456789'), ('GET', {'Range':'bytes=3-5'}, 206, b'345'), ('GET', {'Range':'bytes=-2'}, 206, b'89'), ('GET', {'Range':'bytes=8-'}, 206, b'89'), ('GET', {'Range':'bytes=99-'}, 416, b''), ('HEAD', {'Range':'bytes=2-4'}, 206, b'')]:
                    connection=http.client.HTTPConnection(*server.server_address)
                    connection.request(method, '/song.mp3', headers=headers)
                    response=connection.getresponse();self.assertEqual(response.status,status);self.assertEqual(response.read(),body);connection.close()
            finally: server.shutdown();server.server_close();thread.join()
if __name__ == '__main__': unittest.main()
