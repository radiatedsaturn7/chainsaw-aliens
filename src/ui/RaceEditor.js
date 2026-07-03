import { RACE_SNOW_CONDITIONS, RACE_SURFACES, RACE_TIRE_COMPOUNDS, createDefaultRaceProject, createTestTrackRace, getSurfaceById } from '../racing/raceData.js';
import { DEFAULT_TILE_TYPES } from '../content/tileDefinitions.js';
import { getLandscapeHandheldLayout, getPortraitHandheldLayout } from './shared/canvasViewportLayout.js';
import {
  UI_SUITE,
  buildSharedEditorFileMenu,
  drawSharedDesktopContextPanel,
  drawSharedDesktopDropdown,
  drawSharedDesktopRibbon,
  drawSharedDesktopTopMenu,
  drawSharedGamepadHintBar,
  drawSharedGamepadSlideOutHeader,
  drawSharedMenuButtonChrome,
  drawSharedMenuButtonLabel,
  drawSharedPanel,
  drawSharedPortraitActionRail
} from './uiSuite.js';
import { drawSharedMobileZoomSlider } from './shared/mobileZoomSlider.js';
import {
  applyDesktopDropdownWheelScrollState,
  buildCompactLandscapeCommandRailActions,
  buildCompactLandscapeCommandRailButtonLayout,
  buildDesktopDropdownRenderPlan,
  buildDesktopEditorShellPlan,
  buildGamepadSlideOutMenuPlan,
  buildLandscapeRootDrawerGridLayout,
  buildScrolledLandscapeRootDrawerItems,
  buildLandscapeTouchEditorShellPlan,
  buildMenuScrollDragState,
  canRenderEditorPlanSurface,
  canRenderEditorSurface,
  createDesktopDropdownCommandHit,
  createDesktopRootMenuHit,
  createPendingDesktopDropdownHit,
  getEditorPointerInteractionPolicy,
  resolveClosedDesktopDropdownState,
  resolveDesktopDropdownState,
  resolveDesktopDropdownHoverSwitch,
  resolveDesktopDropdownRootId,
  resolveEditorViewportModeFlags,
  resolveGamepadMenuState,
  resolveMenuScrollDrag,
  resolveOpenDesktopDropdownState,
  resolvePendingDesktopDropdownHit,
  shouldCloseDesktopDropdownOnPointerDown,
  updatePendingDesktopDropdownHit
} from './shared/editorMenuLayout.js';
import { getEditorMenuSpec, getEditorPortraitRootMenuEntries, getEditorRootMenuEntries, getStandardEditorActionRailIds } from './shared/editorMenuSpec.js';
import { SHARED_EDITOR_GAMEPAD_HINTS } from './shared/input/editorInputActions.js';
import { getSharedMobilePortraitEditorLayout } from './uiSuite.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const FEET_TO_METERS = 0.3048;
const MPH_TO_MPS = 0.44704;

const RACE_CONTROLLER_STEERING = {
  speedReferenceMps: 62,
  digitalResponseBase: 84,
  digitalResponseLowSpeedBonus: 36,
  analogResponseBase: 48,
  analogResponseLowSpeedBonus: 22,
  returnRateBase: 20,
  returnRateHighSpeedBonus: 18,
  stoppedAuthority: 1,
  highwayAuthority: 0.64,
  parkingTireAngleRad: 0.56,
  highwayTireAngleRad: 0.225,
  highSpeedYawDampingFloor: 0.4
};

const RACE_HIGHWAY_MARKERS = {
  dashLengthM: 10 * FEET_TO_METERS,
  gapLengthM: 30 * FEET_TO_METERS,
  dashWidthM: 0.12,
  edgePostIntervalM: 160 * FEET_TO_METERS
};

const BUILT_IN_RACE_LOAD_ACTIONS = [
  { id: 'load-weathertech-raceway', raceId: 'weathertech-raceway' },
  { id: 'load-nurburgring-nordschleife', raceId: 'nurburgring-nordschleife' },
  { id: 'load-col-de-turini', raceId: 'col-de-turini' },
  { id: 'load-ouninpohja', raceId: 'ouninpohja' },
  { id: 'load-daytona-tri-oval', raceId: 'daytona-tri-oval' }
];

const BUILT_IN_RACE_LOAD_BY_ACTION = Object.fromEntries(
  BUILT_IN_RACE_LOAD_ACTIONS.map((entry) => [entry.id, entry])
);

const RACE_EDITOR_AVAILABLE_ACTIONS = new Set([
  'exit-main',
  'new',
  'save',
  'save-as',
  'test-drive',
  'zoom-fit',
  'draw-road',
  'move-node',
  'insert-node',
  'snap-node',
  'remove-node',
  'remove-edge',
  'segment-length',
  'curve',
  'elevation',
  'paint-elevation',
  'elevation-up',
  'elevation-down',
  'elevation-brush-size',
  'square-turn',
  'road-width',
  'segment-width',
  'segment-bumpiness',
  'snow-condition',
  'ground-tile-next',
  'paint-ground',
  'edge-tile',
  'surface-asphalt',
  'surface-dirt',
  'surface-gravel',
  'surface-snow',
  'surface-wet-asphalt',
  'drivetrain-rwd',
  'drivetrain-fwd',
  'drivetrain-awd',
  'engine-sound-next',
  'weather-clear',
  'weather-rain',
  'weather-storm',
  'weather-snow',
  'generate-random-race',
  ...BUILT_IN_RACE_LOAD_ACTIONS.map((entry) => entry.id),
  'finish-return',
  'add-sprite',
  'move-sprite',
  'delete-sprite',
  'side-left',
  'side-right',
  'end-playtest'
]);

const CAR_ENGINE_SOUND_PROFILES = [
  { id: 'wrx-flat-four-manual', label: 'WRX Manual' },
  { id: 'wrx-flat-four-cvt', label: 'WRX SPT' },
  { id: 'brz-flat-four-manual', label: 'BRZ Manual' },
  { id: 'brz-flat-four-auto', label: 'BRZ Auto' },
  { id: 'civic-turbo-manual', label: 'Civic Manual' },
  { id: 'civic-turbo-cvt', label: 'Civic CVT' },
  { id: 'race-inline-four', label: 'Inline Four' },
  { id: 'race-v8', label: 'V8' }
];

export function buildRacePortraitMenuModel(editorId = 'race') {
  const resolvedEditorId = editorId === 'car' ? 'car' : 'race';
  const contextActionId = resolvedEditorId === 'car' ? 'test-drive' : 'race-context';
  return {
    rootTabs: getEditorPortraitRootMenuEntries(resolvedEditorId),
    bottomRailActions: getStandardEditorActionRailIds(contextActionId),
    portraitRootPlacement: 'bottom-rail'
  };
}

export function buildCarPortraitMenuModel() {
  return buildRacePortraitMenuModel('car');
}

export default class RaceEditor {
  constructor(game, { mode = 'race' } = {}) {
    this.game = game;
    this.mode = mode;
    this.project = createDefaultRaceProject();
    this.buttons = [];
    this.previewOffset = 0;
    this.raceMapBounds = null;
    this.raceNodeDrag = null;
    this.raceGroundPaintDrag = null;
    this.raceElevationPaintDrag = null;
    this.racePortraitMode = 'race';
    this.raceElevationBrushSize = 0.1;
    this.raceElevationBrushDirection = 1;
    this.raceMapZoom = 1;
    this.raceMapPan = { x: 0, y: 0 };
    this.raceMapZoomSliderBounds = null;
    this.raceMapZoomDrag = null;
    this.raceMapThumbstickDrag = null;
    this.portraitThumbstick = {
      center: { x: 0, y: 0 },
      radius: 0,
      knobRadius: 0,
      active: false,
      id: null,
      dx: 0,
      dy: 0
    };
    this.desktopPreviewDrag = null;
    this.openDesktopDropdownRootId = null;
    this.closedDesktopDropdownRootId = null;
    this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });
    this.desktopDropdownScroll = {};
    this.activeViewportMode = 'desktop';
    this.activeModeContract = null;
    this.activeSpecModeContract = null;
    this.activeAction = null;
    this.selectedSegmentIndex = 0;
    this.raceSelectionType = 'edge';
    this.status = 'Ready';
    this.activeRootId = mode === 'car' ? 'art' : 'race';
    this.mobileRootOpen = false;
    this.gamepadSubmenuOpen = false;
    this.gamepadFocusedItemId = null;
    this.menuScrollState = {};
    this.menuScrollRegions = [];
    this.menuScrollDrag = null;
    this.pendingMenuScrollHit = null;
    this.pendingDesktopDropdownHit = null;
    this.pendingDesktopCommandHit = null;
    this.playtestPickerOpen = false;
    this.preRaceTuningOpen = false;
    this.playtestSession = null;
    this.raceInput = {
      steeringTarget: 0,
      steeringWheel: 0,
      throttle: false,
      brake: false,
      handbrake: false,
      autoShift: true,
      transmissionMode: 'automatic',
      keyboardThrottle: false,
      keyboardBrake: false,
      keyboardSteer: 0,
      binarySteer: 0,
      gear: 0,
      cameraView: 'third-person',
      paused: false,
      analogSteeringActive: false,
      activeDpadPointerId: null,
      activeThrottlePointerId: null,
      activeBrakePointerId: null,
      throttlePulseMs: 0,
      lastBrakeTapMs: 0
    };
  }

  update(input, dt) {
    this.previewOffset = (this.previewOffset + dt * 60) % 240;
    this.updateRaceMapThumbstickPan(dt);
    if (!this.game?.input?.isGamepadConnected?.() && this.gamepadSubmenuOpen) {
      this.mobileRootOpen = false;
      this.gamepadSubmenuOpen = false;
    }
    this.updateRaceKeyboardInput(input);
    this.updatePlaytest(dt);
    if (input?.wasPressed?.('cancel')) {
      if (this.playtestPickerOpen) {
        this.cancelPlaytestPicker();
        return;
      }
      if (this.playtestSession) {
        this.endPlaytest();
        return;
      }
      if (this.gamepadSubmenuOpen && !this.mobileRootOpen) {
        this.mobileRootOpen = true;
        this.gamepadSubmenuOpen = false;
        return;
      }
      if (this.mobileRootOpen || this.gamepadSubmenuOpen) {
        this.mobileRootOpen = false;
        this.gamepadSubmenuOpen = false;
        return;
      }
      this.exitToMainMenu();
    }
  }

  resetTransientInteractionState() {
    this.buttons = [];
    this.menuScrollRegions = [];
  }

  exitToMainMenu() {
    this.game.exitRaceEditor?.(this.mode);
  }

  get selectedRace() {
    return this.project.races.find((race) => race.id === this.project.selectedRaceId) || this.project.races[0];
  }

  get selectedCar() {
    return this.project.cars.find((car) => car.id === this.project.selectedCarId) || this.project.cars[0];
  }

  isSelectedRaceLoopClosed() {
    const points = this.getRaceEndpointPoints();
    if (points.length < 2) return false;
    const first = points[0];
    const last = points[points.length - 1];
    const closeDistance = Math.hypot(
      Number(last.x || 0) - Number(first.x || 0),
      Number(last.z || 0) - Number(first.z || 0)
    );
    const snapRange = Math.max(1.8, Math.min(this.getRaceRoadHalfWidthWorld() * 0.18, this.getRaceCarWorldWidth() * 2.4));
    return closeDistance <= snapRange;
  }

  getRaceEndpointPoints() {
    const nodes = this.getRaceEditableNodes({ create: false });
    if (nodes.length >= 2) {
      return nodes.map((node) => ({ x: Number(node.x || 0), z: Number(node.y || 0) }));
    }
    return this.getRacePathSamples({ step: 42 }).map((sample) => ({
      x: Number(sample.x || 0),
      z: Number(sample.z || 0)
    }));
  }

  getSelectedRaceRuntimeType() {
    const samples = this.getRaceEndpointPoints();
    if (samples.length >= 2) {
      return this.isSelectedRaceLoopClosed() ? 'circuit' : 'destination';
    }
    return 'destination';
  }

  getActiveRaceRuntimeType() {
    return this.playtestSession?.routeRuntimeType || this.getSelectedRaceRuntimeType();
  }

  resetRacePlaytestInputs() {
    this.raceInput.throttle = false;
    this.raceInput.brake = false;
    this.raceInput.handbrake = false;
    this.raceInput.binarySteer = 0;
    this.raceInput.keyboardThrottle = false;
    this.raceInput.keyboardBrake = false;
    this.raceInput.keyboardSteer = 0;
    this.raceInput.analogSteeringActive = false;
    this.raceInput.activeDpadPointerId = null;
    this.raceInput.activeThrottlePointerId = null;
    this.raceInput.activeBrakePointerId = null;
  }

  exitPlaytestToMainMenu() {
    if (this.playtestSession) this.endPlaytest();
    this.exitToMainMenu();
  }

  get selectedSegment() {
    const segments = this.selectedRace?.road?.segments || [];
    if (!segments.length) return null;
    this.selectedSegmentIndex = clamp(Math.round(Number(this.selectedSegmentIndex) || 0), 0, segments.length - 1);
    return segments[this.selectedSegmentIndex];
  }

  cloneRaceSegment(segment = null) {
    const source = segment || this.selectedSegment || this.selectedRace?.road?.segments?.[0] || {};
    return {
      length: Math.max(60, Math.round(Number(source.length) || 140)),
      curve: clamp(Number(source.curve) || 0, -1, 1),
      elevation: clamp(Number(source.elevation) || 0, -0.5, 0.5),
      surface: getSurfaceById(source.surface).id,
      roadWidthM: clamp(Number(source.roadWidthM || source.roadWidth || this.selectedRace?.road?.width || 11), 4, 24),
      bumpiness: clamp(Number(source.bumpiness) || 0, 0, 1),
      ...(source.snowCondition ? { snowCondition: source.snowCondition } : {}),
      ...(source.edgeTileId ? { edgeTileId: source.edgeTileId } : {}),
      hazardIds: Array.isArray(source.hazardIds) ? [...source.hazardIds] : [],
      ...(source.codriver ? { codriver: source.codriver } : {}),
      ...(source.turn ? { turn: source.turn } : {})
    };
  }

  appendRaceSegment() {
    const race = this.selectedRace;
    if (!race?.road) return;
    race.road.segments = Array.isArray(race.road.segments) ? race.road.segments : [];
    const insertAt = clamp(Math.round(Number(this.selectedSegmentIndex) || 0) + 1, 0, race.road.segments.length);
    const next = this.cloneRaceSegment(race.road.segments[insertAt - 1]);
    next.length = 140;
    next.curve = 0;
    next.elevation = 0;
    delete next.turn;
    race.road.segments.splice(insertAt, 0, next);
    if (Array.isArray(race.road.nodes)) delete race.road.nodes;
    this.selectedSegmentIndex = insertAt;
  }

  adjustSelectedSegment(field) {
    const segment = this.selectedSegment;
    if (!segment) return;
    if (field === 'length') {
      const next = Math.round((Number(segment.length) || 120) + 40);
      segment.length = next > 360 ? 80 : next;
    } else if (field === 'curve') {
      const next = Math.round(((Number(segment.curve) || 0) + 0.25) * 100) / 100;
      segment.curve = next > 1 ? -1 : next;
    } else if (field === 'elevation') {
      const next = Math.round(((Number(segment.elevation) || 0) + 0.08) * 100) / 100;
      segment.elevation = next > 0.48 ? -0.4 : next;
    } else if (field === 'width') {
      this.cycleSelectedSegmentRoadWidth();
    } else if (field === 'bumpiness') {
      this.cycleSelectedSegmentBumpiness();
    }
  }

  toggleSelectedSquareTurn() {
    const segment = this.selectedSegment;
    if (!segment) return;
    if (segment.turn === 'square') {
      delete segment.turn;
      return;
    }
    segment.turn = 'square';
    if (Math.abs(Number(segment.curve) || 0) < 0.55) segment.curve = 0.9;
  }

  cycleRoadWidth() {
    const road = this.selectedRace?.road;
    if (!road) return;
    const next = Math.round((Number(road.width) || 11) + 1);
    road.width = next > 18 ? 8 : next;
  }

  getSelectedSegmentRoadWidthM(segment = this.selectedSegment) {
    return clamp(Number(segment?.roadWidthM || segment?.roadWidth || this.selectedRace?.road?.width || 11), 4, 24);
  }

  cycleSelectedSegmentRoadWidth() {
    const segment = this.selectedSegment;
    if (!segment) return;
    const current = this.getSelectedSegmentRoadWidthM(segment);
    const next = current >= 24 ? 4 : current + (current < 8 ? 1 : 2);
    segment.roadWidthM = next;
    this.status = `Segment width: ${next} m`;
  }

  cycleSelectedSegmentBumpiness() {
    const segment = this.selectedSegment;
    if (!segment) return;
    const current = clamp(Number(segment.bumpiness) || 0, 0, 1);
    const next = current >= 0.9 ? 0 : Math.round((current + 0.15) * 100) / 100;
    segment.bumpiness = next;
    this.status = `Segment bumpiness: ${Math.round(next * 100)}%`;
  }

  getSnowConditionById(id) {
    return RACE_SNOW_CONDITIONS.find((condition) => condition.id === id) || RACE_SNOW_CONDITIONS[1];
  }

  cycleSelectedSegmentSnowCondition() {
    const segment = this.selectedSegment;
    if (!segment) return;
    const index = segment.snowCondition
      ? RACE_SNOW_CONDITIONS.findIndex((condition) => condition.id === segment.snowCondition)
      : -1;
    const next = index < 0
      ? this.getSnowConditionById()
      : RACE_SNOW_CONDITIONS[(index + 1) % RACE_SNOW_CONDITIONS.length];
    segment.snowCondition = next.id;
    if (segment.surface !== 'snow') segment.surface = 'snow';
    this.status = `Snow condition: ${next.label}`;
  }

  ensureRaceRoadAuthoringData() {
    const road = this.selectedRace?.road;
    if (!road) return null;
    road.groundTiles = Array.isArray(road.groundTiles) ? road.groundTiles : [];
    road.selectedGroundTileId = road.selectedGroundTileId || 'grass';
    road.tilePaintSource = road.tilePaintSource || 'tile-editor';
    return road;
  }

  getRaceTileDefinition(tileId) {
    const runtimeTiles = Array.isArray(this.game?.world?.tileDefinitions?.all)
      ? this.game.world.tileDefinitions.all
      : DEFAULT_TILE_TYPES;
    return runtimeTiles.find((tile) => tile?.id === tileId)
      || DEFAULT_TILE_TYPES.find((tile) => tile?.id === tileId)
      || null;
  }

  getRaceGroundTileChoices() {
    const runtimeTiles = Array.isArray(this.game?.world?.tileDefinitions?.all)
      ? this.game.world.tileDefinitions.all
      : DEFAULT_TILE_TYPES;
    const tileIds = [
      'grass',
      'asphalt',
      'dirt',
      'gravel',
      'snow',
      'wet-asphalt',
      ...runtimeTiles
        .filter((tile) => tile?.id && !['spawn', 'empty'].includes(tile.id))
        .map((tile) => tile.id)
    ];
    const uniqueIds = [...new Set(tileIds)];
    const tiles = new Map([
      ...DEFAULT_TILE_TYPES.map((tile) => [tile.id, tile]),
      ...runtimeTiles.filter((tile) => tile?.id).map((tile) => [tile.id, tile])
    ]);
    return uniqueIds.map((id) => {
      const surface = RACE_SURFACES.find((entry) => entry.id === id);
      const tile = tiles.get(id);
      return {
        id,
        label: surface?.label || tile?.label || id.replace(/-/g, ' '),
        source: tile ? 'tile-editor' : 'race-surface'
      };
    });
  }

  setSelectedGroundTileId(tileId) {
    const road = this.ensureRaceRoadAuthoringData();
    if (!road) return false;
    const choices = this.getRaceGroundTileChoices();
    const choice = choices.find((tile) => tile.id === tileId) || choices[0];
    road.selectedGroundTileId = choice.id;
    this.status = `Ground tile: ${choice.label}`;
    return true;
  }

  getSelectedGroundTileId() {
    const road = this.ensureRaceRoadAuthoringData();
    return road?.selectedGroundTileId || 'grass';
  }

  cycleSelectedGroundTile() {
    const road = this.ensureRaceRoadAuthoringData();
    if (!road) return;
    const choices = this.getRaceGroundTileChoices();
    const currentIndex = Math.max(0, choices.findIndex((tile) => tile.id === road.selectedGroundTileId));
    road.selectedGroundTileId = choices[(currentIndex + 1) % choices.length].id;
    this.status = `Ground tile: ${choices[(currentIndex + 1) % choices.length].label}`;
  }

  setSelectedSegmentEdgeTile(tileId = this.getSelectedGroundTileId()) {
    const segment = this.selectedSegment;
    if (!segment) return;
    segment.edgeTileId = tileId;
    const tile = this.getRaceGroundTileChoices().find((entry) => entry.id === tileId);
    this.status = `Segment edge tile: ${tile?.label || tileId}`;
  }

  setSelectedSurface(surfaceId) {
    const segment = this.selectedSegment;
    if (!segment) return;
    segment.surface = getSurfaceById(surfaceId).id;
    if (segment.surface === 'snow' && !segment.snowCondition) segment.snowCondition = this.getSnowConditionById().id;
  }

  selectAdjacentRaceSegment(delta = 0) {
    const segments = this.selectedRace?.road?.segments || [];
    if (!segments.length) return;
    this.selectedSegmentIndex = clamp(
      Math.round(Number(this.selectedSegmentIndex) || 0) + Math.sign(Number(delta) || 0),
      0,
      segments.length - 1
    );
    this.status = `Selected segment ${this.selectedSegmentIndex + 1}/${segments.length}`;
  }

  cycleSelectedSurface() {
    const segment = this.selectedSegment;
    if (!segment) return;
    const currentIndex = Math.max(0, RACE_SURFACES.findIndex((surface) => surface.id === segment.surface));
    segment.surface = RACE_SURFACES[(currentIndex + 1) % RACE_SURFACES.length].id;
    if (segment.surface === 'snow' && !segment.snowCondition) segment.snowCondition = this.getSnowConditionById().id;
    this.status = `Surface: ${getSurfaceById(segment.surface).label}`;
  }

  getRaceGroundTilePalette(tileId, fallbackSurfaceId = 'grass') {
    const id = tileId || fallbackSurfaceId || 'grass';
    const surfaceGroundPalettes = {
      grass: { groundA: '#315734', groundB: '#244629', line: '#1b3320', label: 'Grass' },
      asphalt: { groundA: '#23282b', groundB: '#15191c', line: '#0a0d0f', label: 'Asphalt' },
      'wet-asphalt': { groundA: '#263946', groundB: '#1b2b36', line: '#101a21', label: 'Wet Asphalt' },
      dirt: { groundA: '#7a5633', groundB: '#5f4128', line: '#3f2a1b', label: 'Dirt' },
      gravel: { groundA: '#70706b', groundB: '#52534f', line: '#3f403d', label: 'Gravel' },
      snow: { groundA: '#d7e5ec', groundB: '#b8cbd5', line: '#8ca9b7', label: 'Snow' }
    };
    if (surfaceGroundPalettes[id]) return surfaceGroundPalettes[id];
    const surface = RACE_SURFACES.find((entry) => entry.id === id);
    if (surface) {
      return {
        groundA: surface.colorA,
        groundB: surface.colorB,
        line: surface.colorB,
        label: surface.label
      };
    }
    const palettes = {
      grass: { groundA: '#315734', groundB: '#244629', line: '#1b3320', label: 'Grass' },
      solid: { groundA: '#6a7170', groundB: '#4f5756', line: '#39403f', label: 'Solid Block' },
      ice: { groundA: '#b9dcea', groundB: '#8fb9c8', line: '#6b9cad', label: 'Ice Block' },
      snow: { groundA: '#d7e5ec', groundB: '#b8cbd5', line: '#8ca9b7', label: 'Snow Block' },
      'ice-solid': { groundA: '#c8edf8', groundB: '#9bc6d5', line: '#6f9daf', label: 'Icy Solid Block' },
      'sand-solid': { groundA: '#b69a62', groundB: '#8d7447', line: '#6b5734', label: 'Sand Block' },
      'rock-solid': { groundA: '#70706b', groundB: '#52534f', line: '#3f403d', label: 'Rock Block' },
      metal: { groundA: '#66737b', groundB: '#46545d', line: '#303c43', label: 'Metal Plate' },
      water: { groundA: '#23628a', groundB: '#174a6e', line: '#10354f', label: 'Water' },
      lava: { groundA: '#b43a24', groundB: '#732319', line: '#4e1510', label: 'Lava' }
    };
    return palettes[id] || palettes.grass;
  }

  getRaceGroundPaintAt(nx = 0, ny = 0) {
    const road = this.ensureRaceRoadAuthoringData();
    const patches = road?.groundTiles || [];
    for (let index = patches.length - 1; index >= 0; index -= 1) {
      const patch = patches[index];
      const radius = Number(patch.radius) || 0.085;
      if (Math.hypot(nx - Number(patch.x || 0), ny - Number(patch.y || 0)) <= radius) return patch;
    }
    return null;
  }

  getRaceGroundPaintAtWorldPoint(worldPoint = null) {
    if (!worldPoint) return null;
    const rawPoints = this.getRaceRawMapPoints();
    if (!rawPoints.length) return null;
    const minX = Math.min(...rawPoints.map((point) => Number(point.x || 0)));
    const maxX = Math.max(...rawPoints.map((point) => Number(point.x || 0)));
    const minY = Math.min(...rawPoints.map((point) => Number(point.y || 0)));
    const maxY = Math.max(...rawPoints.map((point) => Number(point.y || 0)));
    const nx = clamp((Number(worldPoint.x || 0) - minX) / Math.max(1, maxX - minX), 0, 1);
    const ny = clamp((Number(worldPoint.z ?? worldPoint.y ?? 0) - minY) / Math.max(1, maxY - minY), 0, 1);
    return this.getRaceGroundPaintAt(nx, ny);
  }

  getRaceGroundElevationAtWorldPoint(worldPoint = null, fallbackElevation = 0) {
    const patch = this.getRaceGroundPaintAtWorldPoint(worldPoint);
    if (patch && Number.isFinite(Number(patch.elevation))) return Number(patch.elevation);
    return clamp(Number(fallbackElevation) || 0, -0.42, 0.42);
  }

  getRaceTerrainSampleAtPoint(screenX = 0, screenY = 0, bounds = this.raceMapBounds, points = null) {
    const mapPoints = points || (bounds ? this.getRaceMapPoints(bounds) : []);
    if (!bounds || mapPoints.length < 2) return { elevation: 0, distance: Infinity, segmentIndex: 0 };
    let best = { distance: Infinity, elevation: 0, segmentIndex: 0, t: 0 };
    for (let index = 1; index < mapPoints.length; index += 1) {
      const a = mapPoints[index - 1];
      const b = mapPoints[index];
      const dx = b.screenX - a.screenX;
      const dy = b.screenY - a.screenY;
      const lengthSq = dx * dx + dy * dy || 1;
      const t = clamp(((screenX - a.screenX) * dx + (screenY - a.screenY) * dy) / lengthSq, 0, 1);
      const px = a.screenX + dx * t;
      const py = a.screenY + dy * t;
      const distance = Math.hypot(screenX - px, screenY - py);
      if (distance < best.distance) {
        const fromElevation = Number(a.elevation) || 0;
        const toElevation = Number(b.elevation) || 0;
        best = {
          distance,
          elevation: fromElevation + (toElevation - fromElevation) * t,
          segmentIndex: index - 1,
          t
        };
      }
    }
    const falloff = clamp(1 - best.distance / Math.max(80, Math.min(bounds.w, bounds.h) * 0.32), 0, 1);
    return {
      ...best,
      elevation: best.elevation * falloff
    };
  }

  getNearestRaceMapPoint(screenX = 0, screenY = 0, points = []) {
    return points.reduce((best, point) => {
      const distance = Math.hypot(point.screenX - screenX, point.screenY - screenY);
      return distance < best.distance ? { distance, point } : best;
    }, { distance: Infinity, point: points[0] });
  }

  paintRaceGroundAtPoint(point = {}) {
    const road = this.ensureRaceRoadAuthoringData();
    if (!road || !this.raceMapBounds) return false;
    const bounds = this.raceMapBounds;
    if (
      point.x < bounds.x
      || point.x > bounds.x + bounds.w
      || point.y < bounds.y
      || point.y > bounds.y + bounds.h
    ) return false;
    const nx = clamp((point.x - bounds.x) / Math.max(1, bounds.w), 0, 1);
    const ny = clamp((point.y - bounds.y) / Math.max(1, bounds.h), 0, 1);
    const terrain = this.getRaceTerrainSampleAtPoint(point.x, point.y, bounds);
    const tileId = this.getSelectedGroundTileId();
    const existing = road.groundTiles.find((patch) => (
      Math.hypot(nx - Number(patch.x || 0), ny - Number(patch.y || 0)) < 0.04
    ));
    const patch = {
      x: Math.round(nx * 1000) / 1000,
      y: Math.round(ny * 1000) / 1000,
      radius: 0.09,
      tileId,
      source: 'tile-editor',
      tileLabel: this.getRaceTileDefinition(tileId)?.label || this.getRaceGroundTilePalette(tileId).label,
      segmentIndex: clamp(Math.round(Number(terrain.segmentIndex) || 0), 0, (this.selectedRace?.road?.segments?.length || 1) - 1),
      elevation: clamp(Number(terrain.elevation || 0), -0.42, 0.42)
    };
    if (existing) Object.assign(existing, patch);
    else road.groundTiles.push(patch);
    const tile = this.getRaceGroundTileChoices().find((entry) => entry.id === tileId);
    this.status = `Painted ground: ${tile?.label || tileId}`;
    return true;
  }

  paintRaceElevationAtPoint(point = {}, direction = this.raceElevationBrushDirection) {
    const road = this.ensureRaceRoadAuthoringData();
    if (!road || !this.raceMapBounds) return false;
    const bounds = this.raceMapBounds;
    if (
      point.x < bounds.x
      || point.x > bounds.x + bounds.w
      || point.y < bounds.y
      || point.y > bounds.y + bounds.h
    ) return false;
    const nx = clamp((point.x - bounds.x) / Math.max(1, bounds.w), 0, 1);
    const ny = clamp((point.y - bounds.y) / Math.max(1, bounds.h), 0, 1);
    const brushRadius = clamp(Number(this.raceElevationBrushSize) || 0.1, 0.04, 0.22);
    const terrain = this.getRaceTerrainSampleAtPoint(point.x, point.y, bounds);
    const tileId = this.getSelectedGroundTileId();
    const existing = road.groundTiles.find((patch) => (
      Math.hypot(nx - Number(patch.x || 0), ny - Number(patch.y || 0)) < brushRadius * 0.48
    ));
    const currentElevation = existing
      ? Number(existing.elevation || 0)
      : Number(terrain.elevation || 0);
    const nextElevation = Math.round(clamp(
      currentElevation + Math.sign(Number(direction) || 1) * 0.055,
      -0.42,
      0.42
    ) * 100) / 100;
    const patch = {
      x: Math.round(nx * 1000) / 1000,
      y: Math.round(ny * 1000) / 1000,
      radius: brushRadius,
      tileId: existing?.tileId || tileId,
      source: 'height-brush',
      tileLabel: existing?.tileLabel || this.getRaceTileDefinition(tileId)?.label || this.getRaceGroundTilePalette(tileId).label,
      segmentIndex: clamp(Math.round(Number(terrain.segmentIndex) || 0), 0, (this.selectedRace?.road?.segments?.length || 1) - 1),
      elevation: nextElevation
    };
    if (existing) Object.assign(existing, patch);
    else road.groundTiles.push(patch);
    this.status = `Elevation brush ${nextElevation.toFixed(2)} (${Math.round(brushRadius * 100)}%)`;
    return true;
  }

  cycleRacePortraitMode() {
    const modes = ['race', 'ground', 'elevation'];
    const index = Math.max(0, modes.indexOf(this.racePortraitMode));
    this.setRacePortraitMode(modes[(index + 1) % modes.length]);
  }

  setRacePortraitMode(mode = 'race') {
    const resolved = ['race', 'ground', 'elevation'].includes(mode) ? mode : 'race';
    this.racePortraitMode = resolved;
    if (resolved === 'ground') {
      this.activeAction = 'paint-ground';
      this.activeRootId = 'ground';
      this.status = `Ground mode: paint ${this.getRaceGroundTilePalette(this.getSelectedGroundTileId()).label}`;
    } else if (resolved === 'elevation') {
      this.activeAction = 'paint-elevation';
      this.activeRootId = 'elevation';
      this.status = `Elevation mode: brush ${Math.round(this.raceElevationBrushSize * 100)}%`;
    } else {
      this.activeAction = 'move-node';
      this.activeRootId = 'race';
      this.status = 'Race mode: drag nodes or select edges';
    }
  }

  setRaceDrawNodeMode() {
    this.racePortraitMode = 'race';
    this.activeAction = 'draw-road';
    this.activeRootId = 'race';
    this.raceSelectionType = 'node';
    this.status = 'Race mode: tap the map to add a node';
  }

  getRacePortraitContextAction() {
    if (this.mode === 'car') {
      return { id: 'test-drive', label: 'Play', onClick: () => this.handleMenuAction('test-drive') };
    }
    if (this.racePortraitMode === 'ground') {
      return { id: 'ground-tile-next', label: 'Tile', onClick: () => this.handleMenuAction('ground-tile-next') };
    }
    if (this.racePortraitMode === 'elevation') {
      return { id: 'elevation-brush-size', label: 'Brush', onClick: () => this.handleMenuAction('elevation-brush-size') };
    }
    return { id: 'draw-road', label: 'Add', onClick: () => this.setRaceDrawNodeMode() };
  }

  cycleRaceElevationBrushSize() {
    const sizes = [0.06, 0.1, 0.16, 0.22];
    const currentIndex = sizes.findIndex((size) => Math.abs(size - Number(this.raceElevationBrushSize || 0)) < 0.01);
    this.raceElevationBrushSize = sizes[(currentIndex + 1 + sizes.length) % sizes.length];
    this.racePortraitMode = 'elevation';
    this.activeAction = 'paint-elevation';
    this.activeRootId = 'elevation';
    this.status = `Elevation brush ${Math.round(this.raceElevationBrushSize * 100)}%`;
  }

  setRaceElevationBrushDirection(direction = 1) {
    this.raceElevationBrushDirection = Math.sign(Number(direction) || 1);
    this.racePortraitMode = 'elevation';
    this.activeAction = 'paint-elevation';
    this.activeRootId = 'elevation';
    this.status = this.raceElevationBrushDirection > 0 ? 'Elevation mode: raise terrain' : 'Elevation mode: lower terrain';
  }

  removeSelectedRaceNode() {
    const road = this.selectedRace?.road;
    const nodes = this.getRaceEditableNodes({ create: true });
    if (!road || nodes.length <= 2) return false;
    const nodeIndex = clamp(Math.round(Number(this.selectedSegmentIndex) || 0) + 1, 1, nodes.length - 1);
    nodes.splice(nodeIndex, 1);
    if (Array.isArray(road.segments) && road.segments.length > 1) {
      road.segments.splice(clamp(nodeIndex - 1, 0, road.segments.length - 1), 1);
    }
    this.selectedSegmentIndex = clamp(nodeIndex - 1, 0, Math.max(0, (road.segments?.length || 1) - 1));
    this.raceSelectionType = 'node';
    this.status = `Removed node ${nodeIndex}`;
    return true;
  }

  removeSelectedRaceEdge() {
    const road = this.selectedRace?.road;
    if (!road?.segments || road.segments.length <= 1) return false;
    const removeAt = clamp(Math.round(Number(this.selectedSegmentIndex) || 0), 0, road.segments.length - 1);
    road.segments.splice(removeAt, 1);
    if (Array.isArray(road.nodes) && road.nodes.length > 2) {
      road.nodes.splice(clamp(removeAt + 1, 1, road.nodes.length - 1), 1);
    }
    this.selectedSegmentIndex = clamp(removeAt, 0, Math.max(0, road.segments.length - 1));
    this.raceSelectionType = 'edge';
    this.status = `Removed edge ${removeAt + 1}`;
    return true;
  }

  insertRaceNodeAfterSelectedEdge() {
    const road = this.selectedRace?.road;
    const nodes = this.ensureRaceSegmentNodes();
    if (!road || !Array.isArray(road.segments) || !road.segments.length || nodes.length < 2) return false;
    const segmentIndex = clamp(Math.round(Number(this.selectedSegmentIndex) || 0), 0, road.segments.length - 1);
    const from = nodes[segmentIndex];
    const to = nodes[segmentIndex + 1];
    const segment = road.segments[segmentIndex];
    if (!from || !to || !segment) return false;
    const midpoint = {
      x: Math.round((Number(from.x || 0) + Number(to.x || 0)) / 2),
      y: Math.round((Number(from.y || 0) + Number(to.y || 0)) / 2),
      elevation: Math.round(((Number(from.elevation || 0) + Number(to.elevation || 0)) / 2) * 100) / 100
    };
    const nextSegment = this.cloneRaceSegment(segment);
    const halfLength = Math.max(35, Math.round((Number(segment.length) || Math.hypot(
      Number(to.x || 0) - Number(from.x || 0),
      Number(to.y || 0) - Number(from.y || 0)
    )) / 2));
    segment.length = halfLength;
    nextSegment.length = halfLength;
    nodes.splice(segmentIndex + 1, 0, midpoint);
    road.segments.splice(segmentIndex + 1, 0, nextSegment);
    this.selectedSegmentIndex = segmentIndex + 1;
    this.raceSelectionType = 'node';
    this.status = `Inserted node ${segmentIndex + 2}`;
    return true;
  }

  snapSelectedRaceNodeToStart() {
    const nodes = this.ensureRaceSegmentNodes();
    if (!nodes.length) return false;
    const nodeIndex = clamp(Math.round(Number(this.selectedSegmentIndex) || 0) + 1, 1, nodes.length - 1);
    if (nodeIndex !== nodes.length - 1) {
      this.status = 'Only the finish node can snap to Start';
      return false;
    }
    const start = nodes[0];
    const node = nodes[nodeIndex];
    node.x = Number(start.x || 0);
    node.y = Number(start.y || 0);
    node.elevation = Number(start.elevation || 0);
    this.syncRaceSegmentFromNodePair(nodeIndex - 1);
    this.raceSelectionType = 'node';
    this.status = 'Connected finish to Start: route is now a circuit';
    return true;
  }

  getRaceStartSnapWorldRange() {
    return Math.max(28, this.getRaceRoadHalfWidthWorld() * 2.2, this.getRaceCarWorldWidth() * 2.8);
  }

  maybeSnapRaceNodeToStart(nodeIndex = -1) {
    const nodes = this.getRaceEditableNodes();
    if (!Array.isArray(nodes) || nodes.length < 2 || nodeIndex !== nodes.length - 1) return false;
    const start = nodes[0];
    const node = nodes[nodeIndex];
    if (!start || !node) return false;
    const distance = Math.hypot(Number(node.x || 0) - Number(start.x || 0), Number(node.y || 0) - Number(start.y || 0));
    if (distance > this.getRaceStartSnapWorldRange()) return false;
    node.x = Number(start.x || 0);
    node.y = Number(start.y || 0);
    node.elevation = Number(start.elevation || 0);
    this.syncRaceSegmentFromNodePair(nodeIndex - 1);
    return true;
  }

  syncRaceSegmentFromNodePair(segmentIndex, { screenY = null } = {}) {
    const segment = this.selectedRace?.road?.segments?.[segmentIndex];
    const nodes = this.getRaceEditableNodes();
    const node = nodes[segmentIndex + 1];
    const previous = nodes[segmentIndex] || nodes[0];
    const beforePrevious = nodes[segmentIndex - 1] || previous;
    if (!segment || !node || !previous) return false;
    const dx = Number(node.x || 0) - Number(previous.x || 0);
    const dy = Number(node.y || 0) - Number(previous.y || 0);
    const previousDx = Number(previous.x || 0) - Number(beforePrevious.x || 0);
    const previousDy = Number(previous.y || 0) - Number(beforePrevious.y || 0);
    const length = Math.max(35, Math.hypot(dx, dy));
    const yaw = Math.atan2(dx, dy);
    const previousYaw = Math.atan2(previousDx, previousDy);
    segment.length = Math.round(length);
    segment.curve = Math.round(clamp(normalizeAngle(yaw - previousYaw) / 0.78, -1, 1) * 100) / 100;
    if (screenY !== null && this.raceMapBounds) {
      segment.elevation = Math.round(clamp(
        -((screenY - (this.raceNodeDrag?.startY ?? screenY)) / Math.max(90, this.raceMapBounds.h * 0.28))
          + (this.raceNodeDrag?.elevation ?? (Number(segment.elevation) || 0)),
        -0.42,
        0.42
      ) * 100) / 100;
    } else {
      segment.elevation = clamp(Number(node.elevation ?? segment.elevation) || 0, -0.42, 0.42);
    }
    node.elevation = segment.elevation;
    return true;
  }

  appendRaceNodeAtPoint(point = {}) {
    const road = this.selectedRace?.road;
    if (!road || !this.raceMapBounds) return false;
    const worldPoint = this.screenToRaceMapWorldPoint(point.x, point.y, this.raceMapBounds);
    if (!worldPoint) return false;
    const nodes = this.getRaceEditableNodes().map((node) => ({ ...node }));
    if (!nodes.length) return false;
    road.segments = Array.isArray(road.segments) ? road.segments : [];
    const previous = nodes[nodes.length - 1];
    const beforePrevious = nodes[nodes.length - 2] || previous;
    const dx = Number(worldPoint.x || 0) - Number(previous.x || 0);
    const dy = Number(worldPoint.y || 0) - Number(previous.y || 0);
    const previousDx = Number(previous.x || 0) - Number(beforePrevious.x || 0);
    const previousDy = Number(previous.y || 0) - Number(beforePrevious.y || 0);
    const yaw = Math.atan2(dx, dy);
    const previousYaw = Math.atan2(previousDx, previousDy);
    const segment = this.cloneRaceSegment(road.segments[road.segments.length - 1]);
    segment.length = Math.round(Math.max(35, Math.hypot(dx, dy)));
    segment.curve = Math.round(clamp(normalizeAngle(yaw - previousYaw) / 0.78, -1, 1) * 100) / 100;
    segment.elevation = clamp(Number(segment.elevation) || 0, -0.42, 0.42);
    road.segments.push(segment);
    nodes.push({
      x: Math.round(Number(worldPoint.x || 0)),
      y: Math.round(Number(worldPoint.y || 0)),
      elevation: segment.elevation
    });
    road.nodes = nodes;
    this.selectedSegmentIndex = road.segments.length - 1;
    this.raceSelectionType = 'node';
    const snappedToStart = this.maybeSnapRaceNodeToStart(nodes.length - 1);
    const screenPoints = this.getRaceMapPoints(this.raceMapBounds);
    const nodeIndex = screenPoints.length - 1;
    this.raceNodeDrag = {
      id: point.id ?? 'pointer',
      nodeIndex,
      segmentIndex: this.selectedSegmentIndex,
      startX: point.x,
      startY: point.y,
      previousPoint: screenPoints[nodeIndex - 1],
      startDistance: 0,
      length: segment.length,
      curve: segment.curve,
      elevation: segment.elevation
    };
    this.status = snappedToStart
      ? 'Connected destination to Start: route is now a circuit'
      : `Added track node ${this.selectedSegmentIndex + 1} (dragging)`;
    return true;
  }

  getRaceMapNodeAtPoint(point = {}) {
    if (!this.raceMapBounds || this.mode !== 'race' || this.playtestSession) return null;
    const bounds = this.raceMapBounds;
    if (
      point.x < bounds.x
      || point.x > bounds.x + bounds.w
      || point.y < bounds.y
      || point.y > bounds.y + bounds.h
    ) return null;
    const points = this.getRaceMapPoints(bounds);
    let best = { distance: Infinity, point: null, nodeIndex: null };
    for (let index = 1; index < points.length; index += 1) {
      const distance = Math.hypot(point.x - points[index].screenX, point.y - points[index].screenY);
      if (distance < best.distance) best = { distance, point: points[index], nodeIndex: index };
    }
    const radius = Math.max(16, Math.min(bounds.w, bounds.h) * 0.045);
    return best.nodeIndex !== null && best.distance <= radius ? best : null;
  }

  getRaceMapSegmentHitAtPoint(point = {}) {
    if (!this.raceMapBounds || this.mode !== 'race' || this.playtestSession) return null;
    const bounds = this.raceMapBounds;
    if (
      point.x < bounds.x
      || point.x > bounds.x + bounds.w
      || point.y < bounds.y
      || point.y > bounds.y + bounds.h
    ) return null;
    const points = this.getRaceMapPoints(bounds);
    let best = { distance: Infinity, index: null };
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1];
      const b = points[index];
      const dx = b.screenX - a.screenX;
      const dy = b.screenY - a.screenY;
      const lengthSq = dx * dx + dy * dy || 1;
      const t = clamp(((point.x - a.screenX) * dx + (point.y - a.screenY) * dy) / lengthSq, 0, 1);
      const px = a.screenX + dx * t;
      const py = a.screenY + dy * t;
      const distance = Math.hypot(point.x - px, point.y - py);
      if (distance < best.distance) best = { distance, index: index - 1 };
    }
    const radius = Math.max(22, Math.min(bounds.w, bounds.h) * 0.08);
    return best.index !== null && best.distance <= radius ? best : null;
  }

  applySelectedEdgeTileAtPoint(point = {}) {
    const hit = this.getRaceMapSegmentHitAtPoint(point);
    if (!hit) return false;
    this.selectedSegmentIndex = clamp(hit.index, 0, (this.selectedRace?.road?.segments?.length || 1) - 1);
    this.setSelectedSegmentEdgeTile(this.getSelectedGroundTileId());
    this.status = `Segment ${this.selectedSegmentIndex + 1} edge: ${this.getRaceGroundTilePalette(this.getSelectedGroundTileId()).label}`;
    return true;
  }

  beginRaceNodeDrag(point = {}) {
    const hit = this.getRaceMapNodeAtPoint(point);
    if (!hit) return false;
    this.getRaceEditableNodes();
    const segmentIndex = clamp(hit.nodeIndex - 1, 0, (this.selectedRace?.road?.segments?.length || 1) - 1);
    const segment = this.selectedRace.road.segments[segmentIndex];
    const points = this.getRaceMapPoints(this.raceMapBounds);
    this.selectedSegmentIndex = segmentIndex;
    this.raceSelectionType = 'node';
    this.raceNodeDrag = {
      id: point.id ?? 'pointer',
      nodeIndex: hit.nodeIndex,
      segmentIndex,
      startX: point.x,
      startY: point.y,
      previousPoint: points[hit.nodeIndex - 1],
      startDistance: Math.hypot(point.x - points[hit.nodeIndex - 1].screenX, point.y - points[hit.nodeIndex - 1].screenY),
      length: Number(segment.length) || 120,
      curve: Number(segment.curve) || 0,
      elevation: Number(segment.elevation) || 0
    };
    this.status = `Selected track node ${segmentIndex + 1} (dragging)`;
    return true;
  }

  updateRaceNodeDrag(point = {}) {
    if (!this.raceNodeDrag || this.raceNodeDrag.id !== (point.id ?? 'pointer')) return false;
    const segment = this.selectedRace?.road?.segments?.[this.raceNodeDrag.segmentIndex];
    const nodes = this.getRaceEditableNodes();
    const node = nodes[this.raceNodeDrag.nodeIndex];
    if (!segment || !node || !this.raceMapBounds) return true;
    const worldPoint = this.screenToRaceMapWorldPoint(point.x, point.y, this.raceMapBounds);
    if (!worldPoint) return true;
    node.x = Math.round(worldPoint.x);
    node.y = Math.round(worldPoint.y);
    this.syncRaceSegmentFromNodePair(this.raceNodeDrag.segmentIndex, { screenY: point.y });
    const snappedToStart = this.maybeSnapRaceNodeToStart(this.raceNodeDrag.nodeIndex);
    this.status = snappedToStart
      ? 'Connected destination to Start: route is now a circuit'
      : `Node ${this.raceNodeDrag.segmentIndex + 1}: x ${node.x}, y ${node.y}, elevation ${segment.elevation.toFixed(2)}`;
    return true;
  }

  getRaceGeneratedRawPoints() {
    const segments = this.selectedRace?.road?.segments || [];
    const rawPoints = [{ x: 0, y: 0, elevation: 0, surface: segments[0]?.surface || 'asphalt', segmentIndex: 0 }];
    let x = 0;
    let y = 0;
    let heading = 0;
    segments.forEach((segment, index) => {
      const length = Math.max(35, Number(segment.length) || 100);
      const curve = clamp(Number(segment.curve) || 0, -1, 1);
      const turnBoost = segment.turn === 'square' ? 0.78 : 0;
      heading += curve * 0.55 + Math.sign(curve) * turnBoost;
      x += Math.sin(heading) * length;
      y += Math.cos(heading) * length;
      rawPoints.push({
        x,
        y,
        elevation: clamp(Number(segment.elevation) || 0, -0.42, 0.42),
        surface: segment.surface || 'asphalt',
        segmentIndex: index
      });
    });
    return rawPoints;
  }

  areRaceNodesCompatible(nodes = this.selectedRace?.road?.nodes, segments = this.selectedRace?.road?.segments || []) {
    return Array.isArray(nodes) && nodes.length >= 1 && nodes.length <= segments.length + 1;
  }

  ensureRaceStartNodeMetadata(nodes = this.selectedRace?.road?.nodes) {
    if (!Array.isArray(nodes) || !nodes.length) return nodes;
    nodes[0] = {
      ...nodes[0],
      role: 'start',
      locked: true
    };
    return nodes;
  }

  getRaceEditableNodes({ create = true } = {}) {
    const road = this.selectedRace?.road;
    const segments = road?.segments || [];
    if (!road || !segments.length) return [];
    if (this.areRaceNodesCompatible(road.nodes, segments)) {
      return this.ensureRaceStartNodeMetadata(road.nodes);
    }
    if (!create) return [];
    road.nodes = this.getRaceGeneratedRawPoints().map((point) => ({
      x: Math.round(Number(point.x || 0)),
      y: Math.round(Number(point.y || 0)),
      elevation: clamp(Number(point.elevation) || 0, -0.42, 0.42)
    }));
    return this.ensureRaceStartNodeMetadata(road.nodes);
  }

  ensureRaceSegmentNodes() {
    const road = this.selectedRace?.road;
    const segments = road?.segments || [];
    if (!road || !segments.length) return [];
    if (Array.isArray(road.nodes) && road.nodes.length >= segments.length + 1) {
      return this.ensureRaceStartNodeMetadata(road.nodes);
    }
    road.nodes = this.getRaceGeneratedRawPoints().map((point) => ({
      x: Math.round(Number(point.x || 0)),
      y: Math.round(Number(point.y || 0)),
      elevation: clamp(Number(point.elevation) || 0, -0.42, 0.42)
    }));
    return this.ensureRaceStartNodeMetadata(road.nodes);
  }

  getRaceRawMapPoints() {
    const nodes = this.getRaceEditableNodes({ create: false });
    if (nodes.length >= 2) {
      const segments = this.selectedRace?.road?.segments || [];
      return nodes.map((node, index) => ({
        x: Number(node.x || 0),
        y: Number(node.y || 0),
        elevation: clamp(Number(node.elevation) || 0, -0.42, 0.42),
        surface: segments[Math.max(0, index - 1)]?.surface || segments[0]?.surface || 'asphalt',
        segmentIndex: Math.max(0, index - 1)
      }));
    }
    return this.getRaceGeneratedRawPoints();
  }

  getRaceMapTransform(bounds, rawPoints = this.getRaceRawMapPoints()) {
    const minX = Math.min(...rawPoints.map((point) => point.x));
    const maxX = Math.max(...rawPoints.map((point) => point.x));
    const minY = Math.min(...rawPoints.map((point) => point.y));
    const maxY = Math.max(...rawPoints.map((point) => point.y));
    const pad = Math.max(24, Math.min(bounds.w, bounds.h) * 0.1);
    const usableW = Math.max(1, bounds.w - pad * 2);
    const usableH = Math.max(1, bounds.h - pad * 2);
    const fitScale = Math.min(
      usableW / Math.max(1, maxX - minX),
      usableH / Math.max(1, maxY - minY)
    );
    const zoom = clamp(Number(this.raceMapZoom) || 1, 0.5, 3);
    const panX = Number(this.raceMapPan?.x || 0);
    const panY = Number(this.raceMapPan?.y || 0);
    const scale = fitScale * zoom;
    return { minX, minY, maxX, maxY, pad, usableW, usableH, scale, fitScale, zoom, panX, panY };
  }

  getRaceMapPoints(bounds) {
    const rawPoints = this.getRaceRawMapPoints();
    const { minX, minY, maxX, maxY, pad, usableW, usableH, scale, panX, panY } = this.getRaceMapTransform(bounds, rawPoints);
    return rawPoints.map((point) => ({
      ...point,
      screenX: bounds.x + pad + (point.x - minX) * scale + (usableW - (maxX - minX) * scale) / 2 + panX,
      screenY: bounds.y + pad + (point.y - minY) * scale + (usableH - (maxY - minY) * scale) / 2 + panY
    }));
  }

  screenToRaceMapWorldPoint(screenX = 0, screenY = 0, bounds = this.raceMapBounds) {
    if (!bounds) return null;
    const rawPoints = this.getRaceRawMapPoints();
    if (!rawPoints.length) return null;
    const { minX, minY, maxX, maxY, pad, usableW, usableH, scale, panX, panY } = this.getRaceMapTransform(bounds, rawPoints);
    const offsetX = (usableW - (maxX - minX) * scale) / 2;
    const offsetY = (usableH - (maxY - minY) * scale) / 2;
    return {
      x: minX + (screenX - bounds.x - pad - offsetX - panX) / Math.max(0.0001, scale),
      y: minY + (screenY - bounds.y - pad - offsetY - panY) / Math.max(0.0001, scale)
    };
  }

  getRaceMapZoomRatio() {
    return clamp(((Number(this.raceMapZoom) || 1) - 0.5) / 2.5, 0, 1);
  }

  updateRaceMapZoomFromSliderX(pointerX = 0) {
    const bounds = this.raceMapZoomSliderBounds;
    if (!bounds || bounds.w <= 0) return false;
    const ratio = clamp((Number(pointerX || 0) - bounds.x) / Math.max(1, bounds.w), 0, 1);
    this.raceMapZoom = Math.round((0.5 + ratio * 2.5) * 100) / 100;
    this.status = `Map zoom ${Math.round(this.raceMapZoom * 100)}%`;
    return true;
  }

  panRaceMapBy(dx = 0, dy = 0) {
    this.raceMapPan = {
      x: clamp(Number(this.raceMapPan?.x || 0) + Number(dx || 0), -1200, 1200),
      y: clamp(Number(this.raceMapPan?.y || 0) + Number(dy || 0), -1200, 1200)
    };
    return true;
  }

  updateRaceMapThumbstickDeflection(point = {}) {
    const radius = Math.max(1, Number(this.portraitThumbstick?.radius || 0));
    const center = this.portraitThumbstick?.center || { x: 0, y: 0 };
    this.portraitThumbstick.dx = clamp(Number(point.x || 0) - center.x, -radius, radius);
    this.portraitThumbstick.dy = clamp(Number(point.y || 0) - center.y, -radius, radius);
  }

  updateRaceMapThumbstickPan(dt = 0) {
    if (!this.raceMapThumbstickDrag || !this.portraitThumbstick?.active) return false;
    const radius = Math.max(1, Number(this.portraitThumbstick.radius || 0));
    const x = clamp(Number(this.portraitThumbstick.dx || 0) / radius, -1, 1);
    const y = clamp(Number(this.portraitThumbstick.dy || 0) / radius, -1, 1);
    const magnitude = Math.hypot(x, y);
    const deadZone = 0.12;
    if (magnitude <= deadZone) return false;
    const normalized = (magnitude - deadZone) / (1 - deadZone);
    const speed = 420 * normalized;
    const seconds = Math.max(0, Number(dt || 0));
    this.panRaceMapBy(-x * speed * seconds, -y * speed * seconds);
    return true;
  }

  resetRaceMapViewport() {
    this.raceMapZoom = 1;
    this.raceMapPan = { x: 0, y: 0 };
    this.status = 'Map view reset';
  }

  selectRaceMapSegmentAtPoint(point = {}) {
    const hit = this.getRaceMapSegmentHitAtPoint(point);
    if (!hit) return false;
    this.selectedSegmentIndex = clamp(hit.index, 0, (this.selectedRace?.road?.segments?.length || 1) - 1);
    this.raceSelectionType = 'edge';
    this.status = `Selected edge ${this.selectedSegmentIndex + 1}`;
    return true;
  }

  generateRandomRace() {
    const race = this.selectedRace;
    if (!race) return;
    const baseProfiles = [
      { label: 'Easy right', curve: 0.25, length: 180, severity: 1 },
      { label: 'Medium right', curve: 0.52, length: 145, severity: 2 },
      { label: 'Hard right', curve: 0.78, length: 115, severity: 3 },
      { label: 'Hairpin right', curve: 1, length: 90, severity: 5, turn: 'square' },
      { label: 'Easy left', curve: -0.25, length: 180, severity: 1 },
      { label: 'Medium left', curve: -0.52, length: 145, severity: 2 },
      { label: 'Hard left', curve: -0.78, length: 115, severity: 3 },
      { label: 'Hairpin left', curve: -1, length: 90, severity: 5, turn: 'square' },
      { label: 'Crest', curve: 0.12, length: 130, severity: 3, elevation: 0.28 },
      { label: 'Dip', curve: -0.12, length: 125, severity: 2, elevation: -0.2 }
    ];
    const archetypes = [
      {
        id: 'oval',
        label: 'Oval',
        width: 22,
        weather: ['clear'],
        surfaces: ['asphalt'],
        countMin: 10,
        countMax: 12,
        curveScale: 0.28,
        elevationScale: 0.04,
        bumpiness: [0, 0.05],
        forceClosedNodes: true
      },
      {
        id: 'road-course',
        label: 'Road Course',
        width: 12,
        weather: ['clear', 'rain'],
        surfaces: ['asphalt', 'asphalt', 'wet-asphalt'],
        countMin: 14,
        countMax: 18,
        curveScale: 0.84,
        elevationScale: 0.16,
        bumpiness: [0, 0.12]
      },
      {
        id: 'sprint',
        label: 'Sprint',
        width: 11,
        weather: ['clear', 'rain'],
        surfaces: ['asphalt', 'wet-asphalt', 'dirt', 'gravel'],
        countMin: 14,
        countMax: 20,
        curveScale: 1,
        elevationScale: 0.22,
        bumpiness: [0.04, 0.22]
      },
      {
        id: 'mixed-rally',
        label: 'Mixed Rally',
        width: 8,
        weather: ['clear', 'rain', 'storm'],
        surfaces: ['gravel', 'dirt', 'wet-asphalt', 'asphalt'],
        countMin: 18,
        countMax: 25,
        curveScale: 1.12,
        elevationScale: 0.3,
        bumpiness: [0.16, 0.42]
      },
      {
        id: 'severe-rally',
        label: 'Severe Rally',
        width: 6,
        weather: ['rain', 'storm', 'snow'],
        surfaces: ['gravel', 'dirt', 'snow', 'wet-asphalt'],
        countMin: 20,
        countMax: 28,
        curveScale: 1.24,
        elevationScale: 0.38,
        bumpiness: [0.28, 0.68]
      }
    ];
    const archetype = archetypes[Math.min(archetypes.length - 1, Math.floor(Math.random() * archetypes.length))] || archetypes[2];
    const segments = [];
    const calls = [];
    const hazards = [];
    let distance = 0;
    const count = archetype.countMin + Math.floor(Math.random() * (archetype.countMax - archetype.countMin + 1));
    for (let index = 0; index < count; index += 1) {
      const profile = baseProfiles[Math.floor(Math.random() * baseProfiles.length)];
      const surface = archetype.surfaces[Math.floor(Math.random() * archetype.surfaces.length)];
      const length = Math.max(65, Math.round(profile.length + (Math.random() - 0.5) * (archetype.id.includes('rally') ? 74 : 52)));
      const elevation = profile.elevation ?? Math.round((Math.random() - 0.5) * archetype.elevationScale * 200) / 100;
      const bumpiness = archetype.bumpiness[0] + Math.random() * (archetype.bumpiness[1] - archetype.bumpiness[0]);
      const segment = {
        length,
        curve: Math.round(clamp((profile.curve + (Math.random() - 0.5) * 0.12) * archetype.curveScale, -1, 1) * 100) / 100,
        elevation: Math.round(clamp(elevation, -0.42, 0.42) * 100) / 100,
        surface,
        bumpiness: Math.round(clamp(bumpiness, 0, 1) * 100) / 100,
        hazardIds: []
      };
      if (surface === 'snow') segment.snowCondition = Math.random() > 0.48 ? 'packed' : 'slush';
      if (profile.turn) segment.turn = profile.turn;
      const callId = `random-call-${index}`;
      calls.push({
        id: callId,
        at: Math.round(distance + length * 0.42),
        text: `${profile.label}${Math.abs(segment.elevation) > 0.18 ? ' over crest' : ''}`,
        severity: profile.severity
      });
      segment.codriver = callId;
      if (Math.random() > 0.72 || Math.abs(segment.elevation) > 0.24) {
        const hazardId = `random-jump-${index}`;
        segment.hazardIds.push(hazardId);
        hazards.push({
          id: hazardId,
          type: Math.abs(segment.elevation) > 0.24 ? 'jump' : 'damage-wall',
          label: Math.abs(segment.elevation) > 0.24 ? 'Crest Jump' : 'Roadside Wall',
          at: Math.round(distance + length * 0.7),
          height: Math.abs(segment.elevation),
          damage: 10 + profile.severity * 2,
          side: segment.curve >= 0 ? 'right' : 'left'
        });
      }
      segments.push(segment);
      distance += length;
    }
    if (!segments.some((segment) => Math.abs(Number(segment.elevation) || 0) > 0.15)) {
      const crestIndex = Math.max(0, Math.floor(segments.length / 2));
      const crest = segments[crestIndex];
      crest.elevation = 0.28;
      const crestAt = segments.slice(0, crestIndex).reduce((sum, segment) => sum + Math.max(1, Number(segment.length) || 1), 0) + Math.max(1, Number(crest.length) || 1) * 0.65;
      const hazardId = `random-forced-crest-${crestIndex}`;
      crest.hazardIds = Array.from(new Set([...(crest.hazardIds || []), hazardId]));
      hazards.push({
        id: hazardId,
        type: 'jump',
        label: 'Crest Jump',
        at: Math.round(crestAt),
        height: 0.28,
        damage: 14
      });
      calls[crestIndex] = {
        ...calls[crestIndex],
        text: `${calls[crestIndex]?.text || 'Crest'} over crest`,
        severity: Math.max(3, Number(calls[crestIndex]?.severity || 0))
      };
    }
    race.name = `Random ${archetype.label} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    race.type = archetype.forceClosedNodes ? 'circuit' : 'destination';
    race.laps = archetype.forceClosedNodes ? 3 : 1;
    race.weather = archetype.weather[Math.floor(Math.random() * archetype.weather.length)] || 'clear';
    race.road = { ...race.road, width: 11, segments };
    race.road.width = archetype.width;
    if (archetype.forceClosedNodes) {
      const lane = archetype.width * 12;
      race.road.nodes = [
        { x: -lane, y: 0, elevation: 0, role: 'start', locked: true },
        { x: -lane, y: 520, elevation: 0.02 },
        { x: lane, y: 680, elevation: 0.03 },
        { x: lane * 2.15, y: 520, elevation: 0.01 },
        { x: lane * 2.15, y: 0, elevation: 0 },
        { x: lane, y: -170, elevation: 0.01 },
        { x: -lane, y: 0, elevation: 0, role: 'finish' }
      ];
    } else {
      delete race.road.nodes;
    }
    race.hazards = hazards;
    race.codriver = { enabled: true, voice: 'default', calls };
    race.competition = { ...race.competition, mode: 'solo' };
    this.project.selectedRaceId = race.id;
    this.selectedSegmentIndex = 0;
    this.status = `Generated ${segments.length}-segment ${archetype.forceClosedNodes ? 'closed-loop' : 'open-finish'} route`;
  }

  drawButton(ctx, bounds, label, active = false, disabled = false, options = {}) {
    const color = drawSharedMenuButtonChrome(ctx, bounds, {
      active,
      subtle: disabled,
      focused: Boolean(options.focused)
    });
    drawSharedMenuButtonLabel(ctx, bounds, label, {
      color: disabled ? UI_SUITE.colors.muted : color,
      fontSize: 12,
      maxWidth: Math.max(1, bounds.w - 8)
    });
  }

  draw(ctx, width, height) {
    this.buttons = [];
    this.menuScrollRegions = [];
    this.raceMapBounds = null;
    const viewportMode = this.resolveRaceViewportMode(width, height);
    this.activeModeContract = viewportMode.modeContract;
    this.activeSpecModeContract = viewportMode.specModeContract;
    this.activeViewportMode = viewportMode.mode;
    if (!viewportMode.isDesktop && this.playtestSession) {
      this.drawMobileRacePlaytest(ctx, width, height);
      return;
    }
    if (viewportMode.isDesktop) {
      this.drawDesktop(ctx, width, height);
      return;
    }
    this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });
    if (viewportMode.isMobilePortrait) {
      this.drawPortrait(ctx, width, height);
    } else {
      this.drawLandscape(ctx, width, height);
    }
  }

  resolveRaceViewportMode(width = this.game?.canvas?.width || 0, height = this.game?.canvas?.height || 0) {
    return resolveEditorViewportModeFlags({
      editorId: this.editorId,
      viewportWidth: width,
      viewportHeight: height,
      isMobile: Boolean(this.game?.deviceIsMobile || this.game?.isMobile),
      gamepadConnected: Boolean(this.game?.input?.isGamepadConnected?.())
    });
  }

  get editorId() {
    return this.mode === 'car' ? 'car' : 'race';
  }

  get title() {
    return this.mode === 'car' ? 'Car Editor' : 'Race Editor';
  }

  getMenuItems(rootId) {
    if (rootId === 'file') {
      return buildSharedEditorFileMenu({
        supported: {
          save: true,
          'save-as': true,
          open: false,
          export: false,
          import: false
        },
        actions: {
          new: () => this.handleMenuAction('new'),
          save: () => this.handleMenuAction('save'),
          'save-as': () => this.handleMenuAction('save-as')
        },
        footer: {
          onExit: () => this.exitToMainMenu()
        }
      }).map((item) => ({
        id: item.id,
        label: item.label,
        tooltip: item.tooltip,
        disabled: Boolean(item.disabled),
        divider: Boolean(item.divider),
        separator: Boolean(item.separator),
        onSelect: item.onClick || item.action || null
      }));
    }
    const spec = getEditorMenuSpec(this.editorId);
    const section = spec?.sections?.[rootId];
    const actionIds = [...(section?.actions || [])];
    if (rootId === 'drive' && this.playtestSession && !actionIds.includes('end-playtest')) {
      actionIds.unshift('end-playtest');
    }
    return actionIds.map((id) => ({
      id,
      label: id === 'end-playtest' ? 'End Drive' : (spec.actions?.[id]?.label || id),
      disabled: !this.isActionAvailable(id),
      onSelect: this.isActionAvailable(id) ? () => this.handleMenuAction(id) : null
    }));
  }

  getRaceQuickActions({ compact = false } = {}) {
    if (this.mode === 'car') {
      return [
        { id: 'test-drive', label: 'Play', onClick: () => this.handleMenuAction('test-drive') }
      ];
    }
    const actions = [
      { id: 'generate-random-race', label: 'Generate', onClick: () => this.handleMenuAction('generate-random-race') },
      { id: 'draw-road', label: compact ? 'Add' : 'Add Seg', onClick: () => this.handleMenuAction('draw-road') },
      { id: 'curve', label: 'Curve', onClick: () => this.handleMenuAction('curve') },
      { id: 'elevation', label: compact ? 'Hill' : 'Elevation', onClick: () => this.handleMenuAction('elevation') },
      { id: 'segment-width', label: compact ? 'Width' : 'Edge Width', onClick: () => this.handleMenuAction('segment-width') },
      { id: 'segment-bumpiness', label: compact ? 'Bump' : 'Bumpiness', onClick: () => this.handleMenuAction('segment-bumpiness') },
      { id: 'paint-ground', label: compact ? 'Paint' : 'Paint Ground', onClick: () => this.handleMenuAction('paint-ground') },
      { id: 'test-drive', label: 'Play', onClick: () => this.handleMenuAction('test-drive') }
    ];
    return compact ? actions.slice(0, 4) : actions;
  }

  getRailAction(id, label, onClick) {
    const available = this.isActionAvailable(id);
    return {
      id,
      label,
      disabled: !available,
      onClick: available ? onClick : null
    };
  }

  isActionAvailable(action) {
    return RACE_EDITOR_AVAILABLE_ACTIONS.has(action);
  }

  loadBuiltInRace(action) {
    const entry = BUILT_IN_RACE_LOAD_BY_ACTION[action];
    if (!entry) return false;
    const template = createTestTrackRace(entry.raceId);
    const existingIndex = this.project.races.findIndex((race) => race.id === template.id);
    if (existingIndex >= 0) {
      this.project.races[existingIndex] = template;
    } else {
      this.project.races.push(template);
    }
    this.project.selectedRaceId = template.id;
    this.selectedSegmentIndex = 0;
    this.playtestSession = null;
    this.racePortraitMode = 'race';
    this.activeRootId = 'race';
    this.resetRaceMapViewport();
    this.status = `Loaded ${template.name}`;
    return true;
  }

  handleMenuAction(action) {
    if (!this.isActionAvailable(action)) {
      this.status = `${action.replace(/-/g, ' ')} is not available yet`;
      return;
    }
    if (action === 'exit-main') {
      this.exitToMainMenu();
      return;
    }
    if (action === 'new') {
      this.project = createDefaultRaceProject();
      this.playtestSession = null;
      this.selectedSegmentIndex = 0;
      this.status = `New ${this.title} project`;
      return;
    }
    if (action === 'save' || action === 'save-as') {
      this.status = `${action === 'save-as' ? 'Save As' : 'Save'} queued for ${this.title}`;
      return;
    }
    if (action === 'test-drive') {
      this.openPlaytestPicker();
      return;
    }
    if (action === 'end-playtest') {
      this.endPlaytest();
      return;
    }
    if (this.loadBuiltInRace(action)) {
      this.activeAction = action;
      this.mobileRootOpen = false;
      this.gamepadSubmenuOpen = false;
      return;
    }
    if (action === 'move-node') {
      this.racePortraitMode = 'race';
      this.raceSelectionType = 'node';
      this.activeRootId = 'race';
      this.status = 'Move mode: drag track nodes to reshape the race';
    } else if (action === 'insert-node') {
      this.insertRaceNodeAfterSelectedEdge();
    } else if (action === 'snap-node') {
      this.snapSelectedRaceNodeToStart();
    } else if (action === 'remove-node') {
      this.removeSelectedRaceNode();
    } else if (action === 'remove-edge') {
      this.removeSelectedRaceEdge();
    } else if (action.startsWith('drivetrain-')) {
      this.selectedCar.tuning.drivetrain = action.replace('drivetrain-', '');
    } else if (action === 'engine-sound-next') {
      this.cycleCarEngineSoundProfile();
    } else if (action === 'draw-road') {
      this.appendRaceSegment();
    } else if (action === 'segment-prev') {
      this.selectAdjacentRaceSegment(-1);
    } else if (action === 'segment-next') {
      this.selectAdjacentRaceSegment(1);
    } else if (action === 'segment-length') {
      this.adjustSelectedSegment('length');
    } else if (action === 'curve') {
      this.adjustSelectedSegment('curve');
    } else if (action === 'elevation') {
      this.adjustSelectedSegment('elevation');
    } else if (action === 'paint-elevation') {
      this.setRacePortraitMode('elevation');
    } else if (action === 'elevation-up') {
      this.setRaceElevationBrushDirection(1);
    } else if (action === 'elevation-down') {
      this.setRaceElevationBrushDirection(-1);
    } else if (action === 'elevation-brush-size') {
      this.cycleRaceElevationBrushSize();
    } else if (action === 'square-turn') {
      this.toggleSelectedSquareTurn();
    } else if (action === 'road-width') {
      this.cycleRoadWidth();
    } else if (action === 'segment-width') {
      this.cycleSelectedSegmentRoadWidth();
    } else if (action === 'segment-bumpiness') {
      this.cycleSelectedSegmentBumpiness();
    } else if (action === 'snow-condition') {
      this.cycleSelectedSegmentSnowCondition();
    } else if (action === 'ground-tile-next') {
      this.cycleSelectedGroundTile();
    } else if (action === 'paint-ground') {
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      this.status = `Paint ground with ${this.getRaceGroundTilePalette(this.getSelectedGroundTileId()).label}`;
    } else if (action === 'edge-tile') {
      this.racePortraitMode = 'race';
      this.activeRootId = 'race';
      this.setSelectedSegmentEdgeTile();
    } else if (action.startsWith('surface-')) {
      this.setSelectedSurface(action.replace('surface-', ''));
    } else if (action.startsWith('weather-')) {
      this.selectedRace.weather = action.replace('weather-', '');
    } else if (action === 'generate-random-race') {
      this.generateRandomRace();
    } else if (action === 'finish-return') {
      this.selectedRace.finishBehavior.type = 'return-to-origin';
    } else if (action === 'zoom-fit') {
      this.resetRaceMapViewport();
    } else if (action === 'add-sprite') {
      this.status = 'Sprite mode: add scenery sprite';
    } else if (action === 'move-sprite') {
      this.status = 'Sprite mode: move scenery sprite';
    } else if (action === 'delete-sprite') {
      this.status = 'Sprite mode: delete scenery sprite';
    } else if (action === 'side-left' || action === 'side-right') {
      this.status = `Sprite side: ${action === 'side-left' ? 'left' : 'right'}`;
    }
    this.activeAction = action;
    if (!['generate-random-race', ...BUILT_IN_RACE_LOAD_ACTIONS.map((entry) => entry.id), 'ground-tile-next', 'paint-ground', 'paint-elevation', 'elevation-up', 'elevation-down', 'elevation-brush-size', 'edge-tile', 'segment-width', 'segment-bumpiness', 'snow-condition', 'move-node', 'insert-node', 'snap-node', 'remove-node', 'remove-edge', 'engine-sound-next'].includes(action)) {
      this.status = `${action.replace(/-/g, ' ')} selected`;
    }
    this.activeRootId = this.findRootForAction(action) || this.activeRootId;
    this.mobileRootOpen = false;
    this.gamepadSubmenuOpen = false;
    this.openDesktopDropdownRootId = null;
    this.closedDesktopDropdownRootId = null;
    this.desktopDropdown = null;
  }

  cycleCarEngineSoundProfile() {
    const car = this.selectedCar;
    car.audio = car.audio || {};
    const current = car.audio.engineProfile || car.tuning?.engineSoundProfile || CAR_ENGINE_SOUND_PROFILES[0].id;
    const index = CAR_ENGINE_SOUND_PROFILES.findIndex((profile) => profile.id === current);
    const next = CAR_ENGINE_SOUND_PROFILES[(index + 1 + CAR_ENGINE_SOUND_PROFILES.length) % CAR_ENGINE_SOUND_PROFILES.length];
    car.audio.engineProfile = next.id;
    if (car.audio.engineSoundId) car.audio.engineSoundId = null;
    this.status = `Engine sound: ${next.label}`;
  }

  toggleRootMenu({ gamepad = false } = {}) {
    if (gamepad) {
      if (!this.mobileRootOpen && !this.gamepadSubmenuOpen) {
        this.mobileRootOpen = true;
        this.gamepadSubmenuOpen = false;
        return;
      }
      if (this.mobileRootOpen) {
        this.mobileRootOpen = false;
        this.gamepadSubmenuOpen = false;
        return;
      }
      this.mobileRootOpen = true;
      this.gamepadSubmenuOpen = false;
      return;
    }
    this.mobileRootOpen = !this.mobileRootOpen;
  }

  getGamepadMenuState(width = 0, height = 0) {
    const viewportMode = this.resolveRaceViewportMode(width, height);
    return resolveGamepadMenuState({
      viewportWidth: width,
      viewportHeight: height,
      gamepadConnected: Boolean(this.game?.input?.isGamepadConnected?.()),
      isMobile: viewportMode.isMobileViewport,
      menuActive: Boolean(this.mobileRootOpen || this.gamepadSubmenuOpen),
      activeMenuId: this.gamepadSubmenuOpen && !this.mobileRootOpen ? this.activeRootId : null
    });
  }

  shouldDrawGamepadSubmenuOnLeft(width = 0, height = 0) {
    return this.getGamepadMenuState(width, height).drawSlideOut;
  }

  shouldDrawControllerOverlay(width = 0, height = 0) {
    const state = this.getGamepadMenuState(width, height);
    return Boolean(state.isLandscapeMenuMode && state.drawControllerOverlay);
  }

  openPlaytestPicker() {
    this.activeAction = 'test-drive';
    this.activeRootId = 'drive';
    this.mobileRootOpen = false;
    this.gamepadSubmenuOpen = false;
    this.openDesktopDropdownRootId = null;
    this.closedDesktopDropdownRootId = null;
    this.desktopDropdown = null;
    this.playtestPickerOpen = true;
    this.preRaceTuningOpen = false;
    this.status = 'Choose a car to playtest';
  }

  startPlaytest(carId = this.project.selectedCarId) {
    const car = this.project.cars.find((candidate) => candidate.id === carId) || this.selectedCar;
    const transmissionType = this.getRaceTransmissionType(car);
    const tuning = this.getRaceCarTuning(car, { transmissionType });
    const initialGear = 1;
    const runtimeType = this.getSelectedRaceRuntimeType();
    const startPose = this.getRaceStartPose(runtimeType);
    this.project.selectedCarId = car.id;
    this.playtestPickerOpen = false;
    this.preRaceTuningOpen = false;
    this.gamepadSubmenuOpen = false;
    const aiDrivers = this.selectedRace.competition?.aiDrivers?.filter((driver) => driver.enabled) || [];
    const hazards = this.selectedRace.hazards || [];
    const codriverCalls = this.selectedRace.codriver?.enabled ? (this.selectedRace.codriver.calls || []) : [];
    this.playtestSession = {
      raceId: this.selectedRace.id,
      carId: car.id,
      startedAt: Date.now(),
      elapsedMs: 0,
      distance: 0,
      projectedDistance: 0,
      routeStartDistance: 0,
      startBackDistance: 0,
      speedMps: 0,
      routeLength: this.getRaceRouteLength(),
      routeRuntimeType: runtimeType,
      running: true,
      worldX: startPose.x,
      worldZ: startPose.z,
      launchLockMs: 420,
      cameraView: this.raceInput.cameraView,
      steeringWheel: 0,
      steeringTarget: 0,
      lateral: 0,
      heading: 0,
      carYaw: startPose.yaw,
      startYaw: startPose.yaw,
      cameraYaw: startPose.yaw,
      roadViewOffset: 0,
      trackViewOffset: 0,
      engineRpm: tuning.idleRpm,
      gear: initialGear,
      transmissionType,
      rpm: 0,
      lap: 1,
      shiftCooldownMs: 0,
      damagedGears: [],
      triggeredHazardIds: [],
      damage: this.createRaceDamageState(),
      handbrakeMs: 0,
      engineSoundId: car.audio?.engineSoundId || tuning.engineSoundId || null,
      engineSoundProfile: this.getRaceEngineProfileForTransmission(car, tuning),
      aiDrivers,
      hazards,
      codriverCalls,
      eventLog: [
        aiDrivers.length ? `${aiDrivers.length} AI racers enabled` : 'Solo playtest',
        hazards.length ? `${hazards.length} race hazards loaded` : 'No hazards enabled',
        codriverCalls.length ? `${codriverCalls.length} co-driver calls queued` : 'Co-driver disabled'
      ]
    };
    this.raceInput = {
      ...this.raceInput,
      steeringTarget: 0,
      steeringWheel: 0,
      throttle: false,
      brake: false,
      handbrake: false,
      autoShift: tuning.shiftMode !== 'manual',
      transmissionMode: transmissionType,
      keyboardThrottle: false,
      keyboardBrake: false,
      keyboardSteer: 0,
      binarySteer: 0,
      gear: initialGear,
      paused: false,
      analogSteeringActive: false,
      activeDpadPointerId: null,
      activeThrottlePointerId: null,
      activeBrakePointerId: null,
      throttlePulseMs: 0
    };
    this.status = `Playtesting ${this.selectedRace.name} in ${car.name}`;
  }

  endPlaytest() {
    if (!this.playtestSession) return;
    const car = this.project.cars.find((candidate) => candidate.id === this.playtestSession.carId) || this.selectedCar;
    this.status = `Ended playtest for ${car.name}`;
    this.playtestSession = null;
    this.resetRacePlaytestInputs();
    this.game?.audio?.setEngineRev?.(false);
    this.game?.audio?.setTireScreech?.(false);
    if (car.audio?.engineSoundId) this.game?.stopSfxById?.(car.audio.engineSoundId, { key: 'race-engine' });
  }

  finishPlaytest() {
    if (!this.playtestSession) return;
    const name = this.selectedRace?.name || 'race';
    const car = this.project.cars.find((candidate) => candidate.id === this.playtestSession.carId) || this.selectedCar;
    this.playtestSession = null;
    this.resetRacePlaytestInputs();
    this.game?.audio?.setEngineRev?.(false);
    this.game?.audio?.setTireScreech?.(false);
    if (car.audio?.engineSoundId) this.game?.stopSfxById?.(car.audio.engineSoundId, { key: 'race-engine' });
    this.status = `Finished ${name}`;
  }

  cancelPlaytestPicker() {
    this.playtestPickerOpen = false;
    this.preRaceTuningOpen = false;
    this.status = 'Ready';
  }

  getRaceRouteLength() {
    const segments = this.selectedRace?.road?.segments || [];
    const nodes = this.getRaceEditableNodes({ create: false });
    if (nodes.length >= 2) {
      return Math.max(1, nodes.slice(1).reduce((sum, node, index) => {
        const previous = nodes[index];
        return sum + Math.hypot(Number(node.x || 0) - Number(previous.x || 0), Number(node.y || 0) - Number(previous.y || 0));
      }, 0));
    }
    return Math.max(1, segments.reduce((sum, segment) => sum + Math.max(0, Number(segment.length) || 0), 0));
  }

  createRaceDamageState() {
    return {
      panels: {
        front: 0,
        left: 0,
        right: 0,
        rear: 0
      },
      engine: 0,
      transmission: 0,
      suspension: {
        fl: 0,
        fr: 0,
        rl: 0,
        rr: 0
      },
      suspensionPull: 0,
      tires: {
        fl: 0,
        fr: 0,
        rl: 0,
        rr: 0
      }
    };
  }

  getRaceSessionDamage() {
    if (!this.playtestSession) return this.createRaceDamageState();
    this.playtestSession.damage = this.playtestSession.damage || this.createRaceDamageState();
    const base = this.createRaceDamageState();
    const damage = this.playtestSession.damage;
    if (typeof damage.panels === 'number') {
      damage.panels = {
        front: damage.panels,
        left: damage.panels,
        right: damage.panels,
        rear: damage.panels
      };
    }
    damage.panels = { ...base.panels, ...damage.panels };
    if (typeof damage.suspension === 'number') {
      damage.suspension = {
        fl: damage.suspension,
        fr: damage.suspension,
        rl: damage.suspension,
        rr: damage.suspension
      };
    }
    damage.suspension = { ...base.suspension, ...damage.suspension };
    this.playtestSession.damage.tires = {
      fl: 0,
      fr: 0,
      rl: 0,
      rr: 0,
      ...this.playtestSession.damage.tires
    };
    return this.playtestSession.damage;
  }

  getAverageDamage(values = {}) {
    const list = Array.isArray(values) ? values : Object.values(values || {});
    if (!list.length) return 0;
    return list.reduce((sum, value) => sum + Number(value || 0), 0) / list.length;
  }

  getMaxDamage(values = {}) {
    const list = Array.isArray(values) ? values : Object.values(values || {});
    return list.length ? Math.max(...list.map((value) => Number(value) || 0)) : 0;
  }

  getRaceSegmentAtDistance(distance = 0, { wrap = this.getActiveRaceRuntimeType() === 'circuit' } = {}) {
    const segments = this.selectedRace?.road?.segments || [];
    if (!segments.length) return { segment: null, index: 0, start: 0, end: 0 };
    const routeLength = this.getRaceRouteLength();
    const rawDistance = Number(distance) || 0;
    const remaining = wrap
      ? ((rawDistance % routeLength) + routeLength) % routeLength
      : clamp(rawDistance, 0, routeLength);
    let cursor = 0;
    for (let index = 0; index < segments.length; index += 1) {
      const length = Math.max(1, Number(segments[index].length) || 1);
      if (remaining <= cursor + length) {
        return {
          segment: segments[index],
          index,
          start: cursor,
          end: cursor + length,
          progress: clamp((remaining - cursor) / length, 0, 1)
        };
      }
      cursor += length;
    }
    return { segment: segments[segments.length - 1], index: segments.length - 1, start: cursor, end: cursor, progress: 1 };
  }

  getRaceSegmentYawDelta(segment = {}) {
    const curve = clamp(Number(segment.curve) || 0, -1, 1);
    const squareTurn = segment.turn === 'square' ? Math.sign(curve || 1) * 1.12 : 0;
    return curve * 0.78 + squareTurn;
  }

  getRaceRoadYawAtDistance(distance = 0) {
    const segments = this.selectedRace?.road?.segments || [];
    if (!segments.length) return 0;
    const info = this.getRaceSegmentAtDistance(distance);
    let yaw = 0;
    for (let index = 0; index < info.index; index += 1) {
      yaw += this.getRaceSegmentYawDelta(segments[index]);
    }
    yaw += this.getRaceSegmentYawDelta(info.segment) * clamp(Number(info.progress) || 0, 0, 1);
    return yaw;
  }

  getRaceSegmentElevationProfile(segments = []) {
    let currentElevation = 0;
    return segments.map((segment) => {
      const targetElevation = clamp(Number(segment?.elevation) || 0, -0.42, 0.42);
      const delta = clamp(targetElevation - currentElevation, -0.2, 0.2);
      const start = currentElevation;
      const end = clamp(currentElevation + delta, -0.42, 0.42);
      currentElevation = end;
      return { start, end };
    });
  }

  smoothRaceElevationProgress(progress = 0) {
    const t = clamp(Number(progress) || 0, 0, 1);
    return t * t * (3 - 2 * t);
  }

  getRacePathSamples({ step = 18 } = {}) {
    const segments = this.selectedRace?.road?.segments || [];
    const nodes = this.getRaceEditableNodes({ create: false });
    if (nodes.length >= 2) {
      const samples = [{
        distance: 0,
        x: Number(nodes[0].x || 0),
        z: Number(nodes[0].y || 0),
        yaw: 0,
        elevation: clamp(Number(nodes[0].elevation) || 0, -0.42, 0.42),
        index: 0,
        segment: segments[0] || null,
        progress: 0
      }];
      let distance = 0;
      for (let index = 1; index < nodes.length; index += 1) {
        const previous = nodes[index - 1];
        const next = nodes[index];
        const dx = Number(next.x || 0) - Number(previous.x || 0);
        const dz = Number(next.y || 0) - Number(previous.y || 0);
        const length = Math.max(1, Math.hypot(dx, dz));
        const pieces = Math.max(2, Math.ceil(length / Math.max(6, Number(step) || 18)));
        const yaw = Math.atan2(dx, dz);
        const segment = segments[index - 1] || segments[segments.length - 1] || null;
        for (let piece = 1; piece <= pieces; piece += 1) {
          const t = piece / pieces;
          distance += length / pieces;
          samples.push({
            distance,
            x: Number(previous.x || 0) + dx * t,
            z: Number(previous.y || 0) + dz * t,
            yaw,
            elevation: clamp(
              (Number(previous.elevation) || 0) + ((Number(next.elevation) || 0) - (Number(previous.elevation) || 0)) * t,
              -0.42,
              0.42
            ),
            index: index - 1,
            segment,
            progress: t
          });
        }
      }
      return samples;
    }
    const samples = [{
      distance: 0,
      x: 0,
      z: 0,
      yaw: 0,
      elevation: 0,
      index: 0,
      segment: segments[0] || null,
      progress: 0
    }];
    let x = 0;
    let z = 0;
    let yaw = 0;
    let distance = 0;
    const elevationProfile = this.getRaceSegmentElevationProfile(segments);
    segments.forEach((segment, index) => {
      const length = Math.max(1, Number(segment.length) || 1);
      const pieces = Math.max(2, Math.ceil(length / Math.max(6, Number(step) || 18)));
      const yawDelta = this.getRaceSegmentYawDelta(segment);
      const segmentElevation = elevationProfile[index] || { start: 0, end: 0 };
      for (let piece = 1; piece <= pieces; piece += 1) {
        const previousT = (piece - 1) / pieces;
        const t = piece / pieces;
        const elevationT = this.smoothRaceElevationProgress(t);
        const midYaw = yaw + yawDelta * ((previousT + t) / 2);
        const ds = length / pieces;
        x += Math.sin(midYaw) * ds;
        z += Math.cos(midYaw) * ds;
        distance += ds;
        samples.push({
          distance,
          x,
          z,
          yaw: yaw + yawDelta * t,
          elevation: segmentElevation.start + (segmentElevation.end - segmentElevation.start) * elevationT,
          index,
          segment,
          progress: t
        });
      }
      yaw += yawDelta;
    });
    return samples;
  }

  getRaceWorldPoseAtDistance(distance = 0, { runtimeType = this.getActiveRaceRuntimeType() } = {}) {
    const samples = this.getRacePathSamples();
    if (!samples.length) return { distance: 0, x: 0, z: 0, yaw: 0, segment: null, index: 0, progress: 0 };
    const routeLength = this.getRaceRouteLength();
    const target = runtimeType === 'circuit'
      ? ((Number(distance) || 0) % routeLength + routeLength) % routeLength
      : clamp(Number(distance) || 0, 0, routeLength);
    if (target <= 0) {
      const first = samples[0];
      const next = samples.find((sample) => Math.hypot(
        Number(sample.x || 0) - Number(first.x || 0),
        Number(sample.z || 0) - Number(first.z || 0)
      ) > 0.5) || samples[1] || first;
      const dx = Number(next.x || 0) - Number(first.x || 0);
      const dz = Number(next.z || 0) - Number(first.z || 0);
      return {
        ...first,
        distance: 0,
        yaw: Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, dz) : Number(first.yaw || 0)
      };
    }
    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1];
      const next = samples[index];
      if (target <= next.distance) {
        const span = Math.max(1, next.distance - previous.distance);
        const t = clamp((target - previous.distance) / span, 0, 1);
        return {
          distance: target,
          x: previous.x + (next.x - previous.x) * t,
          z: previous.z + (next.z - previous.z) * t,
          yaw: previous.yaw + (next.yaw - previous.yaw) * t,
          elevation: previous.elevation + (next.elevation - previous.elevation) * t,
          index: next.index,
          segment: next.segment,
          progress: next.progress
        };
      }
    }
    return { ...samples[samples.length - 1], distance: target };
  }

  getRaceRouteProjectionForWorldPoint(point = {}) {
    const samples = this.getRacePathSamples({ step: 8 });
    if (samples.length < 2) {
      return {
        distance: 0,
        x: 0,
        z: 0,
        yaw: 0,
        lateral: 0,
        distanceToRoute: Infinity,
        segment: null,
        index: 0,
        progress: 0
      };
    }
    const px = Number(point.x || 0);
    const pz = Number(point.z || 0);
    let best = null;
    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1];
      const next = samples[index];
      const ax = Number(previous.x || 0);
      const az = Number(previous.z || 0);
      const bx = Number(next.x || 0);
      const bz = Number(next.z || 0);
      const dx = bx - ax;
      const dz = bz - az;
      const lengthSq = Math.max(0.0001, dx * dx + dz * dz);
      const t = clamp(((px - ax) * dx + (pz - az) * dz) / lengthSq, 0, 1);
      const x = ax + dx * t;
      const z = az + dz * t;
      const offsetX = px - x;
      const offsetZ = pz - z;
      const distanceSq = offsetX * offsetX + offsetZ * offsetZ;
      if (!best || distanceSq < best.distanceSq) {
        const yaw = Math.atan2(dx, dz);
        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);
        const span = Math.max(0.001, Number(next.distance || 0) - Number(previous.distance || 0));
        best = {
          distanceSq,
          distance: Number(previous.distance || 0) + span * t,
          x,
          z,
          yaw,
          lateral: offsetX * rightX + offsetZ * rightZ,
          distanceToRoute: Math.sqrt(distanceSq),
          segment: next.segment || previous.segment || null,
          index: next.index ?? previous.index ?? 0,
          progress: t
        };
      }
    }
    return best || {
      distance: 0,
      x: Number(samples[0].x || 0),
      z: Number(samples[0].z || 0),
      yaw: Number(samples[0].yaw || 0),
      lateral: 0,
      distanceToRoute: 0,
      segment: samples[0].segment || null,
      index: 0,
      progress: 0
    };
  }

  getRaceStartPose(runtimeType = this.getSelectedRaceRuntimeType()) {
    const nodes = this.getRaceEditableNodes({ create: false });
    if (nodes.length >= 2) {
      const first = nodes[0];
      const next = nodes.find((node, index) => index > 0 && Math.hypot(
        Number(node.x || 0) - Number(first.x || 0),
        Number(node.y || 0) - Number(first.y || 0)
      ) > 0.5) || nodes[1];
      const dx = Number(next.x || 0) - Number(first.x || 0);
      const dz = Number(next.y || 0) - Number(first.y || 0);
      return {
        distance: 0,
        x: Number(first.x || 0),
        z: Number(first.y || 0),
        yaw: Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, dz) : 0,
        elevation: clamp(Number(first.elevation) || 0, -0.42, 0.42),
        segment: this.selectedRace?.road?.segments?.[0] || null,
        index: 0,
        progress: 0
      };
    }
    const samples = this.getRacePathSamples({ step: 8 });
    if (!samples.length) return { distance: 0, x: 0, z: 0, yaw: 0, elevation: 0, segment: null, index: 0, progress: 0 };
    const first = samples[0];
    const next = samples.find((sample) => (
      Number(sample.distance || 0) > 4
      && Math.hypot(
        Number(sample.x || 0) - Number(first.x || 0),
        Number(sample.z || 0) - Number(first.z || 0)
      ) > 1
    )) || samples[1] || first;
    const dx = Number(next.x || 0) - Number(first.x || 0);
    const dz = Number(next.z || 0) - Number(first.z || 0);
    const yaw = Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, dz) : Number(first.yaw || 0);
    return {
      ...first,
      distance: 0,
      x: Number(first.x || 0),
      z: Number(first.z || 0),
      yaw
    };
  }

  getRaceRoadWidthMForSegment(segment = null) {
    return this.getSelectedSegmentRoadWidthM(segment || this.selectedSegment);
  }

  getRaceRoadHalfWidthWorld(segment = null) {
    const authoredWidth = clamp(Number(segment?.roadWidthM || segment?.roadWidth || this.selectedRace?.road?.width || 11), 4, 24);
    const carWidth = this.getRaceCarWorldWidth();
    return clamp(Math.max(carWidth * 10.6, authoredWidth * 3.08), 19, 74);
  }

  getRaceLaneMarkerDimensionsWorld() {
    return {
      interval: RACE_HIGHWAY_MARKERS.dashLengthM + RACE_HIGHWAY_MARKERS.gapLengthM,
      dashLength: RACE_HIGHWAY_MARKERS.dashLengthM,
      gapLength: RACE_HIGHWAY_MARKERS.gapLengthM,
      dashWidth: RACE_HIGHWAY_MARKERS.dashWidthM,
      edgePostInterval: RACE_HIGHWAY_MARKERS.edgePostIntervalM
    };
  }

  formatRaceRouteLengthKm(length = this.getRaceRouteLength()) {
    const km = Math.max(0, Number(length) || 0) / 1000;
    return `${km.toFixed(km >= 10 ? 1 : 2)} km`;
  }

  formatRaceMapDistanceLabel(length = 0) {
    const meters = Math.max(0, Number(length) || 0);
    if (meters < 1000) return `${Math.round(meters)} m`;
    const km = meters / 1000;
    return `${km.toFixed(km >= 10 ? 1 : 2)} km`;
  }

  getRaceMapScaleBar(bounds = this.raceMapBounds) {
    if (!bounds) return null;
    const rawPoints = this.getRaceRawMapPoints();
    if (!rawPoints.length) return null;
    const { scale } = this.getRaceMapTransform(bounds, rawPoints);
    const maxPx = Math.max(48, Math.min(160, Number(bounds.w || 0) * 0.32));
    const minPx = Math.min(maxPx, Math.max(42, Number(bounds.w || 0) * 0.12));
    const candidates = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000];
    let distance = candidates[0];
    for (const candidate of candidates) {
      const candidatePx = candidate * scale;
      if (candidatePx <= maxPx) {
        distance = candidate;
      }
    }
    const scaledWidth = distance * scale;
    if (scaledWidth < minPx) {
      distance = candidates.find((candidate) => candidate * scale >= minPx) || candidates[candidates.length - 1];
    }
    const width = Math.min(maxPx, Math.max(1, distance * scale));
    return {
      distance,
      label: this.formatRaceMapDistanceLabel(distance),
      width,
      scale
    };
  }

  getRaceThirdPersonCarWidth(bounds = {}) {
    const roadHalfWidth = this.getRaceRoadHalfWidthWorld(this.getRaceSegmentAtDistance(Number(this.playtestSession?.distance || 0)).segment);
    const roadScale = clamp(3.45 / Math.max(1, roadHalfWidth), 0.72, 1.08);
    return clamp(Number(bounds.w || 1) * 0.092 * roadScale, 32, Number(bounds.w || 1) * 0.15);
  }

  getRaceCarWorldWidth(car = this.selectedCar) {
    return clamp(Number(car?.dimensions?.widthM || car?.tuning?.widthM || 1.83), 1.45, 2.4);
  }

  getRaceRoadCrossSectionAtDistance(distance = 0, { visualWidthMultiplier = 1 } = {}) {
    const center = this.getRaceWorldPoseAtDistance(distance);
    const halfWidth = this.getRaceRoadHalfWidthWorld(center.segment) * clamp(Number(visualWidthMultiplier) || 1, 0.25, 2.2);
    const rightX = Math.cos(center.yaw);
    const rightZ = -Math.sin(center.yaw);
    const leftPoint = {
      ...center,
      x: center.x - rightX * halfWidth,
      z: center.z - rightZ * halfWidth,
      edge: 'left'
    };
    const rightPoint = {
      ...center,
      x: center.x + rightX * halfWidth,
      z: center.z + rightZ * halfWidth,
      edge: 'right'
    };
    leftPoint.elevation = this.getRaceGroundElevationAtWorldPoint(leftPoint, center.elevation);
    rightPoint.elevation = this.getRaceGroundElevationAtWorldPoint(rightPoint, center.elevation);
    return {
      center,
      left: leftPoint,
      right: rightPoint
    };
  }

  projectRaceWorldPointToCamera(point = {}, camera = {}, cameraYaw = 0, bounds = {}) {
    const dx = Number(point.x || 0) - Number(camera.x || 0);
    const dz = Number(point.z || 0) - Number(camera.z || 0);
    const dy = Number(point.elevation || 0) - Number(camera.elevation || 0);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    const forwardX = Math.sin(cameraYaw);
    const forwardZ = Math.cos(cameraYaw);
    const cameraX = dx * rightX + dz * rightZ;
    const cameraZ = dx * forwardX + dz * forwardZ;
    const roadDepth = Math.max(1, Number(bounds.h || 1) * (Number(camera.roadDepthRatio) || 0.7));
    const horizon = Number(bounds.y || 0) + Number(bounds.h || 1) * (Number(camera.horizonRatio) || 0.31);
    const focal = Math.max(140, Number(bounds.w || 1) * (Number(camera.focalScale) || 1.04));
    const roadWidthScale = Number(camera.roadWidthScale) || 2.2;
    const roadMaxWidthRatio = clamp(Number(camera.roadMaxWidthRatio) || 0.72, 0.1, 1.35);
    const z = Math.max(1, cameraZ);
    return {
      ...point,
      cameraX,
      cameraZ,
      visible: cameraZ > 2,
      screenX: Number(bounds.x || 0) + Number(bounds.w || 1) / 2 + cameraX * (focal / Math.max(28, z)),
      screenY: horizon + roadDepth * (44 / (z + 44)) - dy * Number(bounds.h || 1) * (0.28 + 26 / (z + 34)),
      halfWidth: clamp(
        (this.getRaceRoadHalfWidthWorld(point.segment) * roadWidthScale) * (focal / Math.max(38, z)),
        5,
        Number(bounds.w || 1) * roadMaxWidthRatio
      )
    };
  }

  getRaceCameraEyeHeight(cameraView = 'third-person') {
    return cameraView === 'first-person' ? 0.1 : 0.14;
  }

  getRaceCameraProjectionProfile(cameraView = 'third-person', speedFactor = 0) {
    const speed = clamp(Number(speedFactor) || 0, 0, 1);
    if (cameraView === 'first-person') {
      return {
        roadWidthScale: 11.7 - speed * 0.12,
        roadMaxWidthRatio: 0.92,
        focalScale: 1.12 + speed * 0.18,
        roadDepthRatio: 0.78 - speed * 0.1
      };
    }
    return {
      roadWidthScale: 4.9 - speed * 0.08,
      roadMaxWidthRatio: 0.52,
      focalScale: 0.92 + speed * 0.1,
      roadDepthRatio: 0.66 - speed * 0.08
    };
  }

  getRaceCameraRouteSampleDirection(cameraYaw = 0, routeYaw = 0) {
    return Math.cos(normalizeAngle(Number(cameraYaw || 0) - Number(routeYaw || 0))) < 0 ? -1 : 1;
  }

  getRaceProjectedRoadQuads(crossSections = []) {
    const quads = [];
    for (let index = 0; index < crossSections.length - 1; index += 1) {
      const near = crossSections[index];
      const far = crossSections[index + 1];
      if (!near?.center?.visible || !far?.center?.visible) continue;
      const nearZ = Number(near.center.cameraZ || 0);
      const farZ = Number(far.center.cameraZ || 0);
      if (!Number.isFinite(nearZ) || !Number.isFinite(farZ) || nearZ <= 2 || farZ <= 2) continue;
      if (Math.abs(farZ - nearZ) < 0.75) continue;
      const minZ = Math.min(nearZ, farZ);
      const maxZ = Math.max(nearZ, farZ);
      quads.push({
        index,
        near,
        far,
        minZ,
        maxZ,
        avgZ: (nearZ + farZ) / 2
      });
    }
    return quads.sort((a, b) => b.avgZ - a.avgZ || b.maxZ - a.maxZ || b.index - a.index);
  }

  getRaceRoadSurfacePalette(surfaceId = 'asphalt') {
    const palettes = {
      asphalt: {
        roadA: '#101214',
        roadB: '#171a1d',
        shoulderA: '#315734',
        shoulderB: '#244629',
        lane: '#f0eed9'
      },
      'wet-asphalt': {
        roadA: '#0c1216',
        roadB: '#13202a',
        shoulderA: '#263946',
        shoulderB: '#1b2b36',
        lane: '#d7e7ef'
      },
      dirt: {
        roadA: '#6a4728',
        roadB: '#7a5633',
        shoulderA: '#3c5b2d',
        shoulderB: '#2e4725',
        lane: '#ecd7a6'
      },
      gravel: {
        roadA: '#52534f',
        roadB: '#686964',
        shoulderA: '#344b31',
        shoulderB: '#273d29',
        lane: '#eeeedf'
      },
      snow: {
        roadA: '#c8d6dd',
        roadB: '#e1edf2',
        shoulderA: '#d7e5ec',
        shoulderB: '#b8cbd5',
        lane: '#44515a'
      }
    };
    return palettes[getSurfaceById(surfaceId).id] || palettes.asphalt;
  }

  getRaceGroundPaletteForSegment(segment = {}, worldPoint = null) {
    const patch = this.getRaceGroundPaintAtWorldPoint(worldPoint);
    const tilePalette = this.getRaceGroundTilePalette(patch?.tileId || segment?.edgeTileId || 'grass');
    return {
      shoulderA: tilePalette.groundA,
      shoulderB: tilePalette.groundB,
      line: tilePalette.line,
      label: tilePalette.label
    };
  }

  getRaceSegmentCoDriverCue(segmentInfo = null) {
    const info = segmentInfo || this.getRaceSegmentAtDistance(Number(this.playtestSession?.distance || 0));
    const segment = info.segment;
    if (!segment) return null;
    const curve = Number(segment.curve) || 0;
    const direction = curve >= 0 ? 'right' : 'left';
    const absCurve = Math.abs(curve);
    const severity = segment.turn === 'square' ? 4 : absCurve > 0.78 ? 3 : absCurve > 0.46 ? 2 : absCurve > 0.18 ? 1 : 0;
    const turnText = segment.turn === 'square'
      ? `Square ${direction}`
      : severity >= 3
        ? `Hard ${direction}`
        : severity === 2
          ? `Medium ${direction}`
          : severity === 1
            ? `Easy ${direction}`
            : 'Straight';
    const surface = getSurfaceById(segment.surface);
    const elevation = Number(segment.elevation) || 0;
    const elevationText = elevation > 0.16 ? ' over crest' : elevation < -0.16 ? ' into dip' : '';
    const surfaceText = surface.id !== 'asphalt' ? `, ${surface.label.toLowerCase()}` : '';
    return {
      id: `segment-cue-${info.index}`,
      at: info.start,
      text: `${turnText}${elevationText}${surfaceText}`,
      severity
    };
  }

  getDamageColor(value = 0) {
    const amount = clamp(Number(value) || 0, 0, 100);
    if (amount >= 75) return '#ff4f4f';
    if (amount >= 50) return '#ff8a2f';
    if (amount >= 25) return '#f2d45c';
    return '#f1f4ef';
  }

  applyRaceDamage(part, amount = 0, details = {}) {
    const damage = this.getRaceSessionDamage();
    const value = Math.max(0, Number(amount) || 0);
    if (part === 'tires') {
      const keys = details.keys || ['fl', 'fr', 'rl', 'rr'];
      keys.forEach((key) => {
        damage.tires[key] = clamp(Number(damage.tires[key] || 0) + value, 0, 100);
      });
      return;
    }
    if (part === 'suspension') {
      const keys = details.keys || ['fl', 'fr', 'rl', 'rr'];
      keys.forEach((key) => {
        damage.suspension[key] = clamp(Number(damage.suspension[key] || 0) + value, 0, 100);
      });
      const pullDelta = Number(details.pull || 0);
      damage.suspensionPull = clamp(Number(damage.suspensionPull || 0) + pullDelta, -0.35, 0.35);
      return;
    }
    if (part === 'panels') {
      const keys = details.keys || ['front', 'left', 'right', 'rear'];
      keys.forEach((key) => {
        damage.panels[key] = clamp(Number(damage.panels[key] || 0) + value, 0, 100);
      });
      return;
    }
    if (part in damage) damage[part] = clamp(Number(damage[part] || 0) + value, 0, 100);
  }

  getRaceDamageEffects() {
    const damage = this.getRaceSessionDamage();
    const tireValues = Object.values(damage.tires || {}).map((value) => Number(value) || 0);
    const avgTireDamage = tireValues.length
      ? tireValues.reduce((sum, value) => sum + value, 0) / tireValues.length
      : 0;
    const suspensionDamage = this.getAverageDamage(damage.suspension);
    const panelDamage = this.getAverageDamage(damage.panels);
    return {
      grip: clamp(1 - avgTireDamage * 0.0045 - suspensionDamage * 0.0035, 0.42, 1),
      enginePower: clamp(1 - Number(damage.engine || 0) * 0.006, 0.38, 1),
      engineJitter: Number(damage.engine || 0) >= 45 ? 0.14 + Number(damage.engine || 0) * 0.002 : 0,
      shiftDelayMs: Number(damage.transmission || 0) * 7,
      suspensionPull: Number(damage.suspensionPull || 0),
      panelDrag: 1 + panelDamage * 0.002
    };
  }

  getRaceWeatherGripMultiplier(weather = this.selectedRace?.weather) {
    const multipliers = {
      clear: 1,
      rain: 0.78,
      storm: 0.68,
      snow: 0.45
    };
    return multipliers[weather] || 1;
  }

  getRaceTireCompound(id = 'tarmac') {
    return RACE_TIRE_COMPOUNDS.find((compound) => compound.id === id) || RACE_TIRE_COMPOUNDS[0];
  }

  getRaceCarSetup(car = this.selectedCar) {
    car.setup = car.setup || {};
    car.setup.tireCompoundByWheel = {
      fl: 'tarmac',
      fr: 'tarmac',
      rl: 'tarmac',
      rr: 'tarmac',
      ...(car.setup.tireCompoundByWheel || {})
    };
    car.setup.tirePressurePsi = {
      fl: 32,
      fr: 32,
      rl: 31,
      rr: 31,
      ...(car.setup.tirePressurePsi || {})
    };
    return car.setup;
  }

  getRaceTireSetupGripMultiplier(car = this.selectedCar, surfaceId = 'asphalt', weather = this.selectedRace?.weather) {
    const setup = this.getRaceCarSetup(car);
    const surface = getSurfaceById(surfaceId).id;
    const wheelIds = ['fl', 'fr', 'rl', 'rr'];
    const grip = wheelIds.map((wheelId) => {
      const compound = this.getRaceTireCompound(setup.tireCompoundByWheel[wheelId]);
      const pressure = clamp(Number(setup.tirePressurePsi[wheelId] || 32), 18, 46);
      const pressurePenalty = 1 - Math.min(0.16, Math.abs(pressure - 32) * 0.008);
      return (compound.surfaceGrip?.[surface] || 0.7) * (compound.weatherGrip?.[weather] || 1) * pressurePenalty;
    });
    return clamp(grip.reduce((sum, value) => sum + value, 0) / Math.max(1, grip.length), 0.25, 1.2);
  }

  getRaceTireWearMultiplier(car = this.selectedCar) {
    const setup = this.getRaceCarSetup(car);
    const wheelIds = ['fl', 'fr', 'rl', 'rr'];
    const wear = wheelIds.map((wheelId) => this.getRaceTireCompound(setup.tireCompoundByWheel[wheelId]).wearRate || 1);
    return clamp(wear.reduce((sum, value) => sum + value, 0) / Math.max(1, wear.length), 0.7, 1.6);
  }

  getRaceSegmentSurfaceDetailGrip(segment = null) {
    if (!segment) return 1;
    const bumpPenalty = clamp(Number(segment.bumpiness) || 0, 0, 1) * 0.12;
    const snowMultiplier = segment.surface === 'snow'
      ? this.getSnowConditionById(segment.snowCondition).grip
      : 1;
    return clamp(snowMultiplier - bumpPenalty, 0.32, 1.05);
  }

  cycleRaceTireCompound(wheelId = 'fl') {
    const car = this.selectedCar;
    const setup = this.getRaceCarSetup(car);
    const current = setup.tireCompoundByWheel[wheelId] || 'tarmac';
    const index = RACE_TIRE_COMPOUNDS.findIndex((compound) => compound.id === current);
    const next = RACE_TIRE_COMPOUNDS[(index + 1 + RACE_TIRE_COMPOUNDS.length) % RACE_TIRE_COMPOUNDS.length];
    setup.tireCompoundByWheel[wheelId] = next.id;
    this.status = `${wheelId.toUpperCase()} tire: ${next.label}`;
  }

  adjustRaceTuningValue(path = '', delta = 0) {
    const car = this.selectedCar;
    const setup = this.getRaceCarSetup(car);
    const tuning = car.tuning || {};
    const clampSet = (target, key, min, max, step = 0.01) => {
      const next = clamp(Number(target[key] || 0) + Number(delta || 0) * step, min, max);
      target[key] = Math.round(next * 1000) / 1000;
      return target[key];
    };
    let value = 0;
    if (path.startsWith('pressure-')) {
      const wheelId = path.replace('pressure-', '');
      value = clampSet(setup.tirePressurePsi, wheelId, 18, 46, 1);
      this.status = `${wheelId.toUpperCase()} pressure: ${value} psi`;
      return;
    }
    const ranges = {
      brakeBalance: [0.35, 0.75, 0.02],
      gearFinalDrive: [2.6, 5.2, 0.05],
      camberFront: [-5, 1, 0.1],
      camberRear: [-5, 1, 0.1],
      springFront: [0.1, 1, 0.03],
      springRear: [0.1, 1, 0.03],
      rideHeightFront: [0.1, 1, 0.03],
      rideHeightRear: [0.1, 1, 0.03],
      dampingFront: [0.1, 1, 0.03],
      dampingRear: [0.1, 1, 0.03],
      bumpFront: [0.1, 1, 0.03],
      bumpRear: [0.1, 1, 0.03],
      reboundFront: [0.1, 1, 0.03],
      reboundRear: [0.1, 1, 0.03],
      antiRollFront: [0.1, 1, 0.03],
      antiRollRear: [0.1, 1, 0.03],
      aeroFront: [0, 1, 0.03],
      aeroRear: [0, 1, 0.03],
      differentialAccel: [0, 1, 0.03],
      differentialDecel: [0, 1, 0.03]
    };
    const range = ranges[path];
    if (!range) return;
    value = clampSet(tuning, path, range[0], range[1], range[2]);
    this.status = `${path.replace(/([A-Z])/g, ' $1')}: ${value}`;
  }

  getRaceTransmissionType(car = this.selectedCar) {
    const available = car?.transmissions || {};
    const requested = this.playtestSession?.transmissionType
      || this.raceInput?.transmissionMode
      || car?.defaultTransmissionType
      || car?.tuning?.shiftMode
      || car?.tuning?.transmissionType
      || 'automatic';
    if (available[requested]) return requested;
    if (available.automatic) return 'automatic';
    if (available.manual) return 'manual';
    return requested === 'automatic' ? 'automatic' : 'manual';
  }

  getRaceCarTuning(car = this.selectedCar, { transmissionType = null } = {}) {
    const tuning = car?.tuning || {};
    const selectedTransmissionType = transmissionType || this.getRaceTransmissionType(car);
    const transmission = car?.transmissions?.[selectedTransmissionType] || {};
    const merged = { ...tuning, ...transmission };
    return {
      drivetrain: merged.drivetrain || 'awd',
      transmissionType: selectedTransmissionType,
      shiftMode: merged.shiftMode || selectedTransmissionType || 'manual',
      powerHp: Math.max(80, Number(merged.powerHp) || 271),
      torqueLbFt: Math.max(80, Number(merged.torqueLbFt) || 258),
      weightKg: Math.max(450, Number(merged.weightKg) || 1495),
      tireGrip: Math.max(0.2, Number(merged.tireGrip) || 1),
      redlineRpm: Math.max(3000, Number(merged.redlineRpm) || 6100),
      revLimitRpm: Math.max(3200, Number(merged.revLimitRpm) || 6300),
      revLimiterDropRpm: Math.max(80, Number(merged.revLimiterDropRpm) || 320),
      idleRpm: Math.max(500, Number(merged.idleRpm) || 850),
      torquePeakStartRpm: Math.max(900, Number(merged.torquePeakStartRpm) || 2000),
      torquePeakEndRpm: Math.max(1200, Number(merged.torquePeakEndRpm) || 5200),
      torqueFalloffRpm: Math.max(2200, Number(merged.torqueFalloffRpm) || 6500),
      gearRatios: Array.isArray(merged.gearRatios) && merged.gearRatios.length ? merged.gearRatios.map((ratio) => Math.max(0.1, Number(ratio) || 1)) : [3.45, 1.95, 1.37, 0.97, 0.74, 0.67],
      reverseRatio: Math.max(0.1, Number(merged.reverseRatio) || 3.33),
      finalDrive: Math.max(0.5, Number(merged.gearFinalDrive) || 4.11),
      wheelRadiusM: Math.max(0.18, Number(merged.wheelRadiusM) || 0.337),
      topSpeedMps: Math.max(20, (Number(merged.topSpeedMph) || 135) * 0.44704),
      drivetrainEfficiency: clamp(Number(merged.drivetrainEfficiency) || 0.84, 0.55, 0.96),
      shiftTimeMs: Math.max(80, Number(merged.shiftTimeMs) || 420),
      autoUpshiftRpm: Math.max(2500, Number(merged.autoUpshiftRpm) || 5800),
      autoDownshiftRpm: Math.max(900, Number(merged.autoDownshiftRpm) || 1700),
      torqueConverterSlip: clamp(Number(merged.torqueConverterSlip) || 0, 0, 0.25),
      launchRpm: Math.max(1200, Number(merged.launchRpm) || 3000),
      engineProfile: merged.engineProfile || 'wrx-flat-four-manual'
    };
  }

  getRaceEngineProfileForTransmission(car = this.selectedCar, tuning = this.getRaceCarTuning(car)) {
    const defaultTransmissionType = car?.defaultTransmissionType || 'automatic';
    const stockProfile = car?.transmissions?.[defaultTransmissionType]?.engineProfile || car?.audio?.engineProfile || null;
    const selectedProfile = tuning?.engineProfile || stockProfile || 'wrx-flat-four-manual';
    const configuredProfile = car?.audio?.engineProfile || null;
    return configuredProfile && configuredProfile !== stockProfile ? configuredProfile : selectedProfile;
  }

  updateRaceEngineAudio({ tuning, throttle = 0, load = 0 } = {}) {
    const session = this.playtestSession;
    if (!session || !this.game?.audio?.setEngineRev) return;
    this.game.audio.setEngineRev(Boolean(session.running), {
      rpm: session.engineRpm || tuning?.idleRpm || 900,
      redlineRpm: tuning?.redlineRpm || tuning?.revLimitRpm || 6200,
      throttle,
      load,
      profile: session.engineSoundProfile || 'wrx-flat-four'
    });
  }

  updateRaceTireAudio({ slip = 0, surface = 'asphalt', speedMps = 0 } = {}) {
    const session = this.playtestSession;
    if (!session || !this.game?.audio?.setTireScreech) return;
    const amount = clamp(Number(slip) || 0, 0, 1);
    if (amount <= 0.001 || Math.abs(Number(speedMps) || 0) < 0.45) {
      this.game.audio.setTireScreech(false);
      return;
    }
    const surfaceId = getSurfaceById(surface).id;
    const material = ['dirt', 'gravel', 'snow'].includes(surfaceId) ? 'dirt' : 'pavement';
    this.game.audio.setTireScreech(true, {
      slip: amount,
      speedMps,
      material,
      dirt: material === 'dirt'
    });
  }

  getRaceGearRatio(tuning, gear) {
    if (gear < 0) return tuning.reverseRatio;
    if (gear <= 0) return 0;
    return tuning.gearRatios[clamp(gear - 1, 0, tuning.gearRatios.length - 1)] || tuning.gearRatios[tuning.gearRatios.length - 1] || 1;
  }

  getRaceTorqueNmAtRpm(rpm, tuning) {
    const peakTorqueNm = tuning.torqueLbFt * 1.35582;
    const idle = tuning.idleRpm;
    const start = tuning.torquePeakStartRpm;
    const end = tuning.torquePeakEndRpm;
    const limit = tuning.torqueFalloffRpm || tuning.revLimitRpm;
    if (rpm <= idle) return peakTorqueNm * 0.42;
    if (rpm < start) {
      return peakTorqueNm * clamp(0.42 + ((rpm - idle) / Math.max(1, start - idle)) * 0.58, 0.42, 1);
    }
    if (rpm <= end) return peakTorqueNm;
    return peakTorqueNm * clamp(1 - ((rpm - end) / Math.max(1, limit - end)) * 0.42, 0.54, 1);
  }

  getRaceRedlineSpeedMps(tuning, gear) {
    const ratio = this.getRaceGearRatio(tuning, gear);
    if (!ratio) return 0;
    const wheelRpm = tuning.redlineRpm / Math.max(0.1, ratio * tuning.finalDrive);
    return (wheelRpm / 60) * (Math.PI * 2 * tuning.wheelRadiusM);
  }

  updateRaceWearAndDamage(seconds = 0) {
    const session = this.playtestSession;
    if (!session) return;
    const car = this.project.cars.find((candidate) => candidate.id === session.carId) || this.selectedCar;
    const tireWearMultiplier = this.getRaceTireWearMultiplier(car);
    const damage = this.getRaceSessionDamage();
    const speed = Number(session.speedMps || 0);
    const steer = Number(this.raceInput.steeringWheel || 0);
    const drift = Math.abs(steer) * clamp(speed / 38, 0, 1) + (this.raceInput.handbrake ? 0.8 : 0);
    const baseWear = seconds * (0.006 + speed * 0.00055) * tireWearMultiplier;
    const leftWear = baseWear + seconds * Math.max(0, steer) * drift * 0.28;
    const rightWear = baseWear + seconds * Math.max(0, -steer) * drift * 0.28;
    damage.tires.fl = clamp(damage.tires.fl + leftWear, 0, 100);
    damage.tires.rl = clamp(damage.tires.rl + leftWear * 1.12, 0, 100);
    damage.tires.fr = clamp(damage.tires.fr + rightWear, 0, 100);
    damage.tires.rr = clamp(damage.tires.rr + rightWear * 1.12, 0, 100);

    const tuning = this.getRaceCarTuning(car);
    if (session.rpm > 0.985 && this.raceInput.throttle && this.raceInput.gear < tuning.gearRatios.length) {
      this.applyRaceDamage('engine', seconds * 2.8);
    }
    if (Math.abs(steer) > 0.72 && speed > 38 && this.raceInput.handbrake) {
      this.applyRaceDamage('transmission', seconds * 0.9);
    }

    const previous = Number(session.previousDistance || 0);
    const current = Number(session.distance || 0);
    const routeLength = Math.max(1, Number(session.routeLength || this.getRaceRouteLength()));
    const crossed = (at) => (
      current >= previous
        ? at > previous && at <= current
        : at > previous || at <= current
    );
    const hazards = this.selectedRace?.hazards || [];
    hazards.forEach((hazard) => {
      if (!hazard?.id || session.triggeredHazardIds.includes(hazard.id)) return;
      const at = ((Number(hazard.at) || 0) % routeLength + routeLength) % routeLength;
      if (!crossed(at)) return;
      session.triggeredHazardIds.push(hazard.id);
      if (hazard.type === 'jump') {
        const impact = Math.max(0, speed / 30 - Number(hazard.landingForgiveness || 0.35));
        this.applyRaceDamage('suspension', impact * 10 + Number(hazard.height || 0) * 12, {
          pull: (Math.random() - 0.5) * 0.08
        });
      } else {
        const amount = Number(hazard.damage || 10);
        const panelKeys = hazard.side === 'left'
          ? ['left']
          : hazard.side === 'right'
            ? ['right']
            : hazard.side === 'rear'
              ? ['rear']
              : ['front'];
        this.applyRaceDamage('panels', amount, { keys: panelKeys });
        if (hazard.side === 'left') this.applyRaceDamage('suspension', amount * 0.15, { keys: ['fl', 'rl'], pull: 0.025 });
        if (hazard.side === 'right') this.applyRaceDamage('suspension', amount * 0.15, { keys: ['fr', 'rr'], pull: -0.025 });
        if (!hazard.side || hazard.side === 'front') this.applyRaceDamage('suspension', amount * 0.08, { keys: ['fl', 'fr'] });
      }
    });
  }

  updatePlaytest(dt = 0) {
    if (!this.playtestSession?.running) return;
    if (this.raceInput.paused) return;
    const car = this.project.cars.find((candidate) => candidate.id === this.playtestSession.carId) || this.selectedCar;
    const tuning = this.getRaceCarTuning(car);
    const seconds = Math.max(0, Number(dt) || 0);
    this.applyRaceAnalogInput();
    const damageEffects = this.getRaceDamageEffects();
    const segmentInfo = this.getRaceSegmentAtDistance(this.playtestSession.distance, {
      wrap: (this.playtestSession.routeRuntimeType || this.getSelectedRaceRuntimeType()) === 'circuit'
    });
    const surface = getSurfaceById(segmentInfo.segment?.surface);
    const surfaceGrip = surface.grip * this.getRaceSegmentSurfaceDetailGrip(segmentInfo.segment);
    const engineJitter = damageEffects.engineJitter
      ? 1 - damageEffects.engineJitter * (0.5 + 0.5 * Math.sin(this.playtestSession.elapsedMs / 173))
      : 1;
    const tireSetupGrip = this.getRaceTireSetupGripMultiplier(car, surface.id, this.selectedRace?.weather);
    const gripFactor = Math.max(0.35, Math.min(1.4, tuning.tireGrip)) * surfaceGrip * this.getRaceWeatherGripMultiplier() * tireSetupGrip * damageEffects.grip;
    let gear = clamp(Math.round(Number(this.raceInput.gear ?? 0)), -1, tuning.gearRatios.length);
    if (tuning.shiftMode !== 'manual' && gear === 0 && this.raceInput.throttle) {
      gear = 1;
      this.raceInput.gear = 1;
    }
    const gearRatio = this.getRaceGearRatio(tuning, gear);
    const maxSteerAtSpeed = this.getRaceMaxSteerForSpeed(this.playtestSession.speedMps);
    const binarySteer = clamp(Number(this.raceInput.binarySteer || 0), -1, 1);
    const binaryActive = Math.abs(binarySteer) > 0.01;
    if (!this.raceInput.analogSteeringActive) {
      if (binaryActive) {
        this.raceInput.steeringTarget = binarySteer;
      } else {
        const returnRate = this.getRaceSteeringReturnRate(this.playtestSession.speedMps);
        this.raceInput.steeringTarget += (0 - Number(this.raceInput.steeringTarget || 0)) * Math.min(0.62, seconds * returnRate);
      }
    }
    this.raceInput.steeringTarget = clamp(this.raceInput.steeringTarget, -1, 1);
    const wheelResponse = this.raceInput.analogSteeringActive
      ? this.getRaceAnalogSteerResponse(this.playtestSession.speedMps)
      : (binaryActive ? this.getRaceBinarySteerAssist(this.playtestSession.speedMps).response : this.getRaceSteeringReturnRate(this.playtestSession.speedMps) + 1.2);
    const wheelResponseStep = Math.min(
      binaryActive && !this.raceInput.analogSteeringActive ? 0.47 : 0.94,
      seconds * wheelResponse
    );
    this.raceInput.steeringWheel += (this.raceInput.steeringTarget - this.raceInput.steeringWheel) * wheelResponseStep;
    if (!this.raceInput.analogSteeringActive && !binaryActive && Math.abs(this.raceInput.steeringWheel) < 0.012) {
      this.raceInput.steeringWheel = 0;
      this.raceInput.steeringTarget = 0;
    }
    const throttle = this.raceInput.throttle ? 1 : 0;
    const brake = this.raceInput.brake ? 1 : 0;
    const handbrake = this.raceInput.handbrake ? 1 : 0;
    const driveDirection = gear < 0 ? -1 : gear > 0 ? 1 : 0;
    this.playtestSession.previousDistance = this.playtestSession.distance;
    this.playtestSession.elapsedMs += seconds * 1000;
    this.playtestSession.launchLockMs = Math.max(0, Number(this.playtestSession.launchLockMs || 0) - seconds * 1000);
    this.playtestSession.shiftCooldownMs = Math.max(0, Number(this.playtestSession.shiftCooldownMs || 0) - seconds * 1000);
    const absSpeedBefore = Math.abs(this.playtestSession.speedMps);
    const wheelRpm = gearRatio
      ? (absSpeedBefore / Math.max(0.01, tuning.wheelRadiusM)) * gearRatio * tuning.finalDrive * (60 / (Math.PI * 2))
      : 0;
    const limiterPhase = Math.sin(this.playtestSession.elapsedMs / 34) > 0 ? 1 : 0;
    const neutralLimiterTarget = tuning.revLimitRpm - tuning.revLimiterDropRpm * limiterPhase;
    const neutralRevTarget = throttle ? neutralLimiterTarget : tuning.idleRpm;
    const loadedRpmTarget = gearRatio
      ? clamp(
        Math.max(wheelRpm * (1 + tuning.torqueConverterSlip * throttle), throttle ? Math.min(tuning.launchRpm, tuning.revLimitRpm) : tuning.idleRpm),
        tuning.idleRpm,
        tuning.revLimitRpm
      )
      : neutralRevTarget;
    const rpmResponse = gearRatio ? (throttle ? 4.6 : 8.5) : (throttle ? 7.6 : 3.8);
    this.playtestSession.engineRpm = Number(this.playtestSession.engineRpm || tuning.idleRpm)
      + (loadedRpmTarget - Number(this.playtestSession.engineRpm || tuning.idleRpm)) * Math.min(1, seconds * rpmResponse);
    this.playtestSession.engineRpm = clamp(this.playtestSession.engineRpm, tuning.idleRpm * 0.72, tuning.revLimitRpm + (gearRatio ? 40 : 80));
    const limiterActive = this.playtestSession.engineRpm >= tuning.revLimitRpm - 80;
    const limiterCut = limiterActive && throttle ? 0.08 + 0.18 * limiterPhase : 1;
    const shiftTorqueCut = this.playtestSession.shiftCooldownMs > 0
      ? clamp(1 - (this.playtestSession.shiftCooldownMs / Math.max(1, tuning.shiftTimeMs + this.getRaceDamageEffects().shiftDelayMs)), 0.12, 1)
      : 1;
    const torqueRpm = gearRatio && throttle && absSpeedBefore < 5
      ? Math.max(this.playtestSession.engineRpm, tuning.launchRpm)
      : this.playtestSession.engineRpm;
    const engineTorqueNm = this.getRaceTorqueNmAtRpm(torqueRpm, tuning) * damageEffects.enginePower * engineJitter;
    const availablePowerW = tuning.powerHp * 745.7 * damageEffects.enginePower * engineJitter;
    const wheelForceFromTorque = gearRatio
      ? (engineTorqueNm * gearRatio * tuning.finalDrive * tuning.drivetrainEfficiency) / tuning.wheelRadiusM
      : 0;
    const wheelForceFromPower = absSpeedBefore > 8
      ? (availablePowerW * tuning.drivetrainEfficiency) / Math.max(8, absSpeedBefore)
      : wheelForceFromTorque;
    const driveForceRaw = Math.min(wheelForceFromTorque, wheelForceFromPower) * throttle * limiterCut * shiftTorqueCut * driveDirection;
    const drivetrainTraction = tuning.drivetrain === 'awd' ? 0.6 : tuning.drivetrain === 'fwd' ? 0.5 : 0.47;
    const speedTractionGain = clamp(absSpeedBefore / 24, 0, 1) * 0.14;
    const tractionLimit = tuning.weightKg * 9.81 * Math.max(0.12, gripFactor) * (drivetrainTraction + speedTractionGain);
    const driveForce = clamp(driveForceRaw, -tractionLimit, tractionLimit);
    const wheelSpinRatio = driveForceRaw
      ? clamp(Math.abs(driveForceRaw) / Math.max(1, tractionLimit), 0, 1.8)
      : 0;
    const brakeForce = (brake * 292000 + handbrake * 126000) * Math.max(0.58, gripFactor);
    const rollingForce = 180 + absSpeedBefore * 10;
    const dragForce = (0.43 * absSpeedBefore * absSpeedBefore + rollingForce) * damageEffects.panelDrag;
    const resistanceDirection = this.playtestSession.speedMps >= 0 ? -1 : 1;
    const brakeDirection = this.playtestSession.speedMps >= 0 ? -1 : 1;
    const acceleration = (
      driveForce
      + resistanceDirection * dragForce
      + brakeDirection * brakeForce
    ) / tuning.weightKg;
    this.playtestSession.speedMps += acceleration * seconds;
    if (!throttle && Math.abs(this.playtestSession.speedMps) < 0.12) this.playtestSession.speedMps = 0;
    const topSpeedMps = tuning.topSpeedMps * damageEffects.enginePower;
    if (this.playtestSession.speedMps > topSpeedMps) {
      this.playtestSession.speedMps += (topSpeedMps - this.playtestSession.speedMps) * Math.min(1, seconds * 1.8);
    } else if (this.playtestSession.speedMps < -9) {
      this.playtestSession.speedMps += (-9 - this.playtestSession.speedMps) * Math.min(1, seconds * 3);
    }
    const routeRuntimeType = this.playtestSession.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const absSpeed = Math.abs(this.playtestSession.speedMps);
    const launchLockActive = Number(this.playtestSession.launchLockMs || 0) > 0 && absSpeed < 2.2;
    const roadSteer = this.raceInput.steeringWheel;
    const lateralDrift = roadSteer * absSpeed * seconds * 0.0014;
    this.playtestSession.lateral = clamp(
      Number(this.playtestSession.lateral || 0) * Math.max(0, 1 - seconds * 1.7) + lateralDrift,
      -0.22,
      0.22
    );
    const roadPose = this.getRaceWorldPoseAtDistance(this.playtestSession.distance);
    const roadYaw = roadPose.yaw;
    const previousCarYaw = Number.isFinite(this.playtestSession.carYaw)
      ? this.playtestSession.carYaw
      : roadYaw;
    const wheelbaseM = Math.max(2.1, Number(tuning.wheelbaseM || 2.67));
    const launchAligning = launchLockActive || (Number(this.playtestSession.elapsedMs || 0) <= 120 && absSpeed < 0.8);
    const effectiveRoadSteer = launchAligning ? 0 : roadSteer;
    const steeringAuthority = maxSteerAtSpeed;
    const steeringAngle = clamp(effectiveRoadSteer, -1, 1)
      * this.getRaceTireSteerAngleForSpeed(absSpeed)
      * steeringAuthority;
    const steeringSpeedScale = launchAligning ? 0 : clamp(absSpeed / 2.5, 0, 1);
    const highSpeedYawDamping = RACE_CONTROLLER_STEERING.highSpeedYawDampingFloor
      + (1 - Math.pow(clamp(absSpeed / 64, 0, 1), 0.9))
        * (1 - RACE_CONTROLLER_STEERING.highSpeedYawDampingFloor);
    const yawRate = (this.playtestSession.speedMps / wheelbaseM)
      * Math.tan(steeringAngle)
      * clamp(gripFactor, 0.32, 1.35)
      * steeringSpeedScale
      * highSpeedYawDamping;
    this.playtestSession.carYaw = launchAligning
      ? roadYaw
      : previousCarYaw + yawRate * seconds;
    this.playtestSession.worldX = Number(this.playtestSession.worldX || 0)
      + Math.sin(this.playtestSession.carYaw) * this.playtestSession.speedMps * seconds;
    this.playtestSession.worldZ = Number(this.playtestSession.worldZ || 0)
      + Math.cos(this.playtestSession.carYaw) * this.playtestSession.speedMps * seconds;
    const routeLength = Math.max(1, Number(this.playtestSession.routeLength || this.getRaceRouteLength()));
    const projection = this.getRaceRouteProjectionForWorldPoint({
      x: this.playtestSession.worldX,
      z: this.playtestSession.worldZ
    });
    const previousDistance = Number(this.playtestSession.previousDistance || this.playtestSession.distance || 0);
    const progressRoadYaw = this.getRaceWorldPoseAtDistance(previousDistance).yaw;
    const progressHeading = normalizeAngle(this.playtestSession.carYaw - progressRoadYaw);
    const routeAdvance = this.playtestSession.speedMps * Math.cos(progressHeading) * seconds;
    const integratedDistance = previousDistance + routeAdvance;
    if (routeRuntimeType === 'circuit') {
      const nextDistance = ((integratedDistance % routeLength) + routeLength) % routeLength;
      if (routeAdvance > 0 && previousDistance > routeLength * 0.72 && nextDistance < routeLength * 0.28) {
        this.playtestSession.lap += 1;
      }
      this.playtestSession.distance = nextDistance;
    } else {
      this.playtestSession.distance = clamp(integratedDistance, 0, routeLength);
      const finish = this.getRaceWorldPoseAtDistance(routeLength);
      const finishDx = Number(this.playtestSession.worldX || 0) - Number(finish.x || 0);
      const finishDz = Number(this.playtestSession.worldZ || 0) - Number(finish.z || 0);
      const finishRange = Math.max(this.getRaceRoadHalfWidthWorld() * 1.55, this.getRaceCarWorldWidth() * 5);
      const integratedFinish = integratedDistance >= routeLength;
      if ((this.playtestSession.distance >= routeLength - Math.max(4, this.getRaceCarWorldWidth() * 2)
        && Math.hypot(finishDx, finishDz) <= finishRange)
        || integratedFinish) {
        this.playtestSession.distance = routeLength;
        this.finishPlaytest();
        return;
      }
    }
    this.playtestSession.projectedDistance = routeRuntimeType === 'circuit'
      ? ((Number(projection.distance || 0) % routeLength) + routeLength) % routeLength
      : clamp(Number(projection.distance || this.playtestSession.distance || 0), 0, routeLength);
    this.playtestSession.heading = normalizeAngle(this.playtestSession.carYaw - roadYaw);
    this.playtestSession.cameraYaw = this.playtestSession.carYaw;
    const trackViewTarget = clamp(
      (-this.playtestSession.lateral * 0.24) + (this.playtestSession.heading * 0.66),
      -0.58,
      0.58
    );
    this.playtestSession.roadViewOffset += (trackViewTarget - Number(this.playtestSession.roadViewOffset || 0)) * Math.min(1, seconds * 3.2);
    this.playtestSession.rpm = clamp(this.playtestSession.engineRpm / tuning.revLimitRpm, 0, 1.08);
    this.updateRaceEngineAudio({ tuning, throttle, load: wheelSpinRatio });
    const lateralSlip = Math.abs(roadSteer) * clamp(absSpeed / 17, 0, 1) * 2.18;
    const brakeSlip = (brake + handbrake * 1.68) * clamp(absSpeed / 13, 0, 1) * 1.66;
    this.updateRaceTireAudio({
      slip: Math.max(Math.max(0, wheelSpinRatio - 0.92) * 0.85, lateralSlip, brakeSlip),
      surface: segmentInfo.segment?.surface,
      speedMps: absSpeed
    });
    if (this.raceInput.autoShift && gear > 0 && this.playtestSession.shiftCooldownMs <= 0 && throttle) {
      if ((this.playtestSession.engineRpm > tuning.autoUpshiftRpm || this.playtestSession.speedMps > this.getRaceRedlineSpeedMps(tuning, gear) * 0.98) && this.raceInput.gear < tuning.gearRatios.length) {
        this.shiftRaceGear(1);
      } else if (this.playtestSession.engineRpm < tuning.autoDownshiftRpm && this.raceInput.gear > 1) {
        this.shiftRaceGear(-1);
      }
    }
    this.playtestSession.steeringWheel = this.raceInput.steeringWheel;
    this.playtestSession.steeringTarget = this.raceInput.steeringTarget;
    this.playtestSession.gear = this.raceInput.gear;
    this.playtestSession.cameraView = this.raceInput.cameraView;
    this.playtestSession.handbrakeMs = Math.max(0, Number(this.playtestSession.handbrakeMs || 0) - seconds * 1000);
    if (handbrake) this.playtestSession.handbrakeMs = 180;
    this.updateRaceWearAndDamage(seconds);
  }

  updateRaceKeyboardInput(input) {
    const hasActiveDpadPointer = this.raceInput.activeDpadPointerId !== null
      && this.raceInput.activeDpadPointerId !== undefined;
    if (!this.playtestSession?.running || !input) {
      this.raceInput.keyboardThrottle = false;
      this.raceInput.keyboardBrake = false;
      this.raceInput.keyboardSteer = 0;
      if (!hasActiveDpadPointer) this.raceInput.binarySteer = 0;
      return;
    }
    const isDown = (action) => Boolean(input.isDown?.(action));
    const isDownCode = (code) => Boolean(input.isDownCode?.(code));
    const wasPressed = (action) => Boolean(input.wasPressed?.(action));
    const wasPressedCode = (code) => Boolean(input.wasPressedCode?.(code));
    const gamepadActions = this.game?.input?.gamepadActions || input.gamepadActions || {};
    const gamepadPressed = this.game?.input?.gamepadPressed || input.gamepadPressed || new Set();
    const isGamepadDown = (action) => Boolean(gamepadActions[action]);
    const wasGamepadPressed = (action) => Boolean(gamepadPressed?.has?.(action));
    this.raceInput.throttlePulseMs = Math.max(0, Number(this.raceInput.throttlePulseMs || 0) - 16);
    if (wasPressed('interact') || wasPressedCode('KeyG') || wasGamepadPressed('jump')) {
      this.raceInput.throttlePulseMs = 120;
    }
    this.raceInput.keyboardThrottle = isDownCode('KeyG') || isDown('interact') || isDown('attack') || isGamepadDown('jump') || this.raceInput.throttlePulseMs > 0;
    this.raceInput.keyboardBrake = isDownCode('KeyR') || isDown('rev') || isGamepadDown('dash');
    this.raceInput.keyboardSteer = (isDown('right') || isDownCode('ArrowRight') || isDownCode('KeyD') ? 1 : 0)
      - (isDown('left') || isDownCode('ArrowLeft') || isDownCode('KeyA') ? 1 : 0);
    const dpadSteer = (isGamepadDown('dpadRight') ? 1 : 0) - (isGamepadDown('dpadLeft') ? 1 : 0);
    const digitalSteer = this.raceInput.keyboardSteer || dpadSteer;
    if (digitalSteer) {
      this.raceInput.binarySteer = digitalSteer;
    } else if (!hasActiveDpadPointer) {
      this.raceInput.binarySteer = 0;
    }
    if (wasPressed('up') || wasPressedCode('ArrowUp') || wasPressedCode('KeyW') || wasGamepadPressed('throw')) {
      this.shiftRaceGear(1);
    }
    if (wasPressed('down') || wasPressedCode('ArrowDown') || wasPressedCode('KeyS') || wasGamepadPressed('rev')) {
      this.shiftRaceGear(-1);
    }
    if ((wasPressedCode('KeyR') || wasGamepadPressed('dash')) && this.raceInput.keyboardBrake) {
      const now = Date.now();
      if (now - Number(this.raceInput.lastBrakeTapMs || 0) < 260) this.raceInput.handbrake = true;
      this.raceInput.lastBrakeTapMs = now;
    }
  }

  getRaceMaxSteerForSpeed(speedMps = 0) {
    const speed = Math.max(0, Number(speedMps) || 0);
    const speedFactor = clamp(speed / RACE_CONTROLLER_STEERING.speedReferenceMps, 0, 1);
    const authority = RACE_CONTROLLER_STEERING.highwayAuthority
      + (1 - Math.pow(speedFactor, 0.82))
        * (RACE_CONTROLLER_STEERING.stoppedAuthority - RACE_CONTROLLER_STEERING.highwayAuthority);
    return clamp(authority, RACE_CONTROLLER_STEERING.highwayAuthority, RACE_CONTROLLER_STEERING.stoppedAuthority);
  }

  getRaceBinarySteerAssist(speedMps = 0) {
    const speed = Math.max(0, Number(speedMps) || 0);
    const speedFactor = clamp(speed / RACE_CONTROLLER_STEERING.speedReferenceMps, 0, 1);
    return {
      maxSteer: 1,
      steeringAuthority: this.getRaceMaxSteerForSpeed(speed),
      response: RACE_CONTROLLER_STEERING.digitalResponseBase
        + (1 - Math.pow(speedFactor, 0.7)) * RACE_CONTROLLER_STEERING.digitalResponseLowSpeedBonus
    };
  }

  getRaceAnalogSteerResponse(speedMps = 0) {
    const speed = Math.max(0, Number(speedMps) || 0);
    const speedFactor = clamp(speed / RACE_CONTROLLER_STEERING.speedReferenceMps, 0, 1);
    return RACE_CONTROLLER_STEERING.analogResponseBase
      + (1 - Math.pow(speedFactor, 0.82)) * RACE_CONTROLLER_STEERING.analogResponseLowSpeedBonus;
  }

  getRaceTireSteerAngleForSpeed(speedMps = 0) {
    const speed = Math.max(0, Number(speedMps) || 0);
    const speedFactor = clamp(speed / 64, 0, 1);
    return RACE_CONTROLLER_STEERING.highwayTireAngleRad
      + (1 - Math.pow(speedFactor, 0.72))
        * (RACE_CONTROLLER_STEERING.parkingTireAngleRad - RACE_CONTROLLER_STEERING.highwayTireAngleRad);
  }

  getRaceSteeringWheelDisplayDegrees(speedMps = this.playtestSession?.speedMps || 0) {
    const speed = Math.max(0, Math.abs(Number(speedMps) || 0));
    const speedFactor = clamp(speed / (100 * MPH_TO_MPS), 0, 1);
    return 20 + (1 - Math.pow(speedFactor, 0.62)) * (540 - 20);
  }

  getRaceVisibleSteeringWheelRotationRad(steering = this.raceInput.steeringWheel, speedMps = this.playtestSession?.speedMps || 0) {
    return clamp(Number(steering) || 0, -1, 1)
      * (this.getRaceSteeringWheelDisplayDegrees(speedMps) * Math.PI / 180);
  }

  getRaceSteeringReturnRate(speedMps = 0) {
    const speed = Math.max(0, Number(speedMps) || 0);
    return RACE_CONTROLLER_STEERING.returnRateBase
      + clamp(speed / 38, 0, 1) * RACE_CONTROLLER_STEERING.returnRateHighSpeedBonus;
  }

  applyRaceAnalogInput() {
    const axes = this.game?.input?.gamepadAxes;
    const heldThrottle = this.raceInput.activeThrottlePointerId !== null
      && this.raceInput.activeThrottlePointerId !== undefined;
    const heldBrake = this.raceInput.activeBrakePointerId !== null
      && this.raceInput.activeBrakePointerId !== undefined;
    if (!axes) {
      this.raceInput.analogSteeringActive = false;
      this.raceInput.throttle = heldThrottle || this.raceInput.keyboardThrottle;
      this.raceInput.brake = heldBrake || this.raceInput.keyboardBrake;
      return;
    }
    const leftX = Number(axes.leftX || 0);
    const rightTrigger = Number(axes.rightTrigger || 0);
    const leftTrigger = Number(axes.leftTrigger || 0);
    if (Math.abs(leftX) > 0.08) {
      const shaped = Math.sign(leftX) * Math.pow(Math.abs(leftX), 1.18);
      this.raceInput.steeringTarget = clamp(shaped, -1, 1);
      this.raceInput.analogSteeringActive = true;
    } else {
      this.raceInput.analogSteeringActive = false;
    }
    this.raceInput.throttle = heldThrottle || this.raceInput.keyboardThrottle || rightTrigger > 0.18;
    this.raceInput.brake = heldBrake || this.raceInput.keyboardBrake || leftTrigger > 0.18;
  }

  adjustRaceSteering(delta = 0) {
    const maxSteer = this.getRaceMaxSteerForSpeed(this.playtestSession?.speedMps || 0);
    this.raceInput.steeringTarget = clamp(
      Number(this.raceInput.steeringTarget || 0) + Number(delta || 0),
      -maxSteer,
      maxSteer
    );
  }

  shiftRaceGear(delta = 0) {
    const session = this.playtestSession;
    if (session?.shiftCooldownMs > 0) return;
    const car = session ? (this.project.cars.find((candidate) => candidate.id === session.carId) || this.selectedCar) : this.selectedCar;
    const tuning = this.getRaceCarTuning(car);
    const damage = session ? this.getRaceSessionDamage() : this.createRaceDamageState();
    const next = clamp(Math.round(Number(this.raceInput.gear ?? 0) + Number(delta || 0)), -1, tuning.gearRatios.length);
    if (session && Number(damage.transmission || 0) >= 82 && next >= 5) {
      session.damagedGears = Array.from(new Set([...(session.damagedGears || []), next]));
      this.applyRaceDamage('transmission', 1.5);
      return;
    }
    this.raceInput.gear = next;
    if (session) {
      session.shiftCooldownMs = tuning.shiftTimeMs + this.getRaceDamageEffects().shiftDelayMs;
      session.gear = next;
      if (session.rpm > 0.92) this.applyRaceDamage('transmission', 1.2);
    }
  }

  toggleRaceCameraView() {
    this.raceInput.cameraView = this.raceInput.cameraView === 'first-person' ? 'third-person' : 'first-person';
    if (this.playtestSession) this.playtestSession.cameraView = this.raceInput.cameraView;
  }

  toggleRacePause() {
    this.raceInput.paused = !this.raceInput.paused;
  }

  toggleRaceTransmissionMode() {
    const car = this.playtestSession
      ? (this.project.cars.find((candidate) => candidate.id === this.playtestSession.carId) || this.selectedCar)
      : this.selectedCar;
    const available = car?.transmissions || {};
    const current = this.getRaceTransmissionType(car);
    const next = current === 'manual' && available.automatic ? 'automatic' : 'manual';
    const tuning = this.getRaceCarTuning(car, { transmissionType: next });
    this.raceInput.transmissionMode = next;
    this.raceInput.autoShift = tuning.shiftMode !== 'manual';
    if (this.playtestSession) {
      this.playtestSession.transmissionType = next;
      this.playtestSession.engineSoundProfile = this.getRaceEngineProfileForTransmission(car, tuning);
      if (this.raceInput.autoShift && this.raceInput.gear === 0) {
        this.raceInput.gear = 1;
        this.playtestSession.gear = 1;
      }
    }
    this.status = `${car.name} transmission: ${next === 'manual' ? 'Manual' : 'Automatic'}`;
  }

  getNextCoDriverCall() {
    const session = this.playtestSession;
    if (!session) return null;
    const lookAheadDistance = Number(session.distance || 0) + clamp(Math.abs(Number(session.speedMps || 0)) * 3.2, 80, 260);
    const segmentCue = this.getRaceSegmentCoDriverCue(this.getRaceSegmentAtDistance(lookAheadDistance));
    if (!session.codriverCalls?.length) return segmentCue;
    const sorted = [...session.codriverCalls].sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));
    const explicit = sorted.find((call) => {
      const at = Number(call.at) || 0;
      return at >= session.distance && at <= Number(session.distance || 0) + 280;
    });
    return explicit || segmentCue || sorted.find((call) => (Number(call.at) || 0) >= session.distance) || sorted[0];
  }

  getUpcomingHazard() {
    const session = this.playtestSession;
    if (!session?.hazards?.length) return null;
    const sorted = [...session.hazards].sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));
    return sorted.find((hazard) => (Number(hazard.at) || 0) >= session.distance) || sorted[0];
  }

  findRootForAction(action) {
    const spec = getEditorMenuSpec(this.editorId);
    if (this.activeViewportMode === 'portrait') {
      const portraitRoot = buildRacePortraitMenuModel(this.editorId).rootTabs.find((entry) => (
        spec?.sections?.[entry.id]?.actions?.includes(action)
        || spec?.sections?.[entry.panel]?.actions?.includes(action)
        || spec?.sections?.[entry.specId]?.actions?.includes(action)
      ));
      if (portraitRoot) return portraitRoot.id;
    }
    return (spec?.root || []).find((rootId) => spec.sections?.[rootId]?.actions?.includes(action)) || null;
  }

  drawDesktop(ctx, width, height) {
    const openDesktopRootId = this.playtestPickerOpen
      ? null
      : resolveDesktopDropdownRootId({
        openRootId: this.openDesktopDropdownRootId,
        closedRootId: this.closedDesktopDropdownRootId
      });
    const shell = buildDesktopEditorShellPlan(this.editorId, {
      viewportWidth: width,
      viewportHeight: height,
      activeRootId: openDesktopRootId,
      dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0
    });
    this.activeShellModeContract = shell.modeContract;
    this.desktopDropdown = resolveDesktopDropdownState({
      isDesktop: true,
      dropdown: shell.dropdown ? { ...shell.dropdown, bounds: shell.dropdown.panelBounds || shell.dropdown.bounds } : null,
      previousDropdown: this.desktopDropdown
    });
    this.editorBounds = { ...shell.workSurface };
    ctx.fillStyle = UI_SUITE.colors.background;
    ctx.fillRect(0, 0, width, height);
    drawSharedDesktopTopMenu(ctx, shell.topMenu, {
      registerButton: (button) => {
        this.buttons.push(createDesktopRootMenuHit(button, () => {
            if (this.openDesktopDropdownRootId === button.id && !this.closedDesktopDropdownRootId) {
              const nextDropdown = resolveClosedDesktopDropdownState({
                dropdown: this.desktopDropdown,
                openRootId: this.openDesktopDropdownRootId,
                fallbackRootId: button.id
              });
              this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
              this.openDesktopDropdownRootId = nextDropdown.openRootId;
              this.desktopDropdown = nextDropdown.dropdown;
              return;
            }
            const nextDropdown = resolveOpenDesktopDropdownState({
              rootId: button.id,
              currentOpenRootId: this.openDesktopDropdownRootId,
              closedRootId: this.closedDesktopDropdownRootId,
              dropdown: this.desktopDropdown
            });
            if (nextDropdown) {
              this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
              this.openDesktopDropdownRootId = nextDropdown.openRootId;
              this.desktopDropdown = nextDropdown.dropdown;
            }
          }));
      }
    });
    drawSharedDesktopRibbon(ctx, shell.leftRibbon, {
      title: this.mode === 'car' ? 'Car' : 'Race',
      subtitle: shell.dropdown?.label || this.title
    });
    this.drawDesktopContext(ctx, shell.leftOptions);
    drawSharedPanel(ctx, shell.workSurface, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    const previewBounds = {
      x: shell.workSurface.x + 12,
      y: shell.workSurface.y + 12,
      w: Math.max(1, shell.workSurface.w - 24),
      h: Math.max(1, shell.workSurface.h - 24)
    };
    if (this.playtestSession) {
      this.drawRacePlaytestScreen(ctx, previewBounds);
    } else if (this.mode === 'race') {
      this.drawRaceTopDownEditor(ctx, previewBounds);
    } else {
      this.drawMode7Preview(ctx, previewBounds);
    }
    if (shell.dropdown) {
      const dropdownItems = this.getMenuItems(shell.dropdown.rootId);
      const dropdownForRender = shell.dropdown.rootId === 'drive' && this.playtestSession
        ? {
          ...shell.dropdown,
          visibleRows: Math.max(Number(shell.dropdown.visibleRows) || 1, dropdownItems.length)
        }
        : shell.dropdown;
      const dropdownPlan = buildDesktopDropdownRenderPlan({
        dropdown: this.desktopDropdown?.rootId === shell.dropdown.rootId ? { ...this.desktopDropdown, ...dropdownForRender } : dropdownForRender,
        items: dropdownItems,
        useVisibleItemsSlice: true,
        disableActionlessItems: true
      });
      drawSharedDesktopDropdown(ctx, dropdownPlan, {
        isActive: (item) => item.id === this.activeAction,
        registerScrollRegion: (region) => {
          this.menuScrollRegions.push(region);
        },
        registerButton: ({ item, bounds }) => {
          const action = item.onSelect ? () => item.onSelect() : null;
          this.buttons.push(createDesktopDropdownCommandHit(item, bounds, action));
        }
      });
    }
    if (this.playtestPickerOpen) {
      this.drawPlaytestPicker(ctx, width, height);
    }
  }

  drawDesktopContext(ctx, bounds) {
    const race = this.selectedRace;
    const car = this.selectedCar;
    const lines = this.mode === 'car'
      ? [
        `Car: ${car.name}`,
        `Drivetrain: ${car.tuning.drivetrain.toUpperCase()}`,
        `Power: ${car.tuning.powerHp} hp`,
        `Weight: ${car.tuning.weightKg} kg`,
        `Tire grip: ${car.tuning.tireGrip}`,
        `Final drive: ${car.tuning.gearFinalDrive}`,
        `Active: ${this.activeAction || 'None'}`
      ]
      : [
        `Race: ${race.name}`,
        `Route: ${this.getSelectedRaceRuntimeType() === 'circuit' ? 'endpoints joined' : 'open finish'}`,
        `Segments: ${race.road.segments.length}`,
        `Selected: ${this.selectedSegmentIndex + 1}`,
        `Length: ${this.selectedSegment?.length || 0}`,
        `Curve/Elev: ${Number(this.selectedSegment?.curve || 0).toFixed(2)} / ${Number(this.selectedSegment?.elevation || 0).toFixed(2)}`,
        `Surface: ${getSurfaceById(this.selectedSegment?.surface).label}`,
        `Weather: ${race.weather}`,
        `Time: ${race.timeOfDay || 'day'}`,
        `Active: ${this.activeAction || 'None'}`
      ];
    drawSharedDesktopContextPanel(ctx, bounds, {
      title: this.title,
      lines,
      contentRoles: ['document-summary', 'selection-summary', 'status'],
      status: this.status
    });
  }

  drawPortrait(ctx, width, height) {
    const layout = getSharedMobilePortraitEditorLayout(width, height, {
      middleRailHeight: 88,
      maxBottomRailHeight: 92,
      sheetRatio: 0.58
    });
    this.raceMapZoomSliderBounds = null;
    ctx.fillStyle = UI_SUITE.colors.background;
    ctx.fillRect(0, 0, width, height);
    drawSharedPanel(ctx, layout.workSurface, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    this.editorBounds = { ...layout.workSurface };
    if (this.mode === 'race') {
      this.drawRaceTopDownEditor(ctx, {
        x: layout.workSurface.x + 8,
        y: layout.workSurface.y + 8,
        w: Math.max(1, layout.workSurface.w - 16),
        h: Math.max(1, layout.workSurface.h - 16)
      });
    } else {
      this.drawMode7Preview(ctx, {
      x: layout.workSurface.x + 8,
      y: layout.workSurface.y + 8,
      w: Math.max(1, layout.workSurface.w - 16),
      h: Math.max(1, layout.workSurface.h - 16)
      });
    }
    const portraitActionById = {
      menu: { id: 'menu', label: 'Menu', onClick: () => { this.mobileRootOpen = !this.mobileRootOpen; } },
      undo: this.getRailAction('undo', 'Undo', () => this.handleMenuAction('undo')),
      redo: this.getRailAction('redo', 'Redo', () => this.handleMenuAction('redo')),
      'race-context': this.getRacePortraitContextAction(),
      'test-drive': { id: 'test-drive', label: 'Play', onClick: () => this.handleMenuAction('test-drive') }
    };
    const actions = buildRacePortraitMenuModel(this.editorId).bottomRailActions
      .map((id) => portraitActionById[id])
      .filter(Boolean);
    if (canRenderEditorSurface(this.activeViewportMode, 'bottom-action-rail')) {
      drawSharedPortraitActionRail(ctx, layout.actionRail, this.portraitThumbstick, actions, {
        reserveThumbstick: canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick'),
        drawButton: (bounds, action) => this.registerDrawnButton(ctx, bounds, action)
      });
    }
    const portraitRailIds = new Set(['menu', 'undo', 'redo', this.getRacePortraitContextAction().id]);
    const portraitRailButtons = actions
      .map((action) => this.buttons.find((button) => button.id === action.id && portraitRailIds.has(button.id)))
      .filter(Boolean);
    if (portraitRailButtons.length) {
      const railButtonSet = new Set(portraitRailButtons);
      this.buttons = [
        ...portraitRailButtons,
        ...this.buttons.filter((button) => !railButtonSet.has(button))
      ];
    }
    if (this.mode === 'race') {
      this.drawRacePortraitZoomSlider(ctx, {
        x: layout.workSurface.x + 36,
        y: Math.max(layout.workSurface.y + 84, layout.workSurface.y + layout.workSurface.h - 128),
        w: Math.max(1, layout.workSurface.w - 72),
        h: 26
      });
      this.drawRacePortraitModePanel(ctx, {
        x: layout.workSurface.x + 12,
        y: layout.workSurface.y + layout.workSurface.h - 92,
        w: Math.max(1, layout.workSurface.w - 24),
        h: 84
      });
    }
    if (this.mobileRootOpen) {
      this.drawPortraitMenuSheet(ctx, layout);
    }
    if (this.playtestPickerOpen) {
      this.drawPlaytestPicker(ctx, width, height);
    }
  }

  drawRacePortraitZoomSlider(ctx, bounds) {
    if (!bounds || bounds.w <= 0 || bounds.h <= 0) return;
    const rail = {
      x: bounds.x + 10,
      y: bounds.y + Math.floor((bounds.h - 10) / 2),
      w: Math.max(1, bounds.w - 20),
      h: 10
    };
    this.raceMapZoomSliderBounds = {
      x: rail.x,
      y: bounds.y - 8,
      w: rail.w,
      h: bounds.h + 16
    };
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,7,0.72)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(217,230,210,0.22)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    drawSharedMobileZoomSlider(ctx, rail, this.getRaceMapZoomRatio(), {
      knobColor: UI_SUITE.colors.accent,
      alpha: 0.96
    });
    ctx.restore();
    this.buttons.push({
      id: 'race-map-zoom',
      bounds: { ...this.raceMapZoomSliderBounds, id: 'race-map-zoom' },
      onClick: ({ x }) => this.updateRaceMapZoomFromSliderX(x)
    });
  }

  drawPortraitMenuSheet(ctx, layout) {
    drawSharedPanel(ctx, layout.menuSheet, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    const roots = buildRacePortraitMenuModel(this.editorId).rootTabs;
    this.drawActionRows(ctx, layout.rootRail, roots.map((entry) => ({
      id: entry.id,
      label: entry.label,
      active: this.activeRootId === entry.id,
      onClick: () => {
        this.activeRootId = entry.id;
        if (['race', 'ground', 'elevation'].includes(entry.id)) {
          this.setRacePortraitMode(entry.id);
          this.activeRootId = null;
          this.menuScrollRegions = [];
          this.menuScrollDrag = null;
          this.pendingMenuScrollHit = null;
        }
      }
    })), Math.max(1, roots.length), { scrollKey: `${this.editorId}:portrait-root` });
    const items = this.getMenuItems(this.activeRootId);
    this.drawActionRows(ctx, layout.subRail, items.map((item) => ({
      id: item.id,
      label: item.label,
      active: item.id === this.activeAction,
      disabled: Boolean(item.disabled),
      onClick: item.onSelect
    })), 2, { scrollKey: `${this.editorId}:portrait-sub:${this.activeRootId}` });
  }

  drawLandscape(ctx, width, height) {
    const gamepadMenuState = this.getGamepadMenuState(width, height);
    const gamepad = gamepadMenuState.isLandscapeMenuMode;
    const shell = buildLandscapeTouchEditorShellPlan(this.editorId, {
      viewportWidth: width,
      viewportHeight: height,
      bottomRailHeight: 68,
      reserveRightRail: !gamepadMenuState.isLandscapeMenuMode,
      reserveThumbstickSpace: false
    });
    const canRenderLandscapeBottomRail = canRenderEditorPlanSurface(shell, 'bottom-tool-rail');
    const canRenderLandscapeRightSubmenu = canRenderEditorPlanSurface(shell, 'right-drawer')
      && canRenderEditorPlanSurface(shell, 'landscape-right-submenu');
    const canRenderLandscapeRootDrawer = canRenderEditorPlanSurface(shell, 'left-overlay-drawer');
    const landscapeToolOptionsSurface = canRenderLandscapeBottomRail ? shell.surfaces.toolOptions : null;
    const landscapeSubmenuSurface = canRenderLandscapeRightSubmenu ? shell.surfaces.submenu : null;
    const landscapeRootDrawerSurface = canRenderLandscapeRootDrawer ? shell.surfaces.rootDrawer : null;
    this.activeShellModeContract = shell.modeContract;
    ctx.fillStyle = UI_SUITE.colors.background;
    ctx.fillRect(0, 0, width, height);
    drawSharedPanel(ctx, shell.surfaces.workSurface, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    this.editorBounds = { ...shell.surfaces.workSurface };
    if (this.mode === 'race') {
      this.drawRaceTopDownEditor(ctx, {
        x: shell.surfaces.workSurface.x + 8,
        y: shell.surfaces.workSurface.y + 8,
        w: Math.max(1, shell.surfaces.workSurface.w - 16),
        h: Math.max(1, shell.surfaces.workSurface.h - 16)
      });
    } else {
      this.drawMode7Preview(ctx, {
      x: shell.surfaces.workSurface.x + 8,
      y: shell.surfaces.workSurface.y + 8,
      w: Math.max(1, shell.surfaces.workSurface.w - 16),
      h: Math.max(1, shell.surfaces.workSurface.h - 16)
      });
    }
    if (this.mode === 'race') {
      this.drawRaceBuilderOverlay(ctx, {
        x: shell.surfaces.workSurface.x + 12,
        y: shell.surfaces.workSurface.y + shell.surfaces.workSurface.h - 68,
        w: Math.max(1, shell.surfaces.workSurface.w - 24),
        h: 56
      }, { compact: true });
    }
    const gamepadMenuOpen = gamepadMenuState.isLandscapeMenuMode && (this.mobileRootOpen || this.gamepadSubmenuOpen);
    if (!gamepadMenuOpen) {
      drawSharedPanel(ctx, shell.surfaces.compactCommandRail, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
      const railActions = buildCompactLandscapeCommandRailActions({
        menu: { id: 'menu', label: 'Menu', onClick: () => this.toggleRootMenu({ gamepad }) },
        undo: this.getRailAction('undo', 'Undo', () => this.handleMenuAction('undo')),
        redo: this.getRailAction('redo', 'Redo', () => this.handleMenuAction('redo')),
        quick: this.mode === 'race'
          ? { id: 'generate-random-race', label: 'Gen', onClick: () => this.handleMenuAction('generate-random-race') }
          : { id: 'test-drive', label: 'Play', onClick: () => this.handleMenuAction('test-drive') }
      });
      buildCompactLandscapeCommandRailButtonLayout({
        bounds: shell.surfaces.compactCommandRail,
        actions: railActions
      }).forEach(({ action, bounds }) => this.registerDrawnButton(ctx, bounds, action));
    }
    if (landscapeToolOptionsSurface) {
      this.drawLandscapeToolOptions(ctx, landscapeToolOptionsSurface);
    }
    if (gamepadMenuState.isLandscapeMenuMode) {
      const menuPlan = buildGamepadSlideOutMenuPlan(this.editorId, {
        rootOpen: this.mobileRootOpen,
        activeRootId: this.activeRootId,
        focusedItemId: this.gamepadFocusedItemId || null
      });
      this.activeGamepadMenuModeContract = menuPlan.modeContract;
      if (this.mobileRootOpen) {
        this.drawLandscapeRootDrawer(ctx, landscapeRootDrawerSurface || shell.surfaces.rootDrawer, {
          gamepad: true,
          rootEntries: menuPlan.rootEntries,
          headerHint: menuPlan.headerHint
        });
      } else if (this.gamepadSubmenuOpen) {
        this.drawLandscapeSubmenu(ctx, landscapeRootDrawerSurface || shell.surfaces.rootDrawer, {
          gamepad: true,
          title: menuPlan.submenu?.title || 'Menu',
          headerHint: menuPlan.headerHint,
          items: menuPlan.submenu?.items,
          scrollKey: `${this.editorId}:gamepad-sub:${menuPlan.activeRootId || this.activeRootId}`
        });
      }
    } else if (this.mobileRootOpen) {
      this.drawLandscapeRootDrawer(ctx, landscapeRootDrawerSurface || shell.surfaces.rootDrawer);
      if (landscapeSubmenuSurface) {
        this.drawLandscapeSubmenu(ctx, landscapeSubmenuSurface);
      }
    } else if (!gamepad && landscapeSubmenuSurface) {
      this.drawLandscapeSubmenu(ctx, landscapeSubmenuSurface);
    }
    if (gamepadMenuState.isLandscapeMenuMode && canRenderEditorSurface(this.activeViewportMode, 'gamepad-hint-bar')) {
      this.drawGamepadHintBar(ctx, {
        x: shell.surfaces.workSurface.x + 12,
        y: shell.surfaces.workSurface.y + shell.surfaces.workSurface.h - 36,
        w: Math.max(240, shell.surfaces.workSurface.w - 24),
        h: 28
      }, this.mode === 'car' ? 'Car Editor' : 'Race Editor');
    }
    if (this.playtestPickerOpen) {
      this.drawPlaytestPicker(ctx, width, height);
    }
  }

  drawGamepadHintBar(ctx, bounds, contextLabel) {
    drawSharedGamepadHintBar(ctx, bounds, contextLabel, SHARED_EDITOR_GAMEPAD_HINTS);
  }

  getRaceHandheldLayout(width, height) {
    return height >= width
      ? getPortraitHandheldLayout(width, height)
      : getLandscapeHandheldLayout(width, height);
  }

  drawMobileRacePlaytest(ctx, width, height) {
    const layout = this.getRaceHandheldLayout(width, height);
    ctx.fillStyle = '#050807';
    ctx.fillRect(0, 0, width, height);
    this.drawRaceHandheldShell(ctx, layout);
    this.editorBounds = { ...layout.screen };
    this.drawRacePlaytestScreen(ctx, layout.screen);
    this.drawRaceHandheldControls(ctx, layout);
  }

  drawRaceHandheldShell(ctx, layout) {
    const portrait = layout.device.h >= layout.device.w;
    const sharedShell = portrait
      ? this.game?.drawPortraitHandheldShell
      : this.game?.drawLandscapeHandheldShell;
    if (typeof sharedShell === 'function') {
      sharedShell.call(this.game, ctx, layout);
      return;
    }
    ctx.save();
    ctx.fillStyle = portrait ? '#27312d' : '#101615';
    ctx.fillRect(layout.device.x, layout.device.y, layout.device.w, layout.device.h);
    if (portrait) {
      ctx.fillStyle = '#151a18';
      ctx.fillRect(layout.screenOuter.x, layout.screenOuter.y, layout.screenOuter.w, layout.screenOuter.h);
      ctx.strokeStyle = 'rgba(150,176,160,0.35)';
      ctx.strokeRect(layout.screenOuter.x, layout.screenOuter.y, layout.screenOuter.w, layout.screenOuter.h);
    } else {
      ctx.fillStyle = '#111816';
      ctx.fillRect(layout.leftRail.x, layout.leftRail.y, layout.leftRail.w, layout.leftRail.h);
      ctx.fillRect(layout.rightRail.x, layout.rightRail.y, layout.rightRail.w, layout.rightRail.h);
      ctx.strokeStyle = 'rgba(150,176,160,0.28)';
      ctx.strokeRect(layout.leftRail.x, layout.leftRail.y, layout.leftRail.w, layout.leftRail.h);
      ctx.strokeRect(layout.rightRail.x, layout.rightRail.y, layout.rightRail.w, layout.rightRail.h);
    }
    ctx.fillStyle = '#050706';
    ctx.fillRect(layout.screenSlot.x, layout.screenSlot.y, layout.screenSlot.w, layout.screenSlot.h);
    ctx.strokeStyle = 'rgba(150,176,160,0.34)';
    ctx.strokeRect(layout.screenSlot.x, layout.screenSlot.y, layout.screenSlot.w, layout.screenSlot.h);
    ctx.fillStyle = '#07100d';
    ctx.fillRect(layout.screen.x, layout.screen.y, layout.screen.w, layout.screen.h);
    layout.speakerSlots?.forEach((slot) => {
      ctx.fillStyle = 'rgba(5,8,7,0.78)';
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    });
    ctx.restore();
  }

  drawRacePlaytestScreen(ctx, bounds) {
    const cameraView = this.raceInput.cameraView;
    this.drawMode7Preview(ctx, bounds, {
      playtest: true,
      showScaffoldText: false,
      showPlaytestHud: false
    });
    if (cameraView === 'first-person') {
      this.drawRaceSteeringWheel(ctx, bounds);
    } else {
      this.drawRaceThirdPersonCar(ctx, bounds);
    }
    this.drawRacePlaytestHud(ctx, bounds);
    if (this.raceInput.paused) this.drawRacePauseOverlay(ctx, bounds);
  }

  drawRaceThirdPersonCar(ctx, bounds) {
    const lateral = clamp(Number(this.playtestSession?.lateral || 0), -1.2, 1.2);
    const centerX = bounds.x + bounds.w / 2 + lateral * bounds.w * 0.055;
    const y = bounds.y + bounds.h * 0.74;
    const carW = this.getRaceThirdPersonCarWidth(bounds);
    const carH = clamp(carW * 0.74, Math.max(28, bounds.h * 0.13), bounds.h * 0.2);
    const damage = this.getRaceSessionDamage();
    const totalDamage = Math.max(
      this.getMaxDamage(damage.panels),
      Number(damage.engine || 0),
      Number(damage.transmission || 0),
      this.getMaxDamage(damage.suspension),
      this.getAverageDamage(damage.tires)
    );
    const steering = clamp(Number(this.raceInput.steeringWheel || 0), -1, 1);
    const wheelW = carW * 0.16;
    const wheelH = carH * 0.36;
    const drawWheel = (x, y, turn = 0) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(turn);
      ctx.fillStyle = '#050807';
      ctx.fillRect(-wheelW / 2, -wheelH / 2, wheelW, wheelH);
      ctx.restore();
    };
    drawWheel(centerX - carW * 0.38, y - carH * 0.24, steering * 0.55);
    drawWheel(centerX + carW * 0.38, y - carH * 0.24, steering * 0.55);
    drawWheel(centerX - carW * 0.38, y + carH * 0.28, 0);
    drawWheel(centerX + carW * 0.38, y + carH * 0.28, 0);
    ctx.fillStyle = this.getDamageColor(totalDamage);
    ctx.beginPath();
    ctx.moveTo(centerX, y - carH * 0.64);
    ctx.lineTo(centerX + carW * 0.34, y - carH * 0.16);
    ctx.lineTo(centerX + carW * 0.46, y + carH * 0.46);
    ctx.lineTo(centerX - carW * 0.46, y + carH * 0.46);
    ctx.lineTo(centerX - carW * 0.34, y - carH * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#58d6ff';
    ctx.fillRect(centerX - carW * 0.2, y - carH * 0.22, carW * 0.4, carH * 0.22);
    if (this.raceInput.brake || this.raceInput.handbrake) {
      ctx.fillStyle = '#ff4f4f';
      ctx.fillRect(centerX - carW * 0.42, y + carH * 0.38, carW * 0.2, carH * 0.12);
      ctx.fillRect(centerX + carW * 0.22, y + carH * 0.38, carW * 0.2, carH * 0.12);
    }
  }

  drawRaceSteeringWheel(ctx, bounds) {
    const wheelX = bounds.x + bounds.w / 2;
    const wheelY = bounds.y + bounds.h * 0.82;
    const wheelR = Math.max(34, Math.min(bounds.w, bounds.h) * 0.13);
    const rotation = this.getRaceVisibleSteeringWheelRotationRad(
      this.raceInput.steeringWheel,
      this.playtestSession?.speedMps || 0
    );
    ctx.fillStyle = 'rgba(5,8,7,0.78)';
    ctx.fillRect(bounds.x, bounds.y + bounds.h * 0.78, bounds.w, bounds.h * 0.22);
    ctx.save();
    ctx.translate(wheelX, wheelY);
    ctx.rotate(rotation);
    ctx.strokeStyle = '#d9e6d2';
    ctx.lineWidth = Math.max(4, wheelR * 0.08);
    ctx.beginPath();
    ctx.arc?.(0, 0, wheelR, 0, Math.PI * 2);
    if (typeof ctx.arc !== 'function') ctx.strokeRect(-wheelR, -wheelR, wheelR * 2, wheelR * 2);
    else ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-wheelR * 0.75, 0);
    ctx.lineTo(wheelR * 0.75, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, wheelR * 0.72);
    ctx.stroke();
    ctx.restore();
  }

  drawRacePlaytestHud(ctx, bounds) {
    const session = this.playtestSession;
    if (!session) return;
    const speedMph = Math.round((this.playtestSession?.speedMps || 0) * 2.23694);
    const progress = (this.playtestSession?.distance || 0) / Math.max(1, this.playtestSession?.routeLength || 1);
    const nextCall = this.getNextCoDriverCall();
    this.drawRacePlaytestTopControls(ctx, bounds);
    this.drawRaceTrackMinimap(ctx, {
      x: bounds.x + 5,
      y: bounds.y + 31,
      w: Math.min(92, Math.max(64, bounds.w * 0.22)),
      h: Math.min(92, Math.max(64, bounds.h * 0.22))
    });
    if (nextCall?.text) {
      const callW = Math.min(bounds.w * 0.42, 132);
      const call = { x: bounds.x + 5, y: bounds.y + 5, w: callW, h: 22 };
      ctx.fillStyle = 'rgba(5,8,7,0.58)';
      ctx.fillRect(call.x, call.y, call.w, call.h);
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `700 8px ${UI_SUITE.font.family}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(nextCall.text, call.x + 6, call.y + 11, call.w - 12);
    }
    this.drawRaceTimePanel(ctx, bounds);
    this.drawRaceCarStatusPanel(ctx, bounds);
    this.drawRaceTachPanel(ctx, bounds, { speedMph, progress });
  }

  drawRacePlaytestTopControls(ctx, bounds) {
    const controls = [
      {
        id: 'race-pause-toggle',
        label: this.raceInput.paused ? 'Resume' : 'Pause',
        onClick: () => this.toggleRacePause()
      },
      {
        id: 'race-return-editor',
        label: 'Editor',
        onClick: () => this.endPlaytest()
      },
      {
        id: 'race-exit-main',
        label: 'Main Menu',
        onClick: () => this.exitPlaytestToMainMenu()
      }
    ];
    const gap = 4;
    const h = 20;
    const widths = controls.map((control) => {
      if (control.id === 'race-pause-toggle') return 48;
      if (control.id === 'race-exit-main') return 76;
      return 56;
    });
    const totalW = widths.reduce((sum, width) => sum + width, 0) + gap * (controls.length - 1);
    let x = bounds.x + bounds.w - totalW - 5;
    const y = bounds.y + 5;
    controls.forEach((control, index) => {
      const rect = { x, y, w: widths[index], h };
      this.registerDrawnButton(ctx, rect, control);
      x += widths[index] + gap;
    });
  }

  drawRaceTrackMinimap(ctx, bounds) {
    const session = this.playtestSession;
    const segments = this.selectedRace?.road?.segments || [];
    if (!session || !segments.length) return;
    const mapBounds = {
      x: bounds.x + 6,
      y: bounds.y + 6,
      w: Math.max(1, bounds.w - 12),
      h: Math.max(1, bounds.h - 12)
    };
    const samples = this.getRacePathSamples({ step: 28 });
    if (samples.length < 2) return;
    const minX = Math.min(...samples.map((point) => Number(point.x || 0)));
    const maxX = Math.max(...samples.map((point) => Number(point.x || 0)));
    const minZ = Math.min(...samples.map((point) => Number(point.z || 0)));
    const maxZ = Math.max(...samples.map((point) => Number(point.z || 0)));
    const pad = Math.max(4, Math.min(mapBounds.w, mapBounds.h) * 0.08);
    const usableW = Math.max(1, mapBounds.w - pad * 2);
    const usableH = Math.max(1, mapBounds.h - pad * 2);
    const scale = Math.min(
      usableW / Math.max(1, maxX - minX),
      usableH / Math.max(1, maxZ - minZ)
    );
    const toScreen = (point) => ({
      x: mapBounds.x + pad + (Number(point.x || 0) - minX) * scale + (usableW - (maxX - minX) * scale) / 2,
      y: mapBounds.y + pad + (Number(point.z || 0) - minZ) * scale + (usableH - (maxZ - minZ) * scale) / 2
    });
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,7,0.52)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(217,230,210,0.64)';
    ctx.beginPath();
    samples.forEach((point, index) => {
      const screen = toScreen(point);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    const routeRuntimeType = session.routeRuntimeType || this.getSelectedRaceRuntimeType();
    if (routeRuntimeType === 'circuit') ctx.closePath();
    ctx.stroke();
    const player = toScreen({
      x: Number.isFinite(session.worldX) ? session.worldX : this.getRaceWorldPoseAtDistance(session.distance).x,
      z: Number.isFinite(session.worldZ) ? session.worldZ : this.getRaceWorldPoseAtDistance(session.distance).z
    });
    const start = toScreen(samples[0]);
    const finish = toScreen(samples[samples.length - 1]);
    ctx.fillStyle = '#f1f4ef';
    ctx.fillRect(start.x - 2, start.y - 2, 4, 4);
    if (routeRuntimeType !== 'circuit') {
      ctx.fillStyle = '#ff4f4f';
      ctx.fillRect(finish.x - 2, finish.y - 2, 4, 4);
    }
    this.drawRaceMinimapCar(ctx, player, Number(session.carYaw || 0), scale);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 6px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(routeRuntimeType === 'circuit' ? `L${session.lap}` : `${Math.round((session.distance / Math.max(1, session.routeLength)) * 100)}%`, bounds.x + 5, bounds.y + 4);
    ctx.restore();
  }

  drawRaceMinimapCar(ctx, player, yaw = 0, scale = 1) {
    const size = clamp(10 + Number(scale || 1) * 0.08, 11, 18);
    const forward = {
      x: Math.sin(Number(yaw) || 0),
      y: Math.cos(Number(yaw) || 0)
    };
    const right = {
      x: Math.cos(Number(yaw) || 0),
      y: -Math.sin(Number(yaw) || 0)
    };
    const nose = { x: player.x + forward.x * size * 1.02, y: player.y + forward.y * size * 1.02 };
    const frontLeft = { x: player.x + forward.x * size * 0.42 - right.x * size * 0.48, y: player.y + forward.y * size * 0.42 - right.y * size * 0.48 };
    const frontRight = { x: player.x + forward.x * size * 0.42 + right.x * size * 0.48, y: player.y + forward.y * size * 0.42 + right.y * size * 0.48 };
    const rearLeft = { x: player.x - forward.x * size * 0.78 - right.x * size * 0.42, y: player.y - forward.y * size * 0.78 - right.y * size * 0.42 };
    const rearRight = { x: player.x - forward.x * size * 0.78 + right.x * size * 0.42, y: player.y - forward.y * size * 0.78 + right.y * size * 0.42 };
    ctx.strokeStyle = '#050807';
    ctx.lineWidth = Math.max(1.2, size * 0.12);
    ctx.fillStyle = '#58d6ff';
    ctx.beginPath();
    ctx.moveTo(nose.x, nose.y);
    ctx.lineTo(frontRight.x, frontRight.y);
    ctx.lineTo(rearRight.x, rearRight.y);
    ctx.lineTo(rearLeft.x, rearLeft.y);
    ctx.lineTo(frontLeft.x, frontLeft.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#050807';
    [
      { x: frontLeft.x, y: frontLeft.y },
      { x: frontRight.x, y: frontRight.y },
      { x: rearLeft.x, y: rearLeft.y },
      { x: rearRight.x, y: rearRight.y }
    ].forEach((wheel) => {
      ctx.beginPath();
      ctx.arc?.(wheel.x, wheel.y, Math.max(1.1, size * 0.1), 0, Math.PI * 2);
      ctx.fill?.();
    });
    ctx.fillStyle = '#10222c';
    ctx.beginPath();
    ctx.moveTo(player.x + forward.x * size * 0.25, player.y + forward.y * size * 0.25);
    ctx.lineTo(player.x - forward.x * size * 0.34 + right.x * size * 0.24, player.y - forward.y * size * 0.34 + right.y * size * 0.24);
    ctx.lineTo(player.x - forward.x * size * 0.34 - right.x * size * 0.24, player.y - forward.y * size * 0.34 - right.y * size * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f2d45c';
    ctx.beginPath();
    ctx.arc?.(nose.x, nose.y, Math.max(1.3, size * 0.13), 0, Math.PI * 2);
    ctx.fill?.();
    ctx.strokeStyle = '#f1f4ef';
    ctx.lineWidth = Math.max(1.2, size * 0.11);
    ctx.beginPath();
    ctx.moveTo(player.x - forward.x * size * 0.68, player.y - forward.y * size * 0.68);
    ctx.lineTo(player.x + forward.x * size * 1.36, player.y + forward.y * size * 1.36);
    ctx.lineTo(player.x + forward.x * size * 1.02 + right.x * size * 0.28, player.y + forward.y * size * 1.02 + right.y * size * 0.28);
    ctx.moveTo(player.x + forward.x * size * 1.36, player.y + forward.y * size * 1.36);
    ctx.lineTo(player.x + forward.x * size * 1.02 - right.x * size * 0.28, player.y + forward.y * size * 1.02 - right.y * size * 0.28);
    ctx.stroke();
  }

  formatRaceTime(ms = 0) {
    const totalSeconds = Math.max(0, Number(ms) || 0) / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((totalSeconds * 10) % 10);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
  }

  formatRaceGear(gear = this.raceInput.gear) {
    const value = Math.round(Number(gear ?? 0));
    if (value < 0) return 'R';
    if (value === 0) return 'N';
    return String(value);
  }

  drawRaceTimePanel(ctx, bounds) {
    const session = this.playtestSession;
    const panelW = Math.min(86, Math.max(66, bounds.w * 0.2));
    const panel = { x: bounds.x + bounds.w - panelW - 4, y: bounds.y + 4, w: panelW, h: 25 };
    ctx.fillStyle = 'rgba(5,8,7,0.58)';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 8px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.formatRaceTime(session.elapsedMs), panel.x + panel.w - 5, panel.y + 9);
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `6px ${UI_SUITE.font.family}`;
    const routeRuntimeType = session.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const lapText = routeRuntimeType === 'circuit'
      ? `Lap ${session.lap}/${this.selectedRace.laps || 1}`
      : `${Math.round(clamp((session.distance || 0) / Math.max(1, session.routeLength || 1), 0, 1) * 100)}%`;
    ctx.fillText(lapText, panel.x + panel.w - 5, panel.y + 20);
  }

  drawRaceTachPanel(ctx, bounds, { speedMph = 0, progress = 0 } = {}) {
    const panelW = Math.min(92, Math.max(72, bounds.w * 0.21));
    const panel = { x: bounds.x + bounds.w - panelW - 4, y: bounds.y + bounds.h - 42, w: panelW, h: 38 };
    const rpm = clamp(Number(this.playtestSession?.rpm || 0), 0, 1.08);
    const center = { x: panel.x + 22, y: panel.y + 26 };
    const radius = Math.min(16, panel.h * 0.42);
    const startAngle = Math.PI * 0.86;
    const endAngle = Math.PI * 2.14;
    const rpmRatio = clamp(rpm / 1.08, 0, 1);
    const needleAngle = startAngle + (endAngle - startAngle) * rpmRatio;
    ctx.fillStyle = 'rgba(5,8,7,0.6)';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(217,230,210,0.28)';
    ctx.beginPath();
    ctx.arc?.(center.x, center.y, radius, startAngle, endAngle);
    ctx.stroke?.();
    ctx.strokeStyle = '#ff4f4f';
    ctx.beginPath();
    ctx.arc?.(center.x, center.y, radius, startAngle + (endAngle - startAngle) * 0.86, endAngle);
    ctx.stroke?.();
    ctx.strokeStyle = rpm > 0.92 ? '#ff4f4f' : rpm > 0.78 ? '#f2d45c' : UI_SUITE.colors.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(center.x + Math.cos(needleAngle) * (radius - 7), center.y + Math.sin(needleAngle) * (radius - 7));
    ctx.stroke?.();
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.beginPath();
    ctx.arc?.(center.x, center.y, 3, 0, Math.PI * 2);
    ctx.fill?.();
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 10px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.formatRaceGear(), panel.x + panel.w - 6, panel.y + 11);
    ctx.font = `700 7px ${UI_SUITE.font.family}`;
    ctx.fillText(`${speedMph} mph`, panel.x + panel.w - 6, panel.y + 23);
    ctx.fillStyle = '#ff4f4f';
    ctx.font = `700 6px ${UI_SUITE.font.family}`;
    ctx.fillText('RED', panel.x + panel.w - 6, panel.y + 32);
    const bar = { x: panel.x + 7, y: panel.y + panel.h - 6, w: panel.w - 14, h: 2 };
    ctx.fillStyle = UI_SUITE.colors.panelAlt;
    ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
    ctx.fillStyle = 'rgba(217,230,210,0.35)';
    ctx.fillRect(bar.x, bar.y - 5, bar.w * clamp(progress, 0, 1), 2);
  }

  drawRaceCarStatusPanel(ctx, bounds) {
    const damage = this.getRaceSessionDamage();
    const panelW = Math.min(84, Math.max(68, bounds.w * 0.19));
    const panel = { x: bounds.x + 4, y: bounds.y + bounds.h - 48, w: panelW, h: 44 };
    const car = { x: panel.x + panel.w / 2 - 12, y: panel.y + 12, w: 24, h: 26 };
    const wheel = { w: 5, h: 7 };
    const drawPart = (rect, value) => {
      ctx.fillStyle = this.getDamageColor(value);
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = 'rgba(5,8,7,0.72)';
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    };
    const drawWheelPart = (x, y, tireValue, suspensionValue, side = 'left') => {
      drawPart({ x, y, w: wheel.w, h: wheel.h }, tireValue);
      const suspensionX = side === 'right' ? x - 6 : x + wheel.w + 2;
      drawPart({ x: suspensionX, y: y + 3, w: 4, h: Math.max(2, wheel.h - 5) }, suspensionValue);
    };
    ctx.fillStyle = 'rgba(5,8,7,0.6)';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    drawWheelPart(panel.x + 8, car.y + 4, damage.tires.fl, damage.suspension.fl, 'left');
    drawWheelPart(panel.x + 8, car.y + car.h - 12, damage.tires.rl, damage.suspension.rl, 'left');
    drawWheelPart(panel.x + panel.w - 13, car.y + 4, damage.tires.fr, damage.suspension.fr, 'right');
    drawWheelPart(panel.x + panel.w - 13, car.y + car.h - 12, damage.tires.rr, damage.suspension.rr, 'right');
    drawPart({ x: car.x + 5, y: car.y, w: car.w - 10, h: 5 }, damage.panels.front);
    drawPart({ x: car.x + 5, y: car.y + car.h - 5, w: car.w - 10, h: 5 }, damage.panels.rear);
    drawPart({ x: car.x, y: car.y + 5, w: 5, h: car.h - 10 }, damage.panels.left);
    drawPart({ x: car.x + car.w - 5, y: car.y + 5, w: 5, h: car.h - 10 }, damage.panels.right);
    drawPart({ x: car.x + 9, y: car.y + 7, w: 11, h: 9 }, damage.engine);
    drawPart({ x: car.x + 9, y: car.y + 19, w: 10, h: 8 }, damage.transmission);
  }

  drawRacePauseOverlay(ctx, bounds) {
    const car = this.playtestSession
      ? (this.project.cars.find((candidate) => candidate.id === this.playtestSession.carId) || this.selectedCar)
      : this.selectedCar;
    const transmissionType = this.getRaceTransmissionType(car);
    const panel = {
      x: bounds.x + Math.max(12, bounds.w * 0.16),
      y: bounds.y + Math.max(24, bounds.h * 0.18),
      w: Math.max(220, bounds.w * 0.68),
      h: 158
    };
    drawSharedPanel(ctx, panel, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.accent });
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 18px ${UI_SUITE.font.family}`;
    ctx.fillText('Race Paused', panel.x + 16, panel.y + 30);
    const transmission = { x: panel.x + 16, y: panel.y + 54, w: panel.w - 32, h: 32 };
    this.registerDrawnButton(ctx, transmission, {
      id: 'race-transmission-toggle',
      label: `Transmission: ${transmissionType === 'manual' ? 'Manual' : 'Automatic'}`,
      onClick: () => this.toggleRaceTransmissionMode()
    });
    const resume = { x: panel.x + 16, y: panel.y + 96, w: panel.w - 32, h: 36 };
    this.registerDrawnButton(ctx, resume, {
      id: 'race-resume',
      label: 'Resume',
      onClick: () => this.toggleRacePause()
    });
  }

  drawRaceHandheldControls(ctx, layout) {
    const dpad = layout.dpad;
    ctx.fillStyle = '#070a0a';
    ctx.fillRect(dpad.x + dpad.w * 0.38, dpad.y, dpad.w * 0.24, dpad.h);
    ctx.fillRect(dpad.x, dpad.y + dpad.h * 0.38, dpad.w, dpad.h * 0.24);
    this.buttons.push({ id: 'race-dpad', bounds: { ...dpad, id: 'race-dpad' }, onClick: null, playtestControl: 'dpad' });
    const drawRoundButton = (button, id, label, control, active = false) => {
      const bounds = { x: button.x - button.r, y: button.y - button.r, w: button.r * 2, h: button.r * 2, id };
      ctx.fillStyle = active ? UI_SUITE.colors.accent : '#101416';
      ctx.beginPath();
      ctx.arc?.(button.x, button.y, button.r, 0, Math.PI * 2);
      if (typeof ctx.arc === 'function') ctx.fill();
      else ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.strokeStyle = 'rgba(217,230,210,0.42)';
      ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.fillStyle = active ? '#08100d' : UI_SUITE.colors.text;
      ctx.font = `700 16px ${UI_SUITE.font.family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, button.x, button.y);
      this.buttons.push({ id, bounds, playtestControl: control });
    };
    drawRoundButton(layout.buttons.jump, 'race-go', 'G', 'go', this.raceInput.throttle);
    drawRoundButton(layout.buttons.a, 'race-brake', 'R', 'brake', this.raceInput.brake || this.raceInput.handbrake);
    this.registerDrawnButton(ctx, layout.start, { id: 'race-start', label: 'START', onClick: () => this.toggleRacePause() });
    this.registerDrawnButton(ctx, layout.select, { id: 'race-select', label: 'SELECT', onClick: () => this.toggleRaceCameraView() });
  }

  handleRaceDpadPoint(bounds, payload, { analog = false } = {}) {
    const relX = ((payload.x - bounds.x) / Math.max(1, bounds.w)) * 2 - 1;
    const relY = ((payload.y - bounds.y) / Math.max(1, bounds.h)) * 2 - 1;
    if (analog) {
      this.raceInput.steeringTarget = clamp(relX, -1, 1);
      this.raceInput.analogSteeringActive = true;
      return;
    }
    this.raceInput.analogSteeringActive = false;
    if (Math.abs(relY) > 0.44 && Math.abs(relX) < 0.34) {
      this.raceInput.binarySteer = 0;
      if (relY < -0.18) this.shiftRaceGear(1);
      if (relY > 0.18) this.shiftRaceGear(-1);
    } else if (Math.abs(relX) > 0.18) {
      this.raceInput.binarySteer = relX < 0 ? -1 : 1;
    } else {
      this.raceInput.binarySteer = 0;
    }
  }

  handleRacePlaytestPointerDown(hit, payload = {}) {
    if (!hit) return false;
    if (hit.playtestControl === 'dpad') {
      this.raceInput.activeDpadPointerId = payload.id ?? 'pointer';
      this.handleRaceDpadPoint(hit.bounds, payload);
      return true;
    }
    if (hit.playtestControl === 'go') {
      this.raceInput.throttle = true;
      this.raceInput.activeThrottlePointerId = payload.id ?? 'pointer';
      return true;
    }
    if (hit.playtestControl === 'brake') {
      const now = Date.now();
      this.raceInput.handbrake = now - Number(this.raceInput.lastBrakeTapMs || 0) < 280;
      this.raceInput.lastBrakeTapMs = now;
      this.raceInput.brake = true;
      this.raceInput.activeBrakePointerId = payload.id ?? 'pointer';
      return true;
    }
    hit.onClick?.();
    return true;
  }

  isDesktopMode() {
    return this.activeViewportMode === 'desktop';
  }

  isPointInBounds(point = {}, bounds = {}) {
    return Number(point.x) >= Number(bounds.x || 0)
      && Number(point.x) <= Number(bounds.x || 0) + Number(bounds.w || 0)
      && Number(point.y) >= Number(bounds.y || 0)
      && Number(point.y) <= Number(bounds.y || 0) + Number(bounds.h || 0);
  }

  beginDesktopPreviewDrag(payload = {}) {
    if (!this.isDesktopMode() || !this.editorBounds || this.playtestSession) return false;
    const pointerPolicy = getEditorPointerInteractionPolicy(this.editorId, {
      mode: 'desktop',
      pointerType: payload.pointerType || 'mouse'
    });
    const shouldPanWithButton = (
      (payload.button === 1 && pointerPolicy.workSurfaceGestures.middleDragPan)
      || (payload.button === 2 && pointerPolicy.workSurfaceGestures.rightDragPan)
    );
    if (!shouldPanWithButton || !this.isPointInBounds(payload, this.editorBounds)) return false;
    this.desktopPreviewDrag = {
      id: payload.id ?? 'pointer',
      startX: Number(payload.x) || 0,
      startY: Number(payload.y) || 0,
      startPreviewOffset: Number(this.previewOffset || 0)
    };
    return true;
  }

  updateDesktopPreviewDrag(payload = {}) {
    if (!this.desktopPreviewDrag) return false;
    const id = payload.id ?? 'pointer';
    if (id !== this.desktopPreviewDrag.id) return false;
    const dy = (Number(payload.y) || 0) - this.desktopPreviewDrag.startY;
    const dx = (Number(payload.x) || 0) - this.desktopPreviewDrag.startX;
    this.previewOffset = ((this.desktopPreviewDrag.startPreviewOffset - dy * 0.8 - dx * 0.25) % 240 + 240) % 240;
    return true;
  }

  drawPlaytestPicker(ctx, width, height) {
    const panelW = Math.min(width - 28, this.preRaceTuningOpen ? 620 : 460);
    const panelH = Math.min(height - 28, this.preRaceTuningOpen ? 520 : 342);
    const bounds = {
      x: Math.max(14, (width - panelW) / 2),
      y: Math.max(14, (height - panelH) / 2),
      w: panelW,
      h: panelH
    };
    ctx.fillStyle = 'rgba(5, 8, 13, 0.72)';
    ctx.fillRect(0, 0, width, height);
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.accent });
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 18px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.preRaceTuningOpen ? 'Pre-Race Tuning' : 'Choose Race Car', bounds.x + 18, bounds.y + 28);
    ctx.font = `12px ${UI_SUITE.font.family}`;
    ctx.fillStyle = UI_SUITE.colors.muted;
    const race = this.selectedRace;
    const aiCount = race.competition?.aiDrivers?.filter((driver) => driver.enabled).length || 0;
    const hazardCount = race.hazards?.length || 0;
    const callCount = race.codriver?.enabled ? (race.codriver.calls?.length || 0) : 0;
    ctx.fillText(`${race.name} • ${race.competition?.mode || 'solo'} • AI ${aiCount} • Hazards ${hazardCount} • Calls ${callCount}`, bounds.x + 18, bounds.y + 52);

    if (this.preRaceTuningOpen) {
      this.drawPreRaceTuningPanel(ctx, {
        x: bounds.x + 16,
        y: bounds.y + 72,
        w: bounds.w - 32,
        h: bounds.h - 124
      });
      const back = { x: bounds.x + 18, y: bounds.y + bounds.h - 44, w: 92, h: 32 };
      const start = { x: bounds.x + bounds.w - 118, y: bounds.y + bounds.h - 44, w: 100, h: 32 };
      this.registerDrawnButton(ctx, back, { id: 'pre-race-back', label: 'Back', onClick: () => { this.preRaceTuningOpen = false; } });
      this.registerDrawnButton(ctx, start, { id: 'pre-race-start', label: 'Start', onClick: () => this.startPlaytest(this.project.selectedCarId) });
      return;
    }

    const rowY = bounds.y + 76;
    const rowH = 44;
    const cars = this.project.cars.length ? this.project.cars : [this.selectedCar];
    cars.slice(0, 4).forEach((car, index) => {
      const tuning = car.tuning || {};
      const buttonBounds = {
        x: bounds.x + 18,
        y: rowY + index * (rowH + 8),
        w: bounds.w - 36,
        h: rowH
      };
      this.drawButton(ctx, buttonBounds, `${car.name}  ${String(tuning.drivetrain || '').toUpperCase()}  ${tuning.powerHp || 0}hp`, car.id === this.project.selectedCarId);
      this.buttons.push({
        id: `playtest-car-${car.id}`,
        bounds: { ...buttonBounds, id: `playtest-car-${car.id}` },
        onClick: () => {
          this.project.selectedCarId = car.id;
          this.status = `Selected ${car.name}`;
        }
      });
    });

    const cancel = { x: bounds.x + 18, y: bounds.y + bounds.h - 48, w: 92, h: 34 };
    const tuning = { x: bounds.x + bounds.w - 222, y: bounds.y + bounds.h - 48, w: 96, h: 34 };
    const start = { x: bounds.x + bounds.w - 110, y: bounds.y + bounds.h - 48, w: 92, h: 34 };
    this.registerDrawnButton(ctx, cancel, { id: 'playtest-cancel', label: 'Cancel', onClick: () => this.cancelPlaytestPicker() });
    this.registerDrawnButton(ctx, tuning, { id: 'playtest-tuning', label: 'Tuning', onClick: () => { this.preRaceTuningOpen = true; } });
    this.registerDrawnButton(ctx, start, { id: 'playtest-start', label: 'Start', onClick: () => this.startPlaytest(this.project.selectedCarId) });
  }

  drawPreRaceTuningPanel(ctx, bounds) {
    const car = this.selectedCar;
    const setup = this.getRaceCarSetup(car);
    const tuning = car.tuning || {};
    const rowH = 24;
    const gap = 6;
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 12px ${UI_SUITE.font.family}`;
    ctx.fillText(`${car.name} setup`, bounds.x, bounds.y + 10, bounds.w);
    const wheelLabels = [
      ['fl', 'FL'],
      ['fr', 'FR'],
      ['rl', 'RL'],
      ['rr', 'RR']
    ];
    const tireY = bounds.y + 26;
    const tireW = Math.max(62, (bounds.w - gap * 3) / 4);
    wheelLabels.forEach(([wheelId, label], index) => {
      const compound = this.getRaceTireCompound(setup.tireCompoundByWheel[wheelId]);
      this.registerDrawnButton(ctx, {
        x: bounds.x + index * (tireW + gap),
        y: tireY,
        w: tireW,
        h: 30
      }, {
        id: `tire-${wheelId}`,
        label: `${label} ${compound.label}`,
        onClick: () => this.cycleRaceTireCompound(wheelId)
      });
    });
    const rows = [
      ['pressure-fl', 'FL Pressure', setup.tirePressurePsi.fl, 'psi'],
      ['pressure-fr', 'FR Pressure', setup.tirePressurePsi.fr, 'psi'],
      ['pressure-rl', 'RL Pressure', setup.tirePressurePsi.rl, 'psi'],
      ['pressure-rr', 'RR Pressure', setup.tirePressurePsi.rr, 'psi'],
      ['gearFinalDrive', 'Final Drive', tuning.gearFinalDrive, ''],
      ['camberFront', 'Camber F', tuning.camberFront || 0, 'deg'],
      ['camberRear', 'Camber R', tuning.camberRear || 0, 'deg'],
      ['antiRollFront', 'Sway F', tuning.antiRollFront, ''],
      ['antiRollRear', 'Sway R', tuning.antiRollRear, ''],
      ['springFront', 'Spring F', tuning.springFront, ''],
      ['springRear', 'Spring R', tuning.springRear, ''],
      ['rideHeightFront', 'Ride F', tuning.rideHeightFront || 0.5, ''],
      ['rideHeightRear', 'Ride R', tuning.rideHeightRear || 0.5, ''],
      ['bumpFront', 'Bump F', tuning.bumpFront || tuning.dampingFront, ''],
      ['reboundFront', 'Rebound F', tuning.reboundFront || tuning.dampingFront, ''],
      ['aeroFront', 'Aero F', tuning.aeroFront, ''],
      ['aeroRear', 'Aero R', tuning.aeroRear, ''],
      ['differentialAccel', 'Diff Accel', tuning.differentialAccel, ''],
      ['differentialDecel', 'Diff Decel', tuning.differentialDecel, '']
    ];
    const startY = tireY + 42;
    const columns = bounds.w > 430 ? 2 : 1;
    const colW = (bounds.w - gap * (columns - 1)) / columns;
    rows.forEach((row, index) => {
      const col = index % columns;
      const line = Math.floor(index / columns);
      const x = bounds.x + col * (colW + gap);
      const y = startY + line * (rowH + 5);
      if (y + rowH > bounds.y + bounds.h) return;
      this.drawTuningSliderRow(ctx, { x, y, w: colW, h: rowH }, row);
    });
  }

  drawTuningSliderRow(ctx, bounds, [id, label, value, suffix]) {
    ctx.fillStyle = 'rgba(217,230,210,0.08)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `700 9px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bounds.x + 6, bounds.y + bounds.h / 2, bounds.w * 0.34);
    const minus = { x: bounds.x + bounds.w - 92, y: bounds.y + 2, w: 24, h: bounds.h - 4 };
    const plus = { x: bounds.x + bounds.w - 26, y: bounds.y + 2, w: 24, h: bounds.h - 4 };
    const valueBounds = { x: minus.x + 28, y: bounds.y + 2, w: 38, h: bounds.h - 4 };
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.textAlign = 'center';
    const numeric = Number(value || 0);
    ctx.fillText(`${Math.abs(numeric) >= 10 ? numeric.toFixed(0) : numeric.toFixed(2)}${suffix ? ` ${suffix}` : ''}`, valueBounds.x + valueBounds.w / 2, bounds.y + bounds.h / 2, valueBounds.w);
    this.registerDrawnButton(ctx, minus, { id: `tune-${id}-down`, label: '-', onClick: () => this.adjustRaceTuningValue(id, -1) });
    this.registerDrawnButton(ctx, plus, { id: `tune-${id}-up`, label: '+', onClick: () => this.adjustRaceTuningValue(id, 1) });
  }

  drawRacePortraitModePanel(ctx, bounds) {
    drawSharedPanel(ctx, bounds, { fill: 'rgba(5,8,7,0.82)', border: UI_SUITE.colors.border });
    const pad = 8;
    const gap = 6;
    const selected = this.selectedSegment || {};
    const groundPalette = this.getRaceGroundTilePalette(this.getSelectedGroundTileId());
    const quickActions = this.racePortraitMode === 'ground'
      ? [
        { id: 'ground-tile-next', label: 'Tile', onClick: () => this.handleMenuAction('ground-tile-next') },
        { id: 'paint-ground', label: 'Paint', active: this.activeAction === 'paint-ground', onClick: () => this.handleMenuAction('paint-ground') }
      ]
      : this.racePortraitMode === 'elevation'
        ? [
          { id: 'elevation-up', label: 'Raise', active: this.raceElevationBrushDirection > 0, onClick: () => this.handleMenuAction('elevation-up') },
          { id: 'elevation-down', label: 'Lower', active: this.raceElevationBrushDirection < 0, onClick: () => this.handleMenuAction('elevation-down') },
          { id: 'elevation-brush-size', label: `Brush ${Math.round(this.raceElevationBrushSize * 100)}%`, onClick: () => this.handleMenuAction('elevation-brush-size') }
        ]
        : [
          ...(this.raceSelectionType === 'node'
            ? [
              { id: 'move-node', label: 'Move', active: this.activeAction === 'move-node', onClick: () => this.handleMenuAction('move-node') },
              { id: 'snap-node', label: 'Snap', onClick: () => this.handleMenuAction('snap-node') },
              { id: 'remove-node', label: 'Delete', onClick: () => this.handleMenuAction('remove-node') },
              { id: 'draw-road', label: 'Add', active: this.activeAction === 'draw-road', onClick: () => this.setRaceDrawNodeMode() }
            ]
            : [
              { id: 'cycle-surface', label: getSurfaceById(selected.surface).label.slice(0, 6), onClick: () => this.cycleSelectedSurface() },
              { id: 'segment-width', label: `${this.getRaceRoadWidthMForSegment(selected)}m`, onClick: () => this.handleMenuAction('segment-width') },
              { id: 'segment-bumpiness', label: `Bump ${Math.round((Number(selected.bumpiness) || 0) * 100)}%`, onClick: () => this.handleMenuAction('segment-bumpiness') },
              { id: 'insert-node', label: 'Insert', onClick: () => this.handleMenuAction('insert-node') },
              { id: 'remove-edge', label: 'Delete', onClick: () => this.handleMenuAction('remove-edge') }
            ])
        ];
    const quickW = Math.max(48, Math.floor((bounds.w - pad * 2 - gap * Math.max(0, quickActions.length - 1)) / Math.max(1, quickActions.length)));
    quickActions.forEach((action, index) => {
      this.registerDrawnButton(ctx, {
        x: bounds.x + pad + index * (quickW + gap),
        y: bounds.y + pad,
        w: quickW,
        h: 30
      }, action);
    });

    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `11px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const summary = this.racePortraitMode === 'ground'
      ? `Ground: ${groundPalette.label}`
      : this.racePortraitMode === 'elevation'
        ? `Elevation: ${this.raceElevationBrushDirection > 0 ? 'raise' : 'lower'} ${Math.round(this.raceElevationBrushSize * 100)}%`
        : this.raceSelectionType === 'node'
          ? `Node ${this.selectedSegmentIndex + 1}: drag to move, snap finish to Start`
          : `Edge ${this.selectedSegmentIndex + 1}: ${getSurfaceById(selected.surface).label}, ${this.getRaceRoadWidthMForSegment(selected)}m, bump ${Math.round((Number(selected.bumpiness) || 0) * 100)}%`;
    ctx.fillText(summary, bounds.x + pad, bounds.y + bounds.h - 7, Math.max(1, bounds.w - pad * 2));
    ctx.restore();
  }

  drawLandscapeRootDrawer(ctx, bounds, { gamepad = false, rootEntries = null, headerHint = null } = {}) {
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    if (gamepad) {
      drawSharedGamepadSlideOutHeader(ctx, bounds, 'Menu', { hint: headerHint || undefined });
    } else {
      ctx.save();
      ctx.fillStyle = UI_SUITE.colors.accent;
      ctx.font = `700 12px ${UI_SUITE.font.family}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Menu', bounds.x + 10, bounds.y + 20, Math.max(1, bounds.w - 20));
      ctx.restore();
    }
    const roots = rootEntries || getEditorRootMenuEntries(this.editorId);
    const grid = buildLandscapeRootDrawerGridLayout({
      bounds,
      itemCount: roots.length,
      padding: 10,
      gap: 8,
      rowHeight: bounds.w >= 340 ? 40 : 38,
      minRowHeight: 38,
      maxRowHeight: 42,
      headerHeight: gamepad ? 50 : 30
    });
    const scrollKey = `${this.editorId}:${gamepad ? 'gamepad' : 'landscape'}-root`;
    const scrolled = buildScrolledLandscapeRootDrawerItems(grid, this.menuScrollState?.[scrollKey] || 0);
    this.menuScrollState[scrollKey] = scrolled.scroll;
    if (scrolled.maxScroll > 0) {
      this.menuScrollRegions.push({
        menuId: scrollKey,
        bounds: { ...grid.listBounds },
        maxScroll: scrolled.maxScroll,
        lineHeight: scrolled.lineHeight,
        scrollScale: 1 / scrolled.lineHeight
      });
    }
    scrolled.items.forEach(({ index, bounds: buttonBounds }) => {
      const entry = roots[index];
      this.registerDrawnButton(ctx, buttonBounds, {
        id: entry.id,
        label: entry.label,
        active: this.activeRootId === entry.id,
        onClick: () => {
          this.activeRootId = entry.id;
          if (gamepad) this.gamepadFocusedItemId = entry.id;
          this.mobileRootOpen = !gamepad;
          this.gamepadSubmenuOpen = gamepad;
        }
      });
    });
  }

  drawLandscapeSubmenu(ctx, bounds, { items = null, scrollKey = null, gamepad = false, title = 'Menu', headerHint = null } = {}) {
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    const listBounds = gamepad
      ? { x: bounds.x, y: bounds.y + 50, w: bounds.w, h: Math.max(1, bounds.h - 50) }
      : bounds;
    if (gamepad) {
      drawSharedGamepadSlideOutHeader(ctx, bounds, title, { hint: headerHint || undefined });
    }
    const sourceItems = Array.isArray(items) ? items : this.getMenuItems(this.activeRootId);
    this.drawActionRows(ctx, listBounds, sourceItems.map((item) => ({
      id: item.id,
      label: item.label,
      active: item.id === this.activeAction,
      focused: gamepad && item.id === this.gamepadFocusedItemId,
      disabled: Boolean(item.disabled),
      onClick: () => {
        if (gamepad) this.gamepadFocusedItemId = item.id;
        item.onSelect?.();
      }
    })), 1, { scrollKey: scrollKey || `${this.editorId}:landscape-sub:${this.activeRootId}` });
  }

  drawLandscapeToolOptions(ctx, bounds) {
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    const pad = 10;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 13px ${UI_SUITE.font.family}`;
    ctx.fillText(this.mode === 'car' ? this.selectedCar.name : this.selectedRace.name, bounds.x + pad, bounds.y + 18, Math.max(1, bounds.w - 132));
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `11px ${UI_SUITE.font.family}`;
    const summary = this.mode === 'car'
      ? `${String(this.selectedCar.tuning?.drivetrain || '').toUpperCase()}  ${this.selectedCar.tuning?.powerHp || 0}hp  ${this.selectedCar.tuning?.weightKg || 0}kg`
      : `${this.getSelectedRaceRuntimeType() === 'circuit' ? 'endpoints joined' : 'open finish'}  ${this.selectedRace.weather}  ${this.selectedRace.road?.segments?.length || 0} segments`;
    ctx.fillText(summary, bounds.x + pad, bounds.y + 42, Math.max(1, bounds.w - 132));
    const status = this.playtestSession
      ? `Driving ${Math.round((this.playtestSession.distance / Math.max(1, this.playtestSession.routeLength)) * 100)}%`
      : this.status;
    ctx.fillText(status, bounds.x + pad, bounds.y + 60, Math.max(1, bounds.w - 132));
    ctx.restore();

    const quickActions = this.getRaceQuickActions({ compact: true });
    const button = {
      x: bounds.x + bounds.w - 112,
      y: bounds.y + Math.max(8, Math.round((bounds.h - 38) / 2)),
      w: 96,
      h: 38
    };
    if (!this.playtestSession && this.mode === 'race' && !this.mobileRootOpen && !this.gamepadSubmenuOpen) {
      const actionW = Math.min(92, Math.max(68, (bounds.w - 132) / quickActions.length - 8));
      quickActions.forEach((action, index) => {
        const x = bounds.x + bounds.w - 124 - (quickActions.length - index) * (actionW + 8);
        if (x < bounds.x + pad + 190) return;
        this.registerDrawnButton(ctx, {
          x,
          y: bounds.y + Math.max(8, Math.round((bounds.h - 34) / 2)),
          w: actionW,
          h: 34
        }, action);
      });
    }
    if (this.playtestSession) {
      this.registerDrawnButton(ctx, button, { id: 'end-playtest', label: 'End Drive', onClick: () => this.endPlaytest() });
    } else {
      this.registerDrawnButton(ctx, button, { id: 'test-drive', label: 'Play', onClick: () => this.handleMenuAction('test-drive') });
    }
  }

  drawActionRows(ctx, bounds, actions, columns = 1, { scrollKey = null } = {}) {
    const pad = bounds.h < 56 ? 4 : 8;
    const gap = 8;
    const safeColumns = Math.max(1, columns);
    const rowH = 38;
    const rowPitch = rowH + gap;
    const colW = Math.max(1, (bounds.w - pad * 2 - gap * (safeColumns - 1)) / safeColumns);
    const safeActions = Array.isArray(actions) ? actions : [];
    const totalRows = Math.max(1, Math.ceil(safeActions.length / safeColumns));
    const visibleRows = Math.max(1, Math.floor((bounds.h - pad * 2 + gap) / rowPitch));
    const maxScroll = Math.max(0, totalRows - visibleRows);
    const currentScroll = scrollKey
      ? Math.max(0, Math.min(maxScroll, Math.round(Number(this.menuScrollState?.[scrollKey] || 0))))
      : 0;
    if (scrollKey) {
      this.menuScrollState[scrollKey] = currentScroll;
      this.menuScrollRegions.push({
        menuId: scrollKey,
        bounds: { ...bounds },
        maxScroll,
        lineHeight: rowPitch,
        scrollScale: 1 / rowPitch
      });
    }
    safeActions.forEach((action, index) => {
      const col = index % safeColumns;
      const row = Math.floor(index / safeColumns) - currentScroll;
      if (row < 0) return;
      const buttonBounds = {
        x: bounds.x + pad + col * (colW + gap),
        y: bounds.y + pad + row * rowPitch,
        w: colW,
        h: rowH
      };
      if (buttonBounds.y + buttonBounds.h > bounds.y + bounds.h - pad) return;
      this.registerDrawnButton(ctx, buttonBounds, action);
    });
  }

  registerDrawnButton(ctx, bounds, action) {
    this.drawButton(ctx, bounds, action.displayLabel || action.label, Boolean(action.active), Boolean(action.disabled), {
      focused: Boolean(action.focused)
    });
    this.buttons.push({
      id: action.id,
      bounds: { ...bounds, id: action.id },
      disabled: Boolean(action.disabled),
      contextPanelCommand: Boolean(action.contextPanelCommand),
      onClick: action.disabled ? null : action.onClick
    });
  }

  registerRaceTileButton(ctx, bounds, action) {
    this.drawButton(ctx, bounds, action.label, Boolean(action.active), Boolean(action.disabled));
    this.buttons.push({
      id: action.id,
      bounds: { ...bounds, id: action.id },
      disabled: Boolean(action.disabled),
      raceTilePalette: true,
      onClick: action.disabled ? null : action.onClick
    });
  }

  getRaceBuilderActions({ compact = false } = {}) {
    if (this.mode === 'car') {
      return [
        { id: 'test-drive', label: 'Play', onClick: () => this.handleMenuAction('test-drive') }
      ];
    }
    const selected = this.selectedSegment;
    const surface = getSurfaceById(selected?.surface);
    return [
      { id: 'generate-random-race', label: compact ? 'Gen' : 'Generate', onClick: () => this.handleMenuAction('generate-random-race') },
      { id: 'draw-road', label: compact ? 'Add' : 'Add Seg', onClick: () => this.handleMenuAction('draw-road') },
      { id: 'segment-prev', label: 'Prev', onClick: () => this.selectAdjacentRaceSegment(-1) },
      { id: 'segment-next', label: 'Next', onClick: () => this.selectAdjacentRaceSegment(1) },
      { id: 'curve', label: 'Curve', onClick: () => this.handleMenuAction('curve') },
      { id: 'elevation', label: compact ? 'Hill' : 'Hill', onClick: () => this.handleMenuAction('elevation') },
      { id: 'cycle-surface', label: compact ? surface.label.slice(0, 4) : `Surface: ${surface.label}`, onClick: () => this.cycleSelectedSurface() },
      { id: 'test-drive', label: 'Play', onClick: () => this.handleMenuAction('test-drive') }
    ];
  }

  drawRaceBuilderOverlay(ctx, bounds, { compact = false } = {}) {
    if (this.playtestSession || this.playtestPickerOpen || this.mobileRootOpen || this.gamepadSubmenuOpen) return;
    const race = this.selectedRace;
    const selected = this.selectedSegment;
    const label = this.mode === 'car'
      ? `${this.selectedCar.name} tuning`
      : `Route ${this.selectedSegmentIndex + 1}/${race.road.segments.length}  Curve ${Number(selected?.curve || 0).toFixed(2)}  Hill ${Number(selected?.elevation || 0).toFixed(2)}`;
    ctx.fillStyle = 'rgba(5,8,7,0.72)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(217,230,210,0.22)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 ${compact ? 10 : 12}px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bounds.x + 10, bounds.y + (compact ? 11 : 15), Math.max(1, bounds.w - 20));
    const actions = this.getRaceBuilderActions({ compact });
    const gap = compact ? 5 : 7;
    const buttonY = bounds.y + (compact ? 22 : 30);
    const buttonH = compact ? 28 : 34;
    const buttonW = Math.max(42, (bounds.w - 20 - gap * (actions.length - 1)) / actions.length);
    actions.forEach((action, index) => {
      const buttonBounds = {
        x: bounds.x + 10 + index * (buttonW + gap),
        y: buttonY,
        w: buttonW,
        h: buttonH
      };
      this.registerDrawnButton(ctx, buttonBounds, action);
    });
  }

  drawRacePanel(ctx, bounds) {
    const race = this.selectedRace;
    const selected = this.selectedSegment;
    const selectedSurface = getSurfaceById(selected?.surface);
    const aiCount = race.competition?.aiDrivers?.filter((driver) => driver.enabled).length || 0;
    const hazardCount = race.hazards?.length || 0;
    const callCount = race.codriver?.enabled ? (race.codriver.calls?.length || 0) : 0;
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 16px ${UI_SUITE.font.family}`;
    ctx.fillText(race.name, bounds.x + 14, bounds.y + 24);
    ctx.font = `12px ${UI_SUITE.font.family}`;
    ctx.fillStyle = UI_SUITE.colors.muted;
    const routeRuntimeType = this.getSelectedRaceRuntimeType();
    const routeLengthLabel = this.formatRaceRouteLengthKm();
    const lines = [
      `Route: ${routeRuntimeType === 'circuit' ? 'endpoints joined' : 'open finish'}`,
      routeRuntimeType === 'circuit' ? `Laps: ${race.laps}` : 'Finish: route end',
      `Weather: ${race.weather}`,
      `Time: ${race.timeOfDay || 'day'}`,
      `Segments: ${race.road.segments.length}`,
      `Road length: ${routeLengthLabel}`,
      `Selected: ${this.selectedSegmentIndex + 1}`,
      `Length: ${selected?.length || 0}`,
      `Curve: ${Number(selected?.curve || 0).toFixed(2)}`,
      `Elevation: ${Number(selected?.elevation || 0).toFixed(2)}`,
      `Surface: ${selectedSurface.label}`,
      `Road width: ${this.getRaceRoadWidthMForSegment(selected)} m`,
      `Bumpiness: ${Math.round((Number(selected?.bumpiness) || 0) * 100)}%`,
      selected?.surface === 'snow' ? `Snow: ${this.getSnowConditionById(selected.snowCondition).label}` : '',
      `Mode: ${race.competition?.mode || 'solo'}`,
      `AI: ${aiCount}  Hazards: ${hazardCount}`,
      `Co-driver: ${callCount} calls`,
      `Finish: ${race.finishBehavior.type}`,
      '',
      'Generate creates an open-finish route',
      'Add/Curve/Hill edit your route'
    ];
    lines.forEach((line, index) => ctx.fillText(line, bounds.x + 14, bounds.y + 54 + index * 19));
    const quickBounds = {
      x: bounds.x + 12,
      y: Math.max(bounds.y + bounds.h - 146, bounds.y + 54 + lines.length * 19 + 10),
      w: bounds.w - 24,
      h: Math.min(132, bounds.h - 20)
    };
    if (quickBounds.y + 70 < bounds.y + bounds.h) {
      this.drawActionRows(ctx, quickBounds, this.getRaceQuickActions(), 2, { scrollKey: 'race:panel-quick' });
    }
  }

  drawCarPanel(ctx, bounds) {
    const car = this.selectedCar;
    const tuning = car.tuning;
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 16px ${UI_SUITE.font.family}`;
    ctx.fillText(car.name, bounds.x + 14, bounds.y + 24);
    ctx.font = `12px ${UI_SUITE.font.family}`;
    ctx.fillStyle = UI_SUITE.colors.muted;
    const lines = [
      `Drivetrain: ${tuning.drivetrain.toUpperCase()}`,
      `Power: ${tuning.powerHp} hp`,
      `Weight: ${tuning.weightKg} kg`,
      `Engine sound: ${CAR_ENGINE_SOUND_PROFILES.find((profile) => profile.id === car.audio?.engineProfile)?.label || car.audio?.engineSoundId || 'Default'}`,
      `Tire grip: ${tuning.tireGrip}`,
      `Brake balance: ${tuning.brakeBalance}`,
      `Diff accel/decel: ${tuning.differentialAccel}/${tuning.differentialDecel}`,
      `Final drive: ${tuning.gearFinalDrive}`,
      `Aero F/R: ${tuning.aeroFront}/${tuning.aeroRear}`,
      `Springs F/R: ${tuning.springFront}/${tuning.springRear}`,
      '',
      'Planned art:',
      'Shell, tires, spoilers, turn frames'
    ];
    lines.forEach((line, index) => ctx.fillText(line, bounds.x + 14, bounds.y + 54 + index * 19));
  }

  getRaceSegmentLengthLabelLayout(ctx, bounds, points = [], segments = [], roadWidth = 14) {
    if (points.length < 2 || !segments.length) return [];
    const scaleBar = this.getRaceMapScaleBar(bounds);
    const scaleBarBlock = scaleBar
      ? {
        x: bounds.x + bounds.w - scaleBar.width - 22,
        y: bounds.y + bounds.h - 46,
        w: scaleBar.width + 30,
        h: 38
      }
      : null;
    const labels = [];
    for (let index = 1; index < points.length; index += 1) {
      const segment = segments[index - 1] || {};
      const from = points[index - 1];
      const to = points[index];
      const dx = to.screenX - from.screenX;
      const dy = to.screenY - from.screenY;
      const screenLength = Math.hypot(dx, dy);
      if (screenLength < 44) continue;
      const midX = (from.screenX + to.screenX) / 2;
      const midY = (from.screenY + to.screenY) / 2;
      const side = index % 2 === 0 ? -1 : 1;
      const normalX = screenLength > 0 ? (-dy / screenLength) * side : 0;
      const normalY = screenLength > 0 ? (dx / screenLength) * side : -1;
      const label = this.formatRaceMapDistanceLabel(segment.length || Math.hypot(to.x - from.x, to.y - from.y));
      const metrics = ctx.measureText(label);
      const labelW = Math.max(48, metrics.width + 12);
      const labelH = 18;
      let labelX = clamp(midX + normalX * (roadWidth / 2 + 28), bounds.x + labelW / 2 + 6, bounds.x + bounds.w - labelW / 2 - 6);
      let labelY = clamp(midY + normalY * (roadWidth / 2 + 28), bounds.y + labelH / 2 + 8, bounds.y + bounds.h - labelH / 2 - 8);
      if (scaleBarBlock
        && labelX + labelW / 2 > scaleBarBlock.x
        && labelX - labelW / 2 < scaleBarBlock.x + scaleBarBlock.w
        && labelY + labelH / 2 > scaleBarBlock.y
        && labelY - labelH / 2 < scaleBarBlock.y + scaleBarBlock.h) {
        labelY = Math.max(bounds.y + labelH / 2 + 8, scaleBarBlock.y - labelH / 2 - 6);
      }
      labels.push({
        segmentIndex: index - 1,
        label,
        side: side > 0 ? 'right' : 'left',
        x: labelX,
        y: labelY,
        w: labelW,
        h: labelH
      });
    }
    return labels;
  }

  drawRaceSegmentLengthLabels(ctx, bounds, points = [], segments = [], roadWidth = 14) {
    ctx.save();
    ctx.font = `700 11px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labels = this.getRaceSegmentLengthLabelLayout(ctx, bounds, points, segments, roadWidth);
    labels.forEach(({ label, x: labelX, y: labelY, w: labelW, h: labelH }) => {
      ctx.fillStyle = 'rgba(5,8,7,0.78)';
      ctx.fillRect(labelX - labelW / 2, labelY - labelH / 2, labelW, labelH);
      ctx.strokeStyle = 'rgba(217,230,210,0.24)';
      ctx.strokeRect(labelX - labelW / 2, labelY - labelH / 2, labelW, labelH);
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.fillText(label, labelX, labelY + 0.5);
    });
    ctx.restore();
  }

  drawRaceMapScaleBar(ctx, bounds) {
    const scaleBar = this.getRaceMapScaleBar(bounds);
    if (!scaleBar) return;
    const pad = 14;
    const x = bounds.x + bounds.w - scaleBar.width - pad;
    const y = bounds.y + bounds.h - 28;
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,7,0.78)';
    ctx.fillRect(x - 8, y - 18, scaleBar.width + 16, 32);
    ctx.strokeStyle = UI_SUITE.colors.text;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + scaleBar.width, y);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y + 6);
    ctx.moveTo(x + scaleBar.width, y - 6);
    ctx.lineTo(x + scaleBar.width, y + 6);
    ctx.stroke();
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 11px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(scaleBar.label, x + scaleBar.width / 2, y - 8);
    ctx.restore();
  }

  drawRaceTopDownEditor(ctx, bounds) {
    this.raceMapBounds = { ...bounds };
    const race = this.selectedRace;
    const segments = race?.road?.segments || [];
    const road = this.ensureRaceRoadAuthoringData();
    const points = this.getRaceMapPoints(bounds);
    const selectedIndex = clamp(Math.round(Number(this.selectedSegmentIndex) || 0), 0, Math.max(0, segments.length - 1));
    ctx.save();
    ctx.fillStyle = '#111916';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);

    const tileSize = Math.max(18, Math.min(34, Math.floor(Math.min(bounds.w, bounds.h) / 12)));
    for (let y = bounds.y; y < bounds.y + bounds.h; y += tileSize) {
      for (let x = bounds.x; x < bounds.x + bounds.w; x += tileSize) {
        const centerX = x + tileSize / 2;
        const centerY = y + tileSize / 2;
        const nx = (centerX - bounds.x) / Math.max(1, bounds.w);
        const ny = (centerY - bounds.y) / Math.max(1, bounds.h);
        const terrain = this.getRaceTerrainSampleAtPoint(centerX, centerY, bounds, points);
        const patch = this.getRaceGroundPaintAt(nx, ny);
        const wave = Math.sin(nx * Math.PI * 3.2) * 0.05 + Math.cos(ny * Math.PI * 4.1) * 0.04;
        const baseElevation = Number(terrain.elevation) || 0;
        const patchElevation = patch ? Number(patch.elevation ?? baseElevation) : baseElevation;
        const height = clamp(0.5 + patchElevation * 0.78 + wave, 0.12, 0.88);
        const shade = Math.round(34 + height * 112);
        if (patch?.tileId) {
          const palette = this.getRaceGroundTilePalette(patch.tileId);
          ctx.fillStyle = ((Math.floor(nx * 24) + Math.floor(ny * 24)) % 2) ? palette.groundA : palette.groundB;
        } else {
          ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
        }
        ctx.fillRect(x, y, Math.min(tileSize, bounds.x + bounds.w - x), Math.min(tileSize, bounds.y + bounds.h - y));
        ctx.fillStyle = patchElevation >= 0 ? `rgba(242, 212, 92, ${Math.min(0.18, Math.abs(patchElevation) * 0.34)})` : `rgba(88, 214, 255, ${Math.min(0.16, Math.abs(patchElevation) * 0.34)})`;
        ctx.fillRect(x, y, Math.min(tileSize, bounds.x + bounds.w - x), Math.min(tileSize, bounds.y + bounds.h - y));
      }
    }

    ctx.strokeStyle = 'rgba(5,8,7,0.35)';
    ctx.lineWidth = 1;
    for (let x = bounds.x; x <= bounds.x + bounds.w; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, bounds.y);
      ctx.lineTo(x, bounds.y + bounds.h);
      ctx.stroke();
    }
    for (let y = bounds.y; y <= bounds.y + bounds.h; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(bounds.x, y);
      ctx.lineTo(bounds.x + bounds.w, y);
      ctx.stroke();
    }

    const baseRoadWidth = Math.max(12, Math.min(bounds.w, bounds.h) * 0.045);
    for (let index = 1; index < points.length; index += 1) {
      const segment = segments[index - 1] || {};
      const segmentWidthM = this.getRaceRoadWidthMForSegment(segment);
      const roadWidth = clamp(
        baseRoadWidth * (segmentWidthM / Math.max(1, Number(race?.road?.width || 11))),
        8,
        Math.max(18, baseRoadWidth * 1.8)
      );
      const from = points[index - 1];
      const to = points[index];
      const surface = getSurfaceById(segment.surface);
      const edgePalette = this.getRaceGroundTilePalette(segment.edgeTileId, segment.surface);
      ctx.lineCap = segment.turn === 'square' ? 'butt' : 'round';
      ctx.lineJoin = segment.turn === 'square' ? 'miter' : 'round';
      ctx.strokeStyle = edgePalette.groundB;
      ctx.lineWidth = roadWidth + 18;
      ctx.beginPath();
      ctx.moveTo(from.screenX, from.screenY);
      ctx.lineTo(to.screenX, to.screenY);
      ctx.stroke();
      ctx.strokeStyle = index - 1 === selectedIndex ? UI_SUITE.colors.accent : '#07100d';
      ctx.lineWidth = roadWidth + 12;
      ctx.beginPath();
      ctx.moveTo(from.screenX, from.screenY);
      ctx.lineTo(to.screenX, to.screenY);
      ctx.stroke();
      if (segment.edgeTileId) {
        ctx.strokeStyle = edgePalette.groundA;
        ctx.lineWidth = roadWidth + 8;
        ctx.beginPath();
        ctx.moveTo(from.screenX, from.screenY);
        ctx.lineTo(to.screenX, to.screenY);
        ctx.stroke();
      }
      ctx.strokeStyle = surface.colorA;
      ctx.lineWidth = roadWidth;
      ctx.beginPath();
      ctx.moveTo(from.screenX, from.screenY);
      ctx.lineTo(to.screenX, to.screenY);
      ctx.stroke();
      ctx.strokeStyle = surface.colorB;
      ctx.lineWidth = Math.max(2, roadWidth * 0.18);
      ctx.beginPath();
      ctx.moveTo(from.screenX, from.screenY);
      ctx.lineTo(to.screenX, to.screenY);
      ctx.stroke();
      const midX = (from.screenX + to.screenX) / 2;
      const midY = (from.screenY + to.screenY) / 2;
      const hill = Number(segment.elevation) || 0;
      if (Math.abs(hill) > 0.08) {
        ctx.fillStyle = hill > 0 ? 'rgba(242,212,92,0.84)' : 'rgba(88,214,255,0.8)';
        ctx.fillRect(midX - 12, midY - 3, 24, 6);
      }
      if (segment.turn === 'square' || Math.abs(Number(segment.curve) || 0) > 0.72) {
        ctx.fillStyle = '#ff8a2f';
        ctx.fillRect(midX - 4, midY - 4, 8, 8);
      }
    }
    this.drawRaceSegmentLengthLabels(ctx, bounds, points, segments, baseRoadWidth);
    this.drawRaceMapScaleBar(ctx, bounds);

    points.forEach((point, index) => {
      const segmentIndex = clamp(index - 1, 0, Math.max(0, segments.length - 1));
      const active = segmentIndex === selectedIndex && index > 0;
      const startNode = index === 0;
      const radius = active ? 8 : 5;
      if (startNode) {
        ctx.fillStyle = '#0b0f0d';
        ctx.fillRect(point.screenX - 10, point.screenY - 10, 20, 20);
        ctx.strokeStyle = UI_SUITE.colors.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(point.screenX - 10, point.screenY - 10, 20, 20);
        ctx.fillStyle = UI_SUITE.colors.accent;
        ctx.font = `700 9px ${UI_SUITE.font.family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('START', point.screenX, point.screenY - 17);
      } else {
        ctx.fillStyle = active ? UI_SUITE.colors.accent : '#f1f4ef';
        ctx.beginPath();
        ctx.arc(point.screenX, point.screenY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = UI_SUITE.colors.background;
        ctx.font = `10px ${UI_SUITE.font.family}`;
        ctx.textAlign = 'center';
        ctx.fillText(String(segmentIndex + 1), point.screenX, point.screenY + 1);
      }
    });

    const selected = segments[selectedIndex] || {};
    const surface = getSurfaceById(selected.surface);
    const groundPalette = this.getRaceGroundTilePalette(road?.selectedGroundTileId);
    const edgePalette = this.getRaceGroundTilePalette(selected.edgeTileId, selected.surface);
    ctx.fillStyle = 'rgba(5,8,7,0.74)';
    ctx.fillRect(bounds.x + 12, bounds.y + 12, Math.min(430, bounds.w - 24), 64);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 14px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${race.name} top-down track editor`, bounds.x + 24, bounds.y + 32);
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `12px ${UI_SUITE.font.family}`;
    ctx.fillText(
      `Edge ${selectedIndex + 1}/${segments.length}  width ${this.getRaceRoadWidthMForSegment(selected)} m  bump ${Math.round((Number(selected.bumpiness) || 0) * 100)}%  road ${surface.label}${selected.surface === 'snow' ? ` ${this.getSnowConditionById(selected.snowCondition).label}` : ''}`,
      bounds.x + 24,
      bounds.y + 55,
      Math.max(1, Math.min(400, bounds.w - 48))
    );
    if (this.activeViewportMode !== 'portrait') this.drawRaceTilePalette(ctx, bounds);
    ctx.restore();
  }

  drawRaceTilePalette(ctx, bounds) {
    if (this.mode !== 'race' || this.playtestSession) return;
    const choices = this.getRaceGroundTileChoices().slice(0, 16);
    const selectedTileId = this.getSelectedGroundTileId();
    const compact = bounds.w < 560;
    const panelPad = 8;
    const panel = {
      x: bounds.x + 12,
      y: bounds.y + bounds.h - (compact ? 92 : 70),
      w: Math.min(bounds.w - 24, compact ? 360 : 680),
      h: compact ? 80 : 58
    };
    ctx.fillStyle = 'rgba(5,8,7,0.78)';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.strokeStyle = 'rgba(217,230,210,0.2)';
    ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);

    const modeButtons = [
      {
        id: 'race-move-mode',
        label: 'Move',
        active: this.activeAction === 'move-node' || !this.activeAction,
        onClick: () => {
          this.activeAction = 'move-node';
          this.activeRootId = 'road';
          this.status = 'Move mode: drag track nodes to reshape the race';
        }
      },
      {
        id: 'race-paint-mode',
        label: 'Paint',
        active: this.activeAction === 'paint-ground',
        onClick: () => {
          this.activeAction = 'paint-ground';
          this.activeRootId = 'surfaces';
          this.status = `Paint ground with ${this.getRaceGroundTilePalette(this.getSelectedGroundTileId()).label}`;
        }
      },
      {
        id: 'race-edge-mode',
        label: 'Edge',
        active: this.activeAction === 'edge-tile',
        onClick: () => {
          this.activeAction = 'edge-tile';
          this.activeRootId = 'surfaces';
          this.status = `Click a road segment to edge with ${this.getRaceGroundTilePalette(this.getSelectedGroundTileId()).label}`;
        }
      }
    ];
    const modeW = compact ? 54 : 62;
    modeButtons.forEach((action, index) => {
      this.registerRaceTileButton(ctx, {
        x: panel.x + panelPad + index * (modeW + 6),
        y: panel.y + panelPad,
        w: modeW,
        h: 28
      }, action);
    });

    const swatchX = panel.x + panelPad + modeButtons.length * (modeW + 6) + 8;
    const swatchW = compact ? 44 : 52;
    const swatchH = 28;
    const gap = 5;
    const cols = Math.max(1, Math.floor((panel.x + panel.w - panelPad - swatchX) / (swatchW + gap)));
    choices.forEach((choice, index) => {
      const row = compact ? Math.floor(index / cols) : 0;
      const col = compact ? index % cols : index;
      const button = {
        x: swatchX + col * (swatchW + gap),
        y: panel.y + panelPad + row * (swatchH + 6),
        w: swatchW,
        h: swatchH
      };
      if (button.x + button.w > panel.x + panel.w - panelPad || button.y + button.h > panel.y + panel.h - panelPad) return;
      const palette = this.getRaceGroundTilePalette(choice.id);
      ctx.fillStyle = palette.groundA;
      ctx.fillRect(button.x, button.y, button.w, button.h);
      ctx.fillStyle = palette.groundB;
      ctx.fillRect(button.x, button.y + button.h / 2, button.w, button.h / 2);
      this.registerRaceTileButton(ctx, button, {
        id: `race-tile-${choice.id}`,
        label: choice.label.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase() || choice.id.slice(0, 3).toUpperCase(),
        active: choice.id === selectedTileId,
        onClick: () => {
          this.setSelectedGroundTileId(choice.id);
          this.activeRootId = 'surfaces';
          if (this.activeAction === 'edge-tile') {
            this.setSelectedSegmentEdgeTile(choice.id);
          } else {
            this.activeAction = 'paint-ground';
            this.status = `Paint ground with ${choice.label}`;
          }
        }
      });
    });
  }

  drawMode7Preview(ctx, bounds, { playtest = false, showScaffoldText = true, showPlaytestHud = true } = {}) {
    if (playtest) {
      this.drawRaceProjectedRoadPath(ctx, bounds, { showPlaytestHud });
      return;
    }
    const race = this.selectedRace;
    const session = playtest ? this.playtestSession : null;
    const currentSegment = playtest ? this.getRaceSegmentAtDistance(Number(session?.distance || 0)).segment : this.selectedSegment;
    const hillPitch = clamp(Number(currentSegment?.elevation || 0), -0.42, 0.42);
    const speedMps = Number(session?.speedMps || 0);
    const bumpCue = playtest
      ? Math.sin((Number(session?.distance || 0) + Number(session?.elapsedMs || 0) * 0.012) * 0.12)
        * Math.abs(hillPitch)
        * clamp(Math.abs(speedMps) / 46, 0, 1)
        * 0.045
      : 0;
    const horizon = bounds.y + bounds.h * clamp(0.34 - hillPitch * (playtest ? 0.24 : 0.08) + bumpCue, 0.16, 0.5);
    ctx.fillStyle = '#131923';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = hillPitch > 0.16 ? '#2f3f5b' : hillPitch < -0.14 ? '#1c2a35' : '#233044';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, horizon - bounds.y);

    const centerX = bounds.x + bounds.w / 2;
    const polePositionRoadOffset = playtest
      ? clamp(Number(session?.roadViewOffset || 0), -0.66, 0.66) * bounds.w
      : 0;
    const roadBottom = bounds.y + bounds.h;
    const segments = race.road.segments.length ? race.road.segments : [this.cloneRaceSegment()];
    const travel = playtest && this.playtestSession
      ? Number(this.playtestSession.distance || 0)
      : Number(this.previewOffset || 0);
    const selectedIndex = clamp(Math.round(Number(this.selectedSegmentIndex) || 0), 0, segments.length - 1);
    const visualTravel = playtest ? travel * (13 + clamp(Math.abs(speedMps) / 5, 0, 18)) : travel;
    const roadSlices = playtest ? 58 : 42;
    const cameraYaw = playtest ? Number(session?.cameraYaw ?? this.getRaceRoadYawAtDistance(travel)) : 0;
    const basePalette = this.getRaceRoadSurfacePalette(currentSegment?.surface || 'asphalt');
    ctx.fillStyle = Math.floor(visualTravel / 22) % 2 ? basePalette.shoulderA : basePalette.shoulderB;
    ctx.fillRect(bounds.x, horizon, bounds.w, Math.max(1, roadBottom - horizon));
    for (let i = 0; i < roadSlices; i += 1) {
      const t0 = i / roadSlices;
      const t1 = (i + 1) / roadSlices;
      const y0 = horizon + t0 * t0 * (roadBottom - horizon);
      const y1 = horizon + t1 * t1 * (roadBottom - horizon);
      const width0 = bounds.w * (0.08 + t0 * 0.8);
      const width1 = bounds.w * (0.08 + t1 * 0.8);
      const playtestLookAhead = (roadSlices - i) * (12 + Math.abs(speedMps) * 0.24);
      const segmentInfo = playtest
        ? this.getRaceSegmentAtDistance(travel + playtestLookAhead)
        : { segment: segments[(i + Math.floor(travel / 18)) % segments.length], index: (i + Math.floor(travel / 18)) % segments.length };
      const segmentIndex = segmentInfo.index;
      const segment = segmentInfo.segment;
      const palette = this.getRaceRoadSurfacePalette(segment.surface);
      const stripe = playtest ? Math.floor((-visualTravel / 4.5) + i * 1.55) : i;
      ctx.fillStyle = stripe % 2 ? palette.roadA : palette.roadB;
      ctx.beginPath();
      const elevationLift = (Number(segment.elevation) || 0) * bounds.h * (playtest ? 0.62 : 0.34);
      const curveScale = playtest ? bounds.w * 0.9 : 110;
      const heading = Number(session?.heading || 0) * bounds.w * 0.18;
      const yaw0 = playtest ? this.getRaceRoadYawAtDistance(travel + playtestLookAhead) - cameraYaw : Number(segment.curve) || 0;
      const yaw1 = playtest ? this.getRaceRoadYawAtDistance(travel + playtestLookAhead + 34 + speedMps * 0.34) - cameraYaw : Number(segment.curve) || 0;
      const roadSweep0 = polePositionRoadOffset * t0 * t0;
      const roadSweep1 = polePositionRoadOffset * t1 * t1;
      const curve0 = clamp(Math.sin(yaw0), -1.2, 1.2) * t0 * t0 * curveScale + heading * t0 * t0 + roadSweep0;
      const curve1 = clamp(Math.sin(yaw1), -1.2, 1.2) * t1 * t1 * curveScale + heading * t1 * t1 + roadSweep1;
      ctx.moveTo(centerX - width0 / 2 + curve0, y0 - elevationLift * t0);
      ctx.lineTo(centerX + width0 / 2 + curve0, y0 - elevationLift * t0);
      ctx.lineTo(centerX + width1 / 2 + curve1, y1 - elevationLift * t1);
      ctx.lineTo(centerX - width1 / 2 + curve1, y1 - elevationLift * t1);
      ctx.closePath();
      ctx.fill();
      if (playtest && i % 3 === 0 && t1 > 0.18) {
        const midX = centerX + (curve0 + curve1) / 2;
        const markerW = Math.max(1, width1 * 0.018);
        ctx.fillStyle = 'rgba(245,247,225,0.72)';
        ctx.fillRect(midX - markerW / 2, y1 - 2, markerW, Math.max(2, (y1 - y0) * 0.45));
      }
      if (playtest && i % 5 === 0 && t1 > 0.24) {
        const postW = Math.max(2, bounds.w * 0.01 * t1);
        const postH = Math.max(4, bounds.h * 0.035 * t1);
        const edgeCurve = (curve0 + curve1) / 2;
        ctx.fillStyle = 'rgba(242,212,92,0.72)';
        ctx.fillRect(centerX - width1 * 0.62 + edgeCurve, y1 - postH, postW, postH);
        ctx.fillRect(centerX + width1 * 0.62 + edgeCurve - postW, y1 - postH, postW, postH);
      }
      if (playtest && i % 5 === 0 && Math.abs(Number(segment.elevation) || 0) > 0.16 && t1 > 0.24) {
        ctx.fillStyle = Number(segment.elevation) > 0 ? 'rgba(242,212,92,0.42)' : 'rgba(88,214,255,0.32)';
        ctx.fillRect(bounds.x, y1 - 1, bounds.w, Math.max(1, (y1 - y0) * 0.18));
      }
      if (playtest && Math.abs(speedMps) > 26 && i % 8 === 0 && t1 > 0.32) {
        const streak = Math.max(5, Math.abs(speedMps) * 0.18 * t1);
        const edgeCurve = (curve0 + curve1) / 2;
        ctx.fillStyle = 'rgba(217,230,210,0.18)';
        ctx.fillRect(centerX - width1 * 0.72 + edgeCurve, y1, Math.max(1, t1 * 3), streak);
        ctx.fillRect(centerX + width1 * 0.72 + edgeCurve, y1, Math.max(1, t1 * 3), streak);
      }
      if (!playtest && segmentIndex === selectedIndex && i % 6 === 0) {
        ctx.strokeStyle = UI_SUITE.colors.accent;
        ctx.stroke();
      }
    }

    if (playtest) {
      this.drawRaceTurnCue(ctx, bounds, this.getRaceSegmentAtDistance(travel + 120 + Math.abs(speedMps) * 2.4));
    }

    if (showScaffoldText) {
      const selected = segments[selectedIndex];
      const surface = getSurfaceById(selected?.surface);
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `700 14px ${UI_SUITE.font.family}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${race.name} road editor`, bounds.x + 18, bounds.y + 28);
      ctx.fillStyle = UI_SUITE.colors.muted;
      ctx.font = `12px ${UI_SUITE.font.family}`;
      ctx.fillText(`Segment ${selectedIndex + 1}/${segments.length}  curve ${Number(selected?.curve || 0).toFixed(2)}  elevation ${Number(selected?.elevation || 0).toFixed(2)}  ${surface.label}`, bounds.x + 18, bounds.y + 50);
    }
    if (this.playtestSession && showPlaytestHud) {
      this.drawRacePlaytestHud(ctx, bounds);
    }
  }

  drawRaceProjectedRoadPath(ctx, bounds, { showPlaytestHud = true } = {}) {
    const race = this.selectedRace;
    const session = this.playtestSession;
    const travel = Number(session?.distance || 0);
    const routeCamera = this.getRaceWorldPoseAtDistance(travel);
    const camera = {
      ...routeCamera,
      x: Number.isFinite(session?.worldX) ? session.worldX : routeCamera.x,
      z: Number.isFinite(session?.worldZ) ? session.worldZ : routeCamera.z,
      yaw: Number.isFinite(session?.carYaw) ? session.carYaw : routeCamera.yaw
    };
    const cameraYaw = Number(session?.cameraYaw ?? camera.yaw);
    const currentSegment = this.getRaceSegmentAtDistance(travel).segment || camera.segment || this.selectedSegment;
    const hillPitch = clamp(Number(currentSegment?.elevation || 0), -0.42, 0.42);
    const speedMps = Number(session?.speedMps || 0);
    const absSpeed = Math.abs(speedMps);
    const speedFactor = clamp(absSpeed / 60, 0, 1);
    const surfaceBumpiness = clamp(
      Number(currentSegment?.bumpiness) || 0
        + (currentSegment?.surface === 'snow' ? this.getSnowConditionById(currentSegment.snowCondition).bumpiness : 0),
      0,
      1
    );
    const bumpCue = Math.sin(travel * 0.055)
      * surfaceBumpiness
      * clamp(absSpeed / 46, 0, 1)
      * 0.012;
    const horizonRatio = clamp(0.31 - speedFactor * 0.06 - hillPitch * 0.18 + bumpCue, 0.14, 0.46);
    camera.horizonRatio = horizonRatio;
    const cameraView = session?.cameraView || this.raceInput.cameraView;
    camera.roadElevation = Number(camera.elevation || 0);
    camera.eyeHeight = this.getRaceCameraEyeHeight(cameraView);
    camera.elevation = camera.roadElevation + camera.eyeHeight;
    const projectionProfile = this.getRaceCameraProjectionProfile(cameraView, speedFactor);
    camera.roadDepthRatio = projectionProfile.roadDepthRatio;
    camera.focalScale = projectionProfile.focalScale;
    camera.roadWidthScale = projectionProfile.roadWidthScale;
    camera.roadMaxWidthRatio = projectionProfile.roadMaxWidthRatio;
    const routeYawAtTravel = this.getRaceRoadYawAtDistance(travel);
    const sampleDirection = this.getRaceCameraRouteSampleDirection(cameraYaw, routeYawAtTravel);
    const visualRoadWidthMultiplier = cameraView === 'first-person' ? 1.18 : 0.58;
    const horizon = bounds.y + bounds.h * horizonRatio;
    const roadBottom = bounds.y + bounds.h;
    const basePalette = this.getRaceRoadSurfacePalette(currentSegment?.surface || 'asphalt');

    ctx.fillStyle = '#131923';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = hillPitch > 0.16 ? '#2f3f5b' : hillPitch < -0.14 ? '#1c2a35' : '#233044';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, horizon - bounds.y);
    const baseGroundPalette = this.getRaceGroundPaletteForSegment(currentSegment, camera);
    ctx.fillStyle = baseGroundPalette.shoulderB;
    ctx.fillRect(bounds.x, horizon, bounds.w, Math.max(1, roadBottom - horizon));

    const routeLength = Math.max(1, Number(session?.routeLength || this.getRaceRouteLength()));
    const routeRuntimeType = session?.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const viewDistance = Math.min(Math.max(1280, absSpeed * 44 + 860), routeRuntimeType === 'circuit' ? routeLength : routeLength - travel + 260);
    const nearDistance = 0.45 + speedFactor * 6;
    const crossSections = [];
    const sampleCount = 64;
    for (let i = 0; i <= sampleCount; i += 1) {
      const lookAhead = i === 0
        ? nearDistance
        : nearDistance + Math.pow(i / sampleCount, 1.28) * Math.max(120, viewDistance);
      const requestedDistance = travel + lookAhead * sampleDirection;
      const distance = routeRuntimeType === 'circuit'
        ? ((requestedDistance % routeLength) + routeLength) % routeLength
        : clamp(requestedDistance, 0, routeLength);
      const section = this.getRaceRoadCrossSectionAtDistance(distance, {
        visualWidthMultiplier: visualRoadWidthMultiplier
      });
      const projected = {
        center: this.projectRaceWorldPointToCamera(section.center, camera, cameraYaw, bounds),
        left: this.projectRaceWorldPointToCamera(section.left, camera, cameraYaw, bounds),
        right: this.projectRaceWorldPointToCamera(section.right, camera, cameraYaw, bounds)
      };
      if (projected.center.visible || projected.left.visible || projected.right.visible) {
        crossSections.push(projected);
      }
      if (routeRuntimeType !== 'circuit' && (distance >= routeLength || distance <= 0)) break;
    }

    const roadQuads = this.getRaceProjectedRoadQuads(crossSections);
    for (const quad of roadQuads) {
      const { near, far } = quad;
      const markerDimensions = this.getRaceLaneMarkerDimensionsWorld();
      const groundStripe = Math.floor(Number(near.center.distance || 0) / Math.max(1, markerDimensions.interval * 2));
      const groundPalette = this.getRaceGroundPaletteForSegment(near.center.segment || currentSegment, near.center);
      ctx.fillStyle = groundStripe % 2 ? groundPalette.shoulderA : groundPalette.shoulderB;
      ctx.beginPath();
      ctx.moveTo(bounds.x, far.left.screenY);
      ctx.lineTo(far.left.screenX, far.left.screenY);
      ctx.lineTo(near.left.screenX, near.left.screenY);
      ctx.lineTo(bounds.x, near.left.screenY);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(far.right.screenX, far.right.screenY);
      ctx.lineTo(bounds.x + bounds.w, far.right.screenY);
      ctx.lineTo(bounds.x + bounds.w, near.right.screenY);
      ctx.lineTo(near.right.screenX, near.right.screenY);
      ctx.closePath();
      ctx.fill();
    }

    for (const quad of roadQuads) {
      const { near, far, index } = quad;
      const palette = this.getRaceRoadSurfacePalette(near.center.segment?.surface || currentSegment?.surface || 'asphalt');
      const markerDimensions = this.getRaceLaneMarkerDimensionsWorld();
      const stripe = Math.floor((-travel / Math.max(1, markerDimensions.interval)) + index * 1.35);
      ctx.fillStyle = stripe % 2 ? palette.roadA : palette.roadB;
      ctx.beginPath();
      ctx.moveTo(far.left.screenX, far.left.screenY);
      ctx.lineTo(far.right.screenX, far.right.screenY);
      ctx.lineTo(near.right.screenX, near.right.screenY);
      ctx.lineTo(near.left.screenX, near.left.screenY);
      ctx.closePath();
      ctx.fill();

      this.drawRaceDistanceMarkers(ctx, bounds, { near, far, palette });
    }

    this.drawRaceStartFinishCheckerStripes(ctx, bounds, {
      camera,
      cameraYaw,
      travel,
      routeLength
    });

    if (crossSections.length >= 2) {
      const target = crossSections[Math.min(crossSections.length - 1, 12)].center;
      const cueTargetDistance = travel + (120 + absSpeed * 2.4) * sampleDirection;
      const cueDistance = routeRuntimeType === 'circuit'
        ? ((cueTargetDistance % routeLength) + routeLength) % routeLength
        : clamp(cueTargetDistance, 0, routeLength);
      this.drawRaceTurnCue(ctx, bounds, this.getRaceSegmentAtDistance(cueDistance));
      if (Math.abs(target.cameraX) > 40) {
        ctx.fillStyle = 'rgba(5,8,7,0.42)';
        ctx.fillRect(bounds.x + bounds.w / 2 - 44, horizon + 10, 88, 20);
        ctx.fillStyle = UI_SUITE.colors.accent;
        ctx.font = `800 9px ${UI_SUITE.font.family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(target.cameraX > 0 ? 'TURN RIGHT' : 'TURN LEFT', bounds.x + bounds.w / 2, horizon + 20, 80);
      }
    }

    if (this.playtestSession && showPlaytestHud) {
      this.drawRacePlaytestHud(ctx, bounds);
    }
  }

  drawRaceStartFinishCheckerStripes(ctx, bounds, { camera = {}, cameraYaw = 0, travel = 0, routeLength = 1 } = {}) {
    const race = this.selectedRace;
    const currentTravel = Number(travel) || 0;
    if (!race) return;
    const startDistance = 6;
    if (currentTravel <= startDistance + 12) {
      this.drawRaceCheckerStripeAtDistance(ctx, bounds, {
        camera,
        cameraYaw,
        distance: startDistance,
        depth: 9
      });
    }
    const routeRuntimeType = this.playtestSession?.routeRuntimeType || this.getSelectedRaceRuntimeType();
    if (routeRuntimeType !== 'circuit') {
      const finishDistance = Number(routeLength || 1);
      if (finishDistance >= currentTravel) {
        this.drawRaceCheckerStripeAtDistance(ctx, bounds, {
          camera,
          cameraYaw,
          distance: finishDistance,
          depth: 10
        });
      }
    }
  }

  drawRaceCheckerStripeAtDistance(ctx, bounds, { camera = {}, cameraYaw = 0, distance = 0, depth = 9 } = {}) {
    const startDistance = Number(distance) || 0;
    const stripeDepth = Math.max(2, Number(depth) || 9);
    const routeLength = this.getRaceRouteLength();
    const routeRuntimeType = this.playtestSession?.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const finishStripe = routeRuntimeType !== 'circuit' && startDistance >= routeLength - 1;
    const nearDistance = finishStripe ? Math.max(0, startDistance - stripeDepth) : startDistance;
    const farDistance = finishStripe ? startDistance : startDistance + stripeDepth;
    if (farDistance < Number(camera.distance || 0) - 2) return;
    const nearSection = this.getRaceRoadCrossSectionAtDistance(nearDistance);
    const farSection = this.getRaceRoadCrossSectionAtDistance(farDistance);
    const near = {
      left: this.projectRaceWorldPointToCamera(nearSection.left, camera, cameraYaw, bounds),
      right: this.projectRaceWorldPointToCamera(nearSection.right, camera, cameraYaw, bounds)
    };
    const far = {
      left: this.projectRaceWorldPointToCamera(farSection.left, camera, cameraYaw, bounds),
      right: this.projectRaceWorldPointToCamera(farSection.right, camera, cameraYaw, bounds)
    };
    if (!near.left.visible || !near.right.visible || !far.left.visible || !far.right.visible) return;
    const cells = 10;
    for (let index = 0; index < cells; index += 1) {
      const t0 = index / cells;
      const t1 = (index + 1) / cells;
      const lerp = (a, b, t) => a + (b - a) * t;
      const nearA = {
        x: lerp(near.left.screenX, near.right.screenX, t0),
        y: lerp(near.left.screenY, near.right.screenY, t0)
      };
      const nearB = {
        x: lerp(near.left.screenX, near.right.screenX, t1),
        y: lerp(near.left.screenY, near.right.screenY, t1)
      };
      const farA = {
        x: lerp(far.left.screenX, far.right.screenX, t0),
        y: lerp(far.left.screenY, far.right.screenY, t0)
      };
      const farB = {
        x: lerp(far.left.screenX, far.right.screenX, t1),
        y: lerp(far.left.screenY, far.right.screenY, t1)
      };
      ctx.fillStyle = index % 2 === 0 ? '#f1f4ef' : '#050807';
      ctx.beginPath();
      ctx.moveTo(farA.x, farA.y);
      ctx.lineTo(farB.x, farB.y);
      ctx.lineTo(nearB.x, nearB.y);
      ctx.lineTo(nearA.x, nearA.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawRaceDistanceMarkers(ctx, bounds, { near = null, far = null, palette = null } = {}) {
    if (!near?.center || !far?.center || !palette) return;
    const nearDistance = Number(near.center.distance || 0);
    const farDistance = Number(far.center.distance || 0);
    if (!Number.isFinite(nearDistance) || !Number.isFinite(farDistance)) return;
    const minDistance = Math.min(nearDistance, farDistance);
    const maxDistance = Math.max(nearDistance, farDistance);
    const markerDimensions = this.getRaceLaneMarkerDimensionsWorld();
    const markerInterval = markerDimensions.interval;
    const dashLength = markerDimensions.dashLength;
    const edgePostInterval = markerDimensions.edgePostInterval;
    const lerp = (a, b, t) => a + (b - a) * t;
    const drawDashAt = (worldDistance) => {
      const t = clamp((worldDistance - farDistance) / Math.max(0.001, nearDistance - farDistance), 0, 1);
      const centerX = lerp(far.center.screenX, near.center.screenX, t);
      const centerY = lerp(far.center.screenY, near.center.screenY, t);
      const leftX = lerp(far.left.screenX, near.left.screenX, t);
      const rightX = lerp(far.right.screenX, near.right.screenX, t);
      const roadScreenWidth = Math.max(1, Math.abs(rightX - leftX));
      const laneWorldWidth = Math.max(0.1, this.getRaceRoadHalfWidthWorld(near.center.segment));
      const markerW = Math.max(1, roadScreenWidth * (markerDimensions.dashWidth / Math.max(0.1, laneWorldWidth * 2)));
      const markerH = Math.max(2, Math.abs(near.center.screenY - far.center.screenY) * clamp(dashLength / Math.max(1, maxDistance - minDistance), 0.04, 0.42));
      ctx.fillStyle = palette.lane;
      ctx.fillRect(centerX - markerW / 2, centerY - markerH / 2, markerW, markerH);
    };
    const drawPostAt = (worldDistance) => {
      const t = clamp((worldDistance - farDistance) / Math.max(0.001, nearDistance - farDistance), 0, 1);
      const leftX = lerp(far.left.screenX, near.left.screenX, t);
      const rightX = lerp(far.right.screenX, near.right.screenX, t);
      const y = lerp(far.left.screenY, near.left.screenY, t);
      const roadScreenWidth = Math.max(1, Math.abs(rightX - leftX));
      const scale = clamp(roadScreenWidth / Math.max(1, Number(bounds.w || 1) * 0.36), 0.35, 2.2);
      const postW = Math.max(2, Number(bounds.w || 1) * 0.006 * scale);
      const postH = Math.max(4, Number(bounds.h || 1) * 0.024 * scale);
      ctx.fillStyle = 'rgba(242,212,92,0.72)';
      ctx.fillRect(leftX - postW * 0.5, y - postH, postW, postH);
      ctx.fillRect(rightX - postW * 0.5, y - postH, postW, postH);
    };
    for (let distance = Math.ceil(minDistance / markerInterval) * markerInterval; distance <= maxDistance; distance += markerInterval) {
      const phase = distance % (markerInterval * 2);
      if (phase < dashLength) drawDashAt(distance);
    }
    for (let distance = Math.ceil(minDistance / edgePostInterval) * edgePostInterval; distance <= maxDistance; distance += edgePostInterval) {
      drawPostAt(distance);
    }
  }

  drawRaceTurnCue(ctx, bounds, segmentInfo) {
    const segment = segmentInfo?.segment;
    if (!segment) return;
    const curve = Number(segment.curve) || 0;
    if (Math.abs(curve) < 0.52 && segment.turn !== 'square') return;
    const label = segment.turn === 'square'
      ? (curve >= 0 ? 'L RIGHT' : 'L LEFT')
      : curve >= 0 ? 'RIGHT' : 'LEFT';
    const cue = {
      x: bounds.x + bounds.w * 0.5 - 38,
      y: bounds.y + bounds.h * 0.18,
      w: 76,
      h: 24
    };
    ctx.fillStyle = 'rgba(5,8,7,0.52)';
    ctx.fillRect(cue.x, cue.y, cue.w, cue.h);
    ctx.fillStyle = UI_SUITE.colors.accent;
    ctx.font = `800 10px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cue.x + cue.w / 2, cue.y + cue.h / 2, cue.w - 8);
  }

  drawPlaytestHud(ctx, bounds) {
    const session = this.playtestSession;
    if (!session) return;
    const nextCall = this.getNextCoDriverCall();
    const nextHazard = this.getUpcomingHazard();
    const progress = session.routeLength > 0 ? session.distance / session.routeLength : 0;
    const speedMph = Math.round(session.speedMps * 2.23694);
    const panel = {
      x: bounds.x + 10,
      y: bounds.y + 10,
      w: Math.min(bounds.w - 20, 360),
      h: 54
    };
    ctx.fillStyle = 'rgba(5,8,7,0.62)';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 12px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${speedMph} mph  ${Math.round(progress * 100)}%`, panel.x + 10, panel.y + 15);
    ctx.font = `9px ${UI_SUITE.font.family}`;
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.fillText(`Call: ${nextCall?.text || 'None'}`, panel.x + 10, panel.y + 31, panel.w - 106);
    ctx.fillText(`Hazard: ${nextHazard?.label || 'None'}`, panel.x + 10, panel.y + 44, panel.w - 106);
    const bar = { x: panel.x + panel.w - 92, y: panel.y + 10, w: 78, h: 4 };
    ctx.fillStyle = UI_SUITE.colors.panelAlt;
    ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
    ctx.fillStyle = UI_SUITE.colors.accent;
    ctx.fillRect(bar.x, bar.y, Math.max(2, bar.w * progress), bar.h);
    const endBounds = { x: panel.x + panel.w - 90, y: panel.y + 22, w: 76, h: 24 };
    this.drawButton(ctx, endBounds, 'End Drive');
    this.buttons.push({ id: 'end-playtest', bounds: { ...endBounds, id: 'end-playtest' }, onClick: () => this.endPlaytest() });
  }

  handlePointerDown(payload = {}) {
    this.pendingDesktopDropdownHit = null;
    this.pendingDesktopCommandHit = null;
    const hit = [...this.buttons].reverse().find(({ bounds }) => (
      payload.x >= bounds.x
      && payload.x <= bounds.x + bounds.w
      && payload.y >= bounds.y
      && payload.y <= bounds.y + bounds.h
    ));
    if (this.playtestPickerOpen) {
      if (hit) hit.onClick?.();
      return;
    }
    if (
      this.playtestSession
      && hit?.id
      && ['race-pause-toggle', 'race-return-editor', 'race-exit-main', 'end-playtest'].includes(hit.id)
      && !hit.desktopDropdownItem
    ) {
      if (this.isDesktopMode()) {
        this.pendingDesktopCommandHit = createPendingDesktopDropdownHit(hit, payload);
        return;
      }
      hit.onClick?.();
      return;
    }
    if (this.playtestSession && !this.isDesktopMode()) {
      this.handleRacePlaytestPointerDown(hit, payload);
      return;
    }
    if (hit?.desktopDropdownItem && (hit.action || hit.onClick)) {
      this.pendingDesktopDropdownHit = createPendingDesktopDropdownHit(hit, payload);
      return;
    }
    if (this.activeViewportMode === 'portrait' && hit?.id === 'race-map-zoom') {
      this.raceMapZoomDrag = { id: payload.id ?? 'pointer' };
      this.updateRaceMapZoomFromSliderX(payload.x);
      return;
    }
    if (
      this.activeViewportMode === 'portrait'
      && this.portraitThumbstick?.radius > 0
      && Math.hypot(payload.x - this.portraitThumbstick.center.x, payload.y - this.portraitThumbstick.center.y) <= this.portraitThumbstick.radius
    ) {
      const id = payload.id ?? 'pointer';
      this.raceMapThumbstickDrag = { id };
      this.portraitThumbstick.active = true;
      this.portraitThumbstick.id = id;
      this.updateRaceMapThumbstickDeflection(payload);
      return;
    }
    const scrollDrag = buildMenuScrollDragState({
      regions: this.menuScrollRegions,
      point: payload,
      scrollState: this.menuScrollState,
      pendingHit: hit || null,
      thresholdPx: 8
    });
    if (scrollDrag) {
      this.menuScrollDrag = scrollDrag;
      this.pendingMenuScrollHit = hit || null;
      return;
    }
    if (this.isDesktopMode() && this.desktopDropdown && shouldCloseDesktopDropdownOnPointerDown({
      dropdown: this.desktopDropdown,
      point: payload,
      rootButtons: this.buttons.filter((button) => button.desktopRootId),
      interactiveRegions: this.menuScrollRegions
    })) {
      const nextDropdown = resolveClosedDesktopDropdownState({
        dropdown: this.desktopDropdown,
        openRootId: this.openDesktopDropdownRootId
      });
      this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
      this.openDesktopDropdownRootId = nextDropdown.openRootId;
      this.desktopDropdown = nextDropdown.dropdown;
      return;
    }
    if (this.activeViewportMode === 'portrait' && hit?.onClick && !hit.desktopDropdownItem) {
      hit.onClick();
      return;
    }
    if (hit?.raceTilePalette) {
      hit.onClick?.();
      return;
    }
    if (payload.button !== 1 && payload.button !== 2 && this.activeAction === 'paint-ground' && this.paintRaceGroundAtPoint(payload)) {
      this.raceGroundPaintDrag = { id: payload.id ?? 'pointer' };
      return;
    }
    if (payload.button !== 1 && payload.button !== 2 && this.activeAction === 'paint-elevation' && this.paintRaceElevationAtPoint(payload)) {
      this.raceElevationPaintDrag = { id: payload.id ?? 'pointer' };
      return;
    }
    if (payload.button !== 1 && payload.button !== 2 && this.activeAction === 'edge-tile' && this.applySelectedEdgeTileAtPoint(payload)) {
      return;
    }
    if (payload.button !== 1 && payload.button !== 2 && this.activeAction === 'draw-road' && this.appendRaceNodeAtPoint(payload)) {
      return;
    }
    if (payload.button !== 1 && payload.button !== 2 && this.beginRaceNodeDrag(payload)) return;
    if (payload.button !== 1 && payload.button !== 2 && this.selectRaceMapSegmentAtPoint(payload)) return;
    if (this.beginDesktopPreviewDrag(payload)) return;
    if (this.isDesktopMode() && hit?.onClick && !hit.desktopRootId) {
      this.pendingDesktopCommandHit = createPendingDesktopDropdownHit(hit, payload);
      return;
    }
    hit?.onClick?.();
  }

  handlePointerMove(payload = {}) {
    if (this.playtestSession && this.raceInput.activeDpadPointerId === (payload.id ?? 'pointer')) {
      const dpad = this.buttons.find((button) => button.playtestControl === 'dpad');
      if (dpad) this.handleRaceDpadPoint(dpad.bounds, payload);
      return;
    }
    if (this.pendingDesktopDropdownHit) {
      this.pendingDesktopDropdownHit = updatePendingDesktopDropdownHit(this.pendingDesktopDropdownHit, payload);
      return;
    }
    if (this.pendingDesktopCommandHit) {
      this.pendingDesktopCommandHit = updatePendingDesktopDropdownHit(this.pendingDesktopCommandHit, payload);
      return;
    }
    if (this.menuScrollDrag) {
      this.menuScrollDrag = resolveMenuScrollDrag(this.menuScrollDrag, payload);
      if (this.menuScrollDrag?.moved) {
        this.menuScrollState[this.menuScrollDrag.scrollKey] = this.menuScrollDrag.nextScroll;
      }
      return;
    }
    if (this.raceMapZoomDrag && this.raceMapZoomDrag.id === (payload.id ?? 'pointer')) {
      this.updateRaceMapZoomFromSliderX(payload.x);
      return;
    }
    if (this.raceMapThumbstickDrag && this.raceMapThumbstickDrag.id === (payload.id ?? 'pointer')) {
      this.updateRaceMapThumbstickDeflection(payload);
      return;
    }
    if (this.raceGroundPaintDrag && this.raceGroundPaintDrag.id === (payload.id ?? 'pointer')) {
      this.paintRaceGroundAtPoint(payload);
      return;
    }
    if (this.raceElevationPaintDrag && this.raceElevationPaintDrag.id === (payload.id ?? 'pointer')) {
      this.paintRaceElevationAtPoint(payload);
      return;
    }
    if (this.updateRaceNodeDrag(payload)) return;
    if (this.updateDesktopPreviewDrag(payload)) return;
    if (this.isDesktopMode() && !payload.touchCount) {
      const hover = resolveDesktopDropdownHoverSwitch({
        buttons: this.buttons.filter((button) => button.desktopRootId),
        point: payload,
        openRootId: this.openDesktopDropdownRootId
      });
      if (hover?.rootId) {
        const nextDropdown = resolveOpenDesktopDropdownState({
          rootId: hover.rootId,
          currentOpenRootId: this.openDesktopDropdownRootId,
          closedRootId: this.closedDesktopDropdownRootId,
          dropdown: this.desktopDropdown
        });
        if (nextDropdown) {
          this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
          this.openDesktopDropdownRootId = nextDropdown.openRootId;
          this.desktopDropdown = nextDropdown.dropdown;
        }
      }
    }
  }
  handlePointerUp(payload = {}) {
    if (this.pendingDesktopDropdownHit) {
      const hit = this.pendingDesktopDropdownHit;
      this.pendingDesktopDropdownHit = null;
      const { shouldActivate } = resolvePendingDesktopDropdownHit(hit, payload);
      if (shouldActivate) {
        hit.action?.();
        const nextDropdown = resolveClosedDesktopDropdownState({
          dropdown: this.desktopDropdown,
          openRootId: this.openDesktopDropdownRootId,
          fallbackRootId: hit.id
        });
        this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
        this.openDesktopDropdownRootId = nextDropdown.openRootId;
        this.desktopDropdown = nextDropdown.dropdown;
      }
      return;
    }
    if (this.pendingDesktopCommandHit) {
      const hit = this.pendingDesktopCommandHit;
      this.pendingDesktopCommandHit = null;
      const { shouldActivate } = resolvePendingDesktopDropdownHit(hit, payload);
      if (shouldActivate) hit.onClick?.();
      return;
    }
    if (this.playtestSession) {
      const id = payload.id ?? 'pointer';
      if (this.raceInput.activeDpadPointerId === id) {
        this.raceInput.activeDpadPointerId = null;
        this.raceInput.binarySteer = 0;
      }
      if (this.raceInput.activeThrottlePointerId === id) {
        this.raceInput.activeThrottlePointerId = null;
        this.raceInput.throttle = false;
      }
      if (this.raceInput.activeBrakePointerId === id) {
        this.raceInput.activeBrakePointerId = null;
        this.raceInput.brake = false;
        this.raceInput.handbrake = false;
      }
      return;
    }
    if (this.raceMapZoomDrag && this.raceMapZoomDrag.id === (payload.id ?? 'pointer')) {
      this.raceMapZoomDrag = null;
      return;
    }
    if (this.raceMapThumbstickDrag && this.raceMapThumbstickDrag.id === (payload.id ?? 'pointer')) {
      this.raceMapThumbstickDrag = null;
      this.portraitThumbstick.active = false;
      this.portraitThumbstick.id = null;
      this.portraitThumbstick.dx = 0;
      this.portraitThumbstick.dy = 0;
      return;
    }
    if (this.desktopPreviewDrag && this.desktopPreviewDrag.id === (payload.id ?? 'pointer')) {
      this.desktopPreviewDrag = null;
      return;
    }
    if (this.raceNodeDrag && this.raceNodeDrag.id === (payload.id ?? 'pointer')) {
      this.raceNodeDrag = null;
      return;
    }
    if (this.raceGroundPaintDrag && this.raceGroundPaintDrag.id === (payload.id ?? 'pointer')) {
      this.raceGroundPaintDrag = null;
      return;
    }
    if (this.raceElevationPaintDrag && this.raceElevationPaintDrag.id === (payload.id ?? 'pointer')) {
      this.raceElevationPaintDrag = null;
      return;
    }
    if (this.menuScrollDrag) {
      const pendingHit = this.pendingMenuScrollHit;
      const moved = Boolean(this.menuScrollDrag.moved);
      this.menuScrollDrag = null;
      this.pendingMenuScrollHit = null;
      if (!moved) pendingHit?.onClick?.();
      return;
    }
    this.menuScrollDrag = null;
    this.pendingMenuScrollHit = null;
  }
  handleWheel(payload = {}) {
    const desktopDropdownScroll = applyDesktopDropdownWheelScrollState({
      dropdown: this.desktopDropdown,
      payload,
      scrollState: this.desktopDropdownScroll
    });
    if (desktopDropdownScroll) {
      this.desktopDropdownScroll = desktopDropdownScroll.scrollState;
      return;
    }
    const region = this.menuScrollRegions.find((entry) => (
      payload.x >= entry.bounds.x
      && payload.x <= entry.bounds.x + entry.bounds.w
      && payload.y >= entry.bounds.y
      && payload.y <= entry.bounds.y + entry.bounds.h
    ));
    if (!region) return;
    const current = Number(this.menuScrollState?.[region.menuId] || 0);
    const direction = Number(payload.deltaY || 0) > 0 ? 1 : -1;
    this.menuScrollState[region.menuId] = Math.max(0, Math.min(region.maxScroll, current + direction));
  }
}
