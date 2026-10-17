import * as THREE from '../vendorBridge/three.js';

const colors=['#ff5959','#65df78','#559dff'];
const segmentHit=(p,a,b)=>{const x=b.x-a.x,y=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1)));return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y)};

export function makeModelGizmo(renderer,center,mode='move') {
  const origin=renderer.project(center);
  if(!origin||origin.z>1||origin.z< -1)return null;
  const nearby=renderer.unprojectToPlane(origin.x+76,origin.y,center);
  const radius=Math.hypot(...nearby.map((n,i)=>n-center[i]));
  if(!(radius>0))return null;
  const handles=[];
  for(let axis=0;axis<3;axis++){
    const end=[...center];end[axis]+=radius;
    if(mode==='rotate'){
      const points=Array.from({length:65},(_,i)=>{const p=[...center],a=i*Math.PI/32;p[(axis+1)%3]+=Math.cos(a)*radius;p[(axis+2)%3]+=Math.sin(a)*radius;return renderer.project(p)});
      if(points.every(Boolean))handles.push({axis,points});
    }else{
      const point=renderer.project(end);
      if(point&&Math.hypot(point.x-origin.x,point.y-origin.y)>12)handles.push({axis,points:[origin,point]});
    }
  }
  return {center,origin,radius,mode,handles};
}

export function drawModelGizmo(ctx,gizmo,activeAxis=null) {
  if(!gizmo)return;
  ctx.save();ctx.lineWidth=3;ctx.font='bold 12px system-ui';
  for(const {axis,points} of gizmo.handles){
    ctx.strokeStyle=ctx.fillStyle=activeAxis===axis?'#fff49b':colors[axis];
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
    const end=points[gizmo.mode==='rotate'?8:points.length-1];
    if(gizmo.mode==='scale')ctx.fillRect(end.x-6,end.y-6,12,12);
    else if(gizmo.mode==='move'){
      const a=Math.atan2(end.y-gizmo.origin.y,end.x-gizmo.origin.x);
      ctx.beginPath();ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-13*Math.cos(a-0.45),end.y-13*Math.sin(a-0.45));ctx.lineTo(end.x-13*Math.cos(a+0.45),end.y-13*Math.sin(a+0.45));ctx.closePath();ctx.fill();
    }
    ctx.fillText('XYZ'[axis],end.x+9,end.y-9);
  }
  if(gizmo.mode!=='rotate'){ctx.fillStyle='#ffffff';ctx.fillRect(gizmo.origin.x-5,gizmo.origin.y-5,10,10);}
  ctx.restore();
}

export function pickModelGizmo(gizmo,p) {
  if(!gizmo)return null;
  if(gizmo.mode!=='rotate'&&Math.hypot(p.x-gizmo.origin.x,p.y-gizmo.origin.y)<10)return {axis:null};
  let hit=null,best=12;
  for(const handle of gizmo.handles)for(let i=1;i<handle.points.length;i++){
    const a=handle.points[i-1],b=handle.points[i],distance=segmentHit(p,a,b);
    if(distance<best){best=distance;hit={axis:handle.axis,tangent:{x:b.x-a.x,y:b.y-a.y},angleStep:Math.PI/32};}
  }
  return hit;
}

export function gizmoDragTransform(renderer,gizmo,hit,start,end) {
  const dx=end.x-start.x,dy=end.y-start.y;
  if(gizmo.mode==='move'){
    if(hit.axis===null){const a=renderer.unprojectToPlane(start.x,start.y,gizmo.center),b=renderer.unprojectToPlane(end.x,end.y,gizmo.center);return {delta:b.map((n,i)=>n-a[i])};}
    const point=gizmo.handles.find(h=>h.axis===hit.axis).points[1],x=point.x-gizmo.origin.x,y=point.y-gizmo.origin.y;
    const delta=[0,0,0];delta[hit.axis]=(dx*x+dy*y)/(x*x+y*y)*gizmo.radius;return {delta};
  }
  if(gizmo.mode==='rotate'){
    const normal=new THREE.Vector3().setComponent(hit.axis,1),direction=new THREE.Vector3();
    renderer.camera?.getWorldDirection(direction);
    if(renderer.camera&&Math.abs(normal.dot(direction))>0.12){
      const origin=new THREE.Vector3(...gizmo.center),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,origin);
      const intersect=p=>{const b=renderer.bounds,ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((p.x-b.x)/b.w*2-1,1-(p.y-b.y)/b.h*2),renderer.camera);const point=ray.ray.intersectPlane(plane,new THREE.Vector3());return point?.sub(origin).normalize();};
      const a=intersect(start),b=intersect(end);
      if(a&&b)return {angle:Math.atan2(normal.dot(a.clone().cross(b)),a.dot(b))};
    }
    const {x,y}=hit.tangent;return {angle:(dx*x+dy*y)/(x*x+y*y||1)*hit.angleStep};
  }
  let amount=(dx-dy)/100;
  if(hit.axis!==null){const point=gizmo.handles.find(h=>h.axis===hit.axis).points[1],x=point.x-gizmo.origin.x,y=point.y-gizmo.origin.y;amount=(dx*x+dy*y)/(x*x+y*y);}
  return {factor:Math.exp(Math.max(-5,Math.min(5,amount)))};
}

export function transformGizmoVertices(vertices,center,axis,{angle,factor}) {
  const direction=new THREE.Vector3();if(axis!==null)direction.setComponent(axis,1);
  const rotation=angle===undefined?null:new THREE.Quaternion().setFromAxisAngle(direction,angle);
  for(const vertex of vertices){const point=new THREE.Vector3(...vertex.position).sub(new THREE.Vector3(...center));
    if(rotation)point.applyQuaternion(rotation);
    else if(axis===null)point.multiplyScalar(factor);
    else point.setComponent(axis,point.getComponent(axis)*factor);
    vertex.position=point.add(new THREE.Vector3(...center)).toArray();
  }
}
