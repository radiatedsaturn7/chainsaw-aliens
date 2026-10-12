import {openProjectBrowser} from './ProjectBrowserModal.js';
import {openEditorForm} from './shared/editorForm.js';
import {modelAssets} from '../model3d/ModelAssets.js';
import {normalizeModelBinding} from '../model3d/ModelBinding.js';

export async function pickModelBinding(current=null){
  const picked=await openProjectBrowser({mode:'open',fixedFolder:'models',initialFolder:'models',title:'Choose 3D Model'});
  if(!picked?.name)return null;
  const model=picked.payload?modelAssets.adopt(picked.name,picked.payload):await modelAssets.prepare(picked.name);
  const previous=normalizeModelBinding(current);
  const initial=previous?.ref===picked.name?previous:normalizeModelBinding(picked.name);
  const fields=[{id:'clip',label:'Animation',value:initial.clip,options:[{value:'',label:'Bind pose'},...model.animations.map(c=>({value:c.id,label:c.name}))]},
    {id:'speed',label:'Animation speed',value:initial.speed}];
  for(const [key,label,defaults] of [['position','Position',[0,0,0]],['rotation','Rotation (degrees)',[0,0,0]],['scale','Scale',[1,1,1]]])
    ['x','y','z'].forEach((axis,i)=>fields.push({id:`${key}${i}`,label:`${label} ${axis.toUpperCase()}`,value:(initial[key]?.[i]??defaults[i])*(key==='rotation'?180/Math.PI:1)}));
  const result=await openEditorForm('3D Model Placement',fields);if(!result)return null;
  const binding={ref:picked.name,clip:result.clip,speed:result.speed};
  for(const key of ['position','rotation','scale'])binding[key]=[0,1,2].map(i=>result[`${key}${i}`]*(key==='rotation'?Math.PI/180:1));
  return normalizeModelBinding(binding);
}
