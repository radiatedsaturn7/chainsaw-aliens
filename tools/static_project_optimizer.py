"""Lossless packaging for Pages. Never modify the editable source documents."""
import base64
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
from urllib.parse import unquote


DATA_URL = re.compile(r'^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$')


def decode_document(raw):
    document = json.loads(raw)
    if isinstance(document, dict) and document.get('__chainsawStorage') == 'compact-v1':
        if document.get('encoding') != 'json-gzip-base64':
            raise ValueError('Unsupported compact encoding')
        document = json.loads(gzip.decompress(base64.b64decode(document['data'], validate=True)))
    return document


def encode_document(document):
    raw = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    packed = json.dumps({
        '__chainsawStorage': 'compact-v1', 'encoding': 'json-gzip-base64',
        'data': base64.b64encode(gzip.compress(raw, compresslevel=9, mtime=0)).decode()
    }, separators=(',', ':')).encode()
    return packed if len(packed) + 64 < len(raw) else raw


def publish_document(source, destination, root):
    """Preserve names/data; share media bytes, including across project documents."""
    document = decode_document(source.read_bytes())
    source_dir, target_dir = source.parent, destination.parent
    target_dir.mkdir(parents=True)
    strings = set()
    referenced = set()

    def share(data, mime):
        digest = hashlib.sha256(data).hexdigest()
        asset = root / '_assets' / (digest + '.bin')
        asset.parent.mkdir(exist_ok=True)
        if not asset.exists():
            asset.write_bytes(data)
        return {'__chainsawAssetRef': Path(os.path.relpath(asset, target_dir)).as_posix(), 'mime': mime}

    def visit(value):
        if isinstance(value, dict):
            if '__chainsawAssetRef' in value:
                asset = (source_dir / unquote(value['__chainsawAssetRef'])).resolve()
                if not asset.is_relative_to(source_dir.resolve()) or not asset.is_file():
                    raise ValueError('Missing or unsafe source asset')
                if isinstance(value.get('mime'), str):
                    return {**value, **share(asset.read_bytes(), value['mime'])}
                referenced.add(asset)
                return value
            return {key: visit(child) for key, child in value.items()}
        if isinstance(value, list):
            return [visit(child) for child in value]
        if isinstance(value, str):
            match = DATA_URL.fullmatch(value) if len(value) >= 256 else None
            if match:
                try:
                    data = base64.b64decode(match[2], validate=True)
                    # Only canonical URLs can be reconstructed exactly by the runtime.
                    if base64.b64encode(data).decode() == match[2]:
                        return share(data, match[1])
                except ValueError:
                    pass
            strings.add(value)
        return value

    optimized = visit(document)
    destination.write_bytes(encode_document(optimized))
    # Keep metadata/support files. Media in assets/ is included only when used;
    # legacy exports often retain an identical PNG alongside an embedded URL.
    for item in source_dir.iterdir():
        if item.name in ('document.json', 'versions', 'assets'):
            continue
        if item.is_dir():
            shutil.copytree(item, target_dir / item.name, ignore=shutil.ignore_patterns('versions'))
        else:
            shutil.copyfile(item, target_dir / item.name)
    # Preserve ordinary relative URL references too, not only storage markers.
    paths = {unquote(value.split('?', 1)[0].split('#', 1)[0]) for value in strings if not value.startswith('data:')}
    assets_dir = source_dir / 'assets'
    if assets_dir.exists():
        for item in assets_dir.rglob('*'):
            if not item.is_file():
                continue
            relative = item.relative_to(source_dir)
            if item.resolve() in referenced or relative.as_posix() in paths or './' + relative.as_posix() in paths:
                target = target_dir / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(item, target)
    # References outside assets/ have already been copied as support files.


def tree_bytes(root):
    return sum(path.stat().st_size for path in root.rglob('*') if path.is_file())
