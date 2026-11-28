const cache=new Map();
const clamps=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const hex=n=>Math.round(clamps(n)*255).toString(16).padStart(2,'0');
const pixels=(w,h,fn)=>({width:w,height:h,pixels:Array.from({length:w*h},(_,i)=>'#'+fn(i%w,Math.floor(i/w)).map(hex).join(''))});
function surface(key,x,y,W,H){
 const u=x/W,v=y/H,noise=.5+.5*Math.sin(x*12.9898+y*78.233)*Math.cos(7*y-3*x);
 if(key==='rotor'){
  const r=Math.hypot(u-.5,v-.5),band=.57+.08*Math.sin(r*770)+.05*noise;
  return {z:.18*Math.sin(r*450),r:band,m:.30,ao:r<.22?.57:.91};
 }
 if(key==='barrel')return {z:.04*Math.cos(v*40),r:.51+.08*noise,m:.49,ao:.53+.37*v};
 if(key==='tire'){
  const tread=Math.abs(v-.5)<.25;
  const track=Math.cos((u*14+Math.abs(v-.5)*4)*2*Math.PI);
  return {z:tread?.31*track:.05*Math.sin(v*160),r:tread?.94:.82+.06*noise,m:0,ao:tread?.83+.14*Math.abs(track):.97};
 }
 if(['seat','floor','leather','cloth'].includes(key)){
  const a=2*Math.PI;
  return {z:.08*Math.cos(u*15*a)*Math.sin(v*14*a)+.06*noise,r:.78+.19*noise,m:0,ao:.90+.10*noise};
 }
 if(key==='reflectorFluted'){
  const X=u-.5,Y=v-.5,a=Math.atan2(Y,X),rr=Math.hypot(X,Y);
  const flutes=Math.cos(18*a)*Math.min(1,rr*7),rib=Math.cos(rr*72);
  return {z:.25*flutes+.055*rib,r:.18+.11*(.5+.5*rib),m:.94,ao:.61+.32*Math.min(1,rr*3)};
 }
 if(['opticRed','opticClear','head','indicator','reflector','projector'].includes(key)){
  const c=Math.sin(u*138)+Math.cos(v*117);
  return {z:c*.064,r:key==='reflector'?.28:.33+.12*noise,m:key==='reflector'?.80:0,ao:.77+.20*noise};
 }
 return {z:0,r:.75,m:0,ao:1};
}
export function studioMaps(key){
 if(!['rotor','barrel','tire','seat','floor','leather','cloth','opticRed','opticClear','head','indicator','reflector','reflectorFluted','projector'].includes(key))return {};
 if(cache.has(key))return cache.get(key);
 const W=key==='rotor'||key==='tire'||key==='reflectorFluted'?32:16,H=W;
 const at=(x,y)=>surface(key,(x+W)%W,(y+H)%H,W,H);
 const orm=pixels(W,H,(x,y)=>{const c=at(x,y);return [c.ao,c.r,c.m];});
 const normal=pixels(W,H,(x,y)=>{
  const u=(at(x-1,y).z-at(x+1,y).z)*.55,v=(at(x,y-1).z-at(x,y+1).z)*.55,n=Math.hypot(u,v,1);
  return [.5+.5*u/n,.5+.5*v/n,.5+.5/n];
 });
 const d={orm,normal};cache.set(key,d);return d;
}
export function studioTextureBytes(materials,{mipmaps=true}={}){
 let base=0,maps=0;const seen=new Set();
 for(const m of materials)if(!seen.has(m.id)){
  seen.add(m.id);
  if(m.texture)base+=m.texture.width*m.texture.height*4;
  for(const k of ['orm','normal'])if(m.automotive?.[k])maps+=4*m.automotive[k].width*m.automotive[k].height*(mipmaps?4/3:1);
 }
 return {baseBytes:base,dataBytes:Math.round(maps),totalBytes:Math.round(base+maps)};
}
