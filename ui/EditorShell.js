const setStyles = (element, styles) => {
  Object.entries(styles).forEach(([key, value]) => {
    element.style[key] = value;
  });
};

const DEFAULT_EDITOR_SHELL_THEME = {
  background: '#0b0b0b',
  surface: 'rgba(12, 14, 18, 0.95)',
  surfaceAlt: 'rgba(0, 0, 0, 0.5)',
  border: 'rgba(255, 255, 255, 0.2)',
  text: '#ffffff',
  textMuted: 'rgba(255, 255, 255, 0.7)',
  accent: '#ffe16a',
  danger: '#ff6a6a',
  dangerSurface: 'rgba(255, 90, 90, 0.25)',
  dangerBorder: 'rgba(255, 120, 120, 0.6)',
  dangerText: '#ffd0d0'
};

const DEFAULT_EDITOR_SHELL_LAYOUT = {
  leftRailWidth: 292,
  topBarHeight: 40,
  gap: 8
};

const resolveCssVariable = (name, fallback) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name)?.trim();
  return value || fallback;
};

const parseCssPixelValue = (value, fallback) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const resolveEditorShellTheme = () => ({
  background: resolveCssVariable('--editor-bg', DEFAULT_EDITOR_SHELL_THEME.background),
  surface: resolveCssVariable('--editor-surface', DEFAULT_EDITOR_SHELL_THEME.surface),
  surfaceAlt: resolveCssVariable('--editor-surface-alt', DEFAULT_EDITOR_SHELL_THEME.surfaceAlt),
  border: resolveCssVariable('--editor-border', DEFAULT_EDITOR_SHELL_THEME.border),
  text: resolveCssVariable('--editor-text', DEFAULT_EDITOR_SHELL_THEME.text),
  textMuted: resolveCssVariable('--editor-text-muted', DEFAULT_EDITOR_SHELL_THEME.textMuted),
  accent: resolveCssVariable('--editor-accent', DEFAULT_EDITOR_SHELL_THEME.accent),
  danger: resolveCssVariable('--editor-danger', DEFAULT_EDITOR_SHELL_THEME.danger),
  dangerSurface: resolveCssVariable('--editor-danger-surface', DEFAULT_EDITOR_SHELL_THEME.dangerSurface),
  dangerBorder: resolveCssVariable('--editor-danger-border', DEFAULT_EDITOR_SHELL_THEME.dangerBorder),
  dangerText: resolveCssVariable('--editor-danger-text', DEFAULT_EDITOR_SHELL_THEME.dangerText)
});

export const createEditorShellLayout = ({
  viewportWidth,
  viewportHeight,
  leftPanelFrame,
  bottomBarHeight = 0,
  gap = DEFAULT_EDITOR_SHELL_LAYOUT.gap
}) => {
  const topBarHeight = parseCssPixelValue(resolveCssVariable('--editor-top-bar-height', null), DEFAULT_EDITOR_SHELL_LAYOUT.topBarHeight);
  const frame = leftPanelFrame || {
    panelX: gap,
    panelY: gap,
    panelW: parseCssPixelValue(resolveCssVariable('--editor-left-rail-width', null), DEFAULT_EDITOR_SHELL_LAYOUT.leftRailWidth),
    panelH: Math.max(0, viewportHeight - gap * 2),
    contentX: parseCssPixelValue(resolveCssVariable('--editor-left-rail-width', null), DEFAULT_EDITOR_SHELL_LAYOUT.leftRailWidth) + gap * 2,
    contentW: Math.max(0, viewportWidth - parseCssPixelValue(resolveCssVariable('--editor-left-rail-width', null), DEFAULT_EDITOR_SHELL_LAYOUT.leftRailWidth) - gap * 3)
  };
  const mainY = frame.panelY + topBarHeight + gap;
  const mainH = Math.max(0, frame.panelH - topBarHeight - gap - bottomBarHeight - gap);
  const bottomY = mainY + mainH + gap;

  return {
    topBar: { x: frame.contentX, y: frame.panelY, w: frame.contentW, h: topBarHeight },
    leftRail: { x: frame.panelX, y: frame.panelY, w: frame.panelW, h: frame.panelH },
    mainContent: { x: frame.contentX, y: mainY, w: frame.contentW, h: mainH },
    bottomBar: { x: frame.contentX, y: bottomY, w: frame.contentW, h: bottomBarHeight }
  };
};

/**
 * Shared editor shell foundation.
 * Provides generic layout containers only:
 * - TopBar
 * - LeftRail
 * - MainContent
 */
export default class EditorShell {
  constructor() {
    this.root = document.createElement('section');
    this.topBar = document.createElement('header');
    this.body = document.createElement('div');
    this.leftRail = document.createElement('aside');
    this.mainContent = document.createElement('main');

    this.topBar.setAttribute('data-editor-shell-slot', 'topbar');
    this.leftRail.setAttribute('data-editor-shell-slot', 'leftrail');
    this.mainContent.setAttribute('data-editor-shell-slot', 'maincontent');

    this.root.appendChild(this.topBar);
    this.root.appendChild(this.body);
    this.body.appendChild(this.leftRail);
    this.body.appendChild(this.mainContent);

    this.applyStyles();
  }

  applyStyles() {
    setStyles(this.root, {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      minHeight: '100%',
      background: 'var(--editor-bg)',
      color: 'var(--editor-text)',
      fontFamily: 'var(--editor-font-family)',
      boxSizing: 'border-box'
    });

    setStyles(this.topBar, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 'var(--editor-top-bar-height)',
      height: 'var(--editor-top-bar-height)',
      padding: '0 var(--editor-space-4)',
      borderBottom: '1px solid var(--editor-border)',
      background: 'var(--editor-surface)',
      boxSizing: 'border-box',
      flex: '0 0 auto'
    });

    setStyles(this.body, {
      display: 'flex',
      flex: '1 1 auto',
      minHeight: '0',
      width: '100%',
      boxSizing: 'border-box'
    });

    setStyles(this.leftRail, {
      width: 'var(--editor-left-rail-width)',
      minWidth: 'var(--editor-left-rail-width)',
      maxWidth: 'var(--editor-left-rail-width)',
      borderRight: '1px solid var(--editor-border)',
      background: 'var(--editor-surface)',
      boxSizing: 'border-box',
      overflow: 'auto'
    });

    setStyles(this.mainContent, {
      flex: '1 1 auto',
      minWidth: '0',
      minHeight: '0',
      background: 'var(--editor-surface-alt)',
      boxSizing: 'border-box',
      overflow: 'auto'
    });
  }

  mount(container) {
    container.appendChild(this.root);
    return this;
  }

  unmount() {
    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }

  getSlots() {
    return {
      root: this.root,
      topBar: this.topBar,
      leftRail: this.leftRail,
      mainContent: this.mainContent
    };
  }
}
