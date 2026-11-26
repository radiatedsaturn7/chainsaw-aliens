import * as THREE from '../vendorBridge/three.js';

// On for the two exact WRX render bindings in browsers. Never affects other cars.
// shared with the rest of the fleet. This can be removed without save migration.
const wrxParams=typeof location==='undefined' ? null : new URLSearchParams(location.search);
const wrxMode=wrxParams?.get('wrxLook');
export const wrxLegacyFinish=wrxParams?.get('wrxFinish')==='legacy';
export const wrxVisualMode=Boolean(wrxParams)&&wrxMode!=='off';
export const wrxShowcase=wrxMode==='showcase';
export function wrxPilotPart(ref, enabled = wrxVisualMode) {
  return !enabled ? null : ref === 'Field-Forgetmenot' ? 'body' : ref === 'Field-Forgetmenot-Wheel' ? 'wheel' : null;
}

let sky;
function reflectionSky() {
  if (sky) return sky;
  const w = 128, h = 64, bytes = new Uint8Array(w*h*4);
  for (let y=0; y<h; y++) for(let x=0; x<w; x++) {
    const p=(x+.5)*2*Math.PI/w, t=(y+.5)*Math.PI/h;
    const vy=-Math.cos(t), vx=Math.cos(p)*Math.sin(t), vz=Math.sin(p)*Math.sin(t);
    const up=vy>-.018 ? 1 : 0;
    const clouds=up*Math.max(0,.37+.19*Math.cos(p*2+vy*2)+.10*Math.sin(p*5+vy*8))*Math.exp(-((vy-.32)**2)/.085);
    const glare=Math.max(0,vx*.51+vy*.69+vz*.51)**24;
    // Bright overcast opening opposite the sun. Hood and front shoulders
    // receive an elongated blue-white sky reflection in three-quarter views.
    const sideCloud=Math.max(0,Math.min(1,.72+.17*Math.sin(p*5+vy*13)+.11*Math.cos(p*8-vy*18)));
    const skyOpening=up*sideCloud*Math.max(0,-vx*.41+vy*.49-vz*.768)**9;
    const hzn=Math.exp(-((vy-.033)**2)/.006);
    const skylight=up*Math.exp(-((vy-.52)**2)/.085)*(.58+.42*Math.sin(p+.61)**2);
    const c=[.018+up*(.08+.44*clouds+.25*hzn)+glare*.31+skylight*.18+skyOpening*.45,
      .024+up*(.23+.65*clouds+.38*hzn)+glare*.43+skylight*.35+skyOpening*.54,
      .031+up*(.40+.68*clouds+.51*hzn)+glare*.49+skylight*.43+skyOpening*.59];
    const i=4*(y*w+x);
    c.forEach((v,j)=>{bytes[i+j]=Math.round(255*Math.sqrt(Math.min(1,v)));});
    bytes[i+3]=255;
  }
  // The small equirectangular source is shared; the renderer owns prefiltering.
  sky=new THREE.DataTexture(bytes,w,h,THREE.RGBAFormat);
  sky.mapping=THREE.EquirectangularReflectionMapping;
  sky.colorSpace=THREE.SRGBColorSpace;
  sky.minFilter=sky.magFilter=THREE.LinearFilter;
  sky.needsUpdate=true;
  return sky;
}

// Shared, locally generated HDR daylight probe. World direction is kept
// stable when the car turns; no cube-camera render or per-car probe update.
let daylight;
export function wrxDaylightProbe(){
  if(daylight)return daylight;
  const w=128,h=64,data=new Uint16Array(w*h*4);
  const toHalf=THREE.DataUtils.toHalfFloat;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const phi=(x+.5)*2*Math.PI/w,t=(y+.5)*Math.PI/h;
    const uy=-Math.cos(t),ux=Math.cos(phi)*Math.sin(t),uz=Math.sin(phi)*Math.sin(t);
    const top=Math.max(0,uy),above=uy>0?1:0;
    const patch=(a,b,c,n)=>Math.max(0,a*ux+b*uy+c*uz)**n;
    const breakInClouds=2.55*patch(-.63,.66,.41,24)+1.80*patch(.70,.59,-.40,25)+.80*patch(.19,.90,.38,27);
    const horizon=above*Math.exp(-((uy-.10)**2)/.014)*(.30+.70*Math.cos(phi-.7)**2);
    const cloud=Math.max(0,Math.min(1,.48+.32*Math.cos(phi*4.7+uy*7)+.17*Math.sin(phi*14+uy*13)));
    const glint=5.2*patch(.59,.70,.40,230);
    const c=[.030+above*(.11+.23*top+.43*cloud*top)+horizon*.58+breakInClouds*.57+glint*.79,
      .037+above*(.18+.46*top+.52*cloud*top)+horizon*.81+breakInClouds*.82+glint*.93,
      .046+above*(.26+.66*top+.60*cloud*top)+horizon*.98+breakInClouds+glint];
    const i=(y*w+x)*4;
    c.forEach((v,k)=>{data[i+k]=toHalf(v);});data[i+3]=toHalf(1);
  }
  daylight=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.HalfFloatType);
  daylight.mapping=THREE.EquirectangularReflectionMapping;
  daylight.colorSpace=THREE.LinearSRGBColorSpace;
  daylight.minFilter=THREE.LinearFilter;daylight.magFilter=THREE.LinearFilter;daylight.needsUpdate=true;
  return daylight;
}

function toneWrxPaint(material){
  // Only paint indirect diffuse changes: the shared track's fill, skybox,
  // road, competitors and exposure remain untouched. Keep specular energy.
  material.onBeforeCompile=(shader)=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',
      '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 0.72;');
  };
  material.customProgramCacheKey=()=> 'wrx-paint-daylight-v1';
  return material;
}

export function wrxMaterialKind(name,part) {
  const n=(name||'').toLowerCase();
  if(part==='body'&&/enamel/.test(n))return 'paint';
  if(part==='body'&&/windshield|smoke glass/.test(n))return 'glass';
  if(part==='body'&&/optic|lens/.test(n))return 'optic';
  if(part==='wheel'&&/^(gold|hub|edge)$/.test(n))return 'alloy';
  if(part==='wheel'&&/^(rubber|tread|groove|black)$/.test(n))return 'rubber';
  return null;
}

export function wrxPilotMaterial(options,name,part) {
  const kind=wrxMaterialKind(name,part);
  const opt={...options, name};
  if(kind==='paint') {
    const map=opt.map;
    if(map){map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;}
    const color=new THREE.Color(opt.color).multiplyScalar(map ? .88 : .75);
    if(wrxLegacyFinish)return new THREE.MeshPhysicalMaterial({...opt,color,
      roughness:.29,metalness:.26,clearcoat:.89,clearcoatRoughness:.20,envMap:reflectionSky(),envMapIntensity:1.06});
    color.r*=.82;color.g*=.90;
    return toneWrxPaint(new THREE.MeshPhysicalMaterial({...opt,color,
      roughness:.25,metalness:.31,clearcoat:.92,clearcoatRoughness:.107,
      envMap:wrxDaylightProbe(),envMapIntensity:1.12}));
  }
  if(kind==='optic'&&opt.map){
    opt.map.magFilter=THREE.LinearFilter;
    opt.map.minFilter=THREE.LinearMipmapLinearFilter;
    opt.map.generateMipmaps=true;
    opt.map.needsUpdate=true;
    const head=name==='Continuous reflector headlight lens';
    return new THREE.MeshPhysicalMaterial({...opt,roughness:head?.58:.48,metalness:.06,
      clearcoat:head?.16:.34,clearcoatRoughness:head?.44:.33,envMap:reflectionSky(),envMapIntensity:head?.15:.31});
  }
  if(kind==='glass'&&!wrxLegacyFinish)return new THREE.MeshPhysicalMaterial({...opt,depthWrite:false,
    metalness:.01,roughness:.20,ior:1.5,specularIntensity:1.22,clearcoat:.58,clearcoatRoughness:.126,
    envMap:wrxDaylightProbe(),envMapIntensity:.78});
  const params={glass:[.18,.31,.73],optic:[.37,.15,.49],alloy:[.36,.61,.67],rubber:[.91,0,0]}[kind];
  if(!params)return new THREE.MeshStandardMaterial(opt);
  const [roughness,metalness,envMapIntensity]=params;
  return new THREE.MeshStandardMaterial({...opt,roughness,metalness,envMapIntensity,
    envMap:envMapIntensity?(kind==='alloy'&&!wrxLegacyFinish?wrxDaylightProbe():reflectionSky()):null,
    depthWrite:kind!=='glass',
    color:new THREE.Color(opt.color).multiplyScalar(kind==='rubber' ? .46 : 1)});
}

// Weld normals along adjoining faces below the crease angle, without changing
// topology, precise face indices, or UV seams. Run at load, not each frame.
export function benchmarkNormals(geometry, crease=42, angleWeighted=false) {
  const p=geometry.attributes.position, n=p.count, parent=new Int32Array(n);
  const face=new Float32Array(n), unit=new Float32Array(n), sums=new Float32Array(n*3);
  const keys=Array.from({length:n},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*100000)).join(','));
  const edge=new Map(), cos=Math.cos(crease*Math.PI/180);
  for(let i=0;i<n;i++)parent[i]=i;
  function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  function join(a,b){parent[root(a)]=root(b);}
  for(let i=0;i<n;i+=3){
    const ax=p.getX(i+1)-p.getX(i),ay=p.getY(i+1)-p.getY(i),az=p.getZ(i+1)-p.getZ(i);
    const bx=p.getX(i+2)-p.getX(i),by=p.getY(i+2)-p.getY(i),bz=p.getZ(i+2)-p.getZ(i);
    const x=ay*bz-az*by,y=az*bx-ax*bz,z=ax*by-ay*bx,d=Math.hypot(x,y,z);
    if (d<1e-12) continue;
    face.set([x,y,z],i);unit.set([x/d,y/d,z/d],i);
    for(let k=0;k<3;k++){
      let a=i+k,b=i+(k+1)%3;if(keys[a]===keys[b])continue;
      if(keys[a]>keys[b])[a,b]=[b,a];
      const key=keys[a]+'|'+keys[b], matches=edge.get(key)||[];
      for(const [j,ja,jb] of matches){
        if(unit[j]*unit[i]+unit[j+1]*unit[i+1]+unit[j+2]*unit[i+2]>=cos){join(a,ja);join(b,jb);}
      }
      matches.push([i,a,b]);edge.set(key,matches);
    }
  }
  for(let i=0;i<n;i++){
    const f=i-i%3,r=3*root(i);
    let factor=1;
    // The fender rails use deliberately spaced support stations. Corner
    // angle weights avoid a large neighbor pulling the reflection across
    // its smaller adjacent sampling cells.
    if(angleWeighted){
      const a=f+(i-f+1)%3,b=f+(i-f+2)%3;
      const x1=p.getX(a)-p.getX(i),y1=p.getY(a)-p.getY(i),z1=p.getZ(a)-p.getZ(i);
      const x2=p.getX(b)-p.getX(i),y2=p.getY(b)-p.getY(i),z2=p.getZ(b)-p.getZ(i);
      const aLen=Math.hypot(x1,y1,z1),bLen=Math.hypot(x2,y2,z2);
      const faceLen=Math.hypot(face[f],face[f+1],face[f+2])||1;
      factor=aLen&&bLen?Math.acos(Math.max(-1,Math.min(1,(x1*x2+y1*y2+z1*z2)/(aLen*bLen))))/faceLen:0;
    }
    for(let k=0;k<3;k++)sums[r+k]+=factor*face[f+k];
  }
  const attr=geometry.attributes.normal||new THREE.Float32BufferAttribute(n*3,3);
  for(let i=0;i<n;i++){
    const j=root(i)*3,x=sums[j],y=sums[j+1],z=sums[j+2],d=Math.hypot(x,y,z)||1;
    attr.setXYZ(i,x/d,y/d,z/d);
  }
  geometry.setAttribute('normal',attr);attr.needsUpdate=true;
}


let contactMap;
export function wrxContactTexture() {
  if(contactMap)return contactMap;
  const n=wrxLegacyFinish?32:64, bytes=new Uint8Array(n*n*4);
  const fade=(x,w)=>{const t=Math.min(1,Math.max(0,(1-Math.abs(x))/w));return t*t*(3-2*t);};
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=2*x/(n-1)-1,v=2*y/(n-1)-1;
    const old=fade(u,.51)*fade(v,.35);
    const tyre=Math.exp(-(((Math.abs(u)-.705)/.143)**2+((Math.abs(v)-.51)/.147)**2));
    const belly=.88*fade(u,.60)*fade(v,.48);
    const center=.13*Math.exp(-(u*u/.15+v*v/.31));
    const shape=wrxLegacyFinish?old:Math.min(1,(belly+center+.57*tyre)*fade(u,.10)*fade(v,.10));
    bytes[4*(y*n+x)+3]=Math.round(255*shape);
  }
  contactMap=new THREE.DataTexture(bytes,n,n,THREE.RGBAFormat);
  contactMap.minFilter=contactMap.magFilter=THREE.LinearFilter;contactMap.needsUpdate=true;
  return contactMap;
}
