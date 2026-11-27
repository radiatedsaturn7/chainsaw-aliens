export function auditVehicleGeometry(design){
 const groups={};
 const measure=(parts,wheels=false)=>{
  for(const p of parts){
   const {geometry:g,material,component}=p,role=g.userData?.constructionRole??(wheels?material==='rotor'?'brake rotor':material==='caliper'?'brake caliper':component:component);
   const group=groups[(wheels?'Wheel template / ':'Body / ')+role+' / '+material]??={triangles:0,vertices:0,instances:wheels?4:1,meshes:0,degenerate:0};
   const pos=g.attributes.position,ind=g.index,n=ind?.count??pos.count;
   group.triangles+=n/3;group.vertices+=pos.count;group.meshes++;
   const A=[0,0,0],B=[0,0,0],C=[0,0,0];
   for(let j=0;j<n;j+=3){
    for(let k=0;k<3;k++){
     const i=ind?ind.getX(j+k):j+k,target=[A,B,C][k];
     target[0]=pos.getX(i);target[1]=pos.getY(i);target[2]=pos.getZ(i);
    }
    const ux=B[0]-A[0],uy=B[1]-A[1],uz=B[2]-A[2],vx=C[0]-A[0],vy=C[1]-A[1],vz=C[2]-A[2];
    if(Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)<1e-10)group.degenerate++;
   }
  }
 };
 measure(design.parts);measure(design.wheelParts,true);
 const fields=['triangles','vertices','degenerate'];
 const totals=Object.fromEntries(fields.map(k=>[k,Object.values(groups).reduce((s,g)=>s+g[k]*g.instances,0)]));
 return {groups,totals};
}
