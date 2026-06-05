function getOverlayRoot() {
  let root = document.getElementById('global-overlay-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'global-overlay-root';
    document.body.appendChild(root);
  }
  return root;
}

function buildInputAttributes(input, options) {
  const type = options.inputType || 'text';
  if (type === 'int' || type === 'float') {
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    if (type === 'int') input.pattern = '-?[0-9]*';
    if (Number.isFinite(options.min)) input.min = String(options.min);
    if (Number.isFinite(options.max)) input.max = String(options.max);
    if (Number.isFinite(options.step)) input.step = String(options.step);
  }
}

function lockPageForOverlay() {
  const previousActive = document.activeElement;
  const body = document.body;
  const previousOverflow = body.style.overflow;
  const previousTouchAction = body.style.touchAction;
  body.style.overflow = 'hidden';
  return () => {
    body.style.overflow = previousOverflow;
    body.style.touchAction = previousTouchAction;
    previousActive?.focus?.();
  };
}

const OVERLAY_PANEL_SHIELDED_EVENTS = [
  'pointerdown',
  'pointerup',
  'click',
  'touchstart',
  'touchend',
  'touchmove',
  'mousedown',
  'mouseup',
  'pointermove'
];

function shieldOverlayPanelEvents(panel) {
  OVERLAY_PANEL_SHIELDED_EVENTS.forEach((type) => {
    panel.addEventListener(type, (event) => {
      event.stopPropagation();
    });
  });
}

function createOverlayPanel({
  title = '',
  message = '',
  width = null,
  maxWidth = 420,
  className = ''
} = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'shared-text-input-overlay';
  overlay.tabIndex = -1;

  const panel = document.createElement('div');
  panel.className = `shared-text-input-panel${className ? ` ${className}` : ''}`;
  if (Number.isFinite(width) && width > 0) panel.style.width = `${width}px`;
  if (Number.isFinite(maxWidth) && maxWidth > 0) panel.style.maxWidth = `${maxWidth}px`;
  shieldOverlayPanelEvents(panel);
  overlay.appendChild(panel);

  if (title) {
    const titleEl = document.createElement('h3');
    titleEl.className = 'shared-text-input-title';
    titleEl.textContent = title;
    panel.appendChild(titleEl);
  }

  if (message) {
    const bodyEl = document.createElement('div');
    bodyEl.className = 'shared-text-input-label';
    bodyEl.textContent = message;
    panel.appendChild(bodyEl);
  }

  return { overlay, panel };
}

function appendActionButton(row, label, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `shared-text-input-btn${className ? ` ${className}` : ''}`;
  button.textContent = label;
  row.appendChild(button);
  return button;
}

export function openProgressOverlay(options = {}) {
  const {
    title = 'Processing',
    message = 'Preparing...',
    width = null,
    maxWidth = 460
  } = options;
  if (typeof document === 'undefined') {
    return {
      update() {},
      close() {}
    };
  }

  const unlock = lockPageForOverlay();
  const { overlay, panel } = createOverlayPanel({ title, message, width, maxWidth, className: 'multi-field' });
  const label = panel.querySelector('.shared-text-input-label');
  const meter = document.createElement('div');
  meter.className = 'shared-progress-meter';
  const fill = document.createElement('div');
  fill.className = 'shared-progress-fill';
  meter.appendChild(fill);
  panel.appendChild(meter);
  getOverlayRoot().appendChild(overlay);
  overlay.focus({ preventScroll: true });

  let current = 0;
  let target = 0;
  let closed = false;
  const render = () => {
    current += (target - current) * 0.18;
    fill.style.width = `${Math.max(0, Math.min(100, current))}%`;
  };
  const timer = window.setInterval(render, 80);

  return {
    update(nextTarget, nextMessage) {
      if (closed) return;
      target = Math.max(target, Math.max(0, Math.min(100, Number(nextTarget) || 0)));
      if (nextMessage && label) label.textContent = nextMessage;
      render();
    },
    close() {
      if (closed) return;
      closed = true;
      window.clearInterval(timer);
      fill.style.width = '100%';
      overlay.remove();
      unlock();
    }
  };
}

export function openChoiceOverlay(options = {}) {
  const {
    title = 'Choose an option',
    message = '',
    choices = [],
    cancelText = 'Cancel',
    width = null,
    maxWidth = 460
  } = options;
  if (typeof document === 'undefined') return Promise.resolve(null);
  const unlock = lockPageForOverlay();
  return new Promise((resolve) => {
    const { overlay, panel } = createOverlayPanel({ title, message, width, maxWidth, className: 'choice' });
    const list = document.createElement('div');
    list.className = 'shared-choice-list';
    panel.appendChild(list);

    const cleanup = (value) => {
      overlay.remove();
      unlock();
      resolve(value);
    };

    choices.forEach((choice) => {
      const button = appendActionButton(list, choice.label || choice.value || 'Option', choice.primary ? 'primary' : '');
      button.addEventListener('click', () => cleanup(choice.value ?? choice.id ?? choice.label));
    });

    const row = document.createElement('div');
    row.className = 'shared-text-input-actions';
    panel.appendChild(row);
    const cancelBtn = appendActionButton(row, cancelText);
    cancelBtn.addEventListener('click', () => cleanup(null));

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) cleanup(null);
    });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup(null);
      }
    });

    getOverlayRoot().appendChild(overlay);
    overlay.focus({ preventScroll: true });
  });
}

export function openConfirmOverlay(options = {}) {
  const {
    title = 'Are you sure?',
    message = '',
    confirmText = 'Continue',
    cancelText = 'Cancel',
    danger = false,
    width = null,
    maxWidth = 460
  } = options;
  if (typeof document === 'undefined') return Promise.resolve(false);
  const unlock = lockPageForOverlay();
  return new Promise((resolve) => {
    const { overlay, panel } = createOverlayPanel({ title, message, width, maxWidth, className: 'confirm' });
    const row = document.createElement('div');
    row.className = 'shared-text-input-actions';
    panel.appendChild(row);
    const cancelBtn = appendActionButton(row, cancelText);
    const okBtn = appendActionButton(row, confirmText, danger ? 'danger' : 'primary');

    const cleanup = (value) => {
      overlay.remove();
      unlock();
      resolve(value);
    };

    cancelBtn.addEventListener('click', () => cleanup(false));
    okBtn.addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) cleanup(false);
    });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup(false);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        cleanup(true);
      }
    });

    getOverlayRoot().appendChild(overlay);
    overlay.focus({ preventScroll: true });
  });
}

export function openTextInputOverlay(options = {}) {
  const {
    title = 'Enter value',
    label = '',
    placeholder = '',
    initialValue = '',
    confirmText = 'Apply',
    cancelText = 'Cancel',
    inputType = 'text',
    multiline = false,
    rows = 6,
    width = null,
    maxWidth = 420,
    top = null,
    left = null
  } = options;

  const unlock = lockPageForOverlay();

  return new Promise((resolve) => {
    const { overlay, panel } = createOverlayPanel({ title, maxWidth });
    if (Number.isFinite(width) && width > 0) panel.style.width = `${width}px`;
    if (Number.isFinite(top)) {
      panel.style.position = 'fixed';
      panel.style.top = `${top}px`;
      panel.style.transform = 'translateY(0)';
      panel.style.margin = '0';
    }
    if (Number.isFinite(left)) {
      panel.style.left = `${left}px`;
      panel.style.transform = 'translateX(-50%)';
    }

    if (label) {
      const labelEl = document.createElement('div');
      labelEl.className = 'shared-text-input-label';
      labelEl.textContent = label;
      panel.appendChild(labelEl);
    }

    const useTextarea = multiline || inputType === 'textarea' || inputType === 'multiline';
    const input = document.createElement(useTextarea ? 'textarea' : 'input');
    input.className = 'shared-text-input-field';
    input.value = String(initialValue ?? '');
    input.placeholder = placeholder;
    if (useTextarea) {
      input.rows = Math.max(3, Math.round(Number(rows) || 6));
      input.spellcheck = false;
    } else {
      buildInputAttributes(input, { inputType, ...options });
    }
    panel.appendChild(input);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'shared-text-input-actions';
    panel.appendChild(buttonRow);

    const cancelBtn = appendActionButton(buttonRow, cancelText);
    const okBtn = appendActionButton(buttonRow, confirmText, 'primary');

    const cleanup = (value) => {
      overlay.remove();
      unlock();
      resolve(value);
    };

    cancelBtn.addEventListener('click', () => cleanup(null));
    okBtn.addEventListener('click', () => cleanup(input.value));

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) cleanup(null);
    });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup(null);
      }
      if (event.key === 'Enter' && (!useTextarea || event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        cleanup(input.value);
      }
    });

    getOverlayRoot().appendChild(overlay);
    overlay.focus({ preventScroll: true });
    input.focus({ preventScroll: true });
    input.select();
  });
}

export function openMultiNumberInputOverlay(options = {}) {
  const {
    title = 'Enter values',
    fields = [],
    confirmText = 'Apply',
    cancelText = 'Cancel',
    width = null,
    maxWidth = 460
  } = options;

  const unlock = lockPageForOverlay();

  return new Promise((resolve) => {
    const { overlay, panel } = createOverlayPanel({ title, maxWidth, className: 'multi-field' });
    if (Number.isFinite(width) && width > 0) panel.style.width = `${width}px`;

    const inputMap = new Map();
    fields.forEach((field) => {
      const row = document.createElement('label');
      row.className = 'shared-number-input-row';

      const label = document.createElement('span');
      label.className = 'shared-number-input-label';
      label.textContent = field.label || field.id;
      row.appendChild(label);

      const input = document.createElement('input');
      input.className = 'shared-text-input-field';
      input.type = 'text';
      input.inputMode = 'decimal';
      input.value = String(field.initialValue ?? '');
      input.autocomplete = 'off';
      if (field.integer) {
        input.pattern = '-?[0-9]*';
      }
      row.appendChild(input);

      panel.appendChild(row);
      inputMap.set(field.id, input);
    });

    const buttonRow = document.createElement('div');
    buttonRow.className = 'shared-text-input-actions';
    panel.appendChild(buttonRow);

    const cancelBtn = appendActionButton(buttonRow, cancelText);
    const okBtn = appendActionButton(buttonRow, confirmText, 'primary');

    const cleanup = (value) => {
      overlay.remove();
      unlock();
      resolve(value);
    };

    const collect = () => {
      const values = {};
      fields.forEach((field) => {
        const input = inputMap.get(field.id);
        const raw = Number(input?.value);
        const fallback = Number(field.initialValue) || 0;
        values[field.id] = Number.isFinite(raw) ? raw : fallback;
      });
      cleanup(values);
    };

    cancelBtn.addEventListener('click', () => cleanup(null));
    okBtn.addEventListener('click', collect);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) cleanup(null);
    });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup(null);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        collect();
      }
    });

    getOverlayRoot().appendChild(overlay);
    overlay.focus({ preventScroll: true });
    const firstInput = inputMap.values().next().value;
    firstInput?.focus?.({ preventScroll: true });
    firstInput?.select?.();
  });
}
