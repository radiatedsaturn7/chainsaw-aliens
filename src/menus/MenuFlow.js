import {normalizeMenuDocument,resolveMenuValue,validMenuParameter} from './MenuDocument.js';

// Shared by the editor preview and Play. Destinations are explicit adapter calls,
// never evaluated scripts; custom configuration remains serializable data.
export class MenuFlow {
  constructor(document,adapter={}){this.document=normalizeMenuDocument(document);this.adapter=adapter;this.parameters=structuredClone(this.document.parameters);this.screenId=this.document.startScreen;this.history=[];this.time=0;this.busy=false;this.error='';this.generation=0;this.active=true;}
  get screen(){return this.document.screens.find(s=>s.id===this.screenId);}
  setParameter(key,value){if(!validMenuParameter(key))throw Error('Invalid parameter');this.parameters[key]=structuredClone(value);this.adapter.parameterChanged?.(key,value);}
  goTo(id,{remember=true}={}){if(!this.document.screens.some(s=>s.id===id))throw Error(`Menu screen not found: ${id}`);if(remember&&id!==this.screenId)this.history.push(this.screenId);this.screenId=id;this.time=0;this.error='';this.adapter.screenChanged?.(this.screen,this.parameters);}
  back(){if(this.busy)return;const id=this.history.pop();if(id)this.goTo(id,{remember:false});else this.stop();}
  stop(){this.active=false;this.generation++;this.adapter.stop?.();}
  update(dt){if(this.active)this.time+=Math.max(0,Number(dt)||0);}
  async start(){return this.run(this.screen.startAction);}
  async run(action){
    if(!action||this.busy||!this.active)return false;
    this.busy=true;this.error='';const generation=this.generation;
    try{await this.execute(action,generation);return true;}catch(error){this.error=String(error?.message||error);return false;}finally{if(generation===this.generation)this.busy=false;}
  }
  async execute(action,generation,depth=0){
    if(!this.active||generation!==this.generation)return;if(depth>12)throw Error('Too many chained menu actions');
    const target=resolveMenuValue(action.target,this.parameters),configuration=structuredClone(this.parameters);
    switch(action.type){
      case 'screen':this.goTo(target);break;
      case 'back':{const id=this.history.pop();if(id)this.goTo(id,{remember:false});else this.stop();break;}
      case 'set-param':this.setParameter(action.parameter,resolveMenuValue(action.value,this.parameters));break;
      case 'movie':if(!target)throw Error('Choose a movie first');await this.adapter.playMovie(target,configuration);break;
      case 'race':if(!target)throw Error('Choose a race first');await this.adapter.launchRace(target,configuration);return;
      case 'level':if(!target)throw Error('Choose a level first');await this.adapter.launchLevel(target,configuration);return;
      case 'garage-buy':case 'garage-install':case 'garage-remove':case 'garage-tune':case 'garage-reset':
        if(!this.adapter.garageAction)throw Error('Garage unavailable');
        await this.adapter.garageAction(action.type,target,configuration);break;
      case 'quit':this.stop();break;
      default:throw Error('Unsupported menu action');
    }
    if(action.then)await this.execute(action.then,generation,depth+1);
  }
}
