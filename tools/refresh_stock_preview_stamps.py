"""Validate the sealed preview release, then check or refresh local-server stamps."""
import argparse
import json
from pathlib import Path
from build_static_site import publish_stock_preview_binding


def refresh(source, *, write=False):
    source = Path(source).resolve()
    root = source / 'data/server-storage/files'
    manifest = json.loads((root / 'manifest.json').read_text())
    # Reuse the release validator: every source and rendered image must match
    # its cryptographic proof before any stamp can be issued.
    publish_stock_preview_binding(source, root, root, manifest, verify_only=True)
    catalog = json.loads((source / 'assets/car-previews/manifest.json').read_text())
    updates = {}
    for row in catalog['previews'].values():
        for dep in row['stockSources']:
            document = root / manifest['folders'][dep['folder']][dep['name']]
            path = document.with_name('metadata.json')
            data = json.loads(path.read_text())
            if data.get('deleted') or data.get('folder') != dep['folder'] or data.get('name') != dep['name']:
                raise ValueError(f'Invalid stock metadata: {path}')
            expected = dict(stockPreviewReleaseRevision=catalog['releaseRevision'],
                            stockPreviewSha256=dep['sha256'], stockPreviewBytes=document.stat().st_size)
            if any(data.get(k) != v for k, v in expected.items()):
                updates[path] = {**data, **expected}
    if updates and not write:
        raise ValueError(f'{len(updates)} outdated stock-preview stamps; run tools/refresh_stock_preview_stamps.py --write')
    for path, data in updates.items():
        original = path.read_text()
        text = json.dumps(data, ensure_ascii=False, indent=2) if '\n' in original.rstrip() else json.dumps(data, ensure_ascii=False, separators=(',', ':'))
        path.write_text(text + '\n')
    print(f'Verified {len(catalog["previews"])} previews; refreshed {len(updates)} metadata stamps.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    refresh(args.source, write=args.write)
