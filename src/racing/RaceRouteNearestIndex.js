// Exact nearest-segment queries for long routes, including off-road points and
// cars queued behind the start. Bounding-box pruning avoids a full route scan.
export function buildRaceRouteNearestIndex(samples) {
  const segments=[];
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i];
    segments.push({index:i,ax:Number(a.x)||0,az:Number(a.z)||0,bx:Number(b.x)||0,bz:Number(b.z)||0});
  }
  const build=items=>{
    const node={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
    for(const s of items){node.minX=Math.min(node.minX,s.ax,s.bx);node.maxX=Math.max(node.maxX,s.ax,s.bx);node.minZ=Math.min(node.minZ,s.az,s.bz);node.maxZ=Math.max(node.maxZ,s.az,s.bz);}
    if(items.length<=8){node.items=items;return node;}
    const xAxis=node.maxX-node.minX>=node.maxZ-node.minZ;
    items.sort((a,b)=>xAxis?(a.ax+a.bx)-(b.ax+b.bx):(a.az+a.bz)-(b.az+b.bz));
    const middle=items.length>>1;node.left=build(items.slice(0,middle));node.right=build(items.slice(middle));return node;
  };
  return build(segments);
}

export function nearestRaceRouteSegment(root,x,z) {
  let bestDistance=Infinity,bestIndex=-1;
  const boxDistance=n=>{const dx=Math.max(n.minX-x,0,x-n.maxX),dz=Math.max(n.minZ-z,0,z-n.maxZ);return dx*dx+dz*dz;};
  const visit=node=>{
    if(!node||boxDistance(node)>bestDistance)return;
    if(node.items){for(const s of node.items){const dx=s.bx-s.ax,dz=s.bz-s.az,lengthSq=Math.max(.0001,dx*dx+dz*dz),t=Math.max(0,Math.min(1,((x-s.ax)*dx+(z-s.az)*dz)/lengthSq)),ox=x-s.ax-dx*t,oz=z-s.az-dz*t,d=ox*ox+oz*oz;if(d<bestDistance||(d===bestDistance&&(bestIndex<0||s.index<bestIndex))){bestDistance=d;bestIndex=s.index;}}return;}
    const first=boxDistance(node.left)<=boxDistance(node.right)?node.left:node.right;
    visit(first);visit(first===node.left?node.right:node.left);
  };
  visit(root);return bestIndex;
}
