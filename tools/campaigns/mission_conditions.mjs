import {reverseRaceRoute} from '../../src/racing/reverseRaceRoute.js';
// Authored post-collapse event conditions, not a claim about surveyed roads.
// Recommendations never participate in race unlocks or equipment checks.
const profile=(parts,weather,intensity,temperature,surface,roughness,briefing,zones=[])=>({
 recommendedParts:parts,weather,intensity,temperature,surface,roughness,briefing,zones,
});
export const MIDDLE_MISSION_CONDITIONS={
 'osm-cf573fba73e0':profile(['snow-tires'],'snow',.75,-12,'snow',[.035,.085],
  'Snow tires recommended. Packed snow covers the climb from the start; slow down before the hairpins. You can attempt this with any equipment.'),
 'america-middle-laurel':profile(['rally-suspension'],'clear',0,-3,'asphalt',[.025,.055],
  'Rally suspension recommended. Long frost-damaged sections interrupt the pavement. Stock suspension can get through at a slower pace.',
  [[.12,.32,'asphalt',.26,.36],[.45,.65,'asphalt',.28,.38],[.76,.91,'asphalt',.25,.35]]),
 'america-middle-ohio':profile(['rain-tires'],'storm',.85,4,'wet-asphalt',[.025,.05],
  'Rain tires recommended. A winter thaw has soaked the valley road. Leave braking room and ease off through wet corners.'),
 'america-middle-ozark':profile(['rally-tires'],'clear',0,-2,'dirt',[.10,.16],
  'Rally tires recommended. Exposed dirt dominates this abandoned highway, with loose gravel sections between the wooded bends. Reuse your rally setup and keep the throttle measured.',
  [[.25,.38,'gravel',.12,.18],[.65,.78,'gravel',.12,.18]]),
 'america-middle-city':profile(['street-tires'],'clear',0,-2,'asphalt',[.018,.035],
  'A balanced road setup works here. Industrial straights and bends are interrupted by short rubble crossings. Brake before the rubble; a rally build trades asphalt grip for easier crossings.',
  [[.22,.25,'gravel',.18,.26],[.51,.54,'gravel',.20,.28],[.79,.82,'gravel',.18,.26]]),
 'america-middle-route66':profile(['race-tires'],'clear',0,3,'asphalt',[.015,.035],
  'Tarmac tires recommended. Exposed dry pavement rewards road grip at speed. Cooling and gearing can help a powerful build, but are not entry requirements.'),
 'america-middle-pikes':profile(['race-tires'],'clear',0,-5,'asphalt',[.02,.045],
  'Road tires recommended for this mostly dry climb. Use the gearbox through the uphill hairpins, then slow well down for the short snow-covered summit approach. Snow tires sacrifice grip over most of the route.',
  [[.96,1,'snow',.035,.065]]),
 'america-middle-moki':profile(['offroad-suspension','rally-tires'],'clear',0,-2,'gravel',[.14,.22],
  'Off-road suspension and rally tires recommended. Long eroded stretches demand suspension travel. A road setup must crawl through the roughest sections.',
  [[.10,.30,'gravel',.36,.46],[.40,.64,'gravel',.38,.48],[.74,.90,'dirt',.34,.44]]),
 'america-middle-oak':profile(['street-tires'],'clear',0,5,'asphalt',[.02,.045],
  'A balanced road setup works here. Dry canyon bends alternate with shaded wet stretches left by the thaw. Adjust braking at each surface change; rain tires trade some dry grip for wet confidence.',
  [[.18,.30,'wet-asphalt',.025,.045],[.46,.58,'wet-asphalt',.025,.045],[.73,.84,'wet-asphalt',.025,.045]]),
 'america-middle-angeles':profile(['race-tires','race-suspension'],'clear',0,4,'asphalt',[.015,.035],
  'Tarmac tires and road suspension recommended. Dry technical corners reward a road setup; snow and off-road tires give up substantial asphalt grip.'),
};

export function applyMissionConditions(race){
 const p=MIDDLE_MISSION_CONDITIONS[race.id];
 if(!p)return false; // Opening and non-campaign races retain their authored behavior.
 // The imported Pikes segment was traced summit-to-base. Use the editor's
 // existing reversal utility, retaining the exact road and world-space props.
 if(race.id==='america-middle-pikes'&&race.road.nodes.at(-1).elevation<race.road.nodes[0].elevation){
  const length=race.road.segments.reduce((sum,s)=>sum+s.length,0);
  reverseRaceRoute(race);
  for(const prop of race.scenery||[]){
   if(Number.isFinite(prop.trackDistance))prop.trackDistance=length-prop.trackDistance;
   if(Number.isFinite(prop.trackLateral))prop.trackLateral=-prop.trackLateral;
  }
  if(race.campaign)[race.campaign.startGps,race.campaign.finishGps]=[race.campaign.finishGps,race.campaign.startGps];
 }

 race.weather=p.weather;race.weatherIntensity=p.intensity;race.weatherTemperatureC=p.temperature;
 race.weatherVisibilityM=p.weather==='snow'?700:p.weather==='storm'?900:2200;
 race.snowClouds={...race.snowClouds,enabled:p.weather==='snow',artRef:'snowcloud'};
 const segments=race.road.segments;
 const length=segments.reduce((n,s)=>n+Number(s.length??s.lengthM??0),0);
 let distance=0;
 for(const s of segments){
  const span=Number(s.length??s.lengthM??0),progress=(distance+span*.5)/Math.max(1,length);
  let surface=p.surface,[lo,hi]=p.roughness;
  // Long damaged stretches; ease roughness in/out over 100 m, not isolated
  // vertex spikes or artificial jumps in the imported elevation profile.
  for(const [start,end,zoneSurface,zlo,zhi] of p.zones){
   if(progress<start||progress>end)continue;
   surface=zoneSurface;
   const edge=Math.max(0,Math.min(1,(progress-start)*length/100,(end-progress)*length/100));
   const blend=edge*edge*(3-2*edge);
   lo+=(zlo-lo)*blend;hi+=(zhi-hi)*blend;
  }
  s.surface=surface;
  s.bumpiness=Number((lo+(hi-lo)*(.5+.5*Math.sin((distance+span*.5)/120))).toFixed(4));
  distance+=span;
 }
 race.source||={};
 race.source.campaignConditions='Authored post-collapse mission surfaces and weather; GPS plan, width and elevation retained. Snow remains on the surrounding terrain even where the road has thawed or cleared.';
 race.source.roughnessDescription='Distance-based damaged-road zones, smoothly ramped over 100 m; fictional event deterioration, not measured roughness.';
 race.campaignChallenge={version:1,recommendedParts:[...p.recommendedParts],briefing:p.briefing};
 const marker='\n\nPreparation: ';
 race.description=(race.description||race.name).split(marker)[0]+marker+p.briefing;
 return true;
}
