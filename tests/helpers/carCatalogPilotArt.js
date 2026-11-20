import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const pilot=JSON.parse(fs.readFileSync(new URL('../../data/vehicle-catalog/phases/three-car-fitting-pilot.json',import.meta.url)));
export function assertPilotOrSharedArt(car,starter,refs){
 const row=pilot.vehicles.find(r=>r.id===car.id);
 if(!row){assert.deepEqual(refs(car.art),refs(starter.art));return;}
 assert.equal(car.name,row.name);
 assert.equal(createHash('sha256').update(JSON.stringify(car.art)).digest('hex'),row.artSha256);
 for(const role of ['body','dashboard','tires'])assert.ok(refs(car.art).includes(`catalog-${car.id}-${role}`));
 assert.equal(car.catalogProvenance.phaseStatus.originalArtFinished,false);
 assert.equal(car.catalogProvenance.phaseStatus.independentDriveVerified,false);
}
