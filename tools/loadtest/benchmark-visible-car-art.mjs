// CPU/draw-command benchmark. Canvas commands are recorded, not rasterized;
// this does NOT measure browser GPU throughput or game FPS.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {boundedContext} from '../../src/racing/RaceCarDepthSprites.js';
import {resolveCarAngleLayers,getCarViewSlot} from '../../src/racing/CarDirectionalArt.js';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
const cars=['RTG-001','CT-86','PZ-24','BUSE-019'].map(n=>read(`data/server-storage/files/cars/${n}/document.json`).car);
let counts={},allocations=0,paintedPixels=0,fullScreenCrops=0;
function context(){let transform={a:1,b:0,c:0,d:1,e:0,f:0};const stack=[];const target={globalAlpha:1,imageSmoothingEnabled:false,
 getTransform:()=>transform,save(){stack.push({...transform});},restore(){transform=stack.pop()||transform;},
 setTransform(a,b,c,d,e,f){transform=typeof a==='object'?{...a}:{a,b,c,d,e,f};},
 translate(x,y){transform.e+=transform.a*x+transform.c*y;transform.f+=transform.b*x+transform.d*y;},
 transform(a,b,c,d,e,f){const m=transform;transform={a:m.a*a+m.c*b,b:m.b*a+m.d*b,c:m.a*c+m.c*d,d:m.b*c+m.d*d,e:m.a*e+m.c*f+m.e,f:m.b*e+m.d*f+m.f};},
 rotate(t){this.transform(Math.cos(t),Math.sin(t),-Math.sin(t),Math.cos(t),0,0);},scale(x,y){this.transform(x,0,0,y,0,0);},
 createLinearGradient(){return {addColorStop(){}};},createRadialGradient(){return {addColorStop(){}};}};
 for(const k of ['beginPath','closePath','moveTo','lineTo','rect','clip','fill','stroke','ellipse','arc','fillRect','strokeRect','clearRect','drawImage','quadraticCurveTo','bezierCurveTo'])target[k]=()=>{counts[k]=(counts[k]||0)+1;};
 return target;}
globalThis.document={createElement(){allocations++;const c={width:256,height:256};c.getContext=()=>context();return c;}};
const editor=new RaceEditor({});const art=new Map();
fs.mkdirSync('artifacts/visible-car-art',{recursive:true});
const dimensionsPath='artifacts/visible-car-art/art-dimensions.json';
const dimensions=fs.existsSync(dimensionsPath)?JSON.parse(fs.readFileSync(dimensionsPath)):{};
editor.getRaceArtSpriteCanvas=(ref)=>{if(!ref)return null;if(!art.has(ref)){
 const path=`data/server-storage/files/art/${ref}/document.json`,stat=fs.statSync(path);
 const saved=dimensions[ref];const d=saved?.mtimeMs===stat.mtimeMs?saved:read(path);
 dimensions[ref]={width:d.width,height:d.height,mtimeMs:stat.mtimeMs};
 art.set(ref,{width:d?.width||256,height:d?.height||256,__raceArtCacheKey:ref});}return art.get(ref);};
const output=[];
const frames=Number(process.env.FRAMES||120);
const carCount=Number(process.env.CARS||29);
const modes=process.env.MODES?.split(',')||['full','no-tires','no-fx','no-tires-fx'];
for(const mode of modes){
 const prepared=cars.map(c=>resolveCarAngleLayers(structuredClone(c),'frontLeft'));
 if(mode.includes('no-fx')||mode==='no-tires-fx')for(const c of prepared)c.art.fx=[];
 const session={elapsedMs:0,speedMps:20,mechanical:{headlights:true,effects:{}},vehicleRenderState:{wheelPoses:{}}};
 const draw=(frame,index)=>{
 session.elapsedMs=frame*1000/60;for(const id of ['fl','fr','rl','rr'])session.vehicleRenderState.wheelPoses[id]={spinAngleRad:frame*.3};
 const car=prepared[index%4];const recorder=boundedContext(context());const ctx=recorder.context;
 editor.drawRaceCarBillboardLayers(ctx,{car,session,centerX:400,anchorY:400,baseWidth:80+index*2+Math.sin(frame*.03)*10,baseHeight:60,
 artChoice:{viewSlot:'frontLeft',artRef:car.art.artRef,frameIndex:0},drawWheels:!mode.startsWith('no-tires')});
 const box=recorder.bounds();if(box){const w=Math.max(0,Math.min(1080,box.right)-Math.max(0,box.left)),h=Math.max(0,Math.min(720,box.bottom)-Math.max(0,box.top));paintedPixels+=w*h;if(w*h>1080*720*.8)fullScreenCrops++;}
 };
 for(let f=0;f<5;f++)for(let i=0;i<carCount;i++)draw(f,i);
 fs.writeFileSync(dimensionsPath,JSON.stringify(dimensions));
 globalThis.gc?.();counts={};allocations=0;paintedPixels=0;fullScreenCrops=0;
 const costs={};const methods=['getRaceSpriteWheelRig','getRaceCarBillboardLayerCanvas','getRaceWeatherState','getRaceArtSpriteCanvas','getCarArtScale','getCarArtOffsets','getCarArtLayerVisibility'];
 const originals=new Map(methods.map(name=>[name,editor[name]]));
 for(const [name,fn] of originals)editor[name]=function(...args){const t=performance.now();try{return fn.apply(this,args);}finally{costs[name]=(costs[name]||0)+performance.now()-t;}};
 const times=[];for(let f=0;f<frames;f++){const t=performance.now();for(let i=0;i<carCount;i++)draw(f,i);times.push(performance.now()-t);}
 for(const [name,fn] of originals)editor[name]=fn;
 times.sort((a,b)=>a-b);output.push({mode,frames,cars:carCount,p50Ms:times[Math.floor(frames*.5)],p95Ms:times[Math.floor(frames*.95)],commands:counts,canvasAllocations:allocations,paintedPixels,fullScreenCrops,methodMs:costs});
}
const result={scope:'CPU only: saved car artwork configuration; mocked Canvas rasterization, no GPU, no physics',output};
fs.mkdirSync('artifacts/visible-car-art',{recursive:true});fs.writeFileSync(`artifacts/visible-car-art/${process.env.TAG||'baseline'}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
