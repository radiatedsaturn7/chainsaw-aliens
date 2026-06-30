import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ControllerMenuStack,
  buildControllerExitConfirmMenu,
  buildControllerSystemMenu
} from '../../src/ui/shared/input/controllerMenuStack.js';
import { EDITOR_INPUT_ACTIONS } from '../../src/ui/shared/input/editorInputActions.js';

const action = (type) => ({ type, source: 'gamepad' });

test('controller menu uses Back/View as hierarchy back to root and exit confirm', () => {
  const stack = new ControllerMenuStack({ siblingOrder: ['tools', 'file'] });
  stack.setMenus({
    root: {
      id: 'root',
      title: 'Root',
      items: [{ id: 'tools', label: 'Tools', submenu: 'tools' }]
    },
    tools: {
      id: 'tools',
      title: 'Tools',
      items: [{ id: 'undo', label: 'Undo', onSelect: () => {} }]
    },
    file: {
      id: 'file',
      title: 'File',
      items: [{ id: 'save', label: 'Save', onSelect: () => {} }]
    },
    'exit-confirm': buildControllerExitConfirmMenu(),
    system: buildControllerSystemMenu()
  });

  assert.equal(stack.handleActions([action(EDITOR_INPUT_ACTIONS.FOCUS_TOGGLE)], {}, 0.016), true);
  assert.equal(stack.active, true);
  assert.equal(stack.getActiveMenuId(), 'root');

  stack.handleActions([action(EDITOR_INPUT_ACTIONS.CONFIRM)], {}, 0.016);
  assert.equal(stack.getActiveMenuId(), 'tools');

  assert.equal(stack.handleActions([action(EDITOR_INPUT_ACTIONS.FOCUS_TOGGLE)], {}, 0.016), true);
  assert.equal(stack.getActiveMenuId(), 'root');

  assert.equal(stack.handleActions([action(EDITOR_INPUT_ACTIONS.FOCUS_TOGGLE)], {}, 0.016), true);
  assert.equal(stack.getActiveMenuId(), 'exit-confirm');
});

test('controller menu supports vertical navigation, descend, and back in visible order', () => {
  const stack = new ControllerMenuStack({ siblingOrder: ['tools', 'file'] });
  stack.setMenus({
    root: {
      id: 'root',
      title: 'Root',
      items: [
        { id: 'tools', label: 'Tools', submenu: 'tools' },
        { id: 'file', label: 'File', submenu: 'file' }
      ]
    },
    tools: {
      id: 'tools',
      title: 'Tools',
      items: [{ id: 'undo', label: 'Undo', onSelect: () => {} }]
    },
    file: {
      id: 'file',
      title: 'File',
      items: [{ id: 'save', label: 'Save', onSelect: () => {} }]
    },
    system: buildControllerSystemMenu()
  });

  stack.openRoot();
  stack.handleActions([action(EDITOR_INPUT_ACTIONS.NAV_DOWN)], {}, 0.016);
  assert.equal(stack.selected.root, 1);

  stack.handleActions([action(EDITOR_INPUT_ACTIONS.CONFIRM)], {}, 0.016);
  assert.equal(stack.getActiveMenuId(), 'file');

  stack.handleActions([action(EDITOR_INPUT_ACTIONS.PANEL_PREV)], {}, 0.016);
  assert.equal(stack.getActiveMenuId(), 'tools');

  stack.handleActions([action(EDITOR_INPUT_ACTIONS.PANEL_NEXT)], {}, 0.016);
  assert.equal(stack.getActiveMenuId(), 'file');

  stack.handleActions([action(EDITOR_INPUT_ACTIONS.PANEL_NEXT)], {}, 0.016);
  assert.equal(stack.getActiveMenuId(), 'tools');

  stack.handleActions([action(EDITOR_INPUT_ACTIONS.CANCEL)], {}, 0.016);
  assert.equal(stack.getActiveMenuId(), 'root');

  stack.resetFocus();
  assert.equal(stack.active, false);
  assert.equal(stack.ensureInitialFocus(), true);
  assert.equal(stack.getActiveMenuId(), 'root');
});

test('controller menu syncs scroll to focused item', () => {
  const stack = new ControllerMenuStack();
  stack.setMenus({
    root: {
      id: 'root',
      title: 'Root',
      items: Array.from({ length: 10 }, (_, index) => ({
        id: `item-${index}`,
        label: `Item ${index}`,
        onSelect: () => {}
      }))
    }
  });
  stack.openRoot();
  stack.selected.root = 7;
  assert.equal(stack.syncScrollToSelection('root', 4, 0), 4);
  stack.selected.root = 2;
  assert.equal(stack.syncScrollToSelection('root', 4, 4), 2);
});

test('controller menu skips disabled rows and dividers in navigation order', () => {
  const stack = new ControllerMenuStack();
  stack.setMenus({
    root: {
      id: 'root',
      title: 'Root',
      items: [
        { id: 'first', label: 'First', onSelect: () => {} },
        { divider: true },
        { id: 'disabled', label: 'Disabled', disabled: true, onSelect: () => {} },
        { id: 'second', label: 'Second', onSelect: () => {} }
      ]
    }
  });

  stack.openRoot();
  stack.handleActions([action(EDITOR_INPUT_ACTIONS.NAV_DOWN)], {}, 0.016);
  assert.equal(stack.getFocusedItem().id, 'second');

  stack.handleActions([action(EDITOR_INPUT_ACTIONS.NAV_UP)], {}, 0.016);
  assert.equal(stack.getFocusedItem().id, 'first');
});

test('Start opens System and Exit to Main Menu is isolated there', () => {
  let exited = false;
  const stack = new ControllerMenuStack();
  stack.setMenus({
    root: {
      id: 'root',
      title: 'Root',
      items: [{ id: 'file', label: 'File', submenu: 'file' }]
    },
    file: {
      id: 'file',
      title: 'File',
      items: [{ id: 'save', label: 'Save', onSelect: () => {} }]
    },
    tools: {
      id: 'tools',
      title: 'Tools',
      items: []
    },
    help: {
      id: 'help',
      title: 'Help',
      items: []
    },
    system: buildControllerSystemMenu({ onExit: () => { exited = true; } })
  });

  stack.handleActions([action(EDITOR_INPUT_ACTIONS.MENU)], {}, 0.016);
  assert.equal(stack.getActiveMenuId(), 'system');
  assert.equal(stack.getItems().some((item) => item.id === 'exit-main'), true);
  assert.equal(stack.menus.file.items.some((item) => item.id === 'exit-main' || item.label === 'Exit to Main Menu'), false);

  stack.selected.system = 3;
  stack.handleActions([action(EDITOR_INPUT_ACTIONS.CONFIRM)], {}, 0.016);
  assert.equal(exited, true);
  assert.equal(stack.active, false);
});

test('selecting a submenu item returns to surface and B returns to root', () => {
  let selected = false;
  const stack = new ControllerMenuStack();
  stack.setMenus({
    root: {
      id: 'root',
      title: 'Root',
      items: [{ id: 'draw', label: 'Draw', submenu: 'draw' }]
    },
    draw: {
      id: 'draw',
      title: 'Draw',
      items: [{ id: 'pencil', label: 'Pencil', onSelect: () => { selected = true; } }]
    },
    system: buildControllerSystemMenu()
  });

  assert.equal(stack.ensureInitialFocus(), true);
  stack.handleActions([action(EDITOR_INPUT_ACTIONS.CONFIRM)], {}, 0.016);
  assert.equal(stack.getActiveMenuId(), 'draw');

  stack.handleActions([action(EDITOR_INPUT_ACTIONS.CONFIRM)], {}, 0.016);
  assert.equal(selected, true);
  assert.equal(stack.active, false);

  stack.handleActions([action(EDITOR_INPUT_ACTIONS.CANCEL)], {}, 0.016);
  assert.equal(stack.active, true);
  assert.equal(stack.getActiveMenuId(), 'root');
});

test('exit confirmation supports D-pad selection, A confirm, and B cancel', () => {
  let exited = false;
  const stack = new ControllerMenuStack();
  stack.setMenus({
    root: {
      id: 'root',
      title: 'Root',
      items: [{ id: 'draw', label: 'Draw', submenu: 'draw' }]
    },
    draw: {
      id: 'draw',
      title: 'Draw',
      items: []
    },
    'exit-confirm': buildControllerExitConfirmMenu({ onExit: () => { exited = true; } }),
    system: buildControllerSystemMenu()
  });

  stack.openRoot();
  stack.handleActions([action(EDITOR_INPUT_ACTIONS.CANCEL)], {}, 0.016);
  assert.equal(stack.getActiveMenuId(), 'exit-confirm');

  stack.handleActions([action(EDITOR_INPUT_ACTIONS.NAV_DOWN)], {}, 0.016);
  assert.equal(stack.getFocusedItem().id, 'cancel-exit');
  stack.handleActions([action(EDITOR_INPUT_ACTIONS.CONFIRM)], {}, 0.016);
  assert.equal(stack.getActiveMenuId(), 'root');
  assert.equal(exited, false);

  stack.handleActions([action(EDITOR_INPUT_ACTIONS.CANCEL)], {}, 0.016);
  assert.equal(stack.getActiveMenuId(), 'exit-confirm');
  stack.handleActions([action(EDITOR_INPUT_ACTIONS.CANCEL)], {}, 0.016);
  assert.equal(stack.getActiveMenuId(), 'root');
  assert.equal(exited, false);

  stack.handleActions([action(EDITOR_INPUT_ACTIONS.CANCEL)], {}, 0.016);
  stack.handleActions([action(EDITOR_INPUT_ACTIONS.CONFIRM)], {}, 0.016);
  assert.equal(exited, true);
});
