const wheels=['fl','fr','rl','rr'];
// Hot-swap only tire configuration. Keep chassis, drivetrain, damage and race state.
export function applyDebugTirePhysics(runner,update={}){
 if(!runner)return;
 runner.config={...runner.config};
 const radius=Number(update.wheelRadiusM);
 if(Number.isFinite(radius)&&radius>=.1&&radius<=1)runner.config.wheelRadiusM=radius;
 delete runner.config.wheelRadiusByWheelM;
 delete runner.config.wheelWidthByWheelM;
 runner.config.tireByWheel=structuredClone(update.tireByWheel||{});
 for(const id of wheels){
  const pressure=Number(update.tireByWheel?.[id]?.coldPressurePsi);
  if(!Number.isFinite(pressure))continue;
  const state=(runner.state.tireState ||= {})[id] ||= {};
  state.coldPressurePsi=pressure;state.effectivePressurePsi=pressure;
 }
}
