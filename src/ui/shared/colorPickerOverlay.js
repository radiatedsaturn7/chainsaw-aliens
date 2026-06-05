const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function getOverlayRoot() {
  let root = document.getElementById('global-overlay-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'global-overlay-root';
    document.body.appendChild(root);
  }
  return root;
}

function normalizeHex(value, fallback = '#ffffff') {
  const text = String(value || '').trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(text)) return fallback;
  return `#${text.replace(/^#/, '').toLowerCase()}`;
}

function hexToRgb(hex) {
  const clean = normalizeHex(hex).slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => clamp(Math.round(Number(value) || 0), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function lockPageForOverlay() {
  const previousActive = document.activeElement;
  const body = document.body;
  const previousOverflow = body.style.overflow;
  body.style.overflow = 'hidden';
  return () => {
    body.style.overflow = previousOverflow;
    previousActive?.focus?.();
  };
}

export function openColorPickerOverlay(options = {}) {
  const {
    title = 'Pick Color',
    initialValue = '#ffffff',
    cancelText = 'Cancel',
    applyText = 'Apply'
  } = options;
  const initialHex = normalizeHex(initialValue);
  if (typeof document === 'undefined') return Promise.resolve(initialHex);
  const unlock = lockPageForOverlay();
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'shared-text-input-overlay';
    overlay.tabIndex = -1;

    const panel = document.createElement('div');
    panel.className = 'shared-text-input-panel multi-field';
    panel.style.maxWidth = '420px';
    panel.addEventListener('pointerdown', (event) => event.stopPropagation());
    panel.addEventListener('pointermove', (event) => event.stopPropagation());
    panel.addEventListener('pointerup', (event) => event.stopPropagation());
    panel.addEventListener('click', (event) => event.stopPropagation());
    overlay.appendChild(panel);

    const heading = document.createElement('h3');
    heading.className = 'shared-text-input-title';
    heading.textContent = title;
    panel.appendChild(heading);

    const preview = document.createElement('div');
    preview.style.height = '48px';
    preview.style.border = '1px solid rgba(255,255,255,0.35)';
    preview.style.marginBottom = '12px';
    panel.appendChild(preview);

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = initialHex;
    colorInput.style.width = '100%';
    colorInput.style.height = '44px';
    colorInput.style.marginBottom = '12px';
    panel.appendChild(colorInput);

    const sliders = {};
    const addSlider = (label, key) => {
      const row = document.createElement('label');
      row.className = 'shared-text-input-label';
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '28px 1fr 44px';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.margin = '8px 0';
      const name = document.createElement('span');
      name.textContent = label;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '255';
      input.step = '1';
      const value = document.createElement('span');
      value.style.textAlign = 'right';
      row.appendChild(name);
      row.appendChild(input);
      row.appendChild(value);
      panel.appendChild(row);
      sliders[key] = { input, value };
    };
    addSlider('R', 'r');
    addSlider('G', 'g');
    addSlider('B', 'b');

    let rgb = hexToRgb(initialHex);
    const sync = (source) => {
      if (source === 'color') rgb = hexToRgb(colorInput.value);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      colorInput.value = hex;
      preview.style.background = hex;
      Object.entries(sliders).forEach(([key, parts]) => {
        parts.input.value = String(rgb[key]);
        parts.value.textContent = String(rgb[key]);
      });
    };

    Object.entries(sliders).forEach(([key, parts]) => {
      parts.input.addEventListener('input', () => {
        rgb[key] = clamp(Math.round(Number(parts.input.value) || 0), 0, 255);
        sync('slider');
      });
    });
    colorInput.addEventListener('input', () => sync('color'));

    const cleanup = (value) => {
      overlay.remove();
      unlock();
      resolve(value);
    };

    const row = document.createElement('div');
    row.className = 'shared-text-input-actions';
    panel.appendChild(row);
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'shared-text-input-btn';
    cancel.textContent = cancelText;
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'shared-text-input-btn primary';
    apply.textContent = applyText;
    row.appendChild(cancel);
    row.appendChild(apply);
    cancel.addEventListener('click', () => cleanup(null));
    apply.addEventListener('click', () => cleanup(rgbToHex(rgb.r, rgb.g, rgb.b)));

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
        cleanup(rgbToHex(rgb.r, rgb.g, rgb.b));
      }
    });

    getOverlayRoot().appendChild(overlay);
    sync('initial');
    overlay.focus({ preventScroll: true });
  });
}

