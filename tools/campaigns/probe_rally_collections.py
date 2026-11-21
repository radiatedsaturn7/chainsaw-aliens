"""Cache public organizer pages for reviewing stage map sources (never execute JS)."""
import concurrent.futures, hashlib, re, sys
from pathlib import Path
from urllib.request import Request, urlopen

OUT = Path('artifacts/rally-collections-research')

def fetch(url):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / (hashlib.sha256(url.encode()).hexdigest()[:16] + '.html')
    if not path.exists():
        with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=45) as response:
            data = response.read(30_000_001)
        if len(data) > 30_000_000:
            raise ValueError('Response too large')
        path.write_bytes(data)
    return path, path.read_text(errors='replace')

def probe(url):
    try:
        path, text = fetch(url)
        links = re.findall(r'(?:href|src)=["\x27]([^"\x27]+)', text)
        useful = [s for s in links if re.search(r'kml|kmz|gpx|\.html|maps|\.pdf|google.com|553[1234]', s, re.I)]
        return url, str(path), useful
    except Exception as error:
        return url, str(error)

if __name__ == '__main__':
    if sys.argv[1:] == ['--lydden']:
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        import race_route_import as route
        import race_track_import as track
        from inspect_raceways import candidate_layouts
        import json
        path=Path('data/campaigns/america/raceways/sources/lydden.json')
        if not path.exists():
            from fetch_famous_rally import mapped_roads
            raw,_=fetch('https://api.openstreetmap.org/api/0.6/map?bbox=1.19,51.17,1.21,51.185')
            ways=mapped_roads(raw.read_bytes(),lambda tags:tags.get('highway')=='raceway')
            path.write_text(json.dumps(ways,separators=(',',':'))+'\n')
        layouts=candidate_layouts({'key':'lydden','lat':51.1775,'lon':1.199})
        for i,l in enumerate(layouts):print(i,l['lengthM'],l['name'],set(p.get('tags',{}).get('surface') for p in l['points']))
        sys.exit(0)
    if sys.argv[1:] == ['--concord-network']:
        import json
        from fetch_famous_rally import mapped_roads
        path=Path('data/campaigns/america/raceways/sources/concord-network.json')
        if not path.exists():
            raw,_=fetch('https://api.openstreetmap.org/api/0.6/map?bbox=-70.64,44.43,-70.53,44.48')
            ways=mapped_roads(raw.read_bytes(),lambda tags:tags.get('highway') not in ('footway','path','cycleway'))
            path.write_text(json.dumps(ways,separators=(',',':'))+'\n')
        print(path)
        sys.exit(0)
    if sys.argv[1:] == ['--nefr-roads']:
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        import race_route_import as route
        import race_track_import as track
        import json
        path=Path('data/campaigns/america/raceways/sources/nefr-roads.json')
        if not path.exists():
            ways=route.overpass('[out:json][timeout:25];way["highway"]["name"~"Concord Pond|Sturtevant|Morton|North Road|Fish Pond|Wilson Mills|Aziscohos",i](44.3,-71.3,45.2,-70.4);out geom;',track.request_json)
            path.write_text(json.dumps(ways,separators=(',',':'))+'\n')
        ways=json.loads(path.read_text())
        for w in ways:print(w['id'],w.get('tags'),w['geometry'][0],w['geometry'][-1])
        sys.exit(0)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(probe, sys.argv[1:]):
            print(result, flush=True)
