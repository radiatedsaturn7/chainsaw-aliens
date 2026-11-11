// Deterministic, region-specific clusters outside the playable roadside corridor.
// The caller supplies the existing road projection and terrain footprint.
const hash = text => Array.from(text).reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,2166136261);
export function buildDistantScenery({key,length,config,pose,project,definition,bounds}) {
 const result=[],clusters=Math.ceil(config.count/config.clusterSize);
 // Mix the hash once more: nearby string IDs otherwise produce almost identical values.
 const noise=(i,j,salt)=>{let x=hash(`${salt}:${key}:${i}:${j}`);x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967296;};
 for(let i=0;i<clusters;i++){
  const band=i%config.bands.length,[min,max]=config.bands[band];
  const center=(i+.2+.6*noise(i,0,'distance'))/clusters*length;
  const side=i%2?1:-1,reach=min+(max-min)*noise(i,0,'reach');
  const choices=(config.upper && center/length>config.upper.after ? config.upper.refs : null) || config.refs[band] || config.refs[0];
  // One or two art variants per cluster lets the existing material batching work.
  for(let j=0;j<config.clusterSize;j++){
   const distance=Math.max(20,Math.min(length-20,center+(noise(i,j,'along')-.5)*70));
   const offset=side*(reach+(noise(i,j,'across')-.5)*45);
   const p=pose(distance),x=p.x+Math.cos(p.yaw)*offset,z=p.z-Math.sin(p.yaw)*offset;
   const name=choices[Math.floor(noise(i,j%2,'art')*choices.length)],def=structuredClone(definition(name));
   const scale=(config.scale?.[band]||1)*(.85+noise(i,j,'size')*.3);
   const widthM=def.widthM*scale,heightM=def.heightM*scale;
   if(x-widthM/2<bounds.minX||x+widthM/2>bounds.maxX||z-widthM/2<bounds.minZ||z+widthM/2>bounds.maxZ)continue;
   const projection=project({x,z});
   if(!projection||Math.abs(projection.lateral)<Math.max(65,widthM/2+30))continue;
   Object.assign(def,{widthM,heightM,groundOffsetM:(def.groundOffsetM||0)*scale,
    hitboxWidthM:(def.hitboxWidthM||0)*scale,hitboxHeightM:(def.hitboxHeightM||0)*scale});
   result.push({id:`campaign-distant-${key}-${i}-${j}`,presetId:'doodad',doodadRef:name,definitionId:def.id,artRef:def.artRef,label:name,
    x,z,yaw:p.yaw+(noise(i,j,'yaw')-.5)*.8,widthM,heightM,groundOffsetM:def.groundOffsetM,
    weightKg:def.weightKg,behavior:def.defaultRule.behavior,previewDoodad:def,state:'standing',
    trackDistance:projection.distance,trackLateral:projection.lateral,
    campaignDistanceLayer:{version:1,region:key,band,targetDistanceM:reach}});
  }
 }
 return result;
}
