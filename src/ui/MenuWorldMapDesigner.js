import {worldMapNodes,worldMapConnections,worldMapNodePoint,worldMapLocalPoint,materializeWorldMap,normalizeWorldMapStyle,worldMapNodeRadius} from '../menus/MenuWorldMap.js';
import {menuElementBounds,menuHit} from '../menus/MenuRenderer.js';
import {openEditorForm} from './shared/editorForm.js';
import {chooseImage} from './MenuDesignerForms.js';
import {listProjectFiles} from './projectFiles.js';
const text=(id,label,value='')=>({id,label,value,type:'text',required:false});
const select=(id,label,value,options)=>({id,label,value,options,required:false});
const color=(id,label,value)=>({id,label,value,type:'color'});
const unique=(prefix,list)=>{let n=1;while(list.some(e=>e.id===`${prefix}-${n}`))n++;return `${prefix}-${n}`;};
const parse=v=>{try{return JSON.parse(v);}catch{return v;}};
export class MenuWorldMapDesigner{
 constructor(editor){this.editor=editor;this.reset();}
 reset(){this.elementId=null;this.nodeId=null;this.linkId=null;this.mode='move';this.from=null;this.drag=null;}
 get element(){const e=this.editor.element;return e?.type==='world-map'&&e.id===this.elementId?e:null;}
 get nodes(){const e=this.element;return e?worldMapNodes(e,this.editor.resources,this.editor.menu,this.editor.menu.parameters):[];}
 get bounds(){return this.element&&this.editor.menuBounds?menuElementBounds(this.element,this.editor.menuBounds):null;}
 start(){if(this.editor.element?.type!=='world-map')return;if(this.elementId!==this.editor.element.id)this.reset();this.elementId=this.editor.element.id;this.editor.worldMapLayoutId=null;this.editor.status='Editing map nodes over the menu background. Drag nodes; Properties edits selection. Tap empty map space then Properties for map tools.';}
 materialize(){const e=this.element;materializeWorldMap(e,this.editor.resources,this.editor.menu,this.editor.menu.parameters);e.mapManual=true;return e;}
 entries(){return [
  ['map-move','Edit nodes',()=>{this.start();this.mode='move';this.from=null;this.editor.status='Tap and drag a node to move it.';}],
  ['map-add-race','+ Race node',()=>this.place('race')],['map-add-junction','+ Junction',()=>this.place('junction')],
  ['map-connect','Connect nodes',()=>{this.start();this.mode='connect';this.from=null;this.editor.status='Tap the first node, then the second node to connect them.';}],
  ['map-node','Node properties',()=>this.editNode(),!this.nodeId],
  ['map-link','Connection style',()=>this.editLink(),!this.linkId],
  ['map-style','Map style / cursor',()=>{this.start();return this.editStyle();}],
  ['map-background','Widget background image',()=>chooseImage(this.editor)],
  ['map-screen-background','Screen background image',()=>chooseImage(this.editor,{background:true})],
  ['map-delete','Delete selected',()=>this.remove(),!this.nodeId&&!this.linkId],
  ['map-auto','Use project races',()=>{this.start();this.editor.change(()=>{Object.assign(this.element,{nodes:[],connections:null,mapManual:false});});this.nodeId=this.linkId=this.from=null;}],
  ['map-layout','Done / move widget',()=>{this.reset();this.editor.worldMapLayoutId=this.editor.elementId;this.editor.status='Drag the map widget to move it. Properties opens map tools.';}]
 ].map(([id,label,action,disabled])=>({id,label,action,disabled}));}
 place(kind){this.start();this.mode=`add-${kind}`;this.from=null;this.editor.status=`Tap the map to place a ${kind==='race'?'race node':'junction'}.`;}
 hitNode(p,element=this.element){
  if(!element||!this.editor.menuBounds)return null;
  const b=menuElementBounds(element,this.editor.menuBounds);
  if(!menuHit(p,b))return null;
  const nodes=worldMapNodes(element,this.editor.resources,this.editor.menu,this.editor.menu.parameters);
  return nodes.map(node=>({node,p:worldMapNodePoint(node,b,element)})).map(e=>({...e,d:Math.hypot(p.x-e.p.x,p.y-e.p.y)})).filter(e=>e.d<Math.max(16,worldMapNodeRadius(b,element)+7)).sort((a,b)=>a.d-b.d)[0]?.node;
 }
 pointerDown(p){
  const b=this.bounds;if(!b||!menuHit(p,b))return false;
  const nodes=this.nodes,hit=this.hitNode(p);
  if(this.mode.startsWith('add-')){
   const kind=this.mode.slice(4);this.editor.change(()=>{
    const e=this.materialize();if(e.nodes.length>=100)throw Error('A map supports up to 100 nodes');
    const id=unique(kind,e.nodes),race=(this.editor.resources?.choices('races',this.editor.menu,this.editor.menu.parameters)||[]).find(r=>!e.nodes.some(n=>n.raceRef===r.value));
    e.nodes.push({id,kind,label:kind==='junction'?'Junction':race?.label||'Race',raceRef:kind==='race'?race?.value||'':'',...worldMapLocalPoint(p,b)});this.nodeId=id;this.linkId=null;
   });this.mode='move';return true;
  }
  if(hit){
   this.nodeId=hit.id;this.linkId=null;
   if(this.mode==='connect'){
    if(!this.from){this.from=hit.id;this.editor.status='Now tap the node to connect to.';}
    else if(this.from!==hit.id){const from=this.from;this.editor.change(()=>{const e=this.materialize();if(!e.connections.some(c=>(c.from===from&&c.to===hit.id)||(c.to===from&&c.from===hit.id)))e.connections.push({id:unique('link',e.connections),from,to:hit.id});});this.from=null;this.editor.status='Connected. Tap another pair, or choose Move nodes.';}
   }else this.drag={id:p.id,nodeId:hit.id,x:p.x,y:p.y,position:{x:hit.x,y:hit.y},before:this.editor.snapshot()};
   return true;
  }
  const link=worldMapConnections(this.element,nodes).find(link=>{
   const a=worldMapNodePoint(nodes.find(n=>n.id===link.from),b,this.element),c=worldMapNodePoint(nodes.find(n=>n.id===link.to),b,this.element),dx=c.x-a.x,dy=c.y-a.y;
   const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
   return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<10;
  });this.linkId=link?.id||null;this.nodeId=null;return true;
 }
 pointerMove(p){
  const d=this.drag,b=this.bounds;if(!d||!b)return false;if(d.id!==undefined&&p.id!==undefined&&d.id!==p.id)return true;
  if(Math.hypot(p.x-d.x,p.y-d.y)<3&&!d.moved)return true;
  d.moved=true;const e=this.materialize(),node=e.nodes.find(n=>n.id===d.nodeId);if(!node)return true;
  node.x=Math.max(0,Math.min(1,d.position.x+(p.x-d.x)/b.w));node.y=Math.max(0,Math.min(1,d.position.y+(p.y-d.y)/Math.max(1,b.h-36)));return true;
 }
 pointerUp(p){const d=this.drag;if(!d)return false;if(d.id!==undefined&&p.id!==undefined&&d.id!==p.id)return true;this.drag=null;this.editor.record(d.before);return true;}
 remove(){if(!this.element)return;this.editor.change(()=>{const e=this.materialize();if(this.nodeId){e.nodes=e.nodes.filter(n=>n.id!==this.nodeId);e.connections=e.connections.filter(c=>c.from!==this.nodeId&&c.to!==this.nodeId);}else e.connections=e.connections.filter(c=>c.id!==this.linkId);});this.nodeId=this.linkId=this.from=null;}
 editSelection(){
  if(this.nodes.some(n=>n.id===this.nodeId))return this.editNode();
  if(this.element&&worldMapConnections(this.element,this.nodes).some(c=>c.id===this.linkId))return this.editLink();
  return this.editStyle();
 }
 async editNode(showForm=openEditorForm){
  const e=this.element,node=this.nodes.find(n=>n.id===this.nodeId);if(!e||!node)return;
  const art=[{value:'',label:'Default / normal icon'},...listProjectFiles('art').map(f=>({value:f.name,label:f.name}))];
  for(const ref of [node.artRef,node.selectedArtRef,node.disabledArtRef])if(ref&&!art.some(a=>a.value===ref))art.push({value:ref,label:ref});
  const r=await showForm('Map Node',[
   text('label','Label',node.label),select('kind','Node type',node.kind||'race',[{value:'race',label:'Race'},{value:'junction',label:'Junction (not selectable)'}]),
   select('raceRef','Race',node.raceRef||'',[{value:'',label:'No race'},...listProjectFiles('races').map(f=>({value:f.name,label:f.name}))]),
   select('artRef','Unselected icon',node.artRef||'',art),select('selectedArtRef','Selected icon',node.selectedArtRef||'',art),select('disabledArtRef','Disabled icon',node.disabledArtRef||'',art),
   {id:'disabled',label:'Disabled',type:'checkbox',value:node.disabled===true},
   {id:'x',label:'X (%)',value:node.x*100,min:0,max:100},{id:'y',label:'Y (%)',value:node.y*100,min:0,max:100},
   text('unlockParameter','Unlock variable (blank = unlocked)',node.unlockParameter),text('unlockValue','Required value',JSON.stringify(node.unlockValue??true)),text('completedParameter','Completion variable',node.completedParameter)
  ],{description:'Tap and drag nodes on the canvas. Junctions route connections but never launch a race. Empty state icons use the normal icon.'});
  if(!r||this.element!==e)return;
  this.editor.change(()=>{const map=this.materialize(),target=map.nodes.find(n=>n.id===node.id);Object.assign(target,r,{x:r.x/100,y:r.y/100,unlockValue:parse(r.unlockValue)});});
 }
 async editLink(showForm=openEditorForm){
  const e=this.element,link=e&&worldMapConnections(e,this.nodes).find(c=>c.id===this.linkId);if(!link)return;
  const style=normalizeWorldMapStyle(e.mapStyle),r=await showForm('Connection Style',[
   select('from','From',link.from,this.nodes.map(n=>({value:n.id,label:n.label}))),select('to','To',link.to,this.nodes.map(n=>({value:n.id,label:n.label}))),
   {id:'inherit',label:'Use map default style',type:'checkbox',value:!link.color&&link.width==null&&!link.pattern},
   color('color','Line color',link.color||style.lineColor),{id:'width',label:'Line width',value:link.width??style.lineWidth,min:0,max:20},select('pattern','Line pattern',link.pattern||style.linePattern,['solid','dashed','dotted'])]);
  if(!r||this.element!==e)return;if(r.from===r.to)throw Error('Choose two different nodes');
  this.editor.change(()=>{const target=this.materialize().connections.find(c=>c.id===link.id);Object.assign(target,{from:r.from,to:r.to,color:r.inherit?'':r.color,width:r.inherit?null:r.width,pattern:r.inherit?'':r.pattern});});
 }
 async editStyle(showForm=openEditorForm){
  const e=this.element;if(!e)return;const s=normalizeWorldMapStyle(e.mapStyle);
  const r=await showForm('Map Style & Cursor',[
   color('lineColor','Default line color',s.lineColor),{id:'lineWidth',label:'Default line width',value:s.lineWidth,min:0,max:20},select('linePattern','Default line pattern',s.linePattern,['solid','dashed','dotted']),
   color('selectedColor','Selected node color',s.selectedColor),color('unselectedColor','Unselected node color',s.unselectedColor),color('disabledColor','Disabled node color',s.disabledColor),
   {id:'nodeScale',label:'Node / icon scale',value:s.nodeScale,min:.25,max:4,step:.05},{id:'unselectedOpacity',label:'Unselected brightness',value:s.unselectedOpacity,min:0,max:1,step:.05},{id:'disabledOpacity',label:'Disabled brightness',value:s.disabledOpacity,min:0,max:1,step:.05},
   select('cursor','Selection cursor',s.cursor,['ring','text','image','none']),color('cursorColor','Cursor color',s.cursorColor),text('cursorText','Cursor text',e.cursorText||'>'),
   select('cursorArtRef','Cursor artwork',e.cursorArtRef||'',[{value:'',label:'Uploaded cursor / text'},...listProjectFiles('art').map(f=>({value:f.name,label:f.name}))]),
   {id:'cursorSize',label:'Cursor size',value:e.cursorSize||24,min:8,max:160}
  ],{description:'Each node can have different selected, unselected and disabled artwork. Existing Layout & Style also supports uploading a cursor image.'});
  if(!r||this.element!==e)return;this.editor.change(()=>{const {cursorText,cursorArtRef,cursorSize,...style}=r;e.mapStyle=style;Object.assign(e,{cursorText,cursorArtRef,cursorSize});});
 }
 draw(ctx){
  const b=this.bounds;if(!b)return;
  // Keep the real artwork visible; authoring adds outlines only.
  ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();
  ctx.globalAlpha=1;ctx.filter='none';ctx.setLineDash([]);
  const nodes=this.nodes,points=new Map(nodes.map(n=>[n.id,worldMapNodePoint(n,b,this.element)]));
  const link=worldMapConnections(this.element,nodes).find(c=>c.id===this.linkId);
  if(link){const a=points.get(link.from),c=points.get(link.to);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);ctx.strokeStyle='#101923';ctx.lineWidth=7;ctx.stroke();ctx.strokeStyle='#ffce51';ctx.lineWidth=3;ctx.stroke();}
  for(const n of nodes){
   const p=points.get(n.id),selected=n.id===this.nodeId||n.id===this.from;
   const radius=worldMapNodeRadius(b,this.element)*(n.kind==='junction'?.55:1)+4;
   ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);
   ctx.strokeStyle='#101923';ctx.lineWidth=4;ctx.stroke();
   ctx.strokeStyle=selected?'#ffce51':'#73e4ff';ctx.lineWidth=2;ctx.stroke();
  }
  ctx.restore();
 }
}
