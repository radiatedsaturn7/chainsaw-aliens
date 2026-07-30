import { AeroModel } from './AeroModel.js';
import { BrakeModel } from './BrakeModel.js';
import { ChassisIntegrator } from './ChassisIntegrator.js';
import { DamageModel } from './DamageModel.js';
import { HandlingAssist } from './HandlingAssist.js';
import { PowertrainModel } from './PowertrainModel.js';
import { SurfaceModel } from './SurfaceModel.js';
import { SuspensionModel } from './SuspensionModel.js';
import { TireModel } from './TireModel.js';

export function createRaceSimulationSystems({ steeringConfig = {} } = {}) {
  const systems = {
    chassis: new ChassisIntegrator(),
    tires: new TireModel(),
    suspension: new SuspensionModel(),
    powertrain: new PowertrainModel(),
    brakes: new BrakeModel(),
    aero: new AeroModel(),
    surface: new SurfaceModel(),
    damage: new DamageModel(),
    handlingAssist: new HandlingAssist(steeringConfig)
  };
  return Object.freeze(systems);
}

export {
  AeroModel,
  BrakeModel,
  ChassisIntegrator,
  DamageModel,
  HandlingAssist,
  PowertrainModel,
  SurfaceModel,
  SuspensionModel,
  TireModel
};
