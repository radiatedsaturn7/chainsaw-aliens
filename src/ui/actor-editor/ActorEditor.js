import EditorShell from '../../../ui/EditorShell.js';
import { actorRegistry } from '../../actors/ActorRegistry.js';
import {
  ACTOR_ALIGNMENTS,
  ACTOR_ART_TILE_SLOTS,
  ACTOR_ATTACK_TYPES,
  ACTOR_BEHAVIOR_MODES,
  ACTOR_EDITOR_PRESETS,
  ACTOR_STATE_MOVEMENT_MODES,
  ACTOR_TYPES,
  TRANSITION_CONDITIONS,
  cloneActorDefinition,
  createActorPresetDefinition,
  createDefaultActorDefinition,
  slugifyActorId,
  validateActorDefinition
} from '../../actors/definitions.js';
import { listActorArtSlots, listArtDocuments, loadActorArtSource } from '../../actors/art.js';

const SIMPLE_LOOT_OPTIONS = [
  { value: '', label: 'No drop' },
  { value: 'health-small', label: 'Health Small' },
  { value: 'health-medium', label: 'Health Medium' },
  { value: 'ammo', label: 'Ammo' },
  { value: 'credits', label: 'Credits' }
];

const PRESET_CONFIG = {
  friendlyNpc: { label: 'Friendly NPC', description: 'Talkable character with idle + talk states.' },
  basicEnemy: { label: 'Basic Enemy', description: 'Ground enemy with guided health, damage, patrol, art, and loot setup.' },
  turret: { label: 'Turret', description: 'Stationary attacker with idle + attack + destroyed states.' },
  spawner: { label: 'Spawner', description: 'Actor that periodically spawns other actors.' },
  boss: { label: 'Boss', description: 'Boss starter with room for advanced attacks and parts.' },
  blankAdvanced: { label: 'Blank Advanced', description: 'Starts nearly blank and opens advanced editing.' }
};

const SIMPLE_BEHAVIOR_PRESETS = [
  { id: 'standStill', label: 'Stand Still', description: 'Does not move.' },
  { id: 'patrolPlatform', label: 'Patrol Platform', description: 'Walks back and forth along a platform.' },
  { id: 'bounceOffWalls', label: 'Bounce Off Walls', description: 'Moves left/right and turns around when blocked.' },
  { id: 'chasePlayer', label: 'Chase Player', description: 'Moves toward the player when nearby.' },
  { id: 'talkFriendly', label: 'Talk / Friendly', description: 'Friendly actor for conversations.' },
  { id: 'shopkeeper', label: 'Shopkeeper', description: 'Friendly merchant behavior.' },
  { id: 'turret', label: 'Turret', description: 'Stationary turret behavior.' },
  { id: 'spawner', label: 'Spawner', description: 'Spawns other actors.' },
  { id: 'bossBase', label: 'Boss Base', description: 'Boss controller starter behavior.' },
  { id: 'customAdvanced', label: 'Custom Advanced', description: 'Switch to Advanced mode for full control.' }
];

const SIMPLE_CLIP_GROUPS = {
  basicEnemy: ['move', 'death'],
  friendlyNpc: ['idle', 'talk'],
  turret: ['idle', 'attack', 'destroyed'],
  spawner: ['idle', 'spawn', 'destroyed'],
  boss: ['move', 'hurt', 'death'],
  blankAdvanced: ['idle']
};

const BEHAVIOR_MODE_OPTIONS = SIMPLE_BEHAVIOR_PRESETS.map((entry) => ({ value: entry.id, label: entry.label }));
const styleInput = (el) => {
  el.style.width = '100%';
  el.style.boxSizing = 'border-box';
  el.style.padding = '8px';
  el.style.border = '1px solid rgba(255,255,255,0.18)';
  el.style.borderRadius = '6px';
  el.style.background = 'rgba(0,0,0,0.24)';
  el.style.color = '#fff';
  return el;
};
const el = (tag, text = '') => { const node = document.createElement(tag); if (text) node.textContent = text; return node; };
const row = (...children) => { const node = el('div'); node.style.display = 'flex'; node.style.gap = '8px'; node.style.alignItems = 'center'; children.forEach((child) => node.appendChild(child)); return node; };
const card = (title = '', description = '') => {
  const node = el('div');
  node.style.border = '1px solid rgba(255,255,255,0.12)';
  node.style.borderRadius = '10px';
  node.style.padding = '12px';
  node.style.marginBottom = '12px';
  if (title) {
    const heading = el('div', title);
    heading.style.fontSize = '15px';
    heading.style.fontWeight = '700';
    heading.style.marginBottom = description ? '4px' : '10px';
    node.appendChild(heading);
  }
  if (description) {
    const copy = el('div', description);
    copy.style.fontSize = '12px';
    copy.style.color = 'rgba(255,255,255,0.72)';
    copy.style.marginBottom = '10px';
    node.appendChild(copy);
  }
  return node;
};
const cloneDeep = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

const ensureClip = (actor, clipId, name) => {
  let clip = actor.clips.find((entry) => entry.id === clipId);
  if (!clip) {
    clip = { id: clipId, name, startFrame: 0, endFrame: 0, fps: 8, loop: clipId !== 'death' && clipId !== 'hurt' && clipId !== 'destroyed' };
    actor.clips.push(clip);
  }
  if (!clip.name) clip.name = name;
  return clip;
};

const collectLootOptions = (registry) => {
  const seen = new Set(SIMPLE_LOOT_OPTIONS.map((entry) => entry.value).filter(Boolean));
  const extras = [];
  registry.list().forEach((actor) => {
    (actor.lootTable || []).forEach((entry) => {
      if (!entry?.itemId || seen.has(entry.itemId)) return;
      seen.add(entry.itemId);
      extras.push({ value: entry.itemId, label: entry.itemId });
    });
  });
  return [...SIMPLE_LOOT_OPTIONS, ...extras.sort((a, b) => a.label.localeCompare(b.label))];
};

const inferPresetFromActor = (actor) => {
  if (!actor) return 'basicEnemy';
  if (actor.actorType === 'boss') return 'boss';
  if (actor.actorType === 'spawner') return 'spawner';
  if (actor.actorType === 'turret') return 'turret';
  if (actor.actorType === 'enemy') return 'basicEnemy';
  if (actor.alignment === 'friendly' || actor.behavior?.mode === 'talk' || actor.behavior?.mode === 'shopkeeper') return 'friendlyNpc';
  return 'blankAdvanced';
};

const inferSimpleBehaviorPreset = (actor) => {
  const behavior = actor?.behavior || {};
  if (behavior.mode === 'shopkeeper') return 'shopkeeper';
  if (behavior.mode === 'talk') return 'talkFriendly';
  if (behavior.mode === 'stationaryTurret') return 'turret';
  if (behavior.mode === 'spawner') return 'spawner';
  if (behavior.mode === 'bossController') return 'bossBase';
  if (behavior.mode === 'chase' || behavior.mode === 'meleeAttacker' || behavior.mode === 'rangedAttacker') return 'chasePlayer';
  if (behavior.mode === 'patrol' && behavior.wallResponse === 'bounce') return 'bounceOffWalls';
  if (behavior.mode === 'patrol') return 'patrolPlatform';
  if (behavior.mode === 'idle') return 'standStill';
  return 'customAdvanced';
};

const applySimpleBehaviorPreset = (actor, presetId) => {
  const speed = Number(actor.stats.moveSpeed || actor.behavior?.movementSpeed || 0);
  actor.behavior = {
    ...actor.behavior,
    movementSpeed: speed,
    targetAlignments: actor.behavior?.targetAlignments || []
  };
  if (presetId === 'standStill') {
    actor.behavior = { ...actor.behavior, mode: 'idle', gravityEnabled: false, wallResponse: 'stop', patrolStyle: 'none', targetPlayer: false };
    return;
  }
  if (presetId === 'patrolPlatform') {
    actor.behavior = { ...actor.behavior, mode: 'patrol', gravityEnabled: true, wallResponse: 'turn', edgeResponse: 'turn', patrolStyle: 'platform', targetPlayer: false };
    return;
  }
  if (presetId === 'bounceOffWalls') {
    actor.behavior = { ...actor.behavior, mode: 'patrol', gravityEnabled: true, wallResponse: 'bounce', edgeResponse: 'turn', patrolStyle: 'wallBounce', targetPlayer: false };
    return;
  }
  if (presetId === 'chasePlayer') {
    actor.behavior = { ...actor.behavior, mode: 'chase', gravityEnabled: true, wallResponse: 'turn', edgeResponse: 'turn', aggroRange: actor.behavior.aggroRange || 120, preferredAttackRange: 20, targetPlayer: true, targetAlignments: ['friendly', 'impartial'] };
    return;
  }
  if (presetId === 'talkFriendly') {
    actor.behavior = { ...actor.behavior, mode: 'talk', gravityEnabled: false, movementSpeed: 0, targetPlayer: false, targetAlignments: [] };
    actor.alignment = 'friendly';
    if (actor.actorType === 'enemy') actor.actorType = 'npc';
    return;
  }
  if (presetId === 'shopkeeper') {
    actor.behavior = { ...actor.behavior, mode: 'shopkeeper', gravityEnabled: false, movementSpeed: 0, targetPlayer: false, targetAlignments: [] };
    actor.alignment = 'friendly';
    actor.actorType = 'npc';
    actor.interaction.interactType = 'shop';
    return;
  }
  if (presetId === 'turret') {
    actor.behavior = { ...actor.behavior, mode: 'stationaryTurret', gravityEnabled: false, movementSpeed: 0, targetPlayer: true, targetAlignments: ['friendly', 'impartial'] };
    actor.actorType = 'turret';
    actor.alignment = 'enemy';
    return;
  }
  if (presetId === 'spawner') {
    actor.behavior = { ...actor.behavior, mode: 'spawner', gravityEnabled: false, movementSpeed: 0, targetPlayer: false, targetAlignments: [] };
    actor.actorType = 'spawner';
    actor.alignment = 'enemy';
    return;
  }
  if (presetId === 'bossBase') {
    actor.behavior = { ...actor.behavior, mode: 'bossController', gravityEnabled: true, wallResponse: 'turn', edgeResponse: 'turn', targetPlayer: true, targetAlignments: ['friendly', 'impartial'] };
    actor.actorType = 'boss';
    actor.alignment = 'enemy';
  }
};

export default class ActorEditor {
  constructor(game) {
    this.game = game;
    this.registry = actorRegistry;
    this.shell = new EditorShell();
    this.root = this.shell.root;
    this.root.style.position = 'fixed';
    this.root.style.inset = '0';
    this.root.style.zIndex = '30';
    this.root.style.display = 'none';
    this.root.style.background = 'rgba(8,10,14,0.98)';
    this.selectedId = null;
    this.currentDraft = null;
    this.advancedTab = 'overview';
    this.unsubscribe = null;
    this.validation = { warnings: [], errors: [] };
    this.search = '';
    this.typeFilter = 'all';
    this.alignmentFilter = 'all';
    this.editorMode = 'simple';
    this.selectedPreset = 'basicEnemy';
    this.simpleBehaviorPreset = 'bounceOffWalls';
    this.autoGenerateId = false;
    this.lastSavedActorId = null;
    this.buildLayout();
    document.body.appendChild(this.root);
  }

  async activate() {
    if (!this.registry.loaded) { this.registry.restoreCache(); await this.registry.load(); }
    this.unsubscribe?.();
    this.unsubscribe = this.registry.subscribe(() => this.refreshList());
    if (!this.selectedId) this.selectedId = this.registry.list()[0]?.id || null;
    this.loadDraft(this.selectedId);
    this.refreshList();
    this.root.style.display = 'flex';
  }

  deactivate() { this.root.style.display = 'none'; this.unsubscribe?.(); this.unsubscribe = null; }
  isModalOpen() { return false; }
  closeModal() {}
  resetTransientInteractionState() {}
  update() {}
  draw(ctx) { ctx.clearRect(0, 0, this.game.canvas.width, this.game.canvas.height); ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height); }

  buildLayout() {
    const { topBar, leftRail, mainContent } = this.shell.getSlots();
    topBar.innerHTML = ''; leftRail.innerHTML = ''; mainContent.innerHTML = '';
    const title = el('div', 'Actor Editor'); title.style.fontSize = '18px'; title.style.fontWeight = '700';
    const actions = row();
    ['Save', 'New', 'Duplicate', 'Delete', 'Return'].forEach((label) => {
      const button = el('button', label); button.type = 'button'; styleInput(button); button.style.width = 'auto'; button.style.cursor = 'pointer'; actions.appendChild(button);
      if (label === 'Save') button.onclick = () => this.saveCurrent();
      if (label === 'New') button.onclick = () => this.createActor(this.editorMode === 'advanced' ? 'blankAdvanced' : 'basicEnemy');
      if (label === 'Duplicate') button.onclick = () => this.duplicateActor();
      if (label === 'Delete') button.onclick = () => this.deleteActor();
      if (label === 'Return') button.onclick = () => this.game.exitActorEditor();
    });
    topBar.append(title, actions);

    const presetCard = card('Guided Presets', 'Start from a ready-made actor template instead of building raw data by hand.');
    ACTOR_EDITOR_PRESETS.forEach((presetId) => {
      const config = PRESET_CONFIG[presetId];
      const button = el('button', config.label);
      button.type = 'button';
      styleInput(button);
      button.style.textAlign = 'left';
      button.style.marginBottom = '8px';
      button.onclick = () => this.createActor(presetId);
      const desc = el('div', config.description);
      desc.style.fontSize = '11px';
      desc.style.color = 'rgba(255,255,255,0.7)';
      desc.style.marginTop = '4px';
      button.appendChild(desc);
      presetCard.appendChild(button);
    });

    this.searchInput = styleInput(document.createElement('input')); this.searchInput.placeholder = 'Search actors'; this.searchInput.oninput = () => { this.search = this.searchInput.value.toLowerCase(); this.refreshList(); };
    this.typeSelect = styleInput(document.createElement('select')); ['all', ...ACTOR_TYPES].forEach((value) => { const option = el('option', value); option.value = value; this.typeSelect.appendChild(option); }); this.typeSelect.onchange = () => { this.typeFilter = this.typeSelect.value; this.refreshList(); };
    this.alignSelect = styleInput(document.createElement('select')); ['all', ...ACTOR_ALIGNMENTS].forEach((value) => { const option = el('option', value); option.value = value; this.alignSelect.appendChild(option); }); this.alignSelect.onchange = () => { this.alignmentFilter = this.alignSelect.value; this.refreshList(); };
    this.listEl = el('div');
    leftRail.append(presetCard, this.searchInput, this.typeSelect, this.alignSelect, this.listEl);

    this.mainWrap = el('div'); this.mainWrap.style.display = 'grid'; this.mainWrap.style.gridTemplateColumns = 'minmax(320px, 1fr) minmax(360px, 460px)'; this.mainWrap.style.height = '100%';
    this.editorColumn = el('div'); this.editorColumn.style.padding = '14px'; this.editorColumn.style.overflow = 'auto';
    this.previewColumn = el('div'); this.previewColumn.style.padding = '14px'; this.previewColumn.style.borderLeft = '1px solid rgba(255,255,255,0.12)'; this.previewColumn.style.overflow = 'auto';
    this.mainWrap.append(this.editorColumn, this.previewColumn);
    mainContent.appendChild(this.mainWrap);
  }

  filteredActors() {
    return this.registry.list().filter((actor) => {
      if (this.typeFilter !== 'all' && actor.actorType !== this.typeFilter) return false;
      if (this.alignmentFilter !== 'all' && actor.alignment !== this.alignmentFilter) return false;
      if (!this.search) return true;
      return `${actor.id} ${actor.name} ${actor.description} ${actor.tags.join(' ')}`.toLowerCase().includes(this.search);
    });
  }

  refreshList() {
    this.listEl.innerHTML = '';
    this.filteredActors().forEach((actor) => {
      const button = el('button', `${actor.name} · ${actor.actorType} · ${actor.alignment}`); button.type = 'button'; styleInput(button); button.style.textAlign = 'left'; button.style.marginTop = '8px';
      if (actor.id === this.selectedId) button.style.borderColor = '#ffe16a';
      button.onclick = () => { this.loadDraft(actor.id); this.refreshList(); };
      this.listEl.appendChild(button);
    });
  }

  loadDraft(id) {
    this.selectedId = id;
    const actor = this.registry.get(id) || createDefaultActorDefinition();
    this.currentDraft = cloneActorDefinition(actor);
    this.selectedPreset = inferPresetFromActor(this.currentDraft);
    this.simpleBehaviorPreset = inferSimpleBehaviorPreset(this.currentDraft);
    this.autoGenerateId = false;
    if (this.selectedPreset === 'blankAdvanced') this.editorMode = 'advanced';
    this.render();
  }

  createActor(presetId = 'basicEnemy') {
    this.selectedPreset = presetId;
    this.editorMode = presetId === 'blankAdvanced' ? 'advanced' : 'simple';
    this.currentDraft = createActorPresetDefinition(presetId);
    this.selectedId = this.currentDraft.id;
    this.autoGenerateId = true;
    this.simpleBehaviorPreset = inferSimpleBehaviorPreset(this.currentDraft);
    this.lastSavedActorId = null;
    this.render(); this.refreshList();
  }

  duplicateActor() {
    if (!this.currentDraft) return;
    const copy = cloneActorDefinition(this.currentDraft);
    copy.name = `${copy.name} Copy`;
    copy.id = slugifyActorId(copy.name, `${copy.id}-copy`);
    this.currentDraft = copy;
    this.selectedId = copy.id;
    this.autoGenerateId = true;
    this.lastSavedActorId = null;
    this.render();
  }

  deleteActor() {
    if (!this.selectedId) return;
    this.registry.delete(this.selectedId);
    this.selectedId = this.registry.list()[0]?.id || null;
    this.loadDraft(this.selectedId);
    this.refreshList();
  }

  syncAutoId() {
    if (!this.currentDraft || !this.autoGenerateId) return;
    this.currentDraft.id = slugifyActorId(this.currentDraft.name || this.currentDraft.actorType || 'actor');
  }

  saveCurrent() {
    if (!this.currentDraft) return;
    this.syncAutoId();
    const previousId = this.registry.get(this.selectedId) ? this.selectedId : null;
    const { actor } = this.registry.save(this.currentDraft, { previousId });
    this.currentDraft = cloneActorDefinition(actor);
    this.selectedId = actor.id;
    this.lastSavedActorId = actor.id;
    this.autoGenerateId = false;
    this.game.showSystemToast?.(`Saved actor ${actor.name}`);
    this.render(); this.refreshList();
  }

  placeInLevelEditor() {
    if (!this.lastSavedActorId && !this.currentDraft?.id) return;
    this.syncAutoId();
    this.game.openLevelEditorForActor?.(this.lastSavedActorId || this.currentDraft.id);
  }

  setAdvancedTab(tab) { this.advancedTab = tab; this.render(); }
  setEditorMode(mode) { this.editorMode = mode; this.render(); }

  addField(label, input, hint = '') {
    const wrap = el('label'); wrap.style.display = 'block'; wrap.style.marginBottom = '10px';
    const caption = el('div', label); caption.style.fontSize = '12px'; caption.style.marginBottom = '4px';
    wrap.append(caption, input);
    if (hint) {
      const help = el('div', hint);
      help.style.fontSize = '11px';
      help.style.marginTop = '4px';
      help.style.color = 'rgba(255,255,255,0.64)';
      wrap.appendChild(help);
    }
    return wrap;
  }

  numberInput(value, onChange, { min = null, max = null, step = 'any' } = {}) {
    const input = styleInput(document.createElement('input')); input.type = 'number'; input.value = String(value ?? 0); input.step = step; if (min != null) input.min = String(min); if (max != null) input.max = String(max); input.oninput = () => onChange(Number(input.value)); return input;
  }

  textInput(value, onChange, placeholder = '') { const input = styleInput(document.createElement('input')); input.value = value || ''; input.placeholder = placeholder; input.oninput = () => onChange(input.value); return input; }
  textArea(value, onChange) { const input = styleInput(document.createElement('textarea')); input.value = value || ''; input.rows = 3; input.oninput = () => onChange(input.value); return input; }
  checkInput(value, onChange) { const input = document.createElement('input'); input.type = 'checkbox'; input.checked = value === true; input.onchange = () => onChange(input.checked); return input; }
  selectInput(options, value, onChange) { const select = styleInput(document.createElement('select')); options.forEach((entry) => { const option = el('option', entry.label || entry); option.value = entry.value || entry; select.appendChild(option); }); select.value = value ?? options[0]?.value ?? options[0] ?? ''; select.onchange = () => onChange(select.value); return select; }

  render() {
    if (!this.currentDraft) return;
    const { actor, errors, warnings } = validateActorDefinition(this.currentDraft);
    this.currentDraft = actor;
    this.validation = { errors, warnings };
    this.editorColumn.innerHTML = '';

    const modeCard = card('Editing Mode', 'Simple Mode focuses on guided setup. Advanced Mode exposes raw IDs, fallback URLs, transitions, attacks, parts, and internal references.');
    const modeRow = row();
    ['simple', 'advanced'].forEach((mode) => {
      const button = el('button', mode === 'simple' ? 'Simple Mode' : 'Advanced Mode');
      button.type = 'button';
      styleInput(button);
      button.style.width = 'auto';
      if (this.editorMode === mode) button.style.borderColor = '#ffe16a';
      button.onclick = () => this.setEditorMode(mode);
      modeRow.appendChild(button);
    });
    modeCard.appendChild(modeRow);
    this.editorColumn.appendChild(modeCard);

    if (this.editorMode === 'simple') this.renderSimpleMode();
    else this.renderAdvancedMode();
    this.renderPreview();
  }

  renderSimpleMode() {
    const actor = this.currentDraft;
    const presetCard = card('Guided Setup', 'Pick a starter template with sensible defaults. Internal IDs and schema details stay hidden until Advanced Mode.');
    presetCard.appendChild(this.addField('Template', this.selectInput(ACTOR_EDITOR_PRESETS.map((presetId) => ({ value: presetId, label: PRESET_CONFIG[presetId].label })), this.selectedPreset, (value) => {
      if (value !== this.selectedPreset) this.createActor(value);
    }), PRESET_CONFIG[this.selectedPreset]?.description || ''));
    this.editorColumn.appendChild(presetCard);

    const basics = card('1. Basics', 'Set the actor name and the few gameplay values a beginner usually expects first.');
    basics.append(
      this.addField('Name', this.textInput(actor.name, (value) => { actor.name = value; this.syncAutoId(); this.renderPreview(); }, 'e.g. Rift Hopper')),
      row(
        this.addField('Health', this.numberInput(actor.stats.maxHealth, (value) => { actor.stats.maxHealth = value; }, { min: 0, step: 1 })),
        this.addField('Contact Damage', this.numberInput(actor.stats.contactDamage, (value) => { actor.stats.contactDamage = value; }, { min: 0, step: 1 })),
        this.addField('Move Speed', this.numberInput(actor.stats.moveSpeed, (value) => { actor.stats.moveSpeed = value; actor.behavior.movementSpeed = value; }, { min: 0, step: 1 }))
      )
    );
    this.editorColumn.appendChild(basics);

    const behaviorCard = card('2. Movement & Behavior', 'Choose a beginner-friendly behavior preset instead of low-level AI settings.');
    behaviorCard.append(
      this.addField('Behavior Preset', this.selectInput(BEHAVIOR_MODE_OPTIONS, this.simpleBehaviorPreset, (value) => {
        this.simpleBehaviorPreset = value;
        if (value === 'customAdvanced') {
          this.editorMode = 'advanced';
          this.render();
          return;
        }
        applySimpleBehaviorPreset(actor, value);
        this.render();
      })),
      row(
        this.addField('Affected by Gravity', this.checkInput(actor.behavior.gravityEnabled !== false, (value) => { actor.behavior.gravityEnabled = value; })),
        this.addField('Destructible', this.checkInput(actor.vulnerabilities.destructible !== false, (value) => { actor.vulnerabilities.destructible = value; })),
        this.addField('Invulnerable', this.checkInput(actor.vulnerabilities.invulnerableByDefault === true, (value) => { actor.vulnerabilities.invulnerableByDefault = value; }))
      )
    );
    const presetText = SIMPLE_BEHAVIOR_PRESETS.find((entry) => entry.id === this.simpleBehaviorPreset)?.description || '';
    if (presetText) {
      const note = el('div', presetText);
      note.style.fontSize = '12px';
      note.style.color = 'rgba(255,255,255,0.72)';
      behaviorCard.appendChild(note);
    }
    this.editorColumn.appendChild(behaviorCard);

    const visuals = card('3. Art & Animation', 'Main workflow: create art, open Pixel Editor, save there, and come back here. Raw URLs are hidden in Advanced Mode.');
    const docs = listArtDocuments();
    const slotOptions = listActorArtSlots();
    visuals.append(
      row(
        this.addField('Art Document', this.selectInput([{ value: '', label: 'Choose / Create Art Document' }, ...docs.map((name) => ({ value: name, label: name }))], actor.visuals.artDocument, (value) => { actor.visuals.artDocument = value; this.renderPreview(); })),
        this.addField('Art Slot', this.selectInput(slotOptions.map((slot) => ({ value: slot.char, label: `${slot.label} (${slot.char})` })), actor.visuals.artTile, (value) => { actor.visuals.artTile = value; this.renderPreview(); }))
      )
    );
    const buttonRow = row();
    ['Create Art', 'Open in Pixel Editor', 'Refresh Preview'].forEach((label) => {
      const button = el('button', label);
      button.type = 'button';
      styleInput(button);
      button.style.width = 'auto';
      if (label === 'Create Art') button.onclick = async () => { const name = await this.game.createActorArtDocument?.(actor); if (name) { actor.visuals.artDocument = name; this.render(); } };
      if (label === 'Open in Pixel Editor') button.onclick = () => this.game.openActorInPixelStudio?.(actor);
      if (label === 'Refresh Preview') button.onclick = () => this.renderPreview();
      buttonRow.appendChild(button);
    });
    visuals.appendChild(buttonRow);

    const clipIds = SIMPLE_CLIP_GROUPS[this.selectedPreset] || ['move', 'death'];
    clipIds.forEach((clipId) => {
      const name = clipId[0].toUpperCase() + clipId.slice(1);
      const clip = ensureClip(actor, clipId, name);
      visuals.appendChild(row(
        this.addField(`${name} Animation`, this.textInput(clip.name, (value) => { clip.name = value || name; }, `Label for ${name.toLowerCase()} animation`)),
        this.addField('Start Frame', this.numberInput(clip.startFrame, (value) => { clip.startFrame = value; }, { min: 0, step: 1 })),
        this.addField('End Frame', this.numberInput(clip.endFrame, (value) => { clip.endFrame = value; }, { min: 0, step: 1 })),
        this.addField('FPS', this.numberInput(clip.fps, (value) => { clip.fps = value; }, { min: 1, step: 1 }))
      ));
    });
    this.editorColumn.appendChild(visuals);

    const loot = card('4. Simple Loot Drop', 'Pick one common drop, set the chance, and move on. Advanced rules stay hidden until Advanced Mode.');
    const lootEntry = actor.lootTable[0] || { id: 'loot-1', itemId: '', probability: 0.2, minQuantity: 1, maxQuantity: 1, guaranteed: false, condition: '' };
    if (!actor.lootTable.length) actor.lootTable = [lootEntry];
    const lootOptions = collectLootOptions(this.registry);
    loot.appendChild(row(
      this.addField('Drop Item', this.selectInput(lootOptions, lootEntry.itemId, (value) => { lootEntry.itemId = value; if (!value) actor.lootTable = []; else actor.lootTable = [lootEntry]; })),
      this.addField('Drop Chance', this.numberInput(lootEntry.probability, (value) => { lootEntry.probability = value; actor.lootTable = lootEntry.itemId ? [lootEntry] : []; }, { min: 0, max: 1, step: 0.05 })),
      this.addField('Quantity', this.numberInput(lootEntry.maxQuantity, (value) => { lootEntry.minQuantity = Math.max(1, value); lootEntry.maxQuantity = Math.max(1, value); actor.lootTable = lootEntry.itemId ? [lootEntry] : []; }, { min: 1, step: 1 }))
    ));
    this.editorColumn.appendChild(loot);

    const finish = card('5. Save & Place', 'Save the actor, then jump directly to the Level Editor palette so you can place it right away.');
    const finishRow = row();
    const save = el('button', 'Save Actor'); save.type = 'button'; styleInput(save); save.style.width = 'auto'; save.onclick = () => this.saveCurrent();
    const place = el('button', 'Place in Level Editor'); place.type = 'button'; styleInput(place); place.style.width = 'auto'; place.onclick = () => this.placeInLevelEditor();
    finishRow.append(save, place);
    finish.appendChild(finishRow);
    this.editorColumn.appendChild(finish);
  }

  renderAdvancedMode() {
    const tabRow = row(); tabRow.style.marginBottom = '14px';
    const tabs = ['overview', 'visuals', 'states', 'behavior', 'attacks', 'loot'];
    if (this.currentDraft.actorType === 'boss' || this.currentDraft.parts?.length) tabs.push('parts');
    tabs.forEach((tab) => {
      const button = el('button', tab.toUpperCase()); button.type = 'button'; styleInput(button); button.style.width = 'auto'; if (tab === this.advancedTab) button.style.borderColor = '#ffe16a'; button.onclick = () => this.setAdvancedTab(tab); tabRow.appendChild(button);
    });
    this.editorColumn.appendChild(tabRow);
    if (this.advancedTab === 'overview') this.renderOverview();
    if (this.advancedTab === 'visuals') this.renderVisuals();
    if (this.advancedTab === 'states') this.renderStates();
    if (this.advancedTab === 'behavior') this.renderBehavior();
    if (this.advancedTab === 'attacks') this.renderAttacks();
    if (this.advancedTab === 'loot') this.renderLoot();
    if (this.advancedTab === 'parts') this.renderParts();
  }

  renderOverview() {
    const actor = this.currentDraft;
    const wrap = card('Advanced Overview', 'Raw IDs and schema-level controls live here so they stay out of the default workflow.');
    wrap.append(
      this.addField('Actor ID', this.textInput(actor.id, (value) => { actor.id = slugifyActorId(value, actor.id || 'actor'); this.autoGenerateId = false; })),
      this.addField('Name', this.textInput(actor.name, (value) => { actor.name = value; })),
      this.addField('Actor Type', this.selectInput(ACTOR_TYPES, actor.actorType, (value) => { actor.actorType = value; this.render(); })),
      this.addField('Alignment', this.selectInput(ACTOR_ALIGNMENTS, actor.alignment, (value) => { actor.alignment = value; })),
      this.addField('Description', this.textArea(actor.description, (value) => { actor.description = value; })),
      this.addField('Tags (comma separated)', this.textInput(actor.tags.join(', '), (value) => { actor.tags = value.split(',').map((tag) => tag.trim()).filter(Boolean); })),
      row(this.addField('Max Health', this.numberInput(actor.stats.maxHealth, (value) => { actor.stats.maxHealth = value; }, { min: 0 })), this.addField('Move Speed', this.numberInput(actor.stats.moveSpeed, (value) => { actor.stats.moveSpeed = value; })), this.addField('Aggro Range', this.numberInput(actor.stats.aggroRange, (value) => { actor.stats.aggroRange = value; }))),
      row(this.addField('Width', this.numberInput(actor.dimensions.width, (value) => { actor.dimensions.width = value; })), this.addField('Height', this.numberInput(actor.dimensions.height, (value) => { actor.dimensions.height = value; })), this.addField('Contact Damage', this.numberInput(actor.stats.contactDamage, (value) => { actor.stats.contactDamage = value; }))),
      row(this.addField('Destructible', this.checkInput(actor.vulnerabilities.destructible, (value) => { actor.vulnerabilities.destructible = value; })), this.addField('Invulnerable Default', this.checkInput(actor.vulnerabilities.invulnerableByDefault, (value) => { actor.vulnerabilities.invulnerableByDefault = value; })), this.addField('Weak Points Only', this.checkInput(actor.vulnerabilities.weakPointsOnly, (value) => { actor.vulnerabilities.weakPointsOnly = value; })))
    );
    this.editorColumn.appendChild(wrap);
  }

  renderVisuals() {
    const actor = this.currentDraft;
    const docs = listArtDocuments();
    const slotOptions = listActorArtSlots();
    const wrap = card('Advanced Visuals', 'Main art flow still uses Pixel Editor. Fallback URLs stay here in advanced mode only.');
    const artRow = row(); artRow.style.alignItems = 'stretch';
    artRow.append(
      this.addField('Art Document', this.selectInput([{ value: '', label: 'Unlinked' }, ...docs.map((name) => ({ value: name, label: name }))], actor.visuals.artDocument, (value) => { actor.visuals.artDocument = value; this.renderPreview(); })),
      this.addField('Art Slot', this.selectInput(slotOptions.map((slot) => ({ value: slot.char, label: `${slot.label} (${slot.char})` })), actor.visuals.artTile, (value) => { actor.visuals.artTile = value; this.renderPreview(); }))
    );
    wrap.appendChild(artRow);
    const buttons = row();
    ['Create Art Doc', 'Open In Pixel Editor', 'Refresh Preview'].forEach((label) => {
      const button = el('button', label); button.type = 'button'; styleInput(button); button.style.width = 'auto'; buttons.appendChild(button);
      if (label === 'Create Art Doc') button.onclick = async () => { const name = await this.game.createActorArtDocument?.(this.currentDraft); if (name) { actor.visuals.artDocument = name; this.render(); } };
      if (label === 'Open In Pixel Editor') button.onclick = () => this.game.openActorInPixelStudio?.(this.currentDraft);
      if (label === 'Refresh Preview') button.onclick = () => this.renderPreview();
    });
    wrap.appendChild(buttons);
    wrap.append(
      this.addField('Fallback Image URL (optional)', this.textInput(actor.visuals.fallbackImage, (value) => { actor.visuals.fallbackImage = value; })),
      this.addField('Fallback Metadata URL (optional)', this.textInput(actor.visuals.fallbackMetadata, (value) => { actor.visuals.fallbackMetadata = value; }))
    );

    const clipHeader = row(el('h3', 'Clips')); clipHeader.firstChild.style.margin = '14px 0';
    const addClip = el('button', 'Add Clip'); addClip.type = 'button'; styleInput(addClip); addClip.style.width = 'auto'; addClip.onclick = () => { actor.clips.push({ id: `clip-${actor.clips.length + 1}`, name: `Clip ${actor.clips.length + 1}`, startFrame: 0, endFrame: 0, fps: 8, loop: true }); this.render(); }; clipHeader.appendChild(addClip); wrap.appendChild(clipHeader);
    actor.clips.forEach((clip, index) => {
      const clipCard = card();
      clipCard.append(
        this.addField('Clip Name', this.textInput(clip.name, (value) => { clip.name = value; clip.id = slugifyActorId(value, clip.id); })),
        row(this.addField('Start Frame', this.numberInput(clip.startFrame, (value) => { clip.startFrame = value; }, { min: 0, step: 1 })), this.addField('End Frame', this.numberInput(clip.endFrame, (value) => { clip.endFrame = value; }, { min: 0, step: 1 })), this.addField('FPS', this.numberInput(clip.fps, (value) => { clip.fps = value; }, { min: 1, step: 1 }))),
        this.addField('Loop', this.checkInput(clip.loop, (value) => { clip.loop = value; }))
      );
      const remove = el('button', 'Remove Clip'); remove.type = 'button'; styleInput(remove); remove.style.width = 'auto'; remove.onclick = () => { actor.clips.splice(index, 1); this.render(); }; clipCard.appendChild(remove);
      wrap.appendChild(clipCard);
    });
    this.editorColumn.appendChild(wrap);
  }

  renderStates() {
    const actor = this.currentDraft;
    const clipOptions = actor.clips.map((clip) => ({ value: clip.id, label: clip.name }));
    const wrap = card('Advanced States', 'Use this only when the guided state scaffolding is not enough.');
    const header = row();
    const addState = el('button', 'Add State'); addState.type = 'button'; styleInput(addState); addState.style.width = 'auto'; addState.onclick = () => { actor.states.push({ id: `state-${actor.states.length + 1}`, name: `State ${actor.states.length + 1}`, clipId: actor.clips[0]?.id || 'idle', movementMode: 'idle', behaviorMode: actor.behavior.mode, canAttack: false, canMove: true, canSpawn: false, canInteract: true, invulnerable: false, transitions: [] }); this.render(); }; header.appendChild(addState); wrap.appendChild(header);
    actor.states.forEach((state, index) => {
      const stateCard = card();
      stateCard.append(
        row(this.addField('State Name', this.textInput(state.name, (value) => { state.name = value; state.id = slugifyActorId(value, state.id); })), this.addField('Clip', this.selectInput(clipOptions.length ? clipOptions : [{ value: '', label: 'No clips' }], state.clipId, (value) => { state.clipId = value; }))),
        row(this.addField('Movement Mode', this.selectInput(ACTOR_STATE_MOVEMENT_MODES, state.movementMode, (value) => { state.movementMode = value; })), this.addField('Behavior Mode', this.selectInput(ACTOR_BEHAVIOR_MODES, state.behaviorMode, (value) => { state.behaviorMode = value; }))),
        row(this.addField('Can Move', this.checkInput(state.canMove, (value) => { state.canMove = value; })), this.addField('Can Attack', this.checkInput(state.canAttack, (value) => { state.canAttack = value; })), this.addField('Can Spawn', this.checkInput(state.canSpawn, (value) => { state.canSpawn = value; })), this.addField('Can Interact', this.checkInput(state.canInteract, (value) => { state.canInteract = value; })), this.addField('Invulnerable', this.checkInput(state.invulnerable, (value) => { state.invulnerable = value; })))
      );
      const transitionHeader = row(el('strong', 'Transitions'));
      const addTransition = el('button', '+ Transition'); addTransition.type = 'button'; styleInput(addTransition); addTransition.style.width = 'auto'; addTransition.onclick = () => { state.transitions.push({ id: `transition-${state.transitions.length + 1}`, targetStateId: actor.states[0]?.id || '', condition: 'timerElapsed', value: 0.5, chance: 1, flag: '' }); this.render(); }; transitionHeader.appendChild(addTransition); stateCard.appendChild(transitionHeader);
      state.transitions.forEach((transition, tIndex) => {
        const tRow = card();
        tRow.style.borderStyle = 'dashed';
        tRow.append(
          row(this.addField('Target State', this.selectInput(actor.states.map((entry) => ({ value: entry.id, label: entry.name })), transition.targetStateId, (value) => { transition.targetStateId = value; })), this.addField('Condition', this.selectInput(TRANSITION_CONDITIONS, transition.condition, (value) => { transition.condition = value; }))),
          row(this.addField('Value', this.numberInput(transition.value, (value) => { transition.value = value; })), this.addField('Chance', this.numberInput(transition.chance, (value) => { transition.chance = value; }, { min: 0, max: 1, step: 0.05 })), this.addField('Flag', this.textInput(transition.flag, (value) => { transition.flag = value; })))
        );
        const remove = el('button', 'Remove Transition'); remove.type = 'button'; styleInput(remove); remove.style.width = 'auto'; remove.onclick = () => { state.transitions.splice(tIndex, 1); this.render(); }; tRow.appendChild(remove); stateCard.appendChild(tRow);
      });
      const controls = row();
      ['Duplicate State', 'Delete State'].forEach((label) => {
        const button = el('button', label); button.type = 'button'; styleInput(button); button.style.width = 'auto'; controls.appendChild(button);
        if (label === 'Duplicate State') button.onclick = () => { actor.states.splice(index + 1, 0, cloneDeep(state)); this.render(); };
        if (label === 'Delete State') button.onclick = () => { actor.states.splice(index, 1); this.render(); };
      });
      stateCard.appendChild(controls);
      wrap.appendChild(stateCard);
    });
    this.editorColumn.appendChild(wrap);
  }

  renderBehavior() {
    const behavior = this.currentDraft.behavior;
    const wrap = card('Advanced Behavior', 'Raw AI and targeting controls. Beginner-friendly presets live in Simple Mode.');
    wrap.append(
      this.addField('Behavior Mode', this.selectInput(ACTOR_BEHAVIOR_MODES, behavior.mode, (value) => { behavior.mode = value; })),
      row(this.addField('Movement Speed', this.numberInput(behavior.movementSpeed, (value) => { behavior.movementSpeed = value; })), this.addField('Aggro Range', this.numberInput(behavior.aggroRange, (value) => { behavior.aggroRange = value; })), this.addField('Leash Range', this.numberInput(behavior.leashRange, (value) => { behavior.leashRange = value; }))),
      row(this.addField('Patrol Radius', this.numberInput(behavior.patrolRadius, (value) => { behavior.patrolRadius = value; })), this.addField('Wander Radius', this.numberInput(behavior.wanderRadius, (value) => { behavior.wanderRadius = value; })), this.addField('Preferred Attack Range', this.numberInput(behavior.preferredAttackRange, (value) => { behavior.preferredAttackRange = value; }))),
      row(this.addField('Cooldown', this.numberInput(behavior.cooldown, (value) => { behavior.cooldown = value; }, { min: 0, step: 0.1 })), this.addField('Retreat Distance', this.numberInput(behavior.retreatDistance, (value) => { behavior.retreatDistance = value; }))),
      row(this.addField('Line of Sight Required', this.checkInput(behavior.lineOfSightRequired, (value) => { behavior.lineOfSightRequired = value; })), this.addField('Target Player', this.checkInput(behavior.targetPlayer, (value) => { behavior.targetPlayer = value; })), this.addField('Ignore Until Attacked', this.checkInput(behavior.ignorePlayerUnlessAttacked, (value) => { behavior.ignorePlayerUnlessAttacked = value; })), this.addField('Trigger Only', this.checkInput(behavior.activateOnlyOnTrigger, (value) => { behavior.activateOnlyOnTrigger = value; }))),
      row(this.addField('Gravity Enabled', this.checkInput(behavior.gravityEnabled !== false, (value) => { behavior.gravityEnabled = value; })), this.addField('Wall Response', this.textInput(behavior.wallResponse || '', (value) => { behavior.wallResponse = value; })), this.addField('Edge Response', this.textInput(behavior.edgeResponse || '', (value) => { behavior.edgeResponse = value; }))),
      this.addField('Target Alignments (comma separated)', this.textInput((behavior.targetAlignments || []).join(', '), (value) => { behavior.targetAlignments = value.split(',').map((entry) => entry.trim()).filter(Boolean); })),
      this.addField('Patrol Points (x:y comma list)', this.textInput((behavior.patrolPoints || []).map((point) => `${point.x}:${point.y}`).join(', '), (value) => { behavior.patrolPoints = value.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => { const [x, y] = entry.split(':').map(Number); return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 }; }); }))
    );
    this.editorColumn.appendChild(wrap);
  }

  renderAttacks() {
    const actor = this.currentDraft;
    const wrap = card('Advanced Attacks', 'Detailed attack, projectile, and spawn setup.');
    const header = row();
    const add = el('button', 'Add Attack'); add.type = 'button'; styleInput(add); add.style.width = 'auto'; add.onclick = () => { actor.attacks.push({ id: `attack-${actor.attacks.length + 1}`, name: `Attack ${actor.attacks.length + 1}`, type: 'melee', startup: 0.15, active: 0.1, recovery: 0.2, cooldown: 1, range: 24, damage: 1, knockback: 120, hitbox: { shape: 'box', w: 16, h: 16, offsetX: 0, offsetY: 0 }, projectile: { actorId: '', count: 1, spread: 0, angle: 0, speed: 120, gravity: 0, homing: false, target: 'player', variance: 0 }, spawn: { actorId: '', count: 1, offsetX: 0, offsetY: 0, interval: 1 }, telegraph: { duration: 0, fx: '', sound: '' } }); this.render(); }; header.appendChild(add); wrap.appendChild(header);
    actor.attacks.forEach((attack, index) => {
      const attackCard = card();
      attackCard.append(
        row(this.addField('Attack Name', this.textInput(attack.name, (value) => { attack.name = value; })), this.addField('Type', this.selectInput(ACTOR_ATTACK_TYPES, attack.type, (value) => { attack.type = value; }))),
        row(this.addField('Startup', this.numberInput(attack.startup, (value) => { attack.startup = value; }, { min: 0, step: 0.05 })), this.addField('Active', this.numberInput(attack.active, (value) => { attack.active = value; }, { min: 0, step: 0.05 })), this.addField('Recovery', this.numberInput(attack.recovery, (value) => { attack.recovery = value; }, { min: 0, step: 0.05 })), this.addField('Cooldown', this.numberInput(attack.cooldown, (value) => { attack.cooldown = value; }, { min: 0, step: 0.05 }))),
        row(this.addField('Range', this.numberInput(attack.range, (value) => { attack.range = value; })), this.addField('Damage', this.numberInput(attack.damage, (value) => { attack.damage = value; })), this.addField('Knockback', this.numberInput(attack.knockback, (value) => { attack.knockback = value; }))),
        row(this.addField('Hitbox W', this.numberInput(attack.hitbox.w, (value) => { attack.hitbox.w = value; })), this.addField('Hitbox H', this.numberInput(attack.hitbox.h, (value) => { attack.hitbox.h = value; })), this.addField('Offset X', this.numberInput(attack.hitbox.offsetX, (value) => { attack.hitbox.offsetX = value; })), this.addField('Offset Y', this.numberInput(attack.hitbox.offsetY, (value) => { attack.hitbox.offsetY = value; }))),
        row(this.addField('Projectile Actor', this.textInput(attack.projectile.actorId, (value) => { attack.projectile.actorId = value; })), this.addField('Projectile Count', this.numberInput(attack.projectile.count, (value) => { attack.projectile.count = value; }, { min: 1, step: 1 })), this.addField('Spread', this.numberInput(attack.projectile.spread, (value) => { attack.projectile.spread = value; })), this.addField('Speed', this.numberInput(attack.projectile.speed, (value) => { attack.projectile.speed = value; }))),
        row(this.addField('Spawn Actor', this.textInput(attack.spawn.actorId, (value) => { attack.spawn.actorId = value; })), this.addField('Spawn Count', this.numberInput(attack.spawn.count, (value) => { attack.spawn.count = value; }, { min: 1, step: 1 })), this.addField('Spawn Interval', this.numberInput(attack.spawn.interval, (value) => { attack.spawn.interval = value; }, { min: 0, step: 0.1 }))),
        row(this.addField('Telegraph FX', this.textInput(attack.telegraph.fx, (value) => { attack.telegraph.fx = value; })), this.addField('Telegraph Sound', this.textInput(attack.telegraph.sound, (value) => { attack.telegraph.sound = value; })), this.addField('Telegraph Duration', this.numberInput(attack.telegraph.duration, (value) => { attack.telegraph.duration = value; }, { min: 0, step: 0.05 })))
      );
      const remove = el('button', 'Remove Attack'); remove.type = 'button'; styleInput(remove); remove.style.width = 'auto'; remove.onclick = () => { actor.attacks.splice(index, 1); this.render(); }; attackCard.appendChild(remove); wrap.appendChild(attackCard);
    });
    this.editorColumn.appendChild(wrap);
  }

  renderLoot() {
    const actor = this.currentDraft;
    const wrap = card('Advanced Loot', 'Conditional loot rules and multiple drops live here.');
    const header = row();
    const add = el('button', 'Add Loot'); add.type = 'button'; styleInput(add); add.style.width = 'auto'; add.onclick = () => { actor.lootTable.push({ id: `loot-${actor.lootTable.length + 1}`, itemId: '', probability: 1, minQuantity: 1, maxQuantity: 1, guaranteed: false, condition: '' }); this.render(); }; header.appendChild(add); wrap.appendChild(header);
    actor.lootTable.forEach((entry, index) => {
      const lootCard = card();
      lootCard.append(row(this.addField('Item', this.textInput(entry.itemId, (value) => { entry.itemId = value; })), this.addField('Probability', this.numberInput(entry.probability, (value) => { entry.probability = value; }, { min: 0, max: 1, step: 0.05 })), this.addField('Min Qty', this.numberInput(entry.minQuantity, (value) => { entry.minQuantity = value; }, { min: 1, step: 1 })), this.addField('Max Qty', this.numberInput(entry.maxQuantity, (value) => { entry.maxQuantity = value; }, { min: 1, step: 1 }))), row(this.addField('Guaranteed', this.checkInput(entry.guaranteed, (value) => { entry.guaranteed = value; })), this.addField('Condition', this.textInput(entry.condition, (value) => { entry.condition = value; }))));
      const remove = el('button', 'Remove Loot'); remove.type = 'button'; styleInput(remove); remove.style.width = 'auto'; remove.onclick = () => { actor.lootTable.splice(index, 1); this.render(); }; lootCard.appendChild(remove); wrap.appendChild(lootCard);
    });
    this.editorColumn.appendChild(wrap);
  }

  renderParts() {
    const actor = this.currentDraft;
    const wrap = card('Advanced Parts / Boss Composition', 'Multipart setup is hidden unless the actor is a boss or you explicitly enter Advanced Mode.');
    const header = row();
    const add = el('button', 'Add Part'); add.type = 'button'; styleInput(add); add.style.width = 'auto'; add.onclick = () => { actor.parts.push({ id: `part-${actor.parts.length + 1}`, name: `Part ${actor.parts.length + 1}`, actorId: '', offsetX: 0, offsetY: 0, attachTo: 'root', role: 'weak-point', syncState: true }); this.render(); }; header.appendChild(add); wrap.appendChild(header);
    actor.parts.forEach((part, index) => {
      const partCard = card();
      partCard.append(row(this.addField('Name', this.textInput(part.name, (value) => { part.name = value; part.id = slugifyActorId(value, part.id); })), this.addField('Child Actor Id', this.textInput(part.actorId, (value) => { part.actorId = value; }))), row(this.addField('Attach To', this.textInput(part.attachTo, (value) => { part.attachTo = value; })), this.addField('Role', this.textInput(part.role, (value) => { part.role = value; }))), row(this.addField('Offset X', this.numberInput(part.offsetX, (value) => { part.offsetX = value; })), this.addField('Offset Y', this.numberInput(part.offsetY, (value) => { part.offsetY = value; })), this.addField('Sync State', this.checkInput(part.syncState, (value) => { part.syncState = value; }))));
      const remove = el('button', 'Remove Part'); remove.type = 'button'; styleInput(remove); remove.style.width = 'auto'; remove.onclick = () => { actor.parts.splice(index, 1); this.render(); }; partCard.appendChild(remove); wrap.appendChild(partCard);
    });
    this.editorColumn.appendChild(wrap);
  }

  renderPreview() {
    const actor = this.currentDraft;
    this.previewColumn.innerHTML = '';
    const title = el('h3', actor.name || 'New Actor'); title.style.marginTop = '0';
    const subtitle = el('div', `${PRESET_CONFIG[this.selectedPreset]?.label || 'Custom'} · ${this.editorMode === 'simple' ? 'Simple Mode' : 'Advanced Mode'}`);
    subtitle.style.fontSize = '12px';
    subtitle.style.color = 'rgba(255,255,255,0.72)';
    subtitle.style.marginBottom = '10px';
    const asset = loadActorArtSource(actor.visuals);
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; canvas.style.width = '100%'; canvas.style.maxWidth = '260px'; canvas.style.border = '1px solid rgba(255,255,255,0.15)'; canvas.style.borderRadius = '10px';
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (asset) {
      const frame = asset.buildFrameCanvas(0); ctx.imageSmoothingEnabled = false; ctx.drawImage(frame, 48, 48, 144, 144);
    } else {
      ctx.fillStyle = actor.editor.color || '#8ecae6'; ctx.fillRect(48, 48, 144, 144); ctx.fillStyle = '#081018'; ctx.font = '22px Courier New'; ctx.textAlign = 'center'; ctx.fillText(actor.editor.glyph || 'AC', 120, 126);
    }
    canvas.style.cursor = 'pointer'; canvas.onclick = () => this.game.openActorInPixelStudio?.(actor);
    this.previewColumn.append(title, subtitle, canvas);
    const helper = el('div', 'Click preview to open Pixel Editor. Save there, return here, then use Save Actor and Place in Level Editor.'); helper.style.fontSize = '12px'; helper.style.margin = '10px 0'; helper.style.color = 'rgba(255,255,255,0.78)'; this.previewColumn.appendChild(helper);

    const summary = card('Quick Summary');
    summary.append(
      el('div', `Type: ${actor.actorType}`),
      el('div', `Alignment: ${actor.alignment}`),
      el('div', `Health: ${actor.stats.maxHealth}`),
      el('div', `Damage: ${actor.stats.contactDamage}`),
      el('div', `Behavior: ${SIMPLE_BEHAVIOR_PRESETS.find((entry) => entry.id === this.simpleBehaviorPreset)?.label || actor.behavior.mode}`),
      el('div', `Art: ${actor.visuals.artDocument ? `${actor.visuals.artDocument} / ${actor.visuals.artTile}` : 'No linked art yet'}`),
      el('div', `States: ${(actor.states || []).map((state) => state.name).join(', ') || 'None'}`)
    );
    this.previewColumn.appendChild(summary);

    if (this.editorMode === 'advanced') {
      const internals = card('Advanced / Internal');
      internals.append(
        el('div', `Actor ID: ${actor.id}`),
        el('div', `Fallback Image URL: ${actor.visuals.fallbackImage || '—'}`),
        el('div', `Fallback Metadata URL: ${actor.visuals.fallbackMetadata || '—'}`),
        el('div', `Parts: ${actor.parts.length}`)
      );
      this.previewColumn.appendChild(internals);
    }

    const actions = card('Next Step');
    const actionRow = row();
    const saveButton = el('button', 'Save Actor'); saveButton.type = 'button'; styleInput(saveButton); saveButton.style.width = 'auto'; saveButton.onclick = () => this.saveCurrent();
    const placeButton = el('button', 'Place in Level Editor'); placeButton.type = 'button'; styleInput(placeButton); placeButton.style.width = 'auto'; placeButton.onclick = () => this.placeInLevelEditor();
    actionRow.append(saveButton, placeButton);
    actions.appendChild(actionRow);
    this.previewColumn.appendChild(actions);

    const validation = card('Validation');
    validation.innerHTML += [
      ...(this.validation.errors.length ? [`<div style="color:#ff8e8e">Errors: ${this.validation.errors.join(' | ')}</div>`] : []),
      ...(this.validation.warnings.length ? [`<div style="color:#ffe16a">Warnings: ${this.validation.warnings.join(' | ')}</div>`] : ['<div style="color:#8ff0c8">Validation OK</div>'])
    ].join('');
    this.previewColumn.appendChild(validation);
  }
}
