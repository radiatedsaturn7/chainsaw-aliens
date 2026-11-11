import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {applyTireDefinition} from '../../src/racing/raceTires.js';
import {calculateBrushTireForce} from '../../src/racing/simulation/ContactPatchTireModel.js';

function sample(tireName,surface,bumpiness=0){
 const editor=new RaceEditor({exitRaceEditor(){}});
 editor.selectedRace.road.network=null;
 editor.selectedRace.road.segments=[{length:800,curve:0,elevation:0,surface,banking:0,bumpiness,hazardIds:[]}];
 editor.selectedRace.weather='clear';editor.selectedRace.hazards=[];
 const saved=JSON.parse(fs.readFileSync(new URL(`../../data/server-storage/files/tires/${tireName}/document.json`,import.meta.url)));
 applyTireDefinition(editor.selectedCar,saved,tireName);
 editor.startPlaytest(editor.selectedCar.id,{hydrateCars:false});
 const session=editor.playtestSession;Object.assign(session,{countdownRemainingMs:0,startupFramePending:false,launchLockMs:0});
 editor.updatePlaytest(0);
 const runner=session.vehicleDynamicsRunner;
 editor.updatePlaytest(1/60);
 const result=runner.environmentProvider({state:runner.state,previousState:runner.state,timeSeconds:runner.simulationTimeSeconds,stepIndex:runner.stepIndex+1,substepIndex:0,tireSubstepDt:1/120,chassisStepDt:1/60,controls:runner.inputTimeline.sampleAt(runner.simulationTimeSeconds)});
 const env=structuredClone({material:result.materialByWheel.fl,tire:result.tireByWheel.fl});
 assert.ok(env?.tire?.compound,'saved tire reaches production contact environment');
 assert.equal(env.material.baseSurfaceId,surface);
 const force=calculateBrushTireForce({normalLoadN:3500,kinematics:{slipRatio:.3,slipAngleRad:.08,longitudinalVelocityMps:15},
  tire:{...env.tire,referenceLoadN:3500,pressurePsi:32,effectivePressurePsi:32,targetPressurePsi:32,treadTemperatureC:75,wear:0,damage:0},material:env.material});
 editor.disposeRacePlaytestSession?.(session,'test-complete');
 return {...env,mu:force.gripCoefficient};
}

test('saved matched tires retain different absolute surface grip in the production environment',()=>{
 const asphalt=sample('Tarmac','asphalt'),dirt=sample('Rally','dirt'),snow=sample('Snow','snow');
 assert.ok(dirt.mu<asphalt.mu*.8,`dirt ${dirt.mu}, asphalt ${asphalt.mu}`);
 assert.ok(snow.mu<dirt.mu*.65,`snow ${snow.mu}, dirt ${dirt.mu}`);
 assert.ok(dirt.mu>.5 && snow.mu>.15,'correct tires retain usable loose-surface traction');
});

test('saved rally tires are usable on asphalt but rain tires lead on wet asphalt',()=>{
 const rallyDry=sample('Rally','asphalt'),rallyWet=sample('Rally','wet-asphalt'),rainWet=sample('Rain','wet-asphalt');
 assert.ok(rallyDry.mu>.65);
 assert.ok(rallyWet.mu<rallyDry.mu);
 assert.ok(rainWet.mu>rallyWet.mu*1.2);
 assert.ok(rallyWet.mu>.35);
});

test('authored roughness reaches production tire contact material',()=>{
 assert.equal(sample('Stock','asphalt',.36).material.roughness,.36);
 assert.equal(sample('Stock','asphalt',0).material.roughness,0);
});
