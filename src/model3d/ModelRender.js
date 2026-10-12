import * as THREE from '../vendorBridge/three.js';
import {faceNormal} from './ModelDocument.js';
import {sampleAnimation,skinVertices} from './ModelRig.js';

export function triangulateFace(model, face) {
  const normal=faceNormal(model,face),components=[Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)],drop=components.indexOf(Math.max(...components));
  const points=face.vertices.map(id=>model.vertices.find(v=>v.id===id).position.filter((_,i)=>i!==drop));
  return THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(...p)),[]);
}
function materialTexture(source){
  if(!source?.pixels)return null;
  const data=new Uint8Array(source.width*source.height*4),color=new THREE.Color();
  for(let i=0;i<source.pixels.length;i++){
    const pixel=source.pixels[i];if(!pixel)continue;
    color.set(String(pixel).slice(0,7));const rgb=color.clone().convertLinearToSRGB();
    data.set([Math.round(rgb.r*255),Math.round(rgb.g*255),Math.round(rgb.b*255),String(pixel).length===9?parseInt(pixel.slice(7),16):255],i*4);
  }
  const texture=new THREE.DataTexture(data,source.width,source.height,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=true;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;
  texture.needsUpdate=true;return texture;
}
export function buildModelObject(model){
  const root=new THREE.Group();root.name=model.name;root.userData.modelDocument=model;
  const materials=new Map(model.materials.map(m=>[m.id,new THREE.MeshStandardMaterial({color:m.color||'#ffffff',map:materialTexture(m.texture),side:THREE.DoubleSide,roughness:0.8,transparent:true,alphaTest:0.01})]));
  for(const material of model.materials){
    const vertices=[],uvs=[],vertexIds=[],faceIds=[];
    for(const face of model.faces.filter(f=>f.material===material.id))for(const triangle of triangulateFace(model,face))for(const index of triangle){
      const vertex=model.vertices.find(v=>v.id===face.vertices[index]);vertices.push(...vertex.position);uvs.push(...face.uv[index]);vertexIds.push(vertex.id);faceIds.push(face.id);
    }
    if(!vertices.length)continue;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,materials.get(material.id));mesh.userData.vertexIds=vertexIds;mesh.userData.faceIds=faceIds;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  }
  root.userData.materials=[...materials.values()];return root;
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
  for(const material of root.userData.materials||[]){material.map?.dispose();material.dispose();}
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
  constructor({cacheSize=1}={}){this.cacheSize=cacheSize;this.roots=new Map();this.renderer=null;this.model=null;this.root=null;this.revision=null;}
  frameModel(model){this.framing=getModelFrame(model);}
  ensure(){
    if(this.renderer)return true;if(typeof document==='undefined')return false;
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(1);
    this.scene=new THREE.Scene();this.scene.add(new THREE.HemisphereLight(0xffffff,0x35403a,2));
    const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(3,5,7);this.scene.add(light);return true;
  }
  draw(ctx,bounds,model,{revision=0,view='orbit',yaw=0.7,pitch=0.35,zoom=1,pan=[0,0,0],clip=null,time=0,pose=null,wireframe=false,transform=null}={}){
    if(!this.ensure())return false;
    if(!this.framing)this.frameModel(model);
    if(this.model!==model||this.revision!==revision){
      if(this.root)this.scene.remove(this.root);
      const cached=this.roots.get(model);
      if(cached&&cached.revision!==revision){disposeModelObject(cached.root);this.roots.delete(model);}
      const entry=this.roots.get(model)||{root:buildModelObject(model),revision};
      this.roots.delete(model);this.roots.set(model,entry);
      while(this.roots.size>this.cacheSize){const [key,old]=this.roots.entries().next().value;disposeModelObject(old.root);this.roots.delete(key);}
      this.root=entry.root;this.scene.add(this.root);this.model=model;this.revision=revision;
    }
    this.root.position.fromArray(transform?.position||[0,0,0]);
    this.root.rotation.set(...(transform?.rotation||[0,0,0]));
    this.root.scale.fromArray(transform?.scale||[1,1,1]);
    updateModelPose(this.root,model,{clip,time,pose});for(const material of this.root.userData.materials)material.wireframe=wireframe;
    const width=Math.max(1,Math.round(bounds.w)),height=Math.max(1,Math.round(bounds.h)),aspect=width/height;
    this.renderer.setSize(width,height,false);
    const extent=this.framing.extent;
    const target=new THREE.Vector3(...this.framing.center).add(new THREE.Vector3(...pan));
    const span=extent/Math.max(0.05,zoom),distance=extent*2.5;
    const camera=view==='orbit'?new THREE.PerspectiveCamera(40,aspect,0.01,100000):new THREE.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,0.01,100000);
    const direction=view==='x'?new THREE.Vector3(1,0,0):view==='y'?new THREE.Vector3(0,1,0):view==='z'?new THREE.Vector3(0,0,1):new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    camera.position.copy(target).addScaledVector(direction,view==='orbit'?distance/zoom:distance);if(view==='y')camera.up.set(0,0,-1);camera.lookAt(target);camera.updateMatrixWorld();
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
  dispose(){for(const {root} of this.roots.values())disposeModelObject(root);this.roots.clear();this.model=null;this.renderer?.dispose();this.renderer=null;this.root=null;this.framing=null;}
}

export function ensureModelSceneLighting(scene){
  if(scene.userData.rtgModelLights)return;
  const fill=new THREE.HemisphereLight(0xffffff,0x35403a,2);
  const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(3,5,7);
  fill.name='rtgModelFill';sun.name='rtgModelSun';scene.add(fill,sun);scene.userData.rtgModelLights={fill,sun};
}
