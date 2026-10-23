import {drawMenuText} from './MenuAppearance.js';
export function menuCodeValue(value,length=6){return String(value||'').toUpperCase().replace(/[^A-Z]/g,'').padEnd(length,'A').slice(0,length);}
export function cycleCodeLetter(value,index,direction,length=6){const letters=menuCodeValue(value,length).split('');letters[index]=String.fromCharCode(65+(letters[index].charCodeAt(0)-65+direction+26)%26);return letters.join('');}
export function drawCodeEntry(ctx,b,e,value,state={},focused=false){
 const code=menuCodeValue(value,e.codeLength),cell=b.w/code.length;
 ctx.textAlign='center';ctx.textBaseline='middle';
 for(let i=0;i<code.length;i++){
  const x=b.x+cell*(i+.5);
  if(focused&&i===(state.index||0)){ctx.fillStyle='#39434d';ctx.fillRect(b.x+i*cell+2,b.y,cell-4,b.h*.72);}
  ctx.fillStyle=e.color;drawMenuText(ctx,e,'▲',x,b.y+b.h*.12,cell-4);drawMenuText(ctx,e,code[i],x,b.y+b.h*.36,cell-4);drawMenuText(ctx,e,'▼',x,b.y+b.h*.60,cell-4);
 }
 ctx.fillStyle=e.color;drawMenuText(ctx,e,'ENTER',b.x+b.w/2,b.y+b.h*.88,b.w-8);
}
