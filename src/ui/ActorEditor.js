import { openProjectBrowser } from './ProjectBrowserModal.js';
import { vfsEnsureIndex, vfsLoad, vfsSave } from './vfs.js';
import { ACTOR_ATTACK_TARGETS, ACTION_TYPES, CONDITION_TYPES, createDefaultActor, createDefaultState, ensureActorDefinition, getBehaviorPresetCatalog, LOOT_ITEM_OPTIONS, MOVEMENT_BEHAVIORS, MOVEMENT_PRESET_TEMPLATES } from '../content/actorEditorData.js';

const ACTOR_FOLDER = 'actors';
const clone = (value) => JSON.parse(JSON.stringify(value));
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
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
    this.game.showSystemToast?.(`Saved actor ${name}`);
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
    this.clearPreviewTimers();
    this.ensureStateSelection();
    const actor = this.actor;
    const state = this.selectedState;
    this.overlay.innerHTML = '';
    const shell = el('div', 'actor-editor-shell');
    this.overlay.appendChild(shell);

    const top = el('div', 'actor-editor-topbar');
    shell.appendChild(top);
    [['New', () => this.newActor()], ['Open', () => this.openActor()], ['Save', () => this.saveActor(false)], ['Save As', () => this.saveActor(true)], ['Playtest', () => this.playtestActor()], ['Back', () => this.exitToMenu()]].forEach(([label, handler]) => {
      const btn = el('button', 'actor-editor-btn', label);
      btn.onclick = handler;
      top.appendChild(btn);
    });
    const title = el('div', 'actor-editor-title');
    title.textContent = this.currentDocumentRef?.name ? `Actor Editor • ${this.currentDocumentRef.name}` : 'Actor Editor';
    top.appendChild(title);

    const body = el('div', 'actor-editor-body');
    shell.appendChild(body);
    const left = el('div', 'actor-editor-left');
    const right = el('div', 'actor-editor-right');
    body.append(left, right);

    left.appendChild(this.renderActorSettings(actor));
    left.appendChild(this.renderStateList(actor));
    left.appendChild(this.renderBehaviorAnalysis());

    right.appendChild(this.renderStateEditor(state));
    right.appendChild(this.renderLinkedParts(actor));
    right.appendChild(this.renderWorkflowCard());
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
      meta.append(el('strong', '', state.name), el('span', '', `${state.movement.type} • ${state.actions.length} action(s)`));
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

  renderBehaviorAnalysis() {
    const section = el('section', 'actor-editor-card');
    section.appendChild(el('h2', '', 'Repo behavior presets'));
    const list = el('div', 'actor-editor-list');
    getBehaviorPresetCatalog().forEach((preset) => {
      const row = el('div', 'actor-editor-list-row stack');
      row.append(el('strong', '', `${preset.label} (${preset.derivedFrom.join(', ')})`), el('span', '', preset.notes));
      list.appendChild(row);
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
    movementWrap.appendChild(el('div', 'actor-editor-note', behavior.description));
    behavior.params.forEach((param) => {
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

    section.appendChild(this.renderConditionEditor(state));
    section.appendChild(this.renderActionEditor(state));
    return section;
  }

  renderConditionEditor(state) {
    const section = el('div', 'actor-editor-subsection');
    section.appendChild(el('h3', '', 'Conditions'));
    const mode = el('select'); ['all', 'any'].forEach((entry) => { const option = el('option'); option.value = entry; option.textContent = entry.toUpperCase(); if (entry === state.conditionMode) option.selected = true; mode.appendChild(option); });
    mode.oninput = (event) => this.updateSelectedState((draft) => { draft.conditionMode = event.target.value; });
    section.appendChild(mode);
    const list = el('div', 'actor-editor-list');
    state.conditions.forEach((condition, index) => {
      const row = el('div', 'actor-editor-list-row');
      const type = el('select'); CONDITION_TYPES.forEach((entry) => { const option = el('option'); option.value = entry; option.textContent = entry; if (entry === condition.type) option.selected = true; type.appendChild(option); });
      type.oninput = (event) => this.updateSelectedState((draft) => { draft.conditions[index].type = event.target.value; });
      const params = el('input'); params.value = JSON.stringify(condition.params || {}); params.onchange = (event) => this.updateSelectedState((draft) => { try { draft.conditions[index].params = JSON.parse(event.target.value || '{}'); } catch { draft.conditions[index].params = { value: event.target.value }; } });
      const remove = el('button', 'actor-editor-btn small', 'Remove'); remove.onclick = () => this.updateSelectedState((draft) => { draft.conditions.splice(index, 1); if (!draft.conditions.length) draft.conditions.push({ id: 'always', type: 'always', params: {} }); });
      row.append(type, params, remove); list.appendChild(row);
    });
    const add = el('button', 'actor-editor-btn', 'Add condition'); add.onclick = () => this.updateSelectedState((draft) => { draft.conditions.push({ id: `cond-${Date.now()}`, type: 'timer-elapsed', params: { seconds: 1 } }); });
    section.append(list, add);
    return section;
  }

  renderActionEditor(state) {
    const section = el('div', 'actor-editor-subsection');
    section.appendChild(el('h3', '', 'Actions'));
    const list = el('div', 'actor-editor-list');
    state.actions.forEach((action, index) => {
      const row = el('div', 'actor-editor-list-row');
      const type = el('select'); ACTION_TYPES.forEach((entry) => { const option = el('option'); option.value = entry; option.textContent = entry; if (entry === action.type) option.selected = true; type.appendChild(option); });
      type.oninput = (event) => this.updateSelectedState((draft) => { draft.actions[index].type = event.target.value; });
      const params = el('input'); params.value = JSON.stringify(action.params || {}); params.onchange = (event) => this.updateSelectedState((draft) => { try { draft.actions[index].params = JSON.parse(event.target.value || '{}'); } catch { draft.actions[index].params = { value: event.target.value }; } });
      const remove = el('button', 'actor-editor-btn small', 'Remove'); remove.onclick = () => this.updateSelectedState((draft) => { draft.actions.splice(index, 1); });
      row.append(type, params, remove); list.appendChild(row);
    });
    const add = el('button', 'actor-editor-btn', 'Add action'); add.onclick = () => this.updateSelectedState((draft) => { draft.actions.push({ id: `action-${Date.now()}`, type: 'switch-state', params: { stateId: draft.id } }); });
    section.append(list, add);
    return section;
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

  renderWorkflowCard() {
    const section = el('section', 'actor-editor-card');
    section.appendChild(el('h2', '', 'Default workflow'));
    const ol = el('ol', 'actor-editor-workflow');
    ['Name the actor.', 'Leave Attack Who as none or set it to player.', 'Idle state exists automatically.', 'Click the animation preview to open Pixel Editor.', 'Add movement / death / attack states as needed.', 'Author conditions and actions visually per state.', 'Set contact damage, invulnerability, loot, and linked parts.', 'Save, then place only the root actor in Level Editor.'].forEach((step) => {
      const li = el('li'); li.textContent = step; ol.appendChild(li);
    });
    section.appendChild(ol);
    return section;
  }
}
