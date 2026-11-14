import {buildRaceFencePlacements} from '../../src/racing/RaceFences.js';
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
const natural=/tree|pine|bush|scrub|grass|fern|rock|boulder|vegetation|stump/i;
const excluded=/streetlight|utility|pylon|power|sign|warning|marker|pole|fence|guardrail|barrier|mailbox|landmark|tower|church|station|school|summit/i;
export function enrichRaceScenery(race,{length,pose,project,ground,definition,hasGround}){
 const original=(race.scenery||[]).filter(p=>!p.id?.startsWith('coverage-v1-'));
 let seed=2166136261;for(const ch of race.id||race.name)seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const width=p=>Number(p.segment?.roadWidthM||race.road.width)||7;
 const city=/Landmark Run|Data Center City/.test(race.name);
 const usable=p=>p.doodadRef&&!excluded.test(p.doodadRef)&&(natural.test(p.doodadRef)||(city&&/building/i.test(p.doodadRef)));
 let pool=original.filter(usable);
 if(!pool.length&&race.name==='Old Staples Road')pool=['mostly-bare-pine-01','expanded-bush-blueberry-01'].map(doodadRef=>({doodadRef,trackDistance:0}));
 // Never invent an unrelated biome for an empty test track.
 const spatial=new Map(),cell=32;
 const insert=p=>{const k=`${Math.floor(p.x/cell)},${Math.floor(p.z/cell)}`;if(!spatial.has(k))spatial.set(k,[]);spatial.get(k).push(p);};
 original.forEach(insert);
 const occupied=(x,z,radius)=>{
  const reach=Math.ceil((radius+45)/cell),ix=Math.floor(x/cell),iz=Math.floor(z/cell);
  for(let dx=-reach;dx<=reach;dx++)for(let dz=-reach;dz<=reach;dz++)for(const p of spatial.get(`${ix+dx},${iz+dz}`)||[]){
   if(Math.hypot(x-p.x,z-p.z)<radius+Math.min(40,Number(p.widthM||4)/2)+2)return true;
  }return false;
 };
 const props=[],rails=[];let rejected=0;
 const bins=Math.ceil(length/250);
 for(let bin=0;bin<bins&&pool.length;bin++){
  const lo=bin*250,hi=Math.min(length,lo+250),mid=(lo+hi)/2;
  const local=pool.filter(p=>Math.abs((Number(p.trackDistance)||0)-mid)<800);
  const choices=local.length?local:pool;
  const arid=choices.filter(p=>/scrub|sandstone|red-rock|desert|dry-|cactus/.test(p.doodadRef)).length>choices.length*.35;
  const target=Math.ceil((hi-lo)*(city?.12:arid?.085:.15));
  const existing=original.filter(p=>usable(p)&&Number(p.trackDistance)>=lo&&Number(p.trackDistance)<hi&&Math.abs(Number(p.trackLateral)||0)<240).length;
  const wanted=Math.max(0,target-existing);
  for(let tries=0,added=0;tries<wanted*10&&added<wanted;tries++){
   const distance=lo+random()*(hi-lo),p=pose(distance),source=choices[Math.floor(random()*choices.length)],ref=source.doodadRef;
   const def=definition(ref);if(!def)continue;
   const scale=.85+random()*.3,w=(Number(source.widthM)||def.widthM||6)*scale,h=(Number(source.heightM)||def.heightM||6)*scale;
   const side=random()<.5?-1:1,band=random(),offset=side*(width(p)/2+w/2+10+(band<.5?random()*35:45+random()*150));
   const x=p.x+Math.cos(p.yaw)*offset,z=p.z-Math.sin(p.yaw)*offset;
   const q=project({x,z});
   if(!q||Math.abs(q.lateral)<width(pose(q.distance))/2+w/2+7||!hasGround(x,z)||occupied(x,z,w*.4)){rejected++;continue;}
   const elevation=ground({x,z},p.elevation),slope=Math.max(...[[w/2,0],[-w/2,0],[0,w/2],[0,-w/2]].map(([dx,dz])=>Math.abs(ground({x:x+dx,z:z+dz},elevation)-elevation)*12/Math.max(1,w/2)));
   if(slope>(/building/.test(ref)?.15:.7)){rejected++;continue;}
   const entry={id:`coverage-v1-prop-${bin}-${added}`,presetId:'doodad',doodadRef:ref,x,z,yaw:p.yaw+(random()-.5)*.5,widthM:w,heightM:h,groundOffsetM:Number(source.groundOffsetM||def.groundOffsetM)||0,trackDistance:q.distance,trackLateral:q.lateral,state:'standing'};
   props.push(entry);insert(entry);added++;
  }
 }
 const railDef=definition('fenceguardrail'),candidates=[];
 // No highway rails across ordinary square city junctions. In cities only an
 // exposed drop qualifies; elsewhere use the outside of a substantial bend.
 for(let d=80;d<length-80;d+=20){
  const p=pose(d),turn=angle(pose(d+25).yaw-pose(d-25).yaw);
  for(const side of [-1,1]){
   const offset=side*(width(p)/2+12),x=p.x+Math.cos(p.yaw)*offset,z=p.z-Math.sin(p.yaw)*offset;
   const drop=(p.elevation-ground({x,z},p.elevation))*12;
   const outside=side===-Math.sign(turn),bend=!city&&outside&&Math.abs(turn)>.48;
   if((drop>3.5||bend)&&!p.segment?.bridge&&!p.segment?.isBridge)candidates.push({distance:d,side,turn,drop,score:Math.max(0,drop)+Math.abs(turn)*8});
  }
 }
 const selected=[];
 for(const c of candidates.sort((a,b)=>b.score-a.score)){
  if(selected.some(p=>Math.abs(p.distance-c.distance)<220))continue;
  if(selected.length>=Math.min(24,Math.ceil(length/700)))break;
  const points=[];let valid=true;
  for(let d=c.distance-45;d<=c.distance+45;d+=5){
   const p=pose(d),offset=c.side*(width(p)/2+3),x=p.x+Math.cos(p.yaw)*offset,z=p.z-Math.sin(p.yaw)*offset;
   const q=project({x,z});
   if(!q||Math.abs(q.distance-d)>18||Math.abs(q.lateral)<width(pose(q.distance))/2+1.5||!hasGround(x,z)||occupied(x,z,1)){valid=false;break;}
   points.push({x,z});
  }
  if(!valid||!railDef)continue;
  const panels=buildRaceFencePlacements(points,railDef,{id:`coverage-v1-rail-${selected.length}`,ref:'fenceguardrail'});
  for(const panel of panels){const q=project(panel);panel.trackDistance=q.distance;panel.trackLateral=q.lateral;insert(panel);}
  rails.push(...panels);selected.push(c);
 }
 race.scenery=[...original,...props,...rails];
 return {before:original.length,addedProps:props.length,railSections:selected.length,railPanels:rails.length,after:race.scenery.length,rejected,railLocations:selected};
}
