// Saved on each race; geographic classification is performed by the import tools.
export const US_STATES=Object.fromEntries(`AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming|DC:District of Columbia`.split('|').map(s=>s.split(':')));
export function normalizeRaceLocation(race){
 const source=race?.source||{},origin=source.origin||{},saved=race?.location||{};
 const country=String(saved.country??origin.country??'').trim().toUpperCase();
 const raw=String(saved.stateCode??source.stateCode??source.state??'').trim();
 const stateCode=US_STATES[raw.toUpperCase()]?raw.toUpperCase():Object.keys(US_STATES).find(k=>US_STATES[k].toLowerCase()===raw.toLowerCase())||'';
 const body=['Moon','Mars'].includes(saved.body??origin.body)?(saved.body??origin.body):null;
 const location={...(body?{body}:{}),country:country||(stateCode?'US':''),stateCode,place:String(saved.place??source.city??origin.name??'').trim()};
 for(const key of ['lat','lon']){const v=saved[key]??origin[key];if(v!=null&&Number.isFinite(Number(v)))location[key]=Number(v);}
 return location;
}
export function raceLocationGroup(location){
 if(location?.body)return {key:location.body,label:`Space · ${location.body}`,sort:`zzz ${location.body}`};
 if(location?.stateCode&&US_STATES[location.stateCode])return {key:location.stateCode,label:location.stateCode,sort:US_STATES[location.stateCode]};
 return {key:location?.country||'unknown',label:location?.country?`International · ${location.country}`:'Unspecified',sort:`zz ${location?.country||'zzz'}`};
}
