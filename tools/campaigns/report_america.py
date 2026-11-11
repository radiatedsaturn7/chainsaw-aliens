"""Summarize installed Middle Route geometry, assumptions and preservation hashes."""
import base64
import gzip
import hashlib
import json
from pathlib import Path
from import_america import profile, SPECS

root=Path('data/server-storage/files')
catalog=json.loads(Path('data/campaigns/america/catalog.json').read_text())
report={
    'route':'Middle Route','targetDrivingSecondsForNewStages':660,
    'timingCaveat':'Planning estimates for sustained winter driving, not measured player or AI laps. Vehicle, tires, tuning, input, crashes and weather change actual elapsed times.',
    'limitations':[
        'OSM width tags are sparse. Tagged widths are retained; missing widths are estimated from lane count or a road-specific default.',
        'Mapzen Terrarium DEM is ground elevation at zoom 12 (roughly 25–35 m pixels here), not a surveyed road surface. Bridge decks approximate approach heights; banking is not surveyed.',
        'Surrounding terrain uses the existing importer coarse survey and road/shoulder blending; it is not a photogrammetric reconstruction.',
        'Scenery and frozen hazards are fictional. Data Center City uses actual St Louis streets and authored industrial props; no new autonomous-machine simulation is introduced.',
        'Ohio River Crossing uses SR 26 near Marietta and does not include a crossing of the Ohio River.',
        'Connecting lines on the world map are travel links, not playable roads between states.'],
    'references':[
        'https://www.openstreetmap.org/copyright',
        'https://registry.opendata.aws/terrain-tiles/',
        'https://www.pahighways.com/other/lhscenicbyway.html',
        'https://www.recreation.gov/gateways/13622',
        'https://www.visitmo.com/articles/scenic-drives-on-highway-19',
        'https://www.okhistory.org/shpo/docs/rt66roadbed.pdf',
        'https://www.blm.gov/sites/default/files/documents/files/Utah_BENM_Valley-Of_Gods_Brochure.pdf',
        'https://azdot.gov/projects/northcentral-district-projects/sr-89a-oak-creek-canyon-improvements/faq-sr-89a-oak-creek',
        'https://www.recreation.gov/gateways/13562'],
    'races':[]}
for stage in catalog:
    file=root/stage['documentPath'];data=json.loads(file.read_text())
    document=json.loads(gzip.decompress(base64.b64decode(data['data']))) if '__chainsawStorage' in data else data
    race=document['race'];seconds=stage.get('estimatedDrivingSeconds')
    if seconds is None:
        points=[{**node,'tags':{'surface':race['road']['segments'][min(i,len(race['road']['segments'])-1)]['surface']}} for i,node in enumerate(race['road']['nodes'])]
        seconds=round(profile(points)[1][-1])
    entry={**stage,'estimatedDrivingSeconds':seconds,'miles':round(stage['lengthM']/1609.344,2),
        'roadElevationRangeM':round((max(n['elevation'] for n in race['road']['nodes'])-min(n['elevation'] for n in race['road']['nodes']))*12,1),
        'roadWidthRangeM':[min(s['roadWidthM'] for s in race['road']['segments']),max(s['roadWidthM'] for s in race['road']['segments'])],
        'bridgeDeckApproximations':race.get('source',{}).get('bridgeDeckApproximations',0)}
    if stage['preserveExisting']:entry['installedDocumentSha256' if stage.get('conditionsAuthored') else 'preservedDocumentSha256']=hashlib.sha256(file.read_bytes()).hexdigest()
    report['races'].append(entry)
Path('data/campaigns/america/import-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('Wrote Middle Route import report.')
