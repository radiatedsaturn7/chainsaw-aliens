import { EDITOR_INPUT_ACTIONS, DEFAULT_EDITOR_GAMEPAD_DEADZONES, SHARED_EDITOR_GAMEPAD_HINTS } from './editorInputActions.js';
import { UI_SUITE } from '../../uiSuite.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class ControllerMenuStack {
  constructor({ rootId = 'root', systemId = 'system', exitConfirmId = 'exit-confirm', siblingOrder = [] } = {}) {
    this.rootId = rootId;
    this.systemId = systemId;
    this.exitConfirmId = exitConfirmId;
    this.siblingOrder = siblingOrder;
    this.menus = {};
    this.stack = [];
    this.selected = {};
    this.scroll = {};
    this.active = false;
    this.stickRepeat = 0;
    this.initialized = false;
    this.lastSubmenuId = null;
    this.lastRootId = null;
  }

  setMenus(menus = {}, { rootId = this.rootId, systemId = this.systemId, exitConfirmId = this.exitConfirmId, siblingOrder = this.siblingOrder } = {}) {
    this.menus = menus;
    this.rootId = rootId;
    this.systemId = systemId;
    this.exitConfirmId = exitConfirmId;
    this.siblingOrder = siblingOrder;
    if (this.active && !this.getActiveMenu()) {
      this.openRoot();
    }
  }

  resetFocus() {
    this.stack = [];
    this.active = false;
    this.initialized = false;
    this.lastSubmenuId = null;
    this.lastRootId = null;
    this.stickRepeat = 0;
  }

  openRoot(menuId = this.rootId) {
    this.stack = [menuId];
    this.active = true;
    this.initialized = true;
    this.ensureSelection();
  }

  openSystem() {
    this.stack = [this.systemId];
    this.active = true;
    this.initialized = true;
    this.ensureSelection();
  }

  openExitConfirm() {
    if (!this.menus[this.exitConfirmId]) return false;
    this.stack = [this.exitConfirmId];
    this.active = true;
    this.initialized = true;
    this.selected[this.exitConfirmId] = 0;
    this.scroll[this.exitConfirmId] = 0;
    this.ensureSelection();
    return true;
  }

  openSubmenu(menuId) {
    if (!menuId || !this.menus[menuId]) return false;
    this.stack = [this.rootId, menuId];
    this.active = true;
    this.initialized = true;
    this.lastSubmenuId = menuId;
    this.ensureRootSelectionForSubmenu(menuId);
    this.ensureSelection();
    return true;
  }

  ensureInitialFocus(menuId = this.rootId) {
    if (this.initialized) return false;
    this.openRoot(menuId);
    return true;
  }

  closeToSurface() {
    this.active = false;
    this.stack = [];
    this.initialized = true;
  }

  getActiveMenuId() {
    return this.stack[this.stack.length - 1] || null;
  }

  getActiveMenu() {
    return this.menus[this.getActiveMenuId()] || null;
  }

  isMenuActive(menuId) {
    return this.active && this.getActiveMenuId() === menuId;
  }

  getItems(menu = this.getActiveMenu()) {
    return (menu?.items || []).filter((item) => !item.hidden);
  }

  isSelectableItem(item) {
    return Boolean(item) && !item.disabled && !item.divider && !item.separator;
  }

  findSelectableIndex(items, startIndex = 0, direction = 1) {
    if (!items.length) return -1;
    const step = direction < 0 ? -1 : 1;
    let index = clamp(startIndex, 0, items.length - 1);
    while (index >= 0 && index < items.length) {
      if (this.isSelectableItem(items[index])) return index;
      index += step;
    }
    index = step > 0 ? items.length - 1 : 0;
    while (index >= 0 && index < items.length) {
      if (this.isSelectableItem(items[index])) return index;
      index -= step;
    }
    return -1;
  }

  getFocusedItem(menuId = this.getActiveMenuId()) {
    const menu = this.menus[menuId];
    const items = this.getItems(menu);
    return items[this.selected[menuId] ?? 0] || null;
  }

  syncScrollToSelection(menuId = this.getActiveMenuId(), visibleRows = 1, currentScroll = null) {
    const menu = this.menus[menuId];
    const items = this.getItems(menu);
    const maxScroll = Math.max(0, items.length - Math.max(1, visibleRows));
    let scroll = clamp(
      Number.isFinite(currentScroll) ? Math.round(currentScroll) : (this.scroll[menuId] ?? 0),
      0,
      maxScroll
    );
    const selectedIndex = clamp(this.selected[menuId] ?? 0, 0, Math.max(0, items.length - 1));
    if (selectedIndex < scroll) scroll = selectedIndex;
    if (selectedIndex >= scroll + visibleRows) scroll = selectedIndex - visibleRows + 1;
    this.scroll[menuId] = clamp(scroll, 0, maxScroll);
    return this.scroll[menuId];
  }

  syncScrollToItem(menuId, itemId, orderedItems = [], visibleRows = 1, currentScroll = null) {
    const ids = orderedItems.map((item) => (typeof item === 'string' ? item : item?.id));
    const selectedIndex = ids.indexOf(itemId);
    const maxScroll = Math.max(0, orderedItems.length - Math.max(1, visibleRows));
    let scroll = clamp(
      Number.isFinite(currentScroll) ? Math.round(currentScroll) : (this.scroll[menuId] ?? 0),
      0,
      maxScroll
    );
    if (selectedIndex >= 0) {
      if (selectedIndex < scroll) scroll = selectedIndex;
      if (selectedIndex >= scroll + visibleRows) scroll = selectedIndex - visibleRows + 1;
    }
    this.scroll[menuId] = clamp(scroll, 0, maxScroll);
    return this.scroll[menuId];
  }

  isFocusedItem(menuId, itemId, index = null) {
    if (!this.isMenuActive(menuId)) return false;
    const selectedIndex = this.selected[menuId] ?? 0;
    if (Number.isFinite(index) && selectedIndex === index) return true;
    return this.getFocusedItem(menuId)?.id === itemId;
  }

  ensureSelection() {
    const menuId = this.getActiveMenuId();
    const items = this.getItems();
    if (!menuId || !items.length) return;
    const current = clamp(this.selected[menuId] ?? 0, 0, items.length - 1);
    const selectable = this.findSelectableIndex(items, current, 1);
    this.selected[menuId] = selectable >= 0 ? selectable : current;
    this.scroll[menuId] = Math.max(0, this.scroll[menuId] ?? 0);
  }

  ensureRootSelectionForSubmenu(menuId) {
    const root = this.menus[this.rootId];
    const rootItems = this.getItems(root);
    const index = rootItems.findIndex((item) => item.submenu === menuId || item.id === menuId);
    if (index >= 0) {
      this.selected[this.rootId] = index;
      this.lastRootId = rootItems[index]?.id || null;
    }
  }

  move(delta) {
    const menuId = this.getActiveMenuId();
    const items = this.getItems();
    if (!menuId || !items.length || !delta) return;
    const direction = Math.sign(delta);
    const current = clamp(this.selected[menuId] ?? 0, 0, items.length - 1);
    const next = this.findSelectableIndex(items, current + direction, direction);
    if (next >= 0) this.selected[menuId] = next;
  }

  moveSibling(delta) {
    const current = this.getActiveMenuId();
    if (!current || !this.siblingOrder.length) return;
    const index = this.siblingOrder.indexOf(current);
    if (index < 0) return;
    const nextId = this.siblingOrder[(index + Math.sign(delta) + this.siblingOrder.length) % this.siblingOrder.length];
    this.stack[this.stack.length - 1] = nextId;
    this.ensureSelection();
  }

  back(context = null) {
    if (!this.active) return false;
    if (this.getActiveMenuId() === this.exitConfirmId) {
      this.openRoot();
      return 'exit-cancelled';
    }
    if (this.stack.length > 1) {
      this.stack.pop();
      this.ensureSelection();
      return 'submenu-to-root';
    }
    if (this.getActiveMenuId() === this.rootId) {
      if (this.openExitConfirm()) return 'root-exit-request';
      context?.requestControllerExitConfirm?.();
      return 'root-exit-request';
    }
    this.openRoot();
    return 'surface-to-root';
  }

  select(context = null) {
    const menu = this.getActiveMenu();
    const items = this.getItems(menu);
    const item = items[this.selected[this.getActiveMenuId()] ?? 0];
    if (!this.isSelectableItem(item)) return false;
    if (item.submenu) {
      if (typeof item.onEnter === 'function') item.onEnter(context);
      this.stack.push(item.submenu);
      this.lastRootId = item.id || null;
      this.lastSubmenuId = item.submenu;
      this.ensureSelection();
      return true;
    }
    if (typeof item.onSelect === 'function') {
      const returnMenuId = item.returnMenuId || this.getActiveMenuId();
      if (returnMenuId && returnMenuId !== this.rootId && returnMenuId !== this.systemId) {
        this.lastSubmenuId = returnMenuId;
        this.ensureRootSelectionForSubmenu(returnMenuId);
      }
      item.onSelect(context);
      if (item.closeOnSelect !== false) this.closeToSurface();
      return true;
    }
    if (this.getActiveMenuId() === this.exitConfirmId && item.id === 'cancel-exit') {
      this.openRoot();
      return true;
    }
    return false;
  }

  handleActions(actions = [], axes = {}, dt = 0, context = null) {
    const hasAction = (type) => actions.some((entry) => entry.type === type);
    if (hasAction(EDITOR_INPUT_ACTIONS.MENU)) {
      this.openSystem();
      return true;
    }
    if (hasAction(EDITOR_INPUT_ACTIONS.FOCUS_TOGGLE)) {
      this.back(context) || this.openRoot();
      return true;
    }
    if (!this.active) {
      if (hasAction(EDITOR_INPUT_ACTIONS.CANCEL)) {
        this.openRoot();
        return true;
      }
      if (hasAction(EDITOR_INPUT_ACTIONS.NAV_UP)
        || hasAction(EDITOR_INPUT_ACTIONS.NAV_DOWN)
        || hasAction(EDITOR_INPUT_ACTIONS.NAV_LEFT)
        || hasAction(EDITOR_INPUT_ACTIONS.NAV_RIGHT)) {
        this.openRoot();
        if (hasAction(EDITOR_INPUT_ACTIONS.NAV_DOWN) || hasAction(EDITOR_INPUT_ACTIONS.NAV_RIGHT)) this.move(1);
        return true;
      }
      return false;
    }

    let consumed = false;
    if (hasAction(EDITOR_INPUT_ACTIONS.CANCEL)) {
      this.back(context);
      consumed = true;
    }
    if (hasAction(EDITOR_INPUT_ACTIONS.NAV_UP)) {
      this.move(-1);
      consumed = true;
    }
    if (hasAction(EDITOR_INPUT_ACTIONS.NAV_DOWN)) {
      this.move(1);
      consumed = true;
    }
    if (hasAction(EDITOR_INPUT_ACTIONS.PANEL_PREV)) {
      this.moveSibling(-1);
      consumed = true;
    }
    if (hasAction(EDITOR_INPUT_ACTIONS.PANEL_NEXT)) {
      this.moveSibling(1);
      consumed = true;
    }
    this.stickRepeat = Math.max(0, this.stickRepeat - dt);
    const stickY = Math.abs(axes.leftY || 0) > DEFAULT_EDITOR_GAMEPAD_DEADZONES.stick ? axes.leftY : 0;
    if (stickY && this.stickRepeat <= 0) {
      this.move(Math.sign(stickY));
      this.stickRepeat = 0.16;
      consumed = true;
    }
    if (hasAction(EDITOR_INPUT_ACTIONS.CONFIRM)) {
      this.select(context);
      consumed = true;
    }
    return consumed || this.active;
  }
}

export function buildControllerExitConfirmMenu({ onExit = null, title = 'Exit editor?', message = 'Unsaved changes may be lost.' } = {}) {
  return {
    id: 'exit-confirm',
    title,
    modal: true,
    items: [
      { id: 'confirm-exit', label: 'A Confirm Exit', onSelect: onExit },
      { id: 'cancel-exit', label: 'Cancel' },
      { id: 'exit-message', label: message, disabled: true }
    ]
  };
}

export function buildControllerSystemMenu({ fileMenuId = 'file', toolsMenuId = 'tools', helpMenuId = 'help', onExit = null } = {}) {
  return {
    id: 'system',
    title: 'System',
    items: [
      { id: 'file', label: 'File', submenu: fileMenuId },
      { id: 'tools', label: 'Tools', submenu: toolsMenuId },
      { id: 'help', label: 'Controller Help', submenu: helpMenuId },
      { id: 'exit-main', label: 'Exit to Main Menu', onSelect: onExit }
    ]
  };
}

export function buildControllerHelpMenu(extraLines = []) {
  return {
    id: 'help',
    title: 'Controller Help',
    items: [...SHARED_EDITOR_GAMEPAD_HINTS, ...extraLines].map((label, index) => ({
      id: `help-${index}`,
      label,
      disabled: true
    }))
  };
}

export function drawCanvasControllerMenu(ctx, menuStack, { width, height, contextLabel = 'Editor' } = {}) {
  if (!menuStack?.active) return null;
  const menu = menuStack.getActiveMenu();
  if (!menu) return null;
  if (menuStack.stack?.[0] !== menuStack.systemId && !menu.modal) return null;
  const items = menuStack.getItems(menu);
  const selectedIndex = menuStack.selected[menuStack.getActiveMenuId()] ?? 0;
  const panelW = Math.min(440, Math.max(300, width * 0.42));
  const rowH = 42;
  const gap = 8;
  const maxRows = Math.max(4, Math.floor((height - 160) / (rowH + gap)));
  const scroll = clamp(menuStack.scroll[menuStack.getActiveMenuId()] ?? 0, 0, Math.max(0, items.length - maxRows));
  menuStack.scroll[menuStack.getActiveMenuId()] = selectedIndex < scroll
    ? selectedIndex
    : selectedIndex >= scroll + maxRows
      ? selectedIndex - maxRows + 1
      : scroll;
  const nextScroll = menuStack.scroll[menuStack.getActiveMenuId()];
  const visible = items.slice(nextScroll, nextScroll + maxRows);
  const panelH = 72 + visible.length * (rowH + gap) + 42;
  const x = 18;
  const y = Math.max(18, Math.floor((height - panelH) / 2));
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = UI_SUITE.colors.panel;
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = UI_SUITE.colors.border;
  ctx.strokeRect(x, y, panelW, panelH);
  ctx.fillStyle = UI_SUITE.colors.accent;
  ctx.font = `13px ${UI_SUITE.font.family}`;
  ctx.fillText(contextLabel, x + 16, y + 22);
  ctx.fillStyle = UI_SUITE.colors.text;
  ctx.font = `18px ${UI_SUITE.font.family}`;
  ctx.fillText(menu.title || menu.id, x + 16, y + 48);
  let rowY = y + 68;
  visible.forEach((item, visibleIndex) => {
    const index = nextScroll + visibleIndex;
    const active = index === selectedIndex;
    ctx.fillStyle = active ? 'rgba(255,225,106,0.28)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 12, rowY, panelW - 24, rowH);
    ctx.strokeStyle = active ? UI_SUITE.colors.accent : 'rgba(255,255,255,0.18)';
    ctx.strokeRect(x + 12, rowY, panelW - 24, rowH);
    ctx.fillStyle = item.disabled ? 'rgba(255,255,255,0.45)' : UI_SUITE.colors.text;
    ctx.font = `14px ${UI_SUITE.font.family}`;
    ctx.fillText(`${item.submenu ? '> ' : ''}${item.label}`, x + 26, rowY + 26);
    rowY += rowH + gap;
  });
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = `11px ${UI_SUITE.font.family}`;
  ctx.fillText('LS/D-pad Move   A Select   B Back   LB/RB Tabs   Start System', x + 16, y + panelH - 15);
  ctx.restore();
  return { x, y, w: panelW, h: panelH };
}

export function renderDomControllerMenu(menuStack, { contextLabel = 'Editor' } = {}) {
  if (!menuStack?.active) return null;
  const menu = menuStack.getActiveMenu();
  if (!menu) return null;
  if (menuStack.stack?.[0] !== menuStack.systemId && !menu.modal) return null;
  const root = document.createElement('div');
  root.className = 'controller-menu-overlay';
  const panel = document.createElement('div');
  panel.className = 'controller-menu-panel';
  const eyebrow = document.createElement('div');
  eyebrow.className = 'controller-menu-context';
  eyebrow.textContent = contextLabel;
  const title = document.createElement('div');
  title.className = 'controller-menu-title';
  title.textContent = menu.title || menu.id;
  panel.append(eyebrow, title);
  const items = menuStack.getItems(menu);
  const selected = menuStack.selected[menuStack.getActiveMenuId()] ?? 0;
  items.forEach((item, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `controller-menu-row${index === selected ? ' active' : ''}`;
    row.disabled = Boolean(item.disabled);
    row.textContent = `${item.submenu ? '> ' : ''}${item.label}`;
    panel.appendChild(row);
  });
  const prompts = document.createElement('div');
  prompts.className = 'controller-menu-prompts';
  prompts.textContent = 'LS/D-pad Move   A Select   B Back   LB/RB Tabs   Start System';
  panel.appendChild(prompts);
  root.appendChild(panel);
  return root;
}
