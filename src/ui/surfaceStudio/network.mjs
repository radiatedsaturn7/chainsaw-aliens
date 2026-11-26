/**
 * Shared-boundary WRX hood/fender/front-bumper patch adapter.
 * +X right, +Y up, +Z forward, all coordinates metres.
 *
 * fender.eval(s,t): s door→nose, t hood→arch/bumper. Station arrays
 * fender.sValues, fender.tValues are the preferred tessellation links;
 * numeric sCount/tCount (segments) or fender.samples.{s,t} also work.
 * Right half meshes run from outer seam to center; mirror if needed.
 */
const EPS=1e-5;
const GAP=.0035;
const TURN=13*Math.PI/180;
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,k)=>a.map(v=>v*k);
const dot=(a,b)=>a.reduce((r,v,i)=>r+v*b[i],0);
const length=a=>Math.sqrt(dot(a,a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const reject=(a,b)=>sub(a,mul(b,dot(a,b)));
const unit=a=>{const m=length(a);return m>1e-9 ? mul(a,1/m) : null;};
const lerp=(a,b,t)=>add(mul(a,1-t),mul(b,t));
const angle=(a,b)=>180/Math.PI*Math.acos(clamp(dot(unit(a)||[1,0,0],unit(b)||[1,0,0]),-1,1));
const finitePoint=(p,label)=> {
  if(!p||p.length!==3||!Array.from(p).every(Number.isFinite)) throw new TypeError(`Invalid fender point at ${label}`);
  return Array.from(p);
};
function stationValues(spec,fallback) {
  if (spec==null)spec=fallback;
  if (typeof spec==='number') {
    if(!Number.isInteger(spec)||spec<2||spec>160) throw new RangeError('Station count must be an integer 2..160');
    return Array.from({length:spec+1},(_,i)=>i/spec);
  }
  if(spec?.values&&typeof spec.values!=='function')spec=spec.values;
  const values=Array.from(spec);
  if(values.length<2||values.length>161||values[0]!==0||values.at(-1)!==1||
     values.some((v,i)=>!Number.isFinite(v)||i>0&&v<=values[i-1])) {
    throw new RangeError('Stations must rise monotonically over [0,1], including endpoints');
  }
  return values;
}
function hermite(p,q,a,b,u) {
  const v=u*u,w=v*u;
  return add(add(mul(p,2*w-3*v+1),mul(q,-2*w+3*v)),add(mul(a,w-2*v+u),mul(b,w-v)));
}
const stats=xs=>({min:Math.min(...xs),max:Math.max(...xs)});
const mm=a=>1000*a;
function grid(points,cols,normals) {
  const positions=points.flat();
  const indices=[];
  const push=(a,b,c)=>{
    const n=cross(sub(points[b],points[a]),sub(points[c],points[a]));
    const m=length(n);
    if(m<1e-10) throw new RangeError('Degenerate network triangle');
    // Uniform patch orientation: row axis × inboard axis faces into the car.
    indices.push(a,c,b);
  };
  for(let i=0;i<points.length/cols-1;i++)for(let j=0;j<cols-1;j++) {
    const a=i*cols+j,b=a+cols;push(a,b,b+1);push(a,b+1,a+1);
  }
  return {positions,indices,normals:normals.flat()};
}
export function buildNetwork(fender) {
  if(typeof fender?.eval!=='function')throw new TypeError('fender.eval(s,t) is required');
  const options=fender.network||{};
  const gap=options.gap??GAP;
  if(!(gap>=.003 && gap<=.004))throw new RangeError('Vehicle panels require a 3–4 mm nominal shut line');
  const fetched=(s,t)=>finitePoint(fender.eval(s,t),`(${s},${t})`);
  const sSamples=stationValues(fender.sValues??fender.samples?.s??fender.rails?.hood??fender.sCount,36);
  const tSamples=stationValues(fender.tValues??fender.samples?.t??fender.rails?.bumper??fender.tCount,16);
  const strips=stationValues(options.crossStations??[0,.025,.06,.12,.2,.32,.46,.60,.74,.86,.95,1],12);
  const diff=(s,t,d)=>{
    const u=d==='s'?s:t,a=Math.max(0,u-EPS),b=Math.min(1,u+EPS);
    const p=d==='s'?fetched(a,t):fetched(s,a);
    const q=d==='s'?fetched(b,t):fetched(s,b);
    return mul(sub(q,p),1/(b-a));
  };
  const useFrame=(s,t,which)=>{
    const p=fetched(s,t);
    const rawRail=diff(s,t,which==='hood'?'s':'t');
    const fallbackRail=which==='hood'?[0,0,1]:[0,-1,0];
    const rail=unit(rawRail)||fallbackRail;
    const across=diff(s,t,which==='hood'?'t':'s');
    const f=unit(reject(across,rail));
    if(!f)throw new RangeError(`Fender tangent collapses at ${which} seam (${s},${t})`);
    const away=which==='hood'?mul(f,-1):f; // hood inboard; bumper toward nose
    if(which==='hood'&&away[0]>=-.07)throw new RangeError('Hood edge derivative must point into the fender on +X');
    if(which==='bumper'&&away[2]<=.06)throw new RangeError('Nose edge derivative must point forward on +Z');
    return {p,rail,away,start:add(p,mul(away,gap))};
  };

  // Analytic hood derivative matches fender post-projection exactly at the
  // gap. Ease up to the center crown and use a horizontal center tangent
  // for mirroring; no shading/material trick is involved.
  function hood(s,u,frame=useFrame(s,0,'hood')){
    const p=frame.start;
    const crown=.016+.022*Math.sin(Math.PI*s)**.78;
    const frontLead=.108*s**4;
    const q=[0,p[1]+crown,p[2]+frontLead];
    const tangent=mul(frame.away,clamp(p[0]*.68,.18,.49));
    const center=[-.86*p[0],0,0];
    return hermite(p,q,tangent,center,u);
  }
  const leadFrame=useFrame(1,0,'hood'), topFrame=useFrame(1,0,'bumper');
  const hoodCorner=hood(1,0,leadFrame);
  const sharedCorner=sub(topFrame.start,hoodCorner);
  // The normal-to-seam gap gets slightly wider only at the three-panel
  // intersection. Away from that singular corner the bumper follows the
  // same leading hood row with exactly 3.5 mm physical separation.
  function bumperTop(u){
    const p=hood(1,u,leadFrame);
    const before=Math.max(0,u-EPS),after=Math.min(1,u+EPS);
    const tangent=u===1?[-1,0,0]:unit(sub(hood(1,after,leadFrame),hood(1,before,leadFrame)))||[-1,0,0];
    const target=unit(reject([0,-.57,.822],tangent))||[0,-.57,.822];
    const weight=smooth(u/.13);
    return add(p,lerp(sharedCorner,mul(target,gap),weight));
  }
  const scheduledTurn=TURN;
  const quarterFrame=frame=>{
    const normal=unit(cross(frame.rail,frame.away));
    let inboard=normal||[-1,0,0];
    if(inboard[0]>0)inboard=mul(inboard,-1);
    return add(mul(frame.away,Math.cos(scheduledTurn)),mul(inboard,Math.sin(scheduledTurn)));
  };
  function bumperFree(t,u,frame){
    const p=frame.start;
    const depth=.104+.054*Math.sin(Math.PI*t)**1.22;
    const q=[0,p[1]+.006*Math.sin(Math.PI*t),p[2]+depth];
    return hermite(p,q,mul(quarterFrame(frame),.225),[-.92*p[0],0,0],u);
  }
  function bumper(t,u,frame=useFrame(1,t,'bumper')){
    const root=bumperFree(t,u,frame);
    // Align top of the bumper with hood's actual front shutline. The top
    // repair dies out before the lower lip and is zero along outside edge.
    // Use a tight vertical blend to avoid moving the bumper lower profile.
    return add(root,mul(sub(bumperTop(u),bumperFree(0,u,topFrame)), Math.exp(-((t/.31)**2))*(1-smooth((t-.83)/.17))));
  }
  const hoodFrames=sSamples.map(s=>useFrame(s,0,'hood'));
  const bumperFrames=tSamples.map(t=>useFrame(1,t,'bumper'));
  const hoodRows=sSamples.map((s,i)=>strips.map(u=>hood(s,u,hoodFrames[i])));
  const bumperRows=tSamples.map((t,i)=>strips.map(u=>bumper(t,u,bumperFrames[i])));
  // Normals of the actual Hermite sheets and gap fields, sampled from their
  // derivatives, not inferred from the fender render normal or material.
  const differentialNormal=(name,row,u)=>{
    const evalSheet=name==='hood'?hood:bumper;
    const r0=Math.max(0,row-EPS),r1=Math.min(1,row+EPS),u0=Math.max(0,u-EPS),u1=Math.min(1,u+EPS);
    const a=sub(evalSheet(r1,u),evalSheet(r0,u));
    const b=sub(evalSheet(row,u1),evalSheet(row,u0));
    const normal=unit(mul(cross(a,b),1/((r1-r0)*(u1-u0))));
    if(!normal)throw new RangeError('Network sheet normal singular at '+name+':'+row+','+u);
    return mul(normal,-1);
  };
  const hoodNormals=sSamples.flatMap(s=>strips.map(u=>differentialNormal('hood',s,u)));
  const bumperNormals=tSamples.flatMap(t=>strips.map(u=>differentialNormal('bumper',t,u)));
  const boundaries={
    hoodFender:hoodFrames.map(f=>f.p),hoodPanel:hoodRows.map(r=>r[0]),
    bumperFender:bumperFrames.map(f=>f.p),bumperPanel:bumperRows.map(r=>r[0]),
    hoodNose:hoodRows.at(-1),bumperTop:bumperRows[0],
  };
  const pairDistances=(a,b)=>a.map((p,i)=>mm(length(sub(p,b[i]))));
  const hoodAngles=hoodFrames.map((f,i)=>angle(f.away,sub(hood(sSamples[i],EPS,f),hoodRows[i][0])));
  const bumperAngles=bumperFrames.map((f,i)=>angle(f.away,sub(bumper(tSamples[i],EPS,f),bumperRows[i][0])));
  const problems=[];
  if(Math.max(...hoodAngles)>.1)problems.push('hood tangent drift exceeds 0.1°');
  if(Math.min(...bumperAngles.slice(2))<8)problems.push('bumper fold hidden by top-joint blend');
  const diagnostics={
    units:'metres',
    layout:'right halves; each row starts on the physical gap and ends at the mirror plane',
    gapTargetMm:mm(gap),
    hoodToFenderMm:stats(pairDistances(boundaries.hoodFender,boundaries.hoodPanel)),
    bumperToFenderMm:stats(pairDistances(boundaries.bumperFender,boundaries.bumperPanel)),
    bumperToHoodMm:stats(pairDistances(boundaries.hoodNose,boundaries.bumperTop)),
    threeWayCornerGapMm:mm(length(sharedCorner)),
    hoodTangentResidualDegrees:stats(hoodAngles),
    bumperFoldDegrees:stats(bumperAngles),
    bumperLowerFoldDegrees:stats(bumperAngles.filter((v,i)=>tSamples[i]>=.78)),
    intendedBumperFoldDegrees:13,
    problems
  };
  return {
    hood:grid(hoodRows.flat(),strips.length,hoodNormals),
    bumper:grid(bumperRows.flat(),strips.length,bumperNormals),
    boundaries, samples:{s:sSamples,t:tSamples,cross:strips}, diagnostics,
  };
}
