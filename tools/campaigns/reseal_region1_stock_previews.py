"""Rebind unchanged stock preview proofs after adding Region 1 cutscene saves.

Run this only on a full candidate checkout, after the native scene compiler.
The baseline must be the original, unmodified manifest from that checkout.
All preview bundle artwork and source digests are kept intact. Only the
generated release ID, manifest digest, and existing stamp fields change.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from refresh_stock_preview_stamps import refresh  # noqa: E402


def digest(payload):
    return hashlib.sha256(payload).hexdigest()


def release_id(document):
    body = {name: value for name, value in document.items() if name != 'releaseRevision'}
    return digest(json.dumps(body, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode())


def read_manifest(raw):
    return json.loads(raw)['folders']


def reseal(source, baseline):
    source = source.resolve()
    files = source / 'data/server-storage/files'
    atlas = source / 'assets/car-previews/manifest.json'
    binding_path = files / 'stock-preview-release.json'
    for path in [atlas, binding_path, files / 'manifest.json']:
        if path.is_symlink() or not path.resolve(strict=True).is_relative_to(source):
            raise ValueError(f'Refuse to rewrite a shared or external source: {path}')
    old_index = baseline.read_bytes()
    new_index = (files / 'manifest.json').read_bytes()
    old_folders, new_folders = read_manifest(old_index), read_manifest(new_index)
    # Reject unrelated roster/model/art changes; this script is for a single
    # isolated cutscene patch whose stock dependencies did not change.
    if {k: v for k, v in old_folders.items() if k != 'cutscenes'} != {k: v for k, v in new_folders.items() if k != 'cutscenes'}:
        raise ValueError('Project folders outside cutscenes changed.')
    for name, rel in old_folders['cutscenes'].items():
        if new_folders['cutscenes'].get(name) != rel:
            raise ValueError(f'Unrelated cutscene index entry changed: {name}')
    additions = set(new_folders['cutscenes']) - set(old_folders['cutscenes'])
    if len(additions) != 15 or any(not name.startswith('r1-') or new_folders['cutscenes'][name] != f'cutscenes/{name}/document.json' for name in additions):
        raise ValueError('Expected the 15 authored Region 1 entries only.')
    old_atlas, old_binding = atlas.read_bytes(), binding_path.read_bytes()
    bundle, binding = json.loads(old_atlas), json.loads(old_binding)
    current, previous = digest(new_index), digest(old_index)
    if (bundle.get('sourceProjectManifestSha256') not in (previous, current)
            or binding.get('projectManifestSha256') != bundle.get('sourceProjectManifestSha256')
            or binding.get('stockPreviewReleaseRevision') != bundle.get('releaseRevision')
            or release_id(bundle) != bundle.get('releaseRevision')):
        raise ValueError('The source preview seal does not match the supplied baseline.')
    bundle['sourceProjectManifestSha256'] = current
    bundle['releaseRevision'] = release_id(bundle)
    binding.update(projectManifestSha256=current, stockPreviewReleaseRevision=bundle['releaseRevision'])
    try:
        atlas.write_text(json.dumps(bundle, indent=2, ensure_ascii=False, sort_keys=True) + '\n')
        binding_path.write_text(json.dumps(binding, sort_keys=True) + '\n')
        # Existing release validator checks exact dependency and preview image
        # bytes before writing any stamp. It does not touch the car/art/model
        # document bytes, and rejects a partial checkout.
        refresh(source, write=True)
        refresh(source, write=False)
    except Exception:
        atlas.write_bytes(old_atlas)
        binding_path.write_bytes(old_binding)
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--baseline-manifest', required=True, type=Path)
    args = parser.parse_args()
    reseal(args.source, args.baseline_manifest)
