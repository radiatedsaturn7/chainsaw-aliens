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
