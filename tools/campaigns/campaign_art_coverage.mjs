// Cover the driving corridor, rather than merely placing one of each asset.
// Reuse surveyed prop positions and their collision/interaction definitions.
const palettes={
 mount:{tree:['snow-covered-pine-01','snow-covered-pine-02','snow-covered-pine-03'],frozenrock:['alpine-rock-outcrop-01','alpine-rock-outcrop-02'],frozenbush:['frozen-bush-01','frozen-bush-02']},
 ohio:{tree:['leafless-tree-01','leafless-tree-02','leafless-tree-03'],frozenrock:['gray-boulder-01','gray-boulder-02'],frozenbush:['ohio-river-crossing-riverbank-vegetation','frozen-bush-03']},
 ozark:{tree:['leafless-tree-01','leafless-tree-02','mostly-bare-pine-01'],frozenrock:['ozarks-exposed-limestone','gray-boulder-03'],frozenbush:['ozarks-creekside-brush','frozen-bush-02']},
 city:{Factory:['data-center-city-server-building','data-center-city-loading-dock','data-center-city-cooling-units'],frozenrock:['roadside-rubble-pile'],frozenbush:['frozen-bush-01','frozen-bush-03']},
 route66:{frozenrock:['gray-boulder-01','gray-boulder-03'],frozenbush:['dry-scrub-bush-01','dry-scrub-bush-02','dry-scrub-bush-03']},
 pikes:{frozenrock:['pikes-peak-granite-outcrop','alpine-rock-outcrop-01','alpine-rock-outcrop-02'],frozenbush:['pikes-peak-alpine-vegetation','frozen-bush-01']},
 moki:{frozenrock:['moki-dugway-sandstone-outcrop','red-sandstone-boulder-01','red-sandstone-boulder-02'],frozenbush:['moki-dugway-desert-scrub','dry-scrub-bush-01','dry-scrub-bush-03']},
 oak:{tree:['oak-creek-creekside-tree','mostly-bare-pine-01','mostly-bare-pine-02'],frozenrock:['oak-creek-red-rock-formation','red-sandstone-boulder-02','red-sandstone-boulder-03'],frozenbush:['dry-scrub-bush-02','frozen-bush-03']},
 angeles:{frozenrock:['angeles-crest-pale-rock-cut','gray-boulder-01','gray-boulder-02','gray-boulder-03'],frozenbush:['angeles-crest-chaparral','dry-scrub-bush-01','dry-scrub-bush-02']}
};
const terrain={
 mount:[['ground-clean-snow-v2','snow'],['ground-alpine-rock-v2','gravel']],
 laurel:[['ground-frozen-forest','dirt']],
 ohio:[['ground-dirty-snow-v2','snow']],
 ozark:[['ground-brown-dirt-v2','dirt'],['ground-gray-gravel-v2','gravel']],
 city:[['ground-industrial-concrete-v2','asphalt'],['ground-industrial-rubble-v2','gravel'],['ground-dirty-snow-v2','snow']],
 route66:[['ground-desert-scrub-v2','dirt']],
 pikes:[['ground-clean-snow-v2','snow']],
 moki:[['ground-canyon-rock-v2','gravel'],['ground-red-gravel-v2','gravel']],
 oak:[['ground-canyon-rock-v2','gravel']],
 angeles:[['ground-desert-scrub-v2','dirt']]
};
const hash=s=>Array.from(s).reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,0);
export function applyCampaignArtCoverage(r,key,definition){
 let replaced=0;
 for(const p of r.scenery){
  const choices=palettes[key]?.[p.doodadRef];if(!choices)continue;
  const name=choices[hash(p.id)%choices.length],art=definition(name);
  const original=structuredClone(p.previewDoodad||definition(p.doodadRef));
  // Change appearance without enlarging a roadside obstacle or changing damage.
  const scale=Math.min(p.widthM/art.widthM,p.heightM/art.heightM);
  const widthM=art.widthM*scale,heightM=art.heightM*scale;
  p.campaignAppearance={originalRef:p.doodadRef,originalWidthM:p.widthM,originalHeightM:p.heightM};
  Object.assign(p,{doodadRef:name,artRef:art.artRef,label:name,definitionId:art.id,widthM,heightM,groundOffsetM:0,
   previewDoodad:{...original,id:art.id,name,artRef:art.artRef,widthM,heightM,groundOffsetM:0}});
  replaced++;
 }
 const materials=terrain[key];
 if(materials){
  const map=r.road.tileMap,size=map.cellSizeM;
  r.groundPlaneArtRef=materials[0][0];
  for(const [cellKey,cell] of Object.entries(map.cells)){
   const [x,z]=cellKey.split(',').map(v=>Number(v)*size);
   // Broad continuous landforms, not alternating 55–75 m square tiles.
   const field=(Math.sin(x/850)+.55*Math.sin(z/1100+x/1900)+1.55)/3.1;
   const [artRef,tileId]=materials[Math.min(materials.length-1,Math.floor(field*materials.length))];
   Object.assign(cell,{artRef,tileId,tileWeights:{[tileId]:1}});
  }
 }
 return replaced;
}
