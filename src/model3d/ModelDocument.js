import * as THREE from '../vendorBridge/three.js';

const clone = value => structuredClone(value);
const vector = value => new THREE.Vector3(...(value || [0, 0, 0]));
const axes = ['x', 'y', 'z'];
export function createModelDocument(name = 'Untitled Model') {
  return { kind: 'rtg-model', schemaVersion: 1, name, nextId: 1,
    vertices: [], faces: [], joints: [], animations: [],
    materials: [{ id: 'material-0', name: 'Default', color: '#b7d2c5', texture: null }],
    symmetry: { x: false, y: false, z: false }, backgrounds: {} };
}
export function modelId(model, prefix) { return `${prefix}-${model.nextId++}`; }
export function addVertex(model, position) {
  if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) throw Error('Enter three finite coordinates');
  const vertex = { id: modelId(model, 'v'), position: [...position], weights: [] };
  model.vertices.push(vertex); return vertex.id;
}
export function faceNormal(model, face) {
  const points = face.vertices.map(id => vector(model.vertices.find(v => v.id === id)?.position));
  const n = new THREE.Vector3();
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y);
  }
  return n.normalize();
}
export function joinPolygon(model, ids, material = 'material-0') {
  if (ids.length < 3 || new Set(ids).size !== ids.length || ids.some(id => !model.vertices.some(v => v.id === id))) throw Error('Select at least three different vertices in polygon order');
  const face = { id: modelId(model, 'f'), vertices: [...ids], uv: ids.map(() => [0, 0]), material };
  if (faceNormal(model, face).lengthSq() < 1e-10) throw Error('A polygon needs non-collinear vertices');
  model.faces.push(face); return face.id;
}
export function addPrimitive(model, type = 'box', { size = 1, position = [0, 0, 0], segments = 12 } = {}) {
  if (!(size > 0) || !Number.isFinite(size)) throw Error('Shape size must be positive');
  segments = Math.max(3, Math.min(64, Math.round(segments)));
  const constructors = { box: () => new THREE.BoxGeometry(size,size,size),
    sphere: () => new THREE.SphereGeometry(size / 2,segments,Math.max(3,Math.floor(segments / 2))),
    cylinder: () => new THREE.CylinderGeometry(size/2,size/2,size,segments),
    cone: () => new THREE.ConeGeometry(size/2,size,segments), plane: () => new THREE.PlaneGeometry(size,size),
    torus: () => new THREE.TorusGeometry(size/2,size/6,8,segments) };
  if (!constructors[type]) throw Error('Unknown shape');
  const geometry = constructors[type](), positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  const unique = new Map(), remap = [], added = [];
  for (let i = 0; i < positions.count; i++) {
    const point = [positions.getX(i)+position[0],positions.getY(i)+position[1],positions.getZ(i)+position[2]];
    const key = point.map(n => Math.round(n*1e7)).join(',');
    if (!unique.has(key)) { const id = addVertex(model,point); unique.set(key,id); added.push(id); }
    remap[i] = unique.get(key);
  }
  const indices = geometry.index ? Array.from(geometry.index.array) : remap.map((_,i)=>i);
  const faces = [];
  for (let i = 0; i < indices.length; i += 3) {
    const corners = indices.slice(i,i+3), ids = corners.map(index => remap[index]);
    if (new Set(ids).size !== 3) continue;
    const id = joinPolygon(model,ids); const face = model.faces.at(-1);
    face.uv = corners.map(index => [uv.getX(index),uv.getY(index)]); faces.push(id);
  }
  geometry.dispose(); return { vertices: added, faces };
}
export function moveVertices(model, ids, delta, { symmetry = model.symmetry, tolerance = 1e-5 } = {}) {
  if (!delta.every(Number.isFinite)) throw Error('Invalid movement');
  const original = model.vertices.map(v => ({ id:v.id, position:[...v.position] })), updates = new Map();
  const enabled = axes.map((a,i)=>symmetry?.[a]?i:-1).filter(i=>i>=0);
  for (const id of ids) {
    const vertex = original.find(v=>v.id===id); if (!vertex) continue;
    for (let mask=0;mask<2**enabled.length;mask++) {
      const signs = [1,1,1]; enabled.forEach((axis,bit)=>{if(mask&(1<<bit))signs[axis]=-1;});
      const target = vertex.position.map((n,i)=>n*signs[i]);
      for (const match of original.filter(v=>v.position.every((n,i)=>Math.abs(n-target[i])<=tolerance))) {
        const next = match.position.map((n,i)=>enabled.includes(i)&&Math.abs(n)<=tolerance?0:n+delta[i]*signs[i]);
        if (!updates.has(match.id) || mask === 0) updates.set(match.id,next);
      }
    }
  }
  for (const v of model.vertices) if(updates.has(v.id))v.position=updates.get(v.id);
}
export function extrudeFaces(model, ids, distance = 0.25) {
  if (!Number.isFinite(distance) || Math.abs(distance)<1e-8) throw Error('Extrusion distance must be nonzero');
  const selected=model.faces.filter(f=>ids.includes(f.id));if(!selected.length)throw Error('Select faces to extend');
  const normals=new Map(),edges=new Map();
  for(const face of selected){
    const normal=faceNormal(model,face);
    for(let i=0;i<face.vertices.length;i++){
      const a=face.vertices[i],b=face.vertices[(i+1)%face.vertices.length];
      if(!normals.has(a))normals.set(a,new THREE.Vector3());normals.get(a).add(normal);
      const key=[a,b].sort().join('|');const old=edges.get(key);
      edges.set(key,{a,b,count:(old?.count||0)+1,material:face.material});
    }
  }
  const remap=new Map();
  for(const [id,normal] of normals){
    const original=model.vertices.find(v=>v.id===id);const point=vector(original.position).addScaledVector(normal.normalize(),distance);
    const next=addVertex(model,point.toArray());model.vertices.at(-1).weights=clone(original.weights);remap.set(id,next);
  }
  const capIds=[];
  for(const face of selected){face.vertices=face.vertices.map(id=>remap.get(id));capIds.push(face.id);}
  for(const edge of edges.values())if(edge.count===1){
    const id=joinPolygon(model,[edge.a,edge.b,remap.get(edge.b),remap.get(edge.a)],edge.material);
    model.faces.find(f=>f.id===id).uv=[[0,0],[1,0],[1,1],[0,1]];
  }
  return {vertices:[...remap.values()],faces:capIds};
}
export function weldVertices(model, ids) {
  if(ids.length!==2 || ids[0]===ids[1])throw Error('Select exactly two vertices to weld');
  const vertices=ids.map(id=>model.vertices.find(v=>v.id===id));if(vertices.some(v=>!v))throw Error('Vertex not found');
  const [keep,remove]=vertices;keep.position=vector(keep.position).add(vector(remove.position)).multiplyScalar(0.5).toArray();
  const weights=new Map();for(const w of [...keep.weights,...remove.weights])weights.set(w.joint,(weights.get(w.joint)||0)+w.weight/2);
  keep.weights=[...weights].map(([joint,weight])=>({joint,weight}));
  model.vertices=model.vertices.filter(v=>v.id!==remove.id);
  model.faces=model.faces.filter(face=>{
    const corners=face.vertices.map((id,i)=>({id:id===remove.id?keep.id:id,uv:face.uv[i]}));
    const seen=new Set(),unique=corners.filter(c=>{if(seen.has(c.id))return false;seen.add(c.id);return true;});
    face.vertices=unique.map(c=>c.id);face.uv=unique.map(c=>c.uv);return unique.length>=3&&faceNormal(model,face).lengthSq()>1e-10;
  });return keep.id;
}
export function copyGeometry(model, {vertices=[],faces=[]}={}) {
  const selectedFaces=model.faces.filter(f=>faces.includes(f.id)||f.vertices.every(id=>vertices.includes(id)));
  const ids=new Set([...vertices,...selectedFaces.flatMap(f=>f.vertices)]);
  return {vertices:clone(model.vertices.filter(v=>ids.has(v.id))),faces:clone(selectedFaces)};
}
export function pasteGeometry(model, clipboard, {offset=[0,0,0],mirror=null}={}) {
  if(!clipboard?.vertices?.length)throw Error('Copy some geometry first');
  const remap=new Map(),addedFaces=[];
  for(const vertex of clipboard.vertices){
    const position=vertex.position.map((n,i)=>(axes[i]===mirror?-n:n)+offset[i]);
    const id=addVertex(model,position);model.vertices.at(-1).weights=clone(vertex.weights).filter(w=>model.joints.some(j=>j.id===w.joint));remap.set(vertex.id,id);
  }
  for(const original of clipboard.faces){
    const ids=original.vertices.map(id=>remap.get(id)),uv=clone(original.uv);
    if(mirror){ids.reverse();uv.reverse();}
    const id=joinPolygon(model,ids,original.material);model.faces.at(-1).uv=uv;addedFaces.push(id);
  }
  return {vertices:[...remap.values()],faces:addedFaces};
}
export function deleteGeometry(model, {vertices=[],faces=[]}={}) {
  model.faces=model.faces.filter(f=>!faces.includes(f.id)&&!f.vertices.some(id=>vertices.includes(id)));
  model.vertices=model.vertices.filter(v=>!vertices.includes(v.id));
}
export function generateUVMap(model, faceIds=model.faces.map(f=>f.id)) {
  const faces=model.faces.filter(f=>faceIds.includes(f.id)),columns=Math.ceil(Math.sqrt(faces.length));
  faces.forEach((face,index)=>{
    const normal=faceNormal(model,face);const drop=[Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)].indexOf(Math.max(Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)));
    const projected=face.vertices.map(id=>model.vertices.find(v=>v.id===id).position.filter((_,i)=>i!==drop));
    const min=[0,1].map(i=>Math.min(...projected.map(p=>p[i]))),max=[0,1].map(i=>Math.max(...projected.map(p=>p[i])));
    face.uv=projected.map(p=>p.map((n,i)=>((i===0?index%columns:Math.floor(index/columns))+0.04+0.92*(n-min[i])/Math.max(1e-8,max[i]-min[i]))/columns));
  });
}
export function paintTexture(model, materialId, u, v, color, radius=1) {
  const material=model.materials.find(m=>m.id===materialId);if(!material)throw Error('Select a material');
  material.texture ||= {width:128,height:128,pixels:Array(128*128).fill('#ffffff')};
  const texture=material.texture,x=Math.round(u*(texture.width-1)),y=Math.round((1-v)*(texture.height-1));
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
    const px=x+dx,py=y+dy;if(dx*dx+dy*dy>radius*radius||px<0||py<0||px>=texture.width||py>=texture.height)continue;
    texture.pixels[py*texture.width+px]=color;
  }
}
export function validateModelDocument(model) {
  if(model?.kind!=='rtg-model'||model.schemaVersion!==1)throw Error('Unsupported 3D model document');
  const collections=['vertices','faces','joints','animations','materials'];
  const allIds=new Set();let nextId=1;
  for(const key of collections){
    if(!Array.isArray(model[key]))throw Error(`Missing ${key}`);
    for(const entry of model[key]){
      if(typeof entry?.id!=='string'||!entry.id||allIds.has(entry.id))throw Error(`Invalid or duplicate ${key} id`);
      allIds.add(entry.id);const suffix=Number(entry.id.match(/-(\d+)$/)?.[1]);if(Number.isSafeInteger(suffix))nextId=Math.max(nextId,suffix+1);
    }
  }
  const tuple=(value,size)=>Array.isArray(value)&&value.length===size&&value.every(Number.isFinite);
  const transform=value=>tuple(value.position,3)&&tuple(value.rotation,4)&&value.rotation.some(n=>n!==0)&&tuple(value.scale,3);
  const vertices=new Set(model.vertices.map(v=>v.id)),joints=new Map(model.joints.map(j=>[j.id,j])),materials=new Set(model.materials.map(m=>m.id));
  if(!materials.size)throw Error('A model needs a material');
  for(const vertex of model.vertices){
    if(!tuple(vertex.position,3))throw Error('Invalid vertex position');vertex.weights||=[];
    if(!Array.isArray(vertex.weights))throw Error('Invalid vertex weights');
    for(const w of vertex.weights)if(!joints.has(w.joint)||!Number.isFinite(w.weight)||w.weight<0||w.weight>1||(w.bindMatrix&&!tuple(w.bindMatrix,16)))throw Error('Invalid joint influence');
  }
  for(const face of model.faces){
    if(!Array.isArray(face.vertices)||face.vertices.length<3||new Set(face.vertices).size!==face.vertices.length||face.vertices.some(id=>!vertices.has(id))||!Array.isArray(face.uv)||face.uv.length!==face.vertices.length||face.uv.some(uv=>!tuple(uv,2))||!materials.has(face.material))throw Error('Invalid polygon');
  }
  for(const joint of model.joints){
    if(!transform(joint))throw Error('Invalid joint transform');
    const ancestors=new Set([joint.id]);let parent=joint.parent;
    while(parent){if(!joints.has(parent)||ancestors.has(parent))throw Error('Invalid joint hierarchy');ancestors.add(parent);parent=joints.get(parent).parent;}
  }
  for(const clip of model.animations){
    if(!Number.isFinite(clip.duration)||clip.duration<=0||!clip.tracks||typeof clip.tracks!=='object')throw Error('Invalid animation');
    for(const [id,keys] of Object.entries(clip.tracks)){
      if(!joints.has(id)||!Array.isArray(keys))throw Error('Invalid animation joint');let previous=-1;
      for(const key of keys){if(!Number.isFinite(key.time)||key.time<0||key.time>clip.duration||key.time<=previous||!transform(key))throw Error('Invalid animation keyframe');previous=key.time;}
    }
  }
  for(const material of model.materials){
    const texture=material.texture;if(!texture)continue;
    if(!Number.isInteger(texture.width)||!Number.isInteger(texture.height)||texture.width<1||texture.height<1||texture.width>4096||texture.height>4096||!Array.isArray(texture.pixels)||texture.pixels.length!==texture.width*texture.height||texture.pixels.some(p=>p!==null&&!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(p)))throw Error('Invalid material texture');
  }
  model.nextId=Math.max(nextId,Number.isSafeInteger(model.nextId)?model.nextId:1);
  model.symmetry||={x:false,y:false,z:false};model.backgrounds||={};
  return model;
}
export class ModelHistory {
  constructor(limit=50){this.undoStack=[];this.redoStack=[];this.limit=limit;}
  apply(model,label,edit){const before=clone(model);try{const result=edit(model);validateModelDocument(model);if(JSON.stringify(before)!==JSON.stringify(model)){this.undoStack.push({label,model:before});if(this.undoStack.length>this.limit)this.undoStack.shift();this.redoStack=[];}return result;}catch(error){for(const key of Object.keys(model))delete model[key];Object.assign(model,before);throw error;}}
  restore(model,redo=false){const from=redo?this.redoStack:this.undoStack,to=redo?this.undoStack:this.redoStack;if(!from.length)return model;const entry=from.pop();to.push({label:entry.label,model:clone(model)});return clone(entry.model);}
}
