import test from 'node:test';
import assert from 'node:assert/strict';
import {selectMatchedRaceGrid,matchRaceCarPI} from '../../src/racing/RaceMatchedGrid.js';
import {calculateCarPerformance} from '../../src/racing/CarPerformance.js';
const car=(id,power=200)=>({id,name:id,__playtestDocumentName:id,tuning:{powerHp:power,torqueLbFt:power,
 weightKg:1300,drivetrain:'rwd',redlineRpm:6500,revLimitRpm:6700,idleRpm:850,
 engineCurve:{torquePoints:[{rpm:850,torqueLbFt:100},{rpm:5252,torqueLbFt:power},{rpm:6700,torqueLbFt:power*.65}]}}});
const tune=c=>c.tuning;
test('matched grid uses three distinct saved models and independently calculated PI',()=>{
 const player=car('player'),cars=[player,car('one',202),car('two',206),car('three',210)];
 const before=structuredClone(cars),grid=selectMatchedRaceGrid(cars,player,5,tune);
 assert.equal(grid.length,5);assert.equal(new Set(grid.map(c=>c.id)).size,3);
 for(const entry of grid){assert.equal(entry.points,entry.target);assert.equal(calculateCarPerformance(entry.car).points,entry.target);}
 assert.deepEqual(cars,before);
});
test('matching preserves drivetrain and chassis; ECU changes the real torque curve',()=>{
 const source=car('rival',240),target=calculateCarPerformance(car('player')).points;
 const matched=matchRaceCarPI(source,target,tune);
 assert.equal(matched.points,target);assert.notEqual(matched.car.tuning.engineCurve.torquePoints[1].torqueLbFt,240);
 assert.equal(matched.car.tuning.weightKg,source.tuning.weightKg);assert.equal(matched.car.tuning.drivetrain,'rwd');
 assert.ok(matched.scale>=.75&&matched.scale<=1.25);
});
test('unreachable PI remains honest and bounded',()=>{
 const source=car('rival',100),matched=matchRaceCarPI(source,1000,tune);
 assert.notEqual(matched.points,1000);assert.equal(matched.points,calculateCarPerformance(matched.car).points);
 assert.ok(matched.scale<=1.25);
});
