// Test-only navigation plan. Never select the target programmatically before its card input.
export function catalogPickerPlan(values,targetName,maximum=4){
 const index=values.indexOf(targetName);
 if(index<0)throw Error('Catalog target is not a showroom choice: '+targetName);
 if(new Set(values).size!==values.length)throw Error('Ambiguous showroom choices');
 const size=Math.max(1,Math.min(4,Math.round(maximum))),start=Math.floor(index/size)*size;
 const neighbor=values.slice(start,start+size).find(value=>value!==targetName);
 if(neighbor)return {targetName,index,start,stageName:neighbor,selection:'card'};
 if(index>0)return {targetName,index,start,stageName:values[index-1],selection:'next'};
 throw Error('Catalog requires a distinct staging choice');
}
