import {forEachPackedRaceTileMapCell} from './RacePackedTileMap.js';

// A compact cell lookup and padded atlas blend terrain paint in world space.
// Collision/material sampling continues to use the original tile map.
export function terrainBlendGrid(tileMap, resolveArt) {
 // Campaign loading moves cells into packed storage; editor changes remain
 // sparse overrides. Match the runtime terrain sampler's precedence.
 const overrides=tileMap?.cells||{};
 const entries=[];
 forEachPackedRaceTileMapCell(tileMap?.runtimePackedCells,(cell,{cellX,cellY})=>{
  if(!Object.prototype.hasOwnProperty.call(overrides,`${cellX},${cellY}`)){
   entries.push({xy:[cellX,cellY],art:resolveArt(cell)});
  }
 });
 for(const [key,cell] of Object.entries(overrides)){
  const xy=key.split(',').map(Number);
  if(xy.length===2&&xy.every(Number.isInteger))entries.push({xy,art:resolveArt(cell)});
 }
 if(!entries.length)return null;
 let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
 for(const {xy:[x,z]} of entries){minX=Math.min(minX,x);minZ=Math.min(minZ,z);maxX=Math.max(maxX,x);maxZ=Math.max(maxZ,z);}
 const width=maxX-minX+1,height=maxZ-minZ+1;
 if(width*height>4194304)return null;
 const refs=[...new Set(entries.map(e=>e.art).filter(Boolean))];
 if(!refs.length||refs.length>255)return null;
 const data=new Uint8Array(width*height*4);for(let i=3;i<data.length;i+=4)data[i]=255;
 for(const {xy:[x,z],art} of entries)data[((z-minZ)*width+x-minX)*4]=Math.max(0,refs.indexOf(art));
 return {width,height,minX,minZ,data,refs,cellSize:Math.max(1,Number(tileMap.cellSizeM)||55)};
}
// Quadratic B-spline reconstruction of cell-centred material coverage. Unlike
// feathering each tile edge independently, this smooths the boundary itself:
// stair steps receive contributions from the diagonal as well as edge neighbors.
// Three taps per axis form a partition of unity and have continuous derivatives.
export function terrainBlendWeights(x,z,cellSize){
 const axis=value=>{
  const t=value/cellSize-Math.floor(value/cellSize);
  return [.5*(1-t)*(1-t),.5+t-t*t,.5*t*t];
 };
 const u=axis(x),v=axis(z);
 return v.flatMap(w=>u.map(a=>a*w));
}
export function createTerrainBlendMaterial({THREE,grid,getCanvas,textureWorldM=2.5,makeMaterial}){
 const images=grid.refs.map(getCanvas);if(images.some(i=>!i))return null;
 // Store each material's independently filtered mip levels inside its slot.
 // Automatic atlas mipmaps would mix gravel/dirt across slot boundaries.
 const count=Math.ceil(Math.sqrt(images.length)),pitch=512,pad=2;
 const makeCanvas=(width,height)=>{
  const c=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):globalThis.document?.createElement('canvas');
  if(c){c.width=width;c.height=height;}return c;
 };
 const canvas=makeCanvas(count*pitch,count*pitch);
 if(!canvas)return null;
 const ctx=canvas.getContext('2d');
 images.forEach((img,i)=>{
  let previous=img;
  for(let level=0;level<=8;level++){
   const tile=256/2**level;
   const mip=makeCanvas(tile,tile),mc=mip.getContext('2d');
   mc.imageSmoothingEnabled=true;mc.imageSmoothingQuality='high';
   mc.drawImage(previous,0,0,tile,tile);previous=mip;
   const x=i%count*pitch+(level?260:0);
   const y=Math.floor(i/count)*pitch+(level?256-256/2**(level-1)+4*(level-1):0);
   ctx.drawImage(mip,x+pad,y+pad,tile,tile);
   ctx.drawImage(mip,tile-1,0,1,tile,x,y+pad,pad,tile);
   ctx.drawImage(mip,0,0,1,tile,x+pad+tile,y+pad,pad,tile);
   ctx.drawImage(mip,0,tile-1,tile,1,x+pad,y,tile,pad);
   ctx.drawImage(mip,0,0,tile,1,x+pad,y+pad+tile,tile,pad);
   for(const [dx,sx] of [[0,tile-1],[pad+tile,0]])for(const [dy,sy] of [[0,tile-1],[pad+tile,0]])ctx.drawImage(mip,sx,sy,1,1,x+dx,y+dy,pad,pad);
  }
 });
 const atlas=new THREE.CanvasTexture(canvas);
 // LOD interpolation happens explicitly below, so no GPU-generated atlas mips.
 atlas.generateMipmaps=false;atlas.minFilter=atlas.magFilter=THREE.LinearFilter;
 const lookup=new THREE.DataTexture(grid.data,grid.width,grid.height);lookup.minFilter=lookup.magFilter=THREE.NearestFilter;lookup.generateMipmaps=false;lookup.needsUpdate=true;
 const material=makeMaterial(atlas);material.depthFunc=THREE.EqualDepth;material.depthWrite=false;
 material.extensions={...material.extensions,derivatives:true};
 material.onBeforeCompile=shader=>{
  shader.uniforms.terrainCells={value:lookup};shader.uniforms.terrainGrid={value:new THREE.Vector4(grid.minX,grid.minZ,grid.width,grid.height)};
  shader.uniforms.terrainScale={value:new THREE.Vector4(grid.cellSize,textureWorldM,count,pitch)};
  shader.vertexShader='varying vec2 terrainXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainXZ=position.xz;');
  const helpers=`varying vec2 terrainXZ;
   uniform sampler2D terrainCells; uniform vec4 terrainGrid; uniform vec4 terrainScale;
   vec4 terrainMip(vec2 slot,vec2 repeatUV,float level){
    float tile=256./exp2(level);
    vec2 offset=level<.5?vec2(0.):vec2(260.,256.-512./exp2(level)+4.*(level-1.));
    // Canvas rows run downward; the CanvasTexture is uploaded flipped in Y.
    vec2 pixel=slot*terrainScale.w+offset+2.+vec2(fract(repeatUV.x),1.-fract(repeatUV.y))*tile;
    vec2 uv=vec2(pixel.x,terrainScale.z*terrainScale.w-pixel.y)/(terrainScale.z*terrainScale.w);
    return texture2D(map,uv);
   }
   vec4 terrainSample(vec2 cell,vec2 repeatUV,float lod){
    vec2 lookupUV=(clamp(cell-terrainGrid.xy,vec2(0.),terrainGrid.zw-1.)+.5)/terrainGrid.zw;
    float id=floor(texture2D(terrainCells,lookupUV).r*255.+.5);
    vec2 slot=vec2(mod(id,terrainScale.z),floor(id/terrainScale.z));
    float low=floor(lod),high=min(8.,low+1.);
    return mix(terrainMip(slot,repeatUV,low),terrainMip(slot,repeatUV,high),fract(lod));
   }\n`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>','#include <map_pars_fragment>\n'+helpers).replace('#include <map_fragment>',`
    vec2 base;
    // Cell centres are at (index + .5). Reconstruct a smooth coverage
    // field, rather than keeping a flat interior and feathering square edges.
    base=floor(terrainXZ/terrainScale.x);
    vec2 t=fract(terrainXZ/terrainScale.x);
    vec3 wx=vec3(.5*(1.-t.x)*(1.-t.x),.5+t.x-t.x*t.x,.5*t.x*t.x);
    vec3 wz=vec3(.5*(1.-t.y)*(1.-t.y),.5+t.y-t.y*t.y,.5*t.y*t.y);
    vec2 uv=vec2(terrainXZ.x,-terrainXZ.y)/terrainScale.y;
    // Derivatives must precede fract(): repetition seams are not distance.
    vec2 dx=dFdx(uv)*256.,dy=dFdy(uv)*256.;
    float lod=clamp(.5*log2(max(1.,max(dot(dx,dx),dot(dy,dy)))),0.,8.);
    vec4 terrainPaint=vec4(0.);
    for(int z=0;z<3;z++){
     for(int x=0;x<3;x++){
      terrainPaint+=terrainSample(base+vec2(float(x)-1.,float(z)-1.),uv,lod)*wx[x]*wz[z];
     }
    }
    diffuseColor*=terrainPaint;
   `);
 };
 material.customProgramCacheKey=()=> 'terrain-world-blend-v3-filtered-mips';
 material.addEventListener('dispose',()=>{atlas.dispose();lookup.dispose();});
 return material;
}
