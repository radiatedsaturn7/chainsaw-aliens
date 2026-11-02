"""Build/check the static-host index from current exported project documents."""
import argparse
import json
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--root', type=Path, default=DEFAULT_ROOT)
    args = parser.parse_args()
    path = args.root / 'manifest.json'
    expected = build_manifest(args.root)
    actual = json.loads(path.read_text()) if path.exists() else {}
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
