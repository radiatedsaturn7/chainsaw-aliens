const DEFAULT_FLAT_JOIN_WIDTH_M = 0.5;
const DEFAULT_SLOPE_BLEND_WIDTH_M = 4;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (value) => {
  const t = clamp(Number(value) || 0, 0, 1);
  return t * t * (3 - 2 * t);
};

const normalizeVector3 = (vector = {}) => {
  const x = Number(vector.x || 0);
  const y = Number(vector.y ?? 0);
  const z = Number(vector.z || 0);
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
};

const cross = (a, b) => ({
  x: Number(a.y || 0) * Number(b.z || 0) - Number(a.z || 0) * Number(b.y || 0),
  y: Number(a.z || 0) * Number(b.x || 0) - Number(a.x || 0) * Number(b.z || 0),
  z: Number(a.x || 0) * Number(b.y || 0) - Number(a.y || 0) * Number(b.x || 0)
});

const defaultSurface = (id = 'asphalt') => ({
  id: String(id || 'asphalt'),
  grip: 1,
  label: String(id || 'asphalt')
});

export class RaceSurfaceModel {
  constructor(adapter = {}) {
    this.adapter = adapter;
    this.flatJoinWidthM = Math.max(0, Number(adapter.flatJoinWidthM) || DEFAULT_FLAT_JOIN_WIDTH_M);
    this.slopeBlendWidthM = Math.max(0.001, Number(adapter.slopeBlendWidthM) || DEFAULT_SLOPE_BLEND_WIDTH_M);
  }

  clampElevation(value = 0) {
    const numeric = Number(value);
    if (typeof this.adapter.clampElevation === 'function') {
      return this.adapter.clampElevation(Number.isFinite(numeric) ? numeric : 0);
    }
    return Number.isFinite(numeric) ? numeric : 0;
  }

  getSurfaceById(surfaceId = 'asphalt') {
    if (typeof this.adapter.getSurfaceById === 'function') {
      return this.adapter.getSurfaceById(surfaceId) || defaultSurface(surfaceId);
    }
    return defaultSurface(surfaceId);
  }

  getEffectiveSurfaceId(surfaceId = 'asphalt', weatherState = null) {
    if (typeof this.adapter.getEffectiveSurfaceId === 'function') {
      return this.adapter.getEffectiveSurfaceId(surfaceId, weatherState);
    }
    return this.getSurfaceById(surfaceId).id;
  }

  getWeatherState() {
    return typeof this.adapter.getWeatherState === 'function' ? this.adapter.getWeatherState() : null;
  }

  getRouteLength() {
    return Math.max(1, Number(this.adapter.getRouteLength?.() || 1) || 1);
  }

  getRuntimeType() {
    return String(this.adapter.getActiveRuntimeType?.() || 'destination');
  }

  getForwardVector(yaw = 0) {
    if (typeof this.adapter.getForwardVector === 'function') return this.adapter.getForwardVector(yaw);
    return { x: Math.sin(Number(yaw) || 0), z: -Math.cos(Number(yaw) || 0) };
  }

  getRightVector(yaw = 0) {
    if (typeof this.adapter.getRightVector === 'function') return this.adapter.getRightVector(yaw);
    return { x: Math.cos(Number(yaw) || 0), z: Math.sin(Number(yaw) || 0) };
  }

  getGroundSurfaceId(worldPoint = null, fallbackSurfaceId = 'asphalt') {
    if (typeof this.adapter.getGroundSurfaceForWorldPoint === 'function') {
      return this.adapter.getGroundSurfaceForWorldPoint(worldPoint, fallbackSurfaceId);
    }
    return this.getEffectiveSurfaceId(fallbackSurfaceId, this.getWeatherState());
  }

  sampleRawTerrain(x = 0, z = 0, fallbackElevation = 0) {
    const worldPoint = typeof x === 'object'
      ? { x: Number(x.x || 0), z: Number(x.z ?? x.y ?? 0) }
      : { x: Number(x || 0), z: Number(z || 0) };
    const fallback = typeof x === 'object' ? Number(z ?? fallbackElevation ?? 0) : Number(fallbackElevation || 0);
    const rawElevation = this.clampElevation(
      typeof this.adapter.sampleRawTerrain === 'function'
        ? this.adapter.sampleRawTerrain(worldPoint, fallback)
        : typeof this.adapter.sampleTerrain === 'function'
          ? this.adapter.sampleTerrain(worldPoint, fallback)
          : fallback
    );
    const tile = typeof this.adapter.getTileCellAtWorldPoint === 'function'
      ? this.adapter.getTileCellAtWorldPoint(worldPoint)
      : null;
    const surfaceId = this.getGroundSurfaceId(worldPoint, tile?.surface || 'asphalt');
    return {
      x: worldPoint.x,
      z: worldPoint.z,
      elevation: rawElevation,
      rawElevation,
      normal: this.sampleRawTerrainNormal(worldPoint.x, worldPoint.z, rawElevation),
      tile,
      materialId: tile?.tileId || surfaceId,
      surfaceId,
      friction: this.getSurfaceById(surfaceId).grip,
      region: 'terrain',
      driveable: false,
      blend: 1
    };
  }

  sampleRawTerrainNormal(x = 0, z = 0, fallbackElevation = 0) {
    const step = Math.max(0.5, Number(this.adapter.normalSampleStepM) || 1);
    const sampler = typeof this.adapter.sampleRawTerrain === 'function'
      ? this.adapter.sampleRawTerrain
      : this.adapter.sampleTerrain;
    const left = this.clampElevation(sampler?.({ x: x - step, z }, fallbackElevation) ?? fallbackElevation);
    const right = this.clampElevation(sampler?.({ x: x + step, z }, fallbackElevation) ?? fallbackElevation);
    const back = this.clampElevation(sampler?.({ x, z: z - step }, fallbackElevation) ?? fallbackElevation);
    const front = this.clampElevation(sampler?.({ x, z: z + step }, fallbackElevation) ?? fallbackElevation);
    return normalizeVector3({
      x: (left - right) / (step * 2),
      y: 1,
      z: (back - front) / (step * 2)
    });
  }

  sampleTerrainNormal(x = 0, z = 0, fallbackElevation = 0) {
    const step = Math.max(0.5, Number(this.adapter.normalSampleStepM) || 1);
    const left = this.clampElevation(this.adapter.sampleTerrain?.({ x: x - step, z }, fallbackElevation) ?? fallbackElevation);
    const right = this.clampElevation(this.adapter.sampleTerrain?.({ x: x + step, z }, fallbackElevation) ?? fallbackElevation);
    const back = this.clampElevation(this.adapter.sampleTerrain?.({ x, z: z - step }, fallbackElevation) ?? fallbackElevation);
    const front = this.clampElevation(this.adapter.sampleTerrain?.({ x, z: z + step }, fallbackElevation) ?? fallbackElevation);
    return normalizeVector3({
      x: (left - right) / (step * 2),
      y: 1,
      z: (back - front) / (step * 2)
    });
  }

  sampleDeckAtDistance(distance = 0, options = {}) {
    const runtimeType = options.runtimeType || this.getRuntimeType();
    const routeLength = Math.max(1, Number(options.routeLength || this.getRouteLength()) || 1);
    const roadbed = typeof this.adapter.getRoadbedProfile === 'function'
      ? this.adapter.getRoadbedProfile({
        samples: options.samples || null,
        routeLength,
        runtimeType,
        allowVisualExtension: Boolean(options.allowVisualExtension)
      })
      : null;
    const local = typeof this.adapter.sampleRoadbedProfileAtDistance === 'function'
      ? this.adapter.sampleRoadbedProfileAtDistance(distance, roadbed)
      : null;
    const fallbackPose = local || this.adapter.getWorldPoseAtDistance?.(distance, {
      samples: options.samples || null,
      routeLength,
      runtimeType,
      allowVisualExtension: Boolean(options.allowVisualExtension)
    }) || {};
    const segment = fallbackPose.segment || this.adapter.getSegmentAtDistance?.(distance) || null;
    const yaw = Number(fallbackPose.yaw || 0);
    const tangent = normalizeVector3({
      ...this.getForwardVector(yaw),
      y: Number(fallbackPose.grade || 0)
    });
    const right = normalizeVector3({ ...this.getRightVector(yaw), y: 0 });
    const normal = normalizeVector3(cross(right, tangent));
    const roadHalfWidth = Math.max(0, Number(fallbackPose.roadHalfWidth ?? this.adapter.getRoadHalfWidth?.(segment) ?? 0) || 0);
    const marginWidth = Math.max(0, Number(fallbackPose.marginWidth ?? this.adapter.getMarginWidth?.(segment) ?? 0) || 0);
    const shoulderWidth = Math.max(0, Number(fallbackPose.shoulderWidth ?? this.adapter.getShoulderWidth?.(segment) ?? 0) || 0);
    return {
      ...fallbackPose,
      distance: Number(distance) || 0,
      x: Number(fallbackPose.x || 0),
      z: Number(fallbackPose.z || 0),
      y: Number(fallbackPose.z || 0),
      yaw,
      elevation: this.clampElevation(fallbackPose.elevation),
      routeElevation: this.clampElevation(fallbackPose.routeElevation ?? fallbackPose.elevation),
      terrainElevation: this.clampElevation(fallbackPose.terrainElevation ?? fallbackPose.elevation),
      supportElevation: this.clampElevation(fallbackPose.supportElevation ?? fallbackPose.elevation),
      grade: clamp(Number(fallbackPose.grade || 0), -0.42, 0.42),
      tangent,
      normal,
      right,
      segment,
      roadHalfWidth,
      marginWidth,
      shoulderWidth,
      stampedHalfWidth: Math.max(roadHalfWidth, Number(fallbackPose.stampedHalfWidth || roadHalfWidth + marginWidth + shoulderWidth)),
      blendWidth: Math.max(
        shoulderWidth > 0 ? 2.5 : 0.35,
        Number(fallbackPose.blendWidth || 0),
        Number(this.adapter.getBlendWidth?.(segment) || 0)
      )
    };
  }

  getCorridorMetrics(sample = {}, segment = sample?.segment || null) {
    const roadHalfWidth = Math.max(0, Number(sample?.roadHalfWidth ?? this.adapter.getRoadHalfWidth?.(segment) ?? 0) || 0);
    const marginWidth = Math.max(0, Number(sample?.marginWidth ?? this.adapter.getMarginWidth?.(segment) ?? 0) || 0);
    const shoulderWidth = Math.max(0, Number(sample?.shoulderWidth ?? this.adapter.getShoulderWidth?.(segment) ?? 0) || 0);
    const transitionMinWidth = this.flatJoinWidthM + this.slopeBlendWidthM;
    const transitionWidth = Math.max(transitionMinWidth, Number(sample?.blendWidth || 0), Number(this.adapter.getBlendWidth?.(segment) || 0));
    const flatJoinWidth = Math.min(this.flatJoinWidthM, transitionWidth);
    const slopeBlendWidth = Math.max(0.001, transitionWidth - flatJoinWidth);
    const roadEnd = roadHalfWidth;
    const marginEnd = roadEnd + marginWidth;
    const shoulderEnd = marginEnd + shoulderWidth;
    const flatJoinEnd = shoulderEnd + flatJoinWidth;
    const transitionEnd = flatJoinEnd + slopeBlendWidth;
    return {
      roadHalfWidth,
      marginWidth,
      shoulderWidth,
      roadEnd,
      marginEnd,
      shoulderEnd,
      flatJoinWidth,
      flatJoinEnd,
      slopeBlendWidth,
      transitionWidth,
      transitionEnd,
      marginHalfWidth: marginEnd,
      hardHalfWidth: shoulderEnd,
      outerHalfWidth: transitionEnd
    };
  }

  classifyLateral(lateral = 0, sample = {}, segment = sample?.segment || null) {
    const metrics = this.getCorridorMetrics(sample, segment);
    const absLateral = Math.abs(Number(lateral || 0));
    if (absLateral <= metrics.roadEnd) return { region: 'road', metrics, blend: 0 };
    if (absLateral <= metrics.marginEnd) return { region: 'margin', metrics, blend: 0 };
    if (absLateral <= metrics.shoulderEnd) return { region: 'shoulder', metrics, blend: 0 };
    if (absLateral <= metrics.transitionEnd) {
      const transitionStart = metrics.shoulderEnd;
      const t = smoothstep((absLateral - transitionStart) / Math.max(0.001, metrics.transitionWidth));
      return { region: 'transition', metrics, blend: t };
    }
    return { region: 'terrain', metrics, blend: 1 };
  }

  getCrossSectionAtDistance(distance = 0, options = {}) {
    const sampledDeck = this.sampleDeckAtDistance(distance, options);
    const deck = options.deckSample
      ? {
        ...sampledDeck,
        ...options.deckSample,
        normal: options.deckSample.normal || sampledDeck.normal,
        tangent: options.deckSample.tangent || sampledDeck.tangent,
        right: options.deckSample.right || sampledDeck.right,
        segment: options.deckSample.segment || sampledDeck.segment
      }
      : sampledDeck;
    const metrics = this.getCorridorMetrics(deck, deck.segment);
    const right = deck.right || this.getRightVector(deck.yaw);
    const makePoint = (lateralOffset, edge, pointElevation = deck.elevation, roadDeckElevation = true) => ({
      ...deck,
      x: Number(deck.x || 0) + Number(right.x || 0) * Number(lateralOffset || 0),
      z: Number(deck.z || 0) + Number(right.z || 0) * Number(lateralOffset || 0),
      y: Number(deck.z || 0) + Number(right.z || 0) * Number(lateralOffset || 0),
      elevation: this.clampElevation(pointElevation),
      edge,
      lateralOffset,
      roadDistance: Number(distance) || 0,
      distance: Number(distance) || 0,
      routeDistance: Number(distance) || 0,
      roadDeckElevation,
      segment: deck.segment
    });
    const makeSamplePoint = (lateralOffset, edge) => {
      const sample = this.sampleTrack(Number(distance) || 0, lateralOffset, { deckSample: deck });
      return makePoint(
        lateralOffset,
        edge,
        sample.elevation,
        sample.region === 'road' || sample.region === 'margin' || sample.region === 'shoulder'
      );
    };
    return {
      center: makePoint(0, 'center'),
      left: makePoint(-metrics.roadEnd, 'left'),
      right: makePoint(metrics.roadEnd, 'right'),
      marginLeft: makePoint(-metrics.marginEnd, 'margin-left'),
      marginRight: makePoint(metrics.marginEnd, 'margin-right'),
      shoulderLeft: makePoint(-metrics.shoulderEnd, 'shoulder-left'),
      shoulderRight: makePoint(metrics.shoulderEnd, 'shoulder-right'),
      transitionLeft: makeSamplePoint(-metrics.transitionEnd, 'transition-left'),
      transitionRight: makeSamplePoint(metrics.transitionEnd, 'transition-right'),
      terrainLeft: makeSamplePoint(-metrics.transitionEnd, 'terrain-left'),
      terrainRight: makeSamplePoint(metrics.transitionEnd, 'terrain-right'),
      metrics,
      deck
    };
  }

  sampleTrack(distance = 0, lateral = 0, options = {}) {
    const deck = options.deckSample || this.sampleDeckAtDistance(distance, options);
    const metrics = this.getCorridorMetrics(deck, deck.segment);
    const right = deck.right || this.getRightVector(deck.yaw);
    const x = Number(deck.x || 0) + Number(right.x || 0) * Number(lateral || 0);
    const z = Number(deck.z || 0) + Number(right.z || 0) * Number(lateral || 0);
    const fallbackSurface = deck.segment?.surface || options.fallbackSurfaceId || 'asphalt';
    const raw = this.sampleRawTerrain(x, z, deck.elevation);
    const classification = this.classifyLateral(lateral, deck, deck.segment);
    let region = classification.region;
    let blend = classification.blend;
    let elevation = raw.elevation;
    let terrainGripScale = 1;
    let surfaceId = raw.surfaceId || this.getGroundSurfaceId({ x, z }, fallbackSurface);
    if (region === 'road') {
      elevation = deck.elevation;
      terrainGripScale = 1;
      surfaceId = this.getEffectiveSurfaceId(fallbackSurface, this.getWeatherState());
    } else if (region === 'margin') {
      elevation = deck.elevation;
      terrainGripScale = 0.96;
      surfaceId = this.getEffectiveSurfaceId(fallbackSurface, this.getWeatherState());
    } else if (region === 'shoulder') {
      elevation = deck.elevation;
      terrainGripScale = 1;
    } else if (region === 'transition') {
      elevation = deck.elevation * (1 - blend) + raw.elevation * blend;
      terrainGripScale = 1;
    }
    surfaceId = this.getEffectiveSurfaceId(surfaceId, this.getWeatherState());
    const surface = this.getSurfaceById(surfaceId);
    const normal = region === 'terrain'
      ? raw.normal
      : region === 'transition'
        ? normalizeVector3({
          x: deck.normal.x * (1 - blend) + raw.normal.x * blend,
          y: deck.normal.y * (1 - blend) + raw.normal.y * blend,
          z: deck.normal.z * (1 - blend) + raw.normal.z * blend
        })
        : deck.normal;
    const materialId = region === 'road' || region === 'margin' ? surface.id : raw.materialId;
    return {
      x,
      z,
      distance: Number(distance) || 0,
      lateral: Number(lateral || 0),
      elevation: this.clampElevation(elevation),
      normal,
      region,
      surfaceId: surface.id,
      materialId,
      tile: raw.tile,
      friction: clamp(Number(surface.grip || 1) * terrainGripScale, 0.18, 1.2),
      terrainGripScale: clamp(terrainGripScale, 0.18, 1.2),
      driveable: region !== 'terrain',
      rawElevation: raw.elevation,
      roadElevation: deck.elevation,
      deckElevation: deck.elevation,
      blend,
      segment: deck.segment,
      metrics,
      projection: {
        distance: Number(distance) || 0,
        lateral: Number(lateral || 0),
        segment: deck.segment,
        yaw: deck.yaw
      }
    };
  }

  sampleWorld(x = 0, z = 0, options = {}) {
    const worldPoint = typeof x === 'object'
      ? { x: Number(x.x || 0), z: Number(x.z ?? x.y ?? 0) }
      : { x: Number(x || 0), z: Number(z || 0) };
    const fallbackElevation = typeof x === 'object'
      ? Number(z ?? options.fallbackElevation ?? 0)
      : Number(options.fallbackElevation ?? 0);
    const projection = typeof this.adapter.projectWorldToTrack === 'function'
      ? this.adapter.projectWorldToTrack(worldPoint)
      : null;
    if (!projection?.segment || !Number.isFinite(Number(projection.lateral))) {
      return {
        ...this.sampleRawTerrain(worldPoint, fallbackElevation),
        projection,
        roadElevation: this.clampElevation(fallbackElevation),
        metrics: null
      };
    }
    const track = this.sampleTrack(Number(projection.distance || 0), Number(projection.lateral || 0), {
      ...options,
      fallbackSurfaceId: projection.segment?.surface || options.fallbackSurfaceId || 'asphalt'
    });
    if (Math.abs(Number(projection.lateral || 0)) > Number(track.metrics?.transitionEnd || 0)) {
      return {
        ...this.sampleRawTerrain(worldPoint, fallbackElevation),
        projection,
        roadElevation: track.roadElevation,
        metrics: track.metrics
      };
    }
    return {
      ...track,
      x: worldPoint.x,
      z: worldPoint.z,
      projection: {
        ...projection,
        distance: Number(projection.distance || 0),
        lateral: Number(projection.lateral || 0)
      }
    };
  }
}

export default RaceSurfaceModel;
