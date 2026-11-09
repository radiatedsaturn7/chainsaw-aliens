import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('project_manifest', Path(__file__).resolve().parents[2] / 'tools/project_manifest.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProjectManifestTests(unittest.TestCase):
    def test_optimizer_round_trip_shares_media_and_preserves_sources(self):
        import base64
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
        from static_project_optimizer import publish_document, decode_document, encode_document
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output = root / 'published'
            output.mkdir()
            binary = bytes(range(256)) * 8
            url = 'data:image/png;base64,' + base64.b64encode(binary).decode()
            original = {'frames': [['#ffffff'] * 2000], 'image': url, 'copy': url,
                        'audio': {'__chainsawAssetRef': 'assets/media.bin', 'mime': 'audio/wav'},
                        'relativeUrl': 'assets/keep.bin', 'short': 'data:image/png;base64,AQID'}
            manifest = {'folders': {'art': {}}}
            for name in ['One', 'Two']:
                source = root / 'source/art' / name
                (source / 'assets').mkdir(parents=True)
                (source / 'assets/media.bin').write_bytes(binary)
                (source / 'assets/unused.png').write_bytes(binary)
                (source / 'assets/keep.bin').write_bytes(b'keep')
                (source / 'metadata.json').write_text(json.dumps({'name': name}))
                raw = json.dumps(original).encode() if name == 'One' else encode_document(original)
                (source / 'document.json').write_bytes(raw)
                target = output / 'art' / name / 'document.json'
                publish_document(source / 'document.json', target, output)
                self.assertEqual((source / 'document.json').read_bytes(), raw)
                self.assertTrue((source / 'assets/unused.png').exists())
                self.assertFalse((target.parent / 'assets/unused.png').exists())
                self.assertFalse((target.parent / 'assets/media.bin').exists())
                self.assertEqual((target.parent / 'assets/keep.bin').read_bytes(), b'keep')
                self.assertLess(target.stat().st_size, 1500)
                decoded = decode_document(target.read_bytes())
                for field in ['image', 'copy', 'audio']:
                    ref = decoded[field]
                    body = (target.parent / ref['__chainsawAssetRef']).read_bytes()
                    self.assertEqual(body, binary)
                    decoded[field] = 'data:' + ref['mime'] + ';base64,' + base64.b64encode(body).decode()
                expected = {**original, 'audio': 'data:audio/wav;base64,' + base64.b64encode(binary).decode()}
                self.assertEqual(decoded, expected)
                manifest['folders']['art'][name] = f'art/{name}/document.json'
            self.assertEqual(len(list((output / '_assets').iterdir())), 1)
            self.assertEqual(module.validate_assets(output, manifest, shared_assets=True)['assets'], 6)
            with self.assertRaisesRegex(ValueError, 'Missing or invalid asset'):
                module.validate_assets(output, manifest)
            # Shared support must not permit arbitrary traversal outside the site.
            outside = root / 'escape.bin'
            outside.write_bytes(b'private')
            target.write_text(json.dumps({'asset': {'__chainsawAssetRef': '../../../escape.bin'}}))
            with self.assertRaisesRegex(ValueError, 'Missing or invalid asset'):
                module.validate_assets(output, manifest, shared_assets=True)

    def test_optimizer_is_deterministic_and_keeps_noncanonical_urls(self):
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
        from static_project_optimizer import publish_document, decode_document
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'source'
            source.mkdir()
            doc = {'pixels': ['#123456'] * 5000, 'url': 'data:text/plain;charset=utf-8,hello'}
            (source / 'document.json').write_text(json.dumps(doc))
            results = []
            for name in ['first', 'second']:
                output = Path(tmp) / name
                output.mkdir()
                target = output / 'art/Test/document.json'
                publish_document(source / 'document.json', target, output)
                results.append(target.read_bytes())
                self.assertEqual(decode_document(results[-1]), doc)
            self.assertEqual(*results)

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
            for name in ['src', 'ui', 'css', 'assets', 'vendor', 'data/system']:
                (source / name).mkdir(parents=True)
                (source / name / 'included.txt').write_text('runtime')
            for name in ['index.html', 'styles.css']:
                (source / name).write_text('fixture')
            (source / 'src/main.js').write_text("import { theme } from '../ui/EditorShell.js';\n")
            (source / 'ui/EditorShell.js').write_text("export const theme = {};\n")
            (source / 'ui/tokens.css').write_text(':root { --ui-bg: black; }')
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
            self.assertEqual((output / 'ui/EditorShell.js').read_bytes(), (source / 'ui/EditorShell.js').read_bytes())
            self.assertTrue((output / 'ui/tokens.css').exists())
            self.assertTrue((output / 'src/main.js').exists())
            self.assertTrue((output / 'data/system/included.txt').exists())
            self.assertFalse((output / 'data/server-storage/performance-captures').exists())
            self.assertFalse(any(output.rglob('versions')))
            self.assertTrue((output / '.nojekyll').exists())
            with self.assertRaisesRegex(ValueError, 'deployment budget'):
                build_site(source, Path(tmp) / 'oversized', max_site_bytes=1)
            with self.assertRaisesRegex(ValueError, 'new directory'):
                build_site(source, output)
