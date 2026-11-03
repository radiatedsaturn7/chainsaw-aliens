// Steering rotates the wheel in the car's frame; camera bearing is the
// inverse view rotation. Never add steering to the camera's orbit angle.
export function getWheelCameraBearing(cameraBearing = 0, steeringAngle = 0) {
  return Number(cameraBearing || 0) - Number(steeringAngle || 0);
}

// The default builder returns independent geometry. Only synchronous painters
// opt into borrowing scratch records, so retained geometry never changes later.
export function createWheelCylinderScratch() {
  return {records:[],triangles:[],corners:Array.from({length:4},()=>({x:0,y:0,z:0})),center:{x:0,y:0,z:0},busy:false};
}
function writeTriangle(scratch,index,surface,a,b,c,ux,uy,vx,vy,wx,wy) {
  let triangle=scratch.records[index];
  if(!triangle){
    triangle={surface:'',points:Array.from({length:3},()=>({x:0,y:0,z:0})),uv:[[0,0],[0,0],[0,0]],depth:0};
    scratch.records[index]=triangle;
  }
  triangle.surface=surface;
  const points=triangle.points;
  points[0].x=a.x;points[0].y=a.y;points[0].z=a.z;
  points[1].x=b.x;points[1].y=b.y;points[1].z=b.z;
  points[2].x=c.x;points[2].y=c.y;points[2].z=c.z;
  const uv=triangle.uv;
  uv[0][0]=ux;uv[0][1]=uy;uv[1][0]=vx;uv[1][1]=vy;uv[2][0]=wx;uv[2][1]=wy;
  triangle.depth=(0+a.z+b.z+c.z)/3;
  scratch.triangles[index]=triangle;
}
const depthOrder=(a,b)=>a.depth-b.depth;
// Axle is X; spin is around that axle, steering/view bearing around Y.
export function buildWheelCylinder({ width = 20, height = 50, bearing = 0, spin = 0, segments = 24 } = {}, scratch = null) {
  scratch ||= createWheelCylinderScratch();
  const radius=height/2,half=width/2,sin=Math.sin(bearing),cos=Math.cos(bearing);
  const project=(target,x,y,z)=>{target.x=x*cos-z*sin;target.y=-y;target.z=x*sin+z*cos;};
  const ring=(target,side,i)=>{
    const angle=i/segments*Math.PI*2+spin;
    project(target,side*half,Math.sin(angle)*radius,Math.cos(angle)*radius);
  };
  const [a,b,c,d]=scratch.corners;
  let count=0;
  for(let i=0;i<segments;i++){
    ring(a,-1,i);ring(b,1,i);ring(c,1,i+1);ring(d,-1,i+1);
    if(Math.cos((i+.5)/segments*Math.PI*2+spin)*cos>1e-8){
      writeTriangle(scratch,count++,'tread',a,b,c,0,i/segments,1,i/segments,1,(i+1)/segments);
      writeTriangle(scratch,count++,'tread',a,c,d,0,i/segments,1,(i+1)/segments,0,(i+1)/segments);
    }
    for(let side=-1;side<=1;side+=2){
      if(side*sin<=1e-8)continue;
      project(scratch.center,side*half,0,0);
      writeTriangle(scratch,count++,'wheel',scratch.center,side<0?a:b,side<0?d:c,
        .5,.5,.5-Math.cos(i/segments*Math.PI*2)*.5,.5-Math.sin(i/segments*Math.PI*2)*.5,
        .5-Math.cos((i+1)/segments*Math.PI*2)*.5,.5-Math.sin((i+1)/segments*Math.PI*2)*.5);
    }
  }
  scratch.triangles.length=count;
  return scratch.triangles.sort(depthOrder);
}
const painterScratch=new WeakMap();

export function drawWheelCylinder(ctx, { tread, wheel, treadBounds, wheelBounds, ...geometry }) {
  if (!tread || !wheel) return false;
  if(ctx.__raceBoundsRecorder===true && ctx.__raceEmissive!==true){
    const width=geometry.width ?? 20,height=geometry.height ?? 50,bearing=geometry.bearing ?? 0;
    const halfWidth=Math.abs(Math.cos(bearing)*width/2)+Math.abs(Math.sin(bearing)*height/2);
    return ctx.__raceDrawBounded({x:-halfWidth,y:-height/2,width:halfWidth*2,height},
      raw=>drawWheelCylinder(raw,{tread,wheel,treadBounds,wheelBounds,...geometry}));
  }
  let scratch=painterScratch.get(ctx);
  if(!scratch){scratch=createWheelCylinderScratch();painterScratch.set(ctx,scratch);}
  // A custom Canvas wrapper can re-enter drawing; don't overwrite its caller.
  if(scratch.busy)scratch=createWheelCylinderScratch();
  scratch.busy=true;
  const previous = ctx.imageSmoothingEnabled;
  try {
    ctx.imageSmoothingEnabled = false;
    const treadArea = treadBounds || { x:0,y:0,width:tread.width,height:tread.height };
    const wheelArea = wheelBounds || { x:0,y:0,width:wheel.width,height:wheel.height };
    for (const triangle of buildWheelCylinder(geometry,scratch)) {
      const texture = triangle.surface === 'tread' ? tread : wheel;
      const bounds = triangle.surface === 'tread' ? treadArea : wheelArea;
      const [a,b,c]=triangle.points;
      // Canvas consumes these immediately; no per-triangle UV array/objects.
      const uv=triangle.uv;
      const ux=bounds.x+uv[0][0]*bounds.width,uy=bounds.y+uv[0][1]*bounds.height;
      const vx=bounds.x+uv[1][0]*bounds.width,vy=bounds.y+uv[1][1]*bounds.height;
      const wx=bounds.x+uv[2][0]*bounds.width,wy=bounds.y+uv[2][1]*bounds.height;
      const det=(vx-ux)*(wy-uy)-(wx-ux)*(vy-uy);
      if(Math.abs(det)<1e-8 || Math.abs((b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y))<1e-6) continue;
      const m11=((b.x-a.x)*(wy-uy)-(c.x-a.x)*(vy-uy))/det;
      const m21=((c.x-a.x)*(vx-ux)-(b.x-a.x)*(wx-ux))/det;
      const m12=((b.y-a.y)*(wy-uy)-(c.y-a.y)*(vy-uy))/det;
      const m22=((c.y-a.y)*(vx-ux)-(b.y-a.y)*(wx-ux))/det;
      ctx.save(); ctx.beginPath(); ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.clip();
      ctx.fillStyle='#111';ctx.fill();
      ctx.transform(m11,m12,m21,m22,a.x-m11*ux-m21*uy,a.y-m12*ux-m22*uy);
      ctx.drawImage(texture,0,0);ctx.restore();
    }
    return true;
  } finally {
    ctx.imageSmoothingEnabled = previous;
    scratch.busy=false;
    // Don't retain unusually large editor meshes on a long-lived context.
    if(scratch.records.length>512 && painterScratch.get(ctx)===scratch)painterScratch.delete(ctx);
  }
}
