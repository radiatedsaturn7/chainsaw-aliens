import {RadioNowPlaying} from '../ui/RadioNowPlaying.js';
export class RadioMenu {
  constructor(radio, { onBack = () => {}, onError = () => {} } = {}) {this.radio=radio;this.onBack=onBack;this.onError=onError;this.page='main';this.offset=0;this.display=new RadioNowPlaying();}
  run(action) {Promise.resolve().then(action).catch(error=>this.onError(error.message));}
  paged(rows,back) {
    const size=3;this.offset=Math.min(this.offset,Math.max(0,Math.floor((rows.length-1)/size)*size));
    const result=rows.slice(this.offset,this.offset+size);
    if(this.offset>0)result.push({id:'radio-previous-page',label:'Previous page',onClick:()=>{this.offset-=size;}});
    if(this.offset+size<rows.length)result.push({id:'radio-next-page',label:'Next page',onClick:()=>{this.offset+=size;}});
    return [...result,back];
  }
  rows() {
    const radio=this.radio;
    const back={id:'radio-back',label:'Back',onClick:()=>{if(this.page==='main')this.onBack();else this.page='main';}};
    if(this.page==='stations')return this.paged(radio.stations.map(station=>({id:`radio-station:${station.id}`,label:`${radio.stationId===station.id?'✓ ':''}${station.name}`,onClick:()=>this.run(()=>radio.selectStation(station.id))})),back);
    if(this.page==='tracks')return this.paged(radio.library.tracks.filter(track=>radio.contextStationIds===null||radio.stations.some(station=>station.trackIds.includes(track.id))).filter(track=>radio.ownsTrack?radio.ownsTrack(track):track.initiallyUnlocked||radio.progress.unlocked.includes(track.id)).map(track=>({id:`radio-track:${track.id}`,label:`${radio.progress.disabled.includes(track.id)?'Off':'On'}: ${track.title}${track.artist?' — '+track.artist:''}`,onClick:()=>this.run(()=>radio.setTrackEnabled(track.id,radio.progress.disabled.includes(track.id)))})),back);
    const track=radio.currentTrack,station=radio.library.stations.find(s=>s.id===radio.stationId);
    return [
      {id:'radio-stations',label:`Station: ${station?.name||'None'}`,onClick:()=>{this.page='stations';this.offset=0;}},
      {id:'radio-play',label:`${radio.playing?'Pause':'Play'}${track?': '+track.title:''}`,onClick:()=>this.run(()=>radio.playing?radio.pause():radio.play())},
      {id:'radio-skip',label:'Skip',onClick:()=>this.run(()=>radio.skip())},
      {id:'radio-rewind',label:'Rewind / Previous',onClick:()=>this.run(()=>radio.rewind())},
      {id:'radio-tracks',label:'Enable / Disable Unlocked Tracks',onClick:()=>{this.page='tracks';this.offset=0;}},back
    ];
  }
}
