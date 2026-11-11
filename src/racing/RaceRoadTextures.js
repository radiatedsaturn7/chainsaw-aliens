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
    enabled: source?.enabled !== false,
    artRef: String(source?.artRef || '').trim(),
    roughArtRef: String(source?.roughArtRef || '').trim(),
    repeatM: Math.max(.1, Math.min(1000, Number(source?.repeatM) || 5)),
    repeatWidthM: Math.max(0, Math.min(1000, Number(source?.repeatWidthM) || 0))
  });
  const map = value => Object.fromEntries(Object.entries(value || {}).map(([key,entry]) => [key,clean(entry)]));
  return { road: clean(race.roadTextures?.road), margin: clean(race.roadTextures?.margin),
    shoulder: clean(race.roadTextures?.shoulder), surfaceRoads:map(race.roadTextures?.surfaceRoads), surfaceShoulders:map(race.roadTextures?.surfaceShoulders) };
}

// A section override wins over its surface mapping, then the race default.
// An explicit disabled entry must not fall through to the default shoulder.
export function shoulderTextureForSegment(settings = {}, segment = {}) {
  return segment?.shoulderTexture || settings?.surfaceShoulders?.[segment?.surface] || settings?.shoulder || {};
}

// Custom road artwork supplies its own lane paint. Margin-only art does not.
export function showBuiltInRoadMarkings(race = {}) {
  return !roadTextureSettings(race).road.artRef && race.roadTextures?.builtInLines !== false;
}

export function texturedRoadStrip(nearLeft, nearRight, farLeft, farRight, nearDistance, farDistance, settings, source) {
  const width = (left,right) => settings.repeatWidthM > 0 ? Math.hypot(right.x-left.x,right.z-left.z) / settings.repeatWidthM : 1;
  const nearWidth=width(nearLeft,nearRight),farWidth=width(farLeft,farRight);
  const repeatM = Math.max(.1, Math.min(1000, Number(settings.repeatM) || 5));
  const point = (p, u, distance) => ({ ...p, u, v: -distance / repeatM });
  return {
    source, textureOptions:roadTextureSampling(settings), artRef: settings.artRef, textured: true, color: '#ffffff',
    points: [point(farLeft, .5-farWidth/2, farDistance), point(farRight, .5+farWidth/2, farDistance),
      point(nearRight, .5+nearWidth/2, nearDistance), point(nearLeft, .5-nearWidth/2, nearDistance)],
    depthOffset: source.includes('shoulder') ? -.091 : source.includes('boundary') ? -.09 : -.08,
    threeLiftM: source.includes('boundary') ? .035 : .012,
    textureWorldM: repeatM
  };
}

export function buildRoadTextureStrips(worldBake, settings, { marginWidth = .22, marginVisible = true, shoulderVisible = true, networkDefinition = null } = {}) {
  const roadMeshes = [], boundaryMeshes = [], junctionMeshes = [], shoulderMeshes = [];
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
      const segment=a.center.segment || {};
      const road=roadTextureForSegment(settings,segment);
      if (road.artRef) roadMeshes.push(texturedRoadStrip(a.left, a.right, b.left, b.right, d0, d1, road, 'road-texture'));
      const shoulder=shoulderTextureForSegment(settings,segment);
      if(shoulderVisible && shoulder.enabled !== false && shoulder?.artRef && a.shoulderLeft && b.shoulderLeft){
        // The texture's road-facing edge is U=0 on both sides.
        shoulderMeshes.push(texturedRoadStrip(a.marginLeft||a.left,a.shoulderLeft,b.marginLeft||b.left,b.shoulderLeft,d0,d1,shoulder,'shoulder-texture-left'));
        shoulderMeshes.push(texturedRoadStrip(a.marginRight||a.right,a.shoulderRight,b.marginRight||b.right,b.shoulderRight,d0,d1,shoulder,'shoulder-texture-right'));
      }
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
  // Cross-fade across real surface changes without moving the drivable ribbon.
  for (const layer of ['road', 'shoulder']) {
    if (layer === 'shoulder' && !shoulderVisible) continue;
    const textureFor = layer === 'road' ? roadTextureForSegment : shoulderTextureForSegment;
    const output = layer === 'road' ? roadMeshes : shoulderMeshes;
    const sides = layer === 'road' ? [['left', 'right']] : [['marginLeft', 'shoulderLeft'], ['marginRight', 'shoulderRight']];
    for(const {sections,edgeId} of paths){
      const offset=edgeOffsets.get(edgeId)||0;
      for(let j=1;j<sections.length-1;j++){
        const previous=textureFor(settings,sections[j-1].center.segment||{}),next=textureFor(settings,sections[j].center.segment||{});
        if(previous.enabled===false||next.enabled===false||!previous.artRef||!next.artRef||previous.artRef===next.artRef)continue;
        const boundary=offset+Number(sections[j].center.distance||0);
        let before=j-1,after=j+1;
        while(before>0&&textureFor(settings,sections[before-1].center.segment||{}).artRef===previous.artRef)before--;
        while(after<sections.length-1&&textureFor(settings,sections[after].center.segment||{}).artRef===next.artRef)after++;
        const band=Math.min(8,(boundary-offset-Number(sections[before].center.distance||0))/2,(offset+Number(sections[after].center.distance||0)-boundary)/2);
        if(band<=0)continue;
        for(let i=before;i<after;i++){
          const a=sections[i],b=sections[i+1],d0=offset+Number(a.center.distance||0),d1=offset+Number(b.center.distance||0);
          const lo=Math.max(d0,boundary-band),hi=Math.min(d1,boundary+band);if(hi<=lo||d1<=d0)continue;
          const current=textureFor(settings,a.center.segment||{}),other=i<j?next:previous;
          if(current.artRef!==(i<j?previous:next).artRef)continue;
          const point=(side,d)=>{const t=(d-d0)/(d1-d0),p=a[side],q=b[side];return {...p,x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t,elevation:Number(p.elevation||0)+(Number(q.elevation||0)-Number(p.elevation||0))*t};};
          const steps=Math.max(1,Math.ceil(hi-lo));
          for(let step=0;step<steps;step++){
            const start=lo+(hi-lo)*step/steps,end=lo+(hi-lo)*(step+1)/steps;
            for (const [left, right] of sides) {
              if (!a[left] || !b[left] || !a[right] || !b[right]) continue;
              const mesh=texturedRoadStrip(point(left,start),point(right,start),point(left,end),point(right,end),start,end,other,layer+'-texture-blend');
              const alpha=d=>{const t=Math.max(0,1-Math.abs(d-boundary)/band);return .5*t*t*(3-2*t);};
              mesh.points.forEach((p,k)=>p.alpha=alpha(k<2?end:start));
              Object.assign(mesh,{vertexAlpha:true,fallbackOpacity:(alpha(start)+alpha(end))/2,threeLiftM:.014,depthOffset:layer === 'road' ? -.080005 : -.091005});output.push(mesh);
            }
          }
        }
      }
    }
  }
  // Ordinary two-road joins continue the ribbon through the junction apron.
  // Multi-way intersections receive textured canonical apron triangles below.
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
  if(network && networkDefinition && settings.road.artRef){
    const byEdge=new Map(paths.map(path=>[path.edgeId,path]));
    const junctionFrames=new Map();
    for(const node of networkDefinition.nodes||[]){
      const ends=networkDefinition.edges.filter(e=>e.from===node.id||e.to===node.id).map(edge=>{
        const sections=byEdge.get(edge.id)?.sections;
        const section=edge.from===node.id?sections?.[0]:sections?.at(-1);
        return section?{edge,section,distance:(edgeOffsets.get(edge.id)||0)+Number(section.center.distance||0)}:null;
      }).filter(Boolean);
      if(ends.length<2)continue;
      const mouthPoints=ends.flatMap(({section:s,distance})=>{
        const span=settings.road.repeatWidthM>0?Math.hypot(s.right.x-s.left.x,s.right.z-s.left.z)/settings.road.repeatWidthM:1;
        return [{...s.left,u:.5-span/2,v:-distance/settings.road.repeatM},{...s.right,u:.5+span/2,v:-distance/settings.road.repeatM}];
      });
      const {section:s,distance}=ends[0],dx=node.x-s.center.x,dz=node.z-s.center.z;
      const centerV=-(distance+dx*Math.sin(s.center.yaw)+dz*Math.cos(s.center.yaw))/settings.road.repeatM;
      junctionFrames.set(`junction:${node.id}`,{mouthPoints,centerV,node});
    }
    for(const triangle of worldBake.mesh?.triangles||[]){
      const frame=junctionFrames.get(triangle.source);if(!frame)continue;
      const points=triangle.vertices.map(p=>{
        if(Math.hypot(p.x-frame.node.x,p.z-frame.node.z)<1e-6)return {...p,u:.5,v:frame.centerV};
        // Hull vertices are road mouth corners. Reuse their ribbon UVs exactly,
        // including repeat width and distance phase, on both sides of each seam.
        const match=frame.mouthPoints.reduce((best,q)=>Math.hypot(q.x-p.x,q.z-p.z)<Math.hypot(best.x-p.x,best.z-p.z)?q:best);
        return {...p,u:match.u,v:match.v};
      });
      junctionMeshes.push({source:'road-texture-junction',junctionSource:triangle.source,points,
        artRef:settings.road.artRef,textured:true,color:'#ffffff',textureOptions:roadTextureSampling(settings.road),
        textureWorldM:settings.road.repeatM,threeLiftM:0});
    }
  }
  return { roadMeshes, boundaryMeshes, junctionMeshes, shoulderMeshes };
}

export function roadTextureForSegment(settings,segment={}) {
 const base=settings.surfaceRoads?.[segment.surface] || settings.road;
 return base.roughArtRef && Number(segment.bumpiness)>=.35 ? {...base,artRef:base.roughArtRef} : base;
}
