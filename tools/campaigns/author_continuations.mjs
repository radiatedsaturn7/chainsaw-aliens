import RaceEditor from '../../src/ui/RaceEditor.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function fixProvidenceStart(race) {
  if(race.id!=='america-north-01' && race.campaign?.id!=='america-north-01' && !race.name?.startsWith('North 01 - Providence'))return false;
  const nodes=race.road.nodes, [a,b,c]=nodes;
  if(!c || Math.hypot(b.x-a.x,b.y-a.y)>15)return false;
  if((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)>=0)return false;
  nodes.splice(1,1);race.road.segments.splice(1,1);
  race.road.segments[0].length=Math.hypot(c.x-a.x,c.y-a.y);
  race.road.segments[0].curve=0;race.road.segments[0].elevation=c.elevation;
  race.source.startCorrection='Removed a 9.37 m reverse spur before Blackstone Boulevard; original GPS reference retained.';
  return true;
}

// Offline authoring only: write explicit finite control points, not a runtime
// extrapolator. These service roads/aprons are fictional, not additional GPS.
export function authorRaceContinuations(race) {
  if(race.road.continuations?.version===1){race.road.autoExtend=false;completeTerrainRectangle(race.road.tileMap);return race;}
  fixProvidenceStart(race);
  const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
  editor.applyLoadedRaceDocument(race);
  return editor.withRaceGeometryReadCache(()=>{
  const samples=editor.getRacePathSamplesCached({step:4});
  const routeLength=samples.at(-1).distance;
  const nodes=race.road.nodes;
  const mountain=/Washington|Pikes Peak|Mount|Pass|Crest|Million Dollar|Beartooth|Tioga/i.test(race.name);
  const continuations={version:1,description:'Authored untimed service road and terrain apron; not surveyed GPS road.',start:[],finish:[]};
  for(const side of ['start','finish']) {
    const start=side==='start',sign=start?-1:1,edge=start?samples[0]:samples.at(-1);
    const neighbor=start?samples[1]:samples.at(-2);
    const initialGrade=clamp((edge.elevation-neighbor.elevation)*12/Math.max(1,Math.abs(edge.distance-neighbor.distance)),-.16,.16);
    const outwardYaw=edge.yaw+(start?Math.PI:0);
    const candidates=[];
    for(const turn of [0,Math.PI/2,-Math.PI/2,Math.PI*.85,-Math.PI*.85]) {
      let x=edge.x,z=edge.z,h=edge.elevation,grade=initialGrade,score=0;
      const points=[];
      for(let d=5;d<=400;d+=5){
        // Keep the first 70 m aligned for the grid/runout; ease into a bend.
        const t=clamp((d-70)/330,0,1),angle=turn*(t*t*(3-2*t));
        const yaw=outwardYaw+angle;x+=Math.sin(yaw)*5;z+=Math.cos(yaw)*5;
        const raw=editor.getRaceRawGroundElevationAtWorldPoint({x,z},h);
        let desired=clamp((raw-h)*12/60,-.12,.12);
        if(mountain&&!start&&d>35)desired=Math.min(desired,-.055);
        grade+=clamp(desired-grade,-.015,.015);h+=grade*5/12;
        let clearance=Infinity;
        // Exclude endpoint neighbourhood; penalize crossings with the timed course.
        for(let i=0;i<samples.length;i+=8){const p=samples[i];if(Math.abs(p.distance-edge.distance)<80)continue;clearance=Math.min(clearance,Math.hypot(x-p.x,z-p.z));}
        score+=Math.abs(raw-h)*12 + Math.max(0,45-clearance)*12;
        points.push({offset:sign*d,x,z,elevation:h,yaw:yaw-(start?Math.PI:0)});
      }
      score+=Math.abs(turn)*15;
      candidates.push({points,score,turn});
    }
    const chosen=candidates.sort((a,b)=>a.score-b.score)[0];
    continuations[side]=chosen.points.sort((a,b)=>a.offset-b.offset);
    continuations[side+'TurnDegrees']=Math.round(chosen.turn*180/Math.PI);
  }
  race.road.autoExtend=false;race.road.continuations=continuations;
  // Ensure there is editable ground under and beyond both finite ends. Blend
  // into existing terrain; keep all terrain away from the service roads intact.
  const map=race.road.tileMap,cell=map.cellSizeM,original={...map.cells};
  const authored=new Map();
  for(const side of ['start','finish'])for(const p of continuations[side]){
    const end=Math.abs(p.offset)===400,reach=end?240:110;
    for(let iz=Math.floor((p.z-reach)/cell);iz<=Math.ceil((p.z+reach)/cell);iz++)for(let ix=Math.floor((p.x-reach)/cell);ix<=Math.ceil((p.x+reach)/cell);ix++){
      const key=`${ix},${iz}`,x=(ix+.5)*cell,z=(iz+.5)*cell,d=Math.hypot(x-p.x,z-p.z);
      if(d>reach)continue;
      const previous=authored.get(key);if(previous && previous.d<=d)continue;
      authored.set(key,{d,p,x,z,reach});
    }
  }
  for(const [key,{d,p,x,z,reach}] of authored){
    const old=original[key];
    const raw=old?.elevation??editor.getRaceRawGroundElevationAtWorldPoint({x,z},p.elevation);
    const t=clamp((d-16)/(reach-16),0,1),blend=t*t*(3-2*t);
    // Do not reshape the timing line's terrain: taper the apron in over 60 m.
    const strength=clamp(Math.abs(p.offset)/60,0,1)*(1-blend);
    map.cells[key]={...(old||{tileId:map.defaultTileId||'grass'}),elevation:raw+(p.elevation-raw)*strength};
  }
  completeTerrainRectangle(map);
  race.source ||= {};
  race.source.continuationDescription=continuations.description;
  return race;
  });
}

// Keep imported maps rectangular so the runtime can extend boundary heights
// beyond the survey instead of falling back to elevation zero at a mountain.
function completeTerrainRectangle(map) {
  const rows=new Map();
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const key of Object.keys(map.cells)){
    const [x,z]=key.split(',').map(Number);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
    if(!rows.has(z))rows.set(z,[]);rows.get(z).push(x);
  }
  for(const xs of rows.values())xs.sort((a,b)=>a-b);
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
    const key=`${x},${z}`;if(map.cells[key])continue;
    const sourceZ=rows.has(z)?z:[...rows.keys()].reduce((a,b)=>Math.abs(b-z)<Math.abs(a-z)?b:a);
    const xs=rows.get(sourceZ),sourceX=xs.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a);
    const source=map.cells[`${sourceX},${sourceZ}`];map.cells[key]={tileId:source.tileId||map.defaultTileId||'grass',elevation:source.elevation};
  }
}
