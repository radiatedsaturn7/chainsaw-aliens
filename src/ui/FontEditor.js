import {openEditorForm,chooseEditorFiles} from './shared/editorForm.js';
import {readMenuAppearanceFile,MenuAppearanceResources} from '../menus/MenuAppearance.js';
import {loadFontLibrary,saveLibraryFont} from './FontLibrary.js';

// A font library has no spatial document to pan or transform. Keep its sample and
// library controls together in the shared responsive modal, with actions at the bottom.
export async function openFontEditor({select=false,current=null,name=''}={}){
 const fonts=await loadFontLibrary(),resources=new MenuAppearanceResources();
 if(current?.fontData&&!fonts.some(f=>f.fontData===current.fontData))fonts.push(await saveLibraryFont(current));
 const ready=async font=>{resources.font(font);const entry=resources.fonts.get(font.fontData);await entry?.pending;if(entry&&!entry.ready)throw Error('Could not load this font. Try uploading it again.');};
 await Promise.all(fonts.map(ready));
 let initial=fonts.find(f=>f.name===name||current?.fontData===f.fontData)?.name||fonts[0]?.name||'';
 const fields=[
  {id:'font',label:'Saved font',required:false,value:initial,options:()=>[{value:'',label:'System font / no uploaded font'},...fonts.map(f=>({value:f.name,label:f.name}))]},
  {id:'sample',label:'Preview text',type:'text',value:'Lap 1 / 3   01:23.456',required:false},
  {id:'size',label:'Preview size',value:30,min:8,max:96},
  {id:'preview',label:'Font preview',type:'preview',render:(canvas,state)=>{
   const ctx=canvas.getContext('2d'),font=fonts.find(f=>f.name===state.font);ctx.clearRect(0,0,320,180);ctx.fillStyle='#ffffff';ctx.textBaseline='middle';ctx.font=`${state.size}px ${font?resources.font(font):'sans-serif'}`;ctx.fillText(state.sample,12,70,296);ctx.font=`14px ${font?resources.font(font):'sans-serif'}`;ctx.fillText('ABCDEFGHIJKLMNOPQRSTUVWXYZ',12,125,296);ctx.fillText('0123456789 : . / -',12,150,296);
  }},
  {id:'upload',label:'Upload font (TTF / OTF / WOFF / WOFF2)',type:'button',onClick:async()=>{
   const [file]=await chooseEditorFiles('.ttf,.otf,.woff,.woff2');if(!file)return {};
   const font={fontData:await readMenuAppearanceFile('font',file),fontFileName:file.name};await ready(font);
   const saved=await saveLibraryFont(font);if(!fonts.some(f=>f.name===saved.name))fonts.push(saved);return {font:saved.name};
  }}
 ];
 const result=await openEditorForm(select?'Choose font':'Font Editor',fields,{applyLabel:select?'Use font':'Done',description:'Preview and upload reusable fonts. Uploads are saved immediately in Project Browser → Fonts. Choosing a font embeds a copy in the car or menu; save that document to keep the change.'});
 if(!result)return null;
 const chosen=fonts.find(f=>f.name===result.font);return chosen?{fontData:chosen.fontData,fontFileName:chosen.fontFileName,fontFamily:chosen.fontFamily}:{fontData:'',fontFileName:'',fontFamily:'sans-serif'};
}
