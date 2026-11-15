// Reproducible authored pack; import art, then run bind.mjs --apply separately.
import fs from 'node:fs';import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p)),write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
const pack=read('data/race-environments/pack4-recipes.json'),ledger=read('data/race-environments/ledger.json'),expanded=read('data/campaigns/america/expanded-art.json');
const sites={watkins:{ground:'ground-frozen-forest',landscape:'Cold-season wooded Finger Lakes plateau, low rounded ridges, bare hardwoods/conifers; no invented lake or alpine peaks.'},'road-america':{ground:'environment-v1-ground-dormant-prairie',landscape:'Rolling upper-Midwest woodland and dormant meadow; replace inherited industrial concrete visual substrate.'},homestead:{ground:'grass',landscape:'Flat south Florida palms, grassy infield, lime-rock excavation lake and abandoned low grandstands/tower.'},daytona:{ground:'grass',landscape:'Flat Florida grass, palms, Lake Lloyd margin and broad distant grandstands; existing noon original inspected.'},willow:{ground:'ground-desert-scrub-v2',landscape:'High Mojave basin, tan rocky foothills, sparse scrub and low paddock structures; no red Utah mesas or snow.'}};
for(const recipe of pack.recipes){
 assert.ok(fs.existsSync(recipe.sourceImage),'Missing original source');
 const dest='assets/campaign-art/'+recipe.source;fs.copyFileSync(recipe.sourceImage,dest);
 if(!expanded.assets.some(a=>a.name===recipe.ref))expanded.assets.push({name:recipe.ref,source:recipe.source,kind:'skybox',maxEdge:1024,placements:[],usageNote:'Exact venue/layout bindings in race-environments/ledger.json'});
}
const daytona=expanded.assets.find(a=>a.name==='skybox-daytona');delete daytona.deferredReason;daytona.usageNote='Reviewed original for exact Daytona noon layout bindings in venue-pack4.';
const selected=[];
for(const row of ledger.rows){
 const site=row.physicalSiteGroup?.replace(/^facility-/,''),plan=sites[site];if(!plan||row.authoredEnvironment.timeOfDay!=='day')continue;
 assert.equal(row.authoredEnvironment.weather,'clear');assert.ok(row.physicalSiteEvidence?.catalogId);
 const preset=row.authoredEnvironment.visualFx.preset,key=`${site}-${preset}`,recipe=pack.recipes.find(r=>r.key===key),ref=site==='daytona'&&preset==='noon'?'skybox-daytona':recipe?.ref;assert.ok(ref,`Missing composition ${key}`);
 row.binding={skyboxArtRef:ref,groundPlaneArtRef:plan.ground,terrainTileArtById:{snow:plan.ground}};
 row.status='bound-awaiting-production-review';row.environmentPack='venue-pack4';
 row.recipe={key,sourceImage:recipe?.sourceImage||'assets/campaign-art/skyboxes/daytona.png',landscape:plan.landscape,sourceEvidence:row.physicalSiteEvidence,sharing:'Only identical physical site and complete authored environment signature share this art. Night variants excluded.',season:'Cold-season woods/meadow for northern venues; tropical grass for Florida; arid scrub for Mojave. Original illustrative landscapes, not surveyed structure positions.',boundaryReview:'Source repaired where necessary; projected horizon/wrap review pending.'};
 row.terrainReview={ground:plan.landscape,tiles:'All existing snow tile material IDs and weights retained; explicit normal/rough visual refs supplied. This is visual correction, not a physics fix.',road:'Active asphalt retains existing patched-asphalt and exact surface-specific normal/rough mappings/repeats.',shoulder:'Existing shoulder/default and margin settings preserved; effective references captured by native renderer.',acceptance:'source-reviewed; production pending'};
 row.qa={desktop:false,handheld:false,seam:false};selected.push(row.raceRef);
}
assert.equal(selected.length,15,'Exact bounded daylight pack coverage');
write('data/campaigns/america/expanded-art.json',expanded);write('data/race-environments/ledger.json',ledger);
console.log(JSON.stringify({selected,assets:pack.recipes.length}));
