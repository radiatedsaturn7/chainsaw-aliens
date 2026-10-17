export class InventoryMenu {
  constructor(system,{onUse=()=>{},onRadio=()=>{},onBack=()=>{}}={}){this.system=system;this.onUse=onUse;this.onRadio=onRadio;this.onBack=onBack;this.offset=0;this.busy=false;this.page='items';}
  rows(){
    const progress=this.system.progress;
    if(this.page==='radio'){
      const radio=this.system.game.radio;
      const tracks=Object.keys(progress.bags.radio).filter(id=>progress.bags.radio[id]>0);
      this.offset=Math.min(this.offset,Math.max(0,Math.floor((tracks.length-1)/2)*2));
      const rows=tracks.slice(this.offset,this.offset+2).map(id=>({id:`inventory-track:${id}`,label:radio?.library.tracks.find(track=>track.id===id)?.title||progress.contentNames[id]||'Track',onClick:()=>{}}));
      if(!tracks.length)rows.push({id:'inventory-radio-empty',label:'No tracks',onClick:()=>{}});
      if(this.offset>0)rows.push({id:'inventory-previous',label:'Previous',onClick:()=>{this.offset-=2;}});
      if(this.offset+2<tracks.length)rows.push({id:'inventory-next',label:'Next',onClick:()=>{this.offset+=2;}});
      if(radio?.available)rows.push({id:'inventory-play-radio',label:'Open Radio',onClick:this.onRadio});
      rows.push({id:'inventory-radio-back',label:'Back',onClick:()=>{this.page='items';this.offset=0;}});return rows;
    }
    const entries=Object.entries(progress.bags.items).filter(([,count])=>count>0);
    this.offset=Math.min(this.offset,Math.max(0,Math.floor((entries.length-1)/2)*2));
    const rows=entries.slice(this.offset,this.offset+2).map(([id,count])=>{
      const item=progress.usable[id],name=item?.name||progress.contentNames?.[id]||'Item';
      return {id:`inventory:${id}`,label:`${item?'Use ':''}${name} ×${count}`,onClick:item?async()=>{if(this.busy)return;this.busy=true;try{if(await this.system.use(id))this.onUse();}finally{this.busy=false;}}:()=>{}};
    });
    if(!entries.length)rows.push({id:'inventory-empty',label:'No items',onClick:()=>{}});
    if(this.offset>0)rows.push({id:'inventory-previous',label:'Previous',onClick:()=>{this.offset-=2;}});
    if(this.offset+2<entries.length)rows.push({id:'inventory-next',label:'Next',onClick:()=>{this.offset+=2;}});
    rows.push({id:'inventory-radio',label:`Radio (${Object.values(progress.bags.radio).filter(count=>count>0).length})`,onClick:()=>{this.page='radio';this.offset=0;void this.system.game.radio?.load().catch(error=>this.system.game.showSystemToast?.(error.message));}});
    rows.push({id:'inventory-back',label:'Back',onClick:this.onBack});return rows;
  }
}
