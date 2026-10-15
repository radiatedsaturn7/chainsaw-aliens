import { openEditorForm, chooseEditorFiles } from './shared/editorForm.js';
import { chooseImage } from './MenuDesignerForms.js';
import { createRadioId } from '../radio/RadioLibrary.js';

const text=(id,label,value='')=>({id,label,value,type:'text',required:false});
const select=(id,label,value,options)=>({id,label,value,options});
const yesNo=[{value:'yes',label:'Yes'},{value:'no',label:'No'}];
const readFile=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read audio file'));reader.readAsDataURL(file);});

export class RadioEditor {
  constructor(game){this.game=game;this.opened=false;}
  async run(task){if(this.opened)return;this.opened=true;try{await this.game.radio.load();await task();}catch(error){this.game.showSystemToast(error.message);}finally{this.opened=false;this.game.input?.reset?.();}}
  open(){return this.run(async()=>{
    while(true){
      const result=await openEditorForm('Radio Editor',[select('action','Edit','station',[{value:'station',label:'Stations and song groups'},{value:'track',label:'Tracks, artist and album'},{value:'import',label:'Upload MP3'}])],{description:`${this.game.radio.library.stations.length} stations • ${this.game.radio.library.tracks.length} tracks`});
      if(!result)return;
      if(result.action==='station')await this.station();else if(result.action==='track')await this.track();else await this.importTrack();
    }
  });}
  options(){return this.run(async()=>{const radio=this.game.radio;const result=await openEditorForm('Radio Options',[select('enabled','Enable radio',radio.progress.enabled?'yes':'no',yesNo)],{description:'When disabled, Radio is hidden from level and race pause menus.'});if(result)await radio.setEnabled(result.enabled==='yes');});}
  async artwork(image){
    const element={artRef:image.artRef};await chooseImage({element,change:fn=>fn()});return {artRef:element.artRef,url:''};
  }
  async importTrack(){
    const [file]=await chooseEditorFiles('audio/mpeg,.mp3');if(!file)return;
    if(!/\.mp3$/i.test(file.name)&&file.type!=='audio/mpeg')throw Error('Choose an MP3 audio file.');
    const data=await openEditorForm('Import Radio Track',[text('title','Song title',file.name.replace(/\.mp3$/i,'')),text('artist','Artist'),text('album','Album'),select('initiallyUnlocked','Available without a mix tape?','no',yesNo)]);if(!data)return;
    const library=structuredClone(this.game.radio.library);library.tracks.push({id:createRadioId(),...data,initiallyUnlocked:data.initiallyUnlocked==='yes',src:await readFile(file),image:{artRef:'',url:''}});
    await this.game.radio.saveLibrary(library);
  }
  async track(){
    const library=structuredClone(this.game.radio.library);if(!library.tracks.length){await this.importTrack();return;}
    const picked=await openEditorForm('Choose Radio Track',[select('id','Track',library.tracks[0].id,library.tracks.map(t=>({value:t.id,label:`${t.title}${t.artist?' — '+t.artist:''}`})))]);if(!picked)return;
    const track=library.tracks.find(t=>t.id===picked.id);
    const result=await openEditorForm('Track Details',[text('title','Song title',track.title),text('artist','Artist',track.artist),text('album','Album',track.album),select('initiallyUnlocked','Available without a mix tape?',track.initiallyUnlocked?'yes':'no',yesNo),select('art','Album image','keep',[{value:'keep',label:'Keep current image'},{value:'choose',label:'Choose saved artwork or upload image'},{value:'clear',label:'Remove image'}])]);if(!result)return;
    Object.assign(track,{title:result.title,artist:result.artist,album:result.album,initiallyUnlocked:result.initiallyUnlocked==='yes'});
    if(result.art==='choose')track.image=await this.artwork(track.image);if(result.art==='clear')track.image={artRef:'',url:''};
    await this.game.radio.saveLibrary(library);
  }
  async station(){
    const library=structuredClone(this.game.radio.library);
    const picked=await openEditorForm('Radio Stations',[select('id','Station','new',[{value:'new',label:'Create station'},...library.stations.map(s=>({value:s.id,label:s.name}))])]);if(!picked)return;
    const station=picked.id==='new'?{id:createRadioId(),name:'New station',logo:{artRef:'',url:''},trackIds:[]}:library.stations.find(s=>s.id===picked.id);
    const result=await openEditorForm('Station Details',[text('name','Station name',station.name),select('art','Station logo','keep',[{value:'keep',label:'Keep current logo'},{value:'choose',label:'Choose saved artwork or upload image'},{value:'clear',label:'Remove logo'}]),...library.tracks.map((track,index)=>select(`track${index}`,`${track.title}${track.artist?' — '+track.artist:''}`,station.trackIds.includes(track.id)?'yes':'no',yesNo))],{description:'Choose which tracks belong to this station. Locked tracks become playable when their mix tape is collected.'});if(!result)return;
    station.name=result.name;station.trackIds=library.tracks.filter((track,index)=>result[`track${index}`]==='yes').map(track=>track.id);
    if(result.art==='choose')station.logo=await this.artwork(station.logo);if(result.art==='clear')station.logo={artRef:'',url:''};
    if(picked.id==='new')library.stations.push(station);await this.game.radio.saveLibrary(library);
  }
}
