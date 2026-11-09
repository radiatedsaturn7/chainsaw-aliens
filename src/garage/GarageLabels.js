import {stockDrivetrain} from './GarageConversions.js';
// Contextual names only; authored names and stable IDs remain intact.
export function upgradeLabel(name, slot) {
 const aliases={'Adjustable Geometry Links':'Sport','Adjustable Gearbox':'Sport','Standalone Race ECU':'Race','High-Flow Air Filter':'Filter','Sport Rear Muffler':'Muffler','Race Header and Exhaust':'Headers','Iridium Spark Plugs':'Plugs','Performance Coil Pack':'Coils','Race Ignition System':'Race','Street Camshaft':'Street','High-Lift Race Camshaft':'Race','High-Flow Fuel Pump':'Pump','Matched Injector Kit':'Injectors','Programmable Fuel System':'Race','Street Final Drive':'Street','Race Close-Ratio Gearbox':'Race','Adjustable Camber Plates':'Sport','Adjustable Splitter and Wing':'Sport','Street Limited-Slip Differential':'Street','Adjustable Limited-Slip Differential':'Sport','Off-road Gearbox':'Offroad','Turbo Conversion':'Turbo','Welded Cage':'Cage 2','Cage':'Cage 1','Race Weight and Ballast':'Race','Street Weight Reduction':'Street','Lightweight Panels':'Sport','Race Coilovers':'Race','Race Tarmac Tires':'Tarmac'};
 if(aliases[name])return aliases[name];
 const nouns={ecu:'ecu',brakes:'brakes?',tires:'tires?',suspension:'suspension',transmission:'transmission',differential:'differential',alignment:'alignment',aero:'aero',flywheel:'flywheel',clutch:'clutch',turbo:'turbo',intake:'intake',exhaust:'exhaust',driveline:'driveline',cooling:'cooling',ballast:'ballast',weight:'weight',wheels:'wheels?', 'drive-swap':'conversion', 'skid-plates':'skid plates?'};
 const noun=nouns[slot];
 const short=noun?name.replace(new RegExp('\\b(?:'+noun+')\\b','ig'),'').replace(/\s+/g,' ').trim():name;
 return short||name;
}
export function tuningLabel(field) {
 const short={ballastKg:'Weight (kg)',ballastPosition:'Placement',torqueScale:'Power Map',pedalResponse:'Pedal',boostLevel:'Boost',gearFinalDrive:'Final',centerDifferentialBalance:'Split',centerDifferentialLock:'Lock'};
 if(short[field.id])return short[field.id];
 if(field.id.startsWith('pressure.'))return field.id.endsWith('l')?'Left':'Right';
 if(/^brake/.test(field.id))return field.label.replace(/^Brake /,'').replace(/^./,s=>s.toUpperCase());
 if(/differential/i.test(field.id))return field.label.replace(/differential /i,'').replace(/^./,s=>s.toUpperCase());
 if(/^suspensionTravel/.test(field.id))return field.label.replace('suspension ','');
 if(/^gearRatios\./.test(field.id))return field.label.replace(' ratio','');
 return field.label;
}
export function isOriginalDrivetrain(part, stock) {
 return !!stock && !!part?.drivetrainSwap && part.drivetrainSwap===stockDrivetrain(stock);
}

export function upgradeSlotLabel(slot) {
 return {'wheels':'Width','wheel-diameter':'Diameter','tire-profile':'Sidewall','wheel-offset':'Outset','engine-swap':'Swaps','drive-swap':'Conversions','skid-plates':'Skid plates',ecu:'ECU',weight:'Weight','fuel-system':'Fuel',ignition:'Ignition',camshaft:'Cams'}[slot] || slot.charAt(0).toUpperCase()+slot.slice(1);
}
export function upgradeHeading(state={}) {
 const slot=state.slot==='auto'?'Auto Upgrade':state.slot?upgradeSlotLabel(state.slot):'';
 return [state.section,slot&&slot.toLowerCase()!==state.section?.toLowerCase()?slot:''].filter(Boolean).join(' / ');
}
