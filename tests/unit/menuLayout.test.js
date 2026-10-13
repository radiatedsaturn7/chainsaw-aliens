import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMenuDocument} from '../../src/menus/MenuDocument.js';
import {menuPaintOrder,menuElementVisible,reorderMenuGroup,transformMenuGroup} from '../../src/menus/MenuLayout.js';
const fixture=()=>[{id:'a',type:'shape',visible:true,parentId:''},{id:'group',type:'container',visible:true,parentId:'',x:0.1,y:0.2,w:0.4,h:0.4},{id:'child',type:'text',visible:true,parentId:'group',x:0.2,y:0.3,w:0.1,h:0.1,keyframes:[{x:0.2,y:0.3}]},{id:'b',type:'shape',visible:true,parentId:''}];
test('layer commands move container subtrees as blocks while respecting sibling order',()=>{
 let a=fixture();assert.deepEqual(menuPaintOrder(a).map(e=>e.id),['a','group','child','b']);
 a=reorderMenuGroup(a,'group','layer-front');assert.deepEqual(a.map(e=>e.id),['a','b','group','child']);
 a=reorderMenuGroup(a,'group','layer-back');assert.deepEqual(a.map(e=>e.id),['group','child','a','b']);
 a=reorderMenuGroup(a,'group','layer-up');assert.deepEqual(a.map(e=>e.id),['a','group','child','b']);
 a=reorderMenuGroup(a,'group','layer-down');assert.deepEqual(a.map(e=>e.id),['group','child','a','b']);
});
test('container transforms scale descendants and keyframes and visibility follows ancestry',()=>{
 const a=fixture(),before={...a[1]},after={x:0.2,y:0.1,w:0.8,h:0.2};transformMenuGroup(a,'group',before,after);
 assert.ok(Math.abs(a[2].x-0.4)<1e-10);assert.ok(Math.abs(a[2].y-0.15)<1e-10);assert.equal(a[2].w,0.2);assert.equal(a[2].h,0.05);assert.equal(a[2].keyframes[0].x,a[2].x);
 a[1].visible=false;assert.equal(menuElementVisible(a[2],a),false);
});
test('container persistence rejects missing parents and membership cycles',()=>{
 const elements=fixture();assert.equal(normalizeMenuDocument({screens:[{id:'s',elements}]}).screens[0].elements[2].parentId,'group');
 elements[1].parentId='group';assert.throws(()=>normalizeMenuDocument({screens:[{id:'s',elements}]}),/cannot contain themselves/);
 elements[1].parentId='missing';assert.throws(()=>normalizeMenuDocument({screens:[{id:'s',elements}]}),/Container not found/);
});
