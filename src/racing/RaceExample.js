import { createDefaultRace, createDefaultRaceProject, RACE_LANE_WIDTH_M } from './raceData.js';
import { normalizeRaceRouteNetwork } from './RaceRouteNetwork.js';

// A small, fully editable demonstration. Crossings at different heights use
// distinct nodes; only the named junctions connect their roads.
export function createBranchingExampleRace({ id = 'test-loop', laneCount = 1 } = {}) {
  laneCount = Math.max(1, Math.min(6, Math.round(Number(laneCount) || 1)));
  const race = createDefaultRace(id);
  race.name = 'Branching Valley';
  race.type = 'destination';
  race.laps = 1;
  race.codriver.calls = [];
  const nodes = [
    ['start', 'Start', 0, -100], ['y', 'Y split', 0, 0],
    ['left', 'West approach', -90, 100], ['right', 'East approach', 90, 100],
    ['t', 'T junction', -90, 220], ['tw', 'West turn', -190, 220],
    ['te', 'East turn', 90, 220], ['west', 'West loop', -190, 400],
    ['cross', 'Four-way intersection', 0, 400], ['east', 'East loop', 180, 400],
    ['bridge-east', 'Bridge east', 180, 160, 6], ['bridge-west', 'Bridge west', -190, 160, 6],
    ['tunnel-exit', 'Tunnel exit', 0, 600], ['finish', 'Finish', 0, 720]
  ].map(([id, name, x, z, heightM = 0]) => ({ id, name, x, z, heightM }));
  const point = (x, z, heightM = 0) => ({ x, z, heightM });
  const edge = (id, from, to, points = [], structure = 'road') => ({
    id, name: id.replaceAll('-', ' '), from, to, points, structure,
    widthM: laneCount * RACE_LANE_WIDTH_M, surface: 'asphalt', clearanceM: 4
  });
  race.road.laneCount = laneCount;
  race.road.width = laneCount * RACE_LANE_WIDTH_M;
  race.road.network = normalizeRaceRouteNetwork({ nodes, edges: [
    edge('start-straight', 'start', 'y'),
    edge('y-west', 'y', 'left'), edge('y-east', 'y', 'right'),
    edge('west-approach', 'left', 't'), edge('east-approach', 'right', 'te'),
    edge('t-west', 't', 'tw'), edge('t-east', 't', 'te'),
    edge('west-link', 'tw', 'west'), edge('cross-west', 'west', 'cross'),
    edge('cross-south', 'te', 'cross', [point(90, 300), point(0, 300)]),
    edge('cross-east', 'cross', 'east'),
    edge('bridge-ascent', 'east', 'bridge-east', [point(180, 240, 6)], 'bridge'),
    edge('overpass', 'bridge-east', 'bridge-west', [], 'bridge'),
    edge('bridge-descent', 'bridge-west', 'west', [point(-260, 240, 6), point(-260, 400)], 'bridge'),
    edge('surface-over-tunnel', 'east', 'west', [point(180, 500), point(-190, 500)]),
    edge('tunnel', 'cross', 'tunnel-exit', [point(0, 460, -6), point(0, 540, -6)], 'tunnel'),
    edge('shallow-ford', 'tunnel-exit', 'finish')
  ], startNodeId: 'start', finishNodeId: 'finish' });
  race.waterRegions = [{ id: 'shallow-ford', name: 'Shallow ford', x: 0, z: 650,
    widthM: 42, lengthM: 30, levelM: 0.2, bottomM: -1, color: '#287fa3' }];
  // Gentle grass hills, stored in the normal editable terrain grid. Heights
  // here use renderer elevation units (12 metres per unit).
  const cells = {};
  for (let z = 430; z <= 740; z += 5) for (let x = -150; x <= 150; x += 5) {
    const hill = (cx, cz, radius, height) => height * Math.max(0, 1 - Math.hypot(x - cx, z - cz) / radius) ** 2;
    const heightM = hill(-100, 610, 80, 2) + hill(100, 690, 75, 1.6) + hill(0, 500, 65, 1.2);
    if (heightM > 0.01) cells[`${x / 5},${z / 5}`] = { tileId: 'grass', elevation: heightM / 12 };
  }
  race.road.tileMap.cells = cells;
  return race;
}

export function createEmptyRace({id='new-race',laneCount=1}={}) {
  laneCount=Math.max(1,Math.min(6,Math.round(Number(laneCount)||1)));
  const race=createDefaultRace(id);
  race.name='New Race';race.type='destination';race.laps=1;
  race.codriver.calls=[];race.waterRegions=[];
  race.road.laneCount=laneCount;race.road.width=laneCount*RACE_LANE_WIDTH_M;
  race.road.nodes=[{x:0,y:0,elevation:0,role:'start',locked:true}];
  race.road.segments=[];race.road.tileMap.cells={};
  race.road.network=normalizeRaceRouteNetwork({
    nodes:[{id:'start',name:'Start',x:0,z:0,heightM:0},{id:'end',name:'Track end',x:0,z:100,heightM:0}],
    edges:[{id:'straight',name:'Straight',from:'start',to:'end',points:[],widthM:race.road.width,surface:'asphalt'}],
    startNodeId:'start',finishNodeId:''
  });
  return race;
}

export function createNewRaceProject(options = {}) {
  const project = createDefaultRaceProject();
  project.races = [createEmptyRace(options)];
  project.selectedRaceId = project.races[0].id;
  return project;
}
