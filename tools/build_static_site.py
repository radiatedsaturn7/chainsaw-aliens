"""Build the read-only website with a freshly generated, validated project index."""
import argparse
import hashlib
import subprocess
import json
import shutil
import re
from pathlib import Path
from project_manifest import build_manifest, validate_assets
from static_project_optimizer import publish_document, tree_bytes


def _stock_preview_digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def _stock_preview_path(root, relative):
    relative = Path(relative)
    resolved = (root / relative).resolve(strict=True)
    if relative.is_absolute() or '..' in relative.parts or not resolved.is_relative_to(root):
        raise ValueError(f'Preview proof path escapes its source: {relative}')
    return resolved


def publish_stock_preview_binding(source, root, target, manifest, remote_commit=None, *, verify_only=False):
    """Bind only a sealed stock package to this exact built project index."""
    asset_manifest = source / 'assets/car-previews/manifest.json'
    source_binding = root / 'stock-preview-release.json'
    if not asset_manifest.exists() and not source_binding.exists():
        return
    if not asset_manifest.is_file() or asset_manifest.is_symlink() or not source_binding.is_file() or source_binding.is_symlink():
        raise ValueError('Incomplete stock preview release: need both the preview manifest and its source binding')
    canonical = _stock_preview_path(root, 'manifest.json')
    raw_source = canonical.read_bytes()
    source_sha = hashlib.sha256(raw_source).hexdigest()
    if json.loads(raw_source).get('folders') != manifest.get('folders'):
        raise ValueError('Stock preview source roster differs from the rebuilt static index')
    binding = json.loads(source_binding.read_bytes())
    previews = json.loads(asset_manifest.read_bytes())
    release = previews.pop('releaseRevision', None)
    compact = json.dumps(previews, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    if (binding.get('schemaVersion') != 1 or previews.get('schemaVersion') != 1
            or release != hashlib.sha256(compact).hexdigest() or binding.get('stockPreviewReleaseRevision') != release
            or binding.get('projectManifestSha256') != source_sha or previews.get('sourceProjectManifestSha256') != source_sha):
        raise ValueError('Stock preview source or release fingerprint does not match')

    # Remote document URLs must refer to this identical clean corpus; otherwise
    # local checks can't say what the immutable remote deployment will serve.
    if remote_commit:
        def git(*args):
            return subprocess.check_output(['git', '-C', str(source), *args], text=True).strip()
        if (git('rev-parse', 'HEAD') != remote_commit or git('status', '--porcelain', '--untracked-files=all', '--',
                'data/server-storage/files', 'assets/car-previews')):
            raise ValueError('Remote stock preview binding requires exact clean committed source assets')

    rows, names = previews.get('previews', {}), previews.get('carsByName', {})
    if not names or len(names) != len(rows) or set(names.values()) != set(rows):
        raise ValueError('Stock preview names are not an exact one-to-one index')
    dependency_hashes = {}
    for name, preview_id in names.items():
        row = rows[preview_id]
        dependencies = row.get('stockSources', [])
        if not isinstance(dependencies, list) or not 1 <= len(dependencies) <= 32:
            raise ValueError(f'Missing stock dependencies for {name}')
        cars = [dep for dep in dependencies if dep.get('folder') == 'cars']
        if len(cars) != 1 or cars[0].get('name') != name or cars[0].get('sha256') != row.get('carDocumentSha256'):
            raise ValueError(f'Stock source car does not match {name}')
        for dep in dependencies:
            folder, ref, digest = dep['folder'], dep['name'], dep['sha256']
            if folder not in ('cars', 'art', 'tires', 'models'):
                raise ValueError(f'Unknown stock preview source folder: {folder}')
            rel = manifest['folders'].get(folder, {}).get(ref)
            if not rel:
                raise ValueError(f'Missing current stock preview source: {folder}/{ref}')
            if rel not in dependency_hashes:
                dependency_hashes[rel] = _stock_preview_digest(_stock_preview_path(root, rel))
            if dependency_hashes[rel] != digest:
                raise ValueError(f'Changed stock preview source: {folder}/{ref}')
        for artifact in (row, row.get('poster')):
            if artifact is None:
                continue
            url = artifact.get('url', '')
            if not re.fullmatch(r'assets/car-previews/[A-Za-z0-9._-]+\.(?:webp|png)', url):
                raise ValueError(f'Invalid preview asset path for {name}')
            file = _stock_preview_path(source, url)
            if file.stat().st_size != artifact.get('bytes') or _stock_preview_digest(file) != artifact.get('sha256'):
                raise ValueError(f'Changed stock preview asset for {name}')

    if not remote_commit:
        for relative, expected in dependency_hashes.items():
            try:
                unchanged = _stock_preview_digest(_stock_preview_path(target, relative)) == expected
            except (OSError, ValueError):
                unchanged = False
            if not unchanged:
                # Optimization can rewrite/re-encode storage documents. Those
                # bytes are not covered by the source proof, so the built site
                # deliberately displays placeholders rather than asserting it.
                print('Stock previews omitted: optimized local documents differ from the verified source bytes.')
                return

    if verify_only:
        return

    served = target / 'manifest.json'
    published = {'schemaVersion': 1, 'stockPreviewReleaseRevision': release,
                 'projectManifestSha256': _stock_preview_digest(served)}
    (target / 'stock-preview-release.json').write_text(json.dumps(published, sort_keys=True) + '\n')


def build_site(source, destination, *, max_site_bytes=850 * 1024 * 1024, remote_repository=None, remote_commit=None):
    remote_root = None
    if remote_repository is not None or remote_commit is not None:
        if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', remote_repository or '') or not re.fullmatch(r'[a-f0-9]{40}', remote_commit or ''):
            raise ValueError('Remote assets require owner/repository and a full lowercase commit SHA')
        remote_root = f'https://raw.githubusercontent.com/{remote_repository}/{remote_commit}/data/server-storage/files'
    source, destination = source.resolve(), destination.resolve()
    if destination.exists():
        raise ValueError(f'Output must be a new directory: {destination}')
    if destination == source or destination in source.parents:
        raise ValueError('Output cannot replace the source repository')
    destination.mkdir(parents=True)
    for name in ['index.html', 'styles.css', 'src', 'ui', 'css', 'assets', 'vendor']:
        item = source / name
        if item.is_dir():
            # Campaign/car originals and catalog QA are authoring inputs. Saved
            # art documents are runtime assets; do not ship duplicate originals.
            shutil.copytree(item, destination / name,
                            ignore=lambda directory, names: ['campaign-art', 'car-catalog']
                            if Path(directory) == source / 'assets' else [])
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
            if not remote_root:
                publish_document(document, target / relative, target)
    if remote_root:
        manifest['documentRoot'] = remote_root
    (target / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    publish_stock_preview_binding(source, root, target, manifest, remote_commit)
    if not remote_root:
        validate_assets(target, manifest, shared_assets=True)
    (destination / '.nojekyll').write_text('')
    counts = {folder: len(entries) for folder, entries in manifest['folders'].items()}
    project_bytes = tree_bytes(target)
    total_bytes = tree_bytes(destination)
    report = {'folders': counts, 'documentRoot': remote_root, 'optimization': {
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
    parser.add_argument('--remote-repository', help='Public GitHub owner/repository for on-demand project files')
    parser.add_argument('--remote-commit', help='Immutable 40-character commit SHA matching the source checkout')
    args = parser.parse_args()
    if args.max_site_mib <= 0:
        parser.error('--max-site-mib must be positive')
    print(json.dumps(build_site(args.source, args.output, max_site_bytes=args.max_site_mib * 1024 * 1024, remote_repository=args.remote_repository, remote_commit=args.remote_commit), indent=2))


if __name__ == '__main__':
    main()
