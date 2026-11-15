import importlib.util
from pathlib import Path
import unittest
from PIL import Image

spec=importlib.util.spec_from_file_location('boundaries',Path(__file__).with_name('source-boundaries.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class BoundaryMetricsTests(unittest.TestCase):
    def test_flat_edges_only_prove_sampling_not_visual_quality(self):
        report=module.boundary_metrics(Image.new('RGB',(16,8),'#203040'))
        self.assertEqual(report['warnings'],[])
        self.assertIn('blank artwork can pass',report['scope'])

    def test_side_color_discontinuity_is_reported(self):
        im=Image.new('RGB',(16,8),'black')
        for y in range(8): im.putpixel((15,y),(255,255,255))
        self.assertIn('horizontal-wrap',module.boundary_metrics(im)['warnings'])

    def test_top_and_bottom_detail_cannot_hide_in_mean_edge_score(self):
        im=Image.new('RGB',(16,8),'black')
        im.putpixel((8,0),(0,255,0));im.putpixel((8,7),(255,0,0))
        report=module.boundary_metrics(im)
        self.assertEqual(report['edgeMeanRGB'],0)
        self.assertEqual(report['warnings'],['top-row-extrusion','bottom-row-extrusion'])

if __name__ == '__main__': unittest.main()
