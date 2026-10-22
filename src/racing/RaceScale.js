import {forEachPackedRaceTileMapCell} from './RacePackedTileMap.js';

// Work on a copy so rejected operations leave the race and its undo history intact.
export function scaleRace(race, factor, {sizes=false, elevations=false}={}) {
  if (!Number.isFinite(factor) || factor < .1 || factor > 10) throw new Error('Use a scale between 10% and 1000%.');
  if (!race?.road) throw new Error('Open a race first.');
  const result=JSON.parse(JSON.stringify(race));
  const multiply=(object,keys)=>{for(const key of keys)if(typeof object?.[key]==='number')object[key]*=factor;};
  const point=object=>multiply(object,['x','y','z']);
  const height=object=>{if(elevations)multiply(object,['elevation','heightM','groundOffsetM']);};
  const dimensions=object=>{if(sizes)multiply(object,['widthM','heightM']);};
  const road=result.road;
  for(const node of road.nodes||[]){point(node);height(node);}
  for(const segment of road.segments||[]){
    multiply(segment,['length']);height(segment);
    if((road.nodes?.length||0)<2 && segment.length<35)throw new Error('This procedural road needs segments at least 35 meters long. Use a larger scale.');
    if(sizes){multiply(segment,['roadWidthM','roadWidth']);for(const key of ['roadWidthM','roadWidth'])if(segment[key]!=null&&(segment[key]<2.2||segment[key]>24))throw new Error('Scaled road widths must stay between 2.2 and 24 meters.');}
  }
  if(sizes)multiply(road,['laneWidthM','width']);
  for(const node of road.network?.nodes||[]){multiply(node,['x','z']);height(node);}
  for(const edge of road.network?.edges||[]){
    for(const p of edge.points||[]){multiply(p,['x','z']);height(p);}
    if(sizes){multiply(edge,['widthM']);if(edge.widthM<3||edge.widthM>40)throw new Error('Scaled network widths must stay between 3 and 40 meters.');}
  }
  for(const tile of road.groundTiles||[]){point(tile);multiply(tile,['radius']);height(tile);}
  for(const item of result.scenery||[]){multiply(item,['x','z','at','trackDistance','trackLateral']);dimensions(item);if(elevations)multiply(item,['groundOffsetM']);}
  for(const item of result.sceneryDefinitions||[])dimensions(item);
  for(const decal of result.decals||[]){multiply(decal,['x','z','widthM','heightM','tileWorldM']);}
  for(const water of result.waterRegions||[]){multiply(water,['x','z','widthM','lengthM']);if(elevations)multiply(water,['levelM','bottomM']);}
  for(const hazard of result.hazards||[]){multiply(hazard,['at','x','z']);dimensions(hazard);if(elevations)multiply(hazard,['height']);}
  for(const call of result.codriver?.calls||[])multiply(call,['at']);
  for(const trigger of result.triggers||[]){
    multiply(trigger,['x','z','radiusM']);
    if(trigger.radiusM<.5||trigger.radiusM>100)throw new Error('Scaled trigger radii must stay between 0.5 and 100 meters.');
    multiply(trigger.action?.params,['offsetX','offsetZ']);dimensions(trigger.action?.params);
  }
  if(elevations && [...road.nodes||[],...road.segments||[]].some(p=>Math.abs(p.elevation||0)>1))throw new Error('Scaled road elevations exceed the supported range. Turn off Scale elevations or use a smaller scale.');
  const original=race.road.tileMap;
  if(original){
    const source={};
    forEachPackedRaceTileMapCell(original.runtimePackedCells,(cell,p)=>{source[`${p.cellX},${p.cellY}`]=cell;});
    Object.assign(source,original.cells||{});
    const map=road.tileMap,cells={},ratio=(original.cellSizeM||5)*factor/5;
    let visits=0;
    for(const key of Object.keys(source)){
      const [sx,sy]=key.split(',').map(Number);if(!Number.isInteger(sx)||!Number.isInteger(sy))continue;
      const x0=Math.floor(sx*ratio),x1=Math.ceil((sx+1)*ratio),y0=Math.floor(sy*ratio),y1=Math.ceil((sy+1)*ratio);
      visits+=(x1-x0)*(y1-y0);if(visits>2000000)throw new Error('This scale creates too many terrain cells. Use a smaller scale.');
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
        const cell=source[`${Math.floor((x+.5)/ratio)},${Math.floor((y+.5)/ratio)}`];
        if(cell){const copy=JSON.parse(JSON.stringify(cell));if(elevations)multiply(copy,['elevation']);cells[`${x},${y}`]=copy;}
      }
    }
    delete map.runtimePackedCells;map.cells=cells;map.cellSizeM=5;map.revision=(map.revision||0)+1;
    if(elevations)multiply(map,['minElevation','maxElevation']);
  }
  return result;
}
