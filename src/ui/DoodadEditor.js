import {
  DEFAULT_RACE_DOODAD,
  getDoodadRuleForSpeed,
  normalizeDoodadBehavior,
  normalizeRaceDoodadDocument,
  serializeRaceDoodadDocument
} from '../racing/raceDoodads.js';
import { loadProjectFile, sanitizeProjectFileName, saveProjectFileAndConfirm } from './projectFiles.js';
import { openProjectBrowser } from './ProjectBrowserModal.js';
import {
  SHARED_EDITOR_LEFT_MENU,
  UI_SUITE,
  buildSharedEditorFileMenu,
  drawSharedDesktopContextPanel,
  drawSharedDesktopDropdown,
  drawSharedDesktopRibbon,
  drawSharedDesktopTopMenu,
  drawSharedFocusRing,
  drawSharedGamepadHintBar,
  drawSharedGamepadSlideOutHeader,
  drawSharedMenuButtonChrome,
  drawSharedMenuButtonLabel,
  drawSharedThumbstick,
  drawSharedPanel,
  drawSharedPortraitActionRail,
  getSharedMobilePortraitEditorLayout,
  renderSharedFileDrawer,
  resetSharedThumbstickState,
  splitFileDrawerStickyExitItems
} from './uiSuite.js';
import {
  applyDesktopDropdownWheelScrollState,
  buildCompactLandscapeCommandRailActions,
  buildCompactLandscapeCommandRailButtonLayout,
  buildDesktopDropdownRenderPlan,
  buildDesktopEditorShellPlan,
  buildGamepadSlideOutMenuPlan,
  buildLandscapeRootDrawerGridLayout,
  buildLandscapeTouchEditorShellPlan,
  canRenderEditorPlanSurface,
  canRenderEditorSurface,
  createDesktopDropdownCommandHit,
  createDesktopRootMenuHit,
  createPendingDesktopDropdownHit,
  resolveGamepadMenuState,
  resolveClosedDesktopDropdownState,
  resolveDesktopDropdownHoverSwitch,
  resolveDesktopDropdownRootId,
  resolveDesktopDropdownState,
  resolveEditorViewportModeFlags,
  resolveOpenDesktopDropdownState,
  resolvePendingDesktopDropdownHit,
  shouldCloseDesktopDropdownOnPointerDown,
  updatePendingDesktopDropdownHit
} from './shared/editorMenuLayout.js';
import {
  getEditorDesktopLeftContextRoles,
  getEditorMenuSpec,
  getEditorTouchRootMenuEntries,
  getEditorRootMenuEntries
} from './shared/editorMenuSpec.js';
import { SHARED_EDITOR_GAMEPAD_HINTS } from './shared/input/editorInputActions.js';
import { drawSharedMobileZoomSlider } from './shared/mobileZoomSlider.js';
import { getRaceArtSpriteCanvasShared } from './shared/raceArtSpriteCanvas.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const BEHAVIOR_ORDER = ['collide', 'flatten', 'fly-off'];
const PORTRAIT_HOT_MENU_TABS = ['artwork', 'size', 'hitbox', 'collision'];
const BEHAVIOR_LABELS = {
  collide: 'Collide',
  flatten: 'Flatten',
  'fly-off': 'Fly Off'
};
const DOODAD_EDITOR_ID = 'doodad';

export default class DoodadEditor {
  constructor(game) {
    this.game = game;
    this.buttons = [];
    this.doodad = normalizeRaceDoodadDocument(DEFAULT_RACE_DOODAD);
    this.currentDocumentName = '';
    this.status = 'Ready';
    this.saveStatus = '';
    this.activeTab = 'art';
    this.mobileMenuOpen = false;
    this.mobileRootId = 'file';
    this.landscapeRootDrawerOpen = false;
    this.landscapeRootId = 'artwork';
    this.gamepadSubmenuOpen = false;
    this.gamepadFocusedItemId = null;
    this.portraitHotMenu = 'artwork';
    this.activeViewportMode = 'desktop';
    this.desktopDropdown = null;
    this.openDesktopDropdownRootId = null;
    this.closedDesktopDropdownRootId = null;
    this.desktopDropdownScroll = {};
    this.pendingDesktopDropdownHit = null;
    this.desktopDropdownRegions = [];
    this.artCanvasCache = new Map();
    this.sliderRegions = [];
    this.sliderDrag = null;
    this.lastStudioSprintPreviewOverlay = null;
    this.panJoystick = {
      center: { x: 0, y: 0 },
      radius: 0,
      knobRadius: 0,
      dx: 0,
      dy: 0,
      active: false,
      id: null
    };
  }

  update(_input, dt = 0) {
    if (!this.panJoystick.active) return;
    const frameScale = dt > 0 ? dt * 60 : 1;
    if (Math.abs(this.panJoystick.dy) > 0.05) {
      this.status = this.panJoystick.dy < 0 ? 'Preview up' : 'Preview down';
    }
    if (Math.abs(this.panJoystick.dx) > 0.05) {
      this.status = this.panJoystick.dx < 0 ? 'Preview left' : 'Preview right';
    }
    void frameScale;
  }

  getViewportMode(width, height) {
    return resolveEditorViewportModeFlags({
      editorId: DOODAD_EDITOR_ID,
      viewportWidth: width,
      viewportHeight: height,
      isMobile: Boolean(this.game?.deviceIsMobile || this.game?.isMobile),
      gamepadConnected: Boolean(this.game?.input?.isGamepadConnected?.() || this.game?.gamepadConnected)
    });
  }

  getDocumentName({ forceSaveAs = false } = {}) {
    if (!forceSaveAs && this.currentDocumentName) return this.currentDocumentName;
    return sanitizeProjectFileName(this.doodad.name || this.doodad.id || 'New Doodad') || 'New Doodad';
  }

  newDoodad() {
    this.doodad = normalizeRaceDoodadDocument(DEFAULT_RACE_DOODAD);
    this.currentDocumentName = '';
    this.status = 'New doodad';
  }

  async saveDoodad({ forceSaveAs = false } = {}) {
    if (forceSaveAs || !this.currentDocumentName) {
      if (typeof document !== 'undefined') {
        const picked = await openProjectBrowser({
          mode: 'saveAs',
          fixedFolder: 'doodads',
          initialFolder: 'doodads',
          initialName: this.getDocumentName({ forceSaveAs: true }),
          title: 'Save Doodad As'
        });
        if (picked?.action !== 'saveAs' || !picked.name) {
          this.status = 'Save cancelled';
          this.saveStatus = this.status;
          return null;
        }
        return this.saveDoodadToName(picked.name);
      }
    }
    return this.saveDoodadToName(this.getDocumentName({ forceSaveAs }));
  }

  async saveDoodadToName(name = '') {
    const clean = sanitizeProjectFileName(name || this.getDocumentName()) || 'New Doodad';
    const payload = serializeRaceDoodadDocument(this.doodad);
    this.status = 'Saving...';
    this.saveStatus = 'Saving...';
    try {
      await saveProjectFileAndConfirm('doodads', clean, payload, { timeoutMs: 60000 });
      this.currentDocumentName = clean;
      this.status = 'Saved';
      this.saveStatus = 'Saved';
      return { name: clean, data: payload };
    } catch (error) {
      if (typeof console !== 'undefined') console.warn('Doodad save sync failed', error);
      this.status = 'Save failed';
      this.saveStatus = 'Save failed';
      return null;
    }
  }

  loadDoodadDocument(data = {}, name = '') {
    const doodad = normalizeRaceDoodadDocument(data?.data || data, name);
    this.doodad = doodad;
    this.currentDocumentName = sanitizeProjectFileName(name || doodad.name || doodad.id);
    this.status = `Loaded ${doodad.name}`;
    return true;
  }

  openDoodad() {
    if (typeof document === 'undefined') {
      const name = this.currentDocumentName || this.getDocumentName();
      const payload = loadProjectFile('doodads', name);
      if (payload?.data) return this.loadDoodadDocument(payload.data, name);
      this.status = 'No saved doodad found';
      return false;
    }
    void openProjectBrowser({
      mode: 'open',
      fixedFolder: 'doodads',
      initialFolder: 'doodads',
      title: 'Open Doodad',
      onOpen: ({ name, payload }) => this.loadDoodadDocument(payload?.data, name)
    });
    return true;
  }

  async pickArt() {
    if (typeof document === 'undefined') {
      this.doodad.artRef = 'Test Art';
      this.artCanvasCache.delete(this.doodad.artRef);
      this.status = 'Art selected';
      return this.doodad.artRef;
    }
    const picked = await openProjectBrowser({
      mode: 'open',
      fixedFolder: 'art',
      initialFolder: 'art',
      title: 'Pick Doodad Art'
    });
    if (picked?.action === 'open' && picked.name) {
      this.doodad.artRef = String(picked.name || '').trim();
      this.artCanvasCache.delete(this.doodad.artRef);
      if (!this.doodad.name || this.doodad.name === DEFAULT_RACE_DOODAD.name) this.doodad.name = this.doodad.artRef;
      this.status = `Art: ${this.doodad.artRef}`;
      return this.doodad.artRef;
    }
    this.status = 'Art picker closed';
    return null;
  }

  getDoodadArtCanvas(artRef = this.doodad.artRef) {
    return getRaceArtSpriteCanvasShared(artRef, { cache: this.artCanvasCache });
  }

  adjust(field, delta) {
    if (field === 'width') this.doodad.widthM = clamp(Number(this.doodad.widthM || 0) + delta, 0.1, 80);
    if (field === 'height') this.doodad.heightM = clamp(Number(this.doodad.heightM || 0) + delta, 0.1, 120);
    if (field === 'ground-offset') this.doodad.groundOffsetM = clamp(Number(this.doodad.groundOffsetM || 0) + delta, -20, 20);
    if (field === 'hitbox-width') this.doodad.hitboxWidthM = clamp(Number(this.doodad.hitboxWidthM || this.doodad.widthM || 0) + delta, 0.1, 80);
    if (field === 'hitbox-height') this.doodad.hitboxHeightM = clamp(Number(this.doodad.hitboxHeightM || this.doodad.heightM || 0) + delta, 0.1, 120);
    if (field === 'weight') this.doodad.weightKg = clamp(Number(this.doodad.weightKg || 0) + delta, 0.1, 100000);
    if (field === 'rule30') this.cycleRuleBehavior(30);
    if (field === 'rule120') this.cycleRuleBehavior(120);
    this.doodad = normalizeRaceDoodadDocument(this.doodad);
    this.status = 'Doodad updated';
  }

  ensureEditableRules() {
    this.doodad = normalizeRaceDoodadDocument(this.doodad);
    const defaultRule = this.doodad.defaultRule || normalizeRaceDoodadDocument(DEFAULT_RACE_DOODAD).defaultRule;
    const rules = [...(this.doodad.rules || [])].sort((a, b) => Number(a.minSpeedMph || 0) - Number(b.minSpeedMph || 0));
    while (rules.length < 2) {
      const fallback = DEFAULT_RACE_DOODAD.rules[rules.length] || DEFAULT_RACE_DOODAD.rules[DEFAULT_RACE_DOODAD.rules.length - 1];
      rules.push({ ...fallback, damage: { ...(fallback.damage || {}) } });
    }
    rules.length = 2;
    rules[0].minSpeedMph = clamp(Math.round(Number(rules[0].minSpeedMph) || 30), 1, 219);
    rules[1].minSpeedMph = clamp(Math.round(Number(rules[1].minSpeedMph) || 120), rules[0].minSpeedMph + 1, 220);
    this.doodad.defaultRule = defaultRule;
    this.doodad.rules = rules;
    return { defaultRule, rules };
  }

  setRuleBehavior(ruleKey, behavior) {
    const clean = normalizeDoodadBehavior(behavior);
    const { defaultRule, rules } = this.ensureEditableRules();
    if (ruleKey === 'default') defaultRule.behavior = clean;
    else {
      const index = ruleKey === 'threshold-2' ? 1 : 0;
      rules[index].behavior = clean;
    }
    this.doodad = normalizeRaceDoodadDocument(this.doodad);
    this.status = `Collision: ${BEHAVIOR_LABELS[clean] || clean}`;
  }

  setRuleSpeed(ruleKey, speedMph) {
    const { rules } = this.ensureEditableRules();
    const index = ruleKey === 'threshold-2' ? 1 : 0;
    if (index === 0) {
      rules[0].minSpeedMph = clamp(Math.round(Number(speedMph) || 1), 1, Math.max(1, Number(rules[1].minSpeedMph || 220) - 1));
    } else {
      rules[1].minSpeedMph = clamp(Math.round(Number(speedMph) || 220), Number(rules[0].minSpeedMph || 1) + 1, 220);
    }
    this.doodad = normalizeRaceDoodadDocument(this.doodad);
    this.status = `Speed threshold: ${rules[index].minSpeedMph} mph`;
  }

  setSliderValue(key, value) {
    if (key === 'width') this.doodad.widthM = Math.round(clamp(Number(value) || 0.1, 0.1, 80) * 10) / 10;
    else if (key === 'height') this.doodad.heightM = Math.round(clamp(Number(value) || 0.1, 0.1, 120) * 10) / 10;
    else if (key === 'ground-offset') this.doodad.groundOffsetM = Math.round(clamp(Number(value) || 0, -20, 20) * 10) / 10;
    else if (key === 'hitbox-width') this.doodad.hitboxWidthM = Math.round(clamp(Number(value) || 0.1, 0.1, 80) * 10) / 10;
    else if (key === 'hitbox-height') this.doodad.hitboxHeightM = Math.round(clamp(Number(value) || 0.1, 0.1, 120) * 10) / 10;
    else if (key === 'weight') this.doodad.weightKg = Math.round(clamp(Number(value) || 0.1, 0.1, 100000) * 10) / 10;
    else if (key === 'threshold-1' || key === 'threshold-2') this.setRuleSpeed(key, value);
    this.doodad = normalizeRaceDoodadDocument(this.doodad);
    this.status = 'Doodad updated';
  }

  sliderValueFromX(region, pointerX) {
    const ratio = clamp((Number(pointerX || 0) - region.track.x) / Math.max(1, region.track.w), 0, 1);
    if (region.scale === 'log') {
      const minLog = Math.log(region.min);
      const maxLog = Math.log(region.max);
      return Math.exp(minLog + ratio * (maxLog - minLog));
    }
    return region.min + ratio * (region.max - region.min);
  }

  updateSliderFromX(region, pointerX) {
    if (!region) return;
    this.setSliderValue(region.key, this.sliderValueFromX(region, pointerX));
  }

  getSliderHit(payload = {}) {
    return this.sliderRegions.find((region) => (
      payload.x >= region.bounds.x
      && payload.x <= region.bounds.x + region.bounds.w
      && payload.y >= region.bounds.y
      && payload.y <= region.bounds.y + region.bounds.h
    ));
  }

  cycleRuleBehavior(speedMph) {
    const rule = this.doodad.rules.find((entry) => Number(entry.minSpeedMph) === speedMph) || this.doodad.rules[0];
    if (!rule) return;
    const current = BEHAVIOR_ORDER.indexOf(normalizeDoodadBehavior(rule.behavior));
    rule.behavior = BEHAVIOR_ORDER[(current + 1 + BEHAVIOR_ORDER.length) % BEHAVIOR_ORDER.length];
  }

  exitToMainMenu() {
    this.game?.exitDoodadEditor?.();
  }

  undo() {
    this.status = 'Nothing to undo';
  }

  redo() {
    this.status = 'Nothing to redo';
  }

  zoomFit() {
    this.status = 'Preview fit';
  }

  getDesktopActionHandlers() {
    return {
      new: () => this.newDoodad(),
      open: () => this.openDoodad(),
      save: () => this.saveDoodad(),
      'save-as': () => this.saveDoodad({ forceSaveAs: true }),
      export: () => this.saveDoodad({ forceSaveAs: true }),
      import: () => this.openDoodad(),
      'exit-main': () => this.exitToMainMenu(),
      undo: () => this.undo(),
      redo: () => this.redo(),
      'zoom-fit': () => this.zoomFit(),
      'pick-art': () => this.pickArt(),
      'width-down': () => this.adjust('width', -0.5),
      'width-up': () => this.adjust('width', 0.5),
      'height-down': () => this.adjust('height', -0.5),
      'height-up': () => this.adjust('height', 0.5),
      'ground-offset-down': () => this.adjust('ground-offset', -0.5),
      'ground-offset-up': () => this.adjust('ground-offset', 0.5),
      'weight-down': () => this.adjust('weight', -5),
      'weight-up': () => this.adjust('weight', 5),
      'hitbox-width-down': () => this.adjust('hitbox-width', -0.5),
      'hitbox-width-up': () => this.adjust('hitbox-width', 0.5),
      'hitbox-height-down': () => this.adjust('hitbox-height', -0.5),
      'hitbox-height-up': () => this.adjust('hitbox-height', 0.5),
      'collision-default-collide': () => this.setRuleBehavior('default', 'collide'),
      'collision-default-flatten': () => this.setRuleBehavior('default', 'flatten'),
      'collision-default-fly-off': () => this.setRuleBehavior('default', 'fly-off'),
      'collision-threshold-1-collide': () => this.setRuleBehavior('threshold-1', 'collide'),
      'collision-threshold-1-flatten': () => this.setRuleBehavior('threshold-1', 'flatten'),
      'collision-threshold-1-fly-off': () => this.setRuleBehavior('threshold-1', 'fly-off'),
      'collision-threshold-2-collide': () => this.setRuleBehavior('threshold-2', 'collide'),
      'collision-threshold-2-flatten': () => this.setRuleBehavior('threshold-2', 'flatten'),
      'collision-threshold-2-fly-off': () => this.setRuleBehavior('threshold-2', 'fly-off'),
      'preview-studio-sprint': () => { this.status = 'Studio Sprint preview active'; }
    };
  }

  getDoodadFileMenuItems() {
    const handlers = this.getDesktopActionHandlers();
    return buildSharedEditorFileMenu({
      actions: {
        new: handlers.new,
        open: handlers.open,
        save: handlers.save,
        'save-as': handlers['save-as'],
        export: handlers.export,
        import: handlers.import
      },
      extras: [{
        id: 'exit-main',
        label: 'Exit',
        onClick: handlers['exit-main']
      }],
      includeFooter: false
    }).map((item) => ({
      id: item.id,
      label: item.label,
      tooltip: item.tooltip,
      disabled: Boolean(item.disabled),
      onClick: item.onClick || item.action || null
    }));
  }

  getMenuItems(rootId = this.landscapeRootId) {
    if (rootId === 'file') return this.getDoodadFileMenuItems();
    const spec = getEditorMenuSpec(DOODAD_EDITOR_ID);
    const handlers = this.getDesktopActionHandlers();
    return [...(spec?.sections?.[rootId]?.actions || [])].map((id) => ({
      id,
      label: spec?.actions?.[id]?.label || id,
      disabled: !handlers[id],
      onClick: handlers[id] || null
    }));
  }

  toggleMobileMenu() {
    if (!this.mobileMenuOpen) this.mobileRootId = 'file';
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  selectMobileRoot(id) {
    this.mobileRootId = id;
    if (id === 'artwork') {
      this.portraitHotMenu = 'artwork';
      this.mobileMenuOpen = false;
    }
  }

  setPortraitHotMenu(id) {
    if (!PORTRAIT_HOT_MENU_TABS.includes(id)) return;
    this.portraitHotMenu = id;
  }

  cyclePortraitHotMenu() {
    const current = PORTRAIT_HOT_MENU_TABS.indexOf(this.portraitHotMenu);
    this.portraitHotMenu = PORTRAIT_HOT_MENU_TABS[(current + 1 + PORTRAIT_HOT_MENU_TABS.length) % PORTRAIT_HOT_MENU_TABS.length];
  }

  drawButton(ctx, bounds, label, active = false, disabled = false) {
    const color = drawSharedMenuButtonChrome(ctx, bounds, {
      active: active && !disabled,
      subtle: disabled
    });
    drawSharedMenuButtonLabel(ctx, bounds, label, {
      color: disabled ? UI_SUITE.colors.muted : color,
      fontSize: 12,
      maxWidth: bounds.w - 8
    });
  }

  registerButton(ctx, bounds, action) {
    this.drawButton(ctx, bounds, action.label, Boolean(action.active), Boolean(action.disabled));
    this.buttons.push({
      ...action,
      id: action.id,
      bounds: { ...bounds, id: action.id },
      onClick: action.disabled ? null : action.onClick
    });
  }

  draw(ctx, width, height) {
    this.buttons = [];
    this.sliderRegions = [];
    this.desktopDropdownRegions = [];
    const viewportMode = this.getViewportMode(width, height);
    this.activeViewportMode = viewportMode.mode;
    this.activeModeContract = viewportMode.modeContract;
    this.activeSpecModeContract = viewportMode.specModeContract;
    if (viewportMode.isMobilePortrait) {
      this.drawPortrait(ctx, width, height, viewportMode);
      return;
    }
    if (viewportMode.isDesktop) {
      this.drawDesktop(ctx, width, height);
      return;
    }
    this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });
    this.openDesktopDropdownRootId = null;
    this.closedDesktopDropdownRootId = null;
    this.drawWideTouch(ctx, width, height);
  }

  drawDesktop(ctx, width, height) {
    resetSharedThumbstickState(this.panJoystick);
    ctx.fillStyle = UI_SUITE.colors.background;
    ctx.fillRect(0, 0, width, height);
    const openDesktopRootId = resolveDesktopDropdownRootId({
      openRootId: this.openDesktopDropdownRootId,
      closedRootId: this.closedDesktopDropdownRootId,
      isDesktop: true
    });
    const shell = buildDesktopEditorShellPlan('doodad', {
      viewportWidth: width,
      viewportHeight: height,
      activeRootId: openDesktopRootId,
      rootEntries: getEditorRootMenuEntries(DOODAD_EDITOR_ID),
      contentRoles: getEditorDesktopLeftContextRoles(DOODAD_EDITOR_ID),
      dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0
    });
    this.desktopDropdown = resolveDesktopDropdownState({
      isDesktop: true,
      dropdown: shell.dropdown || null,
      previousDropdown: this.desktopDropdown
    });
    this.drawDesktopTopMenu(ctx, shell);
    drawSharedPanel(ctx, shell.leftColumn, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    this.drawDesktopLeftPanel(ctx, shell.leftRibbon, shell.leftOptions);
    drawSharedPanel(ctx, shell.workSurface, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    this.drawPreview(ctx, shell.workSurface);
    if (this.desktopDropdown && shell.dropdown) this.drawDesktopDropdown(ctx, shell);
  }

  drawDesktopTopMenu(ctx, shell) {
    drawSharedDesktopTopMenu(ctx, shell.topMenu, {
      activeId: this.desktopDropdown?.rootId || null,
      idPrefix: 'desktop-root:',
      registerButton: (button) => {
        const rootHit = createDesktopRootMenuHit(button, null, { idPrefix: 'desktop-root:' });
        this.buttons.push({
          ...rootHit,
          label: button.label,
          active: Boolean(button.active),
          onClick: () => {
            if (this.openDesktopDropdownRootId === button.id && !this.closedDesktopDropdownRootId) {
              const nextDropdown = resolveClosedDesktopDropdownState({
                dropdown: this.desktopDropdown,
                openRootId: this.openDesktopDropdownRootId,
                fallbackRootId: button.id
              });
              this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
              this.openDesktopDropdownRootId = nextDropdown.openRootId;
              this.desktopDropdown = nextDropdown.dropdown;
              return;
            }
            const nextDropdown = resolveOpenDesktopDropdownState({
              rootId: button.id,
              currentOpenRootId: this.openDesktopDropdownRootId,
              closedRootId: this.closedDesktopDropdownRootId,
              dropdown: this.desktopDropdown
            });
            if (nextDropdown) {
              this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
              this.openDesktopDropdownRootId = nextDropdown.openRootId;
              this.desktopDropdown = nextDropdown.dropdown;
            }
          }
        });
      }
    });
  }

  drawDesktopDropdown(ctx, shell) {
    const handlers = this.getDesktopActionHandlers();
    const items = (shell.dropdown.items || []).map((item) => ({
      ...item,
      onClick: handlers[item.id] || null
    }));
    const dropdownPlan = buildDesktopDropdownRenderPlan({
      dropdown: this.desktopDropdown?.rootId === shell.dropdown.rootId ? this.desktopDropdown : shell.dropdown,
      items,
      disableActionlessItems: true
    });
    drawSharedDesktopDropdown(ctx, dropdownPlan, {
      registerScrollRegion: (region) => {
        this.desktopDropdownRegions.push(region);
      },
      registerButton: ({ item, bounds }) => {
        const action = dropdownPlan.actionById.get(item.id) || item;
        this.buttons.push({
          ...createDesktopDropdownCommandHit(action, bounds, action.onClick),
          id: `desktop-action:${item.id}`,
          label: item.label,
          disabled: Boolean(action.disabled),
          onClick: action.onClick
        });
      }
    });
  }

  drawDesktopLeftPanel(ctx, ribbonBounds, panelBounds) {
    drawSharedDesktopRibbon(ctx, ribbonBounds, {
      title: 'Doodad',
      subtitle: this.doodad.name || 'Untitled'
    });
    drawSharedDesktopContextPanel(ctx, panelBounds, {
      lines: [
        `Active: ${this.landscapeRootId || this.mobileRootId || 'artwork'}`,
        `Artwork: ${this.doodad.artRef || 'None'}`
      ],
      status: this.saveStatus || this.status,
      contentRoles: getEditorDesktopLeftContextRoles(DOODAD_EDITOR_ID),
      padding: 12
    });
    const controlsBounds = {
      x: panelBounds.x,
      y: panelBounds.y + 80,
      w: panelBounds.w,
      h: Math.max(1, panelBounds.h - 88)
    };
    this.drawDesktopControls(ctx, controlsBounds);
  }

  drawDesktopControls(ctx, bounds) {
    const pad = 12;
    const gap = 10;
    const inner = {
      x: bounds.x + pad,
      y: bounds.y + pad,
      w: Math.max(1, bounds.w - pad * 2),
      h: Math.max(1, bounds.h - pad * 2)
    };
    const artworkH = clamp(Math.floor(inner.h * 0.18), 80, 98);
    const sizeH = clamp(Math.floor(inner.h * 0.34), 144, 184);
    const hitboxH = clamp(Math.floor(inner.h * 0.2), 88, 116);
    const artwork = { x: inner.x, y: inner.y, w: inner.w, h: artworkH };
    const size = { x: inner.x, y: artwork.y + artwork.h + gap, w: inner.w, h: sizeH };
    const hitbox = { x: inner.x, y: size.y + size.h + gap, w: inner.w, h: hitboxH };
    const collision = {
      x: inner.x,
      y: hitbox.y + hitbox.h + gap,
      w: inner.w,
      h: Math.max(120, inner.y + inner.h - (hitbox.y + hitbox.h + gap))
    };
    this.drawDoodadArtworkPanel(ctx, artwork);
    this.drawDoodadSizePanel(ctx, size);
    this.drawDoodadHitboxPanel(ctx, hitbox);
    this.drawDoodadCollisionPanel(ctx, collision);
  }

  drawWideTouch(ctx, width, height) {
    const gamepadMenuState = resolveGamepadMenuState({
      viewportWidth: width,
      viewportHeight: height,
      gamepadConnected: Boolean(this.game?.input?.isGamepadConnected?.() || this.game?.gamepadConnected),
      isMobile: Boolean(this.game?.deviceIsMobile || this.game?.isMobile),
      menuActive: Boolean(this.landscapeRootDrawerOpen || this.gamepadSubmenuOpen),
      activeMenuId: this.gamepadSubmenuOpen ? this.landscapeRootId : null
    });
    if (!gamepadMenuState.isLandscapeMenuMode) this.gamepadSubmenuOpen = false;
    const shell = buildLandscapeTouchEditorShellPlan('doodad', {
      viewportWidth: width,
      viewportHeight: height,
      bottomRailHeight: 68,
      reserveRightRail: !gamepadMenuState.isLandscapeMenuMode,
      reserveThumbstickSpace: true,
      capRightRailToLeftRailHeight: true
    });
    ctx.fillStyle = UI_SUITE.colors.background;
    ctx.fillRect(0, 0, width, height);
    const canRenderLandscapeRightSubmenu = canRenderEditorPlanSurface(shell, 'right-drawer')
      && canRenderEditorPlanSurface(shell, 'landscape-right-submenu');
    const canRenderLandscapeRootDrawer = canRenderEditorPlanSurface(shell, 'left-overlay-drawer');
    const work = shell.surfaces.workSurface;
    const preview = {
      x: work.x + 10,
      y: work.y + 10,
      w: Math.max(180, Math.floor((work.w - 30) * 0.5)),
      h: Math.max(1, work.h - 20)
    };
    const panel = {
      x: preview.x + preview.w + 10,
      y: preview.y,
      w: Math.max(160, work.x + work.w - (preview.x + preview.w + 20)),
      h: preview.h
    };
    drawSharedPanel(ctx, work, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    drawSharedPanel(ctx, preview, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    drawSharedPanel(ctx, panel, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    this.drawPreview(ctx, preview);
    this.drawControls(ctx, panel);
    this.drawLandscapeCommandRail(ctx, shell.surfaces.compactCommandRail, gamepadMenuState);
    if (shell.surfaces.toolOptions) this.drawLandscapeStatusRail(ctx, shell.surfaces.toolOptions);
    if (gamepadMenuState.isLandscapeMenuMode) {
      const gamepadPlan = buildGamepadSlideOutMenuPlan('doodad', {
        rootOpen: this.landscapeRootDrawerOpen,
        activeRootId: this.landscapeRootId,
        focusedItemId: this.gamepadFocusedItemId
      });
      const surface = shell.surfaces.rootDrawer;
      if (this.landscapeRootDrawerOpen) this.drawLandscapeRootDrawer(ctx, surface, { entries: gamepadPlan.rootEntries, gamepad: true, headerHint: gamepadPlan.headerHint });
      else if (this.gamepadSubmenuOpen) this.drawLandscapeSubmenu(ctx, surface, { items: gamepadPlan.submenu?.items || [], gamepad: true, headerHint: gamepadPlan.headerHint });
      if (canRenderEditorSurface(this.activeViewportMode, 'gamepad-hint-bar')) {
        this.drawGamepadHintBar(ctx, {
          x: work.x + 12,
          y: work.y + Math.max(8, work.h - 36),
          w: Math.max(240, work.w - 24),
          h: 28
        }, 'Doodad Editor');
      }
      resetSharedThumbstickState(this.panJoystick);
      return;
    }
    if (this.landscapeRootDrawerOpen && canRenderLandscapeRootDrawer) {
      this.drawLandscapeRootDrawer(ctx, shell.surfaces.rootDrawer);
    }
    if (canRenderLandscapeRightSubmenu) {
      this.drawLandscapeSubmenu(ctx, shell.surfaces.submenu);
    }
    this.drawLandscapeThumbstick(ctx, shell);
  }

  drawLandscapeCommandRail(ctx, bounds, gamepadMenuState = {}) {
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    const actions = buildCompactLandscapeCommandRailActions({
      menu: {
        id: 'menu',
        label: 'Menu',
        active: this.landscapeRootDrawerOpen,
        onClick: () => {
          this.landscapeRootDrawerOpen = !this.landscapeRootDrawerOpen;
          if (gamepadMenuState.isLandscapeMenuMode) this.gamepadSubmenuOpen = false;
        }
      },
      undo: { id: 'undo', label: 'Undo', onClick: () => this.undo() },
      redo: { id: 'redo', label: 'Redo', onClick: () => this.redo() },
      quick: { id: 'pick-art', label: 'Art', onClick: () => this.pickArt() }
    });
    buildCompactLandscapeCommandRailButtonLayout({ bounds, actions })
      .forEach(({ action, bounds: buttonBounds }) => this.registerButton(ctx, buttonBounds, action));
  }

  drawLandscapeRootDrawer(ctx, bounds, { entries = null, gamepad = false, headerHint = null } = {}) {
    const roots = entries || getEditorTouchRootMenuEntries(DOODAD_EDITOR_ID);
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    if (gamepad) drawSharedGamepadSlideOutHeader(ctx, bounds, 'Doodad', { hint: headerHint || undefined });
    const grid = buildLandscapeRootDrawerGridLayout({
      bounds,
      itemCount: roots.length,
      minItemWidth: gamepad ? 120 : 96,
      itemHeight: 38,
      gap: 8,
      padding: 10,
      headerHeight: gamepad ? 50 : 0
    });
    roots.forEach((entry, index) => {
      const buttonBounds = grid.items[index]?.bounds;
      if (!buttonBounds) return;
      this.registerButton(ctx, buttonBounds, {
        id: entry.id,
        label: entry.label,
        active: this.landscapeRootId === entry.id,
        focused: gamepad && Boolean(entry.focused),
        onClick: () => {
          if (entry.id === 'exit-main') {
            this.exitToMainMenu();
            return;
          }
          this.landscapeRootId = entry.id;
          this.mobileRootId = entry.id === 'file' ? 'file' : 'artwork';
          if (gamepad) {
            this.landscapeRootDrawerOpen = false;
            this.gamepadSubmenuOpen = true;
            this.gamepadFocusedItemId = entry.id;
          }
        }
      });
      if (gamepad && entry.focused) drawSharedFocusRing(ctx, buttonBounds);
    });
  }

  drawLandscapeSubmenu(ctx, bounds, { items = null, gamepad = false, headerHint = null } = {}) {
    const source = Array.isArray(items) ? items : this.getMenuItems(this.landscapeRootId);
    if (!source.length) return;
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    if (gamepad) drawSharedGamepadSlideOutHeader(ctx, bounds, 'Doodad', { hint: headerHint || undefined });
    const listBounds = gamepad
      ? { x: bounds.x, y: bounds.y + 50, w: bounds.w, h: Math.max(1, bounds.h - 50) }
      : bounds;
    this.drawActionRows(ctx, listBounds, source.map((item) => ({
      id: item.id,
      label: item.label,
      disabled: item.disabled,
      active: gamepad && item.id === this.gamepadFocusedItemId,
      focused: gamepad && Boolean(item.focused),
      onClick: () => {
        this.gamepadFocusedItemId = item.id;
        item.onClick?.();
      }
    })), 1, { showFocusRing: gamepad });
  }

  drawLandscapeStatusRail(ctx, bounds) {
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `800 13px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.doodad.name || 'Doodad', bounds.x + 14, bounds.y + 22, Math.max(1, bounds.w - 28));
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `12px ${UI_SUITE.font.family}`;
    ctx.fillText(this.saveStatus || this.status, bounds.x + 14, bounds.y + 46, Math.max(1, bounds.w - 28));
  }

  drawLandscapeThumbstick(ctx, shell) {
    if (!canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick')
      || !canRenderEditorPlanSurface(shell, 'touch-thumbstick')
      || !shell?.thumbstick) {
      resetSharedThumbstickState(this.panJoystick);
      return;
    }
    const { center, radius, knobRadius } = shell.thumbstick;
    this.panJoystick.center = center;
    this.panJoystick.radius = radius;
    this.panJoystick.knobRadius = knobRadius;
    drawSharedThumbstick(ctx, this.panJoystick);
  }

  drawGamepadHintBar(ctx, bounds, contextLabel) {
    drawSharedGamepadHintBar(ctx, bounds, contextLabel, SHARED_EDITOR_GAMEPAD_HINTS);
  }

  drawPortrait(ctx, width, height, viewportMode) {
    ctx.fillStyle = UI_SUITE.colors.background;
    ctx.fillRect(0, 0, width, height);
    const layout = getSharedMobilePortraitEditorLayout(width, height, {
      middleRailHeight: 50,
      maxBottomRailHeight: 92,
      topRatio: 0.56,
      sheetRatio: 0.56
    });
    const pad = 10;
    const preview = {
      x: layout.workSurface.x,
      y: layout.workSurface.y,
      w: layout.workSurface.w,
      h: Math.max(168, Math.floor(layout.workSurface.h * 0.48))
    };
    const hotMenu = {
      x: layout.workSurface.x,
      w: layout.workSurface.w,
      h: 42,
      y: layout.actionRail.y - pad - 42
    };
    const controls = {
      x: layout.workSurface.x,
      y: preview.y + preview.h + pad,
      w: layout.workSurface.w,
      h: Math.max(118, hotMenu.y - pad - (preview.y + preview.h + pad))
    };
    drawSharedPanel(ctx, preview, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    drawSharedPanel(ctx, controls, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    this.drawStudioSprintPreview(ctx, preview);
    this.drawPortraitHotPanel(ctx, controls);
    this.drawPortraitHotMenu(ctx, hotMenu);

    if (this.mobileMenuOpen) {
      this.drawPortraitMenuSheet(ctx, layout);
    }

    const portraitActionById = {
      menu: { id: 'menu', label: '☰', onClick: () => this.toggleMobileMenu(), active: this.mobileMenuOpen },
      undo: { id: 'undo', label: '↶', onClick: () => this.undo() },
      redo: { id: 'redo', label: '↷', onClick: () => this.redo() },
      context: { id: 'context', label: this.getPortraitHotMenuLabel(this.portraitHotMenu), onClick: () => this.cyclePortraitHotMenu() }
    };
    const actions = ['menu', 'undo', 'redo', 'context'].map((id) => portraitActionById[id]);
    const railLayout = drawSharedPortraitActionRail(ctx, layout.actionRail, this.panJoystick, actions, {
      reserveThumbstick: canRenderEditorSurface(viewportMode.mode, 'touch-thumbstick'),
      drawButton: (bounds, action) => this.registerButton(ctx, bounds, {
        id: action.id,
        label: action.label,
        active: action.active,
        onClick: action.onClick
      })
    });
    if (railLayout?.thumbstickCenter && canRenderEditorSurface(viewportMode.mode, 'touch-thumbstick')) {
      this.panJoystick.center = railLayout.thumbstickCenter;
      this.panJoystick.radius = railLayout.thumbstickRadius;
      this.panJoystick.knobRadius = railLayout.knobRadius;
    } else {
      resetSharedThumbstickState(this.panJoystick);
    }
  }

  drawPortraitMenuSheet(ctx, layout) {
    const roots = getEditorTouchRootMenuEntries(DOODAD_EDITOR_ID);
    if (!roots.some((entry) => entry.id === this.mobileRootId)) this.mobileRootId = 'file';
    drawSharedPanel(ctx, layout.menuSheet, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    this.drawActionRows(ctx, layout.rootRail, roots.map((root) => ({
      id: `root-${root.id}`,
      label: root.label,
      active: this.mobileRootId === root.id,
      onClick: () => this.selectMobileRoot(root.id)
    })), roots.length);
    const actions = this.mobileRootId === 'file'
      ? this.getDoodadFileMenuItems()
      : [];
    if (actions.length && this.mobileRootId === 'file') {
      const { listItems, exitItem } = splitFileDrawerStickyExitItems(actions);
      renderSharedFileDrawer(ctx, {
        panel: layout.subRail,
        items: listItems,
        title: '',
        rowHeight: SHARED_EDITOR_LEFT_MENU.buttonHeightMobile,
        rowGap: SHARED_EDITOR_LEFT_MENU.buttonGap,
        buttonHeight: SHARED_EDITOR_LEFT_MENU.buttonHeightMobile,
        isMobile: true,
        showTitle: false,
        drawPanel: false,
        footerMode: exitItem ? 'exit-only' : 'none',
        footerItem: exitItem,
        layoutMode: 'auto-grid',
        minColumnWidth: 118,
        maxColumns: 2,
        layout: {
          padding: SHARED_EDITOR_LEFT_MENU.panelPadding,
          headerHeight: 0,
          footerHeight: SHARED_EDITOR_LEFT_MENU.buttonHeightMobile,
          footerBottomPadding: SHARED_EDITOR_LEFT_MENU.panelPadding
        },
        drawButton: (buttonBounds, action) => this.registerButton(ctx, buttonBounds, action)
      });
    } else if (actions.length) {
      this.drawActionRows(ctx, layout.subRail, actions, 2);
    }
  }

  drawActionRows(ctx, bounds, actions, columns = 1, { showFocusRing = false } = {}) {
    const pad = bounds.h < 56 ? 4 : 8;
    const gap = 8;
    const safeColumns = Math.max(1, columns);
    const rowH = 36;
    const colW = Math.max(1, (bounds.w - pad * 2 - gap * (safeColumns - 1)) / safeColumns);
    actions.forEach((action, index) => {
      const row = Math.floor(index / safeColumns);
      const col = index % safeColumns;
      const buttonBounds = {
        x: bounds.x + pad + col * (colW + gap),
        y: bounds.y + pad + row * (rowH + gap),
        w: colW,
        h: rowH
      };
      if (buttonBounds.y + buttonBounds.h > bounds.y + bounds.h - pad) return;
      this.registerButton(ctx, buttonBounds, action);
      if (showFocusRing && action.focused) drawSharedFocusRing(ctx, buttonBounds);
    });
  }

  drawStudioSprintPreview(ctx, bounds) {
    ctx.save();
    ctx.fillStyle = '#101818';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    this.lastStudioSprintPreviewOverlay = null;
    if (this.drawEmbeddedStudioSprintPreview(ctx, bounds)) {
      ctx.fillStyle = 'rgba(8,13,10,0.62)';
      ctx.fillRect(bounds.x + 10, bounds.y + 10, Math.min(bounds.w - 20, 188), 34);
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `800 13px ${UI_SUITE.font.family}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Studio Sprint Preview', bounds.x + 20, bounds.y + 27, Math.max(1, bounds.w - 40));
      ctx.restore();
      return;
    }
    const horizon = bounds.y + Math.floor(bounds.h * 0.38);
    const roadBottom = bounds.y + bounds.h - 10;
    const centerX = bounds.x + bounds.w / 2;
    const previewSource = this.game?.carEditor || this.game?.raceEditor || null;
    if (typeof previewSource?.drawCarEditorStudioSprintPreviewRoad === 'function') {
      previewSource.getCarEditorPreviewRace?.();
      previewSource.drawCarEditorStudioSprintPreviewRoad(ctx, bounds, { phase: 0.18 });
    } else {
      this.drawFallbackStudioSprintRoad(ctx, bounds);
    }

    const art = this.getDoodadArtCanvas();
    const aspect = Math.max(0.2, Number(this.doodad.widthM || 1) / Math.max(0.2, Number(this.doodad.heightM || 1)));
    [
      { depth: 0.28, side: -1.12 },
      { depth: 0.42, side: 1.08 },
      { depth: 0.6, side: -0.9 },
      { depth: 0.82, side: 0.76 }
    ].forEach((placement) => {
      const scale = placement.depth * placement.depth;
      const baseY = horizon + (roadBottom - horizon) * placement.depth;
      const laneHalf = bounds.w * (0.1 + placement.depth * 0.34);
      const x = centerX + laneHalf * placement.side;
      const spriteH = clamp(bounds.h * (0.16 + scale * 0.32) * Math.max(0.35, Number(this.doodad.heightM || 1) / 4), 18, bounds.h * 0.66);
      const spriteW = clamp(spriteH * aspect, 10, bounds.w * 0.42);
      const sx = x - spriteW / 2;
      const plantPx = spriteH * (Number(this.doodad.groundOffsetM || 0) / Math.max(0.1, Number(this.doodad.heightM || 1)));
      const sy = baseY - spriteH + plantPx;
      if (art && typeof ctx.drawImage === 'function') {
        ctx.drawImage(art, sx, sy, spriteW, spriteH);
      } else {
        ctx.fillStyle = 'rgba(96,160,84,0.86)';
        ctx.fillRect(sx, sy, spriteW, spriteH);
        ctx.strokeStyle = UI_SUITE.colors.accent;
        ctx.strokeRect(sx, sy, spriteW, spriteH);
      }
      this.drawDoodadHitboxPreview(ctx, {
        x,
        groundY: baseY + plantPx,
        spriteW,
        spriteH
      });
    });

    ctx.fillStyle = 'rgba(8,13,10,0.62)';
    ctx.fillRect(bounds.x + 10, bounds.y + 10, Math.min(bounds.w - 20, 188), 34);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `800 13px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Studio Sprint Preview', bounds.x + 20, bounds.y + 27, Math.max(1, bounds.w - 40));
    ctx.restore();
  }

  drawStudioSprintHitboxOverlay(ctx, bounds, overlay = null) {
    if (overlay?.previewSource && Array.isArray(overlay.scenery) && overlay.scenery.length) {
      const { previewSource, scenery } = overlay;
      const renderCamera = previewSource.lastRaceRenderCamera || {};
      const camera = renderCamera.camera || {};
      const cameraYaw = Number(renderCamera.cameraYaw || 0);
      scenery.forEach((sprite) => {
        if (!sprite) return;
        const surfaceModel = typeof previewSource.getRaceSurfaceModel === 'function'
          ? previewSource.getRaceSurfaceModel()
          : null;
        const terrain = surfaceModel?.sampleWorld?.({ x: sprite.x, z: sprite.z }, 0) || { elevation: 0 };
        const projected = typeof previewSource.projectRaceWorldPointToCamera === 'function'
          ? previewSource.projectRaceWorldPointToCamera({
            x: Number(sprite.x || 0),
            z: Number(sprite.z || 0),
            elevation: Number(terrain.elevation || 0) - (Number(this.doodad.groundOffsetM || 0) / 12)
          }, camera, cameraYaw, bounds)
          : null;
        if (!projected?.visible) return;
        const top = previewSource.projectRaceWorldPointToCamera({
          x: Number(sprite.x || 0),
          z: Number(sprite.z || 0),
          elevation: Number(terrain.elevation || 0) - (Number(this.doodad.groundOffsetM || 0) / 12) + (Number(this.doodad.heightM || 2) / 12)
        }, camera, cameraYaw, bounds);
        const spriteH = clamp(Math.abs(Number(projected.screenY || 0) - Number(top?.screenY || projected.screenY || 0)), 6, bounds.h * 0.72);
        const spriteW = clamp(spriteH * Math.max(0.2, Number(this.doodad.widthM || 1) / Math.max(0.2, Number(this.doodad.heightM || 1))), 4, bounds.w * 0.42);
        this.drawDoodadHitboxPreview(ctx, {
          x: Number(projected.screenX || 0),
          groundY: Number(projected.screenY || 0),
          spriteW,
          spriteH
        });
      });
      return;
    }
    const horizon = bounds.y + Math.floor(bounds.h * 0.38);
    const roadBottom = bounds.y + bounds.h - 10;
    const centerX = bounds.x + bounds.w / 2;
    [
      { depth: 0.28, side: -1.12 },
      { depth: 0.42, side: 1.08 },
      { depth: 0.6, side: -0.9 },
      { depth: 0.82, side: 0.76 }
    ].forEach((placement) => {
      const scale = placement.depth * placement.depth;
      const baseY = horizon + (roadBottom - horizon) * placement.depth;
      const laneHalf = bounds.w * (0.1 + placement.depth * 0.34);
      const spriteH = clamp(bounds.h * (0.16 + scale * 0.32) * Math.max(0.35, Number(this.doodad.heightM || 1) / 4), 18, bounds.h * 0.66);
      const plantPx = spriteH * (Number(this.doodad.groundOffsetM || 0) / Math.max(0.1, Number(this.doodad.heightM || 1)));
      this.drawDoodadHitboxPreview(ctx, {
        x: centerX + laneHalf * placement.side,
        groundY: baseY + plantPx,
        spriteW: clamp(spriteH * Math.max(0.2, Number(this.doodad.widthM || 1) / Math.max(0.2, Number(this.doodad.heightM || 1))), 10, bounds.w * 0.42),
        spriteH
      });
    });
  }

  drawDoodadHitboxPreview(ctx, {
    x = 0,
    groundY = 0,
    spriteW = 1,
    spriteH = 1
  } = {}) {
    const visualWidth = Math.max(0.1, Number(this.doodad.widthM) || 1.5);
    const visualHeight = Math.max(0.1, Number(this.doodad.heightM) || 2);
    const hitboxWidth = Math.max(0.1, Number(this.doodad.hitboxWidthM ?? visualWidth) || visualWidth);
    const hitboxHeight = Math.max(0.1, Number(this.doodad.hitboxHeightM ?? visualHeight) || visualHeight);
    const boxW = clamp(Number(spriteW || 1) * (hitboxWidth / visualWidth), 4, Math.max(4, Number(spriteW || 1) * 2.4));
    const boxH = clamp(Number(spriteH || 1) * (hitboxHeight / visualHeight), 4, Math.max(4, Number(spriteH || 1) * 1.4));
    const left = Number(x || 0) - boxW / 2;
    const top = Number(groundY || 0) - boxH;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,64,64,0.95)';
    ctx.fillStyle = 'rgba(255,64,64,0.12)';
    ctx.lineWidth = 2;
    ctx.fillRect(left, top, boxW, boxH);
    ctx.strokeRect(left, top, boxW, boxH);
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(Number(x || 0), Number(groundY || 0), boxW / 2, Math.max(3, boxW * 0.16), 0, 0, Math.PI * 2);
    } else {
      ctx.rect(left, Number(groundY || 0) - Math.max(3, boxW * 0.16), boxW, Math.max(6, boxW * 0.32));
    }
    ctx.stroke();
    ctx.restore();
  }

  drawEmbeddedStudioSprintPreview(ctx, bounds) {
    const previewSource = this.game?.carEditor || this.game?.raceEditor || null;
    if (typeof previewSource?.bindCarEditorPreviewPlaytest !== 'function'
      || typeof previewSource?.drawRacePlaytestScreen !== 'function') {
      return false;
    }
    let drew = false;
    const result = previewSource.bindCarEditorPreviewPlaytest(() => {
      const race = previewSource.selectedRace;
      if (!race) return false;
      const previousScenery = Array.isArray(race.scenery) ? race.scenery : null;
      const previousButtonsLength = Array.isArray(previewSource.buttons) ? previewSource.buttons.length : null;
      const temporaryScenery = this.createStudioSprintPreviewScenery(previewSource);
      try {
        race.scenery = [
          ...(previousScenery || []),
          ...temporaryScenery
        ];
        previewSource.drawRacePlaytestScreen(ctx, bounds);
        this.lastStudioSprintPreviewOverlay = {
          previewSource,
          scenery: temporaryScenery.map((sprite) => ({ ...sprite }))
        };
        drew = true;
        return true;
      } finally {
        if (previousScenery) race.scenery = previousScenery;
        else delete race.scenery;
        if (previousButtonsLength !== null) previewSource.buttons.length = previousButtonsLength;
      }
    });
    return Boolean(result || drew);
  }

  createStudioSprintPreviewScenery(previewSource) {
    if (!String(this.doodad.artRef || '').trim()) return [];
    const previewDoodad = normalizeRaceDoodadDocument(this.doodad);
    const routeLength = Math.max(1, Number(previewSource?.playtestSession?.routeLength || previewSource?.getRaceRouteLength?.() || 1) || 1);
    const baseDistance = Number(previewSource?.playtestSession?.distance || 0) + 28;
    const placements = [
      { offset: 24, lateral: -3.2 },
      { offset: 48, lateral: 3 },
      { offset: 78, lateral: -4 },
      { offset: 116, lateral: 3.8 }
    ];
    return placements.map((placement, index) => {
      const distance = (baseDistance + placement.offset) % routeLength;
      const pose = typeof previewSource?.getRaceWorldPoseAtDistance === 'function'
        ? previewSource.getRaceWorldPoseAtDistance(distance, { routeLength, runtimeType: 'circuit' })
        : { x: placement.lateral, z: distance, yaw: 0 };
      const right = typeof previewSource?.getRaceRightVector === 'function'
        ? previewSource.getRaceRightVector(Number(pose.yaw || 0))
        : { x: -Math.cos(Number(pose.yaw || 0)), z: Math.sin(Number(pose.yaw || 0)) };
      return {
        id: `doodad-preview-${index}`,
        presetId: 'doodad',
        definitionId: this.doodad.id,
        artRef: this.doodad.artRef,
        label: this.doodad.name,
        previewDoodad,
        x: Number(pose.x || 0) + right.x * placement.lateral,
        z: Number(pose.z || 0) + right.z * placement.lateral,
        yaw: Number(pose.yaw || 0),
        trackDistance: distance,
        trackLateral: placement.lateral,
        widthM: Number(this.doodad.widthM) || 1.5,
        heightM: Number(this.doodad.heightM) || 2,
        groundOffsetM: Number(this.doodad.groundOffsetM) || 0,
        hitboxWidthM: Number(this.doodad.hitboxWidthM ?? this.doodad.widthM) || 1.5,
        hitboxHeightM: Number(this.doodad.hitboxHeightM ?? this.doodad.heightM) || 2,
        previewHitbox: true,
        behavior: this.doodad.defaultRule?.behavior || 'collide',
        weightKg: Number(this.doodad.weightKg) || 35,
        state: 'standing'
      };
    });
  }

  drawFallbackStudioSprintRoad(ctx, bounds) {
    const horizon = bounds.y + Math.floor(bounds.h * 0.38);
    const roadBottom = bounds.y + bounds.h - 10;
    const centerX = bounds.x + bounds.w / 2;
    ctx.fillStyle = '#6d98bd';
    ctx.fillRect(bounds.x + 1, bounds.y + 1, bounds.w - 2, Math.max(1, horizon - bounds.y));
    ctx.fillStyle = '#547a42';
    ctx.fillRect(bounds.x + 1, horizon, bounds.w - 2, Math.max(1, bounds.y + bounds.h - horizon - 1));
    ctx.fillStyle = '#45484a';
    ctx.beginPath();
    ctx.moveTo(centerX - bounds.w * 0.11, horizon);
    ctx.lineTo(centerX + bounds.w * 0.11, horizon);
    ctx.lineTo(bounds.x + bounds.w * 0.84, roadBottom);
    ctx.lineTo(bounds.x + bounds.w * 0.16, roadBottom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, horizon + 8);
    ctx.lineTo(centerX, roadBottom - 4);
    ctx.stroke();
  }

  drawPortraitHotMenu(ctx, bounds) {
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panelStrong, border: UI_SUITE.colors.border });
    const gap = 8;
    const buttonW = Math.floor((bounds.w - 20 - gap * (PORTRAIT_HOT_MENU_TABS.length - 1)) / PORTRAIT_HOT_MENU_TABS.length);
    PORTRAIT_HOT_MENU_TABS.forEach((id, index) => {
      this.registerButton(ctx, {
        x: bounds.x + 10 + index * (buttonW + gap),
        y: bounds.y + 7,
        w: buttonW,
        h: bounds.h - 14
      }, {
        id: `hot-${id}`,
        label: this.getPortraitHotMenuLabel(id),
        active: this.portraitHotMenu === id,
        onClick: () => this.setPortraitHotMenu(id)
      });
    });
  }

  getPortraitHotMenuLabel(id = '') {
    return {
      artwork: 'Art',
      size: 'Size',
      hitbox: 'Hitbox',
      collision: 'Collide'
    }[id] || 'Art';
  }

  drawPortraitHotPanel(ctx, bounds) {
    if (this.portraitHotMenu === 'size') {
      this.drawDoodadSizePanel(ctx, bounds);
      return;
    }
    if (this.portraitHotMenu === 'hitbox') {
      this.drawDoodadHitboxPanel(ctx, bounds);
      return;
    }
    if (this.portraitHotMenu === 'collision') {
      this.drawDoodadCollisionPanel(ctx, bounds);
      return;
    }
    this.drawDoodadArtworkPanel(ctx, bounds);
  }

  drawDoodadArtworkPanel(ctx, bounds) {
    const x = bounds.x + 14;
    let y = bounds.y + 18;
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `800 16px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.doodad.name || 'Doodad', x, y, bounds.w - 28);
    y += 30;
    this.registerButton(ctx, { x, y, w: 128, h: 34 }, { id: 'pick-art', label: 'Artwork', onClick: () => this.pickArt() });
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `12px ${UI_SUITE.font.family}`;
    ctx.fillText(this.doodad.artRef || 'No art selected', x + 140, y + 17, Math.max(1, bounds.w - 154));
    y += 50;
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.fillText(this.saveStatus || this.status, x, y, bounds.w - 28);
  }

  drawDoodadSizePanel(ctx, bounds) {
    const rows = [
      { id: 'width', label: 'Width', min: 0.1, max: 80, value: Number(this.doodad.widthM) || 1.5, format: (value) => `${value.toFixed(1)}m` },
      { id: 'height', label: 'Height', min: 0.1, max: 120, value: Number(this.doodad.heightM) || 2, format: (value) => `${value.toFixed(1)}m` },
      { id: 'ground-offset', label: 'Plant', min: -20, max: 20, value: Number(this.doodad.groundOffsetM) || 0, format: (value) => `${value.toFixed(1)}m` },
      { id: 'weight', label: 'Weight', min: 0.1, max: 100000, value: Number(this.doodad.weightKg) || 35, scale: 'log', format: (value) => `${Math.round(value)}kg` }
    ];
    rows.forEach((row, index) => {
      this.drawDoodadSlider(ctx, {
        x: bounds.x + 14,
        y: bounds.y + 10 + index * 36,
        w: bounds.w - 28,
        h: 34
      }, row);
    });
  }

  drawDoodadCollisionPanel(ctx, bounds) {
    const x = bounds.x + 14;
    const { defaultRule, rules } = this.ensureEditableRules();
    [
      { key: 'default', rule: defaultRule, label: 'Default' },
      { key: 'threshold-1', rule: rules[0], label: `${rules[0].minSpeedMph}+ mph` },
      { key: 'threshold-2', rule: rules[1], label: `${rules[1].minSpeedMph}+ mph` }
    ].forEach((entry, entryIndex) => {
      const y = bounds.y + 12 + entryIndex * 72;
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `700 12px ${UI_SUITE.font.family}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(entry.label, x, y + 12, Math.max(1, bounds.w - 28));
      const gap = 6;
      const buttonY = y + 24;
      const buttonW = Math.floor((bounds.w - 28 - gap * 2) / 3);
      BEHAVIOR_ORDER.forEach((behavior, index) => {
        this.registerButton(ctx, {
          x: x + index * (buttonW + gap),
          y: buttonY,
          w: buttonW,
          h: 28
        }, {
          id: `collision-${entry.key}-${behavior}`,
          label: BEHAVIOR_LABELS[behavior],
          active: normalizeDoodadBehavior(entry.rule.behavior) === behavior,
          onClick: () => this.setRuleBehavior(entry.key, behavior)
        });
      });
      if (entry.key !== 'default') {
        const sliderY = y + 54;
        this.drawDoodadSlider(ctx, {
          x,
          y: sliderY,
          w: bounds.w - 28,
          h: 30
        }, {
          id: entry.key,
          label: entry.key === 'threshold-1' ? 'Speed 1' : 'Speed 2',
          min: entry.key === 'threshold-1' ? 1 : Math.min(219, Number(rules[0].minSpeedMph || 1) + 1),
          max: entry.key === 'threshold-1' ? Math.max(2, Number(rules[1].minSpeedMph || 220) - 1) : 220,
          value: Number(entry.rule.minSpeedMph) || (entry.key === 'threshold-1' ? 30 : 120),
          format: (value) => `${Math.round(value)} mph`
        });
      }
    });
  }

  drawDoodadHitboxPanel(ctx, bounds) {
    const rows = [
      { id: 'hitbox-width', label: 'Hit Width', min: 0.1, max: 80, value: Number(this.doodad.hitboxWidthM ?? this.doodad.widthM) || 1.5, format: (value) => `${value.toFixed(1)}m` },
      { id: 'hitbox-height', label: 'Hit Height', min: 0.1, max: 120, value: Number(this.doodad.hitboxHeightM ?? this.doodad.heightM) || 2, format: (value) => `${value.toFixed(1)}m` }
    ];
    rows.forEach((row, index) => {
      this.drawDoodadSlider(ctx, {
        x: bounds.x + 14,
        y: bounds.y + 18 + index * 44,
        w: bounds.w - 28,
        h: 38
      }, row);
    });
  }

  drawDoodadSlider(ctx, bounds, row) {
    const min = Number(row.min) || 0;
    const max = Number(row.max) || 1;
    const value = clamp(Number(row.value) || min, min, max);
    const ratio = row.scale === 'log'
      ? clamp((Math.log(Math.max(min, value)) - Math.log(min)) / Math.max(0.0001, Math.log(max) - Math.log(min)), 0, 1)
      : clamp((value - min) / Math.max(0.0001, max - min), 0, 1);
    const track = { x: bounds.x + 82, y: bounds.y + 24, w: Math.max(1, bounds.w - 94), h: 6 };
    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 11px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.label, bounds.x, bounds.y + 14, 72);
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.textAlign = 'right';
    ctx.fillText(row.format(value), bounds.x + bounds.w, bounds.y + 14, 64);
    drawSharedMobileZoomSlider(ctx, track, ratio, {
      knobColor: UI_SUITE.colors.accent,
      railColor: 'rgba(255,255,255,0.14)',
      railStroke: 'rgba(217,230,210,0.22)',
      alpha: 1
    });
    ctx.restore();
    this.sliderRegions.push({
      id: `doodad-${row.id}-slider`,
      key: row.id,
      min,
      max,
      scale: row.scale || 'linear',
      bounds: { x: track.x - 12, y: bounds.y, w: track.w + 24, h: bounds.h },
      track
    });
  }

  drawPreview(ctx, bounds) {
    const groundY = bounds.y + bounds.h - 42;
    ctx.save();
    ctx.strokeStyle = 'rgba(217,230,210,0.22)';
    ctx.beginPath();
    ctx.moveTo(bounds.x + 20, groundY);
    ctx.lineTo(bounds.x + bounds.w - 20, groundY);
    ctx.stroke();
    const aspect = Math.max(0.1, Number(this.doodad.widthM || 1) / Math.max(0.1, Number(this.doodad.heightM || 1)));
    const h = Math.min(bounds.h - 90, 220);
    const w = clamp(h * aspect, 12, bounds.w - 60);
    const x = bounds.x + bounds.w / 2 - w / 2;
    const plantPx = h * (Number(this.doodad.groundOffsetM || 0) / Math.max(0.1, Number(this.doodad.heightM || 1)));
    const y = groundY - h + plantPx;
    ctx.fillStyle = 'rgba(96,160,84,0.8)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.accent;
    ctx.strokeRect(x, y, w, h);
    this.drawDoodadHitboxPreview(ctx, {
      x: bounds.x + bounds.w / 2,
      groundY: groundY + plantPx,
      spriteW: w,
      spriteH: h
    });
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `700 12px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.doodad.artRef || 'No Art', bounds.x + bounds.w / 2, y + h / 2, Math.max(1, w - 8));
    ctx.restore();
  }

  drawControls(ctx, bounds) {
    const x = bounds.x + 14;
    let y = bounds.y + 18;
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `800 16px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.doodad.name || 'Doodad', x, y);
    y += 30;
    this.registerButton(ctx, { x, y, w: 120, h: 32 }, { id: 'pick-art', label: 'Art', onClick: () => this.pickArt() });
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `12px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.fillText(this.doodad.artRef || 'No art selected', x + 134, y + 16, Math.max(1, bounds.w - 154));
    y += 48;
    [
      ['width', 'Width', `${Number(this.doodad.widthM || 0).toFixed(1)}m`, 0.5],
      ['height', 'Height', `${Number(this.doodad.heightM || 0).toFixed(1)}m`, 0.5],
      ['weight', 'Weight', `${Math.round(Number(this.doodad.weightKg || 0))}kg`, 5]
    ].forEach(([id, label, value, step]) => {
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `700 12px ${UI_SUITE.font.family}`;
      ctx.fillText(`${label}: ${value}`, x, y + 16);
      this.registerButton(ctx, { x: bounds.x + bounds.w - 112, y, w: 42, h: 30 }, { id: `${id}-down`, label: '-', onClick: () => this.adjust(id, -step) });
      this.registerButton(ctx, { x: bounds.x + bounds.w - 62, y, w: 42, h: 30 }, { id: `${id}-up`, label: '+', onClick: () => this.adjust(id, step) });
      y += 38;
    });
    y += 8;
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `800 13px ${UI_SUITE.font.family}`;
    ctx.fillText('Impact Rules', x, y);
    y += 26;
    [0, 30, 120].forEach((speed) => {
      const rule = speed === 0 ? this.doodad.defaultRule : getDoodadRuleForSpeed(this.doodad, speed);
      const id = speed === 30 ? 'rule30' : speed === 120 ? 'rule120' : null;
      ctx.fillStyle = UI_SUITE.colors.muted;
      ctx.font = `12px ${UI_SUITE.font.family}`;
      ctx.fillText(`${speed === 0 ? 'Default' : `${speed}+ mph`}: ${String(rule.behavior || '').replace('-', ' ')} / drain ${Math.round(Number(rule.speedDrainPercent || 0))}%`, x, y + 15, bounds.w - 150);
      if (id) this.registerButton(ctx, { x: bounds.x + bounds.w - 116, y, w: 96, h: 30 }, { id, label: 'Cycle', onClick: () => this.adjust(id, 0) });
      y += 38;
    });
  }

  handlePointerDown(payload = {}) {
    this.pendingDesktopDropdownHit = null;
    if (this.activeViewportMode === 'desktop' && this.desktopDropdown) {
      const shouldClose = shouldCloseDesktopDropdownOnPointerDown({
        dropdown: this.desktopDropdown,
        point: payload,
        rootButtons: this.buttons,
        interactiveRegions: this.desktopDropdownRegions,
        rootIdKey: 'desktopRootId'
      });
      if (shouldClose) {
        const nextDropdown = resolveClosedDesktopDropdownState({
          rootId: this.desktopDropdown.rootId,
          dropdown: this.desktopDropdown
        });
        this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
        this.openDesktopDropdownRootId = nextDropdown.openRootId;
        this.desktopDropdown = nextDropdown.dropdown;
        return;
      }
    }
    if (this.activeViewportMode === 'desktop') {
      const desktopDropdownHit = [...this.buttons].reverse().find((button) => button.desktopDropdownItem
        && payload.x >= button.bounds.x
        && payload.x <= button.bounds.x + button.bounds.w
        && payload.y >= button.bounds.y
        && payload.y <= button.bounds.y + button.bounds.h);
      if (desktopDropdownHit) {
        this.pendingDesktopDropdownHit = createPendingDesktopDropdownHit(desktopDropdownHit, payload);
        return;
      }
      const desktopDropdownRegion = this.desktopDropdownRegions?.find((region) => {
        const bounds = region?.bounds || region;
        return bounds
          && payload.x >= bounds.x
          && payload.x <= bounds.x + bounds.w
          && payload.y >= bounds.y
          && payload.y <= bounds.y + bounds.h;
      });
      if (desktopDropdownRegion) return;
      const rootHit = this.buttons.find((button) => button.desktopRootId
        && payload.x >= button.bounds.x
        && payload.x <= button.bounds.x + button.bounds.w
        && payload.y >= button.bounds.y
        && payload.y <= button.bounds.y + button.bounds.h);
      if (rootHit) {
        rootHit.onClick?.();
        return;
      }
    }
    if (!this.mobileMenuOpen) {
      const sliderHit = this.getSliderHit(payload);
      if (sliderHit) {
        this.sliderDrag = { id: payload.id ?? 'pointer', region: sliderHit };
        this.updateSliderFromX(sliderHit, payload.x);
        return;
      }
    }
    if (canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick') && payload.touchCount > 0 && this.panJoystick.radius > 0) {
      const dx = payload.x - this.panJoystick.center.x;
      const dy = payload.y - this.panJoystick.center.y;
      if (Math.hypot(dx, dy) <= this.panJoystick.radius * 1.2) {
        this.panJoystick.active = true;
        this.panJoystick.id = payload.id ?? 'touch';
        this.updatePanJoystick(payload);
        return;
      }
    }
    const hit = [...this.buttons].reverse().find(({ bounds }) => (
      payload.x >= bounds.x
      && payload.x <= bounds.x + bounds.w
      && payload.y >= bounds.y
      && payload.y <= bounds.y + bounds.h
    ));
    hit?.onClick?.();
  }

  updatePanJoystick(payload = {}) {
    const dx = Number(payload.x || 0) - Number(this.panJoystick.center.x || 0);
    const dy = Number(payload.y || 0) - Number(this.panJoystick.center.y || 0);
    const radius = Math.max(1, Number(this.panJoystick.radius || 1));
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(radius, dist);
    const angle = Math.atan2(dy, dx);
    this.panJoystick.dx = Math.cos(angle) * (clamped / radius);
    this.panJoystick.dy = Math.sin(angle) * (clamped / radius);
  }

  handlePointerMove(payload = {}) {
    this.pendingDesktopDropdownHit = updatePendingDesktopDropdownHit(this.pendingDesktopDropdownHit, payload);
    if (this.activeViewportMode === 'desktop' && !payload.touchCount) {
      const hover = resolveDesktopDropdownHoverSwitch({
        buttons: this.buttons,
        point: payload,
        openRootId: this.openDesktopDropdownRootId,
        rootIdKey: 'desktopRootId'
      });
      if (hover) {
        const nextDropdown = resolveOpenDesktopDropdownState({
          rootId: hover.rootId,
          currentOpenRootId: this.openDesktopDropdownRootId,
          closedRootId: this.closedDesktopDropdownRootId,
          dropdown: this.desktopDropdown
        });
        if (nextDropdown) {
          this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
          this.openDesktopDropdownRootId = nextDropdown.openRootId;
          this.desktopDropdown = nextDropdown.dropdown;
        }
      }
    }
    if (this.sliderDrag && this.sliderDrag.id === (payload.id ?? 'pointer')) {
      this.updateSliderFromX(this.sliderDrag.region, payload.x);
      return;
    }
    if (this.panJoystick.active && (payload.id === undefined || this.panJoystick.id === payload.id || this.panJoystick.id === 'touch')) {
      this.updatePanJoystick(payload);
    }
  }

  handlePointerUp(payload = {}) {
    if (this.pendingDesktopDropdownHit) {
      const hit = this.pendingDesktopDropdownHit;
      this.pendingDesktopDropdownHit = null;
      const { shouldActivate } = resolvePendingDesktopDropdownHit(hit, payload);
      if (shouldActivate) {
        hit.onClick?.();
        const nextDropdown = resolveClosedDesktopDropdownState({
          dropdown: this.desktopDropdown,
          openRootId: this.openDesktopDropdownRootId,
          fallbackRootId: hit.sourceRootId || this.desktopDropdown?.rootId || this.openDesktopDropdownRootId
        });
        this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
        this.openDesktopDropdownRootId = nextDropdown.openRootId;
        this.desktopDropdown = nextDropdown.dropdown;
      }
      return;
    }
    if (this.sliderDrag && (payload.id === undefined || this.sliderDrag.id === (payload.id ?? 'pointer'))) {
      this.sliderDrag = null;
      return;
    }
    if (this.panJoystick.active && (payload.id === undefined || this.panJoystick.id === payload.id || this.panJoystick.id === 'touch')) {
      resetSharedThumbstickState(this.panJoystick);
    }
  }
  handleWheel(payload = {}) {
    const desktopDropdownScroll = applyDesktopDropdownWheelScrollState({
      dropdown: this.desktopDropdown,
      payload,
      scrollState: this.desktopDropdownScroll
    });
    if (!desktopDropdownScroll) return;
    this.desktopDropdownScroll = desktopDropdownScroll.scrollState;
  }
  handleGestureStart() {}
  handleGestureMove() {}
  handleGestureEnd() {}
}
