import {wrxVisualMode} from './WrxVisualPilot.js';

const classic = [
  new URL('./wrx/body.pack', import.meta.url),
  new URL('./wrx/wheel.pack', import.meta.url)
];
const fit10 = [
  new URL('./wrx/fit10-body.pack', import.meta.url),
  new URL('./wrx/fit10-wheel.pack', import.meta.url)
];
const partIndex=ref=>ref==='Field-Forgetmenot'?0:ref==='Field-Forgetmenot-Wheel'?1:-1;
const requestedLook=typeof location==='undefined'?null:new URLSearchParams(location.search).get('wrxLook');
// Keep the previous hand-built assets recoverable without changing saved car IDs.
const packsFor=look=>look==='legacy'||look==='showcase'?classic:fit10;
export const isWrxFit10Document=(model,part)=>model?.name==='Field Forgetmenot 2004 · Fit 10 '+part;

export function wrxBundledModelUrl(ref) {
  const i=partIndex(ref);
  return !wrxVisualMode||i<0?null:packsFor(requestedLook)[i];
}

let currentPair;

export async function loadWrxBundledModel(ref) {
  const requested = wrxBundledModelUrl(ref);
  if (!requested || typeof DecompressionStream !== 'function') return null;
  const load=async url=>{
    const signal=globalThis.AbortSignal?.timeout?.(10000);
    const response=await fetch(url,{signal});
    if(!response.ok)throw Error(`WRX visual pack: ${response.status}`);
    return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
  };
  const i=partIndex(ref);
  if(requested===classic[i])return load(requested);
  // Do not mix wheel/fascia generations if one Fit 10 request fails.
  currentPair ||= Promise.all(fit10.map(load)).catch(()=>Promise.all(classic.map(load)));
  try{return (await currentPair)[i];}
  catch(error){currentPair=null;throw error;}
}
