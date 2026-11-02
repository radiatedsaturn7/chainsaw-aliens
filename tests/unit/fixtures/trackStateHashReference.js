// Frozen pre-optimization streaming hash for parity tests.
import {quantizeTrackStateNumber} from '../../../src/racing/trackState/TrackStateMath.js';
function isJsonOmitted(value) {
  return value === undefined || typeof value === 'function' || typeof value === 'symbol';
}

function* streamCanonicalJson(value, { arrayValue = false } = {}) {
  if (isJsonOmitted(value)) {
    if (arrayValue) yield 'null';
    return;
  }
  if (typeof value === 'number') {
    yield JSON.stringify(quantizeTrackStateNumber(value));
    return;
  }
  if (value === null || typeof value !== 'object') {
    yield JSON.stringify(value);
    return;
  }
  if (Array.isArray(value)) {
    yield '[';
    for (let index = 0; index < value.length; index += 1) {
      if (index) yield ',';
      yield* streamCanonicalJson(value[index], { arrayValue: true });
    }
    yield ']';
    return;
  }
  yield '{';
  const keys = Object.keys(value).filter((key) => !isJsonOmitted(value[key])).sort();
  for (let index = 0; index < keys.length; index += 1) {
    if (index) yield ',';
    const key = keys[index];
    yield JSON.stringify(key);
    yield ':';
    yield* streamCanonicalJson(value[key]);
  }
  yield '}';
}

export function createIncrementalTrackStateHash(value) {
  const iterator = streamCanonicalJson(value);
  let hash = 0x811c9dc5;
  let token = '';
  let tokenOffset = 0;
  let finished = false;
  let processedCharacters = 0;
  const task = {
    done: false,
    checksum: '',
    processedCharacters: 0,
    process(maxCharacters = 32768) {
      let remaining = Math.max(1, Math.trunc(Number(maxCharacters) || 32768));
      let processed = 0;
      while (remaining > 0 && !finished) {
        if (tokenOffset >= token.length) {
          const next = iterator.next();
          if (next.done) {
            finished = true;
            task.done = true;
            task.checksum = hash.toString(16).padStart(8, '0');
            break;
          }
          token = String(next.value || '');
          tokenOffset = 0;
          if (!token.length) continue;
        }
        const count = Math.min(remaining, token.length - tokenOffset);
        const end = tokenOffset + count;
        for (; tokenOffset < end; tokenOffset += 1) {
          const code = token.charCodeAt(tokenOffset);
          hash ^= code & 0xff;
          hash = Math.imul(hash, 0x01000193) >>> 0;
          if (code > 0xff) {
            hash ^= code >>> 8;
            hash = Math.imul(hash, 0x01000193) >>> 0;
          }
        }
        remaining -= count;
        processed += count;
      }
      processedCharacters += processed;
      task.processedCharacters = processedCharacters;
      return processed;
    }
  };
  return task;
}

