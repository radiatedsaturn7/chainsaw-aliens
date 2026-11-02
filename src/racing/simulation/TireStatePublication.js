// Internal tire/contact records contain enumerable own string fields. Read the
// keys each time: contact modes add fields, so a cached schema would go stale.
// Keep shallow references and existing destination fields, like Object.assign.
// Explicit assignment avoids V8's expensive generic bulk-copy path on these
// large, repeatedly updated records. Do not use this for arbitrary user objects.
export function copyTireStateRecord(target, source) {
  if (source == null) return target;
  const keys = Object.keys(source);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    target[key] = source[key];
  }
  return target;
}
