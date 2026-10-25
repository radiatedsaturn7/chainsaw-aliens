import {loadingFact} from './MenuLoadingScreen.js';
import {drawWorldMap} from './MenuWorldMapRenderer.js';
import {menuTypedText} from './MenuTypewriter.js';
import {garageDialogueContext,garageDialogueText} from '../garage/GarageDialogue.js';
import {menuControlFilter} from './MenuControlStyle.js';
import {drawMenuWeather} from './MenuWeather.js';
import {menuTextFill,drawMenuText} from './MenuAppearance.js';
import {drawUpgradeGrid} from './MenuUpgradeRenderer.js';
import {drawGarageTuner} from './MenuTuningRenderer.js';
import {drawCodeEntry} from './MenuCodeEntry.js';
import {worldMapNodes,worldMapRaceNodes,worldMapSelection} from './MenuWorldMap.js';
import {showroomPage,garageBrowserRows,garageCardBounds} from './MenuGarageWidgets.js';
import {menuPaintOrder,menuElementVisible} from './MenuLayout.js';
import {menuElementPose,resolveMenuBackground} from './MenuDocument.js';
import {calculateCarPerformance} from '../racing/CarPerformance.js';

export const menuElementBounds=(element,bounds,pose=element)=>({x:bounds.x+pose.x*bounds.w,y:bounds.y+pose.y*bounds.h,w:element.w*bounds.w,h:element.h*bounds.h});
export const menuElementInteractive=e=>['garage-tuner','code-entry','world-map','car-showroom','garage-browser','button','choice','slider','toggle','keybind'].includes(e.type);
export const menuHit=(point,b)=>point.x>=b.x&&point.x<=b.x+b.w&&point.y>=b.y&&point.y<=b.y+b.h;
export function drawMenuImage(ctx,image,b,fit='contain'){
  const scale=fit==='cover'?Math.max(b.w/image.width,b.h/image.height):Math.min(b.w/image.width,b.h/image.height);
  const w=fit==='stretch'?b.w:image.width*scale,h=fit==='stretch'?b.h:image.height*scale;
  ctx.drawImage(image,b.x+(b.w-w)/2,b.y+(b.h-h)/2,w,h);
}
const caption=(text,parameters)=>String(text).replace(/\{\{([\w.-]+)\}\}/g,(_,key)=>String(parameters[key]??''));

export function drawMenuScreen(ctx,bounds,document,screen,parameters,{time=0,resources,focus=null,selected=null,editing=false,worldMapEditingId=null,videos=null,widgetStates=new Map()}={}){
  screen=resolveMenuBackground(document,screen,parameters);
  // Authoring does not run MenuPlayer's selection initialization. Resolve the
  // same fallback for the showroom and every bound widget without editing the document.
  for(const element of screen.elements){
    if(element.type!=='car-showroom'||!element.binding||!menuElementVisible(element,screen.elements))continue;
    const choices=resources?.choices('cars',document,parameters)||[];
    if(choices.length&&!choices.some(choice=>choice.value===parameters[element.binding]))parameters={...parameters,[element.binding]:choices[0].value};
  }
  ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.clip();ctx.fillStyle=screen.background;ctx.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);
  const background=resources?.art(screen.backgroundArt,Math.floor(time*8));if(background)ctx.drawImage(background,bounds.x,bounds.y,bounds.w,bounds.h);
  if(['snow','rain'].includes(screen.effect))drawMenuWeather(ctx,bounds,document,screen,time);
  else if(screen.effect==='stars'){
    ctx.save();ctx.fillStyle=screen.effect==='stars'?'#ffffff':'#91bedb';ctx.strokeStyle='#91bedb';ctx.globalAlpha=0.5;
    for(let i=0;i<65;i++){const x=bounds.x+((i*0.61803398875)%1)*bounds.w,y=bounds.y+((i*0.381966+time*(screen.effect==='rain'?0.5:0.04))%1)*bounds.h;
      if(screen.effect==='rain'){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4,y+12);ctx.stroke()}else ctx.fillRect(x,y,screen.effect==='snow'?3:2,screen.effect==='snow'?3:2);
    }ctx.restore();
  }
  for(const element of menuPaintOrder(screen.elements)){
    if(!menuElementVisible(element,screen.elements))continue;const pose=editing?{x:element.x,y:element.y,opacity:1,scale:1,rotation:0}:menuElementPose(element,time),b=menuElementBounds(element,bounds,pose);
    const drawText=(text,...args)=>drawMenuText(ctx,element,['text','button','choice','toggle','keybind','property-display'].includes(element.type)?menuTypedText(element,text,time,editing):text,...args);
    ctx.save();ctx.translate(b.x+b.w/2,b.y+b.h/2);ctx.rotate(pose.rotation*Math.PI/180);ctx.scale(pose.scale,pose.scale);ctx.translate(-b.x-b.w/2,-b.y-b.h/2);ctx.globalAlpha=pose.opacity;
    ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();
    const interactive=menuElementInteractive(element);
    if(interactive&&(element.disabled||['button','choice','slider','toggle','keybind'].includes(element.type)))ctx.filter=menuControlFilter(editing||element.id===focus,!element.disabled);
    if(interactive&&element.type!=='world-map'&&!element.transparentBackground){ctx.fillStyle=element.background;ctx.fillRect(b.x,b.y,b.w,b.h);}
    if(element.type==='button'&&element.artRef){const image=resources?.art(element.artRef,Math.floor(time*8));if(image)drawMenuImage(ctx,image,b,element.imageFit);}
    const fontSource=element.useDefaultFont?document.defaultFont||element:element;
    const fontFamily=resources?.font?.(fontSource)||fontSource.fontFamily||'system-ui';
    let cursorLabelWidth=null;
    ctx.fillStyle=element.color;ctx.font=`${Math.max(10,element.fontSize*Math.min(bounds.w/720,bounds.h/900))}px ${fontFamily}`;ctx.textAlign='center';ctx.textBaseline='middle';
    let label=caption(element.label,parameters),value=parameters[element.binding];
    const textSize=Math.max(10,element.fontSize*Math.min(bounds.w/720,bounds.h/900));
    ctx.fillStyle=menuTextFill(ctx,element,b,label,textSize);
    if(element.type==='progress-bar'){
      const progress=Math.max(0,Math.min(1,Number(value??(editing?.5:0))||0));
      const inset=Math.min(element.strokeWidth/2,b.w/2,b.h/2);
      ctx.fillStyle=element.background;ctx.fillRect(b.x,b.y,b.w,b.h);
      ctx.fillStyle=element.fill;ctx.fillRect(b.x+inset,b.y+inset,Math.max(0,b.w-2*inset)*progress,Math.max(0,b.h-2*inset));
      if(element.strokeWidth){ctx.strokeStyle=element.stroke;ctx.lineWidth=element.strokeWidth;ctx.strokeRect(b.x+inset,b.y+inset,b.w-2*inset,b.h-2*inset);}
    }
    else if(element.type==='random-fact')drawCarDescription(ctx,b,loadingFact(element,parameters.loadingFactSeed,editing),fontFamily,element,{time,editing});
    else if(element.type==='shape'){
      ctx.beginPath();const inset=element.strokeWidth/2,x=b.x+inset,y=b.y+inset,w=Math.max(0,b.w-2*inset),h=Math.max(0,b.h-2*inset);
      if(element.shape==='ellipse')ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);
      else if(element.shape==='triangle'){ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.closePath();}
      else ctx.rect(x,y,w,h);
      ctx.fillStyle=element.fill;ctx.fill();if(element.strokeWidth){ctx.strokeStyle=element.stroke;ctx.lineWidth=element.strokeWidth;ctx.stroke();}
    }
    else if(element.type==='container'){if(editing){ctx.strokeStyle='#7496a8';ctx.lineWidth=1;ctx.setLineDash?.([5,4]);ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.setLineDash?.([]);drawText(element.label,b.x+b.w/2,b.y+12,b.w-12);}}
    else if(element.type==='image'){const image=resources?.art(element.artRef,Math.floor(time*8));if(image)drawMenuImage(ctx,image,b,element.imageFit);else drawText(element.artRef||'Choose artwork',b.x+b.w/2,b.y+b.h/2,b.w-12);}
    else if(element.type==='video'){const video=videos?.get(element.id);if(video?.readyState>=2)ctx.drawImage(video,b.x,b.y,b.w,b.h);else drawText(editing?'Video: '+(element.videoUrl||'Choose source'):'Loading video…',b.x+b.w/2,b.y+b.h/2,b.w-12);}
    else if(element.type==='property-display'){const property=resources?.property(element,parameters);const shown=property==null?'—':typeof property==='number'?property.toFixed(element.decimals):typeof property==='object'?JSON.stringify(property):String(property);drawText(`${label}${label?': ':''}${shown}${element.suffix}`,b.x+b.w/2,b.y+b.h/2,Math.max(1,b.w-12));}
    else if(element.type==='asset-preview'){const image=resources?.assetArt(element,parameters,time);if(image)drawMenuImage(ctx,image,b,element.imageFit);else drawText('Choose an actor / item image',b.x+b.w/2,b.y+b.h/2,Math.max(1,b.w-12));}
    else if(element.type==='car-showroom'){
      const choices=resources?.choices('cars',document,parameters)||[];
      const page=showroomPage(choices,value,element.maxVisible),state=widgetStates.get(element.id)||{};
      if(!choices.length)drawText('Save a car in the Car Editor to begin',b.x+b.w/2,b.y+b.h/2,b.w-16);
      for(const [i,entry] of page.entries.entries()){
        const selected=entry.value===(value||choices[0]?.value),card=garageCardBounds(b,page.entries.length,i);
        const elapsed=Math.max(0,time-(state.selectedAt??time));
        const blend=editing?1:1-Math.exp(-elapsed*3/(element.selectedZoomDuration??.18));
        const scale=selected?1+(element.selectedScale-1)*blend:1;
        ctx.save();ctx.globalAlpha*=selected?1:element.inactiveOpacity;
        ctx.fillStyle='#34434a';ctx.beginPath();ctx.ellipse(card.x+card.w/2,card.y+card.h*.8,card.w*.43,card.h*.09,0,0,Math.PI*2);ctx.fill();
        const preview={x:card.x+card.w*(1-scale)/2,y:card.y+card.h*(1-scale)/2,w:card.w*scale,h:card.h*.85*scale};
        const car=resources?.car(entry.value),view={...element,type:'car-preview',animation:'none',angleBinding:'',angle:element.angle+(selected&&!editing?elapsed/element.duration*360:0)};
        const draw=(context,area)=>drawCarComponent(context,area,view,car,resources,time,parameters,fontFamily);
        if(!selected&&resources?.drawParkedCar)resources.drawParkedCar(ctx,preview,car,element.angle,draw);else draw(ctx,preview);
        ctx.fillStyle=element.color;drawText(entry.label,card.x+card.w/2,card.y+card.h-4,card.w-8);ctx.restore();
      }

    }
    else if(element.type==='world-map'){const mapBackground=element.artRef?resources?.art(element.artRef,Math.floor(time*8)):null;if(mapBackground)drawMenuImage(ctx,mapBackground,b,element.imageFit);drawWorldMap(ctx,b,element,resources,document,parameters,value,{drawText,fontFamily});}
    else if(element.type==='garage-browser')drawUpgradeGrid(ctx,b,element,resources,parameters,widgetStates.get(element.id),fontFamily);
    else if(element.type==='garage-tuner')drawGarageTuner(ctx,b,widgetStates.get(element.id)?.tuner,fontFamily,element,resources);
    else if(element.type==='code-entry')drawCodeEntry(ctx,b,element,value,widgetStates.get(element.id),element.id===focus);
    else if(element.type==='garage-dialogue')drawGarageDialogueText(ctx,b,widgetStates.get(element.id)?.text??garageDialogueText(garageDialogueContext(screen,resources,parameters,widgetStates,focus||selected)),fontFamily,element,{time,editing});
    else if(element.type==='race-description'){
      const map=screen.elements.find(e=>e.type==='world-map'&&e.binding===element.binding);
      const ref=element.assetRef||value||(map?worldMapSelection(worldMapNodes(map,resources,document,parameters),parameters[map.binding])?.raceRef:'');
      drawCarDescription(ctx,b,resources?.race?.(ref)?.description||'',fontFamily,element,{time,editing});
    }
    else if(element.type==='car-description'){
      const car=resources?.car(element.assetRef||value);
      drawCarDescription(ctx,b,car?.description?.trim()||'No description yet.',fontFamily,element);
    }
    else if(['car-preview','car-stats','power-curve'].includes(element.type))drawCarComponent(ctx,b,element,resources?.car(element.assetRef||value),resources,time,parameters,fontFamily);
    else{
      if(element.type==='choice'){const options=element.source?resources?.choices(element.source,document,parameters)||[]:element.options;label+=`: ${options.find(o=>JSON.stringify(o.value)===JSON.stringify(value))?.label||'Choose…'}`;}
      if(element.type==='toggle')label+=value?' ✓':' —';
      if(element.type==='keybind')label+=`: ${value||'Set key'}`;
      if(element.type==='slider'){
        const number=Number.isFinite(Number(value))?Number(value):element.min,ratio=Math.max(0,Math.min(1,(number-element.min)/(element.max-element.min||1)));
        ctx.fillStyle='#18242d';ctx.fillRect(b.x+10,b.y+b.h*0.7,b.w-20,5);ctx.fillStyle=element.color;ctx.fillRect(b.x+10,b.y+b.h*0.7,(b.w-20)*ratio,5);
        label+=`: ${Number(number.toFixed(2))}`;ctx.fillStyle=menuTextFill(ctx,element,b,label,textSize,b.y+b.h*.35);drawText(label,b.x+b.w/2,b.y+b.h*0.35,b.w-16);
      }else {ctx.fillStyle=menuTextFill(ctx,element,b,label,textSize);cursorLabelWidth=Math.min(ctx.measureText(label)?.width||0,Math.max(1,b.w-16));drawText(label,b.x+b.w/2,b.y+b.h/2,Math.max(1,b.w-16));}
    }
    ctx.restore();
    if(!(editing&&element.id===worldMapEditingId)&&((element.id===focus&&!element.disabled&&element.type!=='world-map')||element.id===selected)){
      const indicator=editing?'border':element.selectionIndicator||(element.selectionBorder===false?'disabled':'border');
      ctx.save();ctx.strokeStyle=ctx.fillStyle=element.id===selected?'#ffce51':'#ffffff';ctx.lineWidth=3;
      if(indicator==='border')ctx.strokeRect(b.x+1,b.y+1,b.w-2,b.h-2);
      else if(indicator==='cursor'){
        const size=Math.max(1,Math.min((element.cursorSize??24)*Math.min(bounds.w/720,bounds.h/900),b.h*.8,b.w*.15)),x=cursorLabelWidth===null?b.x+Math.min(6,b.w*.05):Math.max(b.x+2,b.x+(b.w-cursorLabelWidth)/2-size-8),y=b.y+(b.h-size)/2;
        const cursor=resources?.cursor?.(element);
        if(cursor)drawMenuImage(ctx,cursor,{x,y,w:size,h:size});
        else{ctx.font=`${Math.max(8,size)}px ${fontFamily}`;ctx.textAlign='left';ctx.textBaseline='middle';drawText(element.cursorText??'>',x,b.y+b.h/2,Math.max(1,b.w*.15));}
      }
      if(editing){ctx.fillStyle='#ffce51';ctx.fillRect(b.x+b.w-10,b.y+b.h-10,10,10)}ctx.restore();
    }
  }
  ctx.restore();
}
function drawCarComponent(ctx,b,e,car,resources,time,parameters,fontFamily='system-ui'){
  const drawText=(...args)=>drawMenuText(ctx,e,...args);
  if(!car){drawText('Choose a car',b.x+b.w/2,b.y+b.h/2,b.w-10);return;}
  const renderer=resources.game.carEditor,tuning=resources.tuning(car);
  if(e.type==='car-preview'){
    ctx.save();const yaw=e.angleBinding?Number(parameters[e.angleBinding]??e.angle)*Math.PI/180:e.animation==='spin'?(e.loop?time/e.duration:Math.min(1,time/e.duration))*Math.PI*2:e.angle*Math.PI/180;
    const choice=renderer.getRaceCarProjectedArtRef(car,0,yaw);
    if(car.art?.bodyModel?.ref||!choice.artRef){resources.carPreview.draw(ctx,b,car,yaw+Math.PI,time);ctx.restore();return;}
    resources.carPreview.drawSprite(ctx,b,car,choice);ctx.restore();return;
  }
  if(e.type==='car-stats'){
    const performance=calculateCarPerformance({...car,tuning:{...car.tuning,...tuning,topSpeedMph:tuning.topSpeedMps!=null?tuning.topSpeedMps/0.44704:car.tuning?.topSpeedMph}});const lines=[car.name||'Car',`${Math.round(tuning.powerHp||0)} HP · ${Math.round(Number(tuning.torqueLbFt||0)*1.355817948)} Nm`,`${Math.round(tuning.weightKg||0)} kg · ${tuning.drivetrain||car.tuning?.drivetrain||''}`,`Class ${performance.class} · ${performance.points} PI`];
    lines.forEach((line,i)=>drawText(line,b.x+b.w/2,b.y+(i+0.5)*b.h/lines.length,b.w-10));return;
  }
  const min=Number(tuning.idleRpm||800),max=Number(tuning.redlineRpm||7000),points=Array.from({length:41},(_,i)=>{const rpm=min+(max-min)*i/40,torque=renderer.getRaceTorqueNmAtRpm(rpm,tuning);return {rpm,torque,hp:torque*rpm/7127}}),peak=Math.max(1,...points.flatMap(p=>[p.torque,p.hp]));
  const compact=b.h<80,plotTop=b.y+(compact?4:25),plotBottom=b.y+b.h-(compact?4:20),plotHeight=Math.max(1,plotBottom-plotTop);
  ctx.font=`${Math.max(10,Math.min(14,b.h/8))}px ${fontFamily}`;if(!compact)drawText('HP (gold) · Torque Nm (blue)',b.x+b.w/2,b.y+12,b.w-12);
  for(const [key,color] of [['hp','#ffd467'],['torque','#72caff']]){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();points.forEach((p,i)=>{const x=b.x+10+i/40*(b.w-20),y=plotBottom-p[key]/peak*plotHeight;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();}
  if(!compact)drawText(`${min} — ${max} RPM`,b.x+b.w/2,b.y+b.h-7,b.w-12);
}

export function drawCarDescription(ctx,b,description,fontFamily='system-ui',element=null,{time=0,editing=false}={}){
  const text=String(description).split('\n').map(p=>p.trim().replace(/\s+/g,' ')).join('\n');
  const revealed=menuTypedText(element,text,time,editing).length;
  let fontSize=element?.type==='random-fact'?Math.max(10,element.fontSize*b.w/576):Math.max(10,Math.min(22,b.w/36));
  const width=Math.max(1,b.w-16),height=Math.max(1,b.h-8);
  ctx.textAlign='left';ctx.textBaseline='top';
  const wrap=()=>{
    ctx.font=`${fontSize}px ${fontFamily}`;
    const lines=[];
    for(const paragraph of text.split('\n')){
      let line='';
      for(const word of paragraph.split(/\s+/).filter(Boolean)){
        const next=line?line+' '+word:word;
        if(line&&ctx.measureText(next).width>width){lines.push(line);line='';}
        for(const char of (line?' '+word:word)){
          if(line&&ctx.measureText(line+char).width>width){lines.push(line);line='';}
          line+=char;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  let lines=wrap();
  // Fit the complete race description before revealing letters. The map panel
  // stays fixed, and the font and line breaks stay stable while text types out.
  if(['race-description','random-fact'].includes(element?.type)){
    while(fontSize>1&&lines.length*fontSize*1.4>height){
      fontSize=Math.max(1,fontSize-.25);lines=wrap();
    }
  }
  const lineHeight=fontSize*1.4;
  const limit=Math.max(1,Math.floor((b.h-8)/lineHeight)),visible=lines.slice(0,limit);
  if(lines.length>limit){let last=visible.at(-1);while(last&&ctx.measureText(last+'…').width>width)last=last.slice(0,-1);visible[visible.length-1]=last+'…';}
  let cursor=0;
  visible.forEach((line,i)=>{
    const sourceLine=lines[i];
    const start=text.indexOf(sourceLine,cursor);
    cursor=Math.max(cursor,start)+sourceLine.length;
    const shown=line.slice(0,Math.max(0,revealed-Math.max(0,start)));
    const y=b.y+4+i*lineHeight;
    if(element){const w=Math.min(width,ctx.measureText(line).width);ctx.fillStyle=menuTextFill(ctx,element,{x:b.x+8-8,y,w:w+16,h:fontSize},line,fontSize,y);}
    drawMenuText(ctx,element,shown,b.x+8,y,width);
  });
}

export function drawGarageDialogueText(ctx,b,value,fontFamily,element,{time=0,editing=false}={}){
 if(!value)return;
 const width=Math.max(1,b.w-12),height=Math.max(1,b.h-8);
 // Use the authored font size; fit only when a long line needs extra room.
 let size=Math.max(8,(element.fontSize||34)*b.w/912),lines=[];
 for(;size>=5;size-=.5){
  ctx.font=`${size}px ${fontFamily}`;lines=[];let line='';
  for(const word of String(value).split(/\s+/)){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>width){lines.push(line);line=word;}else line=next;}
  if(line)lines.push(line);if(lines.length*size*1.2<=height)break;
 }
 size=Math.max(5,size);ctx.font=`${size}px ${fontFamily}`;
 ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle=element.color;
 let remaining=menuTypedText(element,value,time,editing).length;
 lines.forEach((line,i)=>{const shown=line.slice(0,Math.max(0,remaining));remaining-=line.length+1;drawMenuText(ctx,element,shown,b.x+6,b.y+4+i*size*1.2,width);});
}
