export function skySeamMetrics(frame,width,height){
 const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
 const jumps=Array.from({length:height},(_,y)=>{const a=rgb(frame[y*width]),b=rgb(frame[y*width+width-1]);return a.reduce((n,v,i)=>n+Math.abs(v-b[i]),0)/3;});
 const mean=a=>a.reduce((n,v)=>n+v,0)/a.length,sky=jumps.slice(0,Math.max(1,Math.floor(height*.65)));
 const result={meanRGB:mean(jumps),skyMeanRGB:mean(sky),maximumRGB:Math.max(...jumps),largeJumpFraction:jumps.filter(v=>v>80).length/height};
 return {...result,numericWarning:result.meanRGB>20||result.skyMeanRGB>12||result.largeJumpFraction>.2,visualReviewRequired:true};
}
