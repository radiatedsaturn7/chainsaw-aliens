// Opt-in shader instrumentation for validation captures. Uses the actual
// Three physical shader, including its maps and normal/roughness filtering.
// Never attach this to ordinary game rendering unless requested by QA.
export const vehicleRenderChannels=Object.freeze([
 'final','base-color','direct-diffuse','indirect-diffuse','direct-specular',
 'indirect-specular','clearcoat','roughness','clearcoat-roughness','metalness',
 'occlusion','world-normal','reflection-vector','linear-hdr'
]);
const expressions={
 'base-color':'diffuseColor.rgb',
 'direct-diffuse':'reflectedLight.directDiffuse',
 'indirect-diffuse':'reflectedLight.indirectDiffuse',
 'direct-specular':'reflectedLight.directSpecular',
 'indirect-specular':'reflectedLight.indirectSpecular',
 'roughness':'vec3(material.roughness)',
 'metalness':'vec3(metalnessFactor)',
 'world-normal':'0.5 + 0.5 * inverseTransformDirection(geometryNormal, viewMatrix)',
 'reflection-vector':'0.5 + 0.5 * inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix)',
};
const channelSource=(channel)=> {
 if(channel==='clearcoat')return `vec3 vehicleDiagnostic=vec3(0.0);
#ifdef USE_CLEARCOAT
 vehicleDiagnostic = (clearcoatSpecularDirect + clearcoatSpecularIndirect) * material.clearcoat;
#endif`;
 if(channel==='clearcoat-roughness')return `vec3 vehicleDiagnostic=vec3(0.0);
#ifdef USE_CLEARCOAT
 vehicleDiagnostic=vec3(material.clearcoatRoughness);
#endif`;
 if(channel==='occlusion')return `vec3 vehicleDiagnostic=vec3(1.0);
#ifdef USE_AOMAP
 vehicleDiagnostic=vec3(ambientOcclusion);
#endif`;
 if(channel==='linear-hdr')return `// Log encoding: .0 = -8 EV, 1.0 = +6 EV relative to .18 linear gray.
 vec3 vehicleDiagnostic=clamp((log2(max(gl_FragColor.rgb,vec3(0.0001))/.18)+8.0)/14.0,0.0,1.0);`;
 return 'vec3 vehicleDiagnostic = '+expressions[channel]+';';
};
// Dispose this wrapper before adding a different diagnostic to the material.
export function inspectVehicleShader(material,channel,{gain=1}={}){
 if(!material?.isMeshStandardMaterial||!vehicleRenderChannels.includes(channel))return ()=>{};
 if(channel==='final')return ()=>{};
 if(!Number.isFinite(gain)||gain<=0)throw RangeError('Positive diagnostic gain required');
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
 const cacheKey=previousKey.call(material);
 const anchor='#include <tonemapping_fragment>';
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  if(!shader.fragmentShader.includes(anchor))throw Error('Vehicle diagnostic shader anchor not found');
  // The final anchor is inside the existing automotive shoulder's #else
  // when it is installed. Insert before that entire hook, rather than
  // accidentally hiding diagnostics behind the TONE_MAPPING branch.
  const shoulder='#ifdef TONE_MAPPING\n #include <tonemapping_fragment>';
  const start=shader.fragmentShader.indexOf(shoulder);
  const i=start<0?shader.fragmentShader.indexOf(anchor):start;
  const n=shader.fragmentShader.indexOf('#include <colorspace_fragment>',i);
  if(n<0)throw Error('Vehicle diagnostic shader output not found');
  shader.fragmentShader=shader.fragmentShader.slice(0,i)+channelSource(channel)+
   '\n gl_FragColor.rgb=vehicleDiagnostic * '+gain.toFixed(4)+';\n'+shader.fragmentShader.slice(n);
 };
 material.customProgramCacheKey=()=>cacheKey+'|vehicle-diagnostic:'+channel+':'+gain;
 material.needsUpdate=true;
 return ()=>{
  material.onBeforeCompile=previous;
  material.customProgramCacheKey=previousKey;
  material.needsUpdate=true;
 };
}
