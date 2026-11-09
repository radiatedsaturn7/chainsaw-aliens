"""Build the read-only website with a freshly generated, validated project index."""
import argparse
import json
import shutil
from pathlib import Path
from project_manifest import build_manifest, validate_assets
from static_project_optimizer import publish_document, tree_bytes


def build_site(source, destination, *, max_site_bytes=850 * 1024 * 1024):
    source, destination = source.resolve(), destination.resolve()
    if destination.exists():
        raise ValueError(f'Output must be a new directory: {destination}')
    if destination == source or destination in source.parents:
        raise ValueError('Output cannot replace the source repository')
    destination.mkdir(parents=True)
    for name in ['index.html', 'styles.css', 'src', 'ui', 'css', 'assets', 'vendor']:
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
    project_source_bytes = 0
    for entries in manifest['folders'].values():
        for relative in entries.values():
            document = root / relative
            project_source_bytes += sum(p.stat().st_size for p in document.parent.rglob('*')
                                        if p.is_file() and 'versions' not in p.relative_to(document.parent).parts)
            publish_document(document, target / relative, target)
    (target / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    validate_assets(target, manifest, shared_assets=True)
    (destination / '.nojekyll').write_text('')
    counts = {folder: len(entries) for folder, entries in manifest['folders'].items()}
    project_bytes = tree_bytes(target)
    total_bytes = tree_bytes(destination)
    report = {'folders': counts, 'optimization': {
        'sourceProjectBytes': project_source_bytes, 'publishedProjectBytes': project_bytes,
        'savedBytes': project_source_bytes - project_bytes, 'siteBytes': total_bytes,
        'sharedMediaFiles': len(list((target / '_assets').glob('*.bin')))}}
    (destination / 'project-build.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report['optimization'], indent=2))
    if tree_bytes(destination) > max_site_bytes:
        raise ValueError(f'Published site exceeds the {max_site_bytes} byte deployment budget; see project-build.json')
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--max-site-mib', type=int, default=850,
                        help='Fail before upload if the optimized site exceeds this budget (default: 850 MiB)')
    args = parser.parse_args()
    if args.max_site_mib <= 0:
        parser.error('--max-site-mib must be positive')
    print(json.dumps(build_site(args.source, args.output, max_site_bytes=args.max_site_mib * 1024 * 1024), indent=2))


if __name__ == '__main__':
    main()
