"""Build import inventory from approved source PNG files, never edits pixels."""
import hashlib,json
from pathlib import Path
from PIL import Image
root=Path('assets/campaign-art')
revised=['clean-snow','dirty-snow','brown-dirt','gray-gravel','red-gravel','alpine-rock','canyon-rock','desert-scrub','industrial-concrete','industrial-rubble']
skip={f'ground/ground-{name}.png' for name in revised}
assets=[]
for path in sorted(root.rglob('*.png')):
    relative=path.relative_to(root).as_posix()
    if relative in skip: continue
    with Image.open(path) as im:
        im.load()
        assets.append({'id':path.stem.removesuffix('-v2'),'path':relative,'category':relative.split('/')[0],'width':im.width,'height':im.height,'format':im.format,'mode':im.mode,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'alpha':im.getchannel('A').getextrema() if 'A' in im.getbands() else None})
reuse={
'Tower Hill':['regions/tower-hill/mailbox.png','regions/tower-hill/short-stone-wall.png','regions/tower-hill/small-shed.png','roadside/wooden-utility-pole.png'],
'Mount Washington':['regions/mount-washington/summit-building-silhouette.png','regions/mount-washington/weather-instruments.png','rocks/alpine-rock-outcrop-01.png','roadside/snow-depth-marker-pole.png'],
'Laurel Highlands':['regions/laurel-highlands/forest-cabin.png','regions/laurel-highlands/stone-retaining-wall.png','regions/laurel-highlands/park-sign.png','vegetation/leafless-tree-01.png','vegetation/leafless-tree-02.png','vegetation/leafless-tree-03.png'],
'Ohio River Crossing':['regions/ohio-river-crossing/'+x+'.png' for x in ['distant-bridge-silhouette','flood-marker','riverside-building','riverbank-vegetation']],
'Ozarks':['regions/ozarks/'+x+'.png' for x in ['barn','farm-gate','timber-shed','exposed-limestone','creekside-brush']],
'Data Center City':['regions/data-center-city/'+x+'.png' for x in ['server-building','cooling-units','transformer','security-fencing','loading-dock','shipping-container']],
'Route 66':['regions/route-66/'+x+'.png' for x in ['abandoned-gas-station','motel-sign','diner','water-tower','billboard','rusted-pickup']],
'Pikes Peak':['regions/pikes-peak/'+x+'.png' for x in ['granite-outcrop','alpine-vegetation','snow-fence','summit-sign']],
'Moki Dugway':['regions/moki-dugway/'+x+'.png' for x in ['sandstone-outcrop','desert-scrub','warning-sign','mesa-silhouette']],
'Oak Creek':['regions/oak-creek/'+x+'.png' for x in ['red-rock-formation','creekside-tree','canyon-cabin','stone-wall']],
'Angeles Crest':['regions/angeles-crest/'+x+'.png' for x in ['dry-mountain-pine','chaparral','pale-rock-cut','turnout-sign','mountain-silhouette']]}
manifest={'schemaVersion':1,'purpose':'Source PNG import handoff; no game registration or physics changes','assetCount':len(assets),'notes':['Native generated dimensions are preserved. Resize appropriately during import.','Textures are not certified seamless. Inspect repetition and finish edges before production.','Use ground -v2 files; road-like first attempts are excluded.','Bridge, mesa and mountain silhouettes are distant scenery, not drive-through geometry.','Shared short retaining wall reuses regions/laurel-highlands/stone-retaining-wall.png.','Existing four houses and smoke/spray effects are reused without replacement.'],'regionalKits':reuse,'assets':assets}
(root/'inventory.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'assetCount':len(assets),'missingRegionalFiles':[p for paths in reuse.values() for p in paths if not (root/p).exists()]}))
