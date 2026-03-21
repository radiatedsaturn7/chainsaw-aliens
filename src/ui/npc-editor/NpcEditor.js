import EditorShell from '../../../ui/EditorShell.js';
import { npcRegistry } from '../../npc/NpcRegistry.js';
import { createDefaultNpcDefinition, NPC_ALIGNMENT_OPTIONS, NPC_ANIMATION_ROLES, NPC_BEHAVIOR_ARCHETYPES } from '../../npc/definitions.js';
import { validateNpcAnimationRefs } from '../../npc/animationAdapter.js';

const styleField = (el) => {
  el.style.width = '100%';
  el.style.boxSizing = 'border-box';
  el.style.marginBottom = '10px';
  el.style.padding = '8px';
  el.style.border = '1px solid rgba(255,255,255,0.2)';
  el.style.background = 'rgba(0,0,0,0.2)';
  el.style.color = '#fff';
  el.style.borderRadius = '6px';
  return el;
};

const h = (tag, text = '', className = '') => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
};

export default class NpcEditor {
  constructor(game) {
    this.game = game;
    this.registry = npcRegistry;
    this.shell = new EditorShell();
    this.root = this.shell.root;
    this.root.style.position = 'fixed';
    this.root.style.inset = '0';
    this.root.style.zIndex = '30';
    this.root.style.display = 'none';
    this.root.style.background = 'rgba(8,10,14,0.98)';
    this.search = '';
    this.filterAlignment = 'all';
    this.selectedId = null;
    this.currentDraft = null;
    this.previewRole = 'idle';
    this.previewTime = 0;
    this.unsubscribe = null;
    this.validationWarnings = [];
    this.buildUi();
    document.body.appendChild(this.root);
  }

  async activate() {
    if (!this.registry.loaded) {
      this.registry.restoreCache();
      await this.registry.load();
    }
    this.unsubscribe?.();
    this.unsubscribe = this.registry.subscribe(() => this.refreshList());
    if (!this.selectedId) this.selectedId = this.registry.list()[0]?.id || null;
    this.loadSelectedDraft();
    this.refreshList();
    this.root.style.display = 'flex';
  }

  deactivate() {
    this.root.style.display = 'none';
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  isModalOpen() { return false; }
  closeModal() {}
  resetTransientInteractionState() {}

  update(_input, dt) {
    this.previewTime += dt;
  }

  draw(ctx) {
    ctx.clearRect(0, 0, this.game.canvas.width, this.game.canvas.height);
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
  }

  buildUi() {
    const { topBar, leftRail, mainContent } = this.shell.getSlots();
    topBar.innerHTML = '';
    leftRail.innerHTML = '';
    mainContent.innerHTML = '';

    const title = h('div', 'NPC Editor');
    title.style.fontWeight = '700';
    title.style.fontSize = '18px';
    topBar.appendChild(title);

    const topActions = h('div');
    topActions.style.display = 'flex';
    topActions.style.gap = '8px';
    const saveBtn = h('button', 'Save NPC');
    const newBtn = h('button', 'New NPC');
    const duplicateBtn = h('button', 'Duplicate');
    const deleteBtn = h('button', 'Delete');
    const exitBtn = h('button', 'Return');
    [saveBtn, newBtn, duplicateBtn, deleteBtn, exitBtn].forEach((button) => {
      button.type = 'button';
      styleField(button);
      button.style.width = 'auto';
      button.style.marginBottom = '0';
      button.style.cursor = 'pointer';
    });
    saveBtn.onclick = () => this.saveCurrent();
    newBtn.onclick = () => this.createNpc();
    duplicateBtn.onclick = () => this.duplicateNpc();
    deleteBtn.onclick = () => this.deleteNpc();
    exitBtn.onclick = () => this.game.exitNpcEditor();
    topActions.append(saveBtn, newBtn, duplicateBtn, deleteBtn, exitBtn);
    topBar.appendChild(topActions);

    this.searchInput = styleField(document.createElement('input'));
    this.searchInput.placeholder = 'Search NPCs';
    this.searchInput.oninput = () => { this.search = this.searchInput.value.trim().toLowerCase(); this.refreshList(); };
    leftRail.appendChild(this.searchInput);

    this.alignmentFilter = styleField(document.createElement('select'));
    ['all', ...NPC_ALIGNMENT_OPTIONS].forEach((alignment) => {
      const option = document.createElement('option');
      option.value = alignment;
      option.textContent = alignment;
      this.alignmentFilter.appendChild(option);
    });
    this.alignmentFilter.onchange = () => { this.filterAlignment = this.alignmentFilter.value; this.refreshList(); };
    leftRail.appendChild(this.alignmentFilter);

    this.listEl = h('div');
    leftRail.appendChild(this.listEl);

    this.editorWrap = h('div');
    this.editorWrap.style.display = 'grid';
    this.editorWrap.style.gridTemplateColumns = 'minmax(300px, 1fr) minmax(280px, 360px)';
    this.editorWrap.style.gap = '16px';
    this.editorWrap.style.padding = '16px';
    mainContent.appendChild(this.editorWrap);

    this.formEl = h('div');
    this.formEl.style.overflow = 'auto';
    this.previewEl = h('div');
    this.previewEl.style.padding = '16px';
    this.previewEl.style.borderLeft = '1px solid rgba(255,255,255,0.12)';
    this.editorWrap.append(this.formEl, this.previewEl);
  }

  getFilteredList() {
    return this.registry.list().filter((npc) => {
      if (this.filterAlignment !== 'all' && npc.alignment !== this.filterAlignment) return false;
      if (!this.search) return true;
      const haystack = `${npc.id} ${npc.name} ${npc.description} ${npc.tags.join(' ')}`.toLowerCase();
      return haystack.includes(this.search);
    });
  }

  refreshList() {
    this.listEl.innerHTML = '';
    this.getFilteredList().forEach((npc) => {
      const button = h('button', `${npc.name} · ${npc.alignment}`);
      button.type = 'button';
      styleField(button);
      button.style.textAlign = 'left';
      button.style.cursor = 'pointer';
      if (npc.id === this.selectedId) {
        button.style.borderColor = '#ffe16a';
        button.style.boxShadow = '0 0 0 1px #ffe16a inset';
      }
      button.onclick = () => {
        this.selectedId = npc.id;
        this.loadSelectedDraft();
        this.refreshList();
      };
      this.listEl.appendChild(button);
    });
  }

  loadSelectedDraft() {
    const selected = this.registry.get(this.selectedId) || this.registry.createTemplate('impartial');
    this.currentDraft = JSON.parse(JSON.stringify(selected));
    this.renderInspector();
  }

  bindField(path, { type = 'text', label, placeholder = '', value = '', onChange = null } = {}) {
    const wrap = h('label');
    wrap.style.display = 'block';
    wrap.style.marginBottom = '12px';
    const caption = h('div', label || path);
    caption.style.fontSize = '12px';
    caption.style.marginBottom = '4px';
    wrap.appendChild(caption);
    const input = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
    if (type !== 'textarea') input.type = type;
    input.placeholder = placeholder;
    input.value = value;
    styleField(input);
    input.oninput = () => {
      if (onChange) onChange(input.value);
      this.renderPreview();
    };
    wrap.appendChild(input);
    return wrap;
  }

  renderInspector() {
    if (!this.currentDraft) return;
    this.formEl.innerHTML = '';
    const section = (title) => {
      const heading = h('h3', title);
      heading.style.margin = '20px 0 10px';
      heading.style.fontSize = '16px';
      this.formEl.appendChild(heading);
    };

    section('Identity');
    this.formEl.appendChild(this.bindField('id', { label: 'ID', value: this.currentDraft.id, onChange: (value) => { this.currentDraft.id = value.trim().replace(/\s+/g, '-').toLowerCase(); } }));
    this.formEl.appendChild(this.bindField('name', { label: 'Name', value: this.currentDraft.name, onChange: (value) => { this.currentDraft.name = value; } }));
    const alignment = styleField(document.createElement('select'));
    NPC_ALIGNMENT_OPTIONS.forEach((entry) => {
      const option = document.createElement('option'); option.value = entry; option.textContent = entry; alignment.appendChild(option);
    });
    alignment.value = this.currentDraft.alignment;
    alignment.onchange = () => { this.currentDraft.alignment = alignment.value; this.renderPreview(); };
    const alignWrap = h('label'); alignWrap.appendChild(h('div', 'Alignment')); alignWrap.appendChild(alignment); this.formEl.appendChild(alignWrap);
    this.formEl.appendChild(this.bindField('description', { label: 'Description', type: 'textarea', value: this.currentDraft.description, onChange: (value) => { this.currentDraft.description = value; } }));
    this.formEl.appendChild(this.bindField('tags', { label: 'Tags (comma separated)', value: this.currentDraft.tags.join(', '), onChange: (value) => { this.currentDraft.tags = value.split(',').map((tag) => tag.trim()).filter(Boolean); } }));

    section('Animation / Pixel Studio Export');
    this.formEl.appendChild(this.bindField('animationSet.image', { label: 'Sprite Sheet PNG URL', value: this.currentDraft.animationSet.image || '', onChange: (value) => { this.currentDraft.animationSet.image = value.trim(); this.currentDraft.spriteSource.image = value.trim(); } }));
    this.formEl.appendChild(this.bindField('animationSet.metadata', { label: 'Sprite Sheet JSON URL', value: this.currentDraft.animationSet.metadata || '', onChange: (value) => { this.currentDraft.animationSet.metadata = value.trim(); this.currentDraft.spriteSource.metadata = value.trim(); } }));
    NPC_ANIMATION_ROLES.forEach((role) => {
      this.formEl.appendChild(this.bindField(`role-${role}`, { label: `Role → ${role}`, value: this.currentDraft.animationSet.roles[role] || '', onChange: (value) => { this.currentDraft.animationSet.roles[role] = value.trim(); } }));
    });
    this.formEl.appendChild(this.bindField('clips-json', {
      label: 'Animation Clips JSON',
      type: 'textarea',
      value: JSON.stringify(this.currentDraft.animationSet.clips, null, 2),
      onChange: (value) => {
        try { this.currentDraft.animationSet.clips = JSON.parse(value || '{}'); }
        catch (error) {}
      }
    }));

    section('Stats');
    ['maxHealth', 'moveSpeed', 'aggroRange', 'contactDamage', 'knockback'].forEach((key) => {
      this.formEl.appendChild(this.bindField(key, { label: key, type: 'number', value: this.currentDraft.stats[key], onChange: (value) => { this.currentDraft.stats[key] = Number(value); } }));
    });

    section('Dimensions');
    ['width', 'height'].forEach((key) => {
      this.formEl.appendChild(this.bindField(key, { label: key, type: 'number', value: this.currentDraft.dimensions[key], onChange: (value) => { this.currentDraft.dimensions[key] = Number(value); } }));
    });
    ['x', 'y', 'w', 'h'].forEach((key) => {
      this.formEl.appendChild(this.bindField(`collision-${key}`, { label: `collision.${key}`, type: 'number', value: this.currentDraft.dimensions.collision[key], onChange: (value) => { this.currentDraft.dimensions.collision[key] = Number(value); } }));
    });

    section('Behavior');
    const behaviorSelect = styleField(document.createElement('select'));
    NPC_BEHAVIOR_ARCHETYPES.forEach((entry) => {
      const option = document.createElement('option'); option.value = entry; option.textContent = entry; behaviorSelect.appendChild(option);
    });
    behaviorSelect.value = this.currentDraft.behavior.archetype;
    behaviorSelect.onchange = () => { this.currentDraft.behavior.archetype = behaviorSelect.value; this.renderPreview(); };
    const behaviorWrap = h('label'); behaviorWrap.appendChild(h('div', 'Behavior Archetype')); behaviorWrap.appendChild(behaviorSelect); this.formEl.appendChild(behaviorWrap);
    this.formEl.appendChild(this.bindField('behavior.parameters', {
      label: 'Behavior Parameters JSON',
      type: 'textarea',
      value: JSON.stringify(this.currentDraft.behavior.parameters, null, 2),
      onChange: (value) => { try { this.currentDraft.behavior.parameters = JSON.parse(value || '{}'); } catch (error) {} }
    }));

    section('Interaction');
    ['dialogueId', 'interactType', 'shopId', 'scriptHook'].forEach((key) => {
      this.formEl.appendChild(this.bindField(key, { label: key, value: this.currentDraft.interaction[key] || '', onChange: (value) => { this.currentDraft.interaction[key] = value; } }));
    });

    section('Loot / Editor Preview');
    this.formEl.appendChild(this.bindField('loot.tableId', { label: 'loot.tableId', value: this.currentDraft.loot.tableId || '', onChange: (value) => { this.currentDraft.loot.tableId = value; } }));
    this.formEl.appendChild(this.bindField('loot.credits', { label: 'loot.credits', type: 'number', value: this.currentDraft.loot.credits || 0, onChange: (value) => { this.currentDraft.loot.credits = Number(value); } }));
    this.formEl.appendChild(this.bindField('editorPreview.glyph', { label: 'Preview Glyph', value: this.currentDraft.editorPreview.glyph || 'NP', onChange: (value) => { this.currentDraft.editorPreview.glyph = value.slice(0, 2).toUpperCase(); } }));
    this.formEl.appendChild(this.bindField('editorPreview.color', { label: 'Preview Color', type: 'color', value: this.currentDraft.editorPreview.color || '#8ecae6', onChange: (value) => { this.currentDraft.editorPreview.color = value; } }));

    this.renderPreview();
  }

  async renderPreview() {
    this.previewEl.innerHTML = '';
    if (!this.currentDraft) return;
    const heading = h('h3', 'Preview');
    this.previewEl.appendChild(heading);
    const canvas = document.createElement('canvas');
    canvas.width = 220; canvas.height = 220;
    canvas.style.width = '100%';
    canvas.style.maxWidth = '240px';
    canvas.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.25))';
    canvas.style.border = '1px solid rgba(255,255,255,0.15)';
    canvas.style.borderRadius = '10px';
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = this.currentDraft.editorPreview.color || '#8ecae6';
    const size = Math.max(24, this.currentDraft.dimensions.width || 24);
    ctx.fillRect(canvas.width / 2 - size / 2, canvas.height / 2 - size / 2, size, size);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(canvas.width / 2 - size / 2, canvas.height / 2 - size / 2, size, size);
    ctx.fillStyle = '#081018';
    ctx.font = '16px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(this.currentDraft.editorPreview.glyph || 'NP', canvas.width / 2, canvas.height / 2 + 5);
    this.previewEl.appendChild(canvas);

    const roleSelect = styleField(document.createElement('select'));
    NPC_ANIMATION_ROLES.forEach((role) => {
      const option = document.createElement('option'); option.value = role; option.textContent = `Preview role: ${role}`; roleSelect.appendChild(option);
    });
    roleSelect.value = this.previewRole;
    roleSelect.onchange = () => { this.previewRole = roleSelect.value; };
    this.previewEl.appendChild(roleSelect);

    const info = h('pre', JSON.stringify({
      npcId: this.currentDraft.id,
      alignment: this.currentDraft.alignment,
      role: this.previewRole,
      stats: this.currentDraft.stats,
      dimensions: this.currentDraft.dimensions.collision
    }, null, 2));
    info.style.whiteSpace = 'pre-wrap';
    info.style.fontSize = '12px';
    this.previewEl.appendChild(info);

    const { warnings, errors } = this.registry.validateDefinition(this.currentDraft);
    const animationWarnings = await validateNpcAnimationRefs(this.currentDraft);
    this.validationWarnings = [...warnings, ...animationWarnings.warnings];
    const validation = h('div');
    validation.innerHTML = [
      ...(errors.length ? [`<div style="color:#ff8e8e">Errors: ${errors.join(' | ')}</div>`] : []),
      ...(this.validationWarnings.length ? [`<div style="color:#ffe16a">Warnings: ${this.validationWarnings.join(' | ')}</div>`] : ['<div style="color:#8ff0c8">Validation OK</div>'])
    ].join('');
    this.previewEl.appendChild(validation);
  }

  createNpc(alignment = 'impartial') {
    const draft = this.registry.createTemplate(alignment);
    this.selectedId = draft.id;
    this.currentDraft = draft;
    this.renderInspector();
    this.refreshList();
  }

  duplicateNpc() {
    if (!this.currentDraft) return;
    const next = `${this.currentDraft.id}-copy`;
    const duplicated = JSON.parse(JSON.stringify(this.currentDraft));
    duplicated.id = next;
    duplicated.name = `${duplicated.name} Copy`;
    this.currentDraft = duplicated;
    this.selectedId = duplicated.id;
    this.renderInspector();
  }

  deleteNpc() {
    if (!this.selectedId) return;
    this.registry.delete(this.selectedId);
    this.selectedId = this.registry.list()[0]?.id || null;
    this.loadSelectedDraft();
    this.refreshList();
  }

  saveCurrent() {
    if (!this.currentDraft) return;
    const previousId = this.registry.get(this.selectedId) ? this.selectedId : null;
    const result = this.registry.save(this.currentDraft, { previousId });
    this.selectedId = result.npc.id;
    this.currentDraft = JSON.parse(JSON.stringify(result.npc));
    this.refreshList();
    this.renderInspector();
    this.game.showSystemToast?.(`Saved NPC ${result.npc.name}`);
  }
}
