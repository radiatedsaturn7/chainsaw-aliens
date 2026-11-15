// Explicit route/site recipes. Visual image refs only; physical IDs/weights retained.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p)),write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const pack=read('data/race-environments/pack6-recipes.json'),ledger=read('data/race-environments/ledger.json'),expanded=read('data/campaigns/america/expanded-art.json');
assert.equal(pack.recipes.length,15);assert.equal(new Set(pack.recipes.map(r=>r.raceRef)).size,15);
for(const recipe of pack.recipes){
 const row=ledger.rows.find(r=>r.raceRef===recipe.raceRef);assert.ok(row);assert.ok(!row.binding||row.environmentPack==='new-england-pack6');
 fs.copyFileSync(recipe.sourceImage,'assets/campaign-art/'+recipe.source);
 if(!expanded.assets.some(a=>a.name===recipe.ref))expanded.assets.push({name:recipe.ref,source:recipe.source,kind:'skybox',maxEdge:1024,placements:[],usageNote:'Exact New England pack6 saved race binding in race-environments ledger.'});
 const mainKey=recipe.key==='tower-hill-snow-night'?'tower':recipe.key==='mount-washington-snow-noon'?'mount':null;
 if(mainKey){for(const asset of expanded.assets)if(asset.kind==='skybox')asset.placements=asset.placements.filter(p=>p.race!==mainKey);expanded.assets.find(a=>a.name===recipe.ref).placements.push({race:mainKey});}
 row.binding={skyboxArtRef:recipe.ref,groundPlaneArtRef:recipe.ground,terrainTileArtById:recipe.tiles};
 row.environmentPack='new-england-pack6';row.status='bound-awaiting-production-review';row.recipe=recipe;
 row.terrainReview={ground:recipe.landscape,tiles:'Explicit normal and rough images per existing tile ID; snow retained on authored snow routes, rock retained on Mount Washington gravel cells. Physical IDs and weights unchanged.',road:'Existing surface-specific road art, repeats, shoulders and margin semantics retained; native effective audit required.',acceptance:'Source recipe reviewed; actual production appearance pending.'};
 row.qa??={desktop:false,handheld:false,seam:false};
}
write('data/campaigns/america/expanded-art.json',expanded);write('data/race-environments/ledger.json',ledger);
console.log(JSON.stringify({pack:'new-england-pack6',bindings:pack.recipes.length,assets:pack.recipes.length}));
