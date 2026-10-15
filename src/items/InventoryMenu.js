export class InventoryMenu {
  constructor(system,{onUse=()=>{},onRadio=()=>{},onBack=()=>{}}={}){this.system=system;this.onUse=onUse;this.onRadio=onRadio;this.onBack=onBack;this.offset=0;this.busy=false;}
  rows(){
    const progress=this.system.progress;
    const entries=Object.entries(progress.bags.items).filter(([,count])=>count>0);
    this.offset=Math.min(this.offset,Math.max(0,Math.floor((entries.length-1)/4)*4));
    const rows=entries.slice(this.offset,this.offset+4).map(([id,count])=>{
      const item=progress.usable[id],name=item?.name||progress.contentNames?.[id]||'Item';
      return {id:`inventory:${id}`,label:`${item?'Use ':''}${name} ×${count}`,onClick:item?async()=>{if(this.busy)return;this.busy=true;try{if(await this.system.use(id))this.onUse();}finally{this.busy=false;}}:()=>{}};
    });
    if(!entries.length)rows.push({id:'inventory-empty',label:'No items',onClick:()=>{}});
    if(this.offset>0)rows.push({id:'inventory-previous',label:'Previous',onClick:()=>{this.offset-=4;}});
    if(this.offset+4<entries.length)rows.push({id:'inventory-next',label:'Next',onClick:()=>{this.offset+=4;}});
    rows.push({id:'inventory-radio',label:`Radio (${Object.values(progress.bags.radio).filter(count=>count>0).length})`,onClick:this.onRadio});
    rows.push({id:'inventory-back',label:'Back',onClick:this.onBack});return rows;
  }
}
