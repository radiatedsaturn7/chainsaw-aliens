// The existing test server indexes raw directory names, including URI escapes.
// Accept only the exact manifest folder alias; never infer a different race.
export function resolveDiagnosticRaceChoice(choices,race,documentPath){
 const exact=choices.find(c=>c.value===race);if(exact)return {value:exact.value,mode:'exact-logical-name'};
 const parts=documentPath.split('/');if(parts.length!==3||parts[0]!=='races'||parts[2]!=='document.json')throw Error('Invalid manifest race path');
 const folder=parts[1];let decoded;try{decoded=decodeURIComponent(folder);}catch{throw Error('Invalid encoded race folder');}
 if(decoded!==race)throw Error('Manifest folder does not identify requested race');
 const alias=choices.find(c=>c.value===folder);if(!alias)throw Error('Race absent from runtime selector');
 return {value:alias.value,mode:'exact-manifest-encoded-folder',limitation:'Existing test-server index exposes encoded folder spelling. This proves selector identity, not human-name transport or gameplay.'};
}

// A typo must fail collection, not silently reduce the requested QA coverage.
export function assertRequestedRaceCoverage(selected, requested) {
 if(!requested)return;
 if(new Set(requested).size!==requested.length)throw Error('Duplicate requested race');
 for(const name of requested)if(!selected.some(r=>r.raceRef===name))throw Error('Requested race missing from QA selection: '+name);
}
