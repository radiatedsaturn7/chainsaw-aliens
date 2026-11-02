export class MockWheelDriver {
 constructor(){this.capabilities={forceFeedback:true,reason:'Mock only — no physical output'};this.armed=false;this.initialized=false;this.samples=[];}
 async initialize(){this.armed=true;this.initialized=true;}
 async write(torque){if(this.armed){this.samples.push(Number.isFinite(torque)?Math.max(-.35,Math.min(.35,torque)):0);if(this.samples.length>500)this.samples.shift();}}
 async quiet(){this.samples.push(0);}
 async stop(){this.armed=false;this.initialized=false;this.samples.push(0);}
 disconnect(){void this.stop();}
 async dispose(){await this.stop();}
}
