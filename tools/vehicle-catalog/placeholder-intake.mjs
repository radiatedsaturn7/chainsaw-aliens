// Unit conversion and intake validation only; no runtime or file mutations.
export function normalizePlaceholderRecord(r){
 if(!r.id||!r.name||!r.candidateId||!r.identity||!r.referenceVehicle)throw Error('Incomplete identity');
 if(!r.sources?.length||r.sources.some(s=>!/^https:\/\//.test(s.url)||!s.publisher))throw Error('Missing attributable sources');
 if(!r.limits?.length)throw Error('Explicit modeling limits required');
 const s=r.simulationEstimates||{},f={...s,...r.facts};
 if(r.facts.powerKw!=null)f.powerHp=r.facts.powerKw/.7456998715822702;
 if(r.facts.torqueNm!=null)f.torqueLbFt=r.facts.torqueNm/1.3558179483314;
 // Published dry weight is never a fallback for runtime curb mass.
 if(f.curbKg!=null)f.curbLb=f.curbKg/.45359237;
 for(const field of ['length','width','height','wheelbase'])if(f[field+'M']!=null)f[field+'In']=f[field+'M']/.0254;
 for(const k of ['powerHp','torqueLbFt','curbLb','lengthIn','widthIn','heightIn','wheelbaseIn','engineDisplacementL','powerRpm','torqueRpm','redlineRpm','revLimitRpm','finalDrive','trackFrontIn','trackRearIn'])if(!Number.isFinite(f[k])||f[k]<=0)throw Error('Missing positive input: '+k);
 if(!['manual','automatic'].includes(f.transmission)||!['fwd','rwd','awd'].includes(f.drivetrain))throw Error('Unsupported ICE drivetrain/transmission');
 if(!Array.isArray(f.gearRatios)||f.gearRatios.length!==f.gearCount||f.gearRatios.some((g,i,a)=>!Number.isFinite(g)||g<=0||i>0&&g>=a[i-1]))throw Error('Ratios must match count and descend');
 if(!Array.isArray(f.tireSize)||f.tireSize.length!==3||f.tireSize.some(x=>!Number.isFinite(x)||x<=0))throw Error('Tire size required');
 if(!(f.frontWeightDistribution>0&&f.frontWeightDistribution<1)||f.revLimitRpm<f.redlineRpm)throw Error('Invalid load/RPM limits');
 return f;
}
export function validatePlaceholderBatch(records,backlog,existing=[]){const ids=new Set,names=new Set,candidates=new Set;for(const r of records){normalizePlaceholderRecord(r);if(ids.has(r.id)||names.has(r.name)||candidates.has(r.candidateId))throw Error('Duplicate identity in batch');ids.add(r.id);names.add(r.name);candidates.add(r.candidateId);if(!backlog.some(c=>c.id===r.candidateId))throw Error('Candidate must occupy an existing slot');if(existing.some(c=>c.id===r.id||c.name===r.name||c.candidateId===r.candidateId))throw Error('Refusing existing entry overwrite/duplicate');}return records.map(normalizePlaceholderRecord);}
