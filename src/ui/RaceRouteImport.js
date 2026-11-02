// Project a map tap onto source road segments, including their endpoints.
export function snapRoadPoint(roads, point){
  let best=null;
  for(const road of roads)for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;
    const t=d?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/d)):0;
    const x=a.x+t*dx,y=a.y+t*dy,distance=Math.hypot(point.x-x,point.y-y);
    if(!best||distance<best.distance)best={x,y,distance};
  }
  return best;
}

// Focused import workspace: roads remain visible while placing/editing waypoints.
export async function chooseRoadRoute({form,busy,placeId,radius=10000}){
  const network=await busy('Loading mapped roads…',{action:'network',placeId,radius});
  let points=[null,null],selected=0,automatic=true,transform=null,viewKey=null,viewCenter=null,placementHint='';
  const all=network.roads.flatMap(r=>r.points);
  const bounds=ps=>{const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);return {x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,w:Math.max(100,Math.max(...xs)-Math.min(...xs)),h:Math.max(100,Math.max(...ys)-Math.min(...ys))};};
  const whole=bounds(all);
  const label=i=>i===0?'Start':i===points.length-1?'Finish':`Via ${i}`;
  const values=await form('Plan point-to-point race',[
    {id:'road',label:'Focus on road (optional)',type:'select',value:'all',options:[{value:'all',label:'All mapped roads'},...network.roads.filter(r=>r.name!=='Unnamed road').map(r=>({value:String(r.id),label:r.name}))]},
    {id:'zoom',label:'Map zoom',type:'range',value:1,min:1,max:12,step:.25},
    {type:'preview',label:'Tap a road to place the selected point. Yellow: start; red: finish; blue: via.',height:300,render:(canvas,v)=>{
      const ctx=canvas.getContext('2d');ctx.fillStyle='#101820';ctx.fillRect(0,0,canvas.width,canvas.height);
      const road=network.roads.find(r=>String(r.id)===v.road),b=road?bounds(road.points):whole;
      const key=JSON.stringify([v.road,Number(v.zoom)]);
      if(key!==viewKey){viewCenter=Number(v.zoom)>1&&points[selected]?{...points[selected]}:b;viewKey=key;}
      const center=viewCenter;
      const scale=Math.min((canvas.width-32)/b.w,(canvas.height-50)/b.h)*Number(v.zoom||1);
      transform={scale,x:center.x,y:center.y,cx:canvas.width/2,cy:canvas.height/2};
      const pos=p=>[(p.x-center.x)*scale+canvas.width/2,(p.y-center.y)*scale+canvas.height/2];
      for(const r of network.roads){ctx.strokeStyle=r===road?'#fff1a0':'#6aa7a7';ctx.lineWidth=r===road?3:1.5;ctx.beginPath();r.points.forEach((p,i)=>{const [x,y]=pos(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();}
      points.forEach((p,i)=>{if(!p)return;const [x,y]=pos(p);ctx.fillStyle=i===0?'#ffe16a':i===points.length-1?'#ff766f':'#7dbdff';ctx.beginPath();ctx.arc(x,y,i===selected?7:5,0,Math.PI*2);ctx.fill();ctx.font='12px system-ui';ctx.fillText(label(i),x+9,y-8);});
      ctx.fillStyle='#fff';ctx.font='14px system-ui';ctx.fillText(`${selected<0?'Add intermediate points':`Place ${selected===0?'start':selected===points.length-1?'end':label(selected)}`} · ${points.filter(Boolean).length} points`,8,20);
      if(placementHint){ctx.font='12px system-ui';ctx.fillStyle='#ffe16a';ctx.fillText(placementHint,8,canvas.height-8);}
    },onPointer:e=>{if(e.phase==='pointerdown'&&transform){const snapped=snapRoadPoint(network.roads,{x:(e.x-transform.cx)/transform.scale+transform.x,y:(e.y-transform.cy)/transform.scale+transform.y});
      if(snapped&&snapped.distance*transform.scale<=32){const point={x:snapped.x,y:snapped.y};
        if(selected<0){
          if(points.length>=16){placementHint='Maximum 14 intermediate points reached.';return {};}
          points.splice(points.length-1,0,point);placementHint=`Via ${points.length-2} snapped to road`;
        }else{
          points[selected]=point;placementHint=`${label(selected)} snapped to road`;
          if(automatic)selected=selected===0?points.length-1:-1;
        }}
      else placementHint='Tap nearer a visible road, or zoom in.';}return {}; }},
    {type:'button',label:'Edit next point (Start → vias → Finish)',onClick:()=>{automatic=false;selected=(selected+1)%points.length;viewKey=null;}},
    {type:'button',label:'Add intermediate waypoint before Finish',onClick:()=>{automatic=true;selected=!points[0]?0:!points.at(-1)?points.length-1:-1;}},
    {type:'button',label:'Remove selected intermediate waypoint',onClick:()=>{if(selected>0&&selected<points.length-1){points.splice(selected,1);selected=Math.min(selected,points.length-1);}}},
    {id:'routing',label:'Routing',type:'select',value:'auto',options:[{value:'auto',label:'Valhalla, with connected OSM fallback'},{value:'direct',label:'Trace connected OSM roads directly'}]}
  ],{applyLabel:'Preview route',validate:()=>points.some(p=>!p)?'Place Start, Finish and every intermediate waypoint on the roads.':null,description:`${network.scope||'Mapped roads'}. Tap once to place Start, then tap to place End. Further taps add intermediate points before End in the order you place them. Tap near a road to snap onto it. The marker shows the exact snapped location. Add via points to choose preferred roads; they are visited in order. Focus on a named road and zoom for precise placement. Direct tracing respects one-way roads but ignores access/seasonal restrictions for race authoring; this is not a real-world navigation tool. © OpenStreetMap contributors.`});
  if(!values)return null;
  if(points.some(p=>!p))throw Error('Place all start, finish and via points on the map before previewing the route.');
  return busy('Routing and matching OSM roads…',{action:'route',networkId:network.networkId,waypoints:points,routing:values.routing});
}
