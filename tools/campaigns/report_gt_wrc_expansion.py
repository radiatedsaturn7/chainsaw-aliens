"""Refresh the review inventory for the GT/FM circuits and WRC-area additions."""
import json
from pathlib import Path
ROOT=Path('data/campaigns/america/raceways')
VENUES={'barcelona','mugello','sonoma','long-beach','autopolis','goodwood','dunsfold'}
GROUPS={'latvia','estonia','sardinia','croatia','poland','central-europe','corsica','ypres','australia'}
def read(p):return json.loads(Path(p).read_text())
rows=[r for r in read(ROOT/'catalog.json') if r.get('venueKey') in VENUES|GROUPS]
sections=[g for g in read(ROOT/'rally-sections.json')['collections'] if g['id'] in GROUPS]
validation=[]
for file in ['loading-parents.json','loading-sections.json']:
 p=Path('artifacts/gt-wrc')/file
 if p.exists():
  validation.extend(dict(id=r['id'],passed=r['ok'],seconds=r.get('seconds'),peakRssKB=r.get('peakRssKB'),terrainToleranceWarnings=r.get('terrainStats',{}).get('unresolvedHeightErrors',0),error=r.get('error')) for r in read(p)['results'])
report=dict(circuitVenues=len(VENUES),circuitLayouts=sum(r.get('venueKey') in VENUES for r in rows),rallyLocations=len(GROUPS),rallyParentRoads=sum(r.get('venueKey') in GROUPS for r in rows),rallySections=sum(len(g['sections']) for g in sections),
 circuits=[dict(id=r['id'],name=r['name'],mappedLengthM=r['lengthM'],sourceWarnings=r.get('warnings',[])) for r in rows if r.get('venueKey') in VENUES],
 rallies=[dict(id=g['id'],name=g['name'],formats=g.get('formats',[]),sectionLengthsM=[s['lengthM'] for s in g['sections']],parentRoads=[dict(id=r['id'],name=r['name'],mappedLengthM=r['lengthM'],sourceWarnings=r.get('warnings',[])) for r in rows if r.get('venueKey')==g['id']]) for g in sections],
 limitations=[
 'Current circuits only. Historical Sonoma IndyCar and Barcelona old chicane layouts are excluded. Mugello has no verified connected current short-course trace in the selected snapshot.',
 'Dunsfold retains its real at-grade crossover; reviewed connected way order allows a repeated junction but never a repeated road edge.',
 'Each 12-stage event uses six nonoverlapping forward game sections twice. Four-stage format uses four distinct sections. These are game itineraries, not complete official WRC schedules.',
 'Latvia 2024, Estonia 2020 and Sardinia 2024 use public spectator coordinate traces. Croatia 2026 uses an unofficial public trace because the official download required login.',
 'Croatia source segments reach 549 m (Ucka), 570 m (Platak) and 445 m (Ravna Gora). Densification makes rendering smoother but does not recover missing surveyed road detail.',
 'Corsica is the D515 La Porta–Barchetta corridor, omitting the competition D205 approach. Ypres is a partial Kemmelberg road recreation, omitting its initial village loop.',
 'Central Europe is the southern Strasinska portion through Malec and Zalesi to Nova Ves. Poland uses current southern approach roads including a short 655 section before the Swietajno gravel corridor, not the exact forest approach or northern stage loop.',
 'Australia uses continuous Sherwood Road and Coldwater Creek Road in the Coffs Coast rally area; neither is presented as the complete same-named WRC competition stage.',
 'Public DEM cannot reproduce surveyed banking, ruts, jumps or engineered bridge decks. Widths, conditions and reused regional scenery are approximate.',
 'Loading tests validate real worker preparation and finite transferred render/physics geometry. Terrain tolerance warnings are diagnostics; a visual driving pass remains useful.'
 ],validation=validation,
 rebuild=['python tools/campaigns/import_raceways.py --only barcelona mugello sonoma long-beach autopolis goodwood dunsfold','python tools/campaigns/import_rally_collections.py --only '+ ' '.join(s['key'] for s in read('tools/campaigns/gt_wrc_rally_sources.json')),'node tools/campaigns/install_raceways.mjs --only='+','.join(sorted(VENUES|GROUPS)),'node tools/campaigns/finalize_rally_collections.mjs','python tools/campaigns/install_rally_sections.py --only '+' '.join(sorted(GROUPS)),'Regenerate saved menu previews using attachCampaignRoutePreviews from tools/campaigns/route_previews.mjs.','python tools/campaigns/report_gt_wrc_expansion.py'])
(ROOT/'gt-wrc-expansion-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(f"{report['circuitLayouts']} circuits, {report['rallyParentRoads']} parent roads, {report['rallySections']} sections; {len(validation)} loading checks")
