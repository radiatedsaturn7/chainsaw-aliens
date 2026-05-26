import {
  PROJECT_FOLDERS,
  deleteProjectFile,
  duplicateProjectFile,
  ensureProjectFileIndex,
  projectFileExists,
  listProjectFiles,
  loadProjectFile,
  renameProjectFile,
  sanitizeProjectFileName
} from './projectFiles.js';
import { hydrateServerStorage } from './serverStorage.js';
import { fileTypeBadge } from './uiSuite.js';

const FOLDER_LABELS = { levels: 'Levels', art: 'Art', music: 'Music', actors: 'Actors' };
const DEFAULT_FOLDERS = ['levels', 'art', 'music', 'actors'];
let activePreviewTrackId = null;

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function formatSize(chars = 0) {
  if (!Number.isFinite(chars) || chars <= 0) return '—';
  if (chars < 1024) return `${chars} chars`;
  return `${(chars / 1024).toFixed(1)} KB`;
}

function makeButton(label, className, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function makeIconButton(icon, title, className, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.textContent = icon;
  btn.addEventListener('click', onClick);
  return btn;
}

function getOverlayRoot() {
  let root = document.getElementById('global-overlay-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'global-overlay-root';
    Object.assign(root.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      pointerEvents: 'none'
    });
    document.body.appendChild(root);
  }
  return root;
}

function isAllowedFile(folder, name) {
  const value = String(name || '').toLowerCase();
  if (!value) return false;
  if (folder === 'levels') return value.endsWith('.json') || !value.includes('.');
  if (folder === 'music') return value.endsWith('.json') || value.endsWith('.mid') || !value.includes('.');
  if (folder === 'actors') return value.endsWith('.json') || !value.includes('.');
  return true;
}

function readAvailableFolders(fixedFolder) {
  if (fixedFolder && DEFAULT_FOLDERS.includes(fixedFolder)) return [fixedFolder];
  return [...DEFAULT_FOLDERS];
}

function listEntries(folder) {
  if (!PROJECT_FOLDERS.includes(folder)) return [];
  return listProjectFiles(folder).filter((entry) => isAllowedFile(folder, entry.name));
}

function parseHexColorToRgba(hex) {
  if (typeof hex !== 'string') return null;
  const value = hex.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(value)) return null;
  const clean = value.startsWith('#') ? value.slice(1) : value;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
    a: 255
  };
}

function createArtPreviewDataUrl(data) {
  if (!data) return null;
  let tileData = data;
  if (!Array.isArray(data?.frames) && data?.tiles && typeof data.tiles === 'object') {
    const first = Object.values(data.tiles).find((entry) => entry);
    if (first) tileData = first;
  }
  const normalizeFramePixels = (frame) => {
    if (Array.isArray(frame) && frame.some((value) => typeof value === 'string')) return frame;
    if (Array.isArray(frame) && Array.isArray(frame[0]) && frame[0].some((value) => typeof value === 'string')) return frame[0];
    if (frame && typeof frame === 'object') {
      if (Array.isArray(frame.pixels) && frame.pixels.some((value) => typeof value === 'string')) return frame.pixels;
      if (Array.isArray(frame.data) && frame.data.some((value) => typeof value === 'string')) return frame.data;
    }
    return null;
  };
  const frame = Array.isArray(tileData?.frames) ? normalizeFramePixels(tileData.frames[0]) : null;
  if (!Array.isArray(frame) || !frame.length) return null;
  const parsedWidth = Number(tileData?.width);
  const parsedHeight = Number(tileData?.height);
  const size = Number.isFinite(tileData?.size) ? Number(tileData.size) : Math.round(Math.sqrt(frame.length));
  const width = Math.max(1, Number.isFinite(parsedWidth) && parsedWidth > 0 ? Math.round(parsedWidth) : (Number.isFinite(size) ? Math.round(size) : 1));
  const inferredHeight = Math.max(1, Math.round(frame.length / width));
  const height = Math.max(1, Number.isFinite(parsedHeight) && parsedHeight > 0 ? Math.round(parsedHeight) : inferredHeight);
  const MAX_PREVIEW_DIMENSION = 64;
  const scale = Math.max(1, Math.ceil(Math.max(width, height) / MAX_PREVIEW_DIMENSION));
  const previewWidth = Math.max(1, Math.floor(width / scale));
  const previewHeight = Math.max(1, Math.floor(height / scale));
  const canvas = document.createElement('canvas');
  canvas.width = previewWidth;
  canvas.height = previewHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imageData = ctx.createImageData(previewWidth, previewHeight);
  for (let py = 0; py < previewHeight; py += 1) {
    for (let px = 0; px < previewWidth; px += 1) {
      const sourceX = Math.min(width - 1, px * scale);
      const sourceY = Math.min(height - 1, py * scale);
      const sourceIndex = sourceY * width + sourceX;
      const rgba = parseHexColorToRgba(frame[sourceIndex]);
      const base = (py * previewWidth + px) * 4;
      if (!rgba) {
        imageData.data[base + 3] = 0;
        continue;
      }
      imageData.data[base] = rgba.r;
      imageData.data[base + 1] = rgba.g;
      imageData.data[base + 2] = rgba.b;
      imageData.data[base + 3] = rgba.a;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function getArtFrames(data) {
  if (!data) return { frames: [], source: null };
  if (Array.isArray(data?.frames) && data.frames.length) return { frames: data.frames, source: data };
  if (data?.tiles && typeof data.tiles === 'object') {
    const first = Object.values(data.tiles).find((entry) => Array.isArray(entry?.frames) && entry.frames.length);
    if (first) return { frames: first.frames, source: first };
  }
  return { frames: [], source: null };
}

function createArtAnimationPreviewUrls(data, maxFrames = 24) {
  const { frames: allFrames, source } = getArtFrames(data);
  let frames = allFrames;
  if (Number.isFinite(maxFrames) && maxFrames > 0 && allFrames.length > maxFrames) {
    const step = allFrames.length / maxFrames;
    frames = Array.from({ length: maxFrames }, (_, i) => allFrames[Math.floor(i * step)]).filter(Boolean);
  }
  if (!frames.length) return [];
  const firstFrame = frames[0];
  if (Array.isArray(firstFrame) && firstFrame.length > 4096) {
    const single = createArtPreviewDataUrl({ ...(source || data), frames: [firstFrame] });
    return single ? [single] : [];
  }
  return frames.map((frame) => createArtPreviewDataUrl({ ...(source || data), frames: [frame] })).filter(Boolean);
}

function createActorPreviewDataUrl(actorData) {
  const states = Array.isArray(actorData?.states) ? actorData.states : [];
  for (const state of states) {
    const artRef = String(state?.animation?.artRef || '').trim();
    if (!artRef) continue;
    const artPayload = loadProjectFile('art', artRef);
    const preview = createArtPreviewDataUrl(artPayload?.data || null);
    if (preview) return preview;
  }
  for (const state of states) {
    const frameUrl = state?.animation?.frames?.find?.((frame) => typeof frame?.imageDataUrl === 'string' && frame.imageDataUrl)?.imageDataUrl;
    if (frameUrl) return frameUrl;
    if (typeof state?.animation?.imageDataUrl === 'string' && state.animation.imageDataUrl) return state.animation.imageDataUrl;
  }
  return null;
}

export function openProjectBrowser({
  initialFolder = 'levels',
  mode = 'open',
  fixedFolder = null,
  title = 'Project Browser',
  initialName = '',
  onOpen = null,
  onNew = null,
  onImport = null,
  onExportZip = null,
  onCancel = null,
  onPick = null
} = {}) {
  activePreviewTrackId = null;
  ensureProjectFileIndex();
  const previousActive = document.activeElement;

  return new Promise((resolve) => {
    const availableFolders = readAvailableFolders(fixedFolder);
    const defaultFolder = availableFolders.includes(initialFolder) ? initialFolder : availableFolders[0] || 'levels';
    const state = {
      view: fixedFolder ? 'folder' : (mode === 'saveAs' ? 'folder' : (initialFolder ? 'folder' : 'home')),
      folder: fixedFolder || defaultFolder,
      searchOpen: false,
      query: '',
      loading: !availableFolders.some((folder) => listEntries(folder).length > 0),
      loadError: ''
    };
    if (!fixedFolder && mode === 'open') state.view = 'home';

    let pendingDelete = null;
    let renameTarget = null;
    const artPreviewCache = new Map();
    const actorPreviewCache = new Map();
    const previewTimers = new Set();

    const overlay = document.createElement('div');
    overlay.className = 'project-browser-overlay';
    overlay.style.pointerEvents = 'auto';
    overlay.tabIndex = -1;

    const panel = document.createElement('div');
    panel.className = 'project-browser-panel';
    overlay.appendChild(panel);

    const topBar = document.createElement('div');
    topBar.className = 'project-browser-topbar';
    panel.appendChild(topBar);

    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'project-browser-breadcrumb';
    topBar.appendChild(breadcrumb);

    const topBarActions = document.createElement('div');
    topBarActions.className = 'project-browser-topbar-actions';
    topBar.appendChild(topBarActions);

    const searchToggle = makeIconButton('⌕', 'Search', 'project-browser-icon-btn', () => {
      state.searchOpen = !state.searchOpen;
      if (!state.searchOpen) state.query = '';
      refresh();
      if (state.searchOpen) searchInput.focus();
    });
    topBarActions.appendChild(searchToggle);

    const close = makeIconButton('✕', 'Close', 'project-browser-close', () => cleanup(null));
    topBarActions.appendChild(close);

    const titleEl = document.createElement('h2');
    titleEl.className = 'project-browser-title';
    panel.appendChild(titleEl);

    const saveBox = document.createElement('div');
    saveBox.className = 'project-browser-savebox';
    if (mode !== 'saveAs') saveBox.style.display = 'none';
    panel.appendChild(saveBox);

    const searchWrap = document.createElement('div');
    searchWrap.className = 'project-browser-search-wrap';
    panel.appendChild(searchWrap);

    const searchInput = document.createElement('input');
    searchInput.className = 'project-browser-search';
    searchInput.placeholder = 'Search in folder...';
    searchWrap.appendChild(searchInput);

    const info = document.createElement('div');
    info.className = 'project-browser-info';
    panel.appendChild(info);

    const content = document.createElement('div');
    content.className = 'project-browser-content';
    panel.appendChild(content);

    const fileList = document.createElement('div');
    fileList.className = 'project-browser-file-list-scroll';
    content.appendChild(fileList);

    const footer = document.createElement('div');
    footer.className = 'project-browser-footer';
    panel.appendChild(footer);

    const saveInput = document.createElement('input');
    saveInput.className = 'project-browser-search';
    saveInput.placeholder = 'Filename';
    saveInput.value = sanitizeProjectFileName(initialName) || '';
    saveBox.appendChild(saveInput);

    const message = document.createElement('div');
    message.className = 'project-browser-message';
    saveBox.appendChild(message);

    const actionRow = document.createElement('div');
    actionRow.className = 'project-browser-actions';
    footer.appendChild(actionRow);

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';

    function cleanup(result) {
      previewTimers.forEach((timer) => clearInterval(timer));
      previewTimers.clear();
      overlay.remove();
      body.style.overflow = previousOverflow;
      body.style.touchAction = previousTouchAction;
      previousActive?.focus?.();
      if (!result) onCancel?.();
      resolve(result);
    }

    function renderBreadcrumb() {
      breadcrumb.innerHTML = '';
      const homeBtn = makeButton('Home', 'project-browser-crumb', () => {
        if (fixedFolder || mode === 'saveAs') return;
        state.view = 'home';
        state.query = '';
        state.searchOpen = false;
        refresh();
      });
      homeBtn.disabled = fixedFolder || mode === 'saveAs' || state.view === 'home';
      breadcrumb.appendChild(homeBtn);

      const current = document.createElement('span');
      current.className = 'project-browser-crumb-current';
      if (state.view === 'folder' && state.folder) {
        current.textContent = `/ ${FOLDER_LABELS[state.folder] || state.folder}`;
      } else {
        current.textContent = '';
      }
      breadcrumb.appendChild(current);
    }

    function openFile(folder, name) {
      if (!PROJECT_FOLDERS.includes(folder)) return;
      const payload = loadProjectFile(folder, name);
      onOpen?.({ folder, name, payload });
      onPick?.({ action: 'open', folder, name, payload });
      cleanup({ action: 'open', folder, name, payload });
    }

    function renderHome() {
      fileList.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'project-browser-folder-grid';
      availableFolders.forEach((folder) => {
        const card = makeButton(FOLDER_LABELS[folder] || folder, 'project-browser-folder-card', () => {
          state.view = 'folder';
          state.folder = folder;
          state.query = '';
          refresh();
        });
        grid.appendChild(card);
      });
      fileList.appendChild(grid);
      info.textContent = 'Choose a folder';
    }

    function renderFolder() {
      const folder = state.folder;
      const query = state.query.trim().toLowerCase();
      const entries = listEntries(folder).filter((entry) => !query || entry.name.toLowerCase().includes(query));
      info.textContent = state.loading
        ? `Loading ${FOLDER_LABELS[folder] || folder} from server...`
        : `${entries.length} file${entries.length === 1 ? '' : 's'} in ${FOLDER_LABELS[folder] || folder}`;
      fileList.innerHTML = '';
      if (state.loading) {
        const row = document.createElement('div');
        row.className = 'project-browser-empty';
        row.textContent = 'Loading files from server...';
        fileList.appendChild(row);
        return;
      }
      if (state.loadError && !entries.length) {
        const row = document.createElement('div');
        row.className = 'project-browser-empty';
        row.textContent = `Could not load server files: ${state.loadError}`;
        fileList.appendChild(row);
        return;
      }

      entries.forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'project-browser-row';

        if (folder === 'art' || folder === 'actors') {
          const preview = document.createElement('div');
          preview.className = 'project-browser-art-preview';
          let previewUrls = [];
          if (folder === 'art') {
            const cached = artPreviewCache.get(entry.name);
            if (Array.isArray(cached) && cached.length) previewUrls = cached;
            if (!previewUrls.length) {
              const payload = loadProjectFile(folder, entry.name);
              previewUrls = createArtAnimationPreviewUrls(payload?.data);
              if (previewUrls.length) artPreviewCache.set(entry.name, previewUrls);
            }
          } else {
            const cached = actorPreviewCache.get(entry.name);
            if (cached) previewUrls = [cached];
            if (!previewUrls.length) {
              const payload = loadProjectFile(folder, entry.name);
              const actorPreview = createActorPreviewDataUrl(payload?.data);
              if (actorPreview) {
                actorPreviewCache.set(entry.name, actorPreview);
                previewUrls = [actorPreview];
              }
            }
          }
          if (previewUrls.length) {
            const img = document.createElement('img');
            img.className = 'project-browser-art-preview-image';
            img.src = previewUrls[0];
            img.alt = `${entry.name} preview`;
            preview.appendChild(img);
            if (previewUrls.length > 1) {
              let frameIndex = 0;
              const timer = setInterval(() => {
                frameIndex = (frameIndex + 1) % previewUrls.length;
                img.src = previewUrls[frameIndex];
              }, 180);
              previewTimers.add(timer);
            }
          } else {
            preview.textContent = '∅';
          }
          row.appendChild(preview);
        }

        const meta = document.createElement('div');
        meta.className = 'project-browser-meta';
        const nameRow = document.createElement('div');
        nameRow.className = 'project-browser-name-row';
        const typeBadge = document.createElement('span');
        typeBadge.className = 'project-browser-type-badge';
        typeBadge.textContent = fileTypeBadge(entry.name);
        nameRow.innerHTML = `<strong>📄 ${entry.name}</strong>`;
        nameRow.appendChild(typeBadge);
        const detail = document.createElement('span');
        detail.textContent = `Updated ${formatDate(entry.updatedAt)} · ${formatSize(entry.size)}`;
        meta.appendChild(nameRow);
        meta.appendChild(detail);
        row.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'project-browser-row-actions';

        if (mode === 'saveAs') {
          actions.appendChild(makeButton('Overwrite', 'project-browser-btn primary', () => {
            onPick?.({ action: 'saveAs', folder, name: entry.name, overwrite: true });
            cleanup({ action: 'saveAs', folder, name: entry.name, overwrite: true });
          }));
        } else {
          const openBtn = makeButton('Open', 'project-browser-btn primary', () => openFile(folder, entry.name));
          openBtn.disabled = !PROJECT_FOLDERS.includes(folder);
          actions.appendChild(openBtn);
          if (folder === 'music') {
            const toggleBtn = makeButton(activePreviewTrackId === entry.name ? 'Pause' : 'Play', 'project-browser-btn', () => {
              const game = window.__game;
              if (activePreviewTrackId === entry.name) {
                game?.stopProjectBrowserMusicPreview?.();
                activePreviewTrackId = null;
              } else {
                const payload = loadProjectFile('music', entry.name);
                game?.playProjectBrowserMusicPreview?.(entry.name, payload?.data || null);
                activePreviewTrackId = entry.name;
              }
              refresh();
            });
            actions.appendChild(toggleBtn);
          }

          actions.appendChild(makeButton('Rename', 'project-browser-btn', () => {
            if (!PROJECT_FOLDERS.includes(folder)) return;
            renameTarget = entry.name;
            pendingDelete = null;
            refresh();
          }));
          actions.appendChild(makeButton('Duplicate', 'project-browser-btn', () => {
            if (!PROJECT_FOLDERS.includes(folder)) return;
            const candidate = sanitizeProjectFileName(`${entry.name} Copy`);
            if (!candidate || projectFileExists(folder, candidate)) return;
            duplicateProjectFile(folder, entry.name, candidate);
            refresh();
          }));
          actions.appendChild(makeButton('Delete', 'project-browser-btn danger', () => {
            if (!PROJECT_FOLDERS.includes(folder)) return;
            pendingDelete = entry.name;
            renameTarget = null;
            refresh();
          }));
        }
        row.appendChild(actions);

        if (mode !== 'saveAs' && renameTarget === entry.name) {
          const renameRow = document.createElement('div');
          renameRow.className = 'project-browser-inline';
          const input = document.createElement('input');
          input.className = 'project-browser-search';
          input.value = entry.name;
          renameRow.appendChild(input);
          renameRow.appendChild(makeButton('Apply', 'project-browser-btn', () => {
            const next = sanitizeProjectFileName(input.value);
            if (!next || projectFileExists(folder, next)) return;
            renameProjectFile(folder, entry.name, next);
            renameTarget = null;
            refresh();
          }));
          renameRow.appendChild(makeButton('Cancel', 'project-browser-btn', () => {
            renameTarget = null;
            refresh();
          }));
          row.appendChild(renameRow);
        }

        if (mode !== 'saveAs' && pendingDelete === entry.name) {
          const delRow = document.createElement('div');
          delRow.className = 'project-browser-inline';
          delRow.appendChild(makeButton('Confirm Delete', 'project-browser-btn danger', () => {
            deleteProjectFile(folder, entry.name);
            pendingDelete = null;
            refresh();
          }));
          delRow.appendChild(makeButton('Cancel', 'project-browser-btn', () => {
            pendingDelete = null;
            refresh();
          }));
          row.appendChild(delRow);
        }

        fileList.appendChild(row);
      });
    }

    function refresh() {
      const folderLabel = FOLDER_LABELS[state.folder] || state.folder;
      titleEl.textContent = mode === 'saveAs' ? `Save ${folderLabel} as...` : title;
      renderBreadcrumb();
      searchWrap.classList.toggle('is-open', state.searchOpen && state.view === 'folder');
      searchToggle.classList.toggle('is-active', state.searchOpen && state.view === 'folder');
      if (!(state.searchOpen && state.view === 'folder')) searchInput.value = '';

      if (state.view === 'home') {
        renderHome();
      } else {
        renderFolder();
      }

      actionRow.innerHTML = '';
      if (mode === 'saveAs' && state.view === 'folder') {
        actionRow.appendChild(makeButton('Save', 'project-browser-btn primary', () => {
          const name = sanitizeProjectFileName(saveInput.value) || sanitizeProjectFileName(initialName) || 'untitled';
          onPick?.({ action: 'saveAs', folder: state.folder, name, overwrite: projectFileExists(state.folder, name) });
          cleanup({ action: 'saveAs', folder: state.folder, name, overwrite: projectFileExists(state.folder, name) });
        }));
      }
      if (mode !== 'saveAs' && state.view === 'folder') {
        actionRow.appendChild(makeButton('New', 'project-browser-btn', () => {
          onNew?.(state.folder);
          cleanup({ action: 'new', folder: state.folder });
        }));
        actionRow.appendChild(makeButton('Import', 'project-browser-btn', () => onImport?.(state.folder)));
        actionRow.appendChild(makeButton('Export ZIP', 'project-browser-btn', () => onExportZip?.(state.folder)));
      }
      actionRow.appendChild(makeButton('Close', 'project-browser-btn', () => cleanup(null)));

      if (mode === 'saveAs') message.textContent = '';
    }

    searchInput.addEventListener('input', () => {
      state.query = searchInput.value.trim().toLowerCase();
      refresh();
    });

    saveInput.addEventListener('input', () => {
      const saveName = sanitizeProjectFileName(saveInput.value);
      const exists = saveName && projectFileExists(state.folder, saveName);
      message.textContent = exists ? 'Name already exists. Use Overwrite on that file row, or choose a different name.' : '';
    });

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) cleanup(null);
    });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup(null);
      }
      if (mode === 'saveAs' && event.key === 'Enter') {
        event.preventDefault();
        const name = sanitizeProjectFileName(saveInput.value) || sanitizeProjectFileName(initialName) || 'untitled';
        cleanup({ action: 'saveAs', folder: state.folder, name, overwrite: projectFileExists(state.folder, name) });
      }
    });

    getOverlayRoot().appendChild(overlay);
    refresh();
    void hydrateServerStorage().then((result) => {
      state.loading = false;
      state.loadError = result?.ok ? '' : (result?.reason || 'unknown error');
      refresh();
    }).catch((error) => {
      state.loading = false;
      state.loadError = String(error || 'unknown error');
      refresh();
    });
    overlay.focus({ preventScroll: true });
    if (mode === 'saveAs') {
      saveInput.focus({ preventScroll: true });
    }
  });
}
