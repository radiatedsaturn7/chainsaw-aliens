"""Build/check the static-host index from current exported project documents."""
import argparse
import base64
import gzip
import json
import re
from pathlib import Path
from urllib.parse import unquote

DEFAULT_ROOT = Path(__file__).resolve().parents[1] / 'data/server-storage/files'


def build_manifest(root):
    folders = {}
    for folder in sorted(root.iterdir()):
        if not folder.is_dir():
            continue
        entries = {}
        for document in sorted(folder.glob('*/document.json')):
            metadata_path = document.with_name('metadata.json')
            metadata = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
            if metadata.get('deleted') is True:
                continue
            name = metadata.get('name') or unquote(document.parent.name)
            if name in entries:
                raise ValueError(f'Duplicate project name: {folder.name}/{name}')
            # Use the actual filesystem path, not a reconstructed/encoded name.
            entries[name] = document.relative_to(root).as_posix()
        folders[folder.name] = entries
    return {'folders': folders}


def validate_assets(root, manifest, *, shared_assets=False):
    """Check every current document, including compressed audio/font payloads."""
    documents = assets = 0
    for folder, entries in manifest['folders'].items():
        for name, relative in entries.items():
            document = root / relative
            try:
                data = json.loads(document.read_text())
                if isinstance(data, dict) and data.get('__chainsawStorage') == 'compact-v1':
                    if data.get('encoding') != 'json-gzip-base64':
                        raise ValueError('Unsupported compact encoding')
                    data = json.loads(gzip.decompress(base64.b64decode(data['data'], validate=True)))
                pending = [data]
                while pending:
                    value = pending.pop()
                    if isinstance(value, dict):
                        if '__chainsawAssetRef' in value:
                            ref = value['__chainsawAssetRef']
                            if not isinstance(ref, str) or not ref:
                                raise ValueError('Invalid asset reference')
                            target = (document.parent / unquote(ref)).resolve()
                            shared = (shared_assets and target.parent == (root / '_assets').resolve()
                                      and re.fullmatch(r'[0-9a-f]{64}\.bin', target.name))
                            if (not target.is_relative_to(document.parent.resolve()) and not shared) or not target.is_file():
                                raise ValueError(f'Missing or invalid asset: {ref}')
                            assets += 1
                        else:
                            pending.extend(v for v in value.values() if isinstance(v, (dict, list)))
                    elif isinstance(value, list):
                        pending.extend(v for v in value if isinstance(v, (dict, list)))
                documents += 1
            except Exception as error:
                raise ValueError(f'{folder}/{name}: {error}') from error
    return {'documents': documents, 'assets': assets}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--validate-assets', action='store_true')
    parser.add_argument('--root', type=Path, default=DEFAULT_ROOT)
    args = parser.parse_args()
    path = args.root / 'manifest.json'
    expected = build_manifest(args.root)
    actual = json.loads(path.read_text()) if path.exists() else {}
    if args.validate_assets:
        print(json.dumps(validate_assets(args.root, expected)))
    if args.check:
        if actual != expected:
            raise SystemExit('Published project manifest is stale. Run python3 tools/project_manifest.py and commit manifest.json.')
        print('Published project manifest includes every current document.')
    else:
        # Keep existing ordering to make added/missing entries reviewable.
        ordered = {'folders': {}}
        for folder in dict.fromkeys([*actual.get('folders', {}), *expected['folders']]):
            if folder not in expected['folders']:
                continue
            old = actual.get('folders', {}).get(folder, {})
            current = expected['folders'][folder]
            ordered['folders'][folder] = {name: current[name] for name in dict.fromkeys([*old, *current]) if name in current}
        path.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + '\n')
        print(f'Updated {path}')


if __name__ == '__main__':
    main()
