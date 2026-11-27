/** Projected world-space feature editing. No canvas coordinate assumptions. */
const NS='http://www.w3.org/2000/svg';
function node(tag, attrs={}){
 const n=document.createElementNS(NS,tag);
 for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);
 return n;
}
function axisVector(a){
 const out=['x','y','z'].includes(a)||Number.isInteger(a)?
  [0,1,2].map(i=>i===(typeof a==='string'?'xyz'.indexOf(a):a)?1:0):
  Array.isArray(a)||ArrayBuffer.isView(a)?Array.from(a):[0,1,0];
 const l=Math.hypot(...out);
 return l>1e-8?out.map(x=>x/l):[0,1,0];
}
function add(p,v,f){return p.map((x,i)=>x+v[i]*f);}
export function createContextualOverlay({root,viewport,get,begin,move,end,keyboard}){
 const guide=node('polyline',{class:'guide-line'}),rail=node('line',{class:'guide-sample'}),handle=node('g',{
  class:'guide-handle',role:'button',tabindex:0,'data-feature-handle':'active'});
 const hit=node('circle',{class:'guide-hit',r:23});
 const center=node('circle',{class:'guide-dot',r:9});
 const caption=node('text',{class:'guide-dottext',x:0,y:3,'text-anchor':'middle'});caption.textContent='↕';
 handle.append(hit,center,caption);root.replaceChildren(guide,rail,handle);
 let drag=null;
 function info(){
  const data=get(),v=viewport(),feature=data?.feature;
  if(!data||!v?.project||!feature?.handle)return null;
  const points=feature.points??[],h=feature.handle;
  const anchor=Array.isArray(h.anchor)?h.anchor:Number.isInteger(h.anchor)?points[h.anchor]:points[Math.floor(points.length*.5)];
  if(!Array.isArray(anchor)||anchor.length!==3)return null;
  const axis=axisVector(h.axis);
  const a=v.project(anchor),b=v.project(add(anchor,axis,.1));
  const dx=(b.x-a.x)*10,dy=(b.y-a.y)*10;
  const dd=dx*dx+dy*dy;
  return {feature,a,axis,dx,dy,dd,points,v};
 }
 handle.addEventListener('pointerdown',e=>{
  const a=info();
  if(!a||a.dd<2||e.button>0||!e.isPrimary)return;
  e.preventDefault();e.stopPropagation();root.setPointerCapture(e.pointerId);
  drag={...a,startX:e.clientX,startY:e.clientY,pointerId:e.pointerId,started:false};
 });
 root.addEventListener('pointermove',e=>{
  if(!drag||drag.pointerId!==e.pointerId)return;
  const x=e.clientX-drag.startX,y=e.clientY-drag.startY;
  if(!drag.started&&Math.hypot(x,y)<2)return;
  if(!drag.started){drag.started=true;begin(drag.feature);}
  e.preventDefault();move(drag.feature,drag.axis.map(a=>a*(x*drag.dx+y*drag.dy)/drag.dd));
 });
 for(const kind of ['pointerup','pointercancel','lostpointercapture']){
  root.addEventListener(kind,e=>{
   if(!drag||drag.pointerId!==e.pointerId)return;
   if(drag.started)end(drag.feature);
   drag=null;
  });
 }
 handle.addEventListener('keydown',e=>{
  const a=info();if(!a)return;
  const dir={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1}[e.key];
  if(dir==null)return;
  e.preventDefault();e.stopPropagation();
  keyboard(a.feature,a.axis.map(x=>x*dir*(e.shiftKey?.015:.003)));
 });
 return {render(){
  const a=info();
  root.toggleAttribute('hidden',!a);
  if(!a)return;
  const {feature,points,v,dx,dy,dd}=a;
  guide.setAttribute('points',points.map(p=>v.project(p)).map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  const p=a.a;handle.setAttribute('transform',`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
  handle.setAttribute('aria-label',`Move ${feature.label}. Drag or press arrow keys.`);
  caption.textContent=Math.abs(dy)>=Math.abs(dx)?'↕':'↔';
  const scale=25/Math.sqrt(Math.max(1,dd));
  for(const [name,k] of Object.entries({x1:p.x-dx*scale,y1:p.y-dy*scale,x2:p.x+dx*scale,y2:p.y+dy*scale}))rail.setAttribute(name,k);
  handle.toggleAttribute('hidden',!p.visible||dd<2);
  rail.toggleAttribute('hidden',!p.visible||dd<2);
 }};
}
