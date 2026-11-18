import assert from 'node:assert/strict';

// A source folder key is not necessarily a canonical saved-car ID.
export function resolveRuntimeId(source) {
  assert.match(source.id || '', /^[a-z0-9-]+$/);
  if (source.runtimeDocumentId !== undefined && source.runtimeDocumentId !== null) {
    assert.equal(source.runtimeDocumentIdVerified, true, 'Runtime binding must be verified');
    assert.match(source.runtimeDocumentId, /^[a-z0-9-]+$/);
    return source.runtimeDocumentId;
  }
  assert.notEqual(source.runtimeDocumentIdVerified, false, 'Unbound source package');
  assert.ok(!source.id.startsWith('source-'), 'Temporary source key requires an explicit verified runtime binding');
  return source.id;
}
