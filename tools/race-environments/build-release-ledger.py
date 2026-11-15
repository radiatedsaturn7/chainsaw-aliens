"""Reconcile retained evidence classes; never upgrade captures into visual approval."""
import json, math, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
source=json.loads((ROOT/'data/race-environments/ledger.json').read_text())
history=json.loads((ROOT/'data/race-environments/pack20-native-inventory.json').read_text())
by_race={r['race']:r for r in history['rows']}
rows=[]
for r in source['rows']:
 rows.append({'raceRef':r['raceRef'],'siteGroup':r['siteGroup'],'binding':r['binding'],
 'nativeCaptureHistory':by_race.get(r['raceRef'],{}).get('devices',{}),
 'nativeReviewAsRecorded':r.get('nativeReview'),
 'materialReviewAsRecorded':r.get('materialAtlasReview'),
 'terrainReviewAsRecorded':r.get('terrainReview'),
 'drivingSamples':[],'failedAttempts':[],
 'unknown':['Historical same-ref capture alone does not prove latest image revision acceptance.'],
 'fullRaceDriveRequired':False})
for original,row in zip(source['rows'],rows):
 match=re.search(r'pack(\d+)',original.get('environmentPack') or '')
 if match:
  evidence=ROOT/f'data/race-environments/pack{match.group(1)}-evidence.json'
  pack=json.loads(evidence.read_text())
  keys=[k for k in pack if any(word in k.lower() for word in ['visual','review','quality','native','evidence','check'])]
  row['historicalPackReview']={'path':str(evidence.relative_to(ROOT)),'relevantKeys':keys,'scope':'Named original pack membership. Consult recorded findings and later repairs; not automatically current per-route approval.'}
 else:row['historicalPackReview']={'scope':'Initial ten routes: packs1-3 contain historical evidence; exact per-route/latest-revision reconciliation remains explicit unknown.'}
index={r['raceRef']:r for r in rows}
for root in sorted(Path('/tmp').glob('race*')):
 if not root.is_dir() or any(t in root.name for t in ['baseline','-base','uniform','parity','timing']):continue
 for file in root.glob('*/driving-state.json'):
  try:d=json.loads(file.read_text())
  except (ValueError,OSError):continue
  row=index.get(d.get('race'))
  if not row or d.get('baseline') or (file.parent/'failure-state.json').exists():continue
  a=d.get('before',{}).get('session') or {};b=d.get('after',{}).get('session') or {}
  if not all(k in a and k in b for k in ['worldX','worldZ','elapsed']):continue
  displacement=math.hypot(b['worldX']-a['worldX'],b['worldZ']-a['worldZ'])
  if not (b.get('running') and not b.get('pending') and b['elapsed']>a['elapsed'] and displacement>.5):continue
  if d.get('after',{}).get('sky')!=row['binding']['skyboxArtRef']:continue
  progress=d.get('distanceTelemetry') or {}
  if progress.get('targetDistance',0)>progress.get('progress',0):continue
  row['drivingSamples'].append({'path':str(file),'device':d.get('device','unknown'),'displacementM':displacement,'routeProgressM':progress.get('progress'),'timing':d.get('timing'),'classification':'captured short moving gameplay sample; production entry and visual approval require linked pack evidence, not inferred here','entryNote':d.get('note'),'errors':d.get('errors',[]),'network':d.get('network',[])})
 for file in root.glob('*/failure-state.json'):
  try:d=json.loads(file.read_text())
  except (ValueError,OSError):continue
  row=index.get(d.get('race'))
  if row:row['failedAttempts'].append({'path':str(file),'device':d.get('device'),'status':(d.get('state') or {}).get('status'),'error':d.get('error'),'classification':'failed attempt; not automatically a baseline defect'})
for row in rows:
 if not row['drivingSamples']:row['unknown'].append('No qualifying retained short production sample located by this reconciler; not a requirement for full-route driving.')
 if not row['nativeReviewAsRecorded']:row['unknown'].append('Native review not encoded per-route in main ledger; historical pack review needs reconciliation.')
 row['historicalCaptureFilesPresent']={k:Path(v['path']).is_file() for k,v in row['nativeCaptureHistory'].items()}
 if row['raceRef']=='Col de Turini':
  row['nativeReviewAsRecorded']={'pack':'pack20','desktop':True,'handheld':True,'evidence':'data/race-environments/pack20-turini-contact.jpg','scope':'Current revised native no-fog and authored panorama, wrap/pitch. Conspicuous boundary streaks reduced; faint extreme-pitch extensions remain. Authored opacity1 intentionally hides sky. No world terrain or driving approval.'}
  row['nativeReviewAsRecorded']['reviewedNativeSha256']=json.loads((ROOT/'data/race-environments/pack20-turini-source.json').read_text())['reviewedNativeSha256']
  row['baselineLimitation']={'evidence':'data/race-environments/pack19-investigation.json','scope':'Matched desktop current/base first-frame failure without missing refs; current handheld same failure, no matched handheld baseline.'}
  row['weatherLimitation']='Authored snow visibility opacity1; unchanged.'
 if row['raceRef']=='Demo Track':row['performanceLimitation']={'evidence':'data/race-environments/pack20-startup-analysis.json','scope':'Slower post-presentation rendering/simulation progress; no independent30second deferred-art wait.'}
 if 'Pevely' in row['raceRef']:row['inheritedContentLimitation']='Dirt venue retains baseline asphalt physics; no physics changed or dirt grip implied.'
summary={'routes':len(rows),'historicalBothDeviceCaptures':sum(all(r['historicalCaptureFilesPresent'].get(k) for k in ['desktop','handheld']) for r in rows),'explicitNativeReviewRecords':sum(bool(r['nativeReviewAsRecorded']) for r in rows),'materialReviewRecords':sum(bool(r['materialReviewAsRecorded']) for r in rows),'routesWithShortMovingSamples':sum(bool(r['drivingSamples']) for r in rows),'shortMovingSamples':sum(len(r['drivingSamples']) for r in rows),'failedAttempts':sum(len(r['failedAttempts']) for r in rows)}
output={'schemaVersion':1,'base':source['base'],'policy':'Evidence inventory, not blanket acceptance. Historical capture, recorded human review, short production sample, failed attempt, matched baseline limitation and unknown stay distinct. Full-race drives are not required. Original strict QA flags are untouched.','summary':summary,'rows':rows}
print(json.dumps(output,indent=2))
