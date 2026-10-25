import {GARAGE_DIALOGUE} from '../../garage/GarageDialogue.js';
import {openEditorForm} from './editorForm.js';
import {listProjectFiles} from '../projectFiles.js';
import {normalizeMenuVariables,parseMenuVariableAssignments} from '../../menus/MenuProgress.js';
export async function editMenuDestination(value={}, {variablesOnly=false}={}){
 const result=await openEditorForm(variablesOnly?'Set Menu Variables':'Menu Destination',[
  ...variablesOnly?[]:[{id:'menuRef',label:'Menu',value:value.menuRef||'',options:[{value:'',label:'Current / designated menu'},...listProjectFiles('menus').map(f=>({value:f.name,label:f.name}))]},
   {id:'menuScreen',label:'Screen ID',type:'text',value:value.menuScreen||'world-map',suggestions:['garage','world-map','cars','splash']}],
  {id:'chapter',label:'Chapter after completion (blank = keep current)',type:'text',value:String(value.variables?.chapter??'')},
  {id:'garageDialogueEvent',label:'Garage dialogue after completion',value:value.variables?.garageDialogueEvent||'',options:[{value:'',label:'Automatic return dialogue'},...Object.entries(GARAGE_DIALOGUE.events).map(([value,line])=>({value,label:line}))]},
  {id:'variables',label:'Variables (one name = value per line)',type:'textarea',required:false,rows:5,value:Object.entries(value.variables||{}).filter(([key])=>!['chapter','garageDialogueEvent'].includes(key)).map(([k,v])=>`${k} = ${JSON.stringify(v)}`).join('\n')}
 ],{description:'Use true/false, numbers or quoted text. World-map unlock conditions read these saved variables. Races also save lastCompletedRace and raceCompleted.<race_name> automatically. Chapter and lastCompletedRace can select menu background artwork.'});
 if(!result)return null;
 const variables=parseMenuVariableAssignments(result.variables);
 variables.garageDialogueEvent=result.garageDialogueEvent||'';
 if(result.chapter.trim())variables.chapter=result.chapter.trim();
 const normalized=normalizeMenuVariables(variables);if(Object.keys(normalized).length!==Object.keys(variables).length)throw Error('Variable names must use letters, numbers, dots, underscores or hyphens; values must be text, numbers or booleans.');
 return {...value,...result,variables:normalized};
}
