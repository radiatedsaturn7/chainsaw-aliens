// Runtime cells are plain records of scalar fields plus a plain normal vector.
// Copy them without allocating a JSON string. Extended/custom records keep the
// prior JSON round-trip semantics through the fallback.
const jsonCopy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function copyRecord(value, depth) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || typeof value.toJSON === 'function') return null;
  // A spread preserves V8's compact property layout for the ~50-field cell.
  // Adding those keys one-by-one switches to a much larger dictionary object.
  const result = {...value};
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    const original = value[key];
    let member = original;
    const type = typeof member;
    if (type === 'number') member = Number.isFinite(member) ? (member === 0 ? 0 : member) : null;
    else if (type === 'undefined' || type === 'function' || type === 'symbol') { delete result[key]; continue; }
    else if (type === 'bigint') return null;
    else if (member !== null && type === 'object') {
      if (!depth) return null;
      member = copyRecord(member, depth - 1);
      if (!member) return null;
    }
    if (key === '__proto__') Object.defineProperty(result, key, {value:member,enumerable:true,writable:true,configurable:true});
    else if (member !== original || Object.is(original, -0)) result[key] = member;
  }
  return result;
}
export function cloneTrackStateCheckpointCell(cell) {
  return copyRecord(cell, 1) || jsonCopy(cell);
}
