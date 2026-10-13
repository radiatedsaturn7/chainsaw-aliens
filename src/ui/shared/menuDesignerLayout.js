import {getSharedTransportPopoverLayout} from '../uiSuite.js';

export function getMenuDesignerSurfaceLayout(bounds){
  const ids=['widget-add','element-setup','element-select','screen-select','copy','cut','paste','delete','layer-down','layer-up','layer-back','layer-front'];
  const columns=bounds.w>=600?6:4,gap=6,rowHeight=44,rows=Math.ceil(ids.length/columns);
  const height=rows*rowHeight+(rows-1)*gap;
  const hotbar={x:bounds.x,y:bounds.y+bounds.h-height,w:bounds.w,h:height};
  const width=(bounds.w-(columns-1)*gap)/columns;
  const buttons=ids.map((id,i)=>({id,bounds:{x:hotbar.x+(i%columns)*(width+gap),y:hotbar.y+Math.floor(i/columns)*(rowHeight+gap),w:width,h:rowHeight}}));
  return {hotbar,buttons,canvas:{x:bounds.x,y:bounds.y+22,w:bounds.w,h:Math.max(1,bounds.h-height-30)}};
}

// Use the shared upward popover placement, paging in short landscape viewports
// so every widget remains reachable with touch and controller-sized targets.
export function getMenuDesignerPickerLayout(anchor,viewport,entries,focus=0){
  const columns=2,gap=6,padding=8,rowHeight=42;
  const rows=Math.max(2,Math.floor((anchor.y-viewport.y-32)/(rowHeight+gap)));
  const capacity=rows*columns;
  const pageSize=entries.length>capacity?Math.max(2,capacity-2):capacity;
  const page=Math.floor(Math.max(0,focus)/pageSize),start=page*pageSize;
  const items=entries.slice(start,start+pageSize).map((entry,index)=>({...entry,index:start+index}));
  if(entries.length>capacity){
    items.push({id:'picker-previous',label:'‹ Previous',page:-1,disabled:page===0});
    items.push({id:'picker-next',label:'Next ›',page:1,disabled:start+pageSize>=entries.length});
  }
  const columnWidth=Math.max(1,(Math.min(420,viewport.w-16)-padding*2-gap)/2);
  const layout=getSharedTransportPopoverLayout(anchor,viewport,items,{columns,rowHeight,columnWidth,gap,padding});
  return {...layout,page,pageSize,start};
}
