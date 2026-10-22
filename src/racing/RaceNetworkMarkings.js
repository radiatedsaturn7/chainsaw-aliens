// Build decorations from each baked branch, never from the flattened route:
// this also keeps bridge/tunnel paint at the authored road height.
export function buildNetworkMarkings(paths,{boundaryWidth=.22,marginVisible=true,boundaryArt=()=>'',posts=()=>[],dashLength=3.048,dashInterval=12.192,dashWidth=.12,postInterval=48.768}={}){
 const roadPaintMeshes=[],boundaryMeshes=[],trackFurnitureMeshes=[];
 for(const {sections=[]} of paths||[]){
  if(sections.length<2)continue;
  const start=Math.max(0,sections[0].center.distance),end=sections.at(-1).center.distance;
  const at=distance=>{
   let lo=0,hi=sections.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(sections[mid].center.distance<distance)lo=mid;else hi=mid;}
   const a=sections[lo],b=sections[hi],t=Math.max(0,Math.min(1,(distance-a.center.distance)/Math.max(1e-9,b.center.distance-a.center.distance)));
   const lerp=(p,q)=>({...p,x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t,elevation:p.elevation+(q.elevation-p.elevation)*t});
   return {center:{...lerp(a.center,b.center),distance,yaw:Math.atan2(b.center.x-a.center.x,b.center.z-a.center.z)},left:lerp(a.left,b.left),right:lerp(a.right,b.right)};
  };
  const offset=(p,yaw,width)=>({...p,x:p.x+Math.cos(yaw)*width,z:p.z-Math.sin(yaw)*width});
  for(let d=Math.ceil(start/dashInterval)*dashInterval;d<end;d+=dashInterval){
   const a=at(d),b=at(Math.min(end,d+dashLength));
   roadPaintMeshes.push({source:'road-paint-lane',points:[offset(b.center,b.center.yaw,-dashWidth/2),offset(b.center,b.center.yaw,dashWidth/2),offset(a.center,a.center.yaw,dashWidth/2),offset(a.center,a.center.yaw,-dashWidth/2)],color:'#ffffff',textured:false,threeLiftM:.035});
  }
  if(marginVisible&&boundaryWidth>0)for(let i=1;i<sections.length;i++){
   const a=sections[i-1],b=sections[i],artRef=boundaryArt(a.center.segment);
   for(const [side,sign] of [['left',-1],['right',1]]){
    boundaryMeshes.push({source:'boundary-'+side+'-network',points:[b[side],offset(b[side],b.center.yaw,sign*boundaryWidth),offset(a[side],a.center.yaw,sign*boundaryWidth),a[side]],color:artRef?'#ffffff':Math.floor(a.center.distance/3)%2?'#f2c94c':'#db3b35',artRef,textured:Boolean(artRef),textureWorldM:2.5,threeLiftM:.035});
   }
  }
  for(let d=Math.ceil(start/postInterval)*postInterval;d<=end;d+=postInterval){
   const section=at(d);
   for(const [side,sign] of [['left',-1],['right',1]])trackFurnitureMeshes.push(...posts(offset(section[side],section.center.yaw,sign*(boundaryWidth+.12)),section.center.yaw));
  }
 }
 return {roadPaintMeshes,boundaryMeshes,trackFurnitureMeshes};
}
