import { openEditorForm } from './shared/editorForm.js';
import { RACE_SURFACES } from '../racing/raceData.js';
import { networkFromLegacySamples, normalizeRaceRouteNetwork, addNetworkRoute, splitNetworkRoute,
  createNetworkJunction, joinNetworkJunctions, getNetworkEdgePoints, projectNetworkPoint, moveNetworkJunction } from '../racing/RaceRouteNetwork.js';
import { normalizeRaceWaterRegions } from '../racing/simulation/RaceWater.js';

export const NETWORK_ACTIONS = {
  'network-enable': 'Branching routes', 'network-select': 'Select', 'network-add': 'Connect / extend',
  'network-split': 'Split route', 'network-junction': 'Add junction', 'network-join': 'Join junctions',
  'network-properties': 'Properties', 'network-markers': 'Start / finish', 'network-delete': 'Delete selection',
  'network-water': 'Water level'
};
export function networkEditorActions(editor, compact = false) {
  const ids = compact ? ['network-select', 'network-add', 'network-properties']
    : Object.keys(NETWORK_ACTIONS).filter(id => id !== 'network-enable');
  const actions = ids.map(id => ({ id, label: compact ? ({ 'network-select': 'Select', 'network-add': 'Add', 'network-junction': 'Junction', 'network-properties': 'Edit' }[id]) : NETWORK_ACTIONS[id], active: editor.networkTool === id,
    onClick: () => editor.handleMenuAction(id) }));
  if (compact) actions.push({ id: 'network-menu', label: 'Routes', active: editor.racePortraitHotMenu === 'network',
    onClick: () => {
      if (editor.activeViewportMode === 'portrait') editor.racePortraitHotMenu = editor.racePortraitHotMenu === 'network' ? null : 'network';
      else { editor.selectRootMenu('track'); editor.gamepadSubmenuOpen = editor.activeViewportMode === 'gamepad'; editor.mobileRootOpen = !editor.gamepadSubmenuOpen; }
    } });
  return actions;
}
function commit(editor, network, label) {
  editor.captureRaceHistory(label); editor.selectedRace.road.network = normalizeRaceRouteNetwork(network);
  editor.clearRaceRuntimeSurfaceCaches(); editor.status = label;
}
const choice = (id, label, value, options) => ({ id, label, value, type: 'select', options });
const number = (id, label, value, min = -10000, max = 10000) => ({ id, label, value, type: 'number', min, max, step: 'any' });

export async function handleNetworkAction(editor, action) {
  editor.closeEditorMenus?.();
  editor.racePortraitHotMenu = null;
  if (action === 'network-enable') {
    if (!editor.selectedRace.road.network) commit(editor, networkFromLegacySamples(editor.getRacePathSamples({ step: 4 }), {
      widthM: editor.selectedRace.road.width || 11
    }), 'Enabled branching routes');
    editor.networkTool = 'network-select'; editor.networkNodeId = editor.selectedRace.road.network.startNodeId;
    editor.activeRootId = 'track'; editor.racePortraitMode = 'race'; return;
  }
  const network = editor.selectedRace.road.network;
  if (action === 'network-water') {
    const water = editor.selectedRace.waterRegions?.find(w => w.id === editor.networkWaterId);
    const center = editor.networkLastPoint || { x: 0, z: 0 };
    const result = await openEditorForm('Water level', [
      { id: 'name', label: 'Name', type: 'text', required: false, value: water?.name || 'Water' },
      number('x', 'Center X (m)', water?.x ?? center.x), number('z', 'Center Z (m)', water?.z ?? center.z),
      number('widthM', 'Width (m)', water?.widthM ?? 30, 1), number('lengthM', 'Length (m)', water?.lengthM ?? 30, 1),
      number('levelM', 'Water surface height (m)', water?.levelM ?? 0.2),
      number('bottomM', 'Water bottom height (m)', water?.bottomM ?? -2)
    ]);
    if (!result) return;
    editor.captureRaceHistory('Water level');
    const regions = [...(editor.selectedRace.waterRegions || [])];
    const id = water?.id || `water-${Date.now().toString(36)}`;
    editor.selectedRace.waterRegions = normalizeRaceWaterRegions([...regions.filter(w => w.id !== id), { ...result, id }]);
    editor.networkWaterId = id; editor.clearRaceRuntimeSurfaceCaches(); editor.status = 'Water level saved'; return;
  }
  if (!network) { editor.status = 'Enable branching routes first'; return; }
  if (['network-select', 'network-add', 'network-join', 'network-split'].includes(action)) {
    editor.networkTool = action;
    editor.status = { 'network-add': 'Select a starting junction, then click a junction or empty space to extend.',
      'network-join': 'Select the junction to keep, then click the junction to join.',
      'network-split': 'Click a route to insert a connected junction.', 'network-select': 'Select or drag a junction; click a road for its properties.' }[action]; return;
  }
  if (action === 'network-junction') {
    const result = await openEditorForm('Add junction', [choice('kind', 'Shape', 'y', [
      { value: 'y', label: 'Y split' }, { value: 't', label: 'T junction' }, { value: 'cross', label: 'Four-way intersection' }
    ]), number('heading', 'Direction (degrees)', 0, -360, 360), number('heightM', 'Height (m)', 0), number('lengthM', 'Arm length (m)', 60, 10, 500)]);
    if (result) { editor.networkJunction = result; editor.networkTool = 'network-junction'; editor.status = 'Click the map to place the junction. Connect its arms to your route.'; }
    return;
  }
  if (action === 'network-markers') {
    const options = network.nodes.map(n => ({ value: n.id, label: n.name || n.id }));
    const result = await openEditorForm('Start / finish', [choice('startNodeId', 'Start', network.startNodeId, options), choice('finishNodeId', 'Finish', network.finishNodeId, options)]);
    if (result) {
      if (result.startNodeId === result.finishNodeId) throw new Error('Start and finish must be distinct.');
      commit(editor, { ...network, ...result }, 'Start / finish updated');
    }
    return;
  }
  if (action === 'network-delete') {
    if (editor.networkWaterId) {
      editor.captureRaceHistory('Delete water'); editor.selectedRace.waterRegions = (editor.selectedRace.waterRegions || []).filter(w => w.id !== editor.networkWaterId);
      editor.networkWaterId = ''; editor.clearRaceRuntimeSurfaceCaches(); return;
    }
    if (editor.networkNodeId && [network.startNodeId, network.finishNodeId].includes(editor.networkNodeId)) throw new Error('Move the start / finish marker before deleting its junction.');
    const next = structuredClone(network);
    next.edges = next.edges.filter(e => e.id !== editor.networkEdgeId && e.from !== editor.networkNodeId && e.to !== editor.networkNodeId);
    next.nodes = next.nodes.filter(n => n.id !== editor.networkNodeId);
    commit(editor, next, 'Deleted selection'); editor.networkNodeId = ''; editor.networkEdgeId = ''; return;
  }
  if (action !== 'network-properties') return;
  if (editor.networkWaterId) return handleNetworkAction(editor, 'network-water');
  const node = network.nodes.find(n => n.id === editor.networkNodeId), edge = network.edges.find(e => e.id === editor.networkEdgeId);
  if (node) {
    const result = await openEditorForm('Junction properties', [{ id: 'name', label: 'Name', type: 'text', required: false, value: node.name },
      number('x', 'X (m)', node.x), number('z', 'Z (m)', node.z), number('heightM', 'Height (m)', node.heightM)]);
    if (result) { commit(editor, moveNetworkJunction(network, node.id, result), 'Junction updated'); }
  } else if (edge) {
    const result = await openEditorForm('Route properties', [{ id: 'name', label: 'Name', type: 'text', required: false, value: edge.name },
      choice('structure', 'Structure', edge.structure, ['road', 'bridge', 'tunnel'].map(value => ({ value, label: value }))),
      number('widthM', 'Road width (m)', edge.widthM, 3, 40), number('clearanceM', 'Tunnel clearance (m)', edge.clearanceM, 2, 30),
      choice('surface', 'Surface', edge.surface, RACE_SURFACES.map(s => ({ value: s.id, label: s.label }))),
      choice('bidirectional', 'Direction', edge.bidirectional ? 'both' : 'forward', [{ value: 'both', label: 'Both directions' }, { value: 'forward', label: 'From → To' }])]);
    if (result) { const next = structuredClone(network); Object.assign(next.edges.find(e => e.id === edge.id), result, { bidirectional: result.bidirectional === 'both' }); commit(editor, next, 'Route updated'); }
  } else editor.status = 'Select a junction or road first';
}

export function drawNetworkEditor(editor, ctx, bounds) {
  editor.raceMapBounds = { ...bounds };
  const network = editor.selectedRace.road.network;
  const screen = p => { const result = editor.raceMapWorldToScreenPoint({ x: p.x, y: p.z }, bounds); return { x: result.screenX, y: result.screenY }; };
  const scale = editor.getRaceMapTransform(bounds).scale;
  ctx.save(); ctx.beginPath(); ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h); ctx.clip();
  ctx.fillStyle = '#111916'; ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  editor.drawRaceTopDownTileMap(ctx, bounds);
  for (const water of editor.selectedRace.waterRegions || []) {
    const p = screen({ x: water.x - water.widthM / 2, z: water.z - water.lengthM / 2 });
    ctx.fillStyle = `${water.color}88`; ctx.fillRect(p.x, p.y, water.widthM * scale, water.lengthM * scale);
    ctx.strokeStyle = water.id === editor.networkWaterId ? '#fff' : water.color; ctx.strokeRect(p.x, p.y, water.widthM * scale, water.lengthM * scale);
  }
  for (const edge of network.edges) {
    ctx.strokeStyle = edge.id === editor.networkEdgeId ? '#f2d45c' : edge.structure === 'bridge' ? '#b3b8cd' : edge.structure === 'tunnel' ? '#727a85' : '#738b78';
    ctx.lineWidth = Math.max(3, edge.widthM * scale); ctx.lineCap = 'butt';
    ctx.setLineDash(edge.structure === 'tunnel' ? [8, 4] : []); ctx.beginPath();
    getNetworkEdgePoints(network, edge).forEach((point, i) => { const p = screen(point); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const node of network.nodes) {
    const p = screen(node), selected = editor.networkNodeId === node.id;
    ctx.fillStyle = node.id === network.startNodeId ? '#61e79a' : node.id === network.finishNodeId ? '#ff885d' : selected ? '#f2d45c' : '#d9e6d2';
    ctx.beginPath(); ctx.arc(p.x, p.y, selected ? 7 : 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${node.id === network.startNodeId ? 'START ' : node.id === network.finishNodeId ? 'FINISH ' : ''}${node.name || node.id} · ${node.heightM.toFixed(1)}m`, p.x + 9, p.y - 8);
  }
  editor.drawRaceMapScaleBar(ctx, bounds); ctx.restore();
}

export function networkPointer(editor, payload, phase) {
  const network = editor.selectedRace?.road?.network, bounds = editor.raceMapBounds;
  if (!network || !bounds || editor.playtestSession || editor.mode !== 'race' || editor.racePortraitMode !== 'race') return false;
  if (phase === 'up') { const had = Boolean(editor.networkDrag); editor.networkDrag = null; return had; }
  const inside = payload.x >= bounds.x && payload.x <= bounds.x + bounds.w && payload.y >= bounds.y && payload.y <= bounds.y + bounds.h;
  if (!inside && !editor.networkDrag) return false;
  const raw = editor.screenToRaceMapWorldPoint(payload.x, payload.y), p = { x: raw.x, z: raw.y };
  editor.networkLastPoint = p;
  if (phase === 'move') {
    if (!editor.networkDrag) return false;
    editor.selectedRace.road.network = moveNetworkJunction(editor.networkDrag.source, editor.networkNodeId, p);
    editor.clearRaceRuntimeSurfaceCaches();
    return true;
  }
  const scale = editor.getRaceMapTransform(bounds).scale;
  const node = network.nodes.find(n => Math.hypot(n.x - p.x, n.z - p.z) * scale < 13);
  const tool = editor.networkTool || 'network-select';
  if (tool === 'network-junction') {
    const next = structuredClone(network), id = `junction-${Date.now().toString(36)}`, settings = editor.networkJunction;
    next.nodes.push({ ...p, id, name: '', heightM: Number(settings.heightM) });
    commit(editor, createNetworkJunction(next, { ...settings, nodeId: id, heading: Number(settings.heading) * Math.PI / 180 }).network, 'Added junction');
    editor.networkNodeId = id; editor.networkTool = 'network-select'; return true;
  }
  if (tool === 'network-add' && editor.networkNodeId) {
    if (node?.id === editor.networkNodeId) return true;
    const next = structuredClone(network), targetId = node?.id || `junction-${Date.now().toString(36)}`;
    if (!node) next.nodes.push({ ...p, id: targetId, name: '', heightM: network.nodes.find(n => n.id === editor.networkNodeId)?.heightM || 0 });
    commit(editor, addNetworkRoute(next, { from: editor.networkNodeId, to: targetId }).network, 'Connected route'); editor.networkNodeId = targetId; return true;
  }
  if (tool === 'network-join' && node && editor.networkNodeId && node.id !== editor.networkNodeId) {
    commit(editor, joinNetworkJunctions(network, editor.networkNodeId, node.id), 'Joined junctions'); editor.networkTool = 'network-select'; return true;
  }
  editor.networkWaterId = ''; editor.networkEdgeId = '';
  if (node) {
    editor.networkNodeId = node.id;
    if (tool === 'network-select') { editor.captureRaceHistory('Move junction'); editor.networkDrag = { source: structuredClone(network), transform: editor.getRaceMapTransform(bounds) }; }
    return true;
  }
  editor.networkNodeId = '';
  const projection = projectNetworkPoint(network, p);
  if (projection && projection.distanceToRoute * scale < Math.max(10, projection.edge.widthM * scale / 2)) {
    if (tool === 'network-split') {
      const split = splitNetworkRoute(network, projection.edgeId, projection.distance);
      commit(editor, split.network, 'Split route'); editor.networkNodeId = split.nodeId; editor.networkTool = 'network-select';
    } else editor.networkEdgeId = projection.edgeId;
  } else {
    editor.networkWaterId = (editor.selectedRace.waterRegions || []).find(w => Math.abs(p.x - w.x) <= w.widthM / 2 && Math.abs(p.z - w.z) <= w.lengthM / 2)?.id || '';
  }
  return true;
}
