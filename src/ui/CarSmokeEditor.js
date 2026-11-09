import {CAR_SMOKE_GROUPS,normalizeCarSmoke} from '../racing/CarSmoke.js';
import {openChoiceOverlay} from './shared/textInputOverlay.js';
import {openEditorForm} from './shared/editorForm.js';
import {openProjectBrowser} from './ProjectBrowserModal.js';
export async function editCarSmoke(editor,{choose=openChoiceOverlay,form=openEditorForm,picker=openProjectBrowser}={}) {
  const car=editor.selectedCar;
  if(!car)return;
  const group=await choose({title:'Smoke',choices:Object.entries(CAR_SMOKE_GROUPS).map(([value,g])=>({value,label:g.label}))});
  if(!CAR_SMOKE_GROUPS[group]||editor.selectedCar!==car)return;
  const key=await choose({title:CAR_SMOKE_GROUPS[group].label,choices:CAR_SMOKE_GROUPS[group].slots.map(([value,label])=>({value,label}))});
  const slot=CAR_SMOKE_GROUPS[group].slots.find(([id])=>id===key);
  if(!slot||editor.selectedCar!==car)return;
  const result=await form(`${slot[1]} Smoke`,[
    {id:'artRef',label:'Artwork name',type:'text',value:normalizeCarSmoke(car.art?.smoke)[key],required:false},
    {id:'choose',label:'Choose saved artwork',type:'button',onClick:async()=>{const picked=await picker({mode:'open',fixedFolder:'art',initialFolder:'art',title:'Choose smoke animation'});return picked?.action==='open'?{artRef:picked.name}:{};}},
    {id:'clear',label:'Use effect / race default',type:'checkbox',value:false}
  ],{description:'Animated artwork keeps its original colors. Surface artwork overrides effect defaults. Empty effect defaults use the race settings. Names can be assigned before artwork is uploaded.'});
  if(!result||editor.selectedCar!==car)return;
  editor.captureRaceHistory('Set smoke artwork');
  car.art||={};car.art.smoke=normalizeCarSmoke({...car.art.smoke,[key]:result.clear?'':result.artRef});
  editor.invalidateCarEditorPreviewFrame();editor.status=`${slot[1]} smoke: ${car.art.smoke[key]||'default'}`;
}
