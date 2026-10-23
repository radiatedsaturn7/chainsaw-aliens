// Keep disabled cells visible without making them navigation targets.
export function selectableIndex(rows,index=0){return rows[index]&&!rows[index].disabled?index:rows.findIndex(row=>!row.disabled);}
export function nextSelectableIndex(rows,index,direction){
 if(!rows.length)return -1;
 for(let step=1;step<=rows.length;step++){const next=((index+direction+Math.sign(direction)*(step-1))%rows.length+rows.length)%rows.length;if(!rows[next].disabled)return next;}
 return -1;
}
export function selectableGridIndex(rows,index,direction,columns=4){
 const origin=selectableIndex(rows,index);if(origin<0)return -1;
 const [ax,ay]={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]}[direction]||[0,0];
 let best=origin,score=Infinity;
 rows.forEach((row,i)=>{if(row.disabled||i===origin)return;const dx=i%columns-origin%columns,dy=Math.floor(i/columns)-Math.floor(origin/columns);if(dx*ax+dy*ay<=0)return;const cost=Math.hypot(dx,dy)+Math.abs(dx*ay-dy*ax)*2;if(cost<score){score=cost;best=i;}});
 return best;
}
