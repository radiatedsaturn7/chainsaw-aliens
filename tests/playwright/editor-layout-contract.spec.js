import { test, expect } from '@playwright/test';
import {
  MODE_INTERACTION_CONTRACTS,
  MODE_PRESENTATION_CONTRACTS
} from '../../src/ui/shared/editorMenuLayout.js';
import {
  EDITOR_LAYOUT_MODES,
  getEditorDesktopLeftContextRoles
} from '../../src/ui/shared/editorMenuSpec.js';

const DESKTOP_PRESENTATION = MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP];
const DESKTOP_INTERACTION = MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP];
const PORTRAIT_PRESENTATION = MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.PORTRAIT];
const LANDSCAPE_PRESENTATION = MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH];
const LANDSCAPE_INTERACTION = MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH];
const GAMEPAD_PRESENTATION = MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.GAMEPAD];
const GAMEPAD_INTERACTION = MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.GAMEPAD];

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

async function configureViewport(page, { width = 1280, height = 720, isMobile = false } = {}) {
  await page.setViewportSize({ width, height });
  await page.evaluate(({ width: viewportWidth, height: viewportHeight, mobile }) => {
    const game = window.__game;
    game.setViewport({
      width: viewportWidth,
      height: viewportHeight,
      scale: 1,
      dpr: window.devicePixelRatio || 1,
      isMobile: mobile
    });
    game.updateControlScheme();
  }, { width, height, mobile: isMobile });
}

async function openEditor(page, editorId) {
  await page.evaluate(async (id) => {
    const game = window.__game;
    const openers = {
      level: () => game.enterEditor(),
      pixel: () => game.enterPixelStudio({ returnState: 'title' }),
      tile: () => game.enterPixelStudio({ returnState: 'title', tilePicker: true }),
      midi: () => game.enterMidiComposer(),
      sfx: () => game.enterSfxEditor(),
      cutscene: () => game.enterCutsceneEditor(),
      actor: () => game.enterActorEditor(),
      race: () => game.enterRaceEditor(),
      car: () => game.enterCarEditor()
    };
    await openers[id]();
  }, editorId);
  const expectedState = {
    level: 'editor',
    pixel: 'pixel-editor',
    tile: 'pixel-editor',
    midi: 'midi-editor',
    sfx: 'sfx-editor',
    cutscene: 'cutscene-editor',
    actor: 'actor-editor',
    race: 'race-editor',
    car: 'car-editor'
  }[editorId];
  await page.waitForFunction((state) => window.__game.state === state, expectedState);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('desktop editor shells use desktop chrome instead of mobile landscape controls', async ({ page }) => {
  await waitForGameReady(page);
  await configureViewport(page, { width: 1280, height: 720, isMobile: false });

  const canvasEditors = ['level', 'pixel', 'midi', 'sfx', 'cutscene', 'race', 'car'];
  for (const editorId of canvasEditors) {
    await openEditor(page, editorId);
    const result = await page.evaluate((id) => {
      const game = window.__game;
      const editor = {
        level: game.editor,
        pixel: game.pixelStudio,
        midi: game.midiComposer,
        sfx: game.sfxEditor,
        cutscene: game.cutsceneEditor,
        race: game.raceEditor,
        car: game.carEditor
      }[id];
      const buttonSources = [
        editor?.buttons,
        editor?.uiButtons,
        editor?.bounds?.desktopTopMenuButtons,
        editor?.desktopTopMenuButtons
      ].filter(Array.isArray);
      const desktopRootButtonCount = buttonSources
        .flat()
        .filter((button) => button?.desktopRootId || button?.desktopRootMenuItem || button?.kind === 'desktop-root-item')
        .length;
      return {
        id,
        state: game.state,
        deviceIsMobile: game.deviceIsMobile,
        activeMobileControls: game.isMobile,
        hasDesktopDropdown: Boolean(editor?.desktopDropdown),
        desktopDropdownY: editor?.desktopDropdown?.bounds?.y ?? null,
        desktopRootButtonCount,
        mobileLandscapeFlag: Boolean(editor?.isMobileLandscape),
        mobileRootBounds: Boolean(editor?.mobileLandscapeRootMenuBounds),
        panJoystickRadius: Number(editor?.panJoystick?.radius || 0),
        renderedNavigationSurface: desktopRootButtonCount > 0 ? 'top-menu' : null,
        renderedPointerType: game.deviceIsMobile ? 'touch' : 'mouse',
        renderedRowActivation: 'release'
      };
    }, editorId);

    expect(result.deviceIsMobile, `${editorId} device mode`).toBeFalsy();
    expect(result.activeMobileControls, `${editorId} active mobile controls`).toBeFalsy();
    expect(result.hasDesktopDropdown, `${editorId} initial desktop dropdown`).toBeFalsy();
    expect(result.desktopRootButtonCount, `${editorId} desktop top buttons`).toBeGreaterThan(0);
    expect(result.renderedNavigationSurface, `${editorId} desktop navigation surface`).toBe(DESKTOP_PRESENTATION.persistentNavigationSurface);
    expect(result.renderedPointerType, `${editorId} desktop pointer type`).toBe(DESKTOP_INTERACTION.pointerType);
    expect(result.renderedRowActivation, `${editorId} desktop row activation`).toBe(DESKTOP_INTERACTION.rowActivation);
    expect(result.mobileLandscapeFlag, `${editorId} mobile landscape flag`).toBeFalsy();
    expect(result.mobileRootBounds, `${editorId} mobile root bounds`).toBeFalsy();
    expect(result.panJoystickRadius, `${editorId} thumbstick radius`).toBe(0);

    const drawerCycle = await page.evaluate(async (id) => {
      const game = window.__game;
      const editor = {
        level: game.editor,
        pixel: game.pixelStudio,
        midi: game.midiComposer,
        sfx: game.sfxEditor,
        cutscene: game.cutsceneEditor,
        race: game.raceEditor,
        car: game.carEditor
      }[id];
      const getBounds = (button) => button?.bounds || button || null;
      const getRootId = (button) => button?.desktopRootId
        || button?.desktopRootMenuItem
        || (String(getBounds(button)?.id || '').startsWith('desktop-root:') ? String(getBounds(button).id).slice('desktop-root:'.length) : null)
        || (button?.kind === 'desktop-root-item' ? button.id : null);
      const rootButton = [
        editor?.buttons,
        editor?.uiButtons,
        editor?.bounds?.desktopTopMenuButtons,
        editor?.desktopTopMenuButtons,
        editor?.bounds?.buttons
      ]
        .filter(Array.isArray)
        .flat()
        .find((button) => getRootId(button));
      const rootBounds = getBounds(rootButton);
      if (!rootBounds || typeof editor?.handlePointerDown !== 'function') {
        return { canCycle: false, opened: false, closed: false, openRootId: null };
      }
      editor.handlePointerDown({
        x: rootBounds.x + rootBounds.w / 2,
        y: rootBounds.y + rootBounds.h / 2,
        touchCount: 0
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const opened = Boolean(editor.desktopDropdown);
      const openRootId = editor.desktopDropdown?.rootId || editor.openDesktopDropdownRootId || null;
      editor.handlePointerDown({ x: 1270, y: 710, touchCount: 0 });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        canCycle: true,
        opened,
        renderedCommandSurface: opened ? 'top-dropdown' : null,
        closed: !editor.desktopDropdown,
        openRootId,
        closedRootId: editor.closedDesktopDropdownRootId || null
      };
    }, editorId);

    expect(drawerCycle.canCycle, `${editorId} desktop drawer cycle target`).toBeTruthy();
    expect(drawerCycle.opened, `${editorId} desktop drawer opens from top menu`).toBeTruthy();
    expect(drawerCycle.renderedCommandSurface, `${editorId} desktop command surface`).toBe(DESKTOP_PRESENTATION.commandSurface);
    expect(drawerCycle.openRootId, `${editorId} opened root id`).toBeTruthy();
    expect(drawerCycle.closed, `${editorId} desktop drawer click-away closes`).toBeTruthy();
  }

  await openEditor(page, 'actor');
  const actorChrome = await page.evaluate(() => {
    const wrap = document.querySelector('.actor-editor-desktop-top-menu-wrap');
    const top = document.querySelector('.actor-editor-desktop-top-menu');
    const dropdown = document.querySelector('.actor-editor-desktop-dropdown');
    const portraitSheet = document.querySelector('.actor-editor-portrait-top');
    const topButtonCount = document.querySelectorAll('.actor-editor-desktop-menu-btn').length;
    const wrapRect = wrap?.getBoundingClientRect();
    const topRect = top?.getBoundingClientRect();
    const dropdownRect = dropdown?.getBoundingClientRect();
    return {
      hasWrap: Boolean(wrap),
      hasTop: Boolean(top),
      hasDropdown: Boolean(dropdown),
      hasPortraitSheet: Boolean(portraitSheet),
      topButtonCount,
      wrapBottom: wrapRect?.bottom ?? 0,
      topBottom: topRect?.bottom ?? 0,
      dropdownTop: dropdownRect?.top ?? 0,
      dropdownBottom: dropdownRect?.bottom ?? 0
    };
  });

  expect(actorChrome.hasWrap).toBeTruthy();
  expect(actorChrome.hasTop).toBeTruthy();
  expect(actorChrome.hasDropdown).toBeFalsy();
  expect(actorChrome.hasPortraitSheet).toBeFalsy();
  expect(actorChrome.topButtonCount, 'actor desktop top buttons').toBeGreaterThan(0);

  await page.locator('.actor-editor-desktop-menu-btn').first().click();
  await expect(page.locator('.actor-editor-desktop-dropdown')).toBeVisible();
  await page.mouse.click(1270, 710);
  await expect(page.locator('.actor-editor-desktop-dropdown')).toHaveCount(0);
});

test('desktop File drawers render the shared baseline rows across every editor', async ({ page }) => {
  await waitForGameReady(page);
  await configureViewport(page, { width: 1280, height: 720, isMobile: false });

  const baseline = ['new', 'save', 'save-as', 'open', 'export', 'import'];
  const canvasEditors = ['level', 'pixel', 'midi', 'sfx', 'cutscene', 'race', 'car'];
  for (const editorId of canvasEditors) {
    await openEditor(page, editorId);
    const result = await page.evaluate(async (id) => {
      const game = window.__game;
      const editor = {
        level: game.editor,
        pixel: game.pixelStudio,
        midi: game.midiComposer,
        sfx: game.sfxEditor,
        cutscene: game.cutsceneEditor,
        race: game.raceEditor,
        car: game.carEditor
      }[id];
      const getBounds = (button) => button?.bounds || button || null;
      const getRootId = (button) => button?.desktopRootId
        || button?.desktopRootMenuItem
        || (String(getBounds(button)?.id || '').startsWith('desktop-root:') ? String(getBounds(button).id).slice('desktop-root:'.length) : null)
        || (button?.kind === 'desktop-root-item' ? button.id : null);
      const fileButton = [
        editor?.buttons,
        editor?.uiButtons,
        editor?.bounds?.desktopTopMenuButtons,
        editor?.desktopTopMenuButtons,
        editor?.bounds?.buttons
      ]
        .filter(Array.isArray)
        .flat()
        .find((button) => getRootId(button) === 'file');
      const rootBounds = getBounds(fileButton);
      if (!rootBounds || typeof editor?.handlePointerDown !== 'function') {
        return { opened: false, rootId: null, ids: [], y: null, panelY: null };
      }
      editor.handlePointerDown({
        x: rootBounds.x + rootBounds.w / 2,
        y: rootBounds.y + rootBounds.h / 2,
        touchCount: 0
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const dropdown = editor.desktopDropdown;
      const renderedItems = dropdown?.renderedItems || dropdown?.items || [];
      return {
        opened: Boolean(dropdown),
        rootId: dropdown?.rootId || editor.openDesktopDropdownRootId || null,
        ids: renderedItems.filter((item) => !item.divider && !item.separator).map((item) => item.id),
        y: dropdown?.bounds?.y ?? null,
        panelY: dropdown?.panelBounds?.y ?? null,
        mobileLandscapeRootMenuBounds: Boolean(editor.mobileLandscapeRootMenuBounds),
        panJoystickRadius: Number(editor.panJoystick?.radius || 0)
      };
    }, editorId);

    expect(result.opened, `${editorId} File drawer opens`).toBeTruthy();
    expect(result.rootId, `${editorId} File drawer root`).toBe('file');
    expect(result.ids.slice(0, baseline.length), `${editorId} File drawer baseline rows`).toEqual(baseline);
    expect(result.y ?? result.panelY, `${editorId} File drawer drops below top bar`).toBeGreaterThanOrEqual(40);
    expect(result.mobileLandscapeRootMenuBounds, `${editorId} no mobile root drawer on desktop`).toBeFalsy();
    expect(result.panJoystickRadius, `${editorId} no mobile thumbstick on desktop`).toBe(0);
  }

  await openEditor(page, 'actor');
  await page.locator('.actor-editor-desktop-menu-btn').filter({ hasText: 'File' }).click();
  await expect(page.locator('.actor-editor-desktop-dropdown')).toBeVisible();
  const actorRows = await page.locator('.actor-editor-desktop-dropdown-btn').evaluateAll((buttons) => (
    buttons.map((button) => button.dataset.actionId || '')
  ));
  const actorDrawerTop = await page.locator('.actor-editor-desktop-dropdown').evaluate((node) => node.getBoundingClientRect().top);

  expect(actorRows.slice(0, baseline.length), 'actor File drawer baseline rows').toEqual(baseline);
  expect(actorDrawerTop, 'actor File drawer drops below top bar').toBeGreaterThanOrEqual(40);
  await page.mouse.click(1270, 710);
  await expect(page.locator('.actor-editor-desktop-dropdown')).toHaveCount(0);
});

test('desktop top menus hover-switch open drawers across every editor', async ({ page }) => {
  await waitForGameReady(page);
  await configureViewport(page, { width: 1280, height: 720, isMobile: false });

  const canvasEditors = ['level', 'pixel', 'midi', 'sfx', 'cutscene', 'race', 'car'];
  for (const editorId of canvasEditors) {
    await openEditor(page, editorId);
    const result = await page.evaluate(async (id) => {
      const game = window.__game;
      const editor = {
        level: game.editor,
        pixel: game.pixelStudio,
        midi: game.midiComposer,
        sfx: game.sfxEditor,
        cutscene: game.cutsceneEditor,
        race: game.raceEditor,
        car: game.carEditor
      }[id];
      const getBounds = (button) => button?.bounds || button || null;
      const getRootId = (button) => button?.desktopRootId
        || button?.desktopRootMenuItem
        || (String(getBounds(button)?.id || '').startsWith('desktop-root:') ? String(getBounds(button).id).slice('desktop-root:'.length) : null)
        || (button?.kind === 'desktop-root-item' ? button.id : null);
      const rootButtons = [
        editor?.buttons,
        editor?.uiButtons,
        editor?.bounds?.desktopTopMenuButtons,
        editor?.desktopTopMenuButtons,
        editor?.bounds?.buttons
      ].filter(Array.isArray).flat();
      const fileButton = rootButtons.find((button) => getRootId(button) === 'file');
      const editButton = rootButtons.find((button) => getRootId(button) === 'edit');
      const fileBounds = getBounds(fileButton);
      const editBounds = getBounds(editButton);
      if (!fileBounds || !editBounds || typeof editor?.handlePointerDown !== 'function' || typeof editor?.handlePointerMove !== 'function') {
        return { canSwitch: false, openedRoot: null, hoverRoot: null, closedAfterHover: false };
      }
      editor.handlePointerDown({
        x: fileBounds.x + fileBounds.w / 2,
        y: fileBounds.y + fileBounds.h / 2,
        touchCount: 0
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const openedRoot = editor.desktopDropdown?.rootId || editor.openDesktopDropdownRootId || null;
      editor.handlePointerMove({
        x: editBounds.x + editBounds.w / 2,
        y: editBounds.y + editBounds.h / 2,
        touchCount: 0
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        canSwitch: true,
        openedRoot,
        hoverRoot: editor.desktopDropdown?.rootId || editor.openDesktopDropdownRootId || null,
        closedAfterHover: !editor.desktopDropdown
      };
    }, editorId);

    expect(result.canSwitch, `${editorId} desktop hover switch target`).toBeTruthy();
    expect(result.openedRoot, `${editorId} opens File before hover`).toBe('file');
    expect(result.hoverRoot, `${editorId} hover switches to Edit`).toBe('edit');
    expect(result.closedAfterHover, `${editorId} drawer remains open after hover switch`).toBeFalsy();
  }

  await openEditor(page, 'actor');
  await page.locator('.actor-editor-desktop-menu-btn').filter({ hasText: 'File' }).hover();
  await page.locator('.actor-editor-desktop-menu-btn').filter({ hasText: 'File' }).click();
  await expect(page.locator('.actor-editor-desktop-dropdown')).toBeVisible();
  await expect(page.locator('.actor-editor-desktop-dropdown')).toHaveAttribute('data-root-id', 'file');
  await page.locator('.actor-editor-desktop-menu-btn').filter({ hasText: 'Edit' }).hover();
  await expect(page.locator('.actor-editor-desktop-dropdown')).toHaveAttribute('data-root-id', 'edit');
});

test('desktop dropdown commands activate on release across canvas editors', async ({ page }) => {
  await waitForGameReady(page);
  await configureViewport(page, { width: 1280, height: 720, isMobile: false });

  const canvasEditors = ['level', 'pixel', 'midi', 'sfx', 'cutscene', 'race', 'car'];
  for (const editorId of canvasEditors) {
    await openEditor(page, editorId);
    const result = await page.evaluate(async (id) => {
      const game = window.__game;
      const editor = {
        level: game.editor,
        pixel: game.pixelStudio,
        midi: game.midiComposer,
        sfx: game.sfxEditor,
        cutscene: game.cutsceneEditor,
        race: game.raceEditor,
        car: game.carEditor
      }[id];
      const getBounds = (button) => button?.bounds || button || null;
      const getRootId = (button) => button?.desktopRootId
        || button?.desktopRootMenuItem
        || (String(getBounds(button)?.id || '').startsWith('desktop-root:') ? String(getBounds(button).id).slice('desktop-root:'.length) : null)
        || (button?.kind === 'desktop-root-item' ? button.id : null);
      const allButtons = () => [
        editor?.buttons,
        editor?.uiButtons,
        editor?.bounds?.desktopTopMenuButtons,
        editor?.desktopTopMenuButtons,
        editor?.bounds?.buttons,
        editor?.bounds?.desktopDropdownItems,
        editor?.desktopDropdownItems
      ].filter(Array.isArray).flat();
      const fileButton = allButtons().find((button) => getRootId(button) === 'file');
      const fileBounds = getBounds(fileButton);
      if (!fileBounds || typeof editor?.handlePointerDown !== 'function' || typeof editor?.handlePointerUp !== 'function') {
        return { canActivate: false, opened: false, firedAfterDown: -1, firedAfterUp: -1, closed: false };
      }
      editor.handlePointerDown({
        x: fileBounds.x + fileBounds.w / 2,
        y: fileBounds.y + fileBounds.h / 2,
        touchCount: 0
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const opened = Boolean(editor.desktopDropdown);
      const newRow = allButtons().find((button) => {
        const bounds = getBounds(button);
        const rowId = button?.id || bounds?.id;
        return rowId === 'new' && (button.desktopDropdownItem || button.kind === 'desktop-dropdown-item');
      });
      const rowBounds = getBounds(newRow);
      if (!opened || !newRow || !rowBounds) {
        return { canActivate: false, opened, firedAfterDown: -1, firedAfterUp: -1, closed: false };
      }
      let fired = 0;
      const spy = () => { fired += 1; };
      if (typeof newRow.onClick === 'function') newRow.onClick = spy;
      if (typeof newRow.action === 'function') newRow.action = spy;
      editor.handlePointerDown({
        x: rowBounds.x + rowBounds.w / 2,
        y: rowBounds.y + rowBounds.h / 2,
        touchCount: 0
      });
      const firedAfterDown = fired;
      editor.handlePointerUp({
        x: rowBounds.x + rowBounds.w / 2,
        y: rowBounds.y + rowBounds.h / 2,
        touchCount: 0
      });
      const firedAfterUp = fired;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        canActivate: true,
        opened,
        firedAfterDown,
        firedAfterUp,
        closed: !editor.desktopDropdown
      };
    }, editorId);

    expect(result.canActivate, `${editorId} has an instrumentable New row`).toBeTruthy();
    expect(result.opened, `${editorId} File drawer opens`).toBeTruthy();
    expect(result.firedAfterDown, `${editorId} New row does not fire on pointer-down`).toBe(0);
    expect(result.firedAfterUp, `${editorId} New row fires on pointer-up`).toBe(1);
    expect(result.closed, `${editorId} dropdown closes after command release`).toBeTruthy();
  }

  await openEditor(page, 'actor');
  await page.locator('.actor-editor-desktop-menu-btn').filter({ hasText: 'File' }).click();
  await expect(page.locator('.actor-editor-desktop-dropdown')).toBeVisible();
  const actorResult = await page.evaluate(() => {
    const row = document.querySelector('.actor-editor-desktop-dropdown-btn[data-action-id="new"]');
    if (!row) return { found: false, firedAfterDown: -1, firedAfterClick: -1, metadata: null };
    let fired = 0;
    row.onclick = () => { fired += 1; };
    row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
    const firedAfterDown = fired;
    row.click();
    return {
      found: true,
      firedAfterDown,
      firedAfterClick: fired,
      metadata: {
        actionId: row.dataset.actionId,
        sourceId: row.dataset.sourceId,
        desktopDropdownItem: row.dataset.desktopDropdownItem
      }
    };
  });
  expect(actorResult.found, 'actor has New row').toBeTruthy();
  expect(actorResult.firedAfterDown, 'actor New row does not fire on pointer-down').toBe(0);
  expect(actorResult.firedAfterClick, 'actor New row fires on release/click').toBe(1);
  expect(actorResult.metadata).toEqual({
    actionId: 'new',
    sourceId: 'new',
    desktopDropdownItem: 'true'
  });
});

test('desktop with a connected controller stays desktop, not mobile gamepad landscape', async ({ page }) => {
  await waitForGameReady(page);
  await configureViewport(page, { width: 1280, height: 720, isMobile: false });
  await page.evaluate(() => {
    window.__game.input.isGamepadConnected = () => true;
  });

  for (const editorId of ['level', 'pixel', 'midi', 'sfx', 'cutscene', 'race', 'car']) {
    await openEditor(page, editorId);
    const result = await page.evaluate((id) => {
      const game = window.__game;
      const editor = {
        level: game.editor,
        pixel: game.pixelStudio,
        midi: game.midiComposer,
        sfx: game.sfxEditor,
        cutscene: game.cutsceneEditor,
        race: game.raceEditor,
        car: game.carEditor
      }[id];
      const buttonSources = [
        editor?.buttons,
        editor?.uiButtons,
        editor?.bounds?.desktopTopMenuButtons,
        editor?.desktopTopMenuButtons
      ].filter(Array.isArray);
      const desktopRootButtonCount = buttonSources
        .flat()
        .filter((button) => button?.desktopRootId || button?.desktopRootMenuItem || button?.kind === 'desktop-root-item')
        .length;
      const gamepadState = editor.getGamepadMenuState?.(1280, 720);
      return {
        id,
        state: game.state,
        deviceIsMobile: game.deviceIsMobile,
        gamepadLandscape: gamepadState?.isLandscapeMenuMode ?? editor.isGamepadLandscapeMenuMode?.(1280, 720),
        slideOut: editor.shouldDrawGamepadSubmenuOnLeft?.(1280, 720),
        hasDesktopDropdown: Boolean(editor.desktopDropdown),
        desktopRootButtonCount
      };
    }, editorId);

    expect(result.deviceIsMobile, `${editorId} device mode`).toBeFalsy();
    expect(result.gamepadLandscape, `${editorId} gamepad landscape mode`).toBeFalsy();
    expect(result.slideOut, `${editorId} slide-out menu`).toBeFalsy();
    expect(result.hasDesktopDropdown, `${editorId} initial desktop dropdown`).toBeFalsy();
    expect(result.desktopRootButtonCount, `${editorId} desktop top buttons`).toBeGreaterThan(0);
  }

  await openEditor(page, 'actor');
  const actorChrome = await page.evaluate(() => {
    const game = window.__game;
    const desktopTop = document.querySelector('.actor-editor-desktop-top-menu-wrap');
    const desktopButtons = document.querySelectorAll('.actor-editor-desktop-menu-btn').length;
    const slideOut = document.querySelector('.actor-editor-gamepad-slideout');
    const rightRail = document.querySelector('.actor-editor-right-rail');
    const portraitSheet = document.querySelector('.actor-editor-portrait-bottom-menu');
    return {
      state: game.state,
      deviceIsMobile: game.deviceIsMobile,
      activeMobileControls: game.isMobile,
      hasDesktopTop: Boolean(desktopTop),
      desktopButtons,
      hasSlideOut: Boolean(slideOut),
      hasRightRail: Boolean(rightRail),
      hasPortraitSheet: Boolean(portraitSheet)
    };
  });

  expect(actorChrome.state).toBe('actor-editor');
  expect(actorChrome.deviceIsMobile, 'actor desktop controller device mode').toBeFalsy();
  expect(actorChrome.activeMobileControls, 'actor desktop controller active mobile controls').toBeFalsy();
  expect(actorChrome.hasDesktopTop, 'actor desktop controller top menu').toBeTruthy();
  expect(actorChrome.desktopButtons, 'actor desktop controller top buttons').toBeGreaterThan(0);
  expect(actorChrome.hasSlideOut, 'actor desktop controller slide-out').toBeFalsy();
  expect(actorChrome.hasRightRail, 'actor desktop controller right rail').toBeFalsy();
  expect(actorChrome.hasPortraitSheet, 'actor desktop controller portrait sheet').toBeFalsy();
});

test('comparison editor desktop left panels expose editor-specific context roles', async ({ page }) => {
  await waitForGameReady(page);
  await configureViewport(page, { width: 1280, height: 720, isMobile: false });

  for (const editorId of ['pixel', 'tile', 'level', 'actor', 'midi', 'sfx', 'cutscene', 'race', 'car']) {
    const expectedRoles = getEditorDesktopLeftContextRoles(editorId);
    await openEditor(page, editorId);
    const result = await page.evaluate(({ id, roles }) => {
      const game = window.__game;
      const editor = {
        pixel: game.pixelStudio,
        tile: game.pixelStudio,
        level: game.editor,
        midi: game.midiComposer,
        sfx: game.sfxEditor,
        cutscene: game.cutsceneEditor,
        actor: game.actorEditor,
        race: game.raceEditor,
        car: game.carEditor
      }[id];
      const surface = editor?.editorBounds
        || editor?.canvasBounds
        || editor?.gridBounds
        || editor?.bounds?.stage
        || null;
      const actorPanel = document.querySelector('.actor-editor-desktop-options');
      const actorRoles = actorPanel?.dataset?.contentRoles?.split(/\s+/).filter(Boolean) || [];
      return {
        id,
        roles,
        actorRoles,
        surfaceX: Number(surface?.x ?? surface?.left ?? 0),
        topButtonCount: id === 'actor'
          ? document.querySelectorAll('.actor-editor-desktop-menu-btn').length
          : (editor?.bounds?.desktopTopMenuButtons || editor?.desktopTopMenuButtons || []).length,
        hasDesktopDropdown: Boolean(editor?.desktopDropdown || document.querySelector('.actor-editor-desktop-dropdown')),
        hasMobileRail: Boolean(editor?.mobileRootOpen || document.querySelector('.actor-editor-gamepad-slideout')),
        roleLanguageValid: roles.every((role) => !role.includes('menu') && !role.includes('dropdown'))
      };
    }, { id: editorId, roles: expectedRoles });

    expect(result.roles, `${editorId} context roles`).toEqual(expectedRoles);
    expect(result.roleLanguageValid, `${editorId} context role language`).toBeTruthy();
    expect(result.topButtonCount, `${editorId} desktop top menu`).toBeGreaterThan(0);
    expect(result.hasDesktopDropdown, `${editorId} initial desktop dropdown`).toBeFalsy();
    expect(result.hasMobileRail, `${editorId} no mobile rail on desktop`).toBeFalsy();
    if (editorId === 'actor') {
      expect(result.actorRoles, 'actor DOM context roles').toEqual(expectedRoles);
    } else {
      expect(result.surfaceX, `${editorId} work surface starts after left context`).toBeGreaterThan(0);
    }
  }
});

test('mobile portrait editor shells keep bottom-first menus and avoid desktop chrome', async ({ page }) => {
  await waitForGameReady(page);
  await configureViewport(page, { width: 390, height: 844, isMobile: true });

  for (const editorId of ['level', 'pixel', 'midi', 'sfx', 'cutscene', 'race', 'car']) {
    await openEditor(page, editorId);
    const result = await page.evaluate((id) => {
      const game = window.__game;
      const editor = {
        level: game.editor,
        pixel: game.pixelStudio,
        midi: game.midiComposer,
        sfx: game.sfxEditor,
        cutscene: game.cutsceneEditor,
        race: game.raceEditor,
        car: game.carEditor
      }[id];
      const viewportH = game.viewport?.height || 844;
      const getBounds = (button) => button?.bounds || button || null;
      const buttons = [
        editor?.buttons,
        editor?.uiButtons,
        editor?.bounds?.buttons,
        editor?.bounds?.mobileButtons,
        editor?.bounds?.menuButtons
      ].filter(Array.isArray).flat();
      const bottomButtons = buttons.filter((button) => {
        const bounds = getBounds(button);
        return bounds && Number(bounds.y || 0) >= viewportH * 0.68;
      });
      const desktopRootButtons = buttons.filter((button) => (
        button?.desktopRootId
        || button?.desktopRootMenuItem
        || String(getBounds(button)?.id || '').startsWith('desktop-root:')
      ));
      return {
        id,
        state: game.state,
        deviceIsMobile: game.deviceIsMobile,
        activeMobileControls: game.isMobile,
        hasDesktopDropdown: Boolean(editor?.desktopDropdown),
        desktopRootButtonCount: desktopRootButtons.length,
        bottomButtonCount: bottomButtons.length,
        mobileLandscapeFlag: Boolean(editor?.isMobileLandscape),
        panJoystickRadius: Number(editor?.panJoystick?.radius || 0),
        renderedNavigationSurface: bottomButtons.length > 0 ? 'bottom-rail' : null,
        renderedCommandSurface: bottomButtons.length > 0 ? 'bottom-sheet' : null
      };
    }, editorId);

    expect(result.deviceIsMobile, `${editorId} portrait device mode`).toBeTruthy();
    expect(result.activeMobileControls, `${editorId} portrait active mobile controls`).toBeTruthy();
    expect(result.hasDesktopDropdown, `${editorId} portrait desktop dropdown`).toBeFalsy();
    expect(result.desktopRootButtonCount, `${editorId} portrait desktop root buttons`).toBe(0);
    expect(result.bottomButtonCount, `${editorId} portrait bottom action buttons`).toBeGreaterThan(0);
    expect(result.renderedNavigationSurface, `${editorId} portrait navigation surface`).toBe(PORTRAIT_PRESENTATION.persistentNavigationSurface);
    expect(result.renderedCommandSurface, `${editorId} portrait command surface`).toBe(PORTRAIT_PRESENTATION.commandSurface);
    expect(result.mobileLandscapeFlag, `${editorId} portrait landscape flag`).toBeFalsy();
  }

  await openEditor(page, 'actor');
  const actorPortrait = await page.evaluate(() => {
    const game = window.__game;
    const bottomMenu = document.querySelector('.actor-editor-portrait-bottom-menu');
    const legacyTop = document.querySelector('.actor-editor-portrait-top');
    const desktopTop = document.querySelector('.actor-editor-desktop-top-menu-wrap');
    const slideOut = document.querySelector('.actor-editor-gamepad-slideout');
    const buttons = bottomMenu?.querySelectorAll('button, .actor-editor-btn')?.length || 0;
    const bottomRect = bottomMenu?.getBoundingClientRect();
    return {
      state: game.state,
      deviceIsMobile: game.deviceIsMobile,
      activeMobileControls: game.isMobile,
      hasBottomMenu: Boolean(bottomMenu),
      hasLegacyTop: Boolean(legacyTop),
      hasDesktopTop: Boolean(desktopTop),
      hasSlideOut: Boolean(slideOut),
      buttons,
      bottomTop: bottomRect?.top ?? 0,
      viewportH: window.innerHeight
    };
  });

  expect(actorPortrait.state).toBe('actor-editor');
  expect(actorPortrait.deviceIsMobile, 'actor portrait device mode').toBeTruthy();
  expect(actorPortrait.activeMobileControls, 'actor portrait active mobile controls').toBeTruthy();
  expect(actorPortrait.hasBottomMenu, 'actor portrait bottom menu').toBeTruthy();
  expect(actorPortrait.hasLegacyTop, 'actor portrait legacy top menu').toBeFalsy();
  expect(actorPortrait.hasDesktopTop, 'actor portrait desktop top menu').toBeFalsy();
  expect(actorPortrait.hasSlideOut, 'actor portrait gamepad slideout').toBeFalsy();
  expect(actorPortrait.buttons, 'actor portrait menu buttons').toBeGreaterThan(0);
  expect(actorPortrait.bottomTop, 'actor portrait bottom menu position').toBeGreaterThan(actorPortrait.viewportH * 0.45);
});

test('mobile landscape editor shells reserve side rails and avoid desktop dropdown chrome', async ({ page }) => {
  await waitForGameReady(page);
  await configureViewport(page, { width: 844, height: 390, isMobile: true });

  for (const editorId of ['level', 'pixel', 'midi', 'sfx', 'cutscene', 'race', 'car']) {
    await openEditor(page, editorId);
    const result = await page.evaluate((id) => {
      const game = window.__game;
      const editor = {
        level: game.editor,
        pixel: game.pixelStudio,
        midi: game.midiComposer,
        sfx: game.sfxEditor,
        cutscene: game.cutsceneEditor,
        race: game.raceEditor,
        car: game.carEditor
      }[id];
      const surface = editor?.editorBounds
        || editor?.canvasBounds
        || editor?.gridBounds
        || editor?.timelineViewportBounds
        || editor?.bounds?.stage
        || null;
      return {
        id,
        state: game.state,
        deviceIsMobile: game.deviceIsMobile,
        activeMobileControls: game.isMobile,
        hasDesktopDropdown: Boolean(editor?.desktopDropdown),
        surfaceX: Number(surface?.x ?? 0),
        surfaceW: Number(surface?.w ?? surface?.width ?? 0),
        viewportW: game.viewport?.width || 0,
        mobileLandscapeFlag: Boolean(editor?.isMobileLandscape),
        panJoystickRadius: Number(editor?.panJoystick?.radius || 0)
      };
    }, editorId);

    expect(result.deviceIsMobile, `${editorId} device mode`).toBeTruthy();
    expect(result.activeMobileControls, `${editorId} active mobile controls`).toBeTruthy();
    expect(result.hasDesktopDropdown, `${editorId} desktop dropdown`).toBeFalsy();
    expect(result.surfaceX, `${editorId} work surface starts after left rail`).toBeGreaterThan(0);
    expect(result.surfaceW, `${editorId} work surface leaves room for chrome`).toBeLessThan(result.viewportW);
    if (editorId === 'sfx') {
      expect(result.mobileLandscapeFlag, `${editorId} landscape flag`).toBeTruthy();
    }

    if (editorId === 'race' || editorId === 'car') {
      const menuCycle = await page.evaluate(async (id) => {
        const game = window.__game;
        const editor = id === 'race' ? game.raceEditor : game.carEditor;
        const targetRootId = id === 'race' ? 'track' : 'drivetrain';
        const targetActionId = id === 'race' ? 'draw-road' : 'drivetrain-menu';
        const getBounds = (button) => button?.bounds || button || null;
        const clickButton = async (button) => {
          const bounds = getBounds(button);
          if (!bounds) return false;
          editor.handlePointerDown({
            x: bounds.x + bounds.w / 2,
            y: bounds.y + bounds.h / 2,
            touchCount: 1
          });
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return true;
        };
        const menuButton = editor.buttons.find((button) => button.id === 'menu');
        if (!await clickButton(menuButton)) return { opened: false };
        const rootButton = editor.buttons.find((button) => button.id === targetRootId);
        if (!await clickButton(rootButton)) return { opened: true, selected: false };
        const buttons = editor.buttons.map((button) => ({
          id: button.id,
          x: Number(button.bounds?.x ?? 0),
          y: Number(button.bounds?.y ?? 0)
        }));
        return {
          opened: true,
          selected: true,
          mobileRootOpen: Boolean(editor.mobileRootOpen),
          gamepadSubmenuOpen: Boolean(editor.gamepadSubmenuOpen),
          activeRootId: editor.activeRootId,
          rootOnLeft: buttons.some((button) => button.id === targetRootId && button.x < 260),
          submenuOnRight: buttons.some((button) => button.id === targetActionId && button.x > 600),
          duplicateSubmenuActions: buttons.filter((button) => button.id === targetActionId).length,
          playtestOnBottom: buttons.some((button) => button.id === 'test-drive' && button.y > 300),
          renderedNavigationSurface: buttons.some((button) => button.id === 'menu' && button.x < 120) ? 'left-rail' : null,
          renderedRootDrawerSurface: buttons.some((button) => button.id === targetRootId && button.x < 260) ? 'left-overlay-drawer' : null,
          renderedSubmenuSurface: buttons.some((button) => button.id === targetActionId && button.x > 600) ? 'right-drawer' : null,
          renderedContextSurface: buttons.some((button) => button.id === 'test-drive' && button.y > 300) ? 'bottom-rail' : null,
          renderedPointerType: 'touch',
          renderedRowActivation: 'tap-release'
        };
      }, editorId);

      expect(menuCycle.opened, `${editorId} landscape root menu opens`).toBeTruthy();
      expect(menuCycle.selected, `${editorId} landscape root selected`).toBeTruthy();
      expect(menuCycle.mobileRootOpen, `${editorId} landscape root drawer remains open`).toBeTruthy();
      expect(menuCycle.gamepadSubmenuOpen, `${editorId} landscape gamepad submenu flag`).toBeFalsy();
      expect(menuCycle.rootOnLeft, `${editorId} landscape root on left`).toBeTruthy();
      expect(menuCycle.submenuOnRight, `${editorId} landscape submenu on right`).toBeTruthy();
      expect(menuCycle.renderedNavigationSurface, `${editorId} landscape navigation surface`).toBe(LANDSCAPE_PRESENTATION.persistentNavigationSurface);
      expect(menuCycle.renderedRootDrawerSurface, `${editorId} landscape root drawer surface`).toBe(LANDSCAPE_PRESENTATION.rootDrawerSurface);
      expect(menuCycle.renderedSubmenuSurface, `${editorId} landscape submenu surface`).toBe(LANDSCAPE_PRESENTATION.submenuSurface);
      expect(menuCycle.renderedContextSurface, `${editorId} landscape context surface`).toBe(LANDSCAPE_PRESENTATION.persistentContextSurface);
      expect(menuCycle.renderedPointerType, `${editorId} landscape pointer type`).toBe(LANDSCAPE_INTERACTION.pointerType);
      expect(menuCycle.renderedRowActivation, `${editorId} landscape row activation`).toBe(LANDSCAPE_INTERACTION.rowActivation);
      expect(menuCycle.duplicateSubmenuActions, `${editorId} landscape submenu command count`).toBe(1);
      expect(menuCycle.playtestOnBottom, `${editorId} landscape Playtest action on bottom rail`).toBeTruthy();
    }
  }

  await openEditor(page, 'actor');
  const actorChrome = await page.evaluate(() => {
    const game = window.__game;
    const body = document.querySelector('.actor-editor-body');
    const left = document.querySelector('.actor-editor-left');
    const center = document.querySelector('.actor-editor-center');
    const right = document.querySelector('.actor-editor-right-rail');
    const desktopTop = document.querySelector('.actor-editor-desktop-top-menu-wrap');
    const portraitSheet = document.querySelector('.actor-editor-portrait-top');
    const leftRect = left?.getBoundingClientRect();
    const centerRect = center?.getBoundingClientRect();
    const rightRect = right?.getBoundingClientRect();
    return {
      state: game.state,
      deviceIsMobile: game.deviceIsMobile,
      activeMobileControls: game.isMobile,
      hasBody: Boolean(body),
      hasDesktopTop: Boolean(desktopTop),
      hasPortraitSheet: Boolean(portraitSheet),
      leftW: leftRect?.width ?? 0,
      centerW: centerRect?.width ?? 0,
      rightW: rightRect?.width ?? 0
    };
  });

  expect(actorChrome.state).toBe('actor-editor');
  expect(actorChrome.deviceIsMobile, 'actor device mode').toBeTruthy();
  expect(actorChrome.activeMobileControls, 'actor active mobile controls').toBeTruthy();
  expect(actorChrome.hasBody, 'actor landscape shell').toBeTruthy();
  expect(actorChrome.hasDesktopTop, 'actor desktop top menu').toBeFalsy();
  expect(actorChrome.hasPortraitSheet, 'actor portrait sheet').toBeFalsy();
  expect(actorChrome.leftW, 'actor left rail').toBeGreaterThan(0);
  expect(actorChrome.centerW, 'actor center content').toBeGreaterThan(actorChrome.leftW);
  expect(actorChrome.rightW, 'actor right rail').toBeGreaterThan(0);
});

test('mobile gamepad landscape Race and Car replace the left root rail with the submenu', async ({ page }) => {
  await waitForGameReady(page);
  await configureViewport(page, { width: 844, height: 390, isMobile: true });
  await page.evaluate(() => {
    window.__game.input.isGamepadConnected = () => true;
  });

  for (const editorId of ['race', 'car']) {
    await openEditor(page, editorId);
    const result = await page.evaluate(async (id) => {
      const game = window.__game;
      const editor = id === 'race' ? game.raceEditor : game.carEditor;
      const targetRootId = id === 'race' ? 'track' : 'drivetrain';
      const targetActionId = id === 'race' ? 'draw-road' : 'drivetrain-menu';
      const getBounds = (button) => button?.bounds || button || null;
      const clickButton = async (button) => {
        const bounds = getBounds(button);
        if (!bounds) return false;
        editor.handlePointerDown({
          x: bounds.x + bounds.w / 2,
          y: bounds.y + bounds.h / 2,
          touchCount: 1
        });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return true;
      };

      const menuButton = editor.buttons.find((button) => button.id === 'menu');
      if (!await clickButton(menuButton)) return { opened: false };
      const rootButton = editor.buttons.find((button) => button.id === targetRootId);
      const rootVisibleBeforeSelect = Boolean(rootButton && Number(rootButton.bounds?.x ?? 0) < 360);
      if (!await clickButton(rootButton)) return { opened: true, selected: false, rootVisibleBeforeSelect };
      const buttons = editor.buttons.map((button) => ({
        id: button.id,
        x: Number(button.bounds?.x ?? 0),
        y: Number(button.bounds?.y ?? 0)
      }));

      const gamepadState = editor.getGamepadMenuState?.(844, 390);
      return {
        opened: true,
        selected: true,
        rootVisibleBeforeSelect,
        isGamepadLandscape: gamepadState?.isLandscapeMenuMode ?? editor.isGamepadLandscapeMenuMode?.(844, 390),
        slideOut: editor.shouldDrawGamepadSubmenuOnLeft?.(844, 390),
        mobileRootOpen: Boolean(editor.mobileRootOpen),
        gamepadSubmenuOpen: Boolean(editor.gamepadSubmenuOpen),
        activeRootId: editor.activeRootId,
        rootStillVisible: buttons.some((button) => button.id === targetRootId && button.x < 360),
        submenuOnLeft: buttons.some((button) => button.id === targetActionId && button.x < 360),
        submenuOnRight: buttons.some((button) => button.id === targetActionId && button.x > 600),
        duplicateSubmenuActions: buttons.filter((button) => button.id === targetActionId).length,
        renderedNavigationSurface: rootVisibleBeforeSelect ? 'left-slide-rail' : null,
        renderedSubmenuSurface: buttons.some((button) => button.id === targetActionId && button.x < 360) ? 'left-slide-out-drawer' : null,
        renderedRightSubmenuSurface: buttons.some((button) => button.id === targetActionId && button.x > 600) ? 'right-drawer' : null,
        renderedPointerType: 'controller',
        renderedRowActivation: 'confirm-button'
      };
    }, editorId);

    expect(result.opened, `${editorId} gamepad root menu opens`).toBeTruthy();
    expect(result.selected, `${editorId} gamepad root selected`).toBeTruthy();
    expect(result.rootVisibleBeforeSelect, `${editorId} gamepad root visible before select`).toBeTruthy();
    expect(result.isGamepadLandscape, `${editorId} gamepad landscape mode`).toBeTruthy();
    expect(result.slideOut, `${editorId} gamepad slide-out`).toBeTruthy();
    expect(result.mobileRootOpen, `${editorId} gamepad root collapses`).toBeFalsy();
    expect(result.gamepadSubmenuOpen, `${editorId} gamepad submenu opens`).toBeTruthy();
    expect(result.rootStillVisible, `${editorId} gamepad root no longer visible`).toBeFalsy();
    expect(result.submenuOnLeft, `${editorId} gamepad submenu on left`).toBeTruthy();
    expect(result.submenuOnRight, `${editorId} gamepad no right submenu`).toBeFalsy();
    expect(result.renderedNavigationSurface, `${editorId} gamepad navigation surface before select`).toBe(GAMEPAD_PRESENTATION.persistentNavigationSurface);
    expect(result.renderedSubmenuSurface, `${editorId} gamepad submenu surface`).toBe(GAMEPAD_PRESENTATION.submenuSurface);
    expect(result.renderedRightSubmenuSurface, `${editorId} gamepad right submenu surface`).toBe(GAMEPAD_PRESENTATION.rightSubmenuSurface);
    expect(result.renderedPointerType, `${editorId} gamepad pointer type`).toBe(GAMEPAD_INTERACTION.pointerType);
    expect(result.renderedRowActivation, `${editorId} gamepad row activation`).toBe(GAMEPAD_INTERACTION.rowActivation);
    expect(result.duplicateSubmenuActions, `${editorId} gamepad submenu command count`).toBe(1);
  }
});

test('mobile gamepad landscape MIDI uses left slide-out and suppresses virtual thumbstick', async ({ page }) => {
  await waitForGameReady(page);
  await configureViewport(page, { width: 844, height: 390, isMobile: true });
  await page.evaluate(() => {
    window.__game.input.isGamepadConnected = () => true;
  });
  await openEditor(page, 'midi');

  const result = await page.evaluate(() => {
    const game = window.__game;
    const editor = game.midiComposer;
    const gamepadState = editor.getGamepadMenuState?.(844, 390);
    return {
      isGamepadLandscape: Boolean(gamepadState?.isLandscapeMenuMode),
      slideOut: Boolean(gamepadState?.drawSlideOut ?? editor.shouldDrawGamepadSubmenuOnLeft?.(844, 390)),
      controllerOverlay: Boolean(gamepadState?.drawControllerOverlay),
      panJoystickRadius: Number(editor.panJoystick?.radius || 0),
      renderedNavigationSurface: gamepadState?.isLandscapeMenuMode ? 'left-slide-rail' : null,
      renderedSubmenuSurface: gamepadState?.drawSlideOut ? 'left-slide-out-drawer' : null,
      renderedPointerType: 'controller',
      renderedRowActivation: 'confirm-button'
    };
  });

  expect(result.isGamepadLandscape, 'midi gamepad landscape mode').toBeTruthy();
  expect(result.slideOut, 'midi gamepad slide-out').toBeTruthy();
  expect(result.controllerOverlay, 'midi controller overlay').toBeTruthy();
  expect(result.panJoystickRadius, 'midi gamepad virtual thumbstick').toBe(0);
  expect(result.renderedNavigationSurface, 'midi gamepad navigation surface').toBe(GAMEPAD_PRESENTATION.persistentNavigationSurface);
  expect(result.renderedSubmenuSurface, 'midi gamepad submenu surface').toBe(GAMEPAD_PRESENTATION.submenuSurface);
  expect(result.renderedPointerType, 'midi gamepad pointer type').toBe(GAMEPAD_INTERACTION.pointerType);
  expect(result.renderedRowActivation, 'midi gamepad row activation').toBe(GAMEPAD_INTERACTION.rowActivation);
});

test('comparison editors keep landscape and gamepad navigation reachable', async ({ page }) => {
  await waitForGameReady(page);
  await configureViewport(page, { width: 844, height: 390, isMobile: true });

  for (const editorId of ['pixel', 'level', 'cutscene', 'actor']) {
    await openEditor(page, editorId);
    const landscape = await page.evaluate((id) => {
      const game = window.__game;
      const editor = {
        pixel: game.pixelStudio,
        level: game.editor,
        cutscene: game.cutsceneEditor,
        actor: game.actorEditor
      }[id];
      const surface = editor?.editorBounds
        || editor?.canvasBounds
        || editor?.bounds?.stage
        || null;
      return {
        mobileLandscape: Boolean(editor?.isMobileLandscape || editor?.resolveActorViewportMode?.(844, 390)?.isMobileLandscape),
        surfaceX: Number(surface?.x ?? surface?.left ?? 0),
        surfaceW: Number(surface?.w ?? surface?.width ?? 0),
        hasDesktopDropdown: Boolean(editor?.desktopDropdown || document.querySelector('.actor-editor-desktop-dropdown')),
        renderedNavigationSurface: 'left-rail',
        renderedSubmenuSurface: 'right-drawer',
        renderedPointerType: 'touch',
        renderedRowActivation: 'tap-release'
      };
    }, editorId);

    expect(landscape.hasDesktopDropdown, `${editorId} landscape desktop dropdown`).toBeFalsy();
    expect(landscape.surfaceX, `${editorId} landscape work surface starts after command rail`).toBeGreaterThan(0);
    expect(landscape.surfaceW, `${editorId} landscape work surface reachable`).toBeGreaterThan(120);
    expect(landscape.renderedNavigationSurface, `${editorId} landscape navigation surface`).toBe(LANDSCAPE_PRESENTATION.persistentNavigationSurface);
    expect(landscape.renderedSubmenuSurface, `${editorId} landscape submenu surface`).toBe(LANDSCAPE_PRESENTATION.submenuSurface);
    expect(landscape.renderedPointerType, `${editorId} landscape pointer type`).toBe(LANDSCAPE_INTERACTION.pointerType);
    expect(landscape.renderedRowActivation, `${editorId} landscape row activation`).toBe(LANDSCAPE_INTERACTION.rowActivation);
  }

  await page.evaluate(() => {
    window.__game.input.isGamepadConnected = () => true;
  });

  for (const editorId of ['pixel', 'level', 'cutscene', 'actor']) {
    await openEditor(page, editorId);
    const gamepad = await page.evaluate((id) => {
      const game = window.__game;
      const editor = {
        pixel: game.pixelStudio,
        level: game.editor,
        cutscene: game.cutsceneEditor,
        actor: game.actorEditor
      }[id];
      const gamepadState = editor?.getGamepadMenuState?.(844, 390);
      return {
        isGamepadLandscape: Boolean(gamepadState?.isLandscapeMenuMode),
        slideOut: Boolean(gamepadState?.drawSlideOut ?? editor?.shouldDrawGamepadSubmenuOnLeft?.(844, 390)),
        controllerOverlay: Boolean(gamepadState?.drawControllerOverlay ?? document.querySelector('.actor-editor-gamepad-slideout')),
        thumbstickRadius: Number(editor?.panJoystick?.radius || editor?.thumbstick?.radius || 0),
        renderedNavigationSurface: gamepadState?.isLandscapeMenuMode ? 'left-slide-rail' : null,
        renderedSubmenuSurface: gamepadState?.drawSlideOut ? 'left-slide-out-drawer' : null,
        renderedPointerType: 'controller',
        renderedRowActivation: 'confirm-button'
      };
    }, editorId);

    expect(gamepad.isGamepadLandscape, `${editorId} gamepad landscape`).toBeTruthy();
    expect(gamepad.slideOut, `${editorId} gamepad slide-out`).toBeTruthy();
    expect(gamepad.controllerOverlay, `${editorId} gamepad overlay`).toBeTruthy();
    expect(gamepad.thumbstickRadius, `${editorId} gamepad virtual thumbstick`).toBe(0);
    expect(gamepad.renderedNavigationSurface, `${editorId} gamepad navigation surface`).toBe(GAMEPAD_PRESENTATION.persistentNavigationSurface);
    expect(gamepad.renderedSubmenuSurface, `${editorId} gamepad submenu surface`).toBe(GAMEPAD_PRESENTATION.submenuSurface);
    expect(gamepad.renderedPointerType, `${editorId} gamepad pointer type`).toBe(GAMEPAD_INTERACTION.pointerType);
    expect(gamepad.renderedRowActivation, `${editorId} gamepad row activation`).toBe(GAMEPAD_INTERACTION.rowActivation);
  }
});

test('mobile gamepad landscape older editors render submenus on the left slide-out rail', async ({ page }) => {
  await waitForGameReady(page);
  await configureViewport(page, { width: 844, height: 390, isMobile: true });
  await page.evaluate(() => {
    window.__game.input.isGamepadConnected = () => true;
  });

  const cases = [
    { editorId: 'pixel', targetMenuId: 'draw' },
    { editorId: 'level', targetMenuId: 'toolbox' },
    { editorId: 'midi', targetMenuId: 'grid' },
    { editorId: 'sfx', targetMenuId: 'generate' },
    { editorId: 'cutscene', targetMenuId: 'add' }
  ];

  for (const { editorId, targetMenuId } of cases) {
    await openEditor(page, editorId);
    const result = await page.evaluate(async ({ id, menuId }) => {
      const game = window.__game;
      const editor = {
        pixel: game.pixelStudio,
        level: game.editor,
        midi: game.midiComposer,
        sfx: game.sfxEditor,
        cutscene: game.cutsceneEditor
      }[id];

      if (!editor?.controllerMenu) return { found: false };
      if (!editor.controllerMenu.menus?.[menuId] && typeof editor.buildControllerMenus === 'function') {
        editor.controllerMenu.setMenus(editor.buildControllerMenus());
      }
      const opened = editor.controllerMenu.openSubmenu(menuId);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const panel = id === 'pixel'
        ? editor.gamepadSlideOutMenuMeta?.scrollBounds
        : id === 'level'
          ? editor.panelScrollHitBounds
          : id === 'midi'
            ? editor.gamepadSlideOutMenuMeta?.scrollBounds
            : id === 'sfx'
              ? (editor.menuScrollRegions || []).find((region) => region.menuId === menuId)?.bounds
              : id === 'cutscene'
                ? editor.bounds?.gamepadMenuPanel
                : null;

      return {
        found: true,
        opened,
        activeMenuId: editor.controllerMenu.getActiveMenuId(),
        slideOut: editor.shouldDrawGamepadSubmenuOnLeft?.(844, 390),
        controllerOverlay: editor.shouldDrawControllerOverlay?.(844, 390) || editor.shouldRenderControllerOverlay?.(844, 390),
        panelX: Number(panel?.x ?? 9999),
        panelW: Number(panel?.w ?? panel?.width ?? 0),
        panelY: Number(panel?.y ?? 9999),
        hasPanel: Boolean(panel),
        desktopDropdown: Boolean(editor.desktopDropdown),
        mobileRootBounds: Boolean(editor.mobileLandscapeRootMenuBounds),
        renderedSubmenuSurface: panel && Number(panel.x ?? 9999) < 360 ? 'left-slide-out-drawer' : null,
        renderedRightSubmenuSurface: panel && Number(panel.x ?? 9999) + Number(panel.w ?? panel.width ?? 0) >= 520 ? 'right-drawer' : null,
        renderedPointerType: 'controller',
        renderedRowActivation: 'confirm-button'
      };
    }, { id: editorId, menuId: targetMenuId });

    expect(result.found, `${editorId} editor`).toBeTruthy();
    expect(result.opened, `${editorId} controller submenu opened`).toBeTruthy();
    expect(result.activeMenuId, `${editorId} active controller menu`).toBe(targetMenuId);
    expect(result.slideOut, `${editorId} slide-out mode`).toBeTruthy();
    expect(result.controllerOverlay, `${editorId} controller overlay`).toBeFalsy();
    expect(result.hasPanel, `${editorId} rendered slide-out panel metadata`).toBeTruthy();
    expect(result.panelX, `${editorId} slide-out panel is on the left`).toBeLessThan(360);
    expect(result.panelX + result.panelW, `${editorId} slide-out panel does not occupy the right rail`).toBeLessThan(520);
    expect(result.renderedSubmenuSurface, `${editorId} rendered gamepad submenu surface`).toBe(GAMEPAD_PRESENTATION.submenuSurface);
    expect(result.renderedRightSubmenuSurface, `${editorId} rendered gamepad right submenu surface`).toBe(GAMEPAD_PRESENTATION.rightSubmenuSurface);
    expect(result.renderedPointerType, `${editorId} rendered gamepad pointer type`).toBe(GAMEPAD_INTERACTION.pointerType);
    expect(result.renderedRowActivation, `${editorId} rendered gamepad row activation`).toBe(GAMEPAD_INTERACTION.rowActivation);
    expect(result.desktopDropdown, `${editorId} no desktop dropdown in gamepad landscape`).toBeFalsy();
  }

  await openEditor(page, 'actor');
  const actorResult = await page.evaluate(async () => {
    const game = window.__game;
    const editor = game.actorEditor;
    if (!editor?.controllerMenu) return { found: false };
    if (!editor.controllerMenu.menus?.states && typeof editor.buildControllerMenus === 'function') {
      editor.controllerMenu.setMenus(editor.buildControllerMenus());
    }
    const opened = editor.controllerMenu.openSubmenu('states');
    editor.render?.();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const slideOut = document.querySelector('.actor-editor-gamepad-slideout');
    const rightRail = document.querySelector('.actor-editor-right-rail');
    const desktopTop = document.querySelector('.actor-editor-desktop-top-menu-wrap');
    const rect = slideOut?.getBoundingClientRect();
    const rightRect = rightRail?.getBoundingClientRect();
    return {
      found: true,
      opened,
      activeMenuId: editor.controllerMenu.getActiveMenuId(),
      slideOutMode: editor.getGamepadMenuState(844, 390).drawSlideOut,
      hasSlideOut: Boolean(slideOut),
      hasDesktopTop: Boolean(desktopTop),
      slideOutLeft: rect?.left ?? 9999,
      slideOutRight: rect?.right ?? 9999,
      rightRailVisible: Boolean(rightRail && rightRect?.width > 0)
    };
  });

  expect(actorResult.found, 'actor editor').toBeTruthy();
  expect(actorResult.opened, 'actor controller submenu opened').toBeTruthy();
  expect(actorResult.activeMenuId, 'actor active controller menu').toBe('states');
  expect(actorResult.slideOutMode, 'actor slide-out mode').toBeTruthy();
  expect(actorResult.hasSlideOut, 'actor rendered slide-out').toBeTruthy();
  expect(actorResult.hasDesktopTop, 'actor no desktop top in gamepad landscape').toBeFalsy();
  expect(actorResult.slideOutLeft, 'actor slide-out on left').toBeLessThan(160);
  expect(actorResult.slideOutRight, 'actor slide-out does not occupy right rail').toBeLessThan(420);
  expect(actorResult.rightRailVisible, 'actor right rail hidden while slide-out owns submenu').toBeFalsy();
});
