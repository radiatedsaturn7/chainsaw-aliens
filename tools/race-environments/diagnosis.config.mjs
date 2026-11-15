import base from './playwright.config.mjs';
export default {...base,testMatch:'race-environments-diagnosis.spec.js',use:{...base.use,baseURL:'http://127.0.0.1:4231'},webServer:{...base.webServer,command:'PORT=4231 node tools/race-environments/snapshot-server.cjs',port:4231},outputDir:process.env.RACE_QA_OUTPUT||'../../test-results/race-environment-diagnosis'};
