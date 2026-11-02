import test from 'node:test';
import assert from 'node:assert/strict';
import {ChassisBodyCollision} from '../../src/racing/simulation/ChassisBodyCollision.js';
import {quaternionFromEuler} from '../../src/racing/simulation/RigidBodyMath.js';
const config={massKg:1450,bodyLengthM:4.6,bodyWidthM:1.84,bodyHeightM:1.46,bodyGroundClearanceM:.12,cgHeightM:.55,pitchInertiaKgM2:2100,yawInertiaKgM2:2500,rollInertiaKgM2:980};
test('adaptive contact budget preserves the ordered prefix of contacts and stops pair checks early',()=>{
 for(const tilt of [0,.5,Math.PI]){
  const collision=new ChassisBodyCollision(config);
  const pose={position:{x:0,y:.55,z:0},orientation:quaternionFromEuler(tilt,.2,.3)};
  const counts={};const sample=(limit)=>collision.getAdaptiveSupportWorldUnprofiled(pose,{
   adaptiveBodySupport:true,bodySupportMaximumAdaptiveSamples:limit,
   physicsCostAccounting:{count(name,value){counts[limit]=(counts[limit]||0)+value;}},
   sampleTerrainAtWorldPoint:p=>({heightM:Math.sin(p.x*20)*.4,normal:{x:0,y:1,z:0}})
  });
  const limited=sample(4),full=sample(32);
  const added=result=>result.filter(e=>e.candidate.adaptive);
  assert.equal(added(limited).length,4);
  assert.deepEqual(added(limited),added(full).slice(0,4));
  assert.deepEqual(limited.filter(e=>!e.candidate.adaptive),full.filter(e=>!e.candidate.adaptive));
  assert.ok(counts[4]<counts[32]);
 }
});

test('support selection cache is exact across translations, tiny rotations and different cars',async()=>{
 const {createPhysicsTerrainQueryFrameCache}=await import('../../src/racing/simulation/PhysicsTerrainQueryFrame.js');
 const frame=createPhysicsTerrainQueryFrameCache().begin({bounds:{minX:-10,maxX:10,minZ:-10,maxZ:10}});
 const buffer=frame.acquireBodySupportBuffer();
 const collision=new ChassisBodyCollision({bodyLengthM:4.6,bodyWidthM:1.84,bodyHeightM:1.46,cgHeightM:.55});
 const pose={position:{x:0,y:.5,z:0},orientation:{x:0,y:0,z:0,w:1}};
 let hits=0;const costs={count(name){if(name==='bodySupportCandidateCacheHits')hits++;}};
 const original=[...collision.getSupportCandidates(pose,buffer,costs)];
 const uncached=()=>{
  buffer.supportCandidateOwner=null;
  return [...collision.getSupportCandidates(pose,buffer)];
 };
 pose.position={x:20,y:2,z:-10};
 assert.deepEqual(collision.getSupportCandidates(pose,buffer,costs),original);assert.equal(hits,1);
 for(const rotation of [{x:1e-10,y:0,z:0,w:1},{x:.1,y:.2,z:.3,w:.9},{x:0,y:0,z:1,w:0}]){
  pose.orientation=rotation;
  const actual=[...collision.getSupportCandidates(pose,buffer,costs)];
  assert.equal(hits,1,'every exact orientation change invalidates selection');
  assert.deepEqual(actual,uncached());
 }
 const other=new ChassisBodyCollision({bodyLengthM:7,bodyWidthM:2.5,bodyHeightM:2,cgHeightM:.8});
 const actual=[...other.getSupportCandidates(pose,buffer,costs)];
 assert.equal(hits,1,'another car cannot reuse the prior selection');
 buffer.supportCandidateOwner=null;
 assert.deepEqual(actual,other.getSupportCandidates(pose,buffer));
 frame.releaseBodySupportBuffer(buffer);
});

test('cached support selection preserves complete prepared-terrain penetration reports',async()=>{
 const {createPhysicsTerrainQueryFrameCache}=await import('../../src/racing/simulation/PhysicsTerrainQueryFrame.js');
 const {buildRaceBakedSurfaceSampler}=await import('../../src/racing/RaceBakedSurfaceSampler.js');
 const p=(x,z)=>({x,z,elevation:.08*x+.06*z});
 const sampler=buildRaceBakedSurfaceSampler({elevationScaleM:1,mesh:{triangles:[
  {region:'road',vertices:[p(-5,-5),p(5,-5),p(5,5)]},
  {region:'road',vertices:[p(-5,-5),p(5,5),p(-5,5)]}
 ]}});
 let hits=0;
 const make=()=>{
  const collision=new ChassisBodyCollision(config);
  const frame=createPhysicsTerrainQueryFrameCache().begin({sampler,elevationScaleM:1,bounds:{minX:-5,maxX:5,minZ:-5,maxZ:5}});
  const environment={physicsTerrainQueryFrame:frame,adaptiveBodySupport:true,
   physicsCostAccounting:{count(name){if(name==='bodySupportCandidateCacheHits')hits++;}},
   sampleTerrainAtWorldPoint:(point,query={})=>frame.samplePoint(point,query.target||undefined)};
  return {collision,environment};
 };
 const cached=make(),reference=make();
 const select=reference.collision.getSupportCandidates;
 reference.collision.getSupportCandidates=function(pose,buffer,costs){if(buffer)buffer.supportCandidateOwner=null;return select.call(this,pose,buffer,costs);};
 for(const roll of [0,.3,Math.PI])for(const pitch of [0,-.2])for(let i=0;i<8;i++){
  const pose={position:{x:i*.03,y:-.1+i*.2,z:-i*.02},orientation:quaternionFromEuler({pitch,roll})};
  assert.deepEqual(cached.collision.samplePosePenetrationUnprofiled(pose,cached.environment,.008),
   reference.collision.samplePosePenetrationUnprofiled(pose,reference.environment,.008));
 }
 assert.ok(hits>0,'comparison exercises cached selections');
});

test('penetration cache does not cross independent terrain frames with the same sequence',async()=>{
 const {createPhysicsTerrainQueryFrameCache}=await import('../../src/racing/simulation/PhysicsTerrainQueryFrame.js');
 const collision=new ChassisBodyCollision(config);
 const pose={position:{x:0,y:.55,z:0},orientation:{x:0,y:0,z:0,w:1}};
 const first=createPhysicsTerrainQueryFrameCache().begin({bounds:{minX:-10,maxX:10,minZ:-10,maxZ:10}});
 const second=createPhysicsTerrainQueryFrameCache().begin({bounds:{minX:-10,maxX:10,minZ:-10,maxZ:10}});
 assert.equal(first.sequence,second.sequence);
 let evaluations=0;
 collision.samplePosePenetrationUnprofiled=(_pose,env)=>{
  evaluations++;
  return {maximumPenetrationM:env.physicsTerrainQueryFrame===first?0:.4};
 };
 const query=frame=>collision.samplePosePenetration(pose,{physicsTerrainQueryFrame:frame},.01);
 assert.equal(query(first).maximumPenetrationM,0);
 query(first);assert.equal(evaluations,1,'same frame still reuses the result');
 assert.equal(query(second).maximumPenetrationM,.4,'new terrain frame must be evaluated');
 assert.equal(evaluations,2);
 query(second);assert.equal(evaluations,2);
 query(first);assert.equal(evaluations,3,'returning to another frame invalidates the cache');
 first.begin({bounds:{minX:-10,maxX:10,minZ:-10,maxZ:10}});query(first);assert.equal(evaluations,4,'new sequence still invalidates');
});
