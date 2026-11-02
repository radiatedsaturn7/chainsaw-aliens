const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const referenceRawGround = {
  getRaceRawGroundElevationAtWorldPoint(worldPoint = null, fallbackElevation = 0) {
    if (!worldPoint) return this.clampRaceElevation(fallbackElevation);
    const worldX = Number(worldPoint.x || 0);
    const worldZ = Number(worldPoint.z ?? worldPoint.y ?? 0);
    const tileMap = this.ensureRaceTileMap();
    const coords = this.getRaceTileMapCellCoords({ x: worldX, z: worldZ }, tileMap);
    const cacheKey = `raw:${Number(tileMap?.revision) || 0}:${coords.cellX},${coords.cellY}:${Math.round((Number(fallbackElevation) || 0) * 1000)}`;
    const cached = this.raceTerrainElevationCache?.get?.(cacheKey);
    if (Number.isFinite(cached)) return cached;
    let tileCell = this.getRaceTileMapCell(coords.cellX, coords.cellY, tileMap);
    // Extend a rectangular imported survey at its boundary instead of dropping
    // from a mountain to elevation zero outside the measured rectangle.
    if (!tileCell?.explicit && Number(this.selectedRace?.source?.importVersion) > 0) {
      this.raceSurveyBoundsCache ||= new WeakMap();
      let bounds = this.raceSurveyBoundsCache.get(tileMap);
      if (!bounds || bounds.revision !== tileMap.revision) {
        const entries = this.getRaceTileMapEntries(tileMap);
        bounds = { revision: tileMap.revision, minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
        for (const [key] of entries) {
          const [x, z] = key.split(',').map(Number);
          bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
          bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z);
        }
        bounds.rectangular = entries.length > 0 && entries.length === (bounds.maxX - bounds.minX + 1) * (bounds.maxZ - bounds.minZ + 1);
        this.raceSurveyBoundsCache.set(tileMap, bounds);
      }
      if (bounds.rectangular) tileCell = this.getRaceTileMapCell(
        clamp(coords.cellX, bounds.minX, bounds.maxX), clamp(coords.cellY, bounds.minZ, bounds.maxZ), tileMap
      );
    }
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
    const patches = this.ensureRaceRoadAuthoringData()?.groundTiles || [];
    if (!patches.length) return this.clampRaceElevation(fallbackElevation);
    const rawPoints = this.getRaceRawMapPoints();
    if (!rawPoints.length) return this.clampRaceElevation(fallbackElevation);
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

};
