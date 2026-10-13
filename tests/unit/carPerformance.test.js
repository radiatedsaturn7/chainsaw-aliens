import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCarPerformance,selectEligibleRaceAiCars,normalizeAiCarSelection} from '../../src/racing/CarPerformance.js';
const car=(name,extra={})=>({id:'shared-stock-id',__playtestId:`saved:${name}`,__playtestDocumentName:name,category:'car',tuning:{powerHp:270,weightKg:1500,topSpeedMph:145,tireGrip:1},...extra});
test('performance is finite, deterministic, responds to upgrades and balances E through A',()=>{
 const stock=car('WRX4'),before=structuredClone(stock),rating=calculateCarPerformance(stock);
 assert.deepEqual(calculateCarPerformance(stock),rating);assert.deepEqual(stock,before);
 for(const change of [{powerHp:500},{weightKg:900},{topSpeedMph:210},{tireGrip:1.4},{brakePressure:1.4}])assert.ok(calculateCarPerformance({...stock,tuning:{...stock.tuning,...change}}).points>rating.points);
 assert.equal(calculateCarPerformance({tuning:{powerHp:40,weightKg:3000,topSpeedMph:70,tireGrip:0.5}}).class,'E');
 assert.equal(calculateCarPerformance({tuning:{powerHp:1000,weightKg:1000,topSpeedMph:230,tireGrip:1.8}}).class,'A');
 assert.ok(Number.isFinite(calculateCarPerformance({tuning:{powerHp:NaN,weightKg:0}}).points));
});
test('saved variants remain unique, exclude player, then fill only with the selected default',()=>{
 const cars=[car('WRX4'),car('Buse'),car('pz-24'),{id:'stock'}];const original=structuredClone(cars);
 const result=selectEligibleRaceAiCars(cars,6,{playerCarId:'saved:WRX4',selection:{defaultCarId:'stock'},random:()=>0});
 assert.deepEqual(new Set(result.slice(0,2)),new Set(['saved:Buse','saved:pz-24']));assert.deepEqual(result.slice(2),Array(4).fill('stock'));
 assert.deepEqual(cars,original);
});
test('eligibility, category and performance filters apply together; fallback cannot select player',()=>{
 const cars=[car('Player'),car('Car'),car('Truck',{category:'truck'}),{id:'stock'}];
 const result=selectEligibleRaceAiCars(cars,3,{playerCarId:'saved:Player',selection:{availableCarIds:['saved:Car','saved:Truck'],category:'truck',performanceClass:calculateCarPerformance(cars[2]).class,defaultCarId:'stock'}});
 assert.deepEqual(result,['saved:Truck','stock','stock']);
 assert.deepEqual(selectEligibleRaceAiCars(cars,2,{playerCarId:'saved:Player',selection:{availableCarIds:[],defaultCarId:'saved:Player'}}),['stock','stock']);
 assert.deepEqual(selectEligibleRaceAiCars([cars[0]],2,{playerCarId:'saved:Player'}),[]);
 assert.deepEqual(normalizeAiCarSelection(JSON.parse(JSON.stringify({availableCarIds:[],category:'suv',performanceClass:'B',defaultCarId:'saved:Car'}))),{availableCarIds:[],category:'suv',performanceClass:'B',defaultCarId:'saved:Car'});
});

test('missing acceleration and legacy null selection use valid defaults',()=>{
 for(const value of [undefined,null,NaN])assert.equal(calculateCarPerformance({tuning:{zeroToSixtySec:value}}).accelerationEstimated,true);
 assert.equal(calculateCarPerformance({tuning:{zeroToSixtySec:6}}).accelerationEstimated,false);
 assert.deepEqual(normalizeAiCarSelection(null),normalizeAiCarSelection());
});
