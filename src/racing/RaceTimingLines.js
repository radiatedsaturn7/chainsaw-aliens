export function timingLine(race,side){
 const value=race?.timingLines?.[side]||{};
 return {artRef:String(value.artRef||''),depthM:Math.max(.25,Math.min(30,Number(value.depthM)||2)),widthScale:Math.max(.1,Math.min(2,Number(value.widthScale)||1))};
}
export function timingLineArtRefs(race){return ['start','finish'].map(s=>timingLine(race,s).artRef).filter(r=>r&&r!=='__none');}
export function buildTimingLineDecals(race,length,pose,circuit=false){
 return (circuit?['start']:['start','finish']).flatMap(side=>{
  const line=timingLine(race,side);if(!line.artRef||line.artRef==='__none')return [];
  const p=pose(side==='start'?0:length);
  return [{id:`timing-line-${side}`,kind:'decal',artRef:line.artRef,x:p.x,z:p.z,rotation:p.yaw,
   widthM:(Number(p.segment?.roadWidthM||race.road?.width)||7)*line.widthScale,heightM:line.depthM}];
 });
}
