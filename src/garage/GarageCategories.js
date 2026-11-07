// Shared shop order and editor defaults; authored custom sections remain supported.
export const GARAGE_CATEGORIES = [
 'Engine', 'Breathing', 'Drivetrain', 'Suspension',
 'Brakes', 'Tires', 'Aero', 'Chassis',
];
export const GARAGE_SLOT_CATEGORIES = {
 'engine-swap':'Engine', 'drive-swap':'Drivetrain', cooling:'Engine', turbo:'Engine', ecu:'Engine', ignition:'Engine', camshaft:'Engine', 'fuel-system':'Engine',
 intake:'Breathing', exhaust:'Breathing',
 driveline:'Drivetrain', wheels:'Tires', flywheel:'Drivetrain', clutch:'Drivetrain', transmission:'Drivetrain', differential:'Drivetrain',
 suspension:'Suspension', alignment:'Suspension', brakes:'Brakes', tires:'Tires',
 aero:'Aero', rigidity:'Chassis', ballast:'Chassis', weight:'Chassis',
};
