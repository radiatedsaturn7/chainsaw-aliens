"""Local, bounded diagnostic storage, separate from project assets."""
import hashlib
import json
import os
import re
import threading
from pathlib import Path

ROOT = Path('data/server-storage/performance-captures')
MAX_BYTES = 192 * 1024 * 1024
MAX_TOTAL_BYTES = 1024 * 1024 * 1024  # Retain a full mountain run of detailed captures.
LOCK = threading.Lock()


def save(report, root=ROOT):
    if (report.get('version') != 1 or not isinstance(report.get('metadata'), dict)
            or not isinstance(report.get('frames'), list) or len(report['frames']) > 8000
            or report.get('active') is not False):
        raise ValueError('Expected a completed performance capture (maximum 8000 frames)')
    data = json.dumps(report, allow_nan=False, separators=(',', ':')).encode()
    if len(data) > MAX_BYTES:
        raise ValueError(f'Capture exceeds {MAX_BYTES // (1024 * 1024)} MiB')
    capture_id = hashlib.sha256(data).hexdigest()
    with LOCK:
        root.mkdir(parents=True, exist_ok=True)
        destination = root / (capture_id + '.json')
        if not destination.exists():
            temporary = destination.with_suffix('.tmp')
            try:
                temporary.write_bytes(data)
                os.replace(temporary, destination)
            finally:
                temporary.unlink(missing_ok=True)
        files = sorted(root.glob('*.json'), key=lambda p: p.stat().st_mtime, reverse=True)
        total = 0
        for index, path in enumerate(files):
            total += path.stat().st_size
            if (index >= 30 or total > MAX_TOTAL_BYTES) and path != destination:
                path.unlink(missing_ok=True)
    return {'ok': True, 'id': capture_id, 'url': '/__performance/captures/' + capture_id}


def read(capture_id, root=ROOT):
    if not re.fullmatch(r'[a-f0-9]{64}', capture_id):
        raise ValueError('Invalid capture ID')
    return json.loads((root / (capture_id + '.json')).read_text())


def listing(root=ROOT):
    with LOCK:
        return [{'id': p.stem, 'savedAtEpochMs': p.stat().st_mtime * 1000,
                 'bytes': p.stat().st_size} for p in
                sorted(root.glob('*.json'), key=lambda p: p.stat().st_mtime, reverse=True)]
