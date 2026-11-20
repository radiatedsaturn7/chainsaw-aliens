// Refresh saved grouping/preview metadata without rebuilding roads or physics.
import fs from 'node:fs';
import zlib from 'node:zlib';
import {attachCampaignRoutePreviews} from './route_previews.mjs';
const root='data/server-storage/files';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const encode=d=>({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(JSON.stringify(d),{level:9,mtime:0}).toString('base64')});
const manifest=read(`${root}/manifest.json`),savedAt=Date.now();
const existing=[
 ['Col de Turini','monte-carlo','Monte Carlo Rally','Col de Turini — Road Section',null],
 ['Sisteron — Authon','monte-carlo','Monte Carlo Rally','Sisteron — Authon',null],
 ['Col de Fontbelle — Authon to Thoard','monte-carlo','Monte Carlo Rally','Fontbelle — Thoard',null],
 ['Ouninpohja','finland','Rally Finland','Ouninpohja — Road Section',null],
 ['Ruuhimäki — Gravel Road','finland','Rally Finland','Ruuhimäki — Road Section',null],
 ['Fafe — Rally Portugal','portugal','Rally Portugal','Fafe',2026],
 ['El Cóndor — Copina','argentina','Rally Argentina','El Cóndor — Copina',null]
];
for(const [ref,id,name,stage,year] of existing){
 const path=`${root}/${manifest.folders.races[ref]}`;const doc=read(path);
 doc.race.source.rallyCollection={id,name,stage,year,coverage:'selected-stages',timing:'Game timing lines; geographic recreation, not a complete historical rally itinerary.'};
 doc.race.source.layoutName=stage+(year?` (${year})`:'');doc.savedAt=savedAt;write(path,encode(doc));
 const meta=path.replace(/document.json$/,'metadata.json');write(meta,{...read(meta),savedAt});
}
const menuPath=`${root}/menus/Game Menu/document.json`,menu=read(menuPath);
attachCampaignRoutePreviews(menu);write(menuPath,menu);
const meta=menuPath.replace(/document.json$/,'metadata.json');write(meta,{...read(meta),savedAt});
const groups=new Map();
for(const entry of menu.parameters.raceIndex.filter(e=>e.rally&&!Number.isInteger(e.rally.section))){
 const {id,name}=entry.rally;
 if(!groups.has(id))groups.set(id,{id,name,country:entry.location.country,coverage:'Selected parent roads; separate game sections supply championship itineraries.',stages:[]});
 const race=read(`${root}/${manifest.folders.races[entry.ref]}`).race;
 const preview=menu.parameters.campaignRoutePreviews[entry.ref];
 groups.get(id).stages.push({raceRef:entry.ref,stage:entry.rally.stage,year:entry.rally.year,distanceM:preview.distanceM,surfaces:preview.surfaces,source:race.source.layoutReference,geometryMethod:race.source.geometryMethod,sourceSnapshot:race.source.sourceSnapshot});
}
write('data/campaigns/america/raceways/rally-collections.json',{
 collections:[...groups.values()],
 sourcePolicy:'Import coordinates from public organizers or mapped roads. Preserve source/year attribution, distinguish partial roads from exact event traces, deduplicate repeated passes, and retain only distinct historical layouts.',
 limitations:['Terrain uses public DEM data, not surveyed jump/rut profiles.','Road widths and scenery are approximate.','Historical labels identify the route source year, not a recreation of every period road detail.','Game championships use distinct sections and repeated passes; no official historical schedule is claimed.'],
 pending:[
 {name:'Full Isegami competitive layout',reason:'Aichi old-road/tunnel section installed with estimated portal heights. Full modern itinerary and surveyed tunnel dimensions still need verification.'},
 {name:'Additional Turkey layouts',reason:'Datca, Kizlan, Marmaris and Gokce traces contain short reversals requiring source cleanup/review; not imported. Selected clean 2019 Ula, Cicekli and Icmeler traces are installed.',source:'https://www.marmarisinfo.com/wrc-rally-turkey'},
 {name:'Full KP-to-Ollie layout and surveyed jump',reason:'Ollie Coleman road section installed; former organizer spectator PDF now redirects to a website. Full competitive topology and jump profile remain unverified.'},
 {name:'Olympus Rally',reason:'Official detailed KMZ distribution found was entrant-only and explicitly restricted to recce; no such files imported.',source:'https://www.olympusrally.com/'},
 {name:'Lake Superior Performance Rally',reason:'Organizer does not publicly publish specific stage maps; needs another verifiable public road source.',source:'https://www.lsprorally.com/spectators'},
 {name:'Lydden Hill rallycross',reason:'OSM contains several overlapping modern/older layouts and approximate jump geometry. Candidate lap lengths differ from the published 2016 1170 m course; defer rather than label an unverified loop as the historical circuit.',source:'https://www.fia.com/sites/default/files/supplementary_regulations_-_part_1_lydden_hill_gbr.pdf'},
 {name:'Complete Spain, Wales, Germany and Ojibwe stages',reason:'Continuous road sections installed. Complete historical layouts and artificial jump profiles remain unverified; current Spanish paving differs from the 2019 stage.'}
 ]
});
const validationPaths=['artifacts/rally-collections-loading.json','artifacts/rally-historical-loading.json','artifacts/rally-nefr-loading.json','artifacts/rally-snow-loading.json','artifacts/rally-nz-loading.json','artifacts/rally-world-loading.json','artifacts/rally-surface-loading.json','artifacts/rally-final-loading.json','artifacts/rally-six-loading.json','artifacts/gt-wrc/loading-parents.json','artifacts/gt-wrc/loading-sections.json'];
const results=validationPaths.flatMap(path=>fs.existsSync(path)?read(path).results:[]);
write('data/campaigns/america/raceways/rally-collections-review.json',{
 addedStages:[...groups.values()].reduce((n,g)=>n+g.stages.length,0)-existing.length,collections:groups.size,totalStages:[...groups.values()].reduce((n,g)=>n+g.stages.length,0),
 loadingValidation:results.map(r=>({id:r.id,passed:r.ok,seconds:r.seconds,peakRssKB:r.peakRssKB,terrainToleranceWarnings:r.terrainStats?.unresolvedHeightErrors||0,error:r.error})),
 validationNotes:'Real saved-track worker bakes, transferred render/physics geometry and hydrated doodad references. Terrain tolerance diagnostics are retained, not treated as proof of visually perfect roads. Browser UI rendering remains a CI/device check.',
 rebuild:['python tools/campaigns/import_rally_collections.py','node tools/campaigns/install_raceways.mjs --only=portugal,acropolis,new-england,sweden,sno-drift,new-zealand,mexico,norway,chile,safari-kenya,japan-hokkaido,turkey,spain,wales,germany,japan-aichi,100-acre-wood,ojibwe,latvia,estonia,sardinia,croatia,poland,central-europe,corsica,ypres,australia','node tools/campaigns/finalize_rally_collections.mjs','node tools/campaigns/inventory_race_types.mjs'],
 tests:['python tools/campaigns/test_rally_collections.py','node --test tests/unit/rallyCollections.test.js tests/unit/raceIndex.test.js tests/unit/raceControllerMapping.test.js tests/unit/handbrakeRecovery.test.js']
});
console.log(`${groups.size} rally collections; ${[...groups.values()].reduce((n,g)=>n+g.stages.length,0)} stages`);
