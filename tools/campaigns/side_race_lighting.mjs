import {raceFxPreset} from '../../src/racing/RaceVisualFx.js';

// Stable random assignment: reimporting a race never rerolls its lighting.
export function applySideRaceLighting(race, eventId) {
  let seed=0x93a61c;
  for(const character of eventId)seed=Math.imul(seed^character.charCodeAt(0),16777619)>>>0;
  seed^=seed>>>16;seed=Math.imul(seed,0x45d9f3b)>>>0;seed^=seed>>>16;
  const name=eventId==='H01-S01'?'noon':['morning','noon','evening','night'][(seed>>>0)%4];
  const preset=raceFxPreset(name), previous=race.visualFx||{};
  race.timeOfDay=preset.timeOfDay;
  race.brightness=preset.brightness;
  race.visualFx={...previous,...preset.visualFx,
    // Match scene lighting and avoid bringing back the unwanted blur.
    skyBrightness:preset.brightness,motionBlur:previous.motionBlur??0,speedLines:previous.speedLines??0,
    speedLineArtRef:previous.speedLineArtRef||'',speedLineArtMode:previous.speedLineArtMode||'overlay'};
  return name;
}
