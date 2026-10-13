import {createModelDocument,addVertex,joinPolygon,validateModelDocument} from './ModelDocument.js';

export function importOBJ(text,name='Imported OBJ'){
  const model=createModelDocument(name),ids=[],uv=[];
  for(const raw of text.split(/\r?\n/)){
    const [command,...args]=raw.trim().split(/\s+/);if(!command||command.startsWith('#'))continue;
    if(command==='v'){const position=args.slice(0,3).map(Number);ids.push(addVertex(model,position));}
    if(command==='vt')uv.push(args.slice(0,2).map(Number));
    if(command==='f'){
      const refs=args.map(value=>value.split('/').map(Number));
      const index=(n,length)=>n>0?n-1:length+n;
      const vertices=refs.map(ref=>ids[index(ref[0],ids.length)]);
      joinPolygon(model,vertices);model.faces.at(-1).uv=refs.map(ref=>uv[index(ref[1],uv.length)]||[0,0]);
    }
  }
  if(!model.vertices.length)throw Error('The OBJ file contains no vertices');return validateModelDocument(model);
}
export function exportOBJ(model){
  const lines=[`# RTG Studio ${model.name}`];const lookup=new Map(model.vertices.map((v,i)=>[v.id,i+1]));
  for(const vertex of model.vertices)lines.push(`v ${vertex.position.join(' ')}`);
  let offset=1;for(const face of model.faces){for(const uv of face.uv)lines.push(`vt ${uv.join(' ')}`);lines.push('f '+face.vertices.map((id,i)=>`${lookup.get(id)}/${offset+i}`).join(' '));offset+=face.uv.length;}
  return lines.join('\n')+'\n';
}
export async function importModelFiles(files){
  if(Array.from(files).some(f=>/\.(gltf|glb)$/i.test(f.name))){const {importGLTFFiles}=await import('./ModelGLTF.js');return importGLTFFiles(files);}
  const file=Array.from(files).find(f=>/\.(obj|json)$/i.test(f.name));
  if(!file)throw Error('Choose an OBJ or RTG model JSON file');
  const text=await file.text();return /\.obj$/i.test(file.name)?importOBJ(text,file.name.replace(/\.obj$/i,'')):validateModelDocument(JSON.parse(text));
}
