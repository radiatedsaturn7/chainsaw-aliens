import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const angles=[0,45,90,135,180,225,270,315],w=256,h=144;
export const sha=b=>createHash('sha256').update(b).digest('hex');
export function dimensions(b){
 assert.equal(b.toString('ascii',0,4),'RIFF');
 assert.equal(b.toString('ascii',8,12),'WEBP');
 assert.equal(b.readUInt32LE(4)+8,b.length);
 for(let i=12;i+8<=b.length;){
  const tag=b.toString('ascii',i,i+4),sz=b.readUInt32LE(i+4),p=i+8;
  assert(p+sz<=b.length);
  if(tag==='VP8X')return [1+b.readUIntLE(p+4,3),1+b.readUIntLE(p+7,3)];
  if(tag==='VP8L'){assert.equal(b[p],0x2f);const size=b.readUInt32LE(p+1);return [1+(size&0x3fff),1+((size>>>14)&0x3fff)];}
  if(tag==='VP8 '){assert.deepEqual([...b.subarray(p+3,p+6)],[0x9d,0x01,0x2a]);return [b.readUInt16LE(p+6)&0x3fff,b.readUInt16LE(p+8)&0x3fff];}
  i=p+sz+(sz%2);
 }
 throw Error('Missing VP8 image chunk');
}
export function validateOutput({atlas,poster,id,deps,rendererPins}){
 assert.deepEqual(dimensions(atlas),[2048,144]);
 assert.deepEqual(dimensions(poster),[256,144]);
 assert.notEqual(sha(atlas),sha(poster));
 assert(/^[a-z0-9-]+$/.test(id));
 assert(deps.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
 assert.equal(new Set(deps.map(x=>x.folder+'/'+x.name)).size,deps.length);
 assert.equal(deps.filter(x=>x.folder==='cars').length,1);
 const sourceSha256=sha(JSON.stringify({renderer:'menu-native-v1',rendererPins,angles,w,h,quality:.90,stockSources:deps}));
 const file='assets/car-previews/'+id+'-'+sourceSha256.slice(0,15);
 return {bytes:atlas.length,carDocumentSha256:deps.find(x=>x.folder==='cars').sha256,carId:id,frameCount:8,frameHeight:h,frameWidth:w,mimeType:'image/webp',poster:{angleDeg:135,frameIndex:3,frameWidth:w,frameHeight:h,mimeType:'image/webp',bytes:poster.length,sha256:sha(poster),url:file+'-poster.webp'},sha256:sha(atlas),sourceSha256,stockSources:deps,url:file+'.webp'};
}
