// Wilson (1968), as reproduced in USAF Forecaster's Guide to Tropical
// Meteorology (1991), section 12: V[km] = 12.5 * R[mm/hour]^-0.68.
// A rain-only estimate, not a fog/spray or individual hurricane observation.
export function rainVisibilityM(rateMmHour) {
  const rate=Number(rateMmHour);
  return Number.isFinite(rate)&&rate>0 ? 12500*Math.pow(rate,-.68) : Infinity;
}

// Sky art represents distant scenery at 2 km. Use the same 95% extinction
// convention as RaceLighting, with an artist-friendly clear-distance baseline.
// Snap sub-1% remaining contrast to opaque so severe storms hide the artwork.
export function skyVisibilityOpacity(visibilityM) {
  if(!Number.isFinite(visibilityM))return 0;
  const extinction=2.996*Math.max(0,1/Math.max(25,visibilityM)-1/10000);
  const transmission=Math.exp(-extinction*2000);
  return transmission<.01?1:1-transmission;
}
