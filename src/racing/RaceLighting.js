import {firstPersonCameraFrame} from './RaceFirstPersonCamera.js';
export const NIGHT_BRIGHTNESS=.05;
// https://www.lazerlamps.com.au/eng/universal-rally-kit-2-lamp.html
// Lazer two-lamp rally kit: 1 lux at 900 m, approximately 60° total spread.
export const RALLY_LIGHT_REACH_M=900;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function raceBrightness(race={}){return race.brightness!=null&&Number.isFinite(Number(race.brightness))?clamp(Number(race.brightness),0,1):race.timeOfDay==='night'?NIGHT_BRIGHTNESS:1;}
export function applyRaceEnvironmentDraft(draft,result){
 const next={...result};
 if(next.timeOfDay!==draft.timeOfDay&&Number(next.brightness)===Number(draft.brightness))next.brightness=next.timeOfDay==='night'?NIGHT_BRIGHTNESS:1;
 Object.assign(draft,next);return draft;
}
export function rallyLightPose(pose={}, {width=1.8,length=4.5}={}){
 const front=firstPersonCameraFrame(pose,{eyeOffset:{x:0,y:.2,z:length*.44}});
 return {left:{x:front.position.x+front.right.x*width*.32,y:front.position.y+front.right.y*width*.32,z:front.position.z+front.right.z*width*.32},right:{x:front.position.x-front.right.x*width*.32,y:front.position.y-front.right.y*width*.32,z:front.position.z-front.right.z*width*.32},forward:front.forward,up:front.up};
}
const declarations=`
 varying vec3 vRtgWorld;
 uniform float rtgAmbient;
 uniform float rtgHeadlights;
 uniform vec3 rtgLampLeft;
 uniform vec3 rtgLampRight;
 uniform vec3 rtgLampForward;
 uniform vec3 rtgLampUp;
 float rtgBeam(vec3 origin){
  vec3 delta=vRtgWorld-origin;
  float ahead=dot(delta,rtgLampForward);
  if(ahead<=0.0)return 0.0;
  float distanceM=length(delta);
  float vertical=dot(delta,rtgLampUp);
  float side=abs(dot(delta,cross(rtgLampForward,rtgLampUp)));
  float cone=(1.0-smoothstep(0.22,0.57735,side/max(ahead,0.01)))
    *(1.0-smoothstep(0.08,0.20,abs(vertical)/max(ahead,0.01)));
  float lux=405000.0/max(1.0,distanceM*distanceM);
  return lux*cone*(1.0-smoothstep(900.0,1200.0,distanceM));
 }
 float rtgLighting(){
  if(rtgAmbient>=0.999)return 1.0;
  float lux=(rtgBeam(rtgLampLeft)+rtgBeam(rtgLampRight))*rtgHeadlights;
  return rtgAmbient+(1.0-rtgAmbient)*lux/(lux+8.0);
 }
`;
const litMaterials=new WeakSet();
// Retain existing mipmap/shader hooks. Uniforms update without recompilation.
export function installRaceLighting(material,uniforms){
 if(!material||litMaterials.has(material)||material.isMeshDepthMaterial||material.isMeshNormalMaterial)return;
 litMaterials.add(material);
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey?.bind(material);
 const key=previousKey?.()||'';
 material.onBeforeCompile=function(shader,renderer){
  previous?.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
  let vertex=shader.vertexShader;
  const project='#include <project_vertex>';
  const world=`vec4 rtgWorld=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nrtgWorld=instanceMatrix*rtgWorld;\n#endif\nvRtgWorld=(modelMatrix*rtgWorld).xyz;\n`;
  if(vertex.includes(project))vertex=vertex.replace(project,world+project);
  else vertex=vertex.replace(/void\s+main\s*\(\s*\)\s*\{/,match=>match+'\nvRtgWorld=(modelMatrix*vec4(position,1.0)).xyz;\n');
  shader.vertexShader='varying vec3 vRtgWorld;\n'+vertex;
  const opaque='#include <opaque_fragment>';
  if(shader.fragmentShader.includes(opaque))shader.fragmentShader=shader.fragmentShader.replace(opaque,'outgoingLight *= pow(rtgLighting(), 2.2);\n'+opaque);
  else {const end=shader.fragmentShader.lastIndexOf('}');shader.fragmentShader=shader.fragmentShader.slice(0,end)+'\ngl_FragColor.rgb *= rtgLighting();\n'+shader.fragmentShader.slice(end);}
  shader.fragmentShader=declarations+shader.fragmentShader;
 };
 material.customProgramCacheKey=()=>key+'|rtg-rally-lights-v1';material.needsUpdate=true;
}
export function updateRaceLighting(renderer,{brightness=1,pose=null,dimensions={}}={}){
 const u=renderer.raceLightingUniforms||={rtgAmbient:{value:1},rtgHeadlights:{value:0},rtgLampLeft:{value:{x:0,y:0,z:0}},rtgLampRight:{value:{x:0,y:0,z:0}},rtgLampForward:{value:{x:0,y:0,z:1}},rtgLampUp:{value:{x:0,y:1,z:0}}};
 u.rtgAmbient.value=brightness;u.rtgHeadlights.value=pose&&brightness<1?1:0;
 if(pose){const light=rallyLightPose(pose,dimensions);for(const [k,v] of Object.entries({rtgLampLeft:light.left,rtgLampRight:light.right,rtgLampForward:light.forward,rtgLampUp:light.up}))Object.assign(u[k].value,v);}
 renderer.scene.traverse(object=>{const m=object.material;if(Array.isArray(m))m.forEach(m=>installRaceLighting(m,u));else if(m)installRaceLighting(m,u);});
 return u;
}
