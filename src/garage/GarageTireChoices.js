import {listProjectFiles} from '../ui/projectFiles.js';
import catalog from '../content/garage-parts.json' with {type:'json'};

// Only saved tire documents are shop choices; templates stay in the editor.
// Keep the installed copy, then owned inventory, then the authored saved item.
export function garageTireChoices(entries,garage,installed){
 const saved=new Set(listProjectFiles('tires').filter(file=>!file.deleted).map(file=>file.name));
 const choices=catalog.tireChoices||[];
 const ref=item=>String(item.carPart.tireRef||'').replace(/^builtin:/,'').toLowerCase();
 const rank=entry=>entry.item.id===installed?3:garage?.availableCount?.(entry.item.id)>0?2:!entry.item.carPart.tireRef?.startsWith('builtin:')?1:0;
 return choices.flatMap(choice=>{
  const matches=entries.filter(({item})=>item.carPart.slot==='tires'&&saved.has(item.carPart.tireRef)&&item.carPart.forSale!==false&&choice.refs.includes(ref(item)));
  matches.sort((a,b)=>rank(b)-rank(a));
  return matches.length?[{...matches[0],tireLabel:choice.label}]:[];
 });
}
