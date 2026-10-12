// A textured 3D cylinder projected into the same canvas as the car billboards.
// Axle is X; wheel rotation is around that axle, steering/view bearing around Y.
export function buildWheelCylinder({ width = 20, height = 50, bearing = 0, spin = 0, segments = 24 } = {}) {
  const radius = height / 2, half = width / 2;
  // Positive camera bearing moves toward the car's right. Project the
  // cylinder into that camera basis (camera orbit is inverse model yaw).
  const project = (x,y,z) => ({ x:x*Math.cos(bearing)-z*Math.sin(bearing), y:-y, z:x*Math.sin(bearing)+z*Math.cos(bearing) });
  const ring = (side,i) => {
    const angle = i / segments * Math.PI * 2 + spin;
    return project(side*half, Math.sin(angle)*radius, Math.cos(angle)*radius);
  };
  const triangles = [];
  const add = (surface, points, uv) => triangles.push({ surface, points, uv, depth:points.reduce((n,p)=>n+p.z,0)/3 });
  for (let i=0;i<segments;i++) {
    const a=ring(-1,i),b=ring(1,i),c=ring(1,i+1),d=ring(-1,i+1);
    if (Math.cos((i+0.5)/segments*Math.PI*2+spin)*Math.cos(bearing) > 1e-8) {
    add('tread',[a,b,c],[[0,i/segments],[1,i/segments],[1,(i+1)/segments]]);
    add('tread',[a,c,d],[[0,i/segments],[1,(i+1)/segments],[0,(i+1)/segments]]);
    }
    for(const side of [-1,1]) {
      if (side*Math.sin(bearing) <= 1e-8) continue;
      const uv = n => [0.5-Math.cos(n/segments*Math.PI*2)*0.5,0.5-Math.sin(n/segments*Math.PI*2)*0.5];
      add('wheel',[project(side*half,0,0),ring(side,i),ring(side,i+1)],[[0.5,0.5],uv(i),uv(i+1)]);
    }
  }
  return triangles.sort((a,b)=>a.depth-b.depth);
}

export function drawWheelCylinder(ctx, { tread, wheel, treadBounds, wheelBounds, ...geometry }) {
  if (!tread || !wheel) return false;
  const previous = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
  for (const triangle of buildWheelCylinder(geometry)) {
    const texture = triangle.surface === 'tread' ? tread : wheel;
    const bounds = (triangle.surface === 'tread' ? treadBounds : wheelBounds) || { x:0,y:0,width:texture.width,height:texture.height };
    const [a,b,c]=triangle.points;
    const [u,v,w]=triangle.uv.map(([x,y])=>({x:bounds.x+x*bounds.width,y:bounds.y+y*bounds.height}));
    const det=(v.x-u.x)*(w.y-u.y)-(w.x-u.x)*(v.y-u.y);
    if(Math.abs(det)<1e-8 || Math.abs((b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y))<1e-6) continue;
    const m11=((b.x-a.x)*(w.y-u.y)-(c.x-a.x)*(v.y-u.y))/det;
    const m21=((c.x-a.x)*(v.x-u.x)-(b.x-a.x)*(w.x-u.x))/det;
    const m12=((b.y-a.y)*(w.y-u.y)-(c.y-a.y)*(v.y-u.y))/det;
    const m22=((c.y-a.y)*(v.x-u.x)-(b.y-a.y)*(w.x-u.x))/det;
    ctx.save(); ctx.beginPath(); ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.clip();
    ctx.fillStyle='#111';ctx.fill();
    ctx.transform(m11,m12,m21,m22,a.x-m11*u.x-m21*u.y,a.y-m12*u.x-m22*u.y);
    ctx.drawImage(texture,0,0);ctx.restore();
  }
  ctx.imageSmoothingEnabled = previous;
  return true;
}
