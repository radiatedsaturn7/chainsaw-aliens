import {test,expect} from '@playwright/test';
// Exercise the production menu renderer in a real canvas without hydrating
// hundreds of car sprites or starting a race. Docker CI provides Chromium.
for(const viewport of [{width:844,height:390},{width:390,height:844}]){
 test(`regional campaign canvas ${viewport.width}x${viewport.height}`,async({page},info)=>{
  await page.setViewportSize(viewport);
  await page.route('**/campaign-path-preview',route=>route.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:black"><canvas id="map"></canvas></body></html>'}));
  await page.goto('/campaign-path-preview');
  const result=await page.evaluate(async()=>{
   const [{normalizeMenuDocument},{drawMenuScreen},{worldMapNodes,raceCompletionKey},{default:MenuPlayer}]=await Promise.all([
    import('/src/menus/MenuDocument.js'),import('/src/menus/MenuRenderer.js'),import('/src/menus/MenuWorldMap.js'),import('/src/menus/MenuPlayer.js')]);
   const doc=normalizeMenuDocument(await(await fetch('/data/server-storage/files/menus/Game%20Menu/document.json')).json());
   const screen=doc.screens.find(s=>s.id==='campaign-hub-1'),map=screen.elements.find(e=>e.type==='world-map');
   const region=doc.parameters.campaignProgression.regions[0],parameters={raceRef:region.mainPath[2]};
   for(const ref of region.mainPath.slice(0,2))parameters[raceCompletionKey(ref)]=true;
   const art=new Image();art.src=`/assets/campaign-art/maps/${map.artRef}.png`;await art.decode();
   const canvas=document.querySelector('canvas');canvas.width=innerWidth;canvas.height=innerHeight;
   drawMenuScreen(canvas.getContext('2d'),{x:0,y:0,w:innerWidth,h:innerHeight},doc,screen,parameters,{resources:{art:ref=>ref===map.artRef?art:null},editing:true});
   let target;const player=Object.create(MenuPlayer.prototype);
   player.resources={};player.flow={busy:false,screen,document:doc,parameters,setParameter(k,v){parameters[k]=v},run:a=>{target=a.target}};
   await player.activate(map,1,{choose:true});
   return {target,count:map.nodes.length,unlocked:worldMapNodes(map,{},doc,parameters).filter(n=>!n.locked).length,quit:player.confirmWorldMapQuit()};
  });
  expect(result).toEqual({target:'garage',count:8,unlocked:3,quit:false});
  await page.screenshot({path:info.outputPath('campaign-path.png')});
 });
}
