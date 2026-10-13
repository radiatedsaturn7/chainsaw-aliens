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
