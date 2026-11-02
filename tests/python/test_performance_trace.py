import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
from performance_trace import convert

class TraceTests(unittest.TestCase):
    def test_real_spans_and_context(self):
        report = {'trace': {'names': ['parent', 'child'], 'spans': [[0, 1, 8, 5, 0, 0], [1, 3, 3, 3, 0, 1]], 'droppedSpans': 2}, 'frames': [{'atMs': 1, 'context': {'aiCars': 12}, 'wallClockMs': 1001}]}
        result = convert(report)
        parent, child = result['traceEvents'][1:3]
        self.assertEqual((parent['ts'], parent['dur']), (1000, 8000))
        self.assertEqual((child['ts'], child['dur']), (3000, 3000))
        self.assertEqual(result['traceEvents'][-1]['args']['aiCars'], 12)
        self.assertEqual(result['droppedSpans'], 2)
    def test_no_invented_spans(self):
        result = convert({'phases': {'physics': {'totalSelfMs': 25}}})
        self.assertFalse(any(e['ph'] == 'X' for e in result['traceEvents']))

if __name__ == '__main__': unittest.main()
