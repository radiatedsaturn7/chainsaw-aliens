import {drawPaceNoteIcon} from './RacePaceNoteIcons.js';
import {sampleRaceRacingLine} from './RaceRacingLine.js';
import {RACE_THREE_ELEVATION_M} from './simulation/RaceSimulationConfig.js';
import * as THREE from '../vendorBridge/three.js';
import {drivingGuideSettings, drivingSpeedAdvice} from './RaceDrivingAssists.js';

// World-space arrows: the WebGL pass uses the road camera and depth buffer.
// The canvas path is only for the legacy renderer, never over a Three scene.
export function buildRaceGuideArrows(editor) {
  const session=editor.playtestSession,state=session?.drivingAssists;
  if(!state?.active||state.wrongWay||!state.plan||!drivingGuideSettings(editor.selectedRace).line)return [];
  const distance=session.projectedDistance??session.distance??0,speed=Math.abs(session.speedMps||0);
  const horizon=Math.min(180,Math.max(65,speed*4)),arrows=[];
  const options={runtimeType:session.routeRuntimeType};
  const point=(d,offset)=>{
    const pose=sampleRaceRacingLine(state.plan,d)||editor.getRaceWorldPoseAtDistance(d,options);
    const right=editor.getRaceRightVector(pose.yaw);
    const x=pose.x+right.x*offset,z=pose.z+right.z*offset;
    const deck=editor.getRaceRoadSurfaceProfileAtDistance(d,options).elevation;
    const baked=editor.getRaceBakedSurfaceAtWorldPoint?.({x,z,supportHeightM:deck*RACE_THREE_ELEVATION_M});
    return {x,z,elevation:(Number.isFinite(baked?.elevation)?baked.elevation:deck)+.06/RACE_THREE_ELEVATION_M};
  };
  for(let d=Math.ceil((distance+8)/8)*8;d<distance+horizon;d+=8){
    if(session.routeRuntimeType!=='circuit'&&d+2>session.routeLength)break;
    const pose=editor.getRaceWorldPoseAtDistance(d,options);
    const width=Math.min(.75,editor.getRaceRoadHalfWidthWorld(pose.segment)*.24);
    arrows.push({points:[point(d,-width),point(d+2,0),point(d,width)],
      color:drivingSpeedAdvice(state.plan,d,speed,state.grip,state.tuning,state.brakeCondition).color});
  }
  return arrows;
}

export function disposeRaceThreeDrivingLine(renderer) {
  if(!renderer?.drivingGuideMesh)return;
  renderer.scene.remove(renderer.drivingGuideMesh);
  renderer.drivingGuideMesh.geometry.dispose();renderer.drivingGuideMesh.material.dispose();
  renderer.drivingGuideMesh=null;
}

export function syncRaceThreeDrivingLine(editor,renderer) {
  const arrows=buildRaceGuideArrows(editor);
  if(!arrows.length){if(renderer.drivingGuideMesh)renderer.drivingGuideMesh.visible=false;return;}
  if(!renderer.drivingGuideMesh){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(32*12*3),3));
    geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(32*12*3),3));
    const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,
      depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    const mesh=new THREE.Mesh(geometry,material);mesh.name='race-driving-guide';
    mesh.frustumCulled=false;mesh.renderOrder=6;renderer.scene.add(mesh);renderer.drivingGuideMesh=mesh;
  }
  const mesh=renderer.drivingGuideMesh,positions=mesh.geometry.getAttribute('position'),colors=mesh.geometry.getAttribute('color');
  let index=0;const color=new THREE.Color();
  for(const arrow of arrows.slice(0,32)){
    color.set(arrow.color);
    for(let leg=0;leg<2;leg++){
      const a=arrow.points[leg],b=arrow.points[leg+1],dx=b.x-a.x,dz=b.z-a.z;
      const scale=.12/Math.max(.001,Math.hypot(dx,dz)),ox=-dz*scale,oz=dx*scale;
      const quad=[{x:a.x+ox,z:a.z+oz,elevation:a.elevation},{x:a.x-ox,z:a.z-oz,elevation:a.elevation},
        {x:b.x+ox,z:b.z+oz,elevation:b.elevation},{x:b.x-ox,z:b.z-oz,elevation:b.elevation}];
      for(const k of [0,1,2,2,1,3]){const p=quad[k];positions.setXYZ(index,p.x,p.elevation*RACE_THREE_ELEVATION_M,p.z);colors.setXYZ(index,color.r,color.g,color.b);index++;}
    }
  }
  mesh.geometry.setDrawRange(0,index);positions.needsUpdate=true;colors.needsUpdate=true;mesh.visible=true;
}

export function drawRaceDrivingLine(editor,ctx,bounds) {
  if(editor.lastRaceRenderStats?.threeTerrainRenderer)return;
  const view=editor.lastRaceRenderCamera;if(!view)return;
  const arrows=buildRaceGuideArrows(editor);
  ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.clip();
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const arrow of arrows.reverse()){
    const points=arrow.points.map(p=>editor.projectRaceWorldPointToCamera(p,view.camera,view.cameraYaw,bounds));
    if(!points.every(p=>p.visible))continue;
    ctx.beginPath();ctx.moveTo(points[0].screenX,points[0].screenY);ctx.lineTo(points[1].screenX,points[1].screenY);ctx.lineTo(points[2].screenX,points[2].screenY);
    ctx.strokeStyle=arrow.color;ctx.lineWidth=Math.max(2,Math.min(7,Math.abs(points[2].screenX-points[0].screenX)*.18));ctx.stroke();
  }
  ctx.restore();
}

// Anchor to the actual car HUD when it supplies time/progress widgets.
export function raceTimingPanelBounds(bounds, layout = null) {
  const widgets = layout?.enabled ? (layout.widgets || []).filter(g => g.enabled !== false
    && ['raceTime', 'lapTime', 'raceProgress', 'lap', 'completion'].includes(g.source)
    && g.x >= .5 && g.y < .35) : [];
  if (widgets.length) {
    const left = Math.min(...widgets.map(g => g.x));
    const top = Math.min(...widgets.map(g => g.y));
    return {x: bounds.x + left * bounds.w, y: bounds.y + top * bounds.h,
      w: (Math.max(...widgets.map(g => g.x + g.width)) - left) * bounds.w,
      h: (Math.max(...widgets.map(g => g.y + g.height)) - top) * bounds.h};
  }
  const w = Math.min(86, Math.max(66, bounds.w * .2));
  return {x: bounds.x + bounds.w - w - 4, y: bounds.y + 4, w, h: 25};
}

export function drawRaceDrivingAssistHud(editor, ctx, bounds, layout = null) {
  const session = editor.playtestSession, state = session?.drivingAssists;
  if (!state?.active) return;
  const settings = drivingGuideSettings(editor.selectedRace);
  const wrong = state.wrongWay;
  const note = settings.notes && settings.icons ? state.note : null;
  // Wrong-way takes precedence, with the same centred presentation as GO.
  if (wrong && Math.floor(Number(session.elapsedMs || 0)/450)%2) return;
  const x=bounds.x+bounds.w/2,y=bounds.y+bounds.h*.2;
  if(wrong){
    ctx.save();ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(x-90,y-20,180,40);
    ctx.fillStyle='#ff6464';ctx.font='900 22px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('WRONG WAY',x,y,168);ctx.restore();return;
  }
  if(!note)return;
  const notes=state.notes?.length?state.notes:[note];
  const panel = raceTimingPanelBounds(bounds, layout);
  const size = panel.h * 2.5, gap = 4;
  const count = notes.length;
  const left = panel.x - gap - count * size - (count - 1) * gap;
  const centerY = panel.y + size / 2;
  const icons=notes.map((call,i)=>drawPaceNoteIcon(ctx,call,left+size/2+i*(size+gap),centerY,size));
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
  const fontSize = Math.max(8, Math.min(16, size * .16));
  ctx.font=`700 ${fontSize}px sans-serif`;
  // The announced distance stays fixed and overlaps the bottom of the first tile.
  if(Number.isFinite(note.announcedDistance)&&note.announcedDistance>0){
    const labelHeight = fontSize + 4;
    ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(left,panel.y+size-labelHeight,size,labelHeight);
    ctx.fillStyle='#ffffff';ctx.fillText(`${note.announcedDistance} m`,left+size/2,panel.y+size-labelHeight/2,size-4);
  }
  ctx.fillStyle='#ffffff';ctx.textBaseline='top';
  const detail=icons.map(icon=>icon.kind==='caution'?icon.text:icon.modifiers.join(' · ')).filter(Boolean).join(' / ');
  if(detail){ctx.textAlign='right';ctx.fillText(detail,panel.x-gap,panel.y+size+3,Math.min(180,panel.x-bounds.x-gap));}
  ctx.restore();
}
