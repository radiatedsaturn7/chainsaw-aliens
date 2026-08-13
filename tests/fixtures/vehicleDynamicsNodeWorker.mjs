import { parentPort } from 'node:worker_threads';

import { createVehicleDynamicsWorkerMessageHandler } from '../../src/racing/simulation/vehicleDynamicsWorker.js';

const scope = {
  postMessage(message, transferables = []) {
    parentPort.postMessage(message, transferables);
  }
};
const handle = createVehicleDynamicsWorkerMessageHandler({ scope });
parentPort.on('message', (data) => handle({ data }));
