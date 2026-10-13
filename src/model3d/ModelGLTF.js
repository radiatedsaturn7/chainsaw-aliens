import * as THREE from '../vendorBridge/three.js';
import {GLTFLoader} from '../../vendor/three-addons/loaders/GLTFLoader.js';
import {createModelDocument,addVertex,joinPolygon,modelId,validateModelDocument} from './ModelDocument.js';
import {addAnimation,setKeyframe} from './ModelRig.js';

function readTexture(texture){
  const image=texture?.image;if(!image)return null;
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas'),ratio=Math.min(1,1024/Math.max(image.width,image.height));
  canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,pixels=[];
  for(let i=0;i<data.length;i+=4)pixels.push('#'+[...data.slice(i,i+4)].map(n=>n.toString(16).padStart(2,'0')).join(''));
  return {width:canvas.width,height:canvas.height,pixels};
}
export function convertGLTFScene(gltf,name='Imported model'){
  const model=createModelDocument(name),scene=gltf.scene,nodes=[],nodeIds=new Map(),materials=new Map();scene.updateMatrixWorld(true);
  scene.traverse(node=>{nodes.push(node);nodeIds.set(node.uuid,modelId(model,'joint'));});
  for(const node of nodes)model.joints.push({id:nodeIds.get(node.uuid),name:node.name||node.type,parent:nodeIds.get(node.parent?.uuid)||null,position:node.position.toArray(),rotation:node.quaternion.toArray(),scale:node.scale.toArray()});
  for(const node of nodes.filter(n=>n.isMesh)){
    const geometry=node.geometry,positions=geometry.getAttribute('position');if(!positions)continue;
    if(geometry.morphAttributes.position?.length)throw Error('Morph-target animation is not yet editable; import a bone-animated model');
    const uv=geometry.getAttribute('uv'),skinIndex=geometry.getAttribute('skinIndex'),skinWeight=geometry.getAttribute('skinWeight');
    const sourceMaterials=Array.isArray(node.material)?node.material:[node.material];
    for(const source of sourceMaterials)if(!materials.has(source.uuid)){
      const id=modelId(model,'material');materials.set(source.uuid,id);model.materials.push({id,name:source.name||'Imported material',color:'#'+source.color.getHexString(),texture:readTexture(source.map)});
    }
    const inverseWorld=node.matrixWorld.clone().invert(),ids=[];
    for(let i=0;i<positions.count;i++){
      const point=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld);ids.push(addVertex(model,point.toArray()));
      const vertex=model.vertices.at(-1);
      if(node.isSkinnedMesh&&skinIndex&&skinWeight){
        for(let lane=0;lane<4;lane++){
          const boneIndex=skinIndex.getComponent(i,lane),weight=skinWeight.getComponent(i,lane),bone=node.skeleton.bones[boneIndex];
          if(!bone||weight<=0)continue;
          const bindMatrix=node.skeleton.boneInverses[boneIndex].clone().multiply(node.bindMatrix).multiply(inverseWorld);
          vertex.weights.push({joint:nodeIds.get(bone.uuid),weight,bindMatrix:bindMatrix.toArray()});
        }
      }else vertex.weights=[{joint:nodeIds.get(node.uuid),weight:1}];
    }
    const indices=geometry.index?Array.from(geometry.index.array):ids.map((_,i)=>i);
    for(let i=0;i<indices.length;i+=3){
      const corners=indices.slice(i,i+3),group=geometry.groups.find(g=>i>=g.start&&i<g.start+g.count),source=sourceMaterials[group?.materialIndex||0]||sourceMaterials[0];
      const faceId=joinPolygon(model,corners.map(index=>ids[index]),materials.get(source.uuid));
      model.faces.find(f=>f.id===faceId).uv=corners.map(index=>{const point=uv?[uv.getX(index),uv.getY(index)]:[0,0];return source.map?.flipY===false?[point[0],1-point[1]]:point;});
    }
  }
  const rest=nodes.map(node=>({node,position:node.position.clone(),rotation:node.quaternion.clone(),scale:node.scale.clone()}));
  for(const animation of gltf.animations||[]){
    if(animation.tracks.some(t=>t.name.endsWith('.morphTargetInfluences')))throw Error('Import bone animation instead of morph targets');
    const id=addAnimation(model,animation.name||'Animation',animation.duration||1),mixer=new THREE.AnimationMixer(scene),action=mixer.clipAction(animation);
    action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
    const times=new Set([0,animation.duration]);for(const track of animation.tracks)for(const time of track.times)times.add(time);
    for(let frame=0;frame<=Math.ceil(animation.duration*30);frame++)times.add(Math.min(animation.duration,frame/30));
    for(const time of [...times].sort((a,b)=>a-b)){mixer.setTime(time);for(const node of nodes)setKeyframe(model,id,nodeIds.get(node.uuid),time,{position:node.position.toArray(),rotation:node.quaternion.toArray(),scale:node.scale.toArray()});}
    mixer.stopAllAction();mixer.uncacheRoot(scene);for(const value of rest){value.node.position.copy(value.position);value.node.quaternion.copy(value.rotation);value.node.scale.copy(value.scale);}
  }
  if(!model.faces.length)throw Error('The model contains no triangle meshes');return validateModelDocument(model);
}
export async function importGLTFFiles(files){
  const main=Array.from(files).find(f=>/\.(gltf|glb)$/i.test(f.name));if(!main)throw Error('Choose a glTF or GLB model');
  const manager=new THREE.LoadingManager(),urls=new Map();
  manager.setURLModifier(url=>{
    if(/^(data:|blob:)/.test(url))return url;
    const name=decodeURIComponent(url.split('/').at(-1)),file=Array.from(files).find(f=>f.name===name);
    if(!file)throw Error(`Select the companion file ${name} along with the model`);
    if(!urls.has(name))urls.set(name,URL.createObjectURL(file));return urls.get(name);
  });
  try{const gltf=await new GLTFLoader(manager).parseAsync(await main.arrayBuffer(),'');return convertGLTFScene(gltf,main.name.replace(/\.(gltf|glb)$/i,''));}
  finally{for(const url of urls.values())URL.revokeObjectURL(url);}
}
