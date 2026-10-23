import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRaceNetworkGeometry} from '../../src/racing/RaceNetworkGeometry.js';
import {normalizeRaceRouteNetwork} from '../../src/racing/RaceRouteNetwork.js';
import {buildNetworkMarkings} from '../../src/racing/RaceNetworkMarkings.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const network=()=>normalizeRaceRouteNetwork({nodes:[{id:'a',x:0,z:0,heightM:0},{id:'b',x:0,z:100,heightM:0},{id:'c',x:100,z:100,heightM:10}],edges:[{id:'ab',from:'a',to:'b',widthM:3.6},{id:'bc',from:'b',to:'c',widthM:3.6,structure:'bridge'}],startNodeId:'a'});
test('network markings default to visible white dashes, two edge strips and posts on every branch',()=>{
 const geometry=buildRaceNetworkGeometry(network()),posts=[];
 const marks=buildNetworkMarkings(geometry.paths,{posts:(p,yaw)=>{posts.push(p);return [{points:[p],yaw}];}});
 assert.ok(marks.roadPaintMeshes.length>10);assert.ok(marks.roadPaintMeshes.every(m=>m.color==='#ffffff'&&m.threeLiftM>0));
 assert.ok(marks.boundaryMeshes.some(m=>m.source==='boundary-right-network'));
 assert.ok(marks.boundaryMeshes.some(m=>m.source==='boundary-left-network'));
 for(const m of marks.boundaryMeshes)assert.ok(Math.hypot(m.points[0].x-m.points[1].x,m.points[0].z-m.points[1].z)>.2);
 assert.ok(posts.some(p=>p.x>40));assert.ok(posts.some(p=>p.elevation>0));
 assert.ok(marks.roadPaintMeshes.some(m=>m.points.some(p=>p.elevation>.2)));
});
test('network static renderer includes apron artwork, white paint and raised markers on narrow starter roads',()=>{
 const e=new RaceEditor({});e.selectedRace.road.network=network();e.selectedRace.margin.artRef='apron';
 const g=buildRaceNetworkGeometry(e.selectedRace.road.network),bake={key:'markings',terrainTopology:'route-network',runtimeType:'destination',routeLength:200,mesh:g.mesh,structureMeshes:g.structureMeshes,surfaceBake:{sections:g.paths.flatMap(p=>p.sections),paths:g.paths}};
 const meshes=e.getRaceStaticTrackSurfaceMeshes(bake);
 assert.ok(meshes.boundaryMeshes.some(m=>m.source==='boundary-right-network'&&m.artRef==='apron'&&m.textured));
 assert.ok(meshes.roadPaintMeshes.length);assert.ok(meshes.trackFurnitureMeshes.some(m=>m.source==='quarter-mile-post'));
 assert.equal(e.shouldRenderRaceCenterLaneDash({roadWidthM:3.6}),true);
 assert.equal(e.getRaceStaticTrackSurfaceMeshes(bake),meshes);
});
test('hiding margins does not hide lane paint or roadside markers',()=>{
 const {paths}=buildRaceNetworkGeometry(network()),marks=buildNetworkMarkings(paths,{marginVisible:false,posts:p=>[{points:[p]}]});
 assert.equal(marks.boundaryMeshes.length,0);assert.ok(marks.roadPaintMeshes.length);assert.ok(marks.trackFurnitureMeshes.length);
});
