import test from 'node:test';
import assert from 'node:assert/strict';
import MenuEditor from '../../src/ui/MenuEditor.js';
import RaceEditor,{buildRacePortraitMenuModel} from '../../src/ui/RaceEditor.js';
import {MenuResources} from '../../src/menus/MenuResources.js';
import {drawMenuScreen} from '../../src/menus/MenuRenderer.js';
import {widgetDefaults,safeProperty,propertyPaths} from '../../src/menus/MenuWidgets.js';
import {normalizeMenuElement,normalizeMenuDocument} from '../../src/menus/MenuDocument.js';
import {saveProjectFile} from '../../src/ui/projectFiles.js';

test('touch menu builder exposes designer roots, widgets and preview instead of race tools',()=>{
 const model=buildRacePortraitMenuModel('menu-designer');assert.deepEqual(model.rootTabs.map(r=>r.id),['file','screens','insert','properties','flow','preview']);assert.deepEqual(model.bottomRailActions,['menu','undo','redo','menu-preview']);
 const e=new MenuEditor({carEditor:new RaceEditor({},{mode:'car'})});assert.ok(e.getMenuItems('insert').some(a=>a.id==='insert-property-display'));assert.ok(!e.getMenuItems('ground').length);
});
test('properties follow selected cars, actors and custom item objects, with safe paths',()=>{
 const r=new MenuResources({carEditor:{normalizeLoadedCarDocument:d=>d,collectRaceCarArtRefs:()=>[]}});
 saveProjectFile('cars','Widget Car',{name:'Car',tuning:{powerHp:250}});saveProjectFile('actors','Widget Actor',{name:'Actor',health:42});
 const e=normalizeMenuElement({...widgetDefaults('property-display'),property:'tuning.powerHp'});
 assert.equal(r.property(e,{carRef:'Widget Car'}),250);e.dataSource='actors';e.binding='actorRef';e.property='health';assert.equal(r.property(e,{actorRef:'Widget Actor'}),42);
 e.dataSource='parameters';e.binding='item';e.property='damage';assert.equal(r.property(e,{item:{name:'Sword',damage:12}}),12);assert.equal(r.property(e,{item:{name:'Axe',damage:35}}),35);
 assert.equal(safeProperty({},'constructor.name'),undefined);assert.ok(propertyPaths({health:42,tuning:{powerHp:250}}).some(p=>p.value==='tuning.powerHp'));
});
test('slider angle parameters drive car previews and widget source/style survives normalization',()=>{
 let yaw;const renderer={getRaceCarTuning:()=>({}),getRaceCarProjectedArtRef:(_c,_y,a)=>{yaw=a;return {artRef:null}}};
 const resources={game:{carEditor:renderer},car:()=>({tuning:{}}),tuning:()=>({}),art:()=>null,carPreview:{draw(){}}};
 const e=normalizeMenuElement({...widgetDefaults('car-preview'),angleBinding:'carAngle',assetRef:'Fixed Car',imageFit:'cover'});
 const doc=normalizeMenuDocument({screens:[{id:'a',elements:[e]}]});assert.equal(doc.screens[0].elements[0].assetRef,'Fixed Car');
 const ctx=new Proxy({},{get:(_o,k)=>()=>{}});
 for(const angle of [0,45,180,315]){drawMenuScreen(ctx,{x:0,y:0,w:400,h:500},doc,doc.screens[0],{carAngle:angle},{resources,time:1});assert.equal(yaw,angle*Math.PI/180);}
});
