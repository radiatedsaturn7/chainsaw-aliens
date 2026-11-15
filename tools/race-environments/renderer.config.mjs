import base from './playwright.config.mjs';
export default {...base,testMatch:'race-environments-renderer.spec.js',outputDir:'../../test-results/race-environment-renderer'};
