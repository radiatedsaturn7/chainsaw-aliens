import test from 'node:test';
import assert from 'node:assert/strict';
import {carPerformanceClass,CAR_PERFORMANCE_LIMITS,calculateCarPerformance,selectEligibleRaceAiCars,normalizeAiCarSelection} from '../../src/racing/CarPerformance.js';
const car=(name,extra={})=>({id:'shared-stock-id',__playtestId:`saved:${name}`,__playtestDocumentName:name,category:'car',tuning:{powerHp:270,weightKg:1500,topSpeedMph:145,tireGrip:1},...extra});
test('performance is finite, deterministic, responds to upgrades and balances E1 through S',()=>{
 const stock=car('WRX4'),before=structuredClone(stock),rating=calculateCarPerformance(stock);
 assert.deepEqual(calculateCarPerformance(stock),rating);assert.deepEqual(stock,before);
 for(const change of [{powerHp:500},{weightKg:900},{dragCoefficient:.2},{tireGrip:1.4},{brakePressure:1.4}])assert.ok(calculateCarPerformance({...stock,tuning:{...stock.tuning,...change}}).points>rating.points);
 assert.equal(calculateCarPerformance({tuning:{powerHp:40,weightKg:3000,topSpeedMph:70,tireGrip:0.5}}).class,'E1');
 assert.equal(calculateCarPerformance({tuning:{powerHp:1000,weightKg:1000,topSpeedMph:230,tireGrip:1.8}}).class,'S');
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
 assert.equal(calculateCarPerformance({tuning:{zeroToSixtySec:6}}).accelerationEstimated,true);
 assert.deepEqual(normalizeAiCarSelection(null),normalizeAiCarSelection());
});

test('PI class ceilings are inclusive from E1 100 through S 1000',()=>{
 assert.deepEqual(CAR_PERFORMANCE_LIMITS.map(c=>[c.label,c.limit]),[['E1',100],['E2',200],['E3',300],['E4',400],['F',500],['D',600],['C',700],['B',800],['A',900],['S',1000]]);
 assert.equal(carPerformanceClass(0),'E1');
 for(const [i,c] of CAR_PERFORMANCE_LIMITS.entries()){
  assert.equal(carPerformanceClass(c.limit),c.label);
  if(i<9)assert.equal(carPerformanceClass(c.limit+1),CAR_PERFORMANCE_LIMITS[i+1].label);
 }
});

test('dry-tarmac PI ignores stale performance claims and responds to gearing, driven wheels and tire compounds',()=>{
 const base=car('test',{tuning:{powerHp:700,weightKg:1300,drivetrain:'awd',gearRatios:[3,2.12,1.62,1.28,1,.78],gearFinalDrive:3.15,redlineRpm:7200,shiftTimeMs:100}});
 const score=calculateCarPerformance(base);
 assert.deepEqual(calculateCarPerformance({...base,tuning:{...base.tuning,zeroToSixtySec:99,topSpeedMph:1}}),score);
 const fwd=calculateCarPerformance({...base,tuning:{...base.tuning,drivetrain:'fwd'}}),rwd=calculateCarPerformance({...base,tuning:{...base.tuning,drivetrain:'rwd'}});
 assert.ok(score.zeroToSixtySec<rwd.zeroToSixtySec);assert.ok(rwd.zeroToSixtySec<fwd.zeroToSixtySec);assert.ok(score.points>fwd.points);
 const short=calculateCarPerformance({...base,tuning:{...base.tuning,gearFinalDrive:8}});assert.ok(short.topSpeedMph<score.topSpeedMph);
 const road=calculateCarPerformance({...base,setup:{defaultTireCompound:'tarmac'}}),rally=calculateCarPerformance({...base,setup:{defaultTireCompound:'dirt'}});
 assert.ok(road.components.grip>rally.components.grip);assert.ok(road.points>rally.points);
 assert.ok(Number.isFinite(calculateCarPerformance({tuning:{gearRatios:[]}}).points));
});
