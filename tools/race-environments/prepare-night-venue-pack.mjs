// Exact source-grounded pack; no automatic physics or authored lighting changes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p)),write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const pack=read('data/race-environments/pack5-recipes.json'),ledger=read('data/race-environments/ledger.json'),expanded=read('data/campaigns/america/expanded-art.json');
const sites={
 'willow':['ground-desert-scrub-v2','Mojave rocky foothill canyon and open basin, sparse scrub.','https://willowspringsraceway.com/tracks/'],
 'vir':['environment-v1-ground-dormant-prairie','Rolling Virginia meadows and oak/hardwood wooded ridges.','https://virnow.com/oak-tree-tavern/'],
 'road-atlanta':['ground-frozen-forest','Rolling northeast Georgia park-like hills, pine/hardwood slopes and red-clay patches.','https://www.roadatlanta.com/track-info/about-mrra/track-map'],
 'sebring':['grass','Flat Florida former airfield, low hangars, palms/pine silhouettes and sandy grass.','https://www.sebringraceway.com/track-history/'],
 'mid-ohio':['environment-v1-ground-dormant-prairie','Lexington natural-terrain Ohio circuit; low wooded farm ridge and rolling meadow.','https://www.midohio.com/news/mo-history'],
 'lime':['ground-frozen-forest','Northwest Connecticut natural-terrain valley, rounded wooded hills and meadow.','https://limerock.com/lime-rock-park-introduces-new-live-track-conditions-camera/']
};
for(const recipe of pack.recipes){
 const site=recipe.key.replace(/-(night|morning|evening)$/,'');
 recipe.landscape=sites[site][1];recipe.reference=sites[site][2];
 recipe.sourceEvidence='Exact installed source/layout/GPS in ledger and tools/campaigns/raceway_sources.json; illustrative 2994 structures are not surveyed buildings.';
 recipe.sourceLimitation='Operator source describes site character; season and abandoned buildings are original art interpretation.';
 recipe.boundaries='Plain top/bottom safe bands requested; native wrap/pitch review remains mandatory.';
 fs.copyFileSync(recipe.sourceImage,'assets/campaign-art/'+recipe.source);
 if(!expanded.assets.some(a=>a.name===recipe.ref))expanded.assets.push({name:recipe.ref,source:recipe.source,kind:'skybox',maxEdge:1024,placements:[],usageNote:'Exact venue-pack5 saved race bindings in race-environments ledger.'});
}
const selected=[];
for(const row of ledger.rows){
 const site=row.physicalSiteGroup?.replace(/^facility-/,''),preset=row.authoredEnvironment.visualFx?.preset;
 const recipe=pack.recipes.find(r=>r.key===`${site}-${preset}`);if(!recipe||(row.binding&&row.environmentPack!=='venue-pack5'))continue;
 assert.equal(row.authoredEnvironment.weather,'clear');assert.ok(row.physicalSiteEvidence?.catalogId);
 const ground=sites[site][0];row.binding={skyboxArtRef:recipe.ref,groundPlaneArtRef:ground,terrainTileArtById:{snow:ground}};
 row.environmentPack='venue-pack5';row.status='bound-awaiting-production-review';
 row.recipe={...recipe,sharing:'Only exact site plus identical complete authored-environment signature; no night/day sharing.'};
 row.terrainReview={ground:sites[site][1],tiles:'Explicit normal/rough art for inherited snow tile IDs; physical IDs/weights remain unchanged.',road:'Active asphalt retains original mappings, repetitions and surface behavior.',shoulder:'All authored shoulder/default/margin settings retained; effective refs require native audit.',acceptance:'source-reviewed; production pending'};
 row.qa??={desktop:false,handheld:false,seam:false};selected.push(row.raceRef);
}
assert.equal(selected.length,16,'Exact reviewed layout scope');
write('data/race-environments/pack5-recipes.json',pack);write('data/campaigns/america/expanded-art.json',expanded);write('data/race-environments/ledger.json',ledger);
console.log(JSON.stringify({selected,assets:pack.recipes.length}));
