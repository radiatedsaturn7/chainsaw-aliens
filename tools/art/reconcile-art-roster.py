#!/usr/bin/env python3
"""Read-only exact source-package/runtime-document reconciliation. No integration."""
import argparse
import base64
from collections import defaultdict
import gzip
import hashlib
import json
import math
from pathlib import Path

VERSION = '1.0.0'
def digest(data): return hashlib.sha256(data).hexdigest()
def decode(raw):
    doc=json.loads(raw)
    if doc.get('__chainsawStorage'):
        doc=json.loads(gzip.decompress(base64.b64decode(doc['data'],validate=True)))
    if not isinstance(doc,dict) or not isinstance(doc.get('car'),dict): raise ValueError('Not a complete vehicle document (missing car object)')
    return doc

def complete(car):
    problems=[]
    for k in ['id','name']:
        if not isinstance(car.get(k),str) or not car[k]: problems.append('missing '+k)
    for k in ['art','camera','transmissions','tuning','setup']:
        if not isinstance(car.get(k),dict) or not car[k]: problems.append('missing/non-object '+k)
    # Native electric documents may explicitly carry mechanics:null; preserve it.
    if 'mechanics' not in car or (car['mechanics'] is not None and not isinstance(car['mechanics'],dict)): problems.append('missing/invalid mechanics')
    dims=car.get('dimensions',{})
    for k in ['lengthM','widthM','wheelbaseM','trackFrontM','trackRearM']:
        n=dims.get(k) if isinstance(dims,dict) else None
        if isinstance(n,bool) or not isinstance(n,(int,float)) or not math.isfinite(n) or n<=0: problems.append('missing/invalid dimensions.'+k)
    return problems

def main_report(art_root,roster_root):
    art_root=Path(art_root).resolve();roster_root=Path(roster_root).resolve()
    catalog=art_root/'assets/car-catalog';cars=roster_root/'data/server-storage/files/cars'
    if not catalog.is_dir() or not cars.is_dir(): raise ValueError('Roots must contain assets/car-catalog and data/server-storage/files/cars respectively')
    packages=[];errors=[];docs=[];by_name=defaultdict(list);by_id=defaultdict(list);by_source_name=defaultdict(list)
    for marker in sorted(catalog.glob('*/package-status.json')):
        try:
            status=json.loads(marker.read_bytes());cfg=json.loads((marker.parent/'package-config.json').read_bytes());ident=status['id'];name=status['name']
            if ident!=marker.parent.name or ident!=cfg['id'] or name!=cfg['name']: raise ValueError('Source identity disagrees across folder/config/marker')
            stable=status.get('stableCarId') or cfg.get('stableCarId') or cfg.get('runtimeId') or 'saved-car:'+name
            if stable!='saved-car:'+name: raise ValueError('Stable saved-car ID conflicts with exact name')
            for role in ['body','dashboard','tires']:
                if digest((marker.parent/(role+'.png')).read_bytes())!=status['sourceHashes'][role]: raise ValueError('Source hash mismatch: '+role)
            expected=cfg.get('runtimeDocumentId') or status.get('runtimeDocumentId')
            if not expected and not ident.startswith('source-'): expected=ident
            row=dict(sourcePackageId=ident,name=name,stableCarId=stable,expectedRuntimeDocumentId=expected,sourceHashes=status['sourceHashes'],temporarySourceKey=ident.startswith('source-'),sourceHeld=bool(cfg.get('visualHold') or (marker.parent/'package-status-held.json').exists()))
            packages.append(row);by_source_name[stable].append(row)
        except (ValueError,KeyError,OSError,TypeError) as exc: errors.append(dict(path=str(marker.relative_to(art_root)),error=str(exc)))
    for path in sorted(cars.glob('*/document.json')):
        try:
            raw=path.read_bytes();doc=decode(raw);car=doc['car'];problems=complete(car)
            row=dict(path=str(path.relative_to(roster_root)),inputDocumentSha256=digest(raw),runtimeDocumentId=car.get('id'),name=car.get('name'),complete=not problems,problems=problems,artSha256=digest(json.dumps(car.get('art'),sort_keys=True,separators=(',',':')).encode()),placeholderExplicit=(car.get('catalogProvenance',{}).get('placeholder') is True or (isinstance(car.get('catalogProvenance',{}).get('placeholder'),dict) and car['catalogProvenance']['placeholder'].get('sourceCar')=='RTG-001' and car['catalogProvenance']['placeholder'].get('sharedArtOnly') is True)))
            docs.append(row)
            if isinstance(row['name'],str): by_name['saved-car:'+row['name']].append(row)
            if isinstance(row['runtimeDocumentId'],str): by_id[row['runtimeDocumentId']].append(row)
        except (ValueError,KeyError,OSError,TypeError,EOFError) as exc: errors.append(dict(path=str(path.relative_to(roster_root)),error=str(exc)))
    duplicate_sources=[dict(stableCarId=k,sourcePackageIds=[p['sourcePackageId'] for p in v]) for k,v in by_source_name.items() if len(v)>1]
    duplicate_docs=[dict(stableCarId=k,paths=[d['path'] for d in v]) for k,v in by_name.items() if len(v)>1]
    ready=[];missing=[];mismatches=[];blocked=[];preserved=[]
    for p in packages:
        matches=by_name.get(p['stableCarId'],[])
        if not matches:
            sameid=by_id.get(p['expectedRuntimeDocumentId'],[]) if p['expectedRuntimeDocumentId'] else []
            if sameid: mismatches.append(dict(**p,reason='Runtime ID exists under a different exact saved-car name',documents=sameid))
            else: missing.append(p)
            continue
        if len(matches)!=1 or len(by_source_name[p['stableCarId']])!=1:
            blocked.append(dict(**p,reason='Duplicate source or exact-name runtime documents',documents=matches));continue
        d=matches[0]
        if not d['complete'] or p['sourceHeld']:
            blocked.append(dict(**p,reason='Incomplete runtime document or held source',document=d));continue
        if p['expectedRuntimeDocumentId'] and p['expectedRuntimeDocumentId']!=d['runtimeDocumentId']:
            mismatches.append(dict(**p,reason='Exact name matches but runtime car.id differs',document=d));continue
        row=dict(**p,document=d,boundRuntimeDocumentId=d['runtimeDocumentId'],bindingMethod='exact saved-car name plus actual complete document; temporary source key is not a runtime ID',productionIntegrated=False)
        # Only explicit placeholder provenance permits a ready replacement proposal.
        # Absence of this flag is not evidence that current original art is disposable.
        if not d['placeholderExplicit']: preserved.append(dict(**row,reason='No explicit placeholder authorization; preserve existing art'))
        else: ready.append(row)
    unassigned=[dict(**d,reason='No exact source package; preserve current art/document') for d in docs if 'saved-car:'+str(d['name']) not in by_source_name]
    return dict(toolVersion=VERSION,toolSha256=digest(Path(__file__).read_bytes()),scope='Read-only exact binding proposals. No fitting, mechanics invention, art overwrite or production integration.',artRoot=str(art_root),rosterRoot=str(roster_root),counts=dict(sourcePackages=len(packages),runtimeDocuments=len(docs),readyBindings=len(ready),missingDocuments=len(missing),idMismatches=len(mismatches),sourceDuplicates=len(duplicate_sources),runtimeNameDuplicates=len(duplicate_docs),blocked=len(blocked),existingOriginalsPreserved=len(preserved),unassignedDocumentsPreserved=len(unassigned),invalidInputs=len(errors)),readyBindings=ready,missingDocuments=missing,idMismatches=mismatches,sourceDuplicates=duplicate_sources,runtimeNameDuplicates=duplicate_docs,blocked=blocked,existingOriginalsPreserved=preserved,unassignedDocumentsPreserved=unassigned,invalidInputs=errors,productionWrites=0)

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--art-root',required=True);p.add_argument('--roster-root',required=True);a=p.parse_args()
    report=main_report(a.art_root,a.roster_root);print(json.dumps(report,indent=2));return 1 if report['invalidInputs'] or report['idMismatches'] or report['sourceDuplicates'] or report['runtimeNameDuplicates'] else 0
if __name__=='__main__': raise SystemExit(main())
