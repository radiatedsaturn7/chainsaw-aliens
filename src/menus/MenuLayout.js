export function fitMenuCanvas(bounds){
 const w=Math.min(Math.max(1,bounds.w),Math.max(1,bounds.h)*16/9),h=w*9/16;
 return {x:bounds.x+(bounds.w-w)/2,y:bounds.y+(bounds.h-h)/2,w,h};
}

// Container membership groups screen-space rectangles. Reparenting preserves
// their visible positions; moving/resizing a container transforms its subtree.
export function menuSubtree(elements,id){
 const ids=new Set([id]);let changed=true;
 while(changed){changed=false;for(const e of elements)if(e.parentId&&ids.has(e.parentId)&&!ids.has(e.id)){ids.add(e.id);changed=true;}}
 return elements.filter(e=>ids.has(e.id));
}
export function menuPaintOrder(elements){
 const result=[];
 const visit=parent=>{for(const e of elements)if((e.parentId||'')===parent){result.push(e);if(e.type==='container')visit(e.id);}};
 visit('');return result;
}
export function menuElementVisible(element,elements){
 let e=element;const visited=new Set();
 while(e){if(!e.visible||visited.has(e.id))return false;visited.add(e.id);e=elements.find(p=>p.id===e.parentId);}
 return true;
}
export function transformMenuGroup(elements,id,before,after){
 const sx=after.w/before.w,sy=after.h/before.h;
 for(const e of menuSubtree(elements,id)){
  if(e.id===id)continue;
  e.x=after.x+(e.x-before.x)*sx;e.y=after.y+(e.y-before.y)*sy;e.w*=sx;e.h*=sy;
  for(const k of e.keyframes||[]){k.x=after.x+(k.x-before.x)*sx;k.y=after.y+(k.y-before.y)*sy;}
 }
}
export function reorderMenuGroup(elements,id,action){
 const e=elements.find(e=>e.id===id),siblings=elements.filter(p=>(p.parentId||'')===(e.parentId||'')),i=siblings.indexOf(e);
 const j=action==='layer-front'?siblings.length-1:action==='layer-back'?0:Math.max(0,Math.min(siblings.length-1,i+(action==='layer-up'?1:-1)));
 if(i===j)return elements;
 siblings.splice(i,1);siblings.splice(j,0,e);
 const order=new Map(siblings.map((p,k)=>[p.id,k]));
 const roots=elements.filter(p=>order.has(p.id)),slots=elements.map((p,k)=>order.has(p.id)?k:-1).filter(k=>k>=0);
 roots.sort((a,b)=>order.get(a.id)-order.get(b.id));
 const result=[...elements];slots.forEach((slot,k)=>result[slot]=roots[k]);return menuPaintOrder(result);
}
