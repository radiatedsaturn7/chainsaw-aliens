import {getSurfaceById} from './raceData.js';
import {createTrackStateCell} from './trackState/TrackStateCell.js';
import {roadTextureSettings} from './RaceRoadTextures.js';

// Shared saved-art defaults; races may customize these in Road & Margin Textures.
export const DEBUG_ROAD_SURFACES = Object.freeze([
  {id:'asphalt', label:'Asphalt', artRef:'road-asphalt-worn'},
  {id:'wet-asphalt', label:'Wet asphalt', artRef:'road-asphalt-wet'},
  {id:'gravel', label:'Gravel', artRef:'road-gravel-gray'},
  {id:'dirt', label:'Dirt', artRef:'road-dirt-packed'},
  {id:'snow', label:'Snow', artRef:'road-snow-packed'},
  {id:'ice', label:'Ice', artRef:'road-slush'}
]);
export function normalizeDebugRoad(value = {}) {
  return {
    surface: DEBUG_ROAD_SURFACES.some(s=>s.id===value.surface) ? value.surface : null,
    snowDepthMm: value.snowDepthMm != null && Number.isFinite(Number(value.snowDepthMm))
      ? Math.max(0, Math.min(304.8, Number(value.snowDepthMm))) : null
  };
}
export function createDebugRoadCell(options, debug) {
  const {surface, snowDepthMm} = normalizeDebugRoad(debug);
  if (options.base?.region !== 'road' || (!surface && snowDepthMm === null)) return createTrackStateCell(options);
  const base = surface ? {
    region:'road', elevationM:options.base.elevationM, normal:options.base.normal,
    surfaceTemperatureC:options.base.surfaceTemperatureC,
    baseSurfaceId:surface, materialId:surface, friction:getSurfaceById(surface).grip,
    roughness:options.base.roughness
  } : {...options.base};
  if (snowDepthMm !== null) {
    base.snowDepthMm = snowDepthMm;
    // None means no frozen covering, including authored ice/slush residue.
    if (snowDepthMm === 0) base.iceDepthMm = 0;
  }
  return createTrackStateCell({...options, base, profileOverrides:surface ? null : options.profileOverrides});
}
export function debugRoadTextureSettings(race, debug) {
  const settings = roadTextureSettings(race);
  const definition = DEBUG_ROAD_SURFACES.find(s=>s.id===debug?.surface);
  if (!definition) return settings;
  const artRef = race?.roadTextures?.debugSurfaces?.[definition.id] || definition.artRef;
  const road = {...settings.road, artRef, roughArtRef:'', repeatM:5, repeatWidthM:0};
  return {...settings, road, overrideRoad:road};
}
