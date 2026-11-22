import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../src/vendorBridge/three.js';
import {configureGarageModelCamera, GarageModelPreview, garageModelStance, usesGarageModelPreview} from '../../src/menus/GarageModelPreview.js';
import {drawCarComponent} from '../../src/menus/MenuCarStats.js';

const car={art:{bodyModel:{ref:'AARTG001 Body',position:[0,-.54033,-.2136]},threeModelWheels:true},
 dimensions:{widthM:1.83,trackFrontM:1.56,trackRearM:1.57,wheelbaseM:2.67}};
const pts=[[.78,.337,1.335],[-.78,.337,1.335],[.785,.337,-1.335],[-.785,.337,-1.335]];
const model={joints:['FL','FR','RL','RR'].map((n,i)=>({name:'WheelMount_'+n,position:pts[i]})),
 vertices:[], faces:[], materials:[], animations:[]};
test('garage model uses four editable wheels at the ground plane, with rear-biased stance',()=>{
 const s=garageModelStance(model,car);
 assert(s.pitch<0&&s.pitch>-.03&&s.shift>0);
 assert.equal(s.hubs.length,4);
 assert(s.hubs.every(h=>Math.abs(h.y-s.radius)<1e-10));
 assert(Math.abs(s.hubs[0].z-s.hubs[2].z-2.67)<1e-10);
 const gallery=new GarageModelPreview({library:{get:()=>model}});
 assert(gallery.prepare(car));
 assert.deepEqual(gallery.wheels.children.map(w=>w.name),['FL','FR','RL','RR'].map(n=>'garageModelWheel-'+n));
 for(const w of gallery.wheels.children)assert(Math.abs(new THREE.Box3().setFromObject(w).min.y)<1e-6,'unsupported wheel');
 const wheels=gallery.wheels.children[0];gallery.prepare(car);assert.equal(gallery.wheels.children[0],wheels);
 gallery.dispose();assert.equal(gallery.wheels.children.length,0);
});
test('fixed garage angle dynamically contains all visual bounds at desktop and portrait',()=>{
 const points=[-.95,.95].flatMap(x=>[0,2.42].flatMap(y=>[-2.52,2.52].map(z=>new THREE.Vector3(x,y,z))));
 const camera=new THREE.PerspectiveCamera(35,1,.03,80);
 const dir=new THREE.Vector3();
 for(const [w,h] of [[480,240],[220,300],[330,200]]){
  configureGarageModelCamera(camera,points,w,h);
  const projected=points.map(p=>p.clone().project(camera));
  assert(projected.every(p=>Math.abs(p.x)<.98&&Math.abs(p.y)<.98),'clipping');
  const d=camera.getWorldDirection(new THREE.Vector3());
  if(dir.length())assert(d.distanceTo(dir)<1e-10,'camera changed park bearing');else dir.copy(d);
 }
});
test('2D garage and non-garage selectors keep their prior route',()=>{
 assert(usesGarageModelPreview({id:'garage-preview'},car));
 assert(!usesGarageModelPreview({id:'garage-preview'},{art:{artRef:'sprite'}}));
 assert(!usesGarageModelPreview({id:'showroom-preview'},car));
 const calls=[];
 const resources={game:{carEditor:{getRaceCarProjectedArtRef(){calls.push('resolve-sprite');return {artRef:'sprite'};}}},
  carPreview:{drawSprite(){calls.push('2d');},drawGarageModel(){calls.push('garage-3d');}}};
 const ctx={save(){},restore(){}},widget={id:'garage-preview',type:'car-preview',angle:135};
 drawCarComponent(ctx,{w:245,h:172},widget,{art:{artRef:'sprite'}},resources,0,{});
 drawCarComponent(ctx,{w:245,h:172},widget,car,resources,0,{});
 assert.deepEqual(calls,['resolve-sprite','2d','garage-3d']);
});
