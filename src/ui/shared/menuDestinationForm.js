import {openEditorForm} from './editorForm.js';
import {listProjectFiles} from '../projectFiles.js';
import {normalizeMenuVariables} from '../../menus/MenuProgress.js';
export async function editMenuDestination(value={}, {variablesOnly=false}={}){
 const result=await openEditorForm(variablesOnly?'Set Menu Variables':'Menu Destination',[
  ...variablesOnly?[]:[{id:'menuRef',label:'Menu',value:value.menuRef||'',options:[{value:'',label:'Current / designated menu'},...listProjectFiles('menus').map(f=>({value:f.name,label:f.name}))]},
   {id:'menuScreen',label:'Screen ID',type:'text',value:value.menuScreen||'garage',suggestions:['garage','world-map','cars','splash']}],
  {id:'variables',label:'Variables (one name = value per line)',type:'textarea',required:false,rows:5,value:Object.entries(value.variables||{}).map(([k,v])=>`${k} = ${JSON.stringify(v)}`).join('\n')}
 ],{description:'Use true/false, numbers or quoted text. World-map unlock conditions read these saved variables. Races also set raceCompleted.<race_name> automatically.'});
 if(!result)return null;
 const variables={};for(const line of result.variables.split('\n').filter(l=>l.trim())){const index=line.indexOf('=');if(index<1)throw Error('Use name = value');const key=line.slice(0,index).trim(),raw=line.slice(index+1).trim();try{variables[key]=JSON.parse(raw)}catch{variables[key]=raw}}
 const normalized=normalizeMenuVariables(variables);if(Object.keys(normalized).length!==Object.keys(variables).length)throw Error('Variable names must use letters, numbers, dots, underscores or hyphens; values must be text, numbers or booleans.');
 return {...value,...result,variables:normalized};
}
