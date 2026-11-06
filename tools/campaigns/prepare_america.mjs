import RaceEditor from '../../src/ui/RaceEditor.js';
import {analyzeRaceDrivingRoute, racePaceNotes} from '../../src/racing/RaceDrivingAssists.js';

// Shared by installation and the in-place upgrade; keep the archived GPS and
// surveyed terrain intact. The canonical road/terrain solver applies the blend.
const editor = new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
export function prepareAmericaRace(race, stage) {
  Object.assign(race.source, {elevationSmoothingRadiusM:45,
    shoulderFlatJoinM:8, shoulderBlendWidthM:32, shoulderMaxSlope:.22});
  for (const segment of race.road.segments) segment.bumpiness = Number(((stage.stage-1)*.005).toFixed(3));
  race.drivingGuide = {...race.drivingGuide, line:true};
  race.codriver = {...race.codriver, enabled:false, spoken:false};
  editor.applyLoadedRaceDocument(race);
  race.codriver.calls = racePaceNotes(race, analyzeRaceDrivingRoute(editor));
  return race;
}
