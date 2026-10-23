const states=new WeakMap();
export function typewriterLength(text,seconds,{typewriterSpeed=40,typewriterPause=.35,loop=false}={}){
 const chars=Array.from(text),step=1/Math.max(1,typewriterSpeed),pause=Math.max(0,typewriterPause);
 const duration=chars.length*step+chars.filter(c=>/[.!?]/.test(c)).length*pause;
 let remaining=Math.max(0,seconds);if(loop&&duration)remaining%=duration+1;
 let count=0;
 for(const char of chars){remaining-=step;if(remaining<-1e-9)break;count++;if(/[.!?]/.test(char))remaining-=pause;}
 return count;
}
export function menuTypedText(element,text,time=0,editing=false){
 text=String(text??'');
 if(element?.animation!=='typewriter'||editing)return text;
 let state=states.get(element);
 if(!state||state.text!==text||time<state.lastTime){state={text,start:time,lastTime:time};states.set(element,state);}
 state.lastTime=time;
 return Array.from(text).slice(0,typewriterLength(text,time-state.start,element)).join('');
}
