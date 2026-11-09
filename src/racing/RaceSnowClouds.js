import {RACE_THREE_ELEVATION_M} from './simulation/RaceSimulationConfig.js';
import * as THREE from '../vendorBridge/three.js';
import {smokeAnimationFrame} from './CarSmoke.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export function normalizeSnowClouds(value={}) {
 return {enabled:value?.enabled!==false,artRef:String(value?.artRef||'').trim().slice(0,200),windDirectionDeg:Number.isFinite(Number(value?.windDirectionDeg))?Number(value.windDirectionDeg):70,windSpeedMps:clamp(Number.isFinite(Number(value?.windSpeedMps))?Number(value.windSpeedMps):3,0,20)};
}
export function snowCloudStrength(weather,intensity){return weather==='snow'?clamp((Number(intensity)-.1)/.9,0,1)||0:0;}
export function snowCloudOpacity(strength,life,index=0){return .3*strength*smooth(life/.2)*smooth((1-life)/.25)*smooth((strength*18-index)/2);}
const seed=(i,n)=>{const v=Math.sin(i*127.1+n*311.7)*43758.5453;return v-Math.floor(v);};
export function updateSnowClouds(state,{timeMs=0,x=0,z=0,yaw=0,strength=0,settings={},gustX=0,gustZ=0}={}) {
 const config=normalizeSnowClouds(settings),dt=state.lastTime==null?0:clamp((timeMs-state.lastTime)/1000,0,.1);
 state.lastTime=timeMs;state.clouds||=[];
 if(!config.enabled||strength<=0){state.clouds.length=0;return state.clouds;}
 const angle=config.windDirectionDeg*Math.PI/180;
 const forward={x:Math.sin(yaw),z:Math.cos(yaw)},right={x:Math.cos(yaw),z:-Math.sin(yaw)};
 for(let i=0;i<18;i++){
  let p=state.clouds[i];
  const spawn=(cycle,initial)=>{
   const lifetime=8+seed(i,cycle+1)*8;
   // Keep the field in the visible road corridor. Clouds retain world-space
   // positions after spawning; camera motion must never drag them along.
   const ahead=18+seed(i,cycle+2)*37,lateral=(seed(i,cycle+3)-.5)*18;
   return {cycle,x:x+forward.x*ahead+right.x*lateral,z:z+forward.z*ahead+right.z*lateral,age:initial?seed(i,cycle+4)*lifetime:0,lifetime,width:6+seed(i,cycle+5)*6};
  };
  if(!p)p=spawn(0,true);
  else if(p.age>=p.lifetime||Math.hypot(p.x-x,p.z-z)>80||(p.x-x)*forward.x+(p.z-z)*forward.z < -12)p=spawn(p.cycle+1,false);
  p.age+=dt;p.x+=(Math.sin(angle)*config.windSpeedMps+gustX)*dt;p.z+=(Math.cos(angle)*config.windSpeedMps+gustZ)*dt;
  p.opacity=snowCloudOpacity(strength,p.age/p.lifetime,i);
  state.clouds[i]=p;
 }
 return state.clouds;
}
function defaultCloudCanvas(){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');
 for(let i=0;i<5;i++){const x=32+(i%3)*30,y=44+Math.floor(i/3)*36,r=34;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(232,242,250,.65)');g.addColorStop(.5,'rgba(232,242,250,.25)');g.addColorStop(1,'rgba(232,242,250,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
 return canvas;
}
export function disposeSnowClouds(renderer){
 const state=renderer?.snowCloudRenderer;if(!state)return;
 for(const mesh of state.meshes){if(!mesh)continue;renderer.scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}
 for(const texture of state.textures.values())texture.dispose();
 delete renderer.snowCloudRenderer;
}
export function syncSnowClouds(editor,renderer,{camera={},cameraYaw=0,weatherState={}}={}){
 const session=editor.playtestSession;
 if(!session){if(renderer.snowCloudRenderer)for(const m of renderer.snowCloudRenderer.meshes)if(m)m.visible=false;return;}
 const settings=normalizeSnowClouds(editor.selectedRace?.snowClouds);
 const strength=editor.lastRaceRenderCamera?.cameraSafety?.tunnelConstrained?0:snowCloudStrength(weatherState.id,editor.getRaceWeatherVisualIntensity(weatherState));
 if(!renderer.snowCloudRenderer && (!settings.enabled||!strength))return;
 const render=renderer.snowCloudRenderer||={meshes:[],textures:new Map(),fallback:null};
 const state=session.snowCloudState||={};
 const lamps=session.mechanical;
 const headlights=editor.raceHeadlightsEnabled?.() ?? lamps?.headlights===true;
 const brightLamps=(headlights && lamps?.highBeams===true)||lamps?.auxLights===true;
 const opacityScale=brightLamps && Number(lamps?.effects?.lights ?? 1)>.001?1.1:1;
 const particles=updateSnowClouds(state,{timeMs:session.elapsedMs,x:Number(camera.x)||0,z:Number(camera.z)||0,yaw:cameraYaw,strength,settings,gustX:Number(session.weatherFxState?.gustXMps)||0,gustZ:Number(session.weatherFxState?.gustZMps)||0});
 render.meshes.forEach(m=>{m.visible=false;});
 particles.forEach((p,i)=>{
  if(p.opacity<.001)return;
  let mesh=render.meshes[i];
  if(!mesh){
   const material=new THREE.MeshBasicMaterial({transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide});
   material.userData.raceSnowCloud=true;
   mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);mesh.name='snow-ground-cloud';render.meshes[i]=mesh;renderer.scene.add(mesh);
  }
  const frameIndex=smokeAnimationFrame(editor.raceSmokeFrameDurations?.get(settings.artRef)||[],p.age*1000);
  const canvas=(settings.artRef?editor.getRaceArtSpriteCanvas(settings.artRef,{frameIndex}):null)||(render.fallback||=defaultCloudCanvas());
  let texture=render.textures.get(canvas);
  if(!texture){texture=new THREE.CanvasTexture(canvas);texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;render.textures.set(canvas,texture);}
  const ground=editor.getRaceCompositedSurfaceAtWorldPoint({x:p.x,z:p.z},Number(session.heightM||0)/RACE_THREE_ELEVATION_M);
  // A billboard is a sheet, not a volume: dissolve it before the camera
  // intersects it so its pale pixels cannot wash over the whole road view.
  const ahead=(p.x-(Number(camera.x)||0))*Math.sin(cameraYaw)+(p.z-(Number(camera.z)||0))*Math.cos(cameraYaw);
  const cameraFade=smooth((ahead-1)/6);
  mesh.material.map=texture;mesh.material.opacity=p.opacity*opacityScale*cameraFade;
  // Upright smoke billboards: preserve the artwork proportions instead of
  // flattening the cloud into a shallow ribbon over the road.
  const height=p.width*Math.max(1,canvas.height)/Math.max(1,canvas.width);
  mesh.position.set(p.x,Number(ground?.elevation||0)*RACE_THREE_ELEVATION_M+height*.5+.05,p.z);
  mesh.rotation.set(0,cameraYaw,0);mesh.scale.set(p.width,height,1);mesh.visible=mesh.material.opacity>=.001;
 });
}
