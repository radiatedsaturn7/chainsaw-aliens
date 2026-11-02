import {firstPersonCameraFrame} from './RaceFirstPersonCamera.js';
export const NIGHT_BRIGHTNESS=.05;
export const LOW_BEAM_REACH_M=75,HIGH_BEAM_REACH_M=140;
// https://www.lazerlamps.com.au/eng/universal-rally-kit-2-lamp.html
// Lazer two-lamp rally kit: 1 lux at 900 m, approximately 60° total spread.
export const RALLY_LIGHT_REACH_M=900;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function raceBrightness(race={}){return race.brightness!=null&&Number.isFinite(Number(race.brightness))?clamp(Number(race.brightness),0,1):race.timeOfDay==='night'?NIGHT_BRIGHTNESS:1;}
export function raceStartsWithHeadlights(race={}){return typeof race.mechanicalMission?.headlights==='boolean'?race.mechanicalMission.headlights:race.timeOfDay==='night'||raceBrightness(race)<.5||['rain','storm','snow'].includes(race.weather);}
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
 uniform float rtgHighBeam;
 uniform float rtgAux;
 uniform float rtgVisibility;
 uniform vec3 rtgCamera;

 uniform vec3 rtgLampLeft;
 uniform vec3 rtgLampRight;
 uniform vec3 rtgLampForward;
 uniform vec3 rtgLampUp;
 float rtgBeam(vec3 origin,float reach,float spread,float dipped){
  vec3 delta=vRtgWorld-origin;
  float ahead=dot(delta,rtgLampForward);
  if(ahead<=0.0)return 0.0;
  float distanceM=length(delta);
  float vertical=dot(delta,rtgLampUp)/max(ahead,0.01);
  float side=abs(dot(delta,cross(rtgLampForward,rtgLampUp)))/max(ahead,0.01);
  float cone=(1.0-smoothstep(spread*.4,spread,side))
    *(1.0-smoothstep(.08,.20,abs(vertical)));
  if(dipped>.5)cone*=1.0-smoothstep(-.012,.002,vertical);
  float transmission=exp(-2.996*distanceM/max(1.0,rtgVisibility));
  return .5*reach*reach/max(1.0,distanceM*distanceM)*cone*transmission
    *(1.0-smoothstep(reach,reach*1.33,distanceM));
 }
 float rtgLighting(){
  float reach=mix(75.0,140.0,rtgHighBeam);
  float spread=mix(.35,.22,rtgHighBeam);
  float lux=0.0;
  if(rtgHeadlights>0.001)lux=(rtgBeam(rtgLampLeft,reach,spread,1.0-rtgHighBeam)+rtgBeam(rtgLampRight,reach,spread,1.0-rtgHighBeam))*rtgHeadlights;
  if(rtgAux>0.001)lux+=(rtgBeam(rtgLampLeft,900.0,.57735,0.0)+rtgBeam(rtgLampRight,900.0,.57735,0.0))*rtgAux;
  return rtgAmbient+(1.0-rtgAmbient)*lux/(lux+1.0);
 }
 vec3 rtgFog(vec3 color){
  float transmission=exp(-2.996*length(vRtgWorld-rtgCamera)/max(1.0,rtgVisibility));
  return mix(vec3(.22,.25,.27)*rtgAmbient,color,transmission);
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
  if(shader.fragmentShader.includes(opaque))shader.fragmentShader=shader.fragmentShader.replace(opaque,'outgoingLight = rtgFog(outgoingLight * pow(rtgLighting(), 2.2));\n'+opaque);
  else {
   const end=shader.fragmentShader.lastIndexOf('}');
   // Airborne particles scatter light; extinction fades their coverage rather
   // than replacing translucent white edges with opaque gray fog color.
   const lighting=material.userData?.racePrecipitation
    ? 'gl_FragColor.rgb *= rtgLighting();\ngl_FragColor.a *= exp(-2.996*length(vRtgWorld-rtgCamera)/max(1.0,rtgVisibility));'
    : material.userData?.raceSpriteEmissive
      ? 'vec3 litCar=gl_FragColor.rgb*rtgLighting();\nif(hasEmissive>0.5){vec4 emission=texture2D(emissiveMap,vUv);litCar=mix(litCar,emission.rgb,emission.a);}\ngl_FragColor.rgb=rtgFog(litCar);'
      : 'gl_FragColor.rgb = rtgFog(gl_FragColor.rgb * rtgLighting());';
   shader.fragmentShader=shader.fragmentShader.slice(0,end)+'\n'+lighting+'\n'+shader.fragmentShader.slice(end);
  }
  shader.fragmentShader=declarations+shader.fragmentShader;
 };
 material.customProgramCacheKey=()=>key+'|rtg-beams-fog-v4'+(material.userData?.raceSpriteEmissive?'|emissive-sprite':'')+(material.userData?.racePrecipitation?'|precipitation':'');material.needsUpdate=true;
}
export function updateRaceLighting(renderer,{brightness=1,pose=null,dimensions={},headlightIntensity=1,highBeams=false,auxIntensity=0,visibilityDistanceM=1e9,cameraPosition={}}={}){
 const u=renderer.raceLightingUniforms||={rtgHighBeam:{value:0},rtgAux:{value:0},rtgVisibility:{value:1e9},rtgCamera:{value:{x:0,y:0,z:0}},rtgAmbient:{value:1},rtgHeadlights:{value:0},rtgLampLeft:{value:{x:0,y:0,z:0}},rtgLampRight:{value:{x:0,y:0,z:0}},rtgLampForward:{value:{x:0,y:0,z:1}},rtgLampUp:{value:{x:0,y:1,z:0}}};
 u.rtgHighBeam.value=highBeams?1:0;u.rtgAux.value=pose?Math.max(0,Math.min(1,auxIntensity)):0;u.rtgVisibility.value=Number.isFinite(visibilityDistanceM)?Math.max(10,visibilityDistanceM):1e9;Object.assign(u.rtgCamera.value,{x:0,y:0,z:0},cameraPosition);
 u.rtgAmbient.value=brightness;u.rtgHeadlights.value=pose?Math.max(0,Math.min(1,headlightIntensity)):0;
 if(pose){const light=rallyLightPose(pose,dimensions);for(const [k,v] of Object.entries({rtgLampLeft:light.left,rtgLampRight:light.right,rtgLampForward:light.forward,rtgLampUp:light.up}))Object.assign(u[k].value,v);}
 renderer.scene.traverse(object=>{const m=object.material;if(Array.isArray(m))m.forEach(m=>installRaceLighting(m,u));else if(m)installRaceLighting(m,u);});
 return u;
}
