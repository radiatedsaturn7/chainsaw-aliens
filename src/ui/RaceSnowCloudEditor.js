import {normalizeSnowClouds} from '../racing/RaceSnowClouds.js';
import {openEditorForm} from './shared/editorForm.js';
import {openProjectBrowser} from './ProjectBrowserModal.js';
export async function editSnowClouds(editor,{showForm=openEditorForm,pickArt=openProjectBrowser}={}) {
 const draft=editor.raceSettingsDialogDraft;if(!draft)return;
 const config=normalizeSnowClouds(draft.snowClouds);
 const result=await showForm('Snow ground clouds',[
  {id:'enabled',label:'Enable snow ground clouds',type:'checkbox',value:config.enabled},
  {id:'artRef',label:'Artwork (empty = soft clouds)',type:'text',value:config.artRef,required:false},
  {id:'choose',label:'Choose cloud artwork',type:'button',onClick:async()=>{const picked=await pickArt({mode:'open',fixedFolder:'art',initialFolder:'art',title:'Snow cloud artwork'});return picked?.action==='open'?{artRef:picked.name}:{};}},
  {id:'windDirectionDeg',label:'Wind direction (degrees)',value:config.windDirectionDeg,min:0,max:360,step:1},
  {id:'windSpeedMps',label:'Wind speed (m/s)',value:config.windSpeedMps,min:0,max:20,step:.25}
 ],{description:'Snow only. Level 1 (10%) has no ground clouds; level 10 (100%) reaches 30% peak opacity with more clouds (33% with high beams or rally lights). Clouds fade in, drift with wind and gusts, then fade out. Apply Weather to save.'});
 if(result&&editor.raceSettingsDialogDraft===draft)draft.snowClouds=normalizeSnowClouds(result);
}
