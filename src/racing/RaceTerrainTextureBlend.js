// A compact cell lookup and padded atlas blend terrain paint in world space.
// Collision/material sampling continues to use the original tile map.
export function terrainBlendGrid(tileMap, resolveArt) {
 const entries=Object.entries(tileMap?.cells||{}).map(([key,cell])=>({xy:key.split(',').map(Number),art:resolveArt(cell)}));
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
export function terrainBlendWeights(x,z,cellSize,bandM=8){
 const px=x/cellSize-.5,pz=z/cellSize-.5,b=Math.min(.49,bandM/cellSize);
 const smooth=v=>{const t=Math.max(0,Math.min(1,(v-(.5-b))/(2*b)));return t*t*(3-2*t);};
 const u=smooth(px-Math.floor(px)),v=smooth(pz-Math.floor(pz));
 return [(1-u)*(1-v),u*(1-v),(1-u)*v,u*v];
}
export function createTerrainBlendMaterial({THREE,grid,getCanvas,textureWorldM=2.5,makeMaterial}){
 const images=grid.refs.map(getCanvas);if(images.some(i=>!i))return null;
 const count=Math.ceil(Math.sqrt(images.length)),tile=256,pad=2,pitch=tile+pad*2;
 const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(count*pitch,count*pitch):globalThis.document?.createElement('canvas');
 if(!canvas)return null;canvas.width=canvas.height=count*pitch;const ctx=canvas.getContext('2d');
 images.forEach((img,i)=>{const x=i%count*pitch,y=Math.floor(i/count)*pitch;
  ctx.drawImage(img,x+pad,y+pad,tile,tile);
  // Wrap padding, not neighboring atlas tiles, supplies bilinear edge samples.
  ctx.drawImage(img,img.width-1,0,1,img.height,x,y+pad,pad,tile);ctx.drawImage(img,0,0,1,img.height,x+pad+tile,y+pad,pad,tile);
  ctx.drawImage(img,0,img.height-1,img.width,1,x+pad,y,tile,pad);ctx.drawImage(img,0,0,img.width,1,x+pad,y+pad+tile,tile,pad);
  for(const [dx,sx] of [[0,img.width-1],[pad+tile,0]])for(const [dy,sy] of [[0,img.height-1],[pad+tile,0]])ctx.drawImage(img,sx,sy,1,1,x+dx,y+dy,pad,pad);
 });
 const atlas=new THREE.CanvasTexture(canvas);atlas.generateMipmaps=false;atlas.minFilter=atlas.magFilter=THREE.LinearFilter;
 const lookup=new THREE.DataTexture(grid.data,grid.width,grid.height);lookup.minFilter=lookup.magFilter=THREE.NearestFilter;lookup.generateMipmaps=false;lookup.needsUpdate=true;
 const material=makeMaterial(atlas);material.depthFunc=THREE.EqualDepth;material.depthWrite=false;
 material.onBeforeCompile=shader=>{
  shader.uniforms.terrainCells={value:lookup};shader.uniforms.terrainGrid={value:new THREE.Vector4(grid.minX,grid.minZ,grid.width,grid.height)};
  shader.uniforms.terrainScale={value:new THREE.Vector4(grid.cellSize,textureWorldM,count,pitch)};
  shader.vertexShader='varying vec2 terrainXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainXZ=position.xz;');
  const helpers=`varying vec2 terrainXZ;
   uniform sampler2D terrainCells; uniform vec4 terrainGrid; uniform vec4 terrainScale;
   vec4 terrainSample(vec2 cell,vec2 repeatUV){
    vec2 lookupUV=(clamp(cell-terrainGrid.xy,vec2(0.),terrainGrid.zw-1.)+.5)/terrainGrid.zw;
    float id=floor(texture2D(terrainCells,lookupUV).r*255.+.5);
    vec2 slot=vec2(mod(id,terrainScale.z),terrainScale.z-1.-floor(id/terrainScale.z));
    vec2 uv=(slot*terrainScale.w+2.+fract(repeatUV)*256.)/(terrainScale.z*terrainScale.w);
    return texture2D(map,uv);
   }\n`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>','#include <map_pars_fragment>\n'+helpers).replace('#include <map_fragment>',`
    vec2 cell=terrainXZ/terrainScale.x-.5,base=floor(cell);
    float band=min(.49,8./terrainScale.x);
    vec2 w=smoothstep(vec2(.5-band),vec2(.5+band),fract(cell));
    vec2 uv=vec2(terrainXZ.x,-terrainXZ.y)/terrainScale.y;
    diffuseColor*=mix(mix(terrainSample(base,uv),terrainSample(base+vec2(1.,0.),uv),w.x),mix(terrainSample(base+vec2(0.,1.),uv),terrainSample(base+vec2(1.),uv),w.x),w.y);
   `);
 };
 material.customProgramCacheKey=()=> 'terrain-world-blend-v1';
 material.addEventListener('dispose',()=>{atlas.dispose();lookup.dispose();});
 return material;
}
