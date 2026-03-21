import EditorShell from '../../../ui/EditorShell.js';
import { actorRegistry } from '../../actors/ActorRegistry.js';
import { ACTOR_ALIGNMENTS, ACTOR_ART_TILE_SLOTS, ACTOR_ATTACK_TYPES, ACTOR_BEHAVIOR_MODES, ACTOR_STATE_MOVEMENT_MODES, ACTOR_TYPES, TRANSITION_CONDITIONS, cloneActorDefinition, createDefaultActorDefinition, validateActorDefinition } from '../../actors/definitions.js';
import { listActorArtSlots, listArtDocuments, loadActorArtSource } from '../../actors/art.js';

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
    this.activeTab = 'overview';
    this.unsubscribe = null;
    this.validation = { warnings: [], errors: [] };
    this.search = '';
    this.typeFilter = 'all';
    this.alignmentFilter = 'all';
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
      if (label === 'New') button.onclick = () => this.createActor();
      if (label === 'Duplicate') button.onclick = () => this.duplicateActor();
      if (label === 'Delete') button.onclick = () => this.deleteActor();
      if (label === 'Return') button.onclick = () => this.game.exitActorEditor();
    });
    topBar.append(title, actions);

    this.searchInput = styleInput(document.createElement('input')); this.searchInput.placeholder = 'Search actors'; this.searchInput.oninput = () => { this.search = this.searchInput.value.toLowerCase(); this.refreshList(); };
    this.typeSelect = styleInput(document.createElement('select')); ['all', ...ACTOR_TYPES].forEach((value) => { const option = el('option', value); option.value = value; this.typeSelect.appendChild(option); }); this.typeSelect.onchange = () => { this.typeFilter = this.typeSelect.value; this.refreshList(); };
    this.alignSelect = styleInput(document.createElement('select')); ['all', ...ACTOR_ALIGNMENTS].forEach((value) => { const option = el('option', value); option.value = value; this.alignSelect.appendChild(option); }); this.alignSelect.onchange = () => { this.alignmentFilter = this.alignSelect.value; this.refreshList(); };
    this.listEl = el('div');
    leftRail.append(this.searchInput, this.typeSelect, this.alignSelect, this.listEl);

    this.mainWrap = el('div'); this.mainWrap.style.display = 'grid'; this.mainWrap.style.gridTemplateColumns = 'minmax(300px, 1fr) minmax(360px, 460px)'; this.mainWrap.style.height = '100%';
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
    const actor = this.registry.get(id) || this.registry.createTemplate('npc', 'impartial');
    this.currentDraft = cloneActorDefinition(actor);
    this.render();
  }

  createActor(actorType = 'npc', alignment = 'impartial') {
    this.currentDraft = this.registry.createTemplate(actorType, alignment);
    this.selectedId = this.currentDraft.id;
    this.render(); this.refreshList();
  }
  duplicateActor() { if (!this.currentDraft) return; const copy = cloneActorDefinition(this.currentDraft); copy.id = `${copy.id}-copy`; copy.name = `${copy.name} Copy`; this.currentDraft = copy; this.selectedId = copy.id; this.render(); }
  deleteActor() { if (!this.selectedId) return; this.registry.delete(this.selectedId); this.selectedId = this.registry.list()[0]?.id || null; this.loadDraft(this.selectedId); this.refreshList(); }
  saveCurrent() { if (!this.currentDraft) return; const previousId = this.registry.get(this.selectedId) ? this.selectedId : null; const { actor } = this.registry.save(this.currentDraft, { previousId }); this.currentDraft = cloneActorDefinition(actor); this.selectedId = actor.id; this.game.showSystemToast?.(`Saved actor ${actor.name}`); this.render(); this.refreshList(); }

  setTab(tab) { this.activeTab = tab; this.render(); }

  addField(label, input) {
    const wrap = el('label'); wrap.style.display = 'block'; wrap.style.marginBottom = '10px';
    const caption = el('div', label); caption.style.fontSize = '12px'; caption.style.marginBottom = '4px';
    wrap.append(caption, input); return wrap;
  }

  numberInput(value, onChange, { min = null, max = null, step = 'any' } = {}) {
    const input = styleInput(document.createElement('input')); input.type = 'number'; input.value = String(value ?? 0); input.step = step; if (min != null) input.min = String(min); if (max != null) input.max = String(max); input.oninput = () => onChange(Number(input.value)); return input;
  }

  textInput(value, onChange) { const input = styleInput(document.createElement('input')); input.value = value || ''; input.oninput = () => onChange(input.value); return input; }
  textArea(value, onChange) { const input = styleInput(document.createElement('textarea')); input.value = value || ''; input.rows = 3; input.oninput = () => onChange(input.value); return input; }
  checkInput(value, onChange) { const input = document.createElement('input'); input.type = 'checkbox'; input.checked = value === true; input.onchange = () => onChange(input.checked); return input; }
  selectInput(options, value, onChange) { const select = styleInput(document.createElement('select')); options.forEach((entry) => { const option = el('option', entry.label || entry); option.value = entry.value || entry; select.appendChild(option); }); select.value = value ?? options[0]?.value ?? options[0] ?? ''; select.onchange = () => onChange(select.value); return select; }

  render() {
    if (!this.currentDraft) return;
    const { actor, errors, warnings } = validateActorDefinition(this.currentDraft);
    this.currentDraft = actor;
    this.validation = { errors, warnings };
    this.editorColumn.innerHTML = '';
    const tabRow = row(); tabRow.style.marginBottom = '14px';
    ['overview', 'visuals', 'states', 'behavior', 'attacks', 'loot', 'parts'].forEach((tab) => {
      const button = el('button', tab.toUpperCase()); button.type = 'button'; styleInput(button); button.style.width = 'auto'; if (tab === this.activeTab) button.style.borderColor = '#ffe16a'; button.onclick = () => this.setTab(tab); tabRow.appendChild(button);
    });
    this.editorColumn.appendChild(tabRow);
    if (this.activeTab === 'overview') this.renderOverview();
    if (this.activeTab === 'visuals') this.renderVisuals();
    if (this.activeTab === 'states') this.renderStates();
    if (this.activeTab === 'behavior') this.renderBehavior();
    if (this.activeTab === 'attacks') this.renderAttacks();
    if (this.activeTab === 'loot') this.renderLoot();
    if (this.activeTab === 'parts') this.renderParts();
    this.renderPreview();
  }

  renderOverview() {
    const actor = this.currentDraft;
    this.editorColumn.append(
      this.addField('Actor ID', this.textInput(actor.id, (value) => { actor.id = value.trim().replace(/\s+/g, '-').toLowerCase(); })),
      this.addField('Name', this.textInput(actor.name, (value) => { actor.name = value; })),
      this.addField('Actor Type', this.selectInput(ACTOR_TYPES, actor.actorType, (value) => { actor.actorType = value; })),
      this.addField('Alignment', this.selectInput(ACTOR_ALIGNMENTS, actor.alignment, (value) => { actor.alignment = value; })),
      this.addField('Description', this.textArea(actor.description, (value) => { actor.description = value; })),
      this.addField('Tags (comma separated)', this.textInput(actor.tags.join(', '), (value) => { actor.tags = value.split(',').map((tag) => tag.trim()).filter(Boolean); })),
      row(this.addField('Max Health', this.numberInput(actor.stats.maxHealth, (value) => { actor.stats.maxHealth = value; }, { min: 0 })), this.addField('Move Speed', this.numberInput(actor.stats.moveSpeed, (value) => { actor.stats.moveSpeed = value; })), this.addField('Aggro Range', this.numberInput(actor.stats.aggroRange, (value) => { actor.stats.aggroRange = value; }))),
      row(this.addField('Width', this.numberInput(actor.dimensions.width, (value) => { actor.dimensions.width = value; })), this.addField('Height', this.numberInput(actor.dimensions.height, (value) => { actor.dimensions.height = value; })), this.addField('Contact Damage', this.numberInput(actor.stats.contactDamage, (value) => { actor.stats.contactDamage = value; }))),
      row(this.addField('Destructible', this.checkInput(actor.vulnerabilities.destructible, (value) => { actor.vulnerabilities.destructible = value; })), this.addField('Invulnerable Default', this.checkInput(actor.vulnerabilities.invulnerableByDefault, (value) => { actor.vulnerabilities.invulnerableByDefault = value; })), this.addField('Weak Points Only', this.checkInput(actor.vulnerabilities.weakPointsOnly, (value) => { actor.vulnerabilities.weakPointsOnly = value; })))
    );
  }

  renderVisuals() {
    const actor = this.currentDraft;
    const docs = listArtDocuments();
    const slotOptions = listActorArtSlots();
    const artRow = row(); artRow.style.alignItems = 'stretch';
    artRow.append(
      this.addField('Art Document', this.selectInput([{ value: '', label: 'Unlinked' }, ...docs.map((name) => ({ value: name, label: name }))], actor.visuals.artDocument, (value) => { actor.visuals.artDocument = value; this.renderPreview(); })),
      this.addField('Art Slot', this.selectInput(slotOptions.map((slot) => ({ value: slot.char, label: `${slot.label} (${slot.char})` })), actor.visuals.artTile, (value) => { actor.visuals.artTile = value; this.renderPreview(); }))
    );
    this.editorColumn.appendChild(artRow);
    const buttons = row();
    ['Create Art Doc', 'Open In Pixel Editor', 'Refresh Preview'].forEach((label) => {
      const button = el('button', label); button.type = 'button'; styleInput(button); button.style.width = 'auto'; buttons.appendChild(button);
      if (label === 'Create Art Doc') button.onclick = async () => { const name = await this.game.createActorArtDocument?.(this.currentDraft); if (name) { actor.visuals.artDocument = name; this.render(); } };
      if (label === 'Open In Pixel Editor') button.onclick = () => this.game.openActorInPixelStudio?.(this.currentDraft);
      if (label === 'Refresh Preview') button.onclick = () => this.renderPreview();
    });
    this.editorColumn.appendChild(buttons);
    this.editorColumn.append(this.addField('Fallback Image URL (optional)', this.textInput(actor.visuals.fallbackImage, (value) => { actor.visuals.fallbackImage = value; })), this.addField('Fallback Metadata URL (optional)', this.textInput(actor.visuals.fallbackMetadata, (value) => { actor.visuals.fallbackMetadata = value; })));

    const clipHeader = row(el('h3', 'Clips')); clipHeader.firstChild.style.margin = '14px 0';
    const addClip = el('button', 'Add Clip'); addClip.type = 'button'; styleInput(addClip); addClip.style.width = 'auto'; addClip.onclick = () => { actor.clips.push({ id: `clip-${actor.clips.length + 1}`, name: `Clip ${actor.clips.length + 1}`, startFrame: 0, endFrame: 0, fps: 8, loop: true }); this.render(); }; clipHeader.appendChild(addClip); this.editorColumn.appendChild(clipHeader);
    actor.clips.forEach((clip, index) => {
      const card = el('div'); card.style.border = '1px solid rgba(255,255,255,0.12)'; card.style.padding = '10px'; card.style.marginBottom = '10px';
      card.append(
        this.addField('Clip Name', this.textInput(clip.name, (value) => { clip.name = value; clip.id = value.trim().toLowerCase().replace(/\s+/g, '-') || clip.id; })),
        row(this.addField('Start Frame', this.numberInput(clip.startFrame, (value) => { clip.startFrame = value; }, { min: 0, step: 1 })), this.addField('End Frame', this.numberInput(clip.endFrame, (value) => { clip.endFrame = value; }, { min: 0, step: 1 })), this.addField('FPS', this.numberInput(clip.fps, (value) => { clip.fps = value; }, { min: 1, step: 1 }))),
        this.addField('Loop', this.checkInput(clip.loop, (value) => { clip.loop = value; }))
      );
      const remove = el('button', 'Remove Clip'); remove.type = 'button'; styleInput(remove); remove.style.width = 'auto'; remove.onclick = () => { actor.clips.splice(index, 1); this.render(); }; card.appendChild(remove);
      this.editorColumn.appendChild(card);
    });
  }

  renderStates() {
    const actor = this.currentDraft;
    const clipOptions = actor.clips.map((clip) => ({ value: clip.id, label: clip.name }));
    const header = row(el('h3', 'States')); header.firstChild.style.margin = '14px 0';
    const addState = el('button', 'Add State'); addState.type = 'button'; styleInput(addState); addState.style.width = 'auto'; addState.onclick = () => { actor.states.push({ id: `state-${actor.states.length + 1}`, name: `State ${actor.states.length + 1}`, clipId: actor.clips[0]?.id || 'idle', movementMode: 'idle', behaviorMode: actor.behavior.mode, canAttack: false, canMove: true, canSpawn: false, canInteract: true, invulnerable: false, transitions: [] }); this.render(); }; header.appendChild(addState); this.editorColumn.appendChild(header);
    actor.states.forEach((state, index) => {
      const card = el('div'); card.style.border = '1px solid rgba(255,255,255,0.12)'; card.style.padding = '10px'; card.style.marginBottom = '10px';
      card.append(
        row(this.addField('State Name', this.textInput(state.name, (value) => { state.name = value; state.id = value.trim().toLowerCase().replace(/\s+/g, '-') || state.id; })), this.addField('Clip', this.selectInput(clipOptions.length ? clipOptions : [{ value: '', label: 'No clips' }], state.clipId, (value) => { state.clipId = value; }))),
        row(this.addField('Movement Mode', this.selectInput(ACTOR_STATE_MOVEMENT_MODES, state.movementMode, (value) => { state.movementMode = value; })), this.addField('Behavior Mode', this.selectInput(ACTOR_BEHAVIOR_MODES, state.behaviorMode, (value) => { state.behaviorMode = value; }))),
        row(this.addField('Can Move', this.checkInput(state.canMove, (value) => { state.canMove = value; })), this.addField('Can Attack', this.checkInput(state.canAttack, (value) => { state.canAttack = value; })), this.addField('Can Spawn', this.checkInput(state.canSpawn, (value) => { state.canSpawn = value; })), this.addField('Can Interact', this.checkInput(state.canInteract, (value) => { state.canInteract = value; })), this.addField('Invulnerable', this.checkInput(state.invulnerable, (value) => { state.invulnerable = value; })))
      );
      const transitionHeader = row(el('strong', 'Transitions'));
      const addTransition = el('button', '+ Transition'); addTransition.type = 'button'; styleInput(addTransition); addTransition.style.width = 'auto'; addTransition.onclick = () => { state.transitions.push({ id: `transition-${state.transitions.length + 1}`, targetStateId: actor.states[0]?.id || '', condition: 'timerElapsed', value: 0.5, chance: 1, flag: '' }); this.render(); }; transitionHeader.appendChild(addTransition); card.appendChild(transitionHeader);
      state.transitions.forEach((transition, tIndex) => {
        const tRow = el('div'); tRow.style.borderTop = '1px dashed rgba(255,255,255,0.12)'; tRow.style.marginTop = '8px'; tRow.style.paddingTop = '8px';
        tRow.append(
          row(this.addField('Target State', this.selectInput(actor.states.map((entry) => ({ value: entry.id, label: entry.name })), transition.targetStateId, (value) => { transition.targetStateId = value; })), this.addField('Condition', this.selectInput(TRANSITION_CONDITIONS, transition.condition, (value) => { transition.condition = value; }))),
          row(this.addField('Value', this.numberInput(transition.value, (value) => { transition.value = value; })), this.addField('Chance', this.numberInput(transition.chance, (value) => { transition.chance = value; }, { min: 0, max: 1, step: 0.05 })), this.addField('Flag', this.textInput(transition.flag, (value) => { transition.flag = value; })))
        );
        const remove = el('button', 'Remove Transition'); remove.type = 'button'; styleInput(remove); remove.style.width = 'auto'; remove.onclick = () => { state.transitions.splice(tIndex, 1); this.render(); }; tRow.appendChild(remove); card.appendChild(tRow);
      });
      const controls = row();
      ['Duplicate State', 'Delete State'].forEach((label) => { const button = el('button', label); button.type = 'button'; styleInput(button); button.style.width = 'auto'; controls.appendChild(button); if (label === 'Duplicate State') button.onclick = () => { actor.states.splice(index + 1, 0, structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state))); this.render(); }; if (label === 'Delete State') button.onclick = () => { actor.states.splice(index, 1); this.render(); }; });
      card.appendChild(controls);
      this.editorColumn.appendChild(card);
    });
  }

  renderBehavior() {
    const behavior = this.currentDraft.behavior;
    this.editorColumn.append(
      this.addField('Behavior Mode', this.selectInput(ACTOR_BEHAVIOR_MODES, behavior.mode, (value) => { behavior.mode = value; })),
      row(this.addField('Movement Speed', this.numberInput(behavior.movementSpeed, (value) => { behavior.movementSpeed = value; })), this.addField('Aggro Range', this.numberInput(behavior.aggroRange, (value) => { behavior.aggroRange = value; })), this.addField('Leash Range', this.numberInput(behavior.leashRange, (value) => { behavior.leashRange = value; }))),
      row(this.addField('Patrol Radius', this.numberInput(behavior.patrolRadius, (value) => { behavior.patrolRadius = value; })), this.addField('Wander Radius', this.numberInput(behavior.wanderRadius, (value) => { behavior.wanderRadius = value; })), this.addField('Preferred Attack Range', this.numberInput(behavior.preferredAttackRange, (value) => { behavior.preferredAttackRange = value; }))),
      row(this.addField('Cooldown', this.numberInput(behavior.cooldown, (value) => { behavior.cooldown = value; }, { min: 0, step: 0.1 })), this.addField('Retreat Distance', this.numberInput(behavior.retreatDistance, (value) => { behavior.retreatDistance = value; }))),
      row(this.addField('Line of Sight Required', this.checkInput(behavior.lineOfSightRequired, (value) => { behavior.lineOfSightRequired = value; })), this.addField('Target Player', this.checkInput(behavior.targetPlayer, (value) => { behavior.targetPlayer = value; })), this.addField('Ignore Until Attacked', this.checkInput(behavior.ignorePlayerUnlessAttacked, (value) => { behavior.ignorePlayerUnlessAttacked = value; })), this.addField('Trigger Only', this.checkInput(behavior.activateOnlyOnTrigger, (value) => { behavior.activateOnlyOnTrigger = value; }))),
      this.addField('Target Alignments (comma separated)', this.textInput(behavior.targetAlignments.join(', '), (value) => { behavior.targetAlignments = value.split(',').map((entry) => entry.trim()).filter(Boolean); })),
      this.addField('Patrol Points (x:y comma list)', this.textInput((behavior.patrolPoints || []).map((point) => `${point.x}:${point.y}`).join(', '), (value) => { behavior.patrolPoints = value.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => { const [x, y] = entry.split(':').map(Number); return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 }; }); }))
    );
  }

  renderAttacks() {
    const actor = this.currentDraft;
    const header = row(el('h3', 'Attacks')); header.firstChild.style.margin = '14px 0';
    const add = el('button', 'Add Attack'); add.type = 'button'; styleInput(add); add.style.width = 'auto'; add.onclick = () => { actor.attacks.push({ id: `attack-${actor.attacks.length + 1}`, name: `Attack ${actor.attacks.length + 1}`, type: 'melee', startup: 0.15, active: 0.1, recovery: 0.2, cooldown: 1, range: 24, damage: 1, knockback: 120, hitbox: { shape: 'box', w: 16, h: 16, offsetX: 0, offsetY: 0 }, projectile: { actorId: '', count: 1, spread: 0, angle: 0, speed: 120, gravity: 0, homing: false, target: 'player', variance: 0 }, spawn: { actorId: '', count: 1, offsetX: 0, offsetY: 0, interval: 1 }, telegraph: { duration: 0, fx: '', sound: '' } }); this.render(); }; header.appendChild(add); this.editorColumn.appendChild(header);
    actor.attacks.forEach((attack, index) => {
      const card = el('div'); card.style.border = '1px solid rgba(255,255,255,0.12)'; card.style.padding = '10px'; card.style.marginBottom = '10px';
      card.append(
        row(this.addField('Attack Name', this.textInput(attack.name, (value) => { attack.name = value; })), this.addField('Type', this.selectInput(ACTOR_ATTACK_TYPES, attack.type, (value) => { attack.type = value; }))),
        row(this.addField('Startup', this.numberInput(attack.startup, (value) => { attack.startup = value; }, { min: 0, step: 0.05 })), this.addField('Active', this.numberInput(attack.active, (value) => { attack.active = value; }, { min: 0, step: 0.05 })), this.addField('Recovery', this.numberInput(attack.recovery, (value) => { attack.recovery = value; }, { min: 0, step: 0.05 })), this.addField('Cooldown', this.numberInput(attack.cooldown, (value) => { attack.cooldown = value; }, { min: 0, step: 0.05 }))),
        row(this.addField('Range', this.numberInput(attack.range, (value) => { attack.range = value; })), this.addField('Damage', this.numberInput(attack.damage, (value) => { attack.damage = value; })), this.addField('Knockback', this.numberInput(attack.knockback, (value) => { attack.knockback = value; }))),
        row(this.addField('Hitbox W', this.numberInput(attack.hitbox.w, (value) => { attack.hitbox.w = value; })), this.addField('Hitbox H', this.numberInput(attack.hitbox.h, (value) => { attack.hitbox.h = value; })), this.addField('Offset X', this.numberInput(attack.hitbox.offsetX, (value) => { attack.hitbox.offsetX = value; })), this.addField('Offset Y', this.numberInput(attack.hitbox.offsetY, (value) => { attack.hitbox.offsetY = value; }))),
        row(this.addField('Projectile Actor', this.textInput(attack.projectile.actorId, (value) => { attack.projectile.actorId = value; })), this.addField('Projectile Count', this.numberInput(attack.projectile.count, (value) => { attack.projectile.count = value; }, { min: 1, step: 1 })), this.addField('Spread', this.numberInput(attack.projectile.spread, (value) => { attack.projectile.spread = value; })), this.addField('Speed', this.numberInput(attack.projectile.speed, (value) => { attack.projectile.speed = value; }))),
        row(this.addField('Spawn Actor', this.textInput(attack.spawn.actorId, (value) => { attack.spawn.actorId = value; })), this.addField('Spawn Count', this.numberInput(attack.spawn.count, (value) => { attack.spawn.count = value; }, { min: 1, step: 1 })), this.addField('Spawn Interval', this.numberInput(attack.spawn.interval, (value) => { attack.spawn.interval = value; }, { min: 0, step: 0.1 }))),
        row(this.addField('Telegraph FX', this.textInput(attack.telegraph.fx, (value) => { attack.telegraph.fx = value; })), this.addField('Telegraph Sound', this.textInput(attack.telegraph.sound, (value) => { attack.telegraph.sound = value; })), this.addField('Telegraph Duration', this.numberInput(attack.telegraph.duration, (value) => { attack.telegraph.duration = value; }, { min: 0, step: 0.05 })))
      );
      const remove = el('button', 'Remove Attack'); remove.type = 'button'; styleInput(remove); remove.style.width = 'auto'; remove.onclick = () => { actor.attacks.splice(index, 1); this.render(); }; card.appendChild(remove); this.editorColumn.appendChild(card);
    });
  }

  renderLoot() {
    const actor = this.currentDraft;
    const header = row(el('h3', 'Loot Table')); header.firstChild.style.margin = '14px 0';
    const add = el('button', 'Add Loot'); add.type = 'button'; styleInput(add); add.style.width = 'auto'; add.onclick = () => { actor.lootTable.push({ id: `loot-${actor.lootTable.length + 1}`, itemId: '', probability: 1, minQuantity: 1, maxQuantity: 1, guaranteed: false, condition: '' }); this.render(); }; header.appendChild(add); this.editorColumn.appendChild(header);
    actor.lootTable.forEach((entry, index) => {
      const card = el('div'); card.style.border = '1px solid rgba(255,255,255,0.12)'; card.style.padding = '10px'; card.style.marginBottom = '10px';
      card.append(row(this.addField('Item', this.textInput(entry.itemId, (value) => { entry.itemId = value; })), this.addField('Probability', this.numberInput(entry.probability, (value) => { entry.probability = value; }, { min: 0, max: 1, step: 0.05 })), this.addField('Min Qty', this.numberInput(entry.minQuantity, (value) => { entry.minQuantity = value; }, { min: 1, step: 1 })), this.addField('Max Qty', this.numberInput(entry.maxQuantity, (value) => { entry.maxQuantity = value; }, { min: 1, step: 1 }))), row(this.addField('Guaranteed', this.checkInput(entry.guaranteed, (value) => { entry.guaranteed = value; })), this.addField('Condition', this.textInput(entry.condition, (value) => { entry.condition = value; }))));
      const remove = el('button', 'Remove Loot'); remove.type = 'button'; styleInput(remove); remove.style.width = 'auto'; remove.onclick = () => { actor.lootTable.splice(index, 1); this.render(); }; card.appendChild(remove); this.editorColumn.appendChild(card);
    });
  }

  renderParts() {
    const actor = this.currentDraft;
    const header = row(el('h3', 'Parts / Boss Composition')); header.firstChild.style.margin = '14px 0';
    const add = el('button', 'Add Part'); add.type = 'button'; styleInput(add); add.style.width = 'auto'; add.onclick = () => { actor.parts.push({ id: `part-${actor.parts.length + 1}`, name: `Part ${actor.parts.length + 1}`, actorId: '', offsetX: 0, offsetY: 0, attachTo: 'root', role: 'weak-point', syncState: true }); this.render(); }; header.appendChild(add); this.editorColumn.appendChild(header);
    actor.parts.forEach((part, index) => {
      const card = el('div'); card.style.border = '1px solid rgba(255,255,255,0.12)'; card.style.padding = '10px'; card.style.marginBottom = '10px';
      card.append(row(this.addField('Name', this.textInput(part.name, (value) => { part.name = value; part.id = value.trim().toLowerCase().replace(/\s+/g, '-') || part.id; })), this.addField('Child Actor Id', this.textInput(part.actorId, (value) => { part.actorId = value; }))), row(this.addField('Attach To', this.textInput(part.attachTo, (value) => { part.attachTo = value; })), this.addField('Role', this.textInput(part.role, (value) => { part.role = value; }))), row(this.addField('Offset X', this.numberInput(part.offsetX, (value) => { part.offsetX = value; })), this.addField('Offset Y', this.numberInput(part.offsetY, (value) => { part.offsetY = value; })), this.addField('Sync State', this.checkInput(part.syncState, (value) => { part.syncState = value; }))));
      const remove = el('button', 'Remove Part'); remove.type = 'button'; styleInput(remove); remove.style.width = 'auto'; remove.onclick = () => { actor.parts.splice(index, 1); this.render(); }; card.appendChild(remove); this.editorColumn.appendChild(card);
    });
  }

  renderPreview() {
    const actor = this.currentDraft;
    this.previewColumn.innerHTML = '';
    const title = el('h3', actor.name); title.style.marginTop = '0';
    const asset = loadActorArtSource(actor.visuals);
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; canvas.style.width = '100%'; canvas.style.maxWidth = '260px'; canvas.style.border = '1px solid rgba(255,255,255,0.15)'; canvas.style.borderRadius = '10px';
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (asset) {
      const frame = asset.buildFrameCanvas(0); ctx.imageSmoothingEnabled = false; ctx.drawImage(frame, 48, 48, 144, 144);
    } else {
      ctx.fillStyle = actor.editor.color || '#8ecae6'; ctx.fillRect(48, 48, 144, 144); ctx.fillStyle = '#081018'; ctx.font = '22px Courier New'; ctx.textAlign = 'center'; ctx.fillText(actor.editor.glyph || 'AC', 120, 126);
    }
    canvas.style.cursor = 'pointer'; canvas.onclick = () => this.game.openActorInPixelStudio?.(actor);
    this.previewColumn.append(title, canvas);
    const helper = el('div', 'Click preview to open Pixel Editor directly. Save there, return here, and the preview will refresh from the linked art document.'); helper.style.fontSize = '12px'; helper.style.margin = '10px 0'; helper.style.color = 'rgba(255,255,255,0.78)'; this.previewColumn.appendChild(helper);
    const stats = el('pre', JSON.stringify({ actorType: actor.actorType, alignment: actor.alignment, art: actor.visuals, states: actor.states.map((state) => ({ id: state.id, clipId: state.clipId })), attacks: actor.attacks.length, lootEntries: actor.lootTable.length, parts: actor.parts.length }, null, 2)); stats.style.whiteSpace = 'pre-wrap'; stats.style.fontSize = '12px'; this.previewColumn.appendChild(stats);
    const validation = el('div'); validation.innerHTML = [
      ...(this.validation.errors.length ? [`<div style="color:#ff8e8e">Errors: ${this.validation.errors.join(' | ')}</div>`] : []),
      ...(this.validation.warnings.length ? [`<div style="color:#ffe16a">Warnings: ${this.validation.warnings.join(' | ')}</div>`] : ['<div style="color:#8ff0c8">Validation OK</div>'])
    ].join(''); this.previewColumn.appendChild(validation);
  }
}
