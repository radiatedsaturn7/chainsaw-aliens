"""Build the read-only website with a freshly generated, validated project index."""
import argparse
import json
import shutil
from pathlib import Path
from project_manifest import build_manifest, validate_assets


def build_site(source, destination):
    source, destination = source.resolve(), destination.resolve()
    if destination.exists():
        raise ValueError(f'Output must be a new directory: {destination}')
    if destination == source or destination in source.parents:
        raise ValueError('Output cannot replace the source repository')
    destination.mkdir(parents=True)
    for name in ['index.html', 'styles.css', 'src', 'css', 'assets', 'vendor']:
        item = source / name
        if item.is_dir():
            shutil.copytree(item, destination / name)
        elif item.is_file():
            shutil.copyfile(item, destination / name)
        else:
            raise ValueError(f'Missing application path: {name}')
    # Include runtime data (e.g. car presets/setlists), but no server-only data.
    shutil.copytree(source / 'data', destination / 'data',
                    ignore=lambda directory, names: ['server-storage'] if Path(directory) == source / 'data' else [])
    root = source / 'data/server-storage/files'
    manifest = build_manifest(root)
    validate_assets(root, manifest)
    target = destination / 'data/server-storage/files'
    target.mkdir(parents=True)
    for entries in manifest['folders'].values():
        for relative in entries.values():
            document = root / relative
            shutil.copytree(document.parent, (target / relative).parent,
                            ignore=shutil.ignore_patterns('versions'))
    (target / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    validate_assets(target, manifest)
    (destination / '.nojekyll').write_text('')
    counts = {folder: len(entries) for folder, entries in manifest['folders'].items()}
    (destination / 'project-build.json').write_text(json.dumps({'folders': counts}, indent=2) + '\n')
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build_site(args.source, args.output), indent=2))


if __name__ == '__main__':
    main()
