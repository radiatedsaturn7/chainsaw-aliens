import {
  VFS_FOLDERS,
  vfsDelete,
  vfsDuplicate,
  vfsEnsureIndex,
  vfsExists,
  vfsList,
  vfsLoad,
  vfsRename,
  vfsSanitizeName
} from './vfs.js';
import { fileTypeBadge } from './uiSuite.js';

const FOLDER_LABELS = { levels: 'Levels', art: 'Art', music: 'Music' };
const DEFAULT_FOLDERS = ['levels', 'art', 'music'];

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
    document.body.appendChild(root);
  }
  return root;
}

function isAllowedFile(folder, name) {
  const value = String(name || '').toLowerCase();
  if (!value) return false;
  if (folder === 'levels') return value.endsWith('.json') || !value.includes('.');
  if (folder === 'music') return value.endsWith('.json') || value.endsWith('.mid') || !value.includes('.');
  return true;
}

function readAvailableFolders(fixedFolder) {
  if (fixedFolder && DEFAULT_FOLDERS.includes(fixedFolder)) return [fixedFolder];
  const ordered = [...DEFAULT_FOLDERS];
  const storage = window.localStorage;
  try {
    const index = JSON.parse(storage.getItem('robter:vfs:index') || 'null');
    const extras = Object.keys(index || {}).filter((folder) => !ordered.includes(folder));
    return [...ordered, ...extras];
  } catch (error) {
    return ordered;
  }
}

function listEntries(folder) {
  if (VFS_FOLDERS.includes(folder)) {
    return vfsList(folder).filter((entry) => isAllowedFile(folder, entry.name));
  }
  try {
    const index = JSON.parse(window.localStorage.getItem('robter:vfs:index') || 'null');
    const entries = Object.entries(index?.[folder] || {}).map(([name, meta]) => ({
      name,
      updatedAt: Number(meta?.updatedAt || 0),
      size: Number(meta?.size || 0)
    }));
    return entries.sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
  } catch (error) {
    return [];
  }
}

export function openProjectBrowser({
  initialFolder = 'levels',
  mode = 'open',
  fixedFolder = null,
  title = 'Project Browser',
  onOpen = null,
  onNew = null,
  onImport = null,
  onExportZip = null,
  onCancel = null,
  onPick = null
} = {}) {
  vfsEnsureIndex();
  const previousActive = document.activeElement;

  return new Promise((resolve) => {
    const availableFolders = readAvailableFolders(fixedFolder);
    const defaultFolder = availableFolders.includes(initialFolder) ? initialFolder : availableFolders[0] || 'levels';
    const state = {
      view: fixedFolder ? 'folder' : (mode === 'saveAs' ? 'folder' : (initialFolder ? 'folder' : 'home')),
      folder: fixedFolder || defaultFolder,
      searchOpen: false,
      query: ''
    };
    if (!fixedFolder && mode === 'open') state.view = 'home';

    let pendingDelete = null;
    let renameTarget = null;

    const overlay = document.createElement('div');
    overlay.className = 'project-browser-overlay';
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
      if (!VFS_FOLDERS.includes(folder)) return;
      const payload = vfsLoad(folder, name);
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
      info.textContent = `${entries.length} file${entries.length === 1 ? '' : 's'} in ${FOLDER_LABELS[folder] || folder}`;
      fileList.innerHTML = '';

      entries.forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'project-browser-row';

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
          openBtn.disabled = !VFS_FOLDERS.includes(folder);
          actions.appendChild(openBtn);

          actions.appendChild(makeButton('Rename', 'project-browser-btn', () => {
            if (!VFS_FOLDERS.includes(folder)) return;
            renameTarget = entry.name;
            pendingDelete = null;
            refresh();
          }));
          actions.appendChild(makeButton('Duplicate', 'project-browser-btn', () => {
            if (!VFS_FOLDERS.includes(folder)) return;
            const candidate = vfsSanitizeName(`${entry.name} Copy`);
            if (!candidate || vfsExists(folder, candidate)) return;
            vfsDuplicate(folder, entry.name, candidate);
            refresh();
          }));
          actions.appendChild(makeButton('Delete', 'project-browser-btn danger', () => {
            if (!VFS_FOLDERS.includes(folder)) return;
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
            const next = vfsSanitizeName(input.value);
            if (!next || vfsExists(folder, next)) return;
            vfsRename(folder, entry.name, next);
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
            vfsDelete(folder, entry.name);
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
          const name = vfsSanitizeName(saveInput.value);
          if (!name) return;
          onPick?.({ action: 'saveAs', folder: state.folder, name, overwrite: vfsExists(state.folder, name) });
          cleanup({ action: 'saveAs', folder: state.folder, name, overwrite: vfsExists(state.folder, name) });
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
      const saveName = vfsSanitizeName(saveInput.value);
      const exists = saveName && vfsExists(state.folder, saveName);
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
        const name = vfsSanitizeName(saveInput.value);
        if (!name) return;
        cleanup({ action: 'saveAs', folder: state.folder, name, overwrite: vfsExists(state.folder, name) });
      }
    });

    getOverlayRoot().appendChild(overlay);
    refresh();
    overlay.focus({ preventScroll: true });
    if (mode === 'saveAs') {
      saveInput.focus({ preventScroll: true });
    }
  });
}
