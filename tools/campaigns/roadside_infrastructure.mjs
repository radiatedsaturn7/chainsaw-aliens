import {buildRaceFencePlacements} from '../../src/racing/RaceFences.js';
export const infrastructureKind=ref=>/streetlight/.test(ref)?'light':/utility-pole/.test(ref)?'pole':/pylon/.test(ref)?'pylon':/snow-depth-marker/.test(ref)?'marker':null;
const generated=p=>/^(ecology-v2-|coverage-v1-prop-)/.test(p.id||'');
const fenceRef=ref=>/fence|guardrail/.test(ref||'');
// Authored landmarks and existing connected fences are retained. Infrastructure
// is laid out in short coherent runs, never sampled from the vegetation palette.
export function repairRoadsideInfrastructure(race,h){
 const {length,pose,project,ground,hasGround,definition}=h;
 const report={replacedVegetation:0,removedInfrastructure:0,placedInfrastructure:0,relocatedSmallProps:0,fenceSections:0,railPanels:0,rejected:0,refs:{}};
 const original=race.scenery||[],kept=[],seeds=new Map(),fences=[];
 const refs=[...new Set(original.filter(p=>!generated(p)).map(p=>p.doodadRef))];
 const trees=refs.filter(r=>r&&/(^|-)tree|pine|birch|oak/.test(r)&&!/fence|stump|streetlight|cabin|wall|rock/.test(r));
 const latitude=Number(race.source?.origin?.lat)||0;
 const replacement=trees.find(r=>definition(r))||(latitude>55?'mostly-bare-pine-01':'expanded-tree-white-oak-young-01');
 for(const p of original){
  const kind=infrastructureKind(p.doodadRef||'');
  if(kind&&generated(p)){
   // Keep the canopy locations, but remove inherited pole artwork/hitboxes.
   const d=definition(replacement);
   if(d){kept.push({id:p.id,presetId:'doodad',doodadRef:replacement,x:p.x,z:p.z,yaw:p.yaw,widthM:d.widthM,heightM:d.heightM,groundOffsetM:d.groundOffsetM||0,trackDistance:p.trackDistance,trackLateral:p.trackLateral,ecologyLayer:p.ecologyLayer||'canopy'});report.replacedVegetation++;}
   continue;
  }
  if(kind){if(!seeds.has(kind))seeds.set(kind,[]);seeds.get(kind).push(p);report.removedInfrastructure++;continue;}
  if(fenceRef(p.doodadRef)&&!p.fenceId){fences.push(p);continue;}
  // Copied fence panels carry the parent stroke ID and UVs to random locations.
  if(p.fenceId&&/-prop-/.test(p.id||'')){fences.push(p);continue;}
  kept.push(p);
 }
 const half=p=>(Number(p.segment?.roadWidthM)||Number(race.road.width)||7)/2;
 const at=(d,offset)=>{const p=pose(d);return {x:p.x+Math.cos(p.yaw)*offset,z:p.z-Math.sin(p.yaw)*offset,yaw:p.yaw};};
 const occupied=new Map(),cell=20;
 const insert=p=>{const key=`${Math.floor(p.x/cell)},${Math.floor(p.z/cell)}`;if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push(p);};
 // Low vegetation can coexist with a pole base, solid trees/buildings cannot.
 for(const p of kept)if((p.heightM||0)>2||p.fenceId)insert(p);
 const clear=(p,r)=>{const ix=Math.floor(p.x/cell),iz=Math.floor(p.z/cell);for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++)for(const q of occupied.get(`${ix+x},${iz+z}`)||[])if(Math.hypot(q.x-p.x,q.z-p.z)<r+Math.min(30,(q.widthM||2)/2)+1)return false;return true;};
 const valid=(p,d,w,margin=1)=>{
  const q=project(p);if(!q||Math.abs(q.distance-d)>20||Math.abs(q.lateral)<half(pose(q.distance))+w/2+margin||!hasGround(p.x,p.z))return null;
  const y=ground(p,pose(d).elevation),r=Math.max(1,w/2);
  for(const [dx,dz] of [[r,0],[-r,0],[0,r],[0,-r]])if(!hasGround(p.x+dx,p.z+dz)||Math.abs(ground({x:p.x+dx,z:p.z+dz},y)-y)*12/r>.45)return null;
  return q;
 };
 for(const [kind,items] of seeds){
  const ref=items[0].doodadRef,def=definition(ref);if(!def)continue;
  const spacing={light:45,pole:65,pylon:260,marker:55}[kind];
  // Only populated districts get lights; mountains don't acquire a city grid.
  const bins=new Set(items.map(p=>Math.floor(Math.max(0,Math.min(length,Number(p.trackDistance)||project(p)?.distance||0))/300)));
  for(const bin of [...bins].sort((a,b)=>a-b)){
   for(let d=Math.ceil(Math.max(40,bin*300)/spacing)*spacing;d<Math.min(length-40,(bin+1)*300);d+=spacing){
    const side=kind==='light'?(Math.round(d/spacing)%2?1:-1):1;
    const width=Number(def.widthM)||2,height=Number(def.heightM)||8;
    const gap={light:2,pole:4,pylon:22,marker:1}[kind];
    let placed=false;
    for(const extra of [0,2,4]){
     const p=at(d,side*(half(pose(d))+width/2+gap+extra));
     const q=valid(p,d,width);if(!q||!clear(p,kind==='pylon'?width/2:1))continue;
     const hitbox=kind==='pylon'?width*.65:kind==='marker'?.2:.4;
     const entry={id:`infrastructure-v1-${kind}-${d}`,presetId:'doodad',doodadRef:ref,...p,widthM:width,heightM:height,trackDistance:q.distance,trackLateral:q.lateral,groundOffsetM:0,previewDoodad:{...def,hitboxWidthM:hitbox,hitboxHeightM:height},state:'standing'};
     if(kind==='light')entry.flipX=q.lateral<0;
     kept.push(entry);insert(entry);report.placedInfrastructure++;report.refs[ref]=(report.refs[ref]||0)+1;placed=true;break;
    }
    if(!placed)report.rejected++;
   }
  }
 }
 // Preserve safety barriers, using actual low guardrail artwork instead of a
 // tall generic fence. Do not change authored Tower Hill rail dimensions.
 report.railPanels=rebuildSafetyRails({scenery:kept},h);
 // Regional boundary fences are short features near settlements/fields, not
 // substitutes for crash barriers. Never wrap the entire mountain in fencing.
 const city=/Landmark Run|Data Center City/.test(race.name);
 const snow=/Mount Washington|Pikes Peak Highway|Thompson Pass|Maunakea/.test(race.name);
 const farm=/Bayard|Ozark|Sandhills|Iowa|Nebraska|Kansas|Missouri/.test(race.name);
 const woodland=/Tower Hill|Laurel|Forest|Woodland/.test(race.name);
 const regional=snow?['pikes-peak-snow-fence']:farm?['expanded-farm-fence-loop','roadside-wooden-fence-intact','roadside-wooden-fence-broken']:woodland?['roadside-wooden-fence-intact']:city?['fencebushes']:[];
 for(const [i,ref] of regional.entries())if(definition(ref))fences.push({doodadRef:ref,trackDistance:length*(.22+i*.21),trackLateral:i%2?-1:1});
 const used=new Set(kept.filter(p=>p.fenceId?.startsWith('infrastructure-v1-fence-')).map(p=>Number(p.fenceId.split('-').at(-1))));
 for(const source of fences){
  const d=Math.max(50,Math.min(length-80,Number(source.trackDistance)||project(source)?.distance||50));
  const key=Math.floor(d/450);if(used.has(key))continue;
  const ref=source.doodadRef,def=definition(ref);if(!def)continue;
  const side=(source.trackLateral||1)<0?-1:1;
  let points=null;
  search:for(const shift of [0,40,-40,80,-80,120,-120])for(const gap of [5,8,12]){
   const start=d+shift;if(start<40||start+32>length-40)continue;
   const offset=side*(half(pose(start))+(/snow/.test(ref)?gap+5:gap));
   const candidate=[];
   for(let t=start;t<=start+32;t+=2){const p=at(t,offset);if(!valid(p,t,.5,1)||!clear(p,.4))break;candidate.push(p);}
   if(candidate.length===17){points=candidate;break search;}
  }
  if(!points){report.rejected++;continue;}used.add(key);
  const panels=buildRaceFencePlacements(points,{...def,isFence:true,fenceThicknessM:.18},{id:`infrastructure-v1-fence-${key}`,ref,roadside:{project,pose,roadWidthM:race.road.width,validPoint:(p,b)=>Boolean(valid(p,project(b).distance,.5,1))&&clear(p,.4)}});
  for(const p of panels){const q=project(p);p.trackDistance=q.distance;p.trackLateral=q.lateral;kept.push(p);insert(p);}
  report.fenceSections++;report.refs[ref]=(report.refs[ref]||0)+panels.length;
 }
 // Warning signs must be readable from the road, not 100m out in the trees.
 for(const p of kept){
  if(!/^roadside-.*(?:warning-sign|reflector-post|traffic-cone)$/.test(p.doodadRef||''))continue;
  if(Math.abs(p.trackLateral||0)<half(pose(p.trackDistance||0))+8)continue;
  const d=Math.max(20,Math.min(length-20,Number(p.trackDistance)||project(p)?.distance||20)),side=(p.trackLateral||1)<0?-1:1;
  const point=at(d,side*(half(pose(d))+2+(p.widthM||1)/2)),q=valid(point,d,p.widthM||1);
  if(!q||!clear(point,1)){report.rejected++;continue;}
  Object.assign(p,point,{trackDistance:q.distance,trackLateral:q.lateral});delete p.y;delete p.elevation;report.relocatedSmallProps++;
 }
 race.scenery=kept;return report;
}

export function rebuildSafetyRails(race,{definition,project}){
 const kept=race.scenery,report={railPanels:0};
 const railGroups=new Map();
 for(const p of kept)if(p.fenceId?.startsWith('coverage-v1-rail-')){
  if(!railGroups.has(p.fenceId))railGroups.set(p.fenceId,[]);railGroups.get(p.fenceId).push(p);
 }
 const rebuilt=new Map();
 for(const [id,panels] of railGroups){
  const path=panels.find(p=>p.fencePath)?.fencePath,ref='roadside-metal-guardrail-intact',def=definition(ref);
  if(!path||!def)continue;
  const replacements=buildRaceFencePlacements(path.points,{...def,isFence:true},{id,ref,endFlared:path.endFlared});
  for(const p of replacements){const q=project(p);p.trackDistance=q.distance;p.trackLateral=q.lateral;}
  rebuilt.set(id,replacements);report.railPanels+=replacements.length;
 }
 if(rebuilt.size){
  const filtered=kept.filter(p=>!rebuilt.has(p.fenceId));kept.length=0;
  for(const p of filtered)kept.push(p);for(const panels of rebuilt.values())for(const p of panels)kept.push(p);
 }
 return report.railPanels;
}
