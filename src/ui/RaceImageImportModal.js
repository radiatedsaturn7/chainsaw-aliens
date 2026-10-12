import { raceFromImageTrace } from '../racing/RaceImageTrace.js';

// A native modal keeps the photo workflow out of the editor's canvas hit targets.
export function openRaceImageImport() {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'race-image-import';
    dialog.setAttribute('aria-labelledby', 'race-image-title');
    const style = document.createElement('style');
    style.textContent = `
      .race-image-import { box-sizing:border-box; width:min(760px,96vw); max-height:94dvh; overflow:auto; padding:16px;
        border:1px solid var(--editor-border,#53605b); border-radius:12px; background:var(--editor-surface,#19241f);
        color:var(--editor-text,#eef4ed); font:14px system-ui,sans-serif; }
      .race-image-import::backdrop { background:#000b; }
      .race-image-import h2 { margin:0 0 8px; font-size:20px; }
      .race-image-import p { margin:8px 0; }
      .race-image-import .row { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0; align-items:center; }
      .race-image-import button,.race-image-import input,.race-image-import select { box-sizing:border-box; min-height:44px;
        border:1px solid var(--editor-border,#53605b); border-radius:8px; background:var(--editor-surface-alt,#293930);
        color:inherit; padding:8px; font:inherit; max-width:100%; }
      .race-image-import button { cursor:pointer; }
      .race-image-import button:disabled { opacity:.45; cursor:default; }
      .race-image-import button[aria-pressed=true] { outline:2px solid var(--editor-accent,#8adeb0); }
      .race-image-import label { display:flex; flex:1 1 140px; flex-direction:column; gap:4px; }
      .race-image-import input[type=checkbox] { min-height:24px; }
      .race-image-import canvas { display:block; max-width:100%; max-height:46dvh; width:auto; height:auto; margin:auto;
        background:white; touch-action:none; border:1px solid var(--editor-border,#53605b); }
      .race-image-import .primary { background:var(--editor-accent,#8adeb0); color:#11241a; font-weight:bold; }
      .race-image-import [hidden] { display:none!important; }
    `;
    dialog.appendChild(style);
    function el(tag, text, parent = dialog) {
      const node = document.createElement(tag);
      if (text) node.textContent = text;
      parent.appendChild(node); return node;
    }
    const title = el('h2', 'Race From Image'); title.id = 'race-image-title';
    el('p', 'Choose a photo, then crop around one track. A pencil line becomes the road’s route. Closed lines become circuits; open lines become point-to-point races.');
    const files = el('div'); files.className = 'row';
    const button = (text, fn, parent = files) => {
      const node = el('button', text, parent); node.type = 'button'; node.onclick = fn; return node;
    };
    const upload = el('input'); upload.type = 'file'; upload.accept = 'image/*'; upload.hidden = true;
    const camera = el('input'); camera.type = 'file'; camera.accept = 'image/*'; camera.setAttribute('capture', 'environment'); camera.hidden = true;
    const uploadButton = button('Choose Image', () => upload.click());
    button('Take Photo', () => camera.click());
    const controls = el('div'); controls.className = 'row';
    let mode = 'select', selection = 0, startIndex = 0, candidates = [], source = null, crop = null, drag = null, manualPoints = [];
    let worker = null, generation = 0, closed = false, loading = 0;
    const cropButton = button('Crop One Track', () => setMode(mode === 'crop' ? 'select' : 'crop'), controls);
    button('Whole Page', () => { if (source) { crop = { x:0,y:0,w:source.width,h:source.height }; prepare(); } }, controls);
    const startButton = button('Set Start', () => setMode(mode === 'start' ? 'select' : 'start'), controls);
    const manualButton = button('Trace by Hand', () => {
      if (!source) return;
      worker?.terminate(); worker = null; generation++;
      candidates = []; manualPoints = []; trackSelect.replaceChildren(); importButton.disabled = true;
      setMode('manual');
    }, controls);
    const undoPoint = button('Undo Point', () => { manualPoints.pop(); paint(); }, controls);
    const finishOpen = button('Finish Open Route', () => finishManual(false), controls);
    undoPoint.hidden = finishOpen.hidden = true;
    const canvas = el('canvas'); canvas.width = 640; canvas.height = 360;
    canvas.setAttribute('aria-label', 'Photo preview. Crop one track by dragging; tap a highlighted route to select it.');
    const ctx = canvas.getContext('2d');
    const raster = document.createElement('canvas');
    const rasterCtx = raster.getContext('2d', { willReadFrequently: true });
    const status = el('p', 'Choose an image to begin.'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const settings = el('div'); settings.className = 'row';
    function field(text, type, value, parent = settings) {
      const label = el('label', text, parent), input = el('input', '', label); input.type = type; input.value = value; return input;
    }
    const sensitivity = field('Pencil sensitivity', 'range', 65); sensitivity.min = 0; sensitivity.max = 100;
    const bridge = field('Join tiny pencil gaps', 'checkbox', ''); bridge.checked = true;
    const trackLabel = el('label', 'Detected track', settings), trackSelect = el('select', '', trackLabel);
    const details = el('div'); details.className = 'row';
    const name = field('Race name', 'text', 'Drawing Race', details); name.maxLength = 100;
    const length = field('Track length (metres)', 'number', 1500, details); length.min = 200; length.max = 20000;
    const width = field('Road width (metres)', 'number', 9, details); width.min = 3; width.max = 30; width.step = '.5';
    const reverse = field('Reverse direction', 'checkbox', '', details);
    const footer = el('div'); footer.className = 'row';
    button('Cancel', () => finish(null), footer);
    const importButton = button('Import Track', () => {
      try {
        const race = raceFromImageTrace(candidates[selection], { name: name.value, lengthM: Number(length.value), roadWidthM: Number(width.value), reverse: reverse.checked, startIndex });
        finish(race);
      } catch (error) { status.textContent = error.message; }
    }, footer);
    importButton.className = 'primary'; importButton.disabled = true;
    el('p', 'Check the highlighted route before importing. For faint or broken lines, adjust sensitivity or crop closer. For crossings, broken lines, or two road edges, use Trace by Hand to follow the intended route. The photo stays on this device.');

    function finish(result) {
      if (closed) return;
      closed = true; loading++; generation++; worker?.terminate();
      dialog.close(); dialog.remove(); previousFocus?.focus?.(); resolve(result);
    }
    function setMode(next) {
      mode = next;
      manualButton.setAttribute('aria-pressed', String(mode === 'manual'));
      undoPoint.hidden = finishOpen.hidden = mode !== 'manual';
      if (mode === 'manual') status.textContent = 'Tap along the route, adding a point at each bend. Tap the first point to close a circuit, or choose Finish Open Route. For two edges, trace between them.';
      cropButton.setAttribute('aria-pressed', String(mode === 'crop'));
      startButton.setAttribute('aria-pressed', String(mode === 'start'));
      if (mode === 'crop') status.textContent = 'Drag a box around just one drawing. Leave a little white space around its line.';
      if (mode === 'start') status.textContent = candidates[selection]?.closed ? 'Tap the highlighted route to place the start.' : 'Use Reverse direction to swap the start and finish of an open route.';
      paint();
    }
    function finishManual(isClosed) {
      if (manualPoints.length < (isClosed ? 3 : 2)) { status.textContent = 'Add more points along the track first.'; return; }
      const points = manualPoints.map((p) => ({ ...p }));
      if (isClosed) points.push({ ...points[0] });
      candidates = [{ points, closed: isClosed }]; selection = 0; startIndex = 0;
      trackSelect.replaceChildren(); const option = el('option', isClosed ? 'Traced circuit' : 'Traced point-to-point route', trackSelect); option.value = 0;
      importButton.disabled = false; setMode('select');
      status.textContent = 'Review your traced route, then import it.';
    }
    function paint() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if (!source) return;
      ctx.drawImage(raster,0,0);
      candidates.forEach((candidate, i) => {
        ctx.beginPath(); candidate.points.forEach((p,n) => n ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
        ctx.strokeStyle = i === selection ? '#00b86b' : '#2874ed'; ctx.lineWidth = i === selection ? 4 : 2; ctx.stroke();
        const p = candidate.points[0]; ctx.fillStyle = '#14273c'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(String(i+1),p.x+6,p.y-6);
      });
      const candidate = candidates[selection];
      if (candidate) {
        const points = candidate.points;
        const i = candidate.closed ? startIndex : reverse.checked ? points.length-1 : 0;
        const p = points[i];
        ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.arc(p.x,p.y,7,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
        const next = points[candidate.closed ? (i + (reverse.checked ? points.length-2 : 1)) % (points.length-1) : reverse.checked ? points.length-2 : 1];
        const angle = Math.atan2(next.y-p.y,next.x-p.x);
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+20*Math.cos(angle),p.y+20*Math.sin(angle)); ctx.stroke();
      }
      if (mode === 'manual' && manualPoints.length) {
        ctx.strokeStyle = '#00b86b'; ctx.lineWidth = 3; ctx.beginPath();
        manualPoints.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.stroke();
        manualPoints.forEach((p,i) => { ctx.fillStyle = i ? '#00b86b' : '#ffb300'; ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fill(); });
      }
      if (drag && mode === 'crop') {
        ctx.strokeStyle = '#d423ae'; ctx.lineWidth = 2; ctx.strokeRect(drag.x,drag.y,drag.endX-drag.x,drag.endY-drag.y);
      }
    }
    function prepare() {
      if (!source || closed) return;
      const scale = Math.min(1, 640 / Math.max(crop.w,crop.h));
      raster.width = canvas.width = Math.max(8,Math.round(crop.w*scale));
      raster.height = canvas.height = Math.max(8,Math.round(crop.h*scale));
      rasterCtx.fillStyle = '#fff'; rasterCtx.fillRect(0,0,raster.width,raster.height);
      rasterCtx.drawImage(source,crop.x,crop.y,crop.w,crop.h,0,0,raster.width,raster.height);
      setMode('select'); analyze();
    }
    function analyze() {
      if (!source || closed) return;
      worker?.terminate(); worker = null;
      setMode('select');
      const token = ++generation;
      candidates = []; selection = 0; startIndex = 0; trackSelect.replaceChildren(); importButton.disabled = true;
      status.textContent = 'Tracing pencil lines…'; paint();
      try {
        const image = rasterCtx.getImageData(0,0,raster.width,raster.height);
        worker = new Worker(new URL('./raceImageTraceWorker.js', import.meta.url), { type:'module' });
        worker.onmessage = ({ data }) => {
          if (closed || token !== generation) return;
          worker.terminate(); worker = null;
          if (data.error) { status.textContent = data.error; return; }
          candidates = data.candidates;
          candidates.forEach((candidate,i) => { const option = el('option', `${i+1}: ${candidate.closed ? 'Circuit' : 'Point to point'}`, trackSelect); option.value = i; });
          importButton.disabled = !candidates.length;
          status.textContent = candidates.length
            ? `${candidates.length} route${candidates.length === 1 ? '' : 's'} found. Tap the one you want or use Detected track. Orange marks the start.${data.rejected ? ' Some branching lines could not be traced; crop closer if your track is missing.' : ''}`
            : 'No complete route found. Crop closer around one track or adjust pencil sensitivity. Remove crossings or touching labels from the crop.';
          paint();
        };
        worker.onerror = () => { if (token === generation && !closed) { worker?.terminate(); worker = null; status.textContent = 'Could not trace this image. Try a smaller crop or another photo.'; } };
        worker.postMessage({ image, options: { sensitivity:Number(sensitivity.value), bridgeGaps:bridge.checked } }, [image.data.buffer]);
      } catch (error) { status.textContent = error.message || 'Could not read this image.'; }
    }
    async function load(file) {
      if (!file) return;
      const token = ++loading;
      worker?.terminate(); generation++; candidates = []; importButton.disabled = true;
      status.textContent = 'Opening photo…';
      const url = URL.createObjectURL(file);
      try {
        const image = new Image(); image.src = url; await image.decode();
        if (closed || token !== loading) return;
        const scale = Math.min(1, 3200/Math.max(image.naturalWidth,image.naturalHeight));
        source = document.createElement('canvas'); source.width = Math.round(image.naturalWidth*scale); source.height = Math.round(image.naturalHeight*scale);
        const context = source.getContext('2d'); context.fillStyle='#fff'; context.fillRect(0,0,source.width,source.height); context.drawImage(image,0,0,source.width,source.height);
        crop = { x:0,y:0,w:source.width,h:source.height };
        name.value = file.name.replace(/\.[^.]+$/, '').slice(0,90) || 'Drawing Race';
        prepare();
      } catch { if (!closed && token === loading) status.textContent = 'This photo could not be opened. Try a JPEG or PNG image.'; }
      finally { URL.revokeObjectURL(url); }
    }
    upload.onchange = () => { void load(upload.files[0]); upload.value = ''; };
    camera.onchange = () => { void load(camera.files[0]); camera.value = ''; };
    sensitivity.onchange = analyze; bridge.onchange = analyze; reverse.onchange = paint;
    trackSelect.onchange = () => { selection = Number(trackSelect.value); startIndex = 0; paint(); };
    function point(event) {
      const bounds = canvas.getBoundingClientRect();
      return { x:clamp((event.clientX-bounds.left)*canvas.width/bounds.width,0,canvas.width-1), y:clamp((event.clientY-bounds.top)*canvas.height/bounds.height,0,canvas.height-1) };
    }
    canvas.onpointerdown = (event) => {
      if (!source) return;
      event.preventDefault(); canvas.setPointerCapture(event.pointerId);
      const p = point(event);
      if (mode === 'manual') {
        if (manualPoints.length >= 3 && Math.hypot(p.x-manualPoints[0].x,p.y-manualPoints[0].y) < 12) finishManual(true);
        else if (!manualPoints.length || Math.hypot(p.x-manualPoints.at(-1).x,p.y-manualPoints.at(-1).y) >= 3) { manualPoints.push(p); paint(); }
        return;
      }
      if (mode === 'crop') { drag = { ...p, endX:p.x,endY:p.y, id:event.pointerId }; return; }
      let distance = Infinity, chosen = selection, index = 0;
      candidates.forEach((candidate,i) => {
        if (mode === 'start' && i !== selection) return;
        candidate.points.slice(0,-1).forEach((a,j) => {
          const b = candidate.points[j+1], dx = b.x-a.x, dy = b.y-a.y;
          const t = clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy || 1),0,1);
          const d = Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
          if (d < distance) { distance = d; chosen = i; index = j; }
        });
      });
      if (mode === 'start' && candidates[selection]?.closed) startIndex = index;
      else { selection = chosen; startIndex = 0; trackSelect.value = chosen; }
      paint();
    };
    canvas.onpointermove = (event) => { if (drag?.id === event.pointerId) { const p = point(event); drag.endX=p.x; drag.endY=p.y; paint(); } };
    canvas.onpointerup = (event) => {
      if (drag?.id !== event.pointerId) return;
      const p = point(event), x = Math.min(drag.x,p.x), y = Math.min(drag.y,p.y), w = Math.abs(p.x-drag.x), h = Math.abs(p.y-drag.y);
      drag = null;
      if (w < 16 || h < 16) { status.textContent = 'Drag a larger box around the whole track.'; paint(); return; }
      crop = { x:crop.x+x/canvas.width*crop.w, y:crop.y+y/canvas.height*crop.h, w:w/canvas.width*crop.w, h:h/canvas.height*crop.h };
      prepare();
    };
    canvas.onpointercancel = () => { drag = null; paint(); };
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(null); });
    dialog.addEventListener('close', () => finish(null));
    dialog.addEventListener('keydown', (event) => event.stopPropagation());
    dialog.addEventListener('keyup', (event) => event.stopPropagation());
    document.body.appendChild(dialog); dialog.showModal(); uploadButton.focus();
  });
}
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
