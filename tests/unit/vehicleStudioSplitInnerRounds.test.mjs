import test from 'node:test';
import assert from 'node:assert/strict';
import {createVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {makeOpenings,emitOpenings} from '../../src/ui/vehicleStudio/optics.mjs';

const withOptics=on=>{
 const v=createVehicle('coupe');
 Object.assign(v.optics.rear,{housing:'dual-round',layout:'round-stack',height:.66,width:.78,physicalDiameter:.126,position:.31,outboard:.87,splitInnerRounds:on});
 const g=loadVehicle(JSON.stringify(v)),surface=(u,v)=>[(u-.5)*1.38,.81-v*.48,2*(u-.5)**2-1.65],openingParts=[];
 const openings=makeOpenings({end:'rear',g,face:surface,segments:12});
 const {mounts,issues}=emitOpenings({end:'rear',openings,surface,put:(c,m,geometry)=>openingParts.push({component:c,mat:m,p:Array.from(geometry.attributes.position.array)})});
 assert.equal(issues.length,0);
 return {mounts,openingParts,shape:openings.filter(x=>x.kind==='lamp').map(x=>x.outline)};
};
test('optional split inner rounds only use the inner pair for amber and reverse, without moving mounts or apertures',()=>{
 const old=withOptics(0),opt=withOptics(1);
 assert.equal(opt.shape.length,4);
 assert.deepEqual(old.shape,opt.shape);
 assert.deepEqual(old.mounts,opt.mounts);
 const centers=(m,k,abs=false)=>{const a=opt.openingParts.find(x=>x.mat===m).p.filter((_,i)=>i%3===k).map(v=>abs?Math.abs(v):v);return a.reduce((acc,x)=>acc+x,0)/a.length;};
 assert.ok(centers('signalL',0)<-.10&&centers('signalR',0)>.10);
 assert.ok(centers('signalL',1)>centers('opticClear',1));
 assert.ok(centers('opticClear',0,true)<centers('opticRed',0,true));
 assert.ok(centers('opticClear',0,true)<centers('runningRed',0,true));
});
