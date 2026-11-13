import { subtractRaceTerrainPolygonByConvexPolygon } from './RaceTerrainClipping.js';

export const ADAPTIVE_TERRAIN_REVISION = 'adaptive-ground-v3';
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t*t*(3-2*t); };
const cross = (a,b,c) => (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const pointKey = p => `${Math.round(p.x*1e6)},${Math.round(p.z*1e6)}`;
const interpolate = (a,b,t) => ({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});

// Preserve collinear boundary vertices: removing them opens height cracks on
// graded road edges. Small convex clipped pieces need no shared fan center.
export function triangulateTerrainBoundary(input) {
  const polygon = input.filter((p,i) => i===0 || Math.hypot(p.x-input[i-1].x,p.z-input[i-1].z)>1e-6);
  if (polygon.length>1 && pointKey(polygon[0])===pointKey(polygon.at(-1))) polygon.pop();
  if (polygon.length<3) return [];
  const origin=polygon[0];
  const area=polygon.reduce((sum,p,i)=>sum+cross(origin,p,polygon[(i+1)%polygon.length]),0);
  if(Math.abs(area)<1e-12)return [];
  const sign=Math.sign(area),remaining=[...polygon],result=[];
  while(remaining.length>3){
    let best=-1,bestLength=Infinity;
    for(let i=0;i<remaining.length;i++){
      const a=remaining[(i+remaining.length-1)%remaining.length],b=remaining[i],c=remaining[(i+1)%remaining.length];
      if(sign*cross(a,b,c)<=1e-12)continue;
      const blocked=remaining.some(p=>p!==a&&p!==b&&p!==c&&sign*cross(a,b,p)>=-1e-12&&sign*cross(b,c,p)>=-1e-12&&sign*cross(c,a,p)>=-1e-12);
      if(blocked)continue;
      const length=(a.x-c.x)**2+(a.z-c.z)**2;
      if(length<bestLength){best=i;bestLength=length;}
    }
    if(best<0 && remaining.every(p=>Math.abs(cross(remaining[0],remaining[1],p))<1e-10)) return result;
    if(best<0)throw new Error(`Adaptive terrain boundary cannot be triangulated without losing an edge: ${JSON.stringify(remaining.map(({x,z})=>({x,z})))}`);
    result.push([remaining[(best+remaining.length-1)%remaining.length],remaining[best],remaining[(best+1)%remaining.length]]);
    remaining.splice(best,1);
  }
  if(Math.abs(cross(...remaining))>1e-12)result.push(remaining);
  return result;
}

function spatialIndex(size) {
  const buckets=new Map();
  return {
    clear(){buckets.clear();},
    add(item,minX,maxX,minZ,maxZ){
      for(let z=Math.floor(minZ/size);z<=Math.floor(maxZ/size);z++)for(let x=Math.floor(minX/size);x<=Math.floor(maxX/size);x++){
        const key=`${x},${z}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(item);
      }
    },
    at(x,z){return buckets.get(`${Math.floor(x/size)},${Math.floor(z/size)}`)||[];},
    within(minX,maxX,minZ,maxZ){
      const found=new Set();
      for(let z=Math.floor(minZ/size);z<=Math.floor(maxZ/size);z++)for(let x=Math.floor(minX/size);x<=Math.floor(maxX/size);x++)for(const item of buckets.get(`${x},${z}`)||[])found.add(item);
      return found;
    }
  };
}

// Most conformity edges are axis-aligned cell borders. A sorted line lookup
// visits only vertices near that border instead of all vertices in a square
// spatial bucket. Diagonal road cuts still use the general spatial index.
function boundaryVertexIndex(points, spatial) {
  const columns = new Map(), rows = new Map();
  const add = (map, key, point) => {
    let line = map.get(key);
    if (!line) map.set(key, line = []);
    line.push(point);
  };
  for (const p of points) {
    add(columns, Math.round(p.x*1e6), p);
    add(rows, Math.round(p.z*1e6), p);
  }
  for (const line of columns.values()) line.sort((a,b)=>a.z-b.z);
  for (const line of rows.values()) line.sort((a,b)=>a.x-b.x);
  return function* candidates(a,b) {
    const vertical = a.x === b.x, horizontal = a.z === b.z;
    if (!vertical && !horizontal) {
      yield* spatial.within(Math.min(a.x,b.x)-1e-6,Math.max(a.x,b.x)+1e-6,Math.min(a.z,b.z)-1e-6,Math.max(a.z,b.z)+1e-6);
      return;
    }
    const map = vertical ? columns : rows, axis = vertical ? 'z' : 'x';
    const key = Math.round((vertical ? a.x : a.z)*1e6);
    const low = Math.min(a[axis],b[axis])-1e-6, high = Math.max(a[axis],b[axis])+1e-6;
    // Neighboring rounded keys include vertices within the existing seam
    // tolerance even when rounding puts them on opposite sides of a bin.
    for (let k=key-1;k<=key+1;k++) {
      const line=map.get(k);
      if (!line) continue;
      let lo=0,hi=line.length;
      while(lo<hi){const mid=(lo+hi)>>>1;if(line[mid][axis]<low)lo=mid+1;else hi=mid;}
      for(let i=lo;i<line.length&&line[i][axis]<=high;i++)yield line[i];
    }
  };
}

export function createAdaptiveTerrainField({surfaceBake,runtimeType='destination',sampleGround,elevationScaleM=12}) {
  const sections=surfaceBake?.sections||[],footprints=spatialIndex(32),edges=spatialIndex(32),boundaryVertices=[];
  const count=runtimeType==='circuit'?sections.length:sections.length-1;
  const outer=(s,side)=>s[`shoulder${side}`]||s[`margin${side}`]||s[side.toLowerCase()];
  const width=(s,side)=>Math.max(8,Number(s.metrics?.[`${side}TransitionWidth`]??s.metrics?.transitionWidth)||32);
  const addEdge=(a,b,w)=>{
    const dx=b.x-a.x,dz=b.z-a.z;
    const edge={a,b,width:w,dx,dz,lengthSquared:dx*dx+dz*dz,length:Math.sqrt(dx*dx+dz*dz)};
    edges.add(edge,Math.min(a.x,b.x)-w,Math.max(a.x,b.x)+w,Math.min(a.z,b.z)-w,Math.max(a.z,b.z)+w);
    boundaryVertices.push(a,b);
  };
  for(let i=0;i<count;i++){
    const a=sections[i],b=sections[(i+1)%sections.length];
    const al=outer(a,'Left'),ar=outer(a,'Right'),bl=outer(b,'Left'),br=outer(b,'Right');
    if(!al||!ar||!bl||!br)continue;
    for(const points of [[al,ar,br],[al,br,bl]]){
      const footprint={points,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};
      footprints.add(footprint,footprint.minX,footprint.maxX,footprint.minZ,footprint.maxZ);
    }
    addEdge(al,bl,Math.max(width(a,'left'),width(b,'left')));
    addEdge(ar,br,Math.max(width(a,'right'),width(b,'right')));
    if(runtimeType!=='circuit'&&i===0)addEdge(al,ar,Math.max(width(a,'left'),width(a,'right')));
    if(runtimeType!=='circuit'&&i===count-1)addEdge(bl,br,Math.max(width(b,'left'),width(b,'right')));
  }
  const cache=new Map(), probeCache=new Map();
  const sample=(x,z,retain=true)=>{
    const key=pointKey({x,z}), existing=cache.get(key)||probeCache.get(key);
    if(existing)return existing;
    let nearest=Infinity,blend=1,total=0,height=0,seam=null;
    for(const edge of edges.at(x,z)){
      const {a,b,width,length,dx,dz,lengthSquared}=edge;if(length<1e-9)continue;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/lengthSquared));
      const px=x-a.x-t*dx,pz=z-a.z-t*dz;
      const distance=Math.sqrt(px*px+pz*pz);
      const h=a.elevation+(b.elevation-a.elevation)*t;
      nearest=Math.min(nearest,distance);
      if(distance<1e-7){seam=h;break;}
      if(distance>=width)continue;
      const fade=smooth(distance/width),weight=length*(1-fade)/(distance*distance);
      blend=Math.min(blend,fade);total+=weight;height+=weight*h;
    }
    const raw=sampleGround({x,z});
    const elevation=seam!==null?seam:total?raw*blend+(height/total)*(1-blend):raw;
    const result={x,z,y:z,elevation,terrainRegion:total||seam!==null?'transition':'terrain',exactRoadSeam:seam!==null,trackSeam:seam!==null,distanceToRoad:seam!==null?0:nearest};
    if(seam!==null)result.roadSeamElevation=seam;
    if(retain){if(cache.size>=65536)cache.clear();cache.set(key,result);}
    else {if(probeCache.size>=65536)probeCache.clear();probeCache.set(key,result);}
    return result;
  };
  return {sample,query:(x,z)=>sample(x,z,false),footprints,boundaryVertices,elevationScaleM,
    release(){cache.clear();probeCache.clear();edges.clear();footprints.clear();boundaryVertices.length=0;}
  };
}

// Bake one conforming surface for rendering and tire/body contact. Keep the
// authored road boundary fixed, refine the surrounding height field, then split
// shared edges before triangulation so coarse/fine neighbors cannot form cracks.
export function buildAdaptiveRaceTerrain({surfaceBake,runtimeType='destination',bounds,sourceCellSize=75,sampleGround,tileAt,elevationScaleM=12,minCellSize=.625,onProgress=()=>{},reuseConformingPolygons=true,useBalanceQueue=true,useBoundaryIndex=true}) {
  const started=Date.now();
  // All triangles in one authored tile share its immutable material descriptor.
  const materials=new Map();
  const materialAt=point=>{
    const key=`${Math.floor(point.x/sourceCellSize)},${Math.floor(point.z/sourceCellSize)}`;
    if(!materials.has(key))materials.set(key,tileAt(point));
    return materials.get(key);
  };
  const field=createAdaptiveTerrainField({surfaceBake,runtimeType,sampleGround,elevationScaleM});
  const {sample,query,footprints}=field;
  const stats={algorithm:ADAPTIVE_TERRAIN_REVISION,unresolvedHeightErrors:0,maxHeightErrorM:0,leafCells:0,minimumCellSizeM:Infinity};
  // Cut/fill transitions can reach hundreds of metres on mountain stages.
  // Reserve centimetre accuracy for the drivable corridor, not distant slopes.
  const tolerance=p=>p.distanceToRoad<=12?.05:p.distanceToRoad<=40?.15:p.distanceToRoad<=100?.5:2;
  const errorFor=(triangle,safety=1)=>{
    let error=0,failed=false,failedFull=false,worstPoint=null,worstViolation=null,violationErrorM=0,worstRatio=0;
    const probes=[[.5,.5,0],[0,.5,.5],[.5,0,.5],[1/3,1/3,1/3]];
    for(const weights of probes){
      const p=query(triangle.reduce((s,p,i)=>s+p.x*weights[i],0),triangle.reduce((s,p,i)=>s+p.z*weights[i],0));
      const expected=triangle.reduce((s,p,i)=>s+p.elevation*weights[i],0);
      const delta=Math.abs(expected-p.elevation)*elevationScaleM;
      if(delta>tolerance(p))failedFull=true;
      if(delta>error){error=delta;worstPoint={x:p.x,z:p.z,distanceToRoad:p.distanceToRoad,toleranceM:tolerance(p)};}if(delta>tolerance(p)*safety){
        failed=true;
        const ratio=delta/(tolerance(p)*safety);
        if(ratio>worstRatio){worstRatio=ratio;violationErrorM=delta;worstViolation={x:p.x,z:p.z,distanceToRoad:p.distanceToRoad,toleranceM:tolerance(p)};}
      }
    }
    return {error,failed,failedFull,worstPoint:worstViolation||worstPoint,violationErrorM};
  };
  const clip=c=>{
    // Preserve painted tile/material boundaries independently of mesh spacing.
    const cuts=(start)=>[start,...Array.from({length:Math.max(0,Math.ceil((start+c.size)/sourceCellSize)-Math.floor(start/sourceCellSize)-1)},(_,i)=>(Math.floor(start/sourceCellSize)+i+1)*sourceCellSize),start+c.size];
    const xs=cuts(c.x),zs=cuts(c.z);
    let pieces=[];
    for(let iz=1;iz<zs.length;iz++)for(let ix=1;ix<xs.length;ix++)pieces.push([sample(xs[ix-1],zs[iz-1]),sample(xs[ix],zs[iz-1]),sample(xs[ix],zs[iz]),sample(xs[ix-1],zs[iz])]);
    for(const f of footprints.within(c.x,c.x+c.size,c.z,c.z+c.size)){
      if(f.maxX<c.x||f.minX>c.x+c.size||f.maxZ<c.z||f.minZ>c.z+c.size)continue;
      pieces=pieces.flatMap(p=>subtractRaceTerrainPolygonByConvexPolygon(p,f.points,{markSeam:false}));
    }
    return pieces.map(poly=>poly.map(p=>sample(p.x,p.z)));
  };
  const split=c=>{
    const h=c.size/2;c.children=[{x:c.x,z:c.z,size:h},{x:c.x+h,z:c.z,size:h},{x:c.x+h,z:c.z+h,size:h},{x:c.x,z:c.z+h,size:h}];
    delete c.pieces;return c.children;
  };
  const refine=c=>{
    const center=query(c.x+c.size/2,c.z+c.size/2),distance=Math.max(0,center.distanceToRoad-c.size*Math.SQRT2/2);
    const target=distance<=12?2.5:distance<=40?5:center.terrainRegion==='transition'?10:sourceCellSize;
    if(c.size>target&&c.size>minCellSize){split(c).forEach(refine);return;}
    c.pieces=clip(c);
    for(const poly of c.pieces){
      const triangles=triangulateTerrainBoundary(poly),errors=[];
      let maxError=0;
      for(const triangle of triangles){
        const error=errorFor(triangle,.75);
        if(error.failed&&c.size>minCellSize){split(c).forEach(refine);return;}
        maxError=Math.max(maxError,error.error);
        if(error.failedFull)errors.push(error);
      }
      // Most final boundaries are unchanged. Retain these already-checked
      // triangles rather than sampling the expensive road field twice.
      // Cache the expensive road-edge cuts, not every simple distant quad.
      // Keeping two triangulations and a boundary copy for the entire mountain
      // survey can exhaust the worker heap before the conformity pass begins.
      if(reuseConformingPolygons&&distance<=40)poly.adaptiveConformance={boundary:[...poly],triangles,maxError,errors};
    }
  };
  // Align roots with source material tiles; only refine where geometry needs it.
  const roots=new Map(),rootSize=sourceCellSize;
  const minX=Math.floor(bounds.minX/rootSize)-1,maxX=Math.ceil(bounds.maxX/rootSize)+1,minZ=Math.floor(bounds.minZ/rootSize)-1,maxZ=Math.ceil(bounds.maxZ/rootSize)+1;
  for(let z=minZ;z<maxZ;z++)for(let x=minX;x<maxX;x++){
    const root={x:x*rootSize,z:z*rootSize,size:rootSize};roots.set(`${x},${z}`,root);refine(root);
  }
  stats.refineMs=Date.now()-started;
  onProgress({phase:'refine',elapsedMs:Date.now()-started});
  const leaves=()=>{const result=[];const visit=c=>c.children?c.children.forEach(visit):result.push(c);for(const root of roots.values())visit(root);return result;};
  const find=(x,z)=>{
    let c=roots.get(`${Math.floor(x/rootSize)},${Math.floor(z/rootSize)}`);
    while(c?.children)c=c.children.find(q=>x>=q.x&&x<q.x+q.size&&z>=q.z&&z<q.z+q.size);
    return c;
  };
  stats.balanceMs=0;stats.connectMs=0;
  let passes=0,nextCellId=0;
  stats.reusedPolygons=0;
  while(true){
    const balanceStarted=Date.now();
    const neighbors = c => [[c.x-1e-6,c.z+c.size/2],[c.x+c.size+1e-6,c.z+c.size/2],[c.x+c.size/2,c.z-1e-6],[c.x+c.size/2,c.z+c.size+1e-6]];
    if (useBalanceQueue) {
      // Only newly split leaves can introduce another size mismatch. Rechecking
      // every distant cell on every balancing pass made long stages expensive.
      const queue = leaves();
      const enqueueLeaves = c => c.children ? c.children.forEach(enqueueLeaves) : queue.push(c);
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const c = queue[cursor];
        if (c.children) continue;
        for (const [x,z] of neighbors(c)) {
          const neighbor = find(x,z);
          if (neighbor && neighbor.size > c.size*2+1e-6) {
            split(neighbor).forEach(refine);
            enqueueLeaves(neighbor);
            // Its replacement beside c may still be more than twice c's size.
            queue.push(c);
          }
        }
      }
    } else {
      let changed=true;
      while(changed){changed=false;for(const c of leaves())for(const [x,z] of neighbors(c)){
        const neighbor=find(x,z);if(neighbor&&neighbor.size>c.size*2+1e-6){split(neighbor).forEach(refine);changed=true;}
      }}
    }
    stats.balanceMs+=Date.now()-balanceStarted;
    const connectStarted=Date.now();
    const finalLeaves=leaves();
    onProgress({phase:'connect',pass:passes+1,leafCells:finalLeaves.length,elapsedMs:Date.now()-started});
    const vertices=spatialIndex(5),registered=new Map();
    const register=p=>{const key=pointKey(p),existing=registered.get(key);if(existing)return existing;registered.set(key,p);vertices.add(p,p.x,p.x,p.z,p.z);return p;};
    for(const c of finalLeaves)for(const poly of c.pieces)for(let i=0;i<poly.length;i++)poly[i]=register(poly[i]);
    for(const p of field.boundaryVertices)register(sample(p.x,p.z));
    const boundaryCandidates = useBoundaryIndex
      ? boundaryVertexIndex(registered.values(), vertices)
      : (a,b) => vertices.within(Math.min(a.x,b.x)-1e-6,Math.max(a.x,b.x)+1e-6,Math.min(a.z,b.z)-1e-6,Math.max(a.z,b.z)+1e-6);
    const needsRefinement=new Set();
    stats.unresolvedHeightErrors=0;stats.unresolvedAtMinimumCellSize=0;stats.maxHeightErrorM=0;delete stats.heightErrorExamples;
    for(const c of finalLeaves){
      stats.minimumCellSizeM=Math.min(stats.minimumCellSizeM,c.size);
      for(const poly of c.pieces){
        const boundary=[];
        poly.forEach((a,i)=>{
          const b=poly[(i+1)%poly.length],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);boundary.push(a);if(length<1e-8)return;
          const splits=[];
          for(const p of boundaryCandidates(a,b)){
            if(p===a||p===b)continue;
            const t=((p.x-a.x)*dx+(p.z-a.z)*dz)/(length*length);
            if(t<=1e-9||t>=1-1e-9||Math.abs(cross(a,b,p))/length>1e-7)continue;
            splits.push({p,t});
          }
          splits.sort((a,b)=>a.t-b.t);for(const {p} of splits)if(pointKey(boundary.at(-1))!==pointKey(p))boundary.push(p);
        });
        // Only re-triangulate/re-sample polygons whose shared boundary changed.
        // A correction to one roadside cell must not re-evaluate the whole map.
        let cached=poly.adaptiveConformance;
        if(reuseConformingPolygons && cached && cached.boundary.length===boundary.length && boundary.every((p,i)=>p===cached.boundary[i])){
          stats.reusedPolygons++;
        }else{
          cached={boundary,triangles:[],maxError:0,errors:[]};
          for(const points of triangulateTerrainBoundary(boundary)){
            const error=errorFor(points);
            cached.maxError=Math.max(cached.maxError,error.error);
            if(error.failed)cached.errors.push(error);
            cached.triangles.push(points);
          }
          poly.adaptiveConformance=cached;
        }
        stats.maxHeightErrorM=Math.max(stats.maxHeightErrorM,cached.maxError);
        for(const error of cached.errors){
          if(c.size>minCellSize)needsRefinement.add(c);
          stats.unresolvedHeightErrors++;
          if(c.size<=minCellSize)stats.unresolvedAtMinimumCellSize++;
          stats.heightErrorExamples||=[];
          if(stats.heightErrorExamples.length<5)stats.heightErrorExamples.push({...error.worstPoint,errorM:error.violationErrorM,cellSizeM:c.size});
        }
      }
    }
    stats.connectMs+=Date.now()-connectStarted;
    // One correction pass catches changed diagonals after edge conformity.
    // Bound bake cost; residual errors are explicit in the returned diagnostics.
    if(needsRefinement.size && passes<1){
      const refineStarted=Date.now();
      for(const cell of needsRefinement)split(cell).forEach(refine);
      stats.refineMs+=Date.now()-refineStarted;
      passes++;continue;
    }
    const vertexCount=registered.size;
    field.release();vertices.clear();registered.clear();roots.clear();
    // Allocate final material/cell records only after topology has settled.
    // Release intermediate polygon records as each leaf is emitted.
    const cells=[];
    for(const c of finalLeaves){
      for(const poly of c.pieces){
        for(const points of poly.adaptiveConformance.triangles){
          const center={x:points.reduce((sum,p)=>sum+p.x,0)/3,z:points.reduce((sum,p)=>sum+p.z,0)/3};
          cells.push({key:`adaptive:${nextCellId++}`,points,tileCell:materialAt(center),terrainRegion:points.some(p=>p.terrainRegion==='transition')?'transition':'terrain',terrainTopology:'adaptive-road-first',adaptiveTerrainCellSizeM:c.size});
        }
        delete poly.adaptiveConformance;
      }
      delete c.pieces;
    }
    stats.conformancePasses=passes+1;
    stats.leafCells=finalLeaves.length;stats.vertices=vertexCount;stats.triangles=cells.length;
    return {terrainCells:cells,stats};
  }
}
