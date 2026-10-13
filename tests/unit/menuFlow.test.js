import test from 'node:test';
import assert from 'node:assert/strict';
import {createMenuDocument,normalizeMenuDocument,menuElementPose} from '../../src/menus/MenuDocument.js';
import {MenuFlow} from '../../src/menus/MenuFlow.js';

test('starter menu routes press start to cars and retains typed selections between screens',async()=>{
 const flow=new MenuFlow(createMenuDocument());await flow.start();assert.equal(flow.screenId,'cars');
 flow.setParameter('carRef','WRX4');flow.setParameter('difficulty','hard');flow.setParameter('weapons',['chainsaw','flame']);flow.setParameter('character.color','#ff0000');
 await flow.run({type:'screen',target:'events'});flow.back();assert.equal(flow.screenId,'cars');assert.equal(flow.parameters.carRef,'WRX4');assert.deepEqual(flow.parameters.weapons,['chainsaw','flame']);
});
test('movie completion precedes race or level launch with current configuration',async()=>{
 for(const destination of ['race','level']){
  const calls=[];let finish;const flow=new MenuFlow(createMenuDocument(),{playMovie:()=>new Promise(resolve=>{calls.push('movie');finish=resolve}),launchRace:(ref,p)=>calls.push([ref,p]),launchLevel:(ref,p)=>calls.push([ref,p])});
  flow.setParameter('carRef','WRX4');flow.setParameter('target','Saved destination');
  const pending=flow.run({type:'movie',target:'Intro',then:{type:destination,target:'$target'}});assert.deepEqual(calls,['movie']);assert.equal(flow.busy,true);finish();await pending;
  assert.equal(calls[1][0],'Saved destination');assert.equal(calls[1][1].carRef,'WRX4');assert.equal(flow.busy,false);
 }
});
test('menu launches a single selected race; race documents own subsequent destinations',async()=>{
 const calls=[];const flow=new MenuFlow(createMenuDocument(),{launchRace:async(ref,p)=>calls.push([ref,p])});
 flow.setParameter('raceRef','Hill');await flow.run({type:'race',target:'$raceRef'});
 assert.equal(calls.length,1);assert.equal(calls[0][0],'Hill');assert.equal(calls[0][1].raceRef,'Hill');
 assert.equal(flow.document.grandPrix,undefined);assert.equal(flow.raceFinished,undefined);
});
test('legacy schedule buttons and choices resolve to the first saved race without scheduling later races',()=>{
 const doc=createMenuDocument();doc.grandPrix=[{id:'cup',name:'Cup',races:[{raceRef:'First'},{raceRef:'Second'}]}];doc.parameters.grandPrix='cup';
 doc.screens[0].elements.push({id:'legacy-choice',type:'choice',source:'grandPrix',binding:'grandPrix'},{id:'legacy-launch',type:'button',action:{type:'grand-prix',target:'$grandPrix'}});
 const migrated=normalizeMenuDocument(doc);assert.equal(migrated.parameters.grandPrix,'First');assert.equal(migrated.screens[0].elements.at(-1).action.type,'race');assert.deepEqual(migrated.screens[0].elements.at(-2).options,[{label:'Cup',value:'First'}]);
});
test('stopping a pending movie prevents late launch and failed destinations report usable errors',async()=>{
 let finish,launched=false;const flow=new MenuFlow(createMenuDocument(),{playMovie:()=>new Promise(r=>finish=r),launchRace:()=>launched=true});
 const pending=flow.run({type:'movie',target:'Intro',then:{type:'race',target:'Track'}});flow.stop();finish();await pending;assert.equal(launched,false);
 const missing=new MenuFlow(createMenuDocument());assert.equal(await missing.run({type:'race',target:''}),false);assert.match(missing.error,/Choose a race/);
});
test('menu documents validate links, reject unsafe parameter names, and preserve editable animation',()=>{
 const doc=createMenuDocument();doc.screens[0].elements[0].keyframes=[{time:0,x:0,y:0,opacity:0,scale:1,rotation:0},{time:2,x:1,y:1,opacity:1,scale:2,rotation:90}];
 const saved=normalizeMenuDocument(JSON.parse(JSON.stringify(doc))),pose=menuElementPose(saved.screens[0].elements[0],1);assert.equal(pose.x,0.5);assert.equal(pose.rotation,45);
 doc.screens[0].startAction.target='missing';assert.throws(()=>normalizeMenuDocument(doc),/Screen not found/);
 const flow=new MenuFlow(createMenuDocument());assert.throws(()=>flow.setParameter('constructor.prototype',1),/Invalid parameter/);
});

test('non-looping preset animations stop at their duration and looping fades restart',()=>{
 const element=createMenuDocument().screens[0].elements[0];element.animation='spin';element.duration=2;element.loop=false;
 assert.equal(menuElementPose(element,1).rotation,180);assert.equal(menuElementPose(element,7).rotation,360);
 element.animation='fade';assert.equal(menuElementPose(element,7).opacity,1);element.loop=true;assert.equal(menuElementPose(element,5).opacity,0.5);
});
