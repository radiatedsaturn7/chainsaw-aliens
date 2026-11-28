import {applyAutomotiveEnvironment,automotiveMaterial,automotivePilotEnabled} from './AutomotiveMaterials.js';
import {benchmarkNormals,wrxMaterialKind,wrxPilotMaterial} from './WrxVisualPilot.js';
import * as THREE from '../vendorBridge/three.js';
import {faceNormal} from './ModelDocument.js';
import {sampleAnimation,skinVertices} from './ModelRig.js';

export function triangulateFace(model, face, vertexForId = id => model.vertices.find(v => v.id === id), preserveWinding = false) {
  // Earcut emits consistent 2D winding in the chosen dominant projection,
  // not the mesh's authored 3D orientation. With different drop axes,
  // that can flip neighboring triangles and prevent their normal weld.
  if(preserveWinding&&face.vertices.length===3)return [[0,1,2]];
  const normal=faceNormal(model,face,vertexForId),components=[Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)],drop=components.indexOf(Math.max(...components));
  const positions=face.vertices.map(id=>vertexForId(id).position);
  const points=positions.map(p=>p.filter((_,i)=>i!==drop));
  const triangles=THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(...p)),[]);
  if(preserveWinding){
    // Dominant-plane projection retains polygon area. Match each ear's
    // orientation to the sign of the original outline in that same plane.
    const area=points.reduce((sum,p,i)=>{
      const q=points[(i+1)%points.length];return sum+p[0]*q[1]-p[1]*q[0];
    },0);
    for(const triangle of triangles){
      const [a,b,c]=triangle.map(i=>points[i]);
      if(area*((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<0)
        [triangle[1],triangle[2]]=[triangle[2],triangle[1]];
    }
  }
  return triangles;
}
function materialTexture(source, dataMap=false){
  if(!source?.pixels)return null;
  const {width,height,pixels}=source;
  // Base-color hex values are already sRGB bytes. An ORM or tangent normal
  // map uses the same authoring container but its bytes are linear data.
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
     width>4096||height>4096||pixels.length!==width*height)return null;
  const data=new Uint8Array(width*height*4);
  for(let i=0;i<pixels.length;i++){
    const pixel=pixels[i];if(!pixel)continue;
    const rgb=parseInt(pixel.slice(1,7),16), at=i*4;
    data[at]=rgb>>16;data[at+1]=(rgb>>8)&255;data[at+2]=rgb&255;
    data[at+3]=pixel.length===9?parseInt(pixel.slice(7),16):255;
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);
  texture.colorSpace=dataMap?THREE.NoColorSpace:THREE.SRGBColorSpace;
  texture.flipY=true;texture.magFilter=dataMap?THREE.LinearFilter:THREE.NearestFilter;
  const mip=dataMap&&THREE.MathUtils.isPowerOfTwo(width)&&THREE.MathUtils.isPowerOfTwo(height);
  texture.minFilter=mip?THREE.LinearMipmapLinearFilter:texture.magFilter;
  texture.generateMipmaps=mip;
  texture.needsUpdate=true;return texture;
}
// Conservative vehicle-only defaults, not a migration of authored assets.
export function classifyVehicleMaterial(name){
  const label=String(name??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  if(/\b(decal|emissive|light|lens|optic|gauge|logo|mask|badge|sticker|stripe|screen|reflector|lightbar)\b/.test(label))return null;
  if(/\b(glass|glazing|windshield|windscreen)\b/.test(label)&&!/\b(trim|seal|frame|gasket|rubber)\b/.test(label))return 'glass';
  if(/\b(rubber|tire|tyre|tread|sidewall)\b/.test(label))return 'rubber';
  if(/\b(alloy|rim)\b/.test(label))return 'alloy';
  if(/\b(chrome|steel|machined|aluminum|aluminium|rotor)\b/.test(label))return 'machined';
  if(/\b(rolled metal|vinyl|plastics?|trim)\b/.test(label))return 'trim';
  if(/\b(upholstery|carpet|seat fabric)\b/.test(label))return 'upholstery';
  if(/\b(paint|painted|enamel|clearcoat|bodypaint|bodywork|coachwork)\b/.test(label)||/^(body|body main|main body|car body)$/.test(label))return 'paint';
  return null;
}
function automotiveSpecification(material,wrxPart,automotive){
  const authored=material.automotive;
  if(!automotive)return null;
  if(authored&&typeof authored.preset==='string')return authored;
  if(!wrxPart){
    const preset=classifyVehicleMaterial(material.name);
    if(!preset||preset!=='glass'&&modelMaterialNeedsBlending(material))return null;
    // Keep existing pixel sampler, alpha, and normals; don't paint over
    // textures or smooth deliberate low-poly edges on unnamed parts.
    return {preset,creaseAngle:0,keepTextureSampling:true,
      reflection:preset==='paint'?.55:preset==='glass'?.55:preset==='alloy'?.62:preset==='machined'?.54:.36};
  }
  const label=(material.name||'').toLowerCase();
  if(label==='headlamp clear polycarbonate cover')return {preset:'clear-cover'};
  const known=wrxMaterialKind(material.name,wrxPart);
  if(known)return {preset:known};
  if(/chrome|steel|machined|reflector|clamp|rotor|fastener/.test(label))return {preset:'machined'};
  if(/seat|upholstery|carpet/.test(label))return {preset:'upholstery'};
  return {preset:'trim'};
}
export function modelMaterialNeedsBlending(material) {
  if(material.automotive?.preset==='gltf-pbr'){
    if(material.automotive.alphaMode==='blend')return true;
    if(material.automotive.alphaMode==='mask'||material.automotive.alphaMode==='opaque')return false;
  }
  // Binary alpha is an alpha-tested cutout. Only fractional alpha requires
  // sorting/blending (and the two-sided transparent model render passes).
  return Boolean(material.texture?.pixels?.some(pixel => {
    if (typeof pixel !== 'string' || pixel.length !== 9) return false;
    const alpha = parseInt(pixel.slice(7), 16);
    return alpha > 0 && alpha < 255;
  }));
}
export function buildModelObject(model,{wrxPart=null,automotive=(wrxPart&&automotivePilotEnabled)}={}){
  const verticesById = new Map();
  // Match Array.find on duplicate IDs and strict equality (which never matches NaN).
  for (const vertex of model.vertices) {
    if (!Number.isNaN(vertex.id) && !verticesById.has(vertex.id)) verticesById.set(vertex.id, vertex);
  }
  const vertexForId = id => verticesById.get(id);
  const root=new THREE.Group();root.name=model.name;root.userData.modelDocument=model;
  const materials=new Map(model.materials.map(m=>{
    const options={color:m.color||'#ffffff',map:materialTexture(m.texture),side:THREE.DoubleSide,
      roughness:.8,transparent:modelMaterialNeedsBlending(m),alphaTest:.01};
    const spec=automotiveSpecification(m,wrxPart,automotive);
    if(spec?.preset==='gltf-pbr'){
      options.side=spec.doubleSided?THREE.DoubleSide:THREE.FrontSide;
      options.opacity=spec.opacity??1;
      options.alphaTest=spec.alphaMode==='mask'?spec.alphaCutoff??.5:0;
      options.emissive=spec.emissive??'#000000';
      options.emissiveIntensity=spec.emissiveIntensity??1;
      options.depthWrite=!options.transparent;
    }
    let surface=null;
    if(spec){
      const ormMap=materialTexture(spec.orm,true),normalMap=materialTexture(spec.normal,true);
      surface=automotiveMaterial(options,spec,{ormMap,normalMap});
      if(!surface){ormMap?.dispose();normalMap?.dispose();}
    }
    return [m.id,surface||(wrxPart ? wrxPilotMaterial(options,m.name,wrxPart) : new THREE.MeshStandardMaterial(options))];
  }));
  root.userData.wrxVisualPilot=wrxPart;
  for(const material of model.materials){
    const vertices=[],uvs=[],vertexIds=[],faceIds=[],authoredCorners=[];
    const automotiveSurface=materials.get(material.id).userData.automotive;
    for(const face of model.faces.filter(f=>f.material===material.id))for(const triangle of triangulateFace(model,face,vertexForId,Boolean(automotiveSurface)))for(const index of triangle){
      const vertex=vertexForId(face.vertices[index]);vertices.push(...vertex.position);uvs.push(...face.uv[index]);vertexIds.push(vertex.id);faceIds.push(face.id);
      const n=automotiveSurface&&face.cornerNormals?.[index];
      if(Array.isArray(n)&&n.length===3&&n.every(Number.isFinite)){
        const len=Math.hypot(...n);
        if(len>.001) authoredCorners.push(vertexIds.length-1,n[0]/len,n[1]/len,n[2]/len);
      }
    }
    if(!vertices.length)continue;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const kind=wrxMaterialKind(material.name,wrxPart);
    if(automotiveSurface?.crease>0){
      benchmarkNormals(geometry,automotiveSurface.crease,true);
    }else if(kind&&!automotiveSurface){
      const stampedFenders=/stamped-door enamel/i.test(material.name);
      benchmarkNormals(geometry,kind==='paint'?72:kind==='rubber'?52:44,stampedFenders);
    }
    // Panel cut-outs inherit source-cage normals, avoiding a fan of flat
    // triangles around the cut without changing topology or affecting other models.
    for(let i=0;i<authoredCorners.length;i+=4)
      geometry.attributes.normal.setXYZ(authoredCorners[i],authoredCorners[i+1],authoredCorners[i+2],authoredCorners[i+3]);
    const mesh=new THREE.Mesh(geometry,materials.get(material.id));mesh.material.name=material.name||'';mesh.userData.vertexIds=vertexIds;mesh.userData.faceIds=faceIds;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  }
  root.userData.materials=[...materials.values()];
  root.userData.automotiveMaterials=root.userData.materials.filter(m=>m.userData.automotive);
  return root;
}
export function updateModelPose(root,model,{clip=null,time=0,pose=null}={}){
  const points=new Map(skinVertices(model,pose||sampleAnimation(model,clip,time)).map(v=>[v.id,v.position]));
  for(const mesh of root.children){
    const attribute=mesh.geometry.getAttribute('position');mesh.userData.vertexIds.forEach((id,index)=>attribute.setXYZ(index,...points.get(id)));
    attribute.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
  }
}
export function disposeModelObject(root){
  for(const mesh of root.children)mesh.geometry?.dispose();
  for(const material of root.userData.materials||[]){
    material.map?.dispose();
    // All three ORM fields refer to one linear image. Shared environments
    // are owned by the pipeline, never by an individual vehicle.
    material.aoMap?.dispose();material.normalMap?.dispose();material.dispose();
  }
}

export function getModelFrame(model) {
  const box=new THREE.Box3();
  for(const vertex of model.vertices)box.expandByPoint(new THREE.Vector3(...vertex.position));
  return {center:box.isEmpty()?[0,0,0]:box.getCenter(new THREE.Vector3()).toArray(),
    extent:box.isEmpty()?2:Math.max(0.5,box.getSize(new THREE.Vector3()).length())};
}

// Shared canvas renderer for editor work surfaces and side-view Level assets.
// Race integration can attach buildModelObject directly to its existing scene.
export class ModelCanvasRenderer {
  constructor({cacheSize=1,authoredVehiclePreview=false}={}){this.cacheSize=cacheSize;this.authoredVehiclePreview=authoredVehiclePreview;this.roots=new Map();this.renderer=null;this.model=null;this.root=null;this.revision=null;}
  frameModel(model){this.framing=getModelFrame(model);}
  ensure(){
    if(this.renderer)return true;if(typeof document==='undefined')return false;
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(1);
    this.scene=new THREE.Scene();this.scene.add(new THREE.HemisphereLight(0xffffff,0x35403a,2));
    const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(3,5,7);this.scene.add(light);return true;
  }
  draw(ctx,bounds,model,{revision=0,view='orbit',yaw=0.7,pitch=0.35,zoom=1,pan=[0,0,0],clip=null,time=0,pose=null,wireframe=false,grid=false,transform=null}={}){
    if(!this.ensure())return false;
    if(!this.framing)this.frameModel(model);
    if(this.model!==model||this.revision!==revision){
      if(this.root)this.scene.remove(this.root);
      const cached=this.roots.get(model);
      if(cached&&cached.revision!==revision){disposeModelObject(cached.root);this.roots.delete(model);}
      let entry=this.roots.get(model);
      if(!entry){
        const authoredVehicle=this.authoredVehiclePreview&&model.materials.some(material=>typeof material.automotive?.preset==='string');
        const root=buildModelObject(model,{automotive:authoredVehicle});
        if(authoredVehicle)applyAutomotiveEnvironment(root,'studio',this.renderer);
        entry={root,revision,authoredVehicle,restBuffers:null};
      }
      this.roots.delete(model);this.roots.set(model,entry);
      while(this.roots.size>this.cacheSize){const [key,old]=this.roots.entries().next().value;disposeModelObject(old.root);this.roots.delete(key);}
      this.root=entry.root;this.scene.add(this.root);this.model=model;this.revision=revision;
    }
    this.root.position.fromArray(transform?.position||[0,0,0]);
    this.root.rotation.set(...(transform?.rotation||[0,0,0]));
    this.root.scale.fromArray(transform?.scale||[1,1,1]);
    const entry=this.roots.get(model);
    if(!entry.authoredVehicle){
      updateModelPose(this.root,model,{clip,time,pose});
    }else if(clip||Object.keys(pose||{}).length){
      // Pose edits still deform the preview. Retain exactly the authored bind
      // surface once, so exiting a pose restores the production corner normals.
      entry.restBuffers ||= this.root.children.map(mesh=>['position','normal'].map(name=>mesh.geometry.getAttribute(name).array.slice()));
      updateModelPose(this.root,model,{clip,time,pose});
    }else if(entry.restBuffers){
      this.root.children.forEach((mesh,i)=>{
        for(const [j,name] of ['position','normal'].entries()){
          const attribute=mesh.geometry.getAttribute(name);
          attribute.array.set(entry.restBuffers[i][j]);attribute.needsUpdate=true;
        }
        mesh.geometry.computeBoundingSphere();
      });
      entry.restBuffers=null;
    }
    for(const material of this.root.userData.materials)material.wireframe=wireframe;
    const width=Math.max(1,Math.round(bounds.w)),height=Math.max(1,Math.round(bounds.h)),aspect=width/height;
    this.renderer.setSize(width,height,false);
    const extent=this.framing.extent;
    const target=new THREE.Vector3(...this.framing.center).add(new THREE.Vector3(...pan));
    const span=extent/Math.max(0.05,zoom),distance=extent*2.5;
    const camera=view==='orbit'?new THREE.PerspectiveCamera(40,aspect,0.01,100000):new THREE.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,0.01,100000);
    const direction=view==='x'?new THREE.Vector3(1,0,0):view==='y'?new THREE.Vector3(0,1,0):view==='z'?new THREE.Vector3(0,0,1):new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    camera.position.copy(target).addScaledVector(direction,view==='orbit'?distance/zoom:distance);if(view==='y')camera.up.set(0,0,-1);camera.lookAt(target);camera.updateMatrixWorld();
    if(grid&&!this.grid){this.grid=new THREE.GridHelper(20,20,0x668899,0x334952);this.scene.add(this.grid);}
    if(this.grid){this.grid.visible=grid;this.grid.rotation.set(view==='z'?Math.PI/2:0,0,view==='x'?Math.PI/2:0);}
    this.camera=camera;this.bounds={...bounds};this.renderer.render(this.scene,camera);ctx.drawImage(this.renderer.domElement,bounds.x,bounds.y,bounds.w,bounds.h);return true;
  }
  project(position){if(!this.camera||!this.bounds)return null;const p=new THREE.Vector3(...position).project(this.camera),b=this.bounds;return {x:b.x+(p.x+1)*b.w/2,y:b.y+(1-p.y)*b.h/2,z:p.z};}
  pickFace(x,y){
    if(!this.root||!this.camera)return null;const b=this.bounds,ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((x-b.x)/b.w*2-1,1-(y-b.y)/b.h*2),this.camera);
    const hit=ray.intersectObject(this.root,true)[0];return hit?{id:hit.object.userData.faceIds[hit.faceIndex*3],uv:hit.uv,point:hit.point}:null;
  }
  unprojectToPlane(x,y,origin=[0,0,0]){
    if(!this.camera)return origin;const b=this.bounds,ray=new THREE.Raycaster(),normal=new THREE.Vector3();this.camera.getWorldDirection(normal);
    ray.setFromCamera(new THREE.Vector2((x-b.x)/b.w*2-1,1-(y-b.y)/b.h*2),this.camera);
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,new THREE.Vector3(...origin)),out=new THREE.Vector3();
    return ray.ray.intersectPlane(plane,out)?out.toArray():origin;
  }
  dispose(){if(this.grid){this.grid.geometry.dispose();this.grid.material.dispose();this.grid=null;}for(const {root} of this.roots.values())disposeModelObject(root);this.roots.clear();this.model=null;this.renderer?.dispose();this.renderer=null;this.root=null;this.framing=null;}
}

export function ensureModelSceneLighting(scene){
  if(scene.userData.rtgModelLights)return;
  const fill=new THREE.HemisphereLight(0xffffff,0x35403a,2);
  const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(3,5,7);
  fill.name='rtgModelFill';sun.name='rtgModelSun';scene.add(fill,sun);scene.userData.rtgModelLights={fill,sun};
}
