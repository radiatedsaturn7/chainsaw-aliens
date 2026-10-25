import {drawGaugeText} from './CarGauges.js';
import { getNetworkFinishNodes } from './RaceFinishNodes.js';
import { getNetworkEdgePoints } from './RaceRouteNetwork.js';

export function buildRaceMinimap({ network = null, samples = [], circuit = false } = {}) {
  const paths = network ? network.edges.map(edge => ({
    id: edge.id, structure: edge.structure, points: getNetworkEdgePoints(network, edge),
    heightM: getNetworkEdgePoints(network, edge).reduce((sum, p) => sum + p.heightM, 0)
      / Math.max(1, edge.points.length + 2), closed: false
  })).sort((a, b) => a.heightM - b.heightM)
    : [{ id: 'legacy', structure: 'road', points: samples, closed: circuit }];
  const points = paths.flatMap(path => path.points);
  if (points.length < 2) return null;
  const finishes = network ? getNetworkFinishNodes(network) : circuit ? [] : [samples.at(-1)].filter(Boolean);
  return { paths, finishes,
    start: network ? network.nodes.find(n => n.id === network.startNodeId) : samples[0],
    finish: finishes[0] || null,
    minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
    minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z))
  };
}

export function gaugeMapScreenBounds(b,g){return {x:b.x+b.w*(g.mapScreenX||0),y:b.y+b.h*(g.mapScreenY||0),w:b.w*(g.mapScreenWidth??1),h:b.h*(g.mapScreenHeight??1)};}

export function gaugeMinimapTransform(bounds,map,gauge,player,heading=0){
  const markerSize=Math.max(...['player','car','start','finish'].map(k=>gauge[k+'MarkerSize']||6));
  const pad=Math.min(Math.min(bounds.w,bounds.h)*.45,Math.max(6,Math.min(bounds.w,bounds.h)*markerSize/200+gauge.mapLineBorderWidth+2));
  const local=gauge.mapMode==='local',perspective=local&&gauge.mapProjection==='perspective';
  const center=local?player:{x:(map.minX+map.maxX)/2,z:(map.minZ+map.maxZ)/2};
  const angle=gauge.mapOrientation==='heading'?heading:Math.PI,c=Math.cos(angle),s=Math.sin(angle);
  // Fixed north preserves the existing map axes. Vehicle right is (-cos(yaw), sin(yaw));
  // using the opposite lateral vector mirrors heading-up roads and markers.
  const relative=p=>gauge.mapOrientation==='heading'?{x:-(p.x-center.x)*c+(p.z-center.z)*s,forward:(p.x-center.x)*s+(p.z-center.z)*c}:{x:p.x-center.x,forward:-(p.z-center.z)};
  const width=map.maxX-map.minX,height=map.maxZ-map.minZ;
  const fitW=gauge.mapOrientation==='heading'?Math.abs(c)*width+Math.abs(s)*height:width,fitH=gauge.mapOrientation==='heading'?Math.abs(s)*width+Math.abs(c)*height:height;
  const scale=local?bounds.w/gauge.mapRangeM:Math.min(Math.max(1,bounds.w-pad*2)/Math.max(1,fitW),Math.max(1,bounds.h-pad*2)/Math.max(1,fitH));
  const range=gauge.mapRangeM||300,pitch=(gauge.mapPitch||45)*Math.PI/180,sp=Math.sin(pitch),cp=Math.cos(pitch),cameraHeight=range*.35,back=range*.4;
  const originDepth=back*cp+cameraHeight*sp,originY=(cameraHeight*cp-back*sp)/originDepth,near=range*.05,focal=scale*originDepth;
  const depth=p=>relative(p).forward*cp+originDepth;
  const visible=p=>!perspective||depth(p)>=near;
  const toScreen=p=>{const q=relative(p);if(!perspective)return {x:bounds.x+bounds.w/2+q.x*scale,y:bounds.y+bounds.h/2-q.forward*scale};
    const d=Math.max(near,depth(p));return {x:bounds.x+bounds.w/2+q.x*focal/d,y:bounds.y+bounds.h*(gauge.mapPlayerY??.75)+((cameraHeight*cp-(q.forward+back)*sp)/d-originY)*focal};};
  const intersection=(a,b)=>{const t=(near-depth(a))/(depth(b)-depth(a));return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};};
  const segment=(a,b)=>{const av=visible(a),bv=visible(b);if(!av&&!bv)return null;return [toScreen(av?a:intersection(a,b)),toScreen(bv?b:intersection(a,b))];};
  const polygon=points=>{if(!perspective)return points.map(toScreen);const clipped=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],av=visible(a),bv=visible(b);if(av)clipped.push(a);if(av!==bv)clipped.push(intersection(a,b));}return clipped.map(toScreen);};
  return {scale,toScreen,visible,segment,polygon};
}

export function drawGaugeMinimap(ctx,bounds,map,gauge,{player,heading=0,cars=[],water=[],lap=null,getArt=()=>null}){
  bounds=gaugeMapScreenBounds(bounds,gauge);
  const {toScreen,visible,segment,polygon}=gaugeMinimapTransform(bounds,map,gauge,player,heading);
  ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.clip();
  if(!gauge.artRef){ctx.fillStyle=gauge.background;ctx.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);}
  ctx.globalAlpha*=gauge.mapOpacity??1;
  for(const region of water){const points=polygon([[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:region.x+x*region.widthM/2,z:region.z+z*region.lengthM/2})));if(points.length<3)continue;ctx.fillStyle='#287fa388';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}
  ctx.lineJoin='round';ctx.lineCap='round';
  for(const path of map.paths){
    if(path.points.length<2)continue;
    ctx.beginPath();const count=path.closed?path.points.length:path.points.length-1;
    for(let i=0;i<count;i++){const line=segment(path.points[i],path.points[(i+1)%path.points.length]);if(!line)continue;ctx.moveTo(line[0].x,line[0].y);ctx.lineTo(line[1].x,line[1].y);}
    ctx.setLineDash(path.structure==='tunnel'?[3,2]:[]);
    if(gauge.mapLineBorderWidth>0){ctx.lineWidth=gauge.mapLineWidth+2*gauge.mapLineBorderWidth;ctx.strokeStyle=gauge.mapLineBorderColor;ctx.stroke();}
    ctx.lineWidth=gauge.mapLineWidth;ctx.strokeStyle=gauge.mapLineColor;ctx.stroke();
  }
  ctx.setLineDash([]);
  const marker=(kind,point)=>{
    if(!visible(point))return;
    const p=toScreen(point),size=Math.max(2,Math.min(bounds.w,bounds.h)*gauge[kind+'MarkerSize']/100),r=size/2;
    if(p.x+r<bounds.x||p.x-r>bounds.x+bounds.w||p.y+r<bounds.y||p.y-r>bounds.y+bounds.h)return;
    const ref=kind==='player'?gauge.markerArtRef:gauge[kind+'MarkerArtRef'],art=ref?getArt(ref):null;
    if(art){const factor=size/Math.max(art.width||1,art.height||1),w=(art.width||1)*factor,h=(art.height||1)*factor;ctx.drawImage(art,p.x-w/2,p.y-h/2,w,h);return;}
    ctx.fillStyle=gauge[kind+'MarkerColor'];ctx.strokeStyle='#050807';ctx.lineWidth=1;ctx.beginPath();
    switch(gauge[kind+'MarkerShape']){
      case 'square':ctx.rect(p.x-r,p.y-r,size,size);break;
      case 'triangle':ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x+r,p.y+r);ctx.lineTo(p.x-r,p.y+r);ctx.closePath();break;
      case 'flag':ctx.moveTo(p.x-r,p.y+r);ctx.lineTo(p.x-r,p.y-r);ctx.lineTo(p.x+r,p.y-r);ctx.lineTo(p.x+r*.5,p.y);ctx.lineTo(p.x-r,p.y);break;
      default:ctx.arc(p.x,p.y,r,0,Math.PI*2);
    }
    ctx.fill();ctx.stroke();
  };
  if(map.start)marker('start',map.start);
  for(const p of map.finishes||(map.finish?[map.finish]:[]))marker('finish',p);
  for(const p of cars)marker('car',p);
  marker('player',player);
  if(lap!==null&&gauge.showValue){ctx.fillStyle=gauge.color;ctx.font=gauge.font||'12px monospace';ctx.textAlign='left';ctx.textBaseline='top';drawGaugeText(ctx,gauge,`L${lap}`,bounds.x+5,bounds.y+4,Math.max(1,bounds.w-10),gauge.fontScale||1);}
  if(gauge.mapBorderWidth>0){const half=gauge.mapBorderWidth/2;ctx.strokeStyle=gauge.mapBorderColor;ctx.lineWidth=gauge.mapBorderWidth;ctx.strokeRect(bounds.x+half,bounds.y+half,Math.max(0,bounds.w-gauge.mapBorderWidth),Math.max(0,bounds.h-gauge.mapBorderWidth));}
  ctx.restore();
}
