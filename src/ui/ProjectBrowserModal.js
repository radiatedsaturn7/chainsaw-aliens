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

const FOLDER_LABELS = { levels: 'Levels', art: 'Art', music: 'Music' };

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function makeButton(label, className, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

export function openProjectBrowser({
  initialFolder = 'levels',
  mode = 'open',
  fixedFolder = null,
  title = 'Project Browser',
  onOpen = null,
  onNew = null,
  onImport = null,
  onExportZip = null
} = {}) {
  vfsEnsureIndex();
  const previousActive = document.activeElement;

  return new Promise((resolve) => {
    let folder = VFS_FOLDERS.includes(initialFolder) ? initialFolder : 'levels';
    if (fixedFolder && VFS_FOLDERS.includes(fixedFolder)) folder = fixedFolder;
    let filter = '';
    let saveName = '';
    let overwrite = false;
    let pendingDelete = null;
    let renameTarget = null;

    const overlay = document.createElement('div');
    overlay.className = 'project-browser-overlay';
    overlay.tabIndex = -1;

    const panel = document.createElement('div');
    panel.className = 'project-browser-panel';
    overlay.appendChild(panel);

    const header = document.createElement('div');
    header.className = 'project-browser-header';
    panel.appendChild(header);

    const titleEl = document.createElement('h2');
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const close = makeButton('✕', 'project-browser-close', () => cleanup(null));
    header.appendChild(close);

    const tabs = document.createElement('div');
    tabs.className = 'project-browser-tabs';
    panel.appendChild(tabs);

    const search = document.createElement('input');
    search.className = 'project-browser-search';
    search.placeholder = 'Search files...';
    panel.appendChild(search);

    const info = document.createElement('div');
    info.className = 'project-browser-info';
    panel.appendChild(info);

    const list = document.createElement('div');
    list.className = 'project-browser-list';
    panel.appendChild(list);

    const footer = document.createElement('div');
    footer.className = 'project-browser-footer';
    panel.appendChild(footer);

    const saveBox = document.createElement('div');
    saveBox.className = 'project-browser-savebox';
    if (mode !== 'saveAs') saveBox.style.display = 'none';
    footer.appendChild(saveBox);

    const saveInput = document.createElement('input');
    saveInput.className = 'project-browser-search';
    saveInput.placeholder = 'Filename';
    saveBox.appendChild(saveInput);

    const overwriteWrap = document.createElement('label');
    overwriteWrap.className = 'project-browser-overwrite';
    const overwriteInput = document.createElement('input');
    overwriteInput.type = 'checkbox';
    overwriteInput.addEventListener('change', () => {
      overwrite = overwriteInput.checked;
    });
    overwriteWrap.append(overwriteInput, document.createTextNode(' Allow overwrite if file exists'));
    saveBox.appendChild(overwriteWrap);

    const message = document.createElement('div');
    message.className = 'project-browser-message';
    saveBox.appendChild(message);

    const actionRow = document.createElement('div');
    actionRow.className = 'project-browser-actions';
    footer.appendChild(actionRow);

    function cleanup(result) {
      overlay.remove();
      previousActive?.focus?.();
      resolve(result);
    }

    function refresh() {
      tabs.innerHTML = '';
      const canSwitchFolder = !fixedFolder;
      VFS_FOLDERS.forEach((entry) => {
        const tab = makeButton(FOLDER_LABELS[entry], `project-browser-tab ${folder === entry ? 'is-active' : ''}`, () => {
          if (!canSwitchFolder) return;
          folder = entry;
          renameTarget = null;
          pendingDelete = null;
          refresh();
        });
        tab.disabled = !canSwitchFolder;
        tabs.appendChild(tab);
      });

      const entries = vfsList(folder).filter((entry) => !filter || entry.name.toLowerCase().includes(filter));
      info.textContent = `${entries.length} file${entries.length === 1 ? '' : 's'} in ${FOLDER_LABELS[folder]}`;
      list.innerHTML = '';

      entries.forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'project-browser-row';

        const meta = document.createElement('div');
        meta.className = 'project-browser-meta';
        meta.innerHTML = `<strong>${entry.name}</strong><span>${formatDate(entry.updatedAt)} • ${entry.size} chars</span>`;
        row.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'project-browser-row-actions';

        actions.appendChild(makeButton('Open', 'project-browser-btn', () => {
          const payload = vfsLoad(folder, entry.name);
          onOpen?.({ folder, name: entry.name, payload });
          cleanup({ action: 'open', folder, name: entry.name, payload });
        }));

        actions.appendChild(makeButton('Rename', 'project-browser-btn', () => {
          renameTarget = entry.name;
          pendingDelete = null;
          refresh();
        }));
        actions.appendChild(makeButton('Delete', 'project-browser-btn danger', () => {
          pendingDelete = entry.name;
          renameTarget = null;
          refresh();
        }));
        actions.appendChild(makeButton('Duplicate', 'project-browser-btn', () => {
          const candidate = vfsSanitizeName(`${entry.name} Copy`);
          if (!candidate || vfsExists(folder, candidate)) return;
          vfsDuplicate(folder, entry.name, candidate);
          refresh();
        }));
        row.appendChild(actions);

        if (renameTarget === entry.name) {
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

        if (pendingDelete === entry.name) {
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

        list.appendChild(row);
      });

      actionRow.innerHTML = '';
      if (mode === 'saveAs') {
        actionRow.appendChild(makeButton('Save', 'project-browser-btn primary', () => {
          const name = vfsSanitizeName(saveInput.value);
          if (!name) return;
          if (vfsExists(folder, name) && !overwrite) {
            message.textContent = 'Name already exists. Enable overwrite to continue.';
            return;
          }
          cleanup({ action: 'saveAs', folder, name, overwrite: vfsExists(folder, name) });
        }));
      }
      if (mode !== 'saveAs') {
        actionRow.appendChild(makeButton('New', 'project-browser-btn', () => {
          onNew?.(folder);
          cleanup({ action: 'new', folder });
        }));
      }
      actionRow.appendChild(makeButton('Import', 'project-browser-btn', () => onImport?.(folder)));
      actionRow.appendChild(makeButton('Export ZIP', 'project-browser-btn', () => onExportZip?.(folder)));
      actionRow.appendChild(makeButton('Close', 'project-browser-btn', () => cleanup(null)));

      if (mode === 'saveAs') {
        message.textContent = '';
      }
    }

    search.addEventListener('input', () => {
      filter = search.value.trim().toLowerCase();
      refresh();
    });

    saveInput.addEventListener('input', () => {
      saveName = vfsSanitizeName(saveInput.value);
      const exists = saveName && vfsExists(folder, saveName);
      message.textContent = exists && !overwrite ? 'Name already exists. Enable overwrite or choose a new name.' : '';
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
        if (vfsExists(folder, name) && !overwrite) return;
        cleanup({ action: 'saveAs', folder, name, overwrite: vfsExists(folder, name) });
      }
    });

    document.body.appendChild(overlay);
    refresh();
    if (mode === 'saveAs') {
      saveInput.focus();
    } else {
      search.focus();
    }
  });
}
