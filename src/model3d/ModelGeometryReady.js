const usableGeometry=new WeakMap();

// Called with validated native model documents (not raw project envelopes).
// A vertex-only file or collinear polygon is not a renderable asset.
export function hasRenderableModelGeometry(model){
 if(!model||typeof model!=='object'||!Array.isArray(model.vertices)||!Array.isArray(model.faces))return false;
 if(usableGeometry.has(model))return usableGeometry.get(model);
 const vertices=new Map(model.vertices.map(vertex=>[vertex.id,vertex.position]));
 const found=model.faces.some(face=>{
  const points=face.vertices.map(id=>vertices.get(id));
  if(points.length<3||points.some(point=>!point))return false;
  const [a,b,...rest]=points,x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2];
  return rest.some(c=>{
   const u=c[0]-a[0],v=c[1]-a[1],w=c[2]-a[2];
   return Math.hypot(y*w-z*v,z*u-x*w,x*v-y*u)>1e-8;
  });
 });
 usableGeometry.set(model,found);return found;
}
