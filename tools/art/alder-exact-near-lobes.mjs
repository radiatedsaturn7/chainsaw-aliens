import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareCarSheet} from '../../src/racing/CarGraphicImport.js';
const hash=x=>createHash('sha256').update(x).digest('hex');
const packedPins={
 body:'d50879856b63371b9e2d196e6ddc36545fa02c9e97235575fece52d1c4001487',
 dashboard:'211926c39d735651aa91b7fc8adf243eec07eccf956126d59b1487b54d8f56d9',
 tires:'0d58e8e3bdd0f8b849d85892cefb42ae14a838479109522721bc8249efa988a0'
};
const decodedPin='fcb983e08d389139b69485bd023c1a26e16eb8142fe99e17812f3b625e3b9c19';
const packedPin='b5280f1c0bb547e134d4566a965b4c98d3f844ad021dbe2ba8859521a0071e71';
const crops=[[22,140,308,232],[354,143,437,229],[808,153,526,188],[1351,139,414,229],
 [25,567,293,243],[334,568,418,240],[769,583,560,196],[1342,573,422,242]];
const pads=[[127,6],[62,8],[18,28],[74,8],[134,1],[72,2],[1,24],[70,1]];
// Canonical reviewed source-space ledger; nothing is supplied by an option or ROI file.
const seams=[
 [1,[[534,350],[541,352],[552,353],[560,352],[565,350],[569,347]],374,695,556],
 [3,[[1523,343],[1528,345],[1534,346],[1544,346],[1550,345],[1557,343]],368,722,597],
 [5,[[537,783],[543,784],[553,785],[563,784],[569,782],[573,777]],809,824,631],
 [7,[[1538,787],[1542,791],[1550,794],[1560,795],[1567,795],[1575,795]],816,755,571]
];
const points=v=>({x:v[0],y:v[1],width:v[2],height:v[3]});
export function applyExactAlderLobes({source,art,overlayBytes,packNative}){
 assert.equal(hash(overlayBytes),'4b308f82604d19fb9421dc5ef02967b8bb70d003205970447a1da51467da8144','Alder frozen controls mismatch');
 for(const [role,digest] of Object.entries(packedPins))
  assert.equal(hash(packNative(art['catalog-alder-clover-2005-'+role])),digest,'Alder original packed '+role+' mismatch');
 const n=art['catalog-alder-clover-2005-body'];
 assert.deepEqual([source.width,source.height],[1774,887]);
 assert.deepEqual([n.width,n.height,n.frames.length],[562,245,8]);
 const prepared=prepareCarSheet(source);
 assert.deepEqual(prepared.crops,crops.map(points),'Alder original source crops mismatch');
 const bounds=crops.map((v,i)=>points([...pads[i],v[2],v[3]]));
 assert.deepEqual(n.frameBounds,bounds,'Alder original prepared pad mismatch');
 const frames=n.frames.map(f=>f.slice()), touched=new Set();let total=0;
 const visible=new Array(8).fill(0),raw=new Array(8).fill(0);
 for(const [slot,pts,end,count,wanted] of seams){
  const c=points(crops[slot]),p=bounds[slot];
  for(const [[x0,y0],[x1,y1]] of pts.slice(0,-1).map((v,i)=>[v,pts[i+1]])){
   for(let x=x0;x<=(x1===pts.at(-1)[0]?x1:x1-1);x++){
    // Exact integer inequality equivalent to y > interpolated seam.
    for(let y=Math.min(y0,y1)+1;y<=end;y++){
     if((y-y0)*(x1-x0)<=(x-x0)*(y1-y0))continue;
     const k=y*source.width+x,a=source.data[k*4+3];
     if(!a)continue;
     assert.ok(!touched.has(k),'Alder masks overlap'); touched.add(k);raw[slot]++;total++;
     if(x<c.x||x>=c.x+c.width||y<c.y||y>=c.y+c.height){assert.ok(a<=prepared.alphaThreshold,'Alder visible selection outside original crop');continue;}
     const i=(p.y+y-c.y)*n.width+p.x+x-c.x;
     if(a<=prepared.alphaThreshold){assert.equal(frames[slot][i],null);continue;}
     const rgba=Array.from(source.data.subarray(k*4,k*4+4));
     const old='#'+(a===255?rgba.slice(0,3):rgba).map(v=>v.toString(16).padStart(2,'0')).join('');
     assert.equal(frames[slot][i],old,'Alder source to prepared ROI/padding mismatch');
     frames[slot][i]=null;visible[slot]++;
    }
   }
  }
  assert.equal(raw[slot],count);assert.equal(visible[slot],wanted);
 }
 assert.equal(total,2996);assert.ok(total<=3147);
 const out={...n,frames};
 assert.equal(hash(JSON.stringify(out)),decodedPin,'Alder decoded native output mismatch');
 const packed=hash(packNative(out));assert.equal(packed,packedPin,'Alder Node-packed output mismatch');
 art['catalog-alder-clover-2005-body']=out;
 return {sourcePixels:total,unchangedBudget:3147,rawByFrame:raw,nativeByFrame:visible,decodedSha256:decodedPin,packedSha256:packed};
}
