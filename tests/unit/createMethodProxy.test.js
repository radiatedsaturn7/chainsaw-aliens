import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMethodProxy,
  createModuleFromDescriptor,
  createDescriptorModules
} from '../../src/editor/shared/createMethodProxy.js';

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

test('descriptor modules support extension hooks', () => {
  const target = {
    count: 3,
    ping(value) {
      return `pong:${value}`;
    }
  };

  const module = createModuleFromDescriptor(target, {
    methods: {
      route: {}
    },
    extend: ({ target: owner }) => ({
      snapshot() {
        return { count: owner.count };
      }
    })
  });

  assert.equal(module.route('ping', 'a'), 'pong:a');
  assert.deepEqual(module.snapshot(), { count: 3 });
});

test('factory creates multiple modules from compact descriptor object', () => {
  const target = {
    ping(value) {
      return `pong:${JSON.stringify(value)}`;
    },
    draw(value) {
      return `draw:${JSON.stringify(value)}`;
    }
  };

  const modules = createDescriptorModules(target, {
    stateModule: {
      methods: {
        transition: 'ping'
      }
    },
    renderModule: {
      render: 'draw'
    }
  });

  assert.equal(modules.stateModule.transition({ value: 'x' }), 'pong:{"value":"x"}');
  assert.equal(modules.renderModule.render({ value: 'x' }), 'draw:{"value":"x"}');
});
