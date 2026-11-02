// Select by world-space distance, not route progress or camera visibility.
// Stable ties retain the previous selection; the budget never grows in a pack.
export function assignRaceAiPhysicsBudget(session, {worker = false} = {}) {
 const cars=session.aiRuntime || [];
 const playerY=Number(session.vehicleDynamicsRunner?.state?.position?.y??session.bodyY);
 const ranked=cars.map((ai,index)=>({ai,index,distance:Math.hypot(
   Number(ai.worldX)-Number(session.worldX),Number(ai.worldZ)-Number(session.worldZ),
   Number.isFinite(playerY)&&Number.isFinite(Number(ai.vehicleDynamicsRunner?.state?.position?.y??ai.bodyY))
     ? Number(ai.vehicleDynamicsRunner?.state?.position?.y??ai.bodyY)-playerY : 0)}));
 ranked.sort((a,b)=>(Number.isFinite(a.distance)?a.distance:Infinity)
   -(Number.isFinite(b.distance)?b.distance:Infinity)
   || Number(b.ai.physicsBudgetDetail==='full')-Number(a.ai.physicsBudgetDetail==='full') || a.index-b.index);
 const selected=new Set(ranked.slice(0,3).map(entry=>entry.ai));
 for(const ai of cars)ai.physicsBudgetDetail=worker ? null : selected.has(ai)?'full':'cheap';
 session.aiDetailedPhysicsCount=worker?cars.length:selected.size;
 session.aiCheapPhysicsCount=worker?0:Math.max(0,cars.length-selected.size);
}
