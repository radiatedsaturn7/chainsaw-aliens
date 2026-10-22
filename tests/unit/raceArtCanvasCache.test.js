import test from 'node:test';
import assert from 'node:assert/strict';
import {getRaceArtSpriteCanvasShared} from '../../src/ui/shared/raceArtSpriteCanvas.js';
import {upsertCachedProjectFile,clearCachedProjectFilesForTests} from '../../src/ui/serverStorage.js';
import {resetProjectFilesForTests} from '../../src/ui/projectFiles.js';
const documentRef={createElement(){const canvas={};canvas.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:image=>{canvas.pixels=image.data;}});return canvas;}};

test('alternating cached car artwork avoids reparsing evicted large source documents',()=>{
 resetProjectFilesForTests();clearCachedProjectFilesForTests();
 const padding='x'.repeat(8*1024*1024),cache=new Map();
 for(const name of ['body-a','body-b','tires'])upsertCachedProjectFile('art',name,JSON.stringify({savedAt:1,data:{width:1,height:1,frames:[['#ff0000'],['#00ff00']],padding}}));
 const get=(name,frameIndex=0)=>getRaceArtSpriteCanvasShared(name,{cache,documentRef,frameIndex});
 for(const name of ['body-a','body-b','tires']){get(name);get(name,1);}
 const parse=JSON.parse;let parses=0;JSON.parse=(...args)=>{parses++;return parse(...args);};
 try{
  for(let frame=0;frame<60;frame++)for(const name of ['body-a','body-b','tires'])assert.ok(get(name,frame%2));
  assert.equal(parses,0,'ready canvas frames must not parse evicted source JSON');
 }finally{JSON.parse=parse;resetProjectFilesForTests();clearCachedProjectFilesForTests();}
});

test('replacing artwork with the same timestamp or clearing canvases rebuilds its pixels',()=>{
 resetProjectFilesForTests();clearCachedProjectFilesForTests();const cache=new Map();
 const set=color=>upsertCachedProjectFile('art','editable',JSON.stringify({savedAt:1,data:{width:1,height:1,frames:[[color]]}}));
 const get=()=>getRaceArtSpriteCanvasShared('editable',{cache,documentRef});
 set('#ff0000');const first=get();assert.equal(first.pixels[0],255);
 set('#00ff00');const second=get();assert.notEqual(first,second);assert.equal(second.pixels[1],255);
 cache.clear();assert.notEqual(get(),second);
 resetProjectFilesForTests();clearCachedProjectFilesForTests();
});
