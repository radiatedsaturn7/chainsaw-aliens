// Shared shop order and editor defaults; authored custom sections remain supported.
export const GARAGE_CATEGORIES = [
 'Presets', 'Breathing', 'Drivetrain', 'Handling',
 'Engine', 'Tires', 'Aero', 'Chassis',
];
export const GARAGE_SLOT_CATEGORIES = {
 'engine-swap':'Engine', 'drive-swap':'Drivetrain', cooling:'Engine', turbo:'Engine', ecu:'Engine', ignition:'Engine', camshaft:'Engine', 'fuel-system':'Engine',
 intake:'Breathing', exhaust:'Breathing',
 'wheel-diameter':'Tires','tire-profile':'Tires','wheel-offset':'Tires',driveline:'Drivetrain', wheels:'Tires', flywheel:'Drivetrain', clutch:'Drivetrain', transmission:'Drivetrain', differential:'Drivetrain',
 suspension:'Handling', alignment:'Handling', brakes:'Handling', tires:'Tires',
 aero:'Aero', 'skid-plates':'Chassis', rigidity:'Chassis', ballast:'Chassis', weight:'Chassis',
};

export function garagePartCategory(part){
 const section=part.section||GARAGE_SLOT_CATEGORIES[part.slot]||'Engine';
 return ['Suspension','Brakes'].includes(section)?'Handling':section;
}
