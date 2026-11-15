// Explicit route/site recipes. Visual image refs only; physical IDs/weights retained.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p)),write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const pack=read('data/race-environments/pack13-recipes.json'),ledger=read('data/race-environments/ledger.json'),expanded=read('data/campaigns/america/expanded-art.json');
assert.equal(pack.recipes.length,24);assert.equal(new Set(pack.recipes.map(r=>r.raceRef)).size,24);
for(const asset of pack.groundAssets){
 fs.copyFileSync(asset.sourceImage,'assets/campaign-art/'+asset.source);
 if(!expanded.assets.some(a=>a.name===asset.key))expanded.assets.push({name:asset.key,source:asset.source,kind:'terrain',maxEdge:512,placements:[],usageNote:'Material-specific grass or snow for Great Plains existing physical cells.'});
}
for(const recipe of pack.recipes){
 const row=ledger.rows.find(r=>r.raceRef===recipe.raceRef);assert.ok(row);assert.ok(!row.binding||row.environmentPack==='western-mountains-pacific-pack13');
 fs.copyFileSync(recipe.sourceImage,'assets/campaign-art/'+recipe.source);
 if(!expanded.assets.some(a=>a.name===recipe.ref))expanded.assets.push({name:recipe.ref,source:recipe.source,kind:'skybox',maxEdge:1024,placements:[],usageNote:'Exact Western mountains Pacific pack13 saved race binding in race-environments ledger.'});
 if(recipe.mainRoutePlacementMigration){const m=recipe.mainRoutePlacementMigration,old=expanded.assets.find(a=>a.name===m.from),current=expanded.assets.find(a=>a.name===m.to);assert.ok(old&&current);if(old.placements.length){assert.deepEqual(old.placements,m.placements);current.placements=old.placements;old.placements=[];}else assert.deepEqual(current.placements,m.placements);}
 row.binding={skyboxArtRef:recipe.ref,groundPlaneArtRef:recipe.ground,terrainTileArtById:recipe.tiles};
 if(recipe.roadArtMap)row.binding.roadArtMap=recipe.roadArtMap;
 row.environmentPack='western-mountains-pacific-pack13';row.status='bound-awaiting-production-review';row.recipe=recipe;
 row.terrainReview={ground:recipe.brief,tiles:'Explicit normal and rough images per existing tile ID; Only existing tile visual refs mapped to the selected local substrate; physical tile IDs retained. Physical IDs and weights unchanged.',road:'Existing surface-specific road art, repeats, shoulders and margin semantics retained; native effective audit required.',acceptance:'Source recipe reviewed; actual production appearance pending.'};
 row.qa??={desktop:false,handheld:false,seam:false};
}
write('data/campaigns/america/expanded-art.json',expanded);write('data/race-environments/ledger.json',ledger);
console.log(JSON.stringify({pack:'western-mountains-pacific-pack13',bindings:pack.recipes.length,assets:new Set(pack.recipes.map(r=>r.ref)).size}));
