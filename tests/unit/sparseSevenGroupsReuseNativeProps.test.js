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
import { hydrateProjectFile } from '../../src/ui/serverStorage.js';

const refs=["expanded-high-tension-power-pylon", "expanded-highway-sign-gantry", "expanded-network-node", "roadside-traffic-cone", "expanded-abandoned-civic-center", "ohio-river-crossing-flood-marker"];
const tests=[
  [
    "World Wide Technology Raceway \u2014 oval",
    "infrastructure-v1-pylon-520",
    "expanded-high-tension-power-pylon",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    1572
  ],
  [
    "World Wide Technology Raceway \u2014 oval",
    "infrastructure-v1-pylon-780",
    "expanded-high-tension-power-pylon",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    1572
  ],
  [
    "World Wide Technology Raceway \u2014 oval",
    "infrastructure-v1-pylon-1300",
    "expanded-high-tension-power-pylon",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    1572
  ],
  [
    "World Wide Technology Raceway \u2014 oval",
    "side-h06-s02-prop-4",
    "expanded-highway-sign-gantry",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    372
  ],
  [
    "World Wide Technology Raceway \u2014 oval",
    "side-h06-s02-prop-26",
    "expanded-highway-sign-gantry",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    372
  ],
  [
    "World Wide Technology Raceway \u2014 oval",
    "side-h06-s02-prop-74",
    "expanded-highway-sign-gantry",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    372
  ],
  [
    "World Wide Technology Raceway \u2014 oval",
    "side-h06-s02-prop-76",
    "expanded-highway-sign-gantry",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    372
  ],
  [
    "Road America \u2014 The Bend",
    "infrastructure-v1-pylon-780",
    "expanded-high-tension-power-pylon",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    1572
  ],
  [
    "Road America \u2014 The Bend",
    "infrastructure-v1-pylon-1040",
    "expanded-high-tension-power-pylon",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    1572
  ],
  [
    "Road America \u2014 The Bend",
    "raceway-road-america-bend-prop-29",
    "expanded-network-node",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    492
  ],
  [
    "Road America \u2014 The Bend",
    "raceway-road-america-bend-prop-48",
    "expanded-network-node",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    492
  ],
  [
    "Road America \u2014 The Bend",
    "raceway-road-america-bend-prop-118",
    "expanded-network-node",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    492
  ],
  [
    "Road America \u2014 The Bend",
    "raceway-road-america-bend-prop-213",
    "expanded-network-node",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    492
  ],
  [
    "Road America \u2014 The Bend",
    "raceway-road-america-bend-prop-219",
    "expanded-network-node",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    492
  ],
  [
    "Gateway Kartplex \u2014 WWT complex",
    "side-h06-s08-prop-15",
    "roadside-traffic-cone",
    "fly-off",
    15,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 36864,
      "transparent": 0
    },
    126
  ],
  [
    "Gateway Kartplex \u2014 WWT complex",
    "side-h06-s08-prop-23",
    "roadside-traffic-cone",
    "fly-off",
    15,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 36864,
      "transparent": 0
    },
    126
  ],
  [
    "Gateway Kartplex \u2014 WWT complex",
    "side-h06-s08-prop-13",
    "expanded-abandoned-civic-center",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 262144,
      "transparent": 0
    },
    1304
  ],
  [
    "Gateway Kartplex \u2014 WWT complex",
    "side-h06-s08-prop-26",
    "expanded-abandoned-civic-center",
    "collide",
    100000,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 262144,
      "transparent": 0
    },
    1304
  ],
  [
    "Mid-Ohio Sports Car Course \u2014 Chicane Course",
    "raceway-mid-ohio-chicane-prop-5",
    "ohio-river-crossing-flood-marker",
    "fly-off",
    3,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    172
  ],
  [
    "Mid-Ohio Sports Car Course \u2014 Chicane Course",
    "raceway-mid-ohio-chicane-prop-18",
    "ohio-river-crossing-flood-marker",
    "fly-off",
    3,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    172
  ],
  [
    "Mid-Ohio Sports Car Course \u2014 Chicane Course",
    "raceway-mid-ohio-chicane-prop-21",
    "ohio-river-crossing-flood-marker",
    "fly-off",
    3,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    172
  ],
  [
    "Mid-Ohio Sports Car Course \u2014 Chicane Course",
    "raceway-mid-ohio-chicane-prop-23",
    "ohio-river-crossing-flood-marker",
    "fly-off",
    3,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    172
  ],
  [
    "Mid-Ohio Sports Car Course \u2014 Chicane Course",
    "raceway-mid-ohio-chicane-prop-56",
    "ohio-river-crossing-flood-marker",
    "fly-off",
    3,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    172
  ],
  [
    "Mid-Ohio Sports Car Course \u2014 Chicane Course",
    "raceway-mid-ohio-chicane-prop-72",
    "ohio-river-crossing-flood-marker",
    "fly-off",
    3,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    172
  ],
  [
    "Mid-Ohio Sports Car Course \u2014 Chicane Course",
    "raceway-mid-ohio-chicane-prop-102",
    "ohio-river-crossing-flood-marker",
    "fly-off",
    3,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    172
  ],
  [
    "Mid-Ohio Sports Car Course \u2014 Chicane Course",
    "raceway-mid-ohio-chicane-prop-103",
    "ohio-river-crossing-flood-marker",
    "fly-off",
    3,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    172
  ],
  [
    "Mid-Ohio Sports Car Course \u2014 Chicane Course",
    "raceway-mid-ohio-chicane-prop-108",
    "ohio-river-crossing-flood-marker",
    "fly-off",
    3,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    172
  ],
  [
    "Mid-Ohio Sports Car Course \u2014 Chicane Course",
    "raceway-mid-ohio-chicane-prop-134",
    "ohio-river-crossing-flood-marker",
    "fly-off",
    3,
    [
      0,
      3.141592653589793,
      0
    ],
    {
      "opaque": 65536,
      "transparent": 0
    },
    172
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

test('twenty-eight saved WWT, Road America and Mid-Ohio placements preserve native fit, raster fallback and original contact', async () => {
  const originalFetch=globalThis.fetch, fetches=[];
  let missedModel=null; const nativeByRef=new Map();
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
      delete baseline.previewDoodad.model;
      const a=editorFor(route,baseline), b=editorFor(route,sprite);
      const oldWorld=prepareRaceStartupCollisionWorld(a.e), newWorld=prepareRaceStartupCollisionWorld(b.e);
      assert.deepEqual(oldWorld?.colliders,newWorld?.colliders);
      if(behavior==='collide'){
        assert.equal(newWorld.colliders.length,1);
        assert.equal(newWorld.colliders[0].source,`scenery:${id}`);
      }else assert.equal(newWorld,null,'fly-off props must not become solid model-size colliders');
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
        'native appearance cannot exceed the configured exact footprint');
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
      if(!nativeByRef.has(ref3d)) {
        missedModel=ref3d;
        await assert.rejects(modelAssets.prepare(ref3d));
        assert.equal(b.e.addRaceThreeDoodads(render),true);
        assert.deepEqual(collect(),{native:[],raster:[ref]});
        missedModel=null;
      }
      const fetchesBeforeWarmReuse=fetches.length;
      const model=await modelAssets.prepare(ref3d);
      if(nativeByRef.has(ref3d)) {
        assert.equal(model,nativeByRef.get(ref3d),'repeat shares exact model asset');
        assert.equal(fetches.length,fetchesBeforeWarmReuse,'repeat placement must not refetch it');
      } else nativeByRef.set(ref3d,model);
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
      assert.equal(renderedTris,expectedTris,'must retain the exact reused model geometry');
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
      if(behavior==='fly-off'){
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
    for(const path of ["data/server-storage/files/races/World Wide Technology Raceway %E2%80%94 oval/document.json", "data/server-storage/files/races/Road America %E2%80%94 The Bend/document.json", "data/server-storage/files/races/Gateway Kartplex %E2%80%94 WWT complex/document.json", "data/server-storage/files/races/Mid-Ohio Sports Car Course %E2%80%94 Chicane Course/document.json"])assert.ok(fetches.includes(path));
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
