import {turnSignalLit} from './TurnSignals.js';
import {MECHANICAL_COMPONENTS} from './simulation/MechanicalModel.js';

// Warning states are derived, never persisted independently of the actual faults.
// 0 = off, 1 = warning, 2 = critical (flashing).
export const MECHANICAL_LAMPS={enginelight:'Engine light',oillight:'Oil pressure light',coolantlight:'Coolant light',batterylight:'Battery / charging light',brakelight:'Brake fault light',tirelight:'Tire pressure / condition light',transmissionlight:'Transmission light'};
export const COMPONENT_GAUGE_SOURCES=MECHANICAL_COMPONENTS.flatMap(({id})=>['damage','failed'].map(key=>`mechanical.components.${id}.${key}`));
export function mechanicalLamp(source,s){
 if(!s||s.config?.enabled===false)return 0;
 const tick=Number(s.tick)||0;
 const faults=ids=>ids.reduce((level,id)=>{const c=s.components?.[id];return Math.max(level,!c?0:c.failed?2:c.malfunctionUntil>tick?1:0);},0);
 const oil=Math.max(faults(['oilPump','oilSeals']),s.engineRunning&&s.oilPressureBar<.7?2:s.oil<.25?1:0);
 const coolant=Math.max(faults(['radiator','thermostat','waterPump','fans']),s.coolantTemperatureC>=120||s.coolant<.1?2:s.coolantTemperatureC>110||s.coolant<.25?1:0);
 switch(source){
 case 'enginelight':return Math.max(faults(['ignition','pistons','bearings','ecu','fuelPump','turbo']),oil,coolant,s.engineRunning===false||s.misfireUntil>tick?2:0);
 case 'oillight':return oil;
 case 'coolantlight':return coolant;
 case 'batterylight':return Math.max(faults(['alternator','battery','wiring']),s.voltage<=9.7?2:s.voltage<12?1:0);
 case 'transmissionlight':return Math.max(faults(['clutch','gearbox','differential','axles']),s.lostGears?.length?2:0);
 case 'brakelight':return Math.max(faults(['fl','fr','rl','rr'].flatMap(w=>['pads_'+w,'hydraulics_'+w])),...Object.values(s.tires||{}).map(t=>t.brakeTemperatureC>=650?2:t.brakeTemperatureC>500?1:0));
 case 'tirelight':return Math.max(faults(['fl','fr','rl','rr'].map(w=>'tire_'+w)),...Object.values(s.tires||{}).map(t=>t.pressureRatio<.3?2:t.pressureRatio<.6||t.tread<.2?1:0));
 default:return 0;
 }
}
export function mechanicalLampVisible(value,mechanical){return value===1||value===2&&Math.floor((Number(mechanical?.tick)||0)/3)%2===0;}

// Driver-selected assist settings are distinct from mechanical failures.
export const CONTROL_LAMPS={absofflight:'ABS Off',tractioncontrolofflight:'Traction Control Off',handbrakelight:'Handbrake / E-brake',lowfuellight:'Low fuel',headlightslight:'Headlights on',highbeamslight:'High beams',auxlightslight:'AUX lights',leftsignallight:'Left turn signal',rightsignallight:'Right turn signal'};
export function controlLamp(source,session={}){
 switch(source){
 case 'leftsignallight':return Number(turnSignalLit(session,'left'));
 case 'rightsignallight':return Number(turnSignalLit(session,'right'));
 case 'lowfuellight':return Number(Number.isFinite(session.mechanical?.fuel)&&session.mechanical.fuel<=.15);
 case 'highbeamslight':return Number(session.mechanical?.headlights===true&&session.mechanical?.highBeams===true);
 case 'auxlightslight':return Number(session.mechanical?.auxLights===true);
 case 'headlightslight':return Number(session.mechanical?.headlights===true);
 case 'absofflight':return Number(session.absEnabled===false);
 case 'tractioncontrolofflight':return Number(session.tractionControlEnabled===false);
 // Includes the authoritative timed handbrake pulse, not merely the input button.
 case 'handbrakelight':return Number(session.authoritativeHandbrakeActive??session.handbrakeCommandState?.active??false);
 default:return 0;
 }
}
