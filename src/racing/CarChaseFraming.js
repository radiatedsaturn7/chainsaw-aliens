import data from './CarChaseFramingData.js';
import {resolveCarAngleLayers} from './CarDirectionalArt.js';

// Height of the visible sprite midpoint above its rear-axle artwork anchor.
// Ignore transparent padding. Match drawRaceCarBillboardLayers' transforms.
export function rearArtworkMiddleHeight(car) {
 const resolved=resolveCarAngleLayers(car,'rear'),art=resolved?.art||{};
 const body=car?.art?.angleLayers?.rear?.body;
 const bounds=data.bounds[`${body?.artRef}:${body?.frameIndex||0}`];
 if(!bounds)return null;
 const width=Number(car.dimensions?.widthM)||1.8;
 const scale=Math.max(.05,Math.min(12,Number(art.bodyScaleY??art.bodyScale??1)||1));
 const height=width*(art.bodyFitToCar ? .74 : bounds.aspect)*scale;
 const offset=Math.max(-16,Math.min(16,Number(art.bodyOffsetY)||0));
 return (.58-bounds.middle)*height-offset*width*.74*.22;
}
const referenceHeight=rearArtworkMiddleHeight(data.reference);
export function carChaseClearanceLift(car) {
 const height=rearArtworkMiddleHeight(car);
 return height===null?0:Math.max(0,height-referenceHeight);
}
