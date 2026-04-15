import { openProjectBrowser } from './ProjectBrowserModal.js';
import { vfsEnsureIndex, vfsLoad, vfsSave } from './vfs.js';
import { ACTOR_ATTACK_TARGETS, ACTION_TYPES, CONDITION_TYPES, createDefaultActor, createDefaultState, ensureActorDefinition, LOOT_ITEM_OPTIONS, MOVEMENT_BEHAVIORS, MOVEMENT_PRESET_TEMPLATES } from '../content/actorEditorData.js';
import { getSharedMobileRailWidth, SHARED_EDITOR_LEFT_MENU, UI_SUITE } from './uiSuite.js';

const ACTOR_FOLDER = 'actors';
const clone = (value) => JSON.parse(JSON.stringify(value));
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const toTitleLabel = (value) => String(value || '').split('-').map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '').join(' ');
const STATE_OPTION_TYPE = 'state-option';
const LOOT_OPTION_TYPE = 'loot-option';
const PLAYER_INPUT_OPTIONS = [
  { id: 'attack', label: 'Attack' },
  { id: 'jump', label: 'Jump' },
  { id: 'action', label: 'Action' },
  { id: 'down', label: 'Down' }
];
const CONDITION_SPECS = {
  always: { label: 'Always', fields: [] },
  'timer-elapsed': { label: 'After X milliseconds', fields: [{ key: 'seconds', label: 'Milliseconds', type: 'number', min: 0, step: 10, defaultValue: 1000, toDisplay: (v) => Math.round(Number(v || 0) * 1000), fromDisplay: (v) => Number(v || 0) / 1000 }] },
  'actor-health-below': { label: 'My health is below', fields: [{ key: 'ratio', label: 'Health %', type: 'number', min: 0, max: 100, step: 1, defaultValue: 50, toDisplay: (v) => Math.round(Number(v ?? 0.5) * 100), fromDisplay: (v) => Number(v || 0) / 100 }] },
  'player-health-below': { label: 'Player health is below', fields: [{ key: 'ratio', label: 'Health %', type: 'number', min: 0, max: 100, step: 1, defaultValue: 50, toDisplay: (v) => Math.round(Number(v ?? 0.5) * 100), fromDisplay: (v) => Number(v || 0) / 100 }] },
  'can-see-player': { label: 'Can see player', fields: [] },
  'cannot-see-player': { label: 'Cannot see player', fields: [] },
  'player-within': { label: 'Player within distance', fields: [{ key: 'distance', label: 'Distance (px)', type: 'number', min: 0, step: 1, defaultValue: 160 }] },
  'player-farther-than': { label: 'Player farther than distance', fields: [{ key: 'distance', label: 'Distance (px)', type: 'number', min: 0, step: 1, defaultValue: 200 }] },
  'player-has-item': { label: 'Player has item', fields: [{ key: 'itemId', label: 'Item', type: LOOT_OPTION_TYPE, defaultValue: 'health' }] },
  'player-presses-action': { label: 'Player presses button', fields: [{ key: 'action', label: 'Button', type: 'select', options: PLAYER_INPUT_OPTIONS, defaultValue: 'action' }] },
  'touched-wall': { label: 'Touched wall', fields: [] },
  'touched-floor': { label: 'Touched floor', fields: [] },
  'touched-ceiling': { label: 'Touched ceiling', fields: [] },
  'took-damage': { label: 'Took damage', fields: [] },
  'random-chance': { label: 'Random chance succeeds', fields: [{ key: 'chance', label: 'Chance %', type: 'number', min: 0, max: 100, step: 1, defaultValue: 25, toDisplay: (v) => Math.round(Number(v || 0) * 100), fromDisplay: (v) => Number(v || 0) / 100 }] },
  'cooldown-ready': { label: 'Cooldown is ready', fields: [{ key: 'key', label: 'Cooldown key', type: 'text', defaultValue: 'default' }] },
  'linked-part-destroyed': { label: 'Linked part destroyed', fields: [{ key: 'partId', label: 'Part ID / Role', type: 'text', defaultValue: '' }] },
  'root-entered-state': { label: 'Root entered state', fields: [{ key: 'stateId', label: 'State', type: STATE_OPTION_TYPE, defaultValue: '' }] },
  'child-entered-state': { label: 'Child entered state', fields: [{ key: 'stateId', label: 'State', type: STATE_OPTION_TYPE, defaultValue: '' }] }
};
const ACTION_SPECS = {
  'switch-state': { label: 'Switch to state', fields: [{ key: 'stateId', label: 'State', type: STATE_OPTION_TYPE, defaultValue: '' }] },
  'reverse-direction': { label: 'Reverse direction', fields: [] },
  'set-velocity': { label: 'Set velocity', fields: [{ key: 'vx', label: 'X speed', type: 'number', step: 1, defaultValue: 0 }, { key: 'vy', label: 'Y speed', type: 'number', step: 1, defaultValue: 0 }] },
  jump: { label: 'Jump', fields: [{ key: 'speed', label: 'Jump speed', type: 'number', min: 0, step: 1, defaultValue: 220 }] },
  'stop-moving': { label: 'Stop moving', fields: [] },
  'emit-damage': { label: 'Emit area damage', fields: [{ key: 'amount', label: 'Damage amount', type: 'number', min: 0, step: 1, defaultValue: 1 }, { key: 'radius', label: 'Radius (px)', type: 'number', min: 0, step: 1, defaultValue: 32 }] },
  'spawn-bullets': { label: 'Spawn bullet', fields: [{ key: 'aimAtPlayer', label: 'Aim at player', type: 'checkbox', defaultValue: true }, { key: 'angle', label: 'Angle (degrees)', type: 'number', step: 1, defaultValue: 0, toDisplay: (v) => Math.round(Number(v || 0) * (180 / Math.PI)), fromDisplay: (v) => Number(v || 0) * (Math.PI / 180) }, { key: 'speed', label: 'Bullet speed', type: 'number', min: 0, step: 1, defaultValue: 220 }] },
  'spawn-actor': { label: 'Spawn actor', fields: [{ key: 'actorId', label: 'Actor ID', type: 'text', defaultValue: '' }, { key: 'offsetX', label: 'Offset X', type: 'number', step: 1, defaultValue: 0 }, { key: 'offsetY', label: 'Offset Y', type: 'number', step: 1, defaultValue: 0 }] },
  'delete-actor': { label: 'Delete actor', fields: [] },
  'play-sound': { label: 'Play sound', fields: [{ key: 'soundId', label: 'Sound ID', type: 'text', defaultValue: '' }] },
  'play-fx': { label: 'Play FX', fields: [{ key: 'fxId', label: 'FX ID', type: 'text', defaultValue: '' }] },
  'become-invulnerable': { label: 'Become invulnerable', fields: [] },
  'become-vulnerable': { label: 'Become vulnerable', fields: [] },
  'enable-body-damage': { label: 'Enable body damage', fields: [] },
  'disable-body-damage': { label: 'Disable body damage', fields: [] },
  'drop-loot': { label: 'Drop loot', fields: [{ key: 'itemId', label: 'Item', type: LOOT_OPTION_TYPE, defaultValue: 'loot' }, { key: 'chance', label: 'Chance %', type: 'number', min: 0, max: 100, step: 1, defaultValue: 100, toDisplay: (v) => Math.round(Number(v || 0) * 100), fromDisplay: (v) => Number(v || 0) / 100 }] },
  'face-player': { label: 'Face player', fields: [] },
  'signal-root': { label: 'Signal root actor', fields: [{ key: 'signal', label: 'Signal name', type: 'text', defaultValue: '' }] },
  'signal-children': { label: 'Signal child actors', fields: [{ key: 'signal', label: 'Signal name', type: 'text', defaultValue: '' }] },
  'destroy-linked-part': { label: 'Destroy linked part', fields: [{ key: 'partId', label: 'Part ID / Role', type: 'text', defaultValue: '' }] },
  'open-weak-point': { label: 'Open weak point', fields: [{ key: 'weakPointId', label: 'Weak point ID', type: 'text', defaultValue: '' }] },
  'close-weak-point': { label: 'Close weak point', fields: [{ key: 'weakPointId', label: 'Weak point ID', type: 'text', defaultValue: '' }] }
};

export default class ActorEditor {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.actor = ensureActorDefinition(createDefaultActor());
    this.currentDocumentRef = null;
    this.selectedStateId = this.actor.initialStateId;
    this.stateClipboard = null;
    this.overlay = null;
    this.partRefreshToken = 0;
    this.previewTimers = [];
    this.activeMenuSection = 'states';
    this.fileMenuOpen = false;
  }

  captureFocusedInputState() {
    const active = document.activeElement;
    if (!this.overlay || !active || !this.overlay.contains(active)) return null;
    const tag = active.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') return null;
    const path = [];
    let node = active;
    while (node && node !== this.overlay) {
      const parent = node.parentElement;
      if (!parent) return null;
      path.unshift(Array.prototype.indexOf.call(parent.children, node));
      node = parent;
    }
    return {
      path,
      selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null
    };
  }

  restoreFocusedInputState(focusState) {
    if (!focusState || !this.overlay) return;
    let node = this.overlay;
    for (const index of focusState.path) {
      node = node?.children?.[index] || null;
      if (!node) return;
    }
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) return;
    node.focus();
    if (typeof focusState.selectionStart === 'number' && typeof focusState.selectionEnd === 'number') {
      const maxSelection = String(node.value || '').length;
      const start = Math.min(focusState.selectionStart, maxSelection);
      const end = Math.min(focusState.selectionEnd, maxSelection);
      node.setSelectionRange(start, end);
    }
  }

  getConditionSpec(type) {
    return CONDITION_SPECS[type] || { label: toTitleLabel(type), fields: [] };
  }

  getActionSpec(type) {
    return ACTION_SPECS[type] || { label: toTitleLabel(type), fields: [] };
  }

  createParamsFromSpec(spec, stateOptions = []) {
    const params = {};
    (spec?.fields || []).forEach((field) => {
      if (field.type === STATE_OPTION_TYPE) {
        params[field.key] = field.defaultValue || stateOptions[0]?.id || '';
        return;
      }
      params[field.key] = field.defaultValue ?? '';
    });
    return params;
  }

  renderParamFields({ fields, params, onParamInput, stateOptions }) {
    const wrap = el('div', 'actor-editor-inline-actions');
    (fields || []).forEach((field) => {
      const fieldWrap = el('label', 'actor-editor-field');
      fieldWrap.appendChild(el('span', 'actor-editor-field-label', field.label));
      let input = null;
      if (field.type === 'checkbox') {
        input = el('input');
        input.type = 'checkbox';
        input.checked = !!params?.[field.key];
        input.oninput = (event) => onParamInput(field, event.target.checked);
      } else if (field.type === 'select' || field.type === STATE_OPTION_TYPE || field.type === LOOT_OPTION_TYPE) {
        input = el('select');
        const options = field.type === STATE_OPTION_TYPE
          ? stateOptions
          : field.type === LOOT_OPTION_TYPE
            ? LOOT_ITEM_OPTIONS
            : (field.options || []);
        options.forEach((option) => {
          const node = el('option');
          node.value = option.id;
          node.textContent = option.label || option.id;
          input.appendChild(node);
        });
        const selected = params?.[field.key] ?? field.defaultValue ?? options[0]?.id ?? '';
        input.value = selected;
        input.oninput = (event) => onParamInput(field, event.target.value);
      } else {
        input = el('input');
        if (field.type === 'number') {
          input.type = 'number';
          if (field.min != null) input.min = String(field.min);
          if (field.max != null) input.max = String(field.max);
          if (field.step != null) input.step = String(field.step);
        } else {
          input.type = 'text';
        }
        const storedValue = params?.[field.key];
        const displayValue = field.toDisplay ? field.toDisplay(storedValue) : (storedValue ?? field.defaultValue ?? '');
        input.value = displayValue;
        input.oninput = (event) => {
          const raw = field.type === 'number' ? Number(event.target.value || 0) : event.target.value;
          onParamInput(field, raw);
        };
      }
      fieldWrap.appendChild(input);
      wrap.appendChild(fieldWrap);
    });
    return wrap;
  }

  activate() {
    this.active = true;
    this.mount();
  }

  clearPreviewTimers() {
    this.previewTimers.forEach((timer) => clearInterval(timer));
    this.previewTimers = [];
  }

  deactivate() {
    this.active = false;
    this.clearPreviewTimers();
    this.overlay?.remove();
    this.overlay = null;
  }

  update() {}
  draw() {}
  resetTransientInteractionState() {}

  mount() {
    if (this.overlay) this.overlay.remove();
    vfsEnsureIndex();
    const root = document.getElementById('global-overlay-root') || document.body;
    const overlay = el('div', 'actor-editor-overlay');
    overlay.innerHTML = '';
    this.overlay = overlay;
    root.appendChild(overlay);
    this.render();
  }

  ensureStateSelection() {
    if (!this.actor.states.some((state) => state.id === this.selectedStateId)) {
      this.selectedStateId = this.actor.states[0]?.id || null;
    }
  }

  get selectedState() {
    this.ensureStateSelection();
    return this.actor.states.find((state) => state.id === this.selectedStateId) || this.actor.states[0];
  }

  setActor(next) {
    this.actor = ensureActorDefinition(next);
    this.game.registerRuntimeActorDefinition?.(this.actor);
    this.ensureStateSelection();
    this.render();
  }

  async newActor() {
    this.currentDocumentRef = null;
    this.setActor(createDefaultActor());
  }

  async openActor() {
    await openProjectBrowser({
      fixedFolder: ACTOR_FOLDER,
      initialFolder: ACTOR_FOLDER,
      title: 'Open Actor',
      onOpen: ({ payload, name }) => {
        this.currentDocumentRef = { folder: ACTOR_FOLDER, name };
        this.setActor(ensureActorDefinition(payload?.data || createDefaultActor(name)));
      }
    });
  }

  async saveActor(forceSaveAs = false) {
    const fallback = this.currentDocumentRef?.name || `${this.actor.name || 'actor'}.json`;
    const name = forceSaveAs
      ? (window.prompt('Save actor as', fallback) || '').trim()
      : fallback;
    if (!name) return;
    const payload = ensureActorDefinition(this.actor);
    vfsSave(ACTOR_FOLDER, name, payload);
    this.currentDocumentRef = { folder: ACTOR_FOLDER, name };
    this.game.showSystemToast?.('Saved changes');
    this.render();
  }

  exitToMenu() {
    this.deactivate();
    this.game.transitionTo('title', { forceCleanup: true });
  }

  playtestActor() {
    const normalized = ensureActorDefinition(this.actor);
    this.game.registerRuntimeActorDefinition?.(normalized);
    this.game.startActorEditorPlaytest(normalized.id, normalized);
  }

  openStateAnimation(state) {
    this.game.enterPixelStudio({ returnState: 'actor-editor', resetFocus: false });
    this.game.pixelStudio.loadActorStateImageForEditing({
      actorId: this.actor.id,
      stateId: state.id,
      animation: state.animation || {},
      onCommit: (animation) => {
        const next = clone(this.actor);
        const target = next.states.find((entry) => entry.id === state.id);
        if (!target) return;
        target.animation = { ...animation, updatedAt: Date.now() };
        this.actor = ensureActorDefinition(next);
        this.render();
      }
    }).catch((error) => console.warn('Failed to open actor animation in Pixel Studio', error));
  }

  addState() {
    const copy = clone(this.actor);
    const next = createDefaultState(`State ${copy.states.length + 1}`);
    copy.states.push(next);
    this.selectedStateId = next.id;
    this.setActor(copy);
  }

  duplicateState(state) {
    const copy = clone(this.actor);
    const next = clone(state);
    next.id = `${state.id}-${copy.states.length + 1}`;
    next.name = `${state.name} Copy`;
    copy.states.push(next);
    this.selectedStateId = next.id;
    this.setActor(copy);
  }

  deleteState(state) {
    if (this.actor.states.length <= 1) return;
    const copy = clone(this.actor);
    copy.states = copy.states.filter((entry) => entry.id !== state.id);
    if (copy.initialStateId === state.id) copy.initialStateId = copy.states[0].id;
    this.selectedStateId = copy.states[0].id;
    this.setActor(copy);
  }

  moveState(state, direction) {
    const copy = clone(this.actor);
    const index = copy.states.findIndex((entry) => entry.id === state.id);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= copy.states.length) return;
    const [item] = copy.states.splice(index, 1);
    copy.states.splice(nextIndex, 0, item);
    this.setActor(copy);
  }

  copyState(state) { this.stateClipboard = clone(state); }
  pasteState() {
    if (!this.stateClipboard) return;
    const copy = clone(this.actor);
    const next = clone(this.stateClipboard);
    next.id = `${next.id}-${Date.now().toString(36)}`;
    next.name = `${next.name} Paste`;
    copy.states.push(next);
    this.selectedStateId = next.id;
    this.setActor(copy);
  }

  updateSelectedState(mutator) {
    const copy = clone(this.actor);
    const state = copy.states.find((entry) => entry.id === this.selectedStateId);
    if (!state) return;
    mutator(state, copy);
    this.setActor(copy);
  }

  render() {
    if (!this.overlay) return;
    const focusState = this.captureFocusedInputState();
    this.clearPreviewTimers();
    this.ensureStateSelection();
    const actor = this.actor;
    const state = this.selectedState;
    this.overlay.innerHTML = '';
    const shell = el('div', 'actor-editor-shell');
    this.overlay.appendChild(shell);

    const body = el('div', 'actor-editor-body');
    shell.appendChild(body);
    const left = el('div', 'actor-editor-left');
    const center = el('div', 'actor-editor-center');
    const rightRail = el('div', 'actor-editor-right-rail');
    body.append(left, center, rightRail);
    const viewportW = Number(window.innerWidth || 0);
    const viewportH = Number(window.innerHeight || 0);
    const isMobileViewport = Math.min(viewportW, viewportH) <= 900;
    const railWidth = isMobileViewport
      ? getSharedMobileRailWidth(viewportW, viewportH)
      : SHARED_EDITOR_LEFT_MENU.width();
    shell.style.display = 'flex';
    shell.style.flexDirection = 'column';
    shell.style.height = '100%';
    body.style.display = 'flex';
    body.style.gap = `${SHARED_EDITOR_LEFT_MENU.desktopContentGap}px`;
    body.style.flex = '1';
    body.style.minHeight = '0';
    left.style.width = `${railWidth}px`;
    left.style.flex = `0 0 ${railWidth}px`;
    left.style.display = 'flex';
    left.style.flexDirection = 'column';
    left.style.gap = `${UI_SUITE.spacing.gap}px`;
    left.style.overflow = 'visible';
    left.style.zIndex = '2';
    center.style.flex = '1';
    center.style.minWidth = '0';
    center.style.overflow = 'auto';
    rightRail.style.width = `${railWidth}px`;
    rightRail.style.flex = `0 0 ${railWidth}px`;
    rightRail.style.display = 'flex';
    rightRail.style.flexDirection = 'column';
    rightRail.style.gap = `${UI_SUITE.spacing.gap}px`;

    left.appendChild(this.renderSidebarMenu());
    center.appendChild(this.renderMainPanel(actor, state));
    rightRail.appendChild(this.renderRightRail());
    this.restoreFocusedInputState(focusState);
  }

  renderSidebarMenu() {
    const menu = el('div', 'actor-editor-menu-rail');
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    menu.style.gap = '6px';
    menu.style.background = 'rgba(4, 10, 22, 0.92)';
    menu.style.border = '1px solid rgba(255,255,255,0.18)';
    menu.style.padding = '8px';
    menu.style.height = '100%';
    const makeMenuBtn = (label, id, onClick) => {
      const btn = el('button', `actor-editor-btn${this.activeMenuSection === id ? ' active' : ''}`, label);
      this.styleRailButton(btn, this.activeMenuSection === id);
      btn.onclick = onClick || (() => {
        this.activeMenuSection = id;
        this.fileMenuOpen = false;
        this.render();
      });
      return btn;
    };
    const fileBtn = el('button', `actor-editor-btn${this.fileMenuOpen ? ' active' : ''}`, 'File');
    this.styleRailButton(fileBtn, this.fileMenuOpen);
    fileBtn.onclick = () => {
      this.fileMenuOpen = !this.fileMenuOpen;
      this.render();
    };
    menu.appendChild(fileBtn);
    menu.appendChild(makeMenuBtn('Actor', 'actor'));
    menu.appendChild(makeMenuBtn('States', 'states'));
    menu.appendChild(makeMenuBtn('Linked Parts', 'linked-parts'));
    return menu;
  }

  renderFileMenuRail() {
    const subRail = el('div', 'actor-editor-file-subrail');
    subRail.style.background = 'rgba(4, 10, 22, 0.96)';
    subRail.style.border = '1px solid rgba(255,255,255,0.18)';
    subRail.style.padding = '8px';
    subRail.style.display = 'flex';
    subRail.style.flexDirection = 'column';
    subRail.style.gap = '6px';
    [
      ['New', () => this.newActor()],
      ['Open', () => this.openActor()],
      ['Save', () => this.saveActor(false)],
      ['Save As', () => this.saveActor(true)],
      ['Play Test', () => this.playtestActor()],
      ['Exit', () => this.exitToMenu()]
    ].forEach(([label, handler]) => {
      const btn = el('button', 'actor-editor-btn', label);
      this.styleRailButton(btn, false);
      btn.onclick = handler;
      subRail.appendChild(btn);
    });
    return subRail;
  }

  renderRightRail() {
    if (this.fileMenuOpen) return this.renderFileMenuRail();
    if (this.activeMenuSection === 'states') return this.renderStateRailSection();
    const rail = el('div', 'actor-editor-menu-rail');
    rail.style.background = 'rgba(4, 10, 22, 0.92)';
    rail.style.border = '1px solid rgba(255,255,255,0.18)';
    rail.style.padding = '8px';
    rail.style.minHeight = '120px';
    return rail;
  }

  styleRailButton(btn, active = false) {
    btn.style.display = 'block';
    btn.style.width = '100%';
    btn.style.textAlign = 'left';
    btn.style.borderRadius = '0';
    btn.style.border = '1px solid rgba(255,255,255,0.2)';
    btn.style.padding = '10px 12px';
    btn.style.background = active ? 'rgba(176, 156, 83, 0.9)' : 'rgba(56, 64, 78, 0.85)';
    btn.style.color = active ? '#101114' : '#f2f4f8';
  }

  renderStateRailSection() {
    const wrap = el('div', 'actor-editor-list');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '6px';
    const controls = el('div', 'actor-editor-inline-actions');
    controls.style.display = 'flex';
    controls.style.flexDirection = 'column';
    controls.style.gap = '6px';
    [['Add', () => this.addState()], ['Paste', () => this.pasteState()]].forEach(([label, handler]) => {
      const btn = el('button', 'actor-editor-btn small', label);
      this.styleRailButton(btn, false);
      btn.onclick = handler;
      controls.appendChild(btn);
    });
    wrap.appendChild(controls);
    this.actor.states.forEach((state) => {
      const btn = el('button', `actor-editor-btn small${this.selectedStateId === state.id ? ' active' : ''}`, state.name || state.id);
      this.styleRailButton(btn, this.selectedStateId === state.id);
      btn.onclick = () => {
        this.selectedStateId = state.id;
        this.render();
      };
      wrap.appendChild(btn);
    });
    return wrap;
  }

  renderMainPanel(actor, state) {
    const wrap = el('div', 'actor-editor-main-panel');
    if (this.activeMenuSection === 'actor') {
      wrap.appendChild(this.renderActorSettings(actor));
      return wrap;
    }
    if (this.activeMenuSection === 'linked-parts') {
      wrap.appendChild(this.renderLinkedParts(actor));
      return wrap;
    }
    wrap.appendChild(this.renderStateEditor(state));
    return wrap;
  }

  renderActorSettings(actor) {
    const section = el('section', 'actor-editor-card');
    section.appendChild(el('h2', '', '1. Actor-level settings'));
    const grid = el('div', 'actor-editor-grid');
    section.appendChild(grid);
    const addField = (label, input) => {
      const wrap = el('label', 'actor-editor-field');
      wrap.appendChild(el('span', 'actor-editor-field-label', label));
      wrap.appendChild(input);
      grid.appendChild(wrap);
    };
    const text = (value, onInput) => {
      const input = el('input'); input.value = value || ''; input.oninput = onInput; return input;
    };
    const checkbox = (checked, onInput, labelText = null) => {
      const wrap = el('label', 'actor-editor-toggle');
      const input = el('input'); input.type = 'checkbox'; input.checked = !!checked; input.oninput = onInput; wrap.appendChild(input); if (labelText) wrap.append(labelText); return wrap;
    };
    const select = (value, options, onInput) => {
      const input = el('select');
      options.forEach((option) => { const o = el('option'); o.value = option.id; o.textContent = option.label; if (option.id === value) o.selected = true; input.appendChild(o); });
      input.oninput = onInput; return input;
    };
    addField('Name', text(actor.name, (event) => this.setActor({ ...actor, name: event.target.value })));
    addField('Attack who', select(actor.attackTarget, ACTOR_ATTACK_TARGETS, (event) => this.setActor({ ...actor, attackTarget: event.target.value })));
    addField('Health', text(actor.health, (event) => this.setActor({ ...actor, health: Number(event.target.value || 0) || 1 })));
    addField('Gravity', checkbox(actor.gravity, (event) => this.setActor({ ...actor, gravity: event.target.checked }), 'On'));
    addField('Body contact damage', checkbox(actor.bodyDamageEnabled, (event) => this.setActor({ ...actor, bodyDamageEnabled: event.target.checked }), 'Enabled'));
    addField('Contact damage amount', text(actor.contactDamage, (event) => this.setActor({ ...actor, contactDamage: Number(event.target.value || 0) || 0 })));
    addField('Invulnerable by default', checkbox(actor.invulnerable, (event) => this.setActor({ ...actor, invulnerable: event.target.checked }), 'Enabled'));
    addField('Destructible', checkbox(actor.destructible, (event) => this.setActor({ ...actor, destructible: event.target.checked }), 'Enabled'));
    addField('Root actor', checkbox(actor.isRoot, (event) => this.setActor({ ...actor, isRoot: event.target.checked }), 'Placeable in Level Editor'));
    addField('Size (w × h)', text(`${actor.size.width} × ${actor.size.height}`, (event) => {
      const [width, height] = String(event.target.value).split('x').map((part) => Number.parseInt(part, 10));
      this.setActor({ ...actor, size: { width: width || actor.size.width, height: height || actor.size.height } });
    }));

    const lootSection = el('div', 'actor-editor-subsection');
    lootSection.appendChild(el('h3', '', 'Loot on death'));
    const lootList = el('div', 'actor-editor-list');
    actor.loot.forEach((loot, index) => {
      const row = el('div', 'actor-editor-list-row');
      const itemSelect = select(loot.itemId, LOOT_ITEM_OPTIONS, (event) => {
        const next = clone(actor); next.loot[index].itemId = event.target.value; this.setActor(next);
      });
      const chance = text(loot.probability ?? 1, (event) => { const next = clone(actor); next.loot[index].probability = Number(event.target.value || 0) || 0; this.setActor(next); });
      const qty = text(`${loot.minQty ?? 1}-${loot.maxQty ?? 1}`, (event) => {
        const [minQty, maxQty] = String(event.target.value).split('-').map((part) => Number(part));
        const next = clone(actor); next.loot[index].minQty = minQty || 1; next.loot[index].maxQty = maxQty || next.loot[index].minQty; this.setActor(next);
      });
      const guaranteed = checkbox(loot.guaranteed, (event) => { const next = clone(actor); next.loot[index].guaranteed = event.target.checked; this.setActor(next); }, 'Guaranteed');
      const remove = el('button', 'actor-editor-btn small', 'Remove');
      remove.onclick = () => { const next = clone(actor); next.loot.splice(index, 1); this.setActor(next); };
      row.append(itemSelect, chance, qty, guaranteed, remove);
      lootList.appendChild(row);
    });
    const addLoot = el('button', 'actor-editor-btn', 'Add loot');
    addLoot.onclick = () => { const next = clone(actor); next.loot.push({ itemId: 'health', probability: 0.3, minQty: 1, maxQty: 1, guaranteed: false }); this.setActor(next); };
    lootSection.append(lootList, addLoot);
    section.appendChild(lootSection);

    const advanced = el('details', 'actor-editor-advanced');
    advanced.appendChild(el('summary', '', 'Advanced'));
    advanced.appendChild(el('div', 'actor-editor-note', `Internal ID auto-generated from name: ${actor.id}`));
    section.appendChild(advanced);
    return section;
  }


  buildStatePreviewButton(state, { large = false } = {}) {
    const preview = el('button', `actor-editor-preview${large ? ' large' : ''}`);
    preview.type = 'button';
    preview.onclick = (event) => {
      event.stopPropagation();
      this.openStateAnimation(state);
    };
    const frames = Array.isArray(state.animation?.frames) && state.animation.frames.length
      ? state.animation.frames.filter((frame) => frame?.imageDataUrl)
      : (state.animation?.imageDataUrl ? [{ imageDataUrl: state.animation.imageDataUrl, durationMs: Math.round(1000 / Math.max(1, Number(state.animation?.fps || 8))) }] : []);
    if (frames.length) {
      const image = el('img', 'actor-editor-preview-image');
      image.src = frames[0].imageDataUrl;
      image.alt = `${state.name} preview`;
      preview.appendChild(image);
      if (frames.length > 1) {
        let frameIndex = 0;
        const timer = setInterval(() => {
          frameIndex = (frameIndex + 1) % frames.length;
          image.src = frames[frameIndex].imageDataUrl;
        }, Math.max(80, Number(frames[0].durationMs || Math.round(1000 / Math.max(1, Number(state.animation?.fps || 8))))));
        this.previewTimers.push(timer);
      }
      const label = el('span', 'actor-editor-preview-label', large ? 'Edit animation in Pixel Editor' : `${frames.length}f`);
      preview.appendChild(label);
    } else {
      preview.textContent = large ? 'Create animation in Pixel Editor' : 'Draw';
    }
    return preview;
  }

  renderStateList(actor) {
    const section = el('section', 'actor-editor-card');
    section.appendChild(el('h2', '', '2. States'));
    const controls = el('div', 'actor-editor-toolbar');
    [['Add state', () => this.addState()], ['Paste state', () => this.pasteState()]].forEach(([label, handler]) => {
      const btn = el('button', 'actor-editor-btn', label); btn.onclick = handler; controls.appendChild(btn);
    });
    section.appendChild(controls);
    const list = el('div', 'actor-editor-state-list');
    actor.states.forEach((state, index) => {
      const row = el('div', `actor-editor-state-row${this.selectedStateId === state.id ? ' active' : ''}`);
      row.onclick = () => { this.selectedStateId = state.id; this.render(); };
      const preview = this.buildStatePreviewButton(state);
      const meta = el('div', 'actor-editor-state-meta');
      meta.append(el('strong', '', state.name), el('span', '', `${state.movement.type} • ${(state.transitions || []).length} transition(s)`));
      const rowBtns = el('div', 'actor-editor-inline-actions');
      [['↑', () => this.moveState(state, -1)], ['↓', () => this.moveState(state, 1)], ['Copy', () => this.copyState(state)], ['Duplicate', () => this.duplicateState(state)], ['Delete', () => this.deleteState(state)]].forEach(([label, handler]) => {
        const btn = el('button', 'actor-editor-btn small', label); btn.onclick = (event) => { event.stopPropagation(); handler(); }; rowBtns.appendChild(btn);
      });
      row.append(preview, meta, rowBtns);
      list.appendChild(row);
      if (index === 0) row.dataset.initial = 'true';
    });
    section.appendChild(list);
    return section;
  }

  renderStateEditor(state) {
    const section = el('section', 'actor-editor-card');
    section.appendChild(el('h2', '', '3–6. State editor / conditions / actions / animation'));
    if (!state) return section;
    const name = el('input'); name.value = state.name; name.oninput = (event) => this.updateSelectedState((draft) => { draft.name = event.target.value; });
    section.appendChild(name);
    section.appendChild(this.buildStatePreviewButton(state, { large: true }));

    const movementWrap = el('div', 'actor-editor-subsection');
    movementWrap.appendChild(el('h3', '', 'Movement behavior'));
    const movementSelect = el('select');
    MOVEMENT_BEHAVIORS.forEach((behavior) => { const option = el('option'); option.value = behavior.id; option.textContent = behavior.label; if (behavior.id === state.movement.type) option.selected = true; movementSelect.appendChild(option); });
    movementSelect.oninput = (event) => this.updateSelectedState((draft) => { draft.movement.type = event.target.value; draft.movement.params = { ...(MOVEMENT_PRESET_TEMPLATES[event.target.value] || {}) }; });
    movementWrap.appendChild(movementSelect);
    const behavior = MOVEMENT_BEHAVIORS.find((entry) => entry.id === state.movement.type) || MOVEMENT_BEHAVIORS[0];
    const behaviorParams = Array.isArray(behavior?.params) ? behavior.params : [];
    movementWrap.appendChild(el('div', 'actor-editor-note', behavior.description));
    behaviorParams.forEach((param) => {
      const field = el('label', 'actor-editor-field');
      field.appendChild(el('span', 'actor-editor-field-label', param));
      const input = el('input'); input.value = state.movement.params?.[param] ?? ''; input.oninput = (event) => this.updateSelectedState((draft) => { draft.movement.params[param] = event.target.value === 'true' ? true : event.target.value === 'false' ? false : (Number(event.target.value) || event.target.value); });
      field.appendChild(input); movementWrap.appendChild(field);
    });
    section.appendChild(movementWrap);

    const overrides = el('div', 'actor-editor-subsection');
    overrides.appendChild(el('h3', '', 'State overrides'));
    ['bodyDamageEnabled', 'contactDamage', 'invulnerable'].forEach((key) => {
      const field = el('label', 'actor-editor-field');
      field.appendChild(el('span', 'actor-editor-field-label', key));
      const input = el('input'); input.value = state.overrides?.[key] ?? ''; input.placeholder = 'inherit'; input.oninput = (event) => this.updateSelectedState((draft) => { draft.overrides[key] = event.target.value === '' ? null : (Number(event.target.value) || event.target.value === 'true' ? true : event.target.value === 'false' ? false : event.target.value); });
      field.appendChild(input); overrides.appendChild(field);
    });
    section.appendChild(overrides);

    section.appendChild(this.renderTransitionEditor(state));
    return section;
  }

  renderTransitionEditor(state) {
    const section = el('div', 'actor-editor-subsection');
    const stateOptions = this.actor.states.map((entry) => ({ id: entry.id, label: entry.name || entry.id }));
    section.appendChild(el('h3', '', 'Transitions (edges)'));
    section.appendChild(el('div', 'actor-editor-note', 'Transitions are checked top-to-bottom. The first matching transition runs.'));
    const list = el('div', 'actor-editor-list');
    state.transitions.forEach((transition, transitionIndex) => {
      const card = el('div', 'actor-editor-subsection');
      const heading = el('h3', '', `Transition ${transitionIndex + 1}`);
      const name = el('input');
      name.value = transition.name || '';
      name.placeholder = `Transition ${transitionIndex + 1}`;
      name.oninput = (event) => this.updateSelectedState((draft) => {
        draft.transitions[transitionIndex].name = event.target.value;
      });
      const toolbar = el('div', 'actor-editor-inline-actions');
      [['↑', () => this.moveTransition(transitionIndex, -1)], ['↓', () => this.moveTransition(transitionIndex, 1)], ['Remove', () => this.removeTransition(transitionIndex)]].forEach(([label, handler]) => {
        const btn = el('button', 'actor-editor-btn small', label);
        btn.onclick = handler;
        toolbar.appendChild(btn);
      });
      const mode = el('select');
      ['all', 'any'].forEach((entry) => {
        const option = el('option');
        option.value = entry;
        option.textContent = entry.toUpperCase();
        if (entry === transition.conditionMode) option.selected = true;
        mode.appendChild(option);
      });
      mode.oninput = (event) => this.updateSelectedState((draft) => {
        draft.transitions[transitionIndex].conditionMode = event.target.value;
      });
      card.append(heading, name, mode, toolbar);
      card.appendChild(this.renderConditionEditor(state, transitionIndex, stateOptions));
      card.appendChild(this.renderActionEditor(state, transitionIndex, stateOptions));
      list.appendChild(card);
    });
    const add = el('button', 'actor-editor-btn', 'Add transition');
    add.onclick = () => this.addTransition();
    section.append(list, add);
    return section;
  }

  renderConditionEditor(state, transitionIndex, stateOptions) {
    const section = el('div', 'actor-editor-subsection');
    section.appendChild(el('h3', '', 'Conditions'));
    const transition = state.transitions[transitionIndex];
    const list = el('div', 'actor-editor-list');
    transition.conditions.forEach((condition, index) => {
      const row = el('div', 'actor-editor-list-row');
      const spec = this.getConditionSpec(condition.type);
      const type = el('select');
      CONDITION_TYPES.forEach((entry) => {
        const option = el('option');
        option.value = entry;
        option.textContent = this.getConditionSpec(entry).label;
        if (entry === condition.type) option.selected = true;
        type.appendChild(option);
      });
      type.oninput = (event) => this.updateSelectedState((draft) => {
        const nextType = event.target.value;
        draft.transitions[transitionIndex].conditions[index].type = nextType;
        draft.transitions[transitionIndex].conditions[index].params = this.createParamsFromSpec(this.getConditionSpec(nextType), stateOptions);
      });
      const params = this.renderParamFields({
        fields: spec.fields,
        params: condition.params || {},
        stateOptions,
        onParamInput: (field, value) => this.updateSelectedState((draft) => {
          const nextValue = field.fromDisplay ? field.fromDisplay(value) : value;
          draft.transitions[transitionIndex].conditions[index].params = draft.transitions[transitionIndex].conditions[index].params || {};
          draft.transitions[transitionIndex].conditions[index].params[field.key] = nextValue;
        })
      });
      const remove = el('button', 'actor-editor-btn small', 'Remove');
      remove.onclick = () => this.updateSelectedState((draft) => {
        draft.transitions[transitionIndex].conditions.splice(index, 1);
        if (!draft.transitions[transitionIndex].conditions.length) draft.transitions[transitionIndex].conditions.push({ id: 'always', type: 'always', params: {} });
      });
      row.append(type, params, remove); list.appendChild(row);
    });
    const add = el('button', 'actor-editor-btn', 'Add condition');
    add.onclick = () => this.updateSelectedState((draft) => {
      draft.transitions[transitionIndex].conditions.push({ id: `cond-${Date.now()}`, type: 'timer-elapsed', params: this.createParamsFromSpec(this.getConditionSpec('timer-elapsed'), stateOptions) });
    });
    section.append(list, add);
    return section;
  }

  renderActionEditor(state, transitionIndex, stateOptions) {
    const section = el('div', 'actor-editor-subsection');
    section.appendChild(el('h3', '', 'Actions'));
    const transition = state.transitions[transitionIndex];
    const list = el('div', 'actor-editor-list');
    transition.actions.forEach((action, index) => {
      const row = el('div', 'actor-editor-list-row');
      const spec = this.getActionSpec(action.type);
      const type = el('select');
      ACTION_TYPES.forEach((entry) => {
        const option = el('option');
        option.value = entry;
        option.textContent = this.getActionSpec(entry).label;
        if (entry === action.type) option.selected = true;
        type.appendChild(option);
      });
      type.oninput = (event) => this.updateSelectedState((draft) => {
        const nextType = event.target.value;
        draft.transitions[transitionIndex].actions[index].type = nextType;
        draft.transitions[transitionIndex].actions[index].params = this.createParamsFromSpec(this.getActionSpec(nextType), stateOptions);
      });
      const params = this.renderParamFields({
        fields: spec.fields,
        params: action.params || {},
        stateOptions,
        onParamInput: (field, value) => this.updateSelectedState((draft) => {
          const nextValue = field.fromDisplay ? field.fromDisplay(value) : value;
          draft.transitions[transitionIndex].actions[index].params = draft.transitions[transitionIndex].actions[index].params || {};
          draft.transitions[transitionIndex].actions[index].params[field.key] = nextValue;
        })
      });
      const remove = el('button', 'actor-editor-btn small', 'Remove');
      remove.onclick = () => this.updateSelectedState((draft) => { draft.transitions[transitionIndex].actions.splice(index, 1); });
      row.append(type, params, remove); list.appendChild(row);
    });
    const add = el('button', 'actor-editor-btn', 'Add action'); add.onclick = () => this.updateSelectedState((draft, actorDraft) => {
      const actorStateOptions = actorDraft.states.map((entry) => ({ id: entry.id, label: entry.name || entry.id }));
      draft.transitions[transitionIndex].actions.push({ id: `action-${Date.now()}`, type: 'switch-state', params: this.createParamsFromSpec(this.getActionSpec('switch-state'), actorStateOptions) });
    });
    section.append(list, add);
    return section;
  }

  addTransition() {
    this.updateSelectedState((draft, actorDraft) => {
      const actorStateOptions = actorDraft.states.map((entry) => ({ id: entry.id, label: entry.name || entry.id }));
      const transitionIndex = draft.transitions.length + 1;
      draft.transitions.push({
        id: `transition-${Date.now()}`,
        name: `Transition ${transitionIndex}`,
        conditionMode: 'all',
        conditions: [{ id: `cond-${Date.now()}`, type: 'timer-elapsed', params: this.createParamsFromSpec(this.getConditionSpec('timer-elapsed'), actorStateOptions) }],
        actions: [{ id: `action-${Date.now()}`, type: 'switch-state', params: this.createParamsFromSpec(this.getActionSpec('switch-state'), actorStateOptions) }]
      });
    });
  }

  moveTransition(index, delta) {
    this.updateSelectedState((draft) => {
      const next = index + delta;
      if (next < 0 || next >= draft.transitions.length) return;
      const [entry] = draft.transitions.splice(index, 1);
      draft.transitions.splice(next, 0, entry);
    });
  }

  removeTransition(index) {
    this.updateSelectedState((draft, actorDraft) => {
      draft.transitions.splice(index, 1);
      if (draft.transitions.length) return;
      const actorStateOptions = actorDraft.states.map((entry) => ({ id: entry.id, label: entry.name || entry.id }));
      draft.transitions.push({
        id: `transition-${Date.now()}`,
        name: 'Transition 1',
        conditionMode: 'all',
        conditions: [{ id: 'always', type: 'always', params: {} }],
        actions: [{ id: `action-${Date.now()}`, type: 'switch-state', params: this.createParamsFromSpec(this.getActionSpec('switch-state'), actorStateOptions) }]
      });
    });
  }

  renderLinkedParts(actor) {
    const section = el('section', 'actor-editor-card');
    section.appendChild(el('h2', '', '7–9. Linked parts / multipart composition / Level Editor placement'));
    section.appendChild(el('div', 'actor-editor-note', 'Only root actors are placeable in Level Editor. Linked child parts spawn with the root.'));
    const list = el('div', 'actor-editor-list');
    actor.linkedParts.forEach((part, index) => {
      const row = el('div', 'actor-editor-list-row');
      row.append(el('strong', '', part.actorName || part.actorId), el('span', '', `offset ${part.offsetX || 0}, ${part.offsetY || 0} • role ${part.role || 'part'}`));
      const remove = el('button', 'actor-editor-btn small', 'Unlink');
      remove.onclick = () => { const next = clone(actor); next.linkedParts.splice(index, 1); this.setActor(next); };
      row.appendChild(remove);
      list.appendChild(row);
    });
    const add = el('button', 'actor-editor-btn', 'Link child actor');
    add.onclick = async () => {
      await openProjectBrowser({
        fixedFolder: ACTOR_FOLDER,
        initialFolder: ACTOR_FOLDER,
        title: 'Link child actor',
        onOpen: ({ payload, name }) => {
          const definition = ensureActorDefinition(payload?.data || createDefaultActor(name));
          const next = clone(actor);
          next.linkedParts.push({ actorId: definition.id, actorName: definition.name, offsetX: 0, offsetY: 0, role: 'part', sync: 'state' });
          this.setActor(next);
        }
      });
    };
    section.append(list, add);
    return section;
  }

}
