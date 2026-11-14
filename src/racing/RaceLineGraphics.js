// Small, cached road-space pixel graphics. Missing pixels reveal the real surface,
// rather than painting a fake asphalt rectangle over snow, dirt or gravel.
// Both renderers consume these same normalized patches; no timing data is changed.
export const RACE_LINE_DEPTH_M = 2.4;
const COLS = 48;
const ROWS = 12;
function makeGraphic(kind) {
  const patches = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const hash = ((x * 37 + y * 71 + x * y * 13) % 101);
      // Broken edges and sparse chips keep the main silhouette legible.
      if (hash < 7 || ((x === 0 || x === COLS - 1) && hash < 30)) continue;
      let color;
      if (kind === 'start') {
        // Two ivory bars frame a muted ochre launch band, not another finish flag.
        if (y === 0 || y === 11 || y === 4 || y === 7) continue;
        color = y < 4 || y > 7 ? '#d8d5ba' : '#b79950';
      } else {
        // Two true rows of square checks, with narrow worn edge rules.
        color = (Math.floor(x / 4) + Math.floor(y / 6)) % 2 ? '#292d2b' : '#dedbc9';
      }
      if (hash > 91) color = kind === 'start' ? '#a99f7e' : (color === '#292d2b' ? '#3b403a' : '#b9b8a8');
      // Inset clear of shoulders; preserve the authored road width.
      patches.push(Object.freeze({u0:.025+.95*x/COLS,u1:.025+.95*(x+1)/COLS,v0:y/ROWS,v1:(y+1)/ROWS,color}));
    }
  }
  // Merge horizontal runs of identical pixels to avoid hundreds of draw calls.
  const runs = [];
  for (const p of patches) {
    const last = runs.at(-1);
    if (last && last.v0 === p.v0 && last.color === p.color && Math.abs(last.u1-p.u0)<1e-9) last.u1=p.u1;
    else runs.push({...p});
  }
  return Object.freeze(runs.map(Object.freeze));
}
const START = makeGraphic('start');
const FINISH = makeGraphic('finish');
export function raceLineGraphic(kind = 'finish') { return kind === 'start' ? START : FINISH; }
// At distance the wear is subpixel. Keep a readable silhouette in the software
// renderer rather than culling dozens of tiny chips individually.
const DISTANT_START = Object.freeze([1,8].map(y=>Object.freeze({u0:.025,u1:.975,v0:y/12,v1:(y+3)/12,color:'#d8d5ba'})));
const DISTANT_FINISH = Object.freeze(Array.from({length:24},(_,i)=>Object.freeze({u0:.025+.95*(i%12)/12,u1:.025+.95*(i%12+1)/12,v0:Math.floor(i/12)/2,v1:(Math.floor(i/12)+1)/2,color:(i%12+Math.floor(i/12))%2?'#292d2b':'#dedbc9'})));
export function distantRaceLineGraphic(kind = 'finish') { return kind === 'start' ? DISTANT_START : DISTANT_FINISH; }
