import { createThunderSamples, fillThunderSamples } from './ThunderSamples.js';
self.onmessage = ({ data: { id, options } }) => {
  const job = createThunderSamples(options);
  fillThunderSamples(job);
  self.postMessage({ id, samples: job.samples }, [job.samples.buffer]);
};
