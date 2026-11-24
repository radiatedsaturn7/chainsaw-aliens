import {interpolateVehicleRenderSnapshots} from './simulation/VehicleDynamicsWorkerProtocol.js';

// Body and wheel world poses must share a timestamp. Advancing only the body
// leaves native-model wheel hubs behind until the next fixed physics tick.
export function raceAiRenderState(session) {
  const canonical=session?.vehicleRenderState,runner=session?.vehicleDynamicsRunner;
  if(!canonical?.wheels || session.physicsBudgetDetail!=='full' || !runner?.state
    || runner.dormant || runner.pendingCollisionImpulses?.length || session.workerVehicleId)return canonical;
  const hz=Number(runner.config?.chassisHz);
  if(!(hz>0))return canonical;
  const lead=Math.max(0,Math.min(1/hz,Number(runner.observedTimeSeconds)-Number(runner.stepIndex)/hz));
  if(!(lead>0)||!Number.isFinite(canonical.simulationTimeSeconds))return canonical;
  return interpolateVehicleRenderSnapshots(canonical,canonical,canonical.simulationTimeSeconds+lead);
}
