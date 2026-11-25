const fixtureFiles=new Map([
 ['art',new Set(['grass','rtg-001','tire'])],
 ['races',new Set(['Studio Sprint','Studio Sprint2'])],
 ['cars',new Set(['2022 Subaru WRX2'])],
 ['levels',new Set(['levelA'])]
]);
const isolatedPages=new WeakSet();

async function isolateRaceRuntimeFiles(page){
  if(isolatedPages.has(page))return;
  const files=new Map();
  // Browser tests share the development server. Fixtures must survive reload
  // within this test, but must not replace real files or enter another test's picker.
  await page.route(url=>url.pathname==='/__storage/file',async route=>{
    const request=route.request(),method=request.method(),url=new URL(request.url());
    if(method!=='GET'&&method!=='POST')return route.fallback();
    const posted=method==='POST'?request.postDataJSON():null;
    const folder=posted?.folder??url.searchParams.get('folder'),name=posted?.name??url.searchParams.get('name');
    if(!fixtureFiles.get(folder)?.has(name))return route.fallback();
    const key=`${folder}:${name}`;
    if(posted){
      const {data,savedAt,version}=posted;
      files.set(key,{folder,name,data,savedAt,version});
    }
    const file=files.get(key);
    if(!file)return route.fallback();
    return route.fulfill({json:{ok:true,file}});
  });
  await page.route(url=>url.pathname==='/__storage/index',async route=>{
    if(!files.size||route.request().method()!=='GET')return route.fallback();
    const folder=new URL(route.request().url()).searchParams.get('folder');
    const relevant=[...files.values()].filter(file=>!folder||file.folder===folder);
    if(!relevant.length)return route.fallback();
    const response=await route.fetch();
    if(!response.ok())return route.fulfill({response});
    const payload=await response.json();
    for(const file of relevant)(payload.index[file.folder]??={})[file.name]={updatedAt:file.savedAt,size:JSON.stringify(file.data).length};
    return route.fulfill({response,json:payload});
  });
  isolatedPages.add(page);
}

export async function seedRaceRuntimeFixtures(page, {straight = false} = {}) {
  await isolateRaceRuntimeFiles(page);
  await page.evaluate(async ({straight}) => {
    const game = window.__game;
    const editor = game.raceEditor;
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const now = Date.now();
    const {saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');
    // Seed the browser cache as well as its scoped storage. Raw POSTs leave
    // documents hydrated during startup pointing at committed race/car data.
    const postFile = async (folder, name, data, offset = 0) => {
      await saveProjectFileAndConfirm(folder,name,data,{savedAt:now+offset,createVersion:false});
    };
    const makeArt = (width, height, color) => ({
      schemaVersion: 1,
      kind: 'pixel-art',
      width,
      height,
      size: width,
      fps: 6,
      frames: [Array(width * height).fill(color)]
    });

    const {createDefaultRace}=await import('/src/racing/raceData.js');
    const race = createDefaultRace();
    race.id = 'playwright-studio-sprint-2';
    race.name = 'Studio Sprint 2';
    race.laps = 1;
    if(straight){
      // Finish-flow contracts need a deterministic approach, not an AI handling test.
      race.type='destination';
      race.road.nodes=[{x:0,y:0,elevation:0,role:'start',locked:true},{x:0,y:740,elevation:0,role:'finish'}];
      race.road.segments=[{length:740,curve:0,elevation:0,surface:'asphalt',hazardIds:[]}];
    }
    race.finishBehavior = {type:'return-to-origin'};
    race.weather = 'clear';
    race.groundRenderer = 'webgl-track';
    race.groundTextureBaseWorldM = 8.016;
    race.skyboxArtRef = 'grass';
    race.skyboxSettings = {
      ...(race.skyboxSettings || {}),
      artRef: 'grass'
    };
    race.surfaceArt = {
      asphalt: 'grass',
      dirt: 'grass',
      gravel: 'grass',
      boundary: 'grass'
    };
    race.margin = {
      ...(race.margin || {}),
      artRef: 'grass'
    };
    race.raceStart = {
      ...(race.raceStart || {}),
      countdown: false,
      rollingStart: false,
      musicTrackId: ''
    };
    race.competition = {
      ...(race.competition || {}),
      mode: 'solo',
      aiDrivers: [],
      trafficEnabled: false
    };
    race.road = {
      ...(race.road || {}),
      selectedGroundTileId: 'grass',
      tileMap: {
        cellSizeM: 5,
        defaultTileId: 'grass',
        minElevation: -0.42,
        maxElevation: 0.42,
        revision: 7,
        cells: {
          '0,0': { tileId: 'grass', artRef: 'grass', elevation: 0.04 },
          '1,0': { tileId: 'grass', artRef: 'grass', elevation: 0.08 },
          '2,0': { tileId: 'grass', artRef: 'grass', elevation: 0.12 },
          '0,1': { tileId: 'grass', artRef: 'grass', elevation: -0.03 },
          '1,1': { tileId: 'grass', artRef: 'grass', elevation: 0.02 },
          '2,1': { tileId: 'grass', artRef: 'grass', elevation: 0.07 }
        }
      }
    };

    const car = clone(
      editor.project.cars.find((candidate) => candidate.name === '2022 Subaru WRX')
        || editor.selectedCar
    );
    delete car.__systemPreset;delete car.__editorDraft;delete car.systemFile;
    car.id = 'playwright-wrx2';
    car.name = '2022 Subaru WRX2';
    car.camera = {
      ...(car.camera || {}),
      trackingMode: 'fixed-rear'
    };
    car.audio = {
      ...(car.audio || {}),
      engineSoundId: ''
    };
    car.art = {
      ...(car.art || {}),
      body: 'rtg-001',
      artRef: 'rtg-001',
      shell: 'rtg-001',
      tires: 'tire',
      turnFrames: {
        left: 'rtg-001',
        center: 'rtg-001',
        right: 'rtg-001'
      },
      shellFrames: {
        mode: '8-way',
        artRef: 'rtg-001',
        slots: Object.fromEntries([
          'front',
          'frontRight',
          'right',
          'rearRight',
          'rear',
          'rearLeft',
          'left',
          'frontLeft'
        ].map((slot) => [slot, { artRef: 'rtg-001', frameIndex: 0 }])),
        reverseFrameIndex: null
      },
      tireTreads: Object.fromEntries(
        ['tarmac', 'rain', 'dirt', 'offroad', 'drift', 'snow']
          .map((compound) => [compound, { artRef: 'tire', frameIndex: 0 }])
      ),
      layerVisibility: {
        body: true,
        tires: true,
        frontWheels: false,
        rearWheels: true,
        brakes: false,
        shadow: false
      }
    };

    const size = 24;
    const level = {
      schemaVersion: 1,
      tileSize: 32,
      width: size,
      height: size,
      spawn: { x: 16, y: 12 },
      tiles: Array.from({ length: size }, () => '.'.repeat(size)),
      regions: [],
      enemies: [],
      elevatorPaths: [],
      elevators: [],
      pixelArt: { tiles: {} },
      musicZones: [],
      midiTracks: [],
      triggers: [{
        id: 'studio-sprint-2-trigger',
        rect: [15, 11, 3, 3],
        condition: 'When player enters this location',
        fireOnce: false,
        actions: [{
          id: 'start-studio-sprint-2',
          type: 'start-race',
          params: {
            raceName: 'Studio Sprint2',
            carSelection: 'specific',
            carRef: '2022 Subaru WRX2'
          }
        }]
      }],
      decals: []
    };
    const previewRace = clone(race);
    previewRace.id = 'test-loop';
    previewRace.name = 'Studio Sprint';

    await Promise.all([
      postFile('art', 'grass', makeArt(64, 64, '#567d3b'), 1),
      postFile('art', 'rtg-001', makeArt(32, 18, '#2f5f9f'), 2),
      postFile('art', 'tire', makeArt(12, 24, '#20242a'), 3)
    ]);
    await Promise.all([
      postFile('races', 'Studio Sprint2', {
        schemaVersion: 1,
        kind: 'race-track',
        savedAt: now + 4,
        selectedRaceId: race.id,
        race
      }, 4),
      postFile('races', 'Studio Sprint', {
        schemaVersion: 1,
        kind: 'race-track',
        savedAt: now + 4,
        selectedRaceId: previewRace.id,
        race: previewRace
      }, 4),
      postFile('cars', '2022 Subaru WRX2', {
        schemaVersion: 2,
        kind: 'race-car',
        savedAt: now + 5,
        selectedCarId: car.id,
        car
      }, 5),
      postFile('levels', 'levelA', level, 6)
    ]);
  }, {straight});
}
