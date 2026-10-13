function artDialog(title, build, onClose = () => {}) {
  if (typeof document === 'undefined') { onClose(); return; }
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', title);
  dialog.style.cssText = 'box-sizing:border-box;width:min(420px,94vw);max-height:90dvh;overflow:auto;padding:20px;border:1px solid #53605b;border-radius:12px;background:var(--editor-surface,#19241f);color:var(--editor-text,#eef4ed);font:16px system-ui';
  const el = (tag, text, parent = dialog) => { const node = document.createElement(tag); node.textContent = text; parent.appendChild(node); return node; };
  el('h2', title);
  let closed = false;
  const close = () => { if (closed) return; closed = true; dialog.close(); dialog.remove(); previousFocus?.focus?.(); onClose(); };
  const checkbox = (label, checked) => {
    const row = el('label', ''); row.style.cssText = 'display:flex;align-items:center;gap:12px;min-height:44px';
    const input = el('input', '', row); input.type = 'checkbox'; input.checked = checked;
    el('span', label, row); return input;
  };
  const button = (label, action) => { const node = el('button', label); node.type = 'button'; node.style.cssText = 'min-height:44px;margin:12px 8px 0 0;padding:8px 16px'; node.onclick = action; };
  build({ el, checkbox, button, close });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', close);
  for (const event of ['keydown','keyup']) dialog.addEventListener(event, e => e.stopPropagation());
  document.body.appendChild(dialog); dialog.showModal();
}

export function openCarArtSettings(art) {
  artDialog('Art Settings', ({ el, checkbox, button, close }) => {
    const mirror = checkbox('Mirror', art.mirrorAngleEdits !== false);
    el('p', 'Link size and Y position, and reverse X position and rotation, between paired angles. Each angle keeps its own picture.');
    mirror.onchange = () => { art.mirrorAngleEdits = mirror.checked; };
    button('Done', close);
  });
}

export function openCarArtReset(component, onReset) {
  artDialog('Reset Art Adjustments', ({ el, checkbox, button, close }) => {
    el('p', `Choose what to reset for ${component} at the selected angle. Linked adjustments also reset when Mirror is on.`);
    const choices = { position: checkbox('Position', true) };
    if (component === 'body') choices.rotation = checkbox('Rotation', true);
    choices.scale = checkbox('Scale', true);
    choices.graphic = checkbox('Graphic (restore default)', false);
    button('Cancel', close);
    button('Reset Selected', () => { onReset(Object.fromEntries(Object.entries(choices).map(([key,input]) => [key,input.checked]))); close(); });
  });
}

export function chooseCarArtUse(name, frameCount = 1, component = 'body') {
  return new Promise(resolve => {
    let selected = false;
    artDialog('Use Car Artwork', ({ el, button, close }) => {
      el('p', name);
      const label = el('label', 'Source frame');
      const frame = el('select', '', label);
      frame.setAttribute('aria-label', 'Source frame');
      frame.style.cssText='display:block;min-height:44px;max-width:100%';
      for(let i=0;i<frameCount;i++) { const option=el('option',`Frame ${i+1}`,frame); option.value=i; }
      el('p', 'Single frame assigns this picture to the current angle. Sprite sheet opens the importer to split this picture into multiple views or tire surfaces.');
      const choose = mode => { selected=true; resolve({ mode, frameIndex:Number(frame.value) }); close(); };
      button('Single Frame',()=>choose('single'));
      button('Sprite Sheet',()=>choose('sheet'));
      if(frameCount === 8 || (component === 'tires' && [2,4].includes(frameCount))) button('Use Existing Frames',()=>choose('frames'));
      button('Cancel',close);
    },()=>{if(!selected)resolve(null);});
  });
}
