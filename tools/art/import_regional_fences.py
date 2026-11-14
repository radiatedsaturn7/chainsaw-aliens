"""Import only the reviewed 2994 regional fence kit; never edit a race.

Run from the repository root: python tools/art/import_regional_fences.py
The existing campaign PNG importer owns encoding, alpha, and import hashes.
All definitions are explicitly solid fence barriers, including scenic facades.
"""
import json
from pathlib import Path
import import_campaign_art as art

CATALOG = Path('data/campaigns/america/regional-fences.json')

def main():
    catalog = json.loads(CATALOG.read_text())
    entries = catalog['assets']
    refs = [a['name'] for a in entries]
    if len(refs) != len(set(refs)):
        raise ValueError('Duplicate fence refs')
    for a in entries:
        if not a['name'].startswith('fence-region-'):
            raise ValueError('Only regional fence assets are allowed')
        if not (art.SOURCES / a['source']).is_file():
            raise ValueError(f"Missing source: {a['source']}")
        if min(a['widthM'], a['heightM'], a['thicknessM']) <= 0:
            raise ValueError('Invalid fence dimensions')
    prepared = []
    for a in entries:
        name = a['name']
        doodad = {'id':name, 'name':a['label'] + ' [solid fence]',
            'artRef':name, 'isFence':True, 'fenceMirrorRepeat':a.get('mirrorRepeat',False), 'fenceThicknessM':a['thicknessM'],
            'itemType':'scenery', 'model':None, 'widthM':a['widthM'],
            'heightM':a['heightM'], 'groundOffsetM':0,
            'hitboxWidthM':a['widthM'], 'hitboxHeightM':a['heightM'],
            'weightKg':10000, 'defaultRule':{'minSpeedMph':0,
            'behavior':'collide', 'speedDrainPercent':45,
            'damage':{'panels':14,'suspension':6,'engine':3.5}}, 'rules':[]}
        doc = {'schemaVersion':1,'kind':'race-doodad','selectedDoodadId':name,
            'doodad':doodad, 'regionalFence':{'region':a['region'],
            'collision':'Continuous solid fence; transparent art is not an opening.',
            'source':a['source']}}
        target = art.ROOT / 'doodads' / name / 'document.json'
        # Never overwrite user edits: an existing generated definition must
        # be byte-for-byte equal before this idempotent import can continue.
        value = json.dumps(doc,indent=2)+'\n'
        if target.exists() and target.read_text() != value:
            raise RuntimeError(f'Preserve existing doodad edits: {target}')
        prepared.append((name,target,doc))
    # Scope the existing importer to exactly this reviewed kit. Preserve the
    # global pending-source report: unrelated source validation is not our job.
    pending = Path('data/campaigns/america/art-import-pending.json')
    old_pending = pending.read_bytes() if pending.exists() else None
    manifest = json.loads((art.ROOT / 'manifest.json').read_text())
    art.REVIEWED = {a['source']:a['name'] for a in entries}
    try:
        art.main()
    finally:
        if old_pending is not None:
            pending.write_bytes(old_pending)
        elif pending.exists():
            pending.unlink()
    imported_manifest = json.loads((art.ROOT / 'manifest.json').read_text())
    for name,target,doc in prepared:
        manifest['folders']['art'][name] = imported_manifest['folders']['art'][name]
        art.save(target,doc)
        art.save(target.with_name('metadata.json'),{'name':name,'folder':'doodads','version':1})
        manifest['folders']['doodads'][name] = f'doodads/{name}/document.json'
    (art.ROOT / 'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')

if __name__ == '__main__':
    main()
