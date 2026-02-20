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

export function openTextInputOverlay(options = {}) {
  const {
    title = 'Enter value',
    label = '',
    placeholder = '',
    initialValue = '',
    confirmText = 'Apply',
    cancelText = 'Cancel',
    inputType = 'text',
    width = null,
    maxWidth = 420,
    top = null,
    left = null
  } = options;

  const previousActive = document.activeElement;
  const body = document.body;
  const previousOverflow = body.style.overflow;
  const previousTouchAction = body.style.touchAction;
  body.style.overflow = 'hidden';
  body.style.touchAction = 'none';

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'shared-text-input-overlay';
    overlay.tabIndex = -1;

    const panel = document.createElement('div');
    panel.className = 'shared-text-input-panel';
    if (Number.isFinite(width) && width > 0) panel.style.width = `${width}px`;
    if (Number.isFinite(maxWidth) && maxWidth > 0) panel.style.maxWidth = `${maxWidth}px`;
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
    overlay.appendChild(panel);

    const titleEl = document.createElement('h3');
    titleEl.className = 'shared-text-input-title';
    titleEl.textContent = title;
    panel.appendChild(titleEl);

    if (label) {
      const labelEl = document.createElement('div');
      labelEl.className = 'shared-text-input-label';
      labelEl.textContent = label;
      panel.appendChild(labelEl);
    }

    const input = document.createElement('input');
    input.className = 'shared-text-input-field';
    input.value = String(initialValue ?? '');
    input.placeholder = placeholder;
    buildInputAttributes(input, { inputType, ...options });
    panel.appendChild(input);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'shared-text-input-actions';
    panel.appendChild(buttonRow);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'shared-text-input-btn';
    cancelBtn.textContent = cancelText;
    buttonRow.appendChild(cancelBtn);

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'shared-text-input-btn primary';
    okBtn.textContent = confirmText;
    buttonRow.appendChild(okBtn);

    const cleanup = (value) => {
      overlay.remove();
      body.style.overflow = previousOverflow;
      body.style.touchAction = previousTouchAction;
      previousActive?.focus?.();
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
      if (event.key === 'Enter') {
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
