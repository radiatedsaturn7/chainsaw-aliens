import * as THREE from '../vendorBridge/three.js';
import {GLTFLoader} from '../../vendor/three-addons/loaders/GLTFLoader.js';
import {createModelDocument,addVertex,joinPolygon,modelId,validateModelDocument} from './ModelDocument.js';
import {addAnimation,setKeyframe} from './ModelRig.js';

function readTexture(texture) {
  const image=texture?.image;if(!image)return null;
  const ratio=Math.min(1,1024/Math.max(image.width,image.height));
  const width=Math.max(1,Math.round(image.width*ratio)),height=Math.max(1,Math.round(image.height*ratio));
  if(texture.isDataTexture&&image.data instanceof Uint8Array&&image.data.length===image.width*image.height*4&&ratio===1)
    return {width,height,data:image.data};
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
  ctx.drawImage(image,0,0,width,height);
  return {width,height,data:ctx.getImageData(0,0,width,height).data};
}
const byteHex=Array.from({length:256},(_,v)=>v.toString(16).padStart(2,'0'));
function textureDocument(width,height,rgba) {
  const pixels=new Array(width*height);
  for(let i=0;i<pixels.length;i++)pixels[i]='#'+rgba(i).map(v=>byteHex[v]).join('');
  return {width,height,pixels};
}
const colorTexture=image=>image&&textureDocument(image.width,image.height,i=>Array.from(image.data.subarray(i*4,i*4+4)));
function compatibleMap(texture,flipY) {
  return texture&& !texture.isCompressedTexture && Number(texture.channel||0)===0&&
    (texture.flipY===false)===flipY&&texture.offset.x===0&&texture.offset.y===0&&
    texture.repeat.x===1&&texture.repeat.y===1&&texture.rotation===0&&texture.matrixAutoUpdate!==false;
}
function ormTexture(source,flipY) {
  const map=key=>compatibleMap(source[key],flipY)?readTexture(source[key]):null;
  const ao=map('aoMap'),rough=map('roughnessMap'),metal=source.metalnessMap===source.roughnessMap?rough:map('metalnessMap');
  if(!ao&&!rough&&!metal)return null;
  const width=Math.max(ao?.width||1,rough?.width||1,metal?.width||1);
  const height=Math.max(ao?.height||1,rough?.height||1,metal?.height||1);
  const sample=(image,i,channel)=>{
    if(!image)return 255;  // A missing channel retains its authored scalar.
    const x=Math.floor((i%width+.5)*image.width/width),y=Math.floor((Math.floor(i/width)+.5)*image.height/height);
    return image.data[(y*image.width+x)*4+channel];
  };
  return textureDocument(width,height,i=>[sample(ao,i,0),sample(rough,i,1),sample(metal,i,2)]);
}
const materialFlipY=source=>(source.map||source.normalMap||source.roughnessMap||source.metalnessMap||source.aoMap)?.flipY===false;
function importedMaterial(id,source) {
  const material={id,name:source.name||'Imported material',color:'#'+source.color.getHexString(),texture:colorTexture(readTexture(source.map))};
  if(!source.isMeshStandardMaterial)return material;
  const flipY=materialFlipY(source),normal=compatibleMap(source.normalMap,flipY)?colorTexture(readTexture(source.normalMap)):null;
  const orm=ormTexture(source,flipY);
  material.automotive={preset:'gltf-pbr',creaseAngle:0,metalness:source.metalness,roughness:source.roughness,
    clearcoat:source.clearcoat??0,clearcoatRoughness:source.clearcoatRoughness??0,ior:source.ior??1.5,
    alphaMode:source.transparent?'blend':source.alphaTest>0?'mask':'opaque',
    opacity:source.opacity,alphaCutoff:source.alphaTest,doubleSided:source.side===THREE.DoubleSide,
    emissive:'#'+source.emissive.getHexString(),emissiveIntensity:source.emissiveIntensity,
    ...(orm?{orm,aoIntensity:source.aoMapIntensity}:{}),
    ...(normal?{normal,normalScale:[source.normalScale.x,source.normalScale.y*(flipY?-1:1)]}:{}),
  };
  return material;
}
export function convertGLTFScene(gltf,name='Imported model'){
  const model=createModelDocument(name),scene=gltf.scene,nodes=[],nodeIds=new Map(),materials=new Map();scene.updateMatrixWorld(true);
  scene.traverse(node=>{nodes.push(node);nodeIds.set(node.uuid,modelId(model,'joint'));});
  for(const node of nodes)model.joints.push({id:nodeIds.get(node.uuid),name:node.name||node.type,parent:nodeIds.get(node.parent?.uuid)||null,position:node.position.toArray(),rotation:node.quaternion.toArray(),scale:node.scale.toArray()});
  for(const node of nodes.filter(n=>n.isMesh)){
    const geometry=node.geometry,positions=geometry.getAttribute('position');if(!positions)continue;
    if(geometry.morphAttributes.position?.length)throw Error('Morph-target animation is not yet editable; import a bone-animated model');
    const uv=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal'),skinIndex=geometry.getAttribute('skinIndex'),skinWeight=geometry.getAttribute('skinWeight');
    const sourceMaterials=Array.isArray(node.material)?node.material:[node.material];
    for(const source of sourceMaterials)if(!materials.has(source.uuid)){
      const id=modelId(model,'material');materials.set(source.uuid,id);model.materials.push(importedMaterial(id,source));
    }
    const inverseWorld=node.matrixWorld.clone().invert(),normalWorld=new THREE.Matrix3().getNormalMatrix(node.matrixWorld),mirrored=node.matrixWorld.determinant()<0,ids=[];
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
      // Three reverses its front-face rule for negative world determinants.
      // Once flattened to positions, preserve that parity in the indices.
      if(mirrored)[corners[1],corners[2]]=[corners[2],corners[1]];
      joinPolygon(model,corners.map(index=>ids[index]),materials.get(source.uuid));
      const face=model.faces.at(-1);
      face.uv=corners.map(index=>{const point=uv?[uv.getX(index),uv.getY(index)]:[0,0];return materialFlipY(source)?[point[0],1-point[1]]:point;});
      if(normal)face.cornerNormals=corners.map(index=>new THREE.Vector3().fromBufferAttribute(normal,index).applyNormalMatrix(normalWorld).toArray());
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
