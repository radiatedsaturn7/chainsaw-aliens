import {buildDistantScenery} from './distant_scenery.mjs';
// Existing saved artwork only; geography and source road surfaces remain intact.
export const wildernessPalettes={
 alaska:{sky:'skybox-mount-washington',ground:'ground-clean-snow-v2',props:['snow-covered-pine-01','snow-covered-pine-02','alpine-rock-outcrop-01','frozen-bush-01']},
 tundra:{sky:'skybox-mount-washington',ground:'ground-snow-dead-grass',props:['frozen-bush-01','frozen-bush-03','alpine-rock-outcrop-02','expanded-grass-clump']},
 forest:{sky:'skybox-sawtooth',ground:'ground-alpine-rock-v2',props:['mostly-bare-pine-01','expanded-tree-shortleaf-pine-young-01','expanded-bush-blueberry-01','expanded-rock-granite-moss-01']},
 alpine:{sky:'skybox-pikes-peak',ground:'ground-alpine-rock-v2',props:['mostly-bare-pine-02','alpine-rock-outcrop-02','pikes-peak-alpine-vegetation']},
 prairie:{sky:'skybox-route-66',ground:'ground-desert-scrub-v2',props:['expanded-grass-little-bluestem-01','expanded-grass-little-bluestem-02','expanded-grass-roadside-weeds-01','dry-scrub-bush-01']},
 tropical:{sky:'skybox-palms-to-pines',ground:'grass',props:['tree','expanded-bush-blackberry-bramble-01','expanded-bush-willow-river-01','expanded-grass-sedge-wetland-01']},
 volcano:{sky:'skybox-pikes-peak',ground:'ground-alpine-rock-v2',props:['gray-rock-01','gray-rock-03','alpine-rock-outcrop-02','pikes-peak-alpine-vegetation']},
 'volcano-snow':{sky:'skybox-pikes-peak',ground:'ground-dirty-snow-v2',props:['gray-rock-02','alpine-rock-outcrop-01','frozen-bush-02']},
 canyon:{sky:'skybox-oak-creek',ground:'ground-canyon-rock-v2',props:['oak-creek-red-rock-formation','dry-scrub-bush-01','dry-scrub-bush-03','moki-dugway-desert-scrub']}
};
export function wildernessParent(parent,row,manifest,read){
 const config=wildernessPalettes[row.palette];if(!config)return parent;
 parent.skyboxArtRef=config.sky;parent.groundPlaneArtRef=config.ground;
 parent.scenery=config.props.map(ref=>{
  if(!manifest.folders.doodads[ref])throw Error(`Missing saved doodad ${ref}`);
  const saved=read(`data/server-storage/files/${manifest.folders.doodads[ref]}`),def=saved.doodad||saved;
  return {doodadRef:ref,widthM:def.widthM||6,heightM:def.heightM||6,groundOffsetM:0};
 });
 return parent;
}
export function applyWildernessConditions(race,row){
 if(!row.palette)return;
 race.weather=row.weather||'clear';race.weatherIntensity=race.weather==='snow'?.35:race.weather==='rain'?.3:0;
 race.weatherTemperatureC=race.weather==='snow'?-5:race.weather==='rain'?5:1;
 race.weatherVisibilityM=race.weather==='snow'?850:race.weather==='rain'?1500:5000;
 race.snowClouds={enabled:race.weather==='snow',artRef:'snowcloud'};
 const config=wildernessPalettes[row.palette];
 const groundSurface=({alaska:'snow',tundra:'snow',forest:'grass',alpine:'gravel',prairie:'grass',tropical:'grass',volcano:'gravel','volcano-snow':'snow',canyon:'dirt'})[row.palette];
 race.road.tileMap.defaultTileId=groundSurface;
 for(const cell of Object.values(race.road.tileMap.cells)){cell.tileId=groundSurface;delete cell.tileWeights;cell.artRef=config.ground;cell.tileArtRef=config.ground;}
 race.source.environmentNotes='Fictional closed-road 2994 conditions; real OSM road plan and DEM elevations. Existing regional artwork substitutes for location-specific vegetation and landmarks.';
 // Thin packed snow, not a grip multiplier. Mixed-surface Alaska/volcano events
 // retain bare sections so the original road material still matters.
 if(race.weather==='snow'){
  race.trackState??={};race.trackState.surfaceProfiles??={};
  race.trackState.surfaceProfiles.snow={snowDepthMm:25.4,iceDepthMm:0,moistureDepthMm:0,standingWaterDepthMm:0};
  for(let i=0;i<race.road.segments.length;i++){
   const progress=i/race.road.segments.length;
   if(row.palette==='alaska'||row.palette==='volcano-snow'&&progress>.55||row.palette==='tundra'&&Math.floor(progress*8)%3===0)race.road.segments[i].surface='snow';
  }
 }
 for(const [i,s] of race.road.segments.entries())s.bumpiness=s.surface==='asphalt'?.012:s.surface==='snow'?.025:.045+.025*(.5+.5*Math.sin(i*.15));
 race.description+=` ${row.palette==='tropical'?'Wet hillside corners above Honolulu.':row.palette==='prairie'?'Open grassland and rolling prairie.':row.palette.startsWith('volcano')?'Sparse volcanic slopes and summit approaches.':row.palette==='canyon'?'Canyon walls, exposed rock and sparse scrub.':race.weather==='snow'?'Thin snow and changing alpine visibility.':'Mountain corners and forested approaches.'}`;
}

export function addWildernessDistantScenery(race,row,manifest,read,editor){
 const palette=wildernessPalettes[row.palette];if(!palette)return;
 editor.applyLoadedRaceDocument(race);
 const tile=race.road.tileMap,cell=tile.cellSizeM,bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
 for(const id of Object.keys(tile.cells)){
  const [x,z]=id.split(',').map(Number);
  bounds.minX=Math.min(bounds.minX,x*cell);bounds.maxX=Math.max(bounds.maxX,(x+1)*cell);
  bounds.minZ=Math.min(bounds.minZ,z*cell);bounds.maxZ=Math.max(bounds.maxZ,(z+1)*cell);
 }
 const cache=new Map(),definition=name=>{if(!cache.has(name))cache.set(name,read(`data/server-storage/files/${manifest.folders.doodads[name]}`).doodad);return cache.get(name);};
 const length=editor.getRaceRouteLength();
 const config={count:Math.min(1000,Math.round(length/(row.palette==='forest'?15:35))),clusterSize:5,bands:[[100,220],[220,420]],refs:[palette.props,palette.props]};
 const props=editor.withRaceGeometryReadCache(()=>buildDistantScenery({key:row.id,config,bounds,definition,length,pose:d=>editor.getRaceWorldPoseAtDistance(d),project:p=>editor.getRaceRouteProjectionForWorldPoint(p)}));
 race.scenery.push(...props.filter(p=>tile.cells[`${Math.floor(p.x/cell)},${Math.floor(p.z/cell)}`]));
}
