// Preserve every boundary vertex, including collinear points with different
// heights. The caller refreshes the center after roadside height smoothing.
export function triangulateSplitTerrainTriangle(boundary, sourceTriangle = boundary) {
  if (boundary.length <= 3) return [boundary];
  const center = {
    x: sourceTriangle.reduce((sum,p)=>sum+p.x,0)/sourceTriangle.length,
    z: sourceTriangle.reduce((sum,p)=>sum+p.z,0)/sourceTriangle.length,
    elevation: sourceTriangle.reduce((sum,p)=>sum+p.elevation,0)/sourceTriangle.length,
    terrainFanCorners: sourceTriangle
  };
  return boundary.map((p,i)=>[center,p,boundary[(i+1)%boundary.length]]);
}
