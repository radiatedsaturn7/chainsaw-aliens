// Compact static Studio models. Geometry is quantized, not simplified;
// stock hardpoints, material definitions, and names remain full precision.
const FORMAT='lotg-studio-pack-2';
const POSITION=1e5, UV=32767, NORMAL=32767;
const MAX_VERTICES=100000, MAX_FACES=15000;
const bytesPer={u16:2,i16:2,u32:4,i32:4};
const getters={u16:'getUint16',i16:'getInt16',u32:'getUint32',i32:'getInt32'};
const setters={u16:'setUint16',i16:'setInt16',u32:'setUint32',i32:'setInt32'};
const bounds={u16:[0,65535],i16:[-32768,32767],u32:[0,4294967295],i32:[-2147483648,2147483647]};
const pack=(kind,values)=>{
 const [lo,hi]=bounds[kind],step=bytesPer[kind],bytes=new Uint8Array(values.length*step);
 const view=new DataView(bytes.buffer);
 for(let i=0;i<values.length;i++){
  const n=values[i];if(!Number.isInteger(n)||n<lo||n>hi)throw Error('Studio mesh attribute out of range');
  view[setters[kind]](i*step,n,true);
 }
 const parts=[];
 for(let i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
 return btoa(parts.join(''));
};
const unpack=(kind,encoded,length)=>{
 const step=bytesPer[kind],maxString=Math.ceil(length*step/3)*4;
 if(typeof encoded!=='string'||encoded.length!==maxString)throw Error('Wrong packed Studio mesh attribute length');
 const raw=atob(encoded);
 if(raw.length!==length*step)throw Error('Truncated Studio mesh attribute');
 const bytes=Uint8Array.from(raw,chr=>chr.charCodeAt(0)), view=new DataView(bytes.buffer);
 return i=>view[getters[kind]](i*step,true);
};
const numId=(id,prefix)=>{
 if(typeof id!=='string'||!new RegExp('^'+prefix+'-(0|[1-9][0-9]*)$').test(id))throw Error('Invalid Studio mesh ID');
 return Number(id.slice(2));
};
const noOtherKeys=(object,keys)=>Object.keys(object).every(k=>keys.includes(k));
const xyzw=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
function encodeModel(model){
 const {vertices,faces,rearAxleModel,...meta}=model;
 if(!vertices.length||vertices.length>MAX_VERTICES||!faces.length||faces.length>MAX_FACES)throw Error('Invalid static Studio mesh size');
 const ids=[],positions=[],fids=[],idx=[],uv=[],norms=[],mIdx=[],cIdx=[],materials=new Map(),components=new Map();
 const dict=(m,k)=>{if(!m.has(k))m.set(k,m.size);return m.get(k);};
 for(const v of vertices){
  if(!noOtherKeys(v,['id','position','weights'])||!Array.isArray(v.weights)||v.weights.length||!xyzw(v.position,3))throw Error('Studio pack supports static unweighted vertices');
  ids.push(numId(v.id,'v'));positions.push(...v.position.map(n=>Math.round(n*POSITION)));
 }
 for(const f of faces){
  if(!noOtherKeys(f,['id','vertices','uv','cornerNormals','material','component'])
   ||f.vertices?.length!==3||f.uv?.length!==3||f.cornerNormals?.length!==3
   ||!f.uv.every(v=>xyzw(v,2))||!f.cornerNormals.every(v=>xyzw(v,3))
   ||typeof f.material!=='string'||typeof f.component!=='string')throw Error('Unsupported Studio triangle attributes');
  fids.push(numId(f.id,'f'));idx.push(...f.vertices.map(id=>numId(id,'v')));
  uv.push(...f.uv.flat().map(n=>Math.round((n+.5)*UV)));
  norms.push(...f.cornerNormals.flat().map(n=>Math.round(n*NORMAL)));
  mIdx.push(dict(materials,f.material));cIdx.push(dict(components,f.component));
 }
 return {meta,v:ids.length,f:fids.length,vi:pack('u32',ids),p:pack('i32',positions),
  fi:pack('u32',fids),i:pack('u32',idx),uv:pack('u16',uv),n:pack('i16',norms),
  md:[...materials.keys()],mi:pack('u16',mIdx),cd:[...components.keys()],ci:pack('u16',cIdx),
  ...(rearAxleModel?{rear:encodeModel(rearAxleModel)}:{})};
}
function decodeModel(doc,depth=0){
 const {meta,v,f,md,cd}=doc??{};
 if(meta?.kind!=='rtg-model'||!Number.isInteger(v)||!Number.isInteger(f)||v<1||v>MAX_VERTICES||f<1||f>MAX_FACES
  ||!Array.isArray(md)||!Array.isArray(cd)||!md.every(x=>typeof x==='string')||!cd.every(x=>typeof x==='string')
  ||depth>1)throw Error('Invalid compact Studio model');
 const vi=unpack('u32',doc.vi,v),p=unpack('i32',doc.p,v*3),
 fi=unpack('u32',doc.fi,f),i=unpack('u32',doc.i,f*3),uv=unpack('u16',doc.uv,f*6),n=unpack('i16',doc.n,f*9),
 mi=unpack('u16',doc.mi,f),ci=unpack('u16',doc.ci,f);
 const ids=new Map(),vertices=Array.from({length:v},(_,k)=>{
  const key=vi(k),id='v-'+key;
  if(ids.has(key))throw Error('Duplicate compact Studio vertex');
  ids.set(key,id);
  return {id,position:[p(k*3)/POSITION,p(k*3+1)/POSITION,p(k*3+2)/POSITION],weights:[]};
 });
 const faces=Array.from({length:f},(_,k)=>{
  const vertices=[ids.get(i(k*3)),ids.get(i(k*3+1)),ids.get(i(k*3+2))],material=md[mi(k)],component=cd[ci(k)];
  if(vertices.includes(undefined)||material===undefined||component===undefined)throw Error('Invalid compact Studio face reference');
  return {id:'f-'+fi(k),vertices,uv:Array.from({length:3},(_,j)=>[uv(k*6+j*2)/UV-.5,uv(k*6+j*2+1)/UV-.5]),
   cornerNormals:Array.from({length:3},(_,j)=>[n(k*9+j*3)/NORMAL,n(k*9+j*3+1)/NORMAL,n(k*9+j*3+2)/NORMAL]),material,component};
 });
 return {...meta,vertices,faces,...(doc.rear?{rearAxleModel:decodeModel(doc.rear,depth+1)}:{})};
}
export const encodeStudioRosterPair=({body,wheel})=>({format:FORMAT,body:encodeModel(body),wheel:encodeModel(wheel)});
// Old packs remain readable during rollout and while browsers hold cached files.
export const decodeStudioRosterPair=value=>value?.format===FORMAT
 ?{body:decodeModel(value.body),wheel:decodeModel(value.wheel)}
 :value;
