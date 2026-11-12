import test from 'node:test';
import RaceEditor from '../../src/ui/RaceEditor.js';
import assert from 'node:assert/strict';
import {doodadAlphaBounds,doodadVisualLayout} from '../../src/racing/RaceDoodadVisualBounds.js';
import {buildDistantScenery} from '../../tools/campaigns/distant_scenery.mjs';
function canvas(){const data=new Uint8ClampedArray(10*10*4);for(let y=2;y<8;y++)for(let x=3;x<7;x++)data[(y*10+x)*4+3]=255;let reads=0;return {width:10,height:10,get reads(){return reads;},getContext:()=>({getImageData:()=>{reads++;return {data};}})};}
test('alpha bounds cache and crop preserve pixel scale and remove padding compensation once',()=>{
 const c=canvas(),d={widthM:10,heightM:10,groundOffsetM:2,hitboxWidthM:1};
 const v=doodadVisualLayout(d,c);
 assert.equal(v.widthM,4);assert.equal(v.heightM,6);assert.ok(Math.abs(v.groundOffsetM)<1e-10);assert.equal(d.hitboxWidthM,1);
 assert.equal(v.u0,.3);assert.equal(v.u1,.7);assert.ok(Math.abs(v.v0-.2)<1e-10);assert.equal(v.v1,.8);
 doodadAlphaBounds(c);assert.equal(c.reads,1);c.__raceArtCacheKey='edited';doodadAlphaBounds(c);assert.equal(c.reads,2);
 assert.ok(Math.abs(doodadVisualLayout({...d,groundOffsetM:3},c).groundOffsetM-1)<1e-10);
 assert.equal(doodadVisualLayout({...d,groundOffsetM:-1},c).groundOffsetM,-1);
});
test('fences, models and unavailable images retain their original geometry',()=>{
 const d={widthM:10,heightM:10,groundOffsetM:2},c=canvas();
 for(const v of [doodadVisualLayout(d,c,{fence:true}),doodadVisualLayout({...d,model:{ref:'a'}},c),doodadVisualLayout(d,null)]){assert.equal(v.widthM,10);assert.equal(v.heightM,10);assert.equal(v.crop,null);}
});
test('distant placement is deterministic, within terrain, and clear of neighboring road segments',()=>{
 const args={key:'test',length:1000,config:{count:60,clusterSize:3,bands:[[90,150],[220,330]],refs:[['tree'],['rock']]},bounds:{minX:-350,maxX:350,minZ:0,maxZ:1000},pose:d=>({x:0,z:d,yaw:0}),project:p=>({distance:p.z,lateral:Math.abs(p.x-110)<30?20:p.x}),definition:name=>({id:name,artRef:name,widthM:8,heightM:10,hitboxWidthM:1,defaultRule:{behavior:'collide'}})};
 const a=buildDistantScenery(args);assert.deepEqual(a,buildDistantScenery(args));assert.ok(a.length>20);
 for(const p of a){assert.ok(Math.abs(p.trackLateral)>=65);assert.ok(p.x-p.widthM/2>=-350&&p.x+p.widthM/2<=350);assert.ok(p.z>=0&&p.z<=1000);assert.ok(['tree','rock'].includes(p.artRef));}
});

test('cropped billboards stand at their root on a hillside while fence endpoints follow terrain',()=>{
 const c=canvas(),def={widthM:10,heightM:10,groundOffsetM:2,artRef:'tree',hitboxWidthM:1};
 const editor={getRaceDoodadForScenery:()=>def,getRaceArtSpriteCanvas:()=>c,
  getRaceDoodadVisualLayout:RaceEditor.prototype.getRaceDoodadVisualLayout,
  getRaceRightVector:()=>({x:1,z:0}),sampleRaceDoodadGroundPoint:(x,z,s,d)=>({x,z,elevation:x*.1-d.groundOffsetM/12})};
 const quad=RaceEditor.prototype.getRaceDoodadWorldQuad.call(editor,{x:5,z:0});
 assert.equal(quad.widthM,4);assert.equal(quad.heightM,6);
 assert.equal(quad.points[2].elevation,quad.points[3].elevation);
 assert.equal(def.hitboxWidthM,1);assert.equal(def.widthM,10);
 const fence=RaceEditor.prototype.getRaceDoodadWorldQuad.call(editor,{x:5,z:0,fenceId:'f'});
 assert.equal(fence.widthM,10);assert.notEqual(fence.points[2].elevation,fence.points[3].elevation);
});

test('upright scenery uses the lowest point under its base, including interior dips',()=>{
 const def={widthM:12,heightM:10,groundOffsetM:0,artRef:'barn'};
 const sample=(x,z)=>({x,z,elevation:Math.abs(x-2)<.01?-2:x*.1});
 const editor={getRaceDoodadForScenery:()=>def,getRaceDoodadVisualLayout:()=>({...def,crop:null,u0:0,u1:1,v0:0,v1:1}),getRaceRightVector:()=>({x:1,z:0}),sampleRaceDoodadGroundPoint:sample};
 const quad=RaceEditor.prototype.getRaceDoodadWorldQuad.call(editor,{x:0,z:0});
 assert.equal(quad.points[2].elevation,-2);assert.equal(quad.points[3].elevation,-2);
 assert.ok(Math.abs(quad.points[0].elevation-quad.points[3].elevation-10/12)<1e-12);
});
