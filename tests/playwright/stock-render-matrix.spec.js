import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {validateOutput,sha,angles,w,h} from './stock-verify.mjs';
const root='data/server-storage/files';
const unpack=b=>{const d=JSON.parse(b);return d.__chainsawStorage==='compact-v1'?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
const matrix=JSON.parse(fs.readFileSync(new URL('./matrix.json', import.meta.url)));
const selected=process.env.CAR_PREVIEW_LANE;
if(!['batch','glasswort','all'].includes(selected))throw Error('CAR_PREVIEW_LANE must be batch, glasswort, or all');
for(const {name,id,expected} of matrix.filter(x=>selected==='all' || (selected==='glasswort')===(x.id==='glasswort-181-1973')))test('generate preview and Load Save poster for '+name,async({page},info)=>{
 test.setTimeout(120000);
 const index=JSON.parse(fs.readFileSync(root+'/manifest.json')).folders;
 const former=JSON.parse(fs.readFileSync('assets/car-previews/manifest.json')).previews[id];
 const wanted=former.stockSources.map(x=>({...x}));
 const carBytes=fs.readFileSync(root+'/'+index.cars[name]);
 expect(sha(carBytes)).toBe(expected.car);
 const carDocument=unpack(carBytes);
 const dashName='catalog-'+id+'-dashboard',dashPath=index.art[dashName]??'art/'+dashName+'/document.json';
 expect(sha(fs.readFileSync(root+'/'+dashPath))).toBe(expected.dashboard);
 // Restore all non-starter dependencies of the existing row and substitute only
 // known shared body and tire references. Unknown renderer reads fail below.
 const arts=[],deps=[{folder:'cars',name,sha256:expected.car}];
 const seen=new Set();
 for(const n of ['body','tires'].map(x=>'catalog-'+id+'-'+x).concat(wanted.filter(x=>x.folder==='art'&&!['8300 body','8296 tires 3'].includes(x.name)).map(x=>x.name))){
   if(seen.has(n))continue;
   seen.add(n);
   const p=index.art[n]??'art/'+n+'/document.json';
   const b=fs.readFileSync(root+'/'+p), digest=sha(b);
   if(n==='catalog-'+id+'-body')expect(digest).toBe(expected.body);
   else if(n==='catalog-'+id+'-tires')expect(digest).toBe(expected.tires);
   else expect(digest).toBe(wanted.find(x=>x.name===n)?.sha256);
   arts.push([n,unpack(b)]);deps.push({folder:'art',name:n,sha256:digest});
 }
 const path='__stock_renderer_'+id+'__.html';
 assertAbsent(path);
 fs.writeFileSync(path,'<!doctype html><title>Local stock preview renderer test</title>');
 let result;
 try{
   await page.goto('/'+path);
   result=await page.evaluate(async({carDocument,arts,name,id,angles,w,h})=>{
     const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');
     const {MenuCarPreview}=await import('/src/menus/MenuCarPreview.js');
     const {getRaceArtSpriteCanvasShared}=await import('/src/ui/shared/raceArtSpriteCanvas.js');
     const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
     editor.applyLoadedCarDocument(carDocument,{name});const car=editor.selectedCar;
     if(car.id!==id)throw Error('Saved identity mismatch');
     const cache=new Map(),assets=new Map(arts),used=new Set(),missing=new Set();
     const atlas=document.createElement('canvas'),rendered=[];
     atlas.width=w*angles.length;atlas.height=h;
     const dest=atlas.getContext('2d'),preview=new MenuCarPreview(editor);
     editor.getRaceArtSpriteCanvas=(ref,{frameIndex=0}={})=>{
       if(!ref)return null;
       if(!assets.has(ref)){missing.add(ref);return null;}
       used.add(ref);
       const k=ref+':'+frameIndex;
       if(!cache.has(k))cache.set(k,getRaceArtSpriteCanvasShared(ref,{frameIndex,showroomPayload:assets.get(ref)}));
       if(!cache.get(k))throw Error('Missing native canvas on '+k);
       return cache.get(k);
     };
     for(const [i,angle] of angles.entries()){
       const c=document.createElement('canvas');c.width=w;c.height=h;
       const ctx=c.getContext('2d');
       const choice=editor.getRaceCarProjectedArtRef(car,0,angle*Math.PI/180);
       if(choice.artRef!=='catalog-'+id+'-body'||choice.mirrored)throw Error('Unexpected body at '+angle);
       preview.drawSprite(ctx,{x:0,y:0,w,h},car,choice);
       let opaque=0;const p=ctx.getImageData(0,0,w,h).data;
       for(let j=3;j<p.length;j+=4)if(p[j])opaque++;
       if(opaque<200||opaque===w*h)throw Error('Empty/filled angle '+angle);
       dest.drawImage(c,i*w,0);
       rendered.push({angle,frame:choice.frameIndex,slot:choice.viewSlot,opaque});
     }
     if(missing.size)throw Error('Unpinned renderer art read: '+[...missing].join(','));
     if(!used.has('catalog-'+id+'-tires'))throw Error('No dedicated tire canvas read');
     if(new Set(rendered.map(x=>x.frame)).size!==8)throw Error('Not eight unique authored frames');
     const poster=document.createElement('canvas');poster.width=w;poster.height=h;
     const k=angles.indexOf(135);
     poster.getContext('2d').drawImage(atlas,k*w,0,w,h,0,0,w,h);
     function webp(c){
       const url=c.toDataURL('image/webp',.90);
       if(!url.startsWith('data:image/webp;base64,'))throw Error('WebP encoding unavailable');
       return url.split(',')[1];
     }
     return {atlas:webp(atlas),poster:webp(poster),rendered,used:[...used].sort()};
   },{carDocument,arts,name,id,angles,w,h});
 }finally{fs.unlinkSync(path);}
 const atlas=Buffer.from(result.atlas,'base64'),poster=Buffer.from(result.poster,'base64');
 const pngRow=validateOutput({atlas,poster,id,deps,rendererPins:[sha(fs.readFileSync('src/menus/MenuCarPreview.js')),sha(fs.readFileSync('src/ui/RaceEditor.js'))]});
 fs.mkdirSync(info.outputDir,{recursive:true});
 const save=(leaf,data)=>fs.writeFileSync(info.outputPath(leaf),data);
 save(pngRow.url.split('/').at(-1),atlas);save(pngRow.poster.url.split('/').at(-1),poster);
 save(id+'-preview-row.json',JSON.stringify(pngRow,null,2)+'\n');
 save(id+'-render-receipt.json',JSON.stringify({rendered:result.rendered,used:result.used},null,2)+'\n');
});
function assertAbsent(path){if(fs.existsSync(path))throw Error('Refusing to replace '+path);}
