import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools/campaigns'))
import race_track_import as track
import import_america as campaign

class MiddleRouteTests(unittest.TestCase):
    def test_dense_survey_preserves_geometry_and_source_tags(self):
        points=[{'x':0,'y':0,'lat':40,'lon':-80,'tags':{'width':'7'}},
                {'x':240,'y':0,'lat':40,'lon':-79.99,'tags':{'width':'7'}},
                {'x':240,'y':80,'lat':39.99,'lon':-79.99,'tags':{}}]
        dense=track.densify(points,80)
        self.assertEqual(dense[0],points[0]);self.assertEqual(dense[-1],points[-1])
        self.assertEqual(len(dense),5)
        self.assertAlmostEqual(sum(math.hypot(b['x']-a['x'],b['y']-a['y']) for a,b in zip(dense,dense[1:])),320)
        self.assertTrue(all(math.hypot(b['x']-a['x'],b['y']-a['y'])<=80 for a,b in zip(dense,dense[1:])))
        self.assertEqual(dense[1]['tags'],points[0]['tags'])

    def test_divided_road_does_not_select_round_trip(self):
        # A divided highway with a turnaround used to win the longest-path
        # search by driving almost all the way back on the other carriageway.
        geometry=[{'lat':40,'lon':-80},{'lat':40,'lon':-79.97},{'lat':40.0001,'lon':-79.97},{'lat':40.0001,'lon':-80}]
        ways=[{'id':1,'nodes':[1,2,3,4],'geometry':geometry,'tags':{'oneway':'yes','highway':'secondary'}}]
        result=campaign.longest_connected_trace(ways,(40,-80),.75)
        length=sum(math.hypot(b['x']-a['x'],b['y']-a['y']) for a,b in zip(result,result[1:]))
        progress=math.hypot(result[-1]['x']-result[0]['x'],result[-1]['y']-result[0]['y'])
        self.assertGreaterEqual(progress,length*.75)
        self.assertLess(length,3000)

if __name__=='__main__':unittest.main()
