import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || { location: { search: '' } };
const { default: Game } = await import('../../src/game/GameCore.js');
const {
  clearCachedProjectFilesForTests,
  upsertCachedProjectFile
} = await import('../../src/ui/serverStorage.js');

const makePlayer = () => ({
  x: 320,
  y: 192,
  vx: 45,
  vy: -20,
  facing: -1,
  health: 7,
  maxHealth: 12,
  loot: 3,
  credits: 41,
  upgradeSlots: 4,
  equippedUpgrades: [{ id: 'drive-torque', modifiers: { speed: 20 } }],
  cosmetics: [{ id: 'red-shell' }],
  oilLevel: 8,
  superCharge: 0.75,
  superReady: true,
  flameMode: true,
  dead: false,
  state: 'run',
  attackTimer: 1,
  attackLungeTimer: 1,
  dashTimer: 1,
  hurtTimer: 1,
  invulnTimer: 1,
  applyUpgrades(upgrades) {
    this.appliedUpgrades = upgrades;
  }
});

test('race travel player snapshots preserve durable state and restore an exact neutral departure pose', () => {
  const game = Object.create(Game.prototype);
  game.player = makePlayer();
  game.abilities = { anchor: true, flame: true, magboots: false };
  game.activeWeaponIndex = 2;
  game.ensureActiveWeaponAvailable = () => {};

  const snapshot = game.captureRaceTravelPlayerState();
  game.player.x = 999;
  game.player.y = 888;
  game.player.health = 1;
  game.player.credits = 0;
  game.player.equippedUpgrades = [];
  game.abilities = {};
  game.activeWeaponIndex = 0;

  game.restoreRaceTravelPlayerState(snapshot, { restorePosition: true });

  assert.equal(game.player.x, 320);
  assert.equal(game.player.y, 192);
  assert.equal(game.player.facing, -1);
  assert.equal(game.player.health, 7);
  assert.equal(game.player.credits, 41);
  assert.deepEqual(game.player.equippedUpgrades.map((entry) => entry.id), ['drive-torque']);
  assert.deepEqual(game.abilities, { anchor: true, flame: true, magboots: false });
  assert.equal(game.activeWeaponIndex, 2);
  assert.equal(game.player.vx, 0);
  assert.equal(game.player.vy, 0);
  assert.equal(game.player.state, 'idle');
  assert.equal(game.player.attackTimer, 0);
});

test('returning from race travel resumes gameplay at the captured origin', () => {
  const game = Object.create(Game.prototype);
  game.player = makePlayer();
  game.abilities = { anchor: true };
  game.activeWeaponIndex = 1;
  game.ensureActiveWeaponAvailable = () => {};
  const snapshot = game.captureRaceTravelPlayerState();
  game.player.x = 900;
  game.player.y = 900;
  game.raceTravelSession = {
    originState: 'playing',
    originPlaytestActive: true,
    playerSnapshot: snapshot
  };
  game.raceEditorPlaytestReturn = true;
  let transition = null;
  game.transitionTo = (state) => {
    transition = state;
  };
  game.snapCameraToPlayer = () => {};
  game.showSystemToast = () => {};

  assert.equal(game.returnRaceTravelToOrigin(), true);
  assert.equal(transition, 'playing');
  assert.equal(game.playtestActive, true);
  assert.equal(game.raceTravelSession, null);
  assert.equal(game.raceEditorPlaytestReturn, false);
  assert.deepEqual(game.lastSave, { x: 320, y: 192 });
});

test('chained race travel preserves Track State snapshots for the same race identity', () => {
  clearCachedProjectFilesForTests();
  upsertCachedProjectFile('races', 'Next Race', JSON.stringify({
    version: 1,
    folder: 'races',
    name: 'Next Race',
    savedAt: 1,
    data: { id: 'next-race', name: 'Next Race', road: { nodes: [], segments: [] } }
  }));
  const previousSnapshot = { version: 1, checksum: 'previous' };
  const currentSnapshot = { version: 1, checksum: 'current' };
  const game = Object.create(Game.prototype);
  game.raceTravelSession = {
    originState: 'playing',
    carId: 'car',
    trackStateByRace: {
      'Next Race': previousSnapshot
    }
  };
  game.transitionTo = () => {};
  let started = null;
  game.raceEditor = {
    applyLoadedRaceDocument: () => true,
    startPlaytest: (carId, options) => {
      started = { carId, options };
    }
  };

  assert.equal(game.completeRaceTravel({
    type: 'race',
    targetRace: 'Next Race'
  }, {
    carId: 'car',
    raceId: 'current-race',
    raceDocumentName: 'Current Race',
    trackStateSnapshot: currentSnapshot
  }), true);
  assert.equal(game.raceTravelSession.trackStateByRace['current-race'], currentSnapshot);
  assert.equal(game.raceTravelSession.trackStateByRace['Current Race'], currentSnapshot);
  assert.equal(started.carId, 'car');
  assert.equal(started.options.trackStateSnapshot, previousSnapshot);
  clearCachedProjectFilesForTests();
});

test('startup race travel yields to a loading screen before applying a dense race', async () => {
  clearCachedProjectFilesForTests();
  upsertCachedProjectFile('races', 'Studio Sprint', JSON.stringify({
    version: 1,
    folder: 'races',
    name: 'Studio Sprint',
    savedAt: 1,
    data: { race: { id: 'studio-sprint', name: 'Studio Sprint' } }
  }));
  upsertCachedProjectFile('cars', '2022 Subaru WRX', JSON.stringify({
    version: 1,
    folder: 'cars',
    name: '2022 Subaru WRX',
    savedAt: 1,
    data: { kind: 'race-car', car: { id: 'wrx', name: '2022 Subaru WRX' } }
  }));
  const events = [];
  const exactRaceDocument = {
    kind: 'race-track',
    savedAt: 42,
    race: {
      id: 'studio-sprint',
      name: 'Studio Sprint',
      road: {
        tileMap: {
          defaultTileId: 'grass',
          cells: {
            '1,2': {
              tileId: 'grass',
              tileWeights: { grass: 1 },
              artRef: 'providenceGround',
              elevation: 0.342
            }
          }
        }
      }
    }
  };
  const car = {
    id: 'wrx',
    name: '2022 Subaru WRX',
    art: {
      body: 'rtg-001',
      tires: 'tire',
      layerVisibility: {
        frontWheels: false,
        rearWheels: true
      }
    },
    audio: {
      engineSoundId: 'Engine WRX SPT'
    }
  };
  const game = Object.create(Game.prototype);
  game.state = 'playing';
  game.playtestActive = true;
  game.raceEditorPlaytestReturn = false;
  game.captureRaceTravelPlayerState = () => ({ position: { x: 1, y: 2 } });
  game.transitionTo = (state) => {
    game.state = state;
    events.push(`transition:${state}`);
  };
  game.setRevAudio = () => {};
  game.showSystemToast = () => {};
  let preparedEngineSoundId = '';
  game.prepareRacePlaytestAudio = async ({ engineSoundId = '' } = {}) => {
    preparedEngineSoundId = engineSoundId;
    return true;
  };
  game.raceEditor = {
    normalizeLoadedCarDocument: () => structuredClone(car),
    withSavedRaceCarRuntimeIdentity: (entry) => entry,
    selectPlaytestCarEntry: () => true,
    getRaceCarProjectIdentity: (entry) => entry.id,
    collectRaceCarArtRefs: (entry) => {
      assert.equal(entry.art.body, 'rtg-001');
      assert.equal(entry.art.layerVisibility.frontWheels, false);
      return ['rtg-001', 'tire'];
    },
    beginRaceTravelLoading: (raceName) => events.push(`loading:${raceName}`),
    loadRaceTravelDocument: async (_raceName, options) => {
      assert.deepEqual(options.artRefs, ['rtg-001', 'tire']);
      events.push('worker');
      return {
        race: exactRaceDocument,
        bake: { packedTerrain: { packed: true, triangleCount: 2 } },
        artAssets: [{ artRef: 'providenceGround' }],
        missingArtRefs: ['optional-art'],
        normalizedRace: true
      };
    },
    setRaceTravelPreparationPhase: (phase) => events.push(`phase:${phase}`),
    applyLoadedRaceDocument: (document, options) => {
      assert.deepEqual(document, exactRaceDocument);
      assert.equal(document.race.road.tileMap.cells['1,2'].artRef, 'providenceGround');
      assert.equal(document.race.road.tileMap.cells['1,2'].elevation, 0.342);
      assert.equal(options.name, 'Studio Sprint');
      assert.equal(options.normalized, true);
      assert.equal(options.preservePreparation, true);
      events.push('apply');
      return true;
    },
    adoptPreparedRaceArtAssets: (assets, options) => {
      assert.equal(assets[0].artRef, 'providenceGround');
      assert.deepEqual(options.missingArtRefs, ['optional-art']);
      events.push('art');
    },
    startPlaytest: (carId, options) => {
      assert.equal(carId, 'wrx');
      assert.equal(options.preparedWorldBake.packedTerrain.triangleCount, 2);
      game.raceEditor.playtestSession = { running: true };
      events.push('start');
    }
  };

  const started = await game.startRaceTravel({
    raceName: 'Studio Sprint',
    carSelection: 'specific',
    carRef: '2022 Subaru WRX'
  });

  assert.equal(started, true);
  assert.equal(preparedEngineSoundId, 'Engine WRX SPT');
  assert.deepEqual(events, [
    'transition:race-editor',
    'loading:Studio Sprint',
    'worker',
    'phase:applying-race',
    'apply',
    'phase:transfer-art',
    'art',
    'phase:starting-race',
    'start'
  ]);
  clearCachedProjectFilesForTests();
});

test('race travel prefers the matching live Car Editor document over an older saved copy', async () => {
  const liveCar = {
    id: 'starter-rwd',
    name: '2022 Subaru WRX',
    art: {
      body: 'rtg-live',
      layerVisibility: {
        frontWheels: false,
        rearWheels: true
      }
    },
    camera: { trackingMode: 'fixed-rear' },
    tuning: { drivetrain: 'awd', springFront: 0.91 }
  };
  const selected = [];
  const game = Object.create(Game.prototype);
  game.carEditor = {
    currentCarDocumentName: '2022 Subaru WRX2',
    selectedCar: liveCar
  };
  game.raceEditor = {
    normalizeLoadedCarDocument: (document) => structuredClone(document.car || document),
    withSavedRaceCarRuntimeIdentity: (car, name) => {
      car.__playtestId = `saved-car:${name}`;
      car.__playtestDocumentName = name;
      return car;
    },
    selectPlaytestCarEntry: (entry) => {
      selected.push(entry.car);
      return true;
    },
    getRaceCarProjectIdentity: (car) => car.__playtestId || car.id,
    collectRaceCarArtRefs: (car) => [car.art.body]
  };

  const resolved = await game.resolveRaceTravelCarAsync('2022 Subaru WRX2');

  assert.equal(resolved.source, 'live-car-editor');
  assert.equal(resolved.car.art.body, 'rtg-live');
  assert.equal(resolved.car.tuning.springFront, 0.91);
  assert.deepEqual(resolved.artRefs, ['rtg-live']);
  assert.notEqual(resolved.car, liveCar);
  assert.equal(selected.length, 1);
});

test('race travel start failures clear preparation and return to the originating level', async () => {
  const game = Object.create(Game.prototype);
  game.state = 'playing';
  game.playtestActive = true;
  game.raceEditorPlaytestReturn = false;
  game.captureRaceTravelPlayerState = () => ({ position: { x: 1, y: 2 } });
  game.resolveRaceTravelCarAsync = async () => ({ id: 'wrx', name: '2022 Subaru WRX2' });
  game.transitionTo = (state) => {
    game.state = state;
  };
  game.setRevAudio = () => {};
  game.showSystemToast = () => {};
  let canceled = 0;
  let returnedMessage = '';
  game.returnRaceTravelToOrigin = ({ message } = {}) => {
    returnedMessage = message;
    game.raceTravelSession = null;
    game.state = 'playing';
    return true;
  };
  game.raceEditor = {
    beginRaceTravelLoading() {},
    loadRaceTravelDocument: async () => ({
      race: {
        id: 'studio-sprint',
        name: 'Studio Sprint2',
        road: { nodes: [], segments: [] }
      },
      bake: { packedTerrain: { packed: true, triangleCount: 2 } },
      normalizedRace: true
    }),
    applyLoadedRaceDocument: () => true,
    startPlaytest: () => {
      throw new Error('vehicle initialization failed');
    },
    cancelRacePlaytestPreparation: () => {
      canceled += 1;
      return true;
    }
  };

  const started = await game.startRaceTravel({
    raceName: 'Studio Sprint2',
    carSelection: 'specific',
    carRef: '2022 Subaru WRX2'
  });

  assert.equal(started, false);
  assert.equal(game.state, 'playing');
  assert.equal(canceled, 1);
  assert.match(returnedMessage, /race start failed/i);
  assert.match(returnedMessage, /vehicle initialization failed/i);
});

test('race travel returns to the level after a preparation-stage failure instead of retrying the dense bake', async () => {
  const game = Object.create(Game.prototype);
  game.state = 'playing';
  game.playtestActive = true;
  game.raceEditorPlaytestReturn = false;
  game.captureRaceTravelPlayerState = () => ({ position: { x: 1, y: 2 } });
  game.resolveRaceTravelCarAsync = async () => ({ id: 'wrx', name: '2022 Subaru WRX2' });
  game.transitionTo = (state) => {
    game.state = state;
  };
  game.setRevAudio = () => {};
  game.showSystemToast = () => {};
  let returnedMessage = '';
  game.returnRaceTravelToOrigin = ({ message } = {}) => {
    returnedMessage = message;
    game.raceTravelSession = null;
    game.state = 'playing';
    return true;
  };
  let applyCalls = 0;
  let startCalls = 0;
  game.raceEditor = {
    beginRaceTravelLoading() {},
    loadRaceTravelDocument: async () => {
      const error = new Error('worker ran out of memory');
      error.racePreparationProgress = 0.76;
      error.racePreparationStage = 'physics-pack';
      throw error;
    },
    applyLoadedRaceDocument: () => {
      applyCalls += 1;
      return true;
    },
    startPlaytest: () => {
      startCalls += 1;
    }
  };

  const started = await game.startRaceTravel({
    raceName: 'Studio Sprint2',
    carSelection: 'specific',
    carRef: '2022 Subaru WRX2'
  });

  assert.equal(started, false);
  assert.equal(game.state, 'playing');
  assert.equal(applyCalls, 0);
  assert.equal(startCalls, 0);
  assert.match(returnedMessage, /physics pack/i);
  assert.match(returnedMessage, /worker ran out of memory/i);
});

test('race travel hydrates the exact saved car document instead of reusing a stale matching car', async () => {
  clearCachedProjectFilesForTests();
  const exactDocument = {
    schemaVersion: 2,
    kind: 'race-car',
    car: {
      id: 'starter-rwd',
      name: '2022 Subaru WRX',
      art: {
        layerVisibility: {
          body: true,
          tires: true,
          frontWheels: false,
          rearWheels: true
        }
      },
      camera: { trackingMode: 'fixed-rear' },
      tuning: { drivetrain: 'awd', springFront: 0.82 },
      setup: {}
    }
  };
  upsertCachedProjectFile('cars', '2022 Subaru WRX2', JSON.stringify({
    version: 1,
    folder: 'cars',
    name: '2022 Subaru WRX2',
    savedAt: 2,
    data: exactDocument
  }));
  const stale = {
    id: 'starter-rwd',
    name: '2022 Subaru WRX2',
    art: { layerVisibility: { frontWheels: true, rearWheels: true } },
    camera: { trackingMode: 'dynamic' },
    tuning: { drivetrain: 'awd', springFront: 0.5 }
  };
  const selected = [];
  const game = Object.create(Game.prototype);
  game.raceEditor = {
    project: { cars: [stale] },
    findRaceProjectCarById: () => stale,
    normalizeLoadedCarDocument: (payload) => structuredClone(payload.car),
    withSavedRaceCarRuntimeIdentity: (car, name) => {
      car.__playtestId = `saved-car:${name}`;
      car.__playtestDocumentName = name;
      return car;
    },
    selectPlaytestCarEntry: (entry) => {
      selected.push(entry.car);
      return true;
    },
    getRaceCarProjectIdentity: (car) => car.__playtestId || car.id
  };

  const resolved = await game.resolveRaceTravelCarAsync('2022 Subaru WRX2');

  assert.equal(resolved.id, 'saved-car:2022 Subaru WRX2');
  assert.equal(resolved.car.art.layerVisibility.frontWheels, false);
  assert.equal(resolved.car.camera.trackingMode, 'fixed-rear');
  assert.equal(resolved.car.tuning.springFront, 0.82);
  assert.equal(selected.length, 1);
  clearCachedProjectFilesForTests();
});
