import sys
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
import performance_capture_store as store

class CaptureStoreTests(unittest.TestCase):
    def test_save_retry_read_retention(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report = dict(version=1, active=False, metadata={}, frames=[])
            saved = store.save(report, root)
            self.assertEqual(saved, store.save(report, root))
            self.assertEqual(store.read(saved['id'], root), report)
            self.assertEqual(len(store.listing(root)), 1)
            for index in range(35):
                store.save({**report, 'metadata': {'index': index}}, root)
            self.assertEqual(len(store.listing(root)), 30)
            self.assertFalse(list(root.glob('*.tmp')))
    def test_payload_limit_is_bounded_and_configurable(self):
        with tempfile.TemporaryDirectory() as directory:
            report = dict(version=1, active=False, metadata={}, frames=[])
            with patch.object(store, 'MAX_BYTES', 32):
                with self.assertRaisesRegex(ValueError, 'Capture exceeds'):
                    store.save(report, Path(directory))
            with patch.object(store, 'MAX_BYTES', 1024):
                self.assertTrue(store.save(report, Path(directory))['ok'])
            self.assertEqual(store.MAX_BYTES, 192 * 1024 * 1024)

    def test_invalid_and_unsafe(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for report in ({}, dict(version=1, active=True, metadata={}, frames=[]), dict(version=1, active=False, metadata={}, frames=[{}]*8001)):
                with self.assertRaises(ValueError):
                    store.save(report, root)
            with self.assertRaises(ValueError):
                store.read('../../etc/passwd', root)

if __name__ == '__main__': unittest.main()
