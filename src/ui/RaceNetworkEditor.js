import { getNetworkFinishNodes, normalizeNodeFinish } from '../racing/RaceFinishNodes.js';
import { parseMenuVariableAssignments, formatMenuVariableAssignments } from '../menus/MenuProgress.js';
import { listProjectFiles } from './projectFiles.js';
import {transformNetworkSelection,networkSelectionInBox} from '../racing/RaceNetworkSelection.js';
import {setNetworkNodeType} from '../racing/RaceJunctionAuthoring.js';
import { openEditorForm } from './shared/editorForm.js';
import { RACE_SURFACES } from '../racing/raceData.js';
import { networkFromLegacySamples, normalizeRaceRouteNetwork, addNetworkRoute, splitNetworkRoute,
  createNetworkJunction, joinNetworkJunctions, getNetworkEdgePoints, projectNetworkPoint, moveNetworkJunction } from '../racing/RaceRouteNetwork.js';
import { normalizeRaceWaterRegions } from '../racing/simulation/RaceWater.js';

export const NETWORK_ACTIONS = {
  'network-multi': 'Multi-select', 'network-transform':'Transform selection', 'network-all':'Select all', 'network-clear':'Clear selection', 'network-connect': 'Connect selected nodes',
  'network-enable': 'Branching routes', 'network-select': 'Select', 'network-add': 'Connect / extend',
  'network-split': 'Split route', 'network-junction': 'Add junction', 'network-join': 'Join junctions',
  'network-properties': 'Properties', 'network-markers': 'Start / finish', 'network-delete': 'Delete selection',
  'network-water': 'Water level'
};
export function networkEditorActions(editor, compact = false) {
  if(compact){
    const drawer=(id,label,menu)=>({id,label,active:editor.racePortraitHotMenu===menu,onClick:()=>{
      if(editor.activeViewportMode==='portrait')editor.racePortraitHotMenu=editor.racePortraitHotMenu===menu?null:menu;
      else {editor.selectRootMenu(menu==='ground-mode'?'ground':'track');editor.gamepadSubmenuOpen=editor.activeViewportMode==='gamepad';editor.mobileRootOpen=!editor.gamepadSubmenuOpen;}
    }});
    return [drawer('race-ground-mode','Track','ground-mode'),drawer('network-menu','Add','network'),
      {id:'network-properties',label:'Edit',onClick:()=>editor.handleMenuAction('network-properties')},
      {id:'network-multi',label:editor.networkMultiSelect?'Done':'Multi',active:editor.networkMultiSelect,onClick:()=>editor.handleMenuAction('network-multi')}];
  }
  const actions=Object.keys(NETWORK_ACTIONS).filter(id=>id!=='network-enable').map(id=>({
    id,label:NETWORK_ACTIONS[id],active:editor.networkTool===id,onClick:()=>editor.handleMenuAction(id)
  }));
  return actions;
}
function commit(editor, network, label) {
  editor.captureRaceHistory(label); editor.selectedRace.road.network = normalizeRaceRouteNetwork(network);
  editor.clearRaceRuntimeSurfaceCaches(); editor.status = label;
}
const choice = (id, label, value, options) => ({ id, label, value, type: 'select', options });
const number = (id, label, value, min = -10000, max = 10000) => ({ id, label, value, type: 'number', min, max, step: 'any' });

export async function handleNetworkAction(editor, action, showForm=openEditorForm) {
  editor.closeEditorMenus?.();
  editor.racePortraitHotMenu = null;
  if (action === 'network-enable') {
    if (!editor.selectedRace.road.network) {
      commit(editor, networkFromLegacySamples(editor.getRacePathSamples({ step: 4 }), {
        widthM: editor.selectedRace.road.width || 11
      }), 'Enabled branching routes');
      // Layered roads need the 3D mesh renderer. Conversion of a race using
      // the legacy plane renderer must not silently hide its new branches.
      editor.selectedRace.groundRenderer = 'webgl-track';
      editor.selectedRace.renderDebug = { ...editor.getRaceRenderDebugSettings(),
        terrainEnabled: true, threeEnabled: true };
    }
    editor.networkTool = 'network-select'; editor.networkNodeId = editor.selectedRace.road.network.startNodeId;
    editor.activeRootId = 'track'; editor.racePortraitMode = 'race'; return;
  }
  const network = editor.selectedRace.road.network;
  if (action === 'network-water') {
    const water = editor.selectedRace.waterRegions?.find(w => w.id === editor.networkWaterId);
    const center = editor.networkLastPoint || { x: 0, z: 0 };
    const result = await showForm('Water level', [
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
  if(action==='network-multi'){
    editor.networkMultiSelect=!editor.networkMultiSelect;
    editor.networkSelectedNodeIds=selectedNodeIds(editor);editor.networkSelectedEdgeIds=selectedEdgeIds(editor);
    editor.networkTool='network-select';editor.networkDrag=null;
    editor.status=editor.networkMultiSelect?'Tap to toggle nodes/roads, or drag a box to add a group. Edit transforms the selection.':'Selection kept. Drag a selected node or road to move the group.';return;
  }
  if(action==='network-all'){editor.networkSelectedNodeIds=network.nodes.map(n=>n.id);editor.networkSelectedEdgeIds=network.edges.map(e=>e.id);editor.networkNodeId=network.nodes[0]?.id||'';editor.networkEdgeId=network.edges[0]?.id||'';editor.networkWaterId='';editor.networkMultiSelect=true;editor.status='All nodes and roads selected';return;}
  if(action==='network-clear'){selectNode(editor,'');editor.status='Selection cleared';return;}
  if(action==='network-transform'||action==='network-properties'&&(selectedNodeIds(editor).length+selectedEdgeIds(editor).length>1||editor.networkMultiSelect)){
    const nodes=selectedNodeIds(editor),edges=selectedEdgeIds(editor);
    if(!nodes.length&&!edges.length){editor.status='Select nodes or roads first';return;}
    const result=await showForm('Transform selection',[
      number('dx','Translate X (m)',0),number('dz','Translate Z (m)',0),
      number('scale','Scale geometry ×',1,.01,100),number('rotation','Rotate clockwise (degrees)',0,-360,360),
      number('widthScale','Road width × (1 = unchanged)',1,.01,100),
      choice('surface','Surface','',[{value:'',label:'Keep existing'},...RACE_SURFACES.map(s=>({value:s.id,label:s.label}))])
    ],{description:'Scale and rotation use the selection center. Edges include their endpoints. Width and surface affect selected roads and roads touching selected nodes. Width stays within 3–40 m. Heights stay unchanged.'});
    if(result&&editor.selectedRace.road.network===network)commit(editor,transformNetworkSelection(network,nodes,edges,result),'Transformed selection');
    return;
  }
  const selected=selectedNodeIds(editor);
  if((action==='network-join'||action==='network-connect')&&(selected.length>2||selectedEdgeIds(editor).length)){editor.status='Select exactly two nodes and no roads to Join or Connect.';return;}
  if((action==='network-join'||action==='network-connect')&&selected.length===2){
    const [first,second]=selected;
    const next=action==='network-join'?joinNetworkJunctions(network,first,second):connectNodes(editor,network,first,second);
    commit(editor,next,action==='network-join'?'Joined selected nodes':'Connected selected nodes');
    selectNode(editor,first);editor.networkMultiSelect=false;editor.networkTool='network-select';return;
  }
  if(action==='network-connect'){editor.status='Use Multi-select, select exactly two nodes, then Connect.';return;}
  if (['network-select', 'network-add', 'network-join', 'network-split'].includes(action)) {
    editor.networkTool = action;editor.networkMultiSelect=false;selectNode(editor,editor.networkNodeId);
    editor.status = { 'network-add': 'Select a starting junction, then click a junction or empty space to extend.',
      'network-join': 'Select the junction to keep, then click the junction to join.',
      'network-split': 'Click a route to insert a connected junction.', 'network-select': 'Tap a node to select; drag to move; tap empty ground to extend.' }[action]; return;
  }
  if (action === 'network-junction' && editor.networkNodeId) return handleNetworkAction(editor,'network-properties',showForm);
  if (action === 'network-junction') {
    const result = await showForm('Add junction', [choice('kind', 'Shape', 'y', [
      { value: 'y', label: 'Y split' }, { value: 't', label: 'T junction' }, { value: 'cross', label: 'Four-way intersection' }
    ]), number('heading', 'Direction (degrees)', 0, -360, 360), number('heightM', 'Height (m)', 0), number('lengthM', 'Arm length (m)', 60, 10, 500)]);
    if (result) { editor.networkJunction = result; editor.networkTool = 'network-junction'; editor.status = 'Click the map to place the junction. Connect its arms to your route.'; }
    return;
  }
  if (action === 'network-markers') {
    const options = network.nodes.map(n => ({ value: n.id, label: n.name || n.id }));
    const result = await showForm('Start / finish', [choice('startNodeId', 'Start', network.startNodeId, options), choice('finishNodeId', 'Default finish', network.finishNodeId, [{value:'',label:'None'},...options])], {description:'Set additional finishes by selecting a node and opening Edit → Finish node. Each finish can set saved variables and choose its own destination. The default finish is also used for route preview and AI routing.'});
    if (result) {
      if (result.startNodeId === result.finishNodeId || network.nodes.some(node=>node.id===result.startNodeId&&node.finish)) throw new Error('Start and finish must be distinct.');
      commit(editor, { ...network, ...result }, 'Start / finish updated');
    }
    return;
  }
  if (action === 'network-delete') {
    if (editor.networkWaterId) {
      editor.captureRaceHistory('Delete water'); editor.selectedRace.waterRegions = (editor.selectedRace.waterRegions || []).filter(w => w.id !== editor.networkWaterId);
      editor.networkWaterId = ''; editor.clearRaceRuntimeSurfaceCaches(); return;
    }
    if (selected.some(id=>[network.startNodeId, ...getNetworkFinishNodes(network).map(node=>node.id)].includes(id))) throw new Error('Move the start / finish marker before deleting its junction.');
    const next = structuredClone(network);
    next.edges = next.edges.filter(e => !selectedEdgeIds(editor).includes(e.id) && !selected.includes(e.from) && !selected.includes(e.to));
    next.nodes = next.nodes.filter(n => !selected.includes(n.id));
    commit(editor, next, 'Deleted selection'); editor.networkNodeId = ''; editor.networkSelectedNodeIds=[]; editor.networkSelectedEdgeIds=[]; editor.networkEdgeId = ''; return;
  }
  if (action !== 'network-properties') return;
  if (editor.networkWaterId) return handleNetworkAction(editor, 'network-water',showForm);
  const node = network.nodes.find(n => n.id === editor.networkNodeId), edge = network.edges.find(e => e.id === editor.networkEdgeId);
  if (node) {
    const finish = normalizeNodeFinish(node.finish) || { variables: {} };
    const destination = finish.destination || {};
    const isFinish = getNetworkFinishNodes(network).some(entry=>entry.id===node.id);
    const finishVisible = state=>state.finish===true;
    const destinationVisible = type=>state=>finishVisible(state)&&state.finishDestination===type;
    const fileOptions = folder=>[{value:'',label:'Choose…'},...listProjectFiles(folder).map(file=>({value:file.name,label:file.name}))];
    const result = await showForm('Node properties', [choice('kind','Node type',node.junctionKind||'normal',[{value:'normal',label:'Normal node'},{value:'y',label:'Y junction'},{value:'t',label:'T junction'},{value:'cross',label:'Four-way junction'}]), { id: 'name', label: 'Name', type: 'text', required: false, value: node.name },
      number('x', 'X (m)', node.x), number('z', 'Z (m)', node.z), number('heightM', 'Height (m)', node.heightM),
      {id:'finish',label:'Finish node',type:'checkbox',value:isFinish},
      {id:'finishVariables',label:'On finish: variables (one name = value per line)',type:'textarea',rows:4,required:false,value:formatMenuVariableAssignments(finish.variables),visibleWhen:finishVisible},
      {...choice('finishDestination','After this finish',destination.type||'inherit',[
        {value:'inherit',label:'Use race completion settings'},{value:'menu',label:'Open menu screen'},
        {value:'race',label:'Load race'},{value:'level',label:'Load level'},{value:'return-to-origin',label:'Return to origin'}]),visibleWhen:finishVisible},
      {...choice('menuRef','Menu',destination.menuRef||'',[{value:'',label:'Current / designated menu'},...fileOptions('menus').slice(1)]),visibleWhen:destinationVisible('menu')},
      {id:'menuScreen',label:'Screen ID',type:'text',value:destination.menuScreen||'world-map',visibleWhen:destinationVisible('menu')},
      {...choice('targetRace','Race',destination.targetRace||'',fileOptions('races')),visibleWhen:destinationVisible('race')},
      {...choice('targetLevel','Level',destination.targetLevel||'',fileOptions('levels')),visibleWhen:destinationVisible('level')},
      {...number('spawnX','Arrival tile X',destination.spawnX||0,0,100000),visibleWhen:destinationVisible('level')},
      {...number('spawnY','Arrival tile Y',destination.spawnY||0,0,100000),visibleWhen:destinationVisible('level')}
    ], {description:'A race can have multiple finish nodes. Only the exit you cross applies its variables, after the race-wide variables. Example: route = "north" or northUnlocked = true. lastRaceExit and lastRaceExitName are saved automatically. Use these in Menu Editor conditions and background variants.'});
    if (result && editor.selectedRace.road.network===network) {
      const enabled = result.finish ?? isFinish;
      if (enabled && node.id===network.startNodeId) throw Error('Start and finish must be distinct.');
      if (enabled && ['race','level'].includes(result.finishDestination) && !result[result.finishDestination==='race'?'targetRace':'targetLevel']) throw Error('Choose a destination file.');
      const variables = enabled ? parseMenuVariableAssignments(result.finishVariables ?? formatMenuVariableAssignments(finish.variables)) : {};
      let next=moveNetworkJunction(network,node.id,{name:result.name,x:result.x,z:result.z,heightM:result.heightM});
      const target = next.nodes.find(entry=>entry.id===node.id);
      if (enabled) target.finish = normalizeNodeFinish({variables,
        ...(result.finishDestination && result.finishDestination!=='inherit'?{destination:{...result,type:result.finishDestination}}:{})});
      else { delete target.finish; if(next.finishNodeId===node.id)next.finishNodeId=''; }
      if(result.kind && result.kind!==(node.junctionKind||'normal'))next=setNetworkNodeType(next,node.id,result.kind,{widthM:editor.selectedRace.road.width});
      commit(editor,next,'Node updated');
    }
  } else if (edge) {
    const result = await showForm('Route properties', [{ id: 'name', label: 'Name', type: 'text', required: false, value: edge.name },
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
  const highlightedEdges=new Set(selectedEdgeIds(editor));
  for (const edge of network.edges) {
    ctx.strokeStyle = highlightedEdges.has(edge.id) ? '#f2d45c' : edge.structure === 'bridge' ? '#b3b8cd' : edge.structure === 'tunnel' ? '#727a85' : '#738b78';
    ctx.lineWidth = Math.max(3, edge.widthM * scale); ctx.lineCap = 'butt';
    ctx.setLineDash(edge.structure === 'tunnel' ? [8, 4] : []); ctx.beginPath();
    getNetworkEdgePoints(network, edge).forEach((point, i) => { const p = screen(point); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke();
  }
  ctx.setLineDash([]);
  const selectedNodes=new Set(selectedNodeIds(editor));
  const finishes=new Set(getNetworkFinishNodes(network).map(node=>node.id));
  for (const node of network.nodes) {
    const p = screen(node), selected = selectedNodes.has(node.id);
    ctx.fillStyle = node.id === network.startNodeId ? '#61e79a' : finishes.has(node.id) ? '#ff885d' : selected ? '#f2d45c' : '#d9e6d2';
    ctx.beginPath(); ctx.arc(p.x, p.y, selected ? 8 : 6, 0, Math.PI * 2); ctx.fill();
    if(selected){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,12,0,Math.PI*2);ctx.stroke();}
    ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${node.id === network.startNodeId ? 'START ' : finishes.has(node.id) ? 'FINISH ' : ''}${node.name || node.id} · ${node.heightM.toFixed(1)}m`, p.x + 9, p.y - 8);
  }
  editor.drawRaceTopDownDecals(ctx, bounds, { kind: 'decal' });
  if (editor.showRaceScenery !== false) editor.drawRaceTopDownScenerySprites(ctx, bounds);
  editor.drawRaceTopDownTriggers(ctx, bounds);
  const box=editor.networkDrag;
  if(box?.kind==='box'&&box.moved){
    const x=Math.min(box.screenX,box.endX),y=Math.min(box.screenY,box.endY),w=Math.abs(box.endX-box.screenX),h=Math.abs(box.endY-box.screenY);
    ctx.fillStyle='#f2d45c22';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#f2d45c';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(x,y,w,h);ctx.setLineDash([]);
  }
  editor.drawRaceMapScaleBar(ctx, bounds); ctx.restore();
}

export function selectedNodeIds(editor){
  const nodes=editor.selectedRace?.road?.network?.nodes||[];
  return [...new Set(editor.networkSelectedNodeIds?.length?editor.networkSelectedNodeIds:[editor.networkNodeId])].filter(id=>nodes.some(n=>n.id===id));
}
export function selectedEdgeIds(editor){const edges=editor.selectedRace?.road?.network?.edges||[];return [...new Set(editor.networkSelectedEdgeIds?.length?editor.networkSelectedEdgeIds:[editor.networkEdgeId])].filter(id=>edges.some(e=>e.id===id));}
function selectNode(editor,id){editor.networkNodeId=id;editor.networkSelectedNodeIds=id?[id]:[];editor.networkSelectedEdgeIds=[];editor.networkEdgeId='';editor.networkWaterId='';}
function connectNodes(editor,network,from,to){
  if(network.edges.some(e=>e.from===from&&e.to===to||e.bidirectional&&e.from===to&&e.to===from))return network;
  const nearby=network.edges.find(e=>e.from===from||e.to===from);
  return addNetworkRoute(network,{from,to,widthM:nearby?.widthM||editor.selectedRace.road.width,surface:nearby?.surface||'asphalt'}).network;
}
function extend(editor,network,p,from){
  if(!network.nodes.some(n=>n.id===from)){editor.status='Tap a node first, then tap empty ground to extend.';return;}
  let i=1;while(network.nodes.some(n=>n.id===`junction-${i}`))i++;
  const id=`junction-${i}`,next=structuredClone(network),origin=network.nodes.find(n=>n.id===from);
  if(Math.hypot(origin.x-p.x,origin.z-p.z)<1){editor.status='Place the next node at least one meter away.';return;}
  next.nodes.push({...p,id,name:'',heightM:origin.heightM});
  commit(editor,connectNodes(editor,next,from,id),'Extended track');selectNode(editor,id);
}
function updateBoxSelection(editor,drag,payload){
  const bounds=editor.raceMapBounds;
  drag.endX=Math.max(bounds.x,Math.min(bounds.x+bounds.w,payload.x));
  drag.endY=Math.max(bounds.y,Math.min(bounds.y+bounds.h,payload.y));
  const end=editor.screenToRaceMapWorldPoint(drag.endX,drag.endY);
  const selected=networkSelectionInBox(editor.selectedRace.road.network,drag.point,{x:end.x,z:end.y});
  editor.networkSelectedNodeIds=[...new Set([...drag.nodes,...selected.nodes])];
  editor.networkSelectedEdgeIds=[...new Set([...drag.edges,...selected.edges])];
  editor.networkNodeId=editor.networkSelectedNodeIds.at(-1)||'';
  editor.networkEdgeId=editor.networkSelectedEdgeIds.at(-1)||'';
  editor.networkWaterId='';
  editor.status=`${editor.networkSelectedNodeIds.length} nodes and ${editor.networkSelectedEdgeIds.length} roads selected. Edit to transform.`;
}
export function networkPointer(editor,payload,phase){
  const network=editor.selectedRace?.road?.network,bounds=editor.raceMapBounds;
  if(!network||!bounds||editor.playtestSession||editor.mode!=='race'||editor.racePortraitMode!=='race')return false;
  const drag=editor.networkDrag;
  if(drag&&drag.pointerId!==(payload.id??'pointer'))return false;
  if(phase==='up'){
    if(!drag)return false;
    if(drag.kind==='box'){
      if(drag.moved||Math.hypot(payload.x-drag.screenX,payload.y-drag.screenY)>=6)updateBoxSelection(editor,drag,payload);
      else if(drag.hit){
        const key=drag.hit.kind==='node'?'networkSelectedNodeIds':'networkSelectedEdgeIds',base=drag.hit.kind==='node'?drag.nodes:drag.edges;
        editor[key]=base.includes(drag.hit.id)?base.filter(id=>id!==drag.hit.id):[...base,drag.hit.id];
        editor.networkNodeId=editor.networkSelectedNodeIds.at(-1)||'';editor.networkEdgeId=editor.networkSelectedEdgeIds.at(-1)||'';editor.networkWaterId='';
        editor.status=`${editor.networkSelectedNodeIds.length} nodes and ${editor.networkSelectedEdgeIds.length} roads selected. Drag a box to add more.`;
      }
    }
    editor.networkDrag=null;
    if(drag.kind==='empty'&&!drag.moved)extend(editor,network,drag.point,drag.from);
    return true;
  }
  const inside=payload.x>=bounds.x&&payload.x<=bounds.x+bounds.w&&payload.y>=bounds.y&&payload.y<=bounds.y+bounds.h;
  if(!inside&&!drag)return false;
  const raw=editor.screenToRaceMapWorldPoint(payload.x,payload.y),p={x:raw.x,z:raw.y};editor.networkLastPoint=p;
  if(phase==='move'){
    if(!drag)return false;
    if(!drag.moved&&Math.hypot(payload.x-drag.screenX,payload.y-drag.screenY)<6)return true;
    if(drag.kind==='box')updateBoxSelection(editor,drag,payload);
    if(drag.kind==='node'||drag.kind==='group'){
      if(!drag.moved)editor.captureRaceHistory('Move selection');
      editor.selectedRace.road.network=transformNetworkSelection(drag.source,drag.nodes,drag.edges,{dx:p.x-drag.point.x,dz:p.z-drag.point.z});
      editor.clearRaceRuntimeSurfaceCaches();editor.status='Moved selection';
    }
    drag.moved=true;return true;
  }
  const scale=editor.getRaceMapTransform(bounds).scale;
  const node=network.nodes.map(n=>({node:n,d:Math.hypot(n.x-p.x,n.z-p.z)*scale})).filter(n=>n.d<22).sort((a,b)=>a.d-b.d)[0]?.node;
  const tool=editor.networkTool||'network-select';
  if(editor.networkMultiSelect||payload.shiftKey){
    const projection=node?null:projectNetworkPoint(network,p);
    const edge=projection&&projection.distanceToRoute*scale<Math.max(10,projection.edge.widthM*scale/2)?projection.edge:null;
    const nodes=selectedNodeIds(editor),edges=selectedEdgeIds(editor);
    editor.networkSelectedNodeIds=nodes;editor.networkSelectedEdgeIds=edges;
    editor.networkDrag={kind:'box',pointerId:payload.id??'pointer',nodes,edges,point:p,screenX:payload.x,screenY:payload.y,endX:payload.x,endY:payload.y,transform:editor.getRaceMapTransform(bounds),hit:node?{kind:'node',id:node.id}:edge?{kind:'edge',id:edge.id}:null};
    return true;
  }

  if(tool==='network-junction'){
    const settings=editor.networkJunction;if(!settings)return true;
    const next=structuredClone(network);let i=1;while(next.nodes.some(n=>n.id===`junction-${i}`))i++;
    const id=`junction-${i}`;next.nodes.push({...p,id,name:'',heightM:Number(settings.heightM)});
    commit(editor,createNetworkJunction(next,{...settings,nodeId:id,heading:Number(settings.heading)*Math.PI/180,widthM:editor.selectedRace.road.width}).network,'Added junction');
    selectNode(editor,id);editor.networkTool='network-select';return true;
  }
  if(tool==='network-join'&&node&&editor.networkNodeId&&node.id!==editor.networkNodeId){
    const keep=editor.networkNodeId;commit(editor,joinNetworkJunctions(network,keep,node.id),'Joined junctions');selectNode(editor,keep);editor.networkTool='network-select';return true;
  }
  if(tool==='network-add'&&editor.networkNodeId&&node&&node.id!==editor.networkNodeId){
    commit(editor,connectNodes(editor,network,editor.networkNodeId,node.id),'Connected route');selectNode(editor,node.id);return true;
  }
  if(node){
    if(!selectedNodeIds(editor).includes(node.id))selectNode(editor,node.id);
    editor.networkDrag={kind:'node',nodes:selectedNodeIds(editor),edges:selectedEdgeIds(editor),pointerId:payload.id??'pointer',nodeId:node.id,source:structuredClone(network),nodeX:node.x,nodeZ:node.z,point:p,screenX:payload.x,screenY:payload.y,transform:editor.getRaceMapTransform(bounds)};
    editor.status='Node selected. Drag to move, tap empty ground to extend, or Edit its type.';return true;
  }
  const projection=projectNetworkPoint(network,p);
  if(projection&&projection.distanceToRoute*scale<Math.max(10,projection.edge.widthM*scale/2)){
    if(tool==='network-split'){
      const split=splitNetworkRoute(network,projection.edgeId,projection.distance);commit(editor,split.network,'Split route');selectNode(editor,split.nodeId);editor.networkTool='network-select';
    }else{
      if(!selectedEdgeIds(editor).includes(projection.edgeId)){selectNode(editor,'');editor.networkEdgeId=projection.edgeId;editor.networkSelectedEdgeIds=[projection.edgeId];}
      editor.networkDrag={kind:'group',nodes:selectedNodeIds(editor),edges:selectedEdgeIds(editor),pointerId:payload.id??'pointer',source:structuredClone(network),point:p,screenX:payload.x,screenY:payload.y,transform:editor.getRaceMapTransform(bounds)};
      editor.status='Road selected. Drag to move or Transform selection to scale, rotate or widen.';
    }
    return true;
  }
  const water=(editor.selectedRace.waterRegions||[]).find(w=>Math.abs(p.x-w.x)<=w.widthM/2&&Math.abs(p.z-w.z)<=w.lengthM/2);
  if(water&&tool==='network-select'){selectNode(editor,'');editor.networkWaterId=water.id;return true;}
  if(['network-select','network-add'].includes(tool)){
    editor.networkDrag={kind:'empty',pointerId:payload.id??'pointer',point:p,from:editor.networkNodeId,screenX:payload.x,screenY:payload.y,transform:editor.getRaceMapTransform(bounds)};return true;
  }
  selectNode(editor,'');editor.networkWaterId=(editor.selectedRace.waterRegions||[]).find(w=>Math.abs(p.x-w.x)<=w.widthM/2&&Math.abs(p.z-w.z)<=w.lengthM/2)?.id||'';
  return true;
}
