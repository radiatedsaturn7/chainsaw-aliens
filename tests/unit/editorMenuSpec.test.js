import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DESKTOP_DYNAMIC_EMPTY_SECTION_IDS,
  DESKTOP_FILE_BASELINE_ACTION_IDS,
  DESKTOP_FILE_FOOTER_ACTION_ID,
  EDIT_ACTION_ROLE_GROUPS,
  EDIT_ACTION_ROLE_ORDER,
  EDITOR_DESKTOP_LEFT_CONTEXT_ROLES,
  EDITOR_LAYOUT_MODES,
  EDITOR_MENU_PLACEMENTS,
  EDITOR_STANDARD_REFERENCE,
  GAMEPAD_MENU_PLACEMENT_SURFACES,
  GAMEPAD_MENU_RENDER_SURFACES,
  EDITOR_MENU_MODE_CONTRACTS,
  EDITOR_MENU_SPECS,
  PORTRAIT_DYNAMIC_EMPTY_SECTION_IDS,
  PORTRAIT_FORBIDDEN_ROOT_IDS,
  PORTRAIT_ROOT_MAX_ITEMS,
  REQUIRED_DESKTOP_ROOT_PREFIX,
  REQUIRED_EDIT_ACTION_IDS,
  REQUIRED_FILE_ACTION_IDS,
  SHARED_EDITOR_IDS,
  STANDARD_EDITOR_ACTION_RAIL_PREFIX,
  SUPPORTED_EDITOR_WORK_SURFACES,
  getEditorControllerRootMenuEntries,
  getEditorControllerRootMenuIds,
  getEditorDesktopControllerMenuId,
  getEditorDesktopControllerMenuIdForSection,
  getEditorDesktopLeftContextRoles,
  getEditorEditActionRole,
  getEditorDesktopRootIdForSection,
  getEditorMenuModeContract,
  getEditorMenuSpec,
  getEditorDesktopSectionId,
  getEditorMenuRuntimeId,
  getEditorMenuSpecIdForRuntime,
  getEditorMenuSection,
  getEditorPortraitRootMenuEntries,
  getEditorRootMenuEntries,
  getEditorRootMenuLabelMap,
  getEditorRootMenuIds,
  getEditorStandardRole,
  getStandardEditorActionRailIds,
  isEditorReferenceCandidate,
  validateEditorStandardReferenceMetadata,
  validateEditorMenuSpec,
  validateSharedEditorMenuSpecs
} from '../../src/ui/shared/editorMenuSpec.js';
import {
  MODE_INTERACTION_CONTRACTS,
  MODE_PRESENTATION_CONTRACTS
} from '../../src/ui/shared/editorMenuLayout.js';

const uiSpecSource = readFileSync(new URL('../../UISpec.md', import.meta.url), 'utf8');
const sectionForTest = (id, actions = []) => ({ id, label: id, actions });

test('shared editor menu specs validate for every editor', () => {
  assert.deepEqual(Object.keys(EDITOR_MENU_SPECS), SHARED_EDITOR_IDS);
  assert.deepEqual(validateSharedEditorMenuSpecs(), []);
  assert.deepEqual(Object.fromEntries(SHARED_EDITOR_IDS.map((editorId) => [
    editorId,
    EDITOR_MENU_SPECS[editorId].workSurface
  ])), {
    pixel: 'canvas',
    level: 'canvas',
    actor: 'stage',
    midi: 'grid',
    sfx: 'timeline',
    cutscene: 'stage',
    race: 'stage',
    car: 'stage',
    tile: 'grid',
    doodad: 'stage'
  });
  for (const editorId of SHARED_EDITOR_IDS) {
    const spec = EDITOR_MENU_SPECS[editorId];
    assert.ok(SUPPORTED_EDITOR_WORK_SURFACES.includes(spec.workSurface), editorId);
    assert.deepEqual(validateEditorMenuSpec(spec), []);
    Object.values(EDITOR_LAYOUT_MODES).forEach((mode) => {
      assert.ok(spec.placements[mode]);
      assert.ok(spec.modeContracts[mode]);
    });
  }
});

test('editor UI standard metadata identifies MIDI, Pixel, and comparison references', () => {
  assert.deepEqual(validateEditorStandardReferenceMetadata(), []);
  assert.equal(EDITOR_STANDARD_REFERENCE.primaryEditorId, 'midi');
  assert.equal(EDITOR_STANDARD_REFERENCE.secondaryEditorId, 'pixel');
  assert.deepEqual(EDITOR_STANDARD_REFERENCE.comparisonEditorIds, ['level', 'cutscene', 'actor']);
  assert.deepEqual(getEditorStandardRole('midi'), 'primary-reference');
  assert.deepEqual(getEditorStandardRole('pixel'), 'secondary-reference');
  assert.deepEqual(getEditorStandardRole('level'), 'comparison-reference');
  assert.equal(isEditorReferenceCandidate('cutscene'), true);
  assert.equal(isEditorReferenceCandidate('race'), false);
  assert.equal(getEditorStandardRole('sfx'), 'rollout-target');
  assert.equal(getEditorStandardRole('missing-editor'), null);
});

test('desktop left context roles are defined for every editor without command duplication language', () => {
  assert.equal(Object.isFrozen(EDITOR_DESKTOP_LEFT_CONTEXT_ROLES), true);
  for (const editorId of SHARED_EDITOR_IDS) {
    const roles = getEditorDesktopLeftContextRoles(editorId);
    assert.equal(roles.length >= 2, true, editorId);
    assert.deepEqual(roles, EDITOR_DESKTOP_LEFT_CONTEXT_ROLES[editorId], editorId);
    assert.equal(roles.some((role) => role.includes('menu') || role.includes('dropdown')), false, editorId);
  }
  assert.deepEqual(getEditorDesktopLeftContextRoles('midi'), ['active-tool', 'transport', 'global-music-settings', 'tracks']);
  assert.deepEqual(getEditorDesktopLeftContextRoles('pixel'), ['active-tool', 'swatches', 'layers', 'frames']);
  assert.deepEqual(getEditorDesktopLeftContextRoles('unknown'), []);
});

test('comparison editors share MIDI command surfaces while keeping editor-specific context roles', () => {
  const comparisonEditorIds = ['pixel', 'level', 'cutscene', 'actor'];
  const expectedContextRoles = {
    pixel: ['active-tool', 'swatches', 'layers', 'frames'],
    level: ['active-tool', 'tile-palette', 'actor-palette', 'selected-placement'],
    cutscene: ['insert-palette', 'selected-clip', 'timeline', 'scene-settings'],
    actor: ['actor-properties', 'state-list', 'linked-parts', 'preview-settings']
  };

  comparisonEditorIds.forEach((editorId) => {
    assert.equal(isEditorReferenceCandidate(editorId), true, editorId);
    assert.ok(['secondary-reference', 'comparison-reference'].includes(getEditorStandardRole(editorId)), editorId);
    assert.deepEqual(getEditorDesktopLeftContextRoles(editorId), expectedContextRoles[editorId], editorId);

    Object.values(EDITOR_LAYOUT_MODES).forEach((mode) => {
      assert.deepEqual(
        getEditorMenuModeContract(editorId, mode),
        getEditorMenuModeContract('midi', mode),
        `${editorId}:${mode}`
      );
    });
  });
});

test('menu spec validation catches unsupported work-surface metadata', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.tile);
  spec.workSurface = 'spreadsheet';

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'tile work surface type "spreadsheet" is unsupported.'
  ]);
});

test('shared editor menu specs expose mode contracts aligned with renderer contracts', () => {
  const modePairs = {
    [EDITOR_LAYOUT_MODES.PORTRAIT]: {
      rendererPresentation: MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.PORTRAIT],
      rendererInteraction: MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.PORTRAIT]
    },
    [EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]: {
      rendererPresentation: MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH],
      rendererInteraction: MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]
    },
    [EDITOR_LAYOUT_MODES.DESKTOP]: {
      rendererPresentation: MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP],
      rendererInteraction: MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP]
    },
    [EDITOR_LAYOUT_MODES.GAMEPAD]: {
      rendererPresentation: MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.GAMEPAD],
      rendererInteraction: MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.GAMEPAD]
    }
  };

  for (const editorId of SHARED_EDITOR_IDS) {
    Object.entries(modePairs).forEach(([mode, { rendererPresentation, rendererInteraction }]) => {
      const contract = getEditorMenuModeContract(editorId, mode);
      assert.deepEqual(contract, EDITOR_MENU_MODE_CONTRACTS[mode], `${editorId}:${mode}`);
      assert.equal(contract.rootSurface, rendererPresentation.rootSurface, `${editorId}:${mode}:root`);
      assert.equal(contract.commandSurface, rendererPresentation.commandSurface, `${editorId}:${mode}:command`);
      assert.equal(contract.pointerType, rendererInteraction.pointerType, `${editorId}:${mode}:pointer`);
      assert.equal(contract.rowActivation, rendererInteraction.rowActivation, `${editorId}:${mode}:activation`);
      assert.equal(contract.gestureScroll, rendererInteraction.gestureScroll, `${editorId}:${mode}:scroll`);
    });
  }

  assert.deepEqual(getEditorMenuModeContract('pixel', 'unknown-mode'), EDITOR_MENU_MODE_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP]);
});

test('gamepad placement aliases map to explicit left slide-out render surfaces', () => {
  assert.deepEqual(GAMEPAD_MENU_PLACEMENT_SURFACES, {
    root: 'left-slide-rail',
    submenu: 'slide-out-drawer',
    settings: 'slide-out-drawer'
  });
  assert.deepEqual(GAMEPAD_MENU_RENDER_SURFACES, {
    root: GAMEPAD_MENU_PLACEMENT_SURFACES.root,
    submenu: 'left-slide-out-drawer',
    command: 'left-slide-out-drawer',
    persistentContext: 'work-surface-overlay'
  });
  for (const editorId of SHARED_EDITOR_IDS) {
    const spec = EDITOR_MENU_SPECS[editorId];
    assert.deepEqual(spec.placements[EDITOR_LAYOUT_MODES.GAMEPAD], GAMEPAD_MENU_PLACEMENT_SURFACES, editorId);
    assert.equal(spec.modeContracts[EDITOR_LAYOUT_MODES.GAMEPAD].rootSurface, GAMEPAD_MENU_RENDER_SURFACES.root, editorId);
    assert.equal(spec.modeContracts[EDITOR_LAYOUT_MODES.GAMEPAD].submenuSurface, GAMEPAD_MENU_RENDER_SURFACES.submenu, editorId);
    assert.equal(spec.modeContracts[EDITOR_LAYOUT_MODES.GAMEPAD].commandSurface, GAMEPAD_MENU_RENDER_SURFACES.command, editorId);
    assert.equal(spec.modeContracts[EDITOR_LAYOUT_MODES.GAMEPAD].persistentContextSurface, GAMEPAD_MENU_RENDER_SURFACES.persistentContext, editorId);
  }
});

test('editor menu placements are independent per editor and from shared defaults', () => {
  for (const editorId of SHARED_EDITOR_IDS) {
    assert.notEqual(EDITOR_MENU_SPECS[editorId].placements, EDITOR_MENU_PLACEMENTS, editorId);
    Object.values(EDITOR_LAYOUT_MODES).forEach((mode) => {
      assert.notEqual(EDITOR_MENU_SPECS[editorId].placements[mode], EDITOR_MENU_PLACEMENTS[mode], `${editorId}:${mode}`);
    });
  }

  const originalPixelPortraitRoot = EDITOR_MENU_SPECS.pixel.placements[EDITOR_LAYOUT_MODES.PORTRAIT].root;
  const originalLevelPortraitRoot = EDITOR_MENU_SPECS.level.placements[EDITOR_LAYOUT_MODES.PORTRAIT].root;
  EDITOR_MENU_SPECS.pixel.placements[EDITOR_LAYOUT_MODES.PORTRAIT].root = 'test-mutated-root';

  try {
    assert.equal(EDITOR_MENU_PLACEMENTS[EDITOR_LAYOUT_MODES.PORTRAIT].root, 'bottom-rail');
    assert.equal(EDITOR_MENU_SPECS.level.placements[EDITOR_LAYOUT_MODES.PORTRAIT].root, originalLevelPortraitRoot);
  } finally {
    EDITOR_MENU_SPECS.pixel.placements[EDITOR_LAYOUT_MODES.PORTRAIT].root = originalPixelPortraitRoot;
  }
});

test('shared menu placement and mode-contract defaults are immutable', () => {
  assert.equal(Object.isFrozen(GAMEPAD_MENU_PLACEMENT_SURFACES), true);
  assert.equal(Object.isFrozen(GAMEPAD_MENU_RENDER_SURFACES), true);
  assert.equal(Object.isFrozen(EDITOR_MENU_PLACEMENTS), true);
  assert.equal(Object.isFrozen(EDITOR_MENU_MODE_CONTRACTS), true);
  Object.values(EDITOR_LAYOUT_MODES).forEach((mode) => {
    assert.equal(Object.isFrozen(EDITOR_MENU_PLACEMENTS[mode]), true, `placements:${mode}`);
    assert.equal(Object.isFrozen(EDITOR_MENU_MODE_CONTRACTS[mode]), true, `modeContracts:${mode}`);
  });
});

test('menu spec validation catches duplicate and missing action wiring', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.sfx);
  spec.root = ['timeline', 'file', 'edit', ...spec.root.slice(2), 'file'];
  spec.sections.timeline.actions.push('play');
  spec.sections.file.actions = spec.sections.file.actions.filter((id) => id !== 'open');
  spec.sections.edit.actions = spec.sections.edit.actions.filter((id) => id !== 'redo');
  delete spec.actions.stop;
  spec.aliases.timeline = 'file';
  spec.aliases.missingRoot = 'ghost';
  spec.sections.missingRoot = sectionForTest('missingRoot', ['play']);
  spec.aliases.layers = 'file';
  spec.portraitRoot.push({ id: 'ghost-panel', label: 'Ghost' });

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'sfx root menu "timeline" is duplicated.',
    'sfx root menu "file" is duplicated.',
    'sfx root menu 1 must be "file" for desktop menu consistency.',
    'sfx root menu 2 must be "edit" for desktop menu consistency.',
    'sfx root menu 3 must be "view" for desktop menu consistency.',
    'sfx portrait root menu "ghost-panel" does not resolve to a root menu, section, panel, or runtime alias.',
    'sfx file menu is missing required action "open".',
    'sfx edit menu is missing required action "redo".',
    'sfx section "timeline" duplicates action "play".',
    'sfx action "stop" is missing from actions map.',
    'sfx action "play" must have one shared menu owner; found in timeline, missingRoot.',
    'sfx alias "timeline" collides with root menu "file".',
    'sfx alias "missingRoot" is missing from root menus.',
    'sfx alias "layers" collides with root menu "file".',
    'sfx alias runtime id "file" is duplicated.'
  ]);
});

test('shared editor menu sections do not duplicate command ownership', () => {
  Object.entries(EDITOR_MENU_SPECS).forEach(([editorId, spec]) => {
    assert.equal(
      validateEditorMenuSpec(spec).some((error) => error.includes('must have one shared menu owner')),
      false,
      `${editorId} should have one shared menu owner per action`
    );
  });

  const spec = structuredClone(EDITOR_MENU_SPECS.level);
  spec.sections.assets.actions.push('tile-paint');
  assert.ok(validateEditorMenuSpec(spec).includes(
    'level action "tile-paint" must have one shared menu owner; found in tiles, assets.'
  ));
});

test('menu spec validation rejects unreachable stale sections', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.race);
  spec.sections.weather = sectionForTest('weather', ['weather-legacy']);
  spec.actions['weather-legacy'] = { id: 'weather-legacy', label: 'Legacy Weather' };

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'race section "weather" is not reachable from a root menu, portrait panel, or runtime alias.'
  ]);
});

test('menu spec validation catches misordered desktop File and Edit baselines', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.level);
  spec.sections.file.actions = ['save', 'new', 'save-as', 'open', 'export', 'import', 'exit-main'];
  spec.sections.edit.actions = ['redo', 'undo', 'copy', 'cut', 'paste', 'delete'];

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'level file menu action 1 must be "new" for desktop File dropdown consistency.',
    'level file menu action 2 must be "save" for desktop File dropdown consistency.',
    'level edit menu action 1 must be "undo" for desktop Edit dropdown consistency.',
    'level edit menu action 2 must be "redo" for desktop Edit dropdown consistency.'
  ]);
});

test('menu spec validation keeps Exit to Main Menu as the final File command', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.midi);
  spec.sections.file.actions = [
    'new',
    'save',
    'save-as',
    'open',
    'export',
    'import',
    'exit-main',
    'export-midi'
  ];

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'midi file menu must keep "exit-main" as the final File command.'
  ]);
});

test('menu spec validation keeps history and clipboard actions out of desktop File drawers', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.pixel);
  spec.sections.file.actions.splice(6, 0, 'undo', 'redo', 'copy-image', 'paste-image', 'copy');
  spec.actions['copy-image'] = { id: 'copy-image', label: 'Copy Image' };
  spec.actions['paste-image'] = { id: 'paste-image', label: 'Paste Image' };

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'pixel file menu must not include history action "undo"; use the Edit drawer instead.',
    'pixel file menu must not include history action "redo"; use the Edit drawer instead.',
    'pixel file menu must not include clipboard action "copy-image"; use the Edit drawer instead.',
    'pixel file menu must not include clipboard action "paste-image"; use the Edit drawer instead.',
    'pixel file menu must not include clipboard action "copy"; use the Edit drawer instead.',
    'pixel action "undo" must have one shared menu owner; found in file, edit.',
    'pixel action "redo" must have one shared menu owner; found in file, edit.',
    'pixel action "copy" must have one shared menu owner; found in file, edit.'
  ]);
});

test('menu spec validation keeps File-scoped document actions out of non-File drawers', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.cutscene);
  spec.sections.settings.actions.push('save', 'export', 'exit-main');

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'cutscene section "settings" must not include File action "save"; keep document actions in File.',
    'cutscene section "settings" must not include File action "export"; keep document actions in File.',
    'cutscene section "settings" must not include File action "exit-main"; keep document actions in File.',
    'cutscene action "save" must have one shared menu owner; found in file, settings.',
    'cutscene action "export" must have one shared menu owner; found in file, settings.',
    'cutscene action "exit-main" must have one shared menu owner; found in file, settings.'
  ]);
});

test('menu spec validation keeps desktop settings in dropdown drawers', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.level);
  spec.placements[EDITOR_LAYOUT_MODES.DESKTOP].settings = 'left-panel';

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'level desktop settings placement must use command dropdown "dropdown" instead of "left-panel".'
  ]);
});

test('menu spec validation keeps desktop context in the left context panel', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.sfx);
  spec.modeContracts[EDITOR_LAYOUT_MODES.DESKTOP].persistentContextSurface = 'left-panel';

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'sfx desktop persistent context surface must use left-context-panel instead of "left-panel".'
  ]);
});

test('menu spec validation keeps portrait roots and submenus bottom-first', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.cutscene);
  spec.placements[EDITOR_LAYOUT_MODES.PORTRAIT].root = 'top-tabs';
  spec.placements[EDITOR_LAYOUT_MODES.PORTRAIT].submenu = 'top-sheet';
  spec.placements[EDITOR_LAYOUT_MODES.PORTRAIT].settings = 'top-sheet';

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'cutscene portrait mode contract rootSurface must match placement root "top-tabs".',
    'cutscene portrait mode contract submenuSurface must match placement submenu "top-sheet".',
    'cutscene portrait root placement must use bottom-rail instead of "top-tabs".',
    'cutscene portrait submenu placement must use bottom-sheet instead of "top-sheet".',
    'cutscene portrait settings placement must use bottom-sheet instead of "top-sheet".'
  ]);
});

test('menu spec validation keeps mode interaction contracts aligned with renderer semantics', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.level);
  spec.modeContracts[EDITOR_LAYOUT_MODES.PORTRAIT].commandSurface = 'top-dropdown';
  spec.modeContracts[EDITOR_LAYOUT_MODES.PORTRAIT].rowActivation = 'release';
  spec.modeContracts[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH].commandSurface = 'top-dropdown';
  spec.modeContracts[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH].rowActivation = 'confirm-button';
  spec.modeContracts[EDITOR_LAYOUT_MODES.DESKTOP].pointerType = 'touch';
  spec.modeContracts[EDITOR_LAYOUT_MODES.DESKTOP].rowActivation = 'tap-release';
  spec.modeContracts[EDITOR_LAYOUT_MODES.DESKTOP].gestureScroll = true;
  spec.modeContracts[EDITOR_LAYOUT_MODES.GAMEPAD].pointerType = 'touch';
  spec.modeContracts[EDITOR_LAYOUT_MODES.GAMEPAD].gestureScroll = false;
  spec.modeContracts[EDITOR_LAYOUT_MODES.GAMEPAD].persistentContextSurface = 'right-drawer';

  const errors = validateEditorMenuSpec(spec);

  assert.ok(errors.includes('level portrait command surface must use bottom-sheet instead of "top-dropdown".'));
  assert.ok(errors.includes('level portrait row activation must use tap-release instead of "release".'));
  assert.ok(errors.includes('level landscape command surface must use right-drawer instead of "top-dropdown".'));
  assert.ok(errors.includes('level landscape row activation must use tap-release instead of "confirm-button".'));
  assert.ok(errors.includes('level desktop mode contract pointerType must match shared pointerType "mouse" instead of "touch".'));
  assert.ok(errors.includes('level desktop mode contract gestureScroll must match shared gestureScroll false instead of true.'));
  assert.ok(errors.includes('level gamepad mode contract pointerType must match shared pointerType "controller" instead of "touch".'));
  assert.ok(errors.includes('level gamepad mode contract gestureScroll must match shared gestureScroll true instead of false.'));
  assert.ok(errors.includes('level gamepad persistent context surface must use work-surface-overlay instead of "right-drawer".'));
});

test('menu spec validation keeps desktop-only roots out of portrait bottom menus', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.sfx);
  spec.portraitRoot.push({ id: 'edit', label: 'Edit' });

  assert.deepEqual(PORTRAIT_FORBIDDEN_ROOT_IDS, ['edit', 'view']);
  assert.deepEqual(validateEditorMenuSpec(spec), [
    'sfx portrait root menu must not expose desktop-only "edit" root; use the bottom rail or a workflow submenu instead.'
  ]);
});

test('menu spec validation caps portrait root rails to the shared bottom item limit', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.actor);
  spec.sections.extra = { id: 'extra', label: 'Extra', actions: ['extra-action'] };
  spec.actions['extra-action'] = { id: 'extra-action', label: 'Extra Action' };
  spec.portraitRoot = [
    ...spec.portraitRoot,
    { id: 'linked-parts', label: 'Linked Parts' },
    { id: 'visuals', label: 'Visuals' },
    { id: 'collision', label: 'Collision' },
    { id: 'behavior', label: 'Behavior' },
    { id: 'extra', label: 'Extra' }
  ];

  assert.equal(PORTRAIT_ROOT_MAX_ITEMS, 8);
  assert.deepEqual(validateEditorMenuSpec(spec), [
    `actor portraitRoot must expose no more than ${PORTRAIT_ROOT_MAX_ITEMS} bottom menu items.`
  ]);
});

test('menu spec validation rejects accidental blank portrait root panels', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.pixel);
  spec.sections.blank = sectionForTest('blank', []);
  spec.portraitRoot.push({ id: 'blank', label: 'Blank' });

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'pixel portrait root menu "blank" resolves to empty section "blank"; add actions or register it as a dynamic portrait panel.'
  ]);
});

test('shared portrait specs declare intentional dynamic empty panels', () => {
  assert.deepEqual(PORTRAIT_DYNAMIC_EMPTY_SECTION_IDS, {
    level: ['assets'],
    midi: ['settings'],
    sfx: ['settings'],
    cutscene: ['settings'],
    car: ['art']
  });
  for (const [editorId, sectionIds] of Object.entries(PORTRAIT_DYNAMIC_EMPTY_SECTION_IDS)) {
    sectionIds.forEach((sectionId) => {
      assert.deepEqual(getEditorMenuSection(editorId, sectionId).actions, [], `${editorId}:${sectionId}`);
    });
    assert.deepEqual(validateEditorMenuSpec(EDITOR_MENU_SPECS[editorId]), []);
  }
});

test('shared desktop specs declare intentional dynamic empty roots only', () => {
  assert.deepEqual(DESKTOP_DYNAMIC_EMPTY_SECTION_IDS, {
    midi: ['tracks'],
    car: ['art']
  });
  for (const [editorId, sectionIds] of Object.entries(DESKTOP_DYNAMIC_EMPTY_SECTION_IDS)) {
    sectionIds.forEach((sectionId) => {
      assert.deepEqual(getEditorMenuSection(editorId, sectionId).actions, [], `${editorId}:${sectionId}`);
      assert.equal(getEditorRootMenuIds(editorId).includes(sectionId), true, `${editorId}:${sectionId}`);
    });
    assert.deepEqual(validateEditorMenuSpec(EDITOR_MENU_SPECS[editorId]), []);
  }

  const spec = structuredClone(EDITOR_MENU_SPECS.sfx);
  spec.root.push('settings');
  assert.deepEqual(validateEditorMenuSpec(spec), [
    'sfx root menu "settings" resolves to empty section "settings"; remove it from desktop roots or add live actions.'
  ]);
});

test('menu spec validation keeps landscape roots left and submenus right', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.pixel);
  spec.placements[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH].root = 'right-rail';
  spec.placements[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH].submenu = 'left-drawer';
  spec.placements[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH].settings = 'left-drawer';
  spec.modeContracts[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH].persistentContextSurface = 'right-drawer';

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'pixel landscape-touch mode contract rootSurface must match placement root "right-rail".',
    'pixel landscape-touch mode contract submenuSurface must match placement submenu "left-drawer".',
    'pixel landscape root placement must use left-rail instead of "right-rail".',
    'pixel landscape submenu placement must use right-drawer instead of "left-drawer".',
    'pixel landscape settings placement must use right-drawer instead of "left-drawer".',
    'pixel landscape persistent context surface must use bottom-rail instead of "right-drawer".'
  ]);
});

test('menu spec validation keeps gamepad menus on left slide-out surfaces', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.actor);
  spec.placements[EDITOR_LAYOUT_MODES.GAMEPAD].root = 'left-rail';
  spec.placements[EDITOR_LAYOUT_MODES.GAMEPAD].submenu = 'right-drawer';
  spec.placements[EDITOR_LAYOUT_MODES.GAMEPAD].settings = 'right-drawer';
  spec.modeContracts[EDITOR_LAYOUT_MODES.GAMEPAD].commandSurface = 'right-drawer';
  spec.modeContracts[EDITOR_LAYOUT_MODES.GAMEPAD].rowActivation = 'tap-release';

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'actor gamepad mode contract rootSurface must match placement root "left-rail".',
    'actor gamepad mode contract submenuSurface must match placement submenu "right-drawer".',
    'actor gamepad root placement must use left-slide-rail instead of "left-rail".',
    'actor gamepad submenu placement must use slide-out-drawer instead of "right-drawer".',
    'actor gamepad settings placement must use slide-out-drawer instead of "right-drawer".',
    'actor gamepad command surface must use left-slide-out-drawer instead of "right-drawer".',
    'actor gamepad row activation must use confirm-button instead of "tap-release".'
  ]);
});

test('shared editor menu specs keep File, Edit, and View as required desktop roots', () => {
  for (const editorId of SHARED_EDITOR_IDS) {
    const spec = EDITOR_MENU_SPECS[editorId];
    assert.deepEqual(spec.root.slice(0, REQUIRED_DESKTOP_ROOT_PREFIX.length), REQUIRED_DESKTOP_ROOT_PREFIX, editorId);
    REQUIRED_FILE_ACTION_IDS.forEach((actionId) => {
      assert.ok(spec.sections.file.actions.includes(actionId), `${editorId} file menu should include ${actionId}`);
    });
    assert.deepEqual(
      spec.sections.file.actions.slice(0, DESKTOP_FILE_BASELINE_ACTION_IDS.length),
      DESKTOP_FILE_BASELINE_ACTION_IDS,
      `${editorId} file menu should use the shared desktop file order`
    );
    assert.equal(spec.sections.file.actions.at(-1), DESKTOP_FILE_FOOTER_ACTION_ID, `${editorId} file menu should end with Exit to Main Menu`);
    REQUIRED_EDIT_ACTION_IDS.forEach((actionId) => {
      assert.ok(spec.sections.edit.actions.includes(actionId), `${editorId} edit menu should include ${actionId}`);
    });
    assert.deepEqual(spec.sections.edit.actions.slice(0, 2), ['undo', 'redo'], `${editorId} edit menu should use the shared desktop edit order`);
  }
});

test('shared editor menu specs expose roles for every desktop Edit action', () => {
  assert.deepEqual(getEditorEditActionRole('undo'), 'history');
  assert.deepEqual(getEditorEditActionRole('copy-segment'), 'clipboard');
  assert.deepEqual(getEditorEditActionRole('delete-layer'), 'destructive');
  assert.deepEqual(getEditorEditActionRole('tile-edit-art'), 'targetEdit');
  assert.equal(getEditorEditActionRole('missing-action'), null);

  const roleActionIds = new Set(Object.values(EDIT_ACTION_ROLE_GROUPS).flat());
  for (const editorId of SHARED_EDITOR_IDS) {
    EDITOR_MENU_SPECS[editorId].sections.edit.actions.forEach((actionId) => {
      assert.ok(roleActionIds.has(actionId), `${editorId}:${actionId}`);
      assert.ok(getEditorEditActionRole(actionId), `${editorId}:${actionId}`);
    });
  }
});

test('menu spec validation catches Edit actions without shared roles', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.race);
  spec.sections.edit.actions.push('mirror-segment');
  spec.actions['mirror-segment'] = { id: 'mirror-segment', label: 'Mirror Segment' };

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'race edit action "mirror-segment" is missing a shared edit action role.'
  ]);
});

test('menu spec validation keeps desktop Edit role groups in shared order', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.midi);
  spec.sections.edit.actions = ['undo', 'redo', 'select-all', 'copy', 'cut', 'paste', 'delete'];

  assert.deepEqual(validateEditorMenuSpec(spec), [
    `midi edit action "copy" must not appear after a later Edit role group; expected role order is ${EDIT_ACTION_ROLE_ORDER.join(' > ')}.`,
    `midi edit action "cut" must not appear after a later Edit role group; expected role order is ${EDIT_ACTION_ROLE_ORDER.join(' > ')}.`,
    `midi edit action "paste" must not appear after a later Edit role group; expected role order is ${EDIT_ACTION_ROLE_ORDER.join(' > ')}.`
  ]);
});

test('shared editor menu specs preserve required root menu order', () => {
  assert.deepEqual(getEditorRootMenuIds('pixel'), ['file', 'edit', 'view', 'draw', 'select', 'tools', 'canvas', 'layers', 'frames', 'rigging']);
  assert.deepEqual(getEditorRootMenuIds('tile'), ['file', 'edit', 'view', 'tiles', 'properties']);
  assert.deepEqual(getEditorRootMenuIds('level'), ['file', 'edit', 'view', 'tools', 'tiles', 'tile-art', 'actors', 'triggers', 'powerups', 'structures', 'graphics', 'music', 'settings', 'playtest']);
  assert.deepEqual(getEditorRootMenuIds('actor'), ['file', 'edit', 'view', 'settings', 'states', 'linked-parts', 'visuals', 'collision', 'behavior', 'preview']);
  assert.deepEqual(getEditorRootMenuIds('midi'), ['file', 'edit', 'view', 'grid', 'song', 'tracks', 'record', 'pedals']);
  assert.deepEqual(getEditorRootMenuIds('sfx'), ['file', 'edit', 'view', 'timeline', 'layers', 'envelopes', 'generate', 'tools']);
  assert.deepEqual(getEditorRootMenuIds('cutscene'), ['file', 'edit', 'view', 'add', 'timeline', 'clips', 'keyframes', 'stage', 'audio']);
  assert.deepEqual(getEditorRootMenuIds('race'), ['file', 'edit', 'view', 'track', 'ground', 'sprites', 'settings']);
  assert.deepEqual(getEditorRootMenuIds('car'), ['file', 'edit', 'view', 'art', 'drivetrain', 'tuning', 'aero', 'suspension', 'drive']);
  assert.deepEqual(getEditorRootMenuIds('doodad'), ['file', 'edit', 'view', 'artwork', 'size', 'hitbox', 'collision', 'preview']);
});

test('Doodad shared menu spec exposes desktop document and settings drawers', () => {
  assert.deepEqual(getEditorMenuSection('doodad', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('doodad', 'edit').actions, ['undo', 'redo']);
  assert.deepEqual(getEditorMenuSection('doodad', 'artwork').actions, ['pick-art']);
  assert.ok(getEditorMenuSection('doodad', 'size').actions.includes('ground-offset-up'));
  assert.ok(getEditorMenuSection('doodad', 'hitbox').actions.includes('hitbox-width-down'));
  assert.ok(getEditorMenuSection('doodad', 'collision').actions.includes('collision-threshold-2-fly-off'));
  assert.deepEqual(getEditorDesktopLeftContextRoles('doodad'), ['active-tool', 'artwork-settings', 'size-settings', 'collision-settings']);
});

test('Tile shared menu spec keeps edit-art and reset commands in Edit only', () => {
  assert.deepEqual(getEditorMenuSection('tile', 'edit').actions, ['undo', 'redo', 'tile-edit-art', 'tile-reset']);
  assert.deepEqual(getEditorMenuSection('tile', 'tiles').actions, ['tile-prev', 'tile-next']);
  assert.equal(getEditorMenuSection('tile', 'tiles').actions.includes('tile-edit-art'), false);
  assert.equal(getEditorMenuSection('tile', 'tiles').actions.includes('tile-reset'), false);
  assert.equal(uiSpecSource.includes('- Tiles: previous tile, next tile. Edit owns edit tile art and reset tile override so target-edit/destructive commands have one desktop home.'), true);
  assert.equal(uiSpecSource.includes('- Tiles: previous tile, next tile, edit tile art, reset tile override.'), false);
});

test('Car Editor shared menu omits placeholder rows and keeps editable car fields', () => {
  assert.deepEqual(getEditorMenuSection('car', 'edit').actions, ['undo', 'redo']);
  assert.equal(getEditorMenuSection('car', 'edit').actions.includes('copy-layer'), false);
  assert.equal(getEditorMenuSection('car', 'edit').actions.includes('delete-layer'), false);
  assert.deepEqual(getEditorMenuSection('car', 'view').actions, ['zoom-fit']);
  assert.deepEqual(getEditorMenuSection('car', 'art').actions, []);
  assert.equal(getEditorMenuSection('car', 'view').actions.includes('preview-turns'), false);
  assert.equal(getEditorMenuSection('car', 'view').actions.includes('toggle-tires'), false);
  assert.equal(getEditorMenuSection('car', 'drivetrain').actions.includes('power-curve'), true);
  assert.equal(getEditorMenuSection('car', 'tuning').actions.includes('tire-grip'), false);
  assert.equal(getEditorMenuSection('car', 'tuning').actions.includes('final-drive'), true);
});

test('canonical UI spec root lists include the required desktop View root', () => {
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Draw, Select, Tools, Canvas, Layers, Frames, Rigging.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Tiles, Properties.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Tools, Tiles, Tile Art, Actors/NPCs, Triggers, Powerups, Structures, Graphics/Decals, Music, Settings, Playtest.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Settings, States, Linked Parts, Visuals, Collision, Behavior, Preview.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Grid, Song, Tracks/Mixer, Record, Pedals.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Timeline, Layers, Envelopes, Generate, Tools.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Add, Timeline, Clips, Keyframes, Stage, Audio.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Grid, Song, Tracks/Mixer, Record, Pedals, Settings.'), false);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Timeline, Layers, Envelopes, Generate, Tools, Settings.'), false);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Add, Timeline, Clips, Keyframes, Stage, Audio, Settings.'), false);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Track, Ground, Sprites, Settings.'), true);
  assert.equal(uiSpecSource.includes('- Portrait bottom menu: File, Track, Ground, Sprites, Settings.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Art, Drivetrain, Tuning, Aero, Suspension, Drive.'), true);
});

test('canonical UI spec avoids stale placeholder menu rows', () => {
  [
    'Layers: layer list',
    'Frames: frame list',
    'Rigging: bones, bind layer',
    'Song: play, stop, loop, tempo, arrangement.',
    'Tracks/Mixer: track list',
    'Record: virtual instruments',
    'Pedals: pedal board and mixer shortcuts.',
    'States: add, duplicate, delete, select state.',
    'Timeline: play, stop, scrub',
    'Layers: layer list, add',
    'Draw: pencil, brush, eraser, fill, line, shape, clone',
    'Select: rectangular select, ellipse select, lasso, magic tools, move, copy, cut, paste, clear.',
    'Canvas: grid, wrap, symmetry, tile preview',
    'Edit: undo, redo, select all, copy, cut, paste, delete.',
    'Clips: selected clip options, copy, cut, paste, duplicate, move to track, new track, delete.',
    'Stage: scene duration, fade, snap/grid, master volume.',
    'Export: MP4/export actions and progress.',
    'Keyframes: position, scale, opacity',
    'Race: circuit, destination',
    'Root: File, Edit, View, Race, Ground, Elevation, Sprites, Settings, Drive.',
    'Portrait bottom menu: File, Race, Ground, Elevation, Sprites, Settings, Drive.',
    'Road: draw road, segment length, curve, elevation, square turn, road width.',
    'Surfaces: selected ground tile, paint ground, selected-segment edge tile',
    'Weather: clear, rain, storm, snow.',
    '- Race: generate random race, draw road',
    '- Ground: selected ground tile.',
    '- Elevation: paint elevation'
  ].forEach((text) => {
    assert.equal(uiSpecSource.includes(text), false, `UISpec should not include stale placeholder row "${text}"`);
  });
  assert.equal(uiSpecSource.includes('Tracks/Mixer: dynamic track rows from the runtime mixer.'), true);
  assert.equal(uiSpecSource.includes('Pedals: pedal chain controls.'), true);
  assert.equal(uiSpecSource.includes('Timeline: play, stop, start, end.'), true);
  assert.equal(uiSpecSource.includes('Circuit versus point-to-point behavior is inferred from whether the route endpoints connect'), true);
  assert.equal(uiSpecSource.includes('there must not be explicit Circuit/Destination menu toggles.'), true);
  const raceSpec = getEditorMenuSpec('race');
  const raceActionIds = Object.values(raceSpec.sections).flatMap((entry) => entry.actions);
  assert.equal(raceActionIds.includes('race-circuit'), false);
  assert.equal(raceActionIds.includes('race-destination'), false);
  assert.equal(Object.hasOwn(raceSpec.actions, 'race-circuit'), false);
  assert.equal(Object.hasOwn(raceSpec.actions, 'race-destination'), false);
});

test('shared editor menu specs expose compact portrait bottom roots', () => {
  const expected = {
    pixel: ['file', 'draw', 'select', 'tools', 'canvas', 'layers', 'frames'],
    tile: ['file', 'tiles', 'properties'],
    level: ['file', 'tools', 'assets', 'settings'],
    actor: ['file', 'settings', 'states', 'preview'],
    midi: ['file', 'grid', 'song', 'instruments', 'virtual-instruments', 'pedals', 'settings'],
    sfx: ['file', 'generate', 'timeline', 'layers', 'envelopes', 'tools', 'settings'],
    cutscene: ['file', 'add', 'timeline', 'clips', 'keyframes', 'stage', 'audio', 'settings'],
    race: ['file', 'track', 'ground', 'sprites', 'settings'],
    car: ['file', 'art', 'drivetrain', 'tuning'],
    doodad: ['file', 'artwork']
  };

  Object.entries(expected).forEach(([editorId, ids]) => {
    const entries = getEditorPortraitRootMenuEntries(editorId);
    assert.deepEqual(entries.map((entry) => entry.id), ids, editorId);
    assert.ok(entries.length <= PORTRAIT_ROOT_MAX_ITEMS, `${editorId} portrait roots should fit the bottom rail`);
  });

  const cutsceneIds = getEditorPortraitRootMenuEntries('cutscene').map((entry) => entry.id);
  assert.equal(cutsceneIds.includes('export'), false);
  assert.ok(getEditorMenuSection('cutscene', 'file').actions.includes('export'));
  assert.equal(getEditorRootMenuIds('cutscene').includes('export'), false);
  assert.deepEqual(getEditorMenuSection('level', 'assets').actions, []);
  assert.equal(getEditorMenuSection('actor', 'actor'), null);
  assert.deepEqual(getEditorMenuSection('actor', 'settings').actions, ['actor-settings', 'metadata', 'aggression', 'loot-rules']);
  assert.equal(getEditorMenuSection('actor', 'tools'), null);
  assert.deepEqual(getEditorMenuSection('actor', 'preview').actions, ['play-scene']);
  assert.deepEqual(getEditorMenuSection('actor', 'states').actions, ['add-state', 'state-list']);
});

test('shared standard editor action rail keeps Menu, Undo, and Redo in one canonical order', () => {
  assert.deepEqual(STANDARD_EDITOR_ACTION_RAIL_PREFIX, ['menu', 'undo', 'redo']);
  assert.deepEqual(getStandardEditorActionRailIds('play'), ['menu', 'undo', 'redo', 'play']);
  assert.deepEqual(getStandardEditorActionRailIds('brush'), ['menu', 'undo', 'redo', 'brush']);
  assert.deepEqual(getStandardEditorActionRailIds(), ['menu', 'undo', 'redo']);
});

test('every editor portrait root menu stays bottom-rail sized', () => {
  for (const editorId of SHARED_EDITOR_IDS) {
    const entries = getEditorPortraitRootMenuEntries(editorId);
    assert.ok(entries.length > 0, `${editorId} should expose portrait roots`);
    assert.ok(entries.length <= PORTRAIT_ROOT_MAX_ITEMS, `${editorId} portrait root menu should have no more than ${PORTRAIT_ROOT_MAX_ITEMS} bottom items`);
    assert.equal(EDITOR_MENU_SPECS[editorId].placements[EDITOR_LAYOUT_MODES.PORTRAIT].root, 'bottom-rail', editorId);
    assert.equal(EDITOR_MENU_SPECS[editorId].placements[EDITOR_LAYOUT_MODES.PORTRAIT].submenu, 'bottom-sheet', editorId);
    assert.equal(EDITOR_MENU_SPECS[editorId].placements[EDITOR_LAYOUT_MODES.PORTRAIT].settings, 'bottom-sheet', editorId);
  }
});

test('menu specs include high-risk actions from the UI plan', () => {
  assert.deepEqual(getEditorMenuSection('pixel', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'clear']);
  assert.deepEqual(getEditorMenuSection('pixel', 'view').actions, ['zoom-in', 'zoom-out', 'zoom-fit', 'grid', 'tile-preview', 'onion']);
  assert.deepEqual(getEditorMenuSection('pixel', 'draw').actions, ['pencil', 'brush', 'fill', 'line', 'shape', 'brush-settings']);
  assert.equal(getEditorMenuSection('pixel', 'draw').actions.includes('eraser'), false);
  assert.equal(getEditorMenuSection('pixel', 'draw').actions.includes('clone'), false);
  assert.equal(getEditorMenuSection('pixel', 'tools').actions.includes('eraser'), true);
  assert.equal(getEditorMenuSection('pixel', 'tools').actions.includes('clone'), true);
  assert.deepEqual(getEditorMenuSection('pixel', 'canvas').actions, ['wrap', 'symmetry', 'resize', 'scale', 'crop', 'offset', 'import-image', 'export-image']);
  assert.equal(getEditorMenuSection('pixel', 'canvas').actions.includes('grid'), false);
  assert.equal(getEditorMenuSection('pixel', 'canvas').actions.includes('tile-preview'), false);
  assert.deepEqual(getEditorMenuSection('midi', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'select-all', 'delete']);
  assert.deepEqual(getEditorMenuSection('midi', 'view').actions, ['zoom-in', 'zoom-out', 'preview', 'contrast']);
  assert.deepEqual(getEditorMenuSection('actor', 'edit').actions, ['undo', 'redo', 'copy-state', 'paste-state', 'duplicate-state', 'delete-state']);
  assert.deepEqual(getEditorMenuSection('actor', 'view').actions, ['zoom-fit']);
  assert.deepEqual(getEditorMenuSection('sfx', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']);
  assert.deepEqual(getEditorMenuSection('sfx', 'view').actions, ['zoom-fit', 'loop']);
  assert.deepEqual(getEditorMenuSection('cutscene', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']);
  assert.deepEqual(getEditorMenuSection('cutscene', 'view').actions, ['view-canvas', 'view-split', 'view-timeline', 'timeline-zoom-out', 'timeline-zoom-in', 'timeline-fit']);
  assert.ok(getEditorMenuSection('pixel', 'layers').actions.includes('layer-merge-up'));
  assert.ok(getEditorMenuSection('pixel', 'layers').actions.includes('layer-merge-down'));
  assert.ok(getEditorMenuSection('level', 'playtest').actions.includes('playtest'));
  assert.deepEqual(getEditorMenuSection('actor', 'preview').actions, ['play-scene']);
  assert.ok(getEditorMenuSection('midi', 'song').actions.includes('tempo'));
  assert.ok(getEditorMenuSection('sfx', 'envelopes').actions.includes('pitch'));
  assert.equal(getEditorMenuSection('cutscene', 'export'), null);
  assert.equal(getEditorMenuSection('race', 'generate'), null);
  assert.deepEqual(getEditorMenuSection('race', 'file').actions.slice(6), ['generate-random-race', 'exit-main']);
  assert.equal(getEditorMenuSection('race', 'track').actions.includes('generate-random-race'), false);
  assert.equal(getEditorMenuSection('race', 'track').actions.includes('test-drive'), false);
  assert.equal(getEditorMenuSection('race', 'drive'), null);
  assert.deepEqual(getEditorMenuSection('race', 'file').actions.slice(0, DESKTOP_FILE_BASELINE_ACTION_IDS.length), DESKTOP_FILE_BASELINE_ACTION_IDS);
  assert.deepEqual(getEditorMenuSection('car', 'file').actions.slice(0, DESKTOP_FILE_BASELINE_ACTION_IDS.length), DESKTOP_FILE_BASELINE_ACTION_IDS);

  [
    '- View: zoom in, zoom out, fit, grid, tile preview, onion skin.',
    '- Draw: pencil, brush, fill, line, shape, and brush settings.',
    '- Select: rectangular select, ellipse select, lasso, magic tools, and move.',
    '- Tools: eraser, eyedropper, gradient, clone, dither, color replace, and hue shift.',
    '- Canvas: wrap, symmetry, resize, scale, crop, offset, import image, export image.',
    '- States: add state and select state from the state list. Edit owns duplicate/delete state.',
    '- Edit: undo, redo, copy, cut, paste, select all, delete.',
    '- Timeline: play and step frame.',
    '- Clips: selected clip options, duplicate, move to track, new track.',
    '- Stage: scene duration, fade in/out, snap/grid, snap size.',
    '- Audio: selected audio volume, fade, loop, and master volume.',
    '- Export/import actions live under File; there is no separate Export top-level drawer.',
    '- File: standard document actions plus generate random race and load built-in reference tracks.',
    '- Track: draw road, add/move/remove nodes, remove edges, assign edge tile, asphalt, dirt, gravel, snow, wet asphalt, segment width, bumpiness, and snow condition. Circuit versus point-to-point behavior is inferred from whether the route endpoints connect; there must not be explicit Circuit/Destination menu toggles.',
    '- Ground: selected ground tile, paint ground, paint elevation, raise/lower, and brush size.',
    '- Settings: road width, AI racer count, weather clear/rain/storm/snow, and finish behavior.'
  ].forEach((text) => {
    assert.equal(uiSpecSource.includes(text), true, `UISpec should include canonical row "${text}"`);
  });
});

test('Pixel shared menu spec exposes layer and frame management commands', () => {
  assert.deepEqual(getEditorMenuSection('pixel', 'select').actions, [
    'select-rect',
    'select-ellipse',
    'select-lasso',
    'select-magic',
    'move'
  ]);
  assert.equal(getEditorMenuSection('pixel', 'select').actions.includes('copy'), false);
  assert.equal(getEditorMenuSection('pixel', 'select').actions.includes('paste'), false);
  assert.deepEqual(getEditorMenuSection('pixel', 'layers').actions, [
    'layer-add',
    'layer-duplicate',
    'layer-delete',
    'layer-rename',
    'layer-visibility',
    'layer-up',
    'layer-down',
    'layer-merge-up',
    'layer-merge-down',
    'layer-flatten'
  ]);
  assert.deepEqual(getEditorMenuSection('pixel', 'frames').actions, [
    'frame-add',
    'frame-duplicate',
    'frame-delete',
    'frame-delay',
    'frame-loop',
    'frame-play',
    'frame-step',
    'frame-rewind',
    'frame-up',
    'frame-down'
  ]);
});

test('Pixel shared menu spec exposes concrete rigging drawer commands', () => {
  assert.deepEqual(getEditorMenuSection('pixel', 'rigging').actions, [
    'bone-add',
    'bone-bind-layer',
    'bone-bind-selection',
    'bone-bake'
  ]);
  assert.equal(getEditorMenuSection('pixel', 'rigging').actions.includes('bone-list'), false);
  assert.equal(getEditorMenuSection('pixel', 'rigging').actions.includes('bone-timeline'), false);
});

test('MIDI shared menu spec uses runtime drawer command ids', () => {
  assert.deepEqual(getEditorMenuSection('midi', 'grid').actions, ['quantize', 'note-length']);
  assert.deepEqual(getEditorMenuSection('midi', 'song').actions, ['play', 'stop', 'loop', 'tempo']);
  assert.deepEqual(getEditorMenuSection('midi', 'tracks').actions, []);
  assert.deepEqual(getEditorMenuSection('midi', 'record').actions, ['enter-record', 'single-note']);
  assert.deepEqual(getEditorMenuSection('midi', 'pedals').actions, ['select-pedal-chain']);
  assert.deepEqual(getEditorMenuSection('midi', 'settings').actions, []);
  ['open-grid', 'open-song', 'open-tracks', 'open-record', 'open-pedals', 'open-mixer', 'open-settings'].forEach((id) => {
    Object.values(EDITOR_MENU_SPECS.midi.sections).forEach((section) => {
      assert.equal(section.actions.includes(id), false, `midi ${section.id} should not include stale navigation action ${id}`);
    });
  });
  assert.equal(getEditorMenuSection('midi', 'tracks').actions.includes('track-list'), false);
  assert.equal(getEditorMenuSection('midi', 'record').actions.includes('virtual-instruments'), false);
  assert.equal(getEditorMenuSection('midi', 'settings').actions.includes('audio-settings'), false);
});

test('Actor shared menu spec includes concrete desktop drawer actions', () => {
  assert.deepEqual(getEditorMenuSection('actor', 'states').actions, [
    'add-state',
    'state-list'
  ]);
  assert.equal(getEditorMenuSection('actor', 'states').actions.includes('duplicate-state'), false);
  assert.equal(getEditorMenuSection('actor', 'states').actions.includes('delete-state'), false);
  assert.deepEqual(getEditorMenuSection('actor', 'settings').actions, [
    'actor-settings',
    'metadata',
    'aggression',
    'loot-rules'
  ]);
  assert.deepEqual(getEditorMenuSection('actor', 'visuals').actions, [
    'animation',
    'art-reference',
    'frame-timing',
    'state-graph'
  ]);
  assert.deepEqual(getEditorMenuSection('actor', 'collision').actions, [
    'hitbox-zones',
    'hurtbox-zones',
    'body-damage'
  ]);
  assert.deepEqual(getEditorMenuSection('actor', 'view').actions, [
    'zoom-fit'
  ]);
  assert.deepEqual(getEditorMenuSection('actor', 'preview').actions, [
    'play-scene'
  ]);
  assert.equal(getEditorMenuSection('actor', 'tools'), null);
});

test('Actor desktop root sections come from the shared menu spec', () => {
  assert.equal(getEditorDesktopSectionId('actor', 'file'), 'settings');
  assert.equal(getEditorDesktopSectionId('actor', 'settings'), 'settings');
  assert.equal(getEditorDesktopSectionId('actor', 'view'), 'view');
  assert.equal(getEditorDesktopSectionId('actor', 'preview'), 'preview');
  assert.equal(getEditorDesktopSectionId('actor', 'collision'), 'states');
  assert.equal(getEditorDesktopSectionId('actor', 'missing'), null);
});

test('Race shared authoring roots include tile-backed terrain commands without stale sections', () => {
  assert.equal(getEditorMenuSection('race', 'road'), null);
  assert.equal(getEditorMenuSection('race', 'surfaces'), null);
  assert.equal(getEditorMenuSection('race', 'scenery'), null);
  assert.equal(getEditorMenuSection('race', 'weather'), null);
  assert.equal(getEditorMenuSection('race', 'race'), null);
  assert.equal(getEditorMenuSection('race', 'generate'), null);
  assert.equal(getEditorMenuSection('race', 'elevation'), null);
  assert.deepEqual(getEditorMenuSection('race', 'file').actions.slice(6), ['generate-random-race', 'exit-main']);
  assert.ok(getEditorMenuSection('race', 'track').actions.includes('edge-tile'));
  assert.equal(getEditorMenuSection('race', 'track').actions.includes('paint-elevation'), false);
  assert.deepEqual(getEditorMenuSection('race', 'ground').actions.slice(0, 4), [
    'ground-tile-next',
    'ground-tile-grass',
    'ground-tile-dirt',
    'ground-tile-gravel'
  ]);
  [
    'elevation-up',
    'elevation-up-large',
    'elevation-down-large',
    'elevation-brush-size',
    'ground-brush-xxl',
    'ground-brush-shape-round',
    'ground-brush-falloff-airbrush',
    'ground-brush-strength-50'
  ].forEach((action) => assert.equal(getEditorMenuSection('race', 'ground').actions.includes(action), true, action));
  assert.deepEqual(getEditorMenuSection('race', 'sprites').actions, ['sprite-select', 'race-decal', 'race-ground-box', 'paint-sprite', 'sprite-brush-settings', 'erase-sprite', 'paint-decal', 'erase-decal', 'paint-tile', 'erase-tile']);
  assert.deepEqual(getEditorMenuSection('race', 'settings').actions, ['ai-count', 'skybox-next', 'race-sun', 'race-weather', 'race-margin', 'race-tiles', 'race-tire-fx', 'race-texture-scale']);
  assert.equal(uiSpecSource.includes('- File: standard document actions plus generate random race and load built-in reference tracks.'), true);
  assert.equal(uiSpecSource.includes('Surfaces: selected ground tile, paint ground, selected-segment edge tile'), false);
});

test('Pixel desktop root, section, and controller menu aliases come from the shared menu spec', () => {
  assert.deepEqual(getEditorRootMenuEntries('pixel', { desktopOnly: true }).map((entry) => entry.id), ['file', 'edit', 'view', 'tools', 'canvas', 'layers', 'animation', 'bones']);
  assert.equal(getEditorRootMenuEntries('pixel').some((entry) => entry.id === 'draw'), true);
  assert.equal(getEditorRootMenuEntries('pixel').some((entry) => entry.id === 'select'), true);
  assert.equal(getEditorDesktopSectionId('pixel', 'frames'), 'animation');
  assert.equal(getEditorDesktopSectionId('pixel', 'rigging'), 'bones');
  assert.equal(getEditorDesktopSectionId('pixel', 'draw'), 'draw');
  assert.equal(getEditorDesktopRootIdForSection('pixel', 'animation'), 'frames');
  assert.equal(getEditorDesktopRootIdForSection('pixel', 'bones'), 'rigging');
  assert.equal(getEditorDesktopRootIdForSection('pixel', 'draw'), 'draw');
  assert.equal(getEditorDesktopControllerMenuId('pixel', 'frames'), 'frames');
  assert.equal(getEditorDesktopControllerMenuId('pixel', 'rigging'), 'bones');
  assert.equal(getEditorDesktopControllerMenuIdForSection('pixel', 'animation'), 'frames');
  assert.equal(getEditorDesktopControllerMenuIdForSection('pixel', 'bones'), 'bones');
});

test('MIDI desktop mixer and record controller aliases come from the shared menu spec', () => {
  assert.equal(getEditorDesktopSectionId('midi', 'tracks'), 'instruments');
  assert.equal(getEditorDesktopSectionId('midi', 'record'), 'virtual-instruments');
  assert.equal(getEditorDesktopRootIdForSection('midi', 'instruments'), 'tracks');
  assert.equal(getEditorDesktopRootIdForSection('midi', 'virtual-instruments'), 'record');
  assert.equal(getEditorDesktopControllerMenuIdForSection('midi', 'instruments'), 'tracks');
  assert.equal(getEditorDesktopControllerMenuIdForSection('midi', 'virtual-instruments'), 'record');
});

test('shared controller root helpers expose runtime menu ids and labels', () => {
  assert.deepEqual(getEditorControllerRootMenuIds('pixel'), ['file', 'edit', 'view', 'draw', 'select', 'tools', 'canvas', 'layers', 'frames', 'bones']);
  assert.deepEqual(getEditorControllerRootMenuIds('level'), ['file', 'edit', 'view', 'toolbox', 'tiles', 'pixels', 'npcs', 'triggers', 'powerups', 'prefabs', 'graphics', 'music', 'level-settings', 'playtest']);
  assert.deepEqual(getEditorControllerRootMenuIds('midi'), ['file', 'edit', 'view', 'grid', 'song', 'tracks', 'record', 'pedals']);
  assert.deepEqual(getEditorControllerRootMenuIds('sfx'), ['file', 'edit', 'view', 'timeline', 'layers', 'envelopes', 'generate', 'tools']);
  assert.deepEqual(getEditorControllerRootMenuIds('cutscene'), ['file', 'edit', 'view', 'add', 'timeline', 'clips', 'keyframes', 'stage', 'audio']);
  assert.deepEqual(getEditorControllerRootMenuIds('actor'), ['file', 'edit', 'view', 'settings', 'states', 'linked-parts', 'visuals', 'collision', 'behavior', 'preview']);
  assert.deepEqual(getEditorControllerRootMenuIds('race'), ['file', 'edit', 'view', 'track', 'ground', 'sprites', 'settings']);
  assert.deepEqual(getEditorControllerRootMenuIds('car'), ['file', 'edit', 'view', 'art', 'drivetrain', 'tuning', 'aero', 'suspension', 'drive']);

  const pixelLabels = getEditorRootMenuLabelMap('pixel');
  assert.equal(pixelLabels.frames, 'Frames');
  assert.equal(pixelLabels.animation, 'Frames');
  assert.equal(pixelLabels.rigging, 'Rigging');
  assert.equal(pixelLabels.bones, 'Rigging');

  const levelLabels = getEditorRootMenuLabelMap('level');
  assert.equal(levelLabels['tile-art'], 'Tile Art');
  assert.equal(levelLabels.pixels, 'Tile Art');
  assert.equal(levelLabels.actors, 'Actors');
  assert.equal(levelLabels.npcs, 'Actors');

  const midiLabels = getEditorRootMenuLabelMap('midi');
  assert.equal(midiLabels.tracks, 'Mixer');
  assert.equal(midiLabels.instruments, 'Mixer');
  assert.equal(midiLabels.record, 'Record');
  assert.equal(midiLabels['virtual-instruments'], 'Record');

  const raceLabels = getEditorRootMenuLabelMap('race');
  assert.equal(raceLabels.drive, undefined);
  assert.equal(raceLabels.track, 'Track');
  assert.equal(raceLabels.generate, undefined);
  assert.equal(raceLabels.ground, 'Ground');

  const carLabels = getEditorRootMenuLabelMap('car');
  assert.equal(carLabels.drivetrain, 'Drivetrain');
  assert.equal(carLabels.suspension, 'Suspension');
});

test('shared controller root entries carry render id and controller submenu id', () => {
  const pixel = getEditorControllerRootMenuEntries('pixel');
  assert.deepEqual(
    pixel.filter((entry) => entry.specId === 'frames' || entry.specId === 'rigging')
      .map((entry) => [entry.id, entry.specId, entry.controllerMenuId, entry.label]),
    [
      ['animation', 'frames', 'frames', 'Frames'],
      ['bones', 'rigging', 'bones', 'Rigging']
    ]
  );

  const level = getEditorControllerRootMenuEntries('level');
  assert.deepEqual(
    level.filter((entry) => ['tools', 'tile-art', 'actors', 'structures', 'settings'].includes(entry.specId))
      .map((entry) => [entry.id, entry.specId, entry.controllerMenuId]),
    [
      ['toolbox', 'tools', 'toolbox'],
      ['pixels', 'tile-art', 'pixels'],
      ['npcs', 'actors', 'npcs'],
      ['prefabs', 'structures', 'prefabs'],
      ['level-settings', 'settings', 'level-settings']
    ]
  );

  const midi = getEditorControllerRootMenuEntries('midi');
  assert.deepEqual(
    midi.filter((entry) => entry.specId === 'tracks' || entry.specId === 'record')
      .map((entry) => [entry.id, entry.specId, entry.controllerMenuId, entry.label]),
    [
      ['instruments', 'tracks', 'tracks', 'Mixer'],
      ['virtual-instruments', 'record', 'record', 'Record']
    ]
  );

  const race = getEditorControllerRootMenuEntries('race');
  assert.deepEqual(
    race.filter((entry) => entry.specId === 'track' || entry.specId === 'ground' || entry.specId === 'drive')
      .map((entry) => [entry.id, entry.specId, entry.controllerMenuId, entry.label]),
    [
      ['track', 'track', 'track', 'Track'],
      ['ground', 'ground', 'ground', 'Ground']
    ]
  );

  const car = getEditorControllerRootMenuEntries('car');
  assert.deepEqual(
    car.filter((entry) => entry.specId === 'drivetrain' || entry.specId === 'drive')
      .map((entry) => [entry.id, entry.specId, entry.controllerMenuId, entry.label]),
    [
      ['drivetrain', 'drivetrain', 'drivetrain', 'Drivetrain'],
      ['drive', 'drive', 'drive', 'Drive']
    ]
  );
});

test('Level desktop and landscape root aliases resolve to existing panel tabs', () => {
  assert.equal(getEditorDesktopSectionId('level', 'tools'), 'toolbox');
  assert.equal(getEditorDesktopSectionId('level', 'toolbox'), 'toolbox');
  assert.equal(getEditorDesktopSectionId('level', 'tile-art'), 'pixels');
  assert.equal(getEditorDesktopSectionId('level', 'actors'), 'npcs');
  assert.equal(getEditorDesktopSectionId('level', 'structures'), 'prefabs');
  assert.equal(getEditorDesktopSectionId('level', 'settings'), 'level-settings');
  assert.equal(getEditorDesktopRootIdForSection('level', 'toolbox'), 'tools');
  assert.equal(getEditorDesktopRootIdForSection('level', 'pixels'), 'tile-art');
  assert.equal(getEditorDesktopRootIdForSection('level', 'npcs'), 'actors');
  assert.equal(getEditorDesktopRootIdForSection('level', 'prefabs'), 'structures');
  assert.equal(getEditorDesktopRootIdForSection('level', 'level-settings'), 'settings');
});

test('SFX shared menu spec uses runtime command ids instead of abstract placeholders', () => {
  assert.deepEqual(getEditorMenuSection('sfx', 'view').actions, [
    'zoom-fit',
    'loop'
  ]);
  assert.deepEqual(getEditorMenuSection('sfx', 'timeline').actions, [
    'play',
    'stop',
    'start',
    'end'
  ]);
  assert.deepEqual(getEditorMenuSection('sfx', 'layers').actions, [
    'add-layer',
    'duplicate-layer',
    'delete-layer'
  ]);
  assert.deepEqual(getEditorMenuSection('sfx', 'generate').actions, [
    'generate',
    'wave-noise',
    'wave-saw',
    'wave-triangle',
    'wave-square',
    'wave-custom'
  ]);
  assert.deepEqual(getEditorMenuSection('sfx', 'settings').actions, []);
  assert.equal(getEditorMenuSection('sfx', 'generate').actions.includes('open-generate'), false);
  assert.equal(getEditorMenuSection('sfx', 'settings').actions.includes('open-settings'), false);
  assert.equal(getEditorMenuSection('sfx', 'timeline').actions.includes('scrub'), false);
  assert.equal(getEditorMenuSection('sfx', 'view').actions.includes('play'), false);
  assert.equal(getEditorMenuSection('sfx', 'layers').actions.includes('layer-list'), false);
  assert.equal(getEditorMenuSection('sfx', 'layers').actions.includes('reorder-layer'), false);
});

test('Cutscene shared menu spec uses runtime drawer command ids', () => {
  assert.deepEqual(getEditorMenuSection('cutscene', 'timeline').actions, [
    'play',
    'step-frame'
  ]);
  assert.equal(getEditorMenuSection('cutscene', 'timeline').actions.includes('view-canvas'), false);
  assert.equal(getEditorMenuSection('cutscene', 'timeline').actions.includes('timeline-zoom-in'), false);
  assert.deepEqual(getEditorMenuSection('cutscene', 'keyframes').actions, [
    'set-start',
    'set-end',
    'set-key',
    'delete-key',
    'prev-key',
    'next-key',
    'key-mode',
    'ease'
  ]);
  assert.deepEqual(getEditorMenuSection('cutscene', 'clips').actions, [
    'clip-options',
    'duplicate',
    'move-to-track',
    'new-track'
  ]);
  assert.equal(getEditorMenuSection('cutscene', 'clips').actions.includes('copy'), false);
  assert.equal(getEditorMenuSection('cutscene', 'clips').actions.includes('paste'), false);
  assert.deepEqual(getEditorMenuSection('cutscene', 'add').actions, ['art', 'actor', 'text', 'color-board', 'music', 'sfx', 'effect', 'pause']);
  assert.deepEqual(getEditorMenuSection('cutscene', 'stage').actions, ['scene-duration', 'scene-fade-in', 'scene-fade-out', 'snap-toggle', 'snap-size']);
  assert.equal(getEditorMenuSection('cutscene', 'stage').actions.includes('master-volume'), false);
  assert.deepEqual(getEditorMenuSection('cutscene', 'audio').actions, ['volume', 'fade', 'loop', 'master-volume']);
  assert.equal(getEditorMenuSection('cutscene', 'audio').actions.includes('music'), false);
  assert.equal(getEditorMenuSection('cutscene', 'audio').actions.includes('sfx'), false);
  assert.deepEqual(getEditorMenuSection('cutscene', 'settings').actions, []);
  assert.equal(getEditorMenuSection('cutscene', 'settings').actions.includes('view-canvas'), false);
  assert.equal(getEditorMenuSection('cutscene', 'settings').actions.includes('scene-duration'), false);
});

test('Level shared menu spec uses stable runtime command ids instead of placeholder lists', () => {
  assert.deepEqual(getEditorMenuSection('level', 'tools').actions, [
    'toolbox',
    'tile-mode',
    'shape-mode',
    'erase'
  ]);
  assert.deepEqual(getEditorMenuSection('level', 'triggers').actions, ['trigger-draw', 'spawn']);
  assert.deepEqual(getEditorMenuSection('level', 'graphics').actions, [
    'open-graphics',
    'graphics-take-screenshot',
    'graphics-apply-decal'
  ]);
  assert.deepEqual(getEditorMenuSection('level', 'settings').actions, [
    'resize-level',
    'crop-level',
    'spawn-point',
    'start-everything',
    'random-level',
    'midi'
  ]);
  assert.equal(getEditorMenuSection('level', 'tiles').actions.includes('tile-list'), false);
  assert.equal(getEditorMenuSection('level', 'actors').actions.includes('actor-list'), false);
  assert.equal(getEditorMenuSection('level', 'structures').actions.includes('structure-list'), false);
});

test('menu specs expose runtime aliases for existing editor state ids', () => {
  assert.equal(getEditorMenuRuntimeId('level', 'tile-art'), 'pixels');
  assert.equal(getEditorMenuRuntimeId('level', 'actors'), 'npcs');
  assert.equal(getEditorMenuRuntimeId('level', 'structures'), 'prefabs');
  assert.equal(getEditorMenuRuntimeId('pixel', 'frames'), 'animation');
  assert.equal(getEditorMenuRuntimeId('pixel', 'rigging'), 'bones');
  assert.equal(getEditorMenuRuntimeId('midi', 'tracks'), 'instruments');
  assert.equal(getEditorMenuRuntimeId('midi', 'record'), 'virtual-instruments');
  assert.equal(getEditorMenuSpecIdForRuntime('level', 'pixels'), 'tile-art');
  assert.equal(getEditorMenuSpecIdForRuntime('midi', 'virtual-instruments'), 'record');
});

test('menu spec validation keeps root label overrides tied to real roots or aliases', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.level);
  spec.rootLabelOverrides.ghost = 'Ghost';
  spec.rootLabelOverrides.pixels = 'Tile Art';

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'level root label override "ghost" must target a root menu or runtime alias.'
  ]);
});

test('shared root menu entries are render-ready while preserving spec ids', () => {
  const level = getEditorRootMenuEntries('level', {
    labelOverrides: { file: 'Menu' },
    extraEntries: [{ id: 'undo', label: 'Undo' }, { id: 'redo', label: 'Redo' }]
  });
  assert.deepEqual(level.map((entry) => entry.id), [
    'file',
    'edit',
    'view',
    'toolbox',
    'tiles',
    'pixels',
    'npcs',
    'triggers',
    'powerups',
    'prefabs',
    'graphics',
    'music',
    'level-settings',
    'playtest',
    'undo',
    'redo'
  ]);
  assert.equal(level.find((entry) => entry.id === 'pixels').specId, 'tile-art');
  assert.equal(level.find((entry) => entry.id === 'file').label, 'Menu');

  const midi = getEditorRootMenuEntries('midi');
  assert.ok(midi.some((entry) => entry.id === 'instruments' && entry.specId === 'tracks'));
  assert.ok(midi.some((entry) => entry.id === 'virtual-instruments' && entry.specId === 'record'));
  assert.equal(midi.find((entry) => entry.id === 'instruments').label, 'Mixer');
  assert.equal(midi.find((entry) => entry.id === 'virtual-instruments').label, 'Record');

  const defaultLevel = getEditorRootMenuEntries('level');
  assert.equal(defaultLevel.find((entry) => entry.id === 'toolbox').label, 'Toolbox');
  assert.equal(defaultLevel.find((entry) => entry.id === 'pixels').label, 'Tile Art');
  assert.equal(defaultLevel.find((entry) => entry.id === 'npcs').label, 'Actors');
  assert.equal(defaultLevel.find((entry) => entry.id === 'prefabs').label, 'Structures');
});
