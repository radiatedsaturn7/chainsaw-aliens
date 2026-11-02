// Six connected fence paths surrounding both the route and its starting grid.
export function getStressPerimeter(nodes, grid, clearance = 130) {
  const points = [
    ...nodes.map(node => ({x: node.x, z: node.y})),
    ...grid.map(car => ({x: car.worldX, z: car.worldZ}))
  ];
  if (!points.length || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z))) {
    throw new Error('Stress perimeter requires finite road and starting-grid positions');
  }
  const x0 = Math.min(...points.map(p => p.x)) - clearance;
  const x1 = Math.max(...points.map(p => p.x)) + clearance;
  const z0 = Math.min(...points.map(p => p.z)) - clearance;
  const z1 = Math.max(...points.map(p => p.z)) + clearance;
  const xm = (x0 + x1) / 2;
  return [{x:x0,z:z0},{x:xm,z:z0},{x:x1,z:z0},{x:x1,z:z1},
    {x:xm,z:z1},{x:x0,z:z1},{x:x0,z:z0}];
}
