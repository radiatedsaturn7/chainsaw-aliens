import { traceRaceImage } from '../racing/RaceImageTrace.js';
self.onmessage = ({ data }) => {
  try { self.postMessage(traceRaceImage(data.image, data.options)); }
  catch (error) { self.postMessage({ error: error.message || 'Could not trace this drawing.' }); }
};
