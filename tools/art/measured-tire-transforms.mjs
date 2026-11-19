import assert from 'node:assert/strict';
// Offline graphics overrides; additional principal views require explicit opt-in.
export function applyMeasuredTireTransforms(car,cfg) {
 for(const [slot,transforms] of Object.entries(cfg.nativeTireTransformOverrides||{})) {
  assert.ok(['frontRight','rearRight','rearLeft','frontLeft',...(cfg.allowSideTireOverrides===true?['right','left']:[]),...(cfg.allowCardinalTireOverrides===true?['front','rear']:[])].includes(slot),'Principal tire overrides require explicit opt-in');
  for(const [key,value]of Object.entries(transforms)){assert.ok(['tireScaleX','tireScaleY','tireSpacingScale','frontTireOffsetX','frontTireOffsetY','rearTireOffsetX','rearTireOffsetY'].includes(key));assert.ok(Number.isFinite(value)&&Math.abs(value)<=16);if(key.includes('Scale'))assert.ok(value>=.05&&value<=12);}
  Object.assign(car.art.angleLayers[slot].tires.transforms,transforms);
 }
 for(const [slot,insets] of Object.entries(cfg.nativeWheelFaceInsets||{})) {
  assert.ok(['frontRight','rearRight','rearLeft','frontLeft'].includes(slot),'Measured face inset requires an oblique view');
  assert.ok(insets && typeof insets==='object' && !Array.isArray(insets));
  for(const [wheel,value] of Object.entries(insets)) {
   assert.ok(['fl','fr','rl','rr'].includes(wheel));
   assert.ok(typeof value==='number' && Number.isFinite(value) && value>0 && value<=.5);
  }
  car.art.angleLayers[slot].tires.faceInsetByWheel={...insets};
 }

}
