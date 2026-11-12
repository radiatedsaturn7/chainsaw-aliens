import fs from 'node:fs';
import {RACE_SURFACES} from '../../src/racing/raceData.js';
import {createTrackStateCell,getTrackStateCellSample} from '../../src/racing/trackState/TrackStateCell.js';
import {calculateBrushTireForce} from '../../src/racing/simulation/ContactPatchTireModel.js';
const rows=[];
for(const name of ['Stock','Street','Tarmac','Rain','Rally','Offroad','Drift','Snow']){
 const t=JSON.parse(fs.readFileSync(`data/server-storage/files/tires/${name}/document.json`));
 const row={tire:name};
 for(const surface of RACE_SURFACES){
  const cell=createTrackStateCell({base:{baseSurfaceId:surface.id,friction:surface.grip}}),sample=getTrackStateCellSample(cell);
  const material={...cell,surfaceId:sample.effectiveSurfaceId,surfaceGripScale:cell.baseGrip*sample.effectiveGripMultiplier,trackStateConditionApplied:true};
  const force=calculateBrushTireForce({normalLoadN:3500,kinematics:{slipRatio:.1,slipAngleRad:0,longitudinalVelocityMps:15},tire:{compound:t.compound,...t.size,referenceLoadN:3500,pressurePsi:32,targetPressurePsi:32,treadTemperatureC:21,wear:0,damage:0},material});
  row[surface.id]=force.gripCoefficient;
 }
 rows.push(row);
}
const report={conditions:'Reference-load peak friction coefficient; 245 mm, healthy tires, 32 psi, 21 C tread, initial authored surface conditions. Not a measured stopping distance or hydroplaning prediction.',sources:[{url:'https://www.tirerack.com/tires/tests/testDisplay.jsp?ttid=353',evidence:'Winter snow braking 56.1–63.1 ft from 25 mph; conventional all-season 81.1–84.5 ft. Approximate mean deceleration v²/(2gd): 0.33–0.37 g vs 0.25–0.26 g. Winter wet cornering 0.60–0.71 g.'},{url:'https://www.nhtsa.gov/sites/nhtsa.gov/files/absperformancefinalreport.pdf',evidence:'Peak adhesion varies with speed, load, tire and surface; peak and sliding friction differ. These game values are calibrated approximations, not universal measured coefficients.'}],changes:['Stock treated as ordinary road all-season: snow suitability .28 to .70; slush .35 to .60.','Snow pavement suitability .58 to .82 dry; .62 to .85 wet.','AI ground friction no longer divided by the nominal surface coefficient.'],rows};
fs.writeFileSync('artifacts/tire-surface-audit.json',JSON.stringify(report,null,2)+'\n');console.table(rows);
