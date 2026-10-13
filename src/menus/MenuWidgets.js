// Widget metadata is shared by the designer and runtime; bindings are plain data.
export const MENU_WIDGETS = [
  ['shape','Shape','A rectangle, ellipse or triangle with fill and outline.'],
  ['container','Container','Group widgets so they move, resize and reorder together.'],
  ['text','Text','A heading, caption, or {{parameter}} value.'],
  ['image','Image','Choose saved artwork or import an image from your device.'],
  ['button','Button','Open a screen, set a value, or launch a destination.'],
  ['choice','Selection list','Choose cars, actors, events, or your own options.'],
  ['slider','Slider','Change volume, brightness, rotation, or a custom number.'],
  ['toggle','Toggle','Change a true/false setting.'],
  ['keybind','Key mapping','Let the player assign a keyboard control.'],
  ['car-preview','Car rotator','Show a chosen car; spin automatically or bind its angle.'],
  ['property-display','Property display','Show a property of a car, actor, or custom item.'],
  ['asset-preview','Actor / item image','Show artwork from a selected actor or item.'],
  ['car-stats','Car statistics','Power, torque, weight, drivetrain and class.'],
  ['power-curve','HP / torque graph','Plot the selected car’s engine curves.'],
  ['video','Video','Play a video URL inside the screen.']
].map(([type,label,description])=>({type,label,description}));
export const widgetLabel=type=>MENU_WIDGETS.find(w=>w.type===type)?.label||type;
export const MENU_DATA_SOURCES=[{value:'cars',label:'Car'},{value:'actors',label:'Actor'},{value:'parameters',label:'Item / configuration object'},{value:'doodads',label:'Doodad'}];
export const safeProperty=(object,path)=>{
  if(!path)return object;
  for(const key of String(path).split('.')){
    if(['__proto__','prototype','constructor'].includes(key)||object==null||!Object.hasOwn(Object(object),key))return undefined;
    object=object[key];
  }
  return object;
};
export function propertyPaths(object,prefix='',depth=0){
  if(!object||typeof object!=='object'||depth>4)return [];
  return Object.entries(object).flatMap(([key,value])=>{
    if(['__proto__','prototype','constructor'].includes(key))return [];
    const path=prefix?`${prefix}.${key}`:key;
    if(value===null||['string','number','boolean'].includes(typeof value))return [{value:path,label:`${path} — ${String(value).slice(0,48)}`}];
    return Array.isArray(value)?[]:propertyPaths(value,path,depth+1);
  }).slice(0,250);
}
export function widgetDefaults(type){
  const shared={type,label:widgetLabel(type),x:0.1,y:0.2,w:0.8,h:0.1};
  if(['car-preview','car-stats','power-curve','asset-preview'].includes(type))Object.assign(shared,{h:0.3,w:0.4});
  if(['car-preview','car-stats','power-curve'].includes(type))Object.assign(shared,{binding:'carRef',dataSource:'cars'});
  if(type==='car-preview')Object.assign(shared,{animation:'spin',duration:8});
  if(type==='property-display')Object.assign(shared,{label:'Name',dataSource:'cars',binding:'carRef',property:'name'});
  if(type==='asset-preview')Object.assign(shared,{dataSource:'actors',binding:'actorRef',property:''});
  if(type==='shape')Object.assign(shared,{w:0.3,h:0.2});
  if(type==='container')Object.assign(shared,{w:0.6,h:0.4});
  if(type==='image')Object.assign(shared,{w:0.4,h:0.3});
  if(type==='slider')Object.assign(shared,{binding:'settings.musicVolume',label:'Music volume'});
  if(type==='choice')Object.assign(shared,{binding:'carRef',source:'cars',label:'Car'});
  if(type==='keybind')Object.assign(shared,{binding:'input.left',label:'Steer left'});
  if(type==='toggle')Object.assign(shared,{binding:'enabled',label:'Enabled'});
  return shared;
}
