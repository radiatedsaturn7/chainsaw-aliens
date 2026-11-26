import {wrxVisualMode} from './WrxVisualPilot.js';

const body = new URL('./wrx/body.pack', import.meta.url);
const wheel = new URL('./wrx/wheel.pack', import.meta.url);

export function wrxBundledModelUrl(ref) {
  if (!wrxVisualMode) return null;
  return ref === 'Field-Forgetmenot' ? body : ref === 'Field-Forgetmenot-Wheel' ? wheel : null;
}

export async function loadWrxBundledModel(ref) {
  const url = wrxBundledModelUrl(ref);
  if (!url || typeof DecompressionStream !== 'function') return null;
  const signal = globalThis.AbortSignal?.timeout?.(10000);
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error(`WRX visual pack: ${response.status}`);
  return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
}
