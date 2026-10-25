import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
globalThis.window ||= {location:{search:''}};
const {default:Game}=await import('../../src/game/GameCore.js');

function fixture() {
  let resolve, reject, calls=0;
  const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const e=Object.create(RaceEditor.prototype);
  Object.assign(e,{
    mode:'race',project:{races:[{name:'P1',finishBehavior:{type:'menu',menuScreen:'world-map'}}]},
    playtestSession:{running:true,raceResults:true,carId:'car',raceId:'p1'},
    raceInput:{paused:true,cameraView:'third-person'},
    getRaceSessionCar:()=>({audio:{}}),completeRaceGhost:()=>{},getRaceStartSettings:()=>({}),
    resetRacePlaytestInputs(){this.raceInput={paused:false};},
    game:{completeRaceTravel:()=>{calls++;return pending;},showSystemToast:message=>{e.message=message;}}
  });
  return {e,resolve,reject,get calls(){return calls;}};
}

for(const mode of ['landscape','portrait','desktop'])test(`finish keeps the race camera while menu loads in ${mode}`,async()=>{
  const f=fixture(),e=f.e,session=e.playtestSession;
  const done=e.finishPlaytest();
  assert.equal(e.playtestSession,session);assert.equal(session.finishing,true);
  assert.equal(e.raceInput.cameraView,'third-person');assert.equal(e.raceInput.paused,true);
  // A second press must neither exit nor restart nor submit another completion.
  e.finishPlaytest();e.endPlaytest();e.restartRacePlaytest();e.update({},.016);e.handlePointerDown({});
  await Promise.resolve();assert.equal(f.calls,1);
  let rendered='';
  Object.assign(e,{syncRacePhysicalGamepad(){},enforceRaceDoodadBrushSize(){},
    resolveRaceViewportMode:()=>({mode,isDesktop:mode==='desktop',isMobilePortrait:mode==='portrait'}),
    drawMobileRacePlaytest(){rendered='race';},drawDesktop(){rendered=this.isLivePlaytestSession()?'race':'editor';},
    finishRaceLoadingFrame(){},drawRaceNonPortraitSpritePopup(){},drawRaceSpriteSettingsDialog(){},drawRaceSettingsDialog(){},
    drawLandscape(){rendered='editor';},drawPortrait(){rendered='editor';}
  });
  e.draw({},mode==='portrait'?390:844,mode==='portrait'?844:390);
  assert.equal(rendered,'race');
  f.resolve(true);await done;assert.equal(e.playtestSession,null);
});

test('failed menu transition leaves results visible and permits retry',async()=>{
  const f=fixture(),e=f.e,session=e.playtestSession,done=e.finishPlaytest();
  f.reject(Error('Storage unavailable'));await done;
  assert.equal(e.playtestSession,session);assert.equal(session.finishing,false);
  assert.equal(session.raceResults,true);assert.equal(e.raceInput.paused,true);
  assert.match(e.message,/Storage unavailable/);
  e.game.completeRaceTravel=async()=>true;
  await e.finishPlaytest();assert.equal(e.playtestSession,null);
});

test('old completion cannot clear a replacement session',async()=>{
  const f=fixture(),done=f.e.finishPlaytest(),replacement={running:true};
  f.e.playtestSession=replacement;f.resolve(true);await done;
  assert.equal(f.e.playtestSession,replacement);
});

test('menu race completion returns the actual asynchronous destination promise',async()=>{
  const game=Object.create(Game.prototype),session={};
  const pending=Promise.resolve(true);
  game.ensureRaceTravelSession=()=>session;game.openMenuDestination=()=>pending;
  assert.equal(game.completeRaceTravel({type:'menu',menuScreen:'world-map'}),pending);
});
