import test from 'node:test';
import assert from 'node:assert/strict';

import { createMethodProxy } from '../../src/editor/shared/createMethodProxy.js';

test('returns null for missing methods', () => {
  const proxy = createMethodProxy({}, { route: {} });
  assert.equal(proxy.route('doesNotExist', 1, 2), null);
});

test('forwards method args and supports default method fallback', () => {
  const calls = [];
  const target = {
    ping(...args) {
      calls.push(args);
      return args.join(':');
    }
  };

  const proxy = createMethodProxy(target, {
    route: {},
    render: 'ping'
  });

  assert.equal(proxy.route('ping', 'a', 'b'), 'a:b');
  assert.equal(proxy.render({ value: 'x' }, 'y'), '[object Object]:y');
  assert.deepEqual(calls, [['a', 'b'], [{ value: 'x' }, 'y']]);
});
