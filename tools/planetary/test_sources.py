import unittest,math,struct,json,hashlib
from pathlib import Path
from inspect_sources import lunar_latlon,shape_lines
from probe_terrain import FloatStripTiff,decode_lzw
class PlanetarySourcesTests(unittest.TestCase):
 def test_lunar_projection_uses_moon_radius_not_earth(self):
  r=1737400.;lat,lon=20.2,30.8;phi=math.radians(lat);lam=math.radians(lon-30.7)
  b=math.cos(phi)*math.sin(lam);x=500000+r*math.atanh(b);y=r*math.atan2(math.tan(phi),math.cos(lam))
  a,c=lunar_latlon(x,y);self.assertAlmostEqual(a,lat,8);self.assertAlmostEqual(c,lon,8)
 def test_source_lines_remain_separate_and_have_real_local_scale(self):
  p=Path('data/campaigns/planetary/sources/APOLLO17_TRAVERSE_2018.SHP');lines=shape_lines(p.read_bytes())
  self.assertEqual(len(lines),9);route=lines[7]['points'];distance=sum(math.dist(a,b) for a,b in zip(route,route[1:]));self.assertAlmostEqual(distance,6107.44,1)
  for x,y in route:
   lat,lon=lunar_latlon(x,y);self.assertTrue(20<lat<21 and 30<lon<32)
 def test_terrain_sample_honors_geotransform_bounds_and_nodata(self):
  r=FloatStripTiff.__new__(FloatStripTiff);r.tags={33550:(5,5,0),33922:(0,0,0,100,200,0),278:(1,),273:(0,8),42113:'-9999\0'};r.width=r.height=2;r.endian='<'
  data=struct.pack('<4f',12,13,14,-9999);r.read=lambda o,n:data[o:o+n]
  self.assertEqual(r.sample(101,199),12);self.assertEqual(r.sample(106,199),13)
  with self.assertRaises(ValueError):r.sample(106,194)
  with self.assertRaises(ValueError):r.sample(99,200)
 def test_installed_report_has_nonflat_terrain_for_both_bodies(self):
  report=json.loads(Path('data/campaigns/planetary/report.json').read_text());self.assertEqual({r['body'] for r in report},{'Moon','Mars'})
  for r in report:self.assertGreater(r['lengthM'],2000);self.assertGreater(r['elevationRangeM'],20);self.assertGreater(r['terrainCells'],1500)
 def test_gale_lzw_matches_independently_verified_libtiff_output(self):
  root=Path('data/campaigns/planetary/sources');meta=json.loads((root/'gale-lzw-test-strip.json').read_text());compressed=(root/'gale-lzw-test-strip.bin').read_bytes()
  raw=decode_lzw(compressed,meta['expectedBytes']);self.assertEqual(hashlib.sha256(raw).hexdigest(),meta['decodedSha256'])
  with self.assertRaises(ValueError):decode_lzw(compressed[:20],meta['expectedBytes'])
  with self.assertRaises(ValueError):decode_lzw(compressed,4)
 def test_mer_sources_use_published_geographic_positions(self):
  from import_additional_rovers import mer_records
  a=mer_records('MERA')[0];b=mer_records('MERB')[0]
  self.assertAlmostEqual(a['LAT'],-14.565828,6);self.assertAlmostEqual(a['LON'],175.475837,6)
  self.assertAlmostEqual(b['LAT'],-1.948173,6);self.assertAlmostEqual(b['LON'],-5.525520,6)
  # Their corrected XY columns use different map frames; never treat either as Earth GPS.
  self.assertLess(a['CORRECTEDY'],-800000);self.assertEqual(b['CORRECTEDY'],0)
 def test_additional_missions_preserve_distinct_source_selections(self):
  rows=json.loads(Path('data/campaigns/planetary/report.json').read_text());missions={r['source']['mission'] for r in rows}
  self.assertEqual(missions,{'Apollo 15','Apollo 16','Apollo 17','Spirit','Opportunity','Curiosity','Perseverance'})
  for r in rows:
   ref=r['source']
   if 'sourceSnapshot' in ref:self.assertEqual(hashlib.sha256(Path(ref['sourceSnapshot']).read_bytes()).hexdigest(),ref['sourceSha256'])
if __name__=='__main__':unittest.main()
