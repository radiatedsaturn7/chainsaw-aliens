const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
const natural=/grass|fern|bush|scrub|tree|pine|spruce|oak|birch|rock|boulder|vegetation/i;
const forbidden=/fence|sign|warning|marker|tower|station|building|landmark|rail/i;
export function layerRoadside(race,{length,pose,project,ground,hasGround,definition}){
 const base=(race.scenery||[]).filter(p=>!p.id?.startsWith('ecology-v2-'));
 const baseline=base.length,target=baseline*4;
 let seed=2166136261;for(const c of race.id||race.name)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const width=p=>Number(p.segment?.roadWidthM||race.road.width)||7;
 let props=base.filter(p=>p.doodadRef&&natural.test(p.doodadRef)&&!forbidden.test(p.doodadRef));
 if(!props.length&&/^Old Staples Road/.test(race.name))props=['mostly-bare-pine-01','expanded-bush-blueberry-01'].filter(ref=>definition(ref)).map(doodadRef=>({doodadRef,trackDistance:length/2}));
 const city=/Landmark Run|Data Center City/.test(race.name);
 if(!props.length||length<100)return {baseline,target,after:baseline,added:0,status:'no-regional-palette',hazards:[]};
 const refs=[...new Set(props.map(p=>p.doodadRef))];
 const arid=refs.some(r=>/desert|sandstone|cactus|red-rock/.test(r));
 const snowy=refs.filter(r=>/snow|frozen|alpine/.test(r)).length>refs.length*.35;
 const low=(snowy?['expanded-grass-clump','frozen-bush-01']:arid?['expanded-grass-little-bluestem-01','dry-scrub-bush-01']:['expanded-grass-roadside-weeds-01','expanded-grass-woodoats-01','expanded-fern-bracken-dry-01']).filter(r=>definition(r));
 const shrub=(snowy?['frozen-bush-01','frozen-bush-02']:arid?['dry-scrub-bush-01','dry-scrub-bush-02','moki-dugway-desert-scrub']:['expanded-bush-blueberry-01','expanded-bush-mountain-laurel-01','expanded-bush-blackberry-bramble-01']).filter(r=>definition(r));
 const trees=refs.filter(r=>/tree|pine|spruce|oak|birch/.test(r)),rocks=refs.filter(r=>/rock|boulder/.test(r));
 const buckets=new Map(),size=12;
 const insert=(p,r)=>{const key=`${Math.floor(p.x/size)},${Math.floor(p.z/size)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({x:p.x,z:p.z,r});};
 base.forEach(p=>insert(p,Math.min(25,Number(p.widthM||3)*.35)));
 const clear=(x,z,r)=>{
  const ix=Math.floor(x/size),iz=Math.floor(z/size),reach=Math.ceil((r+25)/size);
  for(let dx=-reach;dx<=reach;dx++)for(let dz=-reach;dz<=reach;dz++)for(const p of buckets.get(`${ix+dx},${iz+dz}`)||[])
   if(Math.hypot(p.x-x,p.z-z)<r+p.r)return false;
  return true;
 };
 const added=[],hazards=[];let rejected=0;
 // Hazards first: rare inside-apex obstacles, never an obstruction across a lane.
 const detour=race.road.segments.some(s=>['dirt','gravel','mud','sand'].includes(s.surface));
 const eligible=!city&&race.type!=='circuit'&&(detour||random()<.22);
 if(eligible){
  const candidates=[];
  for(let d=250;d<length-250;d+=12){
   const p=pose(d),turn=angle(pose(d+18).yaw-pose(d-18).yaw);
   if(Math.abs(turn)>.35&&Math.abs(turn)<2.3&&!p.segment?.bridge&&!p.segment?.isBridge)candidates.push({d,turn,rank:random()});
  }
  const limit=detour?Math.min(3,Math.max(1,Math.floor(length/3500))):1;
  for(const c of candidates.sort((a,b)=>a.rank-b.rank)){
   if(hazards.length>=limit)break;
   if(hazards.some(h=>Math.abs(h.distance-c.d)<2000))continue;
   const tree=trees.length&&random()<.45,list=tree?trees:rocks;if(!list.length)continue;
   const ref=list[Math.floor(random()*list.length)],def=definition(ref);if(!def)continue;
   const w=Math.min(tree?4:2.6,Number(def.widthM)||2),h=Number(def.heightM||w)*w/(Number(def.widthM)||w);
   const p=pose(c.d),offset=Math.sign(c.turn)*(width(p)/2+w/2+.55),x=p.x+Math.cos(p.yaw)*offset,z=p.z-Math.sin(p.yaw)*offset,q=project({x,z});
   if(!q||Math.abs(q.distance-c.d)>12||Math.abs(q.lateral)<width(pose(q.distance))/2+w/2+.4||!hasGround(x,z)||!clear(x,z,w/2+2))continue;
   const marker={id:`ecology-v2-hazard-${hazards.length}`,presetId:'doodad',doodadRef:ref,x,z,widthM:w,heightM:h,trackDistance:q.distance,trackLateral:q.lateral,previewDoodad:{...def,widthM:w,heightM:h,hitboxWidthM:w,hitboxHeightM:h},ecologyLayer:'apex-hazard'};
   added.push(marker);insert(marker,w/2+4);hazards.push({id:marker.id,distance:q.distance,kind:tree?'tree in':'rock in',ref});
  }
 }
 // Deterministic patches with shared species and an irregular forest edge.
 // Low plants fill the cleared verge; shrubs occupy its transition to woods.
 const bins=Math.ceil(length/180),wanted=Math.max(0,target-baseline-added.length);
 for(let bin=0;bin<bins;bin++){
  const lo=bin*180,span=Math.min(180,length-lo),quota=Math.floor(wanted/bins)+(bin<wanted%bins?1:0);
  const local=props.filter(p=>Math.abs(Number(p.trackDistance||0)-(lo+span/2))<500);
  const localTall=[...new Set(local.map(p=>p.doodadRef).filter(r=>/tree|pine|spruce|oak|birch|rock|boulder/.test(r)))];
  const tall=localTall.length?localTall:(arid?rocks:trees.length?trees:rocks);
  for(let attempt=0,placed=0;attempt<quota*35&&placed<quota;attempt++){
   const patch=Math.floor(random()*6),side=patch%2?1:-1,center=lo+span*(.15+Math.floor(patch/2)*.32);
   const d=Math.max(lo,Math.min(lo+span,center+(random()+random()-1)*span*.35)),p=pose(d);
   // Escalating attempts preferentially fill small gaps with low plants.
   const choice=attempt>quota*12?random()*.6:random(),layer=choice<.56?'verge':choice<.86?'shrub':'canopy';
   const list=layer==='verge'?low:layer==='shrub'?shrub:tall;if(!list.length)continue;
   const ref=list[(bin+patch+(layer==='canopy'?Math.floor(random()*list.length):0))%list.length],def=definition(ref);if(!def)continue;
   const maxHeight=layer==='verge'?(snowy?.4:.65):layer==='shrub'?1.8:Infinity;
   const scale=(.75+random()*.5)*Math.min(1,maxHeight/Math.max(.1,Number(def.heightM)||1));
   const w=(Number(def.widthM)||2)*scale,h=(Number(def.heightM)||2)*scale;
   const edge=layer==='verge'?1.6+random()*9:layer==='shrub'?10+random()*24:32+random()*180;
   const offset=side*(width(p)/2+w/2+edge),x=p.x+Math.cos(p.yaw)*offset,z=p.z-Math.sin(p.yaw)*offset;
   if(!hasGround(x,z)||!clear(x,z,Math.max(.15,w*(layer==='canopy'?.32:.2)))){rejected++;continue;}
   const q=project({x,z});if(!q||Math.abs(q.lateral)<width(pose(q.distance))/2+w/2+1.2){rejected++;continue;}
   const e=ground({x,z},p.elevation),slope=Math.abs(ground({x:x+w/2,z},e)-ground({x:x-w/2,z},e))*12/Math.max(.1,w);
   if(slope>(layer==='canopy'?.8:1.2)){rejected++;continue;}
   const entry={id:`ecology-v2-${bin}-${placed}`,doodadRef:ref,x:Math.round(x*100)/100,z:Math.round(z*100)/100,widthM:w,heightM:h,trackDistance:q.distance,trackLateral:q.lateral,ecologyLayer:layer};
   added.push(entry);insert(entry,Math.max(.15,w*(layer==='canopy'?.32:.2)));placed++;
  }
 }
 race.scenery=[...base,...added];
 return {baseline,target,after:race.scenery.length,added:added.length,multiplier:race.scenery.length/Math.max(1,baseline),status:race.scenery.length>=target?'target-met':'space-limited',layers:Object.fromEntries(['verge','shrub','canopy','apex-hazard'].map(l=>[l,added.filter(p=>p.ecologyLayer===l).length])),hazards,rejected};
}
