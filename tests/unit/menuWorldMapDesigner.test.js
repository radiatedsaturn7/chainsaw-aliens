import test from 'node:test';
import assert from 'node:assert/strict';
import MenuEditor from '../../src/ui/MenuEditor.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {normalizeMenuElement,normalizeMenuDocument} from '../../src/menus/MenuDocument.js';
import {worldMapNodes,worldMapRaceNodes,worldMapConnections,worldMapNodePoint} from '../../src/menus/MenuWorldMap.js';
import {drawMenuScreen} from '../../src/menus/MenuRenderer.js';
import {drawWorldMap} from '../../src/menus/MenuWorldMapRenderer.js';
const nodes=[{id:'a',label:'A',raceRef:'A',x:.2,y:.3},{id:'j',label:'Junction',kind:'junction',x:.5,y:.5},{id:'b',label:'B',raceRef:'B',disabled:true,x:.8,y:.7}];
function editor(){const e=new MenuEditor({carEditor:new RaceEditor({},{mode:'car'})});e.loadMenu({startScreen:'map',screens:[{id:'map',elements:[{id:'map',type:'world-map',binding:'raceRef',x:0,y:0,w:1,h:1,nodes,connections:[{id:'aj',from:'a',to:'j'}]}]}]});e.elementId='map';e.menuBounds={x:0,y:0,w:960,h:540};e.buttons=[];e.mapDesigner.start();return e;}
const point=(e,id)=>({...worldMapNodePoint(e.element.nodes.find(n=>n.id===id),e.menuBounds,e.element),id:1});
test('dragging nodes moves no widgets and creates one undo step, with pointer ownership',()=>{
 const e=editor(),p=point(e,'a'),before=structuredClone(e.element);
 e.handlePointerDown(p);e.handlePointerMove({...p,x:p.x+96,y:p.y+50.4,id:2});assert.equal(e.element.nodes[0].x,.2);
 e.handlePointerMove({...p,x:p.x+96,y:p.y+50.4});e.handlePointerUp(p);
 assert.ok(Math.abs(e.element.nodes[0].x-.3)<1e-9);assert.ok(Math.abs(e.element.nodes[0].y-.4)<1e-9);
 assert.equal(e.element.x,before.x);assert.equal(e.undoMenus.length,1);
 e.history();assert.deepEqual(e.element,before);e.history(true);assert.ok(Math.abs(e.element.nodes[0].x-.3)<1e-9);
});
test('add junction, connect endpoints, style link, and delete node with its links',async()=>{
 const e=editor(),d=e.mapDesigner;d.place('junction');e.handlePointerDown({x:400,y:100,id:1});const id=d.nodeId;
 assert.equal(e.element.nodes.find(n=>n.id===id).kind,'junction');
 d.mode='connect';e.handlePointerDown(point(e,'a'));e.handlePointerDown(point(e,id));assert.ok(e.element.connections.some(c=>c.from==='a'&&c.to===id));
 d.linkId=e.element.connections.at(-1).id;
 await d.editLink(async()=>({from:'a',to:id,color:'#ff0055',width:4,pattern:'dashed',inherit:false}));assert.equal(e.element.connections.at(-1).pattern,'dashed');
 d.nodeId=id;d.remove();assert.ok(!e.element.nodes.some(n=>n.id===id));assert.ok(!e.element.connections.some(c=>c.from===id||c.to===id));
 e.history();assert.ok(e.element.nodes.some(n=>n.id===id));
});
test('editing all state icons, disabled status and cursor survives normalization',async()=>{
 const e=editor(),d=e.mapDesigner;d.nodeId='a';
 await d.editNode(async()=>({label:'Race A',kind:'race',raceRef:'A',artRef:'normal',selectedArtRef:'selected',disabledArtRef:'locked',disabled:true,x:20,y:30,unlockParameter:'chapter',unlockValue:'2',completedParameter:'done'}));
 await d.editStyle(async()=>({cursor:'image',cursorArtRef:'arrow',cursorText:'>',cursorSize:32,lineColor:'#00ff00',lineWidth:3,linePattern:'dotted',nodeScale:1.5,selectedColor:'#ffffff',unselectedColor:'#ff0000',disabledColor:'#888888',unselectedOpacity:.6,disabledOpacity:.3}));
 const saved=normalizeMenuDocument(JSON.parse(JSON.stringify(e.menu))).screens[0].elements[0];
 assert.equal(saved.nodes[0].selectedArtRef,'selected');assert.equal(saved.nodes[0].disabledArtRef,'locked');assert.equal(saved.nodes[0].unlockValue,2);assert.equal(saved.cursorArtRef,'arrow');assert.equal(saved.mapStyle.linePattern,'dotted');
 assert.ok(worldMapNodes(saved,null,null,{chapter:2})[0].locked);
});
test('legacy automatic maps retain their chain; explicit empty maps and connections stay empty',()=>{
 const resources={choices:()=>[{value:'A',label:'A'},{value:'B',label:'B'}]},e=normalizeMenuElement({type:'world-map'}),auto=worldMapNodes(e,resources,{},{});
 assert.equal(auto.length,2);assert.equal(worldMapConnections(e,auto).length,1);
 const blank=normalizeMenuElement({type:'world-map',mapManual:true,nodes:[],connections:[]});assert.equal(worldMapNodes(blank,resources,{},{}).length,0);assert.equal(worldMapConnections({...e,connections:[]},auto).length,0);
});
test('runtime navigation skips junctions and prevents disabled races launching',async()=>{
 const e=editor(),element=e.element;let launches=0;
 const player={resources:e.resources,flow:{document:e.menu,parameters:{raceRef:'A'},setParameter(k,v){this.parameters[k]=v;},run(){launches++;}}};
 await MenuPlayer.prototype.activate.call(player,element,1);assert.equal(player.flow.parameters.raceRef,'A');
 player.flow.parameters.raceRef='B';
 await MenuPlayer.prototype.activate.call(player,element,1,{choose:true});assert.equal(launches,0);assert.equal(player.flow.parameters.raceRef,'A');
 await MenuPlayer.prototype.activate.call(player,element,1);assert.equal(player.flow.parameters.raceRef,'A');
 await MenuPlayer.prototype.activate.call(player,element,1,{choose:true});assert.equal(launches,1);
 assert.equal(worldMapRaceNodes(worldMapNodes(element,null,null,{})).length,2);
});
test('renderer uses state-specific artwork, styled connections and cursor artwork',()=>{
 const icons=[],dashes=[],stack=[];
 const ctx=new Proxy({globalAlpha:1,filter:'none',save(){stack.push([this.globalAlpha,this.filter]);},restore(){[this.globalAlpha,this.filter]=stack.pop();},drawImage(art){icons.push({ref:art.ref,alpha:this.globalAlpha,filter:this.filter});},setLineDash(v){dashes.push(v);}},{get:(o,k)=>k in o?o[k]:()=>{}});
 const e=normalizeMenuElement({type:'world-map',nodes:nodes.map(n=>({...n,artRef:n.id+'-normal',selectedArtRef:n.id+'-selected',disabledArtRef:n.id+'-disabled'})),connections:[{from:'a',to:'j',width:3,pattern:'dashed'}],mapStyle:{cursor:'image'},cursorArtRef:'cursor'});
 drawWorldMap(ctx,{x:0,y:0,w:960,h:540},e,{art:ref=>({ref,width:32,height:32}),cursor:()=>({ref:'cursor',width:16,height:16})},{},{},'A',{drawText(){}});
 assert.ok(icons.some(i=>i.ref==='a-selected'&&i.alpha===1));assert.ok(icons.some(i=>i.ref==='b-disabled'&&i.filter==='grayscale(1)'));assert.ok(icons.some(i=>i.ref==='j-normal'));assert.ok(icons.some(i=>i.ref==='cursor'));assert.deepEqual(dashes[0],[12,9]);
});
test('Properties edits the selected node or line directly, falling back to widget tools',async()=>{
 const e=editor(),calls=[];
 e.mapDesigner.editNode=()=>calls.push('node');e.mapDesigner.editLink=()=>calls.push('line');e.mapDesigner.editStyle=()=>calls.push('map');
 e.mapDesigner.nodeId='a';await e.runAction('element-setup');
 e.mapDesigner.nodeId=null;e.mapDesigner.linkId='aj';await e.runAction('element-setup');
 e.mapDesigner.linkId=null;await e.runAction('element-setup');
 assert.deepEqual(calls,['node','line']);assert.equal(e.menuPicker,'map-tools');
});
test('authoring outlines nodes without filling over artwork or adding floating text',()=>{
 const e=editor(),strokes=[],texts=[];
 const ctx=new Proxy({stroke(){strokes.push([this.strokeStyle,this.lineWidth]);},fillText(text){texts.push(text);}},{get:(o,k)=>k in o?o[k]:()=>{}});
 e.mapDesigner.draw(ctx);
 assert.equal(strokes.filter(([color])=>color==='#73e4ff').length,3);
 assert.equal(strokes.filter(([color])=>color==='#101923').length,3);
 assert.deepEqual(texts,[]);
 e.mapDesigner.nodeId='b';strokes.length=0;e.mapDesigner.draw(ctx);
 assert.equal(strokes.filter(([color])=>color==='#ffce51').length,1);
});

test('map remains a normal widget until Edit nodes is explicitly chosen',async()=>{
 const e=editor();e.mapDesigner.reset();
 await e.runAction('element-setup');assert.equal(e.menuPicker,'map-tools');assert.equal(e.mapDesigner.element,null);
 e.mapDesigner.entries().find(entry=>entry.id==='map-move').action();assert.equal(e.mapDesigner.element,e.element);
 e.mapDesigner.entries().find(entry=>entry.id==='map-layout').action();assert.equal(e.mapDesigner.element,null);
 await e.runAction('widget-add');assert.equal(e.menuPicker,'widgets');
});
test('screen and widget artwork both remain visible while editing nodes at wide and portrait sizes',()=>{
 const e=editor();e.screen.backgroundArt='screen-map';e.screen.useDefaultBackground=false;e.element.artRef='widget-map';
 const resources={art:ref=>ref?{ref,width:320,height:180}:null};
 for(const [w,h] of [[960,540],[360,203]])for(const active of [false,true]){
  const images=[];
  const ctx=new Proxy({measureText:()=>({width:40}),drawImage:image=>images.push(image.ref)},{get:(o,k)=>k in o?o[k]:()=>{}});
  drawMenuScreen(ctx,{x:0,y:0,w,h},e.menu,e.screen,{}, {resources,editing:true,worldMapEditingId:active?'map':null});
  assert.deepEqual(images,['screen-map','widget-map']);
 }
});

test('a node can be dragged directly without first entering a hidden editing mode',()=>{
 const e=editor();e.mapDesigner.reset();
 const p=point(e,'a');e.elementId=null;e.handlePointerDown(p);e.handlePointerMove({...p,x:p.x+40});e.handlePointerUp(p);
 assert.equal(e.mapDesigner.nodeId,'a');assert.ok(e.element.nodes[0].x>.2);assert.equal(e.element.x,0);
});
