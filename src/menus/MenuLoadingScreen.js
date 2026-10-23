// Loading uses ordinary menu widgets and the same normalized layout coordinates.
export function createLoadingMenuScreen(splash = {}) {
  return {id:'loading',name:'Race Loading',background:splash.background||'#000000',backgroundArt:splash.backgroundArt||'',useDefaultBackground:false,effect:'none',elements:[
    {id:'loading-label',type:'text',label:'Loading {{loadingRace}}…',x:.1,y:.6,w:.84,h:.08,fontSize:30,textOutlineWidth:2},
    {id:'loading-progress',type:'progress-bar',label:'Loading progress',binding:'loadingProgress',x:.1,y:.73,w:.84,h:.045,fill:'#9bc9df',background:'#101820',stroke:'#ffffff',strokeWidth:2},
    {id:'loading-fact',type:'random-fact',label:'Facts',facts:[],x:.1,y:.82,w:.8,h:.16,fontSize:24,textOutlineWidth:2}
  ]};
}
export function loadingFact(element,seed=0,editing=false){
  const facts=element.facts||[];
  return facts.length?facts[Math.min(facts.length-1,Math.floor(Math.max(0,Math.min(.999999,Number(seed)||0))*facts.length))]:(editing?'Add facts in Properties (one per line).':'');
}
