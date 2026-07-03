import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatLatestChangeTimestamp,
  formatLatestChanges,
  isLatestChangesOverlayOpen,
  LATEST_CHANGES,
  LATEST_MAJOR_WORK,
  openLatestChangesOverlay
} from '../../src/ui/latestChanges.js';

test('latest changes exposes a running ordered summary for the options menu', () => {
  assert.ok(LATEST_CHANGES.length >= 4);
  assert.match(LATEST_CHANGES[0].date, /^2026-07-0[12]$/);
  assert.match(LATEST_CHANGES[0].time, /^\d{2}:\d{2} [A-Z]{3}$/);
  assert.equal(formatLatestChangeTimestamp(LATEST_CHANGES[0]), `${LATEST_CHANGES[0].date} ${LATEST_CHANGES[0].time}`);
  assert.equal(formatLatestChangeTimestamp({ date: '2026-07-01' }), '2026-07-01');

  const text = formatLatestChanges();
  assert.equal(text.startsWith('Latest Changes'), true);
  assert.equal(text.includes('Major Items I am Working Toward'), true);
  assert.equal(text.includes('Most Recent Major Changes'), true);
  assert.equal(text.indexOf('Major Items I am Working Toward') < text.indexOf('Detailed Change Log'), true);
  assert.ok(LATEST_MAJOR_WORK.inProgress.some((item) => item.includes('desktop editor chrome')));
  assert.ok(LATEST_MAJOR_WORK.recentMajorChanges.some((item) => item.includes('Canvas desktop top menus')));
  assert.equal(text.includes(`${LATEST_CHANGES[0].date} ${LATEST_CHANGES[0].time} - ${LATEST_CHANGES[0].title || LATEST_CHANGES[0].summary}`), true);
  assert.equal(text.includes('Stopped the Actor Editor from showing the mobile gamepad hint bar'), true);
  assert.equal(text.includes('Capped desktop drop-down drawer rows'), true);
  assert.equal(text.includes('scrollable dialog overlay'), true);
  assert.equal(text.includes('Added an Options menu entry'), true);
  assert.equal(text.includes('Editor desktop UI consistency'), true);
});

test('latest changes overlay is a DOM dialog rather than a game-state prompt', () => {
  const nodes = new Map();
  const bodyChildren = [];
  const createNode = (tag) => ({
    tag,
    id: '',
    type: '',
    textContent: '',
    style: {},
    children: [],
    parent: null,
    append(...items) {
      items.forEach((item) => this.appendChild(item));
    },
    appendChild(item) {
      item.parent = this;
      this.children.push(item);
      return item;
    },
    contains(target) {
      if (target === this) return true;
      return this.children.some((child) => child.contains?.(target));
    },
    remove() {
      if (this.id) nodes.delete(this.id);
      if (this.parent) this.parent.children = this.parent.children.filter((item) => item !== this);
    },
    focus() {},
    setAttribute(name, value) {
      this[name] = value;
    }
  });
  const body = createNode('body');
  const listeners = [];
  body.appendChild = (item) => {
    item.parent = body;
    bodyChildren.push(item);
    if (item.id) nodes.set(item.id, item);
    return item;
  };
  const previousDocument = global.document;
  global.document = {
    body,
    createElement: (tag) => createNode(tag),
    getElementById: (id) => nodes.get(id) || null,
    addEventListener: (type, handler, capture) => listeners.push({ type, handler, capture }),
    removeEventListener: (type, handler, capture) => {
      const index = listeners.findIndex((entry) => (
        entry.type === type
        && entry.handler === handler
        && entry.capture === capture
      ));
      if (index >= 0) listeners.splice(index, 1);
    }
  };
  try {
    const overlay = openLatestChangesOverlay();
    assert.equal(overlay.id, 'latest-changes-overlay');
    nodes.set(overlay.id, overlay);
    assert.equal(overlay.role, 'dialog');
    assert.equal(overlay['aria-modal'], 'true');
    assert.equal(isLatestChangesOverlayOpen(), true);
    assert.equal(typeof overlay.onpointerdown, 'function');
    assert.equal(typeof overlay.onpointerup, 'function');
    assert.equal(overlay.style.overflowY, undefined);
    assert.equal(body.style.overflow, 'hidden');
    assert.ok(listeners.some((entry) => entry.type === 'touchstart' && entry.capture === true));
    const panel = overlay.children[0];
    const list = panel.children[1];
    assert.equal(list.style.overflowY, 'auto');
    assert.equal(list.children[0].children[0].textContent, 'Major Items I am Working Toward');
    assert.equal(list.children[1].children[0].textContent, 'Most Recent Major Changes');
    overlay.__closeLatestChanges();
    assert.equal(body.style.overflow, '');
    assert.equal(isLatestChangesOverlayOpen(), false);
  } finally {
    global.document = previousDocument;
  }
});
