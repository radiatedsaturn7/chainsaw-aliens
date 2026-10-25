import {hydrateProjectFilePayload,listProjectFiles,saveProjectFileAndConfirm,sanitizeProjectFileName} from './projectFiles.js';
import {hydrateServerStorage} from './serverStorage.js';

export function embeddedFonts(value,result=new Map()){
 if(!value||typeof value!=='object')return result;
 if(typeof value.fontData==='string'&&value.fontData.startsWith('data:'))result.set(value.fontData,{kind:'font',fontData:value.fontData,fontFileName:value.fontFileName||'Imported font',fontFamily:value.fontFamily||'sans-serif'});
 for(const child of Object.values(value))if(child&&typeof child==='object')embeddedFonts(child,result);
 return result;
}
export async function saveLibraryFont(font,{list=listProjectFiles,load=hydrateProjectFilePayload,save=saveProjectFileAndConfirm}={}){
 const entries=list('fonts');
 for(const entry of entries){const payload=await load('fonts',entry.name);if(payload?.data?.fontData===font.fontData)return {name:entry.name,...payload.data};}
 const base=sanitizeProjectFileName(font.fontFileName||'Font');let name=base,index=2;
 while(entries.some(e=>e.name===name))name=base+' '+index++;
 const data={kind:'font',fontData:font.fontData,fontFileName:font.fontFileName||name,fontFamily:font.fontFamily||'sans-serif'};
 await save('fonts',name,data);return {name,...data};
}
export async function loadFontLibrary({recoverEmbedded=true}={}){
 await hydrateServerStorage();
 const found=new Map();
 // Recover reusable fonts from older embedded-only car/menu saves, without changing those documents.
 for(const folder of (recoverEmbedded?['cars','menus']:[]))for(const entry of listProjectFiles(folder)){
  const payload=await hydrateProjectFilePayload(folder,entry.name);embeddedFonts(payload?.data,found);
 }
 for(const font of found.values())await saveLibraryFont(font);
 const fonts=[];
 for(const entry of listProjectFiles('fonts')){const payload=await hydrateProjectFilePayload('fonts',entry.name);if(payload?.data?.fontData)fonts.push({name:entry.name,...payload.data});}
 return fonts;
}
