"""Offline regression checks for side-event width and fast-build planning."""
import math, unittest
import import_side_races as side

class SideRaceImportTests(unittest.TestCase):
    def test_invalid_width_uses_lane_count_not_two_lane_default(self):
        tags={'highway':'motorway','lanes':'3','width':'61.0'}
        self.assertAlmostEqual(side.mapped_road_width(tags),11.5728)
        tags['lanes']='4'
        self.assertAlmostEqual(side.mapped_road_width(tags),15.2304)

    def test_valid_measured_width_wins_and_bad_data_is_finite(self):
        self.assertEqual(side.mapped_road_width({'width':'9.5','lanes':'3'}),9.5)
        for value in ['NaN','inf','0','bad']:
            self.assertEqual(side.mapped_road_width({'width':value}),7)
        self.assertAlmostEqual(side.mapped_road_width({'lanes':'2','highway':'secondary'}),7)

    def test_paved_estimate_allows_high_speed_without_affecting_original_planner(self):
        points=[{'x':0,'y':i*50,'tags':{}} for i in range(241)]
        _,old,_=side.america.profile(points,24)
        _,fast,_=side.america.profile(points,side.PACE_CAP_MPS,side.PACE_SETTINGS)
        self.assertGreater(old[-1],580)
        self.assertGreater(fast[-1],180)
        self.assertLess(fast[-1],220)
        self.assertEqual(side.america.profile(points,24)[1],old)

    def test_loose_surface_is_not_timed_like_a_freeway(self):
        paved=[{'x':0,'y':i*50,'tags':{}} for i in range(101)]
        loose=[{**p,'tags':{'surface':'gravel'}} for p in paved]
        a=side.america.profile(paved,side.PACE_CAP_MPS,side.PACE_SETTINGS)[1][-1]
        b=side.america.profile(loose,side.PACE_CAP_MPS,side.PACE_SETTINGS)[1][-1]
        self.assertGreater(b,a*1.5)

if __name__=='__main__':unittest.main()
