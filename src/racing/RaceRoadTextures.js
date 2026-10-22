import { networkEdgeLength } from './RaceRouteNetwork.js';

export function roadTextureSampling(source = {}) {
  return {filterMode:['crisp','balanced','smooth'].includes(source?.filterMode)?source?.filterMode:'inherit',
    mipmapDistance: Math.max(.25, Math.min(16, Number(source?.mipmapDistance) || 1)),
    mipmaps:source?.mipmaps!==false,anisotropy:Math.max(1,Math.min(16,Math.round(Number(source?.anisotropy)||1)))};
}

// Bias the selected mip level rather than texture UVs, preserving repeat dimensions.
export function roadTextureMipBias(source) {
  const settings = roadTextureSampling(source);
  return settings.mipmaps ? -Math.log2(settings.mipmapDistance) : 0;
}

// Ribbon UVs stay centered while repeating along and optionally across the strip.
export function roadTextureSettings(race = {}) {
  const clean = source => ({
    ...roadTextureSampling(source),
    artRef: String(source?.artRef || '').trim(),
    repeatM: Math.max(.1, Math.min(1000, Number(source?.repeatM) || 5)),
    repeatWidthM: Math.max(0, Math.min(1000, Number(source?.repeatWidthM) || 0))
  });
  return { road: clean(race.roadTextures?.road), margin: clean(race.roadTextures?.margin) };
}

// Custom road artwork supplies its own lane paint. Margin-only art does not.
export function showBuiltInRoadMarkings(race = {}) {
  return !roadTextureSettings(race).road.artRef && race.roadTextures?.builtInLines !== false;
}

export function texturedRoadStrip(nearLeft, nearRight, farLeft, farRight, nearDistance, farDistance, settings, source) {
  const width = (left,right) => settings.repeatWidthM > 0 ? Math.hypot(right.x-left.x,right.z-left.z) / settings.repeatWidthM : 1;
  const nearWidth=width(nearLeft,nearRight),farWidth=width(farLeft,farRight);
  const point = (p, u, distance) => ({ ...p, u, v: -distance / settings.repeatM });
  return {
    source, textureOptions:roadTextureSampling(settings), artRef: settings.artRef, textured: true, color: '#ffffff',
    points: [point(farLeft, .5-farWidth/2, farDistance), point(farRight, .5+farWidth/2, farDistance),
      point(nearRight, .5+nearWidth/2, nearDistance), point(nearLeft, .5-nearWidth/2, nearDistance)],
    threeLiftM: source.includes('boundary') ? .035 : .012,
    textureWorldM: settings.repeatM
  };
}

export function buildRoadTextureStrips(worldBake, settings, { marginWidth = .22, marginVisible = true, networkDefinition = null } = {}) {
  const roadMeshes = [], boundaryMeshes = [];
  const paths = worldBake.surfaceBake?.paths || [{ sections: worldBake.surfaceBake?.sections || [] }];
  const network = worldBake.terrainTopology === 'route-network';
  const edgeOffsets = new Map();
  if (network && networkDefinition) {
    const phases = new Map([[networkDefinition.startNodeId || networkDefinition.nodes[0]?.id, 0]]);
    const pending = [...networkDefinition.edges];
    while (pending.length) {
      let index = pending.findIndex(e => phases.has(e.from) || phases.has(e.to));
      if (index < 0) { index = 0; phases.set(pending[0].from, 0); }
      const [edge] = pending.splice(index, 1), length = networkEdgeLength(networkDefinition, edge);
      if (!phases.has(edge.from)) phases.set(edge.from, phases.get(edge.to) - length);
      if (!phases.has(edge.to)) phases.set(edge.to, phases.get(edge.from) + length);
      edgeOffsets.set(edge.id, phases.get(edge.from));
    }
  }
  for (const { sections, edgeId } of paths) {
    const circuit = !network && worldBake.runtimeType === 'circuit';
    const count = circuit ? sections.length : sections.length - 1;
    for (let i = 0; i < count; i++) {
      const a = sections[i], b = sections[(i + 1) % sections.length];
      if (!a?.left || !a?.right || !b?.left || !b?.right) continue;
      const offset = edgeOffsets.get(edgeId) || 0;
      const d0 = offset + Number(a.center.distance || 0);
      const d1 = offset + (i + 1 === sections.length ? Number(worldBake.routeLength) : Number(b.center.distance || 0));
      if (settings.road.artRef) roadMeshes.push(texturedRoadStrip(a.left, a.right, b.left, b.right, d0, d1, settings.road, 'road-texture'));
      if (settings.margin.artRef && marginVisible) {
        const outer = (s, side, sign) => {
          if (!network) return s[side === 'left' ? 'marginLeft' : 'marginRight'] || s[side];
          return { ...s[side], x: s[side].x + Math.cos(s.center.yaw) * sign * marginWidth,
            z: s[side].z - Math.sin(s.center.yaw) * sign * marginWidth };
        };
        boundaryMeshes.push(texturedRoadStrip(outer(a,'left',-1), a.left, outer(b,'left',-1), b.left, d0, d1, settings.margin, 'boundary-texture-left'));
        boundaryMeshes.push(texturedRoadStrip(a.right, outer(a,'right',1), b.right, outer(b,'right',1), d0, d1, settings.margin, 'boundary-texture-right'));
      }
    }
  }
  // Ordinary two-road joins continue the ribbon through the junction apron.
  // Multi-way intersections retain their unmarked base surface.
  if (network && networkDefinition) {
    const byEdge = new Map(paths.map(path => [path.edgeId, path]));
    for (const node of networkDefinition.nodes || []) {
      const edges = networkDefinition.edges.filter(e => e.from === node.id || e.to === node.id);
      if (edges.length !== 2) continue;
      const ends = edges.map(e => {
        const sections = byEdge.get(e.id)?.sections;
        return sections?.length ? (e.from === node.id ? sections[0] : sections.at(-1)) : null;
      });
      if (ends.some(s => !s)) continue;
      const [a, b] = ends;
      const aReverse = edges[0].from === node.id, bReverse = edges[1].to === node.id;
      const orient = (s, reverse) => reverse ? { ...s, left: s.right, right: s.left } : s;
      const near = orient(a, aReverse), far = orient(b, bReverse);
      const d0 = (edgeOffsets.get(edges[0].id) || 0) + Number(a.center.distance || 0);
      const d1 = (edgeOffsets.get(edges[1].id) || 0) + Number(b.center.distance || 0);
      if (settings.road.artRef) roadMeshes.push(texturedRoadStrip(near.left,near.right,far.left,far.right,d0,d1,settings.road,'road-texture'));
      if (settings.margin.artRef && marginVisible) {
        const outer = (s, side) => {
          const p=s[side],dx=p.x-s.center.x,dz=p.z-s.center.z,length=Math.max(.001,Math.hypot(dx,dz));
          return {...p,x:p.x+dx/length*marginWidth,z:p.z+dz/length*marginWidth};
        };
        boundaryMeshes.push(texturedRoadStrip(outer(near,'left'),near.left,outer(far,'left'),far.left,d0,d1,settings.margin,'boundary-texture-left'));
        boundaryMeshes.push(texturedRoadStrip(near.right,outer(near,'right'),far.right,outer(far,'right'),d0,d1,settings.margin,'boundary-texture-right'));
      }
    }
  }
  return { roadMeshes, boundaryMeshes };
}
