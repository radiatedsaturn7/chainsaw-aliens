import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {server}=createRequire(import.meta.url)('../../tools/playwright/static-server.cjs');

test('browser test server serves encoded asset paths and verifies current stock thumbnails',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const response=await fetch(`${base}/data/server-storage/files/menus/Game%20Menu/document.json`);
  assert.equal(response.status,200);
  assert.equal((await response.json()).kind,'menu');
  assert.equal((await fetch(`${base}/bad%XX`)).status,400);
  assert.equal((await fetch(`${base}/%2e%2e%2fpackage.json`)).status,403);
  const catalog=JSON.parse(readFileSync(new URL('../../assets/car-previews/manifest.json',import.meta.url)));
  for(const name of ['RTG-001','Agrimony 1988','2005 Flint Coupe']){
   const id=catalog.carsByName[name],row=catalog.previews[id];
   const request=async(revision,carId)=> (await fetch(`${base}/__storage/preview-stock`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({revision,id,name,carId})
   })).json();
   assert.equal((await request(catalog.releaseRevision,row.carId??id)).verified,true,name);
   assert.equal((await request('0'.repeat(64),row.carId??id)).verified,false);
   assert.equal((await request(catalog.releaseRevision,'wrong-car')).verified,false);
  }
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
