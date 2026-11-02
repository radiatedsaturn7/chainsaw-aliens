"""Byte-range responses for browser audio seeking on the project server."""
import re
from pathlib import Path

class MediaRangeMixin:
    def send_head(self):
        self.media_bytes_remaining = None
        path = Path(self.translate_path(self.path))
        if path.suffix.lower() not in {'.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm', '.mp4'} or not path.is_file():
            return super().send_head()
        stream = path.open('rb')
        size = path.stat().st_size
        start, end = 0, size - 1
        header = self.headers.get('Range') if not self.headers.get('If-Range') else None
        if header:
            match = re.fullmatch(r'bytes=(\d*)-(\d*)', header.strip())
            try:
                if not match or not any(match.groups()): raise ValueError()
                first, last = match.groups()
                if first:
                    start = int(first)
                    end = min(int(last), size - 1) if last else size - 1
                else:
                    if int(last) <= 0: raise ValueError()
                    start = max(0, size - int(last))
                if start > end or start >= size: raise ValueError()
            except ValueError:
                stream.close()
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{size}')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return None
        self.send_response(206 if header else 200)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(max(0, end - start + 1)))
        if header: self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        stream.seek(start)
        self.media_bytes_remaining = max(0, end - start + 1)
        return stream

    def copyfile(self, source, outputfile):
        remaining = getattr(self, 'media_bytes_remaining', None)
        if remaining is None: return super().copyfile(source, outputfile)
        while remaining > 0:
            chunk = source.read(min(65536, remaining))
            if not chunk: break
            outputfile.write(chunk)
            remaining -= len(chunk)
