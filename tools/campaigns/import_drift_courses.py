"""Rebuild just the reviewed drift additions using the shared road/DEM importer."""
import json
from pathlib import Path
from import_raceways import build
import japan_terrain_tiles as gsi
ROOT=Path('data/campaigns/america/drift-courses')

def main():
 ROOT.mkdir(parents=True,exist_ok=True);report=[]
 for spec in json.loads(Path('tools/campaigns/raceway_sources.json').read_text()):
  for selection in spec.get('layouts',[]):
   if not selection.get('driftChallenge'):continue
   print('Importing',spec['name'],selection['label'],flush=True)
   gsi.used_layers.clear()
   row=build(spec,selection,elevation_fetch=gsi.importer_fetch,elevation_provider='GSI Japan DEM5A/DEM5B (5 m), DEM10B fallback (10 m)')
   file=Path(row['generatedPath']);race=json.loads(file.read_text())
   race['source']['elevationAttribution']='Geospatial Information Authority of Japan (GSI) — https://maps.gsi.go.jp/development/ichiran.html#dem'
   race['source']['elevationLayersUsed']=sorted(gsi.used_layers)
   file.write_text(json.dumps(race,separators=(',',':'))+'\n')
   row['driftChallenge']=True
   report.append(row)
   (ROOT/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
   print('Imported',round(row['lengthM']),'m',flush=True)
 if len(report)!=10:raise ValueError('Expected exactly ten reviewed drift layouts')
if __name__=='__main__':main()
