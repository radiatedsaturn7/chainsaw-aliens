import {prepareAmericaRace} from './prepare_america.mjs';
// Install only campaign files and the world-map screen; retain other user content.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {raceFxPreset} from '../../src/racing/RaceVisualFx.js';
import {createAmericaWorldMap} from '../../src/menus/AmericaWorldMap.js';
const source='data/campaigns/america',generated='artifacts/campaign-import/america',root='data/server-storage/files';
const catalog=JSON.parse(fs.readFileSync(`${source}/catalog.json`));
if(catalog.length!==24)throw Error('Expected all 24 imported stages before installation');
const decode=d=>d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;
const encode=d=>({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(d)),{level:9,mtime:0}).toString('base64')});
const write=(file,d)=>fs.writeFileSync(file,JSON.stringify(d,null,2)+'\n');
const manifestPath=`${root}/manifest.json`,manifest=JSON.parse(fs.readFileSync(manifestPath));
const savedAt=Date.parse('2026-11-05T17:00:00Z');
for(const stage of catalog){
 const race=JSON.parse(fs.readFileSync(`${generated}/${stage.id}.json`));
 Object.assign(race,raceFxPreset(stage.timeOfDay==='night'?'night':stage.stage>=4?'evening':'noon'));
 race.weatherIntensity=stage.stage<=2?0:Math.min(1,.25+stage.stage*.09);
 race.weatherVisibilityM=[0,0,1800,1400,1000,750,500,300][stage.stage-1];
 race.weatherTemperatureC=stage.weather==='snow'?-8:16;
 race.source.elevationAttribution='Mapzen/Tilezen Terrain Tiles; United States 3DEP, GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey.';
 race.source.elevationLicenseUrl='https://github.com/tilezen/joerd/blob/master/docs/attribution.md';
 race.source.warnings=race.source.warnings.map(w=>w.startsWith('Road width uses OSM')?'Road width is authored for campaign difficulty; original OSM geometry is retained.':w);
 const branchLabel={north:'Northern',middle:'Middle',south:'Southern'}[stage.branch];
 race.description=`${branchLabel} route · Stage ${stage.stage}/8 · ${(stage.lengthM/1000).toFixed(1)} km\n${stage.location.name}\nDifficulty ${stage.difficulty}/8 · ${stage.surface.replaceAll('-',' ')} · ${stage.weather} · ${stage.timeOfDay}`;

 prepareAmericaRace(race, stage);
 const folder=path.join(root,'races',stage.name);fs.mkdirSync(folder,{recursive:true});
 write(`${folder}/document.json`,encode({schemaVersion:1,kind:'race-track',savedAt,selectedRaceId:race.id,race}));
 write(`${folder}/metadata.json`,{name:stage.name,folder:'races',savedAt,version:1});
 manifest.folders.races[stage.name]=`races/${encodeURIComponent(stage.name).replace(/%20/g,' ')}/document.json`;
}
const menuPath=`${root}/menus/Game Menu/document.json`,menu=decode(JSON.parse(fs.readFileSync(menuPath)));
menu.parameters.campaignOpeningRace='Tower Hill Road';
menu.parameters.campaignStartingCar='RTG-001';
const screen=menu.screens.find(s=>s.id==='world-map');
if(!screen)throw Error('Game Menu world-map screen is missing');
const map=screen.elements.find(e=>e.type==='world-map');
Object.assign(map,createAmericaWorldMap(catalog),{showSelectedLabel:true,fontSize:16});
screen.elements=screen.elements.filter(e=>!e.id.startsWith('america-'));
const label=(id,text,x,y,w,color='#ffffff')=>({id:`america-${id}`,type:'text',label:text,x,y,w,h:.035,fontSize:16,color,visible:true,useDefaultFont:true});
screen.elements.push(label('heading','CUMBERLAND TO LA · 25 RACES · WESTBOUND ←',.08,.07,.84),
 label('north','NORTHERN ROUTE',.34,.15,.32,'#7dd9ed'),
 label('middle','MIDDLE ROUTE',.34,.34,.32,'#efc36b'),
 label('south','SOUTHERN ROUTE',.34,.53,.32,'#f59987'));
write(menuPath,menu);
write(`${root}/menus/Game Menu/metadata.json`,{...JSON.parse(fs.readFileSync(`${root}/menus/Game Menu/metadata.json`)),savedAt});
write(manifestPath,manifest);
console.log('Installed 24 races and the three-branch world map.');
