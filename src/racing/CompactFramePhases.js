// Retain numeric frame totals rather than hundreds of JS objects per frame.
// Public reports keep the same phase-name/object format, materialized on access.
export class CompactFramePhases {
  constructor() { this.records=new Map();this.names=[];this.active=[];this.frame=-1; }
  begin(frame) { this.frame=frame;this.active.length=0; }
  get(name) {
    let record=this.records.get(name);
    if(!record){record={id:this.names.length,frame:-1,inclusiveMs:0,selfMs:0,calls:0};this.names.push(name);this.records.set(name,record);}
    if(record.frame!==this.frame){record.frame=this.frame;record.inclusiveMs=record.selfMs=record.calls=0;this.active.push(record);}
    return record;
  }
  finish(row) {
    const values=new Float64Array(this.active.length*4),names=this.names;
    let cpu=0;
    for(let i=0;i<this.active.length;i++){
      const r=this.active[i],offset=i*4;
      values[offset]=r.id;values[offset+1]=r.inclusiveMs;values[offset+2]=r.selfMs;values[offset+3]=r.calls;cpu+=r.selfMs;
    }
    Object.defineProperty(row,'phases',{enumerable:true,configurable:true,get(){
      const result={};
      for(let i=0;i<values.length;i+=4)result[names[values[i]]]={inclusiveMs:values[i+1],selfMs:values[i+2],calls:values[i+3]};
      // A stopped report and its JSON encoding read the same row. Materialize
      // once, replacing the getter so summaries/exports do not rebuild it.
      Object.defineProperty(row,'phases',{enumerable:true,configurable:true,writable:true,value:result});
      return result;
    }});
    return {cpu,bytes:values.byteLength,count:this.active.length};
  }
}
