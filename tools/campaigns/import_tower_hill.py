"""Import the opening stage from archived OSM way geometry and Tilezen DEM."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import race_track_import as track
import race_route_import as route
import terrain_tiles
from import_america import choose_stage
ways=json.loads(Path('data/campaigns/america/tower-hill-osm.json').read_text())
place={'name':'Tower Hill Road, Cumberland, RI','lat':41.9964,'lon':-71.437,'country':'us'}
waypoints=choose_stage(ways,(place['lat'],place['lon']),6000)
result=route.route({'place':place,'ways':ways},waypoints,'direct')
layout=track.recall(result['layouts'][0]['id'],'layout')
layout['displayName']='Tower Hill Road'
race=track.build(layout,width=7,use_elevation=True,fetch=terrain_tiles.importer_fetch)['race']
race['id']='america-opening-tower-hill'
race['source'].update(provider='OpenStreetMap / Mapzen Terrain Tiles',elevationProvider='Mapzen / Tilezen Terrain Tiles',elevationSourceUrl='https://registry.opendata.aws/terrain-tiles/')
race['source']['warnings']=[w.replace('USGS 3DEP','Mapzen Terrain Tiles DEM') for w in race['source']['warnings']]
Path('artifacts/campaign-import/america/tower-hill.json').write_text(json.dumps(race))
print(json.dumps({'lengthM':layout['lengthM'],'nodes':len(race['road']['nodes']),'warnings':race['source']['warnings']}))
