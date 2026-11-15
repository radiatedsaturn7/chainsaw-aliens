// Visual substrate and an explicit authored weather cover are distinct facts.
export const roadArtMaterials=Object.freeze({asphaltRoad:['asphalt'],'road-asphalt-patched':['asphalt'],'road-asphalt-industrial':['asphalt'],'road-asphalt-worn':['asphalt'],'road-asphalt-faded66':['asphalt'],'road-asphalt-wet':['asphalt','wet-asphalt'],'road-dirt-packed':['dirt'],'road-dirt-loose':['dirt'],'road-gravel-gray':['gravel'],'road-gravel-rutted':['gravel'],'road-gravel-red':['gravel'],snowroad:['snow'],'road-snow-packed':['snow'],'road-snow-patchy':['snow'],'road-slush':['slush']});
export function roadVisualStatus(ref,surface,race){
 if(!ref)return 'procedural-material-renderer';
 const expected=roadArtMaterials[ref];if(!expected)return 'unclassified';
 if(expected.includes(surface))return 'matching';
 // No filename inference or route allowlist: require known snow pixels and actual
 // authored snowfall, freezing temperature, and a known exposed road substrate.
 if(expected.includes('snow')&&['asphalt','dirt','gravel'].includes(surface)&&race.weather==='snow'&&Number(race.weatherIntensity)>0&&Number.isFinite(race.weatherTemperatureC)&&race.weatherTemperatureC<=0)return 'authored-snow-cover';
 return 'mismatch';
}
