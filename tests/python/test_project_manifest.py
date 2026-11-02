import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('project_manifest', Path(__file__).resolve().parents[2] / 'tools/project_manifest.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProjectManifestTests(unittest.TestCase):
    def test_generated_assets_and_actual_encoded_paths_are_indexed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for folder, directory, name in [('art', 'lefticon', 'lefticon'), ('art', 'a%23b', 'a#b'), ('levels', 'my level', 'my level')]:
                p = root / folder / directory
                p.mkdir(parents=True)
                (p / 'document.json').write_text('{}')
                (p / 'metadata.json').write_text(json.dumps({'name': name}))
            retired = root / 'art' / 'deleted'
            retired.mkdir()
            (retired / 'document.json').write_text('{}')
            (retired / 'metadata.json').write_text('{"deleted":true}')
            versions = root / 'art' / 'old' / 'versions'
            versions.mkdir(parents=True)
            (versions / 'document.json').write_text('{}')
            self.assertEqual(module.build_manifest(root), {'folders': {
                'art': {'a#b': 'art/a%23b/document.json', 'lefticon': 'art/lefticon/document.json'},
                'levels': {'my level': 'levels/my level/document.json'}}})

    def test_compressed_documents_validate_audio_font_and_image_assets(self):
        import base64
        import gzip
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for folder, extension in [('music', 'mp3'), ('sfx', 'wav'), ('fonts', 'ttf'), ('art', 'png')]:
                directory = root / folder / 'Saved'
                (directory / 'assets').mkdir(parents=True)
                ref = f'assets/track.{extension}'
                (directory / ref).write_bytes(b'fixture')
                raw = json.dumps({'nested': [{'data': {'__chainsawAssetRef': ref}}]}).encode()
                (directory / 'document.json').write_text(json.dumps({
                    '__chainsawStorage': 'compact-v1', 'encoding': 'json-gzip-base64',
                    'data': base64.b64encode(gzip.compress(raw)).decode()}))
            manifest = module.build_manifest(root)
            self.assertEqual(module.validate_assets(root, manifest), {'documents': 4, 'assets': 4})
            (root / 'music/Saved/assets/track.mp3').unlink()
            with self.assertRaisesRegex(ValueError, 'music/Saved: Missing or invalid asset'):
                module.validate_assets(root, manifest)

    def test_static_build_generates_manifest_and_excludes_server_history(self):
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
        from build_static_site import build_site
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'source'
            source.mkdir()
            for name in ['src', 'css', 'assets', 'vendor', 'data/system']:
                (source / name).mkdir(parents=True)
                (source / name / 'included.txt').write_text('runtime')
            for name in ['index.html', 'styles.css']:
                (source / name).write_text('fixture')
            root = source / 'data/server-storage/files'
            for folder in ['levels', 'art', 'music', 'sfx', 'fonts', 'cars', 'tires', 'doodads', 'menus', 'races', 'actors', 'items', 'models', 'cutscenes', 'settings']:
                directory = root / folder / 'New'
                (directory / 'assets').mkdir(parents=True)
                (directory / 'assets/current.bin').write_bytes(b'current')
                (directory / 'document.json').write_text('{"asset":{"__chainsawAssetRef":"assets/current.bin"}}')
                (directory / 'metadata.json').write_text('{"name":"New"}')
                (directory / 'versions').mkdir()
                (directory / 'versions/old.json').write_text('private history')
            (root / 'manifest.json').write_text('{"folders":{}}')
            (source / 'data/server-storage/performance-captures').mkdir()
            (source / 'data/server-storage/performance-captures/recording.json').write_text('not game data')
            output = Path(tmp) / 'site'
            counts = build_site(source, output)
            self.assertEqual(len(counts), 15)
            manifest = json.loads((output / 'data/server-storage/files/manifest.json').read_text())
            self.assertEqual(manifest, module.build_manifest(root))
            self.assertEqual(module.validate_assets(output / 'data/server-storage/files', manifest), {'documents': 15, 'assets': 15})
            self.assertTrue((output / 'data/system/included.txt').exists())
            self.assertFalse((output / 'data/server-storage/performance-captures').exists())
            self.assertFalse(any(output.rglob('versions')))
            self.assertTrue((output / '.nojekyll').exists())
            with self.assertRaisesRegex(ValueError, 'new directory'):
                build_site(source, output)
