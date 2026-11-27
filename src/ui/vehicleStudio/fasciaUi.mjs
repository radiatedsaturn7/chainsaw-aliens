/** UI-only adapters for the front and rear working views. */
export const guideModes={
 transverse:{label:'Cross width',help:'Drag vertically to shape the fascia across the car.',view:end=>end},
 vertical:{label:'Side profile',help:'Drag vertically to refine the fascia in profile.',view:()=>'side'},
 plan:{label:'Plan sweep',help:'Drag along the length of the car to tune corner sweep.',view:()=>'top'},
 outline:{label:'Lens outline',help:'Drag to refine the selected lamp perimeter.',view:end=>end}
};
const ns='http://www.w3.org/2000/svg';
const svgNode=(tag,attributes={})=>{
 const n=document.createElementNS(ns,tag);
 for(const [k,v] of Object.entries(attributes))n.setAttribute(k,v);
 return n;
};
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
export function createFasciaOverlay({svg,view,get,write,select}){
 const line=svgNode('polyline',{class:'guide-line'}),sample=svgNode('polyline',{class:'guide-sample'}),layer=svgNode('g');
 svg.replaceChildren(sample,line,layer);
 let drawn='',dots=[],gesture=null;
 function writePosition(point,screen,axis){
  const p=Array.from(point),v=p.slice();
  v[axis]+=.1;
  const a=screen(p),b=screen(v);
  return {a,dx:(b.x-a.x)*10,dy:(b.y-a.y)*10};
 }
 function finish(e,commit=true){
  if(!gesture||e.pointerId!==gesture.pointerId)return;
  if(commit&&gesture.dragged)write(gesture.index,gesture.last,{record:false,commit:true});
  gesture=null;
 }
 function begin(e,index){
  const g=get(),initial=g?.guide?.points?.[index],project=view()?.project;
  if(!initial||!project||!e.isPrimary||e.button>0)return;
  const axis=g.guide.axis??1,scale=Number(g.guide.scale)||.06;
  const {dx,dy}=writePosition(initial,project,axis);
  const dd=dx*dx+dy*dy;if(dd<1)return;
  e.preventDefault();e.stopPropagation();
  svg.setPointerCapture(e.pointerId);
  select(index);
  gesture={pointerId:e.pointerId,index,x:e.clientX,y:e.clientY,base:Number(g.values[index])||0,
   last:Number(g.values[index])||0,dd,dx,dy,scale,range:g.range,dragged:false};
 }
 svg.addEventListener('pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.pointerId)return;
  const x=e.clientX-gesture.x,y=e.clientY-gesture.y;
  if(!gesture.dragged&&Math.hypot(x,y)<2)return;
  e.preventDefault();
  const {min,max,step}=gesture.range;
  const d=(x*gesture.dx+y*gesture.dy)/gesture.dd/gesture.scale;
  const next=Number(clamp(Math.round((gesture.base+d)/step)*step,min,max).toFixed(6));
  if(next===gesture.last)return;
  const record=!gesture.dragged;
  gesture.dragged=true;gesture.last=next;
  write(gesture.index,next,{record,commit:false});
 });
 svg.addEventListener('pointerup',e=>finish(e));
 svg.addEventListener('pointercancel',e=>finish(e));
 svg.addEventListener('lostpointercapture',e=>finish(e));
 function dot(index){
  const g=svgNode('g',{class:'guide-handle',role:'button',tabindex:'0','aria-label':`Drag control point ${index+1}`,'data-fascia-handle':index});
  const hit=svgNode('circle',{r:20,class:'guide-hit'});
  const mark=svgNode('circle',{r:7,class:'guide-dot'});
  const title=svgNode('text',{x:0,y:3.4,'text-anchor':'middle',class:'guide-dottext'});
  title.textContent=index+1;
  g.append(hit,mark,title);layer.append(g);
  g.addEventListener('pointerdown',e=>begin(e,index));
  g.addEventListener('focus',()=>{if(!gesture) select(index);});
  g.addEventListener('keydown',e=>{
   const cfg=get();
   if(e.key==='Enter'||e.key===' '){e.preventDefault();select(index);return;}
   const delta={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1}[e.key];
   if(delta==null||!cfg)return;
   e.preventDefault();e.stopPropagation();select(index);
   const {min,max,step}=cfg.range,old=Number(cfg.values[index])||0;
   write(index,Number(clamp(old+step*delta*(e.shiftKey?5:1),min,max).toFixed(6)),{record:true,commit:true});
  });
  return g;
 }
 function render(){
  const cfg=get(),project=view()?.project;
  const points=cfg?.guide?.points;
  const active=Boolean(project&&points?.length);
  svg.hidden=!active;svg.toggleAttribute("hidden",!active);
  if(!active)return;
  const key=cfg.id+'|'+points.length;
  if(drawn!==key){layer.replaceChildren();dots=points.map((_,i)=>dot(i));drawn=key;}
  const projected=points.map(p=>project(p));
  const show=projected.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  line.setAttribute('points',show.join(' ')+(cfg.closed?' '+show[0]:''));
  sample.setAttribute('points',(cfg.guide.samples??[]).map(p=>project(p)).map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '));
  projected.forEach((p,i)=>{
   dots[i].setAttribute('transform',`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
   dots[i].dataset.selected=String(cfg.selected===i);
   dots[i].setAttribute('aria-pressed',String(cfg.selected===i));
   dots[i].style.display=p.visible?'':'none';
  });
 }
 return {render};
}
