import { normalizeRaceDoodadDocument } from './raceDoodads.js';

// Persist ordinary scenery placements so artwork, Undo, save/load, and both
// renderers use the same geometry. A fence ID groups one drawn stroke.
export function buildRaceFencePlacements(points, definition, { id = 'fence', ref = '', roadside = null, endFlared = false } = {}) {
  const doodad = normalizeRaceDoodadDocument(definition);
  if (!doodad.isFence || !Array.isArray(points)) return [];
  if (roadside) { const flared=flareRoadsideFenceEnds(points,roadside); points=flared.points; endFlared=endFlared || flared.changed; }
  const repeat = Math.max(0.1, doodad.widthM);
  const placements = [];
  let traveled = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (![a?.x, a?.z, b?.x, b?.z].every(Number.isFinite)) continue;
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    if (length < 0.001) continue;
    let at = 0;
    while (at < length - 0.00001) {
      const phase = ((traveled % repeat) + repeat) % repeat;
      const u0 = phase < 0.00001 || repeat - phase < 0.00001 ? 0 : phase / repeat;
      const width = Math.min(length - at, repeat * (1 - u0), 2);
      const fraction = (at + width / 2) / length;
      // Opt-in organic strips meet at the same source edge on alternate tiles.
      // Keep the PNG untouched and preserve phase around path corners.
      const mirrored = doodad.fenceMirrorRepeat && Math.floor((traveled + 0.000001) / repeat) % 2 === 1;
      const u1 = u0 + width / repeat;
      placements.push({
        id: `${id}:${placements.length}`, fenceId: id, presetId: 'doodad', doodadRef: ref,
        label: doodad.name, artRef: doodad.artRef, x: a.x + dx * fraction, z: a.z + dz * fraction,
        yaw: Math.atan2(dz, -dx), widthM: width, heightM: doodad.heightM,
        fenceU0: mirrored ? 1 - u0 : u0, fenceU1: mirrored ? 1 - u1 : u1, solid: true, state: 'standing',
        previewDoodad: { ...doodad, itemType: 'scenery', model: null, widthM: width, hitboxWidthM: width, hitboxHeightM: doodad.heightM, rules: [],
          defaultRule: { ...doodad.defaultRule, behavior: 'collide' } }
      });
      at += width; traveled += width;
    }
  }
  if (placements.length) placements[0].fencePath = {
    points: points.filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.z)).map(p => ({ x: p.x, z: p.z })),
    definition: doodad, ref, endFlared
  };
  return placements;
}

// Turn near-road terminals away from traffic. Both rendered panels and collision
// are rebuilt from this path, so the visible end is the actual solid end.
export function flareRoadsideFenceEnds(points,{project,pose,roadWidthM=7,validPoint=()=>true}={}){
 const original=(points||[]).filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.z));
 if(original.length<2||!project||!pose)return {points:original,changed:false};
 const distances=[0];for(let i=1;i<original.length;i++)distances.push(distances.at(-1)+Math.hypot(original[i].x-original[i-1].x,original[i].z-original[i-1].z));
 const length=distances.at(-1);
 if(length<16||Math.hypot(original[0].x-original.at(-1).x,original[0].z-original.at(-1).z)<2)return {points:original,changed:false};
 const span=Math.min(8,length/3),ends=[];
 for(const at of [0,original.length-1]){
  const p=original[at],q=project(p),road=q&&pose(q.distance),neighbor=original[at===0?1:at-1];
  const half=Number(road?.segment?.roadWidthM||road?.roadWidthM||roadWidthM)/2;
  const dx=neighbor.x-p.x,dz=neighbor.z-p.z,n=Math.hypot(dx,dz);
  const aligned=road&&!road.segment?.bridge&&!road.segment?.isBridge&&Math.abs((dx*Math.sin(road.yaw)+dz*Math.cos(road.yaw))/Math.max(.001,n))>.94;
  ends.push(q&&aligned&&Math.abs(q.lateral)>half+.5&&Math.abs(q.lateral)<half+16?{x:Math.cos(road.yaw)*Math.sign(q.lateral),z:-Math.sin(road.yaw)*Math.sign(q.lateral)}:null);
 }
 if(!ends.some(Boolean))return {points:original,changed:false};
 const samples=[...new Set([...distances,...Array.from({length:Math.ceil(span/2)+1},(_,i)=>Math.min(span,i*2)),...Array.from({length:Math.ceil(span/2)+1},(_,i)=>length-Math.min(span,i*2))])].sort((a,b)=>a-b);
 const result=[];let segment=1;
 for(const distance of samples){
  while(segment<distances.length-1&&distances[segment]<distance)segment++;
  const a=original[segment-1],b=original[segment],t=(distance-distances[segment-1])/Math.max(.00001,distances[segment]-distances[segment-1]);
  const base={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},p={...base};
  for(let i=0;i<2;i++)if(ends[i]){const along=i===0?distance:length-distance,amount=4*Math.max(0,1-along/span)**2;p.x+=ends[i].x*amount;p.z+=ends[i].z*amount;}
  if(Math.hypot(p.x-base.x,p.z-base.z)<.00001){result.push(p);continue;}
  if(!validPoint(p,base))return {points:original,changed:false};
  const q=project(p),road=q&&pose(q.distance),half=Number(road?.segment?.roadWidthM||road?.roadWidthM||roadWidthM)/2;
  if(!q||Math.abs(q.lateral)<half+.5)return {points:original,changed:false};
  result.push(p);
 }
 return {points:result,changed:true};
}
