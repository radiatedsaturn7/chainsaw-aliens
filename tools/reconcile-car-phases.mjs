import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import {isSystemCarDocument} from '../src/racing/CarPresets.js';
import RaceEditor from '../src/ui/RaceEditor.js';
const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
const root='data/server-storage/files/',read=p=>JSON.parse(fs.readFileSync(p));
const backlog=read('data/vehicle-catalog/full-candidate-backlog.json').candidates;
const manifest=read(root+'manifest.json');const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const manual={'subaru-forester-2024-base-us':'Briar 2024','subaru-impreza-22b-sti-version-1998-roster-candidate':'Copperleaf 22 1998','toyota-supra-1994-turbo-us-pending':'Sunstriker GT 1994','subaru-impreza-2024-base-us':'Starflower 20 2024','subaru-impreza-2024-rs-us':'Starflower 25 2024'};
const roster=[],templates=[];
for(const [name,p]of Object.entries(manifest.folders.cars)){
 let d=read(root+p);if(d.__chainsawStorage)d=JSON.parse(gunzipSync(Buffer.from(d.data,'base64')));
 if(isSystemCarDocument(d,name)){templates.push(name);continue;}
 const c=d.car,prov=c.catalogProvenance||{},identity=prov.referenceVehicle||prov.inspiration||prov.vehicle||'';
 roster.push({name,id:editor.getSavedRaceCarPlaytestId(name,c),documentId:c.id,referenceVehicle:identity,documentSha256:createHash('sha256').update(fs.readFileSync(root+p)).digest('hex'),placeholder:prov.phaseStatus?.implementation==='shared-placeholder',originalArtSourceHashesPresent:!!prov.sourceHashes,candidateId:prov.candidateId||null});
}
const candidates=backlog.map(c=>{
 const confirmed=roster.find(r=>r.name===manual[c.id]);
 const tokens=norm(c.model||c.modelAndTrim).split(' ').filter(t=>t.length>1);
 const suggestions=roster.filter(r=>{const t=norm(r.referenceVehicle);return t.includes(norm(c.make))&&(!c.year||t.includes(String(c.year)))&&tokens.every(x=>t.includes(x));}).map(r=>r.name);
 return {id:c.id,year:c.year,make:c.make,model:c.model||c.modelAndTrim,trim:c.trim||null,status:confirmed?'confirmed-runtime-match':'identity-review-required',runtimeName:confirmed?.name||null,possibleMatches:suggestions};
});
const outside=[{name:'Cornsalad 2005',identity:'2005 US Dodge Neon SE 5MT',reason:'No Neon model row in historical backlog.'},{name:'Woodrush 2005',identity:'2005 Canada Toyota Corolla CE',reason:'Historical Corolla candidate is 1974 SR5, not 2005 CE.'},{name:'Milkwort 1999',identity:'1999 US Ford Escort LX sedan 5MT',reason:'Historical Escort sporting/rally identities do not describe the 1999 US LX sedan.'}].map(x=>({...x,rosterPresent:roster.some(r=>r.name===x.name)}));
const data={schemaVersion:1,target:660,historicalCandidateSlots:backlog.length,scope:'Bounded reconciliation; suggestions are NOT verified identity equivalences or finished cars. Do not add historical candidate count to runtime count. Resolve duplicates and replace target slots deliberately before claiming a 660-identity union.',baseline:'dd0f1f81ad1c058eaf9155f17911e882a1572d64',counts:{runtimeNonSystem:roster.length,systemTemplates:templates.length,confirmedHistoricalCandidateMappings:candidates.filter(c=>c.runtimeName).length,unresolvedHistoricalCandidateMappings:candidates.filter(c=>!c.runtimeName).length,phase1ReviewedThisWave:2,phase2SharedPlaceholder:roster.filter(r=>r.placeholder).length,independentlyDriveVerifiedThisWave:0,priorDriveVerifiedBaselineReported:210,finishedOriginalArtThisWave:0,priorFinishedRosterReported:210,retainedRuntimeOriginalSourceHashRecords:roster.filter(r=>r.originalArtSourceHashesPresent&&!r.placeholder).length},separatePending:[{name:'Tutsan 2003',branch:'release/tutsan-echo-2003-20261117',countedHere:false,reason:'Separate Echo draft; no merge into pilot.'},{name:'Woodbetony 2002',countedHere:false,reason:'Unavailable paused original, do not recreate.'},{name:'Prowler paused work',countedHere:false,reason:'Unavailable; old Burnet label collides with finished Dakar entry.'}],verifiedExamplesOutsideHistoricalRows:outside,candidates,roster,templates};
fs.writeFileSync('data/vehicle-catalog/phases/progress.json',JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data.counts));
