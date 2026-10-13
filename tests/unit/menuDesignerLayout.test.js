import test from 'node:test';
import assert from 'node:assert/strict';
import {getMenuDesignerSurfaceLayout,getMenuDesignerPickerLayout} from '../../src/ui/shared/menuDesignerLayout.js';
import {MENU_WIDGETS} from '../../src/menus/MenuWidgets.js';

test('bottom hotbar and all widget choices remain reachable in portrait, desktop and short landscape',()=>{
 for(const bounds of [{x:16,y:16,w:358,h:724},{x:327,y:60,w:933,h:728},{x:80,y:8,w:650,h:260}]){
  const {hotbar,canvas,buttons}=getMenuDesignerSurfaceLayout(bounds);assert.ok(hotbar.y>=canvas.y+canvas.h);assert.equal(hotbar.y+hotbar.h,bounds.y+bounds.h);
  assert.deepEqual(buttons.map(b=>b.id),['widget-add','element-setup','element-select','screen-select','copy','cut','paste','delete','layer-down','layer-up','layer-back','layer-front']);
  for(const {bounds:b} of buttons){assert.ok(b.w>=80&&b.h>=44);assert.ok(b.y>=hotbar.y&&b.y+b.h<=hotbar.y+hotbar.h);assert.ok(b.x>=hotbar.x&&b.x+b.w<=hotbar.x+hotbar.w);}
  for(let focus=0;focus<MENU_WIDGETS.length;focus++){
   const layout=getMenuDesignerPickerLayout(hotbar,bounds,MENU_WIDGETS,focus);assert.ok(layout.buttons.some(b=>b.index===focus));
   for(const {bounds:b} of layout.buttons){assert.ok(b.x>=bounds.x&&b.x+b.w<=bounds.x+bounds.w);assert.ok(b.y>=bounds.y&&b.y+b.h<=hotbar.y);assert.ok(b.h>=42);}
  }
 }
});
