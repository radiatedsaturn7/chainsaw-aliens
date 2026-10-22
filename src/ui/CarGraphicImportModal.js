import { hasBakedLightBackground, removeCarSheetLightBackground } from '../racing/CarSheetBackground.js';
import { fitTireTextureRegions, normalizeTireSheetOpacity } from '../racing/CarTireTextureFit.js';
import { drawWheelCylinder } from '../racing/CarWheelCylinder.js';
import { carSheetDimensions, carSheetDocument, prepareCarSheet } from '../racing/CarGraphicImport.js';
import { CAR_VIEW_LABELS } from '../racing/CarDirectionalArt.js';
import { RACE_CAR_SHELL_FRAME_SLOTS as slots } from '../racing/raceData.js';

export function openCarGraphicImport(component = 'body', initial = null) {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'car-graphic-import';
    dialog.setAttribute('aria-label', `Import ${component} graphic`);
    const el = (tag, text = '', parent = dialog) => {
      const node = document.createElement(tag); node.textContent = text; parent.appendChild(node); return node;
    };
    el('style', `
      .car-graphic-import { box-sizing:border-box; width:min(680px,96vw); max-height:94dvh; overflow:auto; padding:16px; border:1px solid #53605b; border-radius:12px; background:var(--editor-surface,#19241f); color:var(--editor-text,#eef4ed); font:14px system-ui; }
      .car-graphic-import::backdrop { background:#000b; }
      .car-graphic-import h2 { margin:0 0 8px; }
      .car-graphic-import .row { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0; }
      .car-graphic-import .assignments { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
      .car-graphic-import label { display:flex; flex-direction:column; gap:4px; min-width:0; }
      .car-graphic-import button,.car-graphic-import select { min-height:44px; padding:8px; font:inherit; color:inherit; background:var(--editor-surface-alt,#293930); border:1px solid #53605b; border-radius:8px; max-width:100%; }
      .car-graphic-import button:disabled { opacity:.45; }
      .car-graphic-import canvas { display:block; width:100%; image-rendering:pixelated; background:repeating-conic-gradient(#34433b 0% 25%,#24332b 0% 50%) 0/16px 16px; }
      .car-graphic-import .previews { display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:center; }
      .car-graphic-import [hidden] { display:none!important; }
    `);
    const heading = el('h2', `Import ${component[0].toUpperCase() + component.slice(1)} Graphic`);
    const componentLabel = el('label', 'Component');
    const componentSelect = el('select', '', componentLabel);
    componentSelect.setAttribute('aria-label', 'Component');
    for (const value of initial?.components || ['body', 'tires', 'brakes', 'shadow']) {
      const option = el('option', value[0].toUpperCase() + value.slice(1), componentSelect); option.value = value;
    }
    componentSelect.value = component;
    componentSelect.disabled = Boolean(initial?.lockComponent);
    componentSelect.onchange = () => {
      component = componentSelect.value;
      heading.textContent = `Import ${component[0].toUpperCase() + component.slice(1)} Graphic`;
      dialog.setAttribute('aria-label', `Import ${component} graphic`);
      updateImportMode();
      if (source) processSource();
    };

    const instructions = el('p', 'Choose a sheet with 2 rows and 4 columns. Use a transparent background with gaps between cars. Sprites are cropped and centered without resizing. Frames read left to right: 0°, 45°, 90°, 135° / 180°, 225°, 270°, 315°.');
    const tireOptions = el('div');
    const layoutLabel = el('label', 'Tire sheet layout (columns × rows)', tireOptions);
    const layout = el('select', '', layoutLabel);
    layout.setAttribute('aria-label', 'Tire sheet layout (columns × rows)');
    for (const value of ['2x1','1x2','2x2','4x2']) { const option = el('option', value.replace('x',' × '), layout); option.value = value; }
    layout.value = initial?.layout || '4x2';
    const roleSelect = label => { const row = el('label', label, tireOptions); const select = el('select', '', row); select.setAttribute('aria-label', label); return select; };
    const treadSelect = roleSelect('Tread frame');
    const wheelSelect = roleSelect('Wheel / rim frame');
    function resetTireRoles() {
      const count = layout.value.split('x').map(Number).reduce((a,b)=>a*b,1);
      for (const select of [treadSelect,wheelSelect]) {
        select.replaceChildren();
        for(let i=0;i<count;i++) { const option=el('option', `Frame ${i+1}`, select); option.value=i; }
      }
      treadSelect.value='0'; wheelSelect.value=count===8?'2':'1';
    }
    resetTireRoles();
    layout.onchange = () => { resetTireRoles(); processSource(); };
    treadSelect.onchange = wheelSelect.onchange = () => processSource();
    const input = el('input'); input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
    const button = (text, fn, parent = dialog) => { const b = el('button', text, parent); b.type = 'button'; b.onclick = fn; return b; };
    const choose = button('Choose Image', () => input.click());
    const backgroundLabel = el('label', 'Remove light/checkerboard background');
    const removeBackground = el('input', '', backgroundLabel); removeBackground.type = 'checkbox';
    const backgroundHelp = el('p', 'Only light neutral pixels connected to the image border are removed. Turn this off to keep the original background.');
    removeBackground.onchange = () => processSource();
    const cleanupLabel = el('label', 'Background cleanup');
    const cleanup = el('select', '', cleanupLabel);
    cleanup.setAttribute('aria-label', 'Background cleanup');
    for (const value of [0, 4, 8, 16, 24, 32]) {
      const option = el('option', value ? `Remove alpha ≤ ${value}/255` : 'Off — exact transparency', cleanup); option.value = value;
    }
    cleanup.value = '8';
    el('p', 'Removes nearly invisible background pixels that can block separation. Lower this to retain very faint details.');
    const previews = el('div'); previews.className = 'previews';
    const sheet = el('canvas', '', previews); sheet.width = 320; sheet.height = 160;
    sheet.setAttribute('aria-label', 'Source sheet with numbered frames');
    const preview = el('canvas', '', previews); preview.width = preview.height = 240;
    preview.setAttribute('aria-label', 'Rotating car preview');
    const angle = el('p');
    const controls = el('div'); controls.className = 'row';
    let source = null, prepared = null, tireFit = null, frameCanvases = [], mapping = slots.map((_, i) => i), current = 0, playing = true, closed = false, generation = 0, filename = '';
    button('← 45°', () => { playing = false; current = (current + 7) % 8; paint(); }, controls);
    const play = button('Pause', () => { playing = !playing; paint(); }, controls);
    button('45° →', () => { playing = false; current = (current + 1) % 8; paint(); }, controls);
    const assignmentHelp = el('p', 'Choose the source frame for each angle. Changing an assignment swaps the two frames.');
    const assignments = el('div'); assignments.className = 'assignments';
    const selects = slots.map((slot, i) => {
      const label = el('label', `${i * 45}° · ${CAR_VIEW_LABELS[slot]}`, assignments);
      const select = el('select', '', label); select.disabled = true;
      select.setAttribute('aria-label', `${i * 45}° · ${CAR_VIEW_LABELS[slot]}`);
      slots.forEach((_, n) => { const option = el('option', `Frame ${n + 1} · row ${Math.floor(n / 4) + 1}, col ${n % 4 + 1}`, select); option.value = n; });
      select.value = i;
      select.onchange = () => {
        const other = mapping.indexOf(Number(select.value));
        [mapping[i], mapping[other]] = [mapping[other], mapping[i]];
        current = i; playing = false; paint();
      };
      return select;
    });
    const resetAssignments = button('Reset Assignments', () => { mapping = slots.map((_, i) => i); paint(); });
    const status = el('p', 'Choose an image to begin.'); status.setAttribute('role', 'status');
    const footer = el('div'); footer.className = 'row';
    button('Cancel', () => finish(null), footer);
    const apply = button('Import Graphic', () => {
      try { finish({ component, tireFrames: { treadFrame:Number(treadSelect.value), wheelFrame:Number(wheelSelect.value) }, document: carSheetDocument(null, prepared), mapping: [...mapping], name: filename }); }
      catch (error) { status.textContent = error.message; }
    }, footer); apply.disabled = true;
    function paint() {
      play.textContent = playing ? 'Pause' : 'Play';
      angle.textContent = `${current * 45}° · ${CAR_VIEW_LABELS[slots[current]]} · Frame ${mapping[current] + 1}`;
      selects.forEach((select, i) => { select.value = mapping[i]; });
      const ctx = preview.getContext('2d'); ctx.clearRect(0, 0, 240, 240);
      if (!prepared) return;
      if (component === 'tires') {
        angle.textContent = `${current * 45}° · ${CAR_VIEW_LABELS[slots[current]]} · Textured wheel`;
        if (!tireFit) return;
        ctx.save(); ctx.translate(120,120);
        drawWheelCylinder(ctx, { tread:frameCanvases[Number(treadSelect.value)], wheel:frameCanvases[Number(wheelSelect.value)],
          treadBounds:tireFit.tread.bounds, wheelBounds:tireFit.wheel.bounds,
          width:60,height:170,bearing:current*Math.PI/4,spin:wheelSpin });
        ctx.restore(); return;
      }
      const w = prepared.width, h = prepared.height, frame = mapping[current];
      const scale = Math.min(220 / w, 220 / h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(frameCanvases[frame], 0, 0, w, h, (240 - w * scale) / 2, (240 - h * scale) / 2, w * scale, h * scale);
    }
    input.onchange = async () => {
      const file = input.files[0]; input.value = ''; if (!file) return;
      const token = ++generation; source = null; prepared = null; tireFit = null; frameCanvases = []; apply.disabled = true; selects.forEach(s => { s.disabled = true; }); paint();
      sheet.getContext('2d').clearRect(0, 0, sheet.width, sheet.height);
      status.textContent = 'Opening image…';
      const url = URL.createObjectURL(file);
      try {
        const image = new Image(); image.src = url; await image.decode();
        if (closed || token !== generation) return;
        carSheetDimensions(image.naturalWidth, image.naturalHeight);
        source = document.createElement('canvas'); source.width = image.naturalWidth; source.height = image.naturalHeight;
        source.getContext('2d').drawImage(image, 0, 0);
        detectBackground();
        filename = file.name.replace(/\.[^.]+$/, '') || 'Car Graphic';
        mapping = slots.map((_, i) => i); current = 0; playing = true;
        processSource();
      } catch (error) { if (!closed && token === generation) status.textContent = error.message || 'Could not open this image.'; }
      finally { URL.revokeObjectURL(url); }
    };
    function processSource() {
      prepared = null; tireFit = null; frameCanvases = []; apply.disabled = true;
      selects.forEach(s => { s.disabled = true; });
      if (!source) return;
      sheet.height = Math.max(1, Math.round(320 * source.height / source.width));
      sheet.getContext('2d').drawImage(source, 0, 0, sheet.width, sheet.height);
      try {
        const raw = source.getContext('2d').getImageData(0, 0, source.width, source.height);
        const backgroundCleaned = removeBackground.checked ? removeCarSheetLightBackground(raw) : raw;
        const cleaned = component === 'tires' ? normalizeTireSheetOpacity(backgroundCleaned) : backgroundCleaned;
        prepared = prepareCarSheet(cleaned, { alphaThreshold: Number(cleanup.value), ...(component === 'tires' ? { columns:Number(layout.value.split('x')[0]), rows:Number(layout.value.split('x')[1]) } : {}) });
        if (component === 'tires') tireFit = fitTireTextureRegions(prepared.frames, prepared.width, prepared.height, { treadFrame:Number(treadSelect.value), wheelFrame:Number(wheelSelect.value) });
        frameCanvases = prepared.frames.map(pixels => {
          const canvas = document.createElement('canvas'); canvas.width = prepared.width; canvas.height = prepared.height;
          canvas.getContext('2d').putImageData(new ImageData(pixels, prepared.width, prepared.height), 0, 0);
          return canvas;
        });
        sheet.height = Math.max(1, Math.round(320 * source.height / source.width));
        const cleanedCanvas = document.createElement('canvas'); cleanedCanvas.width=source.width;cleanedCanvas.height=source.height;
        cleanedCanvas.getContext('2d').putImageData(new ImageData(cleaned.data, source.width, source.height),0,0);
        const ctx = sheet.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(cleanedCanvas, 0, 0, sheet.width, sheet.height);
        for (let i = 0; i < prepared.crops.length; i++) {
          const crop = prepared.crops[i];
          const x = crop.x / source.width * sheet.width, y = crop.y / source.height * sheet.height;
          ctx.strokeStyle = '#fff'; ctx.strokeRect(x, y, crop.width / source.width * sheet.width, crop.height / source.height * sheet.height);
          ctx.fillStyle = '#000'; ctx.fillRect(x, y, 18, 18); ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(String(i + 1), x + 4, y + 14);
        }
        if (tireFit) {
          const sx=sheet.width/source.width, sy=sheet.height/source.height;
          const origin = index => {
            const crop=prepared.crops[index];
            return { x:crop.x-Math.floor((prepared.width-crop.width)/2), y:crop.y-Math.floor((prepared.height-crop.height)/2) };
          };
          const treadOrigin=origin(Number(treadSelect.value)), wheelOrigin=origin(Number(wheelSelect.value));
          const rect=tireFit.tread.region, circle=tireFit.wheel.region;
          ctx.lineWidth=2;ctx.strokeStyle='#50ff90';
          ctx.strokeRect((treadOrigin.x+rect.x)*sx,(treadOrigin.y+rect.y)*sy,rect.width*sx,rect.height*sy);
          ctx.strokeStyle='#ffd45a';ctx.beginPath();
          ctx.ellipse((wheelOrigin.x+circle.x)*sx,(wheelOrigin.y+circle.y)*sy,circle.radius*sx,circle.radius*sy,0,0,Math.PI*2);ctx.stroke();
        }
        status.textContent = `${source.width} × ${source.height} pixels · Each frame: ${prepared.width} × ${prepared.height} pixels · ${prepared.cleanedPixels} faint background pixels removed, cropped and centered with transparent padding. ${component === 'tires' ? `${cleaned.solidifiedPixels || 0} nearly opaque pixels made solid. Green rectangle: opaque tread. Yellow circle: opaque wheel. Both fitted to the 3D wheel cylinder; other sheet frames remain available in Art.` : `Import replaces all eight ${component} graphics.`}`;
        apply.disabled = false; selects.forEach(s => { s.disabled = false; }); paint();
      } catch (error) { status.textContent = error.message; }
      paint();
    }
    function detectBackground() {
      removeBackground.checked = hasBakedLightBackground(source.getContext('2d').getImageData(0,0,source.width,source.height));
      backgroundHelp.textContent = removeBackground.checked
        ? 'A baked-in light/checkerboard background was detected. Removal is enabled; uncheck to keep it. The original graphic stays unchanged.'
        : 'Only light neutral pixels connected to the image border are removed. The original graphic stays unchanged.';
    }
    cleanup.onchange = processSource;
    function updateImportMode() {
      const tires = component === 'tires';
      tireOptions.hidden = !tires;
      assignments.hidden = assignmentHelp.hidden = resetAssignments.hidden = tires;
      instructions.textContent = tires
        ? 'Choose the sheet layout in columns × rows, with transparent gaps between complete sprites. Frame 1 is tread; frame 3 is the wheel/rim for eight-frame sheets, or frame 2 for smaller sheets. The largest fully opaque tread rectangle and wheel circle cover the cylinder, which spins and steers in 3D.'
        : 'Choose 4 columns and 2 rows with transparent gaps. Frames read left to right: 0°, 45°, 90°, 135° / 180°, 225°, 270°, 315°.';
    }
    updateImportMode();
    let wheelSpin = 0, ticks = 0;
    const timer = setInterval(() => { if (prepared && playing) {
      wheelSpin += 0.15; ticks++;
      if (ticks % 12 === 0) current = (current + 1) % 8;
      if (component === 'tires' || ticks % 12 === 0) paint();
    } }, 50);
    function finish(result) {
      if (closed) return; closed = true; generation++; clearInterval(timer);
      dialog.close(); dialog.remove(); previousFocus?.focus?.(); resolve(result);
    }
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    dialog.addEventListener('close', () => finish(null));
    for (const name of ['keydown', 'keyup']) dialog.addEventListener(name, event => event.stopPropagation());
    document.body.appendChild(dialog); dialog.showModal(); choose.focus();
    if (initial?.canvas) {
      source = initial.canvas; filename = initial.name || 'Car Graphic';
      detectBackground(); processSource();
    }
    paint();
  });
}
