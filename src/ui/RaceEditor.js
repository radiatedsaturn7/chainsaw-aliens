import { DEFAULT_RACE_LANE_COUNT, RACE_CAR_SHELL_FRAME_SLOTS, RACE_LANE_WIDTH_M, RACE_SNOW_CONDITIONS, RACE_STOCK_PERFORMANCE_TARGETS, RACE_SURFACES, RACE_TIRE_COMPOUNDS, createBuiltInRaceCars, createDefaultRaceProject, createTestTrackRace, getSurfaceById } from '../racing/raceData.js';
import { buildRaceSurfaceBake, getRaceSurfaceBakeKey as buildRaceSurfaceBakeKey } from '../racing/RaceCorridorGeometry.js';
import { addRaceThreeMeshGroups as addRaceThreeMeshGroupsBatch, drawRaceWebGLTerrainMeshBatch as drawRaceWebGLTerrainMeshBatchModule, drawRaceWebGLWorldMeshBatch as drawRaceWebGLWorldMeshBatchModule } from '../racing/RaceMaterialBatching.js';
import { validateRaceSurfaceGeometry as validateRaceSurfaceGeometryModule } from '../racing/RaceMeshValidation.js';
import { buildRaceRoadbedProfile, sampleRaceRoadbedProfileAtDistance as sampleRaceRoadbedProfileAtDistanceModule } from '../racing/RaceRoadDeckProfile.js';
import { RaceSurfaceModel } from '../racing/RaceSurfaceModel.js';
import { getRaceTerrainTriangleArea as getRaceTerrainTriangleAreaModule, getRaceTerrainTrianglesOutsideTrackCorridor as getRaceTerrainTrianglesOutsideTrackCorridorModule, triangulateRaceTerrainPolygon as triangulateRaceTerrainPolygonModule, clipRaceTerrainTriangleOutsideTrackCorridor as clipRaceTerrainTriangleOutsideTrackCorridorModule } from '../racing/RaceTerrainClipping.js';
import { createRaceVehiclePhysicsState, getRaceVehicleWheelWorldPose, stepRaceVehiclePhysics, syncRaceVehiclePhysicsToSession } from '../racing/RaceVehiclePhysics.js';
import { getRaceWheelContactState as getRaceWheelContactStateModule, getRaceWheelSurfaceState as getRaceWheelSurfaceStateModule } from '../racing/RaceVehicleSurfaceContact.js';
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
import { openProjectBrowser } from './ProjectBrowserModal.js';
import { loadProjectFile, saveProjectFile, sanitizeProjectFileName } from './projectFiles.js';
import * as THREE from '../vendorBridge/three.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const FEET_TO_METERS = 0.3048;
const MPH_TO_MPS = 0.44704;
const RACE_THREE_ELEVATION_M = 12;
const RACE_THREE_LIFTS_M = {
  terrain: 0,
  shoulder: 0,
  road: 0,
  boundary: 0,
  paint: 0.035
};

const RACE_CONTROLLER_STEERING = {
  speedReferenceMps: 62,
  digitalResponseBase: 84,
  digitalResponseLowSpeedBonus: 36,
  analogResponseBase: 16,
  analogResponseLowSpeedBonus: 5.5,
  analogTargetPressBase: 1.18,
  analogTargetPressLowSpeedBonus: 1.05,
  analogTargetReleaseBase: 7.5,
  analogTargetReleaseHighSpeedBonus: 3.8,
  activeTurnResponseScale: 0.125,
  returnRateBase: 20,
  returnRateHighSpeedBonus: 18,
  stoppedAuthority: 1,
  highwayAuthority: 0.2,
  parkingTireAngleRad: 0.56,
  highwayTireAngleRad: 0.045,
  highSpeedYawDampingFloor: 0.08,
  steeringRatio: 14.5,
  maxSteeringWheelRotationRad: Math.PI * 3
};

const RACE_HIGHWAY_MARKERS = {
  dashLengthM: 10 * FEET_TO_METERS,
  gapLengthM: 30 * FEET_TO_METERS,
  dashWidthM: 0.12,
  edgePostIntervalM: 160 * FEET_TO_METERS
};

const RACE_MIN_ROAD_WIDTH_M = 4;
const RACE_DESTINATION_VISUAL_EXTENSION_M = 40;
const RACE_ROAD_TERRAIN_FLAT_JOIN_WIDTH_M = 0.5;
const RACE_ROAD_TERRAIN_SLOPE_BLEND_WIDTH_M = 4;
const RACE_WORLD_EMPTY_BACKGROUND_COLOR = '#ff00ff';
const RACE_WHEEL_IDS = ['fl', 'fr', 'rl', 'rr'];
const RACE_WHEEL_LABELS = { fl: 'FL', fr: 'FR', rl: 'RL', rr: 'RR' };
const RACE_TILE_MAP_CELL_SIZE_M = 5;
const RACE_GROUND_TEXTURE_BASE_PX = 32;
const RACE_GROUND_TEXTURE_BASE_WORLD_M = 1;
const RACE_GROUND_TEXTURE_PIXEL_SCALE_MIN_M = 0.0001;
const RACE_GROUND_TEXTURE_PIXEL_SCALE_MAX_M = 10;
const RACE_GROUND_TEXTURE_SCALE_MIN_M = RACE_GROUND_TEXTURE_PIXEL_SCALE_MIN_M * RACE_GROUND_TEXTURE_BASE_PX;
const RACE_GROUND_TEXTURE_SCALE_MAX_M = RACE_GROUND_TEXTURE_PIXEL_SCALE_MAX_M * RACE_GROUND_TEXTURE_BASE_PX;
const RACE_GROUND_NEAR_TEXTURE_QUALITY_DEFAULT = 2;
const RACE_GROUND_NEAR_TEXTURE_QUALITY_MIN = 1;
const RACE_GROUND_NEAR_TEXTURE_QUALITY_MAX = 32;
const RACE_GROUND_TEXTURE_FILTER_MODES = [
  { id: 'crisp', label: 'Crisp' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'smooth', label: 'Smooth' }
];
const RACE_GROUND_TEXTURE_FILTER_MODE_IDS = new Set(RACE_GROUND_TEXTURE_FILTER_MODES.map((entry) => entry.id));
const RACE_GROUND_TEXTURE_FILTER_DEFAULT = 'balanced';
const RACE_GROUND_MIP_START_DEFAULT = 0.0015;
const RACE_GROUND_MIP_START_MIN = 0.0005;
const RACE_GROUND_MIP_START_MAX = 0.08;
const RACE_GROUND_MIP_STRENGTH_DEFAULT = 1.35;
const RACE_GROUND_MIP_STRENGTH_MIN = 0;
const RACE_GROUND_MIP_STRENGTH_MAX = 3;
const RACE_GROUND_SCANLINE_RESOLUTION_DEFAULT = 100;
const RACE_GROUND_SCANLINE_RESOLUTION_MIN = 25;
const RACE_GROUND_SCANLINE_RESOLUTION_MAX = 400;
const RACE_GROUND_SCANLINE_ROW_STEP_DEFAULT = 1;
const RACE_GROUND_SCANLINE_ROW_STEP_MIN = 0.25;
const RACE_GROUND_SCANLINE_ROW_STEP_MAX = 4;
const RACE_CAMERA_ANGLE_DEG_DEFAULT = 0;
const RACE_CAMERA_ANGLE_DEG_MIN = -20;
const RACE_CAMERA_ANGLE_DEG_MAX = 20;
const RACE_GROUND_RENDERER_DEFAULT = 'webgl-track';
const RACE_GROUND_RENDERER_IDS = new Set(['software', 'webgl', 'webgl-track']);
const RACE_GROUND_ART_CHUNK_PX = 64;
const RACE_GROUND_CLEAN_ATLAS_MAX_PX = 512;
const RACE_GROUND_CLEAN_TEXTURE_QUANT_STEP = 17;
const RACE_TILE_MAP_LEGACY_MIN_ELEVATION = -0.42;
const RACE_TILE_MAP_LEGACY_MAX_ELEVATION = 0.42;
const RACE_TILE_MAP_MIN_ELEVATION = -1;
const RACE_TILE_MAP_MAX_ELEVATION = 1;
const RACE_TILE_MAP_ELEVATION_STEP = 0.025;
const RACE_TILE_MAP_ELEVATION_AMOUNTS = [
  { id: 'tiny', label: 'Tiny', amount: 0.01 },
  { id: 'small', label: 'Small', amount: 0.025 },
  { id: 'medium', label: 'Medium', amount: 0.05 },
  { id: 'large', label: 'Large', amount: 0.1 },
  { id: 'hill', label: 'Hill', amount: 0.2 },
  { id: 'mountain', label: 'Mountain', amount: 0.35 }
];
const RACE_TILE_MAP_BRUSH_SHAPES = [
  { id: 'square', label: 'Rectangle' },
  { id: 'round', label: 'Oval' }
];
const RACE_TILE_MAP_BRUSH_FALLOFFS = [
  { id: 'hard', label: 'Hard' },
  { id: 'soft', label: 'Soft' },
  { id: 'airbrush', label: 'Airbrush' }
];
const RACE_TILE_MAP_BRUSH_STRENGTHS = [
  { id: '25', label: '25%', strength: 0.25 },
  { id: '50', label: '50%', strength: 0.5 },
  { id: '75', label: '75%', strength: 0.75 },
  { id: '100', label: '100%', strength: 1 }
];
const RACE_EDGE_COLLISION_MODES = [
  { id: 'none', label: 'No Collision' },
  { id: 'road', label: 'Road Edge' },
  { id: 'margin', label: 'Margin Edge' },
  { id: 'shoulder', label: 'Shoulder Edge' }
];
const RACE_EDGE_COLLISION_MODE_IDS = new Set(RACE_EDGE_COLLISION_MODES.map((entry) => entry.id));
const RACE_EDGE_DISPLAY_MODES = [
  { id: 'on', label: 'On' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'off', label: 'Off' }
];
const RACE_EDGE_DISPLAY_MODE_IDS = new Set(RACE_EDGE_DISPLAY_MODES.map((entry) => entry.id));
const RACE_EDGE_COLLISION_EFFECTS = [
  { id: 'collide', label: 'Collide' },
  { id: 'reset', label: 'Reset to Center' }
];
const RACE_EDGE_COLLISION_EFFECT_IDS = new Set(RACE_EDGE_COLLISION_EFFECTS.map((entry) => entry.id));
const RACE_EDGE_RESET_FADE_OUT_MS = 620;
const RACE_EDGE_RESET_BLACK_HOLD_MS = 250;
const RACE_EDGE_RESET_FADE_IN_MS = 620;
const RACE_EDGE_RESET_TOTAL_MS = RACE_EDGE_RESET_FADE_OUT_MS + RACE_EDGE_RESET_BLACK_HOLD_MS + RACE_EDGE_RESET_FADE_IN_MS;
const RACE_TILE_MAP_SCHEMA_VERSION = 2;
const RACE_TILE_MAP_RENDER_CELL_TARGET_PX = 3;
const RACE_TILE_MAP_RENDER_CELL_BUDGET = 2600;
const RACE_TILE_MAP_GRID_MIN_PX = 8;

const RACE_PEDAL_INPUT = {
  digitalThrottlePressRate: 5.2,
  digitalThrottleReleaseRate: 6.8,
  digitalBrakePressRate: 8.5,
  digitalBrakeReleaseRate: 10.5,
  analogFollowRate: 30,
  activeThreshold: 0.05,
  reverseThreshold: 0.62
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

const RACE_DIAGNOSTIC_ACTIONS = {
  'diagnostic-skidpad': 'skidpad',
  'diagnostic-acceleration': 'acceleration',
  'diagnostic-braking': 'braking',
  'diagnostic-quarter-mile': 'quarter-mile',
  'diagnostic-slalom': 'slalom',
  'diagnostic-jump': 'jump',
  'diagnostic-ai-laps': 'ai-laps',
  'ghost-compare': 'ghost-compare'
};

const RACE_NEW_LANE_ACTIONS = Array.from({ length: 6 }, (_, index) => {
  const laneCount = index + 1;
  return {
    id: `new-${laneCount}-lane`,
    laneCount
  };
});

const RACE_NEW_LANE_ACTION_BY_ID = Object.fromEntries(
  RACE_NEW_LANE_ACTIONS.map((entry) => [entry.id, entry])
);

const RACE_SCENERY_PRESETS = [
  { id: 'tree', label: 'Tree', widthM: 1.8, heightM: 6.5, behavior: 'indestructible', weightKg: 900, colors: ['#2f6f3d', '#174027'] },
  { id: 'bush', label: 'Bush', widthM: 1.5, heightM: 1.1, behavior: 'flatten', weightKg: 18, colors: ['#6f9f3d', '#385d22'] },
  { id: 'rock', label: 'Rock', widthM: 2.1, heightM: 1.4, behavior: 'indestructible', weightKg: 1400, colors: ['#8d928b', '#565d57'] },
  { id: 'wall', label: 'Wall', widthM: 3.2, heightM: 2.2, behavior: 'indestructible', weightKg: 2400, colors: ['#7a827e', '#3d4642'] },
  { id: 'sign', label: 'Sign', widthM: 1.2, heightM: 2.4, behavior: 'fly-off', weightKg: 35, colors: ['#f1d36a', '#6b4e20'] }
];

const RACE_SCENERY_PRESET_BY_ID = Object.fromEntries(
  RACE_SCENERY_PRESETS.map((entry) => [entry.id, entry])
);

const RACE_SCENERY_BEHAVIORS = ['indestructible', 'flatten', 'fly-off'];
const RACE_WEATHER_PRESETS = [
  { id: 'clear', label: 'Clear', buildupSeconds: 1, maxIntensity: 0 },
  { id: 'rain', label: 'Rain', buildupSeconds: 150, maxIntensity: 0.72 },
  { id: 'storm', label: 'Storm', buildupSeconds: 70, maxIntensity: 1 },
  { id: 'snow', label: 'Snow', buildupSeconds: 190, maxIntensity: 1 }
];
const RACE_WEATHER_PRESET_BY_ID = Object.fromEntries(RACE_WEATHER_PRESETS.map((entry) => [entry.id, entry]));
const RACE_WEATHER_INTENSITY_STEPS = [0.25, 0.5, 0.75, 1];
const RACE_SURFACE_ART_SLOTS = [
  { id: 'asphalt', label: 'Asphalt', surfaceIds: ['asphalt'] },
  { id: 'wet-asphalt', label: 'Wet Asphalt', surfaceIds: ['wet-asphalt'] },
  { id: 'boundary', label: 'Margin', surfaceIds: [] },
  { id: 'shoulder', label: 'Shoulder', surfaceIds: [] },
  { id: 'dirt', label: 'Dirt', surfaceIds: ['dirt', 'mud'] },
  { id: 'gravel', label: 'Gravel', surfaceIds: ['gravel', 'wet-gravel'] },
  { id: 'snow', label: 'Snow', surfaceIds: ['snow', 'slush'] },
  { id: 'grass', label: 'Grass', surfaceIds: [] }
];
const RACE_SURFACE_ART_SLOT_BY_ID = Object.fromEntries(RACE_SURFACE_ART_SLOTS.map((entry) => [entry.id, entry]));
const RACE_TIRE_FX_SLOTS = [
  { id: 'skidSmoke', label: 'Skid Smoke', color: 'rgba(228,232,222,0.72)' },
  { id: 'asphaltSkid', label: 'Asphalt Skid', color: 'rgba(46,48,46,0.62)' },
  { id: 'dirtDust', label: 'Dirt Dust', color: 'rgba(155,116,72,0.68)' },
  { id: 'gravelDust', label: 'Gravel Smoke', color: 'rgba(176,178,172,0.62)' },
  { id: 'grassDust', label: 'Grass Dust', color: 'rgba(103,145,66,0.62)' },
  { id: 'snowDust', label: 'Snow Dust', color: 'rgba(230,240,244,0.74)' },
  { id: 'wetSpray', label: 'Wet Spray', color: 'rgba(154,184,198,0.58)' }
];
const RACE_TIRE_FX_SLOT_BY_ID = Object.fromEntries(RACE_TIRE_FX_SLOTS.map((entry) => [entry.id, entry]));
const RACE_SKYBOX_PRESETS = [
  {
    id: 'studio-hills',
    label: 'Studio Hills',
    skyTop: '#121b2b',
    skyBottom: '#263950',
    uphillSky: '#304766',
    downhillSky: '#1d2d3a',
    ground: '#182819',
    farColor: '#18263a',
    nearColor: '#20351f',
    cardinalColors: {
      north: '#2f4f76',
      east: '#3e5d32',
      south: '#5a4429',
      west: '#263f52'
    }
  },
  {
    id: 'desert-dusk',
    label: 'Desert Dusk',
    skyTop: '#21152a',
    skyBottom: '#6a4b5d',
    uphillSky: '#7a5c68',
    downhillSky: '#3d3142',
    ground: '#3a2919',
    farColor: '#5d3a42',
    nearColor: '#6b5630',
    cardinalColors: {
      north: '#6f4560',
      east: '#7b5d35',
      south: '#5a2f30',
      west: '#394260'
    }
  },
  {
    id: 'snow-ridge',
    label: 'Snow Ridge',
    skyTop: '#142031',
    skyBottom: '#6f8ca3',
    uphillSky: '#88a5ba',
    downhillSky: '#40586e',
    ground: '#d6e4ea',
    farColor: '#5e7890',
    nearColor: '#cad7db',
    cardinalColors: {
      north: '#bdd4e2',
      east: '#8fa9b8',
      south: '#d8e5ec',
      west: '#748fa4'
    }
  }
];

const RACE_EDITOR_AVAILABLE_ACTIONS = new Set([
  'exit-main',
  'new',
  'open',
  ...RACE_NEW_LANE_ACTIONS.map((entry) => entry.id),
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
  'race-ground-mode',
  'race-ground-paint',
  'race-ground-intensity',
  'race-ground-brush',
  'race-ground-mode-ground',
  'race-ground-mode-elevation',
  'race-ground-mode-sprites',
  'race-ground-paint-raise',
  'race-ground-paint-lower',
  'race-ground-intensity-erase',
  'square-turn',
  'road-width',
  'ai-count',
  'segment-width',
  'segment-bumpiness',
  'boundary-collidable',
  'snow-condition',
  'ground-tile-next',
  'ground-tile-grass',
  'ground-tile-asphalt',
  'ground-tile-dirt',
  'ground-tile-gravel',
  'ground-tile-snow',
  'ground-tile-wet-asphalt',
  'ground-brush-small',
  'ground-brush-medium',
  'ground-brush-large',
  'ground-brush-xl',
  'ground-brush-xxl',
  ...RACE_TILE_MAP_ELEVATION_AMOUNTS.flatMap((entry) => [`elevation-up-${entry.id}`, `elevation-down-${entry.id}`]),
  ...RACE_TILE_MAP_BRUSH_SHAPES.map((entry) => `ground-brush-shape-${entry.id}`),
  ...RACE_TILE_MAP_BRUSH_FALLOFFS.map((entry) => `ground-brush-falloff-${entry.id}`),
  ...RACE_TILE_MAP_BRUSH_STRENGTHS.map((entry) => `ground-brush-strength-${entry.id}`),
  'ground-brush-size-slider',
  'ground-brush-opacity-slider',
  'ground-brush-hardness-slider',
  'paint-ground',
  'edge-tile',
  'surface-asphalt',
  'surface-dirt',
  'surface-gravel',
  'surface-snow',
  'surface-wet-asphalt',
  'edit-shell',
  'shell-frames',
  'shell-frame-prev',
  'shell-frame-next',
  'reverse-frame',
  'tire-treads',
  'add-ons',
  'default-tires',
  'tire-pressure',
  'tire-size',
  'turn-left',
  'turn-center',
  'turn-right',
  'edit-tires',
  'edit-spoiler',
  'drivetrain-menu',
  'drivetrain-rwd',
  'drivetrain-fwd',
  'drivetrain-awd',
  'engine-sound-next',
  'power',
  'power-curve',
  'weight',
  'weight-balance',
  'brake-balance',
  'final-drive',
  'diff-accel',
  'diff-decel',
  'aero-front',
  'aero-rear',
  'spring-front',
  'spring-rear',
  'damping-front',
  'damping-rear',
  'antiroll-front',
  'antiroll-rear',
  'load-wrx',
  'load-brz',
  'load-civic',
  'weather-clear',
  'weather-rain',
  'weather-storm',
  'weather-snow',
  'weather-intensity',
  'skybox-next',
  'race-sun',
  'race-weather',
  'race-tiles',
  'race-margin',
  'race-tire-fx',
  'race-texture-scale',
  'race-decal',
  'race-ground-box',
  'generate-random-race',
  'ai-fill-grid',
  ...Object.keys(RACE_DIAGNOSTIC_ACTIONS),
  ...BUILT_IN_RACE_LOAD_ACTIONS.map((entry) => entry.id),
  'finish-return',
  'add-sprite',
  'sprite-select',
  'paint-sprite',
  'erase-sprite',
  'decal-select',
  'paint-decal',
  'erase-decal',
  'paint-tile',
  'erase-tile',
  'sprite-brush-settings',
  'move-sprite',
  'delete-sprite',
  'sprite-size',
  'sprite-height',
  'sprite-behavior',
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

const CAR_EDITOR_TUNING_ACTION_PATHS = {
  power: 'powerHp',
  'power-curve': 'powerHp',
  weight: 'weightKg',
  'weight-balance': 'weightKg',
  'tire-pressure': 'tirePressurePsi',
  'tire-size': 'wheelRadiusM',
  'brake-balance': 'brakeBalance',
  'final-drive': 'gearFinalDrive',
  'diff-accel': 'differentialAccel',
  'diff-decel': 'differentialDecel',
  'aero-front': 'aeroFront',
  'aero-rear': 'aeroRear',
  'spring-front': 'springFront',
  'spring-rear': 'springRear',
  'damping-front': 'dampingFront',
  'damping-rear': 'dampingRear',
  'antiroll-front': 'antiRollFront',
  'antiroll-rear': 'antiRollRear'
};

const CAR_SHELL_FRAME_LABELS = {
  front: 'Front',
  frontRight: 'Front Right',
  right: 'Right',
  rearRight: 'Rear Right',
  rear: 'Rear',
  rearLeft: 'Rear Left',
  left: 'Left',
  frontLeft: 'Front Left'
};

const DEFAULT_TIRE_SIZE = {
  widthMm: 245,
  aspectRatio: 40,
  wheelDiameterIn: 18
};

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
    this.raceSpriteDrag = null;
    this.raceDecalPaintDrag = null;
    this.raceDecalEraseDrag = null;
    this.raceGroundPaintDrag = null;
    this.raceElevationPaintDrag = null;
    this.racePortraitMode = 'race';
    this.raceElevationBrushSize = 0.1;
    this.raceGroundBrushCells = 31;
    this.raceGroundBrushShape = 'round';
    this.raceGroundBrushFalloff = 'soft';
    this.raceGroundBrushStrength = 1;
    this.raceGroundBrushHardness = 0.5;
    this.raceElevationBrushAmount = RACE_TILE_MAP_ELEVATION_STEP;
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
      dy: 0,
      panX: 0,
      panY: 0
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
    this.selectedSceneryIndex = 0;
    this.selectedSceneryDefinitionIndex = 0;
    this.selectedSceneryPresetId = 'tree';
    this.selectedSceneryArtRef = '';
    this.raceArtSpriteCache = new Map();
    this.raceArtTextureCache = new Map();
    this.raceArtTextureMipCache = new Map();
    this.raceProjectedGroundBuffer = null;
    this.raceWebGLGroundRenderer = null;
    this.raceSkyboxRenderCache = null;
    this.raceSkyboxYawState = null;
    this.raceSpriteSettingsDialogOpen = false;
    this.raceSpriteSettingsDialogDefinitionId = null;
    this.raceSpriteSettingsDialogCreated = false;
    this.raceSpriteSettingsSliderRegions = [];
    this.raceSpriteSettingsSliderDrag = null;
    this.raceSettingsDialog = null;
    this.raceSettingsDialogDraft = null;
    this.raceSettingsSliderRegions = [];
    this.raceSettingsSliderDrag = null;
    this.selectedRaceSurfaceArtSlotId = 'grass';
    this.selectedRaceDecalArtRef = '';
    this.selectedRaceGroundBoxArtRef = '';
    this.raceSpritePaintKind = 'sprite';
    this.currentRaceDocumentName = '';
    this.currentCarDocumentName = '';
    this.selectedCarShellFrameSlot = 'front';
    this.racePortraitHotMenu = null;
    this.status = 'Ready';
    this.activeRootId = mode === 'car' ? 'art' : 'track';
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
    this.preRaceTuningTab = 'tires';
    this.playtestSession = null;
    this.playtestFps = 0;
    this.lastRacePlaytestFpsMs = 0;
    this.racePlaytestRenderMs = 0;
    this.raceTexturePreviewFps = 0;
    this.raceTexturePreviewRenderMs = 0;
    this.raceWebGLTrackDynamicScale = 1;
    this.lastRaceRenderStats = null;
    this.pendingDiagnosticMode = null;
    this.bestRaceGhosts = {};
    this.racePathSampleCache = new Map();
    this.raceBrushOffsetCache = new Map();
    this.raceGroundPaletteCache = new Map();
    this.raceGroundBasePaletteRgbCache = new Map();
    this.raceTerrainElevationCache = new Map();
    this.raceRoadDeckElevationCache = new Map();
    this.raceRoadSurfaceProfileCache = new Map();
    this.raceRoadCorridorCache = new Map();
    this.raceRoadbedProfileCache = new Map();
    this.raceSurfaceBakeCache = null;
    this.raceWorldBakeCache = null;
    this.raceTileMapStatsCache = new WeakMap();
    this.raceTerrainBakeCache = null;
    this.raceWebGLColorCache = new Map();
    this.raceTileMapDirtyChunks = new Set();
    this.raceGroundBrushSliderRegions = [];
    this.raceGroundBrushSliderDrag = null;
    this.raceInput = {
      steeringTarget: 0,
      steeringWheel: 0,
      analogSteeringIntent: 0,
      analogSteeringCenteredMs: 0,
      throttle: false,
      brake: false,
      handbrake: false,
      rawThrottleAxis: 0,
      rawBrakeAxis: 0,
      throttleAxis: 0,
      brakeAxis: 0,
      analogThrottleActive: false,
      analogBrakeActive: false,
      autoShift: true,
      transmissionMode: 'automatic',
      absEnabled: true,
      tractionControlEnabled: true,
      telemetryVisible: false,
      keyboardThrottle: false,
      keyboardBrake: false,
      keyboardSteer: 0,
      binarySteer: 0,
      digitalSteerHoldMs: 0,
      gear: 0,
      cameraView: 'third-person',
      lookIntentX: 0,
      lookAngle: 0,
      pauseMenuMode: 'main',
      pauseMenuIndex: 0,
      paused: false,
      analogSteeringActive: false,
      lastSteeringInputMode: null,
      activeDpadPointerId: null,
      activeThrottlePointerId: null,
      activeBrakePointerId: null,
      throttlePulseMs: 0,
      lastBrakeTapMs: 0
    };
    this.normalizeRaceProjectData();
  }

  update(input, dt) {
    this.previewOffset = (this.previewOffset + dt * 60) % 240;
    this.updateRacePlaytestFps(dt);
    this.updateRaceMapThumbstickPan(dt);
    if (!this.hasPhysicalRaceGamepad() && this.gamepadSubmenuOpen) {
      this.mobileRootOpen = false;
      this.gamepadSubmenuOpen = false;
    }
    this.updateRaceKeyboardInput(input);
    this.updatePlaytest(dt);
    if (this.playtestSession && (input?.wasPressed?.('pause') || input?.wasPressed?.('start') || (!this.raceInput.paused && input?.wasPressedCode?.('Enter')))) {
      this.toggleRacePause();
      return;
    }
    if (input?.wasPressed?.('cancel')) {
      if (this.playtestPickerOpen) {
        this.cancelPlaytestPicker();
        return;
      }
      if (this.playtestSession) {
        if (this.raceInput.paused) this.toggleRacePause();
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

  normalizeStudioSprintRace(race = null) {
    if (!race || typeof race !== 'object') return false;
    const id = String(race.id || '').trim().toLowerCase();
    const name = String(race.name || '').trim().toLowerCase();
    if (id !== 'test-loop' && name !== 'studio sprint') return false;
    let changed = false;
    if (Array.isArray(race.hazards) && race.hazards.length) {
      race.hazards = [];
      changed = true;
    } else if (!Array.isArray(race.hazards)) {
      race.hazards = [];
      changed = true;
    }
    const segments = Array.isArray(race.road?.segments) ? race.road.segments : [];
    segments.forEach((segment) => {
      if (Array.isArray(segment?.hazardIds) && segment.hazardIds.length) {
        segment.hazardIds = [];
        changed = true;
      }
    });
    return changed;
  }

  normalizeRaceProjectData() {
    let changed = false;
    (this.project?.races || []).forEach((race) => {
      if (this.normalizeStudioSprintRace(race)) changed = true;
    });
    if (changed) this.invalidateRaceTerrainCaches(this.ensureRaceTileMap());
    return changed;
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
    this.raceInput.rawThrottleAxis = 0;
    this.raceInput.rawBrakeAxis = 0;
    this.raceInput.throttleAxis = 0;
    this.raceInput.brakeAxis = 0;
    this.raceInput.analogThrottleActive = false;
    this.raceInput.analogBrakeActive = false;
    this.raceInput.binarySteer = 0;
    this.raceInput.keyboardThrottle = false;
    this.raceInput.keyboardBrake = false;
    this.raceInput.keyboardSteer = 0;
    this.raceInput.analogSteeringActive = false;
    this.raceInput.analogSteeringIntent = 0;
    this.raceInput.lastSteeringInputMode = null;
    this.raceInput.steeringTarget = 0;
    this.raceInput.steeringWheel = 0;
    this.raceInput.activeDpadPointerId = null;
    this.raceInput.activeThrottlePointerId = null;
    this.raceInput.activeBrakePointerId = null;
  }

  hasPhysicalRaceGamepad() {
    if (typeof this.game?.input?.isGamepadConnected === 'function') {
      return Boolean(this.game.input.isGamepadConnected());
    }
    return Boolean(this.game?.input?.gamepadConnected);
  }

  clearRaceTouchControls() {
    this.raceInput.activeDpadPointerId = null;
    this.raceInput.activeThrottlePointerId = null;
    this.raceInput.activeBrakePointerId = null;
    this.raceInput.binarySteer = 0;
    this.raceInput.throttle = false;
    this.raceInput.brake = false;
    this.raceInput.handbrake = false;
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

  updateRacePlaytestFps(dt) {
    if (!this.playtestSession) {
      this.playtestFps = 0;
      this.lastRacePlaytestFpsMs = 0;
      this.raceWebGLTrackDynamicScale = 1;
      return;
    }
    const nowMs = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : 0;
    const wallSeconds = this.lastRacePlaytestFpsMs > 0 && nowMs > this.lastRacePlaytestFpsMs
      ? (nowMs - this.lastRacePlaytestFpsMs) / 1000
      : 0;
    if (nowMs > 0) this.lastRacePlaytestFpsMs = nowMs;
    const seconds = wallSeconds > 0 ? wallSeconds : Number(dt) || 0;
    if (seconds <= 0) return;
    const instant = clamp(1 / seconds, 1, 240);
    this.playtestFps = this.playtestFps > 0
      ? this.playtestFps * 0.88 + instant * 0.12
      : instant;
    if (this.getRaceGroundRenderer() === 'webgl-track') {
      if (this.shouldHoldRaceWebGLDynamicScale()) {
        this.raceWebGLTrackDynamicScale = 1;
      } else if (this.playtestFps < 34) {
        this.raceWebGLTrackDynamicScale = Math.max(0.62, Number(this.raceWebGLTrackDynamicScale || 1) - 0.045);
      } else if (this.playtestFps > 56) {
        this.raceWebGLTrackDynamicScale = Math.min(1, Number(this.raceWebGLTrackDynamicScale || 1) + 0.015);
      }
    }
  }

  shouldHoldRaceWebGLDynamicScale(session = this.playtestSession) {
    if (!session) return false;
    return this.isRaceLaunchSteeringLocked(session);
  }

  isRaceLaunchSteeringLocked(session = this.playtestSession) {
    if (!session?.running) return false;
    const absSpeed = Math.abs(Number(session.speedMps || 0));
    return absSpeed < 2.2 && (Number(session.launchLockMs || 0) > 0 || this.getRaceVisualTravelDistance(session) < 0);
  }

  blendRaceNumericValue(from, to, blend = 1) {
    const fromValue = Number(from);
    const toValue = Number(to);
    if (!Number.isFinite(fromValue)) return toValue;
    if (!Number.isFinite(toValue)) return fromValue;
    return fromValue + (toValue - fromValue) * clamp(Number(blend) || 0, 0, 1);
  }

  blendRaceAngleValue(from, to, blend = 1) {
    const fromValue = Number(from);
    const toValue = Number(to);
    if (!Number.isFinite(fromValue)) return toValue;
    if (!Number.isFinite(toValue)) return fromValue;
    return fromValue + normalizeAngle(toValue - fromValue) * clamp(Number(blend) || 0, 0, 1);
  }

  blendRaceProjectionProfile(held = {}, live = {}, blend = 1) {
    return {
      roadWidthScale: this.blendRaceNumericValue(held.roadWidthScale, live.roadWidthScale, blend),
      roadMaxWidthRatio: this.blendRaceNumericValue(held.roadMaxWidthRatio, live.roadMaxWidthRatio, blend),
      focalScale: this.blendRaceNumericValue(held.focalScale, live.focalScale, blend),
      roadDepthRatio: this.blendRaceNumericValue(held.roadDepthRatio, live.roadDepthRatio, blend)
    };
  }

  blendRacePitchProfile(held = {}, live = {}, blend = 1) {
    return {
      hillPitch: this.blendRaceNumericValue(held.hillPitch, live.hillPitch, blend),
      horizonRatio: this.blendRaceNumericValue(held.horizonRatio, live.horizonRatio, blend),
      nearPlaneBoost: this.blendRaceNumericValue(held.nearPlaneBoost, live.nearPlaneBoost, blend),
      closeDelta: this.blendRaceNumericValue(held.closeDelta, live.closeDelta, blend),
      farDelta: this.blendRaceNumericValue(held.farDelta, live.farDelta, blend)
    };
  }

  getRacePlaytestFpsLabel() {
    const fps = Math.max(1, Math.round(Number(this.playtestFps || 0)));
    return `${fps} FPS`;
  }

  getRacePlaytestPolygonLabel() {
    const stats = this.lastRaceRenderStats || {};
    if (stats.trackEnabled === false || stats.renderDisabled) {
      const renderMs = Number(stats.renderMs || this.racePlaytestRenderMs || 0);
      const overlayMs = Number(stats.overlayMs || 0);
      return `Track Off${renderMs ? ` / R ${renderMs.toFixed(1)}ms` : ''}${overlayMs ? ` / O ${overlayMs.toFixed(1)}` : ''}`;
    }
    const polygons = Math.max(0, Math.round(Number(stats.polygons ?? stats.triangles ?? 0) || 0));
    const draws = Math.max(0, Math.round(Number(stats.drawCalls || 0)));
    const terrainCells = Math.max(0, Math.round(Number(stats.terrainCells || 0)));
    const terrainCandidates = Math.max(0, Math.round(Number(stats.terrainCandidates || 0)));
    const renderMs = Number(stats.renderMs || this.racePlaytestRenderMs || 0);
    const buildMs = Number(stats.meshBuildMs || 0);
    const terrainBuildMs = Number(stats.terrainBuildMs || 0);
    const gpuMs = Number(stats.webglMs || 0);
    const overlayMs = Number(stats.overlayMs || 0);
    const uploadText = Number(stats.bufferUploads || 0) ? ` / U ${Math.round(Number(stats.bufferUploads || 0))}` : '';
    const textureText = Number(stats.textureUploads || 0) || Number(stats.texturedDrawCalls || 0)
      ? ` / Tex ${Math.round(Number(stats.texturedDrawCalls || 0))}D ${Math.round(Number(stats.textureUploads || 0))}U`
      : '';
    const lodTotal = Number(stats.terrainLod0 || 0)
      + Number(stats.terrainLod1 || 0)
      + Number(stats.terrainLod2 || 0)
      + Number(stats.terrainLod3 || 0);
    const lodText = lodTotal
      ? ` / LOD ${Math.round(Number(stats.terrainLod0 || 0))}/${Math.round(Number(stats.terrainLod1 || 0))}/${Math.round(Number(stats.terrainLod2 || 0))}/${Math.round(Number(stats.terrainLod3 || 0))}`
      : '';
    const bakeText = Number(stats.bakedTerrainGenerated || 0) || Number(stats.bakedTerrainChunks || 0)
      ? ` / Bake +${Math.round(Number(stats.bakedTerrainGenerated || 0))}/${Math.round(Number(stats.bakedTerrainChunks || 0))}`
      : '';
    const stageText = buildMs || gpuMs || overlayMs
      ? ` / TB ${terrainBuildMs.toFixed(1)} B ${buildMs.toFixed(1)} G ${gpuMs.toFixed(1)} O ${overlayMs.toFixed(1)}`
      : '';
    const skippedText = Number(stats.skippedDegenerateTriangles || 0)
      ? ` / Skip ${Math.round(Number(stats.skippedDegenerateTriangles || 0))}`
      : '';
    const droppedText = Number(stats.terrainBudgetDropped || 0) || Number(stats.terrainPreculled || 0)
      ? ` / Drop ${Math.round(Number(stats.terrainBudgetDropped || 0))}/${Math.round(Number(stats.terrainPreculled || 0))}`
      : '';
    const projectionSkippedText = Number(stats.terrainProjectionSkipped || 0)
      ? ` / Proj ${Math.round(Number(stats.terrainProjectionSkipped || 0))}:${Math.round(Number(stats.terrainProjectionNearSkipped || 0))}/${Math.round(Number(stats.terrainProjectionOffscreenSkipped || 0))}/${Math.round(Number(stats.terrainProjectionFloorSkipped || 0))}/${Math.round(Number(stats.terrainProjectionDegenerateSkipped || 0))}`
      : '';
    const coverageText = Number(stats.terrainCoverageMisses || 0)
      ? ` / CovMiss ${Math.round(Number(stats.terrainCoverageMisses || 0))}`
      : '';
    const targetText = Number(stats.webglRenderWidth || 0) && Number(stats.webglRenderHeight || 0)
      ? ` / RT ${Math.round(Number(stats.webglRenderWidth || 0))}x${Math.round(Number(stats.webglRenderHeight || 0))}`
      : '';
    return `Polys ${polygons}${draws ? ` / Draws ${draws}` : ''}${terrainCandidates ? ` / T ${terrainCells}/${terrainCandidates}` : ''}${lodText}${bakeText}${textureText}${uploadText}${skippedText}${droppedText}${projectionSkippedText}${coverageText}${targetText}${renderMs ? ` / R ${renderMs.toFixed(1)}ms` : ''}${stageText}`;
  }

  get selectedScenery() {
    const scenery = this.ensureRaceScenery();
    if (!scenery.length) return null;
    this.selectedSceneryIndex = clamp(Math.round(Number(this.selectedSceneryIndex) || 0), 0, scenery.length - 1);
    return scenery[this.selectedSceneryIndex];
  }

  ensureRaceScenery() {
    const race = this.selectedRace;
    if (!race) return [];
    race.scenery = Array.isArray(race.scenery) ? race.scenery : [];
    return race.scenery;
  }

  ensureRaceSceneryDefinitions() {
    const race = this.selectedRace;
    if (!race) return [];
    race.sceneryDefinitions = Array.isArray(race.sceneryDefinitions) ? race.sceneryDefinitions : [];
    return race.sceneryDefinitions;
  }

  get selectedSceneryDefinition() {
    const definitions = this.ensureRaceSceneryDefinitions();
    if (!definitions.length) return null;
    this.selectedSceneryDefinitionIndex = clamp(Math.round(Number(this.selectedSceneryDefinitionIndex) || 0), 0, definitions.length - 1);
    return definitions[this.selectedSceneryDefinitionIndex];
  }

  createRaceSceneryDefinitionFromArt(artRef = '') {
    const preset = this.getSelectedSceneryPreset();
    const clean = String(artRef || '').trim();
    return {
      id: `sprite-def-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000).toString(36)}`,
      presetId: preset.id,
      artRef: clean,
      label: clean || preset.label,
      widthM: preset.widthM,
      heightM: preset.heightM,
      behavior: preset.behavior,
      weightKg: preset.weightKg
    };
  }

  getSelectedSceneryPreset() {
    return RACE_SCENERY_PRESET_BY_ID[this.selectedSceneryPresetId] || RACE_SCENERY_PRESETS[0];
  }

  getSelectedRaceSkybox() {
    const skyboxId = this.selectedRace?.skybox || this.selectedRace?.visuals?.skybox || 'studio-hills';
    return RACE_SKYBOX_PRESETS.find((preset) => preset.id === skyboxId) || RACE_SKYBOX_PRESETS[0];
  }

  getRaceSkyboxLabel() {
    const artRef = String(this.selectedRace?.skyboxArtRef || this.selectedRace?.visuals?.skyboxArtRef || '').trim();
    return artRef ? `Skybox: ${artRef}` : 'Skybox';
  }

  getRaceGroundTextureBaseWorldM() {
    const race = this.selectedRace;
    const raw = Number(race?.groundTextureBaseWorldM ?? race?.visuals?.groundTextureBaseWorldM);
    return clamp(
      Number.isFinite(raw) && raw > 0 ? raw : RACE_GROUND_TEXTURE_BASE_WORLD_M,
      RACE_GROUND_TEXTURE_SCALE_MIN_M,
      RACE_GROUND_TEXTURE_SCALE_MAX_M
    );
  }

  setRaceGroundTextureBaseWorldM(value = RACE_GROUND_TEXTURE_BASE_WORLD_M) {
    if (!this.selectedRace) return;
    const next = Math.round(clamp(
      Number(value) || RACE_GROUND_TEXTURE_BASE_WORLD_M,
      RACE_GROUND_TEXTURE_SCALE_MIN_M,
      RACE_GROUND_TEXTURE_SCALE_MAX_M
    ) * 1000) / 1000;
    this.selectedRace.groundTextureBaseWorldM = next;
    this.status = `Ground texture scale: 32px = ${next}m`;
  }

  getRaceGroundTexturePixelWorldM() {
    return Math.round((this.getRaceGroundTextureBaseWorldM() / RACE_GROUND_TEXTURE_BASE_PX) * 10000) / 10000;
  }

  setRaceGroundTexturePixelWorldM(value = RACE_GROUND_TEXTURE_BASE_WORLD_M / RACE_GROUND_TEXTURE_BASE_PX) {
    this.setRaceGroundTextureBaseWorldM((Number(value) || (RACE_GROUND_TEXTURE_BASE_WORLD_M / RACE_GROUND_TEXTURE_BASE_PX)) * RACE_GROUND_TEXTURE_BASE_PX);
  }

  getRaceTextureScaleLabel() {
    return `Scale: ${this.getRaceGroundTexturePixelWorldM()}m/px`;
  }

  getRaceGroundNearTextureQuality() {
    const race = this.selectedRace;
    const raw = Number(
      race?.groundNearTextureQuality
      ?? race?.visuals?.groundNearTextureQuality
      ?? race?.groundNearTextureDetail
      ?? race?.visuals?.groundNearTextureDetail
    );
    return Math.round(clamp(
      Number.isFinite(raw) && raw > 0 ? raw : RACE_GROUND_NEAR_TEXTURE_QUALITY_DEFAULT,
      RACE_GROUND_NEAR_TEXTURE_QUALITY_MIN,
      RACE_GROUND_NEAR_TEXTURE_QUALITY_MAX
    ) * 10) / 10;
  }

  setRaceGroundNearTextureQuality(value = RACE_GROUND_NEAR_TEXTURE_QUALITY_DEFAULT) {
    if (!this.selectedRace) return;
    const next = Math.round(clamp(
      Number(value) || RACE_GROUND_NEAR_TEXTURE_QUALITY_DEFAULT,
      RACE_GROUND_NEAR_TEXTURE_QUALITY_MIN,
      RACE_GROUND_NEAR_TEXTURE_QUALITY_MAX
    ) * 10) / 10;
    this.selectedRace.groundNearTextureQuality = next;
    delete this.selectedRace.groundNearTextureDetail;
    this.status = `Near texture quality: ${next}x`;
  }

  getRaceGroundTextureFilterMode() {
    const race = this.selectedRace;
    const source = String(race?.groundTextureFilterMode || race?.visuals?.groundTextureFilterMode || RACE_GROUND_TEXTURE_FILTER_DEFAULT);
    return RACE_GROUND_TEXTURE_FILTER_MODE_IDS.has(source) ? source : RACE_GROUND_TEXTURE_FILTER_DEFAULT;
  }

  setRaceGroundTextureFilterMode(mode = RACE_GROUND_TEXTURE_FILTER_DEFAULT) {
    if (!this.selectedRace) return;
    const next = RACE_GROUND_TEXTURE_FILTER_MODE_IDS.has(String(mode)) ? String(mode) : RACE_GROUND_TEXTURE_FILTER_DEFAULT;
    this.selectedRace.groundTextureFilterMode = next;
    this.status = `Texture filter: ${RACE_GROUND_TEXTURE_FILTER_MODES.find((entry) => entry.id === next)?.label || 'Balanced'}`;
  }

  getRaceGroundTextureFilterLabel(mode = this.getRaceGroundTextureFilterMode()) {
    return RACE_GROUND_TEXTURE_FILTER_MODES.find((entry) => entry.id === mode)?.label || 'Balanced';
  }

  getRaceGroundMipSettings() {
    const race = this.selectedRace;
    const source = race?.groundMipSettings || race?.visuals?.groundMipSettings || {};
    return {
      start: clamp(
        Number.isFinite(Number(source.start)) ? Number(source.start) : RACE_GROUND_MIP_START_DEFAULT,
        RACE_GROUND_MIP_START_MIN,
        RACE_GROUND_MIP_START_MAX
      ),
      strength: clamp(
        Number.isFinite(Number(source.strength)) ? Number(source.strength) : RACE_GROUND_MIP_STRENGTH_DEFAULT,
        RACE_GROUND_MIP_STRENGTH_MIN,
        RACE_GROUND_MIP_STRENGTH_MAX
      )
    };
  }

  setRaceGroundMipSettings(settings = {}) {
    if (!this.selectedRace) return;
    const next = {
      start: Math.round(clamp(Number(settings.start) || RACE_GROUND_MIP_START_DEFAULT, RACE_GROUND_MIP_START_MIN, RACE_GROUND_MIP_START_MAX) * 10000) / 10000,
      strength: Math.round(clamp(Number(settings.strength ?? RACE_GROUND_MIP_STRENGTH_DEFAULT), RACE_GROUND_MIP_STRENGTH_MIN, RACE_GROUND_MIP_STRENGTH_MAX) * 100) / 100
    };
    this.selectedRace.groundMipSettings = next;
    this.status = `Ground mipmaps: start ${next.start}, strength ${next.strength}`;
  }

  getRaceGroundScanlineSettings() {
    const race = this.selectedRace;
    const source = race?.groundScanlineSettings || race?.visuals?.groundScanlineSettings || {};
    return {
      resolution: Math.round(clamp(
        Number.isFinite(Number(source.resolution)) ? Number(source.resolution) : RACE_GROUND_SCANLINE_RESOLUTION_DEFAULT,
        RACE_GROUND_SCANLINE_RESOLUTION_MIN,
        RACE_GROUND_SCANLINE_RESOLUTION_MAX
      ) * 100) / 100,
      rowStep: clamp(
        Math.round((Number.isFinite(Number(source.rowStep)) ? Number(source.rowStep) : RACE_GROUND_SCANLINE_ROW_STEP_DEFAULT) * 100) / 100,
        RACE_GROUND_SCANLINE_ROW_STEP_MIN,
        RACE_GROUND_SCANLINE_ROW_STEP_MAX
      )
    };
  }

  getRaceWebGLTrackRenderResolution(scanlineSettings = {}) {
    const requested = Number(scanlineSettings?.resolution ?? RACE_GROUND_SCANLINE_RESOLUTION_DEFAULT);
    const capped = clamp(
      Number.isFinite(requested) ? requested : RACE_GROUND_SCANLINE_RESOLUTION_DEFAULT,
      RACE_GROUND_SCANLINE_RESOLUTION_MIN,
      RACE_GROUND_SCANLINE_RESOLUTION_MAX
    );
    const dynamicScale = clamp(Number(this.raceWebGLTrackDynamicScale || 1), 0.62, 1);
    return Math.round((capped / 100) * dynamicScale * 1000) / 1000;
  }

  setRaceGroundScanlineSettings(settings = {}) {
    if (!this.selectedRace) return;
    const next = {
      resolution: Math.round(clamp(
        Number(settings.resolution ?? RACE_GROUND_SCANLINE_RESOLUTION_DEFAULT),
        RACE_GROUND_SCANLINE_RESOLUTION_MIN,
        RACE_GROUND_SCANLINE_RESOLUTION_MAX
      ) * 100) / 100,
      rowStep: clamp(
        Math.round(Number(settings.rowStep ?? RACE_GROUND_SCANLINE_ROW_STEP_DEFAULT) * 100) / 100,
        RACE_GROUND_SCANLINE_ROW_STEP_MIN,
        RACE_GROUND_SCANLINE_ROW_STEP_MAX
      )
    };
    this.selectedRace.groundScanlineSettings = next;
    this.status = `Ground scanlines: ${Math.round(next.resolution * 100)}%, row ${next.rowStep}`;
  }

  getRaceCameraAngleDeg() {
    const race = this.selectedRace;
    const source = race?.cameraAngleDeg ?? race?.visuals?.cameraAngleDeg;
    return Math.round(clamp(
      Number.isFinite(Number(source)) ? Number(source) : RACE_CAMERA_ANGLE_DEG_DEFAULT,
      RACE_CAMERA_ANGLE_DEG_MIN,
      RACE_CAMERA_ANGLE_DEG_MAX
    ) * 10) / 10;
  }

  setRaceCameraAngleDeg(value = RACE_CAMERA_ANGLE_DEG_DEFAULT) {
    if (!this.selectedRace) return;
    const next = Math.round(clamp(
      Number(value) || RACE_CAMERA_ANGLE_DEG_DEFAULT,
      RACE_CAMERA_ANGLE_DEG_MIN,
      RACE_CAMERA_ANGLE_DEG_MAX
    ) * 10) / 10;
    this.selectedRace.cameraAngleDeg = next;
    this.status = `Camera angle: ${next}deg`;
  }

  getRaceGroundRenderer() {
    const race = this.selectedRace;
    const source = String(race?.groundRenderer || race?.visuals?.groundRenderer || RACE_GROUND_RENDERER_DEFAULT);
    return RACE_GROUND_RENDERER_IDS.has(source) ? source : RACE_GROUND_RENDERER_DEFAULT;
  }

  getRaceVisualDistanceRange({
    routeLength = this.getRaceRouteLength(),
    runtimeType = this.getActiveRaceRuntimeType(),
    startBackDistance = this.playtestSession?.startBackDistance
  } = {}) {
    const routeEnd = Math.max(1, Number(routeLength || this.getRaceRouteLength()) || 1);
    if (runtimeType === 'circuit') {
      return {
        minVisualDistance: 0,
        maxVisualDistance: routeEnd,
        startVisualExtension: 0,
        finishVisualExtension: 0
      };
    }
    const startVisualExtension = Math.max(
      RACE_DESTINATION_VISUAL_EXTENSION_M,
      Math.max(0, Number(startBackDistance || 0))
    );
    const finishVisualExtension = RACE_DESTINATION_VISUAL_EXTENSION_M;
    return {
      minVisualDistance: -startVisualExtension,
      maxVisualDistance: routeEnd + finishVisualExtension,
      startVisualExtension,
      finishVisualExtension
    };
  }

  setRaceGroundRenderer(renderer = RACE_GROUND_RENDERER_DEFAULT) {
    if (!this.selectedRace) return;
    const next = RACE_GROUND_RENDERER_IDS.has(String(renderer)) ? String(renderer) : RACE_GROUND_RENDERER_DEFAULT;
    this.selectedRace.groundRenderer = next;
    this.status = `Ground renderer: ${next === 'webgl' ? 'WebGL Plane' : 'Software'}`;
  }

  getRaceRenderDebugSettings(race = this.selectedRace) {
    const source = race?.renderDebug || race?.visuals?.renderDebug || {};
    return {
      trackEnabled: source.trackEnabled !== false,
      overlaysEnabled: source.overlaysEnabled !== false,
      lightingEnabled: source.lightingEnabled !== false,
      terrainEnabled: source.terrainEnabled === true,
      texturesEnabled: source.texturesEnabled !== false,
      detailEnabled: source.detailEnabled === true,
      terrainCullingEnabled: source.terrainCullingEnabled !== false,
      terrainLodEnabled: source.terrainLodEnabled !== false,
      terrainBudgetEnabled: source.terrainBudgetEnabled !== false,
      farRoadDecimationEnabled: source.farRoadDecimationEnabled !== false,
      threeEnabled: source.threeEnabled !== false,
      rawTerrainPolygonsEnabled: source.rawTerrainPolygonsEnabled === true,
      editorSurfacePreviewEnabled: source.editorSurfacePreviewEnabled === true,
      editorSurfacePreview3dEnabled: source.editorSurfacePreview3dEnabled === true,
      editorSurfaceDebugMode: String(source.editorSurfaceDebugMode || 'bands')
    };
  }

  setRaceRenderDebugSettings(settings = {}) {
    if (!this.selectedRace) return;
    this.selectedRace.renderDebug = {
      trackEnabled: settings.trackEnabled !== false,
      overlaysEnabled: settings.overlaysEnabled !== false,
      lightingEnabled: settings.lightingEnabled !== false,
      terrainEnabled: settings.terrainEnabled === true,
      texturesEnabled: settings.texturesEnabled !== false,
      detailEnabled: settings.detailEnabled === true,
      terrainCullingEnabled: settings.terrainCullingEnabled !== false,
      terrainLodEnabled: settings.terrainLodEnabled !== false,
      terrainBudgetEnabled: settings.terrainBudgetEnabled !== false,
      farRoadDecimationEnabled: settings.farRoadDecimationEnabled !== false,
      threeEnabled: settings.threeEnabled !== false,
      rawTerrainPolygonsEnabled: settings.rawTerrainPolygonsEnabled === true,
      editorSurfacePreviewEnabled: settings.editorSurfacePreviewEnabled === true,
      editorSurfacePreview3dEnabled: settings.editorSurfacePreview3dEnabled === true,
      editorSurfaceDebugMode: String(settings.editorSurfaceDebugMode || 'bands')
    };
    this.status = 'Race render debug settings updated';
  }

  getRaceMipLabel() {
    const settings = this.getRaceGroundMipSettings();
    return `Mip: ${settings.start}/${settings.strength}`;
  }

  getRaceContinuousSkyboxYaw(cameraYaw = 0) {
    const normalized = ((Number(cameraYaw || 0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const state = this.raceSkyboxYawState || { normalized, continuous: Number(cameraYaw || 0) };
    let delta = normalized - Number(state.normalized || 0);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    const continuous = Number(state.continuous || 0) + delta;
    this.raceSkyboxYawState = { normalized, continuous };
    return continuous;
  }

  async openRaceSkyboxArtPicker() {
    const race = this.selectedRace;
    if (!race) return null;
    this.activeRootId = 'settings';
    this.activeAction = 'skybox-next';
    if (typeof document === 'undefined') {
      race.skyboxArtRef = 'Test Skybox';
      this.status = `Skybox: ${race.skyboxArtRef}`;
      return race.skyboxArtRef;
    }
    const picked = await openProjectBrowser({
      fixedFolder: 'art',
      initialFolder: 'art',
      title: 'Pick Race Skybox Art'
    });
    if (picked?.action === 'open' && picked.name) {
      race.skyboxArtRef = String(picked.name || '').trim();
      this.raceSkyboxRenderCache = null;
      this.status = `Skybox: ${race.skyboxArtRef}`;
      return race.skyboxArtRef;
    }
    this.status = 'Skybox picker closed';
    return null;
  }

  ensureRaceSurfaceArt() {
    const race = this.selectedRace;
    if (!race) return {};
    race.surfaceArt = race.surfaceArt && typeof race.surfaceArt === 'object' ? race.surfaceArt : {};
    return race.surfaceArt;
  }

  ensureRaceDecals() {
    const race = this.selectedRace;
    if (!race) return [];
    race.decals = Array.isArray(race.decals) ? race.decals : [];
    return race.decals;
  }

  getSelectedRaceSurfaceArtSlot() {
    return RACE_SURFACE_ART_SLOT_BY_ID[this.selectedRaceSurfaceArtSlotId] || RACE_SURFACE_ART_SLOTS[0];
  }

  getRaceSurfaceArtLabel() {
    const slot = this.getSelectedRaceSurfaceArtSlot();
    const artRef = this.ensureRaceSurfaceArt()[slot.id] || '';
    return artRef ? `${slot.label}: ${artRef}` : `Tiles: ${slot.label}`;
  }

  async openRaceSurfaceArtPicker(slotId = this.selectedRaceSurfaceArtSlotId) {
    const slot = RACE_SURFACE_ART_SLOT_BY_ID[slotId] || this.getSelectedRaceSurfaceArtSlot();
    this.selectedRaceSurfaceArtSlotId = slot.id;
    if (typeof document === 'undefined') {
      this.ensureRaceSurfaceArt()[slot.id] = `Test ${slot.label}`;
      this.status = `${slot.label} tile art set`;
      return this.ensureRaceSurfaceArt()[slot.id];
    }
    const picked = await openProjectBrowser({
      fixedFolder: 'art',
      initialFolder: 'art',
      title: `Pick ${slot.label} Tile Art`
    });
    if (picked?.action === 'open' && picked.name) {
      this.ensureRaceSurfaceArt()[slot.id] = String(picked.name || '').trim();
      this.status = `${slot.label} tile art set`;
      return this.ensureRaceSurfaceArt()[slot.id];
    }
    this.status = 'Tile art picker closed';
    return null;
  }

  async openRaceMarginArtPicker() {
    if (typeof document === 'undefined') {
      if (this.raceSettingsDialogDraft) this.raceSettingsDialogDraft.artRef = 'Test Margin';
      this.status = 'Margin texture set';
      return 'Test Margin';
    }
    const picked = await openProjectBrowser({
      fixedFolder: 'art',
      initialFolder: 'art',
      title: 'Pick Margin Texture Art'
    });
    if (picked?.action === 'open' && picked.name) {
      const artRef = String(picked.name || '').trim();
      if (this.raceSettingsDialogDraft) this.raceSettingsDialogDraft.artRef = artRef;
      this.status = `Margin texture: ${artRef}`;
      return artRef;
    }
    this.status = 'Margin texture picker closed';
    return null;
  }

  getRaceTireFxDefaults(slotId = 'skidSmoke') {
    const slot = RACE_TIRE_FX_SLOT_BY_ID[slotId] || RACE_TIRE_FX_SLOTS[0];
    return {
      enabled: true,
      artRef: '',
      color: slot.color,
      density: 1,
      lifetimeMs: 620,
      scale: 1
    };
  }

  ensureRaceTireFxSettings() {
    const race = this.selectedRace;
    if (!race) return {};
    race.tireFx = race.tireFx && typeof race.tireFx === 'object' ? race.tireFx : {};
    RACE_TIRE_FX_SLOTS.forEach((slot) => {
      const defaults = this.getRaceTireFxDefaults(slot.id);
      race.tireFx[slot.id] = race.tireFx[slot.id] && typeof race.tireFx[slot.id] === 'object'
        ? { ...defaults, ...race.tireFx[slot.id] }
        : defaults;
      race.tireFx[slot.id].enabled = race.tireFx[slot.id].enabled !== false;
      race.tireFx[slot.id].artRef = String(race.tireFx[slot.id].artRef || '').trim();
      race.tireFx[slot.id].density = clamp(Number(race.tireFx[slot.id].density ?? defaults.density), 0, 3);
      race.tireFx[slot.id].lifetimeMs = clamp(Number(race.tireFx[slot.id].lifetimeMs ?? defaults.lifetimeMs), 120, 1800);
      race.tireFx[slot.id].scale = clamp(Number(race.tireFx[slot.id].scale ?? defaults.scale), 0.25, 4);
      race.tireFx[slot.id].color = String(race.tireFx[slot.id].color || defaults.color);
    });
    return race.tireFx;
  }

  getRaceTireFxSlotSettings(slotId = 'skidSmoke') {
    return this.ensureRaceTireFxSettings()[slotId] || this.getRaceTireFxDefaults(slotId);
  }

  async openRaceTireFxArtPicker(slotId = this.raceSettingsDialogDraft?.slotId || 'skidSmoke') {
    const slot = RACE_TIRE_FX_SLOT_BY_ID[slotId] || RACE_TIRE_FX_SLOTS[0];
    if (typeof document === 'undefined') {
      if (this.raceSettingsDialogDraft) this.raceSettingsDialogDraft.artRef = `Test ${slot.label}`;
      this.status = `${slot.label} art set`;
      return `Test ${slot.label}`;
    }
    const picked = await openProjectBrowser({
      fixedFolder: 'art',
      initialFolder: 'art',
      title: `Pick ${slot.label} Art`
    });
    if (picked?.action === 'open' && picked.name) {
      const artRef = String(picked.name || '').trim();
      if (this.raceSettingsDialogDraft) this.raceSettingsDialogDraft.artRef = artRef;
      this.status = `${slot.label}: ${artRef}`;
      return artRef;
    }
    this.status = 'Tire FX art picker closed';
    return null;
  }

  async openRaceDecalArtPicker() {
    this.racePortraitMode = 'sprites';
    this.activeRootId = 'sprites';
    this.raceSpritePaintKind = 'decal';
    if (typeof document === 'undefined') {
      this.selectedRaceDecalArtRef = 'Test Decal';
      this.activeAction = 'paint-decal';
      this.status = `Paint decal: ${this.selectedRaceDecalArtRef}`;
      return this.selectedRaceDecalArtRef;
    }
    const picked = await openProjectBrowser({
      fixedFolder: 'art',
      initialFolder: 'art',
      title: 'Pick Race Decal Art'
    });
    if (picked?.action === 'open' && picked.name) {
      this.selectedRaceDecalArtRef = String(picked.name || '').trim();
      this.activeAction = 'paint-decal';
      this.status = `Paint decal: ${this.selectedRaceDecalArtRef}`;
      return this.selectedRaceDecalArtRef;
    }
    this.status = 'Decal picker closed';
    return null;
  }

  async openRaceGroundBoxArtPicker() {
    this.racePortraitMode = 'sprites';
    this.activeRootId = 'sprites';
    this.raceSpritePaintKind = 'tile';
    if (typeof document === 'undefined') {
      this.selectedRaceGroundBoxArtRef = 'Test Ground Tile';
      this.activeAction = 'paint-tile';
      this.status = `Paint tile: ${this.selectedRaceGroundBoxArtRef}`;
      return this.selectedRaceGroundBoxArtRef;
    }
    const picked = await openProjectBrowser({
      fixedFolder: 'art',
      initialFolder: 'art',
      title: 'Pick Ground Tile Art'
    });
    if (picked?.action === 'open' && picked.name) {
      this.selectedRaceGroundBoxArtRef = String(picked.name || '').trim();
      this.activeAction = 'paint-tile';
      this.status = `Paint tile: ${this.selectedRaceGroundBoxArtRef}`;
      return this.selectedRaceGroundBoxArtRef;
    }
    this.status = 'Ground tile picker closed';
    return null;
  }

  getRaceSurfaceArtRefForSlot(slotId = '') {
    const art = this.ensureRaceSurfaceArt();
    return String(art?.[slotId] || '').trim();
  }

  ensureRaceMarginSettings() {
    const race = this.selectedRace;
    if (!race) return { enabled: true, widthM: 0.22, artRef: '' };
    race.margin = race.margin && typeof race.margin === 'object' ? race.margin : {};
    if (race.margin.enabled === undefined) race.margin.enabled = true;
    if (race.margin.shoulderEnabled === undefined) race.margin.shoulderEnabled = true;
    if (!RACE_EDGE_DISPLAY_MODE_IDS.has(String(race.margin.marginMode || ''))) {
      race.margin.marginMode = race.margin.enabled === false ? 'off' : 'on';
    }
    if (!RACE_EDGE_DISPLAY_MODE_IDS.has(String(race.margin.shoulderMode || ''))) {
      race.margin.shoulderMode = race.margin.shoulderEnabled === false ? 'off' : 'on';
    }
    race.margin.widthM = clamp(Number(race.margin.widthM) || Number(race.boundaryWidthM) || 0.22, 0.08, 0.65);
    race.margin.shoulderWidthM = clamp(Number(race.margin.shoulderWidthM) || 12, 2, 50);
    if (String(race.margin.collisionMode || '') === 'marginVisibleShoulder') {
      race.margin.collisionMode = 'margin';
      race.margin.collisionEdge = 'margin';
    }
    if (!race.margin.collisionEdge && race.margin.collisionMode) race.margin.collisionEdge = race.margin.collisionMode;
    race.margin.collisionMode = RACE_EDGE_COLLISION_MODE_IDS.has(String(race.margin.collisionMode || ''))
      ? String(race.margin.collisionMode)
      : 'none';
    race.margin.collisionEdge = RACE_EDGE_COLLISION_MODE_IDS.has(String(race.margin.collisionEdge || ''))
      ? String(race.margin.collisionEdge)
      : race.margin.collisionMode;
    race.margin.collisionMode = race.margin.collisionEdge;
    race.margin.collisionEffect = RACE_EDGE_COLLISION_EFFECT_IDS.has(String(race.margin.collisionEffect || ''))
      ? String(race.margin.collisionEffect)
      : 'collide';
    race.margin.artRef = String(race.margin.artRef || this.getRaceSurfaceArtRefForSlot('boundary') || '').trim();
    return race.margin;
  }

  isRaceMarginEnabled() {
    return this.isRaceMarginVisible();
  }

  isRaceMarginVisible() {
    return this.ensureRaceMarginSettings().marginMode === 'on';
  }

  getRaceVisibleMarginWidthWorld(segment = null) {
    return this.isRaceMarginVisible() ? this.getRaceBoundaryWidthWorld(segment) : 0;
  }

  getRaceMarginLabel() {
    const margin = this.ensureRaceMarginSettings();
    return `Margin: ${margin.marginMode === 'off' ? 'Off' : margin.marginMode === 'hidden' ? 'Hidden' : `${Math.round(margin.widthM * 100)}cm`}`;
  }

  getRaceShoulderWidthWorld() {
    const margin = this.ensureRaceMarginSettings();
    if (margin.shoulderMode !== 'on') return 0;
    return this.getRaceConfiguredShoulderWidthWorld();
  }

  getRaceConfiguredShoulderWidthWorld() {
    const margin = this.ensureRaceMarginSettings();
    return clamp(Number(margin.shoulderWidthM) || 12, 2, 50);
  }

  isRaceShoulderVisible() {
    return this.ensureRaceMarginSettings().shoulderMode === 'on';
  }

  getRaceCollisionMarginWidthWorld(segment = null, collisionEdge = this.getRaceEdgeCollisionMode(segment)) {
    const margin = this.ensureRaceMarginSettings();
    if (margin.marginMode === 'off') return 0;
    if (collisionEdge !== 'margin' && collisionEdge !== 'shoulder') return 0;
    return this.getRaceBoundaryWidthWorld(segment);
  }

  getRaceCollisionShoulderWidthWorld(segment = null, collisionEdge = this.getRaceEdgeCollisionMode(segment)) {
    const margin = this.ensureRaceMarginSettings();
    if (margin.shoulderMode === 'off') return 0;
    if (collisionEdge !== 'shoulder') return 0;
    return this.getRaceConfiguredShoulderWidthWorld(segment);
  }

  getRaceEdgeCollisionMode(segment = null) {
    const margin = this.ensureRaceMarginSettings();
    const mode = RACE_EDGE_COLLISION_MODE_IDS.has(String(margin.collisionEdge || margin.collisionMode || '')) ? String(margin.collisionEdge || margin.collisionMode) : 'none';
    if (mode !== 'none') return mode;
    return segment?.boundaryCollidable ? 'margin' : 'none';
  }

  getRaceEdgeCollisionEffect() {
    const margin = this.ensureRaceMarginSettings();
    return RACE_EDGE_COLLISION_EFFECT_IDS.has(String(margin.collisionEffect || '')) ? String(margin.collisionEffect) : 'collide';
  }

  applyRaceCarRouteCenterReset({ projection = null, roadYaw = 0, preserveMotion = false } = {}) {
    if (!this.playtestSession) return;
    const previousSpeedMps = Number(this.playtestSession.speedMps || 0);
    const routeLength = Math.max(1, Number(this.playtestSession.routeLength || this.getRaceRouteLength()));
    const routeRuntimeType = this.playtestSession.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const distance = routeRuntimeType === 'circuit'
      ? ((Number(projection?.distance ?? this.playtestSession.distance ?? 0) % routeLength) + routeLength) % routeLength
      : clamp(Number(projection?.distance ?? this.playtestSession.distance ?? 0), 0, routeLength);
    const pose = this.getRaceWorldPoseAtDistance(distance, { runtimeType: routeRuntimeType });
    const yaw = Number.isFinite(Number(pose.yaw)) ? Number(pose.yaw) : Number(roadYaw || 0);
    this.playtestSession.distance = distance;
    this.playtestSession.projectedDistance = distance;
    this.playtestSession.previousDistance = distance;
    this.playtestSession.worldX = Number(pose.x || 0);
    this.playtestSession.worldZ = Number(pose.z || 0);
    this.playtestSession.carYaw = yaw;
    this.playtestSession.velocityYaw = yaw;
    this.playtestSession.cameraYaw = yaw;
    this.playtestSession.yawVelocityRadps = 0;
    this.playtestSession.speedMps = preserveMotion ? previousSpeedMps : 0;
    this.playtestSession.lateral = 0;
    this.playtestSession.heading = 0;
    this.raceInput.steeringTarget = 0;
    this.raceInput.steeringWheel = 0;
    const car = this.project.cars.find((candidate) => candidate.id === this.playtestSession.carId) || this.selectedCar;
    this.resetRaceVehiclePhysicsState({
      session: this.playtestSession,
      car,
      tuning: this.getRaceCarTuning(car)
    });
  }

  resetRaceCarToRouteCenter({ projection = null, roadYaw = 0, immediate = false } = {}) {
    if (!this.playtestSession) return;
    if (immediate) {
      this.applyRaceCarRouteCenterReset({ projection, roadYaw });
      this.playtestSession.edgeResetFadeMs = RACE_EDGE_RESET_TOTAL_MS;
      this.status = 'Reset to track center';
      return;
    }
    if (this.playtestSession.pendingEdgeCenterReset) return;
    const routeLength = Math.max(1, Number(this.playtestSession.routeLength || this.getRaceRouteLength()));
    const routeRuntimeType = this.playtestSession.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const distance = routeRuntimeType === 'circuit'
      ? ((Number(projection?.distance ?? this.playtestSession.distance ?? 0) % routeLength) + routeLength) % routeLength
      : clamp(Number(projection?.distance ?? this.playtestSession.distance ?? 0), 0, routeLength);
    this.playtestSession.pendingEdgeCenterReset = {
      distance,
      roadYaw: Number(roadYaw || 0),
      moved: false
    };
    this.playtestSession.edgeResetFadeMs = RACE_EDGE_RESET_TOTAL_MS;
    this.status = 'Reset to track center';
  }

  updateRaceEdgeCenterResetFade() {
    const session = this.playtestSession;
    if (!session?.pendingEdgeCenterReset) return;
    const blackStartRemainingMs = RACE_EDGE_RESET_FADE_IN_MS + RACE_EDGE_RESET_BLACK_HOLD_MS;
    if (!session.pendingEdgeCenterReset.moved && Number(session.edgeResetFadeMs || 0) <= blackStartRemainingMs) {
      const pending = session.pendingEdgeCenterReset;
      this.applyRaceCarRouteCenterReset({
        projection: { distance: pending.distance },
        roadYaw: pending.roadYaw,
        preserveMotion: true
      });
      this.playtestSession.pendingEdgeCenterReset = {
        ...pending,
        moved: true
      };
    }
    if (Number(this.playtestSession.edgeResetFadeMs || 0) <= 0) {
      this.playtestSession.pendingEdgeCenterReset = null;
    }
  }

  getRaceSurfaceArtRefForSurface(surfaceId = 'asphalt') {
    const normalized = getSurfaceById(surfaceId).id;
    const direct = RACE_SURFACE_ART_SLOTS.find((slot) => slot.surfaceIds.includes(normalized));
    if (direct) return this.getRaceSurfaceArtRefForSlot(direct.id);
    return '';
  }

  getRaceShoulderArtRef(segment = {}, worldPoint = null) {
    const patch = this.getRaceGroundPaintAtWorldPoint(worldPoint);
    const patchArt = patch?.tileId ? this.getRaceSurfaceArtRefForSlot(patch.tileId) : '';
    return patchArt || this.getRaceSurfaceArtRefForSlot('shoulder') || this.getRaceSurfaceArtRefForSlot('grass');
  }

  openRaceAiDialog() {
    this.raceSettingsDialog = 'ai';
    this.raceSettingsDialogDraft = { aiCount: this.getRaceAiCount() };
    this.raceSettingsSliderRegions = [];
  }

  openRaceWeatherDialog() {
    this.raceSettingsDialog = 'weather';
    this.raceSettingsDialogDraft = {
      weather: String(this.selectedRace?.weather || 'clear'),
      intensity: this.getRaceWeatherAuthoringIntensity()
    };
    this.raceSettingsSliderRegions = [];
  }

  getRaceSunSettings() {
    const source = this.selectedRace?.sun || this.selectedRace?.visuals?.sun || {};
    return {
      angleDeg: clamp(Number(source.angleDeg ?? 315), 0, 360),
      intensity: clamp(Number(source.intensity ?? 0.72), 0, 1)
    };
  }

  openRaceSunDialog() {
    this.raceSettingsDialog = 'sun';
    this.raceSettingsDialogDraft = this.getRaceSunSettings();
    this.raceSettingsSliderRegions = [];
  }

  setRaceSunSettings(settings = {}) {
    if (!this.selectedRace) return;
    this.selectedRace.sun = {
      angleDeg: clamp(Number(settings.angleDeg ?? 315), 0, 360),
      intensity: clamp(Number(settings.intensity ?? 0.72), 0, 1)
    };
  }

  openRaceTilesDialog() {
    this.raceSettingsDialog = 'tiles';
    this.raceSettingsDialogDraft = { slotId: this.selectedRaceSurfaceArtSlotId };
    this.raceSettingsSliderRegions = [];
  }

  openRaceMarginDialog() {
    const margin = this.ensureRaceMarginSettings();
    this.raceSettingsDialog = 'margin';
    this.raceSettingsDialogDraft = {
      marginMode: RACE_EDGE_DISPLAY_MODE_IDS.has(String(margin.marginMode || '')) ? String(margin.marginMode) : (margin.enabled === false ? 'off' : 'on'),
      enabled: margin.marginMode !== 'off',
      widthM: clamp(Number(margin.widthM) || 0.22, 0.08, 0.65),
      shoulderMode: RACE_EDGE_DISPLAY_MODE_IDS.has(String(margin.shoulderMode || '')) ? String(margin.shoulderMode) : (margin.shoulderEnabled === false ? 'off' : 'on'),
      shoulderEnabled: margin.shoulderMode !== 'off',
      shoulderWidthM: clamp(Number(margin.shoulderWidthM) || 12, 2, 50),
      collisionEdge: RACE_EDGE_COLLISION_MODE_IDS.has(String(margin.collisionEdge || margin.collisionMode || '')) ? String(margin.collisionEdge || margin.collisionMode) : 'none',
      collisionMode: RACE_EDGE_COLLISION_MODE_IDS.has(String(margin.collisionEdge || margin.collisionMode || '')) ? String(margin.collisionEdge || margin.collisionMode) : 'none',
      collisionEffect: RACE_EDGE_COLLISION_EFFECT_IDS.has(String(margin.collisionEffect || '')) ? String(margin.collisionEffect) : 'collide',
      artRef: String(margin.artRef || '').trim()
    };
    this.raceSettingsSliderRegions = [];
  }

  openRaceTireFxDialog() {
    const slotId = this.raceSettingsDialogDraft?.slotId || RACE_TIRE_FX_SLOTS[0].id;
    const slot = RACE_TIRE_FX_SLOT_BY_ID[slotId] || RACE_TIRE_FX_SLOTS[0];
    const settings = this.getRaceTireFxSlotSettings(slot.id);
    this.raceSettingsDialog = 'tire-fx';
    this.raceSettingsDialogDraft = {
      slotId: slot.id,
      enabled: settings.enabled !== false,
      artRef: String(settings.artRef || ''),
      color: String(settings.color || slot.color),
      density: clamp(Number(settings.density ?? 1), 0, 3),
      lifetimeMs: clamp(Number(settings.lifetimeMs ?? 620), 120, 1800),
      scale: clamp(Number(settings.scale ?? 1), 0.25, 4)
    };
    this.raceSettingsSliderRegions = [];
  }

  openRaceTextureScaleDialog() {
    const mip = this.getRaceGroundMipSettings();
    const scanline = this.getRaceGroundScanlineSettings();
    const renderDebug = this.getRaceRenderDebugSettings();
    this.raceSettingsDialog = 'texture-scale';
    this.raceSettingsDialogDraft = {
      pixelWorldM: this.getRaceGroundTexturePixelWorldM(),
      nearTextureQuality: this.getRaceGroundNearTextureQuality(),
      textureFilterMode: this.getRaceGroundTextureFilterMode(),
      mipStart: mip.start,
      mipStrength: mip.strength,
      scanlineResolution: scanline.resolution,
      scanlineRowStep: scanline.rowStep,
      groundRenderer: this.getRaceGroundRenderer(),
      trackEnabled: renderDebug.trackEnabled,
      overlaysEnabled: renderDebug.overlaysEnabled,
      lightingEnabled: renderDebug.lightingEnabled,
      terrainEnabled: renderDebug.terrainEnabled,
      texturesEnabled: renderDebug.texturesEnabled,
      detailEnabled: renderDebug.detailEnabled,
      terrainCullingEnabled: renderDebug.terrainCullingEnabled,
      terrainLodEnabled: renderDebug.terrainLodEnabled,
      terrainBudgetEnabled: renderDebug.terrainBudgetEnabled,
      farRoadDecimationEnabled: renderDebug.farRoadDecimationEnabled,
      threeEnabled: renderDebug.threeEnabled,
      rawTerrainPolygonsEnabled: renderDebug.rawTerrainPolygonsEnabled,
      editorSurfacePreviewEnabled: renderDebug.editorSurfacePreviewEnabled,
      editorSurfacePreview3dEnabled: renderDebug.editorSurfacePreview3dEnabled,
      editorSurfaceDebugMode: renderDebug.editorSurfaceDebugMode
    };
    this.raceSettingsSliderRegions = [];
  }

  closeRaceSettingsDialog({ accept = false } = {}) {
    const dialog = this.raceSettingsDialog;
    const draft = this.raceSettingsDialogDraft || {};
    if (accept && dialog === 'ai') {
      this.setRaceAiCount(draft.aiCount);
    } else if (accept && dialog === 'sun') {
      this.setRaceSunSettings(draft);
    } else if (accept && dialog === 'weather') {
      this.setRaceWeather(draft.weather);
      if (this.selectedRace) this.selectedRace.weatherIntensity = draft.weather === 'clear' ? 0 : clamp(Number(draft.intensity) || 0.75, 0.05, 1);
    } else if (accept && dialog === 'tiles') {
      this.selectedRaceSurfaceArtSlotId = draft.slotId || this.selectedRaceSurfaceArtSlotId;
      this.openRaceSurfaceArtPicker(this.selectedRaceSurfaceArtSlotId).catch((error) => {
        if (typeof console !== 'undefined') console.warn('Race tile art picker failed', error);
        this.status = 'Tile art picker failed';
      });
    } else if (accept && dialog === 'margin') {
      const margin = this.ensureRaceMarginSettings();
      margin.marginMode = RACE_EDGE_DISPLAY_MODE_IDS.has(String(draft.marginMode || '')) ? String(draft.marginMode) : (draft.enabled === false ? 'off' : 'on');
      margin.enabled = margin.marginMode !== 'off';
      margin.widthM = clamp(Number(draft.widthM) || 0.22, 0.08, 0.65);
      margin.shoulderMode = RACE_EDGE_DISPLAY_MODE_IDS.has(String(draft.shoulderMode || '')) ? String(draft.shoulderMode) : (draft.shoulderEnabled === false ? 'off' : 'on');
      margin.shoulderEnabled = margin.shoulderMode !== 'off';
      margin.shoulderWidthM = clamp(Number(draft.shoulderWidthM) || 12, 2, 50);
      margin.collisionEdge = RACE_EDGE_COLLISION_MODE_IDS.has(String(draft.collisionEdge || draft.collisionMode || '')) ? String(draft.collisionEdge || draft.collisionMode) : 'none';
      margin.collisionMode = margin.collisionEdge;
      margin.collisionEffect = RACE_EDGE_COLLISION_EFFECT_IDS.has(String(draft.collisionEffect || '')) ? String(draft.collisionEffect) : 'collide';
      margin.artRef = String(draft.artRef || '').trim();
      const art = this.ensureRaceSurfaceArt();
      if (margin.artRef) art.boundary = margin.artRef;
      this.invalidateRaceTerrainCaches(this.ensureRaceTileMap());
      this.status = `Margin ${margin.marginMode === 'off' ? 'off' : margin.marginMode === 'hidden' ? 'hidden' : `${Math.round(margin.widthM * 100)}cm`}`;
    } else if (accept && dialog === 'tire-fx') {
      const slot = RACE_TIRE_FX_SLOT_BY_ID[draft.slotId] || RACE_TIRE_FX_SLOTS[0];
      const settings = this.ensureRaceTireFxSettings();
      settings[slot.id] = {
        enabled: draft.enabled !== false,
        artRef: String(draft.artRef || '').trim(),
        color: String(draft.color || slot.color),
        density: clamp(Number(draft.density ?? 1), 0, 3),
        lifetimeMs: clamp(Number(draft.lifetimeMs ?? 620), 120, 1800),
        scale: clamp(Number(draft.scale ?? 1), 0.25, 4)
      };
      this.status = `${slot.label} FX ${settings[slot.id].enabled ? 'saved' : 'off'}`;
    } else if (accept && dialog === 'texture-scale') {
      if (Number.isFinite(Number(draft.pixelWorldM))) this.setRaceGroundTexturePixelWorldM(draft.pixelWorldM);
      else this.setRaceGroundTextureBaseWorldM(draft.baseWorldM);
      this.setRaceGroundNearTextureQuality(draft.nearTextureQuality);
      this.setRaceGroundTextureFilterMode(draft.textureFilterMode);
      this.setRaceGroundMipSettings({
        start: draft.mipStart,
        strength: draft.mipStrength
      });
      this.setRaceGroundScanlineSettings({
        resolution: draft.scanlineResolution,
        rowStep: draft.scanlineRowStep
      });
      this.setRaceGroundRenderer(draft.groundRenderer);
      this.setRaceRenderDebugSettings(draft);
    }
    this.raceSettingsDialog = null;
    this.raceSettingsDialogDraft = null;
    this.raceSettingsSliderRegions = [];
    this.raceSettingsSliderDrag = null;
  }

  createRaceScenerySprite(worldPoint = {}) {
    const definition = this.selectedSceneryDefinition;
    const preset = RACE_SCENERY_PRESET_BY_ID[definition?.presetId] || this.getSelectedSceneryPreset();
    const artRef = String(definition?.artRef || this.selectedSceneryArtRef || '').trim();
    return {
      id: `scenery-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000).toString(36)}`,
      presetId: preset.id,
      definitionId: definition?.id || '',
      artRef,
      label: definition?.label || artRef || preset.label,
      x: Math.round(Number(worldPoint.x || 0) * 100) / 100,
      z: Math.round(Number(worldPoint.y ?? worldPoint.z ?? 0) * 100) / 100,
      widthM: Number(definition?.widthM) || preset.widthM,
      heightM: Number(definition?.heightM) || preset.heightM,
      behavior: definition?.behavior || preset.behavior,
      weightKg: Number(definition?.weightKg) || preset.weightKg,
      state: 'standing'
    };
  }

  async openRaceSpriteArtPicker() {
    this.racePortraitMode = 'sprites';
    this.activeRootId = 'settings';
    this.activeAction = 'add-sprite';
    if (typeof document === 'undefined') {
      this.cycleSelectedSceneryPreset();
      this.status = `Sprite definition: ${this.getSelectedSceneryPreset().label}`;
      return null;
    }
    const picked = await openProjectBrowser({
      fixedFolder: 'art',
      initialFolder: 'art',
      title: 'Pick Race Sprite Art'
    });
    if (picked?.action === 'open' && picked.name) {
      this.selectedSceneryArtRef = String(picked.name || '').trim();
      const definitions = this.ensureRaceSceneryDefinitions();
      const definition = this.createRaceSceneryDefinitionFromArt(this.selectedSceneryArtRef);
      definitions.push(definition);
      this.selectedSceneryDefinitionIndex = definitions.length - 1;
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'settings';
      this.activeAction = 'add-sprite';
      this.racePortraitHotMenu = null;
      this.openRaceSpriteSettingsDialog(definition, { created: true });
      this.status = `Configure ${definition.label}`;
      return this.selectedSceneryArtRef;
    }
    this.status = 'Sprite art picker closed';
    return null;
  }

  openRaceSpriteSettingsDialog(definition = this.selectedSceneryDefinition, { created = false } = {}) {
    if (!definition) return false;
    this.raceSpriteSettingsDialogOpen = true;
    this.raceSpriteSettingsDialogDefinitionId = definition.id;
    this.raceSpriteSettingsDialogCreated = Boolean(created);
    this.raceSpriteSettingsSliderRegions = [];
    return true;
  }

  closeRaceSpriteSettingsDialog({ accept = false } = {}) {
    const definitionId = this.raceSpriteSettingsDialogDefinitionId;
    if (!accept && this.raceSpriteSettingsDialogCreated && definitionId) {
      const definitions = this.ensureRaceSceneryDefinitions();
      const index = definitions.findIndex((definition) => definition.id === definitionId);
      if (index >= 0) definitions.splice(index, 1);
      this.selectedSceneryDefinitionIndex = clamp(this.selectedSceneryDefinitionIndex, 0, Math.max(0, definitions.length - 1));
      this.status = 'Sprite add canceled';
    } else if (accept) {
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'sprites';
      this.activeAction = 'paint-sprite';
      this.status = this.selectedSceneryDefinition ? `Paint ${this.selectedSceneryDefinition.label}` : 'Sprite configured';
    }
    this.raceSpriteSettingsDialogOpen = false;
    this.raceSpriteSettingsDialogDefinitionId = null;
    this.raceSpriteSettingsDialogCreated = false;
    this.raceSpriteSettingsSliderRegions = [];
    this.raceSpriteSettingsSliderDrag = null;
  }

  getRaceSpriteSettingsDialogDefinition() {
    const definitions = this.ensureRaceSceneryDefinitions();
    return definitions.find((definition) => definition.id === this.raceSpriteSettingsDialogDefinitionId)
      || this.selectedSceneryDefinition
      || null;
  }

  cycleSelectedSceneryPreset() {
    const index = Math.max(0, RACE_SCENERY_PRESETS.findIndex((entry) => entry.id === this.selectedSceneryPresetId));
    this.selectedSceneryPresetId = RACE_SCENERY_PRESETS[(index + 1) % RACE_SCENERY_PRESETS.length].id;
    this.status = `Sprite preset: ${this.getSelectedSceneryPreset().label}`;
  }

  cycleSelectedScenerySize() {
    const sprite = this.selectedSceneryDefinition || this.selectedScenery;
    if (!sprite) return;
    const widths = [0.8, 1.2, 1.8, 2.4, 3.2, 4.8, 6.4];
    const current = Number(sprite.widthM) || 1.8;
    const next = widths.find((width) => width > current + 0.05) || widths[0];
    const ratio = next / Math.max(0.1, current);
    sprite.widthM = next;
    sprite.heightM = Math.round(Math.max(0.4, Number(sprite.heightM || next) * ratio) * 10) / 10;
    this.status = `Sprite size: ${sprite.widthM}m x ${sprite.heightM}m`;
  }

  cycleSelectedSceneryBehavior() {
    const sprite = this.selectedSceneryDefinition || this.selectedScenery;
    if (!sprite) return;
    const index = Math.max(0, RACE_SCENERY_BEHAVIORS.indexOf(sprite.behavior));
    sprite.behavior = RACE_SCENERY_BEHAVIORS[(index + 1) % RACE_SCENERY_BEHAVIORS.length];
    this.status = `Sprite behavior: ${sprite.behavior.replace(/-/g, ' ')}`;
  }

  cycleSelectedSceneryHeight() {
    const sprite = this.selectedSceneryDefinition || this.selectedScenery;
    if (!sprite) return;
    const heights = [0.8, 1.2, 1.8, 2.4, 3.5, 5, 6.5, 9, 12];
    const current = Number(sprite.heightM) || 2.4;
    const next = heights.find((height) => height > current + 0.05) || heights[0];
    sprite.heightM = next;
    this.status = `Sprite height: ${sprite.heightM}m`;
  }

  selectAdjacentSceneryDefinition(delta = 1) {
    const definitions = this.ensureRaceSceneryDefinitions();
    if (!definitions.length) {
      this.status = 'Add a sprite from Settings first';
      return false;
    }
    this.selectedSceneryDefinitionIndex = clamp(
      Math.round(Number(this.selectedSceneryDefinitionIndex) || 0) + Math.sign(Number(delta) || 1),
      0,
      definitions.length - 1
    );
    this.status = `Sprite: ${definitions[this.selectedSceneryDefinitionIndex]?.label || 'Sprite'}`;
    return true;
  }

  addRaceScenerySpriteAtPoint(point = {}) {
    if (!this.raceMapBounds) return false;
    const world = this.screenToRaceMapWorldPoint(point.x, point.y, this.raceMapBounds);
    if (!world) return false;
    const scenery = this.ensureRaceScenery();
    if (!this.selectedSceneryDefinition) {
      this.status = 'Add a sprite from Settings first';
      return false;
    }
    const sprite = this.createRaceScenerySprite(world);
    scenery.push(sprite);
    this.selectedSceneryIndex = scenery.length - 1;
    this.racePortraitMode = 'sprites';
    this.activeRootId = 'sprites';
    this.activeAction = 'paint-sprite';
    this.status = `Painted ${sprite.label}`;
    return true;
  }

  createRaceDecal(worldPoint = {}, { kind = null } = {}) {
    const decalKind = kind || (this.activeAction === 'paint-tile' || this.raceSpritePaintKind === 'tile' ? 'tile' : 'decal');
    const artRef = String(decalKind === 'tile' ? this.selectedRaceGroundBoxArtRef : this.selectedRaceDecalArtRef || '').trim();
    if (!artRef) return null;
    const tileSize = this.getRaceTilePaintSizeM();
    return {
      id: `decal-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000).toString(36)}`,
      kind: decalKind,
      artRef,
      x: Math.round(Number(worldPoint.x || 0) * 100) / 100,
      z: Math.round(Number(worldPoint.y ?? worldPoint.z ?? 0) * 100) / 100,
      widthM: decalKind === 'tile' ? tileSize : 3.2,
      heightM: decalKind === 'tile' ? tileSize : 3.2,
      tileWorldM: decalKind === 'tile' ? 2.5 : undefined,
      shape: decalKind === 'tile' ? this.getRaceTilePaintShape() : 'rectangle',
      rotation: 0
    };
  }

  addRaceDecalAtPoint(point = {}, { kind = null, minSpacingM = 0 } = {}) {
    if (!this.raceMapBounds) return false;
    const world = this.screenToRaceMapWorldPoint(point.x, point.y, this.raceMapBounds);
    if (!world) return false;
    const decal = this.createRaceDecal(world, { kind });
    if (!decal) {
      this.status = kind === 'tile' || this.raceSpritePaintKind === 'tile' ? 'Pick a ground tile first' : 'Pick a decal first';
      return false;
    }
    const decals = this.ensureRaceDecals();
    const spacing = Math.max(0, Number(minSpacingM) || 0);
    if (spacing > 0 && decals.some((candidate) => (
      String(candidate.kind || 'decal') === decal.kind
      && String(candidate.artRef || '') === decal.artRef
      && Math.hypot(Number(candidate.x || 0) - decal.x, Number(candidate.z || 0) - decal.z) < spacing
    ))) {
      return true;
    }
    decals.push(decal);
    this.racePortraitMode = 'sprites';
    this.activeRootId = 'sprites';
    this.raceSpritePaintKind = decal.kind === 'tile' ? 'tile' : 'decal';
    this.activeAction = decal.kind === 'tile' ? 'paint-tile' : 'paint-decal';
    this.status = `Painted ${decal.kind === 'tile' ? 'tile' : 'decal'}: ${decal.artRef}`;
    return true;
  }

  eraseRaceDecalAtPoint(point = {}, { kind = null } = {}) {
    if (!this.raceMapBounds) return false;
    const decals = this.ensureRaceDecals();
    let best = null;
    decals.forEach((decal, index) => {
      if (kind && String(decal.kind || 'decal') !== kind) return;
      const screen = this.raceMapWorldToScreenPoint({ x: decal.x, y: decal.z }, this.raceMapBounds);
      if (!screen) return;
      const radius = Math.max(8, (Number(decal.widthM) || 3.2) * Number(screen.scale || 1) * 0.55);
      const distance = Math.hypot(Number(point.x || 0) - screen.screenX, Number(point.y || 0) - screen.screenY);
      if (distance <= radius + 10 && (!best || distance < best.distance)) best = { index, distance };
    });
    if (!best) return false;
    const [removed] = decals.splice(best.index, 1);
    this.status = `Erased ${String(removed?.kind || 'decal')}: ${removed?.artRef || 'decal'}`;
    return true;
  }

  findRaceSceneryAtPoint(point = {}) {
    if (!this.raceMapBounds) return null;
    const scenery = this.ensureRaceScenery();
    let best = null;
    scenery.forEach((sprite, index) => {
      if (sprite.state === 'removed') return;
      const screen = this.raceMapWorldToScreenPoint({ x: sprite.x, y: sprite.z }, this.raceMapBounds);
      if (!screen) return;
      const radius = Math.max(8, (Number(sprite.widthM) || 1.5) * Number(screen.scale || 1) * 0.5);
      const distance = Math.hypot(Number(point.x || 0) - screen.screenX, Number(point.y || 0) - screen.screenY);
      if (distance <= radius + 10 && (!best || distance < best.distance)) {
        best = { sprite, index, distance };
      }
    });
    return best;
  }

  beginRaceSceneryDrag(point = {}) {
    const hit = this.findRaceSceneryAtPoint(point);
    if (!hit) return false;
    this.selectedSceneryIndex = hit.index;
    this.raceSelectionType = 'sprite';
    if (this.activeAction === 'delete-sprite' || this.activeAction === 'erase-sprite') {
      this.deleteSelectedRaceScenery();
      return true;
    }
    this.raceSpriteDrag = { id: point.id ?? 'pointer', index: hit.index };
    this.racePortraitMode = 'sprites';
    this.activeRootId = 'sprites';
    this.status = `Move ${hit.sprite.label || 'sprite'}`;
    return true;
  }

  updateRaceSceneryDrag(point = {}) {
    if (!this.raceSpriteDrag || this.raceSpriteDrag.id !== (point.id ?? 'pointer')) return false;
    const scenery = this.ensureRaceScenery();
    const sprite = scenery[this.raceSpriteDrag.index];
    const world = this.screenToRaceMapWorldPoint(point.x, point.y, this.raceMapBounds);
    if (!sprite || !world) return false;
    sprite.x = Math.round(Number(world.x || 0) * 100) / 100;
    sprite.z = Math.round(Number(world.y || 0) * 100) / 100;
    this.selectedSceneryIndex = this.raceSpriteDrag.index;
    return true;
  }

  deleteSelectedRaceScenery() {
    const scenery = this.ensureRaceScenery();
    if (!scenery.length) return false;
    const index = clamp(Math.round(Number(this.selectedSceneryIndex) || 0), 0, scenery.length - 1);
    const [removed] = scenery.splice(index, 1);
    this.selectedSceneryIndex = clamp(index, 0, Math.max(0, scenery.length - 1));
    this.status = `Deleted ${removed?.label || 'sprite'}`;
    return true;
  }

  cloneRaceSegment(segment = null) {
    const source = segment || this.selectedSegment || this.selectedRace?.road?.segments?.[0] || {};
    return {
      length: Math.max(60, Math.round(Number(source.length) || 140)),
      curve: clamp(Number(source.curve) || 0, -1, 1),
      elevation: clamp(Number(source.elevation) || 0, -0.5, 0.5),
      surface: getSurfaceById(source.surface).id,
      roadWidthM: clamp(Number(source.roadWidthM || source.roadWidth || this.selectedRace?.road?.width || RACE_LANE_WIDTH_M), 2.2, 24),
      bumpiness: clamp(Number(source.bumpiness) || 0, 0, 1),
      ...(source.snowCondition ? { snowCondition: source.snowCondition } : {}),
      ...(source.edgeTileId ? { edgeTileId: source.edgeTileId } : {}),
      ...(source.boundaryCollidable ? { boundaryCollidable: true } : {}),
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
    } else if (field === 'boundary') {
      this.toggleSelectedSegmentBoundaryCollidable();
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
    const nextLaneCount = this.getRaceRoadLaneCount() >= 6 ? 1 : this.getRaceRoadLaneCount() + 1;
    this.applyRaceLaneCount(nextLaneCount);
  }

  getRaceBoundaryWidthWorld(segment = null) {
    const margin = this.ensureRaceMarginSettings();
    return clamp(Number(segment?.boundaryWidthM) || Number(margin.widthM) || 0.22, 0.08, 0.65);
  }

  getRaceBoundaryArtRef(segment = null) {
    const margin = this.ensureRaceMarginSettings();
    return String(segment?.boundaryArtRef || margin.artRef || this.getRaceSurfaceArtRefForSlot('boundary') || '').trim();
  }

  toggleSelectedSegmentBoundaryCollidable() {
    const segment = this.selectedSegment;
    if (!segment) return false;
    segment.boundaryCollidable = !segment.boundaryCollidable;
    this.status = `Boundary collision ${segment.boundaryCollidable ? 'on' : 'off'}`;
    return true;
  }

  applyRaceLaneCount(laneCount = DEFAULT_RACE_LANE_COUNT) {
    const road = this.selectedRace?.road;
    if (!road) return;
    const nextLaneCount = clamp(Math.round(Number(laneCount) || DEFAULT_RACE_LANE_COUNT), 1, 6);
    road.laneCount = nextLaneCount;
    road.laneWidthM = RACE_LANE_WIDTH_M;
    road.width = Math.round(nextLaneCount * RACE_LANE_WIDTH_M * 10) / 10;
    for (const segment of road.segments || []) {
      if (!segment || segment.roadWidthM || segment.roadWidth) continue;
      segment.roadWidthM = road.width;
    }
    this.status = `New road width: ${nextLaneCount} lane${nextLaneCount === 1 ? '' : 's'} (${road.width} m)`;
  }

  getRaceRoadLaneCount(segment = null) {
    const road = this.selectedRace?.road || {};
    const width = Number(segment?.roadWidthM || segment?.roadWidth || road.width || RACE_LANE_WIDTH_M);
    const laneWidthM = clamp(Number(road.laneWidthM || RACE_LANE_WIDTH_M), 2.8, 4.2);
    const explicitLaneCount = Number(segment?.laneCount || road.laneCount);
    if (Number.isFinite(explicitLaneCount) && explicitLaneCount > 0 && Math.abs(width - explicitLaneCount * laneWidthM) < laneWidthM * 0.45) {
      return clamp(Math.round(explicitLaneCount), 1, 6);
    }
    return clamp(Math.round(width / laneWidthM), 1, 6);
  }

  getSelectedSegmentRoadWidthM(segment = this.selectedSegment) {
    const minWidth = Math.max(2.2, this.getRaceCarWorldWidth() * 1.25);
    return clamp(Number(segment?.roadWidthM || segment?.roadWidth || this.selectedRace?.road?.width || 11), minWidth, 24);
  }

  cycleSelectedSegmentRoadWidth() {
    const segment = this.selectedSegment;
    if (!segment) return;
    const current = this.getSelectedSegmentRoadWidthM(segment);
    const minWidth = Math.max(2.5, Math.round(this.getRaceCarWorldWidth() * 1.25 * 10) / 10);
    const next = current >= 24 ? minWidth : current + (current < 8 ? 0.5 : 2);
    segment.roadWidthM = Math.round(next * 10) / 10;
    this.status = `Segment width: ${segment.roadWidthM} m`;
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
    this.ensureRaceTileMap(road);
    return road;
  }

  clampRaceElevation(value = 0, fallback = 0) {
    const numeric = Number(value);
    const resolved = Number.isFinite(numeric) ? numeric : Number(fallback) || 0;
    return clamp(resolved, RACE_TILE_MAP_MIN_ELEVATION, RACE_TILE_MAP_MAX_ELEVATION);
  }

  getRaceTileMapElevationBounds(source = {}) {
    const rawMin = Number(source?.minElevation);
    const rawMax = Number(source?.maxElevation);
    return {
      minElevation: Math.min(
        Number.isFinite(rawMin) ? rawMin : RACE_TILE_MAP_MIN_ELEVATION,
        RACE_TILE_MAP_LEGACY_MIN_ELEVATION,
        RACE_TILE_MAP_MIN_ELEVATION
      ),
      maxElevation: Math.max(
        Number.isFinite(rawMax) ? rawMax : RACE_TILE_MAP_MAX_ELEVATION,
        RACE_TILE_MAP_LEGACY_MAX_ELEVATION,
        RACE_TILE_MAP_MAX_ELEVATION
      )
    };
  }

  ensureRaceTileMap(road = this.selectedRace?.road) {
    if (!road) return null;
    const current = road.tileMap && typeof road.tileMap === 'object' ? road.tileMap : {};
    const elevationBounds = this.getRaceTileMapElevationBounds(current);
    if (
      current.schemaVersion === RACE_TILE_MAP_SCHEMA_VERSION
      && current.normalized === true
      && Number(current.cellSizeM) === RACE_TILE_MAP_CELL_SIZE_M
      && current.cells
      && typeof current.cells === 'object'
      && !Array.isArray(current.cells)
    ) {
      if (!Number.isFinite(Number(current.revision))) current.revision = 0;
      current.minElevation = elevationBounds.minElevation;
      current.maxElevation = elevationBounds.maxElevation;
      return current;
    }
    const previousCellSizeM = Math.max(1, Number(current.cellSizeM) || RACE_TILE_MAP_CELL_SIZE_M);
    const cellSizeM = RACE_TILE_MAP_CELL_SIZE_M;
    const sourceCells = current.cells && typeof current.cells === 'object' && !Array.isArray(current.cells)
      ? current.cells
      : {};
    let cells = {};
    if (previousCellSizeM > cellSizeM && Object.keys(sourceCells).length) {
      const ratio = Math.max(1, Math.round(previousCellSizeM / cellSizeM));
      Object.entries(sourceCells).forEach(([key, cell]) => {
        const [rawX, rawY] = key.split(',').map((value) => Math.trunc(Number(value) || 0));
        for (let dy = 0; dy < ratio; dy += 1) {
          for (let dx = 0; dx < ratio; dx += 1) {
            cells[this.getRaceTileMapCellKey(rawX * ratio + dx, rawY * ratio + dy)] = this.normalizeRaceTileMapCell(cell, current);
          }
        }
      });
    } else {
      cells = Object.fromEntries(Object.entries(sourceCells).map(([key, cell]) => [key, this.normalizeRaceTileMapCell(cell, current)]));
    }
    road.tileMap = {
      schemaVersion: RACE_TILE_MAP_SCHEMA_VERSION,
      normalized: true,
      revision: Number.isFinite(Number(current.revision)) ? Number(current.revision) : 0,
      cellSizeM,
      defaultTileId: current.defaultTileId || 'grass',
      minElevation: elevationBounds.minElevation,
      maxElevation: elevationBounds.maxElevation,
      cells
    };
    return road.tileMap;
  }

  normalizeRaceTileMapCell(cell = {}, context = {}) {
    const tileId = cell.tileId || context.defaultTileId || 'grass';
    const rawWeights = cell.tileWeights && typeof cell.tileWeights === 'object' && !Array.isArray(cell.tileWeights)
      ? cell.tileWeights
      : { [tileId]: 1 };
    const positiveWeights = Object.fromEntries(
      Object.entries(rawWeights)
        .map(([id, weight]) => [id, Math.max(0, Number(weight) || 0)])
        .filter(([, weight]) => weight > 0.0005)
    );
    const total = Object.values(positiveWeights).reduce((sum, weight) => sum + weight, 0);
    const tileWeights = total > 0
      ? Object.fromEntries(Object.entries(positiveWeights).map(([id, weight]) => [id, Math.round((weight / total) * 1000) / 1000]))
      : { [tileId]: 1 };
    const dominantTileId = Object.entries(tileWeights).sort((a, b) => b[1] - a[1])[0]?.[0] || tileId;
    return {
      ...cell,
      tileId: dominantTileId,
      tileWeights,
      artRef: String(cell.artRef || cell.tileArtRef || '').trim(),
      elevation: Math.round(clamp(
        Number(cell.elevation) || 0,
        this.getRaceTileMapElevationBounds(context).minElevation,
        this.getRaceTileMapElevationBounds(context).maxElevation
      ) * 1000) / 1000,
      source: cell.source || 'tile-editor',
      tileLabel: cell.tileLabel || this.getRaceTileDefinition(dominantTileId)?.label || this.getRaceGroundTilePalette(dominantTileId).label
    };
  }

  invalidateRaceTerrainCaches(tileMap = this.ensureRaceTileMap(), touchedKeys = []) {
    if (!tileMap) return;
    tileMap.revision = (Number(tileMap.revision) || 0) + 1;
    this.racePathSampleCache?.clear?.();
    this.raceTerrainElevationCache?.clear?.();
    this.raceRoadDeckElevationCache?.clear?.();
    this.raceRoadSurfaceProfileCache?.clear?.();
    this.raceRoadCorridorCache?.clear?.();
    this.raceRoadbedProfileCache?.clear?.();
    this.raceSurfaceModel = null;
    this.raceSurfaceBakeCache = null;
    this.raceWorldBakeCache = null;
    this.raceTerrainBakeCache = null;
    this.raceEditorSurfacePreviewBake = null;
    (touchedKeys || []).forEach((key) => {
      const [x, y] = String(key).split(',').map((value) => Math.trunc(Number(value) || 0));
      this.raceTileMapDirtyChunks?.add?.(`${Math.floor(x / 8)},${Math.floor(y / 8)}`);
    });
  }

  getRaceSurfaceModel() {
    if (!this.raceSurfaceModel) {
      this.raceSurfaceModel = new RaceSurfaceModel({
        flatJoinWidthM: RACE_ROAD_TERRAIN_FLAT_JOIN_WIDTH_M,
        slopeBlendWidthM: RACE_ROAD_TERRAIN_SLOPE_BLEND_WIDTH_M,
        maxCutSideSlope: 0.5,
        maxFillSideSlope: 0.5,
        normalSampleStepM: 1,
        clampElevation: (value) => this.clampRaceElevation(value),
        getActiveRuntimeType: () => this.getActiveRaceRuntimeType(),
        getRouteLength: () => this.getRaceRouteLength(),
        getRoadbedProfile: (options) => this.getRaceRoadbedProfile(options),
        sampleRoadbedProfileAtDistance: (distance, profile) => this.sampleRaceRoadbedProfileAtDistance(distance, profile),
        getWorldPoseAtDistance: (distance, options) => this.getRaceWorldPoseAtDistance(distance, options),
        getSegmentAtDistance: (distance) => this.getRaceSegmentAtDistance(distance).segment,
        projectWorldToTrack: (worldPoint) => this.getRaceRouteProjectionForWorldPoint(worldPoint),
        getRightVector: (yaw) => this.getRaceRightVector(yaw),
        getForwardVector: (yaw) => this.getRaceForwardVector(yaw),
        getRoadHalfWidth: (segment) => this.getRaceRoadHalfWidthWorld(segment),
        getMarginWidth: (segment) => this.getRaceVisibleMarginWidthWorld(segment),
        getShoulderWidth: (segment) => this.getRaceShoulderWidthWorld(segment),
        getBlendWidth: (segment) => this.getRaceRoadTerrainBlendWidthWorld(segment),
        sampleTerrain: (worldPoint, fallbackElevation) => this.getRaceGroundElevationAtWorldPoint(worldPoint, fallbackElevation),
        sampleRawTerrain: (worldPoint, fallbackElevation) => this.getRaceRawGroundElevationAtWorldPoint(worldPoint, fallbackElevation),
        getTileCellAtWorldPoint: (worldPoint) => this.getRaceTileMapCellAtWorldPoint(worldPoint),
        getGroundSurfaceForWorldPoint: (worldPoint, fallbackSurfaceId) => this.getRaceGroundSurfaceForWorldPoint(worldPoint, fallbackSurfaceId),
        getEffectiveSurfaceId: (surfaceId, weatherState) => this.getRaceEffectiveSurfaceId(surfaceId, weatherState),
        getSurfaceById: (surfaceId) => getSurfaceById(surfaceId),
        getWeatherState: () => this.getRaceWeatherState()
      });
    }
    return this.raceSurfaceModel;
  }

  getRaceTileMapCellKey(cellX = 0, cellY = 0) {
    return `${Math.trunc(Number(cellX) || 0)},${Math.trunc(Number(cellY) || 0)}`;
  }

  getRaceTileMapCellCoords(worldPoint = null, tileMap = this.ensureRaceTileMap()) {
    const cellSize = Math.max(1, Number(tileMap?.cellSizeM) || RACE_TILE_MAP_CELL_SIZE_M);
    return {
      cellX: Math.floor((Number(worldPoint?.x) || 0) / cellSize),
      cellY: Math.floor((Number(worldPoint?.z ?? worldPoint?.y) || 0) / cellSize)
    };
  }

  getRaceTileMapCell(cellX = 0, cellY = 0, tileMap = this.ensureRaceTileMap()) {
    if (!tileMap) return null;
    const key = this.getRaceTileMapCellKey(cellX, cellY);
    const explicit = tileMap.cells?.[key] || null;
    const tileWeights = explicit?.tileWeights && typeof explicit.tileWeights === 'object' && !Array.isArray(explicit.tileWeights)
      ? explicit.tileWeights
      : explicit?.tileId
        ? { [explicit.tileId]: 1 }
        : { [tileMap.defaultTileId || 'grass']: 1 };
    const elevation = clamp(
      Number(explicit?.elevation) || 0,
      this.getRaceTileMapElevationBounds(tileMap).minElevation,
      this.getRaceTileMapElevationBounds(tileMap).maxElevation
    );
    return {
      cellX: Math.trunc(Number(cellX) || 0),
      cellY: Math.trunc(Number(cellY) || 0),
      key,
      tileId: explicit?.tileId || tileMap.defaultTileId || 'grass',
      tileWeights,
      artRef: String(explicit?.artRef || explicit?.tileArtRef || '').trim(),
      source: explicit?.source || 'tile-map',
      tileLabel: explicit?.tileLabel || null,
      elevation,
      explicit: Boolean(explicit)
    };
  }

  getRaceTileMapCellAtWorldPoint(worldPoint = null) {
    const tileMap = this.ensureRaceTileMap();
    if (!worldPoint || !tileMap) return null;
    const { cellX, cellY } = this.getRaceTileMapCellCoords(worldPoint, tileMap);
    return this.getRaceTileMapCell(cellX, cellY, tileMap);
  }

  setRaceTileMapCell(cellX = 0, cellY = 0, updates = {}, options = {}) {
    const tileMap = this.ensureRaceTileMap();
    if (!tileMap) return null;
    const x = Math.trunc(Number(cellX) || 0);
    const y = Math.trunc(Number(cellY) || 0);
    const key = this.getRaceTileMapCellKey(x, y);
    const current = tileMap.cells[key] || {};
    const elevation = clamp(
      Number(updates.elevation ?? current.elevation ?? 0) || 0,
      this.getRaceTileMapElevationBounds(tileMap).minElevation,
      this.getRaceTileMapElevationBounds(tileMap).maxElevation
    );
    const incomingWeights = updates.tileWeights && typeof updates.tileWeights === 'object' && !Array.isArray(updates.tileWeights)
      ? updates.tileWeights
      : null;
    const tileId = updates.tileId || current.tileId || tileMap.defaultTileId || 'grass';
    const rawWeights = incomingWeights || current.tileWeights || { [tileId]: 1 };
    const positiveWeights = Object.fromEntries(
      Object.entries(rawWeights)
        .map(([id, weight]) => [id, Math.max(0, Number(weight) || 0)])
        .filter(([, weight]) => weight > 0.0005)
    );
    const weightTotal = Object.values(positiveWeights).reduce((sum, weight) => sum + weight, 0);
    const tileWeights = weightTotal > 0
      ? Object.fromEntries(Object.entries(positiveWeights).map(([id, weight]) => [id, Math.round((weight / weightTotal) * 1000) / 1000]))
      : { [tileId]: 1 };
    const dominantTileId = Object.entries(tileWeights).sort((a, b) => b[1] - a[1])[0]?.[0] || tileId;
    const cell = {
      tileId: dominantTileId,
      tileWeights,
      artRef: updates.clearArtRef ? '' : String(updates.artRef ?? current.artRef ?? current.tileArtRef ?? '').trim(),
      elevation: Math.round(elevation * 1000) / 1000,
      source: updates.source || current.source || 'tile-editor',
      tileLabel: updates.tileLabel || current.tileLabel || this.getRaceTileDefinition(dominantTileId)?.label || this.getRaceGroundTilePalette(dominantTileId).label
    };
    const defaultTile = tileMap.defaultTileId || 'grass';
    const onlyDefault = Object.keys(cell.tileWeights).length === 1 && Number(cell.tileWeights[defaultTile]) > 0.999;
    if (!cell.artRef && cell.tileId === defaultTile && onlyDefault && Math.abs(cell.elevation) < 0.0005) {
      delete tileMap.cells[key];
      if (options.invalidate !== false) this.invalidateRaceTerrainCaches(tileMap, [key]);
      return this.getRaceTileMapCell(x, y, tileMap);
    }
    tileMap.cells[key] = cell;
    if (options.invalidate !== false) this.invalidateRaceTerrainCaches(tileMap, [key]);
    return this.getRaceTileMapCell(x, y, tileMap);
  }

  getRaceTileMapBrushOffsets(cells = this.raceGroundBrushCells || 1) {
    const count = Math.max(1, Math.round(Number(cells) || 1));
    const normalizedCount = count % 2 === 0 ? count + 1 : count;
    const hardness = clamp(Number(this.raceGroundBrushHardness ?? 1), 0, 1);
    const cacheKey = `${normalizedCount}:${this.raceGroundBrushShape}:${this.raceGroundBrushFalloff}:${Math.round(hardness * 100)}`;
    if (!this.raceBrushOffsetCache) this.raceBrushOffsetCache = new Map();
    const cached = this.raceBrushOffsetCache.get(cacheKey);
    if (cached) return cached;
    const half = Math.floor(normalizedCount / 2);
    const offsets = [];
    for (let y = -half; y <= half; y += 1) {
      for (let x = -half; x <= half; x += 1) {
        const distance = Math.hypot(x, y);
        const radius = Math.max(0.5, half + 0.5);
        if (this.raceGroundBrushShape === 'round' && distance > radius) continue;
        const axisDistance = this.raceGroundBrushShape === 'round'
          ? distance / radius
          : Math.max(Math.abs(x), Math.abs(y)) / Math.max(1, half || 1);
        const softEdge = clamp(1 - axisDistance, 0, 1);
        const falloffWeight = clamp(hardness + (1 - hardness) * softEdge * softEdge, 0.04, 1);
        offsets.push({ x, y, weight: normalizedCount === 1 ? 1 : falloffWeight });
      }
    }
    if (this.raceBrushOffsetCache.size > 48) this.raceBrushOffsetCache.clear();
    this.raceBrushOffsetCache.set(cacheKey, offsets);
    return offsets;
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

  getGroundBrushOptions() {
    return [
      { id: 'small', label: '1', size: 0.045, cells: 1 },
      { id: 'medium', label: '3', size: 0.085, cells: 3 },
      { id: 'large', label: '5', size: 0.14, cells: 5 },
      { id: 'xl', label: '9', size: 0.22, cells: 9 },
      { id: 'xxl', label: '15', size: 0.32, cells: 15 }
    ];
  }

  setRaceGroundBrushSize(size = 0.085) {
    const option = typeof size === 'object'
      ? size
      : this.getGroundBrushOptions().find((entry) => entry.size === size || entry.cells === size)
        || this.getGroundBrushOptions().find((entry) => entry.id === size);
    const cells = Math.max(1, Math.round(Number(option?.cells ?? size) || 1));
    this.raceGroundBrushCells = cells % 2 === 0 ? cells + 1 : cells;
    this.raceElevationBrushSize = clamp(Number(option?.size) || Number(size) || 0.085, 0.04, 0.22);
    this.status = `Ground brush: ${this.raceGroundBrushCells}x${this.raceGroundBrushCells}`;
    return true;
  }

  setRaceGroundBrushShape(shapeId = 'square') {
    const shape = RACE_TILE_MAP_BRUSH_SHAPES.find((entry) => entry.id === shapeId) || RACE_TILE_MAP_BRUSH_SHAPES[0];
    this.raceGroundBrushShape = shape.id;
    this.status = `Brush shape: ${shape.label}`;
    return true;
  }

  setRaceGroundBrushFalloff(falloffId = 'hard') {
    const falloff = RACE_TILE_MAP_BRUSH_FALLOFFS.find((entry) => entry.id === falloffId) || RACE_TILE_MAP_BRUSH_FALLOFFS[0];
    this.raceGroundBrushFalloff = falloff.id;
    this.raceGroundBrushHardness = falloff.id === 'hard' ? 1 : falloff.id === 'soft' ? 0.55 : 0.15;
    this.status = `Brush falloff: ${falloff.label}`;
    return true;
  }

  setRaceGroundBrushStrength(strengthId = '100') {
    const strength = RACE_TILE_MAP_BRUSH_STRENGTHS.find((entry) => entry.id === strengthId) || RACE_TILE_MAP_BRUSH_STRENGTHS.at(-1);
    this.raceGroundBrushStrength = strength.strength;
    this.status = `Brush opacity: ${strength.label}`;
    return true;
  }

  setRaceElevationBrushAmount(amountId = 'small') {
    const amount = RACE_TILE_MAP_ELEVATION_AMOUNTS.find((entry) => entry.id === amountId) || RACE_TILE_MAP_ELEVATION_AMOUNTS[1];
    this.raceElevationBrushAmount = amount.amount;
    this.status = `Elevation amount: ${amount.label}`;
    return true;
  }

  getRaceBlendedTileWeights(currentWeights = {}, tileId = this.getSelectedGroundTileId(), opacity = 1) {
    const strength = clamp(Number(opacity) || 0, 0, 1);
    const weights = { ...(currentWeights || {}) };
    const ids = new Set([...Object.keys(weights), tileId]);
    ids.forEach((id) => {
      const existing = Math.max(0, Number(weights[id]) || 0);
      weights[id] = id === tileId
        ? existing * (1 - strength) + strength
        : existing * (1 - strength);
    });
    return weights;
  }

  getRaceTileMapDominantTileId(tileWeights = {}, fallbackTileId = 'grass') {
    return Object.entries(tileWeights || {})
      .sort((a, b) => {
        const delta = Number(b[1] || 0) - Number(a[1] || 0);
        if (Math.abs(delta) > 0.0005) return delta;
        if (a[0] === fallbackTileId) return -1;
        if (b[0] === fallbackTileId) return 1;
        return a[0].localeCompare(b[0]);
      })[0]?.[0] || fallbackTileId;
  }

  getRaceWeightedGroundTilePalette(tileWeights = {}, fallbackTileId = 'grass') {
    const entries = Object.entries(tileWeights || {}).filter(([, weight]) => Number(weight) > 0.0005);
    if (!entries.length) return this.getRaceGroundTilePalette(fallbackTileId);
    if (entries.length === 1 && Number(entries[0][1]) > 0.999) return this.getRaceGroundTilePalette(entries[0][0] || fallbackTileId);
    const cacheKey = `${fallbackTileId}|${entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, weight]) => `${id}:${Math.round(Number(weight || 0) * 1000)}`)
      .join(',')}`;
    if (!this.raceGroundPaletteCache) this.raceGroundPaletteCache = new Map();
    const cached = this.raceGroundPaletteCache.get(cacheKey);
    if (cached) return cached;
    const parse = (hex) => {
      const clean = String(hex || '#000000').replace('#', '');
      return [
        parseInt(clean.slice(0, 2), 16) || 0,
        parseInt(clean.slice(2, 4), 16) || 0,
        parseInt(clean.slice(4, 6), 16) || 0
      ];
    };
    const mix = (key) => {
      let total = 0;
      const rgb = [0, 0, 0];
      entries.forEach(([tileId, weight]) => {
        const numeric = Math.max(0, Number(weight) || 0);
        const basePalette = this.getRaceGroundTilePalette(tileId);
        const baseCacheKey = `${tileId}:${key}`;
        let color = this.raceGroundBasePaletteRgbCache?.get?.(baseCacheKey);
        if (!color) {
          color = parse(basePalette.groundA && key === 'groundA' ? basePalette.groundA : basePalette[key]);
          this.raceGroundBasePaletteRgbCache?.set?.(baseCacheKey, color);
        }
        total += numeric;
        rgb[0] += color[0] * numeric;
        rgb[1] += color[1] * numeric;
        rgb[2] += color[2] * numeric;
      });
      const safeTotal = Math.max(0.0001, total);
      return `rgb(${Math.round(rgb[0] / safeTotal)}, ${Math.round(rgb[1] / safeTotal)}, ${Math.round(rgb[2] / safeTotal)})`;
    };
    const dominant = this.getRaceTileMapDominantTileId(Object.fromEntries(entries), fallbackTileId);
    const dominantPalette = this.getRaceGroundTilePalette(dominant);
    const palette = {
      groundA: mix('groundA'),
      groundB: mix('groundB'),
      line: dominantPalette.line,
      label: dominantPalette.label
    };
    if (this.raceGroundPaletteCache.size > 256) this.raceGroundPaletteCache.clear();
    this.raceGroundPaletteCache.set(cacheKey, palette);
    return palette;
  }

  getRaceGroundBrushRadiusNormalized() {
    return clamp(Number(this.raceElevationBrushSize) || 0.085, 0.04, 0.22);
  }

  getRaceGroundBrushRadiusWorld(bounds = this.raceMapBounds) {
    const rawPoints = this.getRaceRawMapPoints();
    if (!bounds || !rawPoints.length) return 12;
    const { minX, minY, maxX, maxY } = this.getRaceMapTransform(bounds, rawPoints);
    return Math.max(4, this.getRaceGroundBrushRadiusNormalized() * Math.max(1, maxX - minX, maxY - minY));
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

  setSelectedSegmentRoadWidth(widthM = RACE_LANE_WIDTH_M) {
    const segment = this.selectedSegment;
    if (!segment) return false;
    const width = clamp(Number(widthM) || RACE_LANE_WIDTH_M, 2.2, 24);
    segment.roadWidthM = Math.round(width * 10) / 10;
    this.status = `Road width: ${segment.roadWidthM} m`;
    return true;
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
    const worldX = Number(worldPoint.x || 0);
    const worldZ = Number(worldPoint.z ?? worldPoint.y ?? 0);
    const tileCell = this.getRaceTileMapCellAtWorldPoint({ x: worldX, z: worldZ });
    if (tileCell?.explicit) return tileCell;
    const patches = this.ensureRaceRoadAuthoringData()?.groundTiles || [];
    for (let index = patches.length - 1; index >= 0; index -= 1) {
      const patch = patches[index];
      if (!Number.isFinite(Number(patch.worldX)) || !Number.isFinite(Number(patch.worldZ))) continue;
      const radius = Math.max(1, Number(patch.radiusWorld) || 12);
      if (Math.hypot(worldX - Number(patch.worldX), worldZ - Number(patch.worldZ)) <= radius) return patch;
    }
    const rawPoints = this.getRaceRawMapPoints();
    if (!rawPoints.length) return null;
    const minX = Math.min(...rawPoints.map((point) => Number(point.x || 0)));
    const maxX = Math.max(...rawPoints.map((point) => Number(point.x || 0)));
    const minY = Math.min(...rawPoints.map((point) => Number(point.y || 0)));
    const maxY = Math.max(...rawPoints.map((point) => Number(point.y || 0)));
    const nx = clamp((Number(worldPoint.x || 0) - minX) / Math.max(1, maxX - minX), 0, 1);
    const ny = clamp((Number(worldPoint.z ?? worldPoint.y ?? 0) - minY) / Math.max(1, maxY - minY), 0, 1);
    return this.getRaceGroundPaintAt(nx, ny) || tileCell;
  }

  getRaceRawGroundElevationAtWorldPoint(worldPoint = null, fallbackElevation = 0) {
    if (!worldPoint) return this.clampRaceElevation(fallbackElevation);
    const worldX = Number(worldPoint.x || 0);
    const worldZ = Number(worldPoint.z ?? worldPoint.y ?? 0);
    const tileMap = this.ensureRaceTileMap();
    const coords = this.getRaceTileMapCellCoords({ x: worldX, z: worldZ }, tileMap);
    const cacheKey = `raw:${Number(tileMap?.revision) || 0}:${coords.cellX},${coords.cellY}:${Math.round((Number(fallbackElevation) || 0) * 1000)}`;
    const cached = this.raceTerrainElevationCache?.get?.(cacheKey);
    if (Number.isFinite(cached)) return cached;
    const tileCell = this.getRaceTileMapCell(coords.cellX, coords.cellY, tileMap);
    if (tileCell?.explicit && Number.isFinite(Number(tileCell.elevation))) {
      const elevation = this.clampRaceElevation(tileCell.elevation);
      this.raceTerrainElevationCache?.set?.(cacheKey, elevation);
      return elevation;
    }
    const worldPatches = this.ensureRaceRoadAuthoringData()?.groundTiles || [];
    let worldWeightedElevation = 0;
    let worldTotalWeight = 0;
    worldPatches.forEach((patch) => {
      const elevation = Number(patch.elevation);
      if (!Number.isFinite(elevation) || !Number.isFinite(Number(patch.worldX)) || !Number.isFinite(Number(patch.worldZ))) return;
      const radius = Math.max(1, Number(patch.radiusWorld) || 12);
      const distance = Math.hypot(worldX - Number(patch.worldX), worldZ - Number(patch.worldZ));
      const influence = clamp(1 - distance / (radius * 1.85), 0, 1);
      if (influence <= 0) return;
      const smooth = influence * influence * (3 - 2 * influence);
      worldWeightedElevation += elevation * smooth;
      worldTotalWeight += smooth;
    });
    if (worldTotalWeight > 0) {
      const blend = clamp(worldTotalWeight, 0, 1);
      const elevation = this.clampRaceElevation((worldWeightedElevation / worldTotalWeight) * blend + (Number(fallbackElevation) || 0) * (1 - blend));
      if ((this.raceTerrainElevationCache?.size || 0) > 2048) this.raceTerrainElevationCache.clear();
      this.raceTerrainElevationCache?.set?.(cacheKey, elevation);
      return elevation;
    }
    const rawPoints = this.getRaceRawMapPoints();
    const patches = this.ensureRaceRoadAuthoringData()?.groundTiles || [];
    if (!rawPoints.length || !patches.length) return this.clampRaceElevation(fallbackElevation);
    const minX = Math.min(...rawPoints.map((point) => Number(point.x || 0)));
    const maxX = Math.max(...rawPoints.map((point) => Number(point.x || 0)));
    const minY = Math.min(...rawPoints.map((point) => Number(point.y || 0)));
    const maxY = Math.max(...rawPoints.map((point) => Number(point.y || 0)));
    const nx = clamp((Number(worldPoint.x || 0) - minX) / Math.max(1, maxX - minX), 0, 1);
    const ny = clamp((Number(worldPoint.z ?? worldPoint.y ?? 0) - minY) / Math.max(1, maxY - minY), 0, 1);
    let weightedElevation = 0;
    let totalWeight = 0;
    patches.forEach((patch) => {
      const elevation = Number(patch.elevation);
      if (!Number.isFinite(elevation)) return;
      const radius = Math.max(0.012, Number(patch.radius) || 0.085);
      const distance = Math.hypot(nx - Number(patch.x || 0), ny - Number(patch.y || 0));
      const influence = clamp(1 - distance / (radius * 1.85), 0, 1);
      if (influence <= 0) return;
      const smooth = influence * influence * (3 - 2 * influence);
      weightedElevation += elevation * smooth;
      totalWeight += smooth;
    });
    if (totalWeight <= 0) return this.clampRaceElevation(fallbackElevation);
    const blend = clamp(totalWeight, 0, 1);
    return this.clampRaceElevation((weightedElevation / totalWeight) * blend + (Number(fallbackElevation) || 0) * (1 - blend));
  }

  getRaceSmoothedGroundElevationAtWorldPoint(worldPoint = null, fallbackElevation = 0) {
    if (!worldPoint) return this.clampRaceElevation(fallbackElevation);
    const tileMap = this.ensureRaceTileMap();
    const cellSize = Math.max(1, Number(tileMap?.cellSizeM) || RACE_TILE_MAP_CELL_SIZE_M);
    const worldX = Number(worldPoint.x || 0);
    const worldZ = Number(worldPoint.z ?? worldPoint.y ?? 0);
    const gx = worldX / cellSize - 0.5;
    const gz = worldZ / cellSize - 0.5;
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const tx = clamp(gx - x0, 0, 1);
    const tz = clamp(gz - z0, 0, 1);
    const cacheKey = `smooth:${Number(tileMap?.revision) || 0}:${Math.round(worldX)},${Math.round(worldZ)}:${Math.round((Number(fallbackElevation) || 0) * 1000)}`;
    const cached = this.raceTerrainElevationCache?.get?.(cacheKey);
    if (Number.isFinite(cached)) return cached;
    const sampleCell = (cellX, cellY) => {
      const point = {
        x: (cellX + 0.5) * cellSize,
        z: (cellY + 0.5) * cellSize
      };
      return this.getRaceRawGroundElevationAtWorldPoint(point, fallbackElevation);
    };
    const e00 = sampleCell(x0, z0);
    const e10 = sampleCell(x0 + 1, z0);
    const e01 = sampleCell(x0, z0 + 1);
    const e11 = sampleCell(x0 + 1, z0 + 1);
    const top = e00 + (e10 - e00) * tx;
    const bottom = e01 + (e11 - e01) * tx;
    const elevation = this.clampRaceElevation(top + (bottom - top) * tz);
    if ((this.raceTerrainElevationCache?.size || 0) > 8192) this.raceTerrainElevationCache.clear();
    this.raceTerrainElevationCache?.set?.(cacheKey, elevation);
    return elevation;
  }

  getRaceGroundElevationAtWorldPoint(worldPoint = null, fallbackElevation = 0) {
    return this.getRaceSmoothedGroundElevationAtWorldPoint(worldPoint, fallbackElevation);
  }

  getRaceRoadDeckElevationAtDistance(distance = 0, {
    samples = null,
    routeLength = null,
    runtimeType = this.getActiveRaceRuntimeType(),
    allowVisualExtension = false,
    includeShoulders = true,
    sampleCount = 7
  } = {}) {
    return this.getRaceRoadSurfaceProfileAtDistance(distance, {
      samples,
      routeLength,
      runtimeType,
      allowVisualExtension,
      includeShoulders,
      sampleCount
    }).elevation;
  }

  getRaceRoadbedProfile({
    samples = null,
    routeLength = null,
    runtimeType = this.getActiveRaceRuntimeType(),
    allowVisualExtension = false,
    step = 2.5
  } = {}) {
    const tileMap = this.ensureRaceTileMap();
    const effectiveStep = clamp(Number(step) || 2.5, 1.25, 5);
    const sourceSamples = Array.isArray(samples) ? samples : null;
    const effectiveRouteLength = Math.max(
      1,
      Number(routeLength || sourceSamples?.at?.(-1)?.distance || this.getRaceRouteLength()) || 1
    );
    const cacheKey = sourceSamples
      ? null
      : [
        this.getRaceSurfaceGeometryRevisionKey({
          step: effectiveStep,
          runtimeType,
          allowVisualExtension,
          routeLength: effectiveRouteLength
        }),
        runtimeType,
        allowVisualExtension ? 1 : 0,
        Math.round(effectiveRouteLength * 10)
      ].join(':');
    const cached = cacheKey ? this.raceRoadbedProfileCache?.get?.(cacheKey) : null;
    if (cached) return cached;
    const profile = buildRaceRoadbedProfile({
      samples,
      routeLength,
      runtimeType,
      allowVisualExtension,
      step: effectiveStep,
      elevationScaleM: RACE_THREE_ELEVATION_M,
      adapter: {
        getRouteLength: () => this.getRaceRouteLength(),
        getWorldPoseAtDistance: (distance, options) => this.getRaceWorldPoseAtDistance(distance, options),
        getRightVector: (yaw) => this.getRaceRightVector(yaw),
        getRoadHalfWidth: (segment) => this.getRaceRoadHalfWidthWorld(segment),
        getMarginWidth: (segment) => this.getRaceVisibleMarginWidthWorld(segment),
        getShoulderWidth: (segment) => this.getRaceShoulderWidthWorld(segment),
        getBlendWidth: (segment) => this.getRaceRoadTerrainBlendWidthWorld(segment),
        sampleTerrain: (point, fallback) => this.getRaceGroundElevationAtWorldPoint(point, fallback),
        clampElevation: (value) => this.clampRaceElevation(value)
      }
    });
    if (cacheKey) {
      if ((this.raceRoadbedProfileCache?.size || 0) > 8) this.raceRoadbedProfileCache.clear();
      this.raceRoadbedProfileCache?.set?.(cacheKey, profile);
    }
    return profile;
  }

  sampleRaceRoadbedProfileAtDistance(distance = 0, profile = this.getRaceRoadbedProfile()) {
    return sampleRaceRoadbedProfileAtDistanceModule(distance, profile, {
      clampElevation: (value) => this.clampRaceElevation(value),
      getSampleSpanAtDistance: (profileSamples, target) => this.getRaceSampleSpanAtDistance(profileSamples, target)
    });
  }

  getRaceRoadCorridorSampleAtDistance(distance = 0, {
    samples = null,
    routeLength = null,
    runtimeType = this.getActiveRaceRuntimeType(),
    allowVisualExtension = false
  } = {}) {
    const cacheKey = Array.isArray(samples)
      ? null
      : [
        this.getRaceSurfaceGeometryRevisionKey({
          runtimeType,
          allowVisualExtension,
          routeLength
        }),
        runtimeType,
        allowVisualExtension ? 1 : 0,
        Math.round((Number(distance) || 0) * 4)
    ].join(':');
    const cached = cacheKey ? this.raceRoadCorridorCache?.get?.(cacheKey) : null;
    if (cached) return cached;
    const sample = this.getRaceSurfaceModel().sampleDeckAtDistance(distance, {
      samples,
      routeLength,
      runtimeType,
      allowVisualExtension
    });
    if (cacheKey) {
      if ((this.raceRoadCorridorCache?.size || 0) > 4096) this.raceRoadCorridorCache.clear();
      this.raceRoadCorridorCache?.set?.(cacheKey, sample);
    }
    return sample;
  }

  getRaceRoadSurfaceProfileAtDistance(distance = 0, {
    samples = null,
    routeLength = null,
    runtimeType = this.getActiveRaceRuntimeType(),
    allowVisualExtension = false,
    includeShoulders = true,
    sampleCount = 7
  } = {}) {
    const cacheKey = [
      this.getRaceSurfaceGeometryRevisionKey({ runtimeType, allowVisualExtension, routeLength }),
      runtimeType,
      includeShoulders ? 1 : 0,
      Math.round((Number(distance) || 0) * 4)
    ].join(':');
    const cached = this.raceRoadSurfaceProfileCache?.get?.(cacheKey);
    if (cached) return cached;
    const corridor = this.getRaceRoadCorridorSampleAtDistance(distance, {
      samples,
      routeLength,
      runtimeType,
      allowVisualExtension
    });
    const profile = {
      elevation: corridor.elevation,
      grade: corridor.grade,
      routeElevation: corridor.routeElevation,
      terrainElevation: corridor.terrainElevation,
      roadHalfWidth: corridor.roadHalfWidth,
      stampedHalfWidth: includeShoulders ? corridor.stampedHalfWidth : corridor.roadHalfWidth,
      blendWidth: corridor.blendWidth
    };
    if ((this.raceRoadSurfaceProfileCache?.size || 0) > 4096) this.raceRoadSurfaceProfileCache.clear();
    this.raceRoadSurfaceProfileCache?.set?.(cacheKey, profile);
    this.raceRoadDeckElevationCache?.set?.(cacheKey, profile.elevation);
    return profile;
  }

  getRaceSurfaceBakeKey({
    routeLength = null,
    runtimeType = this.getActiveRaceRuntimeType(),
    allowVisualExtension = false,
    step = 2.5
  } = {}) {
    const routeEnd = Math.max(1, Number(routeLength || this.getRaceRouteLength()) || 1);
    return buildRaceSurfaceBakeKey({
      raceId: this.selectedRace?.id || 'race',
      surfaceGeometryRevision: this.getRaceSurfaceGeometryRevisionKey({
        step,
        runtimeType,
        allowVisualExtension,
        routeLength: routeEnd
      }),
      routeLength: routeEnd,
      runtimeType,
      allowVisualExtension,
      step
    });
  }

  getRaceTrackCorridorMetrics(sample = {}, segment = sample?.segment || null) {
    return this.getRaceSurfaceModel().getCorridorMetrics(sample, segment);
  }

  getRaceCompositedSurfaceAtWorldPoint(worldPoint = null, fallbackElevation = 0, {
    runtimeType = this.getActiveRaceRuntimeType(),
    allowVisualExtension = false,
    routeLength = null
  } = {}) {
    if (!worldPoint) {
      const rawElevation = this.getRaceGroundElevationAtWorldPoint(worldPoint, fallbackElevation);
      return {
        elevation: rawElevation,
        rawElevation,
        roadElevation: this.clampRaceElevation(fallbackElevation),
        region: 'terrain',
        projection: null,
        blend: 1
      };
    }
    return this.getRaceSurfaceModel().sampleWorld(worldPoint || { x: 0, z: 0 }, fallbackElevation, {
      runtimeType,
      allowVisualExtension,
      routeLength,
      fallbackElevation
    });
  }

  createRaceSurfaceSectionFromSample(sample = {}, {
    distance = Number(sample.distance || 0)
  } = {}) {
    return this.getRaceSurfaceModel().getCrossSectionAtDistance(distance, { deckSample: sample });
  }

  getRaceSurfaceBake({
    routeLength = null,
    runtimeType = this.getActiveRaceRuntimeType(),
    allowVisualExtension = false,
    step = 2.5
  } = {}) {
    const routeEnd = Math.max(1, Number(routeLength || this.getRaceRouteLength()) || 1);
    const effectiveStep = clamp(Number(step) || 2.5, 1.25, 5);
    const key = this.getRaceSurfaceBakeKey({
      routeLength: routeEnd,
      runtimeType,
      allowVisualExtension,
      step: effectiveStep
    });
    if (this.raceSurfaceBakeCache?.key === key) return this.raceSurfaceBakeCache;
    const bake = buildRaceSurfaceBake({
      routeLength: routeEnd,
      runtimeType,
      allowVisualExtension,
      step: effectiveStep,
      adapter: {
        getRoadbedProfile: (options) => this.getRaceRoadbedProfile(options),
        createSurfaceSectionFromSample: (sample, options) => this.createRaceSurfaceSectionFromSample(sample, options)
      }
    });
    this.raceSurfaceBakeCache = {
      key,
      ...bake
    };
    return this.raceSurfaceBakeCache;
  }

  getRaceSurfaceSectionAtDistance(distance = 0, {
    routeLength = null,
    runtimeType = this.getActiveRaceRuntimeType(),
    allowVisualExtension = false
  } = {}) {
    return this.getRaceSurfaceModel().getCrossSectionAtDistance(distance, {
      routeLength,
      runtimeType,
      allowVisualExtension
    });
  }

  getRaceRoadDeckElevationForProjection(projection = null, fallbackElevation = 0) {
    if (!projection || !Number.isFinite(Number(projection.distance))) return this.clampRaceElevation(fallbackElevation);
    return this.getRaceSurfaceModel().sampleDeckAtDistance(Number(projection.distance), {
      runtimeType: this.getActiveRaceRuntimeType()
    }).elevation;
  }

  getRaceStitchedTerrainElevationAtWorldPoint(worldPoint = null, fallbackElevation = 0) {
    if (worldPoint?.roadDeckElevation === true && Number.isFinite(Number(worldPoint.elevation))) {
      return this.clampRaceElevation(worldPoint.elevation);
    }
    return this.getRaceCompositedSurfaceAtWorldPoint(worldPoint, fallbackElevation).elevation;
  }

  getRaceCameraSafeTerrainElevation(camera = {}, fallbackElevation = 0) {
    const cameraX = Number(camera?.x || 0);
    const cameraZ = Number(camera?.z || 0);
    const yaw = Number(camera?.yaw || 0);
    const forward = this.getRaceForwardVector(yaw);
    const right = this.getRaceRightVector(yaw);
    const sampleRadius = Math.max(2.5, this.getRaceRoadHalfWidthWorld() * 0.35);
    const samples = [
      { x: cameraX, z: cameraZ },
      { x: cameraX + forward.x * sampleRadius, z: cameraZ + forward.z * sampleRadius },
      { x: cameraX - forward.x * sampleRadius * 0.65, z: cameraZ - forward.z * sampleRadius * 0.65 },
      { x: cameraX + right.x * sampleRadius, z: cameraZ + right.z * sampleRadius },
      { x: cameraX - right.x * sampleRadius, z: cameraZ - right.z * sampleRadius }
    ];
    return samples.reduce((highest, point) => Math.max(
      highest,
      this.getRaceStitchedTerrainElevationAtWorldPoint(point, fallbackElevation),
      this.getRaceGroundElevationAtWorldPoint(point, fallbackElevation)
    ), this.clampRaceElevation(fallbackElevation));
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
    const world = this.screenToRaceMapWorldPoint(point.x, point.y, bounds);
    if (!world) return false;
    const tileId = this.getSelectedGroundTileId();
    const tileMap = this.ensureRaceTileMap(road);
    const center = this.getRaceTileMapCellCoords({ x: world.x, z: world.y }, tileMap);
    const tileLabel = this.getRaceTileDefinition(tileId)?.label || this.getRaceGroundTilePalette(tileId).label;
    const offsets = this.getRaceTileMapBrushOffsets();
    const touchedKeys = [];
    const brushStrength = Number.isFinite(Number(this.raceGroundBrushStrength)) ? Number(this.raceGroundBrushStrength) : 1;
    offsets.forEach((offset) => {
      const current = this.getRaceTileMapCell(center.cellX + offset.x, center.cellY + offset.y, tileMap);
      const opacity = clamp(brushStrength * (Number(offset.weight) || 1), 0, 1);
      if (brushStrength <= 0) {
        const defaultTileId = tileMap.defaultTileId || 'grass';
        this.setRaceTileMapCell(center.cellX + offset.x, center.cellY + offset.y, {
          tileId: defaultTileId,
          tileWeights: { [defaultTileId]: 1 },
          source: 'tile-editor',
          tileLabel: this.getRaceTileDefinition(defaultTileId)?.label || this.getRaceGroundTilePalette(defaultTileId).label,
          elevation: current?.elevation || 0
        }, { invalidate: false });
        touchedKeys.push(this.getRaceTileMapCellKey(center.cellX + offset.x, center.cellY + offset.y));
        return;
      }
      const tileWeights = this.getRaceBlendedTileWeights(current?.tileWeights, tileId, opacity);
      const dominantTileId = this.getRaceTileMapDominantTileId(tileWeights, tileId);
      this.setRaceTileMapCell(center.cellX + offset.x, center.cellY + offset.y, {
        tileId: dominantTileId,
        tileWeights,
        source: 'tile-editor',
        tileLabel,
        elevation: current?.elevation || 0
      }, { invalidate: false });
      touchedKeys.push(this.getRaceTileMapCellKey(center.cellX + offset.x, center.cellY + offset.y));
    });
    this.invalidateRaceTerrainCaches(tileMap, touchedKeys);
    const tile = this.getRaceGroundTileChoices().find((entry) => entry.id === tileId);
    this.status = `Painted ${offsets.length} tile${offsets.length === 1 ? '' : 's'}: ${tile?.label || tileId}`;
    return true;
  }

  paintRaceArtTileAtPoint(point = {}) {
    const road = this.ensureRaceRoadAuthoringData();
    if (!road || !this.raceMapBounds) return false;
    const artRef = String(this.selectedRaceGroundBoxArtRef || '').trim();
    if (!artRef) {
      this.status = 'Pick a ground tile first';
      return false;
    }
    const bounds = this.raceMapBounds;
    if (
      point.x < bounds.x
      || point.x > bounds.x + bounds.w
      || point.y < bounds.y
      || point.y > bounds.y + bounds.h
    ) return false;
    const world = this.screenToRaceMapWorldPoint(point.x, point.y, bounds);
    if (!world) return false;
    const tileMap = this.ensureRaceTileMap(road);
    const center = this.getRaceTileMapCellCoords({ x: world.x, z: world.y }, tileMap);
    const offsets = this.getRaceTileMapBrushOffsets();
    const touchedKeys = [];
    offsets.forEach((offset) => {
      const cellX = center.cellX + offset.x;
      const cellY = center.cellY + offset.y;
      const current = this.getRaceTileMapCell(cellX, cellY, tileMap);
      this.setRaceTileMapCell(cellX, cellY, {
        tileId: current?.tileId || tileMap.defaultTileId || 'grass',
        tileWeights: current?.tileWeights || { [current?.tileId || tileMap.defaultTileId || 'grass']: 1 },
        artRef,
        source: 'art-tile',
        tileLabel: artRef,
        elevation: current?.elevation || 0
      }, { invalidate: false });
      touchedKeys.push(this.getRaceTileMapCellKey(cellX, cellY));
    });
    this.invalidateRaceTerrainCaches(tileMap, touchedKeys);
    this.racePortraitMode = 'sprites';
    this.activeRootId = 'sprites';
    this.raceSpritePaintKind = 'tile';
    this.activeAction = 'paint-tile';
    this.status = `Painted ${offsets.length} grid tile${offsets.length === 1 ? '' : 's'}: ${artRef}`;
    return true;
  }

  eraseRaceArtTileAtPoint(point = {}) {
    const road = this.ensureRaceRoadAuthoringData();
    if (!road || !this.raceMapBounds) return false;
    const bounds = this.raceMapBounds;
    if (
      point.x < bounds.x
      || point.x > bounds.x + bounds.w
      || point.y < bounds.y
      || point.y > bounds.y + bounds.h
    ) return false;
    const world = this.screenToRaceMapWorldPoint(point.x, point.y, bounds);
    if (!world) return false;
    const tileMap = this.ensureRaceTileMap(road);
    const center = this.getRaceTileMapCellCoords({ x: world.x, z: world.y }, tileMap);
    const offsets = this.getRaceTileMapBrushOffsets();
    const touchedKeys = [];
    offsets.forEach((offset) => {
      const cellX = center.cellX + offset.x;
      const cellY = center.cellY + offset.y;
      const current = this.getRaceTileMapCell(cellX, cellY, tileMap);
      this.setRaceTileMapCell(cellX, cellY, {
        tileId: current?.tileId || tileMap.defaultTileId || 'grass',
        tileWeights: current?.tileWeights || { [current?.tileId || tileMap.defaultTileId || 'grass']: 1 },
        clearArtRef: true,
        source: current?.source || 'tile-editor',
        elevation: current?.elevation || 0
      }, { invalidate: false });
      touchedKeys.push(this.getRaceTileMapCellKey(cellX, cellY));
    });
    this.invalidateRaceTerrainCaches(tileMap, touchedKeys);
    this.racePortraitMode = 'sprites';
    this.activeRootId = 'sprites';
    this.raceSpritePaintKind = 'tile';
    this.activeAction = 'erase-tile';
    this.status = `Erased ${offsets.length} grid tile${offsets.length === 1 ? '' : 's'}`;
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
    const world = this.screenToRaceMapWorldPoint(point.x, point.y, bounds);
    if (!world) return false;
    const tileId = this.getSelectedGroundTileId();
    const tileMap = this.ensureRaceTileMap(road);
    const center = this.getRaceTileMapCellCoords({ x: world.x, z: world.y }, tileMap);
    const rawAmount = Number(this.raceElevationBrushAmount);
    const step = Math.sign(Number(direction) || 1) * (Number.isFinite(rawAmount) ? Math.max(0, rawAmount) : RACE_TILE_MAP_ELEVATION_STEP);
    const offsets = this.getRaceTileMapBrushOffsets();
    let averageElevation = 0;
    const touchedKeys = [];
    const brushStrength = Number.isFinite(Number(this.raceGroundBrushStrength)) ? Number(this.raceGroundBrushStrength) : 1;
    offsets.forEach((offset) => {
      const current = this.getRaceTileMapCell(center.cellX + offset.x, center.cellY + offset.y, tileMap);
      const opacity = clamp(brushStrength * (Number(offset.weight) || 1), 0, 1);
      const nextElevation = step <= 0
        ? 0
        : clamp(
        Number(current?.elevation || 0) + step * opacity,
        this.getRaceTileMapElevationBounds(tileMap).minElevation,
        this.getRaceTileMapElevationBounds(tileMap).maxElevation
      );
      averageElevation += nextElevation;
      this.setRaceTileMapCell(center.cellX + offset.x, center.cellY + offset.y, {
        tileId: current?.tileId || tileId,
        tileWeights: current?.tileWeights || { [current?.tileId || tileId]: 1 },
        source: 'height-brush',
        tileLabel: current?.tileLabel || this.getRaceTileDefinition(current?.tileId || tileId)?.label || this.getRaceGroundTilePalette(current?.tileId || tileId).label,
        elevation: nextElevation
      }, { invalidate: false });
      touchedKeys.push(this.getRaceTileMapCellKey(center.cellX + offset.x, center.cellY + offset.y));
    });
    this.invalidateRaceTerrainCaches(tileMap, touchedKeys);
    this.status = `${step >= 0 ? 'Raised' : 'Lowered'} ${offsets.length} tile${offsets.length === 1 ? '' : 's'} to ${(averageElevation / Math.max(1, offsets.length)).toFixed(2)}`;
    return true;
  }

  cycleRacePortraitMode() {
    const modes = ['race', 'ground'];
    const index = Math.max(0, modes.indexOf(this.racePortraitMode));
    this.setRacePortraitMode(modes[(index + 1) % modes.length]);
  }

  setRacePortraitMode(mode = 'race') {
    const resolved = ['race', 'ground', 'sprites'].includes(mode) ? mode : 'race';
    this.racePortraitMode = resolved;
    this.racePortraitHotMenu = null;
    if (resolved === 'ground') {
      this.activeAction = 'paint-ground';
      this.activeRootId = 'ground';
      this.status = `Ground mode: paint ${this.getRaceGroundTilePalette(this.getSelectedGroundTileId()).label}`;
    } else if (resolved === 'sprites') {
      this.activeAction = this.getRaceSpritePaintActionId();
      this.activeRootId = 'sprites';
      this.status = this.getRaceSpritePaintStatus();
    } else {
      this.activeAction = 'move-node';
      this.activeRootId = 'track';
      this.status = 'Race mode: drag nodes or select edges';
    }
  }

  getRaceSpritePaintKind() {
    const kind = String(this.raceSpritePaintKind || 'sprite');
    return ['sprite', 'decal', 'tile'].includes(kind) ? kind : 'sprite';
  }

  getRaceSpritePaintActionId(kind = this.getRaceSpritePaintKind()) {
    if (kind === 'tile') return 'paint-tile';
    if (kind === 'decal') return 'paint-decal';
    return 'paint-sprite';
  }

  getRaceSpriteEraseActionId(kind = this.getRaceSpritePaintKind()) {
    if (kind === 'tile') return 'erase-tile';
    if (kind === 'decal') return 'erase-decal';
    return 'erase-sprite';
  }

  isRaceSpritePaintReady(kind = this.getRaceSpritePaintKind()) {
    if (kind === 'tile') return Boolean(String(this.selectedRaceGroundBoxArtRef || '').trim());
    if (kind === 'decal') return Boolean(String(this.selectedRaceDecalArtRef || '').trim());
    return Boolean(this.selectedSceneryDefinition);
  }

  getRaceTilePaintShape() {
    return this.raceGroundBrushShape === 'round' ? 'oval' : 'rectangle';
  }

  getRaceTilePaintSizeM() {
    return Math.max(5, (Math.round(Number(this.raceGroundBrushCells) || 1) || 1) * RACE_TILE_MAP_CELL_SIZE_M);
  }

  getRaceTilePaintSpacingM() {
    return Math.max(2.5, this.getRaceTilePaintSizeM() * 0.42);
  }

  getRaceSpritePaintStatus(kind = this.getRaceSpritePaintKind()) {
    if (kind === 'tile') return this.selectedRaceGroundBoxArtRef ? `Tile mode: paint ${this.selectedRaceGroundBoxArtRef}` : 'Tile mode: pick a ground tile first';
    if (kind === 'decal') return this.selectedRaceDecalArtRef ? `Decal mode: paint ${this.selectedRaceDecalArtRef}` : 'Decal mode: pick a decal first';
    return this.selectedSceneryDefinition ? `Sprite mode: paint ${this.selectedSceneryDefinition.label}` : 'Sprite mode: add a sprite from Settings first';
  }

  setRaceDrawNodeMode() {
    this.racePortraitMode = 'race';
    this.activeAction = 'draw-road';
    this.activeRootId = 'track';
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
    if (this.racePortraitMode === 'sprites') {
      return { id: 'paint-sprite', label: 'Paint', onClick: () => this.handleMenuAction('paint-sprite') };
    }
    return {
      id: 'track-context',
      label: 'Track',
      onClick: () => {
        this.setRacePortraitMode('race');
        this.mobileRootOpen = false;
      }
    };
  }

  cycleRaceElevationBrushSize() {
    const sizes = [0.06, 0.1, 0.16, 0.22];
    const currentIndex = sizes.findIndex((size) => Math.abs(size - Number(this.raceElevationBrushSize || 0)) < 0.01);
    this.raceElevationBrushSize = sizes[(currentIndex + 1 + sizes.length) % sizes.length];
    this.racePortraitMode = 'ground';
    this.activeAction = 'paint-elevation';
    this.activeRootId = 'ground';
    this.status = `Elevation brush ${Math.round(this.raceElevationBrushSize * 100)}%`;
  }

  setRaceElevationBrushDirection(direction = 1) {
    this.raceElevationBrushDirection = Math.sign(Number(direction) || 1);
    this.racePortraitMode = 'ground';
    this.activeAction = 'paint-elevation';
    this.activeRootId = 'ground';
    this.status = this.raceElevationBrushDirection > 0 ? 'Ground mode: raise terrain' : 'Ground mode: lower terrain';
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
    this.racePortraitHotMenu = null;
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
    this.racePortraitHotMenu = null;
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
    this.racePortraitHotMenu = null;
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
    this.racePortraitHotMenu = null;
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
      segment.elevation = Math.round(this.clampRaceElevation(
        -((screenY - (this.raceNodeDrag?.startY ?? screenY)) / Math.max(90, this.raceMapBounds.h * 0.28))
          + (this.raceNodeDrag?.elevation ?? (Number(segment.elevation) || 0))
      ) * 100) / 100;
    } else {
      segment.elevation = this.clampRaceElevation(node.elevation ?? segment.elevation);
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
    segment.elevation = this.clampRaceElevation(segment.elevation);
    road.segments.push(segment);
    nodes.push({
      x: Math.round(Number(worldPoint.x || 0)),
      y: Math.round(Number(worldPoint.y || 0)),
      elevation: segment.elevation
    });
    road.nodes = nodes;
    this.selectedSegmentIndex = road.segments.length - 1;
    this.raceSelectionType = 'node';
    this.racePortraitHotMenu = null;
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
    this.racePortraitHotMenu = null;
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
        elevation: this.clampRaceElevation(segment.elevation),
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
      elevation: this.clampRaceElevation(point.elevation)
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
      elevation: this.clampRaceElevation(point.elevation)
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
        elevation: this.clampRaceElevation(node.elevation),
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

  raceMapWorldToScreenPoint(worldPoint = {}, bounds = this.raceMapBounds) {
    if (!bounds) return null;
    const rawPoints = this.getRaceRawMapPoints();
    if (!rawPoints.length) return null;
    const { minX, minY, maxX, maxY, pad, usableW, usableH, scale, panX, panY } = this.getRaceMapTransform(bounds, rawPoints);
    const offsetX = (usableW - (maxX - minX) * scale) / 2;
    const offsetY = (usableH - (maxY - minY) * scale) / 2;
    return {
      screenX: bounds.x + pad + (Number(worldPoint.x || 0) - minX) * scale + offsetX + panX,
      screenY: bounds.y + pad + (Number(worldPoint.y ?? worldPoint.z ?? 0) - minY) * scale + offsetY + panY,
      scale
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
    const dx = clamp(Number(point.x || 0) - center.x, -radius, radius);
    const dy = clamp(Number(point.y || 0) - center.y, -radius, radius);
    this.portraitThumbstick.dx = clamp(dx / radius, -1, 1);
    this.portraitThumbstick.dy = clamp(dy / radius, -1, 1);
    this.portraitThumbstick.panX = this.portraitThumbstick.dx;
    this.portraitThumbstick.panY = this.portraitThumbstick.dy;
  }

  updateRaceMapThumbstickPan(dt = 0) {
    if (!this.raceMapThumbstickDrag || !this.portraitThumbstick?.active) return false;
    const x = clamp(Number(this.portraitThumbstick.panX ?? this.portraitThumbstick.dx) || 0, -1, 1);
    const y = clamp(Number(this.portraitThumbstick.panY ?? this.portraitThumbstick.dy) || 0, -1, 1);
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
    this.racePortraitHotMenu = null;
    this.status = `Selected edge ${this.selectedSegmentIndex + 1}`;
    return true;
  }

  getRaceGeneratedTurnKind(profile = {}, archetype = {}) {
    if (profile.turn) return profile.turn;
    const absCurve = Math.abs(Number(profile.curve) || 0);
    if (absCurve >= 0.82) return 'square';
    if ((archetype.id || '').includes('rally') && absCurve >= 0.58) return Math.random() > 0.55 ? 'junction' : 'angled';
    if (absCurve >= 0.58 && Math.random() > 0.68) return 'angled';
    return null;
  }

  doRaceRouteSegmentsIntersect(a = {}, b = {}, c = {}, d = {}) {
    const orient = (p, q, r) => (
      (Number(q.y || 0) - Number(p.y || 0)) * (Number(r.x || 0) - Number(q.x || 0))
      - (Number(q.x || 0) - Number(p.x || 0)) * (Number(r.y || 0) - Number(q.y || 0))
    );
    const onSegment = (p, q, r) => (
      Math.min(Number(p.x || 0), Number(r.x || 0)) - 0.001 <= Number(q.x || 0)
      && Number(q.x || 0) <= Math.max(Number(p.x || 0), Number(r.x || 0)) + 0.001
      && Math.min(Number(p.y || 0), Number(r.y || 0)) - 0.001 <= Number(q.y || 0)
      && Number(q.y || 0) <= Math.max(Number(p.y || 0), Number(r.y || 0)) + 0.001
    );
    const o1 = orient(a, b, c);
    const o2 = orient(a, b, d);
    const o3 = orient(c, d, a);
    const o4 = orient(c, d, b);
    if (Math.sign(o1) !== Math.sign(o2) && Math.sign(o3) !== Math.sign(o4)) return true;
    return (Math.abs(o1) < 0.001 && onSegment(a, c, b))
      || (Math.abs(o2) < 0.001 && onSegment(a, d, b))
      || (Math.abs(o3) < 0.001 && onSegment(c, a, d))
      || (Math.abs(o4) < 0.001 && onSegment(c, b, d));
  }

  doesRaceRouteEdgeOverlap(nodes = [], start = {}, end = {}) {
    if (nodes.length < 3) return false;
    for (let index = 1; index < nodes.length - 1; index += 1) {
      const a = nodes[index - 1];
      const b = nodes[index];
      if (Math.hypot(Number(a.x || 0) - Number(start.x || 0), Number(a.y || 0) - Number(start.y || 0)) < 1) continue;
      if (Math.hypot(Number(b.x || 0) - Number(start.x || 0), Number(b.y || 0) - Number(start.y || 0)) < 1) continue;
      if (this.doRaceRouteSegmentsIntersect(a, b, start, end)) return true;
    }
    return false;
  }

  doesRaceRouteSelfIntersect(nodes = []) {
    for (let aIndex = 1; aIndex < nodes.length; aIndex += 1) {
      for (let bIndex = aIndex + 2; bIndex < nodes.length; bIndex += 1) {
        if (aIndex === 1 && bIndex === nodes.length - 1) continue;
        if (this.doRaceRouteSegmentsIntersect(nodes[aIndex - 1], nodes[aIndex], nodes[bIndex - 1], nodes[bIndex])) return true;
      }
    }
    return false;
  }

  buildRaceNodesFromSegments(segments = []) {
    const nodes = [{ x: 0, y: 0, elevation: 0, role: 'start', locked: true }];
    let x = 0;
    let y = 0;
    let yaw = 0;
    let elevation = 0;
    segments.forEach((segment, index) => {
      const length = Math.max(40, Number(segment.length) || 100);
      const yawDelta = this.getRaceSegmentYawDelta(segment);
      const targetElevation = this.clampRaceElevation(Number(segment.elevation) || elevation);
      const startX = x;
      const startY = y;
      const straightBias = segment.turn === 'square' || segment.turn === 'junction'
        ? 0.78
        : segment.turn === 'angled'
          ? 0.62
          : 0.5;
      const travelYaw = yaw + yawDelta * (segment.turn ? 0.12 : 0.5);
      x += Math.sin(travelYaw) * length * straightBias;
      y += Math.cos(travelYaw) * length * straightBias;
      elevation += (targetElevation - elevation) * 0.72;
      nodes.push({
        x: Math.round(x),
        y: Math.round(y),
        elevation: Math.round(elevation * 100) / 100
      });
      yaw += yawDelta;
      x += Math.sin(yaw) * length * (1 - straightBias);
      y += Math.cos(yaw) * length * (1 - straightBias);
      elevation = targetElevation;
      const proposed = { x: Math.round(x), y: Math.round(y) };
      if (!segment.turn && this.doesRaceRouteEdgeOverlap(nodes, { x: startX, y: startY }, proposed)) {
        const correction = (index % 2 === 0 ? 1 : -1) * 0.58;
        yaw += correction;
        x = startX + Math.sin(yaw) * length;
        y = startY + Math.cos(yaw) * length;
      }
      nodes[nodes.length - 1].x = Math.round(x);
      nodes[nodes.length - 1].y = Math.round(y);
      nodes[nodes.length - 1].elevation = Math.round(elevation * 100) / 100;
    });
    return nodes;
  }

  simplifyGeneratedRaceSegmentsForCleanRoute(segments = []) {
    return segments.map((segment, index) => ({
      ...segment,
      length: Math.max(120, Math.round(Number(segment.length) || 140)),
      curve: Math.round((((index % 4) - 1.5) * 0.16) * 100) / 100,
      turn: undefined
    })).map((segment) => {
      const next = { ...segment };
      delete next.turn;
      return next;
    });
  }

  restoreRaceMenuAfterGenerate() {
    this.restoreRaceAuthoringMenuState();
    this.selectedSegmentIndex = 0;
  }

  restoreRaceAuthoringMenuState({ reopenMenu = true } = {}) {
    this.racePortraitMode = 'race';
    this.raceSelectionType = 'edge';
    this.racePortraitHotMenu = null;
    this.activeRootId = 'track';
    this.activeAction = null;
    this.openDesktopDropdownRootId = null;
    this.closedDesktopDropdownRootId = null;
    this.desktopDropdown = null;
    if (reopenMenu && (this.activeViewportMode === 'portrait' || this.activeViewportMode === 'landscape-touch')) {
      this.mobileRootOpen = true;
      this.gamepadSubmenuOpen = false;
    } else if (reopenMenu && this.activeViewportMode === 'gamepad') {
      this.mobileRootOpen = false;
      this.gamepadSubmenuOpen = true;
    } else {
      this.mobileRootOpen = false;
      this.gamepadSubmenuOpen = false;
    }
  }

  generateRandomRace() {
    const race = this.selectedRace;
    if (!race) return;
    const baseProfiles = [
      { label: 'Easy right', curve: 0.25, length: 180, severity: 1 },
      { label: 'Medium right', curve: 0.52, length: 145, severity: 2 },
      { label: 'Angled right', curve: 0.72, length: 125, severity: 3, turn: 'angled' },
      { label: 'Hard right', curve: 0.78, length: 115, severity: 3 },
      { label: 'Hairpin right', curve: 1, length: 90, severity: 5, turn: 'square' },
      { label: 'Right junction', curve: 0.92, length: 105, severity: 4, turn: 'junction' },
      { label: 'Easy left', curve: -0.25, length: 180, severity: 1 },
      { label: 'Medium left', curve: -0.52, length: 145, severity: 2 },
      { label: 'Angled left', curve: -0.72, length: 125, severity: 3, turn: 'angled' },
      { label: 'Hard left', curve: -0.78, length: 115, severity: 3 },
      { label: 'Hairpin left', curve: -1, length: 90, severity: 5, turn: 'square' },
      { label: 'Left junction', curve: -0.92, length: 105, severity: 4, turn: 'junction' },
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
        width: 7.6,
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
        width: 7.4,
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
        width: 6.8,
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
        elevation: Math.round(this.clampRaceElevation(elevation) * 100) / 100,
        surface,
        bumpiness: Math.round(clamp(bumpiness, 0, 1) * 100) / 100,
        hazardIds: []
      };
      if (surface === 'snow') segment.snowCondition = Math.random() > 0.48 ? 'packed' : 'slush';
      const turnKind = this.getRaceGeneratedTurnKind(profile, archetype);
      if (turnKind) segment.turn = turnKind;
      const callId = `random-call-${index}`;
      calls.push({
        id: callId,
        at: Math.round(distance + length * 0.42),
        text: `${segment.turn === 'junction' ? 'Junction' : profile.label}${Math.abs(segment.elevation) > 0.18 ? ' over crest' : ''}`,
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
      let generatedNodes = this.buildRaceNodesFromSegments(segments);
      for (let attempt = 0; attempt < 5 && this.doesRaceRouteSelfIntersect(generatedNodes); attempt += 1) {
        const target = segments[Math.min(segments.length - 1, Math.max(1, Math.floor(segments.length * (0.28 + attempt * 0.11))))];
        target.curve = clamp((Number(target.curve || 0) || (attempt % 2 ? -0.35 : 0.35)) + (attempt % 2 ? -0.24 : 0.24), -0.82, 0.82);
        if (!target.turn) target.length = Math.round(Math.max(95, Number(target.length || 120) * 1.14));
        generatedNodes = this.buildRaceNodesFromSegments(segments);
      }
      if (this.doesRaceRouteSelfIntersect(generatedNodes)) {
        const cleanSegments = this.simplifyGeneratedRaceSegmentsForCleanRoute(segments);
        segments.splice(0, segments.length, ...cleanSegments);
        generatedNodes = this.buildRaceNodesFromSegments(segments);
      }
      race.road.nodes = generatedNodes;
    }
    race.hazards = hazards;
    race.scenery = [];
    race.codriver = { enabled: true, voice: 'default', calls };
    race.competition = { ...race.competition, mode: 'solo' };
    this.project.selectedRaceId = race.id;
    this.selectedSceneryIndex = 0;
    this.racePathSampleCache?.clear?.();
    this.raceRoadDeckElevationCache?.clear?.();
    this.raceRoadSurfaceProfileCache?.clear?.();
    this.raceRoadCorridorCache?.clear?.();
    this.raceRoadbedProfileCache?.clear?.();
    this.raceSurfaceBakeCache = null;
    this.restoreRaceMenuAfterGenerate();
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
      this.drawRaceSpriteSettingsDialog(ctx, width, height);
      this.drawRaceSettingsDialog(ctx, width, height);
      return;
    }
    this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });
    if (viewportMode.isMobilePortrait) {
      this.drawPortrait(ctx, width, height);
    } else {
      this.drawLandscape(ctx, width, height);
    }
    this.drawRaceSpriteSettingsDialog(ctx, width, height);
    this.drawRaceSettingsDialog(ctx, width, height);
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
    const spec = getEditorMenuSpec(this.editorId);
    if (rootId === 'file' && (this.editorId === 'race' || this.editorId === 'car')) {
      const section = spec?.sections?.file;
      return [...(section?.actions || [])].map((id) => ({
        id,
        label: id === 'exit-main' ? 'Exit to Main Menu' : (spec.actions?.[id]?.label || this.getRaceActionLabel(id)),
        disabled: !this.isActionAvailable(id),
        onSelect: this.isActionAvailable(id) ? () => this.handleMenuAction(id) : null
      }));
    }
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
      })
        .filter((item) => item && item.id && item.label && !item.divider && !item.separator)
        .map((item) => ({
          id: item.id,
          label: item.label,
          tooltip: item.tooltip,
          disabled: Boolean(item.disabled),
          divider: Boolean(item.divider),
          separator: Boolean(item.separator),
          onSelect: item.onClick || item.action || null
        }));
    }
    const section = spec?.sections?.[rootId];
    const actionIds = [...(section?.actions || [])];
    return actionIds.map((id) => ({
      id,
      label: id === 'end-playtest' ? 'End Drive' : (spec.actions?.[id]?.label || this.getRaceActionLabel(id)),
      disabled: !this.isActionAvailable(id),
      onSelect: this.isActionAvailable(id) ? () => this.handleMenuAction(id) : null
    }));
  }

  getRaceActionLabel(id = '') {
    const selectedSpriteLabel = this.selectedSceneryDefinition?.label || this.selectedSceneryArtRef || this.getSelectedSceneryPreset().label;
    const labels = {
      'new-1-lane': 'New 1 Lane',
      'new-2-lane': 'New 2 Lane',
      'new-3-lane': 'New 3 Lane',
      'new-4-lane': 'New 4 Lane',
      'new-5-lane': 'New 5 Lane',
      'new-6-lane': 'New 6 Lane',
      'diagnostic-skidpad': 'Skidpad',
      'diagnostic-acceleration': '0-60',
      'diagnostic-braking': '60-0',
      'diagnostic-quarter-mile': 'Quarter Mile',
      'diagnostic-slalom': 'Slalom',
      'diagnostic-jump': 'Jump Test',
      'diagnostic-ai-laps': 'AI Laps',
      'ghost-compare': 'Ghost Compare',
      'ai-fill-grid': 'Fill AI Grid',
      'ai-count': `AI Racers: ${this.getRaceAiCount()}`,
      'race-sun': `Sun: ${Math.round(this.getRaceSunSettings().angleDeg)}deg`,
      'race-weather': 'Weather',
      'race-tiles': this.getRaceSurfaceArtLabel(),
      'race-margin': this.getRaceMarginLabel(),
      'race-tire-fx': 'Tire FX',
      'race-texture-scale': this.getRaceTextureScaleLabel(),
      'load-wrx': 'Load WRX',
      'load-brz': 'Load BRZ',
      'load-civic': 'Load Civic',
      'boundary-collidable': `Margin ${this.selectedSegment?.boundaryCollidable ? 'Solid' : 'Line'}`,
      'weather-intensity': `Intensity: ${Math.round(this.getRaceWeatherAuthoringIntensity() * 100)}%`,
      'skybox-next': this.getRaceSkyboxLabel(),
      'sprite-select': `Sprite: ${selectedSpriteLabel}`,
      'paint-sprite': 'Paint Sprite',
      'erase-sprite': 'Erase Sprite',
      'race-decal': this.selectedRaceDecalArtRef ? `Decal: ${this.selectedRaceDecalArtRef}` : 'Decal',
      'race-ground-box': this.selectedRaceGroundBoxArtRef ? `Tile: ${this.selectedRaceGroundBoxArtRef}` : 'Tile',
      'paint-decal': 'Paint Decal',
      'erase-decal': 'Erase Decal',
      'paint-tile': 'Paint Tile',
      'erase-tile': 'Erase Tile',
      'sprite-brush-settings': 'Brush',
      'sprite-size': 'Sprite Width',
      'sprite-height': 'Sprite Height',
      'sprite-behavior': 'Collision Behavior',
      'add-sprite': 'Add Sprite',
      'move-sprite': 'Move Sprite',
      'delete-sprite': 'Delete Sprite',
      'edit-shell': this.selectedCar?.art?.shell ? `Shell: ${this.selectedCar.art.shell}` : 'Shell Art',
      'shell-frames': this.getCarShellFrameMenuLabel(),
      'shell-frame-prev': 'Previous Frame',
      'shell-frame-next': 'Next Frame',
      'reverse-frame': this.getCarReverseFrameMenuLabel(),
      'tire-treads': this.getCarTireTreadsMenuLabel(),
      'add-ons': this.getCarAddOnsMenuLabel(),
      'turn-left': this.selectedCar?.art?.turnFrames?.left ? `Left: ${this.selectedCar.art.turnFrames.left}` : 'Left Turn Art',
      'turn-center': this.selectedCar?.art?.turnFrames?.center ? `Center: ${this.selectedCar.art.turnFrames.center}` : 'Center Art',
      'turn-right': this.selectedCar?.art?.turnFrames?.right ? `Right: ${this.selectedCar.art.turnFrames.right}` : 'Right Turn Art',
      'edit-tires': 'Tire Art',
      'edit-spoiler': 'Spoiler Art',
      'drivetrain-menu': `Drivetrain: ${String(this.selectedCar?.tuning?.drivetrain || '').toUpperCase()}`,
      power: `Power: ${Math.round(Number(this.selectedCar?.tuning?.powerHp) || 0)} hp`,
      'power-curve': `Power Curve: ${Math.round(Number(this.selectedCar?.tuning?.powerHp) || 0)} hp`,
      weight: `Weight: ${Math.round(Number(this.selectedCar?.tuning?.weightKg) || 0)} kg`,
      'weight-balance': `Weight: ${Math.round(Number(this.selectedCar?.tuning?.weightKg) || 0)} kg / ${Math.round((Number(this.selectedCar?.tuning?.frontWeightDistribution) || 0.5) * 100)}% F`,
      'default-tires': `Default Tires: ${this.getRaceTireCompound(this.selectedCar, 'fl').label}`,
      'tire-pressure': `Pressure: ${Math.round(Number(this.selectedCar?.setup?.tirePressurePsi?.fl) || 32)}/${Math.round(Number(this.selectedCar?.setup?.tirePressurePsi?.rl) || 31)} psi`,
      'tire-size': this.getCarTireSizeLabel(),
      'brake-balance': `Brake: ${Math.round((Number(this.selectedCar?.tuning?.brakeBalance) || 0) * 100)}%`,
      'final-drive': `Final: ${(Number(this.selectedCar?.transmissions?.[this.getRaceTransmissionType(this.selectedCar)]?.gearFinalDrive ?? this.selectedCar?.tuning?.gearFinalDrive) || 0).toFixed(2)}`,
      'diff-accel': `Diff Accel: ${Math.round((Number(this.selectedCar?.tuning?.differentialAccel) || 0) * 100)}%`,
      'diff-decel': `Diff Decel: ${Math.round((Number(this.selectedCar?.tuning?.differentialDecel) || 0) * 100)}%`,
      'aero-front': `Front Aero: ${Math.round((Number(this.selectedCar?.tuning?.aeroFront) || 0) * 100)}%`,
      'aero-rear': `Rear Aero: ${Math.round((Number(this.selectedCar?.tuning?.aeroRear) || 0) * 100)}%`,
      'spring-front': `Front Spring: ${Math.round((Number(this.selectedCar?.tuning?.springFront) || 0) * 100)}%`,
      'spring-rear': `Rear Spring: ${Math.round((Number(this.selectedCar?.tuning?.springRear) || 0) * 100)}%`,
      'damping-front': `Front Damping: ${Math.round((Number(this.selectedCar?.tuning?.dampingFront) || 0) * 100)}%`,
      'damping-rear': `Rear Damping: ${Math.round((Number(this.selectedCar?.tuning?.dampingRear) || 0) * 100)}%`,
      'antiroll-front': `Front ARB: ${Math.round((Number(this.selectedCar?.tuning?.antiRollFront) || 0) * 100)}%`,
      'antiroll-rear': `Rear ARB: ${Math.round((Number(this.selectedCar?.tuning?.antiRollRear) || 0) * 100)}%`
    };
    const builtInRace = BUILT_IN_RACE_LOAD_ACTIONS.find((entry) => entry.id === id);
    if (builtInRace) return `Load ${createTestTrackRace(builtInRace.raceId).name}`;
    return labels[id] || id;
  }

  getCarShellFrameMenuLabel() {
    const car = this.normalizeLoadedCarDocument(this.selectedCar || {});
    const slot = this.selectedCarShellFrameSlot || 'front';
    const entry = car?.art?.shellFrames?.slots?.[slot] || null;
    const frame = Number.isFinite(Number(entry?.frameIndex)) ? Number(entry.frameIndex) : 0;
    return `${CAR_SHELL_FRAME_LABELS[slot] || slot}: Frame ${frame}`;
  }

  getCarReverseFrameMenuLabel() {
    const frame = this.selectedCar?.art?.shellFrames?.reverseFrameIndex;
    return Number.isFinite(Number(frame)) ? `Reverse: Frame ${Number(frame)}` : 'Reverse Frame';
  }

  getCarTireTreadsMenuLabel() {
    const compound = String(this.selectedCar?.setup?.defaultTireCompound || 'tarmac');
    const entry = RACE_TIRE_COMPOUNDS.find((item) => item.id === compound) || RACE_TIRE_COMPOUNDS[0];
    const artRef = this.selectedCar?.art?.tireTreads?.[compound]?.artRef;
    return artRef ? `${entry.label}: ${artRef}` : `${entry.label} Tread`;
  }

  getCarAddOnsMenuLabel() {
    const enabled = (this.selectedCar?.art?.addOns || []).filter((entry) => entry?.enabled !== false && entry?.artRef).length;
    return enabled ? `Add-ons: ${enabled} on` : 'Add-ons';
  }

  getCarTireSizeLabel() {
    const size = this.selectedCar?.setup?.tireSize || DEFAULT_TIRE_SIZE;
    return `Size: ${Math.round(Number(size.widthMm) || 245)}/${Math.round(Number(size.aspectRatio) || 40)}R${Math.round(Number(size.wheelDiameterIn) || 18)}`;
  }

  cycleCarShellFrameSlot(delta = 1) {
    const current = this.selectedCarShellFrameSlot || 'front';
    const index = Math.max(0, RACE_CAR_SHELL_FRAME_SLOTS.indexOf(current));
    this.selectedCarShellFrameSlot = RACE_CAR_SHELL_FRAME_SLOTS[(index + delta + RACE_CAR_SHELL_FRAME_SLOTS.length) % RACE_CAR_SHELL_FRAME_SLOTS.length];
    this.status = `Shell slot: ${CAR_SHELL_FRAME_LABELS[this.selectedCarShellFrameSlot]}`;
  }

  adjustCarShellFrameIndex(delta = 1) {
    const car = this.selectedCar;
    if (!car) return;
    this.normalizeLoadedCarDocument(car);
    const slot = this.selectedCarShellFrameSlot || 'front';
    car.art.shellFrames.slots[slot] = car.art.shellFrames.slots[slot] || {
      artRef: car.art.shellFrames.artRef || car.art.shell || null,
      frameIndex: 0
    };
    const entry = car.art.shellFrames.slots[slot];
    entry.artRef = entry.artRef || car.art.shellFrames.artRef || car.art.shell || null;
    entry.frameIndex = Math.max(0, Math.round(Number(entry.frameIndex) || 0) + delta);
    this.status = `${CAR_SHELL_FRAME_LABELS[slot]} shell frame ${entry.frameIndex}`;
  }

  adjustCarReverseFrame(delta = 1) {
    const car = this.selectedCar;
    if (!car) return;
    this.normalizeLoadedCarDocument(car);
    const current = Number.isFinite(Number(car.art.shellFrames.reverseFrameIndex))
      ? Number(car.art.shellFrames.reverseFrameIndex)
      : 0;
    car.art.shellFrames.reverseFrameIndex = Math.max(0, Math.round(current + delta));
    this.status = `Reverse shell frame ${car.art.shellFrames.reverseFrameIndex}`;
  }

  cycleCarDefaultTireCompound() {
    const car = this.selectedCar;
    if (!car) return;
    const current = String(car.setup?.defaultTireCompound || car.setup?.tireCompoundByWheel?.fl || 'tarmac');
    const index = Math.max(0, RACE_TIRE_COMPOUNDS.findIndex((entry) => entry.id === current));
    const next = RACE_TIRE_COMPOUNDS[(index + 1) % RACE_TIRE_COMPOUNDS.length];
    car.setup.defaultTireCompound = next.id;
    car.setup.tireCompoundByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId, next.id]));
    this.status = `Default tires: ${next.label}`;
  }

  adjustCarTirePressure(delta = 1) {
    const car = this.selectedCar;
    if (!car) return;
    car.setup.tirePressurePsi = car.setup.tirePressurePsi || {};
    RACE_WHEEL_IDS.forEach((wheelId) => {
      car.setup.tirePressurePsi[wheelId] = clamp(Math.round((Number(car.setup.tirePressurePsi[wheelId]) || 32) + delta), 18, 52);
    });
    this.status = `Tire pressure ${Math.round(Number(car.setup.tirePressurePsi.fl) || 32)} psi`;
  }

  adjustCarTireSize(delta = 1) {
    const car = this.selectedCar;
    if (!car) return;
    car.setup.tireSize = car.setup.tireSize || { ...DEFAULT_TIRE_SIZE };
    car.setup.tireSize.widthMm = clamp(Math.round((Number(car.setup.tireSize.widthMm) || DEFAULT_TIRE_SIZE.widthMm) + delta * 5), 125, 405);
    const sidewallM = (car.setup.tireSize.widthMm * (Number(car.setup.tireSize.aspectRatio) || 40) / 100) / 1000;
    const wheelRadiusM = ((Number(car.setup.tireSize.wheelDiameterIn) || 18) * 0.0254) / 2 + sidewallM;
    car.tuning.wheelRadiusM = Number(wheelRadiusM.toFixed(3));
    this.status = this.getCarTireSizeLabel();
  }

  cycleCarDrivetrain() {
    const order = ['rwd', 'fwd', 'awd'];
    const car = this.selectedCar;
    if (!car) return;
    const current = String(car.tuning?.drivetrain || 'rwd');
    const index = Math.max(0, order.indexOf(current));
    car.tuning.drivetrain = order[(index + 1) % order.length];
    this.status = `Drivetrain: ${car.tuning.drivetrain.toUpperCase()}`;
  }

  adjustCarPowerCurve(delta = 1) {
    const car = this.selectedCar;
    if (!car) return;
    const tuning = this.syncCarTuningFromEngineCurve(car.tuning || {});
    tuning.engineCurve.torquePoints = tuning.engineCurve.torquePoints.map((point, index, points) => ({
      ...point,
      torqueLbFt: Math.max(20, Math.round(Number(point.torqueLbFt || 0) + delta * (index === 0 || index === points.length - 1 ? 4 : 8)))
    }));
    this.syncCarTuningFromEngineCurve(tuning);
    car.tuning = tuning;
    this.status = `Power curve peak ${Math.round(tuning.powerHp)} hp / ${Math.round(tuning.torqueLbFt)} lb-ft`;
  }

  adjustCarWeightBalance(delta = 1) {
    const car = this.selectedCar;
    if (!car) return;
    car.tuning.weightKg = clamp(Math.round((Number(car.tuning.weightKg) || 1400) + delta * 25), 500, 4000);
    car.tuning.frontWeightDistribution = clamp(Number(car.tuning.frontWeightDistribution || 0.5) + delta * 0.005, 0.35, 0.75);
    this.status = `Weight ${Math.round(car.tuning.weightKg)} kg / ${Math.round(car.tuning.frontWeightDistribution * 100)}% front`;
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
      { id: 'paint-ground', label: compact ? 'Paint' : 'Paint Ground', onClick: () => this.handleMenuAction('paint-ground') }
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
    this.activeRootId = 'file';
    this.resetRaceMapViewport();
    this.status = `Loaded ${template.name}`;
    return true;
  }

  cloneRaceDocument(race = this.selectedRace) {
    return race ? JSON.parse(JSON.stringify(race)) : null;
  }

  getRaceDocumentName({ forceSaveAs = false } = {}) {
    if (!forceSaveAs && this.currentRaceDocumentName) return this.currentRaceDocumentName;
    const race = this.selectedRace || {};
    return sanitizeProjectFileName(race.name || race.id || 'Untitled Race') || 'Untitled Race';
  }

  serializeSelectedRaceDocument() {
    const race = this.cloneRaceDocument();
    return {
      schemaVersion: 1,
      kind: 'race-track',
      savedAt: Date.now(),
      selectedRaceId: race?.id || '',
      race
    };
  }

  normalizeLoadedRaceDocument(data = {}, fallbackName = '') {
    const race = data?.kind === 'race-track'
      ? data.race
      : data?.race && typeof data.race === 'object'
        ? data.race
        : data;
    if (!race || typeof race !== 'object') return null;
    const clone = JSON.parse(JSON.stringify(race));
    clone.id = String(clone.id || sanitizeProjectFileName(fallbackName) || `race-${Date.now().toString(36)}`);
    clone.name = String(clone.name || fallbackName || clone.id);
    clone.road = clone.road && typeof clone.road === 'object' ? clone.road : { nodes: [], segments: [] };
    clone.road.nodes = Array.isArray(clone.road.nodes) ? clone.road.nodes : [];
    clone.road.segments = Array.isArray(clone.road.segments) ? clone.road.segments : [];
    clone.competition = clone.competition && typeof clone.competition === 'object' ? clone.competition : { mode: 'solo', aiDrivers: [] };
    clone.hazards = Array.isArray(clone.hazards) ? clone.hazards : [];
    clone.scenery = Array.isArray(clone.scenery) ? clone.scenery : [];
    clone.sceneryDefinitions = Array.isArray(clone.sceneryDefinitions) ? clone.sceneryDefinitions : [];
    clone.decals = Array.isArray(clone.decals) ? clone.decals : [];
    this.normalizeStudioSprintRace(clone);
    return clone;
  }

  applyLoadedRaceDocument(data = {}, { name = '' } = {}) {
    const race = this.normalizeLoadedRaceDocument(data, name);
    if (!race) {
      this.status = 'Race load failed';
      return false;
    }
    const existingIndex = this.project.races.findIndex((candidate) => candidate.id === race.id);
    if (existingIndex >= 0) this.project.races[existingIndex] = race;
    else this.project.races.push(race);
    this.project.selectedRaceId = race.id;
    this.currentRaceDocumentName = sanitizeProjectFileName(name || race.name || race.id);
    this.selectedSegmentIndex = 0;
    this.raceSelectionType = 'edge';
    this.racePortraitMode = 'race';
    this.activeRootId = 'track';
    this.playtestSession = null;
    this.racePathSampleCache?.clear?.();
    this.raceTerrainElevationCache?.clear?.();
    this.raceRoadDeckElevationCache?.clear?.();
    this.raceRoadSurfaceProfileCache?.clear?.();
    this.raceRoadCorridorCache?.clear?.();
    this.raceRoadbedProfileCache?.clear?.();
    this.raceSurfaceBakeCache = null;
    this.resetRaceMapViewport();
    this.status = `Loaded ${race.name}`;
    return true;
  }

  saveSelectedRace({ forceSaveAs = false } = {}) {
    const selected = this.selectedRace;
    if (!selected) return null;
    const fallbackName = this.getRaceDocumentName({ forceSaveAs });
    if (forceSaveAs && typeof document !== 'undefined') {
      void openProjectBrowser({
        mode: 'saveAs',
        fixedFolder: 'races',
        initialFolder: 'races',
        initialName: fallbackName,
        title: 'Save Race As'
      }).then((result) => {
        if (!result?.name) {
          this.status = 'Save canceled';
          return null;
        }
        return this.saveSelectedRaceToName(result.name);
      });
      return null;
    }
    return this.saveSelectedRaceToName(fallbackName);
  }

  saveSelectedRaceToName(name = '') {
    const clean = sanitizeProjectFileName(name || this.getRaceDocumentName()) || 'Untitled Race';
    const payload = this.serializeSelectedRaceDocument();
    const saved = saveProjectFile('races', clean, payload);
    this.currentRaceDocumentName = clean;
    this.status = `Saved ${clean}`;
    saved?.syncPromise?.catch?.((error) => {
      if (typeof console !== 'undefined') console.warn('Race save sync failed', error);
      this.status = `Saved locally; sync failed`;
    });
    return saved;
  }

  openRaceDocument() {
    if (typeof document === 'undefined') {
      const name = this.currentRaceDocumentName || this.getRaceDocumentName();
      const payload = loadProjectFile('races', name);
      if (payload?.data) return this.applyLoadedRaceDocument(payload.data, { name });
      this.status = 'No saved race found';
      return false;
    }
    void openProjectBrowser({
      mode: 'open',
      fixedFolder: 'races',
      initialFolder: 'races',
      title: 'Open Race',
      onOpen: ({ name, payload }) => {
        this.applyLoadedRaceDocument(payload?.data, { name });
      }
    });
    return true;
  }

  cloneCarDocument(car = this.selectedCar) {
    return car ? JSON.parse(JSON.stringify(car)) : null;
  }

  getCarDocumentName({ forceSaveAs = false } = {}) {
    if (!forceSaveAs && this.currentCarDocumentName) return this.currentCarDocumentName;
    const car = this.selectedCar || {};
    return sanitizeProjectFileName(car.name || car.id || 'Untitled Car') || 'Untitled Car';
  }

  serializeSelectedCarDocument() {
    const car = this.normalizeLoadedCarDocument(this.cloneCarDocument() || {});
    return {
      schemaVersion: 2,
      kind: 'race-car',
      savedAt: Date.now(),
      selectedCarId: car?.id || '',
      car
    };
  }

  getDefaultCarEngineCurve(tuning = {}) {
    const idle = Math.max(500, Math.round(Number(tuning.idleRpm) || 850));
    const start = Math.max(idle + 200, Math.round(Number(tuning.torquePeakStartRpm) || 2200));
    const end = Math.max(start + 200, Math.round(Number(tuning.torquePeakEndRpm) || 5200));
    const max = Math.max(end + 200, Math.round(Number(tuning.revLimitRpm || tuning.redlineRpm) || 6300));
    const peakTorque = Math.max(1, Number(tuning.torqueLbFt) || 250);
    const powerRpm = clamp(Math.round(Number(tuning.redlineRpm || max) || max), end, max);
    const powerTorque = Math.max(peakTorque * 0.45, (Math.max(1, Number(tuning.powerHp) || 1) * 5252) / Math.max(1, powerRpm));
    return {
      rpmMin: idle,
      rpmMax: max,
      torquePoints: [
        { rpm: idle, torqueLbFt: Math.round(peakTorque * 0.42) },
        { rpm: start, torqueLbFt: Math.round(peakTorque) },
        { rpm: end, torqueLbFt: Math.round(peakTorque) },
        { rpm: powerRpm, torqueLbFt: Math.round(powerTorque) },
        { rpm: max, torqueLbFt: Math.round(peakTorque * 0.58) }
      ].filter((point, index, points) => index === 0 || point.rpm > points[index - 1].rpm)
    };
  }

  normalizeCarEngineCurve(tuning = {}) {
    const fallback = this.getDefaultCarEngineCurve(tuning);
    const curve = tuning.engineCurve && typeof tuning.engineCurve === 'object' ? tuning.engineCurve : {};
    const sourcePoints = Array.isArray(curve.torquePoints) ? curve.torquePoints : [];
    const torquePoints = sourcePoints
      .map((point) => ({
        rpm: Math.max(0, Math.round(Number(point?.rpm) || 0)),
        torqueLbFt: Math.max(0, Math.round(Number(point?.torqueLbFt) || 0))
      }))
      .filter((point) => point.rpm > 0 && point.torqueLbFt > 0)
      .sort((a, b) => a.rpm - b.rpm);
    const normalized = torquePoints.length >= 2 ? torquePoints : fallback.torquePoints;
    const rpmMin = Math.max(1, Math.round(Number(curve.rpmMin) || normalized[0]?.rpm || fallback.rpmMin));
    const rpmMax = Math.max(rpmMin + 1, Math.round(Number(curve.rpmMax) || normalized[normalized.length - 1]?.rpm || fallback.rpmMax));
    return {
      rpmMin,
      rpmMax,
      torquePoints: normalized
    };
  }

  syncCarTuningFromEngineCurve(tuning = {}) {
    const curve = this.normalizeCarEngineCurve(tuning);
    let peakTorque = 0;
    let peakHp = 0;
    curve.torquePoints.forEach((point) => {
      peakTorque = Math.max(peakTorque, Number(point.torqueLbFt) || 0);
      peakHp = Math.max(peakHp, (Number(point.torqueLbFt) || 0) * (Number(point.rpm) || 0) / 5252);
    });
    tuning.engineCurve = curve;
    tuning.torqueLbFt = Math.max(1, Math.round(peakTorque || tuning.torqueLbFt || 1));
    tuning.powerHp = Math.max(1, Math.round(peakHp || tuning.powerHp || 1));
    return tuning;
  }

  normalizeLoadedCarDocument(data = {}, fallbackName = '') {
    const car = data?.kind === 'race-car'
      ? data.car
      : data?.car && typeof data.car === 'object'
        ? data.car
        : data;
    if (!car || typeof car !== 'object') return null;
    const clone = JSON.parse(JSON.stringify(car));
    const cleanName = sanitizeProjectFileName(fallbackName || clone.name || clone.id);
    clone.id = String(clone.id || (cleanName ? cleanName.toLowerCase().replace(/\s+/g, '-') : '') || `car-${Date.now().toString(36)}`);
    clone.name = String(clone.name || fallbackName || clone.id);
    clone.class = String(clone.class || 'road');
    clone.art = clone.art && typeof clone.art === 'object' ? clone.art : {};
    clone.art.turnFrames = clone.art.turnFrames && typeof clone.art.turnFrames === 'object'
      ? clone.art.turnFrames
      : { left: null, center: null, right: null };
    const legacyTurns = clone.art.turnFrames;
    clone.art.shellFrames = clone.art.shellFrames && typeof clone.art.shellFrames === 'object' ? clone.art.shellFrames : {};
    clone.art.shellFrames.mode = '8-way';
    clone.art.shellFrames.artRef = String(clone.art.shellFrames.artRef || clone.art.shell || clone.art.body || clone.art.artRef || '').trim() || null;
    const shellSlots = clone.art.shellFrames.slots && typeof clone.art.shellFrames.slots === 'object' ? clone.art.shellFrames.slots : {};
    const legacySlotRefs = {
      front: legacyTurns.center || clone.art.shell || null,
      frontRight: legacyTurns.right || legacyTurns.center || clone.art.shell || null,
      right: legacyTurns.right || legacyTurns.center || clone.art.shell || null,
      rearRight: legacyTurns.right || legacyTurns.center || clone.art.shell || null,
      rear: legacyTurns.center || clone.art.shell || null,
      rearLeft: legacyTurns.left || legacyTurns.center || clone.art.shell || null,
      left: legacyTurns.left || legacyTurns.center || clone.art.shell || null,
      frontLeft: legacyTurns.left || legacyTurns.center || clone.art.shell || null
    };
    clone.art.shellFrames.slots = Object.fromEntries(RACE_CAR_SHELL_FRAME_SLOTS.map((slot) => {
      const entry = shellSlots[slot];
      if (entry && typeof entry === 'object') {
        return [slot, {
          artRef: String(entry.artRef || clone.art.shellFrames.artRef || '').trim() || null,
          frameIndex: Number.isFinite(Number(entry.frameIndex)) ? Math.max(0, Math.round(Number(entry.frameIndex))) : null
        }];
      }
      if (entry !== null && entry !== undefined && entry !== '') {
        return [slot, {
          artRef: clone.art.shellFrames.artRef || null,
          frameIndex: Math.max(0, Math.round(Number(entry) || 0))
        }];
      }
      const legacyRef = String(legacySlotRefs[slot] || '').trim();
      return [slot, legacyRef ? { artRef: legacyRef, frameIndex: 0 } : null];
    }));
    clone.art.shellFrames.reverseFrameIndex = Number.isFinite(Number(clone.art.shellFrames.reverseFrameIndex))
      ? Math.max(0, Math.round(Number(clone.art.shellFrames.reverseFrameIndex)))
      : null;
    const oldTireRef = this.getFirstCarArtRef(clone.art.tires);
    clone.art.tireTreads = clone.art.tireTreads && typeof clone.art.tireTreads === 'object' ? clone.art.tireTreads : {};
    clone.art.tireTreads = Object.fromEntries(RACE_TIRE_COMPOUNDS.map((compound) => {
      const entry = clone.art.tireTreads[compound.id];
      if (entry && typeof entry === 'object') {
        return [compound.id, {
          artRef: String(entry.artRef || '').trim() || null,
          frameIndex: Math.max(0, Math.round(Number(entry.frameIndex) || 0))
        }];
      }
      const legacy = String(entry || oldTireRef || '').trim();
      return [compound.id, { artRef: legacy || null, frameIndex: 0 }];
    }));
    const addOns = Array.isArray(clone.art.addOns) ? clone.art.addOns : [];
    const legacySpoilers = [
      ...((Array.isArray(clone.art.spoilers) ? clone.art.spoilers : [clone.art.spoiler]).filter(Boolean))
    ];
    clone.art.addOns = [
      ...addOns,
      ...legacySpoilers.map((artRef, index) => ({ id: `spoiler-${index + 1}`, label: 'Spoiler', enabled: true, artRef }))
    ].map((entry, index) => ({
      id: String(entry?.id || `add-on-${index + 1}`),
      label: String(entry?.label || 'Add-on'),
      enabled: entry?.enabled !== false,
      artRef: String(entry?.artRef || entry || '').trim() || null,
      frameIndex: Math.max(0, Math.round(Number(entry?.frameIndex) || 0)),
      offsetX: Number(entry?.offsetX || 0),
      offsetY: Number(entry?.offsetY || 0),
      scale: Number(entry?.scale || 1) || 1
    })).filter((entry, index, list) => entry.artRef || list.indexOf(entry) === index);
    clone.audio = clone.audio && typeof clone.audio === 'object' ? clone.audio : {};
    clone.setup = clone.setup && typeof clone.setup === 'object' ? clone.setup : {};
    clone.setup.defaultTireCompound = RACE_TIRE_COMPOUNDS.some((compound) => compound.id === clone.setup.defaultTireCompound)
      ? clone.setup.defaultTireCompound
      : 'tarmac';
    clone.setup.tireCompoundByWheel = clone.setup.tireCompoundByWheel && typeof clone.setup.tireCompoundByWheel === 'object'
      ? clone.setup.tireCompoundByWheel
      : { fl: 'tarmac', fr: 'tarmac', rl: 'tarmac', rr: 'tarmac' };
    RACE_WHEEL_IDS.forEach((wheelId) => {
      if (!RACE_TIRE_COMPOUNDS.some((compound) => compound.id === clone.setup.tireCompoundByWheel[wheelId])) {
        clone.setup.tireCompoundByWheel[wheelId] = clone.setup.defaultTireCompound;
      }
    });
    clone.setup.tirePressurePsi = clone.setup.tirePressurePsi && typeof clone.setup.tirePressurePsi === 'object'
      ? clone.setup.tirePressurePsi
      : { fl: 32, fr: 32, rl: 31, rr: 31 };
    clone.setup.tireSize = clone.setup.tireSize && typeof clone.setup.tireSize === 'object' ? clone.setup.tireSize : {};
    clone.setup.tireSize = {
      widthMm: Math.max(125, Math.round(Number(clone.setup.tireSize.widthMm) || DEFAULT_TIRE_SIZE.widthMm)),
      aspectRatio: Math.max(20, Math.round(Number(clone.setup.tireSize.aspectRatio) || DEFAULT_TIRE_SIZE.aspectRatio)),
      wheelDiameterIn: Math.max(10, Math.round(Number(clone.setup.tireSize.wheelDiameterIn) || DEFAULT_TIRE_SIZE.wheelDiameterIn))
    };
    clone.tuning = clone.tuning && typeof clone.tuning === 'object' ? clone.tuning : {};
    this.syncCarTuningFromEngineCurve(clone.tuning);
    clone.transmissions = clone.transmissions && typeof clone.transmissions === 'object' ? clone.transmissions : {};
    clone.defaultTransmissionType = clone.defaultTransmissionType || (clone.transmissions.automatic ? 'automatic' : 'manual');
    return clone;
  }

  applyLoadedCarDocument(data = {}, { name = '' } = {}) {
    const car = this.normalizeLoadedCarDocument(data, name);
    if (!car) {
      this.status = 'Car load failed';
      return false;
    }
    const existingIndex = this.project.cars.findIndex((candidate) => candidate.id === car.id);
    if (existingIndex >= 0) this.project.cars[existingIndex] = car;
    else this.project.cars.push(car);
    this.project.selectedCarId = car.id;
    this.currentCarDocumentName = sanitizeProjectFileName(name || car.name || car.id);
    this.activeRootId = 'art';
    this.playtestSession = null;
    this.status = `Loaded ${car.name}`;
    return true;
  }

  loadBuiltInCarDocument(carId = '') {
    this.ensureBuiltInCarProjectFiles();
    const car = createBuiltInRaceCars().find((candidate) => candidate.id === carId);
    if (!car) {
      this.status = 'Stock car not found';
      return false;
    }
    const name = sanitizeProjectFileName(car.name || car.id);
    const saved = name ? loadProjectFile('cars', name) : null;
    const payload = saved?.data || {
      schemaVersion: 2,
      kind: 'race-car',
      savedAt: Date.now(),
      selectedCarId: car.id,
      car: this.normalizeLoadedCarDocument(car, name)
    };
    return this.applyLoadedCarDocument(payload, { name });
  }

  saveSelectedCar({ forceSaveAs = false } = {}) {
    const selected = this.selectedCar;
    if (!selected) return null;
    const fallbackName = this.getCarDocumentName({ forceSaveAs });
    if (forceSaveAs && typeof document !== 'undefined') {
      void openProjectBrowser({
        mode: 'saveAs',
        fixedFolder: 'cars',
        initialFolder: 'cars',
        initialName: fallbackName,
        title: 'Save Car As'
      }).then((result) => {
        if (!result?.name) {
          this.status = 'Save canceled';
          return null;
        }
        return this.saveSelectedCarToName(result.name);
      });
      return null;
    }
    return this.saveSelectedCarToName(fallbackName);
  }

  saveSelectedCarToName(name = '') {
    const clean = sanitizeProjectFileName(name || this.getCarDocumentName()) || 'Untitled Car';
    const payload = this.serializeSelectedCarDocument();
    const saved = saveProjectFile('cars', clean, payload);
    this.currentCarDocumentName = clean;
    this.status = `Saved ${clean}`;
    saved?.syncPromise?.catch?.((error) => {
      if (typeof console !== 'undefined') console.warn('Car save sync failed', error);
      this.status = 'Saved locally; sync failed';
    });
    return saved;
  }

  ensureBuiltInCarProjectFiles() {
    createBuiltInRaceCars().forEach((car) => {
      const name = sanitizeProjectFileName(car.name || car.id);
      if (!name || loadProjectFile('cars', name)) return;
      saveProjectFile('cars', name, {
        schemaVersion: 2,
        kind: 'race-car',
        savedAt: Date.now(),
        selectedCarId: car.id,
        car: this.normalizeLoadedCarDocument(car, name)
      }, { createVersion: false });
    });
  }

  openCarDocument() {
    this.ensureBuiltInCarProjectFiles();
    if (typeof document === 'undefined') {
      const name = this.currentCarDocumentName || this.getCarDocumentName();
      const payload = loadProjectFile('cars', name);
      if (payload?.data) return this.applyLoadedCarDocument(payload.data, { name });
      this.status = 'No saved car found';
      return false;
    }
    void openProjectBrowser({
      mode: 'open',
      fixedFolder: 'cars',
      initialFolder: 'cars',
      title: 'Open Car',
      onOpen: ({ name, payload }) => {
        this.applyLoadedCarDocument(payload?.data, { name });
      }
    });
    return true;
  }

  ensureSelectedCarArt() {
    const car = this.selectedCar;
    if (!car) return null;
    car.art = car.art && typeof car.art === 'object' ? car.art : {};
    car.art.turnFrames = car.art.turnFrames && typeof car.art.turnFrames === 'object'
      ? car.art.turnFrames
      : { left: null, center: null, right: null };
    return car.art;
  }

  setSelectedCarArtRef(slot = 'center', artRef = '') {
    const art = this.ensureSelectedCarArt();
    if (!art) return null;
    const clean = String(artRef || '').trim();
    if (slot === 'shell') {
      art.shell = clean;
      art.turnFrames.center = art.turnFrames.center || clean;
      art.shellFrames = art.shellFrames || { mode: '8-way', artRef: clean, slots: {}, reverseFrameIndex: null };
      art.shellFrames.artRef = clean;
      RACE_CAR_SHELL_FRAME_SLOTS.forEach((frameSlot) => {
        art.shellFrames.slots[frameSlot] = art.shellFrames.slots[frameSlot] || { artRef: clean, frameIndex: 0 };
        art.shellFrames.slots[frameSlot].artRef = art.shellFrames.slots[frameSlot].artRef || clean;
      });
    } else if (slot === 'left' || slot === 'center' || slot === 'right') {
      art.turnFrames[slot] = clean;
      if (slot === 'center') art.shell = art.shell || clean;
      art.shellFrames = art.shellFrames || { mode: '8-way', artRef: art.shell || clean, slots: {}, reverseFrameIndex: null };
      const slots = slot === 'left'
        ? ['left', 'frontLeft', 'rearLeft']
        : slot === 'right'
          ? ['right', 'frontRight', 'rearRight']
          : ['front', 'rear'];
      slots.forEach((frameSlot) => {
        art.shellFrames.slots[frameSlot] = { artRef: clean, frameIndex: 0 };
      });
    } else if (slot === 'tires') {
      art.tires = clean;
      art.tireTreads = art.tireTreads || {};
      RACE_TIRE_COMPOUNDS.forEach((compound) => {
        art.tireTreads[compound.id] = { artRef: clean, frameIndex: 0 };
      });
    } else if (slot.startsWith('tire-')) {
      const compoundId = slot.slice('tire-'.length);
      art.tireTreads = art.tireTreads || {};
      art.tireTreads[compoundId] = { artRef: clean, frameIndex: 0 };
    } else if (slot === 'spoiler') {
      art.spoiler = clean;
      art.addOns = [{ id: 'spoiler-1', label: 'Spoiler', enabled: true, artRef: clean, frameIndex: 0, offsetX: 0, offsetY: 0, scale: 1 }];
    } else if (slot === 'add-on') {
      art.addOns = Array.isArray(art.addOns) ? art.addOns : [];
      const first = art.addOns[0];
      if (first) {
        first.artRef = clean;
        first.enabled = true;
      } else {
        art.addOns.push({ id: 'add-on-1', label: 'Add-on', enabled: true, artRef: clean, frameIndex: 0, offsetX: 0, offsetY: 0, scale: 1 });
      }
    }
    this.raceArtSpriteCache?.delete?.(`name:${clean}`);
    this.status = clean ? `Car ${slot} art: ${clean}` : `Car ${slot} art cleared`;
    return clean;
  }

  async openCarArtPicker(slot = 'center') {
    const labels = {
      shell: 'Shell',
      left: 'Left Turn',
      center: 'Center',
      right: 'Right Turn',
      tires: 'Tires',
      spoiler: 'Spoiler',
      'add-on': 'Add-on'
    };
    this.activeRootId = 'art';
    if (typeof document === 'undefined') {
      return this.setSelectedCarArtRef(slot, `Test ${labels[slot] || slot} Art`);
    }
    const picked = await openProjectBrowser({
      fixedFolder: 'art',
      initialFolder: 'art',
      title: `Pick Car ${labels[slot] || slot} Art`
    });
    if (picked?.action === 'open' && picked.name) {
      return this.setSelectedCarArtRef(slot, picked.name);
    }
    this.status = 'Car art picker closed';
    return null;
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
    if (RACE_NEW_LANE_ACTION_BY_ID[action]) {
      const laneCount = RACE_NEW_LANE_ACTION_BY_ID[action].laneCount;
      this.project = createDefaultRaceProject();
      this.playtestSession = null;
      this.selectedSegmentIndex = 0;
      this.applyRaceLaneCount(laneCount);
      this.status = `New ${laneCount}-lane race`;
      return;
    }
    if (action === 'save' || action === 'save-as') {
      if (this.mode === 'car') {
        this.saveSelectedCar({ forceSaveAs: action === 'save-as' });
        return;
      }
      this.saveSelectedRace({ forceSaveAs: action === 'save-as' });
      return;
    }
    if (action === 'open') {
      if (this.mode === 'car') {
        this.openCarDocument();
        return;
      }
      this.openRaceDocument();
      return;
    }
    if (this.mode === 'car') {
      const stockCarActionMap = {
        'load-wrx': 'starter-rwd',
        'load-brz': 'subaru-brz-2022',
        'load-civic': 'honda-civic-type-r-2023'
      };
      if (stockCarActionMap[action]) {
        this.loadBuiltInCarDocument(stockCarActionMap[action]);
        return;
      }
    }
    if (action === 'test-drive') {
      this.openPlaytestPicker();
      return;
    }
    if (RACE_DIAGNOSTIC_ACTIONS[action]) {
      this.startRaceDiagnostic(RACE_DIAGNOSTIC_ACTIONS[action]);
      return;
    }
    if (action === 'ai-fill-grid') {
      this.fillRaceAiGrid();
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
      this.racePortraitHotMenu = null;
      this.activeRootId = 'track';
      this.status = 'Move mode: drag track nodes to reshape the race';
    } else if (action === 'insert-node') {
      this.racePortraitHotMenu = null;
      this.insertRaceNodeAfterSelectedEdge();
    } else if (action === 'snap-node') {
      this.racePortraitHotMenu = null;
      this.snapSelectedRaceNodeToStart();
    } else if (action === 'remove-node') {
      this.racePortraitHotMenu = null;
      this.removeSelectedRaceNode();
    } else if (action === 'remove-edge') {
      this.racePortraitHotMenu = null;
      this.removeSelectedRaceEdge();
    } else if (action === 'shell-frames') {
      this.cycleCarShellFrameSlot(1);
      this.activeRootId = 'art';
    } else if (action === 'shell-frame-prev') {
      this.adjustCarShellFrameIndex(-1);
      this.activeRootId = 'art';
    } else if (action === 'shell-frame-next') {
      this.adjustCarShellFrameIndex(1);
      this.activeRootId = 'art';
    } else if (action === 'reverse-frame') {
      this.adjustCarReverseFrame(1);
      this.activeRootId = 'art';
    } else if (action === 'tire-treads') {
      this.openCarArtPicker(`tire-${this.selectedCar?.setup?.defaultTireCompound || 'tarmac'}`).catch((error) => {
        if (typeof console !== 'undefined') console.warn('Car tire tread picker failed', error);
        this.status = 'Car tire tread picker failed';
      });
    } else if (action === 'add-ons') {
      this.openCarArtPicker('add-on').catch((error) => {
        if (typeof console !== 'undefined') console.warn('Car add-on picker failed', error);
        this.status = 'Car add-on picker failed';
      });
    } else if (action === 'edit-shell') {
      this.openCarArtPicker('shell').catch((error) => {
        if (typeof console !== 'undefined') console.warn('Car shell picker failed', error);
        this.status = 'Car shell picker failed';
      });
    } else if (action === 'turn-left') {
      this.openCarArtPicker('left').catch((error) => {
        if (typeof console !== 'undefined') console.warn('Car left turn picker failed', error);
        this.status = 'Car left turn picker failed';
      });
    } else if (action === 'turn-center') {
      this.openCarArtPicker('center').catch((error) => {
        if (typeof console !== 'undefined') console.warn('Car center picker failed', error);
        this.status = 'Car center picker failed';
      });
    } else if (action === 'turn-right') {
      this.openCarArtPicker('right').catch((error) => {
        if (typeof console !== 'undefined') console.warn('Car right turn picker failed', error);
        this.status = 'Car right turn picker failed';
      });
    } else if (action === 'edit-tires') {
      this.openCarArtPicker('tires').catch((error) => {
        if (typeof console !== 'undefined') console.warn('Car tire picker failed', error);
        this.status = 'Car tire picker failed';
      });
    } else if (action === 'edit-spoiler') {
      this.openCarArtPicker('add-on').catch((error) => {
        if (typeof console !== 'undefined') console.warn('Car spoiler picker failed', error);
        this.status = 'Car spoiler picker failed';
      });
    } else if (action === 'drivetrain-menu') {
      this.cycleCarDrivetrain();
    } else if (action === 'default-tires') {
      this.cycleCarDefaultTireCompound();
    } else if (action === 'tire-pressure') {
      this.adjustCarTirePressure(1);
    } else if (action === 'tire-size') {
      this.adjustCarTireSize(1);
    } else if (action === 'power-curve') {
      this.adjustCarPowerCurve(1);
    } else if (action === 'weight-balance') {
      this.adjustCarWeightBalance(1);
    } else if (action.startsWith('drivetrain-')) {
      this.selectedCar.tuning.drivetrain = action.replace('drivetrain-', '');
    } else if (action === 'engine-sound-next') {
      this.cycleCarEngineSoundProfile();
    } else if (this.mode === 'car' && this.adjustCarEditorMenuTuningAction(action)) {
      // Car Editor top-menu numeric actions are intentionally one-tap adjustments.
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
      this.racePortraitMode = 'ground';
      this.racePortraitHotMenu = null;
      this.activeRootId = 'ground';
      this.activeAction = 'paint-elevation';
      this.status = `Ground elevation brush ${Math.round(this.raceElevationBrushSize * 100)}%`;
    } else if (action === 'elevation-up') {
      this.setRaceElevationBrushDirection(1);
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      this.activeAction = 'paint-elevation';
      this.racePortraitHotMenu = this.racePortraitHotMenu === 'elevation-up' ? null : 'elevation-up';
      this.status = 'Choose raise amount';
    } else if (action === 'elevation-down') {
      this.setRaceElevationBrushDirection(-1);
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      this.activeAction = 'paint-elevation';
      this.racePortraitHotMenu = this.racePortraitHotMenu === 'elevation-down' ? null : 'elevation-down';
      this.status = 'Choose lower amount';
    } else if (action.startsWith('elevation-up-')) {
      this.setRaceElevationBrushDirection(1);
      this.setRaceElevationBrushAmount(action.slice('elevation-up-'.length));
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      this.activeAction = 'paint-elevation';
      this.racePortraitHotMenu = null;
    } else if (action.startsWith('elevation-down-')) {
      this.setRaceElevationBrushDirection(-1);
      this.setRaceElevationBrushAmount(action.slice('elevation-down-'.length));
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      this.activeAction = 'paint-elevation';
      this.racePortraitHotMenu = null;
    } else if (action === 'race-ground-mode') {
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      this.racePortraitHotMenu = this.racePortraitHotMenu === 'ground-mode' ? null : 'ground-mode';
      this.status = 'Choose race editor mode';
    } else if (action === 'race-ground-mode-ground') {
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      this.activeAction = 'paint-ground';
      this.racePortraitHotMenu = null;
      this.status = `Ground mode: ${this.getRaceGroundTilePalette(this.getSelectedGroundTileId()).label}`;
    } else if (action === 'race-ground-mode-elevation') {
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      this.activeAction = 'paint-elevation';
      this.racePortraitHotMenu = null;
      this.status = this.raceElevationBrushDirection > 0 ? 'Elevation mode: raise' : 'Elevation mode: lower';
    } else if (action === 'race-ground-mode-sprites') {
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      this.activeAction = this.getRaceSpritePaintActionId();
      this.racePortraitHotMenu = null;
      this.status = this.getRaceSpritePaintStatus();
    } else if (action === 'race-ground-paint') {
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      this.racePortraitHotMenu = this.racePortraitHotMenu === 'ground-paint' ? null : 'ground-paint';
      this.status = 'Choose what to paint';
    } else if (action === 'race-ground-intensity') {
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      this.racePortraitHotMenu = this.racePortraitHotMenu === 'ground-intensity' ? null : 'ground-intensity';
      this.status = 'Choose paint intensity';
    } else if (action === 'race-ground-brush' || action === 'elevation-brush-size') {
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      if (!['paint-ground', 'paint-elevation'].includes(this.activeAction)) this.activeAction = 'paint-ground';
      this.racePortraitHotMenu = this.racePortraitHotMenu === 'ground-brush' ? null : 'ground-brush';
      this.status = 'Choose ground brush';
    } else if (action === 'race-ground-paint-raise') {
      this.setRaceElevationBrushDirection(1);
      this.racePortraitHotMenu = null;
    } else if (action === 'race-ground-paint-lower') {
      this.setRaceElevationBrushDirection(-1);
      this.racePortraitHotMenu = null;
    } else if (action === 'race-ground-intensity-erase') {
      if (this.activeAction === 'paint-elevation') {
        this.raceElevationBrushAmount = 0;
        this.status = 'Elevation erase: flatten';
      } else {
        this.raceGroundBrushStrength = 0;
        this.status = 'Ground erase selected';
      }
      this.racePortraitHotMenu = null;
    } else if (action === 'square-turn') {
      this.toggleSelectedSquareTurn();
    } else if (action === 'road-width') {
      this.cycleRoadWidth();
    } else if (action === 'ai-count') {
      this.openRaceAiDialog();
    } else if (action === 'segment-width') {
      this.cycleSelectedSegmentRoadWidth();
    } else if (action === 'segment-bumpiness') {
      this.cycleSelectedSegmentBumpiness();
    } else if (action === 'boundary-collidable') {
      this.toggleSelectedSegmentBoundaryCollidable();
    } else if (action === 'snow-condition') {
      this.cycleSelectedSegmentSnowCondition();
    } else if (action === 'ground-tile-next') {
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      this.activeAction = 'paint-ground';
      this.racePortraitHotMenu = this.racePortraitHotMenu === 'ground-tile' ? null : 'ground-tile';
      this.status = 'Choose ground terrain';
    } else if (action.startsWith('ground-tile-')) {
      this.setSelectedGroundTileId(action.slice('ground-tile-'.length));
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      this.activeAction = 'paint-ground';
      this.racePortraitHotMenu = null;
    } else if (action.startsWith('ground-brush-shape-')) {
      this.setRaceGroundBrushShape(action.slice('ground-brush-shape-'.length));
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      if (!['paint-ground', 'paint-elevation'].includes(this.activeAction)) this.activeAction = 'paint-ground';
      this.racePortraitHotMenu = 'ground-brush';
    } else if (action.startsWith('ground-brush-falloff-')) {
      this.setRaceGroundBrushFalloff(action.slice('ground-brush-falloff-'.length));
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      if (!['paint-ground', 'paint-elevation'].includes(this.activeAction)) this.activeAction = 'paint-ground';
      this.racePortraitHotMenu = 'ground-brush';
    } else if (action.startsWith('ground-brush-strength-')) {
      this.setRaceGroundBrushStrength(action.slice('ground-brush-strength-'.length));
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      if (!['paint-ground', 'paint-elevation'].includes(this.activeAction)) this.activeAction = 'paint-ground';
      this.racePortraitHotMenu = 'ground-brush';
    } else if (action.startsWith('ground-brush-')) {
      const brush = this.getGroundBrushOptions().find((entry) => entry.id === action.slice('ground-brush-'.length));
      if (brush) this.setRaceGroundBrushSize(brush);
      this.racePortraitMode = 'ground';
      this.activeRootId = 'ground';
      if (!['paint-ground', 'paint-elevation'].includes(this.activeAction)) this.activeAction = 'paint-ground';
      this.racePortraitHotMenu = 'ground-brush';
    } else if (action === 'paint-ground') {
      this.racePortraitMode = 'ground';
      this.racePortraitHotMenu = null;
      this.activeRootId = 'ground';
      this.status = `Paint ground with ${this.getRaceGroundTilePalette(this.getSelectedGroundTileId()).label}`;
    } else if (action === 'edge-tile') {
      this.racePortraitMode = 'race';
      this.racePortraitHotMenu = null;
      this.activeRootId = 'track';
      this.setSelectedSegmentEdgeTile();
    } else if (action.startsWith('surface-')) {
      this.setSelectedSurface(action.replace('surface-', ''));
    } else if (action.startsWith('weather-')) {
      if (action === 'weather-intensity') {
        this.cycleRaceWeatherIntensity();
      } else {
        this.setRaceWeather(action.replace('weather-', ''));
      }
    } else if (action === 'race-sun') {
      this.openRaceSunDialog();
    } else if (action === 'race-weather') {
      this.openRaceWeatherDialog();
    } else if (action === 'race-tiles') {
      this.openRaceTilesDialog();
    } else if (action === 'race-margin') {
      this.openRaceMarginDialog();
    } else if (action === 'race-tire-fx') {
      this.openRaceTireFxDialog();
    } else if (action === 'race-texture-scale') {
      this.openRaceTextureScaleDialog();
    } else if (action === 'skybox-next') {
      this.openRaceSkyboxArtPicker().catch((error) => {
        if (typeof console !== 'undefined') console.warn('Race skybox picker failed', error);
        this.status = 'Skybox picker failed';
      });
    } else if (action === 'generate-random-race') {
      this.generateRandomRace();
    } else if (action === 'finish-return') {
      this.selectedRace.finishBehavior.type = 'return-to-origin';
    } else if (action === 'zoom-fit') {
      this.resetRaceMapViewport();
    } else if (action === 'add-sprite') {
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'settings';
      this.racePortraitHotMenu = null;
      this.status = 'Pick sprite artwork';
      this.openRaceSpriteArtPicker().catch((error) => {
        if (typeof console !== 'undefined') console.warn('Race sprite picker failed', error);
        this.status = 'Sprite art picker failed';
      });
    } else if (action === 'sprite-select') {
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'sprites';
      this.raceSpritePaintKind = 'sprite';
      this.activeAction = 'paint-sprite';
      this.racePortraitHotMenu = this.racePortraitHotMenu === 'sprite-select' ? null : 'sprite-select';
      this.status = 'Choose sprite to paint';
    } else if (action === 'paint-sprite') {
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'sprites';
      this.racePortraitHotMenu = null;
      this.activeAction = this.getRaceSpritePaintActionId();
      this.status = this.getRaceSpritePaintStatus();
    } else if (action === 'erase-sprite') {
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'sprites';
      this.racePortraitHotMenu = null;
      this.activeAction = this.getRaceSpriteEraseActionId();
      this.status = `Erase ${this.getRaceSpritePaintKind() === 'tile' ? 'tiles' : this.getRaceSpritePaintKind() === 'decal' ? 'decals' : 'sprite instances'}`;
    } else if (action === 'race-decal') {
      this.raceSpritePaintKind = 'decal';
      this.openRaceDecalArtPicker().catch((error) => {
        if (typeof console !== 'undefined') console.warn('Race decal picker failed', error);
        this.status = 'Decal picker failed';
      });
    } else if (action === 'race-ground-box') {
      this.raceSpritePaintKind = 'tile';
      this.openRaceGroundBoxArtPicker().catch((error) => {
        if (typeof console !== 'undefined') console.warn('Race ground tile picker failed', error);
        this.status = 'Ground tile picker failed';
      });
    } else if (action === 'paint-decal') {
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'sprites';
      this.raceSpritePaintKind = 'decal';
      this.racePortraitHotMenu = null;
      this.activeAction = 'paint-decal';
      this.status = this.selectedRaceDecalArtRef ? `Paint decal: ${this.selectedRaceDecalArtRef}` : 'Pick a decal first';
    } else if (action === 'erase-decal') {
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'sprites';
      this.raceSpritePaintKind = 'decal';
      this.racePortraitHotMenu = null;
      this.activeAction = 'erase-decal';
      this.status = 'Erase decals';
    } else if (action === 'paint-tile') {
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'sprites';
      this.raceSpritePaintKind = 'tile';
      this.racePortraitHotMenu = null;
      this.activeAction = 'paint-tile';
      this.status = this.selectedRaceGroundBoxArtRef ? `Paint tile: ${this.selectedRaceGroundBoxArtRef}` : 'Pick a ground tile first';
    } else if (action === 'erase-tile') {
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'sprites';
      this.raceSpritePaintKind = 'tile';
      this.racePortraitHotMenu = null;
      this.activeAction = 'erase-tile';
      this.status = 'Erase ground tiles';
    } else if (action === 'sprite-brush-settings') {
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'sprites';
      this.racePortraitHotMenu = this.racePortraitHotMenu === 'sprite-brush' ? null : 'sprite-brush';
      this.status = 'Choose sprite brush';
    } else if (action === 'move-sprite') {
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'sprites';
      this.status = 'Sprite mode: move scenery sprite';
    } else if (action === 'delete-sprite') {
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'sprites';
      if (!this.deleteSelectedRaceScenery()) {
        this.status = 'Sprite mode: tap scenery sprite to delete';
      }
    } else if (action === 'sprite-size') {
      this.cycleSelectedScenerySize();
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'settings';
      this.racePortraitHotMenu = 'sprite-settings';
    } else if (action === 'sprite-height') {
      this.cycleSelectedSceneryHeight();
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'settings';
      this.racePortraitHotMenu = 'sprite-settings';
    } else if (action === 'sprite-behavior') {
      this.cycleSelectedSceneryBehavior();
      this.racePortraitMode = 'sprites';
      this.activeRootId = 'settings';
      this.racePortraitHotMenu = 'sprite-settings';
    }
    const groundMenuToggleActions = ['race-ground-mode', 'race-ground-paint', 'race-ground-intensity', 'race-ground-brush'];
    if (!groundMenuToggleActions.includes(action)) this.activeAction = action;
    if (['elevation-up', 'elevation-down', 'paint-elevation'].includes(action) || action.startsWith('elevation-up-') || action.startsWith('elevation-down-')) {
      this.activeAction = 'paint-elevation';
    }
    if (action === 'ground-tile-next' || action === 'paint-ground' || action.startsWith('ground-tile-') || action.startsWith('ground-brush-')) {
      this.activeAction = 'paint-ground';
    }
    if (action === 'race-ground-mode' || action === 'race-ground-paint' || action === 'race-ground-intensity' || action === 'race-ground-brush') {
      if (!['paint-ground', 'paint-elevation', 'paint-sprite', 'paint-decal', 'paint-tile', 'erase-sprite', 'erase-decal', 'erase-tile'].includes(this.activeAction)) {
        this.activeAction = 'paint-ground';
      }
    }
    if (action === 'race-ground-mode-ground') this.activeAction = 'paint-ground';
    if (action === 'race-ground-mode-elevation' || action === 'race-ground-paint-raise' || action === 'race-ground-paint-lower') this.activeAction = 'paint-elevation';
    if (action === 'race-ground-mode-sprites') this.activeAction = this.getRaceSpritePaintActionId();
    if (action === 'sprite-select' || action === 'paint-sprite' || action === 'erase-sprite' || action === 'paint-decal' || action === 'erase-decal' || action === 'paint-tile' || action === 'erase-tile' || action === 'race-decal' || action === 'race-ground-box' || action === 'sprite-brush-settings') {
      if (action === 'sprite-select') this.activeAction = 'paint-sprite';
      else if (action === 'paint-sprite') this.activeAction = this.getRaceSpritePaintActionId();
      else if (action === 'erase-sprite') this.activeAction = this.getRaceSpriteEraseActionId();
      else if (action === 'race-decal') this.activeAction = this.selectedRaceDecalArtRef ? 'paint-decal' : 'race-decal';
      else if (action === 'race-ground-box') this.activeAction = this.selectedRaceGroundBoxArtRef ? 'paint-tile' : 'race-ground-box';
      else if (action !== 'sprite-brush-settings') this.activeAction = action;
    }
    if (action === 'sprite-size' || action === 'sprite-height' || action === 'sprite-behavior') {
      this.activeAction = 'paint-sprite';
    }
    if (!['generate-random-race', ...BUILT_IN_RACE_LOAD_ACTIONS.map((entry) => entry.id), ...Object.keys(CAR_EDITOR_TUNING_ACTION_PATHS), 'ground-tile-next', 'paint-ground', 'paint-elevation', 'elevation-up', 'elevation-down', 'elevation-brush-size', 'race-ground-mode', 'race-ground-paint', 'race-ground-intensity', 'race-ground-brush', 'race-ground-mode-ground', 'race-ground-mode-elevation', 'race-ground-mode-sprites', 'race-ground-paint-raise', 'race-ground-paint-lower', 'race-ground-intensity-erase', 'edge-tile', 'segment-width', 'segment-bumpiness', 'boundary-collidable', 'snow-condition', 'move-node', 'insert-node', 'snap-node', 'remove-node', 'remove-edge', 'engine-sound-next', 'add-sprite', 'sprite-select', 'paint-sprite', 'erase-sprite', 'move-sprite', 'delete-sprite', 'sprite-size', 'sprite-height', 'sprite-behavior', 'weather-intensity', 'skybox-next', 'ai-count', 'race-sun', 'race-weather', 'race-tiles', 'race-margin', 'race-tire-fx', 'race-texture-scale', 'race-decal', 'race-ground-box', 'paint-decal', 'erase-decal', 'paint-tile', 'erase-tile', 'sprite-brush-settings'].includes(action) && !action.startsWith('weather-') && !action.startsWith('ground-tile-') && !action.startsWith('ground-brush-') && !action.startsWith('elevation-up-') && !action.startsWith('elevation-down-')) {
      this.status = `${action.replace(/-/g, ' ')} selected`;
    }
    this.activeRootId = this.findRootForAction(action) || this.activeRootId;
    if (action === 'generate-random-race') {
      this.restoreRaceMenuAfterGenerate();
    } else {
      this.mobileRootOpen = false;
      this.gamepadSubmenuOpen = false;
    }
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

  createRaceDiagnosticRace(mode = 'skidpad') {
    const base = this.selectedRace || {};
    const makeStraightNodes = (length = 1600) => [
      { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
      { x: 0, y: length, elevation: 0, role: 'finish' }
    ];
    const diagnostic = {
      id: `diagnostic-${mode}`,
      name: mode === 'quarter-mile' ? 'Quarter Mile Test' : `${this.getRaceActionLabel(`diagnostic-${mode}`)} Test`,
      type: mode === 'ai-laps' || mode === 'skidpad' ? 'circuit' : 'destination',
      laps: mode === 'ai-laps' ? 3 : 1,
      weather: base.weather || 'clear',
      timeOfDay: base.timeOfDay || 'day',
      diagnosticMode: mode,
      road: {
        width: mode === 'slalom' ? 7 : 11,
        selectedGroundTileId: 'grass',
        groundTiles: [],
        tileMap: {
          cellSizeM: RACE_TILE_MAP_CELL_SIZE_M,
          defaultTileId: 'grass',
          minElevation: RACE_TILE_MAP_MIN_ELEVATION,
          maxElevation: RACE_TILE_MAP_MAX_ELEVATION,
          cells: {}
        },
        nodes: makeStraightNodes(mode === 'quarter-mile' ? 402.336 : mode === 'braking' ? 900 : 1400),
        segments: [
          { length: mode === 'quarter-mile' ? 402.336 : mode === 'braking' ? 900 : 1400, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: [] }
        ]
      },
      competition: {
        mode: mode === 'ai-laps' ? 'ai-race' : 'solo',
        aiDrivers: mode === 'ai-laps' ? this.createRaceAiGrid(11) : [],
        playerStartGrid: 1,
        trafficEnabled: false
      },
      hazards: [],
      codriver: { enabled: false, voice: 'default', calls: [] },
      scenery: [],
      sceneryDefinitions: []
    };
    if (mode === 'skidpad') {
      const radius = 90;
      diagnostic.road.width = 9;
      diagnostic.road.nodes = Array.from({ length: 17 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 16;
        return {
          x: Math.round(Math.sin(angle) * radius),
          y: Math.round(Math.cos(angle) * radius),
          elevation: 0,
          ...(index === 0 ? { role: 'start', locked: true } : {})
        };
      });
      diagnostic.road.segments = Array.from({ length: 16 }, () => ({ length: 36, curve: 0.45, elevation: 0, surface: 'asphalt', roadWidthM: 9, hazardIds: [] }));
    } else if (mode === 'slalom') {
      diagnostic.diagnosticGates = [120, 220, 320, 420, 520, 620, 720, 820];
    } else if (mode === 'jump') {
      diagnostic.road.nodes = makeStraightNodes(900);
      diagnostic.road.nodes.splice(1, 0, { x: 0, y: 380, elevation: 0.4 }, { x: 0, y: 520, elevation: -0.12 });
      diagnostic.road.segments = [
        { length: 320, curve: 0, elevation: 0.35, surface: 'asphalt', hazardIds: ['diagnostic-jump'] },
        { length: 180, curve: 0, elevation: -0.12, surface: 'asphalt', hazardIds: ['diagnostic-jump'] },
        { length: 400, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: [] }
      ];
      diagnostic.hazards = [{ id: 'diagnostic-jump', type: 'jump', label: 'Diagnostic Jump', at: 420, lane: 0, height: 0.5, landingForgiveness: 0.42 }];
    } else if (mode === 'ai-laps') {
      diagnostic.road.width = 10;
      diagnostic.road.nodes = [
        { x: -110, y: 0, elevation: 0, role: 'start', locked: true },
        { x: -110, y: 260, elevation: 0.04 },
        { x: 110, y: 260, elevation: 0.02 },
        { x: 110, y: 0, elevation: -0.02 },
        { x: -110, y: 0, elevation: 0, role: 'finish' }
      ];
      diagnostic.road.segments = [
        { length: 260, curve: 0.08, elevation: 0.04, surface: 'asphalt', roadWidthM: 10, hazardIds: [] },
        { length: 220, curve: 0.62, elevation: 0.02, surface: 'asphalt', roadWidthM: 10, hazardIds: [] },
        { length: 260, curve: 0.08, elevation: -0.02, surface: 'asphalt', roadWidthM: 10, hazardIds: [] },
        { length: 220, curve: 0.62, elevation: 0, surface: 'asphalt', roadWidthM: 10, hazardIds: [] }
      ];
    }
    return diagnostic;
  }

  startRaceDiagnostic(mode = 'skidpad') {
    const race = this.createRaceDiagnosticRace(mode);
    const index = this.project.races.findIndex((candidate) => candidate.id === race.id);
    if (index >= 0) this.project.races[index] = race;
    else this.project.races.push(race);
    this.project.selectedRaceId = race.id;
    this.selectedSegmentIndex = 0;
    this.pendingDiagnosticMode = mode;
    this.openPlaytestPicker();
    this.status = `${race.name}: choose a car`;
  }

  createRaceAiGrid(count = 11) {
    const difficulties = ['easy', 'medium', 'hard', 'expert'];
    const cars = ['starter-rwd', 'subaru-brz-2022', 'honda-civic-type-r-2023'];
    return Array.from({ length: Math.max(0, Math.min(11, Math.round(Number(count) || 0))) }, (_, index) => {
      const difficulty = difficulties[index % difficulties.length];
      const baseSkill = { easy: 0.38, medium: 0.58, hard: 0.76, expert: 0.92 }[difficulty];
      return {
        id: `ai-${index + 1}`,
        name: `${difficulty[0].toUpperCase()}${difficulty.slice(1)} AI ${index + 1}`,
        carId: cars[index % cars.length],
        difficulty,
        skill: baseSkill,
        aggression: { easy: 0.28, medium: 0.45, hard: 0.62, expert: 0.78 }[difficulty],
        rubberBanding: difficulty === 'expert' ? 0 : 0.12,
        enabled: true
      };
    });
  }

  fillRaceAiGrid() {
    const race = this.selectedRace;
    if (!race) return;
    race.competition = {
      ...(race.competition || {}),
      mode: 'ai-race',
      aiDrivers: this.createRaceAiGrid(11),
      playerStartGrid: 1,
      trafficEnabled: false
    };
    this.status = 'Filled AI grid: 11 racers';
  }

  getRaceAiCount() {
    return (this.selectedRace?.competition?.aiDrivers || []).filter((driver) => driver.enabled !== false).length;
  }

  collectSelectedRaceArtRefs() {
    const race = this.selectedRace || {};
    const refs = new Set();
    const add = (value) => {
      const clean = String(value || '').trim();
      if (clean) refs.add(clean);
    };
    const addCarArt = (car) => {
      if (!car?.art || typeof car.art !== 'object') return;
      add(car.art.shell);
      add(car.art.body);
      add(car.art.artRef);
      add(car.art.tires);
      add(car.art.spoiler);
      Object.values(car.art.turnFrames || {}).forEach(add);
    };
    add(race.skyboxArtRef || race.visuals?.skyboxArtRef);
    Object.values(race.surfaceArt || {}).forEach(add);
    add(race.margin?.artRef);
    (race.sceneryDefinitions || []).forEach((definition) => add(definition?.artRef));
    (race.scenery || []).forEach((sprite) => add(sprite?.artRef));
    (race.decals || []).forEach((decal) => add(decal?.artRef));
    Object.values(race.tireFx || {}).forEach((settings) => add(settings?.artRef));
    Object.values(race.road?.tileMap?.cells || {}).forEach((cell) => {
      add(cell?.artRef || cell?.tileArtRef);
    });
    addCarArt(this.selectedCar);
    (race.competition?.aiDrivers || []).forEach((driver) => {
      const car = this.project.cars.find((candidate) => candidate.id === driver?.carId);
      addCarArt(car);
    });
    return [...refs];
  }

  preloadSelectedRaceArtRefs() {
    if (typeof document === 'undefined') return;
    const refs = this.collectSelectedRaceArtRefs();
    const startMs = this.getNowMs();
    this.racePreloadingArt = true;
    this.raceRuntimeArtCacheMisses = 0;
    this.raceRuntimeTextureCacheMisses = 0;
    refs.forEach((artRef) => {
      this.getRaceArtSpriteCanvas(artRef);
      this.getRaceArtTextureSampler(artRef);
    });
    this.racePreloadingArt = false;
    this.racePreloadedArtRefs = new Set(refs);
    const skyboxRef = String(this.selectedRace?.skyboxArtRef || this.selectedRace?.visuals?.skyboxArtRef || '').trim();
    if (skyboxRef) this.getRaceSkyboxRenderCanvas(skyboxRef);
    if (startMs > 0) {
      this.lastRaceRenderStats = {
        ...(this.lastRaceRenderStats || {}),
        preloadArtRefs: refs.length,
        preloadArtMs: Math.max(0, this.getNowMs() - startMs)
      };
    }
  }

  getRaceWorldBakeKey({
    terrainSize = 40,
    routeLength = this.getRaceRouteLength(),
    runtimeType = this.getSelectedRaceRuntimeType(),
    textureWorldM = this.getRaceGroundTextureBaseWorldM(),
    renderDebug = this.getRaceRenderDebugSettings()
  } = {}) {
    const tileMap = this.ensureRaceTileMap();
    return [
      this.selectedRace?.id || 'race',
      Number(tileMap?.revision) || 0,
      this.getRacePathSampleCacheSignature(2.5),
      runtimeType,
      Math.round(Number(routeLength || 0) * 10),
      Math.round(Number(terrainSize || 0) * 100),
      Math.round(Number(textureWorldM || 0) * 1000),
      renderDebug.detailEnabled === true ? 1 : 0,
      renderDebug.terrainLodEnabled !== false ? 1 : 0,
      renderDebug.terrainBudgetEnabled !== false ? 1 : 0,
      String(this.getRaceSurfaceArtRefForSurface('asphalt') || ''),
      String(this.getRaceBoundaryArtRef(this.selectedSegment) || ''),
      String(this.getRaceSurfaceArtRefForSurface(this.ensureRaceTileMap()?.defaultTileId || 'grass') || '')
    ].join('::');
  }

  buildRaceWorldBake({
    terrainSize = 40,
    routeLength = this.getRaceRouteLength(),
    runtimeType = this.getSelectedRaceRuntimeType(),
    renderDebug = this.getRaceRenderDebugSettings(),
    textureWorldM = this.getRaceGroundTextureBaseWorldM()
  } = {}) {
    const startMs = this.getNowMs();
    const tileMap = this.ensureRaceTileMap();
    const effectiveTerrainSize = Math.max(20, Number(terrainSize) || 40);
    const routeEnd = Math.max(1, Number(routeLength) || 1);
    const key = this.getRaceWorldBakeKey({
      terrainSize: effectiveTerrainSize,
      routeLength: routeEnd,
      runtimeType,
      textureWorldM,
      renderDebug
    });
    if (this.raceWorldBakeCache?.key === key) return this.raceWorldBakeCache;
    const terrainBake = this.getRaceTerrainBakeCache(tileMap, effectiveTerrainSize);
    const detailEnabled = renderDebug.detailEnabled === true;
    const terrainLodEnabled = renderDebug.terrainLodEnabled !== false;
    const samples = this.getRaceRoadbedProfile({
      routeLength: routeEnd,
      runtimeType,
      allowVisualExtension: runtimeType !== 'circuit',
      step: 2.5
    }).samples || [];
    const chunkKeys = new Set();
    const addChunkRange = (pose = {}, { wide = false } = {}) => {
      const centerCellX = Math.round(Number(pose.x || 0) / effectiveTerrainSize);
      const centerCellZ = Math.round(Number(pose.z || 0) / effectiveTerrainSize);
      const metrics = this.getRaceTrackCorridorMetrics(pose, pose.segment || this.selectedSegment);
      const terrainReach = wide ? effectiveTerrainSize * 18 : effectiveTerrainSize * 2.25;
      const radius = clamp(
        Math.ceil((Number(metrics.outerHalfWidth || 0) + terrainReach) / effectiveTerrainSize),
        3,
        wide ? 30 : 7
      );
      for (let z = centerCellZ - radius; z <= centerCellZ + radius; z += 1) {
        for (let x = centerCellX - radius; x <= centerCellX + radius; x += 1) {
          chunkKeys.add(`${x},${z}`);
        }
      }
    };
    samples.forEach((sample, index) => {
      if (index % 2 === 0 || index === samples.length - 1) addChunkRange(sample);
      if (index % 8 === 0 || index === samples.length - 1) addChunkRange(sample, { wide: true });
    });
    const visualRange = this.getRaceVisualDistanceRange({ routeLength: routeEnd, runtimeType });
    addChunkRange(this.getRaceWorldPoseAtDistance(visualRange.minVisualDistance, {
      runtimeType,
      allowVisualExtension: true
    }), { wide: true });
    addChunkRange(this.getRaceWorldPoseAtDistance(visualRange.maxVisualDistance, {
      runtimeType,
      allowVisualExtension: true
    }), { wide: true });
    const terrainBaseCells = [];
    const terrainRefinementCells = [];
    const terrainChunks = [];
    const terrainSeamVertexCache = new Map();
    const maxBakeCells = detailEnabled ? 64000 : 52000;
    const pushTerrainCell = (target, triangle, {
      chunk,
      chunkKey,
      subX = 0,
      subZ = 0,
      triangleIndex = 0,
      layer = 'base',
      groupKey = chunkKey,
      parentGroupKey = ''
    } = {}) => {
      if (!Array.isArray(triangle) || triangle.length < 3) return;
      target.push({
        points: triangle,
        tileCell: chunk.tileCell,
        chunkKey,
        key: `${chunk.key || chunkKey}:${layer}:${subX},${subZ}:${triangleIndex}`,
        groupKey,
        parentGroupKey,
        terrainLayer: layer,
        roadAdjacent: chunk.roadAdjacent,
        nearRoad: chunk.nearRoad,
        roadDistance: chunk.roadDistance,
        corridorDistance: chunk.corridorDistance,
        clippedToTrackCorridor: triangle.some((point) => point?.trackSeam === true)
      });
    };
    [...chunkKeys].sort((a, b) => {
      const [ax, az] = a.split(',').map(Number);
      const [bx, bz] = b.split(',').map(Number);
      const aProjection = this.getRaceRouteProjectionForWorldPoint({
        x: (ax + 0.5) * effectiveTerrainSize,
        z: (az + 0.5) * effectiveTerrainSize
      });
      const bProjection = this.getRaceRouteProjectionForWorldPoint({
        x: (bx + 0.5) * effectiveTerrainSize,
        z: (bz + 0.5) * effectiveTerrainSize
      });
      return Number(aProjection?.distance || 0) - Number(bProjection?.distance || 0);
    }).forEach((chunkKey) => {
      const [x, z] = chunkKey.split(',').map(Number);
      const chunk = this.getRaceBakedTerrainChunk(x, z, effectiveTerrainSize, tileMap, terrainBake);
      if (!this.shouldIncludeRaceTerrainChunkForRendering(chunk)) return;
      terrainChunks.push(chunk);
      const baseGroupKey = `${chunk.key || chunkKey}:base`;
      const baseTriangles = this.getRaceTerrainTrianglesOutsideTrackCorridor(chunk.fullPoints, {
        runtimeType,
        routeLength: routeEnd,
        includeTransition: true,
        seamVertexCache: terrainSeamVertexCache
      });
      baseTriangles.forEach((triangle, triangleIndex) => pushTerrainCell(terrainBaseCells, triangle, {
        chunk,
        chunkKey,
        triangleIndex,
        layer: 'base',
        groupKey: baseGroupKey
      }));
      let subdivisions = chunk.roadAdjacent && terrainLodEnabled
        ? Math.max(2, this.getRaceRoadbedTerrainSubdivision(chunk, effectiveTerrainSize))
        : 1;
      if (detailEnabled && terrainLodEnabled) {
        subdivisions = Math.max(subdivisions, this.getRaceBakedTerrainSubdivision(chunk, 0, {
          cameraCellX: 0,
          detailEnabled: true,
          textured: true
        }));
      }
      subdivisions = clamp(subdivisions, 1, chunk.nearRoad ? 8 : 3);
      if (subdivisions <= 1 || terrainRefinementCells.length >= maxBakeCells) return;
      const refinementGroup = [];
      const refinementGroupKey = `${chunk.key || chunkKey}:refined:${subdivisions}`;
      for (let subZ = 0; subZ < subdivisions; subZ += 1) {
        for (let subX = 0; subX < subdivisions; subX += 1) {
          const points = this.getRaceBakedTerrainQuadPoints(chunk, subX, subZ, subdivisions);
          const retainedTriangles = this.getRaceTerrainTrianglesOutsideTrackCorridor(points, {
            runtimeType,
            routeLength: routeEnd,
            includeTransition: true,
            seamVertexCache: terrainSeamVertexCache
          });
          retainedTriangles.forEach((triangle, triangleIndex) => {
            pushTerrainCell(refinementGroup, triangle, {
              chunk,
              chunkKey,
              subX,
              subZ,
              triangleIndex,
              layer: 'refinement',
              groupKey: refinementGroupKey,
              parentGroupKey: baseGroupKey
            });
          });
        }
      }
      if (refinementGroup.length > 0 && terrainRefinementCells.length + refinementGroup.length <= maxBakeCells) {
        refinementGroup.forEach((cell) => {
          cell.refinementGroupSize = refinementGroup.length;
          terrainRefinementCells.push(cell);
        });
      }
    });
    const terrainCells = [...terrainBaseCells, ...terrainRefinementCells];
    const bake = {
      key,
      surfaceRevision: this.getRaceSurfaceGeometryRevisionKey({
        step: 2.5,
        runtimeType,
        allowVisualExtension: runtimeType !== 'circuit',
        routeLength: routeEnd
      }),
      terrainSize: effectiveTerrainSize,
      routeLength: routeEnd,
      runtimeType,
      textureWorldM,
      terrainCells,
      terrainBaseCells,
      terrainRefinementCells,
      terrainChunks,
      surfaceBake: this.getRaceSurfaceBake({
        routeLength: routeEnd,
        runtimeType,
        allowVisualExtension: runtimeType !== 'circuit'
      }),
      builtMs: startMs > 0 ? Math.max(0, this.getNowMs() - startMs) : 0
    };
    bake.validation = this.validateRaceSurfaceGeometry(bake);
    this.raceWorldBakeCache = bake;
    return bake;
  }

  buildRaceEditorSurfacePreviewBake({
    terrainSize = 40,
    routeLength = this.getRaceRouteLength(),
    runtimeType = this.getSelectedRaceRuntimeType(),
    renderDebug = this.getRaceRenderDebugSettings(),
    textureWorldM = this.getRaceGroundTextureBaseWorldM()
  } = {}) {
    const effectiveDebug = {
      ...renderDebug,
      terrainEnabled: true,
      texturesEnabled: renderDebug.texturesEnabled !== false,
      detailEnabled: renderDebug.detailEnabled === true,
      terrainCullingEnabled: false,
      terrainBudgetEnabled: false
    };
    const bake = this.buildRaceWorldBake({
      terrainSize,
      routeLength,
      runtimeType,
      renderDebug: effectiveDebug,
      textureWorldM
    });
    const surfaceRevision = this.getRaceSurfaceGeometryRevisionKey({
      step: 2.5,
      runtimeType,
      allowVisualExtension: runtimeType !== 'circuit',
      routeLength
    });
    return {
      ...bake,
      surfaceRevision,
      validation: this.validateRaceSurfaceGeometry(bake)
    };
  }

  getRaceEditorSurfacePreviewBake(options = {}) {
    const routeLength = Math.max(1, Number(options.routeLength || this.getRaceRouteLength()) || 1);
    const runtimeType = options.runtimeType || this.getSelectedRaceRuntimeType();
    const renderDebug = options.renderDebug || this.getRaceRenderDebugSettings();
    const key = [
      this.getRaceSurfaceGeometryRevisionKey({
        step: 2.5,
        runtimeType,
        allowVisualExtension: runtimeType !== 'circuit',
        routeLength
      }),
      Math.round(Number(options.terrainSize || 40) * 100),
      renderDebug.detailEnabled === true ? 1 : 0,
      renderDebug.terrainLodEnabled !== false ? 1 : 0,
      renderDebug.rawTerrainPolygonsEnabled === true ? 1 : 0
    ].join('::preview::');
    if (this.raceEditorSurfacePreviewBake?.key === key) return this.raceEditorSurfacePreviewBake;
    this.raceEditorSurfacePreviewBake = {
      key,
      ...this.buildRaceEditorSurfacePreviewBake({
        terrainSize: options.terrainSize || 40,
        routeLength,
        runtimeType,
        renderDebug
      })
    };
    return this.raceEditorSurfacePreviewBake;
  }

  validateRaceSurfaceGeometry(worldBake = null) {
    return validateRaceSurfaceGeometryModule(worldBake, {
      surfaceModel: this.getRaceSurfaceModel()
    });
  }

  getRaceVisibleWorldBakeTerrainCells(worldBake = null, {
    camera = null,
    cameraYaw = 0,
    bounds = {},
    terrainForwardDistance = 2200,
    maxTerrainCells = 1400,
    maxTerrainTriangles = null,
    terrainCullingEnabled = true,
    rightVector = null,
    forwardVector = null,
    stats = null
  } = {}) {
    if (!worldBake?.terrainCells?.length || !camera) return [];
    const right = rightVector || this.getRaceRightVector(cameraYaw);
    const forward = forwardVector || this.getRaceForwardVector(cameraYaw);
    const terrainSize = Math.max(1, Number(worldBake.terrainSize) || 40);
    const visibleBase = [];
    const visibleRefinement = [];
    const limit = Math.max(1, Number(maxTerrainTriangles ?? maxTerrainCells) || 1400);
    const cacheBucket = Math.max(4, terrainSize / 4);
    const cacheKey = [
      Math.round(Number(camera.x || 0) / cacheBucket),
      Math.round(Number(camera.z || 0) / cacheBucket),
      Math.round(Number(cameraYaw || 0) * 180 / Math.PI / 3),
      Math.round(Number(terrainForwardDistance || 0) / terrainSize),
      limit,
      terrainCullingEnabled ? 1 : 0,
      Math.round(Number(bounds.w || 1)),
      Math.round(Number(bounds.h || 1)),
      worldBake.revision || worldBake.key || worldBake.builtMs || worldBake.terrainCells.length
    ].join(':');
    if (!worldBake.visibleTerrainCache) worldBake.visibleTerrainCache = new Map();
    const cachedVisible = worldBake.visibleTerrainCache.get(cacheKey);
    if (cachedVisible?.cells?.length) {
      if (stats) {
        stats.terrainPreculled = (Number(stats.terrainPreculled) || 0) + Number(cachedVisible.terrainPreculled || 0);
        stats.terrainBudgetDropped = (Number(stats.terrainBudgetDropped) || 0) + Number(cachedVisible.terrainBudgetDropped || 0);
        stats.terrainCoverageDropped = (Number(stats.terrainCoverageDropped) || 0) + Number(cachedVisible.terrainCoverageDropped || 0);
        stats.terrainRefinementDropped = (Number(stats.terrainRefinementDropped) || 0) + Number(cachedVisible.terrainRefinementDropped || 0);
        stats.terrainBaseTriangles = (Number(stats.terrainBaseTriangles) || 0) + Number(cachedVisible.terrainBaseTriangles || 0);
        stats.terrainRefinementTriangles = (Number(stats.terrainRefinementTriangles) || 0) + Number(cachedVisible.terrainRefinementTriangles || 0);
        stats.terrainVisibleCacheHits = (Number(stats.terrainVisibleCacheHits) || 0) + 1;
      }
      return cachedVisible.cells;
    }
    const startPreculled = Number(stats?.terrainPreculled || 0);
    const startBudgetDropped = Number(stats?.terrainBudgetDropped || 0);
    const sourceCells = [
      ...(Array.isArray(worldBake.terrainBaseCells) ? worldBake.terrainBaseCells : []),
      ...(Array.isArray(worldBake.terrainRefinementCells) ? worldBake.terrainRefinementCells : [])
    ];
    const cellsToScan = sourceCells.length ? sourceCells : worldBake.terrainCells;
    for (const cell of cellsToScan) {
      const cameraBounds = this.getRaceTerrainCameraBounds(cell.points, camera, right, forward);
      const isBaseTerrain = cell.terrainLayer !== 'refinement';
      if (terrainCullingEnabled && !this.isRaceTerrainCameraBoundsVisible(cameraBounds, {
        terrainSize,
        terrainForwardDistance,
        screenWidth: Number(bounds.w || 1),
        forwardMargin: isBaseTerrain ? terrainSize : terrainSize * 2,
        lateralMargin: isBaseTerrain ? 0 : terrainSize
      })) {
        if (stats) stats.terrainPreculled += 1;
        continue;
      }
      cell.averageCameraZ = cameraBounds.averageCameraZ;
      cell.cameraCellX = (Number(cameraBounds.minCameraX) + Number(cameraBounds.maxCameraX)) * 0.5;
      cell.cameraCellZ = (Number(cameraBounds.minCameraZ) + Number(cameraBounds.maxCameraZ)) * 0.5;
      cell.baked = true;
      cell.terrainCandidatePriority = this.getRaceTerrainCandidatePriority({
        cameraCellX: cell.cameraCellX,
        cameraCellZ: cell.cameraCellZ,
        chunk: cell
      }, terrainSize);
      if (cell.terrainLayer === 'refinement') visibleRefinement.push(cell);
      else visibleBase.push(cell);
    }
    if (stats) stats.terrainCandidatesBeforeBudget = (Number(stats.terrainCandidatesBeforeBudget) || 0) + visibleBase.length + visibleRefinement.length;
    const compareVisibleTerrainCells = (a, b) => {
      const priorityDelta = Number(a.terrainCandidatePriority || 0) - Number(b.terrainCandidatePriority || 0);
      if (Math.abs(priorityDelta) > 0.0001) return priorityDelta;
      const zDelta = Number(a.cameraCellZ || 0) - Number(b.cameraCellZ || 0);
      if (Math.abs(zDelta) > 0.0001) return zDelta;
      const xDelta = Number(a.cameraCellX || 0) - Number(b.cameraCellX || 0);
      if (Math.abs(xDelta) > 0.0001) return xDelta;
      return String(a.key || '').localeCompare(String(b.key || ''));
    };
    visibleBase.sort((a, b) => Number(b.averageCameraZ || 0) - Number(a.averageCameraZ || 0));
    const selected = [...visibleBase];
    const selectedBaseGroups = new Set(visibleBase.map((cell) => cell.groupKey || cell.key));
    const refinementGroups = new Map();
    visibleRefinement.forEach((cell) => {
      const key = cell.groupKey || cell.key;
      if (!refinementGroups.has(key)) refinementGroups.set(key, []);
      refinementGroups.get(key).push(cell);
    });
    let selectedTriangleCount = selected.reduce((sum, cell) => sum + this.getRaceTerrainCellTriangleCount(cell), 0);
    let refinementDropped = 0;
    const sortedGroups = [...refinementGroups.values()].sort((a, b) => {
      const bestA = Math.min(...a.map((cell) => Number(cell.terrainCandidatePriority || 0)));
      const bestB = Math.min(...b.map((cell) => Number(cell.terrainCandidatePriority || 0)));
      return bestA - bestB;
    });
    sortedGroups.forEach((group) => {
      const expected = Number(group[0]?.refinementGroupSize || group.length);
      const groupTriangles = group.reduce((sum, cell) => sum + this.getRaceTerrainCellTriangleCount(cell), 0);
      if (group.length < expected || selectedTriangleCount + groupTriangles > limit) {
        refinementDropped += groupTriangles;
        return;
      }
      const parentKey = group[0]?.parentGroupKey;
      if (parentKey && selectedBaseGroups.has(parentKey)) {
        for (let index = selected.length - 1; index >= 0; index -= 1) {
          if ((selected[index].groupKey || selected[index].key) === parentKey) {
            selectedTriangleCount -= this.getRaceTerrainCellTriangleCount(selected[index]);
            selected.splice(index, 1);
          }
        }
        selectedBaseGroups.delete(parentKey);
      }
      group.forEach((cell) => selected.push(cell));
      selectedTriangleCount += groupTriangles;
    });
    if (stats) {
      stats.terrainBaseTriangles = (Number(stats.terrainBaseTriangles) || 0) + visibleBase.reduce((sum, cell) => sum + this.getRaceTerrainCellTriangleCount(cell), 0);
      stats.terrainRefinementTriangles = (Number(stats.terrainRefinementTriangles) || 0) + selected.filter((cell) => cell.terrainLayer === 'refinement').reduce((sum, cell) => sum + this.getRaceTerrainCellTriangleCount(cell), 0);
      stats.terrainCoverageDropped = (Number(stats.terrainCoverageDropped) || 0);
      stats.terrainRefinementDropped = (Number(stats.terrainRefinementDropped) || 0) + refinementDropped;
      stats.terrainBudgetDropped = (Number(stats.terrainBudgetDropped) || 0) + refinementDropped;
    }
    selected.sort((a, b) => Number(b.averageCameraZ || 0) - Number(a.averageCameraZ || 0));
    selected.visibleTerrainCacheKey = cacheKey;
    worldBake.visibleTerrainCache.set(cacheKey, {
      cells: selected,
      terrainPreculled: Math.max(0, Number(stats?.terrainPreculled || 0) - startPreculled),
      terrainBudgetDropped: Math.max(0, Number(stats?.terrainBudgetDropped || 0) - startBudgetDropped),
      terrainCoverageDropped: 0,
      terrainRefinementDropped: refinementDropped,
      terrainBaseTriangles: visibleBase.reduce((sum, cell) => sum + this.getRaceTerrainCellTriangleCount(cell), 0),
      terrainRefinementTriangles: selected.filter((cell) => cell.terrainLayer === 'refinement').reduce((sum, cell) => sum + this.getRaceTerrainCellTriangleCount(cell), 0)
    });
    if (worldBake.visibleTerrainCache.size > 48) {
      const firstKey = worldBake.visibleTerrainCache.keys().next().value;
      worldBake.visibleTerrainCache.delete(firstKey);
    }
    return selected;
  }

  getRaceTerrainCellTriangleCount(cell = {}) {
    const points = Array.isArray(cell?.points) ? cell.points : [];
    return Math.max(0, points.length - 2);
  }

  partitionRaceTerrainCellsByPriority(cells = [], limit = 0, compare = null) {
    if (!Array.isArray(cells) || cells.length <= 1 || !Number.isFinite(Number(limit)) || limit <= 0 || cells.length <= limit || typeof compare !== 'function') return cells;
    let left = 0;
    let right = cells.length - 1;
    const target = Math.max(0, Math.min(cells.length - 1, Math.floor(limit) - 1));
    while (left < right) {
      const pivotIndex = Math.floor((left + right) / 2);
      const pivotValue = cells[pivotIndex];
      [cells[pivotIndex], cells[right]] = [cells[right], cells[pivotIndex]];
      let storeIndex = left;
      for (let index = left; index < right; index += 1) {
        if (compare(cells[index], pivotValue) < 0) {
          [cells[storeIndex], cells[index]] = [cells[index], cells[storeIndex]];
          storeIndex += 1;
        }
      }
      [cells[right], cells[storeIndex]] = [cells[storeIndex], cells[right]];
      if (storeIndex === target) break;
      if (storeIndex < target) left = storeIndex + 1;
      else right = storeIndex - 1;
    }
    return cells;
  }

  prewarmRacePlaytestRenderResources() {
    const startMs = this.getNowMs();
    const refs = this.collectSelectedRaceArtRefs();
    let textureRefs = 0;
    if (typeof document !== 'undefined') {
      const renderer = this.getRaceWebGLGroundRenderer(64, 64);
      if (renderer?.gl) {
        refs.forEach((artRef) => {
          if (this.bindRaceWebGLMeshTexture(renderer, artRef, this.lastRaceRenderStats)) textureRefs += 1;
        });
      }
    }
    const tileMap = this.ensureRaceTileMap();
    const baseTileSize = Math.max(1, Number(tileMap?.cellSizeM) || RACE_TILE_MAP_CELL_SIZE_M);
    const renderDebug = this.getRaceRenderDebugSettings();
    const terrainSize = Math.max(renderDebug.detailEnabled === true ? 40 : 120, baseTileSize * (renderDebug.detailEnabled === true ? 8 : 24));
    const runtimeType = this.playtestSession?.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const routeLength = Math.max(1, Number(this.playtestSession?.routeLength || this.getRaceRouteLength()) || 1);
    const worldBake = this.buildRaceWorldBake({
      terrainSize,
      routeLength,
      runtimeType,
      renderDebug,
      textureWorldM: this.getRaceGroundTextureBaseWorldM()
    });
    if (this.playtestSession) this.playtestSession.worldBake = worldBake;
    if (startMs > 0) {
      this.lastRaceRenderStats = {
        ...(this.lastRaceRenderStats || {}),
        prewarmTextureRefs: textureRefs,
        prewarmTerrainChunks: worldBake?.terrainChunks?.length || 0,
        prewarmTerrainCells: worldBake?.terrainCells?.length || 0,
        prewarmRenderMs: Math.max(0, this.getNowMs() - startMs)
      };
    }
  }

  setRaceAiCount(count = 0) {
    const race = this.selectedRace;
    if (!race) return;
    const next = clamp(Math.round(Number(count) || 0), 0, 11);
    race.competition = {
      ...(race.competition || {}),
      mode: next > 0 ? 'ai-race' : 'solo',
      aiDrivers: this.createRaceAiGrid(next),
      playerStartGrid: 1,
      trafficEnabled: false
    };
    this.status = next > 0 ? `AI racers: ${next}` : 'AI racers disabled';
  }

  cycleRaceAiCount() {
    const next = this.getRaceAiCount() >= 11 ? 0 : this.getRaceAiCount() + 1;
    this.setRaceAiCount(next);
  }

  normalizeRaceAiDriver(driver = {}, index = 0) {
    const difficulty = ['easy', 'medium', 'hard', 'expert'].includes(driver.difficulty)
      ? driver.difficulty
      : Number(driver.skill || 0) > 0.85 ? 'expert' : Number(driver.skill || 0) > 0.68 ? 'hard' : Number(driver.skill || 0) > 0.48 ? 'medium' : 'easy';
    const skill = clamp(Number(driver.skill) || ({ easy: 0.38, medium: 0.58, hard: 0.76, expert: 0.92 }[difficulty]), 0.1, 1);
    return {
      id: driver.id || `ai-${index + 1}`,
      name: driver.name || `${difficulty} AI ${index + 1}`,
      carId: driver.carId || this.project.cars[index % Math.max(1, this.project.cars.length)]?.id || 'starter-rwd',
      difficulty,
      skill,
      aggression: clamp(Number(driver.aggression) || ({ easy: 0.28, medium: 0.45, hard: 0.62, expert: 0.78 }[difficulty]), 0, 1),
      rubberBanding: difficulty === 'expert' ? 0 : clamp(Number(driver.rubberBanding ?? 0.1), 0, 0.4),
      enabled: driver.enabled !== false
    };
  }

  createRaceAiRuntime(aiDrivers = [], { routeLength = this.getRaceRouteLength() } = {}) {
    return aiDrivers.slice(0, 11).map((driver, index) => {
      const ai = this.normalizeRaceAiDriver(driver, index);
      const car = this.project.cars.find((candidate) => candidate.id === ai.carId) || this.selectedCar;
      const tuning = this.getRaceCarTuning(car, { transmissionType: ai.difficulty === 'expert' ? 'manual' : this.getRaceTransmissionType(car) });
      return {
        ...ai,
        distance: -Math.max(8, this.getRaceCarWorldWidth(car) * (5 + index * 0.9)),
        projectedDistance: 0,
        lap: 1,
        speedMps: 0,
        gear: 1,
        rpm: tuning.idleRpm,
        lineOffset: (index % 3 - 1) * 0.22,
        bestLapMs: null,
        currentLapMs: 0,
        consistencyError: 0,
        shiftMode: ai.difficulty === 'expert' ? 'manual' : 'automatic',
        routeLength
      };
    });
  }

  createRaceDiagnosticsState(mode = null) {
    return {
      mode: mode || null,
      lateralG: 0,
      peakLateralG: 0,
      zeroToSixtyMs: null,
      sixtyToZeroMs: null,
      quarterMileMs: null,
      quarterMileTrapMph: null,
      slalomGates: [],
      nextSlalomGate: 0,
      suspensionTravel: { fl: 0, fr: 0, rl: 0, rr: 0 },
      tireLoad: { fl: 0, fr: 0, rl: 0, rr: 0 },
      tireTemperature: { fl: 70, fr: 70, rl: 70, rr: 70 },
      jump: { airtimeMs: 0, maxHeightM: 0, landingImpact: 0, stable: true },
      ghostDeltaMs: null,
      ghostSamples: [],
      aiConsistency: []
    };
  }

  startPlaytest(carId = this.project.selectedCarId) {
    const car = this.project.cars.find((candidate) => candidate.id === carId) || this.selectedCar;
    const transmissionType = this.getRaceTransmissionType(car);
    const tuning = this.getRaceCarTuning(car, { transmissionType });
    const initialGear = 1;
    const runtimeType = this.getSelectedRaceRuntimeType();
    const startPose = this.getRaceStartPose(runtimeType);
    const routeLength = this.getRaceRouteLength();
    const startRoadProfile = this.getRaceRoadSurfaceProfileAtDistance(0, {
      runtimeType,
      routeLength,
      allowVisualExtension: true
    });
    const checkpointDistances = this.getRaceCheckpointDistances({ routeLength });
    const initialCheckpointIndex = checkpointDistances.findIndex((distance) => distance > Math.max(8, this.getRaceCarWorldWidth() * 2));
    const startBackDistance = Math.max(7.5, this.getRaceCarWorldWidth(car) * 4.2);
    const startForwardX = Math.sin(startPose.yaw);
    const startForwardZ = Math.cos(startPose.yaw);
    this.project.selectedCarId = car.id;
    this.playtestPickerOpen = false;
    this.preRaceTuningOpen = false;
    this.gamepadSubmenuOpen = false;
    const aiDrivers = this.selectedRace.competition?.aiDrivers?.filter((driver) => driver.enabled) || [];
    const hazards = this.selectedRace.hazards || [];
    const diagnosticMode = this.pendingDiagnosticMode || this.selectedRace.diagnosticMode || null;
    const normalizedAiDrivers = aiDrivers.slice(0, 11).map((driver, index) => this.normalizeRaceAiDriver(driver, index));
    this.playtestSession = {
      raceId: this.selectedRace.id,
      carId: car.id,
      startedAt: Date.now(),
      elapsedMs: 0,
      distance: 0,
      projectedDistance: -startBackDistance,
      routeStartDistance: 0,
      startBackDistance,
      speedMps: 0,
      routeLength,
      routeRuntimeType: runtimeType,
      running: true,
      worldX: startPose.x - startForwardX * startBackDistance,
      worldZ: startPose.z - startForwardZ * startBackDistance,
      launchLockMs: 420,
      cameraView: this.raceInput.cameraView,
      steeringWheel: 0,
      steeringTarget: 0,
      analogSteeringIntent: 0,
      lateral: 0,
      heading: 0,
      carYaw: startPose.yaw,
      velocityYaw: startPose.yaw,
      yawVelocityRadps: 0,
      startYaw: startPose.yaw,
      cameraYaw: startPose.yaw,
      roadViewOffset: 0,
      trackViewOffset: 0,
      heightM: Number(startRoadProfile.elevation || startPose.elevation || 0) * RACE_THREE_ELEVATION_M,
      verticalVelocityMps: 0,
      grounded: true,
      airborne: false,
      rollRad: 0,
      pitchRad: 0,
      rollRate: 0,
      rolledOver: false,
      engineRpm: tuning.idleRpm,
      gear: initialGear,
      transmissionType,
      rpm: 0,
      lap: 1,
      checkpointDistances,
      checkpointCount: checkpointDistances.length,
      checkpointIndex: initialCheckpointIndex >= 0 ? initialCheckpointIndex : 0,
      passedCheckpoints: [],
      shiftCooldownMs: 0,
      damagedGears: [],
      triggeredHazardIds: [],
      triggeredSceneryIds: [],
      damage: this.createRaceDamageState(),
      handbrakeMs: 0,
      handbrakeSlipMs: 0,
      absEnabled: this.raceInput.absEnabled !== false,
      tractionControlEnabled: this.raceInput.tractionControlEnabled !== false,
      telemetryVisible: this.raceInput.telemetryVisible === true,
      engineSoundId: car.audio?.engineSoundId || tuning.engineSoundId || null,
      engineSoundProfile: this.getRaceEngineProfileForTransmission(car, tuning),
      diagnosticMode,
      diagnostics: this.createRaceDiagnosticsState(diagnosticMode),
      aiDrivers: normalizedAiDrivers,
      aiRuntime: this.createRaceAiRuntime(normalizedAiDrivers, { routeLength }),
      ghostRecording: [],
      activeGhost: this.bestRaceGhosts?.[this.selectedRace.id] || null,
      tireFxParticles: [],
      tireFxEmitAccumulators: {},
      tireFxParticleSequence: 0,
      hazards,
      codriverCalls: [],
      eventLog: [
        normalizedAiDrivers.length ? `${normalizedAiDrivers.length} AI racers enabled` : 'Solo playtest',
        hazards.length ? `${hazards.length} race hazards loaded` : 'No hazards enabled',
        diagnosticMode ? `Diagnostic: ${diagnosticMode}` : 'Co-driver disabled'
      ]
    };
    this.playtestFps = 0;
    this.lastRacePlaytestFpsMs = 0;
    this.raceWebGLTrackDynamicScale = 1;
    if (diagnosticMode === 'slalom') {
      this.playtestSession.diagnostics.slalomGates = [...(this.selectedRace.diagnosticGates || [120, 220, 320, 420, 520, 620])];
    }
    this.resetRaceVehiclePhysicsState({ session: this.playtestSession, car, tuning });
    this.pendingDiagnosticMode = null;
    this.raceInput = {
      ...this.raceInput,
      steeringTarget: 0,
      steeringWheel: 0,
      analogSteeringIntent: 0,
      throttle: false,
      brake: false,
      handbrake: false,
      rawThrottleAxis: 0,
      rawBrakeAxis: 0,
      throttleAxis: 0,
      brakeAxis: 0,
      analogThrottleActive: false,
      analogBrakeActive: false,
      autoShift: tuning.shiftMode !== 'manual',
      transmissionMode: transmissionType,
      absEnabled: this.raceInput.absEnabled !== false,
      tractionControlEnabled: this.raceInput.tractionControlEnabled !== false,
      telemetryVisible: this.raceInput.telemetryVisible === true,
      keyboardThrottle: false,
      keyboardBrake: false,
      keyboardSteer: 0,
      binarySteer: 0,
      digitalSteerHoldMs: 0,
      gear: initialGear,
      lookIntentX: 0,
      lookAngle: 0,
      pauseMenuMode: 'main',
      pauseMenuIndex: 0,
      paused: false,
      analogSteeringActive: false,
      lastSteeringInputMode: null,
      activeDpadPointerId: null,
      activeThrottlePointerId: null,
      activeBrakePointerId: null,
      throttlePulseMs: 0
    };
    this.preloadSelectedRaceArtRefs();
    this.prewarmRacePlaytestRenderResources();
    this.status = `Playtesting ${this.selectedRace.name} in ${car.name}`;
  }

  endPlaytest() {
    if (!this.playtestSession) return;
    const car = this.project.cars.find((candidate) => candidate.id === this.playtestSession.carId) || this.selectedCar;
    this.completeRaceGhost({ finished: false });
    this.playtestSession = null;
    this.resetRacePlaytestInputs();
    this.game?.audio?.setEngineRev?.(false);
    this.game?.audio?.setTireScreech?.(false);
    if (car.audio?.engineSoundId) this.game?.stopSfxById?.(car.audio.engineSoundId, { key: 'race-engine' });
    this.restoreRaceAuthoringMenuState();
    this.status = `Ended playtest for ${car.name}`;
  }

  finishPlaytest() {
    if (!this.playtestSession) return;
    const name = this.selectedRace?.name || 'race';
    const car = this.project.cars.find((candidate) => candidate.id === this.playtestSession.carId) || this.selectedCar;
    this.completeRaceGhost({ finished: true });
    this.playtestSession = null;
    this.resetRacePlaytestInputs();
    this.game?.audio?.setEngineRev?.(false);
    this.game?.audio?.setTireScreech?.(false);
    if (car.audio?.engineSoundId) this.game?.stopSfxById?.(car.audio.engineSoundId, { key: 'race-engine' });
    this.restoreRaceAuthoringMenuState();
    this.status = `Finished ${name}`;
  }

  cancelPlaytestPicker() {
    this.playtestPickerOpen = false;
    this.preRaceTuningOpen = false;
    this.restoreRaceAuthoringMenuState();
    this.status = 'Ready';
  }

  getRaceRouteLength() {
    const segments = this.selectedRace?.road?.segments || [];
    const nodes = this.getRaceEditableNodes({ create: false });
    if (nodes.length >= 2) {
      const samples = this.getRacePathSamplesCached({ step: 18 });
      return Math.max(1, Number(samples.at(-1)?.distance) || 1);
    }
    return Math.max(1, segments.reduce((sum, segment) => sum + Math.max(0, Number(segment.length) || 0), 0));
  }

  getRaceVisualTravelDistance(session = this.playtestSession) {
    const routeLength = Math.max(1, Number(session?.routeLength || this.getRaceRouteLength()));
    const routeRuntimeType = session?.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const rawDistance = Number.isFinite(Number(session?.projectedDistance))
      ? Number(session.projectedDistance)
      : Number(session?.distance || 0);
    if (routeRuntimeType === 'circuit') {
      if (rawDistance < 0) return clamp(rawDistance, -Math.max(0, Number(session?.startBackDistance || 0)), 0);
      return ((rawDistance % routeLength) + routeLength) % routeLength;
    }
    return clamp(rawDistance, -Math.max(0, Number(session?.startBackDistance || 0)), routeLength);
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
    const direction = Math.sign(curve || 1);
    if (segment.turn === 'square') return direction * (Math.PI / 2);
    if (segment.turn === 'junction') return direction * (Math.PI / 2);
    if (segment.turn === 'angled') return direction * (Math.PI / 4);
    return curve * 0.78;
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
      const targetElevation = this.clampRaceElevation(segment?.elevation);
      const delta = clamp(targetElevation - currentElevation, -0.2, 0.2);
      const start = currentElevation;
      const end = this.clampRaceElevation(currentElevation + delta);
      currentElevation = end;
      return { start, end };
    });
  }

  smoothRaceElevationProgress(progress = 0) {
    const t = clamp(Number(progress) || 0, 0, 1);
    return t * t * (3 - 2 * t);
  }

  smoothRacePathSamples(samples = [], { passes = 2 } = {}) {
    if (!Array.isArray(samples) || samples.length < 4) return samples;
    let output = samples.map((sample) => ({ ...sample }));
    const passCount = Math.max(1, Math.floor(Number(passes) || 1));
    for (let pass = 0; pass < passCount; pass += 1) {
      output = output.map((sample, index) => {
        if (index === 0 || index === output.length - 1) return sample;
        const previous = output[index - 1];
        const next = output[index + 1];
        const previousWeight = 0.22;
        const currentWeight = 0.56;
        const nextWeight = 0.22;
        const yawX = Math.sin(previous.yaw) * previousWeight + Math.sin(sample.yaw) * currentWeight + Math.sin(next.yaw) * nextWeight;
        const yawZ = Math.cos(previous.yaw) * previousWeight + Math.cos(sample.yaw) * currentWeight + Math.cos(next.yaw) * nextWeight;
        return {
          ...sample,
          yaw: Math.atan2(yawX, yawZ),
          elevation: this.clampRaceElevation(
            Number(previous.elevation || 0) * previousWeight
              + Number(sample.elevation || 0) * currentWeight
              + Number(next.elevation || 0) * nextWeight
          )
        };
      });
    }
    return output;
  }

  getRaceNodeWorldPoint(node = {}) {
    return {
      x: Number(node.x || 0),
      z: Number(node.y || 0),
      elevation: this.clampRaceElevation(node.elevation)
    };
  }

  getRaceForwardVector(yaw = 0) {
    return {
      x: Math.sin(Number(yaw) || 0),
      z: Math.cos(Number(yaw) || 0)
    };
  }

  getRaceRightVector(yaw = 0) {
    return {
      x: -Math.cos(Number(yaw) || 0),
      z: Math.sin(Number(yaw) || 0)
    };
  }

  getRaceNodeCornerPlan(nodes = [], nodeIndex = 0, { step = 18, segments = this.selectedRace?.road?.segments || [] } = {}) {
    if (nodeIndex <= 0 || nodeIndex >= nodes.length - 1) return null;
    const previous = this.getRaceNodeWorldPoint(nodes[nodeIndex - 1]);
    const current = this.getRaceNodeWorldPoint(nodes[nodeIndex]);
    const next = this.getRaceNodeWorldPoint(nodes[nodeIndex + 1]);
    const inDx = current.x - previous.x;
    const inDz = current.z - previous.z;
    const outDx = next.x - current.x;
    const outDz = next.z - current.z;
    const inLength = Math.hypot(inDx, inDz);
    const outLength = Math.hypot(outDx, outDz);
    if (inLength < 4 || outLength < 4) return null;
    const incoming = { x: inDx / inLength, z: inDz / inLength };
    const outgoing = { x: outDx / outLength, z: outDz / outLength };
    const bend = Math.acos(clamp(incoming.x * outgoing.x + incoming.z * outgoing.z, -1, 1));
    if (!Number.isFinite(bend) || bend < 0.08) return null;
    const previousSegment = segments[nodeIndex - 1] || null;
    const nextSegment = segments[nodeIndex] || null;
    const sharp = [previousSegment?.turn, nextSegment?.turn].some((turn) => turn === 'square' || turn === 'junction');
    const autoRound = !sharp && bend >= 0.08;
    const roadHalfWidth = Math.max(
      this.getRaceRoadHalfWidthWorld(previousSegment),
      this.getRaceRoadHalfWidthWorld(nextSegment)
    );
    const hardBend = bend >= Math.PI / 2;
    const mediumBend = bend >= Math.PI / 4;
    const distanceScale = hardBend ? 0.48 : mediumBend ? 0.42 : 0.32;
    const maxCornerDistance = hardBend ? 280 : mediumBend ? 240 : 180;
    const minCornerDistance = Math.min(
      inLength,
      outLength,
      Math.max(roadHalfWidth * (sharp ? 1.9 : 1.55), Number(step || 18) * (hardBend ? 1.7 : mediumBend ? 1.35 : 1.05))
    );
    const cornerDistance = Math.min(
      inLength * 0.48,
      outLength * 0.48,
      Math.max(minCornerDistance, Math.min(inLength * distanceScale, outLength * distanceScale, maxCornerDistance))
    );
    if (cornerDistance < 2) return null;
    return {
      sharp,
      autoRound,
      control: current,
      entry: {
        x: current.x - incoming.x * cornerDistance,
        z: current.z - incoming.z * cornerDistance,
        elevation: current.elevation
      },
      exit: {
        x: current.x + outgoing.x * cornerDistance,
        z: current.z + outgoing.z * cornerDistance,
        elevation: current.elevation
      },
      bend,
      minPieces: sharp || hardBend ? 16 : mediumBend ? 12 : 8
    };
  }

  getRacePathSamples({ step = 18 } = {}) {
    const segments = this.selectedRace?.road?.segments || [];
    const requestedStep = Math.max(0.5, Number(step) || 18);
    const nodes = this.getRaceEditableNodes({ create: false });
    if (nodes.length >= 2) {
      const firstPoint = this.getRaceNodeWorldPoint(nodes[0]);
      const secondPoint = this.getRaceNodeWorldPoint(nodes[1]);
      const firstYaw = Math.atan2(secondPoint.x - firstPoint.x, secondPoint.z - firstPoint.z);
      const samples = [{
        distance: 0,
        x: firstPoint.x,
        z: firstPoint.z,
        yaw: Number.isFinite(firstYaw) ? firstYaw : 0,
        elevation: firstPoint.elevation,
        index: 0,
        segment: segments[0] || null,
        progress: 0
      }];
      let distance = 0;
      let cursor = firstPoint;
      const appendLine = (from, to, segment, segmentIndex) => {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const length = Math.hypot(dx, dz);
        if (length < 0.001) return;
        const pieces = Math.max(1, Math.ceil(length / Math.max(0.5, requestedStep)));
        const yaw = Math.atan2(dx, dz);
        for (let piece = 1; piece <= pieces; piece += 1) {
          const t = piece / pieces;
          const previousSample = samples[samples.length - 1];
          const x = from.x + dx * t;
          const z = from.z + dz * t;
          distance += Math.hypot(x - previousSample.x, z - previousSample.z);
          samples.push({
            distance,
            x,
            z,
            yaw,
            elevation: this.clampRaceElevation(
              from.elevation + (to.elevation - from.elevation) * t,
            ),
            index: segmentIndex,
            segment,
            progress: t
          });
        }
      };
      const appendCurve = (entry, control, exit, segment, segmentIndex, bend = 0, minPieces = 3) => {
        const approxLength = Math.hypot(control.x - entry.x, control.z - entry.z) + Math.hypot(exit.x - control.x, exit.z - control.z);
        const explicitMinPieces = Math.max(3, Number(minPieces) || 3);
        const anglePieces = Math.ceil(4 + Math.abs(Number(bend) || 0) * 6);
        const pieces = Math.max(explicitMinPieces, anglePieces, Math.ceil((approxLength * (1 + bend * 0.18)) / Math.max(0.5, requestedStep)));
        for (let piece = 1; piece <= pieces; piece += 1) {
          const t = piece / pieces;
          const inv = 1 - t;
          const x = inv * inv * entry.x + 2 * inv * t * control.x + t * t * exit.x;
          const z = inv * inv * entry.z + 2 * inv * t * control.z + t * t * exit.z;
          const elevation = this.clampRaceElevation(inv * inv * entry.elevation + 2 * inv * t * control.elevation + t * t * exit.elevation);
          const dx = 2 * inv * (control.x - entry.x) + 2 * t * (exit.x - control.x);
          const dz = 2 * inv * (control.z - entry.z) + 2 * t * (exit.z - control.z);
          const previousSample = samples[samples.length - 1];
          distance += Math.hypot(x - previousSample.x, z - previousSample.z);
          samples.push({
            distance,
            x,
            z,
            yaw: Math.atan2(dx, dz),
            elevation,
            index: segmentIndex,
            segment,
            progress: t
          });
        }
      };
      for (let index = 1; index < nodes.length; index += 1) {
        const segment = segments[index - 1] || segments[segments.length - 1] || null;
        const nextPoint = this.getRaceNodeWorldPoint(nodes[index]);
        const corner = this.getRaceNodeCornerPlan(nodes, index, { step, segments });
        const lineEnd = corner ? corner.entry : nextPoint;
        appendLine(cursor, lineEnd, segment, index - 1);
        if (corner) {
          appendCurve(corner.entry, corner.control, corner.exit, segment, index - 1, corner.bend, corner.minPieces);
          cursor = corner.exit;
        } else {
          cursor = nextPoint;
        }
      }
      return this.applyRaceTerrainElevationToPathSamples(
        this.smoothRacePathSamples(samples, { passes: 2 })
      );
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
      const yawDelta = this.getRaceSegmentYawDelta(segment);
      const segmentElevation = elevationProfile[index] || { start: 0, end: 0 };
      const elevationDelta = Math.abs(Number(segmentElevation.end || 0) - Number(segmentElevation.start || 0));
      const bumpiness = clamp(Number(segment.bumpiness) || 0, 0, 1);
      const sampleDensity = 1 + Math.abs(yawDelta) * 0.9 + elevationDelta * 3.2 + bumpiness * 0.9;
      const effectiveStep = Math.max(0.5, requestedStep / sampleDensity);
      const pieces = Math.max(4, Math.ceil(length / effectiveStep));
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
    return this.applyRaceTerrainElevationToPathSamples(
      this.smoothRacePathSamples(samples, { passes: 3 })
    );
  }

  applyRaceTerrainElevationToPathSamples(samples = []) {
    return samples;
  }

  getRacePathSampleCacheSignature(step = 18) {
    const race = this.selectedRace || {};
    const road = race.road || {};
    const nodes = this.getRaceEditableNodes({ create: false });
    const segments = Array.isArray(road.segments) ? road.segments : [];
    const tileMap = this.ensureRaceTileMap(road);
    const tileMapRevision = Number(tileMap?.revision) || 0;
    const groundSignature = (Array.isArray(road.groundTiles) ? road.groundTiles : []).map((patch) => [
      Math.round(Number(patch.x || 0) * 1000),
      Math.round(Number(patch.y || 0) * 1000),
      Math.round(Number(patch.radius || 0) * 1000),
      patch.tileId || '',
      Math.round(Number(patch.elevation || 0) * 1000)
    ].join(':')).join('|');
    const nodeSignature = nodes.map((node) => [
      Math.round(Number(node.x || 0) * 100),
      Math.round(Number(node.y || node.z || 0) * 100),
      Math.round(Number(node.elevation || 0) * 1000),
      node.role || '',
      node.locked ? 1 : 0
    ].join(':')).join('|');
    const segmentSignature = segments.map((segment) => [
      Math.round(Number(segment.length || 0) * 10),
      Math.round(Number(segment.curve || 0) * 1000),
      Math.round(Number(segment.elevation || 0) * 1000),
      segment.surface || '',
      segment.turn || '',
      Math.round(Number(segment.roadWidthM || segment.roadWidth || 0) * 100),
      Math.round(Number(segment.bumpiness || 0) * 1000),
      segment.snowCondition || '',
      segment.edgeTileId || ''
    ].join(':')).join('|');
    return [
      race.id || '',
      Math.round((Number(step) || 18) * 100),
      Math.round(Number(road.width || 0) * 100),
      nodes.length,
      segments.length,
      Math.round(Number(tileMap?.cellSizeM || 0) * 100),
      tileMapRevision,
      nodeSignature,
      segmentSignature,
      groundSignature
    ].join('~');
  }

  getRaceSurfaceGeometryRevisionKey({
    step = 18,
    runtimeType = this.getActiveRaceRuntimeType(),
    allowVisualExtension = false,
    routeLength = null
  } = {}) {
    const race = this.selectedRace || {};
    const road = race.road || {};
    const segments = Array.isArray(road.segments) ? road.segments : [];
    const tileMap = this.ensureRaceTileMap(road);
    const margin = this.ensureRaceMarginSettings();
    const marginMode = RACE_EDGE_DISPLAY_MODE_IDS.has(String(margin.marginMode || '')) ? String(margin.marginMode) : 'on';
    const shoulderMode = RACE_EDGE_DISPLAY_MODE_IDS.has(String(margin.shoulderMode || '')) ? String(margin.shoulderMode) : 'on';
    const routeEnd = Math.max(1, Number(routeLength || this.getRaceRouteLength()) || 1);
    const segmentWidthSignature = segments.map((segment) => [
      Math.round(Number(segment.roadWidthM || segment.roadWidth || road.width || 0) * 100),
      Math.round(this.getRaceRoadHalfWidthWorld(segment) * 100),
      Math.round(this.getRaceBoundaryWidthWorld(segment) * 100),
      Math.round(this.getRaceRoadTerrainBlendWidthWorld(segment) * 100),
      segment.surface || ''
    ].join(':')).join('|');
    return [
      this.getRacePathSampleCacheSignature(step),
      String(runtimeType || ''),
      allowVisualExtension ? 1 : 0,
      Math.round(routeEnd * 10),
      Math.round(Number(road.width || 0) * 100),
      marginMode,
      Math.round(Number(margin.widthM || 0) * 1000),
      shoulderMode,
      Math.round(Number(margin.shoulderWidthM || 0) * 100),
      Math.round(this.getRaceVisibleMarginWidthWorld() * 1000),
      Math.round(this.getRaceShoulderWidthWorld() * 100),
      Math.round(this.getRaceRoadTerrainBlendWidthWorld() * 100),
      Number(tileMap?.revision) || 0,
      segmentWidthSignature
    ].join('~surf~');
  }

  getRacePathSamplesCached({ step = 18 } = {}) {
    const sampleStep = Math.max(1, Number(step) || 18);
    const key = this.getRacePathSampleCacheSignature(sampleStep);
    if (!this.racePathSampleCache) this.racePathSampleCache = new Map();
    const cached = this.racePathSampleCache.get(key);
    if (cached) return cached;
    const samples = this.getRacePathSamples({ step: sampleStep });
    if (this.racePathSampleCache.size > 8) this.racePathSampleCache.clear();
    this.racePathSampleCache.set(key, samples);
    return samples;
  }

  getRaceSampleSpanAtDistance(samples = [], target = 0) {
    if (!Array.isArray(samples) || samples.length < 2) {
      const sample = samples?.[0] || null;
      return { previous: sample, next: sample, t: 0, index: 0 };
    }
    let low = 1;
    let high = samples.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (Number(samples[mid]?.distance || 0) < target) low = mid + 1;
      else high = mid;
    }
    const index = clamp(low, 1, samples.length - 1);
    const previous = samples[index - 1];
    const next = samples[index];
    const span = Math.max(0.001, Number(next.distance || 0) - Number(previous.distance || 0));
    return {
      previous,
      next,
      t: clamp((target - Number(previous.distance || 0)) / span, 0, 1),
      index
    };
  }

  getRaceWorldPoseAtDistance(distance = 0, {
    runtimeType = this.getActiveRaceRuntimeType(),
    samples: providedSamples = null,
    routeLength: providedRouteLength = null,
    allowVisualExtension = false
  } = {}) {
    const samples = Array.isArray(providedSamples) ? providedSamples : this.getRacePathSamplesCached({ step: 10 });
    if (!samples.length) return { distance: 0, x: 0, z: 0, yaw: 0, segment: null, index: 0, progress: 0 };
    const routeLength = Math.max(1, Number(providedRouteLength || samples.at(-1)?.distance || this.getRaceRouteLength()) || 1);
    const requestedDistance = Number(distance) || 0;
    if (runtimeType !== 'circuit' && allowVisualExtension) {
      if (requestedDistance < 0) {
        const first = samples[0];
        const next = samples.find((sample) => Math.hypot(
          Number(sample.x || 0) - Number(first.x || 0),
          Number(sample.z || 0) - Number(first.z || 0)
        ) > 0.5) || samples[1] || first;
        const dx = Number(next.x || 0) - Number(first.x || 0);
        const dz = Number(next.z || 0) - Number(first.z || 0);
        const yaw = Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, dz) : Number(first.yaw || 0);
        return {
          ...first,
          distance: requestedDistance,
          x: Number(first.x || 0) + Math.sin(yaw) * requestedDistance,
          z: Number(first.z || 0) + Math.cos(yaw) * requestedDistance,
          yaw,
          progress: 0
        };
      }
      if (requestedDistance > routeLength) {
        const last = samples[samples.length - 1];
        const previous = [...samples].reverse().find((sample) => Math.hypot(
          Number(sample.x || 0) - Number(last.x || 0),
          Number(sample.z || 0) - Number(last.z || 0)
        ) > 0.5) || samples[samples.length - 2] || last;
        const dx = Number(last.x || 0) - Number(previous.x || 0);
        const dz = Number(last.z || 0) - Number(previous.z || 0);
        const yaw = Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, dz) : Number(last.yaw || 0);
        const overshoot = requestedDistance - routeLength;
        return {
          ...last,
          distance: requestedDistance,
          x: Number(last.x || 0) + Math.sin(yaw) * overshoot,
          z: Number(last.z || 0) + Math.cos(yaw) * overshoot,
          yaw,
          progress: 1
        };
      }
    }
    const target = runtimeType === 'circuit'
      ? (requestedDistance % routeLength + routeLength) % routeLength
      : clamp(requestedDistance, 0, routeLength);
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
    const { previous, next, t } = this.getRaceSampleSpanAtDistance(samples, target);
    if (previous && next) {
      return {
        distance: target,
        x: previous.x + (next.x - previous.x) * t,
        z: previous.z + (next.z - previous.z) * t,
        yaw: previous.yaw + normalizeAngle(next.yaw - previous.yaw) * t,
        elevation: previous.elevation + (next.elevation - previous.elevation) * t,
        index: next.index,
        segment: next.segment,
        progress: next.progress
      };
    }
    return { ...samples[samples.length - 1], distance: target };
  }

  getRaceRouteProjectionForWorldPoint(point = {}) {
    const samples = this.getRacePathSamplesCached({ step: 4 });
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
        const right = this.getRaceRightVector(yaw);
        const span = Math.max(0.001, Number(next.distance || 0) - Number(previous.distance || 0));
        best = {
          distanceSq,
          distance: Number(previous.distance || 0) + span * t,
          x,
          z,
          yaw,
          lateral: offsetX * right.x + offsetZ * right.z,
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
        elevation: this.getRaceGroundElevationAtWorldPoint(
          { x: Number(first.x || 0), z: Number(first.y || 0) },
          this.clampRaceElevation(first.elevation)
        ),
        segment: this.selectedRace?.road?.segments?.[0] || null,
        index: 0,
        progress: 0
      };
    }
    const samples = this.getRacePathSamplesCached({ step: 8 });
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
    const carWidth = this.getRaceCarWorldWidth();
    const authoredWidth = clamp(
      Number(segment?.roadWidthM || segment?.roadWidth || this.selectedRace?.road?.width || 11),
      Math.max(2.2, carWidth * 1.25),
      24
    );
    return authoredWidth * 0.5;
  }

  getRaceRoadWidthToCarRatio(segment = null, car = this.selectedCar) {
    return (this.getRaceRoadHalfWidthWorld(segment) * 2) / Math.max(0.1, this.getRaceCarWorldWidth(car));
  }

  shouldRenderRaceCenterLaneDash(segment = null, car = this.selectedCar) {
    return this.getRaceRoadLaneCount(segment) >= 2 && this.getRaceRoadWidthToCarRatio(segment, car) >= 3.2;
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
    const segment = this.getRaceSegmentAtDistance(this.getRaceVisualTravelDistance()).segment;
    const roadWidth = Math.max(0.1, this.getRaceRoadHalfWidthWorld(segment) * 2);
    const targetRoadWidth = Number(bounds.w || 1) * this.getRaceTargetNearRoadScreenRatio('third-person', segment);
    const carRatio = this.getRaceCarWorldWidth() / roadWidth;
    return clamp(targetRoadWidth * carRatio, 28, Number(bounds.w || 1) * 0.32);
  }

  getRaceThirdPersonChaseDistance(car = this.selectedCar) {
    const dimensions = this.getRaceCarDimensions(car);
    return Math.max(
      14.5,
      Number(dimensions.lengthM || 4.6) * 3.1,
      Number(dimensions.widthM || 1.8) * 7
    );
  }

  getRaceCarDimensions(car = this.selectedCar) {
    const dimensions = car?.dimensions || {};
    const tuning = car?.tuning || {};
    const widthM = clamp(Number(dimensions.widthM || tuning.widthM || 1.83), 1.45, 2.4);
    const wheelbaseM = clamp(Number(dimensions.wheelbaseM || tuning.wheelbaseM || 2.67), 2.1, 3.4);
    const trackFrontM = clamp(Number(dimensions.trackFrontM || dimensions.trackWidthM || tuning.trackFrontM || tuning.trackWidthM || 1.56), 1.2, 2.2);
    const trackRearM = clamp(Number(dimensions.trackRearM || dimensions.trackWidthM || tuning.trackRearM || tuning.trackWidthM || trackFrontM), 1.2, 2.2);
    return {
      lengthM: clamp(Number(dimensions.lengthM || tuning.lengthM || 4.6), 3.2, 6.2),
      widthM,
      wheelbaseM,
      trackFrontM,
      trackRearM,
      trackWidthM: (trackFrontM + trackRearM) * 0.5
    };
  }

  getRaceCarWorldWidth(car = this.selectedCar) {
    return this.getRaceCarDimensions(car).widthM;
  }

  getRaceRoadDeckPointAtDistance(distance = 0, lateralOffset = 0, {
    samples = null,
    routeLength = null,
    runtimeType = this.getActiveRaceRuntimeType(),
    allowVisualExtension = false,
    edge = ''
  } = {}) {
    const center = this.getRaceWorldPoseAtDistance(distance, {
      samples,
      routeLength,
      runtimeType,
      allowVisualExtension
    });
    const right = this.getRaceRightVector(Number(center.yaw || 0));
    const x = Number(center.x || 0) + right.x * Number(lateralOffset || 0);
    const z = Number(center.z || 0) + right.z * Number(lateralOffset || 0);
    const corridor = this.getRaceRoadCorridorSampleAtDistance(distance, {
      samples,
      routeLength,
      runtimeType,
      allowVisualExtension
    });
    const corridorElevation = Number.isFinite(Number(corridor.elevation))
      ? Number(corridor.elevation)
      : Number(center.elevation || 0);
    const elevation = this.clampRaceElevation(corridorElevation);
    return {
      ...center,
      x,
      z,
      elevation,
      edge,
      roadDeckElevation: true,
      roadDistance: distance,
      lateralOffset,
      segment: center.segment || corridor.segment || this.selectedSegment
    };
  }

  getRaceRoadCrossSectionAtDistance(distance = 0, {
    samples = null,
    routeLength = null,
    runtimeType = this.getActiveRaceRuntimeType(),
    allowVisualExtension = false
  } = {}) {
    if (!samples) {
      const baked = this.getRaceSurfaceSectionAtDistance(distance, {
        routeLength,
        runtimeType,
        allowVisualExtension
      });
      return {
        center: baked.center,
        left: baked.left,
        right: baked.right,
        marginLeft: baked.marginLeft,
        marginRight: baked.marginRight,
        shoulderLeft: baked.shoulderLeft,
        shoulderRight: baked.shoulderRight,
        transitionLeft: baked.transitionLeft || baked.terrainLeft,
        transitionRight: baked.transitionRight || baked.terrainRight,
        terrainLeft: baked.terrainLeft || baked.transitionLeft,
        terrainRight: baked.terrainRight || baked.transitionRight,
        metrics: baked.metrics,
        deck: baked.deck
      };
    }
    const center = this.getRaceWorldPoseAtDistance(distance, {
      samples,
      routeLength,
      runtimeType,
      allowVisualExtension
    });
    return this.createRaceSurfaceSectionFromSample({
      ...center,
      distance,
      elevation: this.getRaceRoadCorridorSampleAtDistance(distance, {
        samples,
        routeLength,
        runtimeType,
        allowVisualExtension
      }).elevation
    }, { distance });
  }

  projectRaceWorldPointToCamera(point = {}, camera = {}, cameraYaw = 0, bounds = {}) {
    const dx = Number(point.x || 0) - Number(camera.x || 0);
    const dz = Number(point.z || 0) - Number(camera.z || 0);
    const dy = Number(point.elevation || 0) - Number(camera.elevation || 0);
    const right = this.getRaceRightVector(cameraYaw);
    const forward = this.getRaceForwardVector(cameraYaw);
    const cameraX = dx * right.x + dz * right.z;
    const cameraZ = dx * forward.x + dz * forward.z;
    const focal = Math.max(140, Number(bounds.w || 1) * (Number(camera.focalScale) || 1.04));
    const roadWidthScale = Number(camera.roadWidthScale) || 2.2;
    const roadMaxWidthRatio = clamp(Number(camera.roadMaxWidthRatio) || 0.72, 0.1, 1.35);
    const nearPlane = Math.max(1.2, Number(camera.nearPlane) || 1.6);
    const visible = cameraZ >= nearPlane && Number.isFinite(cameraZ);
    const z = Math.max(nearPlane, cameraZ);
    const screenY = this.projectRaceDepthToScreenY(z, dy, camera, bounds);
    return {
      ...point,
      cameraX,
      cameraY: dy,
      cameraZ,
      renderZ: z,
      clippedToNearPlane: cameraZ <= nearPlane,
      visible,
      screenX: Number(bounds.x || 0) + Number(bounds.w || 1) / 2 + cameraX * roadWidthScale * (focal / Math.max(nearPlane, z)),
      screenY,
      halfWidth: clamp(
        (this.getRaceRoadHalfWidthWorld(point.segment) * roadWidthScale) * (focal / Math.max(38, z)),
        5,
        Number(bounds.w || 1) * roadMaxWidthRatio
      )
    };
  }

  projectRaceCameraSpacePointToScreen(point = {}, camera = {}, bounds = {}) {
    const cameraX = Number(point.cameraX || 0);
    const cameraZ = Number(point.cameraZ || 0);
    const dy = Number(point.cameraY ?? point.elevation ?? 0);
    const focal = Math.max(140, Number(bounds.w || 1) * (Number(camera.focalScale) || 1.04));
    const roadWidthScale = Number(camera.roadWidthScale) || 1;
    const nearPlane = Math.max(1.2, Number(camera.nearPlane) || 1.6);
    const visible = cameraZ >= nearPlane && Number.isFinite(cameraZ);
    const z = Math.max(nearPlane, cameraZ);
    return {
      ...point,
      cameraX,
      cameraY: dy,
      cameraZ,
      renderZ: z,
      clippedToNearPlane: cameraZ <= nearPlane,
      visible,
      screenX: Number(bounds.x || 0) + Number(bounds.w || 1) / 2 + cameraX * roadWidthScale * (focal / Math.max(nearPlane, z)),
      screenY: this.projectRaceDepthToScreenY(z, dy, camera, bounds)
    };
  }

  getRaceNearClippedProjectedPolygon(points = [], camera = {}, bounds = {}) {
    if (!Array.isArray(points) || points.length < 3) return [];
    const nearPlane = Math.max(1.2, Number(camera.nearPlane) || 1.6);
    const clipPoint = (from = {}, to = {}) => this.interpolateRaceNearPlaneClipPoint(from, to, nearPlane, camera, bounds);
    const clipped = [];
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const previous = points[(index + points.length - 1) % points.length];
      if (!current || !previous) continue;
      const currentInside = Number(current.cameraZ || 0) >= nearPlane;
      const previousInside = Number(previous.cameraZ || 0) >= nearPlane;
      if (currentInside !== previousInside) clipped.push(clipPoint(previous, current));
      if (currentInside) clipped.push(current);
    }
    return clipped.filter((point) => point && Number.isFinite(point.screenX) && Number.isFinite(point.screenY));
  }

  projectRaceDepthToScreenY(depth = 1, elevationDelta = 0, camera = {}, bounds = {}) {
    const h = Number(bounds.h || 1);
    const horizon = Number(bounds.y || 0) + h * (Number(camera.horizonRatio) || 0.31);
    const roadDepth = Math.max(1, h * (Number(camera.roadDepthRatio) || 0.7));
    const nearPlane = Math.max(1.2, Number(camera.nearPlane) || 1.6);
    const z = Math.max(nearPlane, Number(depth) || nearPlane);
    const nearDepth = Math.max(nearPlane, 6.8);
    const perspective = Math.pow(nearDepth / (z + nearDepth), 0.542);
    const screenY = horizon + roadDepth * perspective;
    const heightScale = 0.22 + 1.42 * perspective;
    return screenY - Number(elevationDelta || 0) * h * heightScale;
  }

  getRaceCameraEyeHeight(cameraView = 'third-person') {
    return cameraView === 'first-person' ? 0.1 : 0.32;
  }

  getRaceThirdPersonCarAnchorY(bounds = {}, projectedContact = null) {
    const fallback = Number(bounds.y || 0) + Number(bounds.h || 1) * 0.74;
    const projectedY = Number(projectedContact?.screenY);
    if (!Number.isFinite(projectedY)) return fallback;
    return clamp(
      projectedY + Number(bounds.h || 1) * 0.11,
      Number(bounds.y || 0) + Number(bounds.h || 1) * 0.66,
      Number(bounds.y || 0) + Number(bounds.h || 1) * 0.84
    );
  }

  getRaceThreeCameraFov(cameraView = 'third-person') {
    return cameraView === 'first-person' ? 58 : 48;
  }

  getRaceCameraProjectionProfile(cameraView = 'third-person', speedFactor = 0) {
    const speed = clamp(Number(speedFactor) || 0, 0, 1);
    if (cameraView === 'first-person') {
      return {
        roadWidthScale: 3.5 - speed * 0.72,
        roadMaxWidthRatio: 0.92,
        focalScale: 0.72 + speed * 0.1,
        roadDepthRatio: 0.74 - speed * 0.08
      };
    }
    return {
      roadWidthScale: 2.08 - speed * 0.06,
      roadMaxWidthRatio: 0.52,
      focalScale: 0.96 + speed * 0.24,
      roadDepthRatio: 0.64 - speed * 0.06
    };
  }

  getRaceTargetNearRoadScreenRatio(cameraView = 'third-person', segment = null) {
    const laneCount = this.getRaceRoadLaneCount(segment);
    if (cameraView === 'first-person') {
      return clamp(0.96 + Math.max(0, laneCount - 1) * 0.08, 0.9, 1.22);
    }
    return clamp(0.5 + Math.max(0, laneCount - 1) * 0.07, 0.45, 0.84);
  }

  getRaceCameraPitchProfile({
    visualTravel = 0,
    routeRuntimeType = this.getActiveRaceRuntimeType(),
    speedMps = 0,
    session = this.playtestSession
  } = {}) {
    const speedFactor = clamp(Math.abs(Number(speedMps) || 0) / 60, 0, 1);
    const closeAhead = this.getRaceWorldPoseAtDistance(Number(visualTravel || 0) + 82, { runtimeType: routeRuntimeType });
    const farAhead = this.getRaceWorldPoseAtDistance(Number(visualTravel || 0) + 230, { runtimeType: routeRuntimeType });
    const behind = this.getRaceWorldPoseAtDistance(Number(visualTravel || 0) - 38, { runtimeType: routeRuntimeType });
    const closeDelta = Number(closeAhead.elevation || 0) - Number(behind.elevation || 0);
    const farDelta = Number(farAhead.elevation || 0) - Number(behind.elevation || 0);
    const verticalCue = clamp(Number(session?.verticalVelocityMps || 0) / 28, -0.18, 0.18);
    const hillPitch = clamp(closeDelta * 1.15 + farDelta * 0.52 + verticalCue, -0.34, 0.34);
    return {
      hillPitch,
      horizonRatio: clamp(0.31 - speedFactor * 0.04 - hillPitch * 0.16, 0.16, 0.48),
      nearPlaneBoost: Math.abs(closeDelta) * 0.52 + Math.abs(farDelta) * 0.24,
      closeDelta,
      farDelta
    };
  }

  getRaceCameraRouteSampleDirection(cameraYaw = 0, routeYaw = 0) {
    return Math.cos(normalizeAngle(Number(cameraYaw || 0) - Number(routeYaw || 0))) < 0 ? -1 : 1;
  }

  constrainRaceProjectedRoadSectionWidth(projected = {}, bounds = {}, camera = {}) {
    if (!projected?.center || !projected?.left || !projected?.right) return projected;
    const width = Math.hypot(
      Number(projected.right.screenX || 0) - Number(projected.left.screenX || 0),
      Number(projected.right.screenY || 0) - Number(projected.left.screenY || 0)
    );
    const maxWidth = Math.max(1, Number(bounds.w || 1) * clamp(Number(camera.roadMaxWidthRatio) || 1, 0.1, 1.35));
    if (!Number.isFinite(width) || width <= maxWidth) return projected;
    const scale = maxWidth / width;
    const shrink = (point = {}) => ({
      ...point,
      screenX: Number(projected.center.screenX || 0) + (Number(point.screenX || 0) - Number(projected.center.screenX || 0)) * scale,
      screenY: Number(projected.center.screenY || 0) + (Number(point.screenY || 0) - Number(projected.center.screenY || 0)) * scale
    });
    return {
      ...projected,
      left: shrink(projected.left),
      right: shrink(projected.right),
      marginLeft: projected.marginLeft ? shrink(projected.marginLeft) : projected.marginLeft,
      marginRight: projected.marginRight ? shrink(projected.marginRight) : projected.marginRight,
      shoulderLeft: projected.shoulderLeft ? shrink(projected.shoulderLeft) : projected.shoulderLeft,
      shoulderRight: projected.shoulderRight ? shrink(projected.shoulderRight) : projected.shoulderRight,
      transitionLeft: projected.transitionLeft ? shrink(projected.transitionLeft) : projected.transitionLeft,
      transitionRight: projected.transitionRight ? shrink(projected.transitionRight) : projected.transitionRight,
      terrainLeft: projected.terrainLeft ? shrink(projected.terrainLeft) : projected.terrainLeft,
      terrainRight: projected.terrainRight ? shrink(projected.terrainRight) : projected.terrainRight
    };
  }

  getRaceRenderSampleDistances({ visualTravel = 0, routeLength = this.getRaceRouteLength(), routeRuntimeType = this.getSelectedRaceRuntimeType(), nearDistance = 1, viewDistance = 1200 } = {}) {
    const entries = [];
    const routeEnd = Math.max(1, Number(routeLength) || 1);
    const backDistance = Math.min(360, Math.max(110, Number(viewDistance || 0) * 0.22));
    const sampleCount = 82;
    for (let index = 0; index <= sampleCount; index += 1) {
      const t = index / sampleCount;
      const signedOffset = -backDistance + Math.pow(t, 1.22) * (backDistance + Math.max(140, Number(viewDistance) || 1200));
      const rawDistance = Number(visualTravel || 0) + signedOffset;
      if (routeRuntimeType === 'circuit') {
        entries.push({ offset: signedOffset, distance: ((rawDistance % routeEnd) + routeEnd) % routeEnd });
      } else if (rawDistance >= 0 && rawDistance <= routeEnd) {
        entries.push({ offset: signedOffset, distance: clamp(rawDistance, 0, routeEnd) });
      }
    }
    const current = routeRuntimeType === 'circuit'
      ? ((Number(visualTravel || 0) % routeEnd) + routeEnd) % routeEnd
      : clamp(Number(visualTravel || 0), 0, routeEnd);
    const near = routeRuntimeType === 'circuit'
      ? ((current + Math.max(0.5, Number(nearDistance) || 1)) % routeEnd + routeEnd) % routeEnd
      : clamp(current + Math.max(0.5, Number(nearDistance) || 1), 0, routeEnd);
    entries.push({ offset: Math.max(0.5, Number(nearDistance) || 1), distance: near });
    const seen = new Set();
    return entries
      .sort((a, b) => a.offset - b.offset)
      .map((entry) => Math.round(entry.distance * 100) / 100)
      .filter((distance) => {
        const key = String(distance);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  getRaceStableRoadSections({
    bounds = {},
    camera = {},
    cameraYaw = 0,
    visualTravel = 0,
    routeLength = this.getRaceRouteLength(),
    routeRuntimeType = this.getSelectedRaceRuntimeType(),
    nearDistance = 1,
    viewDistance = 1200,
    backDistance = 0
  } = {}) {
    const routeEnd = Math.max(1, Number(routeLength) || 1);
    const travel = Number(visualTravel || 0);
    const allowVisualExtension = routeRuntimeType !== 'circuit';
    const visualExtension = allowVisualExtension ? RACE_DESTINATION_VISUAL_EXTENSION_M : 0;
    const back = Math.max(
      Number(backDistance) || 0,
      Number(camera?.nearPlane || 1.6) * 5,
      18
    );
    const far = Math.max(120, Number(viewDistance) || 1200);
    const minRawDistance = travel - back;
    const maxRawDistance = travel + far;
    const minAllowed = routeRuntimeType === 'circuit' ? minRawDistance : -visualExtension;
    const maxAllowed = routeRuntimeType === 'circuit' ? maxRawDistance : routeEnd + visualExtension;
    const sectionsByKey = new Map();
    const renderDebug = this.getRaceRenderDebugSettings();
    const detailEnabled = renderDebug.detailEnabled === true;
    const nearSpan = detailEnabled ? 220 : 180;
    const midSpan = detailEnabled ? 650 : 520;
    const nearStep = detailEnabled ? 4 : 10;
    const midStep = detailEnabled ? 8 : 32;
    const farStep = detailEnabled ? 16 : 80;
    const addDistance = (rawDistance) => {
      if (!Number.isFinite(rawDistance)) return;
      if (rawDistance < minRawDistance - 0.001 || rawDistance > maxRawDistance + 0.001) return;
      if (routeRuntimeType !== 'circuit' && (rawDistance < minAllowed - 0.001 || rawDistance > maxAllowed + 0.001)) return;
      const key = Math.round(rawDistance * 1000) / 1000;
      if (sectionsByKey.has(key)) return;
      const routeDistance = routeRuntimeType === 'circuit'
        ? ((rawDistance % routeEnd) + routeEnd) % routeEnd
        : clamp(rawDistance, minAllowed, maxAllowed);
      const section = this.getRaceRoadCrossSectionAtDistance(routeDistance, {
        routeLength: routeEnd,
        runtimeType: routeRuntimeType,
        allowVisualExtension
      });
      let projected = {
        index: sectionsByKey.size,
        routeOrder: rawDistance - travel,
        distance: rawDistance,
        routeDistance,
        center: this.projectRaceWorldPointToCamera(section.center, camera, cameraYaw, bounds),
        left: this.projectRaceWorldPointToCamera(section.left, camera, cameraYaw, bounds),
        right: this.projectRaceWorldPointToCamera(section.right, camera, cameraYaw, bounds),
        marginLeft: section.marginLeft ? this.projectRaceWorldPointToCamera(section.marginLeft, camera, cameraYaw, bounds) : null,
        marginRight: section.marginRight ? this.projectRaceWorldPointToCamera(section.marginRight, camera, cameraYaw, bounds) : null,
        shoulderLeft: this.projectRaceWorldPointToCamera(section.shoulderLeft, camera, cameraYaw, bounds),
        shoulderRight: this.projectRaceWorldPointToCamera(section.shoulderRight, camera, cameraYaw, bounds),
        transitionLeft: section.transitionLeft ? this.projectRaceWorldPointToCamera(section.transitionLeft, camera, cameraYaw, bounds) : null,
        transitionRight: section.transitionRight ? this.projectRaceWorldPointToCamera(section.transitionRight, camera, cameraYaw, bounds) : null,
        terrainLeft: section.terrainLeft ? this.projectRaceWorldPointToCamera(section.terrainLeft, camera, cameraYaw, bounds) : null,
        terrainRight: section.terrainRight ? this.projectRaceWorldPointToCamera(section.terrainRight, camera, cameraYaw, bounds) : null
      };
      projected = this.constrainRaceProjectedRoadSectionWidth(projected, bounds, camera);
      [
        projected.center,
        projected.left,
        projected.right,
        projected.marginLeft,
        projected.marginRight,
        projected.shoulderLeft,
        projected.shoulderRight,
        projected.transitionLeft,
        projected.transitionRight,
        projected.terrainLeft,
        projected.terrainRight
      ].forEach((point) => {
        if (!point) return;
        point.distance = rawDistance;
        point.routeDistance = routeDistance;
        point.routeOrder = rawDistance - travel;
      });
      sectionsByKey.set(key, projected);
    };
    const addAnchoredRange = (fromOffset, toOffset, step) => {
      const start = travel + Number(fromOffset || 0);
      const end = travel + Number(toOffset || 0);
      const effectiveStep = Math.max(1, Number(step) || 4);
      const first = Math.floor(Math.min(start, end) / effectiveStep) * effectiveStep;
      const last = Math.ceil(Math.max(start, end) / effectiveStep) * effectiveStep;
      for (let distance = first; distance <= last + 0.001; distance += effectiveStep) {
        addDistance(distance);
      }
    };
    addAnchoredRange(-back, Math.min(far, nearSpan), nearStep);
    if (far > nearSpan) addAnchoredRange(nearSpan, Math.min(far, midSpan), midStep);
    if (far > midSpan) addAnchoredRange(midSpan, far, farStep);
    addDistance(travel);
    addDistance(travel + Math.max(0.5, Number(nearDistance) || 1));
    if (routeRuntimeType !== 'circuit') {
      addDistance(0);
      addDistance(routeEnd);
    }
    return [...sectionsByKey.values()]
      .sort((a, b) => Number(a.routeOrder || 0) - Number(b.routeOrder || 0))
      .map((section, index) => ({ ...section, index }));
  }

  getRaceStableRoadBands(sections = []) {
    const bands = [];
    if (!Array.isArray(sections) || sections.length < 2) return bands;
    for (let index = 0; index < sections.length - 1; index += 1) {
      const near = sections[index];
      const far = sections[index + 1];
      if (!near?.center || !far?.center || !near.left || !near.right || !far.left || !far.right) continue;
      const orderDelta = Math.abs(Number(far.routeOrder || 0) - Number(near.routeOrder || 0));
      if (!Number.isFinite(orderDelta) || orderDelta < 0.25 || orderDelta > 26) continue;
      const nearZ = Number(near.center.renderZ || near.center.cameraZ || 0);
      const farZ = Number(far.center.renderZ || far.center.cameraZ || 0);
      const minZ = Math.min(nearZ, farZ);
      const maxZ = Math.max(nearZ, farZ);
      bands.push({
        index,
        near,
        far,
        minZ,
        maxZ,
        avgZ: (nearZ + farZ) / 2,
        area: this.getRaceProjectedQuadArea({ near, far })
      });
    }
    return bands;
  }

  getRaceRoadTerrainBlendWidthWorld(segment = null) {
    const roadHalfWidth = this.getRaceRoadHalfWidthWorld(segment);
    const shoulderWidth = this.getRaceShoulderWidthWorld(segment);
    const minimumBlend = RACE_ROAD_TERRAIN_FLAT_JOIN_WIDTH_M + RACE_ROAD_TERRAIN_SLOPE_BLEND_WIDTH_M;
    if (shoulderWidth <= 0) return Math.max(minimumBlend, roadHalfWidth * 0.08);
    return Math.max(minimumBlend, 8, roadHalfWidth * 0.65, shoulderWidth * 1.75);
  }

  getRaceRoadsideTerrainOuterPoint(section = null, side = 'left', extraWidth = 8) {
    const shoulderEdge = side === 'left' ? section?.shoulderLeft : section?.shoulderRight;
    const center = section?.center || shoulderEdge;
    if (!shoulderEdge || !center) return null;
    const sign = side === 'left' ? -1 : 1;
    const right = this.getRaceRightVector(Number(center.yaw || 0));
    const x = Number(shoulderEdge.x || 0) + right.x * sign * Math.max(0, Number(extraWidth) || 0);
    const z = Number(shoulderEdge.z ?? shoulderEdge.y ?? 0) + right.z * sign * Math.max(0, Number(extraWidth) || 0);
    return {
      ...shoulderEdge,
      x,
      z,
      y: z,
      edge: `terrain-${side}-outer`,
      lateralOffset: Number(shoulderEdge.lateralOffset || 0) + sign * Math.max(0, Number(extraWidth) || 0),
      elevation: this.clampRaceElevation(this.getRaceGroundElevationAtWorldPoint({ x, z }, Number(shoulderEdge.elevation || 0))),
      roadDeckElevation: false
    };
  }

  getRaceTerrainMaterialForWorldPoints(points = [], {
    fallbackArtRef = '',
    fallbackColor = '#315734',
    useSunShading = false
  } = {}) {
    const valid = Array.isArray(points)
      ? points.filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.z ?? point?.y)))
      : [];
    const center = valid.length
      ? {
        x: valid.reduce((sum, point) => sum + Number(point.x || 0), 0) / valid.length,
        z: valid.reduce((sum, point) => sum + Number(point.z ?? point.y ?? 0), 0) / valid.length
      }
      : null;
    const tileMap = this.ensureRaceTileMap();
    const cell = center ? this.getRaceTileMapCellAtWorldPoint(center) : null;
    const palette = this.getRaceWeightedGroundTilePalette(
      cell?.tileWeights,
      cell?.tileId || tileMap?.defaultTileId || 'grass'
    );
    const artRef = String(cell?.artRef || cell?.tileArtRef || fallbackArtRef || '').trim();
    const color = artRef
      ? (useSunShading ? this.getRaceTextureSunTint(valid) : '#ffffff')
      : (useSunShading
        ? this.getRaceTerrainSunTint(valid, palette.groundA || fallbackColor)
        : (palette.groundA || fallbackColor));
    return {
      color,
      artRef,
      textured: Boolean(artRef),
      tileCell: cell,
      palette
    };
  }

  getRaceRoadsideTerrainBlendMeshes(trackBands = [], {
    currentSegment = null,
    routeLength = null,
    runtimeType = this.getActiveRaceRuntimeType(),
    allowVisualExtension = false,
    useSunShading = false,
    minScreenY = null,
    artRef = '',
    textured = false,
    textureWorldM = 2.5
  } = {}) {
    if (!Array.isArray(trackBands) || !trackBands.length) return [];
    const meshes = [];
    const makeFlatJoinPoint = (section = null, side = 'left') => {
      if (!section?.center) return null;
      const metrics = section.metrics || this.getRaceTrackCorridorMetrics(section.center, section.center.segment);
      const edge = side === 'left' ? section.shoulderLeft : section.shoulderRight;
      if (!edge) return null;
      const sign = side === 'left' ? -1 : 1;
      const flatJoinWidth = Math.max(0, Math.min(
        Number(metrics.flatJoinWidth || RACE_ROAD_TERRAIN_FLAT_JOIN_WIDTH_M),
        Number(metrics.transitionWidth || RACE_ROAD_TERRAIN_FLAT_JOIN_WIDTH_M)
      ));
      const lateralOffset = sign * (Math.max(0, Number(metrics.hardHalfWidth || Math.abs(Number(edge.lateralOffset || 0)))) + flatJoinWidth);
      const right = this.getRaceRightVector(Number(section.center.yaw || edge.yaw || 0));
      const x = Number(section.center.x || 0) + right.x * lateralOffset;
      const z = Number(section.center.z || section.center.y || 0) + right.z * lateralOffset;
      return {
        ...edge,
        x,
        z,
        y: z,
        edge: `terrain-flat-${side}`,
        lateralOffset,
        roadDeckElevation: false,
        elevation: this.clampRaceElevation(Number(edge.elevation || section.center.elevation || 0))
      };
    };
    for (let index = 0; index < trackBands.length; index += 1) {
      const quad = trackBands[index];
      const span = 1;
      const endIndex = Math.min(trackBands.length - 1, index + span - 1);
      const endQuad = trackBands[endIndex];
      const { near, far } = quad || {};
      const farSection = endQuad?.far || far;
      if (!near?.shoulderLeft || !near?.shoulderRight || !farSection?.shoulderLeft || !farSection?.shoulderRight) {
        continue;
      }
      const nearDistance = Number(near.center?.routeDistance ?? near.center?.distance ?? near.routeDistance ?? near.distance ?? 0);
      const farDistance = Number(farSection.center?.routeDistance ?? farSection.center?.distance ?? farSection.routeDistance ?? farSection.distance ?? nearDistance);
      const bakedNear = this.getRaceSurfaceSectionAtDistance(nearDistance, { routeLength, runtimeType, allowVisualExtension });
      const bakedFar = this.getRaceSurfaceSectionAtDistance(farDistance, { routeLength, runtimeType, allowVisualExtension });
      const nearTransitionLeft = bakedNear?.transitionLeft || bakedNear?.terrainLeft;
      const nearTransitionRight = bakedNear?.transitionRight || bakedNear?.terrainRight;
      const farTransitionLeft = bakedFar?.transitionLeft || bakedFar?.terrainLeft;
      const farTransitionRight = bakedFar?.transitionRight || bakedFar?.terrainRight;
      if (!nearTransitionLeft || !nearTransitionRight || !farTransitionLeft || !farTransitionRight) {
        index = endIndex;
        continue;
      }
      const segment = bakedNear?.center?.segment || near?.center?.segment || far?.center?.segment || currentSegment;
      const groundPalette = this.getRaceGroundPaletteForSegment(segment, near?.center);
      const farFlatLeft = makeFlatJoinPoint(bakedFar, 'left');
      const nearFlatLeft = makeFlatJoinPoint(bakedNear, 'left');
      const farFlatRight = makeFlatJoinPoint(bakedFar, 'right');
      const nearFlatRight = makeFlatJoinPoint(bakedNear, 'right');
      const leftFlatPoints = farFlatLeft && nearFlatLeft
        ? [farFlatLeft, bakedFar.shoulderLeft, bakedNear.shoulderLeft, nearFlatLeft]
        : [];
      const rightFlatPoints = farFlatRight && nearFlatRight
        ? [bakedFar.shoulderRight, farFlatRight, nearFlatRight, bakedNear.shoulderRight]
        : [];
      const leftPoints = farFlatLeft && nearFlatLeft
        ? [farTransitionLeft, farFlatLeft, nearFlatLeft, nearTransitionLeft]
        : [farTransitionLeft, bakedFar.shoulderLeft, bakedNear.shoulderLeft, nearTransitionLeft];
      const rightPoints = farFlatRight && nearFlatRight
        ? [farFlatRight, farTransitionRight, nearTransitionRight, nearFlatRight]
        : [bakedFar.shoulderRight, farTransitionRight, nearTransitionRight, bakedNear.shoulderRight];
      const leftMaterial = this.getRaceTerrainMaterialForWorldPoints([farTransitionLeft, nearTransitionLeft], {
        fallbackArtRef: artRef,
        fallbackColor: groundPalette.shoulderA,
        useSunShading
      });
      const rightMaterial = this.getRaceTerrainMaterialForWorldPoints([farTransitionRight, nearTransitionRight], {
        fallbackArtRef: artRef,
        fallbackColor: groundPalette.shoulderA,
        useSunShading
      });
      if (leftFlatPoints.length) {
        meshes.push({
          source: 'terrain-roadside-flat-left',
          points: leftFlatPoints,
          color: leftMaterial.color,
          artRef: leftMaterial.artRef,
          textured: Boolean(textured && leftMaterial.artRef),
          textureWorldM,
          depthOffset: -0.03,
          threeLiftM: RACE_THREE_LIFTS_M.terrain,
          minScreenY
        });
      }
      if (rightFlatPoints.length) {
        meshes.push({
          source: 'terrain-roadside-flat-right',
          points: rightFlatPoints,
          color: rightMaterial.color,
          artRef: rightMaterial.artRef,
          textured: Boolean(textured && rightMaterial.artRef),
          textureWorldM,
          depthOffset: -0.03,
          threeLiftM: RACE_THREE_LIFTS_M.terrain,
          minScreenY
        });
      }
      meshes.push({
        source: 'terrain-roadside-left',
        points: leftPoints,
        color: leftMaterial.color,
        artRef: leftMaterial.artRef,
        textured: Boolean(textured && leftMaterial.artRef),
        textureWorldM,
        depthOffset: -0.03,
        threeLiftM: RACE_THREE_LIFTS_M.terrain,
        minScreenY
      });
      meshes.push({
        source: 'terrain-roadside-right',
        points: rightPoints,
        color: rightMaterial.color,
        artRef: rightMaterial.artRef,
        textured: Boolean(textured && rightMaterial.artRef),
        textureWorldM,
        depthOffset: -0.03,
        threeLiftM: RACE_THREE_LIFTS_M.terrain,
        minScreenY
      });
      index = endIndex;
    }
    return meshes;
  }

  getRaceShoulderSurfaceMeshesForBand(quad = null, {
    currentSegment = null,
    fallbackArtRef = '',
    texturesEnabled = true,
    textureWorldM = 2.5,
    useSunShading = false,
    minScreenY = null
  } = {}) {
    if (!this.isRaceShoulderVisible()) return [];
    const { near, far } = quad || {};
    if (!near?.shoulderLeft || !near?.shoulderRight || !far?.shoulderLeft || !far?.shoulderRight) return [];
    const segment = near?.center?.segment || currentSegment;
    const groundPalette = this.getRaceGroundPaletteForSegment(segment, near?.center);
    const nearLeftInner = this.isRaceMarginVisible() ? (near.marginLeft || near.left) : near.left;
    const farLeftInner = this.isRaceMarginVisible() ? (far.marginLeft || far.left) : far.left;
    const nearRightInner = this.isRaceMarginVisible() ? (near.marginRight || near.right) : near.right;
    const farRightInner = this.isRaceMarginVisible() ? (far.marginRight || far.right) : far.right;
    if (!nearLeftInner || !farLeftInner || !nearRightInner || !farRightInner) return [];
    const leftShoulderPoints = [far.shoulderLeft, farLeftInner, nearLeftInner, near.shoulderLeft];
    const rightShoulderPoints = [farRightInner, far.shoulderRight, near.shoulderRight, nearRightInner];
    const leftTerrainMaterial = this.getRaceTerrainMaterialForWorldPoints([
      far.transitionLeft || far.shoulderLeft,
      near.transitionLeft || near.shoulderLeft
    ].filter(Boolean), {
      fallbackArtRef,
      fallbackColor: groundPalette.shoulderA,
      useSunShading
    });
    const rightTerrainMaterial = this.getRaceTerrainMaterialForWorldPoints([
      far.transitionRight || far.shoulderRight,
      near.transitionRight || near.shoulderRight
    ].filter(Boolean), {
      fallbackArtRef,
      fallbackColor: groundPalette.shoulderA,
      useSunShading
    });
    return [
      {
        source: 'shoulder-left',
        points: leftShoulderPoints,
        color: leftTerrainMaterial.color,
        artRef: leftTerrainMaterial.artRef,
        textured: Boolean(texturesEnabled && leftTerrainMaterial.artRef),
        textureWorldM,
        depthOffset: -0.045,
        threeLiftM: RACE_THREE_LIFTS_M.shoulder,
        minScreenY
      },
      {
        source: 'shoulder-right',
        points: rightShoulderPoints,
        color: rightTerrainMaterial.color,
        artRef: rightTerrainMaterial.artRef,
        textured: Boolean(texturesEnabled && rightTerrainMaterial.artRef),
        textureWorldM,
        depthOffset: -0.045,
        threeLiftM: RACE_THREE_LIFTS_M.shoulder,
        minScreenY
      }
    ];
  }

  getRaceProjectedQuadArea(quad = null) {
    const points = [quad?.far?.left, quad?.far?.right, quad?.near?.right, quad?.near?.left];
    if (points.some((point) => !point || !Number.isFinite(point.screenX) || !Number.isFinite(point.screenY))) return 0;
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      area += current.screenX * next.screenY - next.screenX * current.screenY;
    }
    return area / 2;
  }

  getRaceProjectedRoadQuads(crossSections = []) {
    const quads = [];
    for (let index = 0; index < crossSections.length - 1; index += 1) {
      const near = crossSections[index];
      const far = crossSections[index + 1];
      if (!near?.center?.visible || !far?.center?.visible || !near?.left?.visible || !near?.right?.visible || !far?.left?.visible || !far?.right?.visible) continue;
      const nearZ = Number(near.center.renderZ || near.center.cameraZ || 0);
      const farZ = Number(far.center.renderZ || far.center.cameraZ || 0);
      if (!Number.isFinite(nearZ) || !Number.isFinite(farZ) || nearZ <= 1.05 || farZ <= 1.05) continue;
      if (Math.abs(farZ - nearZ) < 0.75) continue;
      const area = this.getRaceProjectedQuadArea({ near, far });
      if (Math.abs(area) < 3) continue;
      const nearWidth = Math.abs(Number(near.right.screenX || 0) - Number(near.left.screenX || 0));
      const farWidth = Math.abs(Number(far.right.screenX || 0) - Number(far.left.screenX || 0));
      if (nearWidth < 2 || farWidth < 2) continue;
      const minZ = Math.min(nearZ, farZ);
      const maxZ = Math.max(nearZ, farZ);
      quads.push({
        index,
        near,
        far,
        minZ,
        maxZ,
        avgZ: (nearZ + farZ) / 2,
        area
      });
    }
    return quads.sort((a, b) => b.avgZ - a.avgZ || b.maxZ - a.maxZ || b.index - a.index);
  }

  getRaceMode7DepthSlices({
    bounds = {},
    camera = {},
    cameraYaw = 0,
    visualTravel = 0,
    routeLength = this.getRaceRouteLength(),
    routeRuntimeType = this.getSelectedRaceRuntimeType(),
    nearDistance = 1,
    viewDistance = 1200,
    backDistance = 0,
    sliceCount = 220
  } = {}) {
    const slices = [];
    const routeEnd = Math.max(1, Number(routeLength) || 1);
    const near = Math.max(0.75, Number(nearDistance) || 1);
    const far = Math.max(near + 1, Number(viewDistance) || 1200);
    const count = Math.max(24, Math.floor(Number(sliceCount) || 220));
    const travel = Number(visualTravel || 0);
    const poseSamples = this.getRacePathSamplesCached({ step: 10 });
    const allowVisualExtension = routeRuntimeType !== 'circuit';
    const visualExtension = allowVisualExtension ? RACE_DESTINATION_VISUAL_EXTENSION_M : 0;
    const samplingTravel = routeRuntimeType === 'circuit' ? travel : clamp(travel, 0, routeEnd);
    const routeYaw = this.getRaceWorldPoseAtDistance(samplingTravel, {
      samples: poseSamples,
      routeLength: routeEnd,
      runtimeType: routeRuntimeType,
      allowVisualExtension
    }).yaw;
    const sampleDirection = this.getRaceCameraRouteSampleDirection(cameraYaw, routeYaw);
    const sideOn = Math.abs(Math.cos(normalizeAngle(Number(cameraYaw || 0) - Number(routeYaw || 0)))) < 0.34;
    const offsetEntries = [];
    const back = Math.max(0, Number(backDistance) || 0);
    for (let index = 0; index <= count; index += 1) {
      const t = index / count;
      const depthOffset = near + Math.pow(t, 1.46) * (far - near);
      offsetEntries.push(depthOffset * sampleDirection);
      if (back > near) {
        const backOffset = near + Math.pow(t, 1.28) * (back - near);
        offsetEntries.push(-backOffset * sampleDirection);
      }
      if (sideOn || sampleDirection < 0 || (allowVisualExtension && samplingTravel <= visualExtension + near)) {
        offsetEntries.push(-depthOffset * sampleDirection);
      }
    }
    offsetEntries.push(0, near * sampleDirection);
    if (back > near) offsetEntries.push(-near * sampleDirection, -back * sampleDirection);
    if (sideOn || sampleDirection < 0 || (allowVisualExtension && samplingTravel <= visualExtension + near)) {
      offsetEntries.push(-near * sampleDirection);
    }
    const seenDistances = new Set();
    offsetEntries
      .sort((a, b) => a - b)
      .forEach((signedOffset, index) => {
        const rawDistance = samplingTravel + signedOffset;
        if (routeRuntimeType !== 'circuit' && (rawDistance < -visualExtension || rawDistance > routeEnd + visualExtension)) return;
        const routeDistance = routeRuntimeType === 'circuit'
          ? ((rawDistance % routeEnd) + routeEnd) % routeEnd
          : clamp(rawDistance, -visualExtension, routeEnd + visualExtension);
        const key = Math.round(routeDistance * 100) / 100;
        if (seenDistances.has(key)) return;
        seenDistances.add(key);
        const section = this.getRaceRoadCrossSectionAtDistance(routeDistance, {
          samples: poseSamples,
          routeLength: routeEnd,
          runtimeType: routeRuntimeType,
          allowVisualExtension
        });
        let projected = {
          index,
          routeOrder: signedOffset,
          sampleDirection,
          t: Math.abs(signedOffset) / far,
          depthOffset: signedOffset,
          distance: rawDistance,
          routeDistance,
          center: this.projectRaceWorldPointToCamera(section.center, camera, cameraYaw, bounds),
          left: this.projectRaceWorldPointToCamera(section.left, camera, cameraYaw, bounds),
          right: this.projectRaceWorldPointToCamera(section.right, camera, cameraYaw, bounds),
          shoulderLeft: this.projectRaceWorldPointToCamera(section.shoulderLeft, camera, cameraYaw, bounds),
          shoulderRight: this.projectRaceWorldPointToCamera(section.shoulderRight, camera, cameraYaw, bounds)
        };
        projected = this.constrainRaceProjectedRoadSectionWidth(projected, bounds, camera);
        const phasePoints = [projected.center, projected.left, projected.right, projected.shoulderLeft, projected.shoulderRight];
        for (const point of phasePoints) {
          if (!point) continue;
          point.distance = rawDistance;
          point.routeDistance = routeDistance;
          point.depthOffset = signedOffset;
        }
        if (phasePoints.some((point) => point?.visible)) slices.push(projected);
      });
    return slices.sort((a, b) => Number(a.routeOrder || 0) - Number(b.routeOrder || 0));
  }

  getRaceMode7SliceCount(cameraView = 'third-person', speedMps = 0, bounds = {}) {
    const absSpeed = Math.abs(Number(speedMps) || 0);
    const baseCount = cameraView === 'first-person' ? 136 : 118;
    const speedBonus = clamp(absSpeed / 70, 0, 1) * 24;
    const viewportBonus = Number(bounds?.w || 0) > 760 ? 10 : 0;
    return Math.round(baseCount + speedBonus + viewportBonus);
  }

  getRaceMode7RenderSliceCount(cameraView = 'third-person', speedMps = 0, bounds = {}, renderDebug = this.getRaceRenderDebugSettings()) {
    const baseCount = this.getRaceMode7SliceCount(cameraView, speedMps, bounds);
    if (
      this.getRaceGroundRenderer() === 'webgl-track'
      && renderDebug?.terrainEnabled === false
      && renderDebug?.texturesEnabled === false
    ) {
      return Math.min(baseCount, cameraView === 'first-person' ? 44 : 36);
    }
    if (
      this.getRaceGroundRenderer() === 'webgl-track'
      && renderDebug?.terrainEnabled === true
      && renderDebug?.texturesEnabled !== false
      && renderDebug?.detailEnabled !== true
    ) {
      return Math.min(baseCount, cameraView === 'first-person' ? 40 : 32);
    }
    return baseCount;
  }

  areRaceMode7SlicesContiguous(near = null, far = null) {
    if (!near?.center || !far?.center) return false;
    const nearOrder = Number(near.routeOrder ?? near.depthOffset ?? near.distance ?? 0);
    const farOrder = Number(far.routeOrder ?? far.depthOffset ?? far.distance ?? 0);
    const orderDelta = Math.abs(farOrder - nearOrder);
    if (!Number.isFinite(orderDelta) || orderDelta <= 0.001) return false;
    const nearZ = Number(near.center.renderZ || near.center.cameraZ || 0);
    const farZ = Number(far.center.renderZ || far.center.cameraZ || 0);
    if (!Number.isFinite(nearZ) || !Number.isFinite(farZ)) return false;
    const zJump = Math.abs(farZ - nearZ);
    const nearWidth = Math.abs(Number(near.right?.screenX || 0) - Number(near.left?.screenX || 0));
    const farWidth = Math.abs(Number(far.right?.screenX || 0) - Number(far.left?.screenX || 0));
    const avgWidth = Math.max(8, (nearWidth + farWidth) * 0.5);
    const centerSpan = Math.hypot(
      Number(far.center.screenX || 0) - Number(near.center.screenX || 0),
      Number(far.center.screenY || 0) - Number(near.center.screenY || 0)
    );
    const maxOrderDelta = Math.max(28, Math.min(96, Math.max(nearZ, farZ) * 0.32));
    if (orderDelta > maxOrderDelta) return false;
    if (zJump > Math.max(90, Math.max(nearZ, farZ) * 1.8)) return false;
    if (centerSpan > Math.max(avgWidth * 4.8, Number(this.lastRaceRenderCamera?.bounds?.w || 390) * 0.95)) return false;
    return true;
  }

  getRaceMode7RoadBands(slices = []) {
    const bands = [];
    for (let index = 0; index < slices.length - 1; index += 1) {
      const near = slices[index];
      const far = slices[index + 1];
      if (!this.areRaceMode7SlicesContiguous(near, far)) continue;
      if (!near?.center?.visible && !far?.center?.visible) continue;
      const nearZ = Number(near.center.renderZ || near.center.cameraZ || 0);
      const farZ = Number(far.center.renderZ || far.center.cameraZ || 0);
      if (!Number.isFinite(nearZ) || !Number.isFinite(farZ) || nearZ <= 1.05 || farZ <= 1.05) continue;
      const hasRoadEdge = [near.left, near.right, far.left, far.right].some((point) => point?.visible);
      if (!hasRoadEdge) continue;
      const area = this.getRaceProjectedQuadArea({ near, far });
      if (Math.abs(area) < 0.6) continue;
      const nearWidth = Math.abs(Number(near.right.screenX || 0) - Number(near.left.screenX || 0));
      const farWidth = Math.abs(Number(far.right.screenX || 0) - Number(far.left.screenX || 0));
      const centerSpan = Math.hypot(
        Number(far.center.screenX || 0) - Number(near.center.screenX || 0),
        Number(far.center.screenY || 0) - Number(near.center.screenY || 0)
      );
      if ((nearWidth < 2 || farWidth < 2) && centerSpan < 2) continue;
      const minZ = Math.min(nearZ, farZ);
      const maxZ = Math.max(nearZ, farZ);
      bands.push({
        index,
        near,
        far,
        minZ,
        maxZ,
        avgZ: (nearZ + farZ) / 2,
        area
      });
    }
    return bands.sort((a, b) => b.avgZ - a.avgZ || b.maxZ - a.maxZ || b.index - a.index);
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
      mud: {
        roadA: '#4f3320',
        roadB: '#65412a',
        shoulderA: '#2f4327',
        shoulderB: '#263820',
        lane: '#d2b783'
      },
      'wet-gravel': {
        roadA: '#454b49',
        roadB: '#59605e',
        shoulderA: '#2f4631',
        shoulderB: '#233829',
        lane: '#dce2dc'
      },
      snow: {
        roadA: '#c8d6dd',
        roadB: '#e1edf2',
        shoulderA: '#d7e5ec',
        shoulderB: '#b8cbd5',
        lane: '#44515a'
      },
      slush: {
        roadA: '#8fa5af',
        roadB: '#aebfc7',
        shoulderA: '#b4c6ce',
        shoulderB: '#8da2ad',
        lane: '#3e4d55'
      }
    };
    return palettes[getSurfaceById(surfaceId).id] || palettes.asphalt;
  }

  getRaceGroundPaletteForSegment(segment = {}, worldPoint = null) {
    const patch = this.getRaceGroundPaintAtWorldPoint(worldPoint);
    const surfacePalette = this.getRaceRoadSurfacePalette(segment?.surface || 'asphalt');
    const fallbackTileId = segment?.edgeTileId || patch?.tileId || 'grass';
    const tilePalette = patch?.tileWeights
      ? this.getRaceWeightedGroundTilePalette(patch.tileWeights, fallbackTileId)
      : this.getRaceGroundTilePalette(fallbackTileId);
    return {
      shoulderA: patch?.tileId || segment?.edgeTileId ? tilePalette.groundA : surfacePalette.shoulderA,
      shoulderB: patch?.tileId || segment?.edgeTileId ? tilePalette.groundB : surfacePalette.shoulderB,
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
    const sharpTurnSeverity = segment.turn === 'square' || segment.turn === 'junction' ? 4 : segment.turn === 'angled' ? 3 : 0;
    const severity = sharpTurnSeverity || (absCurve > 0.78 ? 3 : absCurve > 0.46 ? 2 : absCurve > 0.18 ? 1 : 0);
    const turnText = segment.turn === 'junction'
      ? `Junction ${direction}`
      : segment.turn === 'square'
        ? `Square ${direction}`
        : segment.turn === 'angled'
          ? `Angled ${direction}`
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
    if (this.playtestSession && value > 0) {
      const source = details.source || part;
      this.playtestSession.damageLog = [
        ...(this.playtestSession.damageLog || []).slice(-11),
        {
          part,
          amount: value,
          source,
          distance: Number(this.playtestSession.distance || 0)
        }
      ];
    }
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

  getRaceWeatherAuthoringIntensity(race = this.selectedRace) {
    const weather = String(race?.weather || 'clear');
    if (weather === 'clear') return 0;
    const raw = Number(race?.weatherIntensity);
    return clamp(Number.isFinite(raw) ? raw : 0.75, 0.05, 1);
  }

  cycleRaceWeatherIntensity() {
    const race = this.selectedRace;
    if (!race) return false;
    const current = this.getRaceWeatherAuthoringIntensity(race);
    const index = RACE_WEATHER_INTENSITY_STEPS.findIndex((step) => step > current + 0.01);
    race.weatherIntensity = RACE_WEATHER_INTENSITY_STEPS[index >= 0 ? index : 0];
    this.status = `Weather intensity: ${Math.round(race.weatherIntensity * 100)}%`;
    return true;
  }

  setRaceWeather(weatherId = 'clear') {
    const race = this.selectedRace;
    if (!race) return false;
    const preset = RACE_WEATHER_PRESET_BY_ID[weatherId] || RACE_WEATHER_PRESET_BY_ID.clear;
    race.weather = preset.id;
    if (preset.id === 'clear') {
      race.weatherIntensity = 0;
    } else if (!Number.isFinite(Number(race.weatherIntensity)) || Number(race.weatherIntensity) <= 0) {
      race.weatherIntensity = 0.75;
    }
    this.status = `Weather: ${preset.label}`;
    return true;
  }

  getRaceWeatherState(race = this.selectedRace, session = this.playtestSession) {
    const id = String(race?.weather || 'clear');
    const preset = RACE_WEATHER_PRESET_BY_ID[id] || RACE_WEATHER_PRESET_BY_ID.clear;
    const targetIntensity = Math.min(Number(preset.maxIntensity) || 0, this.getRaceWeatherAuthoringIntensity(race));
    const elapsedSeconds = Math.max(0, Number(session?.elapsedMs || 0) / 1000);
    const buildup = preset.id === 'clear'
      ? 0
      : clamp(elapsedSeconds / Math.max(1, Number(preset.buildupSeconds) || 1), 0, 1);
    const effectiveIntensity = clamp(targetIntensity * buildup, 0, 1);
    return {
      id: preset.id,
      label: preset.label,
      targetIntensity,
      buildup,
      effectiveIntensity,
      precipitationIntensity: preset.id === 'clear' ? 0 : targetIntensity
    };
  }

  getRaceEffectiveSurfaceId(baseSurfaceId = 'asphalt', weatherState = this.getRaceWeatherState()) {
    const base = getSurfaceById(baseSurfaceId).id;
    const amount = clamp(Number(weatherState?.effectiveIntensity) || 0, 0, 1);
    if (!weatherState || weatherState.id === 'clear' || amount < 0.08) return base;
    if (weatherState.id === 'snow') {
      if (amount < 0.34) {
        if (base === 'asphalt') return 'wet-asphalt';
        if (base === 'dirt') return 'mud';
        if (base === 'gravel') return 'wet-gravel';
        if (base === 'snow') return 'slush';
        return base;
      }
      if (amount < 0.64 && base === 'snow') return 'slush';
      return 'snow';
    }
    if (weatherState.id === 'rain' || weatherState.id === 'storm') {
      if (base === 'asphalt') return 'wet-asphalt';
      if (base === 'dirt') return 'mud';
      if (base === 'gravel') return 'wet-gravel';
      if (base === 'snow') return 'slush';
      return base;
    }
    return base;
  }

  getRaceWeatherGripMultiplier(weather = this.selectedRace?.weather) {
    const state = typeof weather === 'object'
      ? weather
      : this.getRaceWeatherState(
        { ...this.selectedRace, weather, weatherIntensity: weather === 'clear' ? 0 : 1 },
        { elapsedMs: ((RACE_WEATHER_PRESET_BY_ID[weather]?.buildupSeconds || 1) + 1) * 1000 }
      );
    const amount = clamp(Number(state.effectiveIntensity) || 0, 0, 1);
    const maxPenalty = state.id === 'storm' ? 0.14 : state.id === 'snow' ? 0.18 : state.id === 'rain' ? 0.08 : 0;
    return clamp(1 - amount * maxPenalty, 0.78, 1);
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

  getRacePerWheelGrip(car = this.selectedCar, surfaceId = 'asphalt', weather = this.selectedRace?.weather, damage = this.getRaceSessionDamage()) {
    const setup = this.getRaceCarSetup(car);
    const surface = getSurfaceById(surfaceId).id;
    return Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      this.getRaceWheelGripForSurface({ car, wheelId, surfaceId: surface, weather, damage })
    ]));
  }

  getRaceWheelGripForSurface({
    car = this.selectedCar,
    wheelId = 'fl',
    surfaceId = 'asphalt',
    weather = this.selectedRace?.weather,
    damage = this.getRaceSessionDamage(),
    terrainGripScale = 1
  } = {}) {
    const setup = this.getRaceCarSetup(car);
    const surface = getSurfaceById(surfaceId).id;
    const compound = this.getRaceTireCompound(setup.tireCompoundByWheel[wheelId]);
    const pressure = clamp(Number(setup.tirePressurePsi[wheelId] || 32), 18, 46);
    const pressurePenalty = 1 - Math.min(0.18, Math.abs(pressure - 32) * 0.009);
    const tireHealth = 1 - clamp(Number(damage.tires?.[wheelId] || 0) / 125, 0, 0.74);
    const suspensionHealth = 1 - clamp(Number(damage.suspension?.[wheelId] || 0) / 145, 0, 0.58);
    const compoundGrip = (compound.surfaceGrip?.[surface] || 0.7) * (compound.weatherGrip?.[weather] || 1);
    return clamp(compoundGrip * pressurePenalty * tireHealth * suspensionHealth * clamp(Number(terrainGripScale) || 1, 0.22, 1.12), 0.12, 1.28);
  }

  getRaceTireTemperatureGripMultiplier(tempF = 70) {
    const temp = Number(tempF);
    if (!Number.isFinite(temp)) return 1;
    if (temp < 35) return 0.72;
    if (temp < 70) return 0.84 + (temp - 35) / 35 * 0.16;
    if (temp < 145) return 1 + (temp - 70) / 75 * 0.02;
    if (temp < 210) return 1.02 + (temp - 145) / 65 * 0.06;
    if (temp < 245) return 1.08 - (temp - 210) / 35 * 0.05;
    if (temp < 295) return 1.03 - (temp - 245) / 50 * 0.26;
    if (temp < 360) return 0.77 - (temp - 295) / 65 * 0.24;
    return 0.48;
  }

  getRaceTireTemperatureGripMultipliers(temperatures = {}) {
    return Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      this.getRaceTireTemperatureGripMultiplier(temperatures?.[wheelId])
    ]));
  }

  createRaceVehiclePhysicsStateForSession({
    session = this.playtestSession,
    car = this.selectedCar,
    tuning = this.getRaceCarTuning(car)
  } = {}) {
    if (!session) return null;
    return createRaceVehiclePhysicsState({
      session,
      tuning,
      carDimensions: this.getRaceCarDimensions(car),
      surfaceModel: this.getRaceSurfaceModel(),
      elevationScaleM: RACE_THREE_ELEVATION_M
    });
  }

  resetRaceVehiclePhysicsState({
    session = this.playtestSession,
    car = this.selectedCar,
    tuning = this.getRaceCarTuning(car)
  } = {}) {
    if (!session) return null;
    session.vehicle3d = this.createRaceVehiclePhysicsStateForSession({ session, car, tuning });
    syncRaceVehiclePhysicsToSession(session.vehicle3d, session, { preservePlanarPosition: true });
    return session.vehicle3d;
  }

  getRaceWheelWorldPositions({
    tuning = this.getRaceCarTuning(),
    session = this.playtestSession,
    car = this.selectedCar
  } = {}) {
    if (session?.vehicle3d?.enabled) {
      const positions = {};
      RACE_WHEEL_IDS.forEach((wheelId) => {
        const pose = getRaceVehicleWheelWorldPose(session.vehicle3d, wheelId);
        positions[wheelId] = {
          x: Number(pose.x || 0),
          y: Number(pose.y || 0),
          z: Number(pose.z || 0),
          elevation: Number(pose.y || 0) / RACE_THREE_ELEVATION_M
        };
      });
      return positions;
    }
    const yaw = Number.isFinite(session?.carYaw) ? Number(session.carYaw) : 0;
    const forward = this.getRaceForwardVector(yaw);
    const right = this.getRaceRightVector(yaw);
    const dimensions = this.getRaceCarDimensions(car);
    const wheelbase = Math.max(2.1, Number(tuning.wheelbaseM) || dimensions.wheelbaseM);
    const frontTrackWidth = Math.max(1.2, Number(tuning.trackFrontM) || dimensions.trackFrontM || tuning.trackWidthM);
    const rearTrackWidth = Math.max(1.2, Number(tuning.trackRearM) || dimensions.trackRearM || tuning.trackWidthM);
    const originX = Number(session?.worldX || 0);
    const originZ = Number(session?.worldZ || 0);
    const point = (longitudinal, lateral) => ({
      x: originX + forward.x * longitudinal + right.x * lateral,
      z: originZ + forward.z * longitudinal + right.z * lateral
    });
    return {
      fl: point(wheelbase * 0.5, -frontTrackWidth * 0.5),
      fr: point(wheelbase * 0.5, frontTrackWidth * 0.5),
      rl: point(-wheelbase * 0.5, -rearTrackWidth * 0.5),
      rr: point(-wheelbase * 0.5, rearTrackWidth * 0.5)
    };
  }

  getRaceGroundSurfaceForWorldPoint(worldPoint = null, fallbackSurface = 'asphalt') {
    const patch = this.getRaceGroundPaintAtWorldPoint(worldPoint);
    if (patch?.explicit === false) return this.getRaceEffectiveSurfaceId(fallbackSurface);
    const tileId = patch?.tileId || '';
    let surfaceId = getSurfaceById(fallbackSurface).id;
    if (/snow|ice/i.test(tileId)) surfaceId = 'snow';
    else if (/rock|gravel/i.test(tileId)) surfaceId = 'gravel';
    else if (/dirt|sand|grass|mud/i.test(tileId)) surfaceId = 'dirt';
    else if (/metal|asphalt|road/i.test(tileId)) surfaceId = 'asphalt';
    else if (/water|wet/i.test(tileId)) surfaceId = 'wet-asphalt';
    return this.getRaceEffectiveSurfaceId(surfaceId);
  }

  getRaceWheelSurfaceState({
    car = this.selectedCar,
    tuning = this.getRaceCarTuning(car),
    session = this.playtestSession,
    damage = this.getRaceSessionDamage()
  } = {}) {
    const positions = this.getRaceWheelWorldPositions({ tuning, session, car });
    return getRaceWheelSurfaceStateModule({
      wheelIds: RACE_WHEEL_IDS,
      positions,
      car,
      damage,
      selectedSegment: this.selectedSegment,
      weatherState: this.getRaceWeatherState(),
      surfaceModel: this.getRaceSurfaceModel(),
      adapter: {
        getEffectiveSurfaceId: (surfaceId) => this.getRaceEffectiveSurfaceId(surfaceId),
        getSurfaceById,
        getSegmentSurfaceDetailGrip: (segment) => this.getRaceSegmentSurfaceDetailGrip(segment),
        getWheelGripForSurface: (options) => this.getRaceWheelGripForSurface(options)
      }
    });
  }

  getRaceWheelContactState({
    car = this.selectedCar,
    tuning = this.getRaceCarTuning(car),
    session = this.playtestSession,
    wheelSurfaceState = null
  } = {}) {
    const positions = wheelSurfaceState?.positions || this.getRaceWheelWorldPositions({ tuning, session, car });
    const dimensions = this.getRaceCarDimensions(car);
    const contactState = getRaceWheelContactStateModule({
      wheelIds: RACE_WHEEL_IDS,
      positions,
      carDimensions: dimensions,
      tuning,
      selectedSegment: this.selectedSegment,
      surfaceModel: this.getRaceSurfaceModel(),
      elevationScaleM: RACE_THREE_ELEVATION_M,
      runtimeType: session?.routeRuntimeType || this.getActiveRaceRuntimeType()
    });
    Object.values(contactState.contacts || {}).forEach((contact) => {
      if (!contact.projection) contact.projection = this.getRaceRouteProjectionForWorldPoint(contact);
      if (!contact.segment) contact.segment = contact.projection?.segment || this.selectedSegment;
    });
    return contactState;
  }

  getRaceDrivenWheelIds(tuning = this.getRaceCarTuning()) {
    if (tuning.drivetrain === 'fwd') return ['fl', 'fr'];
    if (tuning.drivetrain === 'rwd') return ['rl', 'rr'];
    return ['fl', 'fr', 'rl', 'rr'];
  }

  getRaceWheelNormalLoads(tuning, longitudinalAcceleration = 0, lateralAcceleration = 0) {
    const mass = Math.max(450, Number(tuning.weightKg) || 1495);
    const wheelbase = Math.max(2.1, Number(tuning.wheelbaseM) || 2.67);
    const trackWidth = Math.max(1.25, Number(tuning.trackWidthM) || 1.82);
    const cgHeight = clamp(Number(tuning.cgHeightM) || 0.56, 0.3, 1);
    const staticFront = mass * 9.81 * clamp(Number(tuning.frontWeightDistribution) || 0.54, 0.35, 0.72);
    const staticRear = mass * 9.81 - staticFront;
    const longitudinalTransfer = clamp((mass * longitudinalAcceleration * cgHeight) / wheelbase, -mass * 9.81 * 0.22, mass * 9.81 * 0.22);
    const lateralTransfer = clamp((mass * lateralAcceleration * cgHeight) / trackWidth, -mass * 9.81 * 0.32, mass * 9.81 * 0.32);
    const frontLoad = staticFront - longitudinalTransfer;
    const rearLoad = staticRear + longitudinalTransfer;
    return {
      fl: Math.max(80, frontLoad / 2 - lateralTransfer / 2),
      fr: Math.max(80, frontLoad / 2 + lateralTransfer / 2),
      rl: Math.max(80, rearLoad / 2 - lateralTransfer / 2),
      rr: Math.max(80, rearLoad / 2 + lateralTransfer / 2)
    };
  }

  getRaceBrakeForceForInput({ tuning, brake = 0, handbrake = 0, gripByWheel, normalLoads, speedMps = 0 } = {}) {
    const brakePressure = Math.pow(clamp(Number(brake) || 0, 0, 1), 0.82);
    const brakeCapacity = Math.max(0, Number(tuning.brakeForceN) || 16500) * clamp(Number(tuning.brakePressure) || 1, 0.7, 1.35);
    const requested = brakeCapacity * brakePressure;
    const handbrakeRequested = brakeCapacity * 0.92 * clamp(handbrake, 0, 1);
    const speedLockFactor = clamp(Math.abs(Number(speedMps) || 0) / 11, 0, 1);
    const frontBias = clamp(Number(tuning.frontBrakeBias) || 0.62, 0.45, 0.78);
    const requestedByWheel = {
      fl: requested * frontBias * 0.5,
      fr: requested * frontBias * 0.5,
      rl: requested * (1 - frontBias) * 0.5 + handbrakeRequested * 0.5,
      rr: requested * (1 - frontBias) * 0.5 + handbrakeRequested * 0.5
    };
    const wheelIds = ['fl', 'fr', 'rl', 'rr'];
    const appliedByWheel = {};
    const lockByWheel = {};
    wheelIds.forEach((wheelId) => {
      const limit = Math.max(1, Number(normalLoads?.[wheelId] || 0) * Math.max(0.1, Number(gripByWheel?.[wheelId] || 0)));
      const requestedWheel = Number(requestedByWheel[wheelId] || 0);
      const absCap = tuning.absEnabled && !handbrake ? limit * 0.96 : limit;
      appliedByWheel[wheelId] = Math.min(requestedWheel, absCap);
      lockByWheel[wheelId] = clamp(((requestedWheel - limit) / Math.max(1, limit)) * speedLockFactor, 0, 1);
    });
    return {
      force: wheelIds.reduce((sum, wheelId) => sum + appliedByWheel[wheelId], 0),
      appliedByWheel,
      lockByWheel
    };
  }

  updateRaceVerticalAndRollState({ seconds = 0, tuning, roadPose, previousRoadPose, lateralAcceleration = 0, wheelContactState = null } = {}) {
    const session = this.playtestSession;
    if (!session || !roadPose) return;
    const dt = Math.max(0, Number(seconds) || 0);
    const speed = Math.abs(Number(session.speedMps || 0));
    const desiredRideHeightM = clamp((Number(tuning.rideHeightFront) || 0.18) + (Number(tuning.rideHeightRear) || 0.18), 0.18, 0.72);
    const roadHeight = Number.isFinite(Number(wheelContactState?.averageHeightM))
      ? Number(wheelContactState.averageHeightM) + desiredRideHeightM
      : Number(roadPose.elevation || 0) * RACE_THREE_ELEVATION_M;
    const previousRoadHeight = Number(previousRoadPose?.elevation || 0) * RACE_THREE_ELEVATION_M;
    if (!Number.isFinite(session.heightM)) session.heightM = roadHeight;
    if (!Number.isFinite(session.verticalVelocityMps)) session.verticalVelocityMps = 0;
    const roadRiseMps = dt > 0 ? (roadHeight - previousRoadHeight) / dt : 0;
    const crestLaunch = roadRiseMps < -2.6 && speed > 18;
    if (crestLaunch && session.grounded !== false) {
      session.grounded = false;
      session.airborne = true;
      session.verticalVelocityMps = Math.max(0.4, speed * 0.045 + Math.abs(roadRiseMps) * 0.12);
    }
    if (session.grounded === false || session.airborne) {
      session.verticalVelocityMps -= 9.81 * dt;
      session.heightM += session.verticalVelocityMps * dt;
      if (session.heightM <= roadHeight) {
        const landingImpact = Math.max(0, -session.verticalVelocityMps);
        session.heightM = roadHeight;
        session.verticalVelocityMps = 0;
        session.grounded = true;
        session.airborne = false;
        if (landingImpact > 4.8) {
          this.applyRaceDamage('suspension', (landingImpact - 4.8) * 1.7, { pull: (Math.random() - 0.5) * 0.05 });
        }
      }
    } else {
      session.heightM += (roadHeight - session.heightM) * Math.min(1, dt * 12);
      session.grounded = true;
      session.airborne = false;
    }
    const trackWidth = Math.max(1.25, Number(tuning.trackWidthM) || 1.82);
    const cgHeight = clamp(Number(tuning.cgHeightM) || 0.56, 0.3, 1);
    const rolloverThresholdG = clamp((trackWidth / (2 * cgHeight)) * 0.96, 1.45, 2.05);
    const lateralG = lateralAcceleration / 9.81;
    session.rollRate = Number(session.rollRate || 0)
      + (lateralG * 0.72 - Number(session.rollRad || 0) * tuning.rollStiffness * 1.25) * dt;
    session.rollRate *= Math.max(0, 1 - dt * tuning.rollDamping * 1.8);
    const terrainRollRad = Number(wheelContactState?.terrainRollRad || 0);
    const terrainPitchRad = Number(wheelContactState?.terrainPitchRad || 0);
    session.rollRad = clamp(Number(session.rollRad || 0) + session.rollRate * dt + terrainRollRad * Math.min(1, dt * 6), -1.35, 1.35);
    session.pitchRad = clamp(
      terrainPitchRad + (roadHeight - previousRoadHeight) * 0.025 + Number(session.verticalVelocityMps || 0) * 0.012,
      -0.48,
      0.48
    );
    if (wheelContactState?.heights) {
      const frontTravel = clamp(Number(tuning.suspensionTravelFront) || 0.5, 0.1, 1);
      const rearTravel = clamp(Number(tuning.suspensionTravelRear) || 0.5, 0.1, 1);
      session.suspensionTravel = session.suspensionTravel || { fl: 0, fr: 0, rl: 0, rr: 0 };
      let bottomOut = 0;
      RACE_WHEEL_IDS.forEach((wheelId) => {
        const travel = wheelId === 'fl' || wheelId === 'fr' ? frontTravel : rearTravel;
        const wheelHeight = Number(wheelContactState.heights[wheelId] || 0);
        const extension = session.heightM - wheelHeight;
        const compression = clamp((desiredRideHeightM + travel * 0.5 - extension) / Math.max(0.05, travel), 0, 1.25);
        session.suspensionTravel[wheelId] = clamp(compression, 0, 1);
        bottomOut = Math.max(bottomOut, compression);
      });
      if (bottomOut > 1 && speed > 7) {
        const impact = (bottomOut - 1) * (1 + speed * 0.035);
        this.applyRaceDamage('suspension', impact * 0.55, { pull: Math.sign(terrainRollRad || 0) * 0.006 });
      }
    }
    if (Math.abs(lateralG) > rolloverThresholdG || Math.abs(session.rollRad) > 1.06) {
      session.rolledOver = true;
      session.running = true;
      session.speedMps *= Math.max(0, 1 - dt * 5);
      session.rollRad = Math.sign(session.rollRad || lateralG || 1) * Math.max(Math.abs(session.rollRad || 0), 1.12);
      session.eventLog = [...(session.eventLog || []).slice(-5), 'Car rolled over'];
      this.status = 'Rolled over';
    }
  }

  updateRaceVehicle3DContactState({
    seconds = 0,
    car = this.selectedCar,
    tuning = this.getRaceCarTuning(car),
    acceleration = 0,
    lateralAcceleration = 0,
    brakeState = null,
    driveForce = 0,
    drivenWheelIds = [],
    wheelLongitudinalUsage = {},
    wheelLateralUsage = {},
    frontLatForce = 0,
    rearLatForce = 0
  } = {}) {
    const session = this.playtestSession;
    if (!session) return null;
    if (!session.vehicle3d?.enabled) {
      this.resetRaceVehiclePhysicsState({ session, car, tuning });
    }
    const speedMps = Number(session.speedMps || 0);
    const velocityYaw = Number(session.velocityYaw ?? session.carYaw ?? 0);
    const planarVelocity = {
      x: Math.sin(velocityYaw) * speedMps,
      y: Number(session.velocityY ?? session.verticalVelocityMps ?? 0),
      z: Math.cos(velocityYaw) * speedMps
    };
    const driven = new Set(drivenWheelIds || []);
    const driveForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      driven.has(wheelId) ? Number(driveForce || 0) / Math.max(1, driven.size) : 0
    ]));
    const lateralForceByWheel = {
      fl: Number(frontLatForce || 0) * 0.5,
      fr: Number(frontLatForce || 0) * 0.5,
      rl: Number(rearLatForce || 0) * 0.5,
      rr: Number(rearLatForce || 0) * 0.5
    };
    stepRaceVehiclePhysics(session.vehicle3d, {
      dt: seconds,
      tuning,
      carDimensions: this.getRaceCarDimensions(car),
      surfaceModel: this.getRaceSurfaceModel(),
      elevationScaleM: RACE_THREE_ELEVATION_M,
      planarVelocity,
      yaw: session.carYaw,
      controls: {
        yawRate: Number(session.yawVelocityRadps || 0),
        longitudinalAcceleration: acceleration,
        lateralAcceleration,
        driveForceByWheel,
        brakeForceByWheel: brakeState?.appliedByWheel || {},
        longitudinalUsageByWheel: wheelLongitudinalUsage,
        lateralUsageByWheel: wheelLateralUsage,
        lateralForceByWheel
      }
    });
    syncRaceVehiclePhysicsToSession(session.vehicle3d, session, { preservePlanarPosition: true });
    return session.vehicle3d;
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
    const transmissionType = this.getRaceTransmissionType(car);
    const transmission = car.transmissions?.[transmissionType] || {};
    const clampSet = (target, key, min, max, step = 0.01) => {
      const next = clamp(Number(target[key] || 0) + Number(delta || 0) * step, min, max);
      target[key] = Math.round(next * 1000) / 1000;
      return target[key];
    };
    let value = 0;
    if (path === 'tuning-tab-prev' || path === 'tuning-tab-next') {
      const tabs = this.getRaceTuningTabs(car).map((tab) => tab.id);
      const index = Math.max(0, tabs.indexOf(this.preRaceTuningTab));
      this.preRaceTuningTab = tabs[(index + (path === 'tuning-tab-next' ? 1 : -1) + tabs.length) % tabs.length];
      this.status = `Tuning: ${this.getRaceTuningTabs(car).find((tab) => tab.id === this.preRaceTuningTab)?.label || this.preRaceTuningTab}`;
      return;
    }
    if (path.startsWith('pressure-')) {
      const wheelId = path.replace('pressure-', '');
      value = clampSet(setup.tirePressurePsi, wheelId, 18, 46, 1);
      this.status = `${wheelId.toUpperCase()} pressure: ${value} psi`;
      return;
    }
    if (path === 'frontTirePressure' || path === 'rearTirePressure') {
      const wheels = path === 'frontTirePressure' ? ['fl', 'fr'] : ['rl', 'rr'];
      wheels.forEach((wheelId) => { value = clampSet(setup.tirePressurePsi, wheelId, 18, 46, 1); });
      this.status = `${path === 'frontTirePressure' ? 'Front' : 'Rear'} pressure: ${value} psi`;
      return;
    }
    if (path.startsWith('gearRatio-')) {
      const gearIndex = Number(path.replace('gearRatio-', '')) - 1;
      if (!Array.isArray(transmission.gearRatios)) transmission.gearRatios = (tuning.gearRatios || []).slice();
      value = clampSet(transmission.gearRatios, gearIndex, 0.35, 5.5, 0.05);
      this.status = `Gear ${gearIndex + 1}: ${value}`;
      return;
    }
    const ranges = {
      brakeBalance: [0.35, 0.75, 0.02],
      brakePressure: [0.7, 1.35, 0.03],
      gearFinalDrive: [2.6, 5.2, 0.05],
      camberFront: [-5, 1, 0.1],
      camberRear: [-5, 1, 0.1],
      toeFront: [-1, 1, 0.05],
      toeRear: [-1, 1, 0.05],
      casterFront: [3, 8, 0.1],
      springFront: [0.1, 1, 0.03],
      springRear: [0.1, 1, 0.03],
      rideHeightFront: [0.1, 1, 0.03],
      rideHeightRear: [0.1, 1, 0.03],
      suspensionTravelFront: [0.1, 1, 0.03],
      suspensionTravelRear: [0.1, 1, 0.03],
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
      powerHp: [80, 900, 10],
      weightKg: [450, 2400, 25],
      tireGrip: [0.45, 1.8, 0.05],
      differentialAccel: [0, 1, 0.03],
      differentialDecel: [0, 1, 0.03],
      frontDifferentialAccel: [0, 1, 0.03],
      frontDifferentialDecel: [0, 1, 0.03],
      rearDifferentialAccel: [0, 1, 0.03],
      rearDifferentialDecel: [0, 1, 0.03],
      centerDifferentialBalance: [0.1, 0.9, 0.03]
    };
    const range = ranges[path];
    if (!range) return;
    const target = path === 'gearFinalDrive' ? transmission : tuning;
    value = clampSet(target, path, range[0], range[1], range[2]);
    this.status = `${path.replace(/([A-Z])/g, ' $1')}: ${value}`;
  }

  adjustCarEditorMenuTuningAction(action = '') {
    const path = CAR_EDITOR_TUNING_ACTION_PATHS[action];
    if (!path) return false;
    const car = this.selectedCar;
    if (!car) return false;
    const tuning = car.tuning || {};
    car.tuning = tuning;
    const transmissionType = this.getRaceTransmissionType(car);
    const transmission = car.transmissions?.[transmissionType] || {};
    const ranges = {
      powerHp: [80, 900, 10],
      weightKg: [450, 2400, 25],
      tireGrip: [0.45, 1.8, 0.05],
      brakeBalance: [0.35, 0.75, 0.02],
      gearFinalDrive: [2.6, 5.2, 0.05],
      differentialAccel: [0, 1, 0.03],
      differentialDecel: [0, 1, 0.03],
      aeroFront: [0, 1, 0.03],
      aeroRear: [0, 1, 0.03],
      springFront: [0.1, 1, 0.03],
      springRear: [0.1, 1, 0.03],
      dampingFront: [0.1, 1, 0.03],
      dampingRear: [0.1, 1, 0.03],
      antiRollFront: [0.1, 1, 0.03],
      antiRollRear: [0.1, 1, 0.03]
    };
    const range = ranges[path];
    if (!range) return false;
    const [min, max, step] = range;
    const target = path === 'gearFinalDrive' ? transmission : tuning;
    const current = Number(target[path] ?? tuning[path] ?? 0) || 0;
    const rawNext = current + step;
    const next = rawNext > max + step * 0.25 ? min : rawNext;
    target[path] = Math.round(clamp(next, min, max) * 1000) / 1000;
    if (path === 'gearFinalDrive') tuning.gearFinalDrive = target[path];
    this.status = `${this.getRaceActionLabel(action)} adjusted`;
    return true;
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
    const dimensions = this.getRaceCarDimensions(car);
    return {
      drivetrain: merged.drivetrain || 'awd',
      transmissionType: selectedTransmissionType,
      shiftMode: merged.shiftMode || selectedTransmissionType || 'manual',
      powerHp: Math.max(80, Number(merged.powerHp) || 271),
      torqueLbFt: Math.max(80, Number(merged.torqueLbFt) || 258),
      engineDisplacementL: Math.max(0.5, Number(merged.engineDisplacementL) || 2.4),
      aspiration: merged.aspiration || 'Turbocharged',
      weightKg: Math.max(450, Number(merged.weightKg) || 1495),
      frontWeightDistribution: clamp(Number(merged.frontWeightDistribution) || 0.54, 0.35, 0.72),
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
      zeroToSixtySec: Math.max(2.5, Number(merged.zeroToSixtySec) || 6),
      dragCoefficient: clamp(Number(merged.dragCoefficient) || 0.43, 0.25, 0.7),
      accelerationCalibration: clamp(Number(merged.accelerationCalibration) || 1, 0.7, 1.35),
      drivetrainEfficiency: clamp(Number(merged.drivetrainEfficiency) || 0.84, 0.55, 0.96),
      shiftTimeMs: Math.max(80, Number(merged.shiftTimeMs) || 420),
      autoUpshiftRpm: Math.max(2500, Number(merged.autoUpshiftRpm) || 5800),
      autoDownshiftRpm: Math.max(900, Number(merged.autoDownshiftRpm) || 1700),
      torqueConverterSlip: clamp(Number(merged.torqueConverterSlip) || 0, 0, 0.25),
      launchRpm: Math.max(1200, Number(merged.launchRpm) || 3000),
      widthM: dimensions.widthM,
      lengthM: dimensions.lengthM,
      trackFrontM: clamp(Number(merged.trackFrontM) || dimensions.trackFrontM, 1.2, 2.2),
      trackRearM: clamp(Number(merged.trackRearM) || dimensions.trackRearM, 1.2, 2.2),
      trackWidthM: clamp(Number(merged.trackWidthM) || dimensions.trackWidthM, 1.2, 2.2),
      wheelbaseM: Math.max(2.1, Number(merged.wheelbaseM) || dimensions.wheelbaseM),
      cgHeightM: clamp(Number(merged.cgHeightM) || 0.56, 0.32, 0.95),
      brakeForceN: Math.max(4500, Number(merged.brakeForceN) || 16500),
      brakePressure: clamp(Number(merged.brakePressure) || 1, 0.7, 1.35),
      frontBrakeBias: clamp(Number(merged.frontBrakeBias ?? merged.brakeBalance) || 0.62, 0.45, 0.78),
      absEnabled: merged.absEnabled !== false,
      camberFront: clamp(Number(merged.camberFront) || 0, -5, 1),
      camberRear: clamp(Number(merged.camberRear) || 0, -5, 1),
      toeFront: clamp(Number(merged.toeFront) || 0, -1, 1),
      toeRear: clamp(Number(merged.toeRear) || 0, -1, 1),
      casterFront: clamp(Number(merged.casterFront) || 5.5, 3, 8),
      antiRollFront: clamp(Number(merged.antiRollFront) || 0.5, 0.1, 1),
      antiRollRear: clamp(Number(merged.antiRollRear) || 0.5, 0.1, 1),
      springFront: clamp(Number(merged.springFront) || 0.5, 0.1, 1),
      springRear: clamp(Number(merged.springRear) || 0.5, 0.1, 1),
      rideHeightFront: clamp(Number(merged.rideHeightFront) || 0.5, 0.1, 1),
      rideHeightRear: clamp(Number(merged.rideHeightRear) || 0.5, 0.1, 1),
      suspensionTravelFront: clamp(Number(merged.suspensionTravelFront) || 0.5, 0.1, 1),
      suspensionTravelRear: clamp(Number(merged.suspensionTravelRear) || 0.5, 0.1, 1),
      bumpFront: clamp(Number(merged.bumpFront ?? merged.dampingFront) || 0.5, 0.1, 1),
      bumpRear: clamp(Number(merged.bumpRear ?? merged.dampingRear) || 0.5, 0.1, 1),
      reboundFront: clamp(Number(merged.reboundFront ?? merged.dampingFront) || 0.5, 0.1, 1),
      reboundRear: clamp(Number(merged.reboundRear ?? merged.dampingRear) || 0.5, 0.1, 1),
      aeroFront: clamp(Number(merged.aeroFront) || 0, 0, 1),
      aeroRear: clamp(Number(merged.aeroRear) || 0, 0, 1),
      frontDifferentialAccel: clamp(Number(merged.frontDifferentialAccel ?? merged.differentialAccel) || 0, 0, 1),
      frontDifferentialDecel: clamp(Number(merged.frontDifferentialDecel ?? merged.differentialDecel) || 0, 0, 1),
      rearDifferentialAccel: clamp(Number(merged.rearDifferentialAccel ?? merged.differentialAccel) || 0, 0, 1),
      rearDifferentialDecel: clamp(Number(merged.rearDifferentialDecel ?? merged.differentialDecel) || 0, 0, 1),
      centerDifferentialBalance: clamp(Number(merged.centerDifferentialBalance) || 0.5, 0.1, 0.9),
      rollStiffness: clamp(Number(merged.rollStiffness) || 0.76, 0.2, 1.4),
      rollDamping: clamp(Number(merged.rollDamping) || 0.68, 0.2, 1.6),
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

  getRaceSetupPhysicsModifiers(tuning = this.getRaceCarTuning(), speedMps = 0) {
    const speedFactor = clamp(Math.abs(Number(speedMps) || 0) / 54, 0, 1.4);
    const camberGrip = clamp(1 + (Math.abs(tuning.camberFront + 1.2) + Math.abs(tuning.camberRear + 1)) * -0.018, 0.9, 1.04);
    const toePenalty = clamp(1 - (Math.abs(tuning.toeFront) + Math.abs(tuning.toeRear)) * 0.035, 0.9, 1);
    const casterStability = clamp(1 + (tuning.casterFront - 5.5) * 0.025, 0.92, 1.08);
    const ridePenalty = clamp(1 - Math.abs(tuning.rideHeightFront - tuning.rideHeightRear) * 0.08, 0.94, 1.02);
    const springBalance = clamp(1 + (tuning.springRear - tuning.springFront) * 0.08, 0.92, 1.08);
    const antiRollBalance = clamp(1 + (tuning.antiRollRear - tuning.antiRollFront) * 0.06, 0.94, 1.06);
    const dampingGrip = clamp(1 - (Math.abs(tuning.bumpFront - tuning.reboundFront) + Math.abs(tuning.bumpRear - tuning.reboundRear)) * 0.035, 0.92, 1.03);
    const aeroGrip = 1 + (tuning.aeroFront + tuning.aeroRear) * 0.09 * speedFactor;
    const rearAeroBias = clamp(1 + (tuning.aeroRear - tuning.aeroFront) * 0.06 * speedFactor, 0.94, 1.08);
    const frontAeroBias = clamp(1 + (tuning.aeroFront - tuning.aeroRear) * 0.06 * speedFactor, 0.94, 1.08);
    const travelCompliance = clamp(0.92 + (tuning.suspensionTravelFront + tuning.suspensionTravelRear) * 0.08, 0.9, 1.08);
    const differentialLock = tuning.drivetrain === 'fwd'
      ? tuning.frontDifferentialAccel
      : tuning.drivetrain === 'rwd'
        ? tuning.rearDifferentialAccel
        : (tuning.frontDifferentialAccel + tuning.rearDifferentialAccel) * 0.5;
    const centerBias = tuning.drivetrain === 'awd' ? clamp(Number(tuning.centerDifferentialBalance) || 0.5, 0.1, 0.9) : 0.5;
    const awdFrontBias = tuning.drivetrain === 'awd' ? clamp(1 + (0.5 - centerBias) * 0.18, 0.92, 1.08) : 1;
    const awdRearBias = tuning.drivetrain === 'awd' ? clamp(1 + (centerBias - 0.5) * 0.18, 0.92, 1.08) : 1;
    const awdTractionBias = tuning.drivetrain === 'awd'
      ? clamp(1 + (0.5 - Math.abs(centerBias - 0.5)) * 0.05, 0.98, 1.04)
      : 1;
    return {
      grip: camberGrip * toePenalty * ridePenalty * dampingGrip * aeroGrip * travelCompliance,
      frontGrip: frontAeroBias * awdFrontBias * clamp(1 - (springBalance - 1) * 0.24 - (antiRollBalance - 1) * 0.18, 0.88, 1.12),
      rearGrip: rearAeroBias * awdRearBias * clamp(1 + (springBalance - 1) * 0.24 + (antiRollBalance - 1) * 0.18, 0.88, 1.12),
      yawStability: casterStability * clamp(1 + (tuning.rearDifferentialDecel - tuning.frontDifferentialDecel) * 0.04, 0.94, 1.06),
      driveTraction: clamp((1 + differentialLock * 0.12) * awdTractionBias, 0.96, 1.14),
      aeroDrag: 1 + (tuning.aeroFront + tuning.aeroRear) * 0.06
    };
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
    if (amount <= 0.02 || Math.abs(Number(speedMps) || 0) < 0.45) {
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

  getRaceAudibleTireSlip({
    wheelSpin = 0,
    brakeLock = 0,
    slipAngle = 0,
    scrub = 0,
    leftSlip = 0,
    rightSlip = 0,
    speedMps = 0
  } = {}) {
    const speedFactor = clamp(Math.abs(Number(speedMps) || 0) / 18, 0, 1);
    return clamp(Math.max(
      Math.max(0, Number(wheelSpin) || 0),
      Math.max(0, Number(brakeLock) || 0),
      Math.max(0, Number(scrub) || 0),
      clamp((Math.abs(Number(slipAngle) || 0) - 0.045) / 0.34, 0, 1),
      Math.max(0, Number(leftSlip || 0) - 0.72) * 0.34,
      Math.max(0, Number(rightSlip || 0) - 0.72) * 0.34
    ) * speedFactor, 0, 1);
  }

  getRaceGearRatio(tuning, gear) {
    if (gear < 0) return tuning.reverseRatio;
    if (gear <= 0) return 0;
    return tuning.gearRatios[clamp(gear - 1, 0, tuning.gearRatios.length - 1)] || tuning.gearRatios[tuning.gearRatios.length - 1] || 1;
  }

  getRaceTorqueNmAtRpm(rpm, tuning) {
    const curvePoints = Array.isArray(tuning?.engineCurve?.torquePoints)
      ? tuning.engineCurve.torquePoints
        .map((point) => ({
          rpm: Number(point?.rpm) || 0,
          torqueLbFt: Number(point?.torqueLbFt) || 0
        }))
        .filter((point) => point.rpm > 0 && point.torqueLbFt > 0)
        .sort((a, b) => a.rpm - b.rpm)
      : [];
    if (curvePoints.length >= 2) {
      const targetRpm = Math.max(0, Number(rpm) || 0);
      if (targetRpm <= curvePoints[0].rpm) return curvePoints[0].torqueLbFt * 1.35582;
      for (let index = 1; index < curvePoints.length; index += 1) {
        const previous = curvePoints[index - 1];
        const next = curvePoints[index];
        if (targetRpm > next.rpm) continue;
        const ratio = clamp((targetRpm - previous.rpm) / Math.max(1, next.rpm - previous.rpm), 0, 1);
        return (previous.torqueLbFt + (next.torqueLbFt - previous.torqueLbFt) * ratio) * 1.35582;
      }
      return curvePoints[curvePoints.length - 1].torqueLbFt * 1.35582;
    }
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

  getRaceProjectedEngineRpmForGear(tuning, speedMps = 0, gear = 1) {
    const ratio = this.getRaceGearRatio(tuning, gear);
    if (!ratio) return tuning?.idleRpm || 900;
    return Math.abs(Number(speedMps) || 0)
      / Math.max(0.01, tuning.wheelRadiusM)
      * ratio
      * tuning.finalDrive
      * (60 / (Math.PI * 2));
  }

  canRaceAutomaticDownshift(tuning, speedMps = 0, targetGear = 1) {
    if (targetGear <= 0) return true;
    const projectedRpm = this.getRaceProjectedEngineRpmForGear(tuning, speedMps, targetGear);
    const safeDownshiftRpm = Math.min(
      Number(tuning.autoUpshiftRpm) || Number(tuning.redlineRpm) || 5800,
      (Number(tuning.redlineRpm) || Number(tuning.revLimitRpm) || 6200) - 450
    );
    return projectedRpm <= safeDownshiftRpm;
  }

  getRaceCheckpointDistances({ routeLength = this.getRaceRouteLength() } = {}) {
    const routeEnd = Math.max(1, Number(routeLength) || 1);
    const nodes = this.getRaceEditableNodes({ create: false });
    const rawDistances = [];
    if (nodes.length >= 2) {
      for (const node of nodes) {
        const projection = this.getRaceRouteProjectionForWorldPoint({
          x: Number(node.x || 0),
          z: Number(node.y || 0)
        });
        rawDistances.push(clamp(Number(projection.distance || 0), 0, routeEnd));
      }
    } else {
      let cursor = 0;
      rawDistances.push(0);
      for (const segment of this.selectedRace?.road?.segments || []) {
        cursor += Math.max(1, Number(segment.length) || 1);
        rawDistances.push(clamp(cursor, 0, routeEnd));
      }
    }
    rawDistances.push(routeEnd);
    const sorted = rawDistances
      .filter((distance) => Number.isFinite(distance))
      .map((distance) => Math.round(clamp(distance, 0, routeEnd) * 100) / 100)
      .sort((a, b) => a - b);
    const unique = [];
    for (const distance of sorted) {
      if (!unique.some((existing) => Math.abs(existing - distance) < Math.max(3, this.getRaceCarWorldWidth()))) {
        unique.push(distance);
      }
    }
    return unique;
  }

  didRacePassDistance(previousDistance = 0, nextDistance = 0, targetDistance = 0, routeLength = this.getRaceRouteLength(), routeRuntimeType = this.getActiveRaceRuntimeType()) {
    const routeEnd = Math.max(1, Number(routeLength) || 1);
    const previous = routeRuntimeType === 'circuit'
      ? ((Number(previousDistance || 0) % routeEnd) + routeEnd) % routeEnd
      : clamp(Number(previousDistance) || 0, 0, routeEnd);
    const next = routeRuntimeType === 'circuit'
      ? ((Number(nextDistance || 0) % routeEnd) + routeEnd) % routeEnd
      : clamp(Number(nextDistance) || 0, 0, routeEnd);
    const target = routeRuntimeType === 'circuit'
      ? ((Number(targetDistance || 0) % routeEnd) + routeEnd) % routeEnd
      : clamp(Number(targetDistance) || 0, 0, routeEnd);
    if (routeRuntimeType === 'circuit' && next < previous) {
      return target >= previous || target <= next;
    }
    return target >= previous && target <= next;
  }

  updateRaceCheckpointProgress({ previousDistance = 0, nextDistance = 0, routeAdvance = 0 } = {}) {
    const session = this.playtestSession;
    if (!session || routeAdvance <= 0) return false;
    const checkpoints = Array.isArray(session.checkpointDistances) ? session.checkpointDistances : [];
    if (!checkpoints.length) return true;
    const routeLength = Math.max(1, Number(session.routeLength || this.getRaceRouteLength()));
    const routeRuntimeType = session.routeRuntimeType || this.getSelectedRaceRuntimeType();
    let passedAny = false;
    let index = clamp(Math.floor(Number(session.checkpointIndex) || 0), 0, checkpoints.length);
    while (index < checkpoints.length) {
      const target = checkpoints[index];
      if (!this.didRacePassDistance(previousDistance, nextDistance, target, routeLength, routeRuntimeType)) break;
      session.passedCheckpoints = Array.from(new Set([...(session.passedCheckpoints || []), index]));
      index += 1;
      passedAny = true;
    }
    session.checkpointIndex = index;
    return passedAny;
  }

  didRaceHazardContactCar(hazard = {}, session = this.playtestSession) {
    if (!session || !hazard) return false;
    const roadHalfWidth = Math.max(1, this.getRaceRoadHalfWidthWorld(this.getRaceSegmentAtDistance(session.distance).segment));
    const lateralMeters = clamp(Number(session.lateral || 0), -1, 1) * roadHalfWidth;
    const carHalfWidth = this.getRaceCarWorldWidth() * 0.5;
    if (hazard.side === 'left') return lateralMeters <= -roadHalfWidth + carHalfWidth * 1.35;
    if (hazard.side === 'right') return lateralMeters >= roadHalfWidth - carHalfWidth * 1.35;
    if (hazard.side === 'rear') return Math.abs(Number(session.speedMps || 0)) < 0.8;
    if (Number.isFinite(Number(hazard.lane))) {
      const laneOffset = clamp(Number(hazard.lane) || 0, -1, 1) * roadHalfWidth * 0.56;
      const envelope = Math.max(carHalfWidth + Number(hazard.radiusM || 0.9), roadHalfWidth * 0.18);
      return Math.abs(lateralMeters - laneOffset) <= envelope;
    }
    return true;
  }

  updateRaceWearAndDamage(seconds = 0) {
    const session = this.playtestSession;
    if (!session) return;
    const car = this.project.cars.find((candidate) => candidate.id === session.carId) || this.selectedCar;
    const tireWearMultiplier = this.getRaceTireWearMultiplier(car);
    const damage = this.getRaceSessionDamage();
    const speed = Number(session.speedMps || 0);
    const steer = Number(this.raceInput.steeringWheel || 0);
    const tireSlip = session.tireSlip || {};
    const drift = Math.max(
      Number(tireSlip.scrub || 0),
      Number(tireSlip.wheelSpin || 0),
      Number(tireSlip.brakeLock || 0),
      Number(tireSlip.audibleSlip || 0)
    ) + (this.raceInput.handbrake ? 0.25 : 0);
    const baseWear = seconds * (0.006 + speed * 0.00055) * tireWearMultiplier;
    const leftWear = baseWear + seconds * Math.max(0.12, Number(tireSlip.left || 0)) * drift * 0.24;
    const rightWear = baseWear + seconds * Math.max(0.12, Number(tireSlip.right || 0)) * drift * 0.24;
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
          pull: (Math.random() - 0.5) * 0.08,
          source: `hazard:${hazard.id}`
        });
      } else if (this.didRaceHazardContactCar(hazard, session)) {
        const amount = Number(hazard.damage || 10);
        const panelKeys = hazard.side === 'left'
          ? ['left']
          : hazard.side === 'right'
            ? ['right']
            : hazard.side === 'rear'
              ? ['rear']
              : ['front'];
        this.applyRaceDamage('panels', amount, { keys: panelKeys, source: `hazard:${hazard.id}` });
        if (hazard.side === 'left') this.applyRaceDamage('suspension', amount * 0.15, { keys: ['fl', 'rl'], pull: 0.025, source: `hazard:${hazard.id}` });
        if (hazard.side === 'right') this.applyRaceDamage('suspension', amount * 0.15, { keys: ['fr', 'rr'], pull: -0.025, source: `hazard:${hazard.id}` });
        if (!hazard.side || hazard.side === 'front') this.applyRaceDamage('suspension', amount * 0.08, { keys: ['fl', 'fr'], source: `hazard:${hazard.id}` });
      }
    });
    this.updateRaceSceneryCollisions(seconds);
  }

  updateRaceSceneryCollisions(seconds = 0) {
    const session = this.playtestSession;
    if (!session) return;
    const scenery = this.ensureRaceScenery();
    if (!scenery.length) return;
    session.triggeredSceneryIds = Array.isArray(session.triggeredSceneryIds) ? session.triggeredSceneryIds : [];
    const car = this.project.cars.find((candidate) => candidate.id === session.carId) || this.selectedCar;
    const contactPoints = this.getRaceVehicleCollisionContactPoints({
      session,
      car,
      tuning: this.getRaceCarTuning(car)
    });
    const wheelProbeRadius = 0.34;
    const bodyProbeRadius = 0.18;
    const speed = Math.abs(Number(session.speedMps || 0));
    scenery.forEach((sprite) => {
      if (!sprite?.id || sprite.state === 'removed' || sprite.state === 'flattened' || session.triggeredSceneryIds.includes(sprite.id)) return;
      const spriteRadius = Math.max(0.35, Number(sprite.widthM || 1.4) * 0.5);
      let hit = null;
      contactPoints.forEach((point) => {
        if (hit) return;
        const probeRadius = point.wheel ? wheelProbeRadius : bodyProbeRadius;
        const dx = Number(point.x || 0) - Number(sprite.x || 0);
        const dz = Number(point.z || 0) - Number(sprite.z || 0);
        const distance = Math.hypot(dx, dz);
        if (distance <= spriteRadius + probeRadius) {
          hit = { point, dx, dz, distance };
        }
      });
      if (!hit) return;
      const dx = hit.dx;
      const dz = hit.dz;
      const impactNormal = Math.atan2(dx, dz);
      const impactAngle = Math.atan2(
        Math.sin(Number(session.carYaw || 0) - impactNormal),
        Math.cos(Number(session.carYaw || 0) - impactNormal)
      );
      const severity = clamp(speed / 34, 0.08, 2.4) * (0.65 + Math.abs(Math.cos(impactAngle)) * 0.7);
      session.triggeredSceneryIds.push(sprite.id);
      if (sprite.behavior === 'flatten') {
        sprite.state = 'flattened';
        session.speedMps *= Math.max(0.55, 1 - severity * 0.18);
        this.applyRaceDamage('panels', severity * 2.5, { keys: ['front'], source: `scenery:${sprite.id}` });
        return;
      }
      if (sprite.behavior === 'fly-off') {
        sprite.state = 'removed';
        const weightFactor = clamp(45 / Math.max(5, Number(sprite.weightKg || 35)), 0.12, 1.4);
        session.speedMps *= Math.max(0.42, 1 - severity * 0.16 / weightFactor);
        session.yawVelocityRadps += Math.sin(impactAngle) * severity * 0.32;
        this.applyRaceDamage('panels', severity * 4.5, { keys: ['front'], source: `scenery:${sprite.id}` });
        return;
      }
      const bounce = clamp(severity * 0.34, 0.12, 0.82);
      session.speedMps *= -bounce;
      session.yawVelocityRadps += Math.sin(impactAngle) * severity * 1.35;
      session.carYaw += Math.sin(impactAngle) * severity * 0.18;
      session.worldX += Math.sin(impactNormal) * Math.max(0.2, speed * Number(seconds || 0.016));
      session.worldZ += Math.cos(impactNormal) * Math.max(0.2, speed * Number(seconds || 0.016));
      this.applyRaceDamage('panels', severity * 14, { keys: Math.abs(impactAngle) > 1.2 ? ['left', 'right'] : ['front'], source: `scenery:${sprite.id}` });
      this.applyRaceDamage('suspension', severity * 6, { keys: ['fl', 'fr'], pull: Math.sin(impactAngle) * 0.04, source: `scenery:${sprite.id}` });
      this.applyRaceDamage('engine', severity * 3.5, { source: `scenery:${sprite.id}` });
    });
  }

  getRacePlaytestCameraYaw(session = this.playtestSession) {
    const lookAngle = this.hasPhysicalRaceGamepad() ? Number(this.raceInput?.lookAngle || 0) : 0;
    const absSpeed = Math.abs(Number(session?.speedMps || 0));
    const launchHoldActive = Number(session?.launchLockMs || 0) > 0
      && absSpeed < 2.2
      && Math.abs(lookAngle) < 0.001;
    if (launchHoldActive && Number.isFinite(session?.startYaw)) return Number(session.startYaw);
    return Number(session?.carYaw || 0) + lookAngle;
  }

  updatePlaytest(dt = 0) {
    if (!this.playtestSession?.running) return;
    if (this.raceInput.paused) return;
    const car = this.project.cars.find((candidate) => candidate.id === this.playtestSession.carId) || this.selectedCar;
    const tuning = this.getRaceCarTuning(car);
    tuning.absEnabled = this.playtestSession.absEnabled !== false;
    tuning.tractionControlEnabled = this.playtestSession.tractionControlEnabled !== false;
    const seconds = Math.max(0, Number(dt) || 0);
    this.applyRaceAnalogInput();
    const physicalGamepad = this.hasPhysicalRaceGamepad();
    if (!physicalGamepad) this.raceInput.lookIntentX = 0;
    const lookTarget = physicalGamepad ? clamp(Number(this.raceInput.lookIntentX || 0), -1, 1) * Math.PI : 0;
    const lookRate = Math.abs(lookTarget) > 0.01 ? 7.5 : 4.2;
    this.raceInput.lookAngle += (lookTarget - Number(this.raceInput.lookAngle || 0)) * Math.min(1, seconds * lookRate);
    this.updateRacePedalAxes(seconds);
    const launchSteeringLocked = this.isRaceLaunchSteeringLocked(this.playtestSession)
      && this.raceInput.analogSteeringActive;
    if (launchSteeringLocked) {
      this.raceInput.steeringTarget = 0;
      this.raceInput.steeringWheel = 0;
      this.raceInput.digitalSteerHoldMs = 0;
      this.playtestSession.lateral = 0;
      this.playtestSession.heading = 0;
      this.playtestSession.roadViewOffset = 0;
      this.playtestSession.trackViewOffset = 0;
      this.playtestSession.yawVelocityRadps = 0;
    }
    const damageEffects = this.getRaceDamageEffects();
    const segmentInfo = this.getRaceSegmentAtDistance(this.playtestSession.distance, {
      wrap: (this.playtestSession.routeRuntimeType || this.getSelectedRaceRuntimeType()) === 'circuit'
    });
    const weatherState = this.getRaceWeatherState(this.selectedRace, this.playtestSession);
    const surface = getSurfaceById(this.getRaceEffectiveSurfaceId(segmentInfo.segment?.surface || 'asphalt', weatherState));
    const engineJitter = damageEffects.engineJitter
      ? 1 - damageEffects.engineJitter * (0.5 + 0.5 * Math.sin(this.playtestSession.elapsedMs / 173))
      : 1;
    const setupModifiers = this.getRaceSetupPhysicsModifiers(tuning, this.playtestSession.speedMps);
    const damage = this.getRaceSessionDamage();
    const wheelSurfaceState = this.getRaceWheelSurfaceState({ car, tuning, session: this.playtestSession, damage });
    const surfaceGrip = wheelSurfaceState.averageSurfaceGrip || (surface.grip * this.getRaceSegmentSurfaceDetailGrip(segmentInfo.segment));
    const tireSetupGrip = this.getRaceTireSetupGripMultiplier(car, surface.id, weatherState.id);
    const tireTemperatureGrip = this.getRaceTireTemperatureGripMultipliers(this.playtestSession?.diagnostics?.tireTemperature);
    const tireTemperatureGripAverage = RACE_WHEEL_IDS.reduce((sum, wheelId) => sum + Number(tireTemperatureGrip[wheelId] || 1), 0) / RACE_WHEEL_IDS.length;
    const gripFactor = Math.max(0.35, Math.min(1.4, tuning.tireGrip)) * surfaceGrip * this.getRaceWeatherGripMultiplier(weatherState) * tireSetupGrip * tireTemperatureGripAverage * damageEffects.grip * setupModifiers.grip;
    const perWheelGrip = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      clamp(Number(wheelSurfaceState.gripByWheel?.[wheelId] || 0.7) * Number(tireTemperatureGrip[wheelId] || 1), 0.08, 1.38)
    ]));
    const leftTireGrip = (perWheelGrip.fl + perWheelGrip.rl) * 0.5;
    const rightTireGrip = (perWheelGrip.fr + perWheelGrip.rr) * 0.5;
    let gear = clamp(Math.round(Number(this.raceInput.gear ?? 0)), -1, tuning.gearRatios.length);
    let throttle = clamp(Number(this.raceInput.throttleAxis || 0), 0, 1);
    let brake = clamp(Number(this.raceInput.brakeAxis || 0), 0, 1);
    const driverThrottle = throttle;
    const driverBrake = brake;
    const handbrake = this.raceInput.handbrake ? 1 : 0;
    if (handbrake) {
      this.playtestSession.handbrakeSlipMs = Math.max(Number(this.playtestSession.handbrakeSlipMs || 0), 760);
    } else {
      this.playtestSession.handbrakeSlipMs = Math.max(0, Number(this.playtestSession.handbrakeSlipMs || 0) - seconds * 1000);
    }
    const handbrakeSlip = clamp(Number(this.playtestSession.handbrakeSlipMs || 0) / 760, 0, 1);
    const isAutomatic = this.raceInput.autoShift && tuning.shiftMode !== 'manual';
    const absSpeedBefore = Math.abs(this.playtestSession.speedMps);
    if (isAutomatic && gear <= 0 && throttle > RACE_PEDAL_INPUT.activeThreshold && absSpeedBefore < 1.1) {
      gear = 1;
      this.raceInput.gear = 1;
    }
    if (isAutomatic && gear < 0 && driverThrottle > RACE_PEDAL_INPUT.activeThreshold) {
      gear = 1;
      this.raceInput.gear = 1;
    }
    if (isAutomatic && brake > RACE_PEDAL_INPUT.reverseThreshold && throttle <= RACE_PEDAL_INPUT.activeThreshold && absSpeedBefore < 0.75 && gear >= 0) {
      gear = -1;
      this.raceInput.gear = -1;
    }
    const automaticReverseBrakeActive = isAutomatic
      && gear < 0
      && brake > RACE_PEDAL_INPUT.activeThreshold
      && throttle <= RACE_PEDAL_INPUT.activeThreshold;
    if (automaticReverseBrakeActive) {
      throttle = brake;
      brake = 0;
    }
    if (isAutomatic && gear < 0 && driverThrottle > RACE_PEDAL_INPUT.activeThreshold && absSpeedBefore < 0.75) {
      gear = 1;
      this.raceInput.gear = 1;
    }
    const gearRatio = this.getRaceGearRatio(tuning, gear);
    const binarySteer = launchSteeringLocked ? 0 : clamp(Number(this.raceInput.binarySteer || 0), -1, 1);
    const binaryActive = Math.abs(binarySteer) > 0.01;
    if (launchSteeringLocked) {
      this.raceInput.digitalSteerHoldMs = 0;
    } else if (this.raceInput.analogSteeringActive) {
      this.raceInput.lastSteeringInputMode = 'analog';
      this.raceInput.digitalSteerHoldMs = 0;
      const analogIntent = clamp(Number(this.raceInput.analogSteeringIntent || 0), -1, 1);
      const analogRate = this.getRaceAnalogSteeringTargetRate(this.playtestSession.speedMps, analogIntent);
      this.raceInput.steeringTarget += (analogIntent - Number(this.raceInput.steeringTarget || 0)) * Math.min(0.38, seconds * analogRate);
    } else {
      if (binaryActive) {
        this.raceInput.lastSteeringInputMode = 'binary';
        this.raceInput.digitalSteerHoldMs = Number(this.raceInput.digitalSteerHoldMs || 0) + seconds * 1000;
        const hold = clamp(Number(this.raceInput.digitalSteerHoldMs || 0) / 420, 0, 1);
        const nudgeRate = 1.85 + hold * 2.4;
        this.raceInput.steeringTarget += binarySteer * seconds * nudgeRate;
      } else {
        this.raceInput.digitalSteerHoldMs = 0;
        const analogCentered = this.raceInput.lastSteeringInputMode === 'analog';
        const centeredMs = Number(this.raceInput.analogSteeringCenteredMs || 0) + (analogCentered ? seconds * 1000 : 0);
        if (analogCentered) this.raceInput.analogSteeringCenteredMs = centeredMs;
        const returnRate = analogCentered
          ? this.getRaceAnalogSteeringReleaseRate(this.playtestSession.speedMps) * (centeredMs > 90 ? 1.45 : 1)
          : this.getRaceSteeringReturnRate(this.playtestSession.speedMps);
        this.raceInput.steeringTarget += (0 - Number(this.raceInput.steeringTarget || 0)) * Math.min(0.88, seconds * returnRate);
      }
    }
    this.raceInput.steeringTarget = clamp(this.raceInput.steeringTarget, -1, 1);
    const activeTurnInput = !launchSteeringLocked && (binaryActive || this.raceInput.analogSteeringActive);
    const wheelResponse = this.raceInput.analogSteeringActive
      ? this.getRaceAnalogSteerResponse(this.playtestSession.speedMps)
      : (binaryActive ? this.getRaceBinarySteerAssist(this.playtestSession.speedMps).response : this.getRaceSteeringReturnRate(this.playtestSession.speedMps) + 1.2);
    const wheelResponseStep = Math.min(
      activeTurnInput ? 1.05 * RACE_CONTROLLER_STEERING.activeTurnResponseScale : 0.94,
      seconds * wheelResponse * (activeTurnInput ? RACE_CONTROLLER_STEERING.activeTurnResponseScale : 1)
    );
    this.raceInput.steeringWheel += (this.raceInput.steeringTarget - this.raceInput.steeringWheel) * wheelResponseStep;
    if (!this.raceInput.analogSteeringActive
      && !binaryActive
      && Math.abs(this.raceInput.steeringWheel) < 0.026
      && Math.abs(this.raceInput.steeringTarget) < 0.026) {
      this.raceInput.steeringWheel = 0;
      this.raceInput.steeringTarget = 0;
      this.raceInput.analogSteeringCenteredMs = 0;
      this.raceInput.lastSteeringInputMode = null;
    }
    const driveDirection = gear < 0 ? -1 : gear > 0 ? 1 : 0;
    this.playtestSession.previousDistance = this.playtestSession.distance;
    this.playtestSession.elapsedMs += seconds * 1000;
    this.playtestSession.launchLockMs = Math.max(0, Number(this.playtestSession.launchLockMs || 0) - seconds * 1000);
    this.playtestSession.edgeResetFadeMs = Math.max(0, Number(this.playtestSession.edgeResetFadeMs || 0) - seconds * 1000);
    this.updateRaceEdgeCenterResetFade();
    this.playtestSession.shiftCooldownMs = Math.max(0, Number(this.playtestSession.shiftCooldownMs || 0) - seconds * 1000);
    const wheelRpm = gearRatio
      ? (absSpeedBefore / Math.max(0.01, tuning.wheelRadiusM)) * gearRatio * tuning.finalDrive * (60 / (Math.PI * 2))
      : 0;
    const limiterPhase = Math.sin(this.playtestSession.elapsedMs / 34) > 0 ? 1 : 0;
    const neutralLimiterTarget = tuning.revLimitRpm - tuning.revLimiterDropRpm * limiterPhase;
    const neutralRevTarget = throttle > RACE_PEDAL_INPUT.activeThreshold ? neutralLimiterTarget : tuning.idleRpm;
    const loadedRpmTarget = gearRatio
      ? clamp(
        Math.max(wheelRpm * (1 + tuning.torqueConverterSlip * throttle), throttle > RACE_PEDAL_INPUT.activeThreshold ? Math.min(tuning.launchRpm, tuning.revLimitRpm) : tuning.idleRpm),
        tuning.idleRpm,
        tuning.revLimitRpm
      )
      : neutralRevTarget;
    const rpmResponse = gearRatio ? (throttle > RACE_PEDAL_INPUT.activeThreshold ? 4.6 : 8.5) : (throttle > RACE_PEDAL_INPUT.activeThreshold ? 7.6 : 3.8);
    this.playtestSession.engineRpm = Number(this.playtestSession.engineRpm || tuning.idleRpm)
      + (loadedRpmTarget - Number(this.playtestSession.engineRpm || tuning.idleRpm)) * Math.min(1, seconds * rpmResponse);
    this.playtestSession.engineRpm = clamp(this.playtestSession.engineRpm, tuning.idleRpm * 0.72, tuning.revLimitRpm + (gearRatio ? 40 : 80));
    const limiterActive = this.playtestSession.engineRpm >= tuning.revLimitRpm - 80;
    const limiterCut = limiterActive && throttle > RACE_PEDAL_INPUT.activeThreshold ? 0.08 + 0.18 * limiterPhase : 1;
    const shiftTorqueCut = this.playtestSession.shiftCooldownMs > 0
      ? clamp(1 - (this.playtestSession.shiftCooldownMs / Math.max(1, tuning.shiftTimeMs + this.getRaceDamageEffects().shiftDelayMs)), 0.12, 1)
      : 1;
    const launchAssistRpm = tuning.idleRpm + (tuning.launchRpm - tuning.idleRpm) * clamp(absSpeedBefore / 5, 0.35, 1);
    const torqueRpm = gearRatio && throttle > RACE_PEDAL_INPUT.activeThreshold && absSpeedBefore < 5
      ? Math.max(this.playtestSession.engineRpm, launchAssistRpm)
      : this.playtestSession.engineRpm;
    const engineTorqueNm = this.getRaceTorqueNmAtRpm(torqueRpm, tuning) * damageEffects.enginePower * engineJitter;
    const availablePowerW = tuning.powerHp * 745.7 * damageEffects.enginePower * engineJitter;
    const wheelForceFromTorque = gearRatio
      ? (engineTorqueNm * gearRatio * tuning.finalDrive * tuning.drivetrainEfficiency) / tuning.wheelRadiusM
      : 0;
    const wheelForceFromPower = absSpeedBefore > 8
      ? (availablePowerW * tuning.drivetrainEfficiency) / Math.max(8, absSpeedBefore)
      : wheelForceFromTorque;
    let driveForceRaw = Math.min(wheelForceFromTorque, wheelForceFromPower) * tuning.accelerationCalibration * throttle * limiterCut * shiftTorqueCut * driveDirection;
    if (automaticReverseBrakeActive && driverThrottle <= RACE_PEDAL_INPUT.activeThreshold && driverBrake > RACE_PEDAL_INPUT.activeThreshold) {
      const reverseAssistForce = tuning.weightKg * 2.4 * clamp(driverBrake, 0, 1);
      driveForceRaw = Math.min(driveForceRaw, -reverseAssistForce);
    }
    if (this.playtestSession.rolledOver) {
      throttle = 0;
      brake = 0;
      driveForceRaw = 0;
    }
    const initialNormalLoads = this.getRaceWheelNormalLoads(tuning);
    const drivenWheelIds = this.getRaceDrivenWheelIds(tuning);
    const drivenTractionLimit = drivenWheelIds.reduce((sum, wheelId) => (
      sum + initialNormalLoads[wheelId] * Math.max(0.1, perWheelGrip[wheelId] || 0)
    ), 0) * Math.max(0.45, clamp(gripFactor, 0.28, 1.35)) * setupModifiers.driveTraction;
    const tractionControlSlip = driveForceRaw
      ? clamp((Math.abs(driveForceRaw) / Math.max(1, drivenTractionLimit) - 0.92) / 0.58, 0, 1)
      : 0;
    const tractionControlCut = tuning.tractionControlEnabled && !handbrake
      ? 1 - tractionControlSlip * 0.55
      : 1;
    if (tractionControlCut < 1) driveForceRaw *= tractionControlCut;
    const driveForce = clamp(driveForceRaw, -drivenTractionLimit, drivenTractionLimit);
    const wheelSpinRatio = driveForceRaw
      ? clamp(Math.abs(driveForceRaw) / Math.max(1, drivenTractionLimit), 0, 1.8)
      : 0;
    const brakeState = this.getRaceBrakeForceForInput({
      tuning,
      brake,
      handbrake,
      gripByWheel: Object.fromEntries(Object.entries(perWheelGrip).map(([wheelId, grip]) => [wheelId, grip * Math.max(0.35, gripFactor)])),
      normalLoads: initialNormalLoads,
      speedMps: this.playtestSession.speedMps
    });
    const brakeForce = brakeState.force;
    const offRoadWheelCount = Object.values(wheelSurfaceState.terrainByWheel).filter((terrain) => terrain !== 'road').length;
    const terrainResistance = 1 + offRoadWheelCount * 0.18
      + Object.values(wheelSurfaceState.terrainGripScaleByWheel).reduce((sum, value) => sum + Math.max(0, 1 - Number(value || 1)), 0) * 0.22;
    const rollingForce = (180 + absSpeedBefore * 7.5) * terrainResistance;
    const dragForce = (tuning.dragCoefficient * setupModifiers.aeroDrag * absSpeedBefore * absSpeedBefore + rollingForce) * damageEffects.panelDrag;
    const resistanceDirection = this.playtestSession.speedMps >= 0 ? -1 : 1;
    const brakeDirection = this.playtestSession.speedMps >= 0 ? -1 : 1;
    const gradeSampleDistance = 12;
    const gradeRuntimeType = this.playtestSession.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const gradeProfile = this.getRaceRoadSurfaceProfileAtDistance(Number(this.playtestSession.distance || 0), { runtimeType: gradeRuntimeType });
    const gradeAheadProfile = this.getRaceRoadSurfaceProfileAtDistance(Number(this.playtestSession.distance || 0) + gradeSampleDistance, { runtimeType: gradeRuntimeType });
    const gradeBehindProfile = this.getRaceRoadSurfaceProfileAtDistance(Number(this.playtestSession.distance || 0) - gradeSampleDistance, { runtimeType: gradeRuntimeType });
    const roadGrade = Number.isFinite(Number(gradeProfile.grade))
      ? Number(gradeProfile.grade)
      : clamp(
        ((Number(gradeAheadProfile.elevation || 0) - Number(gradeBehindProfile.elevation || 0)) * RACE_THREE_ELEVATION_M) / (gradeSampleDistance * 2),
        -0.42,
        0.42
      );
    const gradeForce = -tuning.weightKg * 9.81 * roadGrade;
    const acceleration = (
      driveForce
      + gradeForce
      + resistanceDirection * dragForce
      + brakeDirection * brakeForce
    ) / tuning.weightKg;
    this.playtestSession.speedMps += acceleration * seconds;
    if (!throttle && Math.abs(this.playtestSession.speedMps) < 0.08 && Math.abs(roadGrade) < 0.01) this.playtestSession.speedMps = 0;
    if (automaticReverseBrakeActive && driverThrottle <= RACE_PEDAL_INPUT.activeThreshold) {
      const reverseTargetMps = -clamp(2.2 + driverBrake * 5.2, 2.2, 7.4);
      if (this.playtestSession.speedMps > reverseTargetMps) {
        this.playtestSession.speedMps += (reverseTargetMps - this.playtestSession.speedMps) * Math.min(1, seconds * 2.1);
      }
    }
    const topSpeedMps = tuning.topSpeedMps * damageEffects.enginePower;
    if (this.playtestSession.speedMps > topSpeedMps) {
      this.playtestSession.speedMps += (topSpeedMps - this.playtestSession.speedMps) * Math.min(1, seconds * 1.8);
    } else if (this.playtestSession.speedMps < -9) {
      this.playtestSession.speedMps += (-9 - this.playtestSession.speedMps) * Math.min(1, seconds * 3);
    }
    const routeRuntimeType = this.playtestSession.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const absSpeed = Math.abs(this.playtestSession.speedMps);
    const launchLockActive = this.isRaceLaunchSteeringLocked(this.playtestSession);
    const roadSteer = launchSteeringLocked ? 0 : this.raceInput.steeringWheel;
    const roadPose = this.getRaceWorldPoseAtDistance(this.playtestSession.distance, { runtimeType: routeRuntimeType });
    const previousRoadPose = this.getRaceWorldPoseAtDistance(Number(this.playtestSession.previousDistance || this.playtestSession.distance || 0), { runtimeType: routeRuntimeType });
    const roadProfile = this.getRaceRoadSurfaceProfileAtDistance(this.playtestSession.distance, { runtimeType: routeRuntimeType });
    const previousRoadProfile = this.getRaceRoadSurfaceProfileAtDistance(Number(this.playtestSession.previousDistance || this.playtestSession.distance || 0), { runtimeType: routeRuntimeType });
    roadPose.elevation = roadProfile.elevation;
    previousRoadPose.elevation = previousRoadProfile.elevation;
    const roadYaw = roadPose.yaw;
    const previousCarYaw = Number.isFinite(this.playtestSession.carYaw)
      ? this.playtestSession.carYaw
      : roadYaw;
    const wheelbaseM = tuning.wheelbaseM;
    const launchAligning = launchLockActive || (Number(this.playtestSession.elapsedMs || 0) <= 120 && absSpeed < 0.8);
    const effectiveRoadSteer = launchAligning ? 0 : roadSteer;
    const rawSteeringAngle = launchAligning
      ? 0
      : this.getRacePhysicalTireAngleForSteering(effectiveRoadSteer, absSpeed);
    const steeringSpeedScale = launchAligning ? 0 : clamp(absSpeed / 2.5, 0, 1);
    const lateralForceSpeedScale = launchAligning ? 0 : clamp((absSpeed - 1.8) / 8, 0, 1);
    const previousVelocityYaw = Number.isFinite(this.playtestSession.velocityYaw)
      ? this.playtestSession.velocityYaw
      : previousCarYaw;
    const vehicleSlipAngle = normalizeAngle(previousVelocityYaw - previousCarYaw);
    const previousLateralAcceleration = Number(this.playtestSession.tireSlip?.lateralAcceleration || 0);
    const dynamicNormalLoads = this.getRaceWheelNormalLoads(tuning, acceleration, previousLateralAcceleration);
    const frontGrip = (perWheelGrip.fl + perWheelGrip.fr) * 0.5 * Math.max(0.25, gripFactor) * setupModifiers.frontGrip;
    const rearGrip = (perWheelGrip.rl + perWheelGrip.rr) * 0.5 * Math.max(0.25, gripFactor) * setupModifiers.rearGrip * (1 - handbrakeSlip * 0.92);
    const frontNormal = dynamicNormalLoads.fl + dynamicNormalLoads.fr;
    const rearNormal = dynamicNormalLoads.rl + dynamicNormalLoads.rr;
    const driveForcePerDrivenWheel = drivenWheelIds.length ? Math.abs(driveForceRaw) / drivenWheelIds.length : 0;
    const wheelLongitudinalUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
      const wheelLimit = Math.max(1, dynamicNormalLoads[wheelId] * Math.max(0.1, perWheelGrip[wheelId]) * Math.max(0.25, gripFactor));
      const brakeUsage = Number(brakeState.appliedByWheel?.[wheelId] || 0);
      const driveUsage = drivenWheelIds.includes(wheelId) ? driveForcePerDrivenWheel : 0;
      return [wheelId, clamp((brakeUsage + driveUsage) / wheelLimit, 0, 1.35)];
    }));
    const frontFrictionCircle = Math.sqrt(Math.max(0.08, 1 - Math.pow((wheelLongitudinalUsage.fl + wheelLongitudinalUsage.fr) * 0.5, 2) * 0.78));
    const rearFrictionCircle = Math.sqrt(Math.max(0.08, 1 - Math.pow((wheelLongitudinalUsage.rl + wheelLongitudinalUsage.rr) * 0.5, 2) * 0.86));
    const frontLatLimit = frontNormal * frontGrip * frontFrictionCircle;
    const rearLatLimit = rearNormal * rearGrip * rearFrictionCircle;
    const availableCorneringG = clamp(
      ((frontLatLimit + rearLatLimit) / Math.max(1, tuning.weightKg * 9.81)) * 0.82,
      0.18,
      1.08
    );
    const steeringAngle = launchAligning
      ? 0
      : this.getRaceGripLimitedTireAngle(rawSteeringAngle, absSpeed, {
        wheelbaseM,
        availableLateralG: availableCorneringG
      });
    const frontSlipAngle = normalizeAngle(steeringAngle - vehicleSlipAngle);
    const rearSlipAngle = normalizeAngle(-vehicleSlipAngle);
    const frontLatForce = clamp(frontSlipAngle * tuning.weightKg * 42 * lateralForceSpeedScale, -frontLatLimit, frontLatLimit);
    const rearLatForce = clamp(rearSlipAngle * tuning.weightKg * 34 * lateralForceSpeedScale, -rearLatLimit, rearLatLimit);
    const wheelSlipAngles = {
      fl: frontSlipAngle,
      fr: frontSlipAngle,
      rl: rearSlipAngle,
      rr: rearSlipAngle
    };
    const wheelLateralUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
      const isFront = wheelId === 'fl' || wheelId === 'fr';
      const axleNormal = Math.max(1, isFront ? frontNormal : rearNormal);
      const axleForce = isFront ? frontLatForce : rearLatForce;
      const wheelLoadShare = Number(dynamicNormalLoads[wheelId] || 0) / axleNormal;
      const wheelLatForce = Math.abs(axleForce) * clamp(wheelLoadShare * 2, 0.35, 1.65) * 0.5;
      const wheelLimit = Math.max(1, Number(dynamicNormalLoads[wheelId] || 0) * Math.max(0.1, perWheelGrip[wheelId]) * Math.max(0.25, gripFactor));
      return [wheelId, clamp(wheelLatForce / wheelLimit, 0, 1.45)];
    }));
    const wheelFrictionUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      Math.hypot(Number(wheelLongitudinalUsage[wheelId] || 0), Number(wheelLateralUsage[wheelId] || 0))
    ]));
    const lateralAcceleration = launchAligning
      ? 0
      : ((frontLatForce + rearLatForce) / tuning.weightKg) * steeringSpeedScale;
    const lateralDemandG = launchAligning
      ? 0
      : Math.abs(Math.tan(steeringAngle) * absSpeed * absSpeed / Math.max(1.8, wheelbaseM)) / 9.81;
    const rearGripG = rearLatLimit / Math.max(1, tuning.weightKg * 9.81);
    const rearLoadShare = rearNormal / Math.max(1, frontNormal + rearNormal);
    const rearLightness = clamp((0.48 - rearLoadShare) / 0.16, 0, 1);
    const throttleDestabilize = clamp((throttle - 0.38) / 0.62, 0, 1) * (tuning.drivetrain === 'rwd' ? 0.52 : tuning.drivetrain === 'awd' ? 0.2 : 0.08);
    const brakeDestabilize = clamp((brake + Math.max(handbrake, handbrakeSlip * 0.96) * 4.4) / 1.18, 0, 1) * (tuning.drivetrain === 'rwd' ? 1.08 : 0.78);
    const rearLongitudinalOverload = clamp(((wheelLongitudinalUsage.rl + wheelLongitudinalUsage.rr) * 0.5 - 0.72) / 0.45, 0, 1);
    const leftLongitudinalDemand = (wheelLongitudinalUsage.fl + wheelLongitudinalUsage.rl) * 0.5;
    const rightLongitudinalDemand = (wheelLongitudinalUsage.fr + wheelLongitudinalUsage.rr) * 0.5;
    const splitGripYaw = clamp(
      ((rightTireGrip - leftTireGrip) * (Math.abs(driveForceRaw) > brakeForce ? throttle : brake + handbrake))
        + (rightLongitudinalDemand - leftLongitudinalDemand) * 0.24,
      -0.58,
      0.58
    );
    const mixedSurfaceYaw = splitGripYaw * clamp(absSpeed / 8, 0.18, 1);
    const rearFrictionOveruse = clamp(((wheelFrictionUsage.rl + wheelFrictionUsage.rr) * 0.5 - 0.86) / 0.42, 0, 1);
    const frontFrictionOveruse = clamp(((wheelFrictionUsage.fl + wheelFrictionUsage.fr) * 0.5 - 0.92) / 0.42, 0, 1);
    const previousYawVelocity = Number.isFinite(this.playtestSession.yawVelocityRadps)
      ? this.playtestSession.yawVelocityRadps
      : 0;
    const rearBreakaway = launchAligning
      ? 0
      : clamp(
        ((lateralDemandG - rearGripG * 0.68) / Math.max(0.08, rearGripG * 0.38))
          + rearLightness * 0.42
          + throttleDestabilize
          + brakeDestabilize
          + rearFrictionOveruse * 0.88,
        0,
        1
      ) * clamp((absSpeed - 5.5) / 19, 0, 1);
    const previousRearBreakawayMemory = Number(this.playtestSession.rearBreakawayMemory || 0);
    const rearBreakawayRecoveryPenalty = (
      handbrakeSlip * 0.42
      + clamp(Math.abs(previousYawVelocity) / 1.8, 0, 1) * 0.28
      + (tuning.drivetrain === 'awd' ? clamp(throttle, 0, 1) * 0.18 : 0)
    );
    const rearBreakawayDecay = seconds * (0.82 - rearBreakawayRecoveryPenalty);
    this.playtestSession.rearBreakawayMemory = clamp(
      Math.max(rearBreakaway, previousRearBreakawayMemory - Math.max(0.08, rearBreakawayDecay)),
      0,
      1
    );
    const sustainedRearBreakaway = Math.max(
      rearBreakaway,
      this.playtestSession.rearBreakawayMemory * clamp((absSpeed - 8) / 24, 0, 1),
      handbrakeSlip * clamp((absSpeed - 7) / 22, 0, 1)
    );
    const tirePull = clamp(
      mixedSurfaceYaw + (Number(damageEffects.suspensionPull || 0) * 0.7),
      -0.34,
      0.34
    ) * clamp(absSpeed / 18, 0, 1);
    const yawSpeedMps = this.playtestSession.speedMps < -0.2 ? this.playtestSession.speedMps * 0.72 : this.playtestSession.speedMps;
    const bicycleYawRate = -yawSpeedMps * Math.tan(steeringAngle) / Math.max(2.1, wheelbaseM);
    const slipYawRate = -Math.sign(steeringAngle || roadSteer || 0)
      * Math.max(sustainedRearBreakaway, rearLongitudinalOverload * 0.72)
      * (0.58 + clamp(absSpeed / 58, 0, 1) * 0.86);
    const rearLockSpin = handbrakeSlip
      * clamp((absSpeed - 12) / 32, 0, 1)
      * -Math.sign(steeringAngle || roadSteer || vehicleSlipAngle || 0);
    const rearBreakawaySpin = Math.max(sustainedRearBreakaway, rearLongitudinalOverload * 0.72)
      * clamp(absSpeed / 42, 0, 1)
      * (0.42 + handbrakeSlip * 0.58)
      * -Math.sign(steeringAngle || roadSteer || vehicleSlipAngle || 0);
    const counterSteerRecovery = Math.sign(previousYawVelocity || 0) !== 0
      && Math.sign(steeringAngle || 0) === Math.sign(previousYawVelocity || 0)
      ? clamp(Math.abs(steeringAngle) / 0.12, 0, 1) * clamp(absSpeed / 24, 0, 1)
      : 0;
    const yawStability = setupModifiers.yawStability
      * (1 - sustainedRearBreakaway * 0.72)
      * (1 - handbrakeSlip * 0.46);
    const settledControlsForSpinRecovery = !activeTurnInput
      && throttle <= RACE_PEDAL_INPUT.activeThreshold
      && brake <= RACE_PEDAL_INPUT.activeThreshold
      && !handbrake;
    const yawAcceleration = launchAligning
      ? -previousYawVelocity * 12
      : (
        (bicycleYawRate * steeringSpeedScale - previousYawVelocity) * (3.1 + yawStability * 1.8)
        + slipYawRate * (2.4 + handbrakeSlip * 3.2)
        + rearBreakawaySpin * 3.2
        + rearLockSpin * 7.2
        + tirePull * 2.2
        - previousYawVelocity * (0.8 + yawStability * 1.1 + counterSteerRecovery * 3.6)
      );
    let yawRate = clamp(
      launchAligning ? 0 : previousYawVelocity + yawAcceleration * seconds,
      -3.8,
      3.8
    );
    if (!launchAligning) {
      const lowSpeedSpinRecovery = clamp((4.5 - absSpeed) / 4.5, 0, 1);
      const runawaySpinRecovery = clamp((Math.abs(yawRate) - 1.15) / 2.2, 0, 1);
      const recoveryGrip = clamp(gripFactor, 0.18, 1.15) * (1 - handbrakeSlip * 0.72);
      const recoveryRate = (lowSpeedSpinRecovery * 5.5 + (settledControlsForSpinRecovery ? 2.8 : 0.8))
        * runawaySpinRecovery
        * recoveryGrip
        * seconds;
      yawRate *= Math.max(0.08, 1 - recoveryRate);
    }
    this.playtestSession.yawVelocityRadps = yawRate;
    this.playtestSession.carYaw = launchAligning
      ? roadYaw
      : previousCarYaw + yawRate * seconds;
    const slipAngle = normalizeAngle(this.playtestSession.carYaw - previousVelocityYaw);
    const settledControls = !activeTurnInput && throttle <= RACE_PEDAL_INPUT.activeThreshold && brake <= RACE_PEDAL_INPUT.activeThreshold && !handbrake;
    const gripAlignmentRate = launchAligning
      ? 8
      : (3.4 + clamp(gripFactor, 0.25, 1.25) * 3.8)
        * (1 - Math.pow(clamp(absSpeed / 78, 0, 1), 0.72) * 0.5)
        * (1 - Math.max(sustainedRearBreakaway, handbrakeSlip * 0.72) * 0.97)
        * setupModifiers.yawStability
        * (settledControls ? 2.15 : 1);
    const velocityYaw = launchAligning
      ? roadYaw
      : previousVelocityYaw + slipAngle * Math.min(0.42, seconds * gripAlignmentRate);
    const slipAmountRaw = Math.abs(normalizeAngle(this.playtestSession.carYaw - velocityYaw));
    const lowSpeedSlipGate = clamp((absSpeed - 1.8) / 7, 0, 1);
    const slipAmount = Math.max(slipAmountRaw, sustainedRearBreakaway * 0.22) * lowSpeedSlipGate;
    const scrub = clamp((slipAmount - 0.055) / 0.46, 0, 1) * clamp((absSpeed - 2.2) / 24, 0, 1);
    if (scrub > 0) {
      const scrubLoss = 1 - Math.min(0.12, scrub * seconds * 0.78);
      this.playtestSession.speedMps *= scrubLoss;
    }
    const wheelSpinSlip = Math.max(0, wheelSpinRatio - 0.78) * 1.1;
    const brakeLockSlip = Math.max(...Object.values(brakeState.lockByWheel));
    const lateralSlipFront = Math.max(
      clamp((Math.abs(frontLatForce) / Math.max(1, frontLatLimit) - 0.92) / 0.4, 0, 1),
      frontFrictionOveruse * 0.55
    ) * lowSpeedSlipGate;
    const lateralSlipRear = Math.max(
      clamp((Math.abs(rearLatForce) / Math.max(1, rearLatLimit) - 0.92) / 0.4, 0, 1),
      sustainedRearBreakaway,
      rearFrictionOveruse
    ) * lowSpeedSlipGate;
    const drivenSlipByWheel = Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map((wheelId) => [
      wheelId,
      drivenWheelIds.includes(wheelId) ? wheelSpinSlip : 0
    ]));
    const tireSlipByWheel = {
      fl: Math.max(lateralSlipFront, brakeState.lockByWheel.fl, drivenSlipByWheel.fl),
      fr: Math.max(lateralSlipFront, brakeState.lockByWheel.fr, drivenSlipByWheel.fr),
      rl: Math.max(lateralSlipRear, brakeState.lockByWheel.rl, drivenSlipByWheel.rl),
      rr: Math.max(lateralSlipRear, brakeState.lockByWheel.rr, drivenSlipByWheel.rr)
    };
    const leftSlip = (tireSlipByWheel.fl + tireSlipByWheel.rl) * 0.5 + clamp(1 - leftTireGrip, 0, 1) * 0.12;
    const rightSlip = (tireSlipByWheel.fr + tireSlipByWheel.rr) * 0.5 + clamp(1 - rightTireGrip, 0, 1) * 0.12;
    const audibleSlip = this.getRaceAudibleTireSlip({
      wheelSpin: wheelSpinSlip,
      brakeLock: brakeLockSlip,
      slipAngle: slipAmount,
      scrub,
      leftSlip,
      rightSlip,
      speedMps: absSpeed
    });
    this.playtestSession.velocityYaw = velocityYaw;
    this.playtestSession.tireSlip = {
      ...tireSlipByWheel,
      left: leftSlip,
      right: rightSlip,
      pull: tirePull,
      frontSlipAngle,
      rearSlipAngle,
      lateralAcceleration,
      roadGrade,
      gradeForce,
      slipAngle: slipAmount,
      yawVelocity: yawRate,
      scrub,
      rearBreakaway,
      rearLongitudinalOverload,
      frontFrictionOveruse,
      rearFrictionOveruse,
      frontTireAngle: steeringAngle,
      wheelSlipAngles,
      wheelLongitudinalUsage,
      wheelLateralUsage,
      wheelFrictionUsage,
      wheelSpin: wheelSpinSlip,
      brakeLock: brakeLockSlip,
      brakeLockByWheel: brakeState.lockByWheel,
      tireTemperatureGrip,
      wheelSurfaces: wheelSurfaceState.surfaceByWheel,
      wheelTerrains: wheelSurfaceState.terrainByWheel,
      audibleSlip
    };
    this.playtestSession.steeringWheelRotation = this.getRaceSteeringWheelRotationForTireAngle(steeringAngle, car);
    const wheelContactState = this.getRaceWheelContactState({
      car,
      tuning,
      session: this.playtestSession,
      wheelSurfaceState
    });
    this.updateRaceVerticalAndRollState({
      seconds,
      tuning,
      roadPose,
      previousRoadPose,
      lateralAcceleration,
      wheelContactState
    });
    const lateralDrift = (
      normalizeAngle(this.playtestSession.velocityYaw - roadYaw) * clamp(absSpeed / 32, 0, 1) * 0.04
      + Math.sign(steeringAngle || roadSteer || 0) * rearBreakaway * 0.035
    );
    this.playtestSession.lateral = clamp(
      Number(this.playtestSession.lateral || 0) * Math.max(0, 1 - seconds * 1.7) + lateralDrift,
      -0.24,
      0.24
    );
    this.playtestSession.worldX = Number(this.playtestSession.worldX || 0)
      + Math.sin(this.playtestSession.velocityYaw) * this.playtestSession.speedMps * seconds;
    this.playtestSession.worldZ = Number(this.playtestSession.worldZ || 0)
      + Math.cos(this.playtestSession.velocityYaw) * this.playtestSession.speedMps * seconds;
    this.updateRaceVehicle3DContactState({
      seconds,
      car,
      tuning,
      acceleration,
      lateralAcceleration,
      brakeState,
      driveForce,
      drivenWheelIds,
      wheelLongitudinalUsage,
      wheelLateralUsage,
      frontLatForce,
      rearLatForce
    });
    const routeLength = Math.max(1, Number(this.playtestSession.routeLength || this.getRaceRouteLength()));
    const projection = this.getRaceRouteProjectionForWorldPoint({
      x: this.playtestSession.worldX,
      z: this.playtestSession.worldZ
    });
    const boundarySegment = projection.segment || segmentInfo.segment || this.selectedSegment;
    const edgeCollisionMode = this.getRaceEdgeCollisionMode(boundarySegment);
    if (edgeCollisionMode !== 'none') {
      const roadHalfWidth = this.getRaceRoadHalfWidthWorld(boundarySegment);
      const marginWidth = this.getRaceCollisionMarginWidthWorld(boundarySegment, edgeCollisionMode);
      const shoulderWidth = this.getRaceCollisionShoulderWidthWorld(boundarySegment, edgeCollisionMode);
      const contactLimit = Math.max(0.2, roadHalfWidth + marginWidth + shoulderWidth);
      let boundaryHit = null;
      const contactPoints = this.getRaceVehicleCollisionContactPoints({
        session: this.playtestSession,
        car,
        tuning
      });
      contactPoints.forEach((point) => {
        const pointProjection = this.getRaceRouteProjectionForWorldPoint(point);
        const lateral = Number(pointProjection.lateral || 0);
        const excess = Math.abs(lateral) - contactLimit;
        if (excess <= 0) return;
        if (!boundaryHit || excess > boundaryHit.excess) {
          boundaryHit = {
            point,
            projection: pointProjection,
            lateral,
            excess
          };
        }
      });
      if (boundaryHit) {
        const side = Math.sign(boundaryHit.lateral || 1);
        const hitProjection = boundaryHit.projection || projection;
        const right = this.getRaceRightVector(Number(hitProjection.yaw || roadYaw || 0));
        const forward = this.getRaceForwardVector(Number(hitProjection.yaw || roadYaw || 0));
        const collisionEffect = this.getRaceEdgeCollisionEffect();
        if (collisionEffect === 'reset') {
          this.resetRaceCarToRouteCenter({ projection: hitProjection, roadYaw });
        } else {
          this.playtestSession.worldX -= right.x * side * boundaryHit.excess;
          this.playtestSession.worldZ -= right.z * side * boundaryHit.excess;
          const speedMps = Number(this.playtestSession.speedMps || 0);
          const velocityYaw = Number(this.playtestSession.velocityYaw || this.playtestSession.carYaw || 0);
          const vx = Math.sin(velocityYaw) * speedMps;
          const vz = Math.cos(velocityYaw) * speedMps;
          const normalX = right.x * side;
          const normalZ = right.z * side;
          const normalVelocity = vx * normalX + vz * normalZ;
          const tangentVelocity = vx * forward.x + vz * forward.z;
          const restitution = clamp(0.18 + Math.abs(normalVelocity) / 72, 0.18, 0.48);
          const tangentFriction = clamp(0.82 - Math.abs(normalVelocity) / 140, 0.55, 0.84);
          if (normalVelocity > 0.05) {
            const nextNormalVelocity = -normalVelocity * restitution;
            const nextTangentVelocity = tangentVelocity * tangentFriction;
            const nextVx = forward.x * nextTangentVelocity + normalX * nextNormalVelocity;
            const nextVz = forward.z * nextTangentVelocity + normalZ * nextNormalVelocity;
            this.playtestSession.speedMps = Math.hypot(nextVx, nextVz) * (nextTangentVelocity < 0 ? -1 : 1);
            this.playtestSession.velocityYaw = Math.atan2(nextVx, nextVz);
            const impactYaw = normalizeAngle(this.playtestSession.carYaw - Math.atan2(normalX, normalZ));
            this.playtestSession.yawVelocityRadps = clamp(
              Number(this.playtestSession.yawVelocityRadps || 0) * 0.42 - Math.sin(impactYaw) * Math.abs(normalVelocity) * 0.035,
              -2.4,
              2.4
            );
            this.playtestSession.carYaw = normalizeAngle(Number(this.playtestSession.carYaw || 0) + this.playtestSession.yawVelocityRadps * seconds * 0.35);
          } else {
            this.playtestSession.speedMps *= 0.94;
            this.playtestSession.yawVelocityRadps = clamp(Number(this.playtestSession.yawVelocityRadps || 0) * 0.72, -1.4, 1.4);
          }
          this.applyRaceDamage('panels', Math.min(14, Math.max(0.2, Math.abs(normalVelocity) * 0.42)), {
            keys: [side < 0 ? 'left' : 'right'],
            source: `edge:${edgeCollisionMode}`
          });
        }
      }
    }
    const previousDistance = Number(this.playtestSession.previousDistance || this.playtestSession.distance || 0);
    const progressRoadYaw = this.getRaceWorldPoseAtDistance(previousDistance).yaw;
    const progressHeading = normalizeAngle(this.playtestSession.velocityYaw - progressRoadYaw);
    const routeAdvance = this.playtestSession.speedMps * Math.cos(progressHeading) * seconds;
    const integratedDistance = previousDistance + routeAdvance;
    if (routeRuntimeType === 'circuit') {
      const nextDistance = ((integratedDistance % routeLength) + routeLength) % routeLength;
      this.updateRaceCheckpointProgress({
        previousDistance,
        nextDistance,
        routeAdvance
      });
      const crossedStart = routeAdvance > 0 && previousDistance > routeLength * 0.72 && nextDistance < routeLength * 0.28;
      const checkpointsComplete = Number(this.playtestSession.checkpointIndex || 0) >= Number(this.playtestSession.checkpointCount || 0);
      if (crossedStart && checkpointsComplete) {
        this.playtestSession.lap += 1;
        const nextCheckpoint = (this.playtestSession.checkpointDistances || []).findIndex((distance) => distance > Math.max(8, this.getRaceCarWorldWidth() * 2));
        this.playtestSession.checkpointIndex = nextCheckpoint >= 0 ? nextCheckpoint : 0;
        this.playtestSession.passedCheckpoints = [];
        if (this.playtestSession.lap > Math.max(1, Number(this.selectedRace.laps || 1))) {
          this.playtestSession.lap = Math.max(1, Number(this.selectedRace.laps || 1));
          this.finishPlaytest();
          return;
        }
      }
      this.playtestSession.distance = nextDistance;
    } else {
      this.playtestSession.distance = clamp(integratedDistance, 0, routeLength);
      this.updateRaceCheckpointProgress({
        previousDistance,
        nextDistance: this.playtestSession.distance,
        routeAdvance
      });
      const finish = this.getRaceWorldPoseAtDistance(routeLength);
      const finishDx = Number(this.playtestSession.worldX || 0) - Number(finish.x || 0);
      const finishDz = Number(this.playtestSession.worldZ || 0) - Number(finish.z || 0);
      const finishRange = Math.max(this.getRaceRoadHalfWidthWorld() * 1.55, this.getRaceCarWorldWidth() * 5);
      const integratedFinish = integratedDistance >= routeLength;
      const checkpointsComplete = Number(this.playtestSession.checkpointIndex || 0) >= Number(this.playtestSession.checkpointCount || 0);
      if ((this.playtestSession.distance >= routeLength - Math.max(4, this.getRaceCarWorldWidth() * 2)
        && Math.hypot(finishDx, finishDz) <= finishRange
        && checkpointsComplete)
        || (integratedFinish && checkpointsComplete)) {
        this.playtestSession.distance = routeLength;
        this.finishPlaytest();
        return;
      }
    }
    const routeProjectedDistance = routeRuntimeType === 'circuit'
      ? ((Number(projection.distance || 0) % routeLength) + routeLength) % routeLength
      : clamp(Number(projection.distance || this.playtestSession.distance || 0), 0, routeLength);
    const previousProjectedDistance = Number(this.playtestSession.projectedDistance);
    if (previousProjectedDistance < 0) {
      const startBackDistance = Math.max(0, Number(this.playtestSession.startBackDistance || 0));
      const preStartProjectedDistance = clamp(previousProjectedDistance + routeAdvance, -startBackDistance, 0);
      this.playtestSession.projectedDistance = preStartProjectedDistance;
    } else {
      this.playtestSession.projectedDistance = routeProjectedDistance;
    }
    this.playtestSession.heading = normalizeAngle(this.playtestSession.carYaw - roadYaw);
    this.playtestSession.cameraYaw = this.getRacePlaytestCameraYaw(this.playtestSession);
    const trackViewTarget = clamp(
      (-this.playtestSession.lateral * 0.24) + (this.playtestSession.heading * 0.66),
      -0.58,
      0.58
    );
    this.playtestSession.roadViewOffset += (trackViewTarget - Number(this.playtestSession.roadViewOffset || 0)) * Math.min(1, seconds * 3.2);
    this.playtestSession.rpm = clamp(this.playtestSession.engineRpm / tuning.revLimitRpm, 0, 1.08);
    this.updateRaceEngineAudio({ tuning, throttle, load: wheelSpinRatio });
    this.updateRaceTireAudio({
      slip: audibleSlip,
      surface: segmentInfo.segment?.surface,
      speedMps: absSpeed
    });
    if (this.raceInput.autoShift && gear > 0 && this.playtestSession.shiftCooldownMs <= 0) {
      const lowerGearUsefulSpeed = gear > 1 ? this.getRaceRedlineSpeedMps(tuning, gear - 1) * 0.72 : 0;
      const currentGearRedlineSpeed = this.getRaceRedlineSpeedMps(tuning, gear);
      const wantsUpshift = this.playtestSession.engineRpm > tuning.autoUpshiftRpm * 0.96
        || absSpeed > currentGearRedlineSpeed * 0.9;
      if (throttle > RACE_PEDAL_INPUT.activeThreshold && wantsUpshift && this.raceInput.gear < tuning.gearRatios.length) {
        this.shiftRaceGear(1);
      } else if (this.raceInput.gear > 1
        && (this.playtestSession.engineRpm < tuning.autoDownshiftRpm || brake > RACE_PEDAL_INPUT.activeThreshold || absSpeed < lowerGearUsefulSpeed)
        && this.canRaceAutomaticDownshift(tuning, absSpeed, this.raceInput.gear - 1)) {
        this.shiftRaceGear(-1);
      }
    }
    this.playtestSession.steeringWheel = this.raceInput.steeringWheel;
    this.playtestSession.steeringTarget = this.raceInput.steeringTarget;
    this.playtestSession.gear = this.raceInput.gear;
    this.playtestSession.cameraView = this.raceInput.cameraView;
    this.playtestSession.handbrakeMs = Math.max(0, Number(this.playtestSession.handbrakeMs || 0) - seconds * 1000);
    if (handbrake) this.playtestSession.handbrakeMs = 180;
    this.updateRaceDiagnostics(seconds, {
      tuning,
      car,
      throttle,
      brake,
      handbrake,
      acceleration,
      lateralAcceleration,
      dynamicNormalLoads,
      initialNormalLoads,
      tireSlipByWheel,
      wheelSurfaceState,
      previousDistance,
      routeLength,
      routeRuntimeType
    });
    this.emitRaceTireFxParticles(seconds, {
      tireSlipByWheel,
      wheelSurfaceState,
      brakeState,
      handbrake,
      wheelSpin: wheelSpinRatio,
      speedMps: absSpeed
    });
    this.updateRaceTireFxParticles(seconds);
    this.updateRaceAiDrivers(seconds);
    this.recordRaceGhostSample();
    this.updateRaceWearAndDamage(seconds);
  }

  getRaceTireFxSlotForWheel({ surfaceId = 'asphalt', terrain = 'road', slip = 0, brakeLock = 0, wheelSpin = 0, handbrake = 0, speedMps = 0 } = {}) {
    const surface = String(surfaceId || 'asphalt');
    if (surface.includes('snow') || surface === 'slush') return 'snowDust';
    if (surface.includes('wet') || surface === 'mud') return surface.includes('gravel') ? 'gravelDust' : 'wetSpray';
    if (surface === 'gravel') return 'gravelDust';
    if (surface === 'dirt') return 'dirtDust';
    if (terrain !== 'road' && terrain !== 'margin') return 'grassDust';
    const speed = Math.abs(Number(speedMps) || 0);
    const burnout = Number(wheelSpin || 0) > 0.72 && speed > 1.2;
    const hardRearLock = Number(handbrake || 0) > 0.2 && speed > 8;
    const brakeFlatSpot = Number(brakeLock || 0) > 0.42 && speed > 7;
    if (burnout || hardRearLock || brakeFlatSpot) return 'skidSmoke';
    return Number(slip || 0) > 0.54 && speed > 9 ? 'asphaltSkid' : '';
  }

  emitRaceTireFxParticles(seconds = 0, {
    tireSlipByWheel = {},
    wheelSurfaceState = {},
    brakeState = {},
    handbrake = 0,
    wheelSpin = 0,
    speedMps = 0
  } = {}) {
    const session = this.playtestSession;
    if (!session) return;
    const particles = Array.isArray(session.tireFxParticles) ? session.tireFxParticles : [];
    session.tireFxParticles = particles;
    session.tireFxEmitAccumulators = session.tireFxEmitAccumulators || {};
    const speed = Math.abs(Number(speedMps || session.speedMps || 0));
    if (speed < 0.9) return;
    const fxSettings = this.ensureRaceTireFxSettings();
    RACE_WHEEL_IDS.forEach((wheelId) => {
      const slip = Math.max(0, Number(tireSlipByWheel?.[wheelId] || 0));
      const brakeLock = Math.max(0, Number(brakeState?.lockByWheel?.[wheelId] || 0));
      const isRear = wheelId === 'rl' || wheelId === 'rr';
      const surfaceId = wheelSurfaceState.surfaceByWheel?.[wheelId] || 'asphalt';
      const terrain = wheelSurfaceState.terrainByWheel?.[wheelId] || 'road';
      const looseSurface = (terrain !== 'road' && terrain !== 'margin')
        || ['dirt', 'gravel', 'mud', 'snow', 'slush'].includes(String(surfaceId || ''));
      const handbrakeRearSlip = Number(handbrake || 0) && isRear ? 0.6 : 0;
      const wheelSpinSlip = Number(wheelSpin || 0) > 0.72 && isRear ? Number(wheelSpin || 0) : 0;
      const effectiveSlip = Math.max(slip, brakeLock, handbrakeRearSlip, wheelSpinSlip);
      const roadDustKick = looseSurface ? clamp((speed - 3.2) / 20, 0, 1) * (0.34 + Math.min(0.9, slip) * 0.42) : 0;
      if (!looseSurface && effectiveSlip < 0.24) return;
      if (looseSurface && Math.max(effectiveSlip, roadDustKick) < 0.05) return;
      const slotId = this.getRaceTireFxSlotForWheel({
        surfaceId,
        terrain,
        slip: effectiveSlip,
        brakeLock,
        wheelSpin,
        handbrake: Number(handbrake || 0) && isRear ? handbrake : 0,
        speedMps: speed
      });
      if (!slotId) return;
      const slot = RACE_TIRE_FX_SLOT_BY_ID[slotId] || RACE_TIRE_FX_SLOTS[0];
      const settings = fxSettings[slotId] || this.getRaceTireFxDefaults(slotId);
      if (settings.enabled === false) return;
      const density = clamp(Number(settings.density ?? 1), 0, 3);
      const slotIntensity = slotId === 'asphaltSkid'
        ? clamp((effectiveSlip - 0.48) / 0.46, 0, 1) * 0.34
        : slotId === 'skidSmoke'
          ? clamp((effectiveSlip - 0.58) / 0.58, 0, 1) * 0.88
          : Math.max(roadDustKick, clamp(effectiveSlip * 0.72, 0, 1));
      if (slotIntensity <= 0.01) return;
      const speedFactor = slotId === 'asphaltSkid'
        ? clamp(speed / 34, 0.25, 1.1)
        : slotId === 'skidSmoke'
          ? clamp(speed / 22, 0.35, 1.45)
          : clamp(speed / 16, 0.35, 2.6);
      const accumulatorKey = `${slotId}:${wheelId}`;
      session.tireFxEmitAccumulators[accumulatorKey] = Number(session.tireFxEmitAccumulators[accumulatorKey] || 0)
        + slotIntensity * density * speedFactor * seconds * (slotId === 'asphaltSkid' ? 5 : slotId === 'skidSmoke' ? 8 : 16);
      const count = Math.min(slotId === 'asphaltSkid' ? 2 : 6, Math.floor(session.tireFxEmitAccumulators[accumulatorKey]));
      session.tireFxEmitAccumulators[accumulatorKey] -= count;
      if (count <= 0) return;
      const wheel = wheelSurfaceState.positions?.[wheelId];
      if (!wheel) return;
      for (let index = 0; index < count; index += 1) {
        const ageSeed = Math.random();
        session.tireFxParticleSequence = (Number(session.tireFxParticleSequence || 0) + 1) % 1000000;
        const isMark = slotId === 'asphaltSkid';
        particles.push({
          id: `${slotId}-${session.elapsedMs}-${wheelId}-${session.tireFxParticleSequence}`,
          slotId,
          artRef: String(settings.artRef || ''),
          color: String(settings.color || slot.color),
          x: Number(wheel.x || 0) + (Math.random() - 0.5) * (isMark ? 0.08 : 0.22),
          z: Number(wheel.z || 0) + (Math.random() - 0.5) * (isMark ? 0.08 : 0.22),
          elevation: Number(wheel.elevation || 0) + (isMark ? 0.006 : 0.015),
          vx: isMark ? 0 : -Math.sin(Number(session.velocityYaw || session.carYaw || 0)) * (0.35 + speed * 0.016) + (Math.random() - 0.5) * 0.42,
          vz: isMark ? 0 : -Math.cos(Number(session.velocityYaw || session.carYaw || 0)) * (0.35 + speed * 0.016) + (Math.random() - 0.5) * 0.42,
          vy: isMark ? 0 : 0.018 + Math.random() * (slotId === 'skidSmoke' ? 0.055 : 0.085),
          ageMs: 0,
          lifetimeMs: (isMark ? clamp(Number(settings.lifetimeMs ?? 1100), 420, 1800) : clamp(Number(settings.lifetimeMs ?? 620), 120, 1800)) * (0.72 + ageSeed * 0.56),
          sizeM: clamp(Number(settings.scale ?? 1), 0.25, 4) * (isMark ? 0.22 : 0.32 + slotIntensity * 0.95) * (0.75 + Math.random() * 0.65),
          alpha: isMark ? clamp(0.18 + slotIntensity * 0.36, 0.14, 0.48) : clamp(0.18 + slotIntensity * 0.64, 0.14, 0.82)
        });
      }
    });
    if (particles.length > 140) particles.splice(0, particles.length - 140);
  }

  updateRaceTireFxParticles(seconds = 0) {
    const session = this.playtestSession;
    if (!session?.tireFxParticles?.length) return;
    session.tireFxParticles = session.tireFxParticles
      .map((particle) => ({
        ...particle,
        ageMs: Number(particle.ageMs || 0) + seconds * 1000,
        x: Number(particle.x || 0) + Number(particle.vx || 0) * seconds,
        z: Number(particle.z || 0) + Number(particle.vz || 0) * seconds,
        elevation: Number(particle.elevation || 0) + Number(particle.vy || 0) * seconds
      }))
      .filter((particle) => Number(particle.ageMs || 0) < Number(particle.lifetimeMs || 1));
  }

  updateRaceDiagnostics(seconds = 0, context = {}) {
    const session = this.playtestSession;
    const diagnostics = session?.diagnostics;
    if (!session || !diagnostics) return;
    const dt = Math.max(0, Number(seconds) || 0);
    const speedMph = Math.abs(Number(session.speedMps || 0)) * 2.23694;
    const elapsedMs = Math.max(0, Number(session.elapsedMs || 0));
    const lateralG = Number(context.lateralAcceleration || 0) / 9.81;
    diagnostics.lateralG = lateralG;
    diagnostics.peakLateralG = Math.max(Number(diagnostics.peakLateralG || 0), Math.abs(lateralG));
    if (diagnostics.zeroToSixtyMs === null && speedMph >= 60) diagnostics.zeroToSixtyMs = elapsedMs;
    if (!diagnostics.brakingArmed && speedMph >= 60) {
      diagnostics.brakingArmed = true;
      diagnostics.brakingStartMs = elapsedMs;
      diagnostics.brakingStartDistance = Number(session.distance || 0);
    }
    if (diagnostics.brakingArmed && diagnostics.sixtyToZeroMs === null && speedMph <= 1.5 && Number(context.brake || 0) > 0.15) {
      diagnostics.sixtyToZeroMs = Math.max(0, elapsedMs - Number(diagnostics.brakingStartMs || elapsedMs));
      diagnostics.sixtyToZeroDistanceM = Math.abs(Number(session.distance || 0) - Number(diagnostics.brakingStartDistance || session.distance || 0));
    }
    if (diagnostics.quarterMileMs === null && Number(session.distance || 0) >= 402.336) {
      diagnostics.quarterMileMs = elapsedMs;
      diagnostics.quarterMileTrapMph = speedMph;
    }
    const gates = diagnostics.slalomGates || [];
    while (diagnostics.nextSlalomGate < gates.length && Number(session.distance || 0) >= Number(gates[diagnostics.nextSlalomGate] || 0)) {
      diagnostics.slalomSplits = diagnostics.slalomSplits || [];
      diagnostics.slalomSplits.push({
        gate: diagnostics.nextSlalomGate + 1,
        distance: gates[diagnostics.nextSlalomGate],
        elapsedMs,
        speedMph
      });
      diagnostics.nextSlalomGate += 1;
    }
    const normalLoads = context.dynamicNormalLoads || {};
    const staticLoads = context.initialNormalLoads || this.getRaceWheelNormalLoads(context.tuning || this.getRaceCarTuning());
    RACE_WHEEL_IDS.forEach((wheelId) => {
      const staticLoad = Math.max(1, Number(staticLoads[wheelId] || 1));
      const load = Math.max(0, Number(normalLoads[wheelId] || staticLoad));
      const slip = Math.max(0, Number(context.tireSlipByWheel?.[wheelId] || 0));
      diagnostics.tireLoad[wheelId] = load / staticLoad;
      const heatTarget = 70
        + slip * 210
        + Math.max(0, diagnostics.tireLoad[wheelId] - 1) * 36
        + speedMph * 0.055
        + (Number(context.handbrake || 0) && (wheelId === 'rl' || wheelId === 'rr') ? 70 : 0);
      const coolRate = speedMph > 5 ? 0.55 : 0.24;
      const heatRate = slip > 0.08 ? 3.2 + slip * 2.8 : coolRate;
      diagnostics.tireTemperature[wheelId] += (heatTarget - diagnostics.tireTemperature[wheelId]) * Math.min(1, dt * heatRate);
      diagnostics.suspensionTravel[wheelId] = clamp((diagnostics.tireLoad[wheelId] - 0.72) / 0.9, 0, 1);
    });
    if (session.airborne) {
      diagnostics.jump.airtimeMs += dt * 1000;
      diagnostics.jump.maxHeightM = Math.max(Number(diagnostics.jump.maxHeightM || 0), Math.max(0, Number(session.heightM || 0)));
    } else if (diagnostics.jump.airtimeMs > 0 && !diagnostics.jump.landed) {
      diagnostics.jump.landed = true;
      diagnostics.jump.landingImpact = Math.abs(Number(session.verticalVelocityMps || 0));
      diagnostics.jump.stable = !session.rolledOver && diagnostics.jump.landingImpact < 5.4;
    }
    if (session.activeGhost?.samples?.length) {
      diagnostics.ghostDeltaMs = this.getRaceGhostDeltaMs(session.activeGhost, Number(session.distance || 0), elapsedMs);
    }
    if (Array.isArray(session.aiRuntime) && session.aiRuntime.length) {
      diagnostics.aiConsistency = session.aiRuntime.map((ai) => ({
        id: ai.id,
        name: ai.name,
        difficulty: ai.difficulty,
        lap: ai.lap,
        speedMph: Math.round(Number(ai.speedMps || 0) * 2.23694),
        consistency: Math.round(Math.max(0, 100 - Math.abs(Number(ai.consistencyError || 0)) * 100))
      }));
    }
  }

  getRaceAiDifficultyProfile(difficulty = 'easy') {
    return {
      easy: { pace: 0.64, corner: 0.56, brake: 0.58, shift: 0.72, variance: 0.18 },
      medium: { pace: 0.78, corner: 0.72, brake: 0.74, shift: 0.84, variance: 0.11 },
      hard: { pace: 0.9, corner: 0.86, brake: 0.88, shift: 0.94, variance: 0.055 },
      expert: { pace: 1.02, corner: 1, brake: 1, shift: 1, variance: 0.018 }
    }[difficulty] || { pace: 0.72, corner: 0.68, brake: 0.7, shift: 0.8, variance: 0.12 };
  }

  getRaceAiLookaheadSeverity(distance = 0, speedMps = 0) {
    const lookahead = Math.max(40, Math.abs(Number(speedMps || 0)) * 2.2);
    const samples = [0.25, 0.55, 0.9].map((weight) => this.getRaceSegmentAtDistance(distance + lookahead * weight, { wrap: true }).segment || {});
    return samples.reduce((max, segment) => Math.max(
      max,
      Math.abs(Number(segment.curve || 0)) * 0.86
        + Math.abs(Number(segment.elevation || 0)) * 0.22
        + Number(segment.bumpiness || 0) * 0.28
    ), 0);
  }

  updateRaceAiDrivers(seconds = 0) {
    const session = this.playtestSession;
    if (!session?.aiRuntime?.length) return;
    const dt = Math.max(0, Number(seconds) || 0);
    const routeLength = Math.max(1, Number(session.routeLength || this.getRaceRouteLength()));
    const isCircuit = (session.routeRuntimeType || this.getSelectedRaceRuntimeType()) === 'circuit';
    session.aiRuntime.forEach((ai, index) => {
      const car = this.project.cars.find((candidate) => candidate.id === ai.carId) || this.selectedCar;
      const tuning = this.getRaceCarTuning(car, { transmissionType: ai.shiftMode === 'manual' ? 'manual' : 'automatic' });
      const profile = this.getRaceAiDifficultyProfile(ai.difficulty);
      const severity = this.getRaceAiLookaheadSeverity(ai.projectedDistance || ai.distance || 0, ai.speedMps || 0);
      const variance = Math.sin((Number(session.elapsedMs || 0) / 1000) * (0.45 + index * 0.04) + index) * profile.variance;
      const targetMps = Math.max(
        9,
        tuning.topSpeedMps * profile.pace * (1 - clamp(severity * (0.48 - profile.corner * 0.16), 0, 0.66)) * (1 + variance)
      );
      const braking = targetMps < ai.speedMps;
      const accelRate = braking
        ? (7.4 + profile.brake * 4.2)
        : (2.8 + profile.pace * 3.1);
      ai.speedMps += (targetMps - ai.speedMps) * Math.min(1, dt * accelRate / Math.max(6, Math.abs(targetMps - ai.speedMps) + 4));
      ai.speedMps = clamp(ai.speedMps, 0, tuning.topSpeedMps * 1.02);
      ai.distance += ai.speedMps * dt;
      if (isCircuit) {
        while (ai.distance >= routeLength) {
          ai.distance -= routeLength;
          ai.lap += 1;
          if (!ai.bestLapMs || ai.currentLapMs < ai.bestLapMs) ai.bestLapMs = ai.currentLapMs;
          ai.currentLapMs = 0;
        }
        ai.projectedDistance = ((ai.distance % routeLength) + routeLength) % routeLength;
      } else {
        ai.distance = Math.min(ai.distance, routeLength);
        ai.projectedDistance = clamp(ai.distance, 0, routeLength);
      }
      ai.currentLapMs += dt * 1000;
      const idealRpm = tuning.idleRpm + clamp(ai.speedMps / Math.max(1, tuning.topSpeedMps), 0, 1) * (tuning.redlineRpm - tuning.idleRpm);
      const shiftAt = ai.difficulty === 'expert' ? tuning.redlineRpm * 0.92 : tuning.redlineRpm * 0.82;
      if (idealRpm > shiftAt && ai.gear < tuning.gearRatios.length) ai.gear += 1;
      if (braking && ai.gear > 1 && idealRpm < tuning.autoDownshiftRpm * profile.shift) ai.gear -= 1;
      ai.rpm = clamp(idealRpm, tuning.idleRpm, tuning.revLimitRpm);
      ai.consistencyError = variance + severity * (1 - profile.corner) * 0.2;
    });
  }

  recordRaceGhostSample() {
    const session = this.playtestSession;
    if (!session?.running) return;
    const samples = session.ghostRecording || [];
    const elapsedMs = Number(session.elapsedMs || 0);
    const last = samples.at(-1);
    if (last && elapsedMs - last.elapsedMs < 120) return;
    samples.push({
      elapsedMs,
      distance: Number(session.distance || 0),
      speedMps: Number(session.speedMps || 0),
      yaw: Number(session.carYaw || 0),
      x: Number(session.worldX || 0),
      z: Number(session.worldZ || 0)
    });
    session.ghostRecording = samples.slice(-1400);
    session.diagnostics.ghostSamples = session.ghostRecording;
  }

  getRaceGhostDeltaMs(ghost, distance = 0, elapsedMs = 0) {
    const samples = ghost?.samples || [];
    if (!samples.length) return null;
    let closest = samples[0];
    let best = Math.abs(Number(closest.distance || 0) - distance);
    for (let index = 1; index < samples.length; index += 1) {
      const delta = Math.abs(Number(samples[index].distance || 0) - distance);
      if (delta < best) {
        best = delta;
        closest = samples[index];
      }
    }
    return elapsedMs - Number(closest.elapsedMs || 0);
  }

  completeRaceGhost({ finished = false } = {}) {
    const session = this.playtestSession;
    if (!session?.ghostRecording?.length) return;
    const raceId = session.raceId || this.selectedRace?.id;
    if (!raceId) return;
    const ghost = {
      raceId,
      carId: session.carId,
      elapsedMs: Number(session.elapsedMs || 0),
      finished: Boolean(finished),
      samples: session.ghostRecording.slice()
    };
    const previous = this.bestRaceGhosts[raceId];
    if (finished && (!previous || Number(ghost.elapsedMs || Infinity) < Number(previous.elapsedMs || Infinity))) {
      this.bestRaceGhosts[raceId] = ghost;
    }
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
    const hasRawGamepadState = Object.prototype.hasOwnProperty.call(gamepadActions, 'gamepadA')
      || Object.prototype.hasOwnProperty.call(gamepadActions, 'gamepadB')
      || Object.prototype.hasOwnProperty.call(gamepadActions, 'gamepadX')
      || Boolean(this.game?.input?.gamepadConnected || this.game?.input?.gamepadAvailable || input.gamepadConnected);
    const rawGamepadActive = Boolean(
      hasRawGamepadState
      || gamepadActions.gamepadA || gamepadActions.gamepadB || gamepadActions.gamepadX || gamepadActions.gamepadY
      || gamepadActions.gamepadSelect || gamepadActions.gamepadStart
      || gamepadPressed?.has?.('gamepadA') || gamepadPressed?.has?.('gamepadB') || gamepadPressed?.has?.('gamepadX')
      || gamepadPressed?.has?.('gamepadSelect') || gamepadPressed?.has?.('gamepadStart')
    );
    if (this.raceInput.paused) {
      this.handleRacePauseMenuInput({
        wasPressed,
        wasPressedCode,
        wasGamepadPressed,
        isGamepadDown
      });
      this.raceInput.keyboardThrottle = false;
      this.raceInput.keyboardBrake = false;
      this.raceInput.keyboardSteer = 0;
      if (!hasActiveDpadPointer) this.raceInput.binarySteer = 0;
      return;
    }
    if (!hasRawGamepadState && this.raceInput.handbrakeUntilMs && Date.now() > Number(this.raceInput.handbrakeUntilMs)) {
      this.raceInput.handbrake = false;
      this.raceInput.handbrakeUntilMs = 0;
    }
    this.raceInput.throttlePulseMs = Math.max(0, Number(this.raceInput.throttlePulseMs || 0) - 16);
    if (wasPressed('interact') || wasPressedCode('KeyG') || (!rawGamepadActive && wasGamepadPressed('jump'))) {
      this.raceInput.throttlePulseMs = 120;
    }
    this.raceInput.keyboardThrottle = isDownCode('KeyG') || isDown('interact') || isDown('attack') || (!rawGamepadActive && isGamepadDown('jump')) || this.raceInput.throttlePulseMs > 0;
    this.raceInput.keyboardBrake = isDownCode('KeyR') || isDown('rev') || (!rawGamepadActive && isGamepadDown('dash'));
    this.raceInput.keyboardSteer = (isDown('right') || isDownCode('ArrowRight') || isDownCode('KeyD') ? 1 : 0)
      - (isDown('left') || isDownCode('ArrowLeft') || isDownCode('KeyA') ? 1 : 0);
    const dpadSteer = (isGamepadDown('dpadRight') ? 1 : 0) - (isGamepadDown('dpadLeft') ? 1 : 0);
    const digitalSteer = this.raceInput.keyboardSteer || dpadSteer;
    if (digitalSteer) {
      this.raceInput.binarySteer = digitalSteer;
    } else if (!hasActiveDpadPointer) {
      this.raceInput.binarySteer = 0;
    }
    if (wasPressed('up') || wasPressedCode('ArrowUp') || wasPressedCode('KeyW') || wasGamepadPressed('gamepadB') || (!rawGamepadActive && wasGamepadPressed('throw'))) {
      this.shiftRaceGear(1);
    }
    if (wasPressed('down') || wasPressedCode('ArrowDown') || wasPressedCode('KeyS') || wasGamepadPressed('gamepadX') || (!rawGamepadActive && wasGamepadPressed('rev'))) {
      this.shiftRaceGear(-1);
    }
    if (wasGamepadPressed('gamepadSelect')) {
      this.toggleRaceCameraView();
    }
    if (wasGamepadPressed('gamepadStart')) {
      this.toggleRacePause();
    }
    if (rawGamepadActive) {
      this.raceInput.handbrake = isGamepadDown('gamepadA');
      this.raceInput.handbrakeUntilMs = 0;
    }
    if ((wasPressedCode('KeyR') || (!rawGamepadActive && wasGamepadPressed('dash'))) && this.raceInput.keyboardBrake) {
      const now = Date.now();
      if (now - Number(this.raceInput.lastBrakeTapMs || 0) < 260) {
        this.raceInput.handbrake = true;
        this.raceInput.handbrakeUntilMs = now + 220;
      }
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

  getRaceAnalogSteeringTargetRate(speedMps = 0, intent = 0) {
    const speed = Math.max(0, Number(speedMps) || 0);
    const speedFactor = clamp(speed / RACE_CONTROLLER_STEERING.speedReferenceMps, 0, 1);
    const intentScale = 0.72 + Math.abs(Number(intent) || 0) * 0.28;
    return (
      RACE_CONTROLLER_STEERING.analogTargetPressBase
      + (1 - Math.pow(speedFactor, 0.68)) * RACE_CONTROLLER_STEERING.analogTargetPressLowSpeedBonus
    ) * intentScale;
  }

  getRaceAnalogSteeringReleaseRate(speedMps = 0) {
    const speed = Math.max(0, Number(speedMps) || 0);
    const speedFactor = clamp(speed / RACE_CONTROLLER_STEERING.speedReferenceMps, 0, 1);
    return RACE_CONTROLLER_STEERING.analogTargetReleaseBase
      + Math.pow(speedFactor, 0.72) * RACE_CONTROLLER_STEERING.analogTargetReleaseHighSpeedBonus;
  }

  getRaceTireSteerAngleForSpeed(speedMps = 0) {
    const speed = Math.max(0, Number(speedMps) || 0);
    const speedFactor = clamp(speed / 64, 0, 1);
    return RACE_CONTROLLER_STEERING.highwayTireAngleRad
      + (1 - Math.pow(speedFactor, 0.72))
        * (RACE_CONTROLLER_STEERING.parkingTireAngleRad - RACE_CONTROLLER_STEERING.highwayTireAngleRad);
  }

  getRaceSteeringRatio(car = null) {
    const source = car || (this.playtestSession
      ? this.project.cars.find((candidate) => candidate.id === this.playtestSession.carId)
      : this.selectedCar);
    return clamp(Number(source?.tuning?.steeringRatio || source?.steeringRatio || RACE_CONTROLLER_STEERING.steeringRatio), 8, 24);
  }

  getRacePhysicalTireAngleForSteering(steering = this.raceInput.steeringWheel, speedMps = this.playtestSession?.speedMps || 0) {
    const rawAngle = clamp(Number(steering) || 0, -1, 1)
      * this.getRaceTireSteerAngleForSpeed(speedMps)
      * this.getRaceMaxSteerForSpeed(speedMps);
    const car = this.playtestSession
      ? this.project.cars.find((candidate) => candidate.id === this.playtestSession.carId)
      : this.selectedCar;
    return this.getRaceGripLimitedTireAngle(rawAngle, speedMps, {
      wheelbaseM: this.getRaceCarDimensions(car).wheelbaseM,
      availableLateralG: 0.95
    });
  }

  getRaceGripLimitedTireAngle(tireAngle = 0, speedMps = 0, { wheelbaseM = 2.67, availableLateralG = 0.95 } = {}) {
    const angle = Number(tireAngle) || 0;
    const speed = Math.abs(Number(speedMps) || 0);
    if (speed < 7.5) return angle;
    const wheelbase = Math.max(2.1, Number(wheelbaseM) || 2.67);
    const lateralG = clamp(Number(availableLateralG) || 0.95, 0.12, 1.12);
    const maxAngle = Math.atan((lateralG * 9.81 * wheelbase) / Math.max(1, speed * speed));
    return clamp(angle, -maxAngle, maxAngle);
  }

  getRaceSteeringWheelRotationForTireAngle(tireAngle = 0, car = null) {
    return clamp(
      Number(tireAngle || 0) * this.getRaceSteeringRatio(car),
      -RACE_CONTROLLER_STEERING.maxSteeringWheelRotationRad,
      RACE_CONTROLLER_STEERING.maxSteeringWheelRotationRad
    );
  }

  getRaceVisibleSteeringWheelRotationRad(steering = this.raceInput.steeringWheel, speedMps = this.playtestSession?.speedMps || 0) {
    return this.getRaceSteeringWheelRotationForTireAngle(
      this.getRacePhysicalTireAngleForSteering(steering, speedMps)
    );
  }

  getRaceSteeringReturnRate(speedMps = 0) {
    const speed = Math.max(0, Number(speedMps) || 0);
    return RACE_CONTROLLER_STEERING.returnRateBase
      + clamp(speed / 38, 0, 1) * RACE_CONTROLLER_STEERING.returnRateHighSpeedBonus;
  }

  moveRaceAxisToward(current = 0, target = 0, rate = 1, seconds = 0) {
    const from = clamp(Number(current) || 0, 0, 1);
    const to = clamp(Number(target) || 0, 0, 1);
    const maxStep = Math.max(0, Number(rate) || 0) * Math.max(0, Number(seconds) || 0);
    if (Math.abs(to - from) <= maxStep) return to;
    return from + Math.sign(to - from) * maxStep;
  }

  updateRacePedalAxes(seconds = 0) {
    const dt = Math.max(0, Number(seconds) || 0);
    const throttleTarget = clamp(Number(this.raceInput.rawThrottleAxis || 0), 0, 1);
    const brakeTarget = clamp(Number(this.raceInput.rawBrakeAxis || 0), 0, 1);
    const followAxis = (current, target, analogActive, pressRate, releaseRate) => {
      if (analogActive) {
        return current + (target - current) * Math.min(1, dt * RACE_PEDAL_INPUT.analogFollowRate);
      }
      return this.moveRaceAxisToward(
        current,
        target,
        target > current ? pressRate : releaseRate,
        dt
      );
    };
    this.raceInput.throttleAxis = clamp(followAxis(
      Number(this.raceInput.throttleAxis || 0),
      throttleTarget,
      Boolean(this.raceInput.analogThrottleActive),
      RACE_PEDAL_INPUT.digitalThrottlePressRate,
      RACE_PEDAL_INPUT.digitalThrottleReleaseRate
    ), 0, 1);
    this.raceInput.brakeAxis = clamp(followAxis(
      Number(this.raceInput.brakeAxis || 0),
      brakeTarget,
      Boolean(this.raceInput.analogBrakeActive),
      RACE_PEDAL_INPUT.digitalBrakePressRate,
      RACE_PEDAL_INPUT.digitalBrakeReleaseRate
    ), 0, 1);
    this.raceInput.throttle = this.raceInput.throttleAxis > RACE_PEDAL_INPUT.activeThreshold;
    this.raceInput.brake = this.raceInput.brakeAxis > RACE_PEDAL_INPUT.activeThreshold;
  }

  applyRaceAnalogInput() {
    const axes = typeof this.game?.input?.getGamepadAxes === 'function'
      ? this.game.input.getGamepadAxes()
      : this.game?.input?.gamepadAxes;
    const heldThrottle = this.raceInput.activeThrottlePointerId !== null
      && this.raceInput.activeThrottlePointerId !== undefined;
    const heldBrake = this.raceInput.activeBrakePointerId !== null
      && this.raceInput.activeBrakePointerId !== undefined;
    const digitalThrottle = heldThrottle || this.raceInput.keyboardThrottle;
    const digitalBrake = heldBrake || this.raceInput.keyboardBrake;
    if (!axes) {
      this.raceInput.analogSteeringActive = false;
      this.raceInput.analogSteeringIntent = 0;
      this.raceInput.analogSteeringCenteredMs = Number(this.raceInput.analogSteeringCenteredMs || 0) + 16;
      this.raceInput.lookIntentX = 0;
      this.raceInput.analogThrottleActive = false;
      this.raceInput.analogBrakeActive = false;
      this.raceInput.rawThrottleAxis = digitalThrottle ? 1 : 0;
      this.raceInput.rawBrakeAxis = digitalBrake ? 1 : 0;
      return;
    }
    const leftX = Number(axes.leftX || 0);
    const rightX = Number(axes.rightX || 0);
    const rightTrigger = clamp(Number(axes.rightTrigger || axes.throttle || 0), 0, 1);
    const leftTrigger = clamp(Number(axes.leftTrigger || axes.brake || 0), 0, 1);
    const wasAnalogActive = this.raceInput.analogSteeringActive || this.raceInput.lastSteeringInputMode === 'analog';
    const enterDeadzone = 0.1;
    const exitDeadzone = 0.055;
    const activeThreshold = wasAnalogActive ? exitDeadzone : enterDeadzone;
    if (Math.abs(leftX) > activeThreshold) {
      const shaped = Math.sign(leftX) * Math.pow(Math.abs(leftX), 1.34);
      this.raceInput.analogSteeringIntent = clamp(shaped, -1, 1);
      this.raceInput.analogSteeringActive = true;
      this.raceInput.analogSteeringCenteredMs = 0;
    } else {
      this.raceInput.analogSteeringIntent = 0;
      this.raceInput.analogSteeringActive = false;
      this.raceInput.analogSteeringCenteredMs = Number(this.raceInput.analogSteeringCenteredMs || 0) + 16;
    }
    this.raceInput.lookIntentX = this.hasPhysicalRaceGamepad() && Math.abs(rightX) > 0.12
      ? clamp(Math.sign(rightX) * Math.pow(Math.abs(rightX), 1.05), -1, 1)
      : 0;
    this.raceInput.analogThrottleActive = rightTrigger > 0.02 && !digitalThrottle;
    this.raceInput.analogBrakeActive = leftTrigger > 0.02 && !digitalBrake;
    this.raceInput.rawThrottleAxis = Math.max(digitalThrottle ? 1 : 0, rightTrigger);
    this.raceInput.rawBrakeAxis = Math.max(digitalBrake ? 1 : 0, leftTrigger);
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
    if (this.raceInput.paused) {
      this.raceInput.pauseMenuMode = 'main';
      this.raceInput.pauseMenuIndex = 0;
    }
  }

  getRacePauseMenuRows() {
    if (this.raceInput.pauseMenuMode === 'settings') {
      return [
        {
          id: 'race-toggle-abs',
          label: 'ABS',
          value: this.raceInput.absEnabled === false ? 'Off' : 'On',
          onAdjust: () => this.toggleRaceAbs(),
          onClick: () => this.toggleRaceAbs()
        },
        {
          id: 'race-toggle-tc',
          label: 'Traction Control',
          value: this.raceInput.tractionControlEnabled === false ? 'Off' : 'On',
          onAdjust: () => this.toggleRaceTractionControl(),
          onClick: () => this.toggleRaceTractionControl()
        },
        {
          id: 'race-toggle-transmission',
          label: 'Transmission',
          value: this.raceInput.autoShift ? 'Auto' : 'Manual',
          onAdjust: () => this.toggleRaceTransmissionMode(),
          onClick: () => this.toggleRaceTransmissionMode()
        },
        {
          id: 'race-toggle-telemetry',
          label: 'Telemetry',
          value: this.raceInput.telemetryVisible ? 'On' : 'Off',
          onAdjust: () => this.toggleRaceTelemetry(),
          onClick: () => this.toggleRaceTelemetry()
        },
        {
          id: 'race-pause-back',
          label: 'Back',
          value: '',
          onClick: () => {
            this.raceInput.pauseMenuMode = 'main';
            this.raceInput.pauseMenuIndex = 0;
          }
        }
      ];
    }
    return [
      {
        id: 'race-resume',
        label: 'Return to Game',
        value: '',
        onClick: () => this.toggleRacePause()
      },
        {
        id: 'race-car-settings',
        label: 'Settings',
        value: '',
        onClick: () => {
          this.raceInput.pauseMenuMode = 'settings';
          this.raceInput.pauseMenuIndex = 0;
        }
      },
      {
        id: 'race-exit-main',
        label: 'Exit to Main Menu',
        value: '',
        onClick: () => this.exitPlaytestToMainMenu()
      }
    ];
  }

  moveRacePauseSelection(delta = 0) {
    const rows = this.getRacePauseMenuRows();
    if (!rows.length) return;
    this.raceInput.pauseMenuIndex = (Math.round(Number(this.raceInput.pauseMenuIndex || 0)) + delta + rows.length) % rows.length;
  }

  activateRacePauseSelection() {
    const rows = this.getRacePauseMenuRows();
    const row = rows[clamp(Math.round(Number(this.raceInput.pauseMenuIndex || 0)), 0, Math.max(0, rows.length - 1))];
    row?.onClick?.();
  }

  adjustRacePauseSelection(delta = 0) {
    const rows = this.getRacePauseMenuRows();
    const row = rows[clamp(Math.round(Number(this.raceInput.pauseMenuIndex || 0)), 0, Math.max(0, rows.length - 1))];
    if (row?.onAdjust) row.onAdjust(delta);
  }

  backRacePauseMenu() {
    if (this.raceInput.pauseMenuMode === 'settings') {
      this.raceInput.pauseMenuMode = 'main';
      this.raceInput.pauseMenuIndex = 0;
      return;
    }
    this.toggleRacePause();
  }

  handleRacePauseMenuInput({ wasPressed, wasPressedCode, wasGamepadPressed } = {}) {
    if (wasPressed?.('up') || wasPressedCode?.('ArrowUp') || wasPressedCode?.('KeyW')) this.moveRacePauseSelection(-1);
    if (wasPressed?.('down') || wasPressedCode?.('ArrowDown') || wasPressedCode?.('KeyS')) this.moveRacePauseSelection(1);
    if (wasPressed?.('left') || wasPressedCode?.('ArrowLeft') || wasPressedCode?.('KeyA')) this.adjustRacePauseSelection(-1);
    if (wasPressed?.('right') || wasPressedCode?.('ArrowRight') || wasPressedCode?.('KeyD')) this.adjustRacePauseSelection(1);
    if (wasGamepadPressed?.('dpadUp')) this.moveRacePauseSelection(-1);
    if (wasGamepadPressed?.('dpadDown')) this.moveRacePauseSelection(1);
    if (wasGamepadPressed?.('dpadLeft')) this.adjustRacePauseSelection(-1);
    if (wasGamepadPressed?.('dpadRight')) this.adjustRacePauseSelection(1);
    if (wasPressed?.('interact') || wasPressedCode?.('Enter') || wasGamepadPressed?.('gamepadA')) this.activateRacePauseSelection();
    if (wasPressed?.('cancel') || wasPressedCode?.('Escape') || wasGamepadPressed?.('gamepadB')) this.backRacePauseMenu();
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

  toggleRaceAbs() {
    this.raceInput.absEnabled = this.raceInput.absEnabled === false;
    if (this.playtestSession) this.playtestSession.absEnabled = this.raceInput.absEnabled !== false;
    this.status = `ABS ${this.raceInput.absEnabled === false ? 'Off' : 'On'}`;
  }

  toggleRaceTractionControl() {
    this.raceInput.tractionControlEnabled = this.raceInput.tractionControlEnabled === false;
    if (this.playtestSession) this.playtestSession.tractionControlEnabled = this.raceInput.tractionControlEnabled !== false;
    this.status = `Traction Control ${this.raceInput.tractionControlEnabled === false ? 'Off' : 'On'}`;
  }

  toggleRaceTelemetry() {
    this.raceInput.telemetryVisible = this.raceInput.telemetryVisible !== true;
    if (this.playtestSession) this.playtestSession.telemetryVisible = this.raceInput.telemetryVisible === true;
    this.status = `Race telemetry ${this.raceInput.telemetryVisible ? 'On' : 'Off'}`;
  }

  getRaceEquivalentFovDegrees(cameraView = this.raceInput.cameraView, speedFactor = 0, bounds = { w: 390 }) {
    const profile = this.getRaceCameraProjectionProfile(cameraView, speedFactor);
    const focal = Math.max(140, Number(bounds.w || 1) * (Number(profile.focalScale) || 1.04));
    return (2 * Math.atan((Number(bounds.w || 1) * 0.5) / focal)) * (180 / Math.PI);
  }

  getNextCoDriverCall() {
    const session = this.playtestSession;
    if (!session) return null;
    if (!session.codriverCalls?.length) return null;
    const lookAheadDistance = Number(session.distance || 0) + clamp(Math.abs(Number(session.speedMps || 0)) * 3.2, 80, 260);
    const segmentCue = this.getRaceSegmentCoDriverCue(this.getRaceSegmentAtDistance(lookAheadDistance));
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
      this.drawCarEditorWorkSurface(ctx, previewBounds);
    }
    this.drawRaceTopPlayControl(ctx, {
      x: shell.workSurface.x + shell.workSurface.w - 92,
      y: shell.workSurface.y + 12,
      w: 76,
      h: 34
    });
    if (shell.dropdown) {
      const dropdownItems = this.getMenuItems(shell.dropdown.rootId);
      const dropdownForRender = shell.dropdown;
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
      middleRailHeight: 50,
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
      this.drawRaceTopPlayControl(ctx, {
        x: layout.workSurface.x + Math.floor((layout.workSurface.w - 72) / 2),
        y: layout.workSurface.y + 12,
        w: 72,
        h: 34
      });
    } else {
      this.drawCarEditorWorkSurface(ctx, {
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
        y: layout.workSurface.y + layout.workSurface.h - 54,
        w: Math.max(1, layout.workSurface.w - 24),
        h: 46
      });
    }
    if (this.mobileRootOpen) {
      this.drawPortraitMenuSheet(ctx, layout);
    }
    if (this.playtestPickerOpen) {
      this.drawPlaytestPicker(ctx, width, height);
    }
  }

  drawRaceTopPlayControl(ctx, bounds) {
    if (this.mode !== 'race' || this.playtestPickerOpen || this.playtestSession) return;
    const action = { id: 'test-drive', label: '▶', active: true, onClick: () => this.handleMenuAction('test-drive') };
    this.registerDrawnButton(ctx, bounds, action);
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
        if (this.mode === 'race' && entry.id === 'track') {
          this.setRacePortraitMode('race');
          this.mobileRootOpen = false;
          this.activeRootId = 'track';
          this.menuScrollRegions = [];
          this.menuScrollDrag = null;
          this.pendingMenuScrollHit = null;
          return;
        }
        if (entry.id === 'ground') {
          this.setRacePortraitMode(entry.id);
          this.mobileRootOpen = false;
          this.activeRootId = 'ground';
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
      this.drawRaceTopPlayControl(ctx, {
        x: shell.surfaces.workSurface.x + shell.surfaces.workSurface.w - 86,
        y: shell.surfaces.workSurface.y + 10,
        w: 72,
        h: 32
      });
    } else {
      this.drawCarEditorWorkSurface(ctx, {
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
    if (this.hasPhysicalRaceGamepad()) {
      this.clearRaceTouchControls();
      const bounds = { x: 0, y: 0, w: width, h: height };
      this.editorBounds = { ...bounds };
      this.drawRacePlaytestScreen(ctx, bounds);
      return;
    }
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
    const renderStartMs = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : 0;
    const cameraView = this.raceInput.cameraView;
    ctx.save();
    ctx.beginPath();
    ctx.rect?.(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.clip?.();
    this.drawMode7Preview(ctx, bounds, {
      playtest: true,
      showScaffoldText: false,
      showPlaytestHud: false
    });
    if (cameraView === 'first-person') {
      this.drawRaceSteeringWheel(ctx, bounds);
    } else if (Math.abs(Number(this.raceInput.lookAngle || 0)) < 0.28) {
      this.drawRaceThirdPersonCar(ctx, bounds);
    }
    this.drawRacePlaytestHud(ctx, bounds);
    this.drawRaceEdgeResetFade(ctx, bounds);
    if (this.raceInput.paused) this.drawRacePauseOverlay(ctx, bounds);
    ctx.restore();
    if (renderStartMs > 0) {
      const elapsedMs = Math.max(0, performance.now() - renderStartMs);
      this.racePlaytestRenderMs = this.racePlaytestRenderMs > 0
        ? this.racePlaytestRenderMs * 0.82 + elapsedMs * 0.18
        : elapsedMs;
      this.lastRaceRenderStats = {
        ...(this.lastRaceRenderStats || {}),
        renderMs: this.racePlaytestRenderMs,
        physicsInDraw: false
      };
    }
  }

  drawRaceEdgeResetFade(ctx, bounds) {
    const fadeMs = Number(this.playtestSession?.edgeResetFadeMs || 0);
    if (!fadeMs) return;
    let alpha = 0;
    if (fadeMs > RACE_EDGE_RESET_FADE_IN_MS + RACE_EDGE_RESET_BLACK_HOLD_MS) {
      alpha = clamp((RACE_EDGE_RESET_TOTAL_MS - fadeMs) / RACE_EDGE_RESET_FADE_OUT_MS, 0, 1);
    } else if (fadeMs > RACE_EDGE_RESET_FADE_IN_MS) {
      alpha = 1;
    } else {
      alpha = clamp(fadeMs / RACE_EDGE_RESET_FADE_IN_MS, 0, 1);
    }
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.restore();
  }

  drawRaceThirdPersonCar(ctx, bounds) {
    const lateral = clamp(Number(this.playtestSession?.lateral || 0), -1.2, 1.2);
    const renderCamera = this.lastRaceRenderCamera;
    const segment = this.getRaceSegmentAtDistance(this.getRaceVisualTravelDistance()).segment;
    const carWorldX = Number(this.playtestSession?.worldX || 0);
    const carWorldZ = Number(this.playtestSession?.worldZ || 0);
    const roadElevation = this.playtestSession
      ? this.getRaceStitchedTerrainElevationAtWorldPoint({ x: carWorldX, z: carWorldZ }, Number(segment?.elevation || 0))
      : 0;
    const carPoint = this.playtestSession && renderCamera?.camera
      ? this.projectRaceWorldPointToCamera({
        x: carWorldX,
        z: carWorldZ,
        elevation: roadElevation,
        segment
      }, renderCamera.camera, renderCamera.cameraYaw, renderCamera.bounds || bounds)
      : null;
    const anchorCamera = renderCamera?.camera
      ? {
        ...renderCamera.camera,
        elevation: Number(renderCamera.camera.roadElevation || 0) + 0.14,
        eyeHeight: 0.14
      }
      : null;
    const roadContactPoint = this.playtestSession && anchorCamera
      ? this.projectRaceWorldPointToCamera({
        x: carWorldX,
        z: carWorldZ,
        elevation: roadElevation,
        segment
      }, anchorCamera, renderCamera.cameraYaw, renderCamera.bounds || bounds)
      : null;
    const centerX = carPoint?.visible && Number.isFinite(carPoint.screenX)
      ? carPoint.screenX
      : bounds.x + bounds.w / 2 + lateral * bounds.w * 0.055;
    const y = this.getRaceThirdPersonCarAnchorY(bounds, roadContactPoint?.visible ? roadContactPoint : carPoint);
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
    const frontTireAngle = Number.isFinite(this.playtestSession?.tireSlip?.frontTireAngle)
      ? this.playtestSession.tireSlip.frontTireAngle
      : this.getRacePhysicalTireAngleForSteering(this.raceInput.steeringWheel, this.playtestSession?.speedMps || 0);
    const artChoice = this.getRaceCarProjectedArtRef(this.selectedCar, Number(this.playtestSession?.carYaw || 0), Number(renderCamera?.cameraYaw || 0), {
      reversing: Number(this.playtestSession?.speedMps || 0) < -0.3 || Number(this.raceInput?.gear || 0) < 0,
      steering: Number(this.raceInput?.steeringWheel || 0)
    });
    if (!String(artChoice.artRef || '').trim() && renderCamera?.camera) {
      const drewFlatCar = this.drawRaceProjectedProceduralCar(ctx, renderCamera.bounds || bounds, {
        x: carWorldX,
        z: carWorldZ,
        elevation: roadElevation + 0.035,
        yaw: Number(this.playtestSession?.carYaw || 0),
        camera: renderCamera.camera,
        cameraYaw: renderCamera.cameraYaw,
        car: this.selectedCar,
        color: this.getDamageColor(totalDamage),
        frontTireAngle,
        braking: Boolean(this.raceInput.brake || this.raceInput.handbrake),
        segment
      });
      if (drewFlatCar) return;
    }
    const wheelW = carW * 0.16;
    const wheelH = carH * 0.36;
    const tireCompound = this.selectedCar?.setup?.tireCompoundByWheel?.fl || this.selectedCar?.setup?.defaultTireCompound || 'tarmac';
    const tireEntry = this.selectedCar?.art?.tireTreads?.[tireCompound] || null;
    const tireCanvas = tireEntry?.artRef ? this.getRaceArtSpriteCanvas(tireEntry.artRef, { frameIndex: tireEntry.frameIndex || 0 }) : null;
    const drawWheel = (x, y, turn = 0) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(turn);
      if (tireCanvas && typeof ctx.drawImage === 'function') {
        const previousSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tireCanvas, -wheelW / 2, -wheelH / 2, wheelW, wheelH);
        ctx.imageSmoothingEnabled = previousSmoothing;
      } else {
        ctx.fillStyle = '#050807';
        ctx.fillRect(-wheelW / 2, -wheelH / 2, wheelW, wheelH);
      }
      ctx.restore();
    };
    drawWheel(centerX - carW * 0.38, y - carH * 0.24, frontTireAngle);
    drawWheel(centerX + carW * 0.38, y - carH * 0.24, frontTireAngle);
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
    const shellCanvas = artChoice.artRef ? this.getRaceArtSpriteCanvas(artChoice.artRef, { frameIndex: artChoice.frameIndex || 0 }) : null;
    if (shellCanvas && typeof ctx.drawImage === 'function') {
      const previousSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      const drawH = clamp(carW * (Number(shellCanvas.height || 1) / Math.max(1, Number(shellCanvas.width || 1))), carH * 0.76, carH * 1.35);
      ctx.drawImage(shellCanvas, centerX - carW * 0.5, y - drawH * 0.58, carW, drawH);
      ctx.imageSmoothingEnabled = previousSmoothing;
    }
    (this.selectedCar?.art?.addOns || [])
      .filter((entry) => entry?.enabled !== false && entry?.artRef)
      .forEach((entry) => {
        const addOnCanvas = this.getRaceArtSpriteCanvas(entry.artRef, { frameIndex: entry.frameIndex || 0 });
        if (!addOnCanvas || typeof ctx.drawImage !== 'function') return;
        const scale = Number(entry.scale || 1) || 1;
        const drawW = carW * 0.6 * scale;
        const drawH = drawW * (Number(addOnCanvas.height || 1) / Math.max(1, Number(addOnCanvas.width || 1)));
        ctx.drawImage(addOnCanvas, centerX - drawW * 0.5 + carW * Number(entry.offsetX || 0), y + carH * 0.3 + carH * Number(entry.offsetY || 0), drawW, drawH);
      });
    if (this.raceInput.brake || this.raceInput.handbrake) {
      ctx.fillStyle = '#ff4f4f';
      ctx.fillRect(centerX - carW * 0.42, y + carH * 0.38, carW * 0.2, carH * 0.12);
      ctx.fillRect(centerX + carW * 0.22, y + carH * 0.38, carW * 0.2, carH * 0.12);
    }
  }

  getRaceProjectedCarFootprintPoints(center = {}, yaw = 0, car = this.selectedCar, { elevation = 0 } = {}) {
    const dimensions = this.getRaceCarDimensions(car);
    const forward = this.getRaceForwardVector(yaw);
    const right = this.getRaceRightVector(yaw);
    const halfLength = Number(dimensions.lengthM || 4.6) * 0.5;
    const halfWidth = Number(dimensions.widthM || 1.8) * 0.5;
    const x = Number(center.x || 0);
    const z = Number(center.z || 0);
    const y = Number(center.elevation ?? elevation ?? 0);
    return [
      { x: x + forward.x * halfLength - right.x * halfWidth, z: z + forward.z * halfLength - right.z * halfWidth, elevation: y },
      { x: x + forward.x * halfLength + right.x * halfWidth, z: z + forward.z * halfLength + right.z * halfWidth, elevation: y },
      { x: x - forward.x * halfLength + right.x * halfWidth, z: z - forward.z * halfLength + right.z * halfWidth, elevation: y },
      { x: x - forward.x * halfLength - right.x * halfWidth, z: z - forward.z * halfLength - right.z * halfWidth, elevation: y }
    ];
  }

  getRaceProjectedWheelFootprintPoints(center = {}, yaw = 0, { lengthM = 0.68, widthM = 0.26, elevation = 0 } = {}) {
    const forward = this.getRaceForwardVector(yaw);
    const right = this.getRaceRightVector(yaw);
    const halfLength = Math.max(0.1, Number(lengthM) || 0.68) * 0.5;
    const halfWidth = Math.max(0.06, Number(widthM) || 0.26) * 0.5;
    const x = Number(center.x || 0);
    const z = Number(center.z || 0);
    const y = Number(center.elevation ?? elevation ?? 0);
    return [
      { x: x + forward.x * halfLength - right.x * halfWidth, z: z + forward.z * halfLength - right.z * halfWidth, elevation: y },
      { x: x + forward.x * halfLength + right.x * halfWidth, z: z + forward.z * halfLength + right.z * halfWidth, elevation: y },
      { x: x - forward.x * halfLength + right.x * halfWidth, z: z - forward.z * halfLength + right.z * halfWidth, elevation: y },
      { x: x - forward.x * halfLength - right.x * halfWidth, z: z - forward.z * halfLength - right.z * halfWidth, elevation: y }
    ];
  }

  getRaceWheelWorldCenters(center = {}, yaw = 0, car = this.selectedCar, { elevation = 0 } = {}) {
    const dimensions = this.getRaceCarDimensions(car);
    const forward = this.getRaceForwardVector(yaw);
    const right = this.getRaceRightVector(yaw);
    const x = Number(center.x || 0);
    const z = Number(center.z || 0);
    const y = Number(center.elevation ?? elevation ?? 0);
    const frontOffset = Number(dimensions.wheelbaseM || 2.67) * 0.5;
    const rearOffset = -frontOffset;
    const frontHalfTrack = Number(dimensions.trackFrontM || dimensions.trackWidthM || 1.56) * 0.5;
    const rearHalfTrack = Number(dimensions.trackRearM || dimensions.trackWidthM || 1.56) * 0.5;
    const make = (longitudinal, lateral) => ({
      x: x + forward.x * longitudinal + right.x * lateral,
      z: z + forward.z * longitudinal + right.z * lateral,
      elevation: y
    });
    return {
      fl: make(frontOffset, -frontHalfTrack),
      fr: make(frontOffset, frontHalfTrack),
      rl: make(rearOffset, -rearHalfTrack),
      rr: make(rearOffset, rearHalfTrack)
    };
  }

  getRaceVehicleCollisionContactPoints({
    session = this.playtestSession,
    car = this.selectedCar,
    tuning = this.getRaceCarTuning(car)
  } = {}) {
    const yaw = Number.isFinite(session?.carYaw) ? Number(session.carYaw) : 0;
    const center = {
      x: Number(session?.worldX || 0),
      z: Number(session?.worldZ || 0),
      elevation: Number(session?.elevation || 0)
    };
    const bodyCorners = this.getRaceProjectedCarFootprintPoints(center, yaw, car, { elevation: center.elevation });
    const wheelCenters = this.getRaceWheelWorldPositions({ tuning, session, car });
    const midpoint = (a, b, id) => ({
      id,
      x: (Number(a.x || 0) + Number(b.x || 0)) * 0.5,
      z: (Number(a.z || 0) + Number(b.z || 0)) * 0.5,
      elevation: center.elevation
    });
    return [
      { id: 'body-front-left', ...bodyCorners[0] },
      { id: 'body-front-right', ...bodyCorners[1] },
      { id: 'body-rear-right', ...bodyCorners[2] },
      { id: 'body-rear-left', ...bodyCorners[3] },
      midpoint(bodyCorners[0], bodyCorners[1], 'body-front'),
      midpoint(bodyCorners[1], bodyCorners[2], 'body-right'),
      midpoint(bodyCorners[2], bodyCorners[3], 'body-rear'),
      midpoint(bodyCorners[3], bodyCorners[0], 'body-left'),
      ...Object.entries(wheelCenters).map(([id, point]) => ({
        id: `wheel-${id}`,
        x: Number(point.x || 0),
        z: Number(point.z || 0),
        elevation: center.elevation,
        wheel: id
      }))
    ];
  }

  drawRaceProjectedProceduralCar(ctx, bounds, {
    x = 0,
    z = 0,
    elevation = 0,
    yaw = 0,
    camera = null,
    cameraYaw = 0,
    car = this.selectedCar,
    color = '#58d6ff',
    frontTireAngle = 0,
    braking = false,
    segment = null
  } = {}) {
    if (!ctx || !camera) return false;
    const project = (points) => points.map((point) => this.projectRaceWorldPointToCamera({
      ...point,
      segment
    }, camera, cameraYaw, bounds));
    const center = { x, z, elevation };
    const body = project(this.getRaceProjectedCarFootprintPoints(center, yaw, car, { elevation }));
    const drewBody = this.drawRaceProjectedVehicleQuad(ctx, bounds, body, color);
    const wheelCenters = this.getRaceWheelWorldCenters(center, yaw, car, { elevation: elevation + 0.012 });
    const tireFill = '#050807';
    const frontYaw = Number(yaw || 0) - Number(frontTireAngle || 0);
    const wheels = [
      project(this.getRaceProjectedWheelFootprintPoints(wheelCenters.fl, frontYaw, { elevation: elevation + 0.012 })),
      project(this.getRaceProjectedWheelFootprintPoints(wheelCenters.fr, frontYaw, { elevation: elevation + 0.012 })),
      project(this.getRaceProjectedWheelFootprintPoints(wheelCenters.rl, yaw, { elevation: elevation + 0.012 })),
      project(this.getRaceProjectedWheelFootprintPoints(wheelCenters.rr, yaw, { elevation: elevation + 0.012 }))
    ];
    let drewWheel = false;
    wheels.forEach((wheel) => {
      drewWheel = this.drawRaceProjectedVehicleQuad(ctx, bounds, wheel, tireFill) || drewWheel;
    });
    if (braking) {
      const brakeColor = '#ff4f4f';
      [wheelCenters.rl, wheelCenters.rr].forEach((wheelCenter) => {
        const marker = project(this.getRaceProjectedWheelFootprintPoints(wheelCenter, yaw, {
          lengthM: 0.2,
          widthM: 0.38,
          elevation: elevation + 0.02
        }));
        this.drawRaceProjectedVehicleQuad(ctx, bounds, marker, brakeColor);
      });
    }
    return drewBody || drewWheel;
  }

  drawRaceSteeringWheel(ctx, bounds) {
    const wheelX = bounds.x + bounds.w / 2;
    const wheelY = bounds.y + bounds.h * 0.82;
    const wheelR = Math.max(34, Math.min(bounds.w, bounds.h) * 0.13);
    const rotation = Number.isFinite(this.playtestSession?.steeringWheelRotation)
      ? this.playtestSession.steeringWheelRotation
      : this.getRaceVisibleSteeringWheelRotationRad(
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
    this.drawRacePlaytestTopControls(ctx, bounds);
    this.drawRaceTrackMinimap(ctx, {
      x: bounds.x + 5,
      y: bounds.y + 5,
      w: Math.min(92, Math.max(64, bounds.w * 0.22)),
      h: Math.min(92, Math.max(64, bounds.h * 0.22))
    });
    this.drawRaceTimePanel(ctx, bounds);
    this.drawRaceCarStatusPanel(ctx, bounds);
    this.drawRaceTachPanel(ctx, bounds, { speedMph, progress });
    if (this.raceInput.telemetryVisible || this.playtestSession?.diagnosticMode) {
      this.drawRaceDiagnosticsHud(ctx, bounds);
    }
  }

  drawRacePlaytestTopControls(ctx, bounds) {
    const rect = {
      x: bounds.x + Math.floor((bounds.w - 34) / 2),
      y: bounds.y + 6,
      w: 34,
      h: 24
    };
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,7,0.72)';
    ctx.strokeStyle = 'rgba(217,230,210,0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 5);
    else ctx.rect?.(rect.x, rect.y, rect.w, rect.h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d9e6d2';
    const barW = 4;
    const barH = 12;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.fillRect(cx - 7, cy - barH / 2, barW, barH);
    ctx.fillRect(cx + 3, cy - barH / 2, barW, barH);
    ctx.font = `700 11px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.getRacePlaytestFpsLabel(), rect.x + rect.w + 8, rect.y + rect.h / 2);
    ctx.font = `600 10px ${UI_SUITE.font.family}`;
    ctx.fillStyle = 'rgba(217,230,210,0.78)';
    ctx.fillText(this.getRacePlaytestPolygonLabel(), rect.x + rect.w + 8, rect.y + rect.h / 2 + 13);
    ctx.restore();
    this.buttons.push({
      id: 'race-pause-return-editor',
      bounds: { ...rect, id: 'race-pause-return-editor' },
      onClick: () => this.endPlaytest()
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
    (session.aiRuntime || []).forEach((ai) => {
      const pose = this.getRaceWorldPoseAtDistance(Number(ai.projectedDistance || ai.distance || 0));
      const screen = toScreen(pose);
      ctx.fillStyle = ai.difficulty === 'expert' ? '#ff5f57' : ai.difficulty === 'hard' ? '#f2d45c' : ai.difficulty === 'medium' ? '#7ed957' : '#58d6ff';
      ctx.beginPath();
      ctx.arc?.(screen.x, screen.y, 2.2, 0, Math.PI * 2);
      ctx.fill?.();
    });
    this.drawRaceMinimapCar(ctx, player, Number(session.carYaw || 0), scale);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 6px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(routeRuntimeType === 'circuit' ? `L${session.lap}` : `${Math.round((session.distance / Math.max(1, session.routeLength)) * 100)}%`, bounds.x + 5, bounds.y + 4);
    ctx.restore();
  }

  drawRaceDiagnosticsHud(ctx, bounds) {
    const session = this.playtestSession;
    const diagnostics = session?.diagnostics;
    if (!session || !diagnostics) return;
    const isCompact = bounds.w < 520;
    const panel = {
      x: bounds.x + Math.max(5, bounds.w * 0.18),
      y: bounds.y + 30,
      w: Math.min(isCompact ? 126 : 172, bounds.w * 0.34),
      h: isCompact ? 82 : 112
    };
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,7,0.58)';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 ${isCompact ? 6 : 8}px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const fmtMs = (ms) => ms === null || ms === undefined ? '--' : `${(Number(ms) / 1000).toFixed(2)}s`;
    const slip = session.tireSlip || {};
    const diagnosticMode = Boolean(diagnostics.mode);
    const averageSlip = RACE_WHEEL_IDS.reduce((sum, wheelId) => sum + Number(slip[wheelId] || 0), 0) / RACE_WHEEL_IDS.length;
    const throttle = Math.round(Number(this.raceInput.throttleAxis || 0) * 100);
    const brake = Math.round(Number(this.raceInput.brakeAxis || 0) * 100);
    const lines = diagnosticMode
      ? [
        `G ${Number(diagnostics.lateralG || 0).toFixed(2)} peak ${Number(diagnostics.peakLateralG || 0).toFixed(2)}`,
        `0-60 ${fmtMs(diagnostics.zeroToSixtyMs)}  60-0 ${fmtMs(diagnostics.sixtyToZeroMs)}`,
        `1/4 ${fmtMs(diagnostics.quarterMileMs)} ${diagnostics.quarterMileTrapMph ? `${Math.round(diagnostics.quarterMileTrapMph)}mph` : ''}`,
        `Slalom ${Number(diagnostics.nextSlalomGate || 0)}/${(diagnostics.slalomGates || []).length}`,
        `Ghost ${diagnostics.ghostDeltaMs === null || diagnostics.ghostDeltaMs === undefined ? '--' : `${diagnostics.ghostDeltaMs >= 0 ? '+' : ''}${(diagnostics.ghostDeltaMs / 1000).toFixed(2)}`}`
      ]
      : [
        `Lat ${Number(diagnostics.lateralG || 0).toFixed(2)}g  Peak ${Number(diagnostics.peakLateralG || 0).toFixed(2)}g`,
        `Slip ${averageSlip.toFixed(2)}  Yaw ${Number(slip.slipAngle || 0).toFixed(2)}`,
        `Pedal T${throttle} B${brake}  HB ${this.raceInput.handbrake ? 'ON' : 'off'}`,
        `Surface ${RACE_WHEEL_IDS.map((wheelId) => String(slip.wheelSurfaces?.[wheelId] || 'road')[0].toUpperCase()).join('')}`,
        `Load ${RACE_WHEEL_IDS.map((wheelId) => Math.round(Number(diagnostics.tireLoad?.[wheelId] || 1) * 100)).join('/')}`
      ];
    lines.slice(0, isCompact ? 4 : 5).forEach((line, index) => {
      ctx.fillText(line, panel.x + 6, panel.y + 6 + index * (isCompact ? 9 : 11));
    });
    const tireY = panel.y + panel.h - (isCompact ? 31 : 42);
    const cellW = Math.max(16, (panel.w - 16) / 4);
    RACE_WHEEL_IDS.forEach((wheelId, index) => {
      const temp = Number(diagnostics.tireTemperature?.[wheelId] || 70);
      const load = Number(diagnostics.tireLoad?.[wheelId] || 1);
      const travel = Number(diagnostics.suspensionTravel?.[wheelId] || 0);
      const wheelSlip = Number(slip[wheelId] || 0);
      const x = panel.x + 6 + index * cellW;
      ctx.fillStyle = temp > 175 ? '#ff5f57' : temp > 125 ? '#f2d45c' : '#7ed957';
      ctx.fillRect(x, tireY, cellW - 4, 4 + travel * 12);
      ctx.fillStyle = wheelSlip > 0.45 ? '#ff5f57' : wheelSlip > 0.18 ? '#f2d45c' : '#58d6ff';
      ctx.fillRect(x, tireY - 5, Math.max(1, (cellW - 4) * clamp(wheelSlip, 0, 1)), 3);
      ctx.fillStyle = UI_SUITE.colors.textMuted;
      ctx.font = `700 ${isCompact ? 5 : 6}px ${UI_SUITE.font.family}`;
      ctx.fillText(`${RACE_WHEEL_LABELS[wheelId]} ${Math.round(load * 100)}`, x, tireY + 16);
    });
    if (!isCompact && session.aiRuntime?.length) {
      const leaders = [...session.aiRuntime]
        .sort((a, b) => ((b.lap || 1) - (a.lap || 1)) || ((b.projectedDistance || 0) - (a.projectedDistance || 0)))
        .slice(0, 3);
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `700 7px ${UI_SUITE.font.family}`;
      leaders.forEach((ai, index) => {
        ctx.fillText(`${index + 1}. ${ai.name} L${ai.lap}`, panel.x + panel.w + 8, panel.y + 8 + index * 10);
      });
    }
    ctx.restore();
  }

  drawRaceMinimapCar(ctx, player, yaw = 0, scale = 1) {
    const size = clamp(10 + Number(scale || 1) * 0.08, 11, 18);
    const forward = {
      x: Math.sin(Number(yaw) || 0),
      y: Math.cos(Number(yaw) || 0)
    };
    const right = {
      x: -Math.cos(Number(yaw) || 0),
      y: Math.sin(Number(yaw) || 0)
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
    drawPart({ x: car.x + 9, y: car.y + 7, w: 7, h: 6 }, damage.engine);
    drawPart({ x: car.x + 5, y: car.y + 19, w: 16, h: 5 }, damage.transmission);
  }

  drawRacePauseOverlay(ctx, bounds) {
    const rows = this.getRacePauseMenuRows();
    const selectedIndex = clamp(Math.round(Number(this.raceInput.pauseMenuIndex || 0)), 0, Math.max(0, rows.length - 1));
    const width = Number(bounds.w || 1);
    const height = Number(bounds.h || 1);
    const titleY = bounds.y + Math.max(54, height * 0.23);
    const startY = bounds.y + Math.max(104, height * 0.43);
    const rowGap = 34;
    const rowW = Math.min(320, Math.max(210, width * 0.74));
    const rowX = bounds.x + width / 2 - rowW / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = '#eef8e8';
    ctx.font = '22px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.raceInput.pauseMenuMode === 'settings' ? 'Settings' : 'Paused', bounds.x + width / 2, titleY);
    ctx.font = '16px Courier New';
    ctx.textAlign = 'left';
    rows.forEach((row, index) => {
      const active = index === selectedIndex;
      const y = startY + index * rowGap;
      const button = { x: rowX, y: y - 23, w: rowW, h: 31 };
      ctx.fillStyle = '#fff';
      ctx.font = '16px Courier New';
      ctx.textAlign = 'left';
      const prefix = active ? '> ' : '  ';
      ctx.fillText(prefix + row.label, rowX + 22, y);
      if (row.value) {
        ctx.textAlign = 'right';
        ctx.fillText(`< ${row.value} >`, rowX + rowW - 16, y);
      }
      this.registerDrawnButton(ctx, button, row);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '13px Courier New';
    ctx.textAlign = 'center';
    const footer = this.raceInput.pauseMenuMode === 'settings'
      ? 'D-pad: Navigate   Left/Right: Change   B: Back'
      : 'D-pad: Navigate   A: Select   START: Return';
    ctx.fillText(footer, bounds.x + width / 2, bounds.y + height - 24);
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
      this.raceInput.analogSteeringIntent = clamp(relX, -1, 1);
      this.raceInput.analogSteeringActive = true;
      return;
    }
    this.raceInput.analogSteeringActive = false;
    this.raceInput.analogSteeringIntent = 0;
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

  getRaceTuningTabs(car = this.selectedCar) {
    return [
      { id: 'tires', label: 'Tires' },
      { id: 'gearing', label: 'Gearing' },
      { id: 'alignment', label: 'Align' },
      { id: 'antiroll', label: 'ARB' },
      { id: 'springs', label: 'Springs' },
      { id: 'damping', label: 'Damping' },
      { id: 'aero', label: 'Aero' },
      { id: 'brake', label: 'Brake' },
      { id: 'differential', label: 'Diff' },
      { id: 'stats', label: 'Stats' }
    ];
  }

  getRaceTuningRowsForTab(tabId = this.preRaceTuningTab, car = this.selectedCar) {
    const setup = this.getRaceCarSetup(car);
    const tuning = car.tuning || {};
    const transmission = car.transmissions?.[this.getRaceTransmissionType(car)] || {};
    const gearRatios = Array.isArray(transmission.gearRatios) ? transmission.gearRatios : (tuning.gearRatios || []);
    if (tabId === 'tires') {
      return [
        ['frontTirePressure', 'Front Tire Pressure', (setup.tirePressurePsi.fl + setup.tirePressurePsi.fr) / 2, 'psi'],
        ['rearTirePressure', 'Rear Tire Pressure', (setup.tirePressurePsi.rl + setup.tirePressurePsi.rr) / 2, 'psi']
      ];
    }
    if (tabId === 'gearing') {
      return [
        ['gearFinalDrive', 'Final Drive', transmission.gearFinalDrive || tuning.gearFinalDrive, ''],
        ...gearRatios.map((ratio, index) => [`gearRatio-${index + 1}`, `${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} Gear`, ratio, ''])
      ];
    }
    if (tabId === 'alignment') {
      return [
        ['camberFront', 'Front Camber', tuning.camberFront || 0, 'deg'],
        ['camberRear', 'Rear Camber', tuning.camberRear || 0, 'deg'],
        ['toeFront', 'Front Toe', tuning.toeFront || 0, 'deg'],
        ['toeRear', 'Rear Toe', tuning.toeRear || 0, 'deg'],
        ['casterFront', 'Front Caster', tuning.casterFront || 5.5, 'deg']
      ];
    }
    if (tabId === 'antiroll') {
      return [
        ['antiRollFront', 'Front ARB', tuning.antiRollFront, ''],
        ['antiRollRear', 'Rear ARB', tuning.antiRollRear, '']
      ];
    }
    if (tabId === 'springs') {
      return [
        ['springFront', 'Front Spring Rate', tuning.springFront, ''],
        ['springRear', 'Rear Spring Rate', tuning.springRear, ''],
        ['rideHeightFront', 'Ride Height Front', tuning.rideHeightFront || 0.5, ''],
        ['rideHeightRear', 'Ride Height Rear', tuning.rideHeightRear || 0.5, ''],
        ['suspensionTravelFront', 'Front Suspension Travel', tuning.suspensionTravelFront || 0.5, ''],
        ['suspensionTravelRear', 'Rear Suspension Travel', tuning.suspensionTravelRear || 0.5, '']
      ];
    }
    if (tabId === 'damping') {
      return [
        ['reboundFront', 'Front Rebound', tuning.reboundFront || tuning.dampingFront, ''],
        ['reboundRear', 'Rear Rebound', tuning.reboundRear || tuning.dampingRear, ''],
        ['bumpFront', 'Front Bump', tuning.bumpFront || tuning.dampingFront, ''],
        ['bumpRear', 'Rear Bump', tuning.bumpRear || tuning.dampingRear, '']
      ];
    }
    if (tabId === 'aero') {
      return [
        ['aeroFront', 'Front Downforce', tuning.aeroFront, ''],
        ['aeroRear', 'Rear Downforce', tuning.aeroRear, '']
      ];
    }
    if (tabId === 'brake') {
      return [
        ['brakeBalance', 'Brake Balance', tuning.brakeBalance, ''],
        ['brakePressure', 'Brake Pressure', tuning.brakePressure || 1, '']
      ];
    }
    if (tabId === 'differential') {
      const drivetrain = String(tuning.drivetrain || 'awd');
      if (drivetrain === 'fwd') return [
        ['frontDifferentialAccel', 'Front Acceleration', tuning.frontDifferentialAccel ?? tuning.differentialAccel, ''],
        ['frontDifferentialDecel', 'Front Deceleration', tuning.frontDifferentialDecel ?? tuning.differentialDecel, '']
      ];
      if (drivetrain === 'rwd') return [
        ['rearDifferentialAccel', 'Rear Acceleration', tuning.rearDifferentialAccel ?? tuning.differentialAccel, ''],
        ['rearDifferentialDecel', 'Rear Deceleration', tuning.rearDifferentialDecel ?? tuning.differentialDecel, '']
      ];
      return [
        ['frontDifferentialAccel', 'Front Acceleration', tuning.frontDifferentialAccel ?? tuning.differentialAccel, ''],
        ['frontDifferentialDecel', 'Front Deceleration', tuning.frontDifferentialDecel ?? tuning.differentialDecel, ''],
        ['rearDifferentialAccel', 'Rear Acceleration', tuning.rearDifferentialAccel ?? tuning.differentialAccel, ''],
        ['rearDifferentialDecel', 'Rear Deceleration', tuning.rearDifferentialDecel ?? tuning.differentialDecel, ''],
        ['centerDifferentialBalance', 'Center Balance', tuning.centerDifferentialBalance || 0.5, '']
      ];
    }
    return [];
  }

  drawPreRaceTuningPanel(ctx, bounds) {
    const car = this.selectedCar;
    const setup = this.getRaceCarSetup(car);
    const tabs = this.getRaceTuningTabs(car);
    if (!tabs.some((tab) => tab.id === this.preRaceTuningTab)) this.preRaceTuningTab = tabs[0].id;
    const rowH = 24;
    const gap = 6;
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 12px ${UI_SUITE.font.family}`;
    ctx.fillText(`${car.name} setup`, bounds.x, bounds.y + 10, bounds.w);
    const tabCols = 5;
    const tabW = Math.max(46, (bounds.w - gap * (tabCols - 1)) / tabCols);
    tabs.forEach((tab, index) => {
      const col = index % tabCols;
      const row = Math.floor(index / tabCols);
      this.registerDrawnButton(ctx, {
        x: bounds.x + col * (tabW + gap),
        y: bounds.y + 24 + row * 30,
        w: tabW,
        h: 24
      }, {
        id: `tuning-tab-${tab.id}`,
        label: tab.label,
        active: this.preRaceTuningTab === tab.id,
        onClick: () => { this.preRaceTuningTab = tab.id; }
      });
    });
    const contentY = bounds.y + 88;
    if (this.preRaceTuningTab === 'tires') {
      const wheelLabels = [['fl', 'FL'], ['fr', 'FR'], ['rl', 'RL'], ['rr', 'RR']];
      const tireW = Math.max(62, (bounds.w - gap * 3) / 4);
      wheelLabels.forEach(([wheelId, label], index) => {
        const compound = this.getRaceTireCompound(setup.tireCompoundByWheel[wheelId]);
        this.registerDrawnButton(ctx, {
          x: bounds.x + index * (tireW + gap),
          y: contentY,
          w: tireW,
          h: 28
        }, {
          id: `tire-${wheelId}`,
          label: `${label} ${compound.label}`,
          onClick: () => this.cycleRaceTireCompound(wheelId)
        });
      });
    }
    if (this.preRaceTuningTab === 'stats') {
      this.drawRaceTuningStats(ctx, { x: bounds.x, y: contentY, w: bounds.w, h: bounds.h - (contentY - bounds.y) }, car);
      return;
    }
    const rows = this.getRaceTuningRowsForTab(this.preRaceTuningTab, car);
    const startY = contentY + (this.preRaceTuningTab === 'tires' ? 38 : 0);
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

  getRaceTuningPerformanceStats(car = this.selectedCar) {
    const tuning = this.getRaceCarTuning(car);
    const setupModifiers = this.getRaceSetupPhysicsModifiers(tuning, 26.8);
    const powerToWeight = tuning.powerHp / Math.max(1, tuning.weightKg / 1000);
    const driveMultiplier = tuning.drivetrain === 'awd' ? 1.08 : tuning.drivetrain === 'fwd' ? 0.95 : 1;
    const grip = clamp(tuning.tireGrip * this.getRaceTireSetupGripMultiplier(car, 'asphalt', 'clear') * setupModifiers.grip, 0.45, 1.8);
    const launchTraction = clamp(grip * setupModifiers.driveTraction * driveMultiplier, 0.45, 1.75);
    const ratioSpread = tuning.gearRatios.length ? tuning.gearRatios[0] * tuning.finalDrive : 12;
    const stockZeroToSixty = Number(tuning.zeroToSixtySec) || clamp(11.4 - powerToWeight * 0.021 - driveMultiplier * 0.7, 3.2, 12.5);
    const launchFactor = clamp(1 / Math.sqrt(Math.max(0.52, launchTraction)), 0.78, 1.3);
    const gearingFactor = clamp(Math.sqrt(14.4 / Math.max(7.5, ratioSpread)), 0.88, 1.18);
    const efficiencyFactor = clamp(Math.sqrt(0.86 / Math.max(0.58, tuning.drivetrainEfficiency)), 0.9, 1.16);
    const launchGearingEffect = launchFactor * gearingFactor * efficiencyFactor;
    const zeroToSixty = clamp(stockZeroToSixty * (1 + (launchGearingEffect - 1) * 0.3), 2.8, 16);
    const powerHundredFactor = clamp(2.34 + 38 / Math.max(70, powerToWeight), 2.2, 2.9);
    const zeroToHundred = clamp(zeroToSixty * powerHundredFactor, zeroToSixty + 2.8, 34);
    const topGearSpeed = this.getRaceRedlineSpeedMps(tuning, tuning.gearRatios.length) / MPH_TO_MPS;
    const aeroLimited = tuning.topSpeedMps / MPH_TO_MPS / Math.max(1, setupModifiers.aeroDrag * 0.035 + 0.985);
    const topSpeed = Math.min(Math.max(80, topGearSpeed), Math.max(80, aeroLimited));
    const brakeMu = clamp(grip * tuning.brakePressure * 0.96, 0.35, 1.55);
    const brakingDistance = (mph) => {
      const speed = mph * MPH_TO_MPS;
      return (speed * speed) / Math.max(1, 2 * 9.81 * brakeMu);
    };
    const lateralG60 = clamp(grip * (0.92 + (tuning.aeroFront + tuning.aeroRear) * 0.04), 0.35, 1.8);
    const lateralG120 = clamp(grip * (0.82 + (tuning.aeroFront + tuning.aeroRear) * 0.16), 0.3, 2.1);
    const piScore = clamp(
      Math.round(100 + powerToWeight * 1.7 + grip * 120 + tuning.brakePressure * 40 + setupModifiers.driveTraction * 35),
      100,
      999
    );
    const piClass = piScore >= 900 ? 'S2' : piScore >= 800 ? 'S1' : piScore >= 700 ? 'A' : piScore >= 600 ? 'B' : piScore >= 500 ? 'C' : piScore >= 400 ? 'D' : 'F';
    const stockTarget = RACE_STOCK_PERFORMANCE_TARGETS[car?.id] || null;
    return {
      zeroToSixty,
      zeroToHundred,
      topSpeed,
      braking60: brakingDistance(60),
      braking100: brakingDistance(100),
      lateralG60,
      lateralG120,
      weightKg: tuning.weightKg,
      frontWeightDistribution: tuning.frontWeightDistribution * 100,
      powerHp: tuning.powerHp,
      torqueLbFt: tuning.torqueLbFt,
      engineDisplacementL: tuning.engineDisplacementL,
      aspiration: tuning.aspiration,
      drivetrain: tuning.drivetrain.toUpperCase(),
      piClass,
      piScore,
      stockTarget
    };
  }

  drawRaceTuningStats(ctx, bounds, car = this.selectedCar) {
    const stats = this.getRaceTuningPerformanceStats(car);
    const rows = [
      ['0-60 mph', `${stats.zeroToSixty.toFixed(1)} s`],
      ['0-100 mph', `${stats.zeroToHundred.toFixed(1)} s`],
      ['Top Speed', `${Math.round(stats.topSpeed)} mph`],
      ['60-0 Braking', `${Math.round(stats.braking60)} m`],
      ['100-0 Braking', `${Math.round(stats.braking100)} m`],
      ['Lat G @ 60', `${stats.lateralG60.toFixed(2)} g`],
      ['Lat G @ 120', `${stats.lateralG120.toFixed(2)} g`],
      ['Vehicle Weight', `${Math.round(stats.weightKg)} kg`],
      ['Front Weight', `${Math.round(stats.frontWeightDistribution)}%`],
      ['Horsepower', `${Math.round(stats.powerHp)} HP`],
      ['Torque', `${Math.round(stats.torqueLbFt)} lb-ft`],
      ['Displacement', `${stats.engineDisplacementL.toFixed(1)} L`],
      ['Aspiration', stats.aspiration],
      ['Drivetrain', stats.drivetrain],
      ['PI', `${stats.piClass} ${stats.piScore}`]
    ];
    const columns = bounds.w > 430 ? 2 : 1;
    const gap = 6;
    const rowH = 24;
    const colW = (bounds.w - gap * (columns - 1)) / columns;
    rows.forEach(([label, value], index) => {
      const col = index % columns;
      const line = Math.floor(index / columns);
      const x = bounds.x + col * (colW + gap);
      const y = bounds.y + line * (rowH + 5);
      if (y + rowH > bounds.y + bounds.h) return;
      ctx.fillStyle = 'rgba(217,230,210,0.08)';
      ctx.fillRect(x, y, colW, rowH);
      ctx.fillStyle = UI_SUITE.colors.muted;
      ctx.font = `700 9px ${UI_SUITE.font.family}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 6, y + rowH / 2, colW * 0.5);
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.textAlign = 'right';
      ctx.fillText(value, x + colW - 8, y + rowH / 2, colW * 0.45);
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
    const quickActions = this.racePortraitMode === 'ground'
      ? this.getRacePortraitGroundActions()
      : this.racePortraitMode === 'sprites'
        ? this.getRacePortraitSpriteActions()
        : [
          ...this.getRacePortraitHotMenuActions(selected)
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
    if (this.racePortraitMode === 'ground' && this.racePortraitHotMenu) {
      this.drawRacePortraitGroundPopup(ctx, bounds);
    }
    if (this.racePortraitMode === 'sprites' && this.racePortraitHotMenu) {
      this.drawRacePortraitSpritePopup(ctx, bounds);
    }
    if (this.racePortraitMode === 'race' && this.racePortraitHotMenu) {
      this.drawRacePortraitTrackPopup(ctx, bounds);
    }
  }

  drawRacePortraitSpritePopup(ctx, anchorBounds) {
    if (this.racePortraitHotMenu === 'sprite-brush') {
      this.drawRacePortraitGroundBrushPanel(ctx, anchorBounds);
      return;
    }
    if (this.racePortraitHotMenu !== 'sprite-select') return;
    const definitions = this.ensureRaceSceneryDefinitions();
    const actions = [
      { id: 'sprite-menu-back', label: 'Back', onClick: () => { this.racePortraitHotMenu = null; } },
      ...(definitions.length
        ? definitions.map((definition, index) => ({
          id: `sprite-def-${definition.id}`,
          label: String(definition.label || `Sprite ${index + 1}`).slice(0, 16),
          active: index === this.selectedSceneryDefinitionIndex,
          onClick: () => {
            this.selectedSceneryDefinitionIndex = index;
            this.raceSpritePaintKind = 'sprite';
            this.racePortraitHotMenu = null;
            this.activeAction = 'paint-sprite';
            this.status = `Paint ${definition.label || `Sprite ${index + 1}`}`;
          }
        }))
        : [{ id: 'sprite-none', label: 'Add in Settings', disabled: true, onClick: null }])
    ];
    const rowH = 30;
    const gap = 5;
    const pad = 8;
    const maxRows = Math.min(actions.length, 12);
    const popupH = pad * 2 + maxRows * rowH + Math.max(0, maxRows - 1) * gap;
    const bounds = {
      x: anchorBounds.x + 8,
      y: Math.max(8, anchorBounds.y - popupH - 8),
      w: Math.min(anchorBounds.w - 16, 230),
      h: popupH
    };
    drawSharedPanel(ctx, bounds, { fill: 'rgba(5,8,7,0.94)', border: UI_SUITE.colors.border });
    actions.slice(0, maxRows).forEach((action, index) => {
      this.registerDrawnButton(ctx, {
        x: bounds.x + pad,
        y: bounds.y + pad + index * (rowH + gap),
        w: bounds.w - pad * 2,
        h: rowH
      }, action);
    });
  }

  drawRacePortraitGroundPopup(ctx, anchorBounds) {
    if (this.racePortraitHotMenu === 'ground-brush') {
      this.drawRacePortraitGroundBrushPanel(ctx, anchorBounds);
      return;
    }
    const actions = this.getRacePortraitGroundPopupActions();
    if (!actions.length) return;
    const rowH = 30;
    const gap = 5;
    const pad = 8;
    const maxRows = Math.min(actions.length, 15);
    const popupH = pad * 2 + maxRows * rowH + Math.max(0, maxRows - 1) * gap;
    const bounds = {
      x: anchorBounds.x + 8,
      y: Math.max(8, anchorBounds.y - popupH - 8),
      w: Math.min(anchorBounds.w - 16, 230),
      h: popupH
    };
    drawSharedPanel(ctx, bounds, { fill: 'rgba(5,8,7,0.94)', border: UI_SUITE.colors.border });
    actions.slice(0, maxRows).forEach((action, index) => {
      this.registerDrawnButton(ctx, {
        x: bounds.x + pad,
        y: bounds.y + pad + index * (rowH + gap),
        w: bounds.w - pad * 2,
        h: rowH
      }, action);
    });
  }

  drawRacePortraitGroundBrushPanel(ctx, anchorBounds) {
    const pad = 9;
    const bounds = {
      x: anchorBounds.x + 8,
      y: Math.max(8, anchorBounds.y - 254),
      w: Math.min(anchorBounds.w - 16, 268),
      h: 246
    };
    this.raceGroundBrushSliderRegions = [];
    drawSharedPanel(ctx, bounds, { fill: 'rgba(5,8,7,0.94)', border: UI_SUITE.colors.border });
    this.registerDrawnButton(ctx, {
      x: bounds.x + pad,
      y: bounds.y + pad,
      w: 62,
      h: 28
    }, { id: 'ground-menu-back', label: 'Back', onClick: () => { this.racePortraitHotMenu = null; } });
    this.drawRaceGroundBrushShapePicker(ctx, {
      x: bounds.x + pad,
      y: bounds.y + 46,
      w: bounds.w - pad * 2,
      h: 58
    });
    const rows = [
      { id: 'size', label: 'Size', value: Number(this.raceGroundBrushCells) || 1, min: 1, max: 31, format: (value) => `${Math.round(value)}x${Math.round(value)}` },
      { id: 'opacity', label: 'Opacity', value: clamp(Number(this.raceGroundBrushStrength) || 1, 0.05, 1), min: 0.05, max: 1, format: (value) => `${Math.round(value * 100)}%` },
      { id: 'hardness', label: 'Hardness', value: clamp(Number(this.raceGroundBrushHardness ?? 1), 0, 1), min: 0, max: 1, format: (value) => `${Math.round(value * 100)}%` }
    ];
    rows.forEach((row, index) => {
      this.drawRaceGroundBrushSlider(ctx, {
        x: bounds.x + pad,
        y: bounds.y + 112 + index * 40,
        w: bounds.w - pad * 2,
        h: 36
      }, row);
    });
  }

  drawRaceGroundBrushShapePicker(ctx, bounds) {
    const gap = 8;
    const shapeW = Math.floor((bounds.w - gap) / 2);
    [
      { id: 'square', label: 'Rectangle' },
      { id: 'round', label: 'Oval' }
    ].forEach((shape, index) => {
      const shapeBounds = {
        x: bounds.x + index * (shapeW + gap),
        y: bounds.y,
        w: shapeW,
        h: bounds.h
      };
      this.drawRaceGroundBrushPreview(ctx, shapeBounds, shape.id);
      this.registerDrawnButton(ctx, shapeBounds, {
        id: `ground-brush-shape-${shape.id}`,
        label: shape.label,
        active: this.raceGroundBrushShape === shape.id,
        onClick: () => this.setRaceGroundBrushShape(shape.id)
      });
    });
  }

  drawRaceGroundBrushPreview(ctx, bounds, shapeOverride = this.raceGroundBrushShape) {
    const size = Math.min(bounds.w, bounds.h) - 6;
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2 + 3;
    ctx.save();
    ctx.fillStyle = this.raceGroundBrushShape === shapeOverride ? 'rgba(246,220,132,0.12)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = this.raceGroundBrushShape === shapeOverride ? UI_SUITE.colors.accent : 'rgba(217,230,210,0.22)';
    ctx.strokeRect(bounds.x + 0.5, bounds.y + 0.5, bounds.w - 1, bounds.h - 1);
    const previousShape = this.raceGroundBrushShape;
    this.raceGroundBrushShape = shapeOverride;
    const offsets = this.getRaceTileMapBrushOffsets();
    this.raceGroundBrushShape = previousShape;
    const half = Math.max(0, Math.floor((Number(this.raceGroundBrushCells) || 1) / 2));
    const cell = Math.min(10, size / Math.max(1, half * 2 + 1));
    offsets.forEach((offset) => {
      const alpha = clamp(0.18 + Number(offset.weight || 0) * 0.72, 0.08, 0.9);
      ctx.fillStyle = `rgba(246, 220, 132, ${alpha})`;
      const x = cx + offset.x * cell - cell / 2;
      const y = cy + offset.y * cell - cell / 2;
      if (shapeOverride === 'round') {
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.42, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x + 1, y + 1, Math.max(1, cell - 2), Math.max(1, cell - 2));
      }
    });
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 10px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(shapeOverride === 'round' ? 'Oval' : 'Rect', bounds.x + bounds.w / 2, bounds.y + 4, bounds.w - 8);
    ctx.restore();
  }

  drawRaceGroundBrushSlider(ctx, bounds, row) {
    const value = clamp(Number(row.value) || row.min, row.min, row.max);
    const ratio = clamp((value - row.min) / Math.max(0.0001, row.max - row.min), 0, 1);
    const track = { x: bounds.x + 84, y: bounds.y + 23, w: bounds.w - 96, h: 6 };
    const sliderId = `ground-brush-${row.id}-slider`;
    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 11px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.label, bounds.x, bounds.y + 14, 76);
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.textAlign = 'right';
    ctx.fillText(row.format(value), bounds.x + bounds.w, bounds.y + 14, 68);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(track.x, track.y, track.w, track.h);
    ctx.fillStyle = UI_SUITE.colors.accent;
    ctx.fillRect(track.x, track.y, Math.max(2, track.w * ratio), track.h);
    ctx.beginPath();
    ctx.arc(track.x + track.w * ratio, track.y + track.h / 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.fill();
    ctx.restore();
    this.raceGroundBrushSliderRegions.push({
      id: sliderId,
      key: row.id,
      min: row.min,
      max: row.max,
      bounds: { x: track.x - 12, y: bounds.y, w: track.w + 24, h: bounds.h },
      track
    });
  }

  drawRaceSpriteSettingsDialog(ctx, width = 0, height = 0) {
    if (!this.raceSpriteSettingsDialogOpen) return;
    const definition = this.getRaceSpriteSettingsDialogDefinition();
    if (!definition) {
      this.closeRaceSpriteSettingsDialog({ accept: false });
      return;
    }
    this.raceSpriteSettingsSliderRegions = [];
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.54)';
    ctx.fillRect(0, 0, width, height);
    const panel = {
      x: Math.max(12, Math.floor((width - Math.min(340, width - 24)) / 2)),
      y: Math.max(18, Math.floor((height - 312) / 2)),
      w: Math.min(340, width - 24),
      h: 312
    };
    drawSharedPanel(ctx, panel, { fill: 'rgba(5,8,7,0.97)', border: UI_SUITE.colors.border });
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 15px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Sprite Settings', panel.x + 14, panel.y + 24, panel.w - 28);
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `11px ${UI_SUITE.font.family}`;
    ctx.fillText(String(definition.label || 'Sprite'), panel.x + 14, panel.y + 44, panel.w - 28);
    this.drawRaceSpriteSettingsSlider(ctx, {
      x: panel.x + 14,
      y: panel.y + 66,
      w: panel.w - 28,
      h: 46
    }, {
      id: 'width',
      label: 'Width',
      min: 0.4,
      max: 12,
      value: Number(definition.widthM) || 2,
      format: (value) => `${value.toFixed(1)}m`
    });
    this.drawRaceSpriteSettingsSlider(ctx, {
      x: panel.x + 14,
      y: panel.y + 116,
      w: panel.w - 28,
      h: 46
    }, {
      id: 'height',
      label: 'Height',
      min: 0.4,
      max: 18,
      value: Number(definition.heightM) || 3,
      format: (value) => `${value.toFixed(1)}m`
    });
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `700 11px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.fillText('Collision', panel.x + 14, panel.y + 184, panel.w - 28);
    const collision = [
      { id: 'indestructible', label: 'Solid' },
      { id: 'flatten', label: 'Flatten' },
      { id: 'fly-off', label: 'Fly Off' }
    ];
    const gap = 7;
    const buttonW = Math.floor((panel.w - 28 - gap * 2) / 3);
    collision.forEach((entry, index) => {
      this.registerDrawnButton(ctx, {
        x: panel.x + 14 + index * (buttonW + gap),
        y: panel.y + 196,
        w: buttonW,
        h: 34
      }, {
        id: `sprite-collision-${entry.id}`,
        label: entry.label,
        active: definition.behavior === entry.id,
        onClick: () => {
          definition.behavior = entry.id;
          this.status = `Sprite collision: ${entry.label}`;
        }
      });
    });
    this.registerDrawnButton(ctx, {
      x: panel.x + 14,
      y: panel.y + panel.h - 48,
      w: Math.floor((panel.w - 35) / 2),
      h: 34
    }, {
      id: 'sprite-settings-cancel',
      label: 'Cancel',
      onClick: () => this.closeRaceSpriteSettingsDialog({ accept: false })
    });
    this.registerDrawnButton(ctx, {
      x: panel.x + panel.w - 14 - Math.floor((panel.w - 35) / 2),
      y: panel.y + panel.h - 48,
      w: Math.floor((panel.w - 35) / 2),
      h: 34
    }, {
      id: 'sprite-settings-ok',
      label: 'OK',
      active: true,
      onClick: () => this.closeRaceSpriteSettingsDialog({ accept: true })
    });
    ctx.restore();
  }

  drawRaceSpriteSettingsSlider(ctx, bounds, row) {
    const value = clamp(Number(row.value) || row.min, row.min, row.max);
    const ratio = clamp((value - row.min) / Math.max(0.0001, row.max - row.min), 0, 1);
    const track = { x: bounds.x + 82, y: bounds.y + 27, w: bounds.w - 94, h: 6 };
    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 11px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.label, bounds.x, bounds.y + 16, 72);
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.textAlign = 'right';
    ctx.fillText(row.format(value), bounds.x + bounds.w, bounds.y + 16, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(track.x, track.y, track.w, track.h);
    ctx.fillStyle = UI_SUITE.colors.accent;
    ctx.fillRect(track.x, track.y, Math.max(2, track.w * ratio), track.h);
    ctx.beginPath();
    ctx.arc(track.x + track.w * ratio, track.y + track.h / 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.fill();
    ctx.restore();
    this.raceSpriteSettingsSliderRegions.push({
      id: `sprite-settings-${row.id}-slider`,
      key: row.id,
      min: row.min,
      max: row.max,
      bounds: { x: track.x - 12, y: bounds.y, w: track.w + 24, h: bounds.h },
      track
    });
  }

  drawRaceSettingsDialog(ctx, width = 0, height = 0) {
    if (!this.raceSettingsDialog) return;
    const draft = this.raceSettingsDialogDraft || {};
    this.raceSettingsSliderRegions = [];
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.54)';
    ctx.fillRect(0, 0, width, height);
    const targetPanelHeight = this.raceSettingsDialog === 'margin'
      ? 500
      : this.raceSettingsDialog === 'texture-scale'
      ? 690
      : 330;
    const panelHeight = Math.max(220, Math.min(targetPanelHeight, Math.max(1, Number(height || targetPanelHeight) - 36)));
    const panel = {
      x: Math.max(12, Math.floor((width - Math.min(360, width - 24)) / 2)),
      y: Math.max(18, Math.floor((height - panelHeight) / 2)),
      w: Math.min(360, width - 24),
      h: panelHeight
    };
    drawSharedPanel(ctx, panel, { fill: 'rgba(5,8,7,0.97)', border: UI_SUITE.colors.border });
    const title = this.raceSettingsDialog === 'ai'
      ? 'AI Racers'
      : this.raceSettingsDialog === 'weather'
        ? 'Weather'
        : this.raceSettingsDialog === 'sun'
          ? 'Sun'
          : this.raceSettingsDialog === 'margin'
            ? 'Margin'
            : this.raceSettingsDialog === 'texture-scale'
              ? 'Texture Scale'
              : 'Terrain Tiles';
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 15px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, panel.x + 14, panel.y + 24, panel.w - 28);

    if (this.raceSettingsDialog === 'ai') {
      this.drawRaceSettingsSlider(ctx, {
        x: panel.x + 14,
        y: panel.y + 72,
        w: panel.w - 28,
        h: 54
      }, {
        id: 'ai-count',
        label: 'Racers',
        min: 0,
        max: 11,
        step: 1,
        value: Number(draft.aiCount) || 0,
        format: (value) => `${Math.round(value)}`
      });
    } else if (this.raceSettingsDialog === 'sun') {
      ctx.fillStyle = UI_SUITE.colors.muted;
      ctx.font = `11px ${UI_SUITE.font.family}`;
      ctx.fillText('Set the visible sun direction and brightness.', panel.x + 14, panel.y + 50, panel.w - 28);
      this.drawRaceSettingsSlider(ctx, {
        x: panel.x + 14,
        y: panel.y + 82,
        w: panel.w - 28,
        h: 54
      }, {
        id: 'sun-angle',
        label: 'Angle',
        min: 0,
        max: 360,
        step: 1,
        value: Number(draft.angleDeg ?? 315),
        format: (value) => `${Math.round(value)}deg`
      });
      this.drawRaceSettingsSlider(ctx, {
        x: panel.x + 14,
        y: panel.y + 148,
        w: panel.w - 28,
        h: 54
      }, {
        id: 'sun-intensity',
        label: 'Intensity',
        min: 0,
        max: 1,
        step: 0.05,
        value: Number(draft.intensity ?? 0.72),
        format: (value) => `${Math.round(value * 100)}%`
      });
    } else if (this.raceSettingsDialog === 'weather') {
      const weatherChoices = RACE_WEATHER_PRESETS;
      const gap = 8;
      const buttonW = Math.floor((panel.w - 28 - gap) / 2);
      weatherChoices.forEach((entry, index) => {
        this.registerDrawnButton(ctx, {
          x: panel.x + 14 + (index % 2) * (buttonW + gap),
          y: panel.y + 58 + Math.floor(index / 2) * 42,
          w: buttonW,
          h: 34
        }, {
          id: `weather-dialog-${entry.id}`,
          label: entry.label,
          active: draft.weather === entry.id,
          onClick: () => {
            draft.weather = entry.id;
            if (entry.id === 'clear') draft.intensity = 0;
            else if (!Number(draft.intensity)) draft.intensity = 0.75;
          }
        });
      });
      this.drawRaceSettingsSlider(ctx, {
        x: panel.x + 14,
        y: panel.y + 158,
        w: panel.w - 28,
        h: 54
      }, {
        id: 'weather-intensity',
        label: 'Intensity',
        min: 0,
        max: 1,
        step: 0.05,
        value: draft.weather === 'clear' ? 0 : Number(draft.intensity) || 0.75,
        disabled: draft.weather === 'clear',
        format: (value) => `${Math.round(value * 100)}%`
      });
    } else if (this.raceSettingsDialog === 'tiles') {
      ctx.fillStyle = UI_SUITE.colors.muted;
      ctx.font = `11px ${UI_SUITE.font.family}`;
      ctx.fillText('Choose a surface slot, then OK to pick project art.', panel.x + 14, panel.y + 48, panel.w - 28);
      const gap = 7;
      const cols = 2;
      const buttonW = Math.floor((panel.w - 28 - gap) / cols);
      RACE_SURFACE_ART_SLOTS.forEach((entry, index) => {
        this.registerDrawnButton(ctx, {
          x: panel.x + 14 + (index % cols) * (buttonW + gap),
          y: panel.y + 68 + Math.floor(index / cols) * 38,
          w: buttonW,
          h: 31
        }, {
          id: `tiles-dialog-${entry.id}`,
          label: entry.label,
          active: draft.slotId === entry.id,
          onClick: () => {
            draft.slotId = entry.id;
          }
        });
      });
      const slot = RACE_SURFACE_ART_SLOT_BY_ID[draft.slotId] || RACE_SURFACE_ART_SLOTS[0];
      const artRef = this.ensureRaceSurfaceArt()[slot.id] || '';
      ctx.fillStyle = UI_SUITE.colors.muted;
      ctx.font = `11px ${UI_SUITE.font.family}`;
      ctx.fillText(artRef ? `Current: ${artRef}` : 'No override selected', panel.x + 14, panel.y + panel.h - 88, panel.w - 28);
    } else if (this.raceSettingsDialog === 'tire-fx') {
      const gap = 7;
      const cols = 3;
      const buttonW = Math.floor((panel.w - 28 - gap * (cols - 1)) / cols);
      RACE_TIRE_FX_SLOTS.forEach((entry, index) => {
        this.registerDrawnButton(ctx, {
          x: panel.x + 14 + (index % cols) * (buttonW + gap),
          y: panel.y + 52 + Math.floor(index / cols) * 36,
          w: buttonW,
          h: 30
        }, {
          id: `tire-fx-dialog-${entry.id}`,
          label: entry.label,
          active: draft.slotId === entry.id,
          onClick: () => {
            const settings = this.getRaceTireFxSlotSettings(entry.id);
            draft.slotId = entry.id;
            draft.enabled = settings.enabled !== false;
            draft.artRef = String(settings.artRef || '');
            draft.color = String(settings.color || entry.color);
            draft.density = clamp(Number(settings.density ?? 1), 0, 3);
            draft.lifetimeMs = clamp(Number(settings.lifetimeMs ?? 620), 120, 1800);
            draft.scale = clamp(Number(settings.scale ?? 1), 0.25, 4);
          }
        });
      });
      const selectedSlot = RACE_TIRE_FX_SLOT_BY_ID[draft.slotId] || RACE_TIRE_FX_SLOTS[0];
      let tireFxY = panel.y + 168;
      this.registerDrawnButton(ctx, {
        x: panel.x + 14,
        y: tireFxY,
        w: Math.floor((panel.w - 35) / 2),
        h: 30
      }, {
        id: 'tire-fx-dialog-enabled',
        label: `Enabled: ${draft.enabled === false ? 'Off' : 'On'}`,
        active: draft.enabled !== false,
        onClick: () => {
          draft.enabled = draft.enabled === false;
        }
      });
      this.registerDrawnButton(ctx, {
        x: panel.x + 21 + Math.floor((panel.w - 35) / 2),
        y: tireFxY,
        w: Math.floor((panel.w - 35) / 2),
        h: 30
      }, {
        id: 'tire-fx-dialog-art',
        label: draft.artRef ? `Art: ${draft.artRef}` : 'Pick Art',
        active: Boolean(draft.artRef),
        onClick: () => {
          this.openRaceTireFxArtPicker(selectedSlot.id).catch((error) => {
            if (typeof console !== 'undefined') console.warn('Race tire FX art picker failed', error);
            this.status = 'Tire FX picker failed';
          });
        }
      });
      tireFxY += 40;
      this.drawRaceSettingsSlider(ctx, {
        x: panel.x + 14,
        y: tireFxY,
        w: panel.w - 28,
        h: 48
      }, {
        id: 'tire-fx-density',
        label: 'Density',
        min: 0,
        max: 3,
        step: 0.05,
        value: Number(draft.density ?? 1),
        format: (value) => `${Math.round(value * 100)}%`
      });
      tireFxY += 50;
      this.drawRaceSettingsSlider(ctx, {
        x: panel.x + 14,
        y: tireFxY,
        w: panel.w - 28,
        h: 48
      }, {
        id: 'tire-fx-lifetime',
        label: 'Life',
        min: 120,
        max: 1800,
        step: 20,
        value: Number(draft.lifetimeMs ?? 620),
        format: (value) => `${Math.round(value)}ms`
      });
      tireFxY += 50;
      this.drawRaceSettingsSlider(ctx, {
        x: panel.x + 14,
        y: tireFxY,
        w: panel.w - 28,
        h: 48
      }, {
        id: 'tire-fx-scale',
        label: 'Scale',
        min: 0.25,
        max: 4,
        step: 0.05,
        value: Number(draft.scale ?? 1),
        format: (value) => `${Math.round(value * 100)}%`
      });
    } else if (this.raceSettingsDialog === 'texture-scale') {
      const isWebGLRenderer = draft.groundRenderer === 'webgl' || draft.groundRenderer === 'webgl-track';
      const rendererLabels = {
        software: 'Renderer: Software',
        webgl: 'Renderer: WebGL Ground',
        'webgl-track': 'Renderer: WebGL Track'
      };
      this.registerDrawnButton(ctx, {
        x: panel.x + 14,
        y: panel.y + 50,
        w: panel.w - 28,
        h: 30
      }, {
        id: 'texture-renderer-webgl',
        label: rendererLabels[draft.groundRenderer] || rendererLabels.software,
        active: isWebGLRenderer,
        onClick: () => {
          draft.groundRenderer = draft.groundRenderer === 'software'
            ? 'webgl'
            : draft.groundRenderer === 'webgl'
              ? 'webgl-track'
              : 'software';
        }
      });
      this.drawRaceSettingsSlider(ctx, {
        x: panel.x + 14,
        y: panel.y + 96,
        w: panel.w - 28,
        h: 54
      }, {
        id: 'texture-scale',
        label: '1px',
        min: RACE_GROUND_TEXTURE_PIXEL_SCALE_MIN_M,
        max: RACE_GROUND_TEXTURE_PIXEL_SCALE_MAX_M,
        step: 0.001,
        scale: 'log',
        value: Number(draft.pixelWorldM) || (RACE_GROUND_TEXTURE_BASE_WORLD_M / RACE_GROUND_TEXTURE_BASE_PX),
        format: (value) => `${Math.round(value * 10000) / 10000}m`
      });
      const pixelValue = clamp(
        Number(draft.pixelWorldM) || (RACE_GROUND_TEXTURE_BASE_WORLD_M / RACE_GROUND_TEXTURE_BASE_PX),
        RACE_GROUND_TEXTURE_PIXEL_SCALE_MIN_M,
        RACE_GROUND_TEXTURE_PIXEL_SCALE_MAX_M
      );
      const chunkValue = pixelValue * RACE_GROUND_TEXTURE_BASE_PX;
      ctx.fillStyle = UI_SUITE.colors.muted;
      ctx.font = `11px ${UI_SUITE.font.family}`;
      ctx.fillText(`32px = ${Math.round(chunkValue * 100) / 100}m`, panel.x + 14, panel.y + 178, panel.w - 28);
      let nextY = panel.y + 202;
      if (draft.groundRenderer === 'webgl-track') {
        this.drawRaceSettingsSlider(ctx, {
          x: panel.x + 14,
          y: nextY,
          w: panel.w - 28,
          h: 54
        }, {
          id: 'near-texture-quality',
          label: 'Near Quality',
          min: RACE_GROUND_NEAR_TEXTURE_QUALITY_MIN,
          max: RACE_GROUND_NEAR_TEXTURE_QUALITY_MAX,
          step: 0.1,
          value: Number(draft.nearTextureQuality ?? RACE_GROUND_NEAR_TEXTURE_QUALITY_DEFAULT),
          format: (value) => `${Math.round(value * 10) / 10}x`
        });
        nextY += 56;
        this.registerDrawnButton(ctx, {
          x: panel.x + 14,
          y: nextY,
          w: panel.w - 28,
          h: 30
        }, {
          id: 'texture-filter-mode',
          label: `Filter: ${this.getRaceGroundTextureFilterLabel(draft.textureFilterMode)}`,
          active: true,
          onClick: () => {
            const currentIndex = Math.max(0, RACE_GROUND_TEXTURE_FILTER_MODES.findIndex((entry) => entry.id === draft.textureFilterMode));
            draft.textureFilterMode = RACE_GROUND_TEXTURE_FILTER_MODES[(currentIndex + 1) % RACE_GROUND_TEXTURE_FILTER_MODES.length].id;
          }
        });
        nextY += 42;
      }
      if (!isWebGLRenderer) {
        this.drawRaceSettingsSlider(ctx, {
          x: panel.x + 14,
          y: nextY,
          w: panel.w - 28,
          h: 54
        }, {
          id: 'mip-start',
          label: 'Start',
          min: RACE_GROUND_MIP_START_MIN,
          max: RACE_GROUND_MIP_START_MAX,
          step: 0.0005,
          scale: 'log',
          value: Number(draft.mipStart) || RACE_GROUND_MIP_START_DEFAULT,
          format: (value) => `${Math.round(value * 10000) / 10000}`
        });
        nextY += 56;
        this.drawRaceSettingsSlider(ctx, {
          x: panel.x + 14,
          y: nextY,
          w: panel.w - 28,
          h: 54
        }, {
          id: 'mip-strength',
          label: 'Amount',
          min: RACE_GROUND_MIP_STRENGTH_MIN,
          max: RACE_GROUND_MIP_STRENGTH_MAX,
          step: 0.05,
          value: Number(draft.mipStrength ?? RACE_GROUND_MIP_STRENGTH_DEFAULT),
          format: (value) => `${Math.round(value * 100)}%`
        });
        nextY += 56;
      }
      this.drawRaceSettingsSlider(ctx, {
        x: panel.x + 14,
        y: nextY,
        w: panel.w - 28,
        h: 54
      }, {
        id: 'scanline-resolution',
        label: isWebGLRenderer ? 'Resolution' : 'Render',
        min: RACE_GROUND_SCANLINE_RESOLUTION_MIN,
        max: RACE_GROUND_SCANLINE_RESOLUTION_MAX,
        step: 0.05,
        value: Number(draft.scanlineResolution ?? RACE_GROUND_SCANLINE_RESOLUTION_DEFAULT),
        format: (value) => `${Math.round(value)}%`
      });
      nextY += 56;
      if (!isWebGLRenderer) {
        this.drawRaceSettingsSlider(ctx, {
          x: panel.x + 14,
          y: nextY,
          w: panel.w - 28,
          h: 54
        }, {
          id: 'scanline-row-step',
          label: 'Rows',
          min: RACE_GROUND_SCANLINE_ROW_STEP_MIN,
          max: RACE_GROUND_SCANLINE_ROW_STEP_MAX,
          step: 1,
          value: Number(draft.scanlineRowStep ?? RACE_GROUND_SCANLINE_ROW_STEP_DEFAULT),
          format: (value) => `${Math.round(value * 100) / 100}x`
        });
        nextY += 40;
      }
      const toggleGap = 6;
      const toggleW = Math.floor((panel.w - 28 - toggleGap * 3) / 4);
      [
        { id: 'texture-debug-track', label: 'Track', key: 'trackEnabled' },
        { id: 'texture-debug-overlays', label: 'Overlays', key: 'overlaysEnabled' },
        { id: 'texture-debug-lighting', label: 'Lighting', key: 'lightingEnabled' },
        { id: 'texture-debug-terrain', label: 'Terrain', key: 'terrainEnabled' },
        { id: 'texture-debug-textures', label: 'Textures', key: 'texturesEnabled' },
        { id: 'texture-debug-detail', label: 'Detail', key: 'detailEnabled' }
      ].forEach((entry, index) => {
        const cols = 3;
        const row = Math.floor(index / cols);
        const col = index % cols;
        const localToggleW = Math.floor((panel.w - 28 - toggleGap * (cols - 1)) / cols);
        this.registerDrawnButton(ctx, {
          x: panel.x + 14 + col * (localToggleW + toggleGap),
          y: nextY + row * 34,
          w: localToggleW,
          h: 30
        }, {
          id: entry.id,
          label: `${entry.label}: ${draft[entry.key] === false ? 'Off' : 'On'}`,
          active: draft[entry.key] !== false,
          onClick: () => {
            draft[entry.key] = draft[entry.key] === false;
          }
        });
      });
      nextY += 76;
      if (draft.groundRenderer === 'webgl-track') {
        const trackToggles = [
          { id: 'texture-debug-culling', label: 'Cull', key: 'terrainCullingEnabled' },
          { id: 'texture-debug-lod', label: 'LOD', key: 'terrainLodEnabled' },
          { id: 'texture-debug-budget', label: 'Budget', key: 'terrainBudgetEnabled' },
          { id: 'texture-debug-road-thin', label: 'Thin', key: 'farRoadDecimationEnabled' },
          { id: 'texture-debug-three', label: 'Three', key: 'threeEnabled' },
          { id: 'texture-debug-raw-terrain', label: 'Raw', key: 'rawTerrainPolygonsEnabled', defaultEnabled: false }
        ];
        const trackToggleW = Math.floor((panel.w - 28 - toggleGap * (trackToggles.length - 1)) / trackToggles.length);
        trackToggles.forEach((entry, index) => {
          const enabled = entry.defaultEnabled === false ? draft[entry.key] === true : draft[entry.key] !== false;
          this.registerDrawnButton(ctx, {
            x: panel.x + 14 + index * (trackToggleW + toggleGap),
            y: nextY,
            w: trackToggleW,
            h: 30
          }, {
            id: entry.id,
            label: `${entry.label}: ${enabled ? 'On' : 'Off'}`,
            active: enabled,
            onClick: () => {
              draft[entry.key] = !enabled;
            }
          });
        });
        nextY += 42;
        const previewToggles = [
          { id: 'texture-debug-editor-preview', label: 'Editor', key: 'editorSurfacePreviewEnabled', defaultEnabled: false },
          { id: 'texture-debug-editor-3d', label: '3D', key: 'editorSurfacePreview3dEnabled', defaultEnabled: false }
        ];
        previewToggles.forEach((entry, index) => {
          const enabled = draft[entry.key] === true;
          this.registerDrawnButton(ctx, {
            x: panel.x + 14 + index * 92,
            y: nextY,
            w: 86,
            h: 30
          }, {
            id: entry.id,
            label: `${entry.label}: ${enabled ? 'On' : 'Off'}`,
            active: enabled,
            onClick: () => {
              draft[entry.key] = !enabled;
            }
          });
        });
        const debugModes = [
          { id: 'bands', label: 'Bands' },
          { id: 'wireframe', label: 'Wire' },
          { id: 'material', label: 'Mat' },
          { id: 'raw-composed', label: 'Raw' },
          { id: 'seams', label: 'Seams' },
          { id: 'normals', label: 'Norm' },
          { id: 'labels', label: 'Labels' },
          { id: 'wheels', label: 'Wheels' }
        ];
        const modeW = Math.floor((panel.w - 28 - toggleGap * 3) / 4);
        debugModes.forEach((entry, index) => {
          const row = Math.floor(index / 4);
          const col = index % 4;
          const active = String(draft.editorSurfaceDebugMode || 'bands') === entry.id;
          this.registerDrawnButton(ctx, {
            x: panel.x + 14 + col * (modeW + toggleGap),
            y: nextY + 36 + row * 30,
            w: modeW,
            h: 26
          }, {
            id: `texture-debug-editor-mode-${entry.id}`,
            label: entry.label,
            active,
            onClick: () => {
              draft.editorSurfaceDebugMode = entry.id;
              draft.editorSurfacePreviewEnabled = true;
            }
          });
        });
        nextY += 102;
      }
      const footerTop = panel.y + panel.h - 58;
      const previewBottom = Math.max(nextY + 44, footerTop - 10);
      this.drawRaceTextureScalePreview(ctx, {
        x: panel.x + 14,
        y: nextY,
        w: panel.w - 28,
        h: Math.max(44, previewBottom - nextY)
      }, pixelValue, {
        start: Number(draft.mipStart) || RACE_GROUND_MIP_START_DEFAULT,
        strength: Number(draft.mipStrength ?? RACE_GROUND_MIP_STRENGTH_DEFAULT)
      }, {
        resolution: Number(draft.scanlineResolution ?? RACE_GROUND_SCANLINE_RESOLUTION_DEFAULT),
        rowStep: Number(draft.scanlineRowStep ?? RACE_GROUND_SCANLINE_ROW_STEP_DEFAULT)
      }, draft.groundRenderer, {
        trackEnabled: draft.trackEnabled !== false,
        overlaysEnabled: draft.overlaysEnabled !== false,
        lightingEnabled: draft.lightingEnabled !== false,
        terrainEnabled: draft.terrainEnabled === true,
        texturesEnabled: draft.texturesEnabled !== false,
        detailEnabled: draft.detailEnabled === true,
        terrainCullingEnabled: draft.terrainCullingEnabled !== false,
        terrainLodEnabled: draft.terrainLodEnabled !== false,
        terrainBudgetEnabled: draft.terrainBudgetEnabled !== false,
        farRoadDecimationEnabled: draft.farRoadDecimationEnabled !== false,
        threeEnabled: draft.threeEnabled !== false,
        rawTerrainPolygonsEnabled: draft.rawTerrainPolygonsEnabled === true,
        editorSurfacePreviewEnabled: draft.editorSurfacePreviewEnabled === true,
        editorSurfacePreview3dEnabled: draft.editorSurfacePreview3dEnabled === true,
        editorSurfaceDebugMode: String(draft.editorSurfaceDebugMode || 'bands'),
        nearTextureQuality: Number(draft.nearTextureQuality ?? RACE_GROUND_NEAR_TEXTURE_QUALITY_DEFAULT),
        textureFilterMode: draft.textureFilterMode || RACE_GROUND_TEXTURE_FILTER_DEFAULT
      });
    } else if (this.raceSettingsDialog === 'margin') {
      const toggleBounds = { x: panel.x + 14, y: panel.y + 58, w: panel.w - 28, h: 34 };
      const marginMode = RACE_EDGE_DISPLAY_MODES.find((entry) => entry.id === draft.marginMode) || RACE_EDGE_DISPLAY_MODES[0];
      this.registerDrawnButton(ctx, toggleBounds, {
        id: 'margin-dialog-enabled',
        label: `Use Margin: ${marginMode.label}`,
        active: draft.marginMode !== 'off',
        onClick: () => {
          const current = Math.max(0, RACE_EDGE_DISPLAY_MODES.findIndex((entry) => entry.id === draft.marginMode));
          draft.marginMode = RACE_EDGE_DISPLAY_MODES[(current + 1) % RACE_EDGE_DISPLAY_MODES.length].id;
          draft.enabled = draft.marginMode !== 'off';
        }
      });
      this.drawRaceSettingsSlider(ctx, {
        x: panel.x + 14,
        y: panel.y + 104,
        w: panel.w - 28,
        h: 54
      }, {
        id: 'margin-width',
        label: 'Width',
        min: 0.08,
        max: 0.65,
        step: 0.01,
        value: Number(draft.widthM) || 0.22,
        disabled: draft.marginMode === 'off',
        format: (value) => `${Math.round(value * 100)}cm`
      });
      this.drawRaceSettingsSlider(ctx, {
        x: panel.x + 14,
        y: panel.y + 158,
        w: panel.w - 28,
        h: 54
      }, {
        id: 'shoulder-width',
        label: 'Shoulder',
        min: 2,
        max: 50,
        step: 0.5,
        value: Number(draft.shoulderWidthM) || 12,
        disabled: draft.shoulderMode === 'off',
        format: (value) => `${Math.round(value * 10) / 10}m`
      });
      const shoulderMode = RACE_EDGE_DISPLAY_MODES.find((entry) => entry.id === draft.shoulderMode) || RACE_EDGE_DISPLAY_MODES[0];
      this.registerDrawnButton(ctx, {
        x: panel.x + 14,
        y: panel.y + 214,
        w: panel.w - 28,
        h: 30
      }, {
        id: 'margin-dialog-shoulder-enabled',
        label: `Use Shoulder: ${shoulderMode.label}`,
        active: draft.shoulderMode !== 'off',
        onClick: () => {
          const current = Math.max(0, RACE_EDGE_DISPLAY_MODES.findIndex((entry) => entry.id === draft.shoulderMode));
          draft.shoulderMode = RACE_EDGE_DISPLAY_MODES[(current + 1) % RACE_EDGE_DISPLAY_MODES.length].id;
          draft.shoulderEnabled = draft.shoulderMode !== 'off';
        }
      });
      const collisionLabel = RACE_EDGE_COLLISION_MODES.find((entry) => entry.id === draft.collisionEdge)?.label || 'No Collision';
      this.registerDrawnButton(ctx, {
        x: panel.x + 14,
        y: panel.y + 252,
        w: panel.w - 28,
        h: 30
      }, {
        id: 'margin-dialog-collision',
        label: `Collision Edge: ${collisionLabel}`,
        onClick: () => {
          const current = Math.max(0, RACE_EDGE_COLLISION_MODES.findIndex((entry) => entry.id === draft.collisionEdge));
          draft.collisionEdge = RACE_EDGE_COLLISION_MODES[(current + 1) % RACE_EDGE_COLLISION_MODES.length].id;
          draft.collisionMode = draft.collisionEdge;
        }
      });
      const effectLabel = RACE_EDGE_COLLISION_EFFECTS.find((entry) => entry.id === draft.collisionEffect)?.label || 'Collide';
      this.registerDrawnButton(ctx, {
        x: panel.x + 14,
        y: panel.y + 290,
        w: panel.w - 28,
        h: 30
      }, {
        id: 'margin-dialog-effect',
        label: `Effect: ${effectLabel}`,
        disabled: draft.collisionEdge === 'none',
        onClick: () => {
          const current = Math.max(0, RACE_EDGE_COLLISION_EFFECTS.findIndex((entry) => entry.id === draft.collisionEffect));
          draft.collisionEffect = RACE_EDGE_COLLISION_EFFECTS[(current + 1) % RACE_EDGE_COLLISION_EFFECTS.length].id;
        }
      });
      this.registerDrawnButton(ctx, {
        x: panel.x + 14,
        y: panel.y + 328,
        w: panel.w - 28,
        h: 34
      }, {
        id: 'margin-dialog-texture',
        label: 'Texture',
        disabled: draft.marginMode === 'off',
        onClick: () => {
          this.openRaceMarginArtPicker().catch((error) => {
            if (typeof console !== 'undefined') console.warn('Race margin texture picker failed', error);
            this.status = 'Margin texture picker failed';
          });
        }
      });
      ctx.fillStyle = UI_SUITE.colors.muted;
      ctx.font = `11px ${UI_SUITE.font.family}`;
      ctx.fillText(draft.artRef ? `Current: ${draft.artRef}` : 'Default white line', panel.x + 14, panel.y + panel.h - 88, panel.w - 28);
    }

    this.registerDrawnButton(ctx, {
      x: panel.x + 14,
      y: panel.y + panel.h - 48,
      w: Math.floor((panel.w - 35) / 2),
      h: 34
    }, {
      id: 'race-settings-cancel',
      label: 'Cancel',
      onClick: () => this.closeRaceSettingsDialog({ accept: false })
    });
    this.registerDrawnButton(ctx, {
      x: panel.x + panel.w - 14 - Math.floor((panel.w - 35) / 2),
      y: panel.y + panel.h - 48,
      w: Math.floor((panel.w - 35) / 2),
      h: 34
    }, {
      id: 'race-settings-ok',
      label: 'OK',
      active: true,
      onClick: () => this.closeRaceSettingsDialog({ accept: true })
    });
    ctx.restore();
  }

  drawRaceTextureScalePreview(ctx, bounds, pixelWorldM = this.getRaceGroundTexturePixelWorldM(), mipSettings = this.getRaceGroundMipSettings(), scanlineSettings = this.getRaceGroundScanlineSettings(), groundRenderer = this.getRaceGroundRenderer(), renderDebug = this.getRaceRenderDebugSettings()) {
    if (!ctx || !this.selectedRace) return;
    const previewStartMs = this.getNowMs();
    const savedSession = this.playtestSession;
    const savedScale = this.selectedRace.groundTextureBaseWorldM;
    const savedNearTextureQuality = this.selectedRace.groundNearTextureQuality;
    const savedNearTextureDetail = this.selectedRace.groundNearTextureDetail;
    const savedTextureFilterMode = this.selectedRace.groundTextureFilterMode;
    const savedMipSettings = this.selectedRace.groundMipSettings;
    const savedScanlineSettings = this.selectedRace.groundScanlineSettings;
    const savedGroundRenderer = this.selectedRace.groundRenderer;
    const savedRenderDebug = this.selectedRace.renderDebug;
    const runtimeType = this.getSelectedRaceRuntimeType();
    const routeLength = this.getRaceRouteLength();
    const startPose = this.getRaceStartPose(runtimeType);
    const startRoadProfile = this.getRaceRoadSurfaceProfileAtDistance(0, {
      runtimeType,
      routeLength,
      allowVisualExtension: true
    });
    const startBackDistance = Math.max(7.5, this.getRaceCarWorldWidth() * 4.2);
    const forwardX = Math.sin(Number(startPose.yaw || 0));
    const forwardZ = Math.cos(Number(startPose.yaw || 0));
    this.selectedRace.groundTextureBaseWorldM = clamp(
      Number(pixelWorldM || 0) * RACE_GROUND_TEXTURE_BASE_PX,
      RACE_GROUND_TEXTURE_SCALE_MIN_M,
      RACE_GROUND_TEXTURE_SCALE_MAX_M
    );
    this.selectedRace.groundNearTextureQuality = clamp(
      Number(renderDebug?.nearTextureQuality ?? RACE_GROUND_NEAR_TEXTURE_QUALITY_DEFAULT),
      RACE_GROUND_NEAR_TEXTURE_QUALITY_MIN,
      RACE_GROUND_NEAR_TEXTURE_QUALITY_MAX
    );
    delete this.selectedRace.groundNearTextureDetail;
    this.selectedRace.groundTextureFilterMode = RACE_GROUND_TEXTURE_FILTER_MODE_IDS.has(String(renderDebug?.textureFilterMode))
      ? String(renderDebug.textureFilterMode)
      : RACE_GROUND_TEXTURE_FILTER_DEFAULT;
    this.selectedRace.groundMipSettings = {
      start: clamp(Number(mipSettings?.start) || RACE_GROUND_MIP_START_DEFAULT, RACE_GROUND_MIP_START_MIN, RACE_GROUND_MIP_START_MAX),
      strength: clamp(Number(mipSettings?.strength ?? RACE_GROUND_MIP_STRENGTH_DEFAULT), RACE_GROUND_MIP_STRENGTH_MIN, RACE_GROUND_MIP_STRENGTH_MAX)
    };
    this.selectedRace.groundScanlineSettings = {
      resolution: clamp(Number(scanlineSettings?.resolution ?? RACE_GROUND_SCANLINE_RESOLUTION_DEFAULT), RACE_GROUND_SCANLINE_RESOLUTION_MIN, RACE_GROUND_SCANLINE_RESOLUTION_MAX),
      rowStep: clamp(Math.round(Number(scanlineSettings?.rowStep ?? RACE_GROUND_SCANLINE_ROW_STEP_DEFAULT) * 100) / 100, RACE_GROUND_SCANLINE_ROW_STEP_MIN, RACE_GROUND_SCANLINE_ROW_STEP_MAX)
    };
    this.selectedRace.groundRenderer = RACE_GROUND_RENDERER_IDS.has(String(groundRenderer)) ? String(groundRenderer) : RACE_GROUND_RENDERER_DEFAULT;
    this.selectedRace.renderDebug = {
      lightingEnabled: renderDebug?.lightingEnabled !== false,
      terrainEnabled: renderDebug?.terrainEnabled === true,
      texturesEnabled: renderDebug?.texturesEnabled !== false,
      detailEnabled: renderDebug?.detailEnabled === true,
      terrainCullingEnabled: renderDebug?.terrainCullingEnabled !== false,
      terrainLodEnabled: renderDebug?.terrainLodEnabled !== false,
      terrainBudgetEnabled: renderDebug?.terrainBudgetEnabled !== false,
      farRoadDecimationEnabled: renderDebug?.farRoadDecimationEnabled !== false,
      rawTerrainPolygonsEnabled: renderDebug?.rawTerrainPolygonsEnabled === true
    };
    this.playtestSession = {
      raceId: this.selectedRace.id,
      carId: this.selectedCar?.id || this.project?.selectedCarId || 'starter-rwd',
      elapsedMs: 0,
      distance: 0,
      projectedDistance: -startBackDistance,
      routeStartDistance: 0,
      startBackDistance,
      speedMps: 0,
      routeLength,
      routeRuntimeType: runtimeType,
      running: false,
      worldX: Number(startPose.x || 0) - forwardX * startBackDistance,
      worldZ: Number(startPose.z || 0) - forwardZ * startBackDistance,
      carYaw: Number(startPose.yaw || 0),
      cameraYaw: Number(startPose.yaw || 0),
      velocityYaw: Number(startPose.yaw || 0),
      cameraView: this.raceInput.cameraView,
      heading: 0,
      roadViewOffset: 0,
      trackViewOffset: 0,
      heightM: Number(startRoadProfile?.elevation || startPose.elevation || 0) * RACE_THREE_ELEVATION_M,
      aiRuntime: [],
      diagnostics: this.createRaceDiagnosticsState(null),
      damage: this.createRaceDamageState()
    };
    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.clip();
    ctx.fillStyle = '#050807';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    try {
      this.drawRaceProjectedRoadPath(ctx, bounds, { showPlaytestHud: false });
    } finally {
      this.playtestSession = savedSession;
      if (savedScale === undefined) delete this.selectedRace.groundTextureBaseWorldM;
      else this.selectedRace.groundTextureBaseWorldM = savedScale;
      if (savedNearTextureQuality === undefined) delete this.selectedRace.groundNearTextureQuality;
      else this.selectedRace.groundNearTextureQuality = savedNearTextureQuality;
      if (savedNearTextureDetail === undefined) delete this.selectedRace.groundNearTextureDetail;
      else this.selectedRace.groundNearTextureDetail = savedNearTextureDetail;
      if (savedTextureFilterMode === undefined) delete this.selectedRace.groundTextureFilterMode;
      else this.selectedRace.groundTextureFilterMode = savedTextureFilterMode;
      if (savedMipSettings === undefined) delete this.selectedRace.groundMipSettings;
      else this.selectedRace.groundMipSettings = savedMipSettings;
      if (savedScanlineSettings === undefined) delete this.selectedRace.groundScanlineSettings;
      else this.selectedRace.groundScanlineSettings = savedScanlineSettings;
      if (savedGroundRenderer === undefined) delete this.selectedRace.groundRenderer;
      else this.selectedRace.groundRenderer = savedGroundRenderer;
      if (savedRenderDebug === undefined) delete this.selectedRace.renderDebug;
      else this.selectedRace.renderDebug = savedRenderDebug;
      ctx.restore();
    }
    const previewElapsedMs = previewStartMs > 0 ? Math.max(0, this.getNowMs() - previewStartMs) : 0;
    if (previewElapsedMs > 0) {
      this.raceTexturePreviewRenderMs = this.raceTexturePreviewRenderMs > 0
        ? this.raceTexturePreviewRenderMs * 0.75 + previewElapsedMs * 0.25
        : previewElapsedMs;
      const instantFps = clamp(1000 / Math.max(1, previewElapsedMs), 1, 240);
      this.raceTexturePreviewFps = this.raceTexturePreviewFps > 0
        ? this.raceTexturePreviewFps * 0.75 + instantFps * 0.25
        : instantFps;
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(217,230,210,0.24)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 10px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Starting line preview', bounds.x + 8, bounds.y + 7, bounds.w - 16);
    const stats = this.lastRaceRenderStats || {};
    const previewFps = Math.round(Number(this.raceTexturePreviewFps || 0));
    const renderMs = Number(this.raceTexturePreviewRenderMs || stats.renderMs || 0);
    const polygons = Math.round(Number(stats.polygons || 0));
    const draws = Math.round(Number(stats.drawCalls || 0));
    const texturedDraws = Math.round(Number(stats.texturedDrawCalls || 0));
    const terrainCells = Math.round(Number(stats.terrainCells || 0));
    const terrainCandidates = Math.round(Number(stats.terrainCandidates || 0));
    const terrainSubdivisions = Math.round(Number(stats.terrainSubdivisions || 0));
    const textureUploads = Math.round(Number(stats.textureUploads || 0));
    const nearTextureQuality = Number(stats.nearTextureQuality || this.getRaceGroundNearTextureQuality());
    const textureFilterMode = stats.textureFilterMode || this.getRaceGroundTextureFilterMode();
    const textureFilterLabel = this.getRaceGroundTextureFilterLabel(textureFilterMode);
    const bakedGenerated = Math.round(Number(stats.bakedTerrainGenerated || 0));
    const bakedChunks = Math.round(Number(stats.bakedTerrainChunks || 0));
    const lodText = [
      Math.round(Number(stats.terrainLod0 || 0)),
      Math.round(Number(stats.terrainLod1 || 0)),
      Math.round(Number(stats.terrainLod2 || 0)),
      Math.round(Number(stats.terrainLod3 || 0))
    ].join('/');
    const terrainBuildMs = Number(stats.terrainBuildMs || 0);
    const meshBuildMs = Number(stats.meshBuildMs || 0);
    const webglMs = Number(stats.webglMs || 0);
    const textureUploadMs = Number(stats.textureUploadMs || 0);
    ctx.fillStyle = 'rgba(5,8,7,0.72)';
    ctx.fillRect(bounds.x + 6, bounds.y + 22, Math.min(bounds.w - 12, 282), 56);
    ctx.fillStyle = '#d9e6d2';
    ctx.font = `700 9px ${UI_SUITE.font.family}`;
    ctx.fillText(
      `Preview ${previewFps || '--'} FPS / R ${renderMs ? renderMs.toFixed(1) : '--'}ms / P ${polygons} / D ${draws} / T ${terrainCells}/${terrainCandidates}`,
      bounds.x + 10,
      bounds.y + 30,
      bounds.w - 20
    );
    ctx.fillText(
      `Sub ${terrainSubdivisions} / LOD ${lodText} / Bake +${bakedGenerated}/${bakedChunks}`,
      bounds.x + 10,
      bounds.y + 43,
      bounds.w - 20
    );
    ctx.fillText(
      `Quality ${nearTextureQuality.toFixed(1)}x ${textureFilterLabel} / Tex D ${texturedDraws} U ${textureUploads}${textureUploadMs ? ` ${textureUploadMs.toFixed(1)}ms` : ''} / TB ${terrainBuildMs.toFixed(1)} B ${meshBuildMs.toFixed(1)} G ${webglMs.toFixed(1)}`,
      bounds.x + 10,
      bounds.y + 56,
      bounds.w - 20
    );
    ctx.restore();
  }

  drawRaceSettingsSlider(ctx, bounds, row) {
    const value = clamp(Number(row.value) || 0, row.min, row.max);
    const ratio = row.scale === 'log'
      ? clamp(
        (Math.log(Math.max(row.min, value)) - Math.log(Math.max(0.000001, row.min)))
          / Math.max(0.0001, Math.log(Math.max(row.min, row.max)) - Math.log(Math.max(0.000001, row.min))),
        0,
        1
      )
      : clamp((value - row.min) / Math.max(0.0001, row.max - row.min), 0, 1);
    const track = { x: bounds.x + 92, y: bounds.y + 31, w: bounds.w - 104, h: 6 };
    ctx.save();
    ctx.globalAlpha = row.disabled ? 0.45 : 1;
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 11px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.label, bounds.x, bounds.y + 18, 82);
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.textAlign = 'right';
    ctx.fillText(row.format(value), bounds.x + bounds.w, bounds.y + 18, 72);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(track.x, track.y, track.w, track.h);
    ctx.fillStyle = UI_SUITE.colors.accent;
    ctx.fillRect(track.x, track.y, Math.max(2, track.w * ratio), track.h);
    ctx.beginPath();
    ctx.arc(track.x + track.w * ratio, track.y + track.h / 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.fill();
    ctx.restore();
    if (!row.disabled) {
      this.raceSettingsSliderRegions.push({
        id: `race-settings-${row.id}-slider`,
        key: row.id,
        min: row.min,
        max: row.max,
        step: row.step || 0,
        scale: row.scale || 'linear',
        bounds: { x: track.x - 12, y: bounds.y, w: track.w + 24, h: bounds.h },
        track
      });
    }
  }

  getRaceSettingsSliderHit(payload = {}) {
    return (this.raceSettingsSliderRegions || []).find((region) => (
      payload.x >= region.bounds.x
      && payload.x <= region.bounds.x + region.bounds.w
      && payload.y >= region.bounds.y
      && payload.y <= region.bounds.y + region.bounds.h
    )) || null;
  }

  updateRaceSettingsSlider(region = null, x = 0) {
    if (!region?.track || !this.raceSettingsDialogDraft) return false;
    const ratio = clamp((Number(x) - region.track.x) / Math.max(1, region.track.w), 0, 1);
    let value = region.scale === 'log'
      ? Math.exp(Math.log(Math.max(0.000001, region.min)) + ratio * (Math.log(Math.max(region.min, region.max)) - Math.log(Math.max(0.000001, region.min))))
      : region.min + (region.max - region.min) * ratio;
    if (region.step) value = Math.round(value / region.step) * region.step;
    if (region.key === 'ai-count') {
      this.raceSettingsDialogDraft.aiCount = clamp(Math.round(value), 0, 11);
      return true;
    }
    if (region.key === 'weather-intensity') {
      this.raceSettingsDialogDraft.intensity = clamp(value, 0, 1);
      return true;
    }
    if (region.key === 'sun-angle') {
      this.raceSettingsDialogDraft.angleDeg = clamp(value, 0, 360);
      return true;
    }
    if (region.key === 'sun-intensity') {
      this.raceSettingsDialogDraft.intensity = clamp(value, 0, 1);
      return true;
    }
    if (region.key === 'margin-width') {
      this.raceSettingsDialogDraft.widthM = clamp(value, 0.08, 0.65);
      return true;
    }
    if (region.key === 'shoulder-width') {
      this.raceSettingsDialogDraft.shoulderWidthM = clamp(value, 2, 50);
      return true;
    }
    if (region.key === 'tire-fx-density') {
      this.raceSettingsDialogDraft.density = clamp(value, 0, 3);
      return true;
    }
    if (region.key === 'tire-fx-lifetime') {
      this.raceSettingsDialogDraft.lifetimeMs = clamp(value, 120, 1800);
      return true;
    }
    if (region.key === 'tire-fx-scale') {
      this.raceSettingsDialogDraft.scale = clamp(value, 0.25, 4);
      return true;
    }
    if (region.key === 'texture-scale') {
      this.raceSettingsDialogDraft.pixelWorldM = clamp(value, RACE_GROUND_TEXTURE_PIXEL_SCALE_MIN_M, RACE_GROUND_TEXTURE_PIXEL_SCALE_MAX_M);
      return true;
    }
    if (region.key === 'near-texture-quality') {
      this.raceSettingsDialogDraft.nearTextureQuality = clamp(value, RACE_GROUND_NEAR_TEXTURE_QUALITY_MIN, RACE_GROUND_NEAR_TEXTURE_QUALITY_MAX);
      return true;
    }
    if (region.key === 'mip-start') {
      this.raceSettingsDialogDraft.mipStart = clamp(value, RACE_GROUND_MIP_START_MIN, RACE_GROUND_MIP_START_MAX);
      return true;
    }
    if (region.key === 'mip-strength') {
      this.raceSettingsDialogDraft.mipStrength = clamp(value, RACE_GROUND_MIP_STRENGTH_MIN, RACE_GROUND_MIP_STRENGTH_MAX);
      return true;
    }
    if (region.key === 'scanline-resolution') {
      this.raceSettingsDialogDraft.scanlineResolution = clamp(value, RACE_GROUND_SCANLINE_RESOLUTION_MIN, RACE_GROUND_SCANLINE_RESOLUTION_MAX);
      return true;
    }
    if (region.key === 'scanline-row-step') {
      this.raceSettingsDialogDraft.scanlineRowStep = clamp(Math.round(value * 100) / 100, RACE_GROUND_SCANLINE_ROW_STEP_MIN, RACE_GROUND_SCANLINE_ROW_STEP_MAX);
      return true;
    }
    return false;
  }

  getRaceSpriteSettingsSliderHit(payload = {}) {
    return (this.raceSpriteSettingsSliderRegions || []).find((region) => (
      payload.x >= region.bounds.x
      && payload.x <= region.bounds.x + region.bounds.w
      && payload.y >= region.bounds.y
      && payload.y <= region.bounds.y + region.bounds.h
    )) || null;
  }

  updateRaceSpriteSettingsSlider(region = null, x = 0) {
    const definition = this.getRaceSpriteSettingsDialogDefinition();
    if (!definition || !region?.track) return false;
    const ratio = clamp((Number(x) - region.track.x) / Math.max(1, region.track.w), 0, 1);
    const value = Math.round((region.min + (region.max - region.min) * ratio) * 10) / 10;
    if (region.key === 'width') {
      definition.widthM = value;
      this.status = `Sprite width: ${value.toFixed(1)}m`;
      return true;
    }
    if (region.key === 'height') {
      definition.heightM = value;
      this.status = `Sprite height: ${value.toFixed(1)}m`;
      return true;
    }
    return false;
  }

  getRaceGroundBrushSliderHit(payload = {}) {
    return (this.raceGroundBrushSliderRegions || []).find((region) => (
      payload.x >= region.bounds.x
      && payload.x <= region.bounds.x + region.bounds.w
      && payload.y >= region.bounds.y
      && payload.y <= region.bounds.y + region.bounds.h
    )) || null;
  }

  updateRaceGroundBrushSlider(region = null, x = 0) {
    if (!region?.track) return false;
    const ratio = clamp((Number(x) - region.track.x) / Math.max(1, region.track.w), 0, 1);
    const value = region.min + (region.max - region.min) * ratio;
    if (region.key === 'size') {
      const cells = Math.max(1, Math.round(value));
      this.raceGroundBrushCells = cells % 2 === 0 ? cells + 1 : cells;
      this.raceElevationBrushSize = clamp(this.raceGroundBrushCells / 70, 0.04, 0.44);
      this.status = `Ground brush: ${this.raceGroundBrushCells}x${this.raceGroundBrushCells}`;
      return true;
    }
    if (region.key === 'opacity') {
      this.raceGroundBrushStrength = Math.round(clamp(value, 0.05, 1) * 100) / 100;
      this.status = `Brush opacity: ${Math.round(this.raceGroundBrushStrength * 100)}%`;
      return true;
    }
    if (region.key === 'hardness') {
      this.raceGroundBrushHardness = Math.round(clamp(value, 0, 1) * 100) / 100;
      this.raceGroundBrushFalloff = this.raceGroundBrushHardness > 0.82 ? 'hard' : this.raceGroundBrushHardness > 0.32 ? 'soft' : 'airbrush';
      this.status = `Brush hardness: ${Math.round(this.raceGroundBrushHardness * 100)}%`;
      return true;
    }
    return false;
  }

  getRacePortraitGroundActions() {
    const selectedTile = this.getRaceGroundTileChoices().find((choice) => choice.id === this.getSelectedGroundTileId());
    const mode = this.getRaceGroundToolMode();
    const modeLabel = mode === 'sprite' ? 'Sprite' : mode === 'elevation' ? 'Elevation' : 'Ground';
    const paintLabel = mode === 'sprite'
      ? this.getRaceSpriteGroundPaintLabel()
      : mode === 'elevation'
        ? (this.raceElevationBrushDirection > 0 ? 'Raise' : 'Lower')
        : (selectedTile?.label?.replace(' Asphalt', '') || 'Grass');
    const intensityLabel = mode === 'sprite'
      ? (this.activeAction?.startsWith?.('erase-') ? 'Erase' : this.getRaceSpriteGroundPaintLabel())
      : mode === 'elevation'
        ? `${this.raceElevationBrushDirection > 0 ? '+' : '-'}${(Number(this.raceElevationBrushAmount) || RACE_TILE_MAP_ELEVATION_STEP).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`
        : `${Math.round((Number(this.raceGroundBrushStrength) || 0) * 100)}%`;
    return [
      { id: 'race-ground-mode', label: modeLabel, active: this.racePortraitHotMenu === 'ground-mode', onClick: () => this.handleMenuAction('race-ground-mode') },
      { id: 'race-ground-paint', label: paintLabel, active: this.racePortraitHotMenu === 'ground-paint', onClick: () => this.handleMenuAction('race-ground-paint') },
      { id: 'race-ground-intensity', label: intensityLabel, active: this.racePortraitHotMenu === 'ground-intensity', onClick: () => this.handleMenuAction('race-ground-intensity') },
      { id: 'race-ground-brush', label: `Brush ${Math.round(Number(this.raceGroundBrushCells) || 1)}`, active: this.racePortraitHotMenu === 'ground-brush', onClick: () => this.handleMenuAction('race-ground-brush') }
    ];
  }

  getRaceGroundToolMode() {
    if (['paint-sprite', 'erase-sprite', 'paint-decal', 'erase-decal', 'paint-tile', 'erase-tile'].includes(this.activeAction)) return 'sprite';
    if (this.activeAction === 'paint-elevation') return 'elevation';
    return 'ground';
  }

  getRaceSpriteGroundPaintLabel() {
    const kind = this.getRaceSpritePaintKind();
    if (kind === 'tile') return this.selectedRaceGroundBoxArtRef ? String(this.selectedRaceGroundBoxArtRef).slice(0, 8) : 'Tile';
    if (kind === 'decal') return this.selectedRaceDecalArtRef ? String(this.selectedRaceDecalArtRef).slice(0, 8) : 'Decal';
    return this.selectedSceneryDefinition ? String(this.selectedSceneryDefinition.label || 'Sprite').slice(0, 8) : 'Sprite';
  }

  getRacePortraitGroundPopupActions() {
    const close = { id: 'ground-menu-back', label: 'Back', onClick: () => { this.racePortraitHotMenu = null; } };
    const mode = this.getRaceGroundToolMode();
    if (this.racePortraitHotMenu === 'ground-mode') {
      return [
        close,
        { id: 'race-ground-mode-ground', label: 'Ground', active: mode === 'ground', onClick: () => this.handleMenuAction('race-ground-mode-ground') },
        { id: 'race-ground-mode-elevation', label: 'Elevation', active: mode === 'elevation', onClick: () => this.handleMenuAction('race-ground-mode-elevation') },
        { id: 'race-ground-mode-sprites', label: 'Sprite', active: mode === 'sprite', onClick: () => this.handleMenuAction('race-ground-mode-sprites') }
      ];
    }
    if (this.racePortraitHotMenu === 'ground-paint' && mode === 'ground') {
      const preferred = ['grass', 'dirt', 'gravel', 'snow', 'asphalt', 'wet-asphalt'];
      const choices = this.getRaceGroundTileChoices();
      return [
        close,
        ...preferred
          .map((id) => choices.find((choice) => choice.id === id))
          .filter(Boolean)
          .map((choice) => ({
            id: `ground-tile-${choice.id}`,
            label: choice.label.replace(' Asphalt', ''),
            active: this.getSelectedGroundTileId() === choice.id,
            onClick: () => this.handleMenuAction(`ground-tile-${choice.id}`)
          }))
      ];
    }
    if (this.racePortraitHotMenu === 'ground-paint' && mode === 'elevation') {
      return [
        close,
        { id: 'race-ground-paint-raise', label: 'Raise', active: this.raceElevationBrushDirection > 0, onClick: () => this.handleMenuAction('race-ground-paint-raise') },
        { id: 'race-ground-paint-lower', label: 'Lower', active: this.raceElevationBrushDirection < 0, onClick: () => this.handleMenuAction('race-ground-paint-lower') }
      ];
    }
    if (this.racePortraitHotMenu === 'ground-paint' && mode === 'sprite') {
      return [
        close,
        { id: 'sprite-select', label: 'Sprite', active: this.getRaceSpritePaintKind() === 'sprite', onClick: () => this.handleMenuAction('sprite-select') },
        { id: 'race-decal', label: 'Decal', active: this.getRaceSpritePaintKind() === 'decal', onClick: () => this.handleMenuAction('race-decal') },
        { id: 'race-ground-box', label: 'Tile', active: this.getRaceSpritePaintKind() === 'tile', onClick: () => this.handleMenuAction('race-ground-box') }
      ];
    }
    if (this.racePortraitHotMenu === 'ground-intensity' && mode === 'elevation') {
      const direction = this.raceElevationBrushDirection > 0 ? 'up' : 'down';
      return [
        close,
        ...RACE_TILE_MAP_ELEVATION_AMOUNTS.map((amount) => ({
          id: `elevation-${direction}-${amount.id}`,
          label: `${amount.label} ${amount.amount.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}`,
          active: Math.abs((Number(this.raceElevationBrushAmount) || RACE_TILE_MAP_ELEVATION_STEP) - amount.amount) < 0.0005,
          onClick: () => this.handleMenuAction(`elevation-${direction}-${amount.id}`)
        })),
        { id: 'race-ground-intensity-erase', label: 'Flatten', active: Number(this.raceElevationBrushAmount) === 0, onClick: () => this.handleMenuAction('race-ground-intensity-erase') }
      ];
    }
    if (this.racePortraitHotMenu === 'ground-intensity' && mode === 'sprite') {
      const kind = this.getRaceSpritePaintKind();
      const paintId = this.getRaceSpritePaintActionId(kind);
      const eraseId = this.getRaceSpriteEraseActionId(kind);
      return [
        close,
        { id: paintId, label: this.getRaceSpriteGroundPaintLabel(), active: this.activeAction === paintId, disabled: !this.isRaceSpritePaintReady(kind), onClick: this.isRaceSpritePaintReady(kind) ? () => this.handleMenuAction('paint-sprite') : null },
        { id: eraseId, label: 'Erase', active: this.activeAction === eraseId, onClick: () => this.handleMenuAction('erase-sprite') }
      ];
    }
    if (this.racePortraitHotMenu === 'ground-intensity') {
      return [
        close,
        ...RACE_TILE_MAP_BRUSH_STRENGTHS.map((strength) => ({
          id: `ground-brush-strength-${strength.id}`,
          label: `${strength.label}`,
          active: Math.abs((Number(this.raceGroundBrushStrength) || 1) - strength.strength) < 0.005,
          onClick: () => this.handleMenuAction(`ground-brush-strength-${strength.id}`)
        })),
        { id: 'race-ground-intensity-erase', label: 'Erase', active: Number(this.raceGroundBrushStrength) === 0, onClick: () => this.handleMenuAction('race-ground-intensity-erase') }
      ];
    }
    if (this.racePortraitHotMenu === 'ground-brush') {
      return [
        close,
        ...RACE_TILE_MAP_BRUSH_FALLOFFS.map((falloff) => ({
          id: `ground-brush-falloff-${falloff.id}`,
          label: falloff.label,
          active: this.raceGroundBrushFalloff === falloff.id,
          onClick: () => this.handleMenuAction(`ground-brush-falloff-${falloff.id}`)
        })),
        ...RACE_TILE_MAP_BRUSH_SHAPES.map((shape) => ({
          id: `ground-brush-shape-${shape.id}`,
          label: shape.label,
          active: this.raceGroundBrushShape === shape.id,
          onClick: () => this.handleMenuAction(`ground-brush-shape-${shape.id}`)
        })),
        ...this.getGroundBrushOptions().map((brush) => ({
          id: `ground-brush-${brush.id}`,
          label: `Size ${brush.label}`,
          active: Math.round(Number(this.raceGroundBrushCells) || 1) === brush.cells,
          onClick: () => this.handleMenuAction(`ground-brush-${brush.id}`)
        }))
      ];
    }
    return [];
  }

  getRacePortraitSpriteActions() {
    const selectedDefinition = this.selectedSceneryDefinition;
    const kind = this.getRaceSpritePaintKind();
    const paintId = this.getRaceSpritePaintActionId(kind);
    const eraseId = this.getRaceSpriteEraseActionId(kind);
    const label = kind === 'tile'
      ? (this.selectedRaceGroundBoxArtRef ? String(this.selectedRaceGroundBoxArtRef).slice(0, 8) : 'Tile')
      : kind === 'decal'
        ? (this.selectedRaceDecalArtRef ? String(this.selectedRaceDecalArtRef).slice(0, 8) : 'Decal')
        : (selectedDefinition ? String(selectedDefinition.label || 'Sprite').slice(0, 8) : 'Sprite');
    return [
      { id: 'sprite-select', label: kind === 'sprite' ? label : 'Sprite', active: kind === 'sprite', onClick: () => this.handleMenuAction('sprite-select') },
      { id: 'race-decal', label: kind === 'decal' ? label : 'Decal', active: kind === 'decal', onClick: () => this.handleMenuAction('race-decal') },
      { id: 'race-ground-box', label: kind === 'tile' ? label : 'Tile', active: kind === 'tile', onClick: () => this.handleMenuAction('race-ground-box') },
      { id: paintId, label: 'Paint', active: this.activeAction === paintId, disabled: !this.isRaceSpritePaintReady(kind), onClick: this.isRaceSpritePaintReady(kind) ? () => this.handleMenuAction('paint-sprite') : null },
      { id: 'sprite-brush-settings', label: `Brush ${Math.round(Number(this.raceGroundBrushCells) || 1)}`, active: this.racePortraitHotMenu === 'sprite-brush', onClick: () => this.handleMenuAction('sprite-brush-settings') },
      { id: eraseId, label: 'Erase', active: this.activeAction === eraseId, onClick: () => this.handleMenuAction('erase-sprite') }
    ];
  }

  getRacePortraitHotMenuActions(selected = this.selectedSegment || {}) {
    if (this.raceSelectionType === 'node') {
      return [
        { id: 'hot-menu-edit', label: 'Edit', active: this.racePortraitHotMenu === 'edit', onClick: () => { this.racePortraitHotMenu = 'edit'; } }
      ];
    }
    return [
      { id: 'hot-menu-surface', label: 'Surface', active: this.racePortraitHotMenu === 'surface', onClick: () => { this.racePortraitHotMenu = this.racePortraitHotMenu === 'surface' ? null : 'surface'; } },
      { id: 'hot-menu-width', label: 'Width', active: this.racePortraitHotMenu === 'width', onClick: () => { this.racePortraitHotMenu = this.racePortraitHotMenu === 'width' ? null : 'width'; } },
      { id: 'hot-menu-edit', label: 'Edit', active: this.racePortraitHotMenu === 'edit', onClick: () => { this.racePortraitHotMenu = this.racePortraitHotMenu === 'edit' ? null : 'edit'; } }
    ];
  }

  getRacePortraitTrackPopupActions(selected = this.selectedSegment || {}) {
    const close = { id: 'hot-menu-back', label: 'Back', onClick: () => { this.racePortraitHotMenu = null; } };
    if (this.raceSelectionType === 'node') {
      if (this.racePortraitHotMenu === 'edit') {
        return [
          close,
          { id: 'snap-node', label: 'Snap', onClick: () => this.handleMenuAction('snap-node') },
          { id: 'remove-node', label: 'Delete', onClick: () => this.handleMenuAction('remove-node') }
        ];
      }
      return [];
    }
    if (this.racePortraitHotMenu === 'surface') {
      return [
        close,
        ...RACE_SURFACES.map((surface) => ({
          id: `surface-${surface.id}`,
          label: surface.label.replace(' Asphalt', ''),
          active: getSurfaceById(selected.surface).id === surface.id,
          onClick: () => {
            this.setSelectedSurface(surface.id);
            this.racePortraitHotMenu = null;
          }
        })),
        { id: 'segment-bumpiness', label: `Bump ${Math.round((Number(selected.bumpiness) || 0) * 100)}%`, onClick: () => this.handleMenuAction('segment-bumpiness') },
        { id: 'boundary-collidable', label: selected.boundaryCollidable ? 'Boundary Solid' : 'Boundary Line', onClick: () => this.handleMenuAction('boundary-collidable') }
      ];
    }
    if (this.racePortraitHotMenu === 'width') {
      return [
        close,
        ...[3.6, 5.4, 7.2, 10.8, 14.4, 18, 24].map((width) => ({
          id: `segment-width-${String(width).replace('.', '-')}`,
          label: `${width}m`,
          active: Math.abs(this.getRaceRoadWidthMForSegment(selected) - width) < 0.05,
          onClick: () => {
            this.setSelectedSegmentRoadWidth(width);
            this.racePortraitHotMenu = null;
          }
        }))
      ];
    }
    if (this.racePortraitHotMenu === 'edit') {
      return [
        close,
        { id: 'insert-node', label: 'Insert', onClick: () => this.handleMenuAction('insert-node') },
        { id: 'remove-edge', label: 'Delete', onClick: () => this.handleMenuAction('remove-edge') }
      ];
    }
    return [];
  }

  drawRacePortraitTrackPopup(ctx, anchorBounds) {
    const actions = this.getRacePortraitTrackPopupActions();
    if (!actions.length) return;
    const rowH = 30;
    const gap = 5;
    const pad = 8;
    const maxRows = Math.min(actions.length, 12);
    const popupH = pad * 2 + maxRows * rowH + Math.max(0, maxRows - 1) * gap;
    const bounds = {
      x: anchorBounds.x + 8,
      y: Math.max(8, anchorBounds.y - popupH - 8),
      w: Math.min(anchorBounds.w - 16, 230),
      h: popupH
    };
    drawSharedPanel(ctx, bounds, { fill: 'rgba(5,8,7,0.94)', border: UI_SUITE.colors.border });
    actions.slice(0, maxRows).forEach((action, index) => {
      this.registerDrawnButton(ctx, {
        x: bounds.x + pad,
        y: bounds.y + pad + index * (rowH + gap),
        w: bounds.w - pad * 2,
        h: rowH
      }, action);
    });
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
    if (this.mode === 'car') {
      if (this.playtestSession) {
        this.registerDrawnButton(ctx, button, { id: 'end-playtest', label: 'End Drive', onClick: () => this.endPlaytest() });
      } else {
        this.registerDrawnButton(ctx, button, { id: 'test-drive', label: 'Play', onClick: () => this.handleMenuAction('test-drive') });
      }
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
      { id: 'cycle-surface', label: compact ? surface.label.slice(0, 4) : `Surface: ${surface.label}`, onClick: () => this.cycleSelectedSurface() }
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

  getFirstCarArtRef(value = null) {
    if (Array.isArray(value)) return String(value.find((entry) => String(entry || '').trim()) || '').trim();
    return String(value || '').trim();
  }

  getCarEditorPreviewBodyArtRef(car = this.selectedCar) {
    const art = car?.art || {};
    const shellFrames = art.shellFrames && typeof art.shellFrames === 'object' ? art.shellFrames : {};
    const slot = this.selectedCarShellFrameSlot || 'front';
    const slotEntry = shellFrames.slots?.[slot];
    if (slotEntry?.artRef) return String(slotEntry.artRef || '').trim();
    const turns = art.turnFrames && typeof art.turnFrames === 'object' ? art.turnFrames : {};
    if (this.activeAction === 'turn-left') return this.getFirstCarArtRef(turns.left || art.shell);
    if (this.activeAction === 'turn-right') return this.getFirstCarArtRef(turns.right || art.shell);
    return this.getFirstCarArtRef(turns.center || art.shell || art.body || art.artRef);
  }

  getCarEditorPreviewBodyFrameIndex(car = this.selectedCar) {
    const entry = car?.art?.shellFrames?.slots?.[this.selectedCarShellFrameSlot || 'front'];
    return Number.isFinite(Number(entry?.frameIndex)) ? Math.max(0, Math.round(Number(entry.frameIndex))) : 0;
  }

  drawCarEditorLayerArt(ctx, artRef = '', x = 0, y = 0, w = 1, h = 1, { frameIndex = 0 } = {}) {
    const artCanvas = artRef ? this.getRaceArtSpriteCanvas(artRef, { frameIndex }) : null;
    if (!artCanvas || typeof ctx.drawImage !== 'function') return false;
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(artCanvas, x, y, w, h);
    ctx.imageSmoothingEnabled = previousSmoothing;
    return true;
  }

  drawCarEditorWorkSurface(ctx, bounds) {
    drawSharedPanel(ctx, bounds, { fill: 'rgba(5,8,7,0.72)', border: 'rgba(217,230,210,0.18)' });
    const previewBounds = {
      x: bounds.x + Math.max(12, bounds.w * 0.06),
      y: bounds.y + Math.max(12, bounds.h * 0.08),
      w: Math.max(1, bounds.w - Math.max(24, bounds.w * 0.12)),
      h: Math.max(1, bounds.h * 0.64)
    };
    this.drawCarEditorPreview(ctx, previewBounds, this.selectedCar);
    const panel = {
      x: bounds.x + 12,
      y: previewBounds.y + previewBounds.h + 10,
      w: Math.max(1, bounds.w - 24),
      h: Math.max(56, bounds.y + bounds.h - (previewBounds.y + previewBounds.h + 22))
    };
    this.drawCarEditorActivePanel(ctx, panel);
  }

  drawCarEditorActivePanel(ctx, bounds) {
    const car = this.selectedCar || {};
    const tuning = car.tuning || {};
    const setup = car.setup || {};
    const lines = this.activeRootId === 'art'
      ? [
        `Shell slot: ${CAR_SHELL_FRAME_LABELS[this.selectedCarShellFrameSlot || 'front']}`,
        `Shell frame: ${this.getCarEditorPreviewBodyFrameIndex(car)}`,
        `Reverse frame: ${Number.isFinite(Number(car.art?.shellFrames?.reverseFrameIndex)) ? car.art.shellFrames.reverseFrameIndex : 'rear/default'}`,
        `Default tires: ${this.getRaceTireCompound(car, 'fl').label}`,
        `Add-ons: ${(car.art?.addOns || []).filter((entry) => entry?.enabled !== false && entry?.artRef).length}`
      ]
      : this.activeRootId === 'drivetrain'
        ? [
          `Drivetrain: ${String(tuning.drivetrain || '').toUpperCase()}`,
          `Power curve: ${Math.round(Number(tuning.powerHp) || 0)} hp / ${Math.round(Number(tuning.torqueLbFt) || 0)} lb-ft`,
          `Weight: ${Math.round(Number(tuning.weightKg) || 0)} kg`,
          `Balance: ${Math.round((Number(tuning.frontWeightDistribution) || 0.5) * 100)}% front`
        ]
        : [
          `Tires: ${setup.defaultTireCompound || 'tarmac'} ${this.getCarTireSizeLabel()}`,
          `Pressure: ${Math.round(Number(setup.tirePressurePsi?.fl) || 32)} psi front / ${Math.round(Number(setup.tirePressurePsi?.rl) || 31)} psi rear`,
          `Brake: ${Math.round((Number(tuning.brakeBalance) || 0) * 100)}%`,
          `Aero F/R: ${Math.round((Number(tuning.aeroFront) || 0) * 100)} / ${Math.round((Number(tuning.aeroRear) || 0) * 100)}`,
          `Springs F/R: ${Math.round((Number(tuning.springFront) || 0) * 100)} / ${Math.round((Number(tuning.springRear) || 0) * 100)}`
        ];
    ctx.save();
    ctx.fillStyle = 'rgba(10,16,14,0.78)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(217,230,210,0.18)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 12px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.activeRootId === 'drivetrain' ? 'Drive Setup' : this.activeRootId === 'art' ? 'Visual Components' : 'Tune Setup', bounds.x + 12, bounds.y + 10);
    ctx.font = `11px ${UI_SUITE.font.family}`;
    ctx.fillStyle = UI_SUITE.colors.muted;
    lines.forEach((line, index) => ctx.fillText(line, bounds.x + 12, bounds.y + 30 + index * 15, bounds.w - 24));
    if (this.activeRootId === 'drivetrain') {
      this.drawCarPowerCurveGraph(ctx, {
        x: bounds.x + Math.max(180, bounds.w * 0.46),
        y: bounds.y + 12,
        w: Math.max(120, bounds.w - Math.max(196, bounds.w * 0.48)),
        h: Math.max(48, bounds.h - 24)
      }, car);
    }
    ctx.restore();
  }

  drawCarPowerCurveGraph(ctx, bounds, car = this.selectedCar) {
    const curve = this.normalizeCarEngineCurve(car?.tuning || {});
    const points = curve.torquePoints || [];
    if (points.length < 2 || bounds.w <= 20 || bounds.h <= 20) return;
    const rpmMin = Math.min(...points.map((point) => Number(point.rpm) || 0));
    const rpmMax = Math.max(...points.map((point) => Number(point.rpm) || 0));
    const maxTorque = Math.max(1, ...points.map((point) => Number(point.torqueLbFt) || 0));
    const maxHp = Math.max(1, ...points.map((point) => (Number(point.torqueLbFt) || 0) * (Number(point.rpm) || 0) / 5252));
    const toX = (rpm) => bounds.x + clamp((Number(rpm) - rpmMin) / Math.max(1, rpmMax - rpmMin), 0, 1) * bounds.w;
    const toTorqueY = (torque) => bounds.y + bounds.h - clamp(Number(torque) / maxTorque, 0, 1) * bounds.h;
    const toHpY = (point) => bounds.y + bounds.h - clamp(((Number(point.torqueLbFt) || 0) * (Number(point.rpm) || 0) / 5252) / maxHp, 0, 1) * bounds.h;
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,7,0.62)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(217,230,210,0.18)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    const drawLine = (strokeStyle, yForPoint) => {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((point, index) => {
        const x = toX(point.rpm);
        const y = yForPoint(point);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    drawLine('#f2d45c', (point) => toTorqueY(point.torqueLbFt));
    drawLine('#58d6ff', toHpY);
    points.forEach((point) => {
      ctx.fillStyle = '#f1f4ef';
      ctx.fillRect(toX(point.rpm) - 2, toTorqueY(point.torqueLbFt) - 2, 4, 4);
    });
    ctx.font = `700 10px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f2d45c';
    ctx.fillText('TQ', bounds.x + 6, bounds.y + 5);
    ctx.fillStyle = '#58d6ff';
    ctx.fillText('HP', bounds.x + 34, bounds.y + 5);
    ctx.restore();
  }

  drawCarEditorPreview(ctx, bounds, car = this.selectedCar) {
    if (!car) return;
    const art = car.art || {};
    const dims = this.getRaceCarDimensions(car);
    const maxCarW = bounds.w * 0.72;
    const maxCarH = bounds.h * 0.7;
    const aspect = Math.max(1.4, Number(dims.lengthM || 4.5) / Math.max(0.8, Number(dims.widthM || 1.8)));
    const carH = Math.min(maxCarH, maxCarW * aspect);
    const carW = Math.min(maxCarW, carH / aspect);
    const centerX = bounds.x + bounds.w / 2;
    const centerY = bounds.y + bounds.h * 0.56;
    const x = centerX - carW / 2;
    const y = centerY - carH / 2;
    const wheelW = Math.max(7, carW * 0.16);
    const wheelH = Math.max(16, carH * 0.24);
    const defaultCompound = car?.setup?.defaultTireCompound || car?.setup?.tireCompoundByWheel?.fl || 'tarmac';
    const tireEntry = art.tireTreads?.[defaultCompound] || {};
    const tireArtRef = String(tireEntry.artRef || this.getFirstCarArtRef(art.tires) || '').trim();
    const bodyArtRef = this.getCarEditorPreviewBodyArtRef(car);
    const bodyFrameIndex = this.getCarEditorPreviewBodyFrameIndex(car);
    const wheelPositions = [
      [x - wheelW * 0.18, y + carH * 0.18],
      [x + carW - wheelW * 0.82, y + carH * 0.18],
      [x - wheelW * 0.18, y + carH * 0.68],
      [x + carW - wheelW * 0.82, y + carH * 0.68]
    ];

    ctx.save();
    ctx.fillStyle = 'rgba(217,230,210,0.05)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(217,230,210,0.18)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    wheelPositions.forEach(([wheelX, wheelY]) => {
      if (tireArtRef && this.drawCarEditorLayerArt(ctx, tireArtRef, wheelX, wheelY, wheelW, wheelH, { frameIndex: Number(tireEntry.frameIndex) || 0 })) return;
      ctx.fillStyle = '#050807';
      ctx.fillRect(wheelX, wheelY, wheelW, wheelH);
      ctx.fillStyle = 'rgba(217,230,210,0.18)';
      ctx.fillRect(wheelX + wheelW * 0.25, wheelY + 2, wheelW * 0.5, wheelH - 4);
    });

    if (!this.drawCarEditorLayerArt(ctx, bodyArtRef, x, y, carW, carH, { frameIndex: bodyFrameIndex })) {
      const totalDamage = 0;
      ctx.fillStyle = this.getDamageColor(totalDamage);
      ctx.beginPath();
      ctx.moveTo(centerX, y);
      ctx.lineTo(x + carW * 0.78, y + carH * 0.2);
      ctx.lineTo(x + carW * 0.88, y + carH * 0.82);
      ctx.lineTo(x + carW * 0.12, y + carH * 0.82);
      ctx.lineTo(x + carW * 0.22, y + carH * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#58d6ff';
      ctx.fillRect(x + carW * 0.32, y + carH * 0.22, carW * 0.36, carH * 0.18);
      ctx.fillStyle = 'rgba(241,244,239,0.18)';
      ctx.fillRect(x + carW * 0.26, y + carH * 0.48, carW * 0.48, carH * 0.2);
    }

    const previewAddOns = [
      ...(Array.isArray(art.addOns) ? art.addOns : []),
      ...([...(Array.isArray(art.spoilers) ? art.spoilers : []), art.spoiler].filter(Boolean).map((artRef, index) => ({
        id: `legacy-spoiler-${index}`,
        label: 'Spoiler',
        enabled: true,
        artRef,
        frameIndex: 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1
      })))
    ];
    previewAddOns
      .filter((entry) => entry?.enabled !== false && entry?.artRef)
      .forEach((entry) => {
        const scale = Number(entry.scale || 1) || 1;
        this.drawCarEditorLayerArt(
          ctx,
          entry.artRef,
          x + carW * (0.18 + Number(entry.offsetX || 0)),
          y + carH * (0.78 + Number(entry.offsetY || 0)),
          carW * 0.64 * scale,
          carH * 0.18 * scale,
          { frameIndex: Number(entry.frameIndex) || 0 }
        );
      });

    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `700 10px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bodyLabel = bodyArtRef ? `Shell: ${bodyArtRef} #${bodyFrameIndex}` : 'Default race body';
    const tireLabel = tireArtRef ? `Tires: ${defaultCompound} ${tireArtRef}` : 'Default race tires';
    ctx.fillText(bodyLabel, centerX, bounds.y + bounds.h - 30, bounds.w - 14);
    ctx.fillText(tireLabel, centerX, bounds.y + bounds.h - 14, bounds.w - 14);
    ctx.restore();
  }

  drawCarPanel(ctx, bounds) {
    const car = this.selectedCar;
    const tuning = car.tuning;
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 16px ${UI_SUITE.font.family}`;
    ctx.fillText(car.name, bounds.x + 14, bounds.y + 24);
    const previewH = Math.min(220, Math.max(132, bounds.h * 0.38));
    this.drawCarEditorPreview(ctx, {
      x: bounds.x + 12,
      y: bounds.y + 42,
      w: bounds.w - 24,
      h: previewH
    }, car);
    ctx.font = `12px ${UI_SUITE.font.family}`;
    ctx.fillStyle = UI_SUITE.colors.muted;
    const dimensions = this.getRaceCarDimensions(car);
    const lines = [
      `Drivetrain: ${String(tuning.drivetrain || '').toUpperCase()}`,
      `Power: ${tuning.powerHp} hp`,
      `Weight: ${tuning.weightKg} kg`,
      `Size: ${Number(dimensions.lengthM || 0).toFixed(2)}m x ${Number(dimensions.widthM || 0).toFixed(2)}m`,
      `Engine sound: ${CAR_ENGINE_SOUND_PROFILES.find((profile) => profile.id === car.audio?.engineProfile)?.label || car.audio?.engineSoundId || 'Default'}`,
      `Tire grip: ${tuning.tireGrip}`,
      `Brake balance: ${tuning.brakeBalance}`,
      `Diff accel/decel: ${tuning.differentialAccel}/${tuning.differentialDecel}`,
      `Final drive: ${tuning.gearFinalDrive}`,
      `Aero F/R: ${tuning.aeroFront}/${tuning.aeroRear}`,
      `Springs F/R: ${tuning.springFront}/${tuning.springRear}`
    ];
    const startY = bounds.y + 42 + previewH + 22;
    lines.forEach((line, index) => ctx.fillText(line, bounds.x + 14, startY + index * 18, bounds.w - 28));
  }

  getRaceSegmentLengthLabelLayout(ctx, bounds, points = [], segments = [], roadWidth = 14) {
    if (points.length < 2 || !segments.length) return [];
    const scaleBar = this.getRaceMapScaleBar(bounds);
    const scaleBarBlock = scaleBar
      ? {
        x: bounds.x + 6,
        y: bounds.y + 6,
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
    const x = bounds.x + pad;
    const y = bounds.y + 32;
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
    ctx.textBaseline = 'top';
    ctx.fillText(scaleBar.label, x + scaleBar.width / 2, y + 8);
    ctx.restore();
  }

  getRaceGroundArtChunkWorldM() {
    return Math.max(
      RACE_GROUND_ART_CHUNK_PX * RACE_GROUND_TEXTURE_PIXEL_SCALE_MIN_M,
      this.getRaceGroundTexturePixelWorldM() * RACE_GROUND_ART_CHUNK_PX
    );
  }

  drawRaceWorldSpaceArtTexture(ctx, artCanvas, sourceWorldRect = {}, targetRect = {}) {
    if (!ctx || !artCanvas || typeof ctx.drawImage !== 'function') return false;
    const sourceWidth = Math.max(1, Number(artCanvas.width) || 1);
    const sourceHeight = Math.max(1, Number(artCanvas.height) || 1);
    const pixelWorldM = Math.max(RACE_GROUND_TEXTURE_PIXEL_SCALE_MIN_M, this.getRaceGroundTexturePixelWorldM());
    const textureWorldW = Math.max(pixelWorldM, sourceWidth * pixelWorldM);
    const textureWorldH = Math.max(pixelWorldM, sourceHeight * pixelWorldM);
    const worldLeft = Number(sourceWorldRect.x || 0);
    const worldTop = Number(sourceWorldRect.y || 0);
    const worldW = Math.max(0.001, Number(sourceWorldRect.w) || textureWorldW);
    const worldH = Math.max(0.001, Number(sourceWorldRect.h) || textureWorldH);
    const targetX = Number(targetRect.x || 0);
    const targetY = Number(targetRect.y || 0);
    const targetW = Math.max(0.001, Number(targetRect.w) || 1);
    const targetH = Math.max(0.001, Number(targetRect.h) || 1);
    const wrappedStartX = ((worldLeft % textureWorldW) + textureWorldW) % textureWorldW;
    const wrappedStartY = ((worldTop % textureWorldH) + textureWorldH) % textureWorldH;
    const xSegments = [];
    const ySegments = [];
    let remainingWorldW = worldW;
    let offsetWorldX = 0;
    let cursorWorldX = wrappedStartX;
    while (remainingWorldW > 0.0005 && xSegments.length < 4) {
      const segmentWorldW = Math.min(remainingWorldW, textureWorldW - cursorWorldX);
      xSegments.push({ sourceWorld: cursorWorldX, offsetWorld: offsetWorldX, sizeWorld: segmentWorldW });
      remainingWorldW -= segmentWorldW;
      offsetWorldX += segmentWorldW;
      cursorWorldX = 0;
    }
    let remainingWorldH = worldH;
    let offsetWorldY = 0;
    let cursorWorldY = wrappedStartY;
    while (remainingWorldH > 0.0005 && ySegments.length < 4) {
      const segmentWorldH = Math.min(remainingWorldH, textureWorldH - cursorWorldY);
      ySegments.push({ sourceWorld: cursorWorldY, offsetWorld: offsetWorldY, sizeWorld: segmentWorldH });
      remainingWorldH -= segmentWorldH;
      offsetWorldY += segmentWorldH;
      cursorWorldY = 0;
    }
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    xSegments.forEach((xSegment) => {
      ySegments.forEach((ySegment) => {
        const sx = xSegment.sourceWorld / textureWorldW * sourceWidth;
        const sy = ySegment.sourceWorld / textureWorldH * sourceHeight;
        const sw = xSegment.sizeWorld / textureWorldW * sourceWidth;
        const sh = ySegment.sizeWorld / textureWorldH * sourceHeight;
        const dx = targetX + xSegment.offsetWorld / worldW * targetW;
        const dy = targetY + ySegment.offsetWorld / worldH * targetH;
        const dw = xSegment.sizeWorld / worldW * targetW;
        const dh = ySegment.sizeWorld / worldH * targetH;
        if (sw > 0 && sh > 0 && dw > 0 && dh > 0) ctx.drawImage(artCanvas, sx, sy, sw, sh, dx, dy, dw, dh);
      });
    });
    ctx.imageSmoothingEnabled = previousSmoothing;
    return true;
  }

  drawRaceTopDownTileMap(ctx, bounds) {
    const tileMap = this.ensureRaceTileMap();
    if (!tileMap) return;
    const cellSize = Math.max(1, Number(tileMap.cellSizeM) || RACE_TILE_MAP_CELL_SIZE_M);
    const corners = [
      this.screenToRaceMapWorldPoint(bounds.x, bounds.y, bounds),
      this.screenToRaceMapWorldPoint(bounds.x + bounds.w, bounds.y, bounds),
      this.screenToRaceMapWorldPoint(bounds.x, bounds.y + bounds.h, bounds),
      this.screenToRaceMapWorldPoint(bounds.x + bounds.w, bounds.y + bounds.h, bounds)
    ].filter(Boolean);
    if (!corners.length) return;
    const minWorldX = Math.min(...corners.map((point) => Number(point.x || 0))) - cellSize;
    const maxWorldX = Math.max(...corners.map((point) => Number(point.x || 0))) + cellSize;
    const minWorldY = Math.min(...corners.map((point) => Number(point.y || 0))) - cellSize;
    const maxWorldY = Math.max(...corners.map((point) => Number(point.y || 0))) + cellSize;
    let minCellX = Math.floor(minWorldX / cellSize);
    let maxCellX = Math.ceil(maxWorldX / cellSize);
    let minCellY = Math.floor(minWorldY / cellSize);
    let maxCellY = Math.ceil(maxWorldY / cellSize);
    const origin = this.raceMapWorldToScreenPoint({ x: 0, y: 0 }, bounds);
    const next = this.raceMapWorldToScreenPoint({ x: cellSize, y: 0 }, bounds);
    const cellPixel = origin && next ? Math.abs(next.screenX - origin.screenX) : RACE_TILE_MAP_GRID_MIN_PX;
    const visibleCellCount = Math.max(1, (maxCellX - minCellX + 1) * (maxCellY - minCellY + 1));
    const strideByPixel = cellPixel > 0 ? Math.ceil(RACE_TILE_MAP_RENDER_CELL_TARGET_PX / cellPixel) : 1;
    const strideByBudget = Math.ceil(Math.sqrt(visibleCellCount / RACE_TILE_MAP_RENDER_CELL_BUDGET));
    const stride = Math.max(1, strideByPixel, strideByBudget);
    minCellX -= stride;
    minCellY -= stride;
    maxCellX += stride;
    maxCellY += stride;
    const drawCell = (cellX, cellY) => {
      const worldLeft = cellX * cellSize;
      const worldTop = cellY * cellSize;
      const topLeft = this.raceMapWorldToScreenPoint({ x: worldLeft, y: worldTop }, bounds);
      const bottomRight = this.raceMapWorldToScreenPoint({ x: worldLeft + cellSize * stride, y: worldTop + cellSize * stride }, bounds);
      if (!topLeft || !bottomRight) return;
      const x = Math.min(topLeft.screenX, bottomRight.screenX);
      const y = Math.min(topLeft.screenY, bottomRight.screenY);
      const w = Math.abs(bottomRight.screenX - topLeft.screenX);
      const h = Math.abs(bottomRight.screenY - topLeft.screenY);
      if (x > bounds.x + bounds.w || x + w < bounds.x || y > bounds.y + bounds.h || y + h < bounds.y) return;
      const sampleX = cellX + Math.floor(stride / 2);
      const sampleY = cellY + Math.floor(stride / 2);
      const cell = this.getRaceTileMapCell(sampleX, sampleY, tileMap);
      const palette = this.getRaceWeightedGroundTilePalette(cell?.tileWeights, cell?.tileId || tileMap.defaultTileId || 'grass');
      const checker = (sampleX + sampleY) % 2 === 0;
      ctx.fillStyle = checker ? palette.groundA : palette.groundB;
      ctx.fillRect(x, y, Math.max(1, w + 0.5), Math.max(1, h + 0.5));
      const artRef = String(cell?.artRef || '').trim();
      const artCanvas = artRef ? this.getRaceArtSpriteCanvas(artRef) : null;
      if (artCanvas && typeof ctx.drawImage === 'function') {
        this.drawRaceWorldSpaceArtTexture(
          ctx,
          artCanvas,
          {
            x: worldLeft,
            y: worldTop,
            w: cellSize * stride,
            h: cellSize * stride
          },
          {
            x,
            y,
            w: Math.max(1, w + 0.5),
            h: Math.max(1, h + 0.5)
          }
        );
      }
      const elevation = Number(cell?.elevation || 0);
      if (this.racePortraitMode === 'ground' || Math.abs(elevation) > 0.0005) {
        const range = Math.max(0.01, RACE_TILE_MAP_MAX_ELEVATION - RACE_TILE_MAP_MIN_ELEVATION);
        const shade = Math.round(clamp((elevation - RACE_TILE_MAP_MIN_ELEVATION) / range, 0, 1) * 255);
        ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${cell?.explicit ? 0.52 : 0.26})`;
        ctx.fillRect(x, y, Math.max(1, w + 0.5), Math.max(1, h + 0.5));
      }
    };
    ctx.save();
    if (typeof ctx.rect === 'function' && typeof ctx.clip === 'function') {
      ctx.beginPath();
      ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.clip();
    }
    for (let cellY = minCellY; cellY <= maxCellY; cellY += stride) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += stride) drawCell(cellX, cellY);
    }
    if (cellPixel < RACE_TILE_MAP_GRID_MIN_PX || visibleCellCount > 5000) {
      ctx.restore();
      return;
    }
    ctx.strokeStyle = 'rgba(5,8,7,0.34)';
    ctx.lineWidth = 1;
    for (let cellX = minCellX; cellX <= maxCellX + 1; cellX += 1) {
      const a = this.raceMapWorldToScreenPoint({ x: cellX * cellSize, y: minCellY * cellSize }, bounds);
      const b = this.raceMapWorldToScreenPoint({ x: cellX * cellSize, y: (maxCellY + 1) * cellSize }, bounds);
      ctx.beginPath();
      ctx.moveTo(a.screenX, a.screenY);
      ctx.lineTo(b.screenX, b.screenY);
      ctx.stroke();
    }
    for (let cellY = minCellY; cellY <= maxCellY + 1; cellY += 1) {
      const a = this.raceMapWorldToScreenPoint({ x: minCellX * cellSize, y: cellY * cellSize }, bounds);
      const b = this.raceMapWorldToScreenPoint({ x: (maxCellX + 1) * cellSize, y: cellY * cellSize }, bounds);
      ctx.beginPath();
      ctx.moveTo(a.screenX, a.screenY);
      ctx.lineTo(b.screenX, b.screenY);
      ctx.stroke();
    }
    const chunkWorldM = this.getRaceGroundArtChunkWorldM();
    const chunkPixel = cellPixel * chunkWorldM / cellSize;
    if (chunkPixel >= RACE_TILE_MAP_GRID_MIN_PX) {
      ctx.strokeStyle = 'rgba(244,230,176,0.38)';
      ctx.lineWidth = 1;
      const chunkMinX = Math.floor(minWorldX / chunkWorldM);
      const chunkMaxX = Math.ceil(maxWorldX / chunkWorldM);
      const chunkMinY = Math.floor(minWorldY / chunkWorldM);
      const chunkMaxY = Math.ceil(maxWorldY / chunkWorldM);
      for (let chunkX = chunkMinX; chunkX <= chunkMaxX; chunkX += 1) {
        const a = this.raceMapWorldToScreenPoint({ x: chunkX * chunkWorldM, y: minWorldY }, bounds);
        const b = this.raceMapWorldToScreenPoint({ x: chunkX * chunkWorldM, y: maxWorldY }, bounds);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.screenX, a.screenY);
        ctx.lineTo(b.screenX, b.screenY);
        ctx.stroke();
      }
      for (let chunkY = chunkMinY; chunkY <= chunkMaxY; chunkY += 1) {
        const a = this.raceMapWorldToScreenPoint({ x: minWorldX, y: chunkY * chunkWorldM }, bounds);
        const b = this.raceMapWorldToScreenPoint({ x: maxWorldX, y: chunkY * chunkWorldM }, bounds);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.screenX, a.screenY);
        ctx.lineTo(b.screenX, b.screenY);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawRaceTopDownEditor(ctx, bounds) {
    this.raceMapBounds = { ...bounds };
    const race = this.selectedRace;
    const segments = race?.road?.segments || [];
    const road = this.ensureRaceRoadAuthoringData();
    const points = this.getRaceMapPoints(bounds);
    const mapScale = Math.max(0.001, Number(this.getRaceMapTransform(bounds).scale) || 1);
    const selectedIndex = clamp(Math.round(Number(this.selectedSegmentIndex) || 0), 0, Math.max(0, segments.length - 1));
    ctx.save();
    ctx.fillStyle = '#111916';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    this.drawRaceTopDownTileMap(ctx, bounds);
    const renderDebug = this.getRaceRenderDebugSettings();

    const baseRoadWidth = Math.max(2, this.getRaceRoadWidthMForSegment(segments[0] || {}) * mapScale);
    for (let index = 1; index < points.length; index += 1) {
      const segment = segments[index - 1] || {};
      const segmentWidthM = this.getRaceRoadWidthMForSegment(segment);
      const roadWidth = clamp(segmentWidthM * mapScale, 2, Math.max(2, bounds.w * 0.18));
      const shoulderInset = clamp(2.5 * mapScale, 2, 16);
      const outlineInset = clamp(1.7 * mapScale, 1.5, 12);
      const edgeInset = clamp(1.15 * mapScale, 1, 8);
      const from = points[index - 1];
      const to = points[index];
      const surface = getSurfaceById(segment.surface);
      const edgePalette = this.getRaceGroundTilePalette(segment.edgeTileId, segment.surface);
      ctx.lineCap = segment.turn === 'square' ? 'butt' : 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = edgePalette.groundB;
      ctx.lineWidth = roadWidth + shoulderInset * 2;
      ctx.beginPath();
      ctx.moveTo(from.screenX, from.screenY);
      ctx.lineTo(to.screenX, to.screenY);
      ctx.stroke();
      ctx.strokeStyle = this.raceSelectionType !== 'node' && index - 1 === selectedIndex ? UI_SUITE.colors.accent : '#07100d';
      ctx.lineWidth = roadWidth + outlineInset * 2;
      ctx.beginPath();
      ctx.moveTo(from.screenX, from.screenY);
      ctx.lineTo(to.screenX, to.screenY);
      ctx.stroke();
      if (segment.edgeTileId) {
        ctx.strokeStyle = edgePalette.groundA;
        ctx.lineWidth = roadWidth + edgeInset * 2;
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
    if (renderDebug.editorSurfacePreviewEnabled || renderDebug.editorSurfacePreview3dEnabled) {
      this.drawRaceCanonicalSurfacePreview(ctx, bounds, renderDebug);
    }
    if (renderDebug.editorSurfacePreview3dEnabled) {
      this.drawRaceEditorSurface3dPreview(ctx, bounds, renderDebug);
    }
    this.drawRaceTopDownDecals(ctx, bounds, { kind: 'decal' });
    this.drawRaceTopDownScenerySprites(ctx, bounds);
    this.drawRaceSegmentLengthLabels(ctx, bounds, points, segments, baseRoadWidth);
    this.drawRaceMapScaleBar(ctx, bounds);

    points.forEach((point, index) => {
      const segmentIndex = clamp(index - 1, 0, Math.max(0, segments.length - 1));
      const active = this.raceSelectionType === 'node' && segmentIndex === selectedIndex && index > 0;
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

    if (this.activeViewportMode !== 'portrait') this.drawRaceTilePalette(ctx, bounds);
    ctx.restore();
  }

  drawRaceEditorSurface3dPreview(ctx, bounds, renderDebug = this.getRaceRenderDebugSettings()) {
    if (!ctx || !bounds) return false;
    const routeLength = Math.max(1, Number(this.getRaceRouteLength()) || 1);
    const runtimeType = this.getSelectedRaceRuntimeType();
    const travel = clamp(Number(this.selectedSegmentIndex || 0) / Math.max(1, (this.selectedRace?.road?.segments || []).length || 1) * routeLength, 0, routeLength);
    const pose = this.getRaceWorldPoseAtDistance(travel, {
      routeLength,
      runtimeType,
      allowVisualExtension: runtimeType !== 'circuit'
    });
    const cameraYaw = Number(pose.yaw || 0);
    const forward = this.getRaceForwardVector(cameraYaw);
    const inset = {
      x: bounds.x + Math.max(8, bounds.w - Math.min(320, bounds.w * 0.42) - 10),
      y: bounds.y + 58,
      w: Math.min(320, bounds.w * 0.42),
      h: Math.min(190, bounds.h * 0.34)
    };
    const camera = {
      x: Number(pose.x || 0) - forward.x * 26,
      z: Number(pose.z || 0) - forward.z * 26,
      elevation: Number(pose.elevation || 0) + 0.42,
      yaw: cameraYaw,
      nearPlane: 1.2,
      farPlane: 1800,
      horizonRatio: 0.36,
      focalScale: 1.05,
      roadWidthScale: 1.6,
      roadDepthRatio: 0.7,
      roadMaxWidthRatio: 1
    };
    const stableRoadSections = this.getRaceStableRoadSections({
      bounds: inset,
      camera,
      cameraYaw,
      visualTravel: travel,
      routeLength,
      routeRuntimeType: runtimeType,
      nearDistance: 1.2,
      viewDistance: Math.min(900, routeLength + 120),
      backDistance: 30
    });
    ctx.save();
    ctx.fillStyle = RACE_WORLD_EMPTY_BACKGROUND_COLOR;
    ctx.fillRect(inset.x, inset.y, inset.w, inset.h);
    ctx.restore();
    const previousRenderer = this.selectedRace?.groundRenderer;
    let drew = false;
    try {
      if (this.selectedRace) this.selectedRace.groundRenderer = 'webgl-track';
      drew = this.drawRaceWebGLTrackScene(ctx, inset, [], {
        camera,
        cameraView: 'third-person',
        cameraYaw,
        currentSegment: pose.segment || this.selectedSegment,
        weatherState: this.getRaceWeatherState(),
        slices: stableRoadSections,
        stableRoadSections,
        travel,
        routeLength
      });
    } finally {
      if (this.selectedRace) this.selectedRace.groundRenderer = previousRenderer;
    }
    ctx.save();
    ctx.strokeStyle = drew ? 'rgba(157,220,255,0.9)' : '#ff00ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(inset.x, inset.y, inset.w, inset.h);
    ctx.fillStyle = 'rgba(5,8,7,0.72)';
    ctx.fillRect(inset.x, inset.y, 104, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = `10px ${UI_SUITE.font.family}`;
    ctx.fillText('Surface 3D', inset.x + 6, inset.y + 12);
    ctx.restore();
    return drew;
  }

  drawRaceCanonicalSurfacePreview(ctx, bounds, renderDebug = this.getRaceRenderDebugSettings()) {
    const runtimeType = this.getSelectedRaceRuntimeType();
    const routeLength = Math.max(1, Number(this.getRaceRouteLength()) || 1);
    const preview = this.getRaceEditorSurfacePreviewBake({ runtimeType, routeLength, renderDebug });
    const sections = preview?.surfaceBake?.sections || this.getRaceSurfaceBake({
      routeLength,
      runtimeType,
      allowVisualExtension: runtimeType !== 'circuit'
    }).sections || [];
    if (!Array.isArray(sections) || sections.length < 2) return;
    const mode = String(renderDebug.editorSurfaceDebugMode || 'bands');
    const toScreen = (point = {}) => this.raceMapWorldToScreenPoint({ x: point.x, y: point.z ?? point.y }, bounds);
    const drawStrip = (leftKey, rightKey, color, alpha = 0.36) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      for (let index = 1; index < sections.length; index += 1) {
        const previous = sections[index - 1];
        const next = sections[index];
        const polygon = [
          toScreen(next[leftKey]),
          toScreen(next[rightKey]),
          toScreen(previous[rightKey]),
          toScreen(previous[leftKey])
        ];
        if (polygon.some((point) => !point)) continue;
        ctx.beginPath();
        ctx.moveTo(polygon[0].screenX, polygon[0].screenY);
        polygon.slice(1).forEach((point) => ctx.lineTo(point.screenX, point.screenY));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };
    if (mode === 'bands' || mode === 'material' || mode === 'raw-composed') {
      drawStrip('left', 'right', '#2f6bff', mode === 'raw-composed' ? 0.28 : 0.42);
      drawStrip('marginLeft', 'left', '#d9d3a3', 0.34);
      drawStrip('right', 'marginRight', '#d9d3a3', 0.34);
      drawStrip('shoulderLeft', 'marginLeft', '#4fa35c', 0.32);
      drawStrip('marginRight', 'shoulderRight', '#4fa35c', 0.32);
      drawStrip('transitionLeft', 'shoulderLeft', '#8ac070', 0.24);
      drawStrip('shoulderRight', 'transitionRight', '#8ac070', 0.24);
    }
    const drawPolyline = (key, color, width = 1.5, dash = []) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash?.(dash);
      ctx.beginPath();
      sections.forEach((section, index) => {
        const point = toScreen(section[key]);
        if (!point) return;
        if (index === 0) ctx.moveTo(point.screenX, point.screenY);
        else ctx.lineTo(point.screenX, point.screenY);
      });
      ctx.stroke();
      ctx.restore();
    };
    ['left', 'right', 'marginLeft', 'marginRight', 'shoulderLeft', 'shoulderRight'].forEach((key) => {
      drawPolyline(key, 'rgba(255,255,255,0.48)', 1);
    });
    drawPolyline('transitionLeft', mode === 'seams' ? '#ff00ff' : 'rgba(255,255,255,0.72)', mode === 'seams' ? 3 : 1.5, mode === 'wireframe' ? [4, 4] : []);
    drawPolyline('transitionRight', mode === 'seams' ? '#ff00ff' : 'rgba(255,255,255,0.72)', mode === 'seams' ? 3 : 1.5, mode === 'wireframe' ? [4, 4] : []);
    if (mode === 'wireframe' || mode === '3d') {
      (preview.terrainCells || []).slice(0, 2400).forEach((cell) => {
        const points = Array.isArray(cell.points) ? cell.points.map(toScreen).filter(Boolean) : [];
        if (points.length < 3) return;
        ctx.strokeStyle = cell.clippedToTrackCorridor ? 'rgba(255,0,255,0.82)' : 'rgba(157,220,255,0.22)';
        ctx.lineWidth = cell.clippedToTrackCorridor ? 1.6 : 0.7;
        ctx.beginPath();
        ctx.moveTo(points[0].screenX, points[0].screenY);
        points.slice(1).forEach((point) => ctx.lineTo(point.screenX, point.screenY));
        ctx.closePath();
        ctx.stroke();
      });
    }
    if (mode === 'normals') {
      sections.filter((_, index) => index % 5 === 0).forEach((section) => {
        const center = toScreen(section.center);
        if (!center) return;
        const normal = section.center?.normal || { x: 0, y: 1, z: 0 };
        ctx.strokeStyle = '#9ddcff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(center.screenX, center.screenY);
        ctx.lineTo(center.screenX + Number(normal.x || 0) * 18, center.screenY + Number(normal.z || 0) * 18);
        ctx.stroke();
      });
    }
    if (mode === 'labels') {
      ctx.fillStyle = '#f1f4ef';
      ctx.font = `10px ${UI_SUITE.font.family}`;
      ctx.textAlign = 'left';
      sections.filter((_, index) => index % 8 === 0).forEach((section) => {
        const point = toScreen(section.center);
        if (!point) return;
        ctx.fillText(`deck ${Number(section.center?.elevation || 0).toFixed(2)}`, point.screenX + 4, point.screenY - 4);
      });
    }
    if (mode === 'wheels' && this.playtestSession) {
      const contacts = this.getRaceWheelContactState();
      Object.values(contacts.contacts || {}).forEach((contact) => {
        const point = toScreen(contact);
        if (!point) return;
        ctx.fillStyle = contact.region === 'road' ? '#ffffff' : contact.region === 'margin' ? '#ffe66d' : contact.region === 'shoulder' ? '#62d26f' : '#ff00ff';
        ctx.beginPath();
        ctx.arc(point.screenX, point.screenY, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    const validation = preview.validation || {};
    const bad = Number(validation.magentaEdges || 0) > 0 || Number(validation.nonManifoldEdges || 0) > 0 || Number(validation.degenerateTriangles || 0) > 0;
    ctx.save();
    ctx.fillStyle = bad ? 'rgba(255,0,255,0.92)' : 'rgba(5,8,7,0.76)';
    ctx.fillRect(bounds.x + 8, bounds.y + 8, Math.min(bounds.w - 16, 360), 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = `10px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.fillText(`Surface ${String(preview.surfaceRevision || '').slice(0, 28)}`, bounds.x + 14, bounds.y + 22);
    ctx.fillText(`Tri ${validation.terrainTriangles || 0} Deg ${validation.degenerateTriangles || 0} Open ${validation.openEdges || 0} NM ${validation.nonManifoldEdges || 0} Clip ${validation.rejectedByCorridor || 0}`, bounds.x + 14, bounds.y + 38);
    ctx.restore();
  }

  drawRaceTopDownScenerySprites(ctx, bounds) {
    const scenery = this.ensureRaceScenery();
    if (!scenery.length) return;
    scenery.forEach((sprite, index) => {
      if (sprite.state === 'removed') return;
      const screen = this.raceMapWorldToScreenPoint({ x: sprite.x, y: sprite.z }, bounds);
      if (!screen) return;
      const preset = RACE_SCENERY_PRESET_BY_ID[sprite.presetId] || RACE_SCENERY_PRESETS[0];
      const radius = clamp((Number(sprite.widthM) || preset.widthM) * Number(screen.scale || 1) * 0.5, 3, 28);
      const selected = index === this.selectedSceneryIndex && this.raceSelectionType === 'sprite';
      ctx.fillStyle = preset.colors?.[0] || '#6f9f3d';
      ctx.beginPath();
      ctx.arc(screen.screenX, screen.screenY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = selected ? UI_SUITE.colors.accent : (preset.colors?.[1] || '#203d22');
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.stroke();
      ctx.fillStyle = selected ? UI_SUITE.colors.accent : UI_SUITE.colors.text;
      ctx.font = `700 ${selected ? 10 : 8}px ${UI_SUITE.font.family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(sprite.label || preset.label || 'S').slice(0, 1), screen.screenX, screen.screenY);
    });
  }

  drawRaceTopDownDecals(ctx, bounds, { kind = null } = {}) {
    const decals = this.ensureRaceDecals();
    if (!decals.length) return;
    decals.forEach((decal) => {
      if (kind && String(decal.kind || 'decal') !== kind) return;
      const screen = this.raceMapWorldToScreenPoint({ x: decal.x, y: decal.z }, bounds);
      if (!screen) return;
      const size = clamp((Number(decal.widthM) || 3.2) * Number(screen.scale || 1), 5, String(decal.kind || 'decal') === 'tile' ? 260 : 42);
      const x = screen.screenX - size / 2;
      const y = screen.screenY - size / 2;
      const artCanvas = this.getRaceArtSpriteCanvas(decal.artRef);
      ctx.save();
      ctx.globalAlpha = 0.86;
      if (decal.shape === 'oval') {
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') ctx.ellipse(screen.screenX, screen.screenY, size / 2, size / 2, 0, 0, Math.PI * 2);
        else ctx.arc(screen.screenX, screen.screenY, size / 2, 0, Math.PI * 2);
        ctx.clip?.();
      }
      if (artCanvas && typeof ctx.drawImage === 'function') {
        ctx.drawImage(artCanvas, x, y, size, size);
      } else {
        ctx.fillStyle = 'rgba(5,8,7,0.72)';
        ctx.fillRect(x, y, size, size);
        ctx.strokeStyle = UI_SUITE.colors.accent;
        ctx.strokeRect(x, y, size, size);
      }
      ctx.restore();
    });
  }

  getRaceArtSpriteCanvas(artRef = '', { frameIndex = 0 } = {}) {
    const clean = String(artRef || '').trim();
    if (!clean || typeof document === 'undefined') return null;
    const requestedFrameIndex = Math.max(0, Math.round(Number(frameIndex) || 0));
    const directCacheKey = `name:${clean}:frame:${requestedFrameIndex}`;
    if (this.raceArtSpriteCache.has(directCacheKey)) return this.raceArtSpriteCache.get(directCacheKey);
    const missStartMs = this.playtestSession && !this.racePreloadingArt ? this.getNowMs() : 0;
    const payload = loadProjectFile('art', clean);
    const cacheKey = `${clean}:${Number(payload?.savedAt || 0)}:frame:${requestedFrameIndex}`;
    if (this.raceArtSpriteCache.has(cacheKey)) {
      const cached = this.raceArtSpriteCache.get(cacheKey);
      this.raceArtSpriteCache.set(directCacheKey, cached);
      return cached;
    }
    let data = payload?.data || payload;
    if (payload?.__chainsawStorage && typeof payload.data === 'string' && payload.encoding === 'json') {
      try {
        data = JSON.parse(payload.data);
      } catch (error) {
        data = null;
      }
    }
    if (!Array.isArray(data?.frames) && data?.tiles && typeof data.tiles === 'object') {
      data = Object.values(data.tiles).find((entry) => entry) || data;
    }
    const rawFrames = Array.isArray(data?.frames)
      ? data.frames
      : (Array.isArray(data?.editor?.frames) ? data.editor.frames : []);
    const frame = rawFrames[requestedFrameIndex] || rawFrames[0] || null;
    const normalizeFramePixels = (source) => {
      if (!source) return null;
      if (Array.isArray(source) && source.length && !Array.isArray(source[0])) return source;
      if (Array.isArray(source) && Array.isArray(source[0])) return source[0];
      if (source && typeof source === 'object') {
        if (Array.isArray(source.pixels) && source.pixels.length) return source.pixels;
        if (Array.isArray(source.data) && source.data.length) return source.data;
        const layers = Array.isArray(source.layers) ? source.layers : [];
        const width = Math.max(1, Math.round(Number(data?.width || data?.editor?.width || data?.size || 16)));
        const height = Math.max(1, Math.round(Number(data?.height || data?.editor?.height || data?.size || width)));
        const composite = new Array(width * height).fill(0);
        let painted = false;
        layers.forEach((layer) => {
          if (layer?.visible === false) return;
          const pixels = Array.isArray(layer?.pixels) ? layer.pixels : Array.isArray(layer?.data) ? layer.data : null;
          if (!pixels) return;
          pixels.forEach((value, index) => {
            if (!value) return;
            composite[index] = value;
            painted = true;
          });
        });
        if (painted) return composite;
      }
      return null;
    };
    const pixels = normalizeFramePixels(frame) || normalizeFramePixels(data);
    if (!Array.isArray(pixels) || !pixels.length) {
      this.raceArtSpriteCache.set(cacheKey, null);
      this.raceArtSpriteCache.set(directCacheKey, null);
      return null;
    }
    const width = Math.max(1, Math.round(Number(data?.width || data?.editor?.width || data?.size || Math.sqrt(pixels.length) || 16)));
    const height = Math.max(1, Math.round(Number(data?.height || data?.editor?.height || data?.size || Math.ceil(pixels.length / width) || width)));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const artCtx = canvas.getContext('2d');
    if (!artCtx) {
      this.raceArtSpriteCache.set(cacheKey, null);
      this.raceArtSpriteCache.set(directCacheKey, null);
      return null;
    }
    const parsePixel = (value) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return {
          r: value & 255,
          g: (value >>> 8) & 255,
          b: (value >>> 16) & 255,
          a: (value >>> 24) & 255
        };
      }
      const text = String(value || '').trim();
      if (!/^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(text)) return null;
      const hex = text.startsWith('#') ? text.slice(1) : text;
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) : 255
      };
    };
    if (typeof artCtx.createImageData === 'function' && typeof artCtx.putImageData === 'function') {
      const imageData = artCtx.createImageData(width, height);
      for (let i = 0; i < width * height; i += 1) {
        const color = parsePixel(pixels[i]);
        const base = i * 4;
        if (!color || color.a === 0) {
          imageData.data[base + 3] = 0;
          continue;
        }
        imageData.data[base] = color.r;
        imageData.data[base + 1] = color.g;
        imageData.data[base + 2] = color.b;
        imageData.data[base + 3] = color.a;
      }
      artCtx.putImageData(imageData, 0, 0);
    } else {
      pixels.forEach((value, index) => {
        const color = parsePixel(value);
        if (!color || color.a === 0) return;
        artCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
        artCtx.fillRect(index % width, Math.floor(index / width), 1, 1);
      });
    }
    this.raceArtSpriteCache.set(cacheKey, canvas);
    this.raceArtSpriteCache.set(directCacheKey, canvas);
    if (missStartMs > 0) {
      this.raceRuntimeArtCacheMisses = (Number(this.raceRuntimeArtCacheMisses) || 0) + 1;
      this.lastRaceRenderStats = {
        ...(this.lastRaceRenderStats || {}),
        artCacheMisses: this.raceRuntimeArtCacheMisses,
        artCacheMissMs: (Number(this.lastRaceRenderStats?.artCacheMissMs) || 0) + Math.max(0, this.getNowMs() - missStartMs)
      };
    }
    return canvas;
  }

  getRaceArtTextureSampler(artRef = '') {
    const clean = String(artRef || '').trim();
    if (!clean || typeof document === 'undefined') return null;
    const canvas = this.getRaceArtSpriteCanvas(clean);
    if (!canvas) return null;
    const cacheKey = `${clean}:${Number(canvas.width || 0)}x${Number(canvas.height || 0)}`;
    if (this.raceArtTextureCache.has(cacheKey)) return this.raceArtTextureCache.get(cacheKey);
    const missStartMs = this.playtestSession && !this.racePreloadingArt ? this.getNowMs() : 0;
    const context = canvas.getContext?.('2d');
    if (!context || typeof context.getImageData !== 'function') {
      this.raceArtTextureCache.set(cacheKey, null);
      return null;
    }
    let imageData = null;
    try {
      imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    } catch (error) {
      imageData = null;
    }
    if (!imageData?.data?.length) {
      this.raceArtTextureCache.set(cacheKey, null);
      return null;
    }
    const width = Math.max(1, Math.floor(Number(canvas.width) || 1));
    const height = Math.max(1, Math.floor(Number(canvas.height) || 1));
    const quantizeTerrainChannel = (value) => clamp(
      Math.round(Math.round((Number(value) || 0) / RACE_GROUND_CLEAN_TEXTURE_QUANT_STEP) * RACE_GROUND_CLEAN_TEXTURE_QUANT_STEP),
      0,
      255
    );
    const buildMipLevels = (baseLevel, { quantize = false, maxLevels = 9 } = {}) => {
      const levels = [{
        width: Math.max(1, Math.floor(Number(baseLevel.width) || 1)),
        height: Math.max(1, Math.floor(Number(baseLevel.height) || 1)),
        data: baseLevel.data
      }];
      while (levels.length < maxLevels) {
        const previous = levels[levels.length - 1];
      if (previous.width <= 1 && previous.height <= 1) break;
      const nextWidth = Math.max(1, Math.ceil(previous.width / 2));
      const nextHeight = Math.max(1, Math.ceil(previous.height / 2));
      const nextData = new Uint8ClampedArray(nextWidth * nextHeight * 4);
      for (let y = 0; y < nextHeight; y += 1) {
        for (let x = 0; x < nextWidth; x += 1) {
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 0;
          let count = 0;
          for (let oy = 0; oy < 2; oy += 1) {
            for (let ox = 0; ox < 2; ox += 1) {
              const sourceX = Math.min(previous.width - 1, x * 2 + ox);
              const sourceY = Math.min(previous.height - 1, y * 2 + oy);
              const sourceBase = (sourceY * previous.width + sourceX) * 4;
              const alpha = Number(previous.data[sourceBase + 3] || 0) / 255;
              r += Number(previous.data[sourceBase] || 0) * alpha;
              g += Number(previous.data[sourceBase + 1] || 0) * alpha;
              b += Number(previous.data[sourceBase + 2] || 0) * alpha;
              a += alpha;
              count += 1;
            }
          }
          const base = (y * nextWidth + x) * 4;
          if (a <= 0.001) {
            nextData[base + 3] = 0;
          } else {
            const outR = Math.round(r / a);
            const outG = Math.round(g / a);
            const outB = Math.round(b / a);
            nextData[base] = quantize ? quantizeTerrainChannel(outR) : outR;
            nextData[base + 1] = quantize ? quantizeTerrainChannel(outG) : outG;
            nextData[base + 2] = quantize ? quantizeTerrainChannel(outB) : outB;
            nextData[base + 3] = Math.round(clamp(a / count, 0, 1) * 255);
          }
        }
      }
        levels.push({ width: nextWidth, height: nextHeight, data: nextData });
      }
      return levels;
    };
    const buildCleanTerrainBaseLevel = () => {
      const maxSource = Math.max(width, height);
      const scale = maxSource > RACE_GROUND_CLEAN_ATLAS_MAX_PX
        ? RACE_GROUND_CLEAN_ATLAS_MAX_PX / maxSource
        : 1;
      const cleanWidth = Math.max(1, Math.round(width * scale));
      const cleanHeight = Math.max(1, Math.round(height * scale));
      const cleanData = new Uint8ClampedArray(cleanWidth * cleanHeight * 4);
      for (let y = 0; y < cleanHeight; y += 1) {
        const sourceY0 = y / cleanHeight * height;
        const sourceY1 = (y + 1) / cleanHeight * height;
        const minY = clamp(Math.floor(sourceY0), 0, height - 1);
        const maxY = clamp(Math.ceil(sourceY1) - 1, 0, height - 1);
        for (let x = 0; x < cleanWidth; x += 1) {
          const sourceX0 = x / cleanWidth * width;
          const sourceX1 = (x + 1) / cleanWidth * width;
          const minX = clamp(Math.floor(sourceX0), 0, width - 1);
          const maxX = clamp(Math.ceil(sourceX1) - 1, 0, width - 1);
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 0;
          let count = 0;
          for (let sy = minY; sy <= maxY; sy += 1) {
            for (let sx = minX; sx <= maxX; sx += 1) {
              const sourceBase = (sy * width + sx) * 4;
              const alpha = Number(imageData.data[sourceBase + 3] || 0) / 255;
              r += Number(imageData.data[sourceBase] || 0) * alpha;
              g += Number(imageData.data[sourceBase + 1] || 0) * alpha;
              b += Number(imageData.data[sourceBase + 2] || 0) * alpha;
              a += alpha;
              count += 1;
            }
          }
          const base = (y * cleanWidth + x) * 4;
          if (a <= 0.001) {
            cleanData[base + 3] = 0;
            continue;
          }
          cleanData[base] = quantizeTerrainChannel(r / a);
          cleanData[base + 1] = quantizeTerrainChannel(g / a);
          cleanData[base + 2] = quantizeTerrainChannel(b / a);
          cleanData[base + 3] = Math.round(clamp(a / Math.max(1, count), 0, 1) * 255);
        }
      }
      return {
        width: cleanWidth,
        height: cleanHeight,
        data: cleanData
      };
    };
    const mipLevels = buildMipLevels({
      width,
      height,
      data: imageData.data
    });
    const terrainMipLevels = buildMipLevels(buildCleanTerrainBaseLevel(), { quantize: true });
    const makeMipReader = (levels, { nearest = false } = {}) => (levelIndex = 0, u = 0, v = 0) => {
      const selectedLevels = Array.isArray(levels) && levels.length ? levels : mipLevels;
      const level = selectedLevels[clamp(Math.round(Number(levelIndex) || 0), 0, selectedLevels.length - 1)];
      const levelWidth = Math.max(1, Number(level.width) || 1);
      const levelHeight = Math.max(1, Number(level.height) || 1);
      const wrappedU = ((Number(u || 0) % 1) + 1) % 1;
      const wrappedV = ((Number(v || 0) % 1) + 1) % 1;
      const read = (x, y) => {
        const wrappedX = ((x % levelWidth) + levelWidth) % levelWidth;
        const wrappedY = ((y % levelHeight) + levelHeight) % levelHeight;
        const base = (wrappedY * levelWidth + wrappedX) * 4;
        return {
          r: Number(level.data[base] || 0),
          g: Number(level.data[base + 1] || 0),
          b: Number(level.data[base + 2] || 0),
          a: Number(level.data[base + 3] || 0) / 255
        };
      };
      if (nearest) {
        const sourceX = Math.floor(wrappedU * levelWidth);
        const sourceY = Math.floor(wrappedV * levelHeight);
        const color = read(sourceX, sourceY);
        if (color.a <= 0.01) return null;
        return color;
      }
      const sourceX = wrappedU * levelWidth - 0.5;
      const sourceY = wrappedV * levelHeight - 0.5;
      const x0 = Math.floor(sourceX);
      const y0 = Math.floor(sourceY);
      const tx = sourceX - x0;
      const ty = sourceY - y0;
      const c00 = read(x0, y0);
      const c10 = read(x0 + 1, y0);
      const c01 = read(x0, y0 + 1);
      const c11 = read(x0 + 1, y0 + 1);
      const mix = (a, b, t) => a + (b - a) * t;
      const top = {
        r: mix(c00.r, c10.r, tx),
        g: mix(c00.g, c10.g, tx),
        b: mix(c00.b, c10.b, tx),
        a: mix(c00.a, c10.a, tx)
      };
      const bottom = {
        r: mix(c01.r, c11.r, tx),
        g: mix(c01.g, c11.g, tx),
        b: mix(c01.b, c11.b, tx),
        a: mix(c01.a, c11.a, tx)
      };
      const alpha = mix(top.a, bottom.a, ty);
      if (alpha <= 0.01) return null;
      return {
        r: mix(top.r, bottom.r, ty),
        g: mix(top.g, bottom.g, ty),
        b: mix(top.b, bottom.b, ty),
        a: alpha
      };
    };
    const readMipColor = makeMipReader(mipLevels);
    const readTerrainMipColor = makeMipReader(terrainMipLevels, { nearest: true });
    const averageFromLevels = (levels, reader, baseWidth, baseHeight, u = 0, v = 0, footprint = 0) => {
      const pixelFootprint = Math.max(0, Number(footprint) || 0) * Math.max(baseWidth, baseHeight);
      if (pixelFootprint <= 1.15 || levels.length <= 1) {
        const color = reader(0, u, v);
        if (!color) return null;
        return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a})`;
      }
      const mip = clamp(Math.log2(pixelFootprint), 0, levels.length - 1);
      const low = Math.floor(mip);
      const high = Math.min(levels.length - 1, low + 1);
      const t = mip - low;
      const a = reader(low, u, v);
      const b = reader(high, u, v) || a;
      if (!a && !b) return null;
      const color = a && b ? {
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t,
        a: a.a + (b.a - a.a) * t
      } : (a || b);
      return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a})`;
    };
    const sampler = {
      width,
      height,
      mipLevels,
      terrainMipLevels,
      worldWidthUnits: Math.max(1, width / RACE_GROUND_TEXTURE_BASE_PX),
      worldHeightUnits: Math.max(1, height / RACE_GROUND_TEXTURE_BASE_PX),
      worldWidthM: Math.max(RACE_GROUND_TEXTURE_BASE_WORLD_M, (width / RACE_GROUND_TEXTURE_BASE_PX) * RACE_GROUND_TEXTURE_BASE_WORLD_M),
      worldHeightM: Math.max(RACE_GROUND_TEXTURE_BASE_WORLD_M, (height / RACE_GROUND_TEXTURE_BASE_PX) * RACE_GROUND_TEXTURE_BASE_WORLD_M),
      averageSample: (u = 0, v = 0, footprint = 0) => {
        return averageFromLevels(mipLevels, readMipColor, width, height, u, v, footprint);
      },
      terrainAverageSample: (u = 0, v = 0, footprint = 0) => {
        const base = terrainMipLevels[0] || { width, height };
        return averageFromLevels(
          terrainMipLevels,
          readTerrainMipColor,
          Math.max(1, Number(base.width) || 1),
          Math.max(1, Number(base.height) || 1),
          u,
          v,
          footprint
        );
      },
      readColor: (u = 0, v = 0) => {
        return readMipColor(0, u, v);
      },
      readTerrainColor: (u = 0, v = 0) => {
        return readTerrainMipColor(0, u, v);
      },
      sample: (u = 0, v = 0) => {
        const color = sampler.readColor(u, v);
        if (!color) return null;
        return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a})`;
      },
      terrainSample: (u = 0, v = 0) => {
        const color = sampler.readTerrainColor(u, v);
        if (!color) return null;
        return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a})`;
      }
    };
    this.raceArtTextureCache.set(cacheKey, sampler);
    if (missStartMs > 0) {
      this.raceRuntimeTextureCacheMisses = (Number(this.raceRuntimeTextureCacheMisses) || 0) + 1;
      this.lastRaceRenderStats = {
        ...(this.lastRaceRenderStats || {}),
        textureCacheMisses: this.raceRuntimeTextureCacheMisses,
        textureCacheMissMs: (Number(this.lastRaceRenderStats?.textureCacheMissMs) || 0) + Math.max(0, this.getNowMs() - missStartMs)
      };
    }
    return sampler;
  }

  getRaceSkyboxRenderCanvas(artRef = '') {
    const clean = String(artRef || '').trim();
    if (!clean || typeof document === 'undefined') return null;
    if (this.raceSkyboxRenderCache?.artRef === clean) return this.raceSkyboxRenderCache.canvas || null;
    const source = this.getRaceArtSpriteCanvas(clean);
    if (!source) {
      this.raceSkyboxRenderCache = { artRef: clean, canvas: null };
      return null;
    }
    const sourceW = Math.max(1, Number(source.width) || 1);
    const sourceH = Math.max(1, Number(source.height) || 1);
    const maxW = 512;
    const maxH = 192;
    const scale = Math.min(1, maxW / sourceW, maxH / sourceH);
    const width = Math.max(1, Math.round(sourceW * scale));
    const height = Math.max(1, Math.round(sourceH * scale));
    if (scale >= 0.999) {
      this.raceSkyboxRenderCache = { artRef: clean, canvas: source };
      return source;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const renderCtx = canvas.getContext?.('2d');
    if (!renderCtx || typeof renderCtx.drawImage !== 'function') {
      this.raceSkyboxRenderCache = { artRef: clean, canvas: source };
      return source;
    }
    const previousSmoothing = renderCtx.imageSmoothingEnabled;
    renderCtx.imageSmoothingEnabled = false;
    renderCtx.drawImage(source, 0, 0, width, height);
    renderCtx.imageSmoothingEnabled = previousSmoothing;
    this.raceSkyboxRenderCache = { artRef: clean, canvas };
    return canvas;
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
    const hillPitch = this.clampRaceElevation(currentSegment?.elevation);
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
    const weatherState = this.getRaceWeatherState(this.selectedRace, this.playtestSession);
    const basePalette = this.getRaceRoadSurfacePalette(this.getRaceEffectiveSurfaceId(currentSegment?.surface || 'asphalt', weatherState));
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
      const palette = this.getRaceRoadSurfacePalette(this.getRaceEffectiveSurfaceId(segment.surface, weatherState));
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

  drawRaceParallaxBackground(ctx, bounds, { horizon = 0, cameraYaw = 0, heading = 0, velocityYaw = 0, speedMps = 0, hillPitch = 0, suppressGroundFill = false, groundFillOverride = '' } = {}) {
    const skybox = this.getSelectedRaceSkybox();
    const skyTop = skybox.skyTop;
    const skyBottom = hillPitch > 0.16 ? skybox.uphillSky : hillPitch < -0.14 ? skybox.downhillSky : skybox.skyBottom;
    ctx.fillStyle = skyTop;
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = skyBottom;
    ctx.fillRect(bounds.x, bounds.y + bounds.h * 0.16, bounds.w, Math.max(1, horizon - bounds.y - bounds.h * 0.16));
    const slipYaw = normalizeAngle(Number(velocityYaw || 0) - Number(cameraYaw || 0));
    const normalizedCameraYaw = ((Number(cameraYaw || 0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const continuousCameraYaw = this.getRaceContinuousSkyboxYaw(cameraYaw);
    const yawScroll = continuousCameraYaw / (Math.PI * 2);
    const driftOffset = clamp(slipYaw + Number(heading || 0), -0.85, 0.85) * bounds.w * 0.16;
    const speedShift = clamp(Math.abs(Number(speedMps) || 0) / 60, 0, 1) * bounds.w * 0.04;
    const drewSkyboxArt = this.drawRaceSkyboxArt(ctx, bounds, {
      horizon,
      normalizedCameraYaw: continuousCameraYaw,
      driftOffset,
      hillPitch
    });
    const drawLayer = (count, yRatio, heightRatio, color, alpha, speedScale) => {
      ctx.save();
      ctx.globalAlpha = drewSkyboxArt ? alpha * 0.28 : alpha;
      ctx.fillStyle = color;
      const yBase = bounds.y + bounds.h * yRatio;
      const h = bounds.h * heightRatio;
      for (let index = -1; index <= count + 1; index += 1) {
        const spacing = bounds.w / count;
        const x = bounds.x + (((index - yawScroll * count * speedScale) * spacing + driftOffset + speedShift * speedScale) % (bounds.w + spacing * 2)) - spacing;
        ctx.beginPath();
        ctx.moveTo(x, yBase);
        ctx.lineTo(x + spacing * 0.5, yBase - h * (0.58 + ((index % 3 + 3) % 3) * 0.14));
        ctx.lineTo(x + spacing, yBase);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };
    const drawCardinalLayer = (yRatio, heightRatio, alpha, speedScale) => {
      const cardinals = [
        { key: 'north', yaw: 0, label: 'N' },
        { key: 'east', yaw: Math.PI / 2, label: 'E' },
        { key: 'south', yaw: Math.PI, label: 'S' },
        { key: 'west', yaw: Math.PI * 1.5, label: 'W' }
      ];
      ctx.save();
      ctx.globalAlpha = drewSkyboxArt ? alpha * 0.2 : alpha;
      const yBase = bounds.y + bounds.h * yRatio;
      const h = bounds.h * heightRatio;
      cardinals.forEach((entry) => {
        const delta = normalizeAngle(entry.yaw - normalizedCameraYaw);
        const visibleWindow = Math.PI / 3.4;
        if (Math.abs(delta) > visibleWindow) return;
        const visibility = 1 - Math.abs(delta) / visibleWindow;
        const x = bounds.x + bounds.w / 2 + (delta / visibleWindow) * bounds.w * 0.42 + driftOffset * 0.24;
        ctx.fillStyle = skybox.cardinalColors?.[entry.key] || skybox.farColor;
        ctx.beginPath();
        ctx.moveTo(x - bounds.w * 0.18 * visibility, yBase);
        ctx.lineTo(x, yBase - h * (0.62 + visibility * 0.38));
        ctx.lineTo(x + bounds.w * 0.18 * visibility, yBase);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(217,230,210,${0.18 + visibility * 0.52})`;
        ctx.font = `700 9px ${UI_SUITE.font.family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(entry.label, x, yBase - h - 4, 18);
      });
      ctx.restore();
    };
    if (!drewSkyboxArt) {
      drawLayer(7, 0.38, 0.18, skybox.farColor, 0.48, 0.55);
      drawCardinalLayer(0.44, 0.16, 0.62, 1.7);
      drawLayer(11, 0.5, 0.13, skybox.nearColor, 0.7, 1.1);
    }
    const hazeHeight = Math.max(24, bounds.h * 0.16);
    if (!suppressGroundFill) {
      const groundStart = drewSkyboxArt ? horizon + hazeHeight * 0.18 : horizon;
      ctx.fillStyle = groundFillOverride || skybox.ground;
      ctx.fillRect(bounds.x, groundStart, bounds.w, Math.max(1, bounds.y + bounds.h - groundStart));
    }
    const haze = ctx.createLinearGradient?.(0, horizon - hazeHeight * 0.62, 0, horizon + hazeHeight) || null;
    if (haze) {
      haze.addColorStop(0, 'rgba(217,230,210,0)');
      haze.addColorStop(0.32, 'rgba(245,248,239,0.34)');
      haze.addColorStop(0.58, 'rgba(217,230,210,0.18)');
      haze.addColorStop(1, 'rgba(217,230,210,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(bounds.x, horizon - hazeHeight * 0.62, bounds.w, hazeHeight * 1.62);
    } else {
      ctx.fillStyle = 'rgba(245,248,239,0.28)';
      ctx.fillRect(bounds.x, horizon - 4, bounds.w, 10);
    }
  }

  drawRaceSkyboxArt(ctx, bounds, { horizon = 0, normalizedCameraYaw = 0, driftOffset = 0, hillPitch = 0 } = {}) {
    const artRef = String(this.selectedRace?.skyboxArtRef || this.selectedRace?.visuals?.skyboxArtRef || '').trim();
    const canvas = artRef ? this.getRaceSkyboxRenderCanvas(artRef) : null;
    if (!canvas || typeof ctx.drawImage !== 'function') return false;
    const skyHeight = Math.max(1, horizon - bounds.y + bounds.h * 0.16);
    const aspect = Math.max(0.1, Number(canvas.width || 1) / Math.max(1, Number(canvas.height || 1)));
    const destH = Math.max(skyHeight, bounds.h * 0.58);
    const wrapW = Math.max(bounds.w * 1.35, destH * aspect * 2);
    const pitchOffset = clamp(Number(hillPitch) || 0, -0.4, 0.4) * bounds.h * 0.08;
    const yawTurns = Number(normalizedCameraYaw || 0) / (Math.PI * 2);
    const rawX = bounds.x + yawTurns * wrapW - wrapW * 0.5 + Number(driftOffset || 0) * 0.18;
    const startX = bounds.x + ((((rawX - bounds.x) % wrapW) + wrapW) % wrapW) - wrapW;
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.save();
    ctx.beginPath();
    ctx.rect?.(bounds.x, bounds.y, bounds.w, Math.max(1, horizon - bounds.y + bounds.h * 0.18));
    ctx.clip?.();
    ctx.imageSmoothingEnabled = false;
    for (let x = startX; x < bounds.x + bounds.w + wrapW; x += wrapW) {
      ctx.drawImage(canvas, x, bounds.y + pitchOffset, wrapW, destH);
    }
    ctx.restore();
    ctx.imageSmoothingEnabled = previousSmoothing;
    return true;
  }

  drawRaceWeatherFx(ctx, bounds, weatherState = this.getRaceWeatherState()) {
    if (!weatherState || weatherState.id === 'clear') return false;
    const intensity = clamp(Math.max(Number(weatherState.precipitationIntensity) || 0, Number(weatherState.effectiveIntensity) || 0), 0, 1);
    if (intensity <= 0.02) return false;
    const elapsed = Number(this.playtestSession?.elapsedMs || 0) / 1000;
    const count = Math.round((weatherState.id === 'storm' ? 92 : weatherState.id === 'snow' ? 58 : 64) * intensity);
    ctx.save();
    ctx.beginPath();
    ctx.rect?.(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.clip?.();
    if (weatherState.id === 'snow') {
      ctx.fillStyle = `rgba(238,248,255,${0.28 + intensity * 0.44})`;
      for (let index = 0; index < count; index += 1) {
        const seed = (index * 9301 + 49297) % 233280;
        const x = bounds.x + ((seed / 233280 * bounds.w + Math.sin(elapsed * 0.8 + index) * 18) % bounds.w + bounds.w) % bounds.w;
        const y = bounds.y + (((index * 47 + elapsed * (28 + intensity * 55)) % bounds.h) + bounds.h) % bounds.h;
        const radius = 0.8 + ((index % 4) * 0.35);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const storm = weatherState.id === 'storm';
      ctx.strokeStyle = storm ? `rgba(192,224,245,${0.34 + intensity * 0.36})` : `rgba(176,210,230,${0.24 + intensity * 0.28})`;
      ctx.lineWidth = storm ? 1.4 : 1;
      for (let index = 0; index < count; index += 1) {
        const seed = (index * 110351 + 12345) % 65536;
        const x = bounds.x + (((seed / 65536) * bounds.w + elapsed * (storm ? 150 : 95)) % bounds.w);
        const y = bounds.y + (((index * 29 + elapsed * (storm ? 520 : 360)) % bounds.h) + bounds.h) % bounds.h;
        const len = storm ? 18 + intensity * 16 : 12 + intensity * 10;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * 0.38, y + len);
        ctx.stroke();
      }
    }
    ctx.restore();
    return true;
  }

  drawRaceTireFxParticles(ctx, bounds, { camera = {}, cameraYaw = 0 } = {}) {
    const particles = this.playtestSession?.tireFxParticles;
    if (!Array.isArray(particles) || !particles.length) return false;
    const projected = particles
      .map((particle) => {
        const point = this.projectRaceWorldPointToCamera(particle, camera, cameraYaw, bounds);
        return { particle, point };
      })
      .filter(({ point }) => point?.visible && point.screenY >= bounds.y - 40 && point.screenY <= bounds.y + bounds.h + 60)
      .sort((a, b) => Number(b.point.cameraZ || 0) - Number(a.point.cameraZ || 0));
    if (!projected.length) return false;
    const focal = Math.max(140, Number(bounds.w || 1) * (Number(camera.focalScale) || 1.04));
    const roadWidthScale = Number(camera.roadWidthScale) || 1;
    ctx.save();
    projected.forEach(({ particle, point }) => {
      const life = clamp(Number(particle.ageMs || 0) / Math.max(1, Number(particle.lifetimeMs || 1)), 0, 1);
      const alpha = Number(particle.alpha || 0.5) * (1 - life);
      if (alpha <= 0.01) return;
      const size = clamp(
        Number(particle.sizeM || 0.5) * roadWidthScale * (focal / Math.max(1.2, Number(point.renderZ || point.cameraZ || 1))) * (1 + life * 1.2),
        2,
        bounds.w * 0.22
      );
      const artCanvas = particle.artRef ? this.getRaceArtSpriteCanvas(particle.artRef) : null;
      ctx.globalAlpha = alpha;
      if (artCanvas && typeof ctx.drawImage === 'function') {
        const previousSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(artCanvas, point.screenX - size * 0.5, point.screenY - size * 0.55, size, size);
        ctx.imageSmoothingEnabled = previousSmoothing;
      } else {
        ctx.fillStyle = particle.color || 'rgba(228,232,222,0.72)';
        ctx.beginPath();
        ctx.ellipse?.(point.screenX, point.screenY - size * 0.18, size * 0.55, size * 0.26, 0, 0, Math.PI * 2);
        if (!ctx.ellipse) ctx.arc(point.screenX, point.screenY, size * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
    return true;
  }

  drawRaceProjectedQuad(ctx, bounds, points = [], fillStyle = '#315734') {
    if (!Array.isArray(points) || points.length < 3) return false;
    const bottom = Number(bounds.y || 0) + Number(bounds.h || 0) + 2;
    const top = Number(bounds.y || 0) - Number(bounds.h || 0) * 0.35;
    const sanitized = points.map((point) => ({
      x: Number(point?.screenX),
      y: clamp(Number(point?.screenY), top, bottom),
      cameraZ: Number(point?.cameraZ ?? point?.renderZ ?? 0),
      clippedToNearPlane: Boolean(point?.clippedToNearPlane),
      visible: Boolean(point?.visible || point?.clippedToNearPlane)
    }));
    if (sanitized.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
    if (!sanitized.some((point) => point.visible)) return false;
    const clippedCount = sanitized.filter((point) => point.clippedToNearPlane).length;
    const ySpan = Math.max(...sanitized.map((point) => point.y)) - Math.min(...sanitized.map((point) => point.y));
    const xSpan = Math.max(...sanitized.map((point) => point.x)) - Math.min(...sanitized.map((point) => point.x));
    if (clippedCount >= 2 && ySpan < Math.max(3, Number(bounds.h || 1) * 0.018) && xSpan > Number(bounds.w || 1) * 0.32) return false;
    const hugeNearCameraPlane = clippedCount >= 2
      && xSpan > Number(bounds.w || 1) * 1.75
      && ySpan > Number(bounds.h || 1) * 0.72;
    if (hugeNearCameraPlane) return false;
    let area = 0;
    for (let index = 0; index < sanitized.length; index += 1) {
      const current = sanitized[index];
      const next = sanitized[(index + 1) % sanitized.length];
      area += current.x * next.y - next.x * current.y;
    }
    if (Math.abs(area) < 0.7) return false;
    ctx.fillStyle = fillStyle || '#315734';
    ctx.beginPath();
    ctx.moveTo(sanitized[0].x, sanitized[0].y);
    sanitized.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fill();
    return true;
  }

  drawRaceProjectedVehicleQuad(ctx, bounds, points = [], fillStyle = '#58d6ff') {
    if (!Array.isArray(points) || points.length < 3) return false;
    const sanitized = points.map((point) => ({
      x: Number(point?.screenX),
      y: Number(point?.screenY),
      visible: Boolean(point?.visible || point?.clippedToNearPlane)
    }));
    if (sanitized.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
    if (!sanitized.some((point) => point.visible)) return false;
    const minX = Math.min(...sanitized.map((point) => point.x));
    const maxX = Math.max(...sanitized.map((point) => point.x));
    const minY = Math.min(...sanitized.map((point) => point.y));
    const maxY = Math.max(...sanitized.map((point) => point.y));
    if (maxX < Number(bounds.x || 0) - Number(bounds.w || 0) * 0.5
      || minX > Number(bounds.x || 0) + Number(bounds.w || 0) * 1.5
      || maxY < Number(bounds.y || 0) - Number(bounds.h || 0) * 0.5
      || minY > Number(bounds.y || 0) + Number(bounds.h || 0) * 1.9) {
      return false;
    }
    let area = 0;
    for (let index = 0; index < sanitized.length; index += 1) {
      const current = sanitized[index];
      const next = sanitized[(index + 1) % sanitized.length];
      area += current.x * next.y - next.x * current.y;
    }
    if (Math.abs(area) < 0.7) return false;
    ctx.fillStyle = fillStyle || '#58d6ff';
    ctx.beginPath();
    ctx.moveTo(sanitized[0].x, sanitized[0].y);
    sanitized.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fill();
    return true;
  }

  drawRaceProjectedTexturedQuad(ctx, bounds, points = [], fillStyle = '#315734', artRef = '', {
    camera = null,
    tileWorldM = 2.5,
    maxLateralSteps = 14,
    maxLongitudinalSteps = 10,
    textureAlpha = 0.82,
    textureFootprint = 0
  } = {}) {
    const clippedPoints = camera ? this.getRaceNearClippedProjectedPolygon(points, camera, bounds) : points;
    const drewBase = this.drawRaceProjectedQuad(ctx, bounds, clippedPoints, fillStyle);
    const clean = String(artRef || '').trim();
    if (!drewBase || !clean) return drewBase;
    const sampler = this.getRaceArtTextureSampler(clean);
    if (!sampler || !Array.isArray(points) || points.length !== 4) return drewBase;
    if (points.some((point) => !Number.isFinite(point?.screenX) || !Number.isFinite(point?.screenY))) return drewBase;
    const screenArea = Math.abs(points.reduce((area, point, index) => {
      const next = points[(index + 1) % points.length];
      return area + Number(point.screenX || 0) * Number(next.screenY || 0) - Number(next.screenX || 0) * Number(point.screenY || 0);
    }, 0)) / 2;
    if (screenArea < 4) return drewBase;
    const lerpPoint = (a = {}, b = {}, t = 0) => ({
      screenX: Number(a.screenX || 0) + (Number(b.screenX || 0) - Number(a.screenX || 0)) * t,
      screenY: Number(a.screenY || 0) + (Number(b.screenY || 0) - Number(a.screenY || 0)) * t,
      x: Number(a.x || 0) + (Number(b.x || 0) - Number(a.x || 0)) * t,
      z: Number(a.z || 0) + (Number(b.z || 0) - Number(a.z || 0)) * t,
      visible: Boolean(a.visible || b.visible || a.clippedToNearPlane || b.clippedToNearPlane)
    });
    const pointAt = (u = 0, v = 0) => {
      const left = lerpPoint(points[0], points[3], v);
      const right = lerpPoint(points[1], points[2], v);
      return lerpPoint(left, right, u);
    };
    const maxSpan = Math.max(
      Math.hypot(Number(points[1].screenX || 0) - Number(points[0].screenX || 0), Number(points[1].screenY || 0) - Number(points[0].screenY || 0)),
      Math.hypot(Number(points[2].screenX || 0) - Number(points[3].screenX || 0), Number(points[2].screenY || 0) - Number(points[3].screenY || 0))
    );
    const longitudinalSpan = Math.max(
      Math.hypot(Number(points[3].screenX || 0) - Number(points[0].screenX || 0), Number(points[3].screenY || 0) - Number(points[0].screenY || 0)),
      Math.hypot(Number(points[2].screenX || 0) - Number(points[1].screenX || 0), Number(points[2].screenY || 0) - Number(points[1].screenY || 0))
    );
    const lateralStepLimit = Math.max(1, Number(maxLateralSteps) || 14);
    const longitudinalStepLimit = Math.max(1, Number(maxLongitudinalSteps) || 10);
    const lateralSteps = clamp(Math.ceil(maxSpan / 14), 1, lateralStepLimit);
    const longitudinalSteps = clamp(Math.ceil(longitudinalSpan / 16), 1, longitudinalStepLimit);
    ctx.save();
    ctx.globalAlpha = clamp(Number(textureAlpha) || 0.82, 0.1, 1);
    ctx.imageSmoothingEnabled = false;
    const tileScale = Math.max(0.5, Number(tileWorldM) || 2.5);
    for (let row = 0; row < longitudinalSteps; row += 1) {
      const v0 = row / longitudinalSteps;
      const v1 = (row + 1) / longitudinalSteps;
      for (let col = 0; col < lateralSteps; col += 1) {
        const u0 = col / lateralSteps;
        const u1 = (col + 1) / lateralSteps;
        const corners = [
          pointAt(u0, v0),
          pointAt(u1, v0),
          pointAt(u1, v1),
          pointAt(u0, v1)
        ];
        const center = pointAt((u0 + u1) / 2, (v0 + v1) / 2);
        const u = Number(center.x || 0) / tileScale;
        const v = Number(center.z || 0) / tileScale;
        const color = textureFootprint > 0 && typeof sampler.averageSample === 'function'
          ? sampler.averageSample(u, v, textureFootprint)
          : sampler.sample(u, v);
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(corners[0].screenX, corners[0].screenY);
        ctx.lineTo(corners[1].screenX, corners[1].screenY);
        ctx.lineTo(corners[2].screenX, corners[2].screenY);
        ctx.lineTo(corners[3].screenX, corners[3].screenY);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
    return true;
  }

  lerpRaceProjectedPoint(a = {}, b = {}, t = 0) {
    return {
      ...a,
      screenX: Number(a.screenX || 0) + (Number(b.screenX || 0) - Number(a.screenX || 0)) * t,
      screenY: Number(a.screenY || 0) + (Number(b.screenY || 0) - Number(a.screenY || 0)) * t,
      x: Number(a.x || 0) + (Number(b.x || 0) - Number(a.x || 0)) * t,
      z: Number(a.z || 0) + (Number(b.z || 0) - Number(a.z || 0)) * t,
      elevation: Number(a.elevation || 0) + (Number(b.elevation || 0) - Number(a.elevation || 0)) * t,
      cameraX: Number(a.cameraX || 0) + (Number(b.cameraX || 0) - Number(a.cameraX || 0)) * t,
      cameraY: Number(a.cameraY || 0) + (Number(b.cameraY || 0) - Number(a.cameraY || 0)) * t,
      cameraZ: Number(a.cameraZ || 0) + (Number(b.cameraZ || 0) - Number(a.cameraZ || 0)) * t,
      renderZ: Number(a.renderZ || 0) + (Number(b.renderZ || 0) - Number(a.renderZ || 0)) * t,
      visible: Boolean(a.visible || b.visible),
      clippedToNearPlane: Boolean(a.clippedToNearPlane || b.clippedToNearPlane)
    };
  }

  drawRaceProjectedBoundaryStrip(ctx, bounds, near = null, far = null, { camera = null } = {}) {
    if (!this.isRaceMarginVisible()) return false;
    const segment = near?.center?.segment || far?.center?.segment || this.selectedSegment;
    if (!near?.left || !near?.right || !far?.left || !far?.right) return false;
    const roadWidth = Math.max(0.1, this.getRaceRoadHalfWidthWorld(segment) * 2);
    const insetRatio = clamp(this.getRaceBoundaryWidthWorld(segment) / roadWidth, 0.006, 0.12);
    const artRef = this.getRaceBoundaryArtRef(segment);
    const color = artRef ? 'rgba(241,244,239,0.58)' : 'rgba(241,244,239,0.92)';
    const leftNearInner = this.lerpRaceProjectedPoint(near.left, near.right, insetRatio);
    const leftFarInner = this.lerpRaceProjectedPoint(far.left, far.right, insetRatio);
    const rightNearInner = this.lerpRaceProjectedPoint(near.right, near.left, insetRatio);
    const rightFarInner = this.lerpRaceProjectedPoint(far.right, far.left, insetRatio);
    const drewLeft = this.drawRaceProjectedTexturedQuad(
      ctx,
      bounds,
      [far.left, leftFarInner, leftNearInner, near.left],
      color,
      artRef,
      { camera, tileWorldM: 2.5 }
    );
    const drewRight = this.drawRaceProjectedTexturedQuad(
      ctx,
      bounds,
      [rightFarInner, far.right, near.right, rightNearInner],
      color,
      artRef,
      { camera, tileWorldM: 2.5 }
    );
    return drewLeft || drewRight;
  }

  drawRaceWebGLBoundaryStrip(ctx, bounds, renderer = null, near = null, far = null, { camera = null, cameraYaw = 0, minScreenY = null } = {}) {
    const meshes = this.getRaceWebGLBoundaryStripMeshes(near, far, { minScreenY });
    return this.drawRaceWebGLWorldMeshBatch(ctx, bounds, renderer, meshes, { camera, cameraYaw });
  }

  getRaceWebGLBoundaryStripMeshes(near = null, far = null, { minScreenY = null } = {}) {
    if (!this.isRaceMarginVisible()) return [];
    if (!near?.left || !near?.right || !far?.left || !far?.right) return [];
    const segment = near?.center?.segment || far?.center?.segment || this.selectedSegment;
    const artRef = this.getRaceBoundaryArtRef(segment);
    const color = artRef ? 'rgba(241,244,239,0.58)' : 'rgba(241,244,239,0.92)';
    const nearMarginLeft = near.marginLeft || near.left;
    const farMarginLeft = far.marginLeft || far.left;
    const nearMarginRight = near.marginRight || near.right;
    const farMarginRight = far.marginRight || far.right;
    return [
      {
        source: 'boundary-left',
        points: [farMarginLeft, far.left, near.left, nearMarginLeft],
        color,
        artRef,
        textured: Boolean(artRef),
        textureWorldM: 2.5,
        depthOffset: -0.095,
        threeLiftM: RACE_THREE_LIFTS_M.boundary,
        minScreenY
      },
      {
        source: 'boundary-right',
        points: [far.right, farMarginRight, nearMarginRight, near.right],
        color,
        artRef,
        textured: Boolean(artRef),
        textureWorldM: 2.5,
        depthOffset: -0.095,
        threeLiftM: RACE_THREE_LIFTS_M.boundary,
        minScreenY
      }
    ];
  }

  getRaceTileMapArtRefAtWorldPoint(worldPoint = null) {
    const cell = this.getRaceTileMapCellAtWorldPoint(worldPoint);
    return String(cell?.artRef || '').trim();
  }

  getRaceVisibleProjectedTileMapCells(bounds, { camera = null, cameraYaw = 0 } = {}) {
    const tileMap = this.ensureRaceTileMap();
    if (!tileMap || !camera) return [];
    const cellSize = Math.max(1, Number(tileMap.cellSizeM) || RACE_TILE_MAP_CELL_SIZE_M);
    const right = this.getRaceRightVector(cameraYaw);
    const forward = this.getRaceForwardVector(cameraYaw);
    const maxDistance = 260;
    const cells = Object.entries(tileMap.cells || {})
      .map(([key, cell]) => {
        const artRef = String(cell?.artRef || cell?.tileArtRef || '').trim();
        if (!artRef) return null;
        const [cellX, cellY] = key.split(',').map((value) => Math.trunc(Number(value) || 0));
        const centerX = (cellX + 0.5) * cellSize;
        const centerZ = (cellY + 0.5) * cellSize;
        const dx = centerX - Number(camera.x || 0);
        const dz = centerZ - Number(camera.z || 0);
        const cameraX = dx * right.x + dz * right.z;
        const cameraZ = dx * forward.x + dz * forward.z;
        if (cameraZ < -cellSize * 1.5 || cameraZ > maxDistance) return null;
        const lateralLimit = Math.max(52, cameraZ * 1.18 + Number(bounds.w || 1) * 0.16);
        if (Math.abs(cameraX) > lateralLimit + cellSize * 2) return null;
        return {
          key,
          cellX,
          cellY,
          cell: this.getRaceTileMapCell(cellX, cellY, tileMap),
          artRef,
          centerX,
          centerZ,
          cameraX,
          cameraZ: Math.max(0, cameraZ)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.cameraZ - b.cameraZ);
    const limited = cells.slice(0, 240);
    return limited.sort((a, b) => b.cameraZ - a.cameraZ);
  }

  getRaceProjectedTileTextureDetail(cameraZ = 0) {
    const z = Math.max(0, Number(cameraZ) || 0);
    if (z > 170) {
      return { drawTexture: false, lateralSteps: 1, longitudinalSteps: 1, textureAlpha: 0.18, footprint: 0.16 };
    }
    if (z > 92) {
      return { drawTexture: true, lateralSteps: 1, longitudinalSteps: 1, textureAlpha: 0.34, footprint: 0.13 };
    }
    if (z > 44) {
      return { drawTexture: true, lateralSteps: 2, longitudinalSteps: 2, textureAlpha: 0.58, footprint: 0.07 };
    }
    return { drawTexture: true, lateralSteps: 5, longitudinalSteps: 5, textureAlpha: 0.9, footprint: 0.015 };
  }

  getRaceDominantGroundArtRef(tileMap = this.ensureRaceTileMap()) {
    return this.getRaceTileMapStats(tileMap).dominantArtRef;
  }

  getRaceTileMapStats(tileMap = this.ensureRaceTileMap()) {
    if (!tileMap) return { dominantArtRef: '', hasPaintedTerrainCells: false, cellCount: 0 };
    if (!this.raceTileMapStatsCache) this.raceTileMapStatsCache = new WeakMap();
    const revision = Number(tileMap.revision) || 0;
    const cached = this.raceTileMapStatsCache.get(tileMap);
    if (cached && cached.revision === revision) return cached;
    const counts = new Map();
    let cellCount = 0;
    let hasPaintedTerrainCells = false;
    Object.values(tileMap.cells || {}).forEach((cell) => {
      cellCount += 1;
      if (cell?.explicit || cell?.artRef || cell?.tileArtRef) hasPaintedTerrainCells = true;
      const artRef = String(cell?.artRef || cell?.tileArtRef || '').trim();
      if (!artRef) return;
      counts.set(artRef, (counts.get(artRef) || 0) + 1);
    });
    const stats = {
      revision,
      dominantArtRef: [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '',
      hasPaintedTerrainCells,
      cellCount
    };
    this.raceTileMapStatsCache.set(tileMap, stats);
    return stats;
  }

  getRaceTerrainBakeKey(tileMap = this.ensureRaceTileMap(), terrainSize = 40) {
    const rawPoints = this.getRaceRawMapPoints();
    const pointKey = rawPoints
      .map((point) => [
        Math.round(Number(point.x || 0) * 10),
        Math.round(Number(point.y ?? point.z ?? 0) * 10),
        Math.round(Number(point.elevation || 0) * 1000)
      ].join(':'))
      .join('|');
    const segmentKey = (this.selectedRace?.road?.segments || [])
      .map((segment) => [
        Math.round(Number(segment.roadWidthM || 0) * 100),
        Math.round(Number(segment.shoulderWidthM || 0) * 100),
        String(segment.surface || '')
      ].join(':'))
      .join('|');
    return [
      this.selectedRace?.id || 'race',
      Number(tileMap?.revision) || 0,
      Math.round(Number(terrainSize || 40) * 100),
      Math.round(this.getRaceGroundTextureBaseWorldM() * 1000),
      pointKey,
      segmentKey
    ].join('::');
  }

  getRaceTerrainBakeCache(tileMap = this.ensureRaceTileMap(), terrainSize = 40) {
    const key = this.getRaceTerrainBakeKey(tileMap, terrainSize);
    if (!this.raceTerrainBakeCache || this.raceTerrainBakeCache.key !== key) {
      this.raceTerrainBakeCache = {
        key,
        terrainSize: Math.max(1, Number(terrainSize) || 40),
        tileMapRevision: Number(tileMap?.revision) || 0,
        chunks: new Map(),
        frameHits: 0,
        frameGenerated: 0
      };
    }
    this.raceTerrainBakeCache.frameHits = 0;
    this.raceTerrainBakeCache.frameGenerated = 0;
    return this.raceTerrainBakeCache;
  }

  getRaceBakedTerrainChunk(cellX = 0, cellZ = 0, terrainSize = 40, tileMap = this.ensureRaceTileMap(), cache = this.getRaceTerrainBakeCache(tileMap, terrainSize)) {
    if (!tileMap || !cache) return null;
    const chunkKey = `${Math.trunc(Number(cellX) || 0)},${Math.trunc(Number(cellZ) || 0)}`;
    const cached = cache.chunks.get(chunkKey);
    if (cached) {
      cache.frameHits += 1;
      return cached;
    }
    const size = Math.max(1, Number(terrainSize) || 40);
    const x0 = Math.trunc(Number(cellX) || 0) * size;
    const z0 = Math.trunc(Number(cellZ) || 0) * size;
    const x1 = x0 + size;
    const z1 = z0 + size;
    const centerX = (x0 + x1) * 0.5;
    const centerZ = (z0 + z1) * 0.5;
    const centerCoords = this.getRaceTileMapCellCoords({ x: centerX, z: centerZ }, tileMap);
    const centerTileCell = this.getRaceTileMapCell(centerCoords.cellX, centerCoords.cellY, tileMap);
    const tileCoverage = this.getRaceTerrainChunkTileCoverage(x0, z0, x1, z1, tileMap, centerTileCell);
    const tileCell = tileCoverage.tileCell || centerTileCell;
    const fullPoints = [
      { x: x0, z: z0, elevation: this.getRaceGroundElevationAtWorldPoint({ x: x0, z: z0 }, 0) },
      { x: x1, z: z0, elevation: this.getRaceGroundElevationAtWorldPoint({ x: x1, z: z0 }, 0) },
      { x: x1, z: z1, elevation: this.getRaceGroundElevationAtWorldPoint({ x: x1, z: z1 }, 0) },
      { x: x0, z: z1, elevation: this.getRaceGroundElevationAtWorldPoint({ x: x0, z: z1 }, 0) }
    ];
    const centerElevation = this.getRaceGroundElevationAtWorldPoint({ x: centerX, z: centerZ }, 0);
    const edgeElevations = [
      this.getRaceGroundElevationAtWorldPoint({ x: centerX, z: z0 }, 0),
      this.getRaceGroundElevationAtWorldPoint({ x: x1, z: centerZ }, 0),
      this.getRaceGroundElevationAtWorldPoint({ x: centerX, z: z1 }, 0),
      this.getRaceGroundElevationAtWorldPoint({ x: x0, z: centerZ }, 0)
    ];
    const elevations = [...fullPoints.map((point) => Number(point.elevation || 0)), centerElevation, ...edgeElevations];
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const proximityPoints = [
      { x: centerX, z: centerZ },
      { x: x0, z: z0 },
      { x: x1, z: z0 },
      { x: x1, z: z1 },
      { x: x0, z: z1 },
      { x: centerX, z: z0 },
      { x: x1, z: centerZ },
      { x: centerX, z: z1 },
      { x: x0, z: centerZ }
    ];
    let nearestRoute = {
      roadDistance: Infinity,
      corridorDistance: Infinity,
      roadHalfWidth: this.getRaceRoadHalfWidthWorld(),
      marginWidth: 0,
      shoulderWidth: this.getRaceShoulderWidthWorld()
    };
    proximityPoints.forEach((point) => {
      const projection = this.getRaceRouteProjectionForWorldPoint(point);
      if (!projection?.segment || !Number.isFinite(Number(projection.lateral))) return;
      const roadHalfWidth = this.getRaceRoadHalfWidthWorld(projection.segment);
      const marginWidth = this.isRaceMarginEnabled() ? this.getRaceBoundaryWidthWorld(projection.segment) : 0;
      const shoulderWidth = this.getRaceShoulderWidthWorld(projection.segment);
      const absLateral = Math.abs(Number(projection.lateral || 0));
      const roadDistance = Math.max(0, absLateral - roadHalfWidth);
      const corridorDistance = Math.max(0, absLateral - roadHalfWidth - marginWidth - shoulderWidth);
      if (corridorDistance < nearestRoute.corridorDistance || roadDistance < nearestRoute.roadDistance) {
        nearestRoute = { roadDistance, corridorDistance, roadHalfWidth, marginWidth, shoulderWidth };
      }
    });
    const roadDistance = nearestRoute.roadDistance;
    const shoulderWidth = nearestRoute.shoulderWidth;
    const chunk = {
      key: chunkKey,
      x0,
      z0,
      x1,
      z1,
      centerX,
      centerZ,
      tileCell,
      tileCoverage,
      fullPoints,
      minElevation,
      maxElevation,
      elevationVariance: maxElevation - minElevation,
      roadDistance,
      corridorDistance: nearestRoute.corridorDistance,
      roadHalfWidth: nearestRoute.roadHalfWidth,
      marginWidth: nearestRoute.marginWidth,
      shoulderWidth,
      nearRoad: nearestRoute.corridorDistance <= 22,
      roadAdjacent: nearestRoute.corridorDistance <= 86,
      quadCache: new Map()
    };
    cache.chunks.set(chunkKey, chunk);
    cache.frameGenerated += 1;
    return chunk;
  }

  getRaceTerrainChunkTileCoverage(x0 = 0, z0 = 0, x1 = 0, z1 = 0, tileMap = this.ensureRaceTileMap(), fallbackTileCell = null) {
    if (!tileMap) {
      return {
        tileCell: fallbackTileCell,
        explicitCount: 0,
        paintedCount: 0,
        sampledCount: 0
      };
    }
    const cellSize = Math.max(1, Number(tileMap.cellSizeM) || RACE_TILE_MAP_CELL_SIZE_M);
    const minCellX = Math.floor(Math.min(Number(x0) || 0, Number(x1) || 0) / cellSize);
    const maxCellX = Math.floor((Math.max(Number(x0) || 0, Number(x1) || 0) - 0.001) / cellSize);
    const minCellY = Math.floor(Math.min(Number(z0) || 0, Number(z1) || 0) / cellSize);
    const maxCellY = Math.floor((Math.max(Number(z0) || 0, Number(z1) || 0) - 0.001) / cellSize);
    const counts = new Map();
    let explicitCount = 0;
    let paintedCount = 0;
    let sampledCount = 0;
    let firstPaintedCell = null;
    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        sampledCount += 1;
        const cell = this.getRaceTileMapCell(cellX, cellY, tileMap);
        if (!cell) continue;
        const isPainted = Boolean(cell.explicit || cell.artRef || cell.tileArtRef);
        if (cell.explicit) explicitCount += 1;
        if (!isPainted) continue;
        paintedCount += 1;
        if (!firstPaintedCell) firstPaintedCell = cell;
        const key = `${cell.artRef || cell.tileArtRef || ''}|${cell.tileId || tileMap.defaultTileId || 'grass'}`;
        const entry = counts.get(key) || { count: 0, cell };
        entry.count += 1;
        counts.set(key, entry);
      }
    }
    let dominant = null;
    counts.forEach((entry) => {
      if (!dominant || entry.count > dominant.count) dominant = entry;
    });
    return {
      tileCell: dominant?.cell || firstPaintedCell || fallbackTileCell,
      explicitCount,
      paintedCount,
      sampledCount
    };
  }

  getRacePaintedTerrainChunkKeys(tileMap = this.ensureRaceTileMap(), terrainSize = 40) {
    const keys = new Set();
    if (!tileMap?.cells || typeof tileMap.cells !== 'object') return keys;
    const cellSize = Math.max(1, Number(tileMap.cellSizeM) || RACE_TILE_MAP_CELL_SIZE_M);
    const size = Math.max(1, Number(terrainSize) || 40);
    Object.entries(tileMap.cells).forEach(([key, cell]) => {
      if (!cell || (!cell.explicit && !cell.artRef && !cell.tileArtRef)) return;
      const [cellX, cellY] = String(key).split(',').map((value) => Number(value));
      if (!Number.isFinite(cellX) || !Number.isFinite(cellY)) return;
      keys.add(`${Math.floor(cellX * cellSize / size)},${Math.floor(cellY * cellSize / size)}`);
    });
    return keys;
  }

  getRaceTerrainCameraBounds(points = [], camera = {}, rightVector = { x: 1, z: 0 }, forwardVector = { x: 0, z: 1 }) {
    const bounds = {
      minCameraX: Infinity,
      maxCameraX: -Infinity,
      minCameraZ: Infinity,
      maxCameraZ: -Infinity,
      averageCameraZ: 0,
      count: 0
    };
    if (!Array.isArray(points) || !points.length) return bounds;
    const cameraXWorld = Number(camera?.x || 0);
    const cameraZWorld = Number(camera?.z || 0);
    const rightX = Number(rightVector.x || 0);
    const rightZ = Number(rightVector.z || 0);
    const forwardX = Number(forwardVector.x || 0);
    const forwardZ = Number(forwardVector.z || 0);
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex];
      const dx = Number(point?.x || 0) - cameraXWorld;
      const dz = Number(point?.z || 0) - cameraZWorld;
      const cameraX = dx * rightX + dz * rightZ;
      const cameraZ = dx * forwardX + dz * forwardZ;
      if (cameraX < bounds.minCameraX) bounds.minCameraX = cameraX;
      if (cameraX > bounds.maxCameraX) bounds.maxCameraX = cameraX;
      if (cameraZ < bounds.minCameraZ) bounds.minCameraZ = cameraZ;
      if (cameraZ > bounds.maxCameraZ) bounds.maxCameraZ = cameraZ;
      bounds.averageCameraZ += cameraZ;
      bounds.count += 1;
    }
    bounds.averageCameraZ /= Math.max(1, bounds.count);
    return bounds;
  }

  isRaceTerrainCameraBoundsVisible(bounds = {}, {
    terrainSize = 40,
    terrainForwardDistance = 880,
    screenWidth = 390,
    forwardMargin = 0,
    lateralMargin = 0
  } = {}) {
    if (!Number.isFinite(Number(bounds.minCameraX))
      || !Number.isFinite(Number(bounds.maxCameraX))
      || !Number.isFinite(Number(bounds.minCameraZ))
      || !Number.isFinite(Number(bounds.maxCameraZ))) {
      return false;
    }
    const size = Math.max(1, Number(terrainSize) || 40);
    const farDistance = Math.max(size, Number(terrainForwardDistance) || 880);
    const maxAbsZ = Math.max(Math.abs(Number(bounds.minCameraZ || 0)), Math.abs(Number(bounds.maxCameraZ || 0)));
    const lateralLimit = Math.max(320, maxAbsZ * 2.15 + Number(screenWidth || 1) * 0.55) + Math.max(0, Number(lateralMargin) || 0);
    return Number(bounds.maxCameraZ) >= -size * 4 - Math.max(0, Number(forwardMargin) || 0)
      && Number(bounds.minCameraZ) <= farDistance + size * 2 + Math.max(0, Number(forwardMargin) || 0)
      && Number(bounds.minCameraX) <= lateralLimit
      && Number(bounds.maxCameraX) >= -lateralLimit;
  }

  getRaceBakedTerrainQuadPoints(chunk = null, subX = 0, subZ = 0, subdivisions = 1) {
    if (!chunk) return [];
    const steps = Math.max(1, Math.round(Number(subdivisions) || 1));
    if (steps === 1) return chunk.fullPoints;
    const key = `${steps}:${Math.trunc(Number(subX) || 0)},${Math.trunc(Number(subZ) || 0)}`;
    const cached = chunk.quadCache?.get?.(key);
    if (cached) return cached;
    const stepX = (Number(chunk.x1 || 0) - Number(chunk.x0 || 0)) / steps;
    const stepZ = (Number(chunk.z1 || 0) - Number(chunk.z0 || 0)) / steps;
    const x0 = Number(chunk.x0 || 0) + Math.trunc(Number(subX) || 0) * stepX;
    const z0 = Number(chunk.z0 || 0) + Math.trunc(Number(subZ) || 0) * stepZ;
    const x1 = x0 + stepX;
    const z1 = z0 + stepZ;
    const points = [
      { x: x0, z: z0, elevation: this.getRaceGroundElevationAtWorldPoint({ x: x0, z: z0 }, 0) },
      { x: x1, z: z0, elevation: this.getRaceGroundElevationAtWorldPoint({ x: x1, z: z0 }, 0) },
      { x: x1, z: z1, elevation: this.getRaceGroundElevationAtWorldPoint({ x: x1, z: z1 }, 0) },
      { x: x0, z: z1, elevation: this.getRaceGroundElevationAtWorldPoint({ x: x0, z: z1 }, 0) }
    ];
    chunk.quadCache?.set?.(key, points);
    return points;
  }

  isRaceTerrainQuadInsideRoadCorridor(points = [], {
    tolerance = 1.25,
    runtimeType = this.getActiveRaceRuntimeType(),
    includeTransition = true
  } = {}) {
    if (!Array.isArray(points) || points.length < 4) return false;
    const center = {
      x: points.reduce((sum, point) => sum + Number(point?.x || 0), 0) / points.length,
      z: points.reduce((sum, point) => sum + Number(point?.z ?? point?.y ?? 0), 0) / points.length
    };
    const projection = this.getRaceRouteProjectionForWorldPoint(center);
    if (!projection?.segment || !Number.isFinite(Number(projection.lateral))) return false;
    const corridor = this.getRaceRoadCorridorSampleAtDistance(Number(projection.distance || 0), { runtimeType });
    const metrics = this.getRaceTrackCorridorMetrics(corridor, corridor.segment || projection.segment);
    const cutoffHalfWidth = (includeTransition ? metrics.outerHalfWidth : metrics.hardHalfWidth)
      + Math.max(0, Number(tolerance) || 0);
    if (Math.abs(Number(projection.lateral || 0)) > cutoffHalfWidth) return false;
    return points.some((point) => {
      const pointProjection = this.getRaceRouteProjectionForWorldPoint({
        x: Number(point.x || 0),
        z: Number(point.z ?? point.y ?? 0)
      });
      if (!pointProjection?.segment || !Number.isFinite(Number(pointProjection.lateral))) return true;
      const pointCorridor = this.getRaceRoadCorridorSampleAtDistance(Number(pointProjection.distance || 0), { runtimeType });
      const pointMetrics = this.getRaceTrackCorridorMetrics(pointCorridor, pointCorridor.segment || pointProjection.segment);
      const pointCutoff = (includeTransition ? pointMetrics.outerHalfWidth : pointMetrics.hardHalfWidth)
        + Math.max(0, Number(tolerance) || 0);
      return Math.abs(Number(pointProjection.lateral || 0)) <= pointCutoff;
    });
  }

  getRaceTerrainTrianglesOutsideTrackCorridor(points = [], {
    runtimeType = this.getActiveRaceRuntimeType(),
    routeLength = this.getRaceRouteLength(),
    includeTransition = true,
    seamVertexCache = null
  } = {}) {
    return getRaceTerrainTrianglesOutsideTrackCorridorModule(points, {
      runtimeType,
      routeLength,
      includeTransition,
      adapter: this.getRaceTerrainClippingAdapter({ seamVertexCache, routeLength, runtimeType })
    });
  }

  getRaceTerrainTriangleArea(points = []) {
    return getRaceTerrainTriangleAreaModule(points);
  }

  triangulateRaceTerrainPolygon(polygon = []) {
    return triangulateRaceTerrainPolygonModule(polygon);
  }

  clipRaceTerrainTriangleOutsideTrackCorridor(triangle = [], {
    runtimeType = this.getActiveRaceRuntimeType(),
    routeLength = this.getRaceRouteLength(),
    includeTransition = true,
    seamVertexCache = null
  } = {}) {
    return clipRaceTerrainTriangleOutsideTrackCorridorModule(triangle, {
      runtimeType,
      routeLength,
      includeTransition,
      adapter: this.getRaceTerrainClippingAdapter({ seamVertexCache, routeLength, runtimeType })
    });
  }

  getRaceTerrainClippingAdapter({ seamVertexCache = null, routeLength = this.getRaceRouteLength(), runtimeType = this.getActiveRaceRuntimeType() } = {}) {
    const seamCache = seamVertexCache || new Map();
    return {
      getRouteLength: () => this.getRaceRouteLength(),
      projectWorldToTrack: (point) => this.getRaceRouteProjectionForWorldPoint(point),
      getSurfaceSectionAtDistance: (distance, options) => this.getRaceSurfaceSectionAtDistance(distance, options),
      getCorridorMetrics: (sample, segment) => this.getRaceTrackCorridorMetrics(sample, segment),
      getRightVector: (yaw) => this.getRaceRightVector(yaw),
      getForwardVector: (yaw) => this.getRaceForwardVector(yaw),
      clampElevation: (value) => this.clampRaceElevation(value),
      getVisualDistanceRange: () => this.getRaceVisualDistanceRange({ routeLength, runtimeType }),
      weldSeamPoint: (point = {}, { distance = point.terrainClipDistance, side = point.lateralOffset < 0 ? 'left' : 'right' } = {}) => {
        const key = [
          side,
          Math.round(Number(distance || 0) * 1000),
          Math.round(Number(point.x || 0) * 1000),
          Math.round(Number(point.z ?? point.y ?? 0) * 1000)
        ].join(':');
        const cached = seamCache.get(key);
        if (cached) return cached;
        seamCache.set(key, point);
        return point;
      }
    };
  }

  getRaceRoadbedTerrainSubdivision(chunk = null, terrainSize = 40) {
    if (!chunk?.roadAdjacent) return 1;
    const size = Math.max(1, Number(terrainSize) || 40);
    const target = chunk.nearRoad ? 14 : 24;
    return clamp(Math.ceil(size / target), 1, chunk.nearRoad ? 8 : 5);
  }

  getRaceTerrainRenderLimits({
    terrainSize = 80,
    roadFarCameraZ = 560,
    detailEnabled = false,
    terrainBudgetEnabled = true
  } = {}) {
    const size = Math.max(1, Number(terrainSize) || 80);
    const requestedFar = Math.max(560, Number(roadFarCameraZ) || 560);
    const terrainForwardDistance = clamp(requestedFar + size * 8, 2200, 5200);
    const radiusMax = detailEnabled ? 36 : (terrainForwardDistance > 2800 ? 30 : 16);
    const terrainCellRadius = clamp(Math.ceil(terrainForwardDistance / size) + 3, 10, radiusMax);
    const maxTerrainTriangles = terrainBudgetEnabled
      ? (detailEnabled ? 7200 : 5600)
      : Number.POSITIVE_INFINITY;
    return {
      terrainForwardDistance,
      terrainCellRadius,
      maxTerrainCells: maxTerrainTriangles,
      maxTerrainTriangles
    };
  }

  shouldIncludeRaceTerrainChunkForRendering(chunk = null) {
    return Boolean(chunk);
  }

  getRaceBakedTerrainSubdivision(chunk = null, cameraCellZ = 0, { cameraCellX = 0, detailEnabled = false, textured = false } = {}) {
    if (!detailEnabled || !chunk) return 1;
    if (textured) {
      const roadDistance = Number(chunk.roadDistance || 0);
      let subdivisions = chunk.nearRoad ? 3 : (chunk.roadAdjacent ? (roadDistance <= 92 ? 3 : 2) : 1);
      if (!chunk.nearRoad && roadDistance > 170) subdivisions = 1;
      const variance = Number(chunk.elevationVariance || 0);
      if (variance > 0.08) subdivisions = Math.max(subdivisions, 4);
      else if (variance > 0.035) subdivisions = Math.max(subdivisions, 3);
      return clamp(Math.round(subdivisions), 1, 4);
    }
    const z = Math.max(0, Number(cameraCellZ) || 0);
    const roadDistance = Number(chunk.roadDistance || 0);
    let subdivisions = z < 96 ? 4 : (z < 210 ? 3 : (z < 380 ? 2 : 1));
    if (!chunk.nearRoad) {
      if (roadDistance > 170) subdivisions = Math.min(subdivisions, 1);
      else if (roadDistance > 92) subdivisions = Math.min(subdivisions, 2);
      else subdivisions = Math.min(subdivisions, 3);
    }
    const variance = Number(chunk.elevationVariance || 0);
    if (z < 260 && variance > 0.08) subdivisions = Math.max(subdivisions, 4);
    else if (z < 320 && variance > 0.035) subdivisions = Math.max(subdivisions, 3);
    if (chunk.nearRoad && z < 520) subdivisions = Math.max(subdivisions, z < 260 ? 3 : 2);
    else if (chunk.roadAdjacent && z < 420) subdivisions = Math.max(subdivisions, 2);
    if (z > 520) subdivisions = 1;
    return clamp(Math.round(subdivisions), 1, 4);
  }

  getRaceTerrainCandidatePriority(candidate = {}, terrainSize = 40) {
    const cameraCellZ = Number(candidate.cameraCellZ || 0);
    const cameraCellX = Number(candidate.cameraCellX || 0);
    const chunk = candidate.chunk || {};
    const roadRank = chunk.nearRoad ? 0 : (chunk.roadAdjacent ? 1 : 2);
    const behindPenalty = cameraCellZ < -terrainSize ? 500000 : 0;
    const lateralPenalty = Math.abs(cameraCellX) * (roadRank === 0 ? 0.85 : 1.1);
    const forwardPenalty = cameraCellZ >= 0 ? cameraCellZ * (roadRank === 0 ? 0.72 : 0.94) : Math.abs(cameraCellZ) * 8;
    const routePenalty = Math.min(260, Math.max(0, Number(chunk.roadDistance || 0))) * 0.9;
    return behindPenalty + roadRank * 550 + routePenalty + lateralPenalty + forwardPenalty;
  }

  compareRaceTerrainCandidates(a = {}, b = {}, terrainSize = 40) {
    const priorityA = this.getRaceTerrainCandidatePriority(a, terrainSize);
    const priorityB = this.getRaceTerrainCandidatePriority(b, terrainSize);
    if (Math.abs(priorityA - priorityB) > 0.0001) return priorityA - priorityB;
    const zDelta = Number(a.cameraCellZ || 0) - Number(b.cameraCellZ || 0);
    if (Math.abs(zDelta) > 0.0001) return zDelta;
    const xDelta = Number(a.cameraCellX || 0) - Number(b.cameraCellX || 0);
    if (Math.abs(xDelta) > 0.0001) return xDelta;
    return String(a.chunk?.key || '').localeCompare(String(b.chunk?.key || ''));
  }

  screenToRaceGroundWorldPoint(screenX = 0, screenY = 0, bounds = {}, { camera = {}, cameraYaw = 0 } = {}) {
    const h = Number(bounds.h || 1);
    const horizon = Number(bounds.y || 0) + h * (Number(camera.horizonRatio) || 0.31);
    const roadDepth = Math.max(1, h * (Number(camera.roadDepthRatio) || 0.7));
    const nearPlane = Math.max(1.2, Number(camera.nearPlane) || 1.6);
    const nearDepth = Math.max(nearPlane, 6.8);
    const perspective = clamp((Number(screenY || 0) - horizon) / roadDepth, 0.0008, 0.995);
    const z = clamp(nearDepth / Math.pow(perspective, 1 / 0.542) - nearDepth, nearPlane, 560);
    const focal = Math.max(140, Number(bounds.w || 1) * (Number(camera.focalScale) || 1.04));
    const roadWidthScale = Number(camera.roadWidthScale) || 2.2;
    const cameraX = (Number(screenX || 0) - (Number(bounds.x || 0) + Number(bounds.w || 1) / 2)) * z / Math.max(0.001, roadWidthScale * focal);
    const right = this.getRaceRightVector(cameraYaw);
    const forward = this.getRaceForwardVector(cameraYaw);
    return {
      x: Number(camera.x || 0) + right.x * cameraX + forward.x * z,
      z: Number(camera.z || 0) + right.z * cameraX + forward.z * z,
      cameraZ: z
    };
  }

  getRaceProjectedTerrainTop(bounds = {}, camera = {}) {
    const h = Number(bounds.h || 1);
    const horizon = Number(bounds.y || 0) + h * (Number(camera.horizonRatio) || 0.31);
    return clamp(
      Math.floor(horizon),
      Number(bounds.y || 0),
      Number(bounds.y || 0) + h
    );
  }

  parseRaceCssColor(color = '#315734') {
    const text = String(color || '').trim();
    const rgba = text.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);
    if (rgba) {
      return [
        clamp((Number(rgba[1]) || 0) / 255, 0, 1),
        clamp((Number(rgba[2]) || 0) / 255, 0, 1),
        clamp((Number(rgba[3]) || 0) / 255, 0, 1),
        clamp(rgba[4] === undefined ? 1 : Number(rgba[4]) || 0, 0, 1)
      ];
    }
    const hex = text.startsWith('#') ? text.slice(1) : text;
    if (hex.length === 3 || hex.length === 4) {
      return [
        parseInt(hex[0] + hex[0], 16) / 255,
        parseInt(hex[1] + hex[1], 16) / 255,
        parseInt(hex[2] + hex[2], 16) / 255,
        hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1
      ].map((value, index) => index === 3 ? clamp(value, 0, 1) : clamp(value || 0, 0, 1));
    }
    if (hex.length >= 6) {
      return [
        clamp((parseInt(hex.slice(0, 2), 16) || 0) / 255, 0, 1),
        clamp((parseInt(hex.slice(2, 4), 16) || 0) / 255, 0, 1),
        clamp((parseInt(hex.slice(4, 6), 16) || 0) / 255, 0, 1),
        hex.length >= 8 ? clamp((parseInt(hex.slice(6, 8), 16) || 0) / 255, 0, 1) : 1
      ];
    }
    return [0.192, 0.341, 0.204, 1];
  }

  getRaceWebGLColorArray(color = '#ffffff') {
    const key = String(color || '#ffffff');
    if (!this.raceWebGLColorCache) this.raceWebGLColorCache = new Map();
    const cached = this.raceWebGLColorCache.get(key);
    if (cached) return cached;
    if (this.raceWebGLColorCache.size > 240) this.raceWebGLColorCache.clear();
    const rgba = new Float32Array(this.parseRaceCssColor(key));
    this.raceWebGLColorCache.set(key, rgba);
    return rgba;
  }

  getNowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : 0;
  }

  applyRaceWebGLTextureSettings(renderer = null, {
    canMipmap = false,
    wrap = null,
    filterMode = this.getRaceGroundTextureFilterMode(),
    nearQuality = this.getRaceGroundNearTextureQuality(),
    stats = null
  } = {}) {
    const gl = renderer?.gl;
    if (!gl) return;
    const mode = RACE_GROUND_TEXTURE_FILTER_MODE_IDS.has(String(filterMode)) ? String(filterMode) : RACE_GROUND_TEXTURE_FILTER_DEFAULT;
    const minFilter = mode === 'smooth'
      ? (canMipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR)
      : mode === 'balanced'
        ? (canMipmap ? gl.NEAREST_MIPMAP_LINEAR : gl.NEAREST)
        : (canMipmap ? gl.NEAREST_MIPMAP_NEAREST : gl.NEAREST);
    const magFilter = mode === 'smooth' ? gl.LINEAR : gl.NEAREST;
    const resolvedWrap = wrap ?? (canMipmap ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    const quality = clamp(
      Number(nearQuality) || RACE_GROUND_NEAR_TEXTURE_QUALITY_DEFAULT,
      RACE_GROUND_NEAR_TEXTURE_QUALITY_MIN,
      RACE_GROUND_NEAR_TEXTURE_QUALITY_MAX
    );
    const paramsKey = `${mode}:${canMipmap ? 1 : 0}:${resolvedWrap}:${Math.round(quality * 10)}`;
    if (renderer.textureParamsKey === paramsKey) {
      if (stats) {
        stats.textureFilterMode = mode;
        stats.nearTextureQuality = quality;
        stats.textureAnisotropy = Number(renderer.textureAnisotropy || 1);
      }
      return;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, resolvedWrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, resolvedWrap);
    let anisotropy = 1;
    if (mode !== 'crisp') {
      const ext = renderer.textureAnisotropyExt
        || gl.getExtension?.('EXT_texture_filter_anisotropic')
        || gl.getExtension?.('WEBKIT_EXT_texture_filter_anisotropic')
        || gl.getExtension?.('MOZ_EXT_texture_filter_anisotropic');
      renderer.textureAnisotropyExt = ext || null;
      if (ext) {
        const max = Number(gl.getParameter?.(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) || 1;
        anisotropy = clamp(Math.round(quality), 1, Math.max(1, max));
        gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
      }
    }
    renderer.textureParamsKey = paramsKey;
    renderer.textureAnisotropy = anisotropy;
    if (stats) {
      stats.textureFilterMode = mode;
      stats.nearTextureQuality = quality;
      stats.textureAnisotropy = anisotropy;
      stats.textureParamUpdates = (Number(stats.textureParamUpdates) || 0) + 1;
    }
  }

  getRaceWebGLTargetSize(renderer = null, width = 1, height = 1) {
    const gl = renderer?.gl;
    let targetWidth = Math.max(1, Math.round(Number(width) || 1));
    let targetHeight = Math.max(1, Math.round(Number(height) || 1));
    if (!gl) return { width: targetWidth, height: targetHeight, scale: 1 };
    const viewportDims = gl.getParameter?.(gl.MAX_VIEWPORT_DIMS);
    const viewportW = Number(viewportDims?.[0]) || 16384;
    const viewportH = Number(viewportDims?.[1]) || 9216;
    const textureMax = Number(gl.getParameter?.(gl.MAX_TEXTURE_SIZE)) || 16384;
    const renderbufferMax = Number(gl.getParameter?.(gl.MAX_RENDERBUFFER_SIZE)) || textureMax;
    const maxW = Math.max(1, Math.min(viewportW, textureMax, renderbufferMax, 32768));
    const maxH = Math.max(1, Math.min(viewportH, textureMax, renderbufferMax, 18432));
    const scale = Math.min(1, maxW / targetWidth, maxH / targetHeight);
    if (scale < 1) {
      targetWidth = Math.max(1, Math.floor(targetWidth * scale));
      targetHeight = Math.max(1, Math.floor(targetHeight * scale));
    }
    return { width: targetWidth, height: targetHeight, scale };
  }

  getRaceWebGLGroundRenderer(width = 1, height = 1) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    let renderer = this.raceWebGLGroundRenderer;
    if (!renderer) {
      const canvas = document.createElement('canvas');
      const contextOptions = { alpha: true, antialias: false, depth: true, stencil: false, preserveDrawingBuffer: false };
      const gl = canvas.getContext?.('webgl', contextOptions)
        || canvas.getContext?.('experimental-webgl', contextOptions);
      if (!gl) {
        this.raceWebGLGroundRenderer = { unavailable: true };
        return null;
      }
      const compileShader = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
        return shader;
      };
      const vertexShader = compileShader(gl.VERTEX_SHADER, `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main() {
          vUv = aPosition * 0.5 + 0.5;
          gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `);
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform vec2 uTextureWorldM;
        uniform vec2 uCameraXZ;
        uniform float uCameraYaw;
        uniform float uHorizonRatio;
        uniform float uGroundTopRatio;
        uniform float uRoadDepthRatio;
        uniform float uNearPlane;
        uniform float uLateralScale;
        void main() {
          float screenFromTop = 1.0 - vUv.y;
          float screenRatio = mix(uGroundTopRatio, 1.0, screenFromTop);
          float perspective = clamp((screenRatio - uHorizonRatio) / max(0.0001, uRoadDepthRatio), 0.0008, 0.995);
          float nearDepth = max(uNearPlane, 6.8);
          float z = clamp(nearDepth / pow(perspective, 1.0 / 0.542) - nearDepth, uNearPlane, 560.0);
          float lateral = (vUv.x * 2.0 - 1.0) * z * uLateralScale;
          vec2 local = vec2(lateral, z);
          float cy = cos(uCameraYaw);
          float sy = sin(uCameraYaw);
          vec2 world = uCameraXZ + vec2(cy * local.x + sy * local.y, -sy * local.x + cy * local.y);
          vec2 textureWorld = max(uTextureWorldM, vec2(0.0001));
          vec2 texUv = vec2(fract(world.x / textureWorld.x), fract(-world.y / textureWorld.y));
          gl_FragColor = texture2D(uTexture, texUv);
        }
      `);
      if (!vertexShader || !fragmentShader) {
        this.raceWebGLGroundRenderer = { unavailable: true };
        return null;
      }
      const colorVertexShader = compileShader(gl.VERTEX_SHADER, `
        attribute vec2 aPosition;
        void main() {
          gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `);
      const colorFragmentShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        uniform vec4 uColor;
        void main() {
          gl_FragColor = uColor;
        }
      `);
      if (!colorVertexShader || !colorFragmentShader) {
        this.raceWebGLGroundRenderer = { unavailable: true };
        return null;
      }
      const meshVertexShader = compileShader(gl.VERTEX_SHADER, `
        precision highp float;
        attribute vec2 aPosition;
        attribute float aDepth;
        attribute vec2 aTexCoordOverDepth;
        attribute float aInvDepth;
        varying vec2 vTexCoordOverDepth;
        varying float vInvDepth;
        void main() {
          vTexCoordOverDepth = aTexCoordOverDepth;
          vInvDepth = aInvDepth;
          gl_Position = vec4(aPosition, aDepth, 1.0);
        }
      `);
      const meshFragmentShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        varying vec2 vTexCoordOverDepth;
        varying float vInvDepth;
        uniform sampler2D uTexture;
        uniform vec4 uTint;
        uniform float uUseTexture;
        void main() {
          if (uUseTexture > 0.5) {
            vec2 uv = vTexCoordOverDepth / max(vInvDepth, 0.000001);
            gl_FragColor = texture2D(uTexture, uv) * uTint;
          } else {
            gl_FragColor = uTint;
          }
        }
      `);
      if (!meshVertexShader || !meshFragmentShader) {
        this.raceWebGLGroundRenderer = { unavailable: true };
        return null;
      }
      const terrainVertexShader = compileShader(gl.VERTEX_SHADER, `
        precision highp float;
        attribute vec3 aWorldPosition;
        attribute vec2 aTexCoord;
        attribute vec4 aTint;
        varying vec2 vTexCoord;
        varying vec4 vTint;
        uniform vec3 uCameraPosition;
        uniform float uCameraYaw;
        uniform vec2 uViewport;
        uniform float uFocal;
        uniform float uRoadWidthScale;
        uniform float uHorizonRatio;
        uniform float uRoadDepthRatio;
        uniform float uNearPlane;
        uniform float uFarPlane;
        void main() {
          vec3 delta = aWorldPosition - uCameraPosition;
          float cy = cos(uCameraYaw);
          float sy = sin(uCameraYaw);
          float cameraX = delta.x * -cy + delta.z * sy;
          float cameraZ = delta.x * sy + delta.z * cy;
          float cameraY = delta.y;
          float z = max(cameraZ, 0.0001);
          float perspective = pow(max(uNearPlane, 6.8) / (z + max(uNearPlane, 6.8)), 0.542);
          float screenX = uViewport.x * 0.5 + cameraX * uRoadWidthScale * (uFocal / max(uNearPlane, z));
          float screenY = uViewport.y * uHorizonRatio + uViewport.y * uRoadDepthRatio * perspective - cameraY * uViewport.y * (0.22 + 1.42 * perspective);
          float clipX = (screenX / max(1.0, uViewport.x)) * 2.0 - 1.0;
          float clipY = 1.0 - (screenY / max(1.0, uViewport.y)) * 2.0;
          float clipZ = ((cameraZ - uNearPlane) / max(0.0001, uFarPlane - uNearPlane)) * 2.0 - 1.0;
          gl_Position = vec4(clipX * z, clipY * z, clipZ * z, z);
          vTexCoord = aTexCoord;
          vTint = aTint;
        }
      `);
      const terrainFragmentShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        varying vec2 vTexCoord;
        varying vec4 vTint;
        uniform sampler2D uTexture;
        uniform float uUseTexture;
        void main() {
          if (uUseTexture > 0.5) {
            gl_FragColor = texture2D(uTexture, vTexCoord) * vTint;
          } else {
            gl_FragColor = vTint;
          }
        }
      `);
      if (!terrainVertexShader || !terrainFragmentShader) {
        this.raceWebGLGroundRenderer = { unavailable: true };
        return null;
      }
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        this.raceWebGLGroundRenderer = { unavailable: true };
        return null;
      }
      const colorProgram = gl.createProgram();
      gl.attachShader(colorProgram, colorVertexShader);
      gl.attachShader(colorProgram, colorFragmentShader);
      gl.linkProgram(colorProgram);
      if (!gl.getProgramParameter(colorProgram, gl.LINK_STATUS)) {
        this.raceWebGLGroundRenderer = { unavailable: true };
        return null;
      }
      const meshProgram = gl.createProgram();
      gl.attachShader(meshProgram, meshVertexShader);
      gl.attachShader(meshProgram, meshFragmentShader);
      gl.linkProgram(meshProgram);
      if (!gl.getProgramParameter(meshProgram, gl.LINK_STATUS)) {
        this.raceWebGLGroundRenderer = { unavailable: true };
        return null;
      }
      const terrainProgram = gl.createProgram();
      gl.attachShader(terrainProgram, terrainVertexShader);
      gl.attachShader(terrainProgram, terrainFragmentShader);
      gl.linkProgram(terrainProgram);
      if (!gl.getProgramParameter(terrainProgram, gl.LINK_STATUS)) {
        this.raceWebGLGroundRenderer = { unavailable: true };
        return null;
      }
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1
      ]), gl.STATIC_DRAW);
      const colorBuffer = gl.createBuffer();
      const meshBuffer = gl.createBuffer();
      const terrainBuffer = gl.createBuffer();
      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([255, 255, 255, 255])
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      renderer = {
        canvas,
        gl,
        program,
        colorProgram,
        meshProgram,
        terrainProgram,
        buffer,
        colorBuffer,
        meshBuffer,
        terrainBuffer,
        meshUploadArray: null,
        meshUploadCapacity: 0,
        meshBufferCapacity: 0,
        terrainUploadArray: null,
        terrainUploadCapacity: 0,
        terrainBufferCapacity: 0,
        meshBlendEnabled: false,
        texture,
        textureCache: new Map(),
        textureKey: '',
        locations: {
          position: gl.getAttribLocation(program, 'aPosition'),
          textureWorldM: gl.getUniformLocation(program, 'uTextureWorldM'),
          cameraXZ: gl.getUniformLocation(program, 'uCameraXZ'),
          cameraYaw: gl.getUniformLocation(program, 'uCameraYaw'),
          horizonRatio: gl.getUniformLocation(program, 'uHorizonRatio'),
          groundTopRatio: gl.getUniformLocation(program, 'uGroundTopRatio'),
          roadDepthRatio: gl.getUniformLocation(program, 'uRoadDepthRatio'),
          nearPlane: gl.getUniformLocation(program, 'uNearPlane'),
          lateralScale: gl.getUniformLocation(program, 'uLateralScale'),
          textureSampler: gl.getUniformLocation(program, 'uTexture')
        },
        colorLocations: {
          position: gl.getAttribLocation(colorProgram, 'aPosition'),
          color: gl.getUniformLocation(colorProgram, 'uColor')
        },
        meshLocations: {
          position: gl.getAttribLocation(meshProgram, 'aPosition'),
          depth: gl.getAttribLocation(meshProgram, 'aDepth'),
          texCoord: gl.getAttribLocation(meshProgram, 'aTexCoordOverDepth'),
          invDepth: gl.getAttribLocation(meshProgram, 'aInvDepth'),
          textureSampler: gl.getUniformLocation(meshProgram, 'uTexture'),
          tint: gl.getUniformLocation(meshProgram, 'uTint'),
          useTexture: gl.getUniformLocation(meshProgram, 'uUseTexture')
        },
        terrainLocations: {
          worldPosition: gl.getAttribLocation(terrainProgram, 'aWorldPosition'),
          texCoord: gl.getAttribLocation(terrainProgram, 'aTexCoord'),
          tint: gl.getAttribLocation(terrainProgram, 'aTint'),
          textureSampler: gl.getUniformLocation(terrainProgram, 'uTexture'),
          useTexture: gl.getUniformLocation(terrainProgram, 'uUseTexture'),
          cameraPosition: gl.getUniformLocation(terrainProgram, 'uCameraPosition'),
          cameraYaw: gl.getUniformLocation(terrainProgram, 'uCameraYaw'),
          viewport: gl.getUniformLocation(terrainProgram, 'uViewport'),
          focal: gl.getUniformLocation(terrainProgram, 'uFocal'),
          roadWidthScale: gl.getUniformLocation(terrainProgram, 'uRoadWidthScale'),
          horizonRatio: gl.getUniformLocation(terrainProgram, 'uHorizonRatio'),
          roadDepthRatio: gl.getUniformLocation(terrainProgram, 'uRoadDepthRatio'),
          nearPlane: gl.getUniformLocation(terrainProgram, 'uNearPlane'),
          farPlane: gl.getUniformLocation(terrainProgram, 'uFarPlane')
        }
      };
      this.raceWebGLGroundRenderer = renderer;
    }
    if (renderer.unavailable || !renderer.gl) return null;
    const target = this.getRaceWebGLTargetSize(renderer, width, height);
    const targetWidth = target.width;
    const targetHeight = target.height;
    renderer.lastTargetScale = target.scale;
    if (renderer.canvas.width !== targetWidth) renderer.canvas.width = targetWidth;
    if (renderer.canvas.height !== targetHeight) renderer.canvas.height = targetHeight;
    return renderer;
  }

  drawRaceWebGLGroundPlane(ctx, bounds, { camera = null, cameraYaw = 0, drawToContext = true } = {}) {
    if (!ctx || !camera || !['webgl', 'webgl-track'].includes(this.getRaceGroundRenderer())) return false;
    const tileMap = this.ensureRaceTileMap();
    const fallbackArtRef = this.getRaceDominantGroundArtRef(tileMap);
    const artCanvas = fallbackArtRef ? this.getRaceArtSpriteCanvas(fallbackArtRef) : null;
    if (!artCanvas || typeof ctx.drawImage !== 'function') return false;
    const h = Number(bounds.h || 1);
    const groundTop = this.getRaceProjectedTerrainTop(bounds, camera);
    const groundHeight = Math.max(1, Math.ceil(Number(bounds.y || 0) + h - groundTop));
    const scanlineSettings = this.getRaceGroundScanlineSettings();
    const renderWidth = clamp(Math.round(Number(bounds.w || 1) * scanlineSettings.resolution), 1, 2560);
    const renderHeight = clamp(Math.ceil(groundHeight), 1, 2048);
    const renderer = this.getRaceWebGLGroundRenderer(renderWidth, renderHeight);
    if (!renderer) return false;
    const { gl } = renderer;
    const textureKey = `${fallbackArtRef}:${Number(artCanvas.width || 0)}x${Number(artCanvas.height || 0)}`;
    gl.useProgram(renderer.program);
    gl.viewport(0, 0, renderWidth, renderHeight);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffer);
    gl.enableVertexAttribArray(renderer.locations.position);
    gl.vertexAttribPointer(renderer.locations.position, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, renderer.texture);
    const powerOfTwo = (value) => value > 0 && (value & (value - 1)) === 0;
    const canMipmap = powerOfTwo(Number(artCanvas.width || 0)) && powerOfTwo(Number(artCanvas.height || 0));
    const wrap = canMipmap ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    if (renderer.textureKey !== textureKey) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artCanvas);
      if (canMipmap) gl.generateMipmap(gl.TEXTURE_2D);
      renderer.textureKey = textureKey;
    }
    this.applyRaceWebGLTextureSettings(renderer, {
      canMipmap,
      wrap,
      filterMode: this.getRaceGroundTextureFilterMode(),
      nearQuality: this.getRaceGroundNearTextureQuality()
    });
    const baseWorldM = this.getRaceGroundTextureBaseWorldM();
    const textureWorldW = Math.max(baseWorldM, (Number(artCanvas.width || 1) / RACE_GROUND_TEXTURE_BASE_PX) * baseWorldM);
    const textureWorldH = Math.max(baseWorldM, (Number(artCanvas.height || 1) / RACE_GROUND_TEXTURE_BASE_PX) * baseWorldM);
    const horizonRatio = Number(camera.horizonRatio) || 0.31;
    const groundTopRatio = clamp((groundTop - Number(bounds.y || 0)) / Math.max(1, Number(bounds.h || 1)), 0, 1);
    const roadDepthRatio = Number(camera.roadDepthRatio) || 0.7;
    const nearPlane = Math.max(1.2, Number(camera.nearPlane) || 1.6);
    const focal = Math.max(140, Number(bounds.w || 1) * (Number(camera.focalScale) || 1.04));
    const roadWidthScale = Number(camera.roadWidthScale) || 2.2;
    const lateralScale = (Number(bounds.w || 1) * 0.5) / Math.max(0.001, roadWidthScale * focal);
    gl.uniform1i(renderer.locations.textureSampler, 0);
    gl.uniform2f(renderer.locations.textureWorldM, textureWorldW, textureWorldH);
    gl.uniform2f(renderer.locations.cameraXZ, Number(camera.x || 0), Number(camera.z || 0));
    gl.uniform1f(renderer.locations.cameraYaw, Number(cameraYaw || 0));
    gl.uniform1f(renderer.locations.horizonRatio, horizonRatio);
    gl.uniform1f(renderer.locations.groundTopRatio, groundTopRatio);
    gl.uniform1f(renderer.locations.roadDepthRatio, roadDepthRatio);
    gl.uniform1f(renderer.locations.nearPlane, nearPlane);
    gl.uniform1f(renderer.locations.lateralScale, lateralScale);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (!drawToContext) {
      renderer.groundDrawBounds = { x: bounds.x, y: groundTop, w: bounds.w, h: groundHeight };
      return renderer;
    }
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(renderer.canvas, bounds.x, groundTop, bounds.w, groundHeight);
    ctx.imageSmoothingEnabled = previousSmoothing;
    return true;
  }

  getRaceProjectedPolygonForWebGL(points = [], camera = {}, cameraYaw = 0, bounds = {}) {
    if (!Array.isArray(points) || points.length < 3) return [];
    const nearPlane = Math.max(1.2, Number(camera?.nearPlane) || 1.6);
    const projectedPoints = points
      .map((point) => this.projectRaceWorldPointToCamera(point, camera, cameraYaw, bounds))
      .filter((point) => point && Number.isFinite(point.cameraZ));
    if (projectedPoints.length < 3) return [];
    if (projectedPoints.every((point) => Number(point.cameraZ || 0) < nearPlane)) return [];
    const clipPoint = (from = {}, to = {}) => this.interpolateRaceNearPlaneClipPoint(from, to, nearPlane, camera, bounds);
    const clipped = [];
    for (let index = 0; index < projectedPoints.length; index += 1) {
      const current = projectedPoints[index];
      const previous = projectedPoints[(index + projectedPoints.length - 1) % projectedPoints.length];
      const currentInside = Number(current.cameraZ || 0) >= nearPlane;
      const previousInside = Number(previous.cameraZ || 0) >= nearPlane;
      if (currentInside !== previousInside) clipped.push(clipPoint(previous, current));
      if (currentInside) clipped.push(current);
    }
    return clipped
      .map((point) => {
        const clipX = ((Number(point.screenX || 0) - Number(bounds.x || 0)) / Math.max(1, Number(bounds.w || 1))) * 2 - 1;
        const clipY = 1 - ((Number(point.screenY || 0) - Number(bounds.y || 0)) / Math.max(1, Number(bounds.h || 1))) * 2;
        return { ...point, clipX, clipY };
      })
      .filter((point) => Number.isFinite(point.clipX) && Number.isFinite(point.clipY));
  }

  interpolateRaceNearPlaneClipPoint(from = {}, to = {}, nearPlane = 1.6, camera = {}, bounds = {}) {
    const fromZ = Number(from.cameraZ || 0);
    const toZ = Number(to.cameraZ || 0);
    const denominator = toZ - fromZ;
    const t = Math.abs(denominator) > 0.0001 ? clamp((Number(nearPlane) - fromZ) / denominator, 0, 1) : 0;
    const linear = (key) => Number(from[key] || 0) + (Number(to[key] || 0) - Number(from[key] || 0)) * t;
    const point = {
      ...to,
      x: linear('x'),
      z: linear('z'),
      elevation: linear('elevation'),
      cameraX: linear('cameraX'),
      cameraY: linear('cameraY'),
      cameraZ: Number(nearPlane),
      renderZ: Number(nearPlane),
      distance: linear('distance'),
      routeDistance: linear('routeDistance'),
      clippedToNearPlane: true,
      visible: true
    };
    return this.projectRaceCameraSpacePointToScreen(point, camera, bounds);
  }

  interpolateRaceProjectedPointPerspective(from = {}, to = {}, t = 0, bounds = {}) {
    const amount = clamp(Number(t) || 0, 0, 1);
    const fromDepth = Math.max(0.000001, Number(from.renderZ || from.cameraZ || 1));
    const toDepth = Math.max(0.000001, Number(to.renderZ || to.cameraZ || 1));
    const fromInvDepth = 1 / fromDepth;
    const toInvDepth = 1 / toDepth;
    const mixedInvDepth = fromInvDepth + (toInvDepth - fromInvDepth) * amount;
    const perspective = (key) => {
      const a = Number(from[key] || 0);
      const b = Number(to[key] || 0);
      return ((a * fromInvDepth) + ((b * toInvDepth) - (a * fromInvDepth)) * amount) / Math.max(0.000001, mixedInvDepth);
    };
    const linear = (key) => Number(from[key] || 0) + (Number(to[key] || 0) - Number(from[key] || 0)) * amount;
    const point = {
      ...to,
      x: perspective('x'),
      z: perspective('z'),
      elevation: perspective('elevation'),
      cameraX: perspective('cameraX'),
      cameraY: perspective('cameraY'),
      cameraZ: 1 / Math.max(0.000001, mixedInvDepth),
      renderZ: 1 / Math.max(0.000001, mixedInvDepth),
      screenX: linear('screenX'),
      screenY: linear('screenY'),
      distance: perspective('distance'),
      routeDistance: perspective('routeDistance'),
      depthOffset: linear('depthOffset'),
      clippedToScreenY: true,
      visible: true
    };
    point.clipX = ((Number(point.screenX || 0) - Number(bounds.x || 0)) / Math.max(1, Number(bounds.w || 1))) * 2 - 1;
    point.clipY = 1 - ((Number(point.screenY || 0) - Number(bounds.y || 0)) / Math.max(1, Number(bounds.h || 1))) * 2;
    return point;
  }

  clipRaceWebGLProjectedPolygonToScreenY(projected = [], minScreenY = null, bounds = {}, { stats = null } = {}) {
    const floorY = Number(minScreenY);
    if (!Array.isArray(projected) || projected.length < 3 || !Number.isFinite(floorY)) return projected;
    const interpolate = (from = {}, to = {}) => {
      const fromY = Number(from.screenY || 0);
      const toY = Number(to.screenY || 0);
      const denominator = toY - fromY;
      const t = Math.abs(denominator) > 0.0001 ? clamp((floorY - fromY) / denominator, 0, 1) : 0;
      const point = this.interpolateRaceProjectedPointPerspective(from, to, t, bounds);
      point.screenY = floorY;
      point.clipY = 1 - ((floorY - Number(bounds.y || 0)) / Math.max(1, Number(bounds.h || 1))) * 2;
      if (stats) stats.terrainPerspectiveClipVertices = (Number(stats.terrainPerspectiveClipVertices) || 0) + 1;
      return point;
    };
    const clipped = [];
    for (let index = 0; index < projected.length; index += 1) {
      const current = projected[index];
      const previous = projected[(index + projected.length - 1) % projected.length];
      if (!current || !previous) continue;
      const currentInside = Number(current.screenY || 0) >= floorY;
      const previousInside = Number(previous.screenY || 0) >= floorY;
      if (currentInside !== previousInside) clipped.push(interpolate(previous, current));
      if (currentInside) clipped.push(current);
    }
    return clipped.filter((point) => Number.isFinite(point.clipX) && Number.isFinite(point.clipY));
  }

  projectRaceWorldPointToWebGLClip(point = {}, camera = {}, cameraYaw = 0, bounds = {}) {
    const projected = this.projectRaceWorldPointToCamera(point, camera, cameraYaw, bounds);
    if (!projected?.visible && !projected?.clippedToNearPlane) return null;
    const x = ((Number(projected.screenX || 0) - Number(bounds.x || 0)) / Math.max(1, Number(bounds.w || 1))) * 2 - 1;
    const y = 1 - ((Number(projected.screenY || 0) - Number(bounds.y || 0)) / Math.max(1, Number(bounds.h || 1))) * 2;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { ...projected, clipX: x, clipY: y };
  }

  drawRaceWebGLWorldMesh(ctx, bounds, renderer = null, points = [], {
    camera = null,
    cameraYaw = 0,
    textureWorldM = 2.5,
    color = '#ffffff',
    textured = true,
    projectedPolygon = null,
    depthOffset = 0,
    elevationOffset = 0,
    minScreenY = null
  } = {}) {
    const gl = renderer?.gl;
    if (!gl || !renderer.meshProgram || !Array.isArray(points) || points.length < 3) return false;
    const vertices = this.getRaceWebGLWorldMeshVertices(bounds, points, {
      camera,
      cameraYaw,
      textureWorldM,
      textured,
      projectedPolygon,
      depthOffset,
      elevationOffset,
      minScreenY
    });
    if (!vertices.length) return false;
    return this.drawRaceWebGLMeshVertices(renderer, vertices, {
      color,
      textured
    });
  }

  getRaceProjectedPolygonArea(projected = []) {
    if (!Array.isArray(projected) || projected.length < 3) return 0;
    let area = 0;
    for (let index = 0; index < projected.length; index += 1) {
      const current = projected[index];
      const next = projected[(index + 1) % projected.length];
      area += Number(current?.clipX || 0) * Number(next?.clipY || 0);
      area -= Number(next?.clipX || 0) * Number(current?.clipY || 0);
    }
    return area * 0.5;
  }

  dedupeRaceProjectedPolygon(projected = [], epsilon = 0.0005) {
    if (!Array.isArray(projected)) return [];
    const deduped = [];
    projected.forEach((point) => {
      if (!point || !Number.isFinite(Number(point.clipX)) || !Number.isFinite(Number(point.clipY))) return;
      const previous = deduped[deduped.length - 1];
      if (previous
        && Math.abs(Number(previous.clipX || 0) - Number(point.clipX || 0)) <= epsilon
        && Math.abs(Number(previous.clipY || 0) - Number(point.clipY || 0)) <= epsilon) {
        return;
      }
      deduped.push(point);
    });
    while (deduped.length > 2) {
      const first = deduped[0];
      const last = deduped[deduped.length - 1];
      if (Math.abs(Number(first.clipX || 0) - Number(last.clipX || 0)) > epsilon
        || Math.abs(Number(first.clipY || 0) - Number(last.clipY || 0)) > epsilon) {
        break;
      }
      deduped.pop();
    }
    return deduped;
  }

  getRaceProjectedPolygonCentroid(projected = []) {
    const count = Math.max(1, projected.length);
    const centroid = {
      clipX: 0,
      clipY: 0,
      screenX: 0,
      screenY: 0,
      cameraZ: 0,
      x: 0,
      z: 0,
      elevation: 0,
      visible: true
    };
    projected.forEach((point) => {
      centroid.clipX += Number(point.clipX || 0);
      centroid.clipY += Number(point.clipY || 0);
      centroid.screenX += Number(point.screenX || 0);
      centroid.screenY += Number(point.screenY || 0);
      centroid.cameraZ += Number(point.cameraZ || 0);
      centroid.x += Number(point.x || 0);
      centroid.z += Number(point.z || 0);
      centroid.elevation += Number(point.elevation || 0);
    });
    Object.keys(centroid).forEach((key) => {
      if (typeof centroid[key] === 'number') centroid[key] /= count;
    });
    return centroid;
  }

  getRaceStableProjectedTriangles(projected = [], { stats = null } = {}) {
    const deduped = this.dedupeRaceProjectedPolygon(projected);
    if (deduped.length < 3) {
      if (stats) stats.skippedDegenerateTriangles = (Number(stats.skippedDegenerateTriangles) || 0) + 1;
      return [];
    }
    const polygonArea = this.getRaceProjectedPolygonArea(deduped);
    if (Math.abs(polygonArea) < 0.000001) {
      if (stats) stats.skippedDegenerateTriangles = (Number(stats.skippedDegenerateTriangles) || 0) + 1;
      return [];
    }
    const polygon = polygonArea < 0 ? [...deduped].reverse() : deduped;
    const centroid = this.getRaceProjectedPolygonCentroid(polygon);
    const triangles = [];
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      const area = Math.abs(this.getRaceProjectedPolygonArea([centroid, current, next]));
      if (area < 0.000001) {
        if (stats) stats.skippedDegenerateTriangles = (Number(stats.skippedDegenerateTriangles) || 0) + 1;
        continue;
      }
      triangles.push([centroid, current, next]);
    }
    return triangles;
  }

  getRaceRawProjectedTriangles(projected = [], { stats = null } = {}) {
    const deduped = this.dedupeRaceProjectedPolygon(projected);
    if (deduped.length < 3) {
      if (stats) stats.skippedDegenerateTriangles = (Number(stats.skippedDegenerateTriangles) || 0) + 1;
      return [];
    }
    const triangles = [];
    const anchor = deduped[0];
    for (let index = 1; index < deduped.length - 1; index += 1) {
      const current = deduped[index];
      const next = deduped[index + 1];
      const area = Math.abs(this.getRaceProjectedPolygonArea([anchor, current, next]));
      if (area < 0.000001) {
        if (stats) stats.skippedDegenerateTriangles = (Number(stats.skippedDegenerateTriangles) || 0) + 1;
        continue;
      }
      triangles.push([anchor, current, next]);
    }
    return triangles;
  }

  getRaceWebGLWorldMeshVertices(bounds, points = [], {
    camera = null,
    cameraYaw = 0,
    textureWorldM = 2.5,
    textured = false,
    projectedPolygon = null,
    depthOffset = 0,
    elevationOffset = 0,
    minScreenY = null,
    meshSource = '',
    rawTerrainPolygons = false,
    textureOriginX = 0,
    textureOriginZ = 0,
    stats = null
  } = {}) {
    const noteProjectionSkip = (reason = 'unknown') => {
      if (stats && meshSource === 'terrain') {
        stats.terrainProjectionSkipped = (Number(stats.terrainProjectionSkipped) || 0) + 1;
        if (reason === 'near') stats.terrainProjectionNearSkipped = (Number(stats.terrainProjectionNearSkipped) || 0) + 1;
        else if (reason === 'offscreen') stats.terrainProjectionOffscreenSkipped = (Number(stats.terrainProjectionOffscreenSkipped) || 0) + 1;
        else if (reason === 'floor') stats.terrainProjectionFloorSkipped = (Number(stats.terrainProjectionFloorSkipped) || 0) + 1;
        else if (reason === 'degenerate') stats.terrainProjectionDegenerateSkipped = (Number(stats.terrainProjectionDegenerateSkipped) || 0) + 1;
      }
    };
    if (!Array.isArray(points) || points.length < 3) return [];
    const useRawTerrainPolygons = Boolean(rawTerrainPolygons && meshSource === 'terrain');
    const renderPoints = meshSource === 'terrain'
      ? points
      : points.map((point) => this.getRaceThreeSurfacePoint(point, meshSource));
    const nearPlane = Math.max(1.2, Number(camera?.nearPlane) || 1.6);
    const forwardForNearTest = this.getRaceForwardVector(cameraYaw);
    const allBehindNearPlane = Array.isArray(renderPoints)
      && renderPoints.length
      && renderPoints.every((point) => {
        const dx = Number(point?.x || 0) - Number(camera?.x || 0);
        const dz = Number(point?.z || 0) - Number(camera?.z || 0);
        const cameraZ = dx * Number(forwardForNearTest.x || 0) + dz * Number(forwardForNearTest.z || 0);
        return Number.isFinite(cameraZ) && cameraZ < nearPlane;
      });
    if (useRawTerrainPolygons && allBehindNearPlane) {
      noteProjectionSkip('near');
      return [];
    }
    let projected = Array.isArray(projectedPolygon) && projectedPolygon.length >= 3
      ? projectedPolygon
      : this.getRaceProjectedPolygonForWebGL(renderPoints, camera, cameraYaw, bounds);
    if (projected.length < 3) {
      noteProjectionSkip(allBehindNearPlane ? 'near' : 'degenerate');
      return [];
    }
    if (!useRawTerrainPolygons) {
      projected = this.clipRaceWebGLProjectedPolygonToScreenY(projected, minScreenY, bounds, { stats });
      if (projected.length < 3) {
        noteProjectionSkip('floor');
        return [];
      }
    }
    const minX = Math.min(...projected.map((point) => point.clipX));
    const maxX = Math.max(...projected.map((point) => point.clipX));
    const minY = Math.min(...projected.map((point) => point.clipY));
    const maxY = Math.max(...projected.map((point) => point.clipY));
    if (maxX < -1.35 || minX > 1.35 || maxY < -1.35 || minY > 1.35) {
      noteProjectionSkip('offscreen');
      return [];
    }
    if (Number.isFinite(Number(minScreenY))
      && Math.max(...projected.map((point) => Number(point.screenY || 0))) < Number(minScreenY)) {
      noteProjectionSkip('floor');
      return [];
    }
    const vertices = [];
    const liftedProjected = Number(elevationOffset || 0) !== 0 && !useRawTerrainPolygons
      ? this.clipRaceWebGLProjectedPolygonToScreenY(this.getRaceProjectedPolygonForWebGL(renderPoints.map((point) => ({
        ...point,
        elevation: Number(point.elevation || 0) + Number(elevationOffset || 0)
      })), camera, cameraYaw, bounds), minScreenY, bounds, { stats })
      : projected;
    if (liftedProjected.length < 3) {
      noteProjectionSkip('floor');
      return [];
    }
    const scale = Math.max(0.0001, Number(textureWorldM) || 2.5);
    const originX = Number.isFinite(Number(textureOriginX)) ? Number(textureOriginX) : 0;
    const originZ = Number.isFinite(Number(textureOriginZ)) ? Number(textureOriginZ) : 0;
    const farPlane = Math.max(nearPlane + 1, Number(camera?.farPlane) || 2200);
    const toClipDepth = (point) => {
      const baseDepth = ((Number(point.cameraZ || nearPlane) - nearPlane) / (farPlane - nearPlane)) * 2 - 1;
      return clamp(baseDepth + Number(depthOffset || 0), -1, 1);
    };
    const useWorldAnchoredUvTriangles = Boolean(textured);
    const triangles = useRawTerrainPolygons || useWorldAnchoredUvTriangles
      ? this.getRaceRawProjectedTriangles(liftedProjected, { stats })
      : this.getRaceStableProjectedTriangles(liftedProjected, { stats });
    if (!triangles.length) {
      noteProjectionSkip('degenerate');
      return [];
    }
    triangles.forEach((triangle) => {
      triangle.forEach((point) => {
        const projectionDepth = Math.max(nearPlane, Number(point.renderZ || point.cameraZ || nearPlane));
        const invDepth = 1 / Math.max(0.000001, projectionDepth);
        const textureU = (Number(point.x || 0) - originX) / scale;
        const textureV = -(Number(point.z || 0) - originZ) / scale;
        vertices.push(
          point.clipX,
          point.clipY,
          toClipDepth(point),
          textureU * invDepth,
          textureV * invDepth,
          invDepth
        );
      });
    });
    if (vertices.length < 18) {
      noteProjectionSkip('degenerate');
      return [];
    }
    return vertices;
  }

  drawRaceWebGLMeshVertices(renderer = null, vertices = [], {
    color = '#ffffff',
    textured = true,
    stats = null
  } = {}) {
    const gl = renderer?.gl;
    if (!gl || !renderer.meshProgram || !Array.isArray(vertices) || vertices.length < 18) return false;
    gl.useProgram(renderer.meshProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.meshBuffer);
    const requiredFloats = vertices.length;
    if (!renderer.meshUploadArray || renderer.meshUploadCapacity < requiredFloats) {
      let capacity = Math.max(1024, renderer.meshUploadCapacity || 0);
      while (capacity < requiredFloats) capacity *= 2;
      renderer.meshUploadArray = new Float32Array(capacity);
      renderer.meshUploadCapacity = capacity;
      gl.bufferData(gl.ARRAY_BUFFER, renderer.meshUploadArray.byteLength, gl.DYNAMIC_DRAW);
      renderer.meshBufferCapacity = capacity;
      if (stats) stats.bufferReallocations = (Number(stats.bufferReallocations) || 0) + 1;
    } else if (renderer.meshBufferCapacity !== renderer.meshUploadCapacity) {
      gl.bufferData(gl.ARRAY_BUFFER, renderer.meshUploadArray.byteLength, gl.DYNAMIC_DRAW);
      renderer.meshBufferCapacity = renderer.meshUploadCapacity;
      if (stats) stats.bufferReallocations = (Number(stats.bufferReallocations) || 0) + 1;
    }
    renderer.meshUploadArray.set(vertices, 0);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, renderer.meshUploadArray.subarray(0, requiredFloats));
    if (stats) {
      stats.bufferUploads = (Number(stats.bufferUploads) || 0) + 1;
      stats.uploadedFloats = (Number(stats.uploadedFloats) || 0) + requiredFloats;
    }
    gl.enableVertexAttribArray(renderer.meshLocations.position);
    gl.vertexAttribPointer(renderer.meshLocations.position, 2, gl.FLOAT, false, 24, 0);
    if (renderer.meshLocations.depth >= 0) {
      gl.enableVertexAttribArray(renderer.meshLocations.depth);
      gl.vertexAttribPointer(renderer.meshLocations.depth, 1, gl.FLOAT, false, 24, 8);
    }
    gl.enableVertexAttribArray(renderer.meshLocations.texCoord);
    gl.vertexAttribPointer(renderer.meshLocations.texCoord, 2, gl.FLOAT, false, 24, 12);
    if (renderer.meshLocations.invDepth >= 0) {
      gl.enableVertexAttribArray(renderer.meshLocations.invDepth);
      gl.vertexAttribPointer(renderer.meshLocations.invDepth, 1, gl.FLOAT, false, 24, 20);
    }
    gl.uniform1i(renderer.meshLocations.textureSampler, 0);
    gl.uniform4fv(renderer.meshLocations.tint, this.getRaceWebGLColorArray(color));
    gl.uniform1f(renderer.meshLocations.useTexture, textured ? 1 : 0);
    if (!renderer.meshBlendEnabled) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      renderer.meshBlendEnabled = true;
    }
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);
    return true;
  }

  bindRaceWebGLMeshTexture(renderer = null, artRef = '', stats = null) {
    const gl = renderer?.gl;
    if (!gl) return false;
    const clean = String(artRef || '').trim();
    gl.activeTexture(gl.TEXTURE0);
    if (!clean) {
      gl.bindTexture(gl.TEXTURE_2D, renderer.texture);
      return true;
    }
    const canvas = this.getRaceArtSpriteCanvas(clean);
    if (!canvas) {
      gl.bindTexture(gl.TEXTURE_2D, renderer.texture);
      return false;
    }
    const key = `${clean}:${Number(canvas.width || 0)}x${Number(canvas.height || 0)}`;
    renderer.textureCache = renderer.textureCache instanceof Map ? renderer.textureCache : new Map();
    let entry = renderer.textureCache.get(key);
    const powerOfTwo = (value) => value > 0 && (value & (value - 1)) === 0;
    const canMipmap = powerOfTwo(Number(canvas.width || 0)) && powerOfTwo(Number(canvas.height || 0));
    if (!entry) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      if (canMipmap) gl.generateMipmap(gl.TEXTURE_2D);
      entry = { texture, paramsKey: '', canMipmap };
      renderer.textureCache.set(key, entry);
      if (stats) stats.textureUploads = (Number(stats.textureUploads) || 0) + 1;
    } else {
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    }
    const requestedFilterMode = String(this.getRaceGroundTextureFilterMode());
    const filterMode = RACE_GROUND_TEXTURE_FILTER_MODE_IDS.has(requestedFilterMode) ? requestedFilterMode : RACE_GROUND_TEXTURE_FILTER_DEFAULT;
    const minFilter = filterMode === 'smooth'
      ? (entry.canMipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR)
      : filterMode === 'balanced'
        ? (entry.canMipmap ? gl.NEAREST_MIPMAP_LINEAR : gl.NEAREST)
        : (entry.canMipmap ? gl.NEAREST_MIPMAP_NEAREST : gl.NEAREST);
    const magFilter = filterMode === 'smooth' ? gl.LINEAR : gl.NEAREST;
    const wrap = entry.canMipmap ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    const paramsKey = `${filterMode}:${entry.canMipmap ? 1 : 0}:${wrap}`;
    if (entry.paramsKey !== paramsKey) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      entry.paramsKey = paramsKey;
    }
    return true;
  }

  getRaceWebGLTerrainMeshVertices(cells = [], {
    textureWorldM = 2.5,
    textured = false,
    tileMap = this.ensureRaceTileMap(),
    useSunShading = false
  } = {}) {
    if (!Array.isArray(cells) || !cells.length) return new Float32Array(0);
    const scale = Math.max(0.0001, Number(textureWorldM) || 2.5);
    const chunks = [];
    let totalLength = 0;
    const sun = useSunShading ? this.getRaceSunSettings() : null;
    const vertexCacheKey = [
      cells.visibleTerrainCacheKey || '',
      Math.round(scale * 10000),
      textured ? 1 : 0,
      useSunShading ? 1 : 0,
      Math.round(Number(sun?.angleDeg || 0) * 10),
      Math.round(Number(sun?.intensity ?? 0.72) * 100),
      String(tileMap?.defaultTileId || 'grass')
    ].join(':');
    if (cells.visibleTerrainCombinedVertexCache?.key === vertexCacheKey && cells.visibleTerrainCombinedVertexCache.vertices?.length) {
      return cells.visibleTerrainCombinedVertexCache.vertices;
    }
    const tintCache = new Map();
    const getTint = (color) => {
      const clean = String(color || '#ffffff');
      const cached = tintCache.get(clean);
      if (cached) return cached;
      const tint = this.getRaceWebGLColorArray(clean);
      tintCache.set(clean, tint);
      return tint;
    };
    cells.forEach((cell) => {
      const points = Array.isArray(cell?.points) ? cell.points : [];
      if (points.length < 3) return;
      const cached = cell.webglTerrainVertexCache;
      if (cached?.key === vertexCacheKey && cached.vertices?.length) {
        chunks.push(cached.vertices);
        totalLength += cached.vertices.length;
        return;
      }
      const cellVertices = [];
      const pushCellVertex = (point = {}, tint = [1, 1, 1, 1], originX = 0, originZ = 0) => {
        const x = Number(point.x || 0);
        const z = Number(point.z || 0);
        cellVertices.push(
          x,
          Number(point.elevation || 0),
          z,
          (x - originX) / scale,
          -(z - originZ) / scale,
          tint[0],
          tint[1],
          tint[2],
          tint[3]
        );
      };
      let minX = Infinity;
      let minZ = Infinity;
      for (let index = 0; index < 4; index += 1) {
        const point = points[index];
        const x = Number(point?.x || 0);
        const z = Number(point?.z || 0);
        if (Number.isFinite(x) && x < minX) minX = x;
        if (Number.isFinite(z) && z < minZ) minZ = z;
      }
      const originX = Math.floor((Number.isFinite(minX) ? minX : 0) / scale) * scale;
      const originZ = Math.floor((Number.isFinite(minZ) ? minZ : 0) / scale) * scale;
      const palette = this.getRaceWeightedGroundTilePalette(
        cell.tileCell?.tileWeights,
        cell.tileCell?.tileId || tileMap?.defaultTileId || 'grass'
      );
      const color = textured
        ? (useSunShading ? this.getRaceTextureSunTint(points) : '#ffffff')
        : (useSunShading ? this.getRaceTerrainSunTint(points, palette.groundA) : palette.groundA);
      const tint = getTint(color);
      const triangles = this.triangulateRaceTerrainPolygon(points);
      triangles.forEach((triangle) => {
        pushCellVertex(triangle[0], tint, originX, originZ);
        pushCellVertex(triangle[1], tint, originX, originZ);
        pushCellVertex(triangle[2], tint, originX, originZ);
      });
      if (cellVertices.length > 0) {
        const typedCellVertices = new Float32Array(cellVertices);
        cell.webglTerrainVertexCache = { key: vertexCacheKey, vertices: typedCellVertices };
        chunks.push(typedCellVertices);
        totalLength += typedCellVertices.length;
      }
    });
    if (!chunks.length || totalLength <= 0) return new Float32Array(0);
    if (chunks.length === 1 && chunks[0] instanceof Float32Array) return chunks[0];
    const vertices = new Float32Array(totalLength);
    let offset = 0;
    chunks.forEach((chunk) => {
      vertices.set(chunk, offset);
      offset += chunk.length;
    });
    if (cells.visibleTerrainCacheKey) {
      cells.visibleTerrainCombinedVertexCache = { key: vertexCacheKey, vertices };
    }
    return vertices;
  }

  drawRaceWebGLTerrainMeshBatch(ctx, bounds, renderer = null, cells = [], {
    camera = null,
    cameraYaw = 0,
    textureWorldM = 2.5,
    textured = false,
    tileMap = this.ensureRaceTileMap(),
    useSunShading = false,
    stats = null
  } = {}) {
    return drawRaceWebGLTerrainMeshBatchModule({
      renderer,
      cells,
      camera,
      cameraYaw,
      bounds,
      textureWorldM,
      textured,
      tileMap,
      useSunShading,
      stats,
      adapter: {
        now: () => this.getNowMs(),
        getTerrainMeshVertices: (terrainCells, options) => this.getRaceWebGLTerrainMeshVertices(terrainCells, options)
      }
    });
  }

  getRaceThreeWorldRenderer(width = 1, height = 1) {
    if (!THREE?.WebGLRenderer || typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    let renderer = this.raceThreeWorldRenderer;
    if (!renderer) {
      const canvas = document.createElement('canvas');
      const threeRenderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: false
      });
      threeRenderer.setPixelRatio?.(1);
      threeRenderer.setClearColor(0x000000, 0);
      if ('outputColorSpace' in threeRenderer && THREE.SRGBColorSpace) threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer = {
        canvas,
        threeRenderer,
        scene: new THREE.Scene(),
        camera: new THREE.PerspectiveCamera(62, 1, 0.4, 2600),
        textureCache: new Map(),
        materialCache: new Map()
      };
      this.raceThreeWorldRenderer = renderer;
    }
    const w = Math.max(1, Math.round(Number(width) || 1));
    const h = Math.max(1, Math.round(Number(height) || 1));
    if (renderer.canvas.width !== w || renderer.canvas.height !== h) {
      renderer.threeRenderer.setSize(w, h, false);
      renderer.camera.aspect = w / Math.max(1, h);
      renderer.camera.updateProjectionMatrix();
    }
    return renderer;
  }

  clearRaceThreeScene(renderer = null) {
    if (!renderer?.scene) return;
    while (renderer.scene.children.length) {
      const child = renderer.scene.children.pop();
      child.geometry?.dispose?.();
    }
  }

  getRaceThreeStaticWorldKey(cells = [], {
    textureWorldM = 2.5,
    artRef = '',
    textured = false,
    useSunShading = false,
    shoulderMeshes = [],
    roadMeshes = [],
    boundaryMeshes = [],
    roadPaintMeshes = [],
    trackFurnitureMeshes = []
  } = {}) {
    const cellKey = cells.visibleTerrainCacheKey
      || cells.map((cell) => cell?.key || cell?.chunkKey || '').join('|');
    const meshSignature = (meshes = []) => `${meshes.length}:${meshes.map((mesh) => [
      mesh.source || '',
      mesh.artRef || '',
      mesh.textured ? 1 : 0,
      Math.round(Number(mesh.textureWorldM || textureWorldM) * 1000),
      Array.isArray(mesh.points) ? mesh.points.length : 0
    ].join(',')).join(';')}`;
    return [
      this.playtestSession?.worldBake?.surfaceRevision || this.getRaceSurfaceGeometryRevisionKey(),
      cellKey,
      Math.round(Number(textureWorldM || 0) * 10000),
      artRef,
      textured ? 1 : 0,
      useSunShading ? 1 : 0,
      this.ensureRaceTileMap()?.revision || 0,
      this.getRaceGroundTextureFilterMode(),
      meshSignature(shoulderMeshes),
      meshSignature(roadMeshes),
      meshSignature(boundaryMeshes),
      meshSignature(roadPaintMeshes),
      meshSignature(trackFurnitureMeshes)
    ].join('::three-static::');
  }

  alignRaceThreeCameraHorizon(threeCamera = null, camera = {}, cameraYaw = 0, bounds = {}) {
    if (!threeCamera || !THREE?.Vector3) return;
    threeCamera.updateMatrixWorld?.(true);
    const horizonRatio = clamp(Number(camera.horizonRatio) || 0.31, 0, 1);
    const desiredNdcY = 1 - horizonRatio * 2;
    const forward = this.getRaceForwardVector(cameraYaw);
    const probe = new THREE.Vector3(
      Number(camera.x || 0) + Number(forward.x || 0) * 10000,
      0,
      Number(camera.z || 0) + Number(forward.z || 0) * 10000
    );
    probe.project(threeCamera);
    const currentNdcY = Number(probe.y);
    if (!Number.isFinite(currentNdcY)) return;
    const delta = clamp(desiredNdcY - currentNdcY, -1.5, 1.5);
    threeCamera.projectionMatrix.elements[9] -= delta;
    threeCamera.projectionMatrixInverse?.copy?.(threeCamera.projectionMatrix)?.invert?.();
  }

  getRaceThreeTexture(renderer = null, artRef = '') {
    const clean = String(artRef || '').trim();
    if (!renderer || !clean) return null;
    const canvas = this.getRaceArtSpriteCanvas(clean);
    if (!canvas) return null;
    const key = `${clean}:${Number(canvas.width || 0)}x${Number(canvas.height || 0)}:${this.getRaceGroundTextureFilterMode()}`;
    const cached = renderer.textureCache.get(key);
    if (cached) return cached;
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    const filterMode = this.getRaceGroundTextureFilterMode();
    texture.magFilter = filterMode === 'smooth' ? THREE.LinearFilter : THREE.NearestFilter;
    texture.minFilter = filterMode === 'smooth' ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapNearestFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    renderer.textureCache.set(key, texture);
    renderer.textureUploads = (Number(renderer.textureUploads) || 0) + 1;
    if (renderer.textureCache.size > 24) {
      const first = renderer.textureCache.entries().next().value;
      if (first) {
        first[1]?.dispose?.();
        renderer.textureCache.delete(first[0]);
      }
    }
    return texture;
  }

  getRaceThreeMaterial(renderer = null, {
    texture = null,
    depthWrite = true,
    polygonOffset = true
  } = {}) {
    if (!renderer || !THREE?.MeshBasicMaterial) return null;
    renderer.materialCache = renderer.materialCache instanceof Map ? renderer.materialCache : new Map();
    const textureKey = texture?.uuid || 'solid';
    const key = `${textureKey}:${depthWrite ? 1 : 0}:${polygonOffset ? 1 : 0}`;
    const cached = renderer.materialCache.get(key);
    if (cached) return cached;
    const material = new THREE.MeshBasicMaterial({
      map: texture || null,
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: false,
      depthTest: true,
      depthWrite,
      polygonOffset,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    renderer.materialCache.set(key, material);
    if (renderer.materialCache.size > 32) {
      const first = renderer.materialCache.entries().next().value;
      if (first) {
        first[1]?.dispose?.();
        renderer.materialCache.delete(first[0]);
      }
    }
    return material;
  }

  getRaceThreeElevationM(point = {}, liftM = 0) {
    return Number(point?.elevation || 0) * RACE_THREE_ELEVATION_M + Number(liftM || 0);
  }

  getRaceThreeSurfacePoint(point = {}, source = '') {
    const cleanSource = String(source || '');
    if (cleanSource === 'terrain' || cleanSource.includes('terrain-roadside')) return point;
    if (point?.roadDeckElevation === true) return point;
    const x = Number(point?.x || 0);
    const z = Number(point?.z ?? point?.y ?? 0);
    const fallbackElevation = Number(point?.elevation || 0);
    return {
      ...point,
      x,
      z,
      elevation: this.getRaceStitchedTerrainElevationAtWorldPoint({ x, z }, fallbackElevation)
    };
  }

  getRaceThreeMeshLiftM(mesh = {}) {
    if (Number.isFinite(Number(mesh.threeLiftM))) return Number(mesh.threeLiftM);
    const source = String(mesh.source || '');
    if (source === 'terrain') return RACE_THREE_LIFTS_M.terrain;
    if (source.includes('shoulder')) return RACE_THREE_LIFTS_M.shoulder;
    if (source.includes('boundary') || source.includes('margin')) return RACE_THREE_LIFTS_M.boundary;
    if (source.includes('paint') || source.includes('checker') || source.includes('lane')) return RACE_THREE_LIFTS_M.paint;
    if (source.includes('road')) return RACE_THREE_LIFTS_M.road;
    return 0;
  }

  getRaceWebGLMeshElevationOffsetForSource(source = '') {
    const cleanSource = String(source || '');
    if (cleanSource === 'terrain') return 0;
    if (cleanSource.includes('shoulder')) return RACE_THREE_LIFTS_M.shoulder / RACE_THREE_ELEVATION_M;
    if (cleanSource.includes('boundary') || cleanSource.includes('margin')) return RACE_THREE_LIFTS_M.boundary / RACE_THREE_ELEVATION_M;
    if (cleanSource.includes('paint') || cleanSource.includes('checker') || cleanSource.includes('lane')) return RACE_THREE_LIFTS_M.paint / RACE_THREE_ELEVATION_M;
    if (cleanSource.includes('road')) return RACE_THREE_LIFTS_M.road / RACE_THREE_ELEVATION_M;
    return 0;
  }

  getRaceThreeMeshGeometry(meshes = [], {
    textureWorldM = 2.5
  } = {}) {
    if (!Array.isArray(meshes) || !meshes.length || !THREE?.BufferGeometry) return null;
    const positions = [];
    const uvs = [];
    const colors = [];
    const pushVertex = (point = {}, color = [1, 1, 1, 1], {
      liftM = 0,
      originX = 0,
      originZ = 0,
      scale = 2.5
    } = {}) => {
      positions.push(
        Number(point.x || 0),
        this.getRaceThreeElevationM(point, liftM),
        Number(point.z || 0)
      );
      uvs.push(
        (Number(point.x || 0) - originX) / scale,
        -(Number(point.z || 0) - originZ) / scale
      );
      colors.push(color[0], color[1], color[2]);
    };
    meshes.forEach((mesh) => {
      const points = Array.isArray(mesh?.points)
        ? mesh.points.map((point) => this.getRaceThreeSurfacePoint(point, mesh.source))
        : [];
      if (points.length < 3) return;
      const color = this.getRaceWebGLColorArray(mesh.color || '#ffffff');
      const scale = Math.max(0.0001, Number(mesh.textureWorldM || textureWorldM) || 2.5);
      const xs = points.map((point) => Number(point?.x || 0)).filter(Number.isFinite);
      const zs = points.map((point) => Number(point?.z || 0)).filter(Number.isFinite);
      const originX = Math.floor((xs.length ? Math.min(...xs) : 0) / scale) * scale;
      const originZ = Math.floor((zs.length ? Math.min(...zs) : 0) / scale) * scale;
      const liftM = this.getRaceThreeMeshLiftM(mesh);
      for (let index = 1; index < points.length - 1; index += 1) {
        pushVertex(points[0], color, { liftM, originX, originZ, scale });
        pushVertex(points[index], color, { liftM, originX, originZ, scale });
        pushVertex(points[index + 1], color, { liftM, originX, originZ, scale });
      }
    });
    if (positions.length < 9) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }

  getRaceThreeTerrainGeometry(cells = [], {
    textureWorldM = 2.5,
    tileMap = this.ensureRaceTileMap(),
    useSunShading = false,
    textured = false
  } = {}) {
    if (!Array.isArray(cells) || !cells.length || !THREE?.BufferGeometry) return null;
    const terrainMeshes = [];
    cells.forEach((cell) => {
      const points = Array.isArray(cell?.points) ? cell.points : [];
      if (points.length < 3) return;
      const palette = this.getRaceWeightedGroundTilePalette(
        cell.tileCell?.tileWeights,
        cell.tileCell?.tileId || tileMap?.defaultTileId || 'grass'
      );
      const css = textured
        ? (useSunShading ? this.getRaceTextureSunTint(points) : '#ffffff')
        : (useSunShading ? this.getRaceTerrainSunTint(points, palette.groundA) : palette.groundA);
      terrainMeshes.push({
        source: 'terrain',
        points,
        color: css,
        textured,
        textureWorldM,
        threeLiftM: RACE_THREE_LIFTS_M.terrain
      });
    });
    return this.getRaceThreeMeshGeometry(terrainMeshes, { textureWorldM });
  }

  addRaceThreeMeshGroups(renderer = null, meshes = [], {
    textureWorldM = 2.5,
    stats = null,
    defaultDepthWrite = true,
    defaultPolygonOffset = true,
    renderOrder = 0
  } = {}) {
    return addRaceThreeMeshGroupsBatch({
      renderer,
      meshes,
      textureWorldM,
      stats,
      defaultDepthWrite,
      defaultPolygonOffset,
      renderOrder,
      THREE,
      adapter: {
        getMeshLiftM: (mesh) => this.getRaceThreeMeshLiftM(mesh),
        getMeshGeometry: (groupMeshes, options) => this.getRaceThreeMeshGeometry(groupMeshes, options),
        getTexture: (targetRenderer, artRef) => this.getRaceThreeTexture(targetRenderer, artRef),
        getMaterial: (targetRenderer, options) => this.getRaceThreeMaterial(targetRenderer, options)
      }
    });
  }

  drawRaceThreeWorldScene(ctx, bounds, cells = [], {
    camera = null,
    cameraView = 'third-person',
    cameraYaw = 0,
    textureWorldM = 2.5,
    artRef = '',
    textured = false,
    tileMap = this.ensureRaceTileMap(),
    useSunShading = false,
    shoulderMeshes = [],
    roadMeshes = [],
    boundaryMeshes = [],
    roadPaintMeshes = [],
    trackFurnitureMeshes = [],
    stats = null
  } = {}) {
    if (!ctx || !camera || !Array.isArray(cells) || !cells.length || typeof ctx.drawImage !== 'function') return false;
    const width = Math.max(1, Math.round(Number(bounds.w || 1)));
    const height = Math.max(1, Math.round(Number(bounds.h || 1)));
    const renderer = this.getRaceThreeWorldRenderer(width, height);
    if (!renderer?.threeRenderer) return false;
    const textureUploadStart = Number(renderer.textureUploads || 0);
    const staticKey = this.getRaceThreeStaticWorldKey(cells, {
      textureWorldM,
      artRef,
      textured,
      useSunShading,
      shoulderMeshes,
      roadMeshes,
      boundaryMeshes,
      roadPaintMeshes,
      trackFurnitureMeshes
    });
    let terrainTriangles = Number(renderer.staticTerrainTriangles || 0);
    let staticPolygons = Number(renderer.staticPolygons || 0);
    let staticDrawCalls = Number(renderer.staticDrawCalls || 0);
    const buildStartMs = this.getNowMs();
    if (renderer.staticWorldKey !== staticKey) {
      this.clearRaceThreeScene(renderer);
      const geometry = this.getRaceThreeTerrainGeometry(cells, {
        textureWorldM,
        tileMap,
        useSunShading,
        textured
      });
      if (!geometry) return false;
      const texture = textured ? this.getRaceThreeTexture(renderer, artRef) : null;
      const material = this.getRaceThreeMaterial(renderer, {
        texture,
        depthWrite: true,
        polygonOffset: false
      });
      if (!material) return false;
      const terrainMesh = new THREE.Mesh(geometry, material);
      terrainMesh.renderOrder = 0;
      renderer.scene.add(terrainMesh);
      terrainTriangles = Math.floor((geometry.getAttribute('position')?.count || 0) / 3);
      const buildStats = { polygons: terrainTriangles, drawCalls: 1 };
      const addGroup = (meshes, name, options = {}) => {
        const beforePolygons = Number(buildStats.polygons || 0);
        const beforeDrawCalls = Number(buildStats.drawCalls || 0);
        const result = this.addRaceThreeMeshGroups(renderer, meshes, {
          textureWorldM,
          stats: buildStats,
          ...options
        });
        if (stats && name) {
          stats[`${name}Polygons`] = Math.max(0, Number(buildStats.polygons || 0) - beforePolygons);
          stats[`${name}DrawCalls`] = Math.max(0, Number(buildStats.drawCalls || 0) - beforeDrawCalls);
        }
        return result;
      };
      addGroup(shoulderMeshes, 'threeShoulder', { renderOrder: 1 });
      addGroup(roadMeshes, 'threeRoad', { renderOrder: 2 });
      addGroup(boundaryMeshes, 'threeBoundary', { renderOrder: 3 });
      addGroup(trackFurnitureMeshes, 'trackFurniture', { renderOrder: 4 });
      addGroup(roadPaintMeshes, 'roadPaint', { defaultDepthWrite: false, defaultPolygonOffset: true, renderOrder: 5 });
      staticPolygons = Number(buildStats.polygons || 0);
      staticDrawCalls = Number(buildStats.drawCalls || 0);
      renderer.staticWorldKey = staticKey;
      renderer.staticTerrainTriangles = terrainTriangles;
      renderer.staticPolygons = staticPolygons;
      renderer.staticDrawCalls = staticDrawCalls;
      renderer.staticGeometryRebuilds = (Number(renderer.staticGeometryRebuilds) || 0) + 1;
      if (stats) stats.staticGeometryRebuilds = (Number(stats.staticGeometryRebuilds) || 0) + 1;
    } else if (stats) {
      stats.geometryCacheHits = (Number(stats.geometryCacheHits) || 0) + 1;
    }
    if (stats && buildStartMs > 0) {
      stats.geometryBuildMs = (Number(stats.geometryBuildMs) || 0) + Math.max(0, this.getNowMs() - buildStartMs);
    }
    const forward = this.getRaceForwardVector(cameraYaw);
    const cameraY = this.getRaceThreeElevationM(camera);
    renderer.camera.position.set(Number(camera.x || 0), cameraY, Number(camera.z || 0));
    renderer.camera.up.set(0, 1, 0);
    renderer.camera.near = Math.max(0.4, Number(camera.nearPlane || 1.6) * 0.35);
    renderer.camera.far = Math.max(400, Number(camera.farPlane || 2200));
    renderer.camera.fov = this.getRaceThreeCameraFov(cameraView);
    renderer.camera.aspect = width / Math.max(1, height);
    renderer.camera.lookAt(
      Number(camera.x || 0) + forward.x * 80,
      cameraY - Math.max(0.6, Number(camera.eyeHeight || 0.1) * RACE_THREE_ELEVATION_M * 0.55),
      Number(camera.z || 0) + forward.z * 80
    );
    renderer.camera.updateProjectionMatrix();
    this.alignRaceThreeCameraHorizon(renderer.camera, camera, cameraYaw, bounds);
    renderer.threeRenderer.clear(true, true, true);
    const renderStartMs = this.getNowMs();
    renderer.threeRenderer.render(renderer.scene, renderer.camera);
    const compositeStartMs = this.getNowMs();
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(renderer.canvas, Number(bounds.x || 0), Number(bounds.y || 0), Number(bounds.w || 1), Number(bounds.h || 1));
    ctx.imageSmoothingEnabled = previousSmoothing;
    if (stats) {
      if (compositeStartMs > 0) stats.compositeMs = Math.max(0, this.getNowMs() - compositeStartMs);
      stats.threeTerrainRenderer = 1;
      stats.threeTerrainCells = cells.length;
      stats.threeTerrainPolygons = terrainTriangles;
      stats.polygons = (Number(stats.polygons) || 0) + staticPolygons;
      stats.drawCalls = (Number(stats.drawCalls) || 0) + staticDrawCalls;
      stats.textureUploads = (Number(stats.textureUploads) || 0) + Math.max(0, Number(renderer.textureUploads || 0) - textureUploadStart);
      if (renderStartMs > 0) stats.threeRenderMs = Math.max(0, this.getNowMs() - renderStartMs);
    }
    return true;
  }

  drawRaceWebGLWorldMeshBatch(ctx, bounds, renderer = null, meshes = [], {
    camera = null,
    cameraYaw = 0,
    textureWorldM = 2.5,
    stats = null,
    depthTest = true
  } = {}) {
    return drawRaceWebGLWorldMeshBatchModule({
      renderer,
      meshes,
      camera,
      cameraYaw,
      bounds,
      textureWorldM,
      stats,
      depthTest,
      adapter: {
        now: () => this.getNowMs(),
        getWorldMeshVertices: (targetBounds, points, options) => this.getRaceWebGLWorldMeshVertices(targetBounds, points, options),
        getElevationOffsetForSource: (source) => this.getRaceWebGLMeshElevationOffsetForSource(source),
        bindMeshTexture: (targetRenderer, artRef, targetStats) => this.bindRaceWebGLMeshTexture(targetRenderer, artRef, targetStats),
        drawMeshVertices: (targetRenderer, vertices, options) => this.drawRaceWebGLMeshVertices(targetRenderer, vertices, options)
      }
    });
  }

  getRaceWebGLPaintMeshFromProjectedQuad(points = [], bounds = {}, {
    color = '#ffffff',
    artRef = '',
    textured = false,
    textureWorldM = 2.5,
    depthOffset = -0.12,
    source = 'road-paint',
    minScreenY = null
  } = {}) {
    if (!Array.isArray(points) || points.length < 3) return null;
    const projectedPolygon = points.map((point) => {
      const screenX = Number(point?.screenX ?? point?.x);
      const screenY = Number(point?.screenY ?? point?.y);
      if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return null;
      return {
        ...point,
        screenX,
        screenY,
        clipX: ((screenX - Number(bounds.x || 0)) / Math.max(1, Number(bounds.w || 1))) * 2 - 1,
        clipY: 1 - ((screenY - Number(bounds.y || 0)) / Math.max(1, Number(bounds.h || 1))) * 2,
        visible: true
      };
    }).filter(Boolean);
    if (projectedPolygon.length < 3) return null;
    return {
      source,
      points: projectedPolygon,
      projectedPolygon,
      color,
      artRef,
      textured: Boolean(textured && artRef),
      textureWorldM,
      depthOffset,
      minScreenY
    };
  }

  lerpRaceWorldPoint(a = {}, b = {}, t = 0) {
    return {
      ...a,
      x: Number(a.x || 0) + (Number(b.x || 0) - Number(a.x || 0)) * t,
      z: Number(a.z || 0) + (Number(b.z || 0) - Number(a.z || 0)) * t,
      elevation: Number(a.elevation || 0) + (Number(b.elevation || 0) - Number(a.elevation || 0)) * t,
      segment: a.segment || b.segment
    };
  }

  getRaceWebGLVerticalPostMeshes(anchor = null, yaw = 0, {
    width = 0.16,
    depth = 0.16,
    height = 0.022,
    color = 'rgba(242,212,92,0.92)',
    source = 'roadside-post'
  } = {}) {
    if (!anchor || !Number.isFinite(Number(anchor.x)) || !Number.isFinite(Number(anchor.z))) return [];
    const right = this.getRaceRightVector(yaw);
    const forward = this.getRaceForwardVector(yaw);
    const halfWidth = Math.max(0.05, Number(width) || 0.16) * 0.5;
    const halfDepth = Math.max(0.05, Number(depth) || 0.16) * 0.5;
    const topHalfWidth = halfWidth * 0.48;
    const topHalfDepth = halfDepth * 0.48;
    const baseElevation = Number(anchor.elevation || 0) + 0.01;
    const topElevation = baseElevation + clamp(Number(height) || 0.022, 0.012, 0.03);
    const corner = (rightSign, forwardSign, elevation, widthScale = 1, depthScale = 1) => ({
      ...anchor,
      x: Number(anchor.x || 0) + right.x * halfWidth * widthScale * rightSign + forward.x * halfDepth * depthScale * forwardSign,
      z: Number(anchor.z || 0) + right.z * halfWidth * widthScale * rightSign + forward.z * halfDepth * depthScale * forwardSign,
      elevation
    });
    const b00 = corner(-1, -1, baseElevation);
    const b10 = corner(1, -1, baseElevation);
    const b11 = corner(1, 1, baseElevation);
    const b01 = corner(-1, 1, baseElevation);
    const t00 = corner(-1, -1, topElevation, topHalfWidth / halfWidth, topHalfDepth / halfDepth);
    const t10 = corner(1, -1, topElevation, topHalfWidth / halfWidth, topHalfDepth / halfDepth);
    const t11 = corner(1, 1, topElevation, topHalfWidth / halfWidth, topHalfDepth / halfDepth);
    const t01 = corner(-1, 1, topElevation, topHalfWidth / halfWidth, topHalfDepth / halfDepth);
    return [
      { source, points: [t00, t10, b10, b00], color, textured: false, depthOffset: -0.045, minScreenY: null },
      { source, points: [t10, t11, b11, b10], color, textured: false, depthOffset: -0.045, minScreenY: null },
      { source, points: [t11, t01, b01, b11], color, textured: false, depthOffset: -0.045, minScreenY: null },
      { source, points: [t01, t00, b00, b01], color, textured: false, depthOffset: -0.045, minScreenY: null },
      { source, points: [t00, t01, t11, t10], color: 'rgba(255,236,132,0.96)', textured: false, depthOffset: -0.045, minScreenY: null }
    ];
  }

  getRaceRoadsidePostAnchor(section = null, side = 'left') {
    if (!section?.left || !section?.right) return null;
    const isLeft = side === 'left';
    const roadEdge = isLeft ? section.left : section.right;
    const shoulderEdge = isLeft
      ? (section.shoulderLeft || section.left)
      : (section.shoulderRight || section.right);
    const segment = section.center?.segment || roadEdge.segment || this.selectedSegment;
    const shoulderWidth = Math.max(0.1, this.getRaceShoulderWidthWorld(segment));
    const marginWidth = this.isRaceMarginEnabled()
      ? Math.max(0.08, this.getRaceBoundaryWidthWorld(segment))
      : Math.max(0.08, shoulderWidth * 0.055);
    const anchorT = clamp(marginWidth / shoulderWidth, 0.02, 0.24);
    return this.lerpRaceWorldPoint(roadEdge, shoulderEdge, anchorT);
  }

  getRaceWebGLRoadsidePostMeshes(slices = [], {
    travel = 0,
    routeLength = 1,
    camera = null
  } = {}) {
    if (!Array.isArray(slices) || slices.length < 2) return [];
    const distances = slices.map((slice) => Number(slice?.center?.distance || 0)).filter(Number.isFinite);
    if (distances.length < 2) return [];
    const markerDimensions = this.getRaceLaneMarkerDimensionsWorld();
    const visibleMinDistance = Math.min(...distances);
    const visibleMaxDistance = Math.max(...distances);
    const travelDistance = Number.isFinite(Number(travel)) ? Number(travel) : visibleMinDistance;
    const minDistance = Math.max(visibleMinDistance, travelDistance - markerDimensions.edgePostInterval);
    const maxDistance = Math.min(visibleMaxDistance, travelDistance + markerDimensions.edgePostInterval * 12);
    const routeRuntimeType = this.playtestSession?.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const allowVisualExtension = routeRuntimeType !== 'circuit';
    const meshes = [];
    const nearPlane = Math.max(1.2, Number(camera?.nearPlane) || 1.2);
    for (let distance = Math.ceil(minDistance / markerDimensions.edgePostInterval) * markerDimensions.edgePostInterval; distance <= maxDistance; distance += markerDimensions.edgePostInterval) {
      if (routeRuntimeType !== 'circuit' && (distance < -RACE_DESTINATION_VISUAL_EXTENSION_M || distance > Number(routeLength || 1) + RACE_DESTINATION_VISUAL_EXTENSION_M)) continue;
      const projected = this.getRaceInterpolatedMarkerSlice(slices, distance);
      const depth = Number(projected?.center?.cameraZ ?? projected?.center?.renderZ);
      if (Number.isFinite(depth) && depth < nearPlane) continue;
      const section = this.getRaceRoadCrossSectionAtDistance(distance, {
        routeLength,
        runtimeType: routeRuntimeType,
        allowVisualExtension
      });
      ['left', 'right'].forEach((side) => {
        const anchor = this.getRaceRoadsidePostAnchor(section, side);
        meshes.push(...this.getRaceWebGLVerticalPostMeshes(anchor, Number(section.center?.yaw || 0), {
          width: 0.16,
          depth: 0.16,
          height: 0.022,
          source: 'quarter-mile-post'
        }));
      });
    }
    return meshes;
  }

  getRaceWebGLCheckerStripeMeshes({
    travel = 0,
    routeLength = 1,
    slices = []
  } = {}) {
    const distances = Array.isArray(slices)
      ? slices.map((slice) => Number(slice?.center?.distance || 0)).filter(Number.isFinite)
      : [];
    const visibleMinDistance = distances.length ? Math.min(...distances) : Number(travel || 0);
    const visibleMaxDistance = distances.length ? Math.max(...distances) : Number(travel || 0) + 260;
    const routeRuntimeType = this.playtestSession?.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const allowVisualExtension = routeRuntimeType !== 'circuit';
    const meshes = [];
    const pushStripe = (startDistance, endDistance) => {
      const nearDistance = Math.min(startDistance, endDistance);
      const farDistance = Math.max(startDistance, endDistance);
      if (farDistance < visibleMinDistance - 2 || nearDistance > visibleMaxDistance + 2) return;
      const nearSection = this.getRaceRoadCrossSectionAtDistance(nearDistance, {
        routeLength,
        runtimeType: routeRuntimeType,
        allowVisualExtension
      });
      const farSection = this.getRaceRoadCrossSectionAtDistance(farDistance, {
        routeLength,
        runtimeType: routeRuntimeType,
        allowVisualExtension
      });
      const cells = 10;
      for (let index = 0; index < cells; index += 1) {
        const t0 = index / cells;
        const t1 = (index + 1) / cells;
        const lift = (point) => ({ ...point, elevation: Number(point.elevation || 0) + 0.018 });
        meshes.push({
          source: 'road-checker',
          points: [
            lift(this.lerpRaceWorldPoint(farSection.left, farSection.right, t0)),
            lift(this.lerpRaceWorldPoint(farSection.left, farSection.right, t1)),
            lift(this.lerpRaceWorldPoint(nearSection.left, nearSection.right, t1)),
            lift(this.lerpRaceWorldPoint(nearSection.left, nearSection.right, t0))
          ],
          color: index % 2 === 0 ? '#f1f4ef' : '#050807',
          textured: false,
          depthOffset: -0.05,
          minScreenY: null
        });
      }
    };
    if (Number(travel || 0) <= 18) pushStripe(0, 9);
    if (routeRuntimeType !== 'circuit') {
      const finishDistance = Number(routeLength || 1);
      if (finishDistance >= visibleMinDistance - 12 && finishDistance <= visibleMaxDistance + 12) {
        pushStripe(Math.max(0, finishDistance - 10), finishDistance);
      }
    }
    return meshes;
  }

  getRaceThreeTrackPaintMeshes({
    slices = [],
    travel = 0,
    routeLength = 1,
    currentSegment = null,
    weatherState = null
  } = {}) {
    const distances = Array.isArray(slices)
      ? slices.map((slice) => Number(slice?.center?.distance || 0)).filter(Number.isFinite)
      : [];
    if (distances.length < 2) return [];
    const visibleMinDistance = Math.min(...distances);
    const visibleMaxDistance = Math.max(...distances);
    const markerDimensions = this.getRaceLaneMarkerDimensionsWorld();
    const travelDistance = Number.isFinite(Number(travel)) ? Number(travel) : visibleMinDistance;
    const markerLimitDistance = Math.max(markerDimensions.edgePostInterval, markerDimensions.interval) * 5;
    const minDistance = Math.max(visibleMinDistance, travelDistance - markerDimensions.interval);
    const maxDistance = Math.min(visibleMaxDistance, travelDistance + markerLimitDistance);
    const routeRuntimeType = this.playtestSession?.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const allowVisualExtension = routeRuntimeType !== 'circuit';
    const meshes = [];
    const sectionAt = (distance) => this.getRaceRoadCrossSectionAtDistance(distance, {
      routeLength,
      runtimeType: routeRuntimeType,
      allowVisualExtension
    });
    const pushDashAt = (worldDistance) => {
      const startSection = sectionAt(worldDistance);
      const endSection = sectionAt(Math.min(maxDistance, worldDistance + markerDimensions.dashLength));
      const segment = startSection?.center?.segment || currentSegment;
      if (!this.shouldRenderRaceCenterLaneDash(segment)) return;
      const palette = this.getRaceRoadSurfacePalette(this.getRaceEffectiveSurfaceId(segment?.surface || currentSegment?.surface || 'asphalt', weatherState));
      const width = Math.max(0.06, Number(markerDimensions.dashWidth || 0.18));
      const startRight = this.getRaceRightVector(Number(startSection?.center?.yaw || 0));
      const endRight = this.getRaceRightVector(Number(endSection?.center?.yaw || startSection?.center?.yaw || 0));
      const startCenter = startSection.center;
      const endCenter = endSection.center;
      const point = (center = {}, right = {}, sign = 1) => ({
        ...center,
        x: Number(center.x || 0) + Number(right.x || 0) * width * 0.5 * sign,
        z: Number(center.z || 0) + Number(right.z || 0) * width * 0.5 * sign
      });
      meshes.push({
        source: 'road-paint-lane',
        points: [
          point(endCenter, endRight, -1),
          point(endCenter, endRight, 1),
          point(startCenter, startRight, 1),
          point(startCenter, startRight, -1)
        ],
        color: palette.lane,
        textured: false,
        threeLiftM: RACE_THREE_LIFTS_M.paint
      });
    };
    for (let distance = Math.ceil(minDistance / markerDimensions.interval) * markerDimensions.interval; distance <= maxDistance; distance += markerDimensions.interval) {
      pushDashAt(distance);
    }
    return meshes;
  }

  getRaceWebGLTrackPaintMeshes(mode7Bands = [], {
    bounds = {},
    camera = {},
    currentSegment = null,
    weatherState = null,
    slices = [],
    travel = 0,
    routeLength = 1
  } = {}) {
    const roadSlices = Array.isArray(slices) && slices.length > 1
      ? slices
      : [mode7Bands[0]?.near, ...mode7Bands.map((band) => band?.far)].filter(Boolean);
    if (roadSlices.length < 2) return [];
    const meshes = [];
    const markerDimensions = this.getRaceLaneMarkerDimensionsWorld();
    const distances = roadSlices.map((slice) => Number(slice?.center?.distance || 0)).filter(Number.isFinite);
    const visibleMinDistance = Math.min(...distances);
    const visibleMaxDistance = Math.max(...distances);
    const travelDistance = Number.isFinite(Number(travel)) ? Number(travel) : visibleMinDistance;
    const markerLimitDistance = Math.max(markerDimensions.edgePostInterval, markerDimensions.interval) * 5;
    const minDistance = Math.max(visibleMinDistance, travelDistance - markerDimensions.interval);
    const maxDistance = Math.min(visibleMaxDistance, travelDistance + markerLimitDistance);
    const clipTop = this.getRaceProjectedTerrainTop(bounds, camera);
    const markerVisible = (marker = null) => {
      if (!marker?.center || Number(marker.center.screenY || 0) < clipTop) return false;
      const depth = Number(marker.center.cameraZ ?? marker.center.renderZ);
      return !Number.isFinite(depth) || depth >= Math.max(1.2, Number(camera?.nearPlane) || 1.2);
    };
    const getMarker = (worldDistance) => this.getRaceInterpolatedMarkerSlice(roadSlices, worldDistance);
    const pushMesh = (points, options = {}) => {
      const mesh = this.getRaceWebGLPaintMeshFromProjectedQuad(points, bounds, {
        minScreenY: clipTop,
        ...options
      });
      if (mesh) meshes.push(mesh);
    };
    const drawDashAt = (worldDistance) => {
      const startMarker = getMarker(worldDistance);
      const endMarker = getMarker(Math.min(maxDistance, worldDistance + markerDimensions.dashLength)) || getMarker(maxDistance - 0.01);
      if (!startMarker || !endMarker) return;
      if (!markerVisible(startMarker) || !markerVisible(endMarker)) return;
      const segment = startMarker.segment || currentSegment;
      if (!this.shouldRenderRaceCenterLaneDash(segment)) return;
      const palette = this.getRaceRoadSurfacePalette(this.getRaceEffectiveSurfaceId(segment?.surface || currentSegment?.surface || 'asphalt', weatherState));
      const roadScreenWidth = Math.max(1, Math.hypot(
        Number(startMarker.right?.screenX || 0) - Number(startMarker.left?.screenX || 0),
        Number(startMarker.right?.screenY || 0) - Number(startMarker.left?.screenY || 0)
      ));
      const roadWorldWidth = Math.max(0.1, this.getRaceRoadHalfWidthWorld(segment) * 2);
      const markerW = Math.max(1, roadScreenWidth * (markerDimensions.dashWidth / roadWorldWidth));
      pushMesh(this.getRaceProjectedLaneDashQuad(startMarker, endMarker, markerW), {
        color: palette.lane,
        depthOffset: -0.13
      });
    };
    for (let distance = Math.ceil(minDistance / markerDimensions.interval) * markerDimensions.interval; distance <= maxDistance; distance += markerDimensions.interval) {
      drawDashAt(distance);
    }
    return meshes;
  }

  getRaceTerrainSunShade(points = []) {
    if (!Array.isArray(points) || points.length < 4) return 1;
    const sun = this.getRaceSunSettings();
    const intensity = clamp(Number(sun.intensity ?? 0.72), 0, 1);
    if (intensity <= 0.01) return 1;
    const widthX = Math.max(
      0.001,
      Math.abs(Number(points[1]?.x || 0) - Number(points[0]?.x || 0))
      + Math.abs(Number(points[2]?.x || 0) - Number(points[3]?.x || 0))
    ) * 0.5;
    const widthZ = Math.max(
      0.001,
      Math.abs(Number(points[3]?.z || 0) - Number(points[0]?.z || 0))
      + Math.abs(Number(points[2]?.z || 0) - Number(points[1]?.z || 0))
    ) * 0.5;
    const leftElevation = (Number(points[0]?.elevation || 0) + Number(points[3]?.elevation || 0)) * 0.5;
    const rightElevation = (Number(points[1]?.elevation || 0) + Number(points[2]?.elevation || 0)) * 0.5;
    const nearElevation = (Number(points[0]?.elevation || 0) + Number(points[1]?.elevation || 0)) * 0.5;
    const farElevation = (Number(points[2]?.elevation || 0) + Number(points[3]?.elevation || 0)) * 0.5;
    const slopeX = (rightElevation - leftElevation) / widthX;
    const slopeZ = (farElevation - nearElevation) / widthZ;
    const sunYaw = Number(sun.angleDeg || 0) * Math.PI / 180;
    const sunX = Math.sin(sunYaw);
    const sunZ = Math.cos(sunYaw);
    const slopeMagnitude = clamp(Math.hypot(slopeX, slopeZ) * 34, 0, 1);
    const slopeFacing = clamp((slopeX * sunX + slopeZ * sunZ) * 68, -1, 1);
    return clamp(0.72 + slopeFacing * intensity * 0.58 + slopeMagnitude * intensity * 0.18, 0.22, 1.38);
  }

  getRaceTerrainSunTint(points = [], base = '#ffffff') {
    const shade = this.getRaceTerrainSunShade(points);
    const rgba = this.parseRaceCssColor(base);
    return `rgba(${Math.round(rgba[0] * 255 * shade)}, ${Math.round(rgba[1] * 255 * shade)}, ${Math.round(rgba[2] * 255 * shade)}, ${rgba[3]})`;
  }

  getRaceTextureSunTint(points = []) {
    const shade = Math.round(this.getRaceTerrainSunShade(points) * 12) / 12;
    const value = clamp(Math.round(255 * shade), 56, 255);
    return `rgba(${value}, ${value}, ${value}, 1)`;
  }

  shouldUseRacePlaytestSunShading() {
    return this.getRaceRenderDebugSettings().lightingEnabled !== false;
  }

  drawRaceWebGLTrackScene(ctx, bounds, mode7Bands = [], {
    camera = null,
    cameraView = 'third-person',
    cameraYaw = 0,
    currentSegment = null,
    weatherState = null,
    slices = [],
    stableRoadSections = [],
    travel = 0,
    routeLength = 1
  } = {}) {
    const stableSections = Array.isArray(stableRoadSections) && stableRoadSections.length > 1
      ? stableRoadSections
      : Array.isArray(slices) && slices.length > 1
        ? slices
        : [];
    const stableRoadBands = this.getRaceStableRoadBands(stableSections);
    const trackBands = stableRoadBands.length ? stableRoadBands : mode7Bands;
    const trackSlices = stableSections.length > 1 ? stableSections : slices;
    if (this.getRaceGroundRenderer() !== 'webgl-track' || !Array.isArray(trackBands) || !trackBands.length) return false;
    if (!ctx || !camera || typeof ctx.drawImage !== 'function') return false;
    const scanlineSettings = this.getRaceGroundScanlineSettings();
    const renderResolution = this.getRaceWebGLTrackRenderResolution(scanlineSettings);
    const renderWidth = clamp(Math.round(Number(bounds.w || 1) * renderResolution), 1, 32768);
    const renderHeight = clamp(Math.round(Number(bounds.h || 1) * renderResolution), 1, 18432);
    const sceneStartMs = this.getNowMs();
    const renderDebug = this.getRaceRenderDebugSettings();
    const terrainEnabled = renderDebug.terrainEnabled === true;
    const texturesEnabled = renderDebug.texturesEnabled !== false;
    const detailEnabled = renderDebug.detailEnabled === true;
    const terrainCullingEnabled = renderDebug.terrainCullingEnabled !== false;
    const terrainLodEnabled = renderDebug.terrainLodEnabled !== false;
    const terrainBudgetEnabled = renderDebug.terrainBudgetEnabled !== false;
    const farRoadDecimationEnabled = renderDebug.farRoadDecimationEnabled !== false;
    const threeEnabled = renderDebug.threeEnabled === true;
    const rawTerrainPolygonsEnabled = renderDebug.rawTerrainPolygonsEnabled === true;
    const tileMap = terrainEnabled || texturesEnabled ? this.ensureRaceTileMap() : null;
    const tileMapStats = terrainEnabled || texturesEnabled
      ? this.getRaceTileMapStats(tileMap)
      : { dominantArtRef: '', hasPaintedTerrainCells: false };
    const fallbackArtRef = texturesEnabled ? tileMapStats.dominantArtRef : '';
    const artCanvas = fallbackArtRef ? this.getRaceArtSpriteCanvas(fallbackArtRef) : null;
    const renderStats = {
      polygons: 0,
      drawCalls: 0,
      bufferUploads: 0,
      bufferReallocations: 0,
      uploadedFloats: 0,
      terrainCandidates: 0,
      terrainCandidatesBeforeBudget: 0,
      terrainCells: 0,
      terrainSubdivisions: 0,
      terrainBaseTriangles: 0,
      terrainRefinementTriangles: 0,
      terrainCoverageDropped: 0,
      terrainRefinementDropped: 0,
      terrainDetailEnabled: detailEnabled,
      terrainCullingEnabled,
      terrainLodEnabled,
      terrainBudgetEnabled,
      farRoadDecimationEnabled,
      trackEnabled: true,
      overlaysEnabled: renderDebug.overlaysEnabled !== false,
      threeEnabled,
      rawTerrainPolygonsEnabled,
      bakedTerrainChunks: 0,
      bakedTerrainHits: 0,
      bakedTerrainGenerated: 0,
      terrainBudgetDropped: 0,
      terrainPreculled: 0,
      terrainProjectionSkipped: 0,
      terrainProjectionNearSkipped: 0,
      terrainProjectionOffscreenSkipped: 0,
      terrainProjectionFloorSkipped: 0,
      terrainProjectionDegenerateSkipped: 0,
      terrainCoverageMisses: 0,
      terrainRoadCorridorSkipped: 0,
      terrainLod0: 0,
      terrainLod1: 0,
      terrainLod2: 0,
      terrainLod3: 0,
      mode7Bands: mode7Bands.length,
      stableRoadSections: stableSections.length,
      stableRoadBands: stableRoadBands.length,
      meshBuildMs: 0,
      webglUploadDrawMs: 0,
      webglCompositeMs: 0,
      terrainBuildMs: 0,
      textureUploads: 0,
      requestedRenderScale: renderResolution,
      webglTargetScale: 1,
      webglRenderWidth: renderWidth,
      webglRenderHeight: renderHeight,
      terrainMeshTexturePolygons: 0
    };
    const texturedTerrainCanvas = terrainEnabled && texturesEnabled ? artCanvas : null;
    const baseWorldM = this.getRaceGroundTextureBaseWorldM();
    const textureWorldM = texturedTerrainCanvas
      ? Math.max(baseWorldM, (Number(texturedTerrainCanvas.width || 1) / RACE_GROUND_TEXTURE_BASE_PX) * baseWorldM)
      : baseWorldM;
    const roadMinScreenY = this.getRaceProjectedTerrainTop(bounds, camera);
    const useSunShading = this.shouldUseRacePlaytestSunShading();
    let terrainCells = [];
    let terrainBake = null;
    if (terrainEnabled) {
      const baseTileSize = Math.max(1, Number(tileMap?.cellSizeM) || RACE_TILE_MAP_CELL_SIZE_M);
      const terrainSize = Math.max(detailEnabled ? 40 : 120, baseTileSize * (detailEnabled ? 8 : 24));
      terrainBake = this.getRaceTerrainBakeCache(tileMap, terrainSize);
      const roadFarCameraZ = Math.max(
        560,
        ...trackBands.flatMap((quad) => [
          Number(quad?.far?.center?.cameraZ || quad?.far?.center?.renderZ || 0),
          Number(quad?.far?.shoulderLeft?.cameraZ || quad?.far?.shoulderLeft?.renderZ || 0),
          Number(quad?.far?.shoulderRight?.cameraZ || quad?.far?.shoulderRight?.renderZ || 0)
        ]).filter(Number.isFinite)
      );
      const {
        terrainForwardDistance,
        terrainCellRadius,
        maxTerrainCells,
        maxTerrainTriangles
      } = this.getRaceTerrainRenderLimits({
        terrainSize,
        roadFarCameraZ,
        detailEnabled,
        terrainBudgetEnabled
      });
      const centerCellX = Math.round(Number(camera.x || 0) / terrainSize);
      const centerCellZ = Math.round(Number(camera.z || 0) / terrainSize);
      const rightVector = this.getRaceRightVector(cameraYaw);
      const forwardVector = this.getRaceForwardVector(cameraYaw);
      const routeRuntimeType = this.playtestSession?.routeRuntimeType || this.getSelectedRaceRuntimeType();
      const roadCorridorSkipTolerance = 0.25;
      const worldBake = this.playtestSession?.worldBake;
      if (worldBake?.terrainCells?.length && Number(worldBake.terrainSize || 0) === terrainSize) {
        const bakedVisibleCells = this.getRaceVisibleWorldBakeTerrainCells(worldBake, {
          camera,
          cameraYaw,
          bounds,
          terrainForwardDistance,
          maxTerrainCells,
          maxTerrainTriangles,
          terrainCullingEnabled,
          rightVector,
          forwardVector,
          stats: renderStats
        });
        terrainCells = bakedVisibleCells;
        renderStats.terrainCandidates = (Number(renderStats.terrainCandidates) || 0) + worldBake.terrainCells.length;
        renderStats.terrainSubdivisions = (Number(renderStats.terrainSubdivisions) || 0) + bakedVisibleCells.length;
        renderStats.terrainWorldBakeCells = worldBake.terrainCells.length;
        renderStats.terrainWorldBakeChunks = worldBake.terrainChunks?.length || 0;
        renderStats.terrainWorldBakeMs = Number(worldBake.builtMs || 0);
      } else {
      const terrainCandidates = [];
      const pushTerrainQuad = (points, tileCell, { alreadyBoundsVisible = false } = {}) => {
        if (terrainCells.length >= maxTerrainCells) return;
        if (!Array.isArray(points) || points.length < 4) return;
        const cameraBounds = this.getRaceTerrainCameraBounds(points, camera, rightVector, forwardVector);
        if (terrainCullingEnabled && !alreadyBoundsVisible && !this.isRaceTerrainCameraBoundsVisible(cameraBounds, {
          terrainSize,
          terrainForwardDistance,
          screenWidth: Number(bounds.w || 1),
          forwardMargin: terrainSize * 2,
          lateralMargin: terrainSize
        })) {
          renderStats.terrainPreculled += 1;
          return;
        }
        terrainCells.push({ points, averageCameraZ: cameraBounds.averageCameraZ, tileCell });
      };
      for (let z = centerCellZ - terrainCellRadius; z <= centerCellZ + terrainCellRadius; z += 1) {
        for (let x = centerCellX - terrainCellRadius; x <= centerCellX + terrainCellRadius; x += 1) {
          const x0 = x * terrainSize;
          const z0 = z * terrainSize;
          const chunk = this.getRaceBakedTerrainChunk(x, z, terrainSize, tileMap, terrainBake);
          if (!this.shouldIncludeRaceTerrainChunkForRendering(chunk)) continue;
          const cameraBounds = this.getRaceTerrainCameraBounds(chunk.fullPoints, camera, rightVector, forwardVector);
          if (terrainCullingEnabled && !this.isRaceTerrainCameraBoundsVisible(cameraBounds, {
            terrainSize,
            terrainForwardDistance,
            screenWidth: Number(bounds.w || 1),
            forwardMargin: terrainSize * 2,
            lateralMargin: terrainSize
          })) continue;
          renderStats.terrainCandidates += 1;
          terrainCandidates.push({
            cameraCellX: (Number(cameraBounds.minCameraX) + Number(cameraBounds.maxCameraX)) * 0.5,
            cameraCellZ: (Number(cameraBounds.minCameraZ) + Number(cameraBounds.maxCameraZ)) * 0.5,
            chunk
          });
        }
      }
      terrainCandidates
        .sort((a, b) => this.compareRaceTerrainCandidates(a, b, terrainSize));
      for (let candidateIndex = 0; candidateIndex < terrainCandidates.length; candidateIndex += 1) {
        if (terrainCells.length >= maxTerrainCells) {
          renderStats.terrainBudgetDropped = terrainCandidates.length - candidateIndex;
          break;
        }
        const candidate = terrainCandidates[candidateIndex];
        const { cameraCellX, cameraCellZ, chunk } = candidate;
        let subdivisions = this.getRaceBakedTerrainSubdivision(chunk, cameraCellZ, {
          cameraCellX,
          detailEnabled: detailEnabled && terrainLodEnabled,
          textured: Boolean(texturedTerrainCanvas)
        });
        if (detailEnabled && terrainLodEnabled && chunk.roadAdjacent) {
          subdivisions = Math.max(subdivisions, this.getRaceRoadbedTerrainSubdivision(chunk, terrainSize));
        }
        const remainingTerrainCells = maxTerrainCells - terrainCells.length;
        if (!chunk.roadAdjacent && subdivisions * subdivisions > remainingTerrainCells) {
          subdivisions = remainingTerrainCells >= 1 ? 1 : subdivisions;
        }
        const chunkTouchesRoadCorridor = chunk.nearRoad
          && Number(cameraCellZ || 0) > -terrainSize * 2
          && Number(cameraCellZ || 0) < 360
          && Math.abs(Number(cameraCellX || 0)) < terrainSize * 5
          && Number(chunk.corridorDistance || 0) <= Math.max(18, terrainSize * 0.32);
        if (chunkTouchesRoadCorridor) {
          subdivisions = Math.max(
            subdivisions,
            detailEnabled ? this.getRaceRoadbedTerrainSubdivision(chunk, terrainSize) : 3
          );
        }
        const lodKey = `terrainLod${subdivisions - 1}`;
        renderStats[lodKey] = (Number(renderStats[lodKey]) || 0) + 1;
        for (let subZ = 0; subZ < subdivisions; subZ += 1) {
          for (let subX = 0; subX < subdivisions; subX += 1) {
            const quadPoints = this.getRaceBakedTerrainQuadPoints(chunk, subX, subZ, subdivisions);
            if (chunkTouchesRoadCorridor && this.isRaceTerrainQuadInsideRoadCorridor(quadPoints, {
              tolerance: roadCorridorSkipTolerance,
              runtimeType: routeRuntimeType,
              includeTransition: false
            })) {
              renderStats.terrainRoadCorridorSkipped += 1;
              continue;
            }
            pushTerrainQuad(quadPoints, chunk.tileCell, { alreadyBoundsVisible: true });
            renderStats.terrainSubdivisions += 1;
          }
        }
      }
      }
    }
    renderStats.terrainCells = terrainCells.length;
    renderStats.terrainEnabled = terrainEnabled;
    renderStats.texturesEnabled = texturesEnabled;
    renderStats.lightingEnabled = renderDebug.lightingEnabled !== false;
    renderStats.detailEnabled = detailEnabled;
    renderStats.terrainCullingEnabled = terrainCullingEnabled;
    renderStats.terrainLodEnabled = terrainLodEnabled;
    renderStats.terrainBudgetEnabled = terrainBudgetEnabled;
    renderStats.farRoadDecimationEnabled = farRoadDecimationEnabled;
    renderStats.threeEnabled = threeEnabled;
    renderStats.rawTerrainPolygonsEnabled = rawTerrainPolygonsEnabled;
    renderStats.nearTextureQuality = this.getRaceGroundNearTextureQuality();
    renderStats.textureFilterMode = this.getRaceGroundTextureFilterMode();
    renderStats.terrainForwardDistance = terrainEnabled ? Math.round(Number(this.getRaceTerrainRenderLimits({
      terrainSize: Math.max(detailEnabled ? 40 : 120, Math.max(1, Number(tileMap?.cellSizeM) || RACE_TILE_MAP_CELL_SIZE_M) * (detailEnabled ? 8 : 24)),
      roadFarCameraZ: Math.max(
        560,
        ...trackBands.flatMap((quad) => [
          Number(quad?.far?.center?.cameraZ || quad?.far?.center?.renderZ || 0),
          Number(quad?.far?.shoulderLeft?.cameraZ || quad?.far?.shoulderLeft?.renderZ || 0),
          Number(quad?.far?.shoulderRight?.cameraZ || quad?.far?.shoulderRight?.renderZ || 0)
        ]).filter(Number.isFinite)
      ),
      detailEnabled,
      terrainBudgetEnabled
    }).terrainForwardDistance)) : 0;
    renderStats.bakedTerrainChunks = terrainBake?.chunks?.size || 0;
    renderStats.bakedTerrainHits = terrainBake?.frameHits || 0;
    renderStats.bakedTerrainGenerated = terrainBake?.frameGenerated || 0;
    if (sceneStartMs > 0) renderStats.terrainBuildMs = Math.max(0, this.getNowMs() - sceneStartMs);
    const shoulderMeshes = [];
    if (terrainEnabled) {
      shoulderMeshes.push(...this.getRaceRoadsideTerrainBlendMeshes(trackBands, {
        currentSegment,
        routeLength,
        runtimeType: this.playtestSession?.routeRuntimeType || this.getSelectedRaceRuntimeType(),
        allowVisualExtension: (this.playtestSession?.routeRuntimeType || this.getSelectedRaceRuntimeType()) !== 'circuit',
        useSunShading,
        minScreenY: roadMinScreenY,
        artRef: fallbackArtRef,
        textured: Boolean(texturesEnabled && fallbackArtRef),
        textureWorldM
      }));
    }
    const roadMeshes = [];
    const boundaryMeshes = [];
    trackBands.forEach((quad) => {
      const { near, far } = quad;
      shoulderMeshes.push(...this.getRaceShoulderSurfaceMeshesForBand(quad, {
        currentSegment,
        fallbackArtRef,
        texturesEnabled,
        textureWorldM,
        useSunShading,
        minScreenY: roadMinScreenY
      }));
      boundaryMeshes.push(...this.getRaceWebGLBoundaryStripMeshes(near, far, { minScreenY: roadMinScreenY }));
    });
    trackBands.forEach((quad) => {
      const { near, far } = quad;
      const surfaceId = this.getRaceEffectiveSurfaceId(
        near?.center?.segment?.surface || currentSegment?.surface || 'asphalt',
        weatherState
      );
      const palette = this.getRaceRoadSurfacePalette(surfaceId);
      const roadPoints = [far.left, far.right, near.right, near.left];
      const roadArtRef = texturesEnabled ? this.getRaceSurfaceArtRefForSurface(surfaceId) : '';
      roadMeshes.push({
        source: 'road',
        points: roadPoints,
        color: useSunShading ? this.getRaceTerrainSunTint(roadPoints, palette.roadA) : palette.roadA,
        artRef: roadArtRef,
        textured: Boolean(texturesEnabled && roadArtRef),
        textureWorldM,
        depthOffset: -0.08,
        threeLiftM: RACE_THREE_LIFTS_M.road,
        minScreenY: roadMinScreenY
      });
    });
    const canDrawThreeTerrain = threeEnabled && terrainEnabled && terrainCells.length > 0;
    const overlaysEnabled = renderDebug.overlaysEnabled !== false;
    const roadPaintMeshes = canDrawThreeTerrain && overlaysEnabled
      ? this.getRaceThreeTrackPaintMeshes({
        slices: trackSlices,
        travel,
        routeLength,
        currentSegment,
        weatherState
      })
      : [];
    const trackFurnitureMeshes = overlaysEnabled ? [
      ...this.getRaceWebGLCheckerStripeMeshes({
        travel,
        routeLength,
        slices: trackSlices
      }),
      ...this.getRaceWebGLRoadsidePostMeshes(trackSlices, {
        travel,
        routeLength,
        camera
      })
    ] : [];
    const drewThreeTerrain = canDrawThreeTerrain && this.drawRaceThreeWorldScene(ctx, bounds, terrainCells, {
      camera,
      cameraView,
      cameraYaw,
      textureWorldM,
      artRef: fallbackArtRef,
      textured: Boolean(texturedTerrainCanvas),
      tileMap,
      useSunShading,
      shoulderMeshes,
      roadMeshes,
      boundaryMeshes,
      roadPaintMeshes,
      trackFurnitureMeshes,
      stats: renderStats
    });
    if (drewThreeTerrain) {
      const compositeStartMs = this.getNowMs();
      renderStats.webglCompositeMs = 0;
      renderStats.webglMs = Number(renderStats.threeRenderMs || 0);
      if (compositeStartMs > 0) renderStats.webglTrackMs = Math.max(0, this.getNowMs() - sceneStartMs);
      this.lastRaceRenderStats = renderStats;
      return true;
    }
    const renderer = this.getRaceWebGLGroundRenderer(renderWidth, renderHeight);
    if (!renderer?.gl) return false;
    const actualRenderWidth = Math.max(1, Number(renderer.canvas?.width || renderWidth));
    const actualRenderHeight = Math.max(1, Number(renderer.canvas?.height || renderHeight));
    renderStats.webglTargetScale = Number(renderer.lastTargetScale || 1);
    renderStats.webglRenderWidth = actualRenderWidth;
    renderStats.webglRenderHeight = actualRenderHeight;
    const { gl } = renderer;
    const textureKey = texturedTerrainCanvas
      ? `${fallbackArtRef}:${Number(artCanvas.width || 0)}x${Number(artCanvas.height || 0)}`
      : '';
    gl.viewport(0, 0, actualRenderWidth, actualRenderHeight);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clearDepth(1);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, renderer.texture);
    let canMipmap = false;
    let wrap = gl.CLAMP_TO_EDGE;
    if (texturedTerrainCanvas) {
      const powerOfTwo = (value) => value > 0 && (value & (value - 1)) === 0;
      canMipmap = powerOfTwo(Number(texturedTerrainCanvas.width || 0)) && powerOfTwo(Number(texturedTerrainCanvas.height || 0));
      wrap = canMipmap ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    }
    if (texturedTerrainCanvas && renderer.textureKey !== textureKey) {
      const uploadStartMs = this.getNowMs();
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texturedTerrainCanvas);
      if (canMipmap) gl.generateMipmap(gl.TEXTURE_2D);
      renderer.textureKey = textureKey;
      renderStats.textureUploads += 1;
      if (uploadStartMs > 0) renderStats.textureUploadMs = (Number(renderStats.textureUploadMs) || 0) + Math.max(0, this.getNowMs() - uploadStartMs);
    }
    if (texturedTerrainCanvas) {
      this.applyRaceWebGLTextureSettings(renderer, {
        canMipmap,
        wrap,
        filterMode: this.getRaceGroundTextureFilterMode(),
        nearQuality: this.getRaceGroundNearTextureQuality(),
        stats: renderStats
      });
    }
    if (terrainCells.length) {
      this.drawRaceWebGLTerrainMeshBatch(ctx, bounds, renderer, terrainCells, {
        camera,
        cameraYaw,
        textureWorldM,
        textured: Boolean(texturedTerrainCanvas),
        tileMap,
        useSunShading,
        stats: renderStats
      });
    }
    const opaqueTrackMeshes = [
      ...shoulderMeshes,
      ...roadMeshes,
      ...boundaryMeshes
    ];
    this.drawRaceWebGLWorldMeshBatch(ctx, bounds, renderer, opaqueTrackMeshes, {
      camera,
      cameraYaw,
      textureWorldM,
      stats: renderStats
    });
    const furniturePolygonsBefore = Number(renderStats.polygons || 0);
    const furnitureDrawCallsBefore = Number(renderStats.drawCalls || 0);
    this.drawRaceWebGLWorldMeshBatch(ctx, bounds, renderer, trackFurnitureMeshes, {
      camera,
      cameraYaw,
      textureWorldM,
      stats: renderStats
    });
    renderStats.trackFurniturePolygons = Math.max(0, Number(renderStats.polygons || 0) - furniturePolygonsBefore);
    renderStats.trackFurnitureDrawCalls = Math.max(0, Number(renderStats.drawCalls || 0) - furnitureDrawCallsBefore);
    const paintPolygonsBefore = Number(renderStats.polygons || 0);
    const paintDrawCallsBefore = Number(renderStats.drawCalls || 0);
    if (overlaysEnabled) {
      const fallbackRoadPaintMeshes = this.getRaceWebGLTrackPaintMeshes(mode7Bands, {
        bounds,
        camera,
        currentSegment,
        weatherState,
        slices: trackSlices,
        travel,
        routeLength
      });
      this.drawRaceWebGLWorldMeshBatch(ctx, bounds, renderer, fallbackRoadPaintMeshes, {
        camera,
        cameraYaw,
        textureWorldM,
        stats: renderStats,
        depthTest: false
      });
    }
    renderStats.roadPaintPolygons = Math.max(0, Number(renderStats.polygons || 0) - paintPolygonsBefore);
    renderStats.roadPaintDrawCalls = Math.max(0, Number(renderStats.drawCalls || 0) - paintDrawCallsBefore);
    const compositeStartMs = this.getNowMs();
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(renderer.canvas, bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.imageSmoothingEnabled = previousSmoothing;
    if (compositeStartMs > 0) renderStats.webglCompositeMs = Math.max(0, this.getNowMs() - compositeStartMs);
    renderStats.webglMs = Number(renderStats.webglUploadDrawMs || 0) + Number(renderStats.webglCompositeMs || 0);
    if (sceneStartMs > 0) renderStats.webglTrackMs = Math.max(0, this.getNowMs() - sceneStartMs);
    this.lastRaceRenderStats = renderStats;
    return true;
  }

  drawRaceStableGroundTextureLayer(ctx, bounds, renderer = null, {
    camera = null,
    cameraYaw = 0,
    stats = null
  } = {}) {
    if (!ctx || !camera || !renderer?.gl || !renderer.program) return false;
    const tileMap = this.ensureRaceTileMap();
    const fallbackArtRef = this.getRaceDominantGroundArtRef(tileMap);
    const artCanvas = fallbackArtRef ? this.getRaceArtSpriteCanvas(fallbackArtRef) : null;
    if (!artCanvas) return false;
    const { gl } = renderer;
    const renderWidth = Math.max(1, Number(renderer.canvas?.width || 1));
    const renderHeight = Math.max(1, Number(renderer.canvas?.height || 1));
    const groundTop = this.getRaceProjectedTerrainTop(bounds, camera);
    const groundTopRatio = clamp((groundTop - Number(bounds.y || 0)) / Math.max(1, Number(bounds.h || 1)), 0, 1);
    const groundPixels = clamp(Math.ceil(renderHeight * (1 - groundTopRatio)), 1, renderHeight);
    const textureKey = `${fallbackArtRef}:${Number(artCanvas.width || 0)}x${Number(artCanvas.height || 0)}`;
    gl.useProgram(renderer.program);
    gl.viewport(0, 0, renderWidth, renderHeight);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, renderWidth, groundPixels);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffer);
    gl.enableVertexAttribArray(renderer.locations.position);
    gl.vertexAttribPointer(renderer.locations.position, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, renderer.texture);
    const powerOfTwo = (value) => value > 0 && (value & (value - 1)) === 0;
    const canMipmap = powerOfTwo(Number(artCanvas.width || 0)) && powerOfTwo(Number(artCanvas.height || 0));
    const wrap = canMipmap ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    if (renderer.textureKey !== textureKey) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artCanvas);
      if (canMipmap) gl.generateMipmap(gl.TEXTURE_2D);
      renderer.textureKey = textureKey;
      if (stats) stats.textureUploads = (Number(stats.textureUploads) || 0) + 1;
    }
    this.applyRaceWebGLTextureSettings(renderer, {
      canMipmap,
      wrap,
      filterMode: this.getRaceGroundTextureFilterMode(),
      nearQuality: this.getRaceGroundNearTextureQuality(),
      stats
    });
    const baseWorldM = this.getRaceGroundTextureBaseWorldM();
    const textureWorldW = Math.max(baseWorldM, (Number(artCanvas.width || 1) / RACE_GROUND_TEXTURE_BASE_PX) * baseWorldM);
    const textureWorldH = Math.max(baseWorldM, (Number(artCanvas.height || 1) / RACE_GROUND_TEXTURE_BASE_PX) * baseWorldM);
    const focal = Math.max(140, Number(bounds.w || 1) * (Number(camera.focalScale) || 1.04));
    const roadWidthScale = Number(camera.roadWidthScale) || 2.2;
    const lateralScale = (Number(bounds.w || 1) * 0.5) / Math.max(0.001, roadWidthScale * focal);
    gl.uniform1i(renderer.locations.textureSampler, 0);
    gl.uniform2f(renderer.locations.textureWorldM, textureWorldW, textureWorldH);
    gl.uniform2f(renderer.locations.cameraXZ, Number(camera.x || 0), Number(camera.z || 0));
    gl.uniform1f(renderer.locations.cameraYaw, Number(cameraYaw || 0));
    gl.uniform1f(renderer.locations.horizonRatio, Number(camera.horizonRatio) || 0.31);
    gl.uniform1f(renderer.locations.groundTopRatio, groundTopRatio);
    gl.uniform1f(renderer.locations.roadDepthRatio, Number(camera.roadDepthRatio) || 0.7);
    gl.uniform1f(renderer.locations.nearPlane, Math.max(1.2, Number(camera.nearPlane) || 1.6));
    gl.uniform1f(renderer.locations.lateralScale, lateralScale);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    if (stats) {
      stats.stableGroundTextureLayer = 1;
      stats.stableGroundTextureArtRef = fallbackArtRef;
      stats.stableGroundTexturePixels = renderWidth * groundPixels;
    }
    return true;
  }

  getRaceProjectedGroundSampleColor(world = {}, {
    tileMap = this.ensureRaceTileMap(),
    fallbackArtRef = '',
    fallbackPalette = null,
    samplerCache = null,
    footprintWorldM = 0
  } = {}) {
    const cellSize = Math.max(1, Number(tileMap?.cellSizeM) || RACE_TILE_MAP_CELL_SIZE_M);
    const coords = this.getRaceTileMapCellCoords(world, tileMap);
    const cell = this.getRaceTileMapCell(coords.cellX, coords.cellY, tileMap);
    const artRef = String(cell?.artRef || cell?.tileArtRef || fallbackArtRef || '').trim();
    const palette = fallbackPalette || this.getRaceWeightedGroundTilePalette(cell?.tileWeights, cell?.tileId || tileMap?.defaultTileId || 'grass');
    let sampler = null;
    if (artRef) {
      if (samplerCache?.has?.(artRef)) sampler = samplerCache.get(artRef);
      else {
        sampler = this.getRaceArtTextureSampler(artRef);
        samplerCache?.set?.(artRef, sampler);
      }
    }
    if (sampler) {
      const baseWorldM = this.getRaceGroundTextureBaseWorldM();
      const textureWidthM = Math.max(baseWorldM, (Number(sampler.worldWidthUnits) || 1) * baseWorldM);
      const textureHeightM = Math.max(baseWorldM, (Number(sampler.worldHeightUnits) || 1) * baseWorldM);
      const u = Number(world.x || 0) / textureWidthM;
      const v = Number(world.z || 0) / textureHeightM;
      const footprint = clamp((Number(footprintWorldM) || 0) / Math.max(0.001, Math.min(textureWidthM, textureHeightM)), 0, 0.08);
      const mipSettings = this.getRaceGroundMipSettings();
      const averageSample = sampler.terrainAverageSample || sampler.averageSample;
      if (averageSample && mipSettings.strength > 0 && footprint > mipSettings.start) {
        const adjustedFootprint = footprint * mipSettings.strength;
        const averaged = averageSample(u, v, adjustedFootprint);
        if (typeof averaged === 'string') {
          const match = averaged.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
          if (match) {
            return {
              r: clamp(Math.round(Number(match[1]) || 0), 0, 255),
              g: clamp(Math.round(Number(match[2]) || 0), 0, 255),
              b: clamp(Math.round(Number(match[3]) || 0), 0, 255),
              a: clamp(Math.round((match[4] === undefined ? 1 : Number(match[4]) || 0) * 255), 0, 255),
              css: averaged
            };
          }
        }
      }
      const readColor = sampler.readTerrainColor || sampler.readColor;
      if (readColor) {
        const raw = readColor(u, v);
        if (raw) {
          return {
            r: clamp(Math.round(raw.r), 0, 255),
            g: clamp(Math.round(raw.g), 0, 255),
            b: clamp(Math.round(raw.b), 0, 255),
            a: clamp(Math.round(raw.a * 255), 0, 255),
            css: `rgba(${Math.round(raw.r)}, ${Math.round(raw.g)}, ${Math.round(raw.b)}, ${raw.a})`
          };
        }
      }
      const color = sampler.terrainSample?.(u, v) || sampler.sample?.(u, v);
      if (typeof color === 'string') {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
        if (match) {
          return {
            r: clamp(Math.round(Number(match[1]) || 0), 0, 255),
            g: clamp(Math.round(Number(match[2]) || 0), 0, 255),
            b: clamp(Math.round(Number(match[3]) || 0), 0, 255),
            a: clamp(Math.round((match[4] === undefined ? 1 : Number(match[4]) || 0) * 255), 0, 255),
            css: color
          };
        }
      }
      if (!sampler.readColor) return { r: 49, g: 87, b: 52, a: 255, css: color || palette?.groundA || '#315734' };
    }
    return { r: 49, g: 87, b: 52, a: 255, css: palette?.groundA || '#315734' };
  }

  drawRaceProjectedFlatTileMap(ctx, bounds, bands = [], { camera = null, cameraYaw = 0 } = {}) {
    if (!camera) return false;
    if (this.getRaceGroundRenderer() === 'webgl' && this.drawRaceWebGLGroundPlane(ctx, bounds, { camera, cameraYaw })) {
      return true;
    }
    const tileMap = this.ensureRaceTileMap();
    if (!tileMap) return false;
    const fallbackArtRef = this.getRaceDominantGroundArtRef(tileMap);
    if (!fallbackArtRef && !Object.keys(tileMap.cells || {}).length) return false;
    const h = Number(bounds.h || 1);
    const groundTop = this.getRaceProjectedTerrainTop(bounds, camera);
    const groundHeight = Math.max(1, Math.ceil(Number(bounds.y || 0) + h - groundTop));
    const scanlineSettings = this.getRaceGroundScanlineSettings();
    const renderWidth = clamp(Math.round(Number(bounds.w || 1) * scanlineSettings.resolution), 1, 2560);
    const rowStep = clamp(Number(scanlineSettings.rowStep) || 1, RACE_GROUND_SCANLINE_ROW_STEP_MIN, RACE_GROUND_SCANLINE_ROW_STEP_MAX);
    const renderHeight = clamp(Math.ceil(groundHeight / rowStep), 1, 2048);
    const canUseBuffer = typeof document !== 'undefined' && typeof document.createElement === 'function' && typeof ctx.drawImage === 'function';
    const samplerCache = new Map();
    ctx.save();
    if (typeof ctx.rect === 'function' && typeof ctx.clip === 'function') {
      ctx.beginPath();
      ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.clip();
    }
    if (canUseBuffer) {
      if (!this.raceProjectedGroundBuffer) this.raceProjectedGroundBuffer = document.createElement('canvas');
      const canvas = this.raceProjectedGroundBuffer;
      if (canvas.width !== renderWidth) canvas.width = renderWidth;
      if (canvas.height !== renderHeight) canvas.height = renderHeight;
      const bufferCtx = canvas.getContext?.('2d');
      if (bufferCtx?.createImageData && bufferCtx?.putImageData) {
        const imageData = bufferCtx.createImageData(renderWidth, renderHeight);
        const bottom = Number(bounds.y || 0) + h;
        const screenRowsPerBufferRow = groundHeight / Math.max(1, renderHeight);
        for (let bufferY = 0; bufferY < renderHeight; bufferY += 1) {
          const screenY = groundTop + (bufferY + 0.5) * screenRowsPerBufferRow;
          const rowT = clamp((screenY - groundTop) / Math.max(1, groundHeight), 0, 1);
          const centerWorld = this.screenToRaceGroundWorldPoint(Number(bounds.x || 0) + Number(bounds.w || 1) / 2, screenY, bounds, { camera, cameraYaw });
          const nextRowWorld = this.screenToRaceGroundWorldPoint(Number(bounds.x || 0) + Number(bounds.w || 1) / 2, Math.min(bottom, screenY + screenRowsPerBufferRow), bounds, { camera, cameraYaw });
          const rowFootprintM = rowT < 0.5 ? Math.hypot(
            Number(nextRowWorld.x || 0) - Number(centerWorld.x || 0),
            Number(nextRowWorld.z || 0) - Number(centerWorld.z || 0)
          ) * 0.32 : 0;
          for (let x = 0; x < renderWidth; x += 1) {
            const screenX = Number(bounds.x || 0) + (x + 0.5) / renderWidth * Number(bounds.w || 1);
            const world = this.screenToRaceGroundWorldPoint(screenX, screenY, bounds, { camera, cameraYaw });
            const color = this.getRaceProjectedGroundSampleColor(world, { tileMap, fallbackArtRef, samplerCache, footprintWorldM: rowFootprintM });
            const offset = (bufferY * renderWidth + x) * 4;
            imageData.data[offset] = color.r;
            imageData.data[offset + 1] = color.g;
            imageData.data[offset + 2] = color.b;
            imageData.data[offset + 3] = color.a;
          }
        }
        bufferCtx.putImageData(imageData, 0, 0);
        const previousSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, bounds.x, groundTop, bounds.w, groundHeight);
        ctx.imageSmoothingEnabled = previousSmoothing;
        ctx.restore();
        return true;
      }
    }
    const rows = 34;
    const cols = 54;
    for (let row = 0; row < rows; row += 1) {
      const y0 = groundTop + (row / rows) * groundHeight;
      const y1 = groundTop + ((row + 1) / rows) * groundHeight + 1;
      for (let col = 0; col < cols; col += 1) {
        const x0 = Number(bounds.x || 0) + (col / cols) * Number(bounds.w || 1);
        const x1 = Number(bounds.x || 0) + ((col + 1) / cols) * Number(bounds.w || 1) + 1;
        const world = this.screenToRaceGroundWorldPoint((x0 + x1) / 2, (y0 + y1) / 2, bounds, { camera, cameraYaw });
        const color = this.getRaceProjectedGroundSampleColor(world, { tileMap, fallbackArtRef, samplerCache });
        ctx.fillStyle = color.css;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
    ctx.restore();
    return true;
  }

  drawRaceProjectedDecals(ctx, bounds, { camera = {}, cameraYaw = 0, kind = null } = {}) {
    const decals = this.ensureRaceDecals();
    if (!decals.length) return;
    decals.forEach((decal) => {
      if (kind && String(decal.kind || 'decal') !== kind) return;
      const artCanvas = this.getRaceArtSpriteCanvas(decal.artRef);
      if (!artCanvas || typeof ctx.drawImage !== 'function') return;
      const width = Math.max(0.25, Number(decal.widthM) || 3.2);
      const height = Math.max(0.25, Number(decal.heightM) || width);
      const yaw = Number(decal.rotation || 0);
      const rightVector = this.getRaceRightVector(yaw);
      const forwardVector = this.getRaceForwardVector(yaw);
      const right = { x: rightVector.x * width / 2, z: rightVector.z * width / 2 };
      const forward = { x: forwardVector.x * height / 2, z: forwardVector.z * height / 2 };
      const elevation = this.getRaceSurfaceModel().sampleWorld({ x: decal.x, z: decal.z }, 0).elevation + 0.004;
      const corners = [
        { x: decal.x - right.x - forward.x, z: decal.z - right.z - forward.z, elevation },
        { x: decal.x + right.x - forward.x, z: decal.z + right.z - forward.z, elevation },
        { x: decal.x + right.x + forward.x, z: decal.z + right.z + forward.z, elevation },
        { x: decal.x - right.x + forward.x, z: decal.z - right.z + forward.z, elevation }
      ].map((point) => this.projectRaceWorldPointToCamera(point, camera, cameraYaw, bounds));
      const polygon = this.getRaceNearClippedProjectedPolygon(corners, camera, bounds);
      if (polygon.length < 3) return;
      const minX = Math.max(bounds.x, Math.min(...polygon.map((point) => Number(point.screenX))));
      const maxX = Math.min(bounds.x + bounds.w, Math.max(...polygon.map((point) => Number(point.screenX))));
      const minY = Math.max(bounds.y, Math.min(...polygon.map((point) => Number(point.screenY))));
      const maxY = Math.min(bounds.y + bounds.h, Math.max(...polygon.map((point) => Number(point.screenY))));
      if (maxX <= minX || maxY <= minY) return;
      ctx.save();
      ctx.beginPath();
      if (decal.shape === 'oval') {
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        if (typeof ctx.ellipse === 'function') ctx.ellipse(cx, cy, (maxX - minX) / 2, (maxY - minY) / 2, 0, 0, Math.PI * 2);
        else {
          ctx.arc(cx, cy, Math.min(maxX - minX, maxY - minY) / 2, 0, Math.PI * 2);
        }
      } else {
        ctx.moveTo(polygon[0].screenX, polygon[0].screenY);
        polygon.slice(1).forEach((point) => ctx.lineTo(point.screenX, point.screenY));
        ctx.closePath();
      }
      ctx.clip?.();
      ctx.globalAlpha = 0.78;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(artCanvas, minX, minY, maxX - minX, maxY - minY);
      ctx.restore();
    });
  }

  drawRaceProjectedRoadPath(ctx, bounds, { showPlaytestHud = true } = {}) {
    const race = this.selectedRace;
    const session = this.playtestSession;
    const travel = Number(session?.distance || 0);
    const routeLength = Math.max(1, Number(session?.routeLength || this.getRaceRouteLength()));
    const routeRuntimeType = session?.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const visualTravel = this.getRaceVisualTravelDistance(session);
    const routeCamera = this.getRaceWorldPoseAtDistance(visualTravel, { runtimeType: routeRuntimeType });
    const cameraView = session?.cameraView || this.raceInput.cameraView;
    const carYaw = Number.isFinite(session?.carYaw) ? session.carYaw : routeCamera.yaw;
    const chaseDistance = cameraView === 'third-person'
      ? this.getRaceThirdPersonChaseDistance(this.selectedCar)
      : 0;
    const carWorldX = Number.isFinite(session?.bodyX) ? session.bodyX : Number.isFinite(session?.worldX) ? session.worldX : routeCamera.x;
    const carWorldZ = Number.isFinite(session?.bodyZ) ? session.bodyZ : Number.isFinite(session?.worldZ) ? session.worldZ : routeCamera.z;
    const camera = {
      ...routeCamera,
      x: carWorldX - Math.sin(carYaw) * chaseDistance,
      z: carWorldZ - Math.cos(carYaw) * chaseDistance,
      yaw: carYaw,
      distance: visualTravel
    };
    const liveCameraYaw = Number(session?.cameraYaw ?? camera.yaw);
    const cameraYaw = liveCameraYaw;
    const renderTravel = routeRuntimeType === 'circuit'
      ? ((visualTravel % routeLength) + routeLength) % routeLength
      : clamp(visualTravel, 0, routeLength);
    const currentSegment = this.getRaceSegmentAtDistance(renderTravel).segment || camera.segment || this.selectedSegment;
    const weatherState = this.getRaceWeatherState(this.selectedRace, this.playtestSession);
    const speedMps = Number(session?.speedMps || 0);
    const absSpeed = Math.abs(speedMps);
    const speedFactor = clamp(absSpeed / 60, 0, 1);
    const livePitchProfile = this.getRaceCameraPitchProfile({
      visualTravel,
      routeRuntimeType,
      speedMps,
      session
    });
    const pitchProfile = livePitchProfile;
    const hillPitch = pitchProfile.hillPitch;
    const liveHorizonRatio = clamp(
      pitchProfile.horizonRatio,
      0.08,
      0.58
    );
    const horizonRatio = liveHorizonRatio;
    camera.horizonRatio = horizonRatio;
    const localCarGroundElevation = this.getRaceStitchedTerrainElevationAtWorldPoint(
      { x: carWorldX, z: carWorldZ },
      Number(routeCamera.elevation || 0)
    );
    camera.roadElevation = Number.isFinite(session?.bodyY)
      ? Number(session.bodyY) / RACE_THREE_ELEVATION_M
      : Number.isFinite(session?.heightM)
        ? Number(session.heightM) / RACE_THREE_ELEVATION_M
        : localCarGroundElevation;
    camera.eyeHeight = this.getRaceCameraEyeHeight(cameraView);
    camera.elevation = camera.roadElevation + camera.eyeHeight;
    const liveNearPlane = Math.max(1.2, 1.35 + pitchProfile.nearPlaneBoost * 1.2 + Math.max(0, hillPitch) * 0.7);
    camera.nearPlane = liveNearPlane;
    const liveProjectionProfile = this.getRaceCameraProjectionProfile(cameraView, speedFactor);
    const projectionProfile = liveProjectionProfile;
    camera.roadDepthRatio = projectionProfile.roadDepthRatio;
    camera.focalScale = projectionProfile.focalScale;
    camera.roadWidthScale = projectionProfile.roadWidthScale;
    camera.roadMaxWidthRatio = projectionProfile.roadMaxWidthRatio;
    this.lastRaceRenderCamera = { camera: { ...camera }, cameraYaw, bounds: { ...bounds }, cameraView };
    const renderDebug = this.getRaceRenderDebugSettings();
    if (renderDebug.trackEnabled === false) {
      this.lastRaceRenderStats = {
        renderDisabled: true,
        trackEnabled: false,
        overlaysEnabled: renderDebug.overlaysEnabled !== false,
        polygons: 0,
        drawCalls: 0,
        terrainCandidates: 0,
        terrainCells: 0,
        terrainSubdivisions: 0,
        mode7Bands: 0,
        meshBuildMs: 0,
        webglMs: 0,
        overlayMs: 0,
        terrainBuildMs: 0
      };
      ctx.save();
      ctx.fillStyle = '#050807';
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.restore();
      if (this.playtestSession && showPlaytestHud) {
        this.drawRacePlaytestHud(ctx, bounds);
      }
      return;
    }
    const horizon = bounds.y + bounds.h * horizonRatio;
    const terrainTop = this.getRaceProjectedTerrainTop(bounds, camera);
    const roadBottom = bounds.y + bounds.h;
    const isWebGLTrackRenderer = this.getRaceGroundRenderer() === 'webgl-track';

    if (isWebGLTrackRenderer) {
      ctx.save();
      ctx.fillStyle = RACE_WORLD_EMPTY_BACKGROUND_COLOR;
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.restore();
    }
    this.drawRaceParallaxBackground(ctx, bounds, {
      horizon,
      cameraYaw,
      heading: Number(session?.heading || 0),
      velocityYaw: Number(session?.velocityYaw ?? cameraYaw),
      speedMps,
      hillPitch,
      suppressGroundFill: false,
      groundFillOverride: isWebGLTrackRenderer ? RACE_WORLD_EMPTY_BACKGROUND_COLOR : ''
    });
    const viewDistance = routeRuntimeType === 'circuit'
      ? Math.min(Math.max(routeLength * 1.5, absSpeed * 20 + 720, 1100), 1800)
      : Math.min(Math.max(520, absSpeed * 20 + 520), routeLength - visualTravel + 120);
    const nearDistance = Math.max(
      camera.nearPlane * 0.64,
      0.86 + speedFactor * 1.35 + pitchProfile.nearPlaneBoost * 1.65
    );
    const stableBackDistance = cameraView === 'third-person' ? chaseDistance + camera.nearPlane * 2 : 0;
    const stableRoadSections = this.getRaceStableRoadSections({
      bounds,
      camera,
      cameraYaw,
      visualTravel: renderTravel,
      routeLength,
      routeRuntimeType,
      nearDistance,
      viewDistance,
      backDistance: stableBackDistance
    });
    this.lastRaceStableRoadSections = stableRoadSections;
    let mode7Slices = [];
    let mode7Bands = [];
    const buildMode7RoadBands = () => {
      if (!mode7Slices.length) {
        mode7Slices = this.getRaceMode7DepthSlices({
          bounds,
          camera,
          cameraYaw,
          visualTravel: renderTravel,
          routeLength,
          routeRuntimeType,
          nearDistance,
          viewDistance,
          backDistance: stableBackDistance,
          sliceCount: this.getRaceMode7RenderSliceCount(cameraView, speedMps, bounds, renderDebug)
        });
        this.lastRaceMode7Slices = mode7Slices;
        mode7Bands = this.getRaceMode7RoadBands(mode7Slices);
      }
      return mode7Bands;
    };
    let drewWebGLTrack = false;
    if (isWebGLTrackRenderer) {
      drewWebGLTrack = this.drawRaceWebGLTrackScene(ctx, bounds, [], {
        camera,
        cameraView,
        cameraYaw,
        currentSegment,
        weatherState,
        slices: stableRoadSections,
        stableRoadSections,
        travel: visualTravel,
        routeLength
      });
      if (drewWebGLTrack) this.lastRaceMode7Slices = stableRoadSections;
    }
    if (!drewWebGLTrack) {
      buildMode7RoadBands();
      drewWebGLTrack = this.drawRaceWebGLTrackScene(ctx, bounds, mode7Bands, {
        camera,
        cameraView,
        cameraYaw,
        currentSegment,
        weatherState,
        slices: mode7Slices,
        stableRoadSections,
        travel: visualTravel,
        routeLength
      });
    }
    if (!drewWebGLTrack) {
      const baseGroundPalette = this.getRaceGroundPaletteForSegment(currentSegment, camera);
      ctx.fillStyle = baseGroundPalette.shoulderB;
      ctx.fillRect(bounds.x, terrainTop, bounds.w, Math.max(1, roadBottom - terrainTop));
      this.drawRaceProjectedFlatTileMap(ctx, bounds, mode7Bands, { camera, cameraYaw });
      for (const quad of mode7Bands) {
        const { near, far } = quad;
        if (!this.isRaceShoulderVisible()) continue;
        const groundPalette = this.getRaceGroundPaletteForSegment(near.center.segment || currentSegment, near.center);
        this.drawRaceProjectedTexturedQuad(
          ctx,
          bounds,
          [far.shoulderLeft, far.left, near.left, near.shoulderLeft],
          groundPalette.shoulderA,
          this.getRaceShoulderArtRef(near.center.segment || currentSegment, near.center),
          { camera, tileWorldM: 2.5 }
        );
        this.drawRaceProjectedTexturedQuad(
          ctx,
          bounds,
          [far.right, far.shoulderRight, near.shoulderRight, near.right],
          groundPalette.shoulderA,
          this.getRaceShoulderArtRef(near.center.segment || currentSegment, near.center),
          { camera, tileWorldM: 2.5 }
        );
      }

      for (const quad of mode7Bands) {
        const { near, far } = quad;
        const effectiveSurfaceId = this.getRaceEffectiveSurfaceId(near.center.segment?.surface || currentSegment?.surface || 'asphalt', weatherState);
        const palette = this.getRaceRoadSurfacePalette(effectiveSurfaceId);
        this.drawRaceProjectedTexturedQuad(
          ctx,
          bounds,
          [far.left, far.right, near.right, near.left],
          palette.roadA,
          this.getRaceSurfaceArtRefForSurface(effectiveSurfaceId),
          { camera, tileWorldM: 2.5 }
        );
        this.drawRaceProjectedBoundaryStrip(ctx, bounds, near, far, { camera });
      }
    } else {
      // WebGL Track renders margins/boundaries inside the depth-tested mesh pass.
    }
    const overlaysEnabled = renderDebug.overlaysEnabled !== false;
    const overlayStartMs = overlaysEnabled ? this.getNowMs() : 0;
    if (overlaysEnabled) {
      this.drawRaceProjectedDecals(ctx, bounds, { camera, cameraYaw, kind: 'decal' });
      if (!drewWebGLTrack) {
        this.drawRaceContinuousDistanceMarkers(ctx, bounds, {
          slices: mode7Slices,
          currentSegment,
          camera,
          cameraYaw
        });

        this.drawRaceStartFinishCheckerStripes(ctx, bounds, {
          slices: mode7Slices,
          camera,
          cameraYaw,
          travel: visualTravel,
          routeLength
        });
      }

      this.drawRaceProjectedAiCars(ctx, bounds, { camera, cameraYaw });
      this.drawRaceProjectedScenerySprites(ctx, bounds, { camera, cameraYaw });
      this.drawRaceTireFxParticles(ctx, bounds, { camera, cameraYaw });
      this.drawRaceWeatherFx(ctx, bounds, weatherState);
    }
    this.lastRaceRenderStats = {
      ...(this.lastRaceRenderStats || {}),
      trackEnabled: true,
      overlaysEnabled
    };
    if (overlayStartMs > 0) {
      this.lastRaceRenderStats.overlayMs = Math.max(0, this.getNowMs() - overlayStartMs);
    }

    if (this.playtestSession && showPlaytestHud) {
      this.drawRacePlaytestHud(ctx, bounds);
    }
  }

  drawRaceProjectedAiCars(ctx, bounds, { camera = {}, cameraYaw = 0 } = {}) {
    const session = this.playtestSession;
    if (!session?.aiRuntime?.length) return;
    const routeRuntimeType = session.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const routeLength = Math.max(1, Number(session.routeLength || this.getRaceRouteLength()));
    const entries = session.aiRuntime.map((ai) => {
      const distance = routeRuntimeType === 'circuit'
        ? ((Number(ai.projectedDistance ?? ai.distance ?? 0) % routeLength) + routeLength) % routeLength
        : clamp(Number(ai.projectedDistance ?? ai.distance ?? 0), 0, routeLength);
      const pose = this.getRaceWorldPoseAtDistance(distance, { runtimeType: routeRuntimeType });
      const segment = pose.segment || this.getRaceSegmentAtDistance(distance).segment;
      const roadHalf = this.getRaceRoadHalfWidthWorld(segment);
      const lateral = clamp(Number(ai.lineOffset || 0), -0.82, 0.82) * roadHalf;
      const right = this.getRaceRightVector(Number(pose.yaw || 0));
      const car = this.project.cars.find((candidate) => candidate.id === ai.carId) || this.selectedCar;
      const projected = this.projectRaceWorldPointToCamera({
        x: Number(pose.x || 0) + right.x * lateral,
        z: Number(pose.z || 0) + right.z * lateral,
        elevation: Number(pose.elevation || 0),
        segment
      }, camera, cameraYaw, bounds);
      return { ai, car, pose, projected };
    }).filter(({ projected }) => projected.visible && projected.screenY > bounds.y - 60 && projected.screenY < bounds.y + bounds.h + 80)
      .sort((a, b) => Number(b.projected.cameraZ || 0) - Number(a.projected.cameraZ || 0));
    entries.forEach(({ ai, car, pose, projected }) => {
      this.drawRaceProjectedCarSprite(ctx, bounds, {
        projected,
        yaw: Number(pose.yaw || 0),
        cameraYaw,
        car,
        color: ai.difficulty === 'expert' ? '#ff5f57' : ai.difficulty === 'hard' ? '#f2d45c' : ai.difficulty === 'medium' ? '#7ed957' : '#58d6ff'
      });
    });
  }

  drawRaceProjectedCarSprite(ctx, bounds, { projected = null, yaw = 0, cameraYaw = 0, car = this.selectedCar, color = '#58d6ff' } = {}) {
    if (!projected?.visible) return;
    const dimensions = car?.dimensions || {};
    const carWidthM = Number(dimensions.widthM || dimensions.width || this.getRaceCarWorldWidth(car) || 1.8);
    const carLengthM = Number(dimensions.lengthM || dimensions.length || carWidthM * 2.3);
    const focal = Math.max(140, Number(bounds.w || 1) * (Number(this.lastRaceRenderCamera?.camera?.focalScale) || 1.04));
    const roadWidthScale = Number(this.lastRaceRenderCamera?.camera?.roadWidthScale) || 1;
    const perspective = roadWidthScale * (focal / Math.max(1.2, Number(projected.renderZ || projected.cameraZ || 1)));
    const facing = Math.cos(Number(yaw || 0) - Number(cameraYaw || 0));
    const visualWidthM = Math.abs(facing) > 0.45 ? carWidthM : Math.max(carWidthM, carLengthM * 0.72);
    const width = clamp(visualWidthM * perspective, 4, bounds.w * 0.34);
    const height = clamp((carLengthM * 0.42) * perspective, 5, bounds.h * 0.24);
    const x = projected.screenX;
    const y = projected.screenY;
    const artChoice = this.getRaceCarProjectedArtRef(car, yaw, cameraYaw);
    const artCanvas = artChoice.artRef ? this.getRaceArtSpriteCanvas(artChoice.artRef, { frameIndex: artChoice.frameIndex || 0 }) : null;
    ctx.save();
    ctx.translate(x, y - height * 0.42);
    ctx.rotate(clamp(Math.sin(Number(yaw || 0) - Number(cameraYaw || 0)) * 0.34, -0.5, 0.5));
    if (artCanvas && typeof ctx.drawImage === 'function') {
      const previousSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      if (artChoice.mirrored) ctx.scale(-1, 1);
      const drawW = width;
      const drawH = clamp(width * (Number(artCanvas.height || 1) / Math.max(1, Number(artCanvas.width || 1))), height * 0.72, height * 1.8);
      ctx.drawImage(artCanvas, -drawW * 0.5, -drawH * 0.58, drawW, drawH);
      (car?.art?.addOns || [])
        .filter((entry) => entry?.enabled !== false && entry?.artRef)
        .forEach((entry) => {
          const addOnCanvas = this.getRaceArtSpriteCanvas(entry.artRef, { frameIndex: entry.frameIndex || 0 });
          if (!addOnCanvas) return;
          const scale = Number(entry.scale || 1) || 1;
          const addW = drawW * 0.58 * scale;
          const addH = addW * (Number(addOnCanvas.height || 1) / Math.max(1, Number(addOnCanvas.width || 1)));
          ctx.drawImage(addOnCanvas, -addW * 0.5 + drawW * Number(entry.offsetX || 0), drawH * 0.18 + drawH * Number(entry.offsetY || 0), addW, addH);
        });
      ctx.imageSmoothingEnabled = previousSmoothing;
      ctx.restore();
      return;
    }
    ctx.restore();
    const flatElevation = Number(projected.elevation ?? projected.y ?? 0) + 0.035;
    const drewFlatCar = this.drawRaceProjectedProceduralCar(ctx, bounds, {
      x: Number(projected.x || 0),
      z: Number(projected.z || 0),
      elevation: flatElevation,
      yaw,
      camera: this.lastRaceRenderCamera?.camera || {},
      cameraYaw,
      car,
      color,
      frontTireAngle: 0,
      braking: false,
      segment: projected.segment || null
    });
    if (drewFlatCar) return;
    ctx.save();
    ctx.translate(x, y - height * 0.42);
    ctx.rotate(clamp(Math.sin(Number(yaw || 0) - Number(cameraYaw || 0)) * 0.34, -0.5, 0.5));
    ctx.fillStyle = '#050807';
    ctx.fillRect(-width * 0.46, -height * 0.32, width * 0.18, height * 0.72);
    ctx.fillRect(width * 0.28, -height * 0.32, width * 0.18, height * 0.72);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -height * 0.58);
    ctx.lineTo(width * 0.42, -height * 0.12);
    ctx.lineTo(width * 0.34, height * 0.48);
    ctx.lineTo(-width * 0.34, height * 0.48);
    ctx.lineTo(-width * 0.42, -height * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(241,244,239,0.72)';
    ctx.fillRect(-width * 0.2, -height * 0.3, width * 0.4, height * 0.18);
    ctx.restore();
  }

  getRaceCarProjectedArtRef(car = this.selectedCar, yaw = 0, cameraYaw = 0, { reversing = false, steering = 0 } = {}) {
    const art = car?.art && typeof car.art === 'object' ? car.art : {};
    const shellFrames = art.shellFrames && typeof art.shellFrames === 'object' ? art.shellFrames : {};
    const shellSlots = shellFrames.slots && typeof shellFrames.slots === 'object' ? shellFrames.slots : {};
    const relative = normalizeAngle(Number(yaw || 0) - Number(cameraYaw || 0));
    if (shellFrames.artRef || Object.values(shellSlots).some((entry) => entry?.artRef)) {
      if (reversing && Number.isFinite(Number(shellFrames.reverseFrameIndex))) {
        return {
          artRef: String(shellFrames.artRef || art.shell || '').trim(),
          frameIndex: Math.max(0, Math.round(Number(shellFrames.reverseFrameIndex))),
          slot: 'reverse',
          mirrored: false
        };
      }
      const biased = normalizeAngle(relative + clamp(Number(steering) || 0, -1, 1) * (Math.PI / 8));
      const deg = biased * 180 / Math.PI;
      const slot = deg >= -22.5 && deg < 22.5 ? 'front'
        : deg >= 22.5 && deg < 67.5 ? 'frontRight'
          : deg >= 67.5 && deg < 112.5 ? 'right'
            : deg >= 112.5 && deg < 157.5 ? 'rearRight'
              : deg >= 157.5 || deg < -157.5 ? 'rear'
                : deg >= -157.5 && deg < -112.5 ? 'rearLeft'
                  : deg >= -112.5 && deg < -67.5 ? 'left'
                    : 'frontLeft';
      const entry = shellSlots[slot] || null;
      const artRef = String(entry?.artRef || shellFrames.artRef || art.shell || '').trim();
      if (artRef) {
        return {
          artRef,
          frameIndex: Math.max(0, Math.round(Number(entry?.frameIndex) || 0)),
          slot,
          mirrored: false
        };
      }
    }
    const turnFrames = art.turnFrames && typeof art.turnFrames === 'object' ? art.turnFrames : {};
    const center = String(turnFrames.center || art.shell || art.body || art.artRef || '').trim();
    const left = String(turnFrames.left || '').trim();
    const right = String(turnFrames.right || '').trim();
    const lateral = Math.sin(relative);
    if (lateral < -0.24) {
      if (left) return { artRef: left, frameIndex: 0, mirrored: false };
      if (right) return { artRef: right, frameIndex: 0, mirrored: true };
    }
    if (lateral > 0.24) {
      if (right) return { artRef: right, frameIndex: 0, mirrored: false };
      if (left) return { artRef: left, frameIndex: 0, mirrored: true };
    }
    return { artRef: center || left || right || '', frameIndex: 0, mirrored: false };
  }

  drawRaceProjectedScenerySprites(ctx, bounds, { camera = {}, cameraYaw = 0 } = {}) {
    const scenery = this.ensureRaceScenery()
      .filter((sprite) => sprite && sprite.state !== 'removed' && sprite.state !== 'flattened')
      .map((sprite) => {
        const groundElevation = this.getRaceSurfaceModel().sampleWorld({ x: sprite.x, z: sprite.z }, 0).elevation;
        const projected = this.projectRaceWorldPointToCamera({
          x: Number(sprite.x || 0),
          z: Number(sprite.z || 0),
          elevation: groundElevation
        }, camera, cameraYaw, bounds);
        return { sprite, projected };
      })
      .filter(({ projected }) => projected.visible && projected.screenY > bounds.y - bounds.h && projected.screenY < bounds.y + bounds.h * 1.2)
      .sort((a, b) => Number(b.projected.cameraZ || 0) - Number(a.projected.cameraZ || 0));
    const focal = Math.max(140, Number(bounds.w || 1) * (Number(camera.focalScale) || 1.04));
    const roadWidthScale = Number(camera.roadWidthScale) || 1;
    scenery.forEach(({ sprite, projected }) => {
      const preset = RACE_SCENERY_PRESET_BY_ID[sprite.presetId] || RACE_SCENERY_PRESETS[0];
      const perspective = roadWidthScale * (focal / Math.max(1.2, Number(projected.renderZ || projected.cameraZ || 1)));
      const width = clamp((Number(sprite.widthM) || preset.widthM) * perspective, 2, bounds.w * 0.4);
      const height = clamp((Number(sprite.heightM) || preset.heightM) * perspective, 3, bounds.h * 0.9);
      const x = projected.screenX - width / 2;
      const groundY = clamp(projected.screenY, bounds.y - bounds.h * 0.2, bounds.y + bounds.h * 1.04);
      const y = groundY - height;
      if (x > bounds.x + bounds.w || x + width < bounds.x) return;
      const artCanvas = this.getRaceArtSpriteCanvas(sprite.artRef);
      if (artCanvas && typeof ctx.drawImage === 'function') {
        ctx.drawImage(artCanvas, x, y, width, height);
        return;
      }
      ctx.fillStyle = preset.colors?.[1] || '#1f3d22';
      ctx.fillRect(projected.screenX - Math.max(1, width * 0.12), y + height * 0.42, Math.max(1, width * 0.24), height * 0.58);
      ctx.fillStyle = preset.colors?.[0] || '#6f9f3d';
      ctx.beginPath();
      if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(projected.screenX, y + height * 0.32, width * 0.5, height * 0.34, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(projected.screenX, y + height * 0.32, Math.max(1, Math.min(width * 0.5, height * 0.34)), 0, Math.PI * 2);
      }
      ctx.fill();
      if (sprite.behavior === 'indestructible') {
        ctx.strokeStyle = 'rgba(241,244,239,0.38)';
        ctx.lineWidth = Math.max(1, width * 0.04);
        ctx.stroke();
      }
    });
  }

  drawRaceStartFinishCheckerStripes(ctx, bounds, { slices = [], camera = {}, cameraYaw = 0, travel = 0, routeLength = 1 } = {}) {
    const race = this.selectedRace;
    const currentTravel = Number(travel) || 0;
    if (!race) return;
    const startDistance = 6;
    if (currentTravel <= startDistance + 12) {
      this.drawRaceCheckerStripeAtDistance(ctx, bounds, {
        slices,
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
          slices,
          camera,
          cameraYaw,
          distance: finishDistance,
          depth: 10
        });
      }
    }
  }

  drawRaceCheckerStripeAtDistance(ctx, bounds, { slices = [], camera = {}, cameraYaw = 0, distance = 0, depth = 9 } = {}) {
    const startDistance = Number(distance) || 0;
    const stripeDepth = Math.max(2, Number(depth) || 9);
    const routeLength = this.getRaceRouteLength();
    const routeRuntimeType = this.playtestSession?.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const allowVisualExtension = routeRuntimeType !== 'circuit';
    const nearDistance = startDistance;
    const farDistance = startDistance + stripeDepth;
    if (farDistance < Number(camera.distance || 0) - 2) return;
    const clipTop = this.getRaceProjectedTerrainTop(bounds, camera);
    ctx.save?.();
    ctx.beginPath?.();
    ctx.rect?.(Number(bounds.x || 0), clipTop, Number(bounds.w || 1), Math.max(1, Number(bounds.y || 0) + Number(bounds.h || 1) - clipTop));
    ctx.clip?.();
    const cells = 10;
    const projectedNear = this.getRaceInterpolatedMarkerSlice(slices, nearDistance);
    const projectedFar = this.getRaceInterpolatedMarkerSlice(slices, farDistance);
    if (projectedNear?.left && projectedNear?.right && projectedFar?.left && projectedFar?.right) {
      for (let index = 0; index < cells; index += 1) {
        const t0 = index / cells;
        const t1 = (index + 1) / cells;
        const projected = [
          this.lerpRaceProjectedPoint(projectedFar.left, projectedFar.right, t0),
          this.lerpRaceProjectedPoint(projectedFar.left, projectedFar.right, t1),
          this.lerpRaceProjectedPoint(projectedNear.left, projectedNear.right, t1),
          this.lerpRaceProjectedPoint(projectedNear.left, projectedNear.right, t0)
        ];
        const clipped = this.getRaceNearClippedProjectedPolygon(projected, camera, bounds);
        if (clipped.length < 3 || clipped.every((point) => Number(point.screenY || 0) < clipTop)) continue;
        ctx.fillStyle = index % 2 === 0 ? '#f1f4ef' : '#050807';
        this.drawRaceProjectedQuad(ctx, bounds, clipped, ctx.fillStyle);
      }
      ctx.restore?.();
      return;
    }
    const nearSection = this.getRaceRoadCrossSectionAtDistance(nearDistance, { allowVisualExtension });
    const farSection = this.getRaceRoadCrossSectionAtDistance(farDistance, { allowVisualExtension });
    const lerpWorld = (a = {}, b = {}, t = 0) => ({
      ...a,
      x: Number(a.x || 0) + (Number(b.x || 0) - Number(a.x || 0)) * t,
      z: Number(a.z || 0) + (Number(b.z || 0) - Number(a.z || 0)) * t,
      elevation: Number(a.elevation || 0) + (Number(b.elevation || 0) - Number(a.elevation || 0)) * t,
      segment: a.segment || b.segment
    });
    for (let index = 0; index < cells; index += 1) {
      const t0 = index / cells;
      const t1 = (index + 1) / cells;
      const projected = [
        this.projectRaceWorldPointToCamera(lerpWorld(farSection.left, farSection.right, t0), camera, cameraYaw, bounds),
        this.projectRaceWorldPointToCamera(lerpWorld(farSection.left, farSection.right, t1), camera, cameraYaw, bounds),
        this.projectRaceWorldPointToCamera(lerpWorld(nearSection.left, nearSection.right, t1), camera, cameraYaw, bounds),
        this.projectRaceWorldPointToCamera(lerpWorld(nearSection.left, nearSection.right, t0), camera, cameraYaw, bounds)
      ];
      const clipped = this.getRaceNearClippedProjectedPolygon(projected, camera, bounds);
      if (clipped.length < 3 || clipped.every((point) => Number(point.screenY || 0) < clipTop)) continue;
      ctx.fillStyle = index % 2 === 0 ? '#f1f4ef' : '#050807';
      this.drawRaceProjectedQuad(ctx, bounds, clipped, ctx.fillStyle);
    }
    ctx.restore?.();
  }

  getRaceInterpolatedMarkerSlice(slices = [], worldDistance = 0) {
    if (!Array.isArray(slices) || slices.length < 2) return null;
    for (let index = 0; index < slices.length - 1; index += 1) {
      const near = slices[index];
      const far = slices[index + 1];
      const nearDistance = Number(near?.center?.distance || 0);
      const farDistance = Number(far?.center?.distance || 0);
      const minDistance = Math.min(nearDistance, farDistance);
      const maxDistance = Math.max(nearDistance, farDistance);
      if (worldDistance < minDistance || worldDistance > maxDistance) continue;
      const t = clamp((worldDistance - nearDistance) / Math.max(0.001, farDistance - nearDistance), 0, 1);
      const lerp = (a, b) => Number(a || 0) + (Number(b || 0) - Number(a || 0)) * t;
      const lerpProjected = (a = null, b = null) => {
        if (!a || !b) return null;
        return {
          screenX: lerp(a.screenX, b.screenX),
          screenY: lerp(a.screenY, b.screenY),
          x: lerp(a.x, b.x),
          z: lerp(a.z, b.z),
          elevation: lerp(a.elevation, b.elevation),
          cameraX: lerp(a.cameraX, b.cameraX),
          cameraY: lerp(a.cameraY, b.cameraY),
          cameraZ: lerp(a.cameraZ, b.cameraZ),
          renderZ: lerp(a.renderZ, b.renderZ),
          visible: Boolean(a.visible || b.visible),
          clippedToNearPlane: Boolean(a.clippedToNearPlane || b.clippedToNearPlane)
        };
      };
      return {
        segment: near.center.segment || far.center.segment,
        center: {
          screenX: lerp(near.center.screenX, far.center.screenX),
          screenY: lerp(near.center.screenY, far.center.screenY),
          cameraZ: lerp(near.center.cameraZ, far.center.cameraZ),
          renderZ: lerp(near.center.renderZ, far.center.renderZ),
          distance: worldDistance
        },
        left: lerpProjected(near.left, far.left),
        right: lerpProjected(near.right, far.right),
        shoulderLeft: lerpProjected(near.shoulderLeft, far.shoulderLeft),
        shoulderRight: lerpProjected(near.shoulderRight, far.shoulderRight),
        bandHeight: Math.abs(Number(far.center.screenY || 0) - Number(near.center.screenY || 0))
      };
    }
    return null;
  }

  getRaceProjectedMarkerAtDistance(worldDistance = 0, { camera = null, cameraYaw = 0, bounds = null } = {}) {
    if (!camera) return null;
    const targetBounds = bounds || this.lastRaceRenderCamera?.bounds || {};
    const routeRuntimeType = this.playtestSession?.routeRuntimeType || this.getSelectedRaceRuntimeType();
    const allowVisualExtension = routeRuntimeType !== 'circuit';
    const section = this.getRaceRoadCrossSectionAtDistance(worldDistance, { allowVisualExtension });
    const center = this.projectRaceWorldPointToCamera(section.center, camera, cameraYaw, targetBounds);
    const left = this.projectRaceWorldPointToCamera(section.left, camera, cameraYaw, targetBounds);
    const right = this.projectRaceWorldPointToCamera(section.right, camera, cameraYaw, targetBounds);
    const shoulderLeft = this.projectRaceWorldPointToCamera(section.shoulderLeft, camera, cameraYaw, targetBounds);
    const shoulderRight = this.projectRaceWorldPointToCamera(section.shoulderRight, camera, cameraYaw, targetBounds);
    return {
      segment: section.center.segment,
      center: { ...center, distance: worldDistance },
      left,
      right,
      shoulderLeft,
      shoulderRight,
      bandHeight: 0
    };
  }

  getRaceProjectedApronMarkerQuad(startMarker = null, endMarker = null, side = 'left') {
    if (!startMarker || !endMarker) return [];
    const isLeft = side === 'left';
    const startRoadEdge = isLeft ? startMarker.left : startMarker.right;
    const endRoadEdge = isLeft ? endMarker.left : endMarker.right;
    const startShoulder = isLeft
      ? (startMarker.shoulderLeft || startMarker.left)
      : (startMarker.shoulderRight || startMarker.right);
    const endShoulder = isLeft
      ? (endMarker.shoulderLeft || endMarker.left)
      : (endMarker.shoulderRight || endMarker.right);
    const outerT = this.isRaceMarginEnabled() ? 1 : 0.78;
    const innerT = this.isRaceMarginEnabled() ? 0.18 : 0.52;
    const edgePrefix = isLeft ? 'shoulder-left' : 'shoulder-right';
    const startInner = { ...this.lerpRaceProjectedPoint(startRoadEdge, startShoulder, innerT), edge: `${edgePrefix}-inner` };
    const endInner = { ...this.lerpRaceProjectedPoint(endRoadEdge, endShoulder, innerT), edge: `${edgePrefix}-inner` };
    const startOuter = { ...this.lerpRaceProjectedPoint(startRoadEdge, startShoulder, outerT), edge: `${edgePrefix}-outer` };
    const endOuter = { ...this.lerpRaceProjectedPoint(endRoadEdge, endShoulder, outerT), edge: `${edgePrefix}-outer` };
    return isLeft
      ? [endOuter, endInner, startInner, startOuter]
      : [endInner, endOuter, startOuter, startInner];
  }

  getRaceProjectedMarginMarkerQuad(startMarker = null, endMarker = null, side = 'left') {
    if (!startMarker || !endMarker) return [];
    const isLeft = side === 'left';
    const startRoadEdge = isLeft ? startMarker.left : startMarker.right;
    const endRoadEdge = isLeft ? endMarker.left : endMarker.right;
    const startShoulder = isLeft
      ? (startMarker.shoulderLeft || startMarker.left)
      : (startMarker.shoulderRight || startMarker.right);
    const endShoulder = isLeft
      ? (endMarker.shoulderLeft || endMarker.left)
      : (endMarker.shoulderRight || endMarker.right);
    const segment = startMarker.segment || startMarker.center?.segment || endMarker.segment || endMarker.center?.segment || this.selectedSegment;
    const shoulderWidth = Math.max(0.1, this.getRaceShoulderWidthWorld(segment));
    const marginWidth = this.isRaceMarginEnabled()
      ? Math.max(0.08, this.getRaceBoundaryWidthWorld(segment))
      : Math.max(0.08, shoulderWidth * 0.055);
    const outerT = clamp(marginWidth / shoulderWidth, 0.012, 0.24);
    const innerT = 0;
    const edgePrefix = isLeft ? 'margin-left' : 'margin-right';
    const startInner = { ...this.lerpRaceProjectedPoint(startRoadEdge, startShoulder, innerT), edge: `${edgePrefix}-inner` };
    const endInner = { ...this.lerpRaceProjectedPoint(endRoadEdge, endShoulder, innerT), edge: `${edgePrefix}-inner` };
    const startOuter = { ...this.lerpRaceProjectedPoint(startRoadEdge, startShoulder, outerT), edge: `${edgePrefix}-outer` };
    const endOuter = { ...this.lerpRaceProjectedPoint(endRoadEdge, endShoulder, outerT), edge: `${edgePrefix}-outer` };
    return isLeft
      ? [endOuter, endInner, startInner, startOuter]
      : [endInner, endOuter, startOuter, startInner];
  }

  getRaceMarkerLateralUnit(marker = null) {
    if (!marker?.left || !marker?.right) return { x: 1, y: 0 };
    const dx = Number(marker.right.screenX || 0) - Number(marker.left.screenX || 0);
    const dy = Number(marker.right.screenY || 0) - Number(marker.left.screenY || 0);
    const length = Math.max(0.001, Math.hypot(dx, dy));
    return { x: dx / length, y: dy / length };
  }

  drawRaceProjectedLaneDash(ctx, startMarker = null, endMarker = null, width = 2) {
    if (!startMarker?.center || !endMarker?.center) return;
    const quad = this.getRaceProjectedLaneDashQuad(startMarker, endMarker, width);
    if (quad.length < 4) return;
    ctx.beginPath();
    ctx.moveTo(quad[0].screenX, quad[0].screenY);
    ctx.lineTo(quad[1].screenX, quad[1].screenY);
    ctx.lineTo(quad[2].screenX, quad[2].screenY);
    ctx.lineTo(quad[3].screenX, quad[3].screenY);
    ctx.closePath();
    ctx.fill();
  }

  getRaceProjectedLaneDashQuad(startMarker = null, endMarker = null, width = 2) {
    if (!startMarker?.center || !endMarker?.center) return [];
    const startLateral = this.getRaceMarkerLateralUnit(startMarker);
    const endLateral = this.getRaceMarkerLateralUnit(endMarker);
    const startWidth = Math.max(1, Number(width || 1));
    const endRoadWidth = Math.max(1, Math.hypot(
      Number(endMarker.right?.screenX || 0) - Number(endMarker.left?.screenX || 0),
      Number(endMarker.right?.screenY || 0) - Number(endMarker.left?.screenY || 0)
    ));
    const startRoadWidth = Math.max(1, Math.hypot(
      Number(startMarker.right?.screenX || 0) - Number(startMarker.left?.screenX || 0),
      Number(startMarker.right?.screenY || 0) - Number(startMarker.left?.screenY || 0)
    ));
    const endWidth = Math.max(1, startWidth * (endRoadWidth / startRoadWidth));
    const startLeft = {
      x: startMarker.center.screenX - startLateral.x * startWidth * 0.5,
      y: startMarker.center.screenY - startLateral.y * startWidth * 0.5
    };
    const startRight = {
      x: startMarker.center.screenX + startLateral.x * startWidth * 0.5,
      y: startMarker.center.screenY + startLateral.y * startWidth * 0.5
    };
    const endLeft = {
      x: endMarker.center.screenX - endLateral.x * endWidth * 0.5,
      y: endMarker.center.screenY - endLateral.y * endWidth * 0.5
    };
    const endRight = {
      x: endMarker.center.screenX + endLateral.x * endWidth * 0.5,
      y: endMarker.center.screenY + endLateral.y * endWidth * 0.5
    };
    const toProjected = (source = {}, screen = {}) => ({
      ...source,
      screenX: screen.x,
      screenY: screen.y,
      visible: true
    });
    return [
      toProjected(endMarker.center, endLeft),
      toProjected(endMarker.center, endRight),
      toProjected(startMarker.center, startRight),
      toProjected(startMarker.center, startLeft)
    ];
  }

  drawRaceContinuousDistanceMarkers(ctx, bounds, { slices = [], currentSegment = null, camera = null, cameraYaw = 0 } = {}) {
    if (!Array.isArray(slices) || slices.length < 2) return;
    const weatherState = this.getRaceWeatherState(this.selectedRace, this.playtestSession);
    const distances = slices.map((slice) => Number(slice?.center?.distance || 0)).filter(Number.isFinite);
    if (distances.length < 2) return;
    const markerDimensions = this.getRaceLaneMarkerDimensionsWorld();
    const markerInterval = markerDimensions.interval;
    const visibleMinDistance = Math.min(...distances);
    const visibleMaxDistance = Math.max(...distances);
    const travelDistance = this.playtestSession
      ? this.getRaceVisualTravelDistance(this.playtestSession)
      : visibleMinDistance;
    const markerLimitDistance = Math.max(markerDimensions.edgePostInterval, markerInterval) * 5;
    const minDistance = Math.max(visibleMinDistance, travelDistance - markerInterval);
    const maxDistance = Math.min(visibleMaxDistance, travelDistance + markerLimitDistance);
    const horizonScreenY = this.getRaceProjectedTerrainTop(bounds, this.lastRaceRenderCamera?.camera || {});
    const markerVisible = (marker = null) => {
      if (!marker?.center || Number(marker.center.screenY || 0) < horizonScreenY) return false;
      const depth = Number(marker.center.cameraZ ?? marker.center.renderZ);
      return !Number.isFinite(depth)
        || depth >= Math.max(1.2, Number(this.lastRaceRenderCamera?.camera?.nearPlane) || 1.2);
    };
    const getMarker = (worldDistance) => {
      const interpolated = this.getRaceInterpolatedMarkerSlice(slices, worldDistance);
      if (interpolated) return interpolated;
      return camera
        ? this.getRaceProjectedMarkerAtDistance(worldDistance, { camera, cameraYaw, bounds })
        : null;
    };
    const drawDashAt = (worldDistance) => {
      const startMarker = getMarker(worldDistance);
      const endMarker = getMarker(Math.min(maxDistance, worldDistance + markerDimensions.dashLength)) || getMarker(maxDistance - 0.01);
      if (!startMarker || !endMarker) return;
      if (!markerVisible(startMarker) || !markerVisible(endMarker)) return;
      if (!this.shouldRenderRaceCenterLaneDash(startMarker.segment || currentSegment)) return;
      const palette = this.getRaceRoadSurfacePalette(this.getRaceEffectiveSurfaceId(startMarker.segment?.surface || currentSegment?.surface || 'asphalt', weatherState));
      const roadScreenWidth = Math.max(1, Math.hypot(
        Number(startMarker.right.screenX || 0) - Number(startMarker.left.screenX || 0),
        Number(startMarker.right.screenY || 0) - Number(startMarker.left.screenY || 0)
      ));
      const laneWorldWidth = Math.max(0.1, this.getRaceRoadHalfWidthWorld(startMarker.segment || currentSegment));
      const markerW = Math.max(1, roadScreenWidth * (markerDimensions.dashWidth / Math.max(0.1, laneWorldWidth * 2)));
      ctx.fillStyle = palette.lane;
      this.drawRaceProjectedLaneDash(ctx, startMarker, endMarker, markerW);
    };
    const drawPostAt = (worldDistance) => {
      const startMarker = getMarker(worldDistance);
      const endMarker = getMarker(Math.min(maxDistance, worldDistance + 3.2)) || getMarker(worldDistance + 0.8);
      if (!startMarker || !endMarker) return;
      if (!markerVisible(startMarker) || !markerVisible(endMarker)) return;
      const color = 'rgba(242,212,92,0.76)';
      this.drawRaceProjectedTexturedQuad(
        ctx,
        bounds,
        this.getRaceProjectedApronMarkerQuad(startMarker, endMarker, 'left'),
        color,
        '',
        { camera }
      );
      this.drawRaceProjectedTexturedQuad(
        ctx,
        bounds,
        this.getRaceProjectedApronMarkerQuad(startMarker, endMarker, 'right'),
        color,
        '',
        { camera }
      );
    };
    for (let distance = Math.ceil(minDistance / markerInterval) * markerInterval; distance <= maxDistance; distance += markerInterval) {
      const phase = distance % markerInterval;
      if (phase < markerDimensions.dashLength) drawDashAt(distance);
    }
    for (let distance = Math.ceil(minDistance / markerDimensions.edgePostInterval) * markerDimensions.edgePostInterval; distance <= maxDistance; distance += markerDimensions.edgePostInterval) {
      drawPostAt(distance);
    }
  }

  drawRaceProjectedDistanceMarkerTicks(ctx, bounds, { slices = [], currentSegment = null, camera = null } = {}) {
    if (!ctx || !Array.isArray(slices) || slices.length < 2) return 0;
    const distances = slices.map((slice) => Number(slice?.center?.distance || 0)).filter(Number.isFinite);
    if (distances.length < 2) return 0;
    const markerDimensions = this.getRaceLaneMarkerDimensionsWorld();
    const visibleMinDistance = Math.min(...distances);
    const visibleMaxDistance = Math.max(...distances);
    const travelDistance = this.playtestSession
      ? this.getRaceVisualTravelDistance(this.playtestSession)
      : visibleMinDistance;
    const markerLimitDistance = markerDimensions.edgePostInterval * 5;
    const minDistance = Math.max(visibleMinDistance, travelDistance - markerDimensions.edgePostInterval);
    const maxDistance = Math.min(visibleMaxDistance, travelDistance + markerLimitDistance);
    const clipTop = this.getRaceProjectedTerrainTop(bounds, camera || this.lastRaceRenderCamera?.camera || {});
    const markerVisible = (marker = null) => {
      if (!marker?.center || Number(marker.center.screenY || 0) < clipTop) return false;
      const depth = Number(marker.center.cameraZ ?? marker.center.renderZ);
      return !Number.isFinite(depth)
        || depth >= Math.max(1.2, Number(camera?.nearPlane ?? this.lastRaceRenderCamera?.camera?.nearPlane) || 1.2);
    };
    const getMarker = (worldDistance) => this.getRaceInterpolatedMarkerSlice(slices, worldDistance);
    let count = 0;
    const drawTick = (marker, side) => {
      const isLeft = side === 'left';
      const roadEdge = isLeft ? marker.left : marker.right;
      const shoulderEdge = isLeft
        ? (marker.shoulderLeft || marker.left)
        : (marker.shoulderRight || marker.right);
      if (!roadEdge || !shoulderEdge) return;
      const segment = marker.segment || marker.center?.segment || currentSegment;
      const shoulderWidth = Math.max(0.1, this.getRaceShoulderWidthWorld(segment));
      const marginWidth = this.isRaceMarginEnabled()
        ? Math.max(0.08, this.getRaceBoundaryWidthWorld(segment))
        : Math.max(0.08, shoulderWidth * 0.055);
      const anchor = this.lerpRaceProjectedPoint(roadEdge, shoulderEdge, clamp(marginWidth / Math.max(0.1, shoulderWidth), 0.018, 0.22));
      const roadScreenWidth = Math.max(1, Math.hypot(
        Number(marker.right?.screenX || 0) - Number(marker.left?.screenX || 0),
        Number(marker.right?.screenY || 0) - Number(marker.left?.screenY || 0)
      ));
      const depth = Math.max(1, Number(marker.center?.cameraZ ?? marker.center?.renderZ) || 1);
      const scale = clamp(roadScreenWidth / Math.max(1, Number(bounds.w || 1) * 0.34), 0.18, 1.35);
      const tickW = Math.max(1, Number(bounds.w || 1) * 0.0048 * scale);
      const tickH = Math.max(3, Number(bounds.h || 1) * 0.045 * scale * clamp(34 / depth, 0.38, 1.35));
      const x = Number(anchor.screenX || 0);
      const y = Number(anchor.screenY || 0);
      if (!Number.isFinite(x) || !Number.isFinite(y) || y < clipTop || y > Number(bounds.y || 0) + Number(bounds.h || 1) + tickH) return;
      ctx.fillRect(x - tickW / 2, y - tickH, tickW, tickH);
      count += 1;
    };
    ctx.save?.();
    ctx.beginPath?.();
    ctx.rect?.(Number(bounds.x || 0), clipTop, Number(bounds.w || 1), Math.max(1, Number(bounds.y || 0) + Number(bounds.h || 1) - clipTop));
    ctx.clip?.();
    ctx.fillStyle = 'rgba(242,212,92,0.86)';
    for (let distance = Math.ceil(minDistance / markerDimensions.edgePostInterval) * markerDimensions.edgePostInterval; distance <= maxDistance; distance += markerDimensions.edgePostInterval) {
      const marker = getMarker(distance);
      if (!marker || !markerVisible(marker)) continue;
      drawTick(marker, 'left');
      drawTick(marker, 'right');
    }
    ctx.restore?.();
    return count;
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
      if (!this.shouldRenderRaceCenterLaneDash(near.center.segment)) return;
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
    if (Math.abs(curve) < 0.52 && !['square', 'angled', 'junction'].includes(segment.turn)) return;
    const direction = curve >= 0 ? 1 : -1;
    const label = segment.turn === 'junction'
      ? (direction > 0 ? 'JCT RIGHT' : 'JCT LEFT')
      : segment.turn === 'square'
        ? (direction > 0 ? 'SQUARE RIGHT' : 'SQUARE LEFT')
        : segment.turn === 'angled'
          ? (direction > 0 ? 'ANGLED RIGHT' : 'ANGLED LEFT')
          : direction > 0 ? 'RIGHT' : 'LEFT';
    const cue = {
      x: bounds.x + bounds.w * 0.5 - 54,
      y: bounds.y + bounds.h * 0.18,
      w: 108,
      h: 24
    };
    ctx.fillStyle = 'rgba(5,8,7,0.52)';
    ctx.fillRect(cue.x, cue.y, cue.w, cue.h);
    ctx.fillStyle = UI_SUITE.colors.accent;
    ctx.font = `800 10px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cue.x + cue.w / 2, cue.y + cue.h / 2, cue.w - 8);
    const chevronY = cue.y + cue.h + 8;
    ctx.fillStyle = 'rgba(242,212,92,0.9)';
    for (let index = 0; index < 3; index += 1) {
      const x = bounds.x + bounds.w / 2 + direction * (18 + index * 14);
      ctx.beginPath();
      ctx.moveTo(x, chevronY);
      ctx.lineTo(x - direction * 8, chevronY + 7);
      ctx.lineTo(x - direction * 8, chevronY - 7);
      ctx.closePath();
      ctx.fill();
    }
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
    if (this.raceSettingsDialog) {
      const sliderHit = this.getRaceSettingsSliderHit(payload);
      if (sliderHit) {
        this.raceSettingsSliderDrag = { id: payload.id ?? 'pointer', region: sliderHit };
        this.updateRaceSettingsSlider(sliderHit, payload.x);
        return;
      }
      if (
        hit?.id?.startsWith?.('race-settings-')
        || hit?.id?.startsWith?.('weather-dialog-')
        || hit?.id?.startsWith?.('tiles-dialog-')
        || hit?.id?.startsWith?.('margin-dialog-')
        || hit?.id?.startsWith?.('texture-debug-')
        || hit?.id === 'texture-renderer-webgl'
        || hit?.id === 'texture-filter-mode'
      ) {
        hit.onClick?.();
      }
      return;
    }
    if (this.raceSpriteSettingsDialogOpen) {
      const sliderHit = this.getRaceSpriteSettingsSliderHit(payload);
      if (sliderHit) {
        this.raceSpriteSettingsSliderDrag = { id: payload.id ?? 'pointer', region: sliderHit };
        this.updateRaceSpriteSettingsSlider(sliderHit, payload.x);
        return;
      }
      if (hit?.id?.startsWith?.('sprite-settings-') || hit?.id?.startsWith?.('sprite-collision-')) {
        hit.onClick?.();
      }
      return;
    }
    if (
      this.playtestSession
      && hit?.id
      && ['race-pause-return-editor', 'race-resume', 'race-car-settings', 'race-pause-back', 'race-toggle-abs', 'race-toggle-tc', 'race-toggle-transmission', 'race-toggle-telemetry', 'race-exit-main', 'end-playtest'].includes(hit.id)
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
    if (this.activeViewportMode === 'portrait' && ['ground-brush', 'sprite-brush'].includes(this.racePortraitHotMenu)) {
      const sliderHit = this.getRaceGroundBrushSliderHit(payload);
      if (sliderHit) {
        this.raceGroundBrushSliderDrag = { id: payload.id ?? 'pointer', region: sliderHit };
        this.updateRaceGroundBrushSlider(sliderHit, payload.x);
        return;
      }
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
    if (payload.button !== 1 && payload.button !== 2 && this.activeAction === 'paint-sprite' && this.addRaceScenerySpriteAtPoint(payload)) {
      return;
    }
    if (payload.button !== 1 && payload.button !== 2 && this.activeAction === 'paint-decal' && this.addRaceDecalAtPoint(payload, { kind: 'decal' })) {
      this.raceDecalPaintDrag = { id: payload.id ?? 'pointer', kind: 'decal' };
      return;
    }
    if (payload.button !== 1 && payload.button !== 2 && this.activeAction === 'paint-tile' && this.paintRaceArtTileAtPoint(payload)) {
      this.raceDecalPaintDrag = { id: payload.id ?? 'pointer', kind: 'tile' };
      return;
    }
    if (payload.button !== 1 && payload.button !== 2 && this.activeAction === 'erase-decal' && this.eraseRaceDecalAtPoint(payload, { kind: 'decal' })) {
      this.raceDecalEraseDrag = { id: payload.id ?? 'pointer', kind: 'decal' };
      return;
    }
    if (payload.button !== 1 && payload.button !== 2 && this.activeAction === 'erase-tile' && this.eraseRaceArtTileAtPoint(payload)) {
      this.raceDecalEraseDrag = { id: payload.id ?? 'pointer', kind: 'tile' };
      return;
    }
    if (payload.button !== 1 && payload.button !== 2 && this.activeAction === 'erase-sprite' && this.beginRaceSceneryDrag(payload)) {
      return;
    }
    if (payload.button !== 1 && payload.button !== 2 && ['move-sprite', 'delete-sprite'].includes(this.activeAction) && this.beginRaceSceneryDrag(payload)) {
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
    if (this.raceGroundBrushSliderDrag && this.raceGroundBrushSliderDrag.id === (payload.id ?? 'pointer')) {
      this.updateRaceGroundBrushSlider(this.raceGroundBrushSliderDrag.region, payload.x);
      return;
    }
    if (this.raceSpriteSettingsSliderDrag && this.raceSpriteSettingsSliderDrag.id === (payload.id ?? 'pointer')) {
      this.updateRaceSpriteSettingsSlider(this.raceSpriteSettingsSliderDrag.region, payload.x);
      return;
    }
    if (this.raceSettingsSliderDrag && this.raceSettingsSliderDrag.id === (payload.id ?? 'pointer')) {
      this.updateRaceSettingsSlider(this.raceSettingsSliderDrag.region, payload.x);
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
    if (this.raceDecalPaintDrag && this.raceDecalPaintDrag.id === (payload.id ?? 'pointer')) {
      const kind = this.raceDecalPaintDrag.kind || 'decal';
      if (kind === 'tile') this.paintRaceArtTileAtPoint(payload);
      else {
        this.addRaceDecalAtPoint(payload, {
          kind,
          minSpacingM: 1.6
        });
      }
      return;
    }
    if (this.raceDecalEraseDrag && this.raceDecalEraseDrag.id === (payload.id ?? 'pointer')) {
      const kind = this.raceDecalEraseDrag.kind || 'decal';
      if (kind === 'tile') this.eraseRaceArtTileAtPoint(payload);
      else this.eraseRaceDecalAtPoint(payload, { kind });
      return;
    }
    if (this.updateRaceSceneryDrag(payload)) return;
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
    if (this.raceGroundBrushSliderDrag && this.raceGroundBrushSliderDrag.id === (payload.id ?? 'pointer')) {
      this.raceGroundBrushSliderDrag = null;
      return;
    }
    if (this.raceSpriteSettingsSliderDrag && this.raceSpriteSettingsSliderDrag.id === (payload.id ?? 'pointer')) {
      this.raceSpriteSettingsSliderDrag = null;
      return;
    }
    if (this.raceSettingsSliderDrag && this.raceSettingsSliderDrag.id === (payload.id ?? 'pointer')) {
      this.raceSettingsSliderDrag = null;
      return;
    }
    if (this.raceMapThumbstickDrag && this.raceMapThumbstickDrag.id === (payload.id ?? 'pointer')) {
      this.raceMapThumbstickDrag = null;
      this.portraitThumbstick.active = false;
      this.portraitThumbstick.id = null;
      this.portraitThumbstick.dx = 0;
      this.portraitThumbstick.dy = 0;
      this.portraitThumbstick.panX = 0;
      this.portraitThumbstick.panY = 0;
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
    if (this.raceSpriteDrag && this.raceSpriteDrag.id === (payload.id ?? 'pointer')) {
      this.raceSpriteDrag = null;
      return;
    }
    if (this.raceDecalPaintDrag && this.raceDecalPaintDrag.id === (payload.id ?? 'pointer')) {
      this.raceDecalPaintDrag = null;
      return;
    }
    if (this.raceDecalEraseDrag && this.raceDecalEraseDrag.id === (payload.id ?? 'pointer')) {
      this.raceDecalEraseDrag = null;
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
