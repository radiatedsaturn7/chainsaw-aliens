import test from 'node:test';
import assert from 'node:assert/strict';
import {createMenuDocument,normalizeMenuDocument,normalizeMenuElement} from '../../src/menus/MenuDocument.js';
import {MenuAppearanceResources,resolveMenuAppearance,readMenuAppearanceFile} from '../../src/menus/MenuAppearance.js';
import {drawMenuScreen,menuElementInteractive} from '../../src/menus/MenuRenderer.js';
import MenuEditor from '../../src/ui/MenuEditor.js';

test('splash, options and input mapping use black controls and cursor selection',()=>{
 for(const screen of createMenuDocument().screens.filter(s=>['splash','settings','mapping'].includes(s.id))){
  assert.equal(screen.background,'#000000');assert.equal(screen.effect,'none');assert.equal(screen.useDefaultBackground,false);
  for(const e of screen.elements.filter(menuElementInteractive)){assert.equal(e.selectionIndicator,'cursor');assert.equal(e.cursorText,'>');assert.equal(e.background,'#000000');}
 }
});
test('uploaded assets survive normalization, serialization and undo without 2048-character truncation',()=>{
 const editor=new MenuEditor({}),data='data:font/woff2;base64,'+'A'.repeat(5000),cursor='data:image/png;base64,'+'B'.repeat(4000);
 editor.elementId='start';editor.change(()=>Object.assign(editor.element,{fontData:data,fontFileName:'Arcade.woff2',fontFamily:'monospace',cursorData:cursor,cursorFileName:'Arrow.png',cursorText:'>>',cursorSize:32}));
 const doc=normalizeMenuDocument(JSON.parse(JSON.stringify(editor.menu))),e=doc.screens[0].elements.find(e=>e.id==='start');
 assert.equal(e.fontData,data);assert.equal(e.cursorData,cursor);assert.equal(e.fontFamily,'monospace');assert.equal(e.cursorSize,32);
 editor.history();assert.equal(editor.element.fontData,'');editor.history(true);assert.equal(editor.element.fontData,data);
});
test('uploads are atomic on cancellation and can be cleared or replaced',async()=>{
 const values={fontUpload:'upload',cursorUpload:'upload',cursorArtRef:'Old',selectionIndicator:'border'};
 let i=0;const accepts=[];
 const result=await resolveMenuAppearance(values,{choose:async accept=>{accepts.push(accept);return [{name:++i===1?'font.ttf':'cursor.png'}];},read:async(kind)=>`data:${kind};base64,AA`});
 assert.equal(result.fontFileName,'font.ttf');assert.equal(result.cursorFileName,'cursor.png');assert.equal(result.cursorArtRef,'');assert.equal(result.selectionIndicator,'cursor');assert.ok(accepts[0].includes('.ttf'));assert.ok(accepts[1].includes('.png'));
 assert.equal(await resolveMenuAppearance(values,{choose:async()=>[]}),null);assert.equal(values.selectionIndicator,'border');
 const cleared=await resolveMenuAppearance({fontUpload:'clear',cursorUpload:'clear'});assert.equal(cleared.fontData,'');assert.equal(cleared.cursorData,'');
 await assert.rejects(readMenuAppearanceFile('font',{name:'bad.exe',size:1}),/Choose/);
 await assert.rejects(readMenuAppearanceFile('cursor',{name:'big.png',size:9*1024*1024}),/smaller/);
});
test('font and image loading are cached, switch after loading and fall back on failure',async()=>{
 const loaded=[],images=[];let calls=0;
 class Font{constructor(name,src){this.name=name;this.src=src;calls++;}async load(){if(this.src.includes('broken'))throw Error('bad font');return this;}}
 class Image{constructor(){images.push(this);}}
 const resources=new MenuAppearanceResources({FontFace:Font,fonts:{add:f=>loaded.push(f)},Image});
 const e={fontFamily:'monospace',fontData:'data:font/woff;base64,AA',cursorData:'data:image/png;base64,AA'};
 assert.equal(resources.font(e),'monospace');resources.font(e);assert.equal(calls,1);
 await resources.fonts.get(e.fontData).pending;assert.match(resources.font(e),/^RTGMenuFont/);assert.equal(loaded.length,1);
 assert.equal(resources.cursor(e),null);resources.cursor(e);assert.equal(images.length,1);images[0].onload();assert.equal(resources.cursor(e),images[0]);
 const bad={fontFamily:'serif',fontData:'data:broken'};resources.font(bad);await resources.fonts.get(bad.fontData).pending;assert.equal(resources.font(bad),'serif');
});
test('renderer uses per-item fonts and image cursors, with text fallback while loading',()=>{
 const doc=createMenuDocument(),e=normalizeMenuElement({id:'test',type:'button',label:'Play',selectionIndicator:'cursor',fontFamily:'monospace',cursorText:'>>',cursorSize:24}),screen={...doc.screens[0],elements:[e]};
 const labels=[],draws=[],ctx=new Proxy({fillText(text){labels.push({text,font:this.font});},drawImage:(...args)=>draws.push(args)},{get:(o,k)=>k in o?o[k]:(()=>{})});
 const resources={art:()=>null,font:()=> 'UploadedFont',cursor:()=>null};
 drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},doc,screen,{}, {focus:e.id,resources});
 assert.ok(labels.every(t=>t.font.includes('UploadedFont')));assert.ok(labels.some(t=>t.text==='>>'));
 labels.length=0;resources.cursor=()=>({width:16,height:32});
 drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},doc,screen,{}, {focus:e.id,resources});
 assert.equal(draws.length,1);assert.ok(!labels.some(t=>t.text==='>>'));assert.equal(draws[0][3]/draws[0][4],.5);
});

test('menu default fonts survive save and undo, inherit on existing controls and permit overrides',()=>{
 const editor=new MenuEditor({});
 editor.change(()=>Object.assign(editor.menu.defaultFont,{fontFamily:'monospace',fontData:'data:font/woff2;base64,AA',fontFileName:'Game.woff2'}));
 const doc=normalizeMenuDocument(JSON.parse(JSON.stringify(editor.menu)));
 assert.equal(doc.defaultFont.fontFileName,'Game.woff2');
 const screen=doc.screens[0],start=screen.elements.find(e=>e.id==='start');
 assert.equal(start.useDefaultFont,true);
 const fonts=[],ctx=new Proxy({measureText:()=>({width:80}),fillText(){}},{get:(o,k)=>k in o?o[k]:(()=>{})});
 const resources={font:e=>{fonts.push(e);return e.fontFamily},art:()=>null};
 drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},doc,screen,{}, {resources});
 assert.ok(fonts.every(f=>f===doc.defaultFont));
 start.useDefaultFont=false;start.fontFamily='serif';fonts.length=0;
 drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},doc,screen,{}, {resources});
 assert.ok(fonts.includes(start));
 editor.history();assert.equal(editor.menu.defaultFont.fontData,'');editor.history(true);assert.equal(editor.menu.defaultFont.fontFileName,'Game.woff2');
});

test('splash cursor sits immediately left of its centered label at wide and portrait sizes',()=>{
 const doc=createMenuDocument(),screen=doc.screens[0];
 for(const bounds of [{x:0,y:0,w:960,h:540},{x:0,y:0,w:390,h:220}]){
  const labels=[],ctx=new Proxy({measureText:()=>({width:80}),fillText(text,x,y){labels.push({text,x,y});}},{get:(o,k)=>k in o?o[k]:(()=>{})});
  drawMenuScreen(ctx,bounds,doc,screen,{}, {focus:'start'});
  const label=labels.find(l=>l.text==='Game Start'),cursor=labels.find(l=>l.text==='>');
  assert.ok(label.x-40-cursor.x>=8);assert.ok(label.x-40-cursor.x<30);assert.equal(cursor.y,label.y);
 }
});

test('splash controls move up and transparent backgrounds omit control fills while preserving labels and cursor',()=>{
 const doc=createMenuDocument(),screen=doc.screens[0],start=screen.elements.find(e=>e.id==='start');
 assert.equal(start.y,.52);assert.equal(start.transparentBackground,true);assert.equal(screen.elements.find(e=>e.id==='settings').y,.67);
 const fills=[],texts=[],ctx=new Proxy({fillRect:(...r)=>fills.push(r),fillText:t=>texts.push(t),measureText:()=>({width:80})},{get:(o,k)=>k in o?o[k]:(()=>{})});
 drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},doc,screen,{}, {focus:'start'});
 assert.equal(fills.length,1,'only the screen background is painted');assert.ok(texts.includes('Game Start'));assert.ok(texts.includes('>'));
 assert.equal(normalizeMenuDocument(JSON.parse(JSON.stringify(doc))).screens[0].elements.find(e=>e.id==='start').transparentBackground,true);
});

test('text gradients retain colors and direction through menu save and undo',()=>{
 const editor=new MenuEditor({});editor.elementId='start';
 editor.change(()=>Object.assign(editor.element,{textFill:'gradient3',textGradientStart:'#68baff',textGradientMiddle:'#ffffff',textGradientEnd:'#3266ff',textGradientDirection:'horizontal'}));
 const menu=normalizeMenuDocument(JSON.parse(JSON.stringify(editor.menu)));
 const element=menu.screens[0].elements.find(e=>e.id==='start');
 assert.equal(element.textFill,'gradient3');assert.equal(element.textGradientMiddle,'#ffffff');assert.equal(element.textGradientDirection,'horizontal');
 editor.history();assert.equal(editor.element.textFill,'solid');editor.history(true);assert.equal(editor.element.textGradientEnd,'#3266ff');
});

test('text gradient spans the lettering and supports two or three color stops',async()=>{
 const {menuTextFill,menuAppearanceFields}=await import('../../src/menus/MenuAppearance.js');
 let coordinates,stops=[];
 const ctx={measureText:()=>({width:100,actualBoundingBoxAscent:8,actualBoundingBoxDescent:2}),createLinearGradient(...args){coordinates=args;stops=[];return {addColorStop:(...s)=>stops.push(s)};}};
 const b={x:10,y:20,w:300,h:100},e={textFill:'gradient3',textGradientStart:'#0088ff',textGradientMiddle:'#ffffff',textGradientEnd:'#0088ff'};
 menuTextFill(ctx,e,b,'Example',20);
 assert.deepEqual(coordinates,[110,62,110,72]);assert.deepEqual(stops,[[0,'#0088ff'],[.5,'#ffffff'],[1,'#0088ff']]);
 menuTextFill(ctx,{...e,textFill:'gradient',textGradientDirection:'horizontal'},b,'Example');
 assert.deepEqual(coordinates,[110,70,210,70]);assert.equal(stops.length,2);
 assert.equal(menuTextFill(ctx,{color:'#ffbbdd'},b),'#ffbbdd');
 assert.equal(menuAppearanceFields(e).find(f=>f.id==='textGradientMiddle').type,'color');
});

test('direct TTF upload installs menu and item fonts and cancellation leaves them unchanged',async()=>{
 const editor=new MenuEditor({});editor.elementId='start';let accept;
 const upload={choose:async types=>{accept=types;return [{name:'Arcade.ttf'}];},read:async()=> 'data:font/ttf;base64,AAAA'};
 await editor.uploadFont(true,upload);
 assert.ok(accept.includes('.ttf'));assert.equal(editor.menu.defaultFont.fontFileName,'Arcade.ttf');
 assert.equal(editor.element.useDefaultFont,true);
 const saved=JSON.stringify(editor.menu);
 await editor.uploadFont(true,{choose:async()=>[]});assert.equal(JSON.stringify(editor.menu),saved);
 await editor.uploadFont(false,upload);assert.equal(editor.element.useDefaultFont,false);assert.equal(editor.element.fontFileName,'Arcade.ttf');
 editor.history();assert.equal(editor.element.useDefaultFont,true);
 editor.history();assert.equal(editor.menu.defaultFont.fontData,'');
});

test('font outline draws behind the fill, preserves colors, and is opt-in',async()=>{
 const {drawMenuText}=await import('../../src/menus/MenuAppearance.js');
 const calls=[],fill={gradient:true},ctx={font:'26px CustomFont',fillStyle:fill,strokeStyle:'red',lineWidth:1,lineJoin:'miter',miterLimit:10,
 save(){this.saved={strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,lineJoin:this.lineJoin,miterLimit:this.miterLimit};},restore(){Object.assign(this,this.saved);},
 strokeText(...args){calls.push(['outline',this.strokeStyle,this.lineWidth,...args]);},fillText(...args){calls.push(['fill',this.fillStyle,...args]);}};
 drawMenuText(ctx,{textOutlineWidth:1.5,textOutlineColor:'#000000'},'Start',20,30,200);
 assert.deepEqual(calls[0],['outline','#000000',3,'Start',20,30,200]);assert.equal(calls[1][0],'fill');assert.equal(ctx.fillStyle,fill);assert.equal(ctx.strokeStyle,'red');
 calls.length=0;drawMenuText(ctx,{},'Other font',0,0);assert.equal(calls.length,1);assert.equal(calls[0][0],'fill');
 const e=normalizeMenuElement({textOutlineWidth:2,textOutlineColor:'#000000'});assert.equal(normalizeMenuElement(JSON.parse(JSON.stringify(e))).textOutlineWidth,2);
});

test('button artwork draws behind its label while retaining cursor selection',()=>{
 const calls=[],image={width:492,height:162};
 const ctx=new Proxy({measureText:()=>({width:40})},{get:(target,key)=>key in target?target[key]:(...args)=>calls.push([key,...args]),set:(target,key,value)=>(target[key]=value,true)});
 const doc=createMenuDocument(),screen=doc.screens[0];
 screen.elements=[normalizeMenuElement({id:'art-button',type:'button',label:'Play',artRef:'button',imageFit:'stretch',transparentBackground:true,selectionIndicator:'cursor',cursorText:'>'})];
 drawMenuScreen(ctx,{x:0,y:0,w:720,h:900},doc,screen,{}, {focus:'art-button',resources:{art:ref=>ref==='button'?image:null}});
 const art=calls.findIndex(c=>c[0]==='drawImage'&&c[1]===image),label=calls.findIndex(c=>c[0]==='fillText'&&c[1]==='Play');
 assert.ok(art>=0&&label>art);assert.ok(calls.some(c=>c[0]==='fillText'&&c[1]==='>'));
 assert.ok(!calls.some(c=>c[0]==='strokeRect'));
});

test('transparent tuner exposes the authored screen background',async()=>{
 const {drawGarageTuner}=await import('../../src/menus/MenuTuningRenderer.js');
 for(const transparentBackground of [true,false]){
  const fills=[],ctx=new Proxy({fillRect:(...args)=>fills.push(args)},{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>(target[key]=value,true)});
  drawGarageTuner(ctx,{x:0,y:0,w:900,h:460},null,'system-ui',{transparentBackground});
  assert.equal(fills.some(a=>a.join(',')==='0,0,900,460'),!transparentBackground);
 }
});

test('garage grids draw assigned panel artwork beneath their labels',async()=>{
 const {drawGarageTuner}=await import('../../src/menus/MenuTuningRenderer.js');
 const {drawUpgradeGrid}=await import('../../src/menus/MenuUpgradeRenderer.js');
 const panel={width:200,height:200},calls=[];
 const ctx=new Proxy({measureText:()=>({width:40})},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args]),set:(o,k,v)=>(o[k]=v,true)});
 const resources={art:ref=>ref==='panel'?panel:null,garageCatalog:()=>[{item:{name:'Turbo',carPart:{section:'Engine',slot:'turbo',forSale:true,compatibleCars:[]}}}]};
 const element={artRef:'panel',transparentBackground:true,color:'#fff'},b={x:0,y:0,w:900,h:460};
 drawGarageTuner(ctx,b,null,'system-ui',element,resources);
 assert.equal(calls.filter(c=>c[0]==='drawImage'&&c[1]===panel).length,8);
 calls.length=0;drawUpgradeGrid(ctx,b,element,resources,{});
 assert.equal(calls.filter(c=>c[0]==='drawImage'&&c[1]===panel).length,1);
 assert.ok(calls.findIndex(c=>c[0]==='drawImage')<calls.findIndex(c=>c[0]==='fillText'&&c[1]==='Engine'));
});

test('disabled controls persist, grey out, and cannot activate or receive navigation',async()=>{
 const {menuControlFilter}=await import('../../src/menus/MenuControlStyle.js');
 assert.equal(menuControlFilter(true),'none');assert.equal(menuControlFilter(false),'brightness(0.55)');assert.match(menuControlFilter(true,false),/grayscale/);
 const {default:MenuPlayer}=await import('../../src/menus/MenuPlayer.js');
 const p=new MenuPlayer({input:{},transitionTo(){},setActiveMusicTrack(){}});
 p.settings.load=async()=>{};p.resources.prepareGarage=async()=>{};
 const doc=createMenuDocument();doc.screens[0].elements.find(e=>e.id==='start').disabled=true;
 await p.open(doc,{preview:true});
 const e=p.flow.screen.elements.find(e=>e.id==='start');assert.equal(e.disabled,true);
 assert.ok(!p.interactive().includes(e));const id=p.flow.screenId;
 await p.activate(e);assert.equal(p.flow.screenId,id);
 p.bounds={x:0,y:0,w:720,h:900};assert.notEqual(p.hitElement({x:(e.x+e.w/2)*720,y:(e.y+e.h/2)*900})?.id,e.id);
 p.cleanup();
});

test('tapping a disabled menu button does not fall through to the screen action',async()=>{
 const {default:MenuPlayer}=await import('../../src/menus/MenuPlayer.js');const p=new MenuPlayer({input:{},transitionTo(){},setActiveMusicTrack(){}});
 p.settings.load=async()=>{};p.resources.prepareGarage=async()=>{};
 await p.open({startScreen:'s',screens:[{id:'s',startAction:{type:'set-param',parameter:'started',value:true},elements:[{id:'off',type:'button',disabled:true,x:.1,y:.2,w:.8,h:.3}]}]},{preview:true});
 p.bounds={x:0,y:0,w:960,h:540};p.preview=false;let started=0;p.flow.start=()=>started++;
 p.handlePointerDown({x:480,y:190});assert.equal(started,0);assert.equal(p.interactive().length,0);p.cleanup();
});
