const clamp = (value,min,max)=>Math.max(min,Math.min(max,value));
const RACE_WEATHER_PRESETS = [
  { id: 'clear', label: 'Clear', buildupSeconds: 1, maxIntensity: 0 },
  { id: 'rain', label: 'Rain', buildupSeconds: 150, maxIntensity: 0.72 },
  { id: 'storm', label: 'Storm', buildupSeconds: 70, maxIntensity: 1 },
  { id: 'snow', label: 'Snow', buildupSeconds: 190, maxIntensity: 1 }
];
const RACE_WEATHER_PRESET_BY_ID = Object.fromEntries(RACE_WEATHER_PRESETS.map((entry) => [entry.id, entry]));

export const referenceWeather = {
  getRaceWeatherState(race = this.selectedRace, session = this.playtestSession) {
    if (session?.triggerWeather) race = { ...(race || {}), weather: session.triggerWeather };
    const debug=session?.debugEnvironment;
    if(debug?.weather||debug?.weatherIntensity!=null)race={...race,weather:debug.weather||race?.weather,weatherIntensity:debug.weatherIntensity??1};
    const id = String(race?.weather || 'clear');
    const preset = RACE_WEATHER_PRESET_BY_ID[id] || RACE_WEATHER_PRESET_BY_ID.clear;
    const visualIntensity = preset.id === 'clear'
      ? 0
      : debug?.weatherIntensity!=null?clamp(Number(debug.weatherIntensity),0,1):this.getRaceWeatherAuthoringIntensity(race);
    const targetIntensity = Math.min(Number(preset.maxIntensity) || 0, visualIntensity);
    const elapsedSeconds = Math.max(0, Number(session?.elapsedMs || 0) / 1000);
    const buildup = preset.id === 'clear'
      ? 0
      : debug?.weather ? 1 : clamp(elapsedSeconds / Math.max(1, Number(preset.buildupSeconds) || 1), 0, 1);
    const effectiveIntensity = clamp(targetIntensity * buildup, 0, 1);
    const snowDepthInches = preset.id === 'snow' ? effectiveIntensity * 6 : 0;
    const visibility = this.getRaceWeatherVisibilityProfile(preset.id, visualIntensity);
    if(!debug?.autoVisibility&&!debug?.weather&&debug?.weatherIntensity==null&&Number(race?.weatherVisibilityM)>0)visibility.visibilityDistanceM=clamp(Number(race.weatherVisibilityM),25,10000);
    return {
      id: preset.id,
      label: preset.label,
      visualIntensity,
      targetIntensity,
      buildup,
      effectiveIntensity,
      precipitationIntensity: preset.id === 'clear' ? 0 : targetIntensity,
      snowDepthInches,
      ...visibility
    };
  }

};
