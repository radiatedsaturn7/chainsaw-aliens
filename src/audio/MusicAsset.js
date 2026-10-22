import {chooseEditorFiles,openEditorForm} from '../ui/shared/editorForm.js';
import {saveProjectFileAndConfirm,projectFileExists,sanitizeProjectFileName} from '../ui/projectFiles.js';
import {parseMidi} from '../midi/midiParser.js';

export const isAudioMusic=data=>data?.kind==='audio-music'&&typeof data.src==='string';
export function midiMusicDocument(parsed,name='Song'){
 const tempo=parsed.bpm||120,ticksPerSecond=tempo/60*8;
 let end=1;
 const tracks=parsed.tracks.map((group,i)=>({id:`track-${i}`,name:`${name} ${i+1}`,channel:group.channel??0,program:group.program??0,volume:.8,pan:0,patterns:[{notes:group.notes.map((note,j)=>{
 const startTick=Math.max(0,Math.round(note.tStartSec*ticksPerSecond)),durationTicks=Math.max(1,Math.round((note.tEndSec-note.tStartSec)*ticksPerSecond));end=Math.max(end,startTick+durationTicks);
 return {id:`note-${j}`,startTick,durationTicks,pitch:note.midi,velocity:note.vel??.8};
 })}]}));
 if(!tracks.length)throw Error('The MIDI file contains no notes.');
 return {tempo,timeSignature:parsed.timeSignature,loopStartTick:0,loopEndTick:end,loopBars:Math.ceil(end/32),tracks};
}
export async function importMusicAsset({choose=chooseEditorFiles,form=openEditorForm}={}){
 const [file]=await choose('audio/mpeg,.mp3,audio/midi,.mid,.midi');if(!file)return null;
 const midi=/\.midi?$/i.test(file.name);
 if(!midi&&!/\.mp3$/i.test(file.name)&&file.type!=='audio/mpeg')throw Error('Choose an MP3 or MIDI file.');
 const result=await form('Upload Music',[{id:'name',label:'Project music name',type:'text',required:true,value:file.name}]);if(!result)return null;
 const name=sanitizeProjectFileName(result.name);
 if(!name)throw Error('Enter a music name.');
 if(projectFileExists('music',name))throw Error('That music name already exists. Choose a different name.');
 const data=midi?midiMusicDocument(parseMidi(await file.arrayBuffer()),name):{kind:'audio-music',mimeType:'audio/mpeg',fileName:file.name,src:await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read music'));reader.readAsDataURL(file);})};
 await saveProjectFileAndConfirm('music',name,data);return {name,data};
}
