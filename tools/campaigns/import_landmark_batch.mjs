// Run after importing reviewed PNGs with import_campaign_art.py --only NAME.
// Additive only: never rewrite roads, ground, textures, or existing scenery.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {roadContinuationSamples} from '../../src/racing/RaceRoadContinuations.js';
import {chooseLandmarkPosition,rankLandmarkPositions,assertAdditiveRace,roadClearance,landmarkApproachYaw} from './landmarkPlacement.mjs';
const root='data/server-storage/files';
const read=p=>{let d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const write=(p,d)=>{fs.mkdirSync(p.slice(0,p.lastIndexOf('/')),{recursive:true});fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');};
const encode=d=>({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(d)),{level:9}).toString('base64')});
const hash=d=>crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex');
const cityName=process.argv[2];
if(!cityName)throw Error('Specify exact city name, e.g. node tools/campaigns/import_landmark_batch.mjs Providence');
const brief=read('AI/last-on-the-grid/state-expansion-landmark-artwork.json');
const city=brief.cities.find(c=>c.city===cityName);if(!city)throw Error('Unknown city');
const manifest=read(`${root}/manifest.json`),imports=read('data/campaigns/america/art-imports.json');
const expanded=read('data/campaigns/america/expanded-art.json').assets;
const ledgerPath='data/campaigns/america/state-expansion/landmark-art-progress.json';
const ledger=fs.existsSync(ledgerPath)?read(ledgerPath):{schemaVersion:1,description:'Stage statuses are distinct. Imported is not visually verified. GPS references are not final placements.',assets:Object.fromEntries(brief.cities.flatMap(c=>c.landmarks.map(m=>[m.suggestedArtRef,{raceRef:c.raceRef,source:'pending',savedArtwork:'pending',definition:'pending',placement:'pending',visualQA:'pending'}])))};
const docPath=`${root}/${manifest.folders.races[city.raceRef]}`;
const doc=read(docPath),before=structuredClone(doc.race),race=doc.race;
const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});editor.applyLoadedRaceDocument(race);
const samples=roadContinuationSamples(race.road,editor.getRacePathSamplesCached({step:2}),editor.getRaceRouteLength());
const segments=samples.slice(1).map((b,i)=>({a:samples[i],b,halfWidth:Math.max(editor.getRaceRoadWidthMForSegment(samples[i].segment),editor.getRaceRoadWidthMForSegment(b.segment))/2,samplingPaddingM:2}));
const configPath='data/campaigns/america/state-expansion/landmark-placement-reviews.json';
const reviews=fs.existsSync(configPath)?read(configPath):{};
const reviewFacing=name=>reviews[name]?.facingApproachBeforeM;
const stamp=Date.now(),pending=[];
const batchIds=new Set(city.landmarks.map(m=>`city-landmark-${m.suggestedArtRef}`));
const backgroundScenery=race.scenery.filter(s=>!batchIds.has(s.id));
for(const mark of city.landmarks){
 const name=mark.suggestedArtRef,asset=expanded.find(a=>a.name===name),sprite=imports[name];
 if(!asset||!sprite||!manifest.folders.art[name]||!fs.existsSync(`${root}/${manifest.folders.art[name]}`))throw Error(`Reviewed saved artwork missing: ${name}`);
 const defPath=`${root}/doodads/${name}/document.json`;
 const width=asset.heightM*sprite.width/sprite.height;
 const def=fs.existsSync(defPath)?read(defPath).doodad:{id:`campaign-${name}`,name,artRef:name,widthM:width,heightM:asset.heightM,groundOffsetM:0,hitboxWidthM:width*.85,hitboxHeightM:asset.heightM*.9,weightKg:100000,rules:[],defaultRule:{behavior:'collide',speedDrainPercent:90,damage:{panels:20,suspension:8,engine:4}}};
 const id=`city-landmark-${name}`,existing=race.scenery.find(s=>s.id===id);
 let prop=existing;
 const review=reviews[name],reposition=process.argv.includes('--review-positions')&&review;
 let candidateReview;
 if(!prop||reposition){
  const context={segments,scenery:backgroundScenery,poseAt:d=>editor.getRaceWorldPoseAtDistance(d),project:p=>editor.getRaceRouteProjectionForWorldPoint(p)};
  const ranked=reposition?rankLandmarkPositions(mark,def,context,review):null;
  const pos=ranked?ranked[0]:chooseLandmarkPosition(mark,def,context);
  if(ranked)candidateReview={score:pos.score,views:pos.views,sourceDistanceShiftM:pos.sourceDistanceShiftM};
  const projection=editor.getRaceRouteProjectionForWorldPoint(pos);
  prop={id,presetId:'doodad',x:pos.x,z:pos.z,yaw:pos.yaw,trackDistance:projection.distance,trackLateral:projection.lateral,state:'standing',doodadRef:name,definitionId:def.id,artRef:name,label:mark.name,widthM:def.widthM,heightM:def.heightM,groundOffsetM:def.groundOffsetM,weightKg:def.weightKg,behavior:'collide',previewDoodad:structuredClone(def)};
  if(existing)race.scenery[race.scenery.indexOf(existing)]=prop;else race.scenery.push(prop);
 }
 if(Number.isFinite(review?.facingApproachBeforeM)){
  prop.yaw=landmarkApproachYaw(prop,editor.getRaceWorldPoseAtDistance(Math.max(0,prop.trackDistance-review.facingApproachBeforeM)));
 }
 const clearance=roadClearance(prop,def,segments);if(clearance<5)throw Error(`Unsafe existing or planned placement: ${name}`);
 backgroundScenery.push(prop);
 pending.push({name,def,defPath,prop,clearance,sprite,candidateReview,mark});
}
assertAdditiveRace(before,race,new Set(pending.map(x=>x.prop.id)));
// No writes until ALL selected landmarks pass; existing files are preserved.
for(const {name,def,defPath,prop,clearance,sprite,candidateReview,mark} of pending){
 if(!fs.existsSync(defPath)){
  write(defPath,{schemaVersion:1,kind:'race-doodad',savedAt:stamp,doodad:def});
  write(defPath.replace('document.json','metadata.json'),{name,folder:'doodads',savedAt:stamp,version:1});
 }
 manifest.folders.doodads[name]=`doodads/${name}/document.json`;
 const previous=ledger.assets[name];
 const signature=hash({prop,def,sourceSha256:sprite.sourceSha256,roadSha256:hash(race.road)});
 ledger.assets[name]={...previous,sourceReference:{worldX:mark.worldX,worldZ:mark.worldZ,routeDistanceM:mark.routeDistanceM,offsetFromRoadM:mark.offsetFromRoadM,side:mark.side},candidateReview:candidateReview??previous.candidateReview,source:'saved',savedArtwork:'imported',definition:'registered',placement:'clearance-checked',visualQA:previous.signature===signature?previous.visualQA:'pending',signature,sourceSha256:sprite.sourceSha256,roadSha256:hash(race.road),placementDetails:{x:prop.x,z:prop.z,yaw:prop.yaw,facingApproachBeforeM:reviewFacing(name),trackDistance:prop.trackDistance,trackLateral:prop.trackLateral,minimumRoadClearanceM:clearance,checkedSegments:segments.length,samplingStepM:2,samplingPaddingM:2,clearanceMarginM:5,collisionBound:'circumscribed radius of runtime square hitbox; all route and continuation segments'},remaining:previous.signature===signature&&previous.visualQA==='passed'?[]:['Inspect actual in-race approach, framing, grounded edge, recognition and occlusion; save screenshot evidence before merge']};
 console.log(name,JSON.stringify(ledger.assets[name].placementDetails));
}
if(JSON.stringify(before)!==JSON.stringify(race))write(docPath,encode(doc));
write(`${root}/manifest.json`,manifest);write(ledgerPath,ledger);
