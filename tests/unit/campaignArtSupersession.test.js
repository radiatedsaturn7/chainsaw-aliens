import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifySupersededArtwork,validateArtworkIntent} from '../helpers/campaignArtworkValidation.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const bytes={'old.png':Buffer.from('original pixels'),'data/server-storage/files/art/old.json':Buffer.from('native pixels'),'data/race-environments/review.jpg':Buffer.from('review bytes')};
 const imports={old:{source:'old.png',sourceSha256:hash(bytes['old.png']),documentSha256:hash(bytes['data/server-storage/files/art/old.json'])},replacement:{source:'new.png'}};
 const registry={schemaVersion:1,assets:{old:{kind:'skybox',replacement:'replacement',raceRef:'Race',reason:'Reviewed old scene has the wrong location and season for this saved race.',source:'old.png',sourceSha256:imports.old.sourceSha256,documentPath:'art/old.json',documentSha256:imports.old.documentSha256,review:{path:'data/race-environments/review.jpg',sha256:hash(bytes['data/race-environments/review.jpg']),verdict:'superseded-location-season-mismatch',scope:'Original and replacement both reviewed through native authored and diagnostic captures.'}}}};
 const manifest={folders:{art:{old:'art/old.json',replacement:'art/new.json'},races:{Race:'race.json',Other:'other.json'}}};
 const docs={'race.json':{race:{skyboxArtRef:'replacement',skyboxSettings:{artRef:'replacement'}}},'other.json':{race:{}}};
 const used=new Set(['replacement']);
 return {registry,imports,manifest,bytes,docs,used,run(){return verifySupersededArtwork(this.registry,this.imports,this.manifest,p=>this.docs[p],p=>this.bytes[p],this.used);}};
}
test('supersession requires explicit review, unchanged original bytes and real replacement placement',()=>{
 const f=fixture();assert.deepEqual([...f.run()],['old']);
 const policy={schemaVersion:1,defaultIntent:'campaign-placement',editorAssets:{},configuredUnused:{'road-snow-patchy':{raceRef:'Pikes Peak Highway',surface:'snow'}}};
 f.imports['road-snow-patchy']={source:'snow.png'};
 const args=[policy,f.imports,f.used,new Set(),new Set(['road-snow-patchy']),new Set(),new Set()];
 assert.throws(()=>validateArtworkIntent(...args),/no actual placement: old/);
 assert.ok(validateArtworkIntent(...args,{registry:f.registry,manifest:f.manifest,read:p=>f.docs[p],readBytes:p=>f.bytes[p]}).some(s=>s.includes('SUPERSEDED ART PRESERVED')));
 f.imports.unrelated={source:'unplaced.png'};
 assert.throws(()=>validateArtworkIntent(...args,{registry:f.registry,manifest:f.manifest,read:p=>f.docs[p],readBytes:p=>f.bytes[p]}),/no actual placement: unrelated/);
});
for(const [name,mutate]of Object.entries({
 'changed source':f=>f.bytes['old.png']=Buffer.from('altered'),
 'missing native':f=>delete f.bytes['data/server-storage/files/art/old.json'],
 'changed review':f=>f.bytes['data/race-environments/review.jpg']=Buffer.from('fake'),
 'missing review':f=>delete f.registry.assets.old.review,
 'unreviewed verdict':f=>f.registry.assets.old.review.verdict='ignore-unused',
 'invented replacement':f=>f.registry.assets.old.replacement='missing',
 'self replacement':f=>f.registry.assets.old.replacement='old',
 'retired replacement':f=>f.registry.assets.replacement=structuredClone(f.registry.assets.old),
 'unplaced replacement':f=>f.used.clear(),
 'conflicting binding':f=>f.docs['race.json'].race.skyboxSettings.artRef='other',
 'hidden old use':f=>f.docs['other.json'].race.skyboxArtRef='old',
 'wrong native path':f=>f.registry.assets.old.documentPath='elsewhere',
 'blanket extra key':f=>f.registry.allowAll=true,
 'incomplete terrain retirement':f=>f.registry.assets.old.kind='terrain'
}))test('supersession rejects '+name,()=>{const f=fixture();mutate(f);assert.throws(()=>f.run());});

function terrainFixture(){
 const f=fixture(),r=f.registry.assets.old,ref='ground-gray-gravel-v2';
 r.kind='terrain';r.replacement=ref;r.replacementMaterial='gravel';r.replacementCellCount=2;r.review.verdict='superseded-material-site-fit';
 f.imports[ref]=f.imports.replacement;delete f.imports.replacement;f.manifest.folders.art[ref]='art/new.json';delete f.manifest.folders.art.replacement;f.used=new Set([ref]);
 f.docs['race.json']={race:{road:{tileMap:{cells:{a:{tileId:'gravel',artRef:ref,roughArtRef:ref},b:{tileId:'gravel',artRef:ref,roughArtRef:ref}}}}}};
 return f;
}
test('terrain supersession requires exact counted material-correct normal and rough replacements',()=>{assert.deepEqual([...terrainFixture().run()],['old']);});
for(const [name,mutate]of Object.entries({
 'wrong declared material':f=>f.registry.assets.old.replacementMaterial='snow',
 'wrong physical material':f=>f.docs['race.json'].race.road.tileMap.cells.a.tileId='snow',
 'missing replacement count':f=>delete f.registry.assets.old.replacementCellCount,
 'wrong replacement count':f=>f.registry.assets.old.replacementCellCount=3,
 'empty replacement':f=>f.docs['race.json'].race.road.tileMap.cells={},
 'rough-only replacement':f=>delete f.docs['race.json'].race.road.tileMap.cells.a.artRef,
 'hidden rough old use':f=>f.docs['other.json'].race.road={tileMap:{cells:{a:{roughArtRef:'old'}}}},
 'hidden ground old use':f=>f.docs['other.json'].race.groundPlaneArtRef='old',
 'hidden road old use':f=>f.docs['other.json'].race.roadTextures={surfaceRoads:{gravel:{artRef:'old'}}},
 'missing original':f=>delete f.bytes['old.png'],
 'unreviewed terrain':f=>f.registry.assets.old.review.verdict='ignore-unused'
}))test('terrain supersession rejects '+name,()=>{const f=terrainFixture();mutate(f);assert.throws(()=>f.run());});
