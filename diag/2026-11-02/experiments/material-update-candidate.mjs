// Experimental only: not imported by the game. Callers overwrite every overlay
// field immediately after this function, matching RaceSimulation's contract.
const overlays=new Set(['baseSurfaceId','surfaceId','effectiveGrip',
 'effectiveGripMultiplier','surfaceGripScale','grip','trackStateConditionApplied']);
export function updateMaterialCell(material,cell) {
 // Canonical TrackState cells are plain records. Preserve legacy enumerable
 // inheritance behavior for arbitrary adapters through the original fallback.
 if(cell && Object.getPrototypeOf(cell)!==Object.prototype && Object.getPrototypeOf(cell)!==null){
  for(const key in material)delete material[key];
  for(const key in cell)material[key]=cell[key];
  return material;
 }
 for(const key in material){
  if(overlays.has(key))continue;
  if(cell && Object.prototype.propertyIsEnumerable.call(cell,key))continue;
  delete material[key];
 }
 if(cell)for(const key in cell)material[key]=cell[key];
 return material;
}
export function baselineMaterialCell(material,cell){
 for(const key in material)delete material[key];
 if(cell)for(const key in cell)material[key]=cell[key];
 return material;
}
