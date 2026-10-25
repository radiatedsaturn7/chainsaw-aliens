// Embedded assets travel with menu saves/exports and participate in undo.
export const menuAppearanceFields=(e,art=[])=>[
 {id:'useDefaultFont',label:'Font source',value:String(e.useDefaultFont!==false),options:[{value:'true',label:'Menu default'},{value:'false',label:'Custom font'}]},
 {id:'fontFamily',label:'Font family (installed font or generic family)',type:'text',value:e.fontFamily||'system-ui'},
 {id:'fontUpload',label:'Font file',value:'keep',options:[{value:'keep',label:e.fontFileName||'Use specified font family'},{value:'upload',label:'Upload font (WOFF2 / WOFF / TTF / OTF)'},{value:'library',label:'Choose saved font / Font Editor'},{value:'clear',label:'Remove uploaded font'}]},
 {id:'textOutlineWidth',label:'Text border size (0 = off)',value:e.textOutlineWidth??0,min:0,max:8,step:0.5},
 {id:'textOutlineColor',label:'Text border color',type:'color',value:e.textOutlineColor||'#000000'},
 {id:'textFill',label:'Text fill',value:e.textFill||'solid',options:[{value:'solid',label:'Solid color / tint'},{value:'gradient',label:'Two-color gradient'},{value:'gradient3',label:'Three-color gradient'}]},
 {id:'textGradientDirection',label:'Gradient direction',value:e.textGradientDirection||'vertical',options:[{value:'vertical',label:'Top to bottom'},{value:'horizontal',label:'Left to right'}]},
 ...[['textGradientStart','Gradient start','#70baff'],['textGradientMiddle','Gradient middle (three colors)','#ffffff'],['textGradientEnd','Gradient end','#70baff']].map(([id,label,fallback])=>({id,label,type:'color',required:false,value:e[id]||fallback})),
 {id:'cursorText',label:'Cursor text',type:'text',required:false,value:e.cursorText??'>'},
 {id:'cursorArtRef',label:'Cursor artwork',value:e.cursorArtRef||'',options:[{value:'',label:'Use cursor text / uploaded image'},...art.map(name=>({value:name,label:name}))]},
 {id:'cursorUpload',label:'Cursor image',value:'keep',options:[{value:'keep',label:e.cursorFileName||'No uploaded image'},{value:'upload',label:'Upload cursor (PNG / WebP / GIF / JPEG)'},{value:'clear',label:'Remove uploaded image'}]},
 {id:'cursorSize',label:'Cursor size (design pixels)',value:e.cursorSize??24,min:8,max:160}
];
const readData=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Could not read file'));r.readAsDataURL(file);});
export async function readMenuAppearanceFile(kind,file){
 const pattern=kind==='font'?/\.(woff2?|ttf|otf)$/i:/\.(png|webp|gif|jpe?g)$/i;
 if(!pattern.test(file.name))throw Error(kind==='font'?'Choose a WOFF2, WOFF, TTF or OTF font.':'Choose a PNG, WebP, GIF or JPEG cursor image.');
 if(file.size>8*1024*1024)throw Error('Choose a file smaller than 8 MB.');
 const source=await readData(file);
 if(kind==='font')await new FontFace('MenuUploadValidation',`url(${JSON.stringify(source)})`).load();
 else await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(Error('Could not decode cursor image'));image.src=source;});
 return source;
}
export async function resolveMenuAppearance(values,{choose,read=readMenuAppearanceFile}={}){
 const {fontUpload,cursorUpload,...result}=values;
 if('useDefaultFont' in result)result.useDefaultFont=String(result.useDefaultFont)==='true';
 if(fontUpload==='upload'||fontUpload==='library')result.useDefaultFont=false;
 if(fontUpload==='library'){const {openFontEditor}=await import('../ui/FontEditor.js');const font=await openFontEditor({select:true});if(!font)return null;Object.assign(result,font);}
 for(const [kind,action] of [['font',fontUpload],['cursor',cursorUpload]]){
  if(action==='clear'){result[`${kind}Data`]='';result[`${kind}FileName`]='';}
  if(action==='upload'){
   const [file]=await choose(kind==='font'?'.woff2,.woff,.ttf,.otf':'.png,.webp,.gif,.jpg,.jpeg');
   if(!file)return null;
   result[`${kind}Data`]=await read(kind,file);result[`${kind}FileName`]=file.name;
   if(kind==='cursor'){result.cursorArtRef='';result.selectionIndicator='cursor';}
  }
 }
 return result;
}

let fontSequence=0;
export class MenuAppearanceResources {
 constructor({FontFace=globalThis.FontFace,fonts=globalThis.document?.fonts,Image=globalThis.Image}={}){this.FontFace=FontFace;this.fontSet=fonts;this.Image=Image;this.fonts=new Map();this.images=new Map();}
 font(e){
  const fallback=e.fontFamily||'system-ui';
  if(!e.fontData||!this.FontFace||!this.fontSet)return fallback;
  let entry=this.fonts.get(e.fontData);
  if(!entry){
   entry={family:`RTGMenuFont${++fontSequence}`,ready:false};this.fonts.set(e.fontData,entry);
   try{const face=new this.FontFace(entry.family,`url(${JSON.stringify(e.fontData)})`);entry.pending=face.load().then(loaded=>{this.fontSet.add(loaded);entry.ready=true;}).catch(()=>{});}catch{}
  }
  return entry.ready?`${entry.family}, ${fallback}`:fallback;
 }
 cursor(e){
  if(!e.cursorData||!this.Image)return null;
  let entry=this.images.get(e.cursorData);
  if(!entry){entry={image:new this.Image(),ready:false};this.images.set(e.cursorData,entry);entry.image.onload=()=>{entry.ready=true;};entry.image.onerror=()=>{};entry.image.src=e.cursorData;}
  return entry.ready?entry.image:null;
 }
}

export function menuEmbeddedAsset(value){
 if(value==null||value==='')return '';
 if(typeof value!=='string'||!value.startsWith('data:'))throw Error('Menu uploads must be embedded data URLs.');
 if(value.length>12*1024*1024)throw Error('Menu upload exceeds 12 MB encoded size.');
 return value;
}

// Fit gradients to the drawn lettering, rather than the often much taller control.
export function menuTextFill(ctx, element, bounds, text = '', fontSize = 20, centerY = bounds.y + bounds.h / 2) {
 if(!['gradient','gradient3'].includes(element.textFill))return element.color || '#ffffff';
 const width=Math.max(1,Math.min(bounds.w-16,ctx.measureText(text).width));
 const left=bounds.x+(bounds.w-width)/2;
 const metrics=ctx.measureText(text);
 const ascent=Number.isFinite(metrics.actualBoundingBoxAscent)?metrics.actualBoundingBoxAscent:fontSize/2;
 const descent=Number.isFinite(metrics.actualBoundingBoxDescent)?metrics.actualBoundingBoxDescent:fontSize/2;
 const top=centerY-ascent,bottom=Math.max(top+1,centerY+descent);
 const horizontal=element.textGradientDirection==='horizontal';
 const gradient=horizontal?ctx.createLinearGradient(left,centerY,left+width,centerY):ctx.createLinearGradient(left,top,left,bottom);
 const color=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
 gradient.addColorStop(0,color(element.textGradientStart,'#70baff'));
 if(element.textFill==='gradient3')gradient.addColorStop(.5,color(element.textGradientMiddle,'#ffffff'));
 gradient.addColorStop(1,color(element.textGradientEnd,'#70baff'));
 return gradient;
}


export function drawMenuText(ctx, element, text, x, y, maxWidth) {
 const width=Number(element?.textOutlineWidth??0);
 if(width>0&&typeof ctx.strokeText==='function'){
  ctx.save();
  ctx.strokeStyle=element?.textOutlineColor||'#000000';
  const fontPixels=Number(/([\d.]+)px/.exec(ctx.font||'')?.[1])||26;
  ctx.lineWidth=2*width*fontPixels/26;
  ctx.lineJoin='round';ctx.miterLimit=2;
  if(maxWidth===undefined)ctx.strokeText(text,x,y);else ctx.strokeText(text,x,y,maxWidth);
  ctx.restore();
 }
 if(maxWidth===undefined)ctx.fillText(text,x,y);else ctx.fillText(text,x,y,maxWidth);
}
