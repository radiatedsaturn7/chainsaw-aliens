import {applyMissionConditions} from './mission_conditions.mjs';
import {authorRaceContinuations} from './author_continuations.mjs';
import {applyAmericaRoughness} from './america_roughness.mjs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {analyzeRaceDrivingRoute, racePaceNotes} from '../../src/racing/RaceDrivingAssists.js';

// Shared by installation and the in-place upgrade; keep the archived GPS and
// surveyed terrain intact. The canonical road/terrain solver applies the blend.
const editor = new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
export function prepareAmericaRace(race, stage) {
  race.margin={...race.margin,marginMode:'hidden'};
  race.snowClouds={...race.snowClouds,enabled:true,artRef:'snowcloud'};
  Object.assign(race.source, {elevationSmoothingRadiusM:45,
    shoulderFlatJoinM:8, shoulderBlendWidthM:32, shoulderMaxSlope:.22});
  applyAmericaRoughness(race,stage);
  applyMissionConditions(race);
  authorRaceContinuations(race);
  race.drivingGuide = {...race.drivingGuide, line:true};
  race.codriver = {...race.codriver, enabled:false, spoken:false};
  editor.applyLoadedRaceDocument(race);
  race.codriver.calls = racePaceNotes(race, analyzeRaceDrivingRoute(editor));
  return race;
}
