import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import * as THREE from '../../src/vendorBridge/three.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { modelAssets } from '../../src/model3d/ModelAssets.js';
import { prepareManagedRaceScenery } from '../../src/racing/RaceVisibleScenery.js';
import { prepareRaceStartupCollisionWorld } from '../../src/racing/RaceSimulation.js';
import { normalizeRaceDoodadDocument } from '../../src/racing/raceDoodads.js';
import { hydrateProjectFile } from '../../src/ui/serverStorage.js';

const refs=["oak-creek-red-rock-formation"];
const tests=[
  [
    "Oak Creek Canyon",
    "coverage-v1-prop-0-0",
    "oak-creek-red-rock-formation",
    "collide",
    1000,
    [
      0,
      3.141592653589793,
      0
    ],
    null,
    2801
  ]
];
const root = fileURLToPath(new URL('../../', import.meta.url));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 2e-6, `${actual} != ${expected}`);
function editorFor(race, sprite) {
  const e = new RaceEditor({}), impulses = [], damages = [];
  e.project.races = [{ ...race, road: null, staticColliders: [], scenery: [sprite] }];
  e.project.selectedRaceId = race.id;
  e.getRacePathSamplesCached = () => [];
  e.getRaceSessionCar = () => ({});
  e.getRaceCarTuning = () => ({});
  e.getRaceSurfaceGeometryRevisionKey = () => 'roadside-static-test-slope';
  e.getRaceSurfaceModel = () => ({ sampleWorld: ({ x, z }) => ({ elevation: (x+z)*.0001 }) });
  e.ensureRaceMarginSettings=()=>({});
  e.getRaceVehicleCollisionContactPoints = () => [{ x: sprite.x + .2, y: 0, z: sprite.z, wheel: true }];
  e.applyRaceDamage = (...args) => damages.push(args);
  e.playtestSession = { running:true, routeRuntimeType:'circuit', routeLength:100, elapsedMs:200,
    speedMps:15, groundSpeedMps:15, carYaw:sprite.yaw, removedSceneryIds:[], flattenedSceneryIds:[],
    vehicleDynamicsRunner: { state:{ position:{}, velocity:{x:8,z:13} }, config:{massKg:1200},
      queueCollisionImpulse: impulse => impulses.push(impulse) }};
  prepareManagedRaceScenery(e.ensureRaceScenery(),e.playtestSession);
  return {e,impulses,damages};
}

test('the Oak Creek red sandstone retains original collision and fallback with an exact embedded-winner overlay', async () => {
  const originalFetch=globalThis.fetch, fetches=[];
  let missedModel=null;const exercisedRetry=new Set();
  globalThis.fetch=async request=>{
    const url=new URL(typeof request === 'string' ? request : request.url,'https://static.fixture');
    if(url.pathname.startsWith("/__storage"))return new Response("not on static host",{status:404});
    assert.ok(url.pathname.startsWith('/data/server-storage/files/'));
    const path=url.pathname.slice(1).split('/').map(decodeURIComponent).join('/');
    fetches.push(path);
    if(path.endsWith(`/models/${missedModel}/document.json`)) return new Response('missing for fixture', {status:404});
    try{return new Response(await readFile(join(root,path)), {headers:{'Content-Type':'application/json'}});}
    catch(error){if(error.code!=='ENOENT')throw error;return new Response(null,{status:404});}
  };
  const renderers=[];
  try {
    const docs = new Map(), canvases = new Map();
    for(const [label,id,ref,behavior,weight,rotation,expectedAlpha,expectedTris] of tests){
      if(!docs.has(label))docs.set(label,(await hydrateProjectFile('races',label,{hydrateDependencies:false})).data.race);
      const route=docs.get(label), sprite=route.scenery.find(p=>p.id===id);
      assert.equal(sprite.previewDoodad.model.ref,ref+'-3d');
      assert.deepEqual(sprite.previewDoodad.model.rotation,rotation);
      assert.equal(sprite.previewDoodad.artRef,ref);
      assert.equal(sprite.previewDoodad.defaultRule.behavior,behavior);
      assert.equal(sprite.previewDoodad.weightKg,weight);
      assert.ok(!sprite.fenceId && !sprite.flipX);

      // Compare exact real physics entrypoints in two sessions with identical
      // contact, terrain, transforms and preview rules apart from the model.
      const baseline = {...sprite,previewDoodad:{...sprite.previewDoodad}};
      delete baseline.previewDoodad;
      const archive=(await hydrateProjectFile('doodads',ref,{hydrateDependencies:false})).data;
      const oldCanonical=normalizeRaceDoodadDocument(archive,ref);
      assert.deepEqual({...sprite.previewDoodad,model:null},oldCanonical);

      const a=editorFor(route,baseline), b=editorFor(route,sprite);
      const stockResolve=a.e.resolveRaceDoodadForScenery(baseline);
      assert.deepEqual(stockResolve,oldCanonical);
      assert.deepEqual({...b.e.resolveRaceDoodadForScenery(sprite),model:null},stockResolve);
      const oldWorld=prepareRaceStartupCollisionWorld(a.e), newWorld=prepareRaceStartupCollisionWorld(b.e);
      assert.deepEqual(oldWorld?.colliders,newWorld?.colliders);
      if(behavior==='collide'){
        assert.equal(newWorld.colliders.length,1);
        assert.equal(newWorld.colliders[0].source,`scenery:${id}`);
      }else assert.equal(newWorld,null,'flattenable props must not become solid model-size colliders');
      assert.deepEqual(b.e.getRaceDoodadHitboxWorldMeshes(sprite,{forceVisible:true}),
        a.e.getRaceDoodadHitboxWorldMeshes(baseline,{forceVisible:true}));

      if(!canvases.has(ref)){
        const { data } = await hydrateProjectFile('art',ref,{hydrateDependencies:false});
        const {width,height,frames}=data;
        assert.equal(frames.length,1);
        assert.equal(frames[0].length,width*height);
        const pixels=new Uint8Array(width*height*4);
        for(let i=0;i<frames[0].length;i++){
          const pixel=frames[0][i];
          if(pixel)pixels[i*4+3]=pixel.length===9?parseInt(pixel.slice(7,9),16):255;
        }
        canvases.set(ref,{width,height,__raceArtCacheKey:ref,getContext:()=>({getImageData:()=>({data:pixels})})});
      }
      const art=canvases.get(ref);
      const material=new THREE.MeshBasicMaterial();
      b.e.getRaceArtSpriteCanvas=a.e.getRaceArtSpriteCanvas=() => art;
      b.e.getRaceThreeDoodadMaterial=(_renderer, requested)=>{assert.equal(requested,ref);return material;};
      const {doodad: ignored1,sprite: ignored2,...oldQuad}=a.e.getRaceDoodadWorldQuad(baseline);
      const {doodad: ignored3,sprite: ignored4,...newQuad}=b.e.getRaceDoodadWorldQuad(sprite);
      assert.deepEqual(newQuad,oldQuad,'cold and warm must retain exact existing cropped footprint');
      assert.ok(newQuad.widthM<=sprite.previewDoodad.widthM && newQuad.heightM<=sprite.previewDoodad.heightM,
        'the native shape cannot exceed the configured exact footprint');
      const render={scene:new THREE.Scene()};
      renderers.push([b.e,render]);
      const ref3d=sprite.previewDoodad.model.ref;
      const collect=()=>{
        const native=[],raster=[];
        render.dynamicDoodadGroup?.traverse(o=>{
          if(o.userData.modelInstance)native.push(o);
          if(o.userData.sceneryArtRef)raster.push(o.userData.sceneryArtRef);
        });
        return {native,raster};
      };
      if(!modelAssets.entries.has(ref3d)){
        assert.equal(b.e.addRaceThreeDoodads(render),true);
        assert.deepEqual(collect(),{native:[],raster:[ref]});
      }
      if(!exercisedRetry.has(ref3d)) {
        exercisedRetry.add(ref3d);missedModel=ref3d;
        await assert.rejects(modelAssets.prepare(ref3d));
        assert.equal(b.e.addRaceThreeDoodads(render),true);
        assert.deepEqual(collect(),{native:[],raster:[ref]});
        missedModel=null;
      }
      const model=await modelAssets.prepare(ref3d);
      assert.equal(model.kind,'rtg-model');
      assert.equal(b.e.addRaceThreeDoodads(render),true);
      const warm=collect();
      assert.deepEqual(warm.raster,[]);
      assert.equal(warm.native.length,1);
      const holder=warm.native[0], instance=holder.userData.modelInstance;
      const alpha={transparent:0,opaque:0};
      const loadedMaterials=new Set();
      let renderedTris=0;
      instance.root.traverse(o=>{if(o.isMesh)renderedTris+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});
      assert.equal(renderedTris,expectedTris,'source-specific shape/triangles must survive native scene build');
      instance.root.traverse(o=>{if(o.isMesh)loadedMaterials.add(o.material);});
      for(const material of loadedMaterials){
        assert.equal(material.alphaTest,.01);
        const data=material.map.image.data;
        for(let n=3;n<data.length;n+=4){
          if(data[n]===255)alpha.opaque++;
          else {assert.equal(data[n],0);alpha.transparent++;}
        }
      }
      if(expectedAlpha)assert.deepEqual(alpha,expectedAlpha,'exact original cutout transparency must survive native runtime material');
      else {assert.equal(alpha.transparent,0);assert.ok(alpha.opaque>0);}
      assert.equal(holder.userData.spriteId,id);
      near(holder.position.x,sprite.x);near(holder.position.z,sprite.z);
      near(holder.rotation.y,sprite.yaw);
      near(holder.position.y,b.e.getRaceThreeElevationM(newQuad.points[2]));
      // Existing billboard u=1 is right on the textured front, which is
      // the saved yaw's local -Z side. Keep visual orientation (especially the
      // sign lettering and lens) without rotating the authored collider.
      const artRight = new THREE.Vector3(
        newQuad.points[1].x-newQuad.points[0].x,0,newQuad.points[1].z-newQuad.points[0].z).normalize();
      const yAxis = new THREE.Vector3(0,1,0);
      const modelYaw=holder.rotation.y+instance.root.rotation.y;
      near(artRight.dot(new THREE.Vector3(1,0,0).applyAxisAngle(yAxis,modelYaw)),rotation[1]===Math.PI?1:-1);
      const billboardReadableSide = new THREE.Vector3().crossVectors(artRight,yAxis);
      near(billboardReadableSide.dot(new THREE.Vector3(0,0,1).applyAxisAngle(yAxis,modelYaw)),rotation[1]===Math.PI?1:-1);
      holder.remove(instance.object);
      const box=new THREE.Box3().setFromObject(instance.object);
      holder.add(instance.object);
      const size=box.getSize(new THREE.Vector3());
      assert.ok(Math.abs(size.x-newQuad.widthM)<=Math.max(2e-6,1e-7*newQuad.widthM)); assert.ok(Math.abs(size.y-newQuad.heightM)<=Math.max(2e-6,1e-7*newQuad.heightM)); near(box.min.y,0);
      assert.equal(render.dynamicDoodadAnimations.length,0);
      // Saved transform carries a larger legacy envelope; the authoritative
      // old embedded definition provides the actually displayed cropped footprint.
      near(sprite.widthM,19.47354626950181);
      near(sprite.heightM,12.969686089648668);
      near(newQuad.widthM,10.510263929618768*473/512);
      near(newQuad.heightM,7*318/341);
      assert.ok(size.x<sprite.widthM&&size.y<sprite.heightM);
      assert.ok(Math.abs(size.z-7.002712249755859)<2e-5);
      holder.updateMatrixWorld(true);
      const road=route.road.nodes;
      const L=[0];
      let q=null;
      for(let j=1;j<road.length;j++){
        const p=road[j-1],r=road[j],x=r.x-p.x,z=r.y-p.y,v=x*x+z*z;
        L.push(L.at(-1)+Math.sqrt(v));
        if(v===0||sprite.trackDistance<L[j-1]-140||sprite.trackDistance>L[j]+140)continue;
        const u=Math.max(0,Math.min(1,((sprite.x-p.x)*x+(sprite.z-p.y)*z)/v));
        const gap=Math.hypot(p.x+u*x-sprite.x,p.y+u*z-sprite.z);
        if(!q||q.gap>gap)q={gap,m:L[j-1]+u*Math.sqrt(v)};
      }
      near(q.m,220.02259963336755);near(q.gap,36.45044955735239);
      assert.ok(q.gap-Math.hypot(size.x/2,size.z/2)>30,'road-centerline clearance includes worst visual extent and yaw');
      const aimM=q.m-32;
      const j=L.findIndex(m=>m>=aimM), routeFraction=(aimM-L[j-1])/(L[j]-L[j-1]);
      const P=road[j-1],R=road[j];
      const witness=new THREE.Vector3(P.x+(R.x-P.x)*routeFraction,holder.position.y+2,P.y+(R.y-P.y)*routeFraction);
      const off=witness.clone().sub(holder.position).applyAxisAngle(new THREE.Vector3(0,1,0),-modelYaw);
      near(Math.atan2(off.x,off.z)*180/Math.PI,52.39532190231975);
      const aim=new THREE.Vector3(sprite.x,holder.position.y+newQuad.heightM*.46,sprite.z);
      const ray=new THREE.Raycaster(witness,aim.sub(witness).normalize());
      assert.ok(ray.intersectObject(holder,true).length>0,'unoccluded geometry visible on saved route bearing');
      const projected=[];
      b.e.projectRaceWorldPointToCamera = point => ({ visible:true,screenX:320+point.x-sprite.x,
        screenY:240-point.elevation,elevation:point.elevation,cameraZ:20,renderZ:20 });
      b.e.drawRaceProjectedScenerySprites({save(){},restore(){},drawImage(...args){projected.push(args);}},
        {x:0,y:0,w:640,h:480});
      assert.equal(projected.length,1);
      assert.equal(projected[0][0],art);
      assert.equal(projected[0].length,9);

      a.e.updateRaceSceneryCollisions(1/60);
      b.e.updateRaceSceneryCollisions(1/60);
      assert.deepEqual(a.impulses,b.impulses);
      assert.deepEqual(a.damages,b.damages);
      assert.deepEqual(a.e.playtestSession.removedSceneryIds,b.e.playtestSession.removedSceneryIds);
      assert.deepEqual(a.e.playtestSession.flattenedSceneryIds,b.e.playtestSession.flattenedSceneryIds);
      if(behavior==='flatten'){
        assert.equal(b.impulses.length,1);
        assert.deepEqual(b.e.playtestSession.flattenedSceneryIds,[id]);
        assert.deepEqual(b.e.playtestSession.removedSceneryIds,[]);
        assert.equal(b.e.addRaceThreeDoodads(render),false);
        assert.deepEqual(collect(),{native:[],raster:[]});
      }else if(behavior==='fly-off'){
        assert.equal(b.impulses.length,1);
        assert.equal(b.damages.length,3);
        assert.deepEqual(b.e.playtestSession.removedSceneryIds,[id]);
        assert.equal(b.e.addRaceThreeDoodads(render),false);
        assert.deepEqual(collect(),{native:[],raster:[]});
      }else{
        assert.equal(b.impulses.length,0,'no secondary legacy impulse on solid physics obstacle');
        assert.equal(b.e.addRaceThreeDoodads(render),true);
      }
    }
    for(const path of ["data/server-storage/files/races/Oak Creek Canyon/document.json"])assert.ok(fetches.includes(path));
    assert.equal(exercisedRetry.size,refs.length);
    for(const ref of refs){
      const path=`models/${ref}-3d/document.json`;
      assert.ok(fetches.filter(p=>p.endsWith(path)).length>0);
    }
  } finally {
    for(const [e,renderer] of renderers)e.clearRaceThreeDynamicDoodads(renderer);
    globalThis.fetch=originalFetch;
    for(const ref of refs){
      modelAssets.entries.delete(ref+'-3d');modelAssets.errors.delete(ref+'-3d');
    }
  }
});
