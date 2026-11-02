import * as THREE from '../../vendorBridge/three.js';
const PALETTE=[[30,112,178],[66,151,218],[25,24,28],[157,116,65],[139,101,59],[91,66,43],[232,242,249],[118,224,246],[66,35,82],[215,77,48]];
const OFFSETS=[[0,0],[-.5,-.5],[-.5,.5],[.5,.5],[.5,-.5]];
// Reuse GPU buffers for visual refreshes. No physics or terrain state changes.
export function buildTrackStateGroundGeometry(cells,sampleHeight,existing=null){
 const build=iterateTrackStateGroundGeometry(cells,sampleHeight,existing);
 let result;do{result=build.next();}while(!result.done);
 return result.value;
}

export function* iterateTrackStateGroundGeometry(cells,sampleHeight,existing=null){
 const geometry=existing||new THREE.BufferGeometry();
 const required=cells.length*12;
 let position=geometry.getAttribute('position'),color=geometry.getAttribute('color');
 if(!position||position.count<required){
  // Resize only when capacity grows, not each weather tick.
  if(position)geometry.dispose();
  const capacity=Math.max(required,position?.count||0);
  position=new THREE.Float32BufferAttribute(new Float32Array(capacity*3),3);
  color=new THREE.Float32BufferAttribute(new Float32Array(capacity*4),4);
  position.setUsage(THREE.DynamicDrawUsage);color.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position',position);geometry.setAttribute('color',color);
 }
 const points=new Float64Array(15),weights=new Float64Array(10);
 let count=0,minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
 let processed=0;
 for(const cell of cells){
  if(processed++ % 32 === 0) yield null;
  weights[0]=Math.max(cell.wetness||0,cell.dampness||0);weights[1]=cell.standingWater||0;
  weights[2]=(cell.rubber||0)*.9;weights[3]=Math.max(cell.loose||0,cell.marbles||0);
  weights[4]=cell.dirt||0;weights[5]=cell.mud||0;weights[6]=cell.snow||0;
  weights[7]=cell.ice||0;weights[8]=cell.oil||0;weights[9]=cell.debris||0;
  let total=0,maximum=0,r=0,g=0,b=0;
  for(let i=0;i<10;i++){
   const w=Math.max(0,Math.min(1,weights[i]));total+=w;maximum=Math.max(maximum,w);
   r+=w*PALETTE[i][0];g+=w*PALETTE[i][1];b+=w*PALETTE[i][2];
  }
  if(!total||!Number.isFinite(cell.x)||!Number.isFinite(cell.z))continue;
  r/=total*255;g/=total*255;b/=total*255;
  const alpha=Math.min(.32,.08+maximum*.24);
  for(let i=0;i<5;i++){
   const x=cell.x+OFFSETS[i][0],z=cell.z+OFFSETS[i][1],h=sampleHeight?.(x,z);
   const y=(Number.isFinite(h)?h:Number(cell.elevationM||0))+.025;
   points[i*3]=x;points[i*3+1]=y;points[i*3+2]=z;
   minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
  }
  for(let i=0;i<4;i++)for(let v=0;v<3;v++){
   const p=(v===0?0:v===1?i+1:(i+1)%4+1)*3;
   position.array[count*3]=points[p];position.array[count*3+1]=points[p+1];position.array[count*3+2]=points[p+2];
   color.array[count*4]=r;color.array[count*4+1]=g;color.array[count*4+2]=b;color.array[count*4+3]=v===0?alpha:0;count++;
  }
 }
 geometry.setDrawRange(0,count);position.needsUpdate=true;color.needsUpdate=true;
 // Ignore unused capacity when computing culling bounds after a smaller update.
 geometry.boundingSphere ||= new THREE.Sphere();
 geometry.boundingSphere.center.set(count?(minX+maxX)/2:0,count?(minY+maxY)/2:0,count?(minZ+maxZ)/2:0);
 geometry.boundingSphere.radius=count?Math.hypot(maxX-minX,maxY-minY,maxZ-minZ)/2:0;
 return geometry;
}
