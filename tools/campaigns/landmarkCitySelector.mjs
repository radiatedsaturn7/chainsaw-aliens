// Resolve an exact route first; bare city names must identify a single route.
export function selectLandmarkCity(cities, selector) {
 if(!selector)throw Error('Specify exact raceRef or unambiguous city name, e.g. Providence');
 const exact=cities.filter(c=>c.raceRef===selector);
 const matches=exact.length?exact:cities.filter(c=>c.city===selector);
 if(matches.length===1)return matches[0];
 if(matches.length>1)throw Error(`Ambiguous city "${selector}"; specify exact raceRef: ${matches.map(c=>c.raceRef).join(' | ')}`);
 throw Error(`Unknown city or raceRef: ${selector}`);
}
