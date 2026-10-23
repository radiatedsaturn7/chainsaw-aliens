import {saveProjectFileAndConfirm,hydrateProjectFilePayload,sanitizeProjectFileName} from '../ui/projectFiles.js';
// Keep track IDs, stations, unlocks and cue settings intact while giving legacy
// embedded or hosted MP3s normal project files. Existing matching assets make retries safe.
export async function externalizeRadioMusic(library,{save=saveProjectFileAndConfirm,load=hydrateProjectFilePayload}={}){
 const result=structuredClone(library);let changed=false;
 for(const track of result.tracks||[]){
  if(track.musicRef||!track.src)continue;
  const name=sanitizeProjectFileName(`${track.title||'Radio'}-${track.id}.mp3`);
  const existing=await load('music',name);
  if(existing?.data&&existing.data.radioTrackId!==track.id)throw Error('Music name already exists: '+name);
  if(!existing?.data)await save('music',name,{kind:'audio-music',mimeType:'audio/mpeg',fileName:name,radioTrackId:track.id,src:track.src});
  track.musicRef=name;track.src='';changed=true;
 }
 return {library:result,changed};
}
