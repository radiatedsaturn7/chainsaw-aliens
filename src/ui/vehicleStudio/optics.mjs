// Fascia apertures and optical parts share an exact parameter-space rim.
// Surface coordinates: u increases chassis X, v goes from hood to road.
import {getSideSettings} from './genome.mjs';
import {compileFormula} from './formula9.mjs';
import * as T from '../../vendorBridge/three.js';

const tau=2*Math.PI;
const sat=(x)=>Math.max(0,Math.min(1,x));
const signed=x=>Math.max(-1,Math.min(1,x));
const num=(x,d)=>Number.isFinite(x)?x:d;
const mix=(a,b,t)=>a+(b-a)*t;
const pairs=(n,fn)=>Array.from({length:n},(_,i)=>fn(i/n,i));
const profiles={
 'upright-wrap':[[-1,-.54],[-.68,-.65],[.36,-.93],[.68,-.98],[.94,-.70],[1,-.18],[.95,.53],[.75,.80],[.12,.89],[-.70,.85],[-.96,.60]],
 rectangle:[[-1,-1],[1,-1],[1,1],[-1,1]],
 'round-rect':[[-.84,-1],[.84,-1],[1,-.73],[1,.73],[.84,1],[-.84,1],[-1,.73],[-1,-.73]],
 trapezoid:[[-.72,-1],[.72,-1],[1,1],[-1,1]],
 angular:[[-.92,-.63],[-.48,-1],[.7,-1],[1,-.43],[.81,.68],[.38,1],[-.78,.85],[-1,.22]],
 swept:[[-1,-.41],[-.64,-.78],[.84,-1],[1,-.68],[.81,.28],[.49,.98],[-.8,1],[-1,.41]],
 wrap:[[-1,-.31],[-.88,-.72],[.43,-1],[.94,-.88],[1,-.45],[.8,.28],[.41,.84],[-.69,1],[-1,.70]],
 // Round-ended two-reflector envelope: broad inner shoulder, deeper outer
 // bowl, and a higher outer tip where the lens meets the front fender.
 'round-twin':[[-1,-.47],[-.71,-.72],[-.25,-.82],[.23,-1],[.75,-.99],[.98,-.61],
  [1,-.25],[.95,.39],[.70,.83],[.34,1],[-.08,.91],[-.38,.79],[-.72,.86],[-.94,.62],[-1,.22]],
 shield:[[-.91,-.78],[-.54,-1],[.54,-1],[.91,-.78],[.75,-.19],[.43,.48],[.11,.96],[0,1],[-.11,.96],[-.43,.48],[-.75,-.19]],
 compound:[[-1,-.36],[-.79,-.77],[-.29,-.99],[.24,-.87],[.83,-.98],[1,-.69],[.95,.33],[.72,.89],[.27,.82],[-.36,1],[-.82,.78],[-1,.31]]
};
export const HOUSING_FAMILIES=['round-rect','circle','oval','rectangle','trapezoid','shield','angular','swept','wrap','upright-wrap','compound','round-twin','dual-round','stacked-round'];
const layouts=new Set(['projector','twin','led','mixed','factory-split','round-stack']);
function curvePolygon(points,r,n){
 const controls=(p,q,t)=>p.map((x,i)=>mix(x,q[i],t));
 const list=[];
 for(let i=0;i<points.length;i++){
  const p=points[i],a=controls(p,points[(i+points.length-1)%points.length],r),b=controls(p,points[(i+1)%points.length],r);
  list.push(...pairs(6,t=>controls(controls(a,p,t),controls(p,b,t),t)),b);
 }
 const sums=[0];for(let i=0;i<list.length;i++){const a=list[i],b=list[(i+1)%list.length];sums.push(sums.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));}
 return pairs(n,t=>{const target=t*sums.at(-1);let i=0;while(sums[i+1]<target)i++;return controls(list[i],list[(i+1)%list.length],(target-sums[i])/(sums[i+1]-sums[i]||1));});
}
function shape(type,{corner=.5,angle=0,sweep=.5,outline=[],segments=32,formula='',formulaSide=1}={}){
 const p=type==='circle'||type==='oval'?pairs(segments,t=>[Math.cos(t*tau),Math.sin(t*tau)]):curvePolygon(profiles[type]??profiles['round-rect'],mix(.025,.38,corner),segments);
 const custom=compileFormula(formula);
 const q=p.map(([x,y])=>{
  const a=(Math.atan2(y,x)/tau+1)%1*8,i=Math.floor(a),j=(i+1)%8;
  const t=a-i,theta=Math.atan2(y,x),u=(theta/tau+1)%1;
  const offset=.12*signed(custom({u,t:u,x,y,v:y,theta,side:formulaSide}));
  const scale=1+.13*mix(signed(num(outline[i],0)),signed(num(outline[j],0)),t*t*(3-2*t))+offset;
  return [x*scale,y*scale+x*angle*.29+(sweep-.5)*.32*x*x];
 });
 const xMax=Math.max(...q.map(p=>Math.abs(p[0]))),yMax=Math.max(...q.map(p=>Math.abs(p[1])));
 return q.map(([x,y])=>[x/xMax,y/yMax]);
}
function aperture({id,component,housing,cx,cy,width,height,side=1,opt={},kind='lamp',style,segments=32}){
 const base=shape(housing,{...opt,segments});
 const outline=base.map(([x,y])=>[cx+side*(x*width/2+(x<0?x*(num(opt.inboardReach,.5)-.5)*.15:0)),cy+y*height/2]);
 return {id,component,outline,kind,opt,center:[cx,cy],width,height,side,style};
}
// Physical outlet positions are mapped into the same face chart as the
// central pocket. The rolled opening, capped heat shield and pipe axes
// therefore travel together as the fascia or exhaust parameters change.
export function exhaustMountOpenings(g,face,existing){
 const halfTrack=g.dimensions.width*.5;
 const bound=(x,a,b)=>Math.min(b,Math.max(a,x));
 const inverse=(x,v)=>{
  let a=0,b=1;
  for(let i=0;i<24;i++){const t=(a+b)*.5;if(face(t,v)[0]>x)b=t;else a=t;}
  return (a+b)*.5;
 };
 const bands=existing.map(o=>{
  const xs=o.outline.map(p=>p[0]),ys=o.outline.map(p=>p[1]);
  return [Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)];
 });
 const pockets=[];
 for(const q of g.construction.exhaust){
  if(!q.fasciaHeight)continue;
  const gx=bound(q.x,-halfTrack,halfTrack);
  const sx=q.shape==='oval'?1.22:1;
  const rx=q.diameter*.5*sx;
  const spacing=bound(q.spacing,q.diameter*.85,.28);
  for(const sign of q.mirror&&Math.abs(gx)>.002?[1,-1]:[1]){
   const span=(q.count-1)*spacing*.5+rx+.035,x=gx*sign;
   const v=mix(.83,.235,q.fasciaHeight);
   const mid=inverse(x,v), localH=Math.hypot(...face(mid,v+.02).map((c,k)=>c-face(mid,v-.02)[k]))/.04;
   const dy=bound((q.diameter*.5+.025)/Math.max(.21,localH),.048,.19);
   const low=v-dy,high=v+dy;
   if(low<.034||high>.963)continue;
   const u0=Math.min(...[low,v,high].map(t=>inverse(x-span,t)));
   const u1=Math.max(...[low,v,high].map(t=>inverse(x+span,t)));
   if(u0<.035||u1>.965||bands.some(([a,b,c,d])=>u0<b+.010&&u1>a-.010&&low<d+.012&&high>c-.012))continue;
   const o=aperture({id:'raised-exhaust-'+q.id+(sign<0?'-mirror':''),kind:'exhaust-pocket',component:'exhaust',
    housing:'trapezoid',cx:(u0+u1)*.5,cy:v,width:u1-u0,height:dy*2,segments:12,opt:{corner:.44,outlet:q.id,sign}});
   pockets.push(o);bands.push([u0,u1,low,high]);
  }
 }
 return pockets;
}
// A real recess in the shell with a separate sculpted bridge inside it.
// Clearance is fitted against existing optical/plate/exhaust openings.
export function rearSculptOpening(g,openings){
 const f=g.fascia.rear;
 if(!f.rearSculptDepth)return null;
 const limits=openings.map(o=>{
  const x=o.outline.map(p=>p[0]),y=o.outline.map(p=>p[1]);
  return {left:Math.min(...x)-.018,right:Math.max(...x)+.018,top:Math.min(...y),bottom:Math.max(...y)};
 });
 const x=[.058,.091,.145,.21,.292,.37,.445,.5,.555,.63,.708,.79,.855,.909,.942];
 const top=[],bottom=[];
 for(const u of x){
  const q=Math.abs(2*u-1),rise=f.rearSculptSweep;
  let v=.47-rise*(q**1.63)+.018*Math.exp(-((q-.37)**2)/.026);
  for(const l of limits)if(u>=l.left&&u<=l.right&&v<l.bottom+.085&&v>l.top-.060)v=Math.max(v,l.bottom+.023);
  const thickness=f.rearSculptWidth*mix(.68,1,Math.sin(Math.PI*(u-.058)/.884)**.55);
  top.push([u,v]);bottom.push([u,v+thickness]);
 }
 for(let i=1;i<x.length;i++){
  const lo=Math.min(top[i][1],top[i-1][1]),hi=Math.max(bottom[i][1],bottom[i-1][1]);
  if(hi>.795||limits.some(l=>x[i]>l.left&&x[i-1]<l.right&&lo<l.bottom+.009&&hi>l.top-.009))return null;
 }
 return {id:'swept-rear-bridge',kind:'sculpted-trim',component:'rearBumper',
  outline:[...top,...bottom.slice().reverse()],center:[.5,.495],opt:{depth:f.rearSculptDepth,top,bottom}};
}
// Solve the projected XY circle on the full curved fascia. UV circles
// alone become tall slots where the corner compresses the horizontal axis.
function projectRoundLamp(opening,face,diameter,lift){
 const [u,v0]=opening.center;
 const attempt=(v,scale)=>{
  const [X,Y]=face(u,v),radius=diameter*.5*scale;
  let valid=true;
  const outline=opening.outline.map((_,i,points)=>{
   const t=i/points.length*tau,tx=X+radius*Math.cos(t),ty=Y+radius*Math.sin(t);
   let x=u,y=v;
   for(let k=0;k<9;k++){
    const [px,py]=face(x,y),ex=tx-px,ey=ty-py;
    if(Math.hypot(ex,ey)<1e-5)break;
    const h=.00045,A=face(x+h,y),B=face(x,y+h),
     ax=(A[0]-px)/h,ay=(A[1]-py)/h,bx=(B[0]-px)/h,by=(B[1]-py)/h,det=ax*by-ay*bx;
    if(Math.abs(det)<1e-7){valid=false;break;}
    x=sat(x+Math.max(-.14,Math.min(.14,(ex*by-ey*bx)/det)));
    y=sat(y+Math.max(-.14,Math.min(.14,(ey*ax-ex*ay)/det)));
   }
   const [px,py]=face(x,y);
   if(Math.hypot(tx-px,ty-py)>.0005||x<=.03||x>=.97||y<=.036||y>=.645||(u<.5?x>=.435:x<=.565))valid=false;
   return [x,y];
  });
  if(!valid)return false;
  opening.center=[u,v];opening.outline=outline;
  opening.width=2*Math.max(...outline.map(p=>Math.abs(p[0]-u)));
  opening.height=2*Math.max(...outline.map(p=>Math.abs(p[1]-v)));
  return true;
 };
 for(let i=0;i<8;i++)if(attempt(Math.max(.10,v0-lift*(1-i*.10)),1-i*.065))return;
}
export function makeOpenings({end,g,segments=32,face=null}){
 const front=end==='front',c=g.components??{},legacy=c[front?'headlights':'tails']??{},base=g.optics?.[end]??{},group=front?'headlights':'taillights';
 const fascia=g.fascia?.[end]??{},mode=fascia.intakes??'single',out=[];
 for(const s of [-1,1]){
 const raw=getSideSettings(g,group,s>0?'R':'L',base);
 const housing=HOUSING_FAMILIES.includes(raw.housing)?raw.housing:
  (legacy.type==='round'?'circle':legacy.type==='rectangular'||legacy.type==='strip'?'round-rect':front?'swept':'trapezoid');
 const opt={housing,layout:layouts.has(raw.layout)&&(!front||raw.layout!=='round-stack')?raw.layout:(legacy.type==='strip'?'led':front?'twin':'mixed'),
   width:sat(num(raw.width,.5)),height:sat(num(raw.height,.5)),corner:sat(num(raw.corner,.5)),
   angle:signed(num(raw.angle,(legacy.angle||0)/18)),sweep:sat(num(raw.sweep,.5)),
   curvature:sat(num(raw.curvature,.5)),recess:sat(num(raw.recess,.5)),convexity:sat(num(raw.convexity,.5)),
   sideWrap:sat(num(raw.sideWrap,0)),silverFront:sat(num(raw.silverFront,0)),silverUpper:sat(num(raw.silverUpper,0)),silverUpperSplit:Math.max(-.08,Math.min(.20,num(raw.silverUpperSplit,-.018))),tripleBowls:sat(num(raw.tripleBowls,0)),rearCells:sat(num(raw.rearCells,0)),rearTriBars:sat(num(raw.rearTriBars,0)),roundBowls:sat(num(raw.roundBowls,0)),flutedBowls:sat(num(raw.flutedBowls,0)),position:sat(num(raw.position,.5)),protrusion:sat(num(raw.protrusion,0)),formula:raw.formula??'',modules:Math.max(0,Math.min(8,Math.round(raw.modules??0))),spacing:sat(num(raw.spacing,.5)),inboardReach:sat(num(raw.inboardReach,.5)),formulaSide:g.construction?.symmetry?.[group]==='linked'?s:1,outline:Array.isArray(raw.outline)?raw.outline:[]};

 // The bands are deliberately disjoint even at all slider extremes:
 // lamp inside <= .366; center grille starts >= .388; lower intakes start >= .31.
 const sideBase=front?mix(.189,.231,opt.position):mix(.196,.229,opt.position);
 const sideX=sideBase-(num(raw.outboard,.5)-.5)*.092;
 const h0=mix(.129,front?.347:.295,housing==='circle'?opt.height*.58+opt.width*.42:opt.height);
 const w=Math.min(housing==='circle'?h0*.46:mix(.132,.308,opt.width),2*(sideX-.025));
 const parked=front&&g.construction?.hood?.lampLids==='flush'&&g.construction.hood.parkedPopups;
 if(parked){
  // This prototype keeps the rectangular upper lids closed at rest and
  // does not animate them. Reuse the active optics as lower bank lamps.
  const cy=.728;
  out.push(aperture({id:'head'+(s>0?'-l':'-r'),component:'headlights',
   housing:'round-rect',cx:s>0?1-sideX:sideX,cy,width:Math.min(.154,w*.64),height:.088,
   side:s,opt:{...opt,angle:0,sweep:.5,sideWrap:0,silverFront:0},segments}));
  continue;
 }
 const hBase=(housing==='oval'?h0*.85:h0)*(front?1:1+Math.max(0,Math.min(housing==='upright-wrap'?.88:.42,num(raw.tallHousing,0))));
 const cyBase=Math.max(.022+hBase/2,Math.min(front?mix(.127,.408,opt.position):mix(.176,.462,opt.position),1-hBase*.5-.045));
 // Make the headlight body taller without moving the fitted hood edge.
 // Keep a solid band to the tallest possible fog cover underneath.
 const reach=front?Math.min(.11,Math.max(0,num(raw.lowerLensReach,0)),Math.max(0,.585-(cyBase+hBase/2))):0;
 const h=hBase+reach,cy=cyBase+reach/2;
 if(front&&housing==='stacked-round'){
  const hw=.033+.011*opt.width,hh=.074+.020*opt.height;
  const x=Math.max(.079,Math.min(.216,sideX-.055)),y=.388+(.5-opt.position)*.16;
  for(let i=0;i<2;i++){
   const cx=s>0?1-x:x,cy=y+(i?1:-1)*(hh+.014);
   const roundOpt={...opt,angle:0,sweep:.5,inboardReach:.5,outline:[],formula:'',layout:'projector',sideWrap:0,secondaryLamp:i>0};
   const opening=aperture({id:'head-'+(s>0?'l':'r')+(i?'-lower':''),component:'headlights',
    housing:'circle',cx,cy,width:hw*2,height:hh*2,side:s,opt:roundOpt,segments});
   if(face&&raw.physicalDiameter>0)projectRoundLamp(opening,face,Math.min(raw.physicalDiameter,g.dimensions.width*hw*1.65),0);
   out.push(opening);
  }
  continue;
 }
 if(front&&housing==='dual-round'){
  // A pair of physically separate front projector recesses, with a painted
  // web between them. Keep both in the existing side tiles and end the
  // circles above the lowest available bumper intake station.
  const hw=.032+.014*opt.width,hh=.077+.056*opt.height;
  const outer=Math.max(.097,Math.min(.175,sideX-(hw+.005)));
  const inner=outer+hw*2+.020;
  const y=Math.max(.130+hh,Math.min(.402,cyBase+.034));
  for(let i=0;i<2;i++){
   const cx=s>0?1-(i?inner:outer):(i?inner:outer),cy=y+(i?.018:0);
   const fit=i?.88:1, roundOpt={...opt,angle:0,sweep:.5,inboardReach:.5,outline:[],formula:'',layout:'projector',sideWrap:0,secondaryLamp:i>0};
   const opening=aperture({id:'head-'+(s>0?'l':'r')+(i?'-inner':''),component:'headlights',
    housing:'circle',cx,cy,width:hw*2*fit,height:hh*2*fit,side:s,opt:roundOpt,segments});
   if(face&&raw.physicalDiameter>0)projectRoundLamp(opening,face,Math.min(raw.physicalDiameter,g.dimensions.width*hw*1.7)*fit,0);
   out.push(opening);
  }
  continue;
 }
 if(!front&&housing==='dual-round'){
  // Two independent recesses per side. Keep a physical painted land between
  // lenses and reserve the middle third for a plate, handle or deck badge.
  const halfWidth=Math.min(.069,.029+opt.width*.035);
  const halfHeight=Math.min(.108,.046+opt.height*.062);
  const primaryX=Math.max(.115,Math.min(.276,sideX-(halfWidth+.010)));
  const centers=[Math.max(.038+halfWidth,primaryX),Math.min(.423-halfWidth,primaryX+2*halfWidth+.028)];
  const y=Math.max(.115+halfHeight,Math.min(.51,cyBase));
  for(let i=0;i<centers.length;i++){
   const cx=s>0?1-centers[i]:centers[i],cy=y+(i?opt.angle*.018:0);
   const roundOpt={...opt,angle:0,sweep:.5,inboardReach:.5,outline:[],formula:'',layout:'round-stack',sideWrap:0,secondaryLamp:i>0};
   const opening=aperture({id:'tail-'+(s>0?'l':'r')+(i?'-inner':''),
    component:'tails',housing:'circle',cx,cy,width:halfWidth*2,height:halfHeight*2,side:s,opt:roundOpt,segments});
   // Spacing remains authoritative: an oversize physical diameter is capped
   // to the available pair envelope before attempting true projected circles.
   if(face&&raw.physicalDiameter>0)projectRoundLamp(opening,face,Math.min(raw.physicalDiameter,g.dimensions.width*halfWidth*1.80),0);
   out.push(opening);
  }
  continue;
 }
 const opening=aperture({id:(front?'head':'tail')+(s>0?'-l':'-r'),
  component:front?'headlights':'tails',housing,cx:s>0?1-sideX:sideX,cy,width:w,height:h,side:s,opt,segments});
 if(!front&&face&&housing==='circle'&&raw.physicalDiameter>0&&!raw.sideWrap)projectRoundLamp(opening,face,raw.physicalDiameter,raw.circleLift);
 out.push(opening);
 }
 if(front){
  const gr=c.grille??{},fog=c.fogs??{};
  if(gr.type==='deep mesh frame'){
   const cy=.479+(num(fascia.grilleHeightPosition,.5)-.5)*.27;
   const h=Math.min(mix(.360,.681,num(fascia.grilleHeight,.5)),2*(cy-.096),2*(.933-cy));
   const free=Math.min(.49-Math.max(...out.filter(o=>o.center[0]<.5).flatMap(o=>o.outline.map(p=>p[0]))),
    Math.min(...out.filter(o=>o.center[0]>.5).flatMap(o=>o.outline.map(p=>p[0])))-.51);
   const w=Math.min(mix(.234,.475,num(fascia.grilleWidth,.5)),2*free);
   if(w>.075)out.push(aperture({id:'upper-grille',component:'grille',kind:'duct',
    housing:fascia.grilleShape??'trapezoid',cx:.5,cy,width:w,height:h,
    opt:{corner:.58,bezel:num(fascia.grilleBezel,0),throatDepth:num(fascia.lowerIntakeDepth,0)},segments,style:'mesh'}));
  }else if(gr.type==='twin deep mesh'){
   const cy=.488+(num(fascia.grilleHeightPosition,.5)-.5)*.32;
   const h=mix(.16,.44,num(fascia.grilleHeight,.5))*num(gr.depth,1);
   const free=Math.min(.200,.475-Math.max(...out.filter(o=>o.kind==='lamp'&&o.center[0]<.5).flatMap(o=>o.outline.map(p=>p[0]))),
    Math.min(...out.filter(o=>o.kind==='lamp'&&o.center[0]>.5).flatMap(o=>o.outline.map(p=>p[0])))-.525);
   const w=Math.min(free,.088+.12*num(fascia.grilleWidth,.5));
   if(w>.04)for(const side of [-1,1])out.push(aperture({id:'upper-grille-'+(side<0?'r':'l'),component:'grille',kind:'duct',
    housing:fascia.grilleShape??'round-rect',cx:.5+side*(.026+w/2),cy,width:w,height:Math.min(h,1.9*Math.min(cy-.03,.965-cy)),side,segments,
    opt:{corner:.68,angle:.13,sweep:.59,bezel:num(fascia.grilleBezel,0)},style:'mesh'}));
  }else if(gr.type==='twin vertical slats'||gr.type==='twin mesh'){
   const mesh=gr.type==='twin mesh';
   // Keep a painted center ligament and derive both recesses from the
   // lamp apertures so changing headlamp width cannot create an overlap.
   const free=Math.min(.140,.48-Math.max(...out.filter(o=>o.center[0]<.5).flatMap(o=>o.outline.map(p=>p[0]))),
    Math.min(...out.filter(o=>o.center[0]>.5).flatMap(o=>o.outline.map(p=>p[0])))-.52);
   const w=Math.min(free,.077+.061*num(fascia.grilleWidth,.5)),h=mesh?(.043+.092*num(fascia.grilleHeight,.5))*num(gr.depth,1):(.10+.133*num(fascia.grilleHeight,.5))*num(gr.depth,1);
   if(w>.025)for(const side of [-1,1])out.push(aperture({id:'upper-grille-'+(side<0?'r':'l'),component:'grille',
    housing:mesh?(fascia.grilleShape??'round-rect'):'round-rect',cx:.5+side*((mesh?.019:.012)+w/2),cy:.415+(num(fascia.grilleHeightPosition,.5)-.5)*.43,width:mesh?Math.max(.025,w-.014):w,height:h,...(mesh?{side}:{}),
    opt:mesh?{corner:.64,angle:.42,sweep:.67}:{corner:.74},kind:'duct',segments,style:mesh?'mesh':'vertical'}));
  }else if(gr.type!=='closed')out.push(aperture({id:'upper-grille',component:'grille',housing:fascia.grilleShape??'trapezoid',cx:.5,cy:.415+(num(fascia.grilleHeightPosition,.5)-.5)*.43,
   width:Math.min(mix(.155,.256,sat((num(gr.size,1)-.68)/.60))*(.56+.88*num(fascia.grilleWidth,.5)),2*(.49-Math.max(...out.filter(o=>o.center[0]<.5).flatMap(o=>o.outline.map(p=>p[0])))),2*(Math.min(...out.filter(o=>o.center[0]>.5).flatMap(o=>o.outline.map(p=>p[0])))-.51)),height:mix(.13,(gr.type==='vertical slats'||gr.type==='seven-slot'||gr.type==='five-slot')?.35:.238,sat((num(gr.depth,1)-.68)/.60))*(.58+.84*num(fascia.grilleHeight,.5)),
   kind:'duct',segments,opt:{bezel:num(fascia.grilleBezel,0),lampPair:num(fascia.grilleLampPair,0)},style:gr.type==='crosshair'?'crosshair':gr.type==='seven-slot'?'seven-slot':gr.type==='five-slot'?'five-slot':gr.type==='vertical slats'?'vertical':gr.type==='bars'?'bars':'mesh'}));
  for(const s of [-1,1]){
   const sideFog=getSideSettings(g,'fogs',s>0?'R':'L',fog);
   if(sideFog.type==='off')continue;
   if(sideFog.type==='vertical LED strip'){
    // A separate fascia DRL below each main housing, with dark housing
    // returns and a clear strip. Track the lamp edge to prevent overlap.
    const eyes=out.filter(o=>o.kind==='lamp'&&Math.sign(o.center[0]-.5)===s);
    if(!eyes.length)continue;
    const edge=Math.max(...eyes.flatMap(o=>o.outline.map(q=>q[1])));
    const bottom=.84, top=Math.max(.53,edge+.022);
    if(bottom-top>.049){
     const outer=Math.max(...eyes.flatMap(o=>o.outline.map(q=>(q[0]-.5)*s)));
     out.push(aperture({id:'front-vertical-led-'+(s<0?'r':'l'),component:'fogs',housing:'round-rect',
      kind:'front-guide',cx:.5+s*Math.min(.386,outer-.009),cy:(top+bottom)*.5,
      width:.024,height:bottom-top,segments:Math.min(12,segments),side:s,opt:{corner:.62,angle:-.10,sweep:.55}}));
    }
    continue;
   }
   if(sideFog.type==='amber strip'){
    // This low-voltage indicator keeps its own recessed fascia opening
    // when the main beam moves to a fender pod or configurable hood chart.
    out.push(aperture({id:'signal'+(s>0?'-l':'-r'),component:'fogs',housing:'round-rect',
     cx:.5+s*.319,cy:.47,width:.085*num(sideFog.size,1),height:.065*num(sideFog.depth,1),
     kind:'signal',segments:Math.min(12,segments),side:s,opt:{corner:.31}}));
    continue;
   }
   out.push(aperture({id:'fog'+(s>0?'-l':'-r'),component:'fogs',
   housing:sideFog.type==='strip'||sideFog.type==='blank'?'round-rect':'oval',cx:.5+s*.277,cy:.765,
   width:mix(.065,.151,sat(num(sideFog.size,1)*.53)),height:sideFog.type==='strip'?.070:mix(.107,.174,sat(num(sideFog.depth,1)*.52))*(sideFog.type==='blank'?mix(.60,1.75,num(fascia.fogCoverHeight,.5))/1.175:1),
   kind:sideFog.type==='blank'?'blank':'fog',segments,side:s,opt:{layout:'projector',protrusion:0,fogCoverStamp:fascia.fogCoverStamp}}));
  }
  // A blank-cover sport bumper may have dedicated smaller breaths just
  // below each cover. Derive space from that side's actual aperture so
  // alternate cover sizes can neither overlap it nor cut the lower rim.
  const bypass=num(fascia.fogBypass,0);
  if(bypass>0)for(const cover of out.filter(x=>x.kind==='blank')){
   const bottom=Math.max(...cover.outline.map(p=>p[1]));
   const height=Math.min(.063*bypass,.966-bottom-.017);
   if(height<.018)continue;
   const side=cover.side,cx=cover.center[0]+side*.018;
   out.push(aperture({id:'lower-corner-bypass-'+(side<0?'r':'l'),component:'frontBumper',kind:'bypass',
    housing:'angular',cx,cy:bottom+.014+height/2,width:.083+.024*bypass,height,segments:Math.min(8,segments),
    opt:{angle:.16*side,corner:.63}}));
  }
 }
 if(!front&&fascia.tailBridge>0&&!(g.construction?.cabin.rearHatchFold&&g.construction?.cabin.hatchEdgeLamps)){
  const lamps=out.filter(o=>o.kind==='lamp');
  const low=Math.max(...lamps.filter(o=>o.center[0]<.5).flatMap(o=>o.outline.map(p=>p[0])));
  const high=Math.min(...lamps.filter(o=>o.center[0]>.5).flatMap(o=>o.outline.map(p=>p[0])));
  const reach=(Math.min(.5-low,high-.5)-.014)*fascia.tailBridge;
  const y=Math.max(.09,Math.min(.32,lamps.reduce((sum,o)=>sum+o.center[1],0)/lamps.length-.031));
  if(reach>.028)out.push(aperture({id:'rear-running-bridge',component:'tails',housing:'round-rect',
   cx:.5,cy:y,width:2*reach,height:.020,kind:'light-guide',segments:8}));
 }
 if(!front&&g.construction&&fascia.rearTrayDepth>0){
  const width=fascia.rearTrayWidth;
  const top=Math.max(fascia.rearTrayHeight,...out.filter(o=>o.kind==='lamp').flatMap(o=>o.outline.map(p=>p[1]+.055)));
  if(top<.79){
   const l=.5-width/2,r=1-l,b=.985,d=.035;
   // The painted bumper surrounds one physical opening. Plate mount and
   // side vents are carried inside it, not separate coplanar cutouts.
   const outline=[[l+d,top+.05],[l+d+.028,top+.009],[.5,top],[r-d-.028,top+.009],[r-d,top+.05],
    [r,b-.025],[r-.028,b],[l+.028,b],[l,b-.025]];
   out.push({id:'rear-recessed-valance',component:'rearBumper',kind:'valance',outline,
    center:[.5,(b+top)/2],width,height:b-top,opt:{depth:fascia.rearTrayDepth}});
  }
 }else if(!front&&g.construction){
  const height=(.125+(num(fascia.plateHeight,.5)-.5)*.214)*(1+num(fascia.plateOpeningStretch,0));
  const y=Math.max(.18+height/2,Math.min(num(fascia.platePosition,.615),.955-height/2));
  out.push(aperture({id:'rear-plate-recess',component:'rearBumper',housing:'round-rect',cx:.5,cy:y,
   width:mix(.155,.291,num(fascia.plateWidth,.5)),height,kind:'plate',opt:{mount:num(fascia.plateMount,0),painted:num(fascia.paintedPocket,0),corner:num(fascia.plateMount,0)>0?.23:.5},segments}));
 }
 if(!front&&(fascia.deckPanel??0)>0){
  const plate=out.find(o=>o.kind==='plate');
  const hi=Math.min(.483,plate?Math.min(...plate.outline.map(p=>p[1]))-.02:.483);
  const top=.026,bottom=Math.min(hi,mix(.28,.495,num(fascia.deckHeight,.5)));
  const width=mix(.16,.34,num(fascia.deckWidth,.5));
  if(bottom-top>.10){
   const lamps=out.filter(o=>o.kind==='lamp');
   // Clip against the inwardmost part of each lamp over the neighboring
   // station interval, not only at the sample. Joining segments therefore
   // cannot cut through a shallow or steeply sloped light outline.
   const count=24, step=(bottom-top)/count;
   function outer(y){
    const lo=y-step-.001,hi=y+step+.001;
    let reach=width*(1-.18*((y-top)/(bottom-top))**1.33);
    for(const o of lamps){
     for(let k=0;k<o.outline.length;k++){
      const a=o.outline[k],b=o.outline[(k+1)%o.outline.length];
      if(Math.max(a[1],b[1])<lo||Math.min(a[1],b[1])>hi)continue;
      const f=v=>Math.abs(b[1]-a[1])>1e-10?mix(a[0],b[0],sat((v-a[1])/(b[1]-a[1]))):a[0];
      const v=[f(lo),f(hi),...(a[1]>=lo&&a[1]<=hi?[a[0]]:[]),...(b[1]>=lo&&b[1]<=hi?[b[0]]:[])];
      reach=Math.min(reach,...v.map(x=>Math.abs(.5-x)-.012));
     }
    }
    return Math.max(.047,reach);
   }
   // Use straight draft rails across the whole drop. A footprint can
   // never follow the light's scallops and double back through itself.
   const bound=Array.from({length:count+1},(_,i)=>outer(mix(top,bottom,i/count)));
   const drafting=t=>(1-t)**(1+2.2*num(fascia.deckRailCurve,0));
   const lower=Math.min(...bound)*.978;
   const upper=Math.min(width,...bound.slice(0,-1).map((q,i)=>{
    const a=drafting(i/count);return lower+(q-lower)/a;
   }));
   const side=sign=>Array.from({length:count+1},(_,i)=>{
    const t=i/count,y=mix(top,bottom,t);
    const radius=num(fascia.deckLowerRoll,0);
    const tip=t>.76?(t-.76)/.24:0;
    const bevel=(i===0||i===count?.965:1)*(1-.13*radius*tip**2);
    return [.5+sign*mix(lower,upper,drafting(t))*bevel,y];
   });
   out.push({id:'rear-deck-insert',component:'trunk',kind:'deck',outline:[...side(1),...side(-1).reverse()],center:[.5,(top+bottom)/2],opt:{depth:fascia.deckPanel,soft:fascia.deckSurfaceBlend}});
  }
 }
 if(mode!=='closed'&&(front||!fascia.rearTrayDepth)){
  const grp=front?'frontBumper':'rearBumper',triple=front&&mode==='triple',iMode=mode==='split'?'split':'single';
  const wideDucts=front&&c.fogs?.type==='off';
  const pair=wideDucts?[.285,.715]:[.395,.605];
  const deepFrame=front&&c.grille?.type==='deep mesh frame';
  for(const k of deepFrame?(mode==='triple'||mode==='split'?[.183,.817]:[]):triple?[.5,.183,.817]:iMode==='split'?pair:[.5]){
   let cy=(front?.789:.78)+(num(fascia.intakeHeightPosition,.5)-.5)*.29;
   let height=(front?(wideDucts&&iMode==='split'?.23:.19):.14)*(.57+.86*num(fascia.intakeHeight,.5));
   if(!front)cy=Math.max(cy,.685+height*.5);
   cy=Math.min(cy,.975-height*.5);
   const lowerRise=front&&iMode==='single'?num(fascia.lowerIntakeRise,0):0;
   if(lowerRise>0){
    const upper=out.find(o=>o.id==='upper-grille');
    const stop=Math.max(.07,upper?Math.max(...upper.outline.map(p=>p[1]))+.032:0);
    const rise=Math.min(lowerRise,Math.max(0,cy-height/2-stop));
    // Shift only the upper edge. Retain the original chin rail and the
    // width-clearance checks against fog covers/lamp apertures.
    height+=rise;cy-=rise*.5;
   }
   if(triple&&k!==.5){height*=.84;cy=Math.min(.96-height/2,cy+.023);}
   let width=triple?(k===.5?.329:.202)*(.63+.74*num(fascia.intakeWidth,.5)):(iMode==='split'?(wideDucts?.24:.17):.365)*(.63+.74*num(fascia.intakeWidth,.5));
   if(iMode==='split')width=Math.min(width,pair[1]-pair[0]-.014);
   for(const aperture of out){
    const ys=aperture.outline.map(p=>p[1]);if(Math.max(...ys)+.007<cy-height/2||Math.min(...ys)-.007>cy+height/2)continue;
    const xs=aperture.outline.map(p=>p[0]);
    if(aperture.center[0]<k)width=Math.min(width,2*(k-Math.max(...xs)-.008));
    else if(aperture.center[0]>k)width=Math.min(width,2*(Math.min(...xs)-k-.008));
    else if(aperture.style==='vertical')width=0; // Centered tall grille already occupies this portion of fascia.
   }
   if(width<.032)continue;
   out.push(aperture({id:(front?'lower-':'rear-')+'duct'+(k<.48?'-r':k>.52?'-l':''),component:grp,
    housing:fascia.intakeShape??(front?'angular':'trapezoid'),cx:k,cy,width,height,kind:'duct',segments,style:fascia.ductStyle??'mesh',opt:{throatDepth:front?num(fascia.lowerIntakeDepth,0):0,upperBar:front&&iMode==='single'?num(fascia.lowerDuctCap,0):0,matte:num(fascia.lowerDuctMatte,0)}}));
  }
 }
 return out;
}
function spanAt(outline,y){
 const x=[];for(let k=0;k<outline.length;k++){const a=outline[k],b=outline[(k+1)%outline.length];
  if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))x.push(mix(a[0],b[0],(y-a[1])/(b[1]-a[1])));
 }
 return [Math.min(...x),Math.max(...x)];
}
function contains(poly,x,y){
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const [a,b]=poly[i],[c,d]=poly[j];
  if((b>y)!=(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
 }
 return inside;
}
function together(geos){
 if(geos.length<2)return geos[0];
 const A=['position','normal','uv'],data=Object.fromEntries(A.map(k=>[k,[]])),ndx=[];
 let off=0;
 for(const g of geos){
  for(const k of A)data[k].push(...g.attributes[k].array);
  for(const q of g.index.array)ndx.push(q+off);
  off+=g.attributes.position.count;g.dispose();
 }
 const out=new T.BufferGeometry();
 for(const k of A)out.setAttribute(k,new T.Float32BufferAttribute(data[k],k==='uv'?2:3));
 out.setIndex(ndx);return out;
}
function point3(p){return Array.isArray(p)?p:[p.x,p.y,p.z];}
function makeMesh(rows,sign,{disk=null}={}){
 const p=rows.flat();const pos=p.flatMap(v=>v.pos),uv=p.flatMap(v=>v.uv);const fs=[];
 const add=(a,b,c)=>{
  const [A,B,C]=[p[a].pos,p[b].pos,p[c].pos], U=B.map((x,k)=>x-A[k]),V=C.map((x,k)=>x-A[k]);
  const x=U[1]*V[2]-U[2]*V[1], y=U[2]*V[0]-U[0]*V[2],z=U[0]*V[1]-U[1]*V[0];
  if(Math.hypot(x,y,z)<1e-11)return;
  const out=p[a].out??p[b].out??p[c].out;
  if(out?x*out[0]+y*out[1]+z*out[2]>=0:z*sign>=0)fs.push(a,b,c);else fs.push(a,c,b);
 };
 const n=rows[0].length;
 for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){
   const a=j*n+i,b=j*n+(i+1)%n,c=n+a,d=n+b;add(a,b,d);add(a,d,c);
 }
 if(disk){
  const s=p.length,b=p.length-n;p.push(disk);pos.push(...disk.pos);uv.push(...disk.uv);
  for(let i=0;i<n;i++)add(b+i,b+(i+1)%n,s);
 }
 if(!fs.length)return null;
 const geom=new T.BufferGeometry();
 geom.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geom.setIndex(fs);geom.computeVertexNormals();return geom;
}
export function emitOpenings({end,openings,surface,put,lod=false,compact=0,spatialDepth=false,shellMaterial='paint',suppressHeadlamps=false}){
 const front=end==='front',sign=front?1:-1,mounts={},issues=[],batches=new Map();
 for(const a of openings){
  const {outline,center:[cx,cy],opt,kind,width:w,height:h,side}=a;
  const pt=(x,y,d)=>{
   const p=point3(surface(x,y)),uv=[x,1-y];
   if(!spatialDepth)return {pos:[p[0],p[1],p[2]-sign*d],uv};
   const a=new T.Vector3(...surface(Math.min(1,x+.0006),y)).sub(new T.Vector3(...surface(Math.max(0,x-.0006),y)));
   const b=new T.Vector3(...surface(x,Math.min(1,y+.0006))).sub(new T.Vector3(...surface(x,Math.max(0,y-.0006))));
   const out=b.cross(a).normalize().multiplyScalar(sign).toArray();
   return {pos:p.map((k,i)=>k-out[i]*d),out,uv};
  };
  const mount=(layout,d)=>{
   const x=cx+(layout==='twin'||layout==='factory-split'&&front?-.19:layout==='mixed'?-.14:0)*side*w;
   if(!opt.secondaryLamp)mounts[(front?'HeadlightMount_':'TaillightMount_')+(side>0?'L':'R')]=pt(x,cy,d*.47).pos;
  };
  if(front&&kind==='lamp'&&suppressHeadlamps){
   mount(opt.layout,mix(.044,.084,num(opt.recess,.5)));continue;
  }
  const ring=(k,d,poly=outline,x=cx,y=cy)=>poly.map(([u,v])=>pt(mix(x,u,k),mix(y,v,k),d));
  const putGeo=(m,rows,disk=null)=>{
   const q=makeMesh(rows,sign,{disk});
   if(!q)return;
   if(m==='opticCover')return put(a.component,m,q);
   // Painted aperture returns continue the fascia insert on the same
   // atlas as the shell. Only this material uses top-to-bottom chart UV.
   if(m==='paint'&&shellMaterial!=='paint'){
    m=shellMaterial;const uv=q.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));
   }
   const key=a.component+' '+m;
   if(!batches.has(key))batches.set(key,{component:a.component,material:m,geos:[]});
   batches.get(key).geos.push(q);
  };
  if(kind==='sculpted-trim'){
   const {top,bottom,depth}=opt;
   // Loft strips independently over the exact same rim stations used to
   // cut the face, so a thin deep bridge cannot float over a flat bumper.
   const uvAt=(i,t)=>top[i].map((v,k)=>mix(v,bottom[i][k],t));
   const section=(i,t,z)=>pt(...uvAt(i,t),z);
   const strip=(ma,a,b,za,zb)=>{
    const geos=[];
    for(let i=0;i<top.length-1;i++){
     const [A,B,C,D]=[section(i,a,za),section(i+1,a,za),section(i+1,b,zb),section(i,b,zb)];
     const center={pos:A.pos.map((x,k)=>(x+B.pos[k]+C.pos[k]+D.pos[k])*.25),
      uv:A.uv.map((x,k)=>(x+B.uv[k]+C.uv[k]+D.uv[k])*.25),out:A.out};
     geos.push(makeMesh([[A,B,C,D]],sign,{disk:center}));
    }
    const key='rearBumper '+ma;
    if(!batches.has(key))batches.set(key,{component:'rearBumper',material:ma,geos:[]});
    batches.get(key).geos.push(...geos.filter(Boolean));
   };
   strip('seamDark',0,.19,0,.020);
   strip('heatShield',.19,.53,.020,-depth*.72);
   strip('heatShield',.53,.84,-depth*.72,-depth*.20);
   strip('trim',.84,1,-depth*.20,0);
   // End caps cover the small open sections at both tips.
   for(const i of [0,top.length-1]){
    const wall=[section(i,0,0),section(i,.19,.020),section(i,.53,-depth*.72),
     section(i,.84,-depth*.20),section(i,1,0)];
    const c=section(i,.50,.009);putGeo('trim',[wall],c);
   }
   continue;
  }
  if(kind==='exhaust-pocket'){
   putGeo('paint',[ring(1,0),ring(.955,.006)]);
   putGeo('heatShield',[ring(.955,.006),ring(.88,.018)]);
   putGeo('seamDark',[ring(.88,.018),ring(.82,.049),ring(.72,.061)],pt(cx,cy,.062));
   continue;
  }
  if(kind==='light-guide'){
   putGeo('seamDark',[ring(1,0),ring(.93,.004)]);
   putGeo('runningRed',[ring(.93,.004),ring(.78,.002)],pt(cx,cy,.002));
   continue;
  }
  if(kind==='valance'){
   const d=Math.max(.026,opt.depth), face=ring(.924,d);
   putGeo('paint',[ring(1,0),ring(.976,.008)]);
   putGeo('trim',[ring(.976,.008),ring(.947,d*.57),face],pt(cx,cy,d));
   const plateW=w*.143,plateH=h*.23;
   const yPanel=cy-.013;
   const rect=[[cx-plateW,yPanel-plateH],[cx+plateW,yPanel-plateH],
    [cx+plateW,yPanel+plateH],[cx-plateW,yPanel+plateH]];
   putGeo('seamDark',[ring(1,d-.008,rect,cx,yPanel),ring(.955,d-.018,rect,cx,yPanel)]);
   putGeo('heatShield',[ring(.955,d-.018,rect,cx,yPanel)],pt(cx,yPanel,d-.018));
   for(const k of [-1,1]){
    const x=cx+k*w*.312,y=cy+.025,r=w*.058,v=h*.33;
    const p=[[x-r*.78,y-v],[x+r*.76,y-v*.91],[x+r*1.06,y+v],[x-r,y+v*.91]];
    putGeo('seamDark',[ring(1,d-.010,p,x,y),ring(.83,d-.012,p,x,y)],pt(x,y,d-.011));
    for(const t of [.18,.43,.68]){
     const b=y-v+2*v*t,l=x-r*.69,p0=x+r*.69;
     const bars=[[l,b],[p0,b],[p0,b+.006],[l,b+.006]];
     putGeo('trim',[bars.map(([u,v])=>pt(u,v,d-.016))],pt(x,b+.003,d-.016));
    }
    const a=cx+k*w*.392,s=.009,t=h*.28;
    const reflector=[[a-k*s,y-t],[a+k*s,y-t],[a+k*s*1.44,y+t],[a-k*s*.58,y+t]];
    putGeo('opticRed',[reflector.map(([u,v])=>pt(u,v,d-.016))],pt(a,y,d-.016));
   }
   continue;
  }
  if(kind==='deck'){
   // Closed return under the panel: a physical narrow seam, never a slit through the car.
   const soft=num(opt.soft,0),d=mix(.002,.009,num(opt.depth,0));
   const wall=mix(.997,.993,soft),gap=mix(.980,.986,soft),back=mix(.970,.978,soft),panel=mix(.967,.975,soft);
   putGeo('paint',[ring(1,0),ring(wall,.001)]);
   putGeo('seamDark',[ring(wall,.001),ring(gap,d+.002),ring(back,d+.002)]);
   putGeo('paint',[ring(back,d+.002),ring(panel,d),ring(.72,d),ring(.44,d),ring(.18,d)],pt(cx,cy,d));
   continue;
  }
  if(kind==='bypass'){
   const rim=ring(1,0),ledge=ring(.90,.004),back=ring(.77,.027);
   putGeo('paint',[rim,ledge]);putGeo('seamDark',[ledge,back],pt(cx,cy,.029));continue;
  }
  const mouth=ring(1,0); const lip=ring(.965,.005), seat=ring(.912,.015);
  // Shared rim exactly duplicated at d=0 (no opening exists behind a closed slab).
  const grilleBezel=a.id==='upper-grille'?sat(num(opt.bezel,0)):0;
  if(grilleBezel>0){
   const outer=ring(.986,.0018),inner=ring(mix(.967,.931,grilleBezel),.0068);
   putGeo('paint',[mouth,outer]);putGeo('chrome',[outer,inner]);putGeo('trim',[inner,seat]);
  }else{putGeo('paint',[mouth,lip]);putGeo('trim',[lip,seat]);}
  if(kind==='front-guide'){
   putGeo('seamDark',[seat,ring(.85,.021)],pt(cx,cy,.021));
   putGeo('head',[ring(.74,.012),ring(.58,.009)],pt(cx,cy,.009));
   putGeo('opticCover',[ring(.88,.006)],pt(cx,cy,.005));
   continue;
  }
  if(kind==='signal'){
   putGeo('reflector',[seat,ring(.86,.023)],pt(cx,cy,.023));
   putGeo(side>0?'signalR':'signalL',[ring(.895,.012),ring(.78,.009)],pt(cx,cy,.009));
   continue;
  }
  if(kind==='blank'){
   const stamp=sat(num(opt.fogCoverStamp,0));
   // Retain existing loops; the opposing return slope catches highlights
   // at the rim of the pressed insert instead of adding a coplanar decal.
   putGeo('paint',[seat,ring(mix(.88,.84,stamp),mix(.013,.026,stamp)),
    ring(mix(.84,.74,stamp),mix(.010,.021,stamp))],pt(cx,cy,mix(.009,.016,stamp)));continue;
  }
  if(kind==='plate'){
   const show=num(opt.mount,0);
   if(show>0){
    const D=.022+show*.015,innerW=.34*w,innerH=.365*h;
    const rect=[[cx-innerW,cy-innerH],[cx+innerW,cy-innerH],[cx+innerW,cy+innerH],[cx-innerW,cy+innerH]];
    putGeo('paint',[seat,ring(.87,.014),ring(.82,D)],pt(cx,cy,D+.001));
    if(!opt.painted){
     putGeo('trim',[ring(1,D-.002,rect),ring(.95,D-.007,rect)],pt(cx,cy,D-.007));
     putGeo('floor',[ring(.90,D-.008,rect)],pt(cx,cy,D-.008));
    }
    for(const k of [-1,1]){const x=cx+k*innerW*.74,y=cy-innerH*.73,vs=pairs(8,t=>[x+w*.018*Math.cos(t*tau),y+h*.024*Math.sin(t*tau)]);
     putGeo('chrome',[ring(1,D-.010,vs,x,y)],pt(x,y,D-.011));
    }
    continue;
   }
   putGeo('trim',[seat,ring(.87,.020),ring(.82,.031)],pt(cx,cy,.032));
   putGeo('seamDark',[ring(.78,.024),ring(.75,.022)],pt(cx,cy,.021));continue;
  }
  if(kind==='duct'){
   const extra=Math.min(.055,Math.max(0,num(opt.throatDepth,0)));
   const d=.047+extra, back=ring(mix(.79,.88,extra/.055),d);
   const ductMaterial=opt.matte?'ductMatte':opt.upperBar?'seamDark':'trim';
   putGeo(ductMaterial,[seat,ring(mix(.857,.90,extra/.055),.028+extra*.36),back],pt(cx,cy,d-.002));
   const n=compact?(a.style==='bars'?3:4):a.style==='bars'?4:7, inset=outline.map(([x,y])=>[mix(cx,x,.74),mix(cy,y,.73)]);
   // Join a recessed inlet cap to the inner outline, not over the rim.
   // Matching widths at the top/bottom keep the bar inside rounded corners.
   if(opt.upperBar){
    const top=cy-h*.315,bottom=top+h*(.060+.145*opt.upperBar);
    const [tl,tr]=spanAt(inset,top),[bl,br]=spanAt(inset,bottom);
    if(tr>tl&&br>bl){
     const path=[[tl,top],[tr,top],[br,bottom],[bl,bottom]],depth=.018;
     putGeo(opt.matte?'ductMatte':'seamDark',[path.map(([x,y])=>pt(x,y,depth)),path.map(([x,y])=>pt(x,y,depth+.006))],
      pt(cx,(top+bottom)*.5,depth));
    }
   }
   if(a.style==='crosshair'){
    // Disjoint center post and two arms in the real inlet. Trim is
    // restricted to the inset polygon; the mesh behind remains solid.
    const X=w*.048,Y=h*.055;
    const rx=[...spanAt(inset,cy-Y),...spanAt(inset,cy+Y)];
    const rotated=inset.map(([x,y])=>[y,x]);
    const ry=[...spanAt(rotated,cx-X),...spanAt(rotated,cx+X)];
    const L=Math.max(rx[0],rx[2]),R=Math.min(rx[1],rx[3]),B=Math.max(ry[0],ry[2]),U=Math.min(ry[1],ry[3]);
    for(const [x0,y0,x1,y1] of [[cx-X,B,cx+X,U],[L,cy-Y,cx-X,cy+Y],[cx+X,cy-Y,R,cy+Y]]){
     if(!(x1>x0&&y1>y0))continue;
     const q=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
     putGeo('chrome',[q.map(([x,y])=>pt(x,y,.017)),q.map(([x,y])=>pt(x,y,.025))],pt((x0+x1)/2,(y0+y1)/2,.016));
    }
    continue;
   }
   if(a.id==='upper-grille'&&opt.lampPair>0)for(const s of [-1,1]){
    const x=cx+s*w*.245,y=cy,r=w*(.068+.041*opt.lampPair),v=h*(.15+.21*opt.lampPair);
    const chart=(n)=>pairs(compact?10:16,t=>[x+r*n*Math.cos(t*tau),y+v*n*Math.sin(t*tau)]);
    let size=1,p=chart(size);
    for(let i=0;i<6&&!p.every(([u,v])=>contains(inset,u,v));i++)p=chart(size*=.88);
    if(p.every(([u,v])=>contains(inset,u,v))){
     putGeo('trim',[ring(1,.023,p,x,y),ring(.9,.010,p,x,y)]);
     putGeo('chrome',[ring(.9,.010,p,x,y),ring(.76,.008,p,x,y)]);
     putGeo('head',[ring(.76,.008,p,x,y),ring(.57,.007,p,x,y)],pt(x,y,.006));
    }
   }
   if(a.style==='vertical'||a.style==='seven-slot'||a.style==='five-slot'){
    const inner=outline.map(([x,y])=>[mix(cy,y,.86),mix(cx,x,.91)]);
    const jeep=a.style==='seven-slot',five=a.style==='five-slot',slots=jeep||five,slats=jeep?6:five?4:compact?9:11;
    for(let j=0;j<slats;j++){
     const x=cx+w*(slots?.78:.82)*((j+.5)/slats-.5),r=w*(slots?.035:.012);
     const [low,high]=spanAt(inner,x-r),[low2,high2]=spanAt(inner,x+r);
     const lo=Math.max(low,low2),hi=Math.min(high,high2);
     if(hi<=lo)continue;
     const blade=[[x-r,lo],[x+r,lo],[x+r,hi],[x-r,hi]];
     const bladeDepth=v=>blade.map(([u,y])=>pt(u,y,v));
     putGeo(jeep?'paint':five?'trim':'chrome',[bladeDepth(slots?.027:.029),bladeDepth(.035)],pt(x,(lo+hi)/2,.028));
    }
    continue;
   }
   for(let j=0;j<n;j++){
    const y=cy+h*.52*((j+.5)/n-.5),r=h*(a.style==='bars'?.025:.014);
    const [l,rr]=spanAt(inset,y-r*.6),[l2,r2]=spanAt(inset,y+r*.6);
    const lo=Math.max(l,l2),hi=Math.min(rr,r2);
    if(!(hi>lo))continue;
    const bars=[[lo,y-r],[hi,y-r],[hi,y+r],[lo,y+r]];
    putGeo(a.style==='bars'?'chrome':ductMaterial,[bars.map(([x,v])=>pt(x,v,.034+extra*.91)),bars.map(([x,v])=>pt(x,v,.038+extra*.91))],pt((lo+hi)/2,y,.033+extra*.91));
   }
   continue;
  }
  const d=mix(.044,.084,num(opt.recess,.5)), maxProtrusion=num(opt.protrusion,0);
  const bowl=ring(.843,d*.89);
  const silverBack=front&&kind==='lamp'&&opt.silverFront;
  putGeo('trim',[seat,ring(.873,d*.59),bowl],silverBack?null:pt(cx,cy,d));
  // The real assembly reads as one lens: a continuous bright interior
  // behind the separate bowls, with a dark gasket around the outside.
  if(silverBack)putGeo('opticSilver',[bowl],pt(cx,cy,d));
  // A reflector subassembly never breaches the physical setback or housing.
  const oLayout=kind==='fog'?'projector':opt.layout;
  const ellipse=(x,y,rx,ry,n=18)=>pairs(n,t=>[x+rx*Math.cos(t*tau),y+ry*Math.sin(t*tau)]);
  const allowed=outline.map(([u,v])=>[mix(cx,u,.88),mix(cy,v,.88)]);
  function fitted(x,y,rx,ry,n){
   let p;
   for(let i=0;i<8;i++){
    p=ellipse(x,y,rx,ry,n);
    if(p.every(([u,v])=>contains(allowed,u,v)))break;
    x=mix(cx,x,.84);y=mix(cy,y,.76);rx*=.88;ry*=.88;
   }
   return {x,y,p};
  }
  const proj=(offset,rx,ry,bright=true)=>{
   let x0=cx+side*offset*w,y0=cy+.015*h;
   const round=front?num(opt.roundBowls,0):0,flute=front?num(opt.flutedBowls,0):0;
   if(round){
    const probe=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
    const dx=probe(surface(x0+.002,y0),surface(x0-.002,y0)),dy=probe(surface(x0,y0+.002),surface(x0,y0-.002));
    const auto=Math.max(ry*.75,Math.min(.50,rx*w*dx/(Math.max(1e-7,dy)*h)));
    ry=mix(ry,auto,round);rx*=mix(1,1.08,round);y0+=h*.015*round;
   }
   const {x,y,p}=fitted(x0,y0,w*rx,h*ry,compact?9:lod?12:18);
   const rr=(k,depth)=>ring(k,depth,p,x,y).map((q,i)=>{
    if(!flute)return q;
    const a=2*Math.PI*i/p.length;q.uv=[.5+.49*k*Math.cos(a),.5+.49*k*Math.sin(a)];return q;
   });
   if(flute){
    const fg=flute*.12;
    putGeo('reflectorFluted',[rr(1,d*.42),...(compact?[rr(.76,d*(.54+fg)),rr(.39,d*(.77+fg))]:[rr(.92,d*.43),rr(.79,d*(.54+fg)),rr(.58,d*(.68+fg)),rr(.39,d*(.77+fg))])]);
    putGeo('trim',[rr(.54,d*.65),rr(.47,d*.59),rr(.39,d*.60)]);
    putGeo('projector',[rr(.40,d*.581),rr(.29,d*.535),rr(.13,d*.506)],pt(x,y,d*.502));
   }else{
    putGeo('reflector',[rr(1,d*.65),rr(.82,d*.73),rr(.47,d*.80)],pt(x,y,d*.81));
    putGeo(front?'projector':'opticRed',[rr(.51,bright?d*.60:d*.64),rr(.29,d*.55)],pt(x,y,d*.53));
   }
  };
  if(!front&&!opt.rearTriBars&&oLayout==='round-stack'){
   // A broad brake optic and independent red running ring sit behind
   // the outer glass. The small reverse/turn elements remain functional.
   putGeo('runningRed',[ring(.855,d*.425),ring(.705,d*.392),ring(.625,d*.41)]);
   putGeo('opticRed',[ring(.61,d*.49),ring(.48,d*.443),ring(.20,d*.456)],pt(cx,cy,d*.47));
   for(const [mat,sy] of [['opticClear',.264],[side>0?'signalR':'signalL',-.264]]){
    const e=fitted(cx,cy+sy*h,w*.067,h*.047,lod?8:10);
    putGeo(mat,[ring(1,d*.40,e.p,e.x,e.y)],pt(e.x,e.y,d*.395));
   }
  }
  const triBars=!front&&opt.rearTriBars>0;
  if(triBars){
   // Three individually molded red lenses in the factory recess. Leave
   // a lower strip for discreet independent reverse and turn optics.
   const poly=(x,y,rx,ry)=>[[x-rx*.76,y-ry],[x+rx*.76,y-ry],[x+rx,y-ry*.84],[x+rx,y+ry*.84],
    [x+rx*.76,y+ry],[x-rx*.76,y+ry],[x-rx,y+ry*.84],[x-rx,y-ry*.84]];
   for(const n of [-1,0,1]){
    const x=cx+n*w*.247,y=cy-.048*h;
    let scale=1,q=poly(x,y,w*.103,h*.279);
    for(let i=0;i<8&&!q.every(([u,v])=>contains(outline,u,v));i++){
     scale*=.85;q=poly(x,y,w*.103*scale,h*.279*scale);
    }
    if(!q.every(([u,v])=>contains(outline,u,v)))continue;
    putGeo('trim',[ring(1,d*.58,q,x,y),ring(.866,d*.51,q,x,y)]);
    putGeo('runningRed',[ring(.866,d*.51,q,x,y),ring(.79,d*.417,q,x,y)]);
    putGeo('opticRed',[ring(.79,d*.417,q,x,y),ring(.64,d*.385,q,x,y)],pt(x,y,d*.375));
   }
   for(const [m,s] of [['opticClear',-1],[side>0?'signalR':'signalL',1]]){
    const p=fitted(cx+s*w*.18,cy+h*.33,w*.058,h*.042,8);
    putGeo(m,[ring(1,d*.52,p.p,p.x,p.y)],pt(p.x,p.y,d*.51));
   }
  }
  if(oLayout==='factory-split'&&!triBars){
   // Inside the sealed housing, divide the lens into two shallow molded
   // sections, independently of its external profile and cavity.
   const clip=(pol,line,keep)=>{
    const out=[];
    for(let i=0;i<pol.length;i++){
     const a=pol[i],b=pol[(i+1)%pol.length],y=line(a),z=line(b),ai=y*keep>=0,bi=z*keep>=0;
     if(ai)out.push(a);
     if(ai!==bi){const t=y/(y-z);out.push(a.map((q,k)=>mix(q,b[k],t)));}
    }
    return out;
   };
   const plate=(poly,m,depth)=>{
    if(poly.length<3)return;
    const x=poly.reduce((p,q)=>p+q[0],0)/poly.length,y=poly.reduce((p,q)=>p+q[1],0)/poly.length;
    putGeo(m,[ring(1,depth+.004,poly,x,y),ring(.94,depth,poly,x,y)],pt(x,y,depth-.002));
   };
   const line=front?([x,y])=>(y-cy)+.20*(x-cx)*side+h*.17:([x,y])=>y-cy+(x-cx)*side*.13+h*(opt.silverUpper>0?opt.silverUpperSplit:.13);
   const zones=outline.map(([x,y])=>[mix(cx,x,.89),mix(cy,y,.88)]);
   if(front){
    const outer=clip(zones,([x])=>(x-cx)*side+w*.12,1);
    plate(clip(outer,line,-1),side>0?'signalR':'signalL',d*.60);
    if(opt.tripleBowls){proj(-.30,.124,.36);proj(-.011,.124,.35,false);proj(.264,.114,.335,false);}
    else if(opt.flutedBowls){proj(-.34,.200,.38);proj(.072,.177,.358,false);}
    else{proj(-.21,.164,.315);proj(.165,.154,.29,false);}
   }else{
    const redZone=clip(zones,q=>line(q)-.0009,1);
    plate(redZone,'opticRed',d*.46);
    plate(clip(zones,q=>line(q)+.0009,-1),opt.silverUpper>0?'opticSilver':'opticClear',d*.46);
    if(opt.silverUpper>0){
     const lens=fitted(cx-side*w*.09,cy-h*.225,w*.060,h*.066,lod?10:14),lr=(k,dep)=>ring(k,dep,lens.p,lens.x,lens.y);
     putGeo('opticClear',[lr(1,d*.414),lr(.77,d*.392)],pt(lens.x,lens.y,d*.389));
    }
    if(opt.rearCells&&redZone.length>2){
     const center=redZone.reduce(([x,y],p)=>[x+p[0]/redZone.length,y+p[1]/redZone.length],[0,0]);
     const rx0=w*.139,ry0=h*.16;
     for(const slot of [-1,1]){
      // Lens ribs stay inside the red chamber even on extreme swept housings.
      // Both optical functions remain behind the common transparent cover.
      let x=center[0]+side*w*slot*.157,y=center[1]+h*.025,rx=rx0,ry=ry0,poly;
      for(let i=0;i<9;i++){
       poly=ellipse(x,y,rx,ry,compact?10:lod?14:22);
       if(poly.every(p=>contains(redZone,p[0],p[1])))break;
       rx*=.86;ry*=.86;x=mix(center[0],x,.91);y=mix(center[1],y,.93);
      }
      if(rx<rx0*.39||!poly.every(p=>contains(redZone,p[0],p[1])))continue;
      const rr=(k,dep)=>ring(k,dep,poly,x,y);
      putGeo('opticRed',[rr(1,d*.413),rr(.79,d*.306),rr(.57,d*.327)]);
      putGeo('runningRed',[rr(.57,d*.327),rr(.44,d*.343)],pt(x,y,d*.378));
     }
    }else{
     const t=fitted(cx+side*w*.12,cy+h*.19,w*.24,h*.106,lod?12:16);
     putGeo('runningRed',[ring(1,d*.40,t.p,t.x,t.y),ring(.87,d*.36,t.p,t.x,t.y)],pt(t.x,t.y,d*.35));
    }
   }
  }
  if(!triBars&&oLayout==='projector')proj(0,.23,.29);
  if(!triBars&&oLayout==='twin'){proj(-.19,.159,front?.289:.255);proj(.17,.135,front?.268:.227,false);}
  if(!triBars&&oLayout==='mixed')proj(-.14,.16,.227);
  if(!triBars&&oLayout!=='round-stack'&&(oLayout==='led'||oLayout==='mixed'||opt.modules>0)){
   const count=opt.modules||5,spacing=(.42+.26*(opt.spacing??.5))/Math.max(count-1,1);
   for(let i=0;i<count;i++){
    const along=count===1?0:(i-(count-1)*.5)*spacing;
    const {x,y,p:poly}=fitted(cx+side*w*(oLayout==='mixed'?(.13+along*.48):along),cy+(oLayout==='mixed'?.02:-.015)*h,w*Math.min(.037,.19/count),h*.105,lod?6:8);
    putGeo(front?'head':'opticRed',[ring(1,d*.66,poly,x,y),ring(.72,d*.50,poly,x,y)],pt(x,y,d*.48));
   }
  }
  if(!triBars&&kind==='lamp'&&oLayout!=='factory-split'&&oLayout!=='round-stack'){
   const {x,y,p}=fitted(cx+side*w*(oLayout==='twin'?.34:.303),cy+h*.223,w*.058,h*.058,10);
   putGeo(front?(side>0?'signalR':'signalL'):'opticClear',[ring(1,d*.68,p,x,y),ring(.78,d*.54,p,x,y)],pt(x,y,d*.52));
   if(!front){
    const m=fitted(cx-side*w*.23,cy-h*.25,w*.086,h*.072,10);
    putGeo(side>0?'signalR':'signalL',[ring(1,d*.60,m.p,m.x,m.y),ring(.74,d*.48,m.p,m.x,m.y)],pt(m.x,m.y,d*.48));
   }
  }
  // Convex lens follows parametric fascia wrap, with independent radial
  // center curvature; default is recessed and never a solid white face.
  if(!triBars&&!front&&oLayout!=='factory-split'&&oLayout!=='round-stack'){
   const strip=fitted(cx,cy+h*.24,w*.31,h*.072,lod?10:14);
   putGeo('runningRed',[ring(1,d*.37,strip.p,strip.x,strip.y),ring(.87,d*.34,strip.p,strip.x,strip.y)],pt(strip.x,strip.y,d*.34));
  }
  const coverOuter=mix(.010,.017,num(opt.curvature,.5))-maxProtrusion*.010;
  const convex=mix(.002,.012,num(opt.convexity,.5));
  const coverCenter=coverOuter-convex;
  putGeo('opticCover',[ring(.925,coverOuter),...(compact?[ring(.48,coverOuter-convex*.76)]:[ring(.68,coverOuter-convex*.53),ring(.31,coverOuter-convex*.89)])],pt(cx,cy,coverCenter));
  if(kind==='lamp')mount(oLayout,d);
 }
 for(const {component,material,geos} of batches.values())put(component,material,together(geos));
 return {mounts,issues};
}
