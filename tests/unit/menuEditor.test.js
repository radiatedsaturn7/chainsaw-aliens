import test from 'node:test';
import assert from 'node:assert/strict';
import MenuEditor from '../../src/ui/MenuEditor.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {getEditorMenuSpec} from '../../src/ui/shared/editorMenuSpec.js';
import {PROJECT_FOLDERS} from '../../src/ui/projectFiles.js';
import {createMenuDocument} from '../../src/menus/MenuDocument.js';
const editor=()=>{const game={carEditor:new RaceEditor({},{mode:'car'})};return new MenuEditor(game)};

test('menu designer is registered with shared shell and persistent project storage',()=>{
 const e=editor(),spec=getEditorMenuSpec(e.editorId);assert.ok(PROJECT_FOLDERS.includes('menus'));assert.ok(spec.sections.flow.actions.includes('starting-menu'));assert.ok(spec.sections.insert.actions.includes('insert-car-preview'));
 assert.equal(e.screen.id,'splash');assert.equal(e.screen.startAction.target,'cars');
});
test('insert, move, resize, duplicate and undo preserve a serializable menu',async()=>{
 const e=editor();e.menuBounds={x:0,y:0,w:400,h:600};await e.runAction('insert-image');const id=e.elementId;
 e.handlePointerDown({x:70,y:140,id:1});e.handlePointerMove({x:110,y:200,id:1});e.handlePointerUp({id:1});assert.equal(e.elementId,id);assert.ok(Math.abs(e.element.x-0.2)<1e-10);assert.ok(Math.abs(e.element.y-0.3)<1e-10);
 e.history();assert.equal(e.element.x,0.1);e.history(true);assert.equal(e.element.x,0.2);
 const before=e.element.w;e.handlePointerDown({x:(e.element.x+e.element.w)*400-2,y:(e.element.y+e.element.h)*600-2,id:2});e.handlePointerMove({x:(e.element.x+e.element.w)*400+38,y:(e.element.y+e.element.h)*600+28,id:2});e.handlePointerUp({id:2});assert.ok(e.element.w>before);
 await e.runAction('duplicate');assert.notEqual(e.elementId,id);const saved=JSON.parse(JSON.stringify(e.menu));const second=editor();second.loadMenu(saved,'Test Menu');assert.deepEqual(second.menu,e.menu);
});
test('screen deletion removes broken links and undo restores the full flow',async()=>{
 const e=editor(),before=structuredClone(e.menu);e.screenId='cars';await e.runAction('screen-delete');assert.equal(e.menu.screens[0].startAction,null);assert.equal(e.menu.screens[0].elements.find(e=>e.id==='start').action,null);e.history();assert.deepEqual(e.menu,before);
});
test('invalid edits roll back without losing the designer selection',()=>{
 const e=editor(),before=e.snapshot();assert.throws(()=>e.change(()=>{e.menu.startScreen='missing'}));assert.deepEqual(e.snapshot(),before);
});

test('keyboard undo handles a completed shortcut even after Control was released',async()=>{
 const e=editor();await e.runAction('insert-text');assert.equal(e.screen.elements.length,3);
 e.update({wasCommandPressedCode:code=>code==='KeyZ',wasPressedCode:()=>false,isDownCode:()=>false},1/60);
 assert.equal(e.screen.elements.length,2);
});

test('Preview This Screen passes the edited screen; Play From Start keeps its explicit meaning',async()=>{
 const e=editor(),calls=[];e.game.previewMenu=async(doc,options)=>calls.push({doc,options});e.screenId='events';e.elementId='heading';e.element.label='Unsaved heading';
 await e.runAction('menu-preview');assert.equal(calls[0].options.screenId,'events');assert.equal(calls[0].doc.screens.find(s=>s.id==='events').elements[0].label,'Unsaved heading');
 await e.runAction('menu-preview-start');assert.equal(calls[1].options.screenId,'splash');assert.equal(e.screenId,'events');assert.equal(e.elementId,'heading');assert.equal(e.menu.startScreen,'splash');
});
test('widget dropdown inserts immediately, supports keyboard dismissal and hides keyframe commands',async()=>{
 const e=editor();await e.runAction('widget-add');assert.equal(e.menuPicker,'widgets');const button=e.pickerEntries().find(e=>e.id==='pick-widget:button');e.choosePicker(button);await Promise.resolve();assert.equal(e.element.type,'button');assert.equal(e.menuPicker,null);
 await e.runAction('widget-add');e.update({wasPressedCode:code=>code==='Escape'},1/60);assert.equal(e.menuPicker,null);
 assert.ok(!e.getMenuItems('properties').some(e=>e.id.startsWith('keyframe-')));
 await e.runAction('element-animation');e.choosePicker(e.pickerEntries().find(e=>e.id==='pick-animation:pulse'));await Promise.resolve();assert.equal(e.element.animation,'pulse');assert.equal(e.animating,true);e.history();assert.equal(e.element.animation,'none');
});

test('containers move, resize, copy, cut and undo their full subtree with unique IDs',async()=>{
 const e=editor();e.screen.elements=[];e.menuBounds={x:0,y:0,w:400,h:600};await e.runAction('insert-container');const parent=e.elementId;
 await e.runAction('insert-shape');const child=e.elementId;assert.equal(e.element.parentId,parent);const before=structuredClone(e.element);
 e.elementId=parent;const container=e.element;e.handlePointerDown({id:1,x:container.x*400+2,y:container.y*600+2});e.handlePointerMove({id:1,x:container.x*400+42,y:container.y*600+62});e.handlePointerUp({id:1});
 let moved=e.screen.elements.find(x=>x.id===child);assert.ok(Math.abs(moved.x-before.x-0.1)<1e-10);assert.ok(Math.abs(moved.y-before.y-0.1)<1e-10);
 e.history();assert.deepEqual(e.screen.elements.find(x=>x.id===child),before);e.elementId=parent;
 await e.runAction('duplicate');assert.equal(e.screen.elements.length,4);const copy=e.element;assert.notEqual(copy.id,parent);assert.equal(copy.parentId,'');assert.equal(e.screen.elements.filter(x=>x.parentId===copy.id).length,1);
 await e.runAction('cut');assert.equal(e.screen.elements.length,2);await e.runAction('paste');assert.equal(e.screen.elements.length,4);assert.equal(new Set(e.screen.elements.map(x=>x.id)).size,4);
 await e.runAction('delete');assert.equal(e.screen.elements.length,2);e.history();assert.equal(e.screen.elements.length,4);
 const reopened=editor();reopened.loadMenu(JSON.parse(JSON.stringify(e.menu)));assert.deepEqual(reopened.menu,e.menu);
});

test('menu default background persists, new screens inherit and explicit backgrounds stay custom',async()=>{
 const {normalizeMenuDocument,resolveMenuBackground}=await import('../../src/menus/MenuDocument.js');
 const doc=normalizeMenuDocument({defaultBackground:{background:'#123456',backgroundArt:'Sky',effect:'snow'},screens:[{id:'inherit',elements:[]},{id:'custom',background:'#ff0000',elements:[]}]});
 const roundtrip=normalizeMenuDocument(JSON.parse(JSON.stringify(doc)));
 assert.equal(resolveMenuBackground(roundtrip,roundtrip.screens[0]).backgroundArt,'Sky');assert.equal(resolveMenuBackground(roundtrip,roundtrip.screens[0]).effect,'snow');
 assert.equal(resolveMenuBackground(roundtrip,roundtrip.screens[1]).background,'#ff0000');
 roundtrip.defaultBackground.background='#abcdef';assert.equal(resolveMenuBackground(roundtrip,roundtrip.screens[0]).background,'#abcdef');
});
