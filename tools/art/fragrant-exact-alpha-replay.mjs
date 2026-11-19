// Private proof only: a sealed Fragrant replay of an independently reviewed source edit.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
export const fragrantSha = b => createHash('sha256').update(b).digest('hex');
export const fragrantMode = '--fragrant-exact-alpha';
const key = 'fragrant-agrimony-1992';
const untouched = 'e4819ecc5c67d42dcbe8c7fae747a58de0ccfa6ce5e503bb7cf9ad08eaa0ea06';
const decodedReviewed = '2637225e509c6c05536c8fc6fca057cd3b3e4b3370e532dfe2e4a59e675b1b8a';
const approvedAtlas = '991d477a1b7384b3b3b77cc95b38b9c7ee5e72fa0a3283621b31de7583868871';
const ledgerSHA = '9dfc1d6f6a9a5c593f16b8b3e83a862c80114f939dc4f2d16d07a35cb49a2895';
const ledgerFile = new URL('./fragrant-exact-reviewed-ledger.json', import.meta.url);
const slots = [
  ['frontRight',1,[418,130,451,237],[1,17],653,563,'unchangedFromPriorValidatedFRPreparedChangedIndices'],
  ['frontLeft',7,[1345,561,417,232],[18,20],596,540,'preparedChangedIndices']
];
export function validateFragrant(cfg,bytes,inputBytes) {
  assert.equal(fragrantSha(bytes),'1febba04ca6507825d22952b9342ed611ce826c7b0a983ef630d192ff5ba2ade','Unreviewed Fragrant config bytes');
  assert.equal(fragrantSha(inputBytes),'606438494fa6ae0c6fc5f9a1c061ae9d27d296a76748226a742385f2a4b42171','Unreviewed Fragrant vehicle');
  assert.equal(cfg.id,key);
  assert.equal(cfg.sourceHashes.body,approvedAtlas);
}
export function applyFragrantControls(car,cfg) {
  assert.equal(car.art.gauges.interior.coordinateSpace,'wheel-opening');
  const gauges=car.art.gauges.interior.widgets.filter(g=>g.showValue!==false);
  assert.deepEqual(gauges.map(g=>g.source),['speed','rpm','gear']);
  for(const [i,g] of gauges.entries()){
    const [x,width]=cfg.cockpitCalibration.wheelOpeningInsets[i];
    Object.assign(g,{x,width});
  }
  for(const [s,t] of Object.entries(cfg.nativeBodyTransformOverrides))Object.assign(car.art.angleLayers[s].body.transforms,t);
}
export function applyFragrantAlpha(built,atlas,car,pack) {
  const bytes=readFileSync(ledgerFile);
  assert.equal(fragrantSha(bytes),ledgerSHA,'Unreviewed Fragrant alpha ledger');
  const L=JSON.parse(bytes);
  assert.equal(L.originalAtlasSHA256,approvedAtlas);
  const doc=built.art['catalog-'+key+'-body'];
  assert.equal(fragrantSha(pack(doc)),untouched,'Prepared Fragrant original differs');
  assert.deepEqual([atlas.width,atlas.height,doc.width,doc.height,doc.frames.length],[1774,887,453,272,8]);
  const frames=[];
  for(const [slot,index,crop,padding,count,expectedCount,indicesKey] of slots){
    const [x0,y0,w,h]=crop,[px,py]=padding;
    assert.deepEqual(doc.frameBounds[index],{x:px,y:py,width:w,height:h},'Prepared Fragrant frame bounds differ');
    assert.equal(car.art.angleLayers[slot].body.frameIndex,index);
    const f=doc.frames[index], data=slot==='frontRight'?L.FR:L.FL;
    const ledger=data.ledger.flatMap(([y,xs])=>xs.map(x=>[x,y]));
    assert.equal(ledger.length,count);
    const indices=[]; let unimportedFringe=0;
    for(const [x,y] of ledger){
      const limits=slot==='frontRight'?[582,350,625,367]:[1550,776,1590,794];
      assert.ok(x>=limits[0]&&x<limits[2]&&y>=limits[1]&&y<limits[3],'Fragrant ROI escapes exact reviewed bounds');
      const at=4*(y*atlas.width+x),rgba=Buffer.from(atlas.data.subarray(at,at+4));
      assert.ok(rgba[3]>0,'Fragrant ledger references empty source');
      if(x<x0||x>=x0+w||y<y0||y>=y0+h){
        assert.ok(slot==='frontLeft'&&y===y0+h&&rgba[3]<=3,'Unreviewed source outside exact prepared crop');
        unimportedFringe++;continue;
      }
      const idx=(y-y0+py)*doc.width+x-x0+px;
      if(f[idx]===null)continue;
      const expected='#'+rgba.toString('hex');
      assert.ok(f[idx]===expected||(rgba[3]===255&&f[idx]===expected.slice(0,7)),'Fragrant source-to-prepared pixel mismatch');
      f[idx]=null; indices.push(idx);
    }
    assert.equal(unimportedFringe,slot==='frontLeft'?12:0);
    assert.equal(indices.length,expectedCount);
    assert.deepEqual(indices,data[indicesKey],'Fragrant prepared mask differs');
    frames.push({slot,index,atlasPixels:count,preparedPixels:expectedCount,unimportedFringe,crop,padding});
  }
  const decoded=fragrantSha(JSON.stringify(doc));
  assert.equal(decoded,decodedReviewed,'Fragrant final decoded native document differs');
  return {mode:'fragrant-fr-fl-exact-alpha',version:1,ledgerSha256:ledgerSHA,originalPreparedBodySha256:untouched,reviewedDecodedBodySha256:decoded,frames};
}
