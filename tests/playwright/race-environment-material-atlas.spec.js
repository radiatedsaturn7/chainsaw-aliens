// Native asset/slot review only. This does not claim world lighting or driving acceptance.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {test,expect} from '@playwright/test';
import {roadTextureSettings,roadTextureForSegment,shoulderTextureForSegment} from '../../src/racing/RaceRoadTextures.js';
const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));
const requested=process.env.RACE_MATERIAL_NAMES?JSON.parse(process.env.RACE_MATERIAL_NAMES):null;
const changed=new Set(requested||ledger.rows.map(r=>r.raceRef));
for(const ref of changed)if(!ledger.rows.some(r=>r.raceRef===ref))throw Error('Unknown material-review race '+ref);
const retirements=[{old:'ground-dirty-snow-v2',replacement:'ground-patchy-snow-leaf-v1',race:'Ohio River Crossing',material:'snow',count:18591},{old:'ground-industrial-rubble-v2',replacement:'ground-gray-gravel-v2',race:'Data Center City',material:'gravel',count:5692}];

const decode=p=>{let x=JSON.parse(fs.readFileSync(p));return x.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(x.data,'base64'))):x;};
const rows=ledger.rows.filter(r=>changed.has(r.raceRef)).map(row=>{
 const r=decode('data/server-storage/files/'+row.documentPath).race,slots=new Map();
 const add=(ref,slot,count=1)=>{if(!ref)return;const key=ref+'|'+slot;slots.set(key,{ref,slot,count:(slots.get(key)?.count||0)+count});};
 add(r.groundPlaneArtRef,'ground');for(const c of Object.values(r.road.tileMap.cells))for(const slot of ['artRef','roughArtRef'])add(c[slot],c.tileId+':'+slot);
 const settings=roadTextureSettings(r);for(const seg of [...r.road.segments,...(r.road.network?.edges||[])]){add(roadTextureForSegment(settings,seg)?.artRef,'road:'+seg.surface);if(r.margin?.shoulderMode==='on')add(shoulderTextureForSegment(settings,seg)?.artRef,'shoulder:'+seg.surface);}
 return {race:row.raceRef,slots:[...slots.values()],refs:[...new Set([...slots.values()].map(s=>s.ref))]};
});
for(const handheld of [false,true])test('all corrected material bindings native atlas '+(handheld?'handheld':'desktop'),async({page},info)=>{
 test.setTimeout(600000);await page.setViewportSize(handheld?{width:390,height:844}:{width:1280,height:720});await page.goto('/index.html?hideFullscreenForTesting');await page.waitForFunction(()=>window.__gameReady&&!window.__game.loading,null,{timeout:120000});
 const reports=[];
 for(const row of rows){
  const result=await page.evaluate(async({row,handheld})=>{const e=window.__game.raceEditor,refs=row.refs;for(const ref of refs)await e.hydrateRaceArt(ref);const cols=handheld?2:5,w=handheld?390:1280,cw=w/cols,ch=handheld?225:280;const c=document.createElement('canvas');c.width=w;c.height=45+Math.ceil(refs.length/cols)*ch;const ctx=c.getContext('2d');ctx.fillStyle='#202020';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='white';ctx.font=handheld?'11px monospace':'15px monospace';ctx.fillText(row.race,5,16);ctx.fillText('Native material atlas - NOT world/driving approval',5,34);const loaded=[];for(let i=0;i<refs.length;i++){const ref=refs[i],art=e.getRaceArtSpriteCanvas(ref);if(!art)throw Error('Missing native material '+ref);const x=i%cols*cw,y=45+Math.floor(i/cols)*ch;ctx.imageSmoothingEnabled=false;const size=Math.min(cw-10,ch-65);ctx.drawImage(art,x+5,y+5,size,size);ctx.fillStyle='white';const max=handheld?27:34;for(let j=0;j<Math.ceil(ref.length/max);j++)ctx.fillText(ref.slice(j*max,(j+1)*max),x+5,y+size+20+j*13);loaded.push({ref,width:art.width,height:art.height});}return {loaded,image:c.toDataURL('image/jpeg',.78).split(',')[1]};},{row,handheld});
  expect(result.loaded.map(x=>x.ref)).toEqual(row.refs);const key=createHash('sha256').update(row.race).digest('hex').slice(0,12);fs.writeFileSync(info.outputPath(key+'.jpg'),Buffer.from(result.image,'base64'));reports.push({...row,key,loaded:result.loaded});
 }
 for(const r of retirements){
  const image=await page.evaluate(async({r,handheld})=>{const e=window.__game.raceEditor;for(const ref of [r.old,r.replacement])await e.hydrateRaceArt(ref);const w=handheld?390:1280,h=handheld?270:390;const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle='#202020';ctx.fillRect(0,0,w,h);ctx.font=handheld?'10px monospace':'16px monospace';ctx.fillStyle='white';ctx.fillText(r.race,4,18);ctx.fillText('Original / active replacement - '+r.material+' cells',4,38);for(const [i,ref]of [r.old,r.replacement].entries()){const art=e.getRaceArtSpriteCanvas(ref);if(!art)throw Error(ref);ctx.imageSmoothingEnabled=false;ctx.drawImage(art,i*w/2+5,50,w/2-10,h-80);ctx.fillStyle='white';ctx.fillText(ref,i*w/2+5,h-10);}return c.toDataURL('image/jpeg',.84).split(',')[1];},{r,handheld});fs.writeFileSync(info.outputPath('retire-'+r.old+'.jpg'),Buffer.from(image,'base64'));
 }
 fs.writeFileSync(info.outputPath('material-atlas.json'),JSON.stringify({device:handheld?'handheld':'desktop',scope:'Actual native asset canvases at device viewport; exact effective bindings listed. Unlit atlas, not route-wide/world/driving acceptance.',rows:reports,retirements},null,2));expect(reports.length).toBe(changed.size);
});
