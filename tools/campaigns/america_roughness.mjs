// Fictional event surfaces: GPS does not provide a measured road roughness survey.
// Broad, smooth variations avoid segment-to-segment random discontinuities.
export function applyAmericaRoughness(race,stage){
 const surfaceBase={asphalt:.012,'wet-asphalt':.016,dirt:.10,gravel:.13,'wet-gravel':.15,mud:.10,snow:.07,slush:.09};
 let seed=0;for(const c of stage.id||race.id||'america')seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0;
 const phase=(seed%1000)/1000*Math.PI*2,west=Math.max(0,Math.min(7,Number(stage.stage)-1))/7;
 let distance=0;
 for(const segment of race.road.segments){
  const base=surfaceBase[segment.surface]??.08;
  const variation=1+.22*Math.sin(distance/180+phase)+.12*Math.sin(distance/55+phase*.7);
  segment.bumpiness=Number(Math.min(.4,base*(1+.65*west)*variation).toFixed(4));
  distance+=Number(segment.lengthM??segment.length)||30;
 }
 race.source||={};race.source.roughnessDescription='Authored surface-specific roughness, smoothly varied along each GPS stage; not measured road survey data.';
 return race;
}
