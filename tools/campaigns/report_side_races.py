"""Standalone route previews for source/layout review; no imagery dependencies."""
import html,json,math
from pathlib import Path
root=Path('data/campaigns/america/side-races')
research=json.loads(Path('AI/last-on-the-grid/last_on_the_grid_99_side_races.json').read_text())
report={r['id']:r for r in json.loads((root/'report.json').read_text())}
installed={r['id']:r for r in json.loads((root/'catalog.json').read_text())} if (root/'catalog.json').exists() else {}
sections=[]
for hub in research['hubs']:
    sections.append('<h2>'+html.escape(hub['hub'])+'</h2>')
    for candidate in hub['races']:
        r=report.get(candidate['id'],{**candidate,'status':'pending'})
        sections.append('<article><h3>'+html.escape(candidate['id']+' · '+installed.get(candidate['id'],{}).get('displayName',candidate['name']))+'</h3>')
        sections.append('<p>'+html.escape(r['status']+' · '+candidate['event_type']+' · '+candidate['priority'])+'</p>')
        if r['status']=='imported':
            race=json.loads(Path(r['generatedPath']).read_text());pts=race['road']['nodes'];xs=[p['x'] for p in pts];ys=[p['y'] for p in pts]
            scale=min(460/max(1,max(xs)-min(xs)),300/max(1,max(ys)-min(ys)))
            line=' '.join(f'{20+(p["x"]-min(xs))*scale:.1f},{20+(p["y"]-min(ys))*scale:.1f}' for p in pts)
            sections.append(f'<svg viewBox="0 0 500 340" role="img" aria-label="North-up mapped route"><polyline points="{line}" fill="none" stroke="#eab85c" stroke-width="3"/></svg>')
            duration=f"{r['estimatedDrivingSeconds']} seconds estimated" if r['estimatedDrivingSeconds'] is not None else 'Quarter-mile elapsed-time run; duration depends on car'
            sections.append('<p>'+html.escape(f'{r["lengthM"]/1000:.2f} km · {r["laps"]} lap(s) · {duration} · '+', '.join(installed.get(candidate['id'],{}).get('installedSurfaces',r['surface'])))+'</p>')
            sections.append('<p>'+html.escape(f'Start {r["startGps"]}; finish {r["finishGps"]}')+'</p>')
            sections.append('<p>'+html.escape(r['confidence']+'; '+r['durationMethod'])+'</p>')
            if installed.get(candidate['id'],{}).get('conditionNotes'):sections.append('<p>'+html.escape(installed[candidate['id']]['conditionNotes'])+'</p>')
            if race['source'].get('geometryAdaptation'):sections.append('<p>'+html.escape(race['source']['geometryAdaptation'])+'</p>')
            sections.append('<ul>'+''.join('<li>'+html.escape(w)+'</li>' for w in r['warnings'])+'</ul>')
        else:sections.append('<p>'+html.escape(r.get('error','Not imported yet.'))+'</p>')
        sections.append('</article>')
(root/'previews.html').write_text('<!doctype html><meta charset="utf-8"><title>Side race import review</title><style>body{font:16px system-ui;background:#151a22;color:#eee;max-width:1000px;margin:auto;padding:24px}article{border:1px solid #456;padding:16px;margin:16px 0}svg{width:100%;max-height:340px}</style><h1>99 side-event import review</h1><p>© OpenStreetMap contributors (ODbL). Elevations: Mapzen / Tilezen Terrarium DEM. Driving times are planning estimates, not measured runs. Unavailable candidates are not replaced by invented roads.</p>'+''.join(sections))
